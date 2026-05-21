/**
 * @vitest-environment jsdom
 *
 * Tests for the data-grid audit workflow:
 *   - data-grid-store.setObservationFlag (UPDATE VALUEFLAG_CD + local mirror)
 *   - data-grid-store.deleteObservationFromGrid (DELETE + local clear)
 *   - data-grid-store.statistics.openAuditsCount + audit filter computed
 *   - grid-utils.getCellValueFlag
 *
 * Strategy: mock the database store so we can assert the SQL / params, then
 * drive the store through the same path the EditableCell context menu uses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getCellValueFlag } from '../../src/shared/utils/grid-utils.js'

const executeQueryMock = vi.fn()

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
    loadBatchPatientData: vi.fn(),
    loadBatchObservationData: vi.fn(),
    processObservationDataForGrid: vi.fn(),
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

const makeRow = (patientId, encounterNum, observations) => ({
  patientId,
  encounterNum,
  patientName: `Patient ${patientId}`,
  visitDate: '2026-01-01',
  observations,
})

const setupGrid = () => {
  const store = useDataGridStore()
  store.observationConcepts = [
    { code: 'LDL', name: 'LDL', valueType: 'N' },
    { code: 'HDL', name: 'HDL', valueType: 'N' },
  ]
  store.tableRows = [
    makeRow('P1', 1, {
      LDL: { observationId: 101, value: '120', valueFlag: 'AUDIT', valueType: 'N' },
      HDL: { observationId: 102, value: '50', valueFlag: null, valueType: 'N' },
    }),
    makeRow('P2', 2, {
      LDL: { observationId: 201, value: '90', valueFlag: 'CONFIRMED', valueType: 'N' },
      HDL: { observationId: 202, value: '60', valueFlag: null, valueType: 'N' },
    }),
    makeRow('P3', 3, {
      LDL: { observationId: 301, value: '110', valueFlag: null, valueType: 'N' },
      HDL: { observationId: 302, value: '55', valueFlag: null, valueType: 'N' },
    }),
  ]
  return store
}

describe('grid-utils.getCellValueFlag', () => {
  it('returns the cell\'s valueFlag', () => {
    const row = { observations: { X: { valueFlag: 'AUDIT' } } }
    expect(getCellValueFlag(row, { code: 'X' })).toBe('AUDIT')
  })

  it('returns null for missing observations or missing flag', () => {
    expect(getCellValueFlag({ observations: {} }, { code: 'X' })).toBeNull()
    expect(getCellValueFlag({ observations: { X: { value: 1 } } }, { code: 'X' })).toBeNull()
  })
})

describe('data-grid-store: audit workflow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    executeQueryMock.mockReset()
    executeQueryMock.mockResolvedValue({ success: true })
  })

  it('statistics.openAuditsCount counts only AUDIT cells', () => {
    const store = setupGrid()
    expect(store.statistics.openAuditsCount).toBe(1)
  })

  it('setObservationFlag UPDATEs VALUEFLAG_CD and mirrors into local state', async () => {
    const store = setupGrid()
    await store.setObservationFlag({
      patientId: 'P3',
      encounterNum: 3,
      conceptCode: 'LDL',
      observationId: 301,
      flag: 'AUDIT',
    })

    expect(executeQueryMock).toHaveBeenCalledOnce()
    const [sql, params] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('UPDATE OBSERVATION_FACT')
    expect(sql).toContain('VALUEFLAG_CD = ?')
    expect(params).toEqual(['AUDIT', 301])

    const p3Ldl = store.tableRows[2].observations.LDL
    expect(p3Ldl.valueFlag).toBe('AUDIT')
    // openAuditsCount reflects the new AUDIT cell (was 1, now 2)
    expect(store.statistics.openAuditsCount).toBe(2)
  })

  it('setObservationFlag with flag=CONFIRMED resolves an open audit', async () => {
    const store = setupGrid()
    await store.setObservationFlag({
      patientId: 'P1',
      encounterNum: 1,
      conceptCode: 'LDL',
      observationId: 101,
      flag: 'CONFIRMED',
    })

    const p1Ldl = store.tableRows[0].observations.LDL
    expect(p1Ldl.valueFlag).toBe('CONFIRMED')
    expect(store.statistics.openAuditsCount).toBe(0)
  })

  it('setObservationFlag is a no-op when observationId is missing', async () => {
    const store = setupGrid()
    await store.setObservationFlag({
      patientId: 'P1',
      encounterNum: 1,
      conceptCode: 'LDL',
      observationId: null,
      flag: 'AUDIT',
    })
    expect(executeQueryMock).not.toHaveBeenCalled()
  })

  it('deleteObservationFromGrid DELETEs and clears local cell', async () => {
    const store = setupGrid()
    await store.deleteObservationFromGrid({
      patientId: 'P1',
      encounterNum: 1,
      conceptCode: 'LDL',
      observationId: 101,
    })

    expect(executeQueryMock).toHaveBeenCalledOnce()
    const [sql, params] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('DELETE FROM OBSERVATION_FACT')
    expect(params).toEqual([101])

    const p1Ldl = store.tableRows[0].observations.LDL
    expect(p1Ldl.observationId).toBeNull()
    expect(p1Ldl.value).toBe('')
    expect(p1Ldl.valueFlag).toBeNull()
    // The AUDIT cell was on this exact cell, so the count drops to 0.
    expect(store.statistics.openAuditsCount).toBe(0)
  })

  it('toggleAuditFilter narrows visible concepts and rows', () => {
    const store = setupGrid()
    expect(store.auditFilterActive).toBe(false)
    expect(store.getVisibleObservationConcepts.map((c) => c.code)).toEqual(['LDL', 'HDL'])
    expect(store.getVisibleTableRows.map((r) => r.patientId)).toEqual(['P1', 'P2', 'P3'])

    store.toggleAuditFilter()
    expect(store.auditFilterActive).toBe(true)
    // Only LDL has an AUDIT cell (P1) — HDL is filtered out
    expect(store.getVisibleObservationConcepts.map((c) => c.code)).toEqual(['LDL'])
    // Only P1's row contains AUDIT
    expect(store.getVisibleTableRows.map((r) => r.patientId)).toEqual(['P1'])

    store.toggleAuditFilter()
    expect(store.auditFilterActive).toBe(false)
    expect(store.getVisibleObservationConcepts).toHaveLength(2)
    expect(store.getVisibleTableRows).toHaveLength(3)
  })

  it('conceptCodesWithOpenAudit returns the right set', () => {
    const store = setupGrid()
    const codes = store.conceptCodesWithOpenAudit
    expect(codes).toBeInstanceOf(Set)
    expect([...codes]).toEqual(['LDL'])
  })

  it('setObservationFlag with flag=NV also clears NVAL_NUM and TVAL_CHAR', async () => {
    const store = setupGrid()
    await store.setObservationFlag({
      patientId: 'P3',
      encounterNum: 3,
      conceptCode: 'HDL',
      observationId: 302,
      flag: 'NV',
    })

    expect(executeQueryMock).toHaveBeenCalledOnce()
    const [sql, params] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('VALUEFLAG_CD = ?')
    expect(sql).toContain('NVAL_NUM = NULL')
    expect(sql).toContain('TVAL_CHAR = NULL')
    expect(params).toEqual(['NV', 302])

    const p3Hdl = store.tableRows[2].observations.HDL
    expect(p3Hdl.valueFlag).toBe('NV')
    expect(p3Hdl.value).toBe('')
  })

  it('setObservationFlag with flag=null clears the flag only (value preserved)', async () => {
    const store = setupGrid()
    // Start from a NV cell — flip back to null
    store.tableRows[2].observations.HDL.valueFlag = 'NV'
    await store.setObservationFlag({
      patientId: 'P3',
      encounterNum: 3,
      conceptCode: 'HDL',
      observationId: 302,
      flag: null,
    })

    const [sql, params] = executeQueryMock.mock.calls[0]
    expect(sql).toContain('VALUEFLAG_CD = ?')
    expect(sql).not.toContain('NVAL_NUM = NULL')
    expect(sql).not.toContain('TVAL_CHAR = NULL')
    expect(params).toEqual([null, 302])
    expect(store.tableRows[2].observations.HDL.valueFlag).toBeNull()
    // value untouched (still '55')
    expect(store.tableRows[2].observations.HDL.value).toBe('55')
  })

  it('setObservationFlag surfaces DB errors', async () => {
    executeQueryMock.mockResolvedValueOnce({ success: false, error: 'boom' })
    const store = setupGrid()
    await expect(
      store.setObservationFlag({
        patientId: 'P3',
        encounterNum: 3,
        conceptCode: 'LDL',
        observationId: 301,
        flag: 'AUDIT',
      }),
    ).rejects.toThrow('boom')
    // Local state untouched on failure
    expect(store.tableRows[2].observations.LDL.valueFlag).toBeNull()
  })
})
