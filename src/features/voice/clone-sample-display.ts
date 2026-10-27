/** 克隆向导样本区展示名（完整文件名见 `title` / 上传 File.name）。 */
export function cloneSampleDisplayName(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '')
  if (base === '录音样本' || /^voice-sample-\d+$/i.test(base)) {
    return '录音样本'
  }
  return '样本'
}
