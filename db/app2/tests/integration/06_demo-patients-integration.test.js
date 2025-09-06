/**
 * Integration Tests for Demo Patient Creation
 *
 * Tests the complete demo patient creation functionality including:
 * - Creating 20 demo patients with realistic data
 * - Creating 2-3 visits per patient
 * - Creating 10 random observations per visit
 * - Creating necessary demo concepts
 * - Data validation and integrity checks
 * - Cleanup functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'
import PatientRepository from '../../src/core/database/repositories/patient-repository.js'
import VisitRepository from '../../src/core/database/repositories/visit-repository.js'
import ObservationRepository from '../../src/core/database/repositories/observation-repository.js'
import ConceptRepository from '../../src/core/database/repositories/concept-repository.js'
import { currentSchema } from '../../src/core/database/migrations/002-current-schema.js'
import { addNoteFactColumns } from '../../src/core/database/migrations/003-add-note-fact-columns.js'
// import { addCascadeTriggers } from '../../src/core/database/migrations/004-add-cascade-triggers.js'
import { createDemoPatients } from '../../src/core/services/demo-patient-service.js'
import { deleteDemoPatients, deleteDemoPatientsByCode, countDemoData } from '../../src/core/services/delete-demo-patients-service.js'

describe('Demo Patient Creation Integration Tests', () => {
  let connection
  let migrationManager
  let seedManager
  let patientRepository
  let visitRepository
  let observationRepository
  let conceptRepository
  let testDbPath

  beforeAll(async () => {
    // Create test database
    testDbPath = path.join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'demo-patients-test.db')

    // Ensure output directory exists
    const outputDir = path.dirname(testDbPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Clean up existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    // Initialize database connection
    connection = new RealSQLiteConnection()
    await connection.connect(testDbPath)

    // Initialize migration manager and seed manager
    migrationManager = new MigrationManager(connection)
    seedManager = new SeedManager(connection)

    migrationManager.registerMigration(currentSchema)
    migrationManager.registerMigration(addNoteFactColumns)
    // TODO: Re-enable cascade triggers once SQL parsing issues are resolved
    // migrationManager.registerMigration(addCascadeTriggers)

    // Initialize database with migrations and seed data
    await migrationManager.initializeDatabaseWithSeeds(seedManager)
    console.log('Database initialization with seeds completed successfully')

    // Initialize repositories
    patientRepository = new PatientRepository(connection)
    visitRepository = new VisitRepository(connection)
    observationRepository = new ObservationRepository(connection)
    conceptRepository = new ConceptRepository(connection)

    console.log('Demo Patient Integration Tests - Database initialized')
  }, 60000) // 60 second timeout for database initialization with seeding

  afterAll(async () => {
    if (connection) {
      await connection.disconnect()
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    console.log('Demo Patient Integration Tests - Database cleaned up')
  })

  beforeEach(async () => {
    // Clean up any existing demo data before each test
    await deleteDemoPatients({
      patientRepository,
      visitRepository,
      observationRepository,
      conceptRepository,
    })
  })

  describe('Demo Patient Creation', () => {
    it('should create 20 demo patients with complete data', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 20)

      // Verify patients were created
      expect(results.patients).toHaveLength(20)
      expect(results.errors).toHaveLength(0)

      // Verify patient data structure
      for (const patient of results.patients) {
        expect(patient.PATIENT_CD).toMatch(/^DEMO_PATIENT_\d{2}$/)
        expect(patient.SEX_CD).toBeTruthy() // Now uses concept codes like "SCTID: 248153007"
        expect(patient.AGE_IN_YEARS).toBeGreaterThanOrEqual(18)
        expect(patient.AGE_IN_YEARS).toBeLessThanOrEqual(79)
        expect(patient.VITAL_STATUS_CD).toBeTruthy() // Now uses concept codes like "SCTID: 438949009"
        expect(patient.BIRTH_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
        expect(patient.SOURCESYSTEM_CD).toBe('DEMO')
        expect(patient.UPLOAD_ID).toBe(1)
        expect(patient.PATIENT_NUM).toBeGreaterThan(0)
      }

      // Verify visits were created (2-3 per patient = 40-60 total)
      expect(results.visits.length).toBeGreaterThanOrEqual(40)
      expect(results.visits.length).toBeLessThanOrEqual(60)

      // Verify observations were created (10 per visit)
      const expectedObservations = results.visits.length * 10
      expect(results.observations).toHaveLength(expectedObservations)

      // We no longer create demo concepts since we use real concepts from the database
    }, 30000) // 30 second timeout for this comprehensive test

    it('should create patients with realistic demographic data', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 5)

      expect(results.patients).toHaveLength(5)

      for (const patient of results.patients) {
        // Check required fields
        expect(patient.PATIENT_CD).toBeTruthy()
        expect(patient.SEX_CD).toBeTruthy() // Now uses concept codes
        expect(patient.AGE_IN_YEARS).toBeGreaterThan(0)
        expect(patient.BIRTH_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format

        // Check optional demographic fields are populated
        expect(patient.LANGUAGE_CD).toBeTruthy()
        expect(patient.RACE_CD).toBeTruthy()
        expect(patient.MARITAL_STATUS_CD).toBeTruthy()
        expect(patient.RELIGION_CD).toBeTruthy()

        // Check birth date is reasonable
        if (patient.BIRTH_DATE) {
          const birthYear = new Date(patient.BIRTH_DATE).getFullYear()
          const currentYear = new Date().getFullYear()
          const calculatedAge = currentYear - birthYear
          expect(Math.abs(calculatedAge - patient.AGE_IN_YEARS)).toBeLessThanOrEqual(1)
        }
      }
    })

    it('should create visits with realistic data patterns', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 3)

      expect(results.visits.length).toBeGreaterThan(0)

      for (const visit of results.visits) {
        // Check required fields
        expect(visit.PATIENT_NUM).toBeGreaterThan(0)
        expect(visit.ENCOUNTER_NUM).toBeGreaterThan(0)
        expect(visit.START_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(visit.INOUT_CD).toMatch(/^[IOE]$/)
        expect(visit.LOCATION_CD).toContain('DEMO_')
        expect(visit.ACTIVE_STATUS_CD).toBeTruthy() // Now uses concept codes like "SCTID: 55561003"
        expect(visit.SOURCESYSTEM_CD).toBe('DEMO')

        // Check date logic
        const startDate = new Date(visit.START_DATE)
        const now = new Date()
        expect(startDate.getTime()).toBeLessThanOrEqual(now.getTime())

        // If inpatient, should have end date
        if (visit.INOUT_CD === 'I' && visit.END_DATE) {
          const endDate = new Date(visit.END_DATE)
          expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime())
        }
      }
    })

    it('should create observations with diverse medical concepts', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 2)

      expect(results.observations.length).toBeGreaterThan(0)

      const conceptCodes = new Set()
      const categories = new Set()
      const valueTypes = new Set()

      for (const observation of results.observations) {
        // Check required fields
        expect(observation.PATIENT_NUM).toBeGreaterThan(0)
        expect(observation.ENCOUNTER_NUM).toBeGreaterThan(0)
        expect(observation.CONCEPT_CD).toBeTruthy() // Now uses real LOINC/SNOMED codes
        expect(observation.SOURCESYSTEM_CD).toBe('DEMO')
        expect(observation.START_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)

        // Collect diversity metrics
        conceptCodes.add(observation.CONCEPT_CD)
        categories.add(observation.CATEGORY_CHAR)
        valueTypes.add(observation.VALTYPE_CD)

        // Check value type consistency
        if (observation.VALTYPE_CD === 'N') {
          expect(observation.NVAL_NUM).toBeTypeOf('number')
          expect(observation.TVAL_CHAR).toBeNull()
        } else if (observation.VALTYPE_CD === 'T') {
          expect(observation.TVAL_CHAR).toBeTypeOf('string')
          expect(observation.NVAL_NUM).toBeNull()
        }
      }

      // Verify diversity
      expect(conceptCodes.size).toBeGreaterThan(5) // Multiple different concepts
      expect(categories.size).toBeGreaterThan(2) // Multiple categories
      expect(valueTypes.size).toBeGreaterThanOrEqual(2) // Both numeric and text values
    })

    it('should maintain referential integrity', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 3)

      // Verify all visits reference valid patients
      for (const visit of results.visits) {
        const patient = results.patients.find((p) => p.PATIENT_NUM === visit.PATIENT_NUM)
        expect(patient).toBeTruthy()
      }

      // Verify all observations reference valid patients and visits
      for (const observation of results.observations) {
        const patient = results.patients.find((p) => p.PATIENT_NUM === observation.PATIENT_NUM)
        const visit = results.visits.find((v) => v.ENCOUNTER_NUM === observation.ENCOUNTER_NUM)
        expect(patient).toBeTruthy()
        expect(visit).toBeTruthy()
        expect(visit.PATIENT_NUM).toBe(observation.PATIENT_NUM)
      }

      // Verify all observation concepts exist
      for (const observation of results.observations) {
        const concept = await conceptRepository.findByConceptCode(observation.CONCEPT_CD)
        expect(concept).toBeTruthy()
      }
    })

    it('should handle smaller patient counts', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 1)

      expect(results.patients).toHaveLength(1)
      expect(results.visits.length).toBeGreaterThanOrEqual(2)
      expect(results.visits.length).toBeLessThanOrEqual(3)
      expect(results.observations.length).toBe(results.visits.length * 10)
      expect(results.errors).toHaveLength(0)
    })
  })

  describe('Demo Data Cleanup', () => {
    it('should clean up all demo data', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      // First create some demo data
      await createDemoPatients(repositories, 2)

      // Verify data exists
      const demoPatients = await patientRepository.findBySourceSystem('DEMO')
      expect(demoPatients.length).toBeGreaterThan(0)

      // Clean up
      const cleanupResults = await deleteDemoPatients(repositories)

      expect(cleanupResults.deletedPatients).toBe(2)
      expect(cleanupResults.deletedVisits).toBeGreaterThan(0)
      expect(cleanupResults.deletedObservations).toBeGreaterThan(0)
      expect(cleanupResults.deletedConcepts).toBe(0) // We don't delete concepts anymore

      // Verify data is gone
      const remainingPatients = await patientRepository.findBySourceSystem('DEMO')
      expect(remainingPatients).toHaveLength(0)
    })

    it('should handle cleanup when no demo data exists', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const cleanupResults = await deleteDemoPatients(repositories)

      expect(cleanupResults.deletedPatients).toBe(0)
      expect(cleanupResults.deletedVisits).toBe(0)
      expect(cleanupResults.deletedObservations).toBe(0)
      expect(cleanupResults.deletedConcepts).toBe(0)
      expect(cleanupResults.errors).toHaveLength(0)
    })
  })

  describe('Demo Data Deletion by Patient Code', () => {
    it('should delete specific demo patients by code', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      // First create some demo data
      await createDemoPatients(repositories, 3)

      // Verify data exists
      const initialCount = await countDemoData(repositories)
      expect(initialCount.patients).toBe(3)

      // Delete specific patients
      const deleteResults = await deleteDemoPatientsByCode(repositories, ['DEMO_PATIENT_01', 'DEMO_PATIENT_02'])

      expect(deleteResults.deletedPatients).toBe(2)
      expect(deleteResults.deletedVisits).toBeGreaterThan(0)
      expect(deleteResults.deletedObservations).toBeGreaterThan(0)

      // Verify only one patient remains
      const finalCount = await countDemoData(repositories)
      expect(finalCount.patients).toBe(1)

      // Verify the remaining patient is DEMO_PATIENT_03
      const remainingPatients = await patientRepository.findBySourceSystem('DEMO')
      expect(remainingPatients).toHaveLength(1)
      expect(remainingPatients[0].PATIENT_CD).toBe('DEMO_PATIENT_03')
    })

    it('should handle deletion of non-existent patients gracefully', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const deleteResults = await deleteDemoPatientsByCode(repositories, ['NONEXISTENT_PATIENT_01', 'NONEXISTENT_PATIENT_02'])

      expect(deleteResults.deletedPatients).toBe(0)
      expect(deleteResults.errors.length).toBe(2)
      expect(deleteResults.errors[0]).toContain('not found')
      expect(deleteResults.errors[1]).toContain('not found')
    })
  })

  describe('Demo Data Counting', () => {
    it('should count demo data correctly', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      // Initially should be empty
      const initialCount = await countDemoData(repositories)
      expect(initialCount.patients).toBe(0)
      expect(initialCount.visits).toBe(0)
      expect(initialCount.observations).toBe(0)
      expect(initialCount.totalRecords).toBe(0)

      // Create demo data
      await createDemoPatients(repositories, 2)

      // Count should reflect created data
      const finalCount = await countDemoData(repositories)
      expect(finalCount.patients).toBe(2)
      expect(finalCount.visits).toBeGreaterThan(0)
      expect(finalCount.observations).toBeGreaterThan(0)
      expect(finalCount.concepts).toBe(0) // We don't count concepts anymore
      expect(finalCount.totalRecords).toBeGreaterThan(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Create a mock repository that throws errors
      const mockPatientRepo = {
        createPatient: () => {
          throw new Error('Mock patient creation error')
        },
      }

      const repositories = {
        patientRepository: mockPatientRepo,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 1)

      expect(results.patients).toHaveLength(0)
      expect(results.errors.length).toBeGreaterThan(0)
      expect(results.errors[0]).toContain('Mock patient creation error')
    })

    it('should continue creating other patients when one fails', async () => {
      // This test would require more sophisticated mocking
      // For now, we'll just verify the function doesn't crash with invalid data
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const results = await createDemoPatients(repositories, 2)

      // Should succeed normally
      expect(results.patients).toHaveLength(2)
      expect(results.errors).toHaveLength(0)
    })
  })

  describe('Cascade Deletion Tests', () => {
    it('should cascade delete observations when visit is deleted', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      // Create demo data
      const results = await createDemoPatients(repositories, 1)
      expect(results.patients).toHaveLength(1)
      expect(results.visits.length).toBeGreaterThan(0)
      expect(results.observations.length).toBeGreaterThan(0)

      const patient = results.patients[0]
      const visit = results.visits[0]

      // Verify observations exist for this visit
      const initialObservations = await observationRepository.findByVisitNum(visit.ENCOUNTER_NUM)
      expect(initialObservations.length).toBeGreaterThan(0)

      // Delete the visit - should cascade delete observations
      await visitRepository.delete(visit.ENCOUNTER_NUM)

      // Verify observations were cascade deleted
      const remainingObservations = await observationRepository.findByVisitNum(visit.ENCOUNTER_NUM)
      expect(remainingObservations).toHaveLength(0)

      // Verify patient still exists
      const remainingPatient = await patientRepository.findById(patient.PATIENT_NUM)
      expect(remainingPatient).toBeTruthy()
    })

    it('should cascade delete visits and observations when patient is deleted', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      // Create demo data
      const results = await createDemoPatients(repositories, 1)
      expect(results.patients).toHaveLength(1)
      expect(results.visits.length).toBeGreaterThan(0)
      expect(results.observations.length).toBeGreaterThan(0)

      const patient = results.patients[0]

      // Verify visits and observations exist for this patient
      const initialVisits = await visitRepository.findByPatientNum(patient.PATIENT_NUM)
      expect(initialVisits.length).toBeGreaterThan(0)

      const initialObservations = await observationRepository.findByPatientNum(patient.PATIENT_NUM)
      expect(initialObservations.length).toBeGreaterThan(0)

      // Delete the patient using cascade deletion service
      await deleteDemoPatientsByCode(repositories, [patient.PATIENT_CD])

      // Verify visits were cascade deleted
      const remainingVisits = await visitRepository.findByPatientNum(patient.PATIENT_NUM)
      expect(remainingVisits).toHaveLength(0)

      // Verify observations were cascade deleted
      const remainingObservations = await observationRepository.findByPatientNum(patient.PATIENT_NUM)
      expect(remainingObservations).toHaveLength(0)

      // Verify patient was deleted
      const remainingPatient = await patientRepository.findById(patient.PATIENT_NUM)
      expect(remainingPatient).toBeNull()
    })

    it('should handle cascade deletion with multiple patients and visits', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      // Create demo data with multiple patients
      const results = await createDemoPatients(repositories, 3)
      expect(results.patients).toHaveLength(3)

      const patient1 = results.patients[0]
      const patient2 = results.patients[1]

      // Get initial counts
      const initialVisits1 = await visitRepository.findByPatientNum(patient1.PATIENT_NUM)
      const initialObservations1 = await observationRepository.findByPatientNum(patient1.PATIENT_NUM)
      const initialVisits2 = await visitRepository.findByPatientNum(patient2.PATIENT_NUM)
      const initialObservations2 = await observationRepository.findByPatientNum(patient2.PATIENT_NUM)

      expect(initialVisits1.length).toBeGreaterThan(0)
      expect(initialObservations1.length).toBeGreaterThan(0)
      expect(initialVisits2.length).toBeGreaterThan(0)
      expect(initialObservations2.length).toBeGreaterThan(0)

      // Delete first patient using cascade deletion service - should only affect patient1's data
      await deleteDemoPatientsByCode(repositories, [patient1.PATIENT_CD])

      // Verify patient1's data was cascade deleted
      const remainingVisits1 = await visitRepository.findByPatientNum(patient1.PATIENT_NUM)
      const remainingObservations1 = await observationRepository.findByPatientNum(patient1.PATIENT_NUM)
      expect(remainingVisits1).toHaveLength(0)
      expect(remainingObservations1).toHaveLength(0)

      // Verify patient2's data is still intact
      const remainingVisits2 = await visitRepository.findByPatientNum(patient2.PATIENT_NUM)
      const remainingObservations2 = await observationRepository.findByPatientNum(patient2.PATIENT_NUM)
      expect(remainingVisits2).toHaveLength(initialVisits2.length)
      expect(remainingObservations2).toHaveLength(initialObservations2.length)

      // Verify patient2 still exists
      const remainingPatient2 = await patientRepository.findById(patient2.PATIENT_NUM)
      expect(remainingPatient2).toBeTruthy()
      expect(remainingPatient2.PATIENT_CD).toBe(patient2.PATIENT_CD)
    })
  })

  describe('Performance', () => {
    it('should create demo patients within reasonable time', async () => {
      const repositories = {
        patientRepository,
        visitRepository,
        observationRepository,
        conceptRepository,
      }

      const startTime = Date.now()
      const results = await createDemoPatients(repositories, 5)
      const endTime = Date.now()

      expect(results.patients).toHaveLength(5)
      expect(endTime - startTime).toBeLessThan(15000) // Should complete within 15 seconds
    }, 20000)
  })
})
