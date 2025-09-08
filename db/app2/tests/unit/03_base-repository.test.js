/**
 * Unit Tests for Base Repository
 * Tests the repository pattern implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import BaseRepository from '../../src/core/database/repositories/base-repository.js'

// Mock SQLite Connection
class MockConnection {
  constructor() {
    this.queries = []
    this.commands = []
  }

  async executeQuery(sql, params = []) {
    this.queries.push({ sql, params })

    // Mock different responses based on SQL
    if (sql.includes('SELECT * FROM test_table WHERE id = ?')) {
      return {
        success: true,
        data: params[0] === 1 ? [{ id: 1, name: 'Test Item', value: 'test' }] : [],
        rowCount: params[0] === 1 ? 1 : 0,
      }
    }

    if (sql.includes('SELECT * FROM test_table')) {
      return {
        success: true,
        data: [
          { id: 1, name: 'Item 1', value: 'value1' },
          { id: 2, name: 'Item 2', value: 'value2' },
        ],
        rowCount: 2,
      }
    }

    if (sql.includes('SELECT COUNT(*) as count')) {
      return {
        success: true,
        data: [{ count: 5 }],
        rowCount: 1,
      }
    }

    return {
      success: true,
      data: [],
      rowCount: 0,
    }
  }

  async executeCommand(sql, params = []) {
    this.commands.push({ sql, params })

    return {
      success: true,
      lastID: Math.floor(Math.random() * 1000) + 1,
      changes: 1,
      message: 'Command executed successfully',
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
  }
}

describe('BaseRepository', () => {
  let repository
  let mockConnection

  beforeEach(() => {
    mockConnection = new MockConnection()
    repository = new BaseRepository(mockConnection, 'test_table')
  })

  afterEach(() => {
    mockConnection.reset()
  })

  describe('Constructor', () => {
    it('should initialize with connection and table name', () => {
      expect(repository.connection).toBe(mockConnection)
      expect(repository.tableName).toBe('test_table')
    })
  })

  describe('findById', () => {
    it('should find entity by ID', async () => {
      const result = await repository.findById(1)

      expect(result).toEqual({ id: 1, name: 'Test Item', value: 'test' })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table WHERE id = ?')
      expect(lastQuery.params).toEqual([1])
    })

    it('should return null when entity not found', async () => {
      const result = await repository.findById(999)

      expect(result).toBe(null)
    })

    it('should handle string IDs', async () => {
      await repository.findById('abc123')

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.params).toEqual(['abc123'])
    })
  })

  describe('findAll', () => {
    it('should find all entities without options', async () => {
      const result = await repository.findAll()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 1, name: 'Item 1', value: 'value1' })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table')
      expect(lastQuery.params).toEqual([])
    })

    it('should apply ORDER BY when specified', async () => {
      await repository.findAll({ orderBy: 'name' })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table ORDER BY name')
    })

    it('should apply ORDER BY with direction', async () => {
      await repository.findAll({ orderBy: 'name', orderDirection: 'DESC' })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table ORDER BY name DESC')
    })

    it('should apply LIMIT when specified', async () => {
      await repository.findAll({ limit: 10 })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table LIMIT ?')
      expect(lastQuery.params).toEqual([10])
    })

    it('should apply LIMIT with OFFSET', async () => {
      await repository.findAll({ limit: 10, offset: 20 })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table LIMIT ? OFFSET ?')
      expect(lastQuery.params).toEqual([10, 20])
    })

    it('should combine ORDER BY and LIMIT', async () => {
      await repository.findAll({
        orderBy: 'created_at',
        orderDirection: 'DESC',
        limit: 5,
        offset: 10,
      })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table ORDER BY created_at DESC LIMIT ? OFFSET ?')
      expect(lastQuery.params).toEqual([5, 10])
    })
  })

  describe('findByCriteria', () => {
    it('should build WHERE clause for simple criteria', async () => {
      await repository.findByCriteria({ name: 'John', status: 'active' })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table WHERE 1=1 AND name = ? AND status = ?')
      expect(lastQuery.params).toEqual(['John', 'active'])
    })

    it('should handle array values with IN clause', async () => {
      await repository.findByCriteria({ status: ['active', 'pending', 'completed'] })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table WHERE 1=1 AND status IN (?, ?, ?)')
      expect(lastQuery.params).toEqual(['active', 'pending', 'completed'])
    })

    it('should handle custom operators', async () => {
      await repository.findByCriteria({
        age: { operator: '>', value: 18 },
        name: { operator: 'LIKE', value: 'John%' },
      })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table WHERE 1=1 AND age > ? AND name LIKE ?')
      expect(lastQuery.params).toEqual([18, 'John%'])
    })

    it('should skip undefined, null, and empty values', async () => {
      await repository.findByCriteria({
        name: 'John',
        status: undefined,
        email: null,
        phone: '',
      })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table WHERE 1=1 AND name = ?')
      expect(lastQuery.params).toEqual(['John'])
    })

    it('should apply options with criteria', async () => {
      await repository.findByCriteria({ status: 'active' }, { orderBy: 'created_at', limit: 10 })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM test_table WHERE 1=1 AND status = ? ORDER BY created_at LIMIT ?')
      expect(lastQuery.params).toEqual(['active', 10])
    })
  })

  describe('countByCriteria', () => {
    it('should count all records when no criteria', async () => {
      const result = await repository.countByCriteria()

      expect(result).toBe(5)

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT COUNT(*) as count FROM test_table WHERE 1=1')
      expect(lastQuery.params).toEqual([])
    })

    it('should count with criteria', async () => {
      const result = await repository.countByCriteria({ status: 'active' })

      expect(result).toBe(5)

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT COUNT(*) as count FROM test_table WHERE 1=1 AND status = ?')
      expect(lastQuery.params).toEqual(['active'])
    })

    it('should handle array criteria in count', async () => {
      await repository.countByCriteria({ status: ['active', 'pending'] })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT COUNT(*) as count FROM test_table WHERE 1=1 AND status IN (?, ?)')
      expect(lastQuery.params).toEqual(['active', 'pending'])
    })
  })

  describe('create', () => {
    it('should create entity with all fields', async () => {
      const entity = { name: 'New Item', value: 'new_value', status: 'active' }
      const result = await repository.create(entity)

      expect(result).toMatchObject(entity)
      expect(result).toHaveProperty('id')
      expect(typeof result.id).toBe('number')

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('INSERT INTO test_table (name, value, status) VALUES (?, ?, ?)')
      expect(lastCommand.params).toEqual(['New Item', 'new_value', 'active'])
    })

    it('should filter out undefined values', async () => {
      const entity = { name: 'New Item', value: undefined, status: 'active' }
      await repository.create(entity)

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('INSERT INTO test_table (name, status) VALUES (?, ?)')
      expect(lastCommand.params).toEqual(['New Item', 'active'])
    })

    it('should throw error when no fields to insert', async () => {
      await expect(repository.create({})).rejects.toThrow('Failed to create entity')
    })

    it('should throw error when all fields are undefined', async () => {
      await expect(
        repository.create({
          name: undefined,
          value: undefined,
        }),
      ).rejects.toThrow('Failed to create entity')
    })
  })

  describe('update', () => {
    it('should update entity with specified fields', async () => {
      const updateData = { name: 'Updated Item', status: 'inactive' }
      const result = await repository.update(1, updateData)

      expect(result).toBe(true)

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('UPDATE test_table SET name = ?, status = ? WHERE id = ?')
      expect(lastCommand.params).toEqual(['Updated Item', 'inactive', 1])
    })

    it('should filter out undefined values and id field', async () => {
      const updateData = { id: 999, name: 'Updated Item', value: undefined, status: 'active' }
      await repository.update(1, updateData)

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('UPDATE test_table SET name = ?, status = ? WHERE id = ?')
      expect(lastCommand.params).toEqual(['Updated Item', 'active', 1])
    })

    it('should throw error when no fields to update', async () => {
      await expect(repository.update(1, {})).rejects.toThrow('No fields to update')
    })

    it('should throw error when only undefined fields', async () => {
      await expect(
        repository.update(1, {
          name: undefined,
          value: undefined,
        }),
      ).rejects.toThrow('No fields to update')
    })

    it('should handle string IDs', async () => {
      await repository.update('abc123', { name: 'Updated' })

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.params).toEqual(['Updated', 'abc123'])
    })
  })

  describe('delete', () => {
    it('should delete entity by ID', async () => {
      const result = await repository.delete(1)

      expect(result).toBe(true)

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('DELETE FROM test_table WHERE id = ?')
      expect(lastCommand.params).toEqual([1])
    })

    it('should handle string IDs', async () => {
      await repository.delete('abc123')

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.params).toEqual(['abc123'])
    })
  })

  describe('deleteByCriteria', () => {
    it('should delete entities matching criteria', async () => {
      const result = await repository.deleteByCriteria({ status: 'inactive' })

      expect(result).toBe(1) // Mock returns changes: 1

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('DELETE FROM test_table WHERE 1=1 AND status = ?')
      expect(lastCommand.params).toEqual(['inactive'])
    })

    it('should handle multiple criteria', async () => {
      await repository.deleteByCriteria({ status: 'inactive', type: 'temporary' })

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('DELETE FROM test_table WHERE 1=1 AND status = ? AND type = ?')
      expect(lastCommand.params).toEqual(['inactive', 'temporary'])
    })

    it('should skip undefined, null, and empty values', async () => {
      await repository.deleteByCriteria({
        status: 'inactive',
        type: undefined,
        category: null,
        name: '',
      })

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('DELETE FROM test_table WHERE 1=1 AND status = ?')
      expect(lastCommand.params).toEqual(['inactive'])
    })
  })

  describe('exists', () => {
    it('should return true when entities exist', async () => {
      const result = await repository.exists({ status: 'active' })

      expect(result).toBe(true)

      // Should use countByCriteria internally
      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toContain('SELECT COUNT(*)')
    })

    it('should return false when no entities exist', async () => {
      // Mock connection to return 0 count
      mockConnection.executeQuery = vi.fn().mockResolvedValue({
        success: true,
        data: [{ count: 0 }],
        rowCount: 1,
      })

      const result = await repository.exists({ status: 'nonexistent' })

      expect(result).toBe(false)
    })
  })

  describe('Raw SQL Operations', () => {
    it('should execute raw queries', async () => {
      const result = await repository.executeRawQuery('SELECT custom FROM table', ['param'])

      expect(result).toHaveProperty('success', true)

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT custom FROM table')
      expect(lastQuery.params).toEqual(['param'])
    })

    it('should execute raw commands', async () => {
      const result = await repository.executeRawCommand('UPDATE custom SET field = ?', ['value'])

      expect(result).toHaveProperty('success', true)

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toBe('UPDATE custom SET field = ?')
      expect(lastCommand.params).toEqual(['value'])
    })
  })
})
