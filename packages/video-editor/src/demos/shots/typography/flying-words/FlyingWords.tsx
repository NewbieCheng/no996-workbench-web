// @ts-nocheck
// flying-words — 词语纵深隧道：关键词在远处纵深生成，沿 z 轴向相机飞来擦身而过，透明度按
// [0,1,0.5,0.2,0] 生命周期曲线变化；相机不动、元素动，spawn 完全确定性、跑满 2 整圈首尾无缝。
//
// 第二轮重设计（深蓝夜 · 光速隧道 + 前景字标）：
// - look = midnight（深蓝黑 · 电光蓝）。按 1920×1080 原生作画（不再 480×270 放大），透视手算
//   s = P/(P−z)（P=4400，z −7000→+3200，与 CSS perspective 逐点等价），所以每个元素都能按屏幕速度做效果。
// - 三层纵深：① 隧道壁——10 道扁椭圆发丝环同速朝镜头推进（隧道的"结构"，近处变粗变淡出画）；
//   ② 光速流线——56 粒尘埃画成沿径向拉长的线段（长度 = 本帧屏幕位移，越近越长），速度感的主力；
//   ③ 22 个产品能力关键词：黄金角铺位、远小近大、远端大气雾失焦、近端按速度沿运动方向拖出 6 层渐虚残影
//   （text-shadow 方向拖尾，比全屏 SVG 滤镜便宜得多）+ 冲到眼前时失焦。
// - 字的层次：冷白三阶 sans 700 为主，6 个关键词用衬线斜体，4 个强调词电光蓝带泛光（光只给强调词）。
// - 隧道尽头：中心电光蓝光晕按 2 次/片呼吸（与 CYCLES 对齐），整条隧道以 sin(2πt) 极缓滚转 ±2.5°，
//   画面无一刻静止但不晃（滚转是周期的，首尾一致）。
// - 前景：中段生命曲线压到 0.5 就是为前景让位——demo 在正中压一组静态字标（mono 眉题 + 112px 标题 +
//   一层径向暗幕；飞进字标椭圆区的词压到 20%），证明隧道作背景层不打架；字标静止 = 循环无缝。
// - 品牌：眉题 = 镜刻标志 + video-shotcraft 小字，标题 = 品牌短句；词表混入 video-shotcraft 的能力词。
//
// 竖屏重排（reflow，1080×1920）：隧道中心从画布正中挪到安全区（上 180 / 下 320）中心 890px；
//   词流的铺位由「横铺」改「纵铺」——原 (x, y·0.6) 换成 (y·0.62, x)，横轴只剩 ±368（1080 宽里不再被裁），
//   纵轴沿用 ±990 走 1920 的长轴；前景字标 112 → 68px、左右各留 72px、整块跟隧道中心一起上移。
//   时间轴 / 生命周期曲线 / 词表 / 配色槽位全同，只有布局数值分叉；横屏 vertical=false 全部回原字面量。
//
// 时间轴：t = frame / DURATION（末帧的下一帧 = 第 0 帧，真正无缝 loop）；CYCLES = 2 整圈。
//   每个元素 u = (t·CYCLES + 相位) mod 1：0 远处生成 → 0.25 亮到满 → 0.6 压到半透 → 1 擦身出画。
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { FONT } from '../../_fixtures/Polish';
import { LOOKS, SERIF, Stage, alpha, useLook} from '../../_fixtures/Look';
import { BRAND, PITCH, ShotcraftMark } from '../../_fixtures/Brand';

export const FLYING_WORDS_DURATION = 180; // 6000ms @30fps

const CYCLES = 2; // 整数圈 → 首尾一致

// 关键词表：换成项目自己的关键词即可，词数/字长接近就不影响节奏（这里是 video-shotcraft 的能力词）
const WORDS = ['Timeline', 'Keyframes', 'Easing', 'Camera', 'Depth', 'Parallax', 'Motion blur', 'Springs',
  'Layers', 'Shot cards', 'Typography', 'Lighting', 'Grain', 'Remotion', 'Beat grid', 'Stagger',
  'Transitions', 'Color', 'Workbench', 'Audio sync', 'Storyboard', 'Orbit'];
const N = WORDS.length;
const ACCENT = new Set([3, 7, 12, 19]); // Camera / Springs / Grain / Audio sync
const SERIF_IDX = new Set([1, 5, 10, 14, 17, 21]);
const INKS = ['#f2f5ff', '#c3cbe2', '#8a95b5'];

const P = 4400; // 透视距离
const Z0 = -7000;
const Z1 = 3200;
const CX = 960;
const CY = 540;

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const ITEMS = WORDS.map((w, i) => {
  // 黄金角铺开 + 半径避开正中（近处不堆成一团）
  const a = i * 2.39996 + rand(i * 7 + 1) * 0.8;
  const r = 330 + rand(i * 13 + 2) * 660;
  const accent = ACCENT.has(i);
  return {
    text: w, accent, serif: SERIF_IDX.has(i),
    size: 64 + rand(i + 3) * 56,
    color: accent ? '#86a8ff' : INKS[Math.floor(rand(i + 5) * 3)],
    x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6, rz: (rand(i + 21) - 0.5) * 12, ph: i / N,
  };
});

const DUST = Array.from({ length: 56 }, (_, i) => {
  const a = i * 2.39996 + rand(i * 5 + 77) * 1.2;
  const r = 180 + rand(i * 3 + 91) * 1500;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.62, ph: rand(i * 9 + 13), w: 1 + rand(i + 50) * 1.6 };
});

const RINGS = Array.from({ length: 10 }, (_, k) => ({ ph: k / 10 }));

// 生命周期透明曲线 [0,1,0.5,0.2,0] @ [0,0.25,0.6,0.85,1]，分段线性
const OP = [0, 1, 0.5, 0.2, 0];
const OT = [0, 0.25, 0.6, 0.85, 1];
const curve = (u: number) => {
  for (let k = 0; k < 4; k++) {
    if (u <= OT[k + 1]) return OP[k] + ((OP[k + 1] - OP[k]) * (u - OT[k])) / (OT[k + 1] - OT[k]);
  }
  return 0;
};

// z 线性推进；drift = 0.5 + u·1.35（远处收拢、越近越向外散开）；roll = 整条隧道的滚转角
// centerX / centerY 默认 = 横屏画布中心 CX / CY，逐点与改前一致；竖屏由调用处传入重排后的中心。
const project = (x: number, y: number, u: number, roll: number, drift = true, centerX = CX, centerY = CY) => {
  const z = Z0 + (Z1 - Z0) * u;
  const d = drift ? 0.5 + u * 1.35 : 1;
  const s = P / (P - z);
  const c = Math.cos(roll), sn = Math.sin(roll);
  const rx = x * c - y * sn, ry = x * sn + y * c;
  return { sx: centerX + rx * d * s, sy: centerY + ry * d * s, s };
};

export const FlyingWords: React.FC = () => {
  const L = useLook('midnight');
  const frame = useCurrentFrame();
  const title = useShotProp('title', PITCH.en.motto);
  // 竖屏重排（9:16 reflow）：外层容器在竖屏渲染时把 width/height 设成真实画布 1080×1920；
  // 横屏（1920×1080）下 vertical = false，下面每个 vertical ? A : B 的 B 都是原字面量，
  // 隧道中心 / 铺位 / 字号 / 留边全部回改前的数字，默认帧逐像素不变。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // 隧道中心：横屏 = 画布正中 (960, 540)；竖屏 = 安全区（上 180 / 下 320）中心，即 1080×1920 下的 (540, 890)
  const cx = vertical ? width / 2 : CX;
  const cy = vertical ? 180 + Math.max(0, height - 180 - 320) / 2 : CY;
  // 铺位：横屏原样 (x, y)；竖屏把横铺转成纵铺 (y·0.62, x)——横轴从 ±990 收到 ±368（1080 宽内不被裁），
  // 纵轴接原 x 的 ±990，顺着 1920 的长轴上下飞。时间轴与相位不动，只是落点换了轴。
  const flowX = vertical ? 0.62 : 1;
  const place = (x: number, y: number): [number, number] => (vertical ? [y * flowX, x] : [x, y]);
  // 隧道壁椭圆的纵横比：横屏 0.6（原值）；竖屏拉成近似正圆，贴合 9:16 的洞口
  const ringAspect = vertical ? 1.02 : 0.6;
  // 前景字标按短边缩到 0.6 倍（112 → 68），字标区收窄到 1080 − 144，整块上移到安全区中心
  const titleSize = vertical ? 68 : 112;
  const eyebrowSize = vertical ? 21 : 30;
  const markSize = vertical ? 28 : 42;
  const lockupDy = vertical ? cy - height / 2 : 0;
  // 关键词字号：竖屏按短边收到 0.66 倍（64–120 → 42–79），飞到眼前时不再占满 1080 宽
  const wordScale = vertical ? 0.66 : 1;
  // 光晕 / 暗幕跟着中心走：横屏保持原尺寸（1040×720 / 1520×520），竖屏收成竖长的一块压在字标后
  const poolW = vertical ? 820 : 1040;
  const poolH = vertical ? 860 : 720;
  const scrimW = vertical ? 1040 : 1520;
  const scrimH = vertical ? 460 : 520;
  // 字标暗幕遮挡椭圆（词飞进字标区压到 20%）：横屏沿用 (760, 190)，竖屏按收窄后的字标区算
  const occlX = vertical ? 440 : 760;
  const occlY = vertical ? 140 : 190;
  const stageW = vertical ? width : 1920;
  const stageH = vertical ? height : 1080;
  const t = frame / FLYING_WORDS_DURATION;
  const roll = (2.5 * Math.PI / 180) * Math.sin(t * Math.PI * 2);
  const du = CYCLES / FLYING_WORDS_DURATION; // 每帧 u 的增量
  const glowB = 0.82 + 0.14 * Math.sin(t * Math.PI * 4);

  return (
    <AbsoluteFill>
      <Stage look={L} keyLight={{ x: 0.5, y: 0.5 }} fill={null} intensity={0.5} vignette={0.7} grain={0.08}>
        {/* 隧道尽头光晕：呼吸 2 次/片，与 CYCLES 对齐 */}
        <div style={{
          position: 'absolute', left: cx - poolW / 2, top: cy - poolH / 2, width: poolW, height: poolH, borderRadius: '50%', opacity: glowB,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(L.light, 0.42)} 0%, ${alpha(L.light, 0.12)} 38%, ${alpha(L.light, 0)} 70%)`,
        }} />
      </Stage>

      {/* ① 隧道壁 + ② 光速流线（一张 SVG） */}
      <svg width={stageW} height={stageH} style={{ position: 'absolute', inset: 0 }}>
        {RINGS.map((rg, k) => {
          const u = (t * CYCLES + rg.ph) % 1;
          const p = project(0, 0, u, roll, false, cx, cy);
          const rx = 1150 * p.s;
          const op = Math.min(1, u / 0.3) * (1 - Math.min(1, Math.max(0, (u - 0.55) / 0.3)));
          if (op <= 0.01) return null;
          return (
            <ellipse key={`r${k}`} cx={cx} cy={cy} rx={rx} ry={rx * ringAspect} fill="none"
              stroke={L.accent} strokeOpacity={op * 0.16} strokeWidth={1 + p.s * 0.8}
              transform={`rotate(${(roll * 180) / Math.PI} ${cx} ${cy})`} />
          );
        })}
        {DUST.map((d, i) => {
          const u = (t * CYCLES + d.ph) % 1;
          const u0 = Math.max(0, u - du * 2.6);
          const [dx, dy] = place(d.x, d.y);
          const a = project(dx, dy, u0, roll, true, cx, cy);
          const b = project(dx, dy, u, roll, true, cx, cy);
          const op = curve(u) * 0.75;
          if (op <= 0.01) return null;
          return (
            <line key={`d${i}`} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#cfdcff" strokeOpacity={op}
              strokeWidth={d.w * Math.min(2.4, b.s)} strokeLinecap="round" />
          );
        })}
      </svg>

      {/* ③ 关键词：远端雾、中段清晰、近端方向拖尾 + 失焦 */}
      {ITEMS.map((it, i) => {
        const u = (t * CYCLES + it.ph) % 1;
        const [ix, iy] = place(it.x, it.y);
        const p = project(ix, iy, u, roll, true, cx, cy);
        const q = project(ix, iy, Math.max(0, u - du), roll, true, cx, cy);
        const vx = p.sx - q.sx, vy = p.sy - q.sy; // 屏幕速度 px/帧
        // 前景字标区（椭圆）里的词压到 20%：像被暗幕遮住，不和标题打架
        const k = ((p.sx - cx) / occlX) ** 2 + ((p.sy - cy) / occlY) ** 2;
        const occl = k < 1 ? 0.2 + 0.8 * k * k : 1;
        const op = curve(u) * occl;
        if (op <= 0.005) return null;
        const fog = u < 0.22 ? (1 - u / 0.22) * 2.2 : 0;
        const near = u > 0.86 ? (u - 0.86) * 60 : 0;
        const blur = fog + near;
        const sp = Math.hypot(vx, vy);
        const trail = sp > 6
          ? [1, 2, 3, 4, 5, 6].map((j) => {
            const k = (j / 6) * 0.9 / p.s;
            return `${(-vx * k).toFixed(1)}px ${(-vy * k).toFixed(1)}px ${(j * 0.8).toFixed(1)}px ${alpha(it.color, 0.2 - j * 0.026)}`;
          }).join(', ')
          : '';
        const glowS = it.accent ? `0 0 18px ${alpha(L.accent, 0.55)}, 0 0 48px ${alpha(L.accent, 0.3)}` : '';
        return (
          <div key={i} style={{
            position: 'absolute', left: p.sx, top: p.sy, whiteSpace: 'nowrap', lineHeight: 1,
            transform: `translate(-50%,-50%) scale(${p.s.toFixed(4)}) rotate(${it.rz + (roll * 180) / Math.PI}deg)`,
            fontFamily: it.serif ? SERIF : FONT.sans, fontStyle: it.serif ? 'italic' : undefined,
            fontWeight: it.serif ? 500 : 700, fontSize: it.size * wordScale, letterSpacing: it.serif ? '-0.01em' : '-0.03em',
            color: it.color, opacity: op,
            textShadow: [glowS, trail].filter(Boolean).join(', ') || undefined,
            filter: blur > 0.05 ? `blur(${(blur / Math.max(0.6, p.s)).toFixed(2)}px)` : undefined,
          }}>
            {it.text}
          </div>
        );
      })}

      {/* 前景字标：静态（循环无缝），一层极淡径向暗幕把它和隧道分开 */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: cx - scrimW / 2, top: cy - scrimH / 2, width: scrimW, height: scrimH, borderRadius: '50%',
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha('#04060d', 0.7)} 0%, ${alpha('#04060d', 0.38)} 45%, ${alpha('#04060d', 0)} 72%)`,
        }} />
        <div style={{
          position: 'relative', textAlign: 'center',
          // 竖屏：整块字标从画布正中上移到安全区中心（1080×1920 下是 890px，上移 70px）；横屏不位移
          transform: vertical ? `translateY(${lockupDy}px)` : undefined,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: vertical ? 12 : 18,
            fontFamily: FONT.mono, fontSize: eyebrowSize, letterSpacing: '0.3em', color: L.accent,
            marginBottom: vertical ? 22 : 30,
          }}>
            <ShotcraftMark size={markSize} tone="dark" />
            <span>{BRAND.name}</span>
          </div>
          <div style={{
            fontFamily: FONT.sans, fontSize: titleSize, fontWeight: 700, letterSpacing: '-0.045em',
            lineHeight: vertical ? 1.16 : 1, color: L.ink,
            // 竖屏长标题按 1080 的短边折行并做平衡分行；横屏不参与（默认不折行，加 text-wrap 也可能改断行）
            textWrap: vertical ? 'balance' : undefined,
            textShadow: `0 4px 40px ${alpha('#000', 0.6)}`,
            // 竖屏左右各留 72px（可用宽 1080 − 144），横屏仍贴原样、不加内边距
            padding: vertical ? '0 72px' : undefined,
          }}>
            {title}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
