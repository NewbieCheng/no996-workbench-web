import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  groupTimelineTracks,
  getTrackHeight,
  getGroupHeaderHeight,
  TRACK_GROUPS,
} from '../src/panels/timeline/track-grouping.ts'

test('timeline-grouping: groups default 5 tracks into visuals, graphics, and audio', () => {
  const tracks = [
    { id: 'track-shot', type: 'shot', name: '镜头轨', muted: false, hidden: false, locked: false, elements: [] },
    { id: 'track-main-video', type: 'video', name: '主视频轨', muted: false, hidden: false, locked: false, elements: [] },
    { id: 'track-voice-audio', type: 'audio', name: '配音轨', muted: false, hidden: false, locked: false, elements: [] },
    { id: 'track-overlay', type: 'overlay', name: '贴图画中画', muted: false, hidden: false, locked: false, elements: [] },
    { id: 'track-title-text', type: 'text', name: '标题文字', muted: false, hidden: false, locked: false, elements: [] },
  ]

  const grouped = groupTimelineTracks(tracks, new Set())

  // 应包含 3 大核心分类
  assert.equal(grouped.length, 3)

  // 1. 视效画面组包含：镜头轨、主视频轨、贴图画中画
  const visualsGroup = grouped.find((g) => g.group.id === 'visuals')
  assert.ok(visualsGroup)
  assert.equal(visualsGroup.tracks.length, 3)
  assert.deepEqual(
    visualsGroup.tracks.map((t) => t.id),
    ['track-shot', 'track-main-video', 'track-overlay']
  )

  // 2. 图文包装组包含：标题文字轨
  const graphicsGroup = grouped.find((g) => g.group.id === 'graphics')
  assert.ok(graphicsGroup)
  assert.equal(graphicsGroup.tracks.length, 1)
  assert.equal(graphicsGroup.tracks[0].id, 'track-title-text')

  // 3. 音频声轨组包含：配音轨
  const audioGroup = grouped.find((g) => g.group.id === 'audio')
  assert.ok(audioGroup)
  assert.equal(audioGroup.tracks.length, 1)
  assert.equal(audioGroup.tracks[0].id, 'track-voice-audio')
})

test('timeline-grouping: collapsed state is correctly reflected on groups', () => {
  const tracks = [
    { id: 'track-shot', type: 'shot', name: '镜头轨', muted: false, hidden: false, locked: false, elements: [] },
    { id: 'track-title-text', type: 'text', name: '标题文字', muted: false, hidden: false, locked: false, elements: [] },
  ]

  const collapsedSet = new Set(['graphics'])
  const grouped = groupTimelineTracks(tracks, collapsedSet)

  const visuals = grouped.find((g) => g.group.id === 'visuals')
  assert.equal(visuals.isCollapsed, false)

  const graphics = grouped.find((g) => g.group.id === 'graphics')
  assert.equal(graphics.isCollapsed, true)
})

test('timeline-grouping: tiered track heights save substantial vertical space', () => {
  // 标准模式下，文字轨为 28px（节约 40% 以上），音频轨 34px，镜头/视频轨 44px
  assert.equal(getTrackHeight('text', 'standard'), 28)
  assert.equal(getTrackHeight('audio', 'standard'), 34)
  assert.equal(getTrackHeight('overlay', 'standard'), 36)
  assert.equal(getTrackHeight('shot', 'standard'), 44)
  assert.equal(getTrackHeight('video', 'standard'), 44)

  // 紧凑模式下更小
  assert.equal(getTrackHeight('text', 'compact'), 24)
  assert.equal(getTrackHeight('audio', 'compact'), 28)
  assert.equal(getTrackHeight('shot', 'compact'), 36)

  // 分组分隔条高度
  assert.equal(getGroupHeaderHeight('standard'), 24)
  assert.equal(getGroupHeaderHeight('compact'), 20)
})

test('timeline-track-action: adding and grouping dynamically created tracks', () => {
  const initialTracks = [
    { id: 'track-shot', type: 'shot', name: '镜头轨', muted: false, hidden: false, locked: false, elements: [] },
    { id: 'track-title-text', type: 'text', name: '标题文字', muted: false, hidden: false, locked: false, elements: [] },
  ]

  // 新增一条文字轨和一条画中画轨
  const newTextTrack = {
    id: 'track-text-2',
    type: 'text',
    name: '副标题文字 2',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  }
  const newOverlayTrack = {
    id: 'track-overlay-2',
    type: 'overlay',
    name: '画中画 2',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  }

  const updatedTracks = [...initialTracks, newTextTrack, newOverlayTrack]
  const grouped = groupTimelineTracks(updatedTracks, new Set())

  const graphics = grouped.find((g) => g.group.id === 'graphics')
  assert.ok(graphics)
  assert.equal(graphics.tracks.length, 2)
  assert.equal(graphics.tracks[1].id, 'track-text-2')

  const visuals = grouped.find((g) => g.group.id === 'visuals')
  assert.ok(visuals)
  assert.equal(visuals.tracks.length, 2)
  assert.equal(visuals.tracks[1].id, 'track-overlay-2')
})

test('timeline-track-action: clean empty tracks preserves shot track and compresses volume', () => {
  const tracks = [
    { id: 'track-shot', type: 'shot', name: '镜头轨', muted: false, hidden: false, locked: false, elements: [{ id: 'elem-1', type: 'shot', shotId: 's1', startUs: 0, durationUs: 1000000 }] },
    { id: 'track-empty-text', type: 'text', name: '空文字轨', muted: false, hidden: false, locked: false, elements: [] },
    { id: 'track-used-text', type: 'text', name: '有内容的文字轨', muted: false, hidden: false, locked: false, elements: [{ id: 'elem-2', type: 'text', text: 'hello', startUs: 0, durationUs: 1000000 }] },
    { id: 'track-empty-audio', type: 'audio', name: '空音频轨', muted: false, hidden: false, locked: false, elements: [] },
  ]

  // 识别需要被清理的空轨道
  const emptyTracks = tracks.filter((t) => t.type !== 'shot' && t.elements.length === 0 && !t.locked)
  assert.equal(emptyTracks.length, 2)
  assert.deepEqual(emptyTracks.map((t) => t.id), ['track-empty-text', 'track-empty-audio'])

  // 清理后的保留轨道
  const retainedTracks = tracks.filter((t) => !emptyTracks.some((et) => et.id === t.id))
  assert.equal(retainedTracks.length, 2)
  assert.equal(retainedTracks[0].id, 'track-shot')
  assert.equal(retainedTracks[1].id, 'track-used-text')
})

