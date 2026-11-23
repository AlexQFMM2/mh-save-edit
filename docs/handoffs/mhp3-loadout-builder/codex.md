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

## B0 护石原生探查（2026-11-23 完成）

按用户指令“这一步就去探测阻碍吧”，完成 T-009。研究产物在仓库外私有区 `../research/mhp3/charm-generation-20261123/`：`README.md`（结论）、`native-charm-legality-contract.json`（机读规则）、`natural-witness-validation.json`（存档见证），以及 7 组探针 `*-v1/`（query/result/run 哈希）。

- 鉴定函数 `overlay104:0x09dbb23c`（调用点 `0x09dbbc64`），主程序 `755e5d84…`、overlay104 `a73d283a…`。
- 道具 ID 808/809/810 分派 なぞ/光る/古びた：技能池（52/55+54/43+61）、技能二阈值 100/35/25、点数范围与正负分支、重复技能清除均已从代码读出。
- rank = `trunc(p1/(max1*0.1)+p2/(max2*0.1))`，负点不计，限 0..20；`0.1` 是原生常量 `0x09dd1480`。
- 孔位：`rng%100` 与 rank 对应 21×4 字节累计表（三张表每行合计 100，已逐行核对），取第一个累计值大于 roll 的孔数。
- 品级：`f = rank + 2*slots`，なぞ `f<8→0/1`、光る `→2/3`、古びた `<8→4、8–12→5、≥13→6`，即七类護石与三类鉴定来源的对应关系。
- 胴系复制：`main:0x0885cdf8` 以“胴部点数 ×（1+marker 数）”的加法堆叠形状实现，`mult` 已见；六个容器偏移到部位的映射留待补一次追踪。
- 见证：私有存档 38 条护石中 9 条满足原生规则（含自然高品级 0 孔），29 条点数 15/20 或 3 孔不可达，属用户编辑护石被按原因拒绝。该存档含编辑内容，故只作一致性见证，不作完整性证明。

### 需要重规划的部分（等待批准）

B2 原设计假定护石自然性“未确认”，只允许固定/无护石并报 `unknown-charm-range`。原生规则查清后该假定作废，涉及两处冻结内容：

1. **规则数据来源**：新增“护石规则进入运行数据”的数据批次（二选一）——在 `mhp3.sqlite` 追加护石池/孔位/品级表（需 builder、schema 版本、审计与运行资源 v8），或随运行资产发布一个只读规则 JSON。两种都要改 CI 固定哈希与资源包。
2. **枚举策略**：自动配装可按原生规则枚举护石候选（品级由 rank+2*slots 反推、孔位按累计概率可达性），不再一律 `unknown`；需要在任务里明确“可达即可生成”的语义与抽样/去重上限。

未获批准前 B2 标记阻塞；B1/B3/B4/B5 不受影响。批准后我会一次性改 `../plan/.../README.md` 与 `tasks.md` 的 D2 段、B2 批次和排期，并在本文件记录新图。
