import { VALTYPE, VITAL_STATUS, ACTIVE_STATUS, INOUT, CATEGORY, CONCEPT } from '../constants.js'
import { isoNow, isoDate } from '../builders/util.js'

/**
 * Parse a simple-JSON envelope into normalized record arrays.
 *
 * Accepts:
 *   - canonical UPPER_SNAKE keys (PATIENT_NUM, ...)
 *   - common alt keys (id, patientId, encounterId, birthDate, sex, ...)
 *
 * Returns: { patients: [...], visits: [...], observations: [...] }
 *
 * Behavior matches dbBEST `ImportJsonService.transform*` (src/core/services/
 * imports/import-json-service.js, lines 199–341) so that round-trip with
 * dbBEST is preserved.
 */
export function parseSimpleJson(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('parseSimpleJson: envelope must be an object')
  }
  const data = envelope.data || {}
  return {
    patients: (data.patients || []).map(transformPatient),
    visits: (data.visits || []).map(transformVisit),
    observations: (data.observations || []).map(transformObservation),
  }
}

function transformPatient(p) {
  return {
    PATIENT_NUM: p.PATIENT_NUM ?? p.id ?? null,
    PATIENT_CD: p.PATIENT_CD ?? p.patientId ?? p.patient_cd ?? null,
    VITAL_STATUS_CD: p.VITAL_STATUS_CD ?? VITAL_STATUS.ALIVE,
    BIRTH_DATE: p.BIRTH_DATE ?? p.birthDate ?? p.dob ?? null,
    DEATH_DATE: p.DEATH_DATE ?? p.deathDate ?? null,
    AGE_IN_YEARS: p.AGE_IN_YEARS ?? p.age ?? null,
    SEX_CD: p.SEX_CD ?? p.sex ?? p.gender ?? null,
    LANGUAGE_CD: p.LANGUAGE_CD ?? p.language ?? null,
    RACE_CD: p.RACE_CD ?? p.race ?? null,
    MARITAL_STATUS_CD: p.MARITAL_STATUS_CD ?? p.maritalStatus ?? null,
    RELIGION_CD: p.RELIGION_CD ?? p.religion ?? null,
    STATECITYZIP_PATH: p.STATECITYZIP_PATH ?? p.address ?? null,
    PATIENT_BLOB: p.PATIENT_BLOB ?? null,
    UPDATE_DATE: p.UPDATE_DATE ?? isoDate(),
    DOWNLOAD_DATE: p.DOWNLOAD_DATE ?? null,
    IMPORT_DATE: p.IMPORT_DATE ?? isoNow(),
    SOURCESYSTEM_CD: p.SOURCESYSTEM_CD ?? p.sourceSystem ?? 'JSON_IMPORT',
    UPLOAD_ID: p.UPLOAD_ID ?? 1,
    CREATED_AT: p.CREATED_AT ?? isoNow(),
    UPDATED_AT: p.UPDATED_AT ?? isoNow(),
  }
}

function transformVisit(v) {
  return {
    ENCOUNTER_NUM: v.ENCOUNTER_NUM ?? v.id ?? null,
    PATIENT_NUM: v.PATIENT_NUM ?? v.patientId ?? null,
    ACTIVE_STATUS_CD: v.ACTIVE_STATUS_CD ?? ACTIVE_STATUS.ACTIVE,
    START_DATE: v.START_DATE ?? v.startDate ?? v.visitDate ?? null,
    END_DATE: v.END_DATE ?? v.endDate ?? null,
    INOUT_CD: v.INOUT_CD ?? v.inOut ?? v.visitType ?? INOUT.OUTPATIENT,
    LOCATION_CD: v.LOCATION_CD ?? v.location ?? null,
    VISIT_BLOB: v.VISIT_BLOB ?? null,
    UPDATE_DATE: v.UPDATE_DATE ?? null,
    DOWNLOAD_DATE: v.DOWNLOAD_DATE ?? null,
    IMPORT_DATE: v.IMPORT_DATE ?? null,
    SOURCESYSTEM_CD: v.SOURCESYSTEM_CD ?? v.sourceSystem ?? 'JSON_IMPORT',
    UPLOAD_ID: v.UPLOAD_ID ?? 1,
    CREATED_AT: v.CREATED_AT ?? isoDate(),
  }
}

function transformObservation(o) {
  if (o.VALTYPE_CD === VALTYPE.QUESTIONNAIRE || o.valtypeCd === VALTYPE.QUESTIONNAIRE) {
    return transformQuestionnaireObservation(o)
  }
  return {
    OBSERVATION_ID: o.OBSERVATION_ID ?? o.id ?? null,
    ENCOUNTER_NUM: o.ENCOUNTER_NUM ?? o.encounterId ?? o.visitId ?? null,
    PATIENT_NUM: o.PATIENT_NUM ?? o.patientId ?? null,
    CATEGORY_CHAR: o.CATEGORY_CHAR ?? o.category ?? null,
    CONCEPT_CD: o.CONCEPT_CD ?? o.conceptCode ?? o.concept_cd ?? null,
    PROVIDER_ID: o.PROVIDER_ID ?? o.providerId ?? '@',
    START_DATE: o.START_DATE ?? o.startDate ?? o.observationDate ?? isoNow(),
    INSTANCE_NUM: o.INSTANCE_NUM ?? o.instanceNum ?? 1,
    VALTYPE_CD: o.VALTYPE_CD ?? o.valtypeCd ?? o.valueType ?? VALTYPE.TEXT,
    TVAL_CHAR: o.TVAL_CHAR ?? o.textValue ?? (typeof o.value === 'string' ? o.value : null),
    NVAL_NUM: o.NVAL_NUM ?? o.numericValue ?? (typeof o.value === 'number' ? o.value : null),
    VALUEFLAG_CD: o.VALUEFLAG_CD ?? o.valueFlag ?? null,
    QUANTITY_NUM: o.QUANTITY_NUM ?? o.quantity ?? null,
    UNIT_CD: o.UNIT_CD ?? o.unit ?? null,
    END_DATE: o.END_DATE ?? o.endDate ?? null,
    LOCATION_CD: o.LOCATION_CD ?? o.location ?? null,
    CONFIDENCE_NUM: o.CONFIDENCE_NUM ?? o.confidence ?? null,
    OBSERVATION_BLOB: o.OBSERVATION_BLOB ?? o.blob ?? null,
    UPDATE_DATE: o.UPDATE_DATE ?? null,
    DOWNLOAD_DATE: o.DOWNLOAD_DATE ?? null,
    IMPORT_DATE: o.IMPORT_DATE ?? null,
    SOURCESYSTEM_CD: o.SOURCESYSTEM_CD ?? o.sourceSystem ?? 'JSON_IMPORT',
    UPLOAD_ID: o.UPLOAD_ID ?? 1,
    CREATED_AT: o.CREATED_AT ?? isoDate(),
  }
}

function transformQuestionnaireObservation(o) {
  let title = o.TVAL_CHAR ?? o.textValue ?? 'Unknown Questionnaire'
  if (o.OBSERVATION_BLOB) {
    try {
      const blob = typeof o.OBSERVATION_BLOB === 'string' ? JSON.parse(o.OBSERVATION_BLOB) : o.OBSERVATION_BLOB
      if (blob.title) title = blob.title
      else if (blob.label) title = blob.label
      else if (blob.questionnaireReference?.questionnaireCode) title = blob.questionnaireReference.questionnaireCode
    } catch {
      // ignore — keep current title
    }
  }
  return {
    OBSERVATION_ID: o.OBSERVATION_ID ?? o.id ?? null,
    ENCOUNTER_NUM: o.ENCOUNTER_NUM ?? o.encounterId ?? o.visitId ?? null,
    PATIENT_NUM: o.PATIENT_NUM ?? o.patientId ?? null,
    CATEGORY_CHAR: o.CATEGORY_CHAR ?? o.category ?? CATEGORY.SURVEY,
    CONCEPT_CD: o.CONCEPT_CD ?? o.conceptCode ?? CONCEPT.QUESTIONNAIRE,
    PROVIDER_ID: o.PROVIDER_ID ?? o.providerId ?? '@',
    START_DATE: o.START_DATE ?? o.startDate ?? o.observationDate ?? isoNow(),
    INSTANCE_NUM: o.INSTANCE_NUM ?? o.instanceNum ?? 1,
    VALTYPE_CD: VALTYPE.QUESTIONNAIRE,
    TVAL_CHAR: title,
    NVAL_NUM: null,
    VALUEFLAG_CD: null,
    QUANTITY_NUM: null,
    UNIT_CD: null,
    END_DATE: o.END_DATE ?? o.endDate ?? null,
    LOCATION_CD: o.LOCATION_CD ?? o.location ?? null,
    CONFIDENCE_NUM: null,
    OBSERVATION_BLOB: o.OBSERVATION_BLOB ?? o.blob ?? null,
    UPDATE_DATE: o.UPDATE_DATE ?? isoDate(),
    DOWNLOAD_DATE: o.DOWNLOAD_DATE ?? null,
    IMPORT_DATE: o.IMPORT_DATE ?? isoDate(),
    SOURCESYSTEM_CD: o.SOURCESYSTEM_CD ?? o.sourceSystem ?? 'SURVEY_SYSTEM',
    UPLOAD_ID: o.UPLOAD_ID ?? null,
    CREATED_AT: o.CREATED_AT ?? isoDate(),
  }
}
