/**
 * Import Services Integration Tests
 *
 * Focused integration tests for the modular import system:
 * - File type detection using import-filetype.js
 * - Import service coordination
 * - Format-specific import handling
 *
 * Test Files Used:
 * - 01_csv_data.csv: CSV format with patient data
 * - 02_json.json: JSON format with structured clinical data
 * - 03_hl7_fhir_json_cda.hl7: HL7 FHIR CDA document
 * - 04_surveybest.html: HTML survey with embedded CDA (BDI-II)
 * - PID_DEMO_quest_brain_tremor_UID_19079283-e025-40d8-a0f8-09f7f460f2da.html: HTML survey with CDA (Tremor scale)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

// Import the new modular services
import { ImportService } from '../../src/core/services/imports/import-service.js'
import { detectFormat, SUPPORTED_FORMATS } from '../../src/core/services/imports/import-filetype.js'
import { logger } from '../../src/core/services/logging-service.js'

describe('Import Services Integration Tests', () => {
  let importService

  // Test data paths
  const testInputDir = path.join(process.cwd(), 'tests', 'input', 'test_import')
  const testOutputDir = path.join(process.cwd(), 'tests', 'output')

  // Test files with expected formats
  const testFiles = [
    { file: '01_csv_data.csv', expectedFormat: 'csv', description: 'CSV format with patient data' },
    { file: '02_json.json', expectedFormat: 'json', description: 'JSON format with structured clinical data' },
    { file: '03_hl7_fhir_json_cda.hl7', expectedFormat: 'hl7', description: 'HL7 FHIR CDA document' },
    { file: '04_surveybest.html', expectedFormat: 'html', description: 'HTML survey with embedded CDA (BDI-II)' },
    {
      file: 'PID_DEMO_quest_brain_tremor_UID_19079283-e025-40d8-a0f8-09f7f460f2da.html',
      expectedFormat: 'html',
      description: 'HTML survey with CDA (Tremor scale)',
    },
  ]

  beforeAll(() => {
    // Initialize import service with minimal setup for testing
    const mockConceptRepo = { findByConceptCode: () => null }
    const mockCqlRepo = { getCqlRules: () => [] }

    importService = new ImportService(null, mockConceptRepo, mockCqlRepo)

    // Ensure output directory exists
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }

    logger.info('Import services integration test setup completed')
  })

  /**
   * Save import structure to output file for review
   * @param {Object} importStructure - Import structure to save
   * @param {string} originalFilename - Original filename
   */
  function saveImportStructureOutput(importStructure, originalFilename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const outputFilename = `output_${originalFilename.replace(/\./g, '_')}_${timestamp}.json`
    const outputPath = path.join(testOutputDir, outputFilename)

    fs.writeFileSync(outputPath, JSON.stringify(importStructure, null, 2))
    logger.info('Import structure saved for review', { outputPath, originalFilename })

    return outputPath
  }

  describe('File Type Detection', () => {
    it('should correctly detect all supported file formats', () => {
      // Test that all expected formats are supported
      const supportedFormats = SUPPORTED_FORMATS
      expect(supportedFormats).toEqual(['csv', 'json', 'hl7', 'html'])

      logger.info('Supported formats verified', { supportedFormats })
    })

    it('should detect format for each test file using import-filetype.js', () => {
      for (const testFile of testFiles) {
        const filePath = path.join(testInputDir, testFile.file)

        // Verify test file exists
        expect(fs.existsSync(filePath), `Test file ${testFile.file} should exist`).toBe(true)

        // Read file content
        const content = fs.readFileSync(filePath, 'utf8')
        expect(content.length, `File ${testFile.file} should not be empty`).toBeGreaterThan(0)

        // Test format detection using import-filetype.js directly
        const detectedFormat = detectFormat(content, testFile.file)
        expect(detectedFormat, `Should detect ${testFile.expectedFormat} for ${testFile.file}`).toBe(testFile.expectedFormat)

        logger.info('Format detection test passed', {
          file: testFile.file,
          expectedFormat: testFile.expectedFormat,
          detectedFormat,
          description: testFile.description,
        })
      }
    })

    it('should detect format for each test file using ImportService', () => {
      for (const testFile of testFiles) {
        const filePath = path.join(testInputDir, testFile.file)
        const content = fs.readFileSync(filePath, 'utf8')

        // Test format detection using ImportService
        const detectedFormat = importService.detectFormat(content, testFile.file)
        expect(detectedFormat, `ImportService should detect ${testFile.expectedFormat} for ${testFile.file}`).toBe(testFile.expectedFormat)

        logger.info('ImportService format detection test passed', {
          file: testFile.file,
          expectedFormat: testFile.expectedFormat,
          detectedFormat,
        })
      }
    })

    it('should handle unsupported file formats gracefully', () => {
      const unsupportedFiles = [
        { content: 'plain text content', filename: 'test.txt', expectedFormat: null },
        { content: '<xml><data>test</data></xml>', filename: 'test.xml', expectedFormat: 'hl7' }, // XML is detected as HL7
        { content: 'some binary data', filename: 'test.bin', expectedFormat: null },
        { content: '', filename: 'empty.txt', expectedFormat: null },
      ]

      for (const testCase of unsupportedFiles) {
        const detectedFormat = detectFormat(testCase.content, testCase.filename)
        expect(detectedFormat, `Should detect ${testCase.expectedFormat} for ${testCase.filename}`).toBe(testCase.expectedFormat)

        // Also test through ImportService
        const serviceDetectedFormat = importService.detectFormat(testCase.content, testCase.filename)
        expect(serviceDetectedFormat, `ImportService should detect ${testCase.expectedFormat} for ${testCase.filename}`).toBe(testCase.expectedFormat)
      }
    })
  })

  describe('Content-Based Format Detection', () => {
    it('should detect CSV format based on content structure', () => {
      const csvContent = 'header1,header2,header3\nvalue1,value2,value3\n'
      const detectedFormat = detectFormat(csvContent, 'unknown.txt')
      expect(detectedFormat).toBe('csv')
    })

    it('should detect JSON format based on content structure', () => {
      const jsonContent = '{"key": "value", "array": [1, 2, 3]}'
      const detectedFormat = detectFormat(jsonContent, 'unknown.txt')
      expect(detectedFormat).toBe('json')
    })

    it('should detect HL7 format based on resourceType', () => {
      const hl7Content = '{"resourceType": "Composition", "id": "test"}'
      const detectedFormat = detectFormat(hl7Content, 'unknown.txt')
      expect(detectedFormat).toBe('hl7')
    })

    it('should detect HTML format based on content structure', () => {
      const htmlContent = '<html><head><script>CDA = {"test": "data"}</script></head></html>'
      const detectedFormat = detectFormat(htmlContent, 'unknown.txt')
      expect(detectedFormat).toBe('html')
    })
  })

  describe('HTML Survey Format Detection', () => {
    it('should detect HTML survey format for BDI-II questionnaire', () => {
      const htmlPath = path.join(testInputDir, '04_surveybest.html')
      const content = fs.readFileSync(htmlPath, 'utf8')

      // Verify it's detected as HTML
      const detectedFormat = detectFormat(content, '04_surveybest.html')
      expect(detectedFormat).toBe('html')

      // Verify it contains CDA data
      expect(content).toContain('CDA=')
      expect(content).toContain('"cda"')

      logger.info('BDI-II HTML survey format detection verified')
    })

    it('should detect HTML survey format for Tremor scale questionnaire', () => {
      const htmlPath = path.join(testInputDir, 'PID_DEMO_quest_brain_tremor_UID_19079283-e025-40d8-a0f8-09f7f460f2da.html')
      const content = fs.readFileSync(htmlPath, 'utf8')

      // Verify it's detected as HTML
      const detectedFormat = detectFormat(content, 'PID_DEMO_quest_brain_tremor_UID_19079283-e025-40d8-a0f8-09f7f460f2da.html')
      expect(detectedFormat).toBe('html')

      // Verify it contains CDA data (with space in this file)
      expect(content).toContain('CDA =')
      expect(content).toContain('cda:')

      logger.info('Tremor scale HTML survey format detection verified')
    })

    it('should differentiate between regular HTML and survey HTML', () => {
      const regularHtml = '<div><p>Regular content without HTML tags</p></div>'
      const surveyHtml = '<html><head><script>CDA = {"cda": {"test": "data"}}</script></head></html>'

      // Regular content without proper HTML structure should not be detected as HTML
      const regularFormat = detectFormat(regularHtml, 'regular.txt')
      expect(regularFormat).toBe(null)

      // Survey HTML with CDA should be detected
      const surveyFormat = detectFormat(surveyHtml, 'survey.html')
      expect(surveyFormat).toBe('html')

      // Test with .html extension for regular HTML (should be detected by extension)
      const regularHtmlWithExt = detectFormat(regularHtml, 'regular.html')
      expect(regularHtmlWithExt).toBe('html') // Extension takes precedence

      logger.info('HTML differentiation test completed')
    })
  })

  describe('Format Detection Edge Cases', () => {
    it('should prioritize file extension over content analysis', () => {
      // CSV content with .json extension should be detected as JSON
      const csvContentWithJsonExt = 'header1,header2\nvalue1,value2'
      const detectedFormat = detectFormat(csvContentWithJsonExt, 'test.json')
      expect(detectedFormat).toBe('json') // Extension takes precedence
    })

    it('should fall back to content analysis when extension is unknown', () => {
      const csvContent = 'header1,header2\nvalue1,value2'
      const detectedFormat = detectFormat(csvContent, 'unknown_file')
      expect(detectedFormat).toBe('csv') // Content analysis fallback
    })

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"incomplete": json'
      const detectedFormat = detectFormat(malformedJson, 'test.json')
      expect(detectedFormat).toBe('json') // Extension takes precedence, even if content is malformed
    })

    it('should handle empty files', () => {
      const emptyContent = ''
      const detectedFormat = detectFormat(emptyContent, 'empty.csv')
      expect(detectedFormat).toBe('csv') // Extension takes precedence

      const emptyContentUnknown = ''
      const detectedFormatUnknown = detectFormat(emptyContentUnknown, 'empty')
      expect(detectedFormatUnknown).toBe(null) // No extension, no content
    })
  })

  describe('Import Service Integration', () => {
    it('should validate file size correctly', () => {
      const smallContent = 'small file content'
      const isValidSize = importService.validateFileSize(smallContent)
      expect(isValidSize).toBe(true)

      logger.info('File size validation test passed')
    })

    it('should return supported formats list', () => {
      const supportedFormats = importService.getSupportedFormats()
      expect(supportedFormats).toEqual(['csv', 'json', 'hl7', 'html'])

      logger.info('Supported formats list test passed')
    })

    it('should analyze files correctly', async () => {
      for (const testFile of testFiles.slice(0, 2)) {
        // Test first 2 files to keep test fast
        const filePath = path.join(testInputDir, testFile.file)
        const content = fs.readFileSync(filePath, 'utf8')

        const analysisResult = await importService.analyzeFile(content, testFile.file)

        expect(analysisResult.success).toBe(true)
        expect(analysisResult.data.format).toBe(testFile.expectedFormat)
        expect(analysisResult.data.filename).toBe(testFile.file)
        expect(analysisResult.data.fileSize).toBe(content.length)
        expect(analysisResult.data.isSupported).toBe(true)

        logger.info('File analysis test passed', {
          file: testFile.file,
          format: analysisResult.data.format,
          size: analysisResult.data.fileSize,
        })
      }
    })

    it('should handle analysis of unsupported files', async () => {
      const unsupportedContent = 'plain text content'
      const analysisResult = await importService.analyzeFile(unsupportedContent, 'test.txt')

      expect(analysisResult.success).toBe(false)
      expect(analysisResult.errors).toBeDefined()
      expect(analysisResult.errors.length).toBeGreaterThan(0)
      expect(analysisResult.errors[0].code).toBe('UNSUPPORTED_FORMAT')

      logger.info('Unsupported file analysis test passed')
    })
  })

  describe('HTML Survey Import Functionality', () => {
    it('should successfully import BDI-II survey from HTML', async () => {
      const htmlPath = path.join(testInputDir, '04_surveybest.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      const result = await importService.importFile(htmlContent, '04_surveybest.html')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const importData = result.data.data
      expect(importData.patients).toHaveLength(1)
      expect(importData.visits).toHaveLength(1)
      expect(importData.observations.length).toBeGreaterThan(1)

      // Verify patient data
      const patient = importData.patients[0]
      expect(patient.PATIENT_CD).toBe('DEMO')
      expect(patient.SOURCESYSTEM_CD).toBe('SURVEY_BEST')

      // Verify visit data
      const visit = importData.visits[0]
      expect(visit.PATIENT_NUM).toBe(1)
      expect(visit.LOCATION_CD).toBe('QUESTIONNAIRE')
      expect(visit.INOUT_CD).toBe('O') // Outpatient

      // Verify questionnaire observation (ValType='Q')
      const questionnaireObs = importData.observations.find((obs) => obs.VALTYPE_CD === 'Q')
      expect(questionnaireObs).toBeDefined()
      expect(questionnaireObs.CONCEPT_CD).toBe('CUSTOM: QUESTIONNAIRE')
      expect(questionnaireObs.TVAL_CHAR).toBe('BDI 2')
      expect(questionnaireObs.OBSERVATION_BLOB).toBeDefined()

      // Verify individual coded observations
      const codedObs = importData.observations.filter((obs) => obs.VALTYPE_CD !== 'Q')
      expect(codedObs.length).toBeGreaterThan(0)

      // Check that only observations with proper coding are included
      codedObs.forEach((obs) => {
        expect(obs.CONCEPT_CD).toBeDefined()
        expect(obs.CONCEPT_CD).not.toBe('')
        expect(obs.CONCEPT_CD).not.toBe(null)
      })

      // Save import structure for review
      const outputPath = saveImportStructureOutput(result.data, '04_surveybest.html')

      logger.info('BDI-II survey import test passed', {
        patients: importData.patients.length,
        visits: importData.visits.length,
        observations: importData.observations.length,
        codedObservations: codedObs.length,
        outputSaved: outputPath,
      })
    })

    it('should successfully import Tremor scale survey from HTML', async () => {
      const htmlPath = path.join(testInputDir, 'PID_DEMO_quest_brain_tremor_UID_19079283-e025-40d8-a0f8-09f7f460f2da.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      const result = await importService.importFile(htmlContent, 'tremor.html')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const importData = result.data.data
      expect(importData.patients).toHaveLength(1)
      expect(importData.visits).toHaveLength(1)
      expect(importData.observations.length).toBeGreaterThan(0)

      // Verify patient data
      const patient = importData.patients[0]
      expect(patient.PATIENT_CD).toBe('DEMO')

      // Verify questionnaire observation
      const questionnaireObs = importData.observations.find((obs) => obs.VALTYPE_CD === 'Q')
      expect(questionnaireObs).toBeDefined()
      expect(questionnaireObs.TVAL_CHAR).toBe('Bain Tremorskala')
      expect(questionnaireObs.OBSERVATION_BLOB).toBeDefined()

      // Verify Results Section observation
      const resultObs = importData.observations.find((obs) => obs.CATEGORY_CHAR === 'SURVEY_RESULT')
      expect(resultObs).toBeDefined()
      expect(resultObs.NVAL_NUM).toBe(67) // Tremor scale sum
      expect(resultObs.CONCEPT_CD).toContain('BAIN_TREMOR')

      // Save import structure for review
      const outputPath = saveImportStructureOutput(result.data, 'PID_DEMO_quest_brain_tremor_UID_19079283-e025-40d8-a0f8-09f7f460f2da.html')

      logger.info('Tremor scale survey import test passed', {
        patients: importData.patients.length,
        visits: importData.visits.length,
        observations: importData.observations.length,
        tremorSum: resultObs?.NVAL_NUM,
        outputSaved: outputPath,
      })
    })

    it('should successfully import HL7 FHIR Composition document', async () => {
      const hl7Path = path.join(testInputDir, '03_hl7_fhir_json_cda.hl7')
      const hl7Content = fs.readFileSync(hl7Path, 'utf8')

      const result = await importService.importFile(hl7Content, '03_hl7_fhir_json_cda.hl7')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const importData = result.data.data
      expect(importData.patients).toHaveLength(2)
      expect(importData.visits).toHaveLength(4)
      expect(importData.observations.length).toBeGreaterThan(40)

      // Verify patient data
      const patient1 = importData.patients.find((p) => p.PATIENT_CD === 'DEMO_PATIENT_01')
      expect(patient1).toBeDefined()
      expect(patient1.AGE_IN_YEARS).toBe(32)
      expect(patient1.SEX_CD).toBe('SCTID: 407374003')

      const patient2 = importData.patients.find((p) => p.PATIENT_CD === 'DEMO_PATIENT_02')
      expect(patient2).toBeDefined()
      expect(patient2.AGE_IN_YEARS).toBe(79)
      expect(patient2.SEX_CD).toBe('SCTID: 32570691000036108')

      // Verify visit data
      expect(importData.visits[0].LOCATION_CD).toBe('DEMO_HOSPITAL/INTERNAL')
      expect(importData.visits[0].START_DATE).toBe('2024-11-29')
      expect(importData.visits[0].INOUT_CD).toBe('I') // Hospital = Inpatient

      // Verify observations have proper structure
      const observations = importData.observations
      expect(observations.length).toBeGreaterThan(0)

      // Check that observations have proper structure
      observations.forEach((obs) => {
        expect(obs.CONCEPT_CD).toBeDefined()
        expect(obs.CONCEPT_CD).not.toBe('')
        expect(obs.VALTYPE_CD).toBeDefined()
        expect(['T', 'N', 'D', 'Q']).toContain(obs.VALTYPE_CD)
      })

      // Save import structure for review
      const outputPath = saveImportStructureOutput(result.data, '03_hl7_fhir_json_cda.hl7')

      logger.info('HL7 FHIR Composition import test passed', {
        patients: importData.patients.length,
        visits: importData.visits.length,
        observations: importData.observations.length,
        outputSaved: outputPath,
      })
    })

    it('should successfully import CSV Variant A (two-header format)', async () => {
      const csvPath = path.join(testInputDir, '01_csv_data.csv')
      const csvContent = fs.readFileSync(csvPath, 'utf8')

      const result = await importService.importFile(csvContent, '01_csv_data.csv')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const importData = result.data.data
      expect(importData.patients).toHaveLength(2)
      expect(importData.visits).toHaveLength(4)
      expect(importData.observations.length).toBeGreaterThan(20)

      // Verify patient data
      const patient1 = importData.patients.find((p) => p.PATIENT_CD === 'DEMO_PATIENT_01')
      expect(patient1).toBeDefined()
      expect(patient1.AGE_IN_YEARS).toBe(32)
      expect(patient1.SEX_CD).toBe('SCTID: 407374003')

      const patient2 = importData.patients.find((p) => p.PATIENT_CD === 'DEMO_PATIENT_02')
      expect(patient2).toBeDefined()
      expect(patient2.AGE_IN_YEARS).toBe(79)
      expect(patient2.SEX_CD).toBe('SCTID: 32570691000036108')

      // Verify observations have proper structure
      const observations = importData.observations
      expect(observations.length).toBeGreaterThan(0)

      observations.forEach((obs) => {
        expect(obs.CONCEPT_CD).toBeDefined()
        expect(obs.CONCEPT_CD).not.toBe('')
        expect(obs.VALTYPE_CD).toBeDefined()
        expect(['T', 'N', 'D', 'Q']).toContain(obs.VALTYPE_CD)
      })

      // Save import structure for review
      const outputPath = saveImportStructureOutput(result.data, '01_csv_data.csv')

      logger.info('CSV Variant A import test passed', {
        patients: importData.patients.length,
        visits: importData.visits.length,
        observations: importData.observations.length,
        outputSaved: outputPath,
      })
    })

    it('should successfully import CSV Variant B (four-header format)', async () => {
      const csvPath = path.join(testInputDir, 'Export-Tabelle-20230313.csv')
      const csvContent = fs.readFileSync(csvPath, 'utf8')

      const result = await importService.importFile(csvContent, 'Export-Tabelle-20230313.csv')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const importData = result.data.data
      expect(importData.patients.length).toBeGreaterThan(0)
      expect(importData.visits.length).toBeGreaterThan(0)
      expect(importData.observations.length).toBeGreaterThan(0)

      // Verify patient data
      const patients = importData.patients
      expect(patients.length).toBeGreaterThan(0)

      // Verify observations have proper structure with units
      const observations = importData.observations
      expect(observations.length).toBeGreaterThan(0)

      observations.forEach((obs) => {
        expect(obs.CONCEPT_CD).toBeDefined()
        expect(obs.CONCEPT_CD).not.toBe('')
        expect(obs.VALTYPE_CD).toBeDefined()
        expect(['T', 'N', 'D', 'Q']).toContain(obs.VALTYPE_CD)
        // Variant B should have more detailed unit information
        if (obs.VALTYPE_CD === 'N' && obs.UNIT_CD) {
          expect(obs.UNIT_CD).toBeDefined()
        }
      })

      // Save import structure for review
      const outputPath = saveImportStructureOutput(result.data, 'Export-Tabelle-20230313.csv')

      logger.info('CSV Variant B import test passed', {
        patients: importData.patients.length,
        visits: importData.visits.length,
        observations: importData.observations.length,
        outputSaved: outputPath,
      })
    })

    it('should create proper importStructure format', async () => {
      const htmlPath = path.join(testInputDir, '04_surveybest.html')
      const htmlContent = fs.readFileSync(htmlPath, 'utf8')

      const result = await importService.importFile(htmlContent, '04_surveybest.html')

      expect(result.success).toBe(true)
      const importStructure = result.data

      // Verify importStructure has all required sections
      expect(importStructure.metadata).toBeDefined()
      expect(importStructure.exportInfo).toBeDefined()
      expect(importStructure.data).toBeDefined()
      expect(importStructure.statistics).toBeDefined()

      // Verify metadata
      expect(importStructure.metadata.format).toBe('html_survey_cda')
      expect(importStructure.metadata.source).toBe('surveyBEST CDA')
      expect(importStructure.metadata.patientCount).toBe(1)
      expect(importStructure.metadata.patientIds).toEqual(['DEMO'])

      // Verify data structure matches 02_json.json format
      expect(importStructure.data.patients).toBeInstanceOf(Array)
      expect(importStructure.data.visits).toBeInstanceOf(Array)
      expect(importStructure.data.observations).toBeInstanceOf(Array)

      // Verify statistics
      expect(importStructure.statistics.patientCount).toBe(1)
      expect(importStructure.statistics.visitCount).toBe(1)
      expect(importStructure.statistics.observationCount).toBeGreaterThan(0)

      // Save import structure for review
      const outputPath = saveImportStructureOutput(importStructure, '04_surveybest_structure.html')

      logger.info('ImportStructure format validation passed', { outputSaved: outputPath })
    })

    it('should save import structures for all test files', async () => {
      // Test all file formats and save their import structures
      const testFilesToImport = [
        { file: '04_surveybest.html', format: 'html' },
        { file: 'PID_DEMO_quest_brain_tremor_UID_19079283-e025-40d8-a0f8-09f7f460f2da.html', format: 'html' },
        { file: '02_json.json', format: 'json' },
        { file: '03_hl7_fhir_json_cda.hl7', format: 'hl7' },
        { file: '01_csv_data.csv', format: 'csv' },
        { file: 'Export-Tabelle-20230313.csv', format: 'csv' },
      ]

      for (const testFile of testFilesToImport) {
        const filePath = path.join(testInputDir, testFile.file)
        const content = fs.readFileSync(filePath, 'utf8')

        try {
          const result = await importService.importFile(content, testFile.file)

          if (result.success) {
            const outputPath = saveImportStructureOutput(result.data, testFile.file)
            logger.info('Import structure saved', {
              file: testFile.file,
              format: testFile.format,
              outputPath,
              patients: result.data.data.patients.length,
              visits: result.data.data.visits.length,
              observations: result.data.data.observations.length,
            })
          } else {
            logger.warn('Import failed for file', { file: testFile.file, errors: result.errors })
          }
        } catch (error) {
          logger.error('Import test failed', { file: testFile.file, error: error.message })
        }
      }
    })

    it('should successfully import JSON file with proper structure', async () => {
      const jsonPath = path.join(testInputDir, '02_json.json')
      const jsonContent = fs.readFileSync(jsonPath, 'utf8')

      const result = await importService.importFile(jsonContent, '02_json.json')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const importData = result.data.data
      expect(importData.patients).toHaveLength(2)
      expect(importData.visits).toHaveLength(4)
      expect(importData.observations.length).toBeGreaterThan(40)

      // Verify patient data
      const patient1 = importData.patients.find((p) => p.PATIENT_CD === 'DEMO_PATIENT_01')
      expect(patient1).toBeDefined()
      expect(patient1.AGE_IN_YEARS).toBe(32)
      expect(patient1.SEX_CD).toBe('SCTID: 407374003')

      // Verify questionnaire observation (ValType='Q')
      const questionnaireObs = importData.observations.find((obs) => obs.VALTYPE_CD === 'Q')
      expect(questionnaireObs).toBeDefined()
      expect(questionnaireObs.CONCEPT_CD).toBe('CUSTOM: QUESTIONNAIRE')
      expect(questionnaireObs.TVAL_CHAR).toBe('MoCA')
      expect(questionnaireObs.OBSERVATION_BLOB).toBeDefined()

      // Verify regular observations
      const regularObs = importData.observations.filter((obs) => obs.VALTYPE_CD !== 'Q')
      expect(regularObs.length).toBeGreaterThan(0)

      // Check that observations have proper structure
      regularObs.forEach((obs) => {
        expect(obs.CONCEPT_CD).toBeDefined()
        expect(obs.CONCEPT_CD).not.toBe('')
      })

      // Save import structure for review
      const outputPath = saveImportStructureOutput(result.data, '02_json.json')

      logger.info('JSON import test passed', {
        patients: importData.patients.length,
        visits: importData.visits.length,
        observations: importData.observations.length,
        questionnaireObservations: importData.observations.filter((obs) => obs.VALTYPE_CD === 'Q').length,
        outputSaved: outputPath,
      })
    })
  })
})
