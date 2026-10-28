/**
 * 长夜 · 流水线（派单台）
 *
 * 这一页解决的问题：AI 干活的时候，工作台上什么都看不见。
 * 你点了「派给架构师」，界面上没有任何痕迹，也不知道单子发没发出去、对方做完没有。
 *
 * 所以这里是一块「工地看板」：
 *   左边 = 11 个岗位（谁能干什么，一眼看全）
 *   右边 = 派单票（issued → 已投递 → 已交回执 / 过期 / 作废）
 *
 * 设计上的两个硬决定：
 * 1. 票落盘在作品目录（dispatches.json），不是内存。关掉宿主再打开，单子还在。
 * 2. 「预览任务书」和「投递到对话」是两个动作。投递会往你正在用的对话里塞一条指令，
 *    这不是能撤销的操作，所以必须先能看全文再按确认。
 */

const DISPATCH_STATUS_META = {
  issued: { label: '已开票', tone: 'blue' },
  claimed: { label: '已领取', tone: 'amber' },
  submitted: { label: '已交回执', tone: 'green' },
  expired: { label: '已过期', tone: 'red' },
  revoked: { label: '已作废', tone: 'grey' },
}

/** 剩余时间：票的 TTL 是 60 分钟，过期就看不出「还剩多久」。 */
function dispatchLeft(row) {
  const at = Date.parse(String(row?.expiresAt ?? ''))
  if (!Number.isFinite(at)) return ''
  const ms = at - Date.now()
  if (ms <= 0) return '已过期'
  const min = Math.round(ms / 60000)
  if (min >= 60) return `还剩 ${Math.round(min / 60)} 小时`
  return `还剩 ${min} 分钟`
}

function RoleCard({ role, onPick }) {
  return h(
    'button',
    {
      type: 'button',
      className: `nw-role${role.canDispatch ? ' nw-role-boss' : ''}`,
      onClick: () => onPick?.(role),
      title: role.duty,
    },
    h('span', { className: 'nw-role-name' }, role.label),
    h('span', { className: 'nw-role-id' }, role.id.replace(/^nightwrite-/, '')),
    h('span', { className: 'nw-role-duty' }, role.duty),
    h(
      'span',
      { className: 'nw-role-foot' },
      role.canDispatch ? h(Tag, { tone: 'amber' }, '有权派单') : null,
      h(Tag, { tone: 'grey' }, `${role.skills?.length ?? 0} 个 skill`),
    ),
  )
}

/**
 * 任务包查看器：派单时给子 agent 的那一叠材料，作者也该看得见。
 *
 * 为什么不做成「派单页里的一个折叠」：包是按 sha1 核对过的物证。当回执里说
 * 「我读了 manifest 里的第 3 份」，作者得能打开同一个包确认第 3 份是什么——
 * 否则那句话无法验证，整套「按材料交活」就退化成一句口头承诺。
 */
function TaskPackBoard({ projectId, toast, refreshKey }) {
  const [state, setState] = useState({ loading: true, items: [] })
  const [open, setOpen] = useState('')
  const [detail, setDetail] = useState(null)
  const seq = useRef(0)

  const load = useCallback(() => {
    if (!projectId) return
    const mine = ++seq.current
    setState((prev) => ({ ...prev, loading: true }))
    api('taskpack.list', { projectId, limit: 30 })
      .then((res) => { if (mine === seq.current) setState({ loading: false, items: res?.items ?? [] }) })
      .catch((error) => {
        if (mine !== seq.current) return
        setState({ loading: false, items: [], error: error.message })
      })
  }, [projectId])

  useEffect(() => { load() }, [load, refreshKey])

  const openPack = (name) => {
    if (open === name) { setOpen(''); setDetail(null); return }
    setOpen(name)
    setDetail(null)
    api('taskpack.get', { projectId, pack: name })
      .then((res) => setDetail(res))
      .catch((error) => toast?.(error.message))
  }

  if (!projectId) return null
  const items = state.items ?? []

  return h(
    Card,
    {
      title: '任务包',
      extra: h('span', { className: 'nw-card-badge' }, items.length ? `${items.length} 个` : '还没有'),
      className: 'nw-taskpack',
    },
    h(Hint, null, '派单时自动造的那一叠材料。包里有什么、为什么给、哪些故意没给，都在这。'),
    state.loading && !items.length
      ? h(Loading, { text: '读任务包…' })
      : items.length
        ? h(
          'div',
          { className: 'nw-tp-list' },
          ...items.map((row) => h(
            'div',
            { key: row.pack, className: 'nw-tp-row' },
            h(
              'button',
              {
                type: 'button',
                className: 'nw-tp-head',
                'aria-expanded': open === row.pack ? 'true' : 'false',
                onClick: () => openPack(row.pack),
              },
              h('span', { className: 'nw-tp-role' }, row.roleLabel ?? row.role),
              row.chapter ? h(Tag, { tone: 'grey' }, `第 ${row.chapter} 回`) : null,
              h('span', { className: 'nw-tp-n' }, `${row.files} 份`),
              row.omitted ? h(Tag, { tone: 'amber' }, `少给 ${row.omitted} 项`) : null,
              h('span', { className: 'nw-tp-at' }, String(row.createdAt ?? '').replace('T', ' ').slice(0, 16)),
            ),
            open !== row.pack
              ? null
              : h(
                'div',
                { className: 'nw-tp-body' },
                !detail
                  ? h(Loading, { text: '读清单…' })
                  : h(
                    'div',
                    { className: 'nw-tp-files' },
                    // 先说清楚东西在哪：材料是文件，不是塞进 prompt 的字。
                    h('p', { className: 'nw-hint' }, `材料放在 ${detail.dir}`),
                    ...(detail.manifest?.files ?? []).map((file) => h(
                      'div',
                      { key: file.key ?? file.path, className: 'nw-tp-file' },
                      h('span', { className: 'nw-tp-file-name' }, String(file.path ?? '').split(/[\\/]/).pop() ?? ''),
                      h('span', { className: 'nw-tp-file-why' }, String(file.why ?? '')),
                      h('span', { className: 'nw-tp-file-b' }, `${file.bytes ?? 0} B`),
                    )),
                    (detail.manifest?.omitted ?? []).length
                      ? h(
                        'div',
                        { className: 'nw-tp-omit' },
                        h('span', { className: 'nw-tp-omit-t' }, '故意没给'),
                        ...(detail.manifest?.omitted ?? []).map((row) => h(
                          'span',
                          { key: row.key, className: 'nw-tp-omit-row' },
                          `${row.key}：${String(row.why ?? '')}`,
                        )),
                      )
                      : null,
                    detail.promptSection
                      ? h(
                        'details',
                        { className: 'nw-tp-prompt' },
                        h('summary', null, '派单里写的「材料在哪」那一段'),
                        h('pre', { className: 'nw-tp-prompt-body' }, detail.promptSection),
                      )
                      : null,
                  ),
              ),
          )),
        )
        : h(Empty, null, '还没开过派单。开一张单时会自动造包。'),
  )
}

function DispatchRow({
  row, onPreview, onSend, onSpawn, onRevoke, onReport, busy, spawn,
}) {
  const meta = DISPATCH_STATUS_META[row.status] ?? { label: row.status, tone: 'grey' }
  return h(
    'div',
    { className: `nw-dp nw-dp-${row.status}` },
    h(
      'div',
      { className: 'nw-dp-head' },
      h('span', { className: 'nw-dp-role' }, row.roleLabel ?? row.role),
      h(Tag, { tone: meta.tone }, meta.label),
      row.chapter ? h(Tag, { tone: 'grey' }, `第 ${row.chapter} 回`) : null,
      h('span', { className: 'nw-dp-id' }, row.id),
    ),
    h('div', { className: 'nw-dp-task' }, row.task),
    h(
      'div',
      { className: 'nw-dp-meta' },
      h('span', null, `开票 ${String(row.createdAt ?? '').replace('T', ' ').slice(0, 16)}`),
      row.status === 'issued' || row.status === 'claimed'
        ? h('span', { className: 'nw-dp-left' }, dispatchLeft(row))
        : null,
      row.sessionId ? h('span', null, `已投递到 ${String(row.sessionId).slice(0, 8)}…`) : null,
      // 派子代理成功时才有 childId：它是宿主那边真实跑起来的那个代理。
      row.childId ? h('span', { className: 'nw-dp-child' }, `子代理 ${String(row.childId).slice(0, 8)}…`) : null,
      row.lastError ? h('span', { className: 'nw-dp-err' }, `投递失败：${row.lastError}`) : null,
    ),
    // 回执直接摊在票下面，不另开一页 —— 回执天然属于这张单。
    row.report
      ? h(
        'div',
        { className: 'nw-dp-report' },
        h('div', { className: 'nw-dp-report-head' }, '回执'),
        row.report.verdict
          ? h('div', { className: 'nw-dp-verdict' }, row.report.verdict)
          : null,
        (row.report.sections ?? []).map((sec, index) => h(
          'div',
          { className: 'nw-dp-sec', key: index },
          h('span', { className: 'nw-dp-sec-t' }, sec.title),
          h('span', { className: 'nw-dp-sec-b' }, sec.body),
        )),
      )
      : null,
    h(
      'div',
      { className: 'nw-dp-acts' },
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onPreview?.(row),
        disabled: busy || row.status === 'revoked' || row.status === 'expired',
      }, '看任务书'),
      // 派子代理和老路「发到对话」并列：前者是独立上下文 + 人格 + 工具白名单，
      // 后者是把任务书塞进你当前的对话。想让它别污染你的上下文就派子代理。
      h(Btn, {
        small: true,
        kind: 'primary',
        onClick: () => onSpawn?.(row),
        disabled: busy || row.status !== 'issued' || !spawn?.ok,
        title: spawn?.ok ? '开一个独立上下文的子代理，按岗位手册干活' : (spawn?.reason ?? '宿主不支持派子代理'),
      }, '派子代理'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onSend?.(row),
        disabled: busy || row.status !== 'issued',
      }, '发到对话'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onReport?.(row),
        disabled: busy || row.status !== 'issued' && row.status !== 'claimed',
      }, '贴回执'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onRevoke?.(row),
        disabled: busy || row.status === 'submitted' || row.status === 'revoked',
      }, '作废'),
    ),
  )
}

function PipelinePage({ projectId, project, toast, onRefresh }) {
  const state = useAsync(
    () => Promise.all([
      api('role.list', {}),
      api('dispatch.list', { projectId, limit: 50 }),
      api('report.list', { projectId, limit: 20 }),
      // 顺带问一句宿主能不能派子代理：按钮的亮灭据此决定。
      api('subagent.status', {}).catch((error) => ({ ok: false, reason: error.message })),
    ]).then(([roles, tickets, reports, spawn]) => ({
      roles, tickets, reports, spawn,
    })),
    [projectId],
    { skip: !projectId },
  )

  const [pickedRole, setPickedRole] = useState('')
  const [task, setTask] = useState('')
  const [chapter, setChapter] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  const [reportFor, setReportFor] = useState(null)
  const [reportText, setReportText] = useState('')

  const reload = state.reload
  const roles = state.data?.roles?.items ?? []
  const spawn = state.data?.spawn ?? { ok: false, reason: '还没问过宿主' }
  const tickets = state.data?.tickets?.items ?? []
  const reports = state.data?.reports?.items ?? []

  const doIssue = async () => {
    if (!projectId) {
      toast('先选一部作品')
      return
    }
    if (!pickedRole) {
      toast('先挑一个岗位')
      return
    }
    if (!task.trim()) {
      toast('写一句要它干什么')
      return
    }
    setBusy(true)
    try {
      const made = await api('dispatch.issue', {
        projectId,
        role: pickedRole,
        task: task.trim(),
        chapter: chapter ? Number(chapter) : 0,
      })
      setTask('')
      setChapter('')
      toast(`已开票 ${made.id}，去右边点「发到对话」`)
      reload()
      onRefresh?.()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const doPreview = async (row) => {
    setBusy(true)
    try {
      const out = await api('dispatch.send', { projectId, id: row.id, dryRun: true })
      setPreview({ id: row.id, prompt: out.prompt })
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  // 派子代理：走同一条 dispatch.send，多一个 spawn:true。
  // 宿主不支持时服务端会退回「发到对话」并把原因带回来，所以这里不必自己判两次。
  const doSpawn = async (row) => {
    setBusy(true)
    try {
      const out = await api('dispatch.send', { projectId, id: row.id, spawn: true })
      if (out?.spawned) {
        toast(out.personaApplied ? `已派 ${out.role}，人格与工具白名单都生效了` : `已派 ${out.role}，但人格没插进去（回执里能看出它没按手册说话）`)
      } else {
        toast(`派不了子代理（${out?.spawnReason ?? '未知原因'}），已退回发到对话`)
      }
      reload()
    } catch (error) {
      toast(error.message)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const doSend = async (row) => {
    setBusy(true)
    try {
      const out = await api('dispatch.send', { projectId, id: row.id })
      toast(out?.created ? '已新建一个对话并把单子发过去' : '已发到当前对话')
      reload()
    } catch (error) {
      // 报错本身有价值：说明票没发出去，票上会留 lastError。
      toast(error.message)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const doRevoke = async (row) => {
    setBusy(true)
    try {
      await api('dispatch.revoke', { projectId, id: row.id })
      toast('已作废')
      reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const doReport = async () => {
    if (!reportText.trim()) {
      toast('回执正文是空的')
      return
    }
    setBusy(true)
    try {
      await api('report.submit', { projectId, id: reportFor.id, text: reportText })
      setReportFor(null)
      setReportText('')
      toast('回执已收')
      reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const doSweep = async () => {
    setBusy(true)
    try {
      const out = await api('dispatch.sweep', { projectId })
      toast(out.swept ? `清掉 ${out.swept} 张过期票` : '没有过期票')
      reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (!projectId) {
    return h(Card, { title: '流水线' }, h(Empty, { text: '先选一部作品，再看派单' }))
  }

  return h(
    'div',
    { className: 'nw-pipe' },

    // ── 左：岗位 ──────────────────────────────────────────
    h(
      Card,
      {
        title: '谁来干',
        extra: h(Tag, { tone: 'grey' }, `${roles.length} 个岗位`),
        className: 'nw-pipe-roles',
      },
      h(Hint, null, '点一个岗位，右边就填好它。只有总编有权再往下派单，其余十个只能干活或提需求。'),
      state.loading && !roles.length
        ? h(Loading, { text: '读岗位…' })
        : h('div', { className: 'nw-role-grid' }, roles.map((role) => h(RoleCard, {
          role,
          key: role.id,
          onPick: (picked) => {
            setPickedRole(picked.id)
            toast(`选的是「${picked.label}」`)
          },
        }))),
    ),

    // ── 右：开票 + 单据 ─────────────────────────────────
    h(
      'div',
      { className: 'nw-pipe-right' },
      h(
        Card,
        { title: '开一张单', extra: h(Tag, { tone: 'blue' }, '60 分钟内有效') },
        h(
          'div',
          { className: 'nw-pipe-form' },
          h(Field, { label: '派给谁' }, h(Select, {
            value: pickedRole,
            onChange: setPickedRole,
            options: [{ value: '', label: '选一个岗位' }].concat(
              roles.map((role) => ({ value: role.id, label: `${role.label}${role.canDispatch ? '（可再派单）' : ''}` })),
            ),
          })),
          h(Field, { label: '第几回（可不填）' },
            h(Input, {
              value: chapter,
              onChange: (event) => setChapter(String(event?.target?.value ?? '').replace(/[^\d]/g, '')),
              placeholder: '例如 12',
            })),
          h(Field, { label: '要它干什么' },
            h(TextArea, {
              value: task,
              rows: 3,
              onChange: (event) => setTask(String(event?.target?.value ?? '')),
              placeholder: '一句话说清交付物，例如「按九字段细纲补齐第三卷 12–20 回」',
            })),
          h(
            'div',
            { className: 'nw-pipe-form-acts' },
            h(Btn, { kind: 'primary', onClick: doIssue, disabled: busy }, '开票'),
            h(Btn, { kind: 'ghost', onClick: doSweep, disabled: busy }, '清理过期票'),
          ),
        ),
      ),
      h(
        Card,
        {
          title: '单据',
          extra: h(Tag, { tone: 'grey' }, `${tickets.length} 张`),
        },
        state.error ? h(ErrorBox, { error: state.error, onRetry: reload }) : null,
        state.loading && !tickets.length ? h(Loading, { text: '读单据…' }) : null,
        !state.loading && !tickets.length
          ? h(Empty, { text: '还没有派过单。挑个岗位、写一句要它干什么，开一张试试。' })
          : h('div', { className: 'nw-dp-list' }, tickets.map((row) => h(DispatchRow, {
            row,
            key: row.id,
            busy,
            spawn,
            onPreview: doPreview,
            onSpawn: doSpawn,
            onSend: doSend,
            onRevoke: doRevoke,
            onReport: (target) => {
              setReportFor(target)
              setReportText('### 结论\n\n### 依据\n\n### 要别人做的事\n\n### 风险\n')
            },
          }))),
      ),
      reports.length
        ? h(
          Card,
          { title: '收到过的回执', extra: h(Tag, { tone: 'green' }, `${reports.length} 份`) },
          h('div', { className: 'nw-rep-list' }, reports.map((row) => h(
            'div',
            { className: 'nw-rep', key: row.id },
            h(
              'div',
              { className: 'nw-rep-head' },
              h('span', { className: 'nw-rep-role' }, row.roleLabel ?? row.role),
              h('span', { className: 'nw-rep-at' }, String(row.report?.at ?? '').replace('T', ' ').slice(0, 16)),
            ),
            h('div', { className: 'nw-rep-verdict' }, row.report?.verdict || '（没写结论）'),
          ))),
        )
        : null,
    ),

    // ── 任务包：派单材料是物证，作者得能打开看 ──────────
    h(TaskPackBoard, { projectId, toast, refreshKey: tickets.length }),

    // ── 任务书预览 ─────────────────────────────────────
    preview
      ? h(
        Modal,
        {
          title: `任务书 · ${preview.id}`,
          onClose: () => setPreview(null),
          footer: h(
            'div',
            { className: 'nw-pipe-modal-foot' },
            h(Btn, {
              kind: 'ghost',
              onClick: () => {
                const text = preview.prompt
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(text).then(
                    () => toast('已复制任务书'),
                    () => toast('复制失败，手动选中吧'),
                  )
                } else {
                  toast('这个环境拿不到剪贴板')
                }
              },
            }, '复制全文'),
            h(Btn, { kind: 'ghost', onClick: () => setPreview(null) }, '关上'),
          ),
        },
        h(Hint, null, '下面是实际会发出去的字。确认没问题再回单据上点「发到对话」。'),
        h('pre', { className: 'nw-pipe-prompt' }, preview.prompt),
      )
      : null,

    // ── 贴回执 ────────────────────────────────────────
    reportFor
      ? h(
        Modal,
        {
          title: `贴回执 · ${reportFor.id}`,
          onClose: () => setReportFor(null),
          footer: h(
            'div',
            { className: 'nw-pipe-modal-foot' },
            h(Btn, { kind: 'ghost', onClick: () => setReportFor(null) }, '算了'),
            h(Btn, { kind: 'primary', onClick: doReport, disabled: busy }, '收下'),
          ),
        },
        h(Hint, null, '四个 ### 小标题会被切成四段；少写几段也能收，不会因为格式不合规丢内容。'),
        h(TextArea, {
          value: reportText,
          rows: 12,
          onChange: (event) => setReportText(String(event?.target?.value ?? '')),
        }),
      )
      : null,
  )
}
