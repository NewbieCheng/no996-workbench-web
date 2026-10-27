export type WordToken = {
  text: string
  start: number
  end: number
  index: number
}

export type AlignedSentence = {
  text: string
  start: number
  end: number
  words: WordToken[]
}

export type AlignedTimeline = {
  duration: number
  sentences: AlignedSentence[]
  allWords: WordToken[]
}

export type TimelineFrameState = {
  sentenceIndex: number
  currentSentence?: AlignedSentence
  prevSentence?: AlignedSentence
  nextSentence?: AlignedSentence
  activeWordIndex: number
  activeWord?: WordToken
  sentenceProgress: number
}

/**
 * Tokenize a sentence into individual characters or English words.
 * Chinese characters are split individually for word-by-word pop / karaoke effect.
 * English words, numbers, and Latin phrases stay as coherent tokens.
 */
export function tokenizeSentenceText(text: string): string[] {
  if (!text) return []
  // Matches English/alphanumeric words or individual CJK/emoji/other characters
  const tokenRegex = /[a-zA-Z0-9_]+|[\u4e00-\u9fa5]|[\u3040-\u30ff]|[\uac00-\ud7af]|[\p{Emoji}\p{Symbol}]|[^\s]/gu
  const tokens: string[] = text.match(tokenRegex) ?? []
  return tokens.filter(t => t.trim().length > 0)
}

/**
 * Token weight calculation for speech duration distribution.
 * Commas and pause punctuation have minimal speech weight because their pause is accounted for separately.
 */
function tokenWeight(token: string): number {
  if (/^[，,、；;]$/.test(token)) return 0.2
  if (/^[。！？!?]$/.test(token)) return 0.25
  // English words: slightly longer based on syllable rough estimate
  if (/^[a-zA-Z0-9]+$/.test(token)) return Math.max(1, token.length * 0.4)
  return 1
}

/**
 * Split raw script into well-proportioned sentences.
 * Splits on full stops (。！？!?\n) and breaks extra-long clauses at commas (，、；;) to maintain optimal short-video reading cadence (10-18 chars).
 */
export function splitSentences(script: string): string[] {
  const cleaned = script.trim()
  if (!cleaned) return []

  // Split primarily on sentence boundaries and newlines
  const rawSegments = (cleaned.match(/[^。！？!?\n]+[。！？!?\n]*/gu) ?? [])
    .map(s => s.trim())
    .filter(Boolean)

  const sentences: string[] = []

  for (const seg of rawSegments) {
    // If a segment is longer than 22 characters and contains clause punctuation, break at commas
    if (seg.length > 22 && /[，,、；;]/.test(seg)) {
      const subClauses = (seg.match(/[^，,、；;]+[，,、；;]*/gu) ?? [])
        .map(s => s.trim())
        .filter(Boolean)
      
      let buffer = ''
      for (const clause of subClauses) {
        if (buffer && (buffer.length + clause.length > 20)) {
          sentences.push(buffer)
          buffer = clause
        } else {
          buffer += clause
        }
      }
      if (buffer) sentences.push(buffer)
    } else {
      sentences.push(seg)
    }
  }

  return sentences.filter(s => s.length > 0)
}

/**
 * Builds a word-level and sentence-level aligned timeline for a given script and total duration.
 * Accurately models human speech cadence:
 * - Natural pause after sentences (0.35s ~ 0.55s)
 * - Natural pause after commas/clauses (0.15s ~ 0.25s)
 * - Proportional word durations based on phonetic weight
 */
export function buildAlignedTimeline(script: string, duration: number): AlignedTimeline {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { duration: 0, sentences: [], allWords: [] }
  }

  const rawSentences = splitSentences(script)
  if (!rawSentences.length) {
    return { duration: 0, sentences: [], allWords: [] }
  }

  // Calculate pause and speaking weights for each sentence
  type SentencePlan = {
    text: string
    tokens: string[]
    speakingWeight: number
    pauseDuration: number
  }

  const plans: SentencePlan[] = rawSentences.map((text, i) => {
    const tokens = tokenizeSentenceText(text)
    const speakingWeight = tokens.reduce((sum, t) => sum + tokenWeight(t), 0)
    
    // Determine pause after sentence
    const isLast = i === rawSentences.length - 1
    let pause = 0
    if (!isLast) {
      if (/[。！？!?\n]$/.test(text)) pause = 0.45
      else if (/[，,、；;]$/.test(text)) pause = 0.2
      else pause = 0.3
    }
    return { text, tokens, speakingWeight: Math.max(0.1, speakingWeight), pauseDuration: pause }
  })

  const totalPause = plans.reduce((sum, p) => sum + p.pauseDuration, 0)
  // Ensure available speaking time is at least 60% of total duration even if heavily punctuated
  const availableSpeakingTime = Math.max(duration * 0.6, duration - totalPause)
  const actualPauseScale = (duration - availableSpeakingTime) / (totalPause || 1)
  const totalSpeakingWeight = plans.reduce((sum, p) => sum + p.speakingWeight, 0)

  let cursor = 0
  const sentences: AlignedSentence[] = []
  const allWords: WordToken[] = []
  let globalWordIndex = 0

  plans.forEach((plan, sIdx) => {
    const isLast = sIdx === plans.length - 1
    const sentenceSpeakingDuration = isLast
      ? Math.max(0.1, duration - cursor)
      : (plan.speakingWeight / totalSpeakingWeight) * availableSpeakingTime
    
    const sentenceStart = cursor
    const sentenceEnd = isLast ? duration : sentenceStart + sentenceSpeakingDuration

    // Distribute words within the speaking duration
    const words: WordToken[] = []
    let wordCursor = sentenceStart
    const totalWordWeight = plan.speakingWeight

    plan.tokens.forEach((tokenText, tIdx) => {
      const isLastToken = tIdx === plan.tokens.length - 1
      const wWeight = tokenWeight(tokenText)
      const tokenDuration = isLastToken
        ? Math.max(0.01, sentenceEnd - wordCursor)
        : (wWeight / totalWordWeight) * sentenceSpeakingDuration

      const tokenStart = wordCursor
      const tokenEnd = isLastToken ? sentenceEnd : tokenStart + tokenDuration
      wordCursor = tokenEnd

      const token: WordToken = {
        text: tokenText,
        start: tokenStart,
        end: tokenEnd,
        index: globalWordIndex++
      }
      words.push(token)
      allWords.push(token)
    })

    const sentence: AlignedSentence = {
      text: plan.text,
      start: sentenceStart,
      end: sentenceEnd,
      words
    }
    sentences.push(sentence)

    // Advance cursor past pause
    cursor = sentenceEnd + plan.pauseDuration * actualPauseScale
  })

  return {
    duration,
    sentences,
    allWords
  }
}

/**
 * Query timeline state at any given second.
 * Provides active sentence, active word token, and smooth progress metrics.
 */
export function getTimelineFrameState(timeline: AlignedTimeline, time: number): TimelineFrameState {
  const { sentences } = timeline
  if (!sentences.length) {
    return {
      sentenceIndex: -1,
      activeWordIndex: -1,
      sentenceProgress: 0
    }
  }

  const clampedTime = Math.max(0, Math.min(timeline.duration, Number.isFinite(time) ? time : 0))

  // Last started sentence, using a half-open interval so gaps never show future words.
  let low = 0; let high = sentences.length - 1; let sIndex = -1
  while (low <= high) {
    const middle = (low + high) >>> 1
    if (sentences[middle].start <= clampedTime) { sIndex = middle; low = middle + 1 } else high = middle - 1
  }
  if (sIndex < 0) return { sentenceIndex: -1, activeWordIndex: -1, sentenceProgress: 0, nextSentence: sentences[0] }
  const candidate = sentences[sIndex]
  if (clampedTime >= candidate.end && !(clampedTime === timeline.duration && candidate.end === timeline.duration)) return { sentenceIndex: sIndex, activeWordIndex: -1, sentenceProgress: 1, prevSentence: candidate, nextSentence: sentences[sIndex + 1] }

  const currentSentence = candidate
  const prevSentence = sIndex > 0 ? sentences[sIndex - 1] : undefined
  const nextSentence = sIndex < sentences.length - 1 ? sentences[sIndex + 1] : undefined

  // Calculate progress within current sentence
  const sSpan = Math.max(0.001, currentSentence.end - currentSentence.start)
  const sentenceProgress = Math.max(0, Math.min(1, (clampedTime - currentSentence.start) / sSpan))

  // Find active word token
  let activeWordIndex = -1
  let activeWord: WordToken | undefined

  if (currentSentence.words.length > 0) {
    const wIdx = currentSentence.words.findIndex(w => clampedTime < w.end)
    const validIdx = wIdx < 0 ? currentSentence.words.length - 1 : wIdx
    activeWord = currentSentence.words[validIdx]
    activeWordIndex = activeWord.index
  }

  return {
    sentenceIndex: sIndex,
    currentSentence,
    prevSentence,
    nextSentence,
    activeWordIndex,
    activeWord,
    sentenceProgress
  }
}
