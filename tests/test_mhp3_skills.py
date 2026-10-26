"""Synthetic integrity and failure-recovery checks; no extracted game data."""
import base64
import copy
import json
import sqlite3
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from tools.mhp3.build_skills import build, table_fingerprints
from tools.mhp3.skill_sources import digest, display_text, reviewed_rows
from tools.mhp3.skill_names import armor_names


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False))


def synthetic_png():
    def chunk(kind, data):
        return struct.pack('>I', len(data))+kind+data+struct.pack('>I', zlib.crc32(kind+data))
    rgba = bytes([1, 2, 3, 255])*24*24
    pixels = b''.join(b'\0'+rgba[i*96:(i+1)*96] for i in range(24))
    png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', 24, 24, 8, 6, 0, 0, 0))+chunk(b'IDAT', zlib.compress(pixels))+chunk(b'IEND', b'')
    return png, rgba


class SkillBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.native = self.root/'native'
        self.probe = self.root/'probe'
        self.review_path = self.root/'review.json'
        self.base = self.root/'base.sqlite'
        with sqlite3.connect(self.base) as db:
            db.executescript("CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT); INSERT INTO meta VALUES('catalog_schema','mhp3-items-v1'); CREATE TABLE catalog_items(item_id INTEGER,decoration_json TEXT); INSERT INTO catalog_items VALUES(7,NULL);")
        self.systems = [dict(id=i, nameRawJp=f'テスト{i}', descriptionRawJp='テスト説明', special=i==1) for i in range(1,101)]
        self.effects = [dict(activationId=i, skillId=2+(i%99), threshold=-10 if i%3==0 else 10, nameRawJp='テスト%%', nameEn='Synthetic', descriptionRawJp='テスト10%%') for i in range(1,210)]
        self.armor = [dict(armorKey=f'mhp3:armor:4:{i}', nativeType=4, nativeId=i, part='head', nameRawJp='テスト同名', rarity=1, slots=0, acquisitionStatus='not-audited', referenceCoverage='native-only-acquisition-unverified', skills=[dict(skillId=1, points=1, kind='torso-copy-marker'),dict(skillId=2, points=-2, kind='signed-points')]) for i in [1,2]]
        self.contracts = {'native-skill-contract.json':dict(systems=self.systems, activations=self.effects),
            'native-armor-contract.json':dict(armors=self.armor),
            'native-charm-contract.json':dict(randomCandidatePools=[dict(name='mystery1',rows=[dict(skill=2,minimum=-2,maximum=4)])],specialSources=[dict(skillId=17,points=10,slots=0,secondSkillId=None,nameRawJp='テスト贈品')])}
        self.review = dict(inputs={}, specialRuleCn='测试复制含装饰品', specialRuleEvidence='synthetic',
            systems=[dict(s,nameCn=f'合成系{s["id"]}', nameEn='Synthetic', descriptionCn='合成说明', reviewStatus='reviewed') for s in self.systems],
            activations=[dict(a,nameCn='合成发动',descriptionCn='合成10%',reviewStatus='reviewed') for a in self.effects])
        png, rgba = synthetic_png()
        self.icon = dict(source='synthetic-source',icons=[dict(type=4,rarity=1,rgbaSha256=digest(rgba))])
        write_json(self.native/'armor-pixels-v1/result.json',self.icon)
        write_json(self.probe/'result.json',dict(self.icon,icons=[dict(self.icon['icons'][0],pngBase64=base64.b64encode(png).decode())]))
        write_json(self.probe/'run.json',dict(returnCode=0,resultSha256=digest((self.probe/'result.json').read_bytes())))
        (self.probe/'stderr.txt').write_text('')
        self.freeze()

    def freeze(self):
        for name,data in self.contracts.items():
            write_json(self.native/name,data)
            self.review['inputs'][name]=digest((self.native/name).read_bytes())
        files=[dict(path=name,sha256=digest((self.native/name).read_bytes())) for name in [*self.contracts,'armor-pixels-v1/result.json']]
        write_json(self.native/'archive-manifest.json',dict(files=files))
        write_json(self.review_path,self.review)

    def run_build(self, name='output'):
        return build(self.base,self.native,self.review_path,self.probe,self.root/name)

    def test_copy_build_keeps_items_native_identities_and_distinct_charm_semantics(self):
        before=digest(self.base.read_bytes())
        report=self.run_build()
        self.assertEqual(before,digest(self.base.read_bytes()))
        self.assertEqual(report['counts']['p3_skills'],100)
        self.assertEqual(report['activations'],209)
        with sqlite3.connect(self.root/'output/mhp3.sqlite') as db:
            armor=[json.loads(r[0]) for r in db.execute('SELECT detail_json FROM p3_skill_armors')]
            self.assertEqual(len({a['armorKey'] for a in armor}),2)
            self.assertTrue(all('dexId' not in a and 'saveId' not in a for a in armor))
            self.assertEqual(db.execute('SELECT count(*) FROM p3_armor_skill_points WHERE points=0').fetchone()[0],0)
            skill=json.loads(db.execute('SELECT detail_json FROM p3_skills WHERE skill_id=1').fetchone()[0])
            self.assertEqual(skill['activations'],[])
            self.assertEqual(skill['specialRule']['descriptionCn'],'测试复制含装饰品')
            charms=[json.loads(r[0]) for r in db.execute('SELECT detail_json FROM p3_skill_charm_sources')]
            self.assertEqual({c['sourceKind'] for c in charms},{'random-pool','special-gift'})
            self.assertEqual(next(c for c in charms if c['sourceKind']=='random-pool')['slots'],None)
            self.assertEqual(next(c for c in charms if c['sourceKind']=='special-gift')['slots'],0)
            self.assertEqual(table_fingerprints(db),report['unchangedItemTables'])
        with self.assertRaisesRegex(ValueError,'new directory'):self.run_build()

    def test_effective_zero_points_and_unknown_endpoints_fail_without_modifying_base(self):
        before=digest(self.base.read_bytes())
        for name,points,skill in [('zero',0,2),('orphan',4,999)]:
            self.armor[0]['skills'][1].update(points=points,skillId=skill)
            self.freeze()
            with self.assertRaisesRegex(ValueError,'effective armor'):self.run_build(name)
            self.assertTrue((self.root/name/'FAILED.txt').exists())
            self.assertFalse((self.root/name/'manifest.json').exists())
            self.assertEqual(before,digest(self.base.read_bytes()))

    def test_stale_native_and_icon_references_fail_before_output_creation(self):
        (self.native/'native-armor-contract.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'fingerprint'):self.run_build()
        self.assertFalse((self.root/'output').exists())
        self.freeze()
        (self.native/'armor-pixels-v1/result.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'icon reference'):self.run_build()

    def test_translation_rejects_stale_numbers_thresholds_ids_and_missing_review(self):
        for field,value in [('descriptionRawJp','changed'),('descriptionCn','合成20%'),('threshold',15),('reviewStatus','draft')]:
            row=copy.deepcopy(self.review['activations'][0]);row[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):reviewed_rows([self.effects[0]],[row],'activationId')
        with self.assertRaisesRegex(ValueError,'duplicate'):reviewed_rows(self.effects,self.review['activations']+[self.review['activations'][0]],'activationId')
        self.assertEqual(display_text('~C05テスト%%'),'テスト%')
        self.assertEqual(self.effects[0]['nameRawJp'],'テスト%%')

    def test_unverified_or_unbound_common_names_are_rejected(self):
        term=self.root/'terms';term.mkdir()
        with sqlite3.connect(term/'terminology.sqlite') as db:
            db.executescript("CREATE TABLE terms(id TEXT,kind TEXT,ja TEXT,zhHans TEXT); INSERT INTO terms VALUES('term','armor','テスト同名','合成防具')")
        write_json(term/'audit.json',dict(state=dict(chosen={'term':{'zhHans':dict(sourceClass='gu_official',evidenceKey='e')}},evidence={'e':dict(termId='term',value='合成防具')})))
        hashes={name:digest((term/name).read_bytes()) for name in ('terminology.sqlite','audit.json')}
        write_json(term/'manifest.json',dict(outputs=hashes))
        review=dict(inputs=dict(armorTerminology=hashes),armorNames=[dict(armorKey=self.armor[0]['armorKey'],nameRawJp='テスト同名',nameCn='合成防具',termId='term',evidenceKey='e',reviewStatus='reviewed')])
        self.assertEqual(armor_names(self.armor,review,term),{'mhp3:armor:4:1':'合成防具'})
        review['armorNames'][0]['nameCn']='猜测译名'
        with self.assertRaisesRegex(ValueError,'name evidence'):armor_names(self.armor,review,term)


if __name__ == '__main__':unittest.main()
