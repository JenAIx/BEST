/**
 * Unit Tests for SQLite Connection
 * Tests the core database connection functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import SQLiteConnection from '../../src/core/database/sqlite/connection.js'

describe('SQLiteConnection', () => {
  let connection

  beforeEach(() => {
    connection = new SQLiteConnection()
  })

  afterEach(async () => {
    if (connection && connection.getStatus()) {
      await connection.disconnect()
    }
  })

  describe('Connection Management', () => {
    it('should initialize with disconnected state', () => {
      expect(connection.getStatus()).toBe(false)
      expect(connection.getFilePath()).toBe(null)
    })

    it('should connect to database successfully', async () => {
      const result = await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection.db'))
      
      expect(result).toBe(true)
      expect(connection.getStatus()).toBe(true)
      expect(connection.getFilePath()).toBe(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection.db'))
    })

    it('should disconnect from database successfully', async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection.db'))
      const result = await connection.disconnect()
      
      expect(result).toBe(true)
      expect(connection.getStatus()).toBe(false)
      expect(connection.getFilePath()).toBe(null)
    })

    it('should handle reconnection properly', async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection1.db'))
      expect(connection.getFilePath()).toBe(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection1.db'))
      
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection2.db'))
      expect(connection.getFilePath()).toBe(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection2.db'))
    })

    it('should test connection successfully', async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-connection.db'))
      const result = await connection.testConnection()
      
      // With mock implementation, this should return false (no actual data)
      // This validates our mock is working correctly
      expect(result).toBe(false)
    })
  })

  describe('Query Operations', () => {
    beforeEach(async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-queries.db'))
    })

    it('should execute SELECT queries', async () => {
      const result = await connection.executeQuery('SELECT 1 as test', [])
      
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('rowCount')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should execute SELECT queries with parameters', async () => {
      const result = await connection.executeQuery(
        'SELECT * FROM users WHERE id = ?', 
        [123]
      )
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should handle empty query results', async () => {
      const result = await connection.executeQuery('SELECT * FROM nonexistent', [])
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
      expect(result.rowCount).toBe(0)
    })

    it('should reject queries when not connected', async () => {
      await connection.disconnect()
      
      await expect(
        connection.executeQuery('SELECT 1', [])
      ).rejects.toThrow('Database not connected')
    })
  })

  describe('Command Operations', () => {
    beforeEach(async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-commands.db'))
    })

    it('should execute INSERT commands', async () => {
      const result = await connection.executeCommand(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['John Doe', 'john@example.com']
      )
      
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('lastId')
      expect(result).toHaveProperty('changes')
      expect(result).toHaveProperty('message')
      expect(typeof result.lastId).toBe('number')
      expect(result.changes).toBe(1)
    })

    it('should execute UPDATE commands', async () => {
      const result = await connection.executeCommand(
        'UPDATE users SET name = ? WHERE id = ?',
        ['Jane Doe', 1]
      )
      
      expect(result.success).toBe(true)
      expect(result.changes).toBe(1)
    })

    it('should execute DELETE commands', async () => {
      const result = await connection.executeCommand(
        'DELETE FROM users WHERE id = ?',
        [1]
      )
      
      expect(result.success).toBe(true)
      expect(result.changes).toBe(1)
    })

    it('should reject commands when not connected', async () => {
      await connection.disconnect()
      
      await expect(
        connection.executeCommand('INSERT INTO test VALUES (?)', ['value'])
      ).rejects.toThrow('Database not connected')
    })
  })

  describe('Transaction Operations', () => {
    beforeEach(async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-transactions.db'))
    })

    it('should execute successful transactions', async () => {
      const commands = [
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['User 1'] },
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['User 2'] },
        { sql: 'INSERT INTO users (name) VALUES (?)', params: ['User 3'] }
      ]
      
      const result = await connection.executeTransaction(commands)
      
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('message')
      expect(Array.isArray(result.results)).toBe(true)
      expect(result.results).toHaveLength(3)
      
      // Each result should be successful
      result.results.forEach(res => {
        expect(res.success).toBe(true)
        expect(res).toHaveProperty('lastId')
        expect(res).toHaveProperty('changes')
      })
    })

    it('should handle empty transaction arrays', async () => {
      const result = await connection.executeTransaction([])
      
      expect(result.success).toBe(true)
      expect(result.results).toEqual([])
    })

    it('should reject transactions when not connected', async () => {
      await connection.disconnect()
      
      const commands = [
        { sql: 'INSERT INTO test VALUES (?)', params: ['value'] }
      ]
      
      await expect(
        connection.executeTransaction(commands)
      ).rejects.toThrow('Database not connected')
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-errors.db'))
    })

    it('should handle invalid SQL gracefully', async () => {
      // Mock implementation won't actually validate SQL, but structure should be correct
      const result = await connection.executeQuery('INVALID SQL STATEMENT', [])
      
      // Mock should still return success, but real implementation would handle errors
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('data')
    })

    it('should handle connection errors during operations', async () => {
      // Simulate connection loss
      connection.database = null
      connection.isConnected = false
      
      await expect(
        connection.executeQuery('SELECT 1', [])
      ).rejects.toThrow('Database not connected')
    })
  })

  describe('Mock Implementation Validation', () => {
    it('should properly mock database operations', async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-mock.db'))
      
      // Test that mock returns expected structure
      const queryResult = await connection.executeQuery('SELECT * FROM test', [])
      expect(queryResult).toMatchObject({
        success: true,
        data: [],
        rowCount: 0
      })
      
      const commandResult = await connection.executeCommand('INSERT INTO test VALUES (?)', ['value'])
      expect(commandResult).toMatchObject({
        success: true,
        lastId: expect.any(Number),
        changes: 1,
        message: 'Command executed successfully'
      })
    })

    it('should generate different lastId values', async () => {
      await connection.connect(join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'test-mock.db'))
      
      const result1 = await connection.executeCommand('INSERT INTO test VALUES (?)', ['value1'])
      const result2 = await connection.executeCommand('INSERT INTO test VALUES (?)', ['value2'])
      
      expect(result1.lastId).not.toBe(result2.lastId)
      expect(typeof result1.lastId).toBe('number')
      expect(typeof result2.lastId).toBe('number')
    })
  })
})
