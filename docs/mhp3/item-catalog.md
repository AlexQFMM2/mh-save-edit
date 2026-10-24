# P3 道具图鉴

P3 的 PPSSPP 工作区通过“资料 → 道具”打开只读图鉴。道具资料使用独立的 `data/mhp3.sqlite`，图标位于 `ui/public/assets/catalog/icons/`。默认显示 977 条，空槽和“不装瓶”内部占位可用“显示占位条目”查看。独立[装饰品图鉴](decoration-catalog.md)复用此库，其他图鉴、配装和存档编辑仍未开放。

## 数据契约

- `ItemCatalogGameId` 包含 P3，通用 `CatalogGameId` 不包含 P3。身份为 `{ gameId: 'mhp3', itemId }`，范围 0～978；不接受 `saveId`，不承诺其等于存档编号。
- 名称与说明直接保存在 P3 图鉴，保留日文与译名来源。普通名称优先采用逐条核对的 GU 简中；说明按 P3 原文翻译。
- 装饰品按对应技能用途采用后作根名，后缀保留 P3 实际孔数。相同名称的条目仍使用不同 P3 编号，列表、详情和关联入口通过正负技能点区分。
- 117 条调合保存基础成功率和产量范围；不推算调和书、技能或特殊条件加成。164 件装饰品保存全部技能点和 198 条独立制作路线，替代路线不合并材料。
- 商店关系仅来自已核对的实际列表；基础买价不构成出售证明。147 件商品显示普通／半价及已确认轮换，解锁条件留缺。其他来源、装备用途未收录；已确认不涉及调合或装饰品制作会单独说明。
- 无限弹、重复使用且有冷却、内部占位有独立数量类型。原始特殊值不显示为普通携带上限。

## 离线构建

从仓库根目录执行，输出目录必须尚不存在：

```bash
python3 -m tools.mhp3.build \
  ../research \
  ../research/mhp3/item-catalog-20261024/review-final.json \
  ../research/mhp3/item-catalog-20261024/icons-all-v1 \
  ../research/generated/mh-save-edit/mhp3/<新版本>
```

构建器读取冻结探针、中文审阅及 GU 证据，校验来源哈希、原文绑定、控制码、孔数、正负点数、数值、关系端点和图标。296 组内容哈希 PNG 保留原生调色板及透明度。生成 `mhp3.sqlite`、`icons/`、`audit.json`、`manifest.json`；存在 `FAILED.txt` 的输出不得安装。构建与应用均不连接宿主机。

将新 P3 库与当前四作数据库副本放在同一私有输入目录，再构建配套词典：

```bash
node tools/build_item_terminology.mjs \
  /private/catalog-input ../research \
  ../research/generated/mh-save-edit/mhp3/<新词典版本>
```

输入目录含 `mhp3.sqlite` 才加入 P3。词典仅补充日文、旧称及后作名称搜索，不能覆盖 P3 审定名。缺词典仍可查询 P3 内置名称与别名；词典过期则明确提示重新生成配套资料。审定名称与别名均参与绑定指纹。

## 本地安装与恢复

先关闭应用和相关数据库连接，备份旧 P3 库及词典，核验新库的完整性、内容哈希、配套词典绑定以及四作原库哈希。仅将新 `mhp3.sqlite`、配套 `item-terminology.sqlite` 和哈希命名 PNG 复制到本地忽略路径，不用词典输出中的四作副本覆盖当前四作库。库与词典成套替换，失败时成套恢复；图标已有同名文件时必须核对哈希。

安装后运行 `pnpm build` 或 `pnpm dev`。缺 P3 数据会显示明确安装提示，不能通过其他作品资料代替。

研究输入、译文集合、SQLite、PNG、manifest、映射、报告均保持私有；P3 资产尚未获得公开发行授权，不修改现有发行包的文件列表。当前本地安装位置、备份及验收记录见[实施交接](../../plan/mhp3-item-catalog/handoff.md)。

## 验证入口

```bash
python3 -m unittest discover -s tests -p 'test_mhp3_builder.py'
pnpm exec vitest run tests/mhp3ItemCatalog.test.ts tests/mhp3ItemUi.test.tsx --exclude '**/.runtime-assets/**'
pnpm typecheck
pnpm build
```

测试只使用合成资料。游戏截图对照和真实存档验收独立进行，不以图鉴静态检查代替。
