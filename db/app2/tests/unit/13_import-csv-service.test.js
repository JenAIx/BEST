/**
 * Unit Tests for CSV Import Service
 *
 * Tests:
 * - CSV variant detection (Variant A vs Variant B)
 * - Two-header CSV parsing (Variant A)
 * - Three-header CSV parsing (Variant B)
 * - Data validation and error handling
 * - Clinical data transformation
 * - File reading from test_import/ directory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportCsvService } from '../../src/core/services/imports/import-csv-service.js'
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

describe('CSV Import Service', () => {
  let csvImportService

  beforeEach(() => {
    csvImportService = new ImportCsvService(mockConceptRepository, mockCqlRepository)
  })

  describe('Variant Detection', () => {
    it('should detect Variant A (two-header) format', () => {
      const csvContent = `# Export Date: 2025-09-01T08:31:47.595Z
# Source: BEST Medical System
Patient ID,Gender,Age,Date of Birth
PATIENT_CD,SEX_CD,AGE_IN_YEARS,BIRTH_DATE
DEMO_PATIENT_01,M,32,1993-05-10`

      const variant = csvImportService.detectCsvVariant(csvContent)
      expect(variant).toBe('variantA')
    })

    it('should detect Variant B (four-header) format', () => {
      const csvContent = `FIELD_NAME;VALTYPE_CD;UNIT_CD;NAME_CHAR
PATIENT_CD;T;;Patient ID
SEX_CD;T;;Gender
AGE_IN_YEARS;N;;Age
BIRTH_DATE;D;;Date of Birth
DEMO_PATIENT_01;M;;32;1993-05-10`

      const variant = csvImportService.detectCsvVariant(csvContent)
      expect(variant).toBe('variantB')
    })

    it('should throw error for insufficient headers', () => {
      const csvContent = `Single Header Only`

      expect(() => csvImportService.detectCsvVariant(csvContent)).toThrow()
    })
  })

  describe('CSV Parsing - Variant A', () => {
    it('should parse Variant A CSV correctly', () => {
      const csvContent = `# Export Date: 2025-09-01T08:31:47.595Z
# Source: BEST Medical System
Patient ID,Gender,Age,Date of Birth,Visit Date
PATIENT_CD,SEX_CD,AGE_IN_YEARS,BIRTH_DATE,START_DATE
DEMO_PATIENT_01,M,32,1993-05-10,2024-11-29
DEMO_PATIENT_02,F,28,1996-03-15,2024-11-30`

      const parsedData = csvImportService.parseCsvContent(csvContent, 'variantA')

      expect(parsedData.variant).toBe('variantA')
      expect(parsedData.headers.humanReadable).toEqual(['Patient ID', 'Gender', 'Age', 'Date of Birth', 'Visit Date'])
      expect(parsedData.headers.conceptCodes).toEqual(['PATIENT_CD', 'SEX_CD', 'AGE_IN_YEARS', 'BIRTH_DATE', 'START_DATE'])
      expect(parsedData.dataRows).toHaveLength(2)
      expect(parsedData.dataRows[0]).toEqual(['DEMO_PATIENT_01', 'M', '32', '1993-05-10', '2024-11-29'])
    })

    it('should extract metadata from comments', () => {
      const csvContent = `# Export Date: 2025-01-15T10:30:00Z
# Source: EHR System
# Version: 2.0
# Description: Patient export for research
Patient ID,Gender
PATIENT_CD,SEX_CD
PAT001,M`

      const parsedData = csvImportService.parseCsvContent(csvContent, 'variantA')

      expect(parsedData.metadata.exportDate).toBe('2025-01-15T10:30:00Z')
      expect(parsedData.metadata.source).toBe('EHR System')
      expect(parsedData.metadata.version).toBe('2.0')
      expect(parsedData.metadata.description).toBe('Description: Patient export for research')
    })
  })

  describe('CSV Parsing - Variant B', () => {
    it('should parse Variant B CSV correctly', () => {
      const csvContent = `FIELD_NAME;VALTYPE_CD;UNIT_CD;NAME_CHAR
PATIENT_CD;T;;Patient ID
SEX_CD;T;;Gender
AGE_IN_YEARS;N;;Age
BIRTH_DATE;D;;Date of Birth
START_DATE;D;;Visit Date
DEMO_PATIENT_01;M;;32;1993-05-10;2024-11-29
DEMO_PATIENT_02;F;;28;1996-03-15;2024-11-30`

      const parsedData = csvImportService.parseCsvContent(csvContent, 'variantB')

      expect(parsedData.variant).toBe('variantB')
      expect(parsedData.headers.fieldNames).toEqual(['FIELD_NAME', 'VALTYPE_CD', 'UNIT_CD', 'NAME_CHAR'])
      expect(parsedData.headers.valtypeCodes).toEqual(['PATIENT_CD', 'T', '', 'Patient ID'])
      expect(parsedData.headers.unitCodes).toEqual(['SEX_CD', 'T', '', 'Gender'])
      expect(parsedData.headers.nameChars).toEqual(['AGE_IN_YEARS', 'N', '', 'Age'])
      expect(parsedData.dataRows).toHaveLength(4)
    })
  })

  describe('CSV Validation', () => {
    it('should validate correct Variant A structure', () => {
      const parsedData = {
        headers: {
          humanReadable: ['Patient ID', 'Gender'],
          conceptCodes: ['PATIENT_CD', 'SEX_CD'],
        },
        dataRows: [['PAT001', 'M']],
      }

      const result = csvImportService.validateCsvStructure(parsedData, 'variantA')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect header length mismatch in Variant A', () => {
      const parsedData = {
        headers: {
          humanReadable: ['Patient ID', 'Gender', 'Age'],
          conceptCodes: ['PATIENT_CD', 'SEX_CD'], // Missing one
        },
        dataRows: [['PAT001', 'M', '30']],
      }

      const result = csvImportService.validateCsvStructure(parsedData, 'variantA')
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'HEADER_MISMATCH')).toBe(true)
    })

    it('should detect missing data rows', () => {
      const parsedData = {
        headers: {
          humanReadable: ['Patient ID'],
          conceptCodes: ['PATIENT_CD'],
        },
        dataRows: [],
      }

      const result = csvImportService.validateCsvStructure(parsedData, 'variantA')
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'NO_DATA_ROWS')).toBe(true)
    })
  })

  describe('Clinical Data Transformation', () => {
    it('should transform Variant A data to clinical objects', async () => {
      const parsedData = {
        headers: {
          humanReadable: ['Patient ID', 'Gender', 'Age', 'Date of Birth'],
          conceptCodes: ['PATIENT_CD', 'SEX_CD', 'AGE_IN_YEARS', 'BIRTH_DATE'],
        },
        dataRows: [['DEMO_PATIENT_01', 'M', '32', '1993-05-10']],
        metadata: {},
      }

      const clinicalData = await csvImportService.transformCsvToClinical(parsedData, 'variantA')

      expect(clinicalData.patients).toHaveLength(1)
      expect(clinicalData.patients[0].PATIENT_CD).toBe('DEMO_PATIENT_01')
      expect(clinicalData.patients[0].SEX_CD).toBe('M')
      expect(clinicalData.patients[0].AGE_IN_YEARS).toBe(32)
      expect(clinicalData.patients[0].BIRTH_DATE).toBe('1993-05-10')
    })

    it('should handle visits and observations', async () => {
      const parsedData = {
        headers: {
          humanReadable: ['Patient ID', 'Visit Date', 'Blood Pressure'],
          conceptCodes: ['PATIENT_CD', 'START_DATE', 'CUSTOM:BP_SYSTOLIC'],
        },
        dataRows: [['DEMO_PATIENT_01', '2024-11-29', '120']],
        metadata: {},
      }

      const clinicalData = await csvImportService.transformCsvToClinical(parsedData, 'variantA')

      expect(clinicalData.patients).toHaveLength(1)
      expect(clinicalData.visits).toHaveLength(1)
      expect(clinicalData.observations).toHaveLength(1) // Visit-level observation
    })
  })

  describe('File Import Tests', () => {
    it('should import from 01_csv_data.csv test file', async () => {
      const csvContent = readTestFile('01_csv_data.csv')
      if (!csvContent) {
        console.warn('Skipping test: 01_csv_data.csv not found')
        return
      }

      const result = await csvImportService.importFromCsv(csvContent)

      expect(result.success).toBe(true)
      expect(result.metadata.variant).toBe('variantA')
      expect(result.data).toBeDefined()
      expect(result.data.patients).toBeDefined()
      expect(result.data.patients.length).toBeGreaterThan(0)
    })

    it('should import from Export-Tabelle-20230313.csv test file', async () => {
      const csvContent = readTestFile('Export-Tabelle-20230313.csv')
      if (!csvContent) {
        console.warn('Skipping test: Export-Tabelle-20230313.csv not found')
        return
      }

      const result = await csvImportService.importFromCsv(csvContent)

      expect(result.success).toBe(true)
      expect(result.metadata.variant).toBe('variantB')
      expect(result.data).toBeDefined()
      expect(result.data.patients).toBeDefined()
      expect(result.data.patients.length).toBeGreaterThan(0)
    })

    it('should handle invalid CSV gracefully', async () => {
      const invalidCsv = 'This is not CSV data'

      const result = await csvImportService.importFromCsv(invalidCsv)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle empty CSV', async () => {
      const emptyCsv = ''

      const result = await csvImportService.importFromCsv(emptyCsv)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed CSV with proper error messages', async () => {
      const malformedCsv = `Patient ID,Gender
PATIENT_CD,SEX_CD
PAT001,M,ExtraColumn`

      const result = await csvImportService.importFromCsv(malformedCsv)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should handle CSV with missing required fields', async () => {
      const csvWithoutPatientId = `Gender,Age
SEX_CD,AGE_IN_YEARS
M,32`

      const result = await csvImportService.importFromCsv(csvWithoutPatientId)

      expect(result.success).toBe(true)
      expect(result.warnings.some((w) => w.message.includes('PATIENT_CD'))).toBe(true)
    })
  })

  describe('Data Type Detection', () => {
    it('should detect numeric values correctly', () => {
      expect(csvImportService.determineValtypeCd('123')).toBe('N')
      expect(csvImportService.determineValtypeCd('123.45')).toBe('N')
      expect(csvImportService.determineValtypeCd('-42')).toBe('N')
    })

    it('should detect date values correctly', () => {
      expect(csvImportService.determineValtypeCd('2024-11-29')).toBe('D')
      expect(csvImportService.determineValtypeCd('11/29/2024')).toBe('D')
      expect(csvImportService.determineValtypeCd('29.11.2024')).toBe('D')
    })

    it('should detect text values correctly', () => {
      expect(csvImportService.determineValtypeCd('Normal')).toBe('T')
      expect(csvImportService.determineValtypeCd('Yes')).toBe('T')
      expect(csvImportService.determineValtypeCd('')).toBe('T')
    })

    it('should detect BLOB values correctly', () => {
      expect(csvImportService.determineValtypeCd('{"key": "value"}')).toBe('B')
      expect(csvImportService.determineValtypeCd('["item1", "item2"]')).toBe('B')
    })
  })
})
