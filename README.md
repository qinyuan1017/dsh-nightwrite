# 长夜 · dsh-changye

AI 主写、人类当导演的 DSH 小说工作台插件。

- 侧栏「插件」排里一个 🌙 图标，点开进中心列（`main` 槽位，`key='changye'`）
- 数据落在 `~/.dsh/data/dsh-changye`（可用环境变量 `CHANGYE_ROOT` 覆盖）
- 全部读写走同源 RPC：`POST /changye/api`，body `{ op, payload }`
- 同时注册一个工具 `changye_op`，让 agent 直接读写同一份数据

## 八个页面

| 页 | key | 干什么 |
| --- | --- | --- |
| 🌙 驾驶舱 | `cockpit` | 待验收 / 队列 / 欠账 / 今日字数，欠账可点击跳转 |
| 📐 大纲 | `plan` | 老板的方案 → 卷章骨架 → 一键把「第几回 + 意图」送进生产台 |
| 🧵 流水线 | `pipeline` | 派单台：11 个岗位、开票、发到对话、收回执 |
| 🎬 生产台 | `studio` | 上下文装配审计、指令单、批量开写 |
| 📋 验收台 | `review` | 三个抽屉：逐章拍板 / 提案（before-after 采纳）/ 问题单 |
| 🗂 世界库 | `world` | 8 栏账本：人物/地点/伏笔/事件/术语/规则/高光/冲突 |
| 🔍 侦察 | `scout` | 拆文 / 扫榜 / 资料研究 / 封面 |
| ⚙️ 设置 | `settings` | 作品参数、质量门、预算、数据位置 |

## 工作流（四段，各有一页）

```
驾驶舱（今天该干什么）
  → 大纲（一句话方案 → 卷章骨架 → 摘要/钩子 AI 回填 → 送去生产台）
    → 生产台（上下文包 + 指令单 + 队列）
      → 验收台（逐章拍板 / 采纳提案 / 关问题单）
```

三个快动作 `✍️ 续写一章` `⚡ 连更 3 章` `🩺 体检` 在**顶栏右侧**，和队列状态、暂停放在一起。
底栏只有居中的八页导航。

## 目录

```
index.js          服务端：112 个 RPC op、webServer 路由、tapIndex 注入 boot、changye_op / changye_dispatch
lib/store.js      数据层：library.json / chapters/0001.txt / ledger.json / templates.json /
                  queue.json / outline.json / proposals.json / problems.json
lib/client.js     客户端 bundle（由 build.mjs 从 src/ 拼出，勿手改）
src/10-core.js    常量 / api() / 基础控件
src/20-cockpit.js 驾驶舱
src/25-plan.js    大纲（方案卡 + 卷章骨架）
src/30-studio.js  生产台（含 buildContext 上下文装配）
src/40-review.js  验收台（逐章列表 + ReviewDetail 深水区 + 五抽屉）
src/45-triage.js  提案抽屉 / 问题单抽屉
src/47-opinions.js 冷读 / 意见池
src/50-world.js   世界库
src/52-worldmap.js 世界地图（第四视图，拖坐标 + 连线）
src/60-scout.js   侦察
src/70-settings.js 设置（含成书导出 / 检查更新 / 语料池）
src/74-book.js    成书导出（TXT/MD/EPUB/DOCX）+ 检查更新
src/85-css.js     全部样式（CHANGYE_CSS）
src/90-shell.js   顶栏 / 底栏 / 导航 / Root / apply
build.mjs         拼接 src/*.js → lib/client.js，并补 factory 的 return
test/smoke.mjs    迷你 React 渲染器冒烟（323 项）
test/backend.mjs  真实后端端到端（554 项）
test/check24.mjs  24 条界面增补的落点核对（38 处标记，覆盖 24/24）
test/wordcount-parity.mjs 客户端 countChars 与服务端 countWords 逐例比对（11 项）
test/skills-check.mjs 25 份 SKILL.md 的结构校验（377 项）
agents/           11 个岗位 Markdown（coordinator 独占 subagent 派单权）
skills/           25 份 SKILL.md，每个技能一个目录
changye-skills-all.md  25 份 SKILL.md 的合并本（便于整份复制/通读）
```

## 开发

```bash
node build.mjs                                      # 重建 lib/client.js
node --check index.js lib/store.js src/*.js         # 语法
node test/backend.mjs                               # 554 项
node test/smoke.mjs                                 # 323 项
node test/check24.mjs                               # 24 条落点
node test/wordcount-parity.mjs                      # 字数口径一致
```

改完源码后要同步到已装副本（`file:` 依赖不跟随源码热更新）：

```bash
INST=~/.dsh/profiles/desktop/node_modules/dsh-changye
node build.mjs && cp index.js package.json cordis.patch.yml build.mjs "$INST/" && cp lib/*.js "$INST/lib/"
```

## RPC op（112：读 53 / 写 59）

读 53：
`ping` `project.list` `project.get` `overview` `chapter.list` `chapter.get`
`chapter.history` `chapter.version` `chapter.trash` `chapter.aistyle`
`aistyle.get` `ledger.get` `templates.list` `queue.list` `outline.get`
`outline.intent` `proposal.list` `proposal.preview` `problem.list` `search`
`role.list` `dispatch.list` `dispatch.get` `report.list` `lint.rules`
`lint.check` `lint.degenerate` `text.normalize` `outline.copy`
`wordcount.check` `lint.calibration` `feedback.get` `corpus.list`
`corpus.thresholds` `analyze.list` `analyze.get` `import.preview`
`import.dir` `scan.list` `scan.get` `outline.slice` `taskpack.list`
`taskpack.get` `ledger.audit` `state.get` `run.list` `run.get`
`run.current` `map.get` `update.check` `coldread.list` `opinion.list`
`briefing.get`

写 59：
`project.create` `project.save` `project.delete` `chapter.save`
`chapter.delete` `chapter.restore` `chapter.recover` `chapter.purge`
`chapter.move` `chapter.insert` `aistyle.save` `lint.calibrate`
`lint.calibrate.save` `feedback.learn` `corpus.add` `corpus.remove`
`corpus.apply` `ledger.upsert` `ledger.remove` `ledger.save`
`template.save` `template.remove` `queue.add` `queue.update` `queue.remove`
`review.action` `outline.save` `outline.generate` `map.sync` `map.save`
`map.explain` `coldread.prepare` `opinion.save` `opinion.bulk`
`opinion.decide` `opinion.remove` `opinion.collect` `coldread.submit`
`proposal.save` `proposal.decide` `proposal.remove` `problem.save`
`problem.resolve` `problem.remove` `dispatch.issue` `dispatch.send`
`dispatch.revoke` `dispatch.sweep` `report.submit` `analyze.start`
`analyze.remove` `import.run` `scan.save` `scan.fetch` `taskpack.build`
`run.open` `run.claim` `run.review` `run.close`

### 三条「丢了就真没了」的护栏

- **覆盖正文前留底**：`chapter.save` 写盘前把旧正文存到 `chapters/history/0001-<stamp>.txt`，
  每章留最近 20 版。`chapter.history` 列版本，`chapter.restore` 回滚；回滚本身也留底，滚错了能滚回来。
- **删章不进黑洞**：`chapter.delete` 是移到 `chapters/.trash/<stamp>/`，`chapter.trash` 看得见、
  `chapter.recover` 能还原（原位置已有同名文件时报冲突，不覆盖）、`chapter.purge` 才真删。
- **采纳前先点数**：`proposal.preview` 数出每条 `before` 在正文里出现几次。>1 就是「会改错位置」，
  验收台在采纳按钮上方标黄告警。

### 提案为什么不能悄悄改稿

`proposal.save` 存的是 before/after 文本对，`before` 必须是正文里的**逐字原文**。
`proposal.decide` 采纳时逐条在正文里找 `before`：全部命中才整份写回，
有一条对不上就整体拒掉、正文一字不动。AI 自己改不动已采纳的稿子，必须过人的拍板。

## 派活给 agent（流水线页）

长夜不自己写正文，它派单。11 个岗位写在 `agents/*.md`，登记在 `lib/roles.js`。

1. 流水线页选岗位、写任务、挂材料 → `dispatch.issue` 开票（落盘 `dispatches.json`，60 分钟有效）
2. `dispatch.send` 把任务书投进对话（走宿主 `sessionController.prompt`），票记下 sessionId
3. agent 干完用 `report.submit` 交回执，按 `### 结论 / 依据 / 要别人做的事 / 风险` 切段
4. 只有 `changye-coordinator` 的 tools 里有 `subagent` —— 派单权集中在总编一个人手里

`changye_dispatch` 工具让主对话里的 agent 自己开票：`send:false` 只开票不投递，方便先看任务书长什么样。

## 文风校验（28 条规则）

`lib/lint.js` 分两档：**硬拦 12 条**（不改不让存）+ **提示 16 条**（标黄不拦）。每条还带一句 `why`——为什么这算毛病，让作者不靠猜。

- `chapter.save` 默认跑硬拦，命中抛 `style-blocking` 并带上每条的位置；`force:true` 或 `lint:false` 可越过
- 验收台右侧「文风校验」面板跑全量 28 条，点一条能跳到正文那一段，展开看 `why` 与改法
- 规则是**程序**不是文字：每条带 `severity` / `review` / 阈值，能算就不会漏
- 白名单 `aistyle.save` 里填的例句会被 `maskWhitelist` 换成等长占位再检 —— 豁免不影响位置对账

## 拆书 / 导入 / 扫榜（侦察页）

三件「能算的当场算，算不了的才去麻烦 agent」的活。

- **拆书台** `lib/analyze.js`：粘整本书 → 切章 → 每章算字数 / 对话比 / 章末钩子类型 / 剧情点，
  前 3 章单列「黄金三章」。落盘 `analyses/`，「凭什么让人追」那层留给 agent。
- **导入** `lib/import.js`：`第N章 / 楔子 / 序章 / Chapter N` 都认，「作者的话」「本章说」会被剔出来。
  先 `import.preview` 看一眼不写盘，再 `import.run` 真导（append 接在后面 / replace 旧的进回收站）。
- **扫榜台** `lib/scan.js`：粘榜单文本 → 解析成表格（名次 / 书名 / 题材 / 收藏 / 趋势），
  题材分布与涨跌单列。`scan.fetch` 是尽力而为的自动抓取，抓不到就明说抓不到，不假装成功。

## 五阶段：让阈值有依据，而不是拍脑袋

检测器最大的问题不是规则少，是**阈值从哪来**。这五件是补这个洞的。

### 阶段 A · 每条规则都有判据（`lib/lint-why.js`）

28 条规则各配一句 `why`——「为什么这算毛病」，指到读者身上发生了什么，不写「AI 味重」这种空话。
验收台展开一条命中就能看见。写在独立文件里，不塞进 `RULES` 的第 7 个参数：RULES 每条挂着正则字面量，
批量改写最容易动坏反斜杠，而这张表只含中文，改它不可能碰坏检测逻辑。

### 阶段 C · 每本书一套阈值（`lint-calibration.json`）

「每千字超过 6 次算吵」这个 6 对你这本书可能太松、对另一本太严。
`lint.calibrate.measure` 拿这本书已写的正文量一遍，写出属于它的阈值；
`lint.check` 自动读这份覆盖，返回 `calibrated: true`。想回全局就 `thresholds: null` 清空。

### 阶段 D · 把采纳/驳回当标注（`lib/feedback.js`）

你每天在验收台采纳、驳回几十次——那是标注，以前全丢了。
`feedback.learn` 扫已决提案与已决问题，按规则聚合，给**倾向**而不是命令：

- 同一类改法你驳了 4 次 → 「这条可能判得太勤」
- 带某个毛病的提案你反而采纳 → 「这种写法你其实能接受，硬拦它等于每章跟你吵」
- 某类问题 10 条里只修 1 条 → 「这类对你不重要，界面可以少提示」

**它不改规则档位。** 分类是产品判断，不该由统计脚本替作者决定——一条规则被驳三次，
可能是规则错，也可能是那三条提案恰好写得烂。

### 阶段 B · 自己的语料池（`lib/corpus.js`）

阈值要继续有依据，得量真人的稿子。三条来源全是干净的：自己写的正文（最值钱）、公版书、已授权作品。

- 一本书只按内容哈希收一次，换路径加进来不会算两本
- 只存切章后的正文与统计数字，**不存拆书结论**——结论会过时，正文不会
- 收够 3 本才给分位数，不够就明说「别拿它当真」
- `corpus.thresholds` 对每条规则取各书 hits/千字的 p50 与 p90，建议阈值 = p90 × 1.2
- `corpus.apply` 把量出来的阈值直接写进这本书的校准文件

数量关系是能算的：公开拆书语料 5584 章 ÷ 一本 214 章 ≈ **26 本**。到那个量级统计上就持平了。

### 阶段 E · 自己的方法论（`docs/writing-craft.md`）

不是抄别人的 449K 文档，是拿自己的语料量出数字再写。第一版已产出，样本 1 本 214 章 / 46.2 万字。
最扎人的一条发现：**这本书段长 p99 只有 50 字，而 `long-paragraph` 阈值是 200 字——全书一次都不会触发。**
阈值不是写错了，是没有数据支撑。这就是前四个阶段存在的理由。

复现：`node test/_doccraft.mjs`。语料加了书就重跑，更新文档第一节那张表。

## 从 oh-story 借的五件检查（都只报告不改稿）

这五件解决的是同一个问题：**该让人判断的地方，之前是拍脑袋定的。**

| 加的东西 | 落在哪 | 解决的问题 | 代码 |
| --- | --- | --- | --- |
| 标点归一 | 验收台 · 章级体检 | 省略号用「……」还是「...」、破折号是一根还是两根——一本书里混着用，读者会觉得没校对过 | `lib/textnorm.js`（默认只给 preview，`apply:true` 才返回改后文） |
| 退化单独成组 | 校验面板第四档 + 章级体检 | 复读、截断、占位语跟「文笔不好」不是一类事：前者该整章重跑，后者才该逐句改。混在一起会让人去修一段根本不是文的东西 | `lib/lint.js` 的 `RULE_GROUPS` 四组 |
| 细纲照搬检测 | 验收台 · 章级体检 | 「按细纲写」和「把细纲的句子搬进正文」中间只差一步，肉眼看不出来。连续重合超过阈值就报 | `lib/outlinecopy.js`（`COPY_MIN_CHARS=15`，最长公共子串） |
| 字数口径单点 | 验收页实时字数 + 章节清单 + 任务包统计 | 三处各写一遍 `replace(/\s+/g,'')` 看着一样，一旦有人加了「去掉标题行」就变成三个数 | `lib/wordcount.js`（`visible_chars_v1`）+ 客户端 `countChars` 同口径，`test/wordcount-parity.mjs` 逐例比对 |
| 任务包 | 流水线页 · 任务包卡 | 派单时到底给了子 agent 什么材料，作者看不见。回执说「我读了第 3 份」时无法核对 | `lib/taskpack.js`（按 sha1 落盘，界面能打开同一个包） |

两条刻意的边界：

1. **标点不自动改。** `text.normalize` 默认只返回 `preview` 和 `changes`，不带 `text`。调用方忘了传 `apply` 却直接存 `text`，就等于静默改稿——那是最不该由一次笔误决定的事。
2. **退化不并进硬伤。** 服务端 `checkBlocking` 只拦 blocking 一档，退化命中的确实也是 blocking，但它排在界面第一档：先回答「这段还是不是文」，再谈「句子写得好不好」。顺序反了的话，模型跑偏的稿子会先收到 28 条文笔建议，白费。

## 从 LNW 借的六件东西（长夜原来没有的）

这六件都是「书快写完时才需要」的功能。长夜原本专注生产线（写→审→改），缺成书与外部视角那一段。

| 加的东西 | 落在哪 | 干什么 | 服务端 |
| --- | --- | --- | --- |
| 导出成书 | 设置 · 成书导出 | TXT / Markdown / EPUB / Word 四种，可跳过未验收的章 | `lib/ebook.js`（自带 zip 打包，零依赖） |
| 世界地图 | 世界库 · 第四视图 | 地点按坐标摆开、拖一下存位置、连线写「官道三百里」这类关系 | `lib/worldmap.js` |
| 检查更新 | 设置 · 版本卡 | 查 npm 上有没有新版，说清落后几个版本 | `lib/update.js`（15s 超时，失败不阻住界面） |
| 冷读 | 验收台 · 冷读抽屉 | 把稿子汇成一份 txt，交给一个没读过设定的人一次读完，只回答「想不想继续看」 | `lib/coldread.js` |
| 意见池 | 验收台 · 意见池抽屉 | 冷读 / 机器检测 / 审校 / 自己记的，四路意见汇到一张表上，逐条决定采纳或不改 | `lib/opinions.js` |
| 对齐简报 | 驾驶舱 · 右下卡 | 一段纯文本：写到哪、谁在场、欠什么、下一步该写哪一回。粘到对话开头给 agent 看 | `lib/briefing.js` |

两条刻意的取舍：

1. **意见池不自动改稿。** 它记的是别人的话，改不改是作者的事。做成「一键采纳并重写」会让人分不清「AI 的意见」和「已经改好了」——一旦混起来，作者就没法再信任自己看到的正文。
2. **地图不是第四种「看法」。** 只有「地点」这一类有坐标可言，人物和伏笔没有。所以它挂在世界库的视图切换里，但只在地点类目下出现。

## 安全边界

- 所有落盘路径都先过 `projectDir()` 的越界检查，拒绝 `..` 与绝对路径注入
- 请求体上限 8MB，超限先 `drain` 再回 413（否则客户端拿到 ECONNRESET 而非错误码）
- 非 JSON content-type → 415；坏 JSON → 400；未知 op → 400 并列出可用 op
- boot 注入做 `< > & U+2028 U+2029` 转义，插件字符串无法逃出 script 元素
