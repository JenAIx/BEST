/**
 * Unit Tests for Main Import Service
 *
 * Tests the core ImportService orchestrator that handles format detection
 * and routing to appropriate import services.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportService } from '../../src/core/services/imports/import-service.js'

// Mock repositories
const mockConceptRepository = {
  findByConceptCode: vi.fn(),
  getConceptByCode: vi.fn(),
}

const mockCqlRepository = {
  getCqlRules: vi.fn(),
}

// Mock database store
const mockDatabaseStore = {
  executeQuery: vi.fn(),
}

describe('Import Service', () => {
  let importService

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create service instance
    importService = new ImportService(mockDatabaseStore, mockConceptRepository, mockCqlRepository)
  })

  describe('Format Detection', () => {
    it('should detect CSV format by extension', () => {
      const format = importService.detectFormat('col1,col2\nval1,val2', 'test.csv')
      expect(format).toBe('csv')
    })

    it('should detect JSON format by extension', () => {
      const jsonContent = '{"test": "data"}'
      const format = importService.detectFormat(jsonContent, 'test.json')
      expect(format).toBe('json')
    })

    it('should detect HL7 format by extension', () => {
      const hl7Content = '{"resourceType": "Composition"}'
      const format = importService.detectFormat(hl7Content, 'test.hl7')
      expect(format).toBe('hl7')
    })

    it('should detect HTML format by extension', () => {
      const htmlContent = '<html><body>test</body></html>'
      const format = importService.detectFormat(htmlContent, 'test.html')
      expect(format).toBe('html')
    })

    it('should detect CSV format by content', () => {
      const csvContent = 'col1,col2\nval1,val2'
      const format = importService.detectFormat(csvContent, 'test.txt')
      expect(format).toBe('csv')
    })

    it('should detect JSON format by content', () => {
      const jsonContent = '{"test": "data"}'
      const format = importService.detectFormat(jsonContent, 'test.txt')
      expect(format).toBe('json')
    })

    it('should detect HL7 format by FHIR content', () => {
      const hl7Content = '{"resourceType": "Composition", "test": "data"}'
      const format = importService.detectFormat(hl7Content, 'test.txt')
      expect(format).toBe('hl7')
    })

    it('should detect HTML format by content', () => {
      const htmlContent = '<html><script>{"cda": "test"}</script></html>'
      const format = importService.detectFormat(htmlContent, 'test.txt')
      expect(format).toBe('html')
    })

    it('should return null for unsupported format', () => {
      const unknownContent = 'plain text content'
      const format = importService.detectFormat(unknownContent, 'test.unknown')
      expect(format).toBeNull()
    })
  })

  describe('Content Type Detection', () => {
    it('should identify CSV content', () => {
      const csvContent = 'col1,col2\nval1,val2'
      expect(importService.isCsvContent(csvContent)).toBe(true)

      const nonCsvContent = 'plain text'
      expect(importService.isCsvContent(nonCsvContent)).toBe(false)
    })

    it('should identify JSON content', () => {
      const jsonContent = '{"test": "data"}'
      expect(importService.isJsonContent(jsonContent)).toBe(true)

      const invalidJson = '{invalid json}'
      expect(importService.isJsonContent(invalidJson)).toBe(false)
    })

    it('should identify HL7 content', () => {
      const hl7Content = '{"resourceType": "Composition"}'
      expect(importService.isHl7Content(hl7Content)).toBe(true)

      const xmlContent = '<ClinicalDocument>test</ClinicalDocument>'
      expect(importService.isHl7Content(xmlContent)).toBe(true)

      const regularJson = '{"test": "data"}'
      expect(importService.isHl7Content(regularJson)).toBe(false)
    })

    it('should identify HTML content', () => {
      const htmlContent = '<html><body>test</body></html>'
      expect(importService.isHtmlContent(htmlContent)).toBe(true)

      const scriptContent = '<script>{"cda": "test"}</script>'
      expect(importService.isHtmlContent(scriptContent)).toBe(true)

      const plainText = 'plain text'
      expect(importService.isHtmlContent(plainText)).toBe(false)
    })
  })

  describe('Configuration', () => {
    it('should return supported formats', () => {
      const formats = importService.getSupportedFormats()
      expect(formats).toEqual(['csv', 'json', 'hl7', 'html'])
    })

    it('should update configuration', () => {
      const newConfig = {
        maxFileSize: '100MB',
        validationLevel: 'lenient',
      }

      importService.updateConfig(newConfig)

      expect(importService.config.maxFileSize).toBe('100MB')
      expect(importService.config.validationLevel).toBe('lenient')
    })
  })

  describe('File Size Validation', () => {
    it('should validate file size within limits', () => {
      const smallContent = 'small content'
      expect(importService.validateFileSize(smallContent)).toBe(true)
    })

    it('should parse file size strings correctly', () => {
      expect(importService.parseFileSize('1MB')).toBe(1024 * 1024)
      expect(importService.parseFileSize('1KB')).toBe(1024)
      expect(importService.parseFileSize('1GB')).toBe(1024 * 1024 * 1024)
      expect(importService.parseFileSize('50MB')).toBe(50 * 1024 * 1024)
    })

    it('should return default size for invalid format', () => {
      expect(importService.parseFileSize('invalid')).toBe(50 * 1024 * 1024)
    })
  })

  describe('Error Handling', () => {
    it('should create error result correctly', () => {
      const error = importService.createErrorResult('TEST_ERROR', 'Test error message')

      expect(error.success).toBe(false)
      expect(error.data).toBeNull()
      expect(error.errors).toHaveLength(1)
      expect(error.errors[0].code).toBe('TEST_ERROR')
      expect(error.errors[0].message).toBe('Test error message')
      expect(error.warnings).toHaveLength(0)
    })

    it('should handle import failure gracefully', async () => {
      const result = await importService.importFile('invalid content', 'test.unknown')

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('UNSUPPORTED_FORMAT')
    })
  })

  describe('File Content Analysis', () => {
    describe('analyzeFileContent', () => {
      it('should analyze CSV content successfully', async () => {
        const csvContent = `Patient ID,Gender,Age,Visit Date,BMI
PAT001,M,45,2024-01-15,25.5
PAT002,F,32,2024-01-16,22.1
PAT003,M,67,2024-01-17,28.3`

        const result = await importService.analyzeFileContent(csvContent, 'test.csv')

        expect(result.success).toBe(true)
        expect(result.format).toBe('csv')
        expect(result.patientsCount).toBeGreaterThan(0)
        expect(result.observationsCount).toBe(3)
        expect(result.recommendedStrategy).toBeDefined()
        expect(result.estimatedImportTime).toBeDefined()
      })

      it('should analyze JSON content successfully', async () => {
        const jsonContent = JSON.stringify({
          patients: [
            { PATIENT_CD: 'PAT001', SEX_CD: 'M', AGE_IN_YEARS: 45 },
            { PATIENT_CD: 'PAT002', SEX_CD: 'F', AGE_IN_YEARS: 32 }
          ],
          visits: [
            { ENCOUNTER_NUM: 1, PATIENT_NUM: 1 },
            { ENCOUNTER_NUM: 2, PATIENT_NUM: 2 }
          ],
          observations: [
            { PATIENT_NUM: 1, ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:123' }
          ]
        })

        const result = await importService.analyzeFileContent(jsonContent, 'test.json')

        expect(result.success).toBe(true)
        expect(result.format).toBe('json')
        expect(result.patientsCount).toBe(2)
        expect(result.visitsCount).toBe(2)
        expect(result.observationsCount).toBe(1)
      })

      it('should analyze HL7 CDA content successfully', async () => {
        const hl7Content = JSON.stringify({
          resourceType: 'Composition',
          subject: { display: 'PAT001' },
          section: [
            { title: 'Vital Signs', entry: [{ value: '120/80' }] },
            { title: 'Labs', entry: [{ value: '5.5' }] }
          ]
        })

        const result = await importService.analyzeFileContent(hl7Content, 'test.hl7')

        expect(result.success).toBe(true)
        expect(result.format).toBe('hl7')
        expect(result.patientsCount).toBe(1)
        expect(result.visitsCount).toBe(1)
        expect(result.observationsCount).toBe(2)
      })

      it('should analyze HTML survey content successfully', async () => {
        const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <script>
      CDA = {
        "cda": {
          "subject": { "display": "PAT001" },
          "section": [
            { "title": "Assessment", "entry": [{ "value": 25 }] }
          ]
        }
      }
    </script>
  </head>
  <body>Survey Results</body>
</html>`

        const result = await importService.analyzeFileContent(htmlContent, 'test.html')

        expect(result.success).toBe(true)
        expect(result.format).toBe('html')
        expect(result.patientsCount).toBe(1)
        expect(result.visitsCount).toBe(1)
        expect(result.observationsCount).toBe(1)
      })

      it('should handle unsupported format gracefully', async () => {
        const result = await importService.analyzeFileContent('plain text content', 'test.txt')

        expect(result.success).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].code).toBe('UNSUPPORTED_FORMAT')
      })

      it('should recommend single_patient strategy for single patient', async () => {
        const csvContent = `Patient ID,Gender,Age
PAT001,M,45`

        const result = await importService.analyzeFileContent(csvContent, 'test.csv')

        expect(result.recommendedStrategy).toBe('single_patient')
      })

      it('should recommend batch_import strategy for multiple patients', async () => {
        const csvContent = `Patient ID,Gender,Age
PAT001,M,45
PAT002,F,32
PAT003,M,67
PAT004,F,28
PAT005,M,55`

        const result = await importService.analyzeFileContent(csvContent, 'test.csv')

        expect(result.recommendedStrategy).toBe('batch_import')
      })

      it('should recommend interactive strategy for many patients', async () => {
        // Create CSV with 15 patients
        const patients = []
        for (let i = 1; i <= 15; i++) {
          patients.push(`PAT${String(i).padStart(3, '0')},M,${30 + i}`)
        }
        const csvContent = `Patient ID,Gender,Age\n${patients.join('\n')}`

        const result = await importService.analyzeFileContent(csvContent, 'test.csv')

        expect(result.recommendedStrategy).toBe('interactive')
      })

      it('should estimate import time correctly', async () => {
        const csvContent = `Patient ID,Gender,Age
PAT001,M,45`

        const result = await importService.analyzeFileContent(csvContent, 'test.csv')

        expect(result.estimatedImportTime).toBeDefined()
        expect(typeof result.estimatedImportTime).toBe('string')
      })

      it('should handle malformed CSV gracefully', async () => {
        const malformedCsv = 'malformed content without proper structure'

        const result = await importService.analyzeFileContent(malformedCsv, 'test.csv')

        // CSV analysis should succeed even with malformed content, just with warnings
        expect(result.success).toBe(true)
        expect(result.warnings).toBeDefined()
      })

      it('should handle invalid JSON gracefully', async () => {
        const invalidJson = '{invalid json content}'

        const result = await importService.analyzeFileContent(invalidJson, 'test.json')

        expect(result.success).toBe(false)
        expect(result.errors).toHaveLength(1)
      })

      it('should detect CSV delimiter correctly', () => {
        const commaDelimited = 'col1,col2,col3\nval1,val2,val3'
        const semicolonDelimited = 'col1;col2;col3\nval1;val2;val3'

        expect(importService.detectCsvDelimiter(commaDelimited)).toBe(',')
        expect(importService.detectCsvDelimiter(semicolonDelimited)).toBe(';')
      })

      it('should extract patient information from CSV', async () => {
        const csvContent = `Patient ID,Gender,Age,Patient Name
PAT001,M,45,John Doe
PAT002,F,32,Jane Smith`

        const result = await importService.analyzeFileContent(csvContent, 'test.csv')

        expect(result.patients).toBeDefined()
        expect(result.patients.length).toBeGreaterThan(0)
        expect(result.patients[0]).toHaveProperty('id')
        expect(result.patients[0]).toHaveProperty('name')
      })

      it('should handle files with no patient data', async () => {
        const csvContent = `Some Column,Another Column
Value1,Value2
Value3,Value4`

        const result = await importService.analyzeFileContent(csvContent, 'test.csv')

        expect(result.success).toBe(true)
        expect(result.patientsCount).toBe(0)
        expect(result.warnings).toContain('No patient data detected - will use single patient mode')
      })
    })

    describe('CSV Analysis Helper Methods', () => {
      it('should parse CSV headers and detect patient columns', () => {
        const headerLine = 'PATIENT_CD,SEX_CD,AGE_IN_YEARS,START_DATE'
        const delimiter = ','

        // This is internal method testing - we test through the public interface
        const csvContent = `${headerLine}\nPAT001,M,45,2024-01-15`
        expect(() => importService.analyzeCsvContent(csvContent, {})).not.toThrow()
      })

      it('should handle CSV with different delimiters', async () => {
        const semicolonCsv = `Patient ID;Gender;Age
PAT001;M;45
PAT002;F;32`

        const result = await importService.analyzeFileContent(semicolonCsv, 'test.csv')

        expect(result.success).toBe(true)
        expect(result.patientsCount).toBeGreaterThan(0)
      })
    })

    describe('Strategy Determination', () => {
      it('should determine strategy based on patient count', () => {
        const analysis = { patientsCount: 0 }
        importService.determineRecommendedStrategy(analysis)
        expect(analysis.recommendedStrategy).toBe('single_patient')

        analysis.patientsCount = 1
        importService.determineRecommendedStrategy(analysis)
        expect(analysis.recommendedStrategy).toBe('single_patient')

        analysis.patientsCount = 5
        importService.determineRecommendedStrategy(analysis)
        expect(analysis.recommendedStrategy).toBe('batch_import')

        analysis.patientsCount = 15
        importService.determineRecommendedStrategy(analysis)
        expect(analysis.recommendedStrategy).toBe('interactive')
      })
    })

    describe('Import Time Estimation', () => {
      it('should estimate time based on record count', () => {
        expect(importService.estimateImportTime({ patientsCount: 0, visitsCount: 0, observationsCount: 0 })).toBe('Instant')
        expect(importService.estimateImportTime({ patientsCount: 1, visitsCount: 1, observationsCount: 5 })).toBe('< 1 minute')
        expect(importService.estimateImportTime({ patientsCount: 5, visitsCount: 10, observationsCount: 50 })).toBe('1-2 minutes')
        expect(importService.estimateImportTime({ patientsCount: 10, visitsCount: 20, observationsCount: 500 })).toBe('2-5 minutes')
        expect(importService.estimateImportTime({ patientsCount: 20, visitsCount: 50, observationsCount: 5000 })).toBe('5-15 minutes')
        expect(importService.estimateImportTime({ patientsCount: 50, visitsCount: 100, observationsCount: 50000 })).toBe('15+ minutes')
      })
    })
  })
})
