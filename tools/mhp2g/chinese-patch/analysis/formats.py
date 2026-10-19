"""Bounded structural readers. No game input, cipher table or text is embedded."""
import hashlib
import struct


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def u32(data, offset):
    require(0 <= offset <= len(data) - 4, f'u32 outside buffer: {offset}')
    return struct.unpack_from('<I', data, offset)[0]


def data_directory(decoded, data_bytes):
    require(data_bytes > 0 and data_bytes % 2048 == 0, 'DATA sector alignment')
    first = u32(decoded, 0)
    require(1 <= first <= 512 and len(decoded) == first * 2048, 'TOC size')
    entries, previous = [], first
    for at in range(0, len(decoded), 4):
        sector = u32(decoded, at)
        require(previous <= sector <= data_bytes // 2048, f'TOC bounds/order at {at}')
        entries.append(sector)
        if sector * 2048 == data_bytes:
            require(len(entries) >= 2, 'Empty TOC')
            return entries
        previous = sector
    raise ValueError('Missing DATA end sentinel')


def signatures(data, total_bytes):
    """A signature is a format candidate, never evidence of absence of text."""
    result = []
    for magic, name in [(b'.TMH', 'tmh'), (b'TIM2', 'tim2'), (b'OMG.', 'gmo'),
                        (b'RIFF', 'riff'), (b'PSMF', 'psmf'), (b'\x7fELF', 'elf'),
                        (b'~PSP', 'psp-module'), (b'\x89PNG\r\n\x1a\n', 'png'),
                        (b'\0PSF', 'sfo'), (b'VAGp', 'vag'), (b'MIG.', 'gim'),
                        (b'MWo3', 'overlay'), (b'Head', 'head-container'), (b'dbsT', 'dbst')]:
        if data.startswith(magic):
            result.append(name)
    if len(data) >= 8 and data[4:8] == b'2NDG':
        result.append('quest-2ndg')
    if len(data) >= 12:
        count = u32(data, 0)
        if 1 <= count <= 128 and 8 + count * 4 <= len(data):
            pointers = [u32(data, 8 + i * 4) for i in range(count)]
            valid = [p for p in pointers if p != 0xffffffff]
            if valid and all(8 + count * 4 <= p < total_bytes for p in valid):
                result.append('count-offsets-at-8-candidate')
    return result


def iso_catalog(read_at, iso_bytes, max_entries=4096):
    pvd = read_at(16 * 2048, 2048)
    require(pvd[:7] == b'\x01CD001\x01', 'Not ISO9660 primary volume')

    def record(data, offset):
        require(0 <= offset < len(data), 'Directory record start')
        size = data[offset]
        require(size >= 34 and offset + size <= len(data), 'Directory record length')
        r = data[offset:offset + size]
        require(33 + r[32] <= size, 'Directory name outside record')
        lba, length = u32(r, 2), u32(r, 10)
        require(lba == int.from_bytes(r[6:10], 'big') and
                length == int.from_bytes(r[14:18], 'big'), 'ISO endian mismatch')
        require(lba * 2048 + length <= iso_bytes, 'ISO extent outside file')
        require(not (r[25] & 0x80), 'Multi-extent ISO file unsupported')
        name = r[33:33 + r[32]]
        return size, name, lba * 2048, length, r[25]

    _, _, root_at, root_size, flags = record(pvd, 156)
    require(flags & 2, 'ISO root is not a directory')
    pending, seen, results = [('', root_at, root_size)], set(), []
    while pending:
        parent, at, length = pending.pop(0)
        require((at, length) not in seen, 'Cyclic/aliased ISO directory')
        seen.add((at, length))
        require(length <= 4 * 1024 * 1024, 'Oversized ISO directory')
        data, pos = read_at(at, length), 0
        while pos < len(data):
            if data[pos] == 0:
                pos = (pos // 2048 + 1) * 2048
                continue
            size, name, start, count, flags = record(data, pos)
            require(pos // 2048 == (pos + size - 1) // 2048, 'Record crosses sector')
            pos += size
            if name in (b'\0', b'\1'):
                continue
            name = name.decode('ascii').split(';')[0]
            require(name and name not in ('.', '..') and '/' not in name and '\\' not in name,
                    'Unsafe ISO name')
            path = f'{parent}/{name}'.lstrip('/')
            require(not any(r['path'] == path for r in results), 'Duplicate ISO path')
            results.append(dict(path=path, offset=start, bytes=count, directory=bool(flags & 2)))
            require(len(results) <= max_entries, 'ISO entry limit')
            if flags & 2:
                pending.append((path, start, count))
    return sorted(results, key=lambda r: r['path'])


def cstring(data, start, limit, encoding='utf-8'):
    require(0 <= start < limit <= len(data), 'String bounds')
    end = data.find(b'\0', start, min(limit, start + 16384))
    require(end >= start, 'Missing/beyond-limit string terminator')
    raw = data[start:end]
    text = raw.decode(encoding, errors='strict')
    require(text.encode(encoding) == raw, 'Encoding round trip')
    return dict(offset=start, bytes=len(raw), sha256=sha256(raw), text=text, encoding=encoding)


def pointer_strings(data, base, limit):
    require(0 <= base < limit <= len(data), 'Text table bounds')
    rows = []
    for index in range(20000):
        slot = base + index * 4
        require(slot + 4 <= limit, 'Pointer list outside table')
        relative = u32(data, slot)
        if relative == 0xffffffff:
            require(all(r['offset'] >= slot + 4 for r in rows), 'Text overlaps pointer list')
            return rows
        row = cstring(data, base + relative, limit)
        rows.append(dict(index=index, pointerOffset=slot, relative=relative, **row))
    raise ValueError('Text pointer count limit')


def flagged_strings(data, base, limit):
    require(0 <= base <= limit - 8 <= len(data) - 8, 'Flagged table bounds')
    first = u32(data, base + 4)
    require(8 <= first <= limit - base and first % 8 == 0, 'Flagged index length')
    require(first // 8 <= 20000, 'Flagged row count limit')
    rows = []
    for index in range(first // 8):
        slot = base + index * 8
        flag, relative = u32(data, slot), u32(data, slot + 4)
        require(first <= relative < limit - base, 'Flagged string overlaps index/outside table')
        rows.append(dict(index=index, flag=flag, pointerOffset=slot + 4,
                         relative=relative, **cstring(data, base + relative, limit)))
    return rows


def text_directory(data):
    require(len(data) >= 16, 'Short text resource')
    count = u32(data, 0)
    if 1 <= count <= 128 and u32(data, 4) == 8 and 8 + count * 4 <= len(data):
        offsets = [(i, u32(data, 8 + i * 4)) for i in range(count)]
        offsets = [(i, at) for i, at in offsets if at != 0xffffffff]
        header_end, kind = 8 + count * 4, 'count-offsets-at-8'
    else:
        offsets, header_end, kind = [], None, 'id-offset-pairs'
        for at in range(0, min(len(data) - 7, 4096), 8):
            identity, offset = u32(data, at), u32(data, at + 4)
            if identity == offset == 0xffffffff:
                header_end = at + 8
                break
            require(identity < 65536, 'Not an ID/offset directory')
            offsets.append((identity, offset))
        require(header_end is not None, 'No ID/offset terminator')
    require(offsets and len(set(i for i, _ in offsets)) == len(offsets), 'Duplicate/empty table IDs')
    require(all(header_end <= at < len(data) for _, at in offsets), 'Table directory bounds')
    return kind, [dict(table=i, offset=at,
                      limit=min([n for _, n in offsets if n > at] + [len(data)])) for i, at in offsets]


def quest_payload(data):
    """P2G quest envelope, verified by its embedded payload digest."""
    require(len(data) >= 32 and len(data) % 2 == 0, 'Quest envelope length')
    mods, mul = [0xff9d, 0xffa9, 0xffc7, 0xfff1], [0x1709, 0x3df3, 0x747b, 0xb381]
    keys = [v or mods[i] for i, v in enumerate(struct.unpack_from('<4H', data))]
    output = bytearray(len(data) - 8)
    for i in range(len(output) // 2):
        lane = i % 4
        keys[lane] = keys[lane] * mul[lane] % mods[lane]
        struct.pack_into('<H', output, i * 2,
                         struct.unpack_from('<H', data, 8 + i * 2)[0] ^ keys[lane])
    size = u32(output, 0)
    require(128 <= size <= len(output) - 24, 'Quest payload size')
    payload = bytes(output[24:24 + size])
    require(hashlib.sha1(payload + b'37wyS2Jfc3x5w9oG').digest() == output[4:24], 'Quest payload digest')
    require(payload[:8] == b'\x4c\0\0\0' + b'2NDG', 'Quest header')
    return payload


def archive_members(data):
    count = u32(data, 0)
    require(1 <= count <= 128 and 4 + count * 8 <= len(data), 'Archive directory count')
    entries = []
    for index in range(count):
        offset, size = u32(data, 4 + index * 8), u32(data, 8 + index * 8)
        if offset == size == 0:
            entries.append(dict(index=index, offset=0, bytes=0))
            continue
        require(4 + count * 8 <= offset <= len(data) and 0 < size <= len(data) - offset,
                'Archive member bounds')
        require(all(not row['bytes'] or offset + size <= row['offset'] or
                    row['offset'] + row['bytes'] <= offset for row in entries), 'Overlapping archive members')
        entries.append(dict(index=index, offset=offset, bytes=size))
    require(any(row['bytes'] for row in entries), 'Empty archive candidate')
    return entries


def tmh_index(data):
    require(data[:8] == b'.TMH0.14', 'Unsupported TMH version')
    count, offset, pictures = u32(data, 8), 16, []
    require(1 <= count <= 1024, 'TMH picture count')
    for index in range(count):
        require(offset + 32 <= len(data), 'TMH header bounds')
        size, kind, images, palettes, pixel_size, pixel_kind, pixel_format, dimensions = struct.unpack_from('<8I', data, offset)
        require(32 <= size <= len(data) - offset and 16 <= pixel_size <= size - 16, 'TMH record bounds')
        width, height = dimensions & 65535, dimensions >> 16
        require(0 < width <= 4096 and 0 < height <= 4096, 'TMH dimensions')
        picture = dict(index=index, offset=offset, bytes=size, recordSha256=sha256(data[offset:offset + size]),
                       width=width, height=height, kind=kind, images=images, palettes=palettes,
                       pixelBytes=pixel_size, pixelKind=pixel_kind, pixelFormat=pixel_format,
                       textStatus='unreviewed', layoutBindings=[])
        if palettes:
            at = offset + 16 + pixel_size
            require(at + 16 <= offset + size, 'TMH palette header bounds')
            palette_size, palette_kind, palette_format, colors = struct.unpack_from('<4I', data, at)
            require(16 <= palette_size <= offset + size - at, 'TMH palette size')
            picture['palette'] = dict(offset=at, bytes=palette_size, kind=palette_kind,
                                      format=palette_format, colors=colors)
        pictures.append(picture)
        offset += size
    return dict(pictures=pictures, trailingBytes=len(data) - offset,
                trailingNonzero=any(data[offset:]))
