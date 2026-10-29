/**
 * 长夜 · 派单
 *
 * 原来是两页：流水线（谁在干）+ 生产台（写什么单）。
 * 它们本来就是同一件事的两半 —— 排一张单，派人去写 —— 却被拆成两个导航项，
 * 于是「我要让 AI 写第 12 回」这件事被迫分两步走，还得自己在两页之间搬章号和意图。
 *
 * 合并后从上到下就是这个动作的顺序：
 *   1. 指令单（写第几回、什么意图、给多少上下文）→ 加入队列
 *   2. 队列（要写什么，实时的）
 *   3. 谁来干（11 个岗位，谁能派单）
 *   4. 工单（派出去了没有、交回执没有、过期没有）
 *   5. 任务包（派出去的那叠材料，作者也能打开核）
 *
 * 没有做成 tab：这几段是流水线，前一步的输出是后一步的输入。做成 tab 之后
 * 「排队列」和「派人去写」之间就多了一次点击，而这一页本来是要一口气走完的。
 */
function DispatchPage({ projectId, project, chapters, go, toast, onRefresh, refreshKey }) {
  if (!projectId) return h(Empty, null, '还没有作品。建一本就能派单。')
  return h(
    'div',
    { className: 'nw-page nw-dispatch' },
    h(
      'div',
      { className: 'nw-dispatch-lead' },
      h('h2', null, '派单'),
      h(
        'p',
        { className: 'nw-hint' },
        '先写一张指令单说清这一章要什么，再看谁去写、写完回了什么。',
      ),
    ),
    // 指令单 + 队列
    h(StudioPage, {
      projectId,
      project,
      chapters,
      go,
      toast,
      onRefresh,
      bare: true,
    }),
    // 岗位 + 工单 + 任务包
    h(PipelinePage, {
      projectId,
      project,
      toast,
      onRefresh,
      refreshKey,
    }),
  )
}
