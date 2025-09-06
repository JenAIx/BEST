/**
 * Observation Repository Unit Tests
 *
 * Tests the ObservationRepository class functionality including:
 * - CRUD operations for clinical observations
 * - Search and filtering methods
 * - Value type handling (numeric, text, BLOB)
 * - Clinical data specific business logic
 * - Error handling and validation
 * - Statistics and pagination
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import ObservationRepository from '../../src/core/database/repositories/observation-repository.js'

describe('ObservationRepository', () => {
  let observationRepository
  let mockConnection

  beforeEach(() => {
    // Create mock connection with all required methods
    mockConnection = {
      executeQuery: vi.fn(),
      executeCommand: vi.fn(),
    }

    observationRepository = new ObservationRepository(mockConnection)
  })

  describe('Constructor', () => {
    it('should initialize with correct table name and primary key', () => {
      expect(observationRepository.tableName).toBe('OBSERVATION_FACT')
      expect(observationRepository.primaryKey).toBe('OBSERVATION_ID')
    })
  })

  describe('createObservation', () => {
    it('should create an observation with required fields', async () => {
      const observationData = {
        ENCOUNTER_NUM: 244,
        PATIENT_NUM: 72,
        CONCEPT_CD: 'SCTID: 273249006',
        CATEGORY_CHAR: 'surveyBEST',
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastID: 9397,
        changes: 1,
      })

      const result = await observationRepository.createObservation(observationData)

      expect(result).toEqual({
        ENCOUNTER_NUM: 244,
        PATIENT_NUM: 72,
        CONCEPT_CD: 'SCTID: 273249006',
        CATEGORY_CHAR: 'surveyBEST',
        START_DATE: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        VALTYPE_CD: 'T',
        SOURCESYSTEM_CD: 'SYSTEM',
        UPLOAD_ID: 1,
        OBSERVATION_ID: 9397,
      })
    })

    it('should set default values for optional fields', async () => {
      const observationData = {
        ENCOUNTER_NUM: 244,
        PATIENT_NUM: 72,
        CONCEPT_CD: 'SCTID: 273249006',
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastID: 9398,
        changes: 1,
      })

      const result = await observationRepository.createObservation(observationData)

      expect(result.CATEGORY_CHAR).toBe('CLINICAL')
      expect(result.VALTYPE_CD).toBe('T')
      expect(result.SOURCESYSTEM_CD).toBe('SYSTEM')
      expect(result.UPLOAD_ID).toBe(1)
    })

    it('should throw error if ENCOUNTER_NUM is missing', async () => {
      const observationData = {
        PATIENT_NUM: 72,
        CONCEPT_CD: 'SCTID: 273249006',
      }

      await expect(observationRepository.createObservation(observationData)).rejects.toThrow('ENCOUNTER_NUM is required for observation creation')
    })

    it('should throw error if PATIENT_NUM is missing', async () => {
      const observationData = {
        ENCOUNTER_NUM: 244,
        CONCEPT_CD: 'SCTID: 273249006',
      }

      await expect(observationRepository.createObservation(observationData)).rejects.toThrow('PATIENT_NUM is required for observation creation')
    })

    it('should throw error if CONCEPT_CD is missing', async () => {
      const observationData = {
        ENCOUNTER_NUM: 244,
        PATIENT_NUM: 72,
      }

      await expect(observationRepository.createObservation(observationData)).rejects.toThrow('CONCEPT_CD is required for observation creation')
    })
  })

  describe('findByPatientNum', () => {
    it('should find observations by patient number', async () => {
      const mockObservations = [
        { OBSERVATION_ID: 9397, PATIENT_NUM: 72, CONCEPT_CD: 'SCTID: 273249006' },
        { OBSERVATION_ID: 9398, PATIENT_NUM: 72, CONCEPT_CD: 'SCTID: SAMS_2_SCORE' },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.findByPatientNum(72)

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM OBSERVATION_FACT WHERE PATIENT_NUM = ?'), [72])
    })
  })

  describe('findByVisitNum', () => {
    it('should find observations by encounter number', async () => {
      const mockObservations = [{ OBSERVATION_ID: 9397, ENCOUNTER_NUM: 244, CONCEPT_CD: 'SCTID: 273249006' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.findByVisitNum(244)

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM OBSERVATION_FACT WHERE ENCOUNTER_NUM = ?'), [244])
    })
  })

  describe('findByConceptCode', () => {
    it('should find observations by concept code', async () => {
      const mockObservations = [{ OBSERVATION_ID: 9397, CONCEPT_CD: 'SCTID: 273249006' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.findByConceptCode('SCTID: 273249006')

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM OBSERVATION_FACT WHERE CONCEPT_CD = ?'), ['SCTID: 273249006'])
    })
  })

  describe('findByCategory', () => {
    it('should find observations by category', async () => {
      const mockObservations = [{ OBSERVATION_ID: 9397, CATEGORY_CHAR: 'surveyBEST' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.findByCategory('surveyBEST')

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM OBSERVATION_FACT WHERE CATEGORY_CHAR = ?'), ['surveyBEST'])
    })
  })

  describe('findByValueType', () => {
    it('should find observations by value type', async () => {
      const mockObservations = [{ OBSERVATION_ID: 9398, VALTYPE_CD: 'N', NVAL_NUM: 34 }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.findByValueType('N')

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM OBSERVATION_FACT WHERE VALTYPE_CD = ?'), ['N'])
    })
  })

  describe('findByNumericValueRange', () => {
    it('should find observations with numeric values in range', async () => {
      const mockObservations = [{ OBSERVATION_ID: 9398, VALTYPE_CD: 'N', NVAL_NUM: 34 }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.findByNumericValueRange(30, 40)

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE VALTYPE_CD = 'N' AND NVAL_NUM BETWEEN ? AND ?"), [30, 40])
    })
  })

  describe('findByTextValue', () => {
    it('should find observations by text value pattern', async () => {
      const mockObservations = [{ OBSERVATION_ID: 9397, VALTYPE_CD: 'T', TVAL_CHAR: 'SAMS Score' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.findByTextValue('SAMS')

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE VALTYPE_CD = 'T' AND TVAL_CHAR LIKE ?"), ['%SAMS%'])
    })
  })

  describe('getObservationStatistics', () => {
    it('should return comprehensive observation statistics', async () => {
      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 100 }] }) // totalObservations
        .mockResolvedValueOnce({
          success: true,
          data: [{ CATEGORY_CHAR: 'surveyBEST', count: 50 }],
        }) // byCategory
        .mockResolvedValueOnce({
          success: true,
          data: [
            { VALTYPE_CD: 'N', count: 30 },
            { VALTYPE_CD: 'T', count: 70 },
          ],
        }) // byValueType
        .mockResolvedValueOnce({
          success: true,
          data: [{ CONCEPT_CD: 'SCTID: 273249006', count: 25 }],
        }) // byConcept
        .mockResolvedValueOnce({ success: true, data: [{ month: '2023-12', count: 100 }] }) // byMonth
        .mockResolvedValueOnce({ success: true, data: [{ PROVIDER_ID: 'hl7import', count: 80 }] }) // byProvider

      const result = await observationRepository.getObservationStatistics()

      expect(result).toEqual({
        totalObservations: 100,
        byCategory: [{ CATEGORY_CHAR: 'surveyBEST', count: 50 }],
        byValueType: [
          { VALTYPE_CD: 'N', count: 30 },
          { VALTYPE_CD: 'T', count: 70 },
        ],
        byConcept: [{ CONCEPT_CD: 'SCTID: 273249006', count: 25 }],
        byMonth: [{ month: '2023-12', count: 100 }],
        byProvider: [{ PROVIDER_ID: 'hl7import', count: 80 }],
      })
    })

    it('should handle statistics errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await observationRepository.getObservationStatistics()

      expect(result).toEqual({
        totalObservations: 0,
        byCategory: [],
        byValueType: [],
        byConcept: [],
        byMonth: [],
        byProvider: [],
      })
    })
  })

  describe('getObservationValue', () => {
    it('should return numeric value for N type', () => {
      const observation = { VALTYPE_CD: 'N', NVAL_NUM: 34 }
      const result = observationRepository.getObservationValue(observation)
      expect(result).toBe(34)
    })

    it('should return text value for T type', () => {
      const observation = { VALTYPE_CD: 'T', TVAL_CHAR: 'Test Value' }
      const result = observationRepository.getObservationValue(observation)
      expect(result).toBe('Test Value')
    })

    it('should return parsed JSON for B type', () => {
      const jsonData = { test: 'value' }
      const observation = { VALTYPE_CD: 'B', OBSERVATION_BLOB: JSON.stringify(jsonData) }
      const result = observationRepository.getObservationValue(observation)
      expect(result).toEqual(jsonData)
    })

    it('should return raw BLOB for invalid JSON in B type', () => {
      const observation = { VALTYPE_CD: 'B', OBSERVATION_BLOB: 'invalid json' }
      const result = observationRepository.getObservationValue(observation)
      expect(result).toBe('invalid json')
    })

    it('should return text or numeric value for unknown type', () => {
      const observation = { VALTYPE_CD: 'X', TVAL_CHAR: 'fallback', NVAL_NUM: 42 }
      const result = observationRepository.getObservationValue(observation)
      expect(result).toBe('fallback')
    })
  })

  describe('getSurveyObservations', () => {
    it('should find survey observations by code', async () => {
      const mockObservations = [
        {
          OBSERVATION_ID: 9397,
          CATEGORY_CHAR: 'surveyBEST',
          OBSERVATION_BLOB: '{"quest":"sams_1"}',
        },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.getSurveyObservations('sams_1')

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE CATEGORY_CHAR = 'surveyBEST'"), ['%sams_1%'])
    })
  })

  describe('getPatientNumericSummary', () => {
    it('should return numeric summary for patient', async () => {
      const mockSummary = [
        {
          CONCEPT_CD: 'SCTID: SAMS_2_SCORE',
          count: 5,
          average: 32.4,
          minimum: 28,
          maximum: 38,
          total: 162,
        },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockSummary,
      })

      const result = await observationRepository.getPatientNumericSummary(72)

      expect(result).toEqual(mockSummary)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE PATIENT_NUM = ? AND VALTYPE_CD = 'N'"), [72])
    })
  })

  describe('updateObservation', () => {
    it('should update existing observation', async () => {
      const existingObservation = { OBSERVATION_ID: 9397, PATIENT_NUM: 72 }
      const updateData = { TVAL_CHAR: 'Updated Value' }

      vi.spyOn(observationRepository, 'findById').mockResolvedValue(existingObservation)
      vi.spyOn(observationRepository, 'update').mockResolvedValue(true)

      const result = await observationRepository.updateObservation(9397, updateData)

      expect(result).toBe(true)
      expect(observationRepository.update).toHaveBeenCalledWith(9397, updateData)
    })

    it('should throw error for non-existent observation', async () => {
      vi.spyOn(observationRepository, 'findById').mockResolvedValue(null)

      await expect(observationRepository.updateObservation(999, { TVAL_CHAR: 'New' })).rejects.toThrow('Observation with OBSERVATION_ID 999 not found')
    })
  })

  describe('searchObservations', () => {
    it('should search observations by text term', async () => {
      const mockObservations = [{ OBSERVATION_ID: 9397, CATEGORY_CHAR: 'surveyBEST' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockObservations,
      })

      const result = await observationRepository.searchObservations('survey')

      expect(result).toEqual(mockObservations)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE CATEGORY_CHAR LIKE ?'), ['%survey%', '%survey%', '%survey%', '%survey%', '%survey%'])
    })

    it('should return empty array for empty search term', async () => {
      const result = await observationRepository.searchObservations('')
      expect(result).toEqual([])
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Connection failed'))

      await expect(observationRepository.findByPatientNum(72)).rejects.toThrow('Connection failed')
    })

    it('should handle malformed query results gracefully', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        error: 'Invalid query',
      })

      const result = await observationRepository.findByPatientNum(72)
      expect(result).toEqual([])
    })
  })
})
