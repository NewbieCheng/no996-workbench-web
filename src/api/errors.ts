import axios from 'axios';
import type { ApiEnvelope } from './client';

export class ApiError extends Error {
  code: string;
  status: number;
  traceId?: string;

  constructor(code: string, status: number, message: string, traceId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.traceId = traceId;
  }
}

export function parseApiError(err: unknown): ApiError | null {
  if (!axios.isAxiosError(err)) return null;
  const status = err.response?.status ?? 0;
  const body = err.response?.data as ApiEnvelope<unknown> | { error?: { code?: string; message?: string } } | undefined;
  const code = body?.error?.code ?? (status ? `HTTP_${status}` : 'NETWORK_ERROR');
  let message = body?.error?.message ?? err.message;
  if (err.code === 'ECONNABORTED' || /timeout of \d+ms exceeded/i.test(err.message)) {
    message = '语音生成耗时较长，请求已超时。长文本已将超时预算放宽至 10 分钟，请稍后重试。';
  } else if (status === 504) {
    message = '网关超时（504）：上游生成耗时较长或正在排队，请稍候片刻重试。';
  } else if (status === 402 && code === 'BALANCE_INSUFFICIENT') {
    message = `${message} 请前往「账号与资产」查看余额。`;
  }
  const traceId = (body as ApiEnvelope<unknown> | undefined)?.trace_id;
  return new ApiError(code, status, message, traceId);
}

export function throwApiError(err: unknown): never {
  const parsed = parseApiError(err);
  if (parsed) throw parsed;
  if (err instanceof Error) throw err;
  throw new Error('请求失败');
}
