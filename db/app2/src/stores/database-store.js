/**
 * Database Store
 * Manages database state and provides access to database operations
 * Uses Pinia for state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import databaseService from '../core/services/database-service.js'
import { useLoggingStore } from './logging-store.js'

export const useDatabaseStore = defineStore('database', () => {
  // State
  const isConnected = ref(false)
  const isInitialized = ref(false)
  const databasePath = ref(null)
  const connectionError = ref(null)
  const isLoading = ref(false)
  const statistics = ref({})
  const migrationStatus = ref({})

  // Getters
  const connectionStatus = computed(() => ({
    isConnected: isConnected.value,
    isInitialized: isInitialized.value,
    databasePath: databasePath.value,
    hasError: !!connectionError.value,
  }))

  const canPerformOperations = computed(() => isConnected.value && isInitialized.value && !connectionError.value)

  // Actions
  const initializeDatabase = async (path) => {
    const loggingStore = useLoggingStore()
    const timer = loggingStore.startTimer('Database Initialization')

    try {
      isLoading.value = true
      connectionError.value = null

      loggingStore.info('DatabaseStore', `Initializing database at: ${path}`, { path })

      const success = await databaseService.initialize(path)

      if (success) {
        isConnected.value = true
        isInitialized.value = true
        databasePath.value = path

        loggingStore.debug('DatabaseStore', 'Loading initial database data')

        // Load initial data
        await loadMigrationStatus()
        await loadStatistics()

        const duration = timer.end()
        loggingStore.success('DatabaseStore', 'Database initialized successfully', {
          path,
          duration: `${duration.toFixed(2)}ms`,
        })
      } else {
        throw new Error('Database initialization failed')
      }
    } catch (error) {
      timer.end()
      loggingStore.error('DatabaseStore', 'Database initialization failed', error, { path })
      connectionError.value = error.message
      isConnected.value = false
      isInitialized.value = false
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const closeDatabase = async () => {
    try {
      isLoading.value = true

      await databaseService.close()

      isConnected.value = false
      isInitialized.value = false
      databasePath.value = null
      connectionError.value = null
      statistics.value = {}
      migrationStatus.value = {}

      console.log('Database connection closed')
    } catch (error) {
      console.error('Error closing database:', error)
      connectionError.value = error.message
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const loadMigrationStatus = async () => {
    try {
      migrationStatus.value = await databaseService.getMigrationStatus()
    } catch (error) {
      console.error('Error loading migration status:', error)
      migrationStatus.value = { error: error.message }
    }
  }

  const loadStatistics = async () => {
    try {
      statistics.value = await databaseService.getDatabaseStatistics()
    } catch (error) {
      console.error('Error loading database statistics:', error)
      statistics.value = { error: error.message }
    }
  }

  const refreshDatabaseInfo = async () => {
    if (canPerformOperations.value) {
      await Promise.all([loadMigrationStatus(), loadStatistics()])
    }
  }

  const resetDatabase = async () => {
    try {
      isLoading.value = true

      if (!canPerformOperations.value) {
        throw new Error('Database not ready for operations')
      }

      await databaseService.resetDatabase()

      // Reload information after reset
      await refreshDatabaseInfo()

      console.log('Database reset completed')
    } catch (error) {
      console.error('Database reset error:', error)
      connectionError.value = error.message
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const validateDatabase = async () => {
    try {
      if (!canPerformOperations.value) {
        throw new Error('Database not ready for operations')
      }

      const validation = await databaseService.validateDatabase()
      return validation
    } catch (error) {
      console.error('Database validation error:', error)
      throw error
    }
  }

  // Database operation helpers
  const getPatientRepository = () => {
    if (!canPerformOperations.value) {
      throw new Error('Database not ready for operations')
    }
    return databaseService.getRepository('patient')
  }

  const getUserRepository = () => {
    if (!canPerformOperations.value) {
      throw new Error('Database not ready for operations')
    }
    return databaseService.getRepository('user')
  }

  const getRepository = (name) => {
    if (!canPerformOperations.value) {
      throw new Error('Database not ready for operations')
    }
    return databaseService.getRepository(name)
  }

  const executeQuery = async (sql, params = []) => {
    if (!canPerformOperations.value) {
      throw new Error('Database not ready for operations')
    }
    return await databaseService.executeQuery(sql, params)
  }

  const executeCommand = async (sql, params = []) => {
    if (!canPerformOperations.value) {
      throw new Error('Database not ready for operations')
    }
    return await databaseService.executeCommand(sql, params)
  }

  const executeTransaction = async (commands) => {
    if (!canPerformOperations.value) {
      throw new Error('Database not ready for operations')
    }
    return await databaseService.executeTransaction(commands)
  }

  // Patient operations
  const createPatient = async (patientData) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.createPatient(patientData)
  }

  const findPatient = async (id) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.findById(id)
  }

  const findPatientByCode = async (patientCode) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.findByPatientCode(patientCode)
  }

  const findPatients = async (criteria = {}, options = {}) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.findPatientsByCriteria(criteria, options)
  }

  const updatePatient = async (id, updateData) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.updatePatient(id, updateData)
  }

  const deletePatient = async (id) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.delete(id)
  }

  const getPatientStatistics = async () => {
    const patientRepo = getPatientRepository()
    return await patientRepo.getPatientStatistics()
  }

  const searchPatients = async (searchTerm) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.searchPatients(searchTerm)
  }

  const getPatientsPaginated = async (page = 1, pageSize = 20, criteria = {}) => {
    const patientRepo = getPatientRepository()
    return await patientRepo.getPatientsPaginated(page, pageSize, criteria)
  }

  // Raw data/file upload operations
  const uploadRawData = async (observationData, fileData) => {
    const loggingStore = useLoggingStore()
    const timer = loggingStore.startTimer('Raw Data Upload')

    try {
      if (!canPerformOperations.value) {
        throw new Error('Database not ready for operations')
      }

      if (!fileData || !fileData.fileInfo || !fileData.blob) {
        throw new Error('Invalid file data provided')
      }

      loggingStore.info('DatabaseStore', 'Starting raw data upload', {
        filename: fileData.fileInfo.filename,
        size: fileData.fileInfo.size,
        ext: fileData.fileInfo.ext,
        conceptCode: observationData.CONCEPT_CD,
      })

      // Validate file info
      const { filename, size, ext } = fileData.fileInfo
      if (!filename || !ext) {
        throw new Error('File information is incomplete')
      }

      // Validate file size (max 50MB for database storage)
      const maxSizeBytes = 50 * 1024 * 1024 // 50MB
      if (size > maxSizeBytes) {
        throw new Error(`File size (${Math.round(size / 1024 / 1024)}MB) exceeds maximum allowed size (50MB)`)
      }

      // Prepare the observation data with file information
      const fileInfoJson = JSON.stringify({
        filename,
        size,
        ext,
        uploadDate: new Date().toISOString(),
        mimeType: getMimeTypeFromExtension(ext),
      })

      loggingStore.debug('DatabaseStore', 'Preparing raw data observation', {
        fileInfoJson,
        blobSize: fileData.blob?.length || 0,
        observationData,
      })

      const rawDataObservation = {
        ...observationData,
        VALTYPE_CD: 'R',
        TVAL_CHAR: fileInfoJson,
        OBSERVATION_BLOB: fileData.blob,
        // Clear fields not relevant for raw data
        NVAL_NUM: null,
        VALUEFLAG_CD: null,
        QUANTITY_NUM: null,
        UNIT_CD: null,
        CONFIDENCE_NUM: null,
      }

      // Use executeCommand for single INSERT to get proper lastInsertRowid
      const insertSql = `INSERT INTO OBSERVATION_FACT (
        ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, PROVIDER_ID, START_DATE, END_DATE,
        CATEGORY_CHAR, INSTANCE_NUM, VALTYPE_CD, TVAL_CHAR, NVAL_NUM, VALUEFLAG_CD,
        QUANTITY_NUM, UNIT_CD, LOCATION_CD, CONFIDENCE_NUM, OBSERVATION_BLOB,
        UPDATE_DATE, DOWNLOAD_DATE, IMPORT_DATE, SOURCESYSTEM_CD
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        datetime('now'), datetime('now'), datetime('now'), 'FILE_UPLOAD')`

      const insertParams = [
        rawDataObservation.ENCOUNTER_NUM,
        rawDataObservation.PATIENT_NUM,
        rawDataObservation.CONCEPT_CD,
        rawDataObservation.PROVIDER_ID,
        rawDataObservation.START_DATE,
        rawDataObservation.END_DATE,
        rawDataObservation.CATEGORY_CHAR,
        rawDataObservation.INSTANCE_NUM,
        rawDataObservation.VALTYPE_CD,
        rawDataObservation.TVAL_CHAR,
        rawDataObservation.NVAL_NUM,
        rawDataObservation.VALUEFLAG_CD,
        rawDataObservation.QUANTITY_NUM,
        rawDataObservation.UNIT_CD,
        rawDataObservation.LOCATION_CD,
        rawDataObservation.CONFIDENCE_NUM,
        rawDataObservation.OBSERVATION_BLOB,
      ]

      const result = await executeCommand(insertSql, insertParams)

      loggingStore.debug('DatabaseStore', 'Raw data insert result', {
        result,
        hasLastInsertRowid: !!result.lastInsertRowid,
        resultKeys: Object.keys(result || {}),
      })

      if (result.success) {
        const duration = timer.end()
        const observationId = result.lastInsertRowid || result.insertId || result.id

        loggingStore.success('DatabaseStore', 'Raw data uploaded successfully', {
          filename,
          size: `${Math.round(size / 1024)}KB`,
          ext,
          observationId,
          duration: `${duration.toFixed(2)}ms`,
        })

        return {
          success: true,
          observationId,
          fileInfo: fileData.fileInfo,
          message: `File "${filename}" uploaded successfully`,
        }
      } else {
        throw new Error(result.error || result.message || 'Failed to upload raw data')
      }
    } catch (error) {
      timer.end()
      loggingStore.error('DatabaseStore', 'Raw data upload failed', error, {
        filename: fileData?.fileInfo?.filename,
        size: fileData?.fileInfo?.size,
        conceptCode: observationData?.CONCEPT_CD,
      })
      throw error
    }
  }

  const downloadRawData = async (observationId) => {
    const loggingStore = useLoggingStore()

    try {
      if (!canPerformOperations.value) {
        throw new Error('Database not ready for operations')
      }

      loggingStore.info('DatabaseStore', 'Downloading raw data', { observationId })

      const query = `
        SELECT TVAL_CHAR, OBSERVATION_BLOB, CONCEPT_CD, START_DATE
        FROM OBSERVATION_FACT 
        WHERE OBSERVATION_ID = ? AND VALTYPE_CD = 'R'
      `

      const result = await executeQuery(query, [observationId])

      if (!result.success || !result.data || result.data.length === 0) {
        throw new Error('Raw data observation not found')
      }

      const observation = result.data[0]

      // Parse file info from TVAL_CHAR
      let fileInfo
      try {
        fileInfo = JSON.parse(observation.TVAL_CHAR)
      } catch {
        throw new Error('Invalid file information in database')
      }

      if (!observation.OBSERVATION_BLOB) {
        throw new Error('File content not found in database')
      }

      loggingStore.success('DatabaseStore', 'Raw data downloaded successfully', {
        observationId,
        filename: fileInfo.filename,
        size: `${Math.round(fileInfo.size / 1024)}KB`,
      })

      return {
        success: true,
        fileInfo,
        blob: observation.OBSERVATION_BLOB,
        conceptCode: observation.CONCEPT_CD,
        uploadDate: observation.START_DATE,
      }
    } catch (error) {
      loggingStore.error('DatabaseStore', 'Raw data download failed', error, { observationId })
      throw error
    }
  }

  const getRawDataInfo = async (observationId) => {
    try {
      if (!canPerformOperations.value) {
        throw new Error('Database not ready for operations')
      }

      const query = `
        SELECT TVAL_CHAR, START_DATE, CONCEPT_CD, 
               LENGTH(OBSERVATION_BLOB) as blob_size
        FROM OBSERVATION_FACT 
        WHERE OBSERVATION_ID = ? AND VALTYPE_CD = 'R'
      `

      const result = await executeQuery(query, [observationId])

      if (!result.success || !result.data || result.data.length === 0) {
        return null
      }

      const observation = result.data[0]

      // Parse file info from TVAL_CHAR
      let fileInfo
      try {
        fileInfo = JSON.parse(observation.TVAL_CHAR)
      } catch {
        return null
      }

      return {
        fileInfo,
        conceptCode: observation.CONCEPT_CD,
        uploadDate: observation.START_DATE,
        blobSize: observation.blob_size,
        hasBlob: observation.blob_size > 0,
      }
    } catch (error) {
      console.error('Error getting raw data info:', error)
      return null
    }
  }

  // Helper function to determine MIME type from file extension
  const getMimeTypeFromExtension = (ext) => {
    const mimeTypes = {
      txt: 'text/plain',
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }

    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
  }

  return {
    // State
    isConnected,
    isInitialized,
    databasePath,
    connectionError,
    isLoading,
    statistics,
    migrationStatus,

    // Getters
    connectionStatus,
    canPerformOperations,

    // Actions
    initializeDatabase,
    closeDatabase,
    loadMigrationStatus,
    loadStatistics,
    refreshDatabaseInfo,
    resetDatabase,
    validateDatabase,

    // Database operations
    getPatientRepository,
    getUserRepository,
    getRepository,
    executeQuery,
    executeCommand,
    executeTransaction,

    // Patient operations
    createPatient,
    findPatient,
    findPatientByCode,
    findPatients,
    updatePatient,
    deletePatient,
    getPatientStatistics,
    searchPatients,
    getPatientsPaginated,

    // Raw data operations
    uploadRawData,
    downloadRawData,
    getRawDataInfo,
  }
})
