import type { MockResponder } from '../../../agent/mock-clients'

export function createSocialRewriteMockResponder(): MockResponder {
  return (request) => {
    const hint = request.stageHint || ''
    if (hint === 'rewrite-pass1') {
      return '## 演示第一遍\n\n这是按设定弱化营销腔后的演示稿，保留原文论点顺序，方便预览左栏排版。\n\n## 小节\n\n补充一句可执行的读者行动建议。'
    }
    if (hint === 'rewrite-pass2') {
      return JSON.stringify({
        titles: ['演示标题 A：为什么你天天发内容却没线索', '演示标题 B：内容发了没人问？先改这三处', '演示标题 C：把公众号写成对话，而不是公告'],
        body: '## 第二遍演示正文\n\n更像真人在聊天：先承认读者的挫败感，再给两步能今天就开始的改法。\n\n## 收尾\n\n你会先试哪一步？',
      })
    }
    return null
  }
}
