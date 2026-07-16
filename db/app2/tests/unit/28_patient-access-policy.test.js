/**
 * Tests for the patient access/rights policy and the study-membership removal:
 *   - canManagePatientAccess (admin | owner | ownerless-public)
 *   - StudyRepository.removePatientFromStudy (hard delete of the lookup row,
 *     distinct from withdrawPatient which only flips the status)
 */

import { describe, it, expect, vi } from 'vitest'
import { canManagePatientAccess } from 'src/shared/utils/patient-access.js'
import StudyRepository from 'src/core/database/repositories/study-repository.js'

describe('canManagePatientAccess', () => {
  it('admins may always manage', () => {
    expect(canManagePatientAccess({ isAdmin: true, currentUserId: 5, ownerUserId: 9, isPublic: false })).toBe(true)
    expect(canManagePatientAccess({ isAdmin: true, currentUserId: null, ownerUserId: null, isPublic: false })).toBe(true)
  })

  it('the owner may manage their own patient', () => {
    expect(canManagePatientAccess({ isAdmin: false, currentUserId: 5, ownerUserId: 5, isPublic: false })).toBe(true)
  })

  it('any logged-in user may manage an ownerless public patient', () => {
    expect(canManagePatientAccess({ isAdmin: false, currentUserId: 5, ownerUserId: null, isPublic: true })).toBe(true)
  })

  it('a non-owner may NOT manage an owned patient', () => {
    expect(canManagePatientAccess({ isAdmin: false, currentUserId: 5, ownerUserId: 9, isPublic: true })).toBe(false)
  })

  it('an ownerless PRIVATE patient is not manageable by a regular user', () => {
    expect(canManagePatientAccess({ isAdmin: false, currentUserId: 5, ownerUserId: null, isPublic: false })).toBe(false)
  })

  it('an unauthenticated user may never manage', () => {
    expect(canManagePatientAccess({ isAdmin: false, currentUserId: null, ownerUserId: null, isPublic: true })).toBe(false)
    expect(canManagePatientAccess({ isAdmin: false, currentUserId: undefined, ownerUserId: null, isPublic: true })).toBe(false)
  })
})

describe('StudyRepository.removePatientFromStudy', () => {
  const makeConnection = () => ({
    executeQuery: vi.fn().mockResolvedValue({ success: true, data: [] }),
    executeCommand: vi.fn().mockResolvedValue({ success: true }),
  })

  it('hard-deletes the STUDY_PATIENT_LOOKUP row for the study+patient', async () => {
    const connection = makeConnection()
    const repo = new StudyRepository(connection)

    await repo.removePatientFromStudy(4, 42)

    const [sql, params] = connection.executeCommand.mock.calls[0]
    expect(sql).toContain('DELETE FROM STUDY_PATIENT_LOOKUP')
    expect(sql).toContain('STUDY_NUM = ? AND PATIENT_NUM = ?')
    expect(params).toEqual([4, 42])
  })

  it('throws when the delete command fails', async () => {
    const connection = makeConnection()
    connection.executeCommand.mockResolvedValue({ success: false, error: 'locked' })
    const repo = new StudyRepository(connection)

    await expect(repo.removePatientFromStudy(4, 42)).rejects.toThrow('locked')
  })
})
