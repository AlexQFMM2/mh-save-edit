# P2G 怪物图鉴

P2G 复用既有怪物列表、肉质、异常耐性、掉落和一级详情抽屉，使用独立的原生编号查询适配。怪物阶段开放了怪物和道具图鉴；2026-10-12 后续[任务图鉴](mhp2g-quest-catalog.md)也已接入。存档与配装仍待接入，下一步为[装饰品图鉴](mhp2g-decoration-handoff.md)。

## 数据与身份

- 84 条原生怪物记录，不等于 84 个物种。90 个定义中排除 6 条占位或非怪物对象；同名变体及两个浮岳龙记录保持独立。
- 日文身份与本作上下文为名称依据，58 条使用补核后的 GU 官汉，26 条采用项目译名；旧名及上下文名称可搜索。英文只用于辅助展示/搜索。
- 原生日版与旧快照的定义、首组肉质、奖励池共 2,093 项窗口对照通过。追加状态肉质来自同一已核对模块的指针窗口；游戏数值不从其他作补入。
- 742 行肉质中 450 行已通过完整数值组确认部位名。雷、冰按字段和日文表头对应，不能按表格列序连接。其余部位、状态保持“未标注”，没有把默认空值解释成“通常”。
- 4,377 条掉落连接当前 P2G `itemId`，绝不使用 `saveId`。百分数不再乘 100；原生池不含数量时保持 `null`。未确认的位阶槽及破坏部位代码单独保留，不将槽名猜成训练任务。
- 336 组异常记录：202 组适用、26 组不适用得到交叉印证，其余 108 组适用性未知。持续时间只有与本作日文秒数及原生时长一致时才显示；未知与不适用分开。
- 601 条出没记录来自固定 P2G 日文 Wiki 观察，使用 `wiki:<页>:<表>:<行>` 范围键。它们不是 601 个已验证的原生任务 ID，也不补出任务奖励、目标或多怪关系。任务名和条件保留日文。

怪物图标的原生调用链、裁切与族群复用证据见 [图标说明](mhp2g-monster-icons.md)。84 条记录通过 62 个原生列表条目及族群关系取得 54 张独立 PNG；共享图标不合并怪物身份。

## 构建

真实输入和结果均为私有研究资料。固定新增输入位于 `../research/mhp2g/monster-catalog-v1/`，其中 `source-manifest.json` 记录最小来源文件指纹。既有 r9、日版文本、原生快照和日文观察保持原位。以下命令从仓库根运行，输出必须是新路径：

```bash
python3 tools/prepare_mhp2g_monsters.py \
  --source ../research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite \
  --japanese ../research/mhp2g/japanese-catalog-v1/texts.json \
  --native ../research/mhp2g/native-monsters-v1.json \
  --modes ../research/mhp2g/monster-catalog-v1/mode-windows.json \
  --observations ../research/mhp2g/monster-table-observations-v1.json \
  --review ../research/mhp2g/monster-catalog-v1/name-review.json \
  --icons ../research/mhp2g/monster-catalog-v1/icons-v1/manifest.json \
  --parity ../research/mhp2g/monster-catalog-v1/host-parity.json \
  --output /path/to/new-evidence.json
node tools/build_mhp2g_monster_catalog.mjs \
  --base ../research/generated/mh-save-edit/item-terminology/v6/mhp2g.sqlite \
  --evidence /path/to/new-evidence.json \
  --icons ../research/mhp2g/monster-catalog-v1/icons-v1/manifest.json \
  --output /path/to/new-catalog
node tools/audit_mhp2g_monsters.mjs \
  --base ../research/generated/mh-save-edit/item-terminology/v6/mhp2g.sqlite \
  --evidence /path/to/new-evidence.json \
  --icons ../research/mhp2g/monster-catalog-v1/icons-v1/manifest.json \
  --delivery /path/to/new-catalog
```

准备阶段验证日版窗口对照与 r9 指纹、日文名称绑定及图标覆盖。构建阶段校验每条掉落的原有道具关系、数量、概率与图标身份；独立审计再次对照固定证据，核对道具身份指纹及其他业务表没有变化。离线构建和运行不连接 Windows 宿主机。

运行库保留 `catalog_schema=mhp2g-items-v1`，追加 `monster_schema=mhp2g-monsters-v1`、`catalog_monsters` 与 `catalog_monster_drops`。旧的仅道具数据库仍能查看道具，怪物入口会给出可恢复的缺资料提示。词典绑定依据道具身份指纹，不因新增怪物表而失效。

## 使用与恢复

名称、日文、别名及十进制/十六进制原生 ID 可搜索；按掉落道具或出没任务名反查怪物时显示命中原因。道具图鉴也支持按来源怪物反查。正文点击关联对象打开一级抽屉；抽屉内再次点击先关闭再定位。P2G 任务在怪物页提供关联详情，不跳入尚未接入的独立任务页。三类 P2G 关联抽屉通过 portal 挂在 document.body，打开时不使正文容器发生焦点滚动或横向位移。

当前交付位于 `../research/generated/mh-save-edit/mhp2g/catalog-monsters-v1/`。安装仅复制该目录的 `mhp2g.sqlite` 至已忽略的 `data/`，以及 `icons/*.png` 至已忽略的 `ui/public/assets/catalog/icons/`。更新后由用户重新启动应用，已有打开的连接不会自动替换。

安装前备份位于 `.runtime-assets/p2g-monster-work/pre-monsters-v1/`，包含 P2G 库、配套词典和五个数据库的原哈希。需要回退时，关闭应用后恢复备份的 P2G 库及词典；新增内容哈希图标可保留，不影响旧库。三作数据库无须回退。

P2G 数据、图标、manifest、crosswalk 和审计报告不进入 Git、公开 Actions 或 Release；现有三作的公开发布授权不自动扩展至 P2G。公开仓库仅含构建/查询源代码、合成测试及本文档。

## 本次验证

2026-10-10 完整回归 549 项通过、7 项按条件跳过；最终抽屉调整后 22 项相关测试通过，类型检查与构建通过。独立 Electron 18 项覆盖 1366×768 和 3440×1440、全部怪物/掉落、701 个道具端点、单层抽屉及打开前后正文位置。截图与报告归档于私有 `monster-verification-v1`，三作数据库及词典哈希未变。
