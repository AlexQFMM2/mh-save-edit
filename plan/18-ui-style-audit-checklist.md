# UI 页面与组件统一格式待处理清单

扫描日期：2026-09-12  
扫描范围：`ui/pages`、`ui/components` 及全局 `ui/styles.css`  
关联规范：[17-ui-style-system.md](17-ui-style-system.md)

这份文件是后续 UI 统一工作的执行清单。每个页面和组件只在完成对应迁移、状态覆盖、响应式检查和测试后勾选。

## 扫描覆盖与状态解释

本次扫描以目录和源码文件为准，不以导航是否可达作为组件存在与否的判断条件：

- 页面：18 个页面目录、18 个页面 TSX 和 18 个页面 CSS。
- 组件：171 个组件目录，其中 169 个包含 TSX、167 个包含独立 CSS。
- 历史目录：`RelicDecorationRecordRecordFields`、`SaveEditorPanel` 保留在清单中；两者均为空目录且无源码/引用，已登记为历史目录，不补造实现。
- 覆盖校验：每个 `ui/pages/*` 页面目录和每个 `ui/components/*` 组件目录均有且仅有一个条目；没有把临时 DOM 片段误拆成清单项。

条目状态采用两层判断：

- `[x] 已处理`：该页面/组件的源码迁移或视觉契约审计已经完成，当前不再有明确的结构性修改阻塞。
- `[ ] 待处理`：仍有源码迁移、状态补齐、响应式/无障碍检查或视觉回归任务。
- 已勾选条目中的“待页面级 V”表示组件自身已经迁移，但它所在页面的 1024/1280/1440px 真实窗口回归仍未完成；页面级回归完成后，再关闭对应页面条目。

当前组件分组进度（以本文件条目统计）：

| 分组 | 已处理 | 待处理 | 合计 |
| --- | ---: | ---: | ---: |
| 防具图鉴 | 13 | 0 | 13 |
| 配装器和自动配装 | 14 | 0 | 14 |
| 武器图鉴和动作值 | 35 | 0 | 35 |
| 道具和装饰品图鉴 | 22 | 0 | 22 |
| 怪物、任务、狩技和技能图鉴 | 34 | 0 | 34 |
| 猎猫图鉴 | 9 | 0 | 9 |
| 配装选择器和发掘编辑 | 12 | 0 | 12 |
| 存档修改器 | 13 | 0 | 13 |
| 基础壳层、导航和平台资源 | 19 | 0 | 19 |
| **合计** | **171** | **0** | **171** |

合计 171 项与 171 个组件目录一一对应；其中两个空目录已作为历史目录完成登记，页面条目、全局基础项和质量门槛单独统计，不混入组件进度。

## 标记和问题标签

- `[ ]` 待处理：仍需迁移或视觉回归。
- `[x]` 已处理：本轮组件迁移或源码审计已完成；页面级视觉回归仍由页面条目单独追踪。
- `T` 排版/字重/行高，`C` 颜色语义，`S` 间距/圆角/边框/表面，`R` 滚动/响应式，`A` 无障碍/键盘，`V` 视觉回归。

每个待处理条目的通用完成条件：

- [ ] 使用五档字号、统一字重和行高令牌。
- [ ] 普通文字、数据、标题、元数据和状态颜色符合语义表。
- [ ] 间距、圆角、边框、背景和滚动行为使用全局令牌或组件前缀变量。
- [ ] 空、加载、错误、只读、禁用、风险和成功状态不引起布局跳动。
- [ ] 键盘焦点、图标名称、长文本、reduced-motion 和 1024/1280/1440px 通过检查。

## 全局和公共基础

- [x] `ui/styles.css`：T/C/S，已建立字号、表面、边框、间距、圆角、控件高度、滚动条、动效和阴影令牌；公会纹理、平台品牌、属性/斩味语义色和首页/派生树渐变已登记为特例。
- [x] `tests/designTokens.test.ts`：已增加颜色、表面、间距、圆角、边框、全局滚动条、状态契约和动效时长令牌检查。
- [ ] 视觉回归夹具：建立 1024/1280/1440px 的详情、列表、抽屉和箱格基线截图。
- [ ] 组件状态夹具：统一空、加载、错误、风险、只读、成功和禁用文案/高度；核心列表、详情、选择器、关系区、配装器和修改器的空/加载/错误状态已迁移到全局 `--global-state-*` 契约，剩余编辑态和抽屉态待夹具回归。

## 页面逐项清单

页面级处理包含页面网格、主从列、工具栏、表格/列表/详情的滚动边界、窄窗口布局和 URL/抽屉状态下的视觉回归；页面不得通过选择器修改子组件私有 DOM。

- [x] `ArmorCatalogPage`：主从布局、外框、分割线和窄窗口已迁移；列表/套装细节待 V。
- [x] `DecorationCatalogPage`：主从布局、外框、分割线和窄窗口已迁移；列表/技能关系细节待 V。
- [x] `GameHomePage`：已统一页面高度、背景和窗口溢出边界；待页面级 V。
- [x] `GameOverviewPage`：已统一概览工作区滚动边界、内边距和窄窗口；待页面级 V。
- [x] `HomePage`：已统一背景、主标题、版本卡布局令牌和响应式内边距；待页面级 V。
- [x] `HunterArtCatalogPage`：主从布局、外框和窄窗口已迁移；搜索/来源细节待 V。
- [x] `ItemCatalogPage`：主从布局、外框、分割线和窄窗口已迁移；列表/关系细节待 V。
- [x] `LoadoutBuilderPage`：已统一七槽工作台、技能/属性区和分析区布局令牌；待页面级 V/A。
- [x] `MonsterCatalogPage`：主从布局、外框和窄窗口已迁移；怪物表格细节待 V。
- [x] `PalicoEquipmentCatalogPage`：模式标签、主从布局、分页和窄窗口已迁移；筛选细节待 V。
- [x] `PalicoSkillsCatalogPage`：主从布局、外框和窄窗口已迁移；技能列表细节待 V。
- [x] `PalicoSupportMovesCatalogPage`：主从布局、外框和窄窗口已迁移；行动列表细节待 V。
- [x] `PalicoTypesCatalogPage`：主从布局、外框和窄窗口已迁移；倾向列表细节待 V。
- [x] `QuestCatalogPage`：主从布局、外框、分割线和窄窗口已迁移；任务表格细节待 V。
- [x] `SaveEditorPage`：标签、子标签、错误状态和间距已迁移；箱格/详情组件待 V。
- [x] `SkillCatalogPage`：主从布局、外框和窄窗口已迁移；发动/来源表格细节待 V。
- [x] `WeaponCatalogPage`：列表/动作值外框、分割线和窄窗口已迁移；树/表格细节待 V。
- [x] `WorkspaceFeaturePage`：已统一占位工作区高度、背景和溢出边界；待页面级 V。

## 组件逐项清单

### 防具图鉴

- [x] `ArmorCatalogToolbar`：已统一控件高度、间距、搜索框表面和焦点环。
- [x] `ArmorDetailDrawer`：已审计；无独立视觉规则，复用公共详情抽屉。
- [x] `ArmorDetailPanel`：已迁移基础表面、标题、警告和操作栏；待页面级 V。
- [x] `ArmorFilterBar`：已统一筛选控件高度、间距、横向溢出和焦点环。
- [x] `ArmorIcon`：已统一图标尺寸、fallback 表面、边框和可访问名称。
- [x] `ArmorList`：已统一表头、固定表头、列表滚动、空态和加载态。
- [x] `ArmorListRow`：已统一行高、整行状态、图标、孔位和键盘焦点。
- [x] `ArmorMaterialList`：已迁移至 `DetailSection`；待材料空态和页面级 V。
- [x] `ArmorSetMatrix`：已统一套装表格、缺件空位、固定表头和内部滚动。
- [x] `ArmorSetRow`：已统一头/胸/腕/腰/腿单元格、缺失状态和键盘焦点。
- [x] `ArmorSkillList`：已迁移至 `DetailSection`；待关系行和键盘 V。
- [x] `ArmorStatsPanel`：已迁移属性分区、元素色令牌并接入 `DetailStatGrid`。
- [x] `ArmorViewToggle`：已统一列表/套装切换高度、表面、选中状态和焦点环。

### 配装器和自动配装

- [x] `AutoLoadoutDrawer`：已统一条件/结果标签、单滚动区、状态区和稳定进度空间。
- [x] `AutoLoadoutHistoryDrawer`：已统一历史状态、进度、结果卡、标签和内部滚动。
- [x] `AutoLoadoutJobProgress`：已统一进度语义、稳定高度、状态色和 reduced-motion。
- [x] `AutoLoadoutResultList`：已统一七槽结果表容器、排序栏、纵向滚动和空态。
- [x] `AutoLoadoutResultRow`：已统一装备/珠子/孔位、状态选择器、表头和卡片内部横向滚动。
- [x] `LoadoutEquipmentRow`：已统一槽位图标、固定状态、珠子、操作按钮和焦点环。
- [x] `LoadoutEquipmentTable`：已统一七槽布局、表头、边界和内部滚动。
- [x] `LoadoutLegalitySummary`：已统一风险、问题码、文字提示和稳定诊断高度。
- [x] `LoadoutSaveWriteDrawer`：已统一写入预览、确认信息、结果列表和滚动边界。
- [x] `LoadoutSkillMatrix`：已统一技能点矩阵、阈值、负值状态和内部滚动。
- [x] `LoadoutSlotIcon`：已统一武器/防具/护石 fallback、tooltip 和图标尺寸。
- [x] `LoadoutStatsPanel`：已统一防御、耐性、孔位表头、数据色和滚动边界。
- [x] `LoadoutToolbar`：已统一自动配装、历史任务、保存操作、控件高度和状态色。
- [x] `LoadoutWorkspaceDrawer`：已确认复用 `WorkspaceDrawer` 契约，页面级视觉回归另由 P0b 追踪。

### 武器图鉴和动作值

- [x] `BowDetail`：已统一远程专项字段、空态、边界和数据色。
- [x] `BowgunAmmoTable`：已统一表头、弹种数据、固定表头和内部滚动。
- [x] `BowgunDetail`：已统一轻/重弩专项详情卡片和数据色。
- [x] `GunlanceDetail`：已统一炮击专项参数、表面和焦点契约。
- [x] `HuntingHornDetail`：已统一旋律表、展开行、滚动和键盘焦点。
- [x] `InsectGlaiveDetail`：已统一猎虫专项参数、表面和数据色。
- [x] `MeleeSharpnessDetail`：已接入全局斩味令牌和详情分区契约。
- [x] `PhialWeaponDetail`：已统一瓶类型、数据色和详情卡片。
- [x] `WeaponAttributeList`：已统一属性/异常语义色、间距和空态。
- [x] `WeaponCatalogToolbar`：已统一搜索、筛选、排序按钮和控件高度。
- [x] `WeaponCoreStats`：已迁移核心属性分区、数据色并接入 `DetailStatGrid`。
- [x] `WeaponDetailDrawer`：已审计；无独立视觉规则，复用公共详情抽屉。
- [x] `WeaponDetailPanel`：已迁移背景、滚动、标题和底部操作；待页面级 V。
- [x] `WeaponFilterBar`：已统一类型/属性/稀有度筛选控件、间距、横向滚动和焦点环。
- [x] `WeaponList`：已统一列表滚动、空/错误状态和加载透明度。
- [x] `WeaponListColumns`：已统一表头高度、列间距、背景和数据对齐。
- [x] `WeaponListRow`：已统一行高、整行点击、图标、孔位、生产状态和键盘焦点。
- [x] `WeaponMaterialList`：已迁移至统一材料分区；待材料空态和页面级 V。
- [x] `WeaponMotionDetail`：已统一动作变体、Hit 序列、狩技关联和来源状态。
- [x] `WeaponMotionRow`：已统一动作值、风格、分类徽标和键盘焦点。
- [x] `WeaponMotionTable`：已统一固定表头、横向滚动和状态高度。
- [x] `WeaponMotionToolbar`：已统一动作搜索、风格多选、排序和焦点环。
- [x] `WeaponProductionBadge`：已统一生产/占位/发掘状态的徽标表面和文字。
- [x] `WeaponRelationList`：已迁移派生/关系行基础样式；后续接入 `DetailList` 统一其他关系列表。
- [x] `WeaponSharpnessBar`：已接入全局斩味颜色、比例、边界和辅助说明。
- [x] `WeaponSharpnessComparison`：已统一前后差异间距和图例文字。
- [x] `WeaponStyleBadgeList`：已统一六风格标签、可用性文字和非颜色状态。
- [x] `WeaponTreeCanvas`：已统一画布边界、性能过渡和内部交互层。
- [x] `WeaponTreeControls`：已统一缩放、重置、导航按钮和焦点环。
- [x] `WeaponTreeMatchNavigator`：已统一匹配计数、按钮尺寸和键盘焦点。
- [x] `WeaponTreeMinimap`：已统一缩略图边界和表面。
- [x] `WeaponTreeNode`：已统一节点状态、连线、长名称和焦点环。
- [x] `WeaponTreeTypePrompt`：已统一类型选择空状态、按钮和窄窗口布局。
- [x] `WeaponTypeDetail`：已统一类型说明和专项参数容器间距。
- [x] `WeaponViewToggle`：已统一列表/派生/动作值三模式的按钮、选中态和焦点。

### 道具和装饰品图鉴

- [x] `CatalogIcon`：已统一缺图 fallback、尺寸、表面和焦点契约。
- [x] `CatalogResetButton`：已统一按钮变体、尺寸、语义色和焦点。
- [x] `CatalogWriteControl`：已统一加入按钮、写入预览、表面、状态色和焦点环。
- [x] `CatalogWriteDrawer`：已审计；复用工作抽屉，无独立 CSS。
- [x] `DecorationCatalogToolbar`：已统一搜索输入、排序控件和焦点环。
- [x] `DecorationDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `DecorationDetailPanel`：已统一表面、间距和滚动区；技能/材料使用 `DetailSection`，待页面级 V。
- [x] `DecorationEditorContent`：已统一珠子草稿、孔位不足、风险提示和列表滚动。
- [x] `DecorationEditorDrawer`：已审计；外壳复用工作抽屉，内容待迁移。
- [x] `DecorationList`：已统一表头、列表滚动、空态和状态高度。
- [x] `DecorationListRow`：已统一行高、选中/悬停、技能点、孔位和键盘焦点。
- [x] `DecorationMaterialList`：已迁移至 `DetailSection`，补齐材料空态；待页面级 V。
- [x] `DecorationSkillFilter`：已统一技能选择间距、标签排布和调试筛选对齐。
- [x] `DecorationSkillSection`：已迁移至 `DetailSection`，统一正负点数颜色和关系行。
- [x] `ItemCatalogToolbar`：已统一搜索表面、排序控件和焦点环。
- [x] `ItemDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `ItemDetailPanel`：已迁移表面和底部操作；待属性/关系分区统一。
- [x] `ItemFilterBar`：已统一筛选高度、间距、横向滚动和调试筛选边界。
- [x] `ItemList`：已统一表头、列表滚动、空态和错误态。
- [x] `ItemListRow`：已统一行高、图标、数量、选中状态和键盘焦点。
- [x] `ItemPagination`：已统一底栏、按钮尺寸、禁用状态和焦点环。
- [x] `ItemRelationSection`：已统一关系面板、间距和数据色；待跨页 V。

### 怪物、任务、狩技和技能图鉴

- [x] `HunterArtCatalogToolbar`：已统一搜索、筛选标签和横向滚动边界。
- [x] `HunterArtDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `HunterArtDetailPanel`：说明、解锁关系和关联任务已统一使用 `DetailSection`；待页面级 V。
- [x] `HunterArtList`：已统一列表滚动、行高、分类信息、选中状态和键盘焦点。
- [x] `MonsterAilmentTable`：已统一异常分区、表头、滚动边界和数据色。
- [x] `MonsterDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `MonsterDetailHeader`：已统一表面、统计块、标题和数据色；待页面级 V。
- [x] `MonsterDetailPanel`：已统一详情背景和诊断提示；待表格分区 V。
- [x] `MonsterDetailTabs`：已统一标签高度、边框、选中态和焦点环。
- [x] `MonsterDropTable`：已统一掉落表头、概率对齐、关系按钮和滚动边界。
- [x] `MonsterIcon`：已统一图标 fallback、尺寸、表面和辅助名称。
- [x] `MonsterListRow`：已统一整行点击、体型/危险信息、选中状态和键盘焦点。
- [x] `MonsterQuestAppearanceTable`：已统一任务关系表、筛选工具栏、链接焦点和固定表头。
- [x] `MonsterSearchInput`：已统一短延迟搜索输入、清除焦点和标签语义。
- [x] `MonsterSearchList`：已统一搜索列表表面、内部滚动、空/加载状态和控件间距。
- [x] `MonsterWeaknessTable`：已统一弱点表头、属性数据色、文字辅助和滚动边界。
- [x] `QuestCatalogToolbar`：已统一搜索、筛选标签和调试筛选色。
- [x] `QuestDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `QuestDetailPanel`：已统一标题、标签、状态徽标、内边距和滚动边界。
- [x] `QuestInfoSection`：目标、状态、怪物关系使用 `DetailSection` 和统一关系行。
- [x] `QuestList`：已统一表头、表格行、整行/按钮点击、固定表头和状态徽标。
- [x] `QuestRewardsSection`：奖励组和特殊奖励已迁移到 `DetailSection`；待表格视觉 V。
- [x] `QuestUnlockSection`：前置/解锁/狩技关系已迁移到 `DetailSection`。
- [x] `SkillActivationTable`：已迁移到 `DetailSection`，统一表头、方向色和空态。
- [x] `SkillArmorRelationList`：已统一防具关系卡、图标、排序控件、响应式列数和焦点环。
- [x] `SkillCatalogToolbar`：已统一工具栏表面、搜索框和调试筛选色。
- [x] `SkillComponentList`：已统一复合技能关系行和说明间距。
- [x] `SkillDecorationRelationList`：已统一装饰品关系卡、技能点数据色和焦点环。
- [x] `SkillDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `SkillDetailPanel`：已统一标题、说明、发动效果和来源标签布局；待关系列表 V。
- [x] `SkillListRow`：已统一技能名称、关系数量、选中状态和键盘焦点。
- [x] `SkillSearchList`：已统一搜索列表表面、内部滚动、空态和分页底栏。
- [x] `SkillSourceTabs`：已统一来源标签表面、选中态和焦点环。
- [x] `SkillTalismanRelationList`：已统一 A/B 位、范围、孔位上限、固定表头和内部滚动。

### 猎猫图鉴

- [x] `PalicoAbilityDetailPanel`：说明、倾向和解锁条件已统一 `DetailSection`；待页面级 V。
- [x] `PalicoCatalogToolbar`：已统一搜索、筛选、重置按钮和横向滚动边界。
- [x] `PalicoEntryList`：已统一列表行、选中状态、roving tabindex 和空态。
- [x] `PalicoEquipmentBrowser`：已统一武器/防具表头、固定滚动、行状态和键盘焦点。
- [x] `PalicoEquipmentDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `PalicoEquipmentDetailPanel`：统计、说明和材料已统一表面与 `DetailSection`；待页面级 V。
- [x] `PalicoSharpnessLevel`：已统一紧凑斩味等级、全局斩味色和文字辅助。
- [x] `PalicoSupportMoveDetailDrawer`：已审计；复用公共详情抽屉。
- [x] `PalicoTypeDetailPanel`：倾向说明、固定行动和固有技能已统一 `DetailSection`。

### 配装选择器和发掘编辑

- [x] `CharmEditorForm`：已统一 A/B 技能、点数、孔位、风险和单滚动区。
- [x] `CharmPickerDrawer`：已审计；外壳复用工作抽屉，表单待迁移。
- [x] `EquipmentPickerContent`：已统一搜索、筛选、预览、双击选择和单滚动边界。
- [x] `EquipmentPickerDrawer`：已审计；外壳复用工作抽屉。
- [x] `EquipmentSlotIndicator`：已统一孔位状态、诊断文字和紧凑展示。
- [x] `RelicArmorAdvancedFields`：已统一下拉字段、未知值、风险和窄窗口布局。
- [x] `RelicDecorationRecordFields`：已统一 16 位珠记录、bit15 保留提示和字段布局。
- [x] `RelicDecorationRecordRecordFields`：已审计为空目录/无渲染代码，待清理或登记为历史目录。
- [x] `RelicEquipmentEditor`：已统一编辑分组、诊断空间和单滚动区。
- [x] `RelicLookupSelect`：已审计；无独立 CSS，复用选择器。
- [x] `RelicSharpnessBar`：已接入全局斩味颜色、图形预览和非十六进制编辑布局。
- [x] `RelicWeaponAdvancedFields`：已统一攻击、会心、斩味、发光和专项值字段。

### 存档修改器

- [x] `SaveBoxTransferDrawer`：已统一导入/导出预览、确认、危险状态和错误反馈。
- [x] `SaveBoxWorkspace`：已统一 10×10 物理格、详情滚动、固定操作和诊断空间。
- [x] `SaveCharacterPicker`：已统一槽位预览、双击/Enter 选择、禁用和焦点。
- [x] `SaveEditorPanel`：已审计为空历史目录，项目中无源码和引用；不伪造组件实现，保留目录记录。
- [x] `SaveEnvironmentPicker`：已统一环境卡、格式诊断、滚动边界和焦点环。
- [x] `SaveEquipmentEditorDrawer`：已统一装备详情、装饰品、发掘编辑和底部操作区。
- [x] `SaveEquipmentEmbeddedDetail`：已统一攻击/防御/耐性/技能/材料分区和加载状态。
- [x] `SaveItemPickerDrawer`：已统一搜索、数量、预览、列表滚动和底部应用布局。
- [x] `SaveMutationToastRegion`：已统一成功/失败/尚未保存提示、语义色和稳定尺寸。
- [x] `SavePalicoEditor`：已统一基本、行动、技能、外观、诊断标签和单滚动区。
- [x] `SavePersonalEditor`：已统一字段分组、只读值、校验、诊断和滚动边界。
- [x] `SaveSessionHeader`：已统一环境/角色状态、revision 操作、按钮尺寸和焦点环。
- [x] `SaveSessionProvider`：已审计；无独立 CSS，状态由宿主工作区负责。

### 基础壳层、导航和平台资源

- [x] `CemuLogo`：已登记平台品牌色例外并统一尺寸、圆角和排版。
- [x] `CommonHeader`：已统一品牌徽标、标题、状态信息和间距令牌。
- [x] `ConfirmationDialog`：已统一危险操作、遮罩、间距、按钮变体和焦点环。
- [x] `GameOverviewPanel`：已统一游戏概览、入口卡片、语义色和响应式间距。
- [x] `GameShell`：已统一跳转链接边框/焦点和页面令牌；待完整窗口 V。
- [x] `GameVersionCard`：已统一图标、平台、版本、选中状态和 reduced-motion。
- [x] `GameVersionGrid`：已统一响应式网格间距和窄窗口列数。
- [x] `GuildBackdrop`：已登记渐变视觉特例并统一过渡和 reduced-motion 契约。
- [x] `PlatformBadgeList`：已统一平台徽标尺寸、间距、标签和品牌色例外。
- [x] `SearchableSelect`：已统一控件/弹层表面、间距、选中态、按钮和焦点环。
- [x] `DetailActionBar`：已新增并接入道具/武器/防具详情底部操作栏；待统一主/次/危险按钮变体。
- [x] `DetailList`：已新增关系行基础契约；待逐页替换专用关系列表。
- [x] `DetailSection`：已新增并作为详情分区基础契约；待扩展统一空/加载/错误变体。
- [x] `DetailStatGrid`：已新增并接入防具/武器核心统计；待扩展窄抽屉变体。
- [x] `DetailDrawer`：已统一抽屉表面、标题栏、按钮、焦点和动画令牌。
- [x] `WorkspaceDrawer`：已统一抽屉表面、标题栏、底栏、按钮、焦点和动画令牌。
- [x] `WorkspaceContent`：已统一内容表面、边框、圆角和主滚动边界；待页面级 V。
- [x] `WorkspacePlaceholder`：已统一空状态、入口表面、间距和焦点契约。
- [x] `WorkspaceSidebar`：已统一导航表面、间距、选中态、折叠和移动端阴影。

## 已迁移条目的未关闭视觉回归

以下条目的源码迁移已经勾选为 `[x]`，但描述中仍有明确的二次任务；这些任务必须单独完成后，才算整个页面/组件闭环：

- [ ] 图鉴页面：`ArmorCatalogPage`、`DecorationCatalogPage`、`HunterArtCatalogPage`、`ItemCatalogPage`、`MonsterCatalogPage`、`PalicoEquipmentCatalogPage`、`PalicoSkillsCatalogPage`、`PalicoSupportMovesCatalogPage`、`PalicoTypesCatalogPage`、`QuestCatalogPage`、`SaveEditorPage`、`SkillCatalogPage`、`WeaponCatalogPage` 完成列表/表格/筛选/详情的 1024/1280/1440px 回归。
- [ ] 防具详情：`ArmorDetailPanel`、`ArmorMaterialList`、`ArmorSkillList` 检查材料空态、关系键盘焦点和详情滚动。
- [ ] 武器详情：`WeaponDetailPanel`、`WeaponMaterialList` 检查材料空态、动作值/派生切换和详情滚动。
- [ ] 道具与装饰品：`DecorationDetailPanel`、`DecorationMaterialList`、`ItemDetailPanel`、`ItemRelationSection` 完成关系行、属性区和跨页抽屉回归。
- [ ] 狩技、怪物、任务：`HunterArtDetailPanel`、`MonsterDetailHeader`、`MonsterDetailPanel`、`QuestRewardsSection` 完成表格固定表头、空态和数据色回归。
- [ ] 技能与猎猫：`SkillDetailPanel`、`PalicoAbilityDetailPanel`、`PalicoEquipmentDetailPanel` 完成关系列表、来源标签和窄窗口回归。
- [ ] 工作抽屉和编辑器：`DecorationEditorDrawer`、`CharmPickerDrawer` 完成内容迁移、单滚动区和 Escape/焦点回归。
- [ ] 公共基础：`GameShell`、`DetailActionBar`、`DetailList`、`DetailSection`、`DetailStatGrid`、`WorkspaceContent` 完成主/次/危险操作变体、空/加载/错误状态和页面级视觉回归。
- [x] 历史空目录：`RelicDecorationRecordRecordFields` 与 `SaveEditorPanel` 已登记为无源码/无引用的历史目录；本轮不补造实现，后续清理目录时同步移除条目。

复扫时使用同一范围：

```text
find ui/pages -mindepth 1 -maxdepth 1 -type d
find ui/components -mindepth 1 -maxdepth 1 -type d
rg --files ui/pages ui/components ui/styles.css
```

新增页面或组件时，必须先在本清单登记，再开始样式迁移；删除目录时同步移除对应条目并在提交说明中注明。

## 后续执行顺序

- [x] P0a：`DetailDrawer`、`WorkspaceDrawer`、`SearchableSelect`、`CommonHeader`、`GameShell` 的基础契约和令牌迁移。
- [ ] P0b：所有页面滚动边界、窄窗口布局和 1024/1280/1440px 视觉回归。
- [x] P1：防具/武器/道具详情剩余分区，以及 `DetailStatGrid`、`DetailList`、`DetailActionBar` 已完成源码契约迁移；页面级视觉回归仍待 P0b。
- [x] P2：技能、任务、怪物、狩技和猎猫详情与关系行已完成源码契约迁移；页面级视觉回归仍待 P0b。
- [x] P3a：图鉴列表、表格、分页、筛选栏和关系表的基础令牌迁移。
- [x] P3b：动作值、斩味、属性语义色、派生树特例已迁移；页面级视觉回归仍待 P0b。
- [x] P4a：配装器七槽表、技能/属性矩阵、自动搜索结果、箱格和会话头的基础令牌迁移。
- [x] P4b：自动任务历史、选择器、发掘编辑、导入导出和修改器剩余编辑表单已完成；真实窗口回归仍由 P0b/P5 追踪。
- [ ] P5：视觉回归截图、Windows 高 DPI 和发布包检查；设计令牌自动门槛已由 `tests/designTokens.test.ts` 覆盖。

## 每批完成后的质量门槛

- [x] `pnpm typecheck`（本轮通过）
- [x] `pnpm exec vitest run --minWorkers=1 --maxWorkers=2`（49 文件、271 测试通过）
- [x] `pnpm build`（本轮通过）
- [x] `git diff --check`（本轮通过）
- [ ] 1024/1280/1440px 视觉回归通过。
- [x] 不启动 `pnpm dev`；本轮未修改数据、IPC、存档和配装规则。

## 本轮源码收口记录（2026-09-12）

- [x] `SaveEquipmentEditorDrawer`：移除重复覆盖块，常规间距、圆角、控件高度、表面和选中态改用全局令牌。
- [x] `RelicSharpnessBar` / `WeaponSharpnessBar`：共用斩味色和阴影令牌，未使用段使用统一内嵌表面。
- [x] `WeaponProductionBadge`：徽章高光、投影和文字阴影改用公共令牌，保留生产状态语义色。
- [x] 存档箱、环境选择、主壳层、狩技/任务工具栏、狩技/防具详情、自动配装、猎猫装备和公共侧栏的旧间距/圆角/控件尺寸已迁移到全局令牌。
- [x] 质量门禁：`pnpm typecheck`、49 个测试文件/271 个测试、`pnpm build`、`git diff --check` 均通过。
- [x] 状态契约迁移：新增 `--global-state-*` 最小高度、内边距、文字色和行高令牌；核心列表/详情/动作值表、猎猫详情、自动配装历史、选择器、任务关系和修改器状态已接入；自动配装预检/进度也使用 inline 状态令牌，并由 `tests/designTokens.test.ts` 自动检查。
- [x] 动效令牌收口：关系区、自动配装进度、武器详情和公会背景不再使用组件级原始 `ms/s` 时长，统一使用 `--global-motion-fast` / `--global-motion-normal`；测试拒绝新增原始 transition 时长。
- [ ] 真实窗口视觉回归、状态夹具、Windows 高 DPI 和发布包检查仍未完成，不能以源码测试替代。
