import {
  SCHEMA_VERSION,
  TEMPLATE_VERSION,
  FHIR_VERSION,
  DBBEST_MIN_VERSION,
  DBBEST_PROFILE_URL,
} from '../version.js'
import { SYSTEM_URL } from '../constants.js'
import { uuidv4, isoNow, isoDate } from '../builders/util.js'

const SNOMED = SYSTEM_URL.SNOMED

function makeCoding(system, code, display) {
  return { coding: [{ system, code, display }] }
}

function makeEntry(title, conceptCode, value, system = SNOMED) {
  return {
    title,
    code: [makeCoding(system, conceptCode, title)],
    value,
    text: {
      status: 'generated',
      div: `<table><tbody><tr><td>${title}</td></tr><tr><td>${value}</td></tr></tbody></table>`,
    },
  }
}

/**
 * Wrap records into a FHIR R4-inspired Composition envelope.
 *
 * Shape: { cda: <Composition>, hash, generator }
 * Consumed by dbBEST `ImportHl7Service`.
 */
export function buildHl7CompositionExport({
  patients = [],
  visits = [],
  observations = [],
  metadata = {},
} = {}) {
  if (!patients.length) {
    throw new Error('buildHl7CompositionExport: at least one patient is required')
  }

  const docId = 'urn:uuid:' + uuidv4()
  const exportDate = metadata.exportDate || isoDate()

  // Patient Information section
  const patientSection = {
    title: 'Patient Information',
    code: [makeCoding(SNOMED, '422549004', 'Patient Information')],
    entry: [],
  }
  for (const p of patients) {
    patientSection.entry.push(makeEntry(`Patient: ${p.PATIENT_CD}`, '422549004', p.PATIENT_CD))
    if (p.SEX_CD)       patientSection.entry.push(makeEntry('Gender', '263495000', p.SEX_CD))
    if (p.AGE_IN_YEARS) patientSection.entry.push(makeEntry('Age', '63900-5', p.AGE_IN_YEARS))
    if (p.BIRTH_DATE)   patientSection.entry.push(makeEntry('Date of birth', 'SCTID: 184099003', p.BIRTH_DATE))
  }

  // Visit sections
  const visitSections = visits.map((v, i) => {
    const visitObs = observations.filter((o) => o.ENCOUNTER_NUM === v.ENCOUNTER_NUM)
    const entry = []
    if (v.START_DATE)  entry.push(makeEntry('Visit Date', '184099003', v.START_DATE))
    if (v.LOCATION_CD) entry.push(makeEntry('Location', '442724003', v.LOCATION_CD))
    for (const o of visitObs) {
      const value =
        o.VALTYPE_CD === 'N' ? o.NVAL_NUM
        : o.VALTYPE_CD === 'Q' ? o.OBSERVATION_BLOB
        : o.TVAL_CHAR
      entry.push(makeEntry(o.CONCEPT_CD, o.CONCEPT_CD, value))
    }
    return {
      title: `Visit ${i + 1}`,
      code: [makeCoding(SNOMED, '308335008', 'Visit')],
      text: { status: 'generated', div: `<h3>Visit ${i + 1}</h3>` },
      entry,
    }
  })

  const cda = {
    resourceType: 'Composition',
    id: 'dbBEST-' + uuidv4(),
    meta: {
      versionId: metadata.version || 'v' + SCHEMA_VERSION,
      lastUpdated: isoNow(),
      source: metadata.source || 'External System',
      profile: [DBBEST_PROFILE_URL],
    },
    fhirVersion: FHIR_VERSION,
    language: metadata.language || 'de-DE',
    text: {
      status: 'generated',
      div: `<div xmlns="http://www.w3.org/1999/xhtml"><h1>${metadata.title || 'Clinical Data Export'}</h1></div>`,
    },
    identifier: { system: 'urn:ietf:rfc:3986', value: docId },
    status: 'preliminary',
    type: { coding: [{ system: SNOMED, code: '404684003', display: 'Clinical Observation' }] },
    subject: {
      display: patients[0].PATIENT_CD,
      code: { coding: [{ system: SNOMED, code: '422549004', display: 'Patient Code' }] },
    },
    date: exportDate,
    author: [{ display: metadata.author || 'External System' }],
    title: metadata.title || 'Clinical Data Export',
    attester: [{ mode: 'legal', time: exportDate, party: {} }],
    custodian: {},
    event: visits.map((v, i) => ({
      code: [makeCoding(SNOMED, '308335008', `Visit ${i + 1}`)],
      period: { start: v.START_DATE, ...(v.END_DATE ? { end: v.END_DATE } : {}) },
    })),
    section: [patientSection, ...visitSections],
  }

  return {
    cda,
    hash: { signature: null, method: 'SHA256', documentHash: null },
    generator: {
      templateVersion: TEMPLATE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      fhirVersion: FHIR_VERSION,
      profile: DBBEST_PROFILE_URL,
      targetApp: 'dbBEST',
      targetMinVersion: DBBEST_MIN_VERSION,
    },
  }
}
