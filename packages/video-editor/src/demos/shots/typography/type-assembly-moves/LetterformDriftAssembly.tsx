// @ts-nocheck
// 字形漂移合拢（letterform-drift-assembly）——Stranger Things 片头式入场。
// 品牌名 "Shotcraft"（BRAND.short，video-shotcraft 的简称）拆 9 字符：各自从不同方向（h(i) seeded 随机向量，
// 幅度 ±260–360px）带 blur 8px + opacity 0.35 缓慢漂入，错峰归位
// （delay i×3f，45f 行程，Easing.out(cubic)）。每字锁定瞬间给一次
// "加深脉冲"：字色 ink→#000→ink + 描边 0→3px→0（8f）——白底上
// 不用发光用加深（库判例）。全部合体后整词 scale 1→1.04→1 收束呼吸
// （判例：1.02 太弱，加码到 1.04）。
// 关键帧：0–24 各字错峰启程 → i 字 [i*3, i*3+45] 漂入归位 →
// 锁定帧 i*3+45 起 8f 加深脉冲（最后一字 69–77）→ 80–104 整词呼吸 →
// 104–150 全静止（46f，无逐帧滤镜）。
//
// 质感升级：去掉调试标题；柔光 Backdrop；系统 SF 栈 700、带色相的近黑墨色；
// 漂入除位移/blur/opacity 外再绑同一条 p 的旋转（±24°→0）与纵深缩放（1.22→1），
// 字是从镜头前的空间里飘回字面，而不是平面滑动；合体后字面下方浮出一层极淡的落地影。
// 补导出时长 150f（原工作台按 56f 推断，渲染止于半空）。
import React from 'react';
import { useCurrentFrame, interpolate, Easing } from '../../../runtime/index.ts';
import { Backdrop, EASE, FONT, ramp } from '../../_fixtures/Polish';
import { BRAND } from '../../_fixtures/Brand';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { usePalette, rgbOf } from '../../_fixtures/Look';

export const LETTERFORM_DRIFT_ASSEMBLY_DURATION = 150;

const h = (n: number) => {
  const s = Math.sin(n * 127.3) * 43758.5453;
  return s - Math.floor(s);
};

const WORD = BRAND.short; // 'Shotcraft'——片头式亮相落在品牌名上
const TRAVEL = 45; // 每字漂入行程帧数
const STAG = 3; // 错峰间隔

// —— 颜色：本镜头自带色板（柔光浅底 + 一支靛蓝环境余光 + 近黑墨色字标），只开放 4 个槽位 ——
// bg：大面积舞台底色（Backdrop 柔光浅底；默认仍走它自带的三段渐变，用户改底色 / 选预设时才退成纯色）；
// primary：全片唯一有彩度的品牌强调色 = Backdrop 的环境余光 #5b63d3（默认值逐字符照抄原 accent 字面量）；
// secondary：本文件没有第二个强调色（字标是单一墨色、脉冲加深与落地影属光影材质），
//   故该槽位只做声明、不挂任何节点，不从别处硬凑一支色（见报告 kept）；
// ink：主文字色 = 逐字漂入合拢的字标（原 G.ink1 / INK = #17181c，锁定瞬间的加深脉冲也由它派生）。
// 未传任何配色键时 usePalette 原样返回本常量 → 默认画面零变化。
const PALETTE_FALLBACK = { bg: '#efefec', primary: '#5b63d3', secondary: '#5b63d3', ink: '#17181c' };

export const LetterformDriftAssembly: React.FC = () => {
  // 配色槽位（usePalette）：底色 / 环境强调 / 主文字墨色。
  // 组件顶层无条件调用；未传配色键时原样返回 PALETTE_FALLBACK → 默认画面零变化。
  const PAL = usePalette(PALETTE_FALLBACK);
  // 字标的加深脉冲沿用「ink 逐通道乘 (1 - pulse)」的老算法，故先把墨色拆成 rgb 分量；
  // 默认 rgbOf('#17181c') → '23,24,28'，与原 INK 数组逐字符等价。
  const inkRgb = rgbOf(PAL.ink).split(',').map((v) => Number(v));
  const frame = useCurrentFrame();
  // 可编辑文案：逐字漂入合拢的字标（默认沿用 WORD，与 BRAND.short 一致）
  const word = useShotProp('word', WORD);
  const chars = word.split('');
  const lastLock = (chars.length - 1) * STAG + TRAVEL; // 69

  // 整词收束呼吸：80–92 放大到 1.04，92–104 回落，之后恒 1 → 帧确定
  const breath =
    frame < 92
      ? interpolate(frame, [80, 92], [1, 1.04], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        })
      : interpolate(frame, [92, 104], [1.04, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        });
  // 合体后落地影
  const ground = ramp(frame, lastLock - 6, 30, EASE.out);

  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden' }}>
      {/* 舞台底色：默认仍铺 Backdrop 自带的三段柔光渐变（未改动 → 默认帧逐字节零变化），
          用户改底色 / 选预设主题（PAL.isCustom）时才退成 PAL.bg 纯色，这样检查器改底色才真正可见。
          环境余光 accent 接 PAL.primary：全片唯一有彩度的品牌色。 */}
      <Backdrop
        tone="light"
        light={{ x: 0.5, y: 0.32 }}
        accent={PAL.primary}
        grain={0.05}
        vignette={0.14}
        style={{ background: PAL.isCustom ? PAL.bg : 'linear-gradient(180deg, #f6f6f4 0%, #efefec 55%, #e8e8e4 100%)' }}
      />
      {/* 落地影：合体后在字面下方出现的极淡椭圆影 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 520,
          top: 540 + 70,
          width: 1040,
          height: 70,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(20,22,32,0.13), rgba(20,22,32,0) 70%)',
          opacity: ground,
          transform: `scale(${breath})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${breath})`,
        }}
      >
        {chars.map((c, i) => {
          const start = i * STAG;
          const lock = start + TRAVEL;
          // 漂入进度（位移 / blur / opacity / 旋转 / 纵深 共用一条 p）
          const p = interpolate(frame, [start, lock], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          });
          // seeded 起始向量：方向 h(i)，幅度 260–360px
          const ang = h(i + 1) * Math.PI * 2;
          const mag = 260 + h(i + 101) * 100;
          const dx = Math.cos(ang) * mag * (1 - p);
          const dy = Math.sin(ang) * mag * (1 - p);
          const rot = (h(i + 201) - 0.5) * 48 * (1 - p);
          const depth = 1 + 0.22 * (1 - p);
          const blur = 8 * (1 - p);
          const op = interpolate(p, [0, 1], [0.35, 1]);
          // 锁定加深脉冲：lock→lock+8，三角波 0→1→0
          const pulse =
            frame <= lock || frame >= lock + 8
              ? 0
              : frame < lock + 4
                ? (frame - lock) / 4
                : (lock + 8 - frame) / 4;
          // 锁定加深脉冲：墨色逐通道乘 (1 - pulse)（原 INK 数组算法，换成主文字槽位色）
          const color = `rgb(${inkRgb.map((v) => Math.round(v * (1 - pulse))).join(',')})`;
          const strokeW = 3 * pulse;
          const settled = p >= 1 && pulse === 0;
          return (
            <span
              key={i}
              style={{
                fontFamily: FONT.sans,
                fontWeight: 700,
                fontSize: 148,
                letterSpacing: '0.02em',
                color: settled ? PAL.ink : color,
                display: 'inline-block',
                transform: settled
                  ? undefined
                  : `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${depth.toFixed(4)})`,
                opacity: op,
                filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : undefined,
                WebkitTextStroke: strokeW > 0.01 ? `${strokeW.toFixed(2)}px #000` : undefined,
              }}
            >
              {c}
            </span>
          );
        })}
      </div>
    </div>
  );
};
