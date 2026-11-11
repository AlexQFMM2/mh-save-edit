# P3 怪物图鉴交接

更新：2026-11-02。状态：已完成本轮实现、验收与本地安装。用户批准的 T-001～T-007 均已完成，单代理串行；没有提交、推送、标签或公开发行。

接手先读[计划与验收](README.md)、[任务清单](taskList.md)及长期[数据、构建与恢复契约](../../docs/development/mhp3-monster-catalog.md)。本轮之前已有的 AGENTS、README、研究交接与资料入口改动均保留。研究／库／图标／截图／审计保持私有。

## 已交付

- 默认 60 条正常目录（40 大型＋20 小型），扩展 35、37、38、39、68 五个原生身份；同名对象不合并。NPC、岩石不进入列表。
- 65 个中文名称及别名，60 条原生说明译文和日文；60 个原生图标绑定、59 个独立 42×42 PNG。扩展缺图使用占位。
- 419 肉质、284 异常、241 控制、1,960 掉落、598 出没观察。来源、未知、条件、概率／权重／数量／次数分别保存。
- 追加 `p3_monsters`、`p3_monster_drops` 和独立版本；`MonsterCatalogGameId`、三条只读查询、道具来源筛选与双向反查。通用游戏与任务身份未扩展。
- 共享四标签页、范围下拉、原文／译名／覆盖说明、未知值、条件单位、搜索命中原因及一级抽屉。出没为来源观察预览；抽屉内关闭后定位怪物页，没有调用未支持任务服务。
- 修正自动选择首条多推一次历史的问题：自动选择替换历史，用户选择仍可前进后退；选择不重查列表。道具反查展示位阶、取得方式和次数。

## 数据与安装位置

以下路径均相对于仓库外的 `../research/`：

| 用途 | 位置 |
| --- | --- |
| 原有冻结研究 | `mhp3/monster-native-20261102/`、`mhp3/monster-preflight-20261102/`，未改写 |
| 本轮输入／审阅／探针 | `mhp3/monster-catalog-20261102/`；最终输入 `catalog-input.json` |
| 成功交付 | `generated/mh-save-edit/mhp3-monsters-20261102-v2/`，含成功 manifest、audit、independent-audit |
| 安装前完整备份 | `mhp3/monster-catalog-20261102/install-backup/mhp3.sqlite` |
| 初始基线 | `mhp3/monster-catalog-20261102/baseline.json` 与 `baseline/mhp3.sqlite` |
| 安装／最终核验 | `mhp3/monster-catalog-20261102/install-report.json`、`final-independent-audit.json`、`final-runtime-audit.json` |
| 私有冻结索引 | `mhp3/monster-catalog-20261102/freeze-manifest.json`、`README.md` |

安装库 SHA-256：`e54e8037536f6ebc318517a0fa8eac6af49da26931dbbebf31ca86d2d6aec46a`。

安装前完整武器库／恢复备份 SHA-256：`8636abea52f7027f54692ee2de30a7b97ea1e03e573e06f9915c6f2050f7dd48`。

输入／`monster_data_version`：`e0f3ec7d06a8054535a3473e910c408d53fc486e42a459cd9c17259b911ce5eb`；`monster_schema=mhp3-monsters-v1`。

已原子替换 `data/mhp3.sqlite`，新增 59 张 PNG 到忽略的 `ui/public/assets/catalog/icons/`。安装前扫描未发现使用目标库的进程，没有强制关闭用户会话。其他四作数据库与词典哈希未变，旧 21 表的定义与内容保留，只有怪物 metadata 追加；没有重建词典或删除图标。

## 验收证据

私有工作目录中的日志与报告：

- `typecheck.log`、`build.log`：类型检查与最终构建通过。`python-tests.log`：构建／独立审计／失败产物／表格解析 5 项通过。
- `vitest-full.log`：全套 Vitest 排除 `.runtime-assets`，907 通过、1 失败、8 跳过。唯一失败为旧首页测试仍认为 P3 怪物页未开放；已更新为验证 P3 怪物只读领域且无任务／存档调用。`vitest-final-ui.log`：该文件及新旧怪物 UI 的 38 项全部通过。此前 API 22 项、相关 UI 45 项、旧怪物 16 项通过，不累计重叠测试次数。
- 8 个条件跳过属于 GU 已编译 Worker、GU 护石证据、MH4G 护石执行／运行见证、P2G 真实存档相关条件，不属于新增怪物合成测试；没有创建空文件绕过。
- `electron/candidate/report.json`：41 项通过。`electron/installed/report.json`：44 项通过，`dataDir` 为本地实际 `data/`；所有 65 个详情、1,960 条掉落反向端点、60 个图标加载、范围／中日文／编号／道具／出没搜索、身份拒绝及旧图鉴通过。
- 1440×900、1024×768 真实 Electron 截图与检查覆盖四标签、中文／条件／未知值、范围与历史、列表滚动、道具↔怪物一级抽屉、Escape／焦点恢复、出没预览与定位、现有四作怪物及 P3 五类原图鉴。已查看截图；窄窗口宽表可横向滚动。
- `electron/old-module/report.json`、`missing-db/report.json`、`missing-dictionary/report.json`、`stale-dictionary/report.json`：旧模块缺失不影响五类原图鉴；缺库明确报错；缺词典保留审定名称；词典绑定过期拒绝陈旧投影并提示更新。

运行环境为 **Linux Electron 33.4.11／Xvfb X11**，真实构建主进程、preload、IPC 和 SQLite，独立临时 userData。桌面 X11 截图曾停滞，Ozone headless 在此环境崩溃，后用本地解压的 Xvfb 完成；失败诊断保留。安装后附加搜索验收曾因脚本误选 `input[type=search]` 失败，修正为实际输入组件后全部通过。没有用静态浏览器代替 Electron。

**未执行 Windows 实包或游戏运行验证**，原生图标尚无游戏画面对照；不把本地验收等同这些平台验收。

## 必须保留的未知与来源边界

- 雷狼龙超带电尾尖射击值为 `null`：独立资料为 15，原生数组 10／15，已定位状态切换未覆盖此行。土砂龙泥层按部位表达。
- 四种终盘怪物异常参考值包含指定任务倍率；无单位伤害不当作总伤害。陷阱重复、疲劳及条件免疫分开。
- 每次掉落数量未注明时保持未知；概率和原始权重不混用。原生采集四字节字段语义未提升为数量。
- 飞甲虫 36～39 羽色掉落通过多个原生 rankCode 的完整道具／权重集合与独立资料交叉绑定；49／68 两份垂皮龙池分别读取，身份不合并。5 个扩展图标仍未知，37～39／68 的其他机制未借用。
- 小型怪物逐任务出没未收录，任务名称仍为日文。出没倍率／防御率显示独立资料原值，未换算为未经验证公式。
- 原先 638 个出没候选中有 40 行表尾愤怒倍率，已独立保存为战斗补充，真实出没为 598。v1 被构建器拒绝且保留 `FAILED.txt`，绝不可安装。

## 恢复与后续

退出使用 P3 库的应用，核对上面的备份哈希，将 `install-backup/mhp3.sqlite` 复制为 `data/` 下临时文件后原子替换 `data/mhp3.sqlite`，再启动验证原五类图鉴。恢复时不替换词典、不删除任何哈希图标；旧库访问怪物页会提示模块尚未安装。完整离线重建命令见长期契约。

当前没有本轮必须继续处理的阻碍。完整任务图鉴、配装、存档修改、机制深化、Windows／游戏验收及提交／发行均不因本轮完成而自动启动。计划保留已完成状态，待后续统一归档。
