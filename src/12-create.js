/**
 * 长夜 · 建作品（没有作品时的首屏）
 *
 * 这一屏的历史：最早是「还没有作品。先去设置里建一本。」一句指路牌，指向的
 * 设置页弹窗只有书名和题材。后来改成真表单，但一口气摊开 15 个字段 —— 数字
 * 五个、方案七个，第一次打开的人面对的是两张卡和一屏输入框。
 *
 * 现在改成三步向导。判据是「建书页只该回答一个问题：这本书叫什么」，
 * 其余问题都该在需要的时候才问：
 *
 *   1. 写什么   —— 书名 + 一句话想法（两项必填，别的一个字都不用打）
 *   2. 怎么排   —— 四张规模卡片选一个，右栏实时算全书体量；题材/主角/钩子
 *                  收进「更多（可跳过）」
 *   3. 确认     —— 清单复述 + 一个勾选（建完先把全书骨架排好）
 *
 * 为什么方案那六个字段（audience / goal / conflict / ending 等）从建书页拿掉了：
 *   outline.brief 是大纲页和 outline.generate 共用的唯一真相。建书时填一半、
 *   大纲页再填一半，两处对不上就是两套真相。建书只写「想法的自然语言」进
 *   brief.premise，其余留在大纲页 —— 那边本来就有全套表单。
 */

// 规模卡片。这四个口径覆盖绝大多数网文体量，比让人手填「卷数 × 每卷章数」
// 少四次思考；想精确调的人建完在大纲页改，那里两个数字都能输。
// volumes ≤ 30、chaptersPerVolume ≤ 200 是 lib/store.js normalizeBrief 的夹取
// 范围，这里的四个预设都在范围内，不会被服务端悄悄改掉。
const CREATE_SCALES = [
  {
    id: 'short',
    name: '短篇',
    desc: '一口气写完，先试水',
    volumes: 1,
    perVolume: 30,
    words: 2000,
  },
  {
    id: 'medium',
    name: '中篇',
    desc: '常规连载体量',
    volumes: 2,
    perVolume: 50,
    words: 2500,
  },
  {
    id: 'long',
    name: '长篇',
    desc: '能写小半年的量',
    volumes: 6,
    perVolume: 50,
    words: 2500,
  },
  {
    id: 'ai',
    name: '让 AI 定',
    desc: '先建书，体量之后在大纲页调',
    volumes: 3,
    perVolume: 20,
    words: 2500,
  },
]

const CREATE_SCALE_BY_ID = Object.fromEntries(CREATE_SCALES.map((row) => [row.id, row]))

const CREATE_TEXT_RULES = {
  name: { max: 60, required: true },
  idea: { max: 400, required: true },
  genre: { max: 30 },
  protagonist: { max: 120 },
  hook: { max: 120 },
}

const CREATE_EMPTY = {
  name: '',
  idea: '',
  genre: '',
  protagonist: '',
  hook: '',
  scale: 'medium',
}

/**
 * 把任意值收敛成一个「能上屏的字符串」。
 *
 * 服务端回来的、localStorage 里存过的、用户删了一半的输入，都可能是
 * undefined / null / NaN / '[object Object]'。这些东西一旦漏到界面上，
 * 用户看到的就是 `NaN` 或者 `undefined` —— 那不是文案，是故障。
 */
function createText(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s === 'undefined' || s === 'null' || s === 'NaN' || s === '[object Object]') return ''
  return s
}

/** 取规模；认不出来的 id 回落到中篇，永不返回 undefined。 */
function createScale(value) {
  const id = createText(value).trim()
  return CREATE_SCALE_BY_ID[id] ?? CREATE_SCALE_BY_ID.medium
}

/**
 * 前端校验 + 组装两份 payload。
 *
 * 为什么前端也要校验：服务端 createProject 对空书名是「兜底成未命名作品」，
 * 不报错。作者填了一半点了创建，得到一本叫「未命名作品」的目录 —— 看起来
 * 成功了，其实名字丢了。这里必须先拦住并指出是哪一项。
 *
 * 返回 { ok, errors, project, brief, first, scale }：
 *   project → project.create 的 payload（落 project.json）
 *   brief   → outline.save 的 outline.brief（落 outline.json）
 */
function validateCreate(form) {
  const src = form && typeof form === 'object' ? form : {}
  const errors = {}
  const out = {}

  for (const key of ['name', 'idea', 'genre', 'protagonist', 'hook']) {
    const rule = CREATE_TEXT_RULES[key]
    const value = createText(src[key]).trim()
    if (rule.required && !value) {
      errors[key] = '这一项必填'
    } else if (value.length > rule.max) {
      errors[key] = `最多 ${rule.max} 字，现在 ${value.length} 字`
    }
    out[key] = value
  }

  const scale = createScale(src.scale)

  const project = {
    name: out.name,
    genre: out.genre,
    // 「一句话想法」既是建书页给人看的卖点，也是项目日志行。两处同一句。
    logline: out.idea,
    targetWords: scale.words,
    qualityGate: 70,
    monthlyBudget: 600,
  }

  const brief = {
    // 想法整段进 premise：这是唯一会把「作者原话」带进大纲的字段，
    // 大纲页和 outline.generate 都读它。
    premise: out.idea,
    genre: out.genre,
    audience: '',
    protagonist: out.protagonist,
    goal: '',
    conflict: '',
    hook: out.hook,
    ending: '',
    volumes: scale.volumes,
    chaptersPerVolume: scale.perVolume,
  }

  const keys = Object.keys(errors)
  return {
    ok: keys.length === 0,
    errors,
    project,
    brief,
    first: keys[0] ?? '',
    scale,
  }
}

/**
 * 分步校验：三步里每一步只拦自己那一步的必填项。
 *
 * 第 3 步点「建这本」时不能再把第 1 步的红字翻出来 —— 那会让人找不到自己
 * 刚跳过的是哪一屏。
 */
function createStepIssues(form, step) {
  const all = validateCreate(form).errors
  const byStep = {
    1: ['name', 'idea'],
    2: ['genre', 'protagonist', 'hook'],
    3: ['name', 'idea'],
  }
  const keys = byStep[step] ?? []
  const errors = {}
  for (const key of keys) {
    if (all[key]) errors[key] = all[key]
  }
  return errors
}

function CreateField({ id, label, hint, error, children }) {
  return h(
    'div',
    { className: `nw-field nw-create-field${error ? ' nw-create-field-bad' : ''}` },
    h('label', { htmlFor: `create-${id}` }, label),
    children,
    error
      ? h('span', { className: 'nw-create-err' }, error)
      : hint
        ? h('span', { className: 'nw-create-hint' }, hint)
        : null,
  )
}

const CREATE_STEPS = ['写什么', '怎么排', '确认']

function CreateProjectPage({ toast, onDone }) {
  const [form, setForm] = useState(CREATE_EMPTY)
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState(null)
  const [more, setMore] = useState(false)
  const [generate, setGenerate] = useState(true)

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // 改哪一项就撤哪一项的红字：让作者看到自己正在修。
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const preview = validateCreate(form)
  const scale = preview.scale
  const planChapters = scale.volumes * scale.perVolume
  const planWords = planChapters * scale.words

  const goStep = (next) => {
    if (busy) return
    const issues = createStepIssues(form, step)
    setErrors(issues)
    if (Object.keys(issues).length) {
      setNotice(`还有 ${Object.keys(issues).length} 项没填对，红字标的就是。`)
      return
    }
    setNotice('')
    setStep(Math.min(3, Math.max(1, next)))
  }

  const submit = async () => {
    // 提交中一律不接受第二次点击：连点会建出两本同名作品，而且第二次
    // 那一本的 id 在界面上根本没机会显示。
    if (busy) return
    const check = validateCreate(form)
    setErrors(check.errors)
    setFailure(null)
    if (!check.ok) {
      // 走到这一步还不通过，只可能是第 1 步被人清空了：把人送回那一屏。
      setStep(1)
      setNotice(`还有 ${Object.keys(check.errors).length} 项没填对，红字标的就是。`)
      return
    }
    setBusy(true)
    setNotice('')
    let made = null
    try {
      made = await api('project.create', check.project)
    } catch (error) {
      // 服务端拒绝就照原样说出来，不换成「创建失败，请重试」这种把原因吞掉的话。
      setFailure({
        message: createText(error?.message) || '服务端没有说明原因',
        code: createText(error?.code),
      })
      setNotice('作品没建起来。')
      setBusy(false)
      return
    }
    const id = createText(made?.id)
    if (!id) {
      setFailure({ message: '服务端没有返回作品 id，界面没法切过去', code: 'no-id' })
      setNotice('作品没建起来。')
      setBusy(false)
      return
    }

    // 后两步都发生在「作品已经建好之后」。任何一步失败都不回滚 —— 目录已经在
    // 磁盘上了，删掉重建风险更大。所以要把「建了，但哪一步没成」说清楚。
    let briefError = null
    try {
      await api('outline.save', { projectId: id, outline: { brief: check.brief } })
    } catch (error) {
      briefError = createText(error?.message) || '未知原因'
    }
    let outlineError = null
    if (generate && !briefError) {
      try {
        await api('outline.generate', { projectId: id })
      } catch (error) {
        outlineError = createText(error?.message) || '未知原因'
      }
    }
    setBusy(false)
    const trouble = [
      briefError ? `方案没存进去：${briefError}` : '',
      outlineError ? `骨架没排出来：${outlineError}` : '',
    ].filter(Boolean)
    if (trouble.length) {
      toast(`《${check.project.name}》已建，但${trouble.join('；')}`)
    } else {
      toast(`已建《${check.project.name}》`)
    }
    onDone?.(id, { briefError, outlineError })
  }

  // ── 第 1 步：写什么 ─────────────────────────────────────────
  const stepWrite = h(
    Fragment,
    null,
    h(Hint, null, '先起个名，再说一句你想看的故事。其余都能之后再改。'),
    h(
      CreateField,
      {
        id: 'name',
        label: '书名',
        error: errors.name,
        hint: '必填，最多 60 字',
      },
      h(Input, {
        id: 'create-name',
        value: form.name,
        placeholder: '例：元末女帝：系统让我截胡朱重八',
        onChange: set('name'),
      }),
    ),
    h(
      CreateField,
      {
        id: 'idea',
        label: '一句话想法',
        error: errors.idea,
        hint: '主角是谁、想要什么、最怕什么。写得越具体，后面排单越不像在跟空白说话。',
      },
      h(TextArea, {
        id: 'create-idea',
        value: form.idea,
        rows: 6,
        placeholder:
          '例：元末乱世，一个现代女生穿成村姑，绑定的系统只会发「嫁给朱重八」的任务；她想活下来，又不想真进那座宫。',
        onChange: set('idea'),
      }),
    ),
  )

  // ── 第 2 步：怎么排 ─────────────────────────────────────────
  const stepPlan = h(
    Fragment,
    null,
    h(Hint, null, '选一个体量就行，数字不用你手填。建完在大纲页还能改。'),
    h(
      'div',
      { className: 'nw-create-scale-grid' },
      CREATE_SCALES.map((row) => {
        const on = form.scale === row.id
        const total = row.volumes * row.perVolume * row.words
        return h(
          'button',
          {
            type: 'button',
            key: row.id,
            className: `nw-create-scale${on ? ' nw-create-scale-on' : ''}`,
            onClick: () => set('scale')(row.id),
            'aria-pressed': on ? 'true' : 'false',
          },
          h(
            'div',
            { className: 'nw-create-scale-head' },
            h('span', { className: 'nw-create-scale-name' }, row.name),
            on ? h(Tag, { tone: 'amber' }, '已选') : null,
          ),
          h(
            'span',
            { className: 'nw-create-scale-meta' },
            `${row.volumes} 卷 × ${row.perVolume} 章 × ${row.words} 字`,
          ),
          h('span', { className: 'nw-create-scale-desc' }, row.desc),
          h('span', { className: 'nw-create-scale-total' }, `约 ${fmtWords(total)} 字`),
        )
      }),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'nw-create-more',
        onClick: () => setMore((prev) => !prev),
        'aria-expanded': more ? 'true' : 'false',
      },
      more ? '▾ 收起' : '▸ 更多（可跳过）',
    ),
    more
      ? h(
          'div',
          { className: 'nw-create-more-body' },
          h(
            'div',
            { className: 'nw-form-grid' },
            h(
              CreateField,
              { id: 'genre', label: '题材', error: errors.genre, hint: '例：历史穿越 / 都市异能' },
              h(Input, {
                id: 'create-genre',
                value: form.genre,
                placeholder: '例：历史穿越',
                onChange: set('genre'),
              }),
            ),
            h(
              CreateField,
              {
                id: 'protagonist',
                label: '主角',
                error: errors.protagonist,
                hint: '写个名字就够了，人设去人物卡里建',
              },
              h(Input, {
                id: 'create-protagonist',
                value: form.protagonist,
                placeholder: '例：林小满，18 岁，嘴硬心软',
                onChange: set('protagonist'),
              }),
            ),
          ),
          h(
            CreateField,
            { id: 'hook', label: '开篇钩子', error: errors.hook, hint: '第一句话能不能把人拽住' },
            h(Input, {
              id: 'create-hook',
              value: form.hook,
              placeholder: '例：第一句系统提示就在催婚',
              onChange: set('hook'),
            }),
          ),
        )
      : null,
  )

  // ── 第 3 步：确认 ───────────────────────────────────────────
  const stepConfirm = h(
    Fragment,
    null,
    h(Hint, null, '确认一下，点「建这本」会：'),
    h(KV, {
      rows: [
        { key: '书名', text: createText(preview.project.name) || '（还没填）' },
        { key: '想法', text: createText(preview.project.logline) || '（还没填）' },
        {
          key: '规模',
          text: `${scale.name} · ${scale.volumes} 卷 × ${scale.perVolume} 章 = ${planChapters} 章`,
        },
        { key: '每章', text: `${scale.words} 字` },
        { key: '全书预计', text: fmtWords(planWords) },
        { key: '题材', text: createText(preview.project.genre) || '（留空，之后补）' },
        { key: '主角', text: createText(preview.brief.protagonist) || '（留空，之后补）' },
      ],
    }),
    h(
      'div',
      { className: 'nw-create-check' },
      h(Switch, {
        on: generate,
        onChange: setGenerate,
        label: '建完先把全书骨架排好',
      }),
      h(
        Hint,
        null,
        generate
          ? `按你选的规模把 ${planChapters} 回一次性建出来，之后在大纲页填标题和钩子。`
          : '只建作品本身，章回等你在大纲页点「重排大纲」时再生成。',
      ),
    ),
  )

  const body = step === 1 ? stepWrite : step === 2 ? stepPlan : stepConfirm

  return h(
    'div',
    { className: 'nw-page nw-create' },
    h(
      'div',
      { className: 'nw-create-lead' },
      h('h2', { className: 'nw-create-title' }, '先建一本'),
      h(
        'p',
        { className: 'nw-create-sub' },
        '三步就够：写什么、怎么排、确认。书名和体量后面都能改。',
      ),
    ),
    h(
      'div',
      { className: 'nw-create-steps-bar' },
      CREATE_STEPS.map((label, index) => {
        const n = index + 1
        const cls = n === step ? ' on' : n < step ? ' done' : ''
        return h(
          'span',
          { className: `nw-create-step${cls}`, key: label },
          h('span', { className: 'nw-create-step-n' }, String(n)),
          label,
        )
      }),
    ),
    h(
      'div',
      { className: 'nw-create-cols' },
      h(
        'div',
        { className: 'nw-create-main' },
        h(Card, { title: CREATE_STEPS[step - 1], className: 'nw-create-card' }, body),
      ),
      h(
        'div',
        { className: 'nw-create-side' },
        h(
          Card,
          { title: '建出来是这样', className: 'nw-create-card' },
          h(KV, {
            rows: [
              { key: '书名', text: createText(preview.project.name) || '（还没填）' },
              { key: '规模', text: `${scale.volumes} 卷 × ${scale.perVolume} 章` },
              { key: '章数', text: `${planChapters} 回` },
              { key: '每章', text: `${scale.words} 字` },
              { key: '全书预计', text: fmtWords(planWords) },
            ],
          }),
          h(Hint, null, '数字按你选的体量实时算，建完还能在大纲页改。'),
        ),
        h(
          Card,
          { title: '接下来', className: 'nw-create-card' },
          h(
            'ul',
            { className: 'nw-create-steps' },
            h('li', null, '建一个作品目录，写入作品元信息'),
            h('li', null, '把这句话写进大纲的方案里'),
            h('li', null, generate ? '按体量把每一回都建出来' : '章回等你在大纲页生成'),
            h('li', null, '切到这本作品，落在「今天」'),
          ),
          h(
            'div',
            { className: 'nw-create-foot' },
            step > 1
              ? h(
                  Btn,
                  { kind: 'ghost', small: true, disabled: busy, onClick: () => goStep(step - 1) },
                  '上一步',
                )
              : null,
            step < 3
              ? h(
                  Btn,
                  {
                    kind: 'primary',
                    className: 'nw-create-next',
                    disabled: busy,
                    onClick: () => goStep(step + 1),
                  },
                  '下一步',
                )
              : h(
                  Btn,
                  {
                    kind: 'primary',
                    className: 'nw-create-submit',
                    disabled: busy,
                    onClick: submit,
                  },
                  busy ? '建书中…' : '建这本',
                ),
          ),
          notice ? h('p', { className: 'nw-create-notice' }, notice) : null,
          failure
            ? h(
                'div',
                { className: 'nw-error nw-create-fail' },
                h('span', null, failure.message),
                failure.code ? h('span', { className: 'nw-create-code' }, failure.code) : null,
              )
            : null,
        ),
      ),
    ),
  )
}
