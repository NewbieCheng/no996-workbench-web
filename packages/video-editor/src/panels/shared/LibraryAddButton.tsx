import React from 'react'
import { Plus } from 'lucide-react'

export type LibraryAddButtonProps = {
  onClick: (event: React.MouseEvent) => void
  label: string
  className?: string
}

export function LibraryAddButton({ onClick, label, className }: LibraryAddButtonProps) {
  return (
    <button
      type="button"
      className={className ?? 'vf-lib-add'}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Plus className="size-3" strokeWidth={2.5} aria-hidden />
    </button>
  )
}
