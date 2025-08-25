/**
 * Real SQLite Connection Implementation
 * Uses the sqlite3 module for actual database operations
 */

import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { createLogger } from '../../services/logging-service.js'

class RealSQLiteConnection {
  constructor() {
    this.database = null
    this.isConnected = false
    this.filePath = null
    this.logger = createLogger('RealSQLiteConnection')
  }

  /**
   * Connect to a SQLite database file
   * @param {string} filePath - Path to the SQLite database file
   * @returns {Promise<boolean>} - Success status
   */
  async connect(filePath) {
    try {
      if (this.isConnected) {
        await this.disconnect()
      }

      this.filePath = filePath

      // Ensure the directory exists
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Create or connect to the database
      this.database = new sqlite3.Database(filePath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message)
          throw err
        }
      })

      // Wait a bit for database to be ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Set connection status first
      this.isConnected = true

      // Enable foreign keys
      await this.executeCommand('PRAGMA foreign_keys = ON')

      console.log(`Connected to database: ${filePath}`)
      return true
    } catch (error) {
      console.error('Failed to connect to database:', error)
      this.isConnected = false
      throw error
    }
  }

  /**
   * Disconnect from the database
   * @returns {Promise<boolean>} - Success status
   */
  async disconnect() {
    try {
      if (this.database && this.isConnected) {
        await new Promise((resolve, reject) => {
          this.database.close((err) => {
            if (err) reject(err)
            else resolve()
          })
        })

        this.database = null
        this.isConnected = false
        this.filePath = null
        console.log('Disconnected from database')
        return true
      }
      return true
    } catch (error) {
      console.error('Error disconnecting from database:', error)
      throw error
    }
  }

  /**
   * Execute a SELECT query
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async executeQuery(sql, params = []) {
    if (!this.isConnected || !this.database) {
      throw new Error('Database not connected')
    }

    return new Promise((resolve, reject) => {
      this.database.all(sql, params, (err, rows) => {
        if (err) {
          this.logger.error('Query execution failed', err, { sql, params })
          reject(err)
        } else {
          resolve({
            success: true,
            data: rows || [],
            rowCount: rows ? rows.length : 0,
          })
        }
      })
    })
  }

  /**
   * Execute an INSERT, UPDATE, or DELETE command
   * @param {string} sql - SQL command string
   * @param {Array} params - Command parameters
   * @returns {Promise<Object>} - Command result
   */
  async executeCommand(sql, params = []) {
    if (!this.isConnected || !this.database) {
      throw new Error('Database not connected')
    }

    // Check connection health before executing
    try {
      await this.testConnection()
    } catch {
      console.warn('Connection health check failed, attempting to reconnect...')
      if (this.filePath) {
        await this.connect(this.filePath)
      } else {
        throw new Error('Database connection lost and no file path available for reconnection')
      }
    }

    // Split SQL into individual statements if it contains multiple statements
    const statements = sql.split(';').filter((stmt) => stmt.trim().length > 0)

    if (statements.length === 1) {
      // Single statement - execute normally
      return new Promise((resolve, reject) => {
        this.database.run(sql, params, function (err) {
          if (err) {
            console.error('Command execution failed:', err)
            console.error('SQL:', sql)
            console.error('Params:', params)
            reject(err)
          } else {
            resolve({
              success: true,
              lastId: this.lastID,
              changes: this.changes,
              message: 'Command executed successfully',
            })
          }
        })
      })
    } else {
      // Multiple statements - execute each one separately
      try {
        let lastResult = null
        for (const statement of statements) {
          const trimmedStatement = statement.trim()
          if (trimmedStatement.length > 0) {
            lastResult = await new Promise((resolve, reject) => {
              this.database.run(trimmedStatement, [], function (err) {
                if (err) {
                  console.error('Statement execution failed:', err)
                  console.error('SQL:', trimmedStatement)
                  reject(err)
                } else {
                  resolve({
                    success: true,
                    lastId: this.lastID,
                    changes: this.changes,
                    message: 'Statement executed successfully',
                  })
                }
              })
            })
          }
        }
        return lastResult || { success: true, message: 'All statements executed successfully' }
      } catch (error) {
        console.error('Multi-statement execution failed:', error)
        throw error
      }
    }
  }

  /**
   * Execute multiple commands in a transaction
   * @param {Array} commands - Array of {sql, params} objects
   * @returns {Promise<Object>} - Transaction result
   */
  async executeTransaction(commands) {
    if (!this.isConnected || !this.database) {
      throw new Error('Database not connected')
    }

    try {
      // Start transaction
      await this.executeCommand('BEGIN TRANSACTION')

      const results = []
      for (const command of commands) {
        const result = await this.executeCommand(command.sql, command.params)
        results.push(result)
      }

      // Commit transaction
      await this.executeCommand('COMMIT')

      return {
        success: true,
        results,
        message: 'Transaction completed successfully',
      }
    } catch (error) {
      // Rollback on error
      await this.executeCommand('ROLLBACK')
      throw error
    }
  }

  /**
   * Check if database is connected
   * @returns {boolean} - Connection status
   */
  getStatus() {
    return this.isConnected
  }

  /**
   * Get database file path
   * @returns {string|null} - Database file path
   */
  getFilePath() {
    return this.filePath
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} - Connection test result
   */
  async testConnection() {
    if (!this.isConnected || !this.database) {
      return false
    }

    try {
      // Use direct database method to avoid recursion
      return new Promise((resolve) => {
        this.database.get('SELECT 1 as test', [], (err) => {
          if (err) {
            console.error('Connection test failed:', err)
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  /**
   * Get database file size
   * @returns {Promise<number>} - File size in bytes
   */
  async getDatabaseSize() {
    try {
      if (this.filePath && fs.existsSync(this.filePath)) {
        const stats = fs.statSync(this.filePath)
        return stats.size
      }
      return 0
    } catch (error) {
      console.error('Error getting database size:', error)
      return 0
    }
  }

  /**
   * Check if database file exists
   * @returns {boolean} - File existence
   */
  databaseExists() {
    return this.filePath ? fs.existsSync(this.filePath) : false
  }

  /**
   * Delete database file (use with caution!)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteDatabase() {
    try {
      if (this.isConnected) {
        await this.disconnect()
      }

      if (this.filePath && fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath)
        console.log(`Database file deleted: ${this.filePath}`)
        return true
      }
      return false
    } catch (error) {
      console.error('Error deleting database:', error)
      throw error
    }
  }
}

export default RealSQLiteConnection
