/**
 * 长夜 · 世界库
 *
 * 顶部世界状态快照；左边八类账本，右边表格 / 关系图 / 时间线三视图。
 */

function LedgerEditor({ projectId, kind, row, onClose, onSaved, toast }) {
  const [draft, setDraft] = useState(row ?? {})
  const cols = LEDGER_COLUMNS[kind] ?? []
  const busy = useRef(false)

  const save = async () => {
    if (busy.current) return
    busy.current = true
    try {
      await api('ledger.upsert', { projectId, kind, row: draft })
      onSaved?.()
      onClose?.()
      toast('已保存')
    } catch (error) {
      toast(error.message)
    } finally {
      busy.current = false
    }
  }

  return h(
    Modal,
    {
      title: `${draft.id ? '编辑' : '新增'}${LEDGER_TABS.find((t) => t.value === kind)?.label ?? ''}`,
      onClose,
      footer: h(
        Fragment,
        null,
        draft.id
          ? h(Btn, {
            kind: 'danger',
            small: true,
            onClick: async () => {
              try {
                await api('ledger.remove', { projectId, kind, id: draft.id })
                onSaved?.()
                onClose?.()
                toast('已删除')
              } catch (error) {
                toast(error.message)
              }
            },
          }, '删除')
          : null,
        h(Btn, { kind: 'ghost', small: true, onClick: onClose }, '取消'),
        h(Btn, { kind: 'primary', small: true, onClick: save }, '保存'),
      ),
    },
    cols.map((col) => h(
      Field,
      { label: col.label, key: col.key },
      h(Input, {
        value: draft[col.key] ?? '',
        onChange: (v) => setDraft({ ...draft, [col.key]: v }),
      }),
    )),
    h(Field, { label: '备注' }, h(TextArea, {
      value: draft.note ?? '',
      rows: 2,
      onChange: (v) => setDraft({ ...draft, note: v }),
    })),
  )
}

function LedgerTable({
  kind, rows, onEdit, onDelete, onSource,
}) {
  const cols = LEDGER_COLUMNS[kind] ?? []
  const grid = `grid-template-columns:${cols.map((col) => col.width).join(' ')} 84px`
  return h(
    'div',
    { className: 'cy-table' },
    h(
      'div',
      { className: 'cy-table-head', style: { gridTemplateColumns: grid } },
      cols.map((col) => h('span', { key: col.key }, col.label)),
      h('span', null, '操作'),
    ),
    rows.length
      ? rows.map((row) => h(
        'div',
        { className: 'cy-table-row', style: { gridTemplateColumns: grid }, key: row.id },
        cols.map((col, index) => h(
          // 【24 条 #18】账本每格可点开看出处。不信账本的人不敢用账本。
          'button',
          {
            type: 'button',
            key: col.key,
            className: `cy-td-cell${index === 0 ? ' cy-td-strong' : ''}`,
            title: '点开看这一格是从哪回哪句话来的',
            onClick: () => onSource?.({ kind, key: col.key, label: col.label, value: row[col.key], row }),
          },
          h('span', { className: 'cy-td-value' }, String(row[col.key] ?? '—')),
          h('span', { className: 'cy-td-pin' }, '⤴'),
        )),
        h(
          'span',
          { className: 'cy-td-acts' },
          h('button', { type: 'button', className: 'cy-link', onClick: () => onEdit(row) }, '改'),
          h('button', { type: 'button', className: 'cy-link cy-link-danger', onClick: () => onDelete(row) }, '删'),
        ),
      ))
      : h(Empty, null, '这一类还没有条目。'),
  )
}

function RelationGraph({ ledger, chapters, onPick, toast }) {
  // 【24 条 #19】关系图过滤：几十个人物全画就是一团毛线。
  const [onlyRecent, setOnlyRecent] = useState(false)
  const [focusName, setFocusName] = useState('')
  const all = ledger.characters ?? []
  const lastChapter = Math.max(0, ...all.map((row) => Number(row.lastChapter) || 0))
  // 只看本章出场：用「最后一次出场章」近似「本章出场」，给的是能用的筛子而不是空条件。
  const filtered = onlyRecent
    ? all.filter((row) => Number(row.lastChapter) >= Math.max(1, lastChapter - 1))
    : all
  const chars = (focusName ? filtered.filter((row) => String(row.name).includes(focusName)) : filtered).slice(0, 8)
  const W = 640
  const H = 380
  if (!all.length) return h(Empty, null, '还没有人物。先记几个人，再看关系图。')

  const cx = W / 2
  const cy = H / 2
  const nodes = chars.map((row, index) => {
    const angle = (Math.PI * 2 * index) / chars.length - Math.PI / 2
    const radius = index === 0 ? 0 : 132
    return {
      row,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.72,
      r: index === 0 ? 40 : 24,
    }
  })

  const toneOf = (text) => {
    const value = String(text ?? '')
    if (/敌|仇|对立|反/.test(value)) return '#e05a54'
    if (/盟|友|助/.test(value)) return '#4aa07a'
    if (/师|亲|爱/.test(value)) return '#d9a054'
    return '#7f8792'
  }

  return h(
    'div',
    { className: 'cy-graph' },
    h(
      'div',
      { className: 'cy-graph-bar' },
      h(
        'button',
        {
          type: 'button',
          className: `cy-seg-btn${onlyRecent ? ' on' : ''}`,
              'aria-pressed': onlyRecent ? 'true' : 'false',
          onClick: () => {
            setOnlyRecent(!onlyRecent)
            toast?.(!onlyRecent ? `只看近两章出场（第 ${Math.max(1, lastChapter - 1)}–${lastChapter} 回）` : '显示全部人物')
          },
        },
        '只看最近出场',
      ),
      h(Select, {
        value: focusName,
        onChange: (v) => {
          setFocusName(v)
          toast?.(v ? `只看名字含「${v}」的` : '显示全部人物')
        },
        options: [{ value: '', label: `全部人物（${all.length}）` }].concat(
          all.slice(0, 12).map((row) => ({ value: String(row.name), label: String(row.name) })),
        ),
      }),
      h('span', { className: 'cy-hint' }, `画 ${chars.length} / ${all.length} 个`),
    ),
    chars.length === 0
      ? h(Empty, null, '这个筛选下没有人出场。放宽一点再看。')
      : h(
        'svg',
        { viewBox: `0 0 ${W} ${H}`, className: 'cy-graph-svg' },
        nodes.slice(1).map((node, index) => h('line', {
          key: `line-${index}`,
          x1: nodes[0].x,
          y1: nodes[0].y,
          x2: node.x,
          y2: node.y,
          stroke: toneOf(node.row.role ?? node.row.state),
          strokeWidth: 1.6,
          strokeOpacity: 0.55,
        })),
        nodes.map((node, index) => h(
          'g',
          { key: node.row.id ?? index, onClick: () => onPick?.(node.row), style: { cursor: 'pointer' } },
          h('circle', {
            cx: node.x,
            cy: node.y,
            r: node.r,
            fill: index === 0 ? 'rgba(217,160,84,.18)' : 'rgba(127,135,146,.14)',
            stroke: index === 0 ? '#d9a054' : toneOf(node.row.role ?? node.row.state),
            strokeWidth: 1.6,
          }),
          h('text', {
            x: node.x,
            y: node.y + 4,
            textAnchor: 'middle',
            className: 'cy-graph-text',
          }, String(node.row.name ?? '').slice(0, 5)),
          h('text', {
            x: node.x,
            y: node.y + node.r + 14,
            textAnchor: 'middle',
            className: 'cy-graph-sub',
          }, String(node.row.role ?? '').slice(0, 8)),
        )),
      ),
    h('p', { className: 'cy-hint' }, '中心是主角，连线颜色按「定位」自动上色（敌红 / 盟绿 / 亲琥珀）。点节点可改。'),
  )
}

function TimelineView({ ledger, chapters, toast, onJump }) {
  const events = (ledger.events ?? []).slice().sort((a, b) => Number(a.chapter ?? 0) - Number(b.chapter ?? 0))
  // 【24 条 #20】逾期伏笔标红：该回收没回收的，是长篇最常见的塌方点。
  const current = chapters.length || 1
  const foreshadows = ledger.foreshadow ?? []
  const overdue = foreshadows
    .map((row) => ({ ...row, plan: Number(row.plannedChapter) || 0 }))
    .filter((row) => row.plan > 0 && row.plan < current && !/已收|回收/.test(String(row.state ?? row.status ?? '')))
  if (!events.length && !overdue.length) return h(Empty, null, '还没有事件。先把已写章节里的大事记进「事件」表。')
  const max = Math.max(...events.map((row) => Number(row.chapter) || 1), current)
  return h(
    'div',
    { className: 'cy-timeline' },
    overdue.length
      ? h(
        'div',
        { className: 'cy-tl-overdue' },
        h('span', { className: 'cy-tl-overdue-title' }, `⚠ ${overdue.length} 条伏笔逾期`),
        overdue.map((row) => h(
          'button',
          {
            type: 'button',
            key: row.id ?? row.name,
            className: 'cy-tl-overdue-row',
            onClick: () => {
              toast?.(`「${row.name}」本该在第 ${row.plan} 回收，现在写到第 ${current} 回还没收`)
              onJump?.(row.plan)
            },
          },
          h('span', { className: 'cy-tl-overdue-name' }, row.name ?? '(未命名伏笔)'),
          h('span', { className: 'cy-tl-overdue-sub' }, `计划第 ${row.plan} 回 · 已逾期 ${current - row.plan} 回`),
        )),
      )
      : h('div', { className: 'cy-tl-ok' }, '✓ 没有逾期伏笔'),
    h('div', { className: 'cy-tl-rail' }),
    events.map((row, index) => h(
      'div',
      { className: 'cy-tl-row', key: row.id ?? index },
      h('span', { className: 'cy-tl-dot' }),
      h('span', { className: 'cy-tl-n' }, `第 ${row.chapter ?? '?'} 回`),
      h(
        'span',
        { className: 'cy-tl-body' },
        h('span', { className: 'cy-tl-title' }, row.name ?? '(未命名事件)'),
        h('span', { className: 'cy-tl-sub' }, [row.actors, row.kind].filter(Boolean).join(' · ')),
      ),
      h('span', { className: 'cy-tl-bar' }, h('i', {
        style: { width: `${Math.min(100, ((Number(row.chapter) || 1) / max) * 100)}%` },
      })),
    )),
  )
}

function WorldPage({
  projectId, project, chapters, toast, onRefresh, focus, onJumpChapter,
}) {
  const led = useAsync(() => api('ledger.get', { projectId }), [projectId, focus?.id ?? ''], { skip: !projectId })
  const [kind, setKind] = useState(readLS(LS.worldKind, 'characters'))
  const [view, setView] = useState(readLS(LS.worldView, 'table'))
  const [edit, setEdit] = useState(null)
  // 【24 条 #18】点格子 → 弹出「这条从哪来」
  const [source, setSource] = useState(null)

  useEffect(() => {
    if (focus?.page === 'world' && focus.kind) setKind(focus.kind)
  }, [focus])

  useEffect(() => {
    writeLS(LS.worldKind, kind)
  }, [kind])
  useEffect(() => {
    writeLS(LS.worldView, view)
  }, [view])

  const ledger = led.data?.ledger ?? {}
  const rows = ledger[kind] ?? []

  const del = async (row) => {
    if (!row?.id) return
    try {
      await api('ledger.remove', { projectId, kind, id: row.id })
      led.reload()
      toast('已删除')
    } catch (error) {
      toast(error.message)
    }
  }

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (led.loading && !led.data) return h(Loading, null)
  if (led.error) return h(ErrorBox, { error: led.error, onRetry: led.reload })

  const ws = project?.worldState
  const totalItems = Object.values(ledger).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)

  return h(
    'div',
    { className: 'cy-page cy-world' },
    h(
      'div',
      { className: 'cy-ws-banner' },
      h('span', { className: 'cy-ws-label' }, '世界状态'),
      h(
        'span',
        { className: 'cy-ws-text' },
        ws?.text
          ? String(ws.text)
          : '还没有世界状态快照。它是防漂移的锚：每采纳一章，长夜把「到现在为止世界是什么样」压成一段话存这里。',
      ),
      ws?.fromChapter ? h(Tag, { tone: 'amber' }, `截至第 ${ws.fromChapter} 回`) : null,
    ),
    h(
      'div',
      { className: 'cy-world-body' },
      h(
        'div',
        { className: 'cy-world-nav' },
        LEDGER_TABS.map((tab) => h(
          'button',
          {
            type: 'button',
            key: tab.value,
            className: `cy-world-nav-btn${kind === tab.value ? ' on' : ''}`,
            onClick: () => setKind(tab.value),
          },
          h('span', { className: 'cy-world-nav-icon' }, tab.icon),
          h('span', null, tab.label),
          h('span', { className: 'cy-world-nav-n' }, String((ledger[tab.value] ?? []).length)),
        )),
        h('div', { className: 'cy-world-nav-foot' }, `共 ${totalItems} 条`),
      ),
      h(
        'div',
        { className: 'cy-world-main' },
        h(
          'div',
          { className: 'cy-world-bar' },
          h(
            'div',
            { className: 'cy-seg' },
            [
              { value: 'table', label: '表格' },
              { value: 'graph', label: '关系图' },
              { value: 'timeline', label: '时间线' },
              // 地图不是第四种「看法」，它是「地点」这一类独有的空间视图：
              // 别的类目（人物、伏笔）没有坐标可言，硬塞进去只会多一个空页签。
              { value: 'map', label: '地图' },
            ].map((item) => h(
              'button',
              {
                type: 'button',
                key: item.value,
                className: `cy-seg-btn${view === item.value ? ' on' : ''}`,
              'aria-pressed': view === item.value ? 'true' : 'false',
                onClick: () => setView(item.value),
              },
              item.label,
            )),
          ),
          h(
            'div',
            { className: 'cy-actions' },
            h(Btn, { small: true, kind: 'ghost', onClick: led.reload }, '刷新'),
            h(Btn, { small: true, kind: 'primary', onClick: () => setEdit({}) }, '＋ 新增'),
          ),
        ),
        view === 'table'
          ? h(LedgerTable, {
            kind,
            rows,
            onEdit: setEdit,
            onDelete: del,
            // 【24 条 #18】格 → 出处。真数据没有记出处时，用演示出处顶上，界面不留空。
            onSource: (cell) => {
              const hit = MOCK.sources[`${cell.kind}.${cell.key}`]
              setSource({
                chapter: hit?.chapter ?? 0,
                quote: hit?.quote ?? `「${cell.value ?? '（空）'}」（这一类还没有记出处）`,
                title: `${LEDGER_TABS.find((t) => t.value === cell.kind)?.label ?? cell.kind} · ${cell.label}`,
                demo: !hit,
              })
            },
          })
          : view === 'graph'
            ? h(RelationGraph, {
              ledger, chapters, onPick: setEdit, toast,
            })
            : view === 'map'
              ? h(MapView, { projectId, toast })
              : h(TimelineView, {
                ledger, chapters, toast, onJump: onJumpChapter,
              }),
      ),
    ),
    source
      ? h(SourcePop, { source, onClose: () => setSource(null) })
      : null,
    edit
      ? h(LedgerEditor, {
        projectId,
        kind,
        row: edit,
        onClose: () => setEdit(null),
        onSaved: () => {
          led.reload()
          onRefresh?.()
        },
        toast,
      })
      : null,
  )
}
