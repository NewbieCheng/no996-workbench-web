import { useEffect, useRef } from 'react'
import './agent-motion.css'

export type StreamingTextProps = {
  text: string
  className?: string
  /** 首屏一次给很多字时，只让最后一段逐字出现，避免上百个节点同时动画。 */
  animateTail?: number
}

/**
 * 流式打字：新到的字逐字从 blur(6px) 到清晰，相邻字错开 30ms。
 *
 * 已经出现过的字保持静止，只给“新增部分”加动画；否则每次轮询都整段重播，
 * 看起来会一直闪。动画时长与缓动写死在 agent-motion.css，和设计原则同源。
 */
export function StreamingText({ text, className, animateTail = 160 }: StreamingTextProps) {
  const previousLengthRef = useRef(0)
  const chars = Array.from(text)

  if (chars.length < previousLengthRef.current) previousLengthRef.current = 0

  const stableCount = Math.min(previousLengthRef.current, chars.length)
  const fresh = chars.slice(stableCount)
  const animateFrom = Math.max(0, fresh.length - animateTail)
  const stable = chars.slice(0, stableCount + animateFrom).join('')
  const animated = fresh.slice(animateFrom)

  useEffect(() => {
    previousLengthRef.current = chars.length
  }, [chars.length])

  return (
    <span className={`agent-streaming-text${className ? ` ${className}` : ''}`} aria-live="polite">
      {stable}
      {animated.map((char, index) => (
        <span
          key={`${stableCount + animateFrom + index}-${char}`}
          className="agent-streaming-char"
          style={{ animationDelay: `${Math.min(index, 40) * 30}ms` }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}
