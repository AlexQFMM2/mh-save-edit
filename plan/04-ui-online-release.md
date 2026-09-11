# 阶段 4～6：UI、美化、在线复用与发布

## 1. 前三阶段的最小 UI

核心功能开发期只要求简单、明确、能运行：

- 左侧一级导航：图鉴、存档、配装、广场、账号。
- 顶部常驻当前游戏与存档格式提示。
- 普通表格、搜索框和表单即可，不提前投入复杂动画。
- 危险操作使用确认和修改摘要；只读、警告、错误状态清楚区分。
- 加载、空结果、失败、离线和未打开存档都有明确页面状态。

即使是临时 UI，也必须遵守 `AGENTS.md`：页面和组件各自拥有 `.tsx`、`.css`，页面 CSS 不穿透
修改组件内部尺寸。

## 2. 阶段 4：统一 UI 美化

核心闭环稳定后再统一完成：

- 设计 token、字体、颜色、间距、圆角、阴影和层级。
- 公共按钮、输入、选择器、表格、虚拟列表、标签、提示、对话框和错误状态。
- 图鉴、存档编辑、配装器、广场和账号使用同一套布局与交互语言。
- 响应式适配最低窗口尺寸和 1366×768 常见桌面。
- 键盘导航、焦点可见性、对比度、非颜色状态提示和屏幕阅读标签。
- 通过 `motion` 增加页面切换、抽屉和列表状态动效，同时尊重 `prefers-reduced-motion`。

动效不能包裹大表格每一行造成性能问题，也不能掩盖保存进度或错误提示。

## 3. 阶段 5：复用现有在线平台

在线能力直接复用：

```text
/home/alexqfmm/workPlace/mh3gabout/mhed-platform
```

该项目已经具备：

- Go REST API 和 OpenAPI 合同
- PostgreSQL 账号、会话、配装、点赞、举报和审核数据
- 桌面登录、注册、邮箱验证码、绑定邮箱和密码找回接口
- MH3G、MH4G、MHGU/XX 配装适配器
- Web、Admin、生产部署、备份和审计

新桌面端只实现 API client 和页面，不在 Electron 内复制 Go 服务或 PostgreSQL 逻辑。

## 4. 在线接入顺序

1. 从 `contracts/openapi.yaml` 生成或维护有类型的桌面 client。
2. 接入 `/v1/meta`，校验服务器协议、游戏和数据版本。
3. 接入公开广场列表与详情；未登录、未读档也可浏览。
4. 将广场配装导入本地逻辑配装器，并用本地数据重新计算。
5. 接入桌面登录、注册、验证码、找回密码、邮箱绑定和昵称。
6. 接入发布、我的配装、删除、点赞和举报。
7. 验证 MH4G 发掘参数和 MHGU/XX 36 字节协议兼容。

服务器当前以 `game=mhgu` 同时承载 Switch MHGU 和 3DS MHXX。桌面内部仍保留两个
`SaveFormatId`，发布时映射到服务器既有游戏分类和平台字段，不能因此合并本地存档 adapter。

## 5. 隐私与认证边界

- 服务器永不接收完整存档、存档路径、角色名或装备箱内容。
- 发布内容只包含版本化标准配装协议。
- 服务器摘要不权威；导入后由本地 SQLite 和计算器复核。
- Bearer token 不暴露给 renderer，由主进程安全保存并代理请求。
- 日志不输出密码、验证码、token、邮箱全文或配装中的原始未知字节。
- 离线、超时、TLS 错误和版本不兼容不会改变本地配装或存档。
- 邮件 Provider 是否启用是部署配置问题，不阻塞本地功能或已有账号登录。

## 6. 阶段 6：GitHub Actions 和 Release

持续集成从阶段 0 开始建设，每次提交执行：

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
在受控的私有数据注入环境中执行 manifest 和图标引用校验
```

发布 workflow 在版本 tag 上：

1. 仅在已获得数据分发授权的受控 Windows runner 中注入私有数据并构建 Electron portable。
2. 在不上传数据中间产物的前提下，校验三个 SQLite、manifest、图标包和 preload 安全设置。
3. 执行公开合成夹具和不含私人样本的回归测试。
4. 生成版本说明、文件 SHA-256 和支持格式清单。
5. 只有用户明确批准该版本所含数据的发布方案后，才创建 Release 并上传产物。

私有真实存档、Dex 可执行文件、CCI/RomFS、`.resources`、生成 SQLite、manifest、
crosswalk、审计报告和未经确认许可的图标素材不能上传公开 Git 历史、Action artifact 或 GitHub Release。

### 6.1 Windows 预览构建

当前 `main` 分支推送会在私有仓库的 Windows runner 生成开箱即用的 x64 portable，并上传为
保留 7 天的成员可见 Action artifact，同时附带 SHA-256。该产物用于验证 Windows 启动、
Electron 原生模块、preload、完整图鉴和界面兼容性，不作为公开 Release。

本次经用户明确批准，三套运行时 SQLite 和图标使用密码保护的 `runtime-assets-v1` 私有
Release 资产保存；密码仅存在于 Actions Secret。Action 先验证干净 checkout 不含私有资产，
再临时解密并只将三套 SQLite 与 1,941 个内容哈希 PNG 注入便携版。Dex、ROM、GMD、CSV、
manifest、crosswalk、审计报告和其他研究输入仍禁止上传。

## 7. UI 与在线验收

- 五种存档格式在每个编辑页面都有持续可见的身份提示。
- 图鉴、配装和本地编辑断网可用。
- 键盘可以完成打开存档之外的主要页面操作。
- 一万条广场数据分页不会阻塞 UI。
- 登录过期、版本冲突和服务端错误具有可恢复状态。
- 发布/导入的配装在本地重新计算结果与服务端适配器一致。
- 正式包不包含研究目录和私有样本。
