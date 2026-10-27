// @ts-nocheck
// 卡拉OK填色随读（karaoke-fill-sync）——旁白读到哪个词，哪个词就从左到右被填亮。
// 两行居中标语 "FRAME MOTION / CRAFT SHOTS"（video-shotcraft 短句 Frame motion. Craft the shot. 的四词版），
// 每个词双层同文本叠放：底层低透明墨色未读字，
// 上层用 mask 按词内进度线性揭开（逐词独立叠层，揭开百分比即词内进度，无需量测词宽；
// 揭开前沿是 ±4% 的柔边而不是硬切口）。正在读的词填强调色，读完 10f 内退成主墨色——
// 强调色只属于"此刻"。词级时间表模拟语速：FRAME 20–38、MOTION 42–75（长词慢读）、
// CRAFT 85–103、SHOTS 107–130，词间停顿（换气）。
// 读指：正在填的词底下 8px 强调色圆角下划线，右缘跟随填充前沿；读完从左往右收掉（6f），不留线。
// 底部一条旁白波形作静音预览的参照：词内起伏、换气处回落，已播部分着色。
// 0–19f hold；130–149f 真静止（最后的退色 / 收线在 f140 前完成）。
import React from 'react';
import { useCurrentFrame, interpolate, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { Backdrop, EASE, FONT, ramp, tracking } from '../../_fixtures/Polish';
import { usePalette, alpha, rgbOf } from '../../_fixtures/Look';

export const KARAOKE_FILL_SYNC_DURATION = 150;

type Word = { text: string; start: number; end: number };

const LINES: Word[][] = [
  [
    { text: 'FRAME', start: 20, end: 38 },
    { text: 'MOTION', start: 42, end: 75 },
  ],
  [
    { text: 'CRAFT', start: 85, end: 103 },
    { text: 'SHOTS', start: 107, end: 130 },
  ],
];
const ALL = LINES.flat();
const SIZE = 150;
const FEATHER = 4; // 揭开前沿柔边（%）

// 配色槽位（usePalette）：四个默认值 = 该文件原本的四个主色（逐字符照抄原 hex）。
//  - bg        ← 大面积舞台底色：Backdrop 柔光浅底三段渐变的中段停靠点 '#efefec'
//  - primary   ← 最显眼的品牌强调：正在读的词的填色 + 读指下划线（原 ACC = G.accent '#5b63d3'）
//  - secondary ← 次强调：底部旁白波形已播部分 + 舞台环境余光（原同用 G.accent，位置独立、可单独调）
//  - ink       ← 主文字色：读完退成的墨色（原 INK = G.ink1 '#17181c'），未读字 / 未播条的墨色淡影同源
const PALETTE_FALLBACK = { bg: '#efefec', primary: '#5b63d3', secondary: '#5b63d3', ink: '#17181c' };

// 槽位 hex → rgb 分量三元组（逐帧混色需要数字，默认值代入后与原 [91,99,211] / [23,24,28] 一致）
const rgbTriple = (hex: string): number[] => rgbOf(hex).split(',').map(Number);

const rgbMix = (a: number[], b: number[], k: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;

const KaraokeWord: React.FC<{ word: Word; frame: number }> = ({ word, frame }) => {
  // 配色槽位：填色跟随 PAL.primary、读完退成的墨色跟随 PAL.ink（未读底字是同色低透明形态）
  const PAL = usePalette(PALETTE_FALLBACK);
  const ACC = rgbTriple(PAL.primary);
  const INK = rgbTriple(PAL.ink);
  // 词内 linear 填充进度，clamp 保证读完保持（跟语速，不加缓动）
  const p = interpolate(frame, [word.start, word.end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const edge = p * (100 + FEATHER * 2) - FEATHER; // 柔边中心（%），p=0/1 时完全藏 / 完全露
  const mask = `linear-gradient(90deg, #000 ${(edge - FEATHER).toFixed(2)}%, transparent ${(edge + FEATHER).toFixed(2)}%)`;
  const settle = ramp(frame, word.end, 10, EASE.out); // 读完退成主墨色
  const fillColor = rgbMix(ACC, INK, settle);
  // 读指：读中跟随前沿，读完 6f 从左往右收掉
  const retract = ramp(frame, word.end, 6, EASE.swift);
  const showLine = frame >= word.start && retract < 1;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {/* 底层：低透明墨色未读字 */}
      <span style={{ color: alpha(PAL.ink, 0.13) }}>{word.text}</span>
      {/* 上层：按进度从左到右柔边揭开 */}
      {p > 0 && (
        <span style={{
          position: 'absolute', inset: 0, color: fillColor,
          WebkitMaskImage: mask, maskImage: mask,
        }}>
          {word.text}
        </span>
      )}
      {/* 读指下划线：右缘跟随填充前沿，读完从左收 */}
      {showLine && (
        <span style={{
          position: 'absolute', bottom: -6, height: 8, borderRadius: 4,
          left: `${(retract * p * 100).toFixed(2)}%`,
          width: `${(Math.max(0, p - retract * p) * 100).toFixed(2)}%`,
          background: PAL.primary, boxShadow: `0 2px 10px ${alpha(PAL.primary, 0.35)}`,
        }} />
      )}
    </span>
  );
};

// 旁白波形：48 根竖条，按"此刻是否在读词"给包络，确定性哈希给起伏
const BARS = 48;
const WAVE_W = 560;
const WAVE_T0 = 14;
const WAVE_T1 = 136;
const h = (n: number) => {
  const s = Math.sin(n * 91.7 + 13.1) * 43758.5453;
  return s - Math.floor(s);
};
const speechAt = (f: number) => {
  let e = 0.06;
  for (const w of ALL) {
    const fadeIn = ramp(f, w.start - 2, 3, EASE.out);
    const fadeOut = 1 - ramp(f, w.end - 2, 4, EASE.out);
    e = Math.max(e, fadeIn * fadeOut);
  }
  return e;
};

export const KaraokeFillSync: React.FC = () => {
  // 配色槽位：舞台底色 PAL.bg / 已播波形 + 环境余光 PAL.secondary（PAL.primary / PAL.ink 在 KaraokeWord 内消费）。
  // 必须在函数体顶层无条件调用（早于下面任何分支）。
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 标语两行的可编辑参数：默认逐字符等于原词序，两行结构与词间 56px 间距保持不变
  const line1 = useShotProp('line1', 'FRAME MOTION');
  const line2 = useShotProp('line2', 'CRAFT SHOTS');
  // 竖屏重排（9:16 reflow）：竖屏渲染时外层容器把 width/height 设成真实画布 1080×1920。
  // 横屏这里唯一"靠宽度成立"的就是标语：两行各两个词并排（gap 56），150px 下 "FRAME MOTION"
  // 整行约 1200px——只有 1920 才装得下。竖屏 1080 装不下，于是词序不变、每个词独占一行
  // （并排 → 单列堆叠），字号按短边收到 0.69 倍（150→104），整块落进安全区（上 180 / 下 320、
  // 左右各 72）。横屏（height < width）下下面每个 vertical ? A : B 的 B 都是原字面量，
  // 画布 / 字号 / 间距 / 波形位置全部回改前的数字，默认帧逐像素不变。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // 画布：横屏仍写死 1920×1080；竖屏用外层给的真实画布尺寸
  const stageW = vertical ? width : 1920;
  const stageH = vertical ? height : 1080;
  // 字号：竖屏 0.69 倍；字距从同一个数派生（横屏 tracking(SIZE) 与改前是同一个字符串）
  const titleSize = vertical ? 104 : SIZE;
  // 词间距：横屏两个词并排 gap 56；竖屏每词一行，横向间距归零
  const wordGap = vertical ? 0 : 56;
  // 两行标语之间：横屏无额外间距（沿用 lineHeight 1.18）；竖屏堆成四行时把两句分开一档
  const lineGap = vertical ? 26 : 0;
  // 标语区：横屏铺满整幅、底部留 60（原值）；竖屏限制在上 180 / 下 320 的安全区，
  // 左右各留 72 → 内容列 1080 − 144 = 936
  const titleTop = vertical ? 180 : 0;
  const titleBottom = vertical ? 320 : 60;
  // 旁白波形：横屏 560 宽、居中在 x=960、top=860（原值）；竖屏居中在 x=540、宽 720，
  // 高 72，整体压在底部安全区（320）之上
  const waveW = vertical ? 720 : WAVE_W;
  const waveH = vertical ? 72 : 56;
  const waveLeft = (vertical ? width : 1920) / 2 - waveW / 2;
  const waveTop = vertical ? height - 320 - waveH - 32 : 860;
  const playhead = (frame - WAVE_T0) / (WAVE_T1 - WAVE_T0);
  // 按空格拆词，词级时间表继续沿用 LINES 的既有槽位：
  // 默认两行各两词时，每个词拿到的 start/end 与原来完全一致（时序零变化）
  const lines = [line1, line2].map((text, li) => {
    const slots = LINES[li];
    return text.trim().split(/\s+/).filter(Boolean).map((word, wi) => ({
      ...slots[Math.min(wi, slots.length - 1)],
      text: word,
    }));
  });
  return (
    <div style={{ width: stageW, height: stageH, position: 'relative', overflow: 'hidden', fontFamily: FONT.sans }}>
      {/* 舞台底色：默认渲染 Backdrop 原柔光浅底三段渐变（逐字符相同 → 默认画面零变化），
          用户改底色 / 选预设主题时才退成 PAL.bg 纯色，检查器改色才真正可见；
          环境余光随次强调槽位（原字面量 '#5b63d3'） */}
      <Backdrop
        tone="light"
        light={{ x: 0.5, y: 0.22 }}
        accent={PAL.secondary}
        style={{ background: PAL.isCustom ? PAL.bg : 'linear-gradient(180deg, #f6f6f4 0%, #efefec 55%, #e8e8e4 100%)' }}
      />

      {/* 标语：横屏两行各两词并排；竖屏每词一行单列堆叠，整块居中在安全区内 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: titleTop, bottom: titleBottom,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontSize: titleSize, fontWeight: 800, letterSpacing: tracking(titleSize, true), lineHeight: 1.18,
        gap: lineGap,
        // 竖屏把内容列收窄到 1080 − 144（左右各 72），横屏不设任何盒约束
        padding: vertical ? '0 72px' : undefined,
        boxSizing: vertical ? 'border-box' : undefined,
      }}>
        {lines.map((words, li) => (
          <div key={li} style={{
            display: 'flex', flexDirection: vertical ? 'column' : 'row',
            alignItems: vertical ? 'center' : undefined, gap: wordGap,
          }}>
            {words.map((w, wi) => (
              <KaraokeWord key={`${li}-${wi}`} word={w} frame={frame} />
            ))}
          </div>
        ))}
      </div>

      {/* 旁白波形：已播部分强调色，未播部分淡墨 */}
      <div style={{
        position: 'absolute', left: waveLeft, top: waveTop, width: waveW, height: waveH,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {Array.from({ length: BARS }, (_, i) => {
          const u = i / (BARS - 1);
          const at = WAVE_T0 + u * (WAVE_T1 - WAVE_T0); // 这根条对应的旁白时刻
          const env = speechAt(at);
          const amp = 0.12 + env * (0.35 + 0.65 * h(i * 3 + 1));
          const played = u <= playhead;
          return (
            <div key={i} style={{
              width: 4, height: `${(amp * 100).toFixed(1)}%`, borderRadius: 2,
              background: played ? PAL.secondary : alpha(PAL.ink, 0.16),
              opacity: played ? 0.9 : 1,
            }} />
          );
        })}
      </div>
    </div>
  );
};
