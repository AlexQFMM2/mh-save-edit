# MHGU/XX 武器动作值图鉴

Status: 已归档
归档日期：2026-10-10
责任归属：项目维护者；后续由社区按需参考

归档结论：动作值图鉴首版完成，原生逐事件参数精修及专项性能验收停止推进。

保留边界：LMT/FUP/HDP/HDS/XFS 到命名动作的 crosswalk 未完全闭合，未知字段保持空值。

复核依据：原文首版记录及 [Repository](../../../tests/weaponMotionCatalogRepository.test.ts)、[UI](../../../tests/weaponMotionCatalogUi.test.tsx) 回归。

> 用户于 2026-10-10 决定将全部旧计划归档，未做的后续工作不再继续排期。以下为历史方案与原始勾选记录；未实施或未验收项保持原状，不记作完成。当前维护方向见[归档索引](../../README.md)与[项目 README](../../../README.md)，发布边界以[现行约定](../../../AGENTS.md)为准。代码、研究路径和命令按项目根目录或原说明解释。

## 归档前记录

状态：第一版数据构建、Repository/IPC 与界面已完成；原生逐事件参数 crosswalk 待继续精修
计划日期：2026-09-08
适用内容库：仅 `mhgu`（同时服务 MHGU Switch 与 MHXX 3DS）

## 1. 已完成范围

- 武器图鉴增加“动作值”第三种视图；MH3G、MH4G 不显示入口，非法 URL 会回退到派生视图。
- 覆盖 14 种猎人武器并明确排除猎猫。当前固定快照生成 451 个可浏览动作条目。
- 近战、轻重弩、弓使用鉴别联合和独立表格列，不把远程参数塞进近战结构。
- 六种狩猎风格支持可搜索多选，筛选语义为“匹配任意所选风格”；表格持续展示六列兼容性。
- 动作行使用原生按钮展开变体、顺序 Hit、合计、条件、备注和原生动作键；攻击型狩技全部关联现有狩技 ID。
- 点击狩技资料打开现有一级详情抽屉；抽屉内关系继续遵循关闭后跳转，禁止嵌套。
- URL 保存 `view/type/mq/styles/motionCategory/motionSort/motionDirection/move`；重置保留动作值模式并恢复大剑。
- Repository、IPC 和 preload 只接受 `gameId=mhgu`，查询单一武器类型且最多返回 500 条。

当前第一版的动作值主体来自固定二级来源，并以 GU/XX 原生资源、三语操作文本和用户参考表做交叉核验。原生 `LMT/FUP/HDP/HDS/XFS` 到命名动作的逐事件 crosswalk 尚未完全闭合，因此攻击系、斩味补正、减气、气绝等未确认字段保持为空；整列没有权威值时界面直接隐藏该列，不会把推测值标记为原生数据。

## 2. 私有数据与证据

私有固定输入位于：

```text
research/mhgu/motion-values/
├── native/mhgu/           # Switch w00-w14.arc、wbc.arc
├── native/mhxx/           # 3DS 对应 ARC
├── styles/mhgu/           # 14 × 6 风格命令包
├── styles/mhxx/           # 14 × 6 风格命令包
├── localization/          # 简中、英文、日文 WeaponControls GMD
├── references/
│   ├── damage-calculator/ # 固定公开交叉验证快照
│   └── user-images/       # 用户提供的 11 张近战表压缩包
└── source-manifest.json   # 原路径、大小和 SHA-256
```

构建器先逐文件校验 `source-manifest.json`，再检查：

- GU 与 XX 的 14 类公共 HDP 逐字节一致。
- 每份 HDP 为 16 字节头、56 字节定长记录。
- 168 份风格命令 ARC 的 GU/XX 资源键集合逐类一致。
- `wbc.arc` 中存在可追溯的 HDS 弹体资源。
- 三语 GMD 使用稳定键建立精确名称 crosswalk；未精确命中的动作保留固定英文名，不进行机器翻译。
- 大剑 `48 / 65 / 80 / 100` 固定样本存在。
- 所有攻击型狩技均有现有 `catalog_hunter_arts` 外键；未关联数为 0。

真实 SQLite、ARC、GMD、参考图、manifest 和审计报告只保存在 `research` 或项目已忽略目录，不进入 Git。

## 3. 构建与 API

```bash
pnpm data:build:weapon-motions -- --research-root ../research
pnpm data:audit:weapon-motions -- --research-root ../research
```

构建表：

- `catalog_weapon_motions`
- `catalog_weapon_motion_styles`
- `catalog_weapon_motion_variants`
- `catalog_weapon_motion_hits`
- `catalog_bowgun_motion_values`
- `catalog_bow_motion_values`
- `catalog_weapon_motion_sources`

公开代码测试只创建内存合成表，不包含真实游戏动作数据。应用运行时仍由 Electron 主进程只读打开本地 SQLite，renderer 不读取文件路径或 SQL。

## 4. 后续精修

- 继续扩充原生 LMT/FUP/HDP/HDS/XFS 事件到动作名的逐记录 crosswalk，以闭合逐 Hit、攻击系、斩味补正、减气和气绝参数，并提升尚未命中 GMD 的中日文名称覆盖。
- 在确认各字段偏移后补充更多逐 Hit 的攻击系、斩味补正、减气和气绝原生值；未知字段保持空值，不按参考图猜测。
- 用用户提供的 11 张近战图继续做私有逐字段抽样，但不把图片或 OCR 结果提交公开仓库。
- 完成 1024/1280/1440 三档 Electron 实机视觉验收和 500 行表格性能采样。

## 5. 数据边界

不得提交或公开分发：`动作值表.zip`、其中图片、ARC、GMD、RomFS、SQLite、CSV、JSON manifest、crosswalk 或从游戏资源导出的二进制。公开仓库只保留解析器、schema、Repository、IPC、UI、合成测试和本文档。
