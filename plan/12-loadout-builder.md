# 三作配装器阻塞探测与实施计划

状态：阶段 3A 首版实现与私有数据审计完成，等待真实存档桥接（2026-09-10）

范围：选择武器、选择防具、护石、装饰珠配置、自动配装
目标：在不依赖已打开存档的情况下完成逻辑配装；独立技能图鉴前置已经完成。存档装备箱导入和一键写入不属于本轮，留到存档编辑阶段接入。详细交互方案见 [14-loadout-builder-ui.md](14-loadout-builder-ui.md)。

本文保留开工前的探测证据，同时记录已经落地的领域模型、Repository/IPC、React 工作台和 Worker 自动搜索；装备箱导入与一键写入仍不属于阶段 3A。

## 0. 实施完成快照

- `api/loadout` 已落地版本化七槽身份、三作规则插件、纯计算器、自然护石验证、MH4G 发掘 28 字节补丁、本地文件重水合和 Worker 自动搜索。
- `/game/:gameId/edit/loadout` 已替换占位页，提供七槽表、装备属性、技能矩阵、合法性诊断，以及选择装备、护石、装珠和自动配装四类一级工作抽屉。
- 自动配装支持多目标优先顺序、三级固定状态、自然 A/B 双技能护石候选、暂停/继续/取消、进度和应用前正式复核；具体武器始终固定，珠子是否固定由状态单独决定。任务由主进程持久服务管理，单 Worker 顺序执行，关闭抽屉后继续运行并可从历史抽屉恢复、重跑、删除或应用结果。
- `.mhloadout.json` 导入使用严格 schema，跨游戏嵌套身份会被拒绝；普通图鉴装备和已知装饰珠按当前快照重新水合，不能通过导入伪造技能、防御或孔位。
- 护石校验范围仅作为界面辅助数据，不进入逻辑配装或历史结果；早期本地历史中误存的 `charm.ranges` 会在重水合前定向清理，其他未知字段仍由严格 schema 拒绝。
- 私有构建已生成并审计 MH4G 发掘武器 435、发掘防具 1,250、换算记录 376；正式模板均为 28 字节、外键与长度异常为零。1,685 条旧 `raw_hex` 长度异常只进入私有报告，不补零、不截断、不作为模板。
- 连续构建的 `build-report.json` SHA-256 一致；终端仅输出摘要，详细旧格式失败清单继续留在 `research/generated`。

## 1. 探测结论

### 1.1 旧项目并非从零迁移

三套旧修改器已经有可复用的配装领域逻辑、测试夹具和自动搜索生命周期：

| 内容库 | 已确认能力 | 迁移证据 | 当前结论 |
| --- | --- | --- | --- |
| MH3G/MH3U | 七槽手动配装、装备/护石选择、逐件装珠、技能矩阵、胴系统倍加、自动搜索、暂停/继续/取消、JSON 和写入装备箱 | `../mh3u-se/docs/MH3G_LOADOUT_BUILDER_PLAN.md`、`tests/test_loadout*.cpp` | 规则和回归夹具成熟，可迁移为纯 TypeScript |
| MH4G | 普通/发掘实例手动配装、发掘高级字段、自然护石候选、技能目标、性别分支、剪枝、去重、结果复核、暂停/取消 | `../mh4g-se/src/loadout.*`、`src/loadout_search.*`、`src/mh3u-ui/widget/qweapon.cpp`、`qarmor.cpp`、`plan/README.md` | 普通和发掘装备均可手动进入；发掘实例不得由自动搜索生成 |
| MHGU/XX | 自动数据完整性门禁、自然护石、逐件装珠、胴系统倍加、稳定 fingerprint、暂停/继续/取消 | `../mhgu-xx-se/src/loadout.*`、`src/loadout_search.*`、`tests/core_tests.cpp` | 可作为三作规则插件和 Worker 生命周期参考 |

旧项目证明算法可用，但不能直接搬 Qt 控件、线程对象或存档格号。新项目需要重新定义跨游戏领域协议，并通过合成夹具逐作对照。

### 1.2 当前 SQLite 已具备的输入

- `catalog_weapons`、`catalog_armors`、`catalog_armor_skills`、`catalog_decorations`、`catalog_decoration_skills` 和 `catalog_skills` 已存在。
- MH3G：`charm_classes` 10 类，`charm_combinations` 121,952 条自然组合。
- MH4G：`charm_classes` 14 个可用品级，`charm_skill_ranges` 633 条技能范围，`charm_class_rules` 14 条来源/孔位规则。
- MHGU/XX：`cn__talismans` 10 个有效品级，`cn__talisman_skill_limits` 2,060 条技能限制，`cn__talisman_slot_thresholds` 80 条孔位门槛。
- Dex 已提供并已由技能构建器统一生成完整发动关系：3G 238 条、4G 278 条、GU/XX 327 条；GU/XX 胴系统特殊记录已经补齐。
- MH4G 旧统一表仍保留配装专用的动态装备输入：`weapons` 共 2,849 条，其中发掘武器 435 条；`armors` 共 4,835 条，其中发掘防具 1,250 条。普通 `catalog_weapons`、`catalog_armors` 继续排除发掘内容，配装器通过独立快照读取，不能为此改变公开图鉴口径。
- MH4G 已有 `relic_weapon_attack_values` 308 条、`relic_armor_defense_values` 28 条和 `relic_armor_resistance_values` 40 条换算输入。旧表的 `raw_hex` 表示长度并不统一，不能直接假定它就是完整装备实例；构建时必须解析来源格式并严格规范成 28 字节，无法无损规范的记录进入审计而不是补零或截断。

因此，护石候选、技能发动和 MH4G 发掘实例均不再存在数据研究层硬阻塞；剩余内容是统一字段、模板固化、来源审计和规则语义的 P0 实施任务。

### 1.3 MH4G 旧修改器复核结论

实现时固定参考以下已验证文件，不再根据通用 28 字节表格标题猜字段：

```text
../mh4g-se/plan/relic-equipment-advanced-customization.md
../mh4g-se/plan/relic-equipment.md
../mh4g-se/src/mh3u-ui/widget/qweapon.cpp
../mh4g-se/src/mh3u-ui/widget/qarmor.cpp
../mh4g-se/src/mh3u-ui/widget/qloadout.cpp
../mh4g-se/src/loadout.cpp
../mh4g-se/src/loadout_search.cpp
../mh4g-se/src/equipment_validator.cpp
```

已冻结的迁移规则：

- 武器、防具和护石虽然都占 28 字节，但必须使用三套强类型视图；同一偏移在不同类型中不能共用 UI 标签或验证规则。
- 发掘武器按武器类型解释专项字段；轻重弩 `0x01` 位组合不得与 `0x13` 极限强化混用，操虫棍 `0x14–0x1B` 是八项猎虫实例值。
- 发掘武器/防具的 `0x10` 只以掩码更新低四位中的已确认字段，高四位及未知位原样保留。
- 三颗装饰品均为 16 位记录，`bit15` 是固定/内置标志；读取、预览、装珠和导出都不得丢失该位。
- 护石两个技能 ID 和技能点均为 16 位，点数按有符号数解释；自然范围外值、未知技能 ID 和超孔珠允许作为可编码手动实例保存。
- 旧自动配装已经验证“自动部分只生成自然合法候选；手动珠子可以超孔；固定护石可以非自然”。新实现保留该边界，并扩展到明确固定且可计算的发掘/未确认实例。

## 2. 阻塞复核

### 已解除的数据阻塞

1. **技能图鉴与统一发动阈值已经闭环**

   [13-skill-catalog.md](13-skill-catalog.md) 已完成三作技能系、发动阈值、正负方向、说明、复合技能、装备来源和护石 A/B 合法范围。自动配装目标可以直接选择稳定 `activationKey`，不再根据显示名称猜技能等级。

2. **GU/XX 非线性技能顺序已经明确**

   `身体系统加倍` 先按既有规则复制胸部固有技能与胸部装饰珠；`护石系统加倍` 先将护石技能贡献乘 2；`技能点数+2` 最后作用于汇总后的技能系。因此同时生效时固定为：

   ```text
   finalPoints = basePoints + talismanPoints × 2 + 2
   ```

   若只把受两种效果共同影响的护石贡献记作 `x`，顺序即 `x × 2 + 2`，禁止实现为 `(x + 2) × 2`。正式计算器仍需用正数、负数、零值、双技能护石和临界阈值夹具验证，但这属于实现验收，不再是数据阻塞。

### 已完成的 P0 工程项

1. **配装身份协议已版本化**

   新实现以稳定武器键、防具 Dex/save 身份、护石 A/B 技能位、`dataVersion`、实例来源、自然合法性和结构可编码性为边界。旧 `api/core/loadout.ts` 仅由 `normalizeLegacyLoadout()` 兼容，不再作为新页面权威模型。

2. **三作规则已插件化**

   `GameLoadoutRules` 分别固定职业限制、胴系统和特殊修正；MH3G/MH4G 胴系统技能树 ID 为 `1`，MHGU/XX 为 `203`。GU/XX 护石强化和技能点数 +2 的共同结果按 `x × 2 + 2` 计算并有合成回归样本。

3. **自动搜索已迁移到 Worker**

   renderer 只通过受限 IPC 启动、轮询和控制任务。Worker 支持进度、暂停、继续、取消和超时；返回结果会再经正式计算器和编码校验，过期状态不会直接改写当前配装。

### 已闭合的 P1 项

4. 护石 UI 同时展示自然范围、A/B 技能位、编码范围和来源；规则范围不冒充掉落概率。
5. `.mhloadout.json` 已落地严格校验、当前快照重水合、`dataVersion` 更新与重新计算；未知或消失的装备身份给出明确错误，不按同名静默替换。
6. `build_loadout_catalog.mjs` 已独立固化 MH4G 发掘模板和换算表；普通图鉴继续排除 435/1,250 条发掘记录。

## 3. 本轮明确排除的存档能力

- 不读取装备箱，不提供“当前装备箱”候选源，不保存箱子格号。
- 不实现“一键写入装备箱”，也不以防具 save identity 覆盖率作为本轮配装计算门槛。
- 当前防具 Dex → 存档身份数量（MH3G 1600/1651、MH4G 1394/3119、MHGU/XX 5571/5726）只登记为未来物化写回风险。
- MH4G 发掘装备可以在配装器手动选择并作为固定实例编辑；自动搜索不生成发掘武器/防具，只能在用户明确固定后将其作为已知输入。自动新增候选仍排除发掘装备、非法护石、超孔珠和其他非自然组合。
- 猎虫、猫装备和其他动态实例不塞进猎人七槽基础模型。

## 4. 非阻塞项

- 武器、防具、装饰珠名称、属性、技能点和图标查询已具备 Repository/IPC 基础。
- 现有 `SearchableSelect` 已支持中英文关键词和多选，可直接作为武器类型、技能、护石品级和装饰珠选择基础；需要补充大数据量分页/延迟查询，而不是另造原生 `<select>`。
- 护石不需要把十几万自然组合渲染成列表，采用品级、孔位、技能 1/2 和点数表单，实时调用规则验证即可。
- 自动配装不需要等待存档打开；使用图鉴候选即可先完成纯计算和本地 JSON。
- MH3G/MH4G/GU 三作旧搜索主路径和生命周期测试成熟；GU/XX 非线性技能顺序已固定为护石贡献先乘 2、汇总后再加 2，不再构成数据阻塞。

## 5. 目标领域协议

第一步冻结以下纯 TypeScript 类型，页面、Repository、Worker 和未来存档桥接都只依赖这些类型：

```ts
type LoadoutGame = 'mh3g' | 'mh4g' | 'mhgu'
type LoadoutSlot = 'weapon' | 'head' | 'chest' | 'arms' | 'waist' | 'legs' | 'charm'
type ArmorLoadoutSlot = 'head' | 'chest' | 'arms' | 'waist' | 'legs'
type LegalityStatus = 'confirmed' | 'invalid' | 'unknown'
type EncodingStatus = 'encodable' | 'blocked'
type LoadoutInstanceSource = 'catalogTemplate' | 'importedLoadout' | 'saveInstance'

type LoadoutInstanceState = {
  source: LoadoutInstanceSource
  recordHex: string
  legality: LegalityStatus
  encoding: EncodingStatus
  issues: LoadoutValidationIssue[]
}

type LoadoutWeaponIdentity =
  | { source: 'catalog'; weaponKey: string; saveType: number; saveId: number }
  | { source: 'relicTemplate'; templateKey: string; saveType: number; saveId: number }

type LoadoutArmorIdentity =
  | { source: 'catalog'; armorDexId: number }
  | { source: 'relicTemplate'; templateKey: string; saveType: number; saveId: number }

type LoadoutWeapon = {
  kind: 'weapon'
  gameId: LoadoutGame
  identity: LoadoutWeaponIdentity
  decorations: DecorationChoice[]
  instance?: LoadoutInstanceState
}

type LoadoutArmor = {
  kind: 'armor'
  gameId: LoadoutGame
  identity: LoadoutArmorIdentity
  decorations: DecorationChoice[]
  instance?: LoadoutInstanceState
}

type LoadoutCharm = {
  classId: number
  slots: number
  skill1: { skillId: number; points: number } | null
  skill2: { skillId: number; points: number } | null
  decorations: DecorationChoice[]
  legality: LegalityStatus
  encoding: EncodingStatus
  instance?: LoadoutInstanceState
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

MH4G 配装数据扩展由 `tools/build_loadout_catalog.mjs` 生成，至少包含：

```text
catalog_loadout_relic_weapon_templates
catalog_loadout_relic_armor_templates
catalog_loadout_relic_value_lookups
catalog_loadout_instance_sources
```

- 模板保存稳定模板键、装备类型/身份、完整 28 字节初始记录、可解释字段、默认计算贡献、证据状态和来源哈希。
- `recordHex` 固定为 56 个十六进制字符。构建器不能对长度不符的旧值静默补零或截断；必须回到来源结构解码，仍不能闭合时该模板不得作为可应用候选。
- 高级编辑保存字段补丁及补丁前后的字节差异；未知字节、未知位和非目标字段逐字节保留。
- 这些表只服务配装器和未来存档桥接，不进入普通武器/防具图鉴 Repository。

所有输入继续经 Zod 严格校验。SQLite 只在主进程只读访问；Worker 接收不可变、可序列化快照，不持有数据库连接、文件路径或 renderer 状态。

## 6. 页面与组件实施计划

实现按职责拆分，至少包含：

```text
ui/pages/LoadoutBuilderPage/
ui/components/LoadoutToolbar/
ui/components/LoadoutEquipmentTable/
ui/components/LoadoutEquipmentRow/
ui/components/LoadoutSkillMatrix/
ui/components/LoadoutSummaryPanel/
ui/components/EquipmentPickerDrawer/
ui/components/CharmPickerDrawer/
ui/components/DecorationEditorDrawer/
ui/components/AutoLoadoutDrawer/
ui/components/AutoLoadoutResultList/
ui/components/AutoLoadoutResultRow/
ui/components/LoadoutWorkspaceDrawer/
ui/components/RelicEquipmentEditor/
ui/components/RelicWeaponAdvancedFields/
ui/components/RelicArmorAdvancedFields/
ui/components/LoadoutLegalitySummary/
```

每个页面/组件均使用独立 `.tsx` 与 `.css`。`LoadoutWorkspaceDrawer` 只负责 portal、右侧抽屉、dialog 语义、焦点锁定/归还和滚动隔离，不包含配装业务。

### 6.1 七槽主页面

固定顺序：

```text
武器｜头｜胸｜腕｜腰｜腿｜护石
```

每槽显示当前名称、稀有度/品级、孔位状态、来源和合法性。变化只更新内存 `LoadoutModel`，不设置存档 dirty。详情、技能矩阵、防御/耐性和孔位汇总由纯计算器产生。

### 6.2 选择武器抽屉与选择防具抽屉

新增独立 `EquipmentPickerDrawer`，通过槽位参数约束候选；抽屉内部直接调用现有武器/防具列表、搜索和选中组件：

- 武器选择抽屉支持名称/中英 ID 搜索、武器类型、稀有度、孔位、可生产和近远程摘要；不能切换为防具或护石。
- 防具选择抽屉由头/胸/腕/腰/腿固定部位，支持名称/ID、稀有度、孔位、剑士/枪手、性别和技能条件；不提供部位下拉。
- 候选选择后再次校验游戏、部位、`save_type`/`save_id` 或 `dexId`，防止 UI 状态污染。
- 详情区显示完整技能点；防具统一使用稳定 `dexId` 参与纯计算，不要求当前已经具备存档写回身份。
- 手动配装允许选择普通和 MH4G 发掘武器/防具；自动搜索新增候选只使用有效、非占位、非发掘的普通图鉴装备以及自然护石/装珠组合。用户已固定的发掘实例可以作为输入保留。
- 抽屉复用武器、防具图鉴的浏览核心组件，传入 `mode="select"`、`selectedIdentity`、`onSelectionChange` 和 `onConfirm`；不得复用页面壳层、URL 同步或图鉴抽屉状态。

### 6.2.1 MH4G 发掘高级编辑

从配装专用发掘候选选中后，在同一个 `EquipmentPickerDrawer` 内进入“基础 / 发掘高级 / 原始记录”子视图：

- 武器覆盖攻击档及真值/面板值、属性或异常及数值档、斩味/弩/弓专项档、升级、武器专属值、孔数、动态稀有度、研磨要求、未研磨、发光和极限强化。
- 操虫棍额外覆盖猎虫等级、猎虫类型、力量、耐力、速度、火、水、雷、冰、龙；轻重弩将限制解除和配件原始位与通用极限强化分开。
- 防具覆盖防御档、五耐性档、升级、孔数、动态稀有度、研磨要求、未研磨、发光，以及三颗装饰品和各自 `bit15` 固定标志。
- 正常档、已知越界档和自定义原值分别分组；单字节允许 `00–FF`，16 位字段允许完整存储宽度。未识别值显示“保留原值 0xNN”，不强制选回正常档。
- `0x10` 只用掩码修改未研磨、发光和孔数，保留高四位；普通 ID 携带发掘参数时只读提示并保留，不自动清理。
- 每次只补丁目标字段；预览同时显示可解释数值、证据状态以及旧/新字节。取消恢复进入子视图前的完整 28 字节草稿。

### 6.3 护石表单

新增独立 `CharmPickerDrawer`，不渲染 12 万行：

- 品级、孔位、技能 1/2、带符号点数使用水平紧凑表单。
- 实时显示自然范围、编码范围和来源证据；非法手动护石可以保留为 `manual`，仍可用于手动配装或作为用户明确固定的自动搜索输入，但自动搜索不得生成新的非法护石。
- 技能选择统一使用 `SearchableSelect`，按中英文关键词搜索。
- 护石装饰珠与普通装备共用 `DecorationEditorDrawer`，孔位计算由规则插件负责。
- MH4G 护石必须保留完整 28 字节类型视图：装备类型固定为 6；A/B 技能 ID 和点数均按 16 位解析，点数为有符号数；三颗珠子的 `bit15` 固定标志独立保存；`0x14–0x1B` 原样保留。未知技能 ID 和自然范围外点数只要可编码就不得被替换或钳制。

### 6.4 装饰珠配置

新增独立 `DecorationEditorDrawer`：

- 顶部固定显示天然孔、已用孔、剩余孔和合法性状态。
- 候选列表按名称、ID、占孔和技能点筛选；显示正负技能点，不只显示主技能。
- 最多保存装备记录允许的珠子数量，按真实占孔计费；超孔、DUMMY、未映射不自动清除，明确警告。
- 关闭使用“应用/放弃”，只更新本地配装模型。

### 6.5 合法性与非法值策略

合法性采用三态并与结构可写性分离：

```text
自然合法性：合法（confirmed）｜非法（invalid）｜不确定（unknown）
结构可编码：可编码（encodable）｜阻断（blocked）
```

- `合法`：当前组合与已确认的自然范围、部位、职业和性别规则一致。
- `非法`：明确违反已知规则，例如护石技能超出已确认范围、空技能带非零点数、装饰珠占孔超过容量，或装备类型与槽位不一致。
- `不确定`：字段可编码，但原生掉落/组合规则没有足够证据，例如 MH4G 发掘随机参数、未知保留字节或未确认的护石生成约束。
- 非法或不确定值在手动配装中允许保留、计算并导出；行级徽标必须同时显示状态文字、原因和来源，不得只用红/黄颜色。
- 结构错误（长度不对、超出字段位宽、ID 无法编码、未知装备类型）不是“非法值”，而是阻断应用的错误；必须在对应字段附近显示，应用按钮禁用。
- 手动模式允许超孔珠、未知珠、非自然护石、职业/性别不兼容以及发掘越界/未知档，只要它们仍处于可编码范围；这些输入不得被静默清除、钳制或“自动修复”。
- 字段附近固定预留诊断空间，按“阻断 → 非法 → 不确定”展示；顶部风险摘要只作导航，点击后定位字段，不能用一条 toast 代替字段错误。
- 自动搜索只生成 `confirmed` 的普通装备、自然护石和合法装饰珠；用户明确固定且可计算、可编码的 `invalid`/`unknown` 实例可以作为常量输入，但结果必须带风险提示，且搜索不得改写其身份、高级字段、未知位或固定珠子。
- 任何自动结果应用前重新调用正式计算器和结构校验；若固定输入导致结果无法编码，拒绝应用并保留搜索结果。

### 6.6 自动配装

自动搜索输入包括：固定具体武器（必填）、目标发动技能及等级、性别、固定装备/护石、自然域、结果数和排序权重。首版不以抽象武器孔位代替具体武器，也不提供“仅装备箱已有”，保持纯图鉴计算边界。MH4G 发掘武器/防具不会由自动搜索生成；用户明确固定且技能、防御、耐性、孔位贡献可计算的实例可以作为常量输入，自动搜索不能修改其随机参数。无法解释关键贡献或结构不可编码时才阻止搜索，并指出具体字段。

搜索顺序固定为：候选预筛 → 安全支配剪枝 → 部位组合上界 → 护石候选 → 装饰珠补足 → 稳定去重 → 正式计算复核。结果回填前再次检查七槽身份、性别/职业和护石自然状态。

Worker 消息协议至少包含 `start`、`progress`、`pause`、`resume`、`cancel`、`result`、`finished`、`error`；每次搜索使用 `requestId + dataVersion`，过期结果丢弃。

## 7. UI/UX 规范与交互验收

本项目采用桌面高密度棕金界面，但不牺牲键盘和反馈：

- 右侧工作抽屉使用真正的 dialog 语义和遮罩，打开后焦点进入搜索框/关闭按钮，Tab 顺序与视觉顺序一致，Escape 关闭并归还原焦点。
- 每个按钮、列表行、筛选器都有可见焦点环；选中/展开/禁用状态同时使用文字或 `aria-*`，不只依赖颜色。
- 搜索框采用短延迟；候选表使用分页或虚拟化，避免一次渲染全部装备/装饰珠。长标识允许换行，不撑破工作抽屉。
- 选择抽屉的主要操作保证足够点击区域；窄视口时改为全宽单列，不压缩或推动七槽主页面。
- 自动搜索右侧固定显示阶段、已检查状态数、结果数、进度/耗时和暂停/继续/取消；空结果、数据门禁失败、超时和取消都给出可理解原因。
- 结果区独立滚动，搜索控制固定；选择结果时保留旧详情直到新结果完成，避免闪烁。
- 遵循全局五档字号、亮金数据色、水平标签 + 控件和低对比滚动条；组件使用独立 `.tsx` + `.css`，不把业务样式写入全局。
- `prefers-reduced-motion: reduce` 时取消抽屉位移和列表过渡，仅保留必要状态变化。

这些要求来自本项目现有 `AGENTS.md`，并经过 UI 审阅确认：焦点可见/可回收、键盘顺序完整、长任务进度反馈、长列表性能和小组件职责边界均为高优先级。

## 8. 分阶段执行顺序

当前 1～8 已在阶段 3A 首版完成；第 9 项保持为阶段 3B 后续工作。

1. **技能图鉴（已完成）**：[13-skill-catalog.md](13-skill-catalog.md) 已统一技能系、发动阈值、说明、复合关系和护石范围。
2. **UI 与协议冻结**：以 [14-loadout-builder-ui.md](14-loadout-builder-ui.md) 为交互合同，拆分 Loadout 身份、护石、规则插件、诊断和版本化 JSON 类型；为三作建立合成快照。
3. **数据扩展**：新增 `tools/build_loadout_catalog.mjs` 和私有审计命令，归一生成 `catalog_talisman_classes`、`catalog_talisman_skill_limits`、`catalog_talisman_slot_rules`；MH3G 的显式自然组合另存 `catalog_talisman_combinations`，不强行把三作不同来源压成同一算法。
4. **纯计算器**：实现 `calculateLoadout(snapshot, loadout)`、技能矩阵、胴系统、防御/耐性/孔位和诊断；按已冻结的 `x × 2 + 2` 顺序实现 GU/XX `Skill +2`、`Double Talisman`，再逐作对照旧测试。
5. **选择器**：实现武器/防具工作抽屉、技能条件、发掘高级编辑和键盘交互。
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
- 防具按 `dexId` 正确计算；MH4G 发掘装备、占位装备和非自然候选不会进入自动生成候选。明确固定且可计算、可编码的发掘/非法/不确定实例原样保留。
- 435 条发掘武器和 1,250 条发掘防具的配装模板来源、身份和 28 字节记录均可审计；长度异常、未知枚举和模板重复有独立报告。

### 计算器与自动搜索

- 单件技能、防御、耐性、孔位和正负发动阈值与旧项目固定夹具逐项一致。
- 一件/多件胴系统只复制胸部固有技能与胸部装饰珠，不复制其他部位。
- 相同输入与 `dataVersion` 输出 fingerprint 和排序稳定；所有结果经过正式计算器复核。
- 固定发掘武器/防具、非自然护石和超孔珠分别建立样本：求解器只改变未固定槽，结果继承风险标识；目标字段补丁外的 28 字节保持一致。
- Worker 暂停/继续/取消/超时不会泄漏线程；过期 request 不覆盖当前结果。

### UI

- 七槽、选择武器/防具、护石、装珠和自动配装均可纯键盘完成；工作抽屉焦点不丢失、不嵌套。
- 选择器 URL/本地状态恢复、重置、空结果、加载失败和候选图片 fallback 可理解。
- 自动搜索进度持续更新，取消后保留当前配装；结果回填只更新内存模型。
- 工作抽屉使用根级 portal 与 fixed overlay；打开、切换子视图、出现字段警告和关闭时，主页面宽度、横向位置与滚动位置均不变化。
- 行级问题与字段级问题都预留稳定空间；顶部风险摘要能把焦点移到对应控件，屏幕阅读器可读出严重级别、原因和是否阻断。
- 在 1024px、1280px、1440px 下窗口整体不滚动，列表/详情各自内部滚动；减少动态效果时无位移动画。

### 最终质量门槛

```text
pnpm data:audit:loadouts -- --research-root ../research
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

当前私有来源、模板与审计报告已固定在 `research`；SQLite、护石规则快照、装备箱原始记录、配装 JSON 样本和自动搜索结果均继续留在 `research` 或已忽略目录，不提交 GitHub。

## 10. 明确边界与假设

- 首版配装不要求读取存档即可使用，默认从完整图鉴选择装备。
- 当前版本不读取装备箱，也不包含格号、存档路径或原始偏移。
- MH4G 发掘武器/防具首版即可从配装专用模板手动创建、选择和高级编辑；自动搜索不生成它们，但用户明确固定且可计算、可编码的实例可以原样参与。
- MHGU 与 MHXX 共用内容库和动作/技能数据，但未来存档 adapter、平台和写回身份必须分开。
- 狩技、猎虫、猫装备不是猎人七槽基础配装；需要单独扩展模型。
- 自动配装首版默认按目标满足、风险、剩余孔位、防御、耐性和稳定 ID 排序，允许后续调整权重。
- 护石自然规则保留来源证据等级，不把社区/规则页数据冒充完整掉落概率。
