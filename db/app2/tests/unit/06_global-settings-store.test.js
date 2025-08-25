/**
 * @file Global Settings Store Tests
 * @description Tests for the global settings store functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useDatabaseStore } from 'src/stores/database-store'

// Mock the database store
vi.mock('src/stores/database-store')
vi.mock('src/core/services/logging-service', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  })),
}))

describe('Global Settings Store', () => {
  let globalSettingsStore
  let mockDbStore

  beforeEach(() => {
    setActivePinia(createPinia())

    // Create mock database store
    mockDbStore = {
      executeQuery: vi.fn(),
      executeCommand: vi.fn(),
    }

    vi.mocked(useDatabaseStore).mockReturnValue(mockDbStore)

    globalSettingsStore = useGlobalSettingsStore()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Column Types Loading', () => {
    it('should load column types successfully', async () => {
      // Mock successful database response
      mockDbStore.executeQuery.mockResolvedValue({
        success: true,
        data: [
          { COLUMN_CD: 'CATEGORY_CHAR', count: 18 },
          { COLUMN_CD: 'VALTYPE_CD', count: 6 },
          { COLUMN_CD: 'SOURCESYSTEM_CD', count: 5 },
        ],
      })

      const result = await globalSettingsStore.loadColumnTypes()

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({
        label: 'Concept Categories (18)',
        value: 'CATEGORY_CHAR',
        count: 18,
      })
      expect(result[1]).toEqual({
        label: 'Value Types (6)',
        value: 'VALTYPE_CD',
        count: 6,
      })
      expect(result[2]).toEqual({
        label: 'Source Systems (5)',
        value: 'SOURCESYSTEM_CD',
        count: 5,
      })

      expect(mockDbStore.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT DISTINCT COLUMN_CD, COUNT(*) as count'))
    })

    it('should handle database errors gracefully', async () => {
      mockDbStore.executeQuery.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      })

      await expect(globalSettingsStore.loadColumnTypes()).rejects.toThrow('Database connection failed')
    })

    it('should use cache when available', async () => {
      // First call
      mockDbStore.executeQuery.mockResolvedValue({
        success: true,
        data: [{ COLUMN_CD: 'CATEGORY_CHAR', count: 18 }],
      })

      await globalSettingsStore.loadColumnTypes()

      // Second call should use cache
      const result = await globalSettingsStore.loadColumnTypes()

      expect(mockDbStore.executeQuery).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
    })
  })

  describe('Lookup Values Loading', () => {
    it('should load lookup values for a specific column', async () => {
      mockDbStore.executeQuery.mockResolvedValue({
        success: true,
        data: [
          { CODE_CD: 'CAT_GENERAL', NAME_CHAR: 'General', LOOKUP_BLOB: null },
          { CODE_CD: 'CAT_VITAL_SIGNS', NAME_CHAR: 'Vital Signs', LOOKUP_BLOB: null },
        ],
      })

      const result = await globalSettingsStore.loadLookupValues('CATEGORY_CHAR')

      expect(result).toHaveLength(2)
      expect(result[0].CODE_CD).toBe('CAT_GENERAL')
      expect(result[0].NAME_CHAR).toBe('General')

      expect(mockDbStore.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM CODE_LOOKUP'), ['CATEGORY_CHAR'])
    })

    it('should return empty array for invalid column', async () => {
      const result = await globalSettingsStore.loadLookupValues('')
      expect(result).toEqual([])
    })
  })

  describe('CRUD Operations', () => {
    it('should add new lookup value', async () => {
      mockDbStore.executeCommand.mockResolvedValue({ success: true })

      const result = await globalSettingsStore.addLookupValue('CATEGORY_CHAR', 'CAT_TEST', 'Test Category', 'Test description')

      expect(result).toBe(true)
      expect(mockDbStore.executeCommand).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO CODE_LOOKUP'), ['CATEGORY_CHAR', 'CAT_TEST', 'Test Category', 'Test description'])
    })

    it('should update existing lookup value', async () => {
      mockDbStore.executeCommand.mockResolvedValue({ success: true })

      const result = await globalSettingsStore.updateLookupValue('CAT_TEST', 'Updated Test Category', 'Updated description')

      expect(result).toBe(true)
      expect(mockDbStore.executeCommand).toHaveBeenCalledWith(expect.stringContaining('UPDATE CODE_LOOKUP'), ['Updated Test Category', 'Updated description', 'CAT_TEST'])
    })

    it('should delete lookup value', async () => {
      mockDbStore.executeCommand.mockResolvedValue({ success: true })

      const result = await globalSettingsStore.deleteLookupValue('CAT_TEST')

      expect(result).toBe(true)
      expect(mockDbStore.executeCommand).toHaveBeenCalledWith('DELETE FROM CODE_LOOKUP WHERE CODE_CD = ?', ['CAT_TEST'])
    })
  })

  describe('Utility Functions', () => {
    it('should identify system values correctly', () => {
      const systemValue = { SOURCESYSTEM_CD: 'SYSTEM' }
      const userValue = { SOURCESYSTEM_CD: 'USER' }

      expect(globalSettingsStore.isSystemValue(systemValue)).toBe(true)
      expect(globalSettingsStore.isSystemValue(userValue)).toBe(false)
    })

    it('should generate correct column labels', () => {
      // Test with loaded column types
      globalSettingsStore.columnTypes = [{ label: 'Concept Categories (18)', value: 'CATEGORY_CHAR' }]

      expect(globalSettingsStore.getColumnLabel('CATEGORY_CHAR')).toBe('Concept Categories (18)')
      expect(globalSettingsStore.getColumnLabel('UNKNOWN_COLUMN')).toBe('UNKNOWN COLUMN')
    })

    it('should clear cache properly', () => {
      globalSettingsStore.lookupData = { CATEGORY_CHAR: [{ CODE_CD: 'TEST' }] }
      globalSettingsStore.columnTypes = [{ value: 'CATEGORY_CHAR' }]

      globalSettingsStore.clearCache()

      expect(globalSettingsStore.lookupData).toEqual({})
      expect(globalSettingsStore.columnTypes).toEqual([])
      expect(globalSettingsStore.lastRefresh).toBe(null)
    })
  })

  describe('Convenience Methods', () => {
    it('should provide convenience methods for common operations', async () => {
      mockDbStore.executeQuery.mockResolvedValue({
        success: true,
        data: [{ CODE_CD: 'CAT_GENERAL', NAME_CHAR: 'General' }],
      })

      // Test getCategories
      const categories = await globalSettingsStore.getCategories()
      expect(categories).toHaveLength(1)
      expect(mockDbStore.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM CODE_LOOKUP'), ['CATEGORY_CHAR'])

      // Test getValueTypes
      await globalSettingsStore.getValueTypes()
      expect(mockDbStore.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM CODE_LOOKUP'), ['VALTYPE_CD'])

      // Test getSourceSystems
      await globalSettingsStore.getSourceSystems()
      expect(mockDbStore.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM CODE_LOOKUP'), ['SOURCESYSTEM_CD'])
    })
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockDbStore.executeQuery.mockResolvedValue({
        success: true,
        data: [{ COLUMN_CD: 'CATEGORY_CHAR', count: 18 }],
      })

      await globalSettingsStore.initialize()

      expect(mockDbStore.executeQuery).toHaveBeenCalled()
      expect(globalSettingsStore.columnTypes).toHaveLength(1)
    })

    it('should handle initialization errors gracefully', async () => {
      mockDbStore.executeQuery.mockRejectedValue(new Error('Database error'))

      // Should not throw error
      await expect(globalSettingsStore.initialize()).resolves.toBeUndefined()
    })
  })
})
