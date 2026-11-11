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

## 当前进度

- 已盘点工作区、远端分支、发布工作流和公开资产边界。
- 已切换任务分支；原有修改全部保留于 `a4e0b44`，共 59 个源码、合成测试及文档文件。
- 已调整 CI：任务分支与 `release` 检查；取消标签自动发行，仅允许手动选 `release`，校验 checkout／远端 tip／标签／所选 SHA 一致。发布前仍须明确授权。
- 已补 Git 工作流及 AGENTS 约定，给 CI 增加既有 P3 怪物 Python 合成测试；没有修改 P3 业务实现或资料。
- 接下来固定并自审流程提交，推送任务分支验证公共 CI，然后建立／合入 `release` 并回读远端设置。

## 验证与限制

- `pnpm typecheck`、`pnpm build`、`pnpm data:audit:runtime` 通过。
- 公共 Vitest（排除 `.runtime-assets` 与私有 `weaponCatalogData.test.ts`）900 通过、8 条件跳过；新增发行来源测试单独 11 通过。两者不重叠。
- `python3 -m unittest tests.test_mhp3_monsters`：5 通过；编译后 GU Worker：1 通过、2 条件跳过。跳过不算通过，完整日志在外部工作台。
- 检查文档文件链接均存在；七个运行文件（六库及 P2G profile）与初始指纹一致。
- 历史 P3 Linux Electron 验收见 [怪物交接](../../../plan/mhp3-monster-catalog/handoff.md)。本次不将历史记录称为新一轮 UI、Windows 或游戏验收，也未执行实际发行。
- 当前公开应用仍为 `v0.1.14`，对应 `4e2ef14`；建立新的源码基线不改变已经发布的程序。
- 发行检查器用合成 Git 仓库验证：允许 detached checkout，拒绝非手动／非 release／标签入口、未提交文件、未合入任务提交、远端前移、取数失败和版本不匹配。

## 恢复

恢复时先核对实际分支、HEAD 和 `git status`，再读本页。任务分支保存现有 P3 怪物源码；初始基线仍由 `main` 保留。不要使用 reset/clean 丢弃工作区或删除忽略的资料库。
