/**
 * 长夜 · 正文
 *
 * 这一页只管一件事：把稿子摊开读。
 *
 * 验收台是「审」的地方——进去先撞一张分数表、一列问题单，那是校对视角。
 * 天天要开的其实是「读」：上一章写完什么了、这一章写到哪了、下一句顺不顺。
 * 所以这里不摊问题、不打分、不摆评分明细，界面上只有字、章号、字数、进度。
 *
 * 三件事跟验收台不同：
 *   1. 字号行距可调（LS.readFont / LS.readLine），读长文的第一个需求；
 *   2. 读到哪记到哪（LS.readPos + 作品 + 章号），切回来接着读；
 *   3. 分批摊（先摊 READ_CHUNK 段，看不完就点继续），一万字的章不该一次全塞进 DOM。
 */

const READ_FONT_MIN = 14
const READ_FONT_MAX = 24
const READ_CHUNK = 24

// 【24 条 #19】读长文时视线要落得住，行高得比正文编辑器宽一档。
const READ_LINE_STEPS = [
  { value: '1.6', label: '紧' },
  { value: '1.8', label: '正常' },
  { value: '2.0', label: '松' },
  { value: '2.2', label: '很松' },
]

function readPosKey(projectId, chapter) {
  return `${LS.readPos}.${projectId}.${chapter}`
}

/**
 * 正文分段。
 *
 * 跟验收台同一套切法（`/\n+/` + trim + 去空），两边段号才对得上——
 * 否则「验收台说第 5 段有问题、正文页点第 5 段却是另一段」，联动就废了。
 */
function splitParas(text) {
  return String(text ?? '')
    .split(/\n+/)
    .map((row) => row.trim())
    .filter(Boolean)
}

function ReadPage({
  projectId, project, chapters, go, toast, onRefresh,
}) {
  // 当前读第几回：优先吃 nw.openChapter（别处跳章都写这个键），否则落在最新一章。
  const [chapter, setChapter] = useState(() => {
    const raw = Number(readLS(LS.openChapter, ''))
    if (Number.isFinite(raw) && raw > 0) return raw
    return 0
  })
  const [font, setFont] = useState(() => {
    const raw = Number(readLS(LS.readFont, ''))
    return Number.isFinite(raw) && raw >= READ_FONT_MIN && raw <= READ_FONT_MAX ? raw : 17
  })
  const [line, setLine] = useState(() => readLS(LS.readLine, '1.8'))
  const [revealed, setRevealed] = useState(READ_CHUNK)
  const [mode, setMode] = useState('read')
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flag, setFlag] = useState('')

  const list = Array.isArray(chapters) ? chapters : []
  const nums = list.map((row) => Number(row.chapter)).filter((n) => n > 0).sort((a, b) => a - b)
  const latest = nums.length ? nums[nums.length - 1] : 0

  // 第一次拿到章节表时把章号定下来（上面 useState 只拿到当时的 localStorage）。
  useEffect(() => {
    if (chapter || !nums.length) return
    setChapter(latest)
  }, [chapter, latest, nums.length])

  // 换章时把「本页摊了几段」复位到记忆里的位置。
  useEffect(() => {
    if (!projectId || !chapter) return
    const saved = Number(readLS(readPosKey(projectId, chapter), ''))
    setRevealed(Number.isFinite(saved) && saved >= READ_CHUNK ? saved : READ_CHUNK)
  }, [projectId, chapter])

  const ch = useAsync(
    () => api('chapter.get', { projectId, chapter }),
    [projectId, chapter],
    { skip: !projectId || !chapter },
  )

  // 服务端正文变了（换章 / 保存后重拉）就把编辑缓冲同步过来。
  useEffect(() => {
    if (mode === 'edit') return
    setDraft(String(ch.data?.text ?? ''))
  }, [ch.data, mode])

  useEffect(() => {
    writeLS(LS.readFont, String(font))
  }, [font])
  useEffect(() => {
    writeLS(LS.readLine, line)
  }, [line])
  useEffect(() => {
    if (!projectId || !chapter) return
    writeLS(readPosKey(projectId, chapter), String(revealed))
  }, [projectId, chapter, revealed])

  // 有未保存的改动就登记，切页时外壳会拦一句。
  useEffect(() => {
    setDirtyGuard(dirty, `第 ${chapter} 回（正文页）`, () => false)
    return () => setDirtyGuard(false)
  }, [dirty, chapter])

  const paras = useMemo(() => splitParas(ch.data?.text ?? draft), [ch.data, draft])
  const shown = paras.slice(0, revealed)
  const words = ch.data?.words ?? countChars(ch.data?.text ?? '')

  const jump = (next) => {
    if (!next || next < 1) return
    if (dirty) {
      toast('有未保存的改动，先保存或放弃')
      return
    }
    setChapter(next)
    writeLS(LS.openChapter, String(next))
    setMode('read')
  }

  // J/K 换章：跟验收台同一套手，手不用在两个页面之间重新学。
  useEffect(() => {
    const onKey = (event) => {
      const tag = String(event.target?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (modalOpen()) return
      const key = String(event.key).toLowerCase()
      if (key !== 'j' && key !== 'k') return
      event.preventDefault()
      const at = nums.indexOf(chapter)
      const next = key === 'j' ? nums[at + 1] : nums[at - 1]
      if (next) jump(next)
      else toast(key === 'j' ? '已经是最后一回' : '已经是第一回')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chapter, dirty, nums.join(',')])

  const save = async () => {
    if (!projectId || !chapter) return
    setBusy(true)
    try {
      // 走同一个 chapter.save：停靠点的门禁在这里一样生效，
      // 正文页不是后门——判据在服务端，不在这页有没有画那根按钮。
      const out = await api('chapter.save', {
        projectId,
        chapter,
        text: draft,
        meta: { status: ch.data?.meta?.status ?? 'draft' },
      })
      setDirty(false)
      setFlag(out?.run?.guarded ? `已记进这一轮（还剩 ${out.run.remaining} 章）` : '已保存（这次写入没走停靠点）')
      ch.reload()
      onRefresh?.()
      toast('正文已保存')
    } catch (error) {
      toast(`保存失败：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  if (!projectId) return h(Empty, null, '还没有作品。先去设置里建一本。')
  if (!nums.length) return h(Empty, null, '还没有章节。去派单页排一单，写完就能在这儿读。')

  const at = nums.indexOf(chapter)
  const prev = at > 0 ? nums[at - 1] : 0
  const next = at >= 0 && at < nums.length - 1 ? nums[at + 1] : 0

  return h(
    'div',
    { className: 'nw-page nw-read' },
    h(
      'div',
      { className: 'nw-read-bar' },
      h(
        'div',
        { className: 'nw-seg' },
        [
          { value: 'read', label: '阅读' },
          { value: 'edit', label: '改两句' },
        ].map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-seg-btn nw-read-tab${mode === item.value ? ' on' : ''}`,
            'aria-pressed': mode === item.value ? 'true' : 'false',
            onClick: () => {
              if (item.value === 'edit' && !draft) setDraft(String(ch.data?.text ?? ''))
              setMode(item.value)
            },
          },
          item.label,
        )),
      ),
      h(
        'div',
        { className: 'nw-read-nav' },
        h(Btn, { small: true, kind: 'ghost', onClick: () => jump(prev), disabled: !prev }, '← 上一回'),
        h('span', { className: 'nw-read-pos' }, `${at >= 0 ? at + 1 : 0} / ${nums.length} 回`),
        h(Btn, { small: true, kind: 'ghost', onClick: () => jump(next), disabled: !next }, '下一回 →'),
      ),
      h(
        'div',
        { className: 'nw-read-font' },
        h('span', { className: 'nw-hint' }, '字号'),
        h(Btn, {
          small: true,
          kind: 'ghost',
          onClick: () => setFont((n) => Math.max(READ_FONT_MIN, n - 1)),
          disabled: font <= READ_FONT_MIN,
        }, 'A－'),
        h('span', { className: 'nw-read-font-n' }, String(font)),
        h(Btn, {
          small: true,
          kind: 'ghost',
          onClick: () => setFont((n) => Math.min(READ_FONT_MAX, n + 1)),
          disabled: font >= READ_FONT_MAX,
        }, 'A＋'),
        h('span', { className: 'nw-hint' }, '行距'),
        h(Select, {
          value: line,
          onChange: setLine,
          options: READ_LINE_STEPS,
        }),
      ),
    ),
    ch.loading && !ch.data ? h(Loading, null) : null,
    ch.error ? h(ErrorBox, { error: ch.error, onRetry: ch.reload }) : null,
    ch.data
      ? h(
        'div',
        { className: 'nw-read-sheet' },
        h(
          'div',
          { className: 'nw-read-head' },
          h('h2', { className: 'nw-read-title' }, ch.data?.meta?.title || `第 ${chapter} 回`),
          h('span', { className: 'nw-read-sub' },
            `${fmtWords(words)} 字 · ${paras.length} 段 · ${STATUS_LABEL[ch.data?.meta?.status] || '草稿'}`),
        ),
        mode === 'edit'
          ? h(
            'div',
            { className: 'nw-read-edit' },
            h(TextArea, {
              value: draft,
              rows: 22,
              onChange: (value) => {
                setDraft(value)
                setDirty(true)
                setFlag('')
              },
            }),
            h(
              'div',
              { className: 'nw-read-foot' },
              h('span', { className: 'nw-hint' },
                `${fmtWords(countChars(draft))} 字${dirty ? ' · 未保存' : ''}`),
              h(Btn, { small: true, kind: 'ghost', onClick: () => {
                setDraft(String(ch.data?.text ?? ''))
                setDirty(false)
                setFlag('')
              } }, '放弃改动'),
              h(Btn, {
                small: true,
                kind: 'primary',
                onClick: save,
                disabled: busy || !dirty,
              }, busy ? '保存中…' : '保存'),
            ),
          )
          : h(
            'div',
            {
              className: 'nw-read-doc',
              style: { fontSize: `${font}px`, lineHeight: line },
            },
            shown.length
              ? shown.map((para, index) => h('p', {
                className: 'nw-read-para',
                key: index,
                title: `第 ${index + 1} 段 · ${para.length} 字`,
              }, para))
              : h(Empty, null, '这一回还是空的。去派单页排单，或者点「改两句」直接开写。'),
            paras.length > revealed
              ? h(
                'div',
                { className: 'nw-read-more' },
                h(Btn, {
                  small: true,
                  kind: 'ghost',
                  onClick: () => setRevealed((n) => n + READ_CHUNK),
                }, `继续读（还有 ${paras.length - revealed} 段）`),
              )
              : null,
          ),
        h(
          'div',
          { className: 'nw-read-tail' },
          h('span', { className: 'nw-hint' }, `读到第 ${Math.min(revealed, paras.length)} / ${paras.length} 段`),
          flag ? h('span', { className: 'nw-read-flag' }, flag) : null,
          h(Btn, {
            small: true,
            kind: 'ghost',
            onClick: () => {
              writeLS(LS.openChapter, String(chapter))
              go?.('review')
            },
          }, '去验收这一回'),
        ),
      )
      : null,
  )
}
