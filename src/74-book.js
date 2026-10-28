/**
 * 长夜 · 导出成书 + 检查更新（对齐 LNW 的两位邻居）
 *
 * 两件小事放一个文件，因为它们都是「关于这一版」而不是「关于这本书」：
 * 一个是把稿子交出去，一个是看看自己这版是不是旧的。
 */

/**
 * 导出成书：TXT / Markdown / EPUB / DOCX。
 *
 * 为什么不复用「导出全部数据」那个 zip：那个给的是磁盘目录，是给自己备份用的；
 * 这个给的是成品，是给读者、给投稿邮箱、给 epub 阅读器用的。两者的读者不一样，
 * 混在一起作者每次都要自己挑文件。
 */
function BookExport({ projectId, project, toast }) {
  const [format, setFormat] = useState('epub')
  const [busy, setBusy] = useState(false)
  const [skipRejected, setSkipRejected] = useState(true)

  const formats = [
    { value: 'txt', label: 'TXT', hint: '纯文本，一章一节' },
    { value: 'md', label: 'Markdown', hint: '带目录，方便再排版' },
    { value: 'epub', label: 'EPUB', hint: '电子书，手机阅读器能开' },
    { value: 'docx', label: 'DOCX', hint: 'Word 能开，宋体首行缩进' },
  ]

  const run = async () => {
    if (!projectId || busy) return
    setBusy(true)
    try {
      const base = String(bootInfo().apiUrl || ROUTE).replace(/\/+$/, '')
      const qs = new URLSearchParams({ projectId, format, skipRejected: skipRejected ? '1' : '0' })
      const res = await fetch(`${base}/book?${qs.toString()}`, { credentials: 'same-origin' })
      if (!res.ok) {
        let message = `导出失败（HTTP ${res.status}）`
        try {
          const data = await res.json()
          message = data?.error?.message || message
        } catch { /* 非 JSON 就用默认文案 */ }
        throw new Error(message)
      }
      const blob = await res.blob()
      const chapters = res.headers.get('x-nightwrite-chapters') ?? '?'
      const words = res.headers.get('x-nightwrite-words') ?? '?'
      const skipped = res.headers.get('x-nightwrite-skipped') ?? '0'
      const name = `${project?.name ?? projectId}.${format === 'md' ? 'md' : format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast(`已生成 ${chapters} 回 · ${words} 字${Number(skipped) ? `（跳过 ${skipped} 回）` : ''} · ${(blob.size / 1024).toFixed(0)} KB`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    { title: '导出成书', extra: h(Tag, { tone: 'green' }, '真文件') },
    h('p', { className: 'nw-hint' }, '把已写的章拼成一本完整的书。和上面的「导出全部数据」不同：那个给自己备份目录，这个给读者。'),
    h(
      'div',
      { className: 'nw-book-formats' },
      formats.map((item) => h(
        'button',
        {
          type: 'button',
          key: item.value,
          className: `nw-book-format${format === item.value ? ' on' : ''}`,
          'aria-pressed': format === item.value ? 'true' : 'false',
          onClick: () => setFormat(item.value),
        },
        h('span', { className: 'nw-book-format-name' }, item.label),
        h('span', { className: 'nw-book-format-hint' }, item.hint),
      )),
    ),
    h(
      'div',
      { className: 'nw-actions' },
      h(
        'label',
        { className: 'nw-book-skip' },
        h('input', {
          type: 'checkbox',
          checked: skipRejected,
          onChange: (event) => setSkipRejected(event.target.checked),
        }),
        h('span', null, '跳过被否掉的章'),
      ),
      h(Btn, { kind: 'primary', disabled: !projectId || busy, onClick: run }, busy ? '正在拼…' : '📖 生成并下载'),
    ),
    h(Hint, null, '章名取正文首行（形如「第X回 标题」），不会在正文里重复一遍。EPUB 自带目录页；DOCX 用宋体、首行缩进、1.5 倍行距。'),
  )
}

/**
 * 检查更新：只报告，不自动装。
 *
 * 装不装由人来按——写作中途被替换掉半本书是灾难，插件不该自己决定。
 */
function UpdateCard({ toast }) {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const installed = String(bootInfo().version ?? '0.1.0')

  const run = async (force) => {
    setBusy(true)
    try {
      const value = await api('update.check', { installed, force: force === true, timeoutMs: 5000 })
      setState(value)
      if (value.error) toast(value.error)
      else toast(value.hasUpdate ? `有新版 ${value.latest}` : '已经是最新的')
    } catch (error) {
      // 网络查不到不该让整张卡消失，留一句人能看懂的原因
      setState({ installed, error: error.message })
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    {
      title: '检查更新',
      extra: h('span', { className: 'nw-card-badge' }, installed),
    },
    h(KV, {
      rows: [
        { key: '当前版本', text: installed, mono: true },
        { key: 'npm 最新版', text: state ? (state.latest || '查不到') : '还没查', mono: true },
        { key: '差多少', text: state ? (state.error ? '—' : state.behind) : '—' },
      ],
    }),
    state?.error
      ? h('p', { className: 'nw-update-err' }, state.error)
      : null,
    h(
      'div',
      { className: 'nw-actions' },
      h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: () => run(false) }, busy ? '查着…' : '查一下'),
      h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: () => run(true) }, '强制刷新（跳过缓存）'),
      state?.hasUpdate
        ? h(Tag, { tone: 'amber' }, `可升到 ${state.latest}`)
        : null,
    ),
    h(Hint, null, '只查不改：长夜是本地开发版，升级方式是改完源码再同步到 profile，不需要 npm install。查询结果缓存 6 小时，查不到也缓存 10 分钟，免得每开一次设置页都卡一下。'),
  )
}
