/**
 * Unit Tests for Patient Repository
 * Tests patient-specific database operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import PatientRepository from '../../src/core/database/repositories/patient-repository.js'

// Mock SQLite Connection for Patient Repository
class MockPatientConnection {
  constructor() {
    this.queries = []
    this.commands = []
    this.mockPatients = [
      {
        PATIENT_NUM: 1,
        PATIENT_CD: 'P001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
        VITAL_STATUS_CD: 'A',
        LANGUAGE_CD: 'EN',
        RACE_CD: 'UNK',
        CREATED_AT: '2024-01-01T00:00:00Z',
      },
      {
        PATIENT_NUM: 2,
        PATIENT_CD: 'P002',
        SEX_CD: 'F',
        AGE_IN_YEARS: 25,
        VITAL_STATUS_CD: 'A',
        LANGUAGE_CD: 'EN',
        RACE_CD: 'UNK',
        CREATED_AT: '2024-01-02T00:00:00Z',
      },
    ]
  }

  async executeQuery(sql, params = []) {
    this.queries.push({ sql, params })

    // Mock patient-specific queries
    if (sql.includes('WHERE PATIENT_CD = ?')) {
      const patientCode = params[0]
      const patient = this.mockPatients.find((p) => p.PATIENT_CD === patientCode)
      return {
        success: true,
        data: patient ? [patient] : [],
        rowCount: patient ? 1 : 0,
      }
    }

    if (sql.includes('WHERE VITAL_STATUS_CD = ?')) {
      const status = params[0]
      const patients = this.mockPatients.filter((p) => p.VITAL_STATUS_CD === status)
      return {
        success: true,
        data: patients,
        rowCount: patients.length,
      }
    }

    if (sql.includes('WHERE SEX_CD = ?') || sql.includes('AND SEX_CD = ?')) {
      const sexIndex = params.findIndex((p, i) => sql.split('?')[i]?.includes('SEX_CD'))
      const sex = params[sexIndex >= 0 ? sexIndex : 0]
      const patients = this.mockPatients.filter((p) => p.SEX_CD === sex)
      return {
        success: true,
        data: patients,
        rowCount: patients.length,
      }
    }

    if (sql.includes('AGE_IN_YEARS BETWEEN')) {
      // Find the age parameters in the params array
      const betweenIndex = sql.indexOf('AGE_IN_YEARS BETWEEN')
      const questionMarks = sql.substring(0, betweenIndex).split('?').length - 1
      const minAge = params[questionMarks]
      const maxAge = params[questionMarks + 1]

      const patients = this.mockPatients.filter((p) => p.AGE_IN_YEARS >= minAge && p.AGE_IN_YEARS <= maxAge)
      return {
        success: true,
        data: patients,
        rowCount: patients.length,
      }
    }

    if (sql.includes('LIKE')) {
      const searchTerm = params[0].replace(/%/g, '')
      const patients = this.mockPatients.filter((p) => p.PATIENT_CD.includes(searchTerm) || (p.PATIENT_BLOB && p.PATIENT_BLOB.includes(searchTerm)))
      return {
        success: true,
        data: patients,
        rowCount: patients.length,
      }
    }

    if (sql.includes('AVG(AGE_IN_YEARS)')) {
      const totalAge = this.mockPatients.reduce((sum, p) => sum + p.AGE_IN_YEARS, 0)
      const avgAge = this.mockPatients.length > 0 ? totalAge / this.mockPatients.length : null
      return {
        success: true,
        data: [{ averageAge: avgAge }],
        rowCount: 1,
      }
    }

    if (sql.includes('COUNT(*)')) {
      if (sql.includes('GROUP BY VITAL_STATUS_CD')) {
        return {
          success: true,
          data: [
            { VITAL_STATUS_CD: 'A', count: 2 },
            { VITAL_STATUS_CD: 'I', count: 0 },
          ],
          rowCount: 2,
        }
      }

      if (sql.includes('GROUP BY SEX_CD')) {
        return {
          success: true,
          data: [
            { SEX_CD: 'M', count: 1 },
            { SEX_CD: 'F', count: 1 },
          ],
          rowCount: 2,
        }
      }

      // Handle count queries (including pagination count)
      if (sql.includes('as total')) {
        return {
          success: true,
          data: [{ total: this.mockPatients.length }],
          rowCount: 1,
        }
      }

      return {
        success: true,
        data: [{ count: this.mockPatients.length }],
        rowCount: 1,
      }
    }

    // Default: return all patients
    return {
      success: true,
      data: this.mockPatients,
      rowCount: this.mockPatients.length,
    }
  }

  async executeCommand(sql, params = []) {
    this.commands.push({ sql, params })

    if (sql.includes('INSERT INTO PATIENT_DIMENSION')) {
      const newId = Math.max(...this.mockPatients.map((p) => p.PATIENT_NUM)) + 1
      return {
        success: true,
        lastId: newId,
        changes: 1,
        message: 'Patient created successfully',
      }
    }

    return {
      success: true,
      lastId: Math.floor(Math.random() * 1000) + 1,
      changes: 1,
      message: 'Command executed successfully',
    }
  }

  getLastQuery() {
    return this.queries[this.queries.length - 1]
  }

  getLastCommand() {
    return this.commands[this.commands.length - 1]
  }

  reset() {
    this.queries = []
    this.commands = []
  }
}

describe('PatientRepository', () => {
  let repository
  let mockConnection

  beforeEach(() => {
    mockConnection = new MockPatientConnection()
    repository = new PatientRepository(mockConnection)
  })

  afterEach(() => {
    mockConnection.reset()
  })

  describe('Constructor', () => {
    it('should initialize with PATIENT_DIMENSION table', () => {
      expect(repository.tableName).toBe('PATIENT_DIMENSION')
      expect(repository.connection).toBe(mockConnection)
    })
  })

  describe('findByPatientCode', () => {
    it('should find patient by patient code', async () => {
      const result = await repository.findByPatientCode('P001')

      expect(result).toMatchObject({
        PATIENT_NUM: 1,
        PATIENT_CD: 'P001',
        SEX_CD: 'M',
        AGE_IN_YEARS: 30,
      })

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toBe('SELECT * FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?')
      expect(lastQuery.params).toEqual(['P001'])
    })

    it('should return null when patient not found', async () => {
      const result = await repository.findByPatientCode('NONEXISTENT')

      expect(result).toBe(null)
    })
  })

  describe('findByVitalStatus', () => {
    it('should find patients by vital status', async () => {
      const result = await repository.findByVitalStatus('A')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ VITAL_STATUS_CD: 'A' })
      expect(result[1]).toMatchObject({ VITAL_STATUS_CD: 'A' })
    })
  })

  describe('findBySex', () => {
    it('should find patients by sex', async () => {
      const result = await repository.findBySex('M')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ SEX_CD: 'M' })
    })

    it('should find female patients', async () => {
      const result = await repository.findBySex('F')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ SEX_CD: 'F' })
    })
  })

  describe('findByAgeRange', () => {
    it('should find patients within age range', async () => {
      const result = await repository.findByAgeRange(20, 35)

      expect(result).toHaveLength(2)

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toContain('AGE_IN_YEARS BETWEEN ? AND ?')
      expect(lastQuery.params).toEqual([20, 35])
    })

    it('should find patients with narrow age range', async () => {
      const result = await repository.findByAgeRange(25, 25)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ AGE_IN_YEARS: 25 })
    })
  })

  describe('findByBirthDateRange', () => {
    it('should find patients by birth date range', async () => {
      const result = await repository.findByBirthDateRange('1990-01-01', '2000-12-31')

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toContain('BIRTH_DATE BETWEEN ? AND ?')
      expect(lastQuery.params).toEqual(['1990-01-01', '2000-12-31'])
    })
  })

  describe('findPatientsByCriteria', () => {
    it('should build complex criteria queries', async () => {
      const criteria = {
        vitalStatus: 'A',
        sex: 'M',
        ageRange: { min: 25, max: 35 },
        language: 'EN',
        options: { orderBy: 'PATIENT_CD', limit: 10 },
      }

      await repository.findPatientsByCriteria(criteria)

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toContain('VITAL_STATUS_CD = ?')
      expect(lastQuery.sql).toContain('SEX_CD = ?')
      expect(lastQuery.sql).toContain('AGE_IN_YEARS BETWEEN ? AND ?')
      expect(lastQuery.sql).toContain('LANGUAGE_CD = ?')
      expect(lastQuery.sql).toContain('ORDER BY PATIENT_CD')
      expect(lastQuery.sql).toContain('LIMIT ?')
    })

    it('should handle birth date range criteria', async () => {
      const criteria = {
        birthDateRange: { start: '1990-01-01', end: '2000-12-31' },
      }

      await repository.findPatientsByCriteria(criteria)

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toContain('BIRTH_DATE BETWEEN ? AND ?')
      expect(lastQuery.params).toEqual(['1990-01-01', '2000-12-31'])
    })

    it('should handle all demographic criteria', async () => {
      const criteria = {
        vitalStatus: 'A',
        sex: 'F',
        language: 'EN',
        race: 'CAUC',
        maritalStatus: 'M',
        religion: 'CHR',
        location: 'NYC',
        sourceSystem: 'EMR',
        uploadId: 123,
      }

      await repository.findPatientsByCriteria(criteria)

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toContain('VITAL_STATUS_CD = ?')
      expect(lastQuery.sql).toContain('SEX_CD = ?')
      expect(lastQuery.sql).toContain('LANGUAGE_CD = ?')
      expect(lastQuery.sql).toContain('RACE_CD = ?')
      expect(lastQuery.sql).toContain('MARITAL_STATUS_CD = ?')
      expect(lastQuery.sql).toContain('RELIGION_CD = ?')
      expect(lastQuery.sql).toContain('STATECITYZIP_PATH = ?')
      expect(lastQuery.sql).toContain('SOURCESYSTEM_CD = ?')
      expect(lastQuery.sql).toContain('UPLOAD_ID = ?')
    })
  })

  describe('createPatient', () => {
    it('should create patient with required fields', async () => {
      const patientData = {
        PATIENT_CD: 'P003',
        SEX_CD: 'M',
        AGE_IN_YEARS: 35,
        VITAL_STATUS_CD: 'A',
      }

      const result = await repository.createPatient(patientData)

      expect(result).toMatchObject(patientData)
      expect(result).toHaveProperty('PATIENT_NUM')
      expect(result).toHaveProperty('IMPORT_DATE')
      expect(result).toHaveProperty('UPDATE_DATE')
      expect(result).toHaveProperty('CREATED_AT')
      expect(result).toHaveProperty('UPDATED_AT')

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toContain('INSERT INTO PATIENT_DIMENSION')
      expect(lastCommand.params).toContain('P003')
    })

    it('should throw error when PATIENT_CD is missing', async () => {
      const patientData = {
        SEX_CD: 'M',
        AGE_IN_YEARS: 35,
      }

      await expect(repository.createPatient(patientData)).rejects.toThrow('PATIENT_CD is required')
    })

    it('should check for existing patient code', async () => {
      const patientData = {
        PATIENT_CD: 'P001', // Already exists in mock data
        SEX_CD: 'M',
        AGE_IN_YEARS: 35,
      }

      await expect(repository.createPatient(patientData)).rejects.toThrow('Patient with code P001 already exists')
    })

    it('should add audit fields automatically', async () => {
      const patientData = {
        PATIENT_CD: 'P003',
        SEX_CD: 'M',
        AGE_IN_YEARS: 35,
      }

      const result = await repository.createPatient(patientData)

      expect(result).toHaveProperty('IMPORT_DATE')
      expect(result).toHaveProperty('UPDATE_DATE')
      expect(result).toHaveProperty('CREATED_AT')
      expect(result).toHaveProperty('UPDATED_AT')

      // Should be ISO date strings
      expect(new Date(result.IMPORT_DATE)).toBeInstanceOf(Date)
      expect(new Date(result.UPDATE_DATE)).toBeInstanceOf(Date)
    })
  })

  describe('updatePatient', () => {
    it('should update patient with audit fields', async () => {
      const updateData = {
        SEX_CD: 'F',
        AGE_IN_YEARS: 31,
      }

      const result = await repository.updatePatient(1, updateData)

      expect(result).toBe(true)

      const lastCommand = mockConnection.getLastCommand()
      expect(lastCommand.sql).toContain('UPDATE PATIENT_DIMENSION')
      expect(lastCommand.sql).toContain('UPDATE_DATE = ?')
      expect(lastCommand.sql).toContain('UPDATED_AT = ?')
      expect(lastCommand.params).toContain('F')
      expect(lastCommand.params).toContain(31)
    })
  })

  describe('getPatientStatistics', () => {
    it('should return comprehensive patient statistics', async () => {
      const stats = await repository.getPatientStatistics()

      expect(stats).toHaveProperty('totalPatients', 2)
      expect(stats).toHaveProperty('byVitalStatus')
      expect(stats).toHaveProperty('bySex')

      // Calculate expected average: (30 + 25) / 2 = 27.5, rounded = 28
      const expectedAverage = Math.round((30 + 25) / 2)
      expect(stats).toHaveProperty('averageAge', expectedAverage)

      expect(stats.byVitalStatus).toHaveLength(2)
      expect(stats.bySex).toHaveLength(2)
    })

    it('should handle null average age gracefully', async () => {
      // Mock no age data
      mockConnection.executeQuery = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: [{ total: 0 }] })
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [] })
        .mockResolvedValueOnce({ success: true, data: [{ averageAge: null }] })

      const stats = await repository.getPatientStatistics()

      expect(stats.averageAge).toBe(null)
    })
  })

  describe('searchPatients', () => {
    it('should search patients by text', async () => {
      const result = await repository.searchPatients('P00')

      expect(result).toHaveLength(2) // Both P001 and P002 match

      const lastQuery = mockConnection.getLastQuery()
      expect(lastQuery.sql).toContain('PATIENT_CD LIKE ?')
      expect(lastQuery.sql).toContain('PATIENT_BLOB LIKE ?')
      expect(lastQuery.sql).toContain('STATECITYZIP_PATH LIKE ?')
      expect(lastQuery.sql).toContain('ORDER BY PATIENT_CD')
      expect(lastQuery.params).toEqual(['%P00%', '%P00%', '%P00%'])
    })

    it('should return empty array for no matches', async () => {
      const result = await repository.searchPatients('NOMATCH')

      expect(result).toHaveLength(0)
    })
  })

  describe('getPatientsPaginated', () => {
    it('should return paginated results with metadata', async () => {
      const result = await repository.getPatientsPaginated(1, 10)

      expect(result).toHaveProperty('patients')
      expect(result).toHaveProperty('pagination')

      expect(result.pagination).toMatchObject({
        currentPage: 1,
        pageSize: 10,
        totalCount: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })

      expect(Array.isArray(result.patients)).toBe(true)
    })

    it('should handle pagination with criteria', async () => {
      const criteria = { sex: 'M' }
      const result = await repository.getPatientsPaginated(1, 5, criteria)

      expect(result.pagination.currentPage).toBe(1)
      expect(result.pagination.pageSize).toBe(5)
    })

    it('should calculate pagination correctly for multiple pages', async () => {
      // Mock larger dataset
      mockConnection.executeQuery = vi
        .fn()
        .mockResolvedValueOnce({ success: true, data: mockConnection.mockPatients.slice(0, 1) }) // First page
        .mockResolvedValueOnce({ success: true, data: [{ count: 25 }] }) // Total count

      const result = await repository.getPatientsPaginated(2, 10)

      expect(result.pagination).toMatchObject({
        currentPage: 2,
        pageSize: 10,
        totalCount: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockConnection.executeQuery = vi.fn().mockRejectedValue(new Error('Connection failed'))

      await expect(repository.findByPatientCode('P001')).rejects.toThrow('Connection failed')
    })

    it('should handle invalid patient data gracefully', async () => {
      const invalidData = {
        PATIENT_CD: null,
        SEX_CD: 'M',
      }

      await expect(repository.createPatient(invalidData)).rejects.toThrow('PATIENT_CD is required')
    })
  })
})
