/**
 * Concept Repository
 *
 * This repository handles all operations related to medical concepts
 * (SNOMED/LOINC) stored in the CONCEPT_DIMENSION table.
 */

import BaseRepository from './base-repository.js'

class ConceptRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'CONCEPT_DIMENSION', 'CONCEPT_CD')
  }

  /**
   * Find concept by concept code
   * @param {string} conceptCode - The concept code to search for
   * @returns {Promise<Object|null>} - Concept object or null if not found
   */
  async findByConceptCode(conceptCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE CONCEPT_CD = ?`
    const result = await this.connection.executeQuery(sql, [conceptCode])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find concepts by concept path
   * @param {string} conceptPath - The concept path to search for
   * @returns {Promise<Array>} - Array of matching concepts
   */
  async findByConceptPath(conceptPath) {
    const sql = `SELECT * FROM ${this.tableName} WHERE CONCEPT_PATH LIKE ?`
    const result = await this.connection.executeQuery(sql, [`%${conceptPath}%`])
    return result.success ? result.data : []
  }

  /**
   * Find concepts by name (partial match)
   * @param {string} name - The name to search for
   * @returns {Promise<Array>} - Array of matching concepts
   */
  async findByName(name) {
    const sql = `SELECT * FROM ${this.tableName} WHERE NAME_CHAR LIKE ?`
    const result = await this.connection.executeQuery(sql, [`%${name}%`])
    return result.success ? result.data : []
  }

  /**
   * Find concepts by value type
   * @param {string} valueType - The value type to search for
   * @returns {Promise<Array>} - Array of matching concepts
   */
  async findByValueType(valueType) {
    const sql = `SELECT * FROM ${this.tableName} WHERE VALTYPE_CD = ?`
    const result = await this.connection.executeQuery(sql, [valueType])
    return result.success ? result.data : []
  }

  /**
   * Find concepts by unit
   * @param {string} unit - The unit to search for
   * @returns {Promise<Array>} - Array of matching concepts
   */
  async findByUnit(unit) {
    const sql = `SELECT * FROM ${this.tableName} WHERE UNIT_CD = ?`
    const result = await this.connection.executeQuery(sql, [unit])
    return result.success ? result.data : []
  }

  /**
   * Find concepts by source system
   * @param {string} sourceSystem - The source system to search for
   * @returns {Promise<Array>} - Array of matching concepts
   */
  async findBySourceSystem(sourceSystem) {
    const sql = `SELECT * FROM ${this.tableName} WHERE SOURCESYSTEM_CD = ?`
    const result = await this.connection.executeQuery(sql, [sourceSystem])
    return result.success ? result.data : []
  }

  /**
   * Execute custom query for concept lookups (used by import services)
   * @param {string} query - SQL query to execute
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result with success/data structure
   */
  async executeQuery(query, params = []) {
    return this.connection.executeQuery(query, params)
  }

  /**
   * Search concepts by multiple criteria
   * @param {Object} criteria - Search criteria object
   * @returns {Promise<Array>} - Array of matching concepts
   */
  async findConceptsByCriteria(criteria) {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`
    const params = []

    if (criteria.conceptPath) {
      sql += ` AND CONCEPT_PATH LIKE ?`
      params.push(`%${criteria.conceptPath}%`)
    }

    if (criteria.name) {
      sql += ` AND NAME_CHAR LIKE ?`
      params.push(`%${criteria.name}%`)
    }

    if (criteria.valueType) {
      sql += ` AND VALTYPE_CD = ?`
      params.push(criteria.valueType)
    }

    if (criteria.unit) {
      sql += ` AND UNIT_CD = ?`
      params.push(criteria.unit)
    }

    if (criteria.sourceSystem) {
      sql += ` AND SOURCESYSTEM_CD = ?`
      params.push(criteria.sourceSystem)
    }

    if (criteria.uploadId) {
      sql += ` AND UPLOAD_ID = ?`
      params.push(criteria.uploadId)
    }

    sql += ` ORDER BY CONCEPT_PATH, NAME_CHAR`

    const result = await this.connection.executeQuery(sql, params)
    return result.success ? result.data : []
  }

  /**
   * Get concept statistics
   * @returns {Promise<Object>} - Concept statistics
   */
  async getConceptStatistics() {
    try {
      const [totalConcepts, byValueType, bySourceSystem, byUnit] = await Promise.all([
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName}`),
        this.connection.executeQuery(`SELECT VALTYPE_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY VALTYPE_CD`),
        this.connection.executeQuery(`SELECT SOURCESYSTEM_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY SOURCESYSTEM_CD`),
        this.connection.executeQuery(`SELECT UNIT_CD, COUNT(*) as count FROM ${this.tableName} WHERE UNIT_CD IS NOT NULL GROUP BY UNIT_CD`),
      ])

      return {
        totalConcepts: totalConcepts.success ? totalConcepts.data[0].count : 0,
        byValueType: byValueType.success ? byValueType.data : [],
        bySourceSystem: bySourceSystem.success ? bySourceSystem.data : [],
        byUnit: byUnit.success ? byUnit.data : [],
      }
    } catch (error) {
      console.error('Error getting concept statistics:', error)
      return {
        totalConcepts: 0,
        byValueType: [],
        bySourceSystem: [],
        byUnit: [],
      }
    }
  }

  /**
   * Get concepts with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} criteria - Optional search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getConceptsPaginated(page = 1, pageSize = 20, criteria = {}) {
    try {
      const offset = (page - 1) * pageSize

      // Build WHERE clause for criteria
      let whereClause = 'WHERE 1=1'
      const params = []

      // General search across multiple fields
      if (criteria.search) {
        whereClause += ` AND (CONCEPT_CD LIKE ? OR NAME_CHAR LIKE ? OR CONCEPT_PATH LIKE ?)`
        const searchTerm = `%${criteria.search}%`
        params.push(searchTerm, searchTerm, searchTerm)
      }

      // Specific field filters
      if (criteria.conceptPath) {
        whereClause += ` AND CONCEPT_PATH LIKE ?`
        params.push(`%${criteria.conceptPath}%`)
      }

      if (criteria.name) {
        whereClause += ` AND NAME_CHAR LIKE ?`
        params.push(`%${criteria.name}%`)
      }

      if (criteria.valueType) {
        whereClause += ` AND VALTYPE_CD = ?`
        params.push(criteria.valueType)
      }

      if (criteria.valueTypes && criteria.valueTypes.length > 0) {
        const placeholders = criteria.valueTypes.map(() => '?').join(',')
        whereClause += ` AND VALTYPE_CD IN (${placeholders})`
        params.push(...criteria.valueTypes)
      }

      if (criteria.sourceSystem) {
        whereClause += ` AND SOURCESYSTEM_CD = ?`
        params.push(criteria.sourceSystem)
      }

      if (criteria.category) {
        whereClause += ` AND CATEGORY_CHAR = ?`
        params.push(criteria.category)
      }

      if (criteria.categories && criteria.categories.length > 0) {
        const placeholders = criteria.categories.map(() => '?').join(',')
        whereClause += ` AND CATEGORY_CHAR IN (${placeholders})`
        params.push(...criteria.categories)
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`
      const countResult = await this.connection.executeQuery(countSql, params)
      const totalCount = countResult.success ? countResult.data[0].count : 0

      // Get paginated data
      const dataSql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY NAME_CHAR, CONCEPT_PATH LIMIT ? OFFSET ?`
      const dataResult = await this.connection.executeQuery(dataSql, [...params, pageSize, offset])
      const concepts = dataResult.success ? dataResult.data : []

      return {
        concepts,
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
      console.error('Error getting concepts paginated:', error)
      return {
        concepts: [],
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
   * Create a new concept
   * @param {Object} conceptData - Concept data
   * @returns {Promise<Object>} - Created concept with CONCEPT_CD
   */
  async createConcept(conceptData) {
    if (!conceptData.CONCEPT_CD) {
      throw new Error('CONCEPT_CD is required for concept creation')
    }

    if (!conceptData.NAME_CHAR) {
      throw new Error('NAME_CHAR is required for concept creation')
    }

    // Add audit fields
    const now = new Date().toISOString()
    const conceptWithAudit = {
      ...conceptData,
      UPDATE_DATE: conceptData.UPDATE_DATE || now,
      IMPORT_DATE: conceptData.IMPORT_DATE || now,
      UPLOAD_ID: conceptData.UPLOAD_ID || 1,
    }

    return await this.create(conceptWithAudit)
  }

  /**
   * Update concept by concept code
   * @param {string} conceptCode - The concept code to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateConcept(conceptCode, updateData) {
    if (!conceptCode) {
      throw new Error('Concept code is required for update')
    }

    // Add audit fields
    const updateWithAudit = {
      ...updateData,
      UPDATE_DATE: new Date().toISOString(),
    }

    return await this.update(conceptCode, updateWithAudit)
  }

  /**
   * Delete concept by concept code
   * @param {string} conceptCode - The concept code to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteConcept(conceptCode) {
    if (!conceptCode) {
      throw new Error('Concept code is required for deletion')
    }

    return await this.deleteByCriteria({ CONCEPT_CD: conceptCode })
  }
}

export default ConceptRepository
