import './media-generation-stage.css';
import * as React from 'react';
import { cn } from './utils';
import { Button } from './button';

export type MediaGenerationKind = 'image' | 'video' | 'audio';
export type MediaGenerationStagePhase = 'idle' | 'running' | 'success' | 'error';

export interface MediaGenerationStageLabels {
  steps: readonly string[];
  leaveHint?: string;
  interrupted?: string;
  failed?: string;
  idleHint?: string;
  retry?: string;
}

const DEFAULT_STEPS: Record<MediaGenerationKind, readonly string[]> = {
  image: ['理解提示词', '构图中', '细化细节', '最后润色'],
  video: ['理解提示词', '生成关键帧', '补全动态', '合成视频'],
  audio: ['理解文本', '合成声线', '调整韵律', '输出音频'],
};

const GRID_DELAYS = Array.from({ length: 108 }, (_, index) =>
  `${((index * 0.023) % 2.4).toFixed(2)}s`,
);

const WAVE_DELAYS = Array.from({ length: 36 }, (_, index) =>
  `${(index * 0.07).toFixed(2)}s`,
);

function resolveLabels(
  kind: MediaGenerationKind,
  labels?: Partial<MediaGenerationStageLabels>,
): MediaGenerationStageLabels {
  return {
    steps: labels?.steps ?? DEFAULT_STEPS[kind],
    leaveHint: labels?.leaveHint,
    interrupted: labels?.interrupted,
    failed: labels?.failed,
    idleHint: labels?.idleHint,
    retry: labels?.retry ?? '重试',
  };
}

function StageBackdrop({
  kind,
  paused: _paused,
}: {
  kind: MediaGenerationKind;
  paused: boolean;
}) {
  if (kind === 'image') {
    return (
      <>
        <div className="media-gen-stage__grid" aria-hidden>
          {GRID_DELAYS.map((delay, index) => (
            <i
              key={index}
              className="media-gen-stage__grid-cell"
              style={{ animationDelay: delay }}
            />
          ))}
        </div>
        <div className="media-gen-stage__sheen" aria-hidden />
      </>
    );
  }
  if (kind === 'video') {
    return (
      <>
        <div className="media-gen-stage__film" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <i key={index} className="media-gen-stage__film-frame" />
          ))}
        </div>
        <div className="media-gen-stage__sheen" aria-hidden />
      </>
    );
  }
  return (
    <div className="media-gen-stage__wave" aria-hidden>
      {WAVE_DELAYS.map((delay, index) => (
        <i
          key={index}
          className="media-gen-stage__wave-bar"
          style={{ animationDelay: delay }}
        />
      ))}
    </div>
  );
}

const ErrorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 7v6M12 16.5v.5" />
  </svg>
);

export function MediaGenerationStage({
  kind,
  phase,
  startedAt = null,
  errorMessage,
  onRetry,
  className,
  labels: labelsProp,
  showMeta = true,
}: {
  kind: MediaGenerationKind;
  phase: MediaGenerationStagePhase;
  startedAt?: number | null;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
  labels?: Partial<MediaGenerationStageLabels>;
  showMeta?: boolean;
}) {
  const labels = resolveLabels(kind, labelsProp);
  const [percent, setPercent] = React.useState(0);
  const [displayPhase, setDisplayPhase] = React.useState(phase);
  const frozenPercent = React.useRef(0);

  React.useEffect(() => {
    if (phase === 'running') {
      setDisplayPhase('running');
      if (startedAt !== null) {
        setPercent(0);
      }
      return;
    }
    if (phase === 'success') {
      frozenPercent.current = percent;
      setPercent(100);
      const timer = window.setTimeout(() => setDisplayPhase('success'), 450);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'error') {
      frozenPercent.current = percent;
      setDisplayPhase('error');
      return;
    }
    setDisplayPhase(phase);
    setPercent(0);
  }, [phase, startedAt]);

  React.useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      setPercent((current) => {
        const next = current + (99 - current) * 0.018 * (0.5 + Math.random());
        return next > 98.9 ? 98.9 : next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  const stepIndex = Math.min(labels.steps.length - 1, Math.floor(percent / 25));
  const stepText = labels.steps[stepIndex] ?? labels.steps[0] ?? '';
  const showRunningMeta = displayPhase === 'running' || displayPhase === 'success';
  const showErrorMeta = displayPhase === 'error';
  const trackPercent = displayPhase === 'error'
    ? frozenPercent.current
    : displayPhase === 'success'
      ? 100
      : percent;
  const displayPercentText = displayPhase === 'success'
    ? '100.00'
    : Math.min(99, Math.max(0, showErrorMeta ? frozenPercent.current : percent)).toFixed(2);

  const paused = displayPhase === 'error';

  return (
    <div
      className={cn(
        'media-gen-stage',
        kind === 'audio' && 'media-gen-stage--audio',
        paused && 'media-gen-stage--paused',
        className,
      )}
      data-media-generation-stage={kind}
      data-phase={displayPhase}
      role={displayPhase === 'running' ? 'status' : undefined}
      aria-busy={displayPhase === 'running' ? true : undefined}
    >
      <div className="media-gen-stage__viewport">
        {displayPhase === 'idle' ? (
          <span className="media-gen-stage__idle">{labels.idleHint ?? ''}</span>
        ) : (
          <>
            <StageBackdrop kind={kind} paused={paused} />
            {showErrorMeta ? (
              <div className="media-gen-stage__error-overlay" role="alert">
                <ErrorIcon />
                <b>{labels.failed ?? '生成失败'}</b>
                {errorMessage ? (
                  <span className="media-gen-stage__error-detail">{errorMessage}</span>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {showMeta && displayPhase !== 'idle' ? (
        <>
          {showRunningMeta || showErrorMeta ? (
            <div className="media-gen-stage__meta">
              <div
                className={cn(
                  'media-gen-stage__pct',
                  showErrorMeta && 'media-gen-stage__pct--error',
                )}
              >
                {displayPercentText}
                <small>%</small>
              </div>
              <div
                className={cn(
                  'media-gen-stage__status',
                  showErrorMeta && 'media-gen-stage__status--error',
                )}
              >
                {showRunningMeta ? (
                  <>
                    <span className="media-gen-stage__status-dot" aria-hidden />
                    <span>{stepText}</span>
                  </>
                ) : (
                  <span>{labels.interrupted ?? labels.failed ?? '已中断'}</span>
                )}
              </div>
            </div>
          ) : null}

          {(showRunningMeta || showErrorMeta) ? (
            <div className="media-gen-stage__track" aria-hidden>
              <div
                className={cn(
                  'media-gen-stage__fill',
                  displayPhase === 'success' && 'media-gen-stage__fill--done',
                  showErrorMeta && 'media-gen-stage__fill--error',
                )}
                style={{ width: `${trackPercent}%` }}
              />
            </div>
          ) : null}

          {displayPhase === 'running' && labels.leaveHint ? (
            <p className="media-gen-stage__hint">{labels.leaveHint}</p>
          ) : null}

          {showErrorMeta && onRetry ? (
            <div className="media-gen-stage__actions">
              <Button type="button" size="sm" onClick={onRetry}>
                {labels.retry}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
