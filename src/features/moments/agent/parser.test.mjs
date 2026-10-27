import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractJsonFence,
  parseMomentsCopyOutput,
  parseMomentsEnvelope,
  parseMomentsPlanOutput,
} from './parser.ts'

function fence(payload) {
  return `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
}

test('extractJsonFence 取最后一个 json 围栏', () => {
  const text = `${fence({ first: 1 })}\n说明文字\n${fence({ second: 2 })}`
  const raw = extractJsonFence(text)
  assert.equal(JSON.parse(raw).second, 2)
})

test('extractJsonFence 没有围栏时返回 null', () => {
  assert.equal(extractJsonFence('{"status":"success"}'), null)
})

test('parseMomentsEnvelope 缺少围栏会抛错', () => {
  assert.throws(() => parseMomentsEnvelope('not json'), /缺少 json 围栏块/)
})

test('parseMomentsPlanOutput 解析合法七天排期', () => {
  const text = fence({
    status: 'success',
    planningMode: 'daily',
    days: [
      {
        date: '2026-10-26',
        items: [{ publishOrder: 1, contentDirection: '专业价值', topic: '晚饭怎么选锅' }],
      },
    ],
  })
  const parsed = parseMomentsPlanOutput(text)
  assert.equal(parsed.status, 'success')
  assert.equal(parsed.value.days[0].date, '2026-10-26')
  assert.equal(parsed.value.days[0].items[0].topic, '晚饭怎么选锅')
})

test('parseMomentsPlanOutput 非法日期会被 blocked', () => {
  const parsed = parseMomentsPlanOutput(
    fence({
      status: 'success',
      days: [{ date: '10/26', items: [{ publishOrder: 1, contentDirection: '专业价值', topic: '选题' }] }],
    }),
  )
  assert.equal(parsed.status, 'blocked')
  assert.equal(parsed.code, 'INVALID_INPUT')
})

test('parseMomentsPlanOutput 失败信封走 QC_FAILED', () => {
  const parsed = parseMomentsPlanOutput(
    fence({
      status: 'failed',
      error: { code: 'QC_FAILED', message: '结构不合格', details: ['days 为空'] },
    }),
  )
  assert.equal(parsed.status, 'failed')
  assert.equal(parsed.code, 'QC_FAILED')
  assert.deepEqual(parsed.details, ['days 为空'])
})

test('parseMomentsCopyOutput 要求三个非空版本且条目已知', () => {
  const known = new Set(['item-1'])
  const parsed = parseMomentsCopyOutput(
    fence({
      status: 'success',
      day: {
        date: '2026-10-26',
        contents: [
          {
            scheduleItemId: 'item-1',
            contentDirection: '专业价值',
            topic: '晚饭怎么选锅',
            versions: ['版本一正文', '版本二正文', '版本三正文'],
            versionMeta: [{ angleTitle: '现场' }, { angleTitle: '误区' }, { angleTitle: '经营者' }],
            currentVersion: 0,
          },
        ],
      },
    }),
    known,
  )
  assert.equal(parsed.status, 'success')
  assert.equal(parsed.value.length, 1)
  assert.equal(parsed.value[0].versions.length, 3)
  assert.equal(parsed.value[0].versionMeta[0].angleTitle, '现场')
})

test('parseMomentsCopyOutput 未知 scheduleItemId 会被 blocked', () => {
  const parsed = parseMomentsCopyOutput(
    fence({
      status: 'success',
      day: {
        contents: [
          {
            scheduleItemId: 'missing',
            contentDirection: '专业价值',
            topic: '选题',
            versions: ['a', 'b', 'c'],
          },
        ],
      },
    }),
    new Set(['item-1']),
  )
  assert.equal(parsed.status, 'blocked')
  assert.equal(parsed.code, 'INVALID_INPUT')
})

test('parseMomentsCopyOutput 人设缺失走 USER_PROFILE_REQUIRED', () => {
  const parsed = parseMomentsCopyOutput(
    fence({
      status: 'blocked',
      error: {
        code: 'USER_PROFILE_REQUIRED',
        message: '尚未配置基础用户信息',
        recoveryAction: '请先完成个人数字分身',
      },
    }),
    new Set(['item-1']),
  )
  assert.equal(parsed.status, 'blocked')
  assert.equal(parsed.code, 'USER_PROFILE_REQUIRED')
  assert.equal(parsed.recoveryAction, '请先完成个人数字分身')
})
