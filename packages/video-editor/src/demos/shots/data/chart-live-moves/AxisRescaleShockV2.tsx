// @ts-nocheck
// axis-rescale-shock-v2 —— 轴爆表重标：折线正常爬升，新值顶破图表上沿冲进标题区，
// 停半拍，y 轴"哗"地重标（旧刻度飞出 / 新刻度滑入 / 网格加密 / 旧线压扁成地平线），新值落回 + 弹真值标签。
//
// 第二轮重设计（沙色瑞士海报 · 渲染月报）：
// - look = sand（米色纸 + 墨黑 + 赤陶）。不再是"卡片里的小图表"，而是整张画面就是一页瑞士网格财务海报：
//   左上 120px 粗黑体标题「Monthly renders」、右上同字号年度合计 KPI，下面是满版图表（1540×540 绘图区），
//   3px 墨黑基线 + 3px "天花板"粗规线 + 发丝网格，历史面积用 45° 斜线排线（印刷感），月份/刻度 32px。
// - 主角是赤陶色爆表段：Dec 新值从 Nov 起跳，越冲越快顶破天花板规线（规线在穿透点裂开、两片碎屑弹飞），
//   一路冲进右上角的 KPI 数字里（KPI 被撞得一颤），悬停半拍带柔光——"装不下"字面化。
// - 重标：14f 内旧刻度 25k–100k 向下飞出、新刻度 100k–400k 从上滑入，网格 4→8 根从左展开，
//   旧折线与斜线面积被压扁成地平线；爆表点落回 340k，弹出赤陶真值标签，KPI 滚到 833k。
// - 品牌轮：眉题换成 video-shotcraft 标志 + 字标，内容从财务营收换成渲染量（数值与版式不变）。
//
// 竖屏重排（9:16 = 1080×1920，FrameProvider 给真实画布尺寸时才走）：满版横排的标题 + 右上 KPI 改成
// 眉题 / 主标题 / KPI 三行等宽右对齐叠放；1540 宽的绘图区收窄到 800（左右各留 48，刻度列 150），
// 高度拉到 880 并把基线放到 1500、月份行落在 1516（上 180 / 下 320 安全区内）；字号按短边缩到
// 0.6–0.75 倍（主标题 124→76、真值 76→60、刻度/月份/标签 32→24）；碎屑飞行距离同步收窄。
// 横屏（1920×1080，导出与回归）走的是原来那套常量，逐像素不变。
//
// 时间表（30fps，共 168f）：
//   0–20    规线从左画出、标题逐词升起、刻度/月份淡入（第 1 帧已有纸面与规线起点）
//   14–56   历史段 Jan→Nov 写入（42f，不对称 in-out），笔尖带墨点
//   50–62   预警：天花板规线与 100k 刻度转赤陶，Nov 点一圈脉冲（预备）
//   62–76   爆表 14f：越冲越快（ease-in 主导）顶破规线（~69f 穿透：裂口 + 碎屑 + 图表震 10px）→ 冲进 KPI
//   76–94   悬停 18f：笔尖亮头 + 柔光，KPI 被撞后阻尼回位
//   94–108  重标 14f（expo-out）：刻度换、网格密、旧线压扁、端点落回
//   106–126 端点标记 overshoot 落座 + 真值标签弹出；KPI 493k → 833k
//   126–168 hold 42f：只有极缓推镜（1 → 1.018）
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useShotProp, useVideoConfig } from '../../../runtime/index.ts';
import { EASE, bezier, mix, ramp } from '../../_fixtures/Polish';
import { LOOKS, Stage, TextReveal, alpha, type, useLook} from '../../_fixtures/Look';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';

export const AXIS_RESCALE_SHOCK_V2_DURATION = 168;


// 版式网格
const M = 96;
const X0 = 268; // 绘图区左
const X1 = 1800; // 绘图区右（Dec）
const PW = X1 - X0;
const CEIL = 362; // 天花板规线
const BASE = 902; // 基线
const PH = BASE - CEIL;
const SHOCK_TOP = CEIL - 226; // 冲出天花板 226px，扎进标题行

const DATA = [22, 30, 26, 38, 35, 47, 44, 58, 55, 66, 72, 340];
const N = DATA.length;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DRAW0 = 14;
const DRAW1 = 56;
const WARN = 50;
const SHOCK0 = 62;
const SHOCK1 = 76;
const BEAT = 94;
const RESCALE1 = 108;
const MARK = 106;

// 冲顶：起步慢、越冲越快，到顶微过冲
const easeShock = bezier(0.7, 0, 0.36, 1.06);

const xOf = (i: number) => X0 + (i / (N - 1)) * PW;

export const AxisRescaleShockV2: React.FC = () => {
  const L = useLook('sand');
  const INK = L.ink;
  const ACC = L.accent; // 赤陶：只给爆表段 / 事件
  const frame = useCurrentFrame();
  const userMetric = useShotProp('metric', '');
  const userValue = useShotProp('value', '');
  const userLabel = useShotProp('label', '');

  // 竖屏重排（9:16 = 1080×1920）：横屏那套版式数字原样留在上面的 module 常量里，这里只给竖屏
  // 换一套几何 —— 满版 1540 宽的绘图区收窄到 800（1080 - 左右 48 - 刻度列），字号按短边约 0.6 倍，
  // 整块标题/KPI/图表收进上 180 / 下 320 的安全区。横屏时下面每个 g* 都退回原常量，逐像素不变。
  const { width, height } = useVideoConfig();
  const vertical = height > width;

  // 竖屏设计画布：下面所有竖屏版式数字都按 1080×1920 的坐标系摆位。但真实画布**不一定是** 1080 宽
  // （镜头库预览 / 9:16 验证给 540×960，720p 导出给 720×1280）——把 1080 当画布宽度写死，整幅图就会
  // 仍按 1080 摆位、再被实际更窄的画布从右边裁掉：主标题只剩「Monthly rende」、右侧 KPI 贴边、
  // 月份行与真值标签整块出画。所以这里按真实画布反算等比 scale，把 1080×1920 的设计画布贴进画布：
  // 画布正好 1080×1920 时 scale=1（设计画布即画布本身，与改前逐像素一致），更小的画布整套等比缩小。
  const vScale = vertical ? Math.min(width / 1080, height / 1920) : 1;
  const vWrap = !vertical ? undefined
    : vScale === 1 ? { position: 'absolute', inset: 0 }
    : {
        position: 'absolute',
        left: (width - 1080 * vScale) / 2,
        top: (height - 1920 * vScale) / 2,
        width: 1080,
        height: 1920,
        transform: `scale(${vScale.toFixed(5)})`,
        transformOrigin: '0 0',
      };

  const gM = vertical ? 48 : M;          // 左边距（刻度列起点）
  const gX0 = vertical ? 208 : X0;       // 绘图区左（让开 150 宽的刻度列）
  const gX1 = vertical ? 1008 : X1;      // 绘图区右（Dec）
  const gPW = vertical ? 800 : PW;       // 绘图区宽
  const gGridR = vertical ? 1032 : 1824; // 网格/基线/规线右端
  const gCeil = vertical ? 620 : CEIL;   // 天花板规线
  const gBase = vertical ? 1500 : BASE;  // 基线（月份行下方仍留 100px 到底部安全区）
  const gPH = vertical ? 880 : PH;       // 绘图区高
  const gShockTop = vertical ? 396 : SHOCK_TOP; // 冲出天花板后扎进 KPI 数字（横屏在标题行齐平，竖屏正对 833k 的字头）
  // 横屏分支下 g* 全等于原常量，xOfV / tickY 取到的每个坐标与改动前逐值一致。
  const xOfV = (i: number) => (vertical ? gX0 + (i / (N - 1)) * gPW : xOf(i));
  const tickY = (i: number) => gBase - ((i + 1) / 4) * gPH;

  const rescaleP = ramp(frame, BEAT, RESCALE1 - BEAT, EASE.snappy);
  const range = mix(100, 400, rescaleP);
  const yOf = (v: number) => gBase - (v / range) * gPH;

  // 历史段写入
  const drawT = ramp(frame, DRAW0, DRAW1 - DRAW0, EASE.swift) * (N - 2);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= Math.floor(drawT); i++) pts.push([xOfV(i), yOf(DATA[i])]);
  if (drawT < N - 2 && drawT > Math.floor(drawT)) {
    const i = Math.floor(drawT);
    const f = drawT - i;
    pts.push([mix(xOfV(i), xOfV(i + 1), f), mix(yOf(DATA[i]), yOf(DATA[i + 1]), f)]);
  }
  const lineD = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  // 爆表段
  const shockT = ramp(frame, SHOCK0, SHOCK1 - SHOCK0, easeShock);
  const nx = xOfV(N - 2);
  const ny = yOf(DATA[N - 2]);
  const topY = mix(gShockTop, yOf(DATA[N - 1]), rescaleP);
  const hx = mix(nx, gX1, Math.min(1, shockT));
  const hy = mix(ny, topY, shockT);
  const shockOn = frame >= SHOCK0;

  // 面积（含爆表段）
  const all: Array<[number, number]> = shockOn ? [...pts, [hx, hy]] : pts;
  const areaD = all.length > 1
    ? `M${all[0][0]},${gBase} ` + all.map(([x, y]) => `L${x.toFixed(2)},${y.toFixed(2)}`).join(' ') + ` L${all[all.length - 1][0].toFixed(2)},${gBase} Z`
    : '';

  // 穿透天花板：线段与 y=CEIL 的交点
  const crossX = nx + ((ny - gCeil) / (ny - gShockTop)) * (gX1 - nx);
  const pierced = shockOn && hy <= gCeil + 0.5 && rescaleP < 0.02;
  // 穿透帧（求一次）：shockT 使 hy 过 CEIL 的帧
  let PIERCE = SHOCK1;
  for (let f = SHOCK0; f <= SHOCK1; f += 0.25) {
    if (mix(ny, gShockTop, ramp(f, SHOCK0, SHOCK1 - SHOCK0, easeShock)) <= gCeil) { PIERCE = f; break; }
  }
  const sinceP = frame - PIERCE;
  const crack = sinceP >= 0 ? ramp(frame, PIERCE, 8, EASE.snappy) * (1 - ramp(frame, BEAT, 14, EASE.smooth)) : 0;

  // 图表震：阻尼正弦，穿透帧起 12f
  const kick = sinceP >= 0 && sinceP < 14 ? 10 * Math.exp(-sinceP / 3.4) * Math.sin(sinceP * 1.8) : 0;
  // KPI 被撞：冲到顶（SHOCK1）时向上一颤
  const sinceTop = frame - (SHOCK1 - 2);
  const kpiKick = sinceTop >= 0 && sinceTop < 16 ? -14 * Math.exp(-sinceTop / 3.8) * Math.cos(sinceTop * 1.5) : 0;

  const warn = ramp(frame, WARN, 10, EASE.out) * (1 - ramp(frame, BEAT, 12, EASE.out));
  const hang = shockOn ? ramp(frame, SHOCK1 - 4, 8, EASE.out) * (1 - ramp(frame, BEAT, 14, EASE.out)) : 0;
  const shockW = mix(12, 7, ramp(frame, BEAT, 16, EASE.out));

  const markS = ramp(frame, MARK, 12, EASE.overshoot);
  const ripple = ramp(frame, MARK + 2, 20, EASE.out);
  const valS = ramp(frame, MARK + 4, 14, EASE.overshoot);
  const totalP = ramp(frame, MARK + 2, 20, EASE.snappy);

  const rule = (d: number) => ramp(frame, d, 20, EASE.snappy);
  const cam = mix(1, 1.018, ramp(frame, 0, AXIS_RESCALE_SHOCK_V2_DURATION, EASE.smooth));

  const OLD = ['25k', '50k', '75k', '100k'];
  const NEW = ['100k', '200k', '300k', '400k'];

  // 碎屑（两片规线残段从穿透点弹飞）；竖屏画布窄，飞行距离按 0.58 倍收窄免得直接飞出画面
  const shard = (k: number) => {
    if (sinceP < 0 || sinceP > 32) return null;
    const t = sinceP / 32;
    const dir = k % 2 === 0 ? -1 : 1;
    const sp = [1, 0.75, 0.55][k];
    const x = crossX + dir * ((vertical ? 14 : 18) + (vertical ? 110 : 190) * sp * EASE.out(t));
    const y = gCeil - ((vertical ? 110 : 170) - k * (vertical ? 26 : 40)) * EASE.out(t) + (vertical ? 200 : 300) * t * t;
    const w = [vertical ? 28 : 40, vertical ? 20 : 30, vertical ? 12 : 18][k];
    return (
      <rect key={k} x={x - w / 2} y={y - 2} width={w} height={4} fill={ACC} opacity={1 - EASE.exit(t)}
        transform={`rotate(${dir * (240 - k * 50) * t} ${x} ${y})`} />
    );
  };

  // 画面本体：推镜 / 排版 / 图表都在这一层。竖屏时外面再包一层设计画布（vWrap）做整体换算，
  // 横屏时不包这层、也不加任何样式，DOM 与数值与改动前完全一致。
  const artwork = (
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${cam})`, transformOrigin: '60% 45%' }}>
        {/* 标题行 */}
        <div style={{ position: 'absolute', left: gM, top: vertical ? 196 : 92, display: 'flex', alignItems: 'center', gap: vertical ? 10 : 12, ...type(vertical ? 24 : 32, 650, { caps: true }), color: L.ink2, opacity: ramp(frame, 0, 12, EASE.out) }}>
          <ShotcraftMark size={vertical ? 30 : 38} tone="light" style={{ marginTop: -2 }} />
          <span style={{ fontFamily: BRAND.font, fontWeight: 700, textTransform: 'none', letterSpacing: '0.03em', color: INK }}>{BRAND.name}</span>
          <span><span style={{ color: L.ink3 }}>·</span> Renders <span style={{ color: L.ink3 }}>· FY2026</span></span>
        </div>
        {/* 竖屏：主标题换行宽度锁在 936（1080 - 左右 96），长文案也只在安全区内折行 */}
        <div style={{ position: 'absolute', left: gM - 6, top: vertical ? 240 : 140, width: vertical ? 936 : undefined, ...type(vertical ? 76 : 124, 850), color: INK }}>
          {/* 竖屏给容器开了折行（默认文案 653 < 936 仍是一行，画面不变）；横屏保持原来的单行 whiteSpace: pre */}
          <TextReveal text={userMetric || "Monthly renders"} by="word" variant="rise" start={2} each={18} gap={5} style={vertical ? { whiteSpace: 'normal' } : undefined} />
        </div>

        {/* 右上 KPI：爆表段会冲进这里；竖屏改为标题下方右对齐一整行，等高叠放，仍由爆表线扎进去 */}
        <div style={{ position: 'absolute', right: vertical ? 48 : 1920 - 1824, top: vertical ? 356 : 92, textAlign: 'right', opacity: ramp(frame, 6, 14, EASE.out) }}>
          <div style={{ ...type(vertical ? 24 : 32, 650, { caps: true }), color: totalP > 0.5 ? ACC : L.ink2 }}>FY total</div>
        </div>
        <div style={{
          position: 'absolute', right: vertical ? 48 : 1920 - 1824, top: vertical ? 400 : 140, ...type(vertical ? 76 : 124, 850), textAlign: 'right',
          color: totalP > 0.5 ? ACC : INK, transform: `translateY(${kpiKick.toFixed(2)}px)`, opacity: ramp(frame, 8, 14, EASE.out),
        }}>
          {Math.round(mix(493, 833, totalP))}k
        </div>

        {/* 图表组（震动只作用在这里） */}
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${kick.toFixed(2)}px)` }}>
          {/* 刻度 */}
          <div style={{ position: 'absolute', left: gM, top: gBase - (vertical ? 36 : 48), width: vertical ? 150 : 200, ...type(vertical ? 24 : 32, 500), color: L.ink2, opacity: rule(4) }}>0</div>
          {OLD.map((v, i) => {
            const sw = ramp(frame, BEAT + (3 - i) * 2, 12, EASE.snappy);
            const top = i === 3;
            return (
              <div key={i} style={{ position: 'absolute', left: gM, top: tickY(i) - (vertical ? 36 : 48), width: vertical ? 150 : 200, height: vertical ? 30 : 40, opacity: rule(4 + i * 2) }}>
                <div style={{
                  position: 'absolute', inset: 0, ...type(vertical ? 24 : 32, top ? mix(500, 750, warn) : 500),
                  color: top && warn > 0.02 ? ACC : L.ink2, opacity: 1 - sw, transform: `translateY(${(sw * 46).toFixed(2)}px)`,
                  filter: sw > 0.02 && sw < 0.98 ? `blur(${(Math.sin(Math.PI * sw) * 3).toFixed(2)}px)` : undefined,
                }}>{v}</div>
                <div style={{
                  position: 'absolute', inset: 0, ...type(vertical ? 24 : 32, 500), color: L.ink2,
                  opacity: sw, transform: `translateY(${((sw - 1) * 46).toFixed(2)}px)`,
                  filter: sw > 0.02 && sw < 0.98 ? `blur(${(Math.sin(Math.PI * sw) * 3).toFixed(2)}px)` : undefined,
                }}>{NEW[i]}</div>
              </div>
            );
          })}

          {/* 月份 */}
          {MONTHS.map((m, i) => (
            <div key={m} style={{
              position: 'absolute', left: xOfV(i) - (vertical ? 32 : 50), top: gBase + (vertical ? 16 : 22), width: vertical ? 64 : 100, textAlign: 'center',
              ...type(vertical ? 24 : 32, i === N - 1 && shockOn ? 750 : 500), color: i === N - 1 && shockOn ? ACC : L.ink2,
              opacity: ramp(frame, 6 + i, 12, EASE.out),
            }}>{m}</div>
          ))}

          <svg width={vertical ? 1080 : 1920} height={vertical ? 1920 : 1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <defs>
              <pattern id="arsHatch" width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1={0} y1={0} x2={0} y2={12} stroke={INK} strokeOpacity={0.16} strokeWidth={2} />
              </pattern>
              <filter id="arsGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="10" />
              </filter>
            </defs>

            {/* 网格：基础 3 根 + 重标加密 4 根 */}
            {[0, 1, 2].map((i) => (
              <line key={`g${i}`} x1={gM} x2={mix(gM, gGridR, rule(2 + i * 2))} y1={tickY(i)} y2={tickY(i)} stroke={INK} strokeOpacity={0.14} strokeWidth={1.5} />
            ))}
            {[0, 1, 2, 3].map((k) => {
              const d = ramp(frame, BEAT + 1 + k * 2, 12, EASE.snappy);
              const y = gBase - ((2 * k + 1) / 8) * gPH;
              return d > 0 ? <line key={`d${k}`} x1={gM} x2={mix(gM, gGridR, d)} y1={y} y2={y} stroke={INK} strokeOpacity={0.08} strokeWidth={1.5} strokeDasharray="2 8" /> : null;
            })}

            {/* 面积：45° 排线 */}
            {areaD && <path d={areaD} fill="url(#arsHatch)" />}

            {/* 基线 */}
            <line x1={gM} x2={mix(gM, gGridR, rule(0))} y1={gBase} y2={gBase} stroke={INK} strokeWidth={3} />

            {/* 天花板规线：预警转赤陶，被穿透处裂开 */}
            {(() => {
              const c = warn > 0.02 ? ACC : INK;
              const xr = mix(gM, gGridR, rule(2));
              const gap = 26 * crack;
              const op = 0.85 + 0.15 * warn;
              if (crack <= 0.001) return <line x1={gM} x2={xr} y1={gCeil} y2={gCeil} stroke={c} strokeOpacity={op} strokeWidth={3} />;
              return (
                <>
                  <line x1={gM} x2={crossX - gap} y1={gCeil} y2={gCeil} stroke={c} strokeOpacity={op} strokeWidth={3} />
                  <line x1={crossX + gap} x2={xr} y1={gCeil} y2={gCeil} stroke={c} strokeOpacity={op} strokeWidth={3} />
                </>
              );
            })()}
            {shard(0)}
            {shard(1)}
            {shard(2)}

            {/* 历史折线 */}
            {lineD && <path d={lineD} fill="none" stroke={INK} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />}
            {/* 历史段数据点 */}
            {pts.map(([x, y], i) => (i < pts.length - (drawT < N - 2 ? 1 : 0) ? <circle key={i} cx={x} cy={y} r={6} fill={L.bg[0]} stroke={INK} strokeWidth={3.5} /> : null))}
            {/* 写入笔尖 */}
            {frame >= DRAW0 && frame < DRAW1 + 1 && pts.length > 0 && (
              <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={9} fill={INK} />
            )}
            {/* 预警脉冲：Nov 点 */}
            {frame >= WARN && frame < SHOCK0 + 6 && (() => {
              const t = ramp(frame, WARN, 16, EASE.out);
              return <circle cx={nx} cy={ny} r={mix(10, 46, t)} fill="none" stroke={ACC} strokeWidth={3} opacity={0.7 * (1 - t)} />;
            })()}

            {/* 爆表段 */}
            {shockOn && (
              <>
                {hang > 0.01 && <line x1={nx} y1={ny} x2={hx} y2={hy} stroke={ACC} strokeWidth={shockW + 16} strokeLinecap="round" opacity={0.35 * hang} filter="url(#arsGlow)" />}
                <line x1={nx} y1={ny} x2={hx} y2={hy} stroke={ACC} strokeWidth={shockW} strokeLinecap="round" />
                {markS <= 0 && <circle cx={hx} cy={hy} r={12} fill={L.bg[0]} stroke={ACC} strokeWidth={5} />}
              </>
            )}
            {pierced && sinceP < 10 && (
              <circle cx={crossX} cy={gCeil} r={mix(8, 70, ramp(frame, PIERCE, 10, EASE.out))} fill="none" stroke={ACC} strokeWidth={2.5}
                opacity={0.8 * (1 - ramp(frame, PIERCE, 10, EASE.out))} />
            )}

            {/* 端点标记 */}
            {markS > 0 && (
              <>
                {ripple < 1 && <circle cx={hx} cy={hy} r={mix(16, 64, ripple)} fill="none" stroke={ACC} strokeWidth={3} opacity={0.6 * (1 - ripple)} />}
                <circle cx={hx} cy={hy} r={15 * markS} fill={ACC} stroke={L.bg[0]} strokeWidth={5 * markS} />
              </>
            )}
          </svg>

          {/* 真值标签（竖屏缩到 260×112、字号 60/24，整块仍贴在端点左侧不越右边界） */}
          {valS > 0 && (
            <div style={{
              position: 'absolute', left: hx - (vertical ? 30 : 40) - (vertical ? 260 : 330), top: hy - (vertical ? 56 : 70),
              width: vertical ? 260 : 330, height: vertical ? 112 : 140,
              transform: `scale(${valS.toFixed(4)})`, transformOrigin: '100% 50%', opacity: Math.min(1, valS * 1.6),
            }}>
              <div style={{
                position: 'absolute', inset: 0, background: ACC, borderRadius: 6, color: L.onAccent,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: vertical ? 24 : 30,
                boxShadow: `0 18px 40px -12px ${alpha(L.shadow, 0.45)}`,
              }}>
                <div style={{ ...type(vertical ? 60 : 76, 850) }}>{userValue || '340k'}</div>
                <div style={{ ...type(vertical ? 24 : 32, 600), opacity: 0.9 * ramp(frame, MARK + 10, 10, EASE.out), marginTop: 4 }}>
                  {userLabel || '▲ 372% vs Nov'}
                </div>
              </div>
              <div style={{
                position: 'absolute', right: -10, top: vertical ? 46 : 60,
                width: vertical ? 16 : 20, height: vertical ? 16 : 20,
                background: ACC, transform: 'rotate(45deg)',
              }} />
            </div>
          )}
        </div>
      </div>
  );

  return (
    <AbsoluteFill style={{ background: L.bg[1], overflow: 'hidden' }}>
      <Stage look={L} keyLight={{ x: 0.3, y: 0.0 }} fill={{ x: 0.95, y: 0.95 }} />
      {vertical ? <div style={vWrap}>{artwork}</div> : artwork}
    </AbsoluteFill>
  );
};
