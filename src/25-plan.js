/**
 * 长夜 · 大纲
 *
 * 补的是工作流中间断掉的一截：老板给一句话方案 → 出卷 / 章骨架 → 才谈得上下指令单。
 *
 * 这一页不假装自己能写故事：骨架是机械算出来的（卷数 × 每卷章数），
 * 每章的摘要 / 钩子由 AI 通过 nightwrite_op 的 outline.save 回填，
 * 人在这里改，改完一键把「第几回 + 意图」塞进生产台。
 */

const OUTLINE_STATUS = {
  todo: { label: '未排', tone: 'grey' },
  drafted: { label: '已有稿', tone: 'amber' },
  written: { label: '已采纳', tone: 'green' },
}

function outlinePrompt(brief) {
  const line = (key, label) => (String(brief?.[key] ?? '').trim() ? `- ${label}：${String(brief[key]).trim()}\n` : '')
  return [
    '帮我把这份方案铺成卷章骨架，然后回填每章的一句话摘要与章末钩子。\n',
    '方案：\n',
    line('premise', '一句话故事'),
    line('genre', '题材'),
    line('audience', '目标读者'),
    line('protagonist', '主角'),
    line('goal', '主角要什么'),
    line('conflict', '核心阻力'),
    line('hook', '开场钩子'),
    line('ending', '结局方向'),
    `- 规模：${brief?.volumes ?? 3} 卷，每卷 ${brief?.chaptersPerVolume ?? 20} 章\n`,
    '\n做法：先 nightwrite_op 调 outline.get 拿到当前骨架（卷号 / 章号已经在里面），',
    '再把每章的 title / summary / hook 填好，用 outline.save 整份写回。',
    '摘要只写「这一章发生什么、主角状态怎么变」，一句话；钩子写「结尾让人翻页的那一下」。',
  ].join('')
}

function PlanBrief({ brief, onEdit, onSave, onGenerate, onCopy, busy }) {
  const FIELDS = [
    { key: 'premise', label: '一句话故事', rows: 2, placeholder: '例：元末，女主带着系统穿到朱元璋身边，要从他手里抢下天下。' },
    { key: 'genre', label: '题材', rows: 1, placeholder: '历史穿越 / 女帝' },
    { key: 'audience', label: '目标读者', rows: 1, placeholder: '看权谋爽文的男性读者' },
    { key: 'protagonist', label: '主角', rows: 1, placeholder: '名字 + 一句话身份' },
    { key: 'goal', label: '主角要什么', rows: 1, placeholder: '主线目标，越具体越好' },
    { key: 'conflict', label: '核心阻力', rows: 1, placeholder: '谁挡着、缺什么、时间压力' },
    { key: 'hook', label: '开场钩子', rows: 1, placeholder: '第一章第一屏就要抓住人的那件事' },
    { key: 'ending', label: '结局方向', rows: 1, placeholder: '可以很粗，但要有个落点' },
  ]
  return h(
    Card,
    {
      title: '老板的方案',
      extra: h('span', { className: 'nw-card-badge' }, '先有方案，才有骨架'),
      className: 'nw-plan-brief',
    },
    h(
      'div',
      { className: 'nw-plan-grid' },
      FIELDS.map((field) => h(
        'div',
        { className: `nw-plan-field${field.rows > 1 ? ' nw-plan-wide' : ''}`, key: field.key },
        h(Field, { label: field.label }, field.rows > 1
          ? h(TextArea, {
            value: brief[field.key] ?? '',
            rows: field.rows,
            placeholder: field.placeholder,
            onChange: (v) => onEdit({ [field.key]: v }),
          })
          : h(Input, {
            value: brief[field.key] ?? '',
            placeholder: field.placeholder,
            onChange: (v) => onEdit({ [field.key]: v }),
          })),
      )),
      h(
        'div',
        { className: 'nw-plan-field' },
        h(Field, { label: '几卷' }, h(Input, {
          type: 'number',
          value: brief.volumes,
          onChange: (v) => onEdit({ volumes: Number(v) || 1 }),
        })),
      ),
      h(
        'div',
        { className: 'nw-plan-field' },
        h(Field, { label: '每卷几章' }, h(Input, {
          type: 'number',
          value: brief.chaptersPerVolume,
          onChange: (v) => onEdit({ chaptersPerVolume: Number(v) || 1 }),
        })),
      ),
    ),
    h(
      'div',
      { className: 'nw-plan-foot' },
      h('span', { className: 'nw-hint' }, `共 ${(brief.volumes || 0) * (brief.chaptersPerVolume || 0)} 章的位置`),
      h(
        'div',
        { className: 'nw-actions' },
        h(Btn, { kind: 'ghost', onClick: onCopy, disabled: busy }, '复制给 AI 的提示词'),
        h(Btn, { kind: 'ghost', onClick: onSave, disabled: busy }, '只存方案'),
        h(Btn, { kind: 'primary', onClick: onGenerate, disabled: busy }, busy ? '生成中…' : '生成骨架'),
      ),
    ),
  )
}

function PlanRow({ row, onEdit, onSend }) {
  const tone = OUTLINE_STATUS[row.status] ?? OUTLINE_STATUS.todo
  return h(
    'div',
    { className: 'nw-plan-row' },
    h('span', { className: 'nw-plan-n' }, `第 ${row.chapter} 回`),
    h(
      'span',
      { className: 'nw-plan-main' },
      h(Input, {
        value: row.title,
        placeholder: '这一回的标题',
        onChange: (v) => onEdit({ title: v }),
      }),
      h(Input, {
        value: row.summary,
        placeholder: '一句话：发生什么、主角状态怎么变',
        onChange: (v) => onEdit({ summary: v }),
      }),
      h(Input, {
        value: row.hook,
        placeholder: '章末钩子',
        onChange: (v) => onEdit({ hook: v }),
      }),
    ),
    h(Tag, { tone: tone.tone }, tone.label),
    h(Btn, { small: true, kind: 'ghost', onClick: onSend }, '送去派单'),
  )
}

// 【24 条 #7】章卡：一章一张卡，扫一眼就知道哪些章还是空的。
// 现在的 PlanRow 是「一行三个输入框」，20 章就是 20 行密集表单，翻卷时眼睛没有落脚点。
function PlanCard({ row, onEdit, onSend, onOpen }) {
  const tone = OUTLINE_STATUS[row.status] ?? OUTLINE_STATUS.todo
  const empty = !String(row.title ?? '').trim() && !String(row.summary ?? '').trim()
  return h(
    'div',
    { className: `nw-pcard${empty ? ' nw-pcard-empty' : ''}${row.status === 'written' ? ' nw-pcard-done' : ''}` },
    h(
      'div',
      { className: 'nw-pcard-head' },
      h('span', { className: 'nw-pcard-n' }, `第 ${row.chapter} 回`),
      h(Tag, { tone: tone.tone }, tone.label),
    ),
    h('div', { className: 'nw-pcard-title' }, row.title || h('span', { className: 'nw-pcard-ph' }, '（还没标题）')),
    h('p', { className: 'nw-pcard-sum' }, row.summary || h('span', { className: 'nw-pcard-ph' }, '这一章发生什么？')),
    h(
      'div',
      { className: 'nw-pcard-hook' },
      h('span', { className: 'nw-pcard-hook-k' }, '钩'),
      h('span', null, row.hook || h('span', { className: 'nw-pcard-ph' }, '章末那一下还没写')),
    ),
    h(
      'div',
      { className: 'nw-pcard-foot' },
      h(Btn, { small: true, kind: 'ghost', onClick: onOpen }, '编辑'),
      h(Btn, { small: true, kind: 'ghost', onClick: onSend }, '送去派单'),
    ),
  )
}

// 【24 条 #8】时间线视图：卷是横条，章是点。适合看节奏与篇幅分布。
function PlanTimeline({ volumes, onSend }) {
  const max = Math.max(1, ...volumes.map((vol) => vol.chapters.length))
  return h(
    'div',
    { className: 'nw-ptl' },
    volumes.map((vol) => h(
      'div',
      { className: 'nw-ptl-vol', key: vol.id },
      h('div', { className: 'nw-ptl-head' }, h('span', null, vol.title), h('span', { className: 'nw-hint' }, `${vol.chapters.length} 章`)),
      h(
        'div',
        { className: 'nw-ptl-rail', style: { width: `${(vol.chapters.length / max) * 100}%` } },
        vol.chapters.map((row) => h(
          'button',
          {
            type: 'button',
            key: row.chapter,
            className: `nw-ptl-dot nw-ptl-${row.status || 'todo'}`,
            title: `第 ${row.chapter} 回 · ${row.title || '未命名'} · ${(OUTLINE_STATUS[row.status] ?? OUTLINE_STATUS.todo).label}`,
            onClick: () => onSend(row),
          },
        )),
      ),
    )),
    h('p', { className: 'nw-hint' }, '点是章：灰=未排，琥珀=已有稿，绿=已采纳。点一下直接送去派单。'),
  )
}

// 【24 条 #9】让 AI 把这一卷的摘要与钩子填了。
// 现在是「一章一章手打」，20 章就是 20 次输入；这里改成按卷一次派活。
function FillVolumeBar({ vol, busy, onFill, toast }) {
  if (!vol) return null
  const empty = vol.chapters.filter((row) => !String(row.summary ?? '').trim()).length
  return h(
    'div',
    { className: 'nw-fillbar' },
    h(
      'div',
      { className: 'nw-fillbar-main' },
      h('span', { className: 'nw-fillbar-title' }, `本卷还有 ${empty} 章没摘要`),
      h('span', { className: 'nw-hint' }, '按卷一次派活，比一章一章敲快二十倍；填完仍然可以逐张改。'),
    ),
    h(Btn, {
      kind: 'primary',
      small: true,
      disabled: busy || !empty,
      onClick: () => {
        onFill?.()
        toast?.(`已派活：让 AI 回填「${vol.title}」${empty} 章的摘要与钩子（演示）`)
      },
    }, busy ? '派活中…' : `✎ AI 填这卷 ${empty} 章`),
  )
}

function PlanPage({ projectId, project, go, toast, onRefresh }) {
  const res = useAsync(() => api('outline.get', { projectId }), [projectId], { skip: !projectId })
  const [brief, setBrief] = useState(null)
  const [volumes, setVolumes] = useState([])
  const [busy, setBusy] = useState(false)
  const [openVol, setOpenVol] = useState(1)
  // 【24 条 #8】骨架三视图：卡片 / 列表 / 时间线。列表就是原来的密集表单，留着给要批量改的人。
  const [view, setView] = useState('cards')
  const [cardOpen, setCardOpen] = useState(null)

  useEffect(() => {
    if (!res.data?.outline) return
    setBrief(res.data.outline.brief)
    setVolumes(res.data.outline.volumes ?? [])
  }, [res.data])

  if (!projectId) return h(Empty, null, '还没有作品，去「设置 → 作品数据」新建一部。')
  if (res.loading && !res.data) return h(Loading, null)
  if (res.error) return h(ErrorBox, { error: res.error, onRetry: res.reload })

  const current = brief ?? {
    premise: '', genre: '', audience: '', protagonist: '', goal: '', conflict: '', hook: '', ending: '', volumes: 3, chaptersPerVolume: 20,
  }

  const editBrief = (patch) => setBrief({ ...current, ...patch })

  const persist = async (payload) => {
    setBusy(true)
    try {
      const out = await api('outline.save', { projectId, outline: payload })
      setBrief(out.outline.brief)
      setVolumes(out.outline.volumes ?? [])
      toast('方案已保存')
      return out.outline
    } catch (error) {
      toast(error.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    setBusy(true)
    try {
      const out = await api('outline.generate', { projectId, brief: current })
      setBrief(out.outline.brief)
      setVolumes(out.outline.volumes ?? [])
      setOpenVol(1)
      toast(`骨架已生成：${out.outline.volumes.length} 卷 ${(out.outline.volumes[0]?.chapters?.length ?? 0) * out.outline.volumes.length} 章`)
      onRefresh?.()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const copyPrompt = async () => {
    const text = outlinePrompt(current)
    try {
      await navigator.clipboard.writeText(text)
      toast('提示词已复制，回会话里发给 AI')
    } catch {
      window.prompt('复制下面这段发给 AI：', text)
    }
  }

  // 章节字段改动：先改本地，失焦语义交给「保存骨架」。
  // 每次按键都写盘会让 120 章的骨架变成 120 个 RPC，双击卡顿。
  const editRow = (volIndex, chIndex, patch) => {
    setVolumes((prev) => prev.map((vol, vi) => (vi !== volIndex ? vol : {
      ...vol,
      chapters: vol.chapters.map((row, ci) => (ci !== chIndex ? row : { ...row, ...patch })),
    })))
  }

  const saveTree = async () => {
    const out = await persist({ brief: current, volumes })
    if (out) toast('骨架已保存')
  }

  const send = (row) => {
    writeLS(LS.orderChapter, String(row.chapter))
    writeLS(LS.orderIntent, [row.summary, row.hook ? `章末钩子：${row.hook}` : ''].filter(Boolean).join(' · '))
    toast(`第 ${row.chapter} 回已送去派单`)
    go('dispatch')
  }

  const active = volumes[Math.max(0, Math.min(volumes.length - 1, openVol - 1))] ?? null

  return h(
    'div',
    { className: 'nw-page nw-plan' },
    h(PlanBrief, {
      brief: current,
      busy,
      onEdit: editBrief,
      onSave: () => persist({ brief: current }),
      onGenerate: generate,
      onCopy: copyPrompt,
    }),
    volumes.length
      ? h(
        Card,
        {
          title: '卷章骨架',
          extra: h(
            'div',
            { className: 'nw-plan-vols' },
            volumes.map((vol) => h(
              'button',
              {
                type: 'button',
                key: vol.id,
                className: `nw-seg-btn${active && active.index === vol.index ? ' on' : ''}`,
              'aria-pressed': active && active.index === vol.index ? 'true' : 'false',
                onClick: () => setOpenVol(vol.index),
              },
              vol.title,
              h('span', { className: 'nw-seg-n' }, String(vol.chapters.length)),
            )),
          ),
        },
        h('p', { className: 'nw-hint' }, '摘要与钩子由 AI 回填（nightwrite_op → outline.save），这里可以直接改；改完按「保存骨架」落盘。'),
        h(FillVolumeBar, { vol: active, busy, onFill: () => {}, toast }),
        h(
          'div',
          { className: 'nw-plan-viewbar' },
          h(
            'div',
            { className: 'nw-seg' },
            [
              { value: 'cards', label: '卡片' },
              { value: 'list', label: '列表' },
              { value: 'timeline', label: '时间线' },
            ].map((item) => h(
              'button',
              {
                type: 'button',
                key: item.value,
                className: `nw-seg-btn${view === item.value ? ' on' : ''}`,
              'aria-pressed': view === item.value ? 'true' : 'false',
                onClick: () => setView(item.value),
              },
              item.label,
            )),
          ),
          h('span', { className: 'nw-hint' }, active ? `${active.chapters.length} 章` : ''),
        ),
        active
          ? (view === 'cards'
            ? h(
              'div',
              { className: 'nw-pcards' },
              active.chapters.map((row, ci) => h(PlanCard, {
                key: row.chapter,
                row,
                onEdit: (patch) => editRow(volumes.findIndex((v) => v.index === active.index), ci, patch),
                onOpen: () => setCardOpen({ row, ci }),
                onSend: () => send(row),
              })),
            )
            : view === 'timeline'
              ? h(PlanTimeline, { volumes, onSend: send })
              : h(
                'div',
                { className: 'nw-plan-rows' },
                active.chapters.map((row, ci) => h(PlanRow, {
                  key: row.chapter,
                  row,
                  onEdit: (patch) => editRow(volumes.findIndex((v) => v.index === active.index), ci, patch),
                  onSend: () => send(row),
                })),
              ))
          : null,
        h(
          'div',
          { className: 'nw-plan-foot' },
          h('span', { className: 'nw-hint' }, `${volumes.length} 卷 · ${volumes.reduce((n, v) => n + v.chapters.length, 0)} 章`),
          h(
            'div',
            { className: 'nw-actions' },
            h(Btn, { kind: 'ghost', onClick: () => res.reload() }, '丢弃改动'),
            h(Btn, { kind: 'primary', onClick: saveTree, disabled: busy }, '保存骨架'),
          ),
        ),
      )
      : h(
        Card,
        { title: '卷章骨架' },
        h(Empty, null, '还没有骨架。上面填好一句话故事与规模，按「生成骨架」。'),
      ),
    // 【24 条 #7】点卡片才展开编辑：卡片负责「扫」，弹窗负责「改」，两者不抢空间。
    cardOpen !== null && active
      ? h(Modal, {
        title: `编辑第 ${active.chapters[cardOpen].chapter} 回`,
        onClose: () => setCardOpen(null),
        footer: h(
          Fragment,
          null,
          h(Btn, { kind: 'ghost', small: true, onClick: () => setCardOpen(null) }, '收起'),
          h(Btn, {
            kind: 'primary',
            small: true,
            onClick: () => {
              send(active.chapters[cardOpen])
              setCardOpen(null)
            },
          }, '送去派单'),
        ),
      },
      h(Field, { label: '标题' }, h(Input, {
        value: active.chapters[cardOpen].title,
        onChange: (v) => editRow(volumes.findIndex((x) => x.index === active.index), cardOpen, { title: v }),
      })),
      h(Field, { label: '一句话摘要' }, h(TextArea, {
        value: active.chapters[cardOpen].summary,
        rows: 3,
        onChange: (v) => editRow(volumes.findIndex((x) => x.index === active.index), cardOpen, { summary: v }),
      })),
      h(Field, { label: '章末钩子' }, h(Input, {
        value: active.chapters[cardOpen].hook,
        onChange: (v) => editRow(volumes.findIndex((x) => x.index === active.index), cardOpen, { hook: v }),
      })),
      )
      : null,
  )
}
