# 三作怪物图鉴

Status: 已归档
归档日期：2026-10-10
责任归属：项目维护者；后续由社区按需参考

归档结论：怪物图鉴首版及关联闭环完成，旧实施顺序归档。

保留边界：专项数据证据增补不再排期。

复核依据：原文实施记录及 [Repository](../../../tests/monsterCatalogRepository.test.ts)、[UI](../../../tests/monsterCatalogUi.test.tsx) 回归。

> 用户于 2026-10-10 决定将全部旧计划归档，未做的后续工作不再继续排期。以下为历史方案与原始勾选记录；未实施或未验收项保持原状，不记作完成。当前维护方向见[归档索引](../../README.md)与[项目 README](../../../README.md)，发布边界以[现行约定](../../../AGENTS.md)为准。代码、研究路径和命令按项目根目录或原说明解释。

## 归档前记录

## 目标

实现 MH3G、MH4G、MHGU/XX 的只读怪物图鉴。这个页面不沿用武器、防具的“列表 + 右侧窄详情”比例，而采用主从浏览布局：

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│ 窄列表               │ 宽详情                                       │
│ 搜索                 │ 怪物名称、图片、基础信息                     │
│ 图标 + 名称（一行）  │ 标签：肉质｜异常耐性｜掉落物｜出没任务         │
│                      │ 当前标签的完整数据                          │
└──────────────────────┴──────────────────────────────────────────────┘
```

左侧只负责搜索和切换怪物，右侧承载绝大多数信息。桌面窗口不整体滚动，列表和详情各自内部滚动；详情标签切换不改变左侧筛选和当前怪物。

## 数据探测结论（2026-09-08）

三套 Dex 的数据库结构均确认存在以下表：

| 数据 | 3G | 4G | GU/XX |
| --- | --- | --- | --- |
| 怪物名称 | `ID_Mon_Name` | `ID_Mon_Name` | `ID_Mon_Name` |
| 部位名称/条件 | `ID_Mon_Part` / `ID_Mon_PartCond` | 同左 | 同左 |
| 肉质 | `DB_Mon_Weak` | 同左 | 同左 |
| 异常耐性 | `DB_Mon_Ail` | 同左 | 同左 |
| 陷阱效果 | `DB_Mon_Trap` | 同左 | 同左 |
| 怪物掉落 | `DB_ItmtoMon` | 同左 | 同左 |
| 任务目标与任务属性 | `DB_Qst`、`ID_Qst_*` | 同左，并有 `ID_Qst_Goal2` | 同左，并含 `QstIcon/QstTalk` |

当前有效记录规模（排除 `---`、纳品、环境不稳定等占位/状态记录）：

| 内容库 | 有效怪物 | 怪物掉落关系 | 图片资源 |
| --- | ---: | ---: | --- |
| MH3G | 73 | 3,433 行，73 个怪物有关系 | `Mon_B_*` + `Mon_S_*` |
| MH4G | 106 | 4,336 行，106 个怪物有关系 | `Mon_B_*` + `Mon_S_*` |
| MHGU/XX | 129 | 7,527 行，129 个怪物有关系 | `Mon_B_*` + `Mon_S_*` |

图片资源探测结果：

- MH3G：大图主要为 `128×128`，同时有列表小图。
- MH4G：大图主要为 `36×36`，同时有列表小图。
- MHGU/XX：大图主要为 `72×72`，同时有列表小图。
- 资源键中的 `Mon_B_`、`Mon_S_` 与怪物名称表按显式 ID/资源键 crosswalk 映射，禁止按文件顺序猜测。

3G、4G 的怪物与任务表已于 2026-09-08 补导完成。两个导出器的筛选白名单已加入 `Mon`、`Qst`、`Rank`、`Loc` 和 `Star`；3G 的 `ID_Qst_Goal` 还修正为无约束逐行导出，避免原表约束异常造成数据丢失。补导先写入新的宿主机 staging，经过 schema、行数和 SHA-256 校验后才替换 Linux 固定快照，旧快照仍保留在私有归档中。

当前固定输入：

| 内容库 | Linux 固定快照 | 文件数 | 内容摘要 SHA-256 |
| --- | --- | ---: | --- |
| MH3G | `research/mh3u/dex/mh3g-dex` | 199 | `871fef7b79b44050b3b9de1e8881175df5278a42f3a6c3a4ae2ea480eb8bb29e` |
| MH4G | `research/mh4g/dex/mh4g-dex` | 204 | `8f8d31ef89a774ed619a8bb4faae5ac79a28f945c14dca7c1e148dc9166831c8` |
| MHGU/XX | `research/mhgu/dex/mhxx-dex` | 219 | 由快照 `source-manifest.json` 逐文件复验 |

MH3G 原 Dex 不存在 `ID_Qst_Goal2`，该作不伪造次要目标表；MH4G 与 MHGU/XX 的 `ID_Qst_Goal2` 均已导出并纳入外键审计。

## 数据阻塞清零结果（2026-09-08）

`pnpm data:audit:monsters -- --research-root ../research` 已固化为正式预检入口，当前连续运行结果稳定。预检逐文件复验 Dex 来源 manifest，检查怪物、部位、异常、陷阱、掉落道具、位阶、任务、地图与任务怪物外键，并验证图片实体内容哈希与文件名一致。

| 内容库 | 怪物 | 肉质 | 异常 | 陷阱 | 掉落 | Dex 任务 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MH3G | 73 | 476 | 438 | 365 | 3,433 | 364 |
| MH4G | 106 | 847 | 742 | 530 | 4,336 | 572 |
| MHGU/XX | 129 | 947 | 1,032 | 645 | 7,527 | 1,307 |

GU/XX 原生任务解析已经固定为只读 ARC v17、zlib、GMD 与 `questData` 解析：

- MHGU 任务 ARC 1,854 个，MHXX 任务 ARC 1,331 个，共通物理文件 1,330 个；共通任务前 235 字节核心数据差异为 0。
- 524 个物理 GU-only 文件中有 189 个有效任务；其中 140 个能精确匹配 XX Dex 下载任务，语义 availability 为 `common`，真正标为 `mhgu` 独占的是 49 个。
- XX Dex 1,307 个任务全部完成原生文件 crosswalk。
- 94 个原生大型怪物 ID 使用显式映射；189 个有效物理 GU-only 任务实际使用其中 91 种，未知为 0。
- 大型怪物只来自 `questData` 的 5 个槽位，小型怪物只来自 GMD“出现怪物”；任务怪物关系只表达“出现”，不推测主目标、次目标或乱入。
- 任务类型、地图和 DLC 1★–7★ / G1★–G4★ 位阶均已显式映射，未知为 0。

图片资源已从三作 Dex 内嵌资源导出到私有 `research/generated/mh-save-edit`，并按内容 SHA-256 去重：

| 内容库 | `Mon_S` | `Mon_B` | `Stat` | `Trap` | 有效怪物小图覆盖 |
| --- | ---: | ---: | ---: | ---: | ---: |
| MH3G | 76 | 76 | 11 | 5 | 100% |
| MH4G | 110 | 106 | 12 | 5 | 100% |
| MHGU/XX | 131 | 131 | 12 | 5 | 100% |

状态枚举已确认 `6–11` 分别为毒、麻痹、睡眠、爆破、气绝、疲劳/灭气，`12` 隐藏，`13` 为骑乘；陷阱 `1–5` 分别为闪光、麻痹陷阱、落穴、音爆和肉类诱饵。项目根目录散落的 `.resources` 也已按哈希可恢复归档到 `research/archive/unclassified/resources`，没有删除原始文件。

审计报告、任务 crosswalk、图标 manifest、PNG、CSV 和固定输入都只存在私有 `research`，不得进入 Git、GitHub Action artifact 或 Release。至此怪物图鉴的数据层硬阻塞已经解除。

## 第一版实施结果（2026-09-08）

怪物图鉴的 SQLite、Repository、IPC、preload 与 React 页面已经完成。`tools/build_monster_catalog.mjs` 会先强制执行预检，通过后才在私有临时数据库中以事务重建怪物表，最后原子替换 `research/generated/mh-save-edit/catalog/data` 下的数据库；使用 `--install-local` 时才同步到项目已忽略的本地运行目录。

| 内容库 | 入库怪物（含占位） | 有效掉落 | 任务 | 任务怪物关系 | 任务状态标记 |
| --- | ---: | ---: | ---: | ---: | ---: |
| MH3G | 74 | 3,342 | 364 | 903 | 177 |
| MH4G | 109 | 4,336 | 572 | 987 | 244 |
| MHGU/XX | 130 | 7,527 | 1,356 | 2,427 | 419 |

MHGU/XX 的 1,356 条任务由 1,307 条共通 Dex 任务和 49 条真正 MHGU 独占任务组成。任务中的环境不稳定、狂龙化和极限化等标记单独写入 `catalog_quest_modifiers`，不会冒充怪物出现关系。3G 的 91 条 `Itm_ID=-1` 哨兵掉落没有入库，其余掉落全部关联稳定的道具存档 ID。

页面已实现左侧窄列表、右侧宽详情、内部滚动和肉质/异常耐性/掉落物/出没任务四个标签；搜索支持中英日名称、十进制与十六进制 ID。怪物详情一次 IPC 返回所有标签数据，切换标签不重复读取数据库，切换怪物时保留旧详情直至新请求完成。URL 保存搜索、选中怪物、标签、掉落概率方向、任务版本筛选和活动任务抽屉。

关联规则已经闭合：怪物正文的道具和任务打开一级抽屉，道具正文的怪物和任务也打开一级抽屉；抽屉内再次点击关联对象会先关闭抽屉再跳转定位，不会产生嵌套抽屉。任务保持为关系详情，没有新增独立导航或任务图鉴。

最终验收已通过 `pnpm data:audit:monsters -- --research-root ../research`、`pnpm typecheck`、`pnpm test`、`pnpm build` 和 `git diff --check`。当前 Vitest 共 24 个测试文件、111 项测试全部通过；Git 数据边界检查确认 SQLite、PNG、CSV、manifest、crosswalk 和审计输出均未被仓库跟踪。

## 页面布局与交互

### 左侧怪物列表

- 宽度为页面的窄栏，目标约 `260–320px`；详情区域占剩余空间，至少为列表的两倍。
- 顶部是搜索框，匹配中文、英文、日文名称、十进制 ID 和十六进制 ID。
- 列表行仅显示：小图标、中文名称；英文名作为辅助文本或 tooltip，不把行撑成多列表格。
- 每行使用原生 `<button>`，选中态有金色边框/背景和 `aria-pressed`。列表采用 roving tabindex：Tab 只进入列表一次，上下方向键移动并选择，Enter/Space 确认，避免用户按一百次 Tab 才能离开列表。
- 搜索采用延迟查询；请求过期时不清空当前详情，避免切换时闪烁。
- 三作当前最多只有 129 个有效怪物，首版一次读取最多 200 个摘要并在窄栏内部滚动，不增加分页操作；只有性能实测证明需要时才引入虚拟列表。

### 右侧怪物详情

头部固定显示：

- 怪物大图（加载失败时显示名称和统一 fallback）。
- 中文名、英文名、日文名和怪物 ID。
- 可用内容摘要，例如“肉质 7 条、异常 6 条、掉落 42 条、关联任务 18 个”。

头部下方使用原生标签页，不使用路由跳转：

1. **肉质表**
   - 部位、状态/条件、斩击、打击、弹。
   - 火、水、雷、冰、龙属性肉质。
   - 气绝/眩晕值（Dex `Diz`）。
   - 同一部位的普通、怒时、破坏后等记录分别显示，不能覆盖合并。
2. **异常耐性表**
   - 异常名称、初始耐性、耐性增量、最大耐性。
   - 持续时间、伤害；无效值显示为“无效/不适用”，不显示原始 `-1`。
   - 同一标签下追加“陷阱与控制”分区，显示是否有效，以及普通、愤怒、疲劳状态的持续时间；不额外增加第五个标签。
3. **掉落物表**
   - 固定列：位阶、获取方式、道具、数量、概率、条件。
   - 位阶显示下位、上位、G 位以及 Dex 已确认的特殊位阶。
   - 获取方式来自 `ID_Mon_GetItmType`，例如剥取、捕获、部位破坏、闪光掉落等。
   - 道具名称可点击打开一级道具详情抽屉；抽屉内再次点击道具时关闭抽屉并跳转道具图鉴。
   - 概率支持降序/升序切换，默认按位阶、获取方式、概率降序。
4. **出没任务**
   - 任务名称、星级/位阶、任务类型、地图、时间、契约金、报酬金、HRP。
   - 展示该怪物所在的任务怪物槽、主目标文本和次目标文本。只有在 Dex 客户端逻辑或游戏表中确认槽位语义后，才标记“主目标、次目标、乱入”；不能根据 `Mon1_ID ... Mon8_ID` 的顺序猜测。
   - 任务名称或任务目标怪物可点击打开一级任务/怪物详情抽屉；抽屉内再次点击执行关闭后跳转。
   - 任务数据缺少可靠名称时显示任务 ID 和“名称未导出”，不得根据相邻 ID 猜名称。

标签页规范：

- `role="tablist"`、`role="tab"`、`role="tabpanel"`，使用 `aria-selected` 和 `aria-controls`。
- 左右方向键切换标签，Home/End 跳到首尾；Tab 从标签进入当前面板。
- 当前标签保存到 URL，刷新、前进、后退均可恢复。
- 无数据标签保留但显示清晰的空状态，不隐藏标签造成布局跳动。

## 数据模型与构建

新增统一领域类型：

```ts
type MonsterIdentity = { gameId: GameId; monsterId: number }
type MonsterPart = {
  partId: number
  nameCn: string
  conditionCn?: string
  state?: string
  cut: number
  impact: number
  shot: number
  fire: number
  water: number
  thunder: number
  ice: number
  dragon: number
  dizzy: number
}
type MonsterAilment = {
  statusId: number
  nameCn: string
  initial: number
  increase: number
  maximum: number
  duration: number
  damage: number
}
type MonsterDrop = {
  rankId: number
  sourceKind: ItemSourceKind
  item: ItemIdentity
  quantity: number
  probability: number
  condition?: string
}
type MonsterQuestAppearance = {
  questId: number
  rankId?: number
  questLevel?: number
  questNameCn: string
  questTypeCn?: string
  locationCn?: string
  monsterSlot: number
  goalCn?: string
  subGoalCn?: string
  appearanceRole?: 'main' | 'sub' | 'intruder' | 'other'
}
```

SQLite 继续使用游戏独立数据库，新增表建议为：

- `catalog_monsters`
- `catalog_monster_parts`
- `catalog_monster_ailments`
- `catalog_monster_traps`
- `catalog_monster_drops`
- `catalog_monster_quests`
- `catalog_quests`
- `catalog_quest_targets`

构建器 `tools/build_monster_catalog.mjs` 只读取 `research` 固定快照，生成 SQLite、来源 manifest、crosswalk 和审计报告到 `research/generated` 或项目已忽略目录。原始 Dex、游戏解包、`.resources`、SQLite、PNG 和 CSV 不进入 Git、Action artifact 或 Release。

构建阶段必须验证：

- 名称表、肉质、异常、陷阱、掉落、任务端点全部通过显式 ID 外键。
- 非占位怪物均有名称；能映射的怪物均有 `Mon_S_*` 小图，详情大图缺失时允许 fallback。
- 掉落概率、数量和位阶不做百分比猜测；保留 Dex 原始精度。
- 同一怪物多个状态/部位条件不覆盖，保留来源行。
- `Stat_ID`、`Trap_ID` 及任务怪物槽的可读语义必须从 Dex 客户端实现或游戏原生枚举取得并进入审计；不得凭常识硬编码名称。
- 3G/4G 补导后的行数和 schema 与 SQLite master 一致，连续构建两次结果摘要相同。

## API、IPC 与 URL

Repository：

```ts
searchMonsters(filters): MonsterSummary[]
getMonster(identity): MonsterDetail | null
getMonsterFacets(gameId): MonsterCatalogFacets
```

详情查询一次返回基础信息和当前怪物的分组关系，标签切换只在 renderer 内切换已加载数据，不重复读取数据库。SQLite 只在 Electron 主进程只读打开，preload 通过 Zod 校验暴露 API，React 不接触路径或 SQL。

URL 参数固定为：

```text
q monster tab dropSort dropDirection debug
```

`monster` 保存当前选中怪物 ID，`tab` 保存当前详情标签。重置按钮清除搜索、排序、调试和外部目标，恢复“肉质表”并选中默认首个有效怪物；当前游戏不变。

## 关联抽屉规则

- 怪物详情正文点击道具、任务或关联怪物：打开一级详情抽屉。
- 抽屉内再次点击关联对象：先关闭抽屉，再跳转对应图鉴并带入 `target`/选中项。
- 禁止从抽屉内打开第二层抽屉。
- 掉落物与任务目标使用稳定 `itemSaveId`、`questId`、`monsterId`，UI 不显示不可读的内部行号。

## 页面组件拆分

所有组件分别维护 `.tsx` 和 `.css`，页面 CSS 只负责左右主从骨架和公开变量。建议拆分：

- `MonsterCatalogPage`
- `MonsterSearchList`
- `MonsterSearchInput`
- `MonsterListRow`
- `MonsterDetailHeader`
- `MonsterDetailTabs`
- `MonsterWeaknessTable`
- `MonsterAilmentTable`
- `MonsterDropTable`
- `MonsterQuestAppearanceTable`
- `MonsterDetailDrawer`

组件默认尺寸定义在组件 CSS；页面仅覆盖公开变量，例如：

```css
--monster-catalog-page-list-width
--monster-catalog-page-detail-min-width
--monster-detail-tabs-component-tab-height
--monster-drop-table-component-row-height
```

字号、数据颜色、滚动条、棕金主题和搜索下拉统一复用现有全局令牌与公共组件。

## 测试与验收

数据：

- 三作连续构建两次，SQLite、manifest、crosswalk、图标映射摘要一致。
- 校验怪物数量、肉质状态行、异常、陷阱和掉落关系覆盖率。
- 3G/4G 重新补导后，验证 `DB_Mon_*`、`DB_Qst`、`ID_Qst_*` 实际 CSV 存在且字段与 schema 一致。
- 校验所有掉落道具和任务目标外键；不允许数字 ID 无名称地直接展示。

Repository/IPC：

- 名称、英文名、日文名、十进制/十六进制 ID 搜索。
- 当前怪物、详情关系、最多 200 条摘要限制和不存在 ID。
- 非法游戏、分页、排序、路径注入、数据库缺失/损坏均返回可理解错误。

UI：

- 左窄右宽比例在 1024px、1280px、1440px 下稳定，窗口不整体滚动。
- 列表图标与名称一行排列，详情四个标签正常切换。
- URL 刷新/前进/后退恢复搜索、选中怪物、标签和掉落排序。
- 键盘可完成搜索、列表选择、标签切换、表格滚动和抽屉关闭。
- 肉质普通/怒时/破坏后记录不丢失；掉落按位阶和概率排序正确。
- 图片、名称、关系加载失败均有 fallback；`prefers-reduced-motion` 下不产生位移动画。

## 后续实施顺序

1. 基于已通过的固定快照生成三套怪物 SQLite 表，不再回到宿主机临时读取数据。
2. 实现只读 Repository、Zod IPC 与 renderer 类型。
3. 实现四标签详情和窄列表/宽详情主从布局，再接入任务详情页。
4. 最后补怪物与道具、任务、怪物之间的一级抽屉联动。

本阶段不实现存档写入、怪物 3D 模型、部位破坏模拟、任务编辑或在线数据同步。
