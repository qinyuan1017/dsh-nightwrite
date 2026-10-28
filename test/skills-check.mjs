import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'skills')
const REQUIRED = ['## 执行步骤', '## 输入', '## 输出格式', '## 检查清单', '## 禁止事项']

const EXPECTED = [
  'changye-plan-novel','changye-write-chapter','changye-continuity-pass','changye-de-ai-style',
  'changye-story-bible','changye-revision-pass','changye-style-distillation','changye-quality-rubric',
  'changye-chapter-hook','changye-dialogue-voice','changye-foreshadow-ledger','changye-character-state',
  'changye-context-memory','changye-worldbuilding-bible','changye-beat-sheet','changye-character-arc',
  'changye-reader-persona','changye-reader-report','changye-drop-off-check','changye-engagement-curve',
  'changye-comment-simulation','changye-paywall-check','changye-emotional-payoff','changye-reader-question',
  'changye-reader-panel',
]

let pass = 0, fail = 0
const rows = []
function ok(name, cond, detail = '') {
  if (cond) { pass += 1 } else { fail += 1; rows.push(`FAIL ${name}${detail ? ' — ' + detail : ''}`) }
}

ok('技能总数 25', EXPECTED.length === 25, String(EXPECTED.length))

for (const skill of EXPECTED) {
  const file = path.join(ROOT, skill, 'SKILL.md')
  const exists = fs.existsSync(file)
  ok(`${skill} 文件存在`, exists)
  if (!exists) continue
  const text = fs.readFileSync(file, 'utf8')

  // frontmatter
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/)
  ok(`${skill} 有 frontmatter`, !!fm)
  if (fm) {
    const body = fm[1]
    ok(`${skill} frontmatter.name 存在`, /^name:\s*\S+/m.test(body))
    const nameVal = (body.match(/^name:\s*(\S+)/m) || [])[1]
    ok(`${skill} name 与目录名一致`, nameVal === skill, `name=${nameVal}`)
    const descBlock = body.match(/^description:\s*\|?\s*\n([\s\S]*)$/m)
    ok(`${skill} frontmatter.description 存在且非空`, !!descBlock && descBlock[1].trim().length > 40)
    ok(`${skill} description 含触发词`, !!descBlock && /触发词/.test(descBlock[1]))
    ok(`${skill} description 含「不要用」边界`, !!descBlock && /不要用|不许用|不要/.test(descBlock[1]))
  }

  // 五个小节
  for (const sec of REQUIRED) {
    ok(`${skill} 有「${sec}」`, text.includes(sec))
  }

  // 禁止事项非空
  const banIdx = text.indexOf('## 禁止事项')
  ok(`${skill} 禁止事项有内容`, banIdx > 0 && text.slice(banIdx).split('\n').filter((l) => l.trim().startsWith('- ')).length >= 4)

  // 检查清单项数
  const chkIdx = text.indexOf('## 检查清单')
  const chkEnd = text.indexOf('## 禁止事项')
  const boxes = text.slice(chkIdx, chkEnd).split('\n').filter((l) => l.trim().startsWith('- [ ]')).length
  ok(`${skill} 检查清单 ≥6 项`, boxes >= 6, `实际 ${boxes}`)

  // 越权边界说明
  ok(`${skill} 提到 changye_op 或对应数据接口`, /changye_op|ledger\.|chapter\.|outline\.|project\.|aistyle\./.test(text))
}

// 交叉边界：每个技能都要声明「不做什么」
ok('全部 25 个都有「不负责/不许」类边界句', EXPECTED.every((s) => {
  const t = fs.readFileSync(path.join(ROOT, s, 'SKILL.md'), 'utf8')
  return /不负责|不许|不要用/.test(t)
}))

console.log(rows.join('\n'))
console.log(`\n${pass} 过 / ${fail} 不过 · 共 ${pass + fail} 项 · 技能 ${EXPECTED.length} 个`)
process.exit(fail === 0 ? 0 : 1)
