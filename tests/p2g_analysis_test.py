"""Synthetic fixtures only; no game records or private cipher table."""
import importlib.util
import copy
import hashlib
import struct
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location('p2g_formats', Path(__file__).parents[1] /
    'tools/mhp2g/chinese-patch/analysis/formats.py')
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)
audit_spec = importlib.util.spec_from_file_location('p2g_audit', Path(__file__).parents[1] /
    'tools/mhp2g/chinese-patch/analysis/audit.py')
audit = importlib.util.module_from_spec(audit_spec)
audit_spec.loader.exec_module(audit)


def directory_record(name, lba, size, flags=0):
    result = bytearray(33 + len(name) + (len(name) % 2 == 0))
    result[0] = len(result)
    struct.pack_into('<I', result, 2, lba)
    struct.pack_into('>I', result, 6, lba)
    struct.pack_into('<I', result, 10, size)
    struct.pack_into('>I', result, 14, size)
    result[25], result[32] = flags, len(name)
    result[33:33 + len(name)] = name
    return result


def synthetic_iso():
    data = bytearray(24 * 2048)
    data[16 * 2048:16 * 2048 + 7] = b'\x01CD001\x01'
    root = directory_record(b'\0', 20, 2048, 2)
    data[16 * 2048 + 156:16 * 2048 + 190] = root
    rows = root + directory_record(b'\1', 20, 2048, 2) + directory_record(b'EXAMPLE.TXT;1', 22, 4)
    data[20 * 2048:20 * 2048 + len(rows)] = rows
    data[22 * 2048:22 * 2048 + 4] = b'abc\0'
    return data


class DirectoryTests(unittest.TestCase):
    def test_all_files_keep_verified_extent(self):
        data = synthetic_iso()
        rows = f.iso_catalog(lambda at, size: data[at:at + size], len(data))
        self.assertEqual(rows, [dict(path='EXAMPLE.TXT', offset=22 * 2048, bytes=4, directory=False)])

    def test_rejects_malformed_iso_records(self):
        at = 20 * 2048 + 68
        for offset, value in [(at, 33), (at + 32, 255), (at + 6, 255), (at + 25, 128)]:
            with self.subTest(offset=offset):
                data = synthetic_iso()
                data[offset] = value
                with self.assertRaises(ValueError):
                    f.iso_catalog(lambda start, size: data[start:start + size], len(data))

    def test_rejects_directory_cycle(self):
        data = synthetic_iso()
        row = directory_record(b'CYCLE', 20, 2048, 2)
        data[20 * 2048 + 68:21 * 2048] = row + bytes(2048 - 68 - len(row))
        with self.assertRaisesRegex(ValueError, 'Cyclic'):
            f.iso_catalog(lambda at, size: data[at:at + size], len(data))

    def test_rejects_unsafe_name(self):
        data = synthetic_iso()
        data[20 * 2048 + 68 + 33] = ord('/')
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            f.iso_catalog(lambda at, size: data[at:at + size], len(data))


class TocTests(unittest.TestCase):
    def toc(self, values):
        result = bytearray(2048)
        struct.pack_into('<' + 'I' * len(values), result, 0, *values)
        return result

    def test_empty_members_preserved(self):
        self.assertEqual(f.data_directory(self.toc([1, 2, 2, 5]), 5 * 2048), [1, 2, 2, 5])

    def test_rejects_invalid_toc(self):
        for values in ([1, 3, 2], [1, 6], [1, 2, 3], [0], [2, 3]):
            with self.subTest(values=values), self.assertRaises(ValueError):
                f.data_directory(self.toc(values), 5 * 2048)

    def test_rejects_partial_sector(self):
        with self.assertRaises(ValueError):
            f.data_directory(self.toc([1, 5]), 5 * 2048 - 1)


class TextTests(unittest.TestCase):
    def text(self):
        # Two native indices intentionally share one string.
        return struct.pack('<3I', 12, 12, 0xffffffff) + '例\n%s'.encode() + b'\0'

    def test_shared_pointer_and_encoding_round_trip(self):
        data = self.text()
        rows = f.pointer_strings(data, 0, len(data))
        self.assertEqual([r['index'] for r in rows], [0, 1])
        self.assertEqual(rows[0]['offset'], rows[1]['offset'])
        self.assertEqual(rows[0]['text'], '例\n%s')
        self.assertEqual(rows[0]['sha256'], rows[1]['sha256'])

    def test_missing_terminator(self):
        data = self.text()[:-1]
        with self.assertRaisesRegex(ValueError, 'terminator'):
            f.pointer_strings(data, 0, len(data))

    def test_pointer_must_not_point_inside_index(self):
        data = struct.pack('<2I', 0, 0xffffffff) + b'x\0'
        with self.assertRaisesRegex(ValueError, 'overlaps'):
            f.pointer_strings(data, 0, len(data))

    def test_pointer_must_not_escape_table(self):
        data = struct.pack('<2I', 0x100, 0xffffffff) + b'x\0'
        with self.assertRaisesRegex(ValueError, 'bounds'):
            f.pointer_strings(data, 0, len(data))

    def test_bad_encoding_is_not_silently_replaced(self):
        data = struct.pack('<2I', 8, 0xffffffff) + b'\xff\0'
        with self.assertRaises(UnicodeDecodeError):
            f.pointer_strings(data, 0, len(data))

    def test_truncated_reads(self):
        for size in range(4):
            with self.subTest(size=size), self.assertRaises(ValueError):
                f.u32(bytes(size), 0)

    def test_flagged_pages_preserve_native_flags(self):
        data = struct.pack('<4I', 2, 16, 0, 18) + b'a\0b\0'
        rows = f.flagged_strings(data, 0, len(data))
        self.assertEqual([(r['flag'], r['text']) for r in rows], [(2, 'a'), (0, 'b')])

    def test_flagged_table_rejects_misaligned_or_internal_pointer(self):
        for values in [(1, 15, 0, 18), (1, 16, 0, 4), (1, 100, 0, 18)]:
            data = struct.pack('<4I', *values) + b'a\0b\0'
            with self.subTest(values=values), self.assertRaises(ValueError):
                f.flagged_strings(data, 0, len(data))

    def test_count_directory_keeps_aliases(self):
        data = struct.pack('<4I', 2, 8, 16, 16) + self.text()
        kind, tables = f.text_directory(data)
        self.assertEqual(kind, 'count-offsets-at-8')
        self.assertEqual([t['offset'] for t in tables], [16, 16])

    def test_id_directory_does_not_renumber_native_ids(self):
        data = struct.pack('<6I', 3, 24, 19, 26, 0xffffffff, 0xffffffff) + b'a\0b\0'
        kind, tables = f.text_directory(data)
        self.assertEqual(kind, 'id-offset-pairs')
        self.assertEqual([t['table'] for t in tables], [3, 19])

    def test_id_directory_rejects_duplicate_ids(self):
        data = struct.pack('<6I', 3, 24, 3, 26, 0xffffffff, 0xffffffff) + b'a\0b\0'
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            f.text_directory(data)

    def test_quest_requires_payload_integrity(self):
        with self.assertRaises(ValueError):
            f.quest_payload(bytes(512))


class ResourceTests(unittest.TestCase):
    def test_archive_preserves_empty_slots(self):
        data = struct.pack('<5I', 2, 0, 0, 32, 4) + bytes(12) + b'data'
        self.assertEqual(f.archive_members(data), [dict(index=0, offset=0, bytes=0),
                                                   dict(index=1, offset=32, bytes=4)])

    def test_archive_rejects_overlap_and_outside_member(self):
        for second in (32, 100):
            data = struct.pack('<5I', 2, 32, 4, second, 4) + bytes(16)
            with self.subTest(second=second), self.assertRaises(ValueError):
                f.archive_members(data)

    def texture(self):
        header = b'.TMH0.14' + struct.pack('<2I', 1, 0)
        picture = struct.pack('<8I', 36, 0, 1, 0, 20, 1, 3, (1 << 16) | 1) + bytes(4)
        return header + picture

    def test_texture_metadata_without_exporting_pixels(self):
        result = f.tmh_index(self.texture())
        self.assertEqual(len(result['pictures']), 1)
        self.assertEqual(result['pictures'][0]['width'], 1)
        self.assertEqual(result['pictures'][0]['height'], 1)
        self.assertEqual(result['pictures'][0]['textStatus'], 'unreviewed')
        self.assertFalse(result['trailingNonzero'])

    def test_texture_rejects_truncated_record_or_palette(self):
        for data in (self.texture()[:-1], self.texture()[:28] + struct.pack('<I', 1) + self.texture()[32:]):
            with self.assertRaises(ValueError):
                f.tmh_index(data)


class QuestIntegrityTests(unittest.TestCase):
    def envelope(self):
        payload = b'\x4c\0\0\0' + b'2NDG' + bytes(range(120))
        clear = struct.pack('<I', len(payload)) + hashlib.sha1(payload + b'37wyS2Jfc3x5w9oG').digest() + payload
        # Synthetic encoder provides valid and subsequently corrupted envelopes.
        keys, mods, mul = [1, 2, 3, 4], [0xff9d, 0xffa9, 0xffc7, 0xfff1], [0x1709, 0x3df3, 0x747b, 0xb381]
        encoded = bytearray(struct.pack('<4H', *keys))
        for i, (value,) in enumerate(struct.iter_unpack('<H', clear)):
            lane = i % 4
            keys[lane] = keys[lane] * mul[lane] % mods[lane]
            encoded.extend(struct.pack('<H', value ^ keys[lane]))
        return encoded, payload

    def test_valid_payload_and_digest_failure(self):
        encoded, payload = self.envelope()
        self.assertEqual(f.quest_payload(encoded), payload)
        encoded[-1] ^= 1
        with self.assertRaisesRegex(ValueError, 'digest'):
            f.quest_payload(encoded)

    def records(self):
        def record(namespace, offset):
            units, bindings = {}, []
            for i, field in enumerate(('name', 'goal', 'failure', 'description', 'monsters', 'client')):
                text = '例 ' + field
                key = f'{namespace}:{i}'
                units[key] = dict(text=text, bytes=len(text.encode()), sha256=f.sha256(text.encode()),
                                  encoding='utf-8', offset=offset + i * 32)
                bindings.append(dict(key=f'{namespace}:{field}', unit=key, questId=7, field=field))
            return dict(questId=7, units=units, bindings=bindings)
        return record('mission', 128), record('list', 512)

    def test_shared_quest_retains_physical_source_and_canonical_unit(self):
        mission, listing = self.records()
        pairs = audit.shared_quest_bindings(mission, listing, mission['units'], {'member': 42})
        self.assertEqual(len(pairs), 6)
        self.assertEqual(pairs[0][1], 'mission:0')
        self.assertEqual(pairs[0][0]['unit'], 'list:0')
        self.assertEqual(pairs[0][0]['physicalSource']['offset'], 512)
        self.assertEqual(pairs[0][0]['physicalSource']['member'], 42)

    def test_sharing_rejects_partial_duplicate_mismatched_or_corrupted_fields(self):
        mission, original = self.records()
        for change in ('missing', 'duplicate', 'identity', 'binding-identity', 'text', 'hash', 'bytes'):
            listing = copy.deepcopy(original)
            if change == 'missing':
                listing['bindings'].pop()
            elif change == 'duplicate':
                listing['bindings'][-1] = dict(listing['bindings'][0])
            elif change == 'identity':
                listing['questId'] += 1
            elif change == 'binding-identity':
                listing['bindings'][0]['questId'] += 1
            elif change == 'bytes':
                listing['units']['list:0']['bytes'] += 1
            else:
                unit = listing['units']['list:0']
                unit['text'] += '変更'
                if change == 'text':
                    unit.update(sha256=f.sha256(unit['text'].encode()), bytes=len(unit['text'].encode()))
            with self.subTest(change=change), self.assertRaises(ValueError):
                audit.shared_quest_bindings(mission, listing, mission['units'], {})


if __name__ == '__main__':
    unittest.main()
