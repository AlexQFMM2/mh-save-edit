import assert from 'node:assert/strict'

export const questSchema = `
CREATE TABLE p2g_quests(quest_key TEXT PRIMARY KEY,native_id INTEGER UNIQUE,name_cn TEXT NOT NULL,name_jp TEXT NOT NULL,
  source_order INTEGER NOT NULL,detail_json TEXT NOT NULL CHECK(json_valid(detail_json)));
CREATE TABLE p2g_quest_aliases(alias TEXT PRIMARY KEY,quest_key TEXT NOT NULL REFERENCES p2g_quests);
CREATE TABLE p2g_quest_items(id INTEGER PRIMARY KEY,quest_key TEXT NOT NULL REFERENCES p2g_quests,
  item_id INTEGER NOT NULL REFERENCES catalog_items,item_kind TEXT NOT NULL CHECK(item_kind IN ('reward','supply')),
  ordinal INTEGER NOT NULL,group_key TEXT,quantity INTEGER CHECK(quantity>0),probability REAL CHECK(probability BETWEEN 0 AND 100),
  guaranteed INTEGER CHECK(guaranteed IN (0,1)),UNIQUE(quest_key,item_kind,ordinal));
CREATE INDEX p2g_quest_item_reverse ON p2g_quest_items(item_id,quest_key);
CREATE TABLE p2g_quest_monsters(quest_key TEXT NOT NULL REFERENCES p2g_quests,monster_id INTEGER NOT NULL REFERENCES catalog_monsters,
  PRIMARY KEY(quest_key,monster_id));
CREATE INDEX p2g_quest_monster_reverse ON p2g_quest_monsters(monster_id,quest_key);
CREATE TABLE p2g_quest_relations(id INTEGER PRIMARY KEY,source_key TEXT NOT NULL REFERENCES p2g_quests,
  target_key TEXT NOT NULL REFERENCES p2g_quests,condition_text TEXT NOT NULL,operator TEXT NOT NULL,
  UNIQUE(source_key,target_key,condition_text));
CREATE TABLE p2g_quest_search(id INTEGER PRIMARY KEY,quest_key TEXT NOT NULL REFERENCES p2g_quests,
  kind TEXT NOT NULL,label TEXT NOT NULL,normalized_text TEXT NOT NULL);
CREATE INDEX p2g_quest_search_key ON p2g_quest_search(quest_key);
CREATE TABLE p2g_quest_legacy_monsters(monster_id INTEGER NOT NULL REFERENCES catalog_monsters,ordinal INTEGER NOT NULL,
  source_key TEXT NOT NULL,quest_key TEXT REFERENCES p2g_quests,record_json TEXT NOT NULL CHECK(json_valid(record_json)),
  PRIMARY KEY(monster_id,ordinal));
CREATE TABLE p2g_quest_legacy_items(relation_id INTEGER PRIMARY KEY REFERENCES catalog_item_relations,
  quest_key TEXT NOT NULL REFERENCES p2g_quests,source_key TEXT NOT NULL);
`
export const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'')
export function visitCondition(node, callback, operator='all', negated=false) {
  assert(node && typeof node==='object' && ['condition','all','any','not'].includes(node.kind),'Invalid condition AST')
  callback(node,operator,negated)
  for(const child of node.children??[])visitCondition(child,callback,node.kind==='any'?'any':operator,node.kind==='not'?!negated:negated)
}
export function appendQuests(db, snapshot) {
  assert.equal(snapshot.schema,'mhp2g-quest-evidence-v1')
  assert.deepEqual(snapshot.unresolved,[],'Unreviewed references')
  const quests=new Map(snapshot.quests.map(q=>[q.questKey,q]))
  assert.equal(quests.size,snapshot.quests.length,'Duplicate quest identity')
  const items=new Map(db.prepare('SELECT item_id,name_cn,name_jp FROM catalog_items').all().map(r=>[r.item_id,r]))
  const monsters=new Map(db.prepare('SELECT monster_id,name_cn,name_jp FROM catalog_monsters').all().map(r=>[r.monster_id,r]))
  db.exec(questSchema)
  const insert=db.prepare('INSERT INTO p2g_quests VALUES(?,?,?,?,?,?)')
  const item=db.prepare('INSERT INTO p2g_quest_items VALUES(NULL,?,?,?,?,?,?,?,?)')
  const monster=db.prepare('INSERT INTO p2g_quest_monsters VALUES(?,?)')
  const term=db.prepare('INSERT INTO p2g_quest_search VALUES(NULL,?,?,?,?)')
  const addTerm=(key,kind,label,...values)=>{for(const value of new Set(values.filter(v=>v!=null&&v!=='')))term.run(key,kind,label,normalize(value))}
  const relation=db.prepare('INSERT OR IGNORE INTO p2g_quest_relations VALUES(NULL,?,?,?,?)')
  let order=0
  for(const q of quests.values()) {
    assert.match(q.questKey,/^(?:mhp2g:q[1-9]\d{0,5}|wiki:\d+:\d+:\d+)$/)
    assert.equal(q.nativeId==null,q.p2g.source==='wiki')
    if(q.nativeId!=null)assert.equal(q.questKey,`mhp2g:q${Number(q.nativeId)}`)
    assert(q.nameCn?.trim()&&q.nameJp?.trim(),'Missing readable name')
    insert.run(q.questKey,q.nativeId==null?null:Number(q.nativeId),q.nameCn,q.nameJp,order++,JSON.stringify(q))
  }
  for(const q of quests.values()) {
    addTerm(q.questKey,'name',q.nameCn,q.nameCn,q.nameJp)
    addTerm(q.questKey,'id',q.nativeId??q.questKey,q.nativeId,q.questKey)
    addTerm(q.questKey,'goal',q.goalCn||q.p2g.monsterTextCn,q.goalCn,q.goalJp)
    addTerm(q.questKey,'map',q.locationNameCn,q.locationNameCn,q.locationNameJp)
    for(const mid of new Set(q.monsterIds)) {
      const m=monsters.get(mid);assert(m,'Missing monster endpoint');monster.run(q.questKey,mid)
      addTerm(q.questKey,'monster',m.name_cn,m.name_cn,m.name_jp)
    }
    for(const [kind,rows] of [['reward',q.rewards],['supply',q.p2g.supplies??[]]]) {
      for(const [ordinal,r] of rows.entries()) {
        const i=items.get(r.itemId);assert(i,'Missing item endpoint')
        assert(r.quantity==null||Number.isInteger(r.quantity)&&r.quantity>0,'Invalid quantity')
        if(kind==='reward')assert(r.probability==null||Number.isFinite(r.probability)&&r.probability>=0&&r.probability<=100,'Invalid weight')
        item.run(q.questKey,r.itemId,kind,ordinal,r.groupKey??null,r.quantity,r.probability??null,r.guaranteed==null?null:Number(r.guaranteed))
        addTerm(q.questKey,kind,i.name_cn,i.name_cn,i.name_jp)
      }
    }
    visitCondition(q.p2g.condition,(node,operator,negated)=>{
      for(const mid of node.monsterIds??[])assert(monsters.has(mid),'Missing condition monster')
      if(node.questKey) {
        const source=quests.get(node.questKey);assert(source,'Missing quest endpoint')
        addTerm(q.questKey,'relatedQuest',source.nameCn,source.nameCn,source.nameJp)
        // Negative branch guards remain in the AST but are not listed as positive prerequisites.
        if(!negated&&source.questKey!==q.questKey) {
          relation.run(source.questKey,q.questKey,node.text,operator)
          addTerm(source.questKey,'relatedQuest',q.nameCn,q.nameCn,q.nameJp)
        }
      }
    })
    for(const transition of q.p2g.transitions) {
      const c=transition.condition
      if(c.monsterId)assert(monsters.has(c.monsterId),'Missing transition monster')
      if(c.itemId)assert(items.has(c.itemId),'Missing transition item')
    }
  }
  const alias=db.prepare('INSERT INTO p2g_quest_aliases VALUES(?,?)')
  for(const [key,target] of Object.entries(snapshot.aliases).sort()) {
    assert.match(key,/^wiki:\d+:\d+:\d+$/);assert(quests.has(target));alias.run(key,target)
  }
  const legacyMonster=db.prepare('INSERT INTO p2g_quest_legacy_monsters VALUES(?,?,?,?,?)')
  for(const row of snapshot.monsterReferences)legacyMonster.run(row.monsterId,row.ordinal,row.sourceKey,row.questKey,JSON.stringify(row))
  const legacyItem=db.prepare('INSERT INTO p2g_quest_legacy_items VALUES(?,?,?)')
  for(const row of snapshot.itemReferences)legacyItem.run(row.relationId,row.questKey,row.sourceKey)
}

export function auditQuestCatalog(db, expected) {
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
  assert.deepEqual(db.pragma('foreign_key_check'),[])
  const count=sql=>db.prepare(sql).get().n
  const report={quests:count('SELECT count(*) n FROM p2g_quests'),native:count('SELECT count(*) n FROM p2g_quests WHERE native_id IS NOT NULL'),
    rewards:count("SELECT count(*) n FROM p2g_quest_items i JOIN p2g_quests q USING(quest_key) WHERE native_id IS NOT NULL AND item_kind='reward'"),
    supplies:count("SELECT count(*) n FROM p2g_quest_items i JOIN p2g_quests q USING(quest_key) WHERE native_id IS NOT NULL AND item_kind='supply'"),
    legacyMonsters:count('SELECT count(*) n FROM p2g_quest_legacy_monsters'),legacyItems:count('SELECT count(*) n FROM p2g_quest_legacy_items')}
  const rows=db.prepare('SELECT detail_json FROM p2g_quests WHERE native_id IS NOT NULL').all().map(r=>JSON.parse(r.detail_json))
  report.groups=rows.reduce((n,q)=>n+q.p2g.rewardGroups.length,0)
  report.large=rows.reduce((n,q)=>n+q.p2g.largeGroups.reduce((n,g)=>n+g.length,0),0)
  report.sequential=rows.filter(q=>q.p2g.sequential).length
  report.transitions=rows.reduce((n,q)=>n+q.p2g.transitions.length,0)
  report.keys=rows.filter(q=>q.keyStatus==='key').length;report.urgent=rows.filter(q=>q.keyStatus==='urgent').length
  for(const q of rows)for(const group of q.p2g.rewardGroups) {
    const rewards=q.rewards.filter(r=>r.groupKey===group.key)
    assert.equal(rewards.reduce((n,r)=>n+r.probability,0),100,'Native reward group weights do not sum to 100')
    if(group.firstDraw?.unconditionalGuarantee)assert(rewards[0].guaranteed&&rewards[0].itemId===group.firstDraw.itemId)
  }
  if(expected)for(const [key,value] of Object.entries(expected))assert.equal(report[key],value,`Unexpected ${key}`)
  return report
}
