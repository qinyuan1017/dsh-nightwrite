/**
 * 长夜 · 验收台的两个抽屉：提案 与 问题单
 *
 * 为什么放在验收台而不是新开页：这两样东西都是「稿子交上来之后才有」的，
 * 跟逐章验收是同一个动作的两个侧面。分开成页会让人来回跳。
 *
 * 提案 = AI 想改，等你拍板。before/after 必须先能对上正文，采纳才写盘，
 *         一条都对不上就整体拒掉、正文一字不动（服务端 proposal.decide 保证）。
 * 问题单 = 验收时记下的毛病，要能跨章看、能关、能重开。
 */

const PROPOSAL_TONE = {
  pending: { label: '待批', tone: 'amber' },
  accepted: { label: '已采纳', tone: 'green' },
  rejected: { label: '已驳回', tone: 'red' },
}

const PROBLEM_TONES = {
  'ai-style': { label: 'AI 味', tone: 'amber' },
  logic: { label: '逻辑', tone: 'red' },
  style: { label: '文风', tone: 'blue' },
  other: { label: '其他', tone: 'grey' },
}

const SEVERITY_LABEL = {
  critical: '致命', major: '重要', minor: '次要', note: '提示',
}

const PROBLEM_STATUS_LABEL = { open: '未修', fixed: '已修', ignored: '已忽略' }
const PROBLEM_STATUS_TONE = { open: 'amber', fixed: 'green', ignored: 'grey' }

function DiffRow({ diff, index }) {
  return h(
    'div',
    { className: 'cy-diff' },
    h('span', { className: 'cy-diff-n' }, String(index + 1).padStart(2, '0')),
    h(
      'div',
      { className: 'cy-diff-cols' },
      h('div', { className: 'cy-diff-cell cy-diff-before' },
        h('span', { className: 'cy-diff-tag' }, '改前'),
        h('p', null, diff.before || '（新增，原处为空）')),
      h('div', { className: 'cy-diff-cell cy-diff-after' },
        h('span', { className: 'cy-diff-tag' }, '改后'),
        h('p', null, diff.after || '（删除这段）')),
    ),
    diff.why ? h('span', { className: 'cy-diff-why' }, diff.why) : null,
  )
}

function ProposalCard({
  row, onDecide, onRemove, gate, busy, projectId, demo,
}) {
  const [open, setOpen] = useState(false)
  const tone = PROPOSAL_TONE[row.status] ?? PROPOSAL_TONE.pending
  // 采纳前先问服务端：每条 before 在正文里出现几次。>1 就是「改了不该改的那一段」，
  // 而且正文已经落盘、没有撤销。这个检查必须在点「采纳」之前摆出来。
  const preview = useAsync(
    () => api('proposal.preview', { projectId, id: row.id }),
    [projectId, row.id, open],
    { skip: !open || demo || !projectId || !row.id || row.status !== 'pending' },
  )
  const risky = preview.data?.rows?.filter((item) => item.ambiguous || item.missing) ?? []
  return h(
    'div',
    { className: `cy-prop cy-prop-${row.status}` },
    h(
      'button',
      { type: 'button', className: 'cy-prop-head', onClick: () => setOpen(!open) },
      h('span', { className: 'cy-prop-n' }, `第 ${row.chapter} 回`),
      h('span', { className: 'cy-prop-title' }, row.title),
      h(Tag, { tone: row.kind === 'rewrite' ? 'red' : 'grey' }, row.kind === 'rewrite' ? '整章重写' : `${row.diffs.length} 处替换`),
      h(Tag, { tone: tone.tone }, tone.label),
      h('span', { className: 'cy-prop-go' }, open ? '▾' : '▸'),
    ),
    row.summary ? h('p', { className: 'cy-hint' }, row.summary) : null,
    open
      ? h(
        'div',
        { className: 'cy-prop-body' },
        risky.length
          ? h(
            'div',
            { className: 'cy-prop-warn' },
            h('span', { className: 'cy-prop-warn-icon' }, '⚠'),
            h('span', null, `${risky.length} 处「改前」在正文里不唯一或找不到，采纳会改错位置：`),
            h(
              'ul',
              { className: 'cy-prop-warn-list' },
              risky.map((item) => h('li', { key: item.index },
                `第 ${item.index + 1} 处 · ${item.missing ? '正文里找不到这句' : `正文里有 ${item.count} 处相同`} ·「${String(item.before ?? '').slice(0, 30)}」`)),
            ),
          )
          : null,
        row.diffs.map((diff, index) => h(DiffRow, { diff, index, key: index })),
        row.status === 'accepted'
          ? h('p', { className: 'cy-hint' }, `已写回正文：命中 ${row.applied ?? 0} 处${(row.missed ?? []).length ? `，未命中 ${row.missed.length} 处` : ''}`)
          : null,
      )
      : null,
    h(
      'div',
      { className: 'cy-prop-foot' },
      h('span', { className: 'cy-hint' }, `质检门槛 ${gate} · AI 提议，你拍板`),
      h(
        'div',
        { className: 'cy-actions' },
        h(Btn, { small: true, kind: 'danger', onClick: () => onRemove(row), disabled: busy }, '删除'),
        row.status === 'pending'
          ? h(Btn, { small: true, kind: 'ghost', onClick: () => onDecide(row, 'reject'), disabled: busy }, '✕ 驳回')
          : null,
        row.status === 'pending'
          ? h(Btn, { small: true, kind: 'primary', onClick: () => onDecide(row, 'accept'), disabled: busy }, '✓ 采纳并写回')
          : null,
      ),
    ),
  )
}

function ProposalBoard({ projectId, gate, toast, onRefresh, refreshKey }) {
  const res = useAsync(() => api('proposal.list', { projectId }), [projectId, refreshKey], { skip: !projectId })
  const [filter, setFilter] = useState('pending')
  // 【24 条 #16】按章收拢 + 批量处理：AI 一次提二十条，逐条点等于加班。
  const [chapterFilter, setChapterFilter] = useState(0)
  const [folded, setFolded] = useState({})
  const [busy, setBusy] = useState(false)
  // 【12 条 #10】样例必须自己点开。以前真数据为空就拿三条假提案顶上，
  // 只挂一个小蓝标，等于让假数据替你的稿子做评审。
  const [showDemo, setShowDemo] = useState(false)

  // 下面这些全部要在任何 return 之前算完。
  // 为什么：组件里所有 hook 必须每帧按同样顺序调一遍。第一帧是 loading 走了
  // `return h(Loading)`，数据回来那一帧却多出一个 useMemo —— React 数出来的 hook
  // 数量对不上，直接抛错、整页白屏，表现就是「点提案这个 tab 打不开」。
  const realItems = res.data?.items ?? []
  const demo = realItems.length === 0 && showDemo
  const items = demo ? MOCK.proposalsDemo : realItems
  const allChapters = Array.from(new Set(items.map((row) => row.chapter))).sort((a, b) => a - b)
  const rows = (filter === 'all' ? items : items.filter((row) => row.status === filter))
    .filter((row) => (chapterFilter ? row.chapter === chapterFilter : true))
  const pendingRows = rows.filter((row) => row.status === 'pending')

  // 【24 条 #16】按章分组：提案一多就是一堵墙，先按章折叠。
  const groups = useMemo(() => {
    const map = new Map()
    rows.forEach((row) => {
      if (!map.has(row.chapter)) map.set(row.chapter, [])
      map.get(row.chapter).push(row)
    })
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [rows.map((row) => row.id).join('|')])

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (res.loading && !res.data) return h(Loading, null)
  if (res.error) return h(ErrorBox, { error: res.error, onRetry: res.reload })

  const decide = async (row, action) => {
    if (demo) {
      toast(`演示：第 ${row.chapter} 回「${row.title}」${action === 'accept' ? '已采纳（未写盘）' : '已驳回（未写盘）'}`)
      return
    }
    setBusy(true)
    try {
      const out = await api('proposal.decide', { projectId, id: row.id, action })
      res.reload()
      onRefresh?.()
      if (action === 'accept') {
        toast(`已写回第 ${row.chapter} 回：${out.applied} 处`)
      } else {
        toast('已驳回')
      }
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  // 【24 条 #16】批量：一次把当前筛选里的待批条目全拍板。
  const decideAll = async (action) => {
    if (!pendingRows.length) {
      toast('当前筛选下没有待批提案')
      return
    }
    if (demo) {
      toast(`演示：${pendingRows.length} 条提案已${action === 'accept' ? '全采纳' : '全驳回'}（未写盘）`)
      return
    }
    setBusy(true)
    try {
      for (const row of pendingRows) {
        // eslint-disable-next-line no-await-in-loop
        await api('proposal.decide', { projectId, id: row.id, action })
      }
      res.reload()
      onRefresh?.()
      toast(`已${action === 'accept' ? '批量采纳' : '批量驳回'} ${pendingRows.length} 条`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (demo) {
      toast('演示：这条提案已从列表移除（未写盘）')
      return
    }
    setBusy(true)
    try {
      await api('proposal.remove', { projectId, id: row.id })
      res.reload()
      toast('提案已删除')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const FILTERS = [
    { value: 'pending', label: '待批' },
    { value: 'accepted', label: '已采纳' },
    { value: 'rejected', label: '已驳回' },
    { value: 'all', label: '全部' },
  ]

  return h(
    'div',
    { className: 'cy-board' },
    h(
      'div',
      { className: 'cy-rv-bar' },
      h(
        'div',
        { className: 'cy-actions' },
        h(
          'div',
          { className: 'cy-seg' },
          FILTERS.map((item) => h(
            'button',
            {
              type: 'button',
              key: item.value,
              className: `cy-seg-btn${filter === item.value ? ' on' : ''}`,
              'aria-pressed': filter === item.value ? 'true' : 'false',
              onClick: () => setFilter(item.value),
            },
            item.label,
            h('span', { className: 'cy-seg-n' }, String(
              item.value === 'all' ? items.length : items.filter((row) => row.status === item.value).length,
            )),
          )),
        ),
        // 【24 条 #16】按章筛选
        allChapters.length > 1
          ? h(Select, {
            value: String(chapterFilter),
            onChange: (v) => setChapterFilter(Number(v) || 0),
            options: [{ value: '0', label: `全部章（${items.length}）` }].concat(
              allChapters.map((n) => ({
                value: String(n),
                label: `第 ${n} 回（${items.filter((row) => row.chapter === n).length}）`,
              })),
            ),
          })
          : null,
      ),
      h(
        'div',
        { className: 'cy-actions' },
        realItems.length === 0
          ? h(
            'button',
            {
              type: 'button',
              className: `cy-demo-sw${showDemo ? ' on' : ''}`,
              'aria-pressed': showDemo ? 'true' : 'false',
              onClick: () => {
                setShowDemo(!showDemo)
                toast(showDemo ? '已收起样例，回到你自己稿子的真实状态' : '现在看到的是样例：3 条假提案，采纳不会改你的稿子')
              },
            },
            showDemo ? '样例开着 · 点它收起' : '看样例（3 条假提案）',
          )
          : null,
        h(Btn, { small: true, kind: 'primary', onClick: () => decideAll('accept'), disabled: busy || !pendingRows.length }, `✓ 全采纳 ${pendingRows.length || ''}`.trim()),
        h(Btn, { small: true, kind: 'ghost', onClick: () => decideAll('reject'), disabled: busy || !pendingRows.length }, `✕ 全驳回 ${pendingRows.length || ''}`.trim()),
        h(Btn, {
          small: true,
          kind: 'ghost',
          onClick: () => {
            const next = {}
            groups.forEach(([n]) => { next[n] = true })
            setFolded(next)
            toast('已按章折叠，点章头展开')
          },
        }, '⊟ 全部折叠'),
      ),
    ),
    rows.length
      ? h('div', { className: 'cy-prop-list' }, groups.map(([n, groupRows]) => (folded[n]
        ? h(
          'button',
          {
            type: 'button',
            key: `fold-${n}`,
            className: 'cy-prop-fold',
            onClick: () => setFolded({ ...folded, [n]: false }),
          },
          h('span', { className: 'cy-prop-fold-n' }, `第 ${n} 回`),
          h('span', { className: 'cy-hint' }, `${groupRows.length} 条提案 · 待批 ${groupRows.filter((row) => row.status === 'pending').length} · 点章头展开`),
          h('span', { className: 'cy-prop-go' }, '▸'),
        )
        : h(
          'div',
          { className: 'cy-prop-group', key: `group-${n}` },
          h(
            'button',
            {
              type: 'button',
              className: 'cy-prop-group-head',
              onClick: () => setFolded({ ...folded, [n]: true }),
            },
            h('span', { className: 'cy-prop-fold-n' }, `第 ${n} 回`),
            h('span', { className: 'cy-hint' }, `${groupRows.length} 条`),
            h('span', { className: 'cy-prop-go' }, '▾'),
          ),
          groupRows.map((row) => h(ProposalCard, {
            key: row.id, row, gate, busy, projectId, demo, onDecide: decide, onRemove: remove,
          })),
        ))))
      : h(Empty, null, filter === 'pending' ? '没有待批提案。AI 交稿后会用 changye_op 的 proposal.save 提上来。' : '这个状态下没有提案。'),
  )
}

function ProblemRow({ row, onStatus, onRemove, busy, onOpen }) {
  const tone = PROBLEM_TONES[row.type] ?? PROBLEM_TONES.other
  return h(
    'div',
    { className: `cy-prob cy-prob-${row.status}` },
    h(
      'button',
      { type: 'button', className: 'cy-prob-main', onClick: () => onOpen(row) },
      h('span', { className: 'cy-prob-n' }, `第 ${row.chapter} 回`),
      h(Tag, { tone: tone.tone }, tone.label),
      h(Tag, { tone: row.severity === 'critical' ? 'red' : 'grey' }, SEVERITY_LABEL[row.severity] ?? row.severity),
      h('span', { className: 'cy-prob-text' }, row.text),
      h(Tag, { tone: PROBLEM_STATUS_TONE[row.status] ?? 'grey' }, PROBLEM_STATUS_LABEL[row.status] ?? row.status),
    ),
    row.quote ? h('span', { className: 'cy-prob-quote' }, `「${row.quote}」`) : null,
    h(
      'span',
      { className: 'cy-prob-acts' },
      row.status !== 'fixed' ? h(Btn, { small: true, kind: 'primary', onClick: () => onStatus(row, 'fixed'), disabled: busy }, '✓ 已修') : null,
      row.status !== 'open' ? h(Btn, { small: true, kind: 'ghost', onClick: () => onStatus(row, 'open'), disabled: busy }, '↺ 重开') : null,
      row.status !== 'ignored' ? h(Btn, { small: true, kind: 'ghost', onClick: () => onStatus(row, 'ignored'), disabled: busy }, '忽略') : null,
      h(Btn, { small: true, kind: 'danger', onClick: () => onRemove(row), disabled: busy }, '删除'),
    ),
  )
}

function ProblemBoard({ projectId, gate, toast, onRefresh, refreshKey, onOpenChapter }) {
  const res = useAsync(() => api('problem.list', { projectId }), [projectId, refreshKey], { skip: !projectId })
  const [status, setStatus] = useState('open')
  const [type, setType] = useState('all')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null)
  // 【24 条 #17】只看本章：验收第 5 回时，别被别的章的问题淹了。
  const [onlyChapter, setOnlyChapter] = useState(0)
  // 【12 条 #10】问题单同理：真一条没有就说没有，别拿假条目骗你以为自己记过。
  const [showDemo, setShowDemo] = useState(false)

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (res.loading && !res.data) return h(Loading, null)
  if (res.error) return h(ErrorBox, { error: res.error, onRetry: res.reload })

  const realItems = res.data?.items ?? []
  const demo = realItems.length === 0 && showDemo
  const items = demo ? MOCK.problemsDemo : realItems
  const chaptersInItems = Array.from(new Set(items.map((row) => row.chapter))).sort((a, b) => a - b)
  const rows = items
    .filter((row) => (status === 'all' ? true : row.status === status))
    .filter((row) => (type === 'all' ? true : row.type === type))
    .filter((row) => (onlyChapter ? row.chapter === onlyChapter : true))

  const setOne = async (row, next) => {
    if (demo) {
      toast(`演示：第 ${row.chapter} 回那条已标记为「${next === 'fixed' ? '已修' : next === 'ignored' ? '已忽略' : '未修'}」（未写盘）`)
      return
    }
    setBusy(true)
    try {
      await api('problem.resolve', { projectId, id: row.id, status: next })
      res.reload()
      onRefresh?.()
      toast(next === 'fixed' ? '已标记修好' : next === 'ignored' ? '已忽略' : '已重开')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (demo) {
      toast('演示：这条问题已从列表移除（未写盘）')
      return
    }
    setBusy(true)
    try {
      await api('problem.remove', { projectId, id: row.id })
      res.reload()
      toast('已删除')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = async () => {
    if (!String(draft.text ?? '').trim()) {
      toast('先写一句问题说明')
      return
    }
    setBusy(true)
    try {
      await api('problem.save', { projectId, problem: draft })
      setDraft(null)
      res.reload()
      onRefresh?.()
      toast('问题已记下')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const STATUS_FILTERS = [
    { value: 'open', label: '未修' },
    { value: 'fixed', label: '已修' },
    { value: 'ignored', label: '已忽略' },
    { value: 'all', label: '全部' },
  ]
  const TYPE_FILTERS = [
    { value: 'all', label: '全部类型' },
    { value: 'ai-style', label: 'AI 味' },
    { value: 'logic', label: '逻辑' },
    { value: 'style', label: '文风' },
    { value: 'other', label: '其他' },
  ]

  return h(
    'div',
    { className: 'cy-board' },
    h(
      'div',
      { className: 'cy-rv-bar' },
      h(
        'div',
        { className: 'cy-actions' },
        h(
          'div',
          { className: 'cy-seg' },
          STATUS_FILTERS.map((item) => h(
            'button',
            {
              type: 'button',
              key: item.value,
              className: `cy-seg-btn${status === item.value ? ' on' : ''}`,
              'aria-pressed': status === item.value ? 'true' : 'false',
              onClick: () => setStatus(item.value),
            },
            item.label,
            h('span', { className: 'cy-seg-n' }, String(
              item.value === 'all' ? items.length : items.filter((row) => row.status === item.value).length,
            )),
          )),
        ),
        h(Select, { value: type, onChange: setType, options: TYPE_FILTERS }),
        // 【24 条 #17】只看本章
        chaptersInItems.length > 1
          ? h(Select, {
            value: String(onlyChapter),
            onChange: (v) => {
              const next = Number(v) || 0
              setOnlyChapter(next)
              toast(next ? `只看第 ${next} 回` : '看全部章')
            },
            options: [{ value: '0', label: `全部章（${items.length}）` }].concat(
              chaptersInItems.map((n) => ({
                value: String(n),
                label: `只看第 ${n} 回（${items.filter((row) => row.chapter === n).length}）`,
              })),
            ),
          })
          : null,
      ),
      h(
        'div',
        { className: 'cy-actions' },
        realItems.length === 0
          ? h(
            'button',
            {
              type: 'button',
              className: `cy-demo-sw${showDemo ? ' on' : ''}`,
              'aria-pressed': showDemo ? 'true' : 'false',
              onClick: () => {
                setShowDemo(!showDemo)
                toast(showDemo ? '已收起样例' : '现在看到的是样例：4 条假问题，改状态不会写盘')
              },
            },
            showDemo ? '样例开着 · 点它收起' : '看样例（4 条假问题）',
          )
          : null,
        h('span', { className: 'cy-hint' }, `门槛 ${gate} 分`),
        h(Btn, { small: true, kind: 'ghost', onClick: () => setDraft({
          chapter: 1, para: 0, type: 'other', severity: 'minor', scope: 'chapter', text: '', quote: '', fix: '',
        }) }, '＋ 记一条'),
      ),
    ),
    rows.length
      ? h('div', { className: 'cy-prob-list' }, rows.map((row) => h(ProblemRow, {
        key: row.id, row, busy, onStatus: setOne, onRemove: remove, onOpen: (r) => onOpenChapter?.(r.chapter),
      })))
      : h(Empty, null, status === 'open' ? '没有未修问题。验收时记下的毛病会攒在这里。' : '这个筛选下没有条目。'),
    draft
      ? h(Modal, {
        title: '记一条问题',
        onClose: () => setDraft(null),
        footer: h(
          Fragment,
          null,
          h(Btn, { kind: 'ghost', small: true, onClick: () => setDraft(null) }, '取消'),
          h(Btn, { kind: 'primary', small: true, onClick: saveDraft, disabled: busy }, '记下'),
        ),
      },
      h(
        'div',
        { className: 'cy-order-grid' },
        h(Field, { label: '第几回' }, h(Input, {
          type: 'number', value: draft.chapter, onChange: (v) => setDraft({ ...draft, chapter: Number(v) || 0 }),
        })),
        h(Field, { label: '类型' }, h(Select, {
          value: draft.type,
          onChange: (v) => setDraft({ ...draft, type: v }),
          options: TYPE_FILTERS.slice(1),
        })),
        h(Field, { label: '严重度' }, h(Select, {
          value: draft.severity,
          onChange: (v) => setDraft({ ...draft, severity: v }),
          options: [
            { value: 'critical', label: '致命' },
            { value: 'major', label: '重要' },
            { value: 'minor', label: '次要' },
            { value: 'note', label: '提示' },
          ],
        })),
        h(Field, { label: '范围' }, h(Select, {
          value: draft.scope,
          onChange: (v) => setDraft({ ...draft, scope: v }),
          options: [
            { value: 'chapter', label: '本章' },
            { value: 'cross', label: '跨章' },
            { value: 'global', label: '全局' },
          ],
        })),
      ),
      h(Field, { label: '问题说明' }, h(TextArea, {
        value: draft.text, rows: 3, onChange: (v) => setDraft({ ...draft, text: v }),
        placeholder: '例：连续三段都用「仿佛」，AI 味重',
      })),
      h(Field, { label: '原文片段（可选）' }, h(Input, {
        value: draft.quote, onChange: (v) => setDraft({ ...draft, quote: v }),
      })),
      h(Field, { label: '怎么改（可选）' }, h(Input, {
        value: draft.fix, onChange: (v) => setDraft({ ...draft, fix: v }),
      }))
      )
      : null,
  )
}
