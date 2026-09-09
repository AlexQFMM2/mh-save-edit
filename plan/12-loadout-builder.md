# 三作配装器阻塞探测与实施计划

状态：阻塞探测完成，尚未开始实现（2026-09-09）

范围：选择武器、选择防具、护石、装饰珠配置、自动配装
目标：在不依赖已打开存档的情况下完成逻辑配装；开始配装器前先完成独立技能图鉴。存档装备箱导入和一键写入不属于本轮，留到存档编辑阶段接入。

本计划只记录证据、阻塞和实现顺序，不在本阶段修改 React、Repository、IPC 或存档代码，也不启动开发服务器。

## 1. 探测结论

### 1.1 旧项目并非从零迁移

三套旧修改器已经有可复用的配装领域逻辑、测试夹具和自动搜索生命周期：

| 内容库 | 已确认能力 | 迁移证据 | 当前结论 |
| --- | --- | --- | --- |
| MH3G/MH3U | 七槽手动配装、装备/护石选择、逐件装珠、技能矩阵、胴系统倍加、自动搜索、暂停/继续/取消、JSON 和写入装备箱 | `../mh3u-se/docs/MH3G_LOADOUT_BUILDER_PLAN.md`、`tests/test_loadout*.cpp` | 规则和回归夹具成熟，可迁移为纯 TypeScript |
| MH4G | 普通/发掘实例手动配装、自然护石候选、技能目标、性别分支、剪枝、去重、结果复核、暂停/取消 | `../mh4g-se/src/loadout.*`、`src/loadout_search.*`、`plan/README.md` | 普通装备可进入首版；发掘实例必须保持固定输入边界 |
| MHGU/XX | 自动数据完整性门禁、自然护石、逐件装珠、胴系统倍加、稳定 fingerprint、暂停/继续/取消 | `../mhgu-xx-se/src/loadout.*`、`src/loadout_search.*`、`tests/core_tests.cpp` | 可作为三作规则插件和 Worker 生命周期参考 |

旧项目证明算法可用，但不能直接搬 Qt 控件、线程对象或存档格号。新项目需要重新定义跨游戏领域协议，并通过合成夹具逐作对照。

### 1.2 当前 SQLite 已具备的输入

- `catalog_weapons`、`catalog_armors`、`catalog_armor_skills`、`catalog_decorations`、`catalog_decoration_skills` 和 `catalog_skills` 已存在。
- MH3G：`charm_classes` 10 类，`charm_combinations` 121,952 条自然组合。
- MH4G：`charm_classes` 14 个可用品级，`charm_skill_ranges` 633 条技能范围，`charm_class_rules` 14 条来源/孔位规则。
- MHGU/XX：`cn__talismans` 10 个有效品级，`cn__talisman_skill_limits` 2,060 条技能限制，`cn__talisman_slot_thresholds` 80 条孔位门槛。
- Dex 已提供完整发动关系：3G 238 条、4G 278 条、GU/XX 327 条。当前 GU/XX 统一库只有 326 条，缺少被特殊处理的胴系统发动关系，需由技能图鉴构建器修正。

因此，护石候选和技能发动并非等待解包的阻塞，而是需要统一字段、来源和规则语义的工程任务。

## 2. 已确认阻塞

### P0：必须先解决

1. **技能图鉴尚未形成独立闭环**

   当前只有由防具/装饰品触发的 `SkillDetailDrawer`，没有技能列表页；现有详情还会丢失发动点数、正负方向、说明和复合技能组成。配装器无法据此让用户可靠地选择“攻击力提升【大】”这类目标。必须先完成 [13-skill-catalog.md](13-skill-catalog.md) 的统一数据、Repository/IPC 和页面，再开始配装计算器。

2. **配装身份协议仍是占位模型**

   当前 `api/core/loadout.ts` 只有模糊的 `equipmentId`、`level` 和装饰珠数组，不能表达：

   - 稳定武器 `weaponKey`（类型 + 存档身份 + Dex 来源）；
   - 防具 `dexId` 与可写入 `save_type/save_id` 的多重映射；
   - 护石品级、孔位、两项技能及有符号点数；
   - 版本化 `contentGame`、`dataVersion`、来源和证据等级；
   - 固定装备实例与“仅图鉴候选”的区别。

   在协议重构前，选择器、计算器和 JSON 会互相猜 ID，不能安全实现。

3. **三作规则必须插件化，禁止散落 `if (game === ...)`**

   胴系统倍加的技能树 ID 已确认不同：MH3G/MH4G 为 `1`，MHGU/XX 为 `203`。它们必须由 `GameLoadoutRules` 明确提供，并同时定义：

   - 武器类型与远近程约束；
   - 防具职业、性别和部位约束；
   - 胴系统复制范围；
   - 装饰珠孔位计费与每件记录容量；
   - 护石自然范围和可编码范围；
   - 发动技能阈值选择（正面、负面、最高已发动等级）。

4. **缺少统一技能发动阈值接口**

   现有 `SkillCatalogRepository` 只从防具/装饰品关系拼接发动技能名称，未向配装计算器提供稳定的阈值、方向和等级顺序。[13-skill-catalog.md](13-skill-catalog.md) 将统一生成 `catalog_skill_activations` 和 `catalog_skill_components`，并以稳定 `activation_key` 区分技能系 ID、Dex 发动 ID及复合效果。

   负阈值必须保留；自动搜索目标只允许选择正向发动技能。没有阈值的技能只能显示点数，不能伪造“已发动”。

5. **GU/XX 非线性技能效果尚未进入统一规则**

   GU/XX 数据中已经存在 `203 身体系统加倍`、`204 秘术 / Skill +2` 和 `205 护石强化 / Double Talisman`。旧 GU 自动搜索明确处理了 `203`，但当前探测没有找到 `204/205` 的等价计算路径。正式计算器必须从原生说明和固定配装样本确认它们对防具、护石、装饰珠及技能发动顺序的准确作用；未闭合前不能把 GU/XX 计算器标为完整，也不能按名称猜规则。

   同一审计要列出三作全部“非普通加法”技能，避免只修三个已知 ID 后遗漏其他特殊效果。

6. **自动搜索不能运行在 renderer 主线程**

   三作候选组合和装珠搜索会产生长任务。必须迁移到 Worker（优先 `worker_threads`，通过受限消息协议通信），并具备进度、暂停、继续、取消、超时和结果序号。每个结果还要调用正式 `calculateLoadout()` 二次复核，不能信任搜索中间摘要。

### P1：实现时需要闭合

7. **护石规则的证据等级需要显式保留**

   MH3G 自然组合表最完整；MH4G 规则来自已保存的 MIT 规则页，适合作为候选门禁，但不等同完整原生掉落概率生成器；MHGU/XX 有已审计的技能限制和孔位门槛。UI 必须展示来源/“自然范围”状态，不把规则概率描述为实际掉落概率。

8. **本地配装文件协议尚未落地**：需要等新身份模型和 `dataVersion` 冻结后定义 `.mhloadout.json`，导入必须重新查询当前数据库并重新计算。

## 3. 本轮明确排除的存档能力

- 不读取装备箱，不提供“当前装备箱”候选源，不保存箱子格号。
- 不实现“一键写入装备箱”，也不以防具 save identity 覆盖率作为本轮配装计算门槛。
- 当前防具 Dex → 存档身份数量（MH3G 1600/1651、MH4G 1394/3119、MHGU/XX 5571/5726）只登记为未来物化写回风险。
- MH4G 发掘装备首版不出现在图鉴候选或自动搜索中。后续存档接入后，只能把装备箱中的完整 28 字节实例作为手动固定输入；自动配装始终排除发掘武器、防具、非法护石、超孔珠和其他非自然候选。
- 猎虫、猫装备和其他动态实例不塞进猎人七槽基础模型。

## 4. 非阻塞项

- 武器、防具、装饰珠名称、属性、技能点和图标查询已具备 Repository/IPC 基础。
- 现有 `SearchableSelect` 已支持中英文关键词和多选，可直接作为武器类型、技能、护石品级和装饰珠选择基础；需要补充大数据量分页/延迟查询，而不是另造原生 `<select>`。
- 护石不需要把十几万自然组合渲染成列表，采用品级、孔位、技能 1/2 和点数表单，实时调用规则验证即可。
- 自动配装不需要等待存档打开；使用图鉴候选即可先完成纯计算和本地 JSON。
- MH3G/MH4G/GU 三作旧搜索主路径和生命周期测试成熟；迁移工作量可控，GU/XX 的少量非线性技能效果按 P0 单独闭合。

## 5. 目标领域协议

第一步冻结以下纯 TypeScript 类型，页面、Repository、Worker 和未来存档桥接都只依赖这些类型：

```ts
type LoadoutGame = 'mh3g' | 'mh4g' | 'mhgu'
type LoadoutSlot = 'weapon' | 'head' | 'chest' | 'arms' | 'waist' | 'legs' | 'charm'
type ArmorLoadoutSlot = 'head' | 'chest' | 'arms' | 'waist' | 'legs'

type LoadoutWeapon = {
  kind: 'weapon'
  gameId: LoadoutGame
  weaponKey: string
  saveType: number
  saveId: number
  decorations: DecorationChoice[]
}

type LoadoutArmor = {
  kind: 'armor'
  gameId: LoadoutGame
  armorDexId: number
  decorations: DecorationChoice[]
}

type LoadoutCharm = {
  classId: number
  slots: number
  skill1: { skillId: number; points: number } | null
  skill2: { skillId: number; points: number } | null
  decorations: DecorationChoice[]
  naturalStatus: 'natural' | 'manual' | 'unknown'
}

type Loadout = {
  schemaVersion: 1
  dataVersion: string
  gameId: LoadoutGame
  name: string
  gender: 'male' | 'female'
  weapon?: LoadoutWeapon
  armor: Partial<Record<ArmorLoadoutSlot, LoadoutArmor>>
  charm?: LoadoutCharm
}
```

正式实现时再把现有 `api/core/loadout.ts` 拆为 `model.ts`、`rules.ts`、`calculator.ts`、`file.ts` 和 `search.ts`，避免继续扩大占位文件。

Repository/IPC 最小接口为：

```ts
searchLoadoutWeapons(filters): PageResult<LoadoutWeaponCandidate>
searchLoadoutArmors(filters): PageResult<LoadoutArmorCandidate>
searchLoadoutDecorations(filters): PageResult<LoadoutDecorationCandidate>
getLoadoutFacets(gameId): LoadoutCatalogFacets
getLoadoutSnapshot(gameId): LoadoutCatalogSnapshot
validateCharm(charm): CharmValidationResult
startAutoLoadout(request): AutoLoadoutJobId
controlAutoLoadout({ jobId, action }): void
```

所有输入继续经 Zod 严格校验。SQLite 只在主进程只读访问；Worker 接收不可变、可序列化快照，不持有数据库连接、文件路径或 renderer 状态。

## 6. 页面与组件实施计划

实现按职责拆分，至少包含：

```text
ui/pages/LoadoutBuilderPage/
ui/components/LoadoutToolbar/
ui/components/LoadoutSlotGrid/
ui/components/LoadoutSlotCard/
ui/components/LoadoutSkillMatrix/
ui/components/LoadoutSummaryPanel/
ui/components/EquipmentPickerDialog/
ui/components/CharmPickerDialog/
ui/components/DecorationEditorDialog/
ui/components/AutoLoadoutDialog/
ui/components/AutoLoadoutResultList/
ui/components/AutoLoadoutResultRow/
ui/components/WorkspaceDialog/
```

每个页面/组件均使用独立 `.tsx` 与 `.css`。`WorkspaceDialog` 只负责 portal、遮罩、dialog 语义、焦点锁定/归还和滚动隔离，不包含配装业务。

### 6.1 七槽主页面

固定顺序：

```text
武器｜头｜胸｜腕｜腰｜腿｜护石
```

每槽显示当前名称、稀有度/品级、孔位状态、来源和合法性。变化只更新内存 `LoadoutModel`，不设置存档 dirty。详情、技能矩阵、防御/耐性和孔位汇总由纯计算器产生。

### 6.2 选择武器弹窗与选择防具弹窗

新增独立 `EquipmentPickerDialog`，通过槽位参数约束候选：

- 武器弹窗支持名称/中英 ID 搜索、武器类型、稀有度、孔位、可生产和近远程摘要；不能切换为防具或护石。
- 防具弹窗由头/胸/腕/腰/腿固定部位，支持名称/ID、稀有度、孔位、剑士/枪手、性别和技能条件；不提供部位下拉。
- 候选选择后再次校验游戏、部位、`save_type`/`save_id` 或 `dexId`，防止 UI 状态污染。
- 详情区显示完整技能点；防具统一使用稳定 `dexId` 参与纯计算，不要求当前已经具备存档写回身份。
- 自动搜索只使用有效、非占位、非发掘的普通图鉴装备以及自然护石/装珠组合。

### 6.3 护石表单

新增独立 `CharmPickerDialog`，不渲染 12 万行：

- 品级、孔位、技能 1/2、带符号点数使用水平紧凑表单。
- 实时显示自然范围、编码范围和来源证据；非法手动护石可以保留为 `manual`，但自动搜索不得生成。
- 技能选择统一使用 `SearchableSelect`，按中英文关键词搜索。
- 护石装饰珠与普通装备共用 `DecorationEditorDialog`，孔位计算由规则插件负责。

### 6.4 装饰珠配置

新增独立 `DecorationEditorDialog`：

- 顶部固定显示天然孔、已用孔、剩余孔和合法性状态。
- 候选列表按名称、ID、占孔和技能点筛选；显示正负技能点，不只显示主技能。
- 最多保存装备记录允许的珠子数量，按真实占孔计费；超孔、DUMMY、未映射不自动清除，明确警告。
- 关闭使用“应用/放弃”，只更新本地配装模型。

### 6.5 自动配装

自动搜索输入包括：固定具体武器（必填）、目标发动技能及等级、性别、固定装备/护石、自然域、结果数和排序权重。首版不以抽象武器孔位代替具体武器，也不提供“仅装备箱已有”，保持纯图鉴计算边界。

搜索顺序固定为：候选预筛 → 安全支配剪枝 → 部位组合上界 → 护石候选 → 装饰珠补足 → 稳定去重 → 正式计算复核。结果回填前再次检查七槽身份、性别/职业和护石自然状态。

Worker 消息协议至少包含 `start`、`progress`、`pause`、`resume`、`cancel`、`result`、`finished`、`error`；每次搜索使用 `requestId + dataVersion`，过期结果丢弃。

## 7. UI/UX 规范与交互验收

本项目采用桌面高密度棕金界面，但不牺牲键盘和反馈：

- 弹窗使用真正的 dialog 语义和遮罩，打开后焦点进入搜索框/关闭按钮，Tab 顺序与视觉顺序一致，Escape 关闭并归还原焦点。
- 每个按钮、列表行、筛选器都有可见焦点环；选中/展开/禁用状态同时使用文字或 `aria-*`，不只依赖颜色。
- 搜索框采用短延迟；候选表使用分页或虚拟化，避免一次渲染全部装备/装饰珠。长标识允许换行，不撑破弹窗。
- 选择弹窗的主要操作保证足够点击区域；窄视口时改为覆盖式抽屉/单列，不压缩七槽主页面。
- 自动搜索右侧固定显示阶段、已检查状态数、结果数、进度/耗时和暂停/继续/取消；空结果、数据门禁失败、超时和取消都给出可理解原因。
- 结果区独立滚动，搜索控制固定；选择结果时保留旧详情直到新结果完成，避免闪烁。
- 遵循全局五档字号、亮金数据色、水平标签 + 控件和低对比滚动条；组件使用独立 `.tsx` + `.css`，不把业务样式写入全局。
- `prefers-reduced-motion: reduce` 时取消弹窗位移和列表过渡，仅保留必要状态变化。

这些要求来自本项目现有 `AGENTS.md`，并经过 UI 审阅确认：焦点可见/可回收、键盘顺序完整、长任务进度反馈、长列表性能和小组件职责边界均为高优先级。

## 8. 分阶段执行顺序

1. **技能图鉴**：先完成 [13-skill-catalog.md](13-skill-catalog.md)，统一技能系、发动阈值、说明和复合关系，提供独立技能搜索页。
2. **协议冻结**：拆分 Loadout 身份、护石、规则插件、诊断和版本化 JSON 类型；为三作建立合成快照。
3. **数据扩展**：新增 `tools/build_loadout_catalog.mjs` 和私有审计命令，归一生成 `catalog_talisman_classes`、`catalog_talisman_skill_limits`、`catalog_talisman_slot_rules`；MH3G 的显式自然组合另存 `catalog_talisman_combinations`，不强行把三作不同来源压成同一算法。
4. **纯计算器**：实现 `calculateLoadout(snapshot, loadout)`、技能矩阵、胴系统、防御/耐性/孔位和诊断；先闭合 GU/XX 的 `Skill +2`、`Double Talisman` 等特殊效果，再逐作对照旧测试。
5. **选择器**：实现武器/防具弹窗、技能条件和键盘交互。
6. **护石与装珠**：实现护石表单、自然范围验证和逐件装饰珠编辑。
7. **本地文件**：实现 `.mhloadout.json` 导入/导出，导入后按当前 `dataVersion` 重查并重算。
8. **自动 Worker**：迁移三作搜索核心，加入进度、暂停、取消、超时、稳定排序和正式复核。
9. **未来存档桥接**：另开阶段接入装备箱来源和一键写入，不纳入本轮验收。

## 9. 测试与数据门槛

### 协议与 Repository

- 三作身份、槽位、部位、职业、性别和来源不能交叉污染。
- 名称、十进制/十六进制 ID、技能多条件、孔位、稀有度、可生产和分页筛选均有测试。
- 护石自然范围、手动非法值、负技能点和三作胴系统 ID分别测试。
- GU/XX `Skill +2`、`Double Talisman` 及审计发现的其他非线性技能必须有来源样本和独立计算测试。
- 防具按 `dexId` 正确计算；MH4G 发掘装备、占位装备和非自然候选不会进入自动搜索。

### 计算器与自动搜索

- 单件技能、防御、耐性、孔位和正负发动阈值与旧项目固定夹具逐项一致。
- 一件/多件胴系统只复制胸部固有技能与胸部装饰珠，不复制其他部位。
- 相同输入与 `dataVersion` 输出 fingerprint 和排序稳定；所有结果经过正式计算器复核。
- Worker 暂停/继续/取消/超时不会泄漏线程；过期 request 不覆盖当前结果。

### UI

- 七槽、选择武器/防具、护石、装珠和自动配装均可纯键盘完成；弹窗焦点不丢失、不嵌套。
- 选择器 URL/本地状态恢复、重置、空结果、加载失败和候选图片 fallback 可理解。
- 自动搜索进度持续更新，取消后保留当前配装；结果回填只更新内存模型。
- 在 1024px、1280px、1440px 下窗口整体不滚动，列表/详情各自内部滚动；减少动态效果时无位移动画。

### 最终质量门槛

```text
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

正式实现前必须先完成真实样本清单和私有来源 manifest；SQLite、护石规则快照、装备箱原始记录、配装 JSON 样本和自动搜索结果均留在 `research` 或已忽略目录，不提交 GitHub。

## 10. 明确边界与假设

- 首版配装不要求读取存档即可使用，默认从完整图鉴选择装备。
- 当前版本不读取装备箱，也不包含格号、存档路径或原始偏移。
- MH4G 发掘武器/防具留到存档接入后作为手动固定实例；自动搜索永久排除。
- MHGU 与 MHXX 共用内容库和动作/技能数据，但未来存档 adapter、平台和写回身份必须分开。
- 狩技、猎虫、猫装备不是猎人七槽基础配装；需要单独扩展模型。
- 自动配装首版默认按目标满足、风险、剩余孔位、防御、耐性和稳定 ID 排序，允许后续调整权重。
- 护石自然规则保留来源证据等级，不把社区/规则页数据冒充完整掉落概率。
