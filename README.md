# MH Save Editor

统一的 Monster Hunter 存档编辑器，使用 React + Electron + TypeScript，支持 MH3G、MH4G 和 MHGU。

这是一次全新重写。旧 Qt 启动器和旧编辑器不再是运行时依赖，仅作为存档格式、数据库和测试迁移参考。

## 结构

```text
ui/       React 界面与公共配装器
api/      统一业务 API（不是 HTTP 服务）
desktop/  Electron 主进程与 preload
data/     三个游戏的只读 SQLite 数据库
tests/    业务规则和存档格式测试
```

配装器使用逻辑配装模型。装备箱只是读取来源，配装对象不保存装备箱编号或原始实例；只有写入存档时，游戏 adapter 才生成对应格式的存档记录。

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
```
