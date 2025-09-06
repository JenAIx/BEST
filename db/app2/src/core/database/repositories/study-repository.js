/**
 * Study Repository
 *
 * Handles database operations for research studies.
 * Provides CRUD operations and queries for study management.
 */

import BaseRepository from './base-repository.js'
import { createLogger } from '../../services/logging-service.js'

class StudyRepository extends BaseRepository {
  constructor(connection) {
    super(connection)
    this.logger = createLogger('StudyRepository')
    this.tableName = 'STUDY_DIMENSION'
    this.primaryKey = 'STUDY_NUM'
  }

  /**
   * Create a new study
   * @param {Object} studyData - Study data
   * @returns {Promise<Object>} Created study
   */
  async create(studyData) {
    try {
      this.logger.info('Creating new study', { studyName: studyData.name })

      // Generate unique study code if not provided
      const studyCd = studyData.studyCd || `STUDY_${Date.now()}`

      const sql = `
        INSERT INTO STUDY_DIMENSION (
          STUDY_CD, NAME_CHAR, CATEGORY_CHAR, DESCRIPTION_CHAR,
          STATUS_CD, PRINCIPAL_INVESTIGATOR, TARGET_PATIENT_COUNT,
          FUNDING_CD, START_DATE, END_DATE, STUDY_BLOB
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      const params = [
        studyCd,
        studyData.name,
        studyData.category,
        studyData.description,
        studyData.status || 'planning',
        studyData.principalInvestigator,
        studyData.targetPatientCount,
        studyData.funding,
        studyData.startDate,
        studyData.endDate,
        studyData.notes ? JSON.stringify({ notes: studyData.notes }) : null
      ]

      // Execute the insert and get the last inserted ID using SQLite's last_insert_rowid()
      const insertResult = await this.connection.executeCommand(sql, params)

      // Use SQLite's built-in function to get the last inserted row ID
      const idResult = await this.connection.executeQuery('SELECT last_insert_rowid() as id')
      let studyId = idResult.success && idResult.data.length > 0 ? idResult.data[0].id : null

      this.logger.success('Study created', { studyId, studyName: studyData.name, insertResult, idResult })

      // Fallback: if still no ID, try querying by name
      if (!studyId) {
        this.logger.warn('Could not get study ID, trying fallback query...')
        try {
          const fallbackResult = await this.connection.executeQuery(
            'SELECT STUDY_NUM FROM STUDY_DIMENSION WHERE NAME_CHAR = ? ORDER BY CREATED_AT DESC LIMIT 1',
            [studyData.name]
          )
          if (fallbackResult.success && fallbackResult.data.length > 0) {
            studyId = fallbackResult.data[0].STUDY_NUM
            this.logger.info('Retrieved study ID from fallback query', { studyId })
          }
        } catch (queryError) {
          this.logger.error('Fallback query failed', queryError)
        }
      }

      if (!studyId) {
        throw new Error('Failed to get study ID after creation')
      }

      const createdStudy = await this.findById(studyId)
      if (!createdStudy) {
        throw new Error(`Study created but not found with ID: ${studyId}`)
      }

      return createdStudy
    } catch (error) {
      this.logger.error('Failed to create study', error)
      throw error
    }
  }

  /**
   * Update an existing study
   * @param {number} studyId - Study ID
   * @param {Object} updateData - Updated study data
   * @returns {Promise<Object>} Updated study
   */
  async update(studyId, updateData) {
    try {
      this.logger.info('Updating study', { studyId })

      const updateFields = []
      const params = []

      // Build dynamic update query
      Object.keys(updateData).forEach(key => {
        if (key !== 'STUDY_NUM' && key !== 'CREATED_AT') {
          updateFields.push(`${key} = ?`)
          params.push(updateData[key])
        }
      })

      // Always update UPDATED_AT
      updateFields.push('UPDATED_AT = CURRENT_TIMESTAMP')
      params.push(studyId)

      const sql = `
        UPDATE STUDY_DIMENSION
        SET ${updateFields.join(', ')}
        WHERE STUDY_NUM = ?
      `

      await this.connection.executeCommand(sql, params)

      this.logger.success('Study updated', { studyId })

      return await this.findById(studyId)
    } catch (error) {
      this.logger.error('Failed to update study', error)
      throw error
    }
  }

  /**
   * Delete a study
   * @param {number} studyId - Study ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(studyId) {
    try {
      this.logger.info('Deleting study', { studyId })

      const sql = 'DELETE FROM STUDY_DIMENSION WHERE STUDY_NUM = ?'
      await this.connection.executeCommand(sql, [studyId])

      this.logger.success('Study deleted', { studyId })

      return true
    } catch (error) {
      this.logger.error('Failed to delete study', error)
      throw error
    }
  }

  /**
   * Find study by study code
   * @param {string} studyCode - Study code
   * @returns {Promise<Object|null>} Study object or null
   */
  async findByCode(studyCode) {
    try {
      this.logger.debug('Finding study by code', { studyCode })

      const sql = 'SELECT * FROM STUDY_DIMENSION WHERE STUDY_CD = ?'
      const result = await this.connection.executeQuery(sql, [studyCode])

      if (result.success && result.data.length > 0) {
        return this.transformStudyData(result.data[0])
      }
      return null
    } catch (error) {
      this.logger.error('Failed to find study by code', error)
      throw error
    }
  }

  /**
   * Transform raw database study data to application format
   * @param {Object} rawStudy - Raw study data from database
   * @returns {Object} Transformed study data
   */
  transformStudyData(rawStudy) {
    const study = { ...rawStudy }

    // Transform field names to match application expectations
    study.id = study.STUDY_NUM
    study.name = study.NAME_CHAR
    study.category = study.CATEGORY_CHAR
    study.description = study.DESCRIPTION_CHAR
    study.status = study.STATUS_CD
    study.principalInvestigator = study.PRINCIPAL_INVESTIGATOR
    study.targetPatientCount = study.TARGET_PATIENT_COUNT
    study.funding = study.FUNDING_CD
    study.startDate = study.START_DATE
    study.endDate = study.END_DATE
    study.created = study.CREATED_AT
    study.updated = study.UPDATED_AT

    // Parse JSON data if exists
    if (study.STUDY_BLOB) {
      try {
        const blobData = JSON.parse(study.STUDY_BLOB)
        if (blobData.notes) {
          study.notes = blobData.notes
        }
      } catch (error) {
        this.logger.warn('Failed to parse study blob data', { studyId: study.id, error })
      }
    }

    return study
  }

  /**
   * Search studies by various criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Array of studies
   */
  async search(criteria = {}) {
    try {
      this.logger.debug('Searching studies', { criteria })

      let sql = 'SELECT * FROM STUDY_DIMENSION WHERE 1=1'
      const params = []

      if (criteria.name) {
        sql += ' AND NAME_CHAR LIKE ?'
        params.push(`%${criteria.name}%`)
      }

      if (criteria.category) {
        sql += ' AND CATEGORY_CHAR = ?'
        params.push(criteria.category)
      }

      if (criteria.status) {
        sql += ' AND STATUS_CD = ?'
        params.push(criteria.status)
      }

      if (criteria.principalInvestigator) {
        sql += ' AND PRINCIPAL_INVESTIGATOR LIKE ?'
        params.push(`%${criteria.principalInvestigator}%`)
      }

      sql += ' ORDER BY UPDATED_AT DESC'

      this.logger.info('Executing search query', { sql, params, criteria })

      const result = await this.connection.executeQuery(sql, params)
      const transformedResults = result.success ? result.data.map(study => this.transformStudyData(study)) : []
      
      this.logger.info('Search query completed', { 
        rawResultCount: result.success ? result.data.length : 0,
        transformedResultCount: transformedResults.length,
        sql, 
        params 
      })

      return transformedResults
    } catch (error) {
      this.logger.error('Failed to search studies', error)
      throw error
    }
  }

  /**
   * Get studies by category
   * @param {string} category - Study category
   * @returns {Promise<Array>} Array of studies
   */
  async findByCategory(category) {
    try {
      this.logger.debug('Finding studies by category', { category })

      const sql = 'SELECT * FROM STUDY_DIMENSION WHERE CATEGORY_CHAR = ? ORDER BY UPDATED_AT DESC'
      const result = await this.connection.executeQuery(sql, [category])

      return result.success ? result.data : []
    } catch (error) {
      this.logger.error('Failed to find studies by category', error)
      throw error
    }
  }

  /**
   * Get studies by status
   * @param {string} status - Study status
   * @returns {Promise<Array>} Array of studies
   */
  async findByStatus(status) {
    try {
      this.logger.debug('Finding studies by status', { status })

      const sql = 'SELECT * FROM STUDY_DIMENSION WHERE STATUS_CD = ? ORDER BY UPDATED_AT DESC'
      const result = await this.connection.executeQuery(sql, [status])

      return result.success ? result.data : []
    } catch (error) {
      this.logger.error('Failed to find studies by status', error)
      throw error
    }
  }

  /**
   * Enroll a patient in a study
   * @param {number} studyId - Study ID
   * @param {number} patientId - Patient ID
   * @param {Object} enrollmentData - Enrollment data
   * @returns {Promise<Object>} Enrollment record
   */
  async enrollPatient(studyId, patientId, enrollmentData = {}) {
    try {
      this.logger.info('Enrolling patient in study', { studyId, patientId })

      const sql = `
        INSERT OR REPLACE INTO STUDY_PATIENT_LOOKUP (
          STUDY_NUM, PATIENT_NUM, ENROLLMENT_DATE, WITHDRAWAL_DATE,
          ENROLLMENT_STATUS_CD, STUDY_PATIENT_BLOB, UPDATE_DATE,
          DOWNLOAD_DATE, IMPORT_DATE, UPLOAD_ID
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      const params = [
        studyId,
        patientId,
        enrollmentData.ENROLLMENT_DATE || new Date().toISOString().split('T')[0],
        enrollmentData.WITHDRAWAL_DATE,
        enrollmentData.ENROLLMENT_STATUS_CD || 'active',
        enrollmentData.STUDY_PATIENT_BLOB,
        enrollmentData.UPDATE_DATE,
        enrollmentData.DOWNLOAD_DATE,
        enrollmentData.IMPORT_DATE,
        enrollmentData.UPLOAD_ID
      ]

      await this.connection.executeCommand(sql, params)

      this.logger.success('Patient enrolled in study', { studyId, patientId })

      return { studyId, patientId, ...enrollmentData }
    } catch (error) {
      this.logger.error('Failed to enroll patient', error)
      throw error
    }
  }

  /**
   * Withdraw a patient from a study
   * @param {number} studyId - Study ID
   * @param {number} patientId - Patient ID
   * @param {string} withdrawalDate - Withdrawal date
   * @returns {Promise<boolean>} Success status
   */
  async withdrawPatient(studyId, patientId, withdrawalDate = null) {
    try {
      this.logger.info('Withdrawing patient from study', { studyId, patientId })

      const sql = `
        UPDATE STUDY_PATIENT_LOOKUP
        SET ENROLLMENT_STATUS_CD = 'withdrawn',
            WITHDRAWAL_DATE = ?,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE STUDY_NUM = ? AND PATIENT_NUM = ?
      `

      const withdrawalDateStr = withdrawalDate || new Date().toISOString().split('T')[0]
      await this.connection.executeCommand(sql, [withdrawalDateStr, studyId, patientId])

      this.logger.success('Patient withdrawn from study', { studyId, patientId })

      return true
    } catch (error) {
      this.logger.error('Failed to withdraw patient', error)
      throw error
    }
  }

  /**
   * Get patients enrolled in a study
   * @param {number} studyId - Study ID
   * @returns {Promise<Array>} Array of enrolled patients
   */
  async getEnrolledPatients(studyId) {
    try {
      this.logger.debug('Getting enrolled patients', { studyId })

      const sql = `
        SELECT p.*, sp.ENROLLMENT_DATE, sp.WITHDRAWAL_DATE, sp.ENROLLMENT_STATUS_CD
        FROM PATIENT_DIMENSION p
        INNER JOIN STUDY_PATIENT_LOOKUP sp ON p.PATIENT_NUM = sp.PATIENT_NUM
        WHERE sp.STUDY_NUM = ?
        ORDER BY sp.ENROLLMENT_DATE DESC
      `

      const result = await this.connection.executeQuery(sql, [studyId])
      return result.success ? result.data : []
    } catch (error) {
      this.logger.error('Failed to get enrolled patients', error)
      throw error
    }
  }

  /**
   * Get studies for a patient
   * @param {number} patientId - Patient ID
   * @returns {Promise<Array>} Array of patient's studies
   */
  async getPatientStudies(patientId) {
    try {
      this.logger.debug('Getting patient studies', { patientId })

      const sql = `
        SELECT s.*, sp.ENROLLMENT_DATE, sp.WITHDRAWAL_DATE, sp.ENROLLMENT_STATUS_CD
        FROM STUDY_DIMENSION s
        INNER JOIN STUDY_PATIENT_LOOKUP sp ON s.STUDY_NUM = sp.STUDY_NUM
        WHERE sp.PATIENT_NUM = ?
        ORDER BY sp.ENROLLMENT_DATE DESC
      `

      const result = await this.connection.executeQuery(sql, [patientId])
      return result.success ? result.data : []
    } catch (error) {
      this.logger.error('Failed to get patient studies', error)
      throw error
    }
  }


  /**
   * Get study statistics
   * @returns {Promise<Object>} Study statistics
   */
  async getStatistics() {
    try {
      this.logger.debug('Getting study statistics')

      const stats = {}

      // Total studies
      const totalResult = await this.connection.executeQuery('SELECT COUNT(*) as count FROM STUDY_DIMENSION')
      stats.totalStudies = totalResult.success ? totalResult.data[0].count : 0

      // Studies by status
      const statusResult = await this.connection.executeQuery(`
        SELECT STATUS_CD, COUNT(*) as count
        FROM STUDY_DIMENSION
        GROUP BY STATUS_CD
      `)
      stats.studiesByStatus = statusResult.success ? statusResult.data : []

      // Studies by category
      const categoryResult = await this.connection.executeQuery(`
        SELECT CATEGORY_CHAR, COUNT(*) as count
        FROM STUDY_DIMENSION
        WHERE CATEGORY_CHAR IS NOT NULL
        GROUP BY CATEGORY_CHAR
      `)
      stats.studiesByCategory = categoryResult.success ? categoryResult.data : []

      // Total enrolled patients
      const patientResult = await this.connection.executeQuery(`
        SELECT COUNT(DISTINCT PATIENT_NUM) as count
        FROM STUDY_PATIENT_LOOKUP
        WHERE ENROLLMENT_STATUS_CD = 'active'
      `)
      stats.totalEnrolledPatients = patientResult.success ? patientResult.data[0].count : 0

      return stats
    } catch (error) {
      this.logger.error('Failed to get study statistics', error)
      throw error
    }
  }
}

export default StudyRepository
