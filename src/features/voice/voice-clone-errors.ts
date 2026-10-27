/** 将后端/厂商原始错误转为用户可理解的说明（不改变 HTTP 状态与任务失败事实）。 */
export function humanizeVoiceCloneError(raw: string): string {
  const msg = raw.trim()
  if (!msg) return '声音克隆失败，请稍后重试。'

  if (/InputDownloadFailed|download audio failed/i.test(msg)) {
    const trace = /trace:\s*([^\s)]+)/i.exec(msg)?.[1]
    return [
      '克隆服务无法下载你的声音样本（样本链接返回 404 或不可公网访问）。',
      '这通常是服务端对象存储/临时 URL 未配置好，不是录音文件本身坏了。',
      '请联系管理员检查声音复刻的音频存储与公网可读配置，或稍后在任务中心重试。',
      trace ? `（trace: ${trace}）` : '',
    ]
      .filter(Boolean)
      .join('')
  }

  if (/VOICE_CLONE_NOT_CONFIGURED/i.test(msg)) {
    return msg
  }

  if (/voiceclone:\s*provider rejected/i.test(msg)) {
    return humanizeVoiceCloneError(msg.replace(/^voiceclone:\s*provider rejected the request:\s*/i, ''))
  }

  return msg
}
