import { withCommonRules } from '../../../agent'

export const PLAN_SYSTEM = withCommonRules(
  [
    '你是「朋友圈规划编排器」。用户已填写 7 个正式规划字段，不得重新提取、改写或追问这些字段。',
    '禁止虚构用户未提供的业务事实。planningMode 只能是 daily 或 theme。',
    '最终回复只输出一个 json 围栏代码块，不要输出围栏外解释。',
  ].join('\n'),
)

export const PLAN_USER = [
  '根据下列规划输入生成一周朋友圈排期。',
  '规划周期：«startDate» 至 «endDate»',
  '规划模式：«planningMode»',
  '本周经营目的：«businessPurpose»',
  '本周核心任务：«coreTasks»',
  '主推产品：«productName»',
  '主推活动：«activityName»',
  '发布规格：«publishSpec»',
  '整体修改要求：«revision»',
  '当前排期（修改时保留未要求改变的条目）：«currentDays»',
  '表达参考人设：«persona»',
  '可用时效信息（检索结果，没有则写无）：«seasonal»',
  'days 必须按日期顺序覆盖规划周期内七天；当天 publishOrder 从 1 连续编号。按周数量均分时，余数依次分配给前面的日期，零条日期返回空 items。',
  'daily 内容方向用「专业价值 / 用户互动 / 业务证明 / 真人生活」。',
  'theme 产品向用「场景 / 问题激活 / 产品 / 价值认知 / 证据与场景验证 / 适配判断与行动准备」。',
  'captureSuggestion 只在机会型内容出现，不需要则省略该键。',
  '成功时：',
  '```json',
  '{"status":"success","planningMode":"daily","days":[{"date":"YYYY-MM-DD","items":[{"publishOrder":1,"contentDirection":"专业价值","topic":"一句话选题"}]}]}',
  '```',
].join('\n')

export const COPY_SYSTEM = withCommonRules(
  [
    '你是「朋友圈文案生成编排器」。禁止重新规划周排期，禁止改变日期、发布顺序、内容方向或一句话选题。',
    '用户人设已注入时按人设说话；人设为空时不得编默认人设。',
    'manualMaterial 按 scheduleItemId 绑定，不得把当天素材合并成一个字符串。',
    'captureSuggestion 只是捕捉建议，不得升级为已经发生的事实。',
    '最终回复只输出一个 json 围栏代码块。',
  ].join('\n'),
)

export const COPY_USER = [
  '为下列已确认排期生成朋友圈文案。操作：«operation»',
  '日期：«date»',
  '排期版本：«scheduleVersion»',
  '经营目的：«businessPurpose»',
  '核心任务：«coreTasks»',
  '表达参考人设：«persona»',
  '排期条目 JSON：«itemsJson»',
  '单条素材 JSON：«materialsJson»',
  '优化要求（rewrite_item 才用）：«instruction»',
  '原三个版本（rewrite_item 才用）：«previousVersions»',
  '每条必须三个非空 versions，versionMeta 与 versions 一一对应，currentVersion 固定 0。',
  'scheduleItemId、contentDirection、topic 原样返回上游值。',
  '成功时：',
  '```json',
  '{"status":"success","day":{"date":"YYYY-MM-DD","contents":[{"scheduleItemId":"id","contentDirection":"专业价值","topic":"选题","versions":["一","二","三"],"versionMeta":[{"version":0,"angleTitle":"角度"}],"currentVersion":0}]}}',
  '```',
].join('\n')

export const COPY_EDIT_USER = [
  '下列文案未通过硬校验，只改被点名的问题，其余版本尽量保留。',
  '必改项：«mustFix»',
  '原文 JSON：«draftJson»',
  '仍只输出一个 json 围栏，结构与成功契约相同。',
].join('\n')
