import { VALTYPE, DEFAULT_SOURCESYSTEM_CD, DEFAULT_PROVIDER_ID } from '../constants.js'
import { isoNow, isoDate, stringifyBlob } from './util.js'

/**
 * Build an OBSERVATION_FACT record.
 *
 * Pass `value` for convenience: numbers populate NVAL_NUM with VALTYPE_CD='N',
 * strings populate TVAL_CHAR with VALTYPE_CD='T'. Override VALTYPE_CD/NVAL_NUM/
 * TVAL_CHAR explicitly when needed.
 *
 * Required: OBSERVATION_ID, ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD.
 */
export function buildObservation({
  OBSERVATION_ID,
  ENCOUNTER_NUM,
  PATIENT_NUM,
  CONCEPT_CD,
  CATEGORY_CHAR = null,
  PROVIDER_ID = DEFAULT_PROVIDER_ID,
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
  SOURCESYSTEM_CD = DEFAULT_SOURCESYSTEM_CD,
  UPLOAD_ID = 1,
} = {}) {
  if (OBSERVATION_ID == null) throw new Error('buildObservation: OBSERVATION_ID is required')
  if (ENCOUNTER_NUM == null) throw new Error('buildObservation: ENCOUNTER_NUM is required')
  if (PATIENT_NUM == null) throw new Error('buildObservation: PATIENT_NUM is required')
  if (!CONCEPT_CD) throw new Error('buildObservation: CONCEPT_CD is required')

  if (VALTYPE_CD === undefined) {
    if (typeof value === 'number') {
      VALTYPE_CD = VALTYPE.NUMERIC
      NVAL_NUM = NVAL_NUM ?? value
      TVAL_CHAR = TVAL_CHAR ?? null
    } else if (typeof value === 'string') {
      VALTYPE_CD = VALTYPE.TEXT
      TVAL_CHAR = TVAL_CHAR ?? value
      NVAL_NUM = NVAL_NUM ?? null
    } else {
      VALTYPE_CD = VALTYPE.TEXT
    }
  }

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
    OBSERVATION_BLOB: stringifyBlob(OBSERVATION_BLOB),
    UPDATE_DATE: null,
    DOWNLOAD_DATE: null,
    IMPORT_DATE: null,
    SOURCESYSTEM_CD,
    UPLOAD_ID,
    CREATED_AT: isoDate(),
  }
}
