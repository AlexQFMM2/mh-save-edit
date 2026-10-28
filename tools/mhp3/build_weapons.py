"""Append P3 weapons to a frozen COMPLETE library copy; never install or access a host.

Input values carry per-field sources. Verified native core fields are decoded again;
independent-reference special parameters must retain their explicit source.
"""
import hashlib
import json
import re
import shutil
import sqlite3
import struct
import sys
from pathlib import Path

LIMITS = {5: 91, 6: 94, 7: 93, 8: 96, 9: 66, 11: 67, 12: 85, 13: 71, 14: 77, 15: 80, 16: 82, 17: 85}
TYPE_IDS = {5: 1, 12: 2, 6: 3, 16: 4, 7: 5, 17: 6, 8: 7, 14: 8, 13: 9, 11: 12, 9: 13, 15: 14}
KINDS = {t: {9: 'bowgun', 11: 'bowgun', 13: 'switchAxe', 14: 'gunlance', 15: 'bow', 17: 'huntingHorn'}.get(t, 'standardMelee') for t in LIMITS}
OWNED = ('p3_weapon_item_links', 'p3_weapon_edges', 'p3_weapon_materials', 'p3_weapon_recipes', 'p3_weapons', 'p3_weapon_types')
SCHEMA = Path(__file__).with_name('weapon_schema.sql').read_text()
encode = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
digest = lambda b: hashlib.sha256(b).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fingerprint(db):
    return {n: digest(encode(sorted(db.execute('SELECT * FROM "'+n+'"').fetchall(), key=repr)).encode())
            for n, in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            if n not in (*OWNED, 'meta')}


def unique(rows, key):
    result = {r[key]: r for r in rows}
    require(len(result) == len(rows), 'Duplicate '+key)
    return result


def validate_weapon(w, types, icons):
    t, i = w['nativeType'], w['nativeId']
    require(t in LIMITS and 1 <= i <= LIMITS[t] and w['weaponKey'] == f'mhp3:weapon:{t}:{i}' and w['gameId'] == 'mhp3', 'Invalid P3 weapon identity')
    require(w['typeId'] == TYPE_IDS[t] and w['kind'] == types[t]['kind'] == w['special']['kind'], 'Type binding mismatch')
    require(w['nameCn'] and w['nameJp'] and w['nameSource'] and w['acquisitionSource'] and w['fieldSources'] and w['special']['source'], 'Missing reviewed text / source')
    require(w['acquisitionStatus'] in ('obtainable', 'special', 'unknown') and w['acquisition'], 'Unbound acquisition')
    require(w['iconPath'] == '/assets/catalog/icons/'+icons[t, w['rarity']]['pngSha256']+'.png', 'Icon binding mismatch')
    raw = bytes.fromhex(w['raw']['recordHex'])
    melee = t not in (9, 11, 15)
    require(len(raw) == (28 if melee else 80) and digest(raw) == w['nativeRowSha256'], 'Native row hash / stride mismatch')
    attack = struct.unpack_from('<h', raw, 10 if melee else 12)[0]
    affinity = struct.unpack_from('b', raw, 13 if melee else 17)[0]
    require(w['rarity'] == raw[2]+1 and 1 <= w['rarity'] <= 7 and w['displayAttack'] == w['trueRawAttack'] == attack, 'Native rarity / base attack mismatch')
    require(w['affinity'] == affinity and w['defense'] == raw[12 if melee else 14] and w['slots'] == raw[18 if melee else 16] and 0 <= w['slots'] <= 3, 'Native core fields mismatch')
    boost = w['boost']
    require(boost['attack'] == attack+15 and boost['cost'] == (1000, 2000, 3000, 5000, 7000, 8000, 10000)[raw[2]], 'Attack boost must remain separate')
    require(boost['material'] == dict(itemId=struct.unpack_from('<H', raw, 20 if melee else 72)[0], quantity=raw[22 if melee else 74]), 'Native boost material mismatch')
    expected = []
    for enum, value, mapping in [(raw[14 if melee else 18], raw[15 if melee else 19], (0, 1, 2, 3, 5, 4)), (raw[16] if melee else 0, raw[17] if melee else 0, (0, 6, 7, 8))]:
        value = value-256 if melee and value >= 128 else value
        require(enum < len(mapping), 'Unknown attribute enum')
        if enum and value > 0:
            expected.append((mapping[enum], value))
    require([(a['attributeId'], a['value']) for a in w['attributes']] == expected, 'Base / phial-only attribute mismatch')
    if melee:
        for stage, cap in [('base', min(400, 150+50*raw[9])), ('handicraft', min(400, 200+50*raw[9]))]:
            segments = w['sharpness'][stage]
            require(len(segments) == 7 and segments[-1] == 0 and all(isinstance(n, int) and n >= 0 for n in segments) and sum(segments) == cap, 'Invalid native sharpness')
    else:
        require(w['sharpness'] is None, 'Ranged sharpness must be absent')
    s = w['special']
    if s['kind'] == 'bowgun':
        require(len(s['ammo']) == 35 and len(unique(s['ammo'], 'itemId')) == 35, 'Incomplete ammo matrix')
        for a in s['ammo']:
            require(a['available'] == (a['capacity'] is not None) and a['requiresSkill'] == (a['skillCapacity'] is not None) and not (a['available'] and a['requiresSkill']), 'Ammo availability conflated')
            require(all(n is None or isinstance(n, int) and n > 0 for n in (a['capacity'], a['skillCapacity'])), 'Invalid ammo capacity')
        require({a['kind'] for a in s['attachments']} == {'barrel', 'scope', 'silencer' if t == 11 else 'shield'}, 'Attachment set mismatch')
        cost = struct.unpack_from('<I', raw, 8)[0]
        for a in s['attachments']:
            extra = attack//(15 if t == 11 else 10) if a['kind'] == 'barrel' else 0
            require(a['baseAttack'] == attack+extra and a['boostedAttack'] == attack+15+extra and a['cost'] == cost//10*(1 if a['kind'] == 'scope' else 3), 'Attachment native comparison mismatch')
        require((not s['crouchFire'] if t == 11 else not s['rapidFire']), 'Wrong bowgun exclusive feature')
        available = {a['itemId'] for a in s['ammo'] if a['available']}
        require(all(a['itemId'] in available for a in s['rapidFire']+s['crouchFire']), 'Special ammo unavailable')
    elif s['kind'] == 'bow':
        require([c['level'] for c in s['charges']] == [1, 2, 3, 4], 'Incomplete bow charge slots')
        for c in s['charges']:
            require(not(c['available'] and c['requiresLoadUp']) and (c['shotLevel'] is not None or not(c['available'] or c['requiresLoadUp'])), 'Load Up / absent charge conflated')
        require(len(unique(s['coatings'], 'itemId')) == 7, 'Incomplete coatings')
    elif s['kind'] == 'huntingHorn':
        require(len(s['notes']) == 3 and s['songs'], 'Missing horn melodies')
        for song in s['songs']:
            require(set(song['notes']) <= set(s['notes']) and song['effectCn'] and not re.search('[ぁ-ゖァ-ヺ]', song['effectCn']), 'Horn text / note binding mismatch')
            for name in ('duration', 'repeatDuration'):
                timing = song[name]
                require(timing is None or timing['mode'] in ('extend', 'replace') and timing['seconds'] >= 0 and timing['maestroSeconds'] >= 0, 'Invalid melody timing')
    elif s['kind'] == 'gunlance':
        require(s['level'] == raw[19]//3+1 and s['shellingType'] == ('通常型', '扩散型', '放射型')[raw[19] % 3], 'Native shelling mismatch')


def populate(db, source):
    types = {r['nativeType']: r for r in source['weaponTypes']}
    require(len(types) == len(source['weaponTypes']) == 12 and set(types) == set(LIMITS), 'Expected 12 native weapon types')
    icons = {(i['type'], i['rarity']): i for i in source['icons']}
    require(len(icons) == 84, 'Incomplete icon bindings')
    weapons = unique(source['weapons'], 'weaponKey')
    for t in types.values():
        require(t['typeId'] == TYPE_IDS[t['nativeType']] and t['kind'] == KINDS[t['nativeType']], 'Native category binding mismatch')
        db.execute('INSERT INTO p3_weapon_types VALUES(?,?,?)', (t['nativeType'], t['typeId'], encode(t)))
    for w in weapons.values():
        validate_weapon(w, types, icons)
        stored = {k: v for k, v in w.items() if k != 'raw'}
        if w['special']['kind'] == 'huntingHorn':
            stored['special'] = dict(w['special'], songs=[{k: v for k, v in s.items() if k not in ('raw', 'noteSet', 'rowIndex')} for s in w['special']['songs']])
        db.execute('INSERT INTO p3_weapons VALUES(?,?,?,?)', (w['weaponKey'], w['nativeType'], w['nativeId'], encode(stored)))
    recipes = unique(source['recipes'], 'recipeKey')
    for r in recipes.values():
        require(r['weaponKey'] in weapons and r['materials'] and r['source'], 'Recipe endpoint / source missing')
        raw = bytes.fromhex(weapons[r['weaponKey']]['raw']['recordHex'])
        base = struct.unpack_from('<I', raw, 4 if len(raw) == 28 else 8)[0]
        require(r['cost'] == (base if r['kind'] == 'upgrade' else base*3//2 if r['kind'] == 'production' else None), 'Recipe cost mismatch')
        db.execute('INSERT INTO p3_weapon_recipes VALUES(?,?,?,?,?)', (r['recipeKey'], r['weaponKey'], r['kind'], r['cost'], r['source']))
        for role, values in [('material', r['materials']), ('byproduct', r['byproducts'])]:
            for m in values:
                require((isinstance(m['quantity'], int) and m['quantity'] > 0) or (m['quantity'] is None and r['kind'] == 'appraisal'), 'Unknown quantity only allowed on explicit appraisal source')
                db.execute('INSERT INTO p3_weapon_materials VALUES(?,?,?,?,?)', (r['recipeKey'], role, m['position'], m['itemId'], m['quantity']))
    for e in source['edges']:
        db.execute('INSERT INTO p3_weapon_edges VALUES(?,?,?)', (e['parentWeaponKey'], e['childWeaponKey'], e['branchOrder']))
    parents = {e['parentWeaponKey'] for e in source['edges']}
    upgrades = {e['childWeaponKey'] for e in source['edges']}
    require(upgrades == {r['weaponKey'] for r in recipes.values() if r['kind'] == 'upgrade'}, 'Upgrade recipe / graph mismatch')
    produced = {r['weaponKey'] for r in recipes.values() if r['kind'] == 'production'}
    for w in weapons.values():
        require(w['isFinalForm'] == (w['weaponKey'] not in parents) and w['isDirectlyProducible'] == (w['weaponKey'] in produced), 'Graph-derived flags mismatch')
        links = [(w['boost']['material']['itemId'], 'boost', False)]
        s = w['special']
        if s['kind'] == 'bowgun':
            links += [(a['itemId'], 'ammo', a['requiresSkill']) for a in s['ammo'] if a['available'] or a['requiresSkill']]
        if s['kind'] == 'bow':
            links += [(a['itemId'], 'coating', False) for a in s['coatings'] if a['available']]
        # Audit even unavailable ammunition/coating item endpoints.
        for a in s.get('ammo', [])+s.get('coatings', []):
            require(db.execute('SELECT 1 FROM catalog_items WHERE item_id=?', (a['itemId'],)).fetchone(), 'Missing ammo/coating item')
        for item, role, skill in links:
            db.execute('INSERT INTO p3_weapon_item_links VALUES(?,?,?,?)', (w['weaponKey'], item, role, int(skill)))
    return dict(weapons=len(weapons), recipes=len(recipes), edges=len(source['edges']), icons=len(icons), scopes={s: sum(w['acquisitionStatus'] == s for w in weapons.values()) for s in ('obtainable', 'special', 'unknown')})


def build(base_file, input_file, icon_dir, output_dir):
    base_file, input_file, icon_dir, output = map(Path, (base_file, input_file, icon_dir, output_dir))
    require(not output.exists(), 'Output must be a new directory')
    output.mkdir(parents=True)
    try:
        source = json.loads(input_file.read_bytes())
        require(re.fullmatch('[a-f0-9]{64}', source['nativeProgramSha256']), 'Missing native program hash')
        require(source['schema'] == 'mhp3-weapons-input-v1' and source['reviewed'] is True and source['sourceVersions'], 'Unreviewed input')
        require(digest(base_file.read_bytes()) == source['baseSha256'], 'Full base fingerprint mismatch')
        (output/'icons').mkdir()
        for i in source['icons']:
            require(re.fullmatch('[a-f0-9]{64}', i['pngSha256']) and i['independentDecoderEqual'] is True, 'Unverified icon')
            f = icon_dir/(i['pngSha256']+'.png'); data = f.read_bytes()
            require(digest(data) == i['pngSha256'] and data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == (24, 24), 'Icon hash / dimensions mismatch')
            shutil.copyfile(f, output/'icons'/f.name)
        with sqlite3.connect(base_file.resolve().as_uri()+'?mode=ro', uri=True) as base:
            old_meta = dict(base.execute('SELECT * FROM meta'))
            require(old_meta.get('armor_schema') == 'mhp3-armors-v1', 'Expected complete armor library')
            baseline = fingerprint(base)
            with sqlite3.connect(output/'mhp3.sqlite') as db:
                base.backup(db)
                db.execute('PRAGMA foreign_keys=ON')
                for table in OWNED:
                    db.execute('DROP TABLE IF EXISTS '+table)
                db.executescript(SCHEMA)
                with db:
                    counts = populate(db, source)
                    for k, v in dict(weapon_schema='mhp3-weapons-v1', weapon_data_version=digest(input_file.read_bytes())).items():
                        db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)', (k, v))
                require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)] and not db.execute('PRAGMA foreign_key_check').fetchall(), 'Database integrity failed')
                require(fingerprint(db) == baseline, 'Existing business tables changed')
                meta = dict(db.execute('SELECT * FROM meta'))
                require(all(meta[k] == v for k, v in old_meta.items() if k not in ('weapon_schema', 'weapon_data_version')), 'Existing metadata changed')
        require(digest(base_file.read_bytes()) == source['baseSha256'], 'Base changed during build')
        report = dict(counts=counts, unchangedTables=baseline, baseSha256=source['baseSha256'], databaseSha256=digest((output/'mhp3.sqlite').read_bytes()), inputSha256=digest(input_file.read_bytes()), builderSha256=digest(Path(__file__).read_bytes()), schemaSha256=digest(SCHEMA.encode()))
        (output/'audit.json').write_text(encode(report)+'\n')
        (output/'manifest.json').write_text(encode(dict(status='success', schema='mhp3-weapons-v1', **report, auditSha256=digest((output/'audit.json').read_bytes())))+'\n')
        return report
    except Exception as error:
        (output/'FAILED.txt').write_text(str(error)+'\n')
        raise


if __name__ == '__main__':
    print(encode(build(*sys.argv[1:])))
