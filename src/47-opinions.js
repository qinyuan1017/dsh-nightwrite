/**
 * 长夜 · 冷读与意见池（LNW 的两位邻居）
 *
 * 为什么放在验收台而不是单开一页：冷读和意见池都只在「稿子交上来之后」有用，
 * 和人拍板是同一时刻的事。单开一页会变成「想起来才去看一眼」。
 *
 * 这里刻意不做「一键采纳并自动改稿」。意见池记的是别人的话，改不改是作者的事；
 * 自动改稿会让人分不清「AI 意见」和「已经改好了」——一旦混起来，作者就没法
 * 再信任自己看到的那份正文。
 */

/**
 * 冷读：把稿子交给一个没读过设定的人。
 */
function ColdReadPanel({ projectId, chapters, toast, onOpenChapter }) {
  const list = useAsync(() => api('coldread.list', { projectId }), [projectId], { skip: !projectId })
  const [scope, setScope] = useState('chapter')
  const [chapter, setChapter] = useState('')
  const [busy, setBusy] = useState(false)
  const [pkg, setPkg] = useState(null)
  const [paste, setPaste] = useState('')

  const chapterOptions = (Array.isArray(chapters) ? chapters : [])
    .filter((row) => String(row.status) !== 'rejected')
    .map((row) => ({ value: String(row.chapter), label: `第 ${row.chapter} 回${row.title ? `「${row.title}」` : ''}` }))

  useEffect(() => {
    if (!chapter && chapterOptions.length) setChapter(chapterOptions[chapterOptions.length - 1].value)
  }, [chapterOptions.length])

  const prepare = async () => {
    if (!projectId || busy) return
    setBusy(true)
    try {
      const payload = { projectId, scope }
      if (scope === 'chapter') payload.chapter = Number(chapter)
      const value = await api('coldread.prepare', payload)
      setPkg(value)
      list.reload()
      toast(`已生成冷读包：${value.chapters.length} 回 / ${value.words} 字`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const copyPrompt = async () => {
    if (!pkg?.prompt) return
    try {
      await navigator.clipboard.writeText(pkg.prompt)
      toast('提示词已复制，粘到对话里让 agent 读那个 txt')
    } catch {
      toast('复制失败，手动选中下面那段文字')
    }
  }

  // 回执是模型给的一段文字。这里让人粘贴回来，服务端按「第N回：」切成条目。
  const submit = async () => {
    const text = String(paste ?? '').trim()
    if (!text) {
      toast('先把回执粘进来')
      return
    }
    const scoreMatch = text.match(/(\d{1,3})\s*分/) || text.match(/分数[:：]?\s*(\d{1,3})/)
    const verdictMatch = text.match(/(建议[^\n。]{0,20}|接纳|退修|拒稿|再看看|弃书|继续追)/)
    const items = []
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      const hit = line.match(/第\s*(\d+)\s*[回章节][:：]?\s*(.+)$/)
      if (!hit) continue
      const body = hit[2].trim()
      if (body.length < 4) continue
      items.push({
        chapter: Number(hit[1]),
        kind: /高光/.test(line) ? 'highlight' : 'weakness',
        comment: body.slice(0, 300),
        severity: /硬伤/.test(line) ? 'major' : 'minor',
      })
    }
    try {
      const value = await api('coldread.submit', {
        projectId,
        score: scoreMatch ? Number(scoreMatch[1]) : undefined,
        verdict: verdictMatch ? verdictMatch[1] : '',
        items,
        file: pkg?.fileName ?? '',
      })
      setPaste('')
      toast(`回执已入库：${value.pooled.added} 条进意见池${value.score ? ` · ${value.score} 分` : ''}`)
    } catch (error) {
      toast(error.message)
    }
  }

  return h(
    Card,
    { title: '冷读', extra: h(Tag, { tone: 'blue' }, '陌生人视角') },
    h('p', { className: 'nw-hint' }, '把稿子汇成一份 txt，交给一个没读过任何设定的人一次读完。它不查设定矛盾，只回答一个问题：读到这里，想不想继续看。'),
    h(
      'div',
      { className: 'nw-cold-form' },
      h(
        'div',
        { className: 'nw-seg' },
        [
          { value: 'chapter', label: '单章' },
          { value: 'book', label: '整本' },
        ].map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-seg-btn${scope === item.value ? ' on' : ''}`,
            'aria-pressed': scope === item.value ? 'true' : 'false',
            onClick: () => setScope(item.value),
          },
          item.label,
        )),
      ),
      scope === 'chapter'
        ? h(Select, {
          value: chapter,
          onChange: setChapter,
          options: chapterOptions.length ? chapterOptions : [{ value: '', label: '（还没有可读的章）' }],
        })
        : null,
      h(Btn, { small: true, kind: 'primary', disabled: busy || !projectId, onClick: prepare }, busy ? '正在汇总…' : '生成冷读包'),
    ),
    pkg
      ? h(
        'div',
        { className: 'nw-cold-pkg' },
        h('div', { className: 'nw-cold-file' }, `📄 ${pkg.fileName}`),
        h('div', { className: 'nw-hint' }, `${pkg.chapters.length} 回 · ${pkg.words} 字${pkg.truncated ? '（原文更长，只放了前一部分）' : ''}`),
        h(
          'div',
          { className: 'nw-actions' },
          h(Btn, { small: true, kind: 'ghost', onClick: copyPrompt }, '复制提示词'),
        ),
        h('pre', { className: 'nw-cold-prompt' }, pkg.prompt),
      )
      : null,
    h(
      'div',
      { className: 'nw-cold-submit' },
      h(Field, { label: '把回执粘回来' }, h(TextArea, {
        value: paste,
        rows: 4,
        placeholder: '第 12 回：这里主角的选择不成立，他刚说过不去，下一段又去了。',
        onChange: setPaste,
      })),
      h(
        'div',
        { className: 'nw-actions' },
        h(Btn, { small: true, kind: 'primary', onClick: submit }, '存进意见池'),
        h('span', { className: 'nw-hint' }, '以「第N回：」开头的行会被切成一条条意见；带「高光」的记为高光。'),
      ),
    ),
    (list.data?.items ?? []).length
      ? h(
        'details',
        { className: 'nw-cold-history' },
        h('summary', null, `生成过的冷读包（${list.data.items.length}）`),
        ...list.data.items.slice(0, 12).map((row) => h(
          'div',
          { className: 'nw-cold-histrow', key: row.name },
          h('span', { className: 'nw-cold-histname' }, row.name),
          h('span', { className: 'nw-hint' }, `${(row.bytes / 1024).toFixed(0)} KB`),
        )),
      )
      : null,
  )
}

/**
 * 意见池：把四处的意见拉到一张表上。
 */
function OpinionBoard({ projectId, toast, refreshKey, onOpenChapter }) {
  const [status, setStatus] = useState('open')
  const [source, setSource] = useState('')
  const list = useAsync(
    () => api('opinion.list', { projectId, status: status || undefined, source: source || undefined }),
    [projectId, status, source, refreshKey],
    { skip: !projectId },
  )
  const [collecting, setCollecting] = useState(false)

  const counts = list.data?.counts ?? { open: 0, adopted: 0, dismissed: 0, total: 0 }

  const collect = async () => {
    setCollecting(true)
    try {
      const value = await api('opinion.collect', { projectId })
      list.reload()
      toast(value.added ? `从问题单和 AI 味命中拉进来 ${value.added} 条` : '没有新的可拉')
    } catch (error) {
      toast(error.message)
    } finally {
      setCollecting(false)
    }
  }

  const decide = async (row, next) => {
    try {
      await api('opinion.decide', { projectId, id: row.id, status: next })
      list.reload()
      toast(next === 'adopted' ? '记为采纳' : next === 'dismissed' ? '记为不改' : '重新挂起')
    } catch (error) {
      toast(error.message)
    }
  }

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (list.loading && !list.data) return h(Loading, null)
  if (list.error) return h(ErrorBox, { error: list.error, onRetry: list.reload })

  const rows = list.data?.items ?? []
  const SOURCE_LABEL = {
    coldread: '冷读',
    reader: '模拟读者',
    consistency: '审校',
    lint: '机器检测',
    author: '作者',
    other: '其它',
  }

  return h(
    Card,
    {
      title: '意见池',
      extra: h(
        'div',
        { className: 'nw-actions' },
        h('span', { className: 'nw-card-badge' }, `${counts.total}`),
        h(Btn, { small: true, kind: 'ghost', disabled: collecting, onClick: collect }, collecting ? '拉着…' : '从问题单拉一遍'),
      ),
    },
    h('p', { className: 'nw-hint' }, '别人说过的、自己记下的、机器扫出来的，都在这里。它只汇总，不替你判断——采纳与否是你的事。'),
    h(
      'div',
      { className: 'nw-seg' },
      [
        { value: 'open', label: '待处理' },
        { value: 'adopted', label: '已采纳' },
        { value: 'dismissed', label: '不改' },
        { value: '', label: '全部' },
      ].map((item) => h(
        'button',
        {
          type: 'button',
          key: item.value || 'all',
          className: `nw-seg-btn${status === item.value ? ' on' : ''}`,
          'aria-pressed': status === item.value ? 'true' : 'false',
          onClick: () => setStatus(item.value),
        },
        item.label,
        item.value ? h('span', { className: 'nw-seg-n' }, String(counts[item.value] ?? 0)) : null,
      )),
    ),
    h(
      'div',
      { className: 'nw-seg nw-opinion-src' },
      [
        { value: '', label: '所有来源' },
        { value: 'coldread', label: '冷读' },
        { value: 'lint', label: '机器检测' },
        { value: 'consistency', label: '审校' },
        { value: 'author', label: '自己记的' },
      ].map((item) => h(
        'button',
        {
          type: 'button',
          key: item.value || 'all-src',
          className: `nw-seg-btn${source === item.value ? ' on' : ''}`,
          onClick: () => setSource(item.value),
        },
        item.label,
      )),
    ),
    rows.length
      ? h(
        'div',
        { className: 'nw-opinion-list' },
        ...rows.map((row) => h(
          'div',
          { key: row.id, className: `nw-opinion nw-opinion-${row.status}` },
          h('span', { className: 'nw-opinion-ch' }, `第 ${row.chapter} 回`),
          h(
            'span',
            { className: 'nw-opinion-body' },
            h('span', { className: 'nw-opinion-text' }, row.text),
            row.quote
              ? h('span', { className: 'nw-opinion-quote' }, `「${row.quote}」`)
              : null,
            row.resolution
              ? h('span', { className: 'nw-hint' }, `处理：${row.resolution}`)
              : null,
          ),
          h(Tag, { tone: row.kind === 'highlight' ? 'green' : 'grey' }, SOURCE_LABEL[row.source] ?? row.source),
          h(
            'span',
            { className: 'nw-opinion-acts' },
            row.chapter && onOpenChapter
              ? h(Btn, { small: true, kind: 'ghost', onClick: () => onOpenChapter(row.chapter) }, '去看')
              : null,
            row.status === 'open'
              ? h(
                Fragment,
                null,
                h(Btn, { small: true, kind: 'ghost', onClick: () => decide(row, 'adopted') }, '采纳'),
                h(Btn, { small: true, kind: 'ghost', onClick: () => decide(row, 'dismissed') }, '不改'),
              )
              : h(Btn, { small: true, kind: 'ghost', onClick: () => decide(row, 'open') }, '重新挂起'),
          ),
        )),
      )
      : h(Empty, null, status === 'open'
        ? '没有待处理的意见。冷读一份稿子，或者从问题单拉一遍，都会往这里添。'
        : '这个筛选下没有意见。'),
  )
}
