/**
 * 长夜 · 驾驶舱
 *
 * 一屏回答「今天干什么」：三个大数字 + 欠账清单 + 最近产出 + 今日建议。
 */

/**
 * 大纲 → 进度条的卷分段。
 *
 * ProgressTrack 要的是 [{name, chapters, done}]，而大纲给的是
 * [{index,title,from,to,chapters:[{chapter,status}]}]。这里做一次转换，
 * 顺便把「已采纳」的章算成 done —— 进度条的分母是规划章数，分子是写完的。
 */
function outlineVolumes(outline, writtenChapters) {
  const volumes = Array.isArray(outline?.volumes) ? outline.volumes : []
  if (!volumes.length) {
    // 没大纲也能画：整本书当一段，进度按已写章数走。
    const total = Math.max(1, Number(writtenChapters) || 1)
    return [{ name: '全书', chapters: total, done: Number(writtenChapters) || 0 }]
  }
  return volumes.map((vol) => {
    const rows = Array.isArray(vol?.chapters) ? vol.chapters : []
    return {
      name: `第${vol.index ?? '?'}卷 · ${vol.title || '未命名'}`,
      chapters: Math.max(1, rows.length),
      done: rows.filter((row) => row.status === 'written').length,
    }
  })
}

/** 大纲里一共规划了多少回；没大纲就回 0，让调用方自己兜底。 */
function outlineTotal(outline) {
  const volumes = Array.isArray(outline?.volumes) ? outline.volumes : []
  return volumes.reduce((sum, vol) => sum + (Array.isArray(vol?.chapters) ? vol.chapters.length : 0), 0)
}

/**
 * 对齐简报：把「现在什么状况 / 最近在场的人 / 欠着什么 / 最近几回 / 下一步」
 * 压成一段可以直接交给 agent 的纯文本。
 *
 * 为什么不自动发给对话：发出去就是一次模型调用，会产生费用、会占上下文。
 * 而且大多数时候作者只是想确认「AI 到底知不知道我现在写到哪了」。
 * 所以这里先给看，要发再点。
 */
function BriefingCard({ projectId, toast }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState(null)

  const load = async () => {
    if (!projectId || busy) return
    setBusy(true)
    try {
      const value = await api('briefing.get', { projectId })
      setText(value.text ?? '')
      setMeta(value)
      setOpen(true)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast('简报已复制，粘到对话开头，agent 就知道你写到哪了')
    } catch {
      toast('复制失败，手动选中下面那段')
    }
  }

  return h(
    Card,
    {
      title: '对齐简报',
      extra: h(
        'div',
        { className: 'nw-actions' },
        h('span', { className: 'nw-card-badge' }, '给 AI 看的'),
        h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: load }, busy ? '正在汇总…' : open ? '重新生成' : '生成简报'),
      ),
    },
    h('p', { className: 'nw-hint' }, '一段纯文本：书写到哪、谁在场、欠什么、下一步该写哪一回。粘到对话开头用，比让 AI 自己翻文件准。'),
    open
      ? h(
        'div',
        { className: 'nw-brief' },
        meta ? h('div', { className: 'nw-hint' }, `${meta.chapters} 回 · ${fmtWords(meta.totalWords ?? 0)} · 最近第 ${meta.lastChapter} 回`) : null,
        h('pre', { className: 'nw-brief-text' }, text),
        h('div', { className: 'nw-actions' }, h(Btn, { small: true, kind: 'primary', onClick: copy }, '复制全文')),
      )
      : null,
  )
}

function DebtRow({ debt, onJump }) {
  const tone = debt.level === 'red' ? 'red' : debt.level === 'orange' ? 'amber' : debt.level === 'yellow' ? 'blue' : 'grey'
  return h(
    'button',
    { type: 'button', className: 'nw-debt', onClick: () => onJump?.(debt) },
    h('span', { className: `nw-debt-dot nw-dot-${debt.level}` }),
    h(
      'span',
      { className: 'nw-debt-main' },
      h('span', { className: 'nw-debt-title' }, debt.title),
      h('span', { className: 'nw-debt-sub' }, debt.sub),
    ),
    h(Tag, { tone }, debt.level === 'red' ? '必处理' : debt.level === 'orange' ? '该处理' : '待留意'),
    h('span', { className: 'nw-debt-go' }, '›'),
  )
}

function StatBox({ label, value, unit, hint, tone = 'amber', onClick }) {
  return h(
    'button',
    { type: 'button', className: `nw-stat nw-stat-${tone}`, onClick },
    h('span', { className: 'nw-stat-label' }, label),
    h('span', { className: 'nw-stat-value' }, value, unit ? h('em', null, unit) : null),
    hint ? h('span', { className: 'nw-stat-hint' }, hint) : null,
  )
}

// 【24 条 #4】今天的行动卡。
// 规则很死：先看红账 → 再看待验收 → 最后才谈继续写。让「今天干什么」永远有唯一答案，
// 而不是四个数字摆在那里让人自己权衡。
function ActionCard({ stats, debts, go, toast }) {
  const red = debts.find((row) => row.level === 'red')
  const pending = stats.pending ?? 0
  const first = red || debts[0] || null

  let title
  let sub
  let label
  let action

  if (first) {
    title = `先处理第 ${first.target?.chapter ?? 1} 回${first.target?.chapter ? '（该章有硬伤）' : ''}`
    sub = first.title || first.sub || '这条欠账会一路带着往下写，越拖越难改。'
    label = '去改这一章 →'
    action = () => go(first.target?.page || 'review', first.target)
  } else if (pending) {
    title = `有 ${pending} 章在等你拍板`
    sub = '验收是所有活儿汇合的地方：不拍板，队列就堵在这里。'
    label = '去验收台 →'
    action = () => go('review')
  } else {
    title = '今天没有欠账，可以往下写'
    sub = '世界状态干净、队列空着，适合推主线或补伏笔。'
    label = '排一单 →'
    action = () => go('studio')
  }

  return h(
    'div',
    { className: `nw-action${first ? ' nw-action-warn' : ''}` },
    h(
      'div',
      { className: 'nw-action-main' },
      h('span', { className: 'nw-action-cap' }, '今天干什么'),
      h('h3', { className: 'nw-action-title' }, title),
      h('p', { className: 'nw-action-sub' }, sub),
    ),
    h(Btn, { kind: 'primary', onClick: action }, label),
    h(Btn, {
      kind: 'ghost',
      small: true,
      onClick: () => toast('演示：会按「红账 → 待验收 → 队列」重排一遍优先级'),
    }, '换一个建议'),
  )
}

function CockpitPage({ projectId, project, go, toast, refreshKey }) {
  const ov = useAsync(() => api('overview', { projectId }), [projectId, refreshKey], { skip: !projectId })
  // 大纲只为了给进度条分段（哪几章属于哪一卷）。读一份本地 json，不贵。
  const ol = useAsync(() => api('outline.get', { projectId }), [projectId, refreshKey], { skip: !projectId })

  if (!projectId) {
    return h(Empty, null, '还没有作品，去「设置 → 作品数据」新建一部。')
  }
  if (ov.loading && !ov.data) return h(Loading, null)
  if (ov.error) return h(ErrorBox, { error: ov.error, onRetry: ov.reload })

  const data = ov.data
  const stats = data.stats || {}
  const debts = data.debts || []
  const red = debts.filter((row) => row.level === 'red').length

  // 【12 条 #4】进度条接真数：以前这里写死 MOCK.progress（12840/60000、第 6/30 回），
  // 不管作者写到第几章都显示同一根条。现在字数取 stats.totalWords、目标取作品的
  // targetWords、章数取 stats.chapters，卷分段取大纲的 volumes。
  const targetWords = Number(stats.targetWords ?? project?.targetWords ?? 0) || Number(stats.totalWords ?? 0) || 1
  const progress = {
    words: Number(stats.totalWords ?? 0),
    target: targetWords,
    chapter: Number(stats.chapters ?? 0),
    total: Math.max(Number(stats.chapters ?? 0), outlineTotal(ol.data?.outline)),
  }
  const volumes = outlineVolumes(ol.data?.outline, stats.chapters)

  const jump = (debt) => {
    const target = debt?.target || {}
    if (target.page) go(target.page, target)
    else toast('这条欠账还没有直达入口')
  }

  return h(
    'div',
    { className: 'nw-page nw-cockpit' },
    h(
      'div',
      { className: 'nw-hero' },
      h(
        'div',
        { className: 'nw-hero-left' },
        h('h2', null, data.project?.name || '未命名'),
        h(
          'div',
          { className: 'nw-hero-tags' },
          data.project?.genre ? h(Tag, { tone: 'amber' }, data.project.genre) : null,
          h(Tag, { tone: red ? 'red' : 'green' }, red ? `${red} 条红账` : '没有红账'),
          h(Tag, { tone: 'grey' }, `质检门槛 ${data.project?.qualityGate ?? 70}`),
        ),
      ),
      h(
        'div',
        { className: 'nw-hero-right' },
        h(Btn, { kind: 'primary', onClick: () => go('studio') }, '▶ 一键开工'),
        h(Btn, { kind: 'ghost', onClick: () => go('review') }, '去验收台'),
      ),
    ),
    // 【24 条 #4】一句大白话 + 一个直接执行的按钮。
    // 把「今天该先干什么」从一行灰字升级成整宽行动卡：动词 + 对象 + 分数 + 一个出口。
    h(ActionCard, { stats, debts, go, toast }),
    // 【24 条 #6】全书进度条：字数 / 章数 / 卷分割。
    h(ProgressTrack, { progress, volumes, toast }),
    h(
      'div',
      { className: 'nw-stats' },
      h(StatBox, {
        label: '待验收',
        value: stats.pending ?? 0,
        unit: '章',
        hint: (stats.pending ?? 0) ? '等你拍板' : '清空了',
        tone: (stats.pending ?? 0) ? 'amber' : 'green',
        onClick: () => go('review'),
      }),
      h(StatBox, {
        label: '队列中',
        value: stats.queued ?? 0,
        unit: '章',
        hint: (stats.running ?? 0) ? `${stats.running} 章在跑` : '空闲',
        tone: (stats.queued ?? 0) ? 'teal' : 'green',
        onClick: () => go('studio'),
      }),
      h(StatBox, {
        label: '欠账',
        value: debts.length,
        unit: '条',
        hint: red ? `${red} 条红账` : '干净',
        tone: red ? 'red' : 'green',
      }),
      h(StatBox, {
        label: '今日字数',
        value: fmtWords(stats.writeToday ?? 0),
        hint: `目标 ${fmtWords(stats.targetWords ?? 2500)}`,
        tone: 'blue',
        onClick: () => go('studio'),
      }),
    ),
    h(
      'div',
      { className: 'nw-cols' },
      h(
        Card,
        {
          title: '欠账清单',
          extra: h('span', { className: 'nw-card-badge' }, `${debts.length} 条`),
          className: 'nw-card-debt',
        },
        debts.length
          ? h('div', { className: 'nw-debt-list' }, debts.map((debt, index) => h(DebtRow, { debt, key: `${debt.kind}-${index}`, onJump: jump })))
          : h(Empty, null, '没有欠账。世界状态干净，可以放心往下写。'),
      ),
      h(
        'div',
        { className: 'nw-col-side' },
        h(
          Card,
          { title: '今日建议' },
          // 【24 条 #5】两周柱状图住在「今日建议」卡顶部：趋势比单日数字更能说明问题。
          // 服务端 overview 现在按每章 updatedAt 的本地日期分桶回 stats.dailyWords
          // （见 lib/store.js dailyWordsFor）。有真数据就用真数据，没有才退回演示曲线 ——
          // 界面先长出来是对的，但一直用假曲线会让人以为自己在断更。
          h(DayBars, {
            days: Array.isArray(stats.dailyWords) && stats.dailyWords.length
              ? stats.dailyWords.map((row) => ({ d: String(row.day ?? '').slice(5), w: Number(row.words) || 0 }))
              : MOCK.days,
            target: stats.targetWords ?? 2500,
            toast,
          }),
          h('p', { className: 'nw-suggest' }, data.suggestion || '先建作品，再开工。'),
          h(
            'div',
            { className: 'nw-meta-grid' },
            h('span', null, `已采纳 ${stats.accepted ?? 0} 章`),
            h('span', null, `均分 ${stats.avgScore ?? 0}`),
            h('span', null, `总字数 ${fmtWords(stats.totalWords ?? 0)}`),
            h('span', null, `连更 ${stats.streak ?? 0} 天`),
            h('span', null, `累计花费 ${fmtCost(stats.totalCost ?? 0)}`),
            h('span', null, `未回收伏笔 ${data.unclosedForeshadow ?? 0}`),
          ),
        ),
        h(
          Card,
          { title: '最近产出' },
          (data.recent || []).length
            ? h(
              'div',
              { className: 'nw-recent' },
              (data.recent || []).map((row) => h(
                'button',
                {
                  type: 'button',
                  className: 'nw-recent-row',
                  key: row.chapter,
                  onClick: () => go('review', { chapter: row.chapter }),
                },
                h('span', { className: 'nw-recent-n' }, `第 ${row.chapter} 回`),
                h('span', { className: 'nw-recent-title' }, row.title || ''),
                h(Tag, { tone: STATUS_TONE[row.status] || 'grey' }, STATUS_LABEL[row.status] || row.status),
                h('span', { className: `nw-recent-score nw-score-${scoreTone(row.score)}` }, row.score || '—'),
              )),
            )
            : h(Empty, null, '还没写过章节。'),
        ),
        // 简报是「把当前状态说给 AI 听」的出口：写完这段粘到对话开头，
        // 比让模型自己翻一堆文件去拼上下文稳。
        h(BriefingCard, { projectId, toast }),
      ),
    ),
  )
}
