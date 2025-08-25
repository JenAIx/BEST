/**
 * Integration Tests for ProviderRepository
 *
 * Tests healthcare provider management with real SQLite database:
 * - Full CRUD operations with data persistence
 * - Provider search and filtering with real data
 * - Organizational hierarchy management
 * - Performance metrics and statistics
 * - Provider-observation relationships
 * - Complex queries and data integrity
 *
 * Uses real database with migrations and seed data for comprehensive testing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'
import ProviderRepository from '../../src/core/database/repositories/provider-repository.js'
import PatientRepository from '../../src/core/database/repositories/patient-repository.js'
import VisitRepository from '../../src/core/database/repositories/visit-repository.js'
import ObservationRepository from '../../src/core/database/repositories/observation-repository.js'

import path from 'path'
import fs from 'fs'

describe('ProviderRepository Integration Tests', () => {
  let connection
  let migrationManager
  let seedManager
  let providerRepository
  let patientRepository
  let visitRepository
  let observationRepository
  let testDbPath

  beforeAll(async () => {
    // Create test database
    testDbPath = path.join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'provider-integration-test.db')

    // Ensure output directory exists
    const outputDir = path.dirname(testDbPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Initialize database connection
    connection = new RealSQLiteConnection()
    await connection.connect(testDbPath)

    // Initialize migration manager
    migrationManager = new MigrationManager(connection)

    // Register migrations
    const initialSchema = await import('../../src/core/database/migrations/001-initial-schema.js')
    const currentSchema = await import('../../src/core/database/migrations/002-current-schema.js')
    const addNoteFactColumns = await import('../../src/core/database/migrations/003-add-note-fact-columns.js')

    migrationManager.registerMigration(initialSchema.initialSchema)
    migrationManager.registerMigration(currentSchema.currentSchema)
    migrationManager.registerMigration(addNoteFactColumns.addNoteFactColumns)
    await migrationManager.initializeDatabase()

    // Initialize seed data
    seedManager = new SeedManager(connection)
    await seedManager.initializeSeedData()

    // Initialize repositories
    providerRepository = new ProviderRepository(connection)
    patientRepository = new PatientRepository(connection)
    visitRepository = new VisitRepository(connection)
    observationRepository = new ObservationRepository(connection)

    console.log('ProviderRepository Integration Tests - Database initialized')
  }, 60000) // 60 second timeout for database initialization with seeding

  afterAll(async () => {
    if (connection) {
      await connection.disconnect()
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    console.log('ProviderRepository Integration Tests - Database cleaned up')
  })

  beforeEach(async () => {
    // Clean up test data between tests
    await connection.executeCommand('DELETE FROM OBSERVATION_FACT WHERE PROVIDER_ID LIKE "TEST%"')
    await connection.executeCommand('DELETE FROM VISIT_DIMENSION WHERE LOCATION_CD LIKE "TEST%"')
    await connection.executeCommand('DELETE FROM PATIENT_DIMENSION WHERE PATIENT_CD LIKE "TEST%"')
    await connection.executeCommand('DELETE FROM PROVIDER_DIMENSION WHERE PROVIDER_ID LIKE "TEST%"')
    await connection.executeCommand('DELETE FROM CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE "TEST:%"')

    // Reset auto-increment sequences
    await connection.executeCommand('DELETE FROM sqlite_sequence WHERE name IN ("PROVIDER_DIMENSION", "PATIENT_DIMENSION", "VISIT_DIMENSION", "OBSERVATION_FACT")')
  })

  describe('Provider CRUD Operations', () => {
    it('should create and retrieve a healthcare provider', async () => {
      const providerData = {
        PROVIDER_ID: 'TEST001',
        NAME_CHAR: 'Dr. Test Smith',
        PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      }

      const createdProvider = await providerRepository.createProvider(providerData)

      expect(createdProvider).toBeDefined()
      expect(createdProvider.PROVIDER_ID).toBe('TEST001')
      expect(createdProvider.NAME_CHAR).toBe('Dr. Test Smith')
      expect(createdProvider.PROVIDER_PATH).toBe('TEST_ORG/NEURO/ATTENDING')

      // Verify persistence by retrieving from database
      const retrievedProvider = await providerRepository.findByProviderId('TEST001')
      expect(retrievedProvider).toBeDefined()
      expect(retrievedProvider.PROVIDER_ID).toBe('TEST001')
      expect(retrievedProvider.NAME_CHAR).toBe('Dr. Test Smith')
      expect(retrievedProvider.PROVIDER_PATH).toBe('TEST_ORG/NEURO/ATTENDING')
    })

    it('should create multiple providers with different organizational structures', async () => {
      const providers = [
        {
          PROVIDER_ID: 'TEST001',
          NAME_CHAR: 'Dr. Test Smith',
          PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST002',
          NAME_CHAR: 'Dr. Test Jones',
          PROVIDER_PATH: 'TEST_ORG/CARDIO/ATTENDING',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST003',
          NAME_CHAR: 'Dr. Test Brown',
          PROVIDER_PATH: 'TEST_ORG/NEURO/RESIDENT',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
      ]

      for (const providerData of providers) {
        const createdProvider = await providerRepository.createProvider(providerData)
        expect(createdProvider.PROVIDER_ID).toBe(providerData.PROVIDER_ID)
      }

      // Verify all providers were created
      const allProviders = await providerRepository.findAll()
      const testProviders = allProviders.filter((p) => p.PROVIDER_ID.startsWith('TEST'))
      expect(testProviders).toHaveLength(3)
    })

    it('should update provider information', async () => {
      // Create initial provider
      const providerData = {
        PROVIDER_ID: 'TEST001',
        NAME_CHAR: 'Dr. Test Smith',
        PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      }

      await providerRepository.createProvider(providerData)

      // Update provider
      const updateData = {
        NAME_CHAR: 'Dr. Test Smith-Jones',
        PROVIDER_PATH: 'TEST_ORG/NEURO/CHIEF',
      }

      const updateResult = await providerRepository.updateProvider('TEST001', updateData)
      expect(updateResult).toBe(true)

      // Verify update
      const updatedProvider = await providerRepository.findByProviderId('TEST001')
      expect(updatedProvider.NAME_CHAR).toBe('Dr. Test Smith-Jones')
      expect(updatedProvider.PROVIDER_PATH).toBe('TEST_ORG/NEURO/CHIEF')
    })

    it('should delete a provider', async () => {
      // Create provider
      const providerData = {
        PROVIDER_ID: 'TEST001',
        NAME_CHAR: 'Dr. Test Smith',
        PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      }

      await providerRepository.createProvider(providerData)

      // Verify provider exists
      const existingProvider = await providerRepository.findByProviderId('TEST001')
      expect(existingProvider).toBeDefined()

      // Delete provider
      const deleteResult = await providerRepository.delete('TEST001')
      expect(deleteResult).toBe(true)

      // Verify deletion
      const deletedProvider = await providerRepository.findByProviderId('TEST001')
      expect(deletedProvider).toBeNull()
    })
  })

  describe('Provider Search and Filtering', () => {
    beforeEach(async () => {
      // Create test providers with different characteristics
      const providers = [
        {
          PROVIDER_ID: 'TEST001',
          NAME_CHAR: 'Dr. Test Smith',
          PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST002',
          NAME_CHAR: 'Dr. Test Jones',
          PROVIDER_PATH: 'TEST_ORG/CARDIO/ATTENDING',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST003',
          NAME_CHAR: 'Dr. Test Brown',
          PROVIDER_PATH: 'TEST_ORG/NEURO/RESIDENT',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST004',
          NAME_CHAR: 'Dr. Test Wilson',
          PROVIDER_PATH: 'TEST_ORG/CARDIO/RESIDENT',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
      ]

      for (const providerData of providers) {
        await providerRepository.createProvider(providerData)
      }
    })

    it('should find providers by name pattern', async () => {
      const smithProviders = await providerRepository.findByName('Smith')
      expect(smithProviders).toHaveLength(1)
      expect(smithProviders[0].NAME_CHAR).toBe('Dr. Test Smith')

      const testProviders = await providerRepository.findByName('Test')
      expect(testProviders).toHaveLength(4)
    })

    it('should find providers by path pattern', async () => {
      const neuroProviders = await providerRepository.findByPath('NEURO')
      expect(neuroProviders).toHaveLength(2)
      expect(neuroProviders.every((p) => p.PROVIDER_PATH.includes('NEURO'))).toBe(true)

      const attendingProviders = await providerRepository.findByPath('ATTENDING')
      expect(attendingProviders).toHaveLength(2)
    })

    it('should find providers by department', async () => {
      const neuroProviders = await providerRepository.findByDepartment('NEURO')
      expect(neuroProviders).toHaveLength(2)
      expect(neuroProviders.every((p) => p.PROVIDER_PATH.includes('NEURO'))).toBe(true)

      const cardioProviders = await providerRepository.findByDepartment('CARDIO')
      expect(cardioProviders).toHaveLength(2)
    })

    it('should find providers by organization', async () => {
      const testOrgProviders = await providerRepository.findByOrganization('TEST_ORG')
      expect(testOrgProviders).toHaveLength(4)
      expect(testOrgProviders.every((p) => p.PROVIDER_PATH.startsWith('TEST_ORG'))).toBe(true)
    })

    it('should search providers by multiple fields', async () => {
      const results = await providerRepository.searchProviders('NEURO')
      expect(results).toHaveLength(2)
      expect(results.every((p) => p.PROVIDER_ID.includes('NEURO') || p.NAME_CHAR.includes('NEURO') || p.PROVIDER_PATH.includes('NEURO'))).toBe(true)

      const smithResults = await providerRepository.searchProviders('Smith')
      expect(smithResults).toHaveLength(1)
      expect(smithResults[0].NAME_CHAR).toBe('Dr. Test Smith')
    })
  })

  describe('Provider Organizational Hierarchy', () => {
    beforeEach(async () => {
      // Create providers with complex organizational structure
      const providers = [
        {
          PROVIDER_ID: 'TEST001',
          NAME_CHAR: 'Dr. Test Smith',
          PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST002',
          NAME_CHAR: 'Dr. Test Jones',
          PROVIDER_PATH: 'TEST_ORG/NEURO/RESIDENT',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST003',
          NAME_CHAR: 'Dr. Test Brown',
          PROVIDER_PATH: 'TEST_ORG/CARDIO/ATTENDING',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST004',
          NAME_CHAR: 'Dr. Test Wilson',
          PROVIDER_PATH: 'TEST_ORG/CARDIO/RESIDENT',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST005',
          NAME_CHAR: 'Dr. Test Davis',
          PROVIDER_PATH: 'OTHER_ORG/NEURO/ATTENDING',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
      ]

      for (const providerData of providers) {
        await providerRepository.createProvider(providerData)
      }
    })

    it('should return organizational hierarchy structure', async () => {
      const hierarchy = await providerRepository.getProviderHierarchy()

      expect(hierarchy).toBeDefined()
      expect(hierarchy.TEST_ORG).toBeDefined()
      expect(hierarchy.OTHER_ORG).toBeDefined()

      // The hierarchy groups by the full path after organization, so we need to check the actual structure
      expect(hierarchy.TEST_ORG['NEURO/ATTENDING']).toBe(1)
      expect(hierarchy.TEST_ORG['NEURO/RESIDENT']).toBe(1)
      expect(hierarchy.TEST_ORG['CARDIO/ATTENDING']).toBe(1)
      expect(hierarchy.TEST_ORG['CARDIO/RESIDENT']).toBe(1)
      expect(hierarchy.OTHER_ORG['NEURO/ATTENDING']).toBe(1)
    })

    it('should handle providers without hierarchical paths', async () => {
      // Add provider without hierarchical path
      await providerRepository.createProvider({
        PROVIDER_ID: 'TEST006',
        NAME_CHAR: 'Dr. Test Simple',
        PROVIDER_PATH: 'SIMPLE',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      const hierarchy = await providerRepository.getProviderHierarchy()

      // Simple provider should not affect hierarchy (only providers with / are included)
      expect(hierarchy.TEST_ORG['NEURO/ATTENDING']).toBe(1)
      expect(hierarchy.TEST_ORG['NEURO/RESIDENT']).toBe(1)
      expect(hierarchy.TEST_ORG['CARDIO/ATTENDING']).toBe(1)
      expect(hierarchy.TEST_ORG['CARDIO/RESIDENT']).toBe(1)
      expect(hierarchy.OTHER_ORG['NEURO/ATTENDING']).toBe(1)
    })
  })

  describe('Provider Performance and Statistics', () => {
    beforeEach(async () => {
      // Create test data: patient, visit, provider, and observations
      const patient = await patientRepository.createPatient({
        PATIENT_CD: 'TEST001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      const today = new Date().toISOString().split('T')[0] // Use today's date

      const visit = await visitRepository.createVisit({
        PATIENT_NUM: patient.PATIENT_NUM,
        START_DATE: today,
        LOCATION_CD: 'TEST_LOC',
        INOUT_CD: 'I',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      const provider = await providerRepository.createProvider({
        PROVIDER_ID: 'TEST001',
        NAME_CHAR: 'Dr. Test Smith',
        PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Create test concepts first
      await connection.executeCommand(`
        INSERT INTO CONCEPT_DIMENSION (CONCEPT_CD, NAME_CHAR, CONCEPT_PATH, SOURCESYSTEM_CD, UPLOAD_ID) 
        VALUES 
        ('TEST:001', 'Test Concept 1', 'TEST/CONCEPT/001', 'TEST', 1),
        ('TEST:002', 'Test Concept 2', 'TEST/CONCEPT/002', 'TEST', 1),
        ('TEST:003', 'Test Concept 3', 'TEST/CONCEPT/003', 'TEST', 1)
      `)

      // Create observations for the provider using simple concept codes
      const observations = [
        {
          PATIENT_NUM: patient.PATIENT_NUM,
          ENCOUNTER_NUM: visit.ENCOUNTER_NUM,
          CONCEPT_CD: 'TEST:001', // Simple test concept
          PROVIDER_ID: provider.PROVIDER_ID,
          VALTYPE_CD: 'N',
          NVAL_NUM: 120.5,
          START_DATE: today,
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PATIENT_NUM: patient.PATIENT_NUM,
          ENCOUNTER_NUM: visit.ENCOUNTER_NUM,
          CONCEPT_CD: 'TEST:002', // Simple test concept
          PROVIDER_ID: provider.PROVIDER_ID,
          VALTYPE_CD: 'T',
          TVAL_CHAR: 'Test observation',
          START_DATE: today,
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
      ]

      for (const obsData of observations) {
        await observationRepository.createObservation(obsData)
      }
    })

    it('should get providers with observation counts', async () => {
      const providersWithCounts = await providerRepository.getProvidersWithObservationCounts()

      const testProvider = providersWithCounts.find((p) => p.PROVIDER_ID === 'TEST001')
      expect(testProvider).toBeDefined()
      expect(testProvider.observationCount).toBe(2)
    })

    it('should get provider performance metrics', async () => {
      const performance = await providerRepository.getProviderPerformance('TEST001')

      expect(performance.totalObservations).toBe(2)
      expect(performance.uniquePatients).toBe(1)
      expect(performance.uniqueVisits).toBe(1)
      const today = new Date().toISOString().split('T')[0]
      expect(performance.firstObservation).toBe(today)
      expect(performance.lastObservation).toBe(today)
      expect(performance.avgNumericValue).toBe(120.5)
    })

    it('should get comprehensive provider statistics', async () => {
      const stats = await providerRepository.getProviderStatistics()

      expect(stats.totalProviders).toBeGreaterThan(0)
      expect(stats.byOrganization).toBeDefined()
      expect(stats.byDepartment).toBeDefined()
      expect(stats.withObservations).toBeGreaterThan(0)
      expect(stats.byMonth).toBeDefined()
    })

    it('should identify active providers', async () => {
      const activeProviders = await providerRepository.getActiveProviders(30)

      const testProvider = activeProviders.find((p) => p.PROVIDER_ID === 'TEST001')
      expect(testProvider).toBeDefined()
      expect(testProvider.NAME_CHAR).toBe('Dr. Test Smith')
    })
  })

  describe('Provider Pagination and Advanced Filtering', () => {
    beforeEach(async () => {
      // Create multiple test providers
      const providers = []
      for (let i = 1; i <= 25; i++) {
        providers.push({
          PROVIDER_ID: `TEST${i.toString().padStart(3, '0')}`,
          NAME_CHAR: `Dr. Test ${i}`,
          PROVIDER_PATH: `TEST_ORG/DEPT${Math.ceil(i / 5)}/ROLE${i % 3}`,
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        })
      }

      for (const providerData of providers) {
        await providerRepository.createProvider(providerData)
      }
    })

    it('should handle pagination correctly', async () => {
      const page1 = await providerRepository.getProvidersPaginated(1, 10)
      const page2 = await providerRepository.getProvidersPaginated(2, 10)
      const page3 = await providerRepository.getProvidersPaginated(3, 10)

      expect(page1.providers).toHaveLength(10)
      expect(page2.providers).toHaveLength(10)
      expect(page3.providers).toHaveLength(5)

      expect(page1.pagination.page).toBe(1)
      expect(page1.pagination.hasNext).toBe(true)
      expect(page1.pagination.hasPrev).toBe(false)

      expect(page2.pagination.page).toBe(2)
      expect(page2.pagination.hasNext).toBe(true)
      expect(page2.pagination.hasPrev).toBe(true)

      expect(page3.pagination.page).toBe(3)
      expect(page3.pagination.hasNext).toBe(false)
      expect(page3.pagination.hasPrev).toBe(true)
    })

    it('should apply search criteria in pagination', async () => {
      const criteria = {
        name: 'Test 1',
        path: 'DEPT1',
        organization: 'TEST_ORG',
      }

      const result = await providerRepository.getProvidersPaginated(1, 10, criteria)

      expect(result.providers.length).toBeGreaterThan(0)
      expect(result.providers.every((p) => p.NAME_CHAR.includes('Test 1') || p.PROVIDER_PATH.includes('DEPT1') || p.PROVIDER_PATH.startsWith('TEST_ORG'))).toBe(true)
    })

    it('should filter providers with observations', async () => {
      // Create a provider with observations
      const patient = await patientRepository.createPatient({
        PATIENT_CD: 'TEST002',
        SEX_CD: 'F',
        AGE_IN_YEARS: 25,
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      const today = new Date().toISOString().split('T')[0] // Use today's date

      const visit = await visitRepository.createVisit({
        PATIENT_NUM: patient.PATIENT_NUM,
        START_DATE: today,
        LOCATION_CD: 'TEST_LOC',
        INOUT_CD: 'I',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Create test concept if it doesn't exist
      await connection.executeCommand(`
        INSERT OR IGNORE INTO CONCEPT_DIMENSION (CONCEPT_CD, NAME_CHAR, CONCEPT_PATH, SOURCESYSTEM_CD, UPLOAD_ID) 
        VALUES ('TEST:003', 'Test Concept 3', 'TEST/CONCEPT/003', 'TEST', 1)
      `)

      await observationRepository.createObservation({
        PATIENT_NUM: patient.PATIENT_NUM,
        ENCOUNTER_NUM: visit.ENCOUNTER_NUM,
        CONCEPT_CD: 'TEST:003', // Simple test concept
        PROVIDER_ID: 'TEST001',
        VALTYPE_CD: 'N',
        NVAL_NUM: 100,
        START_DATE: today,
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      const result = await providerRepository.getProvidersPaginated(1, 10, {
        hasObservations: true,
      })

      expect(result.providers.length).toBeGreaterThan(0)
      expect(result.providers.some((p) => p.PROVIDER_ID === 'TEST001')).toBe(true)
    })
  })

  describe('Provider Role and Function Management', () => {
    beforeEach(async () => {
      // Create providers with different roles in BLOB data
      const providers = [
        {
          PROVIDER_ID: 'TEST001',
          NAME_CHAR: 'Dr. Test Smith',
          PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
          CONCEPT_BLOB: '{"role": "wissenschaftlicher Mitarbeiter", "specialty": "Neurology"}',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST002',
          NAME_CHAR: 'Dr. Test Jones',
          PROVIDER_PATH: 'TEST_ORG/CARDIO/ATTENDING',
          CONCEPT_BLOB: '{"role": "Oberarzt", "specialty": "Cardiology"}',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PROVIDER_ID: 'TEST003',
          NAME_CHAR: 'Dr. Test Brown',
          PROVIDER_PATH: 'TEST_ORG/NEURO/RESIDENT',
          CONCEPT_BLOB: '{"role": "wissenschaftlicher Mitarbeiter", "specialty": "Neurology"}',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
      ]

      for (const providerData of providers) {
        await providerRepository.createProvider(providerData)
      }
    })

    it('should find providers by role', async () => {
      const wissenschaftlerProviders = await providerRepository.findByRole('wissenschaftlicher Mitarbeiter')
      expect(wissenschaftlerProviders).toHaveLength(2)
      expect(wissenschaftlerProviders.every((p) => p.CONCEPT_BLOB.includes('wissenschaftlicher Mitarbeiter'))).toBe(true)

      const oberarztProviders = await providerRepository.findByRole('Oberarzt')
      expect(oberarztProviders).toHaveLength(1)
      expect(oberarztProviders[0].CONCEPT_BLOB).toContain('Oberarzt')
    })
  })

  describe('Data Integrity and Error Handling', () => {
    it('should enforce unique PROVIDER_ID constraint', async () => {
      const providerData = {
        PROVIDER_ID: 'TEST001',
        NAME_CHAR: 'Dr. Test Smith',
        PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      }

      // Create first provider
      await providerRepository.createProvider(providerData)

      // Attempt to create duplicate
      await expect(providerRepository.createProvider(providerData)).rejects.toThrow()
    })

    it('should handle missing required fields gracefully', async () => {
      const invalidProvider = {
        NAME_CHAR: 'Dr. Test Smith',
        PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
      }

      await expect(providerRepository.createProvider(invalidProvider)).rejects.toThrow('PROVIDER_ID is required for provider creation')

      const invalidProvider2 = {
        PROVIDER_ID: 'TEST001',
        PROVIDER_PATH: 'TEST_ORG/NEURO/ATTENDING',
      }

      await expect(providerRepository.createProvider(invalidProvider2)).rejects.toThrow('NAME_CHAR is required for provider creation')
    })

    it('should handle provider updates for non-existent providers', async () => {
      await expect(providerRepository.updateProvider('NONEXISTENT', { NAME_CHAR: 'New Name' })).rejects.toThrow('Provider with PROVIDER_ID NONEXISTENT not found')
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large provider datasets efficiently', async () => {
      const startTime = Date.now()

      // Create 100 providers
      const providers = []
      for (let i = 1; i <= 100; i++) {
        providers.push({
          PROVIDER_ID: `PERF${i.toString().padStart(3, '0')}`,
          NAME_CHAR: `Dr. Performance ${i}`,
          PROVIDER_PATH: `PERF_ORG/DEPT${Math.ceil(i / 10)}/ROLE${i % 5}`,
          SOURCESYSTEM_CD: 'PERF',
          UPLOAD_ID: 1,
        })
      }

      for (const providerData of providers) {
        await providerRepository.createProvider(providerData)
      }

      const createTime = Date.now() - startTime
      console.log(`Created 100 providers in ${createTime}ms`)
      expect(createTime).toBeLessThan(5000) // Should complete within 5 seconds

      // Test search performance
      const searchStartTime = Date.now()
      const searchResults = await providerRepository.searchProviders('Performance')
      const searchTime = Date.now() - searchStartTime

      console.log(`Searched 100 providers in ${searchTime}ms`)
      expect(searchResults).toHaveLength(100)
      expect(searchTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should maintain performance with complex organizational queries', async () => {
      // Create providers with complex organizational structure
      const providers = []
      for (let i = 1; i <= 50; i++) {
        providers.push({
          PROVIDER_ID: `COMPLEX${i.toString().padStart(3, '0')}`,
          NAME_CHAR: `Dr. Complex ${i}`,
          PROVIDER_PATH: `ORG${Math.ceil(i / 10)}/DEPT${Math.ceil(i / 5)}/ROLE${i % 3}/SUBROLE${i % 2}`,
          SOURCESYSTEM_CD: 'COMPLEX',
          UPLOAD_ID: 1,
        })
      }

      for (const providerData of providers) {
        await providerRepository.createProvider(providerData)
      }

      const startTime = Date.now()

      // Test complex hierarchy query
      const hierarchy = await providerRepository.getProviderHierarchy()
      const hierarchyTime = Date.now() - startTime

      console.log(`Generated complex hierarchy in ${hierarchyTime}ms`)
      expect(hierarchyTime).toBeLessThan(2000) // Should complete within 2 seconds
      expect(Object.keys(hierarchy).length).toBeGreaterThan(0)
    })
  })
})
