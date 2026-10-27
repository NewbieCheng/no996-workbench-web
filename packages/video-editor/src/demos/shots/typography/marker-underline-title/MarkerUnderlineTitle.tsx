// @ts-nocheck
// marker-underline-title —— 白底大标题落定后，斜体 "new" 下方一道
// 马克笔下划线从左到右描画（粗细变化/端头圆润/微歪/边缘毛糙）。
// 对标 notion-ai.mp4 2.3–3.6s。与库内 draw-svg-trace 撞车，本版做马克笔质感。
// 质感层（改版）：补导出时长 75f（f42 划完后静止 33f ≥1s）；标题两行错峰 blur-slide
// （snappy，第二行晚 4f）；笔画加确定性干笔肌理——feTurbulence 位移做毛糙边 + 细碎飞白镂空，
// 墨色改带暖调的近黑并 multiply 进纸面；纸面 = 暖白低对比底 + 主光 + 颗粒；
// 第二行 = video-shotcraft 品牌行（镜刻标志 + 小写品牌名）；整段极缓推近 1→1.015。
import React, { useId } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { Backdrop, EASE, FONT, ramp } from '../../_fixtures/Polish';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';
import { usePalette } from '../../_fixtures/Look';

export const MARKER_UNDERLINE_TITLE_DURATION = 75; // 标题 22f 落定 → f32–42 划线 → 静止 33f

/**
 * 配色槽位（usePalette）：四个默认值 = 本镜头原本的四个主色。
 *  - bg        ← 满版柔光浅底 <Backdrop tone="light"> 的内置三段渐变（#f6f6f4 0% / #efefec 55% / #e8e8e4 100%，
 *                写在 _fixtures/Polish.tsx），取中段停靠点 #efefec 作 fallback。默认仍原样铺内置渐变，
 *                用户改底色 / 选预设主题时才退成 PAL.bg 纯色（固定做法第 6 条）。
 *  - primary   ← 最显眼的品牌强调 = 马克笔下划线的暖调近黑墨 MARKER_INK #1b1916（原常量逐字符照抄）：
 *                本镜头唯一的"实体强调"就是这道画出 "new" 的笔划，全片招牌动作，改色看得见。
 *  - secondary ← 如实不挂位置（不造假槽位）：本文件只有「纸底 + 一支墨 + 这支马克笔墨」，
 *                没有第二支强调色。第二行品牌行在本仓是 <ShotcraftMark>（渲染 null）+ BRAND.name（已清空为空串），
 *                默认没有字形；把品牌行、阴影、渐变端点标成「次强调」都会变成拖了没反应的假控件，
 *                故 fallback 里镜像 primary 的同一支墨（不新造任何 hex），但不映射任何节点。
 *  - ink       ← 主文字色 = 118px 大标题 #17181c（原字面量逐字符照抄）。
 * 未传任何配色键时 PAL 与原字面量逐字符相同 → 默认画面零变化。
 */
const PALETTE_FALLBACK = { bg: '#efefec', primary: '#1b1916', secondary: '#1b1916', ink: '#17181c' };

const mulberry32 = (a: number) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 马克笔笔画：中轴微歪的路径 + 变宽轮廓，一次生成多边形
const buildStroke = (len: number, seed: number) => {
  const rand = mulberry32(seed);
  const N = 40;
  const top: string[] = [];
  const bot: string[] = [];
  // 预生成微歪偏移（低频）与毛糙（高频）
  const wob = Array.from({ length: N + 1 }, () => rand() - 0.5);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = t * len;
    // 中轴：跟随斜体微上斜（左低右高，对照截图）+ 缓波
    const mid = 19 - t * 9 + Math.sin(t * Math.PI * 1.6 + 0.4) * 2.6 + wob[i] * 1.6;
    // 宽度：起笔略细→中段饱满→收笔收尖，加高频毛糙
    const wBase = 14 + Math.sin(t * Math.PI) * 6 - Math.max(0, t - 0.86) * 46 - Math.max(0, 0.06 - t) * 70; // 起笔再收细一点，不再是平头
    const w = Math.max(2.2, wBase + wob[i] * 3);
    top.push(`${x.toFixed(1)},${(mid - w / 2).toFixed(1)}`);
    bot.push(`${x.toFixed(1)},${(mid + w / 2).toFixed(1)}`);
  }
  return `M${top.join('L')}L${bot.reverse().join('L')}Z`;
};

const LEN = 252;
const PATH = buildStroke(LEN, 77);
// 马克笔笔色（原有常量 MARKER_INK）改由配色槽位 primary 提供：
// 默认 PAL.primary === PALETTE_FALLBACK.primary === '#1b1916'（暖调近黑，不是纯黑），默认帧逐字符不变。

export const MarkerUnderlineTitle: React.FC = () => {
  // 配色槽位（usePalette）：本文件颜色全部写在本组件内（buildStroke 只是纯几何工具，不持有颜色），
  // 故只在主组件函数体顶层无条件调用一次。
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 竖屏变体（reflow）：9:16 下按短边重排——字号收到 72、下划线等比缩、左右留 72px 安全边，
  // 横屏（1920×1080）走的还是原来那套数字，默认帧零变化。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const titleSize = vertical ? 72 : 118;
  const strokeScale = vertical ? 0.61 : 1;
  // 可编辑文案（镜头参数）：首行文案 + 斜体高亮词；默认值与字面量逐字符一致
  const title = useShotProp('title', 'Meet the');
  const word = useShotProp('word', 'new');
  // SVG id 按实例生成，多实例同场不串引（useId 的 «:» 在 url() 里非法，需清洗）
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const revealId = `reveal-${uid}`;
  const dryId = `dry-${uid}`;

  // 标题两行错峰落定：同一条 snappy 进度驱动 y / blur / opacity
  const line = (delay: number): React.CSSProperties => {
    const e = ramp(frame, delay, 22, EASE.snappy);
    return {
      opacity: Math.min(1, e * 1.4),
      transform: `translateY(${(1 - e) * 36}px)`,
      filter: e < 0.999 ? `blur(${((1 - e) * 8).toFixed(2)}px)` : undefined,
    };
  };

  // 下划线：标题落定停一拍后描画，10 帧从左到右（提速一档），ease-out
  const draw = interpolate(frame, [32, 42], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const drawE = 1 - Math.pow(1 - draw, 2.2);
  // 整段极缓推近（smooth，起止速度为 0）
  const push = 1 + 0.015 * ramp(frame, 0, 74, EASE.smooth);

  return (
    <AbsoluteFill>
      {/* 舞台底色：默认仍铺 <Backdrop> 内置的柔光三段渐变（写在 _fixtures/Polish.tsx，本文件改不到），
          用户改底色 / 选预设主题（PAL.isCustom）时才退成 PAL.bg 纯色，这样检查器改底色才真正可见。
          主光位置 / 暗角 0.12 / 颗粒 0.05 全部未动。 */}
      <Backdrop
        tone="light" light={{ x: 0.42, y: 0.3 }} vignette={0.12} grain={0.05}
        solid={PAL.isCustom ? PAL.bg : undefined}
      />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${push})` }}>
        <div style={{
          fontFamily: FONT.sans,
          // 主文字色（118px 大标题与其中的斜体高亮词）：原 #17181c → PAL.ink
          fontWeight: 700, fontSize: titleSize, color: PAL.ink,
          textAlign: 'center', lineHeight: 1.12, letterSpacing: '-0.028em',
          padding: vertical ? '0 72px' : undefined,
        }}>
          <div style={line(0)}>
            {title}{' '}
            <span style={{ fontStyle: 'italic', position: 'relative', display: 'inline-block' }}>
              {word}
              {/* 马克笔下划线：clip 从左到右揭示，保留笔形本身的粗细变化 */}
              <svg
                width={LEN * strokeScale} height={44 * strokeScale} viewBox={`0 0 ${LEN} 44`}
                style={{
                  position: 'absolute',
                  left: -12 * strokeScale,
                  bottom: -20 * strokeScale,
                  overflow: 'visible',
                  mixBlendMode: 'multiply',
                }}
              >
                <defs>
                  <clipPath id={revealId}>
                    <rect x={0} y={-20} width={drawE * (LEN + 6)} height={60} />
                  </clipPath>
                  {/* 干笔肌理：低频位移 → 毛糙边；高频噪声阈值 → 细碎飞白（固定 seed，确定性） */}
                  <filter id={dryId} x="-5%" y="-40%" width="110%" height="180%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency="0.09 0.5" numOctaves={2} seed={7} result="warp" />
                    <feDisplacementMap in="SourceGraphic" in2="warp" scale={1.8} xChannelSelector="R" yChannelSelector="G" result="rough" />
                    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.9" numOctaves={2} seed={19} result="grain" />
                    <feColorMatrix in="grain" type="matrix"
                      values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 11.4" result="holes" />
                    <feComposite in="rough" in2="holes" operator="in" />
                  </filter>
                </defs>
                {draw > 0 && (
                  <g clipPath={`url(#${revealId})`}>
                    {/* 马克笔笔色：全片唯一实体强调 → PAL.primary（fillOpacity 0.94 与 multiply 混合未动） */}
                    <path d={PATH} fill={PAL.primary} fillOpacity={0.94} filter={`url(#${dryId})`} />
                  </g>
                )}
              </svg>
            </span>
          </div>
          <div style={{ ...line(4), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
            <ShotcraftMark size={vertical ? 68 : 112} tone="light" />
            <span>{BRAND.name}</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
