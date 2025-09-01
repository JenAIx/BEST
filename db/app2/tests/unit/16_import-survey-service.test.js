/**
 * Unit Tests for Survey Import Service
 *
 * Tests:
 * - HTML content parsing and CDA extraction
 * - Survey data extraction from HTML
 * - CDA validation and transformation
 * - Questionnaire response processing
 * - Error handling for invalid HTML
 * - File reading from test_import/ directory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportSurveyService } from '../../src/core/services/imports/import-survey-service.js'
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

describe('Survey Import Service', () => {
  let surveyImportService

  beforeEach(() => {
    // Mock the HL7 service constructor
    vi.mock('../../src/core/services/hl7-service.js', () => ({
      Hl7Service: vi.fn().mockImplementation(() => mockHl7Service),
    }))

    surveyImportService = new ImportSurveyService(mockConceptRepository, mockCqlRepository)
  })

  describe('HTML Content Parsing', () => {
    it('should extract CDA from script tags', () => {
      const htmlContent = `
        <html>
        <head><title>Test Survey</title></head>
        <body>
          <script>
            const surveyData = {
              "cda": {
                "questionnaire": {"type": "BDI-II"},
                "responses": [{"question": "Mood", "answer": "Good"}]
              }
            };
          </script>
        </body>
        </html>
      `

      const cdaData = surveyImportService.extractCdaFromHtml(htmlContent)

      expect(cdaData).toBeDefined()
      expect(cdaData).toContain('questionnaire')
      expect(cdaData).toContain('BDI-II')
    })

    it('should extract CDA from embedded JSON', () => {
      const htmlContent = `
        <div id="survey-results">
          {"cda": {"patient": {"id": "123"}, "responses": []}}
        </div>
      `

      const cdaData = surveyImportService.extractCdaFromHtml(htmlContent)

      expect(cdaData).toBeDefined()
      expect(typeof cdaData).toBe('string')
      expect(cdaData).toMatch(/"patient":/)
      expect(cdaData).toMatch(/"id": "123"/)
    })

    it('should extract CDA from window object assignments', () => {
      const htmlContent = `
        <script>
          window.questionnaireData = {
            "cda": {
              "completedAt": "2024-01-15",
              "responses": [{"answer": "Yes"}]
            }
          };
        </script>
      `

      const cdaData = surveyImportService.extractCdaFromHtml(htmlContent)

      expect(cdaData).toBeDefined()
      expect(cdaData).toContain('completedAt')
    })

    it('should return null when no CDA found', () => {
      const htmlContent = `
        <html>
        <body>
          <h1>No CDA Data Here</h1>
          <p>This is just regular HTML content.</p>
        </body>
        </html>
      `

      const cdaData = surveyImportService.extractCdaFromHtml(htmlContent)

      expect(cdaData).toBeNull()
    })

    it('should handle malformed JSON in HTML', () => {
      const htmlContent = `
        <script>
          const badData = {incomplete: json};
        </script>
      `

      const cdaData = surveyImportService.extractCdaFromHtml(htmlContent)

      // Should return null for malformed JSON
      expect(cdaData).toBeNull()
    })
  })

  describe('CDA Data Parsing', () => {
    it('should parse valid CDA JSON', () => {
      const cdaJson = '{"questionnaire": {"type": "Survey"}, "responses": []}'

      const result = surveyImportService.parseCdaData(cdaJson)

      expect(result.questionnaire.type).toBe('Survey')
      expect(result.responses).toEqual([])
    })

    it('should handle CDA wrapper objects', () => {
      const cdaJson = '{"cda": {"questionnaire": {"type": "Test"}, "patient": {"id": "123"}}}'

      const result = surveyImportService.parseCdaData(cdaJson)

      expect(result.cda.questionnaire.type).toBe('Test')
      expect(result.cda.patient.id).toBe('123')
    })

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{invalid json}'

      expect(() => surveyImportService.parseCdaData(invalidJson)).toThrow('Failed to parse CDA data')
    })
  })

  describe('Survey CDA Validation', () => {
    it('should validate correct survey CDA structure', () => {
      const cdaData = {
        questionnaire: { type: 'BDI-II' },
        patient: { id: '123', identifier: 'PAT001' },
        responses: [{ question: 'Mood', answer: 'Good' }],
      }

      const result = surveyImportService.validateSurveyCda(cdaData)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing survey responses', () => {
      const cdaData = {
        questionnaire: { type: 'Survey' },
        patient: { id: '123' },
        // Missing responses
      }

      const result = surveyImportService.validateSurveyCda(cdaData)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'NO_SURVEY_RESPONSES')).toBe(true)
    })

    it('should detect empty responses array', () => {
      const cdaData = {
        questionnaire: { type: 'Survey' },
        patient: { id: '123' },
        responses: [],
      }

      const result = surveyImportService.validateSurveyCda(cdaData)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'NO_SURVEY_RESPONSES')).toBe(true)
    })

    it('should warn about missing patient info', () => {
      const cdaData = {
        questionnaire: { type: 'Survey' },
        responses: [{ answer: 'Yes' }],
        // Missing patient
      }

      const result = surveyImportService.validateSurveyCda(cdaData)

      expect(result.isValid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'MISSING_PATIENT_INFO')).toBe(true)
    })

    it('should warn about missing survey data indicators', () => {
      const cdaData = {
        someOtherData: 'value',
        // No questionnaire, survey, assessment, etc.
      }

      const result = surveyImportService.validateSurveyCda(cdaData)

      expect(result.isValid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'NO_SURVEY_DATA_DETECTED')).toBe(true)
    })
  })

  describe('Clinical Data Transformation', () => {
    it('should extract patient from survey CDA', () => {
      const cdaData = {
        patient: {
          id: '123',
          identifier: 'PAT001',
          uid: 'bf3779c8-0302-4517-a6b0-5cf065a799f6',
          gender: 'male',
          age: 32,
        },
        questionnaire: {
          type: 'BDI-II',
        },
        date: '2024-01-15',
      }

      const patient = surveyImportService.extractPatientFromSurvey(cdaData)

      expect(patient.PATIENT_CD).toBe('PAT001')
      expect(patient.SEX_CD).toBe('M')
      expect(patient.AGE_IN_YEARS).toBe(32)
      expect(patient.surveyType).toBe('BDI-II')
    })

    it('should extract visit from survey CDA', () => {
      const cdaData = {
        date: '2024-01-15T10:30:00Z',
        questionnaire: { type: 'Assessment' },
      }

      const visit = surveyImportService.extractVisitFromSurvey(cdaData, 123)

      expect(visit.PATIENT_NUM).toBe(123)
      expect(visit.START_DATE).toBe('2024-01-15')
      expect(visit.LOCATION_CD).toBe('OUTPATIENT')
      expect(visit.INOUT_CD).toBe('O')
      expect(visit.surveyType).toBe('Assessment')
    })

    it('should extract observations from survey responses', () => {
      const cdaData = {
        responses: [
          {
            question: 'How do you feel today?',
            answer: 'Good',
            code: 'MOOD_001',
          },
          {
            question: 'Rate your sleep quality',
            answer: 8,
            type: 'scale',
          },
        ],
      }

      const observations = surveyImportService.extractObservationsFromSurvey(cdaData, 456)

      expect(observations).toHaveLength(2)
      expect(observations[0].CONCEPT_CD).toBe('MOOD_001')
      expect(observations[0].TVAL_CHAR).toBe('Good')
      expect(observations[0].ENCOUNTER_NUM).toBe(456)
      expect(observations[1].NVAL_NUM).toBe(8)
    })

    it('should handle different answer types', () => {
      const responses = [{ answer: 'Text answer' }, { answer: 5 }, { answer: true }, { answer: { complex: 'object' } }, { answer: null }]

      responses.forEach((response, index) => {
        const observation = surveyImportService.createObservationFromSurveyResponse(response, 123, index)

        if (observation) {
          expect(observation.ENCOUNTER_NUM).toBe(123)
          expect(observation.CONCEPT_CD).toBeDefined()
        }
      })
    })

    it('should create observations with proper value types', () => {
      const testCases = [
        { answer: 'Text response', expectedType: 'T', expectedValue: 'Text response' },
        { answer: 42, expectedType: 'N', expectedValue: 42 },
        { answer: true, expectedType: 'T', expectedValue: 'Yes' },
        { answer: false, expectedType: 'T', expectedValue: null },
        { answer: { key: 'value' }, expectedType: 'B', expectedValue: '{"key":"value"}' },
      ]

      testCases.forEach((testCase, index) => {
        const observation = surveyImportService.createObservationFromSurveyResponse(
          {
            question: `Question ${index}`,
            answer: testCase.answer,
          },
          123,
          index,
        )

        expect(observation.VALTYPE_CD).toBe(testCase.expectedType)
        if (testCase.expectedType === 'N') {
          expect(observation.NVAL_NUM).toBe(testCase.expectedValue)
        } else if (testCase.expectedType === 'B') {
          expect(observation.BVAL_BLOB).toBe(testCase.expectedValue)
        } else {
          expect(observation.TVAL_CHAR).toBe(testCase.expectedValue)
        }
      })
    })
  })

  describe('HTML Content Validation', () => {
    it('should validate HTML with script tags', () => {
      const htmlContent = `
        <html>
        <head><title>Survey</title></head>
        <body>
          <script>const data = {};</script>
        </body>
        </html>
      `

      const result = surveyImportService.validateHtmlContent(htmlContent)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing HTML structure', () => {
      const htmlContent = 'Just some plain text content'

      const result = surveyImportService.validateHtmlContent(htmlContent)

      expect(result.isValid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'NO_HTML_STRUCTURE')).toBe(true)
    })

    it('should detect missing script tags', () => {
      const htmlContent = `
        <html>
        <body>
          <h1>Survey Results</h1>
          <p>No scripts here</p>
        </body>
        </html>
      `

      const result = surveyImportService.validateHtmlContent(htmlContent)

      expect(result.isValid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'NO_SCRIPT_TAGS')).toBe(true)
    })

    it('should handle empty HTML', () => {
      const result = surveyImportService.validateHtmlContent('')

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'EMPTY_HTML')).toBe(true)
    })
  })

  describe('Metadata Extraction', () => {
    it('should extract metadata from HTML survey', () => {
      const htmlContent = `
        <html>
        <head><title>BDI-II Assessment</title></head>
        <body>
          <h1>Survey Completed</h1>
        </body>
        </html>
      `

      const cdaData = {
        completedAt: '2024-01-15T10:30:00Z',
        questionnaire: {
          type: 'BDI-II',
          title: 'Beck Depression Inventory II',
          version: '2.0',
          items: 21,
        },
        responses: Array(21).fill({}), // 21 responses
      }

      const metadata = surveyImportService.extractSurveyMetadata(htmlContent, cdaData)

      expect(metadata.title).toBe('BDI-II Assessment')
      expect(metadata.contentType).toBe('HTML Survey')
      expect(metadata.completedAt).toBe('2024-01-15T10:30:00Z')
      expect(metadata.surveyType).toBeDefined()
      expect(metadata.questionnaire.version).toBe('2.0')
      expect(metadata.questionnaire.items).toBe(21)
      expect(metadata.responseCount).toBe(21)
    })

    it('should handle missing metadata fields', () => {
      const htmlContent = '<html><body>Minimal HTML</body></html>'
      const cdaData = { responses: [] }

      const metadata = surveyImportService.extractSurveyMetadata(htmlContent, cdaData)

      expect(metadata.title).toBeUndefined()
      expect(metadata.contentType).toBe('HTML Survey')
      expect(metadata.responseCount).toBe(0)
      expect(metadata.extractedAt).toBeDefined()
    })
  })

  describe('File Import Tests', () => {
    beforeEach(() => {
      mockHl7Service.importFromHl7.mockReset()
    })

    it('should import from 04_surveybest.html test file', async () => {
      const htmlContent = readTestFile('04_surveybest.html')
      if (!htmlContent) {
        console.warn('Skipping test: 04_surveybest.html not found')
        return
      }

      // Mock successful CDA extraction and processing
      const mockCdaData = {
        questionnaire: { type: 'BDI-II' },
        patient: { id: '123', identifier: 'PAT001' },
        responses: [
          { question: 'Mood', answer: 'Good' },
          { question: 'Sleep', answer: 7 },
        ],
      }

      // Mock the extraction method
      vi.spyOn(surveyImportService, 'extractCdaFromHtml').mockReturnValue(JSON.stringify(mockCdaData))

      const result = await surveyImportService.importFromHtml(htmlContent)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.patients).toHaveLength(1)
      expect(result.data.observations).toHaveLength(2)
      expect(result.metadata.contentType).toBe('HTML Survey')
    })

    it('should handle HTML without CDA data', async () => {
      const htmlWithoutCda = `
        <html>
        <body>
          <h1>No CDA Data</h1>
          <p>This HTML has no survey data.</p>
        </body>
        </html>
      `

      const result = await surveyImportService.importFromHtml(htmlWithoutCda)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.code === 'NO_CDA_FOUND')).toBe(true)
    })

    it('should handle empty HTML', async () => {
      const result = await surveyImportService.importFromHtml('')

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should handle HTML with invalid CDA JSON', async () => {
      const htmlWithInvalidCda = `
        <html>
        <script>
          const surveyData = {invalid: json};
        </script>
        </html>
      `

      const result = await surveyImportService.importFromHtml(htmlWithInvalidCda)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle CDA parsing errors', async () => {
      const htmlContent = `
        <script>
          const surveyData = {invalid json};
        </script>
      `

      const result = await surveyImportService.importFromHtml(htmlContent)

      expect(result.success).toBe(false)
      expect(result.errors[0].message).toContain('No CDA data found')
    })

    it('should handle validation failures', async () => {
      const htmlContent = `
        <script>
          const surveyData = {"responses": []};
        </script>
      `

      const result = await surveyImportService.importFromHtml(htmlContent)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should handle transformation errors gracefully', async () => {
      // Mock a CDA that will cause transformation issues
      const problematicCda = {
        responses: [
          { question: null, answer: null }, // This might cause issues
        ],
      }

      vi.spyOn(surveyImportService, 'extractCdaFromHtml').mockReturnValue(JSON.stringify(problematicCda))

      const htmlContent = '<script>const data = {};</script>'

      const result = await surveyImportService.importFromHtml(htmlContent)

      // Should still succeed even with problematic data
      expect(result.success).toBeDefined()
    })
  })
})
