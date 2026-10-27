/** remote = 真实后端；demo = 本地演示（文案样例、人设 mock） */
export function isWorkbenchAiDemoMode(): boolean {
  return import.meta.env.VITE_WORKBENCH_AI_MODE === 'demo';
}

export function defaultChatModel(): string {
  const fromEnv = import.meta.env.VITE_CHAT_MODEL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return 'deepseek-v4-flash';
}

/**
 * 默认思考强度（2026-10-12 用户指定 low；后端 reasoning_effort 契约见 API_CONTRACTS.md）。
 *
 * 为什么默认 low 而不是 off：off 最快但会削掉多步推理（评审/结构规划这类步骤变差）；
 * low 是「稳定性优先」下的折中。实测参考（同一提示词，各 2 次）：
 * 不传 12.9s / low 16.3s / off 12.1s / high 20.0s，minimal 被上游 400 拒绝。
 *
 * 可用 VITE_CHAT_REASONING_EFFORT 覆盖；显式设为 off/none/空 时不下发该字段。
 */
export function defaultReasoningEffort(): string | undefined {
  const fromEnv = import.meta.env.VITE_CHAT_REASONING_EFFORT;
  const value = typeof fromEnv === 'string' && fromEnv.trim() ? fromEnv.trim() : 'low';
  if (value === 'off' || value === 'none') return undefined;
  return value;
}

/** 演示模式 TTS 回退（远程模式走 GET /api/v1/models/default-tts）。 */
export function demoTtsModel(): string {
  return 'qwen-audio-3.0-tts-plus';
}

export function demoPlatformVoices(): Array<{ id: string; label: string }> {
  return [
    { id: 'longanlingxin', label: '龙安灵心（女声）' },
    { id: 'longanhuan_v3.6', label: '龙安欢' },
    { id: 'longanlufeng', label: '龙安陆风（男声）' },
    { id: 'longanlingxi', label: '龙安灵犀' },
  ];
}

export function demoLipsyncModel(): string {
  return 'videoretalk';
}

export function demoVisionChatModel(): string {
  return 'qwen3.8-max';
}
