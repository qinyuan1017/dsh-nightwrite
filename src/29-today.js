/**
 * 长夜 · 今天
 *
 * 原来是两页：驾驶舱（今天该写什么）+ 停靠点（现在能不能写）。
 * 合并的理由很直白 —— 这两件事是同一个人在同一秒钟要回答的两个问题：
 *
 *   「我现在能往下写吗？」「能的话写哪一章？」
 *
 * 分成两页的后果是：驾驶舱上那个「▶ 一键开工」按下去，撞到服务端的门禁才知道
 * 上一轮还没确认；而「停靠点」在导航最右边，一天点不到两次，等它拦住人才想起来看。
 * 门禁放在人看不到的地方拦人，等于没拦。
 *
 * 所以这一页从上到下就是一天的顺序：
 *   1. 现在能不能写（run 的状态条 + 这一轮交过哪几章 + 确认/打回/收尾）
 *   2. 今天该干什么（原来驾驶舱那套：行动卡 → 进度 → 四个数 → 欠账 → 建议）
 */

/**
 * 今天页顶部的「现在能不能写」。
 *
 * 刻意做成一条窄条而不是一张大卡：常态下（能写）它只占一行，眼睛扫过去就完；
 * 卡住的时候（等确认 / 到上限）才展开成有按钮的卡。以前停靠点无论有没有事
 * 都占同样大的地方，所以作者学会了一件事 —— 那页不用看。
 */
function TodayRunStrip({ projectId, run, verdict, toast, onChanged }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (op, payload, ok) => {
    setBusy(true)
    try {
      await api(op, { projectId, runId: run?.id, ...payload })
      toast(ok)
      onChanged?.()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const used = run?.chapters?.length ?? 0
  const max = Number(run?.maxChapters ?? 0) || 0
  const blocked = verdict?.level === 'red' || verdict?.level === 'orange'

  return h(
    'div',
    {
      className: `nw-today-run nw-today-run-${VERDICT_TONE[verdict?.level] ?? 'grey'}${blocked ? ' nw-today-run-blocked' : ''}`,
    },
    h(
      'div',
      { className: 'nw-today-run-line' },
      h('span', { className: 'nw-today-run-dot' }),
      h('span', { className: 'nw-today-run-text' }, verdict?.text || '状态未知'),
      run ? h('span', { className: 'nw-today-run-count' }, `${used} / ${max} 章`) : null,
      run
        ? h(
            Tag,
            { tone: RUN_STATUS_TONE[run.status] ?? 'grey' },
            RUN_STATUS_LABEL[run.status] ?? run.status,
          )
        : null,
    ),
    // 没开轮：给一个开轮的入口，但把「不开也能写」这件事说明白 ——
    // 以前不说，作者以为必须先开轮，于是宁可不写。
    run
      ? null
      : h(
          'div',
          { className: 'nw-today-run-body' },
          h(
            'p',
            { className: 'nw-hint' },
            '不开轮也能写，只是那次写入事后查不到是哪一轮的。开一轮的好处是：交完一章会被要求停下来看一眼。',
          ),
          h(RunOpenForm, { projectId, onDone: onChanged, toast }),
        ),
    // 有轮次且交了稿、还没确认：这是最该被看见的状态，把每章摊开给按钮。
    run && run.status === 'waiting'
      ? h(
          'div',
          { className: 'nw-today-run-body' },
          h(
            'div',
            { className: 'nw-run-chs' },
            (run.chapters ?? []).map((row) =>
              h(RunChapterRow, {
                key: `${row.chapter}-${row.at}`,
                row,
                run,
                busy,
                onReview: (chapter, v) =>
                  act(
                    'run.review',
                    { chapter, verdict: v },
                    v === 'reject'
                      ? `第 ${chapter} 回已打回，这一轮继续开着`
                      : `第 ${chapter} 回已确认，可以往下写了`,
                  ),
              }),
            ),
          ),
          h(
            'div',
            { className: 'nw-today-run-foot' },
            h(
              Field,
              { label: '收尾备注' },
              h(Input, {
                value: note,
                onChange: setNote,
                placeholder: '这一轮写完了什么、留下什么问题',
              }),
            ),
            h(
              Btn,
              {
                small: true,
                kind: 'ghost',
                onClick: () => act('run.close', { note }, '这一轮已收尾'),
                disabled: busy,
              },
              '收尾关掉',
            ),
          ),
        )
      : null,
  )
}

function TodayPage({ projectId, project, chapters, go, toast, refreshKey, onRefresh }) {
  const cur = useAsync(() => api('run.current', { projectId }), [projectId, refreshKey], {
    skip: !projectId,
  })
  const run = cur.data?.run ?? null
  const verdict = cur.data?.verdict ?? null

  if (!projectId) {
    return h(Empty, null, '还没有作品。建一本就能开工。')
  }

  return h(
    'div',
    { className: 'nw-page nw-today' },
    h(TodayRunStrip, {
      projectId,
      run,
      verdict,
      toast,
      onChanged: () => {
        cur.reload()
        onRefresh?.()
      },
    }),
    h(CockpitPage, { projectId, project, go, toast, refreshKey, bare: true }),
  )
}
