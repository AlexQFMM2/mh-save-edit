"""Synthetic native rows and images only; no research values or game assets."""
import copy
import json
import sqlite3
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from tools.mhp3.build_weapons import build, digest, fingerprint, LIMITS, TYPE_IDS, KINDS


def png():
    def chunk(kind, data):
        return struct.pack('>I', len(data))+kind+data+struct.pack('>I', zlib.crc32(kind+data))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', 24, 24, 8, 6, 0, 0, 0))+chunk(b'IDAT', zlib.compress((b'\0'+b'\0\0\0\0'*24)*24))+chunk(b'IEND', b'')


class WeaponBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.base = self.root/'base.sqlite'
        with sqlite3.connect(self.base) as db:
            db.executescript("CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT); INSERT INTO meta VALUES('armor_schema','mhp3-armors-v1'); CREATE TABLE catalog_items(item_id INTEGER PRIMARY KEY); INSERT INTO catalog_items VALUES(7),(8); CREATE TABLE preserved(v TEXT); INSERT INTO preserved VALUES('old armor');")
        image = png(); h = digest(image); (self.root/'icons').mkdir(); (self.root/'icons'/(h+'.png')).write_bytes(image)
        types = [dict(nativeType=t, typeId=TYPE_IDS[t], nameCn='合成类型', nameEn='Synthetic', kind=KINDS[t], sortOrder=t) for t in LIMITS]
        icons = [dict(type=t, rarity=r, pngSha256=h, independentDecoderEqual=True) for t in LIMITS for r in range(1, 8)]
        raw = bytearray(28); struct.pack_into('<I', raw, 4, 100); struct.pack_into('<h', raw, 10, 80); raw[13] = 246; raw[20] = 7; raw[22] = 2
        w = dict(gameId='mhp3', weaponKey='mhp3:weapon:5:1', nativeType=5, nativeId=1, typeId=1, kind='standardMelee', nameCn='合成武器', nameJp='テスト', nameSource='synthetic', acquisitionSource='synthetic', acquisitionStatus='obtainable', acquisition='合成证据', fieldSources={'core':'synthetic'}, special={'kind':'standardMelee','source':'synthetic'}, iconPath='/assets/catalog/icons/'+h+'.png', rarity=1, displayAttack=80, trueRawAttack=80, affinity=-10, defense=0, slots=0, sharpness={'base':[50,50,50,0,0,0,0],'handicraft':[50,50,50,50,0,0,0]}, attributes=[], boost=dict(attack=95,cost=1000,material=dict(itemId=7,quantity=2)), nativeRowSha256=digest(raw), raw=dict(recordHex=raw.hex()), isFinalForm=False, isDirectlyProducible=True)
        second = copy.deepcopy(w); second.update(weaponKey='mhp3:weapon:5:2',nativeId=2,isDirectlyProducible=False,isFinalForm=True)
        recipes = [dict(recipeKey=f'synthetic:{i}',weaponKey=w['weaponKey'] if i<3 else second['weaponKey'],kind=k,cost=c,materials=[dict(itemId=m,quantity=None if k=='appraisal' else 2,position=0)],byproducts=[],source='synthetic') for i,(k,c,m) in enumerate([('production',150,7),('production',150,8),('appraisal',None,8),('upgrade',100,7)])]
        self.source = dict(nativeProgramSha256='a'*64, schema='mhp3-weapons-input-v1',reviewed=True,baseSha256=digest(self.base.read_bytes()),sourceVersions={'native':'synthetic'},weaponTypes=types,icons=icons,weapons=[w,second],recipes=recipes,edges=[dict(parentWeaponKey=w['weaponKey'],childWeaponKey=second['weaponKey'],branchOrder=0)])

    def run_build(self):
        f = self.root/'input.json'; f.write_text(json.dumps(self.source))
        return build(self.base, f, self.root/'icons', self.root/'output')

    def test_copy_preserves_old_tables_negative_affinity_and_separate_recipes(self):
        before = self.base.read_bytes(); report = self.run_build()
        self.assertEqual(before, self.base.read_bytes()); self.assertEqual(report['counts']['recipes'], 4)
        with sqlite3.connect(self.root/'output/mhp3.sqlite') as db:
            self.assertEqual(db.execute('SELECT * FROM preserved').fetchall(), [('old armor',)])
            w = json.loads(db.execute('SELECT detail_json FROM p3_weapons LIMIT 1').fetchone()[0]); self.assertEqual(w['affinity'], -10)
            self.assertEqual(w['displayAttack'], 80); self.assertEqual(w['boost']['attack'], 95)
            self.assertEqual(db.execute("SELECT cost FROM p3_weapon_recipes WHERE kind='appraisal'").fetchone()[0], None)
            self.assertFalse(db.execute('PRAGMA foreign_key_check').fetchall())
        self.assertTrue((self.root/'output/manifest.json').exists()); self.assertFalse((self.root/'output/FAILED.txt').exists())

    def test_bad_identity_endpoint_flags_and_unreviewed_input_never_get_success_manifest(self):
        mutations = [lambda s:s['weapons'][0].update(nativeType=10), lambda s:s['recipes'][0]['materials'][0].update(itemId=999), lambda s:s['edges'][0].update(childWeaponKey='mhp3:weapon:5:91'), lambda s:s['weapons'][0].update(isFinalForm=True), lambda s:s.update(reviewed=False), lambda s:s['weapons'][0].update(displayAttack=95)]
        original = copy.deepcopy(self.source)
        for index, mutate in enumerate(mutations):
            with self.subTest(index=index):
                self.source = copy.deepcopy(original); mutate(self.source)
                with self.assertRaises((ValueError, sqlite3.IntegrityError)): self.run_build()
                self.assertTrue((self.root/'output/FAILED.txt').exists()); self.assertFalse((self.root/'output/manifest.json').exists())
                (self.root/'output').rename(self.root/f'failed-{index}')

    def test_corrupt_icon_fails_before_candidate_publication(self):
        next((self.root/'icons').iterdir()).write_bytes(b'broken')
        with self.assertRaisesRegex(ValueError,'Icon hash'):self.run_build()
        self.assertFalse((self.root/'output/manifest.json').exists())


if __name__ == '__main__':unittest.main()
