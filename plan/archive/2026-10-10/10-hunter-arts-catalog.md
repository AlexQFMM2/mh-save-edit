# MHGU/XX 狩技图鉴

Status: 已归档
归档日期：2026-10-10
责任归属：项目维护者；后续由社区按需参考

归档结论：狩技图鉴首版与任务双向关联完成，进一步来源研究停止排期。

保留边界：Wiki-only 条件和已隔离的冲突继续按原证据等级保留。

复核依据：原文实施记录、[任务 Repository 回归](../../../tests/questCatalogRepository.test.ts)及[狩技详情](../../../ui/components/HunterArtDetailPanel/HunterArtDetailPanel.tsx)。

> 用户于 2026-10-10 决定将全部旧计划归档，未做的后续工作不再继续排期。以下为历史方案与原始勾选记录；未实施或未验收项保持原状，不记作完成。当前维护方向见[归档索引](../../README.md)与[项目 README](../../../README.md)，发布边界以[现行约定](../../../AGENTS.md)为准。代码、研究路径和命令按项目根目录或原说明解释。

## 归档前记录

## 范围与产品决策

狩技不作为任务详情中的一段附属文字处理。MHGU/XX 单独提供狩技图鉴，任务图鉴只保存并展示与狩技的
双向关系。这样用户既可以从“我想解锁碎月斩Ⅱ”反查任务，也可以按武器类型浏览全部狩技。

- 仅 MHGU/XX 工作区显示“狩技”导航。
- MH3G、MH4G 不显示没有内容的空入口。
- 第一版只读浏览，不写入存档中的装备狩技槽。
- 原生表共 191 条记录；ID 0 为“无装备”，ID 71–82 为 `@`/空白占位，普通页面固定展示 178 条有效狩技。

## 权威数据来源

当前已确认原生来源：

```text
D:\MH\unpack\mhgu\romfs\nativeNX\table\hunterArtsData.hta
D:\MH\unpack\mhgu\romfs\nativeNX\chS\table\hunterArtsData_chS.gmd
D:\MH\unpack\mhgu\romfs\nativeNX\eng\table\hunterArtsData_eng.gmd
research/mhgu/romfs/mhxx-table/hunterArtsData.hta
research/mhgu/romfs/mhxx-table/hunterArtsData_jpn.gmd
```

`hunterArtsData.hta` 为 8 字节头，随后是 `191 × 25` 字节记录。中、英、日 GMD 按稳定行号提供名称和
说明。正式构建必须保存游戏版本、原生 ID、武器类型、等级、名称、说明、来源文件 SHA-256 和
`content_variant`；不能依靠翻译名称充当主键。

Fandom `MHGU: Hunter Arts` 与 `MHGU: Villager Requests` 仅作为固定 revision 的第二来源，用于补充解锁
条件和别名。运行时不得联网。每条 Wiki 关系必须保存 URL、page ID、revision、原始条件文本和证据状态：

- `verified`：可由原生 HTA/GMD、activityData、任务文件或脚本交叉确认。
- `wiki_only`：Wiki 有明确记录，但原生条件语义尚未完全闭合。
- `conflict`：来源互相矛盾，禁止在普通页面当确定事实展示。

## 已确认委托映射

7 个 G2 委托已经闭合到 14 个具体狩技：

| 委托 | 狩技 ID 与简中名称 |
| --- | --- |
| 狩猎船团·红枪的委托2 | 69 射突型裂孔弹Ⅱ；105 妖刀罗刹Ⅱ |
| 丹治亚铜锣手的委托2 | 45 冲击浪潮Ⅱ；165 灵活演奏Ⅱ |
| 魁首队长的委托3 | 33 混沌刃药Ⅱ；153 螺旋斩Ⅱ |
| 魁首长枪手的委托1 | 57 治愈盾Ⅱ；129 对空炮火Ⅱ |
| 魁首新人的委托2 | 117 暴风狂斧Ⅱ；189 盾锯Ⅱ |
| 休息中猎人的委托 | 93 蓄力射击Ⅱ；141 躲避射法Ⅱ |
| 地狱兄弟·红鬼的委托3 | 21 碎月斩Ⅱ；177 猎虫觉醒Ⅱ |

`Through Thick and Fin` 的来源存在冲突：Villager Requests 写 `Rapid Fire Rain II`，任务页和 Hunter
Arts 页写 `Charge Shot II`，原生连续 ID 与简中 GMD 则确认 ID 93 为“蓄力射击Ⅱ”。正式数据采用 ID 93，
并保留 Wiki 冲突审计，不静默覆盖证据。

## 解锁条件模型

狩技解锁并不全是“完成一个任务”，统一关系必须能表达：

```ts
type HunterArtUnlockCondition =
  | { kind: 'quest'; questKey: string; afterNpcConversation?: boolean }
  | { kind: 'all'; conditions: HunterArtUnlockCondition[] }
  | { kind: 'any'; conditions: HunterArtUnlockCondition[] }
  | { kind: 'hunterRank'; minimum: number }
  | { kind: 'villageContribution'; village: string; minimum: number }
  | { kind: 'palicoLevel'; minimum: number }
  | { kind: 'huntMonster'; monsterId: number; quantity?: number }
  | { kind: 'npcConversation'; npcKey: string }
  | { kind: 'sourceText'; text: string }
```

结构化条件必须同时保留来源原文。尚未解析的条件只能以 `sourceText` 和对应证据状态进入审计，不能猜测成
简单任务关系。多条件必须保留 AND/OR 分组，不得展开成彼此独立、含义错误的列表。

## 页面布局与交互

页面采用左侧列表、右侧宽详情的主从布局：

```text
顶部：搜索 + 武器类型 + 等级 + 解锁方式 + 重置
主体左侧：狩技列表
主体右侧：狩技详情与解锁条件
```

左侧列表行显示名称、武器类型和等级。右侧详情显示中英日名称、说明、武器类型、等级、结构化解锁条件、
关联任务和证据状态。页面整体不滚动，列表与详情分别内部滚动；筛选统一水平布局，所有下拉使用
`SearchableSelect`。

搜索覆盖：

- 狩技中、英、日名称与 ID。
- 武器类型和等级。
- 解锁任务中、英、日名称。
- NPC、怪物、村贡献度等可读解锁条件。
- `Ⅱ / II / 2`、大小写、全角/半角等规范化别名。

当结果由关联任务或解锁条件命中时，列表必须显示命中原因。用户搜索“狩技：碎月斩Ⅱ”时既可以在
狩技页找到该狩技，也可以在任务页找到负责解锁它的任务。

## 一级抽屉规则

- 任务正文点击狩技：打开狩技详情抽屉。
- 狩技正文点击解锁任务：打开任务详情抽屉。
- 狩技正文点击关联怪物或素材：打开对应详情抽屉。
- 抽屉内再次点击任意关联对象：关闭当前抽屉，再跳转对应图鉴并定位目标。
- 页面同时只允许一个活动抽屉，严禁抽屉嵌套。

## 实施顺序与验收

1. 构建 178 条有效狩技的统一表和三语文本 crosswalk。
2. 解析固定 Wiki revision，建立任务、NPC、怪物及其他解锁条件候选。
3. 用原生 HTA/GMD、activityData、任务文件和 NIS/NTD 对候选关系分级审计。
4. 建立任务统一搜索索引，使狩技名称可以反查任务并给出命中原因。
5. 实现 Repository、IPC、狩技页面以及任务/狩技双向一级抽屉。

验收至少包括：

- ID 0 与 ID 71–82 默认隐藏，178 条有效狩技无重复身份。
- 三语名称和说明与稳定原生 ID 对齐。
- 武器类型、等级和解锁方式筛选正确。
- “碎月斩Ⅱ / 碎月斩2 / Moonbreaker II / ムーンブレイクⅡ”均命中同一狩技及其解锁任务。
- 14 个已确认委托狩技逐项正确，`Through Thick and Fin` 冲突仍在审计中可追溯。
- 任务与狩技的正文点击打开抽屉，抽屉内点击关闭后跳转，不产生嵌套。
- 私有 HTA、GMD、Wiki 快照、crosswalk、SQLite 和审计报告不进入 Git。

## 实施结果与剩余边界

狩技图鉴第一版已实现：178 条有效记录均具备三语名称、说明、武器类型、等级和至少一条可展示解锁规则；
任务型条件保留 AND/OR，完成后 NPC 对话保存为复合条件，村任务数、村贡献度、随从等级、狩猎怪物和
斗技场任务均使用结构化类型。页面提供名称/说明/解锁任务搜索、武器/等级/解锁方式筛选、URL 恢复和重置。

7 个委托的 14 个具体狩技映射由审计逐项固定。`Through Thick and Fin` 的冲突继续只保存在私有构建报告，
普通页面采用原生数据与 Hunter Arts 页面共同确认的 ID 93“蓄力射击Ⅱ”。`wiki_only` 条件明确显示来源，
未经证据支持的关系不升级为 `verified`。

## 数据边界

HTA、GMD、ATD、NIS、NTD、固定 Wiki Wikitext、crosswalk、SQLite 和审计报告均属于私有研究输入或
生成产物，只能位于 `research` 或项目已忽略目录。公开仓库只保存解析器、schema、计划和不含受限内容的测试。
