/**
 * 长夜 · 验收台
 *
 * 列表看分数与违规数，点开看正文与四类问题，打回有三种去向。
 */

function ScoreBar({ score, gate }) {
  const tone = score >= 80 ? 'green' : score >= gate ? 'amber' : 'red'
  return h(
    'span',
    { className: 'nw-score' },
    h(Bar, { value: score, max: 100, tone }),
    h('em', { className: `nw-score-n nw-score-${scoreTone(score)}` }, score || '—'),
  )
}

function ReviewList({ chapters, gate, onOpen, selected }) {
  return h(
    'div',
    { className: 'nw-rv-list' },
    h(
      'div',
      { className: 'nw-rv-head' },
      h('span', null, '章'),
      h('span', null, '标题'),
      h('span', null, '状态'),
      h('span', null, '字数'),
      h('span', null, '评分'),
      h('span', null, '问题'),
    ),
    chapters.length
      ? chapters.map((row) =>
          h(
            'button',
            {
              type: 'button',
              key: row.chapter,
              className: `nw-rv-row${selected === row.chapter ? ' on' : ''}`,
              onClick: () => onOpen(row.chapter),
            },
            h('span', { className: 'nw-rv-n' }, row.chapter),
            h('span', { className: 'nw-rv-title' }, row.title || ''),
            h(
              'span',
              null,
              h(
                Tag,
                { tone: STATUS_TONE[row.status] || 'grey' },
                STATUS_LABEL[row.status] || row.status,
              ),
            ),
            h('span', { className: 'nw-rv-words' }, row.words),
            h('span', null, h(ScoreBar, { score: row.score, gate })),
            h(
              'span',
              { className: 'nw-rv-issues' },
              row.issues
                ? h(Tag, { tone: 'amber' }, `${row.issues}`)
                : h('span', { className: 'nw-hint' }, '—'),
              row.violations ? h(Tag, { tone: 'red' }, `违规 ${row.violations}`) : null,
            ),
          ),
        )
      : h(Empty, null, '还没有章节。去派单页排一单。'),
  )
}

function IssueRow({ issue, index, active, onPick }) {
  const tone = issue.type === 'ai-style' ? 'amber' : issue.type === 'logic' ? 'red' : 'grey'
  const label =
    issue.type === 'ai-style'
      ? 'AI 味'
      : issue.type === 'logic'
        ? '逻辑'
        : issue.type === 'pace'
          ? '节奏'
          : '其他'
  return h(
    'button',
    {
      type: 'button',
      // 【24 条 #14】点问题 → 正文那句亮起来。问题在右、正文在左，不联动就全靠眼睛找。
      className: `nw-issue${active ? ' nw-issue-on' : ''}`,
      onClick: () => onPick?.(issue),
      title: issue.quote ? '点一下，跳到正文里这句话' : '这条没有引用原文',
    },
    h('span', { className: 'nw-issue-n' }, String(index + 1).padStart(2, '0')),
    h(Tag, { tone }, label),
    h(
      'span',
      { className: 'nw-issue-body' },
      h('span', { className: 'nw-issue-text' }, issue.text || ''),
      issue.quote ? h('span', { className: 'nw-issue-quote' }, `「${issue.quote}」`) : null,
    ),
    issue.severity ? h('span', { className: 'nw-issue-sev' }, issue.severity) : null,
  )
}

function ReviewDetail({
  projectId,
  chapter,
  chapters,
  project,
  gate,
  onClose,
  onChanged,
  toast,
  onNav,
}) {
  const ch = useAsync(() => api('chapter.get', { projectId, chapter }), [projectId, chapter], {
    skip: !projectId || !chapter,
  })
  // 彩带的真值：服务端扫词表，不是前端按段序号染色。
  const style = useAsync(
    () => api('chapter.aistyle', { projectId, chapter }),
    [projectId, chapter],
    { skip: !projectId || !chapter },
  )
  // 历史版本 / 回收站也得能看见，否则「留底」等于没留。
  const hist = useAsync(
    () => api('chapter.history', { projectId, chapter }),
    [projectId, chapter],
    { skip: !projectId || !chapter },
  )
  // 【QA-1】撤销/重做：受控 textarea 会把浏览器原生撤销栈冲掉，所以自己留快照。
  // 600ms 内的连续输入合并成一步，免得退一句要按一百下。
  const editor = useUndoText('')
  const text = editor.value
  const setText = editor.set
  const resetText = editor.reset
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  // 【12 条 #2】自动保存：默认开，可以在设置里关。
  const [autosave, setAutosave] = useState(() => readLS(LS.autosave, '1') !== '0')
  const [savedAt, setSavedAt] = useState('')
  // 【12 条 #11】阅读模式：只看正文，把问题单/评分/历史全收起来。
  const [readMode, setReadMode] = useState(() => readLS(LS.readMode, '0') === '1')
  // 【24 条 #13/#14】彩带选中 + 正文高亮：两件事共用同一个「段」坐标。
  const [para, setPara] = useState(-1)
  const [quotePick, setQuotePick] = useState(null)
  const [mode, setMode] = useState('doc')
  // 【第 1 批】服务端硬拦时把证据接住，弹窗逐条列出来。
  const [blocked, setBlocked] = useState(null)
  const paraRefs = useRef({})

  // 【12 条 #1】有未保存内容就登记，切页时 Root 会拿这个拦住并问一句。
  useEffect(() => {
    setDirtyGuard(dirty, `第 ${chapter} 回`, () => false)
    return () => setDirtyGuard(false)
  }, [dirty, chapter])

  // 【12 条 #1】关标签页 / 刷新时的兜底提示。浏览器只允许「有未保存」这一句，
  // 不能自定义文案，所以只在真脏的时候挂。
  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Ctrl+K 搜到的段号（nw.openPara）要能在正文里落地：进来就切段视图、滚到那段、点亮。
  // 放在 dirty 之后，且不覆盖用户正在编的稿子（text 由 dirty 守着）。
  useEffect(() => {
    if (!chapter) return
    const raw = readLS('nw.openPara', '')
    if (raw === '') return
    writeLS('nw.openPara', '')
    const at = Number(raw)
    if (!Number.isFinite(at) || at < 0) return
    const bodyNow = String(ch.data?.text ?? '')
    const list = bodyNow
      .split(/\n+/)
      .map((row) => row.trim())
      .filter(Boolean)
    if (at >= list.length) return
    setMode('doc')
    setPara(at)
    setTimeout(() => {
      const node = paraRefs.current[at]
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }, [chapter, ch.data])

  useEffect(() => {
    if (ch.data && !dirty) {
      // 服务端有正文就用服务端的；服务端是空的但本地有草稿，就把草稿捞回来。
      // 场景：上次改了没存就关掉窗口，下次打开不能白丢。
      const remote = ch.data.text ?? ''
      const local = readDraft(projectId, chapter)
      if (!String(remote).trim() && local?.text) {
        // 换章必须清空撤销栈：跨章撤销会把上一章的字塞进这一章。
        resetText(local.text)
        setDirty(true)
        toast('发现上次没保存的草稿，已放回编辑框')
        return
      }
      resetText(remote)
    }
  }, [ch.data, dirty])

  const meta = ch.data?.meta ?? {}
  const issues = Array.isArray(meta.issues) ? meta.issues : []
  const violations = Array.isArray(meta.violations) ? meta.violations : []
  const scores = meta.scores || {
    reader: null,
    logic: null,
    aiStyle: null,
    rhythm: null,
  }

  // 正文为空就是空。以前这里塞 12 段演示文字，彩带和段视图看着很热闹，
  // 但作者会以为自己写了一章；空章就该老实说「还没有正文」。
  const body = String(text || '')
  const paras = String(body)
    .split(/\n+/)
    .map((row) => row.trim())
    .filter(Boolean)

  const save = async (opts = {}) => {
    const silent = opts.silent === true
    const force = opts.force === true
    if (!silent) setBusy(true)
    try {
      const payload = { projectId, chapter, text, meta: { status: meta.status ?? 'draft' } }
      if (force) payload.force = true
      await api('chapter.save', payload)
      setDirty(false)
      setBlocked(null)
      dropDraft(projectId, chapter)
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      if (!silent) {
        ch.reload()
        onChanged?.()
        toast(force ? '已强行保存（硬伤还留着）' : '正文已保存')
      }
    } catch (error) {
      // 硬拦不是「保存失败」，是「这段字不能这么写」——要挡住、要逐条说清。
      // 弹窗而不是 toast：toast 飘三秒就没了，用户会以为存进去了，关窗口白写。
      if (error.code === 'style-blocking') {
        setBlocked(error)
        if (silent) toast('自动保存被拦下了：正文有硬伤')
        return
      }
      // 自动保存失败不能静默 —— 那正好是最需要让作者知道的一次。
      toast(`${silent ? '自动保存' : '保存'}失败：${error.message}`)
    } finally {
      if (!silent) setBusy(false)
    }
  }

  // 【12 条 #2】自动保存：停手 4 秒后落一次盘。为什么不是边输边存 ——
  // 每敲一个字都发一次 RPC，服务端要为每次覆盖写一份历史版本，
  // 打一百个字就把最近 20 版历史全冲成刚才的中间态。
  useEffect(() => {
    if (!autosave || !dirty || busy) return undefined
    const timer = setTimeout(() => {
      if (dirtyGuard.active && dirtyGuard.flush) save({ silent: true })
    }, 4000)
    return () => clearTimeout(timer)
  }, [text, autosave, dirty, busy])

  // 草稿也随打随存：自动保存是 4 秒一次，这 4 秒里关掉窗口还有本地兜底。
  useEffect(() => {
    if (!dirty) return
    writeDraft(projectId, chapter, text)
  }, [text, dirty, projectId, chapter])

  const act = async (action) => {
    setBusy(true)
    try {
      await api('review.action', {
        projectId,
        action,
        chapter,
        worldState: meta.worldStateHint ?? '',
      })
      ch.reload()
      onChanged?.()
      toast(
        action === 'accept'
          ? '已采纳'
          : action === 'rerun'
            ? '已重新入队'
            : action === 'manual'
              ? '已转人工修'
              : '已废弃',
      )
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  // 【24 条 #15】键盘流：J/K 上下章、A 采纳、R 废弃。逐章过一遍是重复劳动，手不该离开键盘。
  useEffect(() => {
    const onKey = (event) => {
      const tag = String(event.target?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // 命令面板 / 任何弹窗开着时，这里的单键快捷键必须让路。
      if (modalOpen()) return
      const key = String(event.key).toLowerCase()
      if (key === 'j') {
        event.preventDefault()
        onNav?.(1)
      } else if (key === 'k') {
        event.preventDefault()
        onNav?.(-1)
      } else if (key === 'a') {
        event.preventDefault()
        if (!busy) act('accept')
      } else if (key === 'r') {
        event.preventDefault()
        if (!busy) act('reject')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, chapter])

  // 【QA-1】撤销 / 重做：Ctrl+Z / Ctrl+Shift+Z（mac 上 Cmd 同效）。
  // 只在编辑模式里接管 —— 段落视图按 Ctrl+Z 应该交给浏览器，不抢。
  useEffect(() => {
    if (mode !== 'edit') return undefined
    const onKey = (event) => {
      const tag = String(event.target?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'select') return
      if (!(event.ctrlKey || event.metaKey)) return
      const key = String(event.key).toLowerCase()
      if (key !== 'z' && key !== 'y') return
      if (modalOpen()) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) {
        if (editor.redo()) setDirty(true)
        else toast('没有可重做的了')
      } else if (editor.undo()) {
        setDirty(true)
      } else {
        toast('没有可撤销的了')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, editor.canUndo, editor.canRedo])

  // 点问题：切到段落视图，定位到含引文的那一段，滚过去。
  const pickIssue = (issue) => {
    setQuotePick(issue)
    setMode('doc')
    const needle = String(issue?.quote ?? '').trim()
    if (!needle) {
      toast('这条问题没记原文片段，只高亮问题本身')
      return
    }
    const at = paras.findIndex((row) => row.includes(needle))
    setPara(at)
    if (at >= 0) {
      const node = paraRefs.current[at]
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
      toast(`已定位到第 ${at + 1} 段`)
    } else {
      toast('正文里没找到这句，可能已被改过')
    }
  }

  // 【12 条 #5】字数跟着输入实时走：以前显示的是服务端上次存下来的 words，
  // 改了一千字还是旧数字，作者没法判断「这一章够不够长」。
  const liveWords = String(text || '').trim() ? countChars(text) : (ch.data?.words ?? 0)
  const plan = Number(project?.targetWords ?? 0)

  if (!chapter) return null
  if (ch.loading && !ch.data) return h(Loading, null)
  if (ch.error) return h(ErrorBox, { error: ch.error, onRetry: ch.reload })

  return h(
    'div',
    { className: `nw-rv-detail${readMode ? ' nw-rv-read' : ''}` },
    h(
      'div',
      { className: 'nw-rv-detail-head' },
      h(
        'div',
        null,
        h('h3', null, `第 ${chapter} 回`),
        h(
          'span',
          { className: 'nw-hint' },
          `${liveWords}${plan ? ` / ${plan}` : ''} 字${dirty ? ' · 未保存' : ''} · ${STATUS_LABEL[meta.status] || meta.status || '草稿'} · 共 ${paras.length} 段`,
        ),
      ),
      h(
        'div',
        { className: 'nw-actions' },
        // 【12 条 #2】自动保存状态要说出来：作者得知道「不用管，它自己会存」。
        h(
          'span',
          { className: `nw-hint nw-save-state${dirty ? ' nw-dirty' : ''}` },
          dirty
            ? autosave
              ? '改动未保存 · 4 秒后自动存'
              : '改动未保存'
            : savedAt
              ? `已保存 ${savedAt}`
              : '已保存',
        ),
        // 【24 条 #15】键盘提示直接印在按钮上，不然没人知道有快捷键。
        readMode ? null : h('span', { className: 'nw-hint nw-keys' }, 'J/K 换章 · A 采纳 · R 废弃'),
        h(
          Btn,
          { small: true, kind: 'ghost', onClick: () => onNav?.(-1), title: '上一章（K）' },
          'K ←',
        ),
        h(
          Btn,
          { small: true, kind: 'ghost', onClick: () => onNav?.(1), title: '下一章（J）' },
          'J →',
        ),
        // 【12 条 #11】阅读模式：只留正文，把两侧全收起来。
        h(
          Btn,
          {
            small: true,
            kind: readMode ? 'primary' : 'ghost',
            onClick: () => {
              const next = !readMode
              setReadMode(next)
              writeLS(LS.readMode, next ? '1' : '0')
            },
            title: '只看正文',
          },
          readMode ? '退出阅读' : '📖 阅读模式',
        ),
        // 【12 条 #3】章节重排：章号就是文件名，插入只能在两章之间挪。
        h(
          Btn,
          {
            small: true,
            kind: 'ghost',
            disabled: busy,
            title: '在这一章前面插一个空章，这一章及其后各退一位',
            onClick: async () => {
              if (busy) return
              const at = Math.max(1, chapter)
              if (
                !window.confirm(
                  `在第 ${at} 回前面插一个空章？\n从第 ${at} 回起每章号都 +1，历史版本一起搬。`,
                )
              )
                return
              setBusy(true)
              try {
                const info = await api('chapter.insert', { projectId, at })
                onChanged?.()
                toast(
                  `已插入第 ${info.chapter} 回${info.shifted ? `，${info.shifted} 章各退一位` : ''}`,
                )
              } catch (error) {
                toast(error.message)
              } finally {
                setBusy(false)
              }
            },
          },
          '＋ 在此插章',
        ),
        h(
          Btn,
          {
            small: true,
            kind: 'ghost',
            disabled: busy,
            title: '把这一章挪到前面去，途经各章顺移',
            onClick: async () => {
              if (busy) return
              const to = Math.max(1, chapter - 1)
              if (to === chapter) return
              setBusy(true)
              try {
                await api('chapter.move', { projectId, from: chapter, to })
                onChanged?.()
                toast(`已挪到第 ${to} 回 · 原来的第 ${to} 回顺移到第 ${to + 1} 回`)
                onNav?.(-1)
              } catch (error) {
                toast(error.message)
              } finally {
                setBusy(false)
              }
            },
          },
          '↑ 上移一章',
        ),
        h(
          Btn,
          {
            small: true,
            kind: 'ghost',
            disabled: busy,
            title: '把这一章挪到后面去，途经各章顺移',
            onClick: async () => {
              if (busy) return
              const to = chapter + 1
              setBusy(true)
              try {
                await api('chapter.move', { projectId, from: chapter, to })
                onChanged?.()
                toast(`已挪到第 ${to} 回 · 原来的第 ${to} 回顺移到第 ${to - 1} 回`)
                onNav?.(1)
              } catch (error) {
                toast(error.message)
              } finally {
                setBusy(false)
              }
            },
          },
          '↓ 下移一章',
        ),
        readMode ? null : h(Btn, { small: true, kind: 'ghost', onClick: onClose }, '← 返回列表'),
        readMode
          ? null
          : h(
              Btn,
              {
                small: true,
                kind: dirty ? 'primary' : 'ghost',
                onClick: () => save(),
                disabled: busy || !dirty,
              },
              dirty ? '保存修改' : '已保存',
            ),
      ),
    ),
    h(
      'div',
      { className: 'nw-rv-body' },
      h(
        'div',
        { className: 'nw-rv-doc' },
        h(
          'div',
          { className: 'nw-rv-docbar' },
          h(
            'div',
            { className: 'nw-seg' },
            [
              { value: 'doc', label: '段落视图' },
              { value: 'edit', label: '编辑正文' },
            ].map((item) =>
              h(
                'button',
                {
                  type: 'button',
                  key: item.value,
                  className: `nw-seg-btn${mode === item.value ? ' on' : ''}`,
                  'aria-pressed': mode === item.value ? 'true' : 'false',
                  onClick: () => setMode(item.value),
                },
                item.label,
              ),
            ),
          ),
          // 【QA-1】撤销 / 重做放在工具栏上，不用记快捷键也能找得到。
          // 不在编辑模式时点它会先把编辑器打开 —— 否则按钮看起来像坏了。
          h(
            'div',
            { className: 'nw-rv-undo' },
            h(
              Btn,
              {
                small: true,
                kind: 'ghost',
                className: 'nw-undo-btn',
                disabled: !editor.canUndo && mode === 'edit',
                title: '撤销上一步（Ctrl+Z）',
                'aria-label': '撤销',
                onClick: () => {
                  if (mode !== 'edit') {
                    setMode('edit')
                    toast('已切到编辑正文，再按一次撤销')
                    return
                  }
                  if (editor.undo()) {
                    setDirty(true)
                    toast(`已撤销一步 · 还能再退 ${Math.max(0, editor.steps - 1)} 步`)
                  } else {
                    toast('没有可撤销的了')
                  }
                },
              },
              '↶ 撤销',
            ),
            h(
              Btn,
              {
                small: true,
                kind: 'ghost',
                className: 'nw-redo-btn',
                disabled: !editor.canRedo && mode === 'edit',
                title: '重做（Ctrl+Shift+Z）',
                'aria-label': '重做',
                onClick: () => {
                  if (mode !== 'edit') {
                    setMode('edit')
                    toast('已切到编辑正文，再按一次重做')
                    return
                  }
                  if (editor.redo()) {
                    setDirty(true)
                    toast('已重做一步')
                  } else {
                    toast('没有可重做的了')
                  }
                },
              },
              '↷ 重做',
            ),
            h(
              'span',
              { className: 'nw-undo-n', title: '撤销栈深度' },
              mode === 'edit' ? `${editor.steps} 步可退` : '未在编辑',
            ),
          ),
          quotePick
            ? h('span', { className: 'nw-rv-pick' }, `盯住：${quotePick.text}`)
            : h('span', { className: 'nw-hint' }, '点右边的「#13」彩带格子或问题，正文会跟着亮'),
        ),
        // 【24 条 #13】正文右侧彩带：每段一格，红=AI 味重、橙=节奏拖、绿=好段。点格子滚过去。
        // 颜色来自 chapter.aistyle 扫词表的真命中（style.data.aiHits），不是按段序号染色。
        h(
          'div',
          { className: 'nw-heat' },
          h('span', { className: 'nw-heat-title' }, '段'),
          h(
            'div',
            { className: 'nw-heat-track' },
            paras.map((item, index) =>
              h('button', {
                type: 'button',
                key: index,
                className: `nw-heat-cell nw-heat-${heatTone(item, index, style.data?.hits, issues)}${para === index ? ' on' : ''}`,
                style: { flexGrow: Math.max(1, Math.min(6, Math.ceil(String(item).length / 60))) },
                title: `第 ${index + 1} 段 · ${String(item).length} 字 · ${heatTone(item, index, style.data?.hits, issues) === 'bad' ? 'AI 味重' : heatTone(item, index, style.data?.hits, issues) === 'warn' ? '节奏拖' : '好段'}`,
                onClick: () => {
                  setPara(index)
                  const node = paraRefs.current[index]
                  if (node && node.scrollIntoView)
                    node.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  if (mode === 'edit') setMode('doc')
                  const hitsHere = (style.data?.hits ?? []).filter(
                    (row) => Number(row.para) === index,
                  )
                  toast(
                    hitsHere.length
                      ? `第 ${index + 1} 段 · 命中「${hitsHere[0].pattern}」：${hitsHere[0].hint}`
                      : `第 ${index + 1} 段 · ${heatTone(item, index, style.data?.hits, issues) === 'warn' ? '节奏拖' : '好段'}`,
                  )
                },
              }),
            ),
          ),
          h(
            'div',
            { className: 'nw-heat-legend' },
            h('span', { className: 'nw-heat-key nw-heat-good' }, '好'),
            h('span', { className: 'nw-heat-key nw-heat-warn' }, '拖'),
            h('span', { className: 'nw-heat-key nw-heat-bad' }, 'AI 味'),
            // 密度是「每千字命中数」：长短章才能横着比。
            style.data
              ? h(
                  'span',
                  { className: 'nw-heat-density' },
                  `AI 味 ${style.data.density ?? 0}/千字 · 词表 ${style.data.lexicon ?? 0} 条`,
                )
              : null,
          ),
        ),
        mode === 'edit'
          ? h(TextArea, {
              value: text,
              rows: 26,
              onChange: (v) => {
                setText(v)
                setDirty(true)
              },
            })
          : h(
              'div',
              { className: 'nw-para-list' },
              paras.length
                ? paras.map((item, index) =>
                    h(
                      // 段落本身就是按钮：以前是 <p onClick>，Tab 走不到、回车按不动，
                      // 键盘用户完全用不了「点段落定位」这条主路径。
                      'button',
                      {
                        type: 'button',
                        key: index,
                        ref: (node) => {
                          paraRefs.current[index] = node
                        },
                        className: `nw-para nw-para-${heatTone(item, index, style.data?.hits, issues)}${para === index ? ' nw-para-on' : ''}`,
                        'aria-pressed': para === index ? 'true' : 'false',
                        'aria-label': `第 ${index + 1} 段${para === index ? '（已选中）' : ''}`,
                        onClick: () => setPara(index),
                      },
                      h('span', { className: 'nw-para-n' }, String(index + 1)),
                      item,
                    ),
                  )
                : h(
                    'p',
                    { className: 'nw-hint nw-para-empty' },
                    '这一章还没有正文。切到「编辑」写，或者在正文页摊开读写。',
                  ),
            ),
        h(
          'div',
          { className: 'nw-rv-acts' },
          h(
            Btn,
            { kind: 'primary', onClick: () => act('accept'), disabled: busy },
            '✓ 通过并采纳 (A)',
          ),
          h(Btn, { kind: 'ghost', onClick: () => act('rerun'), disabled: busy }, '↻ 打回 · 重跑'),
          h(
            Btn,
            { kind: 'ghost', onClick: () => act('manual'), disabled: busy },
            '✋ 打回 · 人工修',
          ),
          h(Btn, { kind: 'danger', onClick: () => act('reject'), disabled: busy }, '✕ 废弃 (R)'),
        ),
      ),
      // 【12 条 #11】阅读模式把整个右侧栏收起来：只看正文。
      readMode
        ? null
        : h(
            'div',
            { className: 'nw-rv-side' },
            h(
              Card,
              { title: '评分明细' },
              h(
                'div',
                { className: 'nw-score-grid' },
                [
                  ['阅读', scores.reader],
                  ['逻辑', scores.logic],
                  ['AI 味', scores.aiStyle],
                  ['节奏', scores.rhythm],
                ].map(([label, value]) =>
                  h(
                    'span',
                    { className: 'nw-score-cell', key: label },
                    h('em', null, value ?? '—'),
                    h('span', null, label),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'nw-score-total' },
                h('span', null, '总分'),
                h(ScoreBar, { score: meta.score ?? 0, gate }),
              ),
            ),
            h(
              Card,
              {
                title: '问题清单',
                extra: h('span', { className: 'nw-card-badge' }, `${issues.length}`),
              },
              issues.length
                ? h(
                    'div',
                    { className: 'nw-issues' },
                    issues.map((issue, index) =>
                      h(IssueRow, {
                        issue,
                        index,
                        key: index,
                        active: quotePick === issue,
                        onPick: pickIssue,
                      }),
                    ),
                  )
                : h(Empty, null, '没有问题。'),
            ),
            h(
              Card,
              {
                title: '违规清单',
                extra: h('span', { className: 'nw-card-badge' }, `${violations.length}`),
              },
              violations.length
                ? h(
                    'div',
                    { className: 'nw-issues' },
                    violations.map((row, index) =>
                      h(
                        'div',
                        { className: 'nw-issue nw-issue-violation', key: index },
                        h('span', { className: 'nw-issue-n' }, String(index + 1).padStart(2, '0')),
                        h(Tag, { tone: 'red' }, '硬规则'),
                        h(
                          'span',
                          { className: 'nw-issue-body' },
                          h(
                            'span',
                            { className: 'nw-issue-text' },
                            row.text ?? row.rule ?? String(row),
                          ),
                        ),
                      ),
                    ),
                  )
                : h(Empty, null, '没有违规。'),
            ),
            h(
              Card,
              {
                title: '历史版本',
                extra: h(
                  'span',
                  { className: 'nw-card-badge' },
                  `${hist.data?.versions?.length ?? 0}`,
                ),
              },
              h(
                'div',
                { className: 'nw-hist-ver' },
                h(
                  'p',
                  { className: 'nw-hint' },
                  hist.data?.versions?.length
                    ? `每次覆盖前自动留底，保留最近 ${hist.data?.keep ?? 20} 版。回滚本身也会留底，滚错了还能滚回来。`
                    : '还没有历史版本 —— 第一次覆盖这章之后才有。',
                ),
                (hist.data?.versions ?? []).slice(0, 8).map((row) =>
                  h(
                    'div',
                    { className: 'nw-ver-row', key: row.name },
                    h(
                      'span',
                      { className: 'nw-ver-at' },
                      String(row.at ?? '')
                        .replace('T', ' ')
                        .slice(0, 15),
                    ),
                    h('span', { className: 'nw-ver-w' }, `${row.words} 字`),
                    h(
                      Btn,
                      {
                        small: true,
                        kind: 'ghost',
                        onClick: async () => {
                          if (busy) return
                          setBusy(true)
                          try {
                            await api('chapter.restore', { projectId, chapter, name: row.name })
                            ch.reload()
                            hist.reload()
                            setDirty(false)
                            onChanged?.()
                            toast(`已回到 ${String(row.at ?? '').slice(0, 15)} 那一版`)
                          } catch (error) {
                            toast(error.message)
                          } finally {
                            setBusy(false)
                          }
                        },
                      },
                      '回到这一版',
                    ),
                  ),
                ),
                // 回滚前的当前稿也在历史里，所以才敢给这个按钮。
                hist.data?.versions?.length
                  ? h('p', { className: 'nw-hint' }, '回滚后可再从列表里选回原来那版。')
                  : null,
              ),
            ),
            h(
              Card,
              { title: '上下文审计' },
              meta.contextAudit
                ? h('pre', { className: 'nw-audit' }, String(meta.contextAudit))
                : h(Empty, null, '这一章没留下上下文审计记录。'),
            ),
            // 【第 1 批】文风校验面板住在右栏：改稿时眼睛盯着正文，
            // 命中清单要能同屏看到，切出去看报告等于不做。
            // 传 body 而不是 text：正文还没进编辑器时（刚打开、还没改）也得校，
            // 否则「打开这一章」看到的是空白面板，等于没做。
            // 章级体检住在校验面板上方：先回答「这段还是不是文」，再谈文笔。
            // 顺序反了的话，模型跑偏的稿子会先给你 28 条文笔建议，白费。
            readMode
              ? null
              : h(ChapterHealth, {
                  projectId,
                  chapter,
                  text: body,
                  toast,
                  onJumpPara: (index) => {
                    setMode('doc')
                    setPara(Number(index) || 0)
                    const node = paraRefs.current[Number(index) || 0]
                    if (node && node.scrollIntoView)
                      node.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  },
                }),
            readMode
              ? null
              : h(LintPanel, {
                  projectId,
                  chapter,
                  text: body,
                  toast,
                  onJump: (hit) => {
                    // 点命中行 = 跳到那一段并点亮，和「点问题」同一套坐标。
                    setMode('doc')
                    setPara(Number(hit.para) || 0)
                    const node = paraRefs.current[Number(hit.para) || 0]
                    if (node && node.scrollIntoView)
                      node.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  },
                }),
            // 【阶段 C】本书阈值。放在校验面板正下方：先看到命中，再问「凭什么按这个标准判我」。
            // 阅读模式下也不藏——它是设置，不是干扰。
            h(LintCalibration, {
              projectId,
              toast,
              onDone: () => {
                if (typeof onChanged === 'function') onChanged()
              },
            }),
          ),
    ),

    // 硬拦弹窗：存不进去时挡在面前，不能让人以为存好了。
    blocked
      ? h(LintBlockModal, {
          error: blocked,
          onClose: () => setBlocked(null),
          onFix: (hit) => {
            setBlocked(null)
            setMode('doc')
            if (hit && Number.isFinite(hit.para)) {
              setPara(Number(hit.para))
              const node = paraRefs.current[Number(hit.para)]
              if (node && node.scrollIntoView)
                node.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          },
          onForce: () => {
            setBlocked(null)
            save({ force: true })
          },
        })
      : null,
  )
}

/**
 * 【P4】历史版本 · 独立一屏
 *
 * 以前「历史版本」只是验收详情右栏最下面的一张卡：必须先点开某一章，
 * 再往下滚过评分、问题清单、违规清单，才看得到「这一章改过几版」。
 *
 * 可它是另一类动作 —— 前面那些是「这一稿好不好」，回滚是「把稿子退回去」。
 * 混在一起的结果：作者想找回昨天删掉的那一段，得先经过一整套审稿界面。
 *
 * 所以给它自己一屏：挑一章 → 看它改过哪些版 → 点开任意一版读原文 → 不满意就退回去。
 */
function VersionsPanel({ projectId, chapters, toast, onOpenChapter }) {
  const list = Array.isArray(chapters) ? chapters : []
  const [chapter, setChapter] = useState(() => (list.length ? Number(list[0].chapter) : 0))
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)

  // 章列表里可能还没有这一章（刚删过），落到第一张上，别让 select 空着。
  const current = list.some((row) => Number(row.chapter) === Number(chapter))
    ? Number(chapter)
    : list.length
      ? Number(list[0].chapter)
      : 0

  const hist = useAsync(
    () => api('chapter.history', { projectId, chapter: current }),
    [projectId, current],
    { skip: !projectId || !current },
  )
  const one = useAsync(
    () => api('chapter.version', { projectId, chapter: current, name: pick }),
    [projectId, current, pick],
    { skip: !projectId || !current || !pick },
  )

  if (!list.length) {
    return h(Empty, null, '还没有章节。等第一章写出来，这里才会开始留底。')
  }

  const versions = hist.data?.versions ?? []
  const keep = hist.data?.keep ?? 20

  const restore = async (name) => {
    if (busy) return
    setBusy(true)
    try {
      await api('chapter.restore', { projectId, chapter: current, name })
      hist.reload()
      setPick('')
      toast(`第 ${current} 回已退回 ${name}`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    'div',
    { className: 'nw-vers' },
    h(
      'div',
      { className: 'nw-vers-bar' },
      h(Select, {
        value: String(current),
        onChange: (v) => {
          setChapter(Number(v) || 0)
          setPick('')
        },
        options: list.map((row) => ({
          value: String(row.chapter),
          label: `第 ${row.chapter} 回 · ${fmtWords(Number(row.words) || 0)} 字`,
        })),
      }),
      h(
        Btn,
        { small: true, kind: 'ghost', onClick: () => onOpenChapter?.(current) },
        '去验收这一回',
      ),
      h('span', { className: 'nw-hint' }, `每次覆盖前自动留底，保留最近 ${keep} 版。`),
    ),
    hist.loading && !hist.data
      ? h(Loading, null)
      : hist.error
        ? h(ErrorBox, { error: hist.error, onRetry: hist.reload })
        : versions.length
          ? h(
              'div',
              { className: 'nw-vers-list' },
              versions.map((row) =>
                h(
                  'div',
                  { className: `nw-vers-row${pick === row.name ? ' on' : ''}`, key: row.name },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'nw-vers-main',
                      onClick: () => setPick(pick === row.name ? '' : row.name),
                    },
                    h(
                      'span',
                      { className: 'nw-vers-at' },
                      String(row.at ?? '')
                        .replace('T', ' ')
                        .slice(0, 16),
                    ),
                    h('span', { className: 'nw-vers-w' }, `${fmtWords(Number(row.words) || 0)} 字`),
                    h('span', { className: 'nw-vers-name' }, row.name),
                  ),
                  h(
                    Btn,
                    {
                      small: true,
                      kind: 'ghost',
                      disabled: busy,
                      onClick: () => restore(row.name),
                    },
                    '回到这一版',
                  ),
                ),
              ),
            )
          : h(Empty, null, '这一回还没改过。第一次覆盖正文之后才会开始留底。'),
    pick
      ? h(
          Card,
          {
            title: `${pick} 的原文`,
            extra: h(
              'span',
              { className: 'nw-card-badge' },
              `${fmtWords(Number(one.data?.words) || 0)} 字`,
            ),
          },
          one.loading && !one.data
            ? h(Loading, null)
            : one.error
              ? h(ErrorBox, { error: one.error, onRetry: one.reload })
              : h('pre', { className: 'nw-vers-text' }, String(one.data?.text ?? '')),
        )
      : null,
  )
}

function ReviewPage({ projectId, chapters, project, toast, onRefresh, refreshKey }) {
  const [tab, setTab] = useState('chapters')
  // 别的页（问题单 / 逾期伏笔）想直接开某一章，就写这个键再切页；这里读一次就清掉。
  const [open, setOpenState] = useState(() => {
    const raw = readLS('nw.openChapter', '')
    return raw ? Number(raw) || null : null
  })
  const [filter, setFilter] = useState('review')
  // 逐章验收里的三视图。老键 nw.rvview 记着上次看的那个，
  // 因为「我今天在清问题单」这件事不该每次切页都忘。
  const [view, setViewState] = useState(() => {
    const raw = readLS('nw.rvview', 'list')
    return ['list', 'proposals', 'problems'].includes(raw) ? raw : 'list'
  })
  const setView = (next) => {
    setViewState(next)
    writeLS('nw.rvview', next)
  }
  // 读者视角的两个视图也记住上次看的那个，理由同上。
  const [readerView, setReaderViewState] = useState(() =>
    readLS('nw.rvreader', 'coldread') === 'opinions' ? 'opinions' : 'coldread',
  )
  const setReaderView = (next) => {
    setReaderViewState(next)
    writeLS('nw.rvreader', next)
  }
  const gate = Number(project?.qualityGate ?? 70)

  useEffect(() => {
    const raw = readLS('nw.openChapter', '')
    if (!raw) return
    writeLS('nw.openChapter', '')
    setTab('chapters')
    setOpenState(Number(raw) || null)
  }, [refreshKey])

  const rows = useMemo(() => {
    if (filter === 'all') return chapters
    if (filter === 'low') return chapters.filter((row) => row.score > 0 && row.score < gate)
    return chapters.filter((row) => row.status === filter)
  }, [chapters, filter, gate])

  const lowCount = chapters.filter((row) => row.score > 0 && row.score < gate).length
  const pending = chapters.filter((row) => row.status === 'review').length

  if (!projectId) return h(Empty, null, '还没有作品。')

  const FILTERS = [
    { value: 'review', label: '待验收' },
    { value: 'accepted', label: '已采纳' },
    { value: 'low', label: '低分' },
    { value: 'all', label: '全部' },
  ]

  // 【P4】五个抽屉收成三个。
  //
  // 原来：逐章验收 / 提案 / 问题单 / 冷读 / 意见池 —— 五颗等宽的钉子。
  // 但这五样不是一个维度的东西：前三个是「对稿子做什么」，后两个是「别人怎么读」。
  // 平铺成五个之后，作者每次都要先读五个词才找得到「提案」。
  //
  // 现在按动词分：
  //   逐章验收  —— 一章一章拍板（AI 的改动建议和攒下来的毛病都在这页里，用下面那排小开关切）
  //   读者视角  —— 冷读 + 意见池（都是「站在读者那边看」）
  //   历史版本  —— 同一章的旧稿，用来回滚
  //
  // 提案 / 问题单没有消失，它们变成「逐章验收」里的两个视图；冷读 / 意见池合成「读者视角」。
  const TABS = [
    { value: 'chapters', label: '逐章验收', icon: '📄' },
    { value: 'reader', label: '读者视角', icon: '👀' },
    { value: 'versions', label: '历史版本', icon: '🕘' },
  ]

  // 「逐章验收」里的第二排：稿子本身 / AI 的改动建议 / 攒下来的毛病。
  // 这三样共用一套筛选（待验收 / 已采纳 / 低分 / 全部），所以不该各占一个一级 tab。
  const VIEWS = [
    { value: 'list', label: '稿子' },
    { value: 'proposals', label: '提案' },
    { value: 'problems', label: '问题单' },
  ]

  const head = h(
    'div',
    { className: 'nw-rv-bar' },
    h(
      'div',
      { className: 'nw-actions' },
      h(
        'div',
        { className: 'nw-seg' },
        TABS.map((item) =>
          h(
            'button',
            {
              type: 'button',
              key: item.value,
              className: `nw-seg-btn${tab === item.value ? ' on' : ''}`,
              'aria-pressed': tab === item.value ? 'true' : 'false',
              onClick: () => {
                setTab(item.value)
                setOpenState(null)
              },
            },
            `${item.icon} ${item.label}`,
          ),
        ),
      ),
      tab === 'chapters' && !open
        ? h(
            'div',
            { className: 'nw-seg' },
            VIEWS.map((item) =>
              h(
                'button',
                {
                  type: 'button',
                  key: item.value,
                  className: `nw-seg-btn${view === item.value ? ' on' : ''}`,
                  'aria-pressed': view === item.value ? 'true' : 'false',
                  onClick: () => setView(item.value),
                },
                item.label,
              ),
            ),
          )
        : null,
      // 筛子只对「稿子」这一视图有意义 —— 提案和问题单自带状态分档，
      // 再来一排「待验收 / 已采纳 / 低分 / 全部」只会让人以为筛错了。
      tab === 'chapters' && !open && view === 'list'
        ? h(
            'div',
            { className: 'nw-seg' },
            FILTERS.map((item) =>
              h(
                'button',
                {
                  type: 'button',
                  key: item.value,
                  className: `nw-seg-btn${filter === item.value ? ' on' : ''}`,
                  'aria-pressed': filter === item.value ? 'true' : 'false',
                  onClick: () => setFilter(item.value),
                },
                item.label,
                h(
                  'span',
                  { className: 'nw-seg-n' },
                  String(
                    item.value === 'all'
                      ? chapters.length
                      : item.value === 'low'
                        ? lowCount
                        : chapters.filter((row) => row.status === item.value).length,
                  ),
                ),
              ),
            ),
          )
        : null,
    ),
    h(
      'span',
      { className: 'nw-hint' },
      tab === 'chapters' && !open
        ? `质检门槛 ${gate} 分 · 共 ${chapters.length} 章 · ${pending} 章等你拍板`
        : `质检门槛 ${gate} 分`,
    ),
  )

  // 读者视角：冷读和意见池共用一屏，顶上一个小开关。
  // 两个都是「站在读者那边看」，从前分两个一级 tab，等于让作者自己记住
  // 「这条意见是在哪一页看到的」。
  const readerBody = h(
    'div',
    { className: 'nw-reader' },
    h(
      'div',
      { className: 'nw-seg' },
      [
        { value: 'coldread', label: '冷读' },
        { value: 'opinions', label: '意见池' },
      ].map((item) =>
        h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-seg-btn${readerView === item.value ? ' on' : ''}`,
            'aria-pressed': readerView === item.value ? 'true' : 'false',
            onClick: () => setReaderView(item.value),
          },
          item.label,
        ),
      ),
    ),
    readerView === 'coldread'
      ? h(ColdReadPanel, {
          projectId,
          chapters,
          toast,
          onOpenChapter: (chapter) => {
            setTab('chapters')
            setView('list')
            setOpenState(chapter)
          },
        })
      : h(OpinionBoard, {
          projectId,
          toast,
          refreshKey,
          onOpenChapter: (chapter) => {
            setTab('chapters')
            setView('list')
            setOpenState(chapter)
          },
        }),
  )

  const body =
    tab === 'reader'
      ? readerBody
      : tab === 'versions'
        ? h(VersionsPanel, {
            projectId,
            chapters,
            toast,
            onOpenChapter: (chapter) => {
              setTab('chapters')
              setView('list')
              setOpenState(chapter)
            },
          })
        : tab === 'chapters' && view === 'proposals'
          ? h(ProposalBoard, { projectId, gate, toast, onRefresh, refreshKey })
          : tab === 'chapters' && view === 'problems'
            ? h(ProblemBoard, {
                projectId,
                gate,
                toast,
                onRefresh,
                refreshKey,
                onOpenChapter: (chapter) => {
                  setView('list')
                  setOpenState(chapter)
                },
              })
            : open
              ? h(ReviewDetail, {
                  projectId,
                  project,
                  chapter: open,
                  gate,
                  onClose: () => setOpenState(null),
                  onChanged: onRefresh,
                  toast,
                  // 【24 条 #15】J/K 换章：按当前筛选后的顺序走，不是全书的顺序。
                  onNav: (step) => {
                    const list = rows.length ? rows : chapters
                    const at = list.findIndex((row) => Number(row.chapter) === Number(open))
                    const next = list[at + step]
                    if (!next) {
                      toast(step > 0 ? '已经是最后一章了' : '已经是第一章了')
                      return
                    }
                    setOpenState(Number(next.chapter))
                  },
                })
              : h(ReviewList, { chapters: rows, gate, onOpen: setOpenState, selected: open })

  return h('div', { className: 'nw-page nw-review' }, head, body)
}
