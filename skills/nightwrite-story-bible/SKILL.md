---
name: nightwrite-story-bible
description: |
  当要建账本、要补账本、或者发现账本本身就写错了时，用这份手册。
  触发词：设定账本、Story Bible、建卡、账本更新、登记设定、把这条记进去、账本对不上、改账本。
  拿账本去比对正文冲突，不要用这个——用 nightwrite-continuity-pass。
  要写世界规则白皮书，用 nightwrite-worldbuilding-bible。
---

## 参考层

需要展开时按需读，不要一次全读：

- `references/entry-fields-8kinds.md` —— 账本八类条目各写什么：每个字段的合格写法、样例、最常见的写废方式
- `references/entry-relations.md` —— 条目之间的引用关系：八类的引用图、五个必须落地的箭头、引用密度与三类断链
- `references/conflict-arbitration.md` —— 账本冲突的仲裁顺序：六级优先级、七种仲裁场景、仲裁后的连锁检查

# 设定账本

维护 `ledger.json` 的八类档案。这份手册管**怎么记账**，不管**拿账去判什么**。

## 账本八类与必填字段

| kind | 中文 | 必填字段 | 一句话判据 |
|---|---|---|---|
| `characters` | 人物 | `name`、`identity`、`goal`、`hiddenDesire`、`threshold`、`voice`、`arc`、`state` | 没有隐性欲望的卡不算卡 |
| `locations` | 地理 | `name`、`position`、`controller`、`relation`、`era` | 关系必须有方向（谁怕谁） |
| `foreshadow` | 伏笔 | `name`、`plantedAt`、`payoffAt`、`status` | 有埋没回收章的伏笔不许入账 |
| `events` | 事件 | `name`、`at`、`who`、`change` | 必须写「改变了什么」 |
| `terms` | 专名 | `name`、`category`、`definition`、`firstAt` | 一个东西只许一种写法 |
| `rules` | 规则 | `name`、`allow`、`forbid`、`cost` | 三样缺一不许入账 |
| `highlights` | 高光 | `name`、`at`、`what` | 可复用的爽点/名场面 |
| `conflicts` | 冲突登记 | `name`、`between`、`stake` | 双方各要什么、赌注是什么 |

## 执行步骤

**第 1 步：先读后写**

`nightwrite_op` → `ledger.get`，把该类现有条目全读一遍。**同一个东西已有条目就更新，不许新建第二条。** 判定「同一个」的标准：`terms` 看名称，`characters` 看 `name`，其余的看 `name` + `at`。

**第 2 步：确认字段齐全**

照上表逐字段填。填不出来的字段**不许留空、不许写「待定」**——填不出来就说明这个条目还没想清，不入账。

**第 3 步：写方向与代价（两类最容易写废的）**

- `rules` 的 `cost`：违反这条规则会**失去什么**。「会遭反噬」不算代价，「强行突破会失去一段记忆」才算。
- `locations` 的 `relation`：必须带方向。写「A 与 B 有仇」不算，写「A 怕 B，因为 B 手里有 A 的把柄」才算。

**第 4 步：落盘**

`nightwrite_op` → `ledger.upsert`，`kind` + `row`。`id` 一旦定了不许改，同一角色/条目永远同一个 `id`。

**第 5 步：记版本**

更新已有条目时，`updatedAt` 由服务端写；你要在回执里写清「改了什么、为什么改、影响哪几回」。

## 输入

- `ledger.get`：该类现有全量
- `chapter.list`：已写到第几回（决定 `firstAt` / `at` 的取值是否合法）
- `outline.get`：卷结构（决定伏笔的 `payoffAt` 是否落在合理范围）

## 输出格式

```
【操作】<新建 / 更新> · kind=<…> · id=<…>
【内容】
  <字段名>：<值>
  <字段名>：<值>
【本次改动理由】<为什么现在需要这条>
【影响回目】第 <n> 回 …（更新时必填；新建时写「无」）
【账本冲突检查】<与该类其他条目有无重复/矛盾；无则写「无」>
【落盘】ledger.upsert 成功 · 该类共 <n> 条
```

## 检查清单

- [ ] 先 `ledger.get` 读过了，确认不是已有条目的重复
- [ ] 上表列出的必填字段全部有值，没有空、没有「待定」
- [ ] `id` 与既有条目一致（更新场景）
- [ ] `rules` 写了 `cost`，`locations` 写了带方向的 `relation`
- [ ] `foreshadow` 的 `plantedAt` / `payoffAt` 都是具体章号，不是「后面某章」
- [ ] `firstAt` / `at` 不超过已写进度
- [ ] `ledger.upsert` 已执行
- [ ] 回执里写清了影响哪几回

## 禁止事项

- 不许写正文。账本里不出现对白、描写、修辞。
- 不许做审美评价（「这个设定很带感」）。
- 不许留「待定」「以后再想」「视情况而定」的字段值。含糊的账本等于没有账本。
- 不许建第二条重复条目（同一角色两个 `id` 是最常见的账本崩法）。
- 不许在正文写完很久之后才补账本来「圆」已经写出来的东西；补账必须声明是修正基准还是新增设定。
- 不许改 `id`。
