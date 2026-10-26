# P3 技能图鉴

在 P3 工作区选择“资料 → 技能”。需要包含 `skill_schema=mhp3-skills-v1` 的本地 `data/mhp3.sqlite`；旧道具库缺少这部分时，技能页会提示安装，道具和装饰品仍可使用。主进程接口变更或替换资料后需重启应用。

## 展示与关联

- 100 个技能系统、209 条普通发动效果（含 63 条负面）。名称、阈值与说明绑定 P3 日版原文；中文不补猜原文未给出的倍率或条件，英文为辅助术语／检索名。显示层把原生 `%%` 转为 `%`，冻结输入保留原文。
- 胴系复制单独显示特殊规则，包含胴部装饰品。原生复制标记不显示为普通 `+1`，没有虚构发动阈值；未审定的复合效果关系不显示为“无复合效果”。
- 搜索覆盖技能系、发动名、说明、别名、编号及相关防具／装饰品／护石名称，返回命中原因；支持方向、来源和排序。筛选、选择、来源标签与装备定位保存在 URL，列表／详情滚动在当前会话内保持。
- 防具只提供名称、原生身份、部位、稀有度、孔位、非零技能点与图标。现有术语库中日文完全相同且有审定中文证据的共通名称优先显示；其余显示原生日文。共通译名不代表两作装备数值或身份相同。取得条件未收录；25 件额外头部记录保留“取得未确认”。
- 护石区区分随机候选范围与特殊赠送，不判断双技能、点数和孔位的精确组合合法性。自动防御赠品显示 +10、0 孔、无第二技能，精确触发条件未确认；空记录不代表不存在合法护石。

正文点击关联对象打开一级抽屉。抽屉内点击珠或技能，先关闭再进入对应图鉴并定位；点击防具，先关闭再定位技能页内的防具关联预览，不打开第二层抽屉或跳转未接入的防具页。预览提供“返回技能详情”。Escape 关闭抽屉并归还触发按钮焦点。

## 接口与身份

`SkillCatalogGameId` 单独包含 P3，全局 `CatalogGameId` 不变。沿用 `getSkill`、`searchSkills`、`getSkillFacets`；新增 `getP3SkillArmor({gameId:'mhp3',armorKey})`。防具身份格式为 `mhp3:armor:<原生类型>:<编号>`，不伪造 `saveId` 或 `dexId`；装饰品关系继续使用 `{gameId:'mhp3',itemId}`。

构建仅追加 `p3_skills`、`p3_skill_armors`、`p3_armor_skill_points`、`p3_skill_charm_sources` 及技能版本元数据。珠信息由现有道具库投影；原道具业务表、名称指纹及词典保持不变。接口只读，不扩大完整装备图鉴、配装或存档写入范围。

## 离线构建

从仓库根目录运行。所有输入必须来自已冻结的私有快照，输出必须是新目录：

```bash
python3 -B -m tools.mhp3.build_skills \
  data/mhp3.sqlite \
  ../research/mhp3/skill-native-20261026 \
  ../research/mhp3/skill-catalog-20261026/review.json \
  ../research/mhp3/skill-catalog-20261026/icons-v1 \
  ../research/generated/mh-save-edit/mhp3/<新技能版本> \
  ../research/generated/mh-save-edit/terminology/versions/gu-pass-02
```

最后一项只用于校验共通防具中文名的冻结证据，不重建或改写应用词典。构建器核验原生契约、图标参考、像素及译文绑定，拒绝重复身份、译文数字变化、零点关系和缺失端点；只在输入库副本上写入。输出包括 `mhp3.sqlite`、`icons/`、`audit.json`、`manifest.json`。有 `FAILED.txt` 或缺少成功 manifest 的输出不得安装。

## 本地安装与恢复

关闭应用，先把当前 `data/mhp3.sqlite` 复制到新的私有备份目录并核验 SHA-256。比对候选库与备份的原道具业务表／名称指纹，检查库完整性、外键、全部技能／防具／护石关系和图标哈希。确认其他四作库和 `item-terminology.sqlite` 与安装前相同。

先安装 `icons/` 中内容哈希命名的 PNG；同名文件必须内容相同。把候选库复制到 `data/` 内的临时文件，再原子替换 `data/mhp3.sqlite`。本次只追加技能资料，不替换词典或其他游戏库。安装失败立即从备份原子恢复 P3 库，删除本次新装且未被其他资料使用的图标；不要删除原有图标。成功后重新执行 `pnpm build` 或启动 `pnpm dev`。

本地资料、输入、译文、图标、manifest、审计和截图仍属私有研究产物，不进入 Git、公开 Actions 或 Release。当前实际备份、安装指纹及验收记录见[技能交接](../../plan/mhp3-skill-catalog/handoff.md)。

## 验证入口

```bash
python3 -B -m unittest discover -s tests -p 'test_mhp3*.py'
pnpm exec vitest run tests/mhp3SkillCatalog.test.ts tests/mhp3SkillUi.test.tsx \
  tests/mhp3DecorationUi.test.tsx tests/homeEntryUi.test.tsx --exclude '**/.runtime-assets/**'
pnpm typecheck
pnpm build
```

公开测试使用合成资料。真实资料验收需要上述私有输入；浏览器静态验收不替代游戏运行、护石生成或真实存档验证。
