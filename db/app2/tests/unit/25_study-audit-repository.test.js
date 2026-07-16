/**
 * Tests for the study-audit feature (features/audit-studies):
 *   - StudyRepository.getStudyAuditSummary (AUDIT aggregation, access filter)
 *   - StudyRepository.updateEnrollmentStatus(Bulk) (status write path)
 *   - StudyRepository.getEnrollmentStatusCounts(ForStudies)
 *   - StudyRepository.getOpenAuditCountsForStudies
 *   - StudyRepository.getCohortUserStats (per-user activity merge)
 *   - Regression: "completed" still counts as enrolled (!= 'withdrawn')
 *
 * Strategy: mock the connection, drive the repository methods, assert SQL + params.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import StudyRepository from 'src/core/database/repositories/study-repository.js'
import { ENROLLMENT_STATUSES, normalizeEnrollmentStatus } from 'src/shared/utils/enrollment-status.js'

const makeConnection = () => ({
  executeQuery: vi.fn().mockResolvedValue({ success: true, data: [] }),
  executeCommand: vi.fn().mockResolvedValue({ success: true }),
})

describe('StudyRepository.getStudyAuditSummary', () => {
  let connection
  let repo

  beforeEach(() => {
    connection = makeConnection()
    repo = new StudyRepository(connection)
  })

  it('aggregates open audits per patient and per user (admin, unfiltered)', async () => {
    connection.executeQuery
      .mockResolvedValueOnce({
        success: true,
        data: [
          { patientNum: 10, patientCd: 'P10', patientBlob: null, auditCount: 3 },
          { patientNum: 11, patientCd: 'P11', patientBlob: '{"name":"Max"}', auditCount: 1 },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ userCd: 'ste', userName: 'Stefan User', auditCount: 4 }],
      })

    const summary = await repo.getStudyAuditSummary(7, { userId: 1, isAdmin: true })

    const [patientSql, patientParams] = connection.executeQuery.mock.calls[0]
    expect(patientSql).toContain("VALUEFLAG_CD = 'AUDIT'")
    expect(patientSql).toContain('JOIN STUDY_PATIENT_LOOKUP')
    expect(patientSql).toContain("!= 'withdrawn'")
    expect(patientSql).not.toContain('EXISTS')
    expect(patientParams).toEqual([7])

    const [userSql] = connection.executeQuery.mock.calls[1]
    expect(userSql).toContain('GROUP BY o.PROVIDER_ID')
    expect(userSql).toContain('LEFT JOIN USER_MANAGEMENT u ON u.USER_CD = o.PROVIDER_ID')

    expect(summary.total).toBe(4)
    expect(summary.byPatient).toHaveLength(2)
    expect(summary.byPatient[0]).toEqual({ patientNum: 10, patientCd: 'P10', patientBlob: null, auditCount: 3 })
    expect(summary.byUser).toEqual([{ userCd: 'ste', userName: 'Stefan User', auditCount: 4 }])
  })

  it('adds the USER_PATIENT_LOOKUP EXISTS clause for regular users', async () => {
    await repo.getStudyAuditSummary(7, { userId: 3, isAdmin: false })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('EXISTS')
    expect(sql).toContain('upl.USER_ID = ? OR upl.USER_ID = 0')
    expect(params).toEqual([7, 3])
  })
})

describe('StudyRepository.updateEnrollmentStatusBulk', () => {
  let connection
  let repo

  beforeEach(() => {
    connection = makeConnection()
    repo = new StudyRepository(connection)
  })

  it('updates status for multiple patients in one UPDATE', async () => {
    await repo.updateEnrollmentStatusBulk(7, [10, 11, 12], 'completed')

    const [sql, params] = connection.executeCommand.mock.calls[0]
    expect(sql).toContain('UPDATE STUDY_PATIENT_LOOKUP')
    expect(sql).toContain('SET ENROLLMENT_STATUS_CD = ?')
    expect(sql).toContain("CASE WHEN ? = 'withdrawn' THEN date('now') ELSE NULL END")
    expect(sql).toContain('WHERE STUDY_NUM = ? AND PATIENT_NUM IN (?, ?, ?)')
    expect(params).toEqual(['completed', 'completed', 7, 10, 11, 12])
  })

  it('rejects invalid status values', async () => {
    await expect(repo.updateEnrollmentStatusBulk(7, [10], 'done')).rejects.toThrow('Invalid enrollment status')
    expect(connection.executeCommand).not.toHaveBeenCalled()
  })

  it('is a no-op for an empty patient list', async () => {
    await expect(repo.updateEnrollmentStatusBulk(7, [], 'completed')).resolves.toBe(true)
    expect(connection.executeCommand).not.toHaveBeenCalled()
  })

  it('single-patient variant delegates to the bulk update', async () => {
    await repo.updateEnrollmentStatus(7, 10, 'active')

    const [, params] = connection.executeCommand.mock.calls[0]
    expect(params).toEqual(['active', 'active', 7, 10])
  })
})

describe('StudyRepository.getEnrollmentStatusCounts', () => {
  it('maps grouped rows and treats NULL as active via COALESCE', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({
      success: true,
      data: [
        { status: 'active', count: 5 },
        { status: 'completed', count: 3 },
        { status: 'withdrawn', count: 1 },
      ],
    })
    const repo = new StudyRepository(connection)

    const counts = await repo.getEnrollmentStatusCounts(7)

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain("COALESCE(spl.ENROLLMENT_STATUS_CD, 'active')")
    expect(params).toEqual([7])
    expect(counts).toEqual({ active: 5, completed: 3, withdrawn: 1, total: 9 })
  })

  it('batch variant groups per study and access-filters for regular users', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({
      success: true,
      data: [
        { STUDY_NUM: 1, status: 'active', count: 2 },
        { STUDY_NUM: 1, status: 'completed', count: 4 },
        { STUDY_NUM: 2, status: 'active', count: 1 },
      ],
    })
    const repo = new StudyRepository(connection)

    const map = await repo.getEnrollmentStatusCountsForStudies([1, 2], { userId: 3, isAdmin: false })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('spl.STUDY_NUM IN (?, ?)')
    expect(sql).toContain('EXISTS')
    expect(params).toEqual([1, 2, 3])
    expect(map.get(1)).toEqual({ active: 2, completed: 4, withdrawn: 0, total: 6 })
    expect(map.get(2)).toEqual({ active: 1, completed: 0, withdrawn: 0, total: 1 })
  })
})

describe('StudyRepository.getOpenAuditCountsForStudies', () => {
  it('returns a STUDY_NUM → count map for AUDIT-flagged observations', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({
      success: true,
      data: [{ STUDY_NUM: 1, auditCount: 6 }],
    })
    const repo = new StudyRepository(connection)

    const map = await repo.getOpenAuditCountsForStudies([1, 2])

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain("o.VALUEFLAG_CD = 'AUDIT'")
    expect(sql).toContain("!= 'withdrawn'")
    expect(params).toEqual([1, 2])
    expect(map.get(1)).toBe(6)
    expect(map.has(2)).toBe(false)
  })
})

describe('StudyRepository.getCohortUserStats', () => {
  it('merges patients-owned and observations-created by user code', async () => {
    const connection = makeConnection()
    connection.executeQuery
      .mockResolvedValueOnce({
        success: true,
        data: [
          { userCd: 'ste', userName: 'Stefan User', patientsOwned: 12 },
          { userCd: 'db', userName: 'Database User', patientsOwned: 2 },
        ],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          { userCd: 'ste', userName: 'Stefan User', observationsCreated: 340 },
          { userCd: 'SYSTEM', userName: 'SYSTEM', observationsCreated: 9000 },
        ],
      })
    const repo = new StudyRepository(connection)

    const stats = await repo.getCohortUserStats('STROKE_LIPID')

    expect(connection.executeQuery).toHaveBeenCalledTimes(2)
    const [ownedSql] = connection.executeQuery.mock.calls[0]
    expect(ownedSql).toContain('upl.USER_ID != 0')
    const [obsSql] = connection.executeQuery.mock.calls[1]
    expect(obsSql).toContain('GROUP BY o.PROVIDER_ID')

    // Sorted by observationsCreated desc; users from either source appear once
    expect(stats).toEqual([
      { userCd: 'SYSTEM', userName: 'SYSTEM', patientsOwned: 0, observationsCreated: 9000 },
      { userCd: 'ste', userName: 'Stefan User', patientsOwned: 12, observationsCreated: 340 },
      { userCd: 'db', userName: 'Database User', patientsOwned: 2, observationsCreated: 0 },
    ])
  })
})

describe('completed counts as enrolled (regression)', () => {
  let connection
  let repo

  beforeEach(() => {
    connection = makeConnection()
    repo = new StudyRepository(connection)
  })

  it('enrichStudiesWithPatientCounts excludes only withdrawn', async () => {
    await repo.enrichStudiesWithPatientCounts([{ STUDY_NUM: 1, NAME_CHAR: 'S' }])

    const [sql] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain("!= 'withdrawn'")
    expect(sql).not.toContain("= 'active'")
  })

  it('findEnrolledPatientCds excludes only withdrawn', async () => {
    await repo.findEnrolledPatientCds('STROKE_LIPID')

    const [sql] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain("!= 'withdrawn'")
    expect(sql).not.toContain("= 'active'")
  })

  it('getCohortPatientCount excludes only withdrawn', async () => {
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ enrolled: 0 }] })

    await repo.getCohortPatientCount('STROKE_LIPID')

    const [sql] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain("!= 'withdrawn'")
    expect(sql).not.toContain("= 'active'")
  })
})

describe('enrollment-status constants', () => {
  it('exposes the three workflow states', () => {
    expect(ENROLLMENT_STATUSES.map((s) => s.code)).toEqual(['active', 'completed', 'withdrawn'])
  })

  it('normalizes NULL/empty to active', () => {
    expect(normalizeEnrollmentStatus(null)).toBe('active')
    expect(normalizeEnrollmentStatus(undefined)).toBe('active')
    expect(normalizeEnrollmentStatus('completed')).toBe('completed')
  })
})
