"""Conservative joins between native P2G data and fixed Japanese observations.

All identities and page bindings are explicit private review inputs. These
helpers never join monsters by English, zip physical table columns, or replace
native numbers with a conflicting Wiki observation.
"""
import re

ZONE_FIELDS = ('cut', 'impact', 'shot', 'fire', 'water', 'ice', 'thunder', 'dragon', 'stun')
ZONE_HEADERS = {'斬撃': 'cut', '打撃': 'impact', '射撃': 'shot', '火': 'fire', '水': 'water',
                '雷': 'thunder', '氷': 'ice', '龍': 'dragon', '気絶': 'stun'}
PARTS = {'全身':'全身','頭':'头部','頭部':'头部','顔':'脸部','顔面':'脸部','首':'颈部','背':'背部',
         '背中':'背部','背体':'背部','腹':'腹部','腹体':'腹部','胴体':'躯干','胸':'胸部','腰':'腰部',
         '尻尾':'尾巴','翼':'翅膀','翼膜':'翼膜','翼爪':'翼爪','爪':'爪','脚':'腿部','足':'腿部',
         '前足':'前腿','前脚':'前腿','後足':'后腿','後脚':'后腿','両前足':'双前腿','腕':'手臂',
         '角':'角','左角':'左角','右角':'右角','牙':'牙','耳':'耳朵','トサカ':'头冠','嘴':'喙',
         'クチバシ':'喙','眼':'眼睛','目':'眼睛','口':'口部','触角':'触须','触手':'触手','上部':'上部',
         'ヒレ':'鱼鳍','背ビレ':'背鳍','肩':'肩部','左肩':'左肩','右肩':'右肩','鋏':'螯','ハサミ':'螯',
         'ヤド':'背壳','脚苔':'腿部苔藓','弱点':'弱点','胸→腹':'胸部→腹部'}
STATES = {'通常時':'通常','怒り時':'愤怒时','腹破壊前':'腹部破坏前','腹破壊後':'腹部破坏后',
          'ガード時':'防御时','ヤド破壊後':'背壳破坏后','炎を纏っている時':'缠绕火焰时',
          '風を纏っている時':'缠绕风压时','透明状態時':'隐身时','硬化時':'硬化时',
          '破壊前':'破坏前','破壊後':'破坏后'}


def grid(table):
    cells = table['expanded_cells']
    if not cells:
        return []
    rows = [[''] * (1 + max(c['logical_column'] for c in cells))
            for _ in range(1 + max(c['logical_row'] for c in cells))]
    seen = set()
    for cell in cells:
        coordinate = cell['logical_row'], cell['logical_column']
        if coordinate in seen:
            raise ValueError('Duplicate logical table cell')
        seen.add(coordinate)
        rows[coordinate[0]][coordinate[1]] = cell['text']
    return rows


def part_label(japanese):
    first = japanese.split('\n')[0]
    extra = {'弱点(体内)':'弱点（体内）','弱点(ヤドの中)':'弱点（背壳内）',
             'ヤド(巻貝)':'背壳（卷贝）','ヤド(竜頭)':'背壳（龙头）','ヤド(鎧竜)':'背壳（铠龙）',
             '顔(顎)':'脸部（下颚）'}
    if first in extra:
        return extra[first]
    first = re.sub(r'\(.*?\)|（.*?）', '', first)
    tokens = re.split('([/、+])', first)
    return ''.join({'/':'／','、':'、','+':'＋'}.get(token, PARTS.get(token, token)) for token in tokens)


def meat_rows(table):
    rows = grid(table)
    if not rows:
        return []
    columns = {ZONE_HEADERS[value]: i for i, value in enumerate(rows[0]) if value in ZONE_HEADERS}
    if set(columns) != set(ZONE_FIELDS):
        return []
    result = []
    for ordinal, row in enumerate(rows[1:], 1):
        values = [row[columns[field]].strip() for field in ZONE_FIELDS]
        if not all(re.fullmatch(r'\d+', value) for value in values):
            continue
        result.append(dict(name=row[0], values=tuple(map(int, values)), row=ordinal, table=table['key']))
    return result


def bind_hitzones(candidates, tables):
    result = []
    parsed = [(table, meat_rows(table)) for table in tables]
    for candidate in candidates:
        ordinal = candidate['pointerOrdinal']
        native = [tuple(row[1:]) for row in candidate['rows']]
        scored = []
        for table, rows in parsed:
            fingerprints = {row['values'] for row in rows}
            score = len(set(native).intersection(fingerprints))
            if score and score * 2 >= len(fingerprints):
                scored.append((score, table, rows))
        best_score = max((score for score, _, _ in scored), default=0)
        best = [(table, rows) for score, table, rows in scored if score == best_score]
        for part, values in enumerate(native):
            hits = [row for _, rows in best for row in rows if row['values'] == values]
            labels = {row['name'] for row in hits}
            headings = {table['heading_path'][-1]['text'] for table, _ in best}
            label = next(iter(labels)) if len(labels) == 1 else None
            state = next(iter(headings)) if len(headings) == 1 else None
            # An unqualified Wiki row confirms numeric values, not a state name.
            condition = STATES.get(state, None)
            if label:
                suffix = re.search(r'\((通常時|怒り時|破壊前|破壊後)\)', label)
                if suffix:
                    condition = STATES[suffix[1]]
            result.append(dict(modeOrdinal=ordinal, partOrdinal=part,
                               partNameCn=part_label(label) if label else f'未标注部位 {part + 1}',
                               partNameJp=label or '', conditionCn=condition or f'未标注状态 {ordinal + 1}',
                               **dict(zip(ZONE_FIELDS, values)),
                               evidence=dict(zoneAddress=candidate['zoneAddress'], zoneSha256=candidate['sha256'],
                                             matches=hits, stateHeadings=sorted(headings))))
    return result


def reward_cell(text):
    """Parse an entire pool; partial parses cannot establish part/rank identity."""
    rows = []
    for line in text.strip().splitlines():
        match = re.fullmatch(r'\s*(.+?)(?:[×x](\d+))?\s*[（(](\d+(?:\.\d+)?)\s*[%％][)）]\s*', line)
        if not match:
            return None
        name, amount, chance = match.groups()
        rows.append((name.strip(), int(amount) if amount else None, float(chance)))
    return tuple(sorted(rows, key=repr)) if rows else None


def reward_observations(tables):
    result = []
    for table in tables:
        category = table['category']
        if category not in ['剥ぎ取り・落し物', '部位破壊報酬', '捕獲報酬']:
            continue
        rows = grid(table)
        for ri, row in enumerate(rows[1:], 1):
            for ci, text in enumerate(row):
                pool = reward_cell(text)
                if pool:
                    result.append(dict(pool=pool, label=row[0], header=rows[0][ci],
                                       category=category, table=table['key'], row=ri, column=ci))
    return result


def ailment_observations(tables, native):
    names = {'毒':('poison','毒'),'麻痺':('paralysis','麻痹'),'睡眠':('sleep','睡眠'),'気絶':('ko','眩晕')}
    result = []
    by_kind = {row['kind']: row for row in native}
    observations = {}
    for table in tables:
        if table['category'] != '属性攻撃効果':
            continue
        rows = grid(table)
        if len(rows) != 2:
            continue
        for index, header in enumerate(rows[0]):
            if header in names:
                observations[names[header][0]] = (rows[1][index].splitlines(), table['key'])
    for status_id, (kind, name) in enumerate(names.values()):
        row = by_kind[kind]
        observed, key = observations.get(kind, ([], None))
        initial, increase = row['initial_raw'], row['increase_raw']
        maximum = duration = damage = None
        evidence = dict(nativeKind=kind, wikiTable=key, comparisons=[])
        applicable = None
        if len(observed) >= 4:
            initial_match = re.fullmatch(r'\d+', observed[0])
            increase_match = re.fullmatch(r'(\d+)\((\d+)\)', observed[1])
            if initial_match and increase_match and int(observed[0]) == initial and int(increase_match[1]) == increase:
                maximum = int(increase_match[2])
                applicable = True
                evidence['comparisons'].append('initial-and-increase')
                seconds = re.fullmatch(r'(\d+(?:\.\d+)?)秒', observed[3])
                raw_time = row['poison_total_time_raw'] if kind == 'poison' else row['duration_raw']
                if seconds and raw_time == float(seconds[1]) * 30:
                    duration = float(seconds[1])
                    evidence['comparisons'].append('duration-at-30-ticks-per-second')
                if kind == 'poison' and len(observed) >= 5 and re.fullmatch(r'\d+', observed[4]):
                    tick, total, interval = row['poison_damage_raw'], row['poison_total_time_raw'], row['poison_per_sec_raw']
                    if interval and tick * total == int(observed[4]) * interval:
                        damage = int(observed[4])
                        evidence['comparisons'].append('total-poison-damage')
            elif initial == 65535 and observed[0] in ['-', '－', '―']:
                applicable = False
        result.append(dict(statusId=status_id, nameCn=name, nameEn=kind,
                           toleranceInitial=initial if initial != 65535 else None,
                           toleranceIncrease=increase if initial != 65535 else None,
                           toleranceMax=maximum, duration=duration, damage=damage,
                           applicable=applicable, evidence=evidence))
    return result
