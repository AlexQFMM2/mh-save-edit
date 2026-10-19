MHP2G 简体中文插件的首个公开测试包，用于开始实际游戏测试。**这是 Pre-release，尚非全量汉化或稳定版。**

下载资产中的 **`mhp2g-zh-v0.1.0-test.1-ppsspp.zip`**。GitHub 自动生成的 Source code 压缩包不包含插件运行文件。

安装方法：

1. 完全退出 PPSSPP，备份存档；如已有本插件，将旧文件夹移出 `PSP/PLUGINS` 留作回退。
2. 解压 ZIP，把其中的 `PSP` 文件夹合并到 PPSSPP **实际使用的 Memory Stick 目录**。
3. 确认最终存在 `<Memory Stick>/PSP/PLUGINS/mhp2g_zh_cn/plugin.ini`，开启 PPSSPP 插件功能，再冷启动未修改的日版游戏。安装或更新后不要读取之前的即时存档。

本项目独立环境的 Memory Stick 是 `<PPSSPP目录>/memstick`；其他安装的位置可能不同。若设置界面没有插件选项，可在模拟器关闭时编辑 `<Memory Stick>/PSP/SYSTEM/ppsspp.ini`，在已有 `[General]` 节设置 `EnablePlugins = True`。ZIP 内的 `README.zh-CN.txt` 包含完整安装、更新与停用方法，`TESTING.zh-CN.txt` 包含实际测试步骤。

支持范围与当前进度：

- 对应未修改的日版 MHP2G，游戏 ID **ULJM05500**。
- 已有小样在 **Windows PPSSPP 1.15.4** 通过显示测试；本扩展包的显示、保存重开及稳定性等待本次测试。其他版本、手机端和 PSP 实机尚未验收。
- 接入 **7,844 条文本引用**：核心菜单、已索引的道具／武器／防具名称、部分道具说明、部分场景菜单及农场对白等。
- 仍有日文：其他装备说明、NPC 长文、教程／训练／任务入口及标题图片等。全部已知文本翻译尚未完成，完整覆盖和 G1 未通过。
- 本次仅重包已完成离线检查的 `known-text-v1-B-2fc4bffbf28983a2`，6 个运行文件逐字节保持一致。

下载包只包含插件、译文、中文字库、许可说明、测试／安装说明和校验文件。使用者自行准备原版游戏和 PPSSPP；安装无需修改 ISO 或替换 PPSSPP 程序。

测试时先检查装备箱、装备／道具名称及说明、农场与猫厨房，再验证正常任务流程、游戏内保存后退出重开，以及停用／恢复。反馈请附补丁版本、PPSSPP 版本、场景和复现步骤；退出后保留插件目录内的 `plugin.log`、`plugin.previous.log`。

ZIP 大小：551,817 字节。SHA-256：

```text
3a1d62f4ddb4fe6e507d3ef481d0b42921def1bcbac41995c842dc8b8a01307f  mhp2g-zh-v0.1.0-test.1-ppsspp.zip
```
