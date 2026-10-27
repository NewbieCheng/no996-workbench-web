/**
 * 人设控件（默认注入 + 可换档）的真机 UI 验证。
 *
 * 只读本机 IndexedDB，不调用模型 → 不消耗积分。
 * 会往本机库写入 3 条真实结构的人设，用于验证换档菜单。
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, newPage, loginToken, setAuth, sleep, HERE, APP } from './lib.mjs'

const chrome = await launch()
const page = await newPage()
const { cdp } = page

async function shot(name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(HERE, name), Buffer.from(data, 'base64'))
  console.log(`  截图 → ${name}`)
}

await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
await sleep(2500)
const token = await loginToken()
await setAuth(cdp, token)

// 写入 3 档：B 为启用档（故意让它不是列表第一个，好验证「默认选中启用档」）
const mk = (id, name, industry, role, content, isActive, updatedAt) => ({
  id,
  kind: 'user',
  name,
  summary: `${industry}·${role}`,
  content,
  formData: {
    industry,
    role,
    primaryBusiness: `${industry}相关服务`,
    targetClients: '中小门店老板',
    clientPainPoints: '不知道怎么起步',
    desiredImage: '说人话、给具体动作',
    additionalInfo: '',
  },
  isActive,
  updatedAt,
})

const SEED_RECORDS = [
  mk('pk_a', '美妆博主分身', '美妆个护', '成分党博主', '# 美妆人设\n\n- 现状：以成分分析切入', false, '2026-10-10T00:00:00.000Z'),
  mk('pk_b', '餐饮代运营操盘手', '餐饮代运营', '团购短视频操盘手', '# 餐饮人设\n\n- 现状：帮门店做团购短视频', true, '2026-10-11T00:00:00.000Z'),
  mk('pk_c', '职场内容顾问', '职场培训', '简历与面试教练', '# 职场人设\n\n- 现状：做求职辅导', false, '2026-10-09T00:00:00.000Z'),
]

const seedExpr = `(() => {
  const recs = ${JSON.stringify(SEED_RECORDS)}
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('no996-workbench-persona', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('personas')) {
        const s = db.createObjectStore('personas', { keyPath: 'id' })
        s.createIndex('by_kind', 'kind', { unique: false })
        s.createIndex('by_kind_active', ['kind', 'isActive'], { unique: false })
      }
    }
    req.onerror = () => reject(new Error('open failed'))
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('personas', 'readwrite')
      recs.forEach((r) => tx.objectStore('personas').put(r))
      tx.oncomplete = () => resolve(recs.length)
      tx.onerror = () => reject(tx.error)
    }
  })
})()`

// 先做一次纯语法自检：表达式本身不合法就没必要发给浏览器
try {
  new Function(`return ${seedExpr}`)
} catch (e) {
  console.error('seedExpr 语法错误:', e.message)
  console.error(seedExpr)
  process.exit(1)
}

const seeded = await cdp.evaluate(seedExpr)
console.log(`已写入 ${seeded} 条人设`)

await cdp.send('Page.navigate', { url: `${APP}/workbench/titles` })
await sleep(3500)

const readControl = () =>
  cdp.evaluate(`(() => {
    const root = document.querySelector('.persona-injection')
    if (!root) return null
    const menu = root.querySelector('.persona-injection__menu')
    return {
      text: root.querySelector('.persona-injection__text')?.textContent?.trim() ?? null,
      on: root.hasAttribute('data-on'),
      disabled: root.hasAttribute('data-disabled'),
      hasPick: Boolean(root.querySelector('.persona-injection__pick')),
      pickLabel: root.querySelector('.persona-injection__pick')?.textContent?.trim() ?? null,
      menuOpen: Boolean(menu),
      items: menu ? [...menu.querySelectorAll('.persona-injection__item')].map((b) => ({
        name: b.querySelector('.persona-injection__item-name')?.textContent?.trim(),
        current: b.hasAttribute('data-current'),
        checked: b.getAttribute('aria-checked'),
      })) : [],
    }
  })()`)

console.log('\n=== 1. 默认状态（应为：默认勾选 + 选中启用档 B）===')
const defaultState = await readControl()
console.log(JSON.stringify(defaultState, null, 2))
await shot('u1-人设控件-默认已注入.png')

console.log('\n=== 2. 打开换档菜单 ===')
await cdp.evaluate(`document.querySelector('.persona-injection__pick')?.click()`)
await sleep(700)
const open = await readControl()
console.log(JSON.stringify(open, null, 2))
await shot('u2-人设控件-换档菜单.png')

console.log('\n=== 3. 换到「职场内容顾问」（第 3 项）===')
await cdp.evaluate(`(() => {
  const items = [...document.querySelectorAll('.persona-injection__menu .persona-injection__item')]
  const hit = items.find((b) => (b.textContent || '').includes('职场内容顾问'))
  hit?.click()
  return Boolean(hit)
})()`)
await sleep(700)
const switched = await readControl()
console.log(JSON.stringify(switched, null, 2))
await shot('u3-人设控件-已换档.png')

console.log('\n=== 4. 关掉开关 ===')
await cdp.evaluate(`document.querySelector('.persona-injection__input')?.click()`)
await sleep(700)
const off = await readControl()
console.log(JSON.stringify(off, null, 2))
await shot('u4-人设控件-已关闭.png')

// 断言：把「预期」写死，避免出现恒真的假通过
const currentInMenu = open.items.find((i) => i.current)?.name ?? null
const checks = [
  ['默认勾选（进页面即注入）', defaultState.on === true],
  ['默认选中启用档 pk_b（不是列表首个 pk_a）', currentInMenu === '餐饮代运营操盘手'],
  ['菜单列出全部 3 档', open.items.length === 3],
  ['每个档都有名称', open.items.every((i) => Boolean(i.name))],
  ['换档后标签更新', switched.text === '已注入人设：职场内容顾问'],
  ['关掉后不再显示已注入', off.text === '不注入人设'],
  ['关掉后开关为未选中', off.on === false],
  ['关掉后菜单收起', off.menuOpen === false],
]
console.log('\n=== 断言 ===')
for (const [name, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
const failed = checks.filter(([, ok]) => !ok)
if (failed.length) process.exitCode = 1

writeFileSync(
  join(HERE, 'ui-persona.json'),
  JSON.stringify({ seeded, defaultState, menuOpen: open, switched, off, checks }, null, 2),
)

chrome.kill()
// CDP 的 WebSocket 与 Chrome 子进程会让事件循环一直有活，脚本跑完也不会自己退出
process.exit(failed.length ? 1 : 0)
