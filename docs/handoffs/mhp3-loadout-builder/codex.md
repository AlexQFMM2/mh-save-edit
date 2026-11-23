# P3 配装器交接（未开始实施）

2026-11-23 建立。任务分支 `feat/mhp3-loadout-builder`，基线为已核实的 `release` 提交 `4b21cb1`（v0.1.16，运行资源 v7 已内置 P3 资料）。当前只完成计划与交接，**尚未写任何实现代码**。

## 任务与范围

为 MHP3 实现配装器，参考已完成的 3G／4G／GU／P2G 配装器；P3 有护石，护石部分借鉴 3G，装备身份与写入借鉴 P2G（原生键，不是存档 ID）。范围含手动配装、逐件装珠、手动护石、技能合计、自动配装、导入导出与页面启用；整套写入存档装备箱待用户确认。

## 计划位置

- 规格与批次：`../plan/mh-save-edit/mhp3-loadout-builder/README.md`、`tasks.md`（草稿 r1，108 行，含 T-001…T-008 与 B1…B5）。
- 进度台账：`../plan/mh-save-edit/mhp3-loadout-builder/taskList.md`（草稿，待确认 D1–D3）。
- 外部材料不随切分支变化；复用前先核对分支与基线 `4b21cb1`。

## 已查明的现状（2026-11-23）

- `api/loadout/` 已有完整配装领域：`types`／`calculator`／`rules`／`charm`／`searchCharms`／`ipc`／`schemas`／`file`／`identity`；`LoadoutGame = 'mh3g'|'mh4g'|'mhgu'|'mhp2g'`，`api/core/loadout.ts` 的 `GameId` 不含 P2G——P2G 是“原生键、无护石”的先例。
- 页面 `ui/pages/LoadoutBuilderPage/LoadoutBuilderPage.tsx` 已按 `game.id` 通用化，配装抽屉组件齐全；`ui/data/gameVersions.ts` 的 `hasRuntimeWorkspace()` 现在把 `mhp3` 整体排除，`ui/App.tsx` 的 `Feature()` 对 P3 逐项特判。
- P3 数据（`data/mhp3.sqlite`，只读）：技能 100（99 条带阈值，1 条胴系复制 specialRule）、防具 1,131（含 gender/combat/防御/五属性耐性/孔位/技能）、`p3_armor_skill_points` 4,214 行（4,201 signed + 13 torso-copy-marker，腰 2、脚 7、头 3）、武器 987、装饰品 164（由道具库投影）、护石池候选 266 行（谜之 52／光之 109／古老 104 + 斗士护石 1）。
- 护石证据边界：`p3_skill_charm_sources` 只有 A/B 位置的鉴定池点数范围，`slots` 为 null/0，note 明写“孔数及另一技能的联合条件尚未核实” → 配装端只能标“未确认自然性”，不得升级为 confirmed。
- 存档侧：P3 装备记录 12 字节（武器 type 5..17、防具 0..4、护石 101），`api/save/adapters/mhp3.ts` 已有 `setEquipment`，`api/save/p3/catalog.ts` 有 `patch`，护石位域常量在 `api/save/p3/equipment.ts`。写入路径 `prepareLoadoutWrite` 目前对 mhp3 不可用（`catalogResolver` 的 `resolveEquipmentIdentity` 对 mhp3 返回 null）。

## 已确认决策（2026-11-23）

- D1 **包含**整套写入存档装备箱，作为独立批次 B4。
- D2 用户裁定“这个作为阻碍，需要探查清楚才行”：护石自然生成（池↔品级、双技能联合、孔位）必须先做原生探查，新增研究批次 **B0／T-009**。结论出来前，自动配装只允许固定护石或“不装护石”并报 `unknown-charm-range` 覆盖警告，任何组合不得标 confirmed。
- D3 护石品级沿用存档编辑的 7 档中文名（兵士／斗士／骑士／城塞／女王／王／龙），界面标注“项目译名”。

计划据此已是 r1 确认版（`taskList.md` 状态“待执行”）。B0 超过 40 分钟阈值（40–70），已作为阻碍向用户说明并获准优先做。

## 下一动作

1. **先做 B0（T-009）**：读 `../research/mhp3/` 现有护石／技能专题与 `p3_skill_charm_sources` 构建脚本，确认池↔品级、双技能联合、孔位、点数上下限与胴系复制倍率；结论写私有报告，仓库只更新摘要。
2. 然后从 B1（`api/loadout/types.ts`、`schemas.ts`、`identity.ts`、新建 `p3Candidates.ts`／`p3Repository.ts`、`ipc.ts`、`rules.ts`）开始，`tsc` 会指出所有联合分支遗漏。
2. 实施时按批次推进，完成一批再进下一批；每批先更新 `taskList.md`，再在本文追加“已执行改动／命令／结果”。

## 本地检查命令（本机注意）

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run --exclude '**/.runtime-assets/**' --minWorkers=1 --maxWorkers=2
```

改过 `package.json` 后 `pnpm` 会触发依赖检查并在无 TTY 下中止（`Aborted removal of modules directory`），不要用 `pnpm` 跑本地检查，也不要为此 purge `node_modules`。真实资料自检只读 `data/mhp3.sqlite`，不把真实数据写入仓库或测试夹具。
