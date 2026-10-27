// @ts-nocheck
// portal-wipe 穿窗入景（纵深款）——网格里一张卡放大成全屏窗口，窗内是被点开那张卡的"世界"，
// 只 2 层视差（远景面板 0.08 + 近景 2 枚浮卡 0.3，不加 blur），穿窗完成后 8f 缓停 → 静止读清新景。
//
// 第二轮重设计（瓷白工作台 → 钴蓝预测世界）：
// - look = porcelain（冷白 · 钴蓝）。不再用通用灰阶 FakeDashboard：外景是为镜头设计的 video-shotcraft
//   「Workspace」主页（眉题前挂字标）——96px 问候标题 + 3×2 张「影片项目」卡，每张卡有自己的程序化封面
//   （同心圆 / 柱 / 点阵 / 斜纹 / 弧 / 波形）、40px 标题与 32px 元信息。目标卡 = 第 2 行居中的
//   「Premiere Forecast」（发布片的观看量预测，钴蓝封面 + 三道波形）。
// - 语义闭环：目标卡的**封面就是窗内世界的样子**——窗内是深钴蓝空间，三道同款波形放大成背景地貌；
//   远景层 = 一块玻璃预测面板（64px 标题 + 面积图：实线历史 + 虚线预测区间 + TODAY 标线），
//   近景层 = 两枚浮卡（+18.4% vs last launch / 94% confidence 环），落点压住面板两角，做出前后景。
// - 运动：目标卡先悬浮抬起作预备（−10px、1.03×、阴影变大变虚），邻卡同时退暗；窗放大 40f 用
//   bezier(0.7,0,0.3,1) 先慢后快再缓收；窗内整景 0.42→1 与窗几何同一个 t；面积图的线随 t 画出、
//   与穿窗同时完成；视差散开 Easing.out(cubic) 在穿窗完成后 8f 内速度归零，之后画面真静止。
//
// 竖屏变体（reflow，9:16 1080×1920）：外层容器把 useVideoConfig 的 width/height 设成真实画布，
// vertical = height > width。竖屏只重排布局，不动时间表 / 缓动 / 文案键 / 配色：
//   · 外景网格 3 列 → 单列堆叠（卡宽 1080−144 = 936，封面改为左侧 288px 缩略图，右侧标题+元信息），
//     6 张卡落在 y 400–1560（安全区上 180 / 下 320 之内），字号 96→56、40→28、32→20。
//   · 窗放大终点由 1920×1080 改为 width×height（横屏仍是 1920×1080，逐像素不变）。
//   · 窗内世界：预测面板 1240×660 → 936×800（左 72 / 上 380），图表区 1112×360 → 824×460；
//     两枚浮卡从左右角改为上下压角（A 压面板右上、B 压面板左下），远景背景波形按 1080 宽重画。
// 横屏（1920×1080）下 vertical = false，每个 vertical ? A : B 的 B 都还是改前的字面量（TILE / GRID_X /
// GRID_Y / CH / 960×540 / 1920×1080 …），因此默认帧逐像素不变。
//
// 时间表（30fps，共 140f）：
//   0–14    hold：Workspace 主页建立（第 0 帧即完整画面）
//   14–26   预备：目标卡抬起、邻卡退暗 18%
//   26–66   窗放大 40f：卡变全屏窗，卡面 0–28% 行程内渐隐露出窗内世界（再慢会被拉成巨字残影）
//   42–74   近/远两层视差散开（66f 穿窗完成后 8f 缓停）
//   74–140  静止 hold 66f：新世界完整可读
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { EASE, FONT, ramp, mix, softShadow } from '../../_fixtures/Polish';
import { LOOKS, Stage, alpha, type, useLook} from '../../_fixtures/Look';
import { ShotcraftWordmark } from '../../_fixtures/Brand';

export const PORTAL_WIPE_V2_DURATION = 140;

const COBALT = { deep: '#040a26', mid: '#0b1a5c', hi: '#2f5bff', glow: '#7d9bff', mint: '#3fe0c5' };

// ───────── 外景：Workspace 网格 ─────────
const TILE = { w: 520, h: 300, gap: 32, cover: 176 };
const GRID_X = (1920 - (3 * TILE.w + 2 * TILE.gap)) / 2;
const GRID_Y = 330;
type Space = { name: string; meta: string; art: 'rings' | 'bars' | 'dots' | 'stripes' | 'waves' | 'arcs'; c: [string, string] };
const SPACES: Space[] = [
  { name: 'Launch Film', meta: 'Promo · 12 shots', art: 'rings', c: ['#ff9a6b', '#ff5f6d'] },
  { name: 'Changelog Reel', meta: 'Release · 8 shots', art: 'bars', c: ['#4fd1a5', '#1f9e89'] },
  { name: 'Onboarding Tour', meta: 'Explainer · 21 shots', art: 'dots', c: ['#b9a2ff', '#7a5cff'] },
  { name: 'Ink Press Teaser', meta: 'Template · 5 shots', art: 'stripes', c: ['#f2c879', '#d99a3e'] },
  { name: 'Premiere Forecast', meta: 'Analytics · 9 films', art: 'waves', c: ['#3d6bff', '#0f2a9e'] },
  { name: 'Render Queue', meta: 'Renders · 14 jobs', art: 'arcs', c: ['#5cc8e8', '#2a7fb8'] },
];
const TARGET = 4;

// 卡片几何：横屏 = 原 3 列网格（TILE / GRID_X / GRID_Y 原数字不动）；
// 竖屏 = 单列堆叠：卡宽 1080−144 = 936，左侧 288px 封面 + 右侧文字，纵向 6 张卡收在安全区内。
type Geo = {
  w: number; h: number; gap: number; cols: number; x0: number; y0: number; radius: number;
  coverW: number; coverH: number; padX: number; titleTop: number; titleSize: number; metaTop: number; metaSize: number;
};

const GEO_H: Geo = {
  w: TILE.w, h: TILE.h, gap: TILE.gap, cols: 3, x0: GRID_X, y0: GRID_Y, radius: 22,
  coverW: TILE.w, coverH: TILE.cover, padX: 26,
  titleTop: TILE.cover + 22, titleSize: 40,
  metaTop: TILE.cover + 74, metaSize: 32,
};

// 竖屏：y0 400 + 6 张（180 高 + 16 间距）= 1560，收在 180/320 安全区内；字号 40→28、32→20
const GEO_V: Geo = {
  w: 936, h: 180, gap: 16, cols: 1, x0: 72, y0: 400, radius: 18,
  coverW: 288, coverH: 180, padX: 322,
  titleTop: 58, titleSize: 28,
  metaTop: 104, metaSize: 20,
};

const slotOf = (i: number, geo: Geo) => ({ x: geo.x0 + (i % geo.cols) * (geo.w + geo.gap), y: geo.y0 + Math.floor(i / geo.cols) * (geo.h + geo.gap) });

// 三道波形（封面与窗内世界共用同一组曲线 = 语义闭环）
const wavePath = (w: number, h: number, k: number, phase: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const x = (i / 48) * w;
    const y = h * (0.62 - 0.1 * k) + Math.sin(i / 48 * Math.PI * 2.2 + phase + k * 0.9) * h * 0.11 - (i / 48) * h * 0.16;
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
};

const Cover: React.FC<{ s: Space; w: number; h: number }> = ({ s, w, h }) => {
  const stroke = 'rgba(255,255,255,0.55)';
  let art: React.ReactNode = null;
  if (s.art === 'rings') art = [0, 1, 2, 3, 4].map((k) => <circle key={k} cx={w * 0.78} cy={h * 0.62} r={30 + k * 34} fill="none" stroke={stroke} strokeWidth={2} opacity={1 - k * 0.16} />);
  if (s.art === 'bars') art = Array.from({ length: 9 }, (_, k) => { const bh = h * (0.25 + 0.5 * Math.abs(Math.sin(k * 1.3 + 0.6))); return <rect key={k} x={w * 0.42 + k * 30} y={h - bh} width={16} height={bh} rx={4} fill="rgba(255,255,255,0.42)" />; });
  if (s.art === 'dots') art = Array.from({ length: 40 }, (_, k) => <circle key={k} cx={w * 0.46 + (k % 10) * 26} cy={h * 0.2 + Math.floor(k / 10) * 32} r={4 + ((k * 7) % 5)} fill="rgba(255,255,255,0.45)" />);
  if (s.art === 'stripes') art = Array.from({ length: 12 }, (_, k) => <line key={k} x1={w * 0.3 + k * 34} y1={h + 10} x2={w * 0.3 + k * 34 + 120} y2={-10} stroke={stroke} strokeWidth={10} opacity={0.5} />);
  if (s.art === 'arcs') art = [0, 1, 2, 3].map((k) => <path key={k} d={`M ${w * 0.35} ${h + 4} A ${90 + k * 46} ${90 + k * 46} 0 0 1 ${w * 0.35 + 2 * (90 + k * 46)} ${h + 4}`} fill="none" stroke={stroke} strokeWidth={2.5} />);
  if (s.art === 'waves') art = [0, 1, 2].map((k) => <path key={k} d={wavePath(w, h, k, 0)} fill="none" stroke={k === 0 ? COBALT.mint : stroke} strokeWidth={k === 0 ? 4 : 2.5} />);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, background: `linear-gradient(135deg, ${s.c[0]} 0%, ${s.c[1]} 100%)`, overflow: 'hidden' }}>
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>{art}</svg>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 40%)' }} />
    </div>
  );
};

const Tile: React.FC<{ s: Space; geo: Geo }> = ({ s, geo }) => {
  const L = useLook('porcelain');
  return (
  <div style={{ position: 'absolute', inset: 0, borderRadius: geo.radius, overflow: 'hidden', background: L.surface, border: `1px solid ${L.line}` }}>
    {/* 竖屏把封面收成左侧 288×180 缩略图，横屏仍是整卡宽 520×176 的顶图（geo 里存原数字） */}
    <div style={{ position: 'absolute', left: 0, top: 0, width: geo.coverW, height: geo.coverH, overflow: 'hidden' }}>
      <Cover s={s} w={geo.coverW} h={geo.coverH} />
    </div>
    <div style={{ position: 'absolute', left: geo.padX, top: geo.titleTop, ...type(geo.titleSize, 650), color: L.ink, whiteSpace: 'nowrap' }}>{s.name}</div>
    <div style={{ position: 'absolute', left: geo.padX, top: geo.metaTop, ...type(geo.metaSize, 450), color: L.ink3, whiteSpace: 'nowrap' }}>{s.meta}</div>
  </div>
  );
};

// ───────── 窗内世界：钴蓝预测空间 ─────────
// 预测曲线：确定性序列（0–39 历史实线，39–59 预测虚线 + 区间带）
const SERIES = Array.from({ length: 60 }, (_, i) => 0.28 + i * 0.007 + 0.065 * Math.sin(i * 0.55) + 0.02 * Math.sin(i * 1.7 + 1));
const NOW = 39;
const CH = { x: 64, y: 196, w: 1112, h: 360 }; // 横屏图表区（原数字）
const CH_V = { x: 56, y: 230, w: 824, h: 460 }; // 竖屏图表区：面板 936 宽，左右各留 56
type ChartBox = { x: number; y: number; w: number; h: number };
// 曲线/面积/区间带由图表框推导：横屏用 CH 走的是原来那串数字，竖屏用 CH_V 按 1080 宽重算
const makeChart = (B: ChartBox) => {
  const px = (i: number) => B.x + (i / 59) * B.w;
  const py = (v: number) => B.y + B.h * (1 - v);
  const line = (a: number, b: number) => SERIES.slice(a, b + 1).map((v, k) => `${k ? 'L' : 'M'}${px(a + k).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  const up = SERIES.slice(NOW).map((v, k) => `${k ? 'L' : 'M'}${px(NOW + k).toFixed(1)} ${py(v + 0.02 + k * 0.006).toFixed(1)}`).join(' ');
  const dn = SERIES.slice(NOW).map((v, k) => [px(NOW + k), py(v - 0.02 - k * 0.006)] as const).reverse().map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const BAND = `${up} ${dn} Z`;
  const AREA = `${line(0, NOW)} L${px(NOW).toFixed(1)} ${B.y + B.h} L${px(0).toFixed(1)} ${B.y + B.h} Z`;
  return { px, py, line, BAND, AREA };
};
const CHART_H = makeChart(CH);
const CHART_V = makeChart(CH_V);

const glass: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(160,185,255,0.13) 0%, rgba(120,150,255,0.05) 100%)',
  border: '1px solid rgba(190,210,255,0.18)',
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 50px 120px -30px rgba(0,2,20,0.8), 0 14px 36px rgba(0,2,20,0.45)`,
};

// 预测面板几何：横屏 1240×660（原数字）；竖屏 936×800 放到 72/380，收进 1080 宽画布
type PanelGeo = {
  left: number; top: number; w: number; h: number; radius: number; pad: number;
  eyebrowTop: number; eyebrowSize: number; titleTop: number; titleSize: number;
  legendTop: number; legendSize: number; legendGap: number; monthsBottom: number; monthsSize: number;
};
const PANEL_H: PanelGeo = {
  left: 340, top: 200, w: 1240, h: 660, radius: 30, pad: 64,
  eyebrowTop: 52, eyebrowSize: 28, titleTop: 96, titleSize: 64,
  legendTop: 112, legendSize: 32, legendGap: 34, monthsBottom: 46, monthsSize: 28,
};
const PANEL_V: PanelGeo = {
  left: 72, top: 380, w: 936, h: 800, radius: 26, pad: 56,
  eyebrowTop: 46, eyebrowSize: 20, titleTop: 84, titleSize: 40,
  legendTop: 148, legendSize: 22, legendGap: 24, monthsBottom: 44, monthsSize: 20,
};

const ForecastPanel: React.FC<{ draw: number; vertical: boolean }> = ({ draw, vertical }) => {
  const P = vertical ? PANEL_V : PANEL_H;
  const B = vertical ? CH_V : CH;
  const C = vertical ? CHART_V : CHART_H;
  return (
  <div style={{ position: 'absolute', left: P.left, top: P.top, width: P.w, height: P.h, borderRadius: P.radius, overflow: 'hidden', ...glass }}>
    <div style={{ position: 'absolute', left: P.pad, top: P.eyebrowTop, ...type(P.eyebrowSize, 600, { mono: true }), color: COBALT.glow, letterSpacing: '0.16em' }}>PROJECT · ANALYTICS</div>
    <div style={{ position: 'absolute', left: P.pad, top: P.titleTop, ...type(P.titleSize, 700), color: '#f2f5ff' }}>Premiere Forecast</div>
    {/* 图例：横屏贴面板右上，竖屏 936 宽放不下右侧 → 改到标题下方左对齐 */}
    <div style={{ position: 'absolute', ...(vertical ? { left: P.pad } : { right: P.pad }), top: P.legendTop, display: 'flex', gap: P.legendGap, ...type(P.legendSize, 500), color: '#a9b8e8' }}>
      <span><span style={{ display: 'inline-block', width: 28, height: 4, borderRadius: 2, background: COBALT.mint, verticalAlign: 'middle', marginRight: 12 }} />Views</span>
      <span><span style={{ display: 'inline-block', width: 28, height: 4, borderRadius: 2, borderTop: `3px dashed ${COBALT.glow}`, verticalAlign: 'middle', marginRight: 12 }} />Next 90 days</span>
    </div>
    <svg width={P.w} height={P.h} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="pw-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={COBALT.mint} stopOpacity={0.32} />
          <stop offset="1" stopColor={COBALT.mint} stopOpacity={0} />
        </linearGradient>
        <clipPath id="pw-draw"><rect x={0} y={0} width={B.x + B.w * draw + 4} height={P.h} /></clipPath>
      </defs>
      {[0, 1, 2, 3].map((k) => <line key={k} x1={B.x} x2={B.x + B.w} y1={B.y + (B.h / 3) * k} y2={B.y + (B.h / 3) * k} stroke="rgba(190,210,255,0.1)" strokeWidth={1.5} />)}
      <g clipPath="url(#pw-draw)">
        <path d={C.AREA} fill="url(#pw-area)" />
        <path d={C.BAND} fill={alpha(COBALT.glow, 0.16)} />
        <path d={C.line(0, NOW)} fill="none" stroke={COBALT.mint} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        <path d={C.line(NOW, 59)} fill="none" stroke={COBALT.glow} strokeWidth={4} strokeDasharray="12 10" strokeLinecap="round" />
      </g>
      {draw > 0.66 && (
        <g opacity={Math.min(1, (draw - 0.66) * 6)}>
          <line x1={C.px(NOW)} x2={C.px(NOW)} y1={B.y - 16} y2={B.y + B.h} stroke="rgba(230,238,255,0.45)" strokeWidth={1.5} strokeDasharray="4 6" />
          <circle cx={C.px(NOW)} cy={C.py(SERIES[NOW])} r={10} fill={COBALT.deep} stroke={COBALT.mint} strokeWidth={4} />
          <text x={C.px(NOW) + 16} y={B.y - 2} fontFamily={FONT.mono} fontSize={vertical ? 20 : 24} fill="#a9b8e8" letterSpacing="0.12em">TODAY</text>
        </g>
      )}
    </svg>
    <div style={{ position: 'absolute', left: P.pad, bottom: P.monthsBottom, right: P.pad, display: 'flex', justifyContent: 'space-between', ...type(P.monthsSize, 500, { mono: true }), color: '#6f7fae' }}>
      <span /><span>MAY</span><span>JUN</span><span>JUL</span><span>AUG</span><span>SEP</span>
    </div>
  </div>
  );
};

// 近景两枚浮卡的**终点**（散开 ×1.3 之后），按画布中心反推散开前的位置
const NEAR_K = 1.3;
const nearPos = (x: number, y: number, cx: number, cy: number) => ({ x: cx + (x - cx) / NEAR_K, y: cy + (y - cy) / NEAR_K });
const CHIP_A = nearPos(1380, 64, 960, 540); // 横屏右上：压住面板右上角
const CHIP_B = nearPos(104, 790, 960, 540); // 横屏左下：压住面板左下角
// 竖屏：A 压面板右上（600,268 → 1000×458）、B 压面板左下（72,1120 → 492×1300），绕 540/960 反推
const CHIP_A_V = nearPos(600, 268, 540, 960);
const CHIP_B_V = nearPos(72, 1120, 540, 960);

// 浮卡几何：w/h/r 为终值，内部坐标同样按 NEAR_K 反推；横屏那组就是原数字（400/200/22、120 环 …）
type ChipGeo = {
  pos: { x: number; y: number }; w: number; h: number; r: number;
  big: { size: number; x: number; y: number }; small: { size: number; x: number; y: number };
  donut?: { size: number; x: number; y: number };
};
const CHIP_A_H: ChipGeo = { pos: CHIP_A, w: 400, h: 200, r: 22, big: { size: 84, x: 30, y: 26 }, small: { size: 32, x: 32, y: 128 } };
const CHIP_B_H: ChipGeo = { pos: CHIP_B, w: 420, h: 180, r: 22, big: { size: 64, x: 172, y: 34 }, small: { size: 32, x: 174, y: 108 }, donut: { size: 120, x: 28, y: 30 } };
const CHIP_A_VG: ChipGeo = { pos: CHIP_A_V, w: 400, h: 190, r: 22, big: { size: 60, x: 28, y: 32 }, small: { size: 22, x: 30, y: 122 } };
const CHIP_B_VG: ChipGeo = { pos: CHIP_B_V, w: 420, h: 180, r: 22, big: { size: 44, x: 150, y: 34 }, small: { size: 22, x: 152, y: 96 }, donut: { size: 96, x: 24, y: 42 } };

const World: React.FC<{ spread: number; draw: number; vertical: boolean }> = ({ spread, draw, vertical }) => {
  const originX = vertical ? 540 : 960;
  const originY = vertical ? 960 : 540;
  const chipA = vertical ? CHIP_A_VG : CHIP_A_H;
  const chipB = vertical ? CHIP_B_VG : CHIP_B_H;
  return (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 30%, ${COBALT.mid} 0%, #071244 50%, ${COBALT.deep} 100%)` }}>
    {/* 背景地貌：封面同款三道波形放大成世界的地平线（竖屏按 1080 宽重画，整体下移到面板下半部） */}
    <svg width={vertical ? 1080 : 1920} height={vertical ? 1920 : 1080} style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
      {[0, 1, 2].map((k) => <path key={k} d={vertical ? wavePath(1080, 1080, k, 0) : wavePath(1920, 1080, k, 0)} transform={vertical ? 'translate(0 500)' : 'translate(0 210)'} fill="none" stroke={k === 0 ? COBALT.mint : COBALT.glow} strokeOpacity={k === 0 ? 0.35 : 0.22} strokeWidth={k === 0 ? 3 : 2} />)}
    </svg>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 40% 34% at 50% 18%, ${alpha(COBALT.hi, 0.35)} 0%, ${alpha(COBALT.hi, 0)} 100%)` }} />
    {/* 远景层（系数 0.08） */}
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${(1 + spread * 0.08).toFixed(4)})`, transformOrigin: `${originX}px ${originY}px` }}>
      <ForecastPanel draw={draw} vertical={vertical} />
    </div>
    {/* 近景层（系数 0.3）：两枚浮卡 */}
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${(1 + spread * (NEAR_K - 1)).toFixed(4)})`, transformOrigin: `${originX}px ${originY}px` }}>
      <div style={{ position: 'absolute', left: chipA.pos.x, top: chipA.pos.y, width: chipA.w / NEAR_K, height: chipA.h / NEAR_K, borderRadius: chipA.r / NEAR_K, ...glass, background: 'linear-gradient(180deg, rgba(30,55,160,0.92), rgba(14,30,110,0.92))' }}>
        <div style={{ position: 'absolute', left: chipA.big.x / NEAR_K, top: chipA.big.y / NEAR_K, ...type(chipA.big.size / NEAR_K, 750), color: COBALT.mint }}>+18.4%</div>
        <div style={{ position: 'absolute', left: chipA.small.x / NEAR_K, top: chipA.small.y / NEAR_K, ...type(chipA.small.size / NEAR_K, 500), color: '#c3cff5' }}>vs last launch</div>
      </div>
      <div style={{ position: 'absolute', left: chipB.pos.x, top: chipB.pos.y, width: chipB.w / NEAR_K, height: chipB.h / NEAR_K, borderRadius: chipB.r / NEAR_K, ...glass, background: 'linear-gradient(180deg, rgba(30,55,160,0.92), rgba(14,30,110,0.92))' }}>
        <svg width={chipB.donut.size / NEAR_K} height={chipB.donut.size / NEAR_K} viewBox="0 0 120 120" style={{ position: 'absolute', left: chipB.donut.x / NEAR_K, top: chipB.donut.y / NEAR_K }}>
          <circle cx={60} cy={60} r={48} fill="none" stroke="rgba(190,210,255,0.16)" strokeWidth={12} />
          <circle cx={60} cy={60} r={48} fill="none" stroke={COBALT.glow} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${(2 * Math.PI * 48 * 0.94).toFixed(1)} 400`} transform="rotate(-90 60 60)" />
        </svg>
        <div style={{ position: 'absolute', left: chipB.big.x / NEAR_K, top: chipB.big.y / NEAR_K, ...type(chipB.big.size / NEAR_K, 750), color: '#f2f5ff' }}>94%</div>
        <div style={{ position: 'absolute', left: chipB.small.x / NEAR_K, top: chipB.small.y / NEAR_K, ...type(chipB.small.size / NEAR_K, 500), color: '#c3cff5' }}>confidence</div>
      </div>
    </div>
  </AbsoluteFill>
  );
};

export const PortalWipeV2: React.FC = () => {
  const L = useLook('porcelain');
  const frame = useCurrentFrame();
  // 竖屏变体（reflow）：外层容器竖屏时把 width/height 设成真实画布 1080×1920；横屏仍是 1920×1080，
  // 下面每个 vertical ? A : B 的 B 都是改前的数字（TILE / GRID_X / GRID_Y / 1920×1080 …）。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const geo = vertical ? GEO_V : GEO_H;
  // 可编辑文案：Workspace 主页的 96px 问候主标题、右上角项目统计副句、字标旁眉题
  const title = useShotProp('title', 'Good morning, Mara.');
  const subline = useShotProp('subline', '6 projects · 2 rendered today');
  const eyebrow = useShotProp('eyebrow', 'WORKSPACE');

  // 预备：目标卡悬浮抬起、邻卡退暗
  const hover = ramp(frame, 14, 12, EASE.snappy);
  const slot = slotOf(TARGET, geo);
  const s0 = 1 + 0.03 * hover;
  const c0 = { x: slot.x - (geo.w * (s0 - 1)) / 2, y: slot.y - 10 * hover - (geo.h * (s0 - 1)) / 2, w: geo.w * s0, h: geo.h * s0, r: geo.radius };

  // 窗放大：40f 先慢后快再缓收；终点 = 真实画布（横屏 1920×1080 与改前一致，竖屏 1080×1920）
  const t = interpolate(frame, [26, 66], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const x = mix(c0.x, 0, t), y = mix(c0.y, 0, t), w = mix(c0.w, width, t), h = mix(c0.h, height, t), r = mix(c0.r, 0, t);
  // 视差散开：穿窗完成（66f）后 8f 内速度归零（74f）
  const spread = interpolate(frame, [42, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const innerScale = mix(0.42, 1, t);
  const draw = ramp(frame, 34, 32, EASE.swift); // 曲线与穿窗同时画完
  const elev = (4 + 18 * hover) * (1 - t) + 56 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - t);
  const oldDim = 0.26 * ramp(frame, 26, 34, EASE.out);
  const neighbours = 1 - 0.18 * hover;

  return (
    <AbsoluteFill style={{ background: L.bg[1], overflow: 'hidden' }}>
      {/* 外景：Workspace 主页（穿窗完成后不再渲染） */}
      {t < 1 && (
        <>
          <Stage look={L} keyLight={{ x: 0.35, y: 0.0 }} fill={{ x: 0.9, y: 0.95 }} />
          {/* 眉题行：竖屏收到 72px 边距、top 200（安全区 180 之下），字号 30→22 */}
          <div style={{ position: 'absolute', left: vertical ? 72 : GRID_X, top: vertical ? 200 : 104, height: vertical ? 44 : 52, display: 'flex', alignItems: 'center', gap: vertical ? 18 : 24 }}>
            <ShotcraftWordmark size={vertical ? 24 : 30} tone="light" color={L.ink} markScale={vertical ? 1.5 : 1.7} gap={vertical ? 12 : 14} />
            <span style={{ width: 1.5, height: vertical ? 26 : 30, background: L.line }} />
            <span style={{ ...type(vertical ? 22 : 30, 600, { mono: true }), color: L.accent, letterSpacing: '0.18em' }}>{eyebrow}</span>
          </div>
          {/* 问候标题：竖屏 96→56（0.58×）、top 276，宽度收在 72px 边距内 */}
          <div style={{ position: 'absolute', left: vertical ? 68 : GRID_X - 4, top: vertical ? 276 : 168, ...type(vertical ? 56 : 96, 720), color: L.ink }}>{title}</div>
          {/* 项目统计副句：竖屏从右上角改到标题下方左对齐（1080 宽右侧贴边会压住标题），36→22 */}
          <div style={{ position: 'absolute', ...(vertical ? { left: 72, top: 352 } : { right: GRID_X, top: 196 }), ...type(vertical ? 22 : 36, 500), color: L.ink2 }}>{subline}</div>
          {SPACES.map((s, i) => {
            if (i === TARGET) return null;
            const p = slotOf(i, geo);
            return (
              <div key={s.name} style={{ position: 'absolute', left: p.x, top: p.y, width: geo.w, height: geo.h, opacity: neighbours, borderRadius: geo.radius, boxShadow: softShadow(6, { color: L.shadow, strength: 0.9 }) }}>
                <Tile s={s} geo={geo} />
              </div>
            );
          })}
          {oldDim > 0.002 && <AbsoluteFill style={{ background: alpha(COBALT.deep, oldDim) }} />}
        </>
      )}

      {/* 窗（放大的卡）——内藏新世界 */}
      <div style={{
        position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, overflow: 'hidden',
        boxShadow: t < 1 ? softShadow(elev, { color: L.shadow, strength: 1.6 }) : 'none',
      }}>
        {t > 0 && (
          <div style={{
            position: 'absolute', width, height, left: '50%', top: '50%',
            transform: `translate(-50%, -50%) scale(${innerScale.toFixed(4)})`, overflow: 'hidden',
          }}>
            <World spread={spread} draw={draw} vertical={vertical} />
          </div>
        )}
        {/* 卡正面：放大初期渐隐，露出窗内世界 */}
        {t < 0.3 && (
          <div style={{ position: 'absolute', inset: 0, opacity: Math.max(0, 1 - t * 3.6) }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: geo.w, height: geo.h, transform: `scale(${(w / geo.w).toFixed(4)}, ${(h / geo.h).toFixed(4)})`, transformOrigin: '0 0' }}>
              <Tile s={SPACES[TARGET]} geo={geo} />
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
