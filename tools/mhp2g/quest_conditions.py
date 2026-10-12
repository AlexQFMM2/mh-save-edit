"""Translate audited symbolic paths into a display AST, preserving Boolean structure."""
import json


def combine(kind, children):
    identity = kind == 'all'
    out = []
    for child in children:
        if child is (not identity):
            return not identity
        if child is identity:
            continue
        out.extend(child['children'] if isinstance(child, dict) and child.get('kind') == kind and not child.get('text') else [child])
    unique = list({json.dumps(c, sort_keys=True): c for c in out}.values())
    if not unique:
        return identity
    return unique[0] if len(unique) == 1 else {'kind': kind, 'children': unique}


def negate(node):
    if isinstance(node, bool):
        return not node
    if node['kind'] == 'not':
        return node['children'][0]
    return {'kind': 'not', 'children': [node]}


def atom(text, **fields):
    return {'kind': 'condition', 'text': text, **fields}


class Conditions:
    def __init__(self, read, catalog, monsters):
        self.read, self.catalog, self.monsters = read, catalog, monsters
        self.paths = read('derived-condition-paths')['scenarioRules']
        self.events = read('native-event-rules-v1')
        tables = read('special-unlock-tables')['results']
        helpers = read('condition-helper-data')['results']
        self.sets = []
        for ptr, length in zip(helpers[0]['values'], helpers[1]['values']):
            self.sets.append(next(r['values'] for r in tables if r['query']['start'] == ptr and len(r.get('values', [])) == length))
        self.species = helpers[2]['values']

    def quest(self, qid, text='完成任务'):
        return atom('任意一种武器完成训练' if text == '完成任务' and 21001 <= qid <= 21023 else text, questKey=f'mhp2g:q{qid}')

    def flag(self, flag):
        for row in self.events['inheritedFlags']:
            if row['flag'] != flag:
                continue
            if 'questIds' in row:
                return {'kind': 'all', 'text': '继承 P2 旧存档时，下列旧任务已经全部完成',
                        'children': [self.quest(q, '旧档已完成') for q in row['questIds']]}
            return atom('继承 P2 旧存档时，七个指定古龙家族各狩猎至少 10 次（包含捕获）',
                        monsterIds=row['monsterFamilyIds'], minimum=10, scope='inherited-save')
        for row in self.events['introFlags']:
            if row['flag'] == flag:
                return self.quest(row['sourceQuestId'], '结束或跳过怪物介绍事件（不要求完成任务）')
        kills = {211: (2, '上位'), 212: (36, '上位'), 213: (54, 'G 级'), 214: (65, 'G 级'),
                 215: (59, 'G 级'), 216: (2, 'G 级'), 217: (36, 'G 级')}
        if flag in kills:
            mid, rank = kills[flag]
            return atom(f'曾讨伐{rank}{self.monsters[mid]["name_cn"]}', monsterIds=[mid])
        if flag in {*range(53, 60), *range(66, 81), 91, 430, 431, 432, *range(434, 447)}:
            return atom('当前处于此任务的随机／轮换显示状态', rotationFlag=flag)
        raise ValueError(f'Unknown flag: {flag}')

    def call(self, address, args):
        if address == '0x884fdc4':
            return self.quest(args[0])
        if address == '0x884fa7c':
            return self.flag(args[0])
        if address == '0x9c14800':
            return self.paths_for(self.paths[str(args[0])], 1)
        if address == '0x884ff88':
            return atom(f'该怪物家族累计狩猎至少 {args[1]} 次（包含捕获）', monsterIds=[args[0]], minimum=args[1])
        if address == '0x9c15cb0':
            return combine('all', [self.quest(q) for q in self.sets[args[0]]])
        if address in ('0x9c15b80', '0x9c15c18'):
            lower = address == '0x9c15b80'
            rows = [int(q) for q, c in self.catalog['categories'].items()
                    if c['system'] == 'village' and c['tier'] == ('lower' if lower else 'upper') and int(q) != (10510 if lower else 11226)]
            return {'kind': 'all', 'text': '完成全部村下位任务（本任务除外）' if lower else '完成全部村上位任务（本任务除外）',
                    'children': [self.quest(q) for q in rows]}
        if address == '0x9c15d40':
            return atom('以下指定怪物的累计狩猎数合计至少 100 次（包含捕获）', monsterIds=self.species[:16], minimum=100)
        if address == '0x9c15db8':
            return combine('all', [atom(f'各家族狩猎至少 {count} 次（包含捕获）', monsterIds=ids, minimum=count)
                                   for ids, count in [(self.species[16:19], 3), (self.species[24:28], 5)]])
        raise ValueError(f'Unknown call: {address} {args}')

    def expression(self, expr):
        if isinstance(expr, int):
            return bool(expr)
        op, *args = expr
        if op == 'call':
            return self.call(args[0], args[1:])
        if op == 'xor' and args[1] == 1:
            return negate(self.expression(args[0]))
        if op == 'eq' and isinstance(args[1], int) and args[1] in (0, 1):
            node = self.expression(args[0])
            return node if args[1] else negate(node)
        if op == 'sltu' and args[0] == 0:
            return self.expression(args[1])
        if op == 'sltu' and args[0] == ['load', 'lw', 431852]:
            return negate(atom(f'公会点数至少 {args[1]} 点', minimum=args[1]))
        raise ValueError(f'Unknown expression: {expr}')

    def paths_for(self, paths, expected):
        branches = []
        for path in paths:
            result = path['result']
            if isinstance(result, int):
                if result != expected:
                    continue
                condition = True
            else:
                condition = self.expression(result)
                if expected == 0:
                    condition = negate(condition)
            branches.append(combine('all', [self.expression(e) if truth else negate(self.expression(e))
                                            for e, truth in path['conditions']] + [condition]))
        return combine('any', branches)

    def task(self, qid):
        paths = self.read('derived-condition-paths')['taskRules'][str(qid)]
        if len(paths) == 1 and paths[0]['result'] == 2:
            return atom('无额外特殊显示条件；仍需达到对应任务等级及进度')
        node = self.paths_for(paths, 0)
        if node is False and qid in self.catalog['urgent']:
            return atom('由紧急任务入口提供，不在普通任务菜单中显示；需满足对应阶段的关键任务进度')
        assert not isinstance(node, bool), ('Unexpected static menu result', qid, node)
        return node

    def training(self, node):
        kind = node['kind']
        if kind == 'all':
            return combine('all', [self.training(n) for n in node['requirements']])
        if kind == 'always-in-training-menu':
            return atom('训练菜单初始开放')
        if kind in ('returned-from-quest', 'training-cleared-with-any-weapon', 'quest-completed'):
            text = {'returned-from-quest': '承接后返回（可放弃，不要求完成）',
                    'training-cleared-with-any-weapon': '任意一种武器完成训练', 'quest-completed': '完成任务'}[kind]
            return self.quest(node['questId'], text)
        if kind in ('family-hunt-count', 'exact-monster-hunt-count'):
            return atom(f'{"该家族" if kind == "family-hunt-count" else "该怪物"}狩猎至少 {node["minimum"]} 次（包含捕获）',
                        monsterIds=[node['monsterId']], minimum=node['minimum'])
        raise ValueError(f'Unknown training condition {node}')
