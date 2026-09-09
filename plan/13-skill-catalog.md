# 三作技能图鉴与配装前置数据计划

状态：已实现并通过构建/审计（2026-09-09）
范围：MH3G、MH4G、MHGU/XX 技能系、发动技能、阈值、说明、复合效果及装备来源关系

## 1. 目标与实施顺序

技能图鉴是配装器的 P0 前置，不再只作为防具/装饰品详情中的临时抽屉。实施顺序固定为：

```text
技能数据统一构建与审计
→ Skill Repository / IPC
→ 独立技能图鉴页面
→ 配装器选择发动技能目标
→ 配装计算器与自动搜索
```

本图鉴保持只读，不读取存档，也不编辑护石、装备或技能点。

## 2. 已确认数据与缺口

三作 Dex 已经具备完整的技能数据，当前不需要继续猜字段：

| 内容库 | 技能系 | Dex 发动关系 | 正/负发动关系 | 复合关系 | 默认可见技能系 |
| --- | ---: | ---: | ---: | ---: | ---: |
| MH3G | 126 | 238 | 173 / 65 | 19 | 126 |
| MH4G | 145 | 278 | 212 / 66 | 55 | 144（隐藏“无”） |
| MHGU/XX | 206 | 327 | 261 / 66 | 166 | 205（隐藏“无”） |

权威来源：

- `ID_SklTree_Name`：技能系三语名称。
- `DB_Skl`：发动技能 → 技能系及发动点数。
- `ID_Skl_Name`：发动技能三语名称。
- `ID_Skl_Des`：发动技能三语说明。
- `DB_CompSkl`：复合技能与其实际包含的发动效果。
- `DB_SklTreetoAmr`、`DB_SklTreetoJew` 及当前统一表：防具、装饰品技能点关系。
- `charm_combinations`、`charm_skill_ranges`、`cn__talisman_skill_limits`：三作护石品级、A/B 技能位和合法点数范围。
- GU/XX 原生 `skillTypeData.skt/gmd`、`skillData.skd/gmd`：技能系和发动效果的原生说明及交叉验证。

实施前统一数据有以下缺口（现已由构建器闭合）：

1. `catalog_skills` 只有中英文名称，没有日文名、Dex 技能系 ID、说明、占位和映射状态。
2. 当前 `SkillCatalogRepository` 从防具/装饰品表反向拼发动名称，会丢失阈值、负面发动、说明及没有装备关系的技能。
3. GU/XX 当前 `cn__active_skills` 只有 326 条，遗漏特殊处理的胴系统；Dex 权威数为 327。
4. GU/XX 存档技能 ID 与 Dex 技能系 ID 顺序不同：存档域将胴系统放在 ID `203`，不能直接把 Dex 行号或 `SklTree_ID` 当存档技能 ID。
5. `DB_CompSkl` 尚未进入统一库。复合技能只授予对应发动效果，不能伪造为被包含技能系的额外点数。

## 3. 数据构建

新增：

```text
tools/build_skill_catalog.mjs
pnpm data:build:skills -- --research-root ../research
pnpm data:audit:skills
```

构建器在事务中重建：

```sql
catalog_skills (
  game_id TEXT NOT NULL,
  skill_id INTEGER NOT NULL,
  dex_tree_id INTEGER,
  name_cn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_jp TEXT NOT NULL,
  description_cn TEXT,
  description_en TEXT,
  description_jp TEXT,
  is_placeholder INTEGER NOT NULL DEFAULT 0,
  mapping_status TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, skill_id)
);

catalog_skill_activations (
  game_id TEXT NOT NULL,
  skill_id INTEGER NOT NULL,
  activation_key TEXT NOT NULL,
  dex_activation_id INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  direction TEXT NOT NULL,
  name_cn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_jp TEXT NOT NULL,
  description_cn TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_jp TEXT NOT NULL,
  is_special INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, activation_key)
);

catalog_skill_components (
  game_id TEXT NOT NULL,
  compound_activation_key TEXT NOT NULL,
  component_activation_key TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, compound_activation_key, component_activation_key)
);

catalog_skill_talisman_ranges (
  game_id TEXT NOT NULL,
  range_key TEXT NOT NULL,
  skill_id INTEGER NOT NULL,
  talisman_id INTEGER NOT NULL,
  talisman_name_cn TEXT NOT NULL,
  talisman_name_en TEXT NOT NULL,
  talisman_position TEXT NOT NULL CHECK(talisman_position IN ('A','B')),
  slot_count INTEGER,
  min_points INTEGER NOT NULL,
  max_points INTEGER NOT NULL,
  max_slots INTEGER,
  range_status TEXT NOT NULL CHECK(range_status IN ('exact','rule','unknown')),
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, range_key)
);
```

### 3.1 ID 与 crosswalk

- MH3G、MH4G 以当前 `catalog_skills.skill_id` 为应用身份，并保存对应 Dex tree/activation ID。
- GU/XX 以当前装备、珠子和护石实际使用的存档技能 ID 为应用身份，建立显式 `save_skill_id ↔ dex_tree_id` crosswalk。
- GU/XX 胴系统、秘术、护石强化必须作为固定样本；不能依靠名称排序补位。
- `activation_key` 采用 `<skillId>:dex:<Skl_ID>`，避免不同 ID 域碰撞。
- 护石关系以技能系为端点，不能直接挂在“弱点特效”等发动效果名称上。例如“弱点特效”属于“痛击”技能系，相关护石必须查询“痛击”的护石范围。
- 护石范围不得把 A/B 两个技能位合并。MH3G 的显式自然组合按孔位和连续点数段保留；MH4G 按 `charm_source` 展开到实际护石品级；GU/XX 分别读取 `skill1_min/max` 与 `skill2_min/max`。`0～0` 表示该技能位不可出现，不生成普通关系行。
- `slot_count` 只在来源能精确证明“该孔位数与该点数范围可共存”时填写；否则为 `null`，`max_slots` 仅表示该护石品级的理论孔位上限，UI 不得暗示它与最大技能点必然同时出现。
- 同一护石品级、同一技能位存在不连续合法点数时拆成多个范围行，禁止用一个过宽的最小/最大值填平中间非法点数。
- `threshold > 0` 为正面，`threshold < 0` 为负面；胴系统等特殊项由 `is_special` 和后续游戏规则插件处理。

### 3.2 说明和复合效果

- 发动说明必须使用 `ID_Skl_Des` 的同一 `Skl_ID` 精确关联，不按名称模糊匹配。
- 技能系说明只在原生来源明确存在时写入；没有来源时保持 `null`，不把某一发动技能说明冒充整个技能系说明。
- `DB_CompSkl` 的方向固定为：`CompSkl_ID` 是复合发动技能，`Skl_ID` 是被授予的组件效果。例如 MH4G“真打”包含“锋利度等级+1”和“攻击力UP【大】”。
- 配装器以后计算“已生效效果”时对复合关系求闭包，但不修改底层技能点，也不让复合技能错误触发被包含技能系的其他等级。

### 3.3 特殊规则证据

GU/XX Dex 已提供明确说明：

- `Skill +2`：所有已有投入点数的技能系合计值增加 2。
- `Double Talisman`：护石提供的技能点数加倍。
- `Torso Up`：复制胸部防具及胸部装饰珠的技能点。

技能图鉴负责准确展示说明和阈值；具体计算顺序、相互作用和排除项由配装规则插件通过固定配装样本验证，不能仅凭显示名称实现。

### 3.4 相关护石范围

- MH3G 从 `charm_combinations` 的真实自然组合分别聚合技能 1、技能 2；保留护石品级、孔位数和不连续点数段，不把两项技能做笛卡尔积。
- MH4G 用 `charm_skill_ranges.charm_source` 关联 `charm_class_rules`，展开到实际 `charm_classes`；页面显示这是规则范围，不冒充原生掉落概率。
- GU/XX 用 `cn__talisman_skill_limits` 直接取得每个护石品级的 A/B 技能范围，并与 `cn__talismans` 名称、`catalog_skills` 应用技能 ID crosswalk 校验。
- 相关护石表达“该技能系可以在该护石品级和技能位出现的合法范围”，不是一颗已经生成的护石实例，也不包含装备箱格号。
- 发动技能与技能系必须分别展示：用户查看“弱点特效”时，来源关系显示其父技能系“痛击”；护石范围、装备点数和装饰品点数都按“痛击”统计。

## 4. 类型、Repository 与 IPC

新增/扩展：

```ts
type SkillActivation = {
  activationKey: string
  dexActivationId: number
  threshold: number
  direction: 'positive' | 'negative' | 'special'
  nameCn: string
  nameEn: string
  nameJp: string
  descriptionCn: string
  descriptionEn: string
  descriptionJp: string
  components: SkillActivationLink[]
}

type SkillTalismanRelation = {
  rangeKey: string
  skillNameCn: string
  talismanId: number
  talismanNameCn: string
  talismanNameEn: string
  position: 'A' | 'B'
  slotCount: number | null
  minPoints: number
  maxPoints: number
  maxSlots: number | null
  rangeStatus: 'exact' | 'rule' | 'unknown'
  source: string
}

type SkillCatalogFilters = {
  gameId: GameId
  targetSkillId?: number
  query?: string
  direction?: 'positive' | 'negative' | 'special'
  source?: 'armor' | 'decoration' | 'talisman' | 'all'
  includePlaceholders?: boolean
  sort?: 'skillId' | 'name' | 'activationCount'
  page?: number
  pageSize?: number
}
```

Repository：

```ts
searchSkills(filters): PageResult<SkillSummary>
getSkill(identity): SkillDetail | null
getSkillFacets(gameId): SkillCatalogFacets
```

`SkillDetail` 固定包含 `activations`、`armorRelations`、`decorationRelations` 和
`talismanRelations` 四组结果；护石关系不再由防具或装饰品反推，直接来自三作护石规则表。

查询规则：

- 搜索中、英、日技能系名称、发动技能名称、说明、十进制/十六进制技能 ID。
- 正/负/特殊筛选按实际发动关系判断。
- 来源筛选按当前有效防具、装饰品和自然护石范围判断；默认 `all`，不以某类来源缺失排除其他来源。
- 默认按应用技能 ID 升序；页大小默认 100、最大 100。
- `SkillSummary` 分别返回防具、装饰品、护石范围数量，不能把三类来源合成一个无法解释的总数。
- `getSkill` 一次返回技能系、全部发动阈值/说明、复合效果、相关防具、相关装饰品和相关护石，切换详情标签不重复 IPC。
- 现有 `catalog:get-skill` channel 保持兼容，但返回扩展后的完整结构；新增搜索和 facets channel。
- 所有参数使用 Zod 严格校验，renderer 不访问 SQL、数据库路径或研究目录。

## 5. 页面与交互

新增路由：

```text
/game/:gameId/catalog/skills
```

导航放在“装饰品”之后、“武器”之前：

```text
道具 → 装饰品 → 技能 → 武器 → 防具 → 怪物 → 任务 → 狩技
```

页面采用左侧约 320px 技能列表、右侧宽详情：

- 顶部是名称/说明搜索、正负/特殊、来源、排序和重置，全部采用水平紧凑布局。
- 左侧行显示技能系中英文名、ID、发动等级数量和正/负标记。
- 右侧头部显示三语名称、技能系说明和关系数量。
- 右侧采用上下两段：上部固定显示技能系和发动效果，下部固定提供“相关防具 / 相关装饰品 / 相关护石”三个来源标签。三个来源分区必须始终可切换；每个标签显示关系数量和无数据状态，不因没有关系而隐藏。
- 上部发动效果表显示点数阈值、方向、三语名称、完整说明及复合效果；正负点数同时保留文字和符号，不只靠颜色。切换下部来源标签时，上部发动效果保持可见。
- 来源标签和面板共享同一技能详情状态，切换时不重复请求详情；当前标签通过 `aria-selected`、`aria-controls` 和 URL `tab` 同步，键盘左右方向键可切换。
- 装饰品和防具沿用现有紧凑关系组件、像素图标、孔位组件和低对比滚动条。
- 相关防具行固定显示“图标｜防具名称｜部位｜职业｜该技能系点数”，默认按技能点降序、来源顺序排序；点击打开防具一级详情抽屉。
- 相关装饰品行固定显示“图标｜装饰品名称｜占孔｜该技能系正负点数”，默认按正向贡献降序、占孔升序排序；点击打开装饰品一级详情抽屉。
- 相关护石使用独立 `SkillTalismanRelationList` 组件，行字段固定为“护石品级｜技能位（A/B）｜技能系｜合法点数范围｜来源”。范围保留正负号和原始边界，例如当前 GU/XX 固定快照中的“天之护石｜A 技能｜痛击｜+2～+6”；最终数值始终由对应版本的权威数据生成，不把示例硬编码为通用规则。
- 护石行首版是只读关系，不伪造护石详情抽屉。配装器的护石选择器完成后，才把该行升级为入口，并带入 `skill`、`talisman`、`position` 和范围；这不改变“抽屉不得嵌套”的全局规则。
- 没有普通发动阈值的技能仍显示“特殊规则”或“暂无独立发动技能”，不能隐藏成不存在。
- 表头与标签固定，列表和详情各自内部滚动，窗口整体不滚动。
- 相关防具、装饰品和护石关系超过 100 行时采用窗口化/虚拟列表；少于该规模时使用普通语义表格，避免一次渲染大量节点同时保持复制和辅助技术可读性。

URL 状态：

```text
q effect source sort page skill target tab debug
```

其中 `tab` 只表示下部来源分区，允许 `armor`、`decoration`、`talisman`，默认 `armor`；发动效果始终显示，不由 URL 标签隐藏。重置时恢复相关防具并清除来源筛选。

重置清除搜索、筛选、排序、分页、选中目标、标签和抽屉状态，只保留游戏版本。

### 5.1 组件复用与一级抽屉

新增并拆分独立 `.tsx` + `.css`：

- `SkillCatalogPage`
- `SkillCatalogToolbar`
- `SkillSearchList`
- `SkillListRow`
- `SkillDetailPanel`（扩展现有组件，页面和抽屉共用）
- `SkillActivationTable`
- `SkillComponentList`
- `SkillSourceTabs`
- `SkillArmorRelationList`
- `SkillDecorationRelationList`
- `SkillTalismanRelationList`

正文点击关联装饰品、防具或组件技能时打开对应一级详情抽屉；抽屉内再次点击关联对象时，先关闭再跳转对应图鉴并定位。护石关系在配装器入口完成前保持只读。严禁嵌套抽屉。

所有下拉继续使用 `SearchableSelect`；列表行、标签和关联按钮支持键盘操作、可见焦点、`aria-selected`/`aria-controls`。切换技能时保留旧详情到新请求完成，避免闪烁。

## 6. 构建与验收

### 6.1 实施结果（2026-09-09）

- 新增 `tools/build_skill_catalog.mjs`、`tools/audit_skill_catalog.mjs` 及 `pnpm data:build:skills` / `pnpm data:audit:skills`。
- 三作技能表已在不破坏原有防具/装饰品外键的前提下就地升级；装饰品构建器不再删除或重建 `catalog_skills`。
- 已生成 126/145/206 技能系、238/278/327 发动关系、19/55/166 复合关系和三作护石 A/B 合法范围；GU/XX“痛击”天之护石 A 位固定读取为 `+2～+6`。
- 新增技能搜索 Repository、严格 IPC/preload、独立技能图鉴页面、发动效果表、来源标签、护具/装饰品一级抽屉和键盘导航。
- 相关防具采用四列紧凑卡片，显示统一 `OOO` 孔位组件，并可在“技能点降序 / 孔位降序”间切换。
- 公共 `SearchableSelect` 改为按弹层真实高度定位，短选项菜单会贴合触发器向上或向下展开，不再因固定最大高度产生位置偏移。
- `pnpm typecheck`、Vitest（144 tests）和 Electron Vite build 均通过；真实 SQLite 及审计产物仍位于 `research`/已忽略目录。

### 数据审计

- 连续构建两次，SQLite 内容摘要、crosswalk、复合关系和来源 manifest 完全一致。
- 固定验证技能系 126/145/206，默认可见 126/144/205。
- 固定验证发动关系 238/278/327，正负数量与 Dex 一致；GU/XX 胴系统不得再丢失。
- 固定验证复合关系 19/55/166，全部端点都能解析到发动技能。
- 每条发动关系都有三语名称、阈值和三语说明；关系外键与 `foreign_key_check` 为空。
- GU/XX 存档技能 ID 与 Dex ID crosswalk 零未知、零按行号猜测。
- 三作护石范围全部关联到有效技能系和护石品级；A/B 技能位不混合，`0～0` 不进入普通结果，不连续点数不被错误填平。
- 固定验证 GU/XX“弱点特效 → 痛击 → 天之护石 A 技能”的实际范围与私有固定快照逐字段一致。

### Repository、IPC 与 UI

- 三语名称、说明、十进制/十六进制 ID 搜索正确。
- 正面、负面、特殊、装备来源组合筛选和分页正确。
- 阈值顺序、负面效果、复合技能展开以及无发动阈值状态正确。
- 右侧始终存在相关防具、相关装饰品、相关护石三个来源标签；技能切换后各自关系数量、点数和排序正确。
- URL 刷新、前进/后退、重置、详情防闪烁和空/错/加载状态正常。
- 技能、装饰品、防具之间遵守一级抽屉规则。
- 相关护石范围按三作来源逐条展示，A/B 技能位、正负边界和品级名称不得丢失或合并。
- 在 1024px、1280px、1440px 下无窗口整体滚动和内容溢出。

最终执行：

```text
pnpm data:audit:skills
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

不启动 `pnpm dev`。

## 7. 数据边界

Dex CSV、原生 SKT/SKD/GMD、crosswalk、SQLite、manifest 和审计报告均为私有研究输入或生成产物，只能位于 `research` 或项目已忽略目录。公开仓库只提交构建器、schema、Repository、UI、合成测试和文档。
