"""Append reviewed P3 monsters to a complete library COPY. Offline; never installs.

Real inputs, images and reports remain private. Any failure leaves FAILED.txt and
no success manifest. Existing business tables and metadata are fingerprinted.
"""
import hashlib
import json
import re
import shutil
import sqlite3
import struct
import sys
from pathlib import Path

OWNED = ('p3_monster_drops', 'p3_monsters')
SCHEMA = Path(__file__).with_name('monster_schema.sql').read_text()
encode = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
digest = lambda b: hashlib.sha256(b).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fingerprint(db):
    return {n: digest(encode(sorted(db.execute('SELECT * FROM "' + n + '"').fetchall(), key=repr)).encode())
            for n, in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            if n not in (*OWNED, 'meta')}


def validate_source(source):
    require(source['kind'] in ('native', 'reference') and source['key'] and source['label'], 'Unbound field source')
    require(re.fullmatch('[a-f0-9]{64}', source['sha256']), 'Source hash missing')


def populate(db, source):
    rows = source['monsters']
    normal = [m for m in rows if m['recordScope'] == 'normal']
    extended = [m for m in rows if m['recordScope'] == 'extended']
    require(len(rows) == len({m['monsterId'] for m in rows}) == 65, 'Expected 65 distinct native identities')
    require(len(normal) == 60 and {m['bookIndex'] for m in normal} == set(range(60)), 'Book binding incomplete')
    require({m['monsterId'] for m in extended} == {35, 37, 38, 39, 68}, 'Extended identity set mismatch')
    require(sum(m['sizeClass'] == 'large' for m in normal) == 40 and sum(m['sizeClass'] == 'small' for m in normal) == 20, 'Normal size counts mismatch')
    icons = {i['nativeId']: i for i in source['icons']}
    require(len(icons) == len(source['icons']) == 60 and set(icons) == {m['monsterId'] for m in normal}, 'Icon identity mismatch')
    for m in rows:
        require(m['gameId'] == 'mhp3' and 0 < m['monsterId'] < 75 and not m['isPlaceholder'], 'Invalid P3 identity')
        require(m['nameCn'] and m['nameJp'] and m['p3']['nameSource'], 'Unreviewed name')
        if m['recordScope'] == 'normal':
            require(m['p3']['descriptionCn'] and m['p3']['descriptionJp'] and m['p3']['descriptionTextIndex'] == 247 + m['bookIndex'], 'Native description binding missing')
            path = '/assets/catalog/icons/' + icons[m['monsterId']]['pngSha256'] + '.png'
            require(m['iconSmallPath'] == m['iconLargePath'] == path, 'Icon binding mismatch')
        else:
            require(m['bookIndex'] is None and m['iconSmallPath'] is None and m['iconLargePath'] is None, 'Unverified extended icon/book binding')
        require(set(m['p3']['coverage']) == {'weakness', 'ailments', 'traps', 'drops', 'appearances'}, 'Missing domain coverage')
        for coverage in m['p3']['coverage'].values():
            require(coverage['status'] in ('collected', 'partial', 'not-collected', 'checked-empty') and coverage['note'], 'Ambiguous coverage')
        for domain in ('weakness', 'ailments', 'traps'):
            require(len({r['id'] for r in m[domain]}) == len(m[domain]), 'Duplicate detail row identity')
            for r in m[domain]:
                validate_source(r['p3']['source'])
        for r in m['weakness']:
            require(r['conditionCn'] and r['partNameCn'], 'Unknown condition must be explicit')
            require(all(r[k] is None or isinstance(r[k], (int, float)) and 0 <= r[k] <= 255 for k in ('cut', 'impact', 'shot', 'fire', 'water', 'thunder', 'ice', 'dragon', 'stun')), 'Invalid hitzone number')
        for r in m['ailments']:
            require(all(r[k] is None or isinstance(r[k], (int, float)) and r[k] >= 0 for k in ('toleranceInitial', 'toleranceIncrease', 'toleranceMax', 'duration', 'damage')), 'Invalid status number')
            require(r['p3']['damageUnit'] in ('unknown', 'unspecified', 'per-interval', 'total'), 'Status damage unit missing')
            if r['p3']['damageUnit'] == 'per-interval':
                require(r['p3']['damageIntervalSeconds'] > 0, 'Status damage interval missing')
        for r in m['traps']:
            require(r['p3']['effect'] in ('effective', 'ineffective', 'conditional', 'unknown'), 'Trap applicability missing')
            uses = r['p3']['repetitions']
            require([u['fromUse'] for u in uses] == sorted({u['fromUse'] for u in uses}), 'Repeated trap uses conflated')
        appearances = m['p3']['appearances']
        require(len({q['sourceKey'] for q in appearances}) == len(appearances), 'Duplicate appearance source key')
        for q in appearances:
            require(q['sourceKey'].startswith(f"mhp3:appearance:{m['monsterId']}:") and q['nameJp'] and 'questKey' not in q and 'nativeId' not in q, 'Appearance must not fabricate a quest identity')
            validate_source(q['source'])
        db.execute('INSERT INTO p3_monsters VALUES(?,?,?,?)', (m['monsterId'], m['recordScope'], m['bookIndex'], encode(m)))
    for d in source['drops']:
        validate_source(d['p3']['source'])
        require(d['p3']['attemptCount'] is None or d['p3']['attemptCount'] > 0, 'Invalid attempt count')
        require(d['p3']['rawWeight'] is None or d['p3']['rawWeight'] >= 0 and d['p3']['rawWeightSource'], 'Unbound native weight')
        require(db.execute('SELECT 1 FROM catalog_items WHERE item_id=? AND is_placeholder=0', (d['itemId'],)).fetchone(), 'Unknown drop item endpoint')
        payload = {k: v for k, v in d.items() if k not in ('monsterId', 'itemId', 'id', 'sourceKey', 'rankId', 'methodId', 'quantity', 'probability')}
        db.execute('INSERT INTO p3_monster_drops VALUES(?,?,?,?,?,?,?,?,?)', (d['id'], d['monsterId'], d['itemId'], d['sourceKey'], d['rankId'], d['methodId'], d['quantity'], d['probability'], encode(payload)))
    return dict(monsters=len(rows), normal=len(normal), extended=len(extended), drops=len(source['drops']),
                weakness=sum(len(m['weakness']) for m in rows), ailments=sum(len(m['ailments']) for m in rows),
                traps=sum(len(m['traps']) for m in rows), appearances=sum(len(m['p3']['appearances']) for m in rows), icons=len(icons))


def build(base_file, input_file, icon_dir, output_dir):
    base_file, input_file, icon_dir, output = map(Path, (base_file, input_file, icon_dir, output_dir))
    require(not output.exists(), 'Output must be a new version directory')
    output.mkdir(parents=True)
    try:
        source = json.loads(input_file.read_bytes())
        require(source['schema'] == 'mhp3-monsters-input-v1' and source['reviewed'] is True and source['sourceVersions'], 'Unreviewed input')
        require(re.fullmatch('[a-f0-9]{64}', source['nativeProgramSha256']), 'Native program identity missing')
        require(digest(base_file.read_bytes()) == source['baseSha256'], 'Full base hash mismatch')
        (output / 'icons').mkdir()
        for i in source['icons']:
            require(i['independentDecodeEqual'] is True and re.fullmatch('[a-f0-9]{64}', i['rgbaSha256']), 'Unverified icon pixels')
            require(re.fullmatch('[a-f0-9]{64}', i['pngSha256']), 'Unsafe icon filename')
            f = icon_dir / (i['pngSha256'] + '.png')
            data = f.read_bytes()
            require(digest(data) == i['pngSha256'] and data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == (42, 42), 'Icon hash/dimension mismatch')
            shutil.copyfile(f, output / 'icons' / f.name)
        with sqlite3.connect(base_file.resolve().as_uri() + '?mode=ro', uri=True) as base:
            baseline = fingerprint(base)
            old_meta = dict(base.execute('SELECT * FROM meta'))
            require(old_meta.get('weapon_schema') == 'mhp3-weapons-v1' and old_meta.get('armor_schema') == 'mhp3-armors-v1', 'Expected current COMPLETE weapon/armor library')
            with sqlite3.connect(output / 'mhp3.sqlite') as db:
                base.backup(db)
                db.execute('PRAGMA foreign_keys=ON')
                for table in OWNED:
                    db.execute('DROP TABLE IF EXISTS ' + table)
                db.executescript(SCHEMA)
                with db:
                    counts = populate(db, source)
                    for k, v in dict(monster_schema='mhp3-monsters-v1', monster_data_version=digest(input_file.read_bytes())).items():
                        db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', (k, v))
                require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)] and not db.execute('PRAGMA foreign_key_check').fetchall(), 'Integrity/foreign key check failed')
                require(fingerprint(db) == baseline, 'Existing business tables changed')
                metadata = dict(db.execute('SELECT * FROM meta'))
                require(all(metadata[k] == v for k, v in old_meta.items() if k not in ('monster_schema', 'monster_data_version')), 'Existing capabilities/metadata changed')
        require(digest(base_file.read_bytes()) == source['baseSha256'], 'Base changed during build')
        report = dict(counts=counts, unchangedTables=baseline, baseSha256=source['baseSha256'], inputSha256=digest(input_file.read_bytes()),
                      databaseSha256=digest((output / 'mhp3.sqlite').read_bytes()), builderSha256=digest(Path(__file__).read_bytes()), schemaSha256=digest(SCHEMA.encode()))
        (output / 'audit.json').write_text(encode(report) + '\n')
        (output / 'manifest.json').write_text(encode(dict(status='success', schema='mhp3-monsters-v1', **report, auditSha256=digest((output / 'audit.json').read_bytes()))) + '\n')
        return report
    except Exception as error:
        (output / 'FAILED.txt').write_text(str(error) + '\n')
        raise


if __name__ == '__main__':
    print(encode(build(*sys.argv[1:])))
