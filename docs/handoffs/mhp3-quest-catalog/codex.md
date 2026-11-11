# P3 任务图鉴接手记录

## 当前恢复点：2026-11-11 原生续查

用户追加要求“继续探索，把阻碍都排除清”。本轮续接 `87ed9947f8b688bda27b1afa0ac9489948d71140`，仍在 `feat/mhp3-quest-catalog`，单代理、同一工作区。最新结果见[原生续查](native-followup.md)；下面前轮记录作为阶段证据保留，不覆盖本轮已解除的结构和身份疑点。

已确认331个本体菜单身份；本体参考crosswalk全部建立，598条旧出没观察全部有明确对应（包含多目标及聚合），另有52活动／14挑战的独立来源身份。正常目录奖励448组／3,252行、支给497组／6,442槽，共485个道具端点全部存在；出场结构与环境对象已分清。28个训练任务的52套配置与清单逐字节一致，参加人数与装备套数已区分。关键集合、紧急入口及温泉／饮料／演习的主要开放链已定位，三处参考冲突采用已验证原版依据。

**研究仍有明确未知项**：精确概率及全部加成、完整出场状态机／个体参数公式、少数统计与效果语义、训练特殊实例／评级点数、原生配信覆盖。已有参考值逐字段标来源，不能因采用静态说明就将原生机制验证记成完成。930个本体去重原文的中文审阅尚未开始；完整实施图纸、DB／API／UI和应用验收均未完成。

恢复先读私有 `../research/mhp3/quest-native-20261111/README.md`、`field-contract-v1.json`、`audit-v1.json`，再读专题契约与crosswalk。37次成功只读探针、2次失败及修正记录和全部派生脚本已保存；私有审计校验探针哈希、原有冻结输入、任务与关系端点，六运行库未变。训练中途错误的边界假设已明确否定并修正。原始程序／原文／完整表／实例保持私有。

下一批将已证实字段、独立来源及未收录状态落实到 DB → API → API验证 → UI → UI验证图纸；保留前轮确定的任务领域隔离、P3显式分派、`itemId`关联与单层抽屉要求。没有应用代码或运行资料变更，没有合入`release`、发布资产、Electron／Windows或游戏验收。本轮9份文档的196个本地链接目标、diff格式和公开资料边界自核通过；冻结清单及实际检查点以本文件后续Git记录和私有manifest为准；外部 `preparation-r1`仍不是已批准的完整实施计划。

## 前轮记录：2026-11-11 实现前排查

用户随后要求“参考 P2G，排查一下 P3 任务图鉴实现有哪些阻碍”。已完成对应只读调查，最新结论见[实现前核查](preflight.md)。原版可读，332 个封装的身份到资源加载映射已核实；12 份非空清单共 344 行、331 个身份，六段原文逐项一致，另有检查用途资源不纳入清单。训练记录差异、报酬／支给、条件和出场关系仍有明确待解项，不能把此次调查算作完整任务图鉴或实施图纸完成。

本轮源码核对点为 `2c80b3e`，此前准备检查点的 GitHub `check` 已成功。新增证据在 `../research/mhp3/quest-preflight-20261111/`，含 9 次成功只读探针、3 次失败及修正记录、8 页独立参考和 `audit-v1.json`。私有 `audit_preflight.py` 已通过，72 份研究文件纳入冻结清单，六份运行库与准备轮哈希一致；8 份文档的 199 个本地链接目标及 diff 格式检查通过。未改应用代码、运行资料或宿主机文件，未做 Electron／Windows／游戏验收。

工程须按任务领域增加 P3 身份与分派，并修正任务抽屉只识别 P2G `itemId` 的接入假设；共享页面可复用，不需先重构通用图鉴。下一步先补本作基础字段及报酬／支给契约，具体未完成项和证据入口见核查报告及私有 README。外部台账记录新增调查范围；初轮准备说明未重写，完整实施计划尚未定稿。

## 初轮准备记录：2026-11-11

用户要求“新建功能分支；准备接上 P3 任务这一条线”。本轮完成分支、已有证据和代码入口核查，保存后续接手点；完整任务图鉴尚未实施，实施图纸尚未定稿。

- 任务：`mhp3-quest-catalog`；执行者：Codex，单代理串行、当前唯一工作目录。
- 分支：`feat/mhp3-quest-catalog`；起点为已 fetch 并核对一致的本地／远端 `release`：`f3e4cce01ae0f73b20a4a8a4aadc39e44665e328`。
- 本轮检查点包含本文与导航更新；用 `git log -1 --format='%H %s' -- docs/handoffs/mhp3-quest-catalog/codex.md` 查实际提交，不把分支名当固定版本。接手仍须核对当前分支、HEAD、工作区及远端。
- 新专题外部材料（相对仓库根）：`../plan/mh-save-edit/mhp3-quest-catalog/`，修订 `preparation-r1`；这是准备记录，不是已批准的完整实施计划。
- 私有核查结果：`../test/mh-save-edit/mhp3-quest-catalog/preparation-20261111/baseline.json`。外部计划和结果不随 Git 推送备份；本文保留不依赖这些文件的恢复摘要。
- 仅准备任务线；没有修改应用代码、生成／安装运行资料、连接宿主机、合入 `release` 或发行。P3 资产仍限本地。

## 已核对的实际状态

前序 [P3 怪物交接](../../../plan/mhp3-monster-catalog/handoff.md)和[长期契约](../../development/mhp3-monster-catalog.md)是已完成基线。P3 道具、装饰品、技能、防具、武器、怪物已接入；旧探查中的“怪物未实现”等记录不是当前阻碍。

| 层次 | 当前事实 | 后续不能据此推定 |
| --- | --- | --- |
| 本地完整库 | `data/mhp3.sqlite` 有 65 条怪物、1,960 条掉落、598 条出没观察；没有任务表 | 出没观察不是完整任务记录，也不是 598 个独立任务 |
| 原生旧探针 | 332 个任务封装通过结构校验；候选身份字段在该样本中唯一 | 封装数不等于本体／活动／挑战全部可玩任务数量；候选字段尚待消费者确认 |
| 出没预览 | `P3MonsterAppearance.sourceKey` 标识独立资料观察，日文任务名可展示 | 不能把 sourceKey、名称或资料顺序转换成原生任务编号；小型怪物逐任务出没尚未收录 |
| 道具关联 | `P3ItemCatalogRepository` 的任务来源覆盖为 `not-collected` | 不能将空数组解释成“没有任务奖励” |
| API | `QuestIdentity`、筛选和 facets 仍使用排除 P3 的 `CatalogGameId`；任务 key 校验不接受 P3；IPC 只分 P2G／既有三作 | 不能仅放开路由或通用游戏类型，让 P3 落入其他作品 repository |
| UI | `ui/App.tsx` 未开放 P3 任务页；已有任务页、详情、筛选、分页及单层抽屉可作为复用入口 | 占位入口不是已接入能力 |

本轮只读核验的完整 P3 库 SHA-256：`e54e8037536f6ebc318517a0fa8eac6af49da26931dbbebf31ca86d2d6aec46a`。未来追加任务须从这份或经核实的更新完整库复制，保留已有六类图鉴；不能用早期道具／武器子集覆盖。

## 已核对的代码入口

| 职责 | 现有入口与下一阶段关注点 |
| --- | --- |
| 身份和契约 | `api/catalog/types.ts` 的 `QuestIdentity`、`QuestDetail`、`QuestCatalogFilters`；`api/catalog/schemas.ts` 的 `questKeySchema`、`questIdentitySchema`、`questCatalogFiltersSchema`。优先按任务领域扩展；具体 key 格式须等原生身份确认后确定 |
| 查询通道 | `api/catalog/ipc.ts` 的 `getQuest`／`searchQuests`／`getQuestFacets`；`desktop/preload.ts` 与 `ui/env.d.ts` 同步类型。P3 显式分派，只读访问本作库，保留缺模块错误 |
| 本作参考实现 | `api/catalog/p2gQuestRepository.ts`、`p2gQuestTypes.ts`、`p2gQuestLinks.ts`。复用接口与关系组织经验，P2G 二进制布局、条件和枚举不能直接套到 P3 |
| 共享页面 | `ui/pages/QuestCatalogPage/QuestCatalogPage.tsx`、`ui/components/QuestDetailPanel/QuestDetailPanel.tsx`、`QuestDetailDrawer`、`QuestCatalogToolbar`、`QuestList`；保留 URL、前进后退、选择不重查列表及一级抽屉规则 |
| 既有 P3 关系 | `api/catalog/p3MonsterRepository.ts`、`p3MonsterTypes.ts`、`p3ItemRepository.ts`；`ui/components/P3MonsterAppearances/P3MonsterAppearances.tsx` 与怪物页。将来新增已验证关联，保留无法绑定的独立观察 |
| 可参考验证 | `tests/mhp2gQuestCatalog.test.ts`、`tests/mhp2gQuestUi.test.tsx`、`tests/mhp2gQuestConditions.test.py`、`tests/mhp2gQuestBindings.test.mjs`、`tests/questCatalogSchemas.test.ts`、`tests/questCatalogRepository.test.ts`、`tests/questCatalogUi.test.tsx` |

上述为接入调查结果，尚未新增 P3 任务 schema、repository、构建器或测试，也不构成已冻结的实现设计。

## 下一步：原生任务身份与字段契约

1. 从私有 `../research/mhp3/native-investigation-20261023/` 的 `quest-deep-v1/`、`quest-probe-index.json`、`quest_deep_body.py` 和 `quest-deep-query.py` 续接。本轮复核这六个相关文件（含 query、result、run）与归档 manifest 的大小和 SHA-256 一致；旧查询成功返回。完整程序／容器仍在宿主机，不能将本地子集当作完整原版资源。
2. 需要补查宿主机时先读[资料读取说明](../../development/data-sources.md)，用 `ssh_admin --list`／`--connect` 获取当前登记入口；限定 P3 原版路径，按版本与哈希核对，进行只读小范围查询。不要复制历史 IP 或重新调查已解决的 EBOOT 解密问题。
3. 先沿任务加载／选择／文本消费者确认候选身份、封装成员和名称绑定，区分正常、特殊、活动／挑战和未识别记录。随后核对目标、地图、位阶、限制、报酬组与抽取语义、支给、解锁及关键／紧急条件；原生未解释项单列，独立资料按字段标来源。精确偏移、原始文本和 crosswalk 留私有研究区。
4. 建立任务 → 本作怪物／道具的显式关系，区分目标、非目标、乱入及替换／连续出现；验证全部端点及反查。名称相同、观察 sourceKey 相近均不构成映射依据；数量与概率、原始权重分别处理。
5. 在证据足够后完成任务领域 DB → API → API 验证 → UI → UI 验证的具体实施设计。优先复用共享页面和 P2G 专用区域模式；保持其他作品、配装和存档边界。若词典绑定输入不变，不重建扩展词典。

后续验证需覆盖跨作／混合／越界身份、缺任务模块、中文／日文／别名检索、关系双向查询、报酬组及未知项；真实资料 UI 检查 1440×900 与 1024×768。公开测试使用合成资料，完整审计与截图私有保存；Electron、本机浏览器、Windows 包和游戏验证分别记录。

## 本轮检查与交付边界

- 起点工作区干净，fetch 成功后核对本地和远端 `release` 同为上述 SHA，随后创建任务分支。
- 读取旧探针和只读 SQLite，核对 332 个封装及 598 条出没观察；六份运行库 SHA-256 保存于私有 baseline。没有生成资料或触碰运行库。
- 文档路径核对通过：8 份材料的 209 个本地链接目标存在；`git diff --check` 通过，六库哈希与本轮 baseline 一致。提交前再核对暂存路径和忽略规则，仅交接与导航属于本次源码检查点。
- 本轮没有运行应用测试或实机验收；前一轮 `release` 的测试结论不能算成 P3 任务功能通过。任务分支推送触发的 `check` 状态以对应提交的 GitHub Actions 为准，未完成前不写成通过。
- 本分支保留准备成果，按[Git 工作流](../../development/git-workflow.md)继续保存检查点；完整功能经审查和检查后才进入 `release`，公开 P3 资产仍须对应授权。
