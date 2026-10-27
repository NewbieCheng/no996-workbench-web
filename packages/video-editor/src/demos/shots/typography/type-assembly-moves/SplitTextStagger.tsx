// @ts-nocheck
// 逐字遮罩裂升（split-text-stagger）——GSAP SplitText 惯用入场。
// 标题 "FRAME MOTION."（video-shotcraft 品牌短句前半句）按字符拆 span，每字外包 overflow:hidden 的行高盒，
// 内层从 translateY(115%) 升到 0，各 14f Easing.out(cubic)，带 10% 过冲
// 再 6f 回落（原案 6% 过冲，按可感性红线加码到 10%）。delay = 字符索引×2f。
// 底部基线细线在首字起跳同帧从左向右生长，暗示裁切线存在。
// 关键帧：0–12 空场 hold → 12 首字起跳 + 基线开始生长 → 每字 12+i*2 起跳，
// 14f 升至 -10% 过冲 → 再 6f 回落归 0 → 末字(索引12)于 56f 落定 →
// 56–130 全静止（74f ≥ 40f，无逐帧噪声层）。
//
// 质感升级：去掉调试标题；柔光 Backdrop；系统 SF 栈 700、字号 120→136；
// 升起快速段按每字竖向速度加 y 向运动模糊（静止为 0）；基线改强调色、宽度与文字行严格等宽，
// 生长用强 ease-out；补导出时长 130f（原工作台按 56f 推断，末字刚落定就切走）。
import React from 'react';
import { useCurrentFrame, interpolate, Easing, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { Backdrop, EASE, FONT as PFONT, ramp } from '../../_fixtures/Polish';
import { usePalette } from '../../_fixtures/Look';

export const SPLIT_TEXT_STAGGER_DURATION = 130;

// —— 配色槽位（usePalette）：本镜头自带色板（柔光浅底 + 一支靛蓝强调 + 基线渐变的淡紫尾巴 + 近黑标题），
// 不套整套 Look，只开放 4 个槽位；未传任何配色键时 usePalette 原样返回本常量 → 默认画面零变化。
// 四个默认值 = 本文件原本的四个主色，逐字符照抄原 hex：
//   bg        = 大面积舞台底色：Backdrop tone="light" 内置柔光三段渐变 '#f6f6f4 0% / #efefec 55% / #e8e8e4 100%'
//               的中段停靠点 '#efefec'（Backdrop 是不透明共享件，只有默认回填原渐变字符串才能既保持零变化、
//               又让用户改底色时真正退成 PAL.bg 纯色）；
//   primary   = 最显眼的品牌强调色：原 accent="#5b63d3"（= Fixtures G.accent，底景色相余光 + 基线渐变起点）；
//   secondary = 次强调：基线渐变尾部的淡紫 '#7c83e6'（基线是画面里唯一第二条彩色，尾巴单独开放可整体换调）；
//   ink       = 主文字色：标题逐字 span 的 color，原 G.ink1 '#17181c'。
const PALETTE_FALLBACK = { bg: '#efefec', primary: '#5b63d3', secondary: '#7c83e6', ink: '#17181c' };

// 标题文案默认值 = video-shotcraft 品牌短句 Frame motion. Craft the shot. 的前半句（13 字符）
const START = 12; // 首字起跳帧
const RISE = 14; // 升起时长
const SETTLE = 6; // 过冲回落时长
const OVERSHOOT = -10; // 过冲到 -10%（原案 6%，加码）
const FONT = 136;
const LINE_H = 1.05; // span 行高（translateY 百分比以此为基准）

// 单字符纵向位移（%）：115 → -10（out cubic）→ 0（out quad），帧确定
const charY = (f: number, idx: number): number => {
  const t0 = START + idx * 2;
  if (f < t0 + RISE) {
    return interpolate(f, [t0, t0 + RISE], [115, OVERSHOOT], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  }
  return interpolate(f, [t0 + RISE, t0 + RISE + SETTLE], [OVERSHOOT, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
};

export const SplitTextStagger: React.FC = () => {
  // 配色槽位（usePalette）：组件顶层无条件调用；未传配色键时原样返回 PALETTE_FALLBACK → 默认画面零变化。
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 竖屏重排（9:16 reflow）：外层容器在竖屏渲染时把 width/height 设成真实画布 1080×1920；
  // 横屏（1920×1080）下 vertical = false，下面每个 vertical ? A : B 里的 B 都是改前的原数字，
  // 舞台尺寸 / 字号 / 遮罩盒高 / 行宽 / 基线全回改前数值，默认帧逐像素不变。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // 字号按短边收到 0.57 倍（136 → 78）：13 字符 "FRAME MOTION." 由约 1078px 收到约 620px，
  // 落在 1080 − 144 = 936 的行宽内，逐字遮罩盒不再被画布左右裁断。
  const fontSize = vertical ? 78 : FONT;
  // 安全区（上 180 / 下 320）中心：横屏 0 位移（原居中不动）；竖屏把整块文字行压到 y=890
  const safeCy = 180 + Math.max(0, height - 180 - 320) / 2;
  const lockupDy = vertical ? safeCy - height / 2 : 0;
  // 基线细线按字号比例收细：横屏仍是原 12px 间距 / 3px 线宽
  const ruleGap = vertical ? 8 : 12;
  const ruleH = vertical ? 2 : 3;
  const title = useShotProp('title', 'FRAME MOTION.');
  const chars = title.split('');
  // 基线：首字起跳同帧开始，从左向右生长到 100%
  const lineW = ramp(frame, START, 30, EASE.snappy) * 100;

  return (
    <div style={{ width: vertical ? width : 1920, height: vertical ? height : 1080, position: 'relative', overflow: 'hidden' }}>
      {/* 舞台底色：默认仍铺 Backdrop 的原始柔光浅底三段渐变（字符串与 Backdrop 内部 base 逐字符相同 → 默认零变化），
          用户改底色 / 选预设主题（PAL.isCustom）时退成 PAL.bg 纯色，检查器改色才真正可见。
          底景的环境余光取自品牌强调色 → PAL.primary。 */}
      <Backdrop
        tone="light"
        light={{ x: 0.42, y: 0.3 }}
        accent={PAL.primary}
        grain={0.045}
        vignette={0.12}
        style={{ background: PAL.isCustom ? PAL.bg : 'linear-gradient(180deg, #f6f6f4 0%, #efefec 55%, #e8e8e4 100%)' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // 竖屏：左右各留 72px（行宽上限 1080 − 144），整块再上移到安全区中心
          padding: vertical ? '0 72px' : undefined,
          boxSizing: vertical ? 'border-box' : undefined,
          transform: vertical ? `translateY(${lockupDy.toFixed(2)}px)` : undefined,
        }}
      >
        {/* 行容器：基线与文字行同宽；竖屏限宽 100%，超长文案换行而不是被裁 */}
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', maxWidth: vertical ? '100%' : undefined }}>
          <div style={{ display: 'flex', flexWrap: vertical ? 'wrap' : undefined, justifyContent: vertical ? 'center' : undefined }}>
            {chars.map((c, i) => {
              const y = charY(frame, i);
              // 竖向速度（px/帧）→ y 向模糊（按实际字号换算，横屏 fontSize === FONT → 原数值不变）
              const vy = Math.abs(charY(frame + 0.5, i) - charY(frame - 0.5, i)) * fontSize * LINE_H * 0.01;
              const blur = Math.min(10, vy * 0.32);
              const id = `sts-vb-${i}`;
              return (
                <div
                  key={i}
                  style={{
                    // 遮罩盒：上方留 0.3em 头部空间容纳过冲，底边即裁切线（盒高随字号走：横屏 136×1.35 不变）
                    overflow: 'hidden',
                    height: fontSize * 1.35,
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  {blur > 0.3 && (
                    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
                      <filter id={id} x="-10%" y="-50%" width="120%" height="200%">
                        <feGaussianBlur stdDeviation={`0 ${blur.toFixed(2)}`} />
                      </filter>
                    </svg>
                  )}
                  <span
                    style={{
                      display: 'inline-block',
                      fontFamily: PFONT.sans,
                      fontWeight: 700,
                      fontSize,
                      lineHeight: LINE_H,
                      color: PAL.ink,
                      letterSpacing: '-0.015em',
                      transform: `translateY(${y.toFixed(3)}%)`,
                      filter: blur > 0.3 ? `url(#${id})` : undefined,
                    }}
                  >
                    {c === ' ' ? '\u00a0' : c}
                  </span>
                </div>
              );
            })}
          </div>
          {/* 基线细线：宽度从 0 生长到全文宽（强调色，暗示裁切线） */}
          <div style={{ marginTop: ruleGap, height: ruleH, display: 'flex' }}>
            <div
              style={{
                height: ruleH,
                width: `${lineW.toFixed(3)}%`,
                borderRadius: 2,
                // 基线渐变只有起止两色：起点 = 品牌强调 PAL.primary，尾部 = 次强调 PAL.secondary
                // （默认值与原文 ${G.accent} / #7c83e6 逐字符相同 → 默认零变化）
                background: `linear-gradient(90deg, ${PAL.primary}, ${PAL.secondary})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
