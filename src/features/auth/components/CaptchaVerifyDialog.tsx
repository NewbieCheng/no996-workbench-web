import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, type ApiEnvelope } from '@/api/client';
import { Button } from '@no996/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@no996/ui/dialog';
import { FieldError } from '@no996/ui/field';

export type CaptchaType = 'image' | 'math' | 'click';

const MAX_SEQUENCE_WRONG_ATTEMPTS = 2;

type CaptchaPayload = {
  id: string;
  type: CaptchaType;
  svg: string;
  prompt?: string;
  icon_target?: string;
  sequence?: string[];
};

type PickMarker = {
  id: string;
  order: number;
  x: number;
  y: number;
};

interface CaptchaVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (captchaId: string, captchaCode: string) => void;
}

function isSequencePrompt(prompt: string): boolean {
  return prompt === 'click_sequence' || prompt === 'click_size_asc' || prompt === 'click_size_desc';
}

function fillCaptchaViewport(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/, (_tag, attributes: string) => {
    const nextAttributes = /\spreserveAspectRatio\s*=/.test(attributes)
      ? attributes.replace(/\spreserveAspectRatio\s*=\s*(["']).*?\1/, ' preserveAspectRatio="none"')
      : `${attributes} preserveAspectRatio="none"`;
    return `<svg${nextAttributes}>`;
  });
}

export function CaptchaVerifyDialog({ open, onOpenChange, onSuccess }: CaptchaVerifyDialogProps) {
  const { t } = useTranslation('login');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [prompt, setPrompt] = useState('');
  const [iconTarget, setIconTarget] = useState('');
  const [sequence, setSequence] = useState<string[]>([]);
  const [clicks, setClicks] = useState<string[]>([]);
  const [pickMarkers, setPickMarkers] = useState<PickMarker[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrongAttemptsRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const expectedSteps = useMemo(() => {
    if (prompt === 'click_sequence') return sequence.length;
    if (prompt === 'click_size_asc' || prompt === 'click_size_desc') return 4;
    return 1;
  }, [prompt, sequence.length]);

  const promptHint = useMemo(() => {
    const iconLabel = t(`captchaIcon.${iconTarget || 'fish'}`);
    switch (prompt) {
      case 'click_largest':
        return t('captchaPromptLargest', { icon: iconLabel });
      case 'click_smallest':
        return t('captchaPromptSmallest', { icon: iconLabel });
      case 'click_second_smallest':
        return t('captchaPromptSecondSmallest', { icon: iconLabel });
      case 'click_icon':
        return t('captchaPromptIcon', { icon: iconLabel });
      case 'click_sequence':
        return t('captchaPromptSequence');
      case 'click_size_asc':
        return t('captchaPromptSizeAsc', { icon: iconLabel });
      case 'click_size_desc':
        return t('captchaPromptSizeDesc', { icon: iconLabel });
      default:
        return t('captchaClickDesc');
    }
  }, [iconTarget, prompt, t]);

  const resetPickState = useCallback(() => {
    setClicks([]);
    setPickMarkers([]);
    wrongAttemptsRef.current = 0;
    setWrongAttempts(0);
    setError('');
  }, []);

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    resetPickState();
    try {
      const res = await api.get<ApiEnvelope<CaptchaPayload>>('/auth/captcha?type=click');
      const data = res.data.data;
      if (!data?.id || !data.svg) {
        setError(t('captchaLoadFailed'));
        return;
      }
      setCaptchaId(data.id);
      setCaptchaSvg(fillCaptchaViewport(data.svg));
      setPrompt(data.prompt ?? '');
      setIconTarget(data.icon_target ?? '');
      setSequence(data.sequence ?? []);
    } catch {
      setError(t('captchaLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [resetPickState, t]);

  useEffect(() => {
    if (open) {
      void loadCaptcha();
    }
  }, [open, loadCaptcha]);

  const complete = (code: string) => {
    onSuccess(captchaId, code);
    onOpenChange(false);
    resetPickState();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetPickState();
    onOpenChange(next);
  };

  const addPickMarker = (target: Element, id: string, order: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const targetRect = target.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    setPickMarkers((prev) => [
      ...prev,
      {
        id,
        order,
        x: targetRect.left - stageRect.left + targetRect.width / 2,
        y: targetRect.top - stageRect.top + targetRect.height / 2,
      },
    ]);
    target.classList.add('captcha-target--picked');
  };

  const handleSequenceWrong = () => {
    const nextWrong = wrongAttemptsRef.current + 1;
    wrongAttemptsRef.current = nextWrong;
    setWrongAttempts(nextWrong);
    setClicks([]);
    setPickMarkers([]);
    stageRef.current?.querySelectorAll('.captcha-target--picked').forEach((node) => {
      node.classList.remove('captcha-target--picked');
    });
    if (nextWrong >= MAX_SEQUENCE_WRONG_ATTEMPTS) {
      setError(t('captchaSequenceRefresh'));
      void loadCaptcha();
      return;
    }
    setError(t('captchaSequenceWrong'));
  };

  const handleSvgClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (loading) return;
    const target = (event.target as HTMLElement).closest('[data-captcha-id]');
    if (!target) return;
    const id = target.getAttribute('data-captcha-id');
    const kind = target.getAttribute('data-captcha-kind') ?? '';
    if (!id) return;

    if (!isSequencePrompt(prompt)) {
      addPickMarker(target, id, 1);
      window.setTimeout(() => complete(id), 180);
      return;
    }

    if (clicks.includes(id)) return;

    if (prompt === 'click_sequence') {
      const expectedKind = sequence[clicks.length];
      if (expectedKind && kind !== expectedKind) {
        handleSequenceWrong();
        return;
      }
    }

    const next = [...clicks, id];
    addPickMarker(target, id, next.length);
    setClicks(next);
    setError('');

    if (next.length >= expectedSteps) {
      window.setTimeout(() => complete(next.join(',')), 220);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t('captchaTitle')}
        </DialogTitle>
        <DialogDescription>{t('captchaDesc')}</DialogDescription>

        <div className="space-y-3 py-2">
          <p className="text-sm font-medium text-foreground">{promptHint}</p>

          {prompt === 'click_sequence' && sequence.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {sequence.map((kind, index) => (
                <span
                  key={`${kind}-${index}`}
                  className={`captcha-idiom-chip ${index < clicks.length ? 'is-done' : index === clicks.length ? 'is-next' : ''}`}
                >
                  {index + 1}. {t(`captchaIcon.${kind}`)}
                </span>
              ))}
            </div>
          )}

          {(prompt === 'click_size_asc' || prompt === 'click_size_desc') && (
            <p className="text-xs text-muted-foreground">
              {t('captchaSequenceProgress', { current: clicks.length, total: expectedSteps })}
            </p>
          )}

          {wrongAttempts > 0 && wrongAttempts < MAX_SEQUENCE_WRONG_ATTEMPTS && (
            <p className="text-xs text-muted-foreground">
              {t('captchaSequenceAttemptsLeft', {
                left: MAX_SEQUENCE_WRONG_ATTEMPTS - wrongAttempts,
              })}
            </p>
          )}

          <div className="flex items-center justify-center gap-2">
            <div
              ref={stageRef}
              className="captcha-click-stage relative flex min-h-[260px] flex-1 items-center justify-center rounded-lg border bg-muted/20 p-2"
              onClick={handleSvgClick}
              role="presentation"
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div
                    className="captcha-click-svg absolute inset-px"
                    dangerouslySetInnerHTML={{ __html: captchaSvg }}
                  />
                  {pickMarkers.map((marker) => (
                    <span
                      key={`${marker.id}-${marker.order}`}
                      className="captcha-pick-check"
                      style={{ left: marker.x, top: marker.y }}
                      aria-hidden
                    >
                      <Check className="size-4 stroke-[3]" />
                    </span>
                  ))}
                </>
              )}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => void loadCaptcha()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          <FieldError>{error}</FieldError>
        </div>
      </DialogContent>
    </Dialog>
  );
}
