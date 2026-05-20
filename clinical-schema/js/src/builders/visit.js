import { ACTIVE_STATUS, INOUT, DEFAULT_SOURCESYSTEM_CD } from '../constants.js'
import { isoDate, stringifyBlob } from './util.js'

/**
 * Build a VISIT_DIMENSION-shaped record.
 * Required: ENCOUNTER_NUM, PATIENT_NUM, START_DATE.
 */
export function buildVisit({
  ENCOUNTER_NUM,
  PATIENT_NUM,
  START_DATE,
  END_DATE = null,
  INOUT_CD = INOUT.OUTPATIENT,
  LOCATION_CD = null,
  ACTIVE_STATUS_CD = ACTIVE_STATUS.ACTIVE,
  VISIT_BLOB = null,
  SOURCESYSTEM_CD = DEFAULT_SOURCESYSTEM_CD,
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
    VISIT_BLOB: stringifyBlob(VISIT_BLOB),
    UPDATE_DATE: null,
    DOWNLOAD_DATE: null,
    IMPORT_DATE: null,
    SOURCESYSTEM_CD,
    UPLOAD_ID,
    CREATED_AT: isoDate(),
  }
}
