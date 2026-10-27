/**
 * Remotion 兼容运行时 —— 统一出口
 *
 * 参考项目 demo 里写的是 `import { useCurrentFrame } from 'remotion'`。
 * P1 的批量改写会把每个 demo 的 `'remotion'` 指到本文件，其余代码一字不动。
 *
 * 本文件导出的 API 与实测用到的 11 个完全对齐：
 *   useCurrentFrame · AbsoluteFill · interpolate · Easing · staticFile · Img
 *   spring · useVideoConfig · Freeze · Sequence · OffthreadVideo
 */

export {
  FrameProvider,
  useCurrentFrame,
  useVideoConfig,
  useT,
  readFrameState,
  useShotProps,
  useShotProp,
  type FrameState,
} from './frame-context.tsx'

export {
  AbsoluteFill,
  Sequence,
  Freeze,
  absoluteFillStyle,
  type AbsoluteFillProps,
  type SequenceProps,
  type FreezeProps,
} from './absolute-fill.tsx'

export {
  interpolate,
  Easing,
  spring,
  springCurve,
  bezier,
  type EasingFunction,
  type InterpolateOptions,
  type SpringConfig,
  type SpringOptions,
  type ExtrapolateType,
} from './interpolate.ts'

export {
  staticFile,
  Img,
  Audio,
  waitForImages,
  pendingImageCount,
  type ImgProps,
} from './assets.tsx'

export { OffthreadVideo, Video, type OffthreadVideoProps } from './video.tsx'

export {
  CameraMotionBlur,
  motionBlurSamples,
  type CameraMotionBlurProps,
} from './motion-blur.tsx'

export {
  delayRender,
  continueRender,
  waitForRenderGate,
  resetRenderGate,
  openRenderGateCount,
  getRemotionEnvironment,
  type DelayRenderHandle,
} from './render-gate.ts'

export {
  random,
  randomInt,
  frameRandom,
  createRandom,
  hashSeed,
  rand,
} from './determinism.ts'
