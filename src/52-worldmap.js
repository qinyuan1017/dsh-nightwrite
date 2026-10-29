/**
 * 长夜 · 世界地图视图
 *
 * 地图不是第二份真相，是账本「地点」那一类的另一种看法：节点就是账本行，
 * 名字和首现章从账本读；坐标是作者拖出来的，存在 map.json 里。
 *
 * 为什么用 SVG 而不是 div 拼：连线要画在点上、点要能拖，用 div + 绝对定位
 * 也能做，但一旦缩放到窄屏，线就画歪了。SVG 的 viewBox 让坐标与像素脱钩，
 * 无论容器多宽，雁门关和应天府之间的位置关系都不变形。
 *
 * 为什么拖完要「保存」而不是拖一下就写盘：一次拖动会连发几十个 mousemove，
 * 每个都发请求，服务端会被写爆，作者也会因为网络慢而拖不顺手。所以拖动只
 * 改本地 state，松手算一次待保存，点保存才落盘。
 */
function MapView({ projectId, toast }) {
  const map = useAsync(() => api('map.get', { projectId }), [projectId], { skip: !projectId })
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(null)
  const [linkFrom, setLinkFrom] = useState('')
  const [linkTo, setLinkTo] = useState('')
  const [label, setLabel] = useState('')
  const boxRef = useRef(null)

  // 服务端数据到了才灌本地——之后本地为准，否则拖动会被轮询覆盖掉
  useEffect(() => {
    const data = map.data
    if (!data) return
    setNodes((Array.isArray(data.nodes) ? data.nodes : []).map((node) => ({ ...node })))
    setEdges((Array.isArray(data.edges) ? data.edges : []).map((edge) => ({ ...edge })))
    setDirty(false)
  }, [map.data])

  const canvas = map.data?.canvas ?? { width: 1000, height: 1000 }

  /** 把鼠标位置换成画布坐标：SVG 缩放过，不能直接用像素差。 */
  const toCanvas = (event) => {
    const box = boxRef.current?.getBoundingClientRect?.()
    if (!box || !box.width) return null
    const scale = canvas.width / box.width
    return {
      x: Math.round(Math.min(canvas.width, Math.max(0, (event.clientX - box.left) * scale))),
      y: Math.round(Math.min(canvas.height, Math.max(0, (event.clientY - box.top) * scale))),
    }
  }

  const onMove = (event) => {
    if (!drag) return
    const point = toCanvas(event)
    if (!point) return
    setNodes((list) =>
      list.map((node) => (node.id === drag.id ? { ...node, x: point.x, y: point.y } : node)),
    )
    setDirty(true)
  }

  const sync = async () => {
    setBusy(true)
    try {
      const value = await api('map.sync', { projectId })
      map.reload()
      toast(value.added ? `从账本同步了 ${value.added} 个新地点` : '账本里没有新地点')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      await api('map.save', {
        projectId,
        nodes: nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, note: node.note })),
        edges,
      })
      setDirty(false)
      map.reload()
      toast('位置和连线已保存')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const addEdge = async () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) {
      toast('选两个不同的地点')
      return
    }
    const next = edges.concat([{ from: linkFrom, to: linkTo, label, kind: 'road' }])
    setEdges(next)
    setDirty(true)
    try {
      const info = await api('map.explain', { projectId, from: linkFrom, to: linkTo })
      toast(info.existing ? '这条线本来就有，已合并' : `加了一条线。${info.hint}`)
    } catch {
      toast('加了一条线，记得保存')
    }
    setLabel('')
  }

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (map.loading && !map.data) return h(Loading, null)
  if (map.error) return h(ErrorBox, { error: map.error, onRetry: map.reload })

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const orphan = nodes.filter((node) => node.inLedger === false || node.orphan)
  const nameOf = (id) => byId.get(id)?.name ?? id

  const picker = (value, onChange, placeholder) =>
    h(
      'select',
      { className: 'nw-map-select', value, onChange: (event) => onChange(event.target.value) },
      h('option', { value: '' }, placeholder),
      ...nodes.map((node) => h('option', { key: node.id, value: node.id }, node.name)),
    )

  return h(
    'div',
    { className: 'nw-map' },
    h(
      'div',
      { className: 'nw-map-bar' },
      h(
        'span',
        { className: 'nw-map-hint' },
        nodes.length
          ? `${nodes.length} 个地点${orphan.length ? ` · ${orphan.length} 个账本里已经没有了（画成灰的）` : ''}`
          : '还没从账本同步过地点',
      ),
      h(
        'div',
        { className: 'nw-actions' },
        dirty ? h(Tag, { tone: 'amber' }, '有改动没保存') : null,
        h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: sync }, '从账本同步'),
        h(
          Btn,
          { small: true, kind: 'primary', disabled: busy || !dirty, onClick: save },
          '保存位置',
        ),
      ),
    ),
    nodes.length
      ? h(
          'div',
          { className: 'nw-map-stage' },
          h(
            'svg',
            {
              className: 'nw-map-svg',
              ref: boxRef,
              viewBox: `0 0 ${canvas.width} ${canvas.height}`,
              onMouseMove: onMove,
              onMouseUp: () => setDrag(null),
              onMouseLeave: () => setDrag(null),
            },
            h(
              'g',
              { className: 'nw-map-edges' },
              ...edges.map((edge) => {
                const a = byId.get(edge.from)
                const b = byId.get(edge.to)
                if (!a || !b) return null
                return h(
                  'g',
                  { key: `${edge.from}-${edge.to}` },
                  h('line', {
                    className: `nw-map-edge nw-map-edge-${edge.kind ?? 'road'}`,
                    x1: a.x,
                    y1: a.y,
                    x2: b.x,
                    y2: b.y,
                  }),
                  edge.label
                    ? h(
                        'text',
                        {
                          className: 'nw-map-edge-label',
                          x: (a.x + b.x) / 2,
                          y: (a.y + b.y) / 2 - 6,
                          textAnchor: 'middle',
                        },
                        edge.label,
                      )
                    : null,
                )
              }),
            ),
            h(
              'g',
              { className: 'nw-map-nodes' },
              ...nodes.map((node) => {
                const gone = node.inLedger === false || node.orphan
                return h(
                  'g',
                  {
                    key: node.id,
                    className: `nw-map-node${gone ? ' nw-map-orphan' : ''}${drag?.id === node.id ? ' dragging' : ''}`,
                    transform: `translate(${node.x},${node.y})`,
                    onMouseDown: (event) => {
                      event.preventDefault()
                      setDrag({ id: node.id })
                    },
                  },
                  h('circle', { className: 'nw-map-dot', r: 9 }),
                  h('text', { className: 'nw-map-name', y: 26, textAnchor: 'middle' }, node.name),
                  node.firstChapter
                    ? h(
                        'text',
                        { className: 'nw-map-ch', y: 40, textAnchor: 'middle' },
                        `第 ${node.firstChapter} 回`,
                      )
                    : null,
                )
              }),
            ),
          ),
        )
      : h(
          Empty,
          null,
          '账本「地点」这一类还是空的。先在表格视图里加几个地名，再点「从账本同步」。',
        ),
    h(
      'div',
      { className: 'nw-map-link' },
      h('span', { className: 'nw-map-link-label' }, '连一条路'),
      picker(linkFrom, setLinkFrom, '起点'),
      picker(linkTo, setLinkTo, '终点'),
      h('input', {
        className: 'nw-map-label-input',
        value: label,
        placeholder: '这条路叫什么（可空）',
        onChange: (event) => setLabel(event.target.value),
      }),
      h(
        Btn,
        { small: true, kind: 'ghost', onClick: addEdge, disabled: nodes.length < 2 },
        '加连线',
      ),
    ),
    edges.length
      ? h(
          'div',
          { className: 'nw-map-edgelist' },
          ...edges.map((edge) =>
            h(
              'div',
              { key: `${edge.from}-${edge.to}`, className: 'nw-map-edgerow' },
              h(
                'span',
                { className: 'nw-map-edgetext' },
                `${nameOf(edge.from)} → ${nameOf(edge.to)}${edge.label ? `（${edge.label}）` : ''}`,
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'nw-map-edgedel',
                  onClick: () => {
                    setEdges((list) =>
                      list.filter((row) => !(row.from === edge.from && row.to === edge.to)),
                    )
                    setDirty(true)
                  },
                },
                '删',
              ),
            ),
          ),
        )
      : null,
    h(
      Hint,
      null,
      '地图只是帮你记路：坐标和连线都由你自己摆，账本里没有「相邻」这种字段，所以它不会被当成设定校验的依据。',
    ),
  )
}
