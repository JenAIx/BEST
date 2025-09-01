/**
 * Unit Tests for JSON Import Service
 *
 * Tests:
 * - JSON parsing and validation
 * - Clinical data structure transformation
 * - Patient, visit, and observation extraction
 * - Reference resolution
 * - Error handling for invalid JSON
 * - File reading from test_import/ directory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportJsonService } from '../../src/core/services/imports/import-json-service.js'
import fs from 'fs'
import path from 'path'

// Mock repositories
const mockConceptRepository = {
  findByConceptCode: vi.fn(),
  getConceptByCode: vi.fn(),
}

const mockCqlRepository = {
  getCqlRules: vi.fn(),
}

// Helper function to read test files
const readTestFile = (filename) => {
  try {
    const filePath = path.join(process.cwd(), 'tests', 'input', 'test_import', filename)
    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    console.warn(`Could not read test file ${filename}:`, error.message)
    return null
  }
}

describe('JSON Import Service', () => {
  let jsonImportService

  beforeEach(() => {
    jsonImportService = new ImportJsonService(mockConceptRepository, mockCqlRepository)
  })

  describe('JSON Parsing', () => {
    it('should parse valid JSON correctly', () => {
      const jsonString = '{"patients": [{"PATIENT_CD": "TEST001", "SEX_CD": "M"}], "metadata": {"version": "1.0"}}'

      const result = jsonImportService.parseJsonContent(jsonString)

      expect(result).toBeDefined()
      expect(result.patients).toHaveLength(1)
      expect(result.patients[0].PATIENT_CD).toBe('TEST001')
      expect(result.metadata.version).toBe('1.0')
    })

    it('should handle JSON with BOM', () => {
      const jsonString = '\uFEFF{"test": "value"}'

      const result = jsonImportService.parseJsonContent(jsonString)

      expect(result.test).toBe('value')
    })

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{"incomplete": json}'

      expect(() => jsonImportService.parseJsonContent(invalidJson)).toThrow('Invalid JSON format')
    })
  })

  describe('JSON Validation', () => {
    it('should validate correct clinical JSON structure', () => {
      const jsonData = {
        patients: [{ PATIENT_CD: 'TEST001', SEX_CD: 'M' }],
        visits: [{ PATIENT_NUM: 1, START_DATE: '2024-01-15' }],
        observations: [{ CONCEPT_CD: 'TEST:001', VALTYPE_CD: 'N', VALUE: 100 }],
      }

      const result = jsonImportService.validateJsonStructure(jsonData)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing patient ID', () => {
      const jsonData = {
        patients: [
          { SEX_CD: 'M' }, // Missing PATIENT_CD
        ],
      }

      const result = jsonImportService.validateJsonStructure(jsonData)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('PATIENT_CD'))).toBe(true)
    })

    it('should detect missing observation concept', () => {
      const jsonData = {
        observations: [
          { VALUE: 100 }, // Missing CONCEPT_CD
        ],
      }

      const result = jsonImportService.validateJsonStructure(jsonData)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('CONCEPT_CD'))).toBe(true)
    })

    it('should handle empty arrays', () => {
      const jsonData = {
        patients: [],
        visits: [],
        observations: [],
      }

      const result = jsonImportService.validateJsonStructure(jsonData)

      expect(result.isValid).toBe(true)
      expect(result.warnings.some((w) => w.message.includes('all empty'))).toBe(true)
    })

    it('should validate non-object data', () => {
      const jsonData = 'string data'

      const result = jsonImportService.validateJsonStructure(jsonData)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.message.includes('object'))).toBe(true)
    })
  })

  describe('Clinical Data Transformation', () => {
    it('should transform patients correctly', () => {
      const jsonData = {
        patients: [
          {
            PATIENT_CD: 'TEST001',
            SEX_CD: 'M',
            AGE_IN_YEARS: 30,
            BIRTH_DATE: '1994-01-15',
          },
        ],
      }

      const clinicalData = jsonImportService.transformJsonToClinical(jsonData)

      expect(clinicalData.patients).toHaveLength(1)
      expect(clinicalData.patients[0].PATIENT_CD).toBe('TEST001')
      expect(clinicalData.patients[0].SEX_CD).toBe('M')
      expect(clinicalData.patients[0].AGE_IN_YEARS).toBe(30)
    })

    it('should transform visits with patient references', () => {
      const jsonData = {
        visits: [
          {
            PATIENT_NUM: 1,
            START_DATE: '2024-01-15',
            LOCATION_CD: 'EMERGENCY',
            INOUT_CD: 'I',
          },
        ],
      }

      const clinicalData = jsonImportService.transformJsonToClinical(jsonData)

      expect(clinicalData.visits).toHaveLength(1)
      expect(clinicalData.visits[0].PATIENT_NUM).toBe(1)
      expect(clinicalData.visits[0].START_DATE).toBe('2024-01-15')
    })

    it('should transform observations with different value types', () => {
      const jsonData = {
        observations: [
          {
            CONCEPT_CD: 'TEST:NUMERIC',
            VALTYPE_CD: 'N',
            VALUE: 100,
          },
          {
            CONCEPT_CD: 'TEST:TEXT',
            VALTYPE_CD: 'T',
            VALUE: 'Normal',
          },
          {
            CONCEPT_CD: 'TEST:DATE',
            VALTYPE_CD: 'D',
            VALUE: '2024-01-15',
          },
        ],
      }

      const clinicalData = jsonImportService.transformJsonToClinical(jsonData)

      expect(clinicalData.observations).toHaveLength(3)
      expect(clinicalData.observations[0].CONCEPT_CD).toBe('TEST:NUMERIC')
      expect(clinicalData.observations[0].NVAL_NUM).toBe(100)
      expect(clinicalData.observations[1].TVAL_CHAR).toBe('Normal')
      expect(clinicalData.observations[2].TVAL_CHAR).toBe('2024-01-15')
    })

    it('should handle alternative field names', () => {
      const jsonData = {
        patients: [
          {
            patientId: 'ALT001',
            sex: 'F',
            age: 25,
            birthDate: '1999-01-15',
          },
        ],
      }

      const clinicalData = jsonImportService.transformJsonToClinical(jsonData)

      expect(clinicalData.patients[0].PATIENT_CD).toBe('ALT001')
      expect(clinicalData.patients[0].SEX_CD).toBe('F')
      expect(clinicalData.patients[0].AGE_IN_YEARS).toBe(25)
    })
  })

  describe('Reference Resolution', () => {
    it('should resolve patient references in visits', () => {
      const clinicalData = {
        patients: [{ PATIENT_NUM: 123, PATIENT_CD: 'PAT001' }],
        visits: [{ PATIENT_NUM: 'PATIENT_REF_PAT001', START_DATE: '2024-01-15' }],
        observations: [],
      }

      const resolved = jsonImportService.resolveReferences(clinicalData)

      expect(resolved.visits[0].PATIENT_NUM).toBe(123)
    })

    it('should handle unresolved references', () => {
      const clinicalData = {
        patients: [],
        visits: [{ PATIENT_NUM: 'PATIENT_REF_MISSING', START_DATE: '2024-01-15' }],
        observations: [],
      }

      const resolved = jsonImportService.resolveReferences(clinicalData)

      expect(resolved.visits[0].PATIENT_NUM).toBe('PATIENT_REF_MISSING')
    })
  })

  describe('File Import Tests', () => {
    it('should import from 02_json.json test file', async () => {
      const jsonContent = readTestFile('02_json.json')
      if (!jsonContent) {
        console.warn('Skipping test: 02_json.json not found')
        return
      }

      const result = await jsonImportService.importFromJson(jsonContent)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.patients).toBeDefined()
      expect(Array.isArray(result.data.patients)).toBe(true)
    })

    it('should handle HL7 FHIR format (expected to fail with JSON service)', async () => {
      const jsonContent = readTestFile('patient_10019815_2023-01-22_HL7.json')
      if (!jsonContent) {
        console.warn('Skipping test: patient_10019815_2023-01-22_HL7.json not found')
        return
      }

      const result = await jsonImportService.importFromJson(jsonContent)

      // HL7 FHIR format should fail with JSON service (no patients/visits/observations)
      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.message.includes('JSON must contain at least one'))).toBe(true)
    })

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{invalid json content}'

      const result = await jsonImportService.importFromJson(invalidJson)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle empty JSON', async () => {
      const emptyJson = '{}'

      const result = await jsonImportService.importFromJson(emptyJson)

      expect(result.success).toBe(true)
      expect(result.data.patients).toHaveLength(0)
      expect(result.data.visits).toHaveLength(0)
      expect(result.data.observations).toHaveLength(0)
    })

    it('should handle JSON with only metadata', async () => {
      const metadataOnlyJson = '{"metadata": {"version": "1.0", "source": "test"}}'

      const result = await jsonImportService.importFromJson(metadataOnlyJson)

      expect(result.success).toBe(true)
      expect(result.data.patients).toHaveLength(0)
      expect(result.metadata.source).toBe('test')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON with proper error messages', async () => {
      const malformedJson = '{"patients": [{"PATIENT_CD": "TEST001", "incomplete": }]}'

      const result = await jsonImportService.importFromJson(malformedJson)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.message.includes('JSON'))).toBe(true)
    })

    it('should handle JSON with null values', async () => {
      const jsonWithNulls = '{"patients": [{"PATIENT_CD": null, "SEX_CD": "M"}]}'

      const result = await jsonImportService.importFromJson(jsonWithNulls)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.message.includes('PATIENT_CD'))).toBe(true)
    })

    it('should handle very large JSON files gracefully', async () => {
      // Create a large JSON string
      const largePatients = Array.from({ length: 1000 }, (_, i) => ({
        PATIENT_CD: `PAT${i}`,
        SEX_CD: i % 2 === 0 ? 'M' : 'F',
      }))

      const largeJson = JSON.stringify({ patients: largePatients })

      const result = await jsonImportService.importFromJson(largeJson)

      expect(result.success).toBe(true)
      expect(result.data.patients).toHaveLength(1000)
    })
  })

  describe('Data Normalization', () => {
    it('should normalize patient sex codes', () => {
      const testCases = [
        { input: 'm', expected: 'M' },
        { input: 'F', expected: 'F' },
        { input: 'male', expected: 'M' },
        { input: 'female', expected: 'F' },
        { input: '1', expected: 'M' },
        { input: '2', expected: 'F' },
        { input: 'unknown', expected: 'U' },
        { input: 'other', expected: 'U' }, // Should default to unknown
      ]

      testCases.forEach(({ input, expected }) => {
        const result = jsonImportService.normalizeSexCode(input)
        expect(result).toBe(expected)
      })
    })

    it('should normalize visit in/out codes', () => {
      const testCases = [
        { input: 'i', expected: 'I' },
        { input: 'O', expected: 'O' },
        { input: 'inpatient', expected: 'I' },
        { input: 'outpatient', expected: 'O' },
        { input: 'emergency', expected: 'E' },
        { input: 'clinic', expected: 'clinic' }, // Should remain unchanged
      ]

      testCases.forEach(({ input, expected }) => {
        const result = jsonImportService.normalizeInOutCode(input)
        expect(result).toBe(expected)
      })
    })

    it('should normalize numeric values', () => {
      expect(jsonImportService.parseNumericValue('123')).toBe(123)
      expect(jsonImportService.parseNumericValue('123.45')).toBe(123.45)
      expect(jsonImportService.parseNumericValue('not-a-number')).toBe(null)
      expect(jsonImportService.parseNumericValue(null)).toBe(null)
      expect(jsonImportService.parseNumericValue('')).toBe(null)
    })

    it('should normalize date values', () => {
      expect(jsonImportService.normalizeDate('2024-01-15')).toBe('2024-01-15')
      expect(jsonImportService.normalizeDate('2024-01-15T10:30:00Z')).toBe('2024-01-15')
      expect(jsonImportService.normalizeDate('invalid-date')).toBe(null)
    })
  })
})
