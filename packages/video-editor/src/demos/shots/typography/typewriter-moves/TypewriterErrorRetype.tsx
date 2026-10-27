// @ts-nocheck
// typewriter-error-retype｜打字机误删重打
// 浅底居中大字（眉题 Introducing video-shotcraft）：f2 起 2f/字符打出 "just a slideshow"(16 字符) → f32–48 停顿
// 16f(光标闪两下=犹豫) → f48 起 1.5f/字符逐字退格删掉 "a slideshow"(11 字符，
// 字符直接消失) → f68 起 1.5f/字符果断打出 "your cinematic crew"(19 字符，
// f95 打完) → 光标闪两个周期(10f/周期)后 f110 永久熄灭。节奏三档：打 2f/删
// 1.5f/重打 1.5f 且无停顿。打完的同时（f96–110，与光标完稿两闪并行）一道强调色马克笔底色
// 从左到右铺到 "cinematic crew" 下半身给宣言一个落定；f110 后全静止，160f 总长 → 收尾真静止 50f。
// 等宽感：逐字符固定宽 span（等宽字体 100px，60px 槽），无 letter-spacing 动画。全部帧确定。
// 质感：柔光底 + 颗粒，主墨色近黑，光标是 6px 强调色圆角竖条。
import React from 'react';
import { useCurrentFrame, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { G } from '../../_fixtures/Fixtures';
import { Backdrop, EASE, FONT, ramp } from '../../_fixtures/Polish';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';
import { usePalette, rgbOf } from '../../_fixtures/Look';

export const TYPEWRITER_ERROR_RETYPE_DURATION = 160;

/**
 * 配色槽位（usePalette）：四个默认值 = 本镜头原本的四个主色（逐字符照抄原 hex）。
 *  - bg        ← 满版柔光浅底 <Backdrop tone="light"> 的内置三段渐变（写在 _fixtures/Polish.tsx），
 *                取中段停靠点 #efefec 作 fallback；默认仍原样铺内置渐变，用户改底色 / 选预设主题时才退成纯色。
 *  - primary   ← 最显眼的品牌强调 = 打字机光标竖条 G.accent（#5b63d3）。
 *  - secondary ← 次强调 = 同一支靛蓝的柔光形态：打在 "cinematic crew" 下半身的马克笔底色，
 *                以及底景环境余光 <Backdrop accent>（本文件只有这一支强调色，不新造 hex）。
 *  - ink       ← 主文字色 = 等宽大字与眉题里的品牌名 G.ink1（#17181c）。
 * 未传任何配色键时 PAL 与原字面量逐字符相同 → 默认画面零变化。
 */
const PALETTE_FALLBACK = { bg: '#efefec', primary: '#5b63d3', secondary: '#5b63d3', ink: '#17181c' };

const TEXT1 = 'just a slideshow'; // 16 chars
const KEEP = 5; // "just " 保留
const DEL = TEXT1.length - KEEP; // 11 chars 待删
const TEXT2 = 'your cinematic crew'; // 19 chars

const T1 = 2; // 第一遍打字起点，2f/字符
const PAUSE_START = T1 + (TEXT1.length - 1) * 2; // f32 打完
const DS = PAUSE_START + 16; // f48 开删，1.5f/字符
const RS = 68; // 重打起点，1.5f/字符（删完 f64.5 后小顿 3.5f）
const TYPE2_END = RS + (TEXT2.length - 1) * 1.5; // f95 打完
const CURSOR_OFF = 115; // 两个 10f 闪烁周期后熄灭（最后一次视觉变化 f110）

const SIZE = 100; // 字号
const CHAR_W = 60; // 等宽字体 100px 的字符宽（0.6em）
const LEFT = (1920 - 24 * CHAR_W) / 2; // 最终句 24 字符整体居中，打字过程左缘锚定不横移
// 竖屏（9:16）重排的设计值，一律以 1080 设计宽标定，落位时乘 `vs = width / 1080`：
// 1080×1920 成片 vs=1（数字与横屏那套互不干扰），540×960 校验帧 / 720×1280 等更小的竖屏画布
// 同名同比收（vs=0.5 / 0.666…）——绝不把设计值当绝对像素，否则半幅画布上整行会被右边界和底部安全区切掉。
// 24 字符 × 36 = 864 ≤ 1080 - 144（左右各留 72），字号收到横屏的 0.6 倍。
const DESIGN_W_V = 1080; // 竖屏设计宽（所有 SIZE_V / CHAR_W_V / 安全区数字都以它为基准）
const SAFE_TOP = 180; // 竖屏安全区上沿（设计值）
const SAFE_BOTTOM = 320; // 竖屏安全区下沿（设计值）
const SIZE_V = 60;
const CHAR_W_V = 36;
const HL_START = 96; // 马克笔底色起：打完即铺，和完稿两闪同时，f110 前铺完
const HL_DUR = 14;
const HL_FROM = 10; // "cinematic crew" 起始字符序号（最终句 "just your cinematic crew" 第 10 字符起）
const HL_LEN = 14;

// 光标可见性：打字/删除时常亮；停顿段 8f 周期闪两下；打完后 10f 周期闪两下；之后永灭
const cursorOn = (f: number): boolean => {
  if (f >= CURSOR_OFF) return false;
  if (f >= TYPE2_END) {
    // f95 起：on[95,100) off[100,105) on[105,110) off[110,115)
    return Math.floor((f - TYPE2_END) / 5) % 2 === 0;
  }
  if (f >= DS) return true; // 删除 + 重打：常亮（果断）
  if (f >= PAUSE_START) {
    // 犹豫段 f32–48：on[32,36) off[36,40) on[40,44) off[44,48)
    return Math.floor((f - PAUSE_START) / 4) % 2 === 0;
  }
  return true; // 第一遍打字：常亮
};

export const TypewriterErrorRetype: React.FC = () => {
  // 配色槽位（usePalette）：组件顶层无条件调用；未传配色键时原样返回 PALETTE_FALLBACK → 默认画面零变化。
  const PAL = usePalette(PALETTE_FALLBACK);
  const f = useCurrentFrame();
  // 竖屏变体（reflow）：9:16 下按短边重排——等宽字号 60、字符槽 36（1080 设计宽标定），
  // 落位时统一乘 vs = width / 1080：1080×1920 成片 vs=1（行宽 864，左右各留 108），
  // 540×960 校验帧 vs=0.5（行宽 432，左右各留 54），任何竖屏画布都不会越过右边界；
  // 行心取同一比例换算的安全区中线（1080×1920 时 = (180 + (1920-320))/2 = 890），
  // 半幅画布上跟着落到 445，不再掉到 960 画布底部以下。
  // 横屏（1920×1080）仍走原来那套数字，默认帧零变化。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const vs = vertical ? width / DESIGN_W_V : 1;
  const size = vertical ? SIZE_V * vs : SIZE;
  const charW = vertical ? CHAR_W_V * vs : CHAR_W;
  const left = vertical ? (width - 24 * CHAR_W_V * vs) / 2 : LEFT;
  const safeTop = SAFE_TOP * vs;
  const safeBottom = SAFE_BOTTOM * vs;
  const lineCy = vertical ? (safeTop + height - safeBottom) / 2 : 540;
  const eyebrowSize = vertical ? 24 * vs : 34;
  const eyebrowNudge = vertical ? 6 * vs : 6;
  const eyebrowGap = vertical ? 12 * vs : 12;
  const eyebrowLift = vertical ? 70 * vs : 70;
  const markSize = vertical ? 28 * vs : 40;
  const cursorW = vertical ? 4 * vs : 6;
  const cursorGap = vertical ? 4 * vs : 4;
  const hlPad = vertical ? 10 * vs : 10;
  const hlRadius = vertical ? 6 * vs : 6;
  // 可编辑文案：第一遍打出的 "just a slideshow"、重打的收尾宣言 "your cinematic crew"。
  // 默认值与模块常量 TEXT1 / TEXT2 逐字符一致，默认画面零变化；帧表（T1/PAUSE_START/DS/RS）仍按原长度排。
  const line1 = useShotProp('line1', TEXT1);
  const line2 = useShotProp('line2', TEXT2);

  // 第一遍已打出字符数
  const n1 = f < T1 ? 0 : Math.min(line1.length, Math.floor((f - T1) / 2) + 1);
  // 已删除字符数（从尾部删）
  const removed = f < DS ? 0 : Math.min(DEL, Math.floor((f - DS) / 1.5) + 1);
  // 第二遍已打出字符数
  const n2 = f < RS ? 0 : Math.min(line2.length, Math.floor((f - RS) / 1.5) + 1);

  const shown =
    line1.slice(0, Math.max(KEEP, n1 - removed)).slice(0, n1) +
    line2.slice(0, n2);

  const chars = shown.split('');

  const hl = ramp(f, HL_START, HL_DUR, EASE.snappy);

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      {/* 舞台底色：默认仍铺 Backdrop 的原始柔光三段渐变（fixture 内置、未改动 → 默认零变化），
          用户改底色 / 选预设主题（PAL.isCustom）时才退成 PAL.bg 纯色，检查器改底色才真正可见。
          环境余光 accent 原字面量 '#5b63d3' 属次强调槽位。 */}
      <Backdrop
        tone="light"
        light={{ x: 0.42, y: 0.3 }}
        accent={PAL.secondary}
        solid={PAL.isCustom ? PAL.bg : undefined}
      />
      {/* 马克笔底色：只铺在宣言词下半身，左→右（次强调槽位；两个停靠点同色、仅透明度不同，rgb 分量跟着槽位走） */}
      {hl > 0 && (
        <div style={{
          position: 'absolute', left: left + HL_FROM * charW - hlPad, top: lineCy + size * 0.06,
          width: (HL_LEN * charW + hlPad * 2) * hl, height: size * 0.36, borderRadius: hlRadius,
          background: `linear-gradient(90deg, rgba(${rgbOf(PAL.secondary)},0.26) 0%, rgba(${rgbOf(PAL.secondary)},0.20) 100%)`,
        }} />
      )}
      {/* 眉题：与打字行左缘对齐，开场 10f 淡入，交代"这是一句产品介绍"——video-shotcraft 标志 + 小写品牌名 */}
      <div style={{
        position: 'absolute', left: left + eyebrowNudge, top: lineCy - size * 0.55 - eyebrowLift,
        display: 'flex', alignItems: 'center', gap: eyebrowGap,
        fontFamily: FONT.sans, fontSize: eyebrowSize, fontWeight: 500, letterSpacing: '0.01em', color: G.ink3,
        opacity: ramp(f, 0, 10, EASE.out),
      }}>
        <ShotcraftMark size={markSize} tone="light" style={{ marginTop: -2 }} />
        <span>Introducing <span style={{ fontFamily: BRAND.font, fontWeight: 700, letterSpacing: '0.03em', color: PAL.ink }}>{BRAND.name}</span></span>
      </div>
      {/* 左缘锚定：打字过程不横移（真打字机感）；行垂直居中于 540（竖屏移到安全区中线 890，仍左缘锚定） */}
      <div
        style={{
          position: 'absolute',
          left,
          top: lineCy - (size * 1.1) / 2,
          display: 'flex',
          alignItems: 'center',
          height: size * 1.1,
        }}
      >
        {chars.map((c, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: charW,
              textAlign: 'center',
              fontFamily: FONT.mono,
              fontSize: size,
              fontWeight: 600,
              color: PAL.ink,
              lineHeight: 1.1,
            }}
          >
            {c === ' ' ? '\u00a0' : c}
          </span>
        ))}
        {/* 光标：强调色竖条，条件挂载而非 opacity 0 */}
        {cursorOn(f) && (
          <span
            style={{
              display: 'inline-block',
              width: cursorW,
              height: size * 0.98,
              marginLeft: cursorGap,
              borderRadius: vertical ? 3 * vs : 3,
              background: PAL.primary,
              boxShadow: `0 0 12px rgba(${rgbOf(PAL.primary)},0.35)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
