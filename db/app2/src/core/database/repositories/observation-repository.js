/**
 * Observation Repository
 *
 * Manages clinical observations and measurements in the OBSERVATION_FACT table.
 * Handles CRUD operations, search, filtering, and observation-specific business logic.
 *
 * Based on real-world data patterns from test_DB_v20231222.db:
 * - Observations link to visits (ENCOUNTER_NUM) and patients (PATIENT_NUM)
 * - Complex BLOB data contains detailed clinical information (e.g., questionnaire results)
 * - Value types include numeric (NVAL_NUM), text (TVAL_CHAR), and BLOB (OBSERVATION_BLOB)
 * - Categories distinguish different types of observations (e.g., "surveyBEST")
 * - Concept codes link to medical terminology (SNOMED-CT, LOINC)
 */

import BaseRepository from './base-repository.js'

class ObservationRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'OBSERVATION_FACT', 'OBSERVATION_ID')
  }

  /**
   * Create a new clinical observation
   * @param {Object} observationData - Observation data object
   * @returns {Promise<Object>} - Created observation with OBSERVATION_ID
   */
  async createObservation(observationData) {
    // Validate required fields
    if (!observationData.ENCOUNTER_NUM) {
      throw new Error('ENCOUNTER_NUM is required for observation creation')
    }
    if (!observationData.PATIENT_NUM) {
      throw new Error('PATIENT_NUM is required for observation creation')
    }
    if (!observationData.CONCEPT_CD) {
      throw new Error('CONCEPT_CD is required for observation creation')
    }

    // Set default values for optional fields
    const observationWithDefaults = {
      CATEGORY_CHAR: observationData.CATEGORY_CHAR || 'CLINICAL',
      START_DATE: observationData.START_DATE || new Date().toISOString().split('T')[0],
      VALTYPE_CD: observationData.VALTYPE_CD || 'T', // Text by default
      SOURCESYSTEM_CD: observationData.SOURCESYSTEM_CD || 'SYSTEM',
      UPLOAD_ID: observationData.UPLOAD_ID || 1,
      ...observationData,
    }

    // Create the observation
    const createdObservation = await this.create(observationWithDefaults)

    // If lastID is undefined, fetch the most recent observation for this encounter
    // This is a workaround for Electron preload script not returning lastID
    if (createdObservation.OBSERVATION_ID === undefined) {
      try {
        const recentObservations = await this.findByEncounterNum(observationData.ENCOUNTER_NUM)
        if (recentObservations && recentObservations.length > 0) {
          // Get the most recent observation (assuming it's the one we just created)
          const mostRecentObservation = recentObservations[0]
          return { ...createdObservation, OBSERVATION_ID: mostRecentObservation.OBSERVATION_ID }
        }
      } catch (error) {
        // In case of error (e.g., in unit tests), just return the created observation
        console.warn('Could not fetch recent observations for workaround:', error.message)
      }
    }

    return createdObservation
  }

  /**
   * Find observations by patient number
   * @param {number} patientNum - Patient number
   * @returns {Promise<Array>} - Array of observations for the patient
   */
  async findByPatientNum(patientNum) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PATIENT_NUM = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [patientNum])
    return result.success ? result.data : []
  }

  /**
   * Find observations by visit/encounter number
   * @param {number} encounterNum - Encounter number
   * @returns {Promise<Array>} - Array of observations for the visit
   */
  async findByVisitNum(encounterNum) {
    const sql = `SELECT * FROM ${this.tableName} WHERE ENCOUNTER_NUM = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [encounterNum])
    return result && result.success ? result.data : []
  }

  /**
   * Alias for findByVisitNum - Find observations by encounter number
   * @param {number} encounterNum - Encounter number
   * @returns {Promise<Array>} - Array of observations for the encounter
   */
  async findByEncounterNum(encounterNum) {
    return await this.findByVisitNum(encounterNum)
  }

  /**
   * Find observations by concept code
   * @param {string} conceptCode - Concept code (e.g., "SCTID: 273249006")
   * @returns {Promise<Array>} - Array of observations with concept
   */
  async findByConceptCode(conceptCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE CONCEPT_CD = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [conceptCode])
    return result.success ? result.data : []
  }

  /**
   * Find observations by category
   * @param {string} category - Observation category (e.g., "surveyBEST")
   * @returns {Promise<Array>} - Array of observations in category
   */
  async findByCategory(category) {
    const sql = `SELECT * FROM ${this.tableName} WHERE CATEGORY_CHAR = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [category])
    return result.success ? result.data : []
  }

  /**
   * Find observations by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of observations in date range
   */
  async findByDateRange(startDate, endDate) {
    const sql = `SELECT * FROM ${this.tableName} WHERE START_DATE BETWEEN ? AND ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [startDate, endDate])
    return result.success ? result.data : []
  }

  /**
   * Find observations by value type
   * @param {string} valueType - Value type code (N=numeric, T=text, B=blob)
   * @returns {Promise<Array>} - Array of observations with value type
   */
  async findByValueType(valueType) {
    const sql = `SELECT * FROM ${this.tableName} WHERE VALTYPE_CD = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [valueType])
    return result.success ? result.data : []
  }

  /**
   * Find observations by provider
   * @param {string} providerId - Provider ID
   * @returns {Promise<Array>} - Array of observations by provider
   */
  async findByProvider(providerId) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PROVIDER_ID = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [providerId])
    return result.success ? result.data : []
  }

  /**
   * Find observations with numeric values in range
   * @param {number} minValue - Minimum numeric value
   * @param {number} maxValue - Maximum numeric value
   * @returns {Promise<Array>} - Array of observations with numeric values in range
   */
  async findByNumericValueRange(minValue, maxValue) {
    const sql = `SELECT * FROM ${this.tableName} WHERE VALTYPE_CD = 'N' AND NVAL_NUM BETWEEN ? AND ? ORDER BY NVAL_NUM DESC`
    const result = await this.connection.executeQuery(sql, [minValue, maxValue])
    return result.success ? result.data : []
  }

  /**
   * Find observations by text value pattern
   * @param {string} textPattern - Text pattern to search for
   * @returns {Promise<Array>} - Array of observations matching text pattern
   */
  async findByTextValue(textPattern) {
    const sql = `SELECT * FROM ${this.tableName} WHERE VALTYPE_CD = 'T' AND TVAL_CHAR LIKE ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [`%${textPattern}%`])
    return result.success ? result.data : []
  }

  /**
   * Find observations by source system
   * @param {string} sourceSystem - Source system code
   * @returns {Promise<Array>} - Array of observations from source system
   */
  async findBySourceSystem(sourceSystem) {
    const sql = `SELECT * FROM ${this.tableName} WHERE SOURCESYSTEM_CD = ? ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql, [sourceSystem])
    return result.success ? result.data : []
  }

  /**
   * Find observations with BLOB data
   * @returns {Promise<Array>} - Array of observations with BLOB data
   */
  async findWithBlobData() {
    const sql = `SELECT * FROM ${this.tableName} WHERE OBSERVATION_BLOB IS NOT NULL ORDER BY START_DATE DESC`
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data : []
  }

  /**
   * Get observations with patient and visit information
   * @param {number} patientNum - Patient number
   * @returns {Promise<Array>} - Array of observations with patient and visit details
   */
  async getObservationsWithContext(patientNum) {
    const sql = `
      SELECT o.*, 
             p.PATIENT_CD,
             v.LOCATION_CD,
             v.START_DATE as VISIT_START_DATE
      FROM ${this.tableName} o
      INNER JOIN PATIENT_DIMENSION p ON o.PATIENT_NUM = p.PATIENT_NUM
      INNER JOIN VISIT_DIMENSION v ON o.ENCOUNTER_NUM = v.ENCOUNTER_NUM
      WHERE o.PATIENT_NUM = ?
      ORDER BY o.START_DATE DESC
    `
    const result = await this.connection.executeQuery(sql, [patientNum])
    return result.success ? result.data : []
  }

  /**
   * Get observations with resolved concepts using patient_observations view
   * @param {number} patientNum - Patient number
   * @returns {Promise<Array>} - Array of observations with resolved concept names
   */
  async getObservationsWithResolvedConcepts(patientNum) {
    const sql = `
      SELECT *
      FROM patient_observations
      WHERE PATIENT_NUM = ?
      ORDER BY START_DATE DESC, CONCEPT_NAME_CHAR
    `
    const result = await this.connection.executeQuery(sql, [patientNum])
    return result.success ? result.data : []
  }

  /**
   * Get observation statistics
   * @returns {Promise<Object>} - Observation statistics object
   */
  async getObservationStatistics() {
    try {
      const [totalObservations, byCategory, byValueType, byConcept, byMonth, byProvider] = await Promise.all([
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName}`),
        this.connection.executeQuery(`SELECT CATEGORY_CHAR, COUNT(*) as count FROM ${this.tableName} GROUP BY CATEGORY_CHAR`),
        this.connection.executeQuery(`SELECT VALTYPE_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY VALTYPE_CD`),
        this.connection.executeQuery(`SELECT CONCEPT_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY CONCEPT_CD ORDER BY count DESC LIMIT 10`),
        this.connection.executeQuery(`SELECT strftime('%Y-%m', START_DATE) as month, COUNT(*) as count FROM ${this.tableName} GROUP BY month ORDER BY month DESC LIMIT 12`),
        this.connection.executeQuery(`SELECT PROVIDER_ID, COUNT(*) as count FROM ${this.tableName} WHERE PROVIDER_ID IS NOT NULL GROUP BY PROVIDER_ID ORDER BY count DESC LIMIT 10`),
      ])

      return {
        totalObservations: totalObservations.success ? totalObservations.data[0].count : 0,
        byCategory: byCategory.success ? byCategory.data : [],
        byValueType: byValueType.success ? byValueType.data : [],
        byConcept: byConcept.success ? byConcept.data : [],
        byMonth: byMonth.success ? byMonth.data : [],
        byProvider: byProvider.success ? byProvider.data : [],
      }
    } catch (error) {
      console.error('Error getting observation statistics:', error)
      return {
        totalObservations: 0,
        byCategory: [],
        byValueType: [],
        byConcept: [],
        byMonth: [],
        byProvider: [],
      }
    }
  }

  /**
   * Get observations with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} criteria - Optional search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getObservationsPaginated(page = 1, pageSize = 20, criteria = {}) {
    try {
      const offset = (page - 1) * pageSize

      // Build WHERE clause for criteria
      let whereClause = 'WHERE 1=1'
      const params = []

      if (criteria.patientNum) {
        whereClause += ` AND PATIENT_NUM = ?`
        params.push(criteria.patientNum)
      }

      if (criteria.encounterNum) {
        whereClause += ` AND ENCOUNTER_NUM = ?`
        params.push(criteria.encounterNum)
      }

      if (criteria.conceptCode) {
        whereClause += ` AND CONCEPT_CD = ?`
        params.push(criteria.conceptCode)
      }

      if (criteria.category) {
        whereClause += ` AND CATEGORY_CHAR = ?`
        params.push(criteria.category)
      }

      if (criteria.valueType) {
        whereClause += ` AND VALTYPE_CD = ?`
        params.push(criteria.valueType)
      }

      if (criteria.providerId) {
        whereClause += ` AND PROVIDER_ID = ?`
        params.push(criteria.providerId)
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
      const observations = dataResult.success ? dataResult.data : []

      return {
        observations,
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
      console.error('Error getting observations paginated:', error)
      return {
        observations: [],
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
   * Search observations by text
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching observations
   */
  async searchObservations(searchTerm) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return []
    }

    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE CATEGORY_CHAR LIKE ? 
         OR CONCEPT_CD LIKE ? 
         OR TVAL_CHAR LIKE ? 
         OR CAST(PATIENT_NUM AS TEXT) LIKE ?
         OR CAST(ENCOUNTER_NUM AS TEXT) LIKE ?
      ORDER BY START_DATE DESC
    `
    const searchPattern = `%${searchTerm.trim()}%`
    const result = await this.connection.executeQuery(sql, [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern])
    return result.success ? result.data : []
  }

  /**
   * Update observation information
   * @param {number} observationId - Observation ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateObservation(observationId, updateData) {
    // Validate observation exists
    const existingObservation = await this.findById(observationId)
    if (!existingObservation) {
      throw new Error(`Observation with OBSERVATION_ID ${observationId} not found`)
    }

    return await this.update(observationId, updateData)
  }

  /**
   * Get observation value as appropriate type
   * @param {Object} observation - Observation object
   * @returns {any} - Typed value (number, string, or parsed BLOB)
   */
  getObservationValue(observation) {
    switch (observation.VALTYPE_CD) {
      case 'N':
        return observation.NVAL_NUM
      case 'T':
        return observation.TVAL_CHAR
      case 'B':
        try {
          return JSON.parse(observation.OBSERVATION_BLOB)
        } catch {
          return observation.OBSERVATION_BLOB
        }
      default:
        return observation.TVAL_CHAR || observation.NVAL_NUM
    }
  }

  /**
   * Get observations for a specific questionnaire/survey
   * @param {string} surveyCode - Survey code (e.g., "sams_1", "sams_2")
   * @returns {Promise<Array>} - Array of survey observations
   */
  async getSurveyObservations(surveyCode) {
    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE CATEGORY_CHAR = 'surveyBEST' 
        AND OBSERVATION_BLOB LIKE ?
      ORDER BY START_DATE DESC
    `
    const result = await this.connection.executeQuery(sql, [`%${surveyCode}%`])
    return result.success ? result.data : []
  }

  /**
   * Get numeric observations summary for a patient
   * @param {number} patientNum - Patient number
   * @returns {Promise<Object>} - Summary of numeric observations
   */
  async getPatientNumericSummary(patientNum) {
    const sql = `
      SELECT 
        CONCEPT_CD,
        COUNT(*) as count,
        AVG(NVAL_NUM) as average,
        MIN(NVAL_NUM) as minimum,
        MAX(NVAL_NUM) as maximum,
        SUM(NVAL_NUM) as total
      FROM ${this.tableName}
      WHERE PATIENT_NUM = ? AND VALTYPE_CD = 'N'
      GROUP BY CONCEPT_CD
      ORDER BY count DESC
    `
    const result = await this.connection.executeQuery(sql, [patientNum])
    return result.success ? result.data : []
  }
}

export default ObservationRepository
