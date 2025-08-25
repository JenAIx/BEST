/**
 * Electron SQLite Connection
 * Uses Electron's exposed database APIs for SQLite operations
 */

import { createLogger } from '../../services/logging-service.js'

export default class ElectronConnection {
  constructor() {
    this.isConnected = false
    this.databasePath = null
    this.logger = createLogger('ElectronConnection')
  }

  /**
   * Connect to SQLite database via Electron
   * @param {string} databasePath - Path to the database file
   * @returns {Promise<boolean>} - Success status
   */
  async connect(databasePath) {
    try {
      if (!window.electron) {
        throw new Error('Electron APIs not available - running in browser mode')
      }

      this.logger.info('Connecting to database via Electron', { databasePath })

      const success = window.electron.dbman.connect(databasePath)

      if (success) {
        this.isConnected = true
        this.databasePath = databasePath
        this.logger.success('Successfully connected to database', { databasePath })
        return true
      } else {
        throw new Error('Failed to connect to database')
      }
    } catch (error) {
      this.logger.error('Database connection failed', error, { databasePath })
      this.isConnected = false
      this.databasePath = null
      throw error
    }
  }

  /**
   * Close database connection
   * @returns {Promise<boolean>} - Success status
   */
  async close() {
    try {
      if (!this.isConnected) {
        return true
      }

      if (window.electron && window.electron.dbman) {
        window.electron.dbman.close()
      }

      this.isConnected = false
      this.databasePath = null
      this.logger.info('Database connection closed')
      return true
    } catch (error) {
      this.logger.error('Error closing database', error)
      throw error
    }
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} - Connection status
   */
  async testConnection() {
    try {
      if (!this.isConnected || !window.electron) {
        return false
      }

      // Test with a simple query
      const result = await this.query('SELECT 1 as test')
      return result && result.length > 0
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  /**
   * Execute a SELECT query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  async query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected')
    }

    if (!window.electron || !window.electron.dbman) {
      throw new Error('Electron database APIs not available')
    }

    try {
      this.logger.debug('Executing query', { sql, params })
      const results = await window.electron.dbman.query(sql, params)
      this.logger.debug('Query completed', { rowCount: results?.length || 0 })
      return results || []
    } catch (error) {
      this.logger.error('Query execution failed', error, { sql, params })
      throw error
    }
  }

  /**
   * Execute a SELECT query (alias for query method)
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query results in standard format
   */
  async executeQuery(sql, params = []) {
    try {
      const rawResults = await this.query(sql, params)
      return {
        success: true,
        data: rawResults || [],
        rowCount: rawResults ? rawResults.length : 0,
      }
    } catch (error) {
      this.logger.error('ExecuteQuery failed', error, { sql, params })
      return {
        success: false,
        data: [],
        rowCount: 0,
        error: error.message,
      }
    }
  }

  /**
   * Execute a command (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL command
   * @param {Array} params - Command parameters
   * @returns {Promise<Object>} - Command result with lastID and changes
   */
  async run(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected')
    }

    if (!window.electron || !window.electron.dbman) {
      throw new Error('Electron database APIs not available')
    }

    try {
      this.logger.debug('Executing command', { sql, params })
      const result = await window.electron.dbman.run(sql, params)
      this.logger.debug('Command completed', { lastID: result?.lastID, changes: result?.changes })
      return result || { lastID: null, changes: 0 }
    } catch (error) {
      this.logger.error('Command execution failed', error, { sql, params })
      throw error
    }
  }

  /**
   * Execute a command (alias for run method)
   * @param {string} sql - SQL command
   * @param {Array} params - Command parameters
   * @returns {Promise<Object>} - Command result with lastID and changes
   */
  async executeCommand(sql, params = []) {
    try {
      const rawResult = await this.run(sql, params)
      return {
        success: true,
        lastID: rawResult.lastID,
        changes: rawResult.changes,
      }
    } catch (error) {
      this.logger.error('ExecuteCommand failed', error, { sql, params })
      return {
        success: false,
        lastID: null,
        changes: 0,
        error: error.message,
      }
    }
  }

  /**
   * Execute multiple commands in a transaction
   * @param {Array} commands - Array of {sql, params} objects
   * @returns {Promise<Array>} - Array of results
   */
  async transaction(commands) {
    if (!this.isConnected) {
      throw new Error('Database not connected')
    }

    const results = []

    try {
      // Begin transaction
      await this.run('BEGIN TRANSACTION')

      // Execute all commands
      for (const command of commands) {
        const result = await this.run(command.sql, command.params || [])
        results.push(result)
      }

      // Commit transaction
      await this.run('COMMIT')

      return results
    } catch (error) {
      // Rollback on error
      try {
        await this.run('ROLLBACK')
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError)
      }

      console.error('Transaction failed:', error)
      throw error
    }
  }

  /**
   * Get database file path
   * @returns {string} - Database file path
   */
  getFilePath() {
    return this.databasePath
  }

  /**
   * Get connection status
   * @returns {boolean} - Connection status
   */
  getStatus() {
    return this.isConnected
  }

  /**
   * Get database file information
   * @returns {Object} - Database info
   */
  getDatabaseInfo() {
    return {
      isConnected: this.isConnected,
      databasePath: this.databasePath,
      isElectron: !!window.electron,
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to check
   * @returns {boolean} - File exists status
   */
  fileExists(filePath) {
    if (!window.electron || !window.electron.fs) {
      return false
    }

    try {
      return window.electron.fs.existsSync(filePath)
    } catch (error) {
      console.error('File existence check failed:', error)
      return false
    }
  }

  /**
   * Create a new database file
   * @param {string} databasePath - Path for new database
   * @returns {Promise<boolean>} - Success status
   */
  async createDatabase(databasePath) {
    try {
      if (!window.electron || !window.electron.dbman) {
        throw new Error('Electron APIs not available')
      }

      const success = window.electron.dbman.create(databasePath)

      if (success) {
        console.log('Database created successfully:', databasePath)
        return true
      } else {
        throw new Error('Failed to create database')
      }
    } catch (error) {
      console.error('Database creation error:', error)
      throw error
    }
  }
}
