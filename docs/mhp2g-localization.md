# P2G 图鉴与中文资料

2026-10-10 确定的方向：先完成 P2G 道具、装饰珠、技能、武器、防具等图鉴，再制作覆盖整个游戏的中文补丁。两者共用 P2G 原文与译名资料。三个已支持游戏继续独立维护，不恢复跨游戏业务表重构。

2026-10-12 交接更新：道具、怪物和任务图鉴已本地接入，下一步为[装饰品图鉴](mhp2g-decoration-handoff.md)。下文构建命令保留道具与译名阶段的重建方法；后续追加装饰品须以最新含任务的运行库副本为基线，不能用旧阶段产物覆盖当前库。

## 名称与数据的责任

- 以核对过版本和哈希的日版 ISO 文本为原文；旧汉化仅保留搜索别名。
- 按对象类型和日文原名找 GU 对应词，官方简中必须有逐条来源证据。只容许拉丁字母、数字全半角差异；等级、圈号、标点、大小、亚种和装备类型不得自动忽略。唯一的珠名例外见下条，属于名称用词对照，不参与物品身份合并。
- 没有直接对应的词由项目单独翻译，来源显示“项目译名”，不能称为 P2G 官方汉化；尚未翻译的显示日文原文。按 2026-10-10 用户要求，“待验收”“待审校”等内部状态不进入用户界面；底层来源和审校记录保留，供后续追溯修订。
- 已由原生记录哈希确认为装饰珠的 P2G 道具，允许对应 GU 的同日文珠名加 `【1】/【2】/【3】`。仅当各候选的日中孔位后缀一致、去后缀的官方中文完全一致时采用，并标为“GU 官方用词（省略孔位后缀）”；不同中文、孔位语言不一致、普通道具或其他对象类型都不能套用此规则。保留所有 GU 证据词条 ID，但 P2G 仍是独立道具，不复制孔位和技能点。弹药等级前缀不使用该规则。
- 数值、技能效果、配方、强化、原生编号和存档映射归 P2G 自己。名称对应不授权复制 GU 的效果或说明。
- 图鉴直接保存选定的名称。可选词典负责旧称搜索与来源说明；卸载词典不会让 P2G 退回旧汉化。

## 已完成与未完成

日版 `ULJM05500 / 1.01` 已核对 ISO 哈希、资源目录、文本指针及原生道具行哈希。日版 BOOT 与已有数值研究快照一致，1,261 条道具的原生数值记录逐条一致。私有研究区只保留所需文本、索引和证据，没有复制 ISO、可执行文件或原始资源包。

当前翻译输入覆盖下列记录，计数包含原生占位记录：

| 模块 | 原生记录 | GU 中文对应 | 项目初稿 | 中文待审校 |
| --- | ---: | ---: | ---: | ---: |
| 道具名称 | 1,261 | 717 | 544 | 0 |
| 道具说明 | 1,261 | 0 | 146 | 1,115 |
| 武器名称 | 1,504 | 716 | 0 | 788 |
| 防具名称 | 2,096 | 1,247 | 0 | 849 |
| 技能系统名称 | 99 | 78 | 0 | 21 |
| 发动技能名称观察 | 218 | 115 | 0 | 103 |

道具中文初稿含 1 个默认隐藏的占位项，正常条目中的初稿为 543 件。717 件采用 GU 中文的记录中，648 件为完整日文对应，69 件为共通珠名用词对应。最后 146 件名称（145 件寻宝道具及 1 件用途未确认记录）已按日文原名、说明和共通用词补齐项目初稿，同时翻译其说明。1,260 件正常道具已有中文显示名；表中初稿与审校计数保留为内部资料状态，后续按反馈修订，界面不据此显示验收提示。用途未确认的记录不因完成翻译而变成可获取或可写入存档的道具。

道具的完整日文名称与说明已经进入本地构建。146 条中文说明可通过“查看日文说明”展开原文；其余 1,115 条（含占位项）显示 P2G 原文，界面标为“日文说明”，不继续采用旧汉化说明。原文和译文的控制码保留在资料中，详情展示时隐藏颜色指令，为未来游戏补丁保留原始输入。武器/防具的名称与 3,600 条说明绑定、技能名称已经准备为后续输入，**尚未完成装备、装饰珠、技能页面接入**。技能名称观察编号不是已确认的发动技能运行编号，也不证明阈值或效果。

装备后续仍需完成：独有名称/说明审校、装备图标映射、适用身份及数值解释、材料与强化端点、图鉴查询适配和一级详情抽屉。已有研究里的斩味模板不能直接当成实际斩味长度；弹药模板容量不代表武器可装填；存档编号仍待单独核实。核对这些证据后再接界面，不能给原生编号贴上 Dex ID 或存档 ID。

## 构建与验收

私有固定输入：

- `research/mhp2g/japanese-catalog-v1/texts.json`：日版文本表 0–17、原生行哈希、ISO/文本容器证据。同目录保留 manifest 和只读提取器。
- `research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite`：已审计数值、关系与文本索引，不作为选定中文的来源。
- `research/generated/mh-save-edit/terminology/versions/gu-pass-02/`：逐条验证官方中文的采用证据。
- `research/mhp2g/localization-review-v3/items.json`：项目译名与说明初审，逐条记录原文、中文与上下文依据。

从仓库根目录运行，输出必须是不存在的新目录：

```bash
node tools/prepare_mhp2g_localization.mjs \
  ../research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite \
  ../research/mhp2g/japanese-catalog-v1/texts.json \
  ../research/generated/mh-save-edit/terminology/versions/gu-pass-02 \
  /private/new-localization \
  ../research/mhp2g/localization-review-v3/items.json

node tools/build_mhp2g_catalog.mjs \
  --output /private/new-catalog \
  --icons ../research/generated/mh-save-edit/mhp2g/icons-v1/manifest.json \
  --localization /private/new-localization/localization.json

node tools/audit_mhp2g_catalog.mjs --delivery /private/new-catalog
```

`localization.json` 的 `units` 按原生文本表/索引保存原文、选定中文、状态与依据；`bindings` 把本作物品/装备/技能身份指向原生文本键。不同装备共用说明时只维护一份翻译。`review-queue.json` 汇总待翻译项。译名改变只能更新对应文本单元，不能重排本作身份。控制码发生变化、原文与审校记录不一致、引用丢失、官方中文冲突、来源哈希改变时中止构建。

道具库中的 `catalog_item_localization` 保留旧称与说明来源，属于图鉴的可追溯资料。更新词典时，以新 P2G 图鉴和另外三作当前副本为输入，运行 `tools/build_item_terminology.mjs`；**不要再给这套日版构建附加旧 Wiki 日文补丁**。测试通过后备份并成套替换 P2G 图鉴与词典，用户自行重启应用后生效，不自动关闭已有会话。

本轮生成目录为 `mhp2g/localization-v4`、`mhp2g/catalog-japanese-v4` 和 `item-terminology/v6`，均在 `research/generated/mh-save-edit/` 下。旧版本保留用于追溯。完整离线运行检查：

```bash
node tools/verify_mhp2g_runtime.mjs \
  .runtime-assets/p2g-japanese-v4-check \
  --delivery ../research/generated/mh-save-edit/mhp2g/catalog-japanese-v4
```

检查会逐条读取所有道具、图标及关联端点；若 SQLite 复制导致文件哈希变化，则逐表及逐 schema 比对已审计构建，不以“改过翻译”为理由跳过数值检查。合成测试在 `tests/mhp2gLocalization.test.mjs`，真实资料验收结果只进入本地忽略目录。

## 游戏补丁放在最后

完整游戏补丁的目标已确认，但当前没有补丁安装器、输出 ISO 或“游戏内中文完成”的交付。后续复用已验收的文本单元，另外处理菜单、任务、对话、字体、排版、资源容量、重新封装及 PPSSPP 游戏内验收。图鉴能显示中文并不证明游戏能正确渲染或保存补丁。

原始游戏、Dex、文本与审校输入、数据库和报告仍在私有研究区；仓库仅保存构建代码、合成测试和文档。本轮没有执行 GitHub 推送或 Release。

日版输入初次接入验证：28 项相关合成测试、类型检查和应用构建通过；全量读取 1,261 个道具、688 个关联道具端点、20,771 个待接图鉴对象，校验图标哈希。3G/4G/GU 全部表和 schema 与更新前一致。独立 Electron 会话的 16 项检查通过，覆盖四作别名/日文搜索、P2G 初稿/待翻译状态、无浏览器异常及资源失败，并检查 1366×768、3440×1440、1024×768、600×768 的词典布局。检查报告在 `.runtime-assets/item-terminology/electron-check-v4` 和 `.runtime-assets/p2g-japanese-check`；安装前成套备份在 `.runtime-assets/item-terminology/pre-v4`。

共通珠名后续修正：16 项相关测试、类型检查和构建通过，补测普通道具不套用珠名规则、不同中文拒绝合并、日中孔位不一致时保留待核对，以及词典保留 P2G 身份。全量比对仅 69 条名称来源/状态变化；所有名称、数值、说明和关系均未变化。独立 Electron 的 18 项检查通过，包含截图所示“闪避珠”的来源提示与本作编号。新报告在 `.runtime-assets/item-terminology/electron-check-v5`、`.runtime-assets/p2g-japanese-v3-check`，成套备份在 `.runtime-assets/item-terminology/pre-v5`。

剩余道具译文补齐：21 项相关测试、类型检查和构建通过；147 件名称变化包含 146 件新增译名及 1 件村名用词修正，另有 146 条说明和 21 条调合显示标签更新。所有道具编号、数值、日文、图标、关系端点与机制不变，说明控制码保持一致；3G/4G/GU 数据库未改动。独立 Electron 的 25 项检查通过，逐项验证这 146 件的新中文、日文和旧译名搜索，检查中文说明、日文展开及切换道具后收起，并覆盖 1366×768、3440×1440 下的详情显示。安装后再次全量读取 1,261 个道具、688 个关联道具端点及 20,771 个待接图鉴对象，通过图标哈希和构建逐表比对。报告在 `.runtime-assets/item-terminology/electron-check-v6`、`.runtime-assets/p2g-japanese-v4-check`，成套备份在 `.runtime-assets/item-terminology/pre-v6`。
