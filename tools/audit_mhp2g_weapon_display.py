"""Read-only cross-check of frozen native weapon fields and independent UI labels.

Output is private evidence; use an ignored working path or a research directory.
No host access, input rewriting or runtime installation.
"""
import argparse
import ast
import collections
import hashlib
import json
from pathlib import Path
import re


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--research-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = args.research_root
    review = root / 'weapon-catalog-v1/native-review-20261012'
    inputs = [review / 'derived-weapons.json', review / 'cross-validation.json', root / 'equipment-shop-observations-v1.json', root / 'remaining-catalog-observations-v1.json']
    derived, cross, first, remaining = [json.loads(p.read_text()) for p in inputs]
    weapons = {w['record_key']: w for w in derived['weapons']}
    pairs = {p['wikiKey']: p['equipmentKey'] for p in cross['matched']}
    observations = first['weapons'] + [w for w in remaining['rows'] if w['kind'] == 'weapon-display']
    labels = {k: collections.defaultdict(collections.Counter) for k in ['reload', 'recoil']}
    bows = []
    for observation in observations:
        weapon = weapons.get(pairs.get(observation['key']))
        if not weapon:
            continue
        fields = observation['fields']
        if weapon['class_id'] in [1, 5]:
            field = next((f for f in fields if f.get('header_raw', f.get('header', '')).replace('\n', '') == 'リロード反動'), None)
            if field and len(field['text'].splitlines()) >= 2:
                reload, recoil = field['text'].splitlines()[:2]
                labels['reload'][weapon['reload_raw']][reload] += 1
                labels['recoil'][weapon['recoil_charge_raw']][recoil] += 1
        elif weapon['class_id'] == 10:
            field = next((f for f in fields if f.get('header', f.get('header_raw')) == 'ビン'), None)
            if field:
                bows.append((weapon['ammo_coating_mask_raw'], field['text']))
    expected = {'reload': {0: '遅い', 1: 'やや遅い', 2: '普通', 3: 'やや速い', 4: '速い'}, 'recoil': {2: '中', 3: 'やや小', 4: '小', 5: '極小'}}
    chinese = {'遅い': '慢', 'やや遅い': '稍慢', '普通': '普通', 'やや速い': '稍快', '速い': '快', '中': '中', 'やや小': '稍小', '小': '小', '極小': '极小'}
    presentation = Path(__file__).resolve().parent.parent / 'api/catalog/p2gWeaponPresentation.ts'
    source = presentation.read_text()
    for name, mapping in expected.items():
        assert {raw: set(counts) for raw, counts in labels[name].items()} == {raw: {label} for raw, label in mapping.items()}
        assert sum(sum(v.values()) for v in labels[name].values()) == 233
        export = 'p2gReloadLabels' if name == 'reload' else 'p2gRecoilLabels'
        actual = ast.literal_eval(re.search(export + r'[^=]*= (\{[^\n]*\})', source)[1])
        assert actual == {raw: chinese[label] for raw, label in mapping.items()}
    assert len(bows) == 104
    for symbol, bit in [('強', 1), ('毒', 2), ('麻', 3), ('睡', 4), ('接', 5), ('ペ', 6)]:
        assert all(bool(mask & (1 << bit)) == (symbol in text) for mask, text in bows)
    report = {'status': 'passed', 'bowObservations': len(bows), 'bowCoatingComparisons': len(bows) * 6,
              'rangedLabelObservations': 233, 'labelCounts': {k: {raw: dict(v) for raw, v in rows.items()} for k, rows in labels.items()},
              'inputs': {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs + [presentation]},
              'limits': ['Existing explicit native/Wiki observation bindings are reused; no names or row positions create new weapon identities.', 'Horn timing, repeat states and skill modifiers are outside this check.']}
    assert not args.output.exists(), 'Refusing to overwrite existing audit'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'rangedLabels': 233, 'coatingComparisons': 624}))


if __name__ == '__main__':
    main()
