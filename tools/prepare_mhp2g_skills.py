#!/usr/bin/env python3
"""Prepare P2G skill evidence from frozen private sources and explicit reviews."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import sqlite3
import struct


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(source, review_file):
    manifest = json.loads((source / 'manifest.json').read_text())
    assert manifest['schema'] == 'mhp2g-skill-input-v1'
    for name, value in manifest['files'].items():
        path = source / name
        assert path.parent == source and sha(path) == value['sha256'] and path.stat().st_size == value['bytes'], name
    review = json.loads(review_file.read_text())
    assert review['schema'] == 'mhp2g-skill-review-v1'
    for name, expected in review['inputs'].items():
        assert sha(source / name) == expected, f'Review input changed: {name}'
    load = lambda name: json.loads((source / name).read_text())
    japanese, localization, native = load('japanese.json'), load('localization.json'), load('native-tables.json')
    assert japanese['boot']['sha256'] == native['bootSha256']
    jp = {(t['tableId'], r['index']): r['text'] for t in japanese['tables'] for r in t['rows']}
    db = sqlite3.connect((source / 'pilot.sqlite').resolve().as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    runtime = sqlite3.connect((source / 'base.sqlite').resolve().as_uri() + '?mode=ro', uri=True)
    runtime.row_factory = sqlite3.Row
    try:
        items = {r['item_id']: dict(r) for r in runtime.execute('SELECT * FROM catalog_items')}
        tables = {t['name']: base64.b64decode(t['bytesBase64']) for t in native['tables']}
        skill_bytes = tables['decoration_skill_boundary'][16:32] + tables['decoration_skills']
        assert len(skill_bytes) == 170 * 16
        reviewed_trees = {r['skillId']: r for r in review['trees']}
        reviewed_rules = {r['key']: r for r in review['rules']}
        assert len(reviewed_trees) == len(review['trees']) == 99
        assert len(reviewed_rules) == len(review['rules']) == 214
        skills = {}
        for row in db.execute('SELECT * FROM skill_name_crosswalk ORDER BY skill_id'):
            sid = row['skill_id']; decision = reviewed_trees[sid]
            assert decision['status'] == 'reviewed' and decision['japanese'] == jp[row['text_table'], row['text_index']]
            assert decision['nameCn']
            skills[sid] = dict(skillId=sid, nameCn=decision['nameCn'], nameJp=decision['japanese'], nameSource=decision['nameSource'], activations=[], specialRule=None)
        activation_names = {jp[r['text_table'], r['text_index']]: r['ordinal'] for r in db.execute('SELECT * FROM activated_skill_names')}
        assert len(activation_names) == 218
        observed_wiki = {r['key']: r for r in load('wiki.json')['rows']}
        ordinal_to_tree = {}
        for row in db.execute('SELECT * FROM wiki_skill_observations ORDER BY tree_id,threshold DESC'):
            sid, key = row['tree_id'], row['observation_key']; decision = reviewed_rules[key]; raw = observed_wiki[key]
            assert raw['tree_ja'] == skills[sid]['nameJp'] and raw['effect_ja'] == row['effect_ja'] and raw['threshold'] == row['threshold']
            assert decision['status'] == 'reviewed' and decision['effectJp'] == row['effect_ja'] and decision['effectCn']
            if row['kind'] == 'torso-copy-special':
                assert sid == 1 and row['threshold'] is None
                skills[sid]['specialRule'] = dict(descriptionCn=decision['effectCn'], descriptionJp=row['effect_ja'], sourceKey=key)
                continue
            assert decision['japanese'] == row['activation_ja'] and decision['nameCn']
            ordinal = activation_names[row['activation_ja']]
            assert ordinal not in ordinal_to_tree and ordinal not in (0, 30, 37, 43, 138)
            ordinal_to_tree[ordinal] = sid
            skills[sid]['activations'].append(dict(nativeTextOrdinal=ordinal, activationKey=f'mhp2g:a{ordinal}', nameCn=decision['nameCn'], nameJp=row['activation_ja'], nameSource=decision['nameSource'], threshold=row['threshold'], direction='positive' if row['threshold'] > 0 else 'negative', descriptionCn=decision['effectCn'], descriptionJp=row['effect_ja'], sourceKey=key, components=[]))
        activations = {a['nativeTextOrdinal']: a for s in skills.values() for a in s['activations']}
        assert len(activations) == 213
        for ordinal, components in review['components'].items():
            activation = activations[int(ordinal)]
            # A reviewed component must also appear explicitly in the original Wiki effect.
            for child in components:
                part = activations[child]
                assert f'「{part["nameJp"]}」' in activation['descriptionJp']
                activation['components'].append(dict(activationKey=part['activationKey'], skillId=ordinal_to_tree[child], nameCn=part['nameCn'], nameJp=part['nameJp'], direction=part['direction']))
        equipment = []
        point_rows = {}
        for row in db.execute('SELECT * FROM skill_points ORDER BY owner_key,position'):
            assert row['skill_id'] in skills
            point_rows.setdefault(row['owner_key'], []).append(dict(skillId=row['skill_id'], points=row['points']))
        for row in db.execute('SELECT a.*,r.native_index,r.is_dummy FROM armor a JOIN records r USING(record_key) ORDER BY r.record_key'):
            key = row['record_key']; raw = tables[key.split(':')[0]][row['native_index'] * 40:(row['native_index'] + 1) * 40]
            expected = [dict(skillId=raw[30+2*i], points=struct.unpack_from('b', raw, 31+2*i)[0]) for i in range(5) if raw[30+2*i]]
            assert point_rows.get(key, []) == expected and row['slots'] == raw[18]
            binding = localization['bindings'][key]; unit = localization['units'][binding['name']]
            equipment.append(dict(equipmentKey=key, kind='armor', sourceKey=key, nameCn=unit['chinese'] or unit['japanese'], nameJp=unit['japanese'], nameSource='GU 官方简中' if unit['chinese'] else '日文原名', part=row['part'], slots=row['slots'], iconPath=None, itemId=None, isPlaceholder=bool(row['is_dummy']), skills=expected, recipes=[]))
        crafting = load('native-crafting.json')
        assert crafting['bootSha256'] == native['bootSha256']
        windows = [(t['fileOffset'] + 0x08801A4C, base64.b64decode(t['bytesBase64'])) for t in crafting['tables']]
        for row in db.execute('SELECT d.*,c.item_id,s.slots FROM decorations d JOIN decoration_item_crosswalk c USING(record_key) JOIN decoration_skill_sets s ON s.native_index=d.skill_set_index ORDER BY c.item_id'):
            iid = row['item_id']; raw = skill_bytes[row['skill_set_index'] * 16:(row['skill_set_index'] + 1) * 16]
            expected = [dict(skillId=raw[8+2*i], points=struct.unpack_from('b', raw, 9+2*i)[0]) for i in range(3) if raw[8+2*i]]
            assert row['slots'] == raw[0] and expected == point_rows.get(f'decoration_skill_sets:{row["skill_set_index"]}', [])
            item = items[iid]; recipes = []
            for recipe in db.execute("SELECT * FROM creation_recipes WHERE group_name='decoration' AND target_item_id=? ORDER BY group_ordinal", (iid,)):
                chunks = [data[recipe['virtual_address']-start:recipe['virtual_address']-start+26] for start, data in windows if start <= recipe['virtual_address'] and recipe['virtual_address'] + 26 <= start + len(data)]
                assert chunks and hashlib.sha256(chunks[0]).hexdigest() == recipe['row_sha256']
                mats = [dict(itemId=r['item_id'], quantity=r['quantity']) for r in db.execute('SELECT * FROM creation_materials WHERE recipe_key=? ORDER BY position', (recipe['recipe_key'],))]
                raw_recipe = chunks[0]
                assert raw_recipe[0] == 0 and struct.unpack_from('<H', raw_recipe, 2)[0] == iid
                native_mats = [dict(itemId=struct.unpack_from('<H', raw_recipe, 4+i*4)[0], quantity=struct.unpack_from('<H', raw_recipe, 6+i*4)[0]) for i in range(4) if struct.unpack_from('<H', raw_recipe, 4+i*4)[0]]
                assert mats == native_mats, 'Native material content mismatch'
                assert all(m['itemId'] in items and m['quantity'] > 0 for m in mats)
                recipes.append(dict(recipeKey=recipe['recipe_key'], materials=mats))
            equipment.append(dict(equipmentKey=f'item:{iid}', kind='decoration', sourceKey=row['record_key'], nameCn=item['name_cn'], nameJp=item['name_jp'], nameSource='沿用道具译名', part=None, slots=row['slots'], iconPath=item['icon_path'], itemId=iid, isPlaceholder=False, skills=expected, recipes=recipes))
        assert len(equipment) == 2264
        return dict(schema='mhp2g-skill-evidence-v1', inputs={**{k:v['sha256'] for k,v in manifest['files'].items()}, 'review':sha(review_file)}, sourceUrl=load('wiki-source.json')['url'], skills=list(skills.values()), equipment=equipment, excludedNativeTextOrdinals=[0,30,37,43,138])
    finally:
        db.close(); runtime.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--input', type=Path, required=True); parser.add_argument('--review', type=Path, required=True); parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(); assert not args.output.exists(), 'Refuse existing output'
    result = prepare(args.input, args.review)
    with args.output.open('x') as handle: json.dump(result, handle, ensure_ascii=False, indent=2); handle.write('\n')
    print(json.dumps({'skills':len(result['skills']), 'equipment':len(result['equipment'])}))
