/**
 * Database Migration Manager
 * Handles database schema creation and updates
 * Ensures database structure is always up to date
 */

import { createLogger } from '../../services/logging-service.js'

class MigrationManager {
  constructor(connection) {
    this.connection = connection
    this.migrations = []
    this.logger = createLogger('MigrationManager')
  }

  /**
   * Register a migration
   * @param {Object} migration - Migration object with name and sql properties
   */
  registerMigration(migration) {
    this.migrations.push(migration)
  }

  /**
   * Initialize database with all migrations
   * @returns {Promise<boolean>} - Success status
   */
  async initializeDatabase() {
    try {
      this.logger.info(null, 'Initializing database')

      // Create migrations table if it doesn't exist
      await this.createMigrationsTable()

      // Run all pending migrations
      await this.runPendingMigrations()

      this.logger.success(null, 'Database initialization completed successfully')
      return true
    } catch (error) {
      this.logger.error(null, 'Database initialization failed', error)
      throw error
    }
  }

  /**
   * Initialize database with migrations and seed data
   * @param {Object} seedManager - Optional seed manager instance
   * @returns {Promise<boolean>} - Success status
   */
  async initializeDatabaseWithSeeds(seedManager = null) {
    try {
      console.log('Initializing database with seed data...')

      // Initialize database structure first
      const result = await this.initializeDatabase()

      // Wait a moment to ensure all tables are created
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Initialize seed data if seed manager is provided
      if (seedManager) {
        await seedManager.initializeSeedData()
      }

      console.log('Database initialization with seeds completed successfully')
      return result
    } catch (error) {
      console.error('Database initialization with seeds failed:', error)
      throw error
    }
  }

  /**
   * Create migrations tracking table
   * @returns {Promise<void>}
   */
  async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        description TEXT
      )
    `
    await this.connection.executeCommand(sql)
    this.logger.debug(null, 'Migrations table created/verified')
  }

  /**
   * Get list of executed migrations
   * @returns {Promise<Array>} - Array of migration names
   */
  async getExecutedMigrations() {
    const sql = 'SELECT name FROM migrations ORDER BY id'
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data.map((row) => row.name) : []
  }

  /**
   * Run all pending migrations
   * @returns {Promise<void>}
   */
  async runPendingMigrations() {
    const executedMigrations = await this.getExecutedMigrations()
    const pendingMigrations = this.migrations.filter(
      (migration) => !executedMigrations.includes(migration.name),
    )

    if (pendingMigrations.length === 0) {
      this.logger.debug(null, 'No pending migrations')
      return
    }

    this.logger.info(null, `Running ${pendingMigrations.length} pending migrations`)

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration)
    }
  }

  /**
   * Execute a single migration
   * @param {Object} migration - Migration object
   * @returns {Promise<void>}
   */
  async executeMigration(migration) {
    try {
      this.logger.info(null, `Executing migration: ${migration.name}`)

      // Check if migration has custom execute function
      if (typeof migration.execute === 'function') {
        await migration.execute(this.connection)
      } else if (migration.sql) {
        // Execute the migration SQL
        await this.connection.executeCommand(migration.sql)
      } else {
        this.logger.warn(
          null,
          `Migration ${migration.name} has no SQL or execute function, marking as executed`,
        )
      }

      // Mark migration as executed
      await this.markMigrationAsExecuted(migration)

      this.logger.success(null, `Migration completed: ${migration.name}`)
    } catch (error) {
      this.logger.error(null, `Migration failed: ${migration.name}`, error)
      throw new Error(`Migration ${migration.name} failed: ${error.message}`)
    }
  }

  /**
   * Mark migration as executed
   * @param {Object} migration - Migration object
   * @returns {Promise<void>}
   */
  async markMigrationAsExecuted(migration) {
    const sql = `
      INSERT OR IGNORE INTO migrations (name, checksum, description) 
      VALUES (?, ?, ?)
    `
    // Calculate checksum based on SQL or execute function
    const content =
      migration.sql || (migration.execute ? migration.execute.toString() : migration.name)
    const checksum = this.calculateChecksum(content)
    await this.connection.executeCommand(sql, [
      migration.name,
      checksum,
      migration.description || '',
    ])
  }

  /**
   * Calculate checksum for migration SQL
   * @param {string} sql - SQL string
   * @returns {string} - Checksum
   */
  calculateChecksum(sql) {
    // Simple hash function for SQL content
    let hash = 0
    if (sql.length === 0) return hash.toString()

    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return hash.toString()
  }

  /**
   * Get migration status
   * @returns {Promise<Object>} - Migration status information
   */
  async getMigrationStatus() {
    const executedMigrations = await this.getExecutedMigrations()
    const pendingMigrations = this.migrations.filter(
      (migration) => !executedMigrations.includes(migration.name),
    )

    return {
      total: this.migrations.length,
      executed: executedMigrations.length,
      pending: pendingMigrations.length,
      executedMigrations,
      pendingMigrations: pendingMigrations.map((m) => m.name),
    }
  }

  /**
   * Reset database (drop all tables and re-run migrations)
   * @returns {Promise<void>}
   */
  async resetDatabase() {
    try {
      console.log('Resetting database...')

      // Get all table names
      const tablesResult = await this.connection.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )

      if (tablesResult.success) {
        // Drop all tables
        for (const table of tablesResult.data) {
          if (table.name !== 'migrations') {
            await this.connection.executeCommand(`DROP TABLE IF EXISTS ${table.name}`)
            console.log(`Dropped table: ${table.name}`)
          }
        }
      }

      // Clear migrations table
      await this.connection.executeCommand('DELETE FROM migrations')

      // Re-run all migrations
      await this.runPendingMigrations()

      console.log('Database reset completed successfully')
    } catch (error) {
      console.error('Database reset failed:', error)
      throw error
    }
  }

  /**
   * Validate migration integrity
   * @returns {Promise<Object>} - Validation results
   */
  async validateMigrations() {
    const results = {
      valid: true,
      errors: [],
    }

    try {
      const executedMigrations = await this.getExecutedMigrations()

      for (const migration of this.migrations) {
        if (executedMigrations.includes(migration.name)) {
          // Check if migration checksum matches
          const sql = 'SELECT checksum FROM migrations WHERE name = ?'
          const result = await this.connection.executeQuery(sql, [migration.name])

          if (result.success && result.data.length > 0) {
            const storedChecksum = result.data[0].checksum
            const content =
              migration.sql || (migration.execute ? migration.execute.toString() : migration.name)
            const calculatedChecksum = this.calculateChecksum(content)

            if (storedChecksum !== calculatedChecksum) {
              results.valid = false
              results.errors.push({
                migration: migration.name,
                error: 'Checksum mismatch - migration may have been modified',
              })
            }
          }
        }
      }
    } catch (error) {
      results.valid = false
      results.errors.push({
        migration: 'validation_process',
        error: error.message,
      })
    }

    return results
  }
}

export default MigrationManager
