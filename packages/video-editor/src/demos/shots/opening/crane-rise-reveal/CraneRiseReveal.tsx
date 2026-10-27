// @ts-nocheck
// 升降臂拉升揭示（crane-rise-reveal）——crane shot：焦点 → 全局。
//
// 第二轮重设计（瓷白 SaaS · video-shotcraft 渲染队列）：
// - look = porcelain（冷白 + 钴蓝，青绿点缀）。世界 = 一扇为镜头设计的产品窗口：顶栏 + 「Render queue」页头
//   （右侧 104px 的今日渲染帧数 KPI）+ 12 行镜头渲染任务表。开场相机 3.0× 怼在第 10 行任务上——镜头号 / 转场 / 配方卡
//   在画面里是 63px 的大字，行首一枚钴蓝"正在追踪"标，观众先看清"这是一个具体的镜头"。
// - 拉升：translate = 屏幕中心 − 对准点×scale，对准点与 scale 共用一条 bezier(0.2,0,0.25,1)（零速起步、
//   ~19% 处峰速、长尾临顶缓停 = 升降臂手感）。视野上缘每越过一行，该行一道钴蓝洗光从行首掠过（越线触发、
//   与运镜逐帧同步）——"一行行涌入"；页头 KPI（今日渲染帧数）同步从 0 数到 48,210（体量感），窗口最后整体脱离画框、
//   落成瓷白舞台上的一件实物（背景点阵按 0.35 视差慢移，读出纵深）。
// - 余波：落定后被追踪的那一行状态胶囊由「Rendering」翻成青绿「Rendered」+ 对勾——hold 段里唯一的小事件，
//   结尾帧 = 「你盯着的这一行，只是这面墙的一格」。
//
// 时间表（30fps，共 165f）：
//   0–24    特写 hold：相机 +1.5% 预备推近（吸一口气），行首追踪点呼吸
//   24–126  拉升 102f：前 ~40f 快速段包 CameraMotionBlur；行洗光越线触发；KPI 计数（expo-out，与运镜同期收）
//   126–138 落定：窗口阴影收到静置高度、KPI 末位落定
//   134–148 余波：追踪行状态翻 Rendered（弹簧 damping 16）
//   148–165 hold 干净落定
//
// 竖屏变体（reflow，9:16 = 1080×1920）：只换布局几何，时间轴 / 动画曲线 / 文案键 / 配色槽位一字未动。
// - 世界窗口从 1680×900 的横向画布改成 936×1370 的纵向窗口（左右各留 72 = 1080 − 144，上 200 / 下 1570，
//   落在上 180 / 下 320 安全区内）；顶栏、页头、KPI 全部按 1080 短边重排，KPI 104→56、标题 64→40。
// - 表格由「7 列并排」改成「一行两段」：上段 镜头号 / 转场 / ETA / 状态，下段 配方卡 / 进度 / 帧数；
//   字号按短边收到 0.54–0.75×，列宽收进 936 − 2×40 = 856 的内容区，不再横向溢出。
// - 相机沿用同一条 bezier 与同一张帧表，只换取景几何：画布中心从 960×540 变成 540×960，
//   特写对准点改到竖屏第 10 行行首、视野下缘仍停在窗口底边上方（不露窗外），落定仍是 1:1 全窗。
// - 竖屏布局按 1080×1920 设计；渲染器可能按半分辨率（540×960，验证/预览管线）或其他竖屏尺寸出图，
//   此时整幅按短边等比缩放并居中（k=1 的 1080×1920 不做任何包装），内容不会再超出右侧画框。
// - 横屏（1920×1080）走的是原封不动的那套数字，默认帧逐像素零变化。
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from '../../../runtime/index.ts';
import { CameraMotionBlur } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { bezier, ramp, mix, EASE, FONT, softShadow } from '../../_fixtures/Polish';
import { LOOKS, Stage, alpha, springAt, useLook, type Look } from '../../_fixtures/Look';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';

export const CRANE_RISE_REVEAL_DURATION = 165; // 特写 hold 24f + 拉升 102f + 落定/余波/hold 39f

const HOLD = 24;
const MOVE_END = 126;
const BLUR_END = 64; // 速度降到峰值 ~35% 以下即撤运动模糊（慢段包了会抹软文字）
const FLIP = 134; // 追踪行状态翻 Rendered（数据层仍叫 delivered）
const crane = bezier(0.2, 0, 0.25, 1);

// ───────────── 世界几何（终帧 = 世界 1:1）─────────────
const WX = 120, WY = 90, WW = 1680, WH = 900; // 产品窗口
const PAD = 48;
const CX = WX + PAD; // 内容左缘
const BAR_H = 72;
const HEAD_Y = WY + BAR_H; // 页头顶
const THEAD_Y = WY + 262; // 表头
const ROW0 = WY + 302;
const ROW_H = 48;
const ROWS = 12;
const TRACK = 9; // 被追踪的那一行
const rowTop = (i: number) => ROW0 + i * ROW_H;

// 列（相对内容左缘）：id = 镜头号、route = 转场（上一镜 → 下一镜）、carrier = 配方卡、kg = 帧数
const COL = { id: 0, route: 172, carrier: 560, eta: 790, status: 930, prog: 1150, kg: 1480 };

// ───────────── 相机 ─────────────
const S0 = 3.0;
const BREATH = 0.015;
const F0X = 441; // 特写对准点 x：追踪点落在画面左缘 ~60px，窗口左边框刚好出画
const F1 = { x: 960, y: 540 };

// ───────────── 竖屏几何（reflow）─────────────
// 1080×1920：窗口宽 = 1080 − 2×72 = 936，高 1370（上 200 / 下 1570），整体在上 180 / 下 320 安全区内。
// 12 行 × 88px 的两段式行（上段 镜头号+转场+ETA+状态，下段 配方卡+进度+帧数）刚好铺到 1518，
// 窗口底部留 52px 呼吸；表头拆两行与行内两段一一对应。内容区 = 936 − 2×40 = 856。
const VWX = 72, VWY = 200, VWW = 936, VWH = 1370;
const VPAD = 40;
const VCX = VWX + VPAD; // 内容左缘 = 112
const VBAR_H = 64;
const VHEAD_Y = VWY + VBAR_H; // 264
const VTHEAD_Y = VWY + 210; // 410
const VROW0 = VWY + 262; // 462
const VROW_H = 88;
const VCOL = { id: 0, route: 118, carrier: 0, eta: 620, status: 752, prog: 300, kg: 752 };
const VS0 = 3.0; // 与横屏同一档推近量，取景几何换成竖屏中心
const VF0X = 252; // 特写对准点 x：窗口左边框刚好贴住画面左缘，追踪点落在画面左缘 ~42px
const VF1 = { x: 540, y: 960 }; // 竖屏画布中心

type Geo = {
  vertical: boolean;
  vw: number; vh: number; cx: number; cy: number;
  WX: number; WY: number; WW: number; WH: number; radius: number;
  PAD: number; CX: number; BAR_H: number; HEAD_Y: number; THEAD_Y: number;
  ROW0: number; ROW_H: number;
  rowTop: (i: number) => number;
  COL: { id: number; route: number; carrier: number; eta: number; status: number; prog: number; kg: number };
  S0: number; F0X: number; F1X: number; F1Y: number; closeGap: number;
};

// 横屏几何：每个字段都直接引用上面原有常量，数值与改动前逐个相同
const GH: Geo = {
  vertical: false, vw: 1920, vh: 1080, cx: 960, cy: 540,
  WX, WY, WW, WH, radius: 28,
  PAD, CX, BAR_H, HEAD_Y, THEAD_Y, ROW0, ROW_H, rowTop, COL,
  S0, F0X, F1X: F1.x, F1Y: F1.y, closeGap: 30,
};

const GV: Geo = {
  vertical: true, vw: 1080, vh: 1920, cx: 540, cy: 960,
  WX: VWX, WY: VWY, WW: VWW, WH: VWH, radius: 24,
  PAD: VPAD, CX: VCX, BAR_H: VBAR_H, HEAD_Y: VHEAD_Y, THEAD_Y: VTHEAD_Y, ROW0: VROW0, ROW_H: VROW_H,
  rowTop: (i: number) => VROW0 + i * VROW_H,
  COL: VCOL,
  S0: VS0, F0X: VF0X, F1X: VF1.x, F1Y: VF1.y, closeGap: 26,
};

/** 当前画布是横屏还是竖屏：竖屏（1080×1920）走 reflow 分支，横屏返回 GH（原数字） */
const useGeo = (): { g: Geo; vertical: boolean } => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return { g: vertical ? GV : GH, vertical };
};

// 相机几何（不依赖配色，可模块级求值）。横屏时 cx/cy = 960/540、closeGap = 30，与改动前逐项相同。
const camAt = (frame: number, g: Geo = GH) => {
  const breath = ramp(frame, 0, HOLD, EASE.smooth);
  const e = crane(Math.min(1, Math.max(0, (frame - HOLD) / (MOVE_END - HOLD))));
  const s0 = g.S0 * (1 + BREATH * breath);
  const s = mix(s0, 1, e);
  // 特写取景下缘停在窗口底边上方 closeGap（圆角之上，不露窗外），推近时对准点同步下移保持贴底
  const fy0 = g.WY + g.WH - g.closeGap - g.cy / s0;
  const fx = mix(g.F0X, g.F1X, e);
  const fy = mix(fy0, g.F1Y, e);
  return { s, e, tx: g.cx - fx * s, ty: g.cy - fy * s, visTop: fy - g.cy / s };
};

// 每行洗光触发帧：视野上缘首次越过该行顶边（开场已在画内的行不触发）。两套几何各算一份。
const triggersFor = (g: Geo) => {
  const rows = Array.from({ length: ROWS }, (_, i) => {
    if (camAt(HOLD, g).visTop <= g.rowTop(i)) return -1;
    for (let f = HOLD; f <= MOVE_END; f++) if (camAt(f, g).visTop <= g.rowTop(i) + 2) return f;
    return MOVE_END;
  });
  let head = MOVE_END;
  for (let f = HOLD; f <= MOVE_END; f++) {
    if (camAt(f, g).visTop <= g.HEAD_Y + 60) {
      head = f;
      break;
    }
  }
  return { rows, head };
};
const TRIG_H = triggersFor(GH);
const TRIG_V = triggersFor(GV);
const ROW_TRIG = TRIG_H.rows;
const HEAD_TRIG = TRIG_H.head;
const ROW_TRIG_V = TRIG_V.rows;
const HEAD_TRIG_V = TRIG_V.head;

// ───────────── 数据（虚构的 video-shotcraft 渲染队列；配方卡名取自本库）─────────────
type Row = { id: string; from: string; to: string; carrier: string; eta: string; status: 'transit' | 'customs' | 'delivered' | 'loading'; prog: number; kg: string };
const DATA: Row[] = [
  { id: 'SH-0401', from: 'Cold open', to: 'Logo', carrier: 'brand-ink-open', eta: '09:40', status: 'delivered', prog: 1, kg: '104' },
  { id: 'SH-0402', from: 'Logo', to: 'Hero', carrier: 'text-as-mask', eta: '10:15', status: 'transit', prog: 0.72, kg: '96' },
  { id: 'SH-0403', from: 'Hero', to: 'Dashboard', carrier: 'crash-zoom-punch', eta: '11:05', status: 'customs', prog: 0.48, kg: '120' },
  { id: 'SH-0404', from: 'Dashboard', to: 'Search', carrier: 'cursor-flyover', eta: '11:30', status: 'transit', prog: 0.61, kg: '150' },
  { id: 'SH-0405', from: 'Search', to: 'Results', carrier: 'type-and-filter', eta: '12:10', status: 'loading', prog: 0.12, kg: '73' },
  { id: 'SH-0406', from: 'Results', to: 'Detail', carrier: 'steep-tilt-glide', eta: '12:45', status: 'transit', prog: 0.83, kg: '180' },
  { id: 'SH-0407', from: 'Detail', to: 'Chart', carrier: 'timeline-travel', eta: '13:20', status: 'delivered', prog: 1, kg: '210' },
  { id: 'SH-0408', from: 'Chart', to: 'Voice', carrier: 'voice-waveform-live', eta: '13:55', status: 'transit', prog: 0.54, kg: '172' },
  { id: 'SH-0409', from: 'Voice', to: 'Team', carrier: 'spotlight-hero-card', eta: '14:05', status: 'customs', prog: 0.4, kg: '140' },
  { id: 'SH-0410', from: 'Team', to: 'Launch', carrier: 'crane-rise-reveal', eta: '14:20', status: 'transit', prog: 0.91, kg: '165' },
  { id: 'SH-0411', from: 'Launch', to: 'Outro', carrier: 'grain-dissolve', eta: '14:50', status: 'loading', prog: 0.2, kg: '90' },
  { id: 'SH-0412', from: 'Outro', to: 'Lockup', carrier: 'neon-triple-marquee', eta: '15:30', status: 'transit', prog: 0.66, kg: '120' },
];

// ───────────── 状态样式（依赖 L，组件内调用）─────────────
const STATUS_LABELS = {
  transit: 'Rendering', customs: 'In review', delivered: 'Rendered', loading: 'Queued',
} as const;

const STATUS_COLORS = (L: Look) => ({
  transit: { fg: L.accent, bg: alpha(L.accent, 0.1) },
  customs: { fg: '#b7791f', bg: 'rgba(214,158,46,0.13)' },
  delivered: { fg: '#00866f', bg: alpha(L.accent2, 0.13) },
  loading: { fg: L.ink2, bg: 'rgba(76,86,110,0.09)' },
} as const);

const text = (size: number, weight: number, color: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: 'absolute', fontFamily: FONT.sans, fontSize: size, fontWeight: weight, color, whiteSpace: 'nowrap',
  letterSpacing: size >= 40 ? '-0.03em' : '-0.01em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', ...extra,
});

const Pill: React.FC<{ kind: keyof typeof STATUS_LABELS; x: number; y: number; scale?: number; check?: number; L: Look }> = ({ kind, x, y, scale = 1, check = 0, L }) => {
  // 竖屏：胶囊收到 22px 高 / 11px 字，横屏仍是原来的 28px / 17px
  const { vertical } = useGeo();
  const s = STATUS_COLORS(L)[kind];
  const h = vertical ? 22 : 28;
  const dot = vertical ? 6 : 7;
  const icon = vertical ? 12 : 14;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, height: h, padding: vertical ? '0 10px 0 8px' : '0 13px 0 10px', borderRadius: h / 2, background: s.bg,
      display: 'flex', alignItems: 'center', gap: vertical ? 6 : 7, transform: `scale(${scale})`, transformOrigin: '0% 50%',
    }}>
      {kind === 'delivered' && check > 0 ? (
        <svg width={icon} height={icon} viewBox="0 0 14 14">
          <path d="M2.5 7.4 L5.6 10.2 L11.5 3.8" fill="none" stroke={s.fg} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - check} />
        </svg>
      ) : (
        <div style={{ width: dot, height: dot, borderRadius: vertical ? 3 : 4, background: s.fg }} />
      )}
      <span style={{ fontFamily: FONT.sans, fontSize: vertical ? 11 : 17, fontWeight: 600, color: s.fg, letterSpacing: '-0.005em' }}>{STATUS_LABELS[kind]}</span>
    </div>
  );
};

// 一行运单
const RowView: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const L = useLook('porcelain');
  const { g, vertical } = useGeo();
  const r = DATA[i];
  const top = g.rowTop(i);
  const tracked = i === TRACK;
  const flip = tracked ? springAt(frame, FLIP, { damping: 16, stiffness: 190 }) : 0;
  const kind = tracked && frame >= FLIP + 2 ? 'delivered' : r.status;
  const prog = tracked ? mix(r.prog, 1, ramp(frame, FLIP - 4, 16, EASE.out)) : r.prog;
  const pillPop = tracked && frame >= FLIP ? 0.86 + 0.14 * flip : 1;
  const check = tracked ? ramp(frame, FLIP + 4, 10, EASE.out) : 0;
  // 追踪点呼吸（特写 hold 段最明显，之后保持轻呼吸）
  const beat = 0.5 + 0.5 * Math.sin(frame / 5.5);
  const ty = top + g.ROW_H / 2;
  const fg = L.ink;
  // 对焦：特写 hold 时只有追踪行是实的，其余行压到 38%，起吊后 ~26f 内回满（"先看这一票，再看全部"）
  const focus = tracked ? 1 : mix(0.38, 1, ramp(frame, HOLD - 2, 28, EASE.out));
  return (
    <div style={{ opacity: focus }}>
      {tracked && (
        <div style={{
          position: 'absolute', left: g.WX + 10, top: top + 3, width: g.WW - 20, height: g.ROW_H - 6, borderRadius: 12,
          background: `linear-gradient(90deg, ${alpha(L.accent, 0.11)} 0%, ${alpha(L.accent, 0.05)} 60%, ${alpha(L.accent, 0.03)} 100%)`,
          boxShadow: `inset 0 0 0 1px ${alpha(L.accent, 0.22)}`,
        }} />
      )}
      {!tracked && i < ROWS - 1 && i !== TRACK - 1 && (
        <div style={{ position: 'absolute', left: g.CX, top: top + g.ROW_H - 0.5, width: g.WW - g.PAD * 2, height: 1, background: L.line }} />
      )}
      {tracked && (
        <>
          <div style={{ position: 'absolute', left: g.CX - 26, top: ty - 5, width: 10, height: 10, borderRadius: 5, background: L.accent }} />
          <div style={{
            position: 'absolute', left: g.CX - 26 - 6 * beat, top: ty - 5 - 6 * beat, width: 10 + 12 * beat, height: 10 + 12 * beat,
            borderRadius: 20, border: `1.5px solid ${alpha(L.accent, 0.5 * (1 - beat))}`,
          }} />
        </>
      )}
      {vertical ? (
        <>
          {/* 竖屏：一行两段。上段 = 镜头号 / 转场 / ETA / 状态；下段 = 配方卡 / 进度 / 帧数（列宽收进 888） */}
          <span style={text(14, 600, tracked ? L.accent : L.ink2, { left: g.CX + g.COL.id, top: ty - 24, fontFamily: FONT.mono, letterSpacing: '0em' })}>{r.id}</span>
          <span style={text(16, 600, fg, { left: g.CX + g.COL.route, top: ty - 25 })}>
            {r.from}<span style={{ color: L.ink3, fontWeight: 400 }}>{'  →  '}</span>{r.to}
          </span>
          <span style={text(12, 500, L.ink2, { left: g.CX + g.COL.eta, top: ty - 23 })}>{r.eta}</span>
          <Pill kind={kind} x={g.CX + g.COL.status} y={ty - 26} scale={pillPop} check={check} L={L} />
          <span style={text(12, 500, L.ink2, { left: g.CX + g.COL.carrier, top: ty + 11 })}>{r.carrier}</span>
          {/* 进度条 */}
          <div style={{ position: 'absolute', left: g.CX + g.COL.prog, top: ty + 15, width: 300, height: 5, borderRadius: 3, background: 'rgba(15,30,60,0.07)' }}>
            <div style={{
              width: `${prog * 100}%`, height: '100%', borderRadius: 3,
              background: kind === 'delivered' ? L.accent2 : tracked ? L.accent : alpha(L.ink, 0.32),
            }} />
          </div>
          <span style={text(12, 500, L.ink2, { left: g.CX + g.COL.kg, top: ty + 10, width: 100, textAlign: 'right' })}>
            {r.kg}<span style={{ color: L.ink3 }}> f</span>
          </span>
        </>
      ) : (
        <>
          <span style={text(20, 600, tracked ? L.accent : L.ink2, { left: g.CX + g.COL.id, top: ty - 10, fontFamily: FONT.mono, letterSpacing: '0em' })}>{r.id}</span>
          <span style={text(21, 600, fg, { left: g.CX + g.COL.route, top: ty - 11 })}>
            {r.from}<span style={{ color: L.ink3, fontWeight: 400 }}>{'  →  '}</span>{r.to}
          </span>
          <span style={text(20, 500, L.ink2, { left: g.CX + g.COL.carrier, top: ty - 10 })}>{r.carrier}</span>
          <span style={text(20, 500, L.ink2, { left: g.CX + g.COL.eta, top: ty - 10 })}>{r.eta}</span>
          <Pill kind={kind} x={g.CX + g.COL.status} y={ty - 14} scale={pillPop} check={check} L={L} />
          {/* 进度条 */}
          <div style={{ position: 'absolute', left: g.CX + g.COL.prog, top: ty - 3, width: 260, height: 6, borderRadius: 3, background: 'rgba(15,30,60,0.07)' }}>
            <div style={{
              width: `${prog * 100}%`, height: '100%', borderRadius: 3,
              background: kind === 'delivered' ? L.accent2 : tracked ? L.accent : alpha(L.ink, 0.32),
            }} />
          </div>
          <span style={text(20, 500, L.ink2, { left: g.CX + g.COL.kg, top: ty - 10, width: 84, textAlign: 'right' })}>
            {r.kg}<span style={{ color: L.ink3 }}> f</span>
          </span>
        </>
      )}
    </div>
  );
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// 产品窗口（世界坐标）
const World: React.FC<{ frame: number }> = ({ frame }) => {
  const L = useLook('porcelain');
  const { g, vertical } = useGeo();
  // 用户可编辑参数（阶段 2 样板）
  const eyebrow = useShotProp('eyebrow', 'LIVE · RENDER FARM');
  const title = useShotProp('title', 'Render queue');
  const subline = useShotProp('subline', 'Updated live · 1080p · 30 fps · 4 render workers');
  const brandName = useShotProp('brand', 'video-shotcraft');
  const showBrandMark = useShotProp('showBrandMark', '1') !== '0';
  // 窗口阴影：特写时贴近（几乎不可见），拉开后升到悬浮高度——"它是一件放在舞台上的东西"
  const elev = mix(6, 34, ramp(frame, HOLD + 30, MOVE_END - HOLD - 20, EASE.swift));
  const kpi = 48210 * ramp(frame, HOLD + 6, MOVE_END - HOLD + 4, EASE.snappy);
  const headOn = ramp(frame, (vertical ? HEAD_TRIG_V : HEAD_TRIG) - 8, 20, EASE.out);

  // 顶栏两套尺寸：横屏各值即改动前的字面量；竖屏按 1080 短边收窄（导航让出右侧搜索框与头像）
  const bar = vertical
    ? {
        markSize: 24, markLeft: g.CX - 3, markTop: g.WY + 19, brandSize: 16, brandLeft: g.CX + 30, brandTop: g.WY + 23,
        navLeft: g.CX + 210, navGap: 20, navSize: 12,
        searchLeft: g.WX + g.WW - g.PAD - 284, searchTop: g.WY + 16, searchW: 200, searchH: 32, searchFs: 12,
        searchLabelLeft: 14, searchLabelTop: 9, keyFs: 11, keyLeft: 166, keyTop: 10,
        avatarLeft: g.WX + g.WW - g.PAD - 40, avatarTop: g.WY + 14, avatarSize: 36,
      }
    : {
        markSize: 32, markLeft: CX - 3, markTop: WY + 20, brandSize: 22, brandLeft: CX + 38, brandTop: WY + 25,
        navLeft: CX + 250, navGap: 40, navSize: 18,
        searchLeft: WX + WW - PAD - 330, searchTop: WY + 18, searchW: 270, searchH: 36, searchFs: 17,
        searchLabelLeft: 16, searchLabelTop: 10, keyFs: 14, keyLeft: 228, keyTop: 11,
        avatarLeft: WX + WW - PAD - 40, avatarTop: WY + 18, avatarSize: 36,
      };

  // 页头两套尺寸：KPI 104→56、标题 64→40（≈0.54–0.63×），整块仍落在窗口内的页头区
  const head = vertical
    ? {
        eyebrowTop: g.HEAD_Y + 28, eyebrowSize: 12, titleLeft: g.CX - 2, titleTop: g.HEAD_Y + 52, titleSize: 40,
        sublineTop: g.HEAD_Y + 106, sublineSize: 12,
        kpiLeft: g.WX + g.WW - g.PAD - 400, kpiTop: g.HEAD_Y + 34, kpiSize: 56, kpiW: 400, capTop: g.HEAD_Y + 100, capSize: 12,
      }
    : {
        eyebrowTop: HEAD_Y + 44, eyebrowSize: 16, titleLeft: CX - 3, titleTop: HEAD_Y + 76, titleSize: 64,
        sublineTop: HEAD_Y + 152, sublineSize: 20,
        kpiLeft: WX + WW - PAD - 520, kpiTop: HEAD_Y + 46, kpiSize: 104, kpiW: 520, capTop: HEAD_Y + 158, capSize: 20,
      };

  // 表头：横屏一行 7 列（原样）；竖屏拆两行，与行内「上段 / 下段」一一对应
  const th = vertical
    ? {
        size: 10,
        tops: [g.THEAD_Y + 10, g.THEAD_Y + 32],
        lines: [
          [{ t: 'SHOT / CUT', x: g.COL.id }, { t: 'ETA', x: g.COL.eta }, { t: 'STATUS', x: g.COL.status }],
          [{ t: 'RECIPE CARD', x: g.COL.carrier }, { t: 'PROGRESS', x: g.COL.prog }, { t: 'FRAMES', x: g.COL.kg, w: 100, right: true }],
        ],
      }
    : {
        size: 14,
        tops: [g.THEAD_Y + 14],
        lines: [[
          { t: 'SHOT', x: g.COL.id }, { t: 'CUT', x: g.COL.route }, { t: 'RECIPE CARD', x: g.COL.carrier },
          { t: 'ETA', x: g.COL.eta }, { t: 'STATUS', x: g.COL.status }, { t: 'PROGRESS', x: g.COL.prog },
          { t: 'FRAMES', x: g.COL.kg, w: 84, right: true },
        ]],
      };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{
        position: 'absolute', left: g.WX, top: g.WY, width: g.WW, height: g.WH, borderRadius: g.radius, background: L.surface,
        boxShadow: `inset 0 0 0 1px ${L.line}, ${softShadow(elev, { color: L.shadow, strength: 1.15 })}, 0 ${elev * 2}px ${elev * 4}px -${elev}px ${alpha(L.shadow, 0.14)}`,
      }} />
      {/* 顶栏 */}
      <div style={{ position: 'absolute', left: g.WX, top: g.WY, width: g.WW, height: g.BAR_H, borderBottom: `1px solid ${L.line}` }} />
      {/* 品牌：镜刻标志 + 品牌字标（可改文案 + 可显隐） */}
      {showBrandMark && <ShotcraftMark size={bar.markSize} tone="light" style={{ position: 'absolute', left: bar.markLeft, top: bar.markTop }} />}
      <span style={text(bar.brandSize, 700, BRAND.ink, { left: bar.brandLeft, top: bar.brandTop, fontFamily: BRAND.font, letterSpacing: '0.02em' })}>{brandName}</span>
      <div style={{ position: 'absolute', left: bar.navLeft, top: g.WY, height: g.BAR_H, display: 'flex', gap: bar.navGap }}>
        {['Shots', 'Render queue', 'Timeline', 'Workbench', 'Gallery'].map((t, k) => (
          <div key={t} style={{ position: 'relative', height: g.BAR_H, display: 'flex', alignItems: 'center' }}>
            <span style={{ ...text(bar.navSize, k === 1 ? 600 : 500, k === 1 ? L.ink : L.ink3), position: 'relative' }}>{t}</span>
            {k === 1 && <div style={{ position: 'absolute', left: -2, right: -2, bottom: -1, height: 2, background: L.ink }} />}
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: bar.searchLeft, top: bar.searchTop, width: bar.searchW, height: bar.searchH, borderRadius: 10, background: L.surface2, boxShadow: `inset 0 0 0 1px ${L.line}` }}>
        <span style={text(bar.searchFs, 500, L.ink3, { left: bar.searchLabelLeft, top: bar.searchLabelTop })}>Search shots…</span>
        <span style={text(bar.keyFs, 600, L.ink3, { left: bar.keyLeft, top: bar.keyTop, fontFamily: FONT.mono })}>⌘K</span>
      </div>
      <div style={{ position: 'absolute', left: bar.avatarLeft, top: bar.avatarTop, width: bar.avatarSize, height: bar.avatarSize, borderRadius: bar.avatarSize / 2, background: 'linear-gradient(135deg, #9fb4ff, #2f5bff)' }} />

      {/* 页头：标题 + KPI */}
      <div style={{ opacity: 0.35 + 0.65 * headOn }}>
        <span style={text(head.eyebrowSize, 700, L.accent, { left: g.CX, top: head.eyebrowTop, letterSpacing: '0.16em' })}>{eyebrow}</span>
        <span style={text(head.titleSize, 700, L.ink, { left: head.titleLeft, top: head.titleTop, letterSpacing: '-0.035em' })}>{title}</span>
        <span style={text(head.sublineSize, 500, L.ink3, { left: g.CX, top: head.sublineTop })}>{subline}</span>
        <span style={text(head.kpiSize, 750, L.ink, { left: head.kpiLeft, top: head.kpiTop, width: head.kpiW, textAlign: 'right', letterSpacing: '-0.045em' })}>{fmt(kpi)}</span>
        <span style={text(head.capSize, 500, L.ink3, { left: head.kpiLeft, top: head.capTop, width: head.kpiW, textAlign: 'right' })}>
          frames rendered today<span style={{ color: '#00866f', fontWeight: 600 }}>{'   ▲ 12.4%'}</span>
        </span>
      </div>

      {/* 表头 */}
      {th.lines.map((line, li) => line.map((c) => (
        <span key={`${li}-${c.t}`} style={text(th.size, 700, L.ink3, { left: g.CX + c.x, top: th.tops[li], letterSpacing: '0.14em', ...(c.w ? { width: c.w, textAlign: 'right' as const } : null) })}>{c.t}</span>
      )))}
      <div style={{ position: 'absolute', left: g.CX, top: g.ROW0 - 1, width: g.WW - g.PAD * 2, height: 1, background: L.line }} />

      {DATA.map((_, i) => <RowView key={i} i={i} frame={frame} />)}
    </div>
  );
};

// 相机层：世界 → 屏幕
const Cam: React.FC<{ frame: number; children: React.ReactNode }> = ({ frame, children }) => {
  const { g } = useGeo();
  const { s, tx, ty } = camAt(frame, g);
  return (
    <div style={{ position: 'absolute', width: g.vw, height: g.vh, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
      {children}
    </div>
  );
};

// 舞台背景点阵：按 0.35 视差跟相机（比窗口"更远"）
const DOTS = (() => {
  const out: { x: number; y: number }[] = [];
  for (let y = -600; y <= 1700; y += 48) for (let x = -900; x <= 2800; x += 48) out.push({ x, y });
  return out;
})();
// 竖屏点阵：覆盖 1080×1920 的世界范围（横屏点阵只铺到 y=1700，竖屏会露底）
const DOTS_V = (() => {
  const out: { x: number; y: number }[] = [];
  for (let y = -600; y <= 2400; y += 48) for (let x = -600; x <= 1800; x += 48) out.push({ x, y });
  return out;
})();
const BackDots: React.FC<{ frame: number }> = ({ frame }) => {
  const L = useLook('porcelain');
  const { g, vertical } = useGeo();
  const { s, tx, ty } = camAt(frame, g);
  const k = 0.35;
  const sp = 1 + (s - 1) * k;
  const px = g.cx + (tx + g.cx * s - g.cx) * k - g.cx * sp; // 让视差层与主相机同心
  const py = g.cy + (ty + g.cy * s - g.cy) * k - g.cy * sp;
  return (
    <svg width={g.vw} height={g.vh} style={{ position: 'absolute', inset: 0 }}>
      <g transform={`translate(${px.toFixed(2)} ${py.toFixed(2)}) scale(${sp.toFixed(4)})`}>
        {(vertical ? DOTS_V : DOTS).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={1.6} fill={alpha(L.ink, 0.13)} />)}
      </g>
    </svg>
  );
};

// Page 自己读帧：CameraMotionBlur 靠子树内的 useCurrentFrame 做多重采样，外部传 frame 会把采样冻住
const Page: React.FC = () => {
  const frame = useCurrentFrame();
  const L = useLook('porcelain');
  return (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <Stage look={L} keyLight={{ x: 0.5, y: 0.02 }} fill={{ x: 0.85, y: 1 }} grain={0} vignette={0.14}>
      <BackDots frame={frame} />
    </Stage>
    <Cam frame={frame}>
      <World frame={frame} L={L} />
    </Cam>
  </AbsoluteFill>
  );
};

// 行洗光（不进 CameraMotionBlur：半透明色块多重采样会出条带）
const Sweeps: React.FC<{ frame: number }> = ({ frame }) => {
  const L = useLook('porcelain');
  const { g, vertical } = useGeo();
  const trig = vertical ? ROW_TRIG_V : ROW_TRIG;
  return (
  <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
    <Cam frame={frame}>
      {trig.map((t, i) => {
        if (t < 0 || i === TRACK) return null;
        const p = ramp(frame, t, 20, EASE.out);
        const op = Math.min(1, ramp(frame, t, 3, EASE.linear)) * (1 - ramp(frame, t + 6, 18, EASE.out));
        if (op <= 0.002) return null;
        const head = mix(-0.2, 1.1, p);
        return (
          <div key={i} style={{
            position: 'absolute', left: g.WX + 10, top: g.rowTop(i) + 3, width: g.WW - 20, height: g.ROW_H - 6, borderRadius: 12, opacity: op,
            background: `linear-gradient(90deg, ${alpha(L.accent, 0.03)} 0%, ${alpha(L.accent, 0.14)} ${(head * 100).toFixed(1)}%, ${alpha(L.accent, 0)} ${((head + 0.22) * 100).toFixed(1)}%)`,
            boxShadow: `inset 0 0 0 1px ${alpha(L.accent, 0.18)}`,
          }} />
        );
      })}
    </Cam>
  </AbsoluteFill>
  );
};

export const CraneRiseReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const L = useLook('porcelain');
  // 竖屏布局坐标是 1080×1920 设计值；实际画布可能更小（如 540×960 的验证/预览管线），
  // 因此按短边算出统一比例 k，整幅等比缩放并居中，避免设计坐标被右侧画框硬裁。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const k = vertical ? Math.min(width / GV.vw, height / GV.vh) : 1;
  const fit = vertical && (k !== 1 || width !== GV.vw || height !== GV.vh)
    ? { k, left: (width - GV.vw * k) / 2, top: (height - GV.vh * k) / 2 }
    : null;
  const fast = frame > HOLD + 1 && frame < BLUR_END;
  // 特写段的取景暗角：压边聚焦那一行，拉开后收掉（舞台自带的极淡暗角接手）
  const vig = 1 - ramp(frame, HOLD, 60, EASE.swift);
  const content = (
    <>
      {fast ? (
        <CameraMotionBlur shutterAngle={150} samples={10}>
          <Page />
        </CameraMotionBlur>
      ) : (
        <Page />
      )}
      <Sweeps frame={frame} />
      <AbsoluteFill style={{
        pointerEvents: 'none', opacity: vig,
        background: `radial-gradient(ellipse 75% 70% at 45% 58%, ${alpha(L.shadow, 0)} 55%, ${alpha(L.shadow, 0.16)} 100%)`,
      }} />
    </>
  );
  return (
    <AbsoluteFill style={{ background: L.bg[1], overflow: 'hidden' }}>
      {fit ? (
        // 竖屏非设计尺寸：1080×1920 的设计画布整体缩放，512/720 宽等尺寸都落在画框内
        <div style={{
          position: 'absolute', left: fit.left, top: fit.top, width: GV.vw, height: GV.vh,
          transform: `scale(${fit.k})`, transformOrigin: '0 0',
        }}>{content}</div>
      ) : content}
    </AbsoluteFill>
  );
};
