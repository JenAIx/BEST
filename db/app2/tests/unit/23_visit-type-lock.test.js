/**
 * @vitest-environment jsdom
 *
 * Tests for the visit-type lock in the data grid (features/datagrid-views):
 *   - grid-utils.buildVisitTypeLockMap (CODE_LOOKUP rows → lock map)
 *   - grid-utils.isCellVisitTypeLocked (per-cell lock predicate)
 *   - data-grid-store.isCellLocked (viewOptions gate + loaded map)
 *
 * Scenario mirrors the Stroke-Lipid setup: drug concepts hang on V1/V2 only
 * (explicit concepts[]), labs match V1/V2 via categories[], and a concept in
 * no field set is never locked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { buildVisitTypeLockMap, isCellVisitTypeLocked } from 'src/shared/utils/grid-utils'

const executeQueryMock = vi.fn()

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
  }),
}))

vi.mock('src/stores/local-settings-store', () => ({
  useLocalSettingsStore: () => ({
    getSetting: () => null,
    setSetting: () => {},
  }),
}))

vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      success: vi.fn(),
    }),
  }),
}))

const { useDataGridStore } = await import('src/stores/data-grid-store')

const VISIT_TYPE_ROWS = [
  {
    CODE_CD: 'v0',
    LOOKUP_BLOB: JSON.stringify({ fieldSets: [{ id: 'baseline', active: true }] }),
  },
  {
    CODE_CD: 'v1',
    LOOKUP_BLOB: JSON.stringify({ fieldSets: [{ id: 'drugs', active: true }, { id: 'labor', active: true }] }),
  },
]

const FIELD_SET_ROWS = [
  {
    CODE_CD: 'baseline',
    LOOKUP_BLOB: JSON.stringify({ concepts: ['SCTID: 49436004'], categories: ['Stroke'] }),
  },
  {
    CODE_CD: 'drugs',
    LOOKUP_BLOB: JSON.stringify({ concepts: ['DRUG:V1'], categories: [] }),
  },
  {
    CODE_CD: 'labor',
    LOOKUP_BLOB: JSON.stringify({ concepts: ['LID: 22748-8'], categories: ['Laboratory'] }),
  },
  {
    // Orphan field set: referenced by no visit type — must not cause locks
    CODE_CD: 'orphan',
    LOOKUP_BLOB: JSON.stringify({ concepts: ['ORPHAN:X'], categories: [] }),
  },
]

const lockMap = () => buildVisitTypeLockMap(VISIT_TYPE_ROWS, FIELD_SET_ROWS)

describe('grid-utils.buildVisitTypeLockMap', () => {
  it('collects allowed concepts/categories per visit type from its field sets', () => {
    const map = lockMap()
    expect(map.byVisitType.get('v0').concepts.has('SCTID: 49436004')).toBe(true)
    expect(map.byVisitType.get('v0').categories.has('Stroke')).toBe(true)
    expect(map.byVisitType.get('v1').concepts.has('DRUG:V1')).toBe(true)
    expect(map.byVisitType.get('v1').categories.has('Laboratory')).toBe(true)
  })

  it('only field sets referenced by a visit type count as claimed', () => {
    const map = lockMap()
    expect(map.claimedConcepts.has('DRUG:V1')).toBe(true)
    expect(map.claimedConcepts.has('ORPHAN:X')).toBe(false)
  })

  it('tolerates malformed blobs', () => {
    const map = buildVisitTypeLockMap(
      [{ CODE_CD: 'broken', LOOKUP_BLOB: '{not json' }, ...VISIT_TYPE_ROWS],
      [{ CODE_CD: 'alsobroken', LOOKUP_BLOB: null }, ...FIELD_SET_ROWS],
    )
    expect(map.byVisitType.has('broken')).toBe(false)
    expect(map.byVisitType.size).toBe(2)
  })
})

describe('grid-utils.isCellVisitTypeLocked', () => {
  const drugConcept = { code: 'DRUG:V1', category: 'Medications' }
  const labConcept = { code: 'LID: 1920-8', category: 'Laboratory' }
  const freeConcept = { code: 'CUSTOM:NOTES', category: null }

  it('locks a V1-only drug concept on a V0 row', () => {
    expect(isCellVisitTypeLocked(lockMap(), { visitTypeCode: 'v0' }, drugConcept)).toBe(true)
  })

  it('keeps the drug concept active on its own visit type', () => {
    expect(isCellVisitTypeLocked(lockMap(), { visitTypeCode: 'v1' }, drugConcept)).toBe(false)
  })

  it('category matching keeps labs active on V1 even without explicit concept entry', () => {
    expect(isCellVisitTypeLocked(lockMap(), { visitTypeCode: 'v1' }, labConcept)).toBe(false)
    // ...but locks them on V0, whose field sets claim neither code nor category
    expect(isCellVisitTypeLocked(lockMap(), { visitTypeCode: 'v0' }, labConcept)).toBe(true)
  })

  it('never locks concepts that no field set claims', () => {
    expect(isCellVisitTypeLocked(lockMap(), { visitTypeCode: 'v0' }, freeConcept)).toBe(false)
  })

  it("explicit assignment beats category fallback (the 'dose increased at V2' case)", () => {
    // DRUG:V1 is explicitly listed only in the v1 'drugs' field set, but its
    // category 'Stroke' is claimed by v0's baseline field set. The category
    // must NOT rescue it on v0 — explicitly listed concepts stay bound to the
    // visit types that list them.
    const v1OnlyWithSharedCategory = { code: 'DRUG:V1', category: 'Stroke' }
    expect(isCellVisitTypeLocked(lockMap(), { visitTypeCode: 'v0' }, v1OnlyWithSharedCategory)).toBe(true)
    expect(isCellVisitTypeLocked(lockMap(), { visitTypeCode: 'v1' }, v1OnlyWithSharedCategory)).toBe(false)
  })

  it('never locks rows without or with unknown visit type, placeholders, or without a map', () => {
    const map = lockMap()
    expect(isCellVisitTypeLocked(map, { visitTypeCode: null }, drugConcept)).toBe(false)
    expect(isCellVisitTypeLocked(map, { visitTypeCode: 'legacy_unknown' }, drugConcept)).toBe(false)
    expect(isCellVisitTypeLocked(map, { visitTypeCode: 'v0', isPlaceholder: true }, drugConcept)).toBe(false)
    expect(isCellVisitTypeLocked(null, { visitTypeCode: 'v0' }, drugConcept)).toBe(false)
  })
})

describe('data-grid-store.isCellLocked', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    executeQueryMock.mockReset()
    executeQueryMock.mockImplementation((sql, params) => {
      const column = params?.[0]
      if (column === 'VISIT_TYPE_CD') return Promise.resolve({ success: true, data: VISIT_TYPE_ROWS })
      if (column === 'FIELD_SET_CD') return Promise.resolve({ success: true, data: FIELD_SET_ROWS })
      return Promise.resolve({ success: true, data: [] })
    })
  })

  it('is inactive by default and activates via viewOptions.visitTypeLockActive', async () => {
    const store = useDataGridStore()
    await store.loadVisitTypeLockData()

    const row = { visitTypeCode: 'v0' }
    const concept = { code: 'DRUG:V1', category: 'Medications' }

    expect(store.isCellLocked(row, concept)).toBe(false)
    store.updateViewOptions({ visitTypeLockActive: true })
    expect(store.isCellLocked(row, concept)).toBe(true)
    // Memoized path returns the same verdict on repeated asks
    expect(store.isCellLocked(row, concept)).toBe(true)
    expect(store.isCellLocked({ visitTypeCode: 'v1' }, concept)).toBe(false)
  })

  it('builds visit-type display meta from the same lookup query (no second query)', async () => {
    const store = useDataGridStore()
    await store.loadVisitTypeLockData()

    expect(store.visitTypeMeta.get('v0')).toEqual({ label: 'v0', icon: null, color: null })
    // Exactly two lookup queries total: VISIT_TYPE_CD + FIELD_SET_CD
    expect(executeQueryMock).toHaveBeenCalledTimes(2)
  })

  it('statistics exclude locked cells from the filled quota (audits still counted)', async () => {
    const store = useDataGridStore()
    await store.loadVisitTypeLockData()

    // One v0 row, two concepts: DRUG:V1 is locked on v0 (explicit elsewhere),
    // the baseline concept stays active. The locked cell holds a legacy value
    // with an open audit.
    store.observationConcepts = [
      { code: 'DRUG:V1', name: 'Drug', valueType: 'N', category: 'Medications' },
      { code: 'SCTID: 49436004', name: 'Baseline', valueType: 'N', category: 'Stroke' },
    ]
    store.tableRows = [
      {
        patientId: 'P1',
        encounterNum: 1,
        visitTypeCode: 'v0',
        observations: {
          'DRUG:V1': { observationId: 1, value: '40', valueFlag: 'AUDIT' },
          'SCTID: 49436004': { observationId: 2, value: '120', valueFlag: null },
        },
      },
    ]

    // Lock inactive: both cells count, both filled
    expect(store.statistics.totalCells).toBe(2)
    expect(store.statistics.filledCells).toBe(2)
    expect(store.statistics.lockedCellsCount).toBe(0)

    store.updateViewOptions({ visitTypeLockActive: true })
    expect(store.statistics.totalCells).toBe(1)
    expect(store.statistics.filledCells).toBe(1)
    expect(store.statistics.filledCellsPercentage).toBe(100)
    expect(store.statistics.lockedCellsCount).toBe(1)
    // The audit on the locked cell is still reported
    expect(store.statistics.openAuditsCount).toBe(1)
  })

  it('fails open: lookup errors disable the lock instead of locking everything', async () => {
    executeQueryMock.mockResolvedValue({ success: false, error: 'boom' })
    const store = useDataGridStore()
    await store.loadVisitTypeLockData()
    store.updateViewOptions({ visitTypeLockActive: true })

    expect(store.visitTypeLockMap).toBe(null)
    expect(store.isCellLocked({ visitTypeCode: 'v0' }, { code: 'DRUG:V1', category: null })).toBe(false)
  })
})
