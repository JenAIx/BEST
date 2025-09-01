/**
 * Base Repository Class
 * Provides common CRUD operations for all entities
 * Uses parameterized queries to prevent SQL injection
 */

class BaseRepository {
  constructor(connection, tableName, primaryKey = 'id') {
    this.connection = connection
    this.tableName = tableName
    this.primaryKey = primaryKey
  }

  /**
   * Find entity by ID
   * @param {string|number} id - Entity ID
   * @returns {Promise<Object|null>} - Found entity or null
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`
    const result = await this.connection.executeQuery(sql, [id])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find all entities
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<Array>} - Array of entities
   */
  async findAll(options = {}) {
    let sql = `SELECT * FROM ${this.tableName}`
    const params = []

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`
      if (options.orderDirection) {
        sql += ` ${options.orderDirection.toUpperCase()}`
      }
    }

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
   * Find entities by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of matching entities
   */
  async findByCriteria(criteria, options = {}) {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`
    const params = []

    // Build WHERE clause dynamically
    for (const [key, value] of Object.entries(criteria)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          // Handle array values (IN clause)
          const placeholders = value.map(() => '?').join(', ')
          sql += ` AND ${key} IN (${placeholders})`
          params.push(...value)
        } else if (typeof value === 'object' && value.operator) {
          // Handle custom operators (>, <, LIKE, BETWEEN, etc.)
          if (value.operator === 'BETWEEN' && Array.isArray(value.value) && value.value.length === 2) {
            sql += ` AND ${key} BETWEEN ? AND ?`
            params.push(value.value[0], value.value[1])
          } else {
            sql += ` AND ${key} ${value.operator} ?`
            params.push(value.value)
          }
        } else {
          // Default equality comparison
          sql += ` AND ${key} = ?`
          params.push(value)
        }
      }
    }

    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`
      if (options.orderDirection) {
        sql += ` ${options.orderDirection.toUpperCase()}`
      }
    }

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
   * Count entities by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} - Count of matching entities
   */
  async countByCriteria(criteria = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE 1=1`
    const params = []

    for (const [key, value] of Object.entries(criteria)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          const placeholders = value.map(() => '?').join(', ')
          sql += ` AND ${key} IN (${placeholders})`
          params.push(...value)
        } else if (typeof value === 'object' && value.operator) {
          // Handle custom operators (>, <, LIKE, BETWEEN, etc.)
          if (value.operator === 'BETWEEN' && Array.isArray(value.value) && value.value.length === 2) {
            sql += ` AND ${key} BETWEEN ? AND ?`
            params.push(value.value[0], value.value[1])
          } else {
            sql += ` AND ${key} ${value.operator} ?`
            params.push(value.value)
          }
        } else {
          sql += ` AND ${key} = ?`
          params.push(value)
        }
      }
    }

    const result = await this.connection.executeQuery(sql, params)
    return result.success && result.data.length > 0 ? result.data[0].count : 0
  }

  /**
   * Create a new entity
   * @param {Object} entity - Entity data
   * @returns {Promise<Object>} - Created entity with ID
   */
  async create(entity) {
    // Filter out undefined values
    const fields = Object.keys(entity).filter((key) => entity[key] !== undefined)

    if (fields.length === 0) {
      throw new Error('Failed to create entity')
    }

    const placeholders = fields.map(() => '?').join(', ')
    const values = fields.map((field) => entity[field])

    const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`
    const result = await this.connection.executeCommand(sql, values)

    if (result.success) {
      // Handle different connection types that may use different property names
      const id = result.lastID || result.lastId
      return { ...entity, [this.primaryKey]: id }
    }
    throw new Error('Failed to create entity')
  }

  /**
   * Update an existing entity
   * @param {string|number} id - Entity ID
   * @param {Object} entity - Entity data to update
   * @returns {Promise<boolean>} - Success status
   */
  async update(id, entity) {
    // Filter out undefined values and primary key field
    const fields = Object.keys(entity).filter((key) => entity[key] !== undefined && key !== this.primaryKey)

    if (fields.length === 0) {
      throw new Error('No fields to update')
    }

    const setClause = fields.map((field) => `${field} = ?`).join(', ')
    const values = [...fields.map((field) => entity[field]), id]

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`
    const result = await this.connection.executeCommand(sql, values)

    // Check if the update was successful by looking at the changes count
    // The result from executeCommand returns { lastID/lastId, changes }
    return result && typeof result.changes === 'number' && result.changes > 0
  }

  /**
   * Delete an entity by ID
   * @param {string|number} id - Entity ID
   * @returns {Promise<boolean>} - Success status
   */
  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`
    const result = await this.connection.executeCommand(sql, [id])
    return result.success
  }

  /**
   * Update entities by criteria
   * @param {Object} criteria - Update criteria
   * @param {Object} updateData - Data to update
   * @returns {Promise<number>} - Number of updated entities
   */
  async updateByCriteria(criteria, updateData) {
    // Filter out undefined values
    const updateFields = Object.keys(updateData).filter((key) => updateData[key] !== undefined)

    if (updateFields.length === 0) {
      throw new Error('No fields to update')
    }

    let sql = `UPDATE ${this.tableName} SET `
    const params = []

    // Build SET clause
    const setClause = updateFields
      .map((field) => {
        params.push(updateData[field])
        return `${field} = ?`
      })
      .join(', ')

    sql += setClause + ` WHERE 1=1`

    // Build WHERE clause
    for (const [key, value] of Object.entries(criteria)) {
      if (value !== undefined && value !== null && value !== '') {
        sql += ` AND ${key} = ?`
        params.push(value)
      }
    }

    const result = await this.connection.executeCommand(sql, params)
    return result.success ? result.changes : 0
  }

  /**
   * Delete entities by criteria
   * @param {Object} criteria - Delete criteria
   * @returns {Promise<number>} - Number of deleted entities
   */
  async deleteByCriteria(criteria) {
    let sql = `DELETE FROM ${this.tableName} WHERE 1=1`
    const params = []

    for (const [key, value] of Object.entries(criteria)) {
      if (value !== undefined && value !== null && value !== '') {
        sql += ` AND ${key} = ?`
        params.push(value)
      }
    }

    const result = await this.connection.executeCommand(sql, params)
    return result.success ? result.changes : 0
  }

  /**
   * Check if entity exists by criteria
   * @param {Object} criteria - Existence criteria
   * @returns {Promise<boolean>} - Existence status
   */
  async exists(criteria) {
    const count = await this.countByCriteria(criteria)
    return count > 0
  }

  /**
   * Execute raw SQL query (use with caution)
   * @param {string} sql - Raw SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async executeRawQuery(sql, params = []) {
    return await this.connection.executeQuery(sql, params)
  }

  /**
   * Execute raw SQL command (use with caution)
   * @param {string} sql - Raw SQL command
   * @param {Array} params - Command parameters
   * @returns {Promise<Object>} - Command result
   */
  async executeRawCommand(sql, params = []) {
    return await this.connection.executeCommand(sql, params)
  }
}

export default BaseRepository
