/**
 * Integration Tests for Refactored Concept Resolution Store
 *
 * Tests the refactored concept resolution store with shared utilities:
 * - Cache manager functionality
 * - Concept resolver integration
 * - Options loader integration
 * - Concept searcher integration
 * - Color mapper integration
 * - End-to-end concept resolution workflows
 * - Performance and caching behavior
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'
import { createCacheManager } from '../../src/shared/utils/cache-manager.js'
import { createConceptResolver } from '../../src/shared/utils/concept-resolver.js'
import { createOptionsLoader } from '../../src/shared/utils/options-loader.js'
import { createConceptSearcher } from '../../src/shared/utils/concept-searcher.js'
import { determineColor } from '../../src/shared/utils/color-mapper.js'
import { createLogger } from '../../src/core/services/logging-service.js'
import { currentSchema } from '../../src/core/database/migrations/002-current-schema.js'
import { addNoteFactColumns } from '../../src/core/database/migrations/003-add-note-fact-columns.js'
import path from 'path'
import fs from 'fs'

describe('Concept Resolution Store Integration Tests', () => {
  let connection
  let migrationManager
  let seedManager
  let cacheManager
  let conceptResolver
  let optionsLoader
  let conceptSearcher
  let logger
  let testDbPath

  // Mock database store interface for shared utilities
  let mockDbStore

  beforeAll(async () => {
    // Create test database
    testDbPath = path.join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'concept-resolution-test.db')

    // Ensure output directory exists
    const outputDir = path.dirname(testDbPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    // Initialize database connection
    connection = new RealSQLiteConnection()
    await connection.connect(testDbPath)

    // Initialize migration manager
    migrationManager = new MigrationManager(connection)
    migrationManager.registerMigration(currentSchema)
    migrationManager.registerMigration(addNoteFactColumns)

    // Initialize seed manager
    seedManager = new SeedManager(connection)

    // Initialize database with schema and seed data
    await migrationManager.initializeDatabaseWithSeeds(seedManager)

    // Create logger for testing
    logger = createLogger('ConceptResolutionTest')

    // Create mock database store interface
    mockDbStore = {
      executeQuery: async (query, params = []) => {
        return await connection.executeQuery(query, params)
      },
    }

    // Initialize shared utilities directly
    cacheManager = createCacheManager({
      storagePrefix: 'test_concept_resolution_',
      cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
      maxCacheSize: 1000,
      enablePersistence: false, // Disable localStorage in test environment
      logger: logger,
    })

    conceptResolver = createConceptResolver(mockDbStore, logger)
    optionsLoader = createOptionsLoader(mockDbStore, null, logger) // No global settings store for test
    conceptSearcher = createConceptSearcher(mockDbStore, logger)

    // Initialize cache manager
    await cacheManager.initialize()
  }, 60000) // 60 second timeout for database initialization

  afterAll(async () => {
    if (connection) {
      await connection.disconnect()
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  beforeEach(async () => {
    // Clear cache before each test but preserve initialization state
    Object.keys(cacheManager.cache).forEach((key) => delete cacheManager.cache[key])
    cacheManager.pendingOperations.clear()
  })

  describe('Shared Utilities Initialization', () => {
    it('should initialize with shared utilities', async () => {
      expect(cacheManager).toBeTruthy()
      expect(conceptResolver).toBeTruthy()
      expect(optionsLoader).toBeTruthy()
      expect(conceptSearcher).toBeTruthy()
      expect(cacheManager.isInitialized).toBe(true)
    })

    it('should provide cache statistics', async () => {
      const stats = cacheManager.getStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats).toHaveProperty('pendingCount')
      expect(typeof stats.size).toBe('number')
      expect(typeof stats.maxSize).toBe('number')
      expect(typeof stats.pendingCount).toBe('number')
    })
  })

  describe('Concept Resolution', () => {
    it('should resolve a single concept from database', async () => {
      // Test with a known concept code that should exist in seed data
      const conceptCode = 'SCTID: 248153007' // Male gender
      const resolved = await conceptResolver.resolveFromDatabase(conceptCode, { context: 'gender' })

      expect(resolved).toHaveProperty('code', conceptCode)
      expect(resolved).toHaveProperty('label')
      expect(resolved).toHaveProperty('color')
      expect(resolved).toHaveProperty('resolved')
      expect(resolved).toHaveProperty('source')
      expect(typeof resolved.label).toBe('string')
      expect(typeof resolved.color).toBe('string')
      expect(typeof resolved.resolved).toBe('boolean')
    })

    it('should use fallback for unknown concepts', async () => {
      const unknownCode = 'UNKNOWN_CONCEPT_123'
      const resolved = await conceptResolver.resolveFromDatabase(unknownCode)

      expect(resolved).toHaveProperty('code', unknownCode)
      expect(resolved).toHaveProperty('label')
      expect(resolved).toHaveProperty('color')
      expect(resolved.source).toBe('fallback')
      expect(resolved.resolved).toBe(false)
    })

    it('should cache resolved concepts using cache manager', async () => {
      const conceptCode = 'TEST_CONCEPT_456'

      // Use cache manager's getOrSet method
      const resolved1 = await cacheManager.getOrSet(conceptCode, async () => {
        return await conceptResolver.resolveFromDatabase(conceptCode)
      })

      // Check if cached
      const cached = cacheManager.get(conceptCode)
      expect(cached).toBeTruthy()
      expect(cached.code).toBe(conceptCode)

      // Second resolution should use cache
      const resolved2 = await cacheManager.getOrSet(conceptCode, async () => {
        return await conceptResolver.resolveFromDatabase(conceptCode)
      })
      expect(resolved2).toEqual(resolved1)
    })

    it('should resolve concepts in batch', async () => {
      const conceptCodes = ['M', 'F', 'A', 'I'] // Simple gender and status codes
      const results = await conceptResolver.resolveBatch(conceptCodes, { context: 'test' })

      expect(results).toBeInstanceOf(Map)
      expect(results.size).toBe(conceptCodes.length)

      for (const code of conceptCodes) {
        expect(results.has(code)).toBe(true)
        const resolved = results.get(code)
        expect(resolved).toHaveProperty('code', code)
        expect(resolved).toHaveProperty('label')
        expect(resolved).toHaveProperty('color')
      }
    })

    it('should handle empty batch resolution', async () => {
      const results = await conceptResolver.resolveBatch([])
      expect(results).toBeInstanceOf(Map)
      expect(results.size).toBe(0)
    })
  })

  describe('Color Determination', () => {
    it('should determine colors based on context', async () => {
      const testCases = [
        { text: 'Male', context: 'gender', expectedColor: 'blue' },
        { text: 'Female', context: 'gender', expectedColor: 'pink' },
        { text: 'Active', context: 'status', expectedColor: 'positive' },
        { text: 'Inactive', context: 'status', expectedColor: 'negative' },
        { text: 'Yes', context: 'selection_answer', expectedColor: 'positive' },
        { text: 'No', context: 'selection_answer', expectedColor: 'negative' },
      ]

      for (const testCase of testCases) {
        const color = determineColor(testCase.text, testCase.context)
        expect(color).toBe(testCase.expectedColor)
      }
    })

    it('should return grey for unknown text', async () => {
      const color = determineColor('', 'unknown_context')
      expect(color).toBe('grey')
    })
  })

  describe('Options Loading', () => {
    it('should load concept options by category', async () => {
      const genderOptions = await optionsLoader.getConceptOptions('gender')

      expect(Array.isArray(genderOptions)).toBe(true)

      for (const option of genderOptions) {
        expect(option).toHaveProperty('label')
        expect(option).toHaveProperty('value')
        expect(option).toHaveProperty('color')
        expect(typeof option.label).toBe('string')
        expect(typeof option.value).toBe('string')
        expect(typeof option.color).toBe('string')
      }
    })

    it('should return fallback options for unknown categories', async () => {
      const unknownOptions = await optionsLoader.getConceptOptions('unknown_category')
      expect(Array.isArray(unknownOptions)).toBe(true)
    })

    it('should load finding options for concepts', async () => {
      const conceptCode = 'SCTID: 404684003' // Clinical finding
      const findingOptions = await optionsLoader.getFindingOptions(conceptCode)

      expect(Array.isArray(findingOptions)).toBe(true)

      for (const option of findingOptions) {
        expect(option).toHaveProperty('label')
        expect(option).toHaveProperty('value')
        expect(typeof option.label).toBe('string')
        expect(typeof option.value).toBe('string')
      }
    })

    it('should load selection options for concepts', async () => {
      const conceptCode = 'TEST_SELECTION_CONCEPT'
      const selectionOptions = await optionsLoader.getSelectionOptions(conceptCode)

      expect(Array.isArray(selectionOptions)).toBe(true)

      for (const option of selectionOptions) {
        expect(option).toHaveProperty('label')
        expect(option).toHaveProperty('value')
        expect(typeof option.label).toBe('string')
        expect(typeof option.value).toBe('string')
      }
    })
  })

  describe('Concept Search', () => {
    it('should search concepts by name', async () => {
      const searchTerm = 'gender'
      const results = await conceptSearcher.searchConcepts(searchTerm, { limit: 10 })

      expect(Array.isArray(results)).toBe(true)

      for (const concept of results) {
        expect(concept).toHaveProperty('CONCEPT_CD')
        expect(concept).toHaveProperty('NAME_CHAR')
        expect(concept).toHaveProperty('VALTYPE_CD')
        expect(typeof concept.CONCEPT_CD).toBe('string')
        expect(typeof concept.NAME_CHAR).toBe('string')
      }
    })

    it('should return empty array for short search terms', async () => {
      const results = await conceptSearcher.searchConcepts('a') // Too short
      expect(results).toEqual([])
    })
  })

  describe('Cache Management', () => {
    it('should clear cache completely', async () => {
      // Add some concepts to cache
      await cacheManager.set('TEST_1', { code: 'TEST_1', label: 'Test 1' })
      await cacheManager.set('TEST_2', { code: 'TEST_2', label: 'Test 2' })

      let stats = cacheManager.getStats()
      expect(stats.size).toBeGreaterThan(0)

      // Clear cache
      await cacheManager.clear()

      stats = cacheManager.getStats()
      expect(stats.size).toBe(0)
    })

    it('should handle cache size limits', async () => {
      // Add concepts to cache
      for (let i = 0; i < 10; i++) {
        await cacheManager.set(`TEST_CONCEPT_${i}`, {
          code: `TEST_CONCEPT_${i}`,
          label: `Test Concept ${i}`,
        })
      }

      const stats = cacheManager.getStats()
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize)
    })
  })

  describe('Performance and Caching', () => {
    it('should be faster on second resolution (cache hit)', async () => {
      const conceptCode = 'PERFORMANCE_TEST'

      // Clear cache to ensure first call is a database hit
      delete cacheManager.cache[conceptCode]

      // First resolution (cache miss)
      const start1 = Date.now()
      const result1 = await cacheManager.getOrSet(conceptCode, async () => {
        return await conceptResolver.resolveFromDatabase(conceptCode)
      })
      const duration1 = Date.now() - start1

      // Second resolution (cache hit)
      const start2 = Date.now()
      const result2 = await cacheManager.getOrSet(conceptCode, async () => {
        return await conceptResolver.resolveFromDatabase(conceptCode)
      })
      const duration2 = Date.now() - start2

      // Verify both results are the same and cache hit occurred
      expect(result1).toEqual(result2)

      // Cache hit should be faster or equal (allowing for timing variations in fast operations)
      expect(duration2).toBeLessThanOrEqual(Math.max(duration1, 1))
    })

    it('should handle concurrent resolutions without duplicates', async () => {
      const conceptCode = 'CONCURRENT_TEST'

      // Start multiple concurrent resolutions
      const promises = Array(5)
        .fill()
        .map(() =>
          cacheManager.getOrSet(conceptCode, async () => {
            return await conceptResolver.resolveFromDatabase(conceptCode)
          }),
        )

      const results = await Promise.all(promises)

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0])
      }
    })
  })

  describe('Integration with Shared Utilities', () => {
    it('should provide data in format expected by UI components', async () => {
      // Test concept resolution format
      const resolved = await conceptResolver.resolveFromDatabase('M', { context: 'gender' })

      expect(resolved).toHaveProperty('code')
      expect(resolved).toHaveProperty('label')
      expect(resolved).toHaveProperty('color')
      expect(resolved).toHaveProperty('resolved')
      expect(resolved).toHaveProperty('source')

      // Test options format
      const options = await optionsLoader.getConceptOptions('gender')

      for (const option of options) {
        expect(option).toHaveProperty('label')
        expect(option).toHaveProperty('value')
        expect(option).toHaveProperty('color')
      }
    })

    it('should maintain utility API consistency', async () => {
      // Test all shared utilities exist and have expected methods
      expect(typeof cacheManager.get).toBe('function')
      expect(typeof cacheManager.set).toBe('function')
      expect(typeof cacheManager.getOrSet).toBe('function')
      expect(typeof cacheManager.clear).toBe('function')
      expect(typeof cacheManager.getStats).toBe('function')

      expect(typeof conceptResolver.resolveFromDatabase).toBe('function')
      expect(typeof conceptResolver.resolveBatch).toBe('function')
      expect(typeof conceptResolver.getFallbackLabel).toBe('function')

      expect(typeof optionsLoader.getConceptOptions).toBe('function')
      expect(typeof optionsLoader.getFindingOptions).toBe('function')
      expect(typeof optionsLoader.getSelectionOptions).toBe('function')

      expect(typeof conceptSearcher.searchConcepts).toBe('function')

      expect(typeof determineColor).toBe('function')
    })
  })
})
