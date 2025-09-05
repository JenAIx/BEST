/**
 * Patient Store
 *
 * Manages patient selection and patient-specific state.
 * Part of the MVC refactoring to separate concerns.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'

export const usePatientStore = defineStore('patient', () => {
  const dbStore = useDatabaseStore()
  const logger = useLoggingStore().createLogger('PatientStore')

  // State
  const selectedPatient = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const hasPatient = computed(() => !!selectedPatient.value)

  const patientId = computed(() => selectedPatient.value?.id)

  const patientNum = computed(() => selectedPatient.value?.PATIENT_NUM)

  const patientName = computed(() => {
    if (!selectedPatient.value) return 'Unknown Patient'
    return selectedPatient.value.name || selectedPatient.value.PATIENT_CD || 'Unknown Patient'
  })

  // Actions
  const setSelectedPatient = async (patient) => {
    logger.info('Setting selected patient', {
      patientId: patient?.id,
      previousPatientId: selectedPatient.value?.id,
    })

    // If switching to the same patient, don't update
    if (selectedPatient.value?.id === patient?.id) {
      logger.debug('Same patient selected, skipping update')
      return false
    }

    selectedPatient.value = patient
    error.value = null

    logger.success('Patient selected', { patientId: patient?.id })
    return true // Indicates patient was changed
  }

  const clearPatient = () => {
    logger.info('Clearing selected patient')
    selectedPatient.value = null
    error.value = null
    loading.value = false
  }

  const loadPatientByCode = async (patientCode) => {
    if (!patientCode) {
      logger.warn('loadPatientByCode called without patientCode')
      return null
    }

    try {
      loading.value = true
      error.value = null

      logger.info('Loading patient by code', { patientCode })

      // Use patient_list view for resolved concepts
      const result = await dbStore.executeQuery('SELECT * FROM patient_list WHERE PATIENT_CD = ?', [patientCode])

      if (result.success && result.data.length > 0) {
        const rawPatient = result.data[0]
        const normalizedPatient = normalizePatientData(rawPatient)

        logger.info('Patient loaded successfully', {
          patientCode,
          patientName: normalizedPatient.name,
          patientNum: normalizedPatient.PATIENT_NUM,
        })

        // Set the patient which will return true if it's a new patient
        const isNewPatient = await setSelectedPatient(normalizedPatient)
        return { patient: normalizedPatient, isNewPatient }
      } else {
        logger.warn('Patient not found', { patientCode })
        clearPatient()
        return null
      }
    } catch (err) {
      logger.error('Failed to load patient by code', err, { patientCode })
      error.value = err.message
      clearPatient()
      throw err
    } finally {
      loading.value = false
    }
  }

  // Helper functions
  const getPatientName = (patient) => {
    if (patient?.PATIENT_BLOB) {
      try {
        const blob = JSON.parse(patient.PATIENT_BLOB)
        if (blob.name) return blob.name
        if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
      } catch {
        // Fallback to PATIENT_CD
      }
    }
    return patient?.PATIENT_CD || 'Unknown Patient'
  }

  const calculateAge = (birthDate) => {
    if (!birthDate) return null
    const birthYear = new Date(birthDate).getFullYear()
    const currentYear = new Date().getFullYear()
    return currentYear - birthYear
  }

  const normalizePatientData = (rawPatient) => {
    if (!rawPatient) return null

    return {
      id: rawPatient.PATIENT_CD,
      name: getPatientName(rawPatient),
      age: rawPatient.AGE_IN_YEARS || calculateAge(rawPatient.BIRTH_DATE),
      gender: rawPatient.SEX_RESOLVED || rawPatient.SEX_CD || 'Unknown',
      PATIENT_NUM: rawPatient.PATIENT_NUM,
      PATIENT_CD: rawPatient.PATIENT_CD,
      rawData: rawPatient,
    }
  }

  return {
    // State
    selectedPatient,
    loading,
    error,

    // Getters
    hasPatient,
    patientId,
    patientNum,
    patientName,

    // Actions
    setSelectedPatient,
    clearPatient,
    loadPatientByCode,

    // Helpers
    normalizePatientData,
    getPatientName,
    calculateAge,
  }
})
