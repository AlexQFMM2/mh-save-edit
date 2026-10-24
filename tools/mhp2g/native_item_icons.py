"""P2G-CGCN icon extraction, run in memory on the machine holding the game.

Only cropped PNGs and the minimum mapping/provenance leave that machine.
BOOT addresses were traced through the native item draw path; see the generated
manifest and docs/mhp2g/item-icons.md. No original executable or atlas is emitted.
"""
import base64
import hashlib
import json
import struct
import zlib
from pathlib import Path

BOOT_SHA256 = '3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846'
TOC_SHA256 = 'f1879b5f8302bf30f713cc22e19087df7518448e6e12e1fc6a78c5688cdb67c7'
MEMBER_SHA256 = '2e77f051e05e115c514671f3beb0b6425b5c902f506eb68cc0bb994c5a9cb297'
ITEMS_VA, COLORS_VA, INDEX_VA, RECTS_VA = 0x0899A238, 0x08937FA4, 0x08938014, 0x089366F0
ITEM_COUNT, ITEM_STRIDE, ICON_COUNT = 1261, 24, 56


def digest(data):
    return hashlib.sha256(data).hexdigest()


def require_hash(data, expected, label):
    if digest(data) != expected:
        raise ValueError(f'{label} fingerprint mismatch; this extractor only supports the verified P2G-CGCN snapshot')


def decode_member(data, seed, substitution):
    if len(substitution) != 256 or len(set(substitution)) != 256 or len(data) % 4:
        raise ValueError('Invalid cipher table or member alignment')
    low, high = seed & 65535 or 0x7F8D, seed >> 16 or 0x2345
    data = data.translate(substitution)
    result = bytearray(len(data))
    for offset in range(0, len(data), 4):
        low, high = low * 0x7F8D % 0xFFF1, high * 0x2345 % 0xFFD9
        struct.pack_into('<I', result, offset, struct.unpack_from('<I', data, offset)[0] ^ (high << 16 | low))
    return bytes(result)


def elf_reader(data):
    if data[:6] != b'\x7fELF\x01\x01':
        raise ValueError('Expected 32-bit little-endian ELF')
    offset = struct.unpack_from('<I', data, 28)[0]
    stride, count = struct.unpack_from('<HH', data, 42)
    segments = [struct.unpack_from('<8I', data, offset + i * stride) for i in range(count)]

    def read(va, size):
        for kind, file_offset, address, _, file_size, *_ in segments:
            if kind == 1 and address <= va and va + size <= address + file_size:
                result = data[file_offset + va - address:file_offset + va - address + size]
                if len(result) == size:
                    return result
        raise ValueError(f'Unbacked ELF range {va:#x}+{size}')
    return read


def tmh_pictures(data):
    if data[:4] != b'.TMH':
        raise ValueError('Expected TMH resource')
    count = struct.unpack_from('<I', data, 8)[0]
    if not 1 <= count <= 32:
        raise ValueError('Invalid TMH picture count')
    pictures, offset = [], 16
    for _ in range(count):
        size, kind, images, palettes, pixel_size, pixel_kind, pixel_format, dimensions = struct.unpack_from('<8I', data, offset)
        width, height = dimensions & 65535, dimensions >> 16
        palette_offset = offset + 16 + pixel_size
        if (kind, images, palettes, pixel_kind, pixel_format) != (0, 1, 1, 1, 5):
            raise ValueError('Unverified TMH pixel format')
        if width % 16 or height % 8 or pixel_size != width * height + 16 or size != 16 + pixel_size + 1040 or offset + size > len(data):
            raise ValueError('Invalid TMH picture bounds')
        if struct.unpack_from('<4I', data, palette_offset) != (1040, 2, 3, 256):
            raise ValueError('Unverified TMH palette format')
        pictures.append((width, height, data[offset+32:palette_offset], data[palette_offset+16:palette_offset+1040]))
        offset += size
    return pictures


def crop_tinted(picture, rectangle, tint):
    width, height, pixels, palette = picture
    x, y, crop_width, crop_height = rectangle
    if min(x, y) < 0 or min(crop_width, crop_height) <= 0 or x + crop_width > width or y + crop_height > height:
        raise ValueError('Icon crop outside texture')
    result = bytearray()
    for py in range(y, y + crop_height):
        for px in range(x, x + crop_width):
            # PSP T8: 16-byte by 8-row tiles, in row-major tile order.
            offset = ((py // 8) * (width // 16) + px // 16) * 128 + (py % 8) * 16 + px % 16
            color = palette[pixels[offset]*4:pixels[offset]*4+4]
            result.extend((channel * scale + 127) // 255 for channel, scale in zip(color[:3], tint))
            result.append(color[3])
    if not any(result[3::4]):
        raise ValueError('Empty icon crop')
    return bytes(result)


def encode_png(width, height, pixels):
    if len(pixels) != width * height * 4:
        raise ValueError('PNG pixel length mismatch')
    def chunk(kind, value):
        return struct.pack('>I', len(value)) + kind + value + struct.pack('>I', zlib.crc32(kind + value) & 0xFFFFFFFF)
    scanlines = b''.join(b'\0' + pixels[y*width*4:(y+1)*width*4] for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(scanlines, 9)) + chunk(b'IEND', b'')


def extract(game_root, substitution, toc):
    root = Path(game_root) / 'PSP_GAME'
    boot = (root / 'SYSDIR' / 'BOOT.BIN').read_bytes()
    require_hash(boot, BOOT_SHA256, 'BOOT')
    read = elf_reader(boot)
    native_items = read(ITEMS_VA, ITEM_COUNT * ITEM_STRIDE)
    colors = read(COLORS_VA, 44)
    indices = read(INDEX_VA, ICON_COUNT * 2)
    with (root / 'USRDIR' / 'DATA.BIN').open('rb') as file:
        header = file.read(17 * 2048)
        require_hash(header, TOC_SHA256, 'DATA directory')
        directory = decode_member(header, 0, substitution)
        if list(struct.unpack_from(f'<{len(toc)}I', directory)) != toc:
            raise ValueError('Resource directory differs from the pinned research index')
        start, end = toc[5323:5325]
        if not 0 < end - start < 1024:
            raise ValueError('Unexpected icon resource size')
        file.seek(start * 2048)
        member = decode_member(file.read((end-start)*2048), start, substitution)
    require_hash(member, MEMBER_SHA256, 'DATA member 5323')
    pictures = tmh_pictures(member)
    files, icons, items = {}, {}, []
    for item_id in range(1, ITEM_COUNT):
        row = native_items[item_id*ITEM_STRIDE:(item_id+1)*ITEM_STRIDE]
        icon_id, color_id = row[5:7]
        if icon_id >= ICON_COUNT or color_id >= len(colors) // 4:
            raise ValueError(f'Unknown icon/color for item {item_id}')
        key = f'{icon_id}:{color_id}'
        if key not in icons:
            descriptor_id = struct.unpack_from('<H', indices, icon_id*2)[0]
            descriptor = read(RECTS_VA + descriptor_id*12, 12)
            x, y, width, height, texture, resource = struct.unpack('<6H', descriptor)
            if resource != 11 or texture not in (0x8000, 0x8001) or (width, height) != (24, 24):
                raise ValueError(f'Unverified descriptor for icon {icon_id}')
            picture = texture & 0xFFF
            tint = list(colors[color_id*4:color_id*4+3])
            pixels = crop_tinted(pictures[picture], (x, y, width, height), tint)
            png = encode_png(width, height, pixels)
            sha = digest(png)
            files[sha] = base64.b64encode(png).decode('ascii')
            icons[key] = dict(iconId=icon_id, colorId=color_id, descriptorId=descriptor_id,
                              descriptorVa=RECTS_VA+descriptor_id*12, descriptorSha256=digest(descriptor),
                              picture=picture, crop=[x,y,width,height], tint=tint, pngSha256=sha,
                              path=f'catalog/icons/{sha}.png')
        items.append(dict(itemId=item_id, iconKey=key, rowSha256=digest(row)))
    tables = [dict(va=va, size=len(data), sha256=digest(data)) for va, data in
              [(ITEMS_VA, native_items), (COLORS_VA, colors), (INDEX_VA, indices)]]
    return dict(schema='mhp2g-item-icons-v1', gameId='mhp2g',
                source=dict(gameRoot=str(Path(game_root)), bootSha256=BOOT_SHA256, tocSha256=TOC_SHA256,
                            member=5323, memberSha256=MEMBER_SHA256, tables=tables),
                rendering=dict(size=24, indexBank=0, textureFunction='RGBA modulate; RGB rounded to nearest byte; texture alpha preserved'),
                icons=list(icons.values()), items=items, files=files)
