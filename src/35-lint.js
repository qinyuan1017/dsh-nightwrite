/**
 * 长夜 · 文风校验面板
 *
 * 为什么要有这一块：正文里「不是……而是……」「破折号一逗一串」「章末总结体」
 * 这些东西写的时候自己看不见，交稿之后才发现整章都是。人眼校一遍要半小时，
 * 机器校一遍是 20 毫秒 —— 那就让机器先看。
 *
 * 两档的处理方式不一样，这是故意的：
 *   硬拦（blocking）—— 写出来就是错，保存时服务端直接拒（chapter.save 抛 style-blocking）。
 *   提示（advisory）—— 只是可能不好，标黄，你自己看着办。
 * 一刀切全拦会变成「AI 替你写」，一刀切全放又等于没有校验。
 */

const LINT_SEVERITY_LABEL = { blocking: '硬伤', advisory: '提示' }
const LINT_SEVERITY_TONE = { blocking: 'red', advisory: 'amber' }

/**
 * 一条命中。
 *
 * 「为什么」单独给一个可展开的行，而不是塞进 title 属性——title 要悬停才出现，
 * 手机上根本没有悬停。作者看不到判据，就只会照着 hint 改字面，
 * 下一次写同样的句子还是不知道为什么错。
 */
function LintHit({ hit, onJump, open, onToggleWhy }) {
  // 「跳到正文」与「为什么」必须是两个并列的 button，不能把一个塞进另一个——
  // 按钮里套按钮，回车会触发两个动作，读屏也会把它念成一条。
  return h(
    'div',
    { className: 'nw-lint-item' },
    h(
      'div',
      { className: 'nw-lint-line' },
      h(
        'button',
        {
          type: 'button',
          className: `nw-lint-hit nw-lint-${hit.severity}`,
          onClick: () => onJump?.(hit),
          title: `第 ${hit.para + 1} 段 · ${hit.hint}`,
        },
        h('span', { className: 'nw-lint-n' }, String(hit.para + 1)),
        h(Tag, { tone: LINT_SEVERITY_TONE[hit.severity] ?? 'grey' }, hit.label),
        h('span', { className: 'nw-lint-quote' }, hit.quote),
        h('span', { className: 'nw-lint-hint' }, hit.hint),
      ),
      h(
        'button',
        {
          type: 'button',
          className: `nw-lint-why-btn${open ? ' on' : ''}`,
          'aria-expanded': open ? 'true' : 'false',
          title: '为什么这算毛病',
          onClick: () => onToggleWhy?.(hit),
        },
        open ? '为什么 ▲' : '为什么',
      ),
    ),
    open && hit.why
      ? h(
          'div',
          { className: 'nw-lint-why' },
          h('span', { className: 'nw-lint-why-tag' }, '为什么这算毛病'),
          h('span', { className: 'nw-lint-why-text' }, hit.why),
        )
      : null,
  )
}

/**
 * 章级体检：把四处「只报告不改」的检查攒在一张卡上。
 *
 * 为什么不并进文风校验：那四条判的不是「文笔好不好」，而是四种不同的事——
 *   退化    这段还是不是文（不是文就重跑，别改句子）
 *   照搬    正文是不是把细纲的句子搬了一遍
 *   标点    省略号/破折号/引号用的是哪一套（风格选择，不替人定）
 *   字数    读者看到的字数和作者报的是不是一个数
 * 混进 28 条文风规则里，作者会以为它们都是「改句子」的事。
 */
function ChapterHealth({ projectId, chapter, text, toast, onJumpPara }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState('')

  const run = useCallback(() => {
    if (!projectId || !chapter) return
    setBusy(true)
    // 四条并发，任一条挂了不该拖住其余三条——各写各的 catch。
    Promise.all([
      api('lint.degenerate', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('outline.copy', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('text.normalize', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('wordcount.check', { text }).catch((e) => ({ error: e.message })),
      // 六件事而不是四件：分数是「一句话判决」，保真是「有没有被改坏」。
      // 这两件要拿正文和现存旧稿比，前面四件只看正文，所以放后面两路。
      api('aiscore.check', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('fidelity.check', { projectId, chapter, after: text }).catch((e) => ({
        error: e.message,
      })),
    ])
      .then(([degenerate, copy, punct, words, score, fidelity]) => {
        setData({ degenerate, copy, punct, words, score, fidelity })
      })
      .then(() => setBusy(false))
  }, [projectId, chapter, text])

  // 换章就清空：留着上一章的数字比不显示更糟——人会以为那是现在这章的。
  useEffect(() => {
    setData(null)
    setOpen('')
  }, [chapter])

  if (!projectId || !chapter) return null

  const dg = data?.degenerate
  const cp = data?.copy
  const pt = data?.punct
  const wc = data?.words
  const sc = data?.score
  const fd = data?.fidelity

  const rows = !data
    ? []
    : [
        {
          id: 'degenerate',
          label: '是不是模型跑偏了',
          verdict: dg?.error
            ? `查不了：${dg.error}`
            : Number(dg?.total ?? 0)
              ? `${dg.total} 处退化`
              : '没看出跑偏',
          tone: dg?.error ? 'grey' : Number(dg?.total ?? 0) ? 'red' : 'green',
          detail: dg?.verdict ?? '',
          hits: (dg?.hits ?? []).map((h) => ({
            para: h.para,
            text: `第 ${Number(h.para) + 1} 段「${h.label}」${h.quote ? `：${h.quote}` : ''}`,
          })),
        },
        {
          id: 'copy',
          label: '正文有没有搬细纲',
          verdict: cp?.error
            ? `查不了：${cp.error}`
            : Number(cp?.total ?? 0)
              ? `${cp.total} 处重合，最长 ${Math.max(...cp.hits.map((h) => Number(h.chars) || 0))} 字`
              : '没有照搬',
          tone: cp?.error ? 'grey' : Number(cp?.total ?? 0) ? 'amber' : 'green',
          detail: cp?.verdict?.text ?? '',
          hits: (cp?.hits ?? []).slice(0, 8).map((h) => ({
            para: h.para,
            text: `第 ${Number(h.para) + 1} 段搬了 ${h.chars} 字：${String(h.copied ?? h.quote ?? '')}`,
          })),
        },
        {
          id: 'punct',
          label: '标点用的是哪一套',
          verdict: pt?.error
            ? `查不了：${pt.error}`
            : Number(pt?.total ?? 0)
              ? `${pt.total} 处不统一`
              : '没发现问题',
          tone: pt?.error ? 'grey' : Number(pt?.total ?? 0) ? 'amber' : 'green',
          detail: '只报告不改：省略号用「……」还是「...」是风格选择，替作者决定就是改风格。',
          hits: (pt?.changes ?? []).slice(0, 8).map((h) => ({
            para: h.para,
            text: `第 ${Number(h.para) + 1} 段「${h.label}」：${String(h.from ?? '')} → ${String(h.to ?? '')}`,
          })),
        },
        {
          id: 'words',
          label: '这个字数是怎么算的',
          verdict: wc?.error ? `查不了：${wc.error}` : `${wc?.words ?? 0} 字`,
          tone: 'grey',
          detail: wc?.error
            ? ''
            : `口径 ${wc?.metric ?? ''}：去掉 frontmatter 与首行标题后数非空白字符。原文 ${wc?.rawLength ?? 0} 字符，其中 ${wc?.trimmed ?? 0} 个不算正文，${wc?.paragraphs ?? 0} 段。`,
          hits: [],
        },
        {
          id: 'score',
          label: '这一章有多像 AI 写的',
          verdict: sc?.error
            ? `算不了：${sc.error}`
            : sc?.confident === false
              ? `${sc?.score ?? 0} 分 · ${sc?.label ?? ''}（样本太短，不敢下结论）`
              : `${sc?.score ?? 0} 分 · ${sc?.label ?? ''}`,
          // scoreTone 给的是 good/mid/bad（那是给分数条用的，配 nw-score-* 那套 CSS），
          // Tag 只认 green/amber/red/grey —— 混着用会渲出一个没有样式的标签。
          tone: sc?.error
            ? 'grey'
            : (sc?.score ?? 0) <= 30
              ? 'green'
              : (sc?.score ?? 0) <= 55
                ? 'amber'
                : 'red',
          detail: sc?.error
            ? ''
            : `${sc?.text ?? ''}${sc?.worst ? `最重的一条是「${sc.worst.label}」${sc.worst.count} 处（每千字 ${sc.worst.density} 次），占 ${sc.worst.points} 分。` : ''}分数线在 30 分，过了服务端会拒存——这不是建议，是闸门。`,
          hits: (sc?.custom ?? []).length
            ? sc.custom.map((row) => ({
                text: `你自己加的词「${row.phrase}」出现 ${row.count} 次`,
              }))
            : (sc?.signals ?? [])
                .filter((row) => Number(row.points) >= 1)
                .sort((a, b) => Number(b.points) - Number(a.points))
                .slice(0, 8)
                .map((row) => ({
                  text: `${row.label}：${row.count} 处 / ${Number(row.points).toFixed(1)} 分（每千字容忍 ${row.tolerance}）`,
                })),
        },
        {
          id: 'fidelity',
          label: '有没有把原来的东西改丢',
          verdict: fd?.error
            ? `查不了：${fd.error}`
            : fd?.level === 'ok'
              ? '没丢东西'
              : fd?.level === 'warn'
                ? '有点可疑'
                : '丢了不少',
          tone: fd?.error
            ? 'grey'
            : fd?.level === 'ok'
              ? 'green'
              : fd?.level === 'warn'
                ? 'amber'
                : 'red',
          detail: fd?.error
            ? ''
            : `${fd?.text ?? ''} 数字 ${fd?.numbers?.kept ?? 0}/${fd?.numbers?.total ?? 0} 保留，专名 ${fd?.names?.kept ?? 0}/${fd?.names?.total ?? 0}，引语 ${fd?.quotes?.kept ?? 0}/${fd?.quotes?.total ?? 0}。`,
          hits: (fd?.issues ?? []).map((row) => ({ text: row.text ?? String(row) })),
        },
      ]

  return h(
    Card,
    {
      title: '章级体检',
      extra: h(
        Btn,
        { small: true, kind: 'ghost', disabled: busy, onClick: run },
        busy ? '查着…' : data ? '重查' : '查一遍',
      ),
    },
    h('p', { className: 'nw-hint' }, '六件事各查各的，都只报告不改稿。'),
    !data
      ? h(Empty, null, '点「查一遍」，四条一起跑。')
      : h(
          'div',
          { className: 'nw-health' },
          ...rows.map((row) =>
            h(
              'div',
              { key: row.id, className: `nw-health-row nw-health-${row.id}` },
              h(
                'button',
                {
                  type: 'button',
                  className: 'nw-health-head',
                  'aria-expanded': open === row.id ? 'true' : 'false',
                  onClick: () => setOpen((prev) => (prev === row.id ? '' : row.id)),
                },
                h('span', { className: 'nw-health-label' }, row.label),
                h(Tag, { tone: row.tone }, row.verdict),
                h('span', { className: 'nw-health-caret' }, open === row.id ? '▾' : '▸'),
              ),
              open !== row.id
                ? null
                : h(
                    'div',
                    { className: 'nw-health-body' },
                    row.detail ? h('p', { className: 'nw-hint' }, row.detail) : null,
                    row.hits.length
                      ? h(
                          'div',
                          { className: 'nw-health-hits' },
                          ...row.hits.map((hit, index) =>
                            hit.para !== undefined && onJumpPara
                              ? h(
                                  'button',
                                  {
                                    type: 'button',
                                    key: index,
                                    className: 'nw-health-hit',
                                    onClick: () => {
                                      onJumpPara(Number(hit.para) || 0)
                                      toast?.(hit.text)
                                    },
                                  },
                                  hit.text,
                                )
                              : h(
                                  'span',
                                  { key: index, className: 'nw-health-hit nw-health-hit-flat' },
                                  hit.text,
                                ),
                          ),
                        )
                      : h('p', { className: 'nw-hint' }, '这一项没有具体条目。'),
                  ),
            ),
          ),
        ),
  )
}

/**
 * 校验面板。text 变了自己防抖重算 —— 校验是本地服务端算的，
 * 但每敲一个字打一次 RPC 也没必要，停手 700ms 再算。
 */
function LintPanel({
  projectId,
  chapter,
  text,
  title = '文风校验',
  onJump,
  toast,
  compact = false,
}) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [only, setOnly] = useState('all')
  // 哪一条的「为什么」展开着。存 key 不存下标——重算后命中顺序可能变。
  const [whyKey, setWhyKey] = useState('')
  const seq = useRef(0)

  const run = useCallback(
    (body) => {
      if (!String(body ?? '').trim()) {
        setResult(null)
        return
      }
      const mine = ++seq.current
      setBusy(true)
      // 一定要带 projectId：不带就只按全局阈值判，
      // 本书量过的阈值等于白量，界面还会显示「干净」而服务端拒存。
      api('lint.check', projectId ? { projectId, text: body } : { text: body })
        .then((data) => {
          if (mine !== seq.current) return
          setResult(data)
        })
        .catch(() => {
          if (mine !== seq.current) return
          setResult(null)
        })
        .then(() => {
          if (mine !== seq.current) return
          setBusy(false)
        })
    },
    [projectId],
  )

  useEffect(() => {
    const timer = setTimeout(() => run(text), 700)
    return () => clearTimeout(timer)
  }, [text, run])

  const hits = useMemo(() => {
    const all = Array.isArray(result?.hits) ? result.hits : []
    if (only === 'blocking') return all.filter((row) => row.severity === 'blocking')
    if (only === 'advisory') return all.filter((row) => row.severity === 'advisory')
    // 退化单独一档：这三条不是文笔问题，是「这段根本不是文本」。
    // 混在硬伤里会让人去逐句改，正确处理是整章重跑。
    if (only === 'degenerate') return all.filter((row) => row.group === 'degenerate')
    return all
  }, [result, only])

  const blocking = Number(result?.blocking ?? 0)
  const advisory = Number(result?.advisory ?? 0)
  const degenerated = (Array.isArray(result?.hits) ? result.hits : []).filter(
    (row) => row.group === 'degenerate',
  ).length

  return h(
    Card,
    {
      title,
      className: 'nw-lint' + (compact ? ' nw-lint-compact' : ''),
      extra: busy
        ? h('span', { className: 'nw-card-badge' }, '算…')
        : h('span', { className: 'nw-card-badge' }, blocking ? `${blocking} 硬伤` : '无硬伤'),
    },

    // 一句话结论：不要让人从数字自己推断「能不能发」。
    h(
      'div',
      { className: 'nw-lint-sum' },
      degenerated
        ? h(
            'span',
            { className: 'nw-lint-verdict nw-lint-verdict-bad' },
            `有 ${degenerated} 处退化——这段不是文，整章重跑，不要逐句改`,
          )
        : blocking
          ? h(
              'span',
              { className: 'nw-lint-verdict nw-lint-verdict-bad' },
              `有 ${blocking} 处硬伤，保存会被拦`,
            )
          : h(
              'span',
              { className: 'nw-lint-verdict nw-lint-verdict-ok' },
              advisory ? `硬伤 0，另有 ${advisory} 处提示` : '干净',
            ),
      h(
        'div',
        { className: 'nw-seg nw-lint-seg' },
        [
          { value: 'all', label: `全部 ${Number(result?.total ?? 0)}` },
          // 退化的计数单独标出来，还要标红：它和硬伤不是一类问题。
          { value: 'degenerate', label: `退化 ${degenerated}` },
          { value: 'blocking', label: `硬伤 ${blocking}` },
          { value: 'advisory', label: `提示 ${advisory}` },
        ].map((item) =>
          h(
            'button',
            {
              type: 'button',
              key: item.value,
              className: `nw-seg-btn${only === item.value ? ' on' : ''}`,
              'aria-pressed': only === item.value ? 'true' : 'false',
              onClick: () => setOnly(item.value),
            },
            item.label,
          ),
        ),
      ),
    ),

    !String(text ?? '').trim()
      ? h(Empty, null, '正文是空的，没得校。')
      : hits.length
        ? h(
            'div',
            { className: 'nw-lint-list' },
            hits.map((hit, index) => {
              const key = `${hit.id}-${hit.para}-${hit.offset}-${index}`
              return h(LintHit, {
                hit,
                key,
                open: whyKey === key,
                onToggleWhy: (row) => {
                  const mine = `${row.id}-${row.para}-${row.offset}-${index}`
                  setWhyKey((prev) => (prev === mine ? '' : mine))
                },
                onJump: (row) => {
                  onJump?.(row)
                  toast?.(`第 ${row.para + 1} 段「${row.label}」：${row.hint}`)
                },
              })
            }),
          )
        : h('p', { className: 'nw-hint' }, busy ? '算着呢…' : '这一档没有命中。'),

    // 词表与规则说明放折叠里：天天用的人不需要看，第一次用的人需要知道规则从哪来。
    h(
      'details',
      { className: 'nw-lint-about' },
      h('summary', null, '这些规则是哪来的'),
      h(
        'p',
        { className: 'nw-hint' },
        '硬伤档：正文里出现章号/本章/前文这类元叙述、写作术语、系统提示体、「不是…而是…」对偶否定、破折号连用、电报体短句、章末总结体。',
      ),
      h(
        'p',
        { className: 'nw-hint' },
        '提示档：句号碎、长段、微动作口头禅、套路反应、动作清单、抽象总结、陈词密度、比喻密度、推理链、引号强调、排比、过度压缩、连接词过少。',
      ),
      h(
        'p',
        { className: 'nw-hint' },
        '你自己在设置里加的词表（去 AI 味那 12 条）走的是另一套，只在存盘时记命中数，不在这里拦。',
      ),
      h(
        'p',
        { className: 'nw-hint' },
        '每条命中右边有个「为什么」——展开是这条规则的判据，讲的是读者会因此丢掉什么。hint 教你改这句，why 告诉你下次别这么写。',
      ),
    ),
  )
}

/**
 * 这本书自己的那套阈值（阶段 C）。
 *
 * 为什么要在界面上暴露「量一遍」：全局阈值是拿别人 214 章校准出来的。
 * 作者看不到这个数字从哪来，只能感觉到「它老误报」或者「它什么都不报」,
 * 然后整条规则关掉。让他自己量一次，误报才有解释，调整才有依据。
 *
 * 为什么强调「只调数值不改正则」：改数值是换秤，改规则是改尺子刻度。
 * 后者会让历史命中全部失去可比性，所以界面上只让改数，不让改判定逻辑。
 */
function LintCalibration({ projectId, toast, onDone }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    if (!projectId) return
    api('lint.calibration', { projectId })
      .then((res) => setData(res))
      .catch(() => setData(null))
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const run = () => {
    if (!projectId || busy) return
    setBusy(true)
    api('lint.calibrate', { projectId })
      .then((res) => {
        setLast(res)
        setData(res.calibration ?? data)
        toast?.(res.summary ?? '量完了')
        onDone?.()
      })
      .catch((err) => toast?.(err?.message ?? '量不出来'))
      .then(() => setBusy(false))
  }

  const clear = () => {
    if (!projectId || busy) return
    setBusy(true)
    api('lint.calibrate.save', { projectId, thresholds: null })
      .then((res) => {
        setData(res)
        setLast(null)
        toast?.('已回到全局阈值')
        onDone?.()
      })
      .catch((err) => toast?.(err?.message ?? '清不掉'))
      .then(() => setBusy(false))
  }

  const count = Number(data?.count ?? 0)
  const notes = Array.isArray(last?.notes)
    ? last.notes
    : Array.isArray(data?.notes)
      ? data.notes
      : []
  const overridden = (data?.items ?? []).filter((row) => row.overridden)

  return h(
    Card,
    {
      title: '这本书自己的阈值',
      className: 'nw-lint-cal',
      extra: h(
        'span',
        { className: 'nw-card-badge' },
        count ? `${count} 条已按本书调整` : '按全局阈值判',
      ),
    },
    h(
      'p',
      { className: 'nw-hint nw-lint-cal-lead' },
      count
        ? `这本书已经量过 ${data?.samples ?? 0} 章 /${data?.chars ?? 0} 字，有 ${count} 条规则改用了本书量出来的数值。`
        : '现在用的是全局阈值——那是从别的书校准出来的。量一遍本书已写的正文，能把这把秤调成适合这本的。',
    ),

    h(
      'div',
      { className: 'nw-lint-cal-acts' },
      h(
        Btn,
        { kind: 'primary', small: true, onClick: run, disabled: busy },
        busy ? '量着呢…' : count ? '重新量一遍' : '按这本书量一遍',
      ),
      count
        ? h(Btn, { kind: 'ghost', small: true, onClick: clear, disabled: busy }, '回到全局阈值')
        : null,
      overridden.length
        ? h(
            'button',
            {
              type: 'button',
              className: 'nw-lint-cal-more',
              'aria-expanded': open ? 'true' : 'false',
              onClick: () => setOpen((v) => !v),
            },
            open ? '收起明细 ▲' : `看是哪 ${overridden.length} 条改过 〉`,
          )
        : null,
    ),

    open && overridden.length
      ? h(
          'div',
          { className: 'nw-lint-cal-list' },
          overridden.map((row) =>
            h(
              'div',
              { className: 'nw-lint-cal-row', key: row.id },
              h('span', { className: 'nw-lint-cal-name' }, row.label),
              h(
                'span',
                { className: 'nw-lint-cal-num' },
                `全局 ${row.threshold?.perKilo ?? '—'}` +
                  `　→　本书 ${row.threshold?.perKilo ?? '—'}`,
              ),
            ),
          ),
        )
      : null,

    notes.length
      ? h(
          'details',
          { className: 'nw-lint-about' },
          h('summary', null, `量出来的结论（${notes.length} 条）`),
          ...notes.slice(0, 30).map((note, index) =>
            h(
              'p',
              {
                className: `nw-hint nw-lint-cal-note nw-lint-cal-${note.level}`,
                key: `n${index}`,
              },
              note.text,
            ),
          ),
        )
      : null,
  )
}

/**
 * 硬拦弹窗：chater.save 被服务端拒了之后弹出来。
 *
 * 为什么不是一个 toast：正文明明一个字没存进去，只飘一句提示，
 * 用户下一眼就看不见了 —— 然后以为存好了，关掉窗口，白写。
 * 所以这里要「挡住 + 逐条列 + 给两条明确出路（去改 / 我就是要存）」。
 */
function LintBlockModal({ error, onFix, onForce, onClose }) {
  const blocking = Array.isArray(error?.details?.blocking) ? error.details.blocking : []
  // 被拦下来这一刻最该看判据：他不是想知道「哪错了」，是「凭什么」。
  const [whyKey, setWhyKey] = useState('')
  return h(
    Modal,
    {
      title: '存不进去 · 正文有硬伤',
      onClose,
      footer: h(
        'div',
        { className: 'nw-lint-modal-foot' },
        h(Btn, { kind: 'ghost', onClick: onClose }, '先放着'),
        h(Btn, { kind: 'danger', onClick: onForce }, '我知道，强行存'),
        h(Btn, { kind: 'primary', onClick: onFix }, '去改'),
      ),
    },
    h('p', { className: 'nw-lint-modal-lead' }, error?.message ?? '服务端拒了这次保存。'),
    blocking.length
      ? h(
          'div',
          { className: 'nw-lint-list' },
          blocking.map((hit, index) =>
            h(LintHit, {
              hit,
              key: `${hit.id}-${index}`,
              open: whyKey === `modal-${hit.id}-${index}`,
              onToggleWhy: () =>
                setWhyKey((prev) =>
                  prev === `modal-${hit.id}-${index}` ? '' : `modal-${hit.id}-${index}`,
                ),
              onJump: () => onFix?.(hit),
            }),
          ),
        )
      : null,
    h(
      'p',
      { className: 'nw-hint' },
      '「强行存」会原样落盘，界面上仍然标红 —— 留给导旧稿、修标点这种确实要绕过的场合。',
    ),
  )
}
