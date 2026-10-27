export function AlignLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <rect x="5" y="4" width="8" height="3" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="5" y="9" width="5" height="3" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function AlignCenterHorizontalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="1" x2="8" y2="15" strokeDasharray="1.5 1.5" />
      <rect x="2.5" y="4" width="11" height="3" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="4.5" y="9" width="7" height="3" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function AlignRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="14" y1="2" x2="14" y2="14" />
      <rect x="3" y="4" width="8" height="3" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="6" y="9" width="5" height="3" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function AlignTopIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="14" y2="2" />
      <rect x="4" y="5" width="3" height="8" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="9" y="5" width="3" height="5" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function AlignMiddleVerticalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="8" x2="15" y2="8" strokeDasharray="1.5 1.5" />
      <rect x="4" y="2.5" width="3" height="11" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="9" y="4.5" width="3" height="7" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function AlignBottomIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="4" y="3" width="3" height="8" rx="1" fill="currentColor" fillOpacity="0.2" />
      <rect x="9" y="6" width="3" height="5" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function DistributeHorizontalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="2" y2="14" />
      <line x1="14" y1="2" x2="14" y2="14" />
      <rect x="6" y="5" width="4" height="6" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function DistributeVerticalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="14" y2="2" />
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="5" y="6" width="6" height="4" rx="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  )
}

export function AlignCenterAllIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" strokeDasharray="2 2" />
      <rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  )
}

export function LinkChainIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1" />
      <path d="M9.5 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1" />
    </svg>
  )
}

export function UnlinkChainIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5a3 3 0 0 0 3 0" opacity="0.6" />
      <path d="M12.5 7.5a3 3 0 0 0-4.24-4.24l-1 1" />
      <path d="M3.5 8.5a3 3 0 0 0 4.24 4.24l1-1" />
      <line x1="2" y1="2" x2="14" y2="14" strokeWidth="1.6" />
    </svg>
  )
}

export function RotateCw90Icon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 6.5A5.5 5.5 0 1 0 14 8h-2" />
      <polyline points="11 4 14 6.5 11 9" />
    </svg>
  )
}

export function ResetCcwIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 9.5A5.5 5.5 0 1 0 2 8h2" />
      <polyline points="5 12 2 9.5 5 7" />
    </svg>
  )
}

export function VolumeMuteIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="2 6 5 6 9 3 9 13 5 10 2 10 2 6" fill="currentColor" fillOpacity="0.2" />
      <line x1="11" y1="6" x2="15" y2="10" />
      <line x1="15" y1="6" x2="11" y2="10" />
    </svg>
  )
}

export function VolumeHighIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="2 6 5 6 9 3 9 13 5 10 2 10 2 6" fill="currentColor" fillOpacity="0.2" />
      <path d="M12 5a4 4 0 0 1 0 6" />
      <path d="M14 3a7 7 0 0 1 0 10" />
    </svg>
  )
}

export function KeyboardIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3.5" width="12" height="9" rx="2" />
      <line x1="4.5" y1="6" x2="5.5" y2="6" />
      <line x1="7.5" y1="6" x2="8.5" y2="6" />
      <line x1="10.5" y1="6" x2="11.5" y2="6" />
      <line x1="5.5" y1="9" x2="10.5" y2="9" />
    </svg>
  )
}

export function SlidersIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="13" x2="3" y2="8" />
      <line x1="3" y1="5" x2="3" y2="2" />
      <line x1="8" y1="13" x2="8" y2="10" />
      <line x1="8" y1="7" x2="8" y2="2" />
      <line x1="13" y1="13" x2="13" y2="6" />
      <line x1="13" y1="3" x2="13" y2="2" />
      <circle cx="3" cy="6.5" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8.5" r="1.5" fill="currentColor" />
      <circle cx="13" cy="4.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function SparklesIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.3 3.3L12.5 6.5 9.3 8 8 11.2 6.7 8 3.5 6.5l3.2-1.2L8 2z" fill="currentColor" fillOpacity="0.25" />
      <path d="M12.5 10.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z" fill="currentColor" fillOpacity="0.35" />
      <path d="M3.5 10.5l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1z" fill="currentColor" fillOpacity="0.35" />
    </svg>
  )
}

export function WandIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2.5l4 4-8.5 8.5H1v-4l8.5-8.5z" />
      <line x1="8" y1="4" x2="12" y2="8" />
      <line x1="2.5" y1="2.5" x2="2.5" y2="3.5" />
      <line x1="5.5" y1="1.5" x2="5.5" y2="2.5" />
      <line x1="1.5" y1="5.5" x2="2.5" y2="5.5" />
    </svg>
  )
}

export function PaletteIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5C4.4 1.5 1.5 4.4 1.5 8c0 2 1.3 3.7 3.2 4.3.4.1.7-.2.7-.6v-.8c0-.6.5-1.1 1.1-1.1h1.3c2.6 0 4.7-2.1 4.7-4.7 0-2-1.6-3.6-4.5-3.6z" />
      <circle cx="4.5" cy="5.5" r="1" fill="currentColor" />
      <circle cx="7.5" cy="4.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="6" r="1" fill="currentColor" />
    </svg>
  )
}

export function CompassIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <polygon points="10.5 5.5 9 10 5.5 10.5 7 6 10.5 5.5" fill="currentColor" fillOpacity="0.25" />
    </svg>
  )
}

export function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
      <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
    </svg>
  )
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 8.5 6.5 12 13 4" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 6 8 10 12 6" />
    </svg>
  )
}

export function ChevronUpIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 10 8 6 12 10" />
    </svg>
  )
}

export function EditIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z" />
    </svg>
  )
}

export function LayoutIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <line x1="2" y1="6.5" x2="14" y2="6.5" />
      <line x1="7" y1="6.5" x2="7" y2="14" />
    </svg>
  )
}

