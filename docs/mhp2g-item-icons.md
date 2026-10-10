# P2G 道具图标

2026-10-10 本地接入范围：1,260 个非占位道具，46 个图形编号、10 个颜色编号，277 张 24×24 透明 PNG。编号为 0 的占位条目保留无图标状态。列表、道具详情和关联道具抽屉通过现有 `CatalogIcon` 显示图片。

## 原生证据与边界

输入为已核对的 P2G-CGCN 展开目录，BOOT SHA-256 固定为 `3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846`。其他地区、汉化或补丁版本必须重新核对，提取器会拒绝不匹配的输入。

本轮读取了原生绘图代码，并与既有 r9 道具快照逐条比较 24 字节记录的 SHA-256：

| 对应内容 | BOOT 虚拟地址 / 规则 |
| --- | --- |
| 道具定义 | `0x0899A238`，24 字节一条；`+5` 为图形编号，`+6` 为颜色编号 |
| 颜色表 | `0x08937FA4`，4 字节步长，绘制调用读取前三个 RGB 字节 |
| 图形到裁切记录的索引 | `0x08938014`，两组各 56 个 uint16；大图标使用第一组 |
| 裁切记录 | `0x089366F0`，12 字节：x、y、宽、高、纹理选择、资源键 |
| 索引函数 | `0x088305FC`，按图形编号与大小组查询索引 |
| 道具绘制路径 | `0x0882E504`，读取图形及颜色，调用 `0x0882C360` 绘制 |
| 图片资源 | `DATA.BIN` member 5323，资源键 11；picture 0 和 1 包含本次使用的全部大图标 |

不能按图形编号连续裁格：装饰珠、回旋镖、瓶、蟹、天鳞和铠玉等使用另一张图片。两张图片均为 PSP T8 索引色、RGBA8888 调色板，按 16 字节 × 8 行进行反 swizzle，再依原生矩形裁出 24×24 图标。

绘图路径使用 RGBA modulate。导出将 RGB 按原生颜色相乘并四舍五入到字节，保留纹理 alpha；第四个颜色表字节不当作透明度。游戏 HUD 还会叠加可食用、当前无法使用等状态提示，这些依赖界面状态的覆盖图不烘焙进静态图鉴图标。

公开结构参考：[tclamb/mhp2g-decomp 的固定提交](https://github.com/tclamb/mhp2g-decomp/tree/54a72e472e731a06e726b4a56206a8e049c67315)，其中 `include/item_manager.hpp` 定义了图形和颜色字段。裁切表、颜色表及绘制函数的实际证据来自匹配哈希的本地 BOOT。参考源码只用于解释，不能替代原生记录校验。

## 私有快照与复现

本地生成物位于仓库外的 `research/generated/mh-save-edit/mhp2g/`：

- `icons-v1/`：裁出的内容哈希 PNG、逐道具映射、颜色/矩形与来源哈希。
- `catalog-items-icons-v1/`：由 r9 构建的资料库、图标和审计结果。

源游戏、原始图集、指令探查、映射 manifest 和审计结果不进入 Git。应用只使用数据库中的 `icon_path` 和对应 PNG，不需要访问宿主机。生成物按现有数据边界保存；本步骤不变更公开 Release 的资料库清单。

提取器在宿主机内存读取已定位的资源，只返回裁好的 PNG 与最小映射，不写宿主机文件，也不复制完整图集或 BOOT。它需要已有的私有 `toc-probe.json` 和固定的 mhef PSP 参考文件，后者只用于读取解码置换表，不执行该参考文件。

```bash
python3 tools/extract_mhp2g_item_icons.py \
  --host win10@192.168.137.1 \
  --game-root 'D:\MH\unpack\mhp2g\P2G-CGCN' \
  --cipher-reference ../research/mhp2g/mhef-psp-reference.py.txt \
  --toc ../research/mhp2g/toc-probe.json \
  --output /path/to/new-icons-directory

pnpm data:build:p2g-items \
  --source /path/to/pilot-r9/mhp2g-pilot.sqlite \
  --icons /path/to/new-icons-directory/manifest.json \
  --output /path/to/new-catalog-directory

pnpm data:audit:p2g-items \
  --source /path/to/pilot-r9/mhp2g-pilot.sqlite \
  --delivery /path/to/new-catalog-directory
```

提取和构建均拒绝覆盖已有输出。审计通过后，备份本地 `data/mhp2g.sqlite`，安装新资料库，将 `icons/*.png` 复制到 `ui/public/assets/catalog/icons/`，重新启动应用。已有文件必须按 SHA-256 核对，不能覆盖不同内容的同名文件。

## 验证

构建和审计均检查：完整覆盖非占位道具、无重复映射、原生记录哈希及图形/颜色一致、无孤立图标、内容哈希路径和 PNG 尺寸/文件哈希。错配、漏配、图片损坏时停止生成，原数据库不受影响。

`tests/mhp2gItemIcons.test.mjs` 和配套 Python 合成测试覆盖跨 swizzle 块裁切、颜色与透明度、PNG 校验、错配/漏配拒绝，以及 repository 的列表/详情图片字段。测试不携带游戏图片或原生数据。

```bash
pnpm exec vitest run tests/mhp2gItemIcons.test.mjs
node tools/verify_mhp2g_runtime.mjs
```

第二条命令使用私有快照，逐条读取实际资料库并校验安装后的图标文件；首次接入还应在 Electron 中检查全部图片加载，以及药品、书、矿石、虫、装饰珠和铠玉等不同类别的实际显示。
