/**
 * 长夜 · 一轮连写的零件
 *
 * 规矩在服务端（lib/run.js），这里只有两个零件：
 *
 *   RunOpenForm   —— 开一轮的表单
 *   RunChapterRow —— 这一轮交过的稿，一行，带「确认过 / 打回重写」
 *
 * 原来这一层还有个独立的「停靠点」页（RunPage + 状态条 + 历史）。合并进「今天」之后
 * 删掉了：那页无论有没有事都占着导航一格，一天点不到两次，等它拦住人才想起来看；
 * 而「现在能不能写」和「今天该写什么」本来就是同一个人在同一秒钟要回答的两个问题。
 * 状态条搬到了 src/29-today.js 的 TodayRunStrip，历史轮次收进「今天」页底部。
 *
 * 一句话说清这一层的立场：**它不替人做决定，只把「卡在哪」写清楚**。
 */

const RUN_STATUS_LABEL = {
  open: '进行中',
  waiting: '等确认',
  closed: '已收尾',
  abandoned: '已废弃',
}

const RUN_STATUS_TONE = {
  open: 'green',
  waiting: 'amber',
  closed: 'grey',
  abandoned: 'red',
}

// 服务端的 runVerdict 只有四档，颜色映射放这里，界面各处统一引这一份。
const VERDICT_TONE = {
  green: 'green',
  orange: 'amber',
  red: 'red',
  grey: 'grey',
}

function RunOpenForm({ projectId, onDone, toast }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ chapter: '', maxChapters: 3, note: '' })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const out = await api('run.open', {
        projectId,
        chapter: Number(form.chapter) || 0,
        maxChapters: Math.max(1, Math.min(20, Number(form.maxChapters) || 3)),
        note: form.note,
      })
      toast(`已开一轮（${out.run.id}），这一轮最多 ${out.run.maxChapters} 章`)
      setOpen(false)
      setForm({ chapter: '', maxChapters: 3, note: '' })
      onDone?.()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return h(
      'div',
      { className: 'nw-actions' },
      h(Btn, { kind: 'primary', small: true, onClick: () => setOpen(true) }, '开一轮'),
      h(
        'span',
        { className: 'nw-hint' },
        '开了轮才有「停下确认」这一说；不开也能写，但那次写入查不到是哪一轮的。',
      ),
    )
  }

  return h(
    'div',
    { className: 'nw-run-form' },
    h(
      Field,
      { label: '从第几回开始' },
      h(Input, {
        type: 'number',
        value: form.chapter,
        onChange: (v) => setForm({ ...form, chapter: v }),
        placeholder: '例：5',
      }),
    ),
    h(
      Field,
      { label: '这一轮最多写几章' },
      h(Input, {
        type: 'number',
        value: form.maxChapters,
        onChange: (v) => setForm({ ...form, maxChapters: v }),
      }),
    ),
    h(
      Field,
      { label: '备注（为什么开这一轮）' },
      h(Input, {
        value: form.note,
        onChange: (v) => setForm({ ...form, note: v }),
        placeholder: '例：把城头这场雨收干净',
      }),
    ),
    h(
      'div',
      { className: 'nw-actions' },
      h(
        Btn,
        { small: true, kind: 'primary', onClick: submit, disabled: busy },
        busy ? '开轮中…' : '确认开轮',
      ),
      h(Btn, { small: true, kind: 'ghost', onClick: () => setOpen(false), disabled: busy }, '取消'),
    ),
  )
}

function RunChapterRow({ row, run, onReview, onClose, busy }) {
  const done = row.reviewed === true
  const verdict = String(row.verdict ?? '')
  return h(
    'div',
    { className: `nw-run-ch${done ? ' nw-run-ch-done' : ''}` },
    h('span', { className: 'nw-run-ch-n' }, `第 ${row.chapter} 回`),
    h('span', { className: 'nw-run-ch-w' }, `${fmtWords(Number(row.words) || 0)} 字`),
    h('span', { className: 'nw-run-ch-at' }, String(row.at ?? '').slice(11, 16)),
    done
      ? h(
          Tag,
          { tone: verdict === 'reject' ? 'red' : 'green' },
          verdict === 'reject' ? '打回' : '已确认',
        )
      : h(Tag, { tone: 'amber' }, '等确认'),
    row.note ? h('span', { className: 'nw-hint' }, row.note) : null,
    done
      ? null
      : h(
          'span',
          { className: 'nw-run-ch-acts' },
          h(
            Btn,
            {
              small: true,
              kind: 'primary',
              onClick: () => onReview(row.chapter, 'ok'),
              disabled: busy,
            },
            '确认过',
          ),
          h(
            Btn,
            {
              small: true,
              kind: 'ghost',
              onClick: () => onReview(row.chapter, 'reject'),
              disabled: busy,
            },
            '打回重写',
          ),
        ),
  )
}
