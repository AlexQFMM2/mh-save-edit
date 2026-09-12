# 阶段 1：图鉴数据与图标资产

当前状态：阶段完成（2026-09-11）。三作资料域已完成离线数据、构建审计、Repository/IPC、页面、图标和一级关联闭环；后续只进行缺陷修复与非阻塞证据维护，不再阻挡存档修改主线。

## 1. 范围

第一阶段从基础五类图鉴起步，并已扩展为完整离线资料域：

- 武器
- 防具
- 道具
- 护石
- 装饰珠
- 技能、怪物、任务、狩技与武器动作值
- MHGU/XX 支援倾向、支援行动、随从技能和猫装备

配装所需的技能树、发动技能、装备技能点、装饰珠技能点、孔位、职业/性别限制和武器等级也属于
本阶段的基础数据，但不要求先做复杂 UI。

## 2. 数据库边界

保留三套只读内容库：

```text
data/mh3g.sqlite   # MH3G/MH3U 内容
data/mh4g.sqlite   # MH4G 内容
data/mhgu.sqlite   # MHGU/MHXX 共用内容，按语言/平台 profile 取名
```

上述路径是本地运行挂载位置，不是公开仓库产物目录。SQLite、生成 manifest、
crosswalk、审计报告和导出图标统一归档到 `research/generated/mh-save-edit/catalog/`，
按需注入上述已忽略路径，不得被 Git 跟踪或上传公开 Action artifact。

MHGU 与 MHXX 的存档 adapter 分开，内容库可以共用。若后续确认两平台确实存在实体差异，再在同库
增加 `content_profile`，不要先复制两套会漂移的 SQLite。

Drizzle 用于 TypeScript schema、查询和只读 repository；确定性数据构建脚本放在 `api/db/build/`，
由脚本读取审计过的 CSV/JSON/Dex 导出并生成 SQLite。Drizzle 不是 Dex 自动转换器，ID crosswalk、
来源校验和图标映射仍必须在构建器中明确实现。

每个数据库必须带：

- `schema_version`
- `data_version`
- 来源文件 SHA-256
- 构建工具版本和时间
- 每张表的行数与内容摘要
- 使用的语言和内容 profile

## 3. ID 规则

- 图鉴/内容模板 ID：描述“这是什么”，来自 Dex 或统一内容库；例如 `Jew_ID`、`Itm_ID`、武器/防具模板 ID。
- 原生资源模板 ID：游戏解包资源中的模板身份，例如武器、防具、装饰珠和猎猫数据表使用的原生 ID。
- `save_id`：某一存档格式写入记录时使用的类型编码；它不是具体实例 ID，必须通过显式 crosswalk 关联到内容模板。
- `item_save_id`：道具箱使用的存档类型编码，与装备记录中的 `save_id` 可以不同。
- 实例/位置：具体存档对象及其位置，例如装备箱格子、某件装备的第几个装饰槽或道具箱格子和数量；实例保存完整记录、等级、技能点、原始字节等状态。
- `dex_id`：Dex 数据行 ID，只用于来源追踪和关系导入，不能直接当作存档编码。
- `resource_key`：Dex 内嵌图片键，只用于图标表。
- 同名条目不得自动视为同一 ID。
- 任何跨域关系必须记录为 `内容模板 ↔ 原生模板 ↔ 装备存档编码 ↔ 道具箱存档编码` 的显式 crosswalk；禁止按数字相等、行号或名称相似度推断。
- MHGU 的升级武器必须同时表达武器 ID 和显示/保存等级。
- 发掘装备、DUMMY、保留值和占位条目保留明确状态，不从库中静默删除。

以 MH3G 强瓶珠【２】为例：

```text
装饰珠模板 Jew_ID 160
  → 道具模板 Itm_ID 1249
  → 装备记录 save_id 173
  → 道具箱 item_save_id 1489
  → 实例位置：某件装备的某个装饰槽 / 道具箱某格及数量
```

`save_id=173` 不是一颗独立珠子的实例身份，而是该版本在装备记录中表示此模板的编码。实例必须
另外携带所属记录和槽位；修改器写入时使用编码，图鉴展示和技能/材料关联使用模板身份。

## 4. 图标审计结论

已确认可直接利用的数字图标数量：

| 游戏 | `Wpn_*` | `Amr_*` | 数字 `Itm_*` |
| --- | ---: | ---: | ---: |
| MH3G | 120 | 60 | 1331 |
| MH4G | 160 | 80 | 1913 |
| MHXX/GU | 198 | 88 | 2921 |

映射规则：

```text
猎人武器        Wpn_<两位武器类型><两位稀有度>
猎人防具        Amr_<两位防具部位><两位稀有度>
随从武器        Wpn_<Part 21/22><两位稀有度>
随从防具        Amr_<Part 11/12><两位稀有度>
MHXX 猎虫       Wpn_<Type 31/32><两位稀有度>
普通道具        Itm_<四位 Itm_ID>
装饰珠          DB_Jew.Itm_ID → Itm_<四位 Itm_ID>
已装备护石      Amr_06<两位显示稀有度>
未鉴定护石道具  对应版本的 Itm_<ID>
```

三个 Dex 的全部武器、防具、随从装备和猎虫记录已经用上述公式验证为 0 缺失。三个版本全部
`DB_Jew` 记录也都能通过 `Itm_ID` 找到 `Itm_*`。

MHGU/XX 猎猫图鉴已进一步验证 508 件猫武器和 1024 件猫防具均能映射到上述 44 个随从装备
分类图标，覆盖率为 100%。图标只作为已忽略的本地运行资产注入，公开仓库不跟踪导出 PNG。

`WpnImg_*`、`AmrImg_*`、`two130` 等 `ImgFile` 字段不是列表使用的 16×16 分类图标键，不能直接
当作 `icons.resource_key`。

护石必须区分两种语义：

- `Amr_06xx` 是生成并装备后的护石图标。
- `Itm_*` 袋子是任务奖励中尚未鉴定的 Charm 道具图标。

MH4G 有 14 种护石等级但只有 R1～R10 图标，数据库需保存显式 `display_rarity`：

```text
1→1, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7,
8→8, 9→9, 10→8, 11→9, 12→10, 13→10, 14→10
```

## 5. 图标表设计

逻辑图标和物理图片分层，允许内容 hash 去重，同时保留游戏隔离：

```sql
CREATE TABLE icon_files (
  id INTEGER PRIMARY KEY,
  content_hash TEXT NOT NULL UNIQUE,
  file_path TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  format TEXT NOT NULL
);

CREATE TABLE icons (
  id INTEGER PRIMARY KEY,
  game TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  category TEXT NOT NULL,
  file_id INTEGER NOT NULL REFERENCES icon_files(id),
  source TEXT NOT NULL,
  UNIQUE(game, resource_key)
);
```

业务引用：

```text
weapons.icon_id
armors.icon_id
items.icon_id
talisman_grades.icon_id
palico_weapons.icon_id
palico_armors.icon_id
kinsects.icon_id
```

装饰珠保留 `decorations.item_id → items.icon_id`，不重复保存一个容易漂移的装饰珠图标外键。

相同 `resource_key` 在不同游戏中不能合并。现有 hash 审计表明同名图片并不总相同；物理文件只在
内容 hash 完全一致时去重。

## 6. 资源生成和运行时使用

- 构建器从 `.resources` 只读导出 PNG，统一保留 16×16 逻辑画布和原始像素。
- 不做插值放大；UI 使用固定画布和 `image-rendering: pixelated` 或等价策略。
- MH4G 少量图片高度为 13～15px，居中放置，不拉伸到 16px。
- 输出路径由 hash 或稳定资源键生成，禁止依赖机器绝对路径。
- Electron 打包前验证 SQLite 中所有 `icon_id` 都有实际文件。
- 列表缺图时显示统一 fallback，并记录数据错误；不能静默显示另一游戏的同名图标。

## 7. 数据迁移来源

优先复用旧项目已经审计的数据生成成果：

```text
mh3u-se/data/mh3g.sqlite
mh4g-se/data/mh4g.sqlite
mhgu-xx-se/data/mhgu.sqlite
```

同时迁移对应构建器、crosswalk、manifest 和验证断言。不能只复制最终 SQLite 而丢掉可重建流程。
Dex 主键只能补充属性与关系，存档 ID 仍由游戏资源数组和已验证 crosswalk 决定。

## 8. 基础图鉴 API

统一 repository 至少提供：

```text
searchWeapons(filters, page)
getWeapon(identity)
searchArmors(filters, page)
getArmor(identity)
searchItems(filters, page)
getItem(identity)
listTalismanGrades()
searchDecorations(filters, page)
getSkillTree(identity)
```

返回值包含稳定实体 identity、展示名称、关键属性、来源状态和图标引用。UI 不接触 SQL 表名，也不
自行推导图标键。

## 9. 最小图鉴页面

阶段 1 只实现：分类切换、文本搜索、必要筛选、分页/虚拟列表、图标、详情字段和错误状态。未读取
存档时也能浏览。复杂派生树、套装矩阵和视觉动效留到阶段 4。

## 10. 验收门槛

- 三个 SQLite 均能由固定输入重复构建，hash 和行数可解释。
- 每个正式武器、防具、道具、护石等级和装饰珠都有稳定 ID 与名称。
- 所有正式实体的图标外键非空且文件存在。
- 装饰珠图标始终来自其道具引用。
- 已装备护石与未鉴定护石不会使用错误图标组。
- 图鉴查询在没有打开存档和没有网络时正常工作。
- 数据修订会改变 `data_version`，旧配装不会被静默按新数据解释。

## 11. 研究资料整理记录

2026-09-06 已完成以下整理：

- 工作区根目录的 MH4G `a.resources`～`z.resources` 和
  `MH4G_Dex.Resource Image.resources` 已移到 `research/mh4g/dex/resources/`。
- `mh4g_scan_arc.py` 已移到 `research/mh4g/tools/`。
- 已停止的旧 `SaveEditor-Encyclopedia-Plan.md` 已移到 `research/archive/plans/`。
- 旧修改器仓库中的正式 `resources/` 未移动，以免破坏它们现有构建。

这些研究输入不直接进入公开 release。正式分发图标前必须确认素材许可和发布策略；技术可导出不
等于拥有公开再分发授权。
