/**
 * User-Patient Lookup Repository
 *
 * Owns USER_PATIENT_LOOKUP CRUD so that callers (database-store auto-assignment,
 * user-store association management, PatientAccessManagement.vue) share one
 * implementation instead of three slightly-different inline SQL strings.
 */

import BaseRepository from './base-repository.js'

class UserPatientLookupRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'USER_PATIENT_LOOKUP', 'USER_PATIENT_ID')
  }

  /**
   * @returns {Promise<Object|null>} existing association or null
   */
  async findByUserAndPatient(userId, patientNum) {
    const result = await this.connection.executeQuery(
      `SELECT * FROM USER_PATIENT_LOOKUP WHERE USER_ID = ? AND PATIENT_NUM = ? LIMIT 1`,
      [userId, patientNum],
    )
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Insert an association. Throws on duplicate (same USER_ID + PATIENT_NUM).
   */
  async addAssociation(userId, patientNum, { nameChar = null, blob = null } = {}) {
    const existing = await this.findByUserAndPatient(userId, patientNum)
    if (existing) {
      const error = new Error('This user-patient association already exists')
      error.code = 'DUPLICATE_ASSOCIATION'
      error.existingAssociation = existing
      throw error
    }
    const result = await this.connection.executeCommand(
      `INSERT INTO USER_PATIENT_LOOKUP (USER_ID, PATIENT_NUM, NAME_CHAR, USER_PATIENT_BLOB, UPDATE_DATE, IMPORT_DATE)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [userId, patientNum, nameChar, blob],
    )
    if (!result.success) {
      throw new Error(result.error || 'Failed to create user-patient association')
    }
    return result
  }

  /**
   * Idempotent insert — used when a creator should be auto-linked to a new patient
   * without erroring on existing rows (e.g. re-import).
   */
  async addAssociationIfMissing(userId, patientNum, { nameChar = null, blob = null } = {}) {
    const result = await this.connection.executeCommand(
      `INSERT OR IGNORE INTO USER_PATIENT_LOOKUP (USER_ID, PATIENT_NUM, NAME_CHAR, USER_PATIENT_BLOB, UPDATE_DATE, IMPORT_DATE)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [userId, patientNum, nameChar, blob],
    )
    if (!result.success) {
      throw new Error(result.error || 'Failed to assign user-patient association')
    }
    return result
  }

  /**
   * Batch-resolve access info for a set of patients.
   *
   * Owner semantics: the creator row is the USER_PATIENT_LOOKUP entry written by
   * database-store.createPatient with NAME_CHAR = 'Creator access - auto-assigned'.
   * Public = an entry linking the patient to the public user (USER_ID = 0).
   *
   * @param {number[]} patientNums
   * @returns {Promise<Map<number, {ownerUserId: number|null, ownerUserCd: string|null, ownerName: string|null, isPublic: boolean}>>}
   */
  async getPatientAccessInfo(patientNums) {
    const accessMap = new Map()
    if (!Array.isArray(patientNums) || patientNums.length === 0) return accessMap

    const placeholders = patientNums.map(() => '?').join(', ')
    const result = await this.connection.executeQuery(
      `SELECT upl.PATIENT_NUM, upl.USER_ID, upl.NAME_CHAR as UPL_NAME, u.USER_CD, u.NAME_CHAR as USER_NAME
       FROM USER_PATIENT_LOOKUP upl
       JOIN USER_MANAGEMENT u ON u.USER_ID = upl.USER_ID
       WHERE upl.PATIENT_NUM IN (${placeholders})`,
      patientNums,
    )
    if (!result.success) return accessMap

    for (const row of result.data) {
      const entry = accessMap.get(row.PATIENT_NUM) || { ownerUserId: null, ownerUserCd: null, ownerName: null, isPublic: false }
      if (row.UPL_NAME === 'Creator access - auto-assigned') {
        entry.ownerUserId = row.USER_ID
        entry.ownerUserCd = row.USER_CD
        entry.ownerName = row.USER_NAME
      }
      if (row.USER_ID === 0) {
        entry.isPublic = true
      }
      accessMap.set(row.PATIENT_NUM, entry)
    }
    return accessMap
  }

  /**
   * PATIENT_NUMs of all patients created by a given user (creator rows only).
   * Used by the "created by" filter in the patient selector.
   *
   * Special case: the public user (USER_ID 0) never creates patients — its rows
   * mark public visibility. Selecting it in the filter returns all public
   * patients instead (any NAME_CHAR, e.g. 'Public access', migration backfill).
   *
   * @returns {Promise<number[]>}
   */
  async getPatientNumsCreatedBy(userId) {
    const result =
      userId === 0
        ? await this.connection.executeQuery(`SELECT PATIENT_NUM FROM USER_PATIENT_LOOKUP WHERE USER_ID = 0`)
        : await this.connection.executeQuery(
            `SELECT PATIENT_NUM FROM USER_PATIENT_LOOKUP
             WHERE USER_ID = ? AND NAME_CHAR = 'Creator access - auto-assigned'`,
            [userId],
          )
    return result.success ? result.data.map((row) => row.PATIENT_NUM) : []
  }

  /**
   * PATIENT_NUMs of all patients directly assigned to a user (creator rows AND
   * manual grants — public rows of USER_ID 0 do NOT count). Backs the
   * "only my patients" quick filter in the patient search.
   *
   * @returns {Promise<number[]>}
   */
  async getPatientNumsAssignedTo(userId) {
    const result = await this.connection.executeQuery(`SELECT DISTINCT PATIENT_NUM FROM USER_PATIENT_LOOKUP WHERE USER_ID = ?`, [userId])
    return result.success ? result.data.map((row) => row.PATIENT_NUM) : []
  }

  /**
   * Transfer the owner (creator) role of a patient to another user.
   * The previous owner's creator row is downgraded to a manual grant (keeps
   * access); the new owner's existing grant is promoted, or a fresh creator
   * row is inserted.
   */
  async transferOwnership(patientNum, newUserId) {
    // Downgrade current creator row(s) — former owner keeps plain access
    await this.connection.executeCommand(
      `UPDATE USER_PATIENT_LOOKUP
       SET NAME_CHAR = 'Manual access - former owner', UPDATE_DATE = datetime('now')
       WHERE PATIENT_NUM = ? AND NAME_CHAR = 'Creator access - auto-assigned'`,
      [patientNum],
    )

    // Promote an existing grant of the new owner, or insert a creator row
    const existing = await this.findByUserAndPatient(newUserId, patientNum)
    if (existing) {
      const result = await this.connection.executeCommand(
        `UPDATE USER_PATIENT_LOOKUP
         SET NAME_CHAR = 'Creator access - auto-assigned', UPDATE_DATE = datetime('now')
         WHERE USER_PATIENT_ID = ?`,
        [existing.USER_PATIENT_ID],
      )
      if (!result.success) throw new Error(result.error || 'Failed to transfer ownership')
      return result
    }
    return await this.addAssociation(newUserId, patientNum, { nameChar: 'Creator access - auto-assigned' })
  }

  /**
   * Grant or revoke public visibility (USER_ID 0 row) for a patient.
   */
  async setPublicAccess(patientNum, isPublic) {
    if (isPublic) {
      return await this.addAssociationIfMissing(0, patientNum, { nameChar: 'Public access' })
    }
    return await this.removeByUserAndPatient(0, patientNum)
  }

  async removeByUserAndPatient(userId, patientNum) {
    const result = await this.connection.executeCommand(
      `DELETE FROM USER_PATIENT_LOOKUP WHERE USER_ID = ? AND PATIENT_NUM = ?`,
      [userId, patientNum],
    )
    if (!result.success) {
      throw new Error(result.error || 'Failed to remove user-patient association')
    }
    return result
  }

  async removeById(associationId) {
    const result = await this.connection.executeCommand(
      `DELETE FROM USER_PATIENT_LOOKUP WHERE USER_PATIENT_ID = ?`,
      [associationId],
    )
    if (!result.success) {
      throw new Error(result.error || 'Failed to remove user-patient association')
    }
    return result
  }
}

export default UserPatientLookupRepository
