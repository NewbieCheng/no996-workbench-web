import { api } from './client';
import { throwApiError } from './errors';

/**
 * 语音合成请求超时时间（毫秒）。
 * 长文本（如 4000~10000 字）生成耗时较长，与后端 HTTP_WRITE_TIMEOUT (600s) 对齐为 10 分钟。
 */
export const SPEECH_REQUEST_TIMEOUT_MS = 600_000;

export type CreateSpeechParams = {
  input: string;
  voice: string;
  rate?: number;
  volume?: number;
  pitch?: number;
  instruction?: string;
  response_format?: string;
};

export type CreateSpeechResult = {
  /** Same-origin path served by the platform, e.g. /media/audio/….wav */
  url: string;
  /** DashScope / OSS direct link when the upstream returned a URL (expires ~24h). */
  source_url?: string;
};

export async function createSpeech(params: CreateSpeechParams, signal?: AbortSignal): Promise<CreateSpeechResult> {
  const body: Record<string, unknown> = {
    input: params.input,
    voice: params.voice,
    response_format: params.response_format ?? 'wav',
  };
  if (params.rate !== undefined) body.rate = params.rate;
  if (params.volume !== undefined) body.volume = params.volume;
  if (params.pitch !== undefined) body.pitch = params.pitch;
  if (params.instruction?.trim()) body.instruction = params.instruction.trim();

  try {
    const res = await api.post<CreateSpeechResult>('/ai/audio/speech', body, {
      timeout: SPEECH_REQUEST_TIMEOUT_MS,
      signal,
    });
    if (!res.data?.url) throw new Error('语音合成失败：未返回音频地址');
    return res.data;
  } catch (err) {
    throwApiError(err);
  }
}
