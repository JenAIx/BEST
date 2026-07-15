/**
 * Tests for the user-access fixes (fixes/user-access):
 *   - PatientRepository.findAccessiblePatientByCode (filtered vs unfiltered)
 *   - UserPatientLookupRepository.getPatientAccessInfo (owner + public resolution)
 *   - UserPatientLookupRepository.getPatientNumsCreatedBy (creator filter source)
 *   - Migration 012 backfill SQL (public access for unassigned patients)
 *
 * Strategy: mock the connection, drive the repository methods, assert SQL + params.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import PatientRepository from 'src/core/database/repositories/patient-repository.js'
import UserPatientLookupRepository from 'src/core/database/repositories/user-patient-lookup-repository.js'
import StudyRepository from 'src/core/database/repositories/study-repository.js'
import { DatabaseImportService } from 'src/core/services/imports/database-import-service.js'
import { publicPatientAccess } from 'src/core/database/migrations/012-public-patient-access.js'

const makeConnection = () => ({
  executeQuery: vi.fn().mockResolvedValue({ success: true, data: [] }),
  executeCommand: vi.fn().mockResolvedValue({ success: true }),
})

describe('PatientRepository.findAccessiblePatientByCode', () => {
  let connection
  let repo

  beforeEach(() => {
    connection = makeConnection()
    repo = new PatientRepository(connection)
  })

  it('filters via USER_PATIENT_LOOKUP for regular users (own or public)', async () => {
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ PATIENT_NUM: 925, PATIENT_CD: '10047128' }] })

    const patient = await repo.findAccessiblePatientByCode('10047128', { userId: 3, isAdmin: false })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('INNER JOIN USER_PATIENT_LOOKUP')
    expect(sql).toContain('upl.USER_ID = ? OR upl.USER_ID = 0')
    expect(params).toEqual(['10047128', 3])
    expect(patient.PATIENT_NUM).toBe(925)
  })

  it('returns null when a regular user has no access', async () => {
    connection.executeQuery.mockResolvedValue({ success: true, data: [] })

    const patient = await repo.findAccessiblePatientByCode('10047128', { userId: 3, isAdmin: false })

    expect(patient).toBeNull()
  })

  it('does not filter for admins', async () => {
    await repo.findAccessiblePatientByCode('10047128', { userId: 1, isAdmin: true })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).not.toContain('USER_PATIENT_LOOKUP')
    expect(params).toEqual(['10047128'])
  })

  it('does not filter without user context', async () => {
    await repo.findAccessiblePatientByCode('10047128', null)

    const [sql] = connection.executeQuery.mock.calls[0]
    expect(sql).not.toContain('USER_PATIENT_LOOKUP')
  })
})

describe('PatientRepository.getAccessFilter', () => {
  it('returns the shared predicate for regular users', () => {
    const repo = new PatientRepository(makeConnection())
    const access = repo.getAccessFilter({ userId: 3, isAdmin: false })
    expect(access.join).toContain('USER_PATIENT_LOOKUP')
    expect(access.condition).toBe('(upl.USER_ID = ? OR upl.USER_ID = 0)')
    expect(access.param).toBe(3)
  })

  it('returns null for admins and missing context', () => {
    const repo = new PatientRepository(makeConnection())
    expect(repo.getAccessFilter({ userId: 1, isAdmin: true })).toBeNull()
    expect(repo.getAccessFilter(null)).toBeNull()
    expect(repo.getAccessFilter({ userId: null, isAdmin: false })).toBeNull()
  })
})

describe('PatientRepository.findAccessiblePatientsByCodes', () => {
  it('filters the batch for regular users and drops inaccessible codes', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ PATIENT_NUM: 4, PATIENT_CD: 'A' }] })
    const repo = new PatientRepository(connection)

    const patients = await repo.findAccessiblePatientsByCodes(['A', 'B'], { userId: 3, isAdmin: false })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('INNER JOIN USER_PATIENT_LOOKUP')
    expect(sql).toContain('p.PATIENT_CD IN (?,?)')
    expect(params).toEqual(['A', 'B', 3])
    expect(patients).toHaveLength(1)
  })

  it('does not filter for admins', async () => {
    const connection = makeConnection()
    const repo = new PatientRepository(connection)

    await repo.findAccessiblePatientsByCodes(['A', 'B'], { userId: 1, isAdmin: true })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).not.toContain('USER_PATIENT_LOOKUP')
    expect(params).toEqual(['A', 'B'])
  })

  it('returns [] for empty input without querying', async () => {
    const connection = makeConnection()
    const repo = new PatientRepository(connection)
    expect(await repo.findAccessiblePatientsByCodes([], { userId: 3, isAdmin: false })).toEqual([])
    expect(connection.executeQuery).not.toHaveBeenCalled()
  })
})

describe('PatientRepository.searchPatientsWithConcepts (access)', () => {
  it('applies the access filter for regular users', async () => {
    const connection = makeConnection()
    const repo = new PatientRepository(connection)

    await repo.searchPatientsWithConcepts('abc', { userId: 3, isAdmin: false })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('INNER JOIN USER_PATIENT_LOOKUP')
    expect(sql).toContain('(upl.USER_ID = ? OR upl.USER_ID = 0)')
    expect(params[0]).toBe(3)
    expect(params).toHaveLength(10)
  })
})

describe('PatientRepository.countByCriteriaFromView (access join + criteria)', () => {
  it('prefixes criteria columns so PATIENT_NUM is not ambiguous in the access join', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ count: 2 }] })
    const repo = new PatientRepository(connection)

    const count = await repo.countByCriteriaFromView({
      patientNums: [4, 8],
      _userAccess: { userId: 3, isAdmin: false },
    })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('INNER JOIN USER_PATIENT_LOOKUP')
    expect(sql).toContain('p.PATIENT_NUM IN (?, ?)')
    expect(sql).not.toMatch(/WHERE.*[^.]\bPATIENT_NUM IN/)
    expect(params).toEqual([4, 8, 3])
    expect(count).toBe(2)
  })

  it('uses bare columns without the access join (admin)', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ count: 5 }] })
    const repo = new PatientRepository(connection)

    const count = await repo.countByCriteriaFromView({
      patientNums: [4, 8],
      _userAccess: { userId: 1, isAdmin: true },
    })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).not.toContain('USER_PATIENT_LOOKUP')
    expect(sql).toContain('PATIENT_NUM IN (?, ?)')
    expect(params).toEqual([4, 8])
    expect(count).toBe(5)
  })
})

describe('UserPatientLookupRepository.getPatientAccessInfo', () => {
  let connection
  let repo

  beforeEach(() => {
    connection = makeConnection()
    repo = new UserPatientLookupRepository(connection)
  })

  it('resolves owner from the creator row and public from USER_ID 0', async () => {
    connection.executeQuery.mockResolvedValue({
      success: true,
      data: [
        { PATIENT_NUM: 10, USER_ID: 3, UPL_NAME: 'Creator access - auto-assigned', USER_CD: 'ste', USER_NAME: 'Stefan User' },
        { PATIENT_NUM: 10, USER_ID: 0, UPL_NAME: 'Public access', USER_CD: 'public', USER_NAME: 'Public User' },
        { PATIENT_NUM: 11, USER_ID: 2, UPL_NAME: 'Access granted manually', USER_CD: 'db', USER_NAME: 'Database User' },
      ],
    })

    const accessMap = await repo.getPatientAccessInfo([10, 11])

    expect(accessMap.get(10)).toEqual({ ownerUserId: 3, ownerUserCd: 'ste', ownerName: 'Stefan User', isPublic: true })
    // Manual (non-creator) association: no owner, not public
    expect(accessMap.get(11)).toEqual({ ownerUserId: null, ownerUserCd: null, ownerName: null, isPublic: false })
  })

  it('passes patientNums as IN params', async () => {
    await repo.getPatientAccessInfo([1, 2, 3])

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('PATIENT_NUM IN (?, ?, ?)')
    expect(params).toEqual([1, 2, 3])
  })

  it('returns an empty map for empty input without querying', async () => {
    const accessMap = await repo.getPatientAccessInfo([])

    expect(accessMap.size).toBe(0)
    expect(connection.executeQuery).not.toHaveBeenCalled()
  })
})

describe('UserPatientLookupRepository.getPatientNumsCreatedBy', () => {
  it('selects only creator rows of the given user', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ PATIENT_NUM: 4 }, { PATIENT_NUM: 8 }] })
    const repo = new UserPatientLookupRepository(connection)

    const nums = await repo.getPatientNumsCreatedBy(3)

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain("NAME_CHAR = 'Creator access - auto-assigned'")
    expect(params).toEqual([3])
    expect(nums).toEqual([4, 8])
  })

  it('returns all public patients for the public user (0), regardless of NAME_CHAR', async () => {
    const connection = makeConnection()
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ PATIENT_NUM: 925 }] })
    const repo = new UserPatientLookupRepository(connection)

    const nums = await repo.getPatientNumsCreatedBy(0)

    const [sql] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('USER_ID = 0')
    expect(sql).not.toContain('Creator access')
    expect(nums).toEqual([925])
  })
})

describe('StudyRepository.getEnrolledPatients (access)', () => {
  it('restricts enrolled patients to accessible ones for regular users', async () => {
    const connection = makeConnection()
    const repo = new StudyRepository(connection)

    await repo.getEnrolledPatients(7, { userId: 3, isAdmin: false })

    const [sql, params] = connection.executeQuery.mock.calls[0]
    expect(sql).toContain('EXISTS')
    expect(sql).toContain('(upl.USER_ID = ? OR upl.USER_ID = 0)')
    expect(params).toEqual([7, 3])
  })

  it('does not filter for admins or without context', async () => {
    const connection = makeConnection()
    const repo = new StudyRepository(connection)

    await repo.getEnrolledPatients(7)
    await repo.getEnrolledPatients(7, { userId: 1, isAdmin: true })

    for (const [sql, params] of connection.executeQuery.mock.calls) {
      expect(sql).not.toContain('USER_PATIENT_LOOKUP')
      expect(params).toEqual([7])
    }
  })
})

describe('DatabaseImportService.assignPatientAccess', () => {
  const callWith = async (config, lookupRepo) => {
    await DatabaseImportService.prototype.assignPatientAccess.call({ userPatientLookupRepo: lookupRepo }, 42, config)
  }

  it('writes creator + public rows by default', async () => {
    const lookupRepo = { addAssociationIfMissing: vi.fn().mockResolvedValue({ success: true }) }

    await callWith({ currentUserId: 3, assignPublicAccess: true }, lookupRepo)

    expect(lookupRepo.addAssociationIfMissing).toHaveBeenCalledWith(3, 42, { nameChar: 'Creator access - auto-assigned' })
    expect(lookupRepo.addAssociationIfMissing).toHaveBeenCalledWith(0, 42, { nameChar: 'Public access - import' })
  })

  it('skips public row when assignPublicAccess is false and creator when no user', async () => {
    const lookupRepo = { addAssociationIfMissing: vi.fn().mockResolvedValue({ success: true }) }

    await callWith({ currentUserId: null, assignPublicAccess: false }, lookupRepo)

    expect(lookupRepo.addAssociationIfMissing).not.toHaveBeenCalled()
  })
})

describe('Migration 012-public-patient-access', () => {
  it('backfills public access only for patients without any association', async () => {
    const connection = makeConnection()

    await publicPatientAccess.execute(connection)

    const [sql] = connection.executeCommand.mock.calls[0]
    expect(sql).toContain('INSERT INTO USER_PATIENT_LOOKUP')
    expect(sql).toContain('SELECT 0, p.PATIENT_NUM')
    expect(sql).toContain('NOT EXISTS')
    expect(publicPatientAccess.name).toBe('012-public-patient-access')
  })
})
