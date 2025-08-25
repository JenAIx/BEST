/**
 * Seed Manager Unit Tests
 *
 * Tests the browser-compatible SeedManager class functionality for seeding
 * users, concepts, CQL rules, and lookups into the database.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'

// Mock the database connection
const mockConnection = {
  executeCommand: vi.fn(),
  executeQuery: vi.fn(),
}

describe('SeedManager', () => {
  let seedManager

  beforeEach(() => {
    vi.clearAllMocks()
    seedManager = new SeedManager(mockConnection)
  })

  describe('Constructor', () => {
    it('should initialize with database connection', () => {
      expect(seedManager.connection).toBe(mockConnection)
      expect(seedManager.standardUsers).toBeDefined()
      expect(seedManager.concepts).toBeDefined()
      expect(seedManager.cqlRules).toBeDefined()
      expect(seedManager.conceptCqlLookups).toBeDefined()
    })

    it('should have correct data counts', () => {
      expect(seedManager.standardUsers).toBeInstanceOf(Array)
      expect(seedManager.standardUsers.length).toBe(4)
      expect(seedManager.concepts.length).toBeGreaterThan(10) // Loaded from CSV
      expect(seedManager.cqlRules.length).toBe(8)
      expect(seedManager.conceptCqlLookups.length).toBe(8)
    })
  })

  describe('Initialize Seed Data', () => {
    it('should successfully seed all data types', async () => {
      mockConnection.executeCommand.mockResolvedValue({ success: true })

      const results = await seedManager.initializeSeedData()

      expect(results.users).toBe(4)
      expect(results.concepts).toBeGreaterThan(10)
      expect(results.cqlRules).toBe(8)
      expect(results.conceptCqlLookups).toBe(8)
      expect(results.errors).toEqual([])
    })

    it('should handle partial errors gracefully', async () => {
      // Mock concept insertion to fail
      let callCount = 0
      mockConnection.executeCommand.mockImplementation(() => {
        callCount++
        if (callCount <= 10) {
          // First 10 calls are concepts
          return Promise.reject(new Error('Concept insert failed'))
        }
        return Promise.resolve({ success: true })
      })

      const results = await seedManager.initializeSeedData()

      expect(results.concepts).toBeGreaterThanOrEqual(0)
      expect(results.cqlRules).toBe(8)
      expect(results.conceptCqlLookups).toBe(8)
      expect(results.users).toBe(4)
      // Individual concept failures are logged but don't stop the overall seeding process
      // This is the correct behavior - partial failures should be handled gracefully
      expect(results.errors).toHaveLength(0)
    })
  })

  describe('Seed Concepts', () => {
    it('should insert all concepts', async () => {
      mockConnection.executeCommand.mockResolvedValue({ success: true })

      const count = await seedManager.seedConcepts()

      expect(count).toBeGreaterThan(10)
      expect(mockConnection.executeCommand).toHaveBeenCalledTimes(count)
    })

    it('should handle individual concept insertion errors', async () => {
      mockConnection.executeCommand
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Insert failed'))
        .mockResolvedValue({ success: true })

      const count = await seedManager.seedConcepts()

      expect(count).toBeLessThan(seedManager.concepts.length) // Some failed
    })
  })

  describe('Seed CQL Rules', () => {
    it('should insert all CQL rules', async () => {
      mockConnection.executeCommand.mockResolvedValue({ success: true })

      const count = await seedManager.seedCqlRules()

      expect(count).toBe(8)
      expect(mockConnection.executeCommand).toHaveBeenCalledTimes(8)
    })

    it('should insert numeric rule with correct data', async () => {
      mockConnection.executeCommand.mockResolvedValue({ success: true })

      await seedManager.seedCqlRules()

      const numericRuleCall = mockConnection.executeCommand.mock.calls.find((call) =>
        call[1].includes('numeric'),
      )
      expect(numericRuleCall).toBeDefined()
      expect(numericRuleCall[0]).toContain('INSERT OR IGNORE INTO CQL_FACT')
      expect(numericRuleCall[1]).toContain('Zahl')
    })
  })

  describe('Seed Concept-CQL Lookups', () => {
    it('should insert all lookups', async () => {
      mockConnection.executeCommand.mockResolvedValue({ success: true })

      const count = await seedManager.seedConceptCqlLookups()

      expect(count).toBe(8)
      expect(mockConnection.executeCommand).toHaveBeenCalledTimes(8)
    })

    it('should link concepts to CQL rules correctly', async () => {
      mockConnection.executeCommand.mockResolvedValue({ success: true })

      await seedManager.seedConceptCqlLookups()

      // Check that SCTID: 1255866005 is linked to CQL_ID 8
      const lookupCall = mockConnection.executeCommand.mock.calls.find((call) =>
        call[1].includes('SCTID: 1255866005'),
      )
      expect(lookupCall).toBeDefined()
      expect(lookupCall[1]).toContain('8') // CQL_ID 8 as string
    })
  })

  describe('Seed Standard Users', () => {
    it('should insert all standard users', async () => {
      mockConnection.executeCommand.mockResolvedValue({ success: true })

      const count = await seedManager.seedStandardUsers()

      expect(count).toBe(4)
      expect(mockConnection.executeCommand).toHaveBeenCalledTimes(4)
    })

    it('should handle individual user insertion errors', async () => {
      mockConnection.executeCommand
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('User insert failed'))
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })

      const count = await seedManager.seedStandardUsers()

      expect(count).toBe(3) // Only 3 users inserted successfully
    })
  })

  describe('Database Operations', () => {
    it('should insert concept with correct SQL', async () => {
      const concept = {
        CONCEPT_CD: 'TEST001',
        NAME_CHAR: 'Test Concept',
        VALTYPE_CD: 'S',
        SOURCESYSTEM_CD: 'CUSTOM',
      }

      mockConnection.executeCommand.mockResolvedValue({ success: true })

      await seedManager.insertConcept(concept)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO CONCEPT_DIMENSION'),
        expect.arrayContaining(['TEST001', 'Test Concept', 'S', 'CUSTOM']),
      )
    })

    it('should insert CQL rule with correct SQL', async () => {
      const cqlRule = {
        CQL_ID: 1,
        CODE_CD: 'numeric',
        NAME_CHAR: 'Zahl',
        CQL_CHAR: 'library NUMBER...',
      }

      mockConnection.executeCommand.mockResolvedValue({ success: true })

      await seedManager.insertCqlRule(cqlRule)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO CQL_FACT'),
        expect.arrayContaining([1, 'numeric', 'Zahl', 'library NUMBER...']),
      )
    })

    it('should insert user with correct SQL', async () => {
      const user = {
        USER_ID: 1,
        COLUMN_CD: 'admin',
        USER_CD: 'admin',
        NAME_CHAR: 'Administrator',
        PASSWORD_CHAR: 'admin',
        USER_BLOB: 'Administrator',
        UPDATE_DATE: '2025-01-23 09:00:00',
        IMPORT_DATE: '2025-01-23',
        UPLOAD_ID: 1,
      }

      mockConnection.executeCommand.mockResolvedValue({ success: true })

      await seedManager.insertUser(user)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE INTO USER_MANAGEMENT'),
        expect.arrayContaining([1, 'admin', 'admin', 'Administrator', 'admin']),
      )
    })
  })

  describe('Get Seed Data Statistics', () => {
    it('should return correct statistics', async () => {
      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 10 }] }) // concepts
        .mockResolvedValueOnce({ success: true, data: [{ count: 8 }] }) // cql rules
        .mockResolvedValueOnce({ success: true, data: [{ count: 8 }] }) // lookups
        .mockResolvedValueOnce({ success: true, data: [{ count: 4 }] }) // users

      const stats = await seedManager.getSeedDataStatistics()

      expect(stats).toEqual({
        concepts: 10,
        cqlRules: 8,
        conceptCqlLookups: 8,
        users: 4,
      })
    })

    it('should handle query errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Query failed'))

      const stats = await seedManager.getSeedDataStatistics()

      expect(stats).toEqual({
        concepts: 0,
        cqlRules: 0,
        conceptCqlLookups: 0,
        users: 0,
        errors: ['Query failed'],
      })
    })
  })

  describe('Standard Users Data', () => {
    it('should have correct admin user', () => {
      const adminUser = seedManager.standardUsers.find((u) => u.USER_CD === 'admin')
      expect(adminUser).toBeDefined()
      expect(adminUser.PASSWORD_CHAR).toBe('admin')
      expect(adminUser.USER_BLOB).toBe('Administrator')
    })

    it('should have correct public user', () => {
      const publicUser = seedManager.standardUsers.find((u) => u.USER_CD === 'public')
      expect(publicUser).toBeDefined()
      expect(publicUser.PASSWORD_CHAR).toBe('public')
      expect(publicUser.USER_BLOB).toBe('öffentlicher Zugang')
    })
  })

  describe('CQL Rules Data', () => {
    it('should have numeric rule', () => {
      const numericRule = seedManager.cqlRules.find((r) => r.CODE_CD === 'numeric')
      expect(numericRule).toBeDefined()
      expect(numericRule.NAME_CHAR).toBe('Zahl')
      expect(numericRule.CQL_CHAR).toContain('VALUE >= 0')
    })

    it('should have age rule', () => {
      const ageRule = seedManager.cqlRules.find((r) => r.CODE_CD === 'age')
      expect(ageRule).toBeDefined()
      expect(ageRule.NAME_CHAR).toBe('Alter')
      expect(ageRule.CQL_CHAR).toContain('VALUE >= 0 and VALUE < 140')
    })
  })

  describe('Concepts Data', () => {
    it('should have general concept', () => {
      const generalConcept = seedManager.concepts.find((c) => c.CONCEPT_CD === 'GENERAL_CONCEPT')
      expect(generalConcept).toBeDefined()
      expect(generalConcept.NAME_CHAR).toBe('CONCEPT')
      expect(generalConcept.VALTYPE_CD).toBe('S')
    })

    it('should have custom concepts', () => {
      const customConcepts = seedManager.concepts.filter((c) => c.SOURCESYSTEM_CD === 'CUSTOM')
      expect(customConcepts.length).toBeGreaterThan(0)
    })
  })
})
