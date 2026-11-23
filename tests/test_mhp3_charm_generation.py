"""Synthetic checks for the P3 charm generation rule builder; no extracted game data."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from tools.mhp3.build_charm_generation import build


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False))


def synthetic_contract():
    slots = {}
    for source, final in (('mystery', 100), ('shining', 100), ('ancient', 100)):
        slots[source] = [[0, 25, 60, final] for _ in range(21)]
    return dict(
        schema='p3-charm-legality-contract-v1',
        itemDispatch=[
            dict(itemId=808, skill1Pool='mystery1', skill2Pool=None, secondSkillThreshold=100, slotTable='mystery'),
            dict(itemId=809, skill1Pool='shining1', skill2Pool='shining2', secondSkillThreshold=35, slotTable='shining'),
            dict(itemId=810, skill1Pool='ancient1', skill2Pool='ancient2', secondSkillThreshold=25, slotTable='ancient'),
        ],
        pools={
            'mystery1': [dict(skill=2, min=1, max=8)],
            'shining1': [dict(skill=3, min=1, max=5)],
            'shining2': [dict(skill=4, min=-3, max=3)],
            'ancient1': [dict(skill=5, min=1, max=7)],
            'ancient2': [dict(skill=6, min=-10, max=10)],
        },
        slotCumulativeThresholds=slots,
        gradeFormula={'mystery': {'f_lt_8': 0, 'f_ge_8': 1}, 'shining': {'f_lt_8': 2, 'f_ge_8': 3},
                      'ancient': {'f_lt_8': 4, 'f_8_to_12': 5, 'f_ge_13': 6}},
    )


class CharmGenerationBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = self.root/'base.sqlite'
        with sqlite3.connect(self.base) as db:
            db.executescript("""CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);
                INSERT INTO meta VALUES('catalog_schema','mhp3-items-v1');
                INSERT INTO meta VALUES('skill_schema','mhp3-skills-v1');
                CREATE TABLE catalog_items(item_id INTEGER PRIMARY KEY);
                INSERT INTO catalog_items VALUES(7);
                CREATE TABLE p3_skill_charm_sources(source_key TEXT PRIMARY KEY,skill_id INTEGER,detail_json TEXT);""")
        self.contract = self.root/'contract.json'
        write_json(self.contract, synthetic_contract())

    def test_builds_compact_rule_tables_and_records_versions(self):
        output = self.root/'out'
        report = build(self.base, self.contract, output)
        self.assertEqual(report['counts'], {'p3_charm_generation_sources': 3, 'p3_charm_slot_tables': 252, 'p3_charm_grade_rules': 7})
        with sqlite3.connect(output/'mhp3.sqlite') as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchall(), [('ok',)])
            self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
            sources = dict(db.execute('SELECT source_key,item_id FROM p3_charm_generation_sources'))
            self.assertEqual(sources, {'mystery': 808, 'shining': 809, 'ancient': 810})
            self.assertEqual(db.execute('SELECT second_skill_threshold FROM p3_charm_generation_sources WHERE source_key=?', ('mystery',)).fetchone(), (100,))
            rows = db.execute('SELECT source_key,rank,slot,cumulative,width FROM p3_charm_slot_tables WHERE rank=3 ORDER BY source_key,slot').fetchall()
            self.assertEqual([r[3:] for r in rows], [(0, 0), (25, 25), (60, 35), (100, 40)]*3)
            grades = db.execute('SELECT grade,min_f,max_f FROM p3_charm_grade_rules ORDER BY grade').fetchall()
            self.assertEqual(grades, [(0, 0, 7), (1, 8, 26), (2, 0, 7), (3, 8, 26), (4, 0, 7), (5, 8, 12), (6, 13, 26)])
            self.assertEqual(dict(db.execute('SELECT key,value FROM meta'))['charm_generation_schema'], 'mhp3-charm-generation-v1')
        self.assertTrue((output/'audit.json').is_file() and (output/'manifest.json').is_file())

    def test_rejects_existing_rules_and_malformed_contracts(self):
        with sqlite3.connect(self.base) as db:
            db.execute("INSERT INTO meta VALUES('charm_generation_schema','mhp3-charm-generation-v1')")
        with self.assertRaisesRegex(ValueError, 'already present'):
            build(self.base, self.contract, self.root/'out1')

        with sqlite3.connect(self.base) as db:
            db.execute("DELETE FROM meta WHERE key='charm_generation_schema'")

        not_cumulative = synthetic_contract()
        not_cumulative['slotCumulativeThresholds']['mystery'][4] = [0, 25, 30, 99]
        write_json(self.root/'bad-a.json', not_cumulative)
        with self.assertRaisesRegex(ValueError, 'cumulative and reach 100'):
            build(self.base, self.root/'bad-a.json', self.root/'out2')

        bad_dispatch = synthetic_contract()
        bad_dispatch['itemDispatch'][0]['secondSkillThreshold'] = 35
        write_json(self.root/'bad-b.json', bad_dispatch)
        with self.assertRaisesRegex(ValueError, 'Second-skill pool and threshold disagree'):
            build(self.base, self.root/'bad-b.json', self.root/'out3')

    def test_requires_the_skill_library(self):
        stale = self.root/'stale.sqlite'
        with sqlite3.connect(self.base) as base, sqlite3.connect(stale) as copy:
            base.backup(copy)
        with sqlite3.connect(stale) as db:
            db.execute("DELETE FROM meta WHERE key='skill_schema'")
        with self.assertRaisesRegex(ValueError, 'item and skill library'):
            build(stale, self.contract, self.root/'out4')



if __name__ == '__main__':
    unittest.main()
