# 三作技能实际效果审计计划

状态：探测完成，精确公式审计尚未接入图鉴或配装计算器。

## 结论先行

可以查清一部分，但不能把所有模糊说明都归因于一张 `skill` 表：

| 目标 | 当前证据 | 状态 | 下一步 |
| --- | --- | --- | --- |
| 技能系、发动技能、阈值 | 三作 Dex `DB_Skl`、`ID_Skl*` | `table_exact` | 直接进入技能图鉴 |
| GU/XX 原生技能 ID、技能类型 | `skillTypeData.skt`、对应 GMD | `table_exact`（ID/名称） | 固定 native↔Dex crosswalk |
| GU/XX 护石合法范围 | 八个 `amuletSkillData00..07.amskl` | `table_exact`（范围） | 继续沿用技能图鉴/护石校验 |
| GU/XX Attack Up、Critical Eye 的数值 | 现有伤害计算器参考代码 | `table_plus_logic` / `reference_implementation` | 用原生效果逻辑或独立样本复核后入库 |
| 回避性能无敌帧 | 当前只有 Dex 文本和 native 原始记录 | `unknown` | 定向查可执行逻辑/帧参数 |
| 弱点特效触发 | 需要肉质判定、攻击类型和技能逻辑共同决定 | `table_plus_logic`，当前不完整 | 查 `MonsterCalculation`/可执行逻辑，固定 45 肉质边界样本 |
| 3G/4G 原生效果参数 | 宿主机当前解包目录未找到同名 `skillData.skd/skt` | `description_only`/`unknown` | 先定位 3DS/WiiU ARC 内部表或代码；不借 GU 值 |

## 已核对事实

- `research/mhgu/romfs/mhgu-table` 与 `mhxx-table` 中的 `skillData.skd`、`skillTypeData.skt`、八个 `amuletSkillData*.amskl` 已逐字节比较一致；这只说明 GU/XX 公共数据一致，不等于字段语义已经全部解析。
- `skillTypeData.skt` 是 206 条、19 字节定长记录；`skillData.skd` 是 328 条、18 字节定长记录。脚本会保留完整十六进制记录，未知字段不猜测。
- Dex 的三作技能说明和阈值是可用的权威文字层，但“攻击提升”“延长无敌时间”“攻击弱点时增强”等说明不等于最终数值。
- 现有 GU 动作值参考目录的 `BowCalculation.java` 明确写出 Attack Up S/M/L 为 `+10/+15/+20` raw，Critical Eye +1/+2/+3 为 `+10/+20/+30` 会心；这些先标为参考实现证据，不冒充原生表字段。
- 现有提交的伤害计算器只把 Weakness Exploit 作为条件传入肉质处理，缺少完整 `MonsterCalculation` 实现，因此不能据此宣布触发公式已闭合。
- 宿主机 `D:\MH\unpack\mh3g`、`mh4g` 的当前已展开目录没有发现 GU/XX 同名技能表；3G/4G 需要继续在 ARC/可执行资源中定向定位，不能用“没找到文件”推断游戏没有参数。

## 可重复调用的探测脚本

在 `mh-save-edit` 目录执行：

```bash
pnpm data:inspect:skill-effect -- --game mhgu --skill "弱点特效"
pnpm data:inspect:skill-effect -- --game mhgu --skill "Tenderizer"
pnpm data:inspect:skill-effect -- --game mh4g --skill "回避性能"
pnpm data:inspect:skill-effect -- --game mh3g --skill 0x93
```

脚本输出：

1. Dex 技能系、发动技能、正负阈值、三语说明；
2. GU/XX 原生技能 ID 和原始记录十六进制（不解释未知字段）；
3. 已审核的参考实现数值及证据等级；
4. 当前仍缺少的代码逻辑或版本证据。

它是审计入口，不生成 SQLite、不修改图鉴数据、不读取联网资源。

## 后续实施边界

### 本阶段继续做

- 建立 `native skill ID → Dex skill/activation` 显式 crosswalk；
- 读取三作可找到的原生参数并记录文件哈希、记录偏移和字段解释；
- 将效果分为 `table_exact`、`table_plus_logic`、`code_only`、`description_only`、`unknown`；
- 为攻击力、会心、回避、弱点特效、匠、属性攻击强化分别建立固定样本；
- 只有证据等级达到门槛才写入技能图鉴“实际效果”字段或配装器计算器。

### 明确不做

- 不把 Wiki/伤害计算器的数值直接当成三作原生事实；
- 不把 GU/XX 参数套给 MH3G/MH4G；
- 不在当前探测阶段修改技能图鉴展示文字、自动配装规则或存档数据；
- 不把原始 ARC、GMD、RomFS、可执行文件或研究 SQLite 提交到 GitHub。

## KISS 设计决定

- 单一入口是 `inspect_skill_effect.mjs`，复用已有 Dex CSV 和私有研究资源；不新增服务、数据库或 UI 页面。
- 单一事实源按版本分层：Dex 负责名称/阈值/说明，原生表负责 ID/范围/参数，代码分析负责触发与计算；每层都带来源和证据等级。
- 未来扩展点是一个 reviewed effect schema，而不是在技能页面散落硬编码；未闭合效果保持可见的“待代码逻辑确认”状态。

## 本轮探测记录（2026-09-14）

本轮只做证据定位和方法记录，不修改技能图鉴、配装器规则、SQLite schema 或存档数据；也不启动开发服务器。下一轮从本节的目标清单继续，避免重复扫描。

### 探测方法

1. **先查现有统一数据**：使用三作 Dex 导出中的 `DB_Skl.csv`、`ID_Skl_Name.csv`、`ID_Skl_Des.csv`、`ID_SklTree_Name.csv`，确认技能系、发动技能、阈值、方向和三语说明。Dex 只承担文字与关系基线，不直接推导最终战斗数值。
2. **再查原生表**：在宿主机 `D:\MH\unpack` 下按游戏、目录和文件类型定向搜索技能相关 `*.skd`、`*.skt`、`*.amskl`、`*.gmd`、`*.arc`；优先读取已展开文件，限制输出数量，不复制整棵 RomFS。记录文件路径、大小、SHA-256、记录长度、记录偏移和原始十六进制。
3. **建立显式 crosswalk**：按稳定 ID/名称表/引用关系连接 `Dex skill tree → native skillType/skillData → activation`；禁止按行号、相邻记录或相似名称猜测。GU/XX 即使内容逐字节一致，也分别保留版本来源。
4. **最后核对逻辑来源**：检索旧修改器、现有伤害计算器、规则插件和可执行逻辑中的 `AttackUp`、`CriticalEye`、`Evasion`、`WeaknessExploit`、肉质判定等实现。代码或 Wiki 只能作为交叉证据，不能覆盖原生表冲突。
5. **固定样本复算**：每个效果至少准备正数、负数、零值和阈值边界样本；弱点特效额外准备肉质 44/45/肉质类型边界，回避性能准备动作类别/状态边界。用独立脚本输出输入、版本、公式、证据链和结论。
6. **证据分层后再入库**：结果只允许标记为 `table_exact`、`table_plus_logic`、`code_only`、`description_only` 或 `unknown`。未达到 `table_plus_logic` 且没有版本固定样本的项目保持待审，不写入正式计算器。

### 下一轮探测目标

按优先级处理以下目标，三作分别记录，不把 GU/XX 数值套用到 MH3G/MH4G：

| 优先级 | 目标效果 | 需要确认的内容 | 主要证据入口 | 验收结果 |
| --- | --- | --- | --- | --- |
| P0 | 攻击力 UP S/M/L | 各版本 raw 攻击增加值、发动阈值、与猫饭/武器倍率的计算顺序 | 原生技能/参数表、旧计算器、固定样本 | 三作公式和边界样本均可复算 |
| P0 | 弱点特效（痛击） | 肉质阈值、攻击部位判定、斩击/打击/射击差异、会心/物理修正顺序 | 肉质表、伤害逻辑、原生技能记录 | 至少 44/45 边界与三种攻击类型闭合 |
| P0 | 回避性能 +1/+2、DOWN | 无敌帧增减、动作类别例外、负面等级效果 | 原生动作/帧参数、可执行逻辑、固定录像/样本 | 每版本给出帧数或明确 `unknown`，不猜测 |
| P1 | 看破（会心） | +1/+2/+3 会心值、负面版本及叠加上限 | 原生记录、伤害计算器、固定样本 | 数值与叠加顺序可复算 |
| P1 | 匠/斩味等级 | 斩味段延长规则、版本差异、达到上限后的行为 | 武器斩味表、技能逻辑、动作值计算 | 规则可用于配装器且不越界 |
| P1 | 属性攻击强化 | 火/水/雷/冰/龙及异常倍率、取整顺序、上限 | 原生参数、武器/伤害逻辑 | 每属性至少一个固定样本 |
| P2 | 防御、耐性、体力类技能 | 增量/倍率、猫饭及装备叠加顺序 | 原生参数、旧修改器计算 | 与三作现有统计计算一致 |
| P2 | 复合技能与特殊记录 | 胴系统、秘术、护石强化、技能点数 +2 的交互 | 原生技能表、规则插件、固定样本 | 明确 `x × 2 + 2` 等顺序并标版本 |

### 原生资源定位任务

- **MHGU/MHXX**：继续围绕 `nativeNX/table`、`nativeNX/system`、`skillData.skd`、`skillTypeData.skt`、`amuletSkillData00..07.amskl` 及其 GMD；必要时只读检查 `nativeNX/arc` 中与玩家状态、伤害和技能效果有关的 ARC。GU 与 XX 的公共文件做逐字节比较，但效果逻辑仍需分别确认。
- **MH3G/MH4G**：在 `romfs/arc`、`romfs/data`、`romfs/system`、`romfs/table` 和已展开 ExeFS 中按 `skill|skl|ability|status|param|damage|motion|evasion|weakness|tender` 关键词及 ARC 内文件名定向定位；若只找到代码引用而无参数表，结论标为 `code_only`，不能声称“没有技能表”。
- **旧修改器/项目代码**：只读搜索 `SkillsCalculation`、`MonsterCalculation`、`AttackUp`、`CriticalEye`、`WeaknessExploit`、`Evasion` 等符号，记录实现版本、输入字段和是否覆盖三作；发现仅有 GU 实现时不得外推。

### 探测输出约定与停止条件

每项效果最终输出一条可复制审计记录：

```text
game → dexSkillId/nativeSkillId → activation → formula/trigger
→ sample input/output → source files + hash/offset → evidence level → unresolved fields
```

在以下条件满足前，审计保持只读并视为未完成：

- 三作目标效果均有明确版本归属；
- 公式、触发条件和取整顺序能由固定样本复算，或明确标注 `unknown` 及阻塞原因；
- crosswalk 不存在名称/行号猜测；
- 原生文件路径、哈希和偏移可重复获得；
- 通过 `inspect_skill_effect.mjs` 能输出同一结论，且不会生成或修改正式图鉴数据。
