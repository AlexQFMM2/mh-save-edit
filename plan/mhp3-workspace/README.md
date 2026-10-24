# P3 入口与工作区框架

- Owner：项目维护者 / 当前实施者
- Status：已完成
- Created / Updated：2026-10-24
- Repository：`mh-save-edit`
- Execution：单代理串行

后续接入：道具与独立装饰品已开放，功能级身份和词典范围已扩展；以下框架验收保持历史阶段含义。当前实现与源码交付见[装饰品交接](../mhp3-decoration-catalog/handoff.md)，不按本页历史占位状态判断当前能力。

## 范围与决定

用户确认剩余原生研究在实现具体功能时再继续，并要求使用宿主机 `C:\Users\win10\Downloads\mhed` 中切好的两张 P3 图片，将入口和框架加入项目，适用平台与 P2G 一样为 PPSSPP。

复用游戏选择卡片、总览、侧栏和功能占位页面。`ui/data/gameVersions.ts` 维护作品入口和平台；`hasRuntimeWorkspace` 区分仅有框架的 P3 与已有功能的四作。P3 不加入图鉴／配装／存档服务的游戏枚举；路由守卫在渲染业务页前返回待接入页面，后续按实际能力逐步替换。

本轮提供：P3 卡片与背景、PPSSPP 标识、总览、七类图鉴及修改／配装共九个导航入口。修改功能尚未开放，总览“打开存档”禁用；每个入口可查看对应待接入说明。不安装插件、不增加数据库或存档格式、不发布 Release。未完成研究保留在[原生核查计划](../mhp3-investigation/README.md)，不是本轮框架验收的依赖。

## 图片与组件边界

- 用户指定的 `p3-post.png` 原样加入 `ui/public/assets/home/p3-post.png`；横图用卡片自身的 `posterFit` 配置完整显示，不重裁。
- `p3-bg.png` 转为 `ui/public/assets/home/p3-bg.webp`，保持原尺寸；原图、来源与哈希记录只放已忽略 `.runtime-assets/p3-workspace-20261024/`。
- 本次使用授权针对上述两张用户指定入口图片，不延伸为原生研究输入或运行数据库发布授权。
- 五个游戏卡片在宽窗口并排，窄窗口由 `GameVersionGrid` 自身负责换列。卡片标题沿用全局 title 档，页面不改组件内部样式。
- 业务页只接收已启用运行功能的 `WorkspaceOutletContext`；全局词典从 P3 打开时显示现有全部游戏，不提交不存在的 P3 图鉴请求。

## 验收与恢复

任务详情见 [tasks.md](tasks.md)，状态见 [taskList.md](taskList.md)。类型检查、生产构建已通过；四个定向测试文件共 37 项通过，包含 P2G 已有图鉴／存档环境／配装回归和 P3 九条直接路由的服务隔离、键盘导航与词典默认范围。

浏览器 1440×900 与应用最小宽度 1024×768 的图片、布局、键盘进入、总览和修改占位页验证通过：无横向溢出、无浏览器脚本异常，两种尺寸共六张截图仅保留在已忽略工作目录。总览组件按内容高度排列，避免平台栏被多余拉伸。首次测试命令误扫描本地旧发行副本，已中止，最终验收只使用 `--dir tests` 的上述定向测试；不将未完成的全库运行计为通过。

验收命令：`pnpm typecheck`、`pnpm build`、`node node_modules/vitest/vitest.mjs run --dir tests tests/homeEntryUi.test.tsx tests/gameVersions.test.ts tests/workspaceNavigation.test.ts tests/itemTerminologyUi.test.tsx`。两张图片已进入本地产物，`git diff --check` 和文档本地链接检查通过。P3 功能仍未接入，本计划完成仅指入口与框架；无提交、推送或发行。

回退只撤销本轮 P3 配置、路由门禁／类型边界、组件调整及两张入口资源，不回滚工作区已有 P2G 与文档整理改动。当前无部署、数据迁移或宿主机写入。

## 变更记录

- 2026-10-24：通过本地 `ssh_admin --connect` 连接已登记 Windows 主机，只读核对并复制两张图片；入口及功能隔离框架、类型／构建／37 项测试、两种窗口浏览器验收完成。研究余项按用户要求延后。
