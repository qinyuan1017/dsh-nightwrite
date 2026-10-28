
// ── 拆书台（第 2 批）────────────────────────────────────
//
// 这一块跟「组装指令」的区别：组装指令是把活交给对话里的 agent（需要人再粘一次），
// 拆书台是真跑 —— 粘全文进来，服务端当场切章、算字数、判钩子、抽剧情点，
// 结果落盘在 <作品>/analyses/，关掉界面再回来还在。
//
// 为什么不用 AI 拆：AI 拆得更好，但慢、要钱、要联网。先用规则把「能算的」算出来，
// 模型只负责最后那层「这本书凭什么让人追」—— 那层留给人去问 agent。

function AnalyzePanel({ projectId, toast }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [list, setList] = useState([])
  const [cur, setCur] = useState(null)

  const reload = useCallback(async () => {
    try {
      const value = await api('analyze.list', { projectId })
      setList(Array.isArray(value?.items) ? value.items : [])
    } catch {
      setList([])
    }
  }, [projectId])

  useEffect(() => { reload() }, [reload])

  const run = async () => {
    if (!text.trim()) {
      toast('先把整本书粘进来（或粘前二十章也行）')
      return
    }
    setBusy(true)
    try {
      const value = await api('analyze.start', { projectId, text })
      toast(`拆完 ${value.chapters} 章 · 共 ${fmtWords(value.totalWords)}字`)
      setText('')
      await reload()
      const full = await api('analyze.get', { projectId, id: value.id })
      setCur(full)
    } catch (error) {
      toast(`拆不动：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const openOne = async (id) => {
    try {
      setCur(await api('analyze.get', { projectId, id }))
    } catch (error) {
      toast(`打不开：${error.message}`)
    }
  }

  const drop = async (id) => {
    try {
      await api('analyze.remove', { projectId, id })
      if (cur?.id === id) setCur(null)
      await reload()
      toast('删掉了')
    } catch (error) {
      toast(`删不掉：${error.message}`)
    }
  }

  return h(
    Card,
    {
      title: '拆书台',
      extra: h('div', { className: 'nw-actions' },
        h(Tag, { tone: 'teal' }, `${list.length} 次`),
        h(Btn, { small: true, kind: 'ghost', onClick: reload }, '刷新')),
    },
    h('p', { className: 'nw-hint' },
      '粘一本别人的书进来，当场切章、算字数与对话比、判章末钩子、抽剧情点。'
      + '算得出来的先算出来，「凭什么让人追」那层再拿去问 agent。'),
    h(Field, { label: '整本正文（「第一章 xxx」这种标题要留在里面）' },
      h(TextArea, {
        value: text,
        rows: 6,
        onChange: setText,
        placeholder: '第一章 城头夜雨\n雨落下来的时候……',
      })),
    h('div', { className: 'nw-actions' },
      h(Btn, { kind: 'primary', small: true, onClick: run }, busy ? '拆着呢…' : '开始拆'),
      text ? h(Btn, { small: true, kind: 'ghost', onClick: () => setText('') }, '清空') : null),

    list.length
      ? h('div', { className: 'nw-ana-hist' }, list.map((row) => h(
        'div',
        { className: `nw-ana-hist-row${cur?.id === row.id ? ' on' : ''}`, key: row.id },
        h('button', {
          type: 'button',
          className: 'nw-ana-hist-main',
          onClick: () => openOne(row.id),
        },
        h('span', { className: 'nw-ana-hist-icon' }, '🧪'),
        h('span', { className: 'nw-ana-hist-body' },
          h('span', { className: 'nw-ana-hist-title' }, row.title),
          h('span', { className: 'nw-ana-hist-sub' }, `${row.chapters} 章 · ${fmtWords(row.totalWords ?? 0)}字`)),
        h(Tag, { tone: 'grey' }, '已拆'),
        h('span', { className: 'nw-ana-hist-at' }, String(row.createdAt ?? '').slice(0, 10)),
        h('span', { className: 'nw-prop-go' }, cur?.id === row.id ? '▾' : '▸')),
        cur?.id === row.id
          ? h('div', { className: 'nw-ana-hist-detail' },
            h('div', { className: 'nw-actions' },
              h(Btn, { small: true, kind: 'ghost', onClick: () => drop(row.id) }, '删掉这次')),
            h(AnalyzeResult, { data: cur }))
          : null,
      )))
      : h('p', { className: 'nw-hint' }, '还没拆过书。'),
  )
}

function AnalyzeResult({ data }) {
  const hookStat = Object.entries(data.hookCount ?? {})
  return h(
    'div',
    { className: 'nw-analyze' },
    h('div', { className: 'nw-analyze-stat' },
      h(KV, {
        rows: [
          ['章数', String(data.chapters)],
          ['总字数', `${fmtWords(data.totalWords ?? 0)}字`],
          ['平均情绪值', String(data.avgEmotion ?? 0)],
          ['平均对话比', `${Math.round((data.avgDialogue ?? 0) * 100)}%`],
        ],
      })),
    h('div', { className: 'nw-analyze-hooks' },
      hookStat.map(([id, count]) => h(Tag, { key: id, tone: 'blue' }, `${id} × ${count}`))),
    data.noise?.length
      ? h('p', { className: 'nw-hint' }, `排除了 ${data.noise.length} 段非正文：${data.noise.slice(0, 3).join(' / ')}`)
      : null,
    // 黄金三章单独拎出来：判一本书能不能留人，前三章占七成。
    data.opening?.length
      ? h('div', { className: 'nw-analyze-open' },
        h('h4', null, '黄金三章'),
        data.opening.map((row) => h('div', { className: 'nw-analyze-row', key: row.num },
          h('span', { className: 'nw-analyze-ch' }, `第 ${row.num} 章`),
          h('span', { className: 'nw-analyze-title' }, row.title),
          h(Tag, { tone: 'amber' }, row.hook?.label ?? '—'),
          h('span', { className: 'nw-analyze-num' }, `${fmtWords(row.words)}字`),
          h('span', { className: 'nw-analyze-num' }, `对话 ${Math.round((row.dialogue ?? 0) * 100)}%`))))
      : null,
    h('div', { className: 'nw-analyze-open' },
      h('h4', null, `逐章（${data.rows?.length ?? 0} 章）`),
      (data.rows ?? []).slice(0, 30).map((row) => h('div', { className: 'nw-analyze-row', key: row.num },
        h('span', { className: 'nw-analyze-ch' }, `第 ${row.num} 章`),
        h('span', { className: 'nw-analyze-title' }, row.title),
        h(Tag, { tone: row.hook?.id === 'flat' || row.hook?.id === 'none' ? 'red' : 'green' }, row.hook?.label ?? '—'),
        h('span', { className: 'nw-analyze-num' }, `${fmtWords(row.words)}字`),
        h('span', { className: 'nw-analyze-beats' },
          (row.beats ?? []).length ? row.beats[0] : '（没抽到动作句）'))),
      (data.rows?.length ?? 0) > 30 ? h('p', { className: 'nw-hint' }, `只列前 30 章，后面还有 ${data.rows.length - 30} 章。`) : null),
  )
}

// ── 导入台（第 3 批）────────────────────────────────────
//
// 已有的书反向导进来 —— 「我在别处写了八十章，想搬过来接着写」是最常见的第一件事。
// 做两件事：认章节（排除作者的话、本章说），把卷铺进大纲。
// 导入的章一律 status='review'：别人的稿也得过一遍验收，不该直接算已采纳。

function ImportPanel({ projectId, toast, onRefresh }) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('append')
  const [per, setPer] = useState('100')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  const look = async () => {
    if (!text.trim()) {
      toast('先粘正文进来')
      return
    }
    setBusy(true)
    try {
      setPreview(await api('import.preview', { text }))
    } catch (error) {
      toast(`认不出来：${error.message}`)
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!text.trim()) {
      toast('先粘正文进来')
      return
    }
    setBusy(true)
    try {
      const value = await api('import.run', { projectId, text, mode, chaptersPerVolume: Number(per) || 100 })
      toast(`导进 ${value.written} 章（第 ${value.from}–${value.to} 章）`)
      setText('')
      setPreview(null)
      onRefresh?.()
    } catch (error) {
      toast(`导不进去：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    { title: '导入已有的书', extra: h(Tag, { tone: 'amber' }, '只认章节标题') },
    h('p', { className: 'nw-hint' },
      '在别处写好的稿搬进来。「第一章 / 第1章 / 楔子 / Chapter 3」都认；'
      + '「作者的话」「本章说」会被挑出来不算正文。导入的章是「待验收」——别人的稿也要过一遍。'),
    h(Field, { label: '整本正文' },
      h(TextArea, {
        value: text,
        rows: 6,
        onChange: setText,
        placeholder: '第一章 城头夜雨\n……',
      })),
    h('div', { className: 'nw-import-opts' },
      h(Field, { label: '接到哪' },
        h(Select, {
          value: mode,
          onChange: setMode,
          options: [
            { value: 'append', label: '接在已有最后一章后面' },
            { value: 'replace', label: '清空现有章节再导（旧章进回收站，能捞回来）' },
          ],
        })),
      h(Field, { label: '每卷多少章' },
        h(Input, { value: per, onChange: setPer, placeholder: '100' }))),
    h('div', { className: 'nw-actions' },
      h(Btn, { small: true, kind: 'ghost', onClick: look }, busy ? '认着呢…' : '先认一遍（不写盘）'),
      h(Btn, { small: true, kind: 'primary', onClick: run }, busy ? '导着呢…' : '真导进去')),
    preview
      ? h('div', { className: 'nw-analyze' },
        h(KV, {
          rows: [
            ['认出章数', String(preview.chapters)],
            ['空章跳过', String(preview.skippedEmpty ?? 0)],
            ['总字数', `${fmtWords(preview.totalWords ?? 0)}字`],
            ['排除的非正文', preview.noise?.length ? preview.noise.slice(0, 3).join(' / ') : '没有'],
          ],
        }),
        h('div', { className: 'nw-analyze-open' },
          h('h4', null, '前几章长这样'),
          preview.head.map((row) => h('div', { className: 'nw-analyze-row', key: row.at },
            h('span', { className: 'nw-analyze-ch' }, `#${row.at}`),
            h('span', { className: 'nw-analyze-title' }, row.title),
            h('span', { className: 'nw-analyze-num' }, `${fmtWords(row.words)}字`),
            h('span', { className: 'nw-analyze-beats' }, row.firstLine)))),
        preview.truncated ? h('p', { className: 'nw-hint' }, '只预览前 20 章。') : null)
      : null,
  )
}

// ── 扫榜台（第 4 批）────────────────────────────────────
//
// 两条路分开摆，因为它们可靠性差一个量级：
//   粘榜单文本 —— 稳，永远能用，解析规则写在 lib/scan.js。
//   自动抓网页 —— 尽力而为，反爬随时变，抓不到就说抓不到。
// 把易碎的东西伪装成可靠的东西，比没有更坏。

function ScanBoard({ projectId, toast }) {
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState('')
  const [url, setUrl] = useState('')
  const [list, setList] = useState([])
  const [cur, setCur] = useState(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      const value = await api('scan.list', { projectId })
      setList(Array.isArray(value?.items) ? value.items : [])
    } catch {
      setList([])
    }
  }, [projectId])

  useEffect(() => { reload() }, [reload])

  const save = async () => {
    if (!text.trim()) {
      toast('先把榜单粘进来')
      return
    }
    setBusy(true)
    try {
      const value = await api('scan.save', { projectId, text, platform })
      toast(`解析出 ${value.count} 本`)
      setText('')
      await reload()
      setCur(value)
    } catch (error) {
      toast(`解析失败：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const grab = async () => {
    if (!url.trim()) {
      toast('先填一个榜单页地址')
      return
    }
    setBusy(true)
    try {
      const value = await api('scan.fetch', { url })
      if (value?.ok && value.text) {
        setText(value.text)
        toast('抓到了，先看一眼再点解析')
      } else {
        toast(`没抓到：${value?.error ?? '这个页面没给出可读内容'}。改成手动粘吧`)
      }
    } catch (error) {
      toast(`抓不了：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const openOne = async (id) => {
    try {
      setCur(await api('scan.get', { projectId, id }))
    } catch (error) {
      toast(`打不开：${error.message}`)
    }
  }

  const cols = ['#', '书名', '题材', '收藏', '趋势']
  return h(
    Card,
    { title: '扫榜台', extra: h(Tag, { tone: 'teal' }, `${list.length} 次`) },
    h('p', { className: 'nw-hint' },
      '粘榜单文本进来 —— 一行一本，名次在前、书名在后，中间或后面跟题材与数字。'
      + '「排名 书名 题材 收藏 趋势」这种表头会自动跳过。'),
    h(Field, { label: '平台' }, h(Input, { value: platform, onChange: setPlatform, placeholder: '起点 / 番茄 / 七猫' })),
    h(Field, { label: '榜单正文' },
      h(TextArea, {
        value: text,
        rows: 6,
        onChange: setText,
        placeholder: '1. 我在大明当暴君 历史 38.2万 ↑12\n2 重生之我家有矿（都市）96.5万 ↑5',
      })),
    h('div', { className: 'nw-actions' },
      h(Btn, { small: true, kind: 'primary', onClick: save }, busy ? '解析中…' : '解析并存下')),
    h('details', { className: 'nw-scan-auto' },
      h('summary', null, '或者让我去抓（尽力而为，抓不到就手动粘）'),
      h('div', { className: 'nw-actions' },
        h(Input, { value: url, onChange: setUrl, placeholder: 'https://…榜单页地址' }),
        h(Btn, { small: true, kind: 'ghost', onClick: grab }, busy ? '抓着…' : '去抓')),
      h('p', { className: 'nw-hint' }, '榜单页结构一个月能改三版，写死选择器只会变成「昨天还能用」的谎言。抓不到是常态。')),

    cur
      ? h('div', { className: 'nw-analyze' },
        h(KV, {
          rows: [
            ['平台', cur.platform ?? '—'],
            ['本数', String(cur.count ?? cur.rows?.length ?? 0)],
            ['题材分布', (cur.genres ?? []).map((g) => `${g.name} ${g.count}`).join(' / ') || '—'],
            ['上升最多', (cur.rising ?? []).slice(0, 3).map((r) => `${r.book} ${r.delta > 0 ? '+' : ''}${r.delta}`).join(' / ') || '—'],
          ],
        }),
        h('div', { className: 'nw-scan' },
          h('div', { className: 'nw-scan-head' }, cols.map((label) => h('span', { className: 'nw-scan-th', key: label }, label))),
          (cur.rows ?? []).map((row) => h('div', { className: 'nw-scan-row', key: `${row.rank}-${row.book}` },
            h('span', { className: 'nw-scan-td nw-scan-rank' }, String(row.rank)),
            h('span', { className: 'nw-scan-td nw-scan-book' }, row.book),
            h('span', { className: 'nw-scan-td' }, h(Tag, { tone: 'grey' }, row.genre || '未标注')),
            h('span', { className: 'nw-scan-td nw-scan-num' }, row.collect || '—'),
            h('span', { className: `nw-scan-td nw-scan-trend${/↓/.test(row.trend) ? ' down' : /↑/.test(row.trend) ? ' up' : ''}` }, row.trend || '—')))))
      : null,

    list.length
      ? h('div', { className: 'nw-scan-hist' }, list.map((row) => h(
        'button',
        {
          type: 'button',
          className: 'nw-scan-hist-row',
          key: row.id,
          onClick: () => openOne(row.id),
        },
        h('span', { className: 'nw-scan-hist-icon' }, '📊'),
        h('span', { className: 'nw-scan-hist-body' },
          h('span', { className: 'nw-scan-hist-title' }, `${row.platform} 榜`),
          h('span', { className: 'nw-scan-hist-sub' }, `${row.count} 本`)),
        h('span', { className: 'nw-scan-hist-at' }, String(row.createdAt ?? '').slice(0, 10)),
        h('span', { className: 'nw-prop-go' }, '▸'))))
      : null,
  )
}
