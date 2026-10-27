// @ts-nocheck
// lead-word-zoom-assemble — 首词推近落位组句
// 首词以 2.3 倍字号占据画面中央，hold 期间继续向观众推近 6%，随后一条曲线同时
// 完成「缩回终字号」与「整行左滑到最终排布」，后续词从右侧各自槽位外 0.5em 推入；
// 整行上移的同一时窗里副行浮出，停一拍后整幕 crash-zoom 推近失焦交棒下一镜。
//
// 手感命门是支点：transform-origin 横向钉在**首词中心**、纵向钉在**基线**——
// 这两点是全程唯一不该移动的锚，挂载时实测一次（基线用零尺寸 inline-block 的
// offsetTop 读出），否则缩放过程中字会逐帧抖基线。
// 参数以 1920×1080 标定。
// 竖屏变体（reflow）：按短边（=width）以 1080 设计宽等比缩放，不把 1080 设计值当绝对像素。
// 1080×1920 成片时 scale=1：字号 96→60（0.625×）、副行 34→24、左右各留 72；半幅校验画布
// （540×960）时 scale=0.5，字号/留白/间距同步减半，整行始终在画布内、左右不出画。
// 时间轴 / 缓动曲线 / 文案键 / 配色槽位一律不动，横屏（1920×1080）逐像素不变。
// 质感层（改版）：四色 mesh 收成"靛蓝主光 + 一抹暖色余光"的低对比底 + 颗粒 + 暗角；
// 首词入场带 8px→0 失焦（与淡入同 6f）；缩回段按 scale 速度给瞬时失焦（≤3.5px，停稳归零），
// 大幅缩放不再"硬缩"；整行上移提前到 f32–46，品牌行静止 26f 再 crash；强调色统一为批次靛蓝。
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Grain, Vignette } from '../../_fixtures/Polish';
import { rgbOf, usePalette } from '../../_fixtures/Look';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useShotProp,
  useVideoConfig,
} from '../../../runtime/index.ts';

export const LEAD_WORD_ZOOM_ASSEMBLE_DURATION = 84; // 2.8s @30fps

// ---- 编舞常量 ----
const TEXT = 'Introducing Studio Video';
const HIGHLIGHT_WORD = 'Studio Video'; // 精确匹配的词换强调色：品牌词落位那一下自带高亮
const FONT_SIZE = 96;
const INITIAL_SCALE = 2.3; // 首词起手放大倍数
const INTRO_DURATION = 6; // f：首词淡入
const HOLD_DURATION = 12; // f：首词在峰值停留（推近发生在这一段）
const PUSH_SCALE = 1.06; // hold 期间继续推近的倍数
const RECEDE_DURATION = 12; // f：缩回终字号
const ASSEMBLE_DURATION = 24; // f：整行左滑到位
const WORD_DELAY = 6; // f：缩回起点后第二个词开始推入
const WORD_STAGGER = 4; // f：后续词之间的错峰
const WORD_DURATION = 12; // f：单词推入行程
const WORD_PUSH = 0.5; // em：后续词起始位置在自己槽位右侧多远
const WORD_FADE = 2; // f：后续词淡入（刻意极短——是被推进来的，不是淡进来的）
const LETTER_SPACING = '-0.03em';

// ---- 场景层 ----
const LIFT: [number, number] = [32, 46]; // f：整行上移 + 副行同帧出现（与左滑尾巴重叠 4f，读作一口气）
const LIFT_DISTANCE = -56; // px
const SUBLINE = 'One shot card, one motion recipe — copy, paste, render.';
const CRASH_FRAMES = 12; // f：段尾 crash-zoom 占用的收尾帧数
const CRASH_SCALE = 0.2;
const CRASH_BLUR = 9;

// 配色槽位（usePalette）：四个默认值 = 本镜头原本的四个主色，逐字符照抄原文件。
// 未传任何配色键时 PAL 与旧字面量完全相同，默认画面零变化：
//   bg        = 舞台 mesh 的纵向底渐变起点 #f6f6f8（满版页底的主色；用户改底色 / 选预设时整幅换 PAL.bg）
//   primary   = 强调靛蓝 #5b63d3（品牌词 Studio Video 的字色 + 左上那团靛蓝主光，全片最显眼的品牌强调）
//   secondary = 右下那抹暖色余光 #ffb478（原写成 rgba(255,180,120,0.10)，按同色 hex 给出、用 rgbOf() 复现原串）
//   ink       = 主文字 #1d1d1f（整行 96px 大字）
const PALETTE_FALLBACK = { bg: '#f6f6f8', primary: '#5b63d3', secondary: '#ffb478', ink: '#1d1d1f' };

const INK_DIM = '#6e6f76';
// 系统 Display 字栈在前（-apple-system 在无头 Chrome 里常解析不到，会落到 PingFang），中文回退 PingFang
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "PingFang SC", Inter, Arial, sans-serif';
// 舞台 mesh：左上靛蓝主光（primary）+ 右下暖色余光（secondary）+ 中心纸面提亮 + 纵向底渐变。
// 两团光的色相跟配色槽位走；中心提亮与纵向渐变两端是受光/压暗材质，默认原样保留。
// 两处 rgba 用 rgbOf() 逐字符复现原串（'rgba(91,99,211,0.16)' / 'rgba(255,180,120,0.10)'），默认帧零变化。
// custom = 用户传了 colorTheme / customBg：底色换成 PAL.bg，两层光继续叠在上面（primary / secondary 仍然可调），
// 只撤掉那层会把深底洗白的白色纸面提亮与写死的浅色渐变两端。
const meshBg = (bg: string, primary: string, secondary: string, custom: boolean) =>
  `radial-gradient(56% 50% at 26% 24%, rgba(${rgbOf(primary)},0.16) 0%, rgba(${rgbOf(primary)},0) 72%),` +
  `radial-gradient(50% 46% at 80% 82%, rgba(${rgbOf(secondary)},0.10) 0%, rgba(${rgbOf(secondary)},0) 72%),` +
  (custom
    ? bg
    : 'radial-gradient(70% 60% at 50% 46%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 70%),' +
      'linear-gradient(180deg, #f6f6f8 0%, #efeff2 100%)');

/** 首词向观众漂移：先快后停，峰值处挂住 */
const PUSH_EASE = Easing.bezier(0.25, 1, 0.5, 1);
/** 缩回与左滑共用同一条曲线——两个动作必须读作一次运动，不能各走各的 */
const ZOOM_EASE = Easing.bezier(0.5, 0, 0.05, 1);
/** 后续词推入槽位：起步快，落地长而软 */
const WORD_EASE = Easing.bezier(0.22, 0.8, 0.36, 1);

// 整行 scale：hold 推近 + 缩回两段相加（两段之间没有速度断点）
const lineScale = (f: number) =>
  interpolate(f, [0, HOLD_DURATION], [INITIAL_SCALE, INITIAL_SCALE * PUSH_SCALE], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: PUSH_EASE,
  }) +
  interpolate(f, [HOLD_DURATION, HOLD_DURATION + RECEDE_DURATION], [0, 1 - INITIAL_SCALE * PUSH_SCALE], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ZOOM_EASE,
  });

const TextReveal: React.FC = () => {
  // 配色槽位（usePalette）：主文字色（整行 96px 大字）+ 品牌强调（高亮词 Studio Video）
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 竖屏变体（reflow）：所有竖屏尺寸都从 1080 设计宽乘同一个 scale 得来（1080×1920 时 scale=1），
  // 不再把 60px 字号 / 72px 留白写死成绝对像素——竖屏出帧画布可能是半幅 540×960，
  // 固定 60px 会让整行约 675px 在 540 宽画布里左右各出画约 67px（「Introducing Studio Video」被裁成
  // 「roducing Studio Vid」）。字体始终是可换行的单行盒：默认文案在 vertical 里仍是一行，
  // 用户把 text 改长时在左右各 72 设计像素的边界内折行，不再出画。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const verticalScale = vertical ? width / 1080 : 1;
  const fontSize = vertical ? 60 * verticalScale : FONT_SIZE;
  const lineMaxWidth = vertical ? width - 72 * 2 * verticalScale : undefined;

  // 整行宽度、首词中心占比、基线位置：只在挂载时量一次，量到之前挂起渲染
  const lineRef = useRef<HTMLSpanElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const [handle] = useState(() => delayRender('lead-word-zoom-assemble: measure line'));
  const [metrics, setMetrics] = useState<{
    lineWidth: number;
    leadRatio: number;
    baseline: number;
  } | null>(null);

  useEffect(() => {
    const line = lineRef.current;
    const lead = leadRef.current;
    if (!line || !lead) {
      continueRender(handle);
      return;
    }
    setMetrics({
      lineWidth: line.offsetWidth,
      leadRatio: (lead.offsetLeft + lead.offsetWidth / 2) / line.offsetWidth,
      baseline: baselineRef.current?.offsetTop ?? line.offsetHeight * 0.8,
    });
  }, [handle]);

  useEffect(() => {
    if (metrics) continueRender(handle);
  }, [metrics, handle]);

  const text = useShotProp('text', TEXT);
  const highlightWord = useShotProp('highlightWord', HIGHLIGHT_WORD);
  const words = text.includes(' ') ? text.split(' ').filter(Boolean) : Array.from(text);
  const ready = metrics !== null;
  const leadRatio = metrics?.leadRatio ?? 0.14;
  const lineWidth = metrics?.lineWidth ?? width * 0.5;
  const baseline = metrics?.baseline ?? fontSize * 0.88;

  const zoomStart = HOLD_DURATION;
  // 首词从"画面正中"走到"行内自己的位置"，位移就是这段偏心距
  const slideDistance = lineWidth * (0.5 - leadRatio);
  // 首词入场失焦：与 6f 淡入同步 8px→0（scale 前单位，随 2.3× 放大）
  const introBlur = interpolate(frame, [0, INTRO_DURATION], [8 / INITIAL_SCALE, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <span
        ref={lineRef}
        style={{
          position: 'relative',
          display: 'inline-block',
          fontSize,
          fontWeight: 600,
          color: PAL.ink,
          letterSpacing: LETTER_SPACING,
          lineHeight: 1.1,
          // 横屏保持原样；竖屏允许在 maxWidth（width - 144×scale）内折行，长短文案都不出画
          whiteSpace: vertical ? 'normal' : 'nowrap',
          maxWidth: lineMaxWidth,
          textAlign: vertical ? 'center' : undefined,
          fontFamily: SANS,
          transformOrigin: `${leadRatio * 100}% ${baseline}px`,
          scale: lineScale(frame),
          // 缩回段的瞬时失焦：按 scale 速度给（峰值约 0.3/帧 → ≈3px），停稳为 0
          filter: (() => {
            const v = Math.abs(lineScale(frame + 0.5) - lineScale(frame - 0.5));
            const b = Math.min(3.5, v * 10) + introBlur;
            return b > 0.05 ? `blur(${b.toFixed(2)}px)` : undefined;
          })(),
          translate: `${interpolate(
            frame,
            [zoomStart, zoomStart + ASSEMBLE_DURATION],
            [slideDistance, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ZOOM_EASE },
          )}px`,
          opacity: ready ? 1 : 0,
          textRendering: 'geometricPrecision',
          ...(getRemotionEnvironment().isRendering ? null : { willChange: 'transform' as const }),
        }}
      >
        {words.map((word, i) => {
          const isLead = i === 0;
          const pushStart = zoomStart + WORD_DELAY + (i - 1) * WORD_STAGGER;
          const opacity = isLead
            ? interpolate(frame, [0, INTRO_DURATION], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })
            : interpolate(frame, [pushStart, pushStart + WORD_FADE], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
          return (
            <Fragment key={i}>
              <span
                ref={isLead ? leadRef : undefined}
                style={{
                  display: 'inline-block',
                  opacity,
                  color: word === HIGHLIGHT_WORD ? PAL.primary : undefined,
                  translate: isLead
                    ? undefined
                    : `${interpolate(
                        frame,
                        [pushStart, pushStart + WORD_DURATION],
                        [WORD_PUSH * fontSize, 0],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: WORD_EASE },
                      )}px`,
                }}
              >
                {word}
              </span>
              {/* 词间空格必须放在 inline-block 之外——跟在词里会被行盒裁掉，词会黏在一起 */}
              {i < words.length - 1 ? ' ' : null}
            </Fragment>
          );
        })}
        {/* 基线尺：零尺寸 inline-block，它的 offsetTop 就是基线 */}
        <span ref={baselineRef} style={{ display: 'inline-block', width: 0, height: 0 }} />
      </span>
    </AbsoluteFill>
  );
};

export const LeadWordZoomAssemble: React.FC = () => {
  // 配色槽位（usePalette）：舞台底色 + mesh 里两团光的色相（主光 primary / 余光 secondary）
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 竖屏变体（reflow）：副行同样按 1080 设计宽等比缩放——34→24、左右各留 72（1080 画布下），
  // 半幅 540×960 校验画布时 scale=0.5，留白 36 / 字号 12，长副行在这个宽度内折行；
  // 同时把主副行整体上移 70 设计像素，内容中心落在竖屏安全区中心 890（180 + (1920-320-180)/2）。
  // 横屏仍是原来的 34px 通栏、中心 50%，零变化。
  const { durationInFrames, width, height } = useVideoConfig();
  const vertical = height > width;
  const verticalScale = vertical ? width / 1080 : 1;
  const verticalSafeLift = vertical ? -70 * verticalScale : 0;
  const subline = useShotProp('subline', SUBLINE);

  const lift = interpolate(frame, LIFT, [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const crash = interpolate(
    frame,
    [durationInFrames - CRASH_FRAMES, durationInFrames - 1],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) },
  );

  return (
    // 默认（未传 colorTheme / customBg）逐字符渲染原 mesh 渐变 → 默认画面零变化；
    // 用户改底色 / 选预设主题时底色换 PAL.bg，两团光的色相仍跟 primary / secondary 走。
    <AbsoluteFill style={{ background: meshBg(PAL.bg, PAL.primary, PAL.secondary, PAL.isCustom), fontFamily: SANS }}>
      <AbsoluteFill
        style={{
          transform: `scale(${1 + crash * CRASH_SCALE})`,
          filter: crash > 0.01 ? `blur(${crash * CRASH_BLUR}px)` : undefined,
          opacity: 1 - crash * 0.55,
        }}
      >
        <AbsoluteFill style={{ transform: `translateY(${verticalSafeLift + lift * LIFT_DISTANCE}px)` }}>
          <TextReveal />
        </AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: vertical ? 72 * verticalScale : 0,
            right: vertical ? 72 * verticalScale : 0,
            top: '50%',
            // 与主行之间的间距按同一比例收（62 × 60/96 ≈ 40 设计像素）
            marginTop: vertical ? 40 * verticalScale : 62,
            textAlign: 'center',
            fontSize: vertical ? 24 * verticalScale : 34,
            lineHeight: vertical ? 1.5 : undefined,
            fontWeight: 400,
            letterSpacing: '-0.005em',
            color: INK_DIM,
            opacity: lift,
            // 竖屏与主行一起上移到安全区中心（横屏 verticalSafeLift=0，仍是原来的浮出行程）
            transform: `translateY(${verticalSafeLift + (1 - lift) * 16}px)`,
          }}
        >
          {subline}
        </div>
      </AbsoluteFill>
      <Vignette strength={0.12} inner={0.5} color="#2a2c36" />
      <Grain opacity={0.05} />
    </AbsoluteFill>
  );
};
