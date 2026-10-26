"""Append the private P3 skill catalog to a copy; never mutate the input database."""
import base64
import json
import sqlite3
import sys
from pathlib import Path
from .skill_names import armor_names
from .skill_sources import digest, display_text, read_inputs

SCHEMA = Path(__file__).with_name('skill_schema.sql').read_text()
OWNED = ('p3_armor_skill_points', 'p3_skill_charm_sources', 'p3_skill_armors', 'p3_skills')
PARTS = ('chest', 'arms', 'waist', 'legs', 'head')
POOL_NAMES = {'mystery1': ('谜之护符', 'A'), 'shining1': ('光之护符', 'A'),
              'shining2': ('光之护符', 'B'), 'ancient1': ('古老护符', 'A'), 'ancient2': ('古老护符', 'B')}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def table_fingerprints(db):
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    return {name: digest(encode(sorted(db.execute('SELECT * FROM "'+name.replace('"', '""')+'"').fetchall(), key=repr)).encode())
            for name in tables if name not in OWNED and name != 'meta'}


def populate(db, inputs, review, systems, reviewed_activations, icon_paths, names=None):
    skills = inputs['native-skill-contract.json']
    for source in skills['systems']:
        id = source['id']
        row = systems[id]
        activations = []
        for a in skills['activations']:
            if a['skillId'] != id:
                continue
            r = reviewed_activations[a['activationId']]
            if a['threshold'] not in (-20, -15, -10, 10, 15, 20):
                raise ValueError('Invalid native threshold')
            activations.append(dict(activationKey=f"mhp3:activation:{a['activationId']}",
                dexActivationId=None, nativeActivationId=a['activationId'], threshold=a['threshold'],
                direction='positive' if a['threshold'] > 0 else 'negative', nameCn=r['nameCn'],
                nameJp=display_text(a['nameRawJp']), nameEn=a['nameEn'], descriptionCn=r['descriptionCn'],
                descriptionJp=display_text(a['descriptionRawJp']), descriptionEn='', components=[],
                componentsStatus='unreviewed', aliases=r.get('aliases', [])))
        activations.sort(key=lambda a: (a['threshold'] < 0, abs(a['threshold'])))
        detail = dict(skillId=id, nameCn=row['nameCn'], nameEn=row['nameEn'], nameJp=display_text(source['nameRawJp']),
            descriptionCn=row['descriptionCn'], descriptionJp=display_text(source['descriptionRawJp']),
            descriptionEn=None, activations=activations, aliases=row.get('aliases', []),
            specialRule=dict(descriptionCn=review['specialRuleCn'], descriptionJp=display_text(source['descriptionRawJp'])) if source['special'] else None)
        if (id == 1) != bool(detail['specialRule']) or (id == 1 and activations):
            raise ValueError('Invalid torso-copy rule')
        db.execute('INSERT INTO p3_skills VALUES(?,?)', (id, encode(detail)))
    armors = inputs['native-armor-contract.json']['armors']
    for a in armors:
        if a['part'] != PARTS[a['nativeType']] or a['armorKey'] != f"mhp3:armor:{a['nativeType']}:{a['nativeId']}" or a['nativeId'] < 1:
            raise ValueError('Invalid native armor identity')
        detail = dict(gameId='mhp3', armorKey=a['armorKey'], nativeType=a['nativeType'], nativeId=a['nativeId'],
            nameCn=(names or {}).get(a['armorKey'], ''), nameEn='', nameJp=display_text(a['nameRawJp']), part=a['part'], rarity=a['rarity'], slots=a['slots'],
            iconPath=icon_paths[(a['nativeType'], a['rarity'])], acquisitionStatus=a['acquisitionStatus'],
            referenceCoverage=a['referenceCoverage'], skills=[])
        if not 0 <= a['slots'] <= 3 or not 1 <= a['rarity'] <= 7:
            raise ValueError('Invalid armor slots or rarity')
        for s in a['skills']:
            if s['skillId'] not in systems or not s['points'] or (s['skillId'] == 1) != (s['kind'] == 'torso-copy-marker'):
                raise ValueError('Invalid effective armor skill')
            detail['skills'].append(dict(skillId=s['skillId'], points=s['points'], kind=s['kind']))
            db.execute('INSERT INTO p3_armor_skill_points VALUES(?,?,?,?)', (a['armorKey'], s['skillId'], s['points'], s['kind']))
        db.execute('INSERT INTO p3_skill_armors VALUES(?,?)', (a['armorKey'], encode(detail)))
    charms = inputs['native-charm-contract.json']
    for pool in charms['randomCandidatePools']:
        label, position = POOL_NAMES[pool['name']]
        for i, r in enumerate(pool['rows']):
            if r['minimum'] > r['maximum'] or r['skill'] not in systems:
                raise ValueError('Invalid charm candidate range')
            key = f"mhp3:pool:{pool['name']}:{i}"
            row = dict(sourceKey=key, sourceKind='random-pool', label=label, position=position,
                minPoints=r['minimum'], maxPoints=r['maximum'], slots=None, skillId=r['skill'], nameJp='',
                note='鉴定候选范围；不代表可自由组合的成品护石。孔数及另一技能的联合条件尚未核实。')
            db.execute('INSERT INTO p3_skill_charm_sources VALUES(?,?,?)', (key, r['skill'], encode(row)))
    for r in charms['specialSources']:
        if (r['skillId'], r['points'], r['slots'], r['secondSkillId']) != (17, 10, 0, None):
            raise ValueError('Special gift record changed')
        key = 'mhp3:gift:auto-guard'
        row = dict(sourceKey=key, sourceKind='special-gift', label='斗士护石', nameJp=r['nameRawJp'],
            skillId=r['skillId'], position='A', minPoints=r['points'], maxPoints=r['points'], slots=r['slots'],
            note='特殊赠送，第二技能为空。精确任务／对话触发条件未确认。')
        db.execute('INSERT INTO p3_skill_charm_sources VALUES(?,?,?)', (key, r['skillId'], encode(row)))


def build(base_file, native_dir, review_file, icon_probe, output, terminology_dir=None):
    base_file, output = Path(base_file), Path(output)
    if output.exists():
        raise ValueError('Output must be a new directory')
    inputs, review, systems, activations, icons = read_inputs(native_dir, review_file, icon_probe)
    names = armor_names(inputs['native-armor-contract.json']['armors'], review, terminology_dir)
    base_hash = digest(base_file.read_bytes())
    with sqlite3.connect(base_file.resolve().as_uri()+'?mode=ro', uri=True) as base:
        if base.execute("SELECT value FROM meta WHERE key='catalog_schema'").fetchone() != ('mhp3-items-v1',):
            raise ValueError('Expected the P3 item catalog')
        baseline = table_fingerprints(base)
        original_meta = dict(base.execute('SELECT key,value FROM meta'))
        jewel_terms = {s['id']: s for (raw,) in base.execute('SELECT decoration_json FROM catalog_items WHERE decoration_json IS NOT NULL') for s in json.loads(raw)['skills']}
        for id, term in jewel_terms.items():
            if any(systems[id][k] != term[k] for k in ('nameCn', 'nameEn')) or systems[id]['nameRawJp'] != term['nameJp']:
                raise ValueError('Existing decoration skill terminology changed')
        output.mkdir(parents=True)
        try:
            icon_paths = {}
            (output/'icons').mkdir()
            for key, icon in icons.items():
                png = base64.b64decode(icon['pngBase64'], validate=True)
                name = digest(png)+'.png'
                (output/'icons'/name).write_bytes(png)
                icon_paths[key] = '/assets/catalog/icons/'+name
            with sqlite3.connect(output/'mhp3.sqlite') as db:
                base.backup(db)
                db.execute('PRAGMA foreign_keys=OFF')
                for table in OWNED:
                    db.execute('DROP TABLE IF EXISTS '+table)
                db.executescript(SCHEMA)
                db.execute('PRAGMA defer_foreign_keys=ON')
                with db:
                    populate(db, inputs, review, systems, activations, icon_paths, names)
                    db.execute("INSERT OR REPLACE INTO meta VALUES('skill_schema','mhp3-skills-v1')")
                    db.execute("INSERT OR REPLACE INTO meta VALUES('skill_data_version',?)", (digest(Path(review_file).read_bytes()),))
                if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)] or db.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('Skill database integrity failed')
                if table_fingerprints(db) != baseline:
                    raise ValueError('Existing item business tables changed')
                meta = dict(db.execute('SELECT key,value FROM meta'))
                if any(meta[k] != v for k, v in original_meta.items() if k not in ('skill_schema', 'skill_data_version')):
                    raise ValueError('Original catalog metadata changed')
                counts = {table: db.execute('SELECT count(*) FROM '+table).fetchone()[0] for table in OWNED}
            if digest(base_file.read_bytes()) != base_hash:
                raise ValueError('Input database changed during build')
            report = dict(schema='mhp3-skills-v1', counts=counts, activations=len(activations),
                negativeActivations=sum(r['threshold'] < 0 for r in activations.values()), baseSha256=base_hash,
                unchangedItemTables=baseline, iconCombinations=len(icon_paths), databaseSha256=digest((output/'mhp3.sqlite').read_bytes()))
            (output/'audit.json').write_text(encode(report)+'\n')
            (output/'manifest.json').write_text(encode(dict(inputs=review['inputs'], reviewSha256=digest(Path(review_file).read_bytes()),
                databaseSha256=report['databaseSha256'], auditSha256=digest((output/'audit.json').read_bytes()),
                icons={p.name:digest(p.read_bytes()) for p in sorted((output/'icons').glob('*.png'))}))+'\n')
            return report
        except Exception as error:
            (output/'FAILED.txt').write_text(str(error)+'\n')
            raise


if __name__ == '__main__':
    print(encode(build(*sys.argv[1:])))
