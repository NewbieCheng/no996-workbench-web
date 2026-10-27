import type { StructuredDocumentSection } from '@no996/ui/structured-document';
import { StructuredDocument } from '@no996/ui/structured-document';

export const STRUCTURED_DOCUMENT_DEMO_SECTIONS: StructuredDocumentSection[] = [
  {
    id: 'summary',
    title: '1. 核心洞察摘要',
    subtitle: '一句话说清产品本质',
    layout: 'summary-grid',
    items: [
      {
        id: 's1',
        title: 'IP 驱动的情绪道具',
        content: '第一购买理由来自哆啦A梦童年符号，而非飞行能力。',
      },
      {
        id: 's2',
        title: '人群双结构',
        content: '18–35 岁怀旧成人 + 3–10 岁孩子家长，动机完全不同。',
      },
      {
        id: 's3',
        title: '情绪先于功能',
        content: '先讲「童年动画道具握在手里」，再讲怎么飞。',
      },
      {
        id: 's4',
        title: '社交货币属性',
        content: '开箱、摆拍、晒图是重要传播触点。',
      },
      {
        id: 's5',
        title: '价格敏感度分层',
        content: '成人愿为情绪溢价，家长更看安全与耐玩。',
      },
    ],
  },
  {
    id: 'target_audience',
    title: '2. 优先沟通人群',
    subtitle: '先跟谁说话',
    layout: 'audience-grid',
    items: [
      {
        id: 'a1',
        title: '30–42岁职场人',
        content: '有稳定哆啦A梦记忆，愿为情绪与收藏买单，易被「童年兑现」打动。',
      },
      {
        id: 'a2',
        title: '25–35岁内容创作者',
        content: '需要话题道具做开箱与短视频，重视外观辨识度与拍摄效果。',
      },
      {
        id: 'a3',
        title: '3–10岁孩子家长',
        content: '关注安全、耐摔与是否「真的好玩」，对 IP 有信任加成。',
      },
    ],
  },
  {
    id: 'needs_pain_points',
    title: '3. 核心需求与痛点',
    subtitle: '用户为什么需要',
    layout: 'list-stack',
    rowGroup: 'analysis-trio',
    items: [
      {
        id: 'n1',
        title: '情绪补偿',
        content: '工作压力大，需要低成本获得「童年被找回」的瞬间。',
      },
      {
        id: 'n2',
        title: '社交表达',
        content: '想要一个好看、好讲、好晒的桌面/礼物道具。',
      },
    ],
  },
  {
    id: 'scenarios',
    title: '4. 消费场景与触发',
    subtitle: '什么时候想买',
    layout: 'pill-stack',
    rowGroup: 'analysis-trio',
    items: [
      {
        id: 'sc1',
        title: '触发场景',
        content: '- 刷到哆啦A梦联名内容\n- 朋友晒桌面摆件\n- 节日送礼清单',
      },
    ],
  },
  {
    id: 'value_selling_points',
    title: '5. 产品价值与卖点',
    subtitle: '凭什么选你',
    layout: 'chain-stack',
    rowGroup: 'analysis-trio',
    items: [
      {
        id: 'v1',
        title: '机制链',
        content: '正版 IP 授权 → 还原动画造型 → 可玩飞行体验 → 情绪价值兑现',
      },
    ],
  },
  {
    id: 'objections_friction',
    title: '6. 购买顾虑与阻力',
    subtitle: '下单前犹豫什么',
    layout: 'objections-grid',
    items: [
      { id: 'o1', title: '像玩具?', content: '担心幼稚、不适合办公室摆放。' },
      { id: 'o2', title: '能飞多久?', content: '质疑续航与耐玩性。' },
      { id: 'o3', title: '值这个价?', content: '与普通竹蜻蜓比价，忽略情绪溢价。' },
    ],
  },
  {
    id: 'communication_strategy',
    title: '7. 沟通建议主线',
    subtitle: '对外怎么说',
    layout: 'strategy-hero',
    items: [
      {
        id: 'c1',
        title: '核心沟通主题',
        content: '**「童年动画里的道具，真的握在手里。」** 先情绪，再功能。',
      },
      {
        id: 'c2',
        title: '补充要点',
        content: '强调正版授权与还原度，用实拍视频打消「玩具感」顾虑。',
      },
    ],
  },
];

export function StructuredDocumentStandardsDemo() {
  return (
    <div className="assets-structured-document-stage">
      <div className="assets-structured-document-demo">
        <StructuredDocument sections={STRUCTURED_DOCUMENT_DEMO_SECTIONS} mode="read" />
      </div>
    </div>
  );
}
