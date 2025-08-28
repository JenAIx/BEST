/**
 * Visit Repository
 *
 * Manages medical encounters/visits in the VISIT_DIMENSION table.
 * Handles CRUD operations, search, filtering, and visit-specific business logic.
 *
 * Based on real-world data patterns from test_DB_v20231222.db:
 * - Visits link patients to observations (ENCOUNTER_NUM -> OBSERVATION_FACT.ENCOUNTER_NUM)
 * - Visit dates are stored as numeric (YYYY-MM-DD format)
 * - Active status codes indicate visit state (e.g., "SCTID: 55561003")
 * - Location codes identify where visits occurred
 * - In/Out codes distinguish inpatient vs outpatient visits
 */

import BaseRepository from './base-repository.js'

class VisitRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'VISIT_DIMENSION', 'ENCOUNTER_NUM')
  }

  /**
   * Create a new visit/encounter
   * @param {Object} visitData - Visit data object
   * @returns {Promise<Object>} - Created visit with ENCOUNTER_NUM
   */
  async createVisit(visitData) {
    // Validate required fields
    if (!visitData.PATIENT_NUM) {
      throw new Error('PATIENT_NUM is required for visit creation')
    }

    // Set default values for optional fields
    const visitWithDefaults = {
      ACTIVE_STATUS_CD: visitData.ACTIVE_STATUS_CD || 'SCTID: 55561003', // Active (SNOMED-CT) by default
      START_DATE: visitData.START_DATE || new Date().toISOString().split('T')[0],
      INOUT_CD: visitData.INOUT_CD || 'O', // Outpatient by default
      SOURCESYSTEM_CD: visitData.SOURCESYSTEM_CD || 'SYSTEM',
      UPLOAD_ID: visitData.UPLOAD_ID || 1,
      ...visitData,
    }

    // Create the visit
    const createdVisit = await this.create(visitWithDefaults)

    // If lastID is undefined, fetch the most recent visit for this patient
    // This is a workaround for Electron preload script not returning lastID
    if (createdVisit.ENCOUNTER_NUM === undefined) {
      try {
        const recentVisits = await this.findByPatientNum(visitData.PATIENT_NUM)
        if (recentVisits && recentVisits.length > 0) {
          // Get the most recent visit (assuming it's the one we just created)
          const mostRecentVisit = recentVisits[0]
          return { ...createdVisit, ENCOUNTER_NUM: mostRecentVisit.ENCOUNTER_NUM }
        }
      } catch (error) {
        // In case of error (e.g., in unit tests), just return the created visit
        console.warn('Could not fetch recent visits for workaround:', error.message)
      }
    }

    return createdVisit
  }

  /**
   * Find visits by patient number
   * @param {number} patientNum - Patient number
   * @returns {Promise<Array>} - Array of visits for the patient
   */
  async findByPatientNum(patientNum) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PATIENT_NUM = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [patientNum])
    return result && result.success ? result.data : []
  }

  /**
   * Find visits by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of visits in date range
   */
  async findByDateRange(startDate, endDate) {
    const sql = `SELECT * FROM ${this.tableName} WHERE START_DATE BETWEEN ? AND ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [startDate, endDate])
    return result.success ? result.data : []
  }

  /**
   * Find visits by location code
   * @param {string} locationCode - Location code
   * @returns {Promise<Array>} - Array of visits at location
   */
  async findByLocationCode(locationCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE LOCATION_CD = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [locationCode])
    return result.success ? result.data : []
  }

  /**
   * Find visits by active status
   * @param {string} activeStatus - Active status code
   * @returns {Promise<Array>} - Array of visits with status
   */
  async findByActiveStatus(activeStatus) {
    const sql = `SELECT * FROM ${this.tableName} WHERE ACTIVE_STATUS_CD = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [activeStatus])
    return result.success ? result.data : []
  }

  /**
   * Find visits by in/out code (inpatient vs outpatient)
   * @param {string} inoutCode - In/Out code (I=Inpatient, O=Outpatient)
   * @returns {Promise<Array>} - Array of visits with in/out type
   */
  async findByInoutCode(inoutCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE INOUT_CD = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [inoutCode])
    return result.success ? result.data : []
  }

  /**
   * Find visits by source system
   * @param {string} sourceSystem - Source system code
   * @returns {Promise<Array>} - Array of visits from source system
   */
  async findBySourceSystem(sourceSystem) {
    const sql = `SELECT * FROM ${this.tableName} WHERE SOURCESYSTEM_CD = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [sourceSystem])
    return result.success ? result.data : []
  }

  /**
   * Find active visits (currently ongoing)
   * @returns {Promise<Array>} - Array of active visits
   */
  async findActiveVisits() {
    const sql = `SELECT * FROM ${this.tableName} WHERE ACTIVE_STATUS_CD = 'A' ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data : []
  }

  /**
   * Find visits with observations (has linked observations)
   * @returns {Promise<Array>} - Array of visits with observations
   */
  async findVisitsWithObservations() {
    const sql = `
      SELECT DISTINCT v.*
      FROM ${this.tableName} v
      INNER JOIN OBSERVATION_FACT o ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
      ORDER BY v.START_DATE DESC
    `
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data : []
  }

  /**
   * Get visit statistics
   * @returns {Promise<Object>} - Visit statistics object
   */
  async getVisitStatistics() {
    try {
      const [totalVisits, byStatus, byLocation, byInout, byMonth] = await Promise.all([
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName}`),
        this.connection.executeQuery(`SELECT ACTIVE_STATUS_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY ACTIVE_STATUS_CD`),
        this.connection.executeQuery(`SELECT LOCATION_CD, COUNT(*) as count FROM ${this.tableName} WHERE LOCATION_CD IS NOT NULL GROUP BY LOCATION_CD`),
        this.connection.executeQuery(`SELECT INOUT_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY INOUT_CD`),
        this.connection.executeQuery(`SELECT strftime('%Y-%m', START_DATE) as month, COUNT(*) as count FROM ${this.tableName} GROUP BY month ORDER BY month DESC LIMIT 12`),
      ])

      return {
        totalVisits: totalVisits.success ? totalVisits.data[0].count : 0,
        byStatus: byStatus.success ? byStatus.data : [],
        byLocation: byLocation.success ? byLocation.data : [],
        byInout: byInout.success ? byInout.data : [],
        byMonth: byMonth.success ? byMonth.data : [],
      }
    } catch (error) {
      console.error('Error getting visit statistics:', error)
      return {
        totalVisits: 0,
        byStatus: [],
        byLocation: [],
        byInout: [],
        byMonth: [],
      }
    }
  }

  /**
   * Get visits with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} criteria - Optional search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getVisitsPaginated(page = 1, pageSize = 20, criteria = {}) {
    try {
      const offset = (page - 1) * pageSize

      // Build WHERE clause for criteria
      let whereClause = 'WHERE 1=1'
      const params = []

      if (criteria.patientNum) {
        whereClause += ` AND PATIENT_NUM = ?`
        params.push(criteria.patientNum)
      }

      if (criteria.activeStatus) {
        whereClause += ` AND ACTIVE_STATUS_CD = ?`
        params.push(criteria.activeStatus)
      }

      if (criteria.locationCode) {
        whereClause += ` AND LOCATION_CD = ?`
        params.push(criteria.locationCode)
      }

      if (criteria.inoutCode) {
        whereClause += ` AND INOUT_CD = ?`
        params.push(criteria.inoutCode)
      }

      if (criteria.startDate && criteria.endDate) {
        whereClause += ` AND START_DATE BETWEEN ? AND ?`
        params.push(criteria.startDate, criteria.endDate)
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`
      const countResult = await this.connection.executeQuery(countSql, params)
      const totalCount = countResult.success ? countResult.data[0].count : 0

      // Get paginated data
      const dataSql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY START_DATE DESC LIMIT ? OFFSET ?`
      const dataResult = await this.connection.executeQuery(dataSql, [...params, pageSize, offset])
      const visits = dataResult.success ? dataResult.data : []

      return {
        visits,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasNext: page < Math.ceil(totalCount / pageSize),
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      console.error('Error getting visits paginated:', error)
      return {
        visits: [],
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      }
    }
  }

  /**
   * Search visits by text
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching visits
   */
  async searchVisits(searchTerm) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return []
    }

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE LOCATION_CD LIKE ?
         OR ACTIVE_STATUS_CD LIKE ?
         OR CAST(PATIENT_NUM AS TEXT) LIKE ?
      ORDER BY START_DATE DESC
    `
    const searchPattern = `%${searchTerm.trim()}%`
    const result = await this.connection.executeQuery(sql, [searchPattern, searchPattern, searchPattern])
    return result.success ? result.data : []
  }

  /**
   * Update visit information
   * @param {number} encounterNum - Encounter number to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateVisit(encounterNum, updateData) {
    // Validate encounter exists
    const existingVisit = await this.findById(encounterNum)
    if (!existingVisit) {
      throw new Error(`Visit with ENCOUNTER_NUM ${encounterNum} not found`)
    }

    return await this.update(encounterNum, updateData)
  }

  /**
   * Close a visit (set end date and inactive status)
   * @param {number} encounterNum - Encounter number to close
   * @param {string} endDate - End date (YYYY-MM-DD), defaults to today
   * @returns {Promise<boolean>} - Success status
   */
  async closeVisit(encounterNum, endDate = null) {
    const closeDate = endDate || new Date().toISOString().split('T')[0]

    return await this.updateVisit(encounterNum, {
      END_DATE: closeDate,
      ACTIVE_STATUS_CD: 'I', // Inactive
    })
  }

  /**
   * Get visit timeline for a patient
   * @param {number} patientNum - Patient number
   * @returns {Promise<Array>} - Array of visits ordered by date
   */
  async getPatientVisitTimeline(patientNum) {
    const sql = `
      SELECT v.*,
             COUNT(o.OBSERVATION_ID) as observationCount
      FROM ${this.tableName} v
      LEFT JOIN OBSERVATION_FACT o ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
      WHERE v.PATIENT_NUM = ?
      GROUP BY v.ENCOUNTER_NUM
      ORDER BY v.START_DATE DESC
    `
    const result = await this.connection.executeQuery(sql, [patientNum])
    return result.success ? result.data : []
  }
}

export default VisitRepository
