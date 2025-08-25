/**
 * Visit & Observation Store
 *
 * Centralized state management for visits and observations.
 * Handles loading, caching, CRUD operations, and reactive state.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
import { useLoggingStore } from './logging-store.js'
import { useQuasar } from 'quasar'
import { formatDate, getVisitTypeLabel } from 'src/shared/utils/medical-utils.js'

export const useVisitObservationStore = defineStore('visitObservation', () => {
  const dbStore = useDatabaseStore()
  const logger = useLoggingStore().createLogger('VisitObservationStore')
  const $q = useQuasar()

  // State
  const selectedPatient = ref(null)
  const selectedVisit = ref(null)
  const visits = ref([])
  const observations = ref([]) // Observations for selected visit
  const allObservations = ref([]) // All observations for patient (all visits)
  const loading = ref({
    visits: false,
    observations: false,
    actions: false,
  })
  const error = ref(null)

  // Getters
  const sortedVisits = computed(() => {
    return [...visits.value].sort((a, b) => new Date(b.date) - new Date(a.date))
  })

  const visitOptions = computed(() => {
    return visits.value.map((visit) => ({
      id: visit.id,
      label: formatVisitDate(visit.date),
      summary: `${getVisitTypeLabel(visit.type)} • ${visit.observationCount || 0} observations`,
      value: visit,
    }))
  })

  const previousVisits = computed(() => {
    if (!selectedVisit.value) return []
    return visits.value.filter((v) => v.id !== selectedVisit.value.id && new Date(v.date) < new Date(selectedVisit.value.date)).sort((a, b) => new Date(b.date) - new Date(a.date))
  })

  const categorizedObservations = computed(() => {
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

    // Sort categories and observations
    return Array.from(categories.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        observations: category.observations.sort((a, b) => a.conceptName.localeCompare(b.conceptName)),
      }))
  })

  const hasData = computed(() => {
    return selectedPatient.value && visits.value.length > 0
  })

  // Actions - Patient Management
  const setSelectedPatient = async (patient) => {
    logger.info('Setting selected patient', { patientId: patient?.id })
    selectedPatient.value = patient
    selectedVisit.value = null
    visits.value = []
    observations.value = []
    error.value = null

    if (patient) {
      await loadVisitsForPatient(patient)
    }
  }

  const clearPatient = () => {
    logger.info('Clearing selected patient')
    selectedPatient.value = null
    selectedVisit.value = null
    visits.value = []
    observations.value = []
    allObservations.value = []
    error.value = null
  }

  // Actions - Visit Management
  const loadVisitsForPatient = async (patient) => {
    if (!patient?.id) return

    try {
      loading.value.visits = true
      error.value = null

      logger.info('Loading visits for patient', { patientId: patient.id })

      const patientRepo = dbStore.getRepository('patient')
      const visitRepo = dbStore.getRepository('visit')

      const patientData = await patientRepo.findByPatientCode(patient.id)
      if (!patientData) {
        throw new Error('Patient not found')
      }

      const patientVisits = await visitRepo.getPatientVisitTimeline(patientData.PATIENT_NUM)

      // Load observation counts for each visit
      const visitsWithCounts = await Promise.all(
        patientVisits.map(async (visit) => {
          const observationCount = await getObservationCount(visit.ENCOUNTER_NUM)
          return {
            id: visit.ENCOUNTER_NUM,
            date: visit.START_DATE,
            type: visit.INOUT_CD === 'E' ? 'emergency' : 'routine',
            notes: visit.VISIT_BLOB ? parseVisitNotes(visit.VISIT_BLOB) : '',
            status: visit.ACTIVE_STATUS_CD || 'completed',
            observationCount,
            location: visit.LOCATION_CD,
            endDate: visit.END_DATE,
          }
        }),
      )

      visits.value = visitsWithCounts

      // Also load all observations for the patient
      await loadAllObservationsForPatient(patientData.PATIENT_NUM)

      logger.success('Visits loaded successfully', {
        patientId: patient.id,
        visitCount: visitsWithCounts.length,
      })
    } catch (err) {
      logger.error('Failed to load visits', err, { patientId: patient.id })
      error.value = err.message
      $q.notify({
        type: 'negative',
        message: 'Failed to load patient visits',
        position: 'top',
      })
    } finally {
      loading.value.visits = false
    }
  }

  const setSelectedVisit = async (visit) => {
    if (!visit) {
      selectedVisit.value = null
      observations.value = []
      return
    }

    logger.info('Setting selected visit', { visitId: visit.id })

    // Ensure we're using the visit object from our store
    const storeVisit = visits.value.find((v) => v.id === visit.id)
    if (storeVisit) {
      selectedVisit.value = storeVisit
      await loadObservationsForVisit(storeVisit)
    } else {
      logger.warn('Visit not found in store', { visitId: visit.id })
      selectedVisit.value = visit
      await loadObservationsForVisit(visit)
    }
  }

  const loadObservationsForVisit = async (visit) => {
    if (!visit?.id) {
      observations.value = []
      return
    }

    try {
      loading.value.observations = true
      error.value = null

      logger.info('Loading observations for visit', { visitId: visit.id })

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
      `

      const result = await dbStore.executeQuery(query, [visit.id])

      if (result.success) {
        logger.info('Raw observations loaded', {
          visitId: visit.id,
          rawCount: result.data.length,
          sampleData: result.data.slice(0, 2),
        })

        observations.value = result.data.map((obs) => {
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
          }

          // Process different value types
          switch (obs.VALTYPE_CD) {
            case 'S': // Selection
            case 'F': // Finding
            case 'A': // Array/Multiple choice
              processedObs.displayValue = obs.TVAL_RESOLVED || obs.TVAL_CHAR || 'No value'
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
        })

        logger.success('Observations loaded successfully', {
          visitId: visit.id,
          observationCount: observations.value.length,
        })
      } else {
        throw new Error('Failed to load observations')
      }
    } catch (err) {
      logger.error('Failed to load observations', err, { visitId: visit.id })
      error.value = err.message
      observations.value = []
    } finally {
      loading.value.observations = false
    }
  }

  const createVisit = async (visitData) => {
    try {
      loading.value.actions = true

      logger.info('Creating new visit', { patientId: selectedPatient.value?.id })

      const visitRepo = dbStore.getRepository('visit')
      const patientRepo = dbStore.getRepository('patient')

      const patient = await patientRepo.findByPatientCode(selectedPatient.value.id)

      const newVisitData = {
        PATIENT_NUM: patient.PATIENT_NUM,
        START_DATE: visitData.date || new Date().toISOString().split('T')[0],
        INOUT_CD: visitData.type === 'emergency' ? 'E' : 'O',
        ACTIVE_STATUS_CD: 'A',
        LOCATION_CD: visitData.location || 'CLINIC',
        VISIT_BLOB: visitData.notes ? JSON.stringify({ notes: visitData.notes }) : null,
      }

      const createdVisit = await visitRepo.createVisit(newVisitData)

      const newVisit = {
        id: createdVisit.ENCOUNTER_NUM,
        date: newVisitData.START_DATE,
        type: visitData.type || 'routine',
        notes: visitData.notes || '',
        status: 'active',
        observationCount: 0,
        location: visitData.location || 'CLINIC',
        endDate: null,
      }

      visits.value.unshift(newVisit)

      logger.success('Visit created successfully', { visitId: newVisit.id })

      $q.notify({
        type: 'positive',
        message: 'Visit created successfully',
        position: 'top',
      })

      return newVisit
    } catch (err) {
      logger.error('Failed to create visit', err)
      $q.notify({
        type: 'negative',
        message: 'Failed to create visit',
        position: 'top',
      })
      throw err
    } finally {
      loading.value.actions = false
    }
  }

  const duplicateVisit = async (originalVisit) => {
    try {
      loading.value.actions = true

      logger.info('Duplicating visit', { originalVisitId: originalVisit.id })

      // Get all observations from the original visit
      const query = `
        SELECT *
        FROM OBSERVATION_FACT
        WHERE ENCOUNTER_NUM = ?
      `
      const result = await dbStore.executeQuery(query, [originalVisit.id])

      if (!result.success) {
        throw new Error('Failed to load visit observations')
      }

      const observations = result.data

      // Create new visit first
      const visitRepo = dbStore.getRepository('visit')
      const patientRepo = dbStore.getRepository('patient')

      const patient = await patientRepo.findByPatientCode(selectedPatient.value.id)

      const newVisitData = {
        PATIENT_NUM: patient.PATIENT_NUM,
        START_DATE: new Date().toISOString().split('T')[0],
        INOUT_CD: originalVisit.type === 'emergency' ? 'E' : 'O',
        ACTIVE_STATUS_CD: 'A',
        LOCATION_CD: originalVisit.location || 'CLINIC',
        VISIT_BLOB: JSON.stringify({
          notes: `Cloned from visit on ${formatVisitDate(originalVisit.date)}`,
          originalVisit: originalVisit.id,
        }),
      }

      const createdVisit = await visitRepo.createVisit(newVisitData)

      // Clone observations
      const observationRepo = dbStore.getRepository('observation')
      let clonedCount = 0

      for (const obs of observations) {
        try {
          const newObsData = {
            PATIENT_NUM: obs.PATIENT_NUM,
            ENCOUNTER_NUM: createdVisit.ENCOUNTER_NUM,
            CONCEPT_CD: obs.CONCEPT_CD,
            VALTYPE_CD: obs.VALTYPE_CD,
            TVAL_CHAR: obs.TVAL_CHAR,
            NVAL_NUM: obs.NVAL_NUM,
            UNIT_CD: obs.UNIT_CD,
            START_DATE: new Date().toISOString().split('T')[0],
            CATEGORY_CHAR: obs.CATEGORY_CHAR,
            PROVIDER_ID: 'SYSTEM',
            LOCATION_CD: 'CLONED',
            SOURCESYSTEM_CD: 'VISIT_CLONE',
            INSTANCE_NUM: 1,
            UPLOAD_ID: 1,
          }

          await observationRepo.createObservation(newObsData)
          clonedCount++
        } catch (error) {
          logger.warn('Failed to clone observation', error)
        }
      }

      // Add new visit to store
      const newVisit = {
        id: createdVisit.ENCOUNTER_NUM,
        date: newVisitData.START_DATE,
        type: originalVisit.type,
        notes: `Cloned from visit on ${formatVisitDate(originalVisit.date)}`,
        status: 'active',
        observationCount: clonedCount,
        location: originalVisit.location || 'CLINIC',
        endDate: null,
      }

      visits.value.unshift(newVisit)

      logger.success('Visit cloned successfully', {
        originalVisitId: originalVisit.id,
        newVisitId: newVisit.id,
        clonedCount,
      })

      $q.notify({
        type: 'positive',
        message: `Visit cloned successfully with ${clonedCount} observations`,
        position: 'top',
      })

      return newVisit
    } catch (err) {
      logger.error('Failed to duplicate visit', err)
      $q.notify({
        type: 'negative',
        message: 'Failed to clone visit',
        position: 'top',
      })
      throw err
    } finally {
      loading.value.actions = false
    }
  }

  const deleteVisit = async (visit) => {
    try {
      loading.value.actions = true

      logger.info('Deleting visit', { visitId: visit.id })

      const visitRepo = dbStore.getRepository('visit')
      await visitRepo.delete(visit.id)

      visits.value = visits.value.filter((v) => v.id !== visit.id)

      // Clear selected visit if it was deleted
      if (selectedVisit.value?.id === visit.id) {
        selectedVisit.value = null
        observations.value = []
      }

      logger.success('Visit deleted successfully', { visitId: visit.id })

      $q.notify({
        type: 'positive',
        message: 'Visit deleted successfully',
        position: 'top',
      })
    } catch (err) {
      logger.error('Failed to delete visit', err)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete visit',
        position: 'top',
      })
      throw err
    } finally {
      loading.value.actions = false
    }
  }

  // Load all observations for a patient (across all visits)
  const loadAllObservationsForPatient = async (patientNum) => {
    if (!patientNum) {
      allObservations.value = []
      return
    }

    try {
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
      `

      const result = await dbStore.executeQuery(query, [patientNum])

      if (result.success) {
        allObservations.value = result.data.map((obs) => {
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
          }

          // Process different value types
          switch (obs.VALTYPE_CD) {
            case 'S': // Selection
            case 'F': // Finding
            case 'A': // Array/Multiple choice
              processedObs.displayValue = obs.TVAL_RESOLVED || obs.TVAL_CHAR || 'No value'
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
        })

        logger.success('All observations loaded successfully', {
          patientNum,
          observationCount: allObservations.value.length,
        })
      } else {
        throw new Error('Failed to load all observations')
      }
    } catch (err) {
      logger.error('Failed to load all observations', err, { patientNum })
      allObservations.value = []
    }
  }

  // Actions - Observation Management
  const updateObservation = async (observationId, updateData) => {
    try {
      logger.info('Updating observation', { observationId })

      const observationRepo = dbStore.getRepository('observation')
      await observationRepo.updateObservation(observationId, updateData)

      // Reload observations for current visit
      if (selectedVisit.value) {
        await loadObservationsForVisit(selectedVisit.value)
      }

      // Also reload all observations for the patient
      if (selectedPatient.value) {
        const patientRepo = dbStore.getRepository('patient')
        const patientData = await patientRepo.findByPatientCode(selectedPatient.value.id)
        if (patientData) {
          await loadAllObservationsForPatient(patientData.PATIENT_NUM)
        }
      }

      logger.success('Observation updated successfully', { observationId })
    } catch (err) {
      logger.error('Failed to update observation', err)
      throw err
    }
  }

  const createObservation = async (observationData) => {
    try {
      logger.info('Creating observation', { visitId: selectedVisit.value?.id })

      const observationRepo = dbStore.getRepository('observation')
      const newObservation = await observationRepo.createObservation(observationData)

      // Reload observations for current visit
      if (selectedVisit.value) {
        await loadObservationsForVisit(selectedVisit.value)

        // Update visit observation count
        const visitIndex = visits.value.findIndex((v) => v.id === selectedVisit.value.id)
        if (visitIndex !== -1) {
          visits.value[visitIndex].observationCount = observations.value.length
        }
      }

      // Also reload all observations for the patient
      if (selectedPatient.value) {
        const patientRepo = dbStore.getRepository('patient')
        const patientData = await patientRepo.findByPatientCode(selectedPatient.value.id)
        if (patientData) {
          await loadAllObservationsForPatient(patientData.PATIENT_NUM)
        }
      }

      logger.success('Observation created successfully')
      return newObservation
    } catch (err) {
      logger.error('Failed to create observation', err)
      throw err
    }
  }

  // Helper Functions
  const getObservationCount = async (encounterNum) => {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM OBSERVATION_FACT
        WHERE ENCOUNTER_NUM = ?
      `
      const result = await dbStore.executeQuery(query, [encounterNum])
      return result.success && result.data.length > 0 ? result.data[0].count : 0
    } catch (error) {
      logger.warn('Failed to get observation count', error)
      return 0
    }
  }

  const parseVisitNotes = (visitBlob) => {
    try {
      const parsed = JSON.parse(visitBlob)
      return parsed.notes || parsed.description || ''
    } catch {
      // JSON parse error - intentionally ignored
      return visitBlob || ''
    }
  }

  const formatVisitDate = (dateStr) => {
    return formatDate(dateStr)
  }

  const getFieldSetObservations = (fieldSetId, fieldSets) => {
    if (!fieldSetId) {
      console.warn('getFieldSetObservations called with undefined/null fieldSetId')
      return []
    }

    const fieldSet = fieldSets.find((fs) => fs.id === fieldSetId)
    if (!fieldSet) {
      console.log(
        'Field set not found for id:',
        fieldSetId,
        'Available field sets:',
        fieldSets.map((fs) => fs.id),
      )
      return []
    }

    logger.debug('getFieldSetObservations', {
      fieldSetId,
      selectedVisitId: selectedVisit.value?.id,
      observationsCount: observations.value.length,
      fieldSetConcepts: fieldSet.concepts,
    })

    const filtered = observations.value.filter((obs) => {
      return fieldSet.concepts.some((concept) => {
        // Try multiple matching strategies:
        // 1. Exact match
        if (obs.conceptCode === concept) return true

        // 2. Extract the numeric code from both sides and compare
        // Handle formats like "LOINC:8480-6" vs "LID: 8480-6"
        const conceptMatch = concept.match(/[:\s]([0-9-]+)$/)
        const obsMatch = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
        if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) {
          return true
        }

        // 3. Full concept code includes the database concept code
        if (concept.includes(obs.conceptCode)) return true

        // 4. Database concept code includes the full concept
        if (obs.conceptCode.includes(concept)) return true

        // 5. Match just the code part (after the colon)
        const [, code] = concept.split(':')
        if (code && obs.conceptCode.includes(code)) return true

        // 6. Case-insensitive match
        if (obs.conceptCode.toLowerCase().includes(concept.toLowerCase())) return true

        return false
      })
    })

    logger.debug('Filtered observations', {
      fieldSetId,
      filteredCount: filtered.length,
    })

    return filtered
  }

  // Initialize method
  const initialize = () => {
    logger.info('Visit Observation Store initialized')
  }

  return {
    // State
    selectedPatient,
    selectedVisit,
    visits,
    observations,
    allObservations,
    loading,
    error,

    // Getters
    sortedVisits,
    visitOptions,
    previousVisits,
    categorizedObservations,
    hasData,

    // Actions - Patient
    setSelectedPatient,
    clearPatient,

    // Actions - Visits
    loadVisitsForPatient,
    setSelectedVisit,
    createVisit,
    duplicateVisit,
    deleteVisit,

    // Actions - Observations
    loadObservationsForVisit,
    loadAllObservationsForPatient,
    updateObservation,
    createObservation,

    // Helper Functions
    formatVisitDate,
    getFieldSetObservations,

    // Initialize
    initialize,
  }
})
