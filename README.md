# MH Save Editor

基于 React + Electron + TypeScript 的离线 Monster Hunter 图鉴、配装器与存档编辑器，当前维护 MHP2G、MH3G、MH4G、MHGU/XX 四套内容资料。

**当前应用版本：[v0.1.12](https://github.com/AlexQFMM2/mh-save-edit/releases/tag/v0.1.12)**。本版接入 P2G 七类图鉴、六槽手动／自动配装及 PPSSPP 存档编辑，内置运行资源 v5 和四作道具译名词典，详见[更新说明](docs/releases/v0.1.12.md)。

**维护与交接说明更新于 2026-10-13。** 已有三作以 bug 修复和社区贡献为主。P2G 已接入七类图鉴、六槽手动／自动配装及 PPSSPP 存档编辑；应用侧检查与剩余游戏内验收见[P2G 整体验收](docs/mhp2g-acceptance.md)。P2G 已纳入本版应用与公开运行资源 v5；PPSSPP 游戏内保存往返仍待实际测试。跨作品统一业务数据表及整体数据重构计划已放弃，扩展按游戏独立推进。P2G 按“图鉴优先、游戏补丁最后”的方向接入，原文与译名的共用输入及未完成事项见 [P2G 图鉴与中文资料](docs/mhp2g-localization.md)。当前新增独立的[道具译名词典](docs/item-terminology.md)：有明确日文对应的名称采用 GU 官方简中，保留各作译名供搜索；各作编号、数值、关系与存档格式仍独立维护。

本文集中记录运行方法、真实代码入口、已遇到的难点及新作品接入方法，方便接手者从一个具体问题开始。

- [当前范围与边界](#当前范围与边界)
- [下载与开发准备](#下载与开发准备)
- [代码入口](#代码入口)
- [各游戏独立维护的原则](#各游戏独立维护的原则)
- [项目难点与排查方法](#项目难点与排查方法)
- [新作品如何接入](#新作品如何接入)
- [测试、发布与贡献](#测试发布与贡献)

## 当前范围与边界

已有四作离线图鉴、独立于存档的手动/自动配装，以及六种存档格式的编辑工作区。支持个人信息、道具箱、装备箱、GU/XX 猎猫的部分字段，以及撤销/重做、兼容 CSV、同格式箱子完整备份、图鉴加入装备箱、配装整套写入、保存前备份和保存后回读。

内容库标识与存档格式标识是两回事：

| 内容库 | 存档格式标识 | 对应环境 |
| --- | --- | --- |
| `mhp2g` | `mhp2g-psp-ppsspp` | MHP2G / PSP / PPSSPP |
| `mh3g` | `mh3g-3ds-citra` | MH3G / 3DS / Citra |
| `mh3g` | `mh3u-wiiu-cemu` | MH3U / Wii U / Cemu |
| `mh4g` | `mh4g-3ds-citra` | MH4G / 3DS / Citra |
| `mhgu` | `mhgu-switch-yuzu` | MHGU / Switch / Yuzu |
| `mhgu` | `mhxx-3ds-citra` | MHXX / 3DS / Citra |

这是当前代码接入的格式范围，不是对所有地区版、更新版、实体机封装存档或其他模拟器的兼容承诺。不要从界面中的系列名称推断未验证版本也能写入。

当前需要保留的边界：

- Windows 发布流水线通过了测试、打包和原生模块检查，但六格式的完整真实存档样本、对应模拟器重开及全部高 DPI 场景尚未完成系统验收。自动化通过不能代替游戏内回读。
- 猎猫等级和 EXP 保持只读；随身装备、背包、快捷栏、箱格物理换位不在当前开放修改范围。其他高级字段以界面能力和格式校验为准。
- 自动配装不承诺覆盖游戏中全部自然生成的护石；MH4G 使用经过复核的有限候选集合。发掘装备的部分自然生成规则仍未知。
- 技能名称、发动阈值与效果说明不等于完整伤害模拟器。动作值与说明中未经确认的字段不能当作已证明的计算公式。
- 旧 Qt 编辑器只作为格式和算法研究参考，不是运行依赖。账号、邮箱、在线广场等历史规划不属于当前离线交付承诺。

[plan/](plan/README.md) 中的旧总计划和 22 份专项计划已于 2026-10-10 全部归档，未做的后续工作停止推进。归档记录保留已完成依据与未实现/未验收的边界；后续按实际 bug 或社区贡献重新确定范围。判断当前行为应结合本文、对应版本说明、代码与测试，不按旧路线恢复统一数据重构。

## 下载与开发准备

### 使用 Windows 便携版

从 [Release](https://github.com/AlexQFMM2/mh-save-edit/releases/latest) 下载 `mh-save-editor-v<版本>-windows-x64.tar.gz`，校验同页的 `SHA256SUMS.txt`，完整解压后运行 `MH Save Editor.exe`。

更新时将新版本整包解压到新目录，让程序、图标和数据库一起更新。目录包只需解压一次；不再使用每次启动都重新解压完整 Electron 和资料的单文件 portable 形式。

### 从源码运行

需要 **Node.js 22、pnpm 11**。在项目根目录下载[运行资产 v5](https://github.com/AlexQFMM2/mh-save-edit/releases/tag/runtime-assets-v5)，按原目录结构解压。该包无需密码，包含：

```text
data/mh3g.sqlite
data/mh4g.sqlite
data/mhgu.sqlite
data/mhp2g.sqlite
data/item-terminology.sqlite
data/mhp2g-save-profile.json
ui/public/assets/catalog/icons/*.png
build/app-icon.ico
build/app-icon.png
```

ZIP 的 SHA-256 见该 Release 的 `SHA256SUMS.txt`，也固定在 [CI 工作流](.github/workflows/ci.yml) 的 `RUNTIME_ASSETS_SHA256` 中。普通开发和 CI 只需要源码与此运行包，无须访问原维护者的 Windows 主机或私有研究目录。

```bash
pnpm install --frozen-lockfile
pnpm data:repair:runtime
pnpm data:audit:runtime
pnpm dev
```

关闭开发进程后，或另开终端执行检查：

```bash
pnpm typecheck
pnpm exec vitest run --exclude tests/weaponCatalogData.test.ts --minWorkers=1 --maxWorkers=2
pnpm build
```

上述测试范围与 CI 一致。`pnpm test` 还包含依赖私有武器构建审计文件的 `weaponCatalogData.test.ts`；缺少这些文件不等于应用无法运行。部分条件测试会因未提供研究输入或编译后的 Worker 路径而跳过，查看跳过原因即可，不要制造空文件来绕过检查。

首次 `pnpm dev` 会单独编译 Electron 使用的 `better-sqlite3` 原生模块，因此可能还需要 Python 和本机 C++ 构建工具：Linux 的编译工具链，或 Windows 的 Visual Studio C++ Build Tools。Node 测试与 Electron 的 ABI 不同；遇到 `NODE_MODULE_VERSION` 错误时先核对运行环境，使用 `pnpm rebuild:electron-native` 重建开发绑定，不要混用另一平台的 `.node` 文件。相关脚本见 [rebuild-electron-native.mjs](tools/rebuild-electron-native.mjs)。

Linux 开发脚本会清理 Electron 的 Node 调试环境变量，并追加 `--noSandbox`；正式打包不使用这个开发参数。

### P2G 支持范围

**P2G 任务图鉴已本地接入：450 个本体任务＋52 个 Wiki 活动／挑战任务。** 支持中日文检索、筛选、报酬与支给、解锁条件及道具／怪物双向关联，详见[任务图鉴说明](docs/mhp2g-quest-catalog.md)。已备份并安装新库，现有连接在重启应用后加载。

**P2G 怪物图鉴已本地接入。** 构建、来源和保留的未知项见 [怪物图鉴说明](docs/mhp2g-monster-catalog.md)，验收见[怪物实施记录](plan/mhp2g-monster-catalog/README.md)。

**P2G 技能与装饰品图鉴均已本地接入。** 技能包含 99 个系统、213 条正常发动、胴系统倍加和 7 个复合技能；装饰品包含 168 颗珠、281 条技能点、192 套配方与 597 条材料。支持中日文检索、筛选和道具／技能双向详情关联。技能阈值与效果保留 Wiki 来源；珠的稀有度、制造费用和解锁条件明确显示“未收录”。重建、验收与回退见[技能说明](docs/mhp2g-skill-catalog.md)、[装饰品说明](docs/mhp2g-decoration-catalog.md)。共享图鉴选择条目时的重复加载及装饰品滚动跳顶已修复。完整武器与防具随后也已接入，分别包含 1,501 把武器、2,081 件正常防具；数据证据见[装备阶段交接](docs/mhp2g-equipment-handoff.md)。

P2G 复用工作区和共享图鉴组件，各领域使用独立查询仓库与 `data/mhp2g.sqlite`。侧栏提供道具、装饰品、技能、武器、防具、怪物、任务、修改和配装器；七类图鉴及两类修改入口均已开放。P2G 没有护石，配装采用六槽；[存档编辑](docs/mhp2g-save-editor.md)支持已确认的个人字段、道具、正常装备、装珠、强化与 BIN/SFO 成对保存。名字、性别、HR 只读，猫和任务进度编辑未开放。

已恢复的 `mhp2g-items-v1` 快照含 1,261 条原生道具记录（含默认隐藏的占位条目）、172 组调合配方，以及商店、采集、怪物、任务与制作用途。本地图标快照已覆盖全部 1,260 个正常道具：按原生图形和颜色编号生成 277 张 PNG，列表、详情与关联道具抽屉共用。名称与说明已切换为核对过的日版原文输入，部分关联补充日文 Wiki 历史镜像。1,260 件正常道具已有中文显示名：717 件采用已确认的 GU 官方用词，543 件使用项目译名。最后一批 146 件的说明也已补齐中文，可展开查看日文；其余说明显示日文原文。用户界面仅展示译名来源，不展示内部审校状态。旧汉化名称仅作为搜索别名。具体覆盖与后续装备接入见 [P2G 图鉴与中文资料](docs/mhp2g-localization.md)。Wiki 获取条件尚未完成游戏内验证，缺失概率保持未知。部分道具显示字段仍保留未知值；原生道具编号与当前 PPSSPP 存档的对应已核实，可通过共享入口加入道具箱。

怪物模块另含 84 条原生怪物记录、742 行肉质、4,377 条掉落和 601 条出没记录；全部怪物有原生图标。道具与怪物可双向打开详情抽屉，关联搜索显示命中原因。未确认的部位、状态和数量保持未知，任务原名保留日文。

P2G 资料库、存档格式参数及词典已包含在公开运行资产 v5 和 Windows 包中，无须自行构建。需要从私有研究输入重建时，持有已核对的 r9、日版文本和译名快照后，先按 [中文资料构建说明](docs/mhp2g-localization.md#构建与验收) 生成译名输入，再运行：

```bash
pnpm data:build:p2g-items --source /path/to/pilot-r9/mhp2g-pilot.sqlite --output /path/to/new-output --localization /path/to/localization/localization.json
pnpm data:audit:p2g-items --source /path/to/pilot-r9/mhp2g-pilot.sqlite --delivery /path/to/new-output

# 先重建配套词典、验证并备份，再成套安装到本地 data/。
```

带图标构建时，在第一条命令中增加 `--icons /path/to/icons-v1/manifest.json`，并把输出 `icons/*.png` 复制到已忽略的 `ui/public/assets/catalog/icons/`。完整提取、来源证据与验收步骤见 [P2G 道具图标](docs/mhp2g-item-icons.md)。更新本地数据库后需重新启动应用，让主进程重新打开资料库。

构建器验证 r9 输入指纹并拒绝覆盖已有输出目录。原始输入、数据库和生成的 manifest/audit 均不提交；仓库中的 [合成样本](tests/fixtures/p2gCatalogSource.mjs) 可用于运行 P2G 构建、查询、IPC 与 UI 测试。上面的命令仅重建道具阶段输入；完整资料应继续按各领域文档生成，不能用道具子集覆盖当前完整库。存档格式资源构建见[存档编辑器](docs/mhp2g-save-editor.md#私有格式资源)。

### 修改功能与重建资料的区别

使用公开运行包即可修改界面、存档逻辑、计算器和大部分业务代码。**从 Dex/游戏原始输入重新生成全部资料，是另一项工作**：需要自行准备来源快照、清单和证据，运行资产 ZIP 不包含这些输入。

构建器目前也不是一条能在任意新机器上从零运行的通用流水线。例如 [build_armor_catalog.mjs](tools/build_armor_catalog.mjs) 接受 `--research-root`，而 [build_item_catalog.mjs](tools/build_item_catalog.mjs) 仍保留早期 `/tmp/*-dex-direct-sql` 输入路径。接手数据重建时，应先核对该脚本读取的文件、原始表、既有数据库和 manifest，再整理为可配置的固定输入；不要直接执行所有 `data:build:*` 或把缺少私有文件误判成数据不存在。

## 代码入口

运行链路是 **React 页面 → preload 白名单 → 主进程 IPC/schema → 业务服务与只读资料库 / 存档 adapter**。renderer 不直接打开 SQLite 或写存档。

| 要处理的事情 | 优先阅读的位置 |
| --- | --- |
| 启动、窗口、资料路径、服务生命周期 | [desktop/main.ts](desktop/main.ts)、[desktop/preload.ts](desktop/preload.ts)、[api/catalog/ipc.ts](api/catalog/ipc.ts) |
| 图鉴查询、关系和展示数据 | [api/catalog/](api/catalog/)、[ui/pages/](ui/pages/)、[ui/components/](ui/components/) |
| 六格式字节解析、校验、加密、序列化 | [api/save/adapters/](api/save/adapters/)、[api/save/binary.ts](api/save/binary.ts) |
| 存档会话、字段补丁、撤销、导入导出、备份保存 | [api/save/sessionService.ts](api/save/sessionService.ts) |
| 图鉴身份与存档编号之间的解析 | [api/save/catalogResolver.ts](api/save/catalogResolver.ts) |
| 配装模型、计算和各作特殊规则 | [api/loadout/types.ts](api/loadout/types.ts)、[calculator.ts](api/loadout/calculator.ts)、[rules.ts](api/loadout/rules.ts) |
| 自动配装候选、剪枝、护石、装饰珠 | [autoSearch.ts](api/loadout/autoSearch.ts) 及同目录 `search*.ts` |
| 自动配装队列、Worker、任务历史 | [jobService.ts](api/loadout/jobService.ts)、[jobStore.ts](api/loadout/jobStore.ts)、[autoSearchWorker.ts](api/loadout/autoSearchWorker.ts) |
| 配装草稿、旧配装按新资料复核 | [ui/stores/](ui/stores/)、[api/loadout/file.ts](api/loadout/file.ts)、[repository.ts](api/loadout/repository.ts) |
| 资料生成、运行库迁移与审计 | [tools/](tools/)、[tools/runtime/](tools/runtime/)、[repair_runtime_catalog.mjs](tools/repair_runtime_catalog.mjs)、[audit_runtime_catalog.mjs](tools/audit_runtime_catalog.mjs) |

**不要把 `api/games/*/adapter.ts` 当成存档实现入口。** 这些文件仍是早期骨架，读取返回空配装、写入返回原字节。实际读写在 `api/save/adapters/`，当前会话实例化路径在 `SaveSessionService` 的 `createAdapter` 中；`api/save/adapters/index.ts` 也有格式分派，扩展时两处都要检查。

同样，`api/db/schema/` 不能代替完整运行库说明；不少 `catalog_*` 表由构建器里的 SQL 创建。更改字段前同时检查建表代码、迁移、Repository 和审计脚本。

## 各游戏独立维护的原则

四套游戏 SQLite 各自保存对应游戏的数据，译名词典另存为独立 SQLite。共用页面、查询接口和部分 `catalog_*` 表形状，是为了复用现有功能；**不再追求让不同作品的原始表、装备编号、技能含义和译名完全统一**。也不需要为了贯彻这一点拆掉已经稳定的公共组件。

后续修改遵循以下原则：

- 游戏内部保留自己的原生 ID、内容 ID、版本差异与规则。数据库或公共接口中仍保留游戏身份，不能因为已分库就去掉边界检查。
- 名称用于展示和搜索。当前三作中文以 Dex 为主，其他译名可以作为别名及搜索关键词，不能作为跨表关联的唯一依据，也不做跨游戏名称强制对齐。
- 复用已经稳定的窗口、搜索选择器、抽屉、备份、任务队列等能力。新作差异留在该作构建器、格式 adapter、规则和必要的专用组件中。
- 新作需要不同的数据表或配装模型时，允许独立实现；不能为了接入新作，要求先迁移现有三作的全部资料。

具体 UI、CSS、来源证据及分发约定见 [AGENTS.md](AGENTS.md)。它包含原维护环境的路径说明，社区运行应用不依赖这些机器。

## 项目难点与排查方法

### 1. 同一个物件有多种身份，名称不能代替映射

Dex ID、游戏资源 ID、存档编码 ID、装备实例和箱子格号各有含义。相同数值不代表同一对象；同名条目也可能分性别、地区、职业或存在未使用占位记录。需要明确的 crosswalk（身份对应表）和来源证据。

v0.1.10 的 MH4G 问题就是实际例子：旧映射依赖中文名称，译名不一致使合法防具没有存档编号，从而被自动配装排除。修复核对了原生记录中的部位、稀有度、孔位、防御、耐性、完整正负技能点及性别，补齐 1,693 条映射并纠正 18 条旧映射；32 条 Dex 美版专属防具保留展示，但不当作 MH4G 可写入条目。实现与合成测试见 [mh4gArmorIdentities.mjs](tools/runtime/mh4gArmorIdentities.mjs)、[mh4gArmorIdentities.test.mjs](tests/mh4gArmorIdentities.test.mjs)。

遇到“图鉴里有，配装器搜不到 / 无法加入装备箱”，先检查该游戏的 `catalog_armor_save_identities`、`saveType/saveId`、性别/职业限制和当前 `dataVersion`，再检查搜索逻辑。修改中文显示名称不能解决错误身份映射。

### 2. 技能名称、技能系、发动效果和点数不能混为一谈

Dex 的技能系编号不一定等于原生编号；GU/XX 已遇到过这类错位。显示“挑战者+2”的发动效果与累计技能点是不同层次，还要处理负技能、复合技能、胴系统倍加，以及 GU/XX 护石强化和秘术的计算顺序。

排查顺序应是：确认来源与技能身份 → 逐件核算装备/珠子/护石贡献 → 用纯计算器复核合法样例 → 检查自动搜索。不要只因名称相似就替换 ID，也不要把 Wiki 说明中的未经核实参数直接写成游戏公式。参考 [armorSkillMigration.mjs](tools/runtime/armorSkillMigration.mjs)、[calculator.ts](api/loadout/calculator.ts)、[rules.ts](api/loadout/rules.ts)。

### 3. 自动配装找到解、证明无解、未搜索完是三种结果

护石的 A/B 技能、点数与孔位存在联合约束，不能把两个技能的最大值随意拼成“合法护石”。MH4G 当前使用有限的已验证生成结果，不代表穷尽全部生成路径；其他作品也必须尊重各自候选规则和覆盖提示。

搜索还受武器、性别、职业、固定装备、固定护石、珠子及时间预算影响。不能通过任意截断候选、把未知孔位视为零或只保留技能点最高的装备来简单提速。当前结果中的 `searchComplete`、`incompleteReason` 和 `coverageWarnings` 必须保留；超时或候选覆盖不足不能显示成“游戏中不存在配装”。

报告漏解时，最好提供一套可以手工成立的完整组合，再比较候选准备、技能累计和装珠求解。相关回归入口包括 [loadoutRuntimeSearch.test.ts](tests/loadoutRuntimeSearch.test.ts)、[guFiveSkillSearch.test.ts](tests/guFiveSkillSearch.test.ts) 和 [mh4gCharmWitnessRuntime.test.ts](tests/mh4gCharmWitnessRuntime.test.ts)。

### 4. 能写入某个数值，不代表它能自然生成

“自然合法性”和“结构可编码性”必须分开。未知或非法但可编码的手动实例可以保留并提示；记录长度、字段位宽、存档身份或结构无法编码时才阻断写入。自动生成候选则需要相应合法性证据。

发掘装备、固定装饰珠、猎虫、幻化和猎猫都可能包含普通图鉴条目没有的实例字段。需要完整实例时，不应凭一个模板 ID 凑出记录。未知位和未修改字段应原样保留，空值不能擅自补零。

### 5. 存档保存的完成标准是游戏能重新读取

格式差异包括文件头、大小端、校验、加密、角色槽、记录长度和容量。MH3G/MH3U、MHGU/MHXX 共享部分内容并不意味着存档布局可以直接复用。

维护 writer 时，应检查未修改往返的字节一致性、只修改目标字段、未知字节保留、坏文件拒绝、撤销恢复、失败不留下半份文件，以及原文件备份和写后回读。现有会话服务还检查原文件是否在外部发生变化。最后必须用对应版本的游戏或模拟器重新打开；程序自己能解析输出，只证明了一部分。

### 6. 运行资料版本与用户状态有不同的生命周期

运行 SQLite 由主进程只读打开；资料迁移在准备或打包阶段执行。修改影响配装的资料时，应更新相关构建元数据，使 `dataVersion` 能识别变化，再通过 [file.ts](api/loadout/file.ts) 对草稿和历史结果重新取数、计算和校验。

配装草稿及有限撤销历史按游戏保存在应用会话内。自动配装任务归主进程所有，关闭抽屉不取消任务；全局只有一个 Worker，其余排队，任务记录在 `app.getPath('userData')/state/loadout-jobs.sqlite`。这份用户状态库不是游戏资料，不能放入运行资产包、Git 或 Release。

### 7. 界面问题要按实际窗口尺寸复现

显示器分辨率不等于应用可用区域，还会受窗口大小和系统缩放影响。此前箱子十行格子的最小高度超过父容器，溢出的格子挡住了翻页按钮；修复是让格子区域独立滚动，底栏保持在外。

修改箱子和抽屉时，要实际点击翻页、检查键盘定位、焦点恢复、缩小窗口及缩放后的布局。工作抽屉通过 portal/fixed 覆盖页面，不能撑开正文布局，也不能叠第二层抽屉。参考 [SaveBoxWorkspace](ui/components/SaveBoxWorkspace/)、[设计令牌检查](tests/designTokens.test.ts) 及 [AGENTS.md](AGENTS.md) 的组件边界。

## 新作品如何接入

P2G 已接入本地七类图鉴、配装与存档编辑，详见 [P2G 本地接入](#p2g-本地接入)。G、2dos、P3、世界、崛起、荒野尚未接入，也没有排期。以下是贡献者可以选择的接入路径，不是恢复一轮跨作品重构的任务清单。

### 先选一作、一个版本、一个闭环

先写清游戏、地区、平台、更新版本、存档来源和此次目标。图鉴浏览、存档修改、手动配装、自动配装可以分别交付，不必同时实现。

一个合适的最小目标是：**识别一个版本的存档 → 只读显示道具箱 → 修改一个已确认的道具数量 → 备份保存 → 游戏内回读**。若从图鉴开始，则先完成一种对象的来源、名称、属性、关系及查询。完成最小目标后再扩展。

有 ISO 只能说明有原始输入。G、2dos 等 PS2 版本与 P2G、P3 等 PSP 版本仍需分别定位资源容器、压缩、文本编码、表结构及实际存档封装；游戏资源与模拟器保存文件是两条需要交叉验证的来源。

世界、崛起、荒野已有工具和社区资料可以参考，但应核对适用平台、版本及来源许可。现有三作配装器围绕技能点、阈值、正负技能和旧式孔位组织，不能直接把新作的技能等级、珠子槽等级或特殊组合规则套进去。先评估语义是否兼容，必要时为新作增加独立计算器和数据模型。

### 建议的实施顺序

1. **建立证据。** 记录输入版本、文件哈希、解析方法和抽样结果。没有 Dex 时，以游戏原生名称/文本键为基础，结合可追溯社区资料核对属性与关系；译名作为显示层，保留原文和来源，不用机器翻译结果充当身份依据。
2. **实现最小读取。** 存档方向先解析选定格式并保留未知字节；图鉴方向先生成该作自己的最小资料库。没有证据的字段保持未知，未实现的功能入口应关闭或明确显示待接入，不得调用其他游戏的数据或写入逻辑。
3. **建立身份对应。** 明确原生资源、展示条目与存档编号的关系，区分地区替换、性别/职业变体、占位和实例。用多个独立属性交叉验证，拒绝歧义，不按行号或名称相似度分配存档编号。
4. **打通安全修改。** 先做小范围字段补丁、校验、备份、保存和回读。用合成测试覆盖布局与边界，真实游戏回读验证另行记录，真实存档不提交。
5. **扩展到配装。** 装备与技能关系可信后，再实现该作计算器、手动样例和自动搜索。护石/随机装备规则不完整时，可先支持显式固定已有实例，并准确报告覆盖范围。
6. **完成交付。** 接入实际 UI、类型/schema、IPC、资料审计、测试和打包，验证现有三作没有回归；更新支持矩阵、已知限制及运行资产说明，再声明新增支持。

### 当前代码中要逐项检查的位置

项目目前**不是“放入一个插件文件就自动注册”的架构**。以下是接入检查入口，具体以新作涉及的功能为准：

| 范围 | 需要检查的位置与原因 |
| --- | --- |
| 内容身份和输入校验 | [api/core/loadout.ts](api/core/loadout.ts) 的 `GameId`，以及 [catalog/schemas.ts](api/catalog/schemas.ts)、[loadout/schemas.ts](api/loadout/schemas.ts)、[save/schemas.ts](api/save/schemas.ts) 中的枚举；只改 TypeScript 类型不会放开 IPC 校验 |
| 平台和存档格式 | [api/save/types.ts](api/save/types.ts) 的 `SaveFormatId` / `SAVE_ENVIRONMENTS`、[环境选择器](ui/components/SaveEnvironmentPicker/SaveEnvironmentPicker.tsx) 和 [save/ipc.ts](api/save/ipc.ts) 的打开文件逻辑，以及 schema 中的容量/字段位宽限制 |
| 实际存档读写 | [api/save/adapters/](api/save/adapters/)、[sessionService.ts](api/save/sessionService.ts) 的格式分派、字段补丁和装备创建；现有分支含 GU/XX 默认路径，新增枚举不能直接落入旧作分支 |
| 资料与存档桥接 | 新作自己的构建器/迁移、[api/catalog/](api/catalog/)、[api/save/catalogResolver.ts](api/save/catalogResolver.ts)；当前一些 Repository 内有游戏分支，并非全部数据驱动 |
| 配装规则与历史 | [api/loadout/](api/loadout/)、[ui/stores/](ui/stores/)；核对快照、技能计算、候选生成、保存格式及旧历史复核的兼容性 |
| 界面入口 | [ui/data/gameVersions.ts](ui/data/gameVersions.ts)、[workspaceNavigation.ts](ui/data/workspaceNavigation.ts)、[ui/App.tsx](ui/App.tsx) 和相关页面；平台选项和专属功能不能照搬旧作 |
| 审计和交付 | [audit_runtime_catalog.mjs](tools/audit_runtime_catalog.mjs)、[verifyPackagedRuntime.mjs](tools/runtime/verifyPackagedRuntime.mjs)、[CI 工作流](.github/workflows/ci.yml)、[package.json](package.json)；当前白名单包含四作数据库、译名词典、P2G 存档格式参数与 2,400 张图标，新加文件不会自动成为可发布资料 |

接入前可用 `rg "mh3g|mh4g|mhgu|SaveFormatId" api ui tools .github` 查找分支，再逐个确认；不要对命中结果做机械全局替换，也不要无依据扩大所有 schema 限制。

## 测试、发布与贡献

### 提交修复时留下可复现的信息

Issue 或 PR 请尽量说明应用版本、游戏/地区/平台/存档格式、复现步骤、预期与实际行为。界面问题补充窗口尺寸及系统缩放；配装问题补充武器、性别、目标技能、护石、固定装备/珠子、时间预算，最好附一套可手算验证的组合。

用小范围 PR 说明改动原因、来源证据、运行过的检查和仍未知的范围。涉及资料时说明来源与对应关系；涉及存档时提供不含真实用户数据的合成测试。不要为了提交 bug 报告公开整份存档或任务状态库。

按改动选择对应检查：存档解析看 [saveAdapters.test.ts](tests/saveAdapters.test.ts) 和 [saveSessionService.test.ts](tests/saveSessionService.test.ts)；配装规则看计算器及搜索测试；UI 看组件交互测试并做实际窗口回归。发布前执行前文完整公共检查命令。编译后的 Worker 还需按 [CI 工作流](.github/workflows/ci.yml) 设置 `GU_BUILT_WORKER=out/main/auto-search-worker.js` 后运行 [guBuiltWorker.test.ts](tests/guBuiltWorker.test.ts)。

### 源码、运行资产、研究输入分开维护

公开 Git 历史保存源代码、构建器、schema、合成测试和文档。四套游戏 SQLite、独立译名词典、P2G 存档格式参数 JSON、内容哈希图标及应用图标已获准通过独立公开 Release 和 Windows 应用包分发，仍不直接提交到 Git。

Dex 原件、ROM/ISO、完整 RomFS/ExeFS、原始资源容器、CSV、manifest、crosswalk、研究审计报告及用户存档不在该公开运行包授权范围内。后续新增作品的数据和图片不会自动继承本次分发范围，应单独明确来源和可发布文件。详见 [AGENTS.md](AGENTS.md)。

提交前检查 `git status --short`、`git diff --cached --name-only` 及对应文件的 `git check-ignore -v` 结果，避免把研究输出或运行资料强制加入版本控制。

### 发布方式

- `main` 推送和 Pull Request 执行类型检查、公共测试、资料审计、构建及编译后 Worker 检查。Windows 包只在 `v*` 版本标签触发，直接写入 Release，不经公开 Actions artifact 中转。
- 改动运行资料时，先备份并验证库、迁移和数据版本。需要新的基础运行包时，用新的 `runtime-assets-vN` 及校验值发布，并同步修改工作流下载位置、哈希和资料清单，不覆盖旧包破坏旧版本复现。现有 workflow 固定从本仓库下载资料；fork 发布自有资料时要同时修改下载仓库。
- 应用发布前更新 `package.json`、README 版本及 `docs/releases/v<版本>.md`，再推送匹配的版本标签。工作流会验证 Windows 原生 SQLite 模块、可执行文件图标以及包内数据库与已审计输入的一致性，生成 Windows x64 目录压缩包和 `SHA256SUMS.txt`，发布后设为最新版。
- 本地 Windows 可执行 `pnpm package:win` 构建目录包；公开发行仍需核对上述发布检查、对应格式回读和资料分发范围。

接手工作可以从复现一个 bug、补一个格式样例或独立验证一类数据开始。现有三作不需要先经过统一数据重构，才能继续修复或扩展。
