# P2G 装饰品命名复核记录

2026-10-24 分离归档；以下为 10 月 20～21 日检查点，后续用户功能实测见[整体验收](acceptance.md)。当前结构和重建方式见[装饰品参考](../../../../docs/mhp2g/decoration-catalog.md)。

2026-10-21：下方复核成果已随[应用 v0.1.14](https://github.com/AlexQFMM2/mh-save-edit/releases/tag/v0.1.14)、[运行资源 v6](https://github.com/AlexQFMM2/mh-save-edit/releases/tag/runtime-assets-v6) 和[中文插件 test.4](https://github.com/AlexQFMM2/mh-save-edit/releases/tag/mhp2g-zh-v0.1.0-test.4) 公开发行，源码 `4e2ef14` 和三个 tag 均已推送，Actions 成功。三套发行附件重新下载核验通过，Windows 成品的全部 168 颗图鉴／词典新名、旧名搜索代码和 2,400 个图标哈希均已确认。应用包内置资源 v6，插件另外整包更新；新译名实际游戏显示仍待用户验收。下方“尚未提交／发布”保留为 10 月 20 日本地交付检查点；发行证据见[最新交接](../mhp2g-chinese-patch/README.md#2026-10-21-图鉴与插件发行)。

## 2026-10-20 全量译名复核

用户要求统一同技能、同孔数的易理解用词，已对全部 **168** 颗核对原版身份、孔数与完整正负技能点。77 颗有唯一 GU 对应，其中 37 颗调整根名；91 颗无完整对应而保留本作根名（26 颗缺少单项技能对应、65 颗点数或负技能不同）。83 组技能树用词对照含 5 组逐项说明的日文异名，只提供珠名语义依据，不覆盖本作机制。77 颗采用的 GU 用词全部回查到冻结官方简中证据。

统一后的 17 组重复根名补 `【1】/【2】/【3】`；37 颗改根名以外另有 13 颗只加后缀，共更新 **50** 个显示名。未建立跨代物品身份。日文、原旧汉化名和此前项目译名均可检索，旧名也能反查制作材料；技能正文显示新名。图鉴与插件读取同一份身份绑定 `name-review.json`，教程／NPC 的 9 段引用同步，避免同一段对白无法区分不同孔数。

新增[显示名覆盖构建器](../../../../tools/apply_mhp2g_decoration_names.mjs)以最新完整 P2G 库为输入，核验基线及来源指纹、全量身份、原名、孔数和带符号技能点。只更新显示名称、来源和搜索；全部 35 张表对允许字段以外逐项比较，保留 168 颗、281 条技能点、192 套配方、597 条材料。旧名存入装备 JSON 的 `nameAliases`，由词典构建器带入别名。新增构建来源使配装资料版本更新。

私有复核根为 `.runtime-assets/p2g-decoration-naming-20261020/`，全部被忽略：`decoration-review.md` 为 168 行复核表；`name-review.json` 为共同译名输入；`official-wording-audit.json`、`data-validation.json`、`build-validation.json` 分别记录官方用词、真实查询和构建检查。重建时使用新目录：

```bash
node tools/apply_mhp2g_decoration_names.mjs \
  .runtime-assets/p2g-decoration-naming-20261020/input/mhp2g.sqlite \
  .runtime-assets/p2g-decoration-naming-20261020/name-review.json \
  /private/new-decoration-names
```

将该新库与其他三作快照放入同一输入目录，再运行 `tools/build_item_terminology.mjs <catalog-dir> ../research <new-output>` 生成配套词典；不能只安装改名库。插件将同一审阅加入 `nameReviews`，把 50 个名称单元和 9 段引用的源键级修订放在 `manualReviews` 最后；冻结旧审阅保持不变。

26 项相关合成回归、真实全部装饰品／281 技能关联和 84 条旧名查询、类型检查、应用构建及安装后的运行资产总审计通过；三作全表和词典显示名保持不变。双构建数据库与插件交付 32 文件逐字节一致，双组包和 9 文件白名单／内外校验／标准目录解压通过。新 PGF 为 2,887 字形，属于此前字形子集且度量未变；官方 PPSSPP 解析／绘制及生产 C 文本解析器的 ASan／UBSan 检查通过。

`data/mhp2g.sqlite` 与 `data/item-terminology.sqlite` 已备份后本地成套替换，备份在该根的 `backup/`，新哈希及时间见 `installation.json`。重启本地应用加载新资料。回退时退出应用，恢复这两份备份并重启；原 ISO、模拟器和存档不变。插件本地包为 `release-local-01/mhp2g-zh-v0.1.0-test.4-ppsspp.zip`，B 构建 `8654b877bffb88d2`，21,600 条引用、未译／待接入 0，沿用 test.3 的 40 MiB 和早挂接修复；**尚未提交、推送或发布 test.4，也未实测新译名的游戏显示**。已发布 test.3 保持原样，下方为历史图鉴交接。

2026-10-12 已完成本地实现、验收和安装，对应[实施计划](../mhp2g-decoration-catalog/README.md)。完整装饰品入口现可浏览 168 颗珠，支持中日文名称、编号、技能／发动技能及材料检索，按孔位和正向技能点筛选、排序、分页，并展示命中原因。
