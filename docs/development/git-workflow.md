# Git 开发、交接与发行

自 2026-11-11 起，`release` 是默认分支和唯一生产发行来源。`main` 保留迁移前历史，不再作为开发或发行入口。一个项目使用当前这一个工作目录和开发环境，同一时刻只有一个活动任务分支。

## 日常开发

1. 接手先看 `git status --short --branch`、当前 HEAD 和任务交接，再成功执行 `git fetch origin --prune`。比较远端 `release` 与当前任务分支；不能把旧远端引用当成已同步。
2. 新工作从干净且已同步的 `release` 创建 `feat/<专题>`、`fix/<问题>` 或 `hotfix/<事故>`。既有任务继续原分支，不直接在 `release` 上改代码。
3. 每个可恢复阶段提交源码与交接；未完成的检查点可标记 WIP。获准后推送同名任务分支作远端备份。停止、切换或移交前先保存当前工作，不能把 stash 当长期交接，也不通过 reset/clean 丢弃改动。
4. 完成后同步最新 `release`，在任务分支解决冲突，运行与变更有关的检查；固定提交后单独审查，记录 base/head、结果、剩余限制和恢复方式。单代理时明确写“自审”，不声称独立审批。测试通过不替代业务验收或发行授权。
5. 审查完成且该提交的 GitHub `check` 成功后，在同一目录快进合入 `release` 并推送。若不能快进，回任务分支整合再测；不要强推。核验最终远端 SHA、CI 和干净状态。

典型合入操作（前提是任务已完成审查、测试且已获准同步）：

```bash
git fetch origin --prune
git switch release
git merge --ff-only origin/release
git merge --ff-only fix/example
git push origin release
git status --short --branch
git rev-list --left-right --count 'HEAD...@{upstream}'
```

`release` 分支保护要求 `check` 成功并保持基线同步，禁止强推和删除，管理员也适用。不要求第二个人审批，也不强制为个人维护创建 PR；使用 PR 时目标必须为 `release`。分支保护由 GitHub 仓库设置维护，不能只凭本文认定已经启用；本次实际设置与验证见[基线交接](../handoffs/release-baseline-20261111/codex.md)。

## 交接和任务材料

每个新任务的代理交接固定保存为 `docs/handoffs/<task-id>/<agent-name>.md`，与源码同分支提交，写清目标、分支、基线 SHA、已完成／未完成、实跑检查、业务保留项和下一步。只保存审查结论与证据位置，不提交真实数据、截图或完整日志。

既有 `plan/` 专题沿用原路径，不因流程调整搬迁。新任务需要独立计划或临时测试工作台时，使用仓库同级的 `../plan/mh-save-edit/<task-id>/` 与 `../test/mh-save-edit/<task-id>/`；小修复可以只写版本化交接。研究输入、运行库与生成资产仍遵守已有 `../research/` 边界。外部材料不随切分支变化，复用前必须核对任务和候选版本；标准合成回归测试继续提交到 `tests/`，CI 不依赖外部工作台。

紧急修复从已部署版本或经核实兼容的 `release` 出发。先把未完成功能保存到原任务分支，再切修复分支；修复也须经过审查、合入 `release` 和验证。完成后将更新的 `release` 合回需要继续的功能分支。切分支不会切换数据库或停止进程，不能擅自逆迁移或删除忽略资料。

## CI 与应用发行

- `release`、`feat/**`、`fix/**`、`hotfix/**` 推送及目标为 `release` 的 PR 运行 `check`：公开资料审计、类型检查、公共 Vitest、P3 怪物合成构建测试、构建及已编译 GU Worker 验证。
- 分支推送、PR 和标签推送均不发布程序。应用发行需要另行授权，更新版本及说明后按正常流程合入 `release`。
- 在已验证、已推送的 `release` 提交上创建匹配 `package.json` 的 `vX.Y.Z` 标签；成功推送后，从 `release` 手动运行 `.github/workflows/ci.yml`，填写该标签。命令为 `gh workflow run ci.yml --ref release -f tag=vX.Y.Z`。
- 发布校验器重新读取远端，要求工作流选中的 SHA、实际 checkout、远端 `release` tip 和版本标签解析到同一提交；同时检查干净源码、版本与发行说明。校验后先跑 `check`，再构建 Windows 包；打包前和上传前再次核对来源。期间 `release` 前移会使旧候选失败，需要重新选择并验证，不能静默换成新代码。
- Windows 包仍只下载哈希固定的公开运行资产 v6，并执行资产白名单、数据库、图标及 Electron ABI 检查。**P3 运行资产尚未获准公开**，本次源码合入不扩大资产授权。不要从含私有 P3 数据的本地环境直接制作公开包。
- 记录发行 commit、标签、资产版本和 SHA-256，保留上一版程序与兼容资料的恢复路径。运行资产或插件的独立发行也只能引用已审查的 `release` 源码，并逐项核对对应授权；本次不新增这些发行。

## 基线迁移记录

迁移起点为 `3e5c395`（原 `main`、P3 武器阶段）；P3 怪物和既有文档保存于 `a4e0b44`。此次仅整理源码基线及流程，公开应用仍为 `v0.1.14`（`4e2ef14`），没有创建新标签或 Release。当前交接见[基线记录](../handoffs/release-baseline-20261111/codex.md)。
