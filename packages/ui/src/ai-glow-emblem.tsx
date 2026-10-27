import { cn } from '@no996/ui/utils';

export interface AIGlowEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  floating?: boolean;
  withAura?: boolean;
  withMotes?: boolean;
  className?: string;
  ['aria-label']?: string;
}

/**
 * 现代发光 3D 晶体星核徽标 (AI Glow Emblem)
 * 具备微立体透视、环境光晕呼吸、璀璨四芒星核与浮动光粒子。
 */
export function AIGlowEmblem({
  size = 'md',
  floating = true,
  withAura = true,
  withMotes = true,
  className,
  'aria-label': ariaLabel = '智能核心加载中',
}: AIGlowEmblemProps) {
  return (
    <div
      className={cn(
        'ai-glow-emblem',
        `ai-glow-emblem--${size}`,
        floating && 'ai-glow-emblem--floating',
        className,
      )}
      role="img"
      aria-label={ariaLabel}
    >
      {/* 柔和环境光晕 */}
      {withAura ? <div className="ai-glow-emblem__aura" aria-hidden="true" /> : null}

      {/* 环绕漂浮光粒子 */}
      {withMotes ? (
        <>
          <span className="ai-glow-emblem__mote ai-glow-emblem__mote--1" aria-hidden="true" />
          <span className="ai-glow-emblem__mote ai-glow-emblem__mote--2" aria-hidden="true" />
          <span className="ai-glow-emblem__mote ai-glow-emblem__mote--3" aria-hidden="true" />
        </>
      ) : null}

      {/* 悬浮微立体卡片外壳 */}
      <div className="ai-glow-emblem__shell">
        <div className="ai-glow-emblem__tile">
          <div className="ai-glow-emblem__gloss" aria-hidden="true" />

          {/* 辅星 */}
          <div className="ai-glow-emblem__sparkle-sub" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L13.8 8.8C14.2 10.2 15.3 11.3 16.7 11.7L23.5 13.5L16.7 15.3C15.3 15.7 14.2 16.8 13.8 18.2L12 25L10.2 18.2C9.8 16.8 8.7 15.7 7.3 15.3L0.5 13.5L7.3 11.7C8.7 11.3 9.8 10.2 10.2 8.8L12 2Z" />
            </svg>
          </div>

          {/* 核心主四芒星 */}
          <div className="ai-glow-emblem__star">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="emblemStarGrad" x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#e0e7ff" />
                  <stop offset="100%" stopColor="#c7d2fe" />
                </linearGradient>
                <radialGradient id="emblemCoreGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* 四芒星主轮廓 */}
              <path
                d="M18 2.5C18.4 10.2 24.8 16.6 32.5 17C32.9 17 33.2 17.5 33.2 18C33.2 18.5 32.9 19 32.5 19C24.8 19.4 18.4 25.8 18 33.5C18 33.9 17.5 34.2 17 34.2C16.5 34.2 16 33.9 16 33.5C15.6 25.8 9.2 19.4 1.5 19C1.1 19 0.8 18.5 0.8 18C0.8 17.5 1.1 17 1.5 17C9.2 16.6 15.6 10.2 16 2.5C16 2.1 16.5 1.8 17 1.8C17.5 1.8 18 2.1 18 2.5Z"
                fill="url(#emblemStarGrad)"
              />

              {/* 中心高光能量核 */}
              <circle cx="17" cy="18" r="4.5" fill="url(#emblemCoreGlow)" />
              <circle cx="17" cy="18" r="2" fill="#ffffff" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
