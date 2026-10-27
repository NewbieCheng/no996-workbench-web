/**
 * 流式展示过滤器：把模型的 **JSON 增量流** 变成「人话」增量流。
 *
 * 为什么需要它
 * ------------
 * 编剧 / 写手的返回体是 JSON，例如
 *   {"segments":[{"id":"1","spoken":"你有没有过这种时候…","visual":"…"}]}
 * 若把内核给的 chunk 原样透到界面，用户看到的是花括号、方括号、反斜杠转义 ——
 * 既难看，也等于把内部结构摊开给用户看。
 *
 * 用户从流式里真正需要的只有一件事：**字在长出来**，等待是有着落的。
 * 所以这里只抽出指定字段（spoken / title …）的字符串值、解码转义，
 * 其余 JSON 语法一律丢弃。
 *
 * 关键性质（也是测试盯住的点）
 * ---------------------------
 * - **与切分无关**：任意把同一份 JSON 切成若干 chunk，输出必须完全一致。
 *   模型是逐 token 推的，`"spok` / `en":"你` 这种半截 key、半截转义都会出现。
 * - **绝不吐出 JSON 语法**：输出里不允许出现 `{` `}` `[` `]` `"` 或 key 名。
 * - **绝不抛错**：垃圾输入、被截断的输入都只是少显示几个字而已。
 */

/** JSON 字符串转义 → 展示字符。控制类转义直接吃掉，避免出现方框字符。 */
const ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  n: '\n',
  t: '\t',
  r: '',
  b: '',
  f: '',
}

export type TextStreamFilterOptions = {
  /** 要抽出来展示的 JSON 字段名，精确匹配 */
  keys?: string[]
  /** 相邻两个字段值之间的分隔符，默认换行 */
  separator?: string
}

export type TextStreamFilter = {
  /** 喂入一段模型增量，返回**可直接展示**的增量文本（可能为空串） */
  push: (chunk: string) => string
  /** 收尾。正常情况下没有残留，返回空串 */
  flush: () => string
}

type Phase = 'seek' | 'key' | 'valueStart' | 'value' | 'skip'

export function createTextStreamFilter(options: TextStreamFilterOptions = {}): TextStreamFilter {
  const keys = new Set(options.keys ?? ['spoken'])
  const separator = options.separator ?? '\n'

  let buf = ''
  let phase: Phase = 'seek'
  let key = ''
  /** 当前值是否是要展示的字段 */
  let emit = false
  /** 还没展示过任何值（用于决定要不要插分隔符） */
  let first = true
  /**
   * 当前这个值是否已经吐出过字符。
   *
   * 分隔符必须插在**值的开头**，而且只能插一次 —— 值被切在两个 chunk 之间时，
   * 第二次进入 value 阶段不能又插一遍。所以这里单独记一个标志，
   * 而不是用「本次 push 里 out 有没有变长」来判断。
   */
  let valueHasText = false

  function push(chunk: string): string {
    buf += chunk
    let out = ''

    // 状态机推进：缓冲不够就退出，等下一个 chunk
    for (;;) {
      if (phase === 'seek') {
        const j = buf.indexOf('"')
        if (j < 0) {
          buf = ''
          break
        }
        buf = buf.slice(j + 1)
        phase = 'key'
        key = ''
        continue
      }

      if (phase === 'key') {
        const j = buf.indexOf('"')
        if (j < 0) {
          // JSON 的 key 里不会有转义；超长说明这不是我们要的输入，放弃这一段
          if (buf.length > 200) {
            buf = ''
            phase = 'seek'
          }
          break
        }
        key = buf.slice(0, j)
        buf = buf.slice(j + 1)
        phase = 'valueStart'
        continue
      }

      if (phase === 'valueStart') {
        // 跳到 key 与字符串值之间的冒号
        let k = 0
        while (k < buf.length && buf[k] === ' ') k += 1
        if (k >= buf.length) {
          // 全是空白：丢掉即可（冒号前空白无意义）
          buf = ''
          break
        }
        buf = buf.slice(k)
        const ch = buf[0]
        if (ch === ':') {
          buf = buf.slice(1)
          continue
        }
        if (ch === '"') {
          emit = keys.has(key)
          valueHasText = false
          buf = buf.slice(1)
          phase = emit ? 'value' : 'skip'
          continue
        }
        // 数字 / 布尔 / 对象 / 数组：本字段不展示，回到找下一个 key
        phase = 'seek'
        continue
      }

      if (phase === 'skip') {
        let i = 0
        let done = false
        while (i < buf.length) {
          if (buf[i] === '\\') {
            if (i + 1 >= buf.length) break
            i += 2
            continue
          }
          if (buf[i] === '"') {
            done = true
            break
          }
          i += 1
        }
        buf = buf.slice(i)
        if (!done) break
        buf = buf.slice(1)
        phase = 'seek'
        continue
      }

      // phase === 'value'：逐字符解码字符串值
      const mark = out.length
      let i = 0
      let closed = false
      while (i < buf.length) {
        const ch = buf[i]
        if (ch === '\\') {
          if (i + 1 >= buf.length) break // 转义被截断，等下一个 chunk
          const next = buf[i + 1]
          if (next === 'u') {
            if (i + 6 > buf.length) break // \uXXXX 不完整
            const hex = buf.slice(i + 2, i + 6)
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              out += String.fromCharCode(parseInt(hex, 16))
              i += 6
              continue
            }
            i += 2
            continue
          }
          out += ESCAPE_MAP[next] ?? next
          i += 2
          continue
        }
        if (ch === '"') {
          closed = true
          break
        }
        out += ch
        i += 1
      }
      buf = buf.slice(i)

      // 本值第一次出字：把分隔符插在值的前面（而不是追加到末尾），
      // 并且只插一次 —— 值跨 chunk 时后面的分片不再插
      if (out.length > mark && !valueHasText) {
        if (!first) out = out.slice(0, mark) + separator + out.slice(mark)
        first = false
        valueHasText = true
      }

      if (!closed) break // 值还没结束，等下一个 chunk
      buf = buf.slice(1)
      phase = 'seek'
      continue // 本值已结束，继续处理缓冲里剩下的内容
    }

    return out
  }

  return {
    push,
    flush() {
      buf = ''
      phase = 'seek'
      key = ''
      emit = false
      valueHasText = false
      return ''
    },
  }
}

/**
 * 便捷包装：把 flow 的 `onDelta` 换成「只推可展示文本」的版本。
 *
 * 作用是把「提示词/结构不外泄」这条产品约束**下沉到一处**，
 * 各 flow 不必自己判断哪些字段能显示。
 */
export function createDisplayDelta(
  onDelta: ((chunk: string) => void) | undefined,
  keys: string[] = ['spoken'],
  separator = '\n',
): ((chunk: string) => void) | undefined {
  if (!onDelta) return undefined
  const filter = createTextStreamFilter({ keys, separator })
  return (chunk: string) => {
    const text = filter.push(chunk)
    if (text) onDelta(text)
  }
}
