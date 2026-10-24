# P2G 使用与开发参考

这里保存当前功能、数据与构建方法。执行进度、交接、前置调查和验收记录统一见 [P2G 计划归档](../../plan/archive/2026-10-24/README.md)及[阶段记录索引](../../plan/archive/2026-10-24/mhp2g-records/README.md)。

## 使用说明

| 内容 | 文档 |
| --- | --- |
| PPSSPP 中文插件安装、更新与停用 | [安装说明](chinese-patch-install.md) |
| 插件测试步骤与反馈格式 | [测试说明](chinese-patch-testing.md) |
| 存档读取、编辑、成对保存与恢复 | [存档编辑器](save-editor.md) |
| 六槽配装、装珠、自动搜索与任务历史 | [配装器](loadout.md) |

安装与测试文档同时作为组包模板，由 `tools/mhp2g/chinese-patch/package-release.py` 读取；其中版本占位符在生成发行包时填入。

## 数据与构建参考

| 内容 | 文档 |
| --- | --- |
| 原文、项目译名、词典与审阅输入 | [本地化](localization.md) |
| 武器、派生与笛谱 | [武器](weapon-catalog.md)、[笛谱](horn-performance.md) |
| 防具身份、套装、材料与数值 | [防具](armor-catalog.md) |
| 技能系统、发动和装饰品关系 | [技能](skill-catalog.md)、[装饰品](decoration-catalog.md) |
| 怪物、掉落和任务 | [怪物](monster-catalog.md)、[任务](quest-catalog.md) |
| 原生图标映射与转换方法 | [道具图标](item-icons.md)、[怪物图标](monster-icons.md) |

文档中的命令和行内研究路径以仓库根为基准。带版本号的固定输入、旧库和构建命令用于复现相应阶段；重建必须使用新输出目录，再按后续构建链补齐，不得以旧子集覆盖当前完整资料。实际交付与用户验收以计划归档为准，当前运行资源与源码的分发边界仍遵守根目录 AGENTS。
