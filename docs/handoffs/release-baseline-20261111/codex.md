# release 基线与流程交接

更新：2026-11-11。执行者：Codex；单代理串行。

## 范围与基线

- 用户要求：保存并清理现有工作区，确定 `release` 分支，规范后续开发流程。
- 任务分支：`fix/release-baseline`；起点：`3e5c395cf8df5a6036ba66b05fe3cda83d7fee92`。
- 已成功 fetch；起点与远端 `main` 相同，左右差异为 0/0。远端当时只有 `main`，最近一次该提交的 CI 成功。
- 现有未提交内容为 P3 怪物实现、合成测试及项目／研究交接文档。本次先作可恢复提交，再进行基线复核；保存提交本身不代表审查或发行完成。
- 本次包含源码提交、分支整理和同步。没有新增应用版本、标签或 Release；P3 数据库、扩展词典、原生图标、研究输入和原始验收产物仍保持私有。
- 既有 P3 计划仍在 `plan/mhp3-monster-catalog/`，不搬迁或改写原验收历史。本次为 Git 流程整理，不另立完整功能实施计划。
- 本次临时检查证据在仓库外 `../test/mh-save-edit/release-baseline-20261111/`；初始工作区清单、tracked patch、untracked 清单及运行资料指纹已保存。该目录不随 Git 推送。

## 完成记录

- 已盘点工作区、远端分支、发布工作流和公开资产边界。
- 已切换任务分支；原有修改全部保留于 `a4e0b44`，共 59 个源码、合成测试及文档文件。
- 已调整 CI：任务分支与 `release` 检查；取消标签自动发行，仅允许手动选 `release`，校验 checkout／远端 tip／标签／所选 SHA 一致。发布前仍须明确授权。
- 已补 Git 工作流及 AGENTS 约定，给 CI 增加既有 P3 怪物 Python 合成测试；没有修改 P3 业务实现或资料。
- 流程实现提交 `c2fe9b72bf5e4ce344818ef1d639b365ef94ccfb` 已通过[任务分支 CI](https://github.com/AlexQFMM2/mh-save-edit/actions/runs/42997983449)，`check` 成功，`package-windows` 按预期跳过。随后从原 `main` 建立 `release` 并快进合入该提交，已推送远端；这次合入保持相同 SHA 和源码树。
- 已回读确认 GitHub 默认分支为 `release`。分支保护要求 GitHub Actions（app 15368）的 `check`，`strict=true`；管理员同样适用，禁止强推和删除。没有强制 PR 或第二人审批。`main` 保留原 `3e5c395` 历史，不再作为开发或发行入口。
- 本页的收尾提交只更新文档；仍在原任务分支提交、自审、通过 CI 后快进合入。最终源码版本可用 `git log -1 release` 和 [release 检查记录](https://github.com/AlexQFMM2/mh-save-edit/actions?query=branch%3Arelease)核对，不用待办文档代替远端状态。

## 固定提交自审

审查范围：`3e5c395` → `c2fe9b7`，单代理自审，不声称独立审批。结论：未发现阻挡本次源码基线合入的缺陷。

| 范围 | 核查与结果 | 限制 |
| --- | --- | --- |
| P3 查询、身份与关系 | preload → IPC/schema → 只读 repository；任务／存档／配装领域未扩大，掉落正反查共用关系表，缺旧模块路径与合成测试通过 | 本次不扩展原生机制结论 |
| 构建、审计与资料边界 | 完整库副本、哈希／外键／旧表保护、失败产物拒绝、合成输入及 Git 文件清单已核查；运行资料未改动 | 真实资产保持私有，不是公开资产发行验收 |
| 共享 UI | 未知值、排序、范围、历史、异步结果和一级抽屉路径及现有合成回归已核查 | 无新增 Electron／Windows／游戏实测 |
| 发布与恢复 | 手动 release 入口、三次远端来源核对、check 先于打包、固定资产与白名单；来源门禁 11 项测试、actionlint 1.7.7 通过 | 没有触发真正发布；旧已发布程序仍为 v0.1.14 |

完整本地审查笔记为外部工作台 `self-review.md`；公开 handoff 保存结论与可复现命令，不上传原始日志。

## 验证与限制

- `pnpm typecheck`、`pnpm build`、`pnpm data:audit:runtime` 通过。
- 公共 Vitest（排除 `.runtime-assets` 与私有 `weaponCatalogData.test.ts`）900 通过、8 条件跳过；新增发行来源测试单独 11 通过。两者不重叠。
- `c2fe9b7` 的公开 GitHub CI 在干净 checkout 与公开资产 v6 下完整运行：Vitest 911 通过、8 跳过，Python 5 通过，编译后 GU Worker 1 通过、2 跳过，类型检查／资料审计／构建通过。远端与本地次数不累计。
- `python3 -m unittest tests.test_mhp3_monsters`：5 通过；编译后 GU Worker：1 通过、2 条件跳过。跳过不算通过，完整日志在外部工作台。
- 检查文档文件链接均存在；七个运行文件（六库及 P2G profile）与初始指纹一致。
- 历史 P3 Linux Electron 验收见 [怪物交接](../../../plan/mhp3-monster-catalog/handoff.md)。本次不将历史记录称为新一轮 UI、Windows 或游戏验收，也未执行实际发行。
- 当前公开应用仍为 `v0.1.14`，对应 `4e2ef14`；建立新的源码基线不改变已经发布的程序。
- 发行检查器用合成 Git 仓库验证：允许 detached checkout，拒绝非手动／非 release／标签入口、未提交文件、未合入任务提交、远端前移、取数失败和版本不匹配。

## 恢复

恢复时先核对实际分支、HEAD 和 `git status`，再成功 fetch 并比较 `origin/release`。P3 怪物源码已在 release 历史中，任务分支保留检查点；初始基线仍由 `main` 保留。不要使用 reset/clean 丢弃工作区或删除忽略的资料库。若流程需修正，从 release 建新的 fix 分支，审查后合入，不回退远端历史或取消保护绕过检查。

本次没有待实施的业务功能。后续 P3 完整任务图鉴应作为新专题，从最新 release 建 `feat/mhp3-quest-catalog`；先核查已有冻结资料和接入缺口，不能把怪物出没预览当完整任务库。
