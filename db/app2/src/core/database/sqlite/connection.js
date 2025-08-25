/**
 * SQLite Connection Manager for Electron Environment
 * Handles database connections, queries, and transactions
 */

class SQLiteConnection {
  constructor() {
    this.database = null
    this.isConnected = false
    this.filePath = null
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
      
      // In Electron environment, we'll use the preload script
      // For now, we'll create a mock connection for development
      this.database = {
        all: (sql, params, callback) => {
          // Mock implementation - will be replaced by actual SQLite
          console.log('Mock SQLite query:', sql, params)
          callback(null, [])
        },
        run: (sql, params, callback) => {
          // Mock implementation - will be replaced by actual SQLite
          console.log('Mock SQLite command:', sql, params)
          // Create a mock context object with the expected properties
          const mockContext = {
            lastID: Math.floor(Math.random() * 1000) + 1,
            changes: 1
          }
          callback(null, mockContext)
        },
        close: (callback) => {
          callback(null)
        }
      }
      
      this.isConnected = true
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
          console.error('Query execution failed:', err)
          console.error('SQL:', sql)
          console.error('Params:', params)
          reject(err)
        } else {
          resolve({ 
            success: true, 
            data: rows || [],
            rowCount: rows ? rows.length : 0
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

    return new Promise((resolve, reject) => {
      // Create a mock context object with the expected properties
      const mockContext = {
        lastID: Math.floor(Math.random() * 1000) + 1,
        changes: 1
      }
      
      this.database.run(sql, params, (err) => {
        if (err) {
          console.error('Command execution failed:', err)
          console.error('SQL:', sql)
          console.error('Params:', params)
          reject(err)
        } else {
          resolve({ 
            success: true, 
            lastId: mockContext.lastID,
            changes: mockContext.changes,
            message: 'Command executed successfully'
          })
        }
      })
    })
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
        message: 'Transaction completed successfully'
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
    try {
      const result = await this.executeQuery('SELECT 1 as test')
      return result.success && result.data.length > 0
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }
}

export default SQLiteConnection
