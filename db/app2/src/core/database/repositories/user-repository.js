/**
 * User Repository
 * 
 * This repository handles all operations related to user management
 * stored in the USER_MANAGEMENT table.
 */

import BaseRepository from './base-repository.js'

class UserRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'USER_MANAGEMENT', 'USER_ID')
  }

  /**
   * Find user by user code
   * @param {string} userCode - The user code to search for
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async findByUserCode(userCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE USER_CD = ?`
    const result = await this.connection.executeQuery(sql, [userCode])
    return result.success && result.data.length > 0 ? result.data[0] : null
  }

  /**
   * Find users by column code (user type)
   * @param {string} columnCode - The column code to search for (e.g., 'admin', 'user')
   * @returns {Promise<Array>} - Array of matching users
   */
  async findByColumnCode(columnCode) {
    const sql = `SELECT * FROM ${this.tableName} WHERE COLUMN_CD = ?`
    const result = await this.connection.executeQuery(sql, [columnCode])
    return result.success ? result.data : []
  }

  /**
   * Find users by name (partial match)
   * @param {string} name - The name to search for
   * @returns {Promise<Array>} - Array of matching users
   */
  async findByName(name) {
    const sql = `SELECT * FROM ${this.tableName} WHERE NAME_CHAR LIKE ?`
    const result = await this.connection.executeQuery(sql, [`%${name}%`])
    return result.success ? result.data : []
  }

  /**
   * Find users by upload ID
   * @param {number} uploadId - The upload ID to search for
   * @returns {Promise<Array>} - Array of matching users
   */
  async findByUploadId(uploadId) {
    const sql = `SELECT * FROM ${this.tableName} WHERE UPLOAD_ID = ?`
    const result = await this.connection.executeQuery(sql, [uploadId])
    return result.success ? result.data : []
  }

  /**
   * Search users by multiple criteria
   * @param {Object} criteria - Search criteria object
   * @returns {Promise<Array>} - Array of matching users
   */
  async findUsersByCriteria(criteria) {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`
    const params = []
    
    if (criteria.userCode) {
      sql += ` AND USER_CD = ?`
      params.push(criteria.userCode)
    }
    
    if (criteria.columnCode) {
      sql += ` AND COLUMN_CD = ?`
      params.push(criteria.columnCode)
    }
    
    if (criteria.name) {
      sql += ` AND NAME_CHAR LIKE ?`
      params.push(`%${criteria.name}%`)
    }
    
    if (criteria.uploadId) {
      sql += ` AND UPLOAD_ID = ?`
      params.push(criteria.uploadId)
    }
    
    sql += ` ORDER BY COLUMN_CD, USER_CD`
    
    const result = await this.connection.executeQuery(sql, params)
    return result.success ? result.data : []
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} - User statistics
   */
  async getUserStatistics() {
    try {
      const [totalUsers, byColumnCode, byUploadId] = await Promise.all([
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName}`),
        this.connection.executeQuery(`SELECT COLUMN_CD, COUNT(*) as count FROM ${this.tableName} GROUP BY COLUMN_CD`),
        this.connection.executeQuery(`SELECT UPLOAD_ID, COUNT(*) as count FROM ${this.tableName} GROUP BY UPLOAD_ID`)
      ])

      return {
        totalUsers: totalUsers.success ? totalUsers.data[0].count : 0,
        byColumnCode: byColumnCode.success ? byColumnCode.data : [],
        byUploadId: byUploadId.success ? byUploadId.data : []
      }
    } catch (error) {
      console.error('Error getting user statistics:', error)
      return {
        totalUsers: 0,
        byColumnCode: [],
        byUploadId: []
      }
    }
  }

  /**
   * Get users with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} criteria - Optional search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getUsersPaginated(page = 1, pageSize = 20, criteria = {}) {
    try {
      const offset = (page - 1) * pageSize
      
      // Build WHERE clause for criteria
      let whereClause = 'WHERE 1=1'
      const params = []
      
      if (criteria.userCode) {
        whereClause += ` AND USER_CD = ?`
        params.push(criteria.userCode)
      }
      
      if (criteria.columnCode) {
        whereClause += ` AND COLUMN_CD = ?`
        params.push(criteria.columnCode)
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
      const dataSql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY COLUMN_CD, USER_CD LIMIT ? OFFSET ?`
      const dataResult = await this.connection.executeQuery(dataSql, [...params, pageSize, offset])
      const users = dataResult.success ? dataResult.data : []
      
      return {
        users,
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
      console.error('Error getting users paginated:', error)
      return {
        users: [],
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
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user with USER_ID
   */
  async createUser(userData) {
    if (!userData.USER_CD) {
      throw new Error('USER_CD is required for user creation')
    }
    
    if (!userData.COLUMN_CD) {
      throw new Error('COLUMN_CD is required for user creation')
    }
    
    // Add audit fields
    const now = new Date().toISOString()
    const userWithAudit = {
      ...userData,
      UPDATE_DATE: userData.UPDATE_DATE || now,
      IMPORT_DATE: userData.IMPORT_DATE || now,
      UPLOAD_ID: userData.UPLOAD_ID || 1
    }
    
    return await this.create(userWithAudit)
  }

  /**
   * Update user by ID
   * @param {number} userId - The user ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateUser(userId, updateData) {
    if (!userId) {
      throw new Error('User ID is required for update')
    }
    
    // Add audit fields
    const updateWithAudit = {
      ...updateData,
      UPDATE_DATE: new Date().toISOString()
    }
    
    return await this.update(userId, updateWithAudit)
  }

  /**
   * Delete user by ID
   * @param {number} userId - The user ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteUser(userId) {
    if (!userId) {
      throw new Error('User ID is required for deletion')
    }
    
    return await this.delete(userId)
  }

  /**
   * Get user with patient access
   * @param {number} userId - The user ID to get
   * @returns {Promise<Object|null>} - User with patient access or null
   */
  async getUserWithPatientAccess(userId) {
    try {
      // Get the user
      const user = await this.findById(userId)
      if (!user) {
        return null
      }
      
      // Get patient access
      const accessSql = `
        SELECT upl.*, pd.PATIENT_CD, pd.NAME_CHAR as PATIENT_NAME
        FROM USER_PATIENT_LOOKUP upl
        JOIN PATIENT_DIMENSION pd ON upl.PATIENT_NUM = pd.PATIENT_NUM
        WHERE upl.USER_ID = ?
      `
      const accessResult = await this.connection.executeQuery(accessSql, [userId])
      const patientAccess = accessResult.success ? accessResult.data : []
      
      return {
        ...user,
        patientAccess
      }
    } catch (error) {
      console.error('Error getting user with patient access:', error)
      return null
    }
  }

  /**
   * Authenticate user by user code and password
   * @param {string} userCode - The user code
   * @param {string} password - The password
   * @returns {Promise<Object|null>} - User object if authenticated, null otherwise
   */
  async authenticateUser(userCode, password) {
    try {
      const user = await this.findByUserCode(userCode)
      if (!user) {
        return null
      }
      
      // Simple password comparison (in production, use proper hashing)
      if (user.PASSWORD_CHAR === password) {
        return user
      }
      
      return null
    } catch (error) {
      console.error('Error authenticating user:', error)
      return null
    }
  }
}

export default UserRepository
