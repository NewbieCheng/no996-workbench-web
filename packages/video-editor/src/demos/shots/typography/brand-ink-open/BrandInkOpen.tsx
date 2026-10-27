// @ts-nocheck
// brand-ink-open —— 墨线十字准星描画 → 字标逐字 letterpress → 打字机副标
// → 满一秒静止 → 上浮消散。品牌开场第一拍：任何产品画面出现前先立名号。
// 参考实现从 template SceneOpen 帧 0–83 段剥离，self-contained：
// 十字准星 SVG pathLength dashoffset 描画后淡出；字标逐字从大 scale 压到 1 +
// blur→0（入场三件套定式），字底强调色 glint 短划闪过；kicker mono 打字机
// 逐字符 + 强调色块光标周期闪；46–76f 整整 1s 静止 hold；退场 7f 上浮+缩+淡。
// 品牌名/副标/强调色可换成目标品牌。demo 立的是 video-shotcraft：字标全小写（保留纸墨 letterpress 的衬线字），副标打品牌短句。
// 竖屏（1080×1920）：单列居中不变，整组按短边收一档——字标 132→88、kicker 26→18、准星 64→52，
// 左右留 72px 安全边（内容 ≤ 1080-144），组高约 210px 落在上 180 / 下 320 安全区内；横屏数字原样。
import { AbsoluteFill, interpolate, useCurrentFrame, Easing, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { BRAND, PITCH } from '../../_fixtures/Brand';
import { usePalette } from '../../_fixtures/Look';

export const BRAND_INK_OPEN_DURATION = 104;

/**
 * 配色槽位（usePalette）：四个默认值 = 本文件原本的四个主色。
 *  - bg        ← 满版纸底 '#faf7f2'（最外层 AbsoluteFill 的 backgroundColor，逐字符照抄原 hex）
 *  - primary   ← 最显眼的品牌强调：琥珀 AMBER，全片唯一彩色墨（十字准星描画 / 字底 glint 短划 / 打字机方块光标）。
 *                原文写作 oklch(52% 0.115 65)，没有 hex 可抄，这里填它的 sRGB 等值 #955905；
 *                未改配色时仍逐字符渲染原 oklch 字面量（见组件里的 accent），默认帧零变化。
 *  - secondary ← 次强调（第二视觉层）：等宽 kicker 副标的字色 INK2（原 oklch(50% 0.006 82) → sRGB 等值 #65635f）。
 *                本镜头只有一支强调色，副标是画面里第二大面积的彩色层（26px 打字机行），
 *                按「次强调」落在它身上，secondary 才不是死槽。默认同样沿用原 oklch 字面量。
 *  - ink       ← 主文字色：字标 wordmark 的墨色 INK（原 oklch(18% 0.006 82) → sRGB 等值 #13110f），默认沿用原 oklch。
 */
const PALETTE_FALLBACK = { bg: '#faf7f2', primary: '#955905', secondary: '#65635f', ink: '#13110f' };

const SERIF = 'ui-serif, Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const INK = 'oklch(18% 0.006 82)'; // 字标墨色（原字面量）
const AMBER = 'oklch(52% 0.115 65)'; // 强调琥珀（原字面量）
const INK2 = 'oklch(50% 0.006 82)'; // 副标次级灰（原字面量）

const WORDMARK = BRAND.name; // 'video-shotcraft'
const KICKER = PITCH.en.motto; // 'Frame motion. Craft the shot.'（textTransform 转大写）

export const BrandInkOpen: React.FC = () => {
  // 配色槽位（usePalette）：纸底 PAL.bg / 琥珀强调 PAL.primary / 副标次级灰 PAL.secondary / 字标墨色 PAL.ink。
  // 必须在函数体顶层无条件调用（早于下面任何分支）。
  const PAL = usePalette(PALETTE_FALLBACK);
  // 原文的强调色、墨色与副标色写作 oklch 字面量：未改配色时逐字符沿用它们（不回填 hex），
  // 保证默认帧逐字节零变化；用户一旦改色 / 选预设主题，才切到槽位色。
  // （近似 sRGB hex 只作为 PALETTE_FALLBACK 声明，供检查器色块与主题覆盖率统计用。）
  const accent = PAL.primary === PALETTE_FALLBACK.primary ? AMBER : PAL.primary;
  const ink = PAL.ink === PALETTE_FALLBACK.ink ? INK : PAL.ink;
  const ink2 = PAL.secondary === PALETTE_FALLBACK.secondary ? INK2 : PAL.secondary;
  const frame = useCurrentFrame();
  // 竖屏变体（reflow）：9:16 下画布变 1080×1920，字标是一整条不折行的 pre 行，
  // 按短边收到 0.67 倍（132→88，宽度约 545px，远小于安全内容宽 936px），
  // kicker / 准星 / 间距同步收一档；横屏（1920×1080）走的还是原来那套数字，默认帧零变化。
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const titleSize = vertical ? 88 : 132;
  const kickerSize = vertical ? 18 : 26;
  const crossSize = vertical ? 52 : 64;

  // 可编辑文案：品牌字标（默认留空，与 BRAND.name 一致）与字标下方等宽 kicker
  const wordmark = useShotProp('wordmark', WORDMARK);
  const kicker = useShotProp('kicker', KICKER);

  // --- crosshair draw-on (SVG pathLength = 100): vertical 0→9f, horizontal
  // 8→18f, then fades 24→34f so it doesn't fight the wordmark ---
  const vDraw = interpolate(frame, [0, 9], [100, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const hDraw = interpolate(frame, [8, 18], [100, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.linear,
  });
  const crossFade = interpolate(frame, [24, 34], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // --- kicker typewriter (28 → ~43), 0.7 frames per char (decorative small
  // text only — real interaction typing should be 3f/char, see type-and-filter) ---
  const perChar = 0.7;
  const kickStart = 28;
  const kickChars = Math.floor(Math.max(0, frame - kickStart) / perChar);
  const kickDone = kickStart + kicker.length * perChar;
  const cursorOn = (() => {
    if (frame < kickStart) return false;
    if (frame < kickDone) return true;
    if (frame > 95) return false;
    const b = frame - kickDone;
    return Math.floor(b / 2) % 2 === 0;
  })();

  // --- brand group rests fully-on for ~1s (wordmark completes ~64f; the last
  // glyph is done at 10+14*3+12=64), then dissolves out (97 → 104): lift +
  // shrink + fade. This leaves a clean ~33-frame hold of the COMPLETE title
  // (64→97), per the card's "完整标题停留 ~30 帧" requirement. ---
  const brandOut = interpolate(frame, [97, 104], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.5, 1),
  });
  const brandOpacity = 1 - brandOut;
  const groupY = -brandOut * 40;
  const groupScale = 1 - brandOut * 0.12;

  return (
    <AbsoluteFill style={{ backgroundColor: PAL.bg, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        textAlign: 'center', opacity: brandOpacity,
        transform: `translateY(${groupY}px) scale(${groupScale})`,
        // 竖屏：整组限制在 1080-144 的安全内容列内并左右留 72px，横屏不设任何盒约束
        width: vertical ? '100%' : undefined,
        padding: vertical ? '0 72px' : undefined,
        boxSizing: vertical ? 'border-box' : undefined,
      }}>
        {/* crosshair drawn by an invisible amber pen */}
        <svg width={crossSize} height={crossSize} viewBox="0 0 64 64" style={{ display: 'block', margin: `0 auto ${vertical ? 26 : 34}px`, opacity: crossFade }}>
          <line
            x1={32} y1={2} x2={32} y2={62}
            stroke={accent} strokeWidth={5} strokeLinecap="round"
            pathLength={100} strokeDasharray={100} strokeDashoffset={vDraw}
          />
          <line
            x1={2} y1={32} x2={62} y2={32}
            stroke={accent} strokeWidth={5} strokeLinecap="round"
            pathLength={100} strokeDasharray={100} strokeDashoffset={hDraw}
          />
        </svg>

        {/* wordmark: glyph-by-glyph letterpress with amber under-glint */}
        <div
          style={{
            fontFamily: SERIF, fontSize: titleSize, fontWeight: 600, color: ink,
            letterSpacing: '-0.01em', lineHeight: 1, whiteSpace: 'pre',
            display: 'inline-flex', alignItems: 'flex-end',
          }}
        >
          {wordmark.split('').map((ch, i) => {
            const delay = 10 + i * 3;
            const t = interpolate(frame, [delay, delay + 12], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.7, 0.25, 1),
            });
            const glintCenter = delay + 12;
            const glint = interpolate(frame, [glintCenter - 4, glintCenter, glintCenter + 4], [0, 1, 0], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            return (
              <span
                key={i}
                style={{
                  position: 'relative', display: 'inline-block', opacity: t,
                  transform: `scale(${1.6 - 0.6 * t})`, transformOrigin: 'center bottom',
                  filter: `blur(${(1 - t) * 6}px)`,
                }}
              >
                {ch === ' ' ? ' ' : ch}
                <span
                  style={{
                    position: 'absolute', left: '50%', bottom: -6, transform: 'translateX(-50%)',
                    width: `${glint * 100}%`, height: 2, background: accent, opacity: glint, borderRadius: 2,
                  }}
                />
              </span>
            );
          })}
        </div>

        {/* mono kicker typewriter + amber block cursor */}
        <div
          style={{
            fontFamily: MONO, fontSize: kickerSize, letterSpacing: '0.14em', color: ink2,
            marginTop: vertical ? 24 : 30, textTransform: 'uppercase', height: vertical ? 22 : 30,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}
        >
          <span style={{ whiteSpace: 'pre' }}>{kicker.slice(0, kickChars)}</span>
          <span
            style={{
              display: 'inline-block', width: vertical ? 10 : 14, height: vertical ? 18 : 24, marginLeft: 4,
              background: accent, opacity: cursorOn ? 0.85 : 0,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
