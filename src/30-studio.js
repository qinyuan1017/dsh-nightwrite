/**
 * 长夜 · 生产台
 *
 * 三栏：左边指令模板库，中间指令单（五块），右边队列。
 * AI 是主写手，人在这里下指令。
 */

function TemplatePanel({ projectId, templates, onPick, reload, toast }) {
  const [draft, setDraft] = useState(null)

  const save = async (item) => {
    if (!item.name.trim()) {
      toast('模板名不能为空')
      return
    }
    try {
      await api('template.save', { projectId, template: item })
      setDraft(null)
      reload()
      toast('模板已保存')
    } catch (error) {
      toast(error.message)
    }
  }

  const remove = async (id) => {
    try {
      await api('template.remove', { projectId, id })
      reload()
      toast('模板已删除')
    } catch (error) {
      toast(error.message)
    }
  }

  return h(
    'div',
    { className: 'nw-tpl-panel' },
    h(
      'div',
      { className: 'nw-tpl-head' },
      h('span', null, '指令模板'),
      h(
        Btn,
        {
          small: true,
          kind: 'ghost',
          onClick: () => setDraft({ id: '', name: '', intent: '' }),
        },
        '＋ 新建',
      ),
    ),
    h(
      'div',
      { className: 'nw-tpl-list' },
      templates.map((item) =>
        h(
          'button',
          {
            type: 'button',
            className: 'nw-tpl',
            key: item.id,
            onClick: () => onPick(item),
            title: item.intent,
          },
          h('span', { className: 'nw-tpl-name' }, item.name),
          h('span', { className: 'nw-tpl-intent' }, item.intent || '无意图说明'),
          item.used ? h('span', { className: 'nw-tpl-used' }, `用过 ${item.used} 次`) : null,
        ),
      ),
      templates.length ? null : h(Empty, null, '还没有模板。'),
    ),
    draft
      ? h(
          Modal,
          {
            title: draft.id ? '编辑模板' : '新建模板',
            onClose: () => setDraft(null),
            footer: h(
              Fragment,
              null,
              draft.id
                ? h(
                    Btn,
                    {
                      kind: 'danger',
                      small: true,
                      onClick: () => {
                        remove(draft.id)
                        setDraft(null)
                      },
                    },
                    '删除',
                  )
                : null,
              h(Btn, { kind: 'ghost', small: true, onClick: () => setDraft(null) }, '取消'),
              h(Btn, { kind: 'primary', small: true, onClick: () => save(draft) }, '保存'),
            ),
          },
          h(
            Field,
            { label: '模板名' },
            h(Input, { value: draft.name, onChange: (v) => setDraft({ ...draft, name: v }) }),
          ),
          h(
            Field,
            { label: '创作意图' },
            h(TextArea, {
              value: draft.intent,
              rows: 4,
              onChange: (v) => setDraft({ ...draft, intent: v }),
              placeholder: '例：主角吃瘪但埋下钩子，章末反转，不许死人',
            }),
          ),
        )
      : null,
  )
}

function ContextAudit({ rows, budget, onRemove, onMove, onToggle, off, onReset, toast }) {
  let total = 0
  for (const row of rows) total += Number(row.tokens) || 0
  const used = rows
    .filter((row) => !off?.[row.id])
    .reduce((sum, row) => sum + (Number(row.tokens) || 0), 0)
  const over = used > budget
  const ratio = used / (budget || 1)
  const tone = ratio > 1 ? 'red' : ratio > 0.8 ? 'amber' : 'green'
  const dragFrom = useRef(null)

  return h(
    'div',
    { className: `nw-ctx${over ? ' nw-ctx-over' : ''}` },
    h(
      'div',
      { className: 'nw-ctx-head' },
      h('span', null, '上下文包'),
      h(
        'span',
        { className: `nw-ctx-total${over ? ' nw-over' : ''}` },
        `${used} / ${budget} token`,
      ),
    ),
    // 【24 条 #11】预算条画出来：绿 / 黄 / 红三档，配百分比，不再只是一个数字。
    h(Bar, { value: used, max: budget, tone }),
    h(
      'div',
      { className: 'nw-ctx-meter' },
      h('span', { className: 'nw-hint' }, `${Math.round(ratio * 100)}% 已用`),
      h(
        'span',
        { className: `nw-hint${over ? ' nw-over' : ''}` },
        over
          ? `超了 ${used - budget} token，先砍低相关度的账本条目`
          : `还能塞 ${budget - used} token`,
      ),
    ),
    h(
      'div',
      { className: 'nw-ctx-list' },
      rows.map((row, index) =>
        h(
          'div',
          {
            className: `nw-ctx-row${off?.[row.id] ? ' nw-ctx-off' : ''}`,
            key: row.id,
            // 【24 条 #10】拖拽换序：拖起一行，落到另一行上就换位置。
            draggable: true,
            onDragStart: () => {
              dragFrom.current = index
            },
            onDragOver: (event) => event.preventDefault(),
            onDrop: () => {
              if (dragFrom.current === null || dragFrom.current === index) return
              onMove?.(dragFrom.current, index)
              dragFrom.current = null
            },
          },
          h('span', { className: 'nw-ctx-grip', title: '拖我换顺序' }, '⠿'),
          h('span', { className: 'nw-ctx-kind' }, row.kind),
          h('span', { className: 'nw-ctx-label' }, row.label),
          h('span', { className: 'nw-ctx-token' }, String(row.tokens)),
          h('button', {
            type: 'button',
            className: `nw-ctx-sw${off?.[row.id] ? '' : ' on'}`,
            title: off?.[row.id] ? '这次不喂它' : '这次喂它',
            // 六行都有这个开关，读屏只念「这次喂它」等于六个同名按钮分不清。
            // 名字里带上这一行的类型和标签，才说得清点的是哪一条。
            'aria-label': `第 ${index + 1} 条 ${row.kind}「${row.label}」${off?.[row.id] ? '：已关，点开重新喂' : '：在喂，点掉停用'}`,
            'aria-pressed': off?.[row.id] ? 'false' : 'true',
            onClick: () => onToggle?.(row.id),
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'nw-ctx-x',
              onClick: () => onRemove?.(row.id),
              'aria-label': `移除第 ${index + 1} 条 ${row.kind}「${row.label}」`,
            },
            '✕',
          ),
        ),
      ),
      rows.length
        ? null
        : h('div', { className: 'nw-hint' }, '上下文包是空的：至少喂一条世界状态和上一章结尾。'),
    ),
    h(
      'div',
      { className: 'nw-ctx-foot' },
      h(
        'span',
        { className: 'nw-hint' },
        '共 ' + rows.filter((row) => !off?.[row.id]).length + '/' + rows.length + ' 条在喂',
      ),
      h(
        Btn,
        {
          small: true,
          kind: 'ghost',
          onClick: () => {
            onReset?.()
            toast?.('已按默认优先级重算上下文包')
          },
        },
        '重算',
      ),
    ),
    over
      ? h('p', { className: 'nw-warn' }, '超预算：先砍低相关度的账本条目，别砍世界状态。')
      : null,
  )
}

function StudioPage({ projectId, project, chapters, go, toast, onRefresh, bare }) {
  const tpl = useAsync(() => api('templates.list', { projectId }), [projectId], {
    skip: !projectId,
  })
  const q = useAsync(() => api('queue.list', { projectId }), [projectId], { skip: !projectId })
  const led = useAsync(() => api('ledger.get', { projectId }), [projectId], { skip: !projectId })

  // 三个 useAsync 以前一条 error 分支都没有：后端挂了就静默显示空表单，
  // 作者以为「模板没了 / 队列空了」，实际是请求失败了。
  // 【别把这行挪回去】错误分支必须排在所有 hook 之后。
  // 排前面的话：首次渲染 12 个 hook，接口一报错只走 3 个就 return，
  // hook 数跳变 → React 直接抛错 → 整页白屏，作者以为「生产台打不开」。
  const broken = tpl.error || q.error || led.error
  // 提前算好要用的东西，早退之后再 return 渲染分支。

  const lastChapter = chapters.length ? chapters[chapters.length - 1].chapter : 0
  const [form, setForm] = useState({
    chapter: lastChapter + 1,
    templateId: '',
    templateName: '',
    intent: '',
    words: project?.targetWords ?? 2500,
    gate: project?.qualityGate ?? 70,
    mode: 'one',
  })
  const [ctx, setCtx] = useState([])
  const [ctxOff, setCtxOff] = useState({})
  const [busy, setBusy] = useState(false)
  // 【第 4 条】剪贴板被拒时的退路：把派单话术直接摊在队列下方。
  const [dispatchText, setDispatchText] = useState('')

  useEffect(() => {
    setForm((prev) => (prev.chapter ? prev : { ...prev, chapter: lastChapter + 1 }))
  }, [lastChapter])

  // 大纲页「送去派单」写的就是这两个键：章号 + 意图（摘要 + 章末钩子）。
  // 读一次就清掉，否则切页回来会把用户已经改过的指令单再盖一遍。
  useEffect(() => {
    const wanted = readLS(LS.orderChapter, '')
    if (!wanted) return
    const intent = readLS(LS.orderIntent, '')
    setForm((prev) => ({
      ...prev,
      chapter: Number(wanted) || prev.chapter,
      intent: intent || prev.intent,
    }))
    writeLS(LS.orderChapter, '')
    writeLS(LS.orderIntent, '')
    toast(`已带入第 ${wanted} 回的意图`)
  }, [toast])

  const templates = tpl.data?.items ?? []
  const queue = q.data?.items ?? []
  const ledger = led.data?.ledger ?? {}

  // 【24 条 #12】意图复用：从队列里真实排过的单子抽最近三条，去掉重复和空串。
  // 以前这三条是写死的常量，跟这个项目写过什么毫无关系。
  const recentIntents = useMemo(() => {
    const seen = new Set()
    const out = []
    for (let i = queue.length - 1; i >= 0 && out.length < 3; i -= 1) {
      const text = String(queue[i]?.intent ?? '').trim()
      if (!text || seen.has(text)) continue
      seen.add(text)
      out.push(text)
    }
    return out
  }, [queue])

  const buildContext = useCallback(() => {
    const rows = []
    const ws = project?.worldState
    rows.push({
      id: 'ws',
      kind: '世界状态',
      label: ws?.text
        ? `截至第 ${ws.fromChapter ?? 0} 回：${String(ws.text).slice(0, 26)}…`
        : '（还没有世界状态，建议先跑一次全书体检）',
      tokens: ws?.text ? Math.min(2400, Math.ceil(String(ws.text).length * 0.7)) : 0,
    })
    if (lastChapter) {
      const prev = chapters[chapters.length - 1]
      rows.push({
        id: 'prev',
        kind: '上一章',
        label: `第 ${prev.chapter} 回 · ${prev.title || ''}（${prev.words} 字）`,
        tokens: Math.min(6000, Math.ceil(prev.words * 1.4)),
      })
    }
    for (const row of (ledger.characters ?? []).slice(0, 4)) {
      rows.push({
        id: `ch-${row.id}`,
        kind: '人物',
        label: `${row.name ?? row.id} · ${row.state ?? '状态未记'}`,
        tokens: 320,
      })
    }
    for (const row of (ledger.foreshadow ?? [])
      .filter((item) => String(item.status ?? '') !== 'done')
      .slice(0, 3)) {
      rows.push({
        id: `fs-${row.id}`,
        kind: '伏笔',
        label: `${row.name ?? row.id} · 计划第 ${row.plannedChapter ?? '?'} 回收`,
        tokens: 260,
      })
    }
    for (const row of (ledger.terms ?? []).slice(0, 4)) {
      rows.push({ id: `tm-${row.id}`, kind: '术语', label: `${row.name ?? row.id}`, tokens: 120 })
    }
    return rows
  }, [project, chapters, ledger, lastChapter])

  useEffect(() => {
    setCtx(buildContext())
  }, [buildContext])

  if (broken) {
    return h(
      'div',
      { className: 'nw-studio' },
      h(ErrorBox, {
        error: broken,
        onRetry: () => {
          tpl.reload()
          q.reload()
          led.reload()
        },
      }),
    )
  }

  const budget = 32000
  const total = ctx.reduce((sum, row) => sum + (Number(row.tokens) || 0), 0)

  const useTemplate = (item) => {
    setForm((prev) => ({
      ...prev,
      templateId: item.id,
      templateName: item.name,
      intent: item.intent || prev.intent,
    }))
    toast(`已套用模板「${item.name}」`)
  }

  const enqueue = async () => {
    if (!projectId) {
      toast('先选一部作品')
      return
    }
    if (!String(form.intent).trim()) {
      toast('先写一句创作意图：这章靠什么把读者拽住')
      return
    }
    setBusy(true)
    try {
      await api('queue.add', {
        projectId,
        item: {
          chapter: Number(form.chapter),
          templateId: form.templateId,
          templateName: form.templateName,
          intent: form.intent,
          words: Number(form.words),
          cost: 0,
        },
      })
      q.reload()
      toast(`第 ${form.chapter} 回已入队`)
      setForm((prev) => ({ ...prev, chapter: Number(prev.chapter) + 1, intent: '' }))
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const move = async (id, patch) => {
    try {
      await api('queue.update', { projectId, id, patch })
      q.reload()
    } catch (error) {
      toast(error.message)
    }
  }

  const drop = async (id) => {
    try {
      await api('queue.remove', { projectId, id })
      q.reload()
      toast('已从队列移除')
    } catch (error) {
      toast(error.message)
    }
  }

  // 【第 4 条】队列在这台机器上不会自己动 —— 它的执行者是对话里的 agent。
  // 「开跑」只是把状态改成 running，看着像有人接了活，其实没有。
  // 这里把这一行拼成一句可直接粘给 agent 的话：意图 + 该读哪些 op + 该守什么闸门。
  // 不自动调 agent（界面不该替用户发指令），但也不让按钮点了没下文。
  const dispatch = async (row) => {
    const intent =
      String(row.intent || row.templateName || '').trim() || '（这行没写意图，先补一句要写什么）'
    // 【P5】写作原则插在工作单最上面：模型读这段话时第一眼看到的就是它，
    // 而不是读完五条流程说明之后才想起「哦还有风格要求」。
    // 没设就不插，不留一个空行占位。
    // 按场景挑原则：模板名 / 意图里出现哪个场景名，就带上那条；
    // 一个都没提到就退回通用那句。挑逻辑在 src/10-core.js 的 pickPrinciple。
    const hints = [row.templateName, row.intent].filter(Boolean).join(' ')
    const princ = pickPrinciple(project, hints)
    const principle = princ.length
      ? princ.map((row) => `${row.name}：${row.text}`).join('；')
      : String(project?.settings?.writePrinciple ?? '').trim()
    const prompt = [
      principle ? `【这本书的原则】${principle}` : null,
      `用 nightwrite_op 写第 ${row.chapter} 回。`,
      `意图：${intent}`,
      '开工前读：chapter.list 看已有稿、ledger.get 拿设定与伏笔、outline.get 看这一回的骨架、templates.list 选节奏模板。',
      '交稿时：chapter.save 写正文（status 交 review），proposal.save 提你建议的改动（不要自己改已验收的稿），problem.save 记你发现但没改的毛病。',
      `质检门槛 ${Number(project?.qualityGate ?? 70)} 分；低于门槛就别交，先自己修。`,
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(prompt)
      await move(row.id, { status: 'running' })
      toast('已把这一回的指令复制到剪贴板，粘给 agent 就行')
    } catch {
      // 剪贴板可能被拒（非安全上下文），至少把状态推进，并把话术摆在界面上。
      await move(row.id, { status: 'running' })
      setDispatchText(prompt)
      toast('剪贴板不可用，指令已展开在队列下方')
    }
  }

  if (!projectId) return h(Empty, null, '还没有作品。建一本就能排单。')

  return h(
    // bare：被「派单」页内嵌时用，不再套一层 .nw-page（否则版心双份 max-width）。
    bare ? Fragment : 'div',
    { className: 'nw-page nw-studio' },
    h(
      'div',
      { className: 'nw-studio-cols' },
      tpl.loading && !tpl.data
        ? h(Loading, null)
        : h(TemplatePanel, {
            projectId,
            templates,
            onPick: useTemplate,
            reload: tpl.reload,
            toast,
          }),
      h(
        'div',
        { className: 'nw-order' },
        h(
          Card,
          { title: '指令单', extra: h('span', { className: 'nw-card-badge' }, 'AI 领单 · 你验收') },
          h(
            'div',
            { className: 'nw-order-grid' },
            h(
              Field,
              { label: '第几回' },
              h(Input, {
                type: 'number',
                value: form.chapter,
                onChange: (v) => setForm({ ...form, chapter: Number(v) || 0 }),
              }),
            ),
            h(
              Field,
              { label: '目标字数' },
              h(Input, {
                type: 'number',
                value: form.words,
                onChange: (v) => setForm({ ...form, words: Number(v) || 0 }),
              }),
            ),
            h(
              Field,
              { label: '质检门槛' },
              h(Input, {
                type: 'number',
                value: form.gate,
                onChange: (v) => setForm({ ...form, gate: Number(v) || 0 }),
              }),
            ),
            h(
              Field,
              { label: '模式' },
              h(Select, {
                value: form.mode,
                onChange: (v) => setForm({ ...form, mode: v }),
                options: [
                  { value: 'one', label: '单章' },
                  { value: 'batch', label: '连更 3 章' },
                  { value: 'bid', label: '多版本竞标' },
                ],
              }),
            ),
          ),
          h(
            Field,
            { label: '创作意图（这章靠什么把读者拽住）' },
            h(TextArea, {
              value: form.intent,
              rows: 3,
              onChange: (v) => setForm({ ...form, intent: v }),
              placeholder: '例：主角吃瘪但埋下钩子，章末反转，不许死人；结尾留一句让人翻页的话',
            }),
          ),
          // 【24 条 #12】意图复用：最近三次用过的指令，点一下填回来。
          h(IntentChips, {
            toast,
            items: recentIntents,
            onPick: (text) => setForm((prev) => ({ ...prev, intent: text })),
          }),
          form.templateName
            ? h('p', { className: 'nw-hint' }, `已套模板：${form.templateName}`)
            : null,
          h(ContextAudit, {
            rows: ctx,
            budget,
            off: ctxOff,
            toast,
            onRemove: (id) => setCtx((prev) => prev.filter((row) => row.id !== id)),
            onMove: (from, to) =>
              setCtx((prev) => {
                const next = prev.slice()
                const [moved] = next.splice(from, 1)
                next.splice(to, 0, moved)
                return next
              }),
            onToggle: (id) => setCtxOff((prev) => ({ ...prev, [id]: !prev[id] })),
            onReset: () => {
              setCtx(buildContext())
              setCtxOff({})
            },
          }),
          h(
            'div',
            { className: 'nw-order-foot' },
            h(
              'span',
              { className: 'nw-hint' },
              total > budget ? '超预算，建议先减条目' : `约 ${total} token 上下文`,
            ),
            h(
              'div',
              { className: 'nw-actions' },
              h(Btn, { kind: 'ghost', onClick: () => setCtx(buildContext()) }, '重算上下文'),
              h(
                Btn,
                { kind: 'primary', onClick: enqueue, disabled: busy },
                busy ? '入队中…' : '加入队列',
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        { className: 'nw-queue' },
        h(
          'div',
          { className: 'nw-queue-head' },
          h('span', null, '队列'),
          h(
            'span',
            { className: 'nw-card-badge' },
            `${queue.filter((row) => row.status === 'queued').length} 待跑`,
          ),
        ),
        h(
          'div',
          { className: 'nw-queue-list' },
          queue.length
            ? queue.map((row) =>
                h(
                  'div',
                  { className: `nw-q-row nw-q-${row.status}`, key: row.id },
                  h('span', { className: 'nw-q-n' }, `第 ${row.chapter} 回`),
                  h(
                    'span',
                    { className: 'nw-q-intent' },
                    row.intent || row.templateName || '（无意图）',
                  ),
                  h(
                    Tag,
                    {
                      tone:
                        row.status === 'running'
                          ? 'teal'
                          : row.status === 'done'
                            ? 'green'
                            : 'grey',
                    },
                    row.status,
                  ),
                  h(
                    'span',
                    { className: 'nw-q-acts' },
                    row.status === 'queued'
                      ? h(
                          Btn,
                          {
                            small: true,
                            kind: 'ghost',
                            onClick: () => move(row.id, { status: 'running' }),
                          },
                          '开跑',
                        )
                      : null,
                    row.status === 'running'
                      ? h(
                          Btn,
                          {
                            small: true,
                            kind: 'ghost',
                            onClick: () => move(row.id, { status: 'done' }),
                          },
                          '完成',
                        )
                      : null,
                    row.status === 'running' || row.status === 'queued'
                      ? h(
                          Btn,
                          { small: true, kind: 'primary', onClick: () => dispatch(row) },
                          '派给 agent',
                        )
                      : null,
                    h(Btn, { small: true, kind: 'danger', onClick: () => drop(row.id) }, '移除'),
                  ),
                ),
              )
            : h(Empty, null, '队列是空的。写一张指令单，加进来。'),
        ),
        h(
          'p',
          { className: 'nw-hint' },
          '队列只记「要写什么」。真正动笔由 agent 读这一行，通过 nightwrite_op 取正文与账本。',
        ),
        dispatchText
          ? h(
              'div',
              { className: 'nw-dispatch' },
              h(
                'div',
                { className: 'nw-dispatch-head' },
                h('span', null, '这一回的派单话术'),
                h(Btn, { small: true, kind: 'ghost', onClick: () => setDispatchText('') }, '收起'),
              ),
              h('pre', { className: 'nw-dispatch-body' }, dispatchText),
            )
          : null,
      ),
    ),
  )
}
