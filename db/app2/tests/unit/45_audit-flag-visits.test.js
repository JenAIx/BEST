/**
 * Audit flags in the unified visits timeline (step 1 of the audit feature:
 * bring the grid's "Zur Prüfung markieren" to /visits/:patientId).
 *
 *  - shared/utils/audit-flag.js: statement builder (identical SQL to the
 *    grid), flag reading, open-audit counting, menu actions per state
 *  - observation-store.setObservationFlag: writes via the shared statement
 *    and mirrors valueFlag + rawData.VALUEFLAG_CD IN PLACE into both arrays
 *    (the form grid keeps references into `observations`), clearing the
 *    value fields for NV
 *  - transformObservation exposes `valueFlag` (was rawData-only)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { toRaw } from 'vue'
import { buildSetFlagStatement, readValueFlag, hasOpenAudit, countOpenAudits, auditActionsFor } from '../../src/shared/utils/audit-flag.js'

const executeQueryMock = vi.fn()

vi.mock('src/stores/database-store', () => ({
  useDatabaseStore: () => ({
    executeQuery: executeQueryMock,
    getRepository: vi.fn(),
    canPerformOperations: true,
  }),
}))
vi.mock('src/stores/auth-store', () => ({
  useAuthStore: () => ({ providerId: 'ste', currentUser: { USER_CD: 'ste' } }),
}))
vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), debug: vi.fn() }),
  }),
}))

const { useObservationStore } = await import('src/stores/observation-store')

describe('audit-flag utils', () => {
  it('buildSetFlagStatement: AUDIT / CONFIRMED / null keep the value, NV clears it', () => {
    const audit = buildSetFlagStatement('AUDIT', 'ste', 42)
    expect(audit.sql).toBe('UPDATE OBSERVATION_FACT SET VALUEFLAG_CD = ?, PROVIDER_ID = ?, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?')
    expect(audit.params).toEqual(['AUDIT', 'ste', 42])
    expect(audit.clearValue).toBe(false)

    const nv = buildSetFlagStatement('NV', 'ste', 42)
    expect(nv.sql).toContain('NVAL_NUM = NULL, TVAL_CHAR = NULL')
    expect(nv.params).toEqual(['NV', 'ste', 42])
    expect(nv.clearValue).toBe(true)

    expect(buildSetFlagStatement(null, 'ste', 1).params[0]).toBeNull()
  })

  it('readValueFlag prefers the transformed field, falls back to the raw row', () => {
    expect(readValueFlag({ valueFlag: 'AUDIT', rawData: { VALUEFLAG_CD: 'CONFIRMED' } })).toBe('AUDIT')
    expect(readValueFlag({ rawData: { VALUEFLAG_CD: 'CONFIRMED' } })).toBe('CONFIRMED')
    expect(readValueFlag({ valueFlag: null, rawData: { VALUEFLAG_CD: 'NV' } })).toBe('NV')
    expect(readValueFlag({})).toBeNull()
    expect(readValueFlag(null)).toBeNull()
  })

  it('hasOpenAudit / countOpenAudits only count AUDIT', () => {
    const rows = [{ valueFlag: 'AUDIT' }, { valueFlag: 'CONFIRMED' }, { rawData: { VALUEFLAG_CD: 'AUDIT' } }, { valueFlag: 'NV' }, {}]
    expect(rows.map(hasOpenAudit)).toEqual([true, false, true, false, false])
    expect(countOpenAudits(rows)).toBe(2)
    expect(countOpenAudits([])).toBe(0)
    expect(countOpenAudits(null)).toBe(0)
  })

  it('auditActionsFor mirrors the grid cell menu rules', () => {
    expect(auditActionsFor(null).map((a) => a.action)).toEqual(['mark'])
    expect(auditActionsFor('AUDIT').map((a) => a.action)).toEqual(['resolve', 'clear'])
    expect(auditActionsFor('CONFIRMED').map((a) => a.action)).toEqual(['mark', 'clear'])
    expect(auditActionsFor('NV')).toEqual([]) // an NV cell cannot be flagged (grid parity)
    expect(auditActionsFor('AUDIT').find((a) => a.action === 'resolve').flag).toBe('CONFIRMED')
    expect(auditActionsFor('AUDIT').find((a) => a.action === 'clear').flag).toBeNull()
  })
})

describe('observation-store.setObservationFlag', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    executeQueryMock.mockReset()
    executeQueryMock.mockResolvedValue({ success: true, data: [] })
    store = useObservationStore()
  })

  const seed = () => {
    const perVisit = { observationId: 7, conceptCode: 'LID: 1', valueType: 'N', value: null, numericValue: 66, originalValue: 66, displayValue: '66', valueFlag: null, rawData: { VALUEFLAG_CD: null, NVAL_NUM: 66, TVAL_CHAR: null } }
    const patientWide = { ...perVisit, rawData: { ...perVisit.rawData } }
    store.observations = [perVisit]
    store.allObservations = [patientWide, { observationId: 8, valueFlag: null, rawData: {} }]
    return { perVisit, patientWide }
  }

  it('writes the shared statement and mirrors AUDIT in place into both arrays', async () => {
    const { perVisit, patientWide } = seed()
    const written = await store.setObservationFlag({ observationId: 7, flag: 'AUDIT' })
    expect(written).toBe('AUDIT')

    const [sql, params] = executeQueryMock.mock.calls[0]
    expect(sql).toBe(buildSetFlagStatement('AUDIT', 'ste', 7).sql)
    expect(params).toEqual(['AUDIT', 'ste', 7])

    // in place — the very same objects the form grid holds (behind the reactive proxy)
    expect(toRaw(store.observations[0])).toBe(perVisit)
    expect(perVisit.valueFlag).toBe('AUDIT')
    expect(perVisit.rawData.VALUEFLAG_CD).toBe('AUDIT')
    expect(patientWide.valueFlag).toBe('AUDIT')
    expect(patientWide.rawData.VALUEFLAG_CD).toBe('AUDIT')
    // value untouched
    expect(perVisit.numericValue).toBe(66)
    expect(perVisit.rawData.NVAL_NUM).toBe(66)
    // other rows untouched
    expect(store.allObservations[1].valueFlag).toBeNull()
  })

  it('NV clears the value fields locally as well', async () => {
    const { perVisit } = seed()
    await store.setObservationFlag({ observationId: 7, flag: 'NV' })
    expect(perVisit.valueFlag).toBe('NV')
    expect(perVisit.numericValue).toBeNull()
    expect(perVisit.originalValue).toBeNull()
    expect(perVisit.rawData.NVAL_NUM).toBeNull()
    expect(perVisit.rawData.TVAL_CHAR).toBeNull()
  })

  it('null clears a review flag; missing observationId is a no-op; DB errors surface', async () => {
    const { perVisit } = seed()
    perVisit.valueFlag = 'CONFIRMED'
    await store.setObservationFlag({ observationId: 7, flag: null })
    expect(perVisit.valueFlag).toBeNull()
    expect(perVisit.rawData.VALUEFLAG_CD).toBeNull()

    executeQueryMock.mockClear()
    expect(await store.setObservationFlag({ flag: 'AUDIT' })).toBeNull()
    expect(executeQueryMock).not.toHaveBeenCalled()

    executeQueryMock.mockResolvedValue({ success: false, error: 'locked' })
    await expect(store.setObservationFlag({ observationId: 7, flag: 'AUDIT' })).rejects.toThrow('locked')
  })
})
