"""Synthetic P3 armor evidence; contains no game records or translation collection."""
import copy
import json
import sqlite3
import struct
import tempfile
import unittest
from pathlib import Path
from tools.mhp3.build_armors import build, decode_stats, digest, fingerprint


class ArmorBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = self.root/'base.sqlite'
        self.sources = self.root/'sources'
        (self.sources/'recipes-v1').mkdir(parents=True)
        self.review_file = self.root/'review.json'
        raw = bytearray(40)
        raw[4] = 15
        raw[5] = 1
        struct.pack_into('<I', raw, 8, 321)
        raw[12:19] = bytes([10, 255, 2, 253, 4, 251, 1])
        raw[21:25] = bytes([3, 5, 6, 7])
        raw[28:32] = bytes([1, 1, 2, 254])
        self.raw = raw
        self.key = 'mhp3:armor:4:1'
        armor = dict(gameId='mhp3', armorKey=self.key, nativeType=4, nativeId=1, nameJp='合成原名', nameCn='已审定名', nameEn='', part='head', rarity=2, slots=1, iconPath='/synthetic.png', skills=[dict(skillId=1, points=1, kind='torso-copy-marker'), dict(skillId=2, points=-2, kind='signed-points')])
        with sqlite3.connect(self.base) as db:
            db.executescript("CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT); INSERT INTO meta VALUES('skill_schema','mhp3-skills-v1'); INSERT INTO meta VALUES('catalog_schema','mhp3-items-v1'); CREATE TABLE catalog_items(item_id INTEGER PRIMARY KEY); INSERT INTO catalog_items VALUES(7); INSERT INTO catalog_items VALUES(8); CREATE TABLE p3_skill_armors(armor_key TEXT PRIMARY KEY,detail_json TEXT); CREATE TABLE preserved(v TEXT); INSERT INTO preserved VALUES('unchanged');")
            db.execute('INSERT INTO p3_skill_armors VALUES(?,?)', (self.key, json.dumps(armor)))
        self.native = dict(programSha256='synthetic', armors=[dict(type=4, part='head', stride=40, records=[dict(nativeId=1, name='合成原名', rawHex=raw.hex())])])
        self.recipes = dict(programSha256='synthetic', rows=[])
        for i, item in enumerate([7, 8]):
            r = bytearray(36); r[0] = 4
            struct.pack_into('<H', r, 2, 1); struct.pack_into('<Hh', r, 4, item, 2+i)
            self.recipes['rows'].append(dict(index=i, nativeType=4, nativeId=1, rawHex=r.hex(), materials=[dict(itemId=item, quantity=2+i)]))
        self.review = dict(schema='mhp3-armor-review-v1', baseSha256=digest(self.base.read_bytes()), names=[dict(armorKey=self.key, nameJp='合成原名', nameCn='已审定名', nameSource='gu-pass-02', reviewStatus='reviewed', aliases=['合成别名'])], acquisition=[dict(armorKey=self.key, status='obtainable', text='合成证据', source='synthetic')], sets=[dict(setKey='synthetic', sortOrder=1, nameCn='合成套装', gender='both', sources=['synthetic'], rows=[dict(combat='both', members=[self.key])])])

    def freeze(self):
        for name, data in [('native-armors.json', self.native), ('recipes-v1/result.json', self.recipes)]:
            (self.sources/name).write_text(json.dumps(data))
        self.review['inputs'] = {str(p.relative_to(self.sources)): digest(p.read_bytes()) for p in self.sources.rglob('*.json')}
        self.review_file.write_text(json.dumps(self.review))

    def run_build(self):
        return build(self.base, self.sources, self.review_file, self.root/'output')

    def test_native_defense_schedules_signed_order_and_zero_cap(self):
        self.assertEqual(decode_stats(self.raw), dict(gender='both', combat='both', rarity=2, slots=1, baseDefense=10, maxDefense=29, fireRes=-1, waterRes=2, thunderRes=-3, iceRes=-5, dragonRes=4))
        raw = self.raw.copy(); raw[4] |= 16
        self.assertEqual(decode_stats(raw)['maxDefense'], 25)
        raw[21:25] = b'\0'*4
        self.assertEqual(decode_stats(raw)['maxDefense'], 10)

    def test_preserves_signed_skills_icons_names_and_separate_routes(self):
        self.freeze(); before = self.base.read_bytes(); report = self.run_build()
        self.assertEqual(report['counts']['recipes'], 2)
        self.assertEqual(self.base.read_bytes(), before)
        with sqlite3.connect(self.root/'output/mhp3.sqlite') as db:
            armor = json.loads(db.execute('SELECT detail_json FROM p3_skill_armors').fetchone()[0])
            self.assertEqual([s['points'] for s in armor['skills']], [1, -2])
            self.assertEqual(armor['skills'][0]['kind'], 'torso-copy-marker')
            self.assertEqual(armor['price'], 321)
            self.assertEqual(db.execute('SELECT item_id FROM p3_armor_materials ORDER BY recipe_key').fetchall(), [(7,), (8,)])
            self.assertFalse(db.execute('PRAGMA foreign_key_check').fetchall())
        self.assertTrue((self.root/'output/manifest.json').exists())

    def assert_failed_without_mutation(self):
        before = self.base.read_bytes()
        with self.assertRaises((ValueError, sqlite3.IntegrityError, KeyError)):
            self.run_build()
        self.assertEqual(self.base.read_bytes(), before)
        self.assertTrue((self.root/'output/FAILED.txt').exists())
        self.assertFalse((self.root/'output/manifest.json').exists())

    def test_changed_frozen_input(self):
        self.freeze(); p = self.sources/'native-armors.json'; p.write_text(p.read_text()+' ')
        self.assert_failed_without_mutation()

    def test_duplicate_native_identity(self):
        self.native['armors'][0]['records'] *= 2; self.freeze(); self.assert_failed_without_mutation()

    def test_wrong_material_endpoint(self):
        r = self.recipes['rows'][0]; raw = bytearray.fromhex(r['rawHex']); struct.pack_into('<H', raw, 4, 999)
        r['rawHex'] = raw.hex(); r['materials'][0]['itemId'] = 999
        self.freeze(); self.assert_failed_without_mutation()

    def test_duplicate_set_part(self):
        self.review['sets'][0]['rows'][0]['members'] *= 2
        self.freeze(); self.assert_failed_without_mutation()

    def test_unchanged_existing_name(self):
        self.review['names'][0]['nameCn'] = '不允许覆盖'
        self.freeze(); self.assert_failed_without_mutation()

    def test_mutually_exclusive_gender_members_are_rejected(self):
        raw = self.raw.copy(); raw[4] = 14
        self.native['armors'][0]['records'][0]['rawHex'] = raw.hex()
        self.review['sets'][0]['gender'] = 'male'
        self.freeze(); self.assert_failed_without_mutation()

    def test_negative_points_cannot_be_discarded(self):
        raw = self.raw.copy(); raw[31] = 0
        self.native['armors'][0]['records'][0]['rawHex'] = raw.hex()
        self.freeze(); self.assert_failed_without_mutation()

    def test_torso_copy_cannot_be_treated_as_signed_point(self):
        with sqlite3.connect(self.base) as db:
            a = json.loads(db.execute('SELECT detail_json FROM p3_skill_armors').fetchone()[0]); a['skills'][0]['kind'] = 'signed-points'
            db.execute('UPDATE p3_skill_armors SET detail_json=?', (json.dumps(a),))
        self.review['baseSha256'] = digest(self.base.read_bytes())
        self.freeze(); self.assert_failed_without_mutation()

    def test_unknown_acquisition_does_not_invent_recipe_or_zero_price(self):
        self.recipes['rows'] = []; self.review['acquisition'][0]['status'] = 'unknown'
        self.freeze(); self.run_build()
        with sqlite3.connect(self.root/'output/mhp3.sqlite') as db:
            a = json.loads(db.execute('SELECT detail_json FROM p3_skill_armors').fetchone()[0])
            self.assertIsNone(a['price']); self.assertEqual(a['acquisitionStatus'], 'unknown')


if __name__ == '__main__':
    unittest.main()
