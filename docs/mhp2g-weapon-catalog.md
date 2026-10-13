# P2G 武器运行数据与只读查询

更新日期：2026-10-13。承接[功能差距](mhp2g-weapon-page-parity.md)和[原生核查](mhp2g-weapon-native-review.md)。已完成数据构建、来源审计、共享 IPC、共享武器页面及一级关联抽屉，并在本地安装审计后的完整资料库。存档写入和配装继续作为独立范围。

后续状态：[完整防具图鉴](mhp2g-armor-catalog.md)已在本版本基础上追加并本地安装。当前完整运行库为 `catalog-armor-v1`，哈希与恢复入口见[装备交接](mhp2g-equipment-handoff.md)；下文保留武器阶段的来源、版本和验收。

## 数据与职责

从当前含装饰品的完整库副本追加武器，不重新生成其余图鉴。原生核查快照是数值、关系和图标的来源；已冻结的本作日文与名称绑定是文本来源。构建、审计和查询均不连接宿主机，不重新抓取资料。武器阶段曾将运行库 `data/mhp2g.sqlite` 原子替换为下述武器版本；替换前的完整库已逐字节备份。原基线 SHA-256 为 `439e769eb5b8e78174d0ceba7b571bc5a9343e25e6da982af345af5c147d6356`，备份位于 `../research/generated/mh-save-edit/mhp2g/weapon-ui-verification-v1/runtime-backup/mhp2g-original.sqlite`。未关闭正在运行的应用；主进程已缓存旧数据库时，需要在方便时重启开发应用。

武器阶段私有产物：`../research/generated/mh-save-edit/mhp2g/catalog-weapons-v3/`，包括数据库、88 个内容哈希图标和构建 manifest。译名轮补齐 785 条项目译名，保留 716 条已有官方用词；1,501 把正常武器均有中文显示名。原 `catalog-weapons-v1` 保留，译名更新前的库另备份在 `../research/generated/mh-save-edit/mhp2g/weapon-localization-verification-v1/pre-install/mhp2g-original.sqlite`（SHA-256 `d9af7fddead294dd903e2d67e7b41c6409706bbe243548f46b483a35136a794b`）。本轮在 v2 完整库上追加[笛谱补充](mhp2g-horn-performance.md)；v2 保留为来源基线及安装前备份，旧表、译名、图标和关系不变。武器／笛谱 v3 库 SHA-256：

```text
618d159340a162eeb843e66cfcca53a114c38a66e0c4c7b8402cd68d8bffbe7c
```

| 内容 | 验收数量 |
| --- | ---: |
| 正常目录武器／类别 | 1,501／11 |
| 强化边／跨类边 | 958／55 |
| 生产／强化材料配方 | 806／940 |
| 锈块配方／结果分支 | 10／30 |
| 配方材料行／旧用途映射 | 6,033／6,023 |
| 原有业务表指纹保留 | 20 张 |

两个占位和一条无确认取得路径的记录继续排除，身份及原因写入私有构建 manifest。审计从生产与锈块结果重新遍历完整强化图，证明所有正常条目有取得路径；往返关系保留。最终形态由完整图的出边判定，得到 769 把，包含跨类别出边的武器不误判为最终形态。

采用独立 `p2g_weapon_*` 表及 [P2G 契约](../api/catalog/p2gWeaponTypes.ts)，复用已有四个武器 IPC 通道和只读数据库连接。三作武器类型及核心 `GameId` 保持原有边界；P2G 返回原生表名与编号，不构造 `saveId`、`saveType` 或 Dex ID。没有新增服务、单独数据库或第二套 IPC 通道。页面通过 [显示适配层](../ui/utils/catalogWeapon.ts)消费本作契约；写入与配装继续使用原来的三作类型。

## 查询与机制边界

- 支持中文／日文、图鉴编号与完整武器键搜索，类别／属性／稀有度／孔位／生产能力／最终形态筛选，多字段排序和分页。材料反查返回命中原因，指定目标定位保留既有忽略不相符筛选的行为。
- 派生查询包含所选类别，以及所有相邻跨类端点和相关边。额外节点标注 `isCrossType`；回边不被删除。画布只在定位算法中区分回边，原图全部边继续渲染。回向强化用虚线、箭头和文字表示；跨类节点注明目标类型，点击或方向键选择会切换类型并定位。命中导航和上下文遍历均可处理往返关系。
- 生产替代配方分别保存；强化材料取目标记录。锈块是独立配方，费用 1,000，三条结果保留原生随机值模 100 的区间，接口不把区间宽度标成精确概率。材料使用 P2G `itemId`。
- 会心保存原始值，斩味分别保存基础与匠长度，查询不会用斩味补正覆盖原始会心。双属性保留原生顺序及各自数值。
- 弩保留可用弹掩码与容量模板的区别；不可用弹的 `loadQuantity` 为 `null`。100 个速射关联保留发数、倍率及原始反动编号。233 条独立观察核对了原生装填／反动枚举；速射反动沿用此前 22 组参数交叉验证。页面不填后作偏移或蹲射字段。
- 弓按基础 2／3／4 段及装填数追加段返回。真实库分别有 2／108／7 把；基础两段的第三段需要装填数，第四段仍不可用。瓶掩码保持原始值；104 条弓观察完成 624 次瓶掩码比较。弹药／瓶根据本作精确日文道具名解析唯一 `itemId`，实际验证了 7,552 个弹药和 702 个瓶道具关联；不按编号相邻关系猜映射。
- 笛保留音色、旋律顺序、原生匹配模式和效果分派。95 把笛、534 个旋律关联均补齐 `performance`，覆盖 47 套模式、42 类效果的初次／重奏语义、普通／吹笛名人时间、音符及状态条件；即时效果没有持续计时。旧 `null` 字段仅为兼容保留，不再作为页面数据。完整来源与验收见[笛谱补充](mhp2g-horn-performance.md)。
- 716 条已有中文用词对应，另 785 条已按本作名称、说明和系列上下文补齐项目译名。日文原名仍显示并可搜索；G、改版及罗马数字等级保留，缩写逐项记录解释。名称状态仅作为资料来源保留，页面不展示内部审校状态。

译名采用独立私有审阅输入 `../research/mhp2g/weapon-name-review-v1/names.json`，SHA-256 为 `2e02e63a2d7b83e66ca8e848cee8797ce9712dc952c31894c9f40341da069ea7`。每条记录保存原生武器键、文本键、原始行哈希、日文、中文及上下文依据；323 条还记录经核实的 GU 根名用词参考，仍属于 P2G 项目译名。构建器验证两份冻结输入的哈希、正常目录范围、逐条原文与身份，以及所有待翻译正常武器的完整覆盖；拒绝覆盖官方用词、缺项、重复、错绑和残留假名。原 `localization-v4` 和原生 review 不改写；审阅输入的内容哈希进入来源指纹及派生 `dataVersion`。

截图中的 `weapon_blademaster:266` / `クリムゾンサイス` 已显示“绯红镰刀”，`weapon_blademaster:267` / `ホワイトマンティス` 已显示“白螳螂”。笛的 42 种效果标签及铳枪类型同步显示中文，原始标签保留；时长、重奏和状态语义由后续独立笛谱核查补齐，不从标签翻译推断。

[查询仓库](../api/catalog/p2gWeaponRepository.ts)还提供 `getItemWeaponUsages(itemId)`，返回明确的配方与武器结果。道具页已经消费完整的配方分组及全部锈块结果，替换旧武器待接入入口。道具名称可反查武器材料并显示原因；武器名称也可反查对应材料道具。正文打开唯一一级详情抽屉，抽屉内关闭后跳转目标图鉴并定位。

## 重建与审计

下面命令保留初始武器／译名 v2 的重建步骤；当前 v3 还需执行[笛谱补充与审计](mhp2g-horn-performance.md#构建与保留范围)。以下输出目录已存在；重建时选新的私有目录，不覆盖当前交付。构建器在临时目录追加、核验后原子发布；任何指纹、身份、材料、端点或旧用途错误都会拒绝发布。原有业务表、schema、译名及来源记录由审计器与完整基线逐项比较。

```bash
node tools/build_mhp2g_weapon_catalog.mjs \
  --base ../research/generated/mh-save-edit/mhp2g/weapon-ui-verification-v1/runtime-backup/mhp2g-original.sqlite \
  --base-sha256 439e769eb5b8e78174d0ceba7b571bc5a9343e25e6da982af345af5c147d6356 \
  --review ../research/mhp2g/weapon-catalog-v1/native-review-20261012 \
  --pilot ../research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite \
  --localization ../research/generated/mh-save-edit/mhp2g/localization-v4/localization.json \
  --name-review ../research/mhp2g/weapon-name-review-v1/names.json \
  --output ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v2

node tools/audit_mhp2g_weapons.mjs \
  --database ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v2/mhp2g.sqlite \
  --base ../research/generated/mh-save-edit/mhp2g/weapon-ui-verification-v1/runtime-backup/mhp2g-original.sqlite \
  --review ../research/mhp2g/weapon-catalog-v1/native-review-20261012 \
  --pilot ../research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite \
  --localization ../research/generated/mh-save-edit/mhp2g/localization-v4/localization.json \
  --name-review ../research/mhp2g/weapon-name-review-v1/names.json \
  --assets ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v2/assets

node tools/verify_mhp2g_weapon_runtime.mjs \
  --database ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v2/mhp2g.sqlite \
  --assets ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v2/assets \
  --output .runtime-assets/p2g-weapon-work/queries-v2
```

## 页面与验收

共享 [WeaponCatalogPage](../ui/pages/WeaponCatalogPage/WeaponCatalogPage.tsx)已开放 P2G 入口：搜索、筛选、图鉴编号排序、其他数值排序、分页、URL 恢复、列表／派生、命中导航、平移缩放及小地图均可用。同类型选择只请求详情，不重新查询列表或整棵派生。材料命中超过 100 条时读取全部命中页，不只用第一页高亮派生节点。默认不勾选生产筛选代表不限制生产能力，避免把未勾选误解释为排除可生产武器。

共同的核心属性、斩味、图标和关系组件继续复用；[分组配方](../ui/components/P2gWeaponRecipeList/P2gWeaponRecipeList.tsx)、[本作远程详情](../ui/components/P2gRangedDetail/P2gRangedDetail.tsx)和[本作笛谱](../ui/components/P2gHuntingHornDetail/P2gHuntingHornDetail.tsx)各自负责契约确有差异的内容及样式。会心明确标为原始值，P2G 不显示觉醒和占位筛选；后续存档接入后已提供共享装备写入控制。弹药、瓶、制作材料和派生武器均有一级关联入口。

105 项不同回归测试通过（12 个文件，分轮记录），涵盖构建、只读查询、schema、真实 IPC 分发、现有三作武器与动作值、P2G 道具／技能／装饰品兼容及新增 UI。新增 UI 验证身份边界、URL、分页、不重复查询、跨类定位、替代材料分组、抽屉关闭后定位、键盘焦点、两段弓和不可用弹种。`pnpm typecheck`、`pnpm build` 通过。

真实库全量验证了 1,501 个详情、1,776 个配方关联、6,053 个材料端点、660 个材料道具详情、11 类可布局派生、769 个最终形态和全部特殊关联。来源审计保留 20 张原有业务表，88 个图标哈希通过。初次武器构建的重复产物逐字节一致；后续译名版本通过新旧逐字段比对，只有名称与构建来源发生预期变化。安装前后其余三作数据库哈希不变。

Chromium 的 46 个场景通过，覆盖现有三作基线与 P2G 全部 11 类派生、专属详情、材料抽屉、往返边和跨类定位；另外 3 个最终场景验证 124 条材料派生命中、720px 窄窗口及抽屉键盘／主页面位置。窄窗口验收发现工作区固定侧栏遮挡正文，已在 GameShell 布局留出侧栏位置；抽屉对折叠配方的 summary 保持可达，关闭返回触发按钮。浏览器使用生产构建和本地只读查询适配器，不能替代完整 Electron 存档验收。

弩标签及瓶掩码可复核：

```bash
python3 tools/audit_mhp2g_weapon_display.py \
  --research-root ../research/mhp2g \
  --output .runtime-assets/p2g-weapon-display-audit.json
```

此前还核对 615 把武器的属性，613 项一致；两项独立资料差异保持原生值，没有用 Wiki 覆盖游戏数据。

私有页面、显示核查、查询、测试与安装记录归档在 `../research/generated/mh-save-edit/mhp2g/weapon-ui-verification-v1/`，原先数据验收继续保留在 `weapon-verification-v1/`。工作副本位于已忽略的 `.runtime-assets/p2g-weapon-ui/`。数据库及内容哈希图标只安装到已忽略本地路径，没有提交、推送、发布或扩展 P2G 运行资产授权。

译名补齐验收：7 个相关测试文件共 86 项通过（最终按文件复核），类型检查和应用构建通过。首轮全套测试中的音符颜色令牌及旧占位入口断言已修正；自动任务历史测试等待实际异步结果，保留全部业务断言。完整来源审计、运行查询和新旧逐字段比较通过：只有 785 条 `nameCn` / `nameSource` 及武器构建来源变化，schema、原有业务表、日文、数值、图标、材料和派生关系一致，另外三作数据库哈希不变。1,501 次中文及 1,501 次日文搜索、3,752 个关联名称、42 种旋律标签和三种炮击类型通过。Chromium 的 20 个新增场景覆盖截图条目、11 类名称、双语搜索、派生、标签、材料抽屉及窄窗口；报告及安装前备份归档在 `../research/generated/mh-save-edit/mhp2g/weapon-localization-verification-v1/`。这些浏览器检查使用本地只读适配器；未宣称完整 Electron 存档或全套测试最终重新验收。

笛谱缺项已按用户要求补齐并本地安装，新增 94 项相关回归、全量查询与 42 个浏览器场景通过，见[本轮验收](mhp2g-horn-performance.md)。完整防具随后已实现；[存档装备写入](mhp2g-save-editor.md)和[配装](mhp2g-loadout.md)也已接入，长篇说明译文及未展示的制造解锁语义仍是独立未完成范围。只读图鉴能力完成不等于全部武器研究或完整游戏中文补丁完成。
