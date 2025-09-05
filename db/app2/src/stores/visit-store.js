/**
 * Visit Store
 *
 * Manages visits state and operations.
 * Part of the MVC refactoring to separate concerns.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useLoggingStore } from './logging-store'
import { useAuthStore } from './auth-store'
import { formatDate, getVisitTypeLabel } from 'src/shared/utils/medical-utils'

export const useVisitStore = defineStore('visit', () => {
  const dbStore = useDatabaseStore()
  const authStore = useAuthStore()
  const logger = useLoggingStore().createLogger('VisitStore')

  // State
  const visits = ref([])
  const selectedVisit = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const hasVisits = computed(() => visits.value.length > 0)

  const selectedVisitId = computed(() => selectedVisit.value?.id)

  const sortedVisits = computed(() => {
    return [...visits.value].sort((a, b) => new Date(b.date) - new Date(a.date))
  })

  const visitOptions = computed(() => {
    if (!visits.value || visits.value.length === 0) {
      return []
    }

    return visits.value.map((visit) => ({
      id: visit.id,
      label: formatDate(visit.date),
      summary: `${getVisitTypeLabel(visit.type || visit.visitType)} • ${visit.observationCount || 0} observations`,
      value: visit,
    }))
  })

  // Actions
  const setSelectedVisit = (visit) => {
    if (!visit) {
      selectedVisit.value = null
      return
    }

    logger.info('Setting selected visit', { visitId: visit.id })

    // Ensure we're using the visit object from our store
    const storeVisit = visits.value.find((v) => v.id === visit.id)
    if (storeVisit) {
      selectedVisit.value = storeVisit
    } else {
      logger.warn('Visit not found in store', { visitId: visit.id })
      selectedVisit.value = visit
    }
  }

  const clearSelectedVisit = () => {
    selectedVisit.value = null
  }

  const clearVisits = () => {
    visits.value = []
    selectedVisit.value = null
    error.value = null
  }

  const loadVisitsForPatient = async (patientNum) => {
    if (!patientNum) {
      logger.warn('loadVisitsForPatient called without patientNum')
      return []
    }

    try {
      loading.value = true
      error.value = null

      logger.info('Loading visits for patient', { patientNum })

      const visitRepo = dbStore.getRepository('visit')
      const patientVisits = await visitRepo.getPatientVisitTimeline(patientNum)

      logger.debug('Raw patient visits from database', {
        patientNum,
        visitCount: patientVisits.length,
      })

      // Transform visits for store
      const transformedVisits = await Promise.all(
        patientVisits.map(async (visit) => {
          const observationCount = await getObservationCount(visit.ENCOUNTER_NUM)
          return transformVisit(visit, observationCount)
        }),
      )

      visits.value = transformedVisits

      logger.success('Visits loaded successfully', {
        patientNum,
        visitCount: transformedVisits.length,
      })

      return transformedVisits
    } catch (err) {
      logger.error('Failed to load visits', err, { patientNum })
      error.value = err.message
      visits.value = []
      throw err
    } finally {
      loading.value = false
    }
  }

  const createVisit = async (patientNum, visitData) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Creating new visit', { patientNum })

      const visitRepo = dbStore.getRepository('visit')
      const currentTimestamp = new Date().toISOString()

      const newVisitData = {
        PATIENT_NUM: patientNum,
        START_DATE: visitData.date || new Date().toISOString().split('T')[0],
        END_DATE: visitData.endDate || null,
        UPDATE_DATE: currentTimestamp,
        INOUT_CD: visitData.inout || (visitData.type === 'emergency' ? 'E' : 'O'),
        ACTIVE_STATUS_CD: visitData.status || 'SCTID: 55561003', // Active (SNOMED-CT)
        LOCATION_CD: visitData.location || 'CLINIC',
        SOURCESYSTEM_CD: 'SYSTEM',
        VISIT_BLOB: JSON.stringify({
          notes: visitData.notes || '',
          visitType: visitData.visitType || visitData.type || 'routine',
          createdBy: authStore.currentUser?.USER_CD || 'SYSTEM',
          createdAt: currentTimestamp,
          updatedAt: currentTimestamp,
        }),
      }

      const createdVisit = await visitRepo.createVisit(newVisitData)
      const newVisit = transformVisit(createdVisit, 0)

      // Add to store
      visits.value.unshift(newVisit)

      logger.success('Visit created successfully', { visitId: newVisit.id })
      return newVisit
    } catch (err) {
      logger.error('Failed to create visit', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateVisit = async (visitId, updateData) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Updating visit', { visitId, updateData })

      const visitRepo = dbStore.getRepository('visit')
      const result = await visitRepo.updateVisit(visitId, updateData)

      // Update local state
      const visitIndex = visits.value.findIndex((v) => v.id === visitId)
      if (visitIndex !== -1) {
        // Get current observation count
        const observationCount = visits.value[visitIndex].observationCount
        visits.value[visitIndex] = transformVisit(result, observationCount)
      }

      logger.success('Visit updated successfully', { visitId })
      return result
    } catch (err) {
      logger.error('Failed to update visit', err, { visitId })
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteVisit = async (visitId) => {
    try {
      loading.value = true
      error.value = null

      logger.info('Deleting visit', { visitId })

      const visitRepo = dbStore.getRepository('visit')
      await visitRepo.delete(visitId)

      // Remove from local state
      visits.value = visits.value.filter((v) => v.id !== visitId)

      // Clear selected visit if it was deleted
      if (selectedVisit.value?.id === visitId) {
        selectedVisit.value = null
      }

      logger.success('Visit deleted successfully', { visitId })
    } catch (err) {
      logger.error('Failed to delete visit', err, { visitId })
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateVisitObservationCount = (visitId, count) => {
    const visitIndex = visits.value.findIndex((v) => v.id === visitId)
    if (visitIndex !== -1) {
      visits.value[visitIndex].observationCount = count
    }
  }

  // Helper functions
  const transformVisit = (dbVisit, observationCount = 0) => {
    // Parse VISIT_BLOB to extract visitType and notes
    let visitType = 'routine'
    let visitNotes = ''
    if (dbVisit.VISIT_BLOB) {
      try {
        const blobData = JSON.parse(dbVisit.VISIT_BLOB)
        visitType = blobData.visitType || 'routine'
        visitNotes = blobData.notes || ''
      } catch (error) {
        logger.warn('Failed to parse VISIT_BLOB', error)
        visitNotes = dbVisit.VISIT_BLOB // Fallback to raw blob
      }
    }

    return {
      id: dbVisit.ENCOUNTER_NUM,
      date: dbVisit.START_DATE,
      last_changed: dbVisit.UPDATE_DATE,
      endDate: dbVisit.END_DATE,
      inout: dbVisit.INOUT_CD || 'O',
      location: dbVisit.LOCATION_CD,
      status: dbVisit.ACTIVE_STATUS_CD || 'completed',
      visitType: visitType,
      notes: visitNotes,
      observationCount,
      // Include raw data for components that need it
      rawData: {
        ENCOUNTER_NUM: dbVisit.ENCOUNTER_NUM,
        START_DATE: dbVisit.START_DATE,
        END_DATE: dbVisit.END_DATE,
        UPDATE_DATE: dbVisit.UPDATE_DATE,
        ACTIVE_STATUS_CD: dbVisit.ACTIVE_STATUS_CD,
        LOCATION_CD: dbVisit.LOCATION_CD,
        INOUT_CD: dbVisit.INOUT_CD,
        SOURCESYSTEM_CD: dbVisit.SOURCESYSTEM_CD,
        VISIT_BLOB: dbVisit.VISIT_BLOB,
      },
    }
  }

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

  return {
    // State
    visits,
    selectedVisit,
    loading,
    error,

    // Getters
    hasVisits,
    selectedVisitId,
    sortedVisits,
    visitOptions,

    // Actions
    setSelectedVisit,
    clearSelectedVisit,
    clearVisits,
    loadVisitsForPatient,
    createVisit,
    updateVisit,
    deleteVisit,
    updateVisitObservationCount,

    // Helpers
    transformVisit,
    getObservationCount,
  }
})
