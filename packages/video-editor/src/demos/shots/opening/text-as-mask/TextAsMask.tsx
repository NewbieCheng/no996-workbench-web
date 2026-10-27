// @ts-nocheck
// 文字视频遮罩（text-as-mask）——超粗大标题字内部透出缓慢平移的产品画面，结尾字形放大溢出、
// 内部画面接管全屏。字是门，产品在门里。
//
// 第二轮重设计（瓷白舞台 · 暗色实时面板）：
// - look = porcelain。冷白瓷舞台上切出一个 470px 的 Black 字重「SCALE」——字形是一扇窗：
//   窗外的瓷白舞台有主光与暗角，窗下投一层带色相的软影（字像被"挖"进舞台）。
// - 窗里是为镜头设计的暗色实时面板「video-shotcraft · Render throughput」（渲染农场看板）：钴蓝→青的流式面积图一直在向左流、
//   渲染帧数在计数、渲染队列柱状图在呼吸——大块的饱和色与亮线让笔画里一眼看出"里面有个活的产品"，
//   而不是原版那种白卡（白字里透白卡 = 普通白字）。
// - 字的入场：遮罩从基线向上擦出（clip 从下往上收），字整体 1.04→1 落定；眉题字距收拢、副题升起。
// - 接管：先吸一口气（字 1→0.965，副题与眉题退场，8f）→ 指数冲入（对数空间 t^1.8，24f 到 46×，
//   每帧放大比例越来越大 = 越冲越快）；放大原点钉在 L 竖笔实心处；内容层 1/S 反向补偿不畸变；
//   冲入后段无遮罩全屏层淡入补齐字缝；面板 1.32→1 用 expo-out 落到标准构图，晚冲入 6f 收敛（跟随）。
// - 收尾：完整的暗色面板做最后一张海报，流式图仍在缓慢流动（不是死帧）。
//
// 时间表（30fps，共 165f）：
//   0–18    瓷白舞台 + 字形自基线擦出、1.04→1 落定；6–26 眉题、14–32 副题
//   18–96   字内面板漂移（translateX +150→-150，两端轻缓）；面板自身流式图/计数一直在动
//   96–104  吸气：字 1→0.965，眉题/副题 exit 退场
//   104–128 冲入：遮罩 0.965→46×（对数空间 t^1.8 加速），~121–126 接管层淡入
//   104–132 面板 1.32→1、漂移归零（expo-out，落定比冲入晚 6f）
//   132–165 hold：全屏面板，流式图缓慢流动
import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useShotProp, interpolate } from '../../../runtime/index.ts';
import { EASE, FONT, bezier, ramp } from '../../_fixtures/Polish';
import { Stage, type, useLook } from '../../_fixtures/Look';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';

export const TEXT_AS_MASK_DURATION = 165;

// —— 字形遮罩 ——
const WORD = 'SCALE';
const FONT_STACK = 'system-ui, -apple-system, Helvetica Neue, Arial, sans-serif';
const FS = 470;
const BASE_Y = 712; // 基线
const TEXT_ATTRS = `x="960" y="${BASE_Y}" font-family="${FONT_STACK}" font-size="${FS}" font-weight="900" letter-spacing="-22" text-anchor="middle"`;
const MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><text ${TEXT_ATTRS} fill="white">${WORD}</text></svg>`;
const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(MASK_SVG)}")`;
const SHADOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><text ${TEXT_ATTRS} fill="#0c1a3a">${WORD}</text></svg>`;
const SHADOW_URL = `data:image/svg+xml,${encodeURIComponent(SHADOW_SVG)}`;
// 放大原点：L 竖笔实心处（换词/换字体必须重量：渲一帧看放大方向，洞不对中就微调）
const ORIGIN_X = 1236; // L 竖笔 x∈[1195,1278] 的中线——钉在竖笔中线，S≈23× 时竖笔左右同时撑出画幅
const ORIGIN_Y = 546; // 竖笔 y∈[383,709] 的中线
const ORIGIN = `${ORIGIN_X}px ${ORIGIN_Y}px`;
const MAX_S = 46;

// —— 节拍 ——
const IN_END = 18;
const DRIFT0 = 18;
const DRIFT1 = 96;
const BREATH0 = 96;
const RUSH0 = 104;
const RUSH1 = 128;
const LAND1 = 132;
const DASH_S0 = 1.32;

// —— 窗里的产品：video-shotcraft 的暗色渲染看板（1920×1080 作画）——
const THEMES: Record<string, { bg: string; bgRadial: string; blue: string; teal: string; panel: string; panel2: string; ink: string }> = {
  'dark-blue': { bg: '#0a0f1e', bgRadial: '#12204a', blue: '#4d7cff', teal: '#19d3b4', panel: '#0f1730', panel2: '#131d3b', ink: '#eef3ff' },
  'neon-purple': { bg: '#0d071a', bgRadial: '#25124a', blue: '#9d4dff', teal: '#d319a8', panel: '#170b2c', panel2: '#200f3d', ink: '#f5eeff' },
  'cyber-teal': { bg: '#061414', bgRadial: '#0d2c2c', blue: '#19d3b4', teal: '#00ffc8', panel: '#0c2121', panel2: '#102d2d', ink: '#e6ffff' },
  'obsidian-gold': { bg: '#0f0e0b', bgRadial: '#2e2716', blue: '#e0b354', teal: '#ffd700', panel: '#1f1c13', panel2: '#2b271a', ink: '#fff9e6' },
  'sunset-orange': { bg: '#140a08', bgRadial: '#33140e', blue: '#ff5722', teal: '#ff9800', panel: '#24110d', panel2: '#331713', ink: '#fff1ed' },
  'porcelain-light': { bg: '#f4f6fa', bgRadial: '#e2e8f0', blue: '#2563eb', teal: '#0d9488', panel: '#ffffff', panel2: '#f8fafc', ink: '#0f172a' },
};

// 确定性流式曲线：u = 横向样本位置（随帧递增 = 数据向左流）
const wave = (u: number) => 0.52 + 0.17 * Math.sin(u * 0.11) + 0.09 * Math.sin(u * 0.31 + 1.3) + 0.05 * Math.sin(u * 0.73 + 0.4) + 0.12 * Math.max(0, Math.sin(u * 0.045 - 0.6));

const parseRatio = (v: string | number | undefined, fallback: number): number => {
  if (typeof v === 'number') return Math.min(1, Math.max(0, v <= 1 ? v : v / 100));
  if (!v) return fallback;
  const clean = String(v).replace('%', '').trim();
  const n = parseFloat(clean);
  if (isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n <= 1 ? n : n / 100));
};

type DashboardProps = {
  frame: number
  sidebarBrand?: string
  navItem1?: string
  navItem2?: string
  navItem3?: string
  navItem4?: string
  navItem5?: string
  activeNavIndex?: string
  title?: string
  status?: string
  kpi1Label?: string
  kpi1Value?: string
  kpi2Label?: string
  kpi2Value?: string
  kpi3Label?: string
  chartTitle?: string
  chartUnit?: string
  region1Name?: string
  region1Value?: string
  region2Name?: string
  region2Value?: string
  region3Name?: string
  region3Value?: string
  region4Name?: string
  region4Value?: string
  colorTheme?: string
  customBg?: string
  customPrimary?: string
  customSecondary?: string
  customPanel?: string
  customInk?: string
}

const Dashboard: React.FC<DashboardProps> = ({
  frame,
  sidebarBrand,
  navItem1 = 'Overview',
  navItem2 = 'Renders',
  navItem3 = 'Shots',
  navItem4 = 'Timeline',
  navItem5 = 'Gallery',
  activeNavIndex = '2',
  title,
  status = 'Live',
  kpi1Label,
  kpi1Value,
  kpi2Label,
  kpi2Value,
  kpi3Label,
  chartTitle,
  chartUnit,
  region1Name,
  region1Value,
  region2Name,
  region2Value,
  region3Name,
  region3Value,
  region4Name,
  region4Value,
  colorTheme = 'dark-blue',
  customBg,
  customPrimary,
  customSecondary,
  customPanel,
  customInk,
}) => {
  const theme = THEMES[colorTheme] || THEMES['dark-blue'];
  const D = {
    bg: customBg || theme.bg,
    panel: customPanel || theme.panel,
    panel2: customPanel ? `${customPanel}ee` : theme.panel2,
    line: 'rgba(150,180,255,0.14)',
    ink: customInk || theme.ink,
    ink2: customInk ? `${customInk}b3` : '#9aa8c8',
    ink3: customInk ? `${customInk}80` : '#5d6a8a',
    blue: customPrimary || theme.blue,
    teal: customSecondary || theme.teal,
  };

  const flow = frame * 0.55; // 流速（样本/帧）
  const CW = 1560, CH = 380, N = 96;
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const x = (i / N) * CW;
    const y = CH - wave(i + flow) * CH * 0.92;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${CW} ${CH} L0 ${CH} Z`;
  const last = pts[pts.length - 1];
  const reqs = 1.92 + 0.56 * ramp(frame, 10, 96, EASE.out);
  const bars = Array.from({ length: 24 }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i * 1.7 + frame * 0.05)) * (0.6 + 0.4 * Math.sin(i * 0.45)));

  const regions: [string, number][] = [
    [region1Name || 'opening', parseRatio(region1Value, 0.92)],
    [region2Name || 'camera', parseRatio(region2Value, 0.74)],
    [region3Name || 'transition', parseRatio(region3Value, 0.58)],
    [region4Name || 'outro', parseRatio(region4Value, 0.41)],
  ];

  const Card: React.FC<{ x: number; y: number; w: number; h: number; children: React.ReactNode }> = ({ x, y, w, h, children }) => (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 22, background: `linear-gradient(180deg, ${D.panel2}, ${D.panel})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${D.line}`, boxSizing: 'border-box', padding: '26px 30px', overflow: 'hidden' }}>{children}</div>
  );
  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '0.14em', color: D.ink2, textTransform: 'uppercase' }}>{children}</div>;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 60% 30%, ${theme.bgRadial} 0%, ${D.bg} 70%)`, fontFamily: FONT.sans, color: D.ink }}>
      {/* 侧栏 */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 230, borderRight: `1px solid ${D.line}`, padding: '36px 30px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShotcraftMark size={40} tone="dark" />
          <div style={{ fontFamily: BRAND.font, fontSize: 28, fontWeight: 700, letterSpacing: '0.01em' }}>{sidebarBrand || BRAND.short}</div>
        </div>
        {[
          { text: navItem1, key: 'navItem1', idx: 1 },
          { text: navItem2, key: 'navItem2', idx: 2 },
          { text: navItem3, key: 'navItem3', idx: 3 },
          { text: navItem4, key: 'navItem4', idx: 4 },
          { text: navItem5, key: 'navItem5', idx: 5 },
        ].map(({ text, idx }, i) => {
          const isActive = String(idx) === String(activeNavIndex || '2') || (i === 1 && !activeNavIndex);
          return (
            <div
              key={i}
              style={{
                marginTop: i ? 14 : 54,
                fontSize: 24,
                fontWeight: isActive ? 650 : 500,
                color: isActive ? D.ink : D.ink3,
                padding: '10px 14px',
                borderRadius: 10,
                background: isActive ? 'rgba(77,124,255,0.16)' : 'transparent',
              }}
            >
              {text}
            </div>
          );
        })}
      </div>
      {/* 页眉 */}
      <div style={{ position: 'absolute', left: 290, top: 44, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ ...type(56, 720), color: D.ink }}>{title || 'Render throughput'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, background: 'rgba(25,211,180,0.14)', color: D.teal, fontSize: 24, fontWeight: 650 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: D.teal, boxShadow: `0 0 12px ${D.teal}`, opacity: 0.6 + 0.4 * Math.sin(frame / 5) }} />{status || 'Live'}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 60, top: 54, fontSize: 24, color: D.ink2, padding: '10px 18px', borderRadius: 12, boxShadow: `0 0 0 1px ${D.line}` }}>Last 24 hours</div>
      {/* KPI */}
      <Card x={290} y={150} w={520} h={200}>
        <Label>{kpi1Label || 'Frames rendered'}</Label>
        <div style={{ ...type(96, 760), marginTop: 14 }}>{kpi1Value || `${reqs.toFixed(2)}M`}</div>
      </Card>
      <Card x={834} y={150} w={500} h={200}>
        <Label>{kpi2Label || 'Avg shot render'}</Label>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14 }}>
          <div style={{ ...type(96, 760) }}>{kpi2Value || '42s −18%'}</div>
        </div>
      </Card>
      <Card x={1358} y={150} w={502} h={200}>
        <Label>{kpi3Label || 'Render queue'}</Label>
        <svg width={440} height={100} style={{ marginTop: 16 }}>
          {bars.map((b, i) => <rect key={i} x={i * 18.5} y={100 - b * 100} width={12} height={b * 100} rx={3} fill={i > 17 ? D.teal : D.blue} opacity={0.5 + 0.5 * b} />)}
        </svg>
      </Card>
      {/* 主图：流式面积图 */}
      <Card x={290} y={376} w={1570} h={470}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Label>{chartTitle || 'Frames / sec'}</Label>
          <div style={{ fontSize: 22, color: D.ink3, fontFamily: FONT.mono }}>{chartUnit || 'fps · 1s buckets'}</div>
        </div>
        <svg width={CW} height={CH} style={{ position: 'absolute', left: 4, top: 70, overflow: 'visible' }}>
          <defs>
            <linearGradient id="tam-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={D.blue} stopOpacity={0.55} />
              <stop offset="1" stopColor={D.blue} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="tam-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={D.blue} />
              <stop offset="1" stopColor={D.teal} />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={CW} y1={CH * g} y2={CH * g} stroke={D.line} strokeWidth={1.5} />)}
          <path d={area} fill="url(#tam-area)" />
          <path d={line} fill="none" stroke="url(#tam-line)" strokeWidth={5} strokeLinejoin="round" />
          <circle cx={last[0]} cy={last[1]} r={10} fill={D.teal} />
          <circle cx={last[0]} cy={last[1]} r={22} fill={D.teal} opacity={0.22} />
        </svg>
      </Card>
      {/* 区域 */}
      <Card x={290} y={870} w={1570} h={170}>
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', height: '100%' }}>
          {regions.map(([name, v]) => (
            <div key={name} style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24 }}>
                <span style={{ color: D.ink2, fontFamily: FONT.mono }}>{name}</span>
                <span style={{ fontWeight: 650 }}>{Math.round(v * 100)}%</span>
              </div>
              <div style={{ marginTop: 14, height: 12, borderRadius: 6, background: 'rgba(150,180,255,0.1)' }}>
                <div style={{ width: `${v * 100}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${D.blue}, ${D.teal})` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export const TextAsMask: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLook('porcelain');
  const userText = useShotProp('text', '');
  const userSubline = useShotProp('subline', '');
  const userInnerImage = useShotProp('innerImage', '');
  const userSidebarBrand = useShotProp('sidebarBrand', '');
  const userNavItem1 = useShotProp('navItem1', 'Overview');
  const userNavItem2 = useShotProp('navItem2', 'Renders');
  const userNavItem3 = useShotProp('navItem3', 'Shots');
  const userNavItem4 = useShotProp('navItem4', 'Timeline');
  const userNavItem5 = useShotProp('navItem5', 'Gallery');
  const userActiveNavIndex = useShotProp('activeNavIndex', '2');
  const userDashboardTitle = useShotProp('dashboardTitle', '');
  const userDashboardStatus = useShotProp('dashboardStatus', 'Live');
  const userKpi1Label = useShotProp('kpi1Label', '');
  const userKpi1Value = useShotProp('kpi1Value', '');
  const userKpi2Label = useShotProp('kpi2Label', '');
  const userKpi2Value = useShotProp('kpi2Value', '');
  const userKpi3Label = useShotProp('kpi3Label', 'Render queue');
  const userChartTitle = useShotProp('chartTitle', 'Frames / sec');
  const userChartUnit = useShotProp('chartUnit', 'fps · 1s buckets');
  const userRegion1Name = useShotProp('region1Name', 'opening');
  const userRegion1Value = useShotProp('region1Value', '92%');
  const userRegion2Name = useShotProp('region2Name', 'camera');
  const userRegion2Value = useShotProp('region2Value', '74%');
  const userRegion3Name = useShotProp('region3Name', 'transition');
  const userRegion3Value = useShotProp('region3Value', '58%');
  const userRegion4Name = useShotProp('region4Name', 'outro');
  const userRegion4Value = useShotProp('region4Value', '41%');
  const userColorTheme = useShotProp('colorTheme', 'dark-blue');
  const userCustomBg = useShotProp('customBg', '');
  const userCustomPrimary = useShotProp('customPrimary', '');
  const userCustomSecondary = useShotProp('customSecondary', '');
  const userCustomPanel = useShotProp('customPanel', '');
  const userCustomInk = useShotProp('customInk', '');

  const word = userText || WORD;
  const fs = Math.min(FS, Math.round(1800 / Math.max(2, word.length)));
  const textAttrs = `x="960" y="${BASE_Y}" font-family="${FONT_STACK}" font-size="${fs}" font-weight="900" letter-spacing="${word.length > 5 ? -6 : -22}" text-anchor="middle"`;
  const maskUrl = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><text ${textAttrs} fill="white">${word}</text></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [textAttrs, word]);
  const shadowUrl = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><text ${textAttrs} fill="#0c1a3a">${word}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }, [textAttrs, word]);

  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  // 入场：遮罩从基线向上擦出 + 1.04→1 落定
  const intro = ramp(f, 0, IN_END, EASE.snappy);
  const wipe = ramp(f, 0, 16, EASE.out);
  const introS = 1.04 - 0.04 * intro;

  // 吸气 → 冲入（对数空间 ease-in：每帧放大比例越来越大）
  const breath = ramp(f, BREATH0, RUSH0 - BREATH0, EASE.swift);
  const rush = Math.pow(ramp(f, RUSH0, RUSH1 - RUSH0, EASE.linear), 1.8); // 对数空间里 t^1.8：越冲越快
  const s0 = introS * (1 - 0.035 * breath);
  const maskS = s0 * Math.pow(MAX_S / s0, rush);
  // 冲入时把 L 竖笔同步拉回画面中线（相机对准门洞）；内容层做同一变换的逆，产品画面不动
  const cdx = (960 - ORIGIN_X) * rush;
  const cdy = (540 - ORIGIN_Y) * rush;
  const wrapT = `translate(${cdx.toFixed(2)}px, ${cdy.toFixed(2)}px) scale(${maskS})`;
  const innerT = `scale(${1 / maskS}) translate(${(-cdx).toFixed(2)}px, ${(-cdy).toFixed(2)}px)`;

  // 面板：漂移（两端轻缓）→ 冲入时归位（expo-out，晚 6f 收敛 = 跟随）
  const drift = ramp(f, DRIFT0, DRIFT1 - DRIFT0, bezier(0.3, 0, 0.7, 1));
  const land = ramp(f, RUSH0, LAND1 - RUSH0, EASE.snappy);
  const dx = (150 - 300 * drift) * (1 - land);
  const dy = -110 * (1 - land); // 漂移期面板上移，让流式图的亮线正好穿过字的腰线、面积渐变铺满字的下半截
  const dashS = DASH_S0 + (1 - DASH_S0) * land;
  // 接管层：竖笔撑满大半画面后才淡入补齐字缝
  const cover = interpolate(rush, [0.86, 0.95], [0, 1], clamp); // 竖笔已撑满全屏（S≈24×）之后才换层，零灰纱
  // 投影：冲入前段退掉
  const rim = 1 - interpolate(rush, [0, 0.25], [0, 1], clamp);
  // 眉题 / 副题
  const eyebrow = ramp(f, 6, 20, EASE.out);
  const sub = ramp(f, 14, 18, EASE.out);
  const out = 1 - ramp(f, BREATH0, 10, EASE.exit);

  const dash = (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${dashS.toFixed(4)})`, transformOrigin: '50% 50%' }}>
      {userInnerImage ? (
        <img
          src={userInnerImage}
          alt="Product Screen"
          style={{ width: 1920, height: 1080, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Dashboard
          frame={f}
          sidebarBrand={userSidebarBrand}
          navItem1={userNavItem1}
          navItem2={userNavItem2}
          navItem3={userNavItem3}
          navItem4={userNavItem4}
          navItem5={userNavItem5}
          activeNavIndex={userActiveNavIndex}
          title={userDashboardTitle}
          status={userDashboardStatus}
          kpi1Label={userKpi1Label}
          kpi1Value={userKpi1Value}
          kpi2Label={userKpi2Label}
          kpi2Value={userKpi2Value}
          kpi3Label={userKpi3Label}
          chartTitle={userChartTitle}
          chartUnit={userChartUnit}
          region1Name={userRegion1Name}
          region1Value={userRegion1Value}
          region2Name={userRegion2Name}
          region2Value={userRegion2Value}
          region3Name={userRegion3Name}
          region3Value={userRegion3Value}
          region4Name={userRegion4Name}
          region4Value={userRegion4Value}
          colorTheme={userColorTheme}
          customBg={userCustomBg}
          customPrimary={userCustomPrimary}
          customSecondary={userCustomSecondary}
          customPanel={userCustomPanel}
          customInk={userCustomInk}
        />
      )}
    </div>
  );
  const clipBottom = `inset(0 0 ${((1 - wipe) * (1080 - BASE_Y + FS * 0.72)).toFixed(1)}px 0)`;

  return (
    <AbsoluteFill style={{ background: L.bg[1], overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.42, y: 0.12 }} fill={{ x: 0.85, y: 0.9 }} vignette={0.22} />

      {/* 字形投影：窗被"挖"进舞台的一层带色相软影 */}
      <img src={shadowUrl} style={{
        position: 'absolute', left: 0, top: 26, width: 1920, height: 1080, opacity: 0.2 * rim * intro, filter: 'blur(22px)',
        transform: wrapT, transformOrigin: ORIGIN, clipPath: clipBottom,
      }} />

      {/* 遮罩层：wrapper 负责 mask + 放大；inner 用 1/S 反向缩放抵消内容形变 */}
      <div style={{
        position: 'absolute', inset: 0, transform: wrapT, transformOrigin: ORIGIN, clipPath: clipBottom,
        WebkitMaskImage: maskUrl, maskImage: maskUrl, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskSize: '1920px 1080px', maskSize: '1920px 1080px',
      }}>
        <div style={{ position: 'absolute', inset: 0, transform: innerT, transformOrigin: ORIGIN }}>{dash}</div>
      </div>

      {/* 接管层：同一运动变换的全屏面板，冲入后段淡入 */}
      {cover > 0 && <div style={{ position: 'absolute', inset: 0, opacity: cover }}>{dash}</div>}

      {/* 眉题 + 副题 */}
      <div style={{ position: 'absolute', top: 214, width: '100%', textAlign: 'center', opacity: eyebrow * out }}>
        {/* 眉题 = video-shotcraft 字标（全小写；字距收拢的入场保留） */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, verticalAlign: 'middle' }}>
          <ShotcraftMark size={44} tone="light" />
          <span style={{ fontFamily: BRAND.font, fontSize: 30, fontWeight: 700, color: L.ink, letterSpacing: `${(0.03 + (1 - eyebrow) * 0.3).toFixed(3)}em` }}>{BRAND.name}</span>
        </span>
      </div>
      <div style={{
        position: 'absolute', top: BASE_Y + 92, width: '100%', textAlign: 'center', fontFamily: FONT.sans, fontSize: 40, fontWeight: 500,
        letterSpacing: '-0.015em', color: L.ink2, opacity: sub * out, transform: `translateY(${((1 - sub) * 16).toFixed(2)}px)`,
      }}>
        {userSubline ? (
          <span>{userSubline}</span>
        ) : (
          <>From one prompt to <span style={{ color: L.ink, fontWeight: 700 }}>a finished launch film</span>.</>
        )}
      </div>
    </AbsoluteFill>
  );
};
