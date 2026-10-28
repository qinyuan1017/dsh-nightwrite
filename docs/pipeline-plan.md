# 长夜 · 流水线方案（对齐 LNW 的启动方式 + agent 输出回台）

> 目标：把现在「11 个 agent 躺在那儿、靠人一句句喊」变成「一句话启动 → 自动按链派单 → 每一步的产出都回到工作台能看」。
> 本文只讲设计，不含代码改动。

---

## 一、先看 LNW 到底怎么做的（实证，不是猜）

LNW 的「启动 + 安排」由四样东西咬合而成，缺一样都跑不起来：

### 1. run —— 一个落盘的状态机

`lib/store.js:2153` `saveRun()` 把整个运行实例写进 `runs.json`：

```
kind      continue | expand | rewrite（+variant: style|logic|structure）
scope     book | chapter | range
chapter / endChapter
status    idle | running | paused | done | failed | aborted
currentStage
stages[]  [{ id, title, status: pending|running|done|failed }]
budget    { maxTokens, maxCostCNY }
startedAt / finishedAt / notes[]
```

### 2. 阶段模板 —— 每种动作一套固定阶段

`index.js:180` `RUN_STAGE_SETS`：

| 动作 | 阶段 |
|---|---|
| continue | 先定注意力设计 → 读大纲与账本 → 规划本章场景 → 逐章写作 → 闸门校验 → 本章自检 |
| expand | 注意力 → 定位扩写点 → 生成扩写方案 → 逐章扩写 → 闸门校验 |
| rewrite:style | 注意力 → 文风校准 → 逐章改写 → 闸门校验 |
| rewrite:logic | 注意力 → 通读与事实核对 → 生成改写方案 → 逐章重写 → 闸门校验 |
| rewrite:structure | 注意力 → 结构梳理 → 结构调整方案 → 逐章重构 → 闸门校验 |

`runStageDefaults(kind, variant)` 返回时把第 0 个设为 `running`，其余 `pending`。

### 3. 派单票据 —— 强制「谁来交」的凭证

`lib/dispatch.js` 全文只有 3.4KB，但它是整套东西的锁：

```js
const TTL_MS = 30 * 60 * 1000
const tickets = new Map()          // 内存，重启即失效

issueTicket({ role, projectId, task })  // → { id: 'dp_xxxx', role, projectId, expiresAt, submissions }
requireTicket(id, { role, projectId, consume })  // 票据不存在/过期/角色不符/项目不符 → 抛错
dispatchPrompt({ ticket, roleInfo, task, materials })  // 生成给主对话的任务书
```

**关键设计**：子 agent 提交结果时必须带 `dispatchId`。服务端 `requireTicket` 校验三件事——票据有效、角色对得上、项目对得上。这让「谁说的话」不可伪造。

### 4. 界面 —— 阶段进度 + 预算

`client.js:4822` 起是一整块 `nd-run` 面板：
- `nd-run-head`：标题 + meta + 7 个动作按钮（开始/推进/暂停/继续/结束/中止）
- `nd-run-grid` 左栏：`Bar` 进度条（doneStages/total）+ `nd-stages` 列表（每行一个圆点，`nd-stage-done/running/failed` 三态染色）
- `nd-run-grid` 右栏：预算卡（tokens / 成本 / 上限）

### 5. 结论：run 自己不干活

`runTool` 的 `execute()` 全程**只读写状态**，一个字节正文都不产。真正干活的是主对话：
```
用户说「继续写」
  → 主对话调 novel_desk_run(op=start) 建 run，界面出现进度条
  → 主对话调 novel_desk_dispatch(role, task) 拿 dispatchId
  → 主对话用 subagent 起子 agent，把 dispatchPrompt 交给它
  → 子 agent 带 dispatchId 提交
  → 主对话调 novel_desk_run(op=advance, stageId) 推一格
  → 界面进度条走一格
```

---

## 二、长夜现在缺什么

| LNW 有 | 长夜现状 | 后果 |
|---|---|---|
| `runs.json` 落盘 | 无 | 「这一章走到哪一步了」只存在于对话上下文，一关会话就忘 |
| 阶段模板 | 无 | coordinator 的派单链只写在 md 里，没有可执行的结构 |
| dispatchId 票据 | 无 | agent 交回的报告无法校验来源，谁都可以冒充「审校说无致命」 |
| `agent_reports` 存储 | 无（`proposals` / `problems` 是给人和 AI 混用的，不是 agent 回执） | **agent 的输出根本没有地方落，界面自然没东西可展示** |
| `nd-run` 面板 | 驾驶舱只有 queue 的「N 章在队列里」 | 看不到分工进度 |
| `run` 的 7 个 op | 47 个 op 里 0 个编排类 | 无法启动、无法推进、无法中止 |

**最要命的一条**：现在 agent 跑出来的东西只能留在对话里。用户要「展示到工作台」，不是加个框就行——得先有地方存。

---

## 三、方案：三层

### 第 1 层 · run 编排（服务端，对齐 LNW 但改一处）

新增 `lib/run.js`（约 260 行）+ `runs.json`：

```js
{
  id: 'run_a1b2c3',
  projectId: 'p_xxx',
  chapter: 42,
  chain: 'write',              // plan | write | audit | reader | revise
  status: 'running',
  currentStage: 'write',
  stages: [
    { id: 'architect', kind: 'agent', role: 'nightwrite-story-architect', title: '出这一回细纲', status: 'done',
      dispatchId: 'dp_xxx', startedAt, finishedAt, reportId: 'rp_xxx' },
    { id: 'write-chapter', kind: 'skill', skill: 'nightwrite-write-chapter', title: '写作门禁核对', status: 'running' },
    ...
  ],
  gate: { consistency: { fatal: 0, warn: 2 }, risk: 'low', engagement: 8, pass: true },
  createdAt, updatedAt, startedAt, finishedAt
}
```

**与 LNW 的关键差异（也是长夜该强的地方）**：

LNW 的 stage 是「动作步骤」（读账本 → 规划 → 写 → 校验），因为它是**一个 AI 从头做到尾**。
长夜的 stage 必须对应 **agent / skill**，因为长夜的核心就是分工。所以：

```js
const CHAIN_STAGES = {
  plan: [
    { id: 'architect',    kind: 'agent', role: 'nightwrite-story-architect',  title: '出总纲与细纲' },
    { id: 'plan-novel',   kind: 'skill', skill: 'nightwrite-plan-novel',      title: '规划手册核对' },
    { id: 'story-bible',  kind: 'skill', skill: 'nightwrite-story-bible',     title: '账本登记' },
  ],
  write: [
    { id: 'writer',       kind: 'agent', role: 'nightwrite-chapter-writer',   title: '执笔正文' },
    { id: 'write-chapter',kind: 'skill', skill: 'nightwrite-write-chapter',   title: '写作门禁核对' },
    { id: 'de-ai-style',  kind: 'skill', skill: 'nightwrite-de-ai-style',     title: '去 AI 味' },
  ],
  audit: [
    { id: 'consistency',  kind: 'agent', role: 'nightwrite-consistency-checker', title: '事实审校' },
    { id: 'continuity',   kind: 'skill', skill: 'nightwrite-continuity-pass',    title: '连贯性复检' },
  ],
  reader: [
    { id: 'reader',       kind: 'agent', role: 'nightwrite-reader-proxy',     title: '读者体验' },
    { id: 'reader-report',kind: 'skill', skill: 'nightwrite-reader-report',   title: '体验报告' },
    { id: 'drop-off',     kind: 'skill', skill: 'nightwrite-drop-off-check',  title: '流失点定位' },
    { id: 'engagement',   kind: 'skill', skill: 'nightwrite-engagement-curve',title: '追读曲线' },
  ],
  revise: [
    { id: 'rewrite',      kind: 'agent', role: 'nightwrite-rewrite-specialist', title: '定向改写' },
    { id: 'revision',     kind: 'skill', skill: 'nightwrite-revision-pass',     title: '修订门禁' },
    { id: 'recheck',      kind: 'agent', role: 'nightwrite-consistency-checker',title: '回炉复检（不通过则打回）' },
  ],
}
```

`kind: 'skill'` 的 stage **不派子 agent**——它是主对话自己按 SKILL.md 做的检查项，做完善后打勾。这样 25 个 skill 有落点，又不用 25 个子 agent。

新增 op（9 个）：`run.start` / `run.status` / `run.advance` / `run.pause` / `run.resume` / `run.finish` / `run.abort` / `run.list` / `run.get`

`run.advance` 是核心：`{ runId, stageId, reportId?, gate? }` → 把该 stage 标 done、下一格标 running、`gate` 合并进 run.gate。

### 第 2 层 · 派单票据（服务端，比 LNW 多一步）

新增 `lib/dispatch.js`（约 90 行）：

```js
const TTL_MS = 60 * 60 * 1000   // 比 LNW 的 30 分钟长一倍，长夜的写作阶段更慢

issueTicket({ runId, stageId, role, projectId, task })
  → { id: 'dp_xxx', runId, stageId, role, projectId, task, expiresAt, submissions: 0 }

requireTicket(id, { role, projectId, runId, consume })
  → 校验存在 / 未过期 / 角色符 / 项目符 / run 符
```

**与 LNW 的两点改进**：
1. **票据落盘**（`dispatches.json`），不只放内存——长夜的写作阶段常常跨会话，内存版重启就废。
2. **票据绑定 runId + stageId**，不只是一个 role。这样能反查「这条回执属于哪次运行的哪一格」，界面才能把回执挂到对应 stage 上。

配套 `dispatchPrompt()`：生成给主对话的任务书，内含
- 角色名 + 职责 + 只允许用的工具 + 输出上限
- 岗位手册路径 `agents/<role>.md`（动手前必须先读）
- 回执工具调用样板（见第 3 层）
- 「不许派单，需求写进回执」的硬约束

### 第 3 层 · 回执落盘 + 界面展示

新增 `lib/reports.js`（约 200 行）+ `reports.json`：

```js
{
  id: 'rp_xxx',
  runId: 'run_a1b2c3',
  dispatchId: 'dp_xxx',
  role: 'nightwrite-reader-proxy',
  chapter: 42,
  status: 'submitted',
  // 结构化字段（服务端按角色模板解析）
  fields: {
    engagement: 8,
    risk: 'low',
    riskAt: '第 6 段',
    payoff: '爽 / 已兑现',
    confusion: ['他为什么没杀他'],
    hook: '强',
    audience: '核心读者',
    advice: ['第 3 段动机不明', '章末钩子可以再硬一点'],
  },
  // 原文完整保留，界面折叠显示
  raw: '【追读指数】8\n【弃书风险】低\n…',
  // 一致性审校专用
  verdict: 'pass' | 'revise',
  fatal: [{ at: '第 12 段', clash: '…', basis: 'characters/张三' }],
  warn: [{ at: '第 5 段', risk: '…' }],
  createdAt,
}
```

新增 op（4 个）：`report.submit` / `report.list` / `report.get` / `report.parse`

`report.submit` 必须带 `dispatchId`，服务端 `requireTicket` 校验后写盘——**这是「输出可展示」的前提**：有归属、有结构、可查询。

`report.parse` 是纯函数：拿 raw 文本 + role，正则抽出 `【追读指数】8` 这种字段。抽不出来就整段进 `raw`，`fields` 留空，界面退化成原文展示（不报错、不挡流程）。

---

## 四、界面：三处改动

### 1. 驾驶舱加「流水线」卡片（`src/20-cockpit.js`）

位置：`nw-hero` 下方、`nw-action` 上方。有运行中的 run 才显示。

```
┌─ 第 42 回 · 写作链 ──────────── 2/3 ─┐
│ ● 执笔正文            nightwrite-chapter-writer  ✓ 2分18秒
│ ● 写作门禁核对        nightwrite-write-chapter   进行中
│ ○ 去 AI 味            nightwrite-de-ai-style
│                    [看详情] [暂停] [中止]
└──────────────────────────────────────┘
```

- 圆点三态复用现有 `.nw-dot-{level}` 配色思路
- 「看详情」跳新页
- 无障碍：`role="list"` + 每行 `aria-label="阶段 2/3 进行中"`

### 2. 新增第 8 页「流水线」（`src/27-pipeline.js`，约 420 行）

`PAGES` 加 `{ id: 'pipeline', label: '流水线', icon: '🧭' }`（第 8 个，导航变 8 钮，`DOCK_COUNT` 同步改）。

两栏布局：

```
┌ 左：运行列表（窄，240px）  ┬ 右：当前运行详情 ─────────────┐
│ 第 42 回 · 写作链 进行中   │ 【阶段】2/3 写作门禁核对       │
│ 第 41 回 · 审校链 已通过   │ 【门禁】致命 0 · 弃书 低 · 追读 8│
│ 第 40 回 · 读者链 打回     │ ─────────────────────────────│
│                            │ 阶段时间线（竖排，可点）        │
│                            │  ─────────────────────────────│
│                            │ 该阶段的 agent 回执：           │
│                            │  ┌ 读者代言 追读指数 8/10 ──┐  │
│                            │  │ 弃书风险 低 · 第 6 段     │  │
│                            │  │ 情绪回报 爽 / 已兑现      │  │
│                            │  │ 最大困惑：他为什么没杀他  │  │
│                            │  │ 钩子 强                   │  │
│                            │  │ [展开原文]                │  │
│                            │  └──────────────────────────┘  │
└────────────────────────────┴───────────────────────────────┘
```

回执卡片按角色分三种渲染：

| 角色 | 渲染方式 |
|---|---|
| `reader-proxy` | 七栏表格（追读指数用 `Bar`，弃书风险用 `Tag` 染色，其余用 KV） |
| `consistency-checker` | 致命/警告两组列表，每条带段号 + 依据，致命行红色左边框 |
| 其他（架构师/写手/改写） | `KV` 摘要 + `pre` 原文（写手额外显示「引用设定清单」成标签云） |

`fields` 为空时退化成 `pre` 原文 + 一行灰字「未识别结构化字段」。

### 3. 验收台加「AI 意见」抽屉（`src/40-review.js`）

现在是三个 tab（逐章验收 / 提案 / 问题单）。这轮加第四个 tab **`AI 意见`**：
按章列出所有 `report`，点开就是上面同款回执卡。这样「agent 说了什么」在写作现场就能看到，不用切页。

（不做成第五个 page，因为它天然属于「这一章怎么样」这个语境。）

---

## 五、启动流程（用户视角，和 LNW 一样）

```
用户：写第 42 回
        ↓
主对话：nightwrite_run(start, { chapter: 42, chain: 'write' })
        → 界面驾驶舱立刻出现流水线卡（第 0 格 running）
        ↓
主对话：nightwrite_dispatch(role='nightwrite-chapter-writer', stageId='writer', task='写第42回')
        → 拿到 dispatchId + 任务书
        ↓
主对话：subagent 起子 agent，把任务书原样交给它
        ↓
子 agent：读 agents/nightwrite-chapter-writer.md → 读细纲 → 写 → chapter.save
          → nightwrite_report.submit(dispatchId, raw='【正文】…【引用设定清单】…')
        ↓
主对话：nightwrite_run(advance, { stageId: 'writer' })
        → 界面进度走一格，回执出现在「流水线」页
        ↓
… 写手 → 门禁 → 去 AI 味 → 审校 → 读者 …
        ↓
主对话：三道门全过 → nightwrite_run(finish) + review.action(accept)
        任一不过 → nightwrite_run(advance 到 revise 链起点) 打回
```

**用户只需要说一句话**，后面全自动。这和现在「用户得说『先派架构师』『再派写手』『现在查一致性』」是两回事。

---

## 六、RPC op 总账

现在 47 个（读 19 / 写 28）。新增 13 个：

| 类 | op |
|---|---|
| run | `run.start` `run.status` `run.advance` `run.pause` `run.resume` `run.finish` `run.abort` `run.list` `run.get`（9） |
| dispatch | `dispatch.issue`（1） |
| report | `report.submit` `report.list` `report.get`（3） |

变成 **60 个**（读 22 / 写 38）。`readonly` 判定：`run.status/list/get`、`report.list/get` 进 READ，其余进 WRITE。

新增 agent 工具 2 个（`nightwrite_op` 保持单一入口，但给 agent 更明确的两个）：
- `nightwrite_report` —— 子 agent 交回执专用，强制 `dispatchId`
- `nightwrite_run` —— 主对话推进用

---

## 七、工作量与顺序

分四步，每步都能独立验收：

| 步 | 内容 | 文件 | 估量 |
|---|---|---|---|
| **1** | run 状态机 + 9 op | 新建 `lib/run.js`，改 `index.js` | 约 320 行 |
| **2** | 票据 + 回执 | 新建 `lib/dispatch.js` `lib/reports.js`，改 `index.js` | 约 300 行 |
| **3** | 流水线页 + 驾驶舱卡 | 新建 `src/27-pipeline.js`，改 `20-cockpit.js` `10-core.js` `90-shell.js` `85-css.js` | 约 480 行 |
| **4** | 验收台 AI 意见抽屉 + 测试 | 改 `40-review.js`，扩 `test/backend.mjs` `test/smoke.mjs` `test/qa.mjs` | 约 200 行 |

外加：`agents/nightwrite-coordinator.md` 里补一段「用 `nightwrite_run` + `nightwrite_report` 而不是自己记进度」，`README.md` 补流水线章节。

**总估**：新增约 1300 行，改约 400 行。

---

## 八、三个需要你拍板的点

1. **skill 型 stage 要不要派子 agent？**
   我的方案是**不派**——skill 型 stage（如「去 AI 味」「流失点定位」）由主对话读完 SKILL.md 自己做，`run.advance` 时打勾即可。理由是 25 个 skill 全派 agent 会炸上下文。
   如果你要「每个 skill 都真的起一个 agent」，那每章至少 5 个子 agent，成本和延迟翻倍，但产出更专。

2. **run 挂在章上还是挂在书上？**
   我的方案是**一轮 run = 一章**（`chapter` 必填）。连更 3 章 = 3 个 run 串联。
   另一种是 `scope: 'range'`，一个 run 覆盖第 42-44 回，内部按章循环。后者界面更省事，但失败了不好定位是哪一章崩的。

3. **回执的结构化解析要不要上模型？**
   我的方案是**纯正则**（按 `【xxx】` 模板抽），抽不到就退化成原文。
   另一种是让某个 agent 专门做「回执格式化」，准确率高但多一次调用、多一份花钱。

---

## 九、不做什么（和 LNW 的边界）

- **不做自动执行器**。run 不自己调 agent，它只记状态。谁执行？主对话 + `subagent`，和 LNW 一样。
- **不做定时任务**。「每天自动更 2 章」这种不在本轮，它需要宿主层的调度能力，属于内核不在插件。
- **不做多 run 并发**。同一作品同一时间只允许一个 running 的 run，`run.start` 时检查，冲突就报错让人先 finish/abort。
- **不动现有 47 个 op 的语义**。proposals 仍是「给人拍板的改动」，reports 是「agent 说过的判断」，两者不合并。
