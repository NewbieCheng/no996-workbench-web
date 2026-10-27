// @ts-nocheck
// paper-title-card —— 一句话逐词 letterpress 压印上纸字卡
// 章节转场/价值主张呼吸位：单句文案逐词压印入场（scale 大→1 + blur→0），
// 每句恰一个强调色斜体重点词，强调色下划线 scaleX 收束，尾部整卡淡出。
// 全片多张字卡统一 50–55f；纸底+中心暖光与纸墨风格产品画面同色系。
// 参数化：words/sub/subDigits 可换成目标产品文案；subDigits 走 DigitRoll
// 数字滚动（必须在本卡淡出前落定）。渲染本 demo 前把 text 复制进项目即可。
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { usePalette } from '../../_fixtures/Look';

export const PAPER_TITLE_CARD_DURATION = 55; // ≈1.8s @30fps

/**
 * 配色槽位默认值 = 本卡原本的 oklch 主色（逐字符照抄）。
 * bg = 纸底、primary = 强调词与下划线、secondary = 眉题灰、ink = 正文字墨。
 */
const PALETTE_FALLBACK = {
  bg: 'oklch(97.5% 0.008 82)',
  primary: 'oklch(52% 0.115 65)',
  secondary: 'oklch(50% 0.006 82)',
  ink: 'oklch(18% 0.006 82)',
};

const SERIF = 'ui-serif, Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// 每句恰好一个 accent：功能名/收益词（C2）
// br：该词后强制换行（让两行长度接近原版 "All your team’s research, / one place to go." 的分行，避免孤词）
const WORDS: { text: string; accent?: boolean; br?: boolean }[] = [
  { text: 'Direct' },
  { text: 'the' },
  { text: 'film.', br: true },
  { text: 'Let' },
  { text: 'the' },
  { text: 'agent' },
  { text: 'shoot', accent: true },
  { text: 'it.' },
];
// 默认整句：与上面 WORDS 逐词拼接完全一致（改这里时同步改 WORDS，保证默认帧零变化）
const DEFAULT_TITLE = 'Direct the film. Let the agent shoot it.';
// 强调词与强制换行的词位（来自 WORDS 的结构，换文案时强调色/分行跟着这两个词位走）
const ACCENT_AT = WORDS.findIndex((w) => w.accent);
const BREAK_AT = WORDS.findIndex((w) => w.br);
// 副行：video-shotcraft 的渲染队列语境（示意数据）
const SUB = 'shots rendered today';
const SUB_DIGITS = '12';

// 数字滚动列（odometer 风格，复制自 template DigitRoll，数字带双份拼接保证
// 任何目标位都有滚感；tabular-nums 防横向抖）
const DIGITS = '0123456789';
const DigitColumn: React.FC<{ ch: string; delay: number; lineH: number; color: string }> = ({ ch, delay, lineH, color }) => {
  const frame = useCurrentFrame();
  if (ch < '0' || ch > '9') {
    return <span style={{ fontSize: 26, lineHeight: `${lineH}px`, color }}>{ch}</span>;
  }
  const target = DIGITS.indexOf(ch);
  const t = interpolate(frame, [delay, delay + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.25, 0.8, 0.25, 1),
  });
  const offset = (10 + target) * t * lineH;
  return (
    <span style={{ display: 'inline-block', height: lineH }}>
      <span style={{ display: 'block', transform: `translateY(${-offset}px)` }}>
        {(DIGITS + DIGITS).split('').map((d, j) => (
          <span
            key={j}
            style={{
              display: 'block',
              fontSize: 26,
              lineHeight: `${lineH}px`,
              color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
};

const DigitRoll: React.FC<{ value: string; delay: number; color: string }> = ({ value, delay, color }) => {
  const lineH = 26 * 1.15;
  return (
    <span style={{ display: 'inline-flex', overflow: 'hidden', height: lineH, verticalAlign: 'bottom' }}>
      {value.split('').map((c, i) => (
        <DigitColumn key={i} ch={c} delay={delay + i * 4} lineH={lineH} color={color} />
      ))}
    </span>
  );
};

export const PaperTitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const title = useShotProp('title', DEFAULT_TITLE);
  const subline = useShotProp('subline', SUB);
  const countValue = useShotProp('value', SUB_DIGITS);
  // 默认整句直接复用 WORDS（含强调词/分行结构）；换成别的句子时按空格重新分词，强调词位/分行词位沿用原结构
  const titleWords =
    title === DEFAULT_TITLE
      ? WORDS
      : title
          .split(/\s+/)
          .filter(Boolean)
          .map((text, i) => ({ text, accent: i === ACCENT_AT, br: i === BREAK_AT }));
  const duration = PAPER_TITLE_CARD_DURATION;
  const fadeOut = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const underline = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const subT = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const PAL = usePalette(PALETTE_FALLBACK);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAL.bg,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeOut,
        backgroundImage:
          'radial-gradient(1100px 750px at 50% 42%, oklch(99.3% 0.014 88 / 0.85), transparent 65%)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 1500 }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 116,
            fontWeight: 600,
            lineHeight: 1.14,
            color: PAL.ink,
            letterSpacing: '-0.012em',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            columnGap: '0.26em',
          }}
        >
          {titleWords.map((w, i) => {
            const delay = 4 + i * 4;
            const t = interpolate(frame, [delay, delay + 9], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.2, 0.75, 0.3, 1),
            });
            return (
              <React.Fragment key={i}>
                <span
                  style={{
                    opacity: t,
                    transform: `scale(${1.28 - 0.28 * t})`,
                    filter: `blur(${(1 - t) * 7}px)`,
                    display: 'inline-block',
                    fontStyle: w.accent ? 'italic' : 'normal',
                    color: w.accent ? PAL.primary : undefined,
                  }}
                >
                  {w.text}
                </span>
                {w.br && <span style={{ flexBasis: '100%', height: 0 }} />}
              </React.Fragment>
            );
          })}
        </div>
        <div
          style={{
            height: 6,
            width: 220,
            margin: '38px auto 0',
            borderRadius: 3,
            background: PAL.primary,
            transform: `scaleX(${underline})`,
          }}
        />
        <div
          style={{
            fontFamily: MONO,
            fontSize: 26,
            letterSpacing: '0.12em',
            color: PAL.secondary,
            marginTop: 34,
            opacity: subT,
            textTransform: 'uppercase',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'baseline',
            gap: '0.5em',
          }}
        >
          <DigitRoll value={countValue} delay={12} color="oklch(52% 0.115 65)" />
          <span>{subline}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
