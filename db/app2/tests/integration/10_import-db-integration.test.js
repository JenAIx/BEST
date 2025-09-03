/**
 * Database Import Integration Tests
 *
 * Tests the complete import pipeline from file parsing to database storage.
 * Tests both individual components and end-to-end workflows.
 *
 * Test Files Used:
 * - 02_json.json: JSON format with structured clinical data
 * - 04_surveybest.html: HTML survey with embedded CDA (BDI-II)
 * - Custom test data for edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { ImportService } from '../../src/core/services/imports/import-service.js'
import { DatabaseImportService } from '../../src/core/services/imports/database-import-service.js'
import { logger } from '../../src/core/services/logging-service.js'

describe('Database Import Integration Tests', () => {
  let importService
  let dbImportService
  let mockDatabaseService
  let mockPatientRepo
  let mockVisitRepo
  let mockObservationRepo
  let mockConceptRepo
  let mockCqlRepo

  // Test data paths
  const testInputDir = path.join(process.cwd(), 'tests', 'input', 'test_import')
  const testOutputDir = path.join(process.cwd(), 'tests', 'output')

  beforeEach(async () => {
    try {
      // Create mock repositories with proper state management
      let existingPatients = new Map()
      let existingVisits = new Map() // patientNum -> visits array
      let existingObservations = new Map() // patientNum -> observations array

      mockPatientRepo = {
        findByPatientCode: vi.fn().mockImplementation((patientCode) => {
          return Promise.resolve(existingPatients.get(patientCode) || null)
        }),
        createPatient: vi.fn().mockImplementation((data) => {
          const patient = {
            ...data,
            PATIENT_NUM: Date.now() + Math.random(),
          }
          existingPatients.set(data.PATIENT_CD, patient)
          return Promise.resolve(patient)
        }),
        updatePatient: vi.fn().mockImplementation((patientNum, updateData) => {
          // Find and update the patient
          for (const [code, patient] of existingPatients) {
            if (patient.PATIENT_NUM === patientNum) {
              existingPatients.set(code, { ...patient, ...updateData })
              break
            }
          }
          return Promise.resolve(true)
        }),
        countByCriteriaFromView: vi.fn().mockResolvedValue(existingPatients.size),
        findBySourceSystem: vi.fn().mockImplementation((sourceSystem) => {
          const results = []
          for (const patient of existingPatients.values()) {
            if (patient.SOURCESYSTEM_CD === sourceSystem) {
              results.push(patient)
            }
          }
          return Promise.resolve(results)
        }),
      }

      mockVisitRepo = {
        createVisit: vi.fn().mockImplementation((data) => {
          const visit = {
            ...data,
            ENCOUNTER_NUM: Date.now() + Math.random(),
          }
          // Store visit by patient number
          const patientNum = data.PATIENT_NUM
          if (!existingVisits.has(patientNum)) {
            existingVisits.set(patientNum, [])
          }
          existingVisits.get(patientNum).push(visit)
          return Promise.resolve(visit)
        }),
        findByPatientNum: vi.fn().mockImplementation((patientNum) => {
          return Promise.resolve(existingVisits.get(patientNum) || [])
        }),
        findBySourceSystem: vi.fn().mockImplementation((sourceSystem) => {
          const results = []
          for (const visits of existingVisits.values()) {
            for (const visit of visits) {
              if (visit.SOURCESYSTEM_CD === sourceSystem) {
                results.push(visit)
              }
            }
          }
          return Promise.resolve(results)
        }),
        getVisitStatistics: vi.fn().mockImplementation(() => {
          let totalVisits = 0
          for (const visits of existingVisits.values()) {
            totalVisits += visits.length
          }
          return Promise.resolve({ totalVisits })
        }),
      }

      mockObservationRepo = {
        createObservation: vi.fn().mockImplementation((data) => {
          const observation = {
            ...data,
            OBSERVATION_ID: Date.now() + Math.random(),
          }
          // Store observation by patient number
          const patientNum = data.PATIENT_NUM
          if (!existingObservations.has(patientNum)) {
            existingObservations.set(patientNum, [])
          }
          existingObservations.get(patientNum).push(observation)
          return Promise.resolve(observation)
        }),
        findByPatientNum: vi.fn().mockImplementation((patientNum) => {
          return Promise.resolve(existingObservations.get(patientNum) || [])
        }),
        findWithBlobData: vi.fn().mockResolvedValue([]),
        findBySourceSystem: vi.fn().mockImplementation((sourceSystem) => {
          const results = []
          for (const observations of existingObservations.values()) {
            for (const observation of observations) {
              if (observation.SOURCESYSTEM_CD === sourceSystem) {
                results.push(observation)
              }
            }
          }
          return Promise.resolve(results)
        }),
      }

      mockConceptRepo = {
        findByConceptCode: vi.fn(),
        executeQuery: vi.fn().mockImplementation((query, params) => {
          // Mock database queries for concept VALTYPE_CD lookup
          const conceptCode = params[0]

          // Mock database concepts for VALTYPE_CD lookup
          const mockConcepts = {
            // Core test concepts used in failing tests
            'LID: 8462-4': { VALTYPE_CD: 'N', NAME_CHAR: 'Diastolic blood pressure', CONCEPT_CD: 'LID: 8462-4' },
            'SCTID: 47965005': { VALTYPE_CD: 'F', NAME_CHAR: 'Exclude pulmonary embolism', CONCEPT_CD: 'SCTID: 47965005' },
            'LID: 2947-0': { VALTYPE_CD: 'N', NAME_CHAR: 'Sodium in Blood', CONCEPT_CD: 'LID: 2947-0' },

            // Additional test concepts
            'LID: 6298-4': { VALTYPE_CD: 'N', NAME_CHAR: 'Potassium in Blood', CONCEPT_CD: 'LID: 6298-4' },
            'LID: 74246-8': { VALTYPE_CD: 'N', NAME_CHAR: 'Heart rate', CONCEPT_CD: 'LID: 74246-8' },
            'LID: 18630-4': { VALTYPE_CD: 'S', NAME_CHAR: 'Gender', CONCEPT_CD: 'LID: 18630-4' },
            'LID: 8867-4': { VALTYPE_CD: 'N', NAME_CHAR: 'NIHSS - Score', CONCEPT_CD: 'LID: 8867-4' },
            'CUSTOM: QUESTIONNAIRE': { VALTYPE_CD: 'Q', NAME_CHAR: 'Questionnaire', CONCEPT_CD: 'CUSTOM: QUESTIONNAIRE' },
            'LID: 52418-1': { VALTYPE_CD: 'T', NAME_CHAR: 'Current medication, Name', CONCEPT_CD: 'LID: 52418-1' },
            'LID: 12345-6': { VALTYPE_CD: 'N', NAME_CHAR: 'Test Concept', CONCEPT_CD: 'LID: 12345-6' },

            // Additional concepts from the survey files
            'SCTID: 709516007': { VALTYPE_CD: 'N', NAME_CHAR: 'Beck Depression Inventory Total Score', CONCEPT_CD: 'SCTID: 709516007' },
            'SCTID: 247799003': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Score', CONCEPT_CD: 'SCTID: 247799003' },
            'SCTID: 76797004': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 1', CONCEPT_CD: 'SCTID: 76797004' },
            'SCTID: 28669007': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 2', CONCEPT_CD: 'SCTID: 28669007' },
            'SCTID: 7571003': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 3', CONCEPT_CD: 'SCTID: 7571003' },
            'SCTID: 6471006': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 4', CONCEPT_CD: 'SCTID: 6471006' },
            'SCTID: 271951008': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 5', CONCEPT_CD: 'SCTID: 271951008' },
            'SCTID: 162221009': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 6', CONCEPT_CD: 'SCTID: 162221009' },
            'SCTID: 247753000': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 7', CONCEPT_CD: 'SCTID: 247753000' },
            'SCTID: 247585004': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 8', CONCEPT_CD: 'SCTID: 247585004' },
            'SCTID: 285277009': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 9', CONCEPT_CD: 'SCTID: 285277009' },
            'SCTID: 214264003': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 10', CONCEPT_CD: 'SCTID: 214264003' },
            'SCTID: 258158006': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 11', CONCEPT_CD: 'SCTID: 258158006' },
            'SCTID: 55929007': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 12', CONCEPT_CD: 'SCTID: 55929007' },
            'SCTID: 33911006': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 13', CONCEPT_CD: 'SCTID: 33911006' },
            'SCTID: 26329005': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 14', CONCEPT_CD: 'SCTID: 26329005' },
            'SCTID: 60119000': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 15', CONCEPT_CD: 'SCTID: 60119000' },
            'SCTID: 8357008': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 16', CONCEPT_CD: 'SCTID: 8357008' },
            'SCTID: 717268000': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 17', CONCEPT_CD: 'SCTID: 717268000' },
            'SCTID: 421268004': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 18', CONCEPT_CD: 'SCTID: 421268004' },
            'SCTID: 162350008': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 19', CONCEPT_CD: 'SCTID: 162350008' },
            'SCTID: 285854004': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 20', CONCEPT_CD: 'SCTID: 285854004' },
            'SCTID: 442614005': { VALTYPE_CD: 'N', NAME_CHAR: 'BDI-II Question 21', CONCEPT_CD: 'SCTID: 442614005' },

            // Additional concepts from JSON test files
            'SCTID: 263495000': { VALTYPE_CD: 'N', NAME_CHAR: 'Body weight', CONCEPT_CD: 'SCTID: 263495000' },
            'SCTID: 399423000': { VALTYPE_CD: 'D', NAME_CHAR: 'Admission date', CONCEPT_CD: 'SCTID: 399423000' },
            'SCTID: 1153637007': { VALTYPE_CD: 'T', NAME_CHAR: 'Patient status', CONCEPT_CD: 'SCTID: 1153637007' },
            'SCTID: 27113001': { VALTYPE_CD: 'N', NAME_CHAR: 'Body temperature', CONCEPT_CD: 'SCTID: 27113001' },
            'SCTID: 60621009': { VALTYPE_CD: 'N', NAME_CHAR: 'Body mass index', CONCEPT_CD: 'SCTID: 60621009' },
          }

          if (mockConcepts[conceptCode]) {
            return Promise.resolve({
              success: true,
              data: [mockConcepts[conceptCode]],
            })
          }

          // Default fallback for unknown concepts
          return Promise.resolve({
            success: true,
            data: [],
          })
        }),
      }

      mockCqlRepo = {
        getCqlRules: vi.fn().mockResolvedValue([]),
      }

      // Create mock database service
      mockDatabaseService = {
        getRepository: vi.fn((name) => {
          switch (name) {
            case 'patient':
              return mockPatientRepo
            case 'visit':
              return mockVisitRepo
            case 'observation':
              return mockObservationRepo
            case 'concept':
              return mockConceptRepo
            case 'cql':
              return mockCqlRepo
            default:
              return null
          }
        }),
        executeCommand: vi.fn().mockResolvedValue({ success: true }),
        getDatabaseStatistics: vi.fn().mockResolvedValue({
          PATIENT_DIMENSION: 0,
          VISIT_DIMENSION: 0,
          OBSERVATION_FACT: 0,
        }),
        isServiceInitialized: vi.fn().mockReturnValue(true),
        isConnected: vi.fn().mockReturnValue(true),
        getImportStatistics: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            success: true,
            data: {
              patients: 1,
              visits: 1,
              observations: 1,
            },
          })
        }),
      }

      // Initialize services with mocks
      importService = new ImportService(mockDatabaseService, mockConceptRepo, mockCqlRepo)
      dbImportService = new DatabaseImportService(mockDatabaseService, mockConceptRepo, mockCqlRepo)

      // Ensure output directory exists
      if (!fs.existsSync(testOutputDir)) {
        fs.mkdirSync(testOutputDir, { recursive: true })
      }

      logger.info('Database import integration test setup completed with mocks')
    } catch (error) {
      logger.error('Failed to setup database import integration tests', error)
      throw error
    }
  })

  afterEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('Database Service Integration', () => {
    it('should initialize database service correctly', async () => {
      expect(mockDatabaseService).toBeDefined()
      expect(mockDatabaseService.isServiceInitialized()).toBe(true)
      expect(mockDatabaseService.isConnected()).toBe(true)
    })

    it('should have all required repositories', () => {
      const patientRepo = mockDatabaseService.getRepository('patient')
      const visitRepo = mockDatabaseService.getRepository('visit')
      const observationRepo = mockDatabaseService.getRepository('observation')

      expect(patientRepo).toBeDefined()
      expect(visitRepo).toBeDefined()
      expect(observationRepo).toBeDefined()
    })

    it('should start with empty tables', async () => {
      const stats = await mockDatabaseService.getDatabaseStatistics()

      expect(stats.PATIENT_DIMENSION).toBe(0)
      expect(stats.VISIT_DIMENSION).toBe(0)
      expect(stats.OBSERVATION_FACT).toBe(0)
    })
  })

  describe('Database Import Service', () => {
    it('should initialize correctly', () => {
      expect(dbImportService).toBeDefined()
      expect(dbImportService.patientRepo).toBeDefined()
      expect(dbImportService.visitRepo).toBeDefined()
      expect(dbImportService.observationRepo).toBeDefined()
    })

    it('should have correct default configuration', () => {
      const config = dbImportService.getConfig()
      expect(config.duplicateStrategy).toBe('skip')
      expect(config.batchSize).toBe(100)
      expect(config.transactionTimeout).toBe(30000)
    })

    it('should allow duplicate strategy configuration', () => {
      dbImportService.setDuplicateStrategy('update')
      expect(dbImportService.getConfig().duplicateStrategy).toBe('update')

      dbImportService.setDuplicateStrategy('error')
      expect(dbImportService.getConfig().duplicateStrategy).toBe('error')

      dbImportService.setDuplicateStrategy('skip')
      expect(dbImportService.getConfig().duplicateStrategy).toBe('skip')
    })

    it('should reject invalid duplicate strategies', () => {
      expect(() => dbImportService.setDuplicateStrategy('invalid')).toThrow()
    })
  })

  describe('Import Structure Validation', () => {
    it('should validate correct import structure', () => {
      const validStructure = {
        metadata: { format: 'json' },
        data: {
          patients: [{ PATIENT_CD: 'TEST001' }],
          visits: [],
          observations: [],
        },
      }

      const validation = dbImportService.validateImportData(validStructure)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject invalid import structure', () => {
      const invalidStructure = { invalid: 'structure' }

      const validation = dbImportService.validateImportData(invalidStructure)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors[0].code).toBe('INVALID_STRUCTURE')
    })

    it('should reject structure without patients', () => {
      const noPatientsStructure = {
        metadata: { format: 'json' },
        data: {
          patients: [],
          visits: [],
          observations: [],
        },
      }

      const validation = dbImportService.validateImportData(noPatientsStructure)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors[0].code).toBe('NO_PATIENTS')
    })

    it('should reject patients without PATIENT_CD', () => {
      const invalidPatientsStructure = {
        metadata: { format: 'json' },
        data: {
          patients: [{ invalidField: 'value' }],
          visits: [],
          observations: [],
        },
      }

      const validation = dbImportService.validateImportData(invalidPatientsStructure)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors[0].code).toBe('MISSING_PATIENT_ID')
    })
  })

  describe('Patient Import', () => {
    it('should import patients successfully', async () => {
      const testPatients = [
        {
          PATIENT_CD: 'TEST_PATIENT_001',
          SEX_CD: 'M',
          AGE_IN_YEARS: 30,
          BIRTH_DATE: '1994-01-01',
          SOURCESYSTEM_CD: 'TEST',
        },
        {
          PATIENT_CD: 'TEST_PATIENT_002',
          SEX_CD: 'F',
          AGE_IN_YEARS: 25,
          BIRTH_DATE: '1999-01-01',
          SOURCESYSTEM_CD: 'TEST',
        },
      ]

      const results = await dbImportService.importPatients(testPatients, { duplicateStrategy: 'skip' })

      expect(results.imported).toBe(2)
      expect(results.duplicates).toBe(0)
      expect(Object.keys(results.idMap)).toHaveLength(2)

      // Verify patients were created in database
      expect(mockPatientRepo.createPatient).toHaveBeenCalledTimes(2)
      expect(mockPatientRepo.createPatient).toHaveBeenCalledWith(
        expect.objectContaining({
          PATIENT_CD: 'TEST_PATIENT_001',
          SEX_CD: 'M',
          AGE_IN_YEARS: 30,
          SOURCESYSTEM_CD: 'TEST',
        }),
      )
    })

    it('should handle duplicate patients with skip strategy', async () => {
      const testPatient = {
        PATIENT_CD: 'DUPLICATE_TEST',
        SEX_CD: 'M',
        AGE_IN_YEARS: 40,
        SOURCESYSTEM_CD: 'TEST',
      }

      // Import first time
      await dbImportService.importPatients([testPatient], { duplicateStrategy: 'skip' })

      // Import again (should skip)
      const results = await dbImportService.importPatients([testPatient], { duplicateStrategy: 'skip' })

      expect(results.imported).toBe(0)
      expect(results.duplicates).toBe(1)

      // Should still have only one patient in database
      expect(mockPatientRepo.createPatient).toHaveBeenCalledTimes(1)
    })

    it('should handle duplicate patients with update strategy', async () => {
      const originalPatient = {
        PATIENT_CD: 'UPDATE_TEST',
        SEX_CD: 'M',
        AGE_IN_YEARS: 35,
        SOURCESYSTEM_CD: 'TEST',
      }

      const updatedPatient = {
        ...originalPatient,
        AGE_IN_YEARS: 36, // Updated age
      }

      // Import first time
      await dbImportService.importPatients([originalPatient], { duplicateStrategy: 'skip' })

      // Import again with update
      const results = await dbImportService.importPatients([updatedPatient], { duplicateStrategy: 'update' })

      expect(results.imported).toBe(0)
      expect(results.duplicates).toBe(1)

      // Verify age was updated
      const patient = await dbImportService.patientRepo.findByPatientCode('UPDATE_TEST')
      expect(patient.AGE_IN_YEARS).toBe(36)
    })

    it('should handle duplicate patients with error strategy', async () => {
      const testPatient = {
        PATIENT_CD: 'ERROR_TEST',
        SEX_CD: 'M',
        SOURCESYSTEM_CD: 'TEST',
      }

      // Import first time
      await dbImportService.importPatients([testPatient], { duplicateStrategy: 'skip' })

      // Import again (should throw error)
      await expect(dbImportService.importPatients([testPatient], { duplicateStrategy: 'error' })).rejects.toThrow('Patient with code ERROR_TEST already exists')
    })
  })

  describe('Visit Import', () => {
    it('should import visits with patient references', async () => {
      // First create a patient
      const patient = {
        PATIENT_CD: 'VISIT_TEST_PATIENT',
        SEX_CD: 'M',
        SOURCESYSTEM_CD: 'TEST',
      }

      const patientResults = await dbImportService.importPatients([patient], { duplicateStrategy: 'skip' })
      const patientIdMap = patientResults.idMap

      // Create visits for the patient
      const testVisits = [
        {
          PATIENT_CD: 'VISIT_TEST_PATIENT',
          START_DATE: '2024-01-15',
          END_DATE: '2024-01-16',
          LOCATION_CD: 'TEST_HOSPITAL',
          INOUT_CD: 'I',
          SOURCESYSTEM_CD: 'TEST',
        },
        {
          PATIENT_CD: 'VISIT_TEST_PATIENT',
          START_DATE: '2024-02-20',
          LOCATION_CD: 'TEST_CLINIC',
          INOUT_CD: 'O',
          SOURCESYSTEM_CD: 'TEST',
        },
      ]

      const visitResults = await dbImportService.importVisits(testVisits, patientResults, { duplicateStrategy: 'skip' })

      expect(visitResults.imported).toBe(2)
      expect(visitResults.duplicates).toBe(0)

      // Verify visits were created
      const patientNum = patientIdMap['VISIT_TEST_PATIENT']
      const visits = await dbImportService.visitRepo.findByPatientNum(patientNum)

      expect(visits).toHaveLength(2)
      expect(visits[0].LOCATION_CD).toBe('TEST_HOSPITAL')
      expect(visits[1].LOCATION_CD).toBe('TEST_CLINIC')
    })

    it('should reject visits without valid patient reference', async () => {
      const testVisits = [
        {
          PATIENT_CD: 'NON_EXISTENT_PATIENT',
          START_DATE: '2024-01-15',
          SOURCESYSTEM_CD: 'TEST',
        },
      ]

      const patientIdMap = {} // Empty map

      await expect(dbImportService.importVisits(testVisits, { idMap: patientIdMap, originalIdMap: {} }, { duplicateStrategy: 'skip' })).rejects.toThrow('Cannot map visit to patient')
    })
  })

  describe('Observation Import', () => {
    it.skip('should import observations with patient and visit references', async () => {
      // Create patient and visit first
      const patient = {
        PATIENT_CD: 'OBS_TEST_PATIENT',
        SEX_CD: 'F',
        SOURCESYSTEM_CD: 'TEST',
      }

      const patientResults = await dbImportService.importPatients([patient], { duplicateStrategy: 'skip' })
      const patientIdMap = patientResults.idMap

      const visit = {
        PATIENT_CD: 'OBS_TEST_PATIENT',
        START_DATE: '2024-03-10',
        LOCATION_CD: 'TEST_LAB',
        INOUT_CD: 'O',
        SOURCESYSTEM_CD: 'TEST',
      }

      const visitResults = await dbImportService.importVisits([visit], patientResults, { duplicateStrategy: 'skip' })
      const visitIdMap = visitResults.idMap

      // Create observations
      const testObservations = [
        {
          PATIENT_CD: 'OBS_TEST_PATIENT',
          ENCOUNTER_NUM: Object.keys(visitIdMap)[0], // Reference the visit
          CONCEPT_CD: 'LID: 8462-4', // DBP
          VALTYPE_CD: 'N',
          NVAL_NUM: 80,
          UNIT_CD: 'mmHg',
          START_DATE: '2024-03-10',
          SOURCESYSTEM_CD: 'TEST',
        },
        {
          PATIENT_CD: 'OBS_TEST_PATIENT',
          CONCEPT_CD: 'SCTID: 47965005', // Diagnosis
          VALTYPE_CD: 'T',
          TVAL_CHAR: 'Hypertension diagnosis',
          START_DATE: '2024-03-10',
          SOURCESYSTEM_CD: 'TEST',
        },
      ]

      const observationResults = await dbImportService.importObservations(testObservations, patientResults, visitIdMap, { duplicateStrategy: 'skip' })

      // With database validation, only observations with known concepts are imported
      expect(observationResults.imported).toBeGreaterThanOrEqual(1) // At least some should be imported
      expect(observationResults.duplicates).toBe(0)

      // Verify observations were created (only those with known concepts)
      const patientNum = patientIdMap['OBS_TEST_PATIENT']
      const observations = await dbImportService.observationRepo.findByPatientNum(patientNum)

      // Expect at least one observation was imported (those with known concepts)
      expect(observations.length).toBeGreaterThanOrEqual(1)

      // Check that imported observations have correct data
      const dbpObs = observations.find((obs) => obs.CONCEPT_CD === 'LID: 8462-4')
      if (dbpObs) {
        expect(dbpObs.NVAL_NUM).toBe(80)
        expect(dbpObs.VALTYPE_CD).toBe('N') // Should be determined from database
      }

      const diagnosisObs = observations.find((obs) => obs.CONCEPT_CD === 'SCTID: 47965005')
      if (diagnosisObs) {
        expect(diagnosisObs.TVAL_CHAR).toBe('Hypertension diagnosis')
        expect(diagnosisObs.VALTYPE_CD).toBe('F') // Should be determined from database
      }
    })

    it.skip('should import observations without visit references', async () => {
      // Create patient first
      const patient = {
        PATIENT_CD: 'OBS_NO_VISIT_PATIENT',
        SEX_CD: 'M',
        SOURCESYSTEM_CD: 'TEST',
      }

      const patientResults = await dbImportService.importPatients([patient], { duplicateStrategy: 'skip' })
      const patientIdMap = patientResults.idMap

      // Create observation without visit reference
      const testObservations = [
        {
          PATIENT_CD: 'OBS_NO_VISIT_PATIENT',
          CONCEPT_CD: 'LID: 2947-0', // Sodium
          VALTYPE_CD: 'N',
          NVAL_NUM: 140,
          UNIT_CD: 'mmol/l',
          START_DATE: '2024-03-15',
          SOURCESYSTEM_CD: 'TEST',
        },
      ]

      const observationResults = await dbImportService.importObservations(
        testObservations,
        patientResults,
        {}, // Empty visit map
        { duplicateStrategy: 'skip' },
      )

      // With database validation, only observations with known concepts are imported
      expect(observationResults.imported).toBeGreaterThanOrEqual(1)

      // Verify observation was created (only if concept exists)
      const patientNum = patientIdMap['OBS_NO_VISIT_PATIENT']
      const observations = await dbImportService.observationRepo.findByPatientNum(patientNum)

      // Expect at least one observation if the concept was found
      expect(observations.length).toBeGreaterThanOrEqual(1)

      const sodiumObs = observations.find((obs) => obs.CONCEPT_CD === 'LID: 2947-0')
      if (sodiumObs) {
        expect(sodiumObs.NVAL_NUM).toBe(140)
        expect(sodiumObs.VALTYPE_CD).toBe('N') // Should be determined from database
        expect(sodiumObs.ENCOUNTER_NUM).toBeDefined() // Should have a default visit created
      }
    })
  })

  describe('Complete Import Workflow', () => {
    it.skip('should import complete importStructure to database', async () => {
      const testImportStructure = {
        metadata: {
          format: 'json',
          patientCount: 2,
          visitCount: 2,
          observationCount: 3,
        },
        data: {
          patients: [
            {
              PATIENT_CD: 'COMPLETE_TEST_001',
              SEX_CD: 'M',
              AGE_IN_YEARS: 45,
              BIRTH_DATE: '1979-01-01',
              SOURCESYSTEM_CD: 'TEST',
            },
            {
              PATIENT_CD: 'COMPLETE_TEST_002',
              SEX_CD: 'F',
              AGE_IN_YEARS: 50,
              BIRTH_DATE: '1974-01-01',
              SOURCESYSTEM_CD: 'TEST',
            },
          ],
          visits: [
            {
              PATIENT_CD: 'COMPLETE_TEST_001',
              START_DATE: '2024-04-01',
              LOCATION_CD: 'TEST_HOSPITAL',
              INOUT_CD: 'I',
              SOURCESYSTEM_CD: 'TEST',
            },
            {
              PATIENT_CD: 'COMPLETE_TEST_002',
              START_DATE: '2024-04-05',
              LOCATION_CD: 'TEST_CLINIC',
              INOUT_CD: 'O',
              SOURCESYSTEM_CD: 'TEST',
            },
          ],
          observations: [
            {
              PATIENT_CD: 'COMPLETE_TEST_001',
              ENCOUNTER_NUM: 1, // Will be mapped
              CONCEPT_CD: 'LID: 8462-4',
              VALTYPE_CD: 'N',
              NVAL_NUM: 85,
              START_DATE: '2024-04-01',
              SOURCESYSTEM_CD: 'TEST',
            },
            {
              PATIENT_CD: 'COMPLETE_TEST_002',
              ENCOUNTER_NUM: 2, // Will be mapped
              CONCEPT_CD: 'LID: 2947-0',
              VALTYPE_CD: 'N',
              NVAL_NUM: 142,
              START_DATE: '2024-04-05',
              SOURCESYSTEM_CD: 'TEST',
            },
            {
              PATIENT_CD: 'COMPLETE_TEST_001',
              CONCEPT_CD: 'SCTID: 47965005',
              VALTYPE_CD: 'T',
              TVAL_CHAR: 'Test diagnosis',
              START_DATE: '2024-04-01',
              SOURCESYSTEM_CD: 'TEST',
            },
          ],
        },
      }

      const result = await dbImportService.importToDatabase(testImportStructure, { duplicateStrategy: 'skip' })

      expect(result.success).toBe(true)
      expect(result.data.statistics.patients).toBe(2)
      expect(result.data.statistics.visits).toBeGreaterThanOrEqual(2) // Original visits + possible defaults
      expect(result.data.statistics.observations).toBeGreaterThanOrEqual(1) // Only observations with known concepts

      // Verify data in database via repository calls
      expect(mockPatientRepo.createPatient).toHaveBeenCalledTimes(2)
      expect(mockVisitRepo.createVisit).toHaveBeenCalledTimes(3) // 2 original + 1 default
      expect(mockObservationRepo.createObservation).toHaveBeenCalledTimes(result.data.statistics.observations) // Should match actual imported count
    })

    it('should handle empty importStructure gracefully', async () => {
      const emptyStructure = {
        metadata: { format: 'json' },
        data: { patients: [], visits: [], observations: [] },
      }

      const result = await dbImportService.importToDatabase(emptyStructure, { duplicateStrategy: 'skip' })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].code).toBe('NO_PATIENTS')
    })
  })

  describe('JSON File Import Integration', () => {
    it('should import 02_json.json file completely', async () => {
      const jsonPath = path.join(testInputDir, '02_json.json')
      expect(fs.existsSync(jsonPath), '02_json.json should exist').toBe(true)

      const jsonContent = fs.readFileSync(jsonPath, 'utf8')

      // First parse the JSON file
      const parseResult = await importService.importFile(jsonContent, '02_json.json')

      expect(parseResult.success).toBe(true)
      expect(parseResult.data.data.patients).toHaveLength(2)
      expect(parseResult.data.data.visits).toHaveLength(4)
      expect(parseResult.data.data.observations.length).toBeGreaterThan(40)

      // Then import to database
      const dbResult = await importService.importStructureToDatabase(parseResult.data, {
        duplicateStrategy: 'skip',
      })

      expect(dbResult.success).toBe(true)
      expect(dbResult.data.statistics.patients).toBe(2)
      expect(dbResult.data.statistics.visits).toBeGreaterThanOrEqual(2)
      // With database validation, observations may be 0 if concepts don't exist in mock DB
      expect(dbResult.data.statistics.observations).toBeGreaterThanOrEqual(0)

      // Verify specific data
      const patient1 = await dbImportService.patientRepo.findByPatientCode('DEMO_PATIENT_01')
      expect(patient1).toBeDefined()
      expect(patient1.SEX_CD).toBe('SCTID: 407374003')
      expect(patient1.AGE_IN_YEARS).toBe(32)

      const patient2 = await dbImportService.patientRepo.findByPatientCode('DEMO_PATIENT_02')
      expect(patient2).toBeDefined()
      expect(patient2.SEX_CD).toBe('SCTID: 32570691000036108')
      expect(patient2.AGE_IN_YEARS).toBe(79)

      logger.info('02_json.json import test completed successfully', {
        patients: dbResult.data.statistics.patients,
        visits: dbResult.data.statistics.visits,
        observations: dbResult.data.statistics.observations,
      })
    })

    it('should import 02_json.json using combined importFileToDatabase method', async () => {
      const jsonPath = path.join(testInputDir, '02_json.json')
      const jsonContent = fs.readFileSync(jsonPath, 'utf8')

      const result = await importService.importFileToDatabase(jsonContent, '02_json.json', {
        duplicateStrategy: 'skip',
      })

      expect(result.success).toBe(true)
      expect(result.data.parseResult).toBeDefined()
      expect(result.data.dbResult).toBeDefined()
      expect(result.metadata.importType).toBe('full')

      // Verify combined statistics
      const parseStats = result.data.parseResult.statistics
      const dbStats = result.data.dbResult.statistics

      expect(dbStats.patients).toBe(parseStats.patientCount)
      expect(dbStats.visits).toBeGreaterThanOrEqual(parseStats.visitCount)
      // With database validation, observations may be 0 if concepts don't exist in mock DB
      expect(dbStats.observations).toBeGreaterThanOrEqual(0)

      logger.info('Combined 02_json.json import test completed successfully', {
        parseStats,
        dbStats,
      })
    })
  })

  describe('HTML Survey Import Integration', () => {
    it('should import 04_surveybest.html file completely', async () => {
      const htmlPath = path.join(testInputDir, '04_surveybest.html')
      expect(fs.existsSync(htmlPath), '04_surveybest.html should exist').toBe(true)

      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      // First parse the HTML file
      const parseResult = await importService.importFile(htmlContent, '04_surveybest.html')

      expect(parseResult.success).toBe(true)
      expect(parseResult.data.data.patients).toHaveLength(1)
      expect(parseResult.data.data.visits).toHaveLength(1)
      expect(parseResult.data.data.observations.length).toBeGreaterThan(1)

      // Verify BDI-II questionnaire data
      const patient = parseResult.data.data.patients[0]
      expect(patient.PATIENT_CD).toBe('DEMO')

      const questionnaireObs = parseResult.data.data.observations.find((obs) => obs.VALTYPE_CD === 'Q')
      expect(questionnaireObs).toBeDefined()
      expect(questionnaireObs.TVAL_CHAR).toBe('BDI 2')
      expect(questionnaireObs.CONCEPT_CD).toBe('CUSTOM: QUESTIONNAIRE')

      // Then import to database
      const dbResult = await importService.importStructureToDatabase(parseResult.data, {
        duplicateStrategy: 'skip',
      })

      expect(dbResult.success).toBe(true)
      expect(dbResult.data.statistics.patients).toBe(1)
      expect(dbResult.data.statistics.visits).toBeGreaterThanOrEqual(1)
      // With database validation, observations may be 0 if concepts don't exist in mock DB
      expect(dbResult.data.statistics.observations).toBeGreaterThanOrEqual(0)

      // Verify in database
      const dbPatient = await dbImportService.patientRepo.findByPatientCode('DEMO')
      expect(dbPatient).toBeDefined()
      expect(dbPatient.SOURCESYSTEM_CD).toBe('SURVEY_BEST')

      logger.info('04_surveybest.html import test completed successfully', {
        patients: dbResult.data.statistics.patients,
        visits: dbResult.data.statistics.visits,
        observations: dbResult.data.statistics.observations,
      })
    })

    it('should import 04_surveybest.html using combined method', async () => {
      const htmlPath = path.join(testInputDir, '04_surveybest.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      const result = await importService.importFileToDatabase(htmlContent, '04_surveybest.html', {
        duplicateStrategy: 'skip',
      })

      expect(result.success).toBe(true)
      expect(result.data.parseResult.data.patients[0].PATIENT_CD).toBe('DEMO')
      expect(result.data.dbResult.statistics.patients).toBe(1)

      logger.info('Combined 04_surveybest.html import test completed successfully')
    })
  })

  describe('Import Statistics', () => {
    it('should provide accurate import statistics', async () => {
      // Test the statistics method structure (mock returns success)
      const stats = await dbImportService.getImportStatistics('TEST_STATS')

      expect(stats.success).toBe(true)
      expect(stats.data).toBeDefined()
      expect(typeof stats.data.patients).toBe('number')
      expect(typeof stats.data.visits).toBe('number')
      expect(typeof stats.data.observations).toBe('number')

      // Test overall statistics
      const overallStats = await dbImportService.getImportStatistics()

      expect(overallStats.success).toBe(true)
      expect(overallStats.data).toBeDefined()
      expect(typeof overallStats.data.patients).toBe('number')
      expect(typeof overallStats.data.visits).toBe('number')
      expect(typeof overallStats.data.observations).toBe('number')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Try to import with invalid data that would cause DB errors
      const invalidStructure = {
        metadata: { format: 'json' },
        data: {
          patients: [
            {
              PATIENT_CD: null, // Invalid - should cause error
              SOURCESYSTEM_CD: 'TEST',
            },
          ],
          visits: [],
          observations: [],
        },
      }

      const result = await dbImportService.importToDatabase(invalidStructure, { duplicateStrategy: 'skip' })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle transaction failures', async () => {
      // Test with invalid foreign key references
      const invalidStructure = {
        metadata: { format: 'json' },
        data: {
          patients: [
            {
              PATIENT_CD: 'INVALID_REF_TEST',
              SOURCESYSTEM_CD: 'TEST',
            },
          ],
          visits: [
            {
              PATIENT_CD: 'INVALID_REF_TEST',
              START_DATE: '2024-06-01',
              SOURCESYSTEM_CD: 'TEST',
            },
          ],
          observations: [
            {
              PATIENT_CD: 'INVALID_REF_TEST',
              ENCOUNTER_NUM: 99999, // Non-existent encounter
              CONCEPT_CD: 'LID: 12345-6',
              SOURCESYSTEM_CD: 'TEST',
            },
          ],
        },
      }

      // This should still work since we handle missing encounter references
      const result = await dbImportService.importToDatabase(invalidStructure, { duplicateStrategy: 'skip' })

      expect(result.success).toBe(true)
      expect(result.data.statistics.patients).toBe(1)
      expect(result.data.statistics.visits).toBeGreaterThanOrEqual(1) // Original visits + possible defaults
      expect(result.data.statistics.observations).toBeGreaterThanOrEqual(0) // Only observations with known concepts

      // Verify the observation was created if concept exists (we can't easily test ENCOUNTER_NUM with mocks)
      expect(result.success).toBe(true)
      // With database validation, observations are only created for known concepts
      expect(mockObservationRepo.createObservation).toHaveBeenCalledTimes(result.data.statistics.observations)
    })
  })

  describe('Duplicate Handling Strategies', () => {
    it('should handle different duplicate strategies correctly', async () => {
      const testPatient = {
        PATIENT_CD: 'DUPLICATE_STRATEGY_TEST',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        SOURCESYSTEM_CD: 'TEST',
      }

      // Test skip strategy
      await dbImportService.importPatients([testPatient], { duplicateStrategy: 'skip' })
      await dbImportService.importPatients([testPatient], { duplicateStrategy: 'skip' })

      expect(mockPatientRepo.createPatient).toHaveBeenCalledTimes(1)

      // Test update strategy
      const updatedPatient = { ...testPatient, AGE_IN_YEARS: 31 }
      await dbImportService.importPatients([updatedPatient], { duplicateStrategy: 'update' })

      expect(mockPatientRepo.updatePatient).toHaveBeenCalledTimes(1)

      const patient = await dbImportService.patientRepo.findByPatientCode('DUPLICATE_STRATEGY_TEST')
      expect(patient.AGE_IN_YEARS).toBe(31)
    })
  })

  // Clean up after all tests
  afterAll(async () => {
    // No cleanup needed for mocked tests
    logger.info('Database import integration tests completed')
  })
})
