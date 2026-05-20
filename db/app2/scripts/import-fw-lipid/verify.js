#!/usr/bin/env node
'use strict'

const path = require('node:path')
const Database = require('better-sqlite3')
const XLSX = require('xlsx')
const M = require('./mapping')
const P = require('./parsers')

const args = process.argv.slice(2)
function arg(name, def = null) {
  const i = args.indexOf('--' + name)
  if (i < 0) return def
  return args[i + 1]
}

const XLSX_PATH = path.resolve(arg('xlsx', '../../tmp/import_fw_lipid_202605/2026-05-08.xlsx'))
const DB_PATH = path.resolve(arg('db', '../../database/production.db'))
const SOURCE = 'FW_LIPID_XLSX_2026-05-08'
const SAMPLE_ID = arg('sample', '20015823')

const db = new Database(DB_PATH, { readonly: true })

console.log(`db: ${DB_PATH}`)
console.log(`xlsx: ${XLSX_PATH}`)
console.log(`source: ${SOURCE}`)
console.log()

function row(t) {
  return Object.entries(t)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ')
}

const counts = db
  .prepare(
    `
  SELECT
    (SELECT COUNT(*) FROM PATIENT_DIMENSION WHERE SOURCESYSTEM_CD = ?) AS patients,
    (SELECT COUNT(*) FROM VISIT_DIMENSION WHERE SOURCESYSTEM_CD = ?)   AS visits,
    (SELECT COUNT(*) FROM OBSERVATION_FACT WHERE SOURCESYSTEM_CD = ?)  AS obs,
    (SELECT COUNT(*) FROM CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE 'STROKE_LIPID:%' OR CONCEPT_CD LIKE 'STROKE_LIPID:%')  AS concepts,
    (SELECT COUNT(*) FROM STUDY_DIMENSION WHERE STUDY_CD = 'STROKE_LIPID') AS studies,
    (SELECT COUNT(*) FROM STUDY_PATIENT_LOOKUP spl JOIN STUDY_DIMENSION s ON s.STUDY_NUM=spl.STUDY_NUM WHERE s.STUDY_CD='STROKE_LIPID') AS enrollments
`,
  )
  .get(SOURCE, SOURCE, SOURCE)
console.log('### Global counts')
console.log(row(counts))
console.log()

const byVisit = db
  .prepare(
    `
  SELECT json_extract(VISIT_BLOB, '$.visitType') AS vt, COUNT(*) AS n
  FROM VISIT_DIMENSION
  WHERE SOURCESYSTEM_CD = ?
  GROUP BY vt
  ORDER BY vt
`,
  )
  .all(SOURCE)
console.log('### Visits by type')
for (const r of byVisit) console.log(' ', r.vt, '→', r.n)
console.log()

const obsByVisit = db
  .prepare(
    `
  SELECT json_extract(v.VISIT_BLOB,'$.visitType') AS vt, COUNT(*) AS n
  FROM OBSERVATION_FACT o
  JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
  WHERE o.SOURCESYSTEM_CD = ?
  GROUP BY vt
  ORDER BY vt
`,
  )
  .all(SOURCE)
console.log('### Observations by visit type')
for (const r of obsByVisit) console.log(' ', r.vt, '→', r.n)
console.log()

const byCat = db
  .prepare(
    `
  SELECT CATEGORY_CHAR, COUNT(*) AS n
  FROM OBSERVATION_FACT
  WHERE SOURCESYSTEM_CD = ?
  GROUP BY CATEGORY_CHAR ORDER BY n DESC
`,
  )
  .all(SOURCE)
console.log('### Observations by category')
for (const r of byCat) console.log(' ', r.CATEGORY_CHAR, '→', r.n)
console.log()

const byVal = db
  .prepare(
    `
  SELECT VALTYPE_CD, COUNT(*) AS n
  FROM OBSERVATION_FACT
  WHERE SOURCESYSTEM_CD = ?
  GROUP BY VALTYPE_CD ORDER BY n DESC
`,
  )
  .all(SOURCE)
console.log('### Observations by VALTYPE_CD')
for (const r of byVal) console.log(' ', r.VALTYPE_CD, '→', r.n)
console.log()

const topConcepts = db
  .prepare(
    `
  SELECT o.CONCEPT_CD, c.NAME_CHAR, COUNT(*) n, COUNT(DISTINCT o.PATIENT_NUM) patients
  FROM OBSERVATION_FACT o
  JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD = o.CONCEPT_CD
  WHERE o.SOURCESYSTEM_CD = ?
  GROUP BY o.CONCEPT_CD
  ORDER BY n DESC
  LIMIT 30
`,
  )
  .all(SOURCE)
console.log('### Top 30 concepts')
for (const r of topConcepts) console.log(' ', r.n.toString().padStart(5), r.patients.toString().padStart(4), r.CONCEPT_CD, '-', r.NAME_CHAR)
console.log()

console.log(`### Sample patient cross-check (PATIENT_CD=${SAMPLE_ID})`)
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
const sheet = wb.Sheets['Datensammlung']
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
const sample = rows.find((r) => String(r[M.PATIENT_COL.ID]).trim() === SAMPLE_ID)
if (!sample) {
  console.log('NOT FOUND in XLSX')
} else {
  const dbPat = db
    .prepare(`SELECT PATIENT_NUM, PATIENT_CD, BIRTH_DATE, SEX_CD, STATECITYZIP_PATH FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?`)
    .get(SAMPLE_ID)
  console.log(' DB:    ', dbPat)
  console.log(' XLSX:  ', {
    BIRTH: P.parseDate(sample[M.PATIENT_COL.BIRTH]),
    SEX: P.parseSex(sample[M.PATIENT_COL.SEX]),
    PLZ: P.parsePLZ(sample[M.PATIENT_COL.PLZ]),
  })
  if (dbPat) {
    const visits = db
      .prepare(
        `SELECT ENCOUNTER_NUM, START_DATE, json_extract(VISIT_BLOB,'$.visitType') as vt FROM VISIT_DIMENSION WHERE PATIENT_NUM = ? ORDER BY ENCOUNTER_NUM`,
      )
      .all(dbPat.PATIENT_NUM)
    console.log(' Visits:')
    for (const v of visits) console.log('   ', v)
    const obs = db
      .prepare(
        `SELECT o.ENCOUNTER_NUM, json_extract(v.VISIT_BLOB,'$.visitType') as vt, o.CONCEPT_CD, c.NAME_CHAR, o.VALTYPE_CD, o.NVAL_NUM, o.TVAL_CHAR, o.UNIT_CD
         FROM OBSERVATION_FACT o
         JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM=o.ENCOUNTER_NUM
         JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD=o.CONCEPT_CD
         WHERE o.PATIENT_NUM = ? AND o.SOURCESYSTEM_CD = ?
         ORDER BY vt, o.CONCEPT_CD`,
      )
      .all(dbPat.PATIENT_NUM, SOURCE)
    console.log(` Observations (${obs.length}):`)
    for (const o of obs) {
      const val = o.VALTYPE_CD === 'N' || o.VALTYPE_CD === 'F' ? `${o.NVAL_NUM}${o.UNIT_CD ? ' ' + o.UNIT_CD : ''}` : o.TVAL_CHAR
      console.log(`   [${o.vt}]`, o.CONCEPT_CD.padEnd(40), `(${o.VALTYPE_CD})`, '=', val, '—', o.NAME_CHAR)
    }
  }
}

db.close()
