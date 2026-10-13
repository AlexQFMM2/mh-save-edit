#!/usr/bin/env node
// Offline queries against a built private delivery; never installs runtime assets.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { auditWeapons } from './mhp2g/weaponCatalog.mjs'
import { expectedWeaponCounts } from './build_mhp2g_weapon_catalog.mjs'

const args = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1]
for (const flag of ['--database', '--assets', '--output']) assert(args.includes(flag) && arg(flag) && !arg(flag).startsWith('--'), `Missing ${flag}`)
const output = path.resolve(arg('--output')), file = path.resolve(arg('--database')), assets = path.resolve(arg('--assets'))
assert(!fs.existsSync(output), 'Verification output exists')
fs.mkdirSync(output, { recursive: true })
const moduleFile = path.join(output, 'repository.mjs')
const require = createRequire(import.meta.url), { build } = createRequire(require.resolve('vite'))('esbuild')
const db = new Database(file, { readonly: true, fileMustExist: true }), before = sha256(file)
try {
  const moduleSource = [
    `export { P2gWeaponCatalogRepository } from ${JSON.stringify(path.resolve(import.meta.dirname, '../api/catalog/p2gWeaponRepository.ts'))}`,
    `export { P2gItemCatalogRepository } from ${JSON.stringify(path.resolve(import.meta.dirname, '../api/catalog/p2gItemRepository.ts'))}`,
    `export { layoutWeaponTree } from ${JSON.stringify(path.resolve(import.meta.dirname, '../ui/utils/weaponTreeLayout.ts'))}`,
    `export { catalogWeaponSummary } from ${JSON.stringify(path.resolve(import.meta.dirname, '../ui/utils/catalogWeapon.ts'))}`,
    `export { p2gReloadLabels, p2gRecoilLabels } from ${JSON.stringify(path.resolve(import.meta.dirname, '../api/catalog/p2gWeaponPresentation.ts'))}`,
  ].join('\n')
  await build({ stdin: { contents: moduleSource, resolveDir: path.resolve(import.meta.dirname, '..'), loader: 'ts' }, outfile: moduleFile, platform: 'node', format: 'esm', bundle: true, packages: 'external' })
  const { P2gWeaponCatalogRepository, P2gItemCatalogRepository, layoutWeaponTree, catalogWeaponSummary, p2gReloadLabels, p2gRecoilLabels } = await import(pathToFileURL(moduleFile).href)
  const repo = new P2gWeaponCatalogRepository(db), audit = auditWeapons(db, expectedWeaponCounts)
  const count = repo.searchWeapons({ gameId: 'mhp2g', pageSize: 100 }).total
  assert.equal(count, expectedWeaponCounts.weapons)
  const all = []
  for (let page = 1; page <= Math.ceil(count / 100); page++) all.push(...repo.searchWeapons({ gameId: 'mhp2g', pageSize: 100, page }).items)
  assert.equal(new Set(all.map(w => w.weaponKey)).size, count)
  const keys = new Set(all.map(w => w.weaponKey)), itemIds = new Set(db.prepare('SELECT item_id FROM catalog_items').all().map(r => r.item_id))
  let detailsRead = 0, recipeAssociationsRead = 0, materialEndpointsRead = 0, rapidFireAssociationsRead = 0, hornSongAssociationsRead = 0
  let ammoItemLinks = 0, coatingItemLinks = 0
  let reviewedHornAssociations = 0
  const hasHornSupplement = Boolean(db.prepare("SELECT 1 FROM catalog_build_metadata WHERE domain='weapons_horn'").get())
  const bowLimits = new Map()
  for (const summary of all) {
    const detail = repo.getWeapon({ gameId: 'mhp2g', weaponKey: summary.weaponKey })
    assert(detail && detail.weaponKey === summary.weaponKey)
    for (const field of ['saveId', 'saveType', 'dexId']) assert(!Object.hasOwn(detail, field))
    assert.equal(detail.affinity, detail.raw.affinity)
    assert.equal(sha256(path.join(assets, detail.iconPath)), path.basename(detail.iconPath, '.png'))
    for (const related of [...detail.parents, ...detail.children]) assert(keys.has(related.weaponKey))
    for (const recipe of detail.recipes) {
      assert(recipe.outputs.some(o => o.weaponKey === detail.weaponKey))
      for (const material of recipe.materials) { assert.equal(material.gameId, 'mhp2g'); assert(itemIds.has(material.itemId)); assert(!Object.hasOwn(material, 'saveId')); materialEndpointsRead++ }
      for (const result of recipe.outputs) assert(keys.has(result.weaponKey))
      recipeAssociationsRead++
    }
    const special = detail.special
    if (special.kind === 'bowgun') {
      assert(p2gReloadLabels[special.reloadRaw] && p2gRecoilLabels[special.recoilRaw])
      for (const ammo of special.ammo) { assert.equal(ammo.loadQuantity, ammo.available ? ammo.capacityTemplate : null); assert(ammo.item && itemIds.has(ammo.item.itemId)); ammoItemLinks++ }
      for (const rapid of special.rapidFire) assert(special.ammo.some(a => a.ammoIndex === rapid.ammoIndex && a.available))
      rapidFireAssociationsRead += special.rapidFire.length
    }
    if (special.kind === 'bow') {
      assert.equal(special.loadUpChargeCount, Math.min(4, special.baseChargeCount + 1))
      assert([2, 3, 4].includes(special.baseChargeCount))
      assert.equal(special.charges.filter(c => c.available && !c.requiresLoadUp).length, special.baseChargeCount)
      assert.equal(special.charges.filter(c => c.available).length, special.loadUpChargeCount)
      assert.equal(special.coatings.length, 6)
      for (const coating of special.coatings) { assert(coating.item && itemIds.has(coating.item.itemId)); coatingItemLinks++ }
      bowLimits.set(special.baseChargeCount, (bowLimits.get(special.baseChargeCount) ?? 0) + 1)
    }
    if (special.kind === 'huntingHorn') {
      for (const song of special.songs) {
        assert.equal(song.duration, null); assert.equal(song.repeatEffect, null); assert.equal(song.skillDuration, null)
        assert(song.nativePatternNewestFirst.length === 4 && song.effectNameJp)
        if (hasHornSupplement) {
          const p = song.performance
          assert(p && p.effectCn && p.repeatEffectCn && p.maestroEffectCn && Array.isArray(p.conditions), 'Missing horn performance')
          if (p.kind === 'timed') for (const t of [p.normal, p.maestro]) assert(t.initialSeconds > 0 && t.repeatSeconds > 0 && t.repeatCapSeconds > 0 && ['extend', 'replace'].includes(t.repeatMode))
          else { assert.equal(p.kind, 'instant'); assert.equal(p.normal, null); assert.equal(p.maestro, null) }
          reviewedHornAssociations++
        }
      }
      hornSongAssociationsRead += special.songs.length
    }
    detailsRead++
  }
  const facets = repo.getWeaponFacets(), trees = []
  for (const type of facets.weaponTypes) {
    const tree = repo.getWeaponTree(type.typeId), endpoints = new Set(tree.nodes.map(n => n.weaponKey))
    assert.equal(tree.nodes.filter(n => !n.isCrossType).length, all.filter(w => w.typeId === type.typeId).length)
    for (const edge of tree.edges) assert(endpoints.has(edge.parentWeaponKey) && endpoints.has(edge.childWeaponKey))
    const positions = layoutWeaponTree(tree.nodes.map(catalogWeaponSummary), tree.edges, 341, 196)
    assert.equal(positions.length, tree.nodes.length)
    assert.equal(new Set(positions.map(p => `${p.x}:${p.y}`)).size, positions.length)
    assert(positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
    trees.push({ typeId: type.typeId, nodes: tree.nodes.length, edges: tree.edges.length, crossTypeEdges: tree.edges.filter(e => e.isCrossType).length })
  }
  assert.equal(trees.reduce((n, t) => n + t.edges, 0), audit.edges + audit.crossTypeEdges)
  const expectedFinal = db.prepare('SELECT weapon_key FROM p2g_weapons w WHERE NOT EXISTS(SELECT 1 FROM p2g_weapon_edges e WHERE e.parent_weapon_key=w.weapon_key) ORDER BY weapon_key').all().map(r => r.weapon_key)
  const foundFinal = []
  for (let page = 1; ; page++) { const result = repo.searchWeapons({ gameId: 'mhp2g', finalOnly: true, pageSize: 100, page }); foundFinal.push(...result.items.map(w => w.weaponKey)); if (!result.hasNext) break }
  assert.deepEqual(foundFinal.sort(), expectedFinal)
  const first = all[0]
  assert(repo.searchWeapons({ gameId: 'mhp2g', query: first.nameJp }).items.some(w => w.weaponKey === first.weaponKey))
  assert(repo.searchWeapons({ gameId: 'mhp2g', targetWeaponKey: first.weaponKey, query: 'intentionally unrelated' }).items.some(w => w.weaponKey === first.weaponKey))
  const items = new P2gItemCatalogRepository(db)
  let reverseMaterialsRead = 0, productItemDetailsRead = 0
  const materialIds = db.prepare('SELECT DISTINCT item_id FROM p2g_weapon_materials').all().map(r => r.item_id)
  for (const itemId of materialIds) {
    const item = items.getItem({gameId:'mhp2g', itemId})
    assert.deepEqual(item.weaponRecipes, repo.getItemWeaponUsages(itemId))
    assert(!item.relations.some(r => r.pendingTarget?.kind === 'weapon'))
    productItemDetailsRead++
    for (const recipe of repo.getItemWeaponUsages(itemId)) {
    assert(recipe.materials.some(m => m.itemId === itemId))
    for (const endpoint of recipe.outputs) assert(keys.has(endpoint.weaponKey))
    reverseMaterialsRead++
    }
  }
  assert(items.searchItems({ gameId:'mhp2g', query:first.nameJp }).items.some(i => i.matchReason?.startsWith('命中：武器材料·')))
  const reciprocal = db.prepare('SELECT a.parent_weapon_key,a.child_weapon_key FROM p2g_weapon_edges a JOIN p2g_weapon_edges b ON a.parent_weapon_key=b.child_weapon_key AND a.child_weapon_key=b.parent_weapon_key WHERE a.parent_weapon_key<a.child_weapon_key').all()
  assert.equal(reciprocal.length, 1)
  assert.equal(sha256(file), before, 'Read-only verification changed database')
  const report = { status: 'passed', databaseSha256: before, audit, detailsRead, recipeAssociationsRead, materialEndpointsRead, reverseMaterialsRead, productItemDetailsRead, ammoItemLinks, coatingItemLinks, rapidFireAssociationsRead, hornSongAssociationsRead, reviewedHornAssociations, bowLimits: Object.fromEntries(bowLimits), finalWeapons: foundFinal.length, trees, reciprocal, limits: ['Offline queries, item links and all native tree layouts verified; browser interactions are verified separately.', hasHornSupplement ? 'Horn performance coverage verified; source comparison belongs to audit_mhp2g_horn_supplement.mjs. No live gameplay test.' : 'Horn performance supplement not installed.', 'P2G save writes are outside this read-only catalog.'] }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ ...report, trees: trees.length, reciprocal: reciprocal.length }, null, 2))
} finally { db.close(); fs.rmSync(moduleFile, { force: true }) }
