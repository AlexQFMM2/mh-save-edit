# 奇怪龙命名修订交付记录

2026-10-21 本地交付检查点，2026-10-24 分离归档。规则与维护入口见[名称说明](../../../../docs/monster-naming.md)，用户后续功能反馈见[P2G 验收](acceptance.md)。以下“本轮／仍需测试”保留历史时点，不覆盖最新反馈。

本地实施、真实查询及回退证据位于已忽略 `.runtime-assets/monster-naming-20261021/`：`input/` 为只读逻辑快照，`catalog-03/` 为最终配套生成库，`catalog-03-validation.json` 为逐表保护字段检查，`tests-final.log`、`dictionary-rebuild-tests.log`、`runtime-audit.log`、`typecheck-final.log` 和 `app-build.log` 为验收。完整库及词典已本地成套安装，原文件精确备份在 `backup-live/`，哈希及安装记录见 `installation.json`；重启本地应用加载。回退时退出应用，按记录恢复四份原文件并重启。

插件本地包为 `release-local-01/mhp2g-zh-v0.1.0-test.5-ppsspp.zip`，B 构建 `known-text-v1-B-b03c2d5632887e07`，21,600 条引用、3,715,972 字节文本、2,887 字形。保留 40 MiB 和早挂接修复；字形为此前子集且度量一致，官方 PPSSPP PGF 解析／绘制和生产 C 文本解析器 ASan／UBSan 读回、9 文件白名单及内外校验通过。SHA-256 为 `53c22cd11d9e0cfeb965ef1d9c76a232ee3bf569ec67010c8f0cb03b26301a7c`。

本轮为本地更新，尚未提交、推送或发布新版本，GitHub 的 v0.1.14／资源 v6／插件 test.4 保持原样。未连接 Windows 或操作游戏；新名称的实际游戏显示仍需用户测试，G1 不因离线检查完成。真实文本审阅、数据库、PRX、PGF、ZIP 和审计产物不进入 Git。
