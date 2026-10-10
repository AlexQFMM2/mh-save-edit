# P2G 交接：下一步完善怪物图鉴

Status: 待执行
更新日期：2026-10-10
责任归属：项目维护者 / 下一轮接手开发者
适用仓库：`mh-save-edit`
执行方式：串行；没有授权多代理并行

## 从这里接手

用户已认可当前 P2G 道具和译名展示，要求先提交 GitHub、不生成 Release；下一步目标改为完善 **P2G 怪物图鉴**。本次只保存已有成果和交接，不开始实现怪物模块。任务顺序见 [tasks.md](tasks.md)，进度见 [taskList.md](taskList.md)。

先读本文件、[AGENTS.md](../../AGENTS.md)、[P2G 中文资料](../../docs/mhp2g-localization.md)；然后只读检查下述 r9 和怪物快照，从 T-001 的日版原文、怪物身份及部位/状态对应开始。不要重新执行旧 Wiki 抓取或重新构建 r1～r9。

旧 `research/mhp2g/PROGRESS.md`、`HANDOFF-PILOT-R3.md` 以及已经不存在的旧术语计划链接只提供研究历史。其中的暂停点、授权限制、旧目标编号和“下一轮”不代表当前任务。以本次交接和最新用户指令为准，不恢复跨游戏业务表重构。

## 当前已经可以使用的部分

- P2G 首页入口、PPSSPP 标识、封面、背景和工作区九个侧栏功能入口已恢复。道具图鉴可以查询；怪物、任务、装备等页面仍为占位，存档编辑和配装未接入。
- 道具库有 1,261 条原生记录，其中 1 个默认隐藏占位；1,260 个正常展示项均有中文名和图标。名称中 717 个采用 GU 官方用词，543 个采用项目译名。146 条说明已翻译，其余仍为日文。
- 中文依据日版原文和上下文；旧汉化只用于搜索别名。日文、旧名、新名都可查询。详情支持展开日文说明；“待验收”“待审校”等内部状态不出现在用户界面，内部证据仍保留。
- 全局道具词典独立、可选；各游戏编号、数值、技能机制、关系与存档格式仍独立。词典当前仅处理道具，不能直接拿来合并怪物或装备身份。
- 当前最新已发布应用仍是 `v0.1.11`；本次代码检查点不改版本号、不打标签、不创建 Release。P2G 库和词典尚未纳入公开运行资产包或 Windows 打包白名单。

## 本地可继续使用的固定输入

以下路径以仓库相邻的 `../research/` 为根，均为私有资料，**不是 GitHub 内容**。构建必须读固定快照，输出到新版本目录；不要修改旧快照。

| 输入 / 产物 | 路径 | 用途 |
| --- | --- | --- |
| 冻结先导库 | `generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite` | 原生编号、数值、关系；不能把旧汉化当定名依据 |
| 日版文本 | `mhp2g/japanese-catalog-v1/texts.json` 与同目录 manifest | 正确日文；原生文本表 0 的 103～192 为怪物名范围，须逐项复核绑定 |
| 当前译文记录 | `mhp2g/localization-review-v3/items.json` | 道具名称和说明的逐条依据 |
| 官方用词依据 | `generated/mh-save-edit/terminology/versions/gu-pass-02/` | 已验证 GU 官方简中；怪物使用前检查对应对象类型及证据 |
| 当前道具本地化 | `generated/mh-save-edit/mhp2g/localization-v4/` | 尚未建立怪物本地化绑定 |
| 当前道具交付 | `generated/mh-save-edit/mhp2g/catalog-japanese-v4/` | 道具数据库、图标映射和私有审计 |
| 当前配套词典 | `generated/mh-save-edit/item-terminology/v6/` | 四作数据库副本和道具词典；本地安装了其中 P2G 库与词典 |
| 原生道具图标 | `generated/mh-save-edit/mhp2g/icons-v1/` | 277 张道具 PNG；不能当作怪物图标映射 |

怪物专项已有输入：

- `mhp2g/native-monsters-v1.json`、`native-drops-v1.json`：原生定义、肉质、耐性、奖励池和来源定位。
- `mhp2g/japanese-monster-evidence-v1a/`、`japanese-monster-evidence-v1b/`：60 页历史日文 Wiki 正文及来源记录。
- `mhp2g/monster-table-observations-v1.json`：443 张带标题表，含 69 张肉质表；保留原始表格、单元格坐标、多行/合并单元格和单位。**尚未绑定原生怪物/部位/状态 ID**。
- `mhp2g/normalize-monster-tables-v1.py`、`verify-map-monster-v1.py` 与 `map-monster-tests-v1.json`：历史解析和保真检查；通过不等于游戏语义、单位或跨表关系已验证。

宿主机记录入口：干净日版位于 `D:\MH\unpack\mhp2gjp`，旧汉化展开位于 `D:\MH\unpack\mhp2g\P2G-CGCN`。按 AGENTS 的 SSH 登记只读访问；旧脚本中的 IP 不能视为永久有效。本次交接没有重新连接宿主机、运行提取器或写宿主机文件。

## 怪物资料已知情况与缺口

2026-10-10 只读检查 r9：90 个定义（原生 ID 0～89，含占位/变体，不代表 90 个独立物种）、78 组肉质数组、546 行肉质、90 个模式引用、450 组耐性、1,925 条奖励关系/奖励池、4,377 条奖励行。

1. **部位和状态仍未解释。** 546 行 `hitzones.part_name` 和 90 行 `monster_hitzone_modes.mode_name` 均为空。保留数组共享关系和多状态，不能按 Wiki 行序直接套名称；肉质首字节 `unknown_first_byte` 不是已确认的部位 ID。
2. **原生来源版本要交叉核实。** r9 怪物数据来自旧镜像；干净日版此前仅完成 BOOT、道具记录和文本等核对，不等于怪物 overlay 已逐项一致。定向核对 `game_task` / `game_sub`（历史索引 51 / 56）及相关窗口的来源和记录哈希，不能只凭光盘 ID 或 BOOT 相同判等。
3. **名称独立绑定。** 日版原名优先；确认同一怪物后借用 GU 官方名称，独有怪物按日文和上下文翻译。普通种、亚种、特殊状态、占位和同名原生记录分别保留，中文相似不构成 ID 对应依据。
4. **单位和列顺序不能猜。** 耐性中的 `_raw`、恢复周期、时长、毒伤害、未知耐性组、陷阱效果须有独立解释。原生肉质列与 Wiki 的雷/冰顺序不同，必须按字段名对应；不能直接套其他作数据或把空值转成 0。
5. **奖励语义尚有缺口。** 位阶槽、剥取/捕获/掉落/破坏、部位代码分别核实。剥取和掉落物无数量字段时保持未知，不能补成 1。原生概率已有百分数，不重复乘 100。端点必须连接当前 P2G `itemId`，名称从现有道具库取得。
6. **怪物图标尚未接入。** 道具 atlas 的成功不证明怪物图标资源键或裁切已确定。优先在宿主机只读定位真实怪物图标；不得凭相近编号复用，也不把完整图集拉回 Linux。
7. **任务关系另有边界。** 任务观察与实际脚本不是同一完成度；重复任务 ID 和变体要保留。可以在怪物模块提供有证据的出没任务，未闭合信息保持未知，不为接怪物页强行完成整套任务图鉴。

## 接入点与实现约束

| 层 | 当前入口 | 下一步注意事项 |
| --- | --- | --- |
| 导航 | `ui/App.tsx`、`ui/data/gameVersions.ts` | P2G 仅放行道具；怪物就绪后单独放行，不把 `hasRuntimeWorkspace` 改成整体支持存档/配装 |
| IPC / 类型 | `api/catalog/ipc.ts`、`schemas.ts`、`types.ts`、`desktop/preload.ts`、`ui/env.d.ts` | 怪物仍用三作 `GameId`；增加独立 P2G 查询适配，勿顺手扩大全局存档 GameId |
| 已有怪物 UI | `MonsterCatalogPage`、`MonsterSearchList`、`MonsterDetailPanel`、`MonsterDetailDrawer` | 复用列表/详情能力；先解决类型、空值、身份及关系适配，不复制超长页面 |
| 道具关联 | `tools/mhp2g/relations.mjs`、`api/catalog/p2gItemRepository.ts` | 目前怪物关系仅 `pendingTarget`，需在证据闭合后升级为真实怪物身份 |
| 旧怪物后端 | `api/catalog/monsterRepository.ts` | 依赖旧三作 schema，掉落为 `saveId`，概率转百分比，若干数值默认转 0；不直接接 P2G 原始表 |
| 当前道具身份 | `api/catalog/itemIdentity.ts`、`ItemDetailDrawer` | P2G 是 `{ gameId: 'mhp2g', itemId }`；其他三作继续使用 `saveId` |

正文关联点击打开一级详情抽屉；抽屉内再次关联必须关闭后跳转定位，不能嵌套。怪物掉落点击道具、道具获取点击怪物应双向闭合。搜索和关联使用 ID 定位，不能仅按译名寻找目标。下拉复用 SearchableSelect，标签水平排列；页面/组件样式按 AGENTS 隔离。

本阶段按“数据与名称证据 → 图标证据 → 构建和接口 → 页面与双向关系 → 验证”推进。无交付日期承诺，上一阶段验收后再进下一阶段。武器、防具、技能、存档、配装和完整游戏汉化补丁不随本任务一起展开；游戏补丁仍放最后。

## 验证、发布与恢复

已有检查：提交前 CI 同范围回归 528 项通过、7 项按条件跳过；额外私有武器数据检查 8 项通过；编译后 GU Worker 1 项通过、2 项因缺少对应私有输入跳过。三作运行资料审计、类型检查和应用构建已通过。此前 P2G 全量运行检查读取 1,261 道具、688 关联道具端点、20,771 待接对象；译名 v6 的独立 Electron 25 项检查通过，随后去除内部提示的 8 项 UI 回归通过。不同阶段检查范围见 [中文资料说明](../../docs/mhp2g-localization.md)。

下一阶段至少验证：编号/来源/图标覆盖、未知值保留、肉质雷冰列与状态区分、奖励位阶/方法/数量/概率、负向错配拒绝、道具双向抽屉、搜索与 URL 定位、三作回归，以及 1366×768 / 3440×1440 的滚动与底栏。真实研究报告只放本地忽略目录。

公开 Git 仅保存代码、合成测试、文档和已恢复的首页静态资源；数据库、游戏图标、文本快照、manifest、crosswalk、审计和存档保持私有。本地 `data/mhp2g.sqlite`、`data/item-terminology.sqlite` 及 `.runtime-assets/` 被忽略。社区从 Git 克隆不会获得 P2G 数据，README 已说明缺库行为和重建入口。

当前 P2G 库与词典的安装前备份在 `.runtime-assets/item-terminology/pre-v6/`。后续安装前另建成套备份，核对资料和词典身份指纹；出错成套回退，不混装版本。用户自行重启应用，不自动关闭有未保存状态的会话。代码回退使用新 revert 提交，不重写已公开历史。

本次 `main` 推送只触发 CI 检查；Windows 打包与 Release 仅由 `v*` 标签触发。本次禁止创建标签/Release。后续发行需另行明确范围，不把研究产物加入 Git 或公开 Action artifact。

## 变更记录

- 2026-10-10：用户确认下一步为 P2G 怪物图鉴；创建交接与串行任务清单，保留旧计划归档。
