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
