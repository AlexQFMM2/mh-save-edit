# MH Save Editor

统一的 Monster Hunter 存档编辑器，使用 React + Electron + TypeScript，支持 MH3G、MH4G 和 MHGU。

当前版本：**v0.1.10**。本次修复 MH4G 防具存档映射、自动配装候选缺失，以及道具箱和装备箱翻页遮挡，详见[更新说明](docs/releases/v0.1.10.md)。

这是一次全新重写。旧 Qt 启动器和旧编辑器不再是运行时依赖，仅作为存档格式、数据库和测试迁移参考。

当前进度：三作离线图鉴和不依赖存档的手动/自动配装器已经完成；五格式存档修改器初版及
阶段 3B 桥接主体也已接入，当前进入 UI 美化与测试验收。应用现在可区分 Citra/Cemu/Yuzu 环境，读取 MH3G、MH3U、MH4G、
MHGU 与 MHXX 存档，在主进程会话中修改个人信息、道具箱、装备箱和 GU/XX 猎猫，并提供撤销、
重做、兼容 CSV、同格式完整备份、图鉴加入、配装整套写入以及备份后的原子保存与回读复核。
会话头会持续显示精确存档格式和角色槽；箱子支持保持物理顺序的全域搜索与 Enter 跨页定位，
装备详情会显示武器、防具、猫装备、斩味、珠子和护石技能。GU/XX 切换猎猫支援倾向时会先预览
行动与技能结构改写，再按原生 A/B/C 规则重建；等级、EXP、训练和引用字段不会进入补丁。
正式发布前仍需完成 Windows 上五种格式的对应模拟器重开矩阵；猎猫等级与 EXP 保持只读，
随身装备、背包、快捷栏及尚未证明安全的箱格换位不在本轮范围。

## 结构

```text
ui/       React 界面与公共配装器
api/      统一业务 API（不是 HTTP 服务）
desktop/  Electron 主进程与 preload
data/     本地生成的只读 SQLite 挂载目录（数据不入 Git）
tests/    业务规则和存档格式测试
```

配装器使用逻辑配装模型。装备箱只是读取来源，配装对象不保存装备箱编号或原始实例；只有写入存档时，游戏 adapter 才生成对应格式的存档记录。

道具图鉴通过主进程只读 SQLite API 提供，React 不直接访问 SQL 或文件路径。图标统一
使用 `assetUrl()` 解析 `ui/public/assets/catalog/icons/` 下的内容哈希 PNG。数据库、manifest
和图标是从私有 `research` 输入生成的运行资产，不进入公开 Git 历史。已批准分发的运行数据库与图标通过独立 Release 提供，研究输入与审计文件不公开。

## 开发准备

需要 Node.js 22、pnpm 11。首次克隆后，在项目根目录下载[运行资产 v4](https://github.com/AlexQFMM2/mh-save-edit/releases/tag/runtime-assets-v4)，将 ZIP 中的 `data/`、`ui/public/assets/` 和 `build/` 按原目录结构解压到项目根目录。该包包含三作运行数据库与图标，无需密码；SHA-256 校验值见该 Release 的 `SHA256SUMS.txt` 和工作流中的 `RUNTIME_ASSETS_SHA256`。

```bash
pnpm install
pnpm data:repair:runtime
pnpm data:audit:runtime
pnpm dev
pnpm typecheck
pnpm exec vitest run --exclude tests/weaponCatalogData.test.ts
```

上面的测试命令与 CI 一致，不依赖私有 manifest。`pnpm test` 额外包含需要私有武器构建审计文件的检查；普通贡献者无需取得这些研究文件。

Linux 开发启动脚本会自动清理 Electron 的 Node 调试环境变量，并在开发模式下
追加 `--noSandbox`。这是 Electron 官方开发参数；正式打包不使用该参数。

## Windows 便携版

Windows x64 使用免安装目录包，附带 SHA-256 校验文件。运行所需的三套 SQLite
和图标由受控的运行资产注入，不进入 Git 历史。
Windows 可执行文件、启动窗口与任务栏统一使用 GU/XX 轰龙图标。

单文件 portable 会在每次启动时把完整 Electron 和图鉴数据解压到临时目录，因此不再作为
交付格式。下载 Release 中的 `mh-save-editor-v<版本>-windows-x64.tar.gz` 后只需解压一次，之后直接运行目录中的
`MH Save Editor.exe`，避免重复自解压造成的启动等待。

更新时将新版本整包解压到新目录，不要只替换可执行文件；资料修复需要同步更新包内数据库。
Dex、ROM、GMD、CSV、manifest、crosswalk 和其他研究输入不会进入桌面包。

维护者发布时先更新 `package.json` 与版本说明，再推送匹配的 `v<版本>` 标签。
`main` 推送与 Pull Request 自动执行类型检查、测试和构建；版本标签通过检查后，Actions 在 Windows 上打包并发布对应 Release。运行资产直接从公开的独立 Release 下载并校验哈希，贡献者和 fork 无须配置资产密码。
