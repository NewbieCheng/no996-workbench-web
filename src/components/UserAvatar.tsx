import { assetUrl } from '../services/browser'

/** 与桌面端 shell 品牌默认头像一致（avatar-jinri 系列）。 */
export const DEFAULT_USER_AVATAR_SRC = assetUrl('brand/avatar-jinri-64.svg')

type UserAvatarProps = {
  className?: string
  alt?: string
}

export function UserAvatar({ className = 'wb-avatar', alt = '' }: UserAvatarProps) {
  return (
    <span className={className}>
      <img src={DEFAULT_USER_AVATAR_SRC} alt={alt} width={64} height={64} decoding="async" />
    </span>
  )
}
