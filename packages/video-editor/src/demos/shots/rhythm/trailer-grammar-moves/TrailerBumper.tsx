// @ts-nocheck
// trailer-bumper｜前置速剪预告
// 结构即全部：三连 9f 速剪（A 整页 / B 整页 / A 中列 Top pages 卡 2.2x 怼脸特写）→ 6f 纯黑喘息
// → 正式开场大标题淡入+微升 16f 定格。每个速剪镜头内部带 1→1.04 轻推近。
// 收尾真静止：标题字距 30f 收拢完（63f）后所有动画结束，静止 77f（>40f）。
// 质感：三镜构图拉开（全景 / 换页全景 / 特写），特写放大走 CSS zoom 按目标尺寸栅格化（Q2）；
// 三镜统一镜头暗角 + 颗粒，像同一台摄影机拍的；黑场是真正的纯黑空帧（静默一拍）；
// 开场字卡是成品级标题：柔光底 + 眉题 + 主标题（video-shotcraft 全小写字标）+ 副题（品牌 tagline），主标题在淡入微升的同时字距从
// 0.05em 缓收到 −0.012em（预告片标题的"呼吸"），副题晚 6f 跟进，63f 后整帧冻结。
import React from 'react';
import { AbsoluteFill, Freeze, useCurrentFrame, interpolate, Easing } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { FakeDashboard } from '../../_fixtures/Fixtures';
import { Backdrop, EASE, FONT, Grain, Vignette, mix, ramp, tracking } from '../../_fixtures/Polish';
import { BRAND } from '../../_fixtures/Brand';
import { usePalette } from '../../_fixtures/Look';

/**
 * 配色槽位（usePalette）：四个默认值 = 本镜头原本的四个主色（逐字符照抄原 hex）。
 *  - bg        ← 速剪三镜的舞台底色 G.canvas #f1f1ef（被 FakeDashboard 整幅盖住，靠 isCustom 调色膜才看得见）；
 *                正式字卡的柔光底是 <Backdrop> 内置渐变，用户改底色时退成 PAL.bg 纯色。
 *  - primary   ← 最显眼的品牌强调：眉题 INTRODUCING 的 G.accent #5b63d3（字卡上唯一的彩色）
 *  - secondary ← 次强调：副题那句 tagline 的 G.ink2 #5d5f66（字卡上第二层级、也是唯一另可调的色）
 *  - ink       ← 主文字色：176px 主标题的 G.ink1 #17181c
 * 未传任何配色键时 usePalette 原样返回这四个字面量，默认画面零变化。
 */
const PALETTE_FALLBACK = { bg: '#f1f1ef', primary: '#5b63d3', secondary: '#5d5f66', ink: '#17181c' };

export const TRAILER_BUMPER_DURATION = 140; // 速剪 27f + 黑场 6f + 标题入场 30f + 静止 77f

// 时间轴（帧）
const CUT_1 = 0; // 镜头1：variant A 整页
const CUT_2 = 9; // 镜头2：variant B 整页
const CUT_3 = 18; // 镜头3：variant A 中列卡片 2.2x 怼脸特写
const BLACK = 27; // 纯黑静默
const TITLE = 33; // 正式开场
const TITLE_IN = 16; // 标题淡入+微升时长
const SETTLED = TITLE + 30; // 字距收拢完成 = 全片最后一个动画帧

// 速剪镜头内部轻推近：镜头内 local 0→9f，scale 1→1.04（匀速：9f 内的恒速蠕动，跨切点读作同一口气）
const push = (frame: number, start: number) =>
  interpolate(frame, [start, start + 9], [1, 1.04], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

// 镜头 3 对焦点：中列上卡 Top pages（/changelog 等行）中心 → 推到屏幕中心
const FOCUS_X = 1071;
const FOCUS_Y = 335;
const CLOSE = 2.2;

const Shot: React.FC<{ children: React.ReactNode; s: number }> = ({ children, s }) => {
  // 配色槽位：速剪三镜的舞台底色 → PAL.bg（默认 #f1f1ef = 原 G.canvas，零变化）
  const PAL = usePalette(PALETTE_FALLBACK);
  return (
    <AbsoluteFill style={{ background: PAL.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: '50% 50%' }}>{children}</AbsoluteFill>
      {/* 画面主体是共享占位看板 FakeDashboard（颜色写在 _fixtures，本文件改不到）：用户改底色 / 选预设主题时
          叠一层调色膜，让改色在可见区域真的看得见；默认（没传配色键）不渲染，默认帧零变化。 */}
      {PAL.isCustom && (
        <div style={{ position: 'absolute', inset: 0, background: PAL.bg, opacity: 0.34, mixBlendMode: 'color', pointerEvents: 'none' }} />
      )}
      <Vignette strength={0.18} inner={0.5} color="#1a1c24" />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};

export const TrailerBumper: React.FC = () => {
  // 配色槽位（usePalette）：必须在函数体顶层无条件调用（早于下面任何 if / return）。
  // 未传配色键时原样返回 PALETTE_FALLBACK → 默认画面零变化。
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 开场字卡文案（默认值与原字面量逐字符一致，保证默认画面零变化）
  const eyebrowText = useShotProp('eyebrow', 'INTRODUCING');
  const subline = useShotProp('subline', 'Cinematic product videos, crafted by your agent.');

  // —— 段落 1–3：三连速剪 ——
  if (frame < BLACK) {
    if (frame < CUT_2) {
      // 镜头1：A 整页 + 轻推近
      return (
        <Shot s={push(frame, CUT_1)}>
          <FakeDashboard variant="A" />
        </Shot>
      );
    }
    if (frame < CUT_3) {
      // 镜头2：B 整页 + 轻推近
      return (
        <Shot s={push(frame, CUT_2)}>
          <FakeDashboard variant="B" />
        </Shot>
      );
    }
    // 镜头3：A 中列卡片 2.2x 怼脸特写（CSS zoom 布局级放大），叠加同样的轻推近
    return (
      <Shot s={push(frame, CUT_3)}>
        <div
          style={{
            position: 'absolute',
            // zoom 连自身 left/top 一起放大：left = 960/s − cx ⇒ 对焦点落屏幕中心
            left: 960 / CLOSE - FOCUS_X,
            top: 540 / CLOSE - FOCUS_Y,
            width: 1920,
            height: 1080,
            zoom: CLOSE,
          }}
        >
          <FakeDashboard variant="A" />
        </div>
      </Shot>
    );
  }

  // —— 段落 4：纯黑静默 6f，必须纯黑无物 ——
  if (frame < TITLE) {
    return <AbsoluteFill style={{ background: '#000000' }} />;
  }

  // —— 段落 5：正式开场——标题字卡淡入+微升 16f，字距 30f 缓收后定格 ——
  const opacity = interpolate(frame, [TITLE, TITLE + TITLE_IN], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const rise = interpolate(frame, [TITLE, TITLE + TITLE_IN], [44, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const track = mix(0.05, -0.012, ramp(frame, TITLE, SETTLED - TITLE, EASE.out));
  const eyebrow = ramp(frame, TITLE + 2, 16, EASE.out);
  const sub = ramp(frame, TITLE + 6, 18, EASE.out);
  // 开场底从黑场里"亮起"：背景 12f 由黑淡到柔光底（黑场之后不硬跳到大白）
  const lightUp = ramp(frame, TITLE, 12, EASE.out);

  return (
    <AbsoluteFill style={{ background: '#000000', overflow: 'hidden', fontFamily: FONT.sans }}>
      <Freeze frame={SETTLED} active={frame >= SETTLED}>
        <AbsoluteFill style={{ opacity: lightUp }}>
          {/* 字卡柔光底是 <Backdrop> 的内置渐变：默认原样铺（solid=undefined，逐字节零变化）；
              用户改底色 / 选预设主题（PAL.isCustom）时才退成 PAL.bg 纯色，让检查器改色真正生效。 */}
          <Backdrop tone="light" light={{ x: 0.5, y: 0.36 }} vignette={0.2} solid={PAL.isCustom ? PAL.bg : undefined} />
        </AbsoluteFill>
      </Freeze>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `translateY(${rise}px)`,
          }}
        >
          <div
            style={{
              opacity: eyebrow,
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: PAL.primary,
              marginBottom: 30,
            }}
          >
            {eyebrowText}
          </div>
          <div
            style={{
              opacity,
              fontFamily: BRAND.font,
              fontWeight: 800,
              fontSize: 176,
              lineHeight: 1,
              color: PAL.ink,
              letterSpacing: `${track.toFixed(4)}em`,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {BRAND.name}
          </div>
          <div
            style={{
              opacity: sub,
              marginTop: 38,
              fontSize: 40,
              fontWeight: 500,
              color: PAL.secondary,
              letterSpacing: tracking(40),
            }}
          >
            {subline}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
