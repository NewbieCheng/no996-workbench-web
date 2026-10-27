// @ts-nocheck
// 拉远孤立收束（pull-back-isolation）——pull-back shot。
// 相机容器 scale 2.2→0.62（0–110f，Easing.out(cubic)）：开场怼在主卡
// "99.9%" 特写上，缓缓后拉露出周围 8 张兄弟卡。帧 30 起兄弟卡按离主卡
// 距离由近到远错峰熄灭（每 8f 一张，opacity→0 + brightness 压暗）；
// 背景 60–110f 从亮场沉入带色相的深场 #111216；主卡白光晕 60–100f 淡入。
// 帧 110–150 完全静止：暗场中央孤悬一张发光小卡——全片只为这一个数字。
//
// 改版要点：主卡从"白罩压在占位卡上"改为出版级指标卡（标签 + 大数字 +
// 90 天可用率条带 + 页脚）；相机按 2.2 倍布局（CSS zoom）再缩小，开场特写
// 文字锐利（审美准则 Q2）；兄弟卡熄灭时轻微下沉（scale 0.97）+ 失焦，而非原地变灰；
// 背景由柔光亮底交叉沉入深场，光晕带冷色相，卡面受光上沿随暗场浮现。
import React from 'react';
import { useCurrentFrame, interpolate, Easing, AbsoluteFill } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { Card, G } from '../../_fixtures/Fixtures';
import { Backdrop, EASE, FONT, Grain, mix, softShadow } from '../../_fixtures/Polish';
import { usePalette, rgbOf } from '../../_fixtures/Look';

export const PULL_BACK_ISOLATION_DURATION = 150; // 110f 后拉 + 40f 孤悬静止

/**
 * usePalette 的默认值 = 本镜头原本的四个主色（未传配色键时默认画面零变化）。
 * 本镜头几乎没有彩色，只有两处冷色光：落定后主卡外圈的冷白光晕（宽晕层 #96a2f0）
 * 与暗场舞台的钴蓝余光（Backdrop accent #5b63d3）。前者是画面里最显眼的强调光 → primary，
 * 后者是环境次光 → secondary；ink = 主卡标签与 128px 大数字的 G.ink1 #17181c；
 * bg = 满版舞台底 G.dark #111216。
 */
const PALETTE_FALLBACK = { bg: '#111216', primary: '#96a2f0', secondary: '#5b63d3', ink: '#17181c' };

// 8 张兄弟卡：相对主卡中心 (960,540) 的偏移 + 尺寸 + seed
const SIBS = [
  { dx: -620, dy: -330, w: 360, h: 240, seed: 3 },
  { dx: 10, dy: -390, w: 420, h: 220, seed: 4 },
  { dx: 620, dy: -320, w: 380, h: 260, seed: 5 },
  { dx: -680, dy: 20, w: 340, h: 230, seed: 6 },
  { dx: 700, dy: 40, w: 360, h: 250, seed: 7 },
  { dx: -600, dy: 360, w: 400, h: 240, seed: 8 },
  { dx: 40, dy: 400, w: 440, h: 220, seed: 9 },
  { dx: 640, dy: 350, w: 370, h: 250, seed: 10 },
].map((s) => ({ ...s, dist: Math.hypot(s.dx, s.dy) }));

// 按离主卡距离排名 → 错峰熄灭顺序（近的先灭）
const RANKED = SIBS.map((s, i) => i).sort((a, b) => SIBS[a].dist - SIBS[b].dist);
const FADE_START = RANKED.reduce<number[]>((acc, idx, rank) => {
  acc[idx] = 30 + rank * 8;
  return acc;
}, []);
const FADE_DUR = 16;

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

// 相机布局倍率 = 起始特写倍率：按 2.2 倍栅格化，之后只做缩小
const Z = 2.2;

// 90 天渲染成功率条带：确定性，大部分全绿、2 天降级（让 99.9% 可信）
const DAYS = Array.from({ length: 45 }, (_, i) => (i === 17 ? 1 : i === 33 ? 2 : 0));

const HeroCard: React.FC<{ rim: number }> = ({ rim }) => {
  // 配色槽位（usePalette）：主卡标签与 128px 大数字走主文字色 PAL.ink
  const PAL = usePalette(PALETTE_FALLBACK);
  // 可编辑文案：卡片标签与大数字
  const label = useShotProp('label', 'Render success');
  const value = useShotProp('value', '99.9');

  return (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: 18,
      background: 'linear-gradient(180deg, #ffffff 0%, #fbfbfa 100%)',
      border: '1px solid rgba(20,22,28,0.08)',
      boxSizing: 'border-box',
      padding: '30px 34px 26px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT.sans,
      overflow: 'hidden',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,${0.9 + rim * 0.1})`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 9, height: 9, borderRadius: 5, background: '#2fa36b', boxShadow: '0 0 0 4px rgba(47,163,107,0.14)' }} />
      <div style={{ fontSize: 17, fontWeight: 600, color: PAL.ink, letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 550, color: G.ink2, padding: '3px 9px', borderRadius: 7, background: G.fill, boxShadow: `inset 0 0 0 1px ${G.hairline}` }}>
        90 days
      </div>
    </div>
    <div
      style={{
        marginTop: 18,
        fontSize: 128,
        fontWeight: 700,
        lineHeight: 0.96,
        letterSpacing: '-0.045em',
        color: PAL.ink,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}<span style={{ fontSize: '0.56em', fontWeight: 600, color: G.ink2, marginLeft: '0.04em' }}>%</span>
    </div>
    <div style={{ marginTop: 'auto', display: 'flex', gap: 3, height: 30, alignItems: 'stretch' }}>
      {DAYS.map((d, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            borderRadius: 2,
            background: d === 0 ? 'rgba(47,163,107,0.78)' : d === 1 ? '#e2a23b' : 'rgba(47,163,107,0.4)',
          }}
        />
      ))}
    </div>
    <div style={{ marginTop: 10, display: 'flex', fontSize: 13, color: G.ink3, fontVariantNumeric: 'tabular-nums' }}>
      <span>90 days ago</span>
      <span style={{ marginLeft: 'auto' }}>Today</span>
    </div>
  </div>
  );
};

export const PullBackIsolation: React.FC = () => {
  // 配色槽位（usePalette）：舞台深场底色 PAL.bg + 深场余光强调色 PAL.primary
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();

  // 相机后拉：2.2（怼脸特写）→ 0.62（大远景孤悬）
  const scale = interpolate(frame, [0, 110], [2.2, 0.62], {
    easing: Easing.out(Easing.cubic),
    ...clamp,
  });

  // 背景沉入黑暗（60–110f）：亮柔光底 → 带色相深场，交叉淡化
  const bgT = interpolate(frame, [60, 110], [0, 1], { easing: Easing.inOut(Easing.quad), ...clamp });

  // 主卡光晕淡入（60–100f）
  const glow = interpolate(frame, [60, 100], [0, 1], { easing: Easing.inOut(Easing.quad), ...clamp });

  return (
    <AbsoluteFill style={{ background: PAL.bg, overflow: 'hidden' }}>
      {/* 亮场：开场 0–60f 的柔光浅底。默认原样走 Backdrop 自带渐变（材质不动）；
          用户改底色时整段换成 PAL.bg 纯色，否则这块不透明亮底会把舞台底完全盖住、改色看不到效果。 */}
      <Backdrop
        tone="light"
        light={{ x: 0.5, y: 0.3 }}
        grain={0}
        style={PAL.isCustom ? { background: PAL.bg } : undefined}
      />
      <AbsoluteFill style={{ opacity: bgT }}>
        {/* 深场：本镜头落定后的舞台底。默认走 Backdrop 自带的暗场三段渐变（与原字符串逐字符一致 → 默认零变化）；
            用户改底色时退回纯色 PAL.bg。环境余光色相跟次强调 PAL.secondary 走。 */}
        <Backdrop
          tone="dark"
          light={{ x: 0.5, y: 0.5 }}
          accent={PAL.secondary}
          grain={0}
          vignette={0.6}
          style={{
            background: PAL.isCustom ? PAL.bg : 'linear-gradient(180deg, #13151b 0%, #0c0d11 55%, #08090c 100%)',
          }}
        />
      </AbsoluteFill>

      {/* 相机容器：按 Z 倍布局，再以主卡中心（画面中心）为原点 scale(scale/Z) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920 * Z,
          height: 1080 * Z,
          transformOrigin: `${960 * Z}px ${540 * Z}px`,
          transform: `translate(${960 - 960 * Z}px, ${540 - 540 * Z}px) scale(${scale / Z})`,
        }}
      >
        <div style={{ position: 'relative', width: 1920, height: 1080, zoom: Z }}>
          {/* 兄弟卡：由近到远错峰熄灭，熄灭时轻微下沉 */}
          {SIBS.map((s, i) => {
            const t0 = FADE_START[i];
            const k = interpolate(frame, [t0, t0 + FADE_DUR], [0, 1], clamp);
            // 透明度先走（ease-out），压暗后走（k²）：熄灭过程不会在亮底上停成一块灰板
            const op = 1 - EASE.out(k);
            const dk = k * k;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 960 + s.dx - s.w / 2,
                  top: 540 + s.dy - s.h / 2,
                  opacity: op,
                  // 压暗 + 轻微失焦：像沉进暗处
                  filter: k > 0.001 ? `brightness(${mix(1, 0.3, dk).toFixed(3)}) blur(${(k * 5).toFixed(2)}px)` : undefined,
                  transform: `scale(${mix(1, 0.97, k)})`,
                }}
              >
                <Card w={s.w} h={s.h} seed={s.seed} />
              </div>
            );
          })}

          {/* 主卡：520×340 居中；落入暗场后外圈冷白光晕（宽晕层走 PAL.primary，亮芯 #d6deff 属材质分层保持原样） */}
          <div
            style={{
              position: 'absolute',
              left: 960 - 260,
              top: 540 - 170,
              width: 520,
              height: 340,
              borderRadius: 18,
              boxShadow:
                `${softShadow(18, { strength: 1 - glow * 0.6 })}, ` +
                `0 0 70px rgba(214,222,255,${(glow * 0.32).toFixed(3)}), ` +
                `0 0 180px rgba(${rgbOf(PAL.primary)},${(glow * 0.2).toFixed(3)})`,
            }}
          >
            <HeroCard rim={glow} />
          </div>
        </div>
      </div>
      <Grain opacity={mix(0.05, 0.09, bgT)} blend={bgT > 0.5 ? 'soft-light' : 'overlay'} />
    </AbsoluteFill>
  );
};
