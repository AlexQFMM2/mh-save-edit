# 三作武器图鉴与派生画布实施计划

状态：武器数据、Repository/IPC、列表、派生画布及 GU/XX 动作值第三模式第一版已完成；性能专项验收待继续
计划日期：2026-09-07  
适用内容库：MH3G/MH3U、MH4G、MHGU/MHXX

### 2026-09-07 数据闭环记录

- 三套 Dex 权威快照已分别固定到 `research/mh3u/dex/mh3g-dex`、`research/mh4g/dex/mh4g-dex`、`research/mhgu/dex/mhxx-dex`，并保留完整导出结构与逐文件 SHA-256。
- `tools/build_weapon_catalog.mjs` 已实现统一表、身份 crosswalk、派生边、属性、斩味、材料、笛旋律、炮击、瓶、猎虫、弩弹/速射、弓蓄力、图标和 GU/XX 内容差异构建。
- `pnpm data:build:weapons -- --research-root ../research` 已连续构建两次，三作内容摘要稳定。
- 正式武器数量为 MH3G 1,421、MH4G 2,324、MHGU/XX 10,911；正式记录缺图、近战缺斩味、材料外键缺失和未知专项枚举均为 0。
- MH3G 13 条、MH4G 15 条“有生产材料但价格为 0”的活动/特殊生产配方作为可直接生产记录保留，并单列到 audit observations；它们不是缺材料，也不会被误改成强化配方。
- MH4G 的 83 条数量差额已逐条分类：14 条“无装备”、48 条纯 DUMMY、28 条 Dex Build 7 外地区扩展；另有 5 个重复派生节点作为同一存档身份的别名保留，2 个海外替代节点无独立日版存档身份。`Emperor's Speech` 虽无中文翻译但具备英文名、存档身份和 Dex 节点，按正式武器保留；日文 `ダミー` 记录则正确归入纯 DUMMY。
- GU/XX 大剑家族 60“灼炎大剑”的唯一原生差异已解码为模型资源 ID，并写入 `catalog_weapon_content_variants`：MHGU 134，MHXX 112。

### 2026-09-07 第一版实施记录

- 已实现三作统一 `WeaponCatalogRepository`、Zod 入参校验、Electron IPC/preload 白名单和 renderer 类型声明。
- 已实现名称/ID、武器类型、属性/觉醒、稀有度、孔位和可直接生产筛选，以及攻击、会心、孔位、稀有度和各匠阶段斩味排序。
- 已实现普通近战、狩猎笛、铳枪、斩斧/盾斧、操虫棍、轻重弩和弓的强类型详情；专项枚举不向 UI 暴露数字 ID。
- 已实现列表和 React Flow 派生画布双模式。画布支持卡片选择、滚轮缩放、拖动画布、搜索命中定位、命中前后跳转、缩略图、缩放控制和回到选中节点。
- 派生布局会对同一深度列执行纵向碰撞消解，并按放大后的节点高度保留间距；可生产状态固定显示为右上角暖白底、深烫金字标签。
- 已实现 MH3G/MH4G 两阶段、MHGU/XX 三阶段斩味组件；轻弩、重弩、弓不渲染伪斩味。
- 已接通武器材料到道具抽屉，以及道具武器用途到武器抽屉；继续遵守“正文打开一级抽屉，抽屉内再次点击改为跳转”的规则。
- 全项目排版现已收敛到五档全局字号，业务数据统一使用亮金色语义令牌，并由 `tests/designTokens.test.ts` 防止回归。
- 当前 TypeScript、65 项 Vitest、Electron Vite build 和 diff 检查通过。尚未完成最大 MHGU/XX 单类派生树的 React Profiler 性能实测，因此不把性能专项标记为完成。

### 2026-09-08 GU/XX 动作值模式

- 仅 `mhgu` 内容库新增“动作值”第三模式，覆盖 14 种猎人武器并排除猎猫。
- 已接入六风格可搜索多选、动作分类、动作值/气绝/减气排序、URL 状态、行内变体与 Hit 展开，以及攻击型狩技一级详情抽屉。
- GU/XX 公共 HDP、六风格命令资源、远程 HDS 和三语 WeaponControls GMD 已固定到私有 research 并纳入来源审计；原生逐事件参数 crosswalk 仍待精修，未确认字段保持为空。
- 详细数据边界、构建命令与后续原生字段精修见 [11-weapon-motion-catalog.md](11-weapon-motion-catalog.md)。

## 1. 目标与本轮边界

在现有道具、装饰品图鉴框架上实现三套离线武器图鉴，并提供两种共享同一数据和筛选状态的浏览模式：

1. **列表模式**：高密度表格，用于搜索、筛选、排序和横向比较。
2. **派生模式**：现代化可平移、缩放的武器派生画布，用于理解生产入口、强化路径和分支关系。

第一版必须支持：

- 按武器类型筛选。
- 按属性/异常属性筛选，同时正确处理双属性和已确认的觉醒属性。
- 按稀有度、攻击、孔数、斩味、会心率排序，并支持升序/降序。
- 筛选可直接生产的武器。
- 近战武器使用七色分段斩味条，不把斩味简化成单一数字。
- 根据当前武器类型切换表格专属列和详情表单；弩、弓、狩猎笛等不能套用普通近战模板。
- 列表与派生画布一键切换，保留搜索、筛选和当前选中武器。
- 右侧详情展示武器核心属性、斩味、生产/强化材料以及父级、子级入口。
- 材料和其他关联对象继续遵守公共交互：页面内点击打开一级抽屉，抽屉内再点击则关闭抽屉并跳转，不嵌套抽屉。

本轮不实现：

- 将武器写入装备箱。
- 配装器联动、自动配装或存档合法性修复。
- MH4G 发掘武器的展示、统计和随机属性生成。发掘武器变化范围过大，本图鉴完全不收录。
- 武器 3D 模型或从 ROM 动态加载模型。
- 在 Dex 已确认规则之外推测字段语义；无法解释的字段只进入审计报告，不伪装成可用数据。

## 2. 已确认的数据现状与风险

### 2.1 三作身份模型不同

不能建立一个只含 `game_id + weapon_id` 的宽泛身份：

- MH3G/MH3U：普通武器形态目前以 `save_type + save_id` 对应存档可写值。
- MH4G：普通武器也以 `save_type + save_id` 表示。现有库中的发掘武器相关记录不进入统一武器图鉴、列表、派生图或筛选统计，只在构建审计中记录被排除数量。
- MHGU/MHXX：存档保存“武器家族 ID + 等级”，Dex 则把每个等级/名称形态展开为独立 `Wpn_ID`。一个可浏览、可写入的形态必须同时保留家族 ID 和等级。

统一身份定义为：

```ts
type WeaponIdentity = {
  gameId: GameId
  weaponTypeId: number
  saveId: number
  saveLevel?: number
}
```

`dexId` 只用于来源追踪、属性和关系关联，不能替代 `saveId`。

### 2.2 当前数据审计快照

- MH3G 当前 `weapons` 表有 1,437 行，其中 1,421 行为非占位记录；已有攻击、属性、会心、孔位和七段斩味字段。
- MH4G Dex `DB_Wpn` 有 2,331 条记录；当前存档身份表有 2,849 条，其中包含 435 条发掘武器记录。排除发掘后仍有 2,414 条普通身份，比 Dex 多 83 条；这 83 条必须逐条解释为“无装备”、DUMMY、活动武器或真实缺口，不能靠数量截断。构建器必须在 crosswalk 前明确排除 435 条发掘记录，不能让它们影响图鉴数量、筛选结果或属性统计。
- MHGU/XX Dex `DB_Wpn` 有 10,911 条逐级形态；当前中文库有 1,606 个武器家族记录和 10,925 条等级槽。每种武器类型各有一条 `weapon_id=0/save_level=0` 的“无”占位，共 14 条；排除后恰好剩 10,911 条可写等级身份。这个数量相等是 crosswalk 的强校验条件，但仍不能用行号直接等同，必须建立“家族 + 等级 ↔ Dex Wpn_ID”交叉表并抽样核对名称和数值。
- MH3G 有 12 类武器；MH4G、MHGU/XX 有 14 类武器。
- MH4G 与 MHGU/XX 的 `DB_Wpn` 已确认包含稀有度、攻击、两组特殊属性、会心、防御、孔位、生产价、强化价、斩味原始值以及武器类型专属字段。
- 三作 `DB_Wpn.Child` 已确认是当前节点的直接子节点数量；同一 `Wpn_Type_ID` 内记录按 `Wpn_ID` 构成深度优先先序序列，可以确定性还原派生边。
- 三作 Dex 客户端已经完整实现普通斩味和匠延长的拆分：3G/4G 是“基础 / 匠+1”，GU/XX 是“基础 / 匠+1 / 匠+2”。
- 3G/4G 的负属性点是觉醒/隐藏属性，展示值取绝对值；GU/XX 的 `-1` 是属性不存在的哨兵，不能误判为觉醒。
- `DB_ItmtoWpn.Type=P` 表示生产材料，`Type=U` 表示强化材料；最终仍需结合价格与来源完整性生成审计报告。
- `Wpn_<武器类型><稀有度>` 已验证是列表使用的 16×16 分类图标。`ImgFile`（如 `WpnImg_*`、`two130`）不是这个小图标键；若用于右侧大图，必须另建资源审计流程。

上述数量只是当前输入快照，不作为盲目追求的最终可见数量。最终数量以存档身份 crosswalk、占位规则和来源审计共同决定。

### 2.3 Dex 与游戏本体双来源状态

“Dex 里能显示”和“本项目已经能重复构建”是两个不同状态。2026-09-07 的只读核查结果如下：

| 数据域 | MH3G | MH4G | MHGU/XX | 当前结论 |
| --- | --- | --- | --- | --- |
| 公共武器数值 `DB_Wpn` | `direct_sql/DB_Wpn.csv` 已固定 1,421 行 | 已固定 2,331 行 | XX 已固定 10,911 行；GU 原生表另作版本验证 | 已闭环 |
| 多语言武器名 | `ID_Wpn_Name.csv` 已具名固定 | 已固定 | XX 已固定；GU/XX 家族等级 crosswalk 已生成 | 已闭环 |
| 生产/强化材料 | `DB_ItmtoWpn.csv` 已导出 | `DB_ItmtoWpn.csv` 已导出 | `DB_ItmtoWpn.csv` 已导出 | 材料外键缺失 0 |
| 狩猎笛旋律 | 两表均已导出并映射 | 两表均已导出并映射 | 两表均已导出并映射 | 已闭环 |
| 轻/重弩弹表 | `DB_Wpn_Gun.csv` 已导出 | `DB_Wpn_Gun.csv` 已导出 | `DB_Wpn_Gun.csv` 与内藏弹 `DB_BGAmmo.csv` 均已导出 | 弹名及速射/蹲射动作已归一化 |
| 专属枚举 | 已具名固定并映射 | 已具名固定并映射 | 已具名固定并映射 | 未知枚举 0 |
| 分类图标 | manifest、hash PNG、数据库引用已生成 | 同左 | 同左 | 正式武器缺图 0 |
| 存档身份 crosswalk | 1,421 正式 + 16 占位 | 2,324 正式 + 62 占位；28 地区扩展及 435 发掘仅入审计 | 10,911 正式 + 14 占位 | 已闭环 |

本轮已经修复的导出缺口如下；以下内容保留为导出器维护记录：

- MH3G `ReflectionRunner` 原本只导出 `LooksItemRelated` 命中的表；武器副本现已补导 `DB_Wpn`、`DB_HHSong`、`DB_HHSongtoWpn`、`ID_Wpn_Name` 和全部武器专项 `ID_Wpn_*`。
- MH4G `Runner.IsEditorTable` 原本遗漏 `HHSong`；武器副本现已补导 `DB_HHSong` 和完整关联表。
- 后续重新运行导出器及写入宿主机仍须按 `AGENTS.md` 取得明确授权；正式构建继续只读 `research` 固定输入，不得退回 `/tmp/mh*-dex-*`。

### 2.4 GU 与 XX 原生资源交叉验证

MHGU Switch RomFS 与 MHXX 3DS RomFS 的武器原生表分别位于：

```text
D:\MH\unpack\mhgu\romfs\nativeNX\table
D:\MH\unpack\mhxx\cci_unpacked\romfs\table
```

已确认 `kireajiData.kad`、弩弹、速射、笛旋律、所有 `weaponXXLevelData`、所有 `weaponCreateWXX`、所有 `weaponProcessWXX` 以及除大剑外的 `weaponXXBaseData` 在两版中 SHA-256 一致。关键斩味表证据为：

```text
kireajiData.kad
MHGU SHA-256: b02584d22a78cc98f679a916b2c60c0d257f36bcf140a7194b70c668ddd6f09f
MHXX SHA-256: b02584d22a78cc98f679a916b2c60c0d257f36bcf140a7194b70c668ddd6f09f
```

但不能把两版原生资源整体视为完全相同：

- `weapon00BaseData.w00d` 两边均为 4,529 字节，但 SHA-256 不同；唯一差异是家族 ID 60“灼炎大剑”记录内偏移 `+6` 的模型资源引用：MHGU 为 134（`arc/weapon/w00/134.arc`），MHXX 为 112（`arc/weapon/w00/112.arc`）。两值已写入版本差异覆盖层，不能覆盖成共用值。
- `weapon14MsgData_jpn.gmd` 也不同；本地化资源必须按语言和版本保存来源，不用另一版同名文件覆盖。
- “共用 `mhgu.sqlite`”表示共享已经验证相同的公共内容，不表示丢弃差异。构建模型需要 `content_variant` 或等价覆盖机制，允许 `mhgu-switch` 与 `mhxx-3ds` 对差异记录单独赋值。

### 2.5 当前是否具备开发条件

结论：**以下数据门槛已经全部通过，并已用于列表页和派生画布第一版。** 闭环条件继续保留为回归检查：

1. 3G/4G 上述缺失武器表补导完成，三作武器输入不再依赖 `/tmp`。
2. 三作所有武器专项 ID 都能转成可读名称；不允许炮击、弹种、旋律、瓶或蓄力只显示数字 ID。
3. MH4G 的 83 条普通身份差额逐条分类；发掘 435 条保持完全排除。
4. GU/XX 的 10,911 条“家族 + 等级”身份全部映射到 Dex 节点，并解码大剑原生表唯一差异。
5. 生产/强化材料到 `catalog_items` 的外键 0 缺失，派生边不变量全部通过。
6. 三作武器分类图标完成 PNG 导出、hash 去重、manifest 和数据库引用，正式武器 0 缺图。
7. 生成 `source-manifest`、crosswalk 报告、异常报告并连续构建两次，SQLite 内容摘要一致。

### 2.6 已确认的派生、斩味与觉醒规则

#### 派生边

`DB_Wpn.Child` 表示当前武器的直接子节点数量。对每个 `Wpn_Type_ID` 分组，按 `Wpn_ID` 顺序读取深度优先先序序列，并维护“尚未消费的子节点数”栈：

1. 读取节点前弹出剩余子节点数为 0 的栈顶。
2. 若栈非空，当前节点连接到栈顶父节点，并将父节点剩余数减 1。
3. 当前节点 `Child > 0` 时，将它和 `Child` 入栈。
4. 栈为空时，当前节点是新的派生根。

三套输入已经全部闭合：

| 内容库 | 节点 | 边 / `sum(Child)` | 根 | 类型 | 栈闭合 |
| --- | ---: | ---: | ---: | ---: | --- |
| MH3G | 1,421 | 1,238 | 183 | 12 | 全部为 0 |
| MH4G | 2,331 | 1,930 | 401 | 14 | 全部为 0 |
| MHGU/XX | 10,911 | 10,117 | 794 | 14 | 全部为 0 |

构建器必须原样复刻该算法，并验证 `边数 = sum(Child) = 节点数 - 根数`、每类型栈闭合、无跨类型边和无环。`Child=0` 同时是 Dex 使用的最终形态判断。

#### 斩味与匠

`Sharp` 是 14 位十进制字符串，每两位一个长度段；按起始位置 `12, 10, 8, 6, 4, 2, 0` 读取后依次对应红、橙、黄、绿、蓝、白、紫。它不是十六进制数。

从完整斩味末端扣除长度时，按紫到红传播剩余扣减量：当前色段减到不小于 0，未扣完的量继续传给下一个低阶颜色。

- MH3G、MH4G：`Sharp` 是完整匠+1斩味；`SharpP1=1` 时从末端扣 5 得到基础斩味，否则基础与匠+1相同。
- MHGU/XX：XX Dex 明确提供“基础 / 匠+1 / 匠+2”三种显示模式。`Sharp` 是匠+2完整斩味；`SharpP1=1` 时扣 5 得匠+1、扣 10 得基础，否则三个阶段相同。`SharpP1` 只是“是否允许延长”的标志，不代表只有一级匠，也不能直接当 cutoff 保存。
- 远程武器不生成斩味记录。弓的 `SharpP1` 用于表示装填数技能追加的 `[+]` 蓄力等级，必须归一化为 `loadUpChargeLevel`，不能创建伪斩味。

三作所有 `DB_Wpn.Sharp` 均已验证为 14 位十进制字符串。GU/XX 的字段分布还确认：11 类近战武器都存在 `SharpP1=1` 的记录；轻弩、重弩全部为 `0`；弓同时有 `0/1`，但其 `1` 只解释为装填数追加蓄力。跨颜色扣减固定样本采用 `Wpn_ID=3`、`Sharp=00000006240812`：匠+2末端色段不足 10，构建器必须把扣减继续传播到下一个低阶颜色，而不能把单个色段减成负数。

#### 觉醒属性

- MH3G、MH4G：`SpAtk1_Pt` / `SpAtk2_Pt < 0` 表示觉醒/隐藏属性，归一化为 `value = abs(points)`、`is_hidden = true`。
- MHGU/XX：属性点的 `-1` 是缺失哨兵，应删除该属性位；不能套用 3G/4G 的觉醒规则。
- 列表展示游戏内显示攻击并按显示攻击排序；真实基础攻击只在来源和换算公式确认后作为详情补充。

这些规则已由 Dex 数据分布和客户端显示逻辑交叉确认，不再作为“交付前未知阻塞项”；实施时仍需用固定样本和结构不变量防止构建器回归。

## 3. 统一数据库设计

在三个 SQLite 中生成相同的公共目录表，保留现有原始/旧表作为构建输入，不让 UI 查询差异化表。

```sql
CREATE TABLE catalog_weapon_types (
  game_id TEXT NOT NULL,
  type_id INTEGER NOT NULL,
  save_type INTEGER NOT NULL,
  name_cn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  icon_key_prefix TEXT NOT NULL,
  PRIMARY KEY (game_id, type_id)
);

CREATE TABLE catalog_weapons (
  game_id TEXT NOT NULL,
  weapon_key TEXT NOT NULL,
  type_id INTEGER NOT NULL,
  save_type INTEGER NOT NULL,
  save_id INTEGER NOT NULL,
  save_level INTEGER,
  display_level INTEGER,
  dex_id INTEGER,
  name_cn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_jp TEXT NOT NULL DEFAULT '',
  rarity INTEGER,
  display_attack INTEGER,
  true_raw_attack INTEGER,
  affinity REAL,
  defense INTEGER,
  slots INTEGER,
  production_price INTEGER,
  upgrade_price INTEGER,
  is_directly_producible INTEGER NOT NULL DEFAULT 0,
  is_final_form INTEGER NOT NULL DEFAULT 0,
  icon_path TEXT,
  preview_path TEXT,
  is_placeholder INTEGER NOT NULL DEFAULT 0,
  mapping_status TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, weapon_key)
);

CREATE TABLE catalog_weapon_attributes (
  game_id TEXT NOT NULL,
  weapon_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  attribute_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  name_cn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  value INTEGER NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, weapon_key, position)
);

CREATE TABLE catalog_weapon_sharpness (
  game_id TEXT NOT NULL,
  weapon_key TEXT NOT NULL,
  red INTEGER NOT NULL,
  orange INTEGER NOT NULL,
  yellow INTEGER NOT NULL,
  green INTEGER NOT NULL,
  blue INTEGER NOT NULL,
  white INTEGER NOT NULL,
  purple INTEGER NOT NULL,
  base_cutoff INTEGER NOT NULL,
  handicraft_1_cutoff INTEGER,
  handicraft_2_cutoff INTEGER,
  raw_value TEXT NOT NULL,
  interpretation_status TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, weapon_key)
);

CREATE TABLE catalog_weapon_edges (
  game_id TEXT NOT NULL,
  parent_weapon_key TEXT NOT NULL,
  child_weapon_key TEXT NOT NULL,
  branch_order INTEGER NOT NULL,
  edge_kind TEXT NOT NULL,
  mapping_status TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (game_id, parent_weapon_key, child_weapon_key)
);

CREATE TABLE catalog_weapon_materials (
  game_id TEXT NOT NULL,
  weapon_key TEXT NOT NULL,
  material_kind TEXT NOT NULL,
  item_save_id INTEGER NOT NULL,
  item_dex_id INTEGER,
  quantity INTEGER NOT NULL,
  source TEXT NOT NULL
);
```

补充表按武器类型保存专属数据，不使用弱类型的 `catalog_weapon_specials(key, value)` 键值袋：

- `catalog_weapon_hunting_horns`：三个音色；通过 `DB_HHSongtoWpn` 关联旋律、演奏效果和持续时间。
- `catalog_weapon_gunlances`：`GLShotType_ID` 对应的炮击类型和炮击等级。
- `catalog_weapon_phials`：武器类别、`AxePhial_ID` 对应的瓶类型；斩击斧和盾斧保留不同类别与显示文案。
- `catalog_weapon_insect_glaives`：`ISKinsectType_ID` 对应的猎虫切断/打击类别。
- `catalog_weapon_bowguns`：装填速度、后坐力、偏移等 `DB_Wpn_Gun` 公共弩属性。
- `catalog_weapon_gun_ammo`：弹种、装填数、速射、蹲射以及 GU/XX `DB_BGAmmo` 内藏弹；轻弩和重弩保留各自可用动作语义。
- `catalog_weapon_bows`：曲射/刚射模式、可用瓶以及 `load_up_charge_level`。
- `catalog_weapon_bow_charges`：`BowShotType1_ID..4_ID` 对应的蓄力等级、箭型和等级；`BowShot_ID` 单独归一化为弓的射击模式，不与蓄力箭型混存。

每张专属表都以 `(game_id, weapon_key)` 为外键并保留原始 ID 和来源。不要把所有字段塞进超宽主表，也不要把未知值格式化成看似可信的中文。

### 3.1 稳定 `weapon_key`

构建器生成平台无关字符串键：

```text
3G/4G: <saveType>:<saveId>
GU/XX: <saveType>:<saveId>:<saveLevel>
```

URL、Repository、树边和材料关系统一使用该键。解析时仍由 Zod 校验各段范围，不能把字符串直接拼进 SQL。

### 3.2 可直接生产规则

`is_directly_producible` 使用 Dex 的生产语义构建：

- `production_price > 0` 是生产入口的主要标志。
- `DB_ItmtoWpn.Type=P` 提供对应生产材料。
- 有生产价但无生产材料、或有 P 材料但无生产价的记录进入审计报告，不静默改成升级材料。
- “派生树根节点”不等于“可直接生产”；位于树中间但允许直接生产的武器也必须被筛选出来。

### 3.3 发掘与占位记录

- “无装备”、DUMMY、未映射记录默认隐藏，调试开关才显示。
- MH4G 发掘武器在构建输入阶段直接排除，不写入 `catalog_weapons`；它们也不能通过调试开关出现。
- 构建报告必须单独记录发掘输入数量和排除规则，防止以后误回归，但 Repository 不提供发掘筛选参数。

### 3.4 武器类型与专属数据矩阵

Dex 实际列分布已经确认如下：

| 武器类别 | MH3G `Wpn_Type_ID` | MH4G/GU `Wpn_Type_ID` | 首版专属内容 |
| --- | ---: | ---: | --- |
| 常规近战 | 1–5、7 | 1–5、7 | 七色斩味、基础/匠阶段 |
| 狩猎笛 | 6 | 6 | 斩味、三音色、旋律、效果、持续时间 |
| 铳枪 | 8 | 8 | 斩味、炮击类型、炮击等级 |
| 斩击斧 | 9 | 9 | 斩味、瓶类型 |
| 轻弩 | 10 | 12 | 装填、后坐力、偏移、弹表、速射 |
| 重弩 | 11 | 13 | 装填、后坐力、偏移、弹表、蹲射/特殊装填 |
| 弓 | 12 | 14 | 曲射/刚射、蓄力箭型、`[+]` 层级、瓶 |
| 盾斧 | — | 10 | 斩味、瓶类型，使用盾斧专属文案 |
| 操虫棍 | — | 11 | 斩味、猎虫切断/打击类别 |

字段存在性已由三作 `DB_Wpn` 逐类型统计确认：3G 的类型 6/8/9/10/11/12 分别出现笛、炮击、瓶、轻弩、重弩、弓字段；4G/GU 的类型 6/8/9/10/11/12/13/14 分别出现笛、炮击、斩斧瓶、盾斧瓶、猎虫、轻弩、重弩、弓字段。

Repository 与 UI 必须按该矩阵建模，不能依据字段是否为空临时猜测武器类型，也不能向不适用的武器显示“—”组成的大表单。

斩味边界只按近战/远程划分：MH3G 的 9 类近战，以及 MH4G、MHGU/XX 的 11 类近战，全部具有七色斩味和适用游戏的匠阶段；这明确包括狩猎笛、铳枪、斩击斧、盾斧和操虫棍。只有轻弩、重弩、弓这 3 类远程武器没有斩味。

## 4. 斩味模型、绘制与排序

### 4.1 数据语义

近战武器保存七段非负长度：红、橙、黄、绿、蓝、白、紫。数据库同时保留原始值、基础 cutoff、各级匠 cutoff 和解释状态，以便发现解析错误后可重建。

阶段含义：

- `base_cutoff`：未发动匠时可用的斩味终点。
- `handicraft_1_cutoff`：三作的匠+1终点。
- `handicraft_2_cutoff`：GU/XX 匠+2终点；不支持第二阶段的游戏存 `NULL`。
- 武器不受匠影响时，各有效 cutoff 相等，并在详情明确显示“匠无延长”。

cutoff 是在完整七色序列上的累计位置，不重复保存三套颜色段。构建器根据 cutoff 切分基础部分、匠+1新增部分和匠+2新增部分。每个 cutoff 必须满足：

```text
0 <= base_cutoff <= 各作有效的匠 cutoff <= 七段总长度
```

对只支持一档匠的游戏，忽略 `handicraft_2_cutoff`。任何近战武器缺少适用游戏所需的 cutoff，都必须进入构建失败报告，不能退化成“只显示完整条”。

匠边界按 Dex 已确认算法生成：

1. 从 `Sharp` 解析完整七色序列，不先裁剪。
2. 3G/4G 在 `SharpP1=1` 时将完整总长作为匠+1 cutoff，并从最高颜色端传播扣减 5 得基础 cutoff；否则两个 cutoff 都等于完整总长。
3. GU/XX 在 `SharpP1=1` 时将完整总长作为匠+2 cutoff，传播扣减 5 得匠+1 cutoff、扣减 10 得基础 cutoff；否则三个 cutoff 都等于完整总长。
4. 只有轻弩、重弩和弓不生成 `catalog_weapon_sharpness`；弓的 `SharpP1` 转成 `load_up_charge_level`。狩猎笛、铳枪、斩击斧、盾斧和操虫棍仍执行完整的近战斩味/匠算法。
5. 每作固定抽样低阶、跨颜色边界、最高阶、匠无效和特殊斩味武器，与 Dex 客户端结果逐段核对；构建报告保存公式版本与样本 ID。
6. 以后公式变化必须提升 `data_version`，不能只改前端画法掩盖数据差异。

轻弩、重弩、弓没有斩味，此时：

- `catalog_weapon_sharpness` 不创建记录。
- 单一远程武器类型的列表不渲染斩味列，详情也不显示全黑空条。
- 按斩味排序时排在所有有斩味的记录之后。

### 4.2 `WeaponSharpnessComparison` 与 `WeaponSharpnessBar`

斩味不能保存成截图，也不能显示为一个总值或只显示当前排序档位。拆成“阶段比较容器 + 单条原子组件”：

```text
WeaponSharpnessComparison.tsx
WeaponSharpnessComparison.css
WeaponSharpnessBar.tsx
WeaponSharpnessBar.css
```

绘制规则：

- `WeaponSharpnessBar` 只绘制一个确定阶段：使用固定高度横向条，在深色轨道内按该阶段实际长度比例依次绘制七段颜色。
- `WeaponSharpnessComparison` 纵向排列全部适用阶段。MH3G/4G 始终同时显示两条“基础 / 匠+1”；MHGU/XX 始终同时显示三条“基础 / 匠+1 / 匠+2”。用户无需切换即可直接看出颜色和长度变化。
- 表格使用紧凑短标签“基 / 匠 / 匠1 / 匠2”，详情使用完整标签；标签是可读文本，不能只靠条的位置让用户猜阶段。
- 当前排序口径只给对应阶段标签和轨道增加强调态，不隐藏、替换或重排其他阶段。
- 武器不受匠影响时仍显示该游戏应有的两条或三条相同结果，并在比较组上标注“匠无延长”，避免用户误以为数据缺失。
- 列表使用紧凑尺寸，详情使用较宽尺寸；页面只能覆盖比较组件公开 CSS 变量。
- 颜色段宽度由数据计算成百分比或 CSS grid 比例，不为每把武器生成图片。
- 未占满的部分保持黑褐色轨道，形成用户示例图 1 中的直观长度差异。
- 每条提供阶段名和各颜色长度的 tooltip，例如“匠+1：蓝斩 20”；比较组提供包含全部阶段的 `aria-label`，不能只靠颜色传达数据。
- 因为各阶段已经独立成条，不再用一根条上的斜纹或半透明区域代替阶段结果；宽版详情可以额外绘制 cutoff 辅助线，但它不能取代多条比较。

建议公开变量：

```css
--weapon-sharpness-comparison-component-width
--weapon-sharpness-comparison-component-stage-gap
--weapon-sharpness-comparison-component-label-width
--weapon-sharpness-bar-component-width
--weapon-sharpness-bar-component-height
--weapon-sharpness-bar-component-track-color
--weapon-sharpness-bar-component-segment-min-width
```

### 4.3 斩味排序定义

“斩味排序”必须先选择口径 `base | handicraft1 | handicraft2`，再对该 cutoff 以内的可用斩味做稳定、可解释的复合排序，而不是把颜色编码当十六进制数字：

1. 最高非零颜色等级（紫 > 白 > 蓝 > 绿 > 黄 > 橙 > 红）。
2. 最高颜色段长度。
3. 总斩味长度。
4. 武器类型顺序、存档 ID、等级作为稳定兜底。

默认口径为基础斩味；降序表示该阶段下更高颜色、更长高阶斩味优先，升序反向。3G/4G 可切换“基础 / 匠+1”，GU/XX 可切换“基础 / 匠+1 / 匠+2”。切换口径会回到第一页并保持当前武器类型和其他筛选。

## 5. 页面信息架构

路由保持：

```text
/game/:gameId/catalog/weapons
```

页面沿用道具图鉴的内部滚动壳层，浏览器/窗口整体不滚动：

```text
┌────────────────────────────────────────────────────────────────────┐
│ 搜索框 │ 武器类型 │ 属性 │ 稀有度 │ 孔位 │ 可生产 │ 重置          │
│ 结果数 │ 排序字段 │ 升/降序 │ 斩味口径     │ [列表] [派生图]       │
├──────────────────────────────────────────────┬─────────────────────┤
│ 主浏览区：表格列表或派生画布                  │ 固定武器详情         │
│                                              │ 公共属性、类型专项   │
│                                              │ 材料、上下级入口     │
└──────────────────────────────────────────────┴─────────────────────┘
```

- 主浏览区是第一视觉层级，应占剩余宽度约 72%～78%。
- 详情区建议 `320–380px`，不随列表或画布一起滚动。
- 顶部两行工具栏保持紧凑；无意义的描述和重复页面标题不占用垂直空间。
- 搜索、筛选、模式和选择状态全部写入 URL，刷新与前进/后退可以恢复。
- 重置按钮清空搜索、筛选、排序、分页、跳转目标和当前选择，但不改变游戏版本。

### 5.1 筛选定义

武器类型：

- 表格模式允许“全部类型”。
- 派生模式一次只展示一个武器类型，避免把 12/14 棵大树堆在同一画布。
- 从“全部类型”切换到派生模式时显示类型选择面板，不擅自默认大剑。

属性：

- 全部、无属性、火、水、雷、冰、龙、毒、麻痹、睡眠、爆破。
- 一把武器有两个属性时，匹配任意一个即可进入结果。
- 3G/4G 提供“包含觉醒”和“仅显性属性”选项；默认包含但用锁形标识明确区分。GU/XX 没有该筛选，因为 `-1` 属性位会在构建时作为缺失哨兵删除。

其他筛选：

- 稀有度使用实际 facet。
- 孔位支持 0、1、2、3 及各作真实存在的值。
- “仅看可直接生产”使用 `is_directly_producible`，不按是否为根节点猜测。
- 调试开关只显示 DUMMY/未映射的普通武器记录；发掘武器始终排除。

### 5.2 排序定义

列表模式提供：

- 存档顺序（默认）。
- 名称。
- 稀有度。
- 攻击。
- 孔数。
- 斩味（按当前基础/匠口径）。
- 会心率。

每个排序都提供升序/降序按钮；攻击、会心率和孔数相同后使用稳定身份排序。表头可点击排序，但顶部排序器仍需保留，方便键盘操作和窄窗口使用。选择斩味排序时显示阶段选择器；未选择斩味排序时仍允许切换阶段，以便比较列表和详情中的匠延长。

派生模式的节点位置必须由拓扑决定，不能为了“攻击排序”打乱连线。切换到派生模式后保留排序参数但不应用到布局，并显示简短提示“派生图按强化路线排列”；切回列表后恢复之前的排序。

## 6. 列表模式详细设计

列表模式延续道具页“表格为主、详情为辅”的框架。选择“全部类型”时只显示可跨类型比较的公共列：

```text
图标/武器名 | 类型 | 稀有度 | 攻击 | 属性 | 会心 | 孔 | 生产
```

选择单一武器类型后，在公共列后加入对应专属列，不同时渲染所有专属列：

| 当前类型 | 追加/替换列 |
| --- | --- |
| 常规近战 | 斩味 |
| 狩猎笛 | 斩味、音色 |
| 铳枪 | 斩味、炮击 |
| 斩击斧、盾斧 | 斩味、瓶；两类使用各自列标题和枚举文案 |
| 操虫棍 | 斩味、猎虫类别 |
| 轻弩 | 装填、后坐力、偏移、速射摘要 |
| 重弩 | 装填、后坐力、偏移、蹲射/特殊弹摘要 |
| 弓 | 蓄力箭型摘要、曲射/刚射、瓶摘要 |

这样“全部类型”适合公共数值比较，单类型模式才展示有意义的专属信息；不让弩、弓出现斩味空条，也不让近战承担整张弹表的宽度。

- 武器名显示中文主名、英文副名；GU/XX 同时显示 `Lv.n`。
- 属性以类型小标和数值呈现，双属性并排；觉醒属性带锁形标和可读文字。
- 孔位使用一致的小圆孔/短横视觉，同时保留数值辅助文本。
- 斩味列使用紧凑 `WeaponSharpnessComparison`：3G/4G 同时显示 2 条，GU/XX 同时显示 3 条。表格不能因为当前排序口径只剩一条斩味。
- 可生产记录显示“生产”徽标，强化取得则不显示虚假横线或价格。
- 当前选中行使用金色边框/底色和 `aria-selected`，不能只改变文字颜色。
- 列表独立滚动，表头固定，分页沿用当前公共分页组件。
- 点击一行只更新右侧详情，不打开抽屉。

右侧详情先渲染公共 `WeaponCoreStats`，再由 `WeaponTypeDetail` 根据 Repository 返回的鉴别字段选择且只选择一个专属详情组件：

```text
WeaponTypeDetail
├── MeleeSharpnessDetail
├── HuntingHornDetail
├── GunlanceDetail
├── PhialWeaponDetail
├── InsectGlaiveDetail
├── BowgunDetail
│   └── BowgunAmmoTable
└── BowDetail
```

- 狩猎笛详情展示三音色，并将可演奏旋律按效果分组；持续时间有权威数据时一并展示。
- 铳枪详情展示炮击类型和等级，不能只给 `GLShotType_ID`。
- 斩击斧与盾斧可以复用瓶值组件，但外层标题、说明和枚举必须由武器类别决定。
- 操虫棍详情把 `ISKinsectType_ID` 映射成可读的切断/打击类别。
- 轻弩/重弩详情共享基础弩属性组件，弹表分别表达速射、蹲射、内藏弹等适用机制；弹表自身独立滚动并保留固定表头。
- 弓详情按蓄力等级显示箭型，明确标出由装填数技能解锁的 `[+]` 层级，再显示曲射/刚射与可用瓶。
- 不适用的模块不挂载、不占空间，也不以一串 `—` 作为“兼容”。

## 7. 图 2：派生画布的细致拆解与现代化映射

用户提供的图 2 是游戏内“武器派生图”，核心不是复制其贴图外观，而是保留它表达路线的方式。原图可拆为以下区域：

### 7.1 原图左侧：武器家族与分支入口

原图最左列是按家族排列的生产/派生入口，例如矿石系、骨系、怪物素材系。每一行不是普通表格记录，而是一条可能向右延伸、分叉或终止的强化路线。问号表示尚未解锁的信息；图鉴模式不模拟玩家解锁状态，因此已收录武器直接显示真实名称，来源未知的记录才显示“未映射”，不能人为加问号。

现代化处理：

- 每个独立家族占一条水平泳道，泳道之间留出明确间距。
- 左侧根部显示家族名称和直接生产标记。
- 一个家族存在多个可生产入口时都显示锻造徽标，不能强制只选第一个根。
- 画布纵向排列家族，横向表示强化深度。

### 7.2 原图中央：节点与直角连线

原图用小方格表示具体武器形态，用水平线、竖线和直角转折表达强化与分支。节点纵向错开后仍通过连线保持父子关系；选中节点有明显边框。红色感叹号是状态提示，不属于离线图鉴的固有数据。

现代化处理：

- 一个节点代表一个确定、可寻址的武器形态；GU/XX 的每个等级都是独立节点，但共享家族身份。
- 节点从左向右按强化深度排列，同深度分支上下展开。
- 连线使用直角折线，箭头指向子级。派生边由已确认的 `Child` 先序算法生成并使用实线；crosswalk 失败导致端点身份不完整时构建失败，不向正式画布输出猜测边。
- 节点至少显示：16×16 分类图标、中文名、等级/稀有度、属性标记和孔位。为控制节点高度，近战节点只放当前排序/比较口径的一条微型斩味，并提供“2阶段/3阶段”提示；节点选中后的固定详情仍显示完整多条比较。笛、铳枪、瓶武器、操虫棍追加一个紧凑专属标记；弩和弓分别使用弹种/射击摘要替代斩味。
- 可直接生产节点增加锻造图标和“可生产”文本；最终形态增加终点徽标。状态不能只靠边框颜色表达。
- 选中节点使用金色实边框和轻微外发光；完整祖先路线加粗为金色，直接子分支保持高对比，其余路线降低透明度但不消失。
- 多父级节点若在权威数据中存在，应作为有向无环图处理，不能为了画成树而复制成多个虚假武器实例。

### 7.3 原图中右：所选武器、素材和价格

原图在中央右侧显示所选武器的大图、生产素材、玩家持有数量和必要金额。这是“当前节点操作上下文”，会随节点选择变化。

现代化处理：

- 当前阶段是只读图鉴，不显示玩家持有数量，避免让未读档用户误以为已连接装备箱。
- 生产入口显示生产材料与生产价；普通强化形态显示强化材料与强化价；两种途径都存在时使用明确标签分成两组。
- 材料显示道具图标、名称、数量；点击在当前页打开道具详情抽屉。
- 抽屉内再点击关联对象时，关闭抽屉并跳转到对应图鉴，继续遵守一级抽屉限制。
- 大图只在 `ImgFile` 资源完成来源、映射和发布许可审计后显示；否则用放大的分类图标与名称占位，不拉伸 16×16 像素图冒充高清立绘。

### 7.4 原图最右：固定装备详情

原图最右栏始终显示攻击力、斩味、属性、会心、防御加成和孔位，不随左侧派生图一起滚动。这使用户在移动路线时仍能比较当前武器。

现代化处理：

- 复用列表模式相同的 `WeaponDetailPanel`，模式切换不改变字段解释。
- 顶部为名称、英文名、类型、等级、稀有度和稳定 ID。
- 核心属性卡显示攻击、属性、会心、防御和孔位。
- 近战显示宽版 `WeaponSharpnessComparison`：3G/4G 同时显示基础与匠+1，GU/XX 同时显示基础、匠+1、匠+2，并给出各阶段最高斩味摘要；远程武器在同一位置显示装填、反动、偏移及弹种摘要；弓显示蓄力与瓶。
- 下方是生产/强化材料、父级入口和子级入口。
- 点击父级/子级会选中对应节点并让画布平滑居中；开启减少动态效果时立即定位。

### 7.5 画布控制与导航

画布应表现为“现代派生工作区”，而不是一张放大的静态图片：

- 鼠标拖拽空白区域平移；节点本身仍是按钮，拖画布不能吞掉节点点击。
- 滚轮纵向移动，`Shift + 滚轮` 横向移动，`Ctrl + 滚轮` 缩放。
- 提供明确的 `+`、`−`、适应窗口、回到选中节点按钮和缩放百分比；所有手势都有按钮替代。
- 搜索命中后自动定位到第一个节点，多命中时提供“上一个/下一个命中”。
- 右下角提供小型总览图，标出当前视口和选中节点；树较小时自动隐藏。
- 记住每个“游戏 + 武器类型”的平移和缩放状态；离开页面后无需长期持久化。
- 节点使用 roving `tabIndex`，避免 Tab 键连续经过数百节点。方向键语义为：左到父级、右到首个子级、上/下到相邻分支；Enter/Space 选择。
- 焦点节点永远滚入可视区域，固定工具栏和右侧详情不能遮住焦点。
- `prefers-reduced-motion: reduce` 下关闭自动平滑定位、节点淡入和路线过渡。

### 7.6 画布筛选行为

表格可以直接移除不匹配行，派生图不能简单删除节点，否则路线会断裂、位置会突然跳动。

派生模式采用“命中 + 上下文”规则：

- 完全匹配筛选的节点保持完整对比度。
- 命中节点的全部祖先和必要连接节点保留中等对比度，标记为“路线节点”。
- 直接子级保留可见，便于继续查看下一步强化。
- 与命中无关的分支降低到低对比度但仍可点击。
- 顶部显示“命中 n 个；另保留 m 个路线节点”，避免结果数量含义不清。
- “仅看可直接生产”高亮所有可生产入口及其直系路线，不把中间强化节点伪装成筛选命中。

## 8. 画布技术方案

“画布模式”指无限工作区交互，不强制使用原生 `<canvas>`。首选：

- 使用 `@xyflow/react` 管理平移、缩放、视口、节点和连线。
- 使用自定义 `WeaponTreeNode` 和 `WeaponTreeEdge` 保持棕金主题与真实按钮语义。
- 采用确定性分层布局；可使用 ELK/Dagre，但最终节点坐标必须可重复，不能每次打开随机漂移。
- 节点使用 DOM，连线使用 SVG，以保留文字清晰度、tooltip、键盘焦点和无障碍名称。
- 每次只加载一个游戏的一种武器类型；超过可视范围的详情资源延迟加载。

如果引入图布局库后体积或 800～1,000 节点场景性能不能达标，再实现基于已审计分支顺序的专用分层布局。不要在没有 Profiler 数据前同时维护两套画布实现。

布局规则：

1. 对已审计有向图做环检测。
2. 根/生产入口位于最左列，最长父路径决定深度。
3. 保留 Dex/审计来源中的分支顺序作为稳定纵向次序。
4. 子树从上到下占用连续空间，减少交叉线。
5. 多父节点使用共享节点与汇入边，不复制 identity。
6. 计算结果以 `gameId + typeId + dataVersion` 缓存，筛选只改变视觉状态，不重新布局。

## 9. API、IPC 与 URL

### 9.1 类型

```ts
type WeaponViewMode = 'list' | 'tree'
type WeaponSort = 'saveId' | 'name' | 'rarity' | 'attack' | 'slots' | 'sharpness' | 'affinity'
type SortDirection = 'asc' | 'desc'
type SharpnessStage = 'base' | 'handicraft1' | 'handicraft2'

type WeaponCatalogFilters = {
  gameId: GameId
  query?: string
  weaponTypeId?: number
  attributeId?: number | 'none'
  includeHiddenAttributes?: boolean
  rarity?: number
  slots?: number
  directlyProducible?: boolean
  includePlaceholders?: boolean
  sort?: WeaponSort
  direction?: SortDirection
  sharpnessStage?: SharpnessStage
  page?: number
  pageSize?: number
}
```

返回类型至少包含：

- `WeaponTypeDefinition`
- `WeaponSummary`
- `WeaponDetail`
- `WeaponAttribute`
- `WeaponSharpnessProfile`
- `WeaponMaterial`
- `WeaponTreeNode`
- `WeaponTreeEdge`
- `WeaponCatalogFacets`

`WeaponDetail` 必须是鉴别联合类型，不能返回 `specials: Record<string, string | number>` 让 React 猜字段：

```ts
type WeaponDetail = WeaponBaseDetail & (
  | { kind: 'standardMelee'; sharpness: WeaponSharpnessProfile }
  | {
      kind: 'huntingHorn'
      sharpness: WeaponSharpnessProfile
      notes: HuntingHornNote[]
      songs: HuntingHornSong[]
    }
  | { kind: 'gunlance'; sharpness: WeaponSharpnessProfile; shelling: GunlanceShelling }
  | {
      kind: 'phialWeapon'
      weaponKind: 'switchAxe' | 'chargeBlade'
      sharpness: WeaponSharpnessProfile
      phial: WeaponPhial
    }
  | { kind: 'insectGlaive'; sharpness: WeaponSharpnessProfile; kinsectType: KinsectType }
  | {
      kind: 'bowgun'
      weaponKind: 'light' | 'heavy'
      sharpness: null
      gun: BowgunStats
      ammo: BowgunAmmoRow[]
    }
  | { kind: 'bow'; sharpness: null; bow: BowStats; charges: BowCharge[]; coatings: BowCoating[] }
)
```

鉴别值由 `Wpn_Type_ID` 和游戏类型表生成。IPC 的输出 schema 同样校验该联合：只有轻弩、重弩、弓的 `sharpness` 为 `null`，其余分支都必须携带 `WeaponSharpnessProfile`；常规近战也不可能意外携带弹表。

### 9.2 Repository

```ts
searchWeapons(filters): PageResult<WeaponSummary>
getWeapon(identity): WeaponDetail | null
getWeaponFacets(gameId): WeaponCatalogFacets
getWeaponTree(gameId, weaponTypeId): WeaponTreeResult
```

- 搜索匹配中英日名称、十进制 ID、十六进制 ID、家族名和等级形态名。
- 所有排序在 SQL/Repository 层完成，React 不对单页结果二次排序。
- `getWeaponTree` 只接受单一武器类型，返回该类型完整拓扑及构建规则版本和不变量校验状态。
- 主进程只读打开 SQLite；IPC 参数通过 Zod 校验；renderer 不接触数据库路径。
- 详情与树请求按 `gameId + weaponKey + dataVersion` 缓存，并能忽略过期请求。

### 9.3 URL 状态

```text
q
type
attribute
hidden
rarity
slots
producible
sort
direction
sharpness
page
view=list|tree
weapon=<weaponKey>
debug
```

从材料/其他图鉴跳转到武器时使用 `target=<weaponKey>` 精确定位；重置必须同时删除 `target`。模式切换保留 `weapon`，同一武器在另一模式中仍保持选中并定位。

## 10. React 组件拆分

所有页面和组件继续使用独立 `.tsx` 与 `.css`：

```text
ui/pages/WeaponCatalogPage/
ui/components/WeaponCatalogToolbar/
ui/components/WeaponFilterBar/
ui/components/WeaponViewToggle/
ui/components/WeaponList/
ui/components/WeaponListRow/
ui/components/WeaponListColumns/
ui/components/WeaponSharpnessComparison/
ui/components/WeaponSharpnessBar/
ui/components/WeaponDetailPanel/
ui/components/WeaponCoreStats/
ui/components/WeaponTypeDetail/
ui/components/MeleeSharpnessDetail/
ui/components/HuntingHornDetail/
ui/components/GunlanceDetail/
ui/components/PhialWeaponDetail/
ui/components/InsectGlaiveDetail/
ui/components/BowgunDetail/
ui/components/BowgunAmmoTable/
ui/components/BowDetail/
ui/components/WeaponAttributeList/
ui/components/WeaponMaterialList/
ui/components/WeaponTreeCanvas/
ui/components/WeaponTreeNode/
ui/components/WeaponTreeControls/
ui/components/WeaponTreeMinimap/
ui/components/WeaponTreeMatchNavigator/
ui/components/WeaponDetailDrawer/
```

页面 CSS 只定义工具栏、主区和详情区摆放，以及传入组件的公开尺寸变量。画布拖拽、节点尺寸、边样式、斩味比例、滚动条和状态样式分别放在所属组件 CSS 中。

每个上述组件均建立独立 `.tsx` 与 `.css`。`WeaponListColumns` 只根据已选类型返回稳定的列定义；列定义在模块级声明或按类型缓存，不能在每行渲染时创建新数组。`WeaponTypeDetail` 只负责鉴别联合分发，专属表单的布局、滚动和状态完全由各自组件负责。

建议变量：

```css
--weapon-catalog-page-detail-width
--weapon-catalog-page-toolbar-gap
--weapon-list-component-row-height
--weapon-tree-canvas-component-node-gap-x
--weapon-tree-canvas-component-node-gap-y
--weapon-tree-node-component-width
--weapon-tree-node-component-min-height
--weapon-detail-panel-component-padding
```

## 11. 数据构建流程

新增：

```text
tools/build_weapon_catalog.mjs
pnpm data:build:weapons
```

构建顺序：

1. 读取各作权威存档武器数组/家族表，生成可写 identity。
2. 通过类型、名称、等级、已验证 ID 表建立 Dex crosswalk。
3. 排除 MH4G 发掘记录，再导入普通武器的公共属性、价格和原始斩味；按 `Wpn_Type_ID` 写入强类型专属表，禁止把不适用字段带给其他武器类型。
4. 按已确认的十进制两位分段及末端扣 5/10 算法生成基础 cutoff、匠+1 cutoff 和适用时的匠+2 cutoff，保留 raw 值及推导证据；弓的 `SharpP1` 单独写为 `load_up_charge_level`。
5. 通过 `DB_ItmtoWpn` 关联生产/强化材料到 `catalog_items.save_id`。
6. 按 `Child` 直接子节点数和先序栈算法生成派生边，并进行数量等式、栈闭合、环、断边和跨类型检查。
7. 映射分类图标；正式记录缺图时构建失败。
8. 生成三作 manifest、crosswalk 报告、派生边审计和异常报告。
9. 连续构建两次，验证 SQLite 内容摘要和 manifest 确定一致。

构建报告至少记录：

- 输入文件 SHA-256。
- 各武器类型的 identity、Dex 映射、占位、直接生产和最终形态数量。
- GU/XX 家族各等级映射覆盖率。
- 普通武器收录数量，以及被排除且绝不写入 catalog 的 MH4G 发掘记录数量。
- 七色斩味、基础 cutoff、匠+1 cutoff、匠+2 cutoff 的逐项成功/失败数量。
- 各武器类型专属记录数量、必填字段缺失数和错误跨类型字段数。
- 生产材料、强化材料和无效道具外键数量。
- 根、边、分支、终点、孤立节点和环数量。
- 图标与可选大图覆盖率。

## 12. 测试计划

### 12.1 数据构建

- 三套库连续构建两次结果一致。
- 所有正式武器都有稳定 identity、类型、名称和图标。
- MH3G/4G `save_type + save_id` 唯一；GU/XX `save_type + save_id + save_level` 唯一。
- GU/XX 每个家族等级不超出存档允许范围，显示等级和存档等级换算有固定样本。
- 两组属性、负值/觉醒值、无属性均有固定样本校验。
- 3G/4G 负属性取绝对值并标记觉醒；GU/XX 的 `-1` 属性位被删除，不产生数值为 1 的伪觉醒属性。
- 七色斩味逐段与 Dex 原值抽样比对；3G/4G 扣 5、GU/XX 扣 5/10 的跨颜色传播有固定样本；轻弩、重弩、弓不生成伪斩味，弓 `SharpP1` 正确映射装填数追加层级。
- 每条正式近战武器记录恰好关联一条斩味记录，包括狩猎笛、铳枪、斩击斧、盾斧和操虫棍；只有三类远程武器的斩味记录数必须为 0。
- 类型 6/8/9/10/11/12/13/14 按各作矩阵写入正确专属表；每类必填关系存在，不适用类型没有脏记录。
- 狩猎笛旋律、铳枪炮击、斩斧/盾斧瓶、操虫棍猎虫、轻重弩弹表和弓蓄力分别与 Dex 固定样本逐字段比对。
- 生产和强化材料的类型、数量、价格与 Dex 抽样逐字段比对。
- 三作派生节点、边、根数量分别锁定为 `1421/1238/183`、`2331/1930/401`、`10911/10117/794`；每类型栈闭合，每条边同游戏、同类型、无自环，整图无环。
- MH4G 发掘记录不出现在 `catalog_weapons`、材料、派生边或任何 facets 中。

### 12.2 Repository 与 IPC

- 12/14 类武器 facets 正确。
- 中文、英文、日文、十进制 ID、十六进制 ID 和 GU 等级形态搜索。
- 单属性、双属性、无属性、觉醒属性筛选。
- 稀有度、攻击、孔数、基础/匠各口径斩味、会心率升降序和稳定兜底。
- 可直接生产筛选不等同于根节点筛选。
- `WeaponDetail` 的鉴别联合严格匹配当前类型；非法组合（例如弓带斩味、常规近战带弹表、盾斧套用斩斧类别）被输出校验拒绝。
- 占位开关不可能带出 MH4G 发掘记录。
- 非法 game、type、weaponKey、排序和分页参数被 Zod 拒绝。
- 数据库缺失/损坏、派生图不变量校验失败和材料外键缺失返回可理解错误。

### 12.3 UI 列表模式

- 三个游戏均能打开武器页并显示正确类型。
- “全部类型”只显示公共列；选择单一类型后显示且只显示该类型专属列，不通过大量空列兼容。
- 狩猎笛、铳枪、斩斧、盾斧、操虫棍、轻弩、重弩和弓分别渲染对应专属详情组件与可读名称，不泄漏 Dex 数字 ID；前五类专属详情必须同时显示斩味和匠阶段。
- 轻重弩弹表内部滚动、表头固定；弓的装填数追加蓄力层级和普通蓄力在视觉与文本上都可区分。
- 列表表头、顶部排序、升降序结果一致。
- 七段斩味比例、阶段标签、tooltip 和文本替代正确；3G/4G 每行同时可见 2 条，GU/XX 每行同时可见 3 条。
- 3G/4G 的基础/匠+1以及 GU/XX 的基础/匠+1/匠+2切换只改变排序口径和强调态，不隐藏其他阶段斩味条。
- 列表内部滚动，页面整体不滚动；右侧详情独立滚动。
- 重置清除从其他页面跳转带来的精确筛选。
- URL 刷新、前进和后退恢复筛选、分页与选择。
- 材料点击打开道具抽屉，抽屉内点击不产生第二层抽屉。

### 12.4 UI 派生模式

- 从列表切换派生图时保留选中武器并居中。
- 祖先路线、直接子分支和无关分支层级清楚，且不只靠颜色表达。
- 拖拽、滚轮、Ctrl 缩放、Shift 横移、控制按钮、适应窗口和回到选择均可用。
- 搜索多个命中时可前后定位。
- 方向键按父子/相邻分支移动，Enter/Space 选择，Tab 不遍历全部节点。
- 筛选只改变命中与上下文层级，不破坏拓扑或触发重新布局。
- 画布 resize 后不覆盖固定详情，焦点节点不会被工具栏遮挡。
- `prefers-reduced-motion` 下立即定位且无路径/节点动画。
- 1024、1280、1440、1920 宽度下无页面级横向溢出。

### 12.5 性能验收

- 以 MHGU/XX 最大单武器类型作为压力样本。
- 首次布局、选择节点、筛选高亮和缩放分别用 React Profiler 实测，不凭感觉预优化。
- 选择节点不能导致整棵树所有节点无条件重渲染。
- 平移缩放过程中详情请求不重复触发。
- 页面路由采用按功能拆包，派生图库不进入首页初始 bundle。

## 13. 分阶段实施顺序

1. **规则固化**：把已经确认的身份、类型矩阵、觉醒、斩味扣减和 `Child` 先序算法写成固定样本与结构不变量测试。
2. **统一构建器**：生成三库公共表、强类型专属表、manifest 与审计报告。
3. **Repository/IPC**：完成列表查询、稳定排序和 `WeaponDetail` 鉴别联合输出。
4. **列表与专项详情**：首版同时交付公共列、类型专属列、斩味条、各类型详情表单与材料抽屉，专项信息不留到后补。
5. **派生图数据**：完成每作父子边样本对照和图完整性门槛。
6. **派生画布**：实现布局、类型化节点摘要、连线、筛选上下文和导航。
7. **完整验收**：三作数据、交互、性能、打包资产和无障碍测试。

## 14. 完成定义

- 用户能在三作中按类型、属性、稀有度、孔位和可生产状态找到武器。
- 用户能按稀有度、攻击、孔数、基础/匠各阶段斩味和会心率稳定排序，并理解斩味排序规则。
- 所有近战斩味均以可靠的七色比例条显示，基础、匠+1及适用时的匠+2边界完整可见；扣减算法、结构不变量或固定样本失败时该游戏不能验收。
- “全部类型”保持紧凑公共列；每个单一武器类型都有与 Dex 字段一致的专属列和详情表单。所有近战都显示斩味及匠阶段，只有轻弩、重弩、弓不显示斩味或无意义空字段。
- MH4G 发掘武器完全不出现在表格、派生图、搜索结果、facets 或调试模式中。
- 列表适合快速比较，派生画布适合理解路线，两种模式共享 URL、选择和详情。
- 图 2 的核心语义——家族泳道、强化深度、分支连线、节点选择、素材上下文和固定详情——全部保留，并转换为适合桌面端的现代棕金界面。
- 所有派生边都能回溯到 `Child` 先序来源并满足节点/边/根数量不变量；任何 crosswalk 失败都阻止正式派生图生成，不显示猜测路线。
- `pnpm typecheck`、`pnpm test`、`pnpm build`、数据确定性构建和 `git diff --check` 全部通过。
