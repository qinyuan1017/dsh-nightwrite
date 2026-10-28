/**
 * 长夜 · 侦察
 *
 * 拆文 / 扫榜 / 资料 / 封面 四块。
 * 这些活由本机已安装的 oh-story 技能承担：这里只做任务登记与交接，
 * 不假装面板自己能跑（技能是 agent 读的 SOP）。
 */

const SCOUT_CASES = [
  {
    id: 'analyze',
    icon: '🧪',
    name: '拆文',
    skill: 'story-long-analyze / story-short-analyze',
    desc: '把一本别人的书拆成黄金三章、逐章摘要、节奏、人物、设定、文风接口，产出喂给写作流程。',
    prompt: '用 story-long-analyze 拆这本书：',
    need: '一本书的正文文件或目录路径',
  },
  {
    id: 'scan',
    icon: '📊',
    name: '扫榜',
    skill: 'story-long-scan / story-short-scan',
    desc: '看起点、番茄、晋江、七猫的榜与新书，提炼当前什么题材在涨，落到可执行的开书方向。',
    prompt: '用 story-long-scan 扫一遍当前长篇榜单，给出三个可开的方向：',
    need: '平台与题材偏好（可留空让技能自己判定）',
  },
  {
    id: 'research',
    icon: '📚',
    name: '资料研究',
    skill: 'story-researcher（角色）',
    desc: '为具体桥段查真实史料、行业细节、地理气候，交回可引用的结论与出处。',
    prompt: '派 story-researcher 查这些背景：',
    need: '要查的具体问题清单',
  },
  {
    id: 'cover',
    icon: '🎨',
    name: '封面',
    skill: 'story-cover',
    desc: '按书名与作者名分析题材风格，生成带标题与署名的网文封面。',
    prompt: '用 story-cover 给这本书做封面：',
    need: '确认书名、作者署名与想要的风格',
  },
]

// ── 21. 最近干过什么 ──────────────────────────────────────

function ScoutHistory({ toast }) {
  const [open, setOpen] = useState('h1')
  return h(
    Card,
    { title: '最近干过什么', extra: h('span', { className: 'nw-card-badge' }, `${MOCK.history.length} 条`) },
    h('div', { className: 'nw-hist' }, MOCK.history.map((row) => h(
      'div',
      { className: `nw-hist-row${open === row.id ? ' on' : ''}`, key: row.id },
      h(
        'button',
        {
          type: 'button',
          className: 'nw-hist-main',
          onClick: () => {
            const next = open === row.id ? '' : row.id
            setOpen(next)
            if (next) toast?.(`${row.title} · ${row.at}`)
          },
        },
        h('span', { className: 'nw-hist-icon' }, row.icon),
        h(
          'span',
          { className: 'nw-hist-body' },
          h('span', { className: 'nw-hist-title' }, row.title),
          h('span', { className: 'nw-hist-sub' }, row.sub),
        ),
        h(Tag, { tone: 'grey' }, row.kind),
        h('span', { className: 'nw-hist-at' }, row.age),
        h('span', { className: 'nw-prop-go' }, open === row.id ? '▾' : '▸'),
      ),
      open === row.id
        ? h(
          'div',
          { className: 'nw-hist-detail' },
          h('p', null, `${row.sub}`),
          h('p', { className: 'nw-hint' }, `发生时间：${row.at} · 产出已落回工作区（演示数据）`),
          h(
            'div',
            { className: 'nw-actions' },
            h(Btn, { small: true, kind: 'ghost', onClick: () => toast?.(`打开产物：${row.title}（演示）`) }, '打开产物'),
            h(Btn, { small: true, kind: 'ghost', onClick: () => toast?.(`已按「${row.kind}」再跑一次（演示）`) }, '再跑一次'),
          ),
        )
        : null,
    ))),
  )
}

// ── 22. 扫榜结果表格 ──────────────────────────────────────

function ScanTable({ toast }) {
  const [sortKey, setSortKey] = useState('rank')
  const [asc, setAsc] = useState(true)
  const cols = [
    { key: 'rank', label: '#', num: true },
    { key: 'platform', label: '平台' },
    { key: 'book', label: '书名' },
    { key: 'genre', label: '题材' },
    { key: 'collect', label: '收藏' },
    { key: 'hook', label: '钩子' },
    { key: 'trend', label: '趋势' },
  ]
  const rows = useMemo(() => {
    const list = MOCK.scan.slice()
    const weight = (row) => {
      if (sortKey === 'rank') return row.rank
      if (sortKey === 'collect') return parseFloat(String(row.collect)) * (/万/.test(row.collect) ? 10000 : 1)
      if (sortKey === 'trend') return parseInt(String(row.trend).replace(/[^-\d]/g, ''), 10) || 0
      return String(row[sortKey])
    }
    list.sort((a, b) => {
      const x = weight(a)
      const y = weight(b)
      if (typeof x === 'string') return asc ? x.localeCompare(y) : y.localeCompare(x)
      return asc ? x - y : y - x
    })
    return list
  }, [sortKey, asc])

  return h(
    Card,
    {
      title: '扫榜结果',
      extra: h('div', { className: 'nw-actions' },
        h(Tag, { tone: 'blue' }, '演示数据'),
        h(Btn, {
          small: true,
          kind: 'ghost',
          onClick: () => toast?.('已导出 CSV（演示，未落盘）'),
        }, '导出 CSV')),
    },
    h(
      'div',
      { className: 'nw-scan' },
      h(
        'div',
        { className: 'nw-scan-head' },
        cols.map((col) => h(
          'button',
          {
            type: 'button',
            key: col.key,
            className: `nw-scan-th${sortKey === col.key ? ' on' : ''}`,
            onClick: () => {
              if (sortKey === col.key) setAsc(!asc)
              else {
                setSortKey(col.key)
                setAsc(true)
              }
              toast?.(`按「${col.label}」${sortKey === col.key && asc ? '降序' : '升序'}排序`)
            },
          },
          col.label,
          sortKey === col.key ? (asc ? ' ↑' : ' ↓') : '',
        )),
      ),
      rows.map((row) => h(
        'button',
        {
          type: 'button',
          className: 'nw-scan-row',
          key: row.rank,
          onClick: () => toast?.(`《${row.book}》· ${row.platform} · ${row.genre} · 收藏 ${row.collect} · 钩子：${row.hook}`),
        },
        h('span', { className: 'nw-scan-td nw-scan-rank' }, String(row.rank)),
        h('span', { className: 'nw-scan-td' }, row.platform),
        h('span', { className: 'nw-scan-td nw-scan-book' }, row.book),
        h('span', { className: 'nw-scan-td' }, h(Tag, { tone: 'grey' }, row.genre)),
        h('span', { className: 'nw-scan-td nw-scan-num' }, row.collect),
        h('span', { className: 'nw-scan-td nw-scan-hook' }, row.hook),
        h('span', { className: `nw-scan-td nw-scan-trend${/↓/.test(row.trend) ? ' down' : /↑/.test(row.trend) ? ' up' : ''}` }, row.trend),
      )),
    ),
  )
}

function ScoutPage({
  projectId, project, toast, onRefresh,
}) {
  const [pick, setPick] = useState(null)
  const [detail, setDetail] = useState('')

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('已复制，粘到对话里发出去就行')
    } catch {
      toast('复制失败，手动选中吧')
    }
  }

  const launch = (item) => {
    setPick(item)
    setDetail('')
  }

  const command = pick
    ? `${pick.prompt}${detail ? `\n\n${detail}` : ''}${project?.name ? `\n\n（作品：${project.name}${project.genre ? ` · ${project.genre}` : ''}）` : ''}`
    : ''

  return h(
    'div',
    { className: 'nw-page nw-scout' },
    h('p', { className: 'nw-scout-lead' }, '这四件事由本机已安装的 oh-story 技能承担。长夜只负责把任务说清楚，然后交给对话里的 agent。'),
    h(
      'div',
      { className: 'nw-scout-grid' },
      SCOUT_CASES.map((item) => h(
        'section',
        { className: 'nw-scout-card', key: item.id },
        h('div', { className: 'nw-scout-head' }, h('span', { className: 'nw-scout-icon' }, item.icon), h('h3', null, item.name)),
        h('p', { className: 'nw-scout-desc' }, item.desc),
        h('div', { className: 'nw-scout-meta' },
          h(Tag, { tone: 'teal' }, item.skill),
          h('span', { className: 'nw-hint' }, item.need)),
        // 四张卡各有一个「组装指令」，读屏念四下同名的按钮分不清点的是哪个。
        // 名字里带上这一格做什么，才认得出。
        h(Btn, { kind: 'ghost', small: true, onClick: () => launch(item), title: `${item.name}：${item.desc}` }, `组装指令 · ${item.name}`),
      )),
    ),
    // 【24 条 #21】最近干过什么：点完就忘是现在的毛病。
    h(ScoutHistory, { toast }),
    // 【24 条 #22】扫榜结果做成表格：能排序，能点开。
    h(ScanTable, { toast }),
    // 第 2/3/4 批：拆书 / 导入 / 扫榜三件真能跑的活。
    // 上面四张卡是「交给 agent」，下面三块是「当场就出结果」——
    // 能算的立刻算，算不了的才去麻烦 agent。
    h(AnalyzePanel, { projectId, toast }),
    h(ImportPanel, { projectId, toast, onRefresh }),
    h(ScanBoard, { projectId, toast }),
    pick
      ? h(
        Modal,
        {
          title: `交给 ${pick.name}`,
          onClose: () => setPick(null),
          footer: h(
            Fragment,
            null,
            h(Btn, { kind: 'ghost', small: true, onClick: () => setPick(null) }, '关掉'),
            h(Btn, { kind: 'primary', small: true, onClick: () => copy(command) }, '复制指令'),
          ),
        },
        h(Field, { label: pick.need }, h(TextArea, {
          value: detail,
          rows: 5,
          onChange: setDetail,
          placeholder: '把具体要查 / 要拆的东西写在这里',
        })),
        h(Field, { label: '将发出的指令' }, h('pre', { className: 'nw-cmd' }, command)),
        h('p', { className: 'nw-hint' }, '复制后粘到对话里。技能会自己读 SOP、自己派角色、把结果落回工作区。'),
      )
      : null,
  )
}
