/**
 * Unit Tests for HL7 Import Service
 *
 * Tests:
 * - HL7 CDA document parsing
 * - FHIR CDA structure validation
 * - Clinical data extraction
 * - HL7 service integration
 * - Error handling for invalid HL7
 * - File reading from test_import/ directory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportHl7Service } from '../../src/core/services/imports/import-hl7-service.js'
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

// Mock HL7 service
const mockHl7Service = {
  importFromHl7: vi.fn(),
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

describe('HL7 Import Service', () => {
  let hl7ImportService

  beforeEach(() => {
    // Mock the HL7 service constructor
    vi.mock('../../src/core/services/hl7-service.js', () => ({
      Hl7Service: vi.fn().mockImplementation(() => mockHl7Service),
    }))

    hl7ImportService = new ImportHl7Service(mockConceptRepository, mockCqlRepository)
  })

  describe('HL7 Content Parsing', () => {
    it('should parse JSON HL7 CDA correctly', () => {
      const hl7Json = {
        resourceType: 'DocumentReference',
        id: 'test-doc-123',
        type: {
          coding: [
            {
              code: '11506-3',
              display: 'Progress note',
            },
          ],
        },
        subject: {
          display: 'PAT001',
        },
        date: '2024-01-15T10:30:00Z',
        cda: {
          section: [
            {
              title: 'Patient Information',
              entry: [
                {
                  title: 'Patient ID',
                  code: [{ code: 'PATIENT_CD' }],
                  value: 'PAT001',
                },
              ],
            },
          ],
        },
      }

      const result = hl7ImportService.parseHl7Content(JSON.stringify(hl7Json))

      expect(result.resourceType).toBe('DocumentReference')
      expect(result.id).toBe('test-doc-123')
      expect(result.cda).toBeDefined()
    })

    it('should handle CDA documents without wrapper', () => {
      const cdaOnly = {
        type: 'CDA',
        section: [
          {
            title: 'Clinical Data',
          },
        ],
      }

      const result = hl7ImportService.parseHl7Content(JSON.stringify(cdaOnly))

      expect(result.type).toBe('CDA')
      expect(result.section).toBeDefined()
    })

    it('should reject XML HL7 format', () => {
      const xmlContent = '<?xml version="1.0"?><ClinicalDocument>XML content</ClinicalDocument>'

      expect(() => hl7ImportService.parseHl7Content(xmlContent)).toThrow('XML HL7 format not yet supported')
    })

    it('should reject non-HL7 JSON', () => {
      const nonHl7Json = {
        type: 'NotHL7',
        data: 'some data',
      }

      expect(() => hl7ImportService.parseHl7Content(JSON.stringify(nonHl7Json))).toThrow('does not contain valid CDA document structure')
    })

    it('should handle invalid JSON', () => {
      const invalidJson = '{invalid json}'

      expect(() => hl7ImportService.parseHl7Content(invalidJson)).toThrow('Failed to parse CDA data')
    })
  })

  describe('HL7 Validation', () => {
    it('should validate correct CDA structure', () => {
      const cdaDocument = {
        resourceType: 'DocumentReference',
        type: {
          coding: [
            {
              code: '11506-3',
              display: 'Progress note',
            },
          ],
        },
        section: [
          {
            title: 'Patient Information',
            entry: [
              {
                code: [{ code: 'PATIENT_CD' }],
                value: 'PAT001',
              },
            ],
          },
        ],
      }

      const result = hl7ImportService.validateHl7Document(cdaDocument)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing document', () => {
      const result = hl7ImportService.validateHl7Document(null)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_DOCUMENT')).toBe(true)
    })

    it('should detect missing document type', () => {
      const cdaDocument = {
        id: 'test-doc',
        subject: { display: 'PAT001' },
        // Missing type
      }

      const result = hl7ImportService.validateHl7Document(cdaDocument)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_DOCUMENT_TYPE')).toBe(true)
    })

    it('should warn about missing clinical content', () => {
      const cdaDocument = {
        resourceType: 'DocumentReference',
        type: { coding: [{ code: '11506-3' }] },
        // Missing section/entry
      }

      const result = hl7ImportService.validateHl7Document(cdaDocument)

      expect(result.isValid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'MISSING_CLINICAL_CONTENT')).toBe(true)
    })

    it('should warn about missing signature type', () => {
      const cdaDocument = {
        resourceType: 'DocumentReference',
        type: { coding: [{ code: '11506-3' }] },
        signature: {
          when: '2024-01-15T10:30:00Z',
          // Missing type
        },
      }

      const result = hl7ImportService.validateHl7Document(cdaDocument)

      expect(result.isValid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'MISSING_SIGNATURE_TYPE')).toBe(true)
    })
  })

  describe('Clinical Data Extraction', () => {
    it('should extract patient from HL7 CDA', () => {
      const patientData = {
        id: '123',
        identifier: 'PAT001',
        gender: 'male',
        birthDate: '1990-01-15',
      }

      const patient = hl7ImportService.createPatientFromHl7(patientData)

      expect(patient.PATIENT_NUM).toBeDefined()
      expect(patient.PATIENT_CD).toBe('PAT001')
      expect(patient.SEX_CD).toBe('M')
      expect(patient.BIRTH_DATE).toBe('1990-01-15')
    })

    it('should extract visit from HL7 CDA', () => {
      const visitData = {
        id: 'visit-123',
        period: {
          start: '2024-01-15T09:00:00Z',
        },
        location: {
          display: 'Emergency Department',
        },
        class: {
          code: 'EMER',
        },
      }

      const visit = hl7ImportService.createVisitFromHl7(visitData)

      expect(visit.ENCOUNTER_NUM).toBeDefined()
      expect(visit.START_DATE).toBe('2024-01-15')
      expect(visit.LOCATION_CD).toBe('Emergency Department')
      expect(visit.INOUT_CD).toBe('EMER')
    })

    it('should extract observations from HL7 CDA', () => {
      const obsData = {
        code: {
          coding: [
            {
              code: '8480-6',
              display: 'Systolic blood pressure',
            },
          ],
        },
        valueQuantity: {
          value: 120,
          unit: 'mmHg',
        },
        effectiveDateTime: '2024-01-15T10:30:00Z',
      }

      const observation = hl7ImportService.createObservationFromHl7(obsData)

      expect(observation.CONCEPT_CD).toBe('8480-6')
      expect(observation.VALTYPE_CD).toBe('N')
      expect(observation.NVAL_NUM).toBe(120)
      expect(observation.START_DATE).toBe('2024-01-15')
    })

    it('should handle different HL7 value types', () => {
      const testCases = [
        {
          data: { valueString: 'Normal' },
          expected: { VALTYPE_CD: 'T', TVAL_CHAR: 'Normal' },
        },
        {
          data: { valueDateTime: '2024-01-15' },
          expected: { VALTYPE_CD: 'D', TVAL_CHAR: '2024-01-15' },
        },
        {
          data: { valueBoolean: true },
          expected: { VALTYPE_CD: 'T', TVAL_CHAR: 'Yes' },
        },
        {
          data: { value: 'fallback value' },
          expected: { VALTYPE_CD: 'T', TVAL_CHAR: 'fallback value' },
        },
      ]

      testCases.forEach(({ data, expected }) => {
        const observation = hl7ImportService.createObservationFromHl7(data)
        expect(observation.VALTYPE_CD).toBe(expected.VALTYPE_CD)
        if (expected.TVAL_CHAR) {
          expect(observation.TVAL_CHAR).toBe(expected.TVAL_CHAR)
        }
      })
    })
  })

  describe('HL7 Service Integration', () => {
    beforeEach(() => {
      mockHl7Service.importFromHl7.mockReset()
    })

    it('should integrate with HL7 service successfully', async () => {
      const mockHl7Result = {
        success: true,
        data: {
          patients: [
            {
              id: '123',
              identifier: 'PAT001',
              gender: 'male',
            },
          ],
          visits: [],
          observations: [],
        },
        metadata: {
          documentId: 'test-doc-123',
          documentType: 'Progress note',
        },
      }

      mockHl7Service.importFromHl7.mockResolvedValue(mockHl7Result)

      const hl7Content = JSON.stringify({
        resourceType: 'DocumentReference',
        cda: { section: [] },
      })

      const result = await hl7ImportService.importFromHl7(hl7Content)

      expect(mockHl7Service.importFromHl7).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.data.patients).toHaveLength(1)
      expect(result.metadata.documentId).toBe('test-doc-123')
    })

    it('should handle HL7 service errors', async () => {
      const mockHl7Error = {
        success: false,
        errors: [
          {
            code: 'SIGNATURE_VERIFICATION_FAILED',
            message: 'Document signature verification failed',
          },
        ],
      }

      mockHl7Service.importFromHl7.mockResolvedValue(mockHl7Error)

      const hl7Content = JSON.stringify({
        resourceType: 'DocumentReference',
        cda: { section: [] },
      })

      const result = await hl7ImportService.importFromHl7(hl7Content)

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('SIGNATURE_VERIFICATION_FAILED')
    })
  })

  describe('File Import Tests', () => {
    beforeEach(() => {
      mockHl7Service.importFromHl7.mockReset()
    })

    it('should import from 03_hl7_fhir_json_cda.hl7 test file', async () => {
      const hl7Content = readTestFile('03_hl7_fhir_json_cda.hl7')
      if (!hl7Content) {
        console.warn('Skipping test: 03_hl7_fhir_json_cda.hl7 not found')
        return
      }

      const mockHl7Result = {
        success: true,
        data: {
          patients: [{ id: 'test-patient' }],
          visits: [],
          observations: [],
        },
        metadata: {
          documentId: 'test-doc',
          documentType: 'Test Document',
        },
      }

      mockHl7Service.importFromHl7.mockResolvedValue(mockHl7Result)

      const result = await hl7ImportService.importFromHl7(hl7Content)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(mockHl7Service.importFromHl7).toHaveBeenCalledTimes(1)
    })

    it('should import from patient_10019815_2023-01-22_HL7.json test file', async () => {
      const hl7Content = readTestFile('patient_10019815_2023-01-22_HL7.json')
      if (!hl7Content) {
        console.warn('Skipping test: patient_10019815_2023-01-22_HL7.json not found')
        return
      }

      const mockHl7Result = {
        success: true,
        data: {
          patients: [{ id: '10019815' }],
          visits: [],
          observations: [],
        },
        metadata: {
          documentId: 'hl7-doc-10019815',
          documentType: 'Patient Document',
        },
      }

      mockHl7Service.importFromHl7.mockResolvedValue(mockHl7Result)

      const result = await hl7ImportService.importFromHl7(hl7Content)

      expect(result.success).toBe(true)
      expect(result.data.patients).toHaveLength(1)
    })

    it('should handle invalid HL7 format gracefully', async () => {
      const invalidHl7 = 'This is not HL7 data'

      const result = await hl7ImportService.importFromHl7(invalidHl7)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle empty HL7 content', async () => {
      const emptyHl7 = ''

      const result = await hl7ImportService.importFromHl7(emptyHl7)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe('Metadata Extraction', () => {
    it('should extract metadata from HL7 document', () => {
      const cdaDocument = {
        id: 'doc-123',
        type: {
          coding: [
            {
              code: '11506-3',
              display: 'Progress note',
            },
          ],
        },
        date: '2024-01-15T10:30:00Z',
        author: [
          {
            name: 'Dr. Smith',
          },
        ],
        custodian: {
          display: 'General Hospital',
        },
      }

      const metadata = hl7ImportService.extractHl7Metadata(cdaDocument)

      expect(metadata.documentId).toBe('doc-123')
      expect(metadata.documentType).toBe('Progress note')
      expect(metadata.documentDate).toBe('2024-01-15T10:30:00Z')
      expect(metadata.author).toBe('Dr. Smith')
      expect(metadata.custodian).toBe('General Hospital')
    })

    it('should handle missing metadata fields', () => {
      const minimalDocument = {
        id: 'minimal-doc',
      }

      const metadata = hl7ImportService.extractHl7Metadata(minimalDocument)

      expect(metadata.documentId).toBe('minimal-doc')
      expect(metadata.documentType).toBe('HL7 CDA')
      expect(metadata.source).toBe('Unknown')
      expect(metadata.created).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle HL7 service failures gracefully', async () => {
      mockHl7Service.importFromHl7.mockRejectedValue(new Error('HL7 service error'))

      const hl7Content = JSON.stringify({ resourceType: 'DocumentReference' })

      const result = await hl7ImportService.importFromHl7(hl7Content)

      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('Import failed: HL7 service error')
    })

    it('should handle malformed CDA documents', async () => {
      const malformedCda = JSON.stringify({
        resourceType: 'DocumentReference',
        cda: null, // Missing CDA content
      })

      mockHl7Service.importFromHl7.mockResolvedValue({
        success: false,
        errors: [{ code: 'INVALID_CDA', message: 'CDA structure invalid' }],
      })

      const result = await hl7ImportService.importFromHl7(malformedCda)

      expect(result.success).toBe(false)
    })
  })
})
