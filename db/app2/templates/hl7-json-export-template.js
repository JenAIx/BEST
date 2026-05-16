/**
 * HL7 / dbBEST JSON Export Template
 * ----------------------------------
 * Drop-in module to produce JSON files that the dbBEST app can import.
 *
 * Two output flavors are supported (both are accepted by dbBEST):
 *
 *   1) buildSimpleJsonExport(...)
 *      Top-level wrapper { metadata, exportInfo, data: { patients, visits, observations }, statistics }
 *      → consumed by ImportJsonService (src/core/services/imports/import-json-service.js)
 *
 *   2) buildHl7CompositionExport(...)
 *      FHIR R4-inspired "Composition" resource with sections/entries
 *      → consumed by ImportHl7Service (src/core/services/imports/import-hl7-service.js)
 *
 * Both formats reference the same i2b2-style record shapes:
 *   - PATIENT_DIMENSION   (PATIENT_NUM, PATIENT_CD, BIRTH_DATE, SEX_CD, ...)
 *   - VISIT_DIMENSION     (ENCOUNTER_NUM, PATIENT_NUM, START_DATE, INOUT_CD, LOCATION_CD, ...)
 *   - OBSERVATION_FACT    (OBSERVATION_ID, ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD,
 *                          VALTYPE_CD, TVAL_CHAR, NVAL_NUM, OBSERVATION_BLOB, ...)
 *
 * VALTYPE_CD vocabulary:
 *   N = numeric (use NVAL_NUM)
 *   T = text    (use TVAL_CHAR)
 *   D = date    (date string in TVAL_CHAR / START_DATE)
 *   F = finding (yes/no/unknown)
 *   S = SNOMED selection
 *   A = answer
 *   Q = questionnaire (TVAL_CHAR = title, full payload in OBSERVATION_BLOB)
 *   M = medication
 *   R = raw / file
 *   B = binary blob
 *
 * Concept code conventions used by dbBEST:
 *   "SCTID: <snomed>"  – SNOMED CT
 *   "LID: <loinc>"     – LOINC
 *   "CUSTOM: <name>"   – internal codes (e.g. "CUSTOM: QUESTIONNAIRE")
 *   "ICD10:<code>"     – ICD-10
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  HL7 / FHIR COMPATIBILITY NOTES
 * ─────────────────────────────────────────────────────────────────────────────
 * The HL7 output is **FHIR R4-inspired** but uses a dbBEST-specific profile.
 * It WILL be accepted by dbBEST's importer; it will NOT pass a strict
 * FHIR validator (e.g. HL7 Validator, Inferno) without modification.
 *
 *  ✓ Compliant with FHIR R4:
 *     - resourceType="Composition", required fields (status, type, date, title)
 *     - meta.versionId / meta.lastUpdated / meta.profile / meta.source
 *     - identifier.{system,value} as urn:uuid
 *     - type / event[].code as CodeableConcept
 *     - section[].title / section[].code / section[].text
 *
 *  ⚠ Deviates from strict FHIR R4 (kept for dbBEST round-trip compatibility):
 *     - subject:        FHIR expects Reference; we emit {display, code:{coding:[...]}}
 *     - author[]:       FHIR expects Reference[]; we emit [{display}]
 *     - attester.party: FHIR expects Reference; we emit {} or {display}
 *     - section.entry:  FHIR expects Reference[] to other resources;
 *                       we inline {title, code, value, text} (dbBEST extension)
 *     - code prefixes:  SNOMED ("SCTID: ") and LOINC ("LID: ") are dbBEST string
 *                       conventions, not FHIR — FHIR uses bare codes plus the
 *                       canonical system URL
 *
 * If you need strict FHIR R4 conformance, post-process the result: replace
 * subject/author/attester with Reference objects and convert section.entry
 * items into separate Observation/Patient/Encounter resources referenced
 * from the section.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * No external dependencies — pure ES module.
 */

// ----------------------------------------------------------------------------
// Version information
// ----------------------------------------------------------------------------

/** Semver of this template file itself. Bump on breaking changes. */
export const TEMPLATE_VERSION = '1.0.0'

/** Version of the dbBEST JSON envelope schema this template targets. */
export const SCHEMA_VERSION = '1.0'

/** FHIR release the Composition output is modelled after. */
export const FHIR_VERSION = '4.0.1'

/** Earliest dbBEST app version known to round-trip these exports. */
export const DBBEST_MIN_VERSION = '0.0.1'

/** Canonical profile URL stamped into meta.profile of the Composition. */
export const DBBEST_PROFILE_URL =
  'https://github.com/stebro01/dbBEST/StructureDefinition/dbBEST-Composition'

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------

const isoNow = () => new Date().toISOString()
const isoDate = (d = new Date()) => new Date(d).toISOString().split('T')[0]

function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ----------------------------------------------------------------------------
// Record builders – produce objects matching the dbBEST internal data model
// ----------------------------------------------------------------------------

/**
 * Build a PATIENT_DIMENSION-shaped record.
 * Only PATIENT_NUM and PATIENT_CD are strictly required.
 */
export function buildPatient({
  PATIENT_NUM,
  PATIENT_CD,
  BIRTH_DATE = null,
  DEATH_DATE = null,
  AGE_IN_YEARS = null,
  SEX_CD = null,                              // e.g. "SCTID: 407374003" (male)
  VITAL_STATUS_CD = 'SCTID: 438949009',       // alive
  LANGUAGE_CD = null,
  RACE_CD = null,
  MARITAL_STATUS_CD = null,
  RELIGION_CD = null,
  STATECITYZIP_PATH = null,
  PATIENT_BLOB = null,
  SOURCESYSTEM_CD = 'EXTERNAL',
  UPLOAD_ID = 1,
} = {}) {
  if (PATIENT_NUM == null) throw new Error('buildPatient: PATIENT_NUM is required')
  if (!PATIENT_CD) throw new Error('buildPatient: PATIENT_CD is required')

  return {
    PATIENT_NUM,
    PATIENT_CD,
    VITAL_STATUS_CD,
    BIRTH_DATE,
    DEATH_DATE,
    AGE_IN_YEARS,
    SEX_CD,
    LANGUAGE_CD,
    RACE_CD,
    MARITAL_STATUS_CD,
    RELIGION_CD,
    STATECITYZIP_PATH,
    PATIENT_BLOB,
    UPDATE_DATE: isoDate(),
    DOWNLOAD_DATE: null,
    IMPORT_DATE: isoNow(),
    SOURCESYSTEM_CD,
    UPLOAD_ID,
    CREATED_AT: isoNow(),
    UPDATED_AT: isoNow(),
  }
}

/**
 * Build a VISIT_DIMENSION-shaped record (one encounter for one patient).
 */
export function buildVisit({
  ENCOUNTER_NUM,
  PATIENT_NUM,
  START_DATE,
  END_DATE = null,
  INOUT_CD = 'O',                              // I=inpatient, O=outpatient, E=emergency
  LOCATION_CD = null,
  ACTIVE_STATUS_CD = 'SCTID: 55561003',        // active
  VISIT_BLOB = null,
  SOURCESYSTEM_CD = 'EXTERNAL',
  UPLOAD_ID = 1,
} = {}) {
  if (ENCOUNTER_NUM == null) throw new Error('buildVisit: ENCOUNTER_NUM is required')
  if (PATIENT_NUM == null) throw new Error('buildVisit: PATIENT_NUM is required')
  if (!START_DATE) throw new Error('buildVisit: START_DATE is required')

  return {
    ENCOUNTER_NUM,
    PATIENT_NUM,
    ACTIVE_STATUS_CD,
    START_DATE,
    END_DATE,
    INOUT_CD,
    LOCATION_CD,
    VISIT_BLOB: typeof VISIT_BLOB === 'object' && VISIT_BLOB !== null ? JSON.stringify(VISIT_BLOB) : VISIT_BLOB,
    UPDATE_DATE: null,
    DOWNLOAD_DATE: null,
    IMPORT_DATE: null,
    SOURCESYSTEM_CD,
    UPLOAD_ID,
    CREATED_AT: isoDate(),
  }
}

/**
 * Build a generic OBSERVATION_FACT record.
 *
 * Pass `value` for convenience – the helper will pick the right slot
 * (NVAL_NUM for numbers, TVAL_CHAR for strings) and set VALTYPE_CD accordingly,
 * unless you explicitly override VALTYPE_CD/NVAL_NUM/TVAL_CHAR.
 */
export function buildObservation({
  OBSERVATION_ID,
  ENCOUNTER_NUM,
  PATIENT_NUM,
  CONCEPT_CD,                                  // e.g. "LID: 8302-2", "SCTID: 271649006"
  CATEGORY_CHAR = null,                        // e.g. "LAB", "DIAGNOSIS", "SURVEY_BEST"
  PROVIDER_ID = '@',
  START_DATE = isoNow(),
  END_DATE = null,
  INSTANCE_NUM = 1,
  value = undefined,
  VALTYPE_CD = undefined,
  TVAL_CHAR = undefined,
  NVAL_NUM = undefined,
  UNIT_CD = null,
  QUANTITY_NUM = null,
  VALUEFLAG_CD = null,
  LOCATION_CD = null,
  CONFIDENCE_NUM = null,
  OBSERVATION_BLOB = null,
  SOURCESYSTEM_CD = 'EXTERNAL',
  UPLOAD_ID = 1,
} = {}) {
  if (OBSERVATION_ID == null) throw new Error('buildObservation: OBSERVATION_ID is required')
  if (ENCOUNTER_NUM == null) throw new Error('buildObservation: ENCOUNTER_NUM is required')
  if (PATIENT_NUM == null) throw new Error('buildObservation: PATIENT_NUM is required')
  if (!CONCEPT_CD) throw new Error('buildObservation: CONCEPT_CD is required')

  // Auto-pick VALTYPE_CD / value slot when caller passes a plain `value`
  if (VALTYPE_CD === undefined) {
    if (typeof value === 'number') {
      VALTYPE_CD = 'N'
      NVAL_NUM = NVAL_NUM ?? value
      TVAL_CHAR = TVAL_CHAR ?? null
    } else if (typeof value === 'string') {
      VALTYPE_CD = 'T'
      TVAL_CHAR = TVAL_CHAR ?? value
      NVAL_NUM = NVAL_NUM ?? null
    } else {
      VALTYPE_CD = 'T'
    }
  }

  const blob = OBSERVATION_BLOB && typeof OBSERVATION_BLOB === 'object'
    ? JSON.stringify(OBSERVATION_BLOB)
    : OBSERVATION_BLOB

  return {
    OBSERVATION_ID,
    ENCOUNTER_NUM,
    PATIENT_NUM,
    CATEGORY_CHAR,
    CONCEPT_CD,
    PROVIDER_ID,
    START_DATE,
    INSTANCE_NUM,
    VALTYPE_CD,
    TVAL_CHAR: TVAL_CHAR ?? null,
    NVAL_NUM: NVAL_NUM ?? null,
    VALUEFLAG_CD,
    QUANTITY_NUM,
    UNIT_CD,
    END_DATE,
    LOCATION_CD,
    CONFIDENCE_NUM,
    OBSERVATION_BLOB: blob,
    UPDATE_DATE: null,
    DOWNLOAD_DATE: null,
    IMPORT_DATE: null,
    SOURCESYSTEM_CD,
    UPLOAD_ID,
    CREATED_AT: isoDate(),
  }
}

/**
 * Build a questionnaire observation (VALTYPE_CD = 'Q').
 *
 * The full questionnaire payload (items + summary results) lives in
 * OBSERVATION_BLOB; the questionnaire title goes into TVAL_CHAR.
 *
 * `items`   – array of { id, label, value, coding? }
 * `results` – array of summary scores { label, value, coding? }
 */
export function buildQuestionnaireObservation({
  OBSERVATION_ID,
  ENCOUNTER_NUM,
  PATIENT_NUM,
  questionnaireCode,                           // e.g. "MOCA"
  title,                                       // e.g. "MoCA"
  shortTitle = null,
  coding = null,                               // { system, code, display }
  items = [],
  results = [],
  startDate = isoNow(),
  endDate = isoNow(),
  CONCEPT_CD = 'CUSTOM: QUESTIONNAIRE',
  CATEGORY_CHAR = 'SURVEY_BEST',
  SOURCESYSTEM_CD = 'SURVEY_SYSTEM',
  UPLOAD_ID = 1,
} = {}) {
  if (!questionnaireCode) throw new Error('buildQuestionnaireObservation: questionnaireCode required')
  if (!title) throw new Error('buildQuestionnaireObservation: title required')

  const blob = {
    label: questionnaireCode,
    title,
    short_title: shortTitle ?? title.toLowerCase(),
    questionnaire_code: questionnaireCode,
    date_start: new Date(startDate).getTime(),
    date_end: new Date(endDate).getTime(),
    items,
    results,
    coding,
  }

  return {
    OBSERVATION_ID,
    ENCOUNTER_NUM,
    PATIENT_NUM,
    CATEGORY_CHAR,
    CONCEPT_CD,
    PROVIDER_ID: '@',
    START_DATE: startDate,
    INSTANCE_NUM: 1,
    VALTYPE_CD: 'Q',
    TVAL_CHAR: title,
    NVAL_NUM: null,
    VALUEFLAG_CD: null,
    QUANTITY_NUM: null,
    UNIT_CD: null,
    END_DATE: endDate,
    LOCATION_CD: 'QUESTIONNAIRE',
    CONFIDENCE_NUM: null,
    OBSERVATION_BLOB: JSON.stringify(blob),
    UPDATE_DATE: isoDate(),
    DOWNLOAD_DATE: null,
    IMPORT_DATE: isoDate(),
    SOURCESYSTEM_CD,
    UPLOAD_ID,
    CREATED_AT: isoDate(),
  }
}

// ----------------------------------------------------------------------------
// Format 1 – simple JSON wrapper (matches tests/input/test_import/02_json.json)
// ----------------------------------------------------------------------------

/**
 * Wrap built records into the simple JSON export envelope that
 * ImportJsonService consumes directly.
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

// ----------------------------------------------------------------------------
// Format 2 – HL7 FHIR Composition (matches patient_*_HL7.json)
// ----------------------------------------------------------------------------

const SNOMED = 'http://snomed.info/sct'

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
 * Wrap built records into a FHIR Composition document.
 *
 * Returned shape:
 *   { cda: <Composition>, hash: { signature, method, documentHash } }
 *
 * dbBEST's HL7 importer expects the inner `cda` (resourceType:'Composition')
 * with sections titled "Patient Information", "Visit 1"…"Visit N", and
 * any further section grouping observations.
 */
export function buildHl7CompositionExport({
  patients = [],
  visits = [],
  observations = [],
  metadata = {},
} = {}) {
  if (!patients.length) throw new Error('buildHl7CompositionExport: at least one patient is required')

  const docId = 'urn:uuid:' + uuidv4()
  const exportDate = metadata.exportDate || isoDate()

  // --- Patient Information section ---------------------------------------
  const patientSection = {
    title: 'Patient Information',
    code: [makeCoding(SNOMED, '422549004', 'Patient Information')],
    entry: [],
  }
  for (const p of patients) {
    patientSection.entry.push(makeEntry(`Patient: ${p.PATIENT_CD}`, '422549004', p.PATIENT_CD))
    if (p.SEX_CD)        patientSection.entry.push(makeEntry('Gender', '263495000', p.SEX_CD))
    if (p.AGE_IN_YEARS)  patientSection.entry.push(makeEntry('Age', '63900-5', p.AGE_IN_YEARS))
    if (p.BIRTH_DATE)    patientSection.entry.push(makeEntry('Date of birth', 'SCTID: 184099003', p.BIRTH_DATE))
  }

  // --- Visit sections (one per visit) ------------------------------------
  const visitSections = visits.map((v, i) => {
    const visitObs = observations.filter((o) => o.ENCOUNTER_NUM === v.ENCOUNTER_NUM)
    const entry = []
    if (v.START_DATE)   entry.push(makeEntry('Visit Date', '184099003', v.START_DATE))
    if (v.LOCATION_CD)  entry.push(makeEntry('Location', '442724003', v.LOCATION_CD))
    for (const o of visitObs) {
      const value = o.VALTYPE_CD === 'N' ? o.NVAL_NUM
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

  // --- Composition envelope ----------------------------------------------
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

// ----------------------------------------------------------------------------
// Example usage – delete or adapt in your own project
// ----------------------------------------------------------------------------
//
// import {
//   buildPatient, buildVisit, buildObservation, buildQuestionnaireObservation,
//   buildSimpleJsonExport, buildHl7CompositionExport,
// } from './hl7-json-export-template.js'
//
// const patients = [
//   buildPatient({
//     PATIENT_NUM: 1,
//     PATIENT_CD: 'EXT_PATIENT_01',
//     BIRTH_DATE: '1980-04-12',
//     SEX_CD: 'SCTID: 407374003',
//     AGE_IN_YEARS: 45,
//   }),
// ]
//
// const visits = [
//   buildVisit({
//     ENCOUNTER_NUM: 1,
//     PATIENT_NUM: 1,
//     START_DATE: '2026-01-15',
//     INOUT_CD: 'O',
//     LOCATION_CD: 'EXT_CLINIC/NEUROLOGY',
//   }),
// ]
//
// const observations = [
//   buildObservation({
//     OBSERVATION_ID: 1,
//     ENCOUNTER_NUM: 1,
//     PATIENT_NUM: 1,
//     CONCEPT_CD: 'LID: 8480-6',
//     CATEGORY_CHAR: 'VITAL',
//     value: 132,
//     UNIT_CD: 'mmHg',
//   }),
//   buildQuestionnaireObservation({
//     OBSERVATION_ID: 2,
//     ENCOUNTER_NUM: 1,
//     PATIENT_NUM: 1,
//     questionnaireCode: 'MOCA',
//     title: 'MoCA',
//     coding: { system: 'LOINC', code: 'LID: 72133-2', display: 'MoCA' },
//     items: [
//       { id: 1, label: 'Visuospatial', value: 4,
//         coding: { system: SNOMED, code: '302199004', display: 'Visuospatial' } },
//     ],
//     results: [
//       { label: 'sum', value: 26,
//         coding: { system: 'LOINC', code: 'LID: 72172-0', display: 'MoCA SUM' } },
//     ],
//   }),
// ]
//
// // Variant A – simple JSON envelope (recommended for most cases):
// const simple = buildSimpleJsonExport({ patients, visits, observations,
//   metadata: { source: 'My External System', author: 'jane.doe' } })
// fs.writeFileSync('export.json', JSON.stringify(simple, null, 2))
//
// // Variant B – HL7 FHIR Composition wrapper:
// const hl7 = buildHl7CompositionExport({ patients, visits, observations,
//   metadata: { title: 'Export from MyEHR', source: 'MyEHR v3' } })
// fs.writeFileSync('export.hl7', JSON.stringify(hl7, null, 2))
