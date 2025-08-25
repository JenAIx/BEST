/**
 * Delete Demo Patients Service
 *
 * Service for cleaning up demo patients and all related data (visits, observations, concepts).
 * Handles proper deletion order to respect foreign key constraints.
 */

/**
 * Delete all demo patients and related data using cascade deletion
 * @param {Object} repositories - Object containing repository instances
 * @returns {Promise<Object>} Deletion results
 */
export async function deleteDemoPatients(repositories) {
  const { patientRepository, visitRepository, observationRepository } = repositories

  const results = {
    deletedPatients: 0,
    deletedVisits: 0,
    deletedObservations: 0,
    deletedConcepts: 0,
    errors: [],
  }

  try {
    // Count data before deletion for reporting
    const demoPatients = await patientRepository.findBySourceSystem('DEMO')
    const demoVisits = await visitRepository.findBySourceSystem('DEMO')
    const demoObservations = await observationRepository.findBySourceSystem('DEMO')

    // With foreign key cascade deletion enabled, we only need to delete patients
    // The database will automatically cascade delete visits and observations
    for (const patient of demoPatients) {
      try {
        await patientRepository.delete(patient.PATIENT_NUM)
        results.deletedPatients++
      } catch (error) {
        results.errors.push(`Failed to delete patient ${patient.PATIENT_CD}: ${error.message}`)
      }
    }

    // Report the counts that would have been deleted by cascade
    results.deletedVisits = demoVisits.length
    results.deletedObservations = demoObservations.length

    // Note: We intentionally do NOT delete concepts from CONCEPT_DIMENSION
    // as they are reference data that should persist across demo data resets
  } catch (error) {
    results.errors.push(`General cleanup error: ${error.message}`)
  }

  return results
}

/**
 * Delete demo patients by patient codes
 * @param {Object} repositories - Object containing repository instances
 * @param {Array<string>} patientCodes - Array of patient codes to delete (e.g., ['DEMO_PATIENT_01'])
 * @returns {Promise<Object>} Deletion results
 */
export async function deleteDemoPatientsByCode(repositories, patientCodes) {
  const { patientRepository, visitRepository, observationRepository } = repositories

  const results = {
    deletedPatients: 0,
    deletedVisits: 0,
    deletedObservations: 0,
    errors: [],
  }

  try {
    for (const patientCode of patientCodes) {
      try {
        // Find the patient
        const patient = await patientRepository.findByPatientCode(patientCode)
        if (!patient) {
          results.errors.push(`Patient with code ${patientCode} not found`)
          continue
        }

        // Count related data before deletion for reporting
        const patientObservations = await observationRepository.findByPatientNum(
          patient.PATIENT_NUM,
        )
        const patientVisits = await visitRepository.findByPatientNum(patient.PATIENT_NUM)

        // With foreign key cascade deletion enabled, we only need to delete the patient
        // The database will automatically cascade delete visits and observations
        await patientRepository.delete(patient.PATIENT_NUM)
        results.deletedPatients++

        // Report the counts that would have been deleted by cascade
        results.deletedVisits += patientVisits.length
        results.deletedObservations += patientObservations.length
      } catch (error) {
        results.errors.push(`Failed to delete patient ${patientCode}: ${error.message}`)
      }
    }
  } catch (error) {
    results.errors.push(`General deletion error: ${error.message}`)
  }

  return results
}

/**
 * Count demo data in the database
 * @param {Object} repositories - Object containing repository instances
 * @returns {Promise<Object>} Count results
 */
export async function countDemoData(repositories) {
  const { patientRepository, visitRepository, observationRepository } = repositories

  try {
    const [demoPatients, demoVisits, demoObservations] = await Promise.all([
      patientRepository.findBySourceSystem('DEMO'),
      visitRepository.findBySourceSystem('DEMO'),
      observationRepository.findBySourceSystem('DEMO'),
    ])

    return {
      patients: demoPatients.length,
      visits: demoVisits.length,
      observations: demoObservations.length,
      concepts: 0, // Don't count concepts - we won't delete them
      totalRecords: demoPatients.length + demoVisits.length + demoObservations.length,
    }
  } catch (error) {
    return {
      patients: 0,
      visits: 0,
      observations: 0,
      concepts: 0,
      totalRecords: 0,
      error: error.message,
    }
  }
}
