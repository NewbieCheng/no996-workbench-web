import { upgradeInsecureMediaUrl } from '../lib/secure-media-url.ts';

const EXPIRED_STORAGE_KEY = 'no996_expired_media_urls';
const expiredUrls = new Set<string>();

// 从 sessionStorage 恢复已探知的失效/404 媒体链接，避免页面跳转或刷新后再次发送无意义的网络请求
try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const saved = window.sessionStorage.getItem(EXPIRED_STORAGE_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      if (Array.isArray(list)) {
        list.forEach((u: string) => expiredUrls.add(u));
      }
    }
  }
} catch {}

export function markMediaUrlExpired(urlOrPath: string): void {
  if (!urlOrPath) return;
  expiredUrls.add(urlOrPath);
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(EXPIRED_STORAGE_KEY, JSON.stringify(Array.from(expiredUrls)));
    }
  } catch {}
}

export function isMediaUrlExpired(urlOrPath: string): boolean {
  if (!urlOrPath) return false;
  return expiredUrls.has(urlOrPath);
}

/** TTS 等接口返回的站内相对路径，如 /media/audio/xxx.wav */
export function resolveMediaUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path.startsWith('http://') ? upgradeInsecureMediaUrl(path) : path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}
