/**
 * Integration Tests for Real SQLite Database
 * Tests actual database creation, CRUD operations, and data retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import PatientRepository from '../../src/core/database/repositories/patient-repository.js'
import { currentSchema } from '../../src/core/database/migrations/002-current-schema.js'
import { addNoteFactColumns } from '../../src/core/database/migrations/003-add-note-fact-columns.js'
import { createPatientListView } from '../../src/core/database/migrations/005-create-patient-list-view.js'

describe('Real SQLite Integration Tests', () => {
  let connection
  let migrationManager
  let patientRepository
  let testDbPath

  beforeAll(async () => {
    // Create a single test database for all tests
    testDbPath = global.__TEST_DB_PATH__ || `./tests/output/test-db-shared.db`

    // Ensure output directory exists
    const outputDir = path.dirname(testDbPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Clean up existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    connection = new RealSQLiteConnection()
    migrationManager = new MigrationManager(connection)
    patientRepository = new PatientRepository(connection)

    // Connect and initialize database once for all tests
    await connection.connect(testDbPath)
    migrationManager.registerMigration(currentSchema)
    migrationManager.registerMigration(addNoteFactColumns)
    migrationManager.registerMigration(createPatientListView)
    await migrationManager.initializeDatabase()
  })

  afterAll(async () => {
    if (connection && connection.getStatus()) {
      await connection.disconnect()
    }

    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  beforeEach(async () => {
    // Clean up any test data from previous tests
    if (connection && connection.getStatus()) {
      // Clear test data but keep schema
      await connection.executeCommand('DELETE FROM OBSERVATION_FACT')
      await connection.executeCommand('DELETE FROM VISIT_DIMENSION')
      await connection.executeCommand('DELETE FROM PATIENT_DIMENSION')
      await connection.executeCommand('DELETE FROM CONCEPT_DIMENSION')
      await connection.executeCommand('DELETE FROM CQL_FACT')
      await connection.executeCommand('DELETE FROM CONCEPT_CQL_LOOKUP')
      await connection.executeCommand('DELETE FROM USER_MANAGEMENT')

      // Reset auto-increment counters
      await connection.executeCommand('DELETE FROM sqlite_sequence')
    }
  })

  describe('Database Creation and Connection', () => {
    it('should create a new database file and connect successfully', async () => {
      // Database already connected in beforeAll
      expect(connection.getStatus()).toBe(true)
      expect(connection.getFilePath()).toBe(testDbPath)

      // Database file should exist
      expect(connection.databaseExists()).toBe(true)

      // Test connection
      const connectionTest = await connection.testConnection()
      expect(connectionTest).toBe(true)
    })

    it('should handle connection to existing database', async () => {
      // Database already connected in beforeAll
      expect(connection.getStatus()).toBe(true)

      // Disconnect
      await connection.disconnect()
      expect(connection.getStatus()).toBe(false)

      // Reconnect to existing database
      const result = await connection.connect(testDbPath)
      expect(result).toBe(true)
      expect(connection.getStatus()).toBe(true)
    })

    it('should get database file size', async () => {
      // Database already initialized in beforeAll

      const size = await connection.getDatabaseSize()
      expect(size).toBeGreaterThan(0)
      expect(size).toBeLessThan(500000) // Should be less than 500KB initially (tables + indexes)
    })
  })

  describe('Schema Migration', () => {
    it('should create all tables from current schema migration', async () => {
      // Database already initialized in beforeAll

      // Verify all tables were created
      const tables = await connection.executeQuery(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)

      expect(tables.success).toBe(true)
      expect(tables.data.length).toBeGreaterThan(0)

      // Check for key tables
      const tableNames = tables.data.map((row) => row.name)
      expect(tableNames).toContain('PATIENT_DIMENSION')
      expect(tableNames).toContain('VISIT_DIMENSION')
      expect(tableNames).toContain('OBSERVATION_FACT')
      expect(tableNames).toContain('CONCEPT_DIMENSION')
      expect(tableNames).toContain('PROVIDER_DIMENSION')
      expect(tableNames).toContain('CODE_LOOKUP')
      expect(tableNames).toContain('USER_MANAGEMENT')
      expect(tableNames).toContain('USER_PATIENT_LOOKUP')
      expect(tableNames).toContain('CQL_FACT')
      expect(tableNames).toContain('CONCEPT_CQL_LOOKUP')
      expect(tableNames).toContain('NOTE_FACT')
    })

    it('should create proper indexes', async () => {
      // Database already initialized in beforeAll

      // Check for key indexes
      const indexes = await connection.executeQuery(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
        ORDER BY name
      `)

      expect(indexes.success).toBe(true)
      expect(indexes.data.length).toBeGreaterThan(0)

      const indexNames = indexes.data.map((row) => row.name)
      expect(indexNames).toContain('idx_patient_patient_cd')
      expect(indexNames).toContain('idx_patient_vital_status')
      expect(indexNames).toContain('idx_patient_sex')
      expect(indexNames).toContain('idx_visit_patient_num')
      expect(indexNames).toContain('idx_observation_patient_num')
    })

    it('should enforce foreign key constraints', async () => {
      // Database already initialized in beforeAll

      // Verify foreign keys are enabled
      const pragma = await connection.executeQuery('PRAGMA foreign_keys')
      expect(pragma.success).toBe(true)
      expect(pragma.data[0].foreign_keys).toBe(1)
    })
  })

  describe('Patient CRUD Operations', () => {
    beforeEach(async () => {
      await connection.connect(testDbPath)
      migrationManager.registerMigration(currentSchema)
      migrationManager.registerMigration(addNoteFactColumns)
      await migrationManager.initializeDatabase()
    })

    it('should create a new patient successfully', async () => {
      const patientData = {
        PATIENT_CD: 'TEST001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        LANGUAGE_CD: 'EN',
        RACE_CD: 'UNK',
        MARITAL_STATUS_CD: 'UNK',
        RELIGION_CD: 'UNK',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      }

      const result = await patientRepository.createPatient(patientData)

      expect(result).toMatchObject(patientData)
      expect(result).toHaveProperty('PATIENT_NUM')
      expect(typeof result.PATIENT_NUM).toBe('number')
      expect(result.PATIENT_NUM).toBeGreaterThan(0)

      // Verify patient was actually stored in database
      const storedPatient = await patientRepository.findByPatientCode('TEST001')
      expect(storedPatient).toMatchObject(patientData)
    })

    it('should create multiple patients and retrieve them', async () => {
      const patients = [
        {
          PATIENT_CD: 'TEST001',
          SEX_CD: 'M',
          AGE_IN_YEARS: 30,
          VITAL_STATUS_CD: 'A',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PATIENT_CD: 'TEST002',
          SEX_CD: 'F',
          AGE_IN_YEARS: 25,
          VITAL_STATUS_CD: 'A',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
        {
          PATIENT_CD: 'TEST003',
          SEX_CD: 'M',
          AGE_IN_YEARS: 45,
          VITAL_STATUS_CD: 'I',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        },
      ]

      // Create all patients
      const createdPatients = []
      for (const patientData of patients) {
        const result = await patientRepository.createPatient(patientData)
        createdPatients.push(result)
      }

      expect(createdPatients).toHaveLength(3)

      // Retrieve all patients
      const allPatients = await patientRepository.findAll()
      expect(allPatients).toHaveLength(3)

      // Verify each patient was stored correctly
      for (const patient of patients) {
        const stored = await patientRepository.findByPatientCode(patient.PATIENT_CD)
        expect(stored).toMatchObject(patient)
      }
    })

    it('should find patients by criteria', async () => {
      // Create test patients
      await patientRepository.createPatient({
        PATIENT_CD: 'MALE001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      await patientRepository.createPatient({
        PATIENT_CD: 'FEMALE001',
        SEX_CD: 'F',
        AGE_IN_YEARS: 25,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      await patientRepository.createPatient({
        PATIENT_CD: 'MALE002',
        SEX_CD: 'M',
        AGE_IN_YEARS: 35,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Find male patients
      const malePatients = await patientRepository.findBySex('M')
      expect(malePatients).toHaveLength(2)
      expect(malePatients.every((p) => p.SEX_CD === 'M')).toBe(true)

      // Find patients by age range
      const youngPatients = await patientRepository.findByAgeRange(20, 30)
      expect(youngPatients).toHaveLength(2)
      expect(youngPatients.every((p) => p.AGE_IN_YEARS >= 20 && p.AGE_IN_YEARS <= 30)).toBe(true)

      // Find patients by vital status
      const activePatients = await patientRepository.findByVitalStatus('A')
      expect(activePatients).toHaveLength(3)
      expect(activePatients.every((p) => p.VITAL_STATUS_CD === 'A')).toBe(true)
    })

    it('should update patient information', async () => {
      // Create a patient
      const patient = await patientRepository.createPatient({
        PATIENT_CD: 'UPDATE001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Update the patient
      const updateResult = await patientRepository.update(patient.PATIENT_NUM, {
        AGE_IN_YEARS: 31,
        VITAL_STATUS_CD: 'I',
      })

      expect(updateResult).toBe(true)

      // Verify the update
      const updatedPatient = await patientRepository.findById(patient.PATIENT_NUM)
      expect(updatedPatient.AGE_IN_YEARS).toBe(31)
      expect(updatedPatient.VITAL_STATUS_CD).toBe('I')
      expect(updatedPatient.SEX_CD).toBe('M') // Should remain unchanged
    })

    it('should delete a patient', async () => {
      // Create a patient
      const patient = await patientRepository.createPatient({
        PATIENT_CD: 'DELETE001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Verify patient exists
      const foundPatient = await patientRepository.findById(patient.PATIENT_NUM)
      expect(foundPatient).toBeTruthy()

      // Delete the patient
      const deleteResult = await patientRepository.delete(patient.PATIENT_NUM)
      expect(deleteResult).toBe(true)

      // Verify patient is deleted
      const deletedPatient = await patientRepository.findById(patient.PATIENT_NUM)
      expect(deletedPatient).toBe(null)
    })

    it('should handle complex criteria searches', async () => {
      // Create diverse test data
      await patientRepository.createPatient({
        PATIENT_CD: 'COMPLEX001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        LANGUAGE_CD: 'EN',
        RACE_CD: 'CAUC',
        MARITAL_STATUS_CD: 'M',
        RELIGION_CD: 'CHR',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      await patientRepository.createPatient({
        PATIENT_CD: 'COMPLEX002',
        SEX_CD: 'F',
        AGE_IN_YEARS: 25,
        VITAL_STATUS_CD: 'A',
        LANGUAGE_CD: 'SP',
        RACE_CD: 'HISP',
        MARITAL_STATUS_CD: 'S',
        RELIGION_CD: 'CHR',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Search with multiple criteria
      const criteria = {
        vitalStatus: 'A',
        sex: 'M',
        ageRange: { min: 25, max: 35 },
        language: 'EN',
        race: 'CAUC',
        maritalStatus: 'M',
      }

      const results = await patientRepository.findPatientsByCriteria(criteria)
      expect(results).toHaveLength(1)
      expect(results[0].PATIENT_CD).toBe('COMPLEX001')
    })

    it('should get patient statistics', async () => {
      // Create test patients
      await patientRepository.createPatient({
        PATIENT_CD: 'STAT001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      await patientRepository.createPatient({
        PATIENT_CD: 'STAT002',
        SEX_CD: 'F',
        AGE_IN_YEARS: 25,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      await patientRepository.createPatient({
        PATIENT_CD: 'STAT003',
        SEX_CD: 'M',
        AGE_IN_YEARS: 35,
        VITAL_STATUS_CD: 'I',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      const stats = await patientRepository.getPatientStatistics()

      expect(stats.totalPatients).toBe(3)
      expect(stats.byVitalStatus).toHaveLength(2)
      expect(stats.bySex).toHaveLength(2)
      expect(stats.averageAge).toBe(30) // (30 + 25 + 35) / 3 = 30

      // Check vital status breakdown
      const activeStatus = stats.byVitalStatus.find((s) => s.VITAL_STATUS_CD === 'A')
      const inactiveStatus = stats.byVitalStatus.find((s) => s.VITAL_STATUS_CD === 'I')
      expect(activeStatus.count).toBe(2)
      expect(inactiveStatus.count).toBe(1)

      // Check sex breakdown
      const maleCount = stats.bySex.find((s) => s.SEX_CD === 'M')
      const femaleCount = stats.bySex.find((s) => s.SEX_CD === 'F')
      expect(maleCount.count).toBe(2)
      expect(femaleCount.count).toBe(1)
    })

    it('should search patients by text', async () => {
      // Create patients with different characteristics
      await patientRepository.createPatient({
        PATIENT_CD: 'SEARCH001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      await patientRepository.createPatient({
        PATIENT_CD: 'SEARCH002',
        SEX_CD: 'F',
        AGE_IN_YEARS: 25,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Search by patient code
      const searchResults = await patientRepository.searchPatients('SEARCH')
      expect(searchResults).toHaveLength(2)

      // Search by specific patient code
      const specificResults = await patientRepository.searchPatients('SEARCH001')
      expect(specificResults).toHaveLength(1)
      expect(specificResults[0].PATIENT_CD).toBe('SEARCH001')
    })

    it('should handle pagination correctly', async () => {
      // Create 25 test patients
      for (let i = 1; i <= 25; i++) {
        await patientRepository.createPatient({
          PATIENT_CD: `PAGE${i.toString().padStart(3, '0')}`,
          SEX_CD: i % 2 === 0 ? 'F' : 'M',
          AGE_IN_YEARS: 20 + (i % 30),
          VITAL_STATUS_CD: 'A',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        })
      }

      // Test first page
      const page1 = await patientRepository.getPatientsPaginated(1, 10)
      expect(page1.patients).toHaveLength(10)
      expect(page1.pagination.currentPage).toBe(1)
      expect(page1.pagination.pageSize).toBe(10)
      expect(page1.pagination.totalCount).toBe(25)
      expect(page1.pagination.totalPages).toBe(3)
      expect(page1.pagination.hasNextPage).toBe(true)
      expect(page1.pagination.hasPreviousPage).toBe(false)

      // Test second page
      const page2 = await patientRepository.getPatientsPaginated(2, 10)
      expect(page2.patients).toHaveLength(10)
      expect(page2.pagination.currentPage).toBe(2)
      expect(page2.pagination.hasNextPage).toBe(true)
      expect(page2.pagination.hasPreviousPage).toBe(true)

      // Test last page
      const page3 = await patientRepository.getPatientsPaginated(3, 10)
      expect(page3.patients).toHaveLength(5)
      expect(page3.pagination.currentPage).toBe(3)
      expect(page3.pagination.hasNextPage).toBe(false)
      expect(page3.pagination.hasPreviousPage).toBe(true)
    })
  })

  describe('Database Integrity', () => {
    beforeEach(async () => {
      await connection.connect(testDbPath)
      migrationManager.registerMigration(currentSchema)
      migrationManager.registerMigration(addNoteFactColumns)
      await migrationManager.initializeDatabase()
    })

    it('should enforce unique constraints', async () => {
      // Create first patient
      await patientRepository.createPatient({
        PATIENT_CD: 'UNIQUE001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Try to create second patient with same PATIENT_CD
      await expect(
        patientRepository.createPatient({
          PATIENT_CD: 'UNIQUE001', // Duplicate!
          SEX_CD: 'F',
          AGE_IN_YEARS: 25,
          VITAL_STATUS_CD: 'A',
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        }),
      ).rejects.toThrow()
    })

    it('should handle foreign key constraints', async () => {
      // Create a patient
      const patient = await patientRepository.createPatient({
        PATIENT_CD: 'FK001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        SOURCESYSTEM_CD: 'TEST',
        UPLOAD_ID: 1,
      })

      // Create a visit for the patient
      const visitResult = await connection.executeCommand(
        'INSERT INTO VISIT_DIMENSION (ENCOUNTER_NUM, PATIENT_NUM, ACTIVE_STATUS_CD, START_DATE, SOURCESYSTEM_CD, UPLOAD_ID) VALUES (?, ?, ?, ?, ?, ?)',
        [1, patient.PATIENT_NUM, 'A', Date.now(), 'TEST', 1],
      )
      expect(visitResult.success).toBe(true)

      // Create a concept
      const conceptResult = await connection.executeCommand('INSERT INTO CONCEPT_DIMENSION (CONCEPT_CD, NAME_CHAR, SOURCESYSTEM_CD, UPLOAD_ID) VALUES (?, ?, ?, ?)', [
        'TEST_CONCEPT',
        'Test Concept',
        'TEST',
        1,
      ])
      expect(conceptResult.success).toBe(true)

      // Try to create an observation with non-existent patient (should fail)
      await expect(connection.executeCommand('INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD) VALUES (?, ?, ?)', [999, 999, 'NONEXISTENT'])).rejects.toThrow()

      // Create a valid observation (should succeed)
      const observationResult = await connection.executeCommand('INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD) VALUES (?, ?, ?)', [1, patient.PATIENT_NUM, 'TEST_CONCEPT'])

      expect(observationResult.success).toBe(true)
    })

    it('should handle transactions correctly', async () => {
      // Test successful transaction
      const commands = [
        {
          sql: 'INSERT INTO PATIENT_DIMENSION (PATIENT_CD, SEX_CD, AGE_IN_YEARS, VITAL_STATUS_CD, SOURCESYSTEM_CD, UPLOAD_ID) VALUES (?, ?, ?, ?, ?, ?)',
          params: ['TXN001', 'M', 30, 'A', 'TEST', 1],
        },
        {
          sql: 'INSERT INTO PATIENT_DIMENSION (PATIENT_CD, SEX_CD, AGE_IN_YEARS, VITAL_STATUS_CD, SOURCESYSTEM_CD, UPLOAD_ID) VALUES (?, ?, ?, ?, ?, ?)',
          params: ['TXN002', 'F', 25, 'A', 'TEST', 1],
        },
      ]

      const transactionResult = await connection.executeTransaction(commands)
      expect(transactionResult.success).toBe(true)
      expect(transactionResult.results).toHaveLength(2)

      // Verify both patients were created
      const patient1 = await patientRepository.findByPatientCode('TXN001')
      const patient2 = await patientRepository.findByPatientCode('TXN002')
      expect(patient1).toBeTruthy()
      expect(patient2).toBeTruthy()

      // Test failed transaction (should rollback)
      const failingCommands = [
        {
          sql: 'INSERT INTO PATIENT_DIMENSION (PATIENT_CD, SEX_CD, AGE_IN_YEARS, VITAL_STATUS_CD, SOURCESYSTEM_CD, UPLOAD_ID) VALUES (?, ?, ?, ?, ?, ?)',
          params: ['TXN003', 'M', 35, 'A', 'TEST', 1],
        },
        {
          sql: 'INSERT INTO PATIENT_DIMENSION (PATIENT_CD, SEX_CD, AGE_IN_YEARS, VITAL_STATUS_CD, SOURCESYSTEM_CD, UPLOAD_ID) VALUES (?, ?, ?, ?, ?, ?)',
          params: ['TXN001', 'F', 28, 'A', 'TEST', 1], // Duplicate PATIENT_CD - should fail
        },
      ]

      await expect(connection.executeTransaction(failingCommands)).rejects.toThrow()

      // Verify the third patient was not created (rollback worked)
      const patient3 = await patientRepository.findByPatientCode('TXN003')
      expect(patient3).toBe(null)
    })
  })

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await connection.connect(testDbPath)
      migrationManager.registerMigration(currentSchema)
      migrationManager.registerMigration(addNoteFactColumns)
      await migrationManager.initializeDatabase()
    })

    it('should handle large datasets efficiently', async () => {
      const startTime = Date.now()

      // Create 1000 patients
      for (let i = 1; i <= 1000; i++) {
        await patientRepository.createPatient({
          PATIENT_CD: `PERF${i.toString().padStart(4, '0')}`,
          SEX_CD: i % 2 === 0 ? 'F' : 'M',
          AGE_IN_YEARS: 18 + (i % 62), // Ages 18-79
          VITAL_STATUS_CD: i % 10 === 0 ? 'I' : 'A', // 10% inactive
          LANGUAGE_CD: i % 3 === 0 ? 'SP' : i % 3 === 1 ? 'FR' : 'EN',
          RACE_CD: ['CAUC', 'HISP', 'ASIA', 'BLACK', 'OTHER'][i % 5],
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        })
      }

      const creationTime = Date.now() - startTime
      console.log(`Created 1000 patients in ${creationTime}ms`)
      expect(creationTime).toBeLessThan(60000) // Should complete in under 60 seconds

      // Test query performance
      const queryStartTime = Date.now()
      const malePatients = await patientRepository.findBySex('M')
      const queryTime = Date.now() - queryStartTime

      console.log(`Queried ${malePatients.length} male patients in ${queryTime}ms`)
      expect(malePatients).toHaveLength(500) // Should be exactly 500 male patients
      expect(queryTime).toBeLessThan(1000) // Should complete in under 1 second

      // Test statistics performance
      const statsStartTime = Date.now()
      const stats = await patientRepository.getPatientStatistics()
      const statsTime = Date.now() - statsStartTime

      console.log(`Generated statistics in ${statsTime}ms`)
      expect(stats.totalPatients).toBe(1000)
      expect(statsTime).toBeLessThan(2000) // Should complete in under 2 seconds
    }, 60000) // 60 second timeout for large dataset test

    it('should maintain performance with complex queries', async () => {
      // Create diverse test data
      for (let i = 1; i <= 500; i++) {
        await patientRepository.createPatient({
          PATIENT_CD: `COMPLEX${i.toString().padStart(3, '0')}`,
          SEX_CD: i % 2 === 0 ? 'F' : 'M',
          AGE_IN_YEARS: 20 + (i % 40),
          VITAL_STATUS_CD: i % 5 === 0 ? 'I' : 'A',
          LANGUAGE_CD: ['EN', 'SP', 'FR', 'DE', 'IT'][i % 5],
          RACE_CD: ['CAUC', 'HISP', 'ASIA', 'BLACK', 'OTHER'][i % 5],
          MARITAL_STATUS_CD: ['S', 'M', 'D', 'W'][i % 4],
          RELIGION_CD: ['CHR', 'CATH', 'PROT', 'JEW', 'MUSL', 'BUDD', 'HIND', 'NONE'][i % 8],
          SOURCESYSTEM_CD: 'TEST',
          UPLOAD_ID: 1,
        })
      }

      // Test complex criteria search performance
      const searchStartTime = Date.now()
      const results = await patientRepository.findPatientsByCriteria({
        vitalStatus: 'A',
        sex: 'M',
        ageRange: { min: 20, max: 40 },
        // Less restrictive criteria to ensure we get results
      })
      const searchTime = Date.now() - searchStartTime

      console.log(`Complex search returned ${results.length} results in ${searchTime}ms`)
      expect(searchTime).toBeLessThan(1000) // Should complete in under 1 second
      expect(results.length).toBeGreaterThan(0)
    }, 60000) // 60 second timeout for complex query test
  })
})
