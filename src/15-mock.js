/**
 * 长夜 · 界面演示数据与新小部件
 *
 * 这些是「界面先长出来、内核后接」的那一层：所有数字都是写死的假数据，
 * 每个可点的东西都有可见反馈（toast / 展开 / 滚动 / 排序），没有一个点了没反应。
 * 后端接通后，把 MOCK 里的常量换成 RPC 返回值即可，组件签名不用动。
 */

// ── 假数据 ──────────────────────────────────────────────────

const MOCK = {
  // 状态灯：AI 现在到底动不动
  run: { writing: true, chapter: 5, words: 1240, total: 2500, eta: '约 42 秒' },

  // 两周柱状图：每天写了多少字（0 = 断更）
  days: [
    { d: '10-14', w: 2600 }, { d: '10-15', w: 1800 }, { d: '10-16', w: 0 },
    { d: '10-17', w: 3100 }, { d: '10-18', w: 2500 }, { d: '10-19', w: 900 },
    { d: '10-20', w: 2700 }, { d: '10-21', w: 0 }, { d: '10-22', w: 2200 },
    { d: '10-23', w: 3300 }, { d: '10-24', w: 2500 }, { d: '10-25', w: 1200 },
    { d: '10-26', w: 2800 }, { d: '10-27', w: 1240 },
  ],

  // 全书进度：卷名 + 每卷章数
  volumes: [
    { name: '第一卷 · 城头夜雨', chapters: 12, done: 6 },
    { name: '第二卷 · 淮右风云', chapters: 12, done: 0 },
    { name: '第三卷 · 金陵座上', chapters: 6, done: 0 },
  ],
  progress: { words: 12840, target: 60000, chapter: 6, total: 30 },

  // 意图复用：最近三次用过的指令
  intents: [
    '主角吃瘪但埋下钩子，章末反转，不许死人',
    '连更：延续上一章钩子，节奏加快，多写对话',
    '过渡章：交代势力关系，用一场雨把场景从城头带到营帐',
  ],

  // 账本出处：格 → 哪回哪句话
  sources: {
    'characters.name': { chapter: 3, quote: '朱砂把伞往上抬了抬，雨珠顺着伞骨滑到袖口。' },
    'characters.role': { chapter: 2, quote: '「你算什么身份，也配在城头站着？」' },
    'characters.state': { chapter: 5, quote: '金丹三层的灵力在经脉里转了一圈，才勉强压下胸口的闷痛。' },
    'characters.lastChapter': { chapter: 5, quote: '她最后一次露面是第五回结尾。' },
    'foreshadow.name': { chapter: 3, quote: '雨里有人低低喊了一声她的名字，喊得极轻。' },
    'foreshadow.plannedChapter': { chapter: 3, quote: '这一声名字，本该在第十二回才被捡起来。' },
    'terms.name': { chapter: 1, quote: '「朱砂」两个字，在军籍上写得清清楚楚。' },
  },

  // 侦察「最近干过什么」
  history: [
    { id: 'h1', kind: '拆文', icon: '🧪', title: '《长夜行》拆解完成', sub: '黄金三章 + 120 章摘要 · 落盘 拆文库/长夜行/', at: '今天 11:20', age: '2 小时前' },
    { id: 'h2', kind: '扫榜', icon: '📊', title: '起点 + 番茄 长篇榜', sub: '抓到 48 本，题材分布：权谋 21 / 种田 11 / 系统 9', at: '昨天 20:05', age: '1 天前' },
    { id: 'h3', kind: '资料', icon: '📚', title: '元末城防与火器', sub: '交回 9 条结论，附 4 个出处', at: '10-25 15:40', age: '2 天前' },
    { id: 'h4', kind: '封面', icon: '🎨', title: '《元末女帝》封面 v2', sub: '冷灰史诗风 · 1536×2048', at: '10-24 09:12', age: '3 天前' },
  ],

  // 扫榜结果表
  scan: [
    { rank: 1, platform: '起点', book: '我在大明当暴君', genre: '历史', collect: '38.2 万', hook: '开局就把皇帝绑了', trend: '↑ 12' },
    { rank: 2, platform: '番茄', book: '重生之我家有矿', genre: '都市', collect: '96.5 万', hook: '一锄头挖出金矿', trend: '↑ 5' },
    { rank: 3, platform: '起点', book: '北望山河', genre: '权谋', collect: '21.7 万', hook: '城破那夜她改了军令', trend: '↓ 2' },
    { rank: 4, platform: '七猫', book: '嫁进侯门第三年', genre: '宅斗', collect: '64.1 万', hook: '休书递上来时她笑了', trend: '↑ 31' },
    { rank: 5, platform: '晋江', book: '纸上谈兵', genre: '古言', collect: '18.9 万', hook: '她替兄长去考了武举', trend: '— 0' },
    { rank: 6, platform: '番茄', book: '系统让我截胡', genre: '系统', collect: '88.3 万', hook: '任务目标：抢了主角的机缘', trend: '↑ 9' },
  ],

  // 提案批量
  proposals: [
    { chapter: 3, title: '删掉重复的「仿佛」', diffs: 2 },
    { chapter: 3, title: '把雨声改到段首', diffs: 1 },
    { chapter: 5, title: '重写章末钩子', diffs: 1 },
  ],

  // 提案板：真实列表为空时顶上来的演示行（页面不能只显示一句「没有待批提案」）
  proposalsDemo: [
    {
      id: 'demo-p1', chapter: 3, title: '删掉重复的「仿佛」', kind: 'rewrite', status: 'pending',
      summary: '同一段里出现三次「仿佛」，AI 味重，建议删两处、改一处比喻。',
      diffs: [
        { before: '雨声仿佛在耳边，仿佛很近，又仿佛很远。', after: '雨声在耳边，很近，又很远。', why: '连用三个「仿佛」是典型 AI 排比' },
        { before: '她仿佛听见有人在喊她。', after: '她听见有人喊她。', why: '不确定语气削弱紧张感' },
      ],
    },
    {
      id: 'demo-p2', chapter: 3, title: '把雨声改到段首', kind: 'patch', status: 'pending',
      summary: '环境音提前，先给读者耳朵，再给画面。',
      diffs: [{ before: '朱砂把伞往上抬了抬，雨珠顺着伞骨滑到袖口。', after: '雨珠顺着伞骨滑到袖口。朱砂把伞往上抬了抬。', why: '先声后人，开局更有代入' }],
    },
    {
      id: 'demo-p3', chapter: 5, title: '重写章末钩子', kind: 'patch', status: 'pending',
      summary: '现在的结尾把话说完了，读者没有翻页的理由。',
      diffs: [{ before: '她转身走进雨里，再没有回头。', after: '她转身走进雨里。身后那人忽然喊了一声她的名字——喊得极轻。', why: '留一个未答的问题' }],
    },
  ],

  // 问题单：同理的演示行
  problemsDemo: [
    { id: 'demo-q1', chapter: 3, type: 'ai-style', severity: 'major', status: 'open', text: '连续三段都用「仿佛」，AI 味重', quote: '雨声仿佛在耳边' },
    { id: 'demo-q2', chapter: 3, type: 'logic', severity: 'critical', status: 'open', text: '第 2 回说她没带伞，这一回伞从哪来的', quote: '朱砂把伞往上抬了抬' },
    { id: 'demo-q3', chapter: 5, type: 'style', severity: 'minor', status: 'open', text: '「灵力」和「真气」混用，设定里只该有一个', quote: '金丹三层的灵力' },
    { id: 'demo-q4', chapter: 7, type: 'other', severity: 'note', status: 'fixed', text: '章末少一个空行', quote: '' },
  ],

  // 验收详情正文：章节还没有字的时候顶上来，保证彩带 / 点亮 / 段落视图都有东西可看
  reviewText: [
    '雨声仿佛在耳边，仿佛很近，又仿佛很远。朱砂把伞往上抬了抬，雨珠顺着伞骨滑到袖口。',
    '城头上的火把被风吹得歪向一边，守卒缩着脖子，谁也不敢先开口。',
    '「你算什么身份，也配在城头站着？」',
    '说话的人披着半旧的猩红斗篷，靴底沾着泥，一看就是从马背上直接下来的。',
    '朱砂没有回头。金丹三层的灵力在经脉里缓缓转了一圈，才勉强压下胸口的闷痛。',
    '她听见有人在雨里低低喊了一声她的名字，喊得极轻，像是怕被谁听见。',
    '身后那人忽然提高了声音，说的是军籍上的事——「朱砂」两个字，在册子上写得清清楚楚。',
    '火把忽然灭了。黑暗里只有雨，和越来越近的脚步声。',
    '她终于转过身。',
    '「你要找的人，三年前就死在这座城头上了。」',
    '那人愣了一下，随即笑了。笑得很难看，像是终于等到了一句早就知道答案的话。',
    '雨更大了。远处传来三声号角，紧接着是城门轴木转动时那种闷到骨头里的响声。',
  ],

  // 扫榜结果的更多字段（表格用）
}

// ── 1. 状态灯 ──────────────────────────────────────────────

function StatusLamp({ toast }) {
  const run = MOCK.run
  return h(
    'button',
    {
      type: 'button',
      className: `nw-lamp${run.writing ? ' on' : ''}`,
      onClick: () => toast?.(`模拟：AI 正在写第 ${run.chapter} 回，已出 ${run.words} 字，${run.eta}后交稿`),
      title: '点一下看这一单的详情（演示数据）',
    },
    h('span', { className: 'nw-lamp-dot' }),
    h(
      'span',
      { className: 'nw-lamp-body' },
      h('span', { className: 'nw-lamp-text' }, run.writing ? `正在写第 ${run.chapter} 回` : '队列空闲'),
      h('span', { className: 'nw-lamp-sub' }, `${run.words}/${run.total} 字`),
    ),
  )
}

// ── 5. 两周柱状图 ───────────────────────────────────────────

function DayBars({ days, target, toast }) {
  const peak = Math.max(target || 1, ...days.map((row) => row.w))
  return h(
    'div',
    { className: 'nw-days' },
    h(
      'div',
      { className: 'nw-days-head' },
      h('span', null, '近两周'),
      h('span', { className: 'nw-hint' }, `达标 ${days.filter((row) => row.w >= target).length} 天 · 断更 ${days.filter((row) => row.w === 0).length} 天`),
    ),
    h(
      'div',
      { className: 'nw-days-bars' },
      days.map((row) => h(
        'button',
        {
          type: 'button',
          key: row.d,
          className: `nw-day${row.w === 0 ? ' nw-day-off' : row.w >= target ? ' nw-day-ok' : ''}`,
          onClick: () => toast?.(`${row.d}：${row.w === 0 ? '没写' : `${row.w} 字`}`),
          title: `${row.d} · ${row.w} 字`,
        },
        h('span', { className: 'nw-day-fill', style: { height: `${Math.max(4, (row.w / peak) * 100)}%` } }),
        h('span', { className: 'nw-day-label' }, row.d.slice(3)),
      )),
    ),
    h('div', { className: 'nw-days-rule' }, h('span', null, `目标 ${target} 字/天`)),
  )
}

// ── 6. 全书进度条 ──────────────────────────────────────────

function ProgressTrack({ progress, volumes, toast }) {
  const pct = Math.min(100, (progress.words / progress.target) * 100)
  // 卷是可选输入：没大纲、或大纲还没生成时是空数组。
  // 以前这里直接 volumes[0].name，空数组会当场抛错把整页打白。
  const vols = Array.isArray(volumes) && volumes.length
    ? volumes
    : [{ name: '全书', chapters: Math.max(1, Number(progress.total) || 1), done: Number(progress.chapter) || 0 }]
  return h(
    'div',
    { className: 'nw-progress' },
    h(
      'div',
      { className: 'nw-progress-head' },
      h('span', { className: 'nw-progress-num' }, `${fmtWords(progress.words)} / ${fmtWords(progress.target)} 字`),
      h('span', { className: 'nw-progress-meta' }, `第 ${progress.chapter}/${progress.total} 回 · ${String(vols[0].name).split(' · ')[0]}`),
    ),
    h(
      'div',
      { className: 'nw-progress-track' },
      vols.map((vol, index) => h(
        'button',
        {
          type: 'button',
          key: vol.name,
          className: 'nw-progress-vol',
          style: { flexGrow: vol.chapters },
          onClick: () => toast?.(`${vol.name}：${vol.done}/${vol.chapters} 章已采纳`),
          title: `${vol.name} · ${vol.done}/${vol.chapters}`,
        },
        h('span', { className: 'nw-progress-fill', style: { width: `${(vol.done / vol.chapters) * 100}%` } }),
        index ? h('span', { className: 'nw-progress-sep' }) : null,
        h('span', { className: 'nw-progress-name' }, vol.name.split(' · ')[1] || vol.name),
      )),
    ),
    h(
      'div',
      { className: 'nw-progress-foot' },
      h('span', { className: 'nw-hint' }, `已完成 ${pct.toFixed(1)}% · 剩余约 ${Math.max(0, progress.total - progress.chapter)} 回`),
    ),
  )
}

// ── 3. 命令面板 ────────────────────────────────────────────

const CMD_ITEMS = [
  { id: 'write', icon: '✍️', label: '写第 6 章', hint: '排工单 + 跳生产台', page: 'studio' },
  { id: 'batch', icon: '⚡', label: '连更 3 章', hint: '排三张工单', page: 'studio' },
  { id: 'jump', icon: '⏭', label: '跳到第 12 回', hint: '打开验收详情', page: 'review' },
  { id: 'find', icon: '🔍', label: '找「玉玺」', hint: '正文 + 八类账本一起搜', page: 'world' },
  { id: 'check', icon: '🩺', label: '体检全书', hint: '查设定冲突与伏笔逾期', page: 'review' },
  { id: 'plan', icon: '📐', label: '补第 7-12 回细纲', hint: '让 AI 填骨架', page: 'plan' },
  { id: 'export', icon: '📦', label: '导出全部数据', hint: '打包成 zip', page: 'settings' },
]

function CommandPalette({ projectId, onClose, go, toast }) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const [scope, setScope] = useState('all')
  // 服务端搜：正文在磁盘上，浏览器没有全文。见 lib/store.js searchProject 的注释。
  // 输入第一次变化才发请求，打开面板时不打空查询。
  const [hits, setHits] = useState(null)
  const [searching, setSearching] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const seq = useRef(0)

  const commands = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return CMD_ITEMS
    return CMD_ITEMS.filter((item) => `${item.label}${item.hint}`.toLowerCase().includes(key))
  }, [q])

  useEffect(() => {
    const key = q.trim()
    if (!key || !projectId) {
      setHits(null)
      setTruncated(false)
      return undefined
    }
    // 防抖：连打时只认最后一次。输入框每敲一个字都搜一遍会打满 RPC。
    const mine = ++seq.current
    setSearching(true)
    const timer = setTimeout(() => {
      api('search', { projectId, q: key, scope, limit: 20 })
        .then((data) => {
          if (mine !== seq.current) return
          setHits(Array.isArray(data?.hits) ? data.hits : [])
          setTruncated(!!data?.truncated)
        })
        .catch(() => {
          if (mine !== seq.current) return
          setHits([])
        })
        .then(() => {
          if (mine !== seq.current) return
          setSearching(false)
        })
    }, 220)
    return () => clearTimeout(timer)
  }, [q, scope, projectId])

  const rows = useMemo(() => {
    if (!hits) return commands.map((item) => ({ type: 'cmd', item }))
    const out = []
    const seenHeading = { cmd: false, hit: false }
    for (const item of commands) {
      if (!seenHeading.cmd) {
        out.push({ type: 'heading', text: '命令' })
        seenHeading.cmd = true
      }
      out.push({ type: 'cmd', item })
    }
    for (const hit of hits) {
      if (!seenHeading.hit) {
        out.push({ type: 'heading', text: `正文与账本（${hits.length} 条命中）` })
        seenHeading.hit = true
      }
      out.push({ type: 'hit', hit })
    }
    if (!out.length) return []
    return out
  }, [hits, commands])

  // 光标只能停在可执行行上，跳过小标题。
  const runnable = useMemo(() => rows.map((row, index) => (row.type === 'heading' ? -1 : index)).filter((i) => i >= 0), [rows])

  const runCmd = (item) => {
    if (!item) return
    onClose?.()
    go?.(item.page)
    toast?.(`已执行：${item.label}（演示，未接内核）`)
  }

  const runHit = (hit) => {
    if (!hit) return
    onClose?.()
    if (hit.kind === 'chapter') {
      // 命中段号通过 nw.openChapter / nw.openPara 带到验收台，那边会滚到并点亮那一段。
      writeLS('nw.openChapter', String(hit.chapter))
      if (Number.isFinite(hit.para)) writeLS('nw.openPara', String(hit.para))
      go?.('review')
      toast?.(`第 ${hit.chapter} 回 · 第 ${(Number(hit.para) || 0) + 1} 段`)
      return
    }
    if (hit.kind === 'outline') {
      go?.('plan')
      toast?.(`大纲：第 ${hit.chapter ?? '?'} 回`)
      return
    }
    go?.('world')
    toast?.(`账本 · ${hit.title || hit.id}（${hit.ledger || ''}）`)
  }

  const run = (row) => {
    if (!row) return
    if (row.type === 'cmd') runCmd(row.item)
    else if (row.type === 'hit') runHit(row.hit)
  }

  const activeRow = rows[cursor]
  return h(
    Modal,
    {
      title: '命令与搜索',
      onClose,
      footer: h('span', { className: 'nw-hint' }, '↑↓ 选 · Enter 执行 · Esc 关闭'),
    },
    h(Input, {
      value: q,
      placeholder: '输命令，或直接搜正文与账本（例如「玉玺」）…',
      autoFocus: true,
      'aria-label': '命令与全文搜索',
      onChange: (v) => {
        setQ(v)
        setCursor(0)
      },
      onKeyDown: (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const at = runnable.indexOf(cursor)
          const next = event.key === 'ArrowDown'
            ? runnable[Math.min(runnable.length - 1, Math.max(0, at) + (at < 0 ? 0 : 1))]
            : runnable[Math.max(0, (at < 0 ? runnable.length : at) - 1)]
          if (next !== undefined && next >= 0) setCursor(next)
        } else if (event.key === 'Enter') {
          event.preventDefault()
          run(activeRow)
        }
      },
    }),
    q.trim()
      ? h(
        'div',
        { className: 'nw-cmdk-scope' },
        ['all', 'chapters', 'ledger', 'outline'].map((key) => h(
          'button',
          {
            type: 'button',
            key,
            className: `nw-seg-btn${scope === key ? ' on' : ''}`,
              'aria-pressed': scope === key ? 'true' : 'false',
            onClick: () => setScope(key),
          },
          { all: '全部', chapters: '正文', ledger: '账本', outline: '大纲' }[key],
        )),
        searching ? h('span', { className: 'nw-hint' }, '搜索中…') : null,
        truncated ? h('span', { className: 'nw-hint' }, '命中太多，只显示前 20 条') : null,
      )
      : null,
    h(
      'div',
      { className: 'nw-cmdk-list' },
      rows.length
        ? rows.map((row, index) => (row.type === 'heading'
          ? h('div', { className: 'nw-cmdk-head', key: `h${index}` }, row.text)
          : h(
            'button',
            {
              type: 'button',
              key: row.type === 'cmd' ? `c-${row.item.id}` : `s-${row.hit.kind}-${index}`,
              className: `nw-cmdk-row${index === cursor ? ' on' : ''}${row.type === 'hit' ? ' nw-cmdk-hit' : ''}`,
              onMouseEnter: () => setCursor(index),
              onClick: () => run(row),
            },
            h('span', { className: 'nw-cmdk-icon' }, row.type === 'cmd' ? row.item.icon : (row.hit.kind === 'ledger' ? '📒' : row.hit.kind === 'outline' ? '📐' : '📄')),
            h('span', { className: 'nw-cmdk-label' }, row.type === 'cmd'
              ? row.item.label
              : (row.hit.kind === 'chapter'
                // 【12 条 #9】服务端现在回所有命中，还带 nth/count。
                // 只显示「第 N 段」看不出这句在这章里出现了几次，补上「第 2/8 处」。
                ? `第 ${row.hit.chapter} 回 · 第 ${(Number(row.hit.para) || 0) + 1} 段${Number(row.hit.count) > 1 ? ` · 第 ${row.hit.nth}/${row.hit.count} 处` : ''}`
                : row.hit.title)),
            h('span', { className: 'nw-cmdk-hint' }, row.type === 'cmd' ? row.item.hint : String(row.hit.quote ?? '').slice(0, 60)),
            h('span', { className: 'nw-cmdk-go' }, '↵'),
          )))
        : h(Empty, null, hits ? '没有匹配。' : '没有匹配的命令。'),
    ),
  )
}

// ── 12. 意图复用 ───────────────────────────────────────────

function IntentChips({ onPick, toast }) {
  return h(
    'div',
    { className: 'nw-chips' },
    h('span', { className: 'nw-chips-label' }, '最近用过'),
    MOCK.intents.map((text, index) => h(
      'button',
      {
        type: 'button',
        key: index,
        className: 'nw-chip',
        title: text,
        onClick: () => {
          onPick?.(text)
          toast?.('已填回最近第 ' + (index + 1) + ' 条意图')
        },
      },
      `${index + 1}. ${text.slice(0, 16)}${text.length > 16 ? '…' : ''}`,
    )),
  )
}

// ── 13. 逐段热力条 ─────────────────────────────────────────

/**
 * 段落色调。
 *
 * 真值优先：aiHits 是服务端 chapter.aistyle 扫词表的结果（带段号），
 * 有它的时候彩带说的是实际问题，不再是「第 3 段一定红」的装饰。
 * 没有命中、也没有问题时才回落到长度启发式 —— 短段算节奏拖，其余算好段。
 */
function heatTone(text, index, aiHits, issues) {
  const hits = Array.isArray(aiHits) ? aiHits.filter((row) => Number(row.para) === index) : []
  if (hits.length) return 'bad'
  const marks = Array.isArray(issues) ? issues.filter((row) => Number(row.para) === index) : []
  if (marks.some((row) => row.type === 'logic')) return 'bad'
  if (marks.length) return 'warn'
  const size = String(text || '').length
  if (size < 30) return 'warn'
  return 'good'
}

function HeatStrip({
  paragraphs, active, onPick, aiHits, issues,
}) {
  return h(
    'div',
    { className: 'nw-heat' },
    h('span', { className: 'nw-heat-title' }, '段'),
    h(
      'div',
      { className: 'nw-heat-track' },
      paragraphs.map((para, index) => h(
        'button',
        {
          type: 'button',
          key: index,
          className: `nw-heat-cell nw-heat-${heatTone(para, index, aiHits, issues)}${active === index ? ' on' : ''}`,
          style: { flexGrow: Math.max(1, Math.min(6, Math.ceil(String(para).length / 60))) },
          onClick: () => onPick?.(index),
          title: `第 ${index + 1} 段 · ${String(para).length} 字 · ${heatTone(para, index, aiHits, issues) === 'bad' ? 'AI 味重' : heatTone(para, index, aiHits, issues) === 'warn' ? '节奏拖' : '好段'}`,
        },
      )),
    ),
    h(
      'div',
      { className: 'nw-heat-legend' },
      h('span', { className: 'nw-heat-key nw-heat-good' }, '好'),
      h('span', { className: 'nw-heat-key nw-heat-warn' }, '拖'),
      h('span', { className: 'nw-heat-key nw-heat-bad' }, 'AI 味'),
    ),
  )
}

// ── 18. 账本格出处 ─────────────────────────────────────────

function SourcePop({ source, onClose }) {
  if (!source) return null
  return h(
    Modal,
    {
      title: '这条从哪来',
      onClose,
      footer: h(Btn, { kind: 'ghost', small: true, onClick: onClose }, '知道了'),
    },
    h('div', { className: 'nw-source' },
      h(Tag, { tone: 'amber' }, `第 ${source.chapter} 回`),
      h('p', { className: 'nw-source-quote' }, `「${source.quote}」`),
      h('p', { className: 'nw-hint' }, '演示数据：真出处由 nightwrite_op 在写账本时一并记下 chapter + quote，点它就能跳回那一段。')),
  )
}
