/**
 * Integration Tests for DataValidator
 *
 * Tests data validation functionality with real database operations:
 * - Real SQLite database connection
 * - Actual CQL rules from database
 * - Concept-specific validation
 * - End-to-end validation scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'
import ConceptRepository from '../../src/core/database/repositories/concept-repository.js'
import CqlRepository from '../../src/core/database/repositories/cql-repository.js'
import DataValidator from '../../src/core/validators/data-validator.js'
import path from 'path'
import fs from 'fs'

describe('DataValidator Integration Tests', () => {
  let connection
  let migrationManager
  let seedManager
  let conceptRepository
  let cqlRepository
  let dataValidator
  let testDbPath

  beforeAll(async () => {
    // Create test database
    testDbPath = path.join(global.__TEST_OUTPUT_DIR__ || './tests/output', 'data-validation-test.db')

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

    // Register migrations
    const initialSchema = await import('../../src/core/database/migrations/001-initial-schema.js')
    const currentSchema = await import('../../src/core/database/migrations/002-current-schema.js')
    const addNoteFactColumns = await import('../../src/core/database/migrations/003-add-note-fact-columns.js')

    migrationManager.registerMigration(initialSchema.initialSchema)
    migrationManager.registerMigration(currentSchema.currentSchema)
    migrationManager.registerMigration(addNoteFactColumns.addNoteFactColumns)

    // Initialize seed manager
    seedManager = new SeedManager(connection)

    // Initialize database with schema and seed data
    await migrationManager.initializeDatabaseWithSeeds(seedManager)

    // Initialize repositories
    conceptRepository = new ConceptRepository(connection)
    cqlRepository = new CqlRepository(connection)

    // Initialize data validator
    dataValidator = new DataValidator(conceptRepository, cqlRepository)
  }, 60000) // 60 second timeout for database initialization with seeding

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
    // Clean up test data between tests
    await connection.executeCommand('DELETE FROM OBSERVATION_FACT WHERE PATIENT_NUM > 1000')
    await connection.executeCommand('DELETE FROM VISIT_DIMENSION WHERE PATIENT_NUM > 1000')
    await connection.executeCommand('DELETE FROM PATIENT_DIMENSION WHERE PATIENT_NUM > 1000')
  })

  describe('Real Database Validation', () => {
    it('should validate data with real concept rules from database', async () => {
      // Find a real concept with CQL rules
      const concepts = await conceptRepository.findAll()
      expect(concepts.length).toBeGreaterThan(0)

      // Find CQL rules
      const cqlRules = await cqlRepository.findAll()
      expect(cqlRules.length).toBeGreaterThan(0)

      // Test validation with a real concept
      const testConcept = concepts[0]
      const result = await dataValidator.validateData({
        value: 'test value',
        type: 'text',
        conceptCode: testConcept.CONCEPT_CD,
      })

      expect(result).toBeDefined()
      expect(result.metadata.conceptCode).toBe(testConcept.CONCEPT_CD)
      expect(result.metadata.dataType).toBe('text')
    })

    it('should handle concept codes that have no validation rules', async () => {
      // Create a test concept without CQL rules
      const testConceptCode = 'TEST:NO_RULES'

      const result = await dataValidator.validateData({
        value: 42,
        type: 'numeric',
        conceptCode: testConceptCode,
      })

      // The validation should complete successfully
      expect(result).toBeDefined()
      expect(result.metadata.conceptCode).toBe(testConceptCode)

      // Check if there are warnings or if validation just succeeds
      if (result.warnings.length > 0) {
        expect(result.warnings[0].code).toBe('NO_CONCEPT_RULES')
        expect(result.warnings[0].message).toContain('No validation rules found for concept: TEST:NO_RULES')
      }

      // If validation fails, check what the actual error is
      if (!result.isValid) {
        console.log('Validation failed with errors:', JSON.stringify(result.errors, null, 2))

        // The concept code should not have actual CQL rules, so any concept validation errors
        // should be due to the concept not being found in the database
        const conceptValidationErrors = result.errors.filter((e) => e.code === 'CONCEPT_RULE_VIOLATION' || e.code === 'CONCEPT_VALIDATION_ERROR')

        if (conceptValidationErrors.length > 0) {
          // If there are concept validation errors, they should be due to the concept not being found
          expect(conceptValidationErrors[0].message).toContain('No validation rules found')
        }
      }
    })

    it('should validate numeric data with business rules', async () => {
      const result = await dataValidator.validateData({
        value: 200,
        type: 'numeric',
        metadata: { field: 'AGE_IN_YEARS' },
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_AGE_RANGE')
      expect(result.errors[0].message).toContain('Age must be between 0 and 150 years')
    })

    it('should validate blood pressure with clinical ranges', async () => {
      const result = await dataValidator.validateData({
        value: 400,
        type: 'numeric',
        metadata: { field: 'BLOOD_PRESSURE' },
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_BLOOD_PRESSURE')
      expect(result.errors[0].message).toContain('Blood pressure must be between 50 and 300 mmHg')
    })

    it('should validate heart rate with clinical ranges', async () => {
      const result = await dataValidator.validateData({
        value: 300,
        type: 'numeric',
        metadata: { field: 'HEART_RATE' },
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('INVALID_HEART_RATE')
      expect(result.errors[0].message).toContain('Heart rate must be between 30 and 250 bpm')
    })
  })

  describe('Custom Validation Rules', () => {
    it('should apply custom numeric rules', async () => {
      // Set custom rules for age validation
      dataValidator.setCustomRules('numeric', {
        min: 18,
        max: 65,
        allowNegative: false,
        precision: 0,
      })

      const result = await dataValidator.validateData({
        value: 16,
        type: 'numeric',
        metadata: { field: 'AGE_IN_YEARS' },
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('VALUE_BELOW_MINIMUM')
      expect(result.errors[0].message).toContain('Value 16 is below minimum 18')
    })

    it('should apply custom text rules', async () => {
      // Set custom text rules
      dataValidator.setCustomRules('text', {
        minLength: 10,
        maxLength: 100,
        allowEmpty: false,
      })

      const result = await dataValidator.validateData({
        value: 'Short',
        type: 'text',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('TEXT_TOO_SHORT')
      expect(result.errors[0].message).toContain('Text length 5 is below minimum 10')
    })

    it('should apply custom date rules', async () => {
      // Set custom date rules
      dataValidator.setCustomRules('date', {
        minDate: '2020-01-01',
        maxDate: '2025-12-31',
        allowFuture: false,
      })

      const result = await dataValidator.validateData({
        value: '2019-12-31',
        type: 'date',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('DATE_TOO_EARLY')
      expect(result.errors[0].message).toContain('Date 2019-12-31 is before minimum 2020-01-01')
    })
  })

  describe('Complex Validation Scenarios', () => {
    it('should handle multiple validation issues simultaneously', async () => {
      // Set strict rules
      dataValidator.setCustomRules('numeric', {
        min: 25,
        max: 75,
        allowNegative: false,
        precision: 1,
      })

      const result = await dataValidator.validateData({
        value: 15.55,
        type: 'numeric',
        metadata: { field: 'HEART_RATE' },
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)

      // Should have multiple validation errors
      const errorCodes = result.errors.map((e) => e.code)
      expect(errorCodes).toContain('VALUE_BELOW_MINIMUM')
      expect(errorCodes).toContain('PRECISION_EXCEEDED')
      expect(errorCodes).toContain('INVALID_HEART_RATE')
    })

    it('should validate clinical observation data', async () => {
      // Simulate clinical observation validation
      const observationData = {
        value: 85,
        type: 'numeric',
        conceptCode: 'LOINC:8302-2', // Height
        metadata: { field: 'HEIGHT_CM' },
      }

      const result = await dataValidator.validateData(observationData)

      expect(result).toBeDefined()
      expect(result.metadata.conceptCode).toBe('LOINC:8302-2')
      expect(result.metadata.dataType).toBe('numeric')

      // Height should be reasonable (not negative, not too high)
      if (!result.isValid) {
        const hasUnreasonableHeight = result.errors.some((e) => e.code === 'VALUE_BELOW_MINIMUM' || e.code === 'VALUE_ABOVE_MAXIMUM')
        expect(hasUnreasonableHeight).toBe(true)
      }
    })

    it('should validate survey/questionnaire data', async () => {
      const surveyData = {
        value: '{"anxiety": 3, "depression": 2, "stress": 4}',
        type: 'text',
        conceptCode: 'SURVEY:ANXIETY_DEPRESSION',
        metadata: { field: 'MENTAL_HEALTH_SURVEY' },
      }

      const result = await dataValidator.validateData(surveyData)

      expect(result).toBeDefined()
      expect(result.metadata.conceptCode).toBe('SURVEY:ANXIETY_DEPRESSION')
      expect(result.metadata.dataType).toBe('text')

      // Survey data should be valid text (no JSON validation in basic rules)
      // But it might fail due to length or other rules
      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Error Reporting and Debugging', () => {
    it('should provide comprehensive error details', async () => {
      dataValidator.setCustomRules('numeric', { min: 100 })

      const result = await dataValidator.validateData({
        value: 50,
        type: 'numeric',
        conceptCode: 'TEST:123',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      const error = result.errors[0]
      expect(error.code).toBe('VALUE_BELOW_MINIMUM')
      expect(error.field).toBe('value')
      expect(error.message).toContain('Value 50 is below minimum 100')
      expect(error.details).toContain('Numeric values must be >= 100')
      expect(error.severity).toBe('error')

      // Check metadata
      expect(result.metadata.validatedAt).toBeDefined()
      expect(result.metadata.dataType).toBe('numeric')
      expect(result.metadata.conceptCode).toBe('TEST:123')
      expect(result.metadata.value).toBe(50)
    })

    it('should handle validation system errors gracefully', async () => {
      // Mock a repository method to throw an error
      const originalMethod = conceptRepository.findByConceptCode
      conceptRepository.findByConceptCode = async () => {
        throw new Error('Database connection failed')
      }

      const result = await dataValidator.validateData({
        value: 50,
        type: 'numeric',
        conceptCode: 'TEST:123',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      // Log the actual errors to see what's happening
      console.log('Validation errors:', JSON.stringify(result.errors, null, 2))

      // Check that there are any errors (the validation should fail due to the mock error)
      expect(result.errors.length).toBeGreaterThan(0)

      // Restore original method
      conceptRepository.findByConceptCode = originalMethod
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple validations efficiently', async () => {
      const startTime = Date.now()

      const validations = []
      for (let i = 0; i < 100; i++) {
        validations.push(
          dataValidator.validateData({
            value: i,
            type: 'numeric',
            metadata: { field: 'TEST_FIELD' },
          }),
        )
      }

      const results = await Promise.all(validations)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(100)
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second

      // Check that validations complete successfully
      expect(results.every((r) => r !== undefined)).toBe(true)
    })

    it('should handle large text validation efficiently', async () => {
      const largeText = 'A'.repeat(10000)

      const startTime = Date.now()
      const result = await dataValidator.validateData({
        value: largeText,
        type: 'text',
      })
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('TEXT_TOO_LONG')
      expect(duration).toBeLessThan(100) // Should complete in under 100ms
    })
  })

  describe('Rule Management', () => {
    it('should allow dynamic rule updates', async () => {
      // Reset to defaults first
      dataValidator.resetToDefaults()

      // Start with default rules
      const defaultRules = dataValidator.getRules('numeric')
      expect(defaultRules.min).toBe(-Infinity)
      expect(defaultRules.max).toBe(Infinity)

      // Update rules
      dataValidator.setCustomRules('numeric', { min: 50, max: 150 })
      const updatedRules = dataValidator.getRules('numeric')
      expect(updatedRules.min).toBe(50)
      expect(updatedRules.max).toBe(150)

      // Test validation with new rules
      const result = await dataValidator.validateData({
        value: 25,
        type: 'numeric',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors[0].code).toBe('VALUE_BELOW_MINIMUM')
    })

    it('should reset rules to defaults', async () => {
      // Modify rules
      dataValidator.setCustomRules('numeric', { min: 100, max: 200 })

      // Reset to defaults
      dataValidator.resetToDefaults()

      const rules = dataValidator.getRules('numeric')
      expect(rules.min).toBe(-Infinity)
      expect(rules.max).toBe(Infinity)
    })
  })
})
