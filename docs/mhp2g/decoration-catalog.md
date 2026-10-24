# P2G 装饰品图鉴

本文维护装饰品身份、数据关系、查询和重建方式。译名复核与交付历史见[归档记录](../../plan/archive/2026-10-24/mhp2g-records/decoration-naming.md)，整体验收见[验收记录](../../plan/archive/2026-10-24/mhp2g-records/acceptance.md)。

## 资料与关联

- 168 个唯一道具身份，全部有中日文名称与内容哈希图标。
- 281 条带符号技能点，其中 113 条负数，涉及 91 个技能系统。
- 192 套独立配方、597 条材料；替代配方分开展示，不合并数量。
- 道具自身可打开装饰品详情；597 条旧制作用途全部明确关联到对应珠，搜索珠名可反查材料道具。技能正文、技能抽屉和旧装备链接均接入完整装饰品详情。

正文关联只打开一级详情抽屉；抽屉内点击材料、技能或道具，先关闭再跳转定位。P2G 抽屉通过 portal 展示，不改变正文布局。旧技能页 `equipment=item:<道具编号>` 链接可刷新恢复完整装饰品详情；缺少装饰品索引的旧技能库继续使用原装备技能资料详情，独立装饰品页面显示可恢复的资料未安装提示。

孔位、技能点和材料复用技能阶段已逐字节核对的原生证据。名称沿用道具侧已审定译名，按日文确定身份，GU 官汉只提供名称。**稀有度、制造费用、解锁条件仍未收录**；详情明确显示未知，已知卖出价格单独展示，不把道具买价当成制造费用。未扩展 P2G 存档写入、配装或完整防具／武器图鉴。

## 实现与固定输入

装饰品使用 `{ gameId: 'mhp2g', itemId }`，三作继续使用 `saveId`；材料传完整 `ItemIdentity`。schema 拒绝跨游戏身份和错误定位字段。独立 [P2G repository](../../api/catalog/p2gDecorationRepository.ts) 接入现有 `getDecoration`、`searchDecorations`、`getDecorationFacets`。

本次未复制技能和装备明细，追加 `p2g_decorations` 身份索引、`p2g_decoration_materials` 旧用途对照及能力标记。按原生配方键和材料位置核对旧用途来源键，再逐条验证材料身份与数量，不靠名称相似度映射。道具／怪物／任务／技能已有 18 张业务表保持不变。

固定输入位于 `../research/mhp2g/decoration-catalog-v1/`：`input/base.sqlite` 是安装装饰品前的含技能完整库，`input/skill-manifest.json` 保留父构建来源；`baseline.json` 记录五库基线，`source-manifest.json` 记录文件大小、SHA-256 及父证据路径。原生明细来源仍可追溯到 `../research/mhp2g/skill-catalog-v1/`。构建不访问宿主机。

## 重建与验收

从仓库根目录运行，将输出替换为尚不存在的私有目录：

```bash
node tools/build_mhp2g_decoration_catalog.mjs \
  --base ../research/mhp2g/decoration-catalog-v1/input/base.sqlite \
  --base-sha256 dd433764ece11664525fadf2bbb032183f04f42e1c234f019f6d0da2f8db6ffa \
  --output /private/new-decoration-output

node tools/audit_mhp2g_decorations.mjs \
  --database /private/new-decoration-output/mhp2g.sqlite \
  --base ../research/mhp2g/decoration-catalog-v1/input/base.sqlite
```

构建先写临时目录，证据、关系端点和计数审计成功后才发布输出；已有目录拒绝覆盖。用途缺失、歧义、材料数量或基线指纹不一致时中止。

本轮验收结果：

- 15 个相关测试文件、102 项不同测试最终通过。覆盖数据构建、错误输入、P2G／三作查询、IPC、跨游戏拒绝、技能及任务回归、日文筛选、异步响应、前进后退、旧链接和单层抽屉。
- `pnpm typecheck`、`pnpm build` 通过；公开新增测试仅使用合成数据。
- 两次独立构建数据库字节相同。逐条读取全部 168 个装饰品、281 条技能点、192 套配方、597 条材料，核查全部图标哈希、道具／技能端点和反向用途。
- Chromium 使用真实查询仓库在 1366×768、1024×768、1024×680 验收，正文布局稳定、旧链接刷新恢复、材料／技能跳转正常；三作装饰品页面分别回归，未出现运行异常。这是实际页面和 repository 验收，IPC 另由自动测试覆盖，不冒充完整 Electron 端到端验证。
- 三作与词典库 SHA-256 保持不变。

正式产物及 `verification/` 证据位于 `../research/generated/mh-save-edit/mhp2g/catalog-decorations-v1/`，包含日志、实际页面截图、逐项报告和验收清单。

### 2026-10-12 选择条目导致列表刷新的修复

用户反馈滚动后点击装饰品会闪烁并返回列表顶部。原因是本次接入将选中编号及随 URL 改变的回调加入列表查询依赖，详情选择触发重复查询；装饰品列表的加载分支随之卸载滚动容器。原有验收未覆盖滚动后的连续选择。

列表查询现仅依赖实际筛选、搜索、排序、分页、定位和游戏条件；待返回请求通过已提交的最新选择与 URL 回调决定是否自动选中首项，避免覆盖新选择或页签。保留原有过期请求保护。进一步检查并修复技能、怪物、任务、狩技、武器（列表及派生）、防具（列表及套装）中的同类重复查询；道具、武器动作值及猎猫各页未发现相同触发依赖，未修改其查询逻辑。

- 新增两个仅使用合成数据的回归测试文件，共 26 项；与相关既有 UI 测试合计 13 文件、88 项通过，`pnpm typecheck`、`pnpm build` 通过。
- 覆盖四作装饰品滚动容器及位置保留、前进后退、首项自动选择、筛选和翻页仍可重查、请求未完成时的新选择和页签保留，以及其他受影响图鉴的查询次数。
- Chromium 在 1366×768 下通过真实查询仓库验证 26 个列表场景、78 次滚轮滚动后的连续点击；滚动位置与容器保留，仅请求详情。另验证三作武器派生的 9 次节点切换，均未重复读取列表或派生图。无运行异常；这是页面与 repository 验证，不代表完整 Electron IPC 验证。
- 补充日志、截图、浏览器脚本及报告位于已忽略的 `.runtime-assets/p2g-decoration-work/selection-*`。本次仅修复查询触发逻辑，四作数据库未变，无需重新安装数据；修复纳入用户随后授权的本地提交，不推送或发布。

## 安装与回退

新库已备份后原子安装至 `data/mhp2g.sqlite`，SHA-256：

```text
439e769eb5b8e78174d0ceba7b571bc5a9343e25e6da982af345af5c147d6356
```

安装前含技能的完整库位于正式产物的 `backup/mhp2g.sqlite`，SHA-256：

```text
dd433764ece11664525fadf2bbb032183f04f42e1c234f019f6d0da2f8db6ffa
```

`installation.json` 记录安装时间及两份哈希。未自动关闭应用，重启后加载新库。回退时自行退出应用，校验备份哈希，将备份复制到运行库同目录临时文件，再原子替换运行库并启动。原有道具、怪物、任务和技能仍可使用，装饰品入口提示缺少资料。

追加图鉴必须以**最新含装饰品的完整库**为基线并另做备份，不能用旧技能库覆盖。运行库与图标按明确授权随独立运行资源和应用包分发，固定输入、清单、报告与截图继续私有。原阶段交付与后续装备接入见[计划归档](../../plan/archive/2026-10-24/mhp2g-decoration-catalog/README.md)，不从旧阶段重新执行。
