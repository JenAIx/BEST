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
})
