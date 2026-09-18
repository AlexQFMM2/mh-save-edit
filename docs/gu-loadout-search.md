# GU 五技能搜索与运行资料准备

## 模型与证据边界

GU/XX按用户确定的工作前提：“没有配对条件；这一点先如此断言”。候选依同品级A/B技能池及各自范围组合，不要求额外配对白名单。孔数仍由两技能的充足度共同判定，不等同于任选0～3孔。

- GU/XX四张原生孔位表分别交叉核验，逐档比较**0、1、2、3孔是否可生成**。
- 原生权重与参考累计阈值的概率差异可以保留，但可生成性不一致必须失败；不能将参考百分比冒充原生掉率。
- 充足度公式及资源/品级对应关系仍来自已测试的生成参考，不声称完成GU ExeFS逆向。
- 运行库只有在生产审计摘要与当前表匹配时才启用已核验孔位规则。缺证据或改表后摘要过期仍为未知，自动候选不以放宽校验补救。
- 手动诊断分别指向A/B成员、点数、孔位及编码；可编码的未知/不自然原值不清空。

## 搜索职责

`searchDecorationPatterns.ts`负责普通技能的容器装珠模式与有符号状态缓存。模式保留负点，目标子集共享有限孔位资源，不把每个目标都当作能独占所有孔位。实际发动的GU修正技能、带修正技能的珠子等未支持情况回退原精确求解器；仅有未发动点数不必回退。

`searchOrdering.ts`只按目标缺口和装珠补足成本改变访问顺序，不删除候选。`autoSearch.ts`按各部位排名总和分层扩展，避免长期固定头胸等前置部位；最终层仍覆盖完整候选域。求解保持原时间预算、暂停取消和终态语义，结果仍由统一计算器复算。

## 私有资料准备顺序

原生文件、数据库、来源记录和验收报告均为私有产物，不进入Git。只使用已有固定研究输入，不在应用或CI中访问宿主机，不重新导出完整RomFS。

1. 关闭对目标库的写入，先保留一致性备份；有活动WAL时使用SQLite备份机制，不能只复制主文件。
2. 先完成目录构建/既有防具技能映射准备。旧GU防具可能仍是Dex技能ID，**仅补孔位证据不能代替这一步**。现有注入流程使用`pnpm data:repair:runtime`；单库工具可复用`migrateArmorSkillIds(db, 'mhgu')`与`auditCatalogSkillReferences`。
3. 对需要交付的每一份GU数据库显式准备原生证据：

```sh
node tools/verify_charm_slot_evidence.mjs \
  --database /path/to/existing/mhgu.sqlite \
  --romfs-root /path/to/fixed/private/romfs
```

输入目录需包含`mhgu-table/amuletSlotData00.amslt`至`03.amslt`，以及`mhxx-table`下对应文件。工具拒绝缺失/不一致输入，先全部核验再事务写入零充足度行和摘要；无变化时不写数据库。它不会新建数据库，也不会复制原生文件进入应用。

4. 运行`pnpm data:audit:runtime`。GU缺零档、覆盖不完整或摘要缺失/过期时必须失败，不能靠临时标记`verified`绕过。
5. 数据重建后重新准备并验收；不要假定旧摘要仍适用。运行库和规范生成库都要核对，不能只修开发库。

## 打包一致性

`pnpm package:win`现在依次执行运行资料审计、应用构建、既有Windows目录打包，最后核对三套包内SQLite是否与已审计输入字节一致。保持`--publish never`，不会替换Release资产。

包后检查是纯文件哈希比较，不加载`better-sqlite3`：打包过程可能已将原生依赖切换为Electron ABI，此时不能再用宿主Node执行SQLite审计。独立检查入口：

```sh
node tools/verify_packaged_runtime.mjs \
  --source-data /path/to/audited/data \
  --packaged-data /path/to/win-unpacked/resources/data
```

这项检查只证明复制身份，原生证据与schema由前置运行审计负责。源和包内目录都拒绝活动WAL及三作目录库以外的SQLite，避免复制不完整主库或混入状态/存档文件。旧加密资产不会因源码更新自动修好；以后发布前仍需按单独授权更新经过验收的私有运行资产。构建/Worker通过不等于已完成Windows界面、模拟器重开或真实存档验收。

## 回归与复现

`guFiveSkillSearch.test.ts`使用用户指定样本标识，从私有目录库读取装备数据。截图的锋利度11为实得点数，界面利刃发动阈值为10；严格11点和真实界面阈值分别测试，不能混用。

- `guCharmPreparation.test.mjs`：纯合成旧库迁移、字节幂等、0～3孔、缺输入、回滚及打包门禁。
- `searchDecorationPatterns.test.ts`：三作各24个小空间，与不剪枝枚举对照，要求同时包含可行和不可行案例。
- `searchTraversal.test.ts`：完整返回小空间的全部20个可行装备元组，不重复、不漏掉低排名候选。
- `guCharmEvidenceRuntime.test.ts`：明确指定私有旧库/已准备库，验证未知→已确认及改表后摘要过期降级；变异只在内存副本上进行。
- `guBuiltWorker.test.ts`：真正启动编译后的Worker，对运行库、旧资产升级副本、规范库，从**空白防具与护石**出发搜索5个结果并复算，不复用手动方案作为答案。

本地完整验证示例（POSIX shell；PowerShell用对应环境变量语法）：

```sh
pnpm typecheck
pnpm build
GU_LEGACY_DATABASE=/private/unchanged-old/mhgu.sqlite \
GU_FIVE_SKILL_DATABASE=/private/prepared-old/mhgu.sqlite \
GU_CANONICAL_DATABASE=/private/canonical/mhgu.sqlite \
GU_BUILT_WORKER=out/main/auto-search-worker.js \
MH4G_CHARM_EXECUTION_FILE=/private/mh4g/execution-v1.json \
pnpm test
```

缺少显式私有输入时，相关私有集成测试会跳过；不能把跳过当作验收通过。真实耗时、文件哈希、恢复点和中途失败报告保留在私有研究区，而不是复制进本文。
