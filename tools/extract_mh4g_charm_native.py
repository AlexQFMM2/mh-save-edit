#!/usr/bin/env python3
"""Read-only, memory-only extraction for one explicitly reviewed MH4G snapshot.

Run on the machine holding the ExeFS. Only the small derived JSON is emitted;
never copy code.bin into this repository. Unknown executable hashes fail closed.
The result proves reviewed appraisal constraints, not exhaustive RNG reachability.
"""
import argparse
import hashlib
import json
import pathlib
import struct

RAW_SHA256 = 'd94ec346cc265fa971101a29193ab377103ed0b677b1d309a5f847019d765604'
EXPANDED_SHA256 = 'b3cf0ad1f9abca6cd007f5bb5d560b9302576f457bee9baaf2cdf12c0ce8156a'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def decompress_blz(raw, limit=64 * 1024 * 1024):
    require(len(raw) >= 8, 'BLZ footer missing')
    footer, extra = struct.unpack_from('<II', raw, len(raw) - 8)
    span, header = footer & 0xffffff, footer >> 24
    require(8 <= header <= span <= len(raw), 'Invalid BLZ footer span')
    size = len(raw) + extra
    require(len(raw) < size <= limit, 'Invalid BLZ expanded length')
    end, src, dst = len(raw) - span, len(raw) - header, size
    output = bytearray(raw) + bytearray(extra)
    while src > end:
        src -= 1
        flags = output[src]
        for bit in range(7, -1, -1):
            if src <= end:
                break
            if flags & (1 << bit):
                require(src - 2 >= end, 'Truncated BLZ back-reference')
                src -= 2
                pair = output[src] | output[src + 1] << 8
                length, distance = (pair >> 12) + 3, (pair & 4095) + 3
                require(dst - length >= end, 'BLZ output underrun')
                for _ in range(length):
                    dst -= 1
                    require(dst + distance < size, 'BLZ back-reference out of bounds')
                    output[dst] = output[dst + distance]
            else:
                src -= 1
                dst -= 1
                require(dst >= end, 'BLZ literal underrun')
                output[dst] = output[src]
            require(dst >= src, 'BLZ overwrote unread input')
    require(src == dst == end, 'BLZ input/output endpoints differ')
    return output


def reviewed_code(raw):
    require(hashlib.sha256(raw).hexdigest() == RAW_SHA256, 'Unsupported MH4G code.bin hash; review this version first')
    code = decompress_blz(raw)
    require(len(code) == 16072704, 'Unexpected expanded code length')
    require(hashlib.sha256(code).hexdigest() == EXPANDED_SHA256, 'Expanded hash mismatch')
    return code


def extract_instruction_windows(raw, source_path):
    code = reviewed_code(raw)
    # Fixed, reviewed functions only. This is not a general binary export option.
    ranges = [(0x2e6440, 0x2e6a48), (0x2a5b40, 0x2a5b88), (0x2ffdc8, 0x2fff08)]
    windows = []
    for start, end in ranges:
        data = code[start - 0x100000:end - 0x100000]
        windows.append({'address': start, 'end': end, 'words': list(struct.unpack('<' + 'I' * (len(data) // 4), data)), 'sha256': hashlib.sha256(data).hexdigest()})
    return {'format': 'mh4g-charm-instruction-windows-v1', 'source': {'path': source_path, 'codeSha256': RAW_SHA256, 'expandedSha256': EXPANDED_SHA256}, 'windows': windows}


def extract(raw, source_path):
    raw_hash = hashlib.sha256(raw).hexdigest()
    code = reviewed_code(raw)
    base = 0x100000
    counts = [(57, 0), (59, 60), (38, 56), (55, 76), (58, 75), (41, 58)]
    source_ids = [36, 37, 38, 39, 1648, 1649]
    class_bands = [
        [(1, 0, 8), (2, 8, None)], [(3, 0, 8), (4, 8, None)],
        [(5, 0, 8), (6, 8, 13), (7, 13, None)], [(8, 0, 16), (9, 16, None)],
        [(10, 0, 8), (11, 8, 13), (12, 13, None)], [(13, 0, 16), (14, 16, None)],
    ]
    groups = []
    for group, sizes in enumerate(counts):
        pools = {}
        for index, position in enumerate(['A', 'B']):
            address = struct.unpack_from('<I', code, 0xf11058 - base + group * 8 + index * 4)[0]
            offset, count = address - base, sizes[index]
            require(0 <= offset <= offset + count * 4 <= len(code), 'Skill pool out of bounds')
            data = code[offset:offset + count * 4]
            rows = []
            for record in range(count):
                skill, auxiliary, low, high = struct.unpack_from('<BBbb', data, record * 4)
                require(skill > 0 and auxiliary == 1 and low <= high and high > 0, 'Unexpected skill record')
                if position == 'A':
                    require(low > 0, 'Reviewed A pool must have strictly positive points')
                rows.append([skill, low, high])
            require(len({row[0] for row in rows}) == count, 'Duplicate native pool skill')
            pools[position] = {'address': address, 'sha256': hashlib.sha256(data).hexdigest(), 'rows': rows}
        offset = 0xf11088 - base + group * 84
        data = code[offset:offset + 84]
        weights = [list(data[row * 4:row * 4 + 4]) for row in range(21)]
        require(all(sum(row) == 100 for row in weights), 'Invalid slot weight row')
        groups.append({
            'groupIndex': group, 'sourceItemId': source_ids[group],
            'classes': [{'classId': c, 'minScore': low, 'maxScore': high} for c, low, high in class_bands[group]],
            'secondSkillAttemptPercent': [0, 65, 75, 80, 85, 75][group],
            'pools': pools, 'slotWeights': weights,
            'slotAddress': offset + base, 'slotSha256': hashlib.sha256(data).hexdigest(),
        })
    return {
        'format': 'mh4g-charm-native-v1', 'gameId': 'mh4g', 'algorithm': 'appraisal-f32-v1',
        'source': {'path': source_path, 'codeSha256': raw_hash, 'expandedSha256': EXPANDED_SHA256},
        'evidence': {'kind': 'native-static', 'scope': 'reviewed-appraisal-path',
                     'limitations': ['other-acquisition-paths', 'rng-reachability', 'fpscr-runtime-state']},
        'groups': groups,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--code', required=True, help='Existing code.bin on its source host (read-only)')
    parser.add_argument('--instruction-windows', action='store_true', help='Emit only the three fixed private instruction windows for isolated replay')
    args = parser.parse_args()
    path = pathlib.Path(args.code)
    raw = path.read_bytes()
    result = extract_instruction_windows(raw, str(path)) if args.instruction_windows else extract(raw, str(path))
    require(hashlib.sha256(path.read_bytes()).hexdigest() == RAW_SHA256, 'Input changed during extraction')
    marker = 'MH4G_WINDOWS_JSON:' if args.instruction_windows else 'MH4G_NATIVE_JSON:'
    print(marker + json.dumps(result, ensure_ascii=True, separators=(',', ':')))


if __name__ == '__main__':
    main()
