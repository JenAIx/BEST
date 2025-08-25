/**
 * Unit Tests for CSV Service
 * 
 * Tests:
 * - CSV export with two header rows (description + concept)
 * - CSV structure building for complex clinical data
 * - Data transformation and formatting
 * - CSV import with validation
 * - CSV parsing and escaping
 * - Error handling and validation
 * - Configuration management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CsvService } from '../../src/core/services/csv-service.js'

// Mock repositories and validator
const mockConceptRepository = {
  findByConceptCode: vi.fn()
}

const mockCqlRepository = {
  getCqlRules: vi.fn()
}

const mockDataValidator = {
  validatePatient: vi.fn(),
  validateVisit: vi.fn(),
  validateObservation: vi.fn()
}

describe('CSV Service', () => {
  let csvService

  // Mock data for tests
  const mockPatients = [
    { PATIENT_NUM: 1, PATIENT_CD: 'TEST001', SEX_CD: 'M', AGE_IN_YEARS: 30 }
  ]

  const mockVisits = [
    { ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15', LOCATION_CD: 'EMERGENCY', INOUT_CD: 'I' }
  ]

  const mockObservations = [
    { ENCOUNTER_NUM: 1, CONCEPT_CD: 'TEST:001', VALTYPE_CD: 'N', NVAL_NUM: 180 },
    { ENCOUNTER_NUM: 1, CONCEPT_CD: 'TEST:002', VALTYPE_CD: 'T', TVAL_CHAR: 'Normal' }
  ]

  beforeEach(() => {
    csvService = new CsvService(mockConceptRepository, mockCqlRepository)
    csvService.dataValidator = mockDataValidator
    vi.clearAllMocks()
    
    // Mock concept repository responses
    mockConceptRepository.findByConceptCode.mockImplementation((code) => {
      const conceptMap = {
        'LOINC:8302-2': { NAME_CHAR: 'Height' },
        'LOINC:29463-7': { NAME_CHAR: 'Weight' },
        'TEST:001': { NAME_CHAR: 'Test Concept 1' },
        'TEST:002': { NAME_CHAR: 'Test Concept 2' }
      }
      return conceptMap[code] || { NAME_CHAR: code }
    })
  })

  describe('Service Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(csvService.config.delimiter).toBe(',')
      expect(csvService.config.quoteChar).toBe('"')
      expect(csvService.config.escapeChar).toBe('"')
      expect(csvService.config.lineEnding).toBe('\n')
      expect(csvService.config.encoding).toBe('utf-8')
    })

    it('should accept repositories in constructor', () => {
      expect(csvService.conceptRepository).toBe(mockConceptRepository)
      expect(csvService.cqlRepository).toBe(mockCqlRepository)
      expect(csvService.dataValidator).toBeDefined()
    })
  })

  describe('Configuration Management', () => {
    it('should set configuration', () => {
      const newConfig = {
        delimiter: ';',
        quoteChar: "'",
        lineEnding: '\r\n'
      }
      
      csvService.setConfig(newConfig)
      
      expect(csvService.config.delimiter).toBe(';')
      expect(csvService.config.quoteChar).toBe("'")
      expect(csvService.config.lineEnding).toBe('\r\n')
    })

    it('should get current configuration', () => {
      const config = csvService.getConfig()
      expect(config).toEqual(csvService.config)
      expect(config).not.toBe(csvService.config) // Should be a copy
    })
  })

  describe('CSV Export', () => {

    it('should export to CSV successfully', async () => {
      const exportOptions = {
        patients: mockPatients,
        visits: mockVisits,
        observations: mockObservations,
        metadata: { title: 'Test Export' }
      }
      
      const csvContent = await csvService.exportToCsv(exportOptions)
      
      expect(csvContent).toBeDefined()
      expect(csvContent).toContain('Patient ID')
      expect(csvContent).toContain('TEST001')
      expect(csvContent).toContain('180')
      expect(csvContent).toContain('Normal')
    })

    it('should validate required input data', async () => {
      const invalidOptions = {
        visits: mockVisits,
        observations: mockObservations
      }
      
      await expect(csvService.exportToCsv(invalidOptions))
        .rejects.toThrow('Patients data is required and must be an array')
    })

    it('should handle missing patients array', async () => {
      const invalidOptions = {
        patients: null,
        visits: mockVisits,
        observations: mockObservations
      }
      
      await expect(csvService.exportToCsv(invalidOptions))
        .rejects.toThrow('Patients data is required and must be an array')
    })

    it('should handle export errors gracefully', async () => {
      // Mock a method to throw an error
      vi.spyOn(csvService, 'buildCsvStructure').mockRejectedValue(new Error('Test error'))
      
      const exportOptions = {
        patients: mockPatients,
        visits: mockVisits,
        observations: mockObservations
      }
      
      await expect(csvService.exportToCsv(exportOptions))
        .rejects.toThrow('CSV export failed: Test error')
    })
  })

  describe('CSV Structure Building', () => {
    const mockPatients = [
      { PATIENT_NUM: 1, PATIENT_CD: 'TEST001' }
    ]

    const mockVisits = [
      { ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15' }
    ]

    const mockObservations = [
      { ENCOUNTER_NUM: 1, CONCEPT_CD: 'TEST:001', VALTYPE_CD: 'N', NVAL_NUM: 180 },
      { ENCOUNTER_NUM: 1, CONCEPT_CD: 'TEST:002', VALTYPE_CD: 'T', TVAL_CHAR: 'Normal' }
    ]

    it('should build CSV structure with two header rows', async () => {
      const structure = await csvService.buildCsvStructure(mockPatients, mockVisits, mockObservations)
      
      expect(structure.descriptionHeaders).toBeDefined()
      expect(structure.conceptHeaders).toBeDefined()
      expect(structure.dataRows).toBeDefined()
      
      // Check description headers (human-readable)
      expect(structure.descriptionHeaders).toContain('Patient ID')
      expect(structure.descriptionHeaders).toContain('Visit Date')
      expect(structure.descriptionHeaders).toContain('Test Concept 1')
      expect(structure.descriptionHeaders).toContain('Test Concept 2')
      
      // Check concept headers (CONCEPT codes)
      expect(structure.conceptHeaders).toContain('PATIENT_CD')
      expect(structure.conceptHeaders).toContain('START_DATE')
      expect(structure.conceptHeaders).toContain('TEST:001')
      expect(structure.conceptHeaders).toContain('TEST:002')
    })

    it('should identify unique concepts from observations', async () => {
      const uniqueConcepts = await csvService.getUniqueConcepts(mockObservations)
      
      expect(uniqueConcepts).toContain('TEST:001')
      expect(uniqueConcepts).toContain('TEST:002')
      expect(uniqueConcepts.length).toBe(2)
    })

    it('should get concept information from repository', async () => {
      const conceptInfo = await csvService.getConceptInfo('TEST:001')
      
      expect(conceptInfo.displayName).toBe('Test Concept 1')
      expect(mockConceptRepository.findByConceptCode).toHaveBeenCalledWith('TEST:001')
    })

    it('should handle unknown concept codes', async () => {
      const conceptInfo = await csvService.getConceptInfo('UNKNOWN:CODE')
      
      expect(conceptInfo.displayName).toBe('UNKNOWN:CODE')
    })
  })

  describe('Data Row Building', () => {
    const conceptHeaders = ['PATIENT_CD', 'SEX_CD', 'AGE_IN_YEARS', 'BIRTH_DATE', 'START_DATE', 'LOCATION_CD', 'INOUT_CD', 'TEST:001', 'TEST:002']

    it('should build data rows for patients and visits', async () => {
      const dataRows = await csvService.buildDataRows(mockPatients, mockVisits, mockObservations, conceptHeaders)
      
      expect(dataRows.length).toBe(1) // One patient with one visit
      
      const row = dataRows[0]
      expect(row).toContain('TEST001') // Patient ID
      expect(row).toContain('M') // Gender
      expect(row).toContain(30) // Age
      expect(row).toContain('2024-01-15') // Visit date
      expect(row).toContain('EMERGENCY') // Location
      expect(row).toContain('I') // Type
      expect(row).toContain('180') // First observation value
      expect(row).toContain('Normal') // Second observation value
    })

    it('should build patient row with all required fields', () => {
      const patient = mockPatients[0]
      const visit = mockVisits[0]
      const visitObservations = mockObservations.filter(o => o.ENCOUNTER_NUM === visit.ENCOUNTER_NUM)
      
      const row = csvService.buildPatientRow(patient, visit, visitObservations, conceptHeaders)
      
      expect(row.length).toBe(conceptHeaders.length)
      expect(row[0]).toBe('TEST001') // PATIENT_CD
      expect(row[1]).toBe('M') // SEX_CD
      expect(row[2]).toBe(30) // AGE_IN_YEARS
      expect(row[3]).toBe('') // BIRTH_DATE
      expect(row[4]).toBe('2024-01-15') // START_DATE
      expect(row[5]).toBe('EMERGENCY') // LOCATION_CD
      expect(row[6]).toBe('I') // INOUT_CD
      expect(row[7]).toBe('180') // TEST:001 value
      expect(row[8]).toBe('Normal') // TEST:002 value
    })

    it('should handle multiple visits per patient', async () => {
      const multipleVisits = [
        { ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15' },
        { ENCOUNTER_NUM: 2, PATIENT_NUM: 1, START_DATE: '2024-01-20' }
      ]
      
      const dataRows = await csvService.buildDataRows(mockPatients, multipleVisits, mockObservations, conceptHeaders)
      
      expect(dataRows.length).toBe(2) // Two visits for one patient
    })

    it('should handle patients without visits', async () => {
      const dataRows = await csvService.buildDataRows(mockPatients, [], mockObservations, conceptHeaders)
      
      expect(dataRows.length).toBe(0) // No visits, no rows
    })
  })

  describe('Observation Value Formatting', () => {
    it('should format numeric values', () => {
      const observation = {
        VALTYPE_CD: 'N',
        NVAL_NUM: 180.5
      }
      
      const value = csvService.formatObservationValue(observation)
      expect(value).toBe('180.5')
    })

    it('should format text values', () => {
      const observation = {
        VALTYPE_CD: 'T',
        TVAL_CHAR: 'Normal'
      }
      
      const value = csvService.formatObservationValue(observation)
      expect(value).toBe('Normal')
    })

    it('should format blob values', () => {
      const observation = {
        VALTYPE_CD: 'B',
        OBSERVATION_BLOB: '{"key": "value"}'
      }
      
      const value = csvService.formatObservationValue(observation)
      expect(value).toBe('{"key": "value"}')
    })

    it('should format date values', () => {
      const observation = {
        VALTYPE_CD: 'D',
        START_DATE: '2024-01-15'
      }
      
      const value = csvService.formatObservationValue(observation)
      expect(value).toBe('2024-01-15')
    })

    it('should handle unknown value types', () => {
      const observation = {
        VALTYPE_CD: 'X',
        TVAL_CHAR: 'Unknown'
      }
      
      const value = csvService.formatObservationValue(observation)
      expect(value).toBe('Unknown')
    })

    it('should handle null values', () => {
      const observation = {
        VALTYPE_CD: 'N',
        NVAL_NUM: null
      }
      
      const value = csvService.formatObservationValue(observation)
      expect(value).toBe('Unknown')
    })
  })

  describe('CSV Content Generation', () => {
    const mockStructure = {
      descriptionHeaders: ['Patient ID', 'Visit Date', 'Height', 'Weight'],
      conceptHeaders: ['PATIENT_CD', 'START_DATE', 'TEST:001', 'TEST:002'],
      dataRows: [
        ['TEST001', '2024-01-15', '180', '75'],
        ['TEST002', '2024-01-16', '165', '60']
      ]
    }

    it('should generate CSV content with two header rows', async () => {
      // Use the actual CSV service to build structure
      const structure = await csvService.buildCsvStructure(mockPatients, mockVisits, mockObservations)
      const metadata = { title: 'Test Export', author: 'Test User' }
      const csvContent = csvService.generateCsvContent(structure, metadata)
      
      const lines = csvContent.split('\n')
      
      // Check metadata comments
      expect(csvContent).toContain('# Test Export')
      expect(csvContent).toContain('# Test User')
      
      // Check description headers (first data row)
      expect(lines[lines.length - 4]).toContain('Patient ID,Gender,Age,Date of Birth,Visit Date,Location,Type,Test Concept 1,Test Concept 2')
      
      // Check concept headers (second data row)
      expect(lines[lines.length - 3]).toContain('PATIENT_CD,SEX_CD,AGE_IN_YEARS,BIRTH_DATE,START_DATE,LOCATION_CD,INOUT_CD,TEST:001,TEST:002')
      
      // Check data rows
      expect(lines[lines.length - 2]).toContain('TEST001,M,30,,2024-01-15,EMERGENCY,I,180,Normal')
    })

    it('should escape CSV values containing delimiters', () => {
      const structureWithSpecialChars = {
        descriptionHeaders: ['Name', 'Description'],
        conceptHeaders: ['NAME', 'DESC'],
        dataRows: [
          ['John Doe', 'Contains, comma'],
          ['Jane Smith', 'Contains "quotes"']
        ]
      }
      
      const csvContent = csvService.generateCsvContent(structureWithSpecialChars)
      
      expect(csvContent).toContain('"Contains, comma"')
      expect(csvContent).toContain('"Contains ""quotes"""')
    })

    it('should handle empty metadata', () => {
      const csvContent = csvService.generateCsvContent(mockStructure)
      
      expect(csvContent).not.toContain('#')
      expect(csvContent).toContain('Patient ID,Visit Date,Height,Weight')
    })
  })

  describe('CSV Escaping', () => {
    it('should escape values containing delimiters', () => {
      const row = ['Normal', 'Contains, comma', 'Simple']
      const escaped = csvService.escapeCsvRow(row)
      
      expect(escaped[0]).toBe('Normal')
      expect(escaped[1]).toBe('"Contains, comma"')
      expect(escaped[2]).toBe('Simple')
    })

    it('should escape values containing quotes', () => {
      const row = ['Normal', 'Contains "quotes"', 'Simple']
      const escaped = csvService.escapeCsvRow(row)
      
      expect(escaped[0]).toBe('Normal')
      expect(escaped[1]).toBe('"Contains ""quotes"""')
      expect(escaped[2]).toBe('Simple')
    })

    it('should escape values containing newlines', () => {
      const row = ['Normal', 'Contains\nnewline', 'Simple']
      const escaped = csvService.escapeCsvRow(row)
      
      expect(escaped[0]).toBe('Normal')
      expect(escaped[1]).toBe('"Contains\nnewline"')
      expect(escaped[2]).toBe('Simple')
    })

    it('should not escape simple values', () => {
      const row = ['Simple', 'Normal', 'Text']
      const escaped = csvService.escapeCsvRow(row)
      
      expect(escaped).toEqual(row)
    })
  })

  describe('CSV Import', () => {
    const mockCsvContent = `# Test Import
# Test User
Patient ID,Visit Date,Height,Weight
PATIENT_CD,START_DATE,TEST:001,TEST:002
TEST001,2024-01-15,180,75
TEST002,2024-01-16,165,60`

    it('should import CSV successfully', async () => {
      const importOptions = { validateData: true }
      const result = await csvService.importFromCsv(mockCsvContent, importOptions)
      
      expect(result.success).toBe(true)
      expect(result.data.patients).toBeDefined()
      expect(result.data.visits).toBeDefined()
      expect(result.data.observations).toBeDefined()
      expect(result.metadata.title).toBe('Test Import')
      expect(result.metadata.author).toBe('Test User')
    })

    it('should parse CSV content correctly', () => {
      const parsed = csvService.parseCsvContent(mockCsvContent)
      
      expect(parsed.descriptionHeaders).toEqual(['Patient ID', 'Visit Date', 'Height', 'Weight'])
      expect(parsed.conceptHeaders).toEqual(['PATIENT_CD', 'START_DATE', 'TEST:001', 'TEST:002'])
      expect(parsed.dataRows.length).toBe(2)
      expect(parsed.dataRows[0]).toEqual(['TEST001', '2024-01-15', '180', '75'])
    })

    it('should filter comment lines', () => {
      const csvWithComments = `# Comment 1
# Comment 2
Header1,Header2
Header3,Header4
Data1,Data2`
      
      const parsed = csvService.parseCsvContent(csvWithComments)
      
      expect(parsed.descriptionHeaders).toEqual(['Header1', 'Header2'])
      expect(parsed.conceptHeaders).toEqual(['Header3', 'Header4'])
      expect(parsed.dataRows.length).toBe(1)
    })

    it('should parse CSV rows with quoted values', () => {
      const row = '"John Doe","Contains, comma","Simple"'
      const parsed = csvService.parseCsvRow(row)
      
      expect(parsed).toEqual(['John Doe', 'Contains, comma', 'Simple'])
    })

    it('should handle escaped quotes in CSV rows', () => {
      const row = '"Contains ""quotes""","Normal"'
      const parsed = csvService.parseCsvRow(row)
      
      expect(parsed).toEqual(['Contains "quotes"', 'Normal'])
    })
  })

  describe('CSV Validation', () => {
    it('should validate CSV structure', async () => {
      const validStructure = {
        descriptionHeaders: ['Patient ID', 'Visit Date'],
        conceptHeaders: ['PATIENT_CD', 'START_DATE'],
        dataRows: [['TEST001', '2024-01-15']]
      }
      
      const result = await csvService.validateCsvStructure(validStructure)
      expect(result.isValid).toBe(true)
    })

    it('should reject CSV without required fields', async () => {
      const invalidStructure = {
        descriptionHeaders: ['Visit Date'], // Missing Patient ID
        conceptHeaders: ['START_DATE'],
        dataRows: [['2024-01-02']]
      }
      
      const result = await csvService.validateCsvStructure(invalidStructure)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => error.message === 'Required field missing: PATIENT_CD')).toBe(true)
    })

    it('should validate data row consistency', () => {
      const conceptHeaders = ['PATIENT_CD', 'START_DATE', 'TEST:001']
      const validRow = ['TEST001', '2024-01-15', '180']
      const invalidRow = ['TEST001', '2024-01-15'] // Missing column
      
      const validResult = csvService.validateDataRow(validRow, conceptHeaders, 1)
      expect(validResult.length).toBe(0) // No errors for valid row
      
      const invalidResult = csvService.validateDataRow(invalidRow, conceptHeaders, 2)
      expect(invalidResult.length).toBeGreaterThan(0) // Has errors
      expect(invalidResult[0].message).toContain('Row 2 has incorrect number of columns')
    })

    it('should reject rows without PATIENT_CD', () => {
      const conceptHeaders = ['PATIENT_CD', 'START_DATE']
      const invalidRow = ['', '2024-01-15'] // Empty PATIENT_CD
      
      const result = csvService.validateDataRow(invalidRow, conceptHeaders, 1)
      expect(result.length).toBeGreaterThan(0) // Has errors
      expect(result[0].message).toContain('Row 1 missing required PATIENT_CD')
    })
  })

  describe('Data Transformation', () => {
    it('should transform CSV to clinical data', async () => {
      const parsedData = {
        descriptionHeaders: ['Patient ID', 'Visit Date', 'Height'],
        conceptHeaders: ['PATIENT_CD', 'START_DATE', 'TEST:001'],
        dataRows: [
          ['TEST001', '2024-01-15', '180'],
          ['TEST002', '2024-01-16', '165']
        ]
      }
      
      const importOptions = { validateData: false }
      const result = await csvService.transformCsvToClinical(parsedData, importOptions)
      
      expect(result.patients.length).toBe(2)
      expect(result.visits.length).toBe(2)
      expect(result.observations.length).toBe(2)
      
      expect(result.patients[0].PATIENT_CD).toBe('TEST001')
      expect(result.visits[0].START_DATE).toBe('2024-01-15')
      expect(result.observations[0].CONCEPT_CD).toBe('TEST:001')
    })

    it('should map row data to objects', () => {
      const row = ['TEST001', '2024-01-15', '180', 'Normal']
      const conceptHeaders = ['PATIENT_CD', 'START_DATE', 'TEST:001', 'TEST:002']
      
      const mapped = csvService.mapRowToObject(row, conceptHeaders)
      
      expect(mapped.PATIENT_CD).toBe('TEST001')
      expect(mapped.START_DATE).toBe('2024-01-15')
      expect(mapped['TEST:001']).toBe('180')
      expect(mapped['TEST:002']).toBe('Normal')
    })

    it('should create patient from row data', () => {
      const rowData = {
        PATIENT_CD: 'TEST001',
        SEX_CD: 'M',
        AGE_IN_YEARS: '30'
      }
      
      const patient = csvService.createPatientFromRow(rowData)
      
      expect(patient.PATIENT_CD).toBe('TEST001')
      expect(patient.SEX_CD).toBe('M')
      expect(patient.AGE_IN_YEARS).toBe(30)
      expect(patient.SOURCESYSTEM_CD).toBe('CSV_IMPORT')
      expect(patient.UPLOAD_ID).toBe(1)
    })

    it('should create visit from row data', () => {
      const rowData = {
        START_DATE: '2024-01-15',
        LOCATION_CD: 'EMERGENCY',
        INOUT_CD: 'I'
      }
      
      const visit = csvService.createVisitFromRow(rowData, 1, 1)
      
      expect(visit.PATIENT_NUM).toBe(1)
      expect(visit.ENCOUNTER_NUM).toBe(1)
      expect(visit.START_DATE).toBe('2024-01-15')
      expect(visit.LOCATION_CD).toBe('EMERGENCY')
      expect(visit.INOUT_CD).toBe('I')
    })

    it('should create observations from row data', () => {
      const rowData = {
        'TEST:001': '180',
        'TEST:002': 'Normal'
      }
      
      const observations = csvService.createObservationsFromRow(rowData, 1, 1)
      
      expect(observations.length).toBe(2)
      
      const heightObs = observations.find(o => o.CONCEPT_CD === 'TEST:001')
      expect(heightObs.VALTYPE_CD).toBe('N')
      expect(heightObs.NVAL_NUM).toBe(180)
      
      const textObs = observations.find(o => o.CONCEPT_CD === 'TEST:002')
      expect(textObs.VALTYPE_CD).toBe('T')
      expect(textObs.TVAL_CHAR).toBe('Normal')
    })

    it('should infer observation value types correctly', () => {
      // Numeric value
      const numericObs = csvService.createObservationFromField('TEST:001', '180', 1, 1)
      expect(numericObs.VALTYPE_CD).toBe('N')
      expect(numericObs.NVAL_NUM).toBe(180)
      
      // Text value
      const textObs = csvService.createObservationFromField('TEST:002', 'Normal', 1, 1)
      expect(textObs.VALTYPE_CD).toBe('T')
      expect(textObs.TVAL_CHAR).toBe('Normal')
      
      // JSON blob value
      const jsonObs = csvService.createObservationFromField('TEST:003', '{"key": "value"}', 1, 1)
      expect(jsonObs.VALTYPE_CD).toBe('B')
      expect(jsonObs.OBSERVATION_BLOB).toBe('{"key":"value"}')
      
      // Date value
      const dateObs = csvService.createObservationFromField('TEST:004', '2024-01-15', 1, 1)
      expect(dateObs.VALTYPE_CD).toBe('D')
      expect(dateObs.START_DATE).toBe('2024-01-15')
    })
  })

  describe('Error Handling', () => {
    it('should handle CSV parsing errors', async () => {
      const invalidCsv = 'Invalid,CSV\n"Unclosed quote\nValid,Row'
      
      const result = await csvService.importFromCsv(invalidCsv)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle validation errors', async () => {
      const invalidCsv = 'Visit Date\nSTART_DATE\n2024-01-15' // Missing required PATIENT_CD field
      
      const result = await csvService.importFromCsv(invalidCsv)
      
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors.some(error => error.message === 'Required field missing: PATIENT_CD')).toBe(true)
    })

    it('should handle transformation errors', async () => {
      const parsedData = {
        descriptionHeaders: ['Patient ID'],
        conceptHeaders: ['PATIENT_CD'],
        dataRows: [['TEST001']]
      }
      
      // Mock a method to throw an error
      vi.spyOn(csvService, 'createPatientFromRow').mockImplementation(() => {
        throw new Error('Test error')
      })
      
      const importOptions = { validateData: false }
      await expect(csvService.transformCsvToClinical(parsedData, importOptions))
        .rejects.toThrow('Test error')
    })
  })
})
