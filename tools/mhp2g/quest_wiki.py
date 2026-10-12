"""Strict P2G Wiki joins. Missing cells remain unknown, never zero-filled."""
import re
import unicodedata
from collections import defaultdict


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKC', value).casefold() if c.isalnum())


def fields(row):
    return {f['header_raw'].replace('\n', ''): f['text'] for f in row['fields']}


def wiki_monsters(text, monsters):
    # Native names are shared by variants: these are explicit Wiki variant labels.
    overrides = {('亜種', 1): 37, ('亜種', 6): 38, ('亜種', 20): 39, ('希少種', 11): 41,
                 ('希少種', 1): 42, ('亜種', 14): 43, ('亜種', 26): 44, ('亜種', 15): 45,
                 ('亜種', 21): 46, ('亜種', 17): 47, ('亜種', 11): 49, ('亜種', 7): 50,
                 ('亜種', 51): 84, ('亜種', 52): 85, ('亜種', 48): 86, ('亜種', 67): 87}
    base = {}
    for mid, m in monsters.items():
        base.setdefault(m['name_jp'], mid)
    names = sorted(base, key=len, reverse=True)
    result = []
    for line in unicodedata.normalize('NFKC', text).splitlines():
        line = line.strip()
        if not line or re.fullmatch(r'[?？]?\d+[頭匹]|複数', line):
            continue
        name = next((n for n in names if line.startswith(n)), None)
        if name is None:
            raise ValueError(f'Unmapped Wiki monster: {line}')
        mid = base[name]
        if mid == 40:
            mid = 78 if '両耳' in line else 40
        elif mid == 2:
            mid = 71 if '祖龍' in line else 36 if '紅' in line else 2
        elif mid == 53 and '激昂' in line:
            mid = 89
        elif '亜種' in line or '希少種' in line:
            mid = overrides[('希少種' if '希少種' in line else '亜種', mid)]
        result.append(mid)
    return result


def wiki_rewards(row, links, corrections, items):
    by_name = defaultdict(list)
    for iid, item in items.items():
        by_name[norm(item['name_jp'])].append(iid)
    cells = [f for f in row['fields'] if '報酬' in f['header_raw'] and '契約金' not in f['header_raw']]
    assert len(cells) in (0, 2), ('Unexpected reward cells', row['key'])
    if not cells:
        return []
    rates, names = [c['text'].splitlines() for c in cells]
    lines = {r['line_index']: r for r in links if r['cell_key'].endswith(':' + str(cells[1]['column']))}
    if all(rate in ('', '？%', '?%', '%') for rate in rates):
        rates = [''] * len(names)
    assert len(rates) == len(names), ('Unpaired reward columns', row['key'], len(rates), len(names))
    rewards = []
    for i, (rate, name) in enumerate(zip(rates, names)):
        if not name.strip():
            continue
        line = lines[i]
        iid = corrections.get(line['key'], line['native_item_id'])
        if iid is None:
            candidates = by_name[norm(line['candidate_name'])]
            assert len(candidates) == 1, ('Ambiguous item', row['key'], name, candidates)
            iid = candidates[0]
        assert iid in items
        probability = float(rate[:-1]) if re.fullmatch(r'\d+(?:\.\d+)?%', rate) else None
        assert probability is not None or rate in ('確', '%', '？%', '?%', '', '-'), ('Unknown rate', rate)
        rewards.append({'itemId': iid, 'quantity': line['explicit_quantity_wiki'], 'probability': probability,
                        'guaranteed': True if rate == '確' else None, 'sourceKey': line['key']})
    return rewards


def migrate_monster_quests(monsters, quests, decisions):
    """Disambiguate by title AND system/rank/star/actor; retain every source record."""
    migrated, unresolved = [], []
    for mid, monster in monsters.items():
        for ordinal, old in enumerate(monster['detail']['p2gQuests']):
            fields_by_label = defaultdict(list)
            for f in old['fields']:
                fields_by_label[f['label']].append(f['value'])
            context = ' '.join(fields_by_label['区分'])
            system = next((key for label, key in [('イベント', 'event'), ('チャレンジ', 'challenge'), ('トレジャー', 'treasure'),
                           ('村長', 'village'), ('訓練', 'training'), ('集会所', 'guild')] if label in context), None)
            rank = next((key for label, key in [('下位', 'low'), ('上位', 'high'), ('G級', 'g'), ('G', 'g')] if label in context), None)
            star = re.search(r'★\s*(\d+)', ''.join(fields_by_label['難度']))
            candidates = [q for q in quests if norm(q['nameJp']) == norm(old['nameJp'])]
            if system:
                candidates = [q for q in candidates if q['systemKey'] == system]
            if rank and system != 'training':
                candidates = [q for q in candidates if q['rank'] == rank]
            if star:
                candidates = [q for q in candidates if q['star'] == int(star[1])]
            if len(candidates) > 1:
                candidates = [q for q in candidates if mid in q['monsterIds']]
            decision = decisions.get(old['questKey'])
            if decision:
                target = decision['questKey']
                assert target is None or any(q['questKey'] == target for q in quests)
                basis = decision['basis']
            elif len(candidates) == 1:
                target, basis = candidates[0]['questKey'], '日文标题＋体系／位阶／星级／配置怪物交叉核对'
            else:
                unresolved.append({'monsterId': mid, **old, 'candidates': [q['questKey'] for q in candidates]})
                continue
            migrated.append({'monsterId': mid, 'ordinal': ordinal, 'sourceKey': old['questKey'], 'questKey': target,
                             'nameJp': old['nameJp'], 'fields': old['fields'], 'basis': basis})
    return migrated, unresolved
