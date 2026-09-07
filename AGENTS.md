# 项目开发规矩

## 组件化

- 尽量组件化，避免维护超长的单一文件。
- 每个页面、每个组件都必须有独立的 `.tsx` 和 `.css` 文件。
- 小程序页面按原生页面文件拆分，不把业务样式堆进全局样式文件。
- 页面和组件应保持清晰的职责边界；不要为了少几个文件，把多个页面或多个组件合并到一个文件中。

## CSS 职责边界

- 页面 CSS 只负责页面骨架、页面级布局、组件摆放，以及传给组件的尺寸变量。
- 页面 CSS 不得编写组件内部样式。
- 组件 CSS 只负责该组件内部布局、尺寸比例、状态样式和滚动区域。
- 新页面或新组件的主要样式不得继续堆进全局 `styles.css`。
- 全局样式只允许放真正全局的内容：reset、字体、根布局和基础设计变量。

## CSS 变量命名

- CSS 变量必须带所属前缀，前缀来自页面名或组件名，避免页面和组件之间互相污染。
- CSS 变量格式必须为：

  ```text
  --<组件或页面名字>-<组件或页面类型>-<具体变量>
  ```

- 组件默认尺寸必须写在组件自己的 CSS 文件中。
- 外部页面只能通过覆盖组件公开的 CSS 变量来传入尺寸。
- 组件内部尺寸必须从组件自己的变量或局部派生变量计算。
- 组件内部变量应使用组件前缀，不能直接复用页面私有变量。

## 全局排版与数据颜色

- 全项目字号只允许使用 `ui/styles.css` 中定义的五个排版档位：`caption`、`small`、`body`、`title`、`display`。
- 五档字号当前固定为：`caption = 11px`、`small = 13px`、`body = 15px`、`title = 20px`、`display = clamp(28px, 4vw, 48px)`；调整时只能修改全局令牌，不能在组件内重定义档位。
- 页面和组件不得直接声明 `px`、`rem`、`clamp()` 等私有 `font-size`，必须引用对应的 `--global-typography-font-size-*` 变量。
- ID、数量、价格、概率、孔位、技能点、武器数值和其他业务数据统一使用 `--global-theme-color-data`。
- `--global-theme-color-data` 当前引用 `--global-theme-color-gold-bright`；调整数据颜色时只修改全局令牌，不逐页替换颜色。
- 标题、正文、辅助说明分别使用全局主文字、次文字和弱化文字变量，不新增近似的硬编码米白色或灰棕色。
- 正负状态、武器属性、斩味等本身具有语义的颜色可以保留，但不能只依靠颜色表达含义，必须同时保留文字、符号或标签。

## 父页面与组件边界

- 父页面不能直接选择组件内部 DOM class 来修改组件宽高。
- 父页面需要调整组件尺寸时，必须覆盖组件公开的 CSS 变量。
- 如果组件需要新的可配置尺寸，应先在组件 CSS 中定义公开变量和默认值，再由父页面覆盖。
- 不得通过提高选择器权重、`!important` 或 DOM 结构选择器绕过上述边界。

## 示例

组件：`ui/components/GameCard/GameCard.tsx` 与 `GameCard.css`

```css
/* GameCard.css */
.game-card {
  --game-card-component-width: 280px;
  --game-card-component-padding: 16px;
  width: var(--game-card-component-width);
  padding: var(--game-card-component-padding);
}
```

页面只能这样传入尺寸：

```css
/* GameSelectorPage.css */
.game-selector-page {
  --game-selector-page-game-card-width: 320px;
}

.game-selector-page__card-slot {
  --game-card-component-width: var(--game-selector-page-game-card-width);
}
```

CSS 变量会从页面提供的容器继承到 `GameCard`。页面不得直接选择 `.game-card`，也不得修改组件内部的 `.game-card__body`、`.game-card__icon` 等 class 的尺寸。

## 数据源与宿主机只读访问

图鉴、存档格式和游戏资源开发必须先建立可追溯的数据证据。Dex 数据与游戏本体解包是两类独立来源，不能只根据其中一类猜字段、关系或图标映射。

### 宿主机入口

- Windows 宿主机 SSH：`win10@172.16.10.41`。
- Dex 原版、导出工具和导出结果：`D:\MH\DEX`。
- 三作游戏本体解包：`D:\MH\unpack`。
- 默认只允许只读查看。运行导出器、重新解包、覆盖文件、移动或删除宿主机内容前，必须取得用户明确授权。
- 不在仓库中记录密码、私钥或其他凭据；使用开发机已经配置好的 SSH 访问能力。

已验证可用的 UTF-8 顶层查看命令：

```bash
ssh win10@172.16.10.41 "powershell -NoProfile -NonInteractive -Command \"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-ChildItem -LiteralPath 'D:\MH\DEX' -Force | Select-Object Name,FullName,Mode | Format-Table -AutoSize\""

ssh win10@172.16.10.41 "powershell -NoProfile -NonInteractive -Command \"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-ChildItem -LiteralPath 'D:\MH\unpack' -Force | Select-Object Name,FullName,Mode | Format-Table -AutoSize\""
```

查看特定目录或定向搜索文件时，始终限定根目录、文件类型和输出数量：

```bash
ssh win10@172.16.10.41 "powershell -NoProfile -NonInteractive -Command \"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-ChildItem -LiteralPath 'D:\MH\unpack\mh4g-dex\direct_sql' -File -Filter 'DB_Wpn*.csv' | Select-Object -First 200 FullName,Length | Format-Table -AutoSize\""

ssh win10@172.16.10.41 "powershell -NoProfile -NonInteractive -Command \"[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-ChildItem -LiteralPath 'D:\MH\unpack\mhxx\cci_unpacked\romfs' -Recurse -File -Filter '*.arc' | Select-Object -First 200 FullName,Length | Format-Table -AutoSize\""
```

注意 Bash 会展开双引号中的 `$_`。远程 PowerShell 查询优先使用 `-LiteralPath`、`-Filter`、`Where-Object Name -Like` 等不依赖 `$_` 的写法；确需使用时必须正确转义。禁止对整个 `D:\MH` 做无过滤、无数量限制的递归输出。

### Dex 目录职责

原始 Dex 程序保留在以下目录，只作为权威输入，不直接修改：

- MH3G：`D:\MH\DEX\MH3G_Dex_v1.0Build9`
- MH4G：`D:\MH\DEX\MH4G_Dex_v1.0Build7`
- MHXX：`D:\MH\DEX\xx图鉴`

导出工具仍保留在 `D:\MH\DEX`。武器及后续数据分析的权威只读导出入口统一放在 `D:\MH\unpack\*-dex`；不要再把旧导出副本当正式构建输入：

| 内容库 | 导出工具 | 权威只读导出结果 |
| --- | --- | --- |
| MH3G | `D:\MH\DEX\mh3g-weapon-dex-dump-tool` | `D:\MH\unpack\mh3g-dex` |
| MH4G | `D:\MH\DEX\mh4g-weapon-dex-dump-tool` | `D:\MH\unpack\mh4g-dex` |
| MHGU/XX | `D:\MH\DEX\mhxx-dex-tool` | `D:\MH\unpack\mhxx-dex` |

`D:\MH\DEX` 中的 `mh3g-dex-dump\dump`、`mh3g-armor-dump\dump`、`mh3g-dex-raw`、`mh4g-dex-raw` 和 `mhxx-dex-raw` 只作为旧导出副本保留。在新旧文件数、行数和 SHA-256 闭环前，不删除、移动或覆盖这些旧结果。

Dex 结果目录中：

- `direct_sql` 是首选构建输入，文件名和原始 SQLite 表名一致。
- `tables` 是反射/运行时导出的数据表；名称混淆时必须通过同目录 `manifest.json` 的列名定位，不能根据文件顺序猜表。
- `sqlite_master.csv` 用于确认表、字段和索引是否存在，不能代替实际数据行。
- `manifest.json`、运行日志、`failures.txt` 和输入哈希必须与 CSV 一起审计；“表结构存在”不等于“表数据已经成功导出”。
- Dex EXE、DLL、内嵌数据库和 `.resources` 不进入 `mh-save-edit` 仓库。

### 游戏本体解包目录

当前 `D:\MH\unpack` 下有：

```text
D:\MH\unpack\mh3g\cci_unpacked
D:\MH\unpack\mh4g\cci_unpacked
D:\MH\unpack\mhgu\romfs\nativeNX
D:\MH\unpack\mhxx\cci_unpacked
```

3DS 三作目录均保留 `partition0.cxi`、`romfs.bin`、`exefs.bin` 和已展开的 `romfs`。MHGU 是从 Switch NSP 经 Yuzu“转储 RomFS”得到的已展开资源目录。开发时优先只读查看已展开的 `romfs`：

| 内容库 | 主要入口 |
| --- | --- |
| MH3G | `romfs\arc`、`romfs\GUI`、`romfs\quest`、`romfs\system` |
| MH4G | `romfs\data`、`romfs\system`；另有已展开的 `exefs` |
| MHGU（Switch） | `romfs\nativeNX\arc`、`romfs\nativeNX\table`、`romfs\nativeNX\system`；简中资源在 `nativeNX\chS`，另有 `chT`、`eng` 等本地化目录 |
| MHXX（3DS） | `romfs\arc`、`romfs\table`、`romfs\system` |

当前 MHGU RomFS 已核对到约 35,531 个文件、12,311,983,212 字节，并包含 `nativeNX\arc\weapon`、`nativeNX\arc\ui`、`nativeNX\table` 和多语言资源，可作为 Switch 版资源权威输入。该路径目前只有 RomFS，没有 ExeFS；如果任务涉及可执行程序逻辑而非资源数据，需要另行转储 ExeFS，并单独记录来源和哈希。

`D:\MH\unpack\mhgu` 与 `D:\MH\unpack\mhxx` 是两个独立权威输入。MHGU 与 MHXX 可以共享经过逐项验证相同的内容数据，但涉及资源路径、ID、本地化、版本差异或存档格式时必须分别验证，不能因为游戏内容相近直接复用。

#### 使用 Yuzu 转储 Switch 游戏资源

Yuzu 的“转储 RomFS”就是本项目需要的 Switch 游戏资源解包方式。它利用模拟器已经配置的合法密钥和已识别游戏内容，输出解密后的文件树；适合取得表、图标、贴图、UI、音频索引和本地化资源，不必手工拆 NSP 容器。

操作约定：

1. 在 Yuzu 游戏列表中找到已识别的 MHGU。
2. 右键游戏，选择“转储 RomFS”或对应版本中的“Dump RomFS”。有“完整/Full”和“骨架/Skeleton”选项时选择完整转储。
3. 游戏有更新时，明确记录转储是否应用更新；基础 NSP 与更新后的 RomFS 不能混作同一数据版本。
4. 转储完成后从 Yuzu 打开的 dump 位置复制到 `D:\MH\unpack\mhgu\romfs`，保留 `nativeNX` 根目录结构。
5. 记录 Title ID、基础游戏/更新版本、转储时间、文件数、总大小和关键文件 SHA-256。没有这些信息时只能称为当前资源快照，不能声称可重复构建。

如需研究程序逻辑，再使用“转储 ExeFS / Dump ExeFS”；RomFS 与 ExeFS 必须分目录保存。不要运行来源不明的第三方 NSP 解密脚本，也不要将 keys、ticket、证书、NSP、NCA 或完整转储提交到仓库。

不得把大型 `partition0.cxi`、`romfs.bin`、完整 ROM、ExeFS 或整棵 RomFS 复制进仓库。只提取当前任务需要且许可允许分发的最小数据、图标或映射结果。

### 选择性复制到研究区

Windows OpenSSH 路径已经验证使用 `/D:/...` 形式。只复制明确需要的小文件到 `/tmp` 或 `research`，例如：

```bash
scp "win10@172.16.10.41:/D:/MH/unpack/mh4g-dex/manifest.json" /tmp/mh4g-host-manifest.json
```

正式研究输入按游戏放入：

```text
/home/alexqfmm/workPlace/mh3gabout/research/mh3u/
/home/alexqfmm/workPlace/mh3gabout/research/mh4g/
/home/alexqfmm/workPlace/mh3gabout/research/mhgu/
```

当前 Dex 固定快照为：

```text
research/mh3u/dex/mh3g-dex   <- D:\MH\unpack\mh3g-dex
research/mh4g/dex/mh4g-dex   <- D:\MH\unpack\mh4g-dex
research/mhgu/dex/mhxx-dex    <- D:\MH\unpack\mhxx-dex
```

每个目录必须整体保留 `direct_sql`、`tables`、`manifest.json`、`source-manifest.json`、日志和失败记录。三套 `source-manifest.json` 已记录 Windows 原路径、文件大小、逐文件 SHA-256、导出工具和 UTC 日期；构建器只从这些 Linux 固定快照读取。

复制后记录原始 Windows 路径、文件大小、SHA-256、提取工具/命令和日期。转换器只读取 `research` 中固定下来的输入，GitHub Action 和正式应用不得在构建或运行时依赖宿主机路径。

### 数据完善顺序

1. 从 Dex 取得名称、数值、关系、显示枚举和 Dex 客户端已经实现的解释逻辑。
2. 从游戏 RomFS/ExeFS 补充并交叉验证图标、贴图、原生表、资源键和版本差异。
3. 建立 Dex ID、游戏资源 ID、存档 ID 的显式 crosswalk，禁止按行号、文件顺序或名称相似度直接等同。
4. 为每个输入保存来源、来源 manifest 和审计报告；关系端点、图标和可读名称未闭合时不得开始对应 UI。
5. 生成后的 SQLite、PNG、manifest、crosswalk 和审计报告也默认属于私有研究产物，只保存在 `research`；未取得用户对具体文件的明确发布授权前，不得进入 `mh-save-edit/data`、`ui/public/assets`、GitHub Action artifact 或 Release。

## 研究产物与公开仓库边界

- `mh-save-edit` 公开 Git 历史只保存源代码、构建器、schema、不含受限数据的测试和文档。
- 从 Dex、游戏本体、存档或旧修改器整理出的数据库、图标、图片、CSV、JSON manifest、crosswalk、审计报告、`.resources` 和其他中间产物一律默认为私有，不得被 Git 跟踪。
- 本地构建需要的生成产物放在 `/home/alexqfmm/workPlace/mh3gabout/research/generated/mh-save-edit/`，可按需复制到项目的已忽略路径，但不能用 `.gitignore` 反向规则强制加入。
- 工作区最外层不得散落 `.resources`、CSV、SQLite、图标导出目录或临时分析结果；发现后应按游戏和用途归档到 `research`，无法判定归属时放入 `research/archive/unclassified/`。
- 每次提交前必须用 `git status --short`、`git diff --cached --name-only` 和 `git check-ignore -v` 检查数据边界；发现上述文件必须停止推送。
- 技术上可重建、可打包不等于可公开分发。只有用户明确批准的独立发布包才能包含指定数据产物，且不得由公开 Git 历史或公开 Action artifact 中转。
