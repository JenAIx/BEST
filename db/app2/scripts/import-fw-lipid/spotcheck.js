#!/usr/bin/env node
'use strict'

/**
 * Spot-check ~2% of the imported patients by comparing every relevant XLSX cell
 * against what was written to production.db.
 *
 * Verifies for each sampled patient:
 *   - patient row (PATIENT_CD, BIRTH_DATE, SEX_CD, STATECITYZIP_PATH)
 *   - 3 visits (V0 = strokeDate-1, V1 = strokeDate, V2 = v2Date if present)
 *   - all expected observations (vitals, comorbidities, etiology, event type,
 *     labs, drug 3-states, free text notes, age-at-stroke)
 *
 * Fails loud on any discrepancy. Prints a per-patient PASS/FAIL summary.
 */

const path = require('node:path')
const XLSX = require('xlsx')
const Database = require('better-sqlite3')
const M = require('./mapping')
const P = require('./parsers')

const XLSX_PATH = path.resolve('../../tmp/import_fw_lipid_202605/Mastertabelle_Franzi_LDL_Daten_20260513.xlsx')
const DB_PATH = path.resolve('../../database/production.db')
const SOURCE = 'FW_LIPID_XLSX_2026-05-08'

const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
const rowsRaw = XLSX.utils.sheet_to_json(wb.Sheets['Datensammlung'], { defval: null, raw: true })
// Replace U+00A0 (NBSP) with regular space - some XLSX headers carry NBSPs.
function normalizeKey(k) {
  return k.replace(/ /g, ' ')
}
const rows = rowsRaw
  .map((r) => {
    const out = {}
    for (const k of Object.keys(r)) out[normalizeKey(k)] = r[k]
    return out
  })
  .filter((r) => r[M.PATIENT_COL.ID] != null && String(r[M.PATIENT_COL.ID]).trim() !== '')

console.log(`source XLSX rows: ${rowsRaw.length}, with ID: ${rows.length}`)

const db = new Database(DB_PATH, { readonly: true })

// Sample 2% spread evenly across the dataset (every ~48th row).
const sampleCount = Math.max(2, Math.round(rows.length * 0.02))
const step = Math.floor(rows.length / sampleCount)
const sampleIds = []
for (let i = 0; i < sampleCount; i++) {
  const idx = Math.min(rows.length - 1, i * step)
  sampleIds.push(String(rows[idx][M.PATIENT_COL.ID]).trim())
}
console.log(`sampling ${sampleCount} (≈2%) patients:`, sampleIds)
console.log()

function shiftDateBackOneDay(isoDate) {
  if (!isoDate) return null
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
function calcAgeYears(birthIso, eventIso) {
  if (!birthIso || !eventIso) return null
  const birth = new Date(birthIso + 'T00:00:00Z')
  const event = new Date(eventIso + 'T00:00:00Z')
  if (Number.isNaN(birth.getTime()) || Number.isNaN(event.getTime())) return null
  if (event < birth) return null
  let years = event.getUTCFullYear() - birth.getUTCFullYear()
  const mo = event.getUTCMonth() - birth.getUTCMonth()
  if (mo < 0 || (mo === 0 && event.getUTCDate() < birth.getUTCDate())) years -= 1
  return years
}

let totalFailures = 0
const failures = []

for (const pid of sampleIds) {
  const row = rows.find((r) => String(r[M.PATIENT_COL.ID]).trim() === pid)
  if (!row) {
    console.log(`[${pid}] FAIL: not in XLSX`)
    totalFailures += 1
    continue
  }
  const errors = []

  // Patient row
  const pat = db.prepare('SELECT * FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?').get(pid)
  if (!pat) {
    errors.push('PATIENT_DIMENSION row missing')
    failures.push({ pid, errors })
    totalFailures += errors.length
    console.log(`[${pid}] FAIL ${errors.length}: ${errors.join(' | ')}`)
    continue
  }
  const expBirth = P.parseDate(row[M.PATIENT_COL.BIRTH])
  const expSex = P.parseSex(row[M.PATIENT_COL.SEX])
  const expPlz = P.parsePLZ(row[M.PATIENT_COL.PLZ])
  const expZip = expPlz ? `\\DE\\${expPlz}` : null
  if (pat.BIRTH_DATE !== expBirth) errors.push(`BIRTH_DATE: db=${pat.BIRTH_DATE} xlsx=${expBirth}`)
  if (pat.SEX_CD !== expSex) errors.push(`SEX_CD: db=${pat.SEX_CD} xlsx=${expSex}`)
  if (pat.STATECITYZIP_PATH !== expZip) errors.push(`STATECITYZIP_PATH: db=${pat.STATECITYZIP_PATH} xlsx=${expZip}`)

  // Visits
  const strokeDate = P.parseDate(row[M.PATIENT_COL.STROKE_DATE])
  const v2Date = P.parseDate(row[M.PATIENT_COL.V2_DATE])
  if (!strokeDate) {
    errors.push('no stroke date in XLSX - should have been skipped')
    failures.push({ pid, errors })
    continue
  }
  const expV0Date = shiftDateBackOneDay(strokeDate)
  const visits = db
    .prepare(`SELECT ENCOUNTER_NUM, START_DATE, json_extract(VISIT_BLOB, '$.visitType') AS vt FROM VISIT_DIMENSION WHERE PATIENT_NUM = ? AND SOURCESYSTEM_CD = ? ORDER BY ENCOUNTER_NUM`)
    .all(pat.PATIENT_NUM, SOURCE)
  const v0 = visits.find((v) => v.vt === 'stroke_lipid_v0')
  const v1 = visits.find((v) => v.vt === 'stroke_lipid_v1')
  const v2 = visits.find((v) => v.vt === 'stroke_lipid_v2')
  if (!v0) errors.push('V0 missing')
  else if (v0.START_DATE !== expV0Date) errors.push(`V0 date: db=${v0.START_DATE} expect=${expV0Date}`)
  if (!v1) errors.push('V1 missing')
  else if (v1.START_DATE !== strokeDate) errors.push(`V1 date: db=${v1.START_DATE} expect=${strokeDate}`)
  if (v2Date && !v2) errors.push('V2 missing despite V2_Datum in XLSX')
  if (!v2Date && v2) errors.push('V2 present but no V2_Datum in XLSX')
  if (v2Date && v2 && v2.START_DATE !== v2Date) errors.push(`V2 date: db=${v2.START_DATE} expect=${v2Date}`)

  // Observations per concept - compare value
  const obs = db
    .prepare(
      `SELECT o.CONCEPT_CD, o.VALTYPE_CD, o.NVAL_NUM, o.TVAL_CHAR, o.VALUEFLAG_CD, o.UNIT_CD,
              json_extract(v.VISIT_BLOB, '$.visitType') AS vt
       FROM OBSERVATION_FACT o JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
       WHERE o.PATIENT_NUM = ? AND o.SOURCESYSTEM_CD = ?`,
    )
    .all(pat.PATIENT_NUM, SOURCE)
  const obsByConcept = {}
  for (const o of obs) {
    const k = `${o.vt}::${o.CONCEPT_CD}`
    obsByConcept[k] = o
  }

  function checkObs(visit, conceptCode, expValueDescription, predicate) {
    const k = `${visit}::${conceptCode}`
    const o = obsByConcept[k]
    if (expValueDescription === null && !o) return // no obs expected, none found - OK
    if (expValueDescription === null && o) {
      errors.push(`unexpected obs ${k}`)
      return
    }
    if (!o) {
      errors.push(`missing obs ${k} (expected ${expValueDescription})`)
      return
    }
    const problem = predicate(o)
    if (problem) errors.push(`${k} mismatch: ${problem}`)
  }

  // Patient name at V0
  const expName = [P.normString(row[M.PATIENT_COL.NAME]), P.normString(row[M.PATIENT_COL.VORNAME])]
    .filter(Boolean)
    .join(', ')
  if (expName) {
    checkObs('stroke_lipid_v0', M.PATIENT_NAME_CONCEPT, expName, (o) => (o.TVAL_CHAR !== expName ? `tval ${o.TVAL_CHAR} != ${expName}` : null))
  }
  // Stroke event date at V0
  checkObs('stroke_lipid_v0', M.STROKE_EVENT_DATE_CONCEPT, strokeDate, (o) => (o.TVAL_CHAR !== strokeDate ? `date ${o.TVAL_CHAR} != ${strokeDate}` : null))
  // Age at V0
  const expAge = calcAgeYears(expBirth, strokeDate)
  if (expAge != null) {
    checkObs('stroke_lipid_v0', M.AGE_AT_STROKE_CONCEPT, expAge, (o) => (o.NVAL_NUM !== expAge ? `age ${o.NVAL_NUM} != ${expAge}` : null))
  }

  // V0 vitals
  for (const n of M.NUMERIC_V0) {
    const v = row[n.col]
    if (v == null || v === '') {
      checkObs('stroke_lipid_v0', n.concept, null, () => null)
      continue
    }
    const expNum = Number(typeof v === 'string' ? v.replace(',', '.') : v)
    if (!Number.isFinite(expNum)) continue
    checkObs('stroke_lipid_v0', n.concept, expNum, (o) => (Math.abs(o.NVAL_NUM - expNum) > 0.001 ? `${o.NVAL_NUM} != ${expNum}` : null))
  }

  // V0 etiology
  for (const s of M.SELECTIONS_V0) {
    const expCode = P.parseEtiology(row[s.col])
    if (!expCode) {
      checkObs('stroke_lipid_v0', s.concept, null, () => null)
      continue
    }
    checkObs('stroke_lipid_v0', s.concept, expCode, (o) => (o.TVAL_CHAR !== expCode ? `${o.TVAL_CHAR} != ${expCode}` : null))
  }

  // V0 findings
  for (const f of M.FINDINGS_V0) {
    const expVal = P.parseFinding(row[f.col])
    if (expVal == null) {
      checkObs('stroke_lipid_v0', f.concept, null, () => null)
      continue
    }
    const expTval = expVal === 1 ? M.FINDING_YES : M.FINDING_NO
    checkObs('stroke_lipid_v0', f.concept, expTval, (o) => (o.TVAL_CHAR !== expTval ? `${o.TVAL_CHAR} != ${expTval}` : null))
  }

  // V0 drugs - 3-state
  function checkDrug(visit, drug, raw) {
    const k = `${visit}::${drug.concept}`
    const o = obsByConcept[k]
    if (raw == null || raw === '') {
      if (o) errors.push(`unexpected drug obs ${k} - source was null/unknown`)
      return
    }
    const parsed = P.parseDose(raw)
    if (parsed.value == null) {
      if (o) errors.push(`unexpected drug obs ${k} - source unparseable`)
      return
    }
    if (!o) {
      errors.push(`missing drug obs ${k} (expected ${parsed.value === 0 ? 'NV' : parsed.value + 'mg'})`)
      return
    }
    if (parsed.value === 0) {
      if (o.VALUEFLAG_CD !== 'NV') errors.push(`${k} expected VALUEFLAG_CD=NV got ${o.VALUEFLAG_CD}`)
      if (o.NVAL_NUM != null) errors.push(`${k} expected NVAL_NUM=NULL got ${o.NVAL_NUM}`)
    } else {
      if (Math.abs(o.NVAL_NUM - parsed.value) > 0.001) errors.push(`${k}: ${o.NVAL_NUM} != ${parsed.value}`)
    }
  }
  for (const drug of M.DRUGS) {
    if (drug.col.V0) checkDrug('stroke_lipid_v0', drug, row[drug.col.V0])
  }

  // V1 event type
  for (const s of M.SELECTIONS_V1) {
    const expCode = P.parseEventType(row[s.col])
    if (!expCode) {
      checkObs('stroke_lipid_v1', s.concept, null, () => null)
      continue
    }
    checkObs('stroke_lipid_v1', s.concept, expCode, (o) => (o.TVAL_CHAR !== expCode ? `${o.TVAL_CHAR} != ${expCode}` : null))
  }
  // V1 findings
  for (const f of M.FINDINGS_V1) {
    const expVal = P.parseFinding(row[f.col])
    if (expVal == null) {
      checkObs('stroke_lipid_v1', f.concept, null, () => null)
      continue
    }
    const expTval = expVal === 1 ? M.FINDING_YES : M.FINDING_NO
    checkObs('stroke_lipid_v1', f.concept, expTval, (o) => (o.TVAL_CHAR !== expTval ? `${o.TVAL_CHAR} != ${expTval}` : null))
  }
  // V1 labs
  for (const lab of M.LABS) {
    if (!lab.col.V1) continue
    const parsed = P.parseDose(row[lab.col.V1])
    if (parsed.value == null) {
      checkObs('stroke_lipid_v1', lab.concept, null, () => null)
      continue
    }
    checkObs('stroke_lipid_v1', lab.concept, parsed.value, (o) => (Math.abs(o.NVAL_NUM - parsed.value) > 0.001 ? `${o.NVAL_NUM} != ${parsed.value}` : null))
  }
  // V1 drugs
  for (const drug of M.DRUGS) {
    if (drug.col.V1) checkDrug('stroke_lipid_v1', drug, row[drug.col.V1])
  }
  // V1 free text
  for (const t of M.TEXTS_V1 || []) {
    const expText = P.normString(row[t.col])
    if (!expText) {
      checkObs('stroke_lipid_v1', t.concept, null, () => null)
      continue
    }
    checkObs('stroke_lipid_v1', t.concept, expText, (o) => (o.TVAL_CHAR !== expText ? `${o.TVAL_CHAR} != ${expText}` : null))
  }

  // V2 (if present)
  if (v2Date) {
    for (const f of M.FINDINGS_V2) {
      const expVal = P.parseFinding(row[f.col])
      if (expVal == null) {
        checkObs('stroke_lipid_v2', f.concept, null, () => null)
        continue
      }
      const expTval = expVal === 1 ? M.FINDING_YES : M.FINDING_NO
      checkObs('stroke_lipid_v2', f.concept, expTval, (o) => (o.TVAL_CHAR !== expTval ? `${o.TVAL_CHAR} != ${expTval}` : null))
    }
    for (const lab of M.LABS) {
      if (!lab.col.V2) continue
      const parsed = P.parseDose(row[lab.col.V2])
      if (parsed.value == null) {
        checkObs('stroke_lipid_v2', lab.concept, null, () => null)
        continue
      }
      checkObs('stroke_lipid_v2', lab.concept, parsed.value, (o) => (Math.abs(o.NVAL_NUM - parsed.value) > 0.001 ? `${o.NVAL_NUM} != ${parsed.value}` : null))
    }
    for (const drug of M.DRUGS) {
      if (drug.col.V2) checkDrug('stroke_lipid_v2', drug, row[drug.col.V2])
    }
  }

  if (errors.length === 0) {
    console.log(`[${pid}] PASS — ${obs.length} obs, visits: V0+V1${v2 ? '+V2' : ''}`)
  } else {
    console.log(`[${pid}] FAIL ${errors.length}:`)
    for (const e of errors) console.log(`    ${e}`)
    failures.push({ pid, errors })
    totalFailures += errors.length
  }
}

console.log()
console.log(`Sampled ${sampleIds.length} patients, total failures: ${totalFailures}`)
if (totalFailures === 0) {
  console.log('ALL PASS')
  process.exit(0)
} else {
  process.exit(1)
}
