export type IPVideoTemplate = {
  id: string; name: string; category: string; description: string; color: string; background: string
  heading: string; caption: string; duration: string; stars: number; materials: string[]; platform: string
  sampleScript: string; cases: Array<{ title: string; views: string }>
}

export const IP_VIDEO_RULES = { minScriptChars: 20, maxDuration: 300, maxUploadBytes: 10 * 1024 * 1024 } as const
export const COVER_STYLES = ['poster', 'call', 'pink', 'career'] as const
export type CoverStyle = typeof COVER_STYLES[number]

export const IP_VIDEO_TEMPLATES: IPVideoTemplate[] = [
  { id: 'scroll', name: '经典滚动字幕', category: '知识分享', description: '让每句话都成为重点。三行滚动字幕，适合观点与干货口播。', color: '#FFD60A', background: '#172128', heading: '把复杂的事\n讲简单一点', caption: '让观点被看见', duration: '30–90 秒', stars: 5, materials: ['口播文案', '一张封面'], platform: '抖音', sampleScript: '你有没有发现，越想把一件事讲清楚，越容易说得太复杂？其实，好的表达不需要把所有信息一次说完。先告诉对方，这件事和他有什么关系。再用一个具体的例子，把抽象的观点变成眼前的画面。最后只留下一个能立刻行动的小建议。下次分享之前，先问自己：如果对方只记住一句话，我希望是哪一句？从那句话开始，你的表达就会清楚很多。', cases: [{ title: '一件小事，让表达变清楚', views: '演示案例 · 不展示虚构播放量' }, { title: '别急着给答案，先讲一个故事', views: '演示案例' }] },
  { id: 'poster', name: '醒目大字报', category: '观点表达', description: '一句话先抓住注意力，大字排版为你的观点留出空间。', color: '#18291F', background: '#D9EDAD', heading: '停止内耗\n从小事开始', caption: '今天，先做好一件事', duration: '15–60 秒', stars: 5, materials: ['观点文案', '一张照片'], platform: '小红书', sampleScript: '总觉得自己还不够好？你可能不是做得太少，而是同时想做的事太多。今天试着把任务清单缩短一点，只留下一件真正重要的事。做完它，再决定下一步。别人走得快，不代表你也必须用同样的节奏。给自己一点空间，不急着评价每一次尝试。能持续的小行动，比一次用尽力气更重要。从现在开始，把注意力放回自己能做的事情上。', cases: [{ title: '把注意力放回自己身上', views: '演示排版案例' }] },
  { id: 'call', name: '来电式开场', category: '情绪共鸣', description: '用一通「来电」开启对话，适合提醒、共鸣与个人故事。', color: '#FFFFFF', background: '#253B58', heading: '未来的你\n正在来电', caption: '有些话，想现在告诉你', duration: '30–60 秒', stars: 4, materials: ['故事文案', '人物照片'], platform: '抖音', sampleScript: '如果未来的你能打来一个电话，你最想听见什么？也许不是一句你已经成功了，而是告诉你，不用因为今天的迷茫就否定一路的努力。你正在学的东西，你认真做过的尝试，都在慢慢变成你的经验。允许自己暂时没有答案，也允许计划中途改变。今天先好好吃一顿饭，睡一个安稳的觉。明天再继续，把自己的生活照顾好，也是很重要的进步。', cases: [{ title: '来自未来自己的一通电话', views: '演示排版案例' }] },
  { id: 'career', name: '职场观点卡', category: '职场成长', description: '简洁的编辑式排版，适合经验复盘、行业见解与专业 IP。', color: '#FFFFFF', background: '#30313A', heading: '会做事\n也要会表达', caption: '关于职场的一个小建议', duration: '45–120 秒', stars: 4, materials: ['经验文案', '人物照片'], platform: '抖音', sampleScript: '工作里，让别人理解你做了什么，和把事情做好同样重要。汇报的时候，不妨先说结果，再说你遇到了什么问题，最后说明下一步需要什么支持。把细节留给真正需要追问的人，不用一开始就把整个过程从头讲一遍。这不是为了包装自己，而是减少彼此理解的成本。下一次开会前，用几句话写下你最想传达的重点，试着说给一个不了解项目的人听。', cases: [{ title: '汇报时，先把重点说出来', views: '演示排版案例' }] },
  { id: 'life', name: '生活手记', category: '生活记录', description: '留白与纸感排版，让日常经验成为值得分享的故事。', color: '#4D3426', background: '#EFE4D2', heading: '日子慢一点\n也很好', caption: '记录生活里的小发现', duration: '30–90 秒', stars: 4, materials: ['生活文案', '一张照片'], platform: '小红书', sampleScript: '下班回家，给自己做一顿热乎的饭，是我最近最喜欢的小事。不用复杂的菜谱，也不需要把每一步都做得完美。洗一把青菜，煮一锅汤，听着锅里咕嘟咕嘟的声音，白天的疲惫也会慢慢放下来。我们总想把生活安排得更有效率，但有时候，认真感受一个普通的傍晚就已经很好。今天也给自己留一点时间，做一件只是让自己开心的事。', cases: [{ title: '认真吃饭，认真生活', views: '演示排版案例' }] },
  { id: 'lesson', name: '知识小黑板', category: '知识分享', description: '清晰的主题标题搭配高对比字幕，适合课程与方法拆解。', color: '#CBE7D5', background: '#173D31', heading: '一个方法\n讲透一个问题', caption: '学会，然后用起来', duration: '60–180 秒', stars: 4, materials: ['知识文案', '主题标题'], platform: '抖音', sampleScript: '学会一个新方法，最重要的不是马上记住所有步骤，而是知道它解决什么问题。先找一个你正在面对的具体场景，再试着用这个方法做一次。做完以后，回头看看哪里顺利，哪里需要调整。把那些卡住的地方记录下来，下次就知道该关注什么。学习不是把知识收藏起来，而是让它在生活里真正派上用场。今天就选一个小问题，用你刚学到的东西试试看。', cases: [{ title: '把学到的方法真正用起来', views: '演示排版案例' }] },
  { id: 'audiogram', name: '声纹电台波形', category: '情绪共鸣', description: '播客式动态声波随配音强弱起伏，适合深度思考与声音叙事。', color: '#00F0FF', background: '#0D1322', heading: '慢下来\n听听内心的声音', caption: '声音治愈时光 · 动态声波', duration: '30–120 秒', stars: 5, materials: ['口播音频', '专属封面'], platform: '小红书', sampleScript: '在快节奏的生活里，我们总在追赶别人的速度，却很少停下来倾听自己内心的声音。如果觉得累了，不妨给自己五分钟，听一首喜欢的歌，或者什么都不做。允许自己慢下来，也是一种前行的力量。', cases: [{ title: '深夜电台：写给疲惫的你', views: '演示排版案例' }] },
  { id: 'tiktok', name: 'TikTok 逐词高亮', category: '观点表达', description: '逐词变色强调，统一断行与字距，适合快节奏观点口播。', color: '#39E508', background: '#111216', heading: '10秒抓住\n全场注意力', caption: '爆款词级高光 · 弹跳字卡', duration: '15–60 秒', stars: 5, materials: ['口播文案', '人物照片'], platform: '抖音', sampleScript: '短视频黄金三秒，凭什么让用户停下划走的手指？关键就在于视觉与听觉的双重刺激。每一个重音词出现，都伴随字卡的弹性缩放与高光染色，牢牢锁住用户的视线。', cases: [{ title: '爆款开场黄金三秒技巧', views: '演示排版案例' }] },
]

const escapeXml = (value: string) => value.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!))
export function templatePreviewUrl(template: IPVideoTemplate, title = template.heading): string {
  const lines = title.split('\n').flatMap(line => Array.from(line).reduce<string[]>((rows, char, i) => { const n = Math.floor(i / 8); rows[n] = (rows[n] ?? '') + char; return rows }, [])).slice(0, 5)
  const call = template.id === 'call'
  const audiogram = template.id === 'audiogram'
  const tiktok = template.id === 'tiktok'

  // Decorate audiogram preview with wave bars
  const waveSvg = audiogram
    ? '<g fill="#00F0FF" opacity="0.85"><rect x="180" y="270" width="8" height="60" rx="4"/><rect x="200" y="250" width="8" height="100" rx="4"/><rect x="220" y="230" width="8" height="140" rx="4"/><rect x="240" y="260" width="8" height="80" rx="4"/><rect x="260" y="220" width="8" height="160" rx="4"/><rect x="280" y="240" width="8" height="120" rx="4"/><rect x="300" y="230" width="8" height="140" rx="4"/><rect x="320" y="250" width="8" height="100" rx="4"/><rect x="340" y="270" width="8" height="60" rx="4"/></g>'
    : ''

  // Decorate tiktok preview with glowing badge
  const tiktokSvg = tiktok
    ? '<rect x="44" y="230" width="180" height="42" rx="21" fill="#39E508" fill-opacity="0.2"/><text x="134" y="258" text-anchor="middle" font-size="20" font-weight="900" fill="#39E508">POP HIGHLIGHT</text>'
    : ''

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><rect width="540" height="960" fill="${template.background}"/><g fill="${template.color}" font-family="sans-serif"><text x="44" y="76" font-size="19" letter-spacing="3">${escapeXml(template.category)} / IP</text><path d="M44 104H496" stroke="${template.color}" opacity=".4"/>${call ? '<circle cx="270" cy="300" r="74" fill="none" stroke="white" stroke-width="2"/><path d="M236 290Q255 330 290 336L307 313L286 300L272 312L258 297L268 282L247 266Z" fill="white"/>' : ''}${waveSvg}${tiktokSvg}${lines.map((line, i) => `<text x="${call || audiogram ? 270 : 44}" text-anchor="${call || audiogram ? 'middle' : 'start'}" y="${call || audiogram ? 455 + i * 74 : 330 + i * 90}" font-size="${call || audiogram ? 52 : 62}" font-weight="900">${escapeXml(line)}</text>`).join('')}<text x="44" y="800" font-size="24">${escapeXml(template.caption)}</text><path d="M44 844H496" stroke="${template.color}" opacity=".4"/><text x="44" y="894" font-size="17">9:16 · ${escapeXml(template.name)}</text></g></svg>`)}`
}
