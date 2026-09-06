# Game data

三套只读 SQLite 数据库放在这里：`mh3g.sqlite`、`mh4g.sqlite`、`mhgu.sqlite`。

数据库除了各作原生数据外，还包含统一的 `catalog_items` 和
`catalog_item_relations` 表。它们以存档数组的 `save_id` 为主键，用 Dex 的
`Hex` + 名称交叉验证补充 `dex_id`、稀有度、持有上限、价格、图标和已确认关系。
`data/manifests/` 保存构建来源 hash、条目数和映射审计；原始 Dex、EXE、ROM 和
存档不进入仓库。

从临时 Dex 导出重新生成图鉴数据：

```bash
pnpm data:build:items
```

构建器会在输入和图标 manifest 未变化时跳过数据库写入，确保连续构建结果稳定。
