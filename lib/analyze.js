/**
 * 长夜 · 拆书管道（第 2 批）
 *
 * 为什么要做这件事：写手判断「这本书凭什么让人追」，靠的从来不是读后感，
 * 是逐章的可比数据 —— 这章钩子是什么类型、情绪值多高、抛了几个事实、几个剧情点。
 * 一本不够，要五本才能看出规律。所以第一步不是「分析得好不好」，
 * 而是「能不能把一千章变成一张能排序的表」。
 *
 * 这里刻意不调模型：规则能算的（字数、对话比、钩子类型、情绪密度、专名、数字）
 * 先算出来，模型只负责最后那层「凭什么让人追」的总结。
 * 反过来做（先让模型读一千章再让它统计）既慢又不可复现。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { projectDir, countWords, StoreError } from './store.js'
import { serializeBy } from './lock.js'

const fail = (message, code = 'invalid') => { throw new StoreError(message, code) }

// 章节标题：第一章 / 第 12 回 / 楔子 / 序 / 番外 / Chapter 3
const CHAPTER_RE = /^\s*(?:第\s*([0-9零一二三四五六七八九十百千两]{1,8})\s*[章回节話话]|([楔序])子?|序章|引子|尾声|番外(?:篇)?(?:\s*[0-9一二三四五六七八九十]*)?|Chapter\s*([0-9]{1,4}))[\s:：.、,，\-—]*(.{0,48})$/

// 这些「标题」是站内插播，不是正文
const NOISE_RE = /^(?:作者的话|作者有话说|本章说|上架感言|请假条|求(?:月|推荐|收藏|订阅)票?|打赏|公告|通知|更新时间?|PS[:：]?|ps[:：]?|（?完）?$)/

const CN_NUM = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

/** 「一百二十三」→ 123；认不出返回 0。 */
function cnToInt(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return 0
  if (/^\d+$/.test(text)) return Number(text)
  let total = 0
  let section = 0
  let digit = 0
  for (const ch of text) {
    if (ch in CN_NUM) {
      digit = CN_NUM[ch]
    } else if (ch === '十') {
      section += (digit || 1) * 10
      digit = 0
    } else if (ch === '百') {
      section += (digit || 1) * 100
      digit = 0
    } else if (ch === '千') {
      section += (digit || 1) * 1000
      digit = 0
    } else if (ch === '万') {
      total += (section + digit) * 10000
      section = 0
      digit = 0
    } else {
      return 0
    }
  }
  return total + section + digit
}

/**
 * 切章。返回 [{num, title, body, noise}]。
 * noise=true 的是「作者的话」这类插播，单独列出来让人确认，不混进正文。
 */
export function splitBook(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let cur = null
  for (const line of lines) {
    const hit = CHAPTER_RE.exec(line)
    const isNoise = NOISE_RE.test(line.trim())
    if (isNoise) {
      // 「作者的话」既可能是独立一节，也可能是章标题后面的括注，两种都当插播
      out.push({ num: 0, title: line.trim(), body: '', noise: true })
      cur = null
      continue
    }
    if (hit) {
      const num = cnToInt(hit[1]) || cnToInt(hit[3]) || 0
      cur = {
        num,
        title: (hit[4] || '').trim(),
        body: '',
        noise: false,
        raw: line.trim(),
      }
      out.push(cur)
      continue
    }
    if (cur) cur.body += `${line}\n`
  }
  // 章号缺失的按出现顺序补：站里导出的稿经常只有标题没有号
  let seq = 0
  for (const row of out) {
    if (row.noise) continue
    seq += 1
    if (!row.num) row.num = seq
  }
  return out
}

const HOOK_RULES = [
  { id: 'question', label: '疑问', test: /[？?]\s*$|谁|为何|难道|怎么可能|凭什么|是什么/ },
  // 揭示排在威胁前面：「原来那个人没死，真相竟是这样」里既有「死」也有「原来」，
  // 读者感受到的是被翻盘，不是被打。规则顺序错了会把这一整类算成威胁。
  { id: 'reveal', label: '揭示', test: /原来|竟是|竟然|真相|这才明白|根本不是/ },
  { id: 'threat', label: '威胁', test: /忽然|猛地|骤然|刀|枪|血|尸|杀|死|箭|火起|炸/ },
  { id: 'interrupt', label: '中断', test: /正要|刚要|还没|话没说完|就在此时|这时门/ },
  { id: 'emotion', label: '情绪', test: /哭|笑|怒|颤|抖|咬牙|心如|眼眶/ },
  { id: 'promise', label: '承诺', test: /等我|一定会|明日|三天|迟早|必定/ },
]

const TENSE_WORDS = /杀|血|刀|枪|吼|怒|冲|撞|砸|撕|碎|追|逃|逼|抢|夺|瞪|掐|踹|撞|裂/g
const CALM_WORDS = /坐|站|看|听|想|说|笑|走|茶|窗|雨|风|灯|衣|桌|书/g

/** 末段是哪种钩子。没有末段返回 null —— 空章不该被算成「无钩」。 */
export function hookOf(body) {
  const paras = String(body ?? '').split(/\n+/).map((row) => row.trim()).filter(Boolean)
  const tail = paras.slice(-2).join('')
  if (!tail) return { id: 'none', label: '无尾' }
  for (const rule of HOOK_RULES) {
    if (rule.test.test(tail)) return { id: rule.id, label: rule.label }
  }
  return { id: 'flat', label: '平收' }
}

// 专名：以地名/机构后缀结尾的 2-6 字。前面不能是代词或常用动词，
// 否则「他站在城」这种半句会被当成地名抽出来 —— 那种脏数据进了账本比没有更坏。
const PROPER_RE = /(?<!他|她|我|你|站|在|进|出|入|回|到|望|看|这|那|座|个|一|的)[\u4e00-\u9fa5]{2,4}(?:城|关|府|县|州|郡|殿|阁|楼|观|寺|军|营|派|宗|门|帮|会|盟|堂|馆|庄|岛|山|河|江|湖|宫|院|局|司|监|卫)(?![\u4e00-\u9fa5])/g
const NUMBER_RE = /\d+(?:\.\d+)?\s*(?:万|千|百|两|斤|石|里|步|年|月|日|天|个|人|匹|两银|贯|文|成|岁|次|回|层|重)/g
const TIME_RE = /(?:次日|当夜|三日后|半月后|数日|隔日|翌日|黄昏|破晓|入夜|午后|多年前|那年|入冬|开春)/g

/** 这一章「交代了哪些事实」——专名、数量、时间点。去重后取前若干条。 */
export function factsOf(body) {
  const text = String(body ?? '')
  const grab = (re, kind) => [...new Set(text.match(re) ?? [])].slice(0, 8).map((value) => ({ kind, value: value.trim() }))
  return [...grab(PROPER_RE, '专名'), ...grab(NUMBER_RE, '数量'), ...grab(TIME_RE, '时间')]
}

// 动作词表。宁可宽一点 —— 拆书问的是「谁做了什么」，
// 词表窄了会把一整章抽成空的，那比多收一句废话更糟。
const ACTION_VERBS = [
  '说', '问', '喊', '叫', '答', '骂', '笑', '哭', '叹', '念',
  '冲', '推', '拉', '夺', '扔', '砍', '拔', '刺', '跪', '抱', '踹', '塞', '拦', '挡', '抓', '扯', '拽',
  '打', '杀', '踢', '撞', '砸', '撕', '摔', '劈', '架', '射', '放箭',
  '转身', '抬手', '低头', '回头', '伸手', '开口', '起身', '点头', '摇头',
  '翻', '找', '查', '递', '接', '拿', '取', '放', '收', '藏', '埋',
  '看', '望', '盯', '瞧', '瞥', '听', '守', '等',
  '站', '坐', '躺', '蹲', '走', '跑', '退', '进', '出', '回', '跟', '追', '逃', '停', '醒', '睡',
  '擦', '抹', '握', '按', '拍', '碰', '敲', '开', '关', '锁', '插', '写', '读',
  '吃', '喝', '穿', '脱', '带', '救', '护', '送', '换', '点',
]
const ACTION_RE = new RegExp(
  `(?:他|她|我|你|众人|有人|那人|对方|两人|自己)[^，。！？\\n]{0,24}(?:${ACTION_VERBS.join('|')})`,
)
// 没有主语的句子（「刀劈过来，他侧身让开」前半段）也要能进剧情点：
// 中文叙述常常承前省略主语，严格要主语会漏掉一半动作。
const BARE_ACTION_RE = new RegExp(
  `^[^，。！？\\n]{0,12}(?:${ACTION_VERBS.join('|')})[^，。！？\\n]{0,20}$`,
)

/** 剧情点：谁做了什么。取含主谓动作的句子，不要形容词堆。 */
export function beatsOf(body, limit = 6) {
  const sentences = String(body ?? '').split(/[。！？\n]+/).map((row) => row.trim()).filter((row) => row.length >= 6)
  const out = []
  for (const row of sentences) {
    if (!ACTION_RE.test(row) && !BARE_ACTION_RE.test(row)) continue
    out.push(row.slice(0, 60))
    if (out.length >= limit) break
  }
  return out
}

/** 情绪值 0-10：冲突词减平静词，按千字归一。只用来排序，不用来判断好坏。 */
export function emotionOf(body) {
  const text = String(body ?? '')
  const chars = Math.max(countWords(text), 1)
  const tense = (text.match(TENSE_WORDS) ?? []).length
  const calm = (text.match(CALM_WORDS) ?? []).length
  const raw = ((tense - calm * 0.6) / chars) * 1000
  return Math.max(0, Math.min(10, Math.round((raw + 3) * 10) / 10))
}

/** 对话比 0-1：引号内字数占全文比例。判断「这章是不是俩人聊了一整章」。 */
export function dialogueRatio(body) {
  const text = String(body ?? '')
  const chars = Math.max(countWords(text), 1)
  let inside = 0
  for (const m of text.matchAll(/[「“"]([^」”"]{1,400})[」”"]/g)) inside += countWords(m[1])
  return Math.round((inside / chars) * 100) / 100
}

function digest(text) {
  return createHash('sha1').update(String(text)).digest('hex').slice(0, 12)
}

/** 单章一行数据。 */
export function analyzeChapter(row) {
  const body = row.body ?? ''
  const words = countWords(body)
  const paras = body.split(/\n+/).filter((line) => line.trim()).length
  return {
    num: row.num,
    title: row.title || row.raw || `第 ${row.num} 章`,
    words,
    paras,
    chars: String(body).length,
    hook: hookOf(body),
    emotion: emotionOf(body),
    dialogue: dialogueRatio(body),
    facts: factsOf(body),
    beats: beatsOf(body),
    firstLine: (body.split(/\n/).find((line) => line.trim()) ?? '').trim().slice(0, 60),
  }
}

async function analysesDir(root, projectId, { create = false } = {}) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'analyses')
  if (create) await fs.mkdir(base, { recursive: true })
  return base
}

async function readIndex(base) {
  try {
    const raw = await fs.readFile(path.join(base, 'index.json'), 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

async function writeIndex(base, items) {
  await fs.writeFile(path.join(base, 'index.json'), JSON.stringify({ items }, null, 2), 'utf8')
}

/**
 * 拆一本。source 可以是粘贴的全文，也可以是磁盘路径。
 * 同步跑完：一千章纯字符串运算在本机是一秒级，不值得做成后台任务。
 */
export async function startAnalyze(root, projectId, payload = {}) {
  let text = String(payload.text ?? '')
  const source = String(payload.source ?? '').trim()
  if (!text.trim() && source) {
    try {
      text = await fs.readFile(source, 'utf8')
    } catch (error) {
      fail(`读不到这本书：${error.message}`, 'missing')
    }
  }
  if (!text.trim()) fail('没有正文可拆：给 text（粘贴全文）或 source（文件路径）')

  const rows = splitBook(text)
  const chapters = rows.filter((row) => !row.noise).map(analyzeChapter)
  const noise = rows.filter((row) => row.noise).map((row) => row.title)
  if (!chapters.length) fail('一个章节标题都没认出来。支持「第一章 xxx」「第1章」「楔子」「Chapter 3」这几种。')

  const totalWords = chapters.reduce((sum, row) => sum + row.words, 0)
  const hookCount = {}
  for (const row of chapters) hookCount[row.hook.id] = (hookCount[row.hook.id] ?? 0) + 1
  const withWords = chapters.filter((row) => row.words > 0)
  const avgEmotion = withWords.length
    ? Math.round((withWords.reduce((sum, row) => sum + row.emotion, 0) / withWords.length) * 10) / 10
    : 0
  const avgDialogue = withWords.length
    ? Math.round((withWords.reduce((sum, row) => sum + row.dialogue, 0) / withWords.length) * 100) / 100
    : 0

  const id = `an_${digest(`${projectId}:${chapters.length}:${totalWords}:${chapters[0].title}`)}`
  const data = {
    id,
    title: String(payload.title ?? '').trim() || `拆书 ${new Date().toISOString().slice(0, 10)}`,
    createdAt: new Date().toISOString(),
    source: source || '(粘贴)',
    chapters: chapters.length,
    totalWords,
    noise,
    avgEmotion,
    avgDialogue,
    hookCount,
    // 三章「黄金开头」单独摘出来：判一本书能不能留人，前三千字占七成。
    opening: chapters.slice(0, 3),
    rows: chapters,
  }

  const base = await analysesDir(root, projectId, { create: true })
  // 拆书结果文件本身名字唯一（按 id），不会互相覆盖；
  // 要串的是 index.json —— 它才是「读整个数组、插一条、写回去」的那份。
  await serializeBy(path.join(base, 'index.json'), async () => {
    await fs.writeFile(path.join(base, `${id}.json`), JSON.stringify(data, null, 2), 'utf8')
    const items = await readIndex(base)
    const next = [
      {
        id, title: data.title, createdAt: data.createdAt, chapters: data.chapters, totalWords, avgEmotion,
      },
      ...items.filter((row) => row.id !== id),
    ].slice(0, 40)
    await writeIndex(base, next)
  })
  return data
}

export async function listAnalyses(root, projectId) {
  const base = await analysesDir(root, projectId)
  const items = await readIndex(base)
  return { items, total: items.length }
}

export async function getAnalysis(root, projectId, id) {
  const base = await analysesDir(root, projectId)
  const name = String(id ?? '').trim()
  if (!/^an_[0-9a-f]{12}$/.test(name)) fail('拆书 id 不合法')
  try {
    const raw = await fs.readFile(path.join(base, `${name}.json`), 'utf8')
    return JSON.parse(raw)
  } catch {
    fail(`没有这次拆书：${name}`, 'missing')
  }
}

export async function removeAnalysis(root, projectId, id) {
  const base = await analysesDir(root, projectId)
  const name = String(id ?? '').trim()
  if (!/^an_[0-9a-f]{12}$/.test(name)) fail('拆书 id 不合法')
  await serializeBy(path.join(base, 'index.json'), async () => {
    await fs.rm(path.join(base, `${name}.json`), { force: true })
    const items = await readIndex(base)
    await writeIndex(base, items.filter((row) => row.id !== name))
  })
  return { id: name, removed: true }
}
