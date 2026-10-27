/**
 * Node-side simulation of repair decisions (no real IndexedDB).
 * Rules match idb-store-health.ts + assessWorkbenchIdbHealth branching.
 */

function legacyStoreNamesHealthy(storeNames) {
  const names = new Set(storeNames)
  return names.has('jobs') && names.has('blobs')
}

function mainStoreNamesHealthy(storeNames) {
  const names = new Set(storeNames)
  return names.has('jobs') && names.has('blobs') && names.has('payloads')
}

function shouldWipeLegacy(emptyShell, jobCount, blobCount) {
  if (emptyShell) return true
  if (jobCount === 0 && blobCount === 0) return true
  return false
}

function assessFromState(state) {
  const {
    mainStores,
    legacyListed,
    legacyStores,
    legacyJobCount = 0,
    legacyBlobCount = 0,
  } = state

  let wipeMain = false
  let wipeLegacy = false

  if (!mainStores || !mainStoreNamesHealthy(mainStores)) {
    wipeMain = true
  }

  if (!legacyListed) {
    return { healthy: !wipeMain, wipeMain, wipeLegacy: false }
  }

  const emptyShell = !legacyStoreNamesHealthy(legacyStores)
  if (emptyShell) {
    wipeLegacy = true
  } else {
    wipeLegacy = shouldWipeLegacy(false, legacyJobCount, legacyBlobCount)
  }

  const healthy = !wipeMain && !wipeLegacy
  return { healthy, wipeMain, wipeLegacy }
}

const scenarios = [
  {
    id: 'A_cold_start',
    label: '公网冷启动：无 legacy 库，主库 v2 三表齐全',
    state: {
      mainStores: ['jobs', 'blobs', 'payloads'],
      legacyListed: false,
    },
    expect: { healthy: true, wipeMain: false, wipeLegacy: false },
  },
  {
    id: 'B_poisoned_legacy_empty_shell',
    label: '中招：legacy 存在但无 jobs/blobs（误建空库）',
    state: {
      mainStores: ['jobs', 'blobs', 'payloads'],
      legacyListed: true,
      legacyStores: [],
    },
    expect: { healthy: false, wipeMain: false, wipeLegacy: true },
  },
  {
    id: 'B2_poisoned_main_missing_payloads',
    label: '主库缺 payloads（v1 脏库，体检判 wipe 主库）',
    state: {
      mainStores: ['jobs', 'blobs'],
      legacyListed: false,
    },
    expect: { healthy: false, wipeMain: true, wipeLegacy: false },
  },
  {
    id: 'C_legacy_empty_but_valid_schema',
    label: 'legacy 有表无数据（误触后的空库）',
    state: {
      mainStores: ['jobs', 'blobs', 'payloads'],
      legacyListed: true,
      legacyStores: ['jobs', 'blobs'],
      legacyJobCount: 0,
      legacyBlobCount: 0,
    },
    expect: { healthy: false, wipeMain: false, wipeLegacy: true },
  },
  {
    id: 'E_dev_with_real_legacy',
    label: '老用户：legacy 有真实任务，应保留并迁移',
    state: {
      mainStores: ['jobs', 'blobs', 'payloads'],
      legacyListed: true,
      legacyStores: ['jobs', 'blobs'],
      legacyJobCount: 3,
      legacyBlobCount: 2,
    },
    expect: { healthy: true, wipeMain: false, wipeLegacy: false },
  },
]

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

let failed = 0
const lines = []

for (const s of scenarios) {
  const got = assessFromState(s.state)
  const ok = deepEqual(got, s.expect)
  if (!ok) {
    failed += 1
    lines.push(`[FAIL] ${s.id}: ${s.label}`)
    lines.push(`       expect=${JSON.stringify(s.expect)} got=${JSON.stringify(got)}`)
  } else {
    lines.push(`[OK] ${s.id}: ${s.label}`)
  }
}

lines.push('')
lines.push('repair_gate: localStorage no996_wb_idb_repair_v2=1 => runWorkbenchIdbRepairIfNeeded skips assess (not simulated here)')
lines.push(`EMITTED=${scenarios.length}`)
lines.push(`FAILED=${failed}`)
lines.push('SENTINEL=idb-health-sim-done')

console.log(lines.join('\n'))
process.exit(failed > 0 ? 1 : 0)
