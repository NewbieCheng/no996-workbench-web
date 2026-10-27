// @ts-nocheck
// icon-flip-bloom-logo —— 图标 Y 轴翻转压扁成竖线，绽放成花形 mark + wordmark 扫出
// 源：perplexity-promo 88–91.5s。笑脸 laptop 图标 anticipation 晃两下 →
// 沿 Y 轴翻转压扁成竖线（拖影/模糊）→ 翻过最薄处绽放花形 mark（花瓣张开）→
// wordmark 逐字由大变小落位（大时模糊、落位清晰，scale+blur 联动）。
// 质感：柔光亮场背景 + 图标的接地软影（随晃动/翻扁变化）。
// 品牌轮：终点 logo 换成 video-shotcraft「镜刻」标志——翻过最薄处，标志从竖线按同一个过冲 spring
// 撑开（取景框），随后琥珀斜切沿 45° 划入（替代原花瓣张开的第二拍）；字标 video-shotcraft 全小写、
// 品牌字体，逐字由大变小落定；全片唯一强调色是标志的琥珀斜切。
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing, spring, useVideoConfig } from '../../../runtime/index.ts';
import { useShotProp } from '../../../runtime/frame-context.tsx';
import { G } from '../../_fixtures/Fixtures';
import { Backdrop, EASE, ramp } from '../../_fixtures/Polish';
import { BRAND, ShotcraftMark } from '../../_fixtures/Brand';
import { usePalette } from '../../_fixtures/Look';

export const ICON_FLIP_BLOOM_LOGO_DURATION = 130;
const MARK = 300; // 标志尺寸（viewBox 128 → 可见取景框约 244×225）

// 配色槽位（usePalette）：四个默认值逐字符照抄本文件原本的四支主色，未传配色键时原样回填 →
// 默认画面零变化。本镜头的颜色极简（画面 = 柔光浅底 + 一支墨的图标 → 品牌标志/字标），因此只有两个槽位
// 有诚实落点，另外两个如实不挂位置（不拿光影/品牌色冒充，见下）：
//   bg  = 满版柔光浅底 <Backdrop tone="light"> 三段渐变的中段停靠点 #efefec（0% #f6f6f4 / 100% #e8e8e4 两端保留）
//   ink = 画面主体「笑脸 laptop」图标的墨线 G.ink #2f2f2f（屏幕边框 / 两只眼睛 / 微笑 / 键盘底线同一支墨，
//         翻转期的两个拖影残影也是同一个 <SmileLaptop>，一并跟随）
//   primary  = BRAND.amber #D3923C —— 全片唯一强调色（标志斜切），按规范明令保留字面量，故不挂位置
//   secondary= BRAND.ink #171714 —— 字标墨色；本仓 BRAND.name 已清空，字标默认无字形（仅用户填 brand 时出现），
//             且属品牌资产须与琥珀斜切同族，故不挂位置
// 结论：改底色改的是整块舞台，改墨色改的是画面主体图标的墨线；primary / secondary 两槽刻意留空
//（检查器里拖它们不会造假出画面变化），不替换任何品牌色、阴影色或渐变端点。
const PALETTE_FALLBACK = { bg: '#efefec', primary: '#D3923C', secondary: '#171714', ink: '#2f2f2f' };

const SmileLaptop: React.FC<{ size: number }> = ({ size }) => {
  // 图标墨线写在本子组件里，因此这里各自取一次同一份 fallback（与主组件同一 PALETTE_FALLBACK）
  const PAL = usePalette(PALETTE_FALLBACK);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <rect x={7} y={6} width={26} height={20} rx={3.5} fill="#fff" stroke={PAL.ink} strokeWidth={3} />
      <circle cx={15.5} cy={13.5} r={2} fill={PAL.ink} />
      <circle cx={24.5} cy={13.5} r={2} fill={PAL.ink} />
      <path d="M14 18.5 Q20 23.5 26 18.5" stroke={PAL.ink} strokeWidth={2.8} fill="none" strokeLinecap="round" />
      <path d="M3.5 31.5 L36.5 31.5" stroke={PAL.ink} strokeWidth={3.6} strokeLinecap="round" />
    </svg>
  );
};

const WORD = BRAND.name;

export const IconFlipBloomLogo: React.FC = () => {
  // 4 个配色槽位在主组件函数体顶层无条件挂载（底色在这里用；图标墨色写在 SmileLaptop 子组件里，
  // 那里另取一次同一 PALETTE_FALLBACK，写法与本批其余镜头一致）
  const PAL = usePalette(PALETTE_FALLBACK);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 用户可编辑参数：字标文案（品牌名）。默认留空 → 沿用 BRAND.name，默认画面零变化
  const userBrand = useShotProp('brand', '');
  const wordmark = userBrand || WORD;

  // ---- 时间轴 ----
  // 0–10: 图标登场（淡入微弹）
  // 12–34: anticipation 倾斜蓄力晃两下
  // 34–46: Y 轴翻转压扁成竖线（scaleX -> 0.04，带拖影）
  // 46–62: 翻过最薄处标志撑开（bloom 0->1 带过冲），53 起琥珀斜切划入
  // 64–100: mark 左移让位 + wordmark 逐字符方向模糊扫出
  const FLIP_START = 34;
  const FLIP_MID = 46;
  const BLOOM_END = 62;
  const WORD_START = 66;

  // 登场
  const inT = spring({ frame, fps, config: { damping: 13, stiffness: 140, mass: 0.8 } });

  // anticipation：两次倾斜摆动，幅度递增（-10° / +14°），最后向反方向压一下蓄力
  const wobble =
    interpolate(frame, [12, 18, 24, 30, FLIP_START], [0, -12, 14, -18, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.sin),
    });

  // 翻转前半：scaleX 1 -> 0.04（加速入），伴随拖影
  const flipIn = interpolate(frame, [FLIP_START, FLIP_MID], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const iconScaleX = interpolate(flipIn, [0, 1], [1, 0.04]);

  // 绽放：spring 过冲
  const bloomSpring = spring({
    frame: frame - FLIP_MID,
    fps,
    config: { damping: 11, stiffness: 130, mass: 0.9 },
  });
  const bloom = frame < FLIP_MID ? 0 : bloomSpring;
  // mark 从竖线厚度撑开：scaleX 0.04 -> 1
  const markScaleX = interpolate(bloom, [0, 1], [0.04, 1]);
  // 第二拍：琥珀斜切沿自身 45° 方向划入（取景框撑开过半后起步）
  const cut = frame < FLIP_MID + 7 ? 0 : spring({ frame: frame - FLIP_MID - 7, fps, config: { damping: 16, stiffness: 170 } });

  // mark 左移让位（wordmark 登场时）
  const shift = interpolate(frame, [WORD_START - 2, WORD_START + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const markX = interpolate(shift, [0, 1], [0, -471]); // 与字标起点 +187 耦合：lockup 整组视觉居中

  const showIcon = frame < FLIP_MID;

  // 拖影帧（翻转期间画 2 个残影）
  const ghosts = frame >= FLIP_START && frame < FLIP_MID ? [0.12, 0.24] : [];

  return (
    <AbsoluteFill style={{ background: G.bg, alignItems: 'center', justifyContent: 'center' }}>
      {/* 满版柔光浅底：默认（未传 colorTheme / customBg）原样铺 Backdrop 内置的三段渐变，逐字符相同 →
          默认画面零变化；用户改底色或选预设主题时才退成 PAL.bg 纯色，检查器改色真正可见。
          主光斑位置 / 琥珀余光 / 暗角 / 颗粒层保持原样。 */}
      <Backdrop
        tone="light"
        light={{ x: 0.5, y: 0.36 }}
        accent={BRAND.amber}
        style={{ background: PAL.isCustom ? PAL.bg : 'linear-gradient(180deg, #f6f6f4 0%, #efefec 55%, #e8e8e4 100%)' }}
      />
      {/* 接地软影：图标阶段随晃动偏移、翻扁时收窄，绽放后淡去（logo 是平面符号，不需要落地影） */}
      <div style={{
        position: 'absolute', left: 960 + markX - 150 * (showIcon ? iconScaleX : markScaleX) + wobble * 2.2, top: 540 + 150,
        width: 300 * (showIcon ? iconScaleX : markScaleX), height: 26, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(20,22,28,0.22) 0%, rgba(20,22,28,0) 70%)',
        opacity: inT * (1 - ramp(frame, FLIP_MID, 14, EASE.out)),
      }} />
      <div style={{ position: 'relative', width: 1920, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* 图标 / mark 容器 */}
        <div
          style={{
            position: 'absolute',
            left: 960 + markX,
            top: 200,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {showIcon ? (
            <>
              {ghosts.map((g, i) => {
                const gs = Math.min(1, iconScaleX + g);
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) scaleX(${gs})`,
                      opacity: 0.22 - i * 0.08,
                      filter: 'blur(6px)',
                    }}
                  >
                    <SmileLaptop size={340} />
                  </div>
                );
              })}
              <div
                style={{
                  transform: `scale(${inT}) rotate(${wobble}deg) scaleX(${iconScaleX})`,
                  transformOrigin: 'center 78%',
                  filter: flipIn > 0.3 ? `blur(${flipIn * 5}px)` : 'none',
                  opacity: inT,
                }}
              >
                <SmileLaptop size={340} />
              </div>
            </>
          ) : (
            <div style={{ transform: `scaleX(${markScaleX})` }}>
              <ShotcraftMark size={MARK} tone="light" cutProgress={cut} />
            </div>
          )}
        </div>

        {/* wordmark：逐字由大变小落位——大时模糊、落位清晰（scale + blur 联动），原点钉在基线 */}
        <div
          style={{
            position: 'absolute',
            left: 960 + markX + 187,
            top: 200,
            transform: 'translateY(-50%)',
            display: 'flex',
            fontFamily: BRAND.font,
            fontWeight: 700,
            fontSize: 112,
            lineHeight: 1,
            color: BRAND.ink,
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          }}
        >
          {wordmark.split('').map((ch, i) => {
            const st = WORD_START + i * 2.6; // 每字独立的"由大变小"动作，错峰拉到 2.6f 才读得清
            const cT = ramp(frame, st, 12, EASE.snappy);
            const op = ramp(frame, st, 5, EASE.out);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: op,
                  transform: `scale(${(1.9 - 0.9 * cT).toFixed(4)})`,
                  transformOrigin: '50% 78%',
                  filter: cT < 0.995 ? `blur(${((1 - cT) * 14).toFixed(2)}px)` : undefined,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
