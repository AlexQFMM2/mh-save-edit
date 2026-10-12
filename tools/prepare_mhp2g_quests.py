#!/usr/bin/env python3
"""Prepare the quest catalog exclusively from frozen, hashed research inputs."""
import argparse
import hashlib
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path
from mhp2g.quest_conditions import Conditions, atom, combine
from mhp2g.quest_wiki import fields, norm, wiki_monsters, wiki_rewards, migrate_monster_quests


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(root, review_file, notes_file, decisions_file):
    read_json = lambda p: json.loads(p.read_text())
    manifest = read_json(root / 'manifest.json')
    for f in manifest['files']:
        path = (root / f['path']).resolve()
        assert path.is_relative_to(root.resolve()), 'Input path escapes snapshot'
        assert digest(path) == f['sha256'], f'Input hash mismatch: {f["path"]}'
    cache = {}
    def follow(name):
        if name not in cache:
            cache[name] = read_json(root / 'evidence/p2g-quest-followup-20261012' / (name + '.json'))
        return cache[name]
    audit = follow('catalog-audit-v2')
    review = read_json(review_file)
    assert all(u['status'] in ('reviewed', 'official') and u['chinese'].strip() for u in review['units'].values())
    notes = read_json(notes_file)
    con = sqlite3.connect(f'file:{root / "base.sqlite"}?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    monsters = {r['monster_id']: {**dict(r), 'detail': json.loads(r['detail_json'])} for r in con.execute('SELECT * FROM catalog_monsters')}
    items = {r['item_id']: dict(r) for r in con.execute('SELECT * FROM catalog_items')}
    rules = Conditions(follow, audit, monsters)
    missions = {r['questId']: r for r in read_json(root / 'evidence/p2g-quest-preflight-20261012/missions-all.json')['records']}
    large = {r['questId']: r['largeMonsterSections'] for r in follow('mission-spawn-parameters-v2')['records']}
    small = {r['questId']: r['smallMonsterGroups'] for r in follow('mission-small-monsters-v2')['records']}
    spawn = {r['questId']: r for r in follow('spawn-group-rules-v1')['quests']}
    waits = {r['questId']: r for r in follow('spawn-group-rules-v1')['specialWaits']}
    reward_rules = {(r['questId'], r['ordinal']): r for r in follow('reward-rules-v3')['groups']}
    training = follow('training-rules')
    training_rules = {r['flagIndex']: r['condition'] for r in training['rules']}
    training = {r['questId']: r.get('condition') or training_rules[r['flagIndex']] for r in training['bindings']}
    major_wiki = {r['key']: r for r in read_json(root / 'quest-observations-v1.json')['quests']}
    extra_wiki = {r['key']: r for r in read_json(root / 'remaining-catalog-observations-v1.json')['rows'] if r['kind'] == 'quest-summary'}
    joins = audit['majorJoins'] + audit['extraJoins']
    aliases = {f'wiki:{j["wikiKey"]}': f'mhp2g:q{j["questId"]}' for j in joins}
    join_by_id = {j['questId']: j for j in joins}
    map_cn = {1:'砦',2:'森丘（白天）',3:'沙漠（白天）',4:'沼地（白天）',5:'火山（白天）',6:'密林（白天）',7:'修雷德城',8:'决战场',9:'大斗技场',10:'斗技场',11:'雪山（白天）',12:'街',13:'塔3',14:'塔2',15:'塔',16:'森丘（夜晚）',17:'沙漠（夜晚）',18:'沼地（夜晚）',19:'火山（夜晚）',20:'密林（夜晚）',21:'雪山（夜晚）',22:'水上斗技场',23:'雪山深奥',26:'旧密林',27:'旧沙漠',28:'旧沼地',29:'旧火山',30:'树海（白天）',31:'树海（夜晚）'}
    map_by_jp = {norm(n): int(k) for k, names in audit['mapEvidence'].items() for n in names}
    type_names = {1:'讨伐',2:'采集',4:'狩猎',5:'连续狩猎',136:'特殊',16:'寻宝'}
    type_by_jp = {'討伐':1,'採集':2,'狩猟':4,'連続狩猟':5,'特殊':136}
    systems = {'village':'村', 'guild':'集会所', 'training':'训练所', 'treasure':'寻宝', 'event':'活动', 'challenge':'挑战'}
    system_ids = {key:i for i,key in enumerate(systems, 1)}
    quests = []
    for qid, j in sorted(join_by_id.items()):
        m = missions[qid]
        key = f'mhp2g:q{qid}'
        texts = {kind: review['units'][unit] for kind, unit in review['bindings'][str(qid)].items()}
        assert [texts[k]['japanese'] for k in ('name','goal','failure','description','monsters','client')] == m['strings']
        category = audit['categories'].get(str(qid))
        system = category['system'] if category else j['system']
        rank = {'lower':'low','upper':'high','g':'g'}[category['tier']] if category else 'other'
        star = category['displayStars'] if category else None
        if not category:
            extra = fields(extra_wiki[j['wikiKey']])
            star = int(re.search(r'\d+', extra.get('Lv', extra.get('LV', '')))[0])
            if j['wikiKey'].startswith('141:2:'):
                rank = 'g'
        group = j.get('trainingGroup')
        if system == 'training':
            level = {'beginner': '基础／武器训练', 'individual': '个人训练', 'group': '集团训练'}[group]
            subgroup = int(j['wikiKey'].split(':')[1])
            level += (' · G 级' if rank == 'g' else ' · 特别' if j['wikiKey'].startswith('141:1:') else '') + f'★{star}'
            level_id = 3000 + {'beginner':0,'individual':100,'group':200}[group] + subgroup*10 + star
        else:
            level = systems[system] + ((' G' if rank == 'g' else '') + f'★{star}' if star is not None else '')
            level_id = system_ids[system]*100 + (category['categoryIndex'] if category else star)
        wiki = major_wiki.get(j['wikiKey'])
        type_id = type_by_jp[wiki['fields']['type']['text'].replace('\n','')] if wiki else {129:1}.get(m['typeFlags'] & 255, m['typeFlags'] & 255)
        assert type_id in type_names, (qid, type_id, system)
        condition = rules.training(training[qid]) if qid in training else rules.task(qid)
        wiki_note = '\n'.join(c['original_row']['cells'][-1]['text'] for c in wiki['continuation_rows']) if wiki else ''
        hr = re.search(r'(?:参加資格|参加条件).*?HR\s*(\d+)以上', wiki_note)
        if hr:
            condition = combine('all', [atom(f'参加需 HR{hr[1]} 以上', minimum=int(hr[1]), source='wiki'), condition])
        groups, rewards = [], []
        for index, reward_group in enumerate(m['rewardGroups']):
            rule = reward_rules[qid,index]
            assert rule['flags'] == reward_group['flags']
            c = rule['condition']; kind = c['kind']
            label = {'base-rewards':'基本报酬', 'no-additional-trigger':'追加抽选（无额外触发条件）',
                     'large-monster-family-kills':f'首个配置的大型怪物家族讨伐至少 {c.get("minimum")} 头',
                     'elapsed-minutes-less-than':f'训练用时少于 {c.get("threshold")} 分钟（时间组只取首个命中）',
                     'treasure-score-at-least':f'寻宝积分至少 {c.get("threshold")}'}[kind]
            groups.append({'key':str(index),'label':label,'condition':c,'draws':rule['draws'], 'firstDraw':rule.get('firstDraw')})
            for ordinal, r in enumerate(reward_group['entries']):
                rewards.append({'groupKey':str(index),'itemId':r['itemId'],'quantity':r['quantity'],
                                'probability':r['probabilityRaw'],'guaranteed':bool(ordinal == 0 and (rule.get('firstDraw') or {}).get('unconditionalGuarantee'))})
        large_groups = [[{'monsterId':s['monsterIdRaw'],'quantity':s['quantityRaw'],'actorVariant':s['actorVariantRaw']} for s in g['spawns']] for g in large[qid]]
        small_groups = [{'index':g['index'],'monsterIds':sorted({s['monsterIdRaw'] for a in g['stages'] for s in a['spawns'] if s['monsterIdRaw'] != 29})} for g in small[qid]]
        mids = sorted({s['monsterId'] for g in large_groups for s in g} | {i for g in small_groups for i in g['monsterIds']})
        assert all(mid in monsters for mid in mids)
        quests.append({'questKey':key,'nativeId':str(qid),'nameCn':texts['name']['chinese'],'nameJp':m['strings'][0],
                       'goalCn':texts['goal']['chinese'],'goalJp':m['strings'][1],
                       'systemKey':system,'systemNameCn':systems[system],'rank':rank,'star':star,'levelId':level_id,'levelNameCn':level,
                       'questTypeId':type_id,'questTypeNameCn':type_names[type_id],'locationId':m['mapCandidate'],'locationNameCn':map_cn[m['mapCandidate']],
                       'locationNameJp':audit['mapEvidence'][str(m['mapCandidate'])][0],
                       'timeMinutes':m['timeRaw']/1800,'fee':m['fee'],'reward':m['reward'],'hrp':m['hrpSuccessRaw'],
                       'keyStatus':'key' if qid in audit['keys'] else 'urgent' if qid in audit['urgent'] else 'normal',
                       'monsterIds':mids,'rewards':rewards,'sourceKey':j['wikiKey'],
                       'p2g':{'source':'native','descriptionCn':texts['description']['chinese'],'descriptionJp':m['strings'][3],
                              'failureCn':texts['failure']['chinese'],'failureJp':m['strings'][2], 'clientCn':texts['client']['chinese'],'clientJp':m['strings'][5],
                              'monsterTextCn':texts['monsters']['chinese'],'monsterTextJp':m['strings'][4],
                              'condition':condition,'rewardGroups':groups,'supplies':m['supplies'], 'largeGroups':large_groups,'smallGroups':small_groups,
                              'sequential':spawn[qid]['largeSequenceKind'] != 'single-configuration-group', 'transitions':spawn[qid]['smallMonsterTransitions'],
                              'wait':waits.get(qid),'keyPrerequisite':any(r['questId']==qid for r in audit['keyPrerequisites']),
                              'translationSources':{k:{'status':u['status'],'basis':u['basis']} for k,u in texts.items()}}})
    links = defaultdict(list)
    for r in read_json(root/'quest-reward-links-v1.json')['lines']:
        links[r['quest_key']].append(r)
    corrections = {r['reward_line_key']:r['native_item_id'] for r in read_json(root/'legacy-reference.json')['rewardCorrections']}
    for w in audit['wikiOnly']:
        row = extra_wiki[w['wikiKey']]; f = fields(row); level = f['Lv']; star = int(re.search(r'\d+',level)[0])
        rank = 'g' if 'G' in level else 'high' if star >= 6 else 'low'
        system = w['system']; map_id = map_by_jp[norm(f['指定地'])]; type_id = type_by_jp[f['種別'].replace('\n','')]
        numbers = re.fullmatch(r'(\d+)z\s+(\d+)z\s+(\d+)分', f['報酬金契約金時間'])
        assert numbers, (row['key'],f['報酬金契約金時間'])
        text = review['units'][review['bindings'][w['catalogKey']]['name']]
        assert text['japanese'] == row['name_raw']
        note = notes[row['key']]; assert note['status']=='reviewed'
        hr = re.search(r'HR\s*(\d+)\s*以上', note['chinese'])
        rewards = wiki_rewards(row,links[row['key']],corrections,items)
        quests.append({'questKey':w['catalogKey'],'nativeId':None,'nameCn':text['chinese'],'nameJp':row['name_raw'],'goalCn':'','goalJp':'',
                       'systemKey':system,'systemNameCn':systems[system],'rank':rank,'star':star,'levelId':system_ids[system]*100+(10 if rank=='g' else 0)+star,
                       'levelNameCn':systems[system]+' '+level,'questTypeId':type_id,'questTypeNameCn':type_names[type_id],
                       'locationId':map_id,'locationNameCn':map_cn[map_id],'locationNameJp':f['指定地'],
                       'timeMinutes':int(numbers[3]),'fee':int(numbers[2]),'reward':int(numbers[1]),'hrp':int(f['GP']) if f.get('GP','').isdigit() else None,
                       'keyStatus':'normal','monsterIds':wiki_monsters(f['主なモンスター'],monsters),
                       'rewards':[{'groupKey':'wiki',**r} for r in rewards],'sourceKey':row['key'],
                       'p2g':{'source':'wiki','descriptionCn':None,'descriptionJp':None,'failureCn':None,'failureJp':None,'clientCn':None,'clientJp':None,
                              'monsterTextCn':'、'.join(monsters[mid]['name_cn'] for mid in wiki_monsters(f['主なモンスター'],monsters)),
                              'monsterTextJp':f['主なモンスター'],'noteCn':note['chinese'],'noteJp':note['japanese'],
                              'condition':atom(f'参加需 HR{hr[1]} 以上（Wiki）') if hr else atom('参加条件未收录'),
                              'rewardGroups':[{'key':'wiki','label':'Wiki 报酬记录','condition':None,'draws':None,'firstDraw':None}] if rewards else [],
                              'supplies':None,'largeGroups':None,'smallGroups':None,'sequential':False,'transitions':[],'wait':None,'keyPrerequisite':False,
                              'translationSources':{'name':{'status':text['status'],'basis':text['basis']},'notes':{'status':'reviewed','basis':note['basis']}}}})
    decisions = read_json(decisions_file) if decisions_file else {}
    migrated, unresolved = migrate_monster_quests(monsters,quests,decisions)
    for r in migrated:
        target = next((q for q in quests if q['questKey'] == r['questKey']), None)
        if target and r['monsterId'] not in target['monsterIds']:
            r['basis'] += '；旧怪物页记录与目录配置个体不一致，保留原出没数值及来源，不覆盖任务配置。'
    aliases.update({r['sourceKey']:r['questKey'] for r in migrated if r['questKey'] is not None})
    item_refs = []
    lines_by_key = {r['key']:r for rows in links.values() for r in rows}
    for r in con.execute("SELECT id,source_key FROM catalog_item_relations WHERE source_kind='quest'"):
        source = r['source_key'].removeprefix('quest:')
        line = lines_by_key.get(source)
        assert line, ('Missing old item reward evidence',dict(r))
        target = aliases.get('wiki:'+line['quest_key'], 'wiki:'+line['quest_key'])
        assert any(q['questKey']==target for q in quests)
        item_refs.append({'relationId':r['id'],'questKey':target,'sourceKey':r['source_key']})
    con.close()
    return {'schema':'mhp2g-quest-evidence-v1','inputs':{'manifest':digest(root/'manifest.json'),'base':digest(root/'base.sqlite'),
            'generator':hashlib.sha256(''.join(digest(p) for p in [Path(__file__),Path(__file__).parent/'mhp2g/quest_conditions.py',Path(__file__).parent/'mhp2g/quest_wiki.py']).encode()).hexdigest(),
            'review':digest(review_file),'wikiNotes':digest(notes_file),'decisions':digest(decisions_file) if decisions_file else None},
            'quests':quests,'aliases':aliases,'monsterReferences':migrated,'itemReferences':item_refs,'unresolved':unresolved,
            'audit':{'quests':len(quests),'native':len(joins),'wiki':len(audit['wikiOnly']),'monsterReferences':len(migrated),'unresolved':len(unresolved)}}


if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--review',type=Path,required=True)
    parser.add_argument('--wiki-notes',type=Path,required=True);parser.add_argument('--decisions',type=Path);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();assert not args.output.exists(),'Refusing to overwrite output'
    result=prepare(args.input,args.review,args.wiki_notes,args.decisions)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x') as out:json.dump(result,out,ensure_ascii=False,separators=(',',':'));out.write('\n')
    print(json.dumps(result['audit']))
