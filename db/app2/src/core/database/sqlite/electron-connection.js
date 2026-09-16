/**
 * Electron SQLite Connection
 * Uses Electron's exposed database APIs for SQLite operations
 */

import { createLogger } from '../../services/logging-service.js'
import { createStatementGate, runInTransaction, isTransactionControl } from './statement-gate.js'
import { withBusyRetry, describeDbFailure, dbErrorBus, classifyDbError } from './db-errors.js'

export default class ElectronConnection {
  constructor() {
    this.isConnected = false
    this.databasePath = null
    this.logger = createLogger('ElectronConnection')
    // One shared node-sqlite3 connection per app instance: the gate keeps a
    // transaction's statements together (statement-gate.js), the retry
    // absorbs SQLITE_BUSY from other app instances writing the same file.
    this._gate = createStatementGate({ onLongHold: (ms) => this.logger.warn('Statement gate held for a long time', { ms }) })
    this._inTransaction = false
  }

  // Retry only outside transactions — inside, the owner must retry the unit.
  _busyRetry(fn, sql) {
    return withBusyRetry(fn, {
      shouldRetry: () => !this._inTransaction,
      onRetry: (attempt, error) => {
        this.logger.warn('Database busy — retrying statement', { attempt, sql: String(sql).slice(0, 80), error: error?.message })
        dbErrorBus.emit({ ...describeDbFailure(error, sql, 'retry'), attempt })
      },
    })
  }

  _report(error, sql, phase) {
    const failure = describeDbFailure(error, sql, phase)
    dbErrorBus.emit(failure)
    return failure
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

      // dbman.connect now applies durability PRAGMAs (journal/sync/foreign_keys)
      // before resolving, so we don't need to re-issue them from the renderer.
      const success = await window.electron.dbman.connect(databasePath)

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
    this._assertReady()
    const release = await this._gate.acquire()
    try {
      return await this._rawQuery(sql, params)
    } finally {
      release()
    }
  }

  _assertReady() {
    if (!this.isConnected) {
      throw new Error('Database not connected')
    }
    if (!window.electron || !window.electron.dbman) {
      throw new Error('Electron database APIs not available')
    }
  }

  async _rawQuery(sql, params = []) {
    try {
      this.logger.debug('Executing query', { sql, params })
      const results = await this._busyRetry(() => window.electron.dbman.query(sql, params), sql)
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
      const failure = this._report(error, sql, 'query')
      return {
        success: false,
        data: [],
        rowCount: 0,
        error: error.message,
        errorKind: failure.kind,
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
    this._assertReady()
    if (isTransactionControl(sql)) {
      // Raw BEGIN/COMMIT/ROLLBACK outside withTransaction() would interleave
      // with other callers' statements — every transaction must go through
      // withTransaction (or transaction(commands)).
      this.logger.warn('Raw transaction control outside withTransaction()', { sql })
      if (import.meta.env.DEV) throw new Error(`Use withTransaction() instead of raw "${String(sql).trim()}"`)
    }
    const release = await this._gate.acquire()
    try {
      return await this._rawRun(sql, params)
    } finally {
      release()
    }
  }

  async _rawRun(sql, params = []) {
    try {
      this.logger.debug('Executing command', { sql, params })
      const result = await this._busyRetry(() => window.electron.dbman.run(sql, params), sql)
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
        changes: typeof rawResult.changes === 'number' ? rawResult.changes : 1, // Default to 1 if undefined
      }
    } catch (error) {
      this.logger.error('ExecuteCommand failed', error, { sql, params })
      const failure = this._report(error, sql, 'command')
      return {
        success: false,
        lastID: null,
        changes: 0,
        error: error.message,
        errorKind: failure.kind,
      }
    }
  }

  /**
   * Run `fn(tx)` in BEGIN IMMEDIATE … COMMIT while holding the statement gate.
   * `tx` exposes executeQuery/executeCommand (same result shapes as this
   * connection) on the raw path — hand it to the repositories.
   * Rolls back and rethrows on any error.
   */
  async withTransaction(fn) {
    this._assertReady()
    const wrapQuery = async (sql, params = []) => {
      try {
        const rows = await this._rawQuery(sql, params)
        return { success: true, data: rows || [], rowCount: rows ? rows.length : 0 }
      } catch (error) {
        return { success: false, data: [], rowCount: 0, error: error.message, errorKind: classifyDbError(error).kind }
      }
    }
    const wrapCommand = async (sql, params = []) => {
      try {
        const raw = await this._rawRun(sql, params)
        return { success: true, lastID: raw.lastID, changes: typeof raw.changes === 'number' ? raw.changes : 1 }
      } catch (error) {
        return { success: false, lastID: null, changes: 0, error: error.message, errorKind: classifyDbError(error).kind }
      }
    }
    const tx = { executeQuery: wrapQuery, executeCommand: wrapCommand, isTransaction: true }
    try {
      return await runInTransaction(
        this._gate,
        {
          run: (sql) => this._rawRun(sql),
          tx,
          onBegin: () => {
            this._inTransaction = true
          },
          onEnd: () => {
            this._inTransaction = false
          },
        },
        fn,
      )
    } catch (error) {
      this._report(error, 'TRANSACTION', 'transaction')
      throw error
    }
  }

  /**
   * Execute multiple commands in a transaction
   * @param {Array} commands - Array of {sql, params} objects
   * @returns {Promise<Array>} - Array of raw {lastID, changes} results
   */
  async transaction(commands) {
    return this.withTransaction(async (tx) => {
      const results = []
      for (const command of commands) {
        const result = await tx.executeCommand(command.sql, command.params || [])
        if (!result.success) throw new Error(result.error || 'Transaction statement failed')
        results.push({ lastID: result.lastID, changes: result.changes })
      }
      return results
    })
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
