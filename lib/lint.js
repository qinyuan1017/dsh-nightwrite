/**
 * 长夜 · 文风校验器
 *
 * 与 lib/store.js 里的 AI_STYLE_LEXICON 的分工：
 *   · store.js 那份是「作者自己维护的词表」，作者能加能停用，用来抓他个人讨厌的词。
 *   · 这份是「出厂硬规则」，改的是结构和笔法，不由作者逐条开关，只分两档：
 *       blocking 硬拦：写出来就是错，不给保存。
 *       advisory 提示：可能没问题，但值得看一眼，标黄不拦。
 *
 * 为什么硬拦要极少：误判一次就挡住一次正常写作。
 * 只有「没有例外」的那几类才进 blocking —— 正文出现「本章」「伏笔」这种元叙述、
 * 「不是…而是…」这种对偶句式、破折号每段都来一个、以及整段电报体短句。
 *
 * 每条规则必须给位置：para（段号，从 0 数）、offset / length（段内字位）、quote。
 * 没有位置的报告等于没说——作者没法据此改。
 */

import { RULE_WHY, WHY_FALLBACK } from './lint-why.js'

/** 分段：保留原段落序号与段内偏移基准。空行不算段。 */
export function splitParas(text) {
  const body = String(text ?? '')
  const list = []
  let cursor = 0
  for (const raw of body.split('\n')) {
    const line = raw
    if (line.trim()) list.push({ para: list.length, text: line, start: cursor })
    cursor += raw.length + 1
  }
  return list
}

/**
 * 规则分组。
 *
 * 为什么要在 id 之外再记一个组：28 条规则平铺在一张表里，界面只能按
 * blocking/advisory 分两堆，作者看到「21 条提示」还是不知道该先看哪。
 * 分组是把「这类问题该怎么想」写进数据结构——
 *   degenerate = 模型跑偏了（这段文字已经不是文），要重跑，不是修句子
 *   meta       = 元信息泄漏（读者会出戏）
 *   craft      = 笔法（可以讨论）
 *   hygiene    = 排版卫生（机械可修）
 * 派单、校验、界面三处都按组走，不必各自维护一份 id 名单。
 */
export const RULE_GROUPS = {
  degenerate: {
    label: '退化检测',
    note: '模型跑偏时最先出现的症状：复读、截断、占位语。命中了就该重跑这一章，不要逐句修。',
  },
  meta: { label: '元信息泄漏', note: '工作台的话漏进了故事里。读者手上只有故事，没有章节号。' },
  craft: { label: '笔法', note: '句式与密度。同一个句式用多了，读起来像同一个人写的所有书。' },
  hygiene: { label: '排版卫生', note: '标点、空格、段落长度。机械可修，不用动故事。' },
}

function groupOf(id) {
  if (String(id).startsWith('degenerate-')) return 'degenerate'
  if (String(id).startsWith('meta-')) return 'meta'
  if (['punctuation-mess', 'whitespace-mess', 'long-paragraph', 'period-stutter'].includes(id))
    return 'hygiene'
  return 'craft'
}

const C = (id, label, severity, review, hint, test, extra = {}) => ({
  id,
  label,
  severity,
  review,
  hint,
  test,
  // why 单独放 lib/lint-why.js：那里只有中文说明，批量改它不会碰坏下面的正则
  why: RULE_WHY[id] ?? WHY_FALLBACK,
  group: groupOf(id),
  ...extra,
})

/** 出厂规则表。顺序即报告里的排列顺序。 */
export const RULES = [
  // ── 硬拦：元叙述泄漏 ─────────────────────────────────────
  C(
    'meta-chapter',
    '元叙述：出现「第X章/本章/前文」',
    'blocking',
    'mechanical',
    '正文里不许说「本章」「前文」「这一章」。读者手上没有章节号，只有故事。',
    /(本章|前文|上回|下回|这一章|上一章|下一章|如前所述|后文会|此处略)/,
  ),
  C(
    'meta-craft',
    '元叙述：出现写作术语',
    'blocking',
    'mechanical',
    '「伏笔」「细纲」「人设」「读者」「剧情」这些是工作台的话，不是故事里的话。',
    /(伏笔|埋线|回收|细纲|大纲|人设|读者|剧情|节奏|爽点|虐点|视角切换|本章完)/,
  ),
  C(
    'meta-notice',
    '正文里出现系统提示体',
    'blocking',
    'mechanical',
    '「【提示】」「（注：」这类是给作者看的，混进正文读者会出戏。',
    /(【[^】]{2,12}】|（注[:：]|\[系统|系统提示[:：])/,
  ),

  // ── 硬拦：句式 ───────────────────────────────────────────
  C(
    'not-is',
    '对偶否定「不是……而是……」',
    'advisory',
    'mechanical',
    'AI 最爱的对称句式。人说话很少先否定再纠正，直接说后半句。',
    /不是[^。！？\n]{1,12}[，,]\s*(?:而)?是[^。！？\n]{1,12}/,
    { perKilo: 1.2, minHits: 3 },
  ),
  C(
    'reverse-not-is',
    '倒装否定「……，不是……」做收尾',
    'blocking',
    'mechanical',
    '句子尾巴上补一刀否定，是给读者解释，不是叙述。',
    /[。！？]\s*[^。！？\n]{0,10}(不是|并非)[^。！？\n]{0,15}[。！？]/,
  ),
  C(
    'em-dash',
    '破折号滥用',
    'blocking',
    'mechanical',
    '一段里两个以上破折号，读起来像喘不上气。',
    null,
    { perPara: 2, counter: /——|--/g },
  ),
  C(
    'negation-parade',
    '连续否定排比',
    'blocking',
    'mechanical',
    '连着三句「没有……没有……没有……」，是修辞不是叙事。',
    null,
    {
      perPara: 3,
      counter:
        /(?:^|[。！？\n])\s*(?:没有|不是|不会|不能|不曾|不|没|无)[^。！？\n]{0,14}(?=[。！？]|$)/g,
    },
  ),
  C(
    'telegram',
    '电报体：整段短句轰炸',
    'blocking',
    'semantic',
    '一句话一段、每句都七八个字，读三行就累。长短要交错。',
    null,
    { perPara: 5, shortChars: 10 },
  ),

  // ── 硬拦：结尾偷懒 ───────────────────────────────────────
  C(
    'trailer-summary',
    '章末总结式收尾',
    'blocking',
    'semantic',
    '「这一切，才刚刚开始」「他不知道的是……」，是把悬念写成旁白。',
    /(这一切[，,]?\s*(才)?刚刚开始|他不知道的是|命运的齿轮|而这[，,]?\s*只是开始|真正的.{0,6}才刚刚)/,
  ),

  // ── 提示：笔法 ───────────────────────────────────────────
  C(
    'period-stutter',
    '句号连打：连续短句同一节奏',
    'advisory',
    'mechanical',
    '连续六句以上都是短句，节奏会僵。',
    null,
    { perPara: 6, shortChars: 12 },
  ),
  C(
    'long-paragraph',
    '长段：单段超过 200 字',
    'advisory',
    'mechanical',
    '手机屏上一段超过六行就没人看。该断。',
    null,
    { longChars: 200 },
  ),
  C(
    'micro-action-tic',
    '微动作冗余（点头/皱眉/叹气）',
    'advisory',
    'mechanical',
    '这些动作写多了像舞台提示。一场里两三次足够。',
    /(点了点头|摇了摇头|皱了皱眉|叹了口气|深吸一口气|抿了抿嘴|捏了捏眉心|揉了揉太阳穴)/,
    { perKilo: 6, minHits: 5 },
  ),
  C(
    'stock-reaction',
    '套式反应（心中一凛/瞳孔一缩）',
    'advisory',
    'mechanical',
    '情绪用生理反应代替，是最省事也最没劲的写法。',
    /(心中一凛|心头一紧|瞳孔(猛)?(地)?一缩|背脊发凉|冷汗直流|如遭雷击|浑身一震|气血翻涌)/,
    { perKilo: 1.5, minHits: 4 },
  ),
  C(
    'action-list',
    '动作清单式罗列',
    'advisory',
    'semantic',
    '「他先……然后……接着……最后……」，读起来像流程说明。',
    null,
    { perPara: 4, counter: /(先|然后|接着|随后|最后|紧接着)[，,]?/g },
  ),
  C(
    'abstract-summary',
    '抽象概括代替具体',
    'advisory',
    'semantic',
    '「一种说不清的感觉」＝作者也不知道是什么。要么写具体，要么删。',
    /(一种说不出的|难以言喻的|莫名的|说不清道不明的|无法形容的|复杂的情绪|难以名状)/,
    { perKilo: 4, minHits: 3 },
  ),
  C(
    'cliche-density',
    '陈词密度高',
    'advisory',
    'mechanical',
    '一句一个熟词，读者的画面感会被磨掉。',
    /(空气仿佛凝固|时间静止|万籁俱寂|鸦雀无声|落针可闻|目光如炬|气势如虹|嘴角勾起|眼底闪过|不由得|不由自主)/,
    { perKilo: 12, minHits: 8 },
  ),
  C(
    'metaphor-density',
    '比喻密度高',
    'advisory',
    'semantic',
    '一段里三个比喻，读者会去找本体，忘了故事。',
    null,
    { perPara: 3, counter: /(?:像|如同|仿佛|好似|宛如)[^。！？，,\n]{2,12}?/g },
  ),
  C(
    'reasoning-chain',
    '因果链外露',
    'advisory',
    'semantic',
    '「因为……所以……」「既然……那么……」，把推理过程写给读者看。',
    /(因为[^。！？\n]{2,20}[，,]\s*所以|既然[^。！？\n]{2,20}[，,]\s*那么|之所以[^。！？\n]{2,20}是因为)/,
  ),
  C(
    'quote-emphasis',
    '引号强调滥用',
    'advisory',
    'mechanical',
    '给普通词加引号当强调，三次以上读者会以为有别的意思。',
    null,
    { perKilo: 10, minHits: 6, counter: /[「『\u201c][^」』\u201d\n]{1,8}[」』\u201d]/g },
  ),
  C(
    'formulaic-parallel',
    '排比堆叠',
    'advisory',
    'semantic',
    '三句以上同结构排比，是演讲稿不是小说。',
    /((?:[^。！？\n]{2,10}[，,]){2,}[^。！？\n]{2,10}[。！？])/,
    { perKilo: 6.6, minHits: 4 },
  ),
  C(
    'overcompressed',
    '过度压缩：半句一顿',
    'advisory',
    'semantic',
    '逗号比句号多一倍，读起来全是碎块。',
    null,
    { commaRatio: 2.2 },
  ),
  C(
    'low-connective',
    '连接词太少，句子各自为政',
    'advisory',
    'semantic',
    '段与段之间没有承接，读起来像摘抄。',
    null,
    {
      minChars: 300,
      maxPerKilo: 8,
      counter: /(于是|因此|然而|可是|但是|所以|于是|接着|随后|不过|只是)/g,
    },
  ),
  C(
    'punctuation-mess',
    '标点异常（半角/重复）',
    'advisory',
    'mechanical',
    '中英标点混用、连续多个感叹号，看着不专业。',
    /([,;:!?][\u4e00-\u9fa5]|[！？]{2,}|\.{3,}|。。。)/,
  ),
  C(
    'whitespace-mess',
    '空格/空行异常',
    'advisory',
    'mechanical',
    '段内有多余空格，或段间出现连续空行。',
    /([\u4e00-\u9fa5]\s{2,}[\u4e00-\u9fa5])/,
    { wholeText: /\n{3,}/ },
  ),

  // ── 退化检测：模型跑偏时最先出现的三种症状 ─────────────
  // 这三类不是「文笔不好」，是「这段文字已经不是文了」。
  // 复读＝卡在同一个句式上原地打转；截断＝生成被砍断在半句；
  // 占位语＝它自己写了个待补标记当交稿。所以全部进 blocking：
  // 出现任何一条，这一章就不该算写完，更不该被验收。
  C(
    'degenerate-placeholder',
    '占位语：正文里留了待补标记',
    'blocking',
    'mechanical',
    '「此处省略」「待补」「TODO」「XXX」是给作者自己看的坑，混进正文就是没写完。',
    /(此处(省略|略去|详述|补)|以下省略|略去\s*\d+\s*字|待补|待定|待写|TODO|TBD|FIXME|[Xx]{3,}|【待|（待[补写填])/,
  ),
  C(
    'degenerate-punct-tail',
    '截断：句子断在标点残缺处',
    'blocking',
    'mechanical',
    '段末停在逗号、顿号、冒号，或者段首是个孤零零的收引号，都说明这句被砍断了。',
    /([，,、：:；;]$|^[」』"）)]|[「『"（(]$)/,
  ),
  C(
    'degenerate-repeat-punct',
    '复读：标点或字词机械重复',
    'blocking',
    'mechanical',
    '「…………」「。。。。」「了了了」这种，是机器卡住的痕迹，不是修辞。',
    /([。！？…，、]{4,}|([\u4e00-\u9fa5])\2{3,})/,
  ),
  C(
    'degenerate-repeat-sent',
    '复读：同一句话反复出现',
    'blocking',
    'semantic',
    '相邻段里出现多个一模一样的句子，说明模型在原地打转，不是在写作。',
    null,
    { repeatSent: true, minChars: 12, times: 2 },
  ),
]

export const RULE_IDS = RULES.map((rule) => rule.id)

/** 给界面用的一览（不含正则，避免被意外序列化）。 */
export function listRules() {
  return RULES.map((rule) => {
    // 阈值一起带出去：界面要显示「现在按 1.6 判、全局 0.9」，
    // 只给 id 和说明的话，前端就得自己抄一份阈值表，那份表一定会过期。
    const threshold = {}
    for (const key of THRESHOLD_KEYS) {
      if (rule[key] !== undefined) threshold[key] = rule[key]
    }
    return {
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      review: rule.review,
      hint: rule.hint,
      why: rule.why,
      group: rule.group,
      threshold,
    }
  })
}

/** 按组统计规则条数，界面分组头直接用它。 */
export function listGroups() {
  const counts = {}
  for (const rule of RULES) {
    const g = rule.group ?? 'craft'
    const row = counts[g] ?? { id: g, rules: 0, blocking: 0, advisory: 0 }
    row.rules += 1
    if (rule.severity === 'blocking') row.blocking += 1
    else row.advisory += 1
    counts[g] = row
  }
  return Object.values(RULE_GROUPS).map((meta) => {
    const id = Object.keys(RULE_GROUPS).find((k) => RULE_GROUPS[k] === meta)
    return { ...meta, ...(counts[id] ?? { id, rules: 0, blocking: 0, advisory: 0 }) }
  })
}

/**
 * 只跑某一组，或只跑退化检测那一组。
 * 单独抽出来是因为「这章是不是模型跑偏了」和「这章文笔好不好」是两个问题，
 * 前者要的是快速判断（重跑还是继续），后者才需要逐条看。
 */
export function checkGroup(text, group, options = {}) {
  const ids = RULES.filter((rule) => (rule.group ?? 'craft') === group).map((rule) => rule.id)
  return checkText(text, { ...options, only: ids })
}

export function checkDegenerate(text, options = {}) {
  return checkGroup(text, 'degenerate', options)
}

/**
 * 白名单：写作里合法要用的词（书名、功法名、专有名词）可以整体屏蔽，
 * 屏蔽掉的部分换成占位符再跑检测，命中位置仍然对得上原文。
 */
export function maskWhitelist(text, words = []) {
  let masked = String(text ?? '')
  const list = (Array.isArray(words) ? words : []).map((w) => String(w ?? '')).filter(Boolean)
  for (const word of list) masked = masked.split(word).join('\u0000'.repeat(word.length))
  return masked
}

function countMatches(text, re) {
  if (!(re instanceof RegExp)) return 0
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const scan = new RegExp(re.source, flags)
  let n = 0
  while (scan.exec(text) !== null) {
    n += 1
    if (n > 999) break
    if (scan.lastIndex === 0) break
  }
  return n
}

function shortsIn(line, limit) {
  // 只数「真正的短句」：去掉引号内容与标点后长度不超过 limit
  return line
    .split(/[。！？…]+/)
    .map((s) => s.replace(/[「」『』""''，,、\s]/g, ''))
    .filter((s) => s.length > 0 && s.length <= limit).length
}

function findQuote(text, index, length) {
  const from = Math.max(0, index - 12)
  return String(text)
    .slice(from, index + length + 12)
    .replace(/\u0000/g, '')
    .trim()
}

/**
 * 按书覆盖阈值。
 *
 * 全局阈值来自 214 章真稿的校准，它是「多数人多数时候」的折中。
 * 每本书自己的密度不一样——历史文承接词天然多，快节奏爽文天然少。
 * 拿通用数字卡具体作品，要么天天误报，要么该报的不报。
 *
 * 只覆盖数值，不覆盖正则和分类：改阈值是调秤，改正则就是改尺子了。
 */
const THRESHOLD_KEYS = [
  'perKilo',
  'minHits',
  'perPara',
  'maxPerKilo',
  'longChars',
  'shortChars',
  'commaRatio',
  'minChars',
]

export function withThreshold(rule, patch) {
  if (!patch || typeof patch !== 'object') return rule
  const next = { ...rule }
  for (const key of THRESHOLD_KEYS) {
    const value = Number(patch[key])
    if (Number.isFinite(value) && value >= 0) next[key] = value
  }
  return next
}

/**
 * 原始计数：不受阈值影响的「这本书里某条规则出现了多少次」。
 *
 * 为什么不复用 checkText：checkText 的返回值是「过线之后报出来的」，
 * 拿它算密度会把「差一点没过线」的规则全算成 0，校准就永远校不准。
 * 这里刻意重复一遍统计逻辑，不动 checkText——477 条测试压在那儿，不值得冒险。
 */
export function measureText(text, options = {}) {
  const raw = String(text ?? '')
  const masked = maskWhitelist(raw, options.whitelist ?? [])
  const paras = splitParas(masked)
  const chars = masked.replace(/\s+/g, '').length
  const rules = {}
  const bump = (id, count, paraCount) => {
    if (!count) return
    const row = rules[id] ?? { count: 0, paras: 0 }
    row.count += count
    row.paras += paraCount ?? 0
    rules[id] = row
  }

  for (const rule of RULES) {
    if (rule.test instanceof RegExp) {
      let total = 0
      let paraCount = 0
      for (const para of paras) {
        const re = new RegExp(
          rule.test.source,
          rule.test.flags.includes('g') ? rule.test.flags : `${rule.test.flags}g`,
        )
        let m = re.exec(para.text)
        let local = 0
        while (m !== null) {
          total += 1
          local += 1
          if (re.lastIndex === 0) break
          m = re.exec(para.text)
        }
        if (local) paraCount += 1
      }
      if (rule.wholeText instanceof RegExp) {
        const whole = rule.wholeText.exec(masked)
        if (whole) {
          total += 1
          paraCount += 1
        }
      }
      bump(rule.id, total, paraCount)
      continue
    }
    // 承接词这类是「越多越健康」：count 记原始个数，判读方向相反
    if (rule.maxPerKilo) {
      bump(rule.id, countMatches(masked, rule.counter), 0)
      continue
    }
    if (rule.counter) {
      let total = 0
      let paraCount = 0
      for (const para of paras) {
        const n = countMatches(para.text, rule.counter)
        total += n
        if (n) paraCount += 1
      }
      bump(rule.id, total, paraCount)
      continue
    }
    if (rule.longChars) {
      const pc = paras.filter((para) => para.text.length >= rule.longChars).length
      bump(rule.id, pc, pc)
      continue
    }
    if (rule.shortChars) {
      const pc = paras.filter((para) => shortsIn(para.text, rule.shortChars) >= 2).length
      bump(rule.id, pc, pc)
      continue
    }
    if (rule.commaRatio) {
      const pc = paras.filter((para) => {
        if (para.text.length <= 60) return false
        const commas = countMatches(para.text, /[，,、]/)
        const periods = Math.max(countMatches(para.text, /[。！？]/), 1)
        return commas / periods >= rule.commaRatio
      }).length
      bump(rule.id, pc, pc)
      continue
    }
    if (rule.repeatSent) {
      const minLen = rule.minChars ?? 12
      const seen = new Map()
      for (const para of paras) {
        for (const sentence of para.text.split(/(?<=[。！？…])/)) {
          const key = sentence.trim().replace(/\s+/g, '')
          if (key.length < minLen) continue
          seen.set(key, (seen.get(key) ?? 0) + 1)
        }
      }
      // 只算「多出来的那些」：出现 3 次算 2 次复读
      let extra = 0
      let parasCount = 0
      for (const n of seen.values()) {
        if (n > 1) {
          extra += n - 1
          parasCount += n
        }
      }
      bump(rule.id, extra, parasCount)
    }
  }

  return { chars, rules }
}

/**
 * 主入口：扫一遍正文。
 * @param {string} text 正文纯文本
 * @param {{whitelist?: string[], only?: string[], skip?: string[]}} options
 * @returns {{hits: object[], blocking: number, advisory: number, total: number, chars: number}}
 */
export function checkText(text, options = {}) {
  const raw = String(text ?? '')
  const masked = maskWhitelist(raw, options.whitelist ?? [])
  const paras = splitParas(masked)
  const chars = masked.replace(/\s+/g, '').length
  const kilo = Math.max(chars / 1000, 0.1)
  const only = Array.isArray(options.only) && options.only.length ? new Set(options.only) : null
  const skip = new Set(Array.isArray(options.skip) ? options.skip : [])
  const hits = []

  const push = (rule, para, index, length, quote) => {
    hits.push({
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      // group 是这轮加的分组（degenerate / meta / craft / hygiene）。
      // 界面上「退化」要单独一档：命中它说明这段不是文，该重跑，不是改句子。
      group: rule.group ?? 'craft',
      review: rule.review,
      hint: rule.hint,
      why: rule.why,
      para,
      offset: index,
      length,
      quote: quote ?? findQuote(paras[para]?.text ?? '', index, length),
    })
  }

  for (const base of RULES) {
    const rule = withThreshold(base, options.thresholds?.[base.id])
    if (skip.has(rule.id)) continue
    if (only && !only.has(rule.id)) continue

    // 1. 段级命中：正则直接扫每段，逐段给位置
    if (rule.test instanceof RegExp) {
      let paraHits = 0
      let total = 0
      for (const para of paras) {
        const re = new RegExp(
          rule.test.source,
          rule.test.flags.includes('g') ? rule.test.flags : `${rule.test.flags}g`,
        )
        let m = re.exec(para.text)
        while (m !== null) {
          total += 1
          paraHits += 1
          // 段级阈值规则（如套式反应）攒够 minHits 再一起报，避免零星噪音
          if (!rule.minHits) push(rule, para.para, m.index, String(m[0]).length)
          if (re.lastIndex === 0) break
          m = re.exec(para.text)
        }
      }
      if (rule.wholeText instanceof RegExp) {
        const whole = rule.wholeText.exec(masked)
        if (whole)
          push(rule, 0, whole.index, whole[0].length, '连续 ' + whole[0].length + ' 个换行')
      }
      if (rule.minHits && total >= rule.minHits) {
        const perKilo = rule.perKilo ? total / kilo : Infinity
        if (!rule.perKilo || perKilo >= rule.perKilo) {
          for (const para of paras) {
            const re = new RegExp(
              rule.test.source,
              rule.test.flags.includes('g') ? rule.test.flags : `${rule.test.flags}g`,
            )
            let m = re.exec(para.text)
            while (m !== null) {
              push(rule, para.para, m.index, String(m[0]).length)
              if (re.lastIndex === 0) break
              m = re.exec(para.text)
            }
          }
        }
      }
      continue
    }

    // 1.5 全文密度上限（连接词太少这类）：必须排在段级计数前面，
    //     否则带 counter 的规则会被下面的分支截胡，永远走不到这一步。
    if (rule.maxPerKilo && !rule.perPara) {
      if (chars >= (rule.minChars ?? 0)) {
        const n = countMatches(masked, rule.counter)
        if (n / kilo < rule.maxPerKilo) {
          hits.push({
            id: rule.id,
            label: rule.label,
            severity: rule.severity,
            review: rule.review,
            hint: rule.hint,
            para: -1,
            offset: 0,
            length: 0,
            quote: '全文 ' + chars + ' 字里只有 ' + n + ' 个承接词',
          })
        }
      }
      continue
    }

    // 2. 段级计数规则：一段里超过阈值就报这一整段
    if (rule.counter) {
      let total = 0
      for (const para of paras) {
        const n = countMatches(para.text, rule.counter)
        total += n
        if (rule.perPara && n >= rule.perPara) {
          push(rule, para.para, 0, Math.min(24, para.text.length), para.text.slice(0, 40))
        }
      }
      if (rule.minHits && total >= rule.minHits) {
        if (!rule.perKilo || total / kilo >= rule.perKilo) {
          if (!rule.perPara) {
            for (const para of paras) {
              if (countMatches(para.text, rule.counter) > 0) {
                push(rule, para.para, 0, Math.min(24, para.text.length), para.text.slice(0, 40))
              }
            }
          }
        }
      }
      continue
    }

    // 3. 段长规则
    if (rule.longChars) {
      for (const para of paras) {
        if (para.text.length >= rule.longChars)
          push(rule, para.para, 0, rule.longChars, para.text.slice(0, 40))
      }
      continue
    }

    // 4. 短句节奏规则（电报体 / 句号连打）
    if (rule.shortChars) {
      for (const para of paras) {
        const n = shortsIn(para.text, rule.shortChars)
        if (n >= rule.perPara)
          push(rule, para.para, 0, Math.min(24, para.text.length), para.text.slice(0, 40))
      }
      continue
    }

    // 5. 逗号/句号比例
    if (rule.commaRatio) {
      for (const para of paras) {
        const commas = countMatches(para.text, /[，,、]/)
        const periods = Math.max(countMatches(para.text, /[。！？]/), 1)
        if (para.text.length > 60 && commas / periods >= rule.commaRatio) {
          push(rule, para.para, 0, Math.min(24, para.text.length), para.text.slice(0, 40))
        }
      }
      continue
    }

    // 6. 连接词过少（按全文算）
    if (rule.maxPerKilo) {
      if (chars >= (rule.minChars ?? 0)) {
        const n = countMatches(masked, rule.counter)
        if (n / kilo < rule.maxPerKilo) {
          hits.push({
            id: rule.id,
            label: rule.label,
            severity: rule.severity,
            review: rule.review,
            hint: rule.hint,
            para: -1,
            offset: 0,
            length: 0,
            quote: `全文 ${chars} 字里只有 ${n} 个承接词`,
          })
        }
      }
      continue
    }

    // 7. 跨段复读：同一句话出现多次
    //    不能按段扫，必须跨段比——复读的症状正是「这一段和上一段一样」。
    //    只认长度够的句子（minChars），否则「他说。」这种正常重复会天天误报。
    if (rule.repeatSent) {
      const minLen = rule.minChars ?? 12
      const times = rule.times ?? 2
      const seen = new Map()
      const order = []
      for (const para of paras) {
        const sentences = para.text
          .split(/(?<=[。！？…])/)
          .map((s) => s.trim())
          .filter((s) => s.replace(/\s+/g, '').length >= minLen)
        for (const sentence of sentences) {
          const key = sentence.replace(/\s+/g, '')
          const hit = seen.get(key)
          if (hit) {
            hit.count += 1
            hit.paras.push(para.para)
          } else {
            const row = { count: 1, paras: [para.para], text: sentence }
            seen.set(key, row)
            order.push(key)
          }
        }
      }
      for (const key of order) {
        const row = seen.get(key)
        if (row.count < times) continue
        for (const paraNum of row.paras) {
          hits.push({
            id: rule.id,
            label: rule.label,
            severity: rule.severity,
            review: rule.review,
            hint: rule.hint,
            para: paraNum,
            offset: 0,
            length: Math.min(30, row.text.length),
            quote: `${row.text.slice(0, 40)}（第 ${row.paras.map((n) => n + 1).join('、')} 段重复）`,
          })
        }
      }
      continue
    }
  }

  hits.sort((a, b) => a.para - b.para || a.offset - b.offset || a.id.localeCompare(b.id))
  const blocking = hits.filter((h) => h.severity === 'blocking').length
  return { hits, blocking, advisory: hits.length - blocking, total: hits.length, chars }
}

/** 只跑硬拦：给 chapter.save 用，返回 blocking 命中数组。 */
export function checkBlocking(text, options = {}) {
  return checkText(text, {
    ...options,
    only: RULES.filter((r) => r.severity === 'blocking').map((r) => r.id),
  }).hits
}

/** 把命中按规则聚合成「哪类问题最多」，给界面画柱状图。 */
export function summarize(hits = []) {
  const map = new Map()
  for (const hit of hits) {
    const row = map.get(hit.id) ?? {
      id: hit.id,
      label: hit.label,
      severity: hit.severity,
      count: 0,
    }
    row.count += 1
    map.set(hit.id, row)
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}
