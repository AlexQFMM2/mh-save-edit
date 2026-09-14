# MHGU/XX 防具幻化解析、图标与写回专项计划

状态：宿主机完整 RomFS 与装备箱缩略图引用已确认；幻化图标素材阻塞已解除，进入 resolver/UI/写回验收（2026-09-13）

当前资源状态：完整的 MHGU Switch RomFS 位于宿主机 `D:\\MH\\unpack\\mhgu\\romfs`，已核对包含
`nativeNX\\arc\\ui`、`nativeNX\\arc\\player`、`nativeNX\\arc\\otomo`、`nativeNX\\table` 和多语言
目录。Linux `research/mhgu/romfs` 目前只是约 92 MB 的表格研究子集，不能代替宿主机完整资源；后续
图标探测统一通过 `ssh_admin` 直接读取宿主机，非必要不复制原始 ARC/纹理到本地。

2026-09-13 通过 `ssh_admin` 只读核对得到宿主机 RomFS 快照为 35,531 个文件、12,311,983,212 字节；
其中 `nativeNX` 下有 14,511 个 `.arc`、1,778 个 `.tex` 和 1,972 个 `.gui`。已确认装备箱、装备
详情和装备菜单都引用游戏原生缩略图资源：

```text
nativeNX\\eng\\GUI\\99_texture\\HD_cmn_icon_GSM_NOMIP.tex
```

`nativeNX\\eng\\GUI\\02_common\\i_box.gui` 中存在 `Tex_iconS000`～`Tex_iconS099` 和
`Tex_iconE000`～`Tex_iconE099`；装备详情 `menu_equipDetail.gui` 与装备菜单 `menu_equipMenu.gui`
也引用同一 `HD_cmn_icon_GSM_NOMIP` 资源。`iconE` 组即装备箱使用的缩略图引用入口。上述结论只
记录资源路径和 GUI 引用，不解析纹理内容、不提取 atlas 坐标、不制作逐外观图标。

本文件从存档修改器总计划中拆出 GU/XX 防具幻化专项，作为后续实现和验收的唯一入口。它只处理
猎人/猎猫防具的外观覆盖，不实现模型渲染、试穿预览或武器幻化。

## 0. 阻塞状态（2026-09-13）

当前没有需要继续等待解包或素材的硬阻塞。用户提供的 `防具幻化.png` 已补齐首版视觉入口，压缩
PNG/WebP 已完成；完整 RomFS 的 TEX 解码、逐外观 atlas 映射和模型预览均降级为非阻塞研究项。

仍需实施的工作属于代码实现与验收，不是外部资料阻塞：

- P0：生成五部位 appearance crosswalk，并统一 resolver 与同部位 validator。
- P0：装备详情同时显示实际装备和幻化外观，写入前报告无效/未知/跨部位诊断。
- P1：将用户素材裁成独立图标或 sprite，并接入装备箱角标、详情和编辑抽屉；不得把整张长图直接渲染为单个图标。
- P1：补有效、未知、跨部位、清除、猫头/猫身和武器禁用测试。
- 验收：使用 MHGU Switch/MHXX 真实样本完成 no-op、单字段写回、重开和再次读取。

以下不再作为首版阻塞：原生 TEX 转 PNG、完整 RomFS manifest、逐外观缩略图、3D 模型/试穿预览。

## 1. 探测结论

### 1.1 记录布局已确认

MHGU/XX 的 36 字节装备记录中，猎人和猎猫防具均将外观覆盖写在：

```text
0x04–0x05: appearanceId（little-endian uint16）
```

猎人记录的相关字段为：

```text
0x00–0x01: 装备类型与等级（猎人记录为 packed 字段）
0x02–0x03: 实际装备 saveId
0x04–0x05: 外观 appearanceId
0x06–0x0B: 三颗装饰珠
```

外观只改变显示，不改变实际装备的防御、耐性、技能、孔位、等级或制作关系。`appearanceId = 0`
表示没有幻化，不能被当成 ID 0 的普通防具。

### 1.2 外观候选不是 `catalog_armors` 的子集

旧 Cotto 编辑器的固定原生数组与项目私有 SQLite 的按部位表已经交叉确认：

| 部位 | 旧编辑器候选数（含 0） | 私有 `cn__armor_*` 非 0 行数 | 说明 |
| --- | ---: | ---: | --- |
| 头 | 1204 | 1203 | `id`、中文/英文名、稀有度、孔位均可读取 |
| 胸 | 1189 | 1188 | 同上 |
| 腕 | 1158 | 1157 | 同上 |
| 腰 | 1108 | 1107 | 同上 |
| 腿 | 1177 | 1176 | 同上 |

旧编辑器使用同部位的平行 `Names`/`IDs` 数组，并按数组索引选择，而不是按名称反查；这是必要的，
因为不同外观可能重名。当前 `catalog_armor_save_identities` 只保留能与公开 Dex 单件防具闭合的关系，
会漏掉联动、外观专用或未进入普通图鉴的候选，所以不能直接拿它作为幻化下拉数据源。

后续唯一来源分工固定为：

```text
外观候选：cn__armor_head/chest/arms/waist/legs + Cotto/native IDs crosswalk
实际装备：catalog_armors/catalog_armor_save_identities
```

两者不得通过中文名猜测互相替代。

### 1.3 幻化缩略图素材已取得，原生 TEX 不再阻塞首版

`../research/mhgu/dex/resources/MHXX_Dex.Resource Image.resources` 共包含 3211 个图像资源，其中：

```text
Amr_  88
Wpn_  198
Itm_  2925
```

`Amr_0101` 这类键按“部位代码 + 稀有度”组织；当前 `data/manifests/mhgu-armor-icons.json` 已覆盖
全部 88 个 `Amr_` 图标。它们确认了分类图标的命名和部位/稀有度编码，但它们来自 Dex 资源，不能
替代游戏 RomFS 证据。

当前 `../research/mhgu/romfs/mhgu-table` 和 `mhxx-table` 只是约 800 个表格/消息文件的研究子集，
包含 `otArmorData.oar`、`otArmorCreate.oec`、`armorSeriesData.asd`、`armorSeData.ased`、
`ArmorColorData.acd` 等数据表，没有完整 RomFS 的 UI 图集、纹理归档或资源路径清单。因此目前只能
确认“游戏内一定存在本地 UI 资源”，不能据此断言游戏中没有逐外观图标。此前“没有独立 thumbnail”
应改为“在现有研究快照中尚未找到”。

游戏本地化图标需要区分两种可能：

1. **通用分类图标**：装备箱只显示部位/稀有度，所有 appearanceId 复用同一 `Amr_` 类图标。
2. **逐外观图标或图集切片**：完整 RomFS 可能包含按装备 ID、模型 ID 或 atlas 坐标索引的纹理；这时
   必须从游戏 UI layout/texture archive 解析真实索引，不能按 appearanceId 顺序猜图。游戏是离线产品，
   正式结论必须建立在完整本地 RomFS 的清单和交叉验证上；现有快照不完整只能说明“尚未扫描到”，
   不能说明“游戏没有”。

首版图标结论：幻化入口不再等待逐外观 TEX 图集切片。用户已提供并确认一张纵向防具幻化图标素材
`防具幻化.png`（RGBA，1024×4096），已生成用于设计和运行时评估的压缩 PNG（256×1024，约
85 KB）与 WebP（256×1024，约 24 KB）。素材采用蓝紫到黄绿色渐变和统一黑色描边；最终接入时
应按图标边界裁剪为独立资源或 CSS/SVG sprite，不把整张超长画布直接塞进列表格子。该素材只表示
“存在幻化/幻化类别”，不表示具体外观装备本身。

素材边界：当前文件仅保存在本地 `design-preview/` 供设计确认，不进入公开仓库、Release 资产或
运行时私有资料包；正式接入前需由 UI 设计确定裁剪方式、透明留白和尺寸档位。即使素材尚未正式接入，
也不再阻塞 appearanceId 解析、同部位校验和写回实现。

`iconSource` 首版取值调整为：

```text
appearanceId = 0       → armor-category / none
appearanceId > 0       → custom-appearance-sprite
unknown appearance     → custom-appearance-sprite + fallback diagnostic
```

字段读写不被 TEX 解码阻塞。RomFS 中的 `HD_cmn_icon_GSM_NOMIP.tex` 和 `Tex_iconE000`～
`Tex_iconE099` 仍保留在研究记录中，用于后续需要还原原生装备箱视觉时的交叉验证；首版不生成
`appearance_id → atlas_rect`，不将 PNG/WebP 派生资源作为构建输入。

### 1.4 MH4G 合法性结论保持不变

MH4G 普通装备的结构、字段和部分部位规则可确认；发掘装备随机参数、护石技能/孔位组合的自然生成
合法性，现有解包与旧修改器不能完整证明。它们可以结构化编辑和无损写回，但自然合法性固定为
`unknown`，不能因有名称、图标或社区规则范围而标记为 `confirmed`。自动配装继续排除未确认的自然候选。

## 2. 数据构建与 crosswalk

### 2.1 私有表

在研究目录生成 `catalog_armor_appearances`（不进入公开 GitHub SQLite），字段固定为：

```text
content_game_id       = mhgu
save_type             = 1..5（头、胸、腕、腰、腿）
appearance_id         = uint16，稳定原生外观 ID
part                   = head|chest|arms|waist|legs
name_cn/name_en/name_jp
rarity                 = 原生/旧修改器交叉确认值
slots                  = 外观自身孔位，仅作资料展示，不参与实际装备计算
source_status          = confirmed|unknown
source                 = native-array|cn-armor-table|dex-crosswalk
icon_path              = Amr_<part-code><rarity>
icon_source            = custom-appearance-sprite|dex-armor-category|fallback
icon_fallback          = 0|1
```

构建顺序固定：

```text
旧修改器 Names/IDs → cn__armor_* 名称/稀有度 → 原生 otArmorData/oar 校验
→ 装备箱 GUI 缩略图引用核对 → 私有 PNG/WebP 派生资源与 manifest → appearance validator manifest
```

生成器不得用数组行号代替 `appearance_id`，不得用名称作为唯一键。名称重复时保留全部 ID。

### 2.3 游戏 RomFS 装备箱缩略图引用门槛

在实现缩略图 resolver 前，必须通过 `ssh_admin` 读取同一版本的完整 RomFS（MHGU Switch 与 MHXX
3DS 至少各一份）确认装备箱 GUI 的纹理引用；原始资源保留在宿主机，不因查询而复制到 Linux。首版
只做路径和引用核对，不解析纹理内容。步骤固定为：

1. 枚举装备箱、装备详情、装备菜单和商店 GUI；记录相对路径、大小、SHA-256。
2. 从 GUI 二进制中的资源引用字符串确认 `HD_cmn_icon_GSM_NOMIP.tex` 及 `Tex_iconE000`～
   `Tex_iconE099` 等装备缩略图入口。
3. 不做纹理格式、atlas 或逐外观索引研究；应用资源构建阶段允许对已确认的
   `HD_cmn_icon_GSM_NOMIP.tex` 做一次受控解码，生成 PNG 主资源，并可从 PNG 派生 WebP；不根据
   appearanceId 猜测逐件图片。
4. 用固定样本（皮制头饰、巨兽头盔、联动外观、`appearanceId=0`）只核对 GUI 选择了装备缩略图
   入口；具体每件装备是否有独立图标不在首版范围。
5. 输出结论类型：`game-equipment-thumbnail-reference` 或 `not-found-in-snapshot`。

若结论为 `game-equipment-thumbnail-reference`，保存私有资源引用 manifest：
`gui_path, texture_path, resource_prefix, source_hash, derived_png, derived_webp`；PNG 作为无损主资源，
WebP 作为可选体积优化副本。不生成 `appearance_id → atlas_rect` 映射，不伪造逐件图标。若仍为
`not-found-in-snapshot`，UI 使用明确标注的临时分类图标，并阻止“已完成原生装备箱缩略图引用”声明。

### 2.2 部位与类型

外观候选必须由显式 `save_type` 选择。当前 MHGU/XX 的猎人防具类型与部位映射为：

```text
save_type 1 → head
save_type 2 → chest
save_type 3 → arms
save_type 4 → waist
save_type 5 → legs
```

这张表必须由 crosswalk 提供给 resolver；禁止在 UI 或写入器中用“类型减一/加一”临时推导。
现有 resolver 的 fallback 映射需统一到此表，并和 `cn__armor_*` 做回归校验。

## 3. 解析、校验与写回方案

### 3.1 统一 resolver

新增：

```ts
resolveArmorAppearance(
  contentGameId: 'mhgu',
  saveType: 1 | 2 | 3 | 4 | 5,
  appearanceId: number,
): ArmorAppearanceResolution
```

返回：

```ts
{
  appearanceId,
  saveType,
  part,
  nameCn, nameEn, nameJp,
  rarity,
  slots,
  iconPath,
  iconSource: 'custom-appearance-sprite' | 'game-generic-category' | 'game-appearance' | 'atlas' | 'dex-category-provisional' | 'fallback',
  iconFallback: boolean,
  sourceStatus: 'confirmed' | 'unknown',
  diagnostics,
}
```

解析顺序固定为：

1. `appearanceId === 0` 返回 `none`，不查询普通防具。
2. 用 `saveType + appearanceId` 查询私有 appearance crosswalk。
3. 找不到时返回可读的 `unknown appearance #N`，保留原值，不按名称猜测。
4. 按 RomFS 审计结论选择真实游戏图标；若结论为通用分类图标，再按部位代码和稀有度查询 `Amr_`
   manifest；缺少具体资源时回退并设置 `iconFallback = true`。

### 3.2 两条状态轴

外观验证和装备整体验证继续分开：

```text
自然合法性：confirmed | invalid | unknown
结构可编码：encodable | blocked
```

规则：

- `appearanceId = 0`：confirmed、encodable。
- ID 存在且部位一致：confirmed、encodable。
- ID 不存在但记录长度和字段可保存：unknown；读取可继续，保存前要求用户确认或按产品策略阻止。
- 跨部位 ID：invalid；编辑器阻止应用，读取时显示错误诊断。
- 非 MHGU/MHXX、猎人武器、猫武器：appearance 编辑入口隐藏或禁用，并说明原版不支持。
- 猫头只能使用猫头候选，猫身体只能使用猫身体候选；不能把猎人五部位表混入猫防具。

### 3.3 写回原子性

编辑外观只允许产生一个 `set-equipment-fields` 补丁：

```text
仅修改 record[4..5]；保留实际装备、等级、装饰珠和未知字节
```

清除幻化写入 `appearanceId = 0`。应用前再次执行 resolver 和同部位 validator；校验失败不增加
revision、不写撤销栈、不生成半成品记录。保存仍由现有 session revision、备份、临时文件 fsync、
rename 和回读复核流程负责。

配装器和图鉴物化默认写入 `appearanceId = 0`，不得把普通防具模板的 `saveId` 自动当作幻化。

## 4. UI 修改范围

- 装备箱格主图表示实际装备；有幻化时叠加小型外观徽标。
- 详情固定并列显示“实际装备”和“幻化外观”；防御、耐性、技能、孔位只来自实际装备。
- 幻化编辑使用可搜索的同部位名称列表，支持当前项定位和清除，不暴露十六进制输入。
- 候选行显示部位、名称、稀有度、`Amr_` 分类图标和来源状态；出现 fallback 时显示文字提示。
- 关闭详情后重新打开必须重新解析同一 `appearanceId`，不能只保留 UI 临时名称。
- 猎人武器、猫武器保持禁用；猫防具仅提供头部/身体两类。

## 5. 验收清单

- [x] 五部位 `Amr_` manifest 共 88 个 Dex 分类图标已闭合。
- [x] 已取得并确认幻化图标设计素材；压缩 PNG/WebP 已生成，原始素材仍留在本地设计目录。
- [x] 装备箱原生 TEX/GUI 缩略图入口已确认；逐外观 atlas 映射不属于首版范围，不再构成阻塞。
- [ ] （非阻塞）对完整 RomFS 资源生成私有 manifest、引用关系和 SHA-256 审计报告。
- [x] 五部位旧修改器外观候选数组已找到并核对数量。
- [x] `appearanceId` 偏移、端序、清除语义已由 adapter 和旧 writer 交叉确认。
- [x] MH4G 发掘/护石自然合法性保持 `unknown`，不再误标为 confirmed。
- [ ] 生成 appearance crosswalk，并保留重复名称、未知 ID 和来源哈希。此项是实现数据完整性的待办，
  不是图标资源阻塞。
- [ ] 修正 resolver 的类型→部位 fallback，禁止隐式算术映射。
- [ ] 读取时返回外观名称、稀有度、图标来源和诊断。
- [ ] 写入时统一执行存在性、同部位、版本和编码校验。
- [ ] 详情和编辑抽屉完成实际/外观双预览及关闭重开回读。
- [ ] 测试有效、未知、跨部位、0、超出 manifest 稀有度、猫头/猫身体和武器禁用。
- [ ] 使用 MHGU Switch 与 MHXX 真实样本完成 no-op、单字段写回、游戏重开和再次读取。

## 6. 明确不做

- 不提交真实 SQLite、GMD、ARC、RomFS、图片或 crosswalk 生成产物。
- 不实现每个 appearanceId 的 3D 模型渲染、试穿预览或独立模型缩略图。
- 不开放猎人武器幻化、猫武器幻化、等级/经验修改或随身装备修改。
- 不把 MH4G 的未知自然合法性伪装成已确认，也不让自动配装生成未知发掘/护石组合。
