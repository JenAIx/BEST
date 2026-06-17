// Export in das native app2-Importformat (importStructure mit patients/visits/observations).
// Ziel: direkter Import in db/app2 via clinical-schema parseSimpleJson().
// Fragebögen werden als VALTYPE_CD:'Q'-Observation emittiert; deren OBSERVATION_BLOB
// entspricht ~1:1 dem survey3-summary-Objekt (QUESTMAN.summary). Je numerischem
// results-Eintrag wird zusätzlich eine abgeleitete VALTYPE_CD:'N'-Observation erzeugt.
//
// Reine Logik (kein Dexie/Vue) → direkt mit Jest testbar.

const SOURCE = 'SURVEY3'
const VITAL_ALIVE = 'SCTID: 438949009' // alive
const ACTIVE_STATUS = 'SCTID: 55561003' // active

function isoFromTimestamp(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'number') return new Date(v).toISOString()
  return v // bereits ein String (ISO o. ä.)
}

function isoDate(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10)
  if (typeof v === 'string' && v.length > 10) return v.slice(0, 10)
  return v
}

function questCode(summary) {
  if (summary && summary.coding && summary.coding.code) return summary.coding.code
  return (summary && summary.label ? summary.label : '').toUpperCase()
}

// summary → OBSERVATION_BLOB-Struktur (wie von app2 erwartet)
export function blobFromSummary(summary) {
  return {
    label: summary.label,
    title: summary.title,
    short_title: summary.label, // in survey3 ist summary.label == short_title
    questionnaire_code: questCode(summary),
    date_start: summary.date_start,
    date_end: summary.date_end,
    items: summary.items,
    results: summary.results,
    coding: summary.coding,
  }
}

export function buildPatientRecord(patient, patientNum) {
  return {
    PATIENT_NUM: patientNum,
    PATIENT_CD: patient.pid,
    VITAL_STATUS_CD: VITAL_ALIVE,
    BIRTH_DATE: patient.birthDate || null,
    SEX_CD: patient.sex || null,
    SOURCESYSTEM_CD: SOURCE,
    UPLOAD_ID: 1,
  }
}

export function buildVisitRecord(visit, patientNum, encounterNum) {
  return {
    ENCOUNTER_NUM: encounterNum,
    PATIENT_NUM: patientNum,
    ACTIVE_STATUS_CD: ACTIVE_STATUS,
    START_DATE: isoDate(visit.date),
    END_DATE: null,
    INOUT_CD: visit.inOut || 'O',
    LOCATION_CD: null,
    VISIT_BLOB: JSON.stringify({
      label: visit.label,
      templateId: visit.templateId === undefined ? null : visit.templateId,
    }),
    SOURCESYSTEM_CD: SOURCE,
    UPLOAD_ID: 1,
  }
}

// Ein abgeschlossener Fragebogen → 1 Q-Observation + je numerischem Score 1 N-Observation.
export function buildQuestionnaireObservations(summary, patientNum, encounterNum, fallbackDate) {
  const obs = []
  const start = isoFromTimestamp(summary.date_start) || isoFromTimestamp(fallbackDate)
  const end = isoFromTimestamp(summary.date_end) || start

  obs.push({
    ENCOUNTER_NUM: encounterNum,
    PATIENT_NUM: patientNum,
    CATEGORY_CHAR: 'SURVEY_BEST',
    CONCEPT_CD: 'CUSTOM: QUESTIONNAIRE',
    PROVIDER_ID: '@',
    START_DATE: start,
    INSTANCE_NUM: 1,
    VALTYPE_CD: 'Q',
    TVAL_CHAR: summary.title || summary.label || null,
    NVAL_NUM: null,
    VALUEFLAG_CD: null,
    UNIT_CD: null,
    END_DATE: end,
    LOCATION_CD: null,
    OBSERVATION_BLOB: JSON.stringify(blobFromSummary(summary)),
    SOURCESYSTEM_CD: SOURCE,
    UPLOAD_ID: 1,
  })

  if (Array.isArray(summary.results)) {
    summary.results.forEach((r) => {
      if (typeof r.value === 'number' && r.coding && r.coding.code) {
        obs.push({
          ENCOUNTER_NUM: encounterNum,
          PATIENT_NUM: patientNum,
          CATEGORY_CHAR: 'SURVEY_BEST',
          CONCEPT_CD: r.coding.code,
          PROVIDER_ID: '@',
          START_DATE: start,
          INSTANCE_NUM: 1,
          VALTYPE_CD: 'N',
          TVAL_CHAR: null,
          NVAL_NUM: r.value,
          VALUEFLAG_CD: null,
          UNIT_CD: null,
          LOCATION_CD: 'QUESTIONNAIRE',
          OBSERVATION_BLOB: JSON.stringify({
            questionnaireReference: {
              questionnaireCode: questCode(summary),
              type: 'result',
              originalItem: r,
            },
          }),
          SOURCESYSTEM_CD: r.coding.system === 'LOINC' ? 'LOINC' : SOURCE,
          UPLOAD_ID: 1,
        })
      }
    })
  }

  return obs
}

// patientsWithVisits: [ { patient, visits: [ { visit, summaries: [summary, ...] } ] } ]
// Vergibt PATIENT_NUM / ENCOUNTER_NUM lokal 1-basiert (FK-Verknüpfung innerhalb der Datei).
export function buildImportStructure(patientsWithVisits, exportDate) {
  const date = exportDate || new Date().toISOString()
  const patients = []
  const visits = []
  const observations = []
  const patientIds = []
  let patientNum = 0
  let encounterNum = 0

  ;(patientsWithVisits || []).forEach((pw) => {
    patientNum++
    patients.push(buildPatientRecord(pw.patient, patientNum))
    patientIds.push(pw.patient.pid)
    ;(pw.visits || []).forEach((vw) => {
      encounterNum++
      visits.push(buildVisitRecord(vw.visit, patientNum, encounterNum))
      ;(vw.summaries || []).forEach((summary) => {
        buildQuestionnaireObservations(summary, patientNum, encounterNum, vw.visit.date).forEach(
          (o) => observations.push(o)
        )
      })
    })
  })

  const statistics = {
    patientCount: patients.length,
    visitCount: visits.length,
    observationCount: observations.length,
    fetchedAt: date,
  }

  return {
    metadata: {
      title: 'survey3 Patient/Visit Export',
      exportDate: date,
      format: 'json_import',
      source: 'survey3',
      version: '1.0',
      author: 'survey3',
      patientCount: patients.length,
      visitCount: visits.length,
      observationCount: observations.length,
      patientIds,
      options: { includeVisits: true, includeObservations: true, includeNotes: false },
    },
    exportInfo: {
      format: 'json',
      version: '1.0',
      exportedAt: date,
      source: 'survey3 Export',
    },
    data: { patients, visits, observations },
    statistics,
  }
}
