# 使用说明与技术参考

`docs` 保存长期使用的操作说明、数据契约、构建方法和版本说明。新专题交接放在 `docs/handoffs/`。既有计划与验收见 [plan](../plan/README.md)，P2G 历史记录见[归档索引](../plan/archive/2026-10-24/mhp2g-records/README.md)。

## 按用途阅读

| 用途 | 入口 |
| --- | --- |
| release 基线、任务分支、审查、交接与发行入口 | [Git 工作流](development/git-workflow.md) |
| 原版解包、Dex、宿主机只读查询与冻结输入 | [资料读取说明](development/data-sources.md) |
| P2G 插件安装、测试、图鉴、配装与存档说明 | [P2G 文档](mhp2g/README.md) |
| P3 日版 PPSSPP 存档修改、本地安装与验收 | [P3 存档交接](handoffs/mhp3-save-editor/codex.md) |
| P3 配装器（计划与实施批次） | [P3 配装器交接](handoffs/mhp3-loadout-builder/codex.md) |
| P3 怪物、肉质、条件掉落、出没预览及构建恢复 | [P3 怪物图鉴](development/mhp3-monster-catalog.md) |
| P3 武器、派生、强化对照及离线构建 | [P3 武器图鉴](development/mhp3-weapon-catalog.md) |
| P3 防具、套装、制作、来源及离线构建 | [P3 防具图鉴](development/mhp3-armor-catalog.md) |
| P3 技能、发动效果、防具关联与护石来源 | [P3 技能图鉴](mhp3/skill-catalog.md) |
| P3 装饰品、技能点与材料关联 | [P3 装饰品图鉴](mhp3/decoration-catalog.md) |
| P3 道具使用、数据契约与离线构建 | [P3 道具图鉴](mhp3/item-catalog.md) |
| 道具译名、旧称搜索与词典构建 | [道具译名词典](item-terminology.md) |
| 怪物名称、身份与旧名搜索规则 | [怪物名称](monster-naming.md) |
| GU 配装搜索与运行资料准备 | [GU 搜索](gu-loadout-search.md) |
| MH4G 护石证据层级与准备方法 | [MH4G 护石](mh4g-charm-evidence.md) |
| 已发布版本说明 | [releases](releases/) |

## 文档存放约定

- 新交接放在 `docs/handoffs/<task-id>/<agent-name>.md`，与源码同分支保存。既有专题继续从计划索引进入。
- 完成后的计划、阶段调查和验收记录放入 `plan/archive/<日期>/`，保留原日期、证据和未确认边界。
- 技术文档按用途或作品归类；阶段进度与交付日志移入对应计划，技术说明只链接这些记录。
- 文档迁移同步修正仓库链接和脚本引用；Release 说明保留在 `docs/releases/`，私有研究产物继续留在研究区。
