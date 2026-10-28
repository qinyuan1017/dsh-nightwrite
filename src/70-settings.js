/**
 * 长夜 · 设置
 *
 * 四块：作品数据 / 模型预算 / 写作偏好 / 界面。
 */

/**
 * 【12 条 #8】AI 味词表编辑器。
 *
 * 为什么值得一个独立卡片：验收台那条彩带是从这里扫出来的。
 * 以前词表是 store 里的模块常量，你写「微微」「缓缓」写了一百万字，
 * 它永远扫不出来，因为它只认通用那二十来条。
 * 现在两件事都能做：加你自己的口头禅、停用你不认的条目。
 */
function AiLexiconCard({ projectId, toast }) {
  const res = useAsync(() => api('aistyle.get', { projectId }), [projectId], { skip: !projectId })
  const [phrase, setPhrase] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const items = res.data?.items ?? []
  const disabled = res.data?.disabled ?? []
  const custom = res.data?.custom ?? []

  const save = async (patch) => {
    setBusy(true)
    try {
      await api('aistyle.save', { projectId, ...patch })
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const word = phrase.trim()
    if (!word) {
      toast('先写一个要盯的词')
      return
    }
    if (items.some((row) => row.pattern === word)) {
      toast('这条已经在词表里了')
      return
    }
    save({ custom: [...custom, { phrase: word, hint: hint.trim() }] })
    setPhrase('')
    setHint('')
    toast(`已加入词表：${word}（下一章验收就会扫到）`)
  }

  const toggle = (pattern, off) => {
    const next = off ? [...disabled, pattern] : disabled.filter((row) => row !== pattern)
    save({ disabled: next })
  }

  const drop = (pattern) => {
    save({ custom: custom.filter((row) => row.phrase !== pattern) })
    toast(`已从词表删掉：${pattern}`)
  }

  return h(
    Card,
    {
      title: 'AI 味词表',
      extra: res.loading ? null : h(Tag, { tone: 'grey' }, `生效 ${items.length} 条`),
    },
    h('p', { className: 'cy-hint' }, '验收台右侧那条彩带就是拿这张表扫出来的。默认表是通用 AI 套话；你把反复用的词加进来，扫出来的才是「你的」毛病。'),
    res.error ? h(ErrorBox, { error: res.error, onRetry: res.reload }) : null,
    h(
      'div',
      { className: 'cy-lex-add' },
      h(Input, { value: phrase, placeholder: '要盯的词，比如「缓缓」', onChange: setPhrase }),
      h(Input, { value: hint, placeholder: '为什么烦它（可不填）', onChange: setHint }),
      h(Btn, { kind: 'primary', small: true, onClick: add, disabled: busy || !projectId }, '＋ 加入词表'),
    ),
    h(
      'div',
      { className: 'cy-lex-list' },
      items.length
        ? items.map((row) => {
          const off = disabled.includes(row.pattern)
          return h(
            'div',
            { className: `cy-lex-row${off ? ' cy-lex-off' : ''}`, key: `${row.source}:${row.pattern}` },
            h('span', { className: 'cy-lex-word' }, row.pattern),
            h('span', { className: 'cy-hint' }, row.hint || '（没写原因）'),
            row.source === 'custom' ? h(Tag, { tone: 'blue' }, '你自己加的') : null,
            h(
              'span',
              { className: 'cy-lex-acts' },
              h(Btn, { small: true, kind: 'ghost', onClick: () => toggle(row.pattern, !off), disabled: busy }, off ? '↺ 启用' : '停用'),
              row.source === 'custom'
                ? h(Btn, { small: true, kind: 'danger', onClick: () => drop(row.pattern), disabled: busy }, '删除')
                : null,
            ),
          )
        })
        : h(Empty, null, '词表是空的。默认表被全部停用了？上面加一条就回来。'),
    ),
    h(Hint, null, '停用不是删除：默认条目停用后还在这里，随时能开回来；自定义条目删掉才真没了。'),
  )
}

/**
 * 【阶段 B】语料池。
 *
 * 为什么这块要露在设置里：它量的是「真人写作时这些规则多久出现一次」，
 * 用来给检测器定阈值。没有它，所有阈值都是拍的。
 * 一本书只按内容哈希收一次；收够 3 本才给分位数，不够就明说别当真。
 */
function CorpusCard({ toast }) {
  const res = useAsync(() => api('corpus.list'), [])
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [source, setSource] = useState('self')
  const [busy, setBusy] = useState(false)
  const [derived, setDerived] = useState(null)

  const totals = res.data?.totals ?? { books: 0, chapters: 0, chars: 0, gap: 5584, booksNeeded: 26, progress: 0, bySource: {} }
  const books = res.data?.books ?? []

  const add = async () => {
    if (!text.trim()) {
      toast('先把正文粘进来')
      return
    }
    setBusy(true)
    try {
      const done = await api('corpus.add', { name: name.trim() || `未命名 ${books.length + 1}`, text, source })
      toast(done.message)
      setText('')
      setName('')
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const derive = async () => {
    setBusy(true)
    try {
      const out = await api('corpus.thresholds', { minBooks: 3 })
      setDerived(out)
      toast(out.summary)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const drop = async (id, label) => {
    setBusy(true)
    try {
      await api('corpus.remove', { id })
      toast(`已从池子里移出《${label}》`)
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    {
      title: '语料池（量阈值用）',
      extra: h(Tag, { tone: totals.books >= 3 ? 'green' : 'grey' }, `${totals.books} 本 / ${totals.chapters} 章`),
    },
    h(Hint, null, '检测器的阈值现在是我拍的。这块用你自己的稿子和公版书量出「真人写作时这条规则多久出现一次」，阈值才有依据。只存正文和统计，不存拆书结论。'),

    h(
      'div',
      { className: 'cy-corpus-bar' },
      h('div', { className: 'cy-corpus-fill', style: { width: `${Math.round((totals.progress ?? 0) * 100)}%` } }),
    ),
    h(
      'div',
      { className: 'cy-corpus-nums' },
      h('span', null, `目标 ${totals.target ?? 5584} 章（对齐公开拆书语料的统计量级）`),
      h('span', null, totals.gap > 0 ? `还差 ${totals.gap} 章，约 ${totals.booksNeeded} 本 200 章的书` : '统计量级已够'),
    ),

    books.length
      ? h(
        'div',
        { className: 'cy-corpus-list' },
        books.map((row) => h(
          'div',
          { className: 'cy-corpus-row', key: row.id },
          h('span', { className: 'cy-corpus-name' }, row.name),
          h(Tag, { tone: row.source === 'self' ? 'green' : row.source === 'public' ? 'blue' : 'grey' }, row.source === 'self' ? '自己写的' : row.source === 'public' ? '公版' : '已授权'),
          h('span', { className: 'cy-corpus-meta' }, `${row.chapters} 章 · ${fmtWords(row.chars)}`),
          h('button', { type: 'button', className: 'cy-icon-btn', title: '移出池子', onClick: () => drop(row.id, row.name) }, '✕'),
        )),
      )
      : h(Empty, null, '池子是空的。先把你正在写的这本书的原文粘进来——自己的语体最值钱。'),

    h(
      'div',
      { className: 'cy-corpus-add' },
      h(Input, { value: name, onChange: (e) => setName(e.target.value ?? ''), placeholder: '书名（可留空）' }),
      h(Select, {
        value: source,
        onChange: (e) => setSource(e.target.value ?? 'self'),
        options: [
          { value: 'self', label: '自己写的' },
          { value: 'public', label: '公版书' },
          { value: 'owned', label: '已授权' },
        ],
      }),
    ),
    h(TextArea, {
      value: text,
      onChange: (e) => setText(e.target.value ?? ''),
      rows: 5,
      placeholder: '把整本正文粘进来（会自动切章）。只用来统计，不会出现在任何导出里。',
    }),
    h(
      'div',
      { className: 'cy-actions' },
      h(Btn, { kind: 'primary', small: true, disabled: busy, onClick: add }, busy ? '收着…' : '收进池子'),
      h(Btn, { small: true, disabled: busy || totals.books < 1, onClick: derive }, '量一遍阈值'),
    ),

    derived
      ? h(
        'div',
        { className: 'cy-corpus-out' },
        h('div', { className: 'cy-corpus-sum' }, derived.summary),
        derived.rules.filter((r) => r.enough).length
          ? h(
            'div',
            { className: 'cy-corpus-th' },
            derived.rules.filter((r) => r.enough).slice(0, 12).map((r) => h(
              'div',
              { className: `cy-corpus-th-row${r.noisy ? ' cy-corpus-th-noisy' : ''}`, key: r.id },
              h('span', { className: 'cy-corpus-th-name' }, r.label),
              h('span', { className: 'cy-corpus-th-num' }, `语料 p90 ${r.p90}/千字`),
              h('span', { className: 'cy-corpus-th-num' }, `现在 ${r.current || '—'}`),
              r.noisy ? h(Tag, { tone: 'amber' }, '会天天报警') : null,
            )),
          )
          : null,
      )
      : null,
  )
}

function SettingsPage({
  projectId, project, projects, chapters, onSwitch, toast, onRefresh, theme, setTheme,
}) {
  const [draft, setDraft] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', genre: '', logline: '', targetWords: 2500, qualityGate: 70, monthlyBudget: 600 })
  const [confirm, setConfirm] = useState('')
  const [exporting, setExporting] = useState(false)
  const chaptersCount = Array.isArray(chapters) ? chapters.length : 0
  // 回收站要能看见，否则「删了还能找回」只是一句话。
  const trash = useAsync(() => api('chapter.trash', { projectId }), [projectId], { skip: !projectId })

  useEffect(() => {
    setDraft(project ? { ...project } : null)
  }, [project])

  const saveProject = async () => {
    if (!projectId || !draft) return
    try {
      await api('project.save', {
        projectId,
        patch: {
          name: draft.name,
          genre: draft.genre,
          logline: draft.logline,
          targetWords: Number(draft.targetWords) || 2500,
          qualityGate: Number(draft.qualityGate) || 70,
          monthlyBudget: Number(draft.monthlyBudget) || 600,
        },
      })
      onRefresh?.()
      toast('已保存')
    } catch (error) {
      toast(error.message)
    }
  }

  const create = async () => {
    if (!String(form.name).trim()) {
      toast('先起个书名')
      return
    }
    try {
      const res = await api('project.create', form)
      setCreating(false)
      onRefresh?.()
      onSwitch?.(res.id)
      toast(`已建《${res.name}》`)
    } catch (error) {
      toast(error.message)
    }
  }

  const remove = async () => {
    if (!projectId) return
    if (confirm !== (project?.name ?? '')) {
      toast('书名不一致，没有删除')
      return
    }
    try {
      await api('project.delete', { projectId })
      setConfirm('')
      onRefresh?.()
      toast('已删除')
    } catch (error) {
      toast(error.message)
    }
  }

  return h(
    'div',
    { className: 'cy-page cy-settings' },
    h(
      Card,
      { title: '作品数据', extra: h(Btn, { small: true, kind: 'primary', onClick: () => setCreating(true) }, '＋ 新建作品') },
      h(
        'div',
        { className: 'cy-proj-list' },
        projects.length
          ? projects.map((row) => h(
            'button',
            {
              type: 'button',
              key: row.id,
              className: `cy-proj${row.id === projectId ? ' on' : ''}`,
              onClick: () => onSwitch?.(row.id),
            },
            h('span', { className: 'cy-proj-name' }, row.name),
            h('span', { className: 'cy-proj-meta' }, `${row.chapters} 章 · ${fmtWords(row.words)} 字`),
            row.id === projectId ? h(Tag, { tone: 'amber' }, '当前') : null,
          ))
          : h(Empty, null, '还没有作品。'),
      ),
      draft
        ? h(
          Fragment,
          null,
          h('div', { className: 'cy-form-grid' },
            h(Field, { label: '书名' }, h(Input, { value: draft.name, onChange: (v) => setDraft({ ...draft, name: v }) })),
            h(Field, { label: '题材' }, h(Input, { value: draft.genre, onChange: (v) => setDraft({ ...draft, genre: v }) })),
            h(Field, { label: '每章目标字数' }, h(Input, {
              type: 'number',
              value: draft.targetWords,
              onChange: (v) => setDraft({ ...draft, targetWords: v }),
            })),
            h(Field, { label: '质检门槛（分）' }, h(Input, {
              type: 'number',
              value: draft.qualityGate,
              onChange: (v) => setDraft({ ...draft, qualityGate: v }),
            })),
            h(Field, { label: '月预算（元）' }, h(Input, {
              type: 'number',
              value: draft.monthlyBudget,
              onChange: (v) => setDraft({ ...draft, monthlyBudget: v }),
            })),
            h(Field, { label: '一句话卖点' }, h(Input, { value: draft.logline, onChange: (v) => setDraft({ ...draft, logline: v }) })),
          ),
          h('div', { className: 'cy-actions' }, h(Btn, { kind: 'primary', onClick: saveProject }, '保存作品设置')),
        )
        : null,
      h(
        'details',
        { className: 'cy-danger-zone' },
        h('summary', null, '危险区：删除这部作品'),
        h('p', { className: 'cy-hint' }, '目录会被整份删掉，无法撤销。输入书名确认。'),
        h(Input, { value: confirm, onChange: setConfirm, placeholder: project?.name ?? '' }),
        h(Btn, { kind: 'danger', onClick: remove }, '确认删除'),
      ),
    ),
    h(
      Card,
      { title: '模型与预算' },
      h(KV, {
        rows: [
          { key: '质检门槛', text: String(project?.qualityGate ?? 70) + ' 分' },
          { key: '每章目标', text: String(project?.targetWords ?? 2500) + ' 字' },
          { key: '月预算', text: `¥${project?.monthlyBudget ?? 600}` },
          { key: '数据根', text: '~/.dsh/data/dsh-changye', mono: true },
        ],
      }),
      h(Hint, null, '预算与门槛存在 project.json 里；每次跑批前由 agent 读它做闸门。'),
    ),
    // 【24 条 #23】【12 条 #12】导出全部数据：以前只弹一句 toast，什么都没生成。
    // 现在真的打一个 zip：GET /changye/api/export?projectId=... 回字节流，
    // 前端接成 blob 用 <a download> 落到下载目录。
    h(
      Card,
      {
        title: '导出全部数据',
        extra: h(Tag, { tone: 'green' }, '真打包'),
      },
      h('p', { className: 'cy-hint' }, '把这部作品的所有文件打成一个 zip：正文、账本、大纲、队列、提案、问题单、设置、历史版本、回收站。导出的就是磁盘上那棵目录，不带任何私有格式。'),
      h(
        'div',
        { className: 'cy-export-tree' },
        [
          ['chapters/', `${chaptersCount} 个 .txt 正文`, 'text'],
          ['chapters/history/', '历史版本（每章最近 20 版）', 'text'],
          ['chapters/.trash/', '回收站里删掉的章', 'text'],
          ['ledger.json', '八类账本', 'json'],
          ['outline.json', '卷纲与细纲', 'json'],
          ['queue.json', '工单队列', 'json'],
          ['proposals.json', 'AI 提案与拍板记录', 'json'],
          ['problems.json', '问题单', 'json'],
          ['project.json', '书名 / 门槛 / 预算', 'json'],
        ].map(([name, desc, kind]) => h(
          'div',
          { className: 'cy-export-row', key: name },
          h('span', { className: `cy-export-icon cy-export-${kind}` }, kind === 'text' ? '📄' : '{ }'),
          h('span', { className: 'cy-export-name' }, name),
          h('span', { className: 'cy-hint' }, desc),
        )),
      ),
      h(
        'div',
        { className: 'cy-actions' },
        h(Btn, {
          kind: 'primary',
          disabled: !projectId || exporting,
          onClick: async () => {
            if (!projectId || exporting) return
            setExporting(true)
            try {
              const base = String(bootInfo().apiUrl || ROUTE).replace(/\/+$/, '')
              const res = await fetch(`${base}/export?projectId=${encodeURIComponent(projectId)}`, {
                credentials: 'same-origin',
              })
              if (!res.ok) {
                // 失败时后端回的是 JSON 错误体，不是 zip。
                let message = `导出失败（HTTP ${res.status}）`
                try {
                  const data = await res.json()
                  message = data?.error?.message || message
                } catch {
                  /* 非 JSON，用默认文案 */
                }
                throw new Error(message)
              }
              const blob = await res.blob()
              const files = res.headers.get('x-changye-files') ?? '?'
              const name = `${project?.name ?? projectId}-${new Date().toISOString().slice(0, 10)}.zip`
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = name
              a.rel = 'noopener'
              document.body.appendChild(a)
              a.click()
              a.remove()
              // 立刻 revoke 会让部分浏览器来不及开始下载，等一拍再放。
              setTimeout(() => URL.revokeObjectURL(url), 4000)
              toast(`已打包 ${files} 个文件 · ${(blob.size / 1024).toFixed(0)} KB，浏览器正在下载`)
            } catch (error) {
              toast(error.message)
            } finally {
              setExporting(false)
            }
          },
        }, exporting ? '打包中…' : '📦 打包成 zip 下载'),
        h(Btn, {
          kind: 'ghost',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(`~/.dsh/data/dsh-changye/${projectId ?? '<作品>'}`)
              toast('已复制目录路径，直接去文件管理器里拷')
            } catch {
              toast('复制失败，手动去 ~/.dsh/data/dsh-changye 拿')
            }
          },
        }, '复制目录路径'),
      ),
      h(Hint, null, '导出是纯读取，不改任何文件；打包失败也不会动正文。zip 用 store 模式（不压缩），几 MB，解开就是原文件。'),
    ),
    // 回收站：删章不再是永久删除。这里能看见删了什么、能还原。
    h(
      Card,
      {
        title: '回收站',
        extra: h('span', { className: 'cy-card-badge' }, `${trash.data?.items?.length ?? 0}`),
      },
      !projectId
        ? h(Empty, null, '还没有作品。')
        : trash.loading && !trash.data
          ? h(Loading, null)
          : (trash.data?.items ?? []).length
            ? h(
              'div',
              { className: 'cy-trash-list' },
              trash.data.items.map((row) => h(
                'div',
                { className: 'cy-trash-row', key: row.trash },
                h('span', { className: 'cy-trash-n' }, `第 ${row.chapter} 回`),
                h('span', { className: 'cy-trash-title' }, row.title),
                h('span', { className: 'cy-trash-w' }, `${row.words} 字`),
                h('span', { className: 'cy-hint cy-trash-at' }, `${String(row.at ?? '').slice(0, 8)} ${String(row.at ?? '').slice(9, 15)}`),
                h(Btn, {
                  small: true,
                  kind: 'ghost',
                  onClick: async () => {
                    try {
                      await api('chapter.recover', { projectId, trash: row.trash })
                      trash.reload()
                      onRefresh?.()
                      toast(`第 ${row.chapter} 回已还原`)
                    } catch (error) {
                      toast(error.message)
                    }
                  },
                }, '↩ 还原'),
                h(Btn, {
                  small: true,
                  kind: 'danger',
                  onClick: async () => {
                    try {
                      await api('chapter.purge', { projectId, trash: row.trash })
                      trash.reload()
                      toast('已彻底删除这一项')
                    } catch (error) {
                      toast(error.message)
                    }
                  },
                }, '彻底删除'),
              )),
            )
            : h(Empty, null, '回收站是空的。删章都会先进这里，可以还原。'),
      h(Hint, null, '删章只是移到 chapters/.trash/，正文和元数据都还在。还原时若原位置已有同名文件会报冲突，不会覆盖。'),
    ),
    h(
      Card,
      { title: '写作偏好' },
      h(Field, { label: '默认稿纸（场景分隔符）' }, h(Input, { value: '※', onChange: () => {} })),
      h(Hint, null, '场景分隔统一用 ※；正文一律纯文本，禁 Markdown —— 与写入门禁一致。'),
      // 【12 条 #2】自动保存开关：有人不喜欢它偷偷发请求，给个真的开关。
      h(
        Field,
        { label: '自动保存' },
        h(
          'div',
          { className: 'cy-actions' },
          h(Switch, {
            on: readLS(LS.autosave, '1') !== '0',
            onChange: (next) => {
              writeLS(LS.autosave, next ? '1' : '0')
              toast(next ? '自动保存已打开：停手 4 秒就落盘' : '自动保存已关，记得手动点保存')
              onRefresh?.()
            },
          }),
          h('span', { className: 'cy-hint' }, readLS(LS.autosave, '1') !== '0' ? '停手 4 秒落盘一次' : '关着，切页前会拦你一次'),
        ),
      ),
    ),
    // 【LNW 差异】导出成书 + 检查更新：交给外面的人看之前，先把稿子做成一本真的书。
    h(BookExport, { projectId, project, toast }),
    h(UpdateCard, { toast }),
    // 【12 条 #8】AI 味词表：以前是模块常量，扫出来的全是「通用 AI 味」，
    // 扫不到你自己反复用的那几句。现在能加、能停用。
    h(AiLexiconCard, { projectId, toast }),
    // 【阶段 B】语料池：阈值从自己的样本里量，不从感觉里拍。
    h(CorpusCard, { toast }),
    h(
      Card,
      { title: '界面' },
      // 【24 条 #24】主题三档：暗 / 亮 / 纸。米黄底配宋体，盯久了总得有个柔和的。
      h(
        'div',
        { className: 'cy-theme-row' },
        [
          { value: 'dark', label: '暗色', hint: '默认。夜里写。' },
          { value: 'light', label: '亮色', hint: '白天用。' },
          { value: 'paper', label: '纸', hint: '米黄底 + 宋体，柔和。' },
        ].map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `cy-theme-card cy-theme-${item.value}${theme === item.value ? ' on' : ''}`,
            onClick: () => {
              setTheme(item.value)
              toast(`已切到「${item.label}」主题`)
            },
          },
          h('span', { className: 'cy-theme-swatch' }, item.value === 'paper' ? '纸' : ''),
          h('span', { className: 'cy-theme-name' }, item.label),
          h('span', { className: 'cy-theme-hint' }, item.hint),
        )),
      ),
      h(Hint, null, '主题记在 localStorage，只影响长夜这一层，不动宿主界面。'),
    ),
    creating
      ? h(
        Modal,
        {
          title: '新建作品',
          onClose: () => setCreating(false),
          footer: h(
            Fragment,
            null,
            h(Btn, { kind: 'ghost', small: true, onClick: () => setCreating(false) }, '取消'),
            h(Btn, { kind: 'primary', small: true, onClick: create }, '创建'),
          ),
        },
        h(Field, { label: '书名' }, h(Input, { value: form.name, onChange: (v) => setForm({ ...form, name: v }) })),
        h(Field, { label: '题材' }, h(Input, { value: form.genre, onChange: (v) => setForm({ ...form, genre: v }) })),
        h(Field, { label: '一句话卖点' }, h(TextArea, { value: form.logline, rows: 2, onChange: (v) => setForm({ ...form, logline: v }) })),
        h('div', { className: 'cy-form-grid' },
          h(Field, { label: '每章目标字数' }, h(Input, {
            type: 'number', value: form.targetWords, onChange: (v) => setForm({ ...form, targetWords: Number(v) || 0 }),
          })),
          h(Field, { label: '质检门槛' }, h(Input, {
            type: 'number', value: form.qualityGate, onChange: (v) => setForm({ ...form, qualityGate: Number(v) || 0 }),
          }))),
      )
      : null,
  )
}
