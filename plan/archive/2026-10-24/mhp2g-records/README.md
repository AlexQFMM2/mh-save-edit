# P2G 交接、前置核查与验收记录

文档角色：已归档阶段记录索引。整理日期：2026-10-24。责任归属：项目维护者。

这些文件从 `docs` 移入，保留原日期、实现范围、用户反馈、证据入口和未知项。它们是[已归档 P2G 计划](../README.md)的附属记录，不构成新的执行队列。日常使用及构建方法见 [P2G 技术文档](../../../../docs/mhp2g/README.md)，当前新作工作见 [P3 交接](../../../mhp3-investigation/handoff.md)。

## 验收与阶段交接

| 内容 | 记录 |
| --- | --- |
| 整体交付与用户实测 | [验收记录](acceptance.md) |
| 技能、装饰品收尾与装备阶段入口 | [装饰品交接](decoration-handoff.md) |
| 武器、防具完成时的输入与恢复点 | [装备交接](equipment-handoff.md) |
| 六槽配装范围、接口与验收 | [配装交接](loadout-handoff.md) |
| 中文资料检查点、覆盖快照与验收 | [本地化阶段记录](localization-history.md) |
| 装饰品译名复核与交付 | [命名复核](decoration-naming.md) |
| 奇怪龙命名修订、本地库与插件包 | [命名交付](monster-naming-delivery.md) |

## 接入前核查

| 内容 | 记录 |
| --- | --- |
| 技能、任务与防具 | [技能](skill-preflight.md)、[任务](quest-preflight.md)、[防具](armor-preflight.md) |
| 武器原生消费者与页面差距 | [原生核查](weapon-native-review.md)、[页面对照](weapon-page-parity.md) |
| 配装与存档 | [配装核查](loadout-preflight.md)、[存档核查](save-preflight.md) |
| 独立中文补丁与字库路线 | [可行性调查](chinese-patch-feasibility.md) |

## 阅读边界

历史“当前”“下一步”“未发布”“待验收”均按各自日期理解。2026-10-24 用户补记的任务、保存重开与插件停用／恢复通过，记录在整体验收和中文补丁计划顶部；未确认覆盖及完整技术矩阵仍保留，不因迁移变成已完成。代码命令和行内私有路径以仓库根为基准，Markdown 链接已按新目录调整。

原始游戏、数据库、译文集合、manifest、审计报告和个人存档没有随文档迁移进入 Git。旧文档路径不另留重定向副本，仓库引用统一指向本目录或长期技术参考。
