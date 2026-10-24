# P2G 原文、译名与构建

本文维护名称规则、来源契约和重建入口。阶段进度、覆盖快照与验收记录统一见[计划归档](../../plan/archive/2026-10-24/mhp2g-records/localization-history.md)，后续工作从[计划索引](../../plan/README.md)接手。命令均从仓库根执行，冻结旧版本用于复现，不得覆盖当前成套运行库。

## 名称与数据的责任

- 以核对过版本和哈希的日版 ISO 文本为原文；旧汉化仅保留搜索别名。
- 按对象类型和日文原名找 GU 对应词，官方简中必须有逐条来源证据。只容许拉丁字母、数字全半角差异；等级、圈号、标点、大小、亚种和装备类型不得自动忽略。唯一的珠名例外见下条，属于名称用词对照，不参与物品身份合并。
- 没有直接对应的词由项目单独翻译，来源显示“项目译名”，不能称为 P2G 官方汉化；尚未翻译的显示日文原文。按 2026-10-10 用户要求，“待验收”“待审校”等内部状态不进入用户界面；底层来源和审校记录保留，供后续追溯修订。
- 已由原生记录哈希确认为装饰珠的 P2G 道具，允许对应 GU 的同日文珠名加 `【1】/【2】/【3】`。仅当各候选的日中孔位后缀一致、去后缀的官方中文完全一致时采用，并标为“GU 官方用词（省略孔位后缀）”；不同中文、孔位语言不一致、普通道具或其他对象类型都不能套用此规则。保留所有 GU 证据词条 ID，但 P2G 仍是独立道具，不复制孔位和技能点。弹药等级前缀不使用该规则。
- 数值、技能效果、配方、强化、原生编号和存档映射归 P2G 自己。名称对应不授权复制 GU 的效果或说明。
- 2026-10-20 用户更新珠名方针：逐项核对本作身份、全部正负技能点和孔数后，可以采用后作易理解的根名；例如本作水耐性珠采用“耐水珠”。重复根名补 `【孔数】` 区分，旧中文与日文保留搜索。此类修改标为项目译名；日文技能树异名只能在说明已核对的命名语义对应下使用。孔位、点数、阈值、适用范围和机制继续使用 P2G，物品不因名称用词相同而合并。此方针取代原“大炮珠必须保留名称”的限制。
- 图鉴直接保存选定的名称。可选词典负责旧称搜索与来源说明；卸载词典不会让 P2G 退回旧汉化。

## 构建与验收

私有固定输入：

- `research/mhp2g/japanese-catalog-v1/texts.json`：日版文本表 0–17、原生行哈希、ISO/文本容器证据。同目录保留 manifest 和只读提取器。
- `research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite`：已审计数值、关系与文本索引，不作为选定中文的来源。
- `research/generated/mh-save-edit/terminology/versions/gu-pass-02/`：逐条验证官方中文的采用证据。
- `research/mhp2g/localization-review-v3/items.json`：项目译名与说明初审，逐条记录原文、中文与上下文依据。
- `research/mhp2g/armor-catalog-v1/name-review.json`：834 件正常防具独立译名审阅，原文／身份哈希校验后接入防具追加构建；完整来源与重建命令见[防具文档](armor-catalog.md)。
- `research/mhp2g/weapon-name-review-v1/names.json`：785 把正常武器的独立译名审阅，绑定原文及原始行哈希；SHA-256 `2e02e63a2d7b83e66ca8e848cee8797ce9712dc952c31894c9f40341da069ea7`。

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

武器审阅通过 `tools/build_mhp2g_weapon_catalog.mjs` 的可选 `--name-review` 接入，审计使用相同参数，完整命令见[武器构建文档](weapon-catalog.md#重建与审计)。构建保留冻结输入，只在内存中补齐待翻译正常武器的名称单元；指纹、原文、文本键、原生行、范围、重复或缺项错误均中止输出，已有官方中文不接受覆盖。新输入哈希进入武器构建来源及派生资料版本。译名轮私有交付为 `catalog-weapons-v2`，已备份后安装；除 785 条武器显示名、名称来源及武器构建来源外，旧库 schema、原有业务表、数值、日文、图标、关系和其他三作数据均一致。笛效果与铳枪类型在显示层翻译，原始标签保留。后续笛谱机制通过独立审阅补充 `performance`，当时完整交付为 `catalog-weapons-v3`；当前 `catalog-armor-v1` 在其基础上追加防具，保留全部武器名称和译文绑定。

道具库中的 `catalog_item_localization` 保留旧称与说明来源，属于图鉴的可追溯资料。更新词典时，以新 P2G 图鉴和另外三作当前副本为输入，运行 `tools/build_item_terminology.mjs`；**不要再给这套日版构建附加旧 Wiki 日文补丁**。测试通过后备份并成套替换 P2G 图鉴与词典，用户自行重启应用后生效，不自动关闭已有会话。

道具与译名阶段生成目录为 `mhp2g/localization-v4`、`mhp2g/catalog-japanese-v4` 和 `item-terminology/v6`，均在 `research/generated/mh-save-edit/` 下。以下检查对应该历史阶段，旧版本保留用于追溯；`mhp2g/catalog-armor-v1` 为之后追加防具的历史完整基线，后续仍有命名修订；不能以旧道具库覆盖当前成套资料。道具阶段完整离线运行检查：

```bash
node tools/verify_mhp2g_runtime.mjs \
  .runtime-assets/p2g-japanese-v4-check \
  --delivery ../research/generated/mh-save-edit/mhp2g/catalog-japanese-v4
```

检查会逐条读取所有道具、图标及关联端点；若 SQLite 复制导致文件哈希变化，则逐表及逐 schema 比对已审计构建，不以“改过翻译”为理由跳过数值检查。合成测试在 `tests/mhp2gLocalization.test.mjs`，真实资料验收结果只进入本地忽略目录。
