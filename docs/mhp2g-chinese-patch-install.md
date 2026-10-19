# MHP2G 简体中文插件测试版

版本：@VERSION@

这是供实际游戏测试的扩展汉化包，尚非整作全量汉化或稳定版。

@COVERAGE@

适用游戏为未修改的日版 MHP2G（游戏 ID：ULJM05500）。旧翻译组汉化镜像不适用。已有小样在 Windows PPSSPP 1.15.4 通过显示测试；本包新增内容的显示、保存重开和稳定性等待本次测试。其他 PPSSPP 版本、手机端和 PSP 实机尚未验收。

本包自带插件、译文、中文字库和许可说明。使用者自行准备原版游戏和 PPSSPP。

## 安装

1. 完全退出 PPSSPP。先备份自己的游戏存档；如果已经安装本插件，把旧的 `mhp2g_zh_cn` 文件夹移到 `PSP/PLUGINS` 之外留作回退。
2. 解压下载的 `mhp2g-zh-…-ppsspp.zip`。找到 PPSSPP 实际使用的 Memory Stick（记忆棒）目录，将压缩包内的 `PSP` 文件夹合并到该目录；已有文件夹保留。最终应存在下面的文件：

   ```text
   <Memory Stick>/PSP/PLUGINS/mhp2g_zh_cn/plugin.ini
   <Memory Stick>/PSP/PLUGINS/mhp2g_zh_cn/mhp2g_zh_cn.prx
   <Memory Stick>/PSP/PLUGINS/mhp2g_zh_cn/texts.bin
   <Memory Stick>/PSP/PLUGINS/mhp2g_zh_cn/zh-cn.pgf
   ```

   本项目独立测试目录使用 `<PPSSPP目录>/memstick`，其他安装的实际位置可能不同。不要放成 `PSP/PSP/PLUGINS`，也不要把插件放进游戏 ISO 或 `PSP/GAME`。
3. 开启 PPSSPP 的插件功能。若界面没有对应选项，在 PPSSPP 完全退出后，用文本编辑器打开实际 Memory Stick 下的 `PSP/SYSTEM/ppsspp.ini`，在已有的 `[General]` 节中添加或修改这一行，然后保存；不要覆盖整份配置：

   ```ini
   EnablePlugins = True
   ```

4. 启动 PPSSPP，从头启动日版游戏，正常读取游戏存档。此次安装或更新后不要读取安装前的即时存档。
5. 先检查房间装备箱的“更换装备”菜单，以及不同道具和装备的名称／说明，再按同包 `TESTING.zh-CN.txt` 测试。

插件和字体必须整套更新，不要混用不同版本文件。`mhp2g_zh_cn` 文件夹名必须保持不变。包内的 `OFL.txt`、`THIRD_PARTY_PGF.txt` 也应保留。

## 更新与停用

更新时完全退出 PPSSPP，把旧插件文件夹移出 `PSP/PLUGINS`，再放入新版完整文件夹并冷启动。

停用时完全退出 PPSSPP，将 `mhp2g_zh_cn` 文件夹移出 `PSP/PLUGINS`，再冷启动游戏。要回退旧版，则放回之前备份的完整插件文件夹。游戏 ISO 和 PPSSPP 程序本体不需要替换。

## 反馈

请附本包版本、PPSSPP 版本，以及出现问题的场景和复现步骤。需要判断文字排版时再附对应画面。

运行日志位于 `<Memory Stick>/PSP/PLUGINS/mhp2g_zh_cn/plugin.log`，上一轮日志为 `plugin.previous.log`。退出游戏后保留这两个文件供排查；无需上传整份存档、ISO 或整个模拟器目录。

校验文件 `SHA256SUMS.txt` 可用于核对包内文件。下载页另提供整个 ZIP 的 SHA-256。

构建标识：@BUILD_ID@
