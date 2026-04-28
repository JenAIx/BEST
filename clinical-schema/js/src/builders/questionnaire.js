import { VALTYPE, CATEGORY, CONCEPT, DEFAULT_PROVIDER_ID } from '../constants.js'
import { isoNow, isoDate } from './util.js'

/**
 * Build a questionnaire OBSERVATION_FACT record (VALTYPE_CD='Q').
 *
 * The full questionnaire payload (items + summary results) goes into
 * OBSERVATION_BLOB; the questionnaire title is stored in TVAL_CHAR.
 *
 * Required: OBSERVATION_ID, ENCOUNTER_NUM, PATIENT_NUM, questionnaireCode, title.
 */
export function buildQuestionnaireObservation({
  OBSERVATION_ID,
  ENCOUNTER_NUM,
  PATIENT_NUM,
  questionnaireCode,
  title,
  shortTitle = null,
  coding = null,
  items = [],
  results = [],
  startDate = isoNow(),
  endDate = isoNow(),
  CONCEPT_CD = CONCEPT.QUESTIONNAIRE,
  CATEGORY_CHAR = CATEGORY.SURVEY,
  SOURCESYSTEM_CD = 'SURVEY_SYSTEM',
  UPLOAD_ID = 1,
} = {}) {
  if (OBSERVATION_ID == null) throw new Error('buildQuestionnaireObservation: OBSERVATION_ID is required')
  if (ENCOUNTER_NUM == null) throw new Error('buildQuestionnaireObservation: ENCOUNTER_NUM is required')
  if (PATIENT_NUM == null) throw new Error('buildQuestionnaireObservation: PATIENT_NUM is required')
  if (!questionnaireCode) throw new Error('buildQuestionnaireObservation: questionnaireCode is required')
  if (!title) throw new Error('buildQuestionnaireObservation: title is required')

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
    PROVIDER_ID: DEFAULT_PROVIDER_ID,
    START_DATE: startDate,
    INSTANCE_NUM: 1,
    VALTYPE_CD: VALTYPE.QUESTIONNAIRE,
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
