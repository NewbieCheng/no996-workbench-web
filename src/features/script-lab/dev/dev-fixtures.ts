/**
 * 开发调试专享示例数据（Dev Fixtures）
 *
 * 仅供本地开发调试（import.meta.env.DEV）快速填充复杂长字段与一键模拟完整生成结果，
 * 生产构建（npm run build）会直接被 tree-shaking 消除，绝不打包至线上服务器。
 */
import type { ScriptConfig, ScriptGeneratePayload } from '../agent/types.ts'

export const DEV_VIDEO_SCRIPT_FIXTURE: Partial<ScriptConfig> = {
  product: '郭小满水煮肉片调料包',
  durationSec: 60,
  goal: '成交',
  platform: '抖音',
  structure: {
    kind: 'custom',
    text: '生活场景 + 操作演示 + 卖点与证据 + 自然引导',
  },
  intro: '一包搞定地道川味，含特调腌肉料包与醇香红油酱包，免去繁琐备料。',
  audience: '下班想自己做饭的年轻人、家庭掌勺人、爱吃川菜但怕麻烦的人',
  sellingPoints: '一料多用，水煮肉片、水煮鱼、冒菜都能做；精选郫县豆瓣与醇香牛油；配料干净0反式脂肪酸。',
  pain: '中秋聚餐想给家人做道大菜，自己调味备料太麻烦买不齐；外卖重油重盐不放心；火候味道总调不准。',
  strength: 60,
  refGood: '口播自然，接地气，像朋友之间分享做饭技巧，不生硬推销。',
}

export const DEV_LIVE_SCRIPT_FIXTURE: Partial<ScriptConfig> = {
  product: '郭小满川味调味全家桶',
  durationSec: 1800,
  goal: '成交',
  platform: '抖音',
  structure: {
    kind: 'auto',
  },
  intro: '5大川味名菜调料组合（水煮肉片/麻婆豆腐/酸菜鱼/毛血旺/宫保鸡丁），厨房小白秒变大厨。',
  audience: '家庭主妇、做饭新手、热爱川味美食的租房党',
  sellingPoints: '一包成菜无需复杂调味，大厨级黄金配比，醇香地道，宴客做饭省时大半。',
  pain: '平时做饭调料买一堆积灰放过期，下馆子一顿几百块，厨房做饭满头大汗还不好吃。',
  offer: '今天直播间专属：拍全家桶大号套装，加赠加厚防烫硅胶锅铲与密封收纳盒。',
  interactionNodes: 4,
  strength: 70,
}

/** 视频脚本调试成稿结果 Mock（方便调样式与分镜） */
export const DEV_VIDEO_RESULT_MOCK: ScriptGeneratePayload = {
  config: {
    mode: 'video',
    product: '郭小满水煮肉片调料包',
    durationSec: 60,
    goal: '成交',
    platform: '抖音',
    structure: {
      kind: 'custom',
      text: '生活场景 + 操作演示 + 卖点与证据 + 自然引导',
    },
    audience: '下班想自己做饭的年轻人、家庭掌勺人',
    sellingPoints: '一料多用，配料干净0反式脂肪酸',
    pain: '做水煮肉片调料繁琐买不齐',
    strength: 60,
  },
  segments: [
    {
      id: 'seg-1',
      name: '生活场景',
      purpose: '家庭情境与做饭痛点代入',
      share: 0.22,
      startSec: 0,
      endSec: 13,
      spoken: '马上到中秋了，想给家人做道地道的水煮肉片，但自己备料花椒辣椒豆瓣酱买一堆，又贵又麻烦。后来我试了这个省事的方法。',
      visual: '家庭厨房近景，桌上摊开各种零散调料罐，随后镜头切换至煮妇洗菜切肉的温馨画面',
      libraryIds: ['custom-structure'],
      versions: [
        { round: 1, spoken: '马上到中秋了，想给家人做道地道的水煮肉片，但自己备料花椒辣椒豆瓣酱买一堆，又贵又麻烦。后来我试了这个省事的方法。' }
      ]
    },
    {
      id: 'seg-2',
      name: '操作演示',
      purpose: '展示省时省力的做饭过程',
      share: 0.35,
      startSec: 13,
      endSec: 34,
      spoken: '肉片用里面的腌肉包抓匀上浆，锅里热油爆香酱包，加水煮沸下豆芽垫底。肉片滑散烫熟，连汤带肉倒在大碗里，热油一泼，香味立马窜出来！',
      visual: '调料下锅特写，红油翻滚冒泡，肉片滑入汤中快速变色，热油淋在干辣椒上的滋滋特写镜头',
      libraryIds: ['custom-structure'],
      versions: [
        { round: 1, spoken: '肉片用里面的腌肉包抓匀上浆，锅里热油爆香酱包，加水煮沸下豆芽垫底。肉片滑散烫熟，连汤带肉倒在大碗里，热油一泼，香味立马窜出来！' }
      ]
    },
    {
      id: 'seg-3',
      name: '卖点与证据',
      purpose: '配料事实与省心利益',
      share: 0.25,
      startSec: 34,
      endSec: 49,
      spoken: '味道正不正先看配料表，用足量郫县豆瓣和浓香牛油，0反式脂肪酸，配料干净吃着放心。关键是一料多用，水煮鱼、冒菜、水煮牛肉一包搞定。',
      visual: '特写翻转展示调料包背后的干净配料表，旁边摆放水煮鱼与冒菜的精美成品拼图',
      libraryIds: ['custom-structure'],
      versions: [
        { round: 1, spoken: '味道正不正先看配料表，用足量郫县豆瓣和浓香牛油，0反式脂肪酸，配料干净吃着放心。关键是一料多用，水煮鱼、冒菜、水煮牛肉一包搞定。' }
      ]
    },
    {
      id: 'seg-4',
      name: '自然引导',
      purpose: '品尝成菜与轻量购买建议',
      share: 0.18,
      startSec: 49,
      endSec: 60,
      spoken: '肉片鲜嫩麻辣入味，孩子直夸比饭馆还好吃。中秋给家人露一手，想吃随时做，平时爱吃川味的可以在家备上两包。',
      visual: '一家人围坐餐桌夹肉吃得津津有味，全景温馨家庭聚餐画面，右下角淡入产品包封面',
      libraryIds: ['custom-structure'],
      versions: [
        { round: 1, spoken: '肉片鲜嫩麻辣入味，孩子直夸比饭馆还好吃。中秋给家人露一手，想吃随时做，平时爱吃川味的可以在家备上两包。' }
      ]
    }
  ],
  rounds: [
    {
      round: 1,
      retentionPoints: [100, 85, 78, 74],
      averageRetention: 84,
      conversion: 76,
      composite: 80,
    }
  ],
  hardCheck: {
    pass: true,
    hits: [],
    charCount: 242,
  },
  review: {
    items: [
      { segmentId: 'seg-1', retention: 85, primaryIssue: '生活情境代入自然', improvementDirection: '保持接地气', mustFix: false },
      { segmentId: 'seg-2', retention: 78, primaryIssue: '做饭画面食欲感充足', improvementDirection: '下锅特写清晰', mustFix: false },
      { segmentId: 'seg-3', retention: 75, primaryIssue: '配料表真实可信', improvementDirection: '突出0反式脂肪酸', mustFix: false },
      { segmentId: 'seg-4', retention: 74, primaryIssue: '收尾温馨克制', improvementDirection: '自然引导适度', mustFix: false },
    ],
    hookStrength: 82,
    conversion: 76,
  },
}

/** 直播脚本调试成稿结果 Mock（方便调导播台样式） */
export const DEV_LIVE_RESULT_MOCK: ScriptGeneratePayload = {
  config: {
    mode: 'live',
    product: '郭小满川味调味全家桶',
    durationSec: 1800,
    goal: '成交',
    platform: '抖音',
    structure: { kind: 'auto' },
    audience: '家庭主妇、做饭新手',
    sellingPoints: '一包成菜，大厨级黄金配比',
    offer: '今天直播间加赠硅胶锅铲',
    strength: 70,
  },
  segments: [
    {
      id: 'seg-1',
      name: '开场暖场',
      purpose: '建立信任，留住观众',
      share: 0.1,
      startSec: 0,
      endSec: 180,
      spoken: '欢迎刚进直播间的朋友们！平时想吃川菜是不是总觉得备料太麻烦？今天这场给各位厨房新手带来做饭救星，先把关注点一点，后面还有专属大礼包送给大家！',
      action: '主播手持调料包热情招手，引导右上角点关注，助理在背景展示热气腾腾的水煮肉片',
      nodes: [{ type: '互动', action: '引导新进直播间观众点关注，并在评论区打出想吃什么菜' }],
      libraryIds: ['live-five-chapter'],
      versions: [
        { round: 1, spoken: '欢迎刚进直播间的朋友们！平时想吃川菜是不是总觉得备料太麻烦？今天这场给各位厨房新手带来做饭救星，先把关注点一点，后面还有专属大礼包送给大家！' }
      ]
    },
    {
      id: 'seg-2',
      name: '产品介绍',
      purpose: '讲清价值与购买理由',
      share: 0.25,
      startSec: 180,
      endSec: 630,
      spoken: '看好这套川味全家桶，包含了水煮肉片、酸菜鱼、麻婆豆腐、毛血旺和宫保鸡丁五大名菜调料！每一包都是老师傅按黄金配比研制，一料多用，不用你自己买齐二十多种香料调料。',
      action: '主播逐一展示五款调料包外包装，镜头推近给特写，助理在一旁准备开火做菜工具',
      nodes: [{ type: '演示', action: '打开调料包展示醇厚酱料质地与油润光泽' }],
      libraryIds: ['live-five-chapter'],
      versions: [
        { round: 1, spoken: '看好这套川味全家桶，包含了水煮肉片、酸菜鱼、麻婆豆腐、毛血旺和宫保鸡丁五大名菜调料！每一包都是老师傅按黄金配比研制，一料多用，不用你自己买齐二十多种香料调料。' }
      ]
    },
    {
      id: 'seg-3',
      name: '痛点共鸣',
      purpose: '用真实场景拉近距离',
      share: 0.2,
      startSec: 630,
      endSec: 990,
      spoken: '平时我们去川菜馆一顿两三百，自己在厨房折腾两小时满头大汗还做不出内味儿。有了这个料包，肉片一腌、大火一滚、热油一淋，十分钟比饭馆还香，家里老人小孩吃得放心。',
      action: '现场实操下锅烹饪，热气腾腾，出锅装盘让现场工作人员试吃并给出真实赞叹',
      nodes: [{ type: '互动', action: '询问评论区观众平时自己做水煮肉片最大的烦恼是什么' }],
      libraryIds: ['live-five-chapter'],
      versions: [
        { round: 1, spoken: '平时我们去川菜馆一顿两三百，自己在厨房折腾两小时满头大汗还做不出内味儿。有了这个料包，肉片一腌、大火一滚、热油一淋，十分钟比饭馆还香，家里老人小孩吃得放心。' }
      ]
    },
    {
      id: 'seg-4',
      name: '促单环节',
      purpose: '承接优惠与信任背书',
      share: 0.3,
      startSec: 990,
      endSec: 1530,
      spoken: '今天直播间给大家安排了专属福利：拍全套全家桶大号套装，直接加赠价值39元的定制加厚防烫硅胶锅铲一把！配料表干净0反式脂肪，买得省心用得舒心。',
      action: '主播展示赠品锅铲，并在白板上展示拍下福利清单，场控倒数上链接',
      nodes: [
        { type: '福利', action: '亮出赠品硅胶锅铲与限量加赠活动' },
        { type: '促单', action: '引导观众点击下方小黄车直接拍下全家桶套装' }
      ],
      libraryIds: ['live-five-chapter'],
      versions: [
        { round: 1, spoken: '今天直播间给大家安排了专属福利：拍全套全家桶大号套装，直接加赠价值39元的定制加厚防烫硅胶锅铲一把！配料表干净0反式脂肪，买得省心用得舒心。' }
      ]
    },
    {
      id: 'seg-5',
      name: '复盘收尾',
      purpose: '总结重点，引导关注',
      share: 0.15,
      startSec: 1530,
      endSec: 1800,
      spoken: '刚拍下的朋友在公屏扣个“已拍”，我们优先给您安排现货顺丰发出。没抢到的朋友点点关注，下一轮福利马上开启！',
      action: '主播查看后台订单，感谢已下单粉丝并念出昵称，预告下轮福利',
      nodes: [{ type: '互动', action: '互动念下单粉丝昵称，引导未关注的朋友点关注' }],
      libraryIds: ['live-five-chapter'],
      versions: [
        { round: 1, spoken: '刚拍下的朋友在公屏扣个“已拍”，我们优先给您安排现货顺丰发出。没抢到的朋友点点关注，下一轮福利马上开启！' }
      ]
    }
  ],
  rounds: [
    {
      round: 1,
      retentionPoints: [100, 88, 80, 75, 70],
      averageRetention: 82,
      conversion: 78,
      composite: 80,
    }
  ],
  hardCheck: {
    pass: true,
    hits: [],
    charCount: 420,
  },
  review: {
    items: [
      { segmentId: 'seg-1', retention: 88, primaryIssue: '节奏紧凑互动自然', improvementDirection: '继续保持', mustFix: false },
      { segmentId: 'seg-2', retention: 80, primaryIssue: '展示清晰', improvementDirection: '继续保持', mustFix: false },
      { segmentId: 'seg-3', retention: 76, primaryIssue: '痛点真实', improvementDirection: '继续保持', mustFix: false },
      { segmentId: 'seg-4', retention: 75, primaryIssue: '活动清晰明确', improvementDirection: '继续保持', mustFix: false },
      { segmentId: 'seg-5', retention: 70, primaryIssue: '收尾自然', improvementDirection: '继续保持', mustFix: false },
    ],
    hookStrength: 85,
    conversion: 80,
  },
}
