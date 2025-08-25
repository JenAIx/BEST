/**
 * Unit Tests for Migration Manager
 * Tests database migration functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'

// Mock SQLite Connection for Migration Manager
class MockMigrationConnection {
  constructor() {
    this.queries = []
    this.commands = []
    this.executedMigrations = []
  }

  async executeQuery(sql, params = []) {
    this.queries.push({ sql, params })
    
    if (sql.includes('SELECT name FROM migrations')) {
      return {
        success: true,
        data: this.executedMigrations.map(name => ({ name })),
        rowCount: this.executedMigrations.length
      }
    }
    
    if (sql.includes('SELECT checksum FROM migrations WHERE name = ?')) {
      const migrationName = params[0]
      const migration = this.executedMigrations.find(m => m === migrationName)
      return {
        success: true,
        data: migration ? [{ checksum: '12345' }] : [],
        rowCount: migration ? 1 : 0
      }
    }
    
    if (sql.includes('SELECT name FROM sqlite_master')) {
      return {
        success: true,
        data: [
          { name: 'PATIENT_DIMENSION' },
          { name: 'VISIT_DIMENSION' },
          { name: 'migrations' }
        ],
        rowCount: 3
      }
    }
    
    return {
      success: true,
      data: [],
      rowCount: 0
    }
  }

  async executeCommand(sql, params = []) {
    this.commands.push({ sql, params })
    
    if (sql.includes('INSERT INTO migrations')) {
      const migrationName = params[0]
      this.executedMigrations.push(migrationName)
    }
    
    if (sql.includes('DELETE FROM migrations')) {
      this.executedMigrations = []
    }
    
    if (sql.includes('DROP TABLE')) {
      // Simulate table drop
    }
    
    return {
      success: true,
      lastId: Math.floor(Math.random() * 1000) + 1,
      changes: 1,
      message: 'Command executed successfully'
    }
  }

  getLastQuery() {
    return this.queries[this.queries.length - 1]
  }

  getLastCommand() {
    return this.commands[this.commands.length - 1]
  }

  reset() {
    this.queries = []
    this.commands = []
    this.executedMigrations = []
  }
}

describe('MigrationManager', () => {
  let migrationManager
  let mockConnection

  beforeEach(() => {
    mockConnection = new MockMigrationConnection()
    migrationManager = new MigrationManager(mockConnection)
  })

  afterEach(() => {
    mockConnection.reset()
  })

  describe('Constructor', () => {
    it('should initialize with connection and empty migrations', () => {
      expect(migrationManager.connection).toBe(mockConnection)
      expect(migrationManager.migrations).toEqual([])
    })
  })

  describe('registerMigration', () => {
    it('should register a migration', () => {
      const migration = {
        name: '001-test-migration',
        description: 'Test migration',
        sql: 'CREATE TABLE test (id INTEGER PRIMARY KEY);'
      }
      
      migrationManager.registerMigration(migration)
      
      expect(migrationManager.migrations).toHaveLength(1)
      expect(migrationManager.migrations[0]).toBe(migration)
    })

    it('should register multiple migrations', () => {
      const migration1 = { name: '001-first', sql: 'CREATE TABLE first;' }
      const migration2 = { name: '002-second', sql: 'CREATE TABLE second;' }
      
      migrationManager.registerMigration(migration1)
      migrationManager.registerMigration(migration2)
      
      expect(migrationManager.migrations).toHaveLength(2)
      expect(migrationManager.migrations[0]).toBe(migration1)
      expect(migrationManager.migrations[1]).toBe(migration2)
    })
  })

  describe('createMigrationsTable', () => {
    it('should create migrations table', async () => {
      await migrationManager.createMigrationsTable()
      
      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toContain('CREATE TABLE IF NOT EXISTS migrations')
      expect(lastCommand.sql).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT')
      expect(lastCommand.sql).toContain('name TEXT NOT NULL UNIQUE')
      expect(lastCommand.sql).toContain('executed_at DATETIME DEFAULT CURRENT_TIMESTAMP')
      expect(lastCommand.sql).toContain('checksum TEXT')
      expect(lastCommand.sql).toContain('description TEXT')
    })
  })

  describe('getExecutedMigrations', () => {
    it('should return empty array when no migrations executed', async () => {
      const result = await migrationManager.getExecutedMigrations()
      
      expect(result).toEqual([])
      
      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT name FROM migrations ORDER BY id')
    })

    it('should return executed migration names', async () => {
      mockConnection.executedMigrations = ['001-first', '002-second']
      
      const result = await migrationManager.getExecutedMigrations()
      
      expect(result).toEqual(['001-first', '002-second'])
    })
  })

  describe('calculateChecksum', () => {
    it('should calculate consistent checksum for same SQL', () => {
      const sql = 'CREATE TABLE test (id INTEGER PRIMARY KEY);'
      
      const checksum1 = migrationManager.calculateChecksum(sql)
      const checksum2 = migrationManager.calculateChecksum(sql)
      
      expect(checksum1).toBe(checksum2)
      expect(typeof checksum1).toBe('string')
    })

    it('should calculate different checksums for different SQL', () => {
      const sql1 = 'CREATE TABLE test1 (id INTEGER PRIMARY KEY);'
      const sql2 = 'CREATE TABLE test2 (id INTEGER PRIMARY KEY);'
      
      const checksum1 = migrationManager.calculateChecksum(sql1)
      const checksum2 = migrationManager.calculateChecksum(sql2)
      
      expect(checksum1).not.toBe(checksum2)
    })

    it('should handle empty SQL', () => {
      const checksum = migrationManager.calculateChecksum('')
      
      expect(checksum).toBe('0')
    })
  })

  describe('markMigrationAsExecuted', () => {
    it('should mark migration as executed', async () => {
      const migration = {
        name: '001-test',
        description: 'Test migration',
        sql: 'CREATE TABLE test;'
      }
      
      await migrationManager.markMigrationAsExecuted(migration)
      
      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toContain('INSERT OR IGNORE INTO migrations (name, checksum, description)')
      expect(lastCommand.params[0]).toBe('001-test')
      expect(lastCommand.params[1]).toBe(migrationManager.calculateChecksum(migration.sql))
      expect(lastCommand.params[2]).toBe('Test migration')
    })

    it('should handle migration without description', async () => {
      const migration = {
        name: '001-test',
        sql: 'CREATE TABLE test;'
      }
      
      await migrationManager.markMigrationAsExecuted(migration)
      
      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.params[2]).toBe('')
    })
  })

  describe('executeMigration', () => {
    it('should execute migration successfully', async () => {
      const migration = {
        name: '001-test',
        description: 'Test migration',
        sql: 'CREATE TABLE test (id INTEGER PRIMARY KEY);'
      }
      
      const infoSpy = vi.spyOn(migrationManager.logger, 'info').mockImplementation(() => {})
      const successSpy = vi.spyOn(migrationManager.logger, 'success').mockImplementation(() => {})
      
      await migrationManager.executeMigration(migration)
      
      expect(mockConnection.commands).toHaveLength(2) // SQL + mark as executed
      expect(mockConnection.commands[0].sql).toBe(migration.sql)
      expect(infoSpy).toHaveBeenCalledWith(null, 'Executing migration: 001-test')
      expect(successSpy).toHaveBeenCalledWith(null, 'Migration completed: 001-test')
      
      infoSpy.mockRestore()
      successSpy.mockRestore()
    })

    it('should handle migration without SQL', async () => {
      const migration = {
        name: '001-test',
        description: 'Test migration'
        // No SQL property
      }
      
      await migrationManager.executeMigration(migration)
      
      // Should only mark as executed, no SQL execution
      expect(mockConnection.commands).toHaveLength(1)
      expect(mockConnection.commands[0].sql).toContain('INSERT OR IGNORE INTO migrations')
    })

    it('should handle migration execution errors', async () => {
      const migration = {
        name: '001-test',
        sql: 'INVALID SQL;'
      }
      
      mockConnection.executeCommand = vi.fn()
        .mockRejectedValueOnce(new Error('SQL syntax error'))
      
      const errorSpy = vi.spyOn(migrationManager.logger, 'error').mockImplementation(() => {})
      
      await expect(migrationManager.executeMigration(migration)).rejects.toThrow('Migration 001-test failed: SQL syntax error')
      
      expect(errorSpy).toHaveBeenCalledWith(null, 'Migration failed: 001-test', expect.any(Error))
      
      errorSpy.mockRestore()
    })
  })

  describe('runPendingMigrations', () => {
    it('should run no migrations when none are pending', async () => {
      const debugSpy = vi.spyOn(migrationManager.logger, 'debug').mockImplementation(() => {})
      
      await migrationManager.runPendingMigrations()
      
      expect(debugSpy).toHaveBeenCalledWith(null, 'No pending migrations')
      expect(mockConnection.commands).toHaveLength(0)
      
      debugSpy.mockRestore()
    })

    it('should run pending migrations', async () => {
      const migration1 = { name: '001-first', sql: 'CREATE TABLE first;' }
      const migration2 = { name: '002-second', sql: 'CREATE TABLE second;' }
      
      migrationManager.registerMigration(migration1)
      migrationManager.registerMigration(migration2)
      
      const infoSpy = vi.spyOn(migrationManager.logger, 'info').mockImplementation(() => {})
      
      await migrationManager.runPendingMigrations()
      
      expect(infoSpy).toHaveBeenCalledWith(null, 'Running 2 pending migrations')
      expect(mockConnection.commands).toHaveLength(4) // 2 SQL + 2 mark as executed
      
      infoSpy.mockRestore()
    })

    it('should skip already executed migrations', async () => {
      const migration1 = { name: '001-first', sql: 'CREATE TABLE first;' }
      const migration2 = { name: '002-second', sql: 'CREATE TABLE second;' }
      
      migrationManager.registerMigration(migration1)
      migrationManager.registerMigration(migration2)
      
      // Mock that first migration is already executed
      mockConnection.executedMigrations = ['001-first']
      
      const infoSpy = vi.spyOn(migrationManager.logger, 'info').mockImplementation(() => {})
      
      await migrationManager.runPendingMigrations()
      
      expect(infoSpy).toHaveBeenCalledWith(null, 'Running 1 pending migrations')
      expect(mockConnection.commands).toHaveLength(2) // Only second migration
      
      infoSpy.mockRestore()
    })
  })

  describe('initializeDatabase', () => {
    it('should initialize database successfully', async () => {
      const migration = { name: '001-test', sql: 'CREATE TABLE test;' }
      migrationManager.registerMigration(migration)
      
      const infoSpy = vi.spyOn(migrationManager.logger, 'info').mockImplementation(() => {})
      const successSpy = vi.spyOn(migrationManager.logger, 'success').mockImplementation(() => {})
      
      const result = await migrationManager.initializeDatabase()
      
      expect(result).toBe(true)
      expect(infoSpy).toHaveBeenCalledWith(null, 'Initializing database')
      expect(successSpy).toHaveBeenCalledWith(null, 'Database initialization completed successfully')
      
      infoSpy.mockRestore()
      successSpy.mockRestore()
    })

    it('should handle initialization errors', async () => {
      mockConnection.executeCommand = vi.fn().mockRejectedValue(new Error('Database error'))
      
      const errorSpy = vi.spyOn(migrationManager.logger, 'error').mockImplementation(() => {})
      
      await expect(migrationManager.initializeDatabase()).rejects.toThrow('Database error')
      
      expect(errorSpy).toHaveBeenCalledWith(null, 'Database initialization failed', expect.any(Error))
      
      errorSpy.mockRestore()
    })
  })

  describe('getMigrationStatus', () => {
    it('should return migration status', async () => {
      const migration1 = { name: '001-first', sql: 'CREATE TABLE first;' }
      const migration2 = { name: '002-second', sql: 'CREATE TABLE second;' }
      const migration3 = { name: '003-third', sql: 'CREATE TABLE third;' }
      
      migrationManager.registerMigration(migration1)
      migrationManager.registerMigration(migration2)
      migrationManager.registerMigration(migration3)
      
      mockConnection.executedMigrations = ['001-first', '002-second']
      
      const status = await migrationManager.getMigrationStatus()
      
      expect(status).toEqual({
        total: 3,
        executed: 2,
        pending: 1,
        executedMigrations: ['001-first', '002-second'],
        pendingMigrations: ['003-third']
      })
    })
  })

  describe('resetDatabase', () => {
    it('should reset database successfully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      await migrationManager.resetDatabase()
      
      expect(consoleSpy).toHaveBeenCalledWith('Resetting database...')
      expect(consoleSpy).toHaveBeenCalledWith('Database reset completed successfully')
      
      // Should drop tables and clear migrations
      const commands = mockConnection.commands
      expect(commands.some(cmd => cmd.sql.includes('DROP TABLE'))).toBe(true)
      expect(commands.some(cmd => cmd.sql.includes('DELETE FROM migrations'))).toBe(true)
      
      consoleSpy.mockRestore()
    })

    it('should handle reset errors', async () => {
      mockConnection.executeQuery = vi.fn().mockRejectedValue(new Error('Query failed'))
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await expect(migrationManager.resetDatabase()).rejects.toThrow('Query failed')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Database reset failed:', expect.any(Error))
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('validateMigrations', () => {
    it('should validate migrations successfully', async () => {
      const migration = { name: '001-test', sql: 'CREATE TABLE test;' }
      migrationManager.registerMigration(migration)
      mockConnection.executedMigrations = ['001-test']
      
      // Mock checksum query to return matching checksum
      const expectedChecksum = migrationManager.calculateChecksum(migration.sql)
      mockConnection.executeQuery = vi.fn()
        .mockResolvedValueOnce({ success: true, data: ['001-test'].map(name => ({ name })) })
        .mockResolvedValueOnce({ success: true, data: [{ checksum: expectedChecksum }] })
      
      const result = await migrationManager.validateMigrations()
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect checksum mismatches', async () => {
      const migration = { name: '001-test', sql: 'CREATE TABLE test;' }
      migrationManager.registerMigration(migration)
      mockConnection.executedMigrations = ['001-test']
      
      // Mock checksum query to return different checksum
      mockConnection.executeQuery = vi.fn()
        .mockResolvedValueOnce({ success: true, data: ['001-test'].map(name => ({ name })) })
        .mockResolvedValueOnce({ success: true, data: [{ checksum: 'different-checksum' }] })
      
      const result = await migrationManager.validateMigrations()
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({
        migration: '001-test',
        error: 'Checksum mismatch - migration may have been modified'
      })
    })

    it('should handle validation errors', async () => {
      mockConnection.executeQuery = vi.fn().mockRejectedValue(new Error('Database error'))
      
      const result = await migrationManager.validateMigrations()
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({
        migration: 'validation_process',
        error: 'Database error'
      })
    })
  })
})
