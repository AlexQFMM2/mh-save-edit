"""Synthetic evidence exercises the offline P3 build's integrity boundaries."""
import copy
import json
import sqlite3
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from tools.mhp3.icons import verify_png
from tools.mhp3.localization import validate_localization
from tools.mhp3.sources import digest


class LocalizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        snapshot = self.root / 'generated/mh-save-edit/terminology/versions/gu-pass-02'
        snapshot.mkdir(parents=True)
        with sqlite3.connect(snapshot / 'terminology.sqlite') as db:
            db.execute('CREATE TABLE terms(id TEXT, kind TEXT, ja TEXT, zhHans TEXT)')
            db.execute("INSERT INTO terms VALUES('test','item','テスト珠【1】','测试珠【1】')")
        state = {'chosen': {'test': {'zhHans': {'sourceClass': 'gu_official', 'evidenceKey': 'test'}}},
                 'evidence': {'test': {'termId': 'test', 'value': '测试珠【1】'}}}
        (snapshot / 'audit.json').write_text(json.dumps({'state': state}))
        outputs = {f: digest((snapshot / f).read_bytes()) for f in ['terminology.sqlite', 'audit.json']}
        (snapshot / 'manifest.json').write_text(json.dumps({'outputs': outputs}))
        skill = {'id': 1, 'nameJp': 'テスト技能', 'nameCn': '测试技能', 'nameEn': 'Test'}
        self.review = {'inputs': {'gu': outputs['terminology.sqlite']}, 'skills': [skill], 'items': [{
            'id': 7, 'ja': 'テスト珠【1】', 'name': '测试珠【1】', 'descriptionJp': 'テスト~C00',
            'description': '测试说明~C00', 'reviewStatus': 'reviewed', 'descriptionEvidence': {'kind': 'project'},
            'nameEvidence': {'kind': 'gu', 'termId': 'test', 'evidenceKey': 'test'},
            'decorationReview': {'slots': 1, 'skills': [{**skill, 'points': -1}]}}]}
        self.native = {'items': {'items': [{'id': 7, 'name': 'テスト珠【1】', 'description': 'テスト~C00'}]},
                       'decorations': {'decorationCandidates': [{'id': 7, 'raw': [1, 1, 255, 0, 0],
                        'skillCandidates': [{'id': 1, 'name': 'テスト技能'}, {'id': 0, 'name': ''}]}]}}

    def test_valid_binding_and_signed_native_points(self):
        self.assertEqual(validate_localization(self.root, self.review, self.native)[7]['name'], '测试珠【1】')

    def test_stale_original_control_codes_and_gu_evidence_rejected(self):
        for field, value, message in [('descriptionJp', '別原文', 'Stale'),
                                      ('description', '测试说明', 'control codes'),
                                      ('name', '错误珠【1】', 'GU name evidence')]:
            with self.subTest(field=field):
                review = copy.deepcopy(self.review)
                review['items'][0][field] = value
                with self.assertRaisesRegex(ValueError, message):
                    validate_localization(self.root, review, self.native)

    def test_slot_and_negative_skill_changes_rejected(self):
        for field in ['slots', 'points']:
            with self.subTest(field=field):
                review = copy.deepcopy(self.review)
                decoration = review['items'][0]['decorationReview']
                if field == 'slots':
                    decoration['slots'] = 2
                else:
                    decoration['skills'][0]['points'] = 1
                with self.assertRaisesRegex(ValueError, 'decoration numbers'):
                    validate_localization(self.root, review, self.native)


class IconTests(unittest.TestCase):
    def png(self):
        def chunk(kind, data):
            return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
        pixels = bytes([1, 2, 3, 0, 4, 5, 6, 254, 7, 8, 9, 255]) * 192
        scanlines = b''.join(b'\0' + pixels[y*96:(y+1)*96] for y in range(24))
        png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 24, 24, 8, 6, 0, 0, 0))
               + chunk(b'IDAT', zlib.compress(scanlines)) + chunk(b'IEND', b''))
        return png, pixels

    def test_alpha_and_rgb_are_preserved_exactly(self):
        png, pixels = self.png()
        self.assertEqual(verify_png(png), pixels)
        self.assertEqual(set(verify_png(png)[3::4]), {0, 254, 255})

    def test_corrupt_chunk_rejected(self):
        png, _ = self.png()
        damaged = bytearray(png)
        damaged[20] ^= 1
        with self.assertRaisesRegex(ValueError, 'checksum'):
            verify_png(damaged)


if __name__ == '__main__':
    unittest.main()
