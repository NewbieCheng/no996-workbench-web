/**
 * @file workbench-bridge-contract.ts
 * 不加班工作台端对应的扩展桥接类型定义与协议常量
 */

export const WORKBENCH_BRIDGE_PROTOCOL_VERSION = '1.1.0';

export const WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_PAGE = 'no996-workbench-web';
export const WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_EXTENSION = 'no996-social-copilot-extension';

export type WorkbenchBridgePlatformId = 'douyin' | 'xiaohongshu' | 'bilibili' | 'weixin';

export interface WorkbenchBridgeAccountSummary {
  platformId: WorkbenchBridgePlatformId;
  displayName: string;
  accountIdentifier?: string;
  avatarUrl?: string;
  avatarThumbnailDataUrl?: string;
  profileUrl?: string;
  status: 'logged_in' | 'login_required' | 'unknown';
  message?: string;
}

export interface WorkbenchBridgeStatus {
  connected: boolean;
  extensionVersion: string;
  protocolVersion: string;
  supportedPlatforms: WorkbenchBridgePlatformId[];
}

export interface WorkbenchBridgeMediaLayout {
  bodyImageUrls: string[];
  coverUrls: string[];
  videoUrls: string[];
  firstBodySharesCoverAsset?: boolean;
}

export interface WorkbenchBridgeCollectedItem {
  url: string;
  platformId: WorkbenchBridgePlatformId;
  workId?: string;
  title?: string;
  content?: string;
  author?: string;
  authorId?: string;
  publishTime?: number;
  coverUrl?: string;
  playUrl?: string;
  imageUrls?: string[];
  mediaLayout?: WorkbenchBridgeMediaLayout;
  likes?: number;
  comments?: number;
  collects?: number;
  collectedAt: number;
}

/** 关键词批量抓取筛选（小红书 search 模式） */
export interface WorkbenchBridgeKeywordCaptureFilters {
  minLikes?: number;
  minComments?: number;
  /** 发布时间窗口：如 7d / 30d / 90d / all */
  publishWithin?: '7d' | '30d' | '90d' | 'all';
  /** 同城/附近（由插件解释，网页仅透传） */
  distance?: 'any' | 'same_city' | 'nearby';
  /** 采集模式：auto (智能混合) | api (API优先) | rpa (RPA真实页面) */
  collectMode?: 'auto' | 'api' | 'rpa';
  /** 排序依据：如 general / hot / latest */
  sortType?: string;
  /** 笔记形式：all / video / image-text（插件解释） */
  noteType?: string;
  /** 搜索范围：all / recently-viewed / not-viewed / following（插件解释） */
  searchRange?: string;
}

export type WorkbenchBridgePublishMaterialType = 'article' | 'image_text';

export type WorkbenchBridgeWeixinPublishMode = 'auto' | 'article' | 'image_draft';

export interface WorkbenchBridgePublishDraft {
  title: string;
  html: string;
  markdown: string;
  summary?: string;
  cover?: string;
  url?: string;
  materialType: WorkbenchBridgePublishMaterialType;
}

export interface WorkbenchBridgeChannelAuthStatus {
  ok: boolean;
  username?: string;
  reason?: string;
}

export interface WorkbenchBridgePublishChannelResult {
  channelId: string;
  success: boolean;
  postUrl?: string;
  postId?: string;
  error?: string;
}

export type WorkbenchBridgeMethod =
  | 'connection.getStatus'
  | 'accounts.list'
  | 'accounts.connect'
  | 'collection.resolve'
  | 'collection.search'
  | 'asset.fetch'
  | 'channels.checkAuth'
  | 'publish.start';

export interface WorkbenchBridgeRequestPayloadMap {
  'connection.getStatus': Record<string, never>;
  'accounts.list': Record<string, never>;
  'accounts.connect': { platformId: WorkbenchBridgePlatformId };
  'collection.resolve': { url: string };
  'collection.search': {
    platformId: WorkbenchBridgePlatformId;
    keyword: string;
    limit: number;
    filters?: WorkbenchBridgeKeywordCaptureFilters;
  };
  'asset.fetch': { url: string };
  'channels.checkAuth': { channelIds: string[] };
  'publish.start': {
    channelIds: string[];
    draft: WorkbenchBridgePublishDraft;
    weixinPublishMode?: WorkbenchBridgeWeixinPublishMode;
    captureId?: string;
  };
}

export interface WorkbenchBridgeResponsePayloadMap {
  'connection.getStatus': WorkbenchBridgeStatus;
  'accounts.list': { accounts: WorkbenchBridgeAccountSummary[] };
  'accounts.connect': { ok: boolean; message?: string };
  'collection.resolve': {
    ok: boolean;
    item?: WorkbenchBridgeCollectedItem;
    error?: string;
  };
  'collection.search': {
    ok: boolean;
    items?: WorkbenchBridgeCollectedItem[];
    error?: string;
  };
  'asset.fetch': {
    ok: boolean;
    blobBase64?: string;
    mime?: string;
    error?: string;
  };
  'channels.checkAuth': { statuses: Record<string, WorkbenchBridgeChannelAuthStatus> };
  'publish.start': { ok: boolean; results: WorkbenchBridgePublishChannelResult[] };
}

export interface WorkbenchBridgeWindowRequest<M extends WorkbenchBridgeMethod = WorkbenchBridgeMethod> {
  source: typeof WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_PAGE;
  protocolVersion: typeof WORKBENCH_BRIDGE_PROTOCOL_VERSION;
  requestId: string;
  method: M;
  payload: WorkbenchBridgeRequestPayloadMap[M];
}

export interface WorkbenchBridgeWindowResponse<M extends WorkbenchBridgeMethod = WorkbenchBridgeMethod> {
  source: typeof WORKBENCH_BRIDGE_WINDOW_MESSAGE_SOURCE_EXTENSION;
  protocolVersion: typeof WORKBENCH_BRIDGE_PROTOCOL_VERSION;
  requestId: string;
  method: M;
  ok: boolean;
  data?: WorkbenchBridgeResponsePayloadMap[M];
  error?: string;
}
