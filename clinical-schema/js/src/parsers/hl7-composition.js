import { VALTYPE, VITAL_STATUS, ACTIVE_STATUS, INOUT } from '../constants.js'
import { isoNow, isoDate } from '../builders/util.js'

/**
 * Parse an HL7 FHIR Composition envelope into normalized record arrays.
 *
 * Accepts either { cda: { resourceType: 'Composition', section: [...] } }
 * or a bare Composition resource.
 *
 * Behavior matches dbBEST `ImportHl7Service.extract*` (src/core/services/
 * imports/import-hl7-service.js, lines 140–394).
 */
export function parseHl7Composition(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('parseHl7Composition: envelope must be an object')
  }
  const cda = envelope.resourceType === 'Composition' ? envelope : envelope.cda
  if (!cda || cda.resourceType !== 'Composition') {
    throw new Error('parseHl7Composition: expected resourceType="Composition"')
  }
  if (!Array.isArray(cda.section)) {
    throw new Error('parseHl7Composition: Composition.section must be an array')
  }
  return extractDataFromSections(cda.section)
}

function extractDataFromSections(sections) {
  const patients = []
  const visits = []
  const observations = []
  const patientMap = new Map()
  const visitMap = new Map()
  let patientCounter = 1
  let visitCounter = 1
  let observationCounter = 1

  for (const section of sections) {
    if (!Array.isArray(section.entry)) continue

    if (section.title === 'Patient Information') {
      extractPatientsFromSection(section.entry, patients, patientMap, patientCounter)
      patientCounter += section.entry.length
    } else if (section.title?.startsWith('Visit ')) {
      extractVisitFromSection(section, visits, visitMap, visitCounter, patientMap)
      visitCounter++
    } else {
      extractObservationsFromSection(section, observations, observationCounter, patientMap, visitMap)
      observationCounter += section.entry.length
    }
  }
  return { patients, visits, observations }
}

function extractPatientsFromSection(entries, patients, patientMap, startCounter) {
  let current = null
  let patientNum = startCounter
  for (const entry of entries) {
    if (entry.title?.startsWith('Patient: ')) {
      if (current) {
        patients.push(current)
        patientMap.set(current.PATIENT_CD, current)
      }
      current = {
        PATIENT_NUM: patientNum++,
        PATIENT_CD: entry.value,
        VITAL_STATUS_CD: VITAL_STATUS.ALIVE,
        BIRTH_DATE: null,
        DEATH_DATE: null,
        AGE_IN_YEARS: null,
        SEX_CD: null,
        LANGUAGE_CD: null,
        RACE_CD: null,
        MARITAL_STATUS_CD: null,
        RELIGION_CD: null,
        STATECITYZIP_PATH: null,
        PATIENT_BLOB: null,
        UPDATE_DATE: isoDate(),
        DOWNLOAD_DATE: null,
        IMPORT_DATE: isoNow(),
        SOURCESYSTEM_CD: 'HL7_IMPORT',
        UPLOAD_ID: 1,
        CREATED_AT: isoNow(),
        UPDATED_AT: isoNow(),
      }
    } else if (current && entry.title === 'Gender') {
      current.SEX_CD = entry.value
    } else if (current && entry.title === 'Age') {
      current.AGE_IN_YEARS = entry.value
    } else if (current && entry.title === 'Date of birth') {
      current.BIRTH_DATE = entry.value
    }
  }
  if (current) {
    patients.push(current)
    patientMap.set(current.PATIENT_CD, current)
  }
}

function extractVisitFromSection(section, visits, visitMap, visitNum, patientMap) {
  let visitDate = null
  let location = null
  for (const entry of section.entry) {
    if (entry.title === 'Visit Date') visitDate = entry.value
    else if (entry.title === 'Location') location = entry.value
  }
  // Heuristic patient assignment (mirrors dbBEST behavior): first 2 visits to first patient, rest to second
  const patientIds = Array.from(patientMap.keys())
  const patientId = patientIds[visitNum <= 2 ? 0 : 1] ?? patientIds[0]
  const patient = patientMap.get(patientId)
  if (!patient) return
  const visit = {
    ENCOUNTER_NUM: visitNum,
    PATIENT_NUM: patient.PATIENT_NUM,
    ACTIVE_STATUS_CD: ACTIVE_STATUS.ACTIVE,
    START_DATE: visitDate || isoDate(),
    END_DATE: null,
    INOUT_CD: determineVisitType(location),
    LOCATION_CD: location || 'HL7_IMPORT',
    VISIT_BLOB: null,
    UPDATE_DATE: null,
    DOWNLOAD_DATE: null,
    IMPORT_DATE: null,
    SOURCESYSTEM_CD: 'HL7_IMPORT',
    UPLOAD_ID: 1,
    CREATED_AT: isoDate(),
  }
  visits.push(visit)
  visitMap.set(visitNum, visit)
}

function extractObservationsFromSection(section, observations, startCounter, patientMap, visitMap) {
  let observationNum = startCounter
  for (const entry of section.entry) {
    if (entry.title === 'Visit Date' || entry.title === 'Location') continue
    let valtypeCd = VALTYPE.TEXT
    let tvalChar = null
    let nvalNum = null
    if (typeof entry.value === 'number') {
      valtypeCd = VALTYPE.NUMERIC
      nvalNum = entry.value
    } else if (typeof entry.value === 'string') {
      valtypeCd = VALTYPE.TEXT
      tvalChar = entry.value
    } else if (entry.value !== undefined && entry.value !== null) {
      valtypeCd = VALTYPE.TEXT
      tvalChar = String(entry.value)
    }
    const patientIds = Array.from(patientMap.keys())
    const patient = patientMap.get(patientIds[0])
    const visitIds = Array.from(visitMap.keys())
    const visitId = visitIds[0]
    if (!patient) continue
    observations.push({
      OBSERVATION_ID: observationNum++,
      ENCOUNTER_NUM: visitId,
      PATIENT_NUM: patient.PATIENT_NUM,
      CATEGORY_CHAR: null,
      CONCEPT_CD: entry.title,
      PROVIDER_ID: null,
      START_DATE: isoDate(),
      INSTANCE_NUM: 1,
      VALTYPE_CD: valtypeCd,
      TVAL_CHAR: tvalChar,
      NVAL_NUM: nvalNum,
      VALUEFLAG_CD: null,
      QUANTITY_NUM: null,
      UNIT_CD: null,
      END_DATE: null,
      LOCATION_CD: null,
      CONFIDENCE_NUM: null,
      OBSERVATION_BLOB: null,
      UPDATE_DATE: null,
      DOWNLOAD_DATE: null,
      IMPORT_DATE: null,
      SOURCESYSTEM_CD: 'HL7_IMPORT',
      UPLOAD_ID: 1,
      CREATED_AT: isoDate(),
    })
  }
}

function determineVisitType(location) {
  if (!location) return INOUT.OUTPATIENT
  const lower = String(location).toLowerCase()
  if (lower.includes('emergency') || lower.includes('notaufnahme')) return INOUT.EMERGENCY
  if (lower.includes('hospital') || lower.includes('inpatient') || lower.includes('station')) return INOUT.INPATIENT
  if (lower.includes('clinic') || lower.includes('ambulanz')) return INOUT.OUTPATIENT
  return INOUT.OUTPATIENT
}
