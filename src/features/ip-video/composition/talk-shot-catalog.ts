import { SHOT_CATALOG, type ShotDefinition } from '@no996/video-editor/demos/registry.generated.ts'
import { getShotDisplayName } from '@no996/video-editor/demos/localization.ts'
import type { EditorDocument } from '@no996/video-editor'
import { CONTENT_SHOT_DEFINITIONS, CONTENT_SHOT_TEXT_LIMITS, findContentShot } from '@no996/video-editor/demos/content-variants.tsx'

export type TalkShotField = { key: string; label: string; max: number; required?: boolean }
export type TalkShotAudit = {
  shot: ShotDefinition
  source: string
  curated: boolean
  fields: readonly TalkShotField[]
  slots: readonly string[]
  reasons: readonly string[]
  /** Only independently adapted, resource-free content presentations may be inserted. */
  candidate: boolean
  presentation?: 'content'
  contentEvidence?: string
  demoFields: readonly TalkShotField[]
  demoSlots: readonly string[]
  demoReasons: readonly string[]
}

/** Explicit source inventory. No schema/category inference: getShotSchema 字段已由注册表 editableKeys 真值约束（2026-10-23 阶段 0），但本清单仍独立审查口播适配性。 */
const SOURCE_INVENTORY = `
camera/basic-3d-scene|Basic3DScene
camera/crash-zoom-punch~CrashImpactReal|CrashImpactReal
camera/crash-zoom-punch~CrashZoomReal|CrashZoomReal
camera/cursor-flyover|CursorFlyover
camera/depth-layer-moves|MultiplaneReal
camera/graze-face-tour|GrazeFaceTour
camera/overhead-camera-moves~OverheadTabletopDrop|OverheadTabletopDrop
camera/overhead-camera-moves~TiltReveal|TiltReveal
camera/space-camera-moves~DroneDiveLanding|DroneDiveLanding
camera/space-camera-moves~ExplodedView|ExplodedView
camera/steep-tilt-glide|SteepTiltGlide
camera/tension-camera-moves~BulletTimeFreezeOrbit|BulletTimeFreezeOrbit
camera/tension-camera-moves~PullBackIsolation|PullBackIsolation
camera/terminal-3d|Terminal3D
data/before-after-slider-scrub|BeforeAfterSliderScrub
data/chart-live-moves~AxisRescaleShockV2|AxisRescaleShockV2
data/chart-live-moves~OscilloscopeStreamV2|OscilloscopeStreamV2
data/chart-live-moves~UnitDotSwarmRegroupV2|UnitDotSwarmRegroupV2
data/gauge-readout-moves~NeedleSweepSelftest|NeedleSweepSelftest
data/gauge-readout-moves~TapeScrollFixedPointer|TapeScrollFixedPointer
data/scroll-brake-moves~BrakeReticleLock|BrakeReticleLock
data/scroll-brake-moves~ChangelogScrollBrake|ChangelogScrollBrake
data/timeline-travel|TimelineTravel
effects/assemble-then-type-flyin|AssembleThenTypeFlyin
effects/aurora-bloom-bg-flip|AuroraBloomBgFlip
effects/brand-frame-snap|BrandFrameSnap
effects/fui-hud-moves|ReticleLockOn
effects/glow-flyline-moves~FlylineArc|FlylineArc
effects/glow-flyline-moves~GlowOrbAmbient|GlowOrbAmbient
effects/glow-flyline-moves~OrbFlylineRelay|OrbFlylineRelay
effects/icon-performance-moves|AttentionBounce
effects/impact-feedback~AnimeImpact|AnimeImpact
effects/impact-feedback~HitCounter|HitCounter
effects/light-play-moves~SheenSweepRetry|SheenSweepRetry
effects/light-play-moves~SpotlightSweepReveal|SpotlightSweepReveal
effects/radial-ripple-phone-chips|RadialRipplePhoneChips
effects/riso-print-hits|RisoMisregistrationHit
effects/scan-bracket-sweep|ScanBracketSweep
effects/scanline-annotate-focus|ScanlineAnnotateFocus
effects/scanline-assemble-flyin|ScanlineAssembleFlyin
effects/slam-entrance-moves~ImpactBurstKit|ImpactBurstKit
effects/slam-entrance-moves~KanadaPerspectiveSnap|KanadaPerspectiveSnap
effects/slam-entrance-moves~ScoreSlam|ScoreSlam
effects/spotlight-sweep-moves~CornerSpotlightReveal|CornerSpotlightReveal
effects/spotlight-sweep-moves~GlowWakeSleepPanel|GlowWakeSleepPanel
effects/spotlight-sweep-moves~SlideSpotlightPan|SlideSpotlightPan
interaction/autolayout-gap-dial|AutolayoutGapDial
interaction/canvas-materialize-moves~DiagramCascadeBuild|DiagramCascadeBuild
interaction/canvas-materialize-moves~PanelToCanvasMaterialize|PanelToCanvasMaterialize
interaction/chip-grid-single-select-blackout|ChipGridSingleSelectBlackout
interaction/collab-cursor-moves|CursorCastEnsemble
interaction/glass-pill-dictation-typing|GlassPillDictationTyping
interaction/hashtag-to-pill-materialize|HashtagToPillMaterialize
interaction/picker-carousel-feature-cycle|PickerCarouselFeatureCycle
interaction/segmented-thumb-hero|SegmentedThumbHero
interaction/theme-switch-moves~PaletteThemeRipple|PaletteThemeRipple
interaction/theme-switch-moves~ThemeSweepToggle|ThemeSweepToggle
interaction/type-and-filter|TypeAndFilter
interaction/voice-waveform-live|VoiceWaveformLive
opening/crane-rise-reveal|CraneRiseReveal
opening/dataviz-landscape-open|DatavizLandscapeOpen
opening/fracture|Fracture
opening/icon-field-colorize|IconFieldColorize
opening/letterspace-materialize|LetterspaceMaterialize
opening/magician-card-flourish|MagicianCardFlourish
opening/orbit-ring-title-open|OrbitRingTitleOpen
opening/spotlight-hero-card|SpotlightHeroCard
opening/stroke-segment-build|StrokeSegmentBuild
opening/text-as-mask|TextAsMask
outro/grain-dissolve|GrainDissolve
outro/logo-shrink-wordmark-lockup|LogoShrinkWordmarkLockup
outro/neon-triple-marquee|NeonTripleMarquee
outro/outro-group-photo-launch|OutroGroupPhotoLaunch
outro/ui-strip-away-outro|UiStripAwayOutro
outro/ui-to-brand-morph~IconFlipBloomLogo|IconFlipBloomLogo
outro/ui-to-brand-morph~InputMorphsIntoLogo|InputMorphsIntoLogo
rhythm/beat-cut-moves|PaparazziFlash
rhythm/beat-step-list-theme-cycle|BeatStepListThemeCycle
rhythm/panel-grid-moves|ComicPanelSplit
rhythm/quad-split-parallel-scenes|QuadSplitParallelScenes
rhythm/rhythm-interrupt-moves|JumpCutPunchIn
rhythm/sakuga-timing-shift|SakugaTimingShift
rhythm/speed-ramp-freeze|FreezeAnnotateReal
rhythm/trailer-grammar-moves|TrailerBumper
transition/bottom-push-stack-wipe|BottomPushStackWipe
transition/card-flip-reveal|CardFlipReveal
transition/card-flock-tumble|CardFlockTumble
transition/circle-match-iris|CircleMatchIris
transition/gradient-transition|GradientTransition
transition/line-carry-transition|LineCarryTransition
transition/mosaic-reframe|MosaicReframe
transition/page-turn-transitions|BarnDoorSplit
transition/print-texture-transitions|InkBleedReveal
transition/shot-transitions~PortalWipeV2|PortalWipeV2
transition/shot-transitions~WhipBrakeReal|WhipBrakeReal
transition/tear-streak-transitions|GlitchDisplace
transition/transition-hidden-cut~InvisibleCut|InvisibleCut
transition/transition-hidden-cut~LightLeakBurn|LightLeakBurn
transition/transition-hidden-cut~VersusSlam|VersusSlam
transition/transition-travel|LetterformZoom
transition/white-flash-logo-simplify-cut|WhiteFlashLogoSimplifyCut
transition/wipe-transitions|BlindsSlice
typography/blur-slide|BlurSlide
typography/brace-expand|BraceExpand
typography/brand-ink-open|BrandInkOpen
typography/countdown-arc-scatter|CountdownArcScatter
typography/flying-words|FlyingWords
typography/glitch-cycle|GlitchCycle
typography/gradient-word-sweep|GradientWordSweep
typography/lead-word-zoom-assemble|LeadWordZoomAssemble
typography/marker-underline-title|MarkerUnderlineTitle
typography/outline-word-fill|OutlineWordFill
typography/paper-title-card|PaperTitleCard
typography/pill-chip-slot-cycle-handled|PillChipSlotCycleHandled
typography/pill-slot-cycle|PillSlotCycle
typography/text-column-converge|TextColumnConverge
typography/title-demote-to-label|TitleDemoteToLabel
typography/type-assembly-moves~LetterformDriftAssembly|LetterformDriftAssembly
typography/type-assembly-moves~SplitTextStagger|SplitTextStagger
typography/type-assembly-moves~TextOnPath|TextOnPath
typography/type-entrance-moves|LetterDropPhysics
typography/type-rhythm-sync~FontWeightPump|FontWeightPump
typography/type-rhythm-sync~KaraokeFillSync|KaraokeFillSync
typography/typewriter-moves|TypewriterErrorRetype
typography/vertical-word-roll-blur-cycle|VerticalWordRollBlurCycle
typography/word-relay-filmstrip|WordRelayFilmstrip
typography/word-relay-geometry|WordRelayGeometry
ui-entrance/avatar-bracket-carousel|AvatarBracketCarousel
ui-entrance/bezier-source-converge-merge|BezierSourceConvergeMerge
ui-entrance/card-stack|CardStack
ui-entrance/carousel-3d|Carousel3D
ui-entrance/clipcard-looping|ClipCardLooping
ui-entrance/cloner-depth-echo|ClonerDepthEcho
ui-entrance/deck-deal-flyin|DeckDealFlyin
ui-entrance/doc-park-left-pill-deal|DocParkLeftPillDeal
ui-entrance/document-typewriter-reveal|DocumentTypewriterReveal
ui-entrance/draw-svg-trace|DrawSvgTrace
ui-entrance/element-body-moves|ContactShadowLift
ui-entrance/integration-hub-map|IntegrationHubMap
ui-entrance/list-reveal|ListReveal
ui-entrance/list-stack-press|ListStackPress
ui-entrance/neon-frame-forerun|NeonFrameForerun
ui-entrance/neon-frame-orbit-drop|NeonFrameForerunOrbit
ui-entrance/page-waterfall-wall|PageWaterfallWall
ui-entrance/product-card-progressive-assemble|ProductCardProgressiveAssemble
ui-entrance/radial-wave|RadialWave
ui-entrance/research-card-stack-scroll|ResearchCardStackScroll
ui-entrance/row-embed|RowEmbed
ui-entrance/value-stagger-gradient|ValueStaggerGradient
ui-entrance/wall-reveal-moves~BentoLightUp|BentoLightUp
ui-entrance/wall-reveal-moves~WireframeDrawOn|WireframeDrawOn
`.trim().split('\n').map(line => line.split('|'))
const sources = new Map(SOURCE_INVENTORY.map(([id, component]) => [id, `packages/video-editor/src/demos/shots/${id.split('~')[0]}/${component}.tsx`]))

const leadFields: readonly TalkShotField[] = [
  { key: 'text', label: '片头短标题', max: 6, required: true },
  { key: 'subline', label: '副标题', max: 16, required: true },
]
const precise: Record<string, { fields: readonly TalkShotField[]; slots?: string[]; reasons: string[]; candidate?: boolean; curated?: boolean }> = {
  'typography/lead-word-zoom-assemble': {
    fields: leadFields, candidate: true, curated: true,
    reasons: ['源码按 1920×1080 标定；竖屏与方屏未适配。', 'highlightWord 虽被读取，实际着色仍比较常量 HIGHLIGHT_WORD，本面板不提供假高亮控件。'],
  },
  'typography/blur-slide': {
    fields: [{ key: 'text', label: '主标题', max: 8 }, { key: 'subline', label: '副标题', max: 18 }],
    reasons: ['text/subline 实际被消费，但 RELEASE NOTES、刊期、PAGE 07 和原品牌字标不可覆盖；固定 1920 宽网格尚未适配竖屏。'],
  },
  'opening/spotlight-hero-card': {
    fields: [{ key: 'title', label: '标题', max: 12 }, { key: 'subline', label: '说明', max: 20 }], slots: ['cardImage'],
    reasons: ['title/subline/cardImage 实际被消费，但底层仍是固定示例页面截图与相机；上传图片不会替换全页英文与品牌。'],
  },
  'opening/text-as-mask': {
    fields: ['text', 'subline', 'sidebarBrand', 'navItem1', 'navItem2', 'navItem3', 'navItem4', 'navItem5', 'activeNavIndex', 'dashboardTitle', 'dashboardStatus', 'kpi1Label', 'kpi1Value', 'kpi2Label', 'kpi2Value', 'kpi3Label', 'chartTitle', 'chartUnit', 'region1Name', 'region1Value', 'region2Name', 'region2Value', 'region3Name', 'region3Value', 'region4Name', 'region4Value', 'colorTheme', 'customBg', 'customPrimary', 'customSecondary', 'customPanel', 'customInk'].map(key => ({ key, label: key, max: 30 })),
    slots: ['innerImage'], reasons: ['存在真实参数入口，但内置看板是示例数据，固定横屏蒙版/图表构图未适配；本面板不注入虚构经营数据。'],
  },
  'outro/logo-shrink-wordmark-lockup': {
    fields: [{ key: 'brand', label: '品牌名', max: 6 }, { key: 'slogan', label: '标语', max: 14 }],
    reasons: ['brand/slogan 可改，但 ShotcraftMark 图标不可替换；480×270 的固定品牌字宽不能保证中文或竖屏适配。'],
  },
  'data/chart-live-moves~AxisRescaleShockV2': {
    fields: ['metric', 'value', 'label'].map(key => ({ key, label: key, max: 20 })),
    reasons: ['metric/value/label 入口存在，但 DATA、月份、刻度与年度总量仍为固定示例；不能将改标签当成真实数据图表接入。'],
  },
}

const contentFields: readonly TalkShotField[] = [
  { key: 'text', label: '短标题', max: CONTENT_SHOT_TEXT_LIMITS.text, required: true },
  { key: 'subline', label: '副标题', max: CONTENT_SHOT_TEXT_LIMITS.subline, required: true },
]
const adaptationEvidence: Record<string, string> = {
  blur: '复用帧进度、错峰与模糊/位移收敛机制，移除固定刊头、英文与品牌；中文逐字分行。',
  fly: '复用纵深远近和错峰机制，字符仅在标题安全区内缩放飞入，不带原词库、隧道素材或品牌。',
  outline: '复用空心描边到实心点亮机制，文字由用户提供，不带对比指标、HUD 或原品牌。',
  gradient: '复用渐变沿字符推进机制，移除固定充能词、宣传语、闪电和纹理；仅绘制用户短标题。',
  marker: '复用标题落定后从左到右划线机制，使用确定性简单路径，不复制原品牌行或干笔纹理。',
  label: '复用标题缩小上移为标签、副标题跟入机制，不包含原示例网页、卡片、评价或图表。',
}
const COLOR_KEYS = new Set(['colorTheme', 'customBg', 'customInk', 'customPanel', 'customPrimary', 'customSecondary'])

/** 演示源码现在是否真的消费了外部文案（决定 reasons 的说法，不再一律说"没有参数入口"）。 */
function demoConsumesText(shot: { editableKeys?: readonly string[] }): boolean {
  return (shot.editableKeys ?? []).some(key => !COLOR_KEYS.has(key))
}

export const TALK_SHOT_CATALOG: readonly TalkShotAudit[] = SHOT_CATALOG.map(shot => {
  const entry = precise[shot.shotId]
  const content = CONTENT_SHOT_DEFINITIONS.find(item => item.shotId === shot.shotId)
  const supported = !!content && !!findContentShot(shot.shotId)
  const textEditable = demoConsumesText(shot)
  const demoReasons = entry?.reasons ?? [sources.has(shot.shotId)
    ? (textEditable
      ? '演示源码已消费文案参数（可在检查器里改标题/副标题等），但仍保留示例数据、固定布局与品牌留白，且只按 1920×1080 横屏构图。'
      : '原始演示源码没有实际消费外部文案参数；分类推导的编辑字段不生效，原场景待适配。')
    : '新增原始镜头尚未逐项审查，默认不可插入。']
  return {
    shot, source: sources.get(shot.shotId) ?? '', curated: content?.curated ?? false,
    candidate: supported, presentation: supported ? 'content' : undefined,
    contentEvidence: content ? adaptationEvidence[content.variant] : undefined,
    fields: supported ? contentFields : [], slots: [],
    reasons: supported ? [] : [...demoReasons, '未提供去演示化内容版，不允许将原始演示作为用户口播内容插入。'],
    demoFields: entry?.fields ?? [], demoSlots: entry?.slots ?? [],
    demoReasons: [...demoReasons, '原始演示及附带纹理的许可证据仍待核实，本工作台不开放原始演示。'],
  }
})

/** Integration responsibilities, not a blanket ban on the independently adapted content allowlist. */
export const TALK_SHOT_RENDER_BLOCKERS = [
  '六个内容版的多画幅、裁剪、变速、多实例与改文案缓存仍待浏览器及真实 MP4 对照验收。',
  '分层预览与导出已按轨道层序接线，人物、内容镜头与字幕的实际遮挡关系仍待运行验收。',
  '其余 145 项原始演示未适配，原始镜头及附带纹理的逐项许可仍待核实。',
] as const

export function talkShotUnavailableReasons(entry: TalkShotAudit, doc: EditorDocument): string[] {
  const reasons = [...entry.reasons]
  if (entry.presentation !== 'content' || !findContentShot(entry.shot.shotId)) {
    if (!reasons.length) reasons.push('镜头不在内容版静态白名单中。')
    return reasons
  }
  if (!Number.isFinite(doc.canvas.width) || !Number.isFinite(doc.canvas.height) || Math.min(doc.canvas.width, doc.canvas.height) < 320) reasons.push('画布短边至少需要 320 像素，保证中文标题与副标题可读。')
  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  if (!Number.isFinite(fps) || fps <= 0 || fps > 120) reasons.push('内容版支持大于 0 且不超过 120 的有效帧率。')
  return reasons
}

export function talkShotLabel(entry: TalkShotAudit): string {
  return CONTENT_SHOT_DEFINITIONS.find(item => item.shotId === entry.shot.shotId)?.label ?? getShotDisplayName(entry.shot)
}

export const TALK_ASSEMBLY_SUPPORT = {
  semanticComponents: ['title.opening', 'title.chapter', 'title.keyword', 'caption.sentence', 'info.steps'],
  implementedMotions: ['motion.fade-in', 'motion.step-focus'],
  explanation: '32 个目录组件中，5 个具有对应语义的编译分支；其余 27 个退化为文字/目录名，不是媒体、背景或图表。18 个目录动效中仅 2 个有实际编译处理；步骤卡只接受 step-focus，句字幕拒绝独立动效。',
  audio: '音效与 BGM 清单没有作者、原始链接、逐件许可证和再分发证据，本工作台不提供插入或试听；用户自有音频仍走现有导入。',
} as const
