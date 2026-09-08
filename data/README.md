# Game data

三套只读 SQLite 数据库在本地构建后放在这里：`mh3g.sqlite`、`mh4g.sqlite`、`mhgu.sqlite`。

数据库除了各作原生数据外，还包含统一的道具、装饰品、武器和防具 `catalog_*` 表。
武器目录保留存档身份、Dex 节点、派生边、属性、斩味阶段、材料、类型专项数据和
GU/XX 版本覆盖；MH4G 发掘武器不会写入公共武器目录。
`data/manifests/` 在本地保存构建来源 hash、条目数和映射审计。SQLite、manifest
与图标都是被 `.gitignore` 排除的私有生成产物；公开仓库只保留构建器和 schema。
权威本地副本归档在 `../research/generated/mh-save-edit/catalog/`。

从固定研究快照重新生成武器数据：

```bash
pnpm data:build:weapons -- --research-root ../research
```

构建器会先逐文件验证 Dex `source-manifest.json` 的大小和 SHA-256，再生成三库及
`data/manifests/*-weapons*.json`。正式构建不访问 Windows 宿主机或 `/tmp`。

从固定研究快照重新生成防具数据：

```bash
pnpm data:build:armors -- --research-root ../research
```

防具构建会完全排除 MH4G 发掘防具，并生成单件、技能、材料和近战/远程双行套装关系。
构建器优先读取项目已忽略的本地图标 manifest；没有时读取
`../research/generated/mh-save-edit/catalog/data/manifests/*-armor-icons.json`。三作 Dex 的
`Amr_<部位><稀有度>` 小图标当前均已完整映射，图片及 manifest 仍不进入公开 Git。
