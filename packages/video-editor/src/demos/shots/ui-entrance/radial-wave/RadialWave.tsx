// @ts-nocheck
// radial-wave — Grid Radial Wave 点阵涟漪（motion-lab 定稿转原生 Remotion）
// 17×9 圆点阵列，波从中心向外按欧氏距离 stagger 扩散：每点 scale 0→1.5→1 +
// 亮度脉冲，波前过后留下常亮点阵；第二道波反向收拢。offset = k·dist(cell, origin)。
// 设计坐标 480×270（DesignStage 等比放大），参数表数值以此坐标系标定。
import React from 'react';
import { useVideoConfig } from '../../../runtime/index.ts';
import { DesignStage, E, seg, useT } from '../../_fixtures/Motion';
import { usePalette } from '../../_fixtures/Look';

export const RADIAL_WAVE_DURATION = 114; // 3800ms @30fps

// 配色槽位（usePalette）：四个默认值逐字符照抄本文件原本的主色，未传配色键时原样返回 →
// 默认画面零变化。本镜头没有文字层，ink 只作结构声明、不挂任何节点（见报告 kept）。
const PALETTE_FALLBACK = { bg: '#0a0b10', primary: '#6c8cff', secondary: '#b9f2ff', ink: '#b9f2ff' };

const COLS = 17;
const ROWS = 9;
const CX = (COLS - 1) / 2;
const CY = (ROWS - 1) / 2;
const MAX_D = Math.hypot(CX, CY);

const DOTS = Array.from({ length: ROWS * COLS }, (_, i) => {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  return {
    left: `${((c + 0.5) / COLS) * 100}%`,
    top: `${((r + 0.5) / ROWS) * 100}%`,
    dist: Math.hypot(c - CX, r - CY) / MAX_D,
  };
});

// ── 竖屏 9:16 重排（1080×1920）：只动布局数值，波形公式 / 时间轴 / 配色槽位一律不碰 ──
// 横屏这张卡"靠宽度成立"：17×9 的宽幅点阵，DesignStage 按 width/480 放大 4 倍正好铺满
// 1920×1080。竖屏短边只有 1080，同一张 17 列点阵缩到 1080 宽就只剩 607 高，底部空一大截。
// 所以竖屏把点阵转置成竖向 11×17，并把设计坐标换成 360×640（×3 = 1080×1920 满画布）：
// 左右各让 72px、上面让 180px、下面让 320px 安全区；单元 ≈28.4×27.8 单位≈方形，
// 波在屏幕空间仍是同心圆。点径 12 单位（36px），与横屏 40px 观感一致。
const V_W = 360;
const V_H = 640;
const V_COLS = 11;
const V_ROWS = 17;
const V_PAD = 72 / 3; // 24 单位 = 72px
const V_SAFE_TOP = 180 / 3; // 60 单位 = 180px
const V_SAFE_BOTTOM = 320 / 3; // ≈106.67 单位 = 320px
const V_GRID_W = V_W - V_PAD * 2; // 312 单位 = 936px
const V_GRID_H = V_H - V_SAFE_TOP - V_SAFE_BOTTOM; // ≈473.33 单位 = 1420px
const V_CX = (V_COLS - 1) / 2;
const V_CY = (V_ROWS - 1) / 2;
const V_MAX_D = Math.hypot(V_CX, V_CY);
const V_DOT = 12;

const V_DOTS = Array.from({ length: V_ROWS * V_COLS }, (_, i) => {
  const r = Math.floor(i / V_COLS);
  const c = i % V_COLS;
  return {
    left: V_PAD + ((c + 0.5) / V_COLS) * V_GRID_W,
    top: V_SAFE_TOP + ((r + 0.5) / V_ROWS) * V_GRID_H,
    dist: Math.hypot(c - V_CX, r - V_CY) / V_MAX_D,
  };
});

export const RadialWave: React.FC = () => {
  // 配色覆盖层：组件顶层无条件调用；未传配色键时原样返回 PALETTE_FALLBACK → 默认画面零变化。
  // 本组件没有持色的子组件（圆点全部在这里内联），故只需这一处调用。
  const PAL = usePalette(PALETTE_FALLBACK);
  const t = useT();
  // 竖屏变体（reflow）：点阵转置成 11×17、舞台换 360×640（×3 铺满 1080×1920）；
  // 横屏（1920×1080）仍走 17×9 + DesignStage 默认 480×270，参数逐字符未动 → 默认帧零变化。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const dots = vertical ? V_DOTS : DOTS;
  const dotSize = vertical ? V_DOT : 10;
  const stageW = vertical ? V_W : 480;
  const stageH = vertical ? V_H : 270;
  return (
    <DesignStage bg={PAL.bg} w={stageW} h={stageH}>
      {dots.map(({ left, top, dist }, i) => {
        // 第一道波：扩散点亮；第二道波：反向脉冲
        const w1 = seg(t, dist * 0.35, dist * 0.35 + 0.18, E.outCubic);
        const w2 = seg(t, 0.62 + (1 - dist) * 0.25, 0.62 + (1 - dist) * 0.25 + 0.15);
        const pulse2 = Math.sin(w2 * Math.PI);
        const s = w1 * (1 + 0.5 * Math.sin(w1 * Math.PI)) + pulse2 * 0.8;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              left,
              top,
              margin: -dotSize / 2,
              // 第二道波脉冲期的亮蓝圆点 = 次强调（原 #b9f2ff）；其余常驻圆点 = 品牌强调（原 #6c8cff）
              background: pulse2 > 0.3 ? PAL.secondary : PAL.primary,
              transform: `scale(${s})`,
              opacity: 0.25 + w1 * 0.5 + pulse2 * 0.25,
              boxShadow: pulse2 > 0.3 ? '0 0 12px #7fd8ff' : 'none',
            }}
          />
        );
      })}
    </DesignStage>
  );
};
