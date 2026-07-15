/**
 * Regression tests for the "new visit sometimes doesn't get selected" bug.
 *
 * Root cause chain:
 *   1. electron-preload bound the sqlite3 run callback with .bind(this),
 *      so lastID/changes were always undefined in the Electron app.
 *   2. visit-repository's fallback then resolved the new visit id via
 *      "most recent by START_DATE" — wrong whenever the created visit is
 *      back-dated (or shares a date), selecting an OLD visit after create.
 *
 * The fallback must resolve deterministically via MAX(<autoincrement pk>).
 */

import { describe, it, expect, vi } from 'vitest'

import VisitRepository from 'src/core/database/repositories/visit-repository.js'
import ObservationRepository from 'src/core/database/repositories/observation-repository.js'

const makeConnection = () => ({
  executeQuery: vi.fn().mockResolvedValue({ success: true, data: [] }),
  executeCommand: vi.fn().mockResolvedValue({ success: true }), // NO lastID (Electron pre-fix behaviour)
})

describe('VisitRepository.createVisit id fallback', () => {
  it('resolves the new id via MAX(ENCOUNTER_NUM), not by START_DATE ordering', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ maxId: 77 }] })
    const repo = new VisitRepository(connection)

    const created = await repo.createVisit({ PATIENT_NUM: 5, START_DATE: '2020-01-01' })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('MAX(ENCOUNTER_NUM)')
    expect(sql).toContain('WHERE PATIENT_NUM = ?')
    expect(sql).not.toContain('ORDER BY START_DATE')
    expect(params).toEqual([5])
    expect(created.ENCOUNTER_NUM).toBe(77)
  })

  it('uses lastID directly when the connection provides it (no fallback query)', async () => {
    const connection = makeConnection()
    connection.executeCommand.mockResolvedValue({ success: true, lastID: 123 })
    const repo = new VisitRepository(connection)

    const created = await repo.createVisit({ PATIENT_NUM: 5, START_DATE: '2020-01-01' })

    expect(created.ENCOUNTER_NUM).toBe(123)
    expect(connection.executeQuery).not.toHaveBeenCalled()
  })
})

describe('ObservationRepository.createObservation id fallback', () => {
  it('resolves the new id via MAX(OBSERVATION_ID) for the encounter', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ maxId: 991 }] })
    const repo = new ObservationRepository(connection)

    const created = await repo.createObservation({ ENCOUNTER_NUM: 7, PATIENT_NUM: 5, CONCEPT_CD: 'LID: 1', VALTYPE_CD: 'N' })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('MAX(OBSERVATION_ID)')
    expect(sql).toContain('WHERE ENCOUNTER_NUM = ?')
    expect(params).toEqual([7])
    expect(created.OBSERVATION_ID).toBe(991)
  })
})
