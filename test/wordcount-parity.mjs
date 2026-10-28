/**
 * 字数口径一致性：客户端 countChars 与服务端 lib/wordcount.js 必须算出同一个数。
 *
 * 这一条单独拉出来测，是因为它错了不会报错、不会崩，只会让「作者报的字数」和
 * 「读者看到的字数」慢慢差开，而那种偏差没人会去查原因。
 *
 * 客户端那个函数是从 src/10-core.js 里把源码切出来 eval 的——不是复制一份逻辑来
 * 做黄金对照，而是真的跑界面那份代码。复制一份对照等于测自己。
 */
import fs from 'node:fs'
import * as wc from '../lib/wordcount.js'

const src = fs.readFileSync(new URL('../src/10-core.js', import.meta.url), 'utf8')
const start = src.indexOf('function countChars(text) {')
const end = src.indexOf('const STATUS_LABEL', start)
if (start < 0 || end < 0) {
  console.error('没在 src/10-core.js 里找到 countChars —— 名字被改了就把这个测试一起改')
  process.exit(1)
}
const block = src.slice(src.lastIndexOf('/**', start), end).trim()
// eslint-disable-next-line no-new-func
const countChars = new Function(`${block}; return countChars`)()

const CASES = [
  ['空串', ''],
  ['单句', '他推开门。'],
  ['带首行标题', '# 第 3 回 雪\n他推开门。'],
  ['带 frontmatter + 标题', '---\ntitle: x\n---\n# 第 3 回 雪\n他推开门。'],
  ['假的 frontmatter（没有 key）', '---\n没有键值行\n---\n正文'],
  ['BOM + 空行 + 标题', '\ufeff\n\n# 标题\n正文三个字'],
  ['CRLF', 'a\r\nb\r\nc'],
  ['全角空格与 NBSP', '　　全角空格与\u3000空白\u00a0混排'],
  ['标题但不是章名（# 后面没空格）', '#不是标题\n正文'],
  ['两行以 # 开头', '# 一\n# 二\n正文'],
]

let pass = 0
const fails = []
for (const [name, text] of CASES) {
  const a = countChars(text)
  const b = wc.countWords(text)
  if (a === b) {
    pass += 1
    console.log(`✓ ${name} = ${a}`)
  } else {
    fails.push(name)
    console.log(`✗ ${name}  客户端 ${a} / 服务端 ${b}`)
  }
}

// 反向保险：schema 名改了要一起改，否则说明口径漂了
if (wc.WORDCOUNT_METRIC !== 'visible_chars_v1') {
  fails.push('口径名变了')
  console.log(`✗ 口径名是 ${wc.WORDCOUNT_METRIC}，说明算法换了一版，客户端要跟着改`)
} else {
  pass += 1
  console.log('✓ 口径名还是 visible_chars_v1')
}

console.log(`\n${pass} 过 / ${fails.length} 不过 · 共 ${pass + fails.length} 项`)
process.exit(fails.length ? 1 : 0)
