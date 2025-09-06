/**
 * Unit Tests for Search Service
 *
 * Tests:
 * - Patient search with various criteria
 * - Visit search with location and date filters
 * - Observation search with value types and ranges
 * - Note search with text and category filters
 * - Provider search with specialty and organization
 * - Complex query building and execution
 * - Date range filtering
 * - Pagination and sorting
 * - Error handling and edge cases
 * - Search statistics and analytics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SearchService } from '../../src/core/services/search-service.js'

// Mock repositories
const mockPatientRepository = {
  searchPatients: vi.fn().mockResolvedValue([]),
  findPatientsByCriteria: vi.fn().mockResolvedValue([]),
  findAll: vi.fn().mockResolvedValue([]),
}

const mockVisitRepository = {
  findByPatientNum: vi.fn().mockResolvedValue([]),
  findByLocationCode: vi.fn().mockResolvedValue([]),
  findByDateRange: vi.fn().mockResolvedValue([]),
  findActiveVisits: vi.fn().mockResolvedValue([]),
  findAll: vi.fn().mockResolvedValue([]),
}

const mockObservationRepository = {
  findByPatientNum: vi.fn().mockResolvedValue([]),
  findByVisitNum: vi.fn().mockResolvedValue([]),
  findByConceptCode: vi.fn().mockResolvedValue([]),
  findByValueType: vi.fn().mockResolvedValue([]),
  findByDateRange: vi.fn().mockResolvedValue([]),
  findAll: vi.fn().mockResolvedValue([]),
}

const mockNoteRepository = {
  searchNotes: vi.fn().mockResolvedValue([]),
  findByCategory: vi.fn().mockResolvedValue([]),
  findByPatientNum: vi.fn().mockResolvedValue([]),
  findAll: vi.fn().mockResolvedValue([]),
}

const mockProviderRepository = {
  searchProviders: vi.fn().mockResolvedValue([]),
  findBySpecialty: vi.fn().mockResolvedValue([]),
  findAll: vi.fn().mockResolvedValue([]),
}

const mockConceptRepository = {
  findByCode: vi.fn().mockResolvedValue([]),
  searchConcepts: vi.fn().mockResolvedValue([]),
}

describe('Search Service', () => {
  let searchService

  beforeEach(() => {
    searchService = new SearchService(mockPatientRepository, mockVisitRepository, mockObservationRepository, mockNoteRepository, mockProviderRepository, mockConceptRepository)
    vi.clearAllMocks()
  })

  describe('Service Initialization', () => {
    it('should initialize with all required repositories', () => {
      expect(searchService.patientRepository).toBe(mockPatientRepository)
      expect(searchService.visitRepository).toBe(mockVisitRepository)
      expect(searchService.observationRepository).toBe(mockObservationRepository)
      expect(searchService.noteRepository).toBe(mockNoteRepository)
      expect(searchService.providerRepository).toBe(mockProviderRepository)
      expect(searchService.conceptRepository).toBe(mockConceptRepository)
    })
  })

  describe('Patient Search', () => {
    const mockPatients = [
      { PATIENT_NUM: 1, PATIENT_CD: 'P001', SEX_CD: 'M', AGE_IN_YEARS: 25, VITAL_STATUS_CD: 'A' },
      { PATIENT_NUM: 2, PATIENT_CD: 'P002', SEX_CD: 'F', AGE_IN_YEARS: 35, VITAL_STATUS_CD: 'A' },
      { PATIENT_NUM: 3, PATIENT_NUM: 'P003', SEX_CD: 'M', AGE_IN_YEARS: 45, VITAL_STATUS_CD: 'D' },
    ]

    it('should search patients by text term', async () => {
      mockPatientRepository.searchPatients.mockResolvedValue(mockPatients)

      const result = await searchService.searchPatients({ searchTerm: 'P001' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockPatients)
      expect(result.totalCount).toBe(3)
      expect(mockPatientRepository.searchPatients).toHaveBeenCalledWith('P001')
    })

    it('should search patients by criteria', async () => {
      mockPatientRepository.findPatientsByCriteria.mockResolvedValue(mockPatients)

      const criteria = { sex: 'M', ageRange: { min: 20, max: 50 } }
      const result = await searchService.searchPatients(criteria)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockPatients)
      expect(mockPatientRepository.findPatientsByCriteria).toHaveBeenCalledWith(criteria)
    })

    it('should apply sorting to patient results', async () => {
      mockPatientRepository.findAll.mockResolvedValue(mockPatients)

      const result = await searchService.searchPatients({
        sortBy: [{ field: 'AGE_IN_YEARS', direction: 'DESC' }],
      })

      expect(result.success).toBe(true)
      expect(result.data[0].AGE_IN_YEARS).toBe(45) // Should be sorted descending
      expect(result.data[2].AGE_IN_YEARS).toBe(25)
    })

    it('should apply pagination to patient results', async () => {
      mockPatientRepository.findAll.mockResolvedValue(mockPatients)

      const result = await searchService.searchPatients({
        pagination: { page: 1, pageSize: 2 },
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.pageSize).toBe(2)
      expect(result.pagination.totalPages).toBe(2)
      expect(result.pagination.hasNext).toBe(true)
      expect(result.pagination.hasPrevious).toBe(false)
    })

    it('should handle patient search errors gracefully', async () => {
      mockPatientRepository.searchPatients.mockRejectedValue(new Error('Database error'))

      const result = await searchService.searchPatients({ searchTerm: 'P001' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
      expect(result.data).toEqual([])
    })
  })

  describe('Visit Search', () => {
    const mockVisits = [
      { ENCOUNTER_NUM: 1, PATIENT_NUM: 1, START_DATE: '2024-01-15', LOCATION_CD: 'EMERGENCY', INOUT_CD: 'I' },
      { ENCOUNTER_NUM: 2, PATIENT_NUM: 2, START_DATE: '2024-01-16', LOCATION_CD: 'CLINIC', INOUT_CD: 'O' },
    ]

    it('should search visits by patient number', async () => {
      mockVisitRepository.findByPatientNum.mockResolvedValue(mockVisits)

      const result = await searchService.searchVisits({ patientNum: 1 })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockVisits)
      expect(mockVisitRepository.findByPatientNum).toHaveBeenCalledWith(1)
    })

    it('should search visits by location code', async () => {
      mockVisitRepository.findByLocationCode.mockResolvedValue(mockVisits)

      const result = await searchService.searchVisits({ locationCode: 'EMERGENCY' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockVisits)
      expect(mockVisitRepository.findByLocationCode).toHaveBeenCalledWith('EMERGENCY')
    })

    it('should search visits by date range', async () => {
      mockVisitRepository.findByDateRange.mockResolvedValue(mockVisits)

      const dateRange = { start: '2024-01-01', end: '2024-01-31' }
      const result = await searchService.searchVisits({ dateRange })

      expect(result.success).toBe(true)
      expect(mockVisitRepository.findByDateRange).toHaveBeenCalledWith('2024-01-01', '2024-01-31')
    })

    it('should search active visits', async () => {
      mockVisitRepository.findActiveVisits.mockResolvedValue(mockVisits)

      const result = await searchService.searchVisits({ activeStatus: 'active' })

      expect(result.success).toBe(true)
      expect(mockVisitRepository.findActiveVisits).toHaveBeenCalled()
    })

    it('should filter visits by inout code', async () => {
      mockVisitRepository.findAll.mockResolvedValue(mockVisits)

      const result = await searchService.searchVisits({ inoutCode: 'I' })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1) // Only inpatient visits
      expect(result.data[0].INOUT_CD).toBe('I')
    })
  })

  describe('Observation Search', () => {
    const mockObservations = [
      { OBSERVATION_ID: 1, PATIENT_NUM: 1, ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:8302-2', VALTYPE_CD: 'N', NVAL_NUM: 180 },
      { OBSERVATION_ID: 2, PATIENT_NUM: 1, ENCOUNTER_NUM: 1, CONCEPT_CD: 'LOINC:29463-7', VALTYPE_CD: 'N', NVAL_NUM: 75.5 },
    ]

    it('should search observations by patient number', async () => {
      mockObservationRepository.findByPatientNum.mockResolvedValue(mockObservations)

      const result = await searchService.searchObservations({ patientNum: 1 })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockObservations)
      expect(mockObservationRepository.findByPatientNum).toHaveBeenCalledWith(1)
    })

    it('should search observations by concept code', async () => {
      mockObservationRepository.findByConceptCode.mockResolvedValue(mockObservations)

      const result = await searchService.searchObservations({ conceptCode: 'LOINC:8302-2' })

      expect(result.success).toBe(true)
      expect(mockObservationRepository.findByConceptCode).toHaveBeenCalledWith('LOINC:8302-2')
    })

    it('should search observations by value type', async () => {
      mockObservationRepository.findByValueType.mockResolvedValue(mockObservations)

      const result = await searchService.searchObservations({ valueType: 'N' })

      expect(result.success).toBe(true)
      expect(mockObservationRepository.findByValueType).toHaveBeenCalledWith('N')
    })

    it('should filter observations by numeric value range', async () => {
      mockObservationRepository.findByPatientNum.mockResolvedValue(mockObservations)

      const result = await searchService.searchObservations({
        patientNum: 1,
        valueType: 'N',
        valueRange: { min: 70, max: 80 },
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1) // Only observation with NVAL_NUM 75.5
      expect(result.data[0].NVAL_NUM).toBe(75.5)
    })
  })

  describe('Note Search', () => {
    const mockNotes = [
      { NOTE_ID: 1, PATIENT_NUM: 1, CATEGORY: 'ASSESSMENT', CONTENT: 'Patient assessment note', CREATED_AT: '2024-01-15' },
      { NOTE_ID: 2, PATIENT_NUM: 1, CATEGORY: 'PLAN', CONTENT: 'Treatment plan', CREATED_AT: '2024-01-16' },
    ]

    it('should search notes by text term', async () => {
      mockNoteRepository.searchNotes.mockResolvedValue(mockNotes)

      const result = await searchService.searchNotes({ searchTerm: 'assessment' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockNotes)
      expect(mockNoteRepository.searchNotes).toHaveBeenCalledWith('assessment')
    })

    it('should search notes by category', async () => {
      mockNoteRepository.findByCategory.mockResolvedValue(mockNotes)

      const result = await searchService.searchNotes({ category: 'ASSESSMENT' })

      expect(result.success).toBe(true)
      expect(mockNoteRepository.findByCategory).toHaveBeenCalledWith('ASSESSMENT')
    })

    it('should filter notes by date range', async () => {
      mockNoteRepository.findAll.mockResolvedValue(mockNotes)

      const dateRange = { start: '2024-01-15', end: '2024-01-15' }
      const result = await searchService.searchNotes({ dateRange })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1) // Only note from 2024-01-15
      expect(result.data[0].CREATED_AT).toBe('2024-01-15')
    })
  })

  describe('Provider Search', () => {
    const mockProviders = [
      { PROVIDER_ID: 1, NAME_CHAR: 'Dr. Smith', SPECIALTY_CD: 'CARDIOLOGY', ORGANIZATION_CD: 'HOSPITAL_A' },
      { PROVIDER_ID: 2, NAME_CHAR: 'Dr. Johnson', SPECIALTY_CD: 'NEUROLOGY', ORGANIZATION_CD: 'HOSPITAL_B' },
    ]

    it('should search providers by text term', async () => {
      mockProviderRepository.searchProviders.mockResolvedValue(mockProviders)

      const result = await searchService.searchProviders({ searchTerm: 'Smith' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockProviders)
      expect(mockProviderRepository.searchProviders).toHaveBeenCalledWith('Smith')
    })

    it('should search providers by specialty', async () => {
      mockProviderRepository.findBySpecialty.mockResolvedValue(mockProviders)

      const result = await searchService.searchProviders({ specialty: 'CARDIOLOGY' })

      expect(result.success).toBe(true)
      expect(mockProviderRepository.findBySpecialty).toHaveBeenCalledWith('CARDIOLOGY')
    })

    it('should filter providers by organization', async () => {
      mockProviderRepository.findAll.mockResolvedValue(mockProviders)

      const result = await searchService.searchProviders({ organization: 'HOSPITAL_A' })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1) // Only provider from HOSPITAL_A
      expect(result.data[0].ORGANIZATION_CD).toBe('HOSPITAL_A')
    })
  })

  describe('Complex Query Building', () => {
    it('should build complex queries from search parameters', () => {
      const searchParams = {
        patientCriteria: { sex: 'M', ageRange: { min: 20, max: 50 } },
        visitCriteria: { locationCode: 'EMERGENCY' },
        observationCriteria: { valueType: 'N' },
        crossReference: [{ from: 'patients', to: 'visits', relationship: 'has_visits' }],
      }

      const query = searchService.buildComplexQueries(searchParams)

      expect(query.patients).toEqual({ sex: 'M', ageRange: { min: 20, max: 50 } })
      expect(query.visits).toEqual({ locationCode: 'EMERGENCY' })
      expect(query.observations).toEqual({ valueType: 'N' })
      expect(query.crossReferences).toHaveLength(1)
      expect(query.crossReferences[0].fromEntity).toBe('patients')
    })

    it('should apply date range filters to queries', () => {
      const baseQuery = {
        visits: { locationCode: 'EMERGENCY' },
        observations: { valueType: 'N' },
      }

      const dateRange = { start: '2024-01-01', end: '2024-01-31' }
      const modifiedQuery = searchService.applyDateRangeFilters(baseQuery, dateRange)

      expect(modifiedQuery.visits.dateRange).toEqual(dateRange)
      expect(modifiedQuery.observations.dateRange).toEqual(dateRange)
    })
  })

  describe('Complex Search Execution', () => {
    it('should execute complex search across multiple repositories', async () => {
      // Mock repository responses
      mockPatientRepository.findPatientsByCriteria.mockResolvedValue([{ PATIENT_NUM: 1 }])
      mockVisitRepository.findByLocationCode.mockResolvedValue([{ ENCOUNTER_NUM: 1 }])
      mockObservationRepository.findByValueType.mockResolvedValue([{ OBSERVATION_ID: 1 }])

      const complexQuery = {
        patients: { sex: 'M' },
        visits: { locationCode: 'EMERGENCY' },
        observations: { valueType: 'N' },
      }

      const result = await searchService.executeComplexSearch(complexQuery)

      expect(result.success).toBe(true)
      expect(result.results.patients).toHaveLength(1)
      expect(result.results.visits).toHaveLength(1)
      expect(result.results.observations).toHaveLength(1)
      expect(result.results.summary.totalPatients).toBe(1)
      expect(result.results.summary.totalVisits).toBe(1)
      expect(result.results.summary.totalObservations).toBe(1)
    })

    it('should handle errors in complex search gracefully', async () => {
      mockPatientRepository.findPatientsByCriteria.mockRejectedValue(new Error('Patient search failed'))

      const complexQuery = { patients: { sex: 'M' } }
      const result = await searchService.executeComplexSearch(complexQuery)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Patient search failed')
    })
  })

  describe('Search Statistics', () => {
    it('should generate search statistics', async () => {
      mockPatientRepository.findPatientsByCriteria.mockResolvedValue([{ PATIENT_NUM: 1 }, { PATIENT_NUM: 2 }])
      mockVisitRepository.findByLocationCode.mockResolvedValue([{ ENCOUNTER_NUM: 1 }])

      const searchCriteria = {
        patients: { sex: 'M' },
        visits: { locationCode: 'EMERGENCY' },
      }

      const result = await searchService.getSearchStatistics(searchCriteria)

      expect(result.success).toBe(true)
      expect(result.statistics.totalResults).toBe(3) // 2 patients + 1 visit
      expect(result.statistics.resultBreakdown.patients).toBe(2)
      expect(result.statistics.resultBreakdown.visits).toBe(1)
    })
  })

  describe('Pagination and Sorting', () => {
    it('should handle empty results with pagination', async () => {
      // Ensure both relevant mocks return empty arrays
      mockPatientRepository.findAll.mockResolvedValue([])
      mockPatientRepository.findPatientsByCriteria.mockResolvedValue([])

      const result = await searchService.searchPatients({
        pagination: { page: 1, pageSize: 10 },
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
      expect(result.pagination.totalPages).toBe(0)
      expect(result.pagination.hasNext).toBe(false)
      expect(result.pagination.hasPrevious).toBe(false)
    })

    it('should handle edge case pagination', async () => {
      const manyPatients = Array.from({ length: 25 }, (_, i) => ({ PATIENT_NUM: i + 1 }))
      // Ensure both relevant mocks return the correct data
      mockPatientRepository.findAll.mockResolvedValue(manyPatients)
      mockPatientRepository.findPatientsByCriteria.mockResolvedValue(manyPatients)

      const result = await searchService.searchPatients({
        pagination: { page: 3, pageSize: 10 },
      })

      expect(result.success).toBe(true)
      expect(result.pagination.page).toBe(3)
      expect(result.pagination.totalPages).toBe(3)
      expect(result.pagination.hasNext).toBe(false)
      expect(result.pagination.hasPrevious).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle repository method not found gracefully', async () => {
      // Simulate a repository method that doesn't exist
      mockPatientRepository.searchPatients = undefined

      const result = await searchService.searchPatients({ searchTerm: 'test' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Patient search method not available')
    })

    it('should handle invalid pagination parameters', async () => {
      mockPatientRepository.findAll.mockResolvedValue([{ PATIENT_NUM: 1 }])

      const result = await searchService.searchPatients({
        pagination: { page: -1, pageSize: 0 },
      })

      expect(result.success).toBe(true)
      expect(result.pagination.page).toBe(1) // Should default to valid values
      expect(result.pagination.pageSize).toBe(20)
    })
  })
})
