/**
 * Visit Repository Unit Tests
 *
 * Tests the VisitRepository class functionality including:
 * - CRUD operations for visits
 * - Search and filtering methods
 * - Visit-specific business logic
 * - Error handling and validation
 * - Statistics and pagination
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import VisitRepository from '../../src/core/database/repositories/visit-repository.js'

describe('VisitRepository', () => {
  let visitRepository
  let mockConnection

  beforeEach(() => {
    // Create mock connection with all required methods
    mockConnection = {
      executeQuery: vi.fn(),
      executeCommand: vi.fn(),
    }

    visitRepository = new VisitRepository(mockConnection)
  })

  describe('Constructor', () => {
    it('should initialize with correct table name and primary key', () => {
      expect(visitRepository.tableName).toBe('VISIT_DIMENSION')
      expect(visitRepository.primaryKey).toBe('ENCOUNTER_NUM')
    })
  })

  describe('createVisit', () => {
    it('should create a visit with required fields', async () => {
      const visitData = {
        PATIENT_NUM: 72,
        START_DATE: '2023-12-28',
        LOCATION_CD: 'UKJ/NEURO',
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastID: 244,
        changes: 1,
      })

      const result = await visitRepository.createVisit(visitData)

      expect(result).toEqual({
        PATIENT_NUM: 72,
        START_DATE: '2023-12-28',
        LOCATION_CD: 'UKJ/NEURO',
        ACTIVE_STATUS_CD: 'A',
        INOUT_CD: 'O',
        SOURCESYSTEM_CD: 'SYSTEM',
        UPLOAD_ID: 1,
        ENCOUNTER_NUM: 244,
      })

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO VISIT_DIMENSION'),
        expect.arrayContaining([72, '2023-12-28', 'UKJ/NEURO', 'A', 'O', 'SYSTEM', 1]),
      )
    })

    it('should set default values for optional fields', async () => {
      const visitData = { PATIENT_NUM: 73 }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastID: 245,
        changes: 1,
      })

      const result = await visitRepository.createVisit(visitData)

      expect(result.ACTIVE_STATUS_CD).toBe('A')
      expect(result.INOUT_CD).toBe('O')
      expect(result.SOURCESYSTEM_CD).toBe('SYSTEM')
      expect(result.UPLOAD_ID).toBe(1)
      expect(result.START_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
    })

    it('should throw error if PATIENT_NUM is missing', async () => {
      const visitData = { START_DATE: '2023-12-28' }

      await expect(visitRepository.createVisit(visitData)).rejects.toThrow(
        'PATIENT_NUM is required for visit creation',
      )
    })

    it('should override defaults with provided values', async () => {
      const visitData = {
        PATIENT_NUM: 74,
        ACTIVE_STATUS_CD: 'I',
        INOUT_CD: 'I',
        SOURCESYSTEM_CD: 'CUSTOM',
        UPLOAD_ID: 999,
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastID: 246,
        changes: 1,
      })

      const result = await visitRepository.createVisit(visitData)

      expect(result.ACTIVE_STATUS_CD).toBe('I')
      expect(result.INOUT_CD).toBe('I')
      expect(result.SOURCESYSTEM_CD).toBe('CUSTOM')
      expect(result.UPLOAD_ID).toBe(999)
    })
  })

  describe('findByPatientNum', () => {
    it('should find visits by patient number', async () => {
      const mockVisits = [
        { ENCOUNTER_NUM: 244, PATIENT_NUM: 72, START_DATE: '2023-12-28' },
        { ENCOUNTER_NUM: 245, PATIENT_NUM: 72, START_DATE: '2023-12-27' },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.findByPatientNum(72)

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM VISIT_DIMENSION WHERE PATIENT_NUM = ? ORDER BY START_DATE DESC',
        [72],
      )
    })

    it('should return empty array if no visits found', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [],
      })

      const result = await visitRepository.findByPatientNum(999)

      expect(result).toEqual([])
    })

    it('should handle query failure gracefully', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        error: 'Database error',
      })

      const result = await visitRepository.findByPatientNum(72)

      expect(result).toEqual([])
    })
  })

  describe('findByDateRange', () => {
    it('should find visits within date range', async () => {
      const mockVisits = [
        { ENCOUNTER_NUM: 244, START_DATE: '2023-12-28' },
        { ENCOUNTER_NUM: 245, START_DATE: '2023-12-27' },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.findByDateRange('2023-12-25', '2023-12-30')

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM VISIT_DIMENSION WHERE START_DATE BETWEEN ? AND ? ORDER BY START_DATE DESC',
        ['2023-12-25', '2023-12-30'],
      )
    })
  })

  describe('findByLocationCode', () => {
    it('should find visits by location code', async () => {
      const mockVisits = [{ ENCOUNTER_NUM: 244, LOCATION_CD: 'UKJ/NEURO' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.findByLocationCode('UKJ/NEURO')

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM VISIT_DIMENSION WHERE LOCATION_CD = ? ORDER BY START_DATE DESC',
        ['UKJ/NEURO'],
      )
    })
  })

  describe('findByActiveStatus', () => {
    it('should find visits by active status', async () => {
      const mockVisits = [{ ENCOUNTER_NUM: 244, ACTIVE_STATUS_CD: 'A' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.findByActiveStatus('A')

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM VISIT_DIMENSION WHERE ACTIVE_STATUS_CD = ? ORDER BY START_DATE DESC',
        ['A'],
      )
    })
  })

  describe('findByInoutCode', () => {
    it('should find visits by in/out code', async () => {
      const mockVisits = [{ ENCOUNTER_NUM: 244, INOUT_CD: 'O' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.findByInoutCode('O')

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM VISIT_DIMENSION WHERE INOUT_CD = ? ORDER BY START_DATE DESC',
        ['O'],
      )
    })
  })

  describe('findActiveVisits', () => {
    it('should find all active visits', async () => {
      const mockVisits = [
        { ENCOUNTER_NUM: 244, ACTIVE_STATUS_CD: 'A' },
        { ENCOUNTER_NUM: 245, ACTIVE_STATUS_CD: 'A' },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.findActiveVisits()

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM VISIT_DIMENSION WHERE ACTIVE_STATUS_CD'),
      )
    })
  })

  describe('findVisitsWithObservations', () => {
    it('should find visits that have linked observations', async () => {
      const mockVisits = [{ ENCOUNTER_NUM: 244, PATIENT_NUM: 72 }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.findVisitsWithObservations()

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('INNER JOIN OBSERVATION_FACT'),
      )
    })
  })

  describe('getVisitStatistics', () => {
    it('should return comprehensive visit statistics', async () => {
      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 10 }] }) // totalVisits
        .mockResolvedValueOnce({
          success: true,
          data: [
            { ACTIVE_STATUS_CD: 'A', count: 8 },
            { ACTIVE_STATUS_CD: 'I', count: 2 },
          ],
        }) // byStatus
        .mockResolvedValueOnce({ success: true, data: [{ LOCATION_CD: 'UKJ/NEURO', count: 5 }] }) // byLocation
        .mockResolvedValueOnce({
          success: true,
          data: [
            { INOUT_CD: 'O', count: 7 },
            { INOUT_CD: 'I', count: 3 },
          ],
        }) // byInout
        .mockResolvedValueOnce({ success: true, data: [{ month: '2023-12', count: 10 }] }) // byMonth

      const result = await visitRepository.getVisitStatistics()

      expect(result).toEqual({
        totalVisits: 10,
        byStatus: [
          { ACTIVE_STATUS_CD: 'A', count: 8 },
          { ACTIVE_STATUS_CD: 'I', count: 2 },
        ],
        byLocation: [{ LOCATION_CD: 'UKJ/NEURO', count: 5 }],
        byInout: [
          { INOUT_CD: 'O', count: 7 },
          { INOUT_CD: 'I', count: 3 },
        ],
        byMonth: [{ month: '2023-12', count: 10 }],
      })
    })

    it('should handle statistics errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await visitRepository.getVisitStatistics()

      expect(result).toEqual({
        totalVisits: 0,
        byStatus: [],
        byLocation: [],
        byInout: [],
        byMonth: [],
      })
    })
  })

  describe('getVisitsPaginated', () => {
    it('should return paginated visits with metadata', async () => {
      const mockVisits = [
        { ENCOUNTER_NUM: 244, PATIENT_NUM: 72 },
        { ENCOUNTER_NUM: 245, PATIENT_NUM: 73 },
      ]

      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 25 }] }) // count
        .mockResolvedValueOnce({ success: true, data: mockVisits }) // data

      const result = await visitRepository.getVisitsPaginated(2, 10)

      expect(result.visits).toEqual(mockVisits)
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 10,
        totalCount: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      })
    })

    it('should apply search criteria correctly', async () => {
      const criteria = {
        patientNum: 72,
        activeStatus: 'A',
        locationCode: 'UKJ/NEURO',
      }

      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 5 }] }) // count
        .mockResolvedValueOnce({ success: true, data: [] }) // data

      await visitRepository.getVisitsPaginated(1, 20, criteria)

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          'WHERE 1=1 AND PATIENT_NUM = ? AND ACTIVE_STATUS_CD = ? AND LOCATION_CD = ?',
        ),
        [72, 'A', 'UKJ/NEURO'],
      )
    })

    it('should handle pagination errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await visitRepository.getVisitsPaginated(1, 20)

      expect(result.visits).toEqual([])
      expect(result.pagination.totalCount).toBe(0)
    })
  })

  describe('searchVisits', () => {
    it('should search visits by text term', async () => {
      const mockVisits = [{ ENCOUNTER_NUM: 244, LOCATION_CD: 'UKJ/NEURO' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockVisits,
      })

      const result = await visitRepository.searchVisits('UKJ')

      expect(result).toEqual(mockVisits)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE LOCATION_CD LIKE ?'),
        ['%UKJ%', '%UKJ%', '%UKJ%'],
      )
    })

    it('should return empty array for empty search term', async () => {
      const result = await visitRepository.searchVisits('')
      expect(result).toEqual([])
    })

    it('should return empty array for whitespace-only search term', async () => {
      const result = await visitRepository.searchVisits('   ')
      expect(result).toEqual([])
    })
  })

  describe('updateVisit', () => {
    it('should update existing visit', async () => {
      const existingVisit = { ENCOUNTER_NUM: 244, PATIENT_NUM: 72 }
      const updateData = { LOCATION_CD: 'UKJ/IMSID' }

      // Mock findById to return existing visit
      vi.spyOn(visitRepository, 'findById').mockResolvedValue(existingVisit)

      // Mock update method
      vi.spyOn(visitRepository, 'update').mockResolvedValue(true)

      const result = await visitRepository.updateVisit(244, updateData)

      expect(result).toBe(true)
      expect(visitRepository.update).toHaveBeenCalledWith(244, updateData)
    })

    it('should throw error for non-existent visit', async () => {
      vi.spyOn(visitRepository, 'findById').mockResolvedValue(null)

      await expect(visitRepository.updateVisit(999, { LOCATION_CD: 'NEW' })).rejects.toThrow(
        'Visit with ENCOUNTER_NUM 999 not found',
      )
    })
  })

  describe('closeVisit', () => {
    it('should close visit with current date', async () => {
      const existingVisit = { ENCOUNTER_NUM: 244, PATIENT_NUM: 72 }

      vi.spyOn(visitRepository, 'findById').mockResolvedValue(existingVisit)
      vi.spyOn(visitRepository, 'update').mockResolvedValue(true)

      const result = await visitRepository.closeVisit(244)

      expect(result).toBe(true)
      expect(visitRepository.update).toHaveBeenCalledWith(244, {
        END_DATE: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        ACTIVE_STATUS_CD: 'I',
      })
    })

    it('should close visit with specified date', async () => {
      const existingVisit = { ENCOUNTER_NUM: 244, PATIENT_NUM: 72 }

      vi.spyOn(visitRepository, 'findById').mockResolvedValue(existingVisit)
      vi.spyOn(visitRepository, 'update').mockResolvedValue(true)

      const result = await visitRepository.closeVisit(244, '2023-12-31')

      expect(result).toBe(true)
      expect(visitRepository.update).toHaveBeenCalledWith(244, {
        END_DATE: '2023-12-31',
        ACTIVE_STATUS_CD: 'I',
      })
    })
  })

  describe('getPatientVisitTimeline', () => {
    it('should return patient visit timeline with observation counts', async () => {
      const mockTimeline = [
        { ENCOUNTER_NUM: 244, PATIENT_NUM: 72, observationCount: 5 },
        { ENCOUNTER_NUM: 245, PATIENT_NUM: 72, observationCount: 3 },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockTimeline,
      })

      const result = await visitRepository.getPatientVisitTimeline(72)

      expect(result).toEqual(mockTimeline)
      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN OBSERVATION_FACT'),
        [72],
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Connection failed'))

      await expect(visitRepository.findByPatientNum(72)).rejects.toThrow('Connection failed')
    })

    it('should handle malformed query results gracefully', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        error: 'Invalid query',
      })

      const result = await visitRepository.findByPatientNum(72)
      expect(result).toEqual([])
    })
  })
})
