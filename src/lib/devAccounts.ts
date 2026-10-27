import type { LoginIntent } from '@/features/auth/components/LoginIntentSegment';

export interface DemoAccount {
  credential: string;
  password: string;
}

// 演示账号只在本机开发时用于预填登录表单。仓库里不保存任何账号密码：
// 真实值写在 .env.development.local（已忽略，不入库），未配置时保持空白、不预填。
const env = import.meta.env;

const DEMO_ACCOUNTS: Record<LoginIntent, DemoAccount> = {
  platform: {
    credential: env.VITE_DEMO_PLATFORM_USER ?? '',
    password: env.VITE_DEMO_PLATFORM_PASSWORD ?? '',
  },
  enterprise: {
    credential: env.VITE_DEMO_ENTERPRISE_USER ?? '',
    password: env.VITE_DEMO_ENTERPRISE_PASSWORD ?? '',
  },
  personal: {
    credential: env.VITE_DEMO_PERSONAL_USER ?? '',
    password: env.VITE_DEMO_PERSONAL_PASSWORD ?? '',
  },
};

export function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host === '::1' ||
    host.endsWith('.localhost')
  );
}

export function demoAccountFor(intent: LoginIntent): DemoAccount {
  return DEMO_ACCOUNTS[intent];
}

export function matchingDemoCredential(credential: string): DemoAccount | undefined {
  if (!credential.trim()) return undefined;
  return Object.values(DEMO_ACCOUNTS).find((a) => a.credential && a.credential === credential);
}

export function matchingDemoPassword(password: string): DemoAccount | undefined {
  if (!password) return undefined;
  return Object.values(DEMO_ACCOUNTS).find((a) => a.password && a.password === password);
}
