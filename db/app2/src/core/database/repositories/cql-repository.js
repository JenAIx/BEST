/**
 * CQL Repository
 * 
 * This repository handles all operations related to Clinical Quality Language (CQL)
 * rules stored in the CQL_FACT table.
 */

import BaseRepository from './base-repository.js'

class CqlRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'CQL_FACT', 'CQL_ID')
  }

  /**
   * Find CQL rules by concept code using the CONCEPT_CQL_LOOKUP table
   * @param {string} conceptCode - The concept code to search for
   * @returns {Promise<Array>} - Array of CQL rules associated with the concept
   */
  async findByConceptCode(conceptCode) {
    try {
      // First find the lookup entries for this concept
      const lookupSql = `SELECT CQL_ID FROM CONCEPT_CQL_LOOKUP WHERE CONCEPT_CD = ?`
      const lookupResult = await this.connection.executeQuery(lookupSql, [conceptCode])
      
      if (!lookupResult.success || lookupResult.data.length === 0) {
        return []
      }
      
      // Get the CQL IDs from the lookup
      const cqlIds = lookupResult.data.map(row => row.CQL_ID)
      
      if (cqlIds.length === 0) {
        return []
      }
      
      // Find the actual CQL rules
      const placeholders = cqlIds.map(() => '?').join(',')
      const cqlSql = `SELECT * FROM ${this.tableName} WHERE CQL_ID IN (${placeholders})`
      const cqlResult = await this.connection.executeQuery(cqlSql, cqlIds)
      
      return cqlResult.success ? cqlResult.data : []
    } catch (error) {
      console.error('Error finding CQL rules by concept code:', error)
      return []
    }
  }

  /**
   * Find CQL rule by code
   * @param {string} code - The CQL code to search for
   * @returns {Promise<Object|null>} - CQL rule object or null if not found
   */
  async findByCode(code) {
    const sql = `SELECT * FROM ${this.tableName} WHERE CODE_CD = ?`
    const result = await this.connection.executeQuery(sql, [code])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find CQL rules by name (partial match)
   * @param {string} name - The name to search for
   * @returns {Promise<Array>} - Array of matching CQL rules
   */
  async findByName(name) {
    const sql = `SELECT * FROM ${this.tableName} WHERE NAME_CHAR LIKE ?`
    const result = await this.connection.executeQuery(sql, [`%${name}%`])
    return result.success ? result.data : []
  }

  /**
   * Find CQL rules by upload ID
   * @param {number} uploadId - The upload ID to search for
   * @returns {Promise<Array>} - Array of matching CQL rules
   */
  async findByUploadId(uploadId) {
    const sql = `SELECT * FROM ${this.tableName} WHERE UPLOAD_ID = ?`
    const result = await this.connection.executeQuery(sql, [uploadId])
    return result.success ? result.data : []
  }

  /**
   * Search CQL rules by multiple criteria
   * @param {Object} criteria - Search criteria object
   * @returns {Promise<Array>} - Array of matching CQL rules
   */
  async findCqlRulesByCriteria(criteria) {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`
    const params = []
    
    if (criteria.code) {
      sql += ` AND CODE_CD = ?`
      params.push(criteria.code)
    }
    
    if (criteria.name) {
      sql += ` AND NAME_CHAR LIKE ?`
      params.push(`%${criteria.name}%`)
    }
    
    if (criteria.uploadId) {
      sql += ` AND UPLOAD_ID = ?`
      params.push(criteria.uploadId)
    }
    
    sql += ` ORDER BY CODE_CD, NAME_CHAR`
    
    const result = await this.connection.executeQuery(sql, params)
    return result.success ? result.data : []
  }

  /**
   * Get CQL rule statistics
   * @returns {Promise<Object>} - CQL rule statistics
   */
  async getCqlRuleStatistics() {
    try {
      const [totalRules, byCode, byUploadId] = await Promise.all([
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName}`),
        this.connection.executeQuery(`SELECT CODE_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY CODE_CD`),
        this.connection.executeQuery(`SELECT UPLOAD_ID, COUNT(*) as count FROM ${this.tableName} GROUP BY UPLOAD_ID`)
      ])

      return {
        totalRules: totalRules.success ? totalRules.data[0].count : 0,
        byCode: byCode.success ? byCode.data : [],
        byUploadId: byUploadId.success ? byUploadId.data : []
      }
    } catch (error) {
      console.error('Error getting CQL rule statistics:', error)
      return {
        totalRules: 0,
        byCode: [],
        byUploadId: []
      }
    }
  }

  /**
   * Get CQL rules with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} criteria - Optional search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getCqlRulesPaginated(page = 1, pageSize = 20, criteria = {}) {
    try {
      const offset = (page - 1) * pageSize
      
      // Build WHERE clause for criteria
      let whereClause = 'WHERE 1=1'
      const params = []
      
      if (criteria.code) {
        whereClause += ` AND CODE_CD = ?`
        params.push(criteria.code)
      }
      
      if (criteria.name) {
        whereClause += ` AND NAME_CHAR LIKE ?`
        params.push(`%${criteria.name}%`)
      }
      
      if (criteria.uploadId) {
        whereClause += ` AND UPLOAD_ID = ?`
        params.push(criteria.uploadId)
      }
      
      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`
      const countResult = await this.connection.executeQuery(countSql, params)
      const totalCount = countResult.success ? countResult.data[0].count : 0
      
      // Get paginated data
      const dataSql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY CODE_CD, NAME_CHAR LIMIT ? OFFSET ?`
      const dataResult = await this.connection.executeQuery(dataSql, [...params, pageSize, offset])
      const rules = dataResult.success ? dataResult.data : []
      
      return {
        rules,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasNext: page < Math.ceil(totalCount / pageSize),
          hasPrev: page > 1
        }
      }
    } catch (error) {
      console.error('Error getting CQL rules paginated:', error)
      return {
        rules: [],
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  }

  /**
   * Create a new CQL rule
   * @param {Object} cqlData - CQL rule data
   * @returns {Promise<Object>} - Created CQL rule with CQL_ID
   */
  async createCqlRule(cqlData) {
    if (!cqlData.CODE_CD) {
      throw new Error('CODE_CD is required for CQL rule creation')
    }
    
    if (!cqlData.NAME_CHAR) {
      throw new Error('NAME_CHAR is required for CQL rule creation')
    }
    
    // Add audit fields
    const now = new Date().toISOString()
    const cqlWithAudit = {
      ...cqlData,
      UPDATE_DATE: cqlData.UPDATE_DATE || now,
      IMPORT_DATE: cqlData.IMPORT_DATE || now,
      UPLOAD_ID: cqlData.UPLOAD_ID || 1
    }
    
    return await this.create(cqlWithAudit)
  }

  /**
   * Update CQL rule by ID
   * @param {number} cqlId - The CQL ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateCqlRule(cqlId, updateData) {
    if (!cqlId) {
      throw new Error('CQL ID is required for update')
    }
    
    // Add audit fields
    const updateWithAudit = {
      ...updateData,
      UPDATE_DATE: new Date().toISOString()
    }
    
    return await this.update(cqlId, updateWithAudit)
  }

  /**
   * Delete CQL rule by ID
   * @param {number} cqlId - The CQL ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteCqlRule(cqlId) {
    if (!cqlId) {
      throw new Error('CQL ID is required for deletion')
    }
    
    return await this.delete(cqlId)
  }

  /**
   * Get CQL rule with related concept lookups
   * @param {number} cqlId - The CQL ID to get
   * @returns {Promise<Object|null>} - CQL rule with related lookups or null
   */
  async getCqlRuleWithLookups(cqlId) {
    try {
      // Get the CQL rule
      const cqlRule = await this.findById(cqlId)
      if (!cqlRule) {
        return null
      }
      
      // Get related concept lookups
      const lookupsSql = `
        SELECT ccl.*, cd.NAME_CHAR as CONCEPT_NAME, cd.CONCEPT_PATH
        FROM CONCEPT_CQL_LOOKUP ccl
        JOIN CONCEPT_DIMENSION cd ON ccl.CONCEPT_CD = cd.CONCEPT_CD
        WHERE ccl.CQL_ID = ?
      `
      const lookupsResult = await this.connection.executeQuery(lookupsSql, [cqlId])
      const lookups = lookupsResult.success ? lookupsResult.data : []
      
      return {
        ...cqlRule,
        conceptLookups: lookups
      }
    } catch (error) {
      console.error('Error getting CQL rule with lookups:', error)
      return null
    }
  }
}

export default CqlRepository
