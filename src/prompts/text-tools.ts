export type ToolId = 'titles'
export type PromptField = { name: string; label: string; required?: boolean; multiline?: boolean; options?: string[]; example: string }
export type ToolSpec = { title: string; description: string; fields: PromptField[] }
// Adapted field definitions and prompt intent; see MIGRATION_PROVENANCE.md. No model endpoint or credential code is included.
// 说明：视频脚本 / 直播脚本已迁至 src/features/script-lab（Agent 引擎），
// 此处仅保留爆款标题的表单规格，供任务中心显示功能名与旧任务标题解析。
// 提示词构建函数（buildTextPrompt / initialValues）随旧页面一并删除：
// 标题现在走 features/titles/agent 的 agent 流程，不再用这里的字符串拼接。
export const tools: Record<ToolId, ToolSpec> = {
  titles: { title: '爆款标题', description: '围绕主题、受众与平台整理候选标题；演示内容不承诺传播效果。', fields: [
    { name: 'topic', label: '内容主题', required: true, example: '小团队如何建立短视频选题流程' },
    { name: 'audience', label: '目标受众', required: true, example: '小微企业主与内容运营新人' },
    { name: 'platform', label: '发布平台', options: ['抖音', '小红书', '视频号', '公众号', 'B站'], example: '抖音' },
    { name: 'tone', label: '标题语气', options: ['直接有力', '好奇悬念', '专业可信', '轻松亲切'], example: '专业可信' },
    { name: 'count', label: '生成数量', options: ['3', '5', '8', '10'], example: '5' },
  ] },
}
