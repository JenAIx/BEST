/**
 * Integration Tests: Patient UPDATE_DATE Triggers
 * Tests that PATIENT_DIMENSION.UPDATE_DATE is automatically updated when:
 * - Patient data is modified
 * - Visits are added/modified/deleted
 * - Observations are added/modified/deleted
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import PatientRepository from '../../src/core/database/repositories/patient-repository.js'
import VisitRepository from '../../src/core/database/repositories/visit-repository.js'
import ObservationRepository from '../../src/core/database/repositories/observation-repository.js'
import { currentSchema } from '../../src/core/database/migrations/002-current-schema.js'
import { addNoteFactColumns } from '../../src/core/database/migrations/003-add-note-fact-columns.js'
import { createPatientListView } from '../../src/core/database/migrations/005-create-patient-list-view.js'
import { createPatientObservationsView } from '../../src/core/database/migrations/006-create-patient-observations-view.js'
import { patientUpdateTriggers } from '../../src/core/database/migrations/007-patient-update-triggers.js'

describe('Patient UPDATE_DATE Triggers Integration', () => {
  let connection
  let migrationManager
  let patientRepo
  let visitRepo
  let observationRepo
  let testPatientNum
  let testEncounterNum
  let testDbPath

  beforeEach(async () => {
    // Create temporary test database
    testDbPath = path.join(process.cwd(), 'tests', 'output', `trigger-test-${Date.now()}.db`)

    // Ensure test output directory exists
    const testDir = path.dirname(testDbPath)
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true })
    }

    connection = new RealSQLiteConnection()
    await connection.connect(testDbPath)

    // Set up migrations
    migrationManager = new MigrationManager(connection)
    migrationManager.registerMigration(currentSchema)
    migrationManager.registerMigration(addNoteFactColumns)
    migrationManager.registerMigration(createPatientListView)
    migrationManager.registerMigration(createPatientObservationsView)
    migrationManager.registerMigration(patientUpdateTriggers)

    // Run migrations
    await migrationManager.initializeDatabase()

    // Initialize repositories
    patientRepo = new PatientRepository(connection)
    visitRepo = new VisitRepository(connection)
    observationRepo = new ObservationRepository(connection)

    // Create a test patient
    const patientData = {
      PATIENT_CD: 'TEST_TRIGGER_001',
      SEX_CD: 'M',
      AGE_IN_YEARS: 35,
      VITAL_STATUS_CD: 'A',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1,
    }

    const createdPatient = await patientRepo.createPatient(patientData)
    testPatientNum = createdPatient.PATIENT_NUM

    // Create a test visit
    const visitData = {
      PATIENT_NUM: testPatientNum,
      START_DATE: '2024-01-15',
      ACTIVE_STATUS_CD: 'A',
      INOUT_CD: 'O',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1,
    }

    const createdVisit = await visitRepo.createVisit(visitData)
    testEncounterNum = createdVisit.ENCOUNTER_NUM

    // Add a test concept for observations
    await connection.executeCommand(`
      INSERT OR IGNORE INTO CONCEPT_DIMENSION
      (CONCEPT_CD, NAME_CHAR, SOURCESYSTEM_CD, UPLOAD_ID)
      VALUES ('LOINC:8302-2', 'Body height', 'TEST', 1)
    `)
  })

  afterEach(async () => {
    if (connection) {
      await connection.disconnect()
    }

    // Clean up test database file
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  const getPatientUpdateDate = async () => {
    const result = await connection.executeQuery('SELECT UPDATE_DATE FROM PATIENT_DIMENSION WHERE PATIENT_NUM = ?', [testPatientNum])
    return result.success && result.data.length > 0 ? result.data[0].UPDATE_DATE : null
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // Helper to ensure different timestamps
  const ensureTimeDifference = async () => {
    await sleep(1100) // Ensure at least 1 second difference for datetime('now')
  }

  test('should update patient UPDATE_DATE when patient data is modified', async () => {
    // Get initial UPDATE_DATE
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Update patient data
    await patientRepo.updatePatient(testPatientNum, {
      AGE_IN_YEARS: 36,
    })

    // Check that UPDATE_DATE was updated
    const newUpdateDate = await getPatientUpdateDate()
    expect(newUpdateDate).not.toBe(initialUpdateDate)
    expect(new Date(newUpdateDate)).toBeInstanceOf(Date)
  })

  test('should update patient UPDATE_DATE when visit is added', async () => {
    // Get initial UPDATE_DATE
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Add a new visit
    const visitData = {
      PATIENT_NUM: testPatientNum,
      START_DATE: '2024-01-16',
      ACTIVE_STATUS_CD: 'A',
      INOUT_CD: 'I',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1,
    }

    await visitRepo.createVisit(visitData)

    // Check that UPDATE_DATE was updated
    const newUpdateDate = await getPatientUpdateDate()
    expect(newUpdateDate).not.toBe(initialUpdateDate)
  })

  test('should update patient UPDATE_DATE when visit is modified', async () => {
    // Get initial UPDATE_DATE
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Update the visit
    await connection.executeQuery('UPDATE VISIT_DIMENSION SET LOCATION_CD = ? WHERE ENCOUNTER_NUM = ?', ['UPDATED_LOCATION', testEncounterNum])

    // Check that UPDATE_DATE was updated
    const newUpdateDate = await getPatientUpdateDate()
    expect(newUpdateDate).not.toBe(initialUpdateDate)
  })

  test('should update patient UPDATE_DATE when visit is deleted', async () => {
    // Create another visit first (so we don't delete the main test visit)
    const visitData = {
      PATIENT_NUM: testPatientNum,
      START_DATE: '2024-01-17',
      ACTIVE_STATUS_CD: 'A',
      INOUT_CD: 'O',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1,
    }

    const createdVisit = await visitRepo.createVisit(visitData)
    const visitToDelete = createdVisit.ENCOUNTER_NUM

    // Get UPDATE_DATE after visit creation
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Delete the visit
    await connection.executeQuery('DELETE FROM VISIT_DIMENSION WHERE ENCOUNTER_NUM = ?', [visitToDelete])

    // Check that UPDATE_DATE was updated
    const newUpdateDate = await getPatientUpdateDate()
    expect(newUpdateDate).not.toBe(initialUpdateDate)
  })

  test('should update patient UPDATE_DATE when observation is added', async () => {
    // Get initial UPDATE_DATE
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Add an observation
    const observationData = {
      PATIENT_NUM: testPatientNum,
      ENCOUNTER_NUM: testEncounterNum,
      CONCEPT_CD: 'LOINC:8302-2',
      START_DATE: '2024-01-15',
      VALTYPE_CD: 'N',
      NVAL_NUM: 180,
      UNIT_CD: 'cm',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1,
    }

    await observationRepo.create(observationData)

    // Check that UPDATE_DATE was updated
    const newUpdateDate = await getPatientUpdateDate()
    expect(newUpdateDate).not.toBe(initialUpdateDate)
  })

  test('should update patient UPDATE_DATE when observation is modified', async () => {
    // First create an observation
    const observationData = {
      PATIENT_NUM: testPatientNum,
      ENCOUNTER_NUM: testEncounterNum,
      CONCEPT_CD: 'LOINC:8302-2',
      START_DATE: '2024-01-15',
      VALTYPE_CD: 'N',
      NVAL_NUM: 180,
      UNIT_CD: 'cm',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1,
    }

    const createdObs = await observationRepo.create(observationData)
    const obsId = createdObs.OBSERVATION_ID

    // Get UPDATE_DATE after observation creation
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Update the observation
    await connection.executeQuery('UPDATE OBSERVATION_FACT SET NVAL_NUM = ? WHERE OBSERVATION_ID = ?', [185, obsId])

    // Check that UPDATE_DATE was updated
    const newUpdateDate = await getPatientUpdateDate()
    expect(newUpdateDate).not.toBe(initialUpdateDate)
  })

  test('should update patient UPDATE_DATE when observation is deleted', async () => {
    // First create an observation
    const observationData = {
      PATIENT_NUM: testPatientNum,
      ENCOUNTER_NUM: testEncounterNum,
      CONCEPT_CD: 'LOINC:8302-2',
      START_DATE: '2024-01-15',
      VALTYPE_CD: 'N',
      NVAL_NUM: 180,
      UNIT_CD: 'cm',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1,
    }

    const createdObs = await observationRepo.create(observationData)
    const obsId = createdObs.OBSERVATION_ID

    // Get UPDATE_DATE after observation creation
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Delete the observation
    await connection.executeQuery('DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [obsId])

    // Check that UPDATE_DATE was updated
    const newUpdateDate = await getPatientUpdateDate()
    expect(newUpdateDate).not.toBe(initialUpdateDate)
  })

  test('should not create infinite loops when UPDATE_DATE is manually set', async () => {
    // Get initial UPDATE_DATE
    const initialUpdateDate = await getPatientUpdateDate()

    // Wait to ensure timestamp difference
    await ensureTimeDifference()

    // Manually set UPDATE_DATE (this should not trigger the trigger due to WHEN clause)
    const manualDate = '2024-01-20 10:00:00'
    await connection.executeQuery('UPDATE PATIENT_DIMENSION SET UPDATE_DATE = ? WHERE PATIENT_NUM = ?', [manualDate, testPatientNum])

    // Check that UPDATE_DATE is what we set it to (not overridden by trigger)
    const finalUpdateDate = await getPatientUpdateDate()
    expect(finalUpdateDate).toBe(manualDate)
  })

  test('should verify all triggers are created', async () => {
    // Check that all expected triggers exist
    const result = await connection.executeQuery("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'update_patient_on_%'", [])

    expect(result.success).toBe(true)
    expect(result.data.length).toBe(7) // Should have 7 triggers

    const triggerNames = result.data.map((row) => row.name).sort()
    expect(triggerNames).toEqual([
      'update_patient_on_observation_delete',
      'update_patient_on_observation_insert',
      'update_patient_on_observation_update',
      'update_patient_on_patient_update',
      'update_patient_on_visit_delete',
      'update_patient_on_visit_insert',
      'update_patient_on_visit_update',
    ])
  })
})
