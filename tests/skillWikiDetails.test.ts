import Database from 'better-sqlite3'
import {afterEach,describe,expect,it} from 'vitest'
import {readSkillWikiDetails} from '../api/catalog/skillWikiDetails'
import {SkillCatalogRepository} from '../api/catalog/skillRepository'
// @ts-expect-error Preparation-only JavaScript.
import {importSkillWikiDetails} from '../tools/runtime/skillWikiDetails.mjs'
const opened: Database.Database[]=[]
function fixture(){
 const db=new Database(':memory:');opened.push(db)
 db.exec(`CREATE TABLE catalog_skill_activations(game_id TEXT,activation_key TEXT,skill_id INTEGER,dex_activation_id INTEGER,threshold INTEGER,name_jp TEXT,description_cn TEXT);
 INSERT INTO catalog_skill_activations VALUES('mh4g','synthetic',7,9,10,'試験','original')`)
 return db
}
const entry={gameId:'mh4g',activationKey:'synthetic',skillId:7,dexActivationId:9,threshold:10,nameJp:'試験',status:'reviewed',descriptionCn:'合成效果+7',sourceUrl:'https://example.com/skill',sourceVersion:'MH4G',sourceSha256:'a'.repeat(64),sourceText:'synthetic +7',reviewNote:'synthetic test'}
const doc=(entries: object[])=>({format:'skill-wiki-reviewed-v1',entries})
afterEach(()=>opened.splice(0).forEach(db=>db.close()))
describe('Wiki details import and safe read',()=>{
 it('searches reviewed text, while old databases and stale rows remain safe',()=>{
  const db=fixture()
  db.exec(`CREATE TABLE catalog_skills(game_id TEXT,skill_id INTEGER,dex_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,is_placeholder INTEGER);
   INSERT INTO catalog_skills VALUES('mh4g',7,7,'合成技能','Synthetic','試験',0);
   CREATE TABLE catalog_armor_skills(game_id TEXT,skill_id INTEGER);
   CREATE TABLE catalog_decoration_skills(game_id TEXT,skill_id INTEGER);
   ALTER TABLE catalog_skill_activations ADD COLUMN name_cn TEXT DEFAULT '';
   ALTER TABLE catalog_skill_activations ADD COLUMN name_en TEXT DEFAULT '';
   ALTER TABLE catalog_skill_activations ADD COLUMN description_en TEXT DEFAULT '';
   ALTER TABLE catalog_skill_activations ADD COLUMN description_jp TEXT DEFAULT '';
   ALTER TABLE catalog_skill_activations ADD COLUMN direction TEXT DEFAULT 'positive';`)
  const repo=new SkillCatalogRepository(db)
  expect(repo.searchSkills({gameId:'mh4g',query:'合成效果+7'}).total).toBe(0)
  importSkillWikiDetails(db,'mh4g',doc([entry]))
  expect(repo.searchSkills({gameId:'mh4g',query:'合成效果+7'}).items[0].skillId).toBe(7)
  expect(repo.searchSkills({gameId:'mhgu',query:'合成效果+7'}).total).toBe(0)
  db.exec('UPDATE catalog_skill_activations SET threshold=15')
  expect(repo.searchSkills({gameId:'mh4g',query:'合成效果+7'}).total).toBe(0)
 })
 it('supports an old database without the optional table',()=>expect(readSkillWikiDetails(fixture(),'mh4g',7).size).toBe(0))
 it('imports idempotently and never overwrites original descriptions',()=>{
  const db=fixture();importSkillWikiDetails(db,'mh4g',doc([entry]));importSkillWikiDetails(db,'mh4g',doc([entry]))
  expect(readSkillWikiDetails(db,'mh4g',7).get('synthetic')?.descriptionCn).toBe('合成效果+7')
  expect(db.prepare('SELECT description_cn FROM catalog_skill_activations').get()).toEqual({description_cn:'original'})
  expect(db.prepare('SELECT count(*) n FROM catalog_skill_effect_details').get()).toEqual({n:1})
 })
 it.each(['nameJp','threshold','skillId','dexActivationId','activationKey'])('rejects mismatched %s before replacing existing details',key=>{
  const db=fixture();importSkillWikiDetails(db,'mh4g',doc([entry]))
  expect(()=>importSkillWikiDetails(db,'mh4g',doc([{...entry,[key]:typeof entry[key as keyof typeof entry]==='number'?999:'wrong'}]))).toThrow('identity mismatch')
  expect(readSkillWikiDetails(db,'mh4g',7).size).toBe(1)
 })
 it('rejects wrong version and missing provenance',()=>{
  const db=fixture()
  expect(()=>importSkillWikiDetails(db,'mh4g',doc([{...entry,sourceVersion:'MHXX'}]))).toThrow('version mismatch')
  expect(()=>importSkillWikiDetails(db,'mh4g',doc([{...entry,sourceSha256:''}]))).toThrow('provenance')
 })
 it('excludes conflicts and rejects duplicate identities',()=>{
  const db=fixture();importSkillWikiDetails(db,'mh4g',doc([{...entry,status:'conflict'}]))
  expect(readSkillWikiDetails(db,'mh4g',7).size).toBe(0)
  expect(()=>importSkillWikiDetails(db,'mh4g',doc([entry,entry]))).toThrow('Duplicate')
 })
 it('retains details across base activation deletion and reinsertion',()=>{
  const db=fixture();importSkillWikiDetails(db,'mh4g',doc([entry]))
  db.exec('DELETE FROM catalog_skill_activations')
  expect(readSkillWikiDetails(db,'mh4g',7).size).toBe(0)
  expect(db.prepare('SELECT count(*) n FROM catalog_skill_effect_details').get()).toEqual({n:1})
  db.exec("INSERT INTO catalog_skill_activations VALUES('mh4g','synthetic',7,9,10,'試験','rebuilt original')")
  expect(readSkillWikiDetails(db,'mh4g',7).get('synthetic')?.descriptionCn).toBe(entry.descriptionCn)
 })
 it('hides stale details after the base activation changes',()=>{
  const db=fixture();importSkillWikiDetails(db,'mh4g',doc([entry]));db.exec('UPDATE catalog_skill_activations SET threshold=15')
  expect(readSkillWikiDetails(db,'mh4g',7).size).toBe(0)
 })
})
