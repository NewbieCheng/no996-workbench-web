// @ts-nocheck
// glass-pill-dictation-typing — Glass Pill Dictation 玻璃胶囊听写
// 一条定宽玻璃胶囊以约 1.25 倍略大浮现、缓落到位；胶囊内部自左淡到右浓铺一层暖光（"在等你开口"）；
// 光标先行，随后听写的句子匀速打出，光随打字进度渐渐退去，收尾成一条中性的磨砂玻璃条。
// 全片最安静的一拍：只做三件事——落位、打字、光退。
//
// 第二轮重设计（沙色日光 · 磨砂玻璃）：
// - look = sand（米色 + 赤陶）。从近黑底换成午后日光的亮场：胶囊背后是一轮暖色"太阳"和几团柔光，
//   胶囊用 backdrop-filter 真磨砂（背后的光被它晕开），顶沿白色高光线、上亮下暗的体积、暖色两层落地影。
// - 主体放大到"看得见材质"：1240×132 的胶囊、56px 听写字、92px 圆形声波按钮；画面只有胶囊 + 底部一枚 video-shotcraft 品牌小标。
// - 光的因果做满三层，都挂在同一个 g（1→0）上：胶囊内的赤陶→杏色渐层、背后那轮暖光、胶囊下方的地面反光，
//   一起随打字退去；声波按钮从"实心暖色"退成"描边中性色"。
// - 曲线：落位 scale 1.25→1 用强 ease-out（snappy，20f），opacity 前 2f 就满（先"在了"再落位），
//   落位前半段带一点景深虚化（离镜头更近）；打字匀速 2f/字（听写不犹豫）；光退 smooth in-out。
//
// 时间表（30fps，共 100f）：
//   0–2      胶囊整体出现（opacity 满），光在最亮
//   0–20     落位：scale 1.25→1（snappy）+ 虚化 6px→0（前 14f）；2f 光标先行
//   8–64     打字：28 字匀速（2f/字）
//   10–72    光退：g 1→0（smooth），三层光与声波按钮同步
//   66–74    光标撤掉
//   74–100   hold：中性磨砂玻璃条 + 句子，环境光极缓呼吸
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from '../../../runtime/index.ts';
import { EASE, ramp, mix } from '../../_fixtures/Polish';
import { LOOKS, Stage, alpha, type, useLook} from '../../_fixtures/Look';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';
import { useShotProp } from '../../../runtime/frame-context.tsx';

export const GLASS_PILL_DICTATION_TYPING_DURATION = 100;

// 内嵌光：赤陶 → 杏色（换品牌色只改这两个）
const WARM = '#d9643a';
const APRICOT = '#ffb070';

const PW = 1240; // 定宽：不随打字伸缩（伸缩会读作 chip 而不是输入条）
const PH = 132;
const PX = (1920 - PW) / 2;
const PY = 540 - PH / 2;
const BTN = 92;
const BARS = [30, 16, 24, 13, 20]; // 声波竖条基准高（左高右低的听写图标）
const TEXT = 'Cut a launch film for my app'; // 28 字，与原句同长：打字窗口 8–64f 不变
const TYPE0 = 8;
const CPF = 2; // 帧/字（匀速）

// 竖屏安全区（相对 1080×1920 画布）：上 180 / 下 320。只在竖屏分支里参与算垂直居中。
const SAFE_TOP = 180;
const SAFE_BOTTOM = 320;
// 竖屏设计基准：下面所有竖屏数字（936 胶囊 / 104 高 / 38 字号 …）都是这套 1080×1920 下的设计值。
// 渲染器给别的尺寸时（验证页按 540×960 渲染同一支片子）必须按短边等比换算，
// 否则 936 的胶囊在 540 画布里等于 1872：胶囊左端整段出画，成片只剩「nch film for|」。
const V_DESIGN_W = 1080;
const V_DESIGN_H = 1920;

const hexRgb = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixHex = (a: string, b: string, t: number) => {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};

export const GlassPillDictationTyping: React.FC = () => {
  const L = useLook('sand');
  const f = useCurrentFrame();
  const text = useShotProp('text', TEXT);
  const caption = useShotProp('caption', 'speak or type');

  // 竖屏变体（reflow）：9:16 下按短边重排——1240 的超宽胶囊在 1080 里放不下，
  // 收窄到「画布宽 - 左右各 72」= 936；听写字 56→38（0.68×）、声波按钮 92→64（0.7×）、
  // 光标 62→46、声波竖条 0.7×，整条胶囊竖直居中于安全区（上 180 / 下 320），
  // 背后那轮"太阳"和几团柔光按窄画布重新落位，不动字号之外的任何时间/动画值。
  //
  // 竖屏所有数值都以 1080×1920 为设计基准，必须乘 vk（= 画布短边 / 1080）换算到实际画布：
  // 真机/导出是 1080×1920，vk=1，与设计值一致；验证页/预览用 540×960，vk=0.5，
  // 胶囊 468、字号 19、安全区 90/160 —— 若把 936 写死，540 画布里胶囊等于 1872，左端出画。
  // 横屏（1920×1080）走 else 侧：vk 不参与，每个数字仍是原来的 PW/PH/PX/PY 与 56/92/62/…，逐像素不变。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const vk = vertical ? Math.min(width / V_DESIGN_W, height / V_DESIGN_H) : 1;
  /** 竖屏设计值 → 当前画布像素（横屏分支不调用，横屏数字全部保持字面量） */
  const V = (n: number) => n * vk;
  const safeTop = V(SAFE_TOP);
  const safeBottom = V(SAFE_BOTTOM);
  // 胶囊几何：横屏原样 PW/PH/PX/PY（PX = (1920 - PW) / 2，PY = 540 - PH / 2）
  // 竖屏宽度不再写死 936，而是「真实画布宽 - 左右 72×vk」：任何竖屏尺寸都留得下 72 安全边。
  const pillW = vertical ? width - V(144) : PW;
  const pillH = vertical ? V(104) : PH;
  const pillX = vertical ? (width - pillW) / 2 : PX;
  const pillY = vertical ? safeTop + (height - safeTop - safeBottom - pillH) / 2 : PY;
  // 竖屏控件缩放（只缩尺寸，不碰位移/曲线）
  const textSize = vertical ? V(38) : 56;
  const btnSize = vertical ? V(64) : BTN;
  const caretW = vertical ? V(3) : 4;
  const caretH = vertical ? V(46) : 62;
  const barScale = vertical ? 0.7 * vk : 1;
  // 品牌小标：竖屏抬到底部安全区之上（340 > 320），字号 0.7×
  const markSize = vertical ? V(24) : 34;
  const brandSize = vertical ? V(21) : 30;
  const brandGap = vertical ? V(10) : 14;
  const brandBottom = vertical ? V(340) : 112;
  const pillPad = vertical ? `0 ${V(16)}px 0 ${V(40)}px` : '0 20px 0 58px';
  // 听写文字在竖屏里的上限：胶囊内宽扣掉光标与声波按钮，长文案只会留在胶囊里，不会把按钮顶出画
  const textMaxWidth = vertical ? pillW - V(40 + 16 + 3 + 4 + 64 + 8) : undefined;

  // 背景光："太阳"在横屏是 (1330, 470) 1100×900；竖屏改挂到胶囊右段后方（0.8 处），
  // 尺寸收小让窄画布上仍读作"光在玻璃后面"，不会被裁成边角。
  const glow = vertical
    ? { x: pillX + pillW * 0.8, y: pillY + pillH / 2 - V(70), w: V(760), h: V(720) }
    : { x: 1330, y: 470, w: 1100, h: 900 };

  // 远景柔光：横屏原三团位置逐字照抄；竖屏按 1080×1920 设计基准重排并随 vk 缩放，
  // 避免 x=1460 这类横屏坐标跑到画布外。
  const blobs = vertical
    ? [
        { x: V(280), y: V(790), r: V(170), c: '#fff4e4', a: 0.9 },
        { x: V(520), y: V(1090), r: V(130), c: '#e9b08a', a: 0.35 },
        { x: V(860), y: V(1120), r: V(150), c: '#f6d2a8', a: 0.55 },
      ]
    : [
        { x: 520, y: 470, r: 220, c: '#fff4e4', a: 0.9 },
        { x: 820, y: 620, r: 160, c: '#e9b08a', a: 0.35 },
        { x: 1460, y: 610, r: 200, c: '#f6d2a8', a: 0.55 },
      ];

  const appear = ramp(f, 0, 2, EASE.linear);
  const land = ramp(f, 0, 20, EASE.snappy);
  const s = mix(1.25, 1, land);
  const defocus = 6 * (1 - ramp(f, 0, 14, EASE.out));
  const n = Math.floor(Math.min(1, Math.max(0, (f - TYPE0) / (text.length * CPF))) * text.length + 1e-6);
  const caret = ramp(f, 2, 2, EASE.linear) * (1 - ramp(f, 66, 8, EASE.out));
  const g = 1 - ramp(f, 10, 62, EASE.smooth); // 光：随打字退去
  const breathe = 0.5 + 0.5 * Math.sin(f / 22);

  return (
    <AbsoluteFill style={{ background: L.bg[1], overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.36, y: 0.12 }} fill={{ x: 0.8, y: 0.9 }} vignette={0.22}>
        {/* 胶囊背后的"太阳"：暖光主体，跟胶囊内的光一起退到只剩一点余温 */}
        {/* 光心压在胶囊右段正后方：磨砂玻璃把它晕开，读作"光在玻璃后面/里面" */}
        <div style={{
          position: 'absolute', left: glow.x, top: glow.y, width: glow.w, height: glow.h, marginLeft: -glow.w / 2, marginTop: -glow.h / 2, borderRadius: '50%',
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(APRICOT, 0.15 + 0.6 * g)} 0%, ${alpha(APRICOT, 0.1 + 0.42 * g)} 18%, ${alpha(WARM, 0.06 + 0.26 * g)} 40%, ${alpha(WARM, 0.02 + 0.08 * g)} 62%, ${alpha(WARM, 0)} 80%)`,
        }} />
        {/* 几团远景柔光（磨砂玻璃后面要有东西可晕） */}
        {blobs.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: b.x - b.r + Math.sin(f / 40 + i) * 6, top: b.y - b.r, width: b.r * 2, height: b.r * 2, borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(b.c, b.a)} 0%, ${alpha(b.c, 0)} 70%)`,
          }} />
        ))}
        {/* 地面反光：胶囊下方一抹暖色，随 g 熄灭 */}
        <div style={{
          position: 'absolute', left: pillX + pillW * 0.35, width: pillW * 0.75, top: pillY + pillH * 0.9, height: vertical ? V(220) : 220,
          background: `radial-gradient(ellipse 50% 40% at 60% 20%, ${alpha(WARM, 0.22 * g)} 0%, ${alpha(WARM, 0)} 72%)`,
          opacity: appear,
        }} />
      </Stage>

      {/* 胶囊本体 */}
      <div style={{
        position: 'absolute', left: pillX, top: pillY, width: pillW, height: pillH, borderRadius: pillH / 2, overflow: 'hidden', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', padding: pillPad, opacity: appear,
        transform: `scale(${s})`, filter: defocus > 0.05 ? `blur(${defocus.toFixed(2)}px)` : undefined,
        background: `linear-gradient(180deg, ${alpha('#ffffff', 0.62)} 0%, ${alpha('#fffaf3', 0.42)} 55%, ${alpha('#f3e7d8', 0.5)} 100%)`,
        backdropFilter: 'blur(26px) saturate(1.3)', WebkitBackdropFilter: 'blur(26px) saturate(1.3)',
        border: `${vertical ? V(1.5) : 1.5}px solid ${alpha('#ffffff', 0.85)}`,
        // 落地影两层（近地小而实 + 远地大而虚，落位时收紧）直接挂在胶囊上，与玻璃同一个圆角
        boxShadow: `0 0 0 1px ${alpha(L.shadow, 0.07)}, inset 0 2px 0 ${alpha('#ffffff', 0.95)}, inset 0 -10px 24px ${alpha('#c9a888', 0.22)}, ` +
          `0 ${mix(10, 4, land).toFixed(1)}px ${mix(20, 10, land).toFixed(1)}px ${alpha(L.shadow, 0.12)}, 0 ${mix(60, 36, land).toFixed(1)}px 70px -28px ${alpha(L.shadow, 0.4)}, ` +
          `0 0 ${60 * g}px ${alpha(APRICOT, 0.45 * g)}`,
      }}>
        {/* 内嵌暖光：左淡右浓，随打字退去（光在玻璃里面，不是外部光晕） */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: g,
          background: `linear-gradient(90deg, ${alpha(WARM, 0)} 0%, ${alpha(WARM, 0.18)} 38%, ${alpha(WARM, 0.62)} 78%, ${alpha(APRICOT, 0.95)} 100%)`,
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: g * 0.7, mixBlendMode: 'screen',
          background: `radial-gradient(ellipse 34% 130% at 100% 100%, ${alpha('#ffe2b8', 0.9)} 0%, ${alpha('#ffe2b8', 0)} 70%)`,
        }} />
        {/* 顶沿高光线：两端渐隐，裁在圆角里 */}
        <div style={{
          position: 'absolute', left: pillH * 0.45, right: pillH * 0.45, top: vertical ? V(3) : 3, height: vertical ? V(1.5) : 1.5, pointerEvents: 'none',
          background: `linear-gradient(90deg, ${alpha('#ffffff', 0)}, ${alpha('#ffffff', 0.95)} 20%, ${alpha('#ffffff', 0.7)} 75%, ${alpha('#ffffff', 0)})`,
        }} />
        {/* 听写文字 + 光标（竖屏给文字一个画布内上限：长文案留在胶囊里，不把声波按钮顶出右边） */}
        <div style={{ position: 'relative', ...type(textSize, 500), letterSpacing: '-0.015em', color: L.ink, whiteSpace: 'pre', flex: 'none', maxWidth: textMaxWidth, overflow: vertical ? 'hidden' : undefined }}>
          {text.slice(0, n)}
        </div>
        <div style={{
          position: 'relative', width: caretW, height: caretH, marginLeft: vertical ? V(4) : 4, borderRadius: 2, flex: 'none', opacity: caret,
          background: mixHex(L.ink, WARM, 0.8 * g),
        }} />
        {/* 声波按钮：实心暖色 → 描边中性 */}
        <div style={{
          position: 'relative', marginLeft: 'auto', width: btnSize, height: btnSize, borderRadius: btnSize / 2, flex: 'none', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 * barScale,
          background: `linear-gradient(180deg, ${alpha('#ffffff', 0.35 * g)}, ${alpha('#ffffff', 0)}), ${alpha(WARM, 0.92 * g)}`,
          border: `1.5px solid ${g > 0.5 ? alpha('#ffffff', 0.5) : alpha(L.ink, 0.16 + 0.1 * (1 - g))}`,
          boxShadow: `inset 0 1.5px 0 ${alpha('#ffffff', 0.5)}, 0 ${6 * g}px ${18 * g}px -6px ${alpha(WARM, 0.8 * g)}`,
        }}>
          {BARS.map((h, i) => (
            <div key={i} style={{
              width: 5 * barScale, borderRadius: 3, height: h * barScale + 2.4 * barScale * Math.sin(f * 0.5 + i * 1.7),
              background: mixHex(L.ink2, '#fffaf3', g),
            }} />
          ))}
        </div>
      </div>

      {/* 品牌小标（静态，跟胶囊一起出现，不抢戏） */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: brandBottom, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: brandGap,
        opacity: ramp(f, 4, 16, EASE.out) * (0.9 + 0.1 * breathe),
      }}>
        <ShotcraftMark size={markSize} tone="light" />
        <span style={{ ...type(brandSize, 650), color: L.ink2 }}>{BRAND.name}</span>
        <span style={{ ...type(brandSize, 450), color: L.ink3 }}>· {caption}</span>
      </div>
    </AbsoluteFill>
  );
};
