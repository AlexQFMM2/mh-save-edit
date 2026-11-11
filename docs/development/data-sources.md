# 原生资料与宿主机读取

本文保存本项目的资料位置与读取方法；来源优先级、分表和身份规则见 [AGENTS.md](../../AGENTS.md)。`research` 均指仓库同级的 `/home/alexqfmm/workPlace/mh3gabout/research/`。这些是维护环境入口，应用、CI 和离线构建不得依赖宿主机连接。

## 先读取登记，再限定查询

```bash
ssh_admin --list
ssh_admin --connect
```

使用当前登记的 Windows 宿主机，不照抄旧交接中的 IP。默认只读，先检查已展开资源和专题交接；已有可用解包时不重新解包。导出器执行、落盘转换、覆盖、移动或删除宿主机文件需要对应操作的明确授权；已有授权范围内继续执行，不重复确认。密码、私钥、密钥和其他凭据不进入仓库、日志或报告。

以下命令需先将占位值换成登记中的 `用户@主机`；示例查询不会写宿主机：

```bash
mh_host='<当前登记的用户@主机>'
ssh "$mh_host" "powershell -NoProfile -NonInteractive -Command \"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-ChildItem -LiteralPath 'D:\MH\unpack' -Force | Select-Object -First 40 Name,FullName,Mode | Format-Table -AutoSize\""
ssh "$mh_host" "powershell -NoProfile -NonInteractive -Command \"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-ChildItem -LiteralPath 'D:\MH\unpack\mh4g-dex\direct_sql' -File -Filter 'DB_Wpn*.csv' | Select-Object -First 200 FullName,Length | Format-Table -AutoSize\""
```

每次限定根目录、文件类型、关键词和返回数量；递归前先缩小到相关子目录，不对整个 `D:\MH` 无界枚举。不依赖 `$_` 的 `-LiteralPath`、`-Filter`、`Where-Object Name -Like` 写法更容易避免 Bash 展开；确需变量时正确转义。PowerShell 输出使用 UTF-8，不能把终端乱码当作源文本。

只读分析可在宿主机内存中解析已确认的小表或资源，返回必要字段、坐标、哈希或获准的图片派生物。原始 ISO、DATA、EBOOT、ARC、TEX、完整纹理图集、RomFS 和 ExeFS 留在宿主机，不整包复制到 Linux。连接失败、解析失败、返回空值分别记录；它们都不能单独证明“游戏没有该资源”。

## 游戏原版入口

| 作品 | 已有原版入口 | 读取重点 |
| --- | --- | --- |
| P2G 日版 | `D:\MH\unpack\mhp2gjp` | 已核对 ISO 与展开目录；BOOT、DATA 中的定向表和资源 |
| P3 日版 | `D:\MH\unpack\mhp3jp` | 已核对 ISO 与展开目录；原版 EBOOT、DATA 与文本／图标消费者 |
| MH3G | `D:\MH\unpack\mh3g\cci_unpacked\romfs` | `arc`、`GUI`、`quest`、`system` |
| MH4G | `D:\MH\unpack\mh4g\cci_unpacked\romfs` | `data`、`system`；同级另有已展开 `exefs` |
| MHGU（Switch） | `D:\MH\unpack\mhgu\romfs\nativeNX` | `arc`、`table`、`system`、`chS`、`chT`、`eng` |
| MHXX（3DS） | `D:\MH\unpack\mhxx\cci_unpacked\romfs` | `arc`、`table`、`system` |

P2G 的 `D:\MH\unpack\mhp2g\P2G-CGCN` 是旧汉化辅助输入，不代替日版原文。P3 已有原版主程序解密及校验成果；旧记录中 BOOT 全零不再是阻碍，不据此再次索取 EBOOT 或重新解包，详见 [P3 研究交接](../../plan/mhp3-investigation/handoff.md)。版本、成员号、精确路径和哈希以各专题私有 manifest 为准。

3DS 目录还保留 `partition0.cxi`、`romfs.bin`、`exefs.bin`，优先使用已有展开树。MHGU 与 MHXX 为两个独立输入，资源键、编号、本地化及存档布局必须分别验证；内容相似不构成互换依据。

### GU 完整 RomFS 与本地子集

宿主机 `D:\MH\unpack\mhgu\romfs` 是完整输入。Linux `research/mhgu/romfs` 的约 92 MB 表格子集不代表完整解包，不能据本地找不到文件就认定原版缺资源。

2026-09-13 的只读统计为 35,531 个文件、12,311,983,212 字节；`nativeNX` 下有 14,511 个 ARC、1,778 个 TEX、1,972 个 GUI。这是已有快照统计，不替代下一次使用时的版本及哈希核对。已确认入口：

- `nativeNX\arc\ui`、`arc\player`、`arc\otomo`：UI、猎人及猎猫资源。
- `nativeNX\table`、`chS`、`eng`：表格及本地化资源。
- `nativeNX\eng\GUI\02_common\menu\menu_equipDetail.gui`、`menu_equipMenu.gui`、`02_common\i_box.gui`、`04_lobby\shop`、`99_texture`：装备详情、箱子及商店等 UI。

图标研究先追选择函数、纹理、atlas 坐标、调色板和透明度；不凭文件名或序号猜对应关系。需要图片时，只处理已确认的单个纹理及所需区域，生成 PNG 主资源，按需提供 WebP。落盘转换须有授权，原始容器和图集不随派生图片复制。

### 已授权需要新转储时

MHGU 现有 RomFS 来自 Yuzu“转储 RomFS”。新的转储仅在确有缺口并获授权时进行：从已识别的合法游戏条目选择完整转储，明确基础版／更新版，保留 `nativeNX` 目录结构；记录 Title ID、版本、时间、文件数、大小及关键 SHA-256。缺少版本信息时只能称为当前资源快照。

现有 MHGU 入口只有 RomFS，没有 ExeFS。研究执行逻辑需要另行取得 ExeFS，单独记录来源和哈希；不得用 RomFS 的存在声称程序已核查。不要运行来源不明的 NSP 解密脚本，也不提交 keys、ticket、证书、NSP、NCA 或完整转储。

## Dex 辅助来源

Dex 用于名称、关系、显示枚举和客户端解释逻辑的交叉核对。本作原生记录及实际消费者与 Dex 冲突时，以已验证的本作证据为准并保留差异；原生字段尚未解析时可明确采用 Dex 来源，不能把它写成原生已验证。

| 内容 | 原始程序（只读） | 导出工具 | 正式导出结果 |
| --- | --- | --- | --- |
| MH3G | `D:\MH\DEX\MH3G_Dex_v1.0Build9` | `D:\MH\DEX\mh3g-weapon-dex-dump-tool` | `D:\MH\unpack\mh3g-dex` |
| MH4G | `D:\MH\DEX\MH4G_Dex_v1.0Build7` | `D:\MH\DEX\mh4g-weapon-dex-dump-tool` | `D:\MH\unpack\mh4g-dex` |
| MHGU/XX | `D:\MH\DEX\xx图鉴` | `D:\MH\DEX\mhxx-dex-tool` | `D:\MH\unpack\mhxx-dex` |

- `direct_sql` 优先，文件名对应原 SQLite 表名；`tables` 为反射／运行时导出，混淆表名按 `manifest.json` 的列名定位，不能按文件顺序猜表。
- `sqlite_master.csv` 只证明结构存在；必须检查真实行、`manifest.json`、日志、`failures.txt`、输入哈希和完整性，不能把建表成功当作数据导出成功。
- `D:\MH\DEX` 下的 `mh3g-dex-dump\dump`、`mh3g-armor-dump\dump`、`mh3g-dex-raw`、`mh4g-dex-raw`、`mhxx-dex-raw` 是旧副本。新旧文件数、行数和 SHA-256 对账前不删除、移动或覆盖；也不把它们重新当正式输入。
- Dex EXE、DLL、内嵌数据库及 `.resources` 不进入仓库。

## 固定快照与离线重建

正式研究输入按 `research/mh3u/`、`mh4g/`、`mhgu/`、`mhp2g/`、`mhp3/` 分开；注意 MH3G 的历史研究目录叫 `mh3u`，不是运行库标识变更。现有 Dex 固定输入：

| Linux 快照（相对 `research`） | Windows 来源 |
| --- | --- |
| `mh3u/dex/mh3g-dex` | `D:\MH\unpack\mh3g-dex` |
| `mh4g/dex/mh4g-dex` | `D:\MH\unpack\mh4g-dex` |
| `mhgu/dex/mhxx-dex` | `D:\MH\unpack\mhxx-dex` |

快照保留 `direct_sql`、`tables`、manifest、`source-manifest.json`、日志和失败记录；记录 Windows 原路径、大小、SHA-256、提取命令／工具和日期。只读探针同时保留脚本、返回码、标准输出、错误输出及结果哈希；失败记录不覆盖，修正后另建版本。

Windows OpenSSH 已验证 `/D:/...` 路径。仅复制本轮需要且允许保存的小文件，例如：

```bash
scp "$mh_host:/D:/MH/unpack/mh4g-dex/manifest.json" /tmp/mh4g-host-manifest.json
```

`/tmp` 仅作中转。审计后固定到私有研究区，构建器只读这些冻结输入；输出到 `research/generated/mh-save-edit/` 的新版本目录，不覆盖输入或旧成果。若已有构建器仍写死 `/tmp` 或宿主机路径，先核对并修正输入契约，不直接执行全套构建。安装与恢复遵循对应作品文档，不用早期道具子集覆盖已追加装备／技能的完整运行库。

## GU/XX 动作资源的专题例外

已冻结的 `research/mhgu/motion-values/` 是该专题固定入口，不从项目根、Downloads 或 `/tmp` 构建。既有 `native/mhgu`、`native/mhxx` 保存获准的 14 类猎人武器 `w00`～`w14`（没有 `w05`）及 `wbc` 最小 ARC；`styles/<版本>` 保存每类 `m0`～`m5` 六风格命令包。这一既有最小研究集不扩大为任意复制 ARC 的授权。

`localization` 保存中英日 `HN_WeaponControlsMsg_*.gmd`，动作名按稳定键对照，不用机器翻译冒充原生文本。用户图片在 `references/user-images`，第三方对照快照在 `references`，均不作为运行资源。

动作记录保留变体及顺序 Hit，不只保留合计；HDP、HDS、LMT、FUP、XFS 的未知字段不凭截图或位置猜填。猎猫 `w15` 不混入猎人图鉴，3G／4G 不复用 GU／XX 动作值。ARC、GMD、参考图片、真实 SQLite／CSV／JSON、manifest、crosswalk 和审计均保持私有。
