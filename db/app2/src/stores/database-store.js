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

    // Initialize enhancedObservationData outside try block so it's available in catch
    let enhancedObservationData = { ...observationData }

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

      // Ensure we have PATIENT_NUM - look it up if missing (similar to visit-observation-store logic)
      if (!observationData.PATIENT_NUM && observationData.ENCOUNTER_NUM) {
        try {
          loggingStore.debug('DatabaseStore', 'PATIENT_NUM missing, looking up from encounter', {
            encounterNum: observationData.ENCOUNTER_NUM,
          })

          // Get patient num from the encounter
          const encounterQuery = `SELECT PATIENT_NUM FROM VISIT_DIMENSION WHERE ENCOUNTER_NUM = ?`
          const encounterResult = await executeQuery(encounterQuery, [observationData.ENCOUNTER_NUM])

          if (encounterResult.success && encounterResult.data.length > 0) {
            enhancedObservationData.PATIENT_NUM = encounterResult.data[0].PATIENT_NUM
            loggingStore.debug('DatabaseStore', 'Found PATIENT_NUM from encounter', {
              encounterNum: observationData.ENCOUNTER_NUM,
              patientNum: enhancedObservationData.PATIENT_NUM,
            })
          } else {
            throw new Error('Could not find patient for the given encounter')
          }
        } catch (error) {
          loggingStore.error('DatabaseStore', 'Failed to lookup PATIENT_NUM', error, {
            encounterNum: observationData.ENCOUNTER_NUM,
          })
          throw new Error('PATIENT_NUM is required for raw data upload')
        }
      }

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
        observationData: enhancedObservationData,
      })

      const rawDataObservation = {
        ...enhancedObservationData,
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
        conceptCode: enhancedObservationData?.CONCEPT_CD,
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

  // Data Grid specific operations
  const loadBatchPatientData = async (patientIds) => {
    const loggingStore = useLoggingStore()
    const timer = loggingStore.startTimer('Batch Patient Data Load')

    try {
      if (!canPerformOperations.value) {
        throw new Error('Database not ready for operations')
      }

      if (!patientIds || patientIds.length === 0) {
        throw new Error('No patient IDs provided')
      }

      // Ensure patient IDs are clean strings
      const cleanPatientIds = patientIds.map((id) => {
        // Handle case where id might be an object with an id property
        if (typeof id === 'object' && id.id) {
          return String(id.id)
        }
        return String(id)
      })

      loggingStore.info('DatabaseStore', 'Loading batch patient data', {
        patientIds: cleanPatientIds,
        count: cleanPatientIds.length,
      })

      const patientRepo = getRepository('patient')
      const visitRepo = getRepository('visit')

      // Get patient details
      const patientDetails = await Promise.all(
        cleanPatientIds.map(async (patientId) => {
          const patient = await patientRepo.findByPatientCode(patientId)
          if (!patient) {
            loggingStore.warn('DatabaseStore', 'Patient not found', { patientId })
            return { patient: null, visits: [] }
          }
          const visits = await visitRepo.getPatientVisitTimeline(patient.PATIENT_NUM)
          return { patient, visits }
        }),
      )

      // Filter out null patients
      const validPatientData = patientDetails.filter((p) => p.patient !== null)

      if (validPatientData.length === 0) {
        throw new Error('No valid patients found with the provided IDs')
      }

      const duration = timer.end()
      loggingStore.success('DatabaseStore', 'Batch patient data loaded successfully', {
        requested: cleanPatientIds.length,
        loaded: validPatientData.length,
        duration: `${duration.toFixed(2)}ms`,
      })

      return validPatientData
    } catch (error) {
      timer.end()
      loggingStore.error('DatabaseStore', 'Failed to load batch patient data', error, { patientIds })
      throw error
    }
  }

  const loadBatchObservationData = async (patientIds) => {
    const loggingStore = useLoggingStore()
    const timer = loggingStore.startTimer('Batch Observation Data Load')

    try {
      if (!canPerformOperations.value) {
        throw new Error('Database not ready for operations')
      }

      // Ensure patient IDs are clean strings
      const cleanPatientIds = patientIds.map((id) => {
        if (typeof id === 'object' && id.id) {
          return String(id.id)
        }
        return String(id)
      })

      if (cleanPatientIds.length === 0) {
        throw new Error('No valid patient IDs found')
      }

      loggingStore.info('DatabaseStore', 'Loading batch observation data', {
        patientCount: cleanPatientIds.length,
        patientIds: cleanPatientIds,
      })

      // Get all observations for selected patients using the patient_observations view
      const placeholders = cleanPatientIds.map(() => '?').join(',')
      const observationQuery = `
        SELECT
          OBSERVATION_ID,
          PATIENT_CD,
          ENCOUNTER_NUM,
          CONCEPT_CD,
          VALTYPE_CD,
          TVAL_CHAR,
          NVAL_NUM,
          UNIT_CD,
          START_DATE,
          CATEGORY_CHAR,
          CONCEPT_NAME_CHAR as CONCEPT_NAME,
          TVAL_RESOLVED
        FROM patient_observations
        WHERE PATIENT_CD IN (${placeholders})
        ORDER BY PATIENT_CD, ENCOUNTER_NUM, CONCEPT_CD
      `

      const result = await executeQuery(observationQuery, cleanPatientIds)

      if (!result.success) {
        throw new Error(result.error || 'Failed to load observations')
      }

      const duration = timer.end()
      loggingStore.success('DatabaseStore', 'Batch observation data loaded successfully', {
        patientCount: cleanPatientIds.length,
        observationCount: result.data.length,
        duration: `${duration.toFixed(2)}ms`,
      })

      return result.data
    } catch (error) {
      timer.end()
      loggingStore.error('DatabaseStore', 'Failed to load batch observation data', error, {
        patientIds,
        patientCount: patientIds?.length,
      })
      throw error
    }
  }

  const processObservationDataForGrid = (observations, patientData) => {
    try {
      // Group observations by concept to create columns
      const conceptMap = new Map()
      const patientVisitMap = new Map()

      observations.forEach((obs) => {
        // Track concepts for columns
        if (!conceptMap.has(obs.CONCEPT_CD)) {
          conceptMap.set(obs.CONCEPT_CD, {
            code: obs.CONCEPT_CD,
            name: obs.CONCEPT_NAME || obs.CONCEPT_CD,
            valueType: obs.VALTYPE_CD || 'T',
          })
        }

        // Group by patient and encounter
        const key = `${obs.PATIENT_CD}-${obs.ENCOUNTER_NUM}`
        if (!patientVisitMap.has(key)) {
          // Find patient data
          const patientInfo = patientData.find((p) => p.patient?.PATIENT_CD === obs.PATIENT_CD)
          const visitInfo = patientInfo?.visits.find((v) => v.ENCOUNTER_NUM === obs.ENCOUNTER_NUM)

          patientVisitMap.set(key, {
            patientId: obs.PATIENT_CD,
            patientName: getPatientNameFromData(patientInfo?.patient),
            encounterNum: obs.ENCOUNTER_NUM,
            visitDate: visitInfo?.START_DATE || obs.START_DATE,
            observations: {},
          })
        }

        // Add observation to the row
        const row = patientVisitMap.get(key)

        // For Selection (S) and Finding (F) types, prefer resolved values
        let displayValue = obs.TVAL_CHAR || obs.NVAL_NUM
        if ((obs.VALTYPE_CD === 'S' || obs.VALTYPE_CD === 'F') && obs.TVAL_RESOLVED) {
          displayValue = obs.TVAL_RESOLVED
        }

        row.observations[obs.CONCEPT_CD] = {
          observationId: obs.OBSERVATION_ID,
          value: displayValue,
          valueType: obs.VALTYPE_CD,
          unit: obs.UNIT_CD,
          originalValue: obs.TVAL_CHAR || obs.NVAL_NUM,
          resolvedValue: obs.TVAL_RESOLVED,
        }
      })

      // Convert to arrays
      const observationConcepts = Array.from(conceptMap.values()).sort((a, b) => a.name.localeCompare(b.name))

      const tableRows = Array.from(patientVisitMap.values()).sort((a, b) => {
        // Sort by patient ID, then by encounter number
        if (a.patientId !== b.patientId) {
          return a.patientId.localeCompare(b.patientId)
        }
        return a.encounterNum - b.encounterNum
      })

      return {
        observationConcepts,
        tableRows,
      }
    } catch (error) {
      console.error('Error processing observation data for grid:', error)
      throw error
    }
  }

  // Helper function for patient name formatting (used internally)
  const getPatientNameFromData = (patient) => {
    if (!patient) return 'Unknown Patient'

    if (patient.PATIENT_BLOB) {
      try {
        const blob = JSON.parse(patient.PATIENT_BLOB)
        if (blob.name) return blob.name
        if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
      } catch {
        // Fallback to PATIENT_CD
      }
    }
    return patient.PATIENT_CD || 'Unknown Patient'
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

    // Data Grid operations
    loadBatchPatientData,
    loadBatchObservationData,
    processObservationDataForGrid,
  }
})
