#!/usr/bin/env python3
"""Join fixed private P2G inputs into a new, traceable monster snapshot."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import sqlite3
from mhp2g.monster_evidence import grid, bind_hitzones, reward_observations, ailment_observations, part_label


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def trap_rows(tables):
    labels = {'落とし穴':(0,'落穴'),'シビレ罠':(1,'麻痹陷阱'),'閃光玉':(2,'闪光弹'),
              '音爆弾':(3,'音爆弹'),'こやし玉':(4,'异臭球'),'肉類':(5,'肉类')}
    result = []
    for table in tables:
        if table['category'] != 'アイテム効果':
            continue
        for index, row in enumerate(grid(table)[1:], 1):
            if row[0] not in labels or len(row) < 2:
                continue
            trap_id, name = labels[row[0]]
            seconds = re.fullmatch(r'(\d+(?:\.\d+)?)秒', row[1].strip())
            effect = True if seconds or row[1] == '○' else False if row[1] in ['×','Ｘ'] else None
            enraged = re.search(r'怒り時(\d+(?:\.\d+)?)秒', row[2] if len(row) > 2 else '')
            result.append(dict(trapId=trap_id, nameCn=name, nameEn='', isEffective=effect,
                               duration=float(seconds[1]) if seconds else None,
                               durationEnraged=float(enraged[1]) if enraged else None,
                               durationFatigued=None, noteJp=row[2] if len(row) > 2 else '',
                               evidence=dict(table=table['key'], row=index, effect=row[1])))
    return result


def quest_rows(tables):
    result = []
    for table in tables:
        if table['category'] != '出現クエスト':
            continue
        rows = grid(table)
        if not rows or 'クエスト名' not in rows[0]:
            continue
        header = rows[0]
        name_column = header.index('クエスト名')
        for index, row in enumerate(rows[1:], 1):
            if not row[name_column].strip():
                continue
            result.append(dict(questKey=f"wiki:{table['key']}:{index}", nameJp=row[name_column],
                               fields=[dict(label=key, value=value) for key, value in zip(header, row)
                                       if key != 'クエスト名' and value],
                               evidence=dict(table=table['key'], row=index)))
    return result


def prepare(args):
    paths = {key: str(getattr(args, key)) for key in
             ['source','japanese','native','modes','observations','review','icons','parity']}
    if args.output.exists():
        raise ValueError('Output exists; refusing to overwrite')
    inputs = {key: json.loads(Path(file).read_text()) for key, file in paths.items() if key != 'source'}
    if sha(args.source) != '562516b93cd5efc5502dc5fba0961a8605ed6066db463dedc82a7888aa61291b':
        raise ValueError('Frozen r9 fingerprint mismatch')
    parity = inputs['parity']
    if parity.get('schema') != 'p2g-monster-source-parity-v1' or not parity.get('sameModules'):
        raise ValueError('Japanese/native source parity is not established')
    if len(parity['sources']) != 2 or any(s['checks'] != 2093 or s['mismatches'] for s in parity['sources']):
        raise ValueError('Incomplete Japanese/native parity audit')
    if any(s['moduleHashes']['51'] != inputs['modes']['moduleSha256'] for s in parity['sources']):
        raise ValueError('Additional mode source differs from parity audit')
    review, icons, observations = inputs['review'], inputs['icons'], inputs['observations']['tables']
    if review['schema'] != 'mhp2g-monster-name-review-v1' or icons['schema'] != 'mhp2g-monster-icons-v1':
        raise ValueError('Unsupported review or icon schema')
    source = sqlite3.connect(f'file:{args.source}?mode=ro', uri=True)
    source.row_factory = sqlite3.Row
    try:
        if source.execute('pragma integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Invalid native source database')
        by_id = {m['nativeId']: m for m in inputs['native']['monsters']}
        windows = {w['pointer']: w for w in inputs['modes']['windows']}
        names = {r['index'] - 103:r['text'] for t in inputs['japanese']['tables'] if t['tableId'] == 0
                 for r in t['rows'] if 103 <= r['index'] <= 192}
        items_jp = {r['itemId']:r['japanese'] for r in inputs['japanese']['items']}
        definitions = {d['monsterId']:d for d in icons['definitions']}
        icon_map = {m['monsterId']:definitions[m['iconMonsterId']] for m in icons['monsters']}
        if set(icon_map) != {m['monsterId'] for m in review['monsters']}:
            raise ValueError('Name and icon identity coverage disagree')
        pools = collections.defaultdict(list)
        for row in source.execute('select * from reward_items order by pool_key,ordinal'):
            pools[row['pool_key']].append(dict(row))
        monsters, audit = [], []
        rank_evidence = collections.defaultdict(collections.Counter)
        for reviewed in review['monsters']:
            mid = reviewed['monsterId']
            if reviewed['nameJp'] != names[mid]:
                raise ValueError(f'Japanese identity mismatch: {mid}')
            definition = by_id[mid]
            native_row = source.execute('select * from monster_definitions where monster_id=?', (mid,)).fetchone()
            if native_row['chunk_sha256'] != definition['chunkSha256']:
                raise ValueError('Native definition fingerprint mismatch')
            pointer = definition['hitzoneModes'][0]['pointerTableAddress']
            modes = windows[pointer]['candidates']
            if modes[0]['zoneAddress'] != definition['hitzoneModes'][0]['zoneAddress']:
                raise ValueError('First hitzone pointer differs from frozen native record')
            page = reviewed['wikiPage']
            tables = [t for t in observations if t['page_id'] == page]
            reference = review['hitzoneReferencePages'].get(str(page), page)
            meat = [t for t in observations if t['page_id'] == reference and t['category'] == '肉質']
            weakness = bind_hitzones(modes, meat)
            tolerances = [dict(r) for r in source.execute('select * from monster_tolerances where monster_id=?', (mid,))]
            ailments = ailment_observations(tables, tolerances)
            reward_cells = reward_observations(tables)
            links = [dict(r) for r in source.execute('select * from monster_rewards where monster_id=? order by link_id', (mid,))]
            part_candidates = collections.defaultdict(list)
            link_evidence = {}
            for link in links:
                pool = tuple(sorted(((items_jp[r['item_id']], r['amount'], float(r['chance']))
                                     for r in pools[link['pool_key']]), key=repr))
                category = '部位破壊報酬' if link['kind'] == 'break' else '捕獲報酬' if link['kind'] == 'capture' else '剥ぎ取り・落し物'
                hits = [r for r in reward_cells if r['pool'] == pool and r['category'] == category]
                link_evidence[link['link_id']] = [{k:v for k,v in h.items() if k != 'pool'} for h in hits]
                for header in {h['header'] for h in hits}:
                    rank_evidence[link['rank_slot']][header] += 1
                if link['kind'] == 'break' and hits:
                    part_candidates[link['part_code']].append({part_label(h['label']) for h in hits})
            parts = {}
            for code, candidates in part_candidates.items():
                intersection = set.intersection(*candidates)
                if len(intersection) == 1:
                    parts[code] = next(iter(intersection))
            drops = []
            for link in links:
                methods = {'body_carve':'本体剥取','tail_carve':'断尾剥取','capture':'捕获','shiny':'掉落物'}
                method = methods.get(link['kind'], '部位破坏')
                if link['kind'] == 'break':
                    method += ' · ' + parts.get(link['part_code'], f"未标注部位 {link['part_code']}")
                for reward in pools[link['pool_key']]:
                    drops.append(dict(linkId=link['link_id'], ordinal=reward['ordinal'], kind=link['kind'],
                                      partCode=link['part_code'], methodNameCn=method, rankSlot=link['rank_slot'],
                                      itemId=reward['item_id'], quantity=reward['amount'], probability=reward['chance'],
                                      evidence=dict(pool=link['pool_key'], matches=link_evidence[link['link_id']])))
            monsters.append(dict(**reviewed, iconPath=icon_map[mid]['path'], weakness=weakness,
                                  ailments=ailments, traps=trap_rows(tables), drops=drops, quests=quest_rows(tables)))
            audit.append(dict(monsterId=mid, zoneRows=len(weakness), namedParts=sum(bool(r['partNameJp']) for r in weakness),
                              namedStates=sum(not r['conditionCn'].startswith('未标注') for r in weakness),
                              drops=len(drops), confirmedBreakParts=parts))
        result = dict(schema='mhp2g-monster-evidence-v1', inputs={key:dict(path=file,sha256=sha(file)) for key,file in paths.items()},
                      monsters=monsters, excluded=review['excluded'], audit=audit,
                      rankEvidence={k:dict(v) for k,v in rank_evidence.items()})
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf8') as file:
            json.dump(result, file, ensure_ascii=False, indent=2)
            file.write('\n')
        return dict(monsters=len(monsters), zones=sum(r['zoneRows'] for r in audit),
                    namedParts=sum(r['namedParts'] for r in audit), drops=sum(r['drops'] for r in audit))
    finally:
        source.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source','japanese','native','modes','observations','review','icons','parity','output']:
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(prepare(parser.parse_args())))
