/**
 * 长夜 · 设置
 *
 * 四块：作品数据 / 模型预算 / 写作偏好 / 界面。
 */

/**
 * 成本卡：读 DSH 自己的会话日志，按真实 token 数算钱。
 *
 * 为什么不做「估算器」而做「读日志」：估算是拍脑袋，日志是既成事实。
 * 会话目录按 cwd 匹配，所以只在「这个项目是在某个工作目录里开的会话」时才有数；
 * 匹配不到就明说没找到，不假装 0 元。
 */
function CostCard({ projectId, toast }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState({ chapters: 100, chapterWords: 3000, model: 'deepseek-chat' })
  const [budget, setBudget] = useState(null)

  const scan = async () => {
    if (!projectId) {
      toast('先选一个作品')
      return
    }
    setBusy(true)
    try {
      const out = await api('usage.scan', { projectId })
      setData(out)
      toast(out.note)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const estimate = async () => {
    setBusy(true)
    try {
      const out = await api('usage.budget', {
        chapters: Number(plan.chapters) || 0,
        chapterWords: Number(plan.chapterWords) || 0,
        model: plan.model,
      })
      setBudget(out)
      toast(`按这个计划大约 ${fmtCost(out.cost)}`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const total = data?.total ?? { turns: 0, steps: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
  const sessions = data?.sessions ?? []

  return h(
    Card,
    {
      title: '花多少钱了',
      extra: h(
        'div',
        { className: 'nw-actions' },
        h(Btn, { small: true, kind: 'ghost', disabled: busy || !projectId, onClick: scan }, busy ? '读着…' : '读会话日志'),
        h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: estimate }, '算预算'),
      ),
    },
    h(Hint, null, '不是估算：直接读 DSH 的会话日志，把输入输出 token 按公开单价折成人民币。会话记在别的目录就匹配不到，会明说没找到。'),

    data
      ? h('div', { className: 'nw-cost-total' }, [
        h('div', { key: 'c', className: 'nw-cost-num' }, fmtCost(total.cost)),
        h('div', { key: 'd', className: 'nw-cost-desc' }, `${total.turns} 轮 / ${total.steps} 步 / ${total.toolCalls} 次工具调用 · 输入 ${fmtWords(total.inputTokens)} token、输出 ${fmtWords(total.outputTokens)} token`),
      ])
      : h('p', { className: 'nw-hint' }, data === null ? '还没读。' : ''),

    sessions.length
      ? h(
        'div',
        { className: 'nw-cost-list' },
        ...sessions.slice(0, 8).map((row) => h(
          'div',
          { key: row.sessionId, className: 'nw-cost-row' },
          h('span', { className: 'nw-cost-name' }, String(row.sessionId).slice(0, 8)),
          h('span', { className: 'nw-cost-meta' }, `${row.turns} 轮 · ${fmtWords(row.inputTokens)} 入 / ${fmtWords(row.outputTokens)} 出`),
          h('span', { className: 'nw-cost-money' }, fmtCost(row.cost)),
        )),
      )
      : null,

    h(
      'div',
      { className: 'nw-form-grid' },
      h(Field, { label: '计划写几章' }, h(Input, {
        type: 'number', value: plan.chapters, onChange: (v) => setPlan({ ...plan, chapters: Number(v) || 0 }),
      })),
      h(Field, { label: '每章多少字' }, h(Input, {
        type: 'number', value: plan.chapterWords, onChange: (v) => setPlan({ ...plan, chapterWords: Number(v) || 0 }),
      })),
      h(Field, { label: '用哪个模型' }, h(Select, {
        value: plan.model,
        onChange: (v) => setPlan({ ...plan, model: v }),
        options: [
          { value: 'deepseek-v4.1-flash', label: 'flash（便宜）' },
          { value: 'deepseek-chat', label: 'chat（贵些）' },
        ],
      })),
    ),
    budget
      ? h('div', { className: 'nw-cost-budget' }, [
        h(KV, {
          key: 'kv',
          rows: [
            ['预计总字数', `${fmtWords(budget.totalWords ?? 0)} 字`],
            ['预计 token', `${fmtWords(budget.totalTokens ?? 0)}（入 ${fmtWords(budget.inputTokens ?? 0)} / 出 ${fmtWords(budget.outputTokens ?? 0)}）`],
            ['预计花费', fmtCost(budget.cost ?? 0)],
            ['摊到每章', budget.chapters ? fmtCost(Number(budget.cost ?? 0) / budget.chapters) : '—'],
          ],
        }),
        h('p', { key: 'n', className: 'nw-hint' }, budget.note ?? ''),
      ])
      : null,
  )
}

/**
 * 写策略卡：原生写工具（write / edit）落到哪些目录该被拦。
 *
 * 为什么需要开关而不是一律拦死：模型偶尔就是要直接改设定卡、补一份岗位手册。
 * 一律拦死会逼人去关整个守卫；给几个勾，代价小得多。
 * 三档里 off 是一刀切（连提醒都不给），enforce 才是真拦。
 */
function WritePolicyCard({ projectId, project, toast, onRefresh }) {
  const policy = (project?.settings?.writePolicy && typeof project.settings.writePolicy === 'object')
    ? project.settings.writePolicy
    : {}
  const level = ['off', 'warn', 'enforce'].includes(String(policy.level)) ? String(policy.level) : 'warn'
  const [busy, setBusy] = useState(false)

  const save = async (patch) => {
    if (!projectId) {
      toast('先选一个作品')
      return
    }
    setBusy(true)
    try {
      await api('project.save', {
        projectId,
        patch: { settings: { writePolicy: { ...policy, ...patch } } },
      })
      onRefresh?.()
      toast('写策略已保存')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const LEVELS = [
    { value: 'off', label: '不管', hint: '原生 write/edit 改什么都不提醒' },
    { value: 'warn', label: '提醒', hint: '默认。改完给你一条提示，不拦' },
    { value: 'enforce', label: '拦住', hint: '必须走 nightwrite_op，绕不过去' },
  ]
  const DIRS = [
    { flag: 'allowChapter', label: '正文 chapters/' },
    { flag: 'allowLedger', label: '账本 ledger/' },
    { flag: 'allowFacts', label: '设定卡 facts/' },
    { flag: 'allowOutline', label: '大纲 outlines/' },
    { flag: 'allowSkills', label: '手册 agents/ 与 skills/' },
  ]

  return h(
    Card,
    {
      title: '原生写工具守卫',
      extra: h(Tag, { tone: level === 'enforce' ? 'red' : (level === 'warn' ? 'amber' : 'grey') }, level),
    },
    h(Hint, null, '宿主自带的 write / edit 直接改文件时，这条守卫会读到改动、算一遍 AI 味和保真度再提醒你。只有「拦住」这一档才真的拒绝写入——拒绝会告诉模型改用 nightwrite_op，它不会卡死。'),
    h(
      'div',
      { className: 'nw-policy-row' },
      ...LEVELS.map((row) => h(
        'button',
        {
          type: 'button',
          key: row.value,
          className: `nw-policy-card nw-policy-${row.value}${level === row.value ? ' on' : ''}`,
          disabled: busy,
          onClick: () => save({ level: row.value }),
        },
        h('span', { className: 'nw-policy-name' }, row.label),
        h('span', { className: 'nw-policy-hint' }, row.hint),
      )),
    ),
    level === 'enforce'
      ? h(
        'div',
        { className: 'nw-policy-dirs' },
        ...DIRS.map((row) => h(
          'label',
          { key: row.flag, className: 'nw-policy-dir' },
          h('input', {
            type: 'checkbox',
            checked: policy[row.flag] !== false,
            disabled: busy,
            onChange: (event) => save({ [row.flag]: event.target.checked }),
          }),
          h('span', null, row.label),
        )),
      )
      : h('p', { className: 'nw-hint' }, '只有「拦住」这一档才需要指定哪些目录不许直接改。'),
  )
}

/**
 * 【12 条 #8】AI 味词表编辑器。
 *
 * 为什么值得一个独立卡片：验收台那条彩带是从这里扫出来的。
 * 以前词表是 store 里的模块常量，你写「微微」「缓缓」写了一百万字，
 * 它永远扫不出来，因为它只认通用那二十来条。
 * 现在两件事都能做：加你自己的口头禅、停用你不认的条目。
 */
/**
 * 【P5】写作原则条：这本书的一句话铁律。
 *
 * LNW 顶栏下面钉着一条 `⚡ ATTENTION IS ALL YOU NEED —— 怎么吸引读者怎么来…`。
 * 它有用：模型每一轮都看得见，于是不会写着写着滑回「交代背景」。
 * 它的问题是写死的 —— 你写的是慢热群像，它还在催你三章一个大转折。
 *
 * 长夜把它做成每本书一份、可改、并且真的往下传：
 *   · 存在 project.settings.writePrinciple
 *   · 顶栏下面一条可折叠的黄条常显当前生效的那句
 *   · 派单时自动插到工作单的第一行（见 src/30-studio.js 的 dispatch）
 *
 * 空着就不显示、也不注入 —— 不写原则本身也是一种选择。
 */
const PRINCIPLE_DEFAULT = '怎么吸引读者怎么来：每段都要给一个新信息或一次情绪变化；不总结、不铺垫、不解释。'

function WritePrincipleCard({ projectId, project, toast, onRefresh }) {
  const saved = String(project?.settings?.writePrinciple ?? '')
  const [text, setText] = useState(saved)
  const [busy, setBusy] = useState(false)

  // 切作品的时候要把输入框换成新书那一句，否则会把上一本的原则存到这一本。
  useEffect(() => {
    setText(String(project?.settings?.writePrinciple ?? ''))
  }, [projectId, saved])

  const save = async (next) => {
    if (!projectId) {
      toast('先选一个作品')
      return
    }
    setBusy(true)
    try {
      await api('project.save', {
        projectId,
        patch: { settings: { writePrinciple: String(next ?? '').trim() } },
      })
      onRefresh?.()
      toast(next ? '写作原则已保存，下次派单会自动带上' : '写作原则已清空，派单不再注入')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    {
      title: '写作原则',
      extra: h(Tag, { tone: saved ? 'amber' : 'grey' }, saved ? '生效中' : '没设'),
    },
    h(Hint, null, '一句话说清这本书的铁律。它会显示在顶栏下方，并且自动插到每张工作单的第一行 —— 让模型每一轮都看得见，而不是只在开书那天说过一次。'),
    h(Field, { label: '这一本的原则' }, h(TextArea, {
      value: text,
      rows: 3,
      onChange: setText,
      placeholder: PRINCIPLE_DEFAULT,
    })),
    h(
      'div',
      { className: 'nw-actions' },
      h(Btn, { small: true, kind: 'primary', onClick: () => save(text), disabled: busy }, busy ? '保存中…' : '保存'),
      h(Btn, { small: true, kind: 'ghost', onClick: () => { setText(PRINCIPLE_DEFAULT); save(PRINCIPLE_DEFAULT) }, disabled: busy }, '用推荐那句'),
      saved ? h(Btn, { small: true, kind: 'ghost', onClick: () => { setText(''); save('') }, disabled: busy }, '清空') : null,
      h('span', { className: 'nw-hint' }, '留空 = 不注入，界面也不显示这条。'),
    ),
  )
}

function AiLexiconCard({ projectId, toast }) {
  const res = useAsync(() => api('aistyle.get', { projectId }), [projectId], { skip: !projectId })
  const [phrase, setPhrase] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const items = res.data?.items ?? []
  const disabled = res.data?.disabled ?? []
  const custom = res.data?.custom ?? []

  const save = async (patch) => {
    setBusy(true)
    try {
      await api('aistyle.save', { projectId, ...patch })
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const word = phrase.trim()
    if (!word) {
      toast('先写一个要盯的词')
      return
    }
    if (items.some((row) => row.pattern === word)) {
      toast('这条已经在词表里了')
      return
    }
    save({ custom: [...custom, { phrase: word, hint: hint.trim() }] })
    setPhrase('')
    setHint('')
    toast(`已加入词表：${word}（下一章验收就会扫到）`)
  }

  const toggle = (pattern, off) => {
    const next = off ? [...disabled, pattern] : disabled.filter((row) => row !== pattern)
    save({ disabled: next })
  }

  const drop = (pattern) => {
    save({ custom: custom.filter((row) => row.phrase !== pattern) })
    toast(`已从词表删掉：${pattern}`)
  }

  return h(
    Card,
    {
      title: 'AI 味词表',
      extra: res.loading ? null : h(Tag, { tone: 'grey' }, `生效 ${items.length} 条`),
    },
    h('p', { className: 'nw-hint' }, '验收台右侧那条彩带就是拿这张表扫出来的。默认表是通用 AI 套话；你把反复用的词加进来，扫出来的才是「你的」毛病。'),
    res.error ? h(ErrorBox, { error: res.error, onRetry: res.reload }) : null,
    h(
      'div',
      { className: 'nw-lex-add' },
      h(Input, { value: phrase, placeholder: '要盯的词，比如「缓缓」', onChange: setPhrase }),
      h(Input, { value: hint, placeholder: '为什么烦它（可不填）', onChange: setHint }),
      h(Btn, { kind: 'primary', small: true, onClick: add, disabled: busy || !projectId }, '＋ 加入词表'),
    ),
    h(
      'div',
      { className: 'nw-lex-list' },
      items.length
        ? items.map((row) => {
          const off = disabled.includes(row.pattern)
          return h(
            'div',
            { className: `nw-lex-row${off ? ' nw-lex-off' : ''}`, key: `${row.source}:${row.pattern}` },
            h('span', { className: 'nw-lex-word' }, row.pattern),
            h('span', { className: 'nw-hint' }, row.hint || '（没写原因）'),
            row.source === 'custom' ? h(Tag, { tone: 'blue' }, '你自己加的') : null,
            h(
              'span',
              { className: 'nw-lex-acts' },
              h(Btn, { small: true, kind: 'ghost', onClick: () => toggle(row.pattern, !off), disabled: busy }, off ? '↺ 启用' : '停用'),
              row.source === 'custom'
                ? h(Btn, { small: true, kind: 'danger', onClick: () => drop(row.pattern), disabled: busy }, '删除')
                : null,
            ),
          )
        })
        : h(Empty, null, '词表是空的。默认表被全部停用了？上面加一条就回来。'),
    ),
    h(Hint, null, '停用不是删除：默认条目停用后还在这里，随时能开回来；自定义条目删掉才真没了。'),
  )
}

/**
 * 【阶段 B】语料池。
 *
 * 为什么这块要露在设置里：它量的是「真人写作时这些规则多久出现一次」，
 * 用来给检测器定阈值。没有它，所有阈值都是拍的。
 * 一本书只按内容哈希收一次；收够 3 本才给分位数，不够就明说别当真。
 */
function CorpusCard({ toast }) {
  const res = useAsync(() => api('corpus.list'), [])
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [source, setSource] = useState('self')
  const [busy, setBusy] = useState(false)
  const [derived, setDerived] = useState(null)

  const totals = res.data?.totals ?? { books: 0, chapters: 0, chars: 0, gap: 5584, booksNeeded: 26, progress: 0, bySource: {} }
  const books = res.data?.books ?? []

  const add = async () => {
    if (!text.trim()) {
      toast('先把正文粘进来')
      return
    }
    setBusy(true)
    try {
      const done = await api('corpus.add', { name: name.trim() || `未命名 ${books.length + 1}`, text, source })
      toast(done.message)
      setText('')
      setName('')
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const derive = async () => {
    setBusy(true)
    try {
      const out = await api('corpus.thresholds', { minBooks: 3 })
      setDerived(out)
      toast(out.summary)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const drop = async (id, label) => {
    setBusy(true)
    try {
      await api('corpus.remove', { id })
      toast(`已从池子里移出《${label}》`)
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    {
      title: '语料池（量阈值用）',
      extra: h(Tag, { tone: totals.books >= 3 ? 'green' : 'grey' }, `${totals.books} 本 / ${totals.chapters} 章`),
    },
    h(Hint, null, '检测器的阈值现在是我拍的。这块用你自己的稿子和公版书量出「真人写作时这条规则多久出现一次」，阈值才有依据。只存正文和统计，不存拆书结论。'),

    h(
      'div',
      { className: 'nw-corpus-bar' },
      h('div', { className: 'nw-corpus-fill', style: { width: `${Math.round((totals.progress ?? 0) * 100)}%` } }),
    ),
    h(
      'div',
      { className: 'nw-corpus-nums' },
      h('span', null, `目标 ${totals.target ?? 5584} 章（对齐公开拆书语料的统计量级）`),
      h('span', null, totals.gap > 0 ? `还差 ${totals.gap} 章，约 ${totals.booksNeeded} 本 200 章的书` : '统计量级已够'),
    ),

    books.length
      ? h(
        'div',
        { className: 'nw-corpus-list' },
        books.map((row) => h(
          'div',
          { className: 'nw-corpus-row', key: row.id },
          h('span', { className: 'nw-corpus-name' }, row.name),
          h(Tag, { tone: row.source === 'self' ? 'green' : row.source === 'public' ? 'blue' : 'grey' }, row.source === 'self' ? '自己写的' : row.source === 'public' ? '公版' : '已授权'),
          h('span', { className: 'nw-corpus-meta' }, `${row.chapters} 章 · ${fmtWords(row.chars)}`),
          h('button', { type: 'button', className: 'nw-icon-btn', title: '移出池子', onClick: () => drop(row.id, row.name) }, '✕'),
        )),
      )
      : h(Empty, null, '池子是空的。先把你正在写的这本书的原文粘进来——自己的语体最值钱。'),

    h(
      'div',
      { className: 'nw-corpus-add' },
      h(Input, { value: name, onChange: (e) => setName(e.target.value ?? ''), placeholder: '书名（可留空）' }),
      h(Select, {
        value: source,
        onChange: (e) => setSource(e.target.value ?? 'self'),
        options: [
          { value: 'self', label: '自己写的' },
          { value: 'public', label: '公版书' },
          { value: 'owned', label: '已授权' },
        ],
      }),
    ),
    h(TextArea, {
      value: text,
      onChange: (e) => setText(e.target.value ?? ''),
      rows: 5,
      placeholder: '把整本正文粘进来（会自动切章）。只用来统计，不会出现在任何导出里。',
    }),
    h(
      'div',
      { className: 'nw-actions' },
      h(Btn, { kind: 'primary', small: true, disabled: busy, onClick: add }, busy ? '收着…' : '收进池子'),
      h(Btn, { small: true, disabled: busy || totals.books < 1, onClick: derive }, '量一遍阈值'),
    ),

    derived
      ? h(
        'div',
        { className: 'nw-corpus-out' },
        h('div', { className: 'nw-corpus-sum' }, derived.summary),
        derived.rules.filter((r) => r.enough).length
          ? h(
            'div',
            { className: 'nw-corpus-th' },
            derived.rules.filter((r) => r.enough).slice(0, 12).map((r) => h(
              'div',
              { className: `nw-corpus-th-row${r.noisy ? ' nw-corpus-th-noisy' : ''}`, key: r.id },
              h('span', { className: 'nw-corpus-th-name' }, r.label),
              h('span', { className: 'nw-corpus-th-num' }, `语料 p90 ${r.p90}/千字`),
              h('span', { className: 'nw-corpus-th-num' }, `现在 ${r.current || '—'}`),
              r.noisy ? h(Tag, { tone: 'amber' }, '会天天报警') : null,
            )),
          )
          : null,
      )
      : null,
  )
}

function SettingsPage({
  projectId, project, projects, chapters, onSwitch, onNewProject, toast, onRefresh, theme, setTheme,
}) {
  const [draft, setDraft] = useState(null)
  const [confirm, setConfirm] = useState('')
  const [exporting, setExporting] = useState(false)
  const chaptersCount = Array.isArray(chapters) ? chapters.length : 0
  // 回收站要能看见，否则「删了还能找回」只是一句话。
  const trash = useAsync(() => api('chapter.trash', { projectId }), [projectId], { skip: !projectId })

  useEffect(() => {
    setDraft(project ? { ...project } : null)
  }, [project])

  const saveProject = async () => {
    if (!projectId || !draft) return
    try {
      await api('project.save', {
        projectId,
        patch: {
          name: draft.name,
          genre: draft.genre,
          logline: draft.logline,
          targetWords: Number(draft.targetWords) || 2500,
          qualityGate: Number(draft.qualityGate) || 70,
          monthlyBudget: Number(draft.monthlyBudget) || 600,
        },
      })
      onRefresh?.()
      toast('已保存')
    } catch (error) {
      toast(error.message)
    }
  }

  const remove = async () => {
    if (!projectId) return
    if (confirm !== (project?.name ?? '')) {
      toast('书名不一致，没有删除')
      return
    }
    try {
      await api('project.delete', { projectId })
      setConfirm('')
      onRefresh?.()
      toast('已删除')
    } catch (error) {
      toast(error.message)
    }
  }

  return h(
    'div',
    { className: 'nw-page nw-settings' },
    h(
      Card,
      // 【P0】这里原来挂一个「新建作品」弹窗（5 个字段），和建书首屏、大纲页
      // 三处都在写同一份东西。建书收敛成屏内三步向导之后，弹窗删掉，按钮改成
      // 跳回那一屏 —— 入口从三个变成一个，少一套会跟别处对不上的表单。
      { title: '作品数据', extra: h(Btn, { small: true, kind: 'primary', onClick: () => onNewProject?.() }, '＋ 新建作品') },
      h(
        'div',
        { className: 'nw-proj-list' },
        projects.length
          ? projects.map((row) => h(
            'button',
            {
              type: 'button',
              key: row.id,
              className: `nw-proj${row.id === projectId ? ' on' : ''}`,
              onClick: () => onSwitch?.(row.id),
            },
            h('span', { className: 'nw-proj-name' }, row.name),
            h('span', { className: 'nw-proj-meta' }, `${row.chapters} 章 · ${fmtWords(row.words)} 字`),
            row.id === projectId ? h(Tag, { tone: 'amber' }, '当前') : null,
          ))
          : h(Empty, null, '还没有作品。'),
      ),
      draft
        ? h(
          Fragment,
          null,
          h('div', { className: 'nw-form-grid' },
            h(Field, { label: '书名' }, h(Input, { value: draft.name, onChange: (v) => setDraft({ ...draft, name: v }) })),
            h(Field, { label: '题材' }, h(Input, { value: draft.genre, onChange: (v) => setDraft({ ...draft, genre: v }) })),
            h(Field, { label: '每章目标字数' }, h(Input, {
              type: 'number',
              value: draft.targetWords,
              onChange: (v) => setDraft({ ...draft, targetWords: v }),
            })),
            h(Field, { label: '质检门槛（分）' }, h(Input, {
              type: 'number',
              value: draft.qualityGate,
              onChange: (v) => setDraft({ ...draft, qualityGate: v }),
            })),
            h(Field, { label: '月预算（元）' }, h(Input, {
              type: 'number',
              value: draft.monthlyBudget,
              onChange: (v) => setDraft({ ...draft, monthlyBudget: v }),
            })),
            h(Field, { label: '一句话卖点' }, h(Input, { value: draft.logline, onChange: (v) => setDraft({ ...draft, logline: v }) })),
          ),
          h('div', { className: 'nw-actions' }, h(Btn, { kind: 'primary', onClick: saveProject }, '保存作品设置')),
        )
        : null,
      h(
        'details',
        { className: 'nw-danger-zone' },
        h('summary', null, '危险区：删除这部作品'),
        h('p', { className: 'nw-hint' }, '目录会被整份删掉，无法撤销。输入书名确认。'),
        h(Input, { value: confirm, onChange: setConfirm, placeholder: project?.name ?? '' }),
        h(Btn, { kind: 'danger', onClick: remove }, '确认删除'),
      ),
    ),
    h(
      Card,
      { title: '模型与预算' },
      h(KV, {
        rows: [
          { key: '质检门槛', text: String(project?.qualityGate ?? 70) + ' 分' },
          { key: '每章目标', text: String(project?.targetWords ?? 2500) + ' 字' },
          { key: '月预算', text: `¥${project?.monthlyBudget ?? 600}` },
          { key: '数据根', text: '~/.dsh/data/dsh-nightwrite', mono: true },
        ],
      }),
      h(Hint, null, '预算与门槛存在 project.json 里；每次跑批前由 agent 读它做闸门。'),
    ),
    // 【24 条 #23】【12 条 #12】导出全部数据：以前只弹一句 toast，什么都没生成。
    // 现在真的打一个 zip：GET /nightwrite/api/export?projectId=... 回字节流，
    // 前端接成 blob 用 <a download> 落到下载目录。
    h(
      Card,
      {
        title: '导出全部数据',
        extra: h(Tag, { tone: 'green' }, '真打包'),
      },
      h('p', { className: 'nw-hint' }, '把这部作品的所有文件打成一个 zip：正文、账本、大纲、队列、提案、问题单、设置、历史版本、回收站。导出的就是磁盘上那棵目录，不带任何私有格式。'),
      h(
        'div',
        { className: 'nw-export-tree' },
        [
          ['chapters/', `${chaptersCount} 个 .txt 正文`, 'text'],
          ['chapters/history/', '历史版本（每章最近 20 版）', 'text'],
          ['chapters/.trash/', '回收站里删掉的章', 'text'],
          ['ledger.json', '八类账本', 'json'],
          ['outline.json', '卷纲与细纲', 'json'],
          ['queue.json', '工单队列', 'json'],
          ['proposals.json', 'AI 提案与拍板记录', 'json'],
          ['problems.json', '问题单', 'json'],
          ['project.json', '书名 / 门槛 / 预算', 'json'],
        ].map(([name, desc, kind]) => h(
          'div',
          { className: 'nw-export-row', key: name },
          h('span', { className: `nw-export-icon nw-export-${kind}` }, kind === 'text' ? '📄' : '{ }'),
          h('span', { className: 'nw-export-name' }, name),
          h('span', { className: 'nw-hint' }, desc),
        )),
      ),
      h(
        'div',
        { className: 'nw-actions' },
        h(Btn, {
          kind: 'primary',
          disabled: !projectId || exporting,
          onClick: async () => {
            if (!projectId || exporting) return
            setExporting(true)
            try {
              const base = String(bootInfo().apiUrl || ROUTE).replace(/\/+$/, '')
              const res = await fetch(`${base}/export?projectId=${encodeURIComponent(projectId)}`, {
                credentials: 'same-origin',
              })
              if (!res.ok) {
                // 失败时后端回的是 JSON 错误体，不是 zip。
                let message = `导出失败（HTTP ${res.status}）`
                try {
                  const data = await res.json()
                  message = data?.error?.message || message
                } catch {
                  /* 非 JSON，用默认文案 */
                }
                throw new Error(message)
              }
              const blob = await res.blob()
              const files = res.headers.get('x-nightwrite-files') ?? '?'
              const name = `${project?.name ?? projectId}-${new Date().toISOString().slice(0, 10)}.zip`
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = name
              a.rel = 'noopener'
              document.body.appendChild(a)
              a.click()
              a.remove()
              // 立刻 revoke 会让部分浏览器来不及开始下载，等一拍再放。
              setTimeout(() => URL.revokeObjectURL(url), 4000)
              toast(`已打包 ${files} 个文件 · ${(blob.size / 1024).toFixed(0)} KB，浏览器正在下载`)
            } catch (error) {
              toast(error.message)
            } finally {
              setExporting(false)
            }
          },
        }, exporting ? '打包中…' : '📦 打包成 zip 下载'),
        h(Btn, {
          kind: 'ghost',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(`~/.dsh/data/dsh-nightwrite/${projectId ?? '<作品>'}`)
              toast('已复制目录路径，直接去文件管理器里拷')
            } catch {
              toast('复制失败，手动去 ~/.dsh/data/dsh-nightwrite 拿')
            }
          },
        }, '复制目录路径'),
      ),
      h(Hint, null, '导出是纯读取，不改任何文件；打包失败也不会动正文。zip 用 store 模式（不压缩），几 MB，解开就是原文件。'),
    ),
    // 回收站：删章不再是永久删除。这里能看见删了什么、能还原。
    h(
      Card,
      {
        title: '回收站',
        extra: h('span', { className: 'nw-card-badge' }, `${trash.data?.items?.length ?? 0}`),
      },
      !projectId
        ? h(Empty, null, '还没有作品。')
        : trash.loading && !trash.data
          ? h(Loading, null)
          : (trash.data?.items ?? []).length
            ? h(
              'div',
              { className: 'nw-trash-list' },
              trash.data.items.map((row) => h(
                'div',
                { className: 'nw-trash-row', key: row.trash },
                h('span', { className: 'nw-trash-n' }, `第 ${row.chapter} 回`),
                h('span', { className: 'nw-trash-title' }, row.title),
                h('span', { className: 'nw-trash-w' }, `${row.words} 字`),
                h('span', { className: 'nw-hint nw-trash-at' }, `${String(row.at ?? '').slice(0, 8)} ${String(row.at ?? '').slice(9, 15)}`),
                h(Btn, {
                  small: true,
                  kind: 'ghost',
                  onClick: async () => {
                    try {
                      await api('chapter.recover', { projectId, trash: row.trash })
                      trash.reload()
                      onRefresh?.()
                      toast(`第 ${row.chapter} 回已还原`)
                    } catch (error) {
                      toast(error.message)
                    }
                  },
                }, '↩ 还原'),
                h(Btn, {
                  small: true,
                  kind: 'danger',
                  onClick: async () => {
                    try {
                      await api('chapter.purge', { projectId, trash: row.trash })
                      trash.reload()
                      toast('已彻底删除这一项')
                    } catch (error) {
                      toast(error.message)
                    }
                  },
                }, '彻底删除'),
              )),
            )
            : h(Empty, null, '回收站是空的。删章都会先进这里，可以还原。'),
      h(Hint, null, '删章只是移到 chapters/.trash/，正文和元数据都还在。还原时若原位置已有同名文件会报冲突，不会覆盖。'),
    ),
    h(
      Card,
      { title: '写作偏好' },
      h(Field, { label: '默认稿纸（场景分隔符）' }, h(Input, { value: '※', onChange: () => {} })),
      h(Hint, null, '场景分隔统一用 ※；正文一律纯文本，禁 Markdown —— 与写入门禁一致。'),
      // 【12 条 #2】自动保存开关：有人不喜欢它偷偷发请求，给个真的开关。
      h(
        Field,
        { label: '自动保存' },
        h(
          'div',
          { className: 'nw-actions' },
          h(Switch, {
            on: readLS(LS.autosave, '1') !== '0',
            onChange: (next) => {
              writeLS(LS.autosave, next ? '1' : '0')
              toast(next ? '自动保存已打开：停手 4 秒就落盘' : '自动保存已关，记得手动点保存')
              onRefresh?.()
            },
          }),
          h('span', { className: 'nw-hint' }, readLS(LS.autosave, '1') !== '0' ? '停手 4 秒落盘一次' : '关着，切页前会拦你一次'),
        ),
      ),
    ),
    // 【LNW 差异】导出成书 + 检查更新：交给外面的人看之前，先把稿子做成一本真的书。
    h(BookExport, { projectId, project, toast }),
    h(UpdateCard, { toast }),
    // 【12 条 #8】AI 味词表：以前是模块常量，扫出来的全是「通用 AI 味」，
    // 扫不到你自己反复用的那几句。现在能加、能停用。
    h(AiLexiconCard, { projectId, toast }),
    // 【阶段 B】语料池：阈值从自己的样本里量，不从感觉里拍。
    h(CorpusCard, { toast }),
    // 【gap 第 7 条】花了多少钱：不是估算，读会话日志。
    h(CostCard, { projectId, toast }),
    // 【P5】写作原则：这本书的铁律，派单时自动插到工作单第一行。
    h(WritePrincipleCard, {
      projectId, project, toast, onRefresh,
    }),
    // 【gap 第 1 条】原生写工具守卫的挡位与目录：守卫在服务端，
    // 但「拦不拦」是作者的决定，得给个开关。
    h(WritePolicyCard, {
      projectId, project, toast, onRefresh,
    }),
    h(
      Card,
      { title: '界面' },
      // 【24 条 #24】主题三档：暗 / 亮 / 纸。米黄底配宋体，盯久了总得有个柔和的。
      h(
        'div',
        { className: 'nw-theme-row' },
        [
          { value: 'dark', label: '暗色', hint: '默认。夜里写。' },
          { value: 'light', label: '亮色', hint: '白天用。' },
          { value: 'paper', label: '纸', hint: '米黄底 + 宋体，柔和。' },
        ].map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-theme-card nw-theme-${item.value}${theme === item.value ? ' on' : ''}`,
            onClick: () => {
              setTheme(item.value)
              toast(`已切到「${item.label}」主题`)
            },
          },
          h('span', { className: 'nw-theme-swatch' }, item.value === 'paper' ? '纸' : ''),
          h('span', { className: 'nw-theme-name' }, item.label),
          h('span', { className: 'nw-theme-hint' }, item.hint),
        )),
      ),
      h(Hint, null, '主题记在 localStorage，只影响长夜这一层，不动宿主界面。'),
    ),
  )
}
