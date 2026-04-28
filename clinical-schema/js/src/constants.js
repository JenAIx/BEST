/**
 * Canonical constants used across the dbBEST clinical-schema ecosystem.
 *
 * Keep values byte-identical with dbBEST's existing imports/exports — these
 * literals are persisted in databases and exported documents in the wild.
 */

// ──────────────────────────────────────────────────────────────────────────
// VALTYPE_CD enum — observation value type
// ──────────────────────────────────────────────────────────────────────────

export const VALTYPE = Object.freeze({
  NUMERIC: 'N',
  TEXT: 'T',
  DATE: 'D',
  FINDING: 'F',
  SELECTION: 'S',
  ANSWER: 'A',
  QUESTIONNAIRE: 'Q',
  MEDICATION: 'M',
  RAW: 'R',
  BLOB: 'B',
})

export const VALTYPE_CODES = Object.freeze(Object.values(VALTYPE))

// ──────────────────────────────────────────────────────────────────────────
// Concept-code prefixes (dbBEST conventions; not strict FHIR)
// ──────────────────────────────────────────────────────────────────────────

export const CODE_PREFIX = Object.freeze({
  SNOMED: 'SCTID: ',
  LOINC: 'LID: ',
  CUSTOM: 'CUSTOM: ',
  ICD10: 'ICD10:',
})

export const SYSTEM_URL = Object.freeze({
  SNOMED: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
})

// ──────────────────────────────────────────────────────────────────────────
// Status / vital codes (defaults used by dbBEST when fields are absent)
// ──────────────────────────────────────────────────────────────────────────

export const VITAL_STATUS = Object.freeze({
  ALIVE: 'SCTID: 438949009',
  DECEASED: 'SCTID: 419099009',
})

export const ACTIVE_STATUS = Object.freeze({
  ACTIVE: 'SCTID: 55561003',
  INACTIVE: 'SCTID: 73504009',
})

// ──────────────────────────────────────────────────────────────────────────
// Visit type codes
// ──────────────────────────────────────────────────────────────────────────

export const INOUT = Object.freeze({
  INPATIENT: 'I',
  OUTPATIENT: 'O',
  EMERGENCY: 'E',
})

export const INOUT_CODES = Object.freeze(Object.values(INOUT))

// ──────────────────────────────────────────────────────────────────────────
// Categories and well-known special concept codes
// ──────────────────────────────────────────────────────────────────────────

export const CATEGORY = Object.freeze({
  SURVEY: 'SURVEY_BEST',
  LAB: 'LAB',
  DIAGNOSIS: 'DIAGNOSIS',
  VITAL: 'VITAL',
})

export const CONCEPT = Object.freeze({
  QUESTIONNAIRE: 'CUSTOM: QUESTIONNAIRE',
  RAW_DATA: 'CUSTOM: RAW_DATA',
})

// ──────────────────────────────────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────────────────────────────────

export const DEFAULT_SOURCESYSTEM_CD = 'EXTERNAL'
export const DEFAULT_PROVIDER_ID = '@'
