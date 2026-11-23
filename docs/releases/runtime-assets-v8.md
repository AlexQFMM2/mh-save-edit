运行资源 v8，适用于 MH Save Editor v0.1.17 及本版源码。在 v7 基础上加入 P3 原生护石生成规则，其余内容不变。

- 新增三张紧凑规则表：`p3_charm_generation_sources`（3 行，なぞ／光る／古びた 与道具 808/809/810、第二技能阈值 100/35/25）、`p3_charm_slot_tables`（252 行，21 rank × 4 孔，逐行累计到 100）、`p3_charm_grade_rules`（7 行，兵士～龍 的 f 区间）。
- `meta` 增加 `charm_generation_schema=mhp3-charm-generation-v1` 与数据版本；`mhp3.sqlite` 由 17,592,320 增至 17,633,280 字节。
- 完整 1,561,429 行护石组合表不进运行包，只作为私有研究对照片用于等价性测试。
- 其余数据库、2,874 张内容哈希图标、两份存档格式资料与应用图标与 v7 相同，共 **2,884 个文件**。

ZIP：`mh-save-edit-runtime-assets-v8.zip`，37,029,451 字节。SHA-256：

```text
47e312a9a0db5b0a2ec51dfb4741e4fd229001c955ab2bc90db81c9a3ccc0cec  mh-save-edit-runtime-assets-v8.zip
```

同页附 `SHA256SUMS.txt`。库完整性、护石规则表累计一致性、图标内容哈希与文件白名单已核对；旧资源 v7 保留。
