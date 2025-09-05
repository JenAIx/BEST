/**
 * Visit & Observation Service
 *
 * Coordinates operations between patient, visit, and observation stores.
 * Handles complex business logic that spans multiple stores.
 * Part of the MVC refactoring to separate business logic from state management.
 */

import { usePatientStore } from 'src/stores/patient-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useQuasar } from 'quasar'
import { prepareVisitClone } from 'src/utils/visit-transformer'

class VisitObservationService {
  constructor() {
    this.logger = useLoggingStore().createLogger('VisitObservationService')
    this.$q = null // Will be set when needed
  }

  /**
   * Initialize the service with Quasar instance
   */
  initialize() {
    this.$q = useQuasar()
  }

  /**
   * Load patient with visits and observations
   * @param {string} patientCode - Patient code
   * @returns {Promise<Object>} Patient data with loaded visits
   */
  async loadPatientWithData(patientCode) {
    try {
      const patientStore = usePatientStore()
      const visitStore = useVisitStore()
      const observationStore = useObservationStore()

      this.logger.info('Loading patient with data', { patientCode })

      // Load patient
      const result = await patientStore.loadPatientByCode(patientCode)
      if (!result) {
        throw new Error('Patient not found')
      }

      const { patient, isNewPatient } = result

      // Only load visits if it's a new patient selection
      if (isNewPatient) {
        // Clear previous data
        visitStore.clearVisits()
        observationStore.clearAllObservations()

        // Load visits for the patient
        await visitStore.loadVisitsForPatient(patient.PATIENT_NUM)

        // Load all observations for the patient
        await observationStore.loadAllObservationsForPatient(patient.PATIENT_NUM)
      }

      this.logger.success('Patient data loaded successfully', {
        patientCode,
        patientName: patient.name,
        visitCount: visitStore.visits.length,
        observationCount: observationStore.allObservations.length,
      })

      return patient
    } catch (error) {
      this.logger.error('Failed to load patient with data', error)
      throw error
    }
  }

  /**
   * Select a visit and load its observations
   * @param {Object} visit - Visit object
   * @returns {Promise<void>}
   */
  async selectVisitAndLoadObservations(visit) {
    try {
      const visitStore = useVisitStore()
      const observationStore = useObservationStore()

      this.logger.info('Selecting visit and loading observations', { visitId: visit?.id })

      // Set selected visit
      visitStore.setSelectedVisit(visit)

      if (visit) {
        // Load observations for the visit
        await observationStore.loadObservationsForVisit(visit.id)
      } else {
        // Clear observations if no visit selected
        observationStore.clearObservations()
      }

      this.logger.success('Visit selected and observations loaded', {
        visitId: visit?.id,
        observationCount: observationStore.observations.length,
      })
    } catch (error) {
      this.logger.error('Failed to select visit', error)
      throw error
    }
  }

  /**
   * Create a new visit for the current patient
   * @param {Object} visitData - Visit form data
   * @returns {Promise<Object>} Created visit
   */
  async createVisit(visitData) {
    try {
      const patientStore = usePatientStore()
      const visitStore = useVisitStore()

      if (!patientStore.hasPatient) {
        throw new Error('No patient selected')
      }

      this.logger.info('Creating new visit', {
        patientId: patientStore.patientId,
      })

      // Create the visit
      const newVisit = await visitStore.createVisit(patientStore.patientNum, visitData)

      this.showSuccessNotification('Visit created successfully')

      return newVisit
    } catch (error) {
      this.logger.error('Failed to create visit', error)
      this.showErrorNotification('Failed to create visit')
      throw error
    }
  }

  /**
   * Duplicate a visit with all its observations
   * @param {Object} originalVisit - Visit to duplicate
   * @returns {Promise<Object>} Created visit
   */
  async duplicateVisit(originalVisit) {
    try {
      const patientStore = usePatientStore()
      const visitStore = useVisitStore()
      const observationStore = useObservationStore()
      const dbStore = useDatabaseStore()
      const authStore = useAuthStore()

      if (!patientStore.hasPatient) {
        throw new Error('No patient selected')
      }

      this.logger.info('Duplicating visit', {
        originalVisitId: originalVisit.id,
      })

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

      // Create new visit
      const providerId = authStore.currentUser?.USER_CD || 'SYSTEM'
      const newVisitData = prepareVisitClone(originalVisit, patientStore.patientNum, providerId)

      const visitRepo = dbStore.getRepository('visit')
      const createdVisit = await visitRepo.createVisit(newVisitData)

      // Clone observations
      const observationRepo = dbStore.getRepository('observation')
      let clonedCount = 0

      for (const obs of observations) {
        try {
          const conceptMetadata = await observationStore.getConceptMetadata(obs.CONCEPT_CD)

          const newObsData = {
            PATIENT_NUM: obs.PATIENT_NUM,
            ENCOUNTER_NUM: createdVisit.ENCOUNTER_NUM,
            CONCEPT_CD: obs.CONCEPT_CD,
            VALTYPE_CD: obs.VALTYPE_CD,
            TVAL_CHAR: obs.TVAL_CHAR,
            NVAL_NUM: obs.NVAL_NUM,
            UNIT_CD: obs.UNIT_CD,
            START_DATE: new Date().toISOString().split('T')[0],
            CATEGORY_CHAR: conceptMetadata.categoryCd,
            PROVIDER_ID: providerId,
            LOCATION_CD: 'CLONED',
            SOURCESYSTEM_CD: conceptMetadata.sourceSystemCd,
            INSTANCE_NUM: 1,
            UPLOAD_ID: 1,
          }

          await observationRepo.createObservation(newObsData)
          clonedCount++
        } catch (error) {
          this.logger.warn('Failed to clone observation', error)
        }
      }

      // Transform and add to store
      const newVisit = visitStore.transformVisit(createdVisit, clonedCount)
      visitStore.visits.unshift(newVisit)

      // Reload all observations for the patient
      await observationStore.loadAllObservationsForPatient(patientStore.patientNum)

      this.showSuccessNotification(`Visit cloned successfully with ${clonedCount} observations`)

      this.logger.success('Visit cloned successfully', {
        originalVisitId: originalVisit.id,
        newVisitId: newVisit.id,
        clonedCount,
      })

      return newVisit
    } catch (error) {
      this.logger.error('Failed to duplicate visit', error)
      this.showErrorNotification('Failed to clone visit')
      throw error
    }
  }

  /**
   * Delete a visit and all its observations
   * @param {Object} visit - Visit to delete
   * @returns {Promise<void>}
   */
  async deleteVisit(visit) {
    try {
      const visitStore = useVisitStore()
      const patientStore = usePatientStore()
      const observationStore = useObservationStore()

      this.logger.info('Deleting visit', { visitId: visit.id })

      // Delete the visit (cascade will handle observations)
      await visitStore.deleteVisit(visit.id)

      // Reload all observations for the patient
      if (patientStore.hasPatient) {
        await observationStore.loadAllObservationsForPatient(patientStore.patientNum)
      }

      this.showSuccessNotification('Visit deleted successfully')

      this.logger.success('Visit deleted successfully', { visitId: visit.id })
    } catch (error) {
      this.logger.error('Failed to delete visit', error)
      this.showErrorNotification('Failed to delete visit')
      throw error
    }
  }

  /**
   * Create an observation for the current visit
   * @param {Object} observationData - Observation data
   * @returns {Promise<Object>} Created observation
   */
  async createObservation(observationData) {
    try {
      const patientStore = usePatientStore()
      const visitStore = useVisitStore()
      const observationStore = useObservationStore()

      if (!patientStore.hasPatient) {
        throw new Error('No patient selected')
      }

      // Ensure patient number is included
      observationData.PATIENT_NUM = patientStore.patientNum

      this.logger.info('Creating observation', {
        conceptCode: observationData.CONCEPT_CD,
        visitId: observationData.ENCOUNTER_NUM,
      })

      // Create the observation
      const newObservation = await observationStore.createObservation(observationData)

      // Reload observations for the visit
      if (visitStore.selectedVisitId) {
        await observationStore.loadObservationsForVisit(visitStore.selectedVisitId)

        // Update visit observation count
        visitStore.updateVisitObservationCount(visitStore.selectedVisitId, observationStore.observationCount)
      }

      // Reload all observations for the patient
      await observationStore.loadAllObservationsForPatient(patientStore.patientNum)

      this.logger.success('Observation created successfully', {
        observationId: newObservation?.OBSERVATION_ID,
      })

      return newObservation
    } catch (error) {
      this.logger.error('Failed to create observation', error)
      throw error
    }
  }

  /**
   * Update an observation
   * @param {number} observationId - Observation ID
   * @param {Object} updateData - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated observation
   */
  async updateObservation(observationId, updateData, options = {}) {
    try {
      const patientStore = usePatientStore()
      const visitStore = useVisitStore()
      const observationStore = useObservationStore()

      this.logger.info('Updating observation', { observationId, updateData })

      // Update the observation
      const result = await observationStore.updateObservation(observationId, updateData)

      // Reload data unless skipped
      if (!options.skipReload) {
        // Reload observations for current visit
        if (visitStore.selectedVisitId) {
          await observationStore.loadObservationsForVisit(visitStore.selectedVisitId)
        }

        // Reload all observations for the patient
        if (patientStore.hasPatient) {
          await observationStore.loadAllObservationsForPatient(patientStore.patientNum)
        }
      }

      this.logger.success('Observation updated successfully', { observationId })
      return result
    } catch (error) {
      this.logger.error('Failed to update observation', error)
      throw error
    }
  }

  /**
   * Delete an observation
   * @param {number} observationId - Observation ID
   * @returns {Promise<void>}
   */
  async deleteObservation(observationId) {
    try {
      const patientStore = usePatientStore()
      const visitStore = useVisitStore()
      const observationStore = useObservationStore()

      this.logger.info('Deleting observation', { observationId })

      // Delete the observation
      await observationStore.deleteObservation(observationId)

      // Reload observations for the visit
      if (visitStore.selectedVisitId) {
        await observationStore.loadObservationsForVisit(visitStore.selectedVisitId)

        // Update visit observation count
        visitStore.updateVisitObservationCount(visitStore.selectedVisitId, observationStore.observationCount)
      }

      // Reload all observations for the patient
      if (patientStore.hasPatient) {
        await observationStore.loadAllObservationsForPatient(patientStore.patientNum)
      }

      this.showSuccessNotification('Observation removed successfully')

      this.logger.success('Observation deleted successfully', { observationId })
    } catch (error) {
      this.logger.error('Failed to delete observation', error)
      this.showErrorNotification('Failed to remove observation')
      throw error
    }
  }

  /**
   * Clear all data (patient, visits, observations)
   */
  clearAllData() {
    const patientStore = usePatientStore()
    const visitStore = useVisitStore()
    const observationStore = useObservationStore()

    this.logger.info('Clearing all data')

    patientStore.clearPatient()
    visitStore.clearVisits()
    observationStore.clearAllObservations()
  }

  /**
   * Get previous visits for the current patient
   * @returns {Array} Previous visits sorted by date
   */
  getPreviousVisits() {
    const visitStore = useVisitStore()

    if (!visitStore.selectedVisit) return []

    return visitStore.visits.filter((v) => v.id !== visitStore.selectedVisit.id && new Date(v.date) < new Date(visitStore.selectedVisit.date)).sort((a, b) => new Date(b.date) - new Date(a.date))
  }

  // Helper methods for notifications
  showSuccessNotification(message) {
    if (this.$q) {
      this.$q.notify({
        type: 'positive',
        message,
        position: 'top',
      })
    }
  }

  showErrorNotification(message) {
    if (this.$q) {
      this.$q.notify({
        type: 'negative',
        message,
        position: 'top',
      })
    }
  }
}

// Export singleton instance
export const visitObservationService = new VisitObservationService()
