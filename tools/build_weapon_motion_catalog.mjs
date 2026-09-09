#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { parseArc } from './lib/mhQuestArc.mjs'
import { displayNameFromKey, normalizeMotionName, parseAndroidResourceArrays, parseIndexedGmd, sha256 } from './lib/weaponMotionResources.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback }
const researchRoot = path.resolve(projectRoot, option('--research-root', '../research'))
const sourceRoot = path.join(researchRoot, 'mhgu/motion-values')
const dataFile = path.join(researchRoot, 'generated/mh-save-edit/catalog/data/mhgu.sqlite')
const reportFile = path.join(researchRoot, 'generated/mh-save-edit/catalog/data/manifests/mhgu-weapon-motions.json')
const referenceFile = path.join(sourceRoot, 'references/damage-calculator/Motion_Values.xml')
const sourceManifestFile=path.join(sourceRoot,'source-manifest.json')

const weaponTypes = [
  { id: 1, arc: '00', prefix: 'GS', kind: 'melee' }, { id: 2, arc: '01', prefix: 'LS', kind: 'melee' },
  { id: 3, arc: '02', prefix: 'SNS', kind: 'melee' }, { id: 4, arc: '03', prefix: 'DB', kind: 'melee' },
  { id: 5, arc: '04', prefix: 'Hammer', kind: 'melee' }, { id: 6, arc: '06', prefix: 'HH', kind: 'melee' },
  { id: 7, arc: '07', prefix: 'Lance', kind: 'melee' }, { id: 8, arc: '08', prefix: 'GL', kind: 'melee' },
  { id: 9, arc: '09', prefix: 'SA', kind: 'melee' }, { id: 10, arc: '10', prefix: 'CB', kind: 'melee' },
  { id: 11, arc: '11', prefix: 'IG', kind: 'melee' }, { id: 12, arc: '12', prefix: 'LBG', kind: 'bowgun' },
  { id: 13, arc: '13', prefix: 'HBG', kind: 'bowgun' }, { id: 14, arc: '14', prefix: 'Bow', kind: 'bow' },
]
const styleNames = ['Guild', 'Striker', 'Aerial', 'Adept', 'Alchemy', 'Valor']
const styleIds = new Map(styleNames.map((name) => [name.toLowerCase(), name.toLowerCase()]))

if (!fs.existsSync(dataFile)) throw new Error(`Missing private catalog database: ${dataFile}`)
if (!fs.existsSync(referenceFile)) throw new Error(`Missing fixed motion-value cross-check: ${referenceFile}`)

function verifySourceManifest(){
  if(!fs.existsSync(sourceManifestFile))throw new Error(`Missing source manifest: ${sourceManifestFile}`)
  const manifest=JSON.parse(fs.readFileSync(sourceManifestFile,'utf8'))
  if(manifest.format!=='mh-save-edit-research-source-v1'||!Array.isArray(manifest.files))throw new Error('Invalid weapon motion source manifest')
  for(const entry of manifest.files){const file=path.join(sourceRoot,entry.path);if(!fs.existsSync(file)||fs.statSync(file).size!==entry.size||sha256(fs.readFileSync(file))!==entry.sha256)throw new Error(`Source snapshot verification failed: ${entry.path}`)}
  return manifest
}

function sourceAudit() {
  const rows = []
  for (const weapon of weaponTypes) {
    const files = ['mhgu', 'mhxx'].map((version) => path.join(sourceRoot, `native/${version}/w${weapon.arc}.arc`))
    if (files.some((file) => !fs.existsSync(file))) throw new Error(`Missing native archive for weapon type ${weapon.id}`)
    const parsedArchives=files.map((file)=>parseArc(file))
    const entries = parsedArchives.map((archive) => archive.entries.find((entry) => entry.data.subarray(0, 3).toString('ascii') === 'HDP'))
    if (entries.some((entry) => !entry)) throw new Error(`Missing HDP resource for weapon type ${weapon.id}`)
    if (!entries[0].data.equals(entries[1].data)) throw new Error(`GU/XX HDP differs for weapon type ${weapon.id}`)
    if (entries[0].data.length < 16 || (entries[0].data.length - 16) % 56 !== 0) throw new Error(`Invalid HDP structure for weapon type ${weapon.id}`)
    const styleArchives=[]
    for(let style=0;style<6;style+=1){
      const styleFiles=['mhgu','mhxx'].map(version=>path.join(sourceRoot,`styles/${version}/w${weapon.arc}_m${style}.arc`))
      if(styleFiles.some(file=>!fs.existsSync(file)))throw new Error(`Missing style archive w${weapon.arc}_m${style}.arc`)
      const archives=styleFiles.map(file=>parseArc(file))
      const guNames=archives[0].entries.map(entry=>entry.name).sort();const xxNames=archives[1].entries.map(entry=>entry.name).sort()
      if(JSON.stringify(guNames)!==JSON.stringify(xxNames))throw new Error(`GU/XX command resource names differ for w${weapon.arc}_m${style}`)
      styleArchives.push({styleId:styleNames[style].toLowerCase(),entryCount:guNames.length,guSha256:sha256(fs.readFileSync(styleFiles[0])),xxSha256:sha256(fs.readFileSync(styleFiles[1]))})
    }
    const resourceEvidence=parsedArchives.flatMap((archive,versionIndex)=>archive.entries.map(entry=>({entry,magic:entry.data.subarray(0,3).toString('ascii'),version:versionIndex===0?'mhgu':'mhxx'})).filter(value=>['FUP','HDP','LMT','HDS'].includes(value.magic)).map(value=>({version:value.version,kind:value.magic.toLowerCase(),name:value.entry.name,size:value.entry.data.length,sha256:sha256(value.entry.data)})))
    rows.push({ weaponTypeId: weapon.id, resourceName: entries[0].name, recordCount: (entries[0].data.length - 16) / 56, sha256: sha256(entries[0].data), styleArchives,resourceEvidence })
  }
  for(const version of ['mhgu','mhxx']){
    const file=path.join(sourceRoot,`native/${version}/wbc.arc`);if(!fs.existsSync(file))throw new Error(`Missing ${version} wbc.arc`)
    const hds=parseArc(file).entries.filter(entry=>entry.data.subarray(0,3).toString('ascii')==='HDS')
    if(!hds.length)throw new Error(`${version} wbc.arc contains no HDS resources`)
    rows.push({weaponTypeId:null,resourceName:`${version}:wbc`,recordCount:hds.length,sha256:sha256(fs.readFileSync(file)),styleArchives:[],resourceEvidence:hds.map(entry=>({version,kind:'hds',name:entry.name,size:entry.data.length,sha256:sha256(entry.data)}))})
  }
  return rows
}

function modeFromArrayKey(key, style) {
  return key.replace(/_(?:Guild|Striker|Aerial|Adept|Alchemy|Valor)_/, '_').replace(/_(?:MV|Names)/, '').replace(/^(?:GS|LS|SNS|DB|Hammer|HH|Lance|GL|SA|CB|IG)_?/, '').replace(/^_|_$/g, '').replace(/_/g, ' ') || style
}

function hitCountFromName(name) {
  const numeric = String(name).match(/\b(\d+)\s*hits?\b/i)
  if (numeric) return Number(numeric[1])
  return /\bboth hits\b/i.test(String(name)) ? 2 : 1
}

function collectMelee(arrays, weapon) {
  const byIdentity = new Map()
  for (const [nameKey, names] of arrays) {
    if (!nameKey.startsWith(`${weapon.prefix}_`) || !nameKey.includes('_Names') || nameKey.includes('_HA_')) continue
    const styleName = styleNames.find((style) => nameKey.includes(`_${style}_`))
    if (!styleName) continue
    const valueKey = nameKey === 'SA_Sword_Alcehmy_Names' ? 'SA_Sword_Alchemy_MV' : nameKey.replace('_Names', '_MV')
    const values = arrays.get(valueKey)
    if (!Array.isArray(values)) continue
    const mode = modeFromArrayKey(nameKey, styleName)
    names.slice(0, values.length).forEach((rawName, index) => {
      const nameEn = String(rawName).replace(/^\s+/, '')
      const identity = normalizeMotionName(nameEn)
      if (!identity || !Number.isFinite(values[index])) return
      const row = byIdentity.get(identity) ?? { nameEn, category: 'standard', styles: new Set(), variants: [] }
      row.styles.add(styleIds.get(styleName.toLowerCase()))
      row.variants.push({ id: `${styleName.toLowerCase()}:${mode}:${index}`, label: mode === styleName ? styleName : `${styleName} · ${mode}`, styleId: styleName.toLowerCase(), condition: mode, values: [values[index]], hitCount: hitCountFromName(rawName) })
      byIdentity.set(identity, row)
    })
  }
  for (const [key, values] of arrays) {
    if (!key.startsWith(`${weapon.prefix}_HA_`) || !key.endsWith('_MV') || /ElmCheck|NoCharge|Burst/.test(key)) continue
    const nameEn = displayNameFromKey(key)
    const identity = `hunter-art:${normalizeMotionName(nameEn)}`
    const row = byIdentity.get(identity) ?? { nameEn, category: 'hunterArt', styles: new Set(styleIds.values()), variants: [] }
    values.forEach((value, index) => {
      if (Number.isFinite(value)) row.variants.push({ id: `hunter-art:${key}:${index}`, label: values.length <= 3 ? `等级 ${index + 1}` : `阶段 ${index + 1}`, styleId: null, condition: key, values: [value], hitCount: 1 })
    })
    byIdentity.set(identity, row)
  }
  return [...byIdentity.values()].map(row=>({...row,category:row.category==='hunterArt'?'hunterArt':row.styles.size<6?'style':'standard'}))
}

function collectBowgun(arrays, weapon) {
  const rows = []
  for (const [key, values] of arrays) {
    if (!key.endsWith('_Shot_MV') && !key.startsWith(`${weapon.prefix}_HA_`)) continue
    if (!Array.isArray(values) || !values.length || values.some((value) => !Number.isFinite(value))) continue
    const hunterArt = key.startsWith(`${weapon.prefix}_HA_`)
    const componentNameKey = hunterArt
      ? key.includes('Bullet_Geyser') ? 'Bullet_Geyser_Names' : key.includes('Charged_Shot') ? 'Charged_Shot_Names' : key.includes('Super_Nova') ? 'Super_Nova_Names' : null
      : key.startsWith('Elemental_') || key.startsWith('Pierce_Elemental_') ? 'Elemental_Names'
        : key.startsWith('Crag_') || key.startsWith('Clust_') || key.startsWith('Triblast_') ? 'Fire_Damage_Names'
          : key.startsWith('Cannon_') ? 'Cannon_Names'
            : key.startsWith('Slicing_') ? 'Slicing_Names'
              : key.startsWith('Shrapnel_') ? 'Shrapnel_Names' : 'Default_Names'
    const componentNames = componentNameKey ? arrays.get(componentNameKey) : null
    const variants = values.map((value, index) => ({ id: `${key}:${index}`, label: String(componentNames?.[index] ?? `参数 ${index + 1}`), styleId: null, condition: key, values: [value], hitCount: 1 }))
    rows.push({ nameEn: displayNameFromKey(key), category: hunterArt ? 'hunterArt' : 'standard', styles: new Set(styleIds.values()), variants })
  }
  return rows
}

function collectBow() {
  const styles = new Set(styleIds.values())
  const chargeRows = [
    ['连射 1', 12], ['连射 2', 16], ['连射 3', 19], ['连射 4', 21], ['连射 5', 22],
    ['贯通 1', 14], ['贯通 2', 16], ['贯通 3', 23], ['贯通 4', 24], ['贯通 5', 26],
    ['扩散 1', 18], ['扩散 2', 24], ['扩散 3', 30], ['扩散 4', 30], ['扩散 5', 30],
    ['重射 1', 11], ['重射 2', 14], ['重射 3', 17], ['重射 4', 19], ['重射 5', 20],
  ]
  return [
    ...chargeRows.map(([nameEn, value], index) => ({ nameEn, category: 'standard', styles, variants: [{ id: `bow-shot:${index}`, label: '箭型基础动作值', styleId: null, condition: '蓄力等级另乘原生蓄力补正', values: [value], hitCount: 1 }], shotType: String(nameEn).split(' ')[0], chargeLevel: Number(String(nameEn).split(' ')[1]) })),
    { nameEn: 'Melee Attack 1', category: 'standard', styles, variants: [{ id: 'bow-melee:1', label: '近身攻击', styleId: null, condition: '', values: [10], hitCount: 1 }] },
    { nameEn: 'Melee Attack 2', category: 'standard', styles, variants: [{ id: 'bow-melee:2', label: '近身攻击', styleId: null, condition: '', values: [24], hitCount: 1 }] },
    { nameEn: 'Blade Wire', category: 'hunterArt', styles, variants: [12, 15, 18, 21].map((value,index)=>({ id: `bow-ha:blade-wire:${index+1}`, label: `蓄力 ${index+1}`, styleId: null, condition: '依蓄力等级', values: [value], hitCount: 1 })) },
    { nameEn: 'Triple Volley', category: 'hunterArt', styles, variants: [127, 160, 199].map((value,index)=>({ id: `bow-ha:triple-volley:${index+1}`, label: `等级 ${index+1}`, styleId: null, condition: '依狩技等级', values: [value], hitCount: 1 })) },
  ]
}

function schema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_weapon_motions (game_id TEXT NOT NULL, motion_key TEXT NOT NULL, weapon_type_id INTEGER NOT NULL, native_action_id TEXT NOT NULL, name_cn TEXT NOT NULL, name_en TEXT NOT NULL, name_jp TEXT NOT NULL, category TEXT NOT NULL, result_kind TEXT NOT NULL, attack_type TEXT, sharpness_modifier REAL, exhaust INTEGER, stun INTEGER, hit_count_min INTEGER NOT NULL, hit_count_max INTEGER NOT NULL, motion_value_min REAL, motion_value_max REAL, motion_value_total REAL, notes TEXT NOT NULL DEFAULT '', hunter_art_id INTEGER, source_order INTEGER NOT NULL, evidence_status TEXT NOT NULL, PRIMARY KEY(game_id,motion_key));
    CREATE TABLE IF NOT EXISTS catalog_weapon_motion_styles (game_id TEXT NOT NULL, motion_key TEXT NOT NULL, style_id TEXT NOT NULL, PRIMARY KEY(game_id,motion_key,style_id));
    CREATE TABLE IF NOT EXISTS catalog_weapon_motion_variants (game_id TEXT NOT NULL, motion_key TEXT NOT NULL, variant_id TEXT NOT NULL, label_cn TEXT NOT NULL, condition_cn TEXT NOT NULL, style_id TEXT, motion_value_total REAL, PRIMARY KEY(game_id,motion_key,variant_id));
    CREATE TABLE IF NOT EXISTS catalog_weapon_motion_hits (game_id TEXT NOT NULL, motion_key TEXT NOT NULL, variant_id TEXT NOT NULL, sequence INTEGER NOT NULL, motion_value REAL, attack_type TEXT, sharpness_modifier REAL, exhaust INTEGER, stun INTEGER, is_damage INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(game_id,motion_key,variant_id,sequence));
    CREATE TABLE IF NOT EXISTS catalog_bowgun_motion_values (game_id TEXT NOT NULL, motion_key TEXT NOT NULL, projectile_kind TEXT NOT NULL, rapid_fire_modifier REAL, siege_modifier REAL, native_modifier_text TEXT NOT NULL DEFAULT '', PRIMARY KEY(game_id,motion_key));
    CREATE TABLE IF NOT EXISTS catalog_bow_motion_values (game_id TEXT NOT NULL, motion_key TEXT NOT NULL, shot_type TEXT, charge_level INTEGER, charge_modifier REAL, coating_modifier REAL, distance_modifier TEXT, PRIMARY KEY(game_id,motion_key));
    CREATE TABLE IF NOT EXISTS catalog_weapon_motion_sources (game_id TEXT NOT NULL, source_id TEXT NOT NULL, weapon_type_id INTEGER, source_kind TEXT NOT NULL, source_path TEXT NOT NULL, source_sha256 TEXT NOT NULL, native_record_count INTEGER, notes TEXT NOT NULL DEFAULT '', PRIMARY KEY(game_id,source_id));
    CREATE INDEX IF NOT EXISTS idx_weapon_motion_type ON catalog_weapon_motions(game_id,weapon_type_id,source_order);
    CREATE INDEX IF NOT EXISTS idx_weapon_motion_style ON catalog_weapon_motion_styles(game_id,style_id,motion_key);
  `)
}

const sourceManifest=verifySourceManifest()
const arrays = parseAndroidResourceArrays(referenceFile)
const localizationFiles={cn:path.join(sourceRoot,'localization/HN_WeaponControlsMsg_chS.gmd'),en:path.join(sourceRoot,'localization/HN_WeaponControlsMsg_eng.gmd'),jp:path.join(sourceRoot,'localization/HN_WeaponControlsMsg_jpn.gmd')}
if(Object.values(localizationFiles).some(file=>!fs.existsSync(file)))throw new Error('Missing one or more native motion localization files')
const localized=Object.fromEntries(Object.entries(localizationFiles).map(([language,file])=>[language,parseIndexedGmd(file)]))
const localizationKey=(value)=>String(value).normalize('NFKC').toLocaleLowerCase('en').replace(/<[^>]+>/g,' ').replace(/\([^)]*\)/g,' ').replace(/\b(?:lv|level)\.?\s*(?:i{1,3}|[0-3])\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim()
const localizedByEnglish=new Map()
for(const [key,value] of localized.en){const normalized=localizationKey(value);if(normalized&&/[a-z]/.test(normalized)&&!localizedByEnglish.has(normalized))localizedByEnglish.set(normalized,{cn:localized.cn.get(key),jp:localized.jp.get(key),key})}
const motionLocalization=(name)=>localizedByEnglish.get(localizationKey(name))??null
const nativeAudit = sourceAudit()
const db = new Database(dataFile)
schema(db)
const hunterArts = db.prepare("SELECT hunter_art_id,weapon_type_id,name_cn,name_en,name_jp FROM catalog_hunter_arts WHERE game_id='mhgu' AND is_placeholder=0").all()
const hunterArtAliases=new Map([['spiralrend','spiralslice'],['chargedshot','chargeshot'],['slicingshell','gunsblazing'],['tranceslashdr','tranceslash'],['tranceslashta','tranceslash'],['tranceslashall','tranceslash']])
const artKey=(name)=>normalizeMotionName(name).replace(/\b(level|lv)\.?\s*(i{1,3}|[123])\b/g,'').replace(/[^a-z0-9]/g,'')
const findHunterArt = (name,weaponTypeId) => {
  const raw=artKey(name);const normalized=hunterArtAliases.get(raw)??raw
  return hunterArts.filter((art) => Number(art.weapon_type_id)===weaponTypeId).filter((art) => { const candidate=artKey(art.name_en);return candidate.includes(normalized)||normalized.includes(candidate) }).sort((left,right)=>left.hunter_art_id-right.hunter_art_id)[0]??null
}
const insert = db.transaction(() => {
  for (const table of ['catalog_weapon_motion_hits','catalog_weapon_motion_variants','catalog_weapon_motion_styles','catalog_bowgun_motion_values','catalog_bow_motion_values','catalog_weapon_motions','catalog_weapon_motion_sources']) db.exec(`DELETE FROM ${table} WHERE game_id='mhgu'`)
  const motionStmt = db.prepare('INSERT INTO catalog_weapon_motions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const styleStmt = db.prepare('INSERT INTO catalog_weapon_motion_styles VALUES (?,?,?)')
  const variantStmt = db.prepare('INSERT INTO catalog_weapon_motion_variants VALUES (?,?,?,?,?,?,?)')
  const hitStmt = db.prepare('INSERT INTO catalog_weapon_motion_hits VALUES (?,?,?,?,?,?,?,?,?,?)')
  const sourceStmt = db.prepare('INSERT INTO catalog_weapon_motion_sources VALUES (?,?,?,?,?,?,?,?)')
  const bowgunStmt = db.prepare('INSERT INTO catalog_bowgun_motion_values VALUES (?,?,?,?,?,?)')
  const bowStmt = db.prepare('INSERT INTO catalog_bow_motion_values VALUES (?,?,?,?,?,?,?)')
  for (const audit of nativeAudit) {
    const suffix=audit.weaponTypeId==null?audit.resourceName.replace(':','-'):`w${String(audit.weaponTypeId).padStart(2,'0')}`
    sourceStmt.run('mhgu', `native-evidence-${suffix}`, audit.weaponTypeId, audit.weaponTypeId==null?'native-hds':'native-hdp', `native/${audit.resourceName}`, audit.sha256, audit.recordCount, audit.weaponTypeId==null?'远程公共弹体 HDS 资源证据':'GU/XX 公共 HDP 逐字节一致；逐动作事件 crosswalk 待精修')
    for(const [index,evidence] of audit.resourceEvidence.entries())sourceStmt.run('mhgu',`native-${suffix}-${evidence.version}-${evidence.kind}-${index}`,audit.weaponTypeId,`native-${evidence.kind}`,`native/${evidence.version}/${evidence.name}`,evidence.sha256,null,`${evidence.size} bytes`)
  }
  sourceStmt.run('mhgu','community-motion-values',null,'crosscheck',path.relative(sourceRoot,referenceFile).split(path.sep).join('/'),sha256(fs.readFileSync(referenceFile)),null,'固定公开交叉验证快照；运行时不读取')
  for(const [language,file] of Object.entries(localizationFiles))sourceStmt.run('mhgu',`native-localization-${language}`,null,'native-localization',path.relative(sourceRoot,file).split(path.sep).join('/'),sha256(fs.readFileSync(file)),localized[language].size,'原生武器操作文本')
  let sourceOrder = 0
  for (const weapon of weaponTypes) {
    const rows = weapon.kind === 'melee' ? collectMelee(arrays, weapon) : weapon.kind === 'bowgun' ? collectBowgun(arrays, weapon) : collectBow()
    if (!rows.length) throw new Error(`No displayable motions for weapon type ${weapon.id}`)
    const identities = new Map()
    for (const row of rows) {
      let slug = normalizeMotionName(row.nameEn).replace(/[^a-z0-9\u3400-\u9fff]+/g, '-').replace(/^-|-$/g, '') || `action-${sourceOrder}`
      const count = identities.get(slug) ?? 0; identities.set(slug,count+1); if(count)slug=`${slug}-${count+1}`
      const motionKey = `${weapon.id}:${slug}:base`
      const allValues = row.variants.flatMap((variant) => variant.values).filter(Number.isFinite)
      const variantTotals = row.variants.map((variant) => variant.values.reduce((sum, value) => sum + value, 0))
      const hunterArt = row.category === 'hunterArt' ? findHunterArt(row.nameEn,weapon.id) : null
      const locale=motionLocalization(row.nameEn)
      const nameCn=hunterArt?String(hunterArt.name_cn).replace(/[ⅠⅡⅢ]$/,''):String(locale?.cn||row.nameEn).replace(/<[^>]+>/g,'').replace(/[\r\n]+/g,' ')
      const nameJp=hunterArt?String(hunterArt.name_jp).replace(/[ⅠⅡⅢ]$/,''):String(locale?.jp||row.nameEn).replace(/<[^>]+>/g,'').replace(/[\r\n]+/g,' ')
      motionStmt.run('mhgu', motionKey, weapon.id, slug, nameCn, row.nameEn, nameJp, row.category, weapon.kind, null, null, null, null, Math.min(...row.variants.map(v=>v.hitCount??v.values.length)), Math.max(...row.variants.map(v=>v.hitCount??v.values.length)), Math.min(...allValues), Math.max(...allValues), Math.max(...variantTotals), row.category === 'hunterArt' && hunterArt == null ? '狩技名称待原生 ID 交叉映射。' : '', hunterArt?.hunter_art_id??null, sourceOrder++, 'secondary-crosschecked')
      for (const style of row.styles) styleStmt.run('mhgu', motionKey, style)
      for (const variant of row.variants) {
        const total = variant.values.reduce((sum, value) => sum + value, 0)
        variantStmt.run('mhgu', motionKey, variant.id, variant.label, variant.condition, variant.styleId, total)
        variant.values.forEach((value,index)=>hitStmt.run('mhgu',motionKey,variant.id,index+1,value,null,null,null,null,1))
      }
      if (weapon.kind === 'bowgun') bowgunStmt.run('mhgu',motionKey,row.category==='hunterArt'?'狩技':row.nameEn,null,null,row.variants[0]?.condition??'')
      if (weapon.kind === 'bow') bowStmt.run('mhgu',motionKey,row.shotType??null,row.chargeLevel??null,null,null,null)
    }
  }
})
insert()
db.pragma('wal_checkpoint(TRUNCATE)')
const counts = db.prepare('SELECT weapon_type_id,count(*) count FROM catalog_weapon_motions WHERE game_id=? GROUP BY weapon_type_id ORDER BY weapon_type_id').all('mhgu')
const unresolvedHunterArts = db.prepare("SELECT count(*) count FROM catalog_weapon_motions WHERE game_id='mhgu' AND category='hunterArt' AND hunter_art_id IS NULL").get().count
const contentTables = [
  ['catalog_weapon_motions','motion_key'],
  ['catalog_weapon_motion_styles','motion_key,style_id'],
  ['catalog_weapon_motion_variants','motion_key,variant_id'],
  ['catalog_weapon_motion_hits','motion_key,variant_id,sequence'],
  ['catalog_bowgun_motion_values','motion_key'],
  ['catalog_bow_motion_values','motion_key'],
  ['catalog_weapon_motion_sources','source_id'],
]
const contentSha256=sha256(Buffer.from(JSON.stringify(contentTables.map(([table,order])=>[table,db.prepare(`SELECT * FROM ${table} WHERE game_id='mhgu' ORDER BY ${order}`).all()]))))
db.close()
fs.mkdirSync(path.dirname(reportFile), { recursive: true })
fs.writeFileSync(reportFile, `${JSON.stringify({ format: 'mh-save-edit-weapon-motions-v1', generatedAtUtc: sourceManifest.generatedAtUtc, sourceContentSha256:sha256(Buffer.from(JSON.stringify(sourceManifest.files))), contentSha256, counts, nativeAudit, unresolvedHunterArts, limitations: ['原生动作名优先采用三语 WeaponControls GMD 精确 crosswalk；未命中的名称保留固定英文交叉验证名，不进行机器翻译。', '当前展示动作值取自固定二级来源；原生 LMT/FUP/HDP/HDS/XFS 到命名动作的逐事件 crosswalk 尚未闭合，未确认的攻击系、斩味补正、减气、气绝保持为空。'] }, null, 2)}\n`)
console.log(JSON.stringify({ dataFile, contentSha256, counts, unresolvedHunterArts }, null, 2))
