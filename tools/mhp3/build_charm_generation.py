"""Append the P3 native charm generation rules to a full-library copy.

Reads the private legality contract produced by the 2026-11-23 native probe
(`../research/mhp3/charm-generation-20261123/native-charm-legality-contract.json`)
and writes three compact lookup tables. The 1,561,429-row fully enumerated
combination table stays in the private research area as a test oracle; it is not
a runtime asset. No network, host probing or installation occurs here.
"""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

SCHEMA = Path(__file__).with_name('charm_schema.sql').read_text()
OWNED = ('p3_charm_generation_sources', 'p3_charm_slot_tables', 'p3_charm_grade_rules')
GRADE_NAMES = {
    'mystery': ((0, '兵士护石', '兵士の護石'), (1, '斗士护石', '闘士の護石')),
    'shining': ((2, '骑士护石', '騎士の護石'), (3, '城塞护石', '城塞の護石')),
    'ancient': ((4, '女王护石', '女王の護石'), (5, '王之护石', '王の護石'), (6, '龙之护石', '龍の護石')),
}
ITEM_LABELS = {808: 'なぞのお守り', 809: '光るお守り', 810: '古びたお守り'}
SLOT_TABLE_ADDRESS = {'mystery': '0x09dcacd0', 'shining': '0x09dcac7c', 'ancient': '0x09dcac28'}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def digest(value):
    return hashlib.sha256(value).hexdigest()


def fingerprint(db):
    return {name: digest(encode(sorted(db.execute('SELECT * FROM "'+name+'"').fetchall(), key=repr)).encode())
            for name, in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            if name not in (*OWNED, 'meta')}


def grade_rules(source, formula):
    """Derive closed f-ranges from the contract's threshold wording."""
    expected = {
        'mystery': {'f_lt_8': 0, 'f_ge_8': 1},
        'shining': {'f_lt_8': 2, 'f_ge_8': 3},
        'ancient': {'f_lt_8': 4, 'f_8_to_12': 5, 'f_ge_13': 6},
    }[source]
    if formula != expected:
        raise ValueError('Unexpected charm grade thresholds: '+source)
    if source == 'ancient':
        return [(4, 0, 7), (5, 8, 12), (6, 13, 26)]
    low, high = expected.values()
    return [(low, 0, 7), (high, 8, 26)]


def populate(db, contract):
    dispatch = {row['itemId']: row for row in contract['itemDispatch']}
    if sorted(dispatch) != [808, 809, 810] or set(contract['pools']) != {'mystery1', 'shining1', 'shining2', 'ancient1', 'ancient2'}:
        raise ValueError('Unexpected charm pool domain')
    pool_rows = {name: rows for name, rows in contract['pools'].items()}
    for name, rows in pool_rows.items():
        if not rows or any(not (row['min'] <= row['max']) for row in rows):
            raise ValueError('Invalid charm pool rows: '+name)
        for row in rows:
            if not 0 <= row['skill'] <= 127:
                raise ValueError('Charm pool skill outside the 7-bit encoding: '+name)
    slots = contract['slotCumulativeThresholds']
    if set(slots) != {'mystery', 'shining', 'ancient'}:
        raise ValueError('Unexpected charm slot table domain')
    for source, rows in slots.items():
        if len(rows) != 21 or any(len(values) != 4 for values in rows):
            raise ValueError('Charm slot table must be 21 ranks x 4 slots: '+source)
        for values in rows:
            if any(values[i] > values[i + 1] for i in range(3)) or values[3] != 100:
                raise ValueError('Charm slot thresholds must be cumulative and reach 100: '+source)
    for item_id, row in dispatch.items():
        source = row['slotTable']
        if (row['skill2Pool'] is None) != (row['secondSkillThreshold'] == 100):
            raise ValueError('Second-skill pool and threshold disagree: '+str(item_id))
        evidence = f"overlay104:0x09dbb23c item={item_id}; thresholds from disassembly; slot table {SLOT_TABLE_ADDRESS[source]}"
        db.execute('INSERT INTO p3_charm_generation_sources VALUES(?,?,?,?,?,?,?,?)',
                   (source, item_id, ITEM_LABELS[item_id], row['skill1Pool'], row['skill2Pool'],
                    row['secondSkillThreshold'], source, evidence))
        for rank, values in enumerate(slots[source]):
            previous = 0
            for slot, cumulative in enumerate(values):
                width = cumulative - previous
                if width < 0:
                    raise ValueError('Negative charm slot width')
                db.execute('INSERT INTO p3_charm_slot_tables VALUES(?,?,?,?,?)', (source, rank, slot, cumulative, width))
                previous = cumulative
        formula = contract['gradeFormula'][source]
        for grade, min_f, max_f in grade_rules(source, formula):
            names = {row[0]: row for row in GRADE_NAMES[source]}[grade]
            db.execute('INSERT INTO p3_charm_grade_rules VALUES(?,?,?,?,?,?)', (source, names[0], min_f, max_f, names[1], names[2]))


def build(base_file, contract_file, output):
    base_file, output = Path(base_file), Path(output)
    if output.exists():
        raise ValueError('Output must be a new directory')
    contract_bytes = Path(contract_file).read_bytes()
    contract = json.loads(contract_bytes)
    if contract.get('schema') != 'p3-charm-legality-contract-v1':
        raise ValueError('Unexpected charm legality contract schema')
    base_hash = digest(base_file.read_bytes())
    with sqlite3.connect(base_file.resolve().as_uri()+'?mode=ro', uri=True) as base:
        meta = dict(base.execute('SELECT key,value FROM meta'))
        if meta.get('catalog_schema') != 'mhp3-items-v1' or meta.get('skill_schema') != 'mhp3-skills-v1':
            raise ValueError('Expected the P3 item and skill library')
        if meta.get('charm_generation_schema'):
            raise ValueError('Charm generation rules already present')
        baseline = fingerprint(base)
    output.mkdir(parents=True)
    try:
        with sqlite3.connect(output/'mhp3.sqlite') as db:
            with sqlite3.connect(base_file.resolve().as_uri()+'?mode=ro', uri=True) as base:
                base.backup(db)
            db.execute('PRAGMA foreign_keys=OFF')
            for table in OWNED:
                db.execute('DROP TABLE IF EXISTS '+table)
            db.executescript(SCHEMA)
            db.execute('PRAGMA defer_foreign_keys=ON')
            with db:
                populate(db, contract)
                db.execute("INSERT OR REPLACE INTO meta VALUES('charm_generation_schema','mhp3-charm-generation-v1')")
                db.execute("INSERT OR REPLACE INTO meta VALUES('charm_generation_data_version',?)", (digest(contract_bytes),))
            if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():
                raise ValueError('Charm generation database integrity failed')
            if fingerprint(db) != baseline:
                raise ValueError('Existing business tables changed')
            counts = {table: db.execute('SELECT count(*) FROM '+table).fetchone()[0] for table in OWNED}
            if counts != {'p3_charm_generation_sources': 3, 'p3_charm_slot_tables': 252, 'p3_charm_grade_rules': 7}:
                raise ValueError('Unexpected charm rule row counts: '+encode(counts))
            graded = db.execute('SELECT group_concat(grade,",") FROM (SELECT grade FROM p3_charm_grade_rules ORDER BY grade)').fetchone()[0]
            if graded != '0,1,2,3,4,5,6':
                raise ValueError('Charm grades are not covered exactly once')
        if digest(base_file.read_bytes()) != base_hash:
            raise ValueError('Input database changed during build')
        report = dict(schema='mhp3-charm-generation-v1', counts=counts, baseSha256=base_hash,
                      contractSha256=digest(contract_bytes), unchangedTables=baseline,
                      databaseSha256=digest((output/'mhp3.sqlite').read_bytes()))
        (output/'audit.json').write_text(encode(report)+'\n')
        (output/'manifest.json').write_text(encode(dict(contractSha256=digest(contract_bytes),
            databaseSha256=report['databaseSha256'], auditSha256=digest((output/'audit.json').read_bytes())))+'\n')
        return report
    except Exception as error:
        (output/'FAILED.txt').write_text(str(error)+'\n')
        raise


if __name__ == '__main__':
    print(encode(build(*sys.argv[1:])))
