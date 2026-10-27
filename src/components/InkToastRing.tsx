import { cn } from '@no996/ui/utils'

export type InkToastGlyph = 'ok' | 'err' | 'warn' | 'info' | 'loading'

const paths: Record<Exclude<InkToastGlyph, 'loading'>, string> = {
  ok: 'M5.5 12.5l4.2 4.2 8.8-9',
  err: 'M8 8l8 8M16 8l-8 8',
  warn: 'M12 6.5v7M12 17.4v.1',
  info: 'M12 11v6M12 7.4v.1',
}

type Props = {
  glyph: InkToastGlyph
  className?: string
}

export function InkToastRing({ glyph, className }: Props) {
  const spin = glyph === 'loading'
  return (
    <span
      className={cn('ink-toast__ring', spin && 'ink-toast__ring--spin', className)}
      aria-hidden
    >
      {glyph !== 'loading' ? (
        <svg className="ink-toast__glyph" viewBox="0 0 24 24">
          <path d={paths[glyph]} />
        </svg>
      ) : null}
    </span>
  )
}
