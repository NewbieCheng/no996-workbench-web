// @ts-nocheck
// changelog-scroll-brake —— Changelog 长卷急刹
// ~34 行条目（行高错落）从下往上高速掠过（快起步 + 指数式长尾减速），
// 高速段叠纵向运动模糊（速度差分驱动，糊成色带），急刹精准停位后目标行抬升
// （scale 1.03 + 阴影加深）+ 强调色描边，其余行退暗。f=84 后全静止（66f）。
//
// 质感升级：灰色骨架行换成一整年的真实感 changelog（版本号 / 类型标签 / 标题 / 说明 / 日期，按时间
// 自上而下排列，停点之后是 Planned 路线图条目）；目标行 v2.41 出版级内容 + NEW 徽标；起步从"第 14 帧
// 瞬间满速"改为 cubic-bezier(0.45,0,0.06,1)（约 5f 拉满速度后长尾刹停）；各向同性 blur 改为沿滚动方向
// 的纵向 SpeedBlur（横向字形不糊，读作真实运动模糊）；顶部固定页眉 + 上下渐隐遮罩；柔光亮场 + 颗粒。
import React from 'react';
import { useCurrentFrame, interpolate } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { G } from '../../_fixtures/Fixtures';
import { Backdrop, EASE, FONT, Grain, SpeedBlur, bezier, innerHighlight, softShadow, tracking } from '../../_fixtures/Polish';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';
import { usePalette, alpha, rgbOf } from '../../_fixtures/Look';

/**
 * usePalette 默认值 = 本镜头原本的四个主色（未传配色键时默认画面零变化）：
 * bg 取柔光浅底 Backdrop 三段渐变的中段停靠点 '#efefec'（与 Backdrop 原字符串逐字符一致）；
 * primary = G.accent '#5b63d3'（目标行 Launch 徽标实底 + 目标行外强调环）；
 * secondary = 同一支靛蓝 '#5b63d3'（本文件只有一支品牌强调色，没有第二个独立强调色；
 *   NEW 徽标与它的 11% 淡染底是第二处强调落点，独占 secondary 让用户能把它与 primary 分开调）；
 * ink = G.ink1 '#17181c'（行标题 / 顶栏页眉大标题）。
 */
const PALETTE_FALLBACK = { bg: '#efefec', primary: '#5b63d3', secondary: '#5b63d3', ink: '#17181c' };

export const CHANGELOG_SCROLL_BRAKE_DURATION = 150; // 静置 14f + 滚动 50f + 抬升 14f + 静止 66f

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// 时间轴
const SCROLL0 = 14; // 前 14f 初始静置（停在长卷顶部）
const SCROLL1 = 64; // 急刹停位帧
const LIFT0 = 68; // 目标行抬升开始
const LIFT1 = 82;

const COL_W = 1000;
const COL_X = (1920 - COL_W) / 2;
const GAP = 20;
const N = 34;
const TARGET = 28;

// 行高错落（帧确定性：全由 i 决定）
const rowH = (i: number) => 72 + ((i * 29) % 3) * 22; // 72 / 94 / 116

// 预计算每行 y
const rowY: number[] = [];
{
  let y = 0;
  for (let i = 0; i < N; i++) {
    rowY.push(y);
    y += rowH(i) + GAP;
  }
}
const TARGET_CY = rowY[TARGET] + rowH(TARGET) / 2;
const END_T = 540 - TARGET_CY; // 目标行停在画面正中
const START_T = 200; // 起始：长卷顶部在页眉下方

// 快起步（~5f 到峰速）+ 长尾指数式减速：高开中收
const BRAKE_EASE = bezier(0.45, 0, 0.06, 1);
const scrollAt = (f: number): number =>
  interpolate(f, [SCROLL0, SCROLL1], [START_T, END_T], { easing: BRAKE_EASE, ...CL });

// ── 假内容：video-shotcraft 一整年的发布记录（自上而下时间递增），停点 = Motion workbench，之后为路线图 ──
const TITLES = [
  'Crash zoom shot card', 'Faster Remotion renders', 'Fix: audio drift on long renders',
  'Beat grid from any BGM', 'Dolly zoom shot card', 'Real page captures', 'Fix: caption timing at 60 fps',
  'Gallery style filters', 'Whip pans', 'Ink Press template', 'Improved SFX ducking', 'Fix: blur seam on 4K export',
  'Storyboard from a prompt', 'Inline shot previews', 'Poster frame picker', 'Parallax depth layers', 'Fix: font fallback in titles',
  'Beat-synced flash cuts', 'Film grain overlay', 'Lower thirds', 'Faster cold render', 'Fix: mask edge on Safari',
  'Showcase gallery', 'Light leaks', 'Per-shot color looks', 'Offline asset cache', 'Fix: cursor path smoothing', 'JianYing export',
];
const KINDS = ['Feature', 'Improved', 'Fix'] as const;
// 三类型徽标色 + Planned 路线图色 = 发布记录的分类语义色（内容本身），不占配色槽位。
// Launch（目标行那枚实心品牌徽标）不在这张表里：它走 PAL.primary，在 Row 内按类型派生。
const KIND_STYLE: Record<string, { bg: string; fg: string }> = {
  Feature: { bg: 'rgba(91,99,211,0.11)', fg: '#4a51b8' },
  Improved: { bg: 'rgba(22,150,110,0.11)', fg: '#137a5a' },
  Fix: { bg: 'rgba(20,22,28,0.06)', fg: '#5d5f66' },
  Planned: { bg: 'transparent', fg: '#9b9da3' },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const entry = (i: number) => {
  if (i === TARGET)
    return {
      v: 'v2.41', kind: 'Launch', title: 'Motion workbench',
      desc: 'Every shot, tuned in one place.', date: 'Today',
    };
  if (i > TARGET)
    return { v: '—', kind: 'Planned', title: ['Vertical 9:16 cuts', 'Brand kit import', 'Shot A/B compare', 'Multi-track SFX', 'Batch renders'][(i - TARGET - 1) % 5], desc: 'On the roadmap for Q4.', date: 'Q4' };
  const kind = TITLES[i].startsWith('Fix') ? 'Fix' : KINDS[i % 2];
  return {
    v: `v2.${13 + i}`,
    kind,
    title: TITLES[i].replace(/^Fix: (.)/, (_, c: string) => c.toUpperCase()),
    desc: 'Rolled out to every project with no action required.',
    date: `${MONTHS[Math.min(8, Math.floor((i / TARGET) * 9))]} ${1 + ((i * 11) % 27)}`,
  };
};

const Row: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  // 配色槽位（usePalette）：主文字色（行标题）+ 品牌强调（Launch 徽标实底、停点行外强调环、NEW 徽标字与淡染底）
  const PAL = usePalette(PALETTE_FALLBACK);
  const isTarget = i === TARGET;
  const h = rowH(i);
  const e = entry(i);
  const tall = h >= 94;
  const planned = e.kind === 'Planned';
  const isLaunch = e.kind === 'Launch';
  // Launch 徽标 = 全片唯一实心品牌底，取 PAL.primary；原有 fg 为反白 #ffffff（跟强调色底对比绑定，保留）
  const k = isLaunch ? { bg: PAL.primary, fg: '#ffffff' } : KIND_STYLE[e.kind];
  // 目标行（抬升 + NEW 徽标那一行）的标题：可编辑镜头参数，默认值与 entry() 中的字面量逐字符一致
  const targetTitle = useShotProp('targetTitle', 'Motion workbench');

  // 目标行抬升 + 高亮；其余行退暗
  const t = interpolate(frame, [LIFT0, LIFT1], [0, 1], { easing: EASE.out, ...CL });
  const lift = isTarget ? t : 0;
  const dim = isTarget ? 0 : t;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: rowY[i],
        width: COL_W,
        height: h,
        background: planned ? 'rgba(255,255,255,0.55)' : '#ffffff',
        border: planned ? '1px dashed rgba(20,22,28,0.14)' : `1px solid ${G.hairline}`,
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        padding: '0 30px',
        boxSizing: 'border-box',
        transform: `scale(${1 + 0.03 * lift})`,
        boxShadow: planned
          ? 'none'
          : `${innerHighlight(0.9)}, ${softShadow(2 + 26 * lift, { strength: 1 + 0.6 * lift })}` +
            (lift > 0 ? `, 0 0 0 ${(2 * lift).toFixed(2)}px rgba(${rgbOf(PAL.primary)},${(0.9 * lift).toFixed(3)})` : ''),
        opacity: 1 - 0.62 * dim,
        zIndex: isTarget ? 2 : 1,
        fontFamily: FONT.sans,
      }}
    >
      <div style={{ width: 82, flexShrink: 0, fontFamily: FONT.mono, fontSize: 22, color: G.ink3, fontVariantNumeric: 'tabular-nums' }}>
        {e.v}
      </div>
      <div
        style={{
          flexShrink: 0,
          height: 34,
          padding: '0 14px',
          borderRadius: 17,
          // Launch 徽标是全片唯一的实心品牌底（其余三类型是分类语义色，不接槽位）
          background: k.bg,
          border: planned ? '1px solid rgba(20,22,28,0.12)' : 'none',
          color: k.fg,
          fontSize: 20,
          fontWeight: 650,
          lineHeight: '34px',
          letterSpacing: '0.01em',
        }}
      >
        {e.kind}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: isTarget ? 36 : 28,
            fontWeight: isTarget ? 700 : 600,
            color: planned ? G.ink3 : PAL.ink,
            letterSpacing: tracking(isTarget ? 36 : 28),
            whiteSpace: 'nowrap',
          }}
        >
          {isTarget ? targetTitle : e.title}
        </div>
        {tall && (
          <div style={{ marginTop: 4, fontSize: isTarget ? 26 : 22, color: G.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {e.desc}
          </div>
        )}
      </div>
      {isTarget && (
        <div
          style={{
            flexShrink: 0,
            height: 30,
            padding: '0 12px',
            borderRadius: 8,
            background: alpha(PAL.secondary, 0.11),
            color: PAL.secondary,
            fontSize: 18,
            fontWeight: 750,
            lineHeight: '30px',
            letterSpacing: '0.08em',
            opacity: lift,
            transform: `translateX(${((1 - lift) * 8).toFixed(2)}px)`,
          }}
        >
          NEW
        </div>
      )}
      <div style={{ flexShrink: 0, width: 92, textAlign: 'right', fontSize: 22, color: G.ink3, fontVariantNumeric: 'tabular-nums' }}>
        {e.date}
      </div>
    </div>
  );
};

// 列表上下渐隐：页眉下方与画面底部各一段
const LIST_MASK = 'linear-gradient(180deg, transparent 150px, #000 250px, #000 930px, transparent 1060px)';

export const ChangelogScrollBrake: React.FC = () => {
  // 配色槽位（usePalette）：舞台底色（Backdrop）+ 页眉大标题的主文字色
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  // 固定页眉的大标题：可编辑镜头参数，默认值与原字面量一致
  const title = useShotProp('title', 'Changelog');
  const T = scrollAt(frame);
  // 速度差分（px/f）→ 纵向运动模糊
  const v = scrollAt(frame + 0.5) - scrollAt(frame - 0.5);

  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', fontFamily: FONT.sans }}>
      {/* 舞台底色：默认走 Backdrop 原柔光浅底渐变（默认值与它逐字符一致 → 默认零变化），用户改底色时退成纯色 */}
      <Backdrop
        tone="light"
        light={{ x: 0.5, y: 0.2 }}
        vignette={0.16}
        grain={0}
        style={{ background: PAL.isCustom ? PAL.bg : 'linear-gradient(180deg, #f6f6f4 0%, #efefec 55%, #e8e8e4 100%)' }}
      />
      <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: LIST_MASK, maskImage: LIST_MASK }}>
        <SpeedBlur vx={0} vy={v} amount={0.32} max={30}>
          <div
            style={{
              position: 'absolute',
              left: COL_X,
              top: 0,
              width: COL_W,
              height: 1080,
              transform: `translateY(${T.toFixed(2)}px)`,
            }}
          >
            {Array.from({ length: N }).map((_, i) => (
              <Row key={i} i={i} frame={frame} />
            ))}
          </div>
        </SpeedBlur>
      </div>
      {/* 固定页眉：镜刻标志 + Changelog + 品牌名 */}
      <div style={{ position: 'absolute', left: COL_X, top: 64, width: COL_W, display: 'flex', alignItems: 'baseline', gap: 22 }}>
        <ShotcraftMark size={50} tone="light" style={{ alignSelf: 'center', marginRight: -4 }} />
        <div style={{ fontSize: 52, fontWeight: 720, letterSpacing: tracking(52), color: PAL.ink }}>{title}</div>
        <div style={{ fontFamily: BRAND.font, fontSize: 30, fontWeight: 600, color: G.ink3, letterSpacing: '0.03em' }}>{BRAND.name}</div>
      </div>
      <Grain opacity={0.05} />
    </div>
  );
};
