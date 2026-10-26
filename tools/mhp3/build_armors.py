"""Offline P3 armor extension. Read frozen evidence, build a NEW full-library copy.

See docs/development/mhp3-armor-catalog.md for the native field contract.
No network, host probing, terminology rebuild, or installation occurs here.
"""
import hashlib
import json
import sqlite3
import struct
import sys
from pathlib import Path

PARTS = ('chest', 'arms', 'waist', 'legs', 'head')
LIMITS = (232, 212, 213, 219, 255)
OWNED = ('p3_armor_materials', 'p3_armor_recipes', 'p3_armor_members', 'p3_armor_sets')
SCHEMA = Path(__file__).with_name('armor_schema.sql').read_text()


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def digest(value):
    return hashlib.sha256(value).hexdigest()


def fingerprint(db):
    return {name: digest(encode(sorted(db.execute('SELECT * FROM "'+name+'"').fetchall(), key=repr)).encode())
            for name, in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            if name not in (*OWNED, 'p3_skill_armors', 'meta')}


def unique(rows, field):
    result = {r[field]: r for r in rows}
    if len(result) != len(rows):
        raise ValueError('Duplicate identity: '+field)
    return result


def decode_stats(raw):
    if len(raw) != 40 or raw[4] & 3 not in (1, 2, 3) or raw[4] & 12 not in (4, 8, 12):
        raise ValueError('Invalid native armor record')
    boundaries = raw[21:25]
    cap = max(0, min(63, max(boundaries)-1))
    level, maximum = 1, raw[12]
    for boundary, increment in zip(boundaries, (2, 2, 3, 4) if raw[4] & 16 else (2, 3, 4, 5)):
        while level < boundary and level <= cap:
            maximum += increment
            level += 1
    signed = lambda offset: struct.unpack_from('b', raw, offset)[0]
    return dict(gender={1: 'male', 2: 'female', 3: 'both'}[raw[4] & 3],
                combat={4: 'blademaster', 8: 'gunner', 12: 'both'}[raw[4] & 12],
                rarity=raw[5]+1, slots=raw[18], baseDefense=raw[12], maxDefense=maximum,
                fireRes=signed(13), waterRes=signed(14), thunderRes=signed(15), iceRes=signed(17), dragonRes=signed(16))


def populate(db, native, recipes, review):
    existing = {key: json.loads(raw) for key, raw in db.execute('SELECT * FROM p3_skill_armors')}
    names, acquisition = unique(review['names'], 'armorKey'), unique(review['acquisition'], 'armorKey')
    sources = {}
    for table in native['armors']:
        t = table['type']
        if t not in range(5) or table['stride'] != 40 or table['part'] != PARTS[t]:
            raise ValueError('Native table contract mismatch')
        for row in table['records']:
            i = row['nativeId']
            if i == 0:
                continue
            key = f'mhp3:armor:{t}:{i}'
            if not 1 <= i <= LIMITS[t] or key in sources:
                raise ValueError('Invalid or duplicate native identity')
            sources[key] = row
    if set(existing) != set(sources) or set(names) != set(existing) or set(acquisition) != set(existing):
        raise ValueError('Armor identity coverage changed')
    recipe_targets = {f"mhp3:armor:{r['nativeType']}:{r['nativeId']}" for r in recipes['rows']}
    for key, old in existing.items():
        row, name, acq = sources[key], names[key], acquisition[key]
        raw = bytes.fromhex(row['rawHex'])
        stats = decode_stats(raw)
        if (row['name'] != old['nameJp'] or name['nameJp'] != old['nameJp']
                or name['reviewStatus'] != 'reviewed' or not name['nameCn']
                or name['nameSource'] not in ('gu-pass-02', 'project')
                or (old['nameCn'] and old['nameCn'] != name['nameCn'])
                or stats['rarity'] != old['rarity'] or stats['slots'] != old['slots']
                or not 0 <= stats['slots'] <= 3 or not 1 <= stats['rarity'] <= 7):
            raise ValueError('Armor name / field binding mismatch: '+key)
        points = [(raw[o], struct.unpack_from('b', raw, o+1)[0]) for o in range(28, 38, 2) if raw[o] and raw[o+1]]
        actual = [(s['skillId'], s['points']) for s in old['skills']]
        if points != actual or any((s['skillId'] == 1) != (s['kind'] == 'torso-copy-marker') for s in old['skills']):
            raise ValueError('Existing signed skills or torso-copy marker changed')
        if acq['status'] not in ('obtainable', 'unknown', 'special') or not acq['text'] or not acq['source']:
            raise ValueError('Unbound acquisition status')
        price = struct.unpack_from('<I', raw, 8)[0] if key in recipe_targets else None
        detail = dict(old, **stats, nameSource=name['nameSource'],
                      aliases=name['aliases'], price=price, isPlaceholder=False, nativeRowSha256=digest(raw),
                      acquisition=acq['text'], acquisitionSource=acq['source'])
        detail.update(nameCn=name['nameCn'], acquisitionStatus=acq['status'])
        db.execute('UPDATE p3_skill_armors SET detail_json=? WHERE armor_key=?', (encode(detail), key))
        existing[key] = detail
    routes = {}
    indices = set()
    for r in recipes['rows']:
        raw = bytes.fromhex(r['rawHex'])
        if len(raw) != 36 or raw[0] != r['nativeType'] or struct.unpack_from('<H', raw, 2)[0] != r['nativeId'] or r['index'] in indices:
            raise ValueError('Recipe native binding mismatch')
        indices.add(r['index'])
        key = f"mhp3:armor:{r['nativeType']}:{r['nativeId']}"
        if key not in existing:
            raise ValueError('Missing recipe armor endpoint')
        materials = [dict(itemId=item, quantity=quantity) for offset in (4, 8, 12, 16)
                     for item, quantity in [struct.unpack_from('<Hh', raw, offset)] if item or quantity]
        if materials != r['materials'] or not materials or any(m['itemId'] <= 0 or m['quantity'] <= 0 for m in materials):
            raise ValueError('Invalid ordered recipe materials')
        route = routes.get(key, 0)
        routes[key] = route+1
        recipe_key = f"mhp3:armor-recipe:{r['index']}"
        db.execute('INSERT INTO p3_armor_recipes VALUES(?,?,?,?)', (recipe_key, key, route, existing[key]['price']))
        for pos, m in enumerate(materials):
            db.execute('INSERT INTO p3_armor_materials VALUES(?,?,?,?)', (recipe_key, pos, m['itemId'], m['quantity']))
    sets = unique(review['sets'], 'setKey')
    covered = set()
    for key, s in sets.items():
        if s['gender'] not in ('both', 'male', 'female') or not s['nameCn'] or not s['sources'] or not s['rows']:
            raise ValueError('Unbound set review')
        db.execute('INSERT INTO p3_armor_sets VALUES(?,?,?)', (key, s['sortOrder'], encode({k: v for k, v in s.items() if k != 'rows'})))
        for row in s['rows']:
            if not row['members']:
                raise ValueError('Empty set row')
            for member in row['members']:
                a = existing[member]
                if a['gender'] not in ('both', s['gender']) or a['combat'] not in ('both', row['combat']):
                    raise ValueError('Mutually exclusive set members')
                db.execute('INSERT INTO p3_armor_members VALUES(?,?,?,?)', (key, row['combat'], a['part'], member))
                covered.add(member)
    if covered != set(existing):
        raise ValueError('Set / standalone coverage incomplete')
    return dict(armors=len(existing), recipes=len(indices), sets=len(sets),
                acquisition={status: sum(a['acquisitionStatus'] == status for a in existing.values())
                             for status in ('obtainable', 'special', 'unknown')})


def build(base_file, source_dir, review_file, output):
    base_file, source_dir, review_file, output = map(Path, (base_file, source_dir, review_file, output))
    if output.exists():
        raise ValueError('Output must be a new directory')
    output.mkdir(parents=True)
    try:
        review = json.loads(review_file.read_bytes())
        if review['schema'] != 'mhp3-armor-review-v1' or digest(base_file.read_bytes()) != review['baseSha256']:
            raise ValueError('Base / review fingerprint mismatch')
        for path, expected in review['inputs'].items():
            resolved = (source_dir/path).resolve()
            if not resolved.is_relative_to(source_dir.resolve()) or digest(resolved.read_bytes()) != expected:
                raise ValueError('Frozen input fingerprint mismatch: '+path)
        required = ('native-armors.json', 'recipes-v1/result.json')
        if any(path not in review['inputs'] for path in required):
            raise ValueError('Missing native evidence binding')
        native, recipes = [json.loads((source_dir/path).read_bytes()) for path in required]
        if native['programSha256'] != recipes['programSha256']:
            raise ValueError('Native program revisions differ')
        with sqlite3.connect(base_file.resolve().as_uri()+'?mode=ro', uri=True) as base:
            original_meta = dict(base.execute('SELECT * FROM meta'))
            if original_meta.get('skill_schema') != 'mhp3-skills-v1':
                raise ValueError('Expected current complete P3 skills library')
            baseline = fingerprint(base)
            with sqlite3.connect(output/'mhp3.sqlite') as db:
                base.backup(db)
                db.execute('PRAGMA foreign_keys=ON')
                for table in OWNED:
                    db.execute('DROP TABLE IF EXISTS '+table)
                db.executescript(SCHEMA)
                with db:
                    counts = populate(db, native, recipes, review)
                    version = digest(review_file.read_bytes())
                    for k, v in dict(armor_schema='mhp3-armors-v1', armor_data_version=version, skill_data_version=version).items():
                        db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', (k, v))
                if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('Database integrity failed')
                if fingerprint(db) != baseline:
                    raise ValueError('Non-target business tables changed')
                meta = dict(db.execute('SELECT * FROM meta'))
                if any(meta[k] != v for k, v in original_meta.items() if k not in ('armor_schema', 'armor_data_version', 'skill_data_version')):
                    raise ValueError('Non-target metadata changed')
        if digest(base_file.read_bytes()) != review['baseSha256']:
            raise ValueError('Input database changed during build')
        report = dict(schema='mhp3-armors-v1', counts=counts, unchangedTables=baseline,
                      baseSha256=review['baseSha256'], databaseSha256=digest((output/'mhp3.sqlite').read_bytes()))
        (output/'audit.json').write_text(encode(report)+'\n')
        (output/'manifest.json').write_text(encode(dict(status='success', **report,
            reviewSha256=digest(review_file.read_bytes()), inputs=review['inputs'], auditSha256=digest((output/'audit.json').read_bytes())))+'\n')
        return report
    except Exception as error:
        (output/'FAILED.txt').write_text(str(error)+'\n')
        raise


if __name__ == '__main__':
    print(encode(build(*sys.argv[1:])))
