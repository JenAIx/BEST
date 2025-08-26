/**
 * Medications Store
 *
 * Centralized state management for medication CRUD operations.
 * Handles database interactions, data normalization, and reactive state.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
import { useGlobalSettingsStore } from './global-settings-store.js'
import { useLoggingStore } from './logging-store.js'

export const useMedicationsStore = defineStore('medications', () => {
  const dbStore = useDatabaseStore()
  const globalSettingsStore = useGlobalSettingsStore()
  const loggingStore = useLoggingStore()
  const logger = loggingStore.createLogger('MedicationsStore')

  // State
  const medications = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const medicationsByVisit = computed(() => {
    return (visitId) => medications.value.filter((med) => med.visitId === visitId)
  })

  // Data normalization helpers
  const normalizeMedicationData = (data) => {
    return {
      drugName: data.drugName?.trim() || null,
      dosage: data.dosage || null,
      dosageUnit: data.dosageUnit?.trim() || 'mg',
      frequency: typeof data.frequency === 'string' ? data.frequency.trim() || null : data.frequency?.value || null,
      route: typeof data.route === 'string' ? data.route.trim() || null : data.route?.value || null,
      instructions: data.instructions?.trim() || null,
    }
  }

  const createMedicationBlob = (medicationData) => {
    const normalized = normalizeMedicationData(medicationData)
    return {
      ...normalized,
      prescribedDate: new Date().toISOString(),
      prescribedBy: 'CURRENT_DOCTOR', // TODO: Get from auth store
      isActive: true,
    }
  }

  // CRUD Operations

  /**
   * Create a new medication observation
   * @param {Object} params - Medication parameters
   * @param {string} params.patientId - Patient ID
   * @param {number} params.visitId - Visit/Encounter ID
   * @param {Object} params.medicationData - Medication data object
   * @returns {Promise<Object>} Created medication observation
   */
  const createMedication = async ({ patientId, visitId, medicationData }) => {
    try {
      loading.value = true
      error.value = null

      logger.debug('Creating medication', {
        patientId,
        visitId,
        medicationData,
      })

      // Validate required data - only drugName is mandatory
      const normalized = normalizeMedicationData(medicationData)
      if (!normalized.drugName) {
        throw new Error('Drug name is required')
      }

      // Get patient record
      const patientRepo = dbStore.getRepository('patient')
      const patient = await patientRepo.findByPatientCode(patientId)
      if (!patient) {
        throw new Error(`Patient not found: ${patientId}`)
      }

      // Get default values
      const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('VISITS_PAGE')

      // Create medication BLOB
      const medicationBlob = createMedicationBlob(normalized)

      // Prepare observation data
      const observationData = {
        PATIENT_NUM: patient.PATIENT_NUM,
        ENCOUNTER_NUM: visitId,
        CONCEPT_CD: 'LID: 52418-1', // Standard medication concept
        VALTYPE_CD: 'M', // Medication type
        TVAL_CHAR: normalized.drugName, // Primary drug name
        NVAL_NUM: normalized.dosage, // Dosage amount (can be null)
        UNIT_CD: normalized.dosageUnit, // Dosage unit
        OBSERVATION_BLOB: JSON.stringify(medicationBlob), // Complete medication data
        START_DATE: new Date().toISOString().split('T')[0],
        CATEGORY_CHAR: 'Medications', // Force medications category
        PROVIDER_ID: 'SYSTEM',
        LOCATION_CD: 'VISITS_PAGE',
        SOURCESYSTEM_CD: defaultSourceSystem,
        INSTANCE_NUM: 1,
        UPLOAD_ID: 1,
      }

      logger.debug('Creating medication observation', { observationData })

      // Create observation
      const observationRepo = dbStore.getRepository('observation')
      const result = await observationRepo.createObservation(observationData)

      logger.info('Medication created successfully', {
        drugName: normalized.drugName,
        patientId,
        visitId,
      })

      // Return normalized medication object
      return {
        observationId: result.observationId,
        patientId,
        visitId,
        conceptCode: 'LID: 52418-1',
        ...normalized,
        ...medicationBlob,
      }
    } catch (err) {
      error.value = err.message
      logger.error('Failed to create medication', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing medication observation
   * @param {Object} params - Update parameters
   * @param {number} params.observationId - Observation ID to update
   * @param {Object} params.medicationData - Updated medication data
   * @returns {Promise<Object>} Updated medication observation
   */
  const updateMedication = async ({ observationId, medicationData }) => {
    try {
      loading.value = true
      error.value = null

      logger.debug('Updating medication', {
        observationId,
        medicationData,
      })

      // Validate required data
      const normalized = normalizeMedicationData(medicationData)
      if (!normalized.drugName) {
        throw new Error('Drug name is required')
      }

      // Create medication BLOB
      const medicationBlob = createMedicationBlob(normalized)

      // Prepare update query
      const updateQuery = `
        UPDATE OBSERVATION_FACT 
        SET TVAL_CHAR = ?, 
            NVAL_NUM = ?, 
            UNIT_CD = ?,
            OBSERVATION_BLOB = ?,
            UPDATE_DATE = datetime('now')
        WHERE OBSERVATION_ID = ?
      `

      const params = [normalized.drugName, normalized.dosage, normalized.dosageUnit, JSON.stringify(medicationBlob), observationId]

      logger.debug('Executing medication update', {
        query: updateQuery,
        params,
      })

      const result = await dbStore.executeQuery(updateQuery, params)

      if (!result.success) {
        throw new Error(result.error || 'Failed to update medication')
      }

      if (result.changes === 0) {
        logger.warn('No rows affected by medication update', { observationId })
      }

      logger.info('Medication updated successfully', {
        observationId,
        drugName: normalized.drugName,
        rowsAffected: result.changes,
      })

      return {
        observationId,
        ...normalized,
        ...medicationBlob,
      }
    } catch (err) {
      error.value = err.message
      logger.error('Failed to update medication', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a medication observation
   * @param {Object} params - Delete parameters
   * @param {number} params.observationId - Observation ID to delete
   * @returns {Promise<boolean>} Success status
   */
  const deleteMedication = async ({ observationId }) => {
    try {
      loading.value = true
      error.value = null

      logger.debug('Deleting medication', { observationId })

      const deleteQuery = `DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?`
      const result = await dbStore.executeQuery(deleteQuery, [observationId])

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete medication')
      }

      if (result.changes === 0) {
        logger.warn('No rows affected by medication deletion', { observationId })
        return false
      }

      logger.info('Medication deleted successfully', {
        observationId,
        rowsAffected: result.changes,
      })

      return true
    } catch (err) {
      error.value = err.message
      logger.error('Failed to delete medication', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get medications for a specific visit
   * @param {Object} params - Query parameters
   * @param {number} params.visitId - Visit/Encounter ID
   * @returns {Promise<Array>} Array of medication observations
   */
  const getMedicationsForVisit = async ({ visitId }) => {
    try {
      loading.value = true
      error.value = null

      logger.debug('Loading medications for visit', { visitId })

      const query = `
        SELECT 
          OBSERVATION_ID as observationId,
          CONCEPT_CD as conceptCode,
          TVAL_CHAR as value,
          NVAL_NUM as numericValue,
          UNIT_CD as unit,
          OBSERVATION_BLOB as observationBlob,
          START_DATE as date,
          VALTYPE_CD as valTypeCode,
          CATEGORY_CHAR as categoryCode
        FROM OBSERVATION_FACT 
        WHERE ENCOUNTER_NUM = ? 
          AND (CONCEPT_CD = 'LID: 52418-1' OR VALTYPE_CD = 'M')
        ORDER BY OBSERVATION_ID
      `

      const result = await dbStore.executeQuery(query, [visitId])

      if (!result.success) {
        throw new Error(result.error || 'Failed to load medications')
      }

      const medications = result.data.map((obs) => {
        let medicationData = {
          drugName: obs.value || '',
          dosage: obs.numericValue || null,
          dosageUnit: obs.unit || 'mg',
          frequency: '',
          route: '',
          instructions: '',
        }

        // Parse BLOB if available
        if (obs.observationBlob) {
          try {
            const parsedData = JSON.parse(obs.observationBlob)
            medicationData = {
              drugName: parsedData.drugName || obs.value || '',
              dosage: parsedData.dosage || obs.numericValue || null,
              dosageUnit: parsedData.dosageUnit || obs.unit || 'mg',
              frequency: parsedData.frequency || '',
              route: parsedData.route || '',
              instructions: parsedData.instructions || '',
            }
          } catch (blobError) {
            logger.warn('Failed to parse medication BLOB', {
              observationId: obs.observationId,
              error: blobError.message,
            })
          }
        }

        return {
          observationId: obs.observationId,
          conceptCode: obs.conceptCode,
          visitId,
          ...medicationData,
          date: obs.date,
          valTypeCode: obs.valTypeCode,
          categoryCode: obs.categoryCode,
        }
      })

      logger.info('Medications loaded successfully', {
        visitId,
        medicationCount: medications.length,
      })

      return medications
    } catch (err) {
      error.value = err.message
      logger.error('Failed to load medications', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear/reset a medication (set all fields to null except concept)
   * @param {Object} params - Clear parameters
   * @param {number} params.observationId - Observation ID to clear
   * @returns {Promise<boolean>} Success status
   */
  const clearMedication = async ({ observationId }) => {
    try {
      loading.value = true
      error.value = null

      logger.debug('Clearing medication', { observationId })

      // Create empty medication BLOB
      const emptyBlob = {
        drugName: null,
        dosage: null,
        dosageUnit: 'mg',
        frequency: null,
        route: null,
        instructions: null,
        prescribedDate: new Date().toISOString(),
        prescribedBy: 'CURRENT_DOCTOR',
        isActive: false,
      }

      const updateQuery = `
        UPDATE OBSERVATION_FACT 
        SET TVAL_CHAR = NULL, 
            NVAL_NUM = NULL, 
            UNIT_CD = 'mg',
            OBSERVATION_BLOB = ?,
            UPDATE_DATE = datetime('now')
        WHERE OBSERVATION_ID = ?
      `

      const params = [JSON.stringify(emptyBlob), observationId]

      const result = await dbStore.executeQuery(updateQuery, params)

      if (!result.success) {
        throw new Error(result.error || 'Failed to clear medication')
      }

      logger.info('Medication cleared successfully', {
        observationId,
        rowsAffected: result.changes,
      })

      return true
    } catch (err) {
      error.value = err.message
      logger.error('Failed to clear medication', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Utility methods

  /**
   * Validate medication data
   * @param {Object} medicationData - Data to validate
   * @returns {Object} Validation result
   */
  const validateMedicationData = (medicationData) => {
    const errors = []
    const normalized = normalizeMedicationData(medicationData)

    if (!normalized.drugName) {
      errors.push('Drug name is required')
    }

    if (normalized.dosage && isNaN(normalized.dosage)) {
      errors.push('Dosage must be a valid number')
    }

    return {
      isValid: errors.length === 0,
      errors,
      normalized,
    }
  }

  /**
   * Format medication for display
   * @param {Object} medication - Medication object
   * @returns {string} Formatted display string
   */
  const formatMedicationDisplay = (medication) => {
    if (!medication.drugName) return ''

    const parts = [medication.drugName]

    if (medication.dosage && medication.dosageUnit) {
      parts.push(`${medication.dosage}${medication.dosageUnit}`)
    }

    if (medication.frequency) {
      parts.push(medication.frequency)
    }

    if (medication.route) {
      parts.push(medication.route)
    }

    return parts.join(' • ')
  }

  return {
    // State
    medications,
    loading,
    error,

    // Computed
    medicationsByVisit,

    // CRUD Operations
    createMedication,
    updateMedication,
    deleteMedication,
    getMedicationsForVisit,
    clearMedication,

    // Utilities
    validateMedicationData,
    formatMedicationDisplay,
    normalizeMedicationData,
  }
})
