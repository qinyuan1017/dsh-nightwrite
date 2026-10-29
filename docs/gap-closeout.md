# 长夜差距清单 · 15 条交付对照表

对照的是 `长夜差距清单.md`（2026-10-28，387 行，15 条）。
每条列四处：**原来差在哪 → 怎么补的 → 代码在哪 → 你自己怎么验**。

验法都是能直接粘进终端的命令。`node -e` 那几条不依赖任何测试框架。

---

## 🔴 结构性 4 条

### 1. 零宿主钩子 —— 闸门架在一条能被绕开的路上

**原来**：`grep -c "ctx.on(" index.js` → 0。所有保护（闸门、道闸、`expectRev`）都挂在
`/nightwrite/api` 这唯一一条路上。模型完全可以用宿主原生的 `write` / `edit` 直接改
`chapters/0001.txt`，一层都不触发。25 个 skill 铺在 `~/.dsh/skills/` 反而放大了这条缝。

**现在**：`lib/hooks.js`（275 行）挂两个钩子。
- `tools/pre-execute`：认出「这是要改长夜资产」的调用（工具名 ∈ `write`/`edit`/`str_replace_editor`，
  且路径落在项目的 `chapters`/`ledger`/`outlines`/`facts`/`world`/`agents`/`skills` 之下），
  按项目配置决定放行 / 拦下。
- `tools/post-execute`：改完追一条提醒（要重算清单、要验收、要记账本），
  并把 AI 味评分和保真结果一起塞回去。

**默认是 `warn` 不是 `block`**。一上来硬拦，模型会以为环境坏了，绕着走；
作者要真拦得在项目设置里开 `enforce`。

**验**：
```bash
grep -c "ctx.on(" lib/hooks.js          # → 2
node -e "import('./lib/hooks.js').then(m=>console.log(Object.keys(m)))"
node test/backend.mjs 2>&1 | grep "钩子"
```

---

### 2. 不注入 subagents —— 派单是「投文本」，不是「起 agent」

**原来**：`inject = ['tools']` 只 1 个能力，`grep "runtime.start"` → 0。
`sendDispatch()` 必须从 `sessionController.list()` 里挑一个已有对话，
挑不到就报 `invalid('没有 workspaceId，无法新建会话')`。派单本质是往别人对话里插一段文本。

**现在**：`inject = ['tools', 'subagents']`，新建 `lib/spawn.js`（263 行）。
走宿主原生 `subagents.startActivation({ provider: 'spawn', maxDepth: 1 })`：
子代理有独立上下文、有人格（`agents/<role>.md` 的正文当 system prompt）、
有工具白名单（见第 3 条），跟作者的对话不混在一起。

宿主不支持 spawn、或手里没有活着的父代理时，自动退回写会话，并把 `spawnReason` 带回去 ——
免得界面以为「派了」，其实只发了个消息。

**验**：
```bash
grep -o "inject = \[[^]]*\]" index.js     # → ['tools', 'subagents']
grep -c "startActivation" lib/spawn.js      # → 6
node test/backend.mjs 2>&1 | grep "子代理"
```

---

### 3. 岗位没有工具白名单 —— 权限写在提示词里，不是编译器里

**原来**：`ROLES` 没有 `tools` 字段，只在任务书里写「你只能读和算」。那是提示，模型可以不理。

**现在**：`lib/roles.js` 加 `TOOL_SETS` 三档 + `roleTools(roleId)`。
`configureRoleAgent` 里调 `tools.restrict({ allow })`，越权调用被宿主直接拒。

| 档 | 白名单 | 谁用 |
|---|---|---|
| `read` | read / glob / grep / nightwrite_op | 审校、读者代理、责编 |
| `write` | 上一档 + write / edit | 写手、改写、文风、角色、世界观、架构 |
| `full` | 上一档 + bash / web_search / web_fetch | 资料员 |
| `dispatch` | 上一档 + nightwrite_dispatch / subagent | **只有总编** |

`nightwrite_op` 是常驻项（所有岗位都要能读账本、章节、字统计）。
`subagent` 只给总编 —— 岗位互相派单会把成本乘起来。

**验**：
```bash
node -e "import('./lib/roles.js').then(m=>{for(const[k,v]of Object.entries(m.ROLES))console.log(k.padEnd(30),v.toolSet)})"
node -e "import('./lib/roles.js').then(m=>console.log(m.roleTools('nightwrite-consistency-checker').join(',')))"
# → read,glob,grep,nightwrite_op   （连 write 都不给）
```

---

### 4. 没有段落级地址系统 —— 提案靠「字面唯一匹配」，原文一改就废

**原来**：提案的 `before` 是字面串，靠 `countOccurrences(text, before)` 找位置。
三个后果：改个错别字所有待采纳提案全废；同一句话出现两次就歧义；
`PROPOSAL_STATUS` 没有 `outdated`，失效提案只能静默进 `missed`。

**现在**：`lib/anchors.js`（209 行）。
- `paraId(chapter, index)` 给出稳定地址 `c<章>p<段号>`，配 `hashParagraph` 的 sha1 前 12 位。
- `locateText` 先按段号找，段号对不上再全章文本搜，搜到即回填新段号（自动愈合）。
- `anchorStatus` 三态：`ok` / `moved` / `lost`。
- `annotateDiffs` 给每条 diff 标一个 `applicable` —— 界面据此把不可用的提案灰掉。
- 提案状态加了 `outdated`：锚点彻底找不到时才进这档，不再混进 `missed`。

**验**：
```bash
node -e "import('./lib/anchors.js').then(m=>{const t='第一段\n\n第二段';const i=m.buildIndex(3,t);console.log(JSON.stringify(i.paras.map(p=>({pid:p.pid,h:p.hash}))))})"
node test/backend.mjs 2>&1 | grep -i "锚点\|段落"
```

---

## 🟡 能力缺口 6 条

### 5. 去AI味只有「命中列表」，没有 0–100 分

**原来**：28 条规则只输出 hits，作者看到「12 处命中」不知道是及格还是该整章重写。

**现在**：`lib/aiscore.js`（220 行）。8 类信号加权算总分，
`SCORE_PASS_MAX = 30`（超过 30 就不该落盘），分档 `SCORE_BANDS`。
低于 `SCORE_CONFIDENT_CHARS = 800` 字时不给分只给「样本太短」——
800 字以下算出来的分是噪音，会误导作者删改。

**验**：
```bash
node -e "import('./lib/aiscore.js').then(m=>{console.log(m.describeScore(m.scoreText('他把门推开，风灌进来。'.repeat(60))))})"
node -e "import('./lib/aiscore.js').then(m=>console.log(m.listScoreSignals().map(s=>s.label).join(' / ')))"
```

---

### 6. 没有内容保真校验（数字/专名不许丢）

**原来**：`grep "fidelity|保真"` → 0。「三年前」改成「五年前」、「张三」写成「张四」，查不出来。
改写工序越多，这种漂移越隐蔽。

**现在**：`lib/fidelity.js`（259 行）。改写前后各抽一遍锚点（数字、专名、引号内容），
按 `FIDELITY_NUMBER_RATIO = 0.8`（内部 `DEFAULT_RATIO`）判——改写后原文数字至少 80% 还得在。
丢了的逐个列出来，界面显示成「这三个数字不见了」，而不是一个笼统的警告。

**验**：
```bash
node -e "import('./lib/fidelity.js').then(m=>{const r=m.checkFidelity('三年前他欠张三五两银子','五年前他欠张四三两银子');console.log(r.level,'|',r.text)})"
# → block | 有改动动了事实（1 项），建议退回重改。
# r.numbers.lost 会具体列出「三」，r.numbers.added 列出「五」——不是一句笼统警告。
```

---

### 7. 没有成本估算

**原来**：一本 80 万字的书跑下来花多少钱，作者完全不知道。LNW 有 `lib/usage.js`，长夜 0。

**现在**：`lib/usage.js`（301 行）。读 DSH 会话的 jsonl：
`scanSession(dir)` 扫单个会话、`scanProjectSessions(target)` 按项目汇总、
`estimateBudget(input)` 按 `DEFAULT_PRICES` + `CHARS_PER_TOKEN = 1.35` 估出花费。
不联网、不读别处的凭据，只读本机会话文件。
价目表是默认值，`USAGE_PRICE_NOTE` 里明确写了「请按你自己的服务商单价核对」。

**验**：
```bash
node -e "import('./lib/usage.js').then(m=>console.log(Object.keys(m)))"
node test/backend.mjs 2>&1 | grep -i "成本\|用量"
```

---

### 8. 参考层厚度：25 份 skill 零 references

**原来**：25 个技能各只有一个 `SKILL.md`，正文合计 98,049 字节，**零 references**。
oh-story 同一层是 2,017,941 字节，差 20.6 倍。技能只有「原则」，没有「怎么做的细节」。

**现在**：**71 份 reference，593,320 字节**，加进 SKILL.md 后 `skills/` 合计
**702,718 字节**（×7.17）。25 个技能全部挂上 `## 参考层` 索引段。
单份平均 8,356 字节（oh-story 平均 6,934）—— 我们每份更厚，但总数仍少，
因为 oh-story 是 4 套工作台、38 个技能。

厚薄分布：`nightwrite-de-ai-style` 6 份、`write-chapter` 5 份、`continuity-pass` 5 份，
其余按使用频率递减。最厚的都给了「最容易写崩」的环节。

**验**：
```bash
find skills -name '*.md' -path '*references*' | wc -l    # → 71
du -sb skills | cut -f1                                   # → 702718
node test/skills-check.mjs 2>&1 | tail -1                 # → 377 过 / 0 不过
```

---

### 9. 没有配置 schema

**原来**：只有 `NIGHTWRITE_ROOT` 一个环境变量，其余全是硬编码。
宿主画不出设置表单，作者改不了任何行为，只能改代码。

**现在**：`lib/config.js`（242 行）手写 `export const Config`（零依赖，不引 schemastery）。
四处硬编码接上配置：数据目录、提案上限、历史保留份数、AI 味上限。
宿主读 `Config` 就能画出设置表；旧配置缺字段时按默认值补，不会因为少一个键就崩。

**验**：
```bash
node -e "import('./index.js').then(m=>console.log(JSON.stringify(m.Config,null,1).slice(0,500)))"
node --check lib/config.js && echo OK
```

---

### 10. 没有上游漂移监控

**原来**：长夜贴着 DSH 宿主的私有契约写（`ctx.tools.register` / `ctx.slots.register` /
`ctx.webServer.register` / `ctx.inject` / `sessionsController` / `subagents` /
`ctx.on('tools/pre-execute'|'tools/post-execute')`），宿主一升级这些名字就可能变，
而插件只会在运行时炸成「装了但界面空白」。

**现在**：`scripts/host-api.json` 记下用到的宿主 API 名字，
`scripts/check-host-api.mjs`（298 行）扫源码核对；`.github/workflows/host-api.yml`
每周一 03:00 UTC 跑一次，只在「名字真的不见了」时报警。
不做版本对比、不读网络 —— 版本号变了但 API 没变不该打扰人。

**验**：
```bash
node scripts/check-host-api.mjs        # 全在 → 退出码 0
cat scripts/host-api.json | head -20
```

---

## 🟢 工程卫生 3 条 + 并发 1 条

### 11. 零自动化 —— 1,265 项断言只能手动跑

**原来**：无 `.github`、无 `.git`（0 次提交）、无 `LICENSE`。
但 1,265 项断言三家最多且全绿 —— 全靠人记得跑，忘一次就烂一次。

**现在**：`.github/workflows/ci.yml` 五个 node 版本矩阵，跑
`build` → `backend` → `smoke` → `hooks` → `skills-check` → `wordcount-parity` → `cssaudit`。
另加 `host-api.yml`（第 10 条）。`LICENSE`（MIT）、`.gitignore` 补上。

**验**：
```bash
ls .github/workflows/            # ci.yml host-api.yml
cat LICENSE | head -3
```

---

### 12. 无类型声明

**原来**：119 个 op 的参数契约全靠运行时 `needProjectId(payload)` 挡，
调用方（尤其是写脚本调 RPC 的人）只能去读 2,393 字节的 `TOOL_DESCRIPTION`。

**现在**：`types/index.d.ts`（629 行），`scripts/gen-types.mjs` 从 `READ_OPS`/`WRITE_OPS`
和 op 处理函数生成，跟着 CI 跑一致性检查。

**验**：
```bash
wc -l types/index.d.ts                 # → 629
node scripts/gen-types.mjs --check && echo IN_SYNC
grep -c "export interface" types/index.d.ts
```

---

### 13. 无 lint / format 配置

**原来**：`.eslintrc*` / `.prettierrc*` / `tsconfig.json` / `.editorconfig` 全无，
`devDependencies {}`。

**现在**：`.editorconfig` / `.prettierrc.json` / `eslint.config.mjs`（flat config）。
`scripts/gen-eslint-globals.mjs` 生成 React/Node 全局名，免得满屏 `no-undef` 噪音。

**这条一装上就抓到一个真 bug** —— 见下面「顺带修掉的两个白屏」。

**验**：
```bash
node node_modules/eslint/bin/eslint.js . 2>&1 | tail -2    # → 0 errors
```

---

### 14. 无 i18n

**原来**：无 `locale/`，所有文案硬编码中文。

**现在**：`locale/zh.json`（792 行 / 784 条）/ `locale/en.json`（792 行 / 784 条，与 zh 逐键对齐）/ `lib/i18n.js`（200 行）。
`scripts/gen-i18n.mjs` 从源码抽文案键，缺哪条 CI 报。
英文版是给「以后要给别人用」留的门，当前界面仍默认中文。

**验**：
```bash
node -e "const z=require('./locale/zh.json'),e=require('./locale/en.json');const zk=Object.keys(z),ek=Object.keys(e);console.log('zh',zk.length,'en',ek.length,'缺',zk.filter(k=>!e[k]).length)"
```

---

### 15. 全库裸 read-modify-write

**原来**：`grep -rn "mutex|withLock"` → 0。
`proposals.json` / `problems.json` / `dispatches.json` / `ledger.json` / `queue.json`
全是裸 RMW。`writeJsonAtomic` 只保证「不出半截文件」（tmp + rename），
**不保证后写不覆盖先写**。`state_revision` 的注释自己都写着「是脏标记不是事务日志」；
`expectRev` 只管单章正文。同一岗位还能并行开多张票。

**现在**：新建 `lib/lock.js`（96 行）。
- `serializeBy(key, fn)`：同一 key 的异步操作严格串行（`Map<key, Promise>` 链）。
- `withLock(path, fn)`：按文件路径加锁的便捷包装。
- `lockProject(projectId)`：整项目级锁。
- `lockStats()`：给测试和诊断看的当前锁状态。

铺进 `lib/store.js`（提案、问题、派单、账本、队列、章节索引）与 `lib/corpus.js`。
`issueDispatch` 加「同角色已有活动票就拦住」的检查。

**验**：
```bash
node -e "import('./lib/lock.js').then(async m=>{const o=[];await Promise.all([1,2,3].map(n=>m.serializeBy('k',async()=>{o.push('a'+n);await new Promise(r=>setTimeout(r,5));o.push('b'+n)})));console.log(o.join(','))})"
# → a1,b1,a2,b2,a3,b3   （不串行会是乱的）
node test/backend.mjs 2>&1 | grep "锁"
```

---

## 顺带修掉的两个白屏（这条清单之外）

补第 13 条装 eslint 之后，`react-hooks/rules-of-hooks` 报出 9 条 —— 那不是格式问题，
是**第二个「提案打不开」**：

### StudioPage（`src/30-studio.js:180`）
三个 `useAsync` 在 182–184 行，`if (broken) return <ErrorBox/>` 排在 187 行，
后面还有 9 个 hook。首帧正常（12 个 hook），一旦有接口报错就只走 3 个 hook 就 return ——
hook 数跳变，React 抛错，**生产台整页白屏**。

跟之前修过的 `ProposalBoard`（`src/45-triage.js:120`）是同一个错。
区别是：ProposalBoard 是「loading → 有数据」的转折触发，稳定必现；
StudioPage 是「接口报错」才触发，所以只在后端挂的时候出现，更隐蔽。

**修法**：早退挪到最后一个 hook 之后。已落盘，备份 `src/30-studio.js.bak-hookfix2`。

### 扫描器漏检（`test/hooks.mjs`）
`test/hooks.mjs` 是为此类问题写的静态检查器，但它**报了 45 过 0 不过** ——
只认缩进 2 格的 `return`，而 `if (broken) { return ... }` 里那个缩进 4 格，看不见。

改了两版才对：
1. 先改「按花括号深度判 `depth === 1`」→ 仍漏，因为 if 块里 depth 是 2。
2. 再改成「记哪几层是嵌套函数体」：箭头函数 `{` 前一定是 `=>`，普通函数靠 `function` 关键字。
   进入这样的层就是进了新函数，里面的 return 不算组件的顶层返回。
   这样 `useEffect(() => { return () => {} })` 的 cleanup 不会被误判成早退。
3. 另加一道 **eslint 兜底**：装了 eslint 就跑一遍 `rules-of-hooks`，任何一条都算失败。
   Windows 上不能 `execFileSync('npx')`（是 `npx.cmd`，ENOENT），
   也不能 `shell: true`（路径带空格会被拆开）—— 改成 `node node_modules/eslint/bin/eslint.js`。

现在拿修复前的文件回测：自写扫描器报 1 条 + eslint 兜底报 9 条，两套判据都响。

**验**：
```bash
node test/hooks.mjs        # → 53 过 / 0 不过 · hook 顺序检查 ·（eslint 通过）
```

**教训**：一个「全绿」的检查器可能只是它看不见。写检查器时要拿「已知有问题的文件」
回测一遍 —— 如果它在坏文件上也报全绿，那它的全绿毫无价值。

---

## 现在这套东西的规模

| 项 | 数 |
|---|---|
| RPC op | **119**（读 60 / 写 59） |
| 服务端 lib | 24 个模块，`lib/` 合计 8,000+ 行 |
| 客户端 | 23 个 `src/*.js` 片段 → `lib/client.js` **527,180 字节** |
| 界面 | 8 页 + 三步建书向导 + 写作原则条（P0–P5 重构：底栏十颗钉子收成八颗仍是底栏居中胶囊，`pipeline`+`studio`→`dispatch`，`run`+`cockpit`→`today`，验收台 5 抽屉→3 档） |
| 岗位 | 11 个（coordinator 独占派单权） |
| 技能 | 25 个 + **71 份 reference / 702,718 字节** |
| 测试 | backend **732** / smoke **460** / hooks **53** / skills-check **377** / wordcount-parity **11** / css **714** 类缺 0 / check24 24-24 / qa 严重 0 —— 五个测试脚本合计 **1,633 项断言，全绿** |
| 宿主能力 | `inject = ['tools', 'subagents']`，2 个钩子，1 个 `Config` |
| 依赖 | 0（`dependencies` / `peerDependencies` / `devDependencies` 里只有 eslint + prettier 是 dev） |

三家横向比：LNW 90 op / 19 张 SQLite 表 / 20,206 行 / 0 钩子 / 0 skill；
oh-story 5 注入 / 4 钩子 / 6,071 行插件 + 25.4 MB 知识资产 / 38 skill；
长夜 119 op / 0 数据库 / 18,000+ 行 / 2 钩子 / 11 岗位 / 25 skill + 71 reference / 0 依赖。

长夜是唯一同时「零依赖 + 零数据库 + 有 skill + 有 agent」的。
