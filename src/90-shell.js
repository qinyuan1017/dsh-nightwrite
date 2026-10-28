/**
 * 长夜 · 外壳与挂载
 *
 * 顶栏（书名 / 当前页 / 预算 / 队列）+ 底栏（三键 + 六页 dock）+ 挂到会话区 main slot。
 */

function TopBar({
  projects, projectId, page, onSwitch, stats, project, onPause, paused, onQuick, busy, queueCount,
  onCommand, toast,
}) {
  // 【12 条 #6】月预算不是摆设：设置里填的 monthlyBudget 以前只显示成一个孤立的 ¥37，
  // 没人知道这个月还剩多少。这里把它算成「已用 / 预算」并给一条细进度。
  const budget = Number(project?.monthlyBudget ?? 0)
  const spent = Number(stats.costThisMonth ?? 0)
  const usedPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
  const overBudget = budget > 0 && spent > budget
  return h(
    'div',
    { className: 'nw-top' },
    h(
      'div',
      { className: 'nw-brand' },
      h('span', { className: 'nw-brand-mark' }, '🌙'),
      h('span', { className: 'nw-brand-name' }, '长夜'),
      h('span', { className: 'nw-brand-page' }, PAGE_LABEL[page] ?? ''),
    ),
    // 【24 条 #1】状态灯：一眼看到 AI 到底在不在动。
    // 现在用 MOCK 固定值渲染完整形态（灯泡亮 + 第 5 回 + 1240/2500 字），点它有 toast。
    h(StatusLamp, { toast }),
    h(
      'div',
      { className: 'nw-top-mid' },
      h(Select, {
        value: projectId ?? '',
        onChange: onSwitch,
        options: projects.length
          ? projects.map((row) => ({ value: row.id, label: `${row.name}（${row.chapters} 章）` }))
          : [{ value: '', label: '还没有作品' }],
      }),
      h('span', { className: 'nw-top-stat' }, `待验收 ${stats.pending ?? 0}`),
      h('span', { className: 'nw-top-stat' }, `队列 ${stats.queued ?? 0}`),
      budget > 0
        ? h(
          'button',
          {
            type: 'button',
            className: `nw-top-stat nw-top-cost nw-budget${overBudget ? ' nw-budget-over' : ''}`,
            title: `本月已花 ${fmtCost(spent)} / 预算 ${fmtCost(budget)}${overBudget ? '（超了）' : ''}`,
            onClick: () => toast(overBudget
              ? `本月已超预算 ${fmtCost(spent - budget)}，去设置里调预算或收着点`
              : `本月已花 ${fmtCost(spent)}，还剩 ${fmtCost(budget - spent)}`),
          },
          `本月 ${fmtCost(spent)} / ${fmtCost(budget)}`,
          h('span', { className: 'nw-budget-bar' }, h('span', {
            className: 'nw-budget-fill',
            style: { width: `${usedPct}%` },
          })),
          // 【QA-4】超预算时把「要拦你」写在脸上，而不是等用户排完单才发现。
          overBudget
            ? h('span', { className: 'nw-budget-stop nw-budget-halt' }, `超 ${fmtCost(spent - budget)} · 排单前会问`)
            : null,
        )
        : h('span', { className: 'nw-top-stat nw-top-cost' }, fmtCost(stats.totalCost ?? 0)),
    ),
    // 三个快动作从底栏搬上来：底栏只留导航，快动作跟「队列/暂停」这些运行态放一起，
    // 一眼就能看到「现在会不会有东西在跑」。
    h(
      'div',
      { className: 'nw-top-right' },
      h('span', { className: `nw-top-hint${queueCount ? ' nw-top-hint-on' : ''}` },
        queueCount ? `${queueCount} 章在队列里` : '队列空闲'),
      // 【24 条 #3】命令面板入口：Ctrl+K 和这个按钮都开同一个浮层。
      h(Btn, { kind: 'ghost', small: true, className: 'nw-cmdk-open', onClick: onCommand }, '⌘K 命令'),
      // 【QA-4】暂停时三个快动作描红：按下去会给「先继续」的提示，不是死按钮。
      h(Btn, {
        kind: 'primary',
        small: true,
        className: paused ? 'nw-btn-halt' : '',
        title: paused ? '已暂停，先点「▶ 继续」' : '排一章进队列',
        onClick: () => onQuick?.('one'),
        disabled: busy,
      }, '✍️ 续写一章'),
      h(Btn, {
        kind: 'ghost',
        small: true,
        className: paused ? 'nw-btn-halt' : '',
        title: paused ? '已暂停，先点「▶ 继续」' : '一次排三章',
        onClick: () => onQuick?.('batch'),
        disabled: busy,
      }, '⚡ 连更 3 章'),
      h(Btn, { kind: 'ghost', small: true, onClick: () => onQuick?.('check'), disabled: busy }, '🩺 体检'),
      h(Btn, {
        small: true,
        kind: paused ? 'primary' : 'ghost',
        onClick: onPause,
      }, paused ? '▶ 继续' : '⏸ 暂停'),
    ),
  )
}

function DockNav({ page, go, queueCount }) {
  return h(
    'nav',
    { className: 'nw-dock' },
    PAGES.map((item) => h(
      'button',
      {
        type: 'button',
        key: item.id,
        className: `nw-dock-btn${page === item.id ? ' on' : ''}`,
        onClick: () => go(item.id),
      },
      h('span', { className: 'nw-dock-icon' }, item.icon),
      h('span', { className: 'nw-dock-label' }, item.label),
      item.id === 'studio' && queueCount ? h('span', { className: 'nw-dock-badge' }, String(queueCount)) : null,
    )),
  )
}

function BottomBar({
  page, go, queueCount, onJumpLatest, onNewChapter,
}) {
  return h(
    'div',
    { className: 'nw-bottom' },
    // 左占位：让中间那颗 dock 真正居中，不会被右侧两个按钮推歪。
    h('div', { className: 'nw-bottom-pad' }),
    h(DockNav, { page, go, queueCount }),
    // 【24 条 #2】底栏右侧两个常驻小按钮：跳到最新章 / 加一章空壳。
    // 写长篇天天要「翻到最后」，把它放在手边比放进菜单里合理。
    h(
      'div',
      { className: 'nw-bottom-acts' },
      h(Btn, {
        small: true,
        kind: 'ghost',
        className: 'nw-bottom-btn',
        onClick: onJumpLatest,
        title: '跳到最后一章（演示）',
      }, '⏭ 最新'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        className: 'nw-bottom-btn',
        onClick: onNewChapter,
        title: '新增一章空壳（演示）',
      }, '＋ 新章'),
    ),
  )
}

function Workbench(props) {
  const {
    projects, projectId, project, chapters, page, setPage, go, toast, items, theme, setTheme,
    onSwitch, onRefresh, refreshKey, stats, paused, setPaused, command, setCommand,
  } = props

  const [quickBusy, setQuickBusy] = useState(false)

  useEffect(() => {
    const root = document.querySelector('.nw-shell')
    if (root) root.dataset.theme = theme
  }, [theme])

  // 三个快动作（续写 / 连更 / 体检）现在住在顶栏，所以状态提到 Workbench 里，
  // 不再跟着底栏组件一起重挂。
  // 【QA-4】预算拦截：以前 monthlyBudget 只是个装饰数字，超了照样能排单。
  // 现在顶栏那条进度条变红之后，快动作会先问一句 —— 不是禁用，是不让它悄悄超。
  const budgetCheck = () => {
    const cap = Number(project?.monthlyBudget ?? 0)
    if (!(cap > 0)) return true
    const used = Number(stats?.costThisMonth ?? 0)
    if (used <= cap) return true
    return window.confirm(
      `本月已花 ${fmtCost(used)}，预算 ${fmtCost(cap)}，超了 ${fmtCost(used - cap)}。\n再排新章会继续加钱。还是要排吗？`,
    )
  }

  const quick = async (mode) => {
    if (!projectId) {
      toast('先选一部作品')
      return
    }
    if (mode === 'check') {
      go('review')
      return
    }
    if (paused) {
      toast('现在是暂停状态，先点顶栏「▶ 继续」再排单')
      return
    }
    if (quickBusy) return
    if (!budgetCheck()) {
      toast('已取消 —— 本月超预算了')
      return
    }
    setQuickBusy(true)
    try {
      const list = await api('chapter.list', { projectId })
      const last = list.chapters.length ? list.chapters[list.chapters.length - 1].chapter : 0
      const count = mode === 'batch' ? 3 : 1
      for (let i = 0; i < count; i += 1) {
        await api('queue.add', {
          projectId,
          item: {
            chapter: last + 1 + i,
            intent: mode === 'batch' ? '连更：延续上一章钩子' : '续写下一章',
            words: 2500,
          },
        })
      }
      onRefresh?.()
      toast(mode === 'batch' ? '已排 3 章' : '已排 1 章')
      go('studio')
    } catch (error) {
      toast(error.message)
    } finally {
      setQuickBusy(false)
    }
  }

  const content = {
    cockpit: h(CockpitPage, { projectId, project, go, toast, refreshKey }),
    plan: h(PlanPage, { projectId, project, go, toast, onRefresh }),
    // 流水线：派单台。AI 干活的过程以前在工作台上完全不可见，
    // 这一页让「派出去没有 / 对方做完没有 / 说了什么」有痕迹。
    pipeline: h(PipelinePage, { projectId, project, toast, onRefresh }),
    studio: h(StudioPage, { projectId, project, chapters, go, toast, onRefresh }),
    review: h(ReviewPage, { projectId, chapters, project, toast, onRefresh, refreshKey }),
    // 【24 条 #20】逾期伏笔点一下要能跳到那一回 —— 世界库自己不会开验收详情，
    // 所以这里给它一个「开某章」的回调，走 ReviewPage 的 openChapter 约定。
    world: h(WorldPage, {
      projectId,
      project,
      chapters,
      toast,
      onRefresh,
      onJumpChapter: (chapter) => {
        if (!chapter) {
          toast('这条没记回收章节')
          return
        }
        writeLS('nw.openChapter', String(chapter))
        go('review')
        toast(`已跳到验收台 · 第 ${chapter} 回`)
      },
    }),
    scout: h(ScoutPage, {
      projectId, project, toast, onRefresh,
    }),
    settings: h(SettingsPage, {
      projectId, project, projects, chapters, onSwitch, toast, onRefresh, theme, setTheme,
    }),
  }[page] ?? null

  return h(
    'div',
    { className: `nw-shell nw-theme-${theme}`, 'data-page': page },
    h(TopBar, {
      projects,
      projectId,
      project,
      page,
      onSwitch,
      stats: stats ?? {},
      paused,
      onPause: () => setPaused(!paused),
      onQuick: quick,
      busy: quickBusy,
      queueCount: stats?.queued ?? 0,
      onCommand: () => setCommand?.(true),
      toast,
    }),
    h('div', { className: 'nw-body' }, content),
    h(BottomBar, {
      page,
      go,
      queueCount: stats?.queued ?? 0,
      onJumpLatest: () => {
        const last = chapters.length ? chapters[chapters.length - 1].chapter : 0
        if (!last) {
          toast('还没有章节，先排一单')
          return
        }
        // 以前只 go('review')，落在章列表上，文案却说「已跳到第 N 回」—— 说了没做到。
        // 把章号写进 nw.openChapter；已经停在验收台时组件不会重挂，
        // 得再 bump 一次 refreshKey，那边读键的 effect 才会跑。
        writeLS(LS.openChapter, String(last))
        go('review')
        onRefresh?.()
        toast(`已打开第 ${last} 回`)
      },
      onNewChapter: () => {
        writeLS(LS.orderChapter, String((chapters.length ? chapters[chapters.length - 1].chapter : 0) + 1))
        writeLS(LS.orderIntent, '')
        go('studio')
        toast('已开一张新章空单（演示）')
      },
    }),
    command ? h(CommandPalette, { projectId, onClose: () => setCommand?.(false), go, toast }) : null,
    h(Toast, { items }),
  )
}

function Root() {
  const [page, setPage] = useState(readLS(LS.page, 'cockpit'))
  const [projectId, setProjectId] = useState(readLS(LS.project, ''))
  const [theme, setThemeState] = useState(readLS(LS.theme, 'dark'))
  const [refreshKey, setRefreshKey] = useState(0)
  // 【12 条 #7】暂停要真的记住：以前是纯 useState(false)，切页/刷新就回到「没暂停」，
  // 顶栏那个按钮等于演给自己看。现在写 localStorage，重启也还在。
  const [paused, setPausedState] = useState(() => readLS(LS.paused, '0') === '1')
  const [command, setCommand] = useState(false)
  const [toasts, toast] = useToast()

  const setPaused = useCallback((next) => {
    setPausedState(next)
    writeLS(LS.paused, next ? '1' : '0')
  }, [])

  const projectsRes = useAsync(() => api('project.list'), [refreshKey])
  const projects = projectsRes.data?.projects ?? []

  useEffect(() => {
    if (!projectId && projects.length) {
      setProjectId(projects[0].id)
      writeLS(LS.project, projects[0].id)
    }
  }, [projects, projectId])

  const chapterRes = useAsync(
    () => api('chapter.list', { projectId }),
    [projectId, refreshKey],
    { skip: !projectId },
  )
  const chapters = chapterRes.data?.chapters ?? []

  const projectRes = useAsync(
    () => api('project.get', { projectId }),
    [projectId, refreshKey],
    { skip: !projectId },
  )
  const project = projectRes.data?.project ?? null

  const statsRes = useAsync(
    () => api('overview', { projectId }),
    [projectId, refreshKey],
    { skip: !projectId },
  )
  const stats = statsRes.data?.stats ?? {}

  // 【12 条 #1】切页前先问一句：有没保存的正文就先拦住。
  // 拦的只是「换页」，不拦「同一页里换章」—— 那是验收台自己的事。
  const go = useCallback((next, arg) => {
    const current = readLS(LS.page, 'cockpit')
    if (next !== current && dirtyGuard.active) {
      const label = dirtyGuard.label || '当前这一章'
      // confirm 是同步的，不需要额外的弹窗状态机；关掉返回 false 就不走。
      if (!window.confirm(`${label}还有改动没保存，确定要离开吗？\n\n离开后内容会留在本地草稿里，下次打开这一章会提示你。`)) {
        return
      }
      setDirtyGuard(false)
    }
    setPage(next)
    writeLS(LS.page, next)
    if (arg?.chapter) writeLS('nw.openChapter', String(arg.chapter))
  }, [])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    writeLS(LS.theme, next)
  }, [])

  const onSwitch = useCallback((id) => {
    setProjectId(id)
    writeLS(LS.project, id)
    setRefreshKey((n) => n + 1)
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshKey((n) => n + 1)
  }, [])

  // Ctrl+K 打开命令面板（Esc 由 Modal 自己关）。以前这里只弹一句「还没做」，
  // 现在接的是 CommandPalette —— 有列表、能上下选、能执行（演示态）。
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault()
        // 别的弹窗（比如设置里的确认框）开着时不要再叠一层。
        if (modalOpen() && !command) return
        setCommand((open) => !open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return h(Workbench, {
    projects, projectId, project, chapters, page, setPage, go, toast,
    items: toasts, theme, setTheme, onSwitch, onRefresh, refreshKey, stats, paused, setPaused,
    command, setCommand,
  })
}

// ── 挂载 ────────────────────────────────────────────────────

let hostCtx = null

function hostService(name) {
  try {
    return hostCtx?.get?.(name) ?? null
  } catch {
    return null
  }
}

// 侧栏面板图标轨那一行的小图标：宿主给每个 panellist id 渲染一行 panelRow，
// 图标由 renderSlot('sidebar.panellist', { size }, { only: id }) 取，点击由宿主自己调 layout.selectPanel(id)。
function PanelIcon({ size }) {
  const box = Number(size) || 18
  return h(
    'span',
    {
      className: 'nw-panel-glyph',
      role: 'img',
      'aria-label': '长夜',
      'aria-hidden': 'true',
      style: { width: `${box}px`, height: `${box}px`, fontSize: `${Math.round(box * 0.92)}px` },
    },
    '🌙',
  )
}

// 把中心列切到长夜。宿主 panelRow 的点击自己会走这条路，这里只留给命令面板 / 其它插件调用；
// layout 服务可能比 slot 注册晚一拍就绪，所以退到 hostCtx.layout 再试一次。
function openNightwrite() {
  try {
    const layout = hostService('layout') || hostCtx?.layout || null
    if (layout && typeof layout.selectPanel === 'function') {
      layout.selectPanel(PANEL_ID)
      return true
    }
  } catch (error) {
    console.warn('[nightwrite] 打开失败', error)
  }
  return false
}

function apply(ctx) {
  hostCtx = ctx

  const inject = (slot, register) => {
    try {
      if (ctx?.slots?.inject) ctx.slots.inject(slot, register)
      else register()
    } catch (error) {
      console.warn(`[nightwrite] 挂载 ${slot} 失败`, error)
    }
  }

  // 侧栏图标：进「插件」那一排，点它就打开长夜。
  inject('sidebar.panellist', () =>
    ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: '长夜' }, PanelIcon))

  // 正门：keyed main 槽位。宿主 AppFrame 的 MainPanel 是
  // renderSlot('main', {}, { entryKey: activePanelId ?? 'conversation' })，
  // 所以 key='nightwrite' 这份就是「选中长夜时中心列该画的内容」。
  inject('main', () =>
    ctx.slots.register({ name: 'main', key: PANEL_ID, label: '长夜' }, Root))

  // 样式注入走 ctx.effect，插件被卸载 / 热重建时宿主会回调清理函数把这颗 <style> 摘掉。
  // 直接 appendChild 而不注册清理，会让每次改动都往 <head> 里叠一份旧 CSS。
  const style = document.createElement('style')
  style.dataset.nightwrite = '1'
  style.textContent = NIGHTWRITE_CSS
  document.head.appendChild(style)
  if (typeof ctx?.effect === 'function') {
    ctx.effect(() => () => {
      try {
        style.remove()
      } catch {
        /* 已被移除 */
      }
    }, 'nightwrite: styles')
  }
}
