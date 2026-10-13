# P2G 笛谱补充与验收

更新日期：2026-10-13。用户要求先完成武器详情中缺失的笛谱资料，再继续防具。本轮补齐 95 把狩猎笛的 534 个旋律关联，覆盖 47 套原生匹配模式、42 类效果，其中 35 类有持续时间、7 类为即时效果。原先将武器笛谱称为“不阻挡防具的剩余研究”不符合用户要求，已更正交接。

## 已补齐的内容

每套旋律保存初次效果、重奏变化、普通／吹笛名人时间、生效与覆盖条件；即时回复和音爆明确没有持续计时。重奏时间区分“在剩余时间上追加并封顶”和“重设为指定时间”，不能用一个时长字段混合表示。特别核对了听觉保护【小】重奏重设时间、同类大小效果覆盖、防御降低的解除、体力上限与回复差额、强走共享时间和技能加成残留。

原生模式中的高位音符约束已经确认是“前一个音符不能为指定颜色”，不是未知猎人状态。图鉴在对应旋律旁显示具体音符条件。吹笛名人对回复旋律提高较大回复量的机会；对音爆改变实际球形判定半径，不只改变特效大小。范围修正已追踪到碰撞形状及半径比较，显示为普通的 1.5 倍。

时间表描述相同旋律、相同技能配置的初次与重奏；混用旋律或技能配置的差异放在条件说明中，不把它当作实时配装模拟器。旧版数据没有补充时仍显示未知，避免从音符或后作机制猜值。

## 来源与核查方法

权威输入仍是日版 `D:\MH\unpack\mhp2gjp` 的既有解包。只读访问 BOOT 及 DATA 中已定位的 game_task、game_sub，返回限定指令、小表和哈希；没有修改宿主机，也没有复制原始可执行文件、DATA、overlay 或整包资源。独立对照采用冻结的 P2G 日文资料第 440 页，与原生音符、效果标签逐项对应。

私有冻结证据：`../research/mhp2g/horn-performance-review-v1/`。包含定向查询、结果、有限指令求值脚本、人工审阅后的效果说明、计时／状态审计、音爆调用链及独立来源快照。来源 manifest 的 SHA-256：

```text
f00800178ee9faec686609ddc716e26b06d513872605eafebea46a9e247f2faa
```

静态验证执行已捕获的整数指令，使用合成角色内存、显式随机数输入，并记录或模拟已审阅的外部调用。检查 210 个计时情形、376 个音符匹配情形、268 个同类效果与技能配置交叉情形、72 个即时回复结果；35 类持续效果的普通／技能时间均与独立资料一致。秒数采用每秒 30 次计时更新，与独立秒数闭合。音爆的浮点／向量几何分支采用人工数据流核对，没有声称整数求值器执行了完整碰撞系统。

以上属于解包静态核查和独立资料交叉验证，**没有进行实机／模拟器内计时、联机同步或所有怪物音爆反应实测**。本轮补的是图鉴需要的效果语义，不宣称完成整套游戏行为模拟。

## 构建与保留范围

[补充器](../tools/build_mhp2g_horn_supplement.mjs)从最新完整的 `catalog-weapons-v2` 副本构建；不从早期装饰品库重建。它核验冻结证据的全部文件哈希、模式与效果身份、音符顺序、条件、计时结构和覆盖范围，拒绝缺项、重复、错绑与未使用证据。真实效果映射保存在私有 review，公开源码与测试不内嵌实际数据集。

新契约为每首旋律的可选 `performance`。原有三个 `null` 字段仅为旧版兼容保留，页面使用新结构；不能据此误判补充数据仍为空。增加独立 `weapons_horn` 来源记录并纳入派生 `dataVersion`。新旧全量比较只允许笛谱 `performance` 和这条来源记录变化：1,501 把武器的其余字段、785 条项目译名、关系、配方、schema 及 27 张其他表一致。

构建与独立审计示例（输出已存在时另选新私有目录）：

```bash
node tools/build_mhp2g_horn_supplement.mjs \
  --base ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v2/mhp2g.sqlite \
  --base-sha256 1d17142d02c356af1e0d805450028c19a6d55552d0fc02f8351bf6f73ff32dfc \
  --review ../research/mhp2g/horn-performance-review-v1 \
  --review-sha256 f00800178ee9faec686609ddc716e26b06d513872605eafebea46a9e247f2faa \
  --output .runtime-assets/p2g-horn-build-v1

node tools/audit_mhp2g_horn_supplement.mjs \
  --database ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v3/mhp2g.sqlite \
  --base ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v2/mhp2g.sqlite \
  --review ../research/mhp2g/horn-performance-review-v1 \
  --review-sha256 f00800178ee9faec686609ddc716e26b06d513872605eafebea46a9e247f2faa \
  --manifest ../research/generated/mh-save-edit/mhp2g/catalog-weapons-v3/manifest.json
```

`audit_mhp2g_weapons.mjs` 继续负责初始武器／译名 v2 阶段；新补充使用上述独立审计器与已验收 v2 全量比较。通用 `verify_mhp2g_weapon_runtime.mjs` 已支持有／无补充两种数据库。

## 页面与交付

[P2gHuntingHornDetail](../ui/components/P2gHuntingHornDetail/P2gHuntingHornDetail.tsx)负责音色与旋律列表，[P2gHornSongDetail](../ui/components/P2gHornSongDetail/P2gHornSongDetail.tsx)负责单首旋律的效果、时间表、即时状态及条件展开；两者各自拥有样式，不由页面选择内部 DOM。时间数字沿用全局数据色和字号令牌，条件使用原生 `details/summary`，无需额外请求数据。

94 项相关回归按文件通过：新增补充器／UI 18 项、原武器数据／UI 47 项、IPC 与共享三作武器／派生 29 项。类型检查、生产构建通过。未重新运行整个项目测试集。全量运行查询覆盖 1,501 个详情、534 个完整笛谱关联、11 类派生和既有道具／配方端点；Chromium 42 个场景覆盖全部 47 套旋律模式、1366／720px 两种宽度、无水平溢出及 Enter／Space 展开；展开不重复查询数据。浏览器使用生产 renderer 和本地只读仓库适配器，不等同完整 Electron 测试。记录见私有 `horn-verification-v1`。

笛谱阶段的完整交付为 `catalog-weapons-v3/mhp2g.sqlite`，SHA-256：

```text
618d159340a162eeb843e66cfcca53a114c38a66e0c4c7b8402cd68d8bffbe7c
```

已备份后原子安装到本地 `data/mhp2g.sqlite`，88 个原图标保留，其他三作数据库 SHA-256 不变；未关闭运行中的应用，主进程缓存旧库时需重启开发应用。安装前完整备份与验证记录：`../research/generated/mh-save-edit/mhp2g/horn-verification-v1/`。后续[防具图鉴](mhp2g-armor-catalog.md)已从 v3 副本追加并保留全部笛谱补充；当前安装库为 `catalog-armor-v1`，以[装备交接](mhp2g-equipment-handoff.md)为准。长篇说明译文、未展示的制造解锁语义、存档装备编码与配装仍是明确分开的未完成范围，不再把它们混写成“全部武器研究已结束”。本轮没有提交、推送或发布；P2G 私有数据授权边界不变。
