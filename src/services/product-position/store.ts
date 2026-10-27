import {
  nowIso,
  type ProductRecord,
  type ProductReportSnapshot,
  type ReportStatus,
} from './types'

/**
 * 产品定位与分析的本机库。
 *
 * 只依赖 IndexedDB，无后端；读取时按 ownerSub 过滤，换账号不会看到别人的产品。
 * 库结构版本化：新增对象仓时递增 DB_VERSION 并在 onupgradeneeded 内迁移。
 */

const DB_NAME = 'no996-workbench-product-position'
const DB_VERSION = 1
const PRODUCTS = 'products'
const REPORTS = 'reports'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('打开产品定位本地库失败'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PRODUCTS)) {
        const store = db.createObjectStore(PRODUCTS, { keyPath: 'id' })
        store.createIndex('by_updated', 'updatedAt', { unique: false })
        store.createIndex('by_owner', 'ownerSub', { unique: false })
      }
      if (!db.objectStoreNames.contains(REPORTS)) {
        const store = db.createObjectStore(REPORTS, { keyPath: 'id' })
        store.createIndex('by_product', 'productId', { unique: false })
        store.createIndex('by_product_created', ['productId', 'createdAt'], { unique: false })
      }
    }
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('产品定位本地库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('产品定位本地库事务中止'))
  })
}

function requestAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('产品定位本地库读写失败'))
  })
}

function byUpdatedDesc(a: ProductRecord, b: ProductRecord): number {
  return b.updatedAt.localeCompare(a.updatedAt)
}

export async function listProducts(ownerSub?: string): Promise<ProductRecord[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(PRODUCTS, 'readonly')
    const rows = await requestAsPromise(tx.objectStore(PRODUCTS).getAll() as IDBRequest<ProductRecord[]>)
    await txDone(tx)
    const filtered = ownerSub ? rows.filter((row) => !row.ownerSub || row.ownerSub === ownerSub) : rows
    return filtered.sort(byUpdatedDesc)
  } finally {
    db.close()
  }
}

export async function getProduct(id: string): Promise<ProductRecord | null> {
  const db = await openDb()
  try {
    const tx = db.transaction(PRODUCTS, 'readonly')
    const row = await requestAsPromise(tx.objectStore(PRODUCTS).get(id) as IDBRequest<ProductRecord | undefined>)
    await txDone(tx)
    return row ?? null
  } finally {
    db.close()
  }
}

export async function saveProduct(product: ProductRecord): Promise<ProductRecord> {
  const next: ProductRecord = { ...product, updatedAt: nowIso() }
  const db = await openDb()
  try {
    const tx = db.transaction(PRODUCTS, 'readwrite')
    tx.objectStore(PRODUCTS).put(next)
    await txDone(tx)
    return next
  } finally {
    db.close()
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction([PRODUCTS, REPORTS], 'readwrite')
    tx.objectStore(PRODUCTS).delete(id)
    const reports = await requestAsPromise(
      tx.objectStore(REPORTS).index('by_product').getAll(id) as IDBRequest<ProductReportSnapshot[]>,
    )
    for (const report of reports) tx.objectStore(REPORTS).delete(report.id)
    await txDone(tx)
  } finally {
    db.close()
  }
}

export async function listReports(productId: string): Promise<ProductReportSnapshot[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(REPORTS, 'readonly')
    const rows = await requestAsPromise(
      tx.objectStore(REPORTS).index('by_product').getAll(productId) as IDBRequest<ProductReportSnapshot[]>,
    )
    await txDone(tx)
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } finally {
    db.close()
  }
}

export async function getReport(id: string): Promise<ProductReportSnapshot | null> {
  const db = await openDb()
  try {
    const tx = db.transaction(REPORTS, 'readonly')
    const row = await requestAsPromise(
      tx.objectStore(REPORTS).get(id) as IDBRequest<ProductReportSnapshot | undefined>,
    )
    await txDone(tx)
    return row ?? null
  } finally {
    db.close()
  }
}

/** 当前有效报告 = 最新一条 succeeded；失败尝试不覆盖它。 */
export async function getLatestReport(productId: string): Promise<ProductReportSnapshot | undefined> {
  const reports = await listReports(productId)
  return reports.find((report) => report.status === 'succeeded')
}

/** 最近一次尝试（含失败），用于展示真实失败原因。 */
export async function getLatestAttempt(productId: string): Promise<ProductReportSnapshot | undefined> {
  const reports = await listReports(productId)
  return reports[0]
}

export async function saveReport(report: ProductReportSnapshot): Promise<ProductReportSnapshot> {
  const next: ProductReportSnapshot = { ...report, updatedAt: nowIso() }
  const db = await openDb()
  try {
    const tx = db.transaction(REPORTS, 'readwrite')
    tx.objectStore(REPORTS).put(next)
    await txDone(tx)
    return next
  } finally {
    db.close()
  }
}

export async function setReportStatus(
  id: string,
  status: ReportStatus,
  patch?: Partial<Pick<ProductReportSnapshot, 'markdown' | 'view' | 'issues' | 'error' | 'taskId'>>,
): Promise<ProductReportSnapshot | null> {
  const existing = await getReport(id)
  if (!existing) return null
  return saveReport({ ...existing, ...patch, status })
}

/** 供测试与「清空本机数据」使用。 */
export async function clearProductPositionStore(): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction([PRODUCTS, REPORTS], 'readwrite')
    tx.objectStore(PRODUCTS).clear()
    tx.objectStore(REPORTS).clear()
    await txDone(tx)
  } finally {
    db.close()
  }
}
