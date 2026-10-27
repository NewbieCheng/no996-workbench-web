import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countScriptCharacters,
  estimateScriptDurationSeconds,
  resolveScriptDurationDisplay,
} from './script-duration.ts'

const SAMPLE =
  '大家好，我叫四海，今天非常高兴来给大家演示我们的数字人口播生成系统。\n在短视频、直播带货、企业宣传和产品讲解这些高频内容场景里，我们这套数字人口播生成系统，就是为一站式解决真人出镜耗时耗力、反复重拍等痛点量身打造的。'

test('countScriptCharacters uses code points', () => {
  assert.equal(countScriptCharacters(SAMPLE), 108)
})

test('estimateScriptDurationSeconds matches typical TTS for demo copy', () => {
  assert.equal(estimateScriptDurationSeconds(SAMPLE), 18)
})

test('resolveScriptDurationDisplay prefers measured audio when text matches', () => {
  const measured = resolveScriptDurationDisplay({
    text: SAMPLE,
    versionText: SAMPLE,
    audioDuration: 18.2,
  })
  assert.deepEqual(measured, { seconds: 18, approximate: false })

  const stale = resolveScriptDurationDisplay({
    text: `${SAMPLE}补充一句`,
    versionText: SAMPLE,
    audioDuration: 18.2,
  })
  assert.equal(stale.approximate, true)
  assert.ok(stale.seconds >= 18)
})
