import { SCHEMA_VERSION, TEMPLATE_VERSION, DBBEST_MIN_VERSION } from '../version.js'
import { isoNow } from '../builders/util.js'

/**
 * Wrap records into the dbBEST simple-JSON export envelope.
 *
 * Shape: { metadata, exportInfo, data, statistics }
 * Consumed by dbBEST `ImportJsonService`.
 */
export function buildSimpleJsonExport({
  patients = [],
  visits = [],
  observations = [],
  metadata = {},
} = {}) {
  const now = isoNow()
  const patientIds = patients.map((p) => p.PATIENT_CD).filter(Boolean)

  return {
    metadata: {
      title: metadata.title || 'Patient Data Export - JSON',
      exportDate: metadata.exportDate || now,
      format: 'json',
      source: metadata.source || 'External System',
      version: metadata.version || SCHEMA_VERSION,
      author: metadata.author || 'Export Template',
      patientCount: patients.length,
      patientIds,
      options: {
        includeVisits: visits.length > 0,
        includeObservations: observations.length > 0,
        includeNotes: false,
        ...(metadata.options || {}),
      },
      generator: {
        templateVersion: TEMPLATE_VERSION,
        schemaVersion: SCHEMA_VERSION,
        targetApp: 'dbBEST',
        targetMinVersion: DBBEST_MIN_VERSION,
      },
    },
    exportInfo: {
      format: 'json',
      version: SCHEMA_VERSION,
      exportedAt: now,
      source: metadata.source || 'External System',
      templateVersion: TEMPLATE_VERSION,
    },
    data: { patients, visits, observations },
    statistics: {
      patientCount: patients.length,
      visitCount: visits.length,
      observationCount: observations.length,
      fetchedAt: now,
    },
  }
}
