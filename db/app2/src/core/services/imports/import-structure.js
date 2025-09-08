/**
 * Import Structure Module
 *
 * Defines the standard import structure format used across all import services.
 * Inspired by the JSON export format from 02_json.json.
 */

/**
 * Get the standard import structure template
 * @returns {Object} Standard import structure
 */
export function getImportStructure() {
  return {
    metadata: {
      title: null,
      exportDate: null,
      format: null,
      source: null,
      version: null,
      author: null,
      patientCount: 0,
      visitCount: 0,
      observationCount: 0,
      patientIds: [],
      options: {
        includeVisits: true,
        includeObservations: true,
        includeNotes: false,
      },
    },
    exportInfo: {
      format: null,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      source: 'Import Service',
    },
    data: {
      patients: [],
      visits: [],
      observations: [],
    },
    statistics: {
      patientCount: 0,
      visitCount: 0,
      observationCount: 0,
      fetchedAt: new Date().toISOString(),
    },
  }
}

/**
 * Create a new import structure instance
 * @param {Object} overrides - Properties to override in the structure
 * @returns {Object} New import structure instance
 */
export function createImportStructure(overrides = {}) {
  const structure = JSON.parse(JSON.stringify(getImportStructure())) // Deep copy

  // Apply overrides
  if (overrides.metadata) {
    Object.assign(structure.metadata, overrides.metadata)
  }
  if (overrides.exportInfo) {
    Object.assign(structure.exportInfo, overrides.exportInfo)
  }
  if (overrides.data) {
    Object.assign(structure.data, overrides.data)
  }

  // Update statistics based on data
  if (structure.data.patients) {
    structure.statistics.patientCount = structure.data.patients.length
    structure.metadata.patientCount = structure.data.patients.length
    structure.metadata.patientIds = structure.data.patients.map((p) => p.PATIENT_CD || p.id)
  }
  if (structure.data.visits) {
    structure.statistics.visitCount = structure.data.visits.length
    structure.metadata.visitCount = structure.data.visits.length
  }
  if (structure.data.observations) {
    structure.statistics.observationCount = structure.data.observations.length
    structure.metadata.observationCount = structure.data.observations.length
  }

  return structure
}
