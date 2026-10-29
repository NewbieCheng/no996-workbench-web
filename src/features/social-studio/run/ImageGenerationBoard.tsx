import { CheckCircle2Icon, ImageIcon, Loader2Icon, SparklesIcon } from 'lucide-react'

export type ImageGenerationBoardProps = {
  plans?: Array<{ titleText?: string; role?: string }>
  imageUrls: string[]
  progress: { done: number; total: number }
  running: boolean
  textOnly?: boolean
}

/**
 * 右侧配图生成板：按规划槽位展示“排队中 / 生成中 / 已完成 / 失败”。
 *
 * 只做业务可视化，不计算总进度；总进度由 AgentProgress / 任务 meta 提供。
 */
export function ImageGenerationBoard({
  plans = [],
  imageUrls,
  progress,
  running,
  textOnly = false,
}: ImageGenerationBoardProps) {
  const total = Math.max(progress.total, plans.length, imageUrls.length)
  if (textOnly || total === 0) {
    return (
      <div className="sc-image-board sc-image-board--empty">
        <ImageIcon className="size-5" aria-hidden="true" />
        <p>{textOnly ? '本次只交付文案，不生成排版配图。' : '本次没有配图规划。'}</p>
      </div>
    )
  }

  const slots = Array.from({ length: total }, (_, index) => {
    const url = imageUrls[index]
    const isGenerating =
      running && !url && progress.done < total && index === progress.done
    const isDone = Boolean(url) || index < progress.done
    const isFailed = !running && !url && index >= progress.done
    return { index, url, isGenerating, isDone, isFailed, plan: plans[index] }
  })

  return (
    <div className="sc-image-board" aria-label="配图生成进度">
      <div className="sc-image-board__head">
        <strong>配图生成</strong>
        <span>
          {progress.done}/{total} 张
        </span>
      </div>
      <div className="sc-image-board__grid">
        {slots.map((slot) => (
          <div
            key={slot.index}
            className="sc-image-board__slot"
            data-state={
              slot.url
                ? 'done'
                : slot.isGenerating
                  ? 'generating'
                  : slot.isDone
                    ? running
                      ? 'done'
                      : 'failed'
                    : slot.isFailed
                      ? 'failed'
                      : 'queued'
            }
          >
            {slot.url ? (
              <img src={slot.url} alt={`配图 ${slot.index + 1}`} />
            ) : (
              <div className="sc-image-board__placeholder">
                {slot.isGenerating ? (
                  <>
                    <Loader2Icon className="size-6 animate-spin" aria-hidden="true" />
                    <span>生成中…</span>
                  </>
                ) : slot.isDone ? (
                  <>
                    <CheckCircle2Icon className="size-6" aria-hidden="true" />
                    <span>已生成</span>
                  </>
                ) : slot.isFailed ? (
                  <>
                    <ImageIcon className="size-6" aria-hidden="true" />
                    <span>生成失败</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="size-6" aria-hidden="true" />
                    <span>排队中</span>
                  </>
                )}
              </div>
            )}
            <div className="sc-image-board__meta">
              <span>
                {slot.plan?.role === 'cover'
                  ? '封面'
                  : `图 ${slot.index + 1}`}
              </span>
              {slot.url ? <CheckCircle2Icon className="size-3.5" aria-hidden="true" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
