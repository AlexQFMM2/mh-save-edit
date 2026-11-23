运行资源 v7，适用于 MH Save Editor v0.1.16 及本版源码。在 v6 基础上加入 MHP3 日版资料，其余已支持作品不变。

按 ZIP 原目录结构解压到源码根目录即可开发。普通 Windows 用户直接下载应用 Release，运行包已内置这些文件，无需另外安装。

包含五作游戏 SQLite（P2G／P3／3G／4G／GU）、配套道具译名词典、P2G 与 P3 存档格式参数、2,874 张内容哈希 PNG 图标及应用 ICO／PNG，共 **2,884 个文件**。

- 新增 `data/mhp3.sqlite`：979 条道具、1,131 条原生防具身份、987 把武器、100 个技能、65 条怪物、397 条任务，含配方、掉落与双语检索字段。
- 新增 `data/mhp3-save-profile.json`：ULJM05800 成对存档解码参数与 1,131 条原生防具强化上限。
- 新增 474 张 P3 内容哈希图标，文件名与内容哈希逐一核对；图鉴引用的每个图标都随包提供。
- 译名词典加入 P3 道具绑定（`catalog:mhp3` 身份指纹）；P2G／3G／4G／GU 绑定与显示名保持不变。
- P2G／4G／GU 运行库为已审计的最终状态，包含既有修复迁移；CI 会再次确认迁移幂等与作品身份。

ZIP：`mh-save-edit-runtime-assets-v7.zip`，37,024,365 字节。SHA-256：

```text
635fe906d3affc9b0bb3b392af4408cec9b6136dff3cdf0e2522cff168693f21  mh-save-edit-runtime-assets-v7.zip
```

同页附 `SHA256SUMS.txt`。数据库完整性、无活动 WAL、图标内容哈希及文件白名单已核对。个人存档、原始游戏、Dex、来源 manifest、crosswalk、研究审计报告和任务状态库保持在运行包之外；运行文件通过独立附件提供，不进入 Git 历史。旧资源 v6 保留。
