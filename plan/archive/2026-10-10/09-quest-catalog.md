# 三作任务图鉴

Status: 已归档
归档日期：2026-10-10
责任归属：项目维护者；后续由社区按需参考

归档结论：任务图鉴首版与关联搜索完成，后续资料扩充停止排期。

保留边界：3G/4G 特殊解锁关系的未确认来源保持原状，不升级为已验证。

复核依据：原文实施记录及 [Repository](../../../tests/questCatalogRepository.test.ts)、[UI](../../../tests/questCatalogUi.test.tsx) 回归。

> 用户于 2026-10-10 决定将全部旧计划归档，未做的后续工作不再继续排期。以下为历史方案与原始勾选记录；未实施或未验收项保持原状，不记作完成。当前维护方向见[归档索引](../../README.md)与[项目 README](../../../README.md)，发布边界以[现行约定](../../../AGENTS.md)为准。代码、研究路径和命令按项目根目录或原说明解释。

## 归档前记录

## 当前范围与实现状态

任务图鉴第一版已于 2026-09-08 实现。统一构建器、审计、Repository、IPC 和 React 页面现已覆盖
MH3G、MH4G、MHGU/XX，并权威展示：

- 所属任务体系、具体星级以及下位/上位/G 位。
- 任务类型、主目标、副目标和任务中出现的怪物。
- 契约金、报酬金、时间、HRP 和道具奖励。
- 普通、关键、紧急任务筛选。
- 完成任务后的特殊解锁奖励，例如装备制作方法、食材和狩技。
- 任务或 NPC 委托的前置关系。

任务道具奖励只放在详情中，不占用高密度任务列表空间。当前统一任务数为 MH3G 364、MH4G 572、
MHGU/XX 1,356（1,307 条共通 Dex 任务与 49 条 MHGU 独占原生任务）。

## Dex 已确认数据（2026-09-08）

三套 Dex 固定快照均包含：

- `DB_Qst`：位阶、关键类型、任务类型、地图、最多 8 个怪物槽、契约金、报酬金、时间和 HRP。
- `DB_ItmtoQst`：任务道具奖励、数量、概率、奖励组和地区版本。
- `ID_Qst_Key`、`ID_Qst_Lv`、`ID_Qst_Type`、`ID_Qst_Name`、`ID_Qst_Goal`。
- MH4G、MHGU/XX 另有 `ID_Qst_Goal2`。

MH3G 没有副目标是该作的游戏规则，不是 Dex 漏表。任务图鉴在 MH3G 中应隐藏副目标字段，
不得伪造“无”记录；MH4G 与 MHGU/XX 可以展示权威副目标。

当前统计：

| 内容库 | 任务 | 关键 | 紧急 | 普通 | 有副目标 | 奖励关系 | 奖励覆盖任务 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| MH3G | 364 | 65 | 22 | 277 | 不适用 | 6,560 | 364/364 |
| MH4G | 572 | 93 | 45 | 434 | 432 | 13,012 | 568/572 |
| MHGU/XX | 1,307 | 116 | 24 | 1,167 | 839 | 37,569 | 1,307/1,307 |

`ID_Qst_Key` 的已确认语义为：`-1 = 普通`、`1 = 关键`、`2 = 紧急`，因此关键和紧急任务
可以使用独立筛选，不需要根据攻略人工猜测。

`ID_Qst_Lv` 已能区分村/旅团、港/集会所、特殊许可、DLC、具体星级和下位/上位/G 位。
`ID_Qst_Type` 已能区分采集、讨伐、狩猎、捕获、特殊，以及各作存在的训练或连续狩猎等类型。

任务怪物目前只能权威表达“在任务中出现”。`Mon1_ID ... Mon8_ID` 的槽位顺序不能直接解释成
主目标、次目标或乱入；目标角色继续以 `ID_Qst_Goal` / `ID_Qst_Goal2` 文本为准。

## 普通道具奖励

`DB_ItmtoQst` 字段为 `Qst_ID, Itm_ID, Qty, Pct, Type, Region`：

- MH3G 使用奖励组 A/B；MH4G 使用 A/B/C；MHGU/XX 使用 A/B/C/D。
- 3G/4G 的 `Region=E/J/K/A` 必须作为来源地区保留。
- 奖励组字母的完整游戏语义尚未闭合。第一版可以显示“奖励组 A”等权威原值，不能未经证据
  改名为“主报酬”“追加报酬”。
- 概率和数量可直接展示，道具通过现有 `catalog_items` crosswalk 关联。

MH4G 没有 `DB_ItmtoQst` 关系的 4 条任务已经核对为合法特殊剧情/探索任务，不是导出缺失：

| Dex ID | 名称 | 类型 | 目标 |
| ---: | --- | --- | --- |
| 26 | 调查指令：蓝速龙王 | 特殊 | 到达篷车 |
| 27 | 调查指令：大怪鸟 | 特殊 | 到达篷车 |
| 47 | ？？？ | 特殊/紧急 | 击退？？？ |
| 59 | 黑蚀龙紧急探索指令 | 特殊 | 击退黑蚀龙 |

这些任务详情应显示清晰的“没有普通道具奖励”，不能作为构建失败条件。

## GU/XX 特殊完成奖励

原生资源已经确认：

```text
research/mhgu/romfs/mhgu-table/activityData.atd
research/mhgu/romfs/mhxx-table/activityData.atd
research/mhgu/romfs/mhxx-table/activityData_jpn.gmd
D:\MH\unpack\mhgu\romfs\nativeNX\chS\table\activityData_chS.gmd
```

GU 与 XX 的 `activityData.atd` SHA-256 相同。二进制结构为 8 字节头、184 条、每条 55 字节；
本地化 GMD 在 `Data` 后为每条委托提供“委托名称 + 最多四项特殊奖励”五个字符串。

184 条委托中：

- 167 条带原生任务号，已经全部通过原生 ARC 文件名 crosswalk 映射到 Dex 任务，未知为 0。
- 17 条没有任务号，属于素材交付或其他非任务委托，不能伪装成任务。
- 特殊奖励文本包含装备/猫装备制作方法、食材、票券、噗吱猪服装、房间服务、任务解锁、
  村贡献度和狩技等内容。
- `activityData` 的原生任务号不能直接当 Dex `Qst_ID`。例如 `208 -> q0000208.arc -> Dex Qst_ID=15`。

已确认 7 条狩技奖励任务：

| 委托 | 原生任务 | Dex ID | 可确认奖励文字 |
| --- | --- | ---: | --- |
| 狩猎船团·红枪的委托2 | `q0011210` | 757 | 重弩炮、太刀狩技 |
| 丹治亚铜锣手的委托2 | `q0011213` | 772 | 大锤、狩猎笛狩技 |
| 魁首长枪手的委托1 | `q0011239` | 781 | 长枪、铳枪狩技 |
| 休息中猎人的委托 | `q0011207` | 764 | 轻弩炮、弓狩技 |
| 魁首队长的委托3 | `q0011216` | 758 | 单手剑、双剑狩技 |
| 魁首新人的委托2 | `q0011211` | 754 | 斩击斧、盾斧狩技 |
| 地狱兄弟·红鬼的委托3 | `q0011214` | 783 | 大剑、操虫棍狩技 |

`hunterArtsData.hta` 与本地化 GMD 已确认包含 191 条具体狩技名称和说明。仅靠当前 RomFS 表尚未找到
“委托解锁标志 -> 具体 Hunter Art ID”的直接映射；后续 Fandom 多页面交叉验证已经补齐 7 个委托的
14 个具体狩技，详见下文。

## 前置关系探测

GU/XX 的 NPC 脚本主要位于：

```text
D:\MH\unpack\mhgu\romfs\nativeNX\table\npc\script\npc_*_is.nis
D:\MH\unpack\mhgu\romfs\nativeNX\table\npc\script\npc_*_td.ntd
```

文件结构已确认：

- `.nis`：8 字节头，随后为 `count × 20` 字节记录。
- `.ntd`：8 字节头，随后为 `count × 37` 字节记录。
- `.ntd` 中可以直接命中 `activityData` 使用的原生任务号以及委托状态标志。
- 同一 NPC 的对话记录中能观察到任务领取、完成和奖励状态切换痕迹。

当前仍未闭合 NIS/NTD 条件与动作操作码。任务开放条件可能同时包含：

- 另一个任务或委托的完成状态。
- 村贡献度、HR 或具体星级进度。
- 素材交付和 NPC 对话阶段。
- 多条件 AND/OR 组合。

因此不能仅按“同一委托人 + 委托名称中的 1/2/3”生成线性前置任务。3G/4G 的 RomFS 中也暂未发现
与 GU `activityData` 同等级的独立特殊奖励或完整前置表；其关系可能位于任务包、村庄事件脚本或
可执行逻辑中。

## Fandom Wiki 交叉验证（2026-09-08）

用户指定的 [Monster Hunter Generations Ultimate](https://monsterhunter.fandom.com/wiki/Monster_Hunter_Generations_Ultimate)
普通网页受 Cloudflare 保护，但站点公开 MediaWiki API 可读取带 revision 的原始 Wikitext。总览页本身不承载
任务关系，实际可用来源是以下专项页面：

| 页面 | page ID | revision | revision 时间 |
| --- | ---: | ---: | --- |
| [MHGU: Hunter Arts](https://monsterhunter.fandom.com/wiki/MHGU:_Hunter_Arts) | 311389 | 917516 | 2025-08-24 |
| [MHGU: Villager Requests](https://monsterhunter.fandom.com/wiki/MHGU:_Villager_Requests) | 357825 | 890905 | 2022-11-07 |
| [MHGU: Village Quests](https://monsterhunter.fandom.com/wiki/MHGU:_Village_Quests) | 310346 | 896922 | 2023-07-14 |
| [MHGU: Hunters Hub Quests/Low-rank](https://monsterhunter.fandom.com/wiki/MHGU:_Hunters_Hub_Quests/Low-rank) | 323910 | 848136 | 2020-11-23 |
| [MHGU: Hunters Hub Quests/High-rank](https://monsterhunter.fandom.com/wiki/MHGU:_Hunters_Hub_Quests/High-rank) | 323911 | 856112 | 2021-02-01 |
| [MHGU: Hunters Hub Quests/G-rank](https://monsterhunter.fandom.com/wiki/MHGU:_Hunters_Hub_Quests/G-rank) | 323912 | 884067 | 2022-03-24 |
| [MHGU: Special Permit Quests](https://monsterhunter.fandom.com/wiki/MHGU:_Special_Permit_Quests) | 315530 | 879101 | 2021-10-19 |
| [MHGen: Special Permit Quests](https://monsterhunter.fandom.com/wiki/MHGen:_Special_Permit_Quests) | 295808 | 721306 | 2016-08-07 |

Wiki 的任务模板包含英文/日文任务名、主副目标、怪物、地点、时间、金钱、HRP、关键/紧急标记和
`Notes`。其中 `Notes` 大量明确写出：

- `Must complete ... to unlock`：前置任务及 AND/OR 组合。
- `Unlocks ...`：后继任务、特殊许可、斗技场、装备、狩技或其他功能。
- “完成某星级全部关键任务”等集合条件。
- HR、村贡献度、随从等级、狩猎特定怪物等非任务条件。

当前页面级观测规模：村任务页 379 个任务模板，其中 168 处出现 `Must complete`；集会所下位、上位、
G 位页分别有 106、238、233 个任务模板，其中分别有 7、83、90 处 `Must complete`。GU G 位特殊许可
页的 108 个任务模板均写有前置；继承自 Generations 的下位/上位特殊许可页另有 120 个任务模板，
其中 116 处写有 `Must complete`。这些数字是页面文本出现次数，不等同于去重后的关系边数量。

Wiki 英文任务名与 XX Dex 英文任务名做规范化精确匹配时，常规村、集会所和活动页已经覆盖
1,307 条 Dex 任务中的 1,162 条。未直接命中的主体是特殊许可页面使用的 G1/G2 与 I–X 命名差异，
以及少量标点/拼写差异，不能据此宣称缺任务；正式 crosswalk 应同时使用英文名、日文名、位阶、目标
和原生任务号，名称模糊匹配只能生成待审计候选。

### 具体狩技映射已经闭合

`MHGU: Villager Requests` 给出了 7 个 G2 委托实际解锁的 14 个具体狩技。将 Wiki 英文名称与原生
`hunterArtsData_eng.gmd` 精确匹配，再以相同行号读取 `hunterArtsData_chS.gmd`，已得到稳定原生 ID：

| 委托 | 狩技 ID 与简中名称 |
| --- | --- |
| 狩猎船团·红枪的委托2 | 69 射突型裂孔弹Ⅱ；105 妖刀罗刹Ⅱ |
| 丹治亚铜锣手的委托2 | 45 冲击浪潮Ⅱ；165 灵活演奏Ⅱ |
| 魁首队长的委托3 | 33 混沌刃药Ⅱ；153 螺旋斩Ⅱ |
| 魁首长枪手的委托1 | 57 治愈盾Ⅱ；129 对空炮火Ⅱ |
| 魁首新人的委托2 | 117 暴风狂斧Ⅱ；189 盾锯Ⅱ |
| 休息中猎人的委托 | 93 蓄力射击Ⅱ；141 躲避射法Ⅱ |
| 地狱兄弟·红鬼的委托3 | 21 碎月斩Ⅱ；177 猎虫觉醒Ⅱ |

Wiki 将 ID 153 写作 `Spiral Slash II`，原生英文 GMD 为 `Spiral Slice II`；两者的日文、武器类型、
任务和简中名称均一致，应作为一条明确别名审计记录，不能全局使用模糊匹配。

Wiki 内部也存在需要审计的矛盾。例如 G2 任务 `Through Thick and Fin` 的 Villager Requests 页将轻弩
奖励写成 `Rapid Fire Rain II`，但该任务自己的 Notes 和 Hunter Arts 页均写成 `Charge Shot II`；后者还
明确把 `Rapid Fire Rain II` 绑定到另一条 3★ 集会所任务 `Stop the Wheel`。原生 HTA/GMD 中
`Charge Shot I/II/III` 是连续的 92/93/94，ID 93 即简中“蓄力射击Ⅱ”，并与 `activityData_chS.gmd`
确认的“轻弩炮狩技”一致。因此该项采用 ID 93，同时把 Villager Requests 的冲突原文保留在审计中，
不能静默丢弃来源差异。

`MHGU: Hunter Arts` 还逐项提供其他狩技的解锁条件，包括直接完成任务、完成任务后与 NPC 对话、
村贡献度、随从等级和狩猎指定怪物等。这意味着“具体狩技名称和 ID”已经不再是数据发现阻塞；正式
构建时仍须把 Wiki 条件解析成带来源的结构化条件，并用 Dex 任务、原生 GMD 和活动任务 crosswalk
逐条复核。

### Wiki 的使用边界

Fandom 是社区维护的第二来源，不能覆盖 Dex/RomFS 原始证据。正式数据应同时保存页面 URL、page ID、
revision ID、revision 时间、抓取日期和原始条件文本，并区分：

- `verified`：能由 Dex、GMD、ATD/NTD 或任务原生文件交叉确认。
- `wiki_only`：Wiki 有明确记录，但游戏解包语义尚未闭合。
- `conflict`：Wiki 与原生数据不一致，禁止普通页面展示。

Wiki 页面不得作为运行时网络依赖；只能在私有研究构建阶段固定 revision、解析并审计，应用继续完全离线。

## 页面布局决策

任务图鉴不沿用怪物图鉴的“左侧窄名称列表”。任务的可比较字段较多，第一版采用高密度主从布局：

```text
顶部：统一搜索 + 水平筛选 + 重置
主体左侧约 60%：任务表格
主体右侧约 40%：任务详情
```

任务表格只保留用于识别和比较的字段：

- 星级与位阶。
- 任务名称。
- 任务类型。
- 地图。
- 主目标。
- 关键或紧急标记。

副目标、出现怪物、契约金、报酬金、时间、HRP、普通道具奖励和特殊解锁不挤入列表，统一进入右侧详情。MH3G
不存在副目标时直接隐藏该字段，不显示伪造的“无”。右侧详情使用三个标签：

1. `任务信息`：任务体系、星级、位阶、类型、地图、主副目标、出现怪物、时间、契约金、报酬金和 HRP。
2. `报酬`：按 Dex 原始奖励组展示道具、数量和概率，并区分普通奖励与特殊完成奖励。
3. `解锁关系`：前置条件、后续任务、关键/紧急关系以及装备、食材、设施、狩技等特殊解锁。

页面整体不滚动；表格和详情各自内部滚动，表头固定。顶部筛选采用项目统一的水平“字段标签 +
`SearchableSelect`”形式，并提供一键重置。列表行选择只更新右侧详情，不打开抽屉；关系对象才使用一级抽屉。

复杂开放条件不能压平成一句不可计算的文本。数据层至少应能表达：

- `all`：全部条件满足，即 AND。
- `any`：任一条件满足，即 OR。
- 完成指定任务或任务集合。
- HR、村贡献度、随从等级。
- 与指定 NPC 对话。
- 狩猎指定怪物。
- 交付指定素材。

普通页面保留可读的原始条件文本，同时用分组和连接词清楚显示 AND/OR；证据状态为 `conflict` 的关系不得进入
普通结果。

## 统一搜索与筛选决策

任务搜索不是只查任务名称。统一搜索索引必须覆盖：

- 中、英、日任务名以及十进制/十六进制任务 ID。
- 主目标、副目标、出现怪物和地图。
- 普通奖励道具和特殊完成奖励。
- 狩技的中、英、日名称。
- 前置任务、后续任务以及可读开放条件。

典型需求是用户知道想获得的内容，却不知道解锁任务。例如以下查询都应命中解锁“碎月斩Ⅱ”的任务：

```text
碎月斩Ⅱ
碎月斩2
Moonbreaker II
ムーンブレイクⅡ
狩技：碎月斩Ⅱ
```

构建搜索索引时应统一大小写和全角/半角字符，并为罗马数字与阿拉伯数字建立等价形式，例如
`Ⅱ / II / 2`。等价规则只能处理文字形式，不能用模糊名称推断新的数据关系。

通过关联字段命中的结果必须显示原因，例如：

```text
命中：解锁狩技·碎月斩Ⅱ
命中：报酬道具·狞猛化斩龙鳞
命中：前置任务·……
```

筛选至少包括任务体系、具体星级/位阶、任务类型、地图、普通/关键/紧急，以及 GU/XX 的内容可用版本。
任务奖励仍只展示在详情中，但可以参与搜索。

## 任务、狩技与其他图鉴的关联

- 任务正文点击奖励道具、出现怪物或解锁狩技时，打开对应一级详情抽屉。
- GU/XX 狩技正文点击解锁任务时，打开任务一级详情抽屉。
- 任意抽屉内再次点击关联对象时，先关闭当前抽屉，再跳转对应图鉴并定位目标；严禁打开第二层抽屉。
- 任务图鉴与独立狩技图鉴共享稳定任务键和狩技 ID，不以显示名称作为运行时关系键。
- MH3G、MH4G 没有 GU/XX 狩技域，不显示狩技筛选或空入口。

GU/XX 的独立狩技图鉴、数据来源和解锁关系计划见 [10-hunter-arts-catalog.md](10-hunter-arts-catalog.md)。

## 实施结果与剩余边界

- `tools/build_quest_catalog.mjs` 按“怪物基础数据 → 任务扩展 → 狩技关系”扩展三套私有 SQLite。
- 三作 Dex 奖励关系分别为 6,560、13,012、37,569 条，外加 417 条 MHGU 独占任务原生奖励；奖励道具外键为零缺失。
- 页面已提供任务体系、等级/位阶、类型、地图、关键/紧急和内容版本筛选，以及任务、目标、怪物、奖励、关联任务和狩技反查。
- 详情已拆为任务信息、报酬、解锁关系三个标签，并接入任务、怪物、道具、狩技之间的一级抽屉。
- 固定 Wiki revision 中可精确映射的前后置关系已入库；`conflict` 关系只保留在私有审计，不进入普通页面。

当前没有阻止第一版使用的数据硬阻塞。3G/4G 的特殊完成奖励和完整前置图仍未达到 GU/XX 的覆盖度，
后续只能在取得可靠 RomFS/脚本或固定第二来源后增量补充，不在当前页面伪造完整性。

## 数据边界

Dex CSV、RomFS、GMD、ATD、NIS、NTD、任务 ARC、crosswalk、SQLite 和审计报告均为私有研究输入或
生成产物，不进入 GitHub、公开 Action artifact 或 Release。公开仓库只保存解析器、schema、计划和
不含受限内容的测试。
