# P2G 任务图鉴

已接入 450 个本体菜单任务、38 个 Wiki 活动任务和 14 个 Wiki 挑战任务。未纳入 101 个目录外任务资源；配信覆盖以固定 Wiki 快照为限。P2G 运行库已随独立运行资源和 Windows 应用包交付，研究输入仍保持私有。

## 来源、身份与译文

调查方法与原生调用链见[接入核查](../../plan/archive/2026-10-24/mhp2g-records/quest-preflight.md)。冻结输入位于工作区相邻的 `research/mhp2g/quest-catalog-v1/input/`，包含只读原库、输入 manifest、原生调查及 Wiki 快照。构建不访问宿主机。

本体身份为 `mhp2g:q<原生ID>`，配信身份为 `wiki:<页>:<表>:<行>`。配信不编造原生 ID。按日文和上下文确定身份，审阅过的 GU 官汉优先；不复制 GU 数值或关系。1,343 个去重文本单元及 52 条配信补充说明已经审校，原文、译文、审阅来源和输入哈希保存在私有研究区。

## 数据行为

- 747 组／4,917 条本体奖励按原组序保存；443 个基本组首项保证以正常成功结算为前提。概率显示每抽权重，不能当作整场获得率。
- 7,470 条支给配置逐格保留，不合并成一次交付数量。Wiki 缺少的数量、概率及支给资料为 `null`，页面显示“未收录”。
- 540 条大型配置、29 项大型依次出场、67 条小型切组条件及两项金狮子等待规则独立表达，不把配置总数当作同时出场数。
- 条件树保留 AND／OR／否定、旧档继承、介绍事件和训练语义。训练的任一武器完成与承接后返回分别表达。普通菜单无额外限制不代表已经达到可接进度。
- 77 个关键、21 个紧急与两项关键前置分别保存。最终紧急任务的普通菜单隐藏规则与紧急入口分开说明。
- 601 条旧怪物出没记录全部保留，包括重复个体数值和来源。共用怪物页或来源个体差异附说明，不覆盖任务配置；1,534 条旧道具来源保留显式对照。1,049 个旧 Wiki 引用可解析。

## 架构与交互

`prepare_mhp2g_quests.py` 核对冻结输入与审校表，生成私有 evidence；`build_mhp2g_quest_catalog.mjs` 从道具＋怪物库复制并追加 `p2g_quest*` 表。原有道具、怪物表和词典绑定不变。输出有独立任务 schema、能力标记与构建指纹，验证失败不发布半成品或覆盖旧目录。

`P2gQuestCatalogRepository` 独立实现搜索、筛选、详情和旧键解析，由共享 IPC 分派。身份 schema 拒绝跨游戏任务键，奖励和支给关系使用完整 `ItemIdentity`，P2G 使用 `itemId`。旧 P2G 库缺少任务表时只提示安装任务资料，道具与怪物仍可查询。

复用任务列表、分页和三个详情页签；P2G 委托、条件、出场、个体数值和支给组件分别拥有 TSX/CSS。正文关联打开一级抽屉，抽屉中的关联关闭后跳转定位；任务抽屉通过 portal 展示。搜索包含中日文名称、ID、目标、地图、怪物、报酬／支给道具、关联任务及命中原因；道具与怪物可按任务名反查。

## 重建与审计

以下示例在项目根目录执行。输入必须是完整的私有冻结快照，输出目录必须不存在；公开仓库不提供研究数据。

```bash
python3 tools/prepare_mhp2g_quests.py \
  --input ../research/mhp2g/quest-catalog-v1/input \
  --review ../research/mhp2g/quest-catalog-v1/text-review-v1.json \
  --wiki-notes ../research/mhp2g/quest-catalog-v1/wiki-notes-v1.json \
  --decisions ../research/mhp2g/quest-catalog-v1/migration-decisions-v1.json \
  --output /path/to/new-private-evidence.json

node tools/build_mhp2g_quest_catalog.mjs \
  --base ../research/mhp2g/quest-catalog-v1/input/base.sqlite \
  --evidence /path/to/new-private-evidence.json \
  --output /path/to/new-private-output

node tools/audit_mhp2g_quests.mjs \
  --database /path/to/new-private-output/mhp2g.sqlite \
  --base ../research/mhp2g/quest-catalog-v1/input/base.sqlite
```

公开测试仅使用合成资料。运行相关 `mhp2gQuest*`、`mhp2gCatalog*`、`questCatalog*`、怪物和道具 schema/UI 测试，以及 `python3 tests/mhp2gQuestConditions.test.py`、`pnpm typecheck`、`pnpm build`。

## 本地安装与回退

验收后已原子安装至 `data/mhp2g.sqlite`，未关闭应用。已经打开的数据库连接在下次启动时加载新库。

正式产物：`../research/generated/mh-save-edit/mhp2g/catalog-quests-v1/`。旧库备份：该目录下 `backup/mhp2g.sqlite`。`manifest.json` 和 `installation.json` 记录新旧哈希；回退时校验备份后，以同目录临时文件原子替换运行库，再由用户重启应用。不得向存在写入 WAL／journal 的运行库直接覆盖。

实现和发行历史见[归档计划](../../plan/archive/2026-10-24/mhp2g-quest-catalog/README.md)。本图鉴说明静态条件，不包含存档解锁修改或实时可接判断；后续资料追加须保留已有任务与关系。
