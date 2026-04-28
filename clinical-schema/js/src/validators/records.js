import { VALTYPE_CODES, VALTYPE, INOUT_CODES } from '../constants.js'
import { makeResult, err, warn } from './result.js'

export function validatePatient(patient, path = 'patient') {
  const errors = []
  const warnings = []
  if (!patient || typeof patient !== 'object') {
    return makeResult([err('INVALID_PATIENT', 'Patient must be an object', path)])
  }
  if (patient.PATIENT_NUM == null) errors.push(err('MISSING_PATIENT_NUM', 'PATIENT_NUM is required', path))
  if (!patient.PATIENT_CD) errors.push(err('MISSING_PATIENT_CD', 'PATIENT_CD is required', path))
  if (patient.BIRTH_DATE && !/^\d{4}-\d{2}-\d{2}/.test(patient.BIRTH_DATE)) {
    warnings.push(warn('BIRTH_DATE_FORMAT', 'BIRTH_DATE should be ISO YYYY-MM-DD', path))
  }
  return makeResult(errors, warnings)
}

export function validateVisit(visit, path = 'visit') {
  const errors = []
  const warnings = []
  if (!visit || typeof visit !== 'object') {
    return makeResult([err('INVALID_VISIT', 'Visit must be an object', path)])
  }
  if (visit.ENCOUNTER_NUM == null) errors.push(err('MISSING_ENCOUNTER_NUM', 'ENCOUNTER_NUM is required', path))
  if (visit.PATIENT_NUM == null) errors.push(err('MISSING_PATIENT_NUM', 'PATIENT_NUM is required', path))
  if (!visit.START_DATE) errors.push(err('MISSING_START_DATE', 'START_DATE is required', path))
  if (visit.INOUT_CD && !INOUT_CODES.includes(visit.INOUT_CD)) {
    warnings.push(warn('UNKNOWN_INOUT_CD', `INOUT_CD "${visit.INOUT_CD}" is not in {I,O,E}`, path))
  }
  return makeResult(errors, warnings)
}

export function validateObservation(observation, path = 'observation') {
  const errors = []
  const warnings = []
  if (!observation || typeof observation !== 'object') {
    return makeResult([err('INVALID_OBSERVATION', 'Observation must be an object', path)])
  }
  const o = observation
  if (o.OBSERVATION_ID == null) errors.push(err('MISSING_OBSERVATION_ID', 'OBSERVATION_ID is required', path))
  if (o.ENCOUNTER_NUM == null) errors.push(err('MISSING_ENCOUNTER_NUM', 'ENCOUNTER_NUM is required', path))
  if (o.PATIENT_NUM == null) errors.push(err('MISSING_PATIENT_NUM', 'PATIENT_NUM is required', path))
  if (!o.CONCEPT_CD) errors.push(err('MISSING_CONCEPT_CD', 'CONCEPT_CD is required', path))
  if (!o.VALTYPE_CD) {
    errors.push(err('MISSING_VALTYPE_CD', 'VALTYPE_CD is required', path))
  } else if (!VALTYPE_CODES.includes(o.VALTYPE_CD)) {
    errors.push(err('UNKNOWN_VALTYPE_CD', `VALTYPE_CD "${o.VALTYPE_CD}" is not in ${VALTYPE_CODES.join(',')}`, path))
  } else {
    // Conditional consistency checks
    if (o.VALTYPE_CD === VALTYPE.NUMERIC && o.NVAL_NUM == null) {
      warnings.push(warn('NUMERIC_WITHOUT_NVAL', 'VALTYPE_CD=N but NVAL_NUM is null', path))
    }
    if (o.VALTYPE_CD === VALTYPE.TEXT && o.TVAL_CHAR == null) {
      warnings.push(warn('TEXT_WITHOUT_TVAL', 'VALTYPE_CD=T but TVAL_CHAR is null', path))
    }
    if (o.VALTYPE_CD === VALTYPE.QUESTIONNAIRE) {
      if (!o.TVAL_CHAR) warnings.push(warn('Q_WITHOUT_TITLE', 'VALTYPE_CD=Q but TVAL_CHAR (title) is empty', path))
      if (!o.OBSERVATION_BLOB) errors.push(err('Q_WITHOUT_BLOB', 'VALTYPE_CD=Q but OBSERVATION_BLOB is empty', path))
    }
    if ((o.VALTYPE_CD === VALTYPE.RAW || o.VALTYPE_CD === VALTYPE.BLOB) && !o.OBSERVATION_BLOB) {
      warnings.push(warn('BLOB_TYPE_WITHOUT_BLOB', `VALTYPE_CD=${o.VALTYPE_CD} but OBSERVATION_BLOB is empty`, path))
    }
  }
  return makeResult(errors, warnings)
}

export function validateRecords({ patients = [], visits = [], observations = [] }) {
  const errors = []
  const warnings = []

  patients.forEach((p, i) => {
    const r = validatePatient(p, `patients[${i}]`)
    errors.push(...r.errors); warnings.push(...r.warnings)
  })
  visits.forEach((v, i) => {
    const r = validateVisit(v, `visits[${i}]`)
    errors.push(...r.errors); warnings.push(...r.warnings)
  })
  observations.forEach((o, i) => {
    const r = validateObservation(o, `observations[${i}]`)
    errors.push(...r.errors); warnings.push(...r.warnings)
  })

  // Referential integrity (warnings — caller may know about lazy loading)
  const patientNums = new Set(patients.map((p) => p.PATIENT_NUM))
  const encounterNums = new Set(visits.map((v) => v.ENCOUNTER_NUM))
  visits.forEach((v, i) => {
    if (patients.length && !patientNums.has(v.PATIENT_NUM)) {
      warnings.push(warn('UNKNOWN_PATIENT_REF', `visits[${i}].PATIENT_NUM ${v.PATIENT_NUM} not in patients`, `visits[${i}]`))
    }
  })
  observations.forEach((o, i) => {
    if (patients.length && !patientNums.has(o.PATIENT_NUM)) {
      warnings.push(warn('UNKNOWN_PATIENT_REF', `observations[${i}].PATIENT_NUM ${o.PATIENT_NUM} not in patients`, `observations[${i}]`))
    }
    if (visits.length && !encounterNums.has(o.ENCOUNTER_NUM)) {
      warnings.push(warn('UNKNOWN_ENCOUNTER_REF', `observations[${i}].ENCOUNTER_NUM ${o.ENCOUNTER_NUM} not in visits`, `observations[${i}]`))
    }
  })

  return makeResult(errors, warnings)
}
