# MHGU/XX 猎猫图鉴

Status: 已归档
归档日期：2026-10-10
责任归属：项目维护者；后续由社区按需参考

归档结论：猎猫四页图鉴首版及原生数值/解锁条件完成，后续证据升级停止排期。

保留边界：配信来源升级和猎猫存档真实样本扩充未继续推进。

复核依据：原文验收记录及 [Repository](../../../tests/palicoCatalogRepository.test.ts)、[UI](../../../tests/palicoCatalogUi.test.tsx) 回归。

> 用户于 2026-10-10 决定将全部旧计划归档，未做的后续工作不再继续排期。以下为历史方案与原始勾选记录；未实施或未验收项保持原状，不记作完成。当前维护方向见[归档索引](../../README.md)与[项目 README](../../../README.md)，发布边界以[现行约定](../../../AGENTS.md)为准。代码、研究路径和命令按项目根目录或原说明解释。

## 归档前记录

状态：第一版已实现；原生数值与解锁条件已补齐并通过私有数据构建（2026-09-11）
适用内容库：仅 `mhgu`（同时服务 MHGU Switch 与 MHXX 3DS）

## 1. 已完成范围

新增独立“猎猫”导航组及四个离线页面：

```text
猎猫
├─ 支援倾向
├─ 支援行动
├─ 随从技能
└─ 猫装备
```

当前固定快照包含：

| 数据域 | 数量 |
| --- | ---: |
| 支援倾向 | 8 |
| 有效支援行动 | 56 |
| 有效随从技能 | 95 |
| 猫武器 | 508 |
| 猫防具 | 1024（头部 501、身体 523） |
| 武器制作材料关系 | 1018 |
| 防具制作材料关系 | 1769 |

本轮只展示列表小图标和数值，不处理模型、大图、装备外观预览、试穿、猎猫动作值、猎猫配装器或存档写入。

## 2. 数据构建与边界

新增命令：

```bash
pnpm data:extract:palicoes -- --research-root ../research \
  --resident <MHGU resident.arc> \
  --resident-cn <MHGU resident_chS.arc> \
  --resident-xx <MHXX resident.arc> \
  --support-en <spt_act_base_eng.gmd>
pnpm data:build:palicoes -- --research-root ../research --install-local
pnpm data:audit:palicoes -- --research-root ../research
```

`--install-local` 在私有构建通过后把固定快照同步到项目已忽略的 `data/mhgu.sqlite`，供本地应用实际读取；省略该参数时只更新 `research/generated`，不会改动应用当前使用的本地库。

构建器从固定 Dex、GU/XX 原生表、三语 GMD 和已归档的参考资料生成：

- `catalog_palico_types`
- `catalog_palico_type_support_moves`
- `catalog_palico_type_skills`
- `catalog_palico_support_moves`
- `catalog_palico_support_move_unlocks`
- `catalog_palico_skills`
- `catalog_palico_skill_unlocks`
- `catalog_palico_weapons` / `catalog_palico_weapon_materials`
- `catalog_palico_armors` / `catalog_palico_armor_materials`
- `catalog_palico_sources`

装备保存 Dex ID、原生/存档 ID 和应用身份的显式映射；制作材料全部落到稳定道具 `saveId`。猫防具只按头部、身体两类独立浏览，不再构造或展示产品价值有限且容易产生错配观感的套装系列。

猫装备图标复用 `Wpn_21xx/Wpn_22xx` 和 `Amr_11xx/Amr_12xx`，44 个分类图标覆盖 508 件武器与 1024 件防具。猫武器 `Sharp_ID=2～7` 使用橙、黄、绿、蓝、白、紫的紧凑等级标记，不伪造成猎人武器的分段斩味长度。

真实 SQLite、GMD、Wiki/参考快照、图标、manifest、crosswalk 和审计报告只保存在 `research` 或项目已忽略目录，不进入公开 Git 历史。

## 3. 原生能力参数与解锁条件

此前缺失的字段已经定位到 MHGU/MHXX 的 `resident.arc`，不再以空值展示：

- `otomo/support/spt_act_base`：58 条、每条 24 字节；提供支援槽消耗和 `UnlockMonsterID`。
- `otomo/ot_skl`：96 条、每条 11 字节；提供记忆槽、学习等级和原生技能分类。
- `spt_act_base_chS/eng/jpn.gmd`：提供支援行动三语名称与说明。

GU 与 XX 的 `spt_act_base`、`ot_skl` 已逐字节验证一致。56 个有效行动全部具有明确解锁状态：44 个原生非零索引映射为“狩猎怪物”，8 个为倾向固有，4 个为初始可用；原生解锁索引恰好为不重复的 1～44。具体怪物使用固定 Axibug revision 对照并映射到稳定 `catalog_monsters.monster_id`，构建时同时校验行动 ID、原生索引、怪物 ID 和名称，禁止名称相似度临时关联。

95 个有效技能全部具有明确解锁状态：48 个按原生 `LearnLevel` 显示等级条件，4 个零级倾向固有技能显示初始习得，43 个零级特殊技能显示“配信随从携带，可通过传授获得”并标记 `Wiki 资料`。记忆槽和学习等级均直接读取原生 `ot_skl`，不再依赖社区 CSV 空字段。

页面会显示条件类型、完整条件文字与证据状态；怪物条件可点击打开一级怪物详情抽屉。行动/技能说明、消耗、记忆槽和等级均已闭合，不再显示“未收录独立解锁条件”。

行动与技能的 A/B/C 随机分组已经改为直接解析 GU/XX 原生 `otSupportIni1pt/2pt/3pt.otil` 和 `otSkillIni1pt/2pt/3pt.otil`，并逐项验证两版内容一致。原生池只覆盖 39/56 个行动和 36/95 个技能；其余条目是基础固定、倾向固有或特殊/配信内容，本来不参与随机 A/B/C 池，不属于解包缺失。页面明确显示“固定/特殊（不参与随机分组）”，并可独立筛选。

所有 ARC、GMD、Wiki HTML、显式 crosswalk、来源 manifest 和生成数据库继续只保存在 `research`；公开仓库仅保留解析器、schema、Repository、UI、合成测试和本文档。

## 4. Repository、IPC 与页面

主进程 Repository/IPC 提供倾向、行动、技能、武器、防具、套装及 facets 查询。所有输入由严格 Zod schema 校验，非 `mhgu` 游戏、越界 ID、超长查询和额外字段直接拒绝；renderer 不接触 SQL 或研究目录。

页面行为：

- 中、英、日名称、说明及十进制/十六进制 ID 搜索。
- 行动按倾向与 A/B/C 组筛选；存在权威 facets 时再开放消耗筛选。
- 技能按 A/B/C 组、记忆槽、学习等级与明确解锁方式筛选。
- 猫装备默认武器，并可切换武器/防具；防具按头部、身体筛选，装备支持稀有度、攻击类型、特化、属性/异常、斩味、部位和数值排序。
- 武器与防具最多每页 100 条；行动与技能最多 100 条。
- 左右主从区、表格和详情各自内部滚动，窄窗口切换上下布局；所有下拉使用 `SearchableSelect`。
- 列表与标签支持 roving tabindex、方向键、Home/End；URL 保存筛选、排序、分页、选中项和一级抽屉状态。
- 选中记录时保留旧详情，并用请求序号忽略过期响应；旧 `view=set` URL 自动回退到武器模式。

## 5. 一级抽屉

- 支援倾向正文点击行动，打开支援行动详情抽屉。
- 行动/技能正文点击解锁怪物，打开怪物详情抽屉。
- 猫装备正文点击制作材料，打开道具详情抽屉。
- 道具正文中的猫武器/猫防具用途带稳定身份打开猫装备详情抽屉。
- 抽屉内再次点击关联对象时先关闭当前抽屉，再跳转相应图鉴并携带目标参数；页面始终只有一个活动抽屉。

## 6. 验收

- 连续两次构建的逐表逻辑 SHA-256、crosswalk 与来源映射一致；不以会受 SQLite 页布局影响的物理文件哈希冒充内容摘要。
- 数量、头部/身体、原生随机池 39/36 条分组、56/95 条解锁关系、原生解锁索引 1～44、1018/1769 条材料关系、图标覆盖、`Sharp_ID=2～7` 与外键检查全部通过。
- Repository 合成测试覆盖三语/十六进制搜索、随机/固定分组筛选、组合筛选、数值排序、材料和来源关系。
- UI 测试覆盖武器/防具模式方向键、列表键盘选择、URL 恢复、材料关系和非 MHGU 路由回退。
- `pnpm typecheck`、最多 2 workers 的完整 Vitest、Electron Vite build 与 `git diff --check` 通过；不启动开发服务器。
