# 全项目 UI 格式与样式统一实施计划

Status: 已归档
归档日期：2026-10-10
责任归属：项目维护者；后续由社区按需参考

归档结论：样式规范和源码迁移已交付，后续全量视觉审计停止排期。

保留边界：原未勾选的逐组件历史模板不再用作执行清单；全局令牌和组件边界仍按 AGENTS.md 执行。

复核依据：[设计令牌门禁](../../../tests/designTokens.test.ts)与 [18 的源码收口记录](18-ui-style-audit-checklist.md)。

> 用户于 2026-10-10 决定将全部旧计划归档，未做的后续工作不再继续排期。以下为历史方案与原始勾选记录；未实施或未验收项保持原状，不记作完成。当前维护方向见[归档索引](../../README.md)与[项目 README](../../../README.md)，发布边界以[现行约定](../../../AGENTS.md)为准。代码、研究路径和命令按项目根目录或原说明解释。

## 归档前记录

状态：规范已建立，页面与组件源码迁移基本完成；核心列表/详情状态契约已接入，当前进入真实窗口视觉回归、状态夹具和发布前审计阶段。逐页/逐组件执行清单见 [18-ui-style-audit-checklist.md](18-ui-style-audit-checklist.md)（2026-09-12）  
适用范围：`mh-save-edit` 全部图鉴、配装器、修改器、抽屉、弹窗和发布前视觉验收  
下一阶段：完成 1024/1280/1440px 视觉回归、状态夹具、Windows 高 DPI 和发布包检查

## 1. 目标与非目标

### 1.1 目标

- 让同一类信息在所有页面使用相同的字号、颜色语义、间距、边框、圆角和背景层级。
- 消除“属性、技能、材料各自一套样式”的问题，建立可复用的详情分区结构。
- 让图鉴、配装器和修改器共享相同的详情、列表、状态和操作区视觉语言。
- 保持现有棕金主题、五档字号、低对比滚动条、Lucide/SVG 图标和 reduced-motion 行为。
- 用自动化测试阻止新组件继续引入未登记的颜色、字号、间距和私有滚动条。
- 在 1024px、1280px、1440px 下保持内容完整、内部滚动清晰、窗口不整体滚动。

### 1.2 非目标

- 不更换应用主题、字体、图标体系或整体信息架构。
- 不在本阶段重写业务数据、Repository、IPC、存档格式和配装计算器。
- 不把所有组件强行压成同一种卡片；表格、列表、详情和编辑表单仍允许有明确的组件变体。
- 不为极少数有真实语义的颜色（斩味、属性、状态、平台标识）强行使用普通文字色。
- 不通过提高选择器权重、`!important` 或页面 CSS 直接覆盖组件内部来“统一”。

## 2. 当前审计结论

### 2.1 已有基础

- `ui/styles.css` 已有棕金主题、五档字号和统一表面/边框/滚动条令牌：
  - `caption = 11px`
  - `small = 13px`
  - `body = 15px`
  - `title = 20px`
  - `display = clamp(28px, 4vw, 48px)`
- 全局滚动条已由 `--global-scrollbar-*` 令牌统一控制。
- `--global-theme-color-data` 已作为 ID、数量、价格、概率、孔位和技能点等数据色使用。
- 现有 `tests/designTokens.test.ts` 已阻止组件直接新增字号档位，并检查语义表面、边框、间距、圆角、控件高度、滚动条和动效令牌。
- 阴影令牌已补齐：`--global-shadow-inset-soft`、`--global-shadow-inset-strong`、`--global-shadow-highlight`、`--global-shadow-control` 和 `--global-text-shadow-highlight`；斩味条、发掘编辑器和生产徽章不再各自定义同类阴影/表面。
- AGENTS 已规定组件/页面 CSS 职责边界和 CSS 变量前缀规则。

### 2.2 当前缺口

对现有 `ui` CSS 做静态统计后，存在明显的局部样式分叉：

- 约 182 个 CSS 文件。

本轮已关闭常规编辑器/斩味/徽章中的重复背景、圆角、间距和阴影。以下颜色仍属于登记过的视觉特例，不作为普通 UI 颜色缺口：

- `GuildBackdrop`：公会背景纹理、渐变和金色装饰透明度。
- `CemuLogo`：平台品牌色。
- `PlatformBadgeList`：平台图标投影。
- `WeaponAttributeList`：毒/麻痹/睡眠/爆破属性语义色。
- `WeaponTreeCanvas`：派生树画布的低对比径向高光。
- `HomePage`：首页背景氛围渐变。
- `WeaponProductionBadge` 的纸张高光已改为公共阴影令牌。
- 约 48 种文字颜色写法。
- 约 186 种背景写法。
- 约 107 种 padding 写法。
- 约 29 种 gap 写法。
- 约 22 种圆角写法。
- 组件仍大量直接使用 `rgba(...)`、十六进制颜色和不同透明度。
- 字重、行高、字间距没有统一令牌。
- 详情分区没有公共容器；`ArmorStatsPanel`、`ArmorSkillList`、`ArmorMaterialList` 各自管理标题、背景、边框和间距。
- 部分组件使用独立字体声明（例如 Georgia、Arial），部分标题又自行改变字重和字间距。
- 测试目前只覆盖字号和数据色，没有检查颜色、间距、圆角、背景和滚动条是否遵循设计系统。

本轮逐目录复核基线：18 个页面、171 个组件目录、169 个 TSX 组件、167 个组件 CSS 文件；其中新增 `DetailStatGrid`、`DetailList`、`DetailActionBar` 已纳入清单，`DetailSection` 继续作为已有基础契约。
逐项待办、完成状态、问题标签和验收门槛以 [18-ui-style-audit-checklist.md](18-ui-style-audit-checklist.md) 为准；本文件保留规范和迁移原则，不再作为逐项状态的唯一来源。

### 2.3 典型问题

当前详情页的实际结构类似：

```text
ArmorDetailPanel
├─ ArmorStatsPanel       属性卡片、属性卡片背景和 RARE 标题
│  └─ ArmorSkillList     自己的顶部边框、标题和技能行
└─ ArmorMaterialList     自己的顶部边框、标题和材料行
```

三个组件都是合理的独立职责，但没有共享视觉协议，因此会出现：

- 内边距不同。
- 分区间距不同。
- 标题字号和颜色不同。
- 行背景透明度不同。
- 一个区域像卡片，一个区域像列表，另一个区域像材料清单。
- 相同的“数据值”在不同页面可能使用亮金、普通黄、灰白或组件私有色。

## 3. 设计令牌规范

所有令牌继续定义在 `ui/styles.css`；组件 CSS 只消费令牌，不能重新定义全局档位。

### 3.1 排版令牌

保留五档字号，不新增第六档：

| 令牌 | 用途 | 当前值 |
| --- | --- | --- |
| `--global-typography-font-size-caption` | 格子编号、来源、次要元数据 | `11px` |
| `--global-typography-font-size-small` | 标签、英文名、辅助说明、表格正文 | `13px` |
| `--global-typography-font-size-body` | 默认正文、列表主内容、表单文字 | `15px` |
| `--global-typography-font-size-title` | 页面/区块/详情标题 | `20px` |
| `--global-typography-font-size-display` | 首页或重要空状态展示标题 | `clamp(28px, 4vw, 48px)` |

新增统一排版语义令牌：

```css
--global-typography-font-weight-regular: 400;
--global-typography-font-weight-medium: 500;
--global-typography-font-weight-semibold: 600;
--global-typography-font-weight-bold: 700;
--global-typography-line-height-tight: 1.2;
--global-typography-line-height-normal: 1.45;
--global-typography-line-height-relaxed: 1.6;
```

规则：

- 名称、正文、标签、数据和标题分别使用固定角色，不按组件临时选字号。
- 默认正文使用 `body + normal`。
- 元数据使用 `small/caption + normal`。
- 标题使用 `title + tight`。
- 长说明、审计文字和提示使用 `small + relaxed`。
- `font-family` 只保留根级字体；展示性标题的特殊字体必须登记为明确例外。

### 3.2 间距令牌

新增全局间距阶梯，组件不得随意出现新的 5px、7px、9px、13px 等近似值：

```css
--global-spacing-1: 4px;
--global-spacing-2: 6px;
--global-spacing-3: 8px;
--global-spacing-4: 12px;
--global-spacing-5: 16px;
--global-spacing-6: 20px;
--global-spacing-7: 24px;
--global-spacing-8: 32px;
```

建议映射：

| 场景 | 默认间距 |
| --- | --- |
| 图标与文字 | `spacing-2` |
| 紧凑标签与数值 | `spacing-2` |
| 同一列表行内部 | `spacing-2` / `spacing-3` |
| 详情分区内部 | `spacing-3` |
| 详情分区之间 | `spacing-4` |
| 卡片/抽屉内边距 | `spacing-4` / `spacing-5` |
| 页面级分区 | `spacing-5` / `spacing-6` |
| 大型空状态或首页区块 | `spacing-7` / `spacing-8` |

允许组件定义自己的尺寸变量，但变量值必须引用全局阶梯，例如：

```css
.armor-detail-panel {
  --armor-detail-panel-component-section-gap: var(--global-spacing-4);
}
```

### 3.3 圆角、边框和层级

```css
--global-radius-sm: 4px;
--global-radius-md: 7px;
--global-radius-lg: 9px;
--global-radius-pill: 999px;
--global-border-width: 1px;
```

组件默认规则：

- 输入框、普通按钮、列表行：`radius-md`。
- 详情区块和抽屉面板：`radius-lg`。
- 状态徽标、进度胶囊、数量徽章：`radius-pill`。
- 斩味条、像素化图标和特殊资源可以使用专属圆角，但必须在组件内部说明原因。

边框只使用三个语义层级：

```css
--global-theme-color-border-subtle;
--global-theme-color-border;
--global-theme-color-border-strong;
```

禁止同一组件同时出现多个未登记的 `rgba(223, 182, 93, ...)` 边框透明度。

### 3.4 表面和背景令牌

统一为以下层级：

```css
--global-theme-color-surface-page;
--global-theme-color-surface-deep;
--global-theme-color-surface;
--global-theme-color-surface-raised;
--global-theme-color-surface-inset;
--global-theme-color-surface-interactive;
```

使用规则：

- 页面背景：`surface-page`。
- 页面主体、详情抽屉内容：`surface-deep`。
- 普通卡片和详情分区：`surface`。
- 选中项、悬停项和浮起内容：`surface-raised` 或 `surface-interactive`。
- 数值块、输入框内部和箱格：`surface-inset`。
- 不再由每个组件自行组合 `rgba(18,10,6,.42)`、`rgba(17,9,5,.28)` 等背景。

### 3.5 文字与状态颜色语义

```css
--global-theme-color-text-primary;
--global-theme-color-text-secondary;
--global-theme-color-text-muted;
--global-theme-color-data;
--global-theme-color-accent;
--global-theme-color-success;
--global-theme-color-warning;
--global-theme-color-danger;
```

固定用途：

| 颜色角色 | 用途 |
| --- | --- |
| `text-primary` | 装备名、任务名、正文主内容 |
| `text-secondary` | 英文名、字段标签、辅助说明 |
| `text-muted` | ID、来源、空状态、不可用说明 |
| `data` | 攻击、防御、孔位、数量、价格、概率、技能点 |
| `accent` | 区块标题、可点击关联、主要强调 |
| `success` | 已确认、已完成、可写入 |
| `warning` | 非法但可编码、未知值、风险提示 |
| `danger` | 错误、阻断、不可应用 |

禁止将“黄色”作为无语义的万能文字色。区块标题使用 `accent`，实际数据使用 `data`，来源和 ID 使用 `text-muted`。

允许的语义特例：

- 火/水/雷/冰/龙属性色。
- 斩味颜色。
- 正负技能或异常状态颜色。
- 平台徽标和游戏识别色。

特例必须同时有文字、符号或标签，不能只依靠颜色传达信息。

## 4. 统一组件协议

### 4.1 `DetailSection`

所有详情页的属性、技能、材料、解锁关系、制作关系和诊断区统一使用该分区协议。

固定结构：

```text
section.detail-section
├─ header.detail-section__header
│  ├─ h3.detail-section__title
│  └─ optional detail-section__meta
└─ div.detail-section__body
```

固定样式：

- 标题字号：`small` 或 `body`，按层级选择，不由内容组件自行决定。
- 标题颜色：`accent`。
- 内容间距：`spacing-3`。
- 分区之间：`spacing-4`。
- 统一边框、背景和圆角。
- 空状态、加载状态、错误状态使用统一文字和状态颜色。

### 4.2 `DetailStatGrid`

用于防御、耐性、攻击、会心、孔位、价格等结构化数值。

支持有限变体：

- `two-column`：基础防御 / 最大防御。
- `five-element`：火 / 水 / 雷 / 冰 / 龙。
- `compact`：修改器右侧详情和窄抽屉。
- `wide`：图鉴宽详情。

同一页面的统计项必须使用相同的标签字号、数值字号、卡片内边距和数据色。

### 4.3 `DetailList` 与关系列表

- 技能、材料、解锁关系和派生关系使用统一行高和分隔线。
- 关联对象保留原生 `<button>`，统一焦点环和悬停状态。
- 数量、点数、概率和等级使用 `data` 色。
- 英文名、来源和说明使用 `secondary/muted`。
- 列表为空时显示统一空状态，不保留不同组件各自的文案和间距。

### 4.4 `DetailActionBar`

所有“加入箱子”“应用”“更换”“编辑”等详情级操作固定在详情底部：

- 内容区和操作区只有一个滚动容器。
- 操作栏拥有统一上边框、背景和内边距。
- 主操作、次操作、危险操作使用统一按钮变体。
- 操作区高度预留，提示出现时不能让详情主体跳动。

## 5. 具体页面统一规则

### 5.1 防具详情

固定顺序：

```text
标题/稀有度/制作费用
→ 基础防御、最大防御
→ 火水雷冰龙耐性
→ 技能点
→ 部位、职业、性别、孔位
→ 制作材料
→ 固定底部操作
```

“属性”“技能点”“制作材料”必须是同一个 `DetailSection` 变体，只允许内容布局不同。

### 5.2 武器详情

固定顺序：

```text
标题/生产状态
→ 攻击、会心、孔位等核心属性
→ 属性、斩味、弹种或武器专项参数
→ 制作材料
→ 派生路线
→ 固定底部操作
```

派生路线不能插入材料之前。普通武器、远程武器和动作值关联必须复用相同的区块标题和数据语义。

### 5.3 道具详情

固定顺序：

```text
标题/图标
→ 稀有度、携带上限、买入、卖出
→ 用途/获取/任务/怪物关系
→ 固定底部加入道具箱
```

图鉴携带上限和箱格 99 堆叠上限必须使用不同标签和不同领域说明。

### 5.4 技能、任务、怪物和猎猫详情

- 技能发动关系、护石关系、防具关系和装饰品关系使用相同的来源分区样式。
- 任务奖励、解锁关系和特殊奖励使用统一的关系行，不为每个标签重新定义背景透明度。
- 怪物的肉质、异常、掉落和任务关系使用统一表头、表体行高和数据色。
- 猎猫倾向、支援行动、随从技能和猫装备详情沿用同一详情分区和状态徽标。

## 6. 页面、抽屉和滚动规范

### 6.1 页面骨架

- 页面 CSS 只负责页面网格、列宽、页级滚动和组件摆放。
- 组件 CSS 负责内部内容、状态和自己的滚动容器。
- 页面不能通过 `.component__child` 直接修复子组件布局。
- 主窗口不滚动；列表、表格、详情和抽屉各自只拥有明确的内部滚动区域。

### 6.2 抽屉

- 一级详情抽屉和工作抽屉继续通过 portal、`position: fixed` 渲染。
- 抽屉标题栏、内容区、固定底栏统一使用同一套高度、边框和背景令牌。
- 详情抽屉内部不允许再叠加第二层滚动容器，除非是明确的长表格窗口化区域。
- Escape、焦点锁定、焦点归还和 reduced-motion 不因视觉重构而回退。

### 6.3 表格和列表

- 表头高度、单元格内边距、表体行高和选中状态统一。
- 表格数据列右对齐或居中必须遵守列类型规则，不按页面临时调整。
- 列表行的 hover、selected、disabled 和 diagnostic 状态统一使用状态令牌。
- 横向滚动只发生在表格/卡片内部，不允许把窗口整体撑宽。

## 7. CSS 职责与命名规范

- 每个组件保留独立 `.tsx` 和 `.css`。
- 全局 `styles.css` 只放 reset、根布局、全局令牌和滚动条。
- 页面 CSS 不得引用组件私有 class。
- 组件 CSS 的变量必须使用 `--<component>-component-*` 前缀。
- 新增公开尺寸变量必须在组件 CSS 中提供默认值，并在组件文档或注释中说明用途。
- 禁止组件内部定义 `font-size: 12px`、`padding: 9px`、`background: rgba(...)` 这类无法解释的局部值。
- 禁止组件私自定义滚动条宽度、轨道颜色和滑块颜色。
- 不允许用标签结构选择器控制复杂业务元素，例如 `.component section`、`.component button > span`；使用明确的组件前缀 class。

## 8. 分阶段迁移顺序

### 阶段 A：令牌与门槛

- 建立间距、圆角、边框、表面、字重、行高和语义状态令牌。
- 保留现有五档字号，迁移现有直接使用的标题/正文色到语义令牌。
- 扩展 `tests/designTokens.test.ts`，先允许登记的 legacy allowlist，避免一次迁移阻断所有功能。
- 输出未迁移颜色、背景和间距清单，不在本阶段改视觉行为。

### 阶段 B：核心详情区

优先迁移用户当前看到的详情区域：

1. 防具：属性、技能、制作材料。
2. 武器：核心属性、武器专项、制作材料、派生路线。
3. 道具：基础属性、用途关系、固定加入按钮。
4. 修改器装备箱：武器、防具、护石、装饰品和猫装备详情。

验收重点：同一屏内的分区必须看起来属于同一个页面系统，且操作栏仍固定、滚动不套滚动。

### 阶段 C：其余图鉴详情和关系区

- 技能、任务、怪物、狩技、猎猫详情。
- 材料、奖励、解锁、派生和用途关系列表。
- 空、加载、错误、Wiki-only、冲突、未知和非法状态。

### 阶段 D：列表、表格和工具栏

- 道具、装饰品、武器、防具、怪物、任务和猎猫列表。
- 搜索框、`SearchableSelect`、分页、表头和排序按钮。
- 配装器七槽表、自动配装结果、修改器 10×10 箱格。

### 阶段 E：特殊视觉和发布验收

- 斩味、元素、平台徽标、状态徽章和特殊图标。
- 1024/1280/1440px 截图检查。
- Windows 免安装目录版启动、详情滚动、输入焦点和高 DPI 检查。

## 9. 自动化检查与测试

### 9.1 静态样式检查

扩展 `tests/designTokens.test.ts`：

- 字号只能来自五档全局令牌。
- 常规颜色只能来自全局语义令牌。
- 常规背景不得直接使用未登记 `rgba` 或十六进制颜色。
- spacing、radius、border、font-weight、line-height 优先使用令牌。
- 私有滚动条规则必须报错。
- 组件 CSS 变量必须拥有组件前缀。
- 特殊颜色只能命中显式 allowlist，并写明原因。

### 9.2 组件测试

- `DetailSection` 的标题、主体、空状态、错误状态和操作区结构。
- 属性/技能/材料三类分区使用相同的外层样式契约。
- 武器派生路线始终出现在材料后。
- 加入道具箱/装备箱固定在底部，不随内容滚动。
- 箱格数量上限与图鉴携带上限不会混淆。
- 关联点击仍遵守一级抽屉规则。

### 9.3 视觉回归

至少覆盖：

- 防具、武器、道具详情。
- 技能、任务、怪物、猎猫详情。
- 配装器、自动配装历史、修改器个人信息/道具箱/装备箱/猫猫。
- 空状态、错误、加载、风险诊断、只读和成功提示。
- 窄窗口、普通窗口和宽窗口。

### 9.4 交互与无障碍

- 键盘焦点环统一且可见。
- 颜色不是唯一状态表达方式，正负、风险、来源和选中状态同时有文字/符号。
- 所有图标按钮有可访问名称或 tooltip。
- `prefers-reduced-motion` 下抽屉和状态变化仍然可理解。
- 长文本、英文、日文和 ID 不造成布局跳动或横向溢出。

## 10. 验收清单

源码迁移的逐项状态以 [18-ui-style-audit-checklist.md](18-ui-style-audit-checklist.md) 为准；本节保留为规范验收项，已完成项按当前验证结果同步。

### 令牌

- [ ] 五档字号仍保持不变且无新字号。
- [ ] 间距、圆角、边框、背景、字重和行高令牌已建立。
- [ ] 普通文字、数据、标题、元数据和状态颜色含义固定。
- [ ] 特殊属性/斩味/状态色均有文字或符号辅助。

### 详情

- [x] 属性、技能、材料共用统一详情分区样式。
- [x] 防具顺序为防御 → 耐性 → 技能 → 材料。
- [x] 武器顺序为核心属性 → 专项 → 材料 → 派生。
- [x] 道具加入按钮、武器/防具加入按钮固定在底部。
- [x] 详情主体只有一个主要滚动容器。

### 页面与抽屉

- [x] 图鉴、配装器和修改器的标题、列表、表格和操作区视觉一致。
- [x] 抽屉不改变正文宽度，不出现嵌套抽屉和多余滚动条。
- [ ] 1024px、1280px、1440px 均无窗口整体滚动。

### 质量门槛

- [x] `pnpm typecheck`
- [x] `pnpm exec vitest run --minWorkers=1 --maxWorkers=2`
- [x] `pnpm build`
- [x] `git diff --check`
- [ ] 视觉回归截图通过。
- [ ] Windows 免安装目录版人工检查通过。


## 11. 页面逐项清单（历史模板）

当前页面勾选状态与逐页回归备注以 [18-ui-style-audit-checklist.md](18-ui-style-audit-checklist.md) 为准；本节的未勾选项保留为最初需求模板，不代表源码迁移未完成。

以下清单按当前源码目录逐页登记。

标记规则：

- [ ] 待处理：该页面仍需按本计划迁移到统一令牌、详情/列表协议并完成视觉回归。
- [x] 已处理：已扫描，当前页面没有独立视觉实现或只负责复用公共组件；后续只需随公共组件回归。

- [ ] `ArmorCatalogPage`：布局、工具栏/筛选、列表/套装视图、详情区和内部滚动。
- [ ] `DecorationCatalogPage`：布局、工具栏、列表、技能关系和详情抽屉。
- [ ] `GameHomePage`：首页游戏入口卡片、平台徽标和响应式网格。
- [ ] `GameOverviewPage`：游戏概览头部、导航分组和内容工作区。
- [ ] `HomePage`：首页背景、主标题、版本卡和加载/错误状态。
- [ ] `HunterArtCatalogPage`：狩技搜索筛选、列表/详情主从布局和来源状态。
- [ ] `ItemCatalogPage`：道具搜索筛选、列表、详情和关系抽屉。
- [ ] `LoadoutBuilderPage`：七槽工作台、技能/属性区、工作抽屉和自动任务入口。
- [ ] `MonsterCatalogPage`：怪物列表、详情标签、表格和内部滚动。
- [ ] `PalicoEquipmentCatalogPage`：猫装备浏览、筛选排序、详情和窄窗口布局。
- [ ] `PalicoSkillsCatalogPage`：随从技能列表、详情和解锁关系。
- [ ] `PalicoSupportMovesCatalogPage`：支援行动列表、详情和倾向筛选。
- [ ] `PalicoTypesCatalogPage`：支援倾向列表、特性和行动关系。
- [ ] `QuestCatalogPage`：任务筛选、表格、详情标签和关联关系。
- [ ] `SaveEditorPage`：会话头、四标签工作区、箱格、详情和固定操作区。
- [ ] `SkillCatalogPage`：技能列表、发动关系、来源标签和护石关系。
- [ ] `WeaponCatalogPage`：武器列表/派生/动作值视图、详情、表格和滚动。
- [ ] `WorkspaceFeaturePage`：占位工作区、功能入口和空状态。

页面完成条件：页面骨架只负责布局，组件内部样式由组件自身拥有；工具栏、主从列、表格、详情和底部操作区均使用统一令牌；窗口整体不滚动。

## 12. 组件逐项清单（历史模板）

当前组件勾选状态与 171 个目录的扫描结果以 [18-ui-style-audit-checklist.md](18-ui-style-audit-checklist.md) 为准；本节的未勾选项保留为最初需求模板，不代表源码迁移未完成。

以下条目覆盖当前 `ui/components` 下每一个包含 TSX 的组件目录。带 CSS 的组件默认列为待处理；没有独立 CSS、完全复用公共外壳的组件标记为已处理，避免重复迁移。

- [ ] `ArmorCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorFilterBar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorIcon`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorListRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorMaterialList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorSetMatrix`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorSetRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorSkillList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorStatsPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ArmorViewToggle`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `AutoLoadoutDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `AutoLoadoutHistoryDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `AutoLoadoutJobProgress`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `AutoLoadoutResultList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `AutoLoadoutResultRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `BowDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `BowgunAmmoTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `BowgunDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `CatalogIcon`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `CatalogResetButton`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `CatalogWriteControl`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [x] `CatalogWriteDrawer`：已扫描；无独立 CSS，复用公共外壳或仅负责状态/路由组合，随宿主组件回归。
- [ ] `CemuLogo`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `CharmEditorForm`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `CharmPickerDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `CommonHeader`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ConfirmationDialog`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationEditorContent`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationEditorDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationListRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationMaterialList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationSkillFilter`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DecorationSkillSection`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `DetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `EquipmentPickerContent`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `EquipmentPickerDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `EquipmentSlotIndicator`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `GameOverviewPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `GameShell`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `GameVersionCard`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `GameVersionGrid`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `GuildBackdrop`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `GunlanceDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `HunterArtCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `HunterArtDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `HunterArtDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `HunterArtList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `HuntingHornDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `InsectGlaiveDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemFilterBar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemListRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemPagination`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `ItemRelationSection`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutEquipmentRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutEquipmentTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutLegalitySummary`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutSaveWriteDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutSkillMatrix`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutSlotIcon`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutStatsPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `LoadoutWorkspaceDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MeleeSharpnessDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterAilmentTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterDetailHeader`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterDetailTabs`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterDropTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterIcon`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterListRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterQuestAppearanceTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterSearchInput`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterSearchList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `MonsterWeaknessTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoAbilityDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoEntryList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoEquipmentBrowser`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoEquipmentDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoEquipmentDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoSharpnessLevel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoSupportMoveDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PalicoTypeDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PhialWeaponDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `PlatformBadgeList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `QuestCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `QuestDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `QuestDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `QuestInfoSection`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `QuestList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `QuestRewardsSection`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `QuestUnlockSection`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `RelicArmorAdvancedFields`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `RelicDecorationRecordFields`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `RelicEquipmentEditor`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `RelicLookupSelect`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `RelicSharpnessBar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `RelicWeaponAdvancedFields`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveBoxTransferDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveBoxWorkspace`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveCharacterPicker`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveEnvironmentPicker`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveEquipmentEditorDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveEquipmentEmbeddedDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveItemPickerDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveMutationToastRegion`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SavePalicoEditor`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SavePersonalEditor`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SaveSessionHeader`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [x] `SaveSessionProvider`：已扫描；无独立 CSS，复用公共外壳或仅负责状态/路由组合，随宿主组件回归。
- [ ] `SearchableSelect`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillActivationTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillArmorRelationList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillComponentList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillDecorationRelationList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillListRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillSearchList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillSourceTabs`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `SkillTalismanRelationList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponAttributeList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponCatalogToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponCoreStats`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponDetailDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponDetailPanel`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponFilterBar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponListColumns`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponListRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponMaterialList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponMotionDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponMotionRow`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponMotionTable`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponMotionToolbar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponProductionBadge`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponRelationList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponSharpnessBar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponSharpnessComparison`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponStyleBadgeList`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponTreeCanvas`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponTreeControls`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponTreeMatchNavigator`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponTreeMinimap`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponTreeNode`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponTreeTypePrompt`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponTypeDetail`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WeaponViewToggle`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WorkspaceContent`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WorkspaceDrawer`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WorkspacePlaceholder`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。
- [ ] `WorkspaceSidebar`：统一组件字号、颜色语义、间距、边框/背景、圆角、状态和滚动行为。

组件迁移顺序：先处理 `DetailDrawer`、`WorkspaceDrawer`、`DetailSection`、`DetailStatGrid`、`DetailList` 和 `DetailActionBar` 等基础外壳，再按防具/武器/道具、技能/任务/怪物/猎猫、配装器和修改器分批勾选。每个条目勾选前必须完成组件测试、窄窗口检查和 `git diff --check`。

### 12.1 组件分组复核顺序

- [ ] 基础壳层：`CommonHeader`、`GameShell`、`WorkspaceContent`、`WorkspaceSidebar`、`WorkspaceDrawer`、`DetailDrawer`、`ConfirmationDialog`、`SearchableSelect`。
- [ ] 详情共用层：`ArmorDetailPanel`、`ArmorStatsPanel`、`ArmorSkillList`、`ArmorMaterialList`、`WeaponDetailPanel`、`WeaponCoreStats`、`WeaponTypeDetail`、`WeaponMaterialList`、`WeaponRelationList`、`ItemDetailPanel`、`ItemRelationSection`。
- [ ] 图鉴列表层：道具、装饰品、武器、防具、怪物、任务、技能、狩技和猎猫的 Toolbar、Filter、List、Row、Table、Pagination 组件。
- [ ] 配装器层：`LoadoutEquipmentTable`、`LoadoutEquipmentRow`、`LoadoutSkillMatrix`、`LoadoutStatsPanel`、`LoadoutLegalitySummary`、`AutoLoadoutDrawer`、`AutoLoadoutResultList`、`AutoLoadoutResultRow`、`AutoLoadoutJobProgress` 和全部选择/编辑抽屉。
- [ ] 修改器层：`SaveSessionHeader`、`SaveBoxWorkspace`、`SaveEquipmentEmbeddedDetail`、`SaveEquipmentEditorDrawer`、`SaveItemPickerDrawer`、`SavePalicoEditor`、`SavePersonalEditor`、`SaveBoxTransferDrawer`、`SaveMutationToastRegion` 和会话相关选择组件。
- [ ] 特殊数据视觉：斩味、属性、弹种、瓶、平台徽标、风险/合法性、生产状态和图标 fallback。

### 12.2 每个条目的完成勾选条件

- [ ] 字号只使用五档全局令牌，字重和行高使用统一令牌。
- [ ] 常规文字、数据、标题、元数据和状态色符合语义表。
- [ ] padding、margin、gap、圆角和边框使用令牌或有前缀的组件变量。
- [ ] 没有新增私有滚动条轨道、滑块颜色或宽度。
- [ ] 空、加载、错误、只读、禁用、风险和成功状态均有稳定布局。
- [ ] 键盘焦点、图标名称、reduced-motion 和长文本行为通过测试。
- [ ] 在 1024px、1280px、1440px 下检查无窗口整体滚动和内容裁切。

## 13. 交付边界

本计划完成后，样式统一应成为项目的长期约束，而不是一次性的页面美化：

- 新增组件必须先选择已有令牌和组件变体。
- 新增详情区必须复用 `DetailSection` 视觉协议。
- 新增颜色、间距和圆角必须有语义理由并进入令牌或 allowlist。
- 任何绕过设计令牌的样式测试失败都必须在提交前处理，不能以“视觉上差不多”跳过。
- 数据、存档、图标和研究资料边界不因 UI 统一而改变。
