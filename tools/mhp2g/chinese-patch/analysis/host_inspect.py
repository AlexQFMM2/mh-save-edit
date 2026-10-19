"""Bounded static references and instruction windows; never attaches to a game."""
from pathlib import Path


def inspect(config, substitution):
    inventory, queries = config['inventory'], config.get('queries', [])
    require(inventory['isoSha256'] == config['expected']['isoSha256'], 'Inventory ISO mismatch')
    root, cache = Path(inventory['expanded']), {}

    def source(identity):
        if identity not in cache:
            if identity == 'boot':
                blob = (root / 'PSP_GAME/SYSDIR/BOOT.BIN').read_bytes()
                require(sha256(blob) == config['expected']['boot']['sha256'], 'BOOT mismatch')
                require(blob[:6] == b'\x7fELF\x01\x01', 'BOOT ELF type')
                at = u32(blob, 28)
                stride, count = struct.unpack_from('<HH', blob, 42)
                require(stride >= 32 and at + stride * count <= len(blob), 'ELF program headers')
                segments = [struct.unpack_from('<8I', blob, at + i * stride) for i in range(count)]
                segments = [s for s in segments if s[0] == 1 and s[4] > 0]
                require(len(segments) == 1, 'Multiple ELF loads need explicit mapping')
                s = segments[0]
                require(s[1] + s[4] <= len(blob), 'ELF segment bounds')
                cache[identity] = dict(name='BOOT.BIN', base=s[2], fileOffset=s[1],
                                       sha256=sha256(blob), data=blob[s[1]:s[1] + s[4]])
            else:
                entry = inventory['data']['members'][identity]
                require(entry['member'] == identity and entry['bytes'] <= 4 * 1024 * 1024,
                        'Source member bound')
                with (root / 'PSP_GAME/USRDIR/DATA.BIN').open('rb') as file:
                    file.seek(entry['offset'])
                    raw = file.read(entry['bytes'])
                require(sha256(raw) == entry['storedSha256'], 'Source member hash')
                plaintext = identity in config['plaintextExceptions']
                blob = raw if plaintext else decode_member(raw, entry['lba'], substitution)
                overlay = blob[:4] == b'MWo3'
                name = blob[32:64].split(b'\0')[0].decode('ascii') if overlay else f'data:{identity}'
                cache[identity] = dict(name=name, base=u32(blob, 8) if overlay else 0,
                                       fileOffset=0, sha256=sha256(blob), data=blob,
                                       storageView='plaintext' if plaintext else 'data-decoded')
        return cache[identity]

    def window(s, address, before, after):
        start, end = max(s['base'], address - before), min(s['base'] + len(s['data']), address + after)
        require(start % 4 == 0 and end % 4 == 0 and end - start <= 8192, 'Instruction window limit')
        data = s['data'][start - s['base']:end - s['base']]
        return dict(start=start, bytes=len(data), sha256=sha256(data),
                    words=list(struct.unpack('<' + 'I' * (len(data) // 4), data)))

    results = []
    for q in queries:
        s = source(q.get('source', 'boot'))
        data, base, kind = s['data'], s['base'], q['kind']
        result = dict(query=q, sourceSha256=s['sha256'], sourceBase=base)
        if kind == 'metadata':
            result.update(name=s['name'], bytes=len(data),
                          headerWords=[u32(data, at) for at in range(0, min(len(data) - 3, 32), 4)])
        elif kind == 'range':
            start, size = q['start'], q['bytes']
            require(base <= start <= base + len(data) - size and 0 < size <= 8192, 'Range bounds')
            result['range'] = window(s, start, 0, size)
        elif kind in ('calls', 'constants', 'pointers', 'addresses'):
            values, hits = set(q['values']), []
            require(len(values) <= 256, 'Target count bound')
            for at in range(0, len(data) - 3, 4):
                word, pc = u32(data, at), base + at
                op, rs, rt = word >> 26, (word >> 21) & 31, (word >> 16) & 31
                value = word
                if kind == 'calls':
                    if op not in (2, 3):
                        continue
                    value = ((pc + 4) & 0xf0000000) | ((word & 0x3ffffff) << 2)
                elif kind == 'constants':
                    if op not in (9, 13) or rs != 0 or ('registers' in q and rt not in q['registers']):
                        continue
                    value = word & 0xffff
                elif kind == 'addresses':
                    if op not in (9, 13, 32, 33, 35, 36, 37):
                        continue
                    found = False
                    for back in range(4, min(at, 32) + 1, 4):
                        previous = u32(data, at - back)
                        if previous >> 26 == 15 and (previous >> 16) & 31 == rs:
                            low = word & 0xffff
                            value = ((previous & 0xffff) << 16) + (low if op == 13 or low < 32768 else low - 65536)
                            found = True
                            break
                    if not found:
                        continue
                if value in values:
                    hits.append(dict(address=pc, value=value))
            limit = min(q.get('limit', 100), 1000)
            result.update(total=len(hits), truncated=len(hits) > limit,
                          hits=[dict(**h, context=window(s, h['address'], q.get('before', 32),
                                                           q.get('after', 32))) for h in hits[:limit]])
            if kind == 'addresses':
                result['status'] = 'candidate-references-review-register-clobbers'
        elif kind == 'strings':
            hits = []
            for needle in q['needles']:
                require(0 < len(needle) <= 80, 'Needle length')
                for encoding in ('utf-8', 'shift_jis'):
                    try:
                        encoded = needle.encode(encoding)
                    except UnicodeEncodeError:
                        continue
                    start = 0
                    for _ in range(100):
                        at = data.find(encoded, start)
                        if at < 0:
                            break
                        start = at + len(encoded)
                        left = data.rfind(b'\0', max(0, at - 120), at) + 1
                        right = data.find(b'\0', start, min(len(data), start + 120))
                        if not max(0, at - 120) <= left <= at or right < start:
                            left, right = at, start
                        try:
                            value = data[left:right].decode(encoding)
                        except UnicodeDecodeError:
                            left, right, value = at, start, needle
                        hits.append(dict(needle=needle, offset=left, address=base + left,
                                         sha256=sha256(data[left:right]), text=value, encoding=encoding,
                                         status='candidate-unbound'))
            result['hits'] = hits
        elif kind == 'patterns':
            hits = []
            for pattern in q['hex']:
                needle = bytes.fromhex(pattern)
                require(4 <= len(needle) <= 256, 'Binary pattern bound')
                start = 0
                for _ in range(100):
                    at = data.find(needle, start)
                    if at < 0:
                        break
                    start = at + 1
                    hits.append(dict(pattern=pattern, address=base + at,
                                     context=window(s, (base + at) & ~3, 32, 64)))
            result['hits'] = hits
        else:
            raise ValueError('Unsupported inspection kind')
        results.append(result)
    return dict(schema='p2g-static-inspection-v1',
                sources={str(k): {n: v for n, v in s.items() if n != 'data'} for k, s in cache.items()},
                results=results, summary=dict(sources=len(cache), queries=len(results)))
