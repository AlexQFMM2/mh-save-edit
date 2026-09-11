# MH Save Editor

统一的 Monster Hunter 存档编辑器，使用 React + Electron + TypeScript，支持 MH3G、MH4G 和 MHGU。

这是一次全新重写。旧 Qt 启动器和旧编辑器不再是运行时依赖，仅作为存档格式、数据库和测试迁移参考。

当前进度：三作道具、装饰品、技能、武器、防具、怪物和任务图鉴，以及 MHGU/XX 狩技、
武器动作值和猎猫图鉴均已完成第一版浏览闭环。不依赖存档的手动/自动配装器也已完成 3A
验收；下一步进入存档格式探测、装备箱导入、一键写入和阶段 3B 存档桥接。

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
和图标是从私有 `research` 输入生成的本地运行资产，不进入公开 Git 历史。

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
```

Linux 开发启动脚本会自动清理 Electron 的 Node 调试环境变量，并在开发模式下
追加 `--noSandbox`。这是 Electron 官方开发参数；正式打包不使用该参数。

## Windows 便携版

推送到 `main` 后，私有仓库的 GitHub Actions 会生成 `mh-save-editor-windows-x64`
构建产物，内含开箱即用的 Windows x64 便携版和 SHA-256 文件。运行所需的三套 SQLite
和图标来自密码保护的私有 Release 资产，由 Action 临时注入，不进入 Git 历史。
Windows 可执行文件、启动窗口与任务栏统一使用 GU/XX 轰龙图标。

该构建当前只用于仓库成员进行 Windows 实机预览，不是公开发行版。Dex、ROM、GMD、
CSV、manifest、crosswalk 和其他研究产物不会进入桌面包。
