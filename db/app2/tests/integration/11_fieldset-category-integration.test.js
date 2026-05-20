/**
 * FieldSet/Category/Questionnaire Integration Tests
 *
 * Tests the hybrid matching logic:
 * - FieldSet concept-code matching (primary)
 * - CATEGORY_CHAR fallback matching (secondary)
 * - VisitType → FieldSet activation
 * - Questionnaire observation handling
 * - Uncategorized observation detection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { studyTables } from '../../src/core/database/migrations/004-study-tables.js'
import { questionnaireFieldSet } from '../../src/core/database/migrations/005-questionnaire-fieldset.js'
import { fieldsetCategories } from '../../src/core/database/migrations/006-fieldset-categories.js'

describe('FieldSet/Category/Questionnaire Integration', () => {
  let connection, testDbPath

  beforeAll(async () => {
    testDbPath = './tests/output/fieldset-category-test.db'
    const outputDir = path.dirname(testDbPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    connection = new RealSQLiteConnection()
    const migrationManager = new MigrationManager(connection)
    const seedManager = new SeedManager(connection)

    migrationManager.registerMigration(coreSchema)
    migrationManager.registerMigration(databaseViews)
    migrationManager.registerMigration(studyTables)
    migrationManager.registerMigration(questionnaireFieldSet)
    migrationManager.registerMigration(fieldsetCategories)

    await connection.connect(testDbPath)
    await migrationManager.initializeDatabaseWithSeeds(seedManager)
  }, 60000)

  afterAll(async () => {
    if (connection?.getStatus()) {
      await connection.disconnect()
    }
  })

  // ──────────────────────────────────────────────
  // 1. FieldSet definitions have categories
  // ──────────────────────────────────────────────

  describe('FieldSet definitions', () => {
    it('should have 7 field sets with categories', async () => {
      const result = await connection.executeQuery(
        `SELECT CODE_CD, NAME_CHAR, LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='FIELD_SET_CD'
         ORDER BY CODE_CD`,
      )
      expect(result.success).toBe(true)
      expect(result.data.length).toBe(7)

      for (const fs of result.data) {
        const meta = JSON.parse(fs.LOOKUP_BLOB)
        expect(meta.concepts).toBeDefined()
        expect(Array.isArray(meta.concepts)).toBe(true)
        expect(meta.categories).toBeDefined()
        expect(Array.isArray(meta.categories)).toBe(true)
        expect(meta.categories.length).toBeGreaterThan(0)
      }
    })

    it('vitals FieldSet should map to "Vital Signs" category', async () => {
      const result = await connection.executeQuery(
        `SELECT LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='FIELD_SET_CD' AND CODE_CD='vitals'`,
      )
      const meta = JSON.parse(result.data[0].LOOKUP_BLOB)
      expect(meta.categories).toContain('Vital Signs')
    })

    it('assessment FieldSet should map to multiple categories', async () => {
      const result = await connection.executeQuery(
        `SELECT LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='FIELD_SET_CD' AND CODE_CD='assessment'`,
      )
      const meta = JSON.parse(result.data[0].LOOKUP_BLOB)
      expect(meta.categories).toContain('Assessment')
      expect(meta.categories).toContain('Diagnosis')
      expect(meta.categories).toContain('Clinical Scales')
      expect(meta.categories).toContain('Psychological Assessment')
    })

    it('questionnaires FieldSet should map to "Survey Best"', async () => {
      const result = await connection.executeQuery(
        `SELECT LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='FIELD_SET_CD' AND CODE_CD='questionnaires'`,
      )
      const meta = JSON.parse(result.data[0].LOOKUP_BLOB)
      expect(meta.categories).toContain('Survey Best')
      expect(meta.concepts).toContain('CUSTOM: QUESTIONNAIRE')
    })
  })

  // ──────────────────────────────────────────────
  // 2. VisitType → FieldSet mappings
  // ──────────────────────────────────────────────

  describe('VisitType FieldSet assignments', () => {
    it('all 6 visit types should have fieldSets defined', async () => {
      const result = await connection.executeQuery(
        `SELECT CODE_CD, LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='VISIT_TYPE_CD'
         ORDER BY CODE_CD`,
      )
      expect(result.success).toBe(true)

      for (const vt of result.data) {
        const meta = JSON.parse(vt.LOOKUP_BLOB)
        expect(meta.fieldSets).toBeDefined()
        expect(Array.isArray(meta.fieldSets)).toBe(true)
        expect(meta.fieldSets.length).toBeGreaterThan(0)
      }
    })

    it('parkinson_erst visit should have assessment, medications, physical', async () => {
      // Migration 007 split the legacy "parkinson" visit type into
      // parkinson_erst (Erstvorstellung) and parkinson_verlauf (Verlaufskontrolle).
      const result = await connection.executeQuery(
        `SELECT LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='VISIT_TYPE_CD' AND CODE_CD='parkinson_erst'`,
      )
      const meta = JSON.parse(result.data[0].LOOKUP_BLOB)
      const fsIds = meta.fieldSets.map((fs) => fs.id)
      expect(fsIds).toContain('assessment')
      expect(fsIds).toContain('medications')
      expect(fsIds).toContain('physical')
    })

    it('routine visit should have vitals, physical, medications (active) and lab, assessment (inactive)', async () => {
      const result = await connection.executeQuery(
        `SELECT LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='VISIT_TYPE_CD' AND CODE_CD='routine'`,
      )
      const meta = JSON.parse(result.data[0].LOOKUP_BLOB)
      const activeFsIds = meta.fieldSets.filter((fs) => fs.active).map((fs) => fs.id)
      const inactiveFsIds = meta.fieldSets.filter((fs) => !fs.active).map((fs) => fs.id)

      expect(activeFsIds).toContain('vitals')
      expect(activeFsIds).toContain('physical')
      expect(activeFsIds).toContain('medications')
      expect(inactiveFsIds).toContain('lab')
      expect(inactiveFsIds).toContain('assessment')
    })

    it('emergency visit should have vitals, medications, assessment', async () => {
      const result = await connection.executeQuery(
        `SELECT LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='VISIT_TYPE_CD' AND CODE_CD='emergency'`,
      )
      const meta = JSON.parse(result.data[0].LOOKUP_BLOB)
      const fsIds = meta.fieldSets.filter((fs) => fs.active).map((fs) => fs.id)
      expect(fsIds).toContain('vitals')
      expect(fsIds).toContain('medications')
      expect(fsIds).toContain('assessment')
    })
  })

  // ──────────────────────────────────────────────
  // 3. Hybrid matching simulation
  // ──────────────────────────────────────────────

  describe('Hybrid observation matching', () => {
    let fieldSets

    beforeAll(async () => {
      // Load field sets like the app does
      const result = await connection.executeQuery(
        `SELECT CODE_CD, NAME_CHAR, LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='FIELD_SET_CD'`,
      )
      fieldSets = result.data.map((fs) => {
        const meta = JSON.parse(fs.LOOKUP_BLOB)
        return { id: fs.CODE_CD, name: fs.NAME_CHAR, concepts: meta.concepts || [], categories: meta.categories || [] }
      })
    })

    // Simulate getFieldSetObservations matching logic
    function findFieldSetForObservation(obs) {
      for (const fs of fieldSets) {
        // Strategy 1: concept code match
        const conceptMatch = fs.concepts.some((concept) => {
          if (obs.conceptCode === concept) return true
          const cm = concept.match(/[:\s]([0-9-]+)$/)
          const om = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
          if (cm && om && cm[1] === om[1]) return true
          return false
        })
        if (conceptMatch) return fs.id

        // Strategy 2: category fallback
        if (fs.categories.includes(obs.category)) return fs.id
      }
      return 'uncategorized'
    }

    it('observation with explicit concept match → correct FieldSet', () => {
      const obs = { conceptCode: 'LID: 8480-6', category: 'Vital Signs' }
      expect(findFieldSetForObservation(obs)).toBe('vitals')
    })

    it('observation with CATEGORY_CHAR="Demographics" → physical FieldSet', () => {
      const obs = { conceptCode: 'LID: 63900-5', category: 'Demographics' } // Age
      expect(findFieldSetForObservation(obs)).toBe('physical')
    })

    it('observation with CATEGORY_CHAR="Laboratory" → lab FieldSet', () => {
      const obs = { conceptCode: 'SOME_NEW_LAB_CODE', category: 'Laboratory' }
      expect(findFieldSetForObservation(obs)).toBe('lab')
    })

    it('observation with CATEGORY_CHAR="Clinical Scales" → assessment FieldSet', () => {
      const obs = { conceptCode: 'SOME_SCALE', category: 'Clinical Scales' }
      expect(findFieldSetForObservation(obs)).toBe('assessment')
    })

    it('observation with CATEGORY_CHAR="Medications" → medications FieldSet', () => {
      const obs = { conceptCode: 'CUSTOM_MED', category: 'Medications' }
      expect(findFieldSetForObservation(obs)).toBe('medications')
    })

    it('observation with CATEGORY_CHAR="General" → uncategorized', () => {
      const obs = { conceptCode: 'SOMETHING', category: 'General' }
      expect(findFieldSetForObservation(obs)).toBe('uncategorized')
    })

    it('observation with no category and no concept match → uncategorized', () => {
      const obs = { conceptCode: 'UNKNOWN_CODE', category: null }
      expect(findFieldSetForObservation(obs)).toBe('uncategorized')
    })

    it('questionnaire observation → questionnaires FieldSet', () => {
      const obs = { conceptCode: 'CUSTOM: QUESTIONNAIRE', category: 'SURVEY_BEST' }
      expect(findFieldSetForObservation(obs)).toBe('questionnaires')
    })
  })

  // ──────────────────────────────────────────────
  // 4. Questionnaire handling
  // ──────────────────────────────────────────────

  describe('Questionnaire observations', () => {
    it('CUSTOM: QUESTIONNAIRE concept should exist', async () => {
      const result = await connection.executeQuery(
        `SELECT CONCEPT_CD, NAME_CHAR FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = 'CUSTOM: QUESTIONNAIRE'`,
      )
      expect(result.success).toBe(true)
      expect(result.data.length).toBe(1)
    })

    it('questionnaire definitions should be in CODE_LOOKUP', async () => {
      const result = await connection.executeQuery(
        `SELECT CODE_CD, NAME_CHAR FROM CODE_LOOKUP
         WHERE TABLE_CD='SURVEY_BEST' AND COLUMN_CD='QUESTIONNAIRE'
         ORDER BY NAME_CHAR`,
      )
      expect(result.success).toBe(true)
      expect(result.data.length).toBeGreaterThanOrEqual(2)

      const codes = result.data.map((r) => r.CODE_CD)
      expect(codes).toContain('MOCA')
    })

    it('pending questionnaire observation should be insertable and queryable', async () => {
      // Create a test patient and visit
      await connection.executeCommand(
        `INSERT OR IGNORE INTO PATIENT_DIMENSION (PATIENT_NUM, PATIENT_CD) VALUES (999, 'TEST_PATIENT')`,
      )
      await connection.executeCommand(
        `INSERT OR IGNORE INTO VISIT_DIMENSION (ENCOUNTER_NUM, PATIENT_NUM, START_DATE, ACTIVE_STATUS_CD)
         VALUES (999, 999, '2026-04-07', 'A')`,
      )

      // Insert a pending questionnaire observation
      const blob = JSON.stringify({
        _status: 'pending',
        _questionnaireCode: 'MOCA',
        _savedResponses: {},
        title: 'MoCA',
      })

      await connection.executeCommand(
        `INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, VALTYPE_CD, TVAL_CHAR, OBSERVATION_BLOB, SOURCESYSTEM_CD, CATEGORY_CHAR, INSTANCE_NUM)
         VALUES (999, 999, 'CUSTOM: QUESTIONNAIRE', 'Q', 'MoCA', ?, 'TEST', 'SURVEY_BEST', 1)`,
        [blob],
      )

      // Query via view
      const result = await connection.executeQuery(
        `SELECT OBSERVATION_ID, VALTYPE_CD, TVAL_CHAR, OBSERVATION_BLOB
         FROM patient_observations WHERE ENCOUNTER_NUM = 999 AND VALTYPE_CD = 'Q'`,
      )
      expect(result.success).toBe(true)
      expect(result.data.length).toBe(1)
      expect(result.data[0].TVAL_CHAR).toBe('MoCA')

      const parsedBlob = JSON.parse(result.data[0].OBSERVATION_BLOB)
      expect(parsedBlob._status).toBe('pending')
      expect(parsedBlob._questionnaireCode).toBe('MOCA')
    })
  })

  // ──────────────────────────────────────────────
  // 5. Category coverage check
  // ──────────────────────────────────────────────

  describe('Category coverage', () => {
    it('mapped categories should cover common clinical categories', async () => {
      const result = await connection.executeQuery(
        `SELECT CODE_CD, LOOKUP_BLOB FROM CODE_LOOKUP
         WHERE TABLE_CD='VISIT_DIMENSION' AND COLUMN_CD='FIELD_SET_CD'`,
      )

      const allCategories = new Set()
      for (const fs of result.data) {
        const meta = JSON.parse(fs.LOOKUP_BLOB)
        if (meta.categories) {
          meta.categories.forEach((c) => allCategories.add(c))
        }
      }

      // These should be covered
      expect(allCategories.has('Vital Signs')).toBe(true)
      expect(allCategories.has('Demographics')).toBe(true)
      expect(allCategories.has('Medications')).toBe(true)
      expect(allCategories.has('Laboratory')).toBe(true)
      expect(allCategories.has('Assessment')).toBe(true)
      expect(allCategories.has('Diagnosis')).toBe(true)
      expect(allCategories.has('Clinical Scales')).toBe(true)

      // These are intentionally NOT covered (go to uncategorized)
      expect(allCategories.has('General')).toBe(false)
      expect(allCategories.has('Stroke')).toBe(false)
      expect(allCategories.has('Imaging')).toBe(false)
    })
  })
})
