import type { LucideIcon } from 'lucide-react'
import { assetUrl } from '../services/browser'

type Props = {
  icon: LucideIcon
  brandSrc?: string
}

export function WorkbenchNavIcon({ icon: Icon, brandSrc }: Props) {
  if (brandSrc) {
    return (
      <img
        src={assetUrl(brandSrc)}
        alt=""
        width={16}
        height={16}
        className="wb-nav-item__icon wb-nav-item__icon--brand"
        aria-hidden="true"
        decoding="async"
      />
    )
  }
  return <Icon size={16} strokeWidth={1.75} className="wb-nav-item__icon" />
}
