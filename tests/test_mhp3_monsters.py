"""Synthetic monster inputs/images; no private catalog or extracted game values."""
import copy
import json
import sqlite3
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from bs4 import BeautifulSoup
from tools.mhp3.build_monsters import build, digest
from tools.mhp3.audit_monsters import audit
from tools.mhp3.monster_reference import matrix, status_cell


class MonsterBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.base = self.root/'base.sqlite'
        with sqlite3.connect(self.base) as db:
            db.executescript("CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT); INSERT INTO meta VALUES('armor_schema','mhp3-armors-v1'),('weapon_schema','mhp3-weapons-v1'); CREATE TABLE catalog_items(item_id INTEGER PRIMARY KEY,is_placeholder INTEGER); INSERT INTO catalog_items VALUES(7,0); CREATE TABLE preserved(v TEXT); INSERT INTO preserved VALUES('unchanged');")
        def chunk(k, d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d))
        rgba=b'\x00\x00\x00\xff'*42*42
        image=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',42,42,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+rgba[:42*4])*42))+chunk(b'IEND',b'')
        h=digest(image);(self.root/'icons').mkdir();(self.root/'icons'/(h+'.png')).write_bytes(image)
        normal=[i for i in range(1,65) if i not in (35,37,38,39)];rows=[];icons=[]
        src=dict(kind='reference',label='synthetic',key='synthetic:part',sha256='a'*64)
        for i in normal+[35,37,38,39,68]:
            index=normal.index(i) if i in normal else None
            detail=dict(nameSource='synthetic',descriptionCn='合成说明' if index is not None else None,descriptionJp='テスト' if index is not None else None,descriptionTextIndex=247+index if index is not None else None,coverage={k:dict(status='not-collected',note='synthetic') for k in ('weakness','ailments','traps','drops','appearances')},appearances=[])
            weakness=[dict(id=1,partNameCn='测试部位',conditionCn='状态未知',cut=17,impact=21,shot=None,fire=0,water=3,thunder=7,ice=5,dragon=2,stun=0,p3=dict(source=src))]
            rows.append(dict(gameId='mhp3',monsterId=i,recordScope='normal' if index is not None else 'extended',bookIndex=index,isPlaceholder=False,sizeClass='large' if index is not None and index<40 else 'small',nameCn='同名合成',nameJp='テスト',p3=detail,weakness=weakness,ailments=[],traps=[],iconSmallPath='/assets/catalog/icons/'+h+'.png' if index is not None else None,iconLargePath='/assets/catalog/icons/'+h+'.png' if index is not None else None))
            if index is not None:icons.append(dict(nativeId=i,pngSha256=h,rgbaSha256=digest(rgba),independentDecodeEqual=True))
        drop=dict(id=1,monsterId=40,itemId=7,sourceKey='test:drop',rankId=3,methodId=5,quantity=None,probability=None,p3=dict(source=src,attemptCount=2,rawWeight=23,rawWeightSource='synthetic'))
        self.source=dict(schema='mhp3-monsters-input-v1',reviewed=True,baseSha256=digest(self.base.read_bytes()),nativeProgramSha256='a'*64,sourceVersions=['synthetic'],monsters=rows,icons=icons,drops=[drop])

    def run_build(self):
        f=self.root/'input.json';f.write_text(json.dumps(self.source))
        return build(self.base,f,self.root/'icons',self.root/'output')

    def test_full_copy_preserves_original_tables_nulls_and_relation_endpoints(self):
        before=self.base.read_bytes();report=self.run_build()
        self.assertEqual(before,self.base.read_bytes());self.assertEqual(report['counts']['normal'],60)
        with sqlite3.connect(self.root/'output/mhp3.sqlite') as db:
            self.assertEqual(db.execute('SELECT quantity,probability FROM p3_monster_drops').fetchone(),(None,None))
            self.assertEqual(db.execute('SELECT v FROM preserved').fetchone(),('unchanged',))
            self.assertEqual(db.execute('SELECT count(*) FROM p3_monsters WHERE monster_id IN (36,37,38,39)').fetchone(),(4,))
        self.assertEqual(audit(self.base,self.root/'input.json',self.root/'output')['status'],'success')

    def test_invalid_endpoint_duplicate_identity_or_unreviewed_input_never_installs(self):
        original=copy.deepcopy(self.source)
        changes=[lambda s:s['drops'][0].update(itemId=999),lambda s:s['monsters'][0].update(monsterId=2),lambda s:s.update(reviewed=False),lambda s:s['drops'][0].update(probability=101),lambda s:s['monsters'][-1].update(iconSmallPath='/borrowed.png')]
        for i,change in enumerate(changes):
            with self.subTest(case=i):
                self.source=copy.deepcopy(original);change(self.source)
                with self.assertRaises((ValueError,sqlite3.IntegrityError)):self.run_build()
                self.assertTrue((self.root/'output/FAILED.txt').exists());self.assertFalse((self.root/'output/manifest.json').exists())
                (self.root/'output').rename(self.root/f'failed-{i}')

    def test_independent_audit_rejects_a_modified_delivery(self):
        self.run_build()
        with sqlite3.connect(self.root/'output/mhp3.sqlite') as db:db.execute("UPDATE preserved SET v='changed'")
        with self.assertRaises(AssertionError):audit(self.base,self.root/'input.json',self.root/'output')


class ReferenceTests(unittest.TestCase):
    def test_spans_keep_rank_item_probability_and_observation_columns_distinct(self):
        html='<table><tr><th rowspan="2">part</th><th colspan="2">rank</th></tr><tr><td>item A<br/>item B</td><td>23%<br/>77%</td></tr></table>'
        grid=matrix(BeautifulSoup(html,'html.parser').table)
        self.assertEqual(grid[1][0]['text'],'part');self.assertEqual(grid[0][1]['origin'],grid[0][2]['origin'])
        self.assertNotEqual(grid[1][1]['origin'],grid[1][2]['origin']);self.assertEqual(grid[1][1]['text'],'item A\nitem B')

    def test_damage_units_and_immunity_are_never_inferred_from_missing_values(self):
        a=status_cell('13\n7(41)\n3/9秒\n18秒\n2/3秒');self.assertEqual((a['damage'],a['damageIntervalSeconds'],a['damageUnit']),(2,3,'per-interval'))
        b=status_cell('13\n7(41)\n3/9秒\n-秒\n19');self.assertIsNone(b['duration']);self.assertEqual(b['damageUnit'],'unspecified')
        self.assertFalse(status_cell('無効')['applicable'])
        with self.assertRaises(ValueError):status_cell('unexpected partial cell')

if __name__=='__main__':unittest.main()
