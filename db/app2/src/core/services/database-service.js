/**
 * Database Service
 * Main entry point for database operations
 * Manages connections, migrations, and repository access
 */

import SQLiteConnection from '../database/sqlite/connection.js'
import ElectronConnection from '../database/sqlite/electron-connection.js'
import MigrationManager from '../database/migrations/migration-manager.js'
import SeedManager from '../database/seeds/seed-manager.js'
import { createLogger } from './logging-service.js'
import PatientRepository from '../database/repositories/patient-repository.js'
import UserRepository from '../database/repositories/user-repository.js'
import ConceptRepository from '../database/repositories/concept-repository.js'
import CqlRepository from '../database/repositories/cql-repository.js'
import VisitRepository from '../database/repositories/visit-repository.js'
import ObservationRepository from '../database/repositories/observation-repository.js'
import { initialSchema } from '../database/migrations/001-initial-schema.js'
import { currentSchema } from '../database/migrations/002-current-schema.js'
import { addNoteFactColumns } from '../database/migrations/003-add-note-fact-columns.js'
// import { addCascadeTriggers } from '../database/migrations/004-add-cascade-triggers.js'
import { createPatientListView } from '../database/migrations/005-create-patient-list-view.js'
import { createPatientObservationsView } from '../database/migrations/006-create-patient-observations-view.js'
import { patientUpdateTriggers } from '../database/migrations/007-patient-update-triggers.js'

class DatabaseService {
  constructor() {
    this.connection = null
    this.migrationManager = null
    this.repositories = {}
    this.isInitialized = false
    this.logger = createLogger('DatabaseService')
  }

  /**
   * Initialize the database service
   * @param {string} databasePath - Path to the SQLite database file
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(databasePath) {
    try {
      this.logger.info(null, 'Initializing Database Service')

      // Create and establish database connection
      // Use ElectronConnection if running in Electron, otherwise use browser-compatible connection
      if (window.electron) {
        this.logger.info(null, 'Using Electron database connection')
        this.connection = new ElectronConnection()
      } else {
        this.logger.info(null, 'Using browser database connection (limited functionality)')
        this.connection = new SQLiteConnection()
      }

      await this.connection.connect(databasePath)

      // Test connection
      const connectionTest = await this.connection.testConnection()
      if (!connectionTest) {
        throw new Error('Database connection test failed')
      }

      // Initialize migration manager
      this.migrationManager = new MigrationManager(this.connection)

      // Register migrations
      this.migrationManager.registerMigration(initialSchema)
      this.migrationManager.registerMigration(currentSchema)
      this.migrationManager.registerMigration(addNoteFactColumns)
      // TODO: Re-enable cascade triggers once SQL parsing issues are resolved
      // this.migrationManager.registerMigration(addCascadeTriggers)
      this.migrationManager.registerMigration(createPatientListView)
      this.migrationManager.registerMigration(createPatientObservationsView)
      this.migrationManager.registerMigration(patientUpdateTriggers)

      // Run migrations to create/update schema
      await this.migrationManager.initializeDatabase()

      // Initialize seed data if database is empty
      await this.initializeSeedDataIfNeeded()

      // Initialize repositories
      await this.initializeRepositories()

      this.isInitialized = true
      this.logger.success(null, 'Database Service initialized successfully')
      return true
    } catch (error) {
      this.logger.error(null, 'Failed to initialize Database Service', error)
      this.isInitialized = false
      throw error
    }
  }

  /**
   * Initialize seed data if the database is empty
   * @returns {Promise<void>}
   */
  async initializeSeedDataIfNeeded() {
    if (!this.connection) {
      throw new Error('Database connection not established')
    }

    try {
      // Check if users already exist
      const userCountResult = await this.connection.executeQuery('SELECT COUNT(*) as count FROM USER_MANAGEMENT')
      const userCount = userCountResult.success ? userCountResult.data[0].count : 0

      if (userCount === 0) {
        this.logger.info(null, 'Database is empty, initializing seed data')
        const seedManager = new SeedManager(this.connection)
        const seedResults = await seedManager.initializeSeedData()

        this.logger.success(null, `Seed data initialized: ${seedResults.users} users, ${seedResults.concepts} concepts`)
      } else {
        this.logger.info(null, `Database already has ${userCount} users, skipping seed initialization`)
      }
    } catch (error) {
      this.logger.error(null, 'Failed to initialize seed data', error)
      // Don't throw error to avoid breaking app startup - seed data is optional
    }
  }

  /**
   * Initialize all repositories
   * @returns {Promise<void>}
   */
  async initializeRepositories() {
    if (!this.connection) {
      throw new Error('Database connection not established')
    }

    // Initialize repositories
    this.repositories.patient = new PatientRepository(this.connection)
    this.repositories.user = new UserRepository(this.connection)
    this.repositories.concept = new ConceptRepository(this.connection)
    this.repositories.cql = new CqlRepository(this.connection)
    this.repositories.visit = new VisitRepository(this.connection)
    this.repositories.observation = new ObservationRepository(this.connection)

    // TODO: Add other repositories as they are implemented
    // this.repositories.provider = new ProviderRepository(this.connection)

    this.logger.info(null, 'Repositories initialized')
  }

  /**
   * Get a repository by name
   * @param {string} repositoryName - Name of the repository
   * @returns {Object|null} - Repository instance or null
   */
  getRepository(repositoryName) {
    if (!this.isInitialized) {
      throw new Error('Database Service not initialized')
    }

    return this.repositories[repositoryName] || null
  }

  /**
   * Get patient repository
   * @returns {PatientRepository} - Patient repository instance
   */
  getPatientRepository() {
    return this.getRepository('patient')
  }

  /**
   * Check if database service is initialized
   * @returns {boolean} - Initialization status
   */
  isServiceInitialized() {
    return this.isInitialized
  }

  /**
   * Get database connection status
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connection ? this.connection.getStatus() : false
  }

  /**
   * Get database file path
   * @returns {string|null} - Database file path
   */
  getDatabasePath() {
    return this.connection ? this.connection.getFilePath() : null
  }

  /**
   * Get migration status
   * @returns {Promise<Object>} - Migration status information
   */
  async getMigrationStatus() {
    if (!this.migrationManager) {
      throw new Error('Migration manager not initialized')
    }

    return await this.migrationManager.getMigrationStatus()
  }

  /**
   * Validate database integrity
   * @returns {Promise<Object>} - Validation results
   */
  async validateDatabase() {
    if (!this.migrationManager) {
      throw new Error('Migration manager not initialized')
    }

    return await this.migrationManager.validateMigrations()
  }

  /**
   * Reset database (drop all tables and re-run migrations)
   * @returns {Promise<void>}
   */
  async resetDatabase() {
    if (!this.migrationManager) {
      throw new Error('Migration manager not initialized')
    }

    await this.migrationManager.resetDatabase()
  }

  /**
   * Execute a raw SQL query
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async executeQuery(sql, params = []) {
    if (!this.connection) {
      throw new Error('Database connection not established')
    }

    return await this.connection.executeQuery(sql, params)
  }

  /**
   * Execute a raw SQL command
   * @param {string} sql - SQL command string
   * @param {Array} params - Command parameters
   * @returns {Promise<Object>} - Command result
   */
  async executeCommand(sql, params = []) {
    if (!this.connection) {
      throw new Error('Database connection not established')
    }

    return await this.connection.executeCommand(sql, params)
  }

  /**
   * Execute multiple commands in a transaction
   * @param {Array} commands - Array of {sql, params} objects
   * @returns {Promise<Object>} - Transaction result
   */
  async executeTransaction(commands) {
    if (!this.connection) {
      throw new Error('Database connection not established')
    }

    // Use the correct method name based on connection type
    if (typeof this.connection.transaction === 'function') {
      return await this.connection.transaction(commands)
    } else if (typeof this.connection.executeTransaction === 'function') {
      return await this.connection.executeTransaction(commands)
    } else {
      throw new Error('Transaction method not available on connection')
    }
  }

  /**
   * Close database connection
   * @returns {Promise<boolean>} - Success status
   */
  async close() {
    try {
      if (this.connection) {
        // Use the correct method name based on connection type
        if (typeof this.connection.disconnect === 'function') {
          await this.connection.disconnect()
        } else if (typeof this.connection.close === 'function') {
          await this.connection.close()
        }
        this.connection = null
      }

      this.isInitialized = false
      this.repositories = {}
      this.logger.info(null, 'Database Service closed')
      return true
    } catch (error) {
      this.logger.error(null, 'Error closing Database Service', error)
      throw error
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} - Database statistics
   */
  async getDatabaseStatistics() {
    if (!this.connection) {
      throw new Error('Database connection not established')
    }

    const stats = {}

    try {
      // Get table row counts
      const tables = ['PATIENT_DIMENSION', 'VISIT_DIMENSION', 'OBSERVATION_FACT', 'CONCEPT_DIMENSION', 'PROVIDER_DIMENSION', 'CODE_LOOKUP', 'USER_MANAGEMENT', 'CQL_FACT']

      for (const table of tables) {
        const result = await this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${table}`)
        stats[table] = result.success ? result.data[0].count : 0
      }

      // Get database file size
      stats.databasePath = this.getDatabasePath()
      stats.isConnected = this.isConnected()
      stats.isInitialized = this.isInitialized
    } catch (error) {
      console.error('Error getting database statistics:', error)
      stats.error = error.message
    }

    return stats
  }
}

// Create singleton instance
const databaseService = new DatabaseService()

export default databaseService
