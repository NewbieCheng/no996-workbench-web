/**
 * 免费目视复核：用刚才真实跑出来的任务记录，展开「创作过程」详情，确认
 * 被跳过的「编辑」在界面上确实标成「已跳过」而不是和跑过的步骤长得一样。
 *
 * 只读本机 IndexedDB + DOM，不调用模型（不消耗积分）。
 * 注意：历史列表里只有「删除」按钮，脚本**绝不点击**任何按钮的文本为「删除」的元素。
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, newPage, loginToken, setAuth, sleep, HERE, APP } from './lib.mjs'

const chrome = await launch({ fresh: false })
const page = await newPage()
const { cdp } = page

await cdp.send('Page.navigate', { url: `${APP}/workbench/video-script` })
await sleep(2500)
await setAuth(cdp, await loginToken())

for (const [label, path] of [
  ['视频脚本', '/workbench/video-script'],
  ['直播脚本', '/workbench/live-script'],
  ['爆款标题', '/workbench/titles'],
]) {
  await cdp.send('Page.navigate', { url: `${APP}${path}` })
  await sleep(5000)

  const info = await cdp.evaluate(`(() => {
    const d = document.querySelector('.agent-detail')
    if (d) d.open = true
    return {
      hasDetail: Boolean(d),
      hasProgress: Boolean(document.querySelector('.stage-progress')),
      // 把「创作过程」滚到视口中央，方便截图
      scrolled: (() => {
        if (!d) return false
        d.scrollIntoView({ block: 'center' })
        return true
      })(),
    }
  })()`)
  await sleep(1200)

  const dom = await cdp.evaluate(`(() => {
    const d = document.querySelector('.agent-detail')
    const items = d
      ? [...d.querySelectorAll('.agent-detail__item')].map((li) => ({
          role: li.querySelector('.agent-detail__role')?.textContent?.trim(),
          status: li.getAttribute('data-status'),
          label: li.querySelector('.agent-detail__status')?.textContent?.trim(),
          round: li.querySelector('.agent-detail__round')?.textContent?.trim() ?? null,
        }))
      : []
    return { items, text: d ? d.innerText.slice(0, 600) : '' }
  })()`)

  console.log(`\n===== ${label} =====`)
  console.log(`  详情面板: ${info.hasDetail}  进度条: ${info.hasProgress}`)
  dom.items.forEach((s) =>
    console.log(`    ${String(s.role).padEnd(8)} status=${String(s.status).padEnd(8)} 文案=${String(s.label).padEnd(6)} ${s.round ?? ''}`),
  )
  if (!dom.items.length) console.log('    （没有列出任何步骤）')

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const slug = path.split('/').pop()
  writeFileSync(join(HERE, `r4-详情-${slug}.png`), Buffer.from(data, 'base64'))
}

chrome.kill()
process.exit(0)
