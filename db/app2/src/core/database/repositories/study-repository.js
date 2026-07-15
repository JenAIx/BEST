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
    super(connection, 'STUDY_DIMENSION', 'STUDY_NUM')
    this.logger = createLogger('StudyRepository')
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
        studyData.notes ? JSON.stringify({ notes: studyData.notes }) : null,
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
          const fallbackResult = await this.connection.executeQuery('SELECT STUDY_NUM FROM STUDY_DIMENSION WHERE NAME_CHAR = ? ORDER BY CREATED_AT DESC LIMIT 1', [studyData.name])
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

      const rawStudy = await this.findById(studyId)
      if (!rawStudy) {
        throw new Error(`Study created but not found with ID: ${studyId}`)
      }

      // Enrich with patient count
      const enrichedStudies = await this.enrichStudiesWithPatientCounts([rawStudy])
      return enrichedStudies[0]
    } catch (error) {
      this.logger.error('Failed to create study', error)
      throw error
    }
  }

  /**
   * Override findById to include patient count
   * @param {number} studyId - Study ID
   * @returns {Promise<Object|null>} Study with patient count or null
   */
  async findById(studyId) {
    const rawStudy = await super.findById(studyId)
    if (!rawStudy) return null

    // Enrich with patient count
    const enrichedStudies = await this.enrichStudiesWithPatientCounts([rawStudy])
    return enrichedStudies[0]
  }

  /**
   * Override findAll to include patient counts
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Studies with patient counts
   */
  async findAll(options = {}) {
    const rawStudies = await super.findAll(options)
    return await this.enrichStudiesWithPatientCounts(rawStudies)
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

      // Filter out undefined values and protected fields
      const updateFields = []
      const params = []

      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined && key !== 'STUDY_NUM' && key !== 'CREATED_AT') {
          updateFields.push(`${key} = ?`)
          params.push(updateData[key])
        }
      })

      // Always update UPDATED_AT using SQL function
      if (updateFields.length === 0) {
        throw new Error('No fields to update')
      }

      updateFields.push('UPDATED_AT = CURRENT_TIMESTAMP')
      params.push(studyId)

      const sql = `
        UPDATE ${this.tableName}
        SET ${updateFields.join(', ')}
        WHERE ${this.primaryKey} = ?
      `

      await this.connection.executeCommand(sql, params)

      this.logger.success('Study updated', { studyId })

      // Return the updated study with patient count
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
   * @param {number} patientCount - Optional patient count
   * @returns {Object} Transformed study data
   */
  transformStudyData(rawStudy, patientCount = null) {
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

    // Set patient count if provided
    study.patientCount = patientCount !== null ? patientCount : 0

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
   * Enrich studies with patient counts
   * @param {Array} studies - Array of study objects
   * @returns {Promise<Array>} Studies with patientCount added
   */
  async enrichStudiesWithPatientCounts(studies) {
    if (!studies || studies.length === 0) return studies

    try {
      // Get all study IDs
      const studyIds = studies.map((s) => s.STUDY_NUM || s.id).filter((id) => id)

      if (studyIds.length === 0) return studies

      // Get patient counts for all studies in one query
      const placeholders = studyIds.map(() => '?').join(',')
      const countSql = `
        SELECT STUDY_NUM, COUNT(*) as count
        FROM STUDY_PATIENT_LOOKUP
        WHERE STUDY_NUM IN (${placeholders})
        AND ENROLLMENT_STATUS_CD = 'active'
        GROUP BY STUDY_NUM
      `
      const countResult = await this.connection.executeQuery(countSql, studyIds)

      // Create a map of study ID to patient count
      const countMap = new Map()
      if (countResult.success) {
        countResult.data.forEach((row) => {
          countMap.set(row.STUDY_NUM, row.count)
        })
      }

      // Enrich each study with its patient count
      return studies.map((study) => {
        const studyId = study.STUDY_NUM || study.id
        const patientCount = countMap.get(studyId) || 0
        return this.transformStudyData(study, patientCount)
      })
    } catch (error) {
      this.logger.error('Failed to enrich studies with patient counts', error)
      // Return studies without counts on error
      return studies.map((study) => this.transformStudyData(study, 0))
    }
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
      const rawStudies = result.success ? result.data : []
      
      // Enrich studies with patient counts
      const transformedResults = await this.enrichStudiesWithPatientCounts(rawStudies)

      this.logger.info('Search query completed', {
        rawResultCount: rawStudies.length,
        transformedResultCount: transformedResults.length,
        sql,
        params,
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
        enrollmentData.UPLOAD_ID,
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
            UPDATE_DATE = CURRENT_TIMESTAMP
        WHERE STUDY_NUM = ? AND PATIENT_NUM = ?
      `

      const withdrawalDateStr = withdrawalDate || new Date().toISOString().split('T')[0]
      const result = await this.connection.executeCommand(sql, [withdrawalDateStr, studyId, patientId])
      if (result && result.success === false) {
        throw new Error(result.error || 'Withdraw command failed')
      }

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
   * @param {{userId: number, isAdmin: boolean}|null} userAccess - Optional user
   *   access context. When given (regular user), only enrolled patients the
   *   user may see (own or public via USER_PATIENT_LOOKUP) are returned —
   *   study enrolment alone must not disclose other users' patients.
   * @returns {Promise<Array>} Array of enrolled patients
   */
  async getEnrolledPatients(studyId, userAccess = null) {
    try {
      this.logger.debug('Getting enrolled patients', { studyId })

      let accessClause = ''
      const params = [studyId]
      if (userAccess && userAccess.userId && !userAccess.isAdmin) {
        accessClause = `
          AND EXISTS (
            SELECT 1 FROM USER_PATIENT_LOOKUP upl
            WHERE upl.PATIENT_NUM = p.PATIENT_NUM AND (upl.USER_ID = ? OR upl.USER_ID = 0)
          )`
        params.push(userAccess.userId)
      }

      const sql = `
        SELECT p.*, sp.ENROLLMENT_DATE, sp.WITHDRAWAL_DATE, sp.ENROLLMENT_STATUS_CD
        FROM PATIENT_DIMENSION p
        INNER JOIN STUDY_PATIENT_LOOKUP sp ON p.PATIENT_NUM = sp.PATIENT_NUM
        WHERE sp.STUDY_NUM = ?${accessClause}
        ORDER BY sp.ENROLLMENT_DATE DESC
      `

      const result = await this.connection.executeQuery(sql, params)
      return result.success ? result.data : []
    } catch (error) {
      this.logger.error('Failed to get enrolled patients', error)
      throw error
    }
  }

  /**
   * Batch: study memberships for a set of patients (withdrawn excluded).
   * Used for the study tags on patient cards.
   *
   * @param {number[]} patientNums
   * @returns {Promise<Map<number, Array<{code: string, name: string}>>>}
   */
  async getPatientStudyTags(patientNums) {
    const map = new Map()
    if (!Array.isArray(patientNums) || patientNums.length === 0) return map

    const placeholders = patientNums.map(() => '?').join(', ')
    const result = await this.connection.executeQuery(
      `SELECT spl.PATIENT_NUM, s.STUDY_CD, s.NAME_CHAR
       FROM STUDY_PATIENT_LOOKUP spl
       JOIN STUDY_DIMENSION s ON s.STUDY_NUM = spl.STUDY_NUM
       WHERE spl.PATIENT_NUM IN (${placeholders})
         AND (spl.ENROLLMENT_STATUS_CD IS NULL OR spl.ENROLLMENT_STATUS_CD != 'withdrawn')
       ORDER BY s.NAME_CHAR`,
      patientNums,
    )
    if (!result.success) return map

    for (const row of result.data) {
      if (!map.has(row.PATIENT_NUM)) map.set(row.PATIENT_NUM, [])
      map.get(row.PATIENT_NUM).push({ code: row.STUDY_CD, name: row.NAME_CHAR })
    }
    return map
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

  /**
   * Return all PATIENT_CDs enrolled in a study, identified by STUDY_CD.
   * Used by the in-app export dialog (export-store.exportStudyPatients) to
   * fetch the cohort before handing it to ExportService.
   *
   * @param {string} studyCd - The study's STUDY_CD (e.g. 'STROKE_LIPID')
   * @returns {Promise<Array<string>>} Patient codes; empty array if none.
   */
  async findEnrolledPatientCds(studyCd) {
    if (!studyCd) return []
    const sql = `
      SELECT p.PATIENT_CD
        FROM STUDY_PATIENT_LOOKUP spl
        JOIN STUDY_DIMENSION s   ON s.STUDY_NUM   = spl.STUDY_NUM
        JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM = spl.PATIENT_NUM
       WHERE s.STUDY_CD = ?
         AND (spl.ENROLLMENT_STATUS_CD IS NULL OR spl.ENROLLMENT_STATUS_CD = 'active')
       ORDER BY p.PATIENT_CD
    `
    const result = await this.connection.executeQuery(sql, [studyCd])
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch enrolled patient codes')
    }
    return result.data.map((row) => row.PATIENT_CD)
  }

  // ===========================================================================
  // Cohort Insights — aggregate views over all enrolled patients in a study.
  // ===========================================================================
  //
  // Each method takes a `studyCd` and returns counts/distributions. They are
  // study-agnostic where possible (LIKE-prefix concept filters for drugs, all
  // F-type concepts for findings, etc.); the few concept codes that need to
  // be parameterised are passed in by the caller.
  //
  // Used by `study-store.loadCohortInsights()` and rendered by
  // `components/study/StudyInsights.vue`.

  async _execAggregate(sql, params, label) {
    const result = await this.connection.executeQuery(sql, params)
    if (!result.success) {
      throw new Error(result.error || `Failed to compute ${label}`)
    }
    return result.data
  }

  /**
   * Cohort size + a per-visit-type breakdown. For each distinct visit-type code
   * found in VISIT_BLOB.visitType, returns the number of patients with at
   * least one visit of that type. Lets the dashboard show "425 enrolled · 425
   * with V0 · 425 with V1 · 187 with V2" rather than an opaque "≥N visits".
   *
   * @returns {Promise<{enrolled:number, perVisitType: Array<{visitType:string, patientCount:number}>}>}
   */
  async getCohortPatientCount(studyCd) {
    if (!studyCd) return { enrolled: 0, perVisitType: [] }
    const enrolledRow = await this._execAggregate(
      `SELECT COUNT(*) AS enrolled
         FROM STUDY_PATIENT_LOOKUP spl
         JOIN STUDY_DIMENSION s ON s.STUDY_NUM = spl.STUDY_NUM
        WHERE s.STUDY_CD = ?
          AND (spl.ENROLLMENT_STATUS_CD IS NULL OR spl.ENROLLMENT_STATUS_CD = 'active')`,
      [studyCd],
      'cohort enrolled count',
    )
    const enrolled = enrolledRow[0]?.enrolled || 0
    if (enrolled === 0) return { enrolled: 0, perVisitType: [] }

    const perVisitType = await this._execAggregate(
      `SELECT json_extract(v.VISIT_BLOB, '$.visitType') AS visitType,
              COUNT(DISTINCT v.PATIENT_NUM) AS patientCount
         FROM VISIT_DIMENSION v
         JOIN STUDY_PATIENT_LOOKUP spl ON spl.PATIENT_NUM = v.PATIENT_NUM
         JOIN STUDY_DIMENSION s ON s.STUDY_NUM = spl.STUDY_NUM
        WHERE s.STUDY_CD = ?
          AND (spl.ENROLLMENT_STATUS_CD IS NULL OR spl.ENROLLMENT_STATUS_CD = 'active')
          AND json_extract(v.VISIT_BLOB, '$.visitType') IS NOT NULL
        GROUP BY visitType
        ORDER BY visitType ASC`,
      [studyCd],
      'cohort per-visit-type count',
    )
    return { enrolled, perVisitType: perVisitType.map((r) => ({ visitType: r.visitType, patientCount: r.patientCount || 0 })) }
  }

  /**
   * Drug usage across a cohort, using the 3-state numeric pattern
   * (NVAL_NUM > 0 = taking, VALUEFLAG_CD='NV' = explicitly not taking).
   * Filters concepts by a CONCEPT_CD prefix (default: 'STROKE_LIPID:DRUG:').
   *
   * @returns {Promise<Array<{conceptCode, name, takingCount, notTakingCount, unknownCount, totalEnrolled}>>}
   */
  async getCohortDrugUsage(studyCd, conceptPrefix = 'STROKE_LIPID:DRUG:') {
    if (!studyCd) return []
    const counts = await this.getCohortPatientCount(studyCd)
    const totalEnrolled = counts.enrolled
    if (totalEnrolled === 0) return []

    const rows = await this._execAggregate(
      `SELECT c.CONCEPT_CD AS conceptCode, c.NAME_CHAR AS name,
              COUNT(DISTINCT CASE
                WHEN o.NVAL_NUM IS NOT NULL AND o.NVAL_NUM > 0 THEN o.PATIENT_NUM
              END) AS takingCount,
              COUNT(DISTINCT CASE
                WHEN o.VALUEFLAG_CD = 'NV' THEN o.PATIENT_NUM
              END) AS notTakingCount
         FROM CONCEPT_DIMENSION c
         LEFT JOIN OBSERVATION_FACT o ON o.CONCEPT_CD = c.CONCEPT_CD
         LEFT JOIN STUDY_PATIENT_LOOKUP spl ON spl.PATIENT_NUM = o.PATIENT_NUM
         LEFT JOIN STUDY_DIMENSION s ON s.STUDY_NUM = spl.STUDY_NUM
                                  AND s.STUDY_CD = ?
        WHERE c.CONCEPT_CD LIKE ? || '%'
          AND (o.PATIENT_NUM IS NULL OR s.STUDY_CD = ?)
        GROUP BY c.CONCEPT_CD, c.NAME_CHAR
        ORDER BY takingCount DESC, c.NAME_CHAR ASC`,
      [studyCd, conceptPrefix, studyCd],
      'drug usage',
    )
    return rows.map((r) => ({
      conceptCode: r.conceptCode,
      name: r.name,
      takingCount: r.takingCount || 0,
      notTakingCount: r.notTakingCount || 0,
      unknownCount: Math.max(0, totalEnrolled - (r.takingCount || 0) - (r.notTakingCount || 0)),
      totalEnrolled,
    }))
  }

  /**
   * Prevalence of every F-type Finding concept that has at least one
   * observation in this cohort. "Positive" = TVAL_CHAR points at the SCTID
   * "Yes" answer (SCTID: 373066001); "total" = positive + negative answers.
   *
   * @returns {Promise<Array<{conceptCode, name, positive, total, totalEnrolled}>>}
   */
  async getCohortFindingPrevalence(studyCd, yesCode = 'SCTID: 373066001') {
    if (!studyCd) return []
    const counts = await this.getCohortPatientCount(studyCd)
    const totalEnrolled = counts.enrolled
    const rows = await this._execAggregate(
      `SELECT c.CONCEPT_CD AS conceptCode, c.NAME_CHAR AS name,
              COUNT(DISTINCT CASE WHEN o.TVAL_CHAR = ? THEN o.PATIENT_NUM END) AS positive,
              COUNT(DISTINCT o.PATIENT_NUM) AS total
         FROM OBSERVATION_FACT o
         JOIN STUDY_PATIENT_LOOKUP spl ON spl.PATIENT_NUM = o.PATIENT_NUM
         JOIN STUDY_DIMENSION s ON s.STUDY_NUM = spl.STUDY_NUM
         JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD = o.CONCEPT_CD
        WHERE s.STUDY_CD = ?
          AND c.VALTYPE_CD = 'F'
        GROUP BY c.CONCEPT_CD, c.NAME_CHAR
        ORDER BY positive DESC, c.NAME_CHAR ASC`,
      [yesCode, studyCd],
      'finding prevalence',
    )
    return rows.map((r) => ({
      conceptCode: r.conceptCode,
      name: r.name,
      positive: r.positive || 0,
      total: r.total || 0,
      totalEnrolled,
    }))
  }

  /**
   * Distribution of a single S-type Selection concept across the cohort.
   * Returns one row per chosen option (TVAL_CHAR) with the patient count.
   *
   * @returns {Promise<Array<{optionCode, name, count, total}>>}
   */
  async getCohortSelectionDistribution(studyCd, selectionConceptCode) {
    if (!studyCd || !selectionConceptCode) return []
    const rows = await this._execAggregate(
      `SELECT o.TVAL_CHAR AS optionCode,
              COALESCE(c.NAME_CHAR, o.TVAL_CHAR) AS name,
              COUNT(DISTINCT o.PATIENT_NUM) AS count
         FROM OBSERVATION_FACT o
         JOIN STUDY_PATIENT_LOOKUP spl ON spl.PATIENT_NUM = o.PATIENT_NUM
         JOIN STUDY_DIMENSION s ON s.STUDY_NUM = spl.STUDY_NUM
         LEFT JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD = o.TVAL_CHAR
        WHERE s.STUDY_CD = ?
          AND o.CONCEPT_CD = ?
          AND o.TVAL_CHAR IS NOT NULL
        GROUP BY o.TVAL_CHAR, c.NAME_CHAR
        ORDER BY count DESC, name ASC`,
      [studyCd, selectionConceptCode],
      'selection distribution',
    )
    const total = rows.reduce((a, r) => a + (r.count || 0), 0)
    return rows.map((r) => ({
      optionCode: r.optionCode,
      name: r.name,
      count: r.count || 0,
      total,
    }))
  }

  /**
   * Summary statistics for a single numeric Lab concept, grouped by the
   * visit-type marker stored in VISIT_BLOB.visitType. Mean + min + max come
   * from SQLite aggregates; median is computed in JS from the raw values
   * (SQLite has no PERCENTILE_CONT). The dashboard prefers `median` over
   * `mean` because clinical lab values often contain single-cell outliers
   * (typos / column-swaps in source XLSXs) that skew a small-N mean.
   *
   * @returns {Promise<Array<{visitType, count, mean, median, min, max}>>}
   */
  async getCohortLabSummary(studyCd, labConceptCode) {
    if (!studyCd || !labConceptCode) return []
    const rows = await this._execAggregate(
      `SELECT json_extract(v.VISIT_BLOB, '$.visitType') AS visitType, o.NVAL_NUM AS value
         FROM OBSERVATION_FACT o
         JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
         JOIN STUDY_PATIENT_LOOKUP spl ON spl.PATIENT_NUM = o.PATIENT_NUM
         JOIN STUDY_DIMENSION s ON s.STUDY_NUM = spl.STUDY_NUM
        WHERE s.STUDY_CD = ?
          AND o.CONCEPT_CD = ?
          AND o.NVAL_NUM IS NOT NULL
        ORDER BY visitType ASC, o.NVAL_NUM ASC`,
      [studyCd, labConceptCode],
      'lab summary',
    )
    // Bucket per visit type and compute stats in JS.
    const byVisit = new Map()
    for (const r of rows) {
      if (!byVisit.has(r.visitType)) byVisit.set(r.visitType, [])
      byVisit.get(r.visitType).push(Number(r.value))
    }
    const median = (sorted) => {
      const n = sorted.length
      if (n === 0) return null
      return n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    }
    return [...byVisit.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([visitType, values]) => ({
        visitType,
        count: values.length,
        mean: values.reduce((a, v) => a + v, 0) / values.length,
        median: median(values),
        min: values[0],
        max: values[values.length - 1],
      }))
  }
}

export default StudyRepository
