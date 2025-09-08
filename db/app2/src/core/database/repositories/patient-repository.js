/**
 * Patient Repository
 * Handles all database operations for patient entities
 * Extends BaseRepository with patient-specific functionality
 */

import BaseRepository from './base-repository.js'

class PatientRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'PATIENT_DIMENSION', 'PATIENT_NUM')
    // Use patient_list view for queries that need resolved concept codes
    this.viewName = 'patient_list'
  }

  /**
   * Find patient by patient code (PATIENT_CD)
   * @param {string} patientCode - Patient code
   * @returns {Promise<Object|null>} - Found patient or null
   */
  async findByPatientCode(patientCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PATIENT_CD = ?`
    const result = await this.connection.executeQuery(sql, [patientCode])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find patient by patient code with resolved concepts
   * @param {string} patientCode - Patient code
   * @returns {Promise<Object|null>} - Found patient with resolved concept names or null
   */
  async findByPatientCodeWithConcepts(patientCode) {
    const sql = `SELECT * FROM ${this.viewName} WHERE PATIENT_CD = ?`
    const result = await this.connection.executeQuery(sql, [patientCode])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find patients by vital status
   * @param {string} vitalStatus - Vital status code
   * @returns {Promise<Array>} - Array of patients
   */
  async findByVitalStatus(vitalStatus) {
    return await this.findByCriteria({ VITAL_STATUS_CD: vitalStatus })
  }

  /**
   * Find patients by sex
   * @param {string} sex - Sex code
   * @returns {Promise<Array>} - Array of patients
   */
  async findBySex(sex) {
    return await this.findByCriteria({ SEX_CD: sex })
  }

  /**
   * Find patients by age range
   * @param {number} minAge - Minimum age
   * @param {number} maxAge - Maximum age
   * @returns {Promise<Array>} - Array of patients
   */
  async findByAgeRange(minAge, maxAge) {
    const criteria = {
      AGE_IN_YEARS: {
        operator: 'BETWEEN',
        value: [minAge, maxAge],
      },
    }
    return await this.findByCriteria(criteria)
  }

  /**
   * Find patients by birth date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of patients
   */
  async findByBirthDateRange(startDate, endDate) {
    const criteria = {
      BIRTH_DATE: {
        operator: 'BETWEEN',
        value: [startDate, endDate],
      },
    }
    return await this.findByCriteria(criteria)
  }

  /**
   * Find patients by source system
   * @param {string} sourceSystem - Source system code
   * @returns {Promise<Array>} - Array of patients from source system
   */
  async findBySourceSystem(sourceSystem) {
    const sql = `SELECT * FROM ${this.tableName} WHERE SOURCESYSTEM_CD = ? ORDER BY CREATED_AT DESC`
    const result = await this.connection.executeQuery(sql, [sourceSystem])
    return result.success ? result.data : []
  }

  /**
   * Find patients by multiple criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of patients
   */
  async findPatientsByCriteria(criteria) {
    const searchCriteria = {}

    if (criteria.vitalStatus) {
      searchCriteria.VITAL_STATUS_CD = criteria.vitalStatus
    }

    if (criteria.sex) {
      searchCriteria.SEX_CD = criteria.sex
    }

    if (criteria.ageRange) {
      searchCriteria.AGE_IN_YEARS = {
        operator: 'BETWEEN',
        value: [criteria.ageRange.min, criteria.ageRange.max],
      }
    }

    if (criteria.birthDateRange) {
      searchCriteria.BIRTH_DATE = {
        operator: 'BETWEEN',
        value: [criteria.birthDateRange.start, criteria.birthDateRange.end],
      }
    }

    if (criteria.language) {
      searchCriteria.LANGUAGE_CD = criteria.language
    }

    if (criteria.race) {
      searchCriteria.RACE_CD = criteria.race
    }

    if (criteria.maritalStatus) {
      searchCriteria.MARITAL_STATUS_CD = criteria.maritalStatus
    }

    if (criteria.religion) {
      searchCriteria.RELIGION_CD = criteria.religion
    }

    if (criteria.location) {
      searchCriteria.STATECITYZIP_PATH = criteria.location
    }

    if (criteria.sourceSystem) {
      searchCriteria.SOURCESYSTEM_CD = criteria.sourceSystem
    }

    if (criteria.uploadId) {
      searchCriteria.UPLOAD_ID = criteria.uploadId
    }

    // Handle searchTerm by using the searchPatients method if provided
    if (criteria.searchTerm) {
      const searchResults = await this.searchPatients(criteria.searchTerm)
      // Apply additional filters to search results if any other criteria exist
      if (Object.keys(searchCriteria).length > 0) {
        return searchResults.filter((patient) => {
          // Apply filters to search results
          if (searchCriteria.VITAL_STATUS_CD && patient.VITAL_STATUS_CD !== searchCriteria.VITAL_STATUS_CD) return false
          if (searchCriteria.SEX_CD && patient.SEX_CD !== searchCriteria.SEX_CD) return false
          if (searchCriteria.AGE_IN_YEARS) {
            const age = patient.AGE_IN_YEARS
            if (age < searchCriteria.AGE_IN_YEARS.value[0] || age > searchCriteria.AGE_IN_YEARS.value[1]) return false
          }
          if (searchCriteria.STATECITYZIP_PATH && !patient.STATECITYZIP_PATH?.includes(searchCriteria.STATECITYZIP_PATH)) return false
          if (searchCriteria.SOURCESYSTEM_CD && patient.SOURCESYSTEM_CD !== searchCriteria.SOURCESYSTEM_CD) return false
          if (searchCriteria.UPLOAD_ID && patient.UPLOAD_ID !== searchCriteria.UPLOAD_ID) return false
          return true
        })
      }
      return searchResults
    }

    return await this.findByCriteria(searchCriteria, criteria.options)
  }

  /**
   * Find patients by multiple criteria with resolved concept names
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of patients with resolved concepts
   */
  async findPatientsByCriteriaWithConcepts(criteria) {
    const searchCriteria = {}

    if (criteria.VITAL_STATUS_CD) {
      searchCriteria.VITAL_STATUS_CD = criteria.VITAL_STATUS_CD
    }

    if (criteria.SEX_CD) {
      searchCriteria.SEX_CD = criteria.SEX_CD
    }

    if (criteria.ageRange) {
      searchCriteria.AGE_IN_YEARS = {
        operator: 'BETWEEN',
        value: [criteria.ageRange.min, criteria.ageRange.max],
      }
    }

    if (criteria.birthDateRange) {
      searchCriteria.BIRTH_DATE = {
        operator: 'BETWEEN',
        value: [criteria.birthDateRange.start, criteria.birthDateRange.end],
      }
    }

    if (criteria.language) {
      searchCriteria.LANGUAGE_CD = criteria.language
    }

    if (criteria.race) {
      searchCriteria.RACE_CD = criteria.race
    }

    if (criteria.maritalStatus) {
      searchCriteria.MARITAL_STATUS_CD = criteria.maritalStatus
    }

    if (criteria.religion) {
      searchCriteria.RELIGION_CD = criteria.religion
    }

    if (criteria.location) {
      searchCriteria.STATECITYZIP_PATH = criteria.location
    }

    if (criteria.sourceSystem) {
      searchCriteria.SOURCESYSTEM_CD = criteria.sourceSystem
    }

    if (criteria.uploadId) {
      searchCriteria.UPLOAD_ID = criteria.uploadId
    }

    // Handle searchTerm with view-based search
    if (criteria.searchTerm) {
      const searchResults = await this.searchPatientsWithConcepts(criteria.searchTerm)
      // Apply additional filters to search results if any other criteria exist
      if (Object.keys(searchCriteria).length > 0) {
        return searchResults.filter((patient) => {
          // Apply filters to search results
          if (searchCriteria.VITAL_STATUS_CD && patient.VITAL_STATUS_CD !== searchCriteria.VITAL_STATUS_CD) return false
          if (searchCriteria.SEX_CD && patient.SEX_CD !== searchCriteria.SEX_CD) return false
          if (searchCriteria.AGE_IN_YEARS) {
            const age = patient.AGE_IN_YEARS
            if (age < searchCriteria.AGE_IN_YEARS.value[0] || age > searchCriteria.AGE_IN_YEARS.value[1]) return false
          }
          if (searchCriteria.STATECITYZIP_PATH && !patient.STATECITYZIP_PATH?.includes(searchCriteria.STATECITYZIP_PATH)) return false
          return true
        })
      }
      return searchResults
    }

    // Use view-based query with resolved concepts
    return await this.findByCriteriaFromView(searchCriteria, criteria.options)
  }

  /**
   * Search patients with resolved concepts by text (name, code, location)
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching patients with resolved concepts
   */
  async searchPatientsWithConcepts(searchTerm) {
    const sql = `
      SELECT * FROM ${this.viewName}
      WHERE PATIENT_CD LIKE ?
         OR PATIENT_BLOB LIKE ?
         OR STATECITYZIP_PATH LIKE ?
         OR SEX_RESOLVED LIKE ?
         OR VITAL_STATUS_RESOLVED LIKE ?
         OR LANGUAGE_RESOLVED LIKE ?
         OR RACE_RESOLVED LIKE ?
         OR MARITAL_STATUS_RESOLVED LIKE ?
         OR RELIGION_RESOLVED LIKE ?
      ORDER BY PATIENT_CD
    `
    const searchPattern = `%${searchTerm}%`
    const result = await this.connection.executeQuery(sql, [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern])

    return result.success ? result.data : []
  }

  /**
   * Find by criteria using the patient_list view
   * @param {Object} searchCriteria - Search criteria object
   * @param {Object} options - Query options (limit, offset, orderBy, etc.)
   * @returns {Promise<Array>} - Array of patients with resolved concepts
   */
  async findByCriteriaFromView(searchCriteria, options = {}) {
    const conditions = []
    const params = []

    // Build WHERE clause
    for (const [field, value] of Object.entries(searchCriteria)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && value.operator) {
          // Handle special operators like BETWEEN, IN, etc.
          if (value.operator === 'BETWEEN' && Array.isArray(value.value) && value.value.length === 2) {
            conditions.push(`${field} BETWEEN ? AND ?`)
            params.push(value.value[0], value.value[1])
          } else if (value.operator === 'IN' && Array.isArray(value.value)) {
            const placeholders = value.value.map(() => '?').join(', ')
            conditions.push(`${field} IN (${placeholders})`)
            params.push(...value.value)
          } else if (value.operator === 'LIKE') {
            conditions.push(`${field} LIKE ?`)
            params.push(value.value)
          }
        } else {
          // Simple equality check
          conditions.push(`${field} = ?`)
          params.push(value)
        }
      }
    }

    // Build base query
    let sql = `SELECT * FROM ${this.viewName}`

    // Add WHERE clause
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add ORDER BY with special handling for UPDATE_DATE_WITH_FALLBACK
    let orderBy = options.orderBy || 'PATIENT_CD'
    const orderDirection = options.orderDirection || 'ASC'

    if (orderBy === 'UPDATE_DATE_WITH_FALLBACK') {
      // Use UPDATE_DATE as default, IMPORT_DATE as fallback
      orderBy = 'COALESCE(UPDATE_DATE, IMPORT_DATE)'
    }

    sql += ` ORDER BY ${orderBy} ${orderDirection}`

    // Add LIMIT and OFFSET
    if (options.limit) {
      sql += ` LIMIT ?`
      params.push(options.limit)

      if (options.offset) {
        sql += ` OFFSET ?`
        params.push(options.offset)
      }
    }

    const result = await this.connection.executeQuery(sql, params)
    return result.success ? result.data : []
  }

  /**
   * Create a new patient with validation
   * @param {Object} patientData - Patient data
   * @returns {Promise<Object>} - Created patient
   */
  async createPatient(patientData) {
    // Validate required fields
    if (!patientData.PATIENT_CD) {
      throw new Error('PATIENT_CD is required')
    }

    // Check if patient already exists
    const existingPatient = await this.findByPatientCode(patientData.PATIENT_CD)
    if (existingPatient) {
      throw new Error(`Patient with code ${patientData.PATIENT_CD} already exists`)
    }

    // Add audit fields
    const now = new Date().toISOString()
    const patient = {
      ...patientData,
      IMPORT_DATE: patientData.IMPORT_DATE || now,
      UPDATE_DATE: now,
      CREATED_AT: now,
      UPDATED_AT: now,
    }

    // Create the patient
    const createdPatient = await this.create(patient)

    // If lastID is undefined, fetch the patient to get the actual ID
    if (createdPatient.PATIENT_NUM === undefined) {
      const fetchedPatient = await this.findByPatientCode(patientData.PATIENT_CD)
      if (fetchedPatient) {
        return { ...createdPatient, PATIENT_NUM: fetchedPatient.PATIENT_NUM }
      }
    }

    return createdPatient
  }

  /**
   * Update patient information
   * @param {string|number} patientId - Patient ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updatePatient(patientId, updateData) {
    // Add audit fields
    const updateInfo = {
      ...updateData,
      UPDATE_DATE: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    }

    return await this.update(patientId, updateInfo)
  }

  /**
   * Get patient statistics
   * @returns {Promise<Object>} - Patient statistics
   */
  async getPatientStatistics() {
    const stats = {}

    // Total patient count
    const totalResult = await this.connection.executeQuery(`SELECT COUNT(*) as total FROM ${this.tableName}`)
    stats.totalPatients = totalResult.success ? totalResult.data[0].total : 0

    // Count by vital status
    const vitalStatusResult = await this.connection.executeQuery(`SELECT VITAL_STATUS_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY VITAL_STATUS_CD`)
    stats.byVitalStatus = vitalStatusResult.success ? vitalStatusResult.data : []

    // Count by sex
    const sexResult = await this.connection.executeQuery(`SELECT SEX_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY SEX_CD`)
    stats.bySex = sexResult.success ? sexResult.data : []

    // Average age
    const ageResult = await this.connection.executeQuery(`SELECT AVG(AGE_IN_YEARS) as averageAge FROM ${this.tableName} WHERE AGE_IN_YEARS IS NOT NULL`)
    stats.averageAge = ageResult.success && ageResult.data[0].averageAge !== null && ageResult.data[0].averageAge !== undefined ? Math.round(ageResult.data[0].averageAge) : null

    return stats
  }

  /**
   * Search patients by text (name, code, location)
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching patients
   */
  async searchPatients(searchTerm) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE PATIENT_CD LIKE ?
         OR PATIENT_BLOB LIKE ?
         OR STATECITYZIP_PATH LIKE ?
      ORDER BY PATIENT_CD
    `
    const searchPattern = `%${searchTerm}%`
    const result = await this.connection.executeQuery(sql, [searchPattern, searchPattern, searchPattern])

    return result.success ? result.data : []
  }

  /**
   * Get patients with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Page size
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getPatientsPaginated(page = 1, pageSize = 20, criteria = {}) {
    const offset = (page - 1) * pageSize

    // Merge pagination options with any existing options
    const mergedOptions = {
      limit: pageSize,
      offset: offset,
      orderBy: 'PATIENT_CD',
      orderDirection: 'ASC',
      ...criteria.options,
    }

    const patients = await this.findPatientsByCriteriaWithConcepts({
      ...criteria,
      options: mergedOptions,
    })

    // Filter out options from criteria for count query
    const countCriteria = { ...criteria }
    delete countCriteria.options
    const totalCount = await this.countByCriteriaFromView(countCriteria)
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      patients,
      pagination: {
        currentPage: page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    }
  }

  /**
   * Count patients by criteria using the patient_list view
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} - Total count
   */
  async countByCriteriaFromView(criteria = {}) {
    // Handle searchTerm specially - it needs to search across multiple fields
    if (criteria.searchTerm) {
      const searchPattern = `%${criteria.searchTerm}%`
      const searchSql = `
        SELECT COUNT(*) as count FROM ${this.viewName}
        WHERE PATIENT_CD LIKE ?
           OR PATIENT_BLOB LIKE ?
           OR STATECITYZIP_PATH LIKE ?
           OR SEX_RESOLVED LIKE ?
           OR VITAL_STATUS_RESOLVED LIKE ?
           OR LANGUAGE_RESOLVED LIKE ?
           OR RACE_RESOLVED LIKE ?
           OR MARITAL_STATUS_RESOLVED LIKE ?
           OR RELIGION_RESOLVED LIKE ?
      `
      const searchParams = Array(9).fill(searchPattern)

      // Add other criteria if they exist
      const otherCriteria = { ...criteria }
      delete otherCriteria.searchTerm

      if (Object.keys(otherCriteria).length > 0) {
        // If there are other criteria, we need to get the search results first
        // and then apply additional filters - this is more complex but accurate
        const searchResults = await this.searchPatientsWithConcepts(criteria.searchTerm)

        // Apply additional filters to search results
        const filteredResults = searchResults.filter((patient) => {
          if (otherCriteria.SEX_CD && patient.SEX_CD !== otherCriteria.SEX_CD) return false
          if (otherCriteria.VITAL_STATUS_CD && patient.VITAL_STATUS_CD !== otherCriteria.VITAL_STATUS_CD) return false
          return true
        })

        return filteredResults.length
      } else {
        // Simple search count
        const result = await this.connection.executeQuery(searchSql, searchParams)
        return result.success && result.data.length > 0 ? result.data[0].count : 0
      }
    }

    // Handle non-search criteria
    const conditions = []
    const params = []

    // Build WHERE clause for non-search criteria
    for (const [field, value] of Object.entries(criteria)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'object' && value.operator) {
          // Handle special operators like BETWEEN, IN, etc.
          if (value.operator === 'BETWEEN' && Array.isArray(value.value) && value.value.length === 2) {
            conditions.push(`${field} BETWEEN ? AND ?`)
            params.push(value.value[0], value.value[1])
          } else if (value.operator === 'IN' && Array.isArray(value.value)) {
            const placeholders = value.value.map(() => '?').join(', ')
            conditions.push(`${field} IN (${placeholders})`)
            params.push(...value.value)
          } else if (value.operator === 'LIKE') {
            conditions.push(`${field} LIKE ?`)
            params.push(value.value)
          }
        } else {
          // Simple equality check
          conditions.push(`${field} = ?`)
          params.push(value)
        }
      }
    }

    // Build count query using the view
    let sql = `SELECT COUNT(*) as count FROM ${this.viewName}`

    // Add WHERE clause
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`
    }

    const result = await this.connection.executeQuery(sql, params)
    return result.success && result.data.length > 0 ? result.data[0].count : 0
  }
}

export default PatientRepository
