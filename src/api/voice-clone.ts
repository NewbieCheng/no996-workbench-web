import type { ApiEnvelope } from './client';
import { v1Api } from './client';
import { throwApiError } from './errors';
import {
  isVoiceRenameEndpointMissing,
  writeLocalVoiceDisplayName,
} from '../lib/voice-display-name-local';

export type VoiceCloneRecord = {
  voice_id: string;
  display_name: string;
  target_model: string;
  language_hint?: string;
  status: number;
  provider_status: string;
  ready_for_synthesis: boolean;
  sample_bytes?: number;
  points_charged?: number;
  created_at?: string;
  updated_at?: string;
};

export type VoiceCloneMeta = {
  enabled: boolean;
  points_per_clone: number;
  max_voices_per_user: number;
  target_model: string;
  total: number;
  /** 现价（元），展示优先于 points_per_clone ÷ 100 */
  sale_price_yuan?: number;
  /** 划线原价（元） */
  list_price_yuan?: number;
  /** 兼容旧字段名 */
  price_yuan?: number;
  original_price_yuan?: number;
  sale_yuan?: number;
  list_yuan?: number;
};

export type VoiceCloneListResult = {
  data: VoiceCloneRecord[];
  meta: VoiceCloneMeta;
};

export async function listVoices(): Promise<VoiceCloneListResult> {
  try {
    const res = await v1Api.get<VoiceCloneListResult>('/audio/voices');
    return res.data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function createVoice(form: FormData): Promise<VoiceCloneRecord> {
  try {
    const res = await v1Api.post<ApiEnvelope<VoiceCloneRecord>>('/audio/voices', form);
    if (!res.data.data) throw new Error('创建音色失败：响应缺少 data');
    return res.data.data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function refreshVoice(voiceId: string): Promise<VoiceCloneRecord> {
  try {
    const res = await v1Api.post<ApiEnvelope<VoiceCloneRecord>>(`/audio/voices/${voiceId}/refresh`);
    if (!res.data.data) throw new Error('刷新音色状态失败');
    return res.data.data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function deleteVoice(voiceId: string): Promise<void> {
  try {
    await v1Api.delete(`/audio/voices/${voiceId}`);
  } catch (err) {
    throwApiError(err);
  }
}

export const VOICE_DISPLAY_NAME_MAX = 32;

export type VoiceDisplayNameUpdateResult = {
  record: VoiceCloneRecord;
  /** 已写入服务端；为 false 时表示仅本机显示名（后端 PATCH 未上线） */
  persistedRemote: boolean;
};

export async function updateVoiceDisplayName(
  voiceId: string,
  displayName: string,
  baseline?: VoiceCloneRecord,
): Promise<VoiceDisplayNameUpdateResult> {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('音色名称不能为空');
  const nextName = trimmed.slice(0, VOICE_DISPLAY_NAME_MAX);
  try {
    const res = await v1Api.patch<ApiEnvelope<VoiceCloneRecord>>(`/audio/voices/${voiceId}`, {
      display_name: nextName,
    });
    if (!res.data.data) throw new Error('重命名音色失败：响应缺少 data');
    return { record: res.data.data, persistedRemote: true };
  } catch (err) {
    if (baseline && isVoiceRenameEndpointMissing(err)) {
      writeLocalVoiceDisplayName(voiceId, nextName);
      return { record: { ...baseline, display_name: nextName }, persistedRemote: false };
    }
    throwApiError(err);
  }
}
