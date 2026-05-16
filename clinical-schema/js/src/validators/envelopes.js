import { makeResult, err, warn } from './result.js'
import { validateRecords } from './records.js'

/**
 * Validate a simple-JSON envelope.
 *   { metadata, exportInfo, data: { patients, visits, observations }, statistics }
 */
export function validateSimpleJsonEnvelope(envelope) {
  const errors = []
  const warnings = []
  if (!envelope || typeof envelope !== 'object') {
    return makeResult([err('INVALID_ENVELOPE', 'Envelope must be an object')])
  }
  if (!envelope.metadata) warnings.push(warn('MISSING_METADATA', 'Envelope has no metadata'))
  if (!envelope.data) {
    errors.push(err('MISSING_DATA', 'Envelope must contain data'))
    return makeResult(errors, warnings)
  }
  const data = envelope.data
  if (!data.patients && !data.visits && !data.observations) {
    errors.push(err('EMPTY_DATA', 'data must contain at least one of patients/visits/observations'))
  }
  if (data.patients && !Array.isArray(data.patients))     errors.push(err('PATIENTS_NOT_ARRAY', 'data.patients must be an array'))
  if (data.visits && !Array.isArray(data.visits))         errors.push(err('VISITS_NOT_ARRAY', 'data.visits must be an array'))
  if (data.observations && !Array.isArray(data.observations)) errors.push(err('OBSERVATIONS_NOT_ARRAY', 'data.observations must be an array'))

  if (errors.length === 0) {
    const r = validateRecords({
      patients: data.patients || [],
      visits: data.visits || [],
      observations: data.observations || [],
    })
    errors.push(...r.errors); warnings.push(...r.warnings)
  }

  return makeResult(errors, warnings)
}

/**
 * Validate an HL7 FHIR Composition envelope.
 *   { cda: { resourceType: 'Composition', section: [...] }, hash?, generator? }
 */
export function validateHl7CompositionEnvelope(envelope) {
  const errors = []
  const warnings = []
  if (!envelope || typeof envelope !== 'object') {
    return makeResult([err('INVALID_ENVELOPE', 'Envelope must be an object')])
  }
  // Allow either { cda: { ... } } or directly the Composition resource
  const cda = envelope.resourceType === 'Composition' ? envelope : envelope.cda
  if (!cda) {
    return makeResult([err('MISSING_CDA', 'Envelope has no .cda Composition')])
  }
  if (cda.resourceType !== 'Composition') {
    errors.push(err('INVALID_RESOURCE_TYPE', 'Expected resourceType="Composition"'))
  }
  if (!Array.isArray(cda.section)) {
    errors.push(err('MISSING_SECTIONS', 'Composition.section must be an array'))
  }
  if (!cda.title)  warnings.push(warn('MISSING_TITLE', 'Composition.title is empty'))
  if (!cda.date)   warnings.push(warn('MISSING_DATE', 'Composition.date is empty'))
  if (!cda.status) warnings.push(warn('MISSING_STATUS', 'Composition.status is empty'))
  return makeResult(errors, warnings)
}

/**
 * Auto-detect the envelope kind and validate.
 */
export function validateEnvelope(envelope) {
  if (envelope && (envelope.resourceType === 'Composition' || envelope.cda?.resourceType === 'Composition')) {
    return validateHl7CompositionEnvelope(envelope)
  }
  return validateSimpleJsonEnvelope(envelope)
}
