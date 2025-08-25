/**
 * Unit Tests for ProviderRepository
 * 
 * Tests healthcare provider management functionality including:
 * - CRUD operations for providers
 * - Provider search and filtering
 * - Organizational hierarchy management
 * - Performance metrics and statistics
 * - Provider-observation relationships
 * 
 * Uses mock SQLite connection for isolated testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import ProviderRepository from '../../src/core/database/repositories/provider-repository.js'

describe('ProviderRepository', () => {
  let providerRepository
  let mockConnection

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      executeQuery: vi.fn(),
      executeCommand: vi.fn()
    }
    
    providerRepository = new ProviderRepository(mockConnection)
  })

  describe('Constructor', () => {
    it('should initialize with correct table name and primary key', () => {
      expect(providerRepository.tableName).toBe('PROVIDER_DIMENSION')
      expect(providerRepository.primaryKey).toBe('PROVIDER_ID')
    })
  })

  describe('createProvider', () => {
    it('should create a provider with required fields', async () => {
      const providerData = {
        PROVIDER_ID: 'PROV001',
        NAME_CHAR: 'Dr. John Smith',
        PROVIDER_PATH: 'UKJ/NEURO/ATTENDING'
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastId: 'PROV001',
        changes: 1
      })

      const result = await providerRepository.createProvider(providerData)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO PROVIDER_DIMENSION'),
        expect.arrayContaining(['SYSTEM', 1, 'PROV001', 'Dr. John Smith', 'UKJ/NEURO/ATTENDING'])
      )
      expect(result).toEqual({
        ...providerData,
        SOURCESYSTEM_CD: 'SYSTEM',
        UPLOAD_ID: 1,
        PROVIDER_ID: 'PROV001'
      })
    })

    it('should throw error if PROVIDER_ID is missing', async () => {
      const providerData = {
        NAME_CHAR: 'Dr. John Smith'
      }

      await expect(providerRepository.createProvider(providerData))
        .rejects.toThrow('PROVIDER_ID is required for provider creation')
    })

    it('should throw error if NAME_CHAR is missing', async () => {
      const providerData = {
        PROVIDER_ID: 'PROV001'
      }

      await expect(providerRepository.createProvider(providerData))
        .rejects.toThrow('NAME_CHAR is required for provider creation')
    })

    it('should use custom SOURCESYSTEM_CD and UPLOAD_ID when provided', async () => {
      const providerData = {
        PROVIDER_ID: 'PROV001',
        NAME_CHAR: 'Dr. John Smith',
        SOURCESYSTEM_CD: 'CUSTOM',
        UPLOAD_ID: 999
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastId: 'PROV001',
        changes: 1
      })

      await providerRepository.createProvider(providerData)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO PROVIDER_DIMENSION'),
        expect.arrayContaining(['CUSTOM', 999, 'PROV001', 'Dr. John Smith'])
      )
    })
  })

  describe('findByProviderId', () => {
    it('should find provider by ID', async () => {
      const mockProvider = {
        PROVIDER_ID: 'PROV001',
        NAME_CHAR: 'Dr. John Smith',
        PROVIDER_PATH: 'UKJ/NEURO/ATTENDING'
      }

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [mockProvider]
      })

      const result = await providerRepository.findByProviderId('PROV001')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM PROVIDER_DIMENSION WHERE PROVIDER_ID = ?',
        ['PROV001']
      )
      expect(result).toEqual(mockProvider)
    })

    it('should return null if provider not found', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: []
      })

      const result = await providerRepository.findByProviderId('NONEXISTENT')

      expect(result).toBeNull()
    })

    it('should return null if query fails', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        data: []
      })

      const result = await providerRepository.findByProviderId('PROV001')

      expect(result).toBeNull()
    })
  })

  describe('findByName', () => {
    it('should find providers by name pattern', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', NAME_CHAR: 'Dr. John Smith' },
        { PROVIDER_ID: 'PROV002', NAME_CHAR: 'Dr. Jane Smith' }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockProviders
      })

      const result = await providerRepository.findByName('Smith')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM PROVIDER_DIMENSION WHERE NAME_CHAR LIKE ? ORDER BY NAME_CHAR',
        ['%Smith%']
      )
      expect(result).toEqual(mockProviders)
    })

    it('should return empty array if no matches found', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: []
      })

      const result = await providerRepository.findByName('Nonexistent')

      expect(result).toEqual([])
    })
  })

  describe('findByPath', () => {
    it('should find providers by path pattern', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', PROVIDER_PATH: 'UKJ/NEURO/ATTENDING' },
        { PROVIDER_ID: 'PROV002', PROVIDER_PATH: 'UKJ/NEURO/RESIDENT' }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockProviders
      })

      const result = await providerRepository.findByPath('NEURO')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM PROVIDER_DIMENSION WHERE PROVIDER_PATH LIKE ? ORDER BY PROVIDER_PATH',
        ['%NEURO%']
      )
      expect(result).toEqual(mockProviders)
    })
  })

  describe('findByDepartment', () => {
    it('should find providers by department', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', PROVIDER_PATH: 'UKJ/NEURO/ATTENDING' }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockProviders
      })

      const result = await providerRepository.findByDepartment('NEURO')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM PROVIDER_DIMENSION WHERE PROVIDER_PATH LIKE ? ORDER BY NAME_CHAR',
        ['%NEURO%']
      )
      expect(result).toEqual(mockProviders)
    })
  })

  describe('findByOrganization', () => {
    it('should find providers by organization', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', PROVIDER_PATH: 'UKJ/NEURO/ATTENDING' },
        { PROVIDER_ID: 'PROV002', PROVIDER_PATH: 'UKJ/CARDIO/ATTENDING' }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockProviders
      })

      const result = await providerRepository.findByOrganization('UKJ')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM PROVIDER_DIMENSION WHERE PROVIDER_PATH LIKE ? ORDER BY PROVIDER_PATH, NAME_CHAR',
        ['UKJ%']
      )
      expect(result).toEqual(mockProviders)
    })
  })

  describe('getProvidersWithObservationCounts', () => {
    it('should get providers with their observation counts', async () => {
      const mockData = [
        { PROVIDER_ID: 'PROV001', NAME_CHAR: 'Dr. Smith', observationCount: 150 },
        { PROVIDER_ID: 'PROV002', NAME_CHAR: 'Dr. Jones', observationCount: 75 }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockData
      })

      const result = await providerRepository.getProvidersWithObservationCounts()

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN OBSERVATION_FACT')
      )
      expect(result).toEqual(mockData)
    })

    it('should return empty array if query fails', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        data: []
      })

      const result = await providerRepository.getProvidersWithObservationCounts()

      expect(result).toEqual([])
    })
  })

  describe('getProviderStatistics', () => {
    it('should return comprehensive provider statistics', async () => {
      // Mock all the parallel queries
      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 25 }] }) // totalProviders
        .mockResolvedValueOnce({ success: true, data: [{ org: 'UKJ', count: 20 }] }) // byOrganization
        .mockResolvedValueOnce({ success: true, data: [{ dept: 'NEURO', count: 10 }] }) // byDepartment
        .mockResolvedValueOnce({ success: true, data: [{ count: 15 }] }) // withObservations
        .mockResolvedValueOnce({ success: true, data: [{ month: '2024-01', count: 5 }] }) // byMonth

      const result = await providerRepository.getProviderStatistics()

      expect(result).toEqual({
        totalProviders: 25,
        byOrganization: [{ org: 'UKJ', count: 20 }],
        byDepartment: [{ dept: 'NEURO', count: 10 }],
        withObservations: 15,
        byMonth: [{ month: '2024-01', count: 5 }]
      })
    })

    it('should return default values if queries fail', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await providerRepository.getProviderStatistics()

      expect(result).toEqual({
        totalProviders: 0,
        byOrganization: [],
        byDepartment: [],
        withObservations: 0,
        byMonth: []
      })
    })
  })

  describe('getProvidersPaginated', () => {
    it('should return paginated providers with metadata', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', NAME_CHAR: 'Dr. Smith' },
        { PROVIDER_ID: 'PROV002', NAME_CHAR: 'Dr. Jones' }
      ]

      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 25 }] }) // count query
        .mockResolvedValueOnce({ success: true, data: mockProviders }) // data query

      const result = await providerRepository.getProvidersPaginated(1, 10)

      expect(result).toEqual({
        providers: mockProviders,
        pagination: {
          page: 1,
          pageSize: 10,
          totalCount: 25,
          totalPages: 3,
          hasNext: true,
          hasPrev: false
        }
      })
    })

    it('should apply search criteria', async () => {
      const criteria = {
        name: 'Smith',
        path: 'NEURO',
        organization: 'UKJ',
        department: 'CARDIO',
        hasObservations: true
      }

      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 5 }] })
        .mockResolvedValueOnce({ success: true, data: [] })

      await providerRepository.getProvidersPaginated(1, 10, criteria)

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('NAME_CHAR LIKE ?'),
        expect.arrayContaining(['%Smith%', '%NEURO%', 'UKJ%', '%CARDIO%'])
      )
    })

    it('should handle pagination errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await providerRepository.getProvidersPaginated(1, 10)

      expect(result).toEqual({
        providers: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      })
    })
  })

  describe('searchProviders', () => {
    it('should search providers by multiple fields', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', NAME_CHAR: 'Dr. Smith', PROVIDER_PATH: 'UKJ/NEURO' }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockProviders
      })

      const result = await providerRepository.searchProviders('Smith')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('PROVIDER_ID LIKE ?'),
        ['%Smith%', '%Smith%', '%Smith%']
      )
      expect(result).toEqual(mockProviders)
    })

    it('should return empty array for empty search term', async () => {
      const result = await providerRepository.searchProviders('')

      expect(result).toEqual([])
      expect(mockConnection.executeQuery).not.toHaveBeenCalled()
    })

    it('should return empty array for whitespace-only search term', async () => {
      const result = await providerRepository.searchProviders('   ')

      expect(result).toEqual([])
      expect(mockConnection.executeQuery).not.toHaveBeenCalled()
    })
  })

  describe('updateProvider', () => {
    it('should update existing provider', async () => {
      const existingProvider = { PROVIDER_ID: 'PROV001', NAME_CHAR: 'Dr. Smith' }
      const updateData = { NAME_CHAR: 'Dr. John Smith', PROVIDER_PATH: 'UKJ/NEURO' }

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [existingProvider]
      })
      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        changes: 1
      })

      const result = await providerRepository.updateProvider('PROV001', updateData)

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM PROVIDER_DIMENSION WHERE PROVIDER_ID = ?',
        ['PROV001']
      )
      expect(result).toBe(true)
    })

    it('should throw error if provider does not exist', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: []
      })

      await expect(providerRepository.updateProvider('NONEXISTENT', {}))
        .rejects.toThrow('Provider with PROVIDER_ID NONEXISTENT not found')
    })
  })

  describe('getProviderHierarchy', () => {
    it('should return organizational hierarchy', async () => {
      const mockData = [
        { organization: 'UKJ', department: 'NEURO', providerCount: 5 },
        { organization: 'UKJ', department: 'CARDIO', providerCount: 3 },
        { organization: 'CHARITÉ', department: 'NEURO', providerCount: 2 }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockData
      })

      const result = await providerRepository.getProviderHierarchy()

      expect(result).toEqual({
        'UKJ': {
          'NEURO': 5,
          'CARDIO': 3
        },
        'CHARITÉ': {
          'NEURO': 2
        }
      })
    })

    it('should return empty object if query fails', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        data: []
      })

      const result = await providerRepository.getProviderHierarchy()

      expect(result).toEqual({})
    })

    it('should handle errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await providerRepository.getProviderHierarchy()

      expect(result).toEqual({})
    })
  })

  describe('findByRole', () => {
    it('should find providers by role', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', NAME_CHAR: 'Dr. Smith', CONCEPT_BLOB: 'wissenschaftlicher Mitarbeiter' }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockProviders
      })

      const result = await providerRepository.findByRole('wissenschaftlicher Mitarbeiter')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM PROVIDER_DIMENSION WHERE CONCEPT_BLOB LIKE ? ORDER BY NAME_CHAR',
        ['%wissenschaftlicher Mitarbeiter%']
      )
      expect(result).toEqual(mockProviders)
    })
  })

  describe('getActiveProviders', () => {
    it('should get providers with recent activity', async () => {
      const mockProviders = [
        { PROVIDER_ID: 'PROV001', NAME_CHAR: 'Dr. Smith' }
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockProviders
      })

      const result = await providerRepository.getActiveProviders(30)

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("o.START_DATE >= date('now', '-30 days')")
      )
      expect(result).toEqual(mockProviders)
    })

    it('should use default threshold of 30 days', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: []
      })

      await providerRepository.getActiveProviders()

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("'-30 days'")
      )
    })
  })

  describe('getProviderPerformance', () => {
    it('should return provider performance metrics', async () => {
      const mockMetrics = {
        totalObservations: 150,
        uniquePatients: 25,
        uniqueVisits: 45,
        firstObservation: '2024-01-01',
        lastObservation: '2024-01-15',
        avgNumericValue: 120.5
      }

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [mockMetrics]
      })

      const result = await providerRepository.getProviderPerformance('PROV001')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(o.OBSERVATION_ID) as totalObservations'),
        ['PROV001']
      )
      expect(result).toEqual(mockMetrics)
    })

    it('should return default metrics if no data found', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: []
      })

      const result = await providerRepository.getProviderPerformance('PROV001')

      expect(result).toEqual({
        totalObservations: 0,
        uniquePatients: 0,
        uniqueVisits: 0,
        firstObservation: null,
        lastObservation: null,
        avgNumericValue: null
      })
    })

    it('should handle errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await providerRepository.getProviderPerformance('PROV001')

      expect(result).toEqual({
        totalObservations: 0,
        uniquePatients: 0,
        uniqueVisits: 0,
        firstObservation: null,
        lastObservation: null,
        avgNumericValue: null
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors in findByName', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        data: []
      })

      const result = await providerRepository.findByName('Smith')

      expect(result).toEqual([])
    })

    it('should handle database connection errors in searchProviders', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        data: []
      })

      const result = await providerRepository.searchProviders('Smith')

      expect(result).toEqual([])
    })
  })
})
