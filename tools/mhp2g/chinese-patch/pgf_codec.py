"""Small revision-2 PGF writer/reader with explicit metrics and a generated map.

The nibble RLE format and little-endian bit packing follow the MIT-licensed
TTF-OTF-2-PGF reference. No template headers, character tables or glyphs are used.
See THIRD_PARTY_PGF.txt. This module has no font-rendering dependency.
"""
import struct


class Bits:
    def __init__(self):
        self.data = bytearray()
        self.position = 0

    def put(self, size, value):
        if value < 0:
            value += 1 << size
        if not 0 <= value < 1 << size:
            raise ValueError('PGF field overflow')
        for bit in range(size):
            at = self.position // 8
            if at == len(self.data):
                self.data.append(0)
            self.data[at] |= ((value >> bit) & 1) << (self.position % 8)
            self.position += 1


def read_bits(data, position, count):
    if position < 0 or position + count > len(data) * 8:
        raise ValueError('Truncated PGF bit field')
    return sum(((data[(position+i)//8] >> ((position+i) % 8)) & 1) << i for i in range(count))


def pack_table(values, width):
    out = Bits()
    for value in values:
        out.put(width, value)
    out.data.extend(bytes((-len(out.data)) % 4))
    return bytes(out.data)


def rle_encode(pixels):
    if any(not 0 <= pixel <= 15 for pixel in pixels):
        raise ValueError('Not a four-bit bitmap')
    nibbles, pos = [], 0
    while pos < len(pixels):
        end = pos + 1
        while end < len(pixels) and end-pos < 8 and pixels[end] == pixels[pos]:
            end += 1
        if end-pos > 1:
            nibbles.extend((end-pos-1, pixels[pos]))
            pos = end
        else:
            start = pos
            pos += 1
            while pos < len(pixels) and pos-start < 8:
                if pos+1 < len(pixels) and pixels[pos] == pixels[pos+1]:
                    break
                pos += 1
            nibbles.extend((16-(pos-start), *pixels[start:pos]))
    if len(nibbles) % 2:
        nibbles.append(0)
    return bytes(a | b << 4 for a, b in zip(nibbles[::2], nibbles[1::2]))


def rle_decode(data, count):
    pixels, bit = [], 0
    while len(pixels) < count:
        control = read_bits(data, bit, 4)
        bit += 4
        size = control+1 if control < 8 else 16-control
        if len(pixels)+size > count:
            raise ValueError('PGF bitmap overrun')
        if control < 8:
            pixels.extend([read_bits(data, bit, 4)] * size)
            bit += 4
        else:
            pixels.extend(read_bits(data, bit+i*4, 4) for i in range(size))
            bit += size*4
    if (bit+7)//8 != len(data):
        raise ValueError('Trailing PGF bitmap bytes')
    return pixels


def encode_pgf(glyphs, pixels_per_em=16):
    if not glyphs or len(glyphs) > 4096:
        raise ValueError('Invalid glyph count')
    codes = sorted(glyphs)
    if not 32 <= codes[0] <= codes[-1] < 0xfff0 or any(0xd800 <= c <= 0xdfff for c in codes):
        raise ValueError('Unsupported game codepoint')
    records, pointers, offset = [], [], 0
    for code in codes:
        g = glyphs[code]
        width, height, left, top = (g[k] for k in ('width', 'height', 'left', 'top'))
        if not 0 < width < 64 or not 0 < height < 64 or not -64 <= left < 64 or not -64 <= top < 64:
            raise ValueError('Invalid glyph bounds')
        if len(g['pixels']) != width*height or not any(g['pixels']):
            raise ValueError('Empty or inconsistent glyph bitmap')
        bitmap = rle_encode(g['pixels'])
        out = Bits()
        for size, value in ((14, 40+len(bitmap)), (7, width), (7, height), (7, left), (7, top),
                            (6, 1), (7, 0), (9, 0)):
            out.put(size, value)
        # Four metric pairs are stored inline, avoiding fixed template indices.
        for value in (width*64, height*64, left*64, left*64, top*64, top*64, g['advance'], 0):
            out.put(32, value)
        assert len(out.data) == 40
        record = bytes(out.data) + bitmap
        record += bytes((-len(record)) % 4)
        records.append(record)
        pointers.append(offset//4)
        offset += len(record)
    map_width, pointer_width = max(1, len(codes).bit_length()), max(1, max(pointers).bit_length())
    lookup = dict(zip(codes, range(len(codes))))
    charmap = pack_table([lookup.get(c, (1 << map_width)-1) for c in range(codes[0], codes[-1]+1)], map_width)
    header = bytearray(392)
    struct.pack_into('<HH4s6I', header, 0, 0, 392, b'PGF0', 2, 6, codes[-1]-codes[0]+1, len(codes), map_width, pointer_width)
    header[32:35] = bytes((4, 4, 4))
    struct.pack_into('<4i', header, 36, pixels_per_em*64, pixels_per_em*64, 72*64, 72*64)
    header[53:53+len(b'P2G Project Sans')] = b'P2G Project Sans'
    header[117:124] = b'Regular'
    struct.pack_into('<HH', header, 182, codes[0], codes[-1])
    gs = list(glyphs.values())
    max_width, max_height = max(g['width'] for g in gs), max(g['height'] for g in gs)
    ascender, descender = max(g['top'] for g in gs)*64, min(g['top']-g['height'] for g in gs)*64
    struct.pack_into('<10i2H', header, 212, ascender, descender, max(g['left'] for g in gs)*64,
                     ascender, 0, ascender, max(g['advance'] for g in gs), 0, max_width*64, max_height*64,
                     max_width, max_height)
    struct.pack_into('<Ifii', header, 368, 0, 0.0, 32, 32)
    return bytes(header) + charmap + pack_table(pointers, pointer_width) + b''.join(records)


def decode_pgf(data):
    if len(data) < 392 or data[4:8] != b'PGF0':
        raise ValueError('Bad PGF header')
    _, size, _, revision, version, map_count, count, map_bits, pointer_bits = struct.unpack_from('<HH4s6I', data)
    first, last = struct.unpack_from('<HH', data, 182)
    if size != 392 or revision != 2 or version != 6 or not 0 < count <= 4096 or map_count != last-first+1:
        raise ValueError('Unsupported PGF layout')
    if not 1 <= map_bits <= 16 or not 1 <= pointer_bits <= 24 or any(data[258:262]) or any(data[364:372]):
        raise ValueError('Unexpected PGF tables')
    map_size, pointer_size = ((map_count*map_bits+31)//32)*4, ((count*pointer_bits+31)//32)*4
    map_at, pointer_at, glyph_at = 392, 392+map_size, 392+map_size+pointer_size
    if glyph_at >= len(data):
        raise ValueError('Truncated PGF tables')
    pointers = [read_bits(data, pointer_at*8+i*pointer_bits, pointer_bits)*4 for i in range(count)]
    if pointers[0] or any(b <= a for a, b in zip(pointers, pointers[1:])):
        raise ValueError('Invalid PGF pointers')
    decoded = []
    for index, pointer in enumerate(pointers):
        start = glyph_at+pointer
        end = glyph_at+pointers[index+1] if index+1 < count else len(data)
        record = data[start:end]
        length = read_bits(record, 0, 14)
        width, height = read_bits(record, 14, 7), read_bits(record, 21, 7)
        left, top = read_bits(record, 28, 7), read_bits(record, 35, 7)
        left, top = left-128 if left >= 64 else left, top-128 if top >= 64 else top
        if not width or not height or read_bits(record, 42, 6) != 1 or not 40 < length <= len(record) or len(record) != ((length+3)//4)*4:
            raise ValueError('Bad PGF glyph record')
        if any(record[length:]):
            raise ValueError('Nonzero PGF padding')
        metrics = struct.unpack_from('<8i', record, 8)
        if metrics[:6] != (width*64, height*64, left*64, left*64, top*64, top*64):
            raise ValueError('Inconsistent PGF glyph metrics')
        decoded.append(dict(width=width, height=height, left=left, top=top, advance=metrics[6], pixels=rle_decode(record[40:length], width*height)))
    result = {}
    used = set()
    for i in range(map_count):
        index = read_bits(data, map_at*8+i*map_bits, map_bits)
        if index < count:
            if index in used:
                raise ValueError('Unexpected aliased glyph')
            used.add(index)
            result[first+i] = decoded[index]
        elif index != (1 << map_bits)-1:
            raise ValueError('Invalid PGF map value')
    if len(used) != count:
        raise ValueError('Unmapped glyph')
    return result
