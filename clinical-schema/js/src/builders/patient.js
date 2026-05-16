import { VITAL_STATUS, DEFAULT_SOURCESYSTEM_CD } from '../constants.js'
import { isoNow, isoDate } from './util.js'

/**
 * Build a PATIENT_DIMENSION-shaped record.
 * Required: PATIENT_NUM, PATIENT_CD.
 */
export function buildPatient({
  PATIENT_NUM,
  PATIENT_CD,
  BIRTH_DATE = null,
  DEATH_DATE = null,
  AGE_IN_YEARS = null,
  SEX_CD = null,
  VITAL_STATUS_CD = VITAL_STATUS.ALIVE,
  LANGUAGE_CD = null,
  RACE_CD = null,
  MARITAL_STATUS_CD = null,
  RELIGION_CD = null,
  STATECITYZIP_PATH = null,
  PATIENT_BLOB = null,
  SOURCESYSTEM_CD = DEFAULT_SOURCESYSTEM_CD,
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
