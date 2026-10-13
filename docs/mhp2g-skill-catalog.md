# P2G 技能图鉴

2026-10-12 已完成本地实现、验收和安装。对应[实施计划](../plan/mhp2g-skill-catalog/README.md)；前期判断保留在[阻碍核查](mhp2g-skill-preflight.md)。本阶段只追加 P2G 技能资料，三作和词典库未改动。同日用户授权将技能、装饰品和列表刷新修复纳入一次本地提交，不推送、不创建 Release；下一步见[装备交接](mhp2g-equipment-handoff.md)。

2026-10-13 交接更新：[装饰品](mhp2g-decoration-catalog.md)、[武器](mhp2g-weapon-catalog.md)及[完整防具图鉴](mhp2g-armor-catalog.md)已接入，正常武器和防具名称已补齐。防具关联现在打开完整详情，正常目录覆盖 2,081 件、7,166 条防具技能点，排除训练专用记录；技能阶段原始表保持不变。以下构建与备份路径保留为技能阶段记录；最新完整基线为 `catalog-armor-v1`，见[当前交接](mhp2g-equipment-handoff.md)。

## 已接入范围

| 内容 | 已验收数量与规则 |
| --- | --- |
| 技能系统 | 99 个；78 个名称采用已核对的 GU 官汉，21 个使用项目译名 |
| 正常发动技能 | 213 条，其中 65 条负阈值；114 个名称采用 GU 官汉，99 个使用项目译名 |
| 特殊与复合规则 | 1 条胴系统倍加、7 个复合技能；特殊规则不伪造阈值 0 |
| 装备技能资料 | 2,096 条防具与 168 颗珠，7,461 条带符号技能点关系 |
| 珠资料 | 281 条技能点（113 条负数）、192 套配方、597 条材料 |

沿用共享技能列表、分页及详情，支持中文／日文名称、发动技能、效果、复合技能和关联装备搜索并显示命中原因，提供方向与装备来源筛选。P2G 无护石，相关入口隐藏。缺少技能表的旧库会显示安装资料提示，道具、怪物和任务继续可用。

技能正文点击复合技能或装备打开唯一一级详情抽屉；抽屉内再次点击技能或材料，先关闭后跳转定位。当前防具关联使用完整防具详情，技能抽屉中的防具关联直接定位防具图鉴；旧技能页 `skill` 与 `equipment` 参数仍兼容并可刷新恢复。

技能阶段首先提供的是**装备技能资料详情**；后续防具阶段已补齐正常目录、中文名称、图标、完整字段和配方，并覆盖查询显示。上表仍记录技能阶段原始输入计数（包含占位与训练记录），不代表当前正常防具目录计数。珠复用道具侧中文名、日文名、图标及 `itemId`；珠的稀有度、制造费用和解锁条件仍保持未收录。存档身份与配装属于独立后续工作。

## 来源与身份

日版文本键确定名称身份；GU 只提供逐项核对后的中文名称。发动阈值、效果说明和复合规则来自 P2G Wiki，页面保留来源，未宣称完成所有原生发动逻辑验证。中文效果按 P2G 语境审阅，未复制 GU 机制。

旧汉化序号 207 的“捕穫逹人”在干净日版文本键 `0:1113` 实为 `捕獲の見極め`，本次按日版与 Wiki 对应，中文采用已有 GU “捕获精通”。`斬れ味レベル-1`、`見切り-3`、`ガード性能-2`、`採取-2` 四条仅确认有原生名称，用途未确认，未加入正常目录；“スキル無し”哨兵同样排除。这些排除不等于证明文本已废弃。

技能使用 `{ gameId: 'mhp2g', skillId }`，装备技能资料使用 `{ gameId: 'mhp2g', equipmentKey }`；珠材料使用完整 `ItemIdentity` 和本作 `itemId`。发动技能文本序号不冒充 Dex 编号或存档编号。schema／IPC 拒绝非法跨游戏身份，由独立 [P2G 查询仓库](../api/catalog/p2gSkillRepository.ts) 分派。

正式固定输入为 `../research/mhp2g/skill-catalog-v1/`：`input/manifest.json` 记录 9 份输入的来源、大小和 SHA-256，包含任务库基线、日版文本、原生表／配方、Wiki 与既有译名；同目录保存 `review-v1.json`、`prepared-v1.json`、`baseline.json` 和冻结清单 `source-manifest.json`。真实输入及审阅映射均未进入 Git。构建和应用不访问宿主机。

## 重建与审计

以下命令从仓库根目录运行。替换 `/private/` 为自己的私有输出路径，文件和输出目录必须尚不存在。冻结的 `input/base.sqlite` 是技能追加前含任务的基线；不要改成已含技能表的运行库来重复追加。

```bash
python3 tools/prepare_mhp2g_skills.py \
  --input ../research/mhp2g/skill-catalog-v1/input \
  --review ../research/mhp2g/skill-catalog-v1/review-v1.json \
  --output /private/new-evidence.json

node tools/build_mhp2g_skill_catalog.mjs \
  --base ../research/mhp2g/skill-catalog-v1/input/base.sqlite \
  --evidence /private/new-evidence.json \
  --output /private/new-output

node tools/audit_mhp2g_skills.mjs \
  --database /private/new-output/mhp2g.sqlite \
  --base ../research/mhp2g/skill-catalog-v1/input/base.sqlite \
  --evidence /private/new-evidence.json
```

准备器逐条核查原生防具／珠孔位、技能点与 597 条材料字节；构建器从基线副本追加 `p2g_skills`、`p2g_skill_equipment`、`p2g_skill_points` 和搜索表，写入 `skill_schema`、能力标记及构建指纹。输出拒绝覆盖，审计成功才发布完整目录。审计对照全部证据与原有业务表，保留既有身份和词典绑定。

验收记录位于 `../research/generated/mh-save-edit/mhp2g/catalog-skills-v1/verification/`：

- 11 个测试文件、72 项不同测试通过；特殊规则列表文案调整后再次通过 13 项 UI 测试。覆盖构建错误输入、查询、身份、缺资料、异步响应、抽屉，以及三作技能、P2G 任务和 GU 狩技关联回归。
- `pnpm typecheck`、`pnpm build` 通过。真实库逐条读取 99 个技能、213 条发动和 2,244 个实际有技能的非占位装备端点；另有 5 个占位、15 个无技能装备资料记录。
- 两次正式构建数据库字节一致；既有 14 张业务表保持不变，502 个任务完整保留；三作与词典库哈希不变。
- Chromium 使用真实查询仓库，在 1366×768、1024×768、1024×680 检查列表、复合／装备抽屉、材料跳转及刷新恢复，正文位置不偏移、无运行异常。视觉检查后仅将特殊技能列表的计数显示改为“特殊”，该改动另经 UI 测试和最终构建验证。

## 本地安装与恢复

2026-10-12 已修复技能选择及详情页签切换重复触发列表查询的问题；待返回查询保留最新选择及 URL 参数。与装饰品等共享页面的回归、真实浏览器验收和证据入口见[列表刷新修复记录](mhp2g-decoration-catalog.md#2026-10-12-选择条目导致列表刷新的修复)。此次修复不修改技能数据库。

正式产物：`../research/generated/mh-save-edit/mhp2g/catalog-skills-v1/`。新库已原子安装到 `data/mhp2g.sqlite`，SHA-256：

```text
dd433764ece11664525fadf2bbb032183f04f42e1c234f019f6d0da2f8db6ffa
```

安装记录为正式产物中的 `installation.json`。安装前的含任务库保存在 `backup/mhp2g.sqlite`，SHA-256：

```text
038ade273f988662eb914239f1f45e920815f829b9bf1895414be102f7e27584
```

没有自动关闭应用；重启后加载新库。回退时先自行退出应用，核对备份哈希，将备份复制到运行库同目录的临时文件后原子替换 `data/mhp2g.sqlite`，再启动应用。回退后的技能页提示资料未安装，原有图鉴仍可用。后续装饰品必须以**最新含技能的完整库**为追加基线，并另做备份，不能覆盖为旧任务库。

数据库、图标、输入、审阅映射、清单和截图只保存在私有研究区或已忽略路径；P2G 未加入公开运行资产或 Windows 发布包。
