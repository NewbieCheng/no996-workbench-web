/**
 * @file extension-client.ts
 * 不加班工作台网页端与知源插件通信的轻量客户端
 */

import {
  WORKBENCH_BRIDGE_PROTOCOL_VERSION,
  WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_PAGE,
  WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_EXTENSION,
  type WorkbenchBridgeAccountSummary,
  type WorkbenchBridgeCollectedItem,
  type WorkbenchBridgeMethod,
  type WorkbenchBridgeKeywordCaptureFilters,
  type WorkbenchBridgePlatformId,
  type WorkbenchBridgeRequestPayloadMap,
  type WorkbenchBridgeResponsePayloadMap,
  type WorkbenchBridgeStatus,
  type WorkbenchBridgeWindowRequest,
  type WorkbenchBridgeWindowResponse,
} from './workbench-bridge-contract';

export class ExtensionClient {
  private timeoutMs = 25000;

  async request<M extends WorkbenchBridgeMethod>(
    method: M,
    payload: WorkbenchBridgeRequestPayloadMap[M],
    timeoutMs = this.timeoutMs,
  ): Promise<WorkbenchBridgeResponsePayloadMap[M]> {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const handler = (event: MessageEvent) => {
        if (event.source !== window || event.origin !== window.location.origin) return;
        const resp = event.data as WorkbenchBridgeWindowResponse<M> | undefined;
        if (!resp || typeof resp !== 'object') return;
        if (resp.source !== WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_EXTENSION) return;
        if (resp.requestId !== requestId || resp.method !== method || resp.protocolVersion !== WORKBENCH_BRIDGE_PROTOCOL_VERSION) return;

        window.removeEventListener('message', handler);
        if (timer) clearTimeout(timer);

        if (resp.ok && resp.data) {
          resolve(resp.data);
        } else {
          reject(new Error(resp.error || '插件处理请求失败'));
        }
      };

      window.addEventListener('message', handler);

      const req: WorkbenchBridgeWindowRequest<M> = {
        source: WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_PAGE,
        protocolVersion: WORKBENCH_BRIDGE_PROTOCOL_VERSION,
        requestId,
        method,
        payload,
      };

      window.postMessage(req, '*');

      timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('等待插件响应超时，请确认是否已安装并启用知源扩展'));
      }, timeoutMs);
    });
  }

  async checkStatus(timeoutMs = 1000): Promise<WorkbenchBridgeStatus> {
    try {
      return await this.request('connection.getStatus', {}, timeoutMs);
    } catch {
      return {
        connected: false,
        extensionVersion: '',
        protocolVersion: WORKBENCH_BRIDGE_PROTOCOL_VERSION,
        supportedPlatforms: [],
      };
    }
  }

  async listAccounts(): Promise<WorkbenchBridgeAccountSummary[]> {
    const resp = await this.request('accounts.list', {});
    return resp.accounts;
  }

  async connectAccount(platformId: WorkbenchBridgePlatformId): Promise<{ ok: boolean; message?: string }> {
    return await this.request('accounts.connect', { platformId });
  }

  async resolveWork(url: string): Promise<WorkbenchBridgeCollectedItem> {
    const resp = await this.request('collection.resolve', { url });
    if (!resp.ok || !resp.item) {
      throw new Error(resp.error || '未能成功采集该链接内容');
    }
    return resp.item;
  }

  async searchWorks(params: {
    platformId: WorkbenchBridgePlatformId;
    keyword: string;
    limit: number;
    filters?: WorkbenchBridgeKeywordCaptureFilters;
  }): Promise<WorkbenchBridgeCollectedItem[]> {
    const resp = await this.request('collection.search', params, 120000);
    if (!resp.ok || !resp.items) {
      throw new Error(resp.error || '关键词抓取失败');
    }
    return resp.items;
  }

  async fetchAsset(url: string): Promise<{ blob: Blob; mime: string }> {
    const resp = await this.request('asset.fetch', { url }, 60000);
    if (!resp.ok || !resp.blobBase64) {
      throw new Error(resp.error || '无法拉取远程素材');
    }
    const mime = resp.mime || 'application/octet-stream';
    const binary = atob(resp.blobBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { blob: new Blob([bytes], { type: mime }), mime };
  }

  async checkChannelAuth(channelIds: string[]) {
    const resp = await this.request('channels.checkAuth', { channelIds });
    return resp.statuses;
  }

  async publishStart(payload: WorkbenchBridgeRequestPayloadMap['publish.start']) {
    return await this.request('publish.start', payload);
  }
}

export const extensionClient = new ExtensionClient();
