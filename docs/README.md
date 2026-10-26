# 使用说明与技术参考

`docs` 保存长期使用的操作说明、数据契约、构建方法和版本说明。计划、交接、接入前核查及阶段验收统一放在 [plan](../plan/README.md)；当前接手入口为 [P3 技能交接](../plan/mhp3-skill-catalog/handoff.md)，P2G 历史记录见[归档索引](../plan/archive/2026-10-24/mhp2g-records/README.md)。

## 按用途阅读

| 用途 | 入口 |
| --- | --- |
| P2G 插件安装、测试、图鉴、配装与存档说明 | [P2G 文档](mhp2g/README.md) |
| P3 技能、发动效果、最小防具与护石来源 | [P3 技能图鉴](mhp3/skill-catalog.md) |
| P3 装饰品、技能点与材料关联 | [P3 装饰品图鉴](mhp3/decoration-catalog.md) |
| P3 道具使用、数据契约与离线构建 | [P3 道具图鉴](mhp3/item-catalog.md) |
| 道具译名、旧称搜索与词典构建 | [道具译名词典](item-terminology.md) |
| 怪物名称、身份与旧名搜索规则 | [怪物名称](monster-naming.md) |
| GU 配装搜索与运行资料准备 | [GU 搜索](gu-loadout-search.md) |
| MH4G 护石证据层级与准备方法 | [MH4G 护石](mh4g-charm-evidence.md) |
| 已发布版本说明 | [releases](releases/) |

## 文档存放约定

- 新交接放在 `plan/<专题>/handoff.md`，与该专题计划放在一起；统一从计划索引导航。
- 完成后的计划、阶段调查和验收记录放入 `plan/archive/<日期>/`，保留原日期、证据和未确认边界。
- 技术文档按用途或作品归类；阶段进度与交付日志移入对应计划，技术说明只链接这些记录。
- 文档迁移同步修正仓库链接和脚本引用；Release 说明保留在 `docs/releases/`，私有研究产物继续留在研究区。
