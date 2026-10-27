/**
 * @file material-repository.ts
 * 浏览器本机素材库（用户隔离，存 IndexedDB: no996-workbench-materials）
 */

import type { WorkbenchBridgeCollectedItem, WorkbenchBridgePlatformId } from '../extension/workbench-bridge-contract';
import { normalizeXiaohongshuCollectedItem } from '../../features/extension/materials/xhs-material-display';

export type MaterialCaptureType = 'single_url' | 'batch_urls' | 'keyword';

export interface SavedMaterial extends WorkbenchBridgeCollectedItem {
  id: string;
  ownerUserId: number;
  tags?: string[];
  notes?: string;
  updatedAt: number;
  imageFallbackDataUrls?: (string | undefined)[];
  coverFallbackDataUrl?: string;
  batchId?: string;
  batchTitle?: string;
  captureType?: MaterialCaptureType;
  captureKeyword?: string;
}

export interface MaterialBatchMeta {
  batchId: string;
  batchTitle: string;
  captureType: MaterialCaptureType;
  captureKeyword?: string;
}

export interface MaterialTaskGroup {
  batchId: string;
  batchTitle: string;
  captureType: MaterialCaptureType;
  captureKeyword?: string;
  createdAt: number;
  items: SavedMaterial[];
}

export interface MaterialDateGroup {
  dateKey: string;
  dateLabel: string;
  items: SavedMaterial[];
}

const DB_NAME = 'no996-workbench-materials';
const DB_VERSION = 2;
const STORE_MATERIALS = 'materials';

function openMaterialsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('打开本机素材库失败'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      if (!db.objectStoreNames.contains(STORE_MATERIALS)) {
        const store = db.createObjectStore(STORE_MATERIALS, { keyPath: 'id' });
        store.createIndex('by_owner', 'ownerUserId', { unique: false });
        store.createIndex('by_owner_platform', ['ownerUserId', 'platformId'], { unique: false });
      } else if (oldVersion < 2) {
        // v2: optional fallback fields on documents; no index change.
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('素材库事务失败'));
    tx.onabort = () => reject(tx.error ?? new Error('素材库事务中止'));
  });
}

export class MaterialRepository {
  async saveCollectedItem(
    userId: number,
    item: WorkbenchBridgeCollectedItem,
    batchMeta?: Partial<MaterialBatchMeta>,
  ): Promise<SavedMaterial> {
    const db = await openMaterialsDb();
    const normalized = normalizeXiaohongshuCollectedItem(item);
    const stableId = normalized.workId
      ? `${normalized.platformId}:${normalized.workId}`
      : `${normalized.platformId}:${encodeURIComponent(normalized.url.slice(0, 100))}`;

    const material: SavedMaterial = {
      ...normalized,
      id: stableId,
      ownerUserId: userId,
      updatedAt: Date.now(),
      batchId: batchMeta?.batchId,
      batchTitle: batchMeta?.batchTitle,
      captureType: batchMeta?.captureType,
      captureKeyword: batchMeta?.captureKeyword,
    };

    const tx = db.transaction(STORE_MATERIALS, 'readwrite');
    tx.objectStore(STORE_MATERIALS).put(material);
    await txDone(tx);

    return material;
  }

  async saveCollectedBatch(
    userId: number,
    items: WorkbenchBridgeCollectedItem[],
    batchMeta: MaterialBatchMeta,
  ): Promise<SavedMaterial[]> {
    if (!items.length) return [];
    const db = await openMaterialsDb();
    const tx = db.transaction(STORE_MATERIALS, 'readwrite');
    const store = tx.objectStore(STORE_MATERIALS);
    const now = Date.now();
    const savedList: SavedMaterial[] = [];

    for (const item of items) {
      const normalized = normalizeXiaohongshuCollectedItem(item);
      const stableId = normalized.workId
        ? `${normalized.platformId}:${normalized.workId}`
        : `${normalized.platformId}:${encodeURIComponent(normalized.url.slice(0, 100))}`;

      const material: SavedMaterial = {
        ...normalized,
        id: stableId,
        ownerUserId: userId,
        updatedAt: now,
        batchId: batchMeta.batchId,
        batchTitle: batchMeta.batchTitle,
        captureType: batchMeta.captureType,
        captureKeyword: batchMeta.captureKeyword,
      };

      store.put(material);
      savedList.push(material);
    }

    await txDone(tx);
    return savedList;
  }

  async patchMaterialFallbacks(
    id: string,
    patch: { imageFallbackDataUrls?: (string | undefined)[]; coverFallbackDataUrl?: string },
  ): Promise<void> {
    const db = await openMaterialsDb();
    const current = await this.getMaterial(id);
    if (!current) return
    const next: SavedMaterial = {
      ...current,
      updatedAt: Date.now(),
    };
    if (patch.imageFallbackDataUrls !== undefined) {
      if (patch.imageFallbackDataUrls.length) {
        next.imageFallbackDataUrls = patch.imageFallbackDataUrls;
      } else {
        delete next.imageFallbackDataUrls;
      }
    }
    if (patch.coverFallbackDataUrl !== undefined) {
      if (patch.coverFallbackDataUrl) {
        next.coverFallbackDataUrl = patch.coverFallbackDataUrl;
      } else {
        delete next.coverFallbackDataUrl;
      }
    }
    const tx = db.transaction(STORE_MATERIALS, 'readwrite');
    tx.objectStore(STORE_MATERIALS).put(next);
    await txDone(tx);
  }

  async listMaterials(userId: number, platformId?: WorkbenchBridgePlatformId): Promise<SavedMaterial[]> {
    const db = await openMaterialsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MATERIALS, 'readonly');
      const store = tx.objectStore(STORE_MATERIALS);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as SavedMaterial[]).filter((m) => m.ownerUserId === userId);
        const filtered = platformId ? all.filter((m) => m.platformId === platformId) : all;
        filtered.sort((a, b) => (b.updatedAt || b.collectedAt) - (a.updatedAt || a.collectedAt));
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getMaterial(id: string): Promise<SavedMaterial | null> {
    const db = await openMaterialsDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MATERIALS, 'readonly');
      const req = tx.objectStore(STORE_MATERIALS).get(id);
      req.onsuccess = () => resolve((req.result as SavedMaterial) || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteMaterial(id: string): Promise<void> {
    const db = await openMaterialsDb();
    const tx = db.transaction(STORE_MATERIALS, 'readwrite');
    tx.objectStore(STORE_MATERIALS).delete(id);
    await txDone(tx);
  }

  async deleteMaterials(ids: string[]): Promise<void> {
    if (!ids.length) return
    const db = await openMaterialsDb();
    const tx = db.transaction(STORE_MATERIALS, 'readwrite');
    const store = tx.objectStore(STORE_MATERIALS);
    for (const id of ids) store.delete(id);
    await txDone(tx);
  }

  async deleteAllForUser(userId: number): Promise<void> {
    const list = await this.listMaterials(userId);
    await this.deleteMaterials(list.map((m) => m.id));
  }
}

export const materialRepository = new MaterialRepository();

/**
 * 辅助函数：将素材列表按单次任务批次（或时间段聚类）分组
 */
export function groupMaterialsByTask(materials: SavedMaterial[]): MaterialTaskGroup[] {
  const groups: MaterialTaskGroup[] = [];
  const batchMap = new Map<string, MaterialTaskGroup>();

  // 1. 已有显式 batchId 的素材归组
  const unbatched: SavedMaterial[] = [];
  for (const m of materials) {
    if (m.batchId) {
      let g = batchMap.get(m.batchId);
      if (!g) {
        g = {
          batchId: m.batchId,
          batchTitle: m.batchTitle || '采集任务',
          captureType: m.captureType || 'single_url',
          captureKeyword: m.captureKeyword,
          createdAt: m.collectedAt || m.updatedAt || Date.now(),
          items: [],
        };
        batchMap.set(m.batchId, g);
        groups.push(g);
      }
      g.items.push(m);
    } else {
      unbatched.push(m);
    }
  }

  // 2. 针对无 batchId 的历史素材：按时间段聚类（10分钟窗口聚合为一个采集时段，或单条聚合）
  unbatched.sort((a, b) => (b.collectedAt || b.updatedAt) - (a.collectedAt || a.updatedAt));
  const CLUSTER_WINDOW_MS = 10 * 60 * 1000; // 10分钟
  let currentSyntheticGroup: MaterialTaskGroup | null = null;

  for (const m of unbatched) {
    const time = m.collectedAt || m.updatedAt || Date.now();
    if (
      currentSyntheticGroup &&
      Math.abs(currentSyntheticGroup.createdAt - time) <= CLUSTER_WINDOW_MS
    ) {
      currentSyntheticGroup.items.push(m);
    } else {
      const d = new Date(time);
      const timeStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      currentSyntheticGroup = {
        batchId: `synthetic:${time}`,
        batchTitle: `历史采集 · ${timeStr}`,
        captureType: 'single_url',
        createdAt: time,
        items: [m],
      };
      groups.push(currentSyntheticGroup);
    }
  }

  // 组按最新时间倒序排
  groups.sort((a, b) => b.createdAt - a.createdAt);
  return groups;
}

/**
 * 辅助函数：将素材列表按天分组（今天 / 昨天 / 日期）
 */
export function groupMaterialsByDate(materials: SavedMaterial[]): MaterialDateGroup[] {
  const map = new Map<string, { label: string; items: SavedMaterial[]; timestamp: number }>();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  for (const m of materials) {
    const t = m.collectedAt || m.updatedAt || Date.now();
    const d = new Date(t);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let entry = map.get(dateKey);
    if (!entry) {
      let label = dateKey;
      if (dateKey === todayStr) label = '今天';
      else if (dateKey === yesterdayStr) label = '昨天';

      entry = { label, items: [], timestamp: new Date(dateKey).getTime() };
      map.set(dateKey, entry);
    }
    entry.items.push(m);
  }

  const result: MaterialDateGroup[] = [];
  const sortedKeys = [...map.keys()].sort((a, b) => (map.get(b)!.timestamp) - (map.get(a)!.timestamp));

  for (const k of sortedKeys) {
    const val = map.get(k)!;
    result.push({
      dateKey: k,
      dateLabel: val.label,
      items: val.items,
    });
  }

  return result;
}
