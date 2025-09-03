/**
 * Unit Tests for HL7 Service
 *
 * Tests:
 * - CDA document creation and export
 * - Document metadata preparation
 * - HTML text generation
 * - Patient, visit, and observation sections
 * - Digital signature generation and verification
 * - HL7 import with data extraction
 * - Template management
 * - Error handling and validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hl7Service } from '../../src/core/services/hl7-service.js'
import fs from 'fs'
import path from 'path'

// Mock repositories
const mockConceptRepository = {
  getConceptByCode: vi.fn(),
}

const mockCqlRepository = {
  getCqlRules: vi.fn(),
}

// Helper function to write JSON output
const writeTestOutput = (filename, data, description = '') => {
  try {
    const outputDir = path.join(process.cwd(), 'tests', 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const outputData = {
      timestamp: new Date().toISOString(),
      description: description,
      data: data,
    }

    const filepath = path.join(outputDir, filename)
    fs.writeFileSync(filepath, JSON.stringify(outputData, null, 2))
    console.log(`📄 Test output written to: ${filepath}`)
  } catch (error) {
    console.warn(`⚠️  Failed to write test output: ${error.message}`)
  }
}

describe('HL7 Service', () => {
  let hl7Service

  beforeEach(() => {
    hl7Service = new Hl7Service(mockConceptRepository, mockCqlRepository)
    vi.clearAllMocks()
  })

  describe('Service Initialization', () => {
    it('should initialize with default template', () => {
      expect(hl7Service.defaultTemplate).toBeDefined()
      expect(hl7Service.defaultTemplate.resourceType).toBe('Composition')
      expect(hl7Service.defaultTemplate.type.coding[0].code).toBe('404684003')
    })

    it('should accept custom repositories', () => {
      expect(hl7Service.conceptRepository).toBe(mockConceptRepository)
      expect(hl7Service.cqlRepository).toBe(mockCqlRepository)
    })
  })

  describe('Template Management', () => {
    it('should get default template', () => {
      const template = hl7Service.getDefaultTemplate()
      expect(template.resourceType).toBe('Composition')
      expect(template.meta).toBeDefined()
      expect(template.type).toBeDefined()
    })

    it('should set custom template', () => {
      const customTemplate = {
        title: 'Custom Title',
        language: 'en-US',
      }

      hl7Service.setTemplate(customTemplate)
      expect(hl7Service.defaultTemplate.title).toBe('Custom Title')
      expect(hl7Service.defaultTemplate.language).toBe('en-US')
    })

    it('should get current template', () => {
      const template = hl7Service.getTemplate()
      expect(template).toEqual(hl7Service.defaultTemplate)
      expect(template).not.toBe(hl7Service.defaultTemplate) // Should be a copy
    })
  })

  describe('CDA Document Creation', () => {
    const mockPatients = [{ PATIENT_NUM: 1, PATIENT_CD: 'TEST001', SEX_CD: 'M', AGE_IN_YEARS: 30 }]

    const mockVisits = [{ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15', LOCATION_CD: 'EMERGENCY', INOUT_CD: 'I' }]

    const mockObservations = [{ ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:8302-2', VALTYPE_CD: 'N', NVAL_NUM: 180, START_DATE: '2024-01-15' }]

    it('should create CDA document with basic structure', async () => {
      const cda = await hl7Service.createCdaDocument(mockPatients, mockVisits, mockObservations)

      expect(cda.resourceType).toBe('Composition')
      expect(cda.section).toBeDefined()
      expect(cda.section.length).toBeGreaterThan(0)
      expect(cda.text).toBeDefined()
      expect(cda.text.div).toContain('Clinical Data Export')

      // Write test output
      writeTestOutput('hl7-cda-document-basic.json', cda, 'Basic CDA document structure with patients, visits, and observations')
    })

    it('should prepare document metadata correctly', async () => {
      const metadata = {
        title: 'Test Export',
        version: '2.0',
        source: 'Test Source',
      }

      const cda = await hl7Service.createCdaDocument(mockPatients, mockVisits, mockObservations, metadata)

      expect(cda.title).toBe('Test Export')
      expect(cda.meta.versionId).toBe('2.0')
      expect(cda.meta.source).toBe('Test Source')
      expect(cda.id).toMatch(/^dbBEST-/)
      expect(cda.identifier.value).toMatch(/^urn:uuid:/)
    })

    it('should generate HTML text with summary tables', async () => {
      const cda = await hl7Service.createCdaDocument(mockPatients, mockVisits, mockObservations)

      expect(cda.text.div).toContain('<table id="summary_table">')
      expect(cda.text.div).toContain('<table id="description_table">')
      expect(cda.text.div).toContain('<table id="subjects_table">')
      expect(cda.text.div).toContain('Patients: 1')
      expect(cda.text.div).toContain('Visits: 1')
      expect(cda.text.div).toContain('Observations: 1')
    })

    it('should create patient section with demographics', async () => {
      const cda = await hl7Service.createCdaDocument(mockPatients, mockVisits, mockObservations)

      const patientSection = cda.section.find((s) => s.title === 'Patient Information')
      expect(patientSection).toBeDefined()
      expect(patientSection.entry.length).toBe(3) // Patient code + gender + age

      const patientEntry = patientSection.entry.find((e) => e.title.includes('TEST001'))
      expect(patientEntry).toBeDefined()
      expect(patientEntry.value).toBe('TEST001')
    })

    it('should create visit sections with details', async () => {
      const cda = await hl7Service.createCdaDocument(mockPatients, mockVisits, mockObservations)

      const visitSection = cda.section.find((s) => s.title === 'Visit 1')
      expect(visitSection).toBeDefined()
      expect(visitSection.entry.length).toBeGreaterThan(0)

      const dateEntry = visitSection.entry.find((e) => e.title === 'Visit Date')
      expect(dateEntry).toBeDefined()
      expect(dateEntry.value).toBe('2024-01-15')
    })

    it('should create observation sections grouped by concept', async () => {
      const cda = await hl7Service.createCdaDocument(mockPatients, mockVisits, mockObservations)

      const obsSection = cda.section.find((s) => s.title === 'Height')
      expect(obsSection).toBeDefined()
      expect(obsSection.entry.length).toBe(1)

      const obsEntry = obsSection.entry[0]
      expect(obsEntry.value).toBe(180)
      expect(obsEntry.code[0].coding[0].code).toBe('271649006')
    })
  })

  describe('Document Text Generation', () => {
    it('should generate document header', async () => {
      const patients = [{ PATIENT_NUM: 1, PATIENT_CD: 'TEST001' }]
      const visits = [{ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15' }]

      const cda = await hl7Service.createCdaDocument(patients, visits, [])

      expect(cda.text.div).toContain('<h1>Clinical Data Export from dbBEST</h1>')
      expect(cda.text.div).toContain('Document-ID:')
      expect(cda.text.div).toContain('Export Date:')
    })

    it('should include visit summaries', async () => {
      const patients = [{ PATIENT_NUM: 1, PATIENT_CD: 'TEST001' }]
      const visits = [{ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15', LOCATION_CD: 'EMERGENCY', INOUT_CD: 'I' }]

      const cda = await hl7Service.createCdaDocument(patients, visits, [])

      expect(cda.text.div).toContain('<h2>Visit Summary</h2>')
      expect(cda.text.div).toContain('Visit 1: TEST001')
      expect(cda.text.div).toContain('EMERGENCY')
      expect(cda.text.div).toContain('I')
    })

    it('should calculate date range correctly', async () => {
      const patients = [{ PATIENT_NUM: 1, PATIENT_CD: 'TEST001' }]
      const visits = [
        { ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15' },
        { ENCOUNTER_NUM: 2, PATIENT_NUM: 1, START_DATE: '2024-01-20' },
      ]
      const observations = [{ ENCOUNTER_NUM: 1, CONCEPT_CD: 'TEST', START_DATE: '2024-01-16' }]

      const cda = await hl7Service.createCdaDocument(patients, visits, observations)

      expect(cda.text.div).toContain('2024-01-15 to 2024-01-20')
    })
  })

  describe('Observation Value Formatting', () => {
    it('should format numeric values correctly', () => {
      const observation = {
        VALTYPE_CD: 'N',
        NVAL_NUM: 180.5,
      }

      const value = hl7Service.formatObservationValue(observation)
      expect(value).toBe(180.5)
    })

    it('should format text values correctly', () => {
      const observation = {
        VALTYPE_CD: 'T',
        TVAL_CHAR: 'Normal',
      }

      const value = hl7Service.formatObservationValue(observation)
      expect(value).toBe('Normal')
    })

    it('should format blob values correctly', () => {
      const observation = {
        VALTYPE_CD: 'B',
        OBSERVATION_BLOB: '{"key": "value"}',
      }

      const value = hl7Service.formatObservationValue(observation)
      expect(value).toBe('{"key": "value"}')
    })

    it('should format date values correctly', () => {
      const observation = {
        VALTYPE_CD: 'D',
        START_DATE: '2024-01-15',
      }

      const value = hl7Service.formatObservationValue(observation)
      expect(value).toBe('2024-01-15')
    })

    it('should handle unknown value types', () => {
      const observation = {
        VALTYPE_CD: 'X',
        TVAL_CHAR: 'Unknown',
      }

      const value = hl7Service.formatObservationValue(observation)
      expect(value).toBe('N/A')
    })
  })

  describe('Concept Display Information', () => {
    it('should map LOINC codes to SNOMED', () => {
      const heightInfo = hl7Service.getConceptDisplayInfo('LOINC:8302-2')
      expect(heightInfo.snomedCode).toBe('271649006')
      expect(heightInfo.displayName).toBe('Height')

      const weightInfo = hl7Service.getConceptDisplayInfo('LOINC:29463-7')
      expect(weightInfo.snomedCode).toBe('27113001')
      expect(weightInfo.displayName).toBe('Weight')
    })

    it('should handle unknown concept codes', () => {
      const unknownInfo = hl7Service.getConceptDisplayInfo('UNKNOWN:CODE')
      expect(unknownInfo.snomedCode).toBe('404684003')
      expect(unknownInfo.displayName).toBe('UNKNOWN:CODE')
    })
  })

  describe('Digital Signature and Hash', () => {
    it('should generate document hash', async () => {
      const document = { test: 'data', id: '123' }
      const hash = await hl7Service.generateDocumentHash(document)

      expect(hash.signature).toBeDefined()
      expect(hash.method).toBe('SHA256')
      expect(hash.documentHash).toBeDefined()
      expect(hash.publicKey).toBeNull()
    })

    it('should generate consistent hash for same document', async () => {
      const document = { test: 'data', id: '123' }
      const hash1 = await hl7Service.generateDocumentHash(document)
      const hash2 = await hl7Service.generateDocumentHash(document)

      expect(hash1.documentHash).toBe(hash2.documentHash)
    })

    it('should sign document with private key', async () => {
      const document = { test: 'data' }
      const privateKey = 'test-private-key'
      const publicKey = 'test-public-key'

      const signature = await hl7Service.signDocument(document, privateKey, publicKey)

      expect(signature.signature).toBeDefined()
      expect(signature.method).toBe('SHA256')
      expect(signature.publicKey).toBe(publicKey)
      expect(signature.signed).toBe(true)
    })

    it('should verify CDA document signature', async () => {
      const document = { test: 'data' }
      const hash = await hl7Service.generateDocumentHash(document)

      const hl7Document = {
        cda: document,
        hash: hash,
      }

      const isValid = await hl7Service.verifyCda(hl7Document)
      expect(isValid).toBe(true)
    })

    it('should reject invalid CDA document', async () => {
      const document = { test: 'data' }
      const hash = await hl7Service.generateDocumentHash(document)

      const hl7Document = {
        cda: document,
        hash: { ...hash, documentHash: 'invalid-hash' },
      }

      const isValid = await hl7Service.verifyCda(hl7Document)
      expect(isValid).toBe(false)
    })

    it('should reject document without hash', async () => {
      const hl7Document = {
        cda: { test: 'data' },
      }

      const isValid = await hl7Service.verifyCda(hl7Document)
      expect(isValid).toBe(false)
    })
  })

  describe('HL7 Export', () => {
    const mockExportOptions = {
      patients: [{ PATIENT_NUM: 1, PATIENT_CD: 'TEST001' }],
      visits: [{ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15' }],
      observations: [{ ENCOUNTER_NUM: 1, CONCEPT_CD: 'TEST', VALTYPE_CD: 'T', TVAL_CHAR: 'Normal' }],
      metadata: { title: 'Test Export' },
    }

    it('should export to HL7 format successfully', async () => {
      const result = await hl7Service.exportToHl7(mockExportOptions)

      expect(result.exported).toBe(true)
      expect(result.cda).toBeDefined()
      expect(result.hash).toBeDefined()
      expect(result.info.title).toBe('Test Export')
      expect(result.info.source).toBe('dbBEST')

      // Write test output
      writeTestOutput('hl7-export-result.json', result, 'Complete HL7 export result with CDA document, hash, and metadata')
    })

    it('should generate hash without signature when not provided', async () => {
      const result = await hl7Service.exportToHl7(mockExportOptions)

      expect(result.hash.signed).toBeUndefined()
      expect(result.hash.publicKey).toBeNull()
    })

    it('should sign document when signature options provided', async () => {
      const optionsWithSignature = {
        ...mockExportOptions,
        signature: {
          privateKey: 'test-private',
          publicKey: 'test-public',
        },
      }

      const result = await hl7Service.exportToHl7(optionsWithSignature)

      expect(result.hash.signed).toBe(true)
      expect(result.hash.publicKey).toBe('test-public')
    })

    it('should validate required input data', async () => {
      const invalidOptions = {
        visits: [],
        observations: [],
      }

      await expect(hl7Service.exportToHl7(invalidOptions)).rejects.toThrow('Patients data is required and must be an array')
    })

    it('should handle export errors gracefully', async () => {
      // Mock a method to throw an error
      vi.spyOn(hl7Service, 'createCdaDocument').mockRejectedValue(new Error('Test error'))

      await expect(hl7Service.exportToHl7(mockExportOptions)).rejects.toThrow('HL7 export failed: Test error')
    })
  })

  describe('HL7 Import', () => {
    const mockHl7Document = {
      cda: {
        id: 'test-doc',
        type: { coding: [{ display: 'Test Type' }] },
        date: '2024-01-15',
        meta: { source: 'Test Source' },
        subject: { display: 'Test Patient' },
        event: [{ period: { start: '2024-01-15' } }],
        section: [
          {
            title: 'Patient Information',
            entry: [
              {
                title: 'Patient: Test Patient',
                value: 'Test Patient',
              },
            ],
          },
          {
            title: 'Visit 1: Test Patient',
            entry: [
              {
                title: 'Visit Date',
                value: '2024-01-15',
              },
              {
                title: 'Location',
                value: 'HL7_IMPORT',
              },
              {
                title: 'Type',
                value: 'O',
              },
            ],
          },
          {
            title: 'Observations',
            entry: [
              {
                code: [{ coding: [{ code: 'TEST001' }] }],
                value: 'Test Value',
              },
            ],
          },
        ],
      },
      hash: {
        documentHash: 'valid-hash',
      },
    }

    beforeEach(() => {
      // Mock hash generation to return known hash
      vi.spyOn(hl7Service, 'generateDocumentHash').mockResolvedValue({
        documentHash: 'valid-hash',
      })
    })

    it('should import HL7 document successfully', async () => {
      const result = await hl7Service.importFromHl7(mockHl7Document)

      expect(result.success).toBe(true)
      expect(result.data.patients).toBeDefined()
      expect(result.data.visits).toBeDefined()
      expect(result.data.observations).toBeDefined()
      expect(result.metadata.documentId).toBe('test-doc')

      // Write test output
      writeTestOutput('hl7-import-result.json', result, 'HL7 import result with extracted clinical data')
      writeTestOutput('hl7-import-source.json', mockHl7Document, 'Source HL7 document used for import test')
    })

    it('should reject document with invalid signature', async () => {
      vi.spyOn(hl7Service, 'generateDocumentHash').mockReturnValue({
        documentHash: 'different-hash',
      })

      const result = await hl7Service.importFromHl7(mockHl7Document)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('SIGNATURE_VERIFICATION_FAILED')
    })

    it('should extract patient information', async () => {
      const result = await hl7Service.importFromHl7(mockHl7Document)

      expect(result.data.patients.length).toBe(1)
      expect(result.data.patients[0].PATIENT_CD).toBe('Test Patient')
      expect(result.data.patients[0].SOURCESYSTEM_CD).toBe('HL7_IMPORT')
    })

    it('should extract visit information', async () => {
      const result = await hl7Service.importFromHl7(mockHl7Document)

      expect(result.data.visits.length).toBe(1)
      expect(result.data.visits[0].START_DATE).toBe('2024-01-15')
      expect(result.data.visits[0].LOCATION_CD).toBe('HL7_IMPORT')
    })

    it('should extract observations from sections', async () => {
      const result = await hl7Service.importFromHl7(mockHl7Document)

      expect(result.data.observations.length).toBe(1)
      expect(result.data.observations[0].CONCEPT_CD).toBe('TEST001')
      expect(result.data.observations[0].TVAL_CHAR).toBe('Test Value')
    })

    it('should handle import errors gracefully', async () => {
      // Mock a method to throw an error
      vi.spyOn(hl7Service, 'extractClinicalData').mockRejectedValue(new Error('Test error'))

      const result = await hl7Service.importFromHl7(mockHl7Document)

      expect(result.success).toBe(false)
      expect(result.errors[0].code).toBe('IMPORT_ERROR')
      expect(result.errors[0].message).toContain('Test error')
    })
  })

  describe('Data Extraction', () => {
    it('should extract observation with numeric value', () => {
      const entry = {
        code: [{ coding: [{ code: 'TEST001' }] }],
        value: 42,
      }

      const observation = hl7Service.extractObservationFromEntry(entry)

      expect(observation.CONCEPT_CD).toBe('TEST001')
      expect(observation.VALTYPE_CD).toBe('N')
      expect(observation.NVAL_NUM).toBe(42)
      expect(observation.TVAL_CHAR).toBeNull()
    })

    it('should extract observation with text value', () => {
      const entry = {
        code: [{ coding: [{ code: 'TEST002' }] }],
        value: 'Test Text',
      }

      const observation = hl7Service.extractObservationFromEntry(entry)

      expect(observation.VALTYPE_CD).toBe('T')
      expect(observation.TVAL_CHAR).toBe('Test Text')
      expect(observation.NVAL_NUM).toBeNull()
    })

    it('should extract observation with JSON blob value', () => {
      const entry = {
        code: [{ coding: [{ code: 'TEST003' }] }],
        value: '{"key": "value"}',
      }

      const observation = hl7Service.extractObservationFromEntry(entry)

      expect(observation.VALTYPE_CD).toBe('B')
      expect(observation.OBSERVATION_BLOB).toBe('{"key": "value"}')
      expect(observation.TVAL_CHAR).toBeNull()

      // Write test output
      writeTestOutput(
        'hl7-observation-extraction.json',
        {
          input: entry,
          output: observation,
        },
        'Example of observation data extraction from HL7 entry',
      )
    })

    it('should handle invalid entries gracefully', () => {
      const entry = {}
      const observation = hl7Service.extractObservationFromEntry(entry)

      expect(observation).toBeNull()
    })

    it('should handle entries without code', () => {
      const entry = { value: 'test' }
      const observation = hl7Service.extractObservationFromEntry(entry)

      expect(observation).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle missing patients data in export', async () => {
      const invalidOptions = {
        visits: [],
        observations: [],
      }

      await expect(hl7Service.exportToHl7(invalidOptions)).rejects.toThrow('Patients data is required and must be an array')
    })

    it('should handle missing patients array in export', async () => {
      const invalidOptions = {
        patients: null,
        visits: [],
        observations: [],
      }

      await expect(hl7Service.exportToHl7(invalidOptions)).rejects.toThrow('Patients data is required and must be an array')
    })

    it('should handle document signing errors', async () => {
      const document = { test: 'data' }
      const privateKey = null // Invalid key

      await expect(hl7Service.signDocument(document, privateKey, 'public')).rejects.toThrow('Document signing failed')
    })

    it('should handle CDA verification errors', async () => {
      const invalidDocument = null

      const result = await hl7Service.verifyCda(invalidDocument)
      expect(result).toBe(false)
    })
  })

  // Generate test summary
  it('should generate test summary', () => {
    const testSummary = {
      service: 'HL7Service',
      testSuite: 'Unit Tests',
      capabilities: [
        'CDA document creation and structure validation',
        'Document metadata preparation and customization',
        'HTML text generation with patient/visit summaries',
        'Patient, visit, and observation section creation',
        'Digital signature generation and verification',
        'HL7 document export with hash generation',
        'HL7 document import with data extraction',
        'Template management and customization',
        'Observation value formatting (numeric, text, JSON, dates)',
        'Concept code mapping and display information',
        'Error handling and validation',
        'Document integrity verification',
      ],
      mockData: {
        patients: [{ PATIENT_NUM: 1, PATIENT_CD: 'TEST001', SEX_CD: 'M', AGE_IN_YEARS: 45 }],
        visits: [{ ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15', LOCATION_CD: 'EMERGENCY', INOUT_CD: 'I' }],
        observations: [{ ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:8302-2', VALTYPE_CD: 'N', NVAL_NUM: 180, START_DATE: '2024-01-15' }],
      },
      outputFiles: [
        'hl7-cda-document-basic.json - Basic CDA document structure',
        'hl7-export-result.json - Complete export result with hash',
        'hl7-import-result.json - Import result with extracted data',
        'hl7-import-source.json - Source document for import',
        'hl7-observation-extraction.json - Data extraction example',
        'hl7-test-summary.json - This test summary',
      ],
    }

    writeTestOutput('hl7-test-summary.json', testSummary, 'Complete test summary for HL7 Service unit tests')

    expect(testSummary.capabilities.length).toBeGreaterThan(10)
  })
})
