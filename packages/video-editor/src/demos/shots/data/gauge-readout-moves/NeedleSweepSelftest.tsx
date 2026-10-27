// @ts-nocheck
// needle-sweep-selftest —— 满弧扫针自检
// 卡片内三个并排 270° 表盘。f12 "点火"后指针错峰 4f 依次从 0 甩满全弧
// （去程 12f ease-out），再回落到各自真实值（回程约 20f：落过头 5–8° 再回摆），
// 落定同帧盘下数值文字弹出。三表错峰形成波浪。f60 后真静止 80f。
// 帧确定性：纯函数分段，全部 clamp，settle 后每帧输出常数。
//
// 质感升级：仪表语境改暗场（深色柔光背景 + 颗粒、深色卡面发丝线 + 内高光）；调试标题换成卡头
// "System health" + 自检状态胶囊（Running self-test… → All systems nominal）；表盘加淡表面与外环、
// 0–100 刻度数字；去程扫过的刻度依次点亮再回落（"先亮量程"），盘面有一条跟随指针的琥珀亮弧；
// 指针换成锥形发光针 + 金属轴帽，高速甩针时带角向拖影；回程改为按各表行程反算阻尼的弹簧，
// 落过头 8° 一次回摆、速度连续无折点；数值 overshoot 弹出、下方标注指标名。
// 品牌轮：卡头换成 video-shotcraft 渲染节点自检（标志 + "Render node health"，落定后 "Ready to render"）。
import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { Backdrop, EASE, FONT, Grain, mix, ramp, softShadow, tracking } from '../../_fixtures/Polish';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';
import { usePalette } from '../../_fixtures/Look';

export const NEEDLE_SWEEP_SELFTEST_DURATION = 140; // f60 后真静止 80f

const AMBER = '#f59e0b'; // 仪表琥珀（针体渐变中段保持原样，不随配色走）
const AMBER_HI = '#fcd34d'; // 针尖亮端 = 次强调槽位的默认值（见 PALETTE_FALLBACK.secondary）
const RED = '#ef4444';
const INK1 = '#f3f4f7'; // 原主文字色（现由 PAL.ink 承载，默认值相同）
const INK3 = '#737885'; // 次级/弱文字与刻度，不随配色走

/** usePalette 默认值 = 本镜头原本的四个主色（未传配色键时默认画面零变化） */
const PALETTE_FALLBACK = { bg: '#0c0d11', primary: '#f59e0b', secondary: '#fcd34d', ink: '#f3f4f7' };

const CARD_W = 1500;
const CARD_H = 640;
const CARD_X = (1920 - CARD_W) / 2;
const CARD_Y = (1080 - CARD_H) / 2 + 10;

const GA_W = CARD_W / 3; // 每表盘占位宽
const R = 148;
const CX = GA_W / 2;
const CY = 220;

// 竖屏（1080×1920）重排：卡片收窄到 1080 − 144 = 936，整体落在上 180 / 下 320 安全区内；
// 三张表盘由横排改单列堆叠，每块更宽更矮、盘面与数值同步收一档。横屏仍走上面的原常量。
const CARD_W_V = 936; // 1080 - 144（左右各留 72px 安全边）
const CARD_H_V = 1390; // 底边 1580；入场 translateY(18) 期间也是 1598，未越过 1600 安全线
const CARD_X_V = (1080 - CARD_W_V) / 2;
const CARD_Y_V = 190; // 上安全区 180 之下，底边 1580，未越过下安全区 1600
const GA_W_V = CARD_W_V - 72; // 单列每表盘占位宽 864
const R_V = 140;
const CX_V = GA_W_V / 2;
const CY_V = 162;
const GAUGE_H_V = 410; // 每行 盘面 326 + 数值 + 指标名

// 上面这组竖屏数值是 1080×1920 设计画布里的坐标，落位时按 实际画布宽 / 1080 等比缩放：
// FrameProvider 报 1080×1920（工程成片）时系数为 1，与设计值逐像素一致；
// IP 口播动效背景（ShotBackdropRenderer 默认 540×960）和 9:16 验证页这类更窄的真实画布上，
// 936 宽的卡片会整体缩进，而不是按 1080 坐标硬画后越出右边界、三个表盘只剩中间一块的局部。
const V_DESIGN_W = 1080;

// 表盘角 d∈[0,270] → SVG 角 a = 135 + d（0=右，顺时针，y 向下）
// cx/cy 默认取横屏原圆心；竖屏显式传入单列圆心，横屏调用不传 → 与改动前同值。
const polar = (a: number, r: number, cx: number = CX, cy: number = CY): [number, number] => [
  cx + r * Math.cos((a * Math.PI) / 180),
  cy + r * Math.sin((a * Math.PI) / 180),
];

const arcPath = (d0: number, d1: number, r: number, cx: number = CX, cy: number = CY): string => {
  const [x0, y0] = polar(135 + d0, r, cx, cy);
  const [x1, y1] = polar(135 + Math.max(d0 + 0.01, d1), r, cx, cy);
  const large = d1 - d0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

// 三表：点火 f12，错峰 4f
const GAUGES = [
  { start: 12, target: 190, name: 'CPU' },
  { start: 16, target: 120, name: 'GPU' },
  { start: 20, target: 235, name: 'Network' },
];

// 回程弹簧：按"落过头 8°"反算阻尼比 ζ（超调比 p = 8/行程，ζ = -ln p / √(π² + ln² p)）
const STIFF = 120;
const dampingFor = (target: number) => {
  const p = Math.min(0.5, 8 / (270 - target));
  const lp = Math.log(p);
  const zeta = -lp / Math.sqrt(Math.PI * Math.PI + lp * lp);
  return 2 * zeta * Math.sqrt(STIFF);
};

const needleAngle = (frame: number, s: number, target: number): number => {
  if (frame <= s) return 0;
  if (frame <= s + 12) return 270 * ramp(frame, s, 12, (x) => 1 - Math.pow(1 - x, 3)); // 去程：甩满全弧，起步猛
  if (frame >= s + 46) return target; // 真静止：直接锁死常数
  const k = spring({ frame: frame - (s + 12), fps: 30, config: { stiffness: STIFF, damping: dampingFor(target), mass: 1 } });
  return mix(270, target, k);
};

const Gauge: React.FC<{ start: number; target: number; name: string }> = ({ start, target, name }) => {
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 竖屏（1080×1920）：每块表盘占满单列（864 宽），盘面/数值按短边收一档。
  // 横屏下 cx/cy/rr/gw 分别等于 CX/CY/R/GA_W（同一表达式、同一数值）→ 渲染逐像素不变。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const cx = vertical ? CX_V : CX;
  const cy = vertical ? CY_V : CY;
  const rr = vertical ? R_V : R;
  const gw = vertical ? GA_W_V : GA_W;
  const d = needleAngle(frame, start, target);
  const dPrev = needleAngle(frame - 1, start, target);
  const settle = start + 32;
  const value = Math.round((target / 270) * 100);

  const pop = ramp(frame, settle, 9, EASE.overshoot);
  const popOp = ramp(frame, settle, 4, EASE.out);
  const nameOp = ramp(frame, settle + 3, 10, EASE.out);

  // 表盘点亮：点火时表面与外环亮起
  const on = ramp(frame, start - 4, 10, EASE.out);
  // 去程扫过的刻度依次点亮，满弧后 24f 内回落到常态亮度
  const swept = frame <= start + 12 ? d : 270;
  const calm = ramp(frame, start + 12, 24, EASE.smooth);

  const ticks: React.ReactNode[] = [];
  for (let k = 0; k <= 30; k++) {
    const dd = k * 9;
    const major = k % 3 === 0;
    const a = 135 + dd;
    const [x0, y0] = polar(a, rr - 10, cx, cy);
    const [x1, y1] = polar(a, major ? rr - 30 : rr - 20, cx, cy);
    const lit = swept >= dd - 0.5 ? 1 - calm : 0;
    const red = dd >= 225;
    const base = red ? 0.55 : 0.22;
    ticks.push(
      <line
        key={k}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke={red ? RED : '#ffffff'}
        strokeOpacity={(base + (red ? 0.4 : 0.6) * lit) * on}
        strokeWidth={major ? 3 : 1.6}
        strokeLinecap="round"
      />,
    );
    if (major) {
      const [lx, ly] = polar(a, rr - 52, cx, cy);
      ticks.push(
        <text
          key={`l${k}`}
          x={lx}
          y={ly}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={FONT.sans}
          fontSize={vertical ? 14 : 16}
          fontWeight={500}
          fill={red ? '#f87171' : '#ffffff'}
          fillOpacity={(red ? 0.7 : 0.38 + 0.4 * lit) * on}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {(k / 3) * 10}
        </text>,
      );
    }
  }

  // 锥形指针（局部坐标：沿 +x 指向 0° 方向，再整体 rotate）
  const needle = (deg: number, opacity: number, key?: string) => {
    const [tx, ty] = polar(135, rr - 13, cx, cy);
    const len = Math.hypot(tx - cx, ty - cy);
    return (
      <g key={key} transform={`rotate(${(135 + deg).toFixed(3)} ${cx} ${cy})`} opacity={opacity}>
        <path
          d={`M ${cx - 34} ${cy - 5} L ${cx + len} ${cy - 1.6} Q ${cx + len + 3.5} ${cy} ${cx + len} ${cy + 1.6} L ${cx - 34} ${cy + 5} Z`}
          fill="url(#nssNeedle)"
        />
      </g>
    );
  };
  const dv = d - dPrev;
  const ghosts = Math.abs(dv) > 4 ? [1, 2, 3, 4].map((g) => needle(d - (dv * g) / 4, 0.16 * (1 - g / 5), `gh${g}`)) : null;

  return (
    <div style={{ width: gw, height: vertical ? GAUGE_H_V : 500, position: 'relative' }}>
      <svg width={gw} height={vertical ? 326 : 420} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="nssNeedle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b45309" />
            <stop offset="0.55" stopColor={AMBER} />
            <stop offset="1" stopColor={PAL.secondary} />
          </linearGradient>
          <radialGradient id="nssHub" cx="0.38" cy="0.32" r="0.7">
            <stop offset="0" stopColor="#6b7080" />
            <stop offset="1" stopColor="#1c1d23" />
          </radialGradient>
          <radialGradient id="nssFace" cx="0.5" cy="0.42" r="0.6">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.05} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0.01} />
          </radialGradient>
          <filter id="nssGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {/* 表面：淡径向 + 发丝外环 */}
        <circle cx={cx} cy={cy} r={rr + 20} fill="url(#nssFace)" stroke="#ffffff" strokeOpacity={0.07 * on} strokeWidth={1} opacity={on} />
        {/* 弧形轨道 + 红区 */}
        <path d={arcPath(0, 270, rr, cx, cy)} fill="none" stroke="#ffffff" strokeOpacity={0.07} strokeWidth={8} strokeLinecap="round" />
        <path d={arcPath(225, 270, rr, cx, cy)} fill="none" stroke={RED} strokeOpacity={0.45 * on} strokeWidth={8} strokeLinecap="round" />
        {/* 跟随指针的琥珀亮弧（柔光层 + 实线层） */}
        {d > 0.5 && (
          <>
            <path d={arcPath(0, d, rr, cx, cy)} fill="none" stroke={PAL.primary} strokeOpacity={0.45} strokeWidth={10} strokeLinecap="round" filter="url(#nssGlow)" />
            <path d={arcPath(0, d, rr, cx, cy)} fill="none" stroke={PAL.primary} strokeWidth={8} strokeLinecap="round" />
          </>
        )}
        {ticks}
        {/* 指针：角向拖影 + 发光 + 本体 */}
        {ghosts}
        <g filter="url(#nssGlow)" opacity={0.55}>
          {needle(d, 1)}
        </g>
        {needle(d, 1)}
        <circle cx={cx} cy={cy} r={19} fill="url(#nssHub)" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={6} fill={PAL.primary} />
      </svg>
      {/* 落定同帧弹出的数值 + 指标名 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: vertical ? 328 : 340,
          textAlign: 'center',
          opacity: popOp,
          transform: `scale(${mix(0.4, 1, pop).toFixed(4)})`,
          fontFamily: FONT.sans,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: vertical ? 42 : 64, color: PAL.ink, letterSpacing: tracking(vertical ? 42 : 64), fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span style={{ fontWeight: 600, fontSize: vertical ? 20 : 30, color: INK3, marginLeft: 6 }}>%</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: vertical ? 384 : 424,
          textAlign: 'center',
          opacity: nameOp,
          transform: `translateY(${mix(6, 0, nameOp)}px)`,
          fontFamily: FONT.sans,
          fontSize: vertical ? 16 : 22,
          fontWeight: 600,
          letterSpacing: tracking(vertical ? 16 : 22, true),
          textTransform: 'uppercase',
          color: INK3,
        }}
      >
        {name}
      </div>
    </div>
  );
};

export const NeedleSweepSelftest: React.FC = () => {
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 竖屏（1080×1920）重排：卡片从 1500×640 收窄到 1080 − 144 = 936，整体压在 180/320 安全区内；
  // 三表由容器横排改 flexDirection: column 单列堆叠。横屏仍取 CARD_X/Y/W/H 原值 → 零变化。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // 竖屏设计坐标是 1080 宽；真实画布更窄（IP 背景 540×960、9:16 验证页）时整卡等比缩进。
  // 横屏 vScale 恒为 1 且不参与任何样式 → 与改动前逐像素一致。
  const vScale = vertical ? width / V_DESIGN_W : 1;
  const vScaled = vertical && Math.abs(vScale - 1) > 0.0005;
  const cardX = vertical ? CARD_X_V * vScale : CARD_X;
  const cardY = vertical ? CARD_Y_V * vScale : CARD_Y;
  const cardW = vertical ? CARD_W_V : CARD_W;
  const cardH = vertical ? CARD_H_V : CARD_H;
  const title = useShotProp('title', 'Render node health');
  const inP = ramp(frame, 0, 12, EASE.snappy);
  const done = ramp(frame, 60, 8, EASE.out); // 全部落定后状态切换
  const pulse = 0.5 + 0.5 * Math.cos((frame / 14) * Math.PI);
  return (
    <AbsoluteFill style={{ background: PAL.bg, overflow: 'hidden', fontFamily: FONT.sans }}>
      {/* 舞台底色：Backdrop 暗场三段渐变的中段取 PAL.bg（默认 '#0c0d11' 与原字符串逐字符一致 → 默认零变化） */}
      <Backdrop
        tone="dark"
        light={{ x: 0.5, y: 0.25 }}
        grain={0}
        style={{ background: PAL.isCustom ? PAL.bg : `linear-gradient(180deg, #13151b 0%, ${PAL.bg} 55%, #08090c 100%)` }}
      />
      <div
        style={{
          position: 'absolute',
          left: cardX,
          top: cardY,
          width: cardW,
          height: cardH,
          background: 'linear-gradient(180deg, #1a1c22 0%, #141519 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 26,
          boxSizing: 'border-box',
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), ${softShadow(40, { color: '#000000', strength: 2.2 })}`,
          opacity: inP,
          // 竖屏窄画布：从卡片左上角起按 width / 1080 缩放（入场 18px 位移也一起缩），
          // 卡片仍按 936×1390 的设计坐标排版；1080 宽时走 else 分支、与改动前同一字符串。
          transform: vScaled
            ? `scale(${vScale.toFixed(5)}) translateY(${mix(18, 0, inP).toFixed(2)}px)`
            : `translateY(${mix(18, 0, inP).toFixed(2)}px)`,
          transformOrigin: vScaled ? '0 0' : undefined,
        }}
      >
        {/* 卡头：标题 + 自检状态胶囊 */}
        <ShotcraftMark size={vertical ? 54 : 62} tone="dark" style={{ position: 'absolute', left: vertical ? 36 : 40, top: vertical ? 26 : 30 }} />
        <div style={{ position: 'absolute', left: vertical ? 104 : 122, top: vertical ? 30 : 36 }}>
          <div style={{ fontSize: vertical ? 30 : 32, fontWeight: 650, color: PAL.ink, letterSpacing: tracking(vertical ? 30 : 32) }}>{title}</div>
          <div style={{ marginTop: vertical ? 6 : 7, fontSize: vertical ? 17 : 19, fontWeight: 500, color: INK3 }}>
            <span style={{ fontFamily: BRAND.font, fontWeight: 600, color: '#a3a8b4' }}>{BRAND.name}</span> · render-node-02 · 3 sensors
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            right: vertical ? 32 : 44,
            top: vertical ? 34 : 42,
            height: vertical ? 36 : 40,
            padding: vertical ? '0 14px 0 12px' : '0 16px 0 13px',
            display: 'flex',
            alignItems: 'center',
            gap: vertical ? 8 : 10,
            borderRadius: vertical ? 18 : 20,
            background: done > 0.5 ? 'rgba(52,211,153,0.10)' : 'rgba(245,158,11,0.10)',
            border: `1px solid ${done > 0.5 ? 'rgba(52,211,153,0.25)' : 'rgba(245,158,11,0.25)'}`,
            fontSize: vertical ? 16 : 18,
            fontWeight: 600,
            color: done > 0.5 ? '#6ee7b7' : '#fbbf24',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              width: vertical ? 8 : 9,
              height: vertical ? 8 : 9,
              borderRadius: vertical ? 4 : 5,
              background: done > 0.5 ? '#34d399' : AMBER,
              opacity: done > 0.5 ? 1 : 0.45 + 0.55 * pulse,
            }}
          />
          {done > 0.5 ? 'Ready to render' : 'Running self-test…'}
        </div>
        {/* 分隔发丝线 */}
        <div style={{ position: 'absolute', left: vertical ? 36 : 44, right: vertical ? 36 : 44, top: vertical ? 108 : 122, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        {/* 竖屏：三表改单列堆叠（flexDirection: column），每行占满 864 宽；横屏不写 flexDirection（默认 row，DOM 与改动前一致） */}
        <div style={{ position: 'absolute', left: vertical ? 36 : 0, top: vertical ? 124 : 136, display: 'flex', flexDirection: vertical ? 'column' : undefined }}>
          {GAUGES.map((g, i) => (
            <Gauge key={i} start={g.start} target={g.target} name={g.name} />
          ))}
        </div>
      </div>
      <Grain opacity={0.07} blend="soft-light" />
    </AbsoluteFill>
  );
};
