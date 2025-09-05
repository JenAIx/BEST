/**
 * Observation Store
 *
 * Manages observations state and operations.
 * Part of the MVC refactoring to separate concerns.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'
import { useAuthStore } from './auth-store'

export const useObservationStore = defineStore('observation', () => {
  const dbStore = useDatabaseStore()
  const authStore = useAuthStore()
  const logger = useLoggingStore().createLogger('ObservationStore')

  // State
  const observations = ref([]) // Observations for selected visit
  const allObservations = ref([]) // All observations for patient
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const hasObservations = computed(() => observations.value.length > 0)

  const hasAllObservations = computed(() => allObservations.value.length > 0)

  const observationCount = computed(() => observations.value.length)

  const categorizedObservations = computed(() => {
    if (!observations.value || observations.value.length === 0) {
      return []
    }

    // Group observations by category
    const categories = new Map()

    observations.value.forEach((obs) => {
      const categoryName = obs.category || 'Uncategorized'
      if (!categories.has(categoryName)) {
        categories.set(categoryName, {
          name: categoryName,
          observations: [],
        })
      }
      categories.get(categoryName).observations.push(obs)
    })

    // Convert to array and sort
    return Array.from(categories.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        observations: category.observations.slice().sort((a, b) => a.conceptName.localeCompare(b.conceptName)),
      }))
  })

  // Actions
  const clearObservations = () => {
    observations.value = []
    error.value = null
  }

  const clearAllObservations = () => {
    allObservations.value = []
    observations.value = []
    error.value = null
  }

  const loadObservationsForVisit = async (visitId) => {
    if (!visitId) {
      observations.value = []
      return []
    }

    try {
      loading.value = true
      error.value = null

      logger.info('Loading observations for visit', { visitId })

      const query = `
        SELECT
          OBSERVATION_ID,
          CONCEPT_CD,
          VALTYPE_CD,
          TVAL_CHAR,
          NVAL_NUM,
          UNIT_CD,
          START_DATE,
          CATEGORY_CHAR,
          CONCEPT_NAME_CHAR as CONCEPT_NAME,
          TVAL_RESOLVED,
          ENCOUNTER_NUM
        FROM patient_observations
        WHERE ENCOUNTER_NUM = ?
        ORDER BY CATEGORY_CHAR, CONCEPT_NAME_CHAR
        LIMIT 500
      `

      const result = await dbStore.executeQuery(query, [visitId])

      if (result.success) {
        observations.value = result.data.map((obs) => transformObservation(obs))

        logger.success('Observations loaded successfully', {
          visitId,
          observationCount: observations.value.length,
        })
      } else {
        throw new Error('Failed to load observations')
      }

      return observations.value
    } catch (err) {
      logger.error('Failed to load observations', err, { visitId })
      error.value = err.message
      observations.value = []
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadAllObservationsForPatient = async (patientNum) => {
    if (!patientNum) {
      allObservations.value = []
      return []
    }

    try {
      loading.value = true
      error.value = null

      logger.info('Loading all observations for patient', { patientNum })

      const query = `
        SELECT
          OBSERVATION_ID,
          CONCEPT_CD,
          VALTYPE_CD,
          TVAL_CHAR,
          NVAL_NUM,
          UNIT_CD,
          START_DATE,
          CATEGORY_CHAR,
          CONCEPT_NAME_CHAR as CONCEPT_NAME,
          TVAL_RESOLVED,
          ENCOUNTER_NUM
        FROM patient_observations
        WHERE PATIENT_NUM = ?
        ORDER BY START_DATE DESC, CATEGORY_CHAR, CONCEPT_NAME_CHAR
        LIMIT 1000
      `

      const result = await dbStore.executeQuery(query, [patientNum])

      if (result.success) {
        allObservations.value = result.data.map((obs) => transformObservation(obs))

        logger.success('All observations loaded successfully', {
          patientNum,
          observationCount: allObservations.value.length,
        })
      } else {
        throw new Error('Failed to load all observations')
      }

      return allObservations.value
    } catch (err) {
      logger.error('Failed to load all observations', err, { patientNum })
      error.value = err.message
      allObservations.value = []
      throw err
    } finally {
      loading.value = false
    }
  }

  const createObservation = async (observationData) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Creating observation', {
        conceptCode: observationData.CONCEPT_CD,
        valueType: observationData.VALTYPE_CD,
        encounterNum: observationData.ENCOUNTER_NUM,
      })

      // Get current user for PROVIDER_ID
      const currentUser = authStore.currentUser
      const providerId = currentUser?.USER_CD || 'SYSTEM'

      // Get concept metadata
      const conceptMetadata = await getConceptMetadata(observationData.CONCEPT_CD)

      const enhancedObservationData = {
        ...observationData,
        PROVIDER_ID: providerId,
        SOURCESYSTEM_CD: observationData.SOURCESYSTEM_CD || conceptMetadata.sourceSystemCd,
        CATEGORY_CHAR: observationData.CATEGORY_CHAR || conceptMetadata.categoryCd || 'General',
      }

      const observationRepo = dbStore.getRepository('observation')
      const newObservation = await observationRepo.createObservation(enhancedObservationData)

      logger.success('Observation created successfully', {
        observationId: newObservation?.OBSERVATION_ID,
      })

      return newObservation
    } catch (err) {
      logger.error('Failed to create observation', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateObservation = async (observationId, updateData) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Updating observation', { observationId, updateData })

      let enhancedUpdateData = { ...updateData }

      // If updating CONCEPT_CD, also update metadata
      if (updateData.CONCEPT_CD) {
        const conceptMetadata = await getConceptMetadata(updateData.CONCEPT_CD)
        enhancedUpdateData.SOURCESYSTEM_CD = conceptMetadata.sourceSystemCd
        if (!updateData.CATEGORY_CHAR) {
          enhancedUpdateData.CATEGORY_CHAR = conceptMetadata.categoryCd
        }
      }

      const observationRepo = dbStore.getRepository('observation')
      const result = await observationRepo.updateObservation(observationId, enhancedUpdateData)

      logger.success('Observation updated successfully', { observationId })
      return result
    } catch (err) {
      logger.error('Failed to update observation', err, { observationId })
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteObservation = async (observationId) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Deleting observation', { observationId })

      const observationRepo = dbStore.getRepository('observation')
      await observationRepo.delete(observationId)

      logger.success('Observation deleted successfully', { observationId })
    } catch (err) {
      logger.error('Failed to delete observation', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const getObservationBlob = async (observationId) => {
    try {
      logger.debug('Loading OBSERVATION_BLOB', { observationId })

      const query = `
        SELECT OBSERVATION_BLOB
        FROM OBSERVATION_FACT
        WHERE OBSERVATION_ID = ?
      `

      const result = await dbStore.executeQuery(query, [observationId])

      if (result.success && result.data.length > 0) {
        return result.data[0].OBSERVATION_BLOB
      } else {
        return null
      }
    } catch (err) {
      logger.error('Failed to load OBSERVATION_BLOB', err, { observationId })
      throw err
    }
  }

  const loadObservationDetails = async (observationId) => {
    try {
      logger.info('Loading observation details', { observationId })

      const query = `
        SELECT OBSERVATION_BLOB, VALTYPE_CD, TVAL_CHAR
        FROM OBSERVATION_FACT
        WHERE OBSERVATION_ID = ?
      `

      const result = await dbStore.executeQuery(query, [observationId])

      if (result.success && result.data.length > 0) {
        const obsData = result.data[0]
        let parsedData = null

        if (obsData.OBSERVATION_BLOB) {
          try {
            if (obsData.VALTYPE_CD === 'Q' || obsData.VALTYPE_CD === 'B') {
              parsedData = JSON.parse(obsData.OBSERVATION_BLOB)
            } else {
              parsedData = obsData.OBSERVATION_BLOB
            }
          } catch (parseError) {
            logger.warn('Failed to parse OBSERVATION_BLOB', parseError)
            parsedData = obsData.OBSERVATION_BLOB
          }
        }

        return {
          observationBlob: parsedData,
          rawBlob: obsData.OBSERVATION_BLOB,
          valType: obsData.VALTYPE_CD,
          tvalChar: obsData.TVAL_CHAR,
        }
      } else {
        logger.warn('Observation not found', { observationId })
        return null
      }
    } catch (err) {
      logger.error('Failed to load observation details', err)
      throw err
    }
  }

  // Helper functions
  const transformObservation = (obs) => {
    const processedObs = {
      observationId: obs.OBSERVATION_ID,
      conceptCode: obs.CONCEPT_CD,
      conceptName: obs.CONCEPT_NAME || obs.CONCEPT_CD,
      valueType: obs.VALTYPE_CD,
      originalValue: obs.TVAL_CHAR || obs.NVAL_NUM,
      resolvedValue: obs.TVAL_RESOLVED,
      unit: obs.UNIT_CD,
      category: obs.CATEGORY_CHAR || 'General',
      date: obs.START_DATE,
      displayValue: null,
      fileInfo: null,
      encounterNum: obs.ENCOUNTER_NUM,
      // Additional fields for compatibility
      value: obs.TVAL_CHAR,
      numericValue: obs.NVAL_NUM,
      valTypeCode: obs.VALTYPE_CD,
    }

    // Process different value types
    switch (obs.VALTYPE_CD) {
      case 'S': // Selection
      case 'F': // Finding
      case 'A': // Array/Multiple choice
        processedObs.displayValue = obs.TVAL_RESOLVED || obs.TVAL_CHAR || 'No value'
        break
      case 'Q': // Questionnaire
        processedObs.displayValue = obs.TVAL_CHAR || 'Questionnaire'
        break
      case 'R': // Raw data/File
        try {
          if (obs.TVAL_CHAR) {
            processedObs.fileInfo = JSON.parse(obs.TVAL_CHAR)
            processedObs.displayValue = processedObs.fileInfo.filename || 'File attached'
          }
        } catch {
          processedObs.displayValue = 'Invalid file data'
        }
        break
      case 'N': // Numeric
        processedObs.displayValue = obs.NVAL_NUM?.toString() || 'No value'
        break
      default: // Text and others
        processedObs.displayValue = obs.TVAL_CHAR || 'No value'
    }

    return processedObs
  }

  const getConceptMetadata = async (conceptCode) => {
    try {
      const query = `
        SELECT SOURCESYSTEM_CD, CATEGORY_CHAR
        FROM CONCEPT_DIMENSION
        WHERE CONCEPT_CD = ?
      `
      const result = await dbStore.executeQuery(query, [conceptCode])

      if (result.success && result.data.length > 0) {
        return {
          sourceSystemCd: result.data[0].SOURCESYSTEM_CD,
          categoryCd: result.data[0].CATEGORY_CHAR,
        }
      }

      logger.warn('Concept not found in CONCEPT_DIMENSION', { conceptCode })
      return {
        sourceSystemCd: 'UNKNOWN',
        categoryCd: 'General',
      }
    } catch (error) {
      logger.error('Failed to get concept metadata', error, { conceptCode })
      return {
        sourceSystemCd: 'SYSTEM',
        categoryCd: 'General',
      }
    }
  }

  const getFieldSetObservations = (fieldSetId, fieldSets) => {
    if (!fieldSetId || !fieldSets || !observations.value) {
      return []
    }

    const fieldSet = fieldSets.find((fs) => fs.id === fieldSetId)
    if (!fieldSet) {
      return []
    }

    return observations.value.filter((obs) => {
      return fieldSet.concepts.some((concept) => {
        // Multiple matching strategies
        if (obs.conceptCode === concept) return true

        // Extract numeric codes and compare
        const conceptMatch = concept.match(/[:\s]([0-9-]+)$/)
        const obsMatch = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
        if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) {
          return true
        }

        // Partial matches
        if (concept.includes(obs.conceptCode) || obs.conceptCode.includes(concept)) {
          return true
        }

        // Case-insensitive match
        if (obs.conceptCode.toLowerCase().includes(concept.toLowerCase())) {
          return true
        }

        return false
      })
    })
  }

  return {
    // State
    observations,
    allObservations,
    loading,
    error,

    // Getters
    hasObservations,
    hasAllObservations,
    observationCount,
    categorizedObservations,

    // Actions
    clearObservations,
    clearAllObservations,
    loadObservationsForVisit,
    loadAllObservationsForPatient,
    createObservation,
    updateObservation,
    deleteObservation,
    getObservationBlob,
    loadObservationDetails,

    // Helpers
    transformObservation,
    getConceptMetadata,
    getFieldSetObservations,
  }
})
