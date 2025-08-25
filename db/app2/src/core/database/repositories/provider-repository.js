/**
 * Provider Repository
 * 
 * Manages healthcare providers in the PROVIDER_DIMENSION table.
 * Handles CRUD operations, search, filtering, and provider-specific business logic.
 * 
 * Based on real-world data patterns from test_DB_v20231222.db:
 * - Providers have unique IDs (e.g., "admin", "db", "stefan")
 * - Provider paths indicate organizational structure (e.g., "UKJ/IMSID/MI")
 * - Names are stored in NAME_CHAR field
 * - BLOB data contains additional provider information
 * - Providers are linked to observations via PROVIDER_ID
 */

import BaseRepository from './base-repository.js'

class ProviderRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'PROVIDER_DIMENSION', 'PROVIDER_ID')
  }

  /**
   * Create a new healthcare provider
   * @param {Object} providerData - Provider data object
   * @returns {Promise<Object>} - Created provider with PROVIDER_ID
   */
  async createProvider(providerData) {
    // Validate required fields
    if (!providerData.PROVIDER_ID) {
      throw new Error('PROVIDER_ID is required for provider creation')
    }
    if (!providerData.NAME_CHAR) {
      throw new Error('NAME_CHAR is required for provider creation')
    }

    // Set default values for optional fields
    const providerWithDefaults = {
      SOURCESYSTEM_CD: providerData.SOURCESYSTEM_CD || 'SYSTEM',
      UPLOAD_ID: providerData.UPLOAD_ID || 1,
      ...providerData
    }

    // Use custom create method for string-based primary key
    const fields = Object.keys(providerWithDefaults).filter(key => providerWithDefaults[key] !== undefined)
    const placeholders = fields.map(() => '?').join(', ')
    const values = fields.map(field => providerWithDefaults[field])
    
    const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`
    const result = await this.connection.executeCommand(sql, values)
    
    if (result.success) {
      return providerWithDefaults // Return the original data since PROVIDER_ID is the primary key
    }
    throw new Error('Failed to create provider')
  }

  /**
   * Find provider by provider ID
   * @param {string} providerId - Provider ID (e.g., "admin", "db")
   * @returns {Promise<Object|null>} - Provider object or null if not found
   */
  async findByProviderId(providerId) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PROVIDER_ID = ?`
    const result = await this.connection.executeQuery(sql, [providerId])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find providers by name pattern
   * @param {string} namePattern - Name pattern to search for
   * @returns {Promise<Array>} - Array of matching providers
   */
  async findByName(namePattern) {
    const sql = `SELECT * FROM ${this.tableName} WHERE NAME_CHAR LIKE ? ORDER BY NAME_CHAR`
    const result = await this.connection.executeQuery(sql, [`%${namePattern}%`])
    return result.success ? result.data : []
  }

  /**
   * Find providers by path pattern
   * @param {string} pathPattern - Path pattern to search for
   * @returns {Promise<Array>} - Array of matching providers
   */
  async findByPath(pathPattern) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PROVIDER_PATH LIKE ? ORDER BY PROVIDER_PATH`
    const result = await this.connection.executeQuery(sql, [`%${pathPattern}%`])
    return result.success ? result.data : []
  }

  /**
   * Find providers by department/specialty
   * @param {string} department - Department or specialty (e.g., "NEURO", "IMSID")
   * @returns {Promise<Array>} - Array of providers in department
   */
  async findByDepartment(department) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PROVIDER_PATH LIKE ? ORDER BY NAME_CHAR`
    const result = await this.connection.executeQuery(sql, [`%${department}%`])
    return result.success ? result.data : []
  }

  /**
   * Find providers by organization
   * @param {string} organization - Organization code (e.g., "UKJ")
   * @returns {Promise<Array>} - Array of providers in organization
   */
  async findByOrganization(organization) {
    const sql = `SELECT * FROM ${this.tableName} WHERE PROVIDER_PATH LIKE ? ORDER BY PROVIDER_PATH, NAME_CHAR`
    const result = await this.connection.executeQuery(sql, [`${organization}%`])
    return result.success ? result.data : []
  }

  /**
   * Get providers with their observation counts
   * @returns {Promise<Array>} - Array of providers with observation counts
   */
  async getProvidersWithObservationCounts() {
    const sql = `
      SELECT p.*, 
             COUNT(o.OBSERVATION_ID) as observationCount
      FROM ${this.tableName} p
      LEFT JOIN OBSERVATION_FACT o ON p.PROVIDER_ID = o.PROVIDER_ID
      GROUP BY p.PROVIDER_ID
      ORDER BY observationCount DESC, p.NAME_CHAR
    `
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data : []
  }

  /**
   * Get provider statistics
   * @returns {Promise<Object>} - Provider statistics object
   */
  async getProviderStatistics() {
    try {
      const [
        totalProviders,
        byOrganization,
        byDepartment,
        withObservations,
        byMonth
      ] = await Promise.all([
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName}`),
        this.connection.executeQuery(`SELECT SUBSTR(PROVIDER_PATH, 1, INSTR(PROVIDER_PATH, '/') - 1) as org, COUNT(*) as count FROM ${this.tableName} WHERE PROVIDER_PATH LIKE '%/%' GROUP BY org`),
        this.connection.executeQuery(`SELECT SUBSTR(PROVIDER_PATH, INSTR(PROVIDER_PATH, '/') + 1) as dept, COUNT(*) as count FROM ${this.tableName} WHERE PROVIDER_PATH LIKE '%/%' GROUP BY dept`),
        this.connection.executeQuery(`SELECT COUNT(DISTINCT p.PROVIDER_ID) as count FROM ${this.tableName} p INNER JOIN OBSERVATION_FACT o ON p.PROVIDER_ID = o.PROVIDER_ID`),
        this.connection.executeQuery(`SELECT strftime('%Y-%m', IMPORT_DATE) as month, COUNT(*) as count FROM ${this.tableName} GROUP BY month ORDER BY month DESC LIMIT 12`)
      ])

      return {
        totalProviders: totalProviders.success ? totalProviders.data[0].count : 0,
        byOrganization: byOrganization.success ? byOrganization.data : [],
        byDepartment: byDepartment.success ? byDepartment.data : [],
        withObservations: withObservations.success ? withObservations.data[0].count : 0,
        byMonth: byMonth.success ? byMonth.data : []
      }
    } catch (error) {
      console.error('Error getting provider statistics:', error)
      return {
        totalProviders: 0,
        byOrganization: [],
        byDepartment: [],
        withObservations: 0,
        byMonth: []
      }
    }
  }

  /**
   * Get providers with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} criteria - Optional search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getProvidersPaginated(page = 1, pageSize = 20, criteria = {}) {
    try {
      const offset = (page - 1) * pageSize
      
      // Build WHERE clause for criteria
      let whereClause = 'WHERE 1=1'
      const params = []
      
      if (criteria.name) {
        whereClause += ` AND NAME_CHAR LIKE ?`
        params.push(`%${criteria.name}%`)
      }
      
      if (criteria.path) {
        whereClause += ` AND PROVIDER_PATH LIKE ?`
        params.push(`%${criteria.path}%`)
      }
      
      if (criteria.organization) {
        whereClause += ` AND PROVIDER_PATH LIKE ?`
        params.push(`${criteria.organization}%`)
      }
      
      if (criteria.department) {
        whereClause += ` AND PROVIDER_PATH LIKE ?`
        params.push(`%${criteria.department}%`)
      }
      
      if (criteria.hasObservations) {
        whereClause += ` AND EXISTS (SELECT 1 FROM OBSERVATION_FACT o WHERE o.PROVIDER_ID = ${this.tableName}.PROVIDER_ID)`
      }
      
      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`
      const countResult = await this.connection.executeQuery(countSql, params)
      const totalCount = countResult.success ? countResult.data[0].count : 0
      
      // Get paginated data
      const dataSql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY PROVIDER_PATH, NAME_CHAR LIMIT ? OFFSET ?`
      const dataResult = await this.connection.executeQuery(dataSql, [...params, pageSize, offset])
      const providers = dataResult.success ? dataResult.data : []
      
      return {
        providers,
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
      console.error('Error getting providers paginated:', error)
      return {
        providers: [],
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
   * Search providers by text
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching providers
   */
  async searchProviders(searchTerm) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return []
    }

    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE PROVIDER_ID LIKE ? 
         OR NAME_CHAR LIKE ? 
         OR PROVIDER_PATH LIKE ?
      ORDER BY PROVIDER_PATH, NAME_CHAR
    `
    const searchPattern = `%${searchTerm.trim()}%`
    const result = await this.connection.executeQuery(sql, [searchPattern, searchPattern, searchPattern])
    return result.success ? result.data : []
  }

  /**
   * Update provider information
   * @param {string} providerId - Provider ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateProvider(providerId, updateData) {
    // Validate provider exists
    const existingProvider = await this.findByProviderId(providerId)
    if (!existingProvider) {
      throw new Error(`Provider with PROVIDER_ID ${providerId} not found`)
    }

    return await this.update(providerId, updateData)
  }

  /**
   * Get provider organizational hierarchy
   * @returns {Promise<Object>} - Hierarchical organization structure
   */
  async getProviderHierarchy() {
    try {
      const sql = `
        SELECT 
          SUBSTR(PROVIDER_PATH, 1, INSTR(PROVIDER_PATH, '/') - 1) as organization,
          SUBSTR(PROVIDER_PATH, INSTR(PROVIDER_PATH, '/') + 1) as department,
          COUNT(*) as providerCount
        FROM ${this.tableName}
        WHERE PROVIDER_PATH LIKE '%/%'
        GROUP BY organization, department
        ORDER BY organization, department
      `
      const result = await this.connection.executeQuery(sql)
      
      if (!result.success) {
        return {}
      }

      // Build hierarchy
      const hierarchy = {}
      result.data.forEach(row => {
        if (!hierarchy[row.organization]) {
          hierarchy[row.organization] = {}
        }
        hierarchy[row.organization][row.department] = row.providerCount
      })

      return hierarchy
    } catch (error) {
      console.error('Error getting provider hierarchy:', error)
      return {}
    }
  }

  /**
   * Get providers by role/function
   * @param {string} role - Role or function (e.g., "wissenschaftlicher Mitarbeiter")
   * @returns {Promise<Array>} - Array of providers with role
   */
  async findByRole(role) {
    const sql = `SELECT * FROM ${this.tableName} WHERE CONCEPT_BLOB LIKE ? ORDER BY NAME_CHAR`
    const result = await this.connection.executeQuery(sql, [`%${role}%`])
    return result.success ? result.data : []
  }

  /**
   * Get active providers (with recent activity)
   * @param {number} daysThreshold - Days threshold for recent activity
   * @returns {Promise<Array>} - Array of active providers
   */
  async getActiveProviders(daysThreshold = 30) {
    const sql = `
      SELECT DISTINCT p.*
      FROM ${this.tableName} p
      INNER JOIN OBSERVATION_FACT o ON p.PROVIDER_ID = o.PROVIDER_ID
      WHERE o.START_DATE >= date('now', '-${daysThreshold} days')
      ORDER BY p.NAME_CHAR
    `
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data : []
  }

  /**
   * Get provider performance metrics
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} - Provider performance metrics
   */
  async getProviderPerformance(providerId) {
    try {
      const sql = `
        SELECT 
          COUNT(o.OBSERVATION_ID) as totalObservations,
          COUNT(DISTINCT o.PATIENT_NUM) as uniquePatients,
          COUNT(DISTINCT o.ENCOUNTER_NUM) as uniqueVisits,
          MIN(o.START_DATE) as firstObservation,
          MAX(o.START_DATE) as lastObservation,
          AVG(CASE WHEN o.VALTYPE_CD = 'N' THEN o.NVAL_NUM END) as avgNumericValue
        FROM ${this.tableName} p
        LEFT JOIN OBSERVATION_FACT o ON p.PROVIDER_ID = o.PROVIDER_ID
        WHERE p.PROVIDER_ID = ?
      `
      const result = await this.connection.executeQuery(sql, [providerId])
      
      if (!result.success || result.data.length === 0) {
        return {
          totalObservations: 0,
          uniquePatients: 0,
          uniqueVisits: 0,
          firstObservation: null,
          lastObservation: null,
          avgNumericValue: null
        }
      }

      return result.data[0]
    } catch (error) {
      console.error('Error getting provider performance:', error)
      return {
        totalObservations: 0,
        uniquePatients: 0,
        uniqueVisits: 0,
        firstObservation: null,
        lastObservation: null,
        avgNumericValue: null
      }
    }
  }
}

export default ProviderRepository
