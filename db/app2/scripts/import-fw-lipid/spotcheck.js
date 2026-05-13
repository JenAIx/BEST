#!/usr/bin/env node
'use strict'

/**
 * Full-coverage verifier for the Stroke-Lipid import.
 *
 * Compares every relevant XLSX cell against what was written to production.db,
 * for every patient by default (or a sample via `--sample N` or `--limit N`).
 *
 * Per patient, this script verifies:
 *   - patient row (BIRTH_DATE, SEX_CD, STATECITYZIP_PATH)
 *   - 3 visits (V0 = strokeDate-1, V1 = strokeDate, V2 = v2Date if present)
 *   - patient name observation at V0
 *   - stroke event date observation at V0
 *   - age-at-stroke (auto-computed) at V0
 *   - V0 vitals (Gewicht_kg, Groesse_cm)
 *   - V0 etiology selection
 *   - V0 comorbidities (Yes/No findings via TVAL_CHAR)
 *   - V0/V1/V2 drug 3-state (taking / not-taking / unknown)
 *   - V1 event type selection
 *   - V1 findings (statin intolerance, new med, dose increase)
 *   - V1 + V2 lab observations
 *   - V1 free-text observations (statin symptoms, notes)
 *   - V2 findings (reinfarct, new med, dose increase, our clinic)
 *
 * Additionally, two cross-cutting checks per patient:
 *   - orphan observations (any DB obs not "consumed" by an expected-field check)
 *   - study enrollment (every imported patient must be in STUDY_PATIENT_LOOKUP)
 *
 * CLI:
 *   node spotcheck.js                # all patients (default)
 *   node spotcheck.js --limit 50     # first 50 only
 *   node spotcheck.js --sample 9     # 9 patients evenly spread (legacy 2 % mode)
 *   node spotcheck.js --verbose      # print per-patient PASS lines (default: failures only)
 *
 * On any failure, writes _spotcheck_failures.csv for Excel inspection.
 */

const path = require('node:path')
const fs = require('node:fs')
const XLSX = require('xlsx')
const Database = require('better-sqlite3')
const M = require('./mapping')
const P = require('./parsers')

const XLSX_PATH = path.resolve('../../tmp/import_fw_lipid_202605/Mastertabelle_Franzi_LDL_Daten_20260513.xlsx')
const DB_PATH = path.resolve('../../database/production.db')
const SOURCE = 'FW_LIPID_XLSX_2026-05-08'
const STUDY_CD = 'STROKE_LIPID'
const FAILURES_CSV = path.resolve('./_spotcheck_failures.csv')

const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf('--' + name)
  return i < 0 ? null : args[i + 1]
}
function flag(name) {
  return args.includes('--' + name)
}
const LIMIT = arg('limit') ? Number(arg('limit')) : null
const SAMPLE = arg('sample') ? Number(arg('sample')) : null
const VERBOSE = flag('verbose')

const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
const rowsRaw = XLSX.utils.sheet_to_json(wb.Sheets['Datensammlung'], { defval: null, raw: true })

// Replace U+00A0 (NBSP) with regular space - some XLSX headers carry NBSPs.
// Use explicit Unicode escape; relying on a literal NBSP byte inside the regex
// is fragile (editors silently convert it to a regular space).
function normalizeKey(k) {
  return k.replace(/ /g, ' ')
}
const rowsAll = rowsRaw
  .map((r) => {
    const out = {}
    for (const k of Object.keys(r)) out[normalizeKey(k)] = r[k]
    return out
  })
  .filter((r) => r[M.PATIENT_COL.ID] != null && String(r[M.PATIENT_COL.ID]).trim() !== '')

// Deduplicate by PATIENT_CD - if the source has multiple rows for the same patient
// (it does, e.g. patient 10032698 with two rows), the importer's per-patient
// delete-and-rewrite means the LAST row wins. The verifier must compare against
// the same effective state.
const byId = new Map()
const dupes = []
for (const r of rowsAll) {
  const id = String(r[M.PATIENT_COL.ID]).trim()
  if (byId.has(id)) dupes.push(id)
  byId.set(id, r)
}
const rows = [...byId.values()]

console.log(`source XLSX rows: ${rowsRaw.length}, with ID: ${rowsAll.length}, unique: ${rows.length}`)
if (dupes.length) console.log(`duplicate IDs (importer kept the last row for each): ${[...new Set(dupes)].join(', ')}`)

const db = new Database(DB_PATH, { readonly: true })

// Pre-flight: study enrollment map.
const enrolled = new Set(
  db
    .prepare(
      `SELECT p.PATIENT_CD FROM STUDY_PATIENT_LOOKUP spl
         JOIN STUDY_DIMENSION s   ON s.STUDY_NUM = spl.STUDY_NUM
         JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM = spl.PATIENT_NUM
        WHERE s.STUDY_CD = ?`,
    )
    .all(STUDY_CD)
    .map((r) => r.PATIENT_CD),
)
console.log(`study enrollments in DB: ${enrolled.size}`)

// Decide which patients to check.
let targetRows = rows
if (SAMPLE) {
  const step = Math.floor(rows.length / SAMPLE)
  targetRows = []
  for (let i = 0; i < SAMPLE; i++) {
    targetRows.push(rows[Math.min(rows.length - 1, i * step)])
  }
  console.log(`sampling ${SAMPLE} patients evenly distributed`)
} else if (LIMIT) {
  targetRows = rows.slice(0, LIMIT)
  console.log(`limiting to first ${LIMIT} patients`)
} else {
  console.log(`checking ALL ${rows.length} patients`)
}
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

const stats = {
  patientsChecked: 0,
  patientsPassed: 0,
  patientsSkippedExpected: 0, // legitimately skipped (no Datum_Stroke in source)
  cellsAsserted: 0,
  totalFailures: 0,
  orphanObs: 0,
  missingEnrollments: 0,
  patientsWithFailures: [],
}
const csvLines = ['patient_cd,visit,concept_cd,error_kind,expected,actual']
function csvEscape(s) {
  if (s == null) return ''
  const str = String(s)
  return /[,"\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str
}

for (const row of targetRows) {
  const pid = String(row[M.PATIENT_COL.ID]).trim()
  stats.patientsChecked += 1
  const errors = []
  const consumed = new Set() // tracks "${visit}::${conceptCode}" we've checked

  // Source pre-check: patients without Datum_Stroke are deliberately skipped by the
  // importer. Verify that they are indeed absent from the DB (and skip the rest).
  const srcStrokeDate = P.parseDate(row[M.PATIENT_COL.STROKE_DATE])
  const patProbe = db.prepare('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ? AND SOURCESYSTEM_CD = ?').get(pid, SOURCE)
  if (!srcStrokeDate) {
    if (patProbe) {
      errors.push({
        kind: 'unexpected-patient',
        visit: '-',
        conceptCode: '-',
        expected: 'no import (no Datum_Stroke in source)',
        actual: `present (PATIENT_NUM=${patProbe.PATIENT_NUM})`,
      })
      finalize(pid, errors, consumed, 0)
    } else {
      stats.patientsSkippedExpected += 1
      if (VERBOSE) console.log(`[${pid}] SKIPPED (no Datum_Stroke in source, correctly absent from DB)`)
    }
    continue
  }

  // Patient row check.
  const pat = db.prepare('SELECT * FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?').get(pid)
  if (!pat) {
    errors.push({ kind: 'patient-missing', visit: '-', conceptCode: '-', expected: pid, actual: 'no row in DB' })
    finalize(pid, errors, consumed, 0)
    continue
  }
  const expBirth = P.parseDate(row[M.PATIENT_COL.BIRTH])
  const expSex = P.parseSex(row[M.PATIENT_COL.SEX])
  const expPlz = P.parsePLZ(row[M.PATIENT_COL.PLZ])
  const expZip = expPlz ? `\\DE\\${expPlz}` : null
  assertEq(errors, '-', 'PATIENT.BIRTH_DATE', expBirth, pat.BIRTH_DATE)
  assertEq(errors, '-', 'PATIENT.SEX_CD', expSex, pat.SEX_CD)
  assertEq(errors, '-', 'PATIENT.STATECITYZIP_PATH', expZip, pat.STATECITYZIP_PATH)
  if (!enrolled.has(pid)) {
    errors.push({ kind: 'enrollment-missing', visit: '-', conceptCode: STUDY_CD, expected: 'enrolled', actual: 'not enrolled' })
    stats.missingEnrollments += 1
  }
  stats.cellsAsserted += 4

  // Visits check.
  const strokeDate = srcStrokeDate
  const v2Date = P.parseDate(row[M.PATIENT_COL.V2_DATE])
  const expV0Date = shiftDateBackOneDay(strokeDate)

  const visits = db
    .prepare(
      `SELECT ENCOUNTER_NUM, START_DATE, json_extract(VISIT_BLOB, '$.visitType') AS vt
         FROM VISIT_DIMENSION
        WHERE PATIENT_NUM = ? AND SOURCESYSTEM_CD = ? ORDER BY ENCOUNTER_NUM`,
    )
    .all(pat.PATIENT_NUM, SOURCE)
  const v0 = visits.find((v) => v.vt === 'stroke_lipid_v0')
  const v1 = visits.find((v) => v.vt === 'stroke_lipid_v1')
  const v2 = visits.find((v) => v.vt === 'stroke_lipid_v2')
  assertEq(errors, 'V0', 'VISIT.START_DATE', expV0Date, v0 && v0.START_DATE)
  assertEq(errors, 'V1', 'VISIT.START_DATE', strokeDate, v1 && v1.START_DATE)
  if (v2Date) assertEq(errors, 'V2', 'VISIT.START_DATE', v2Date, v2 && v2.START_DATE)
  else if (v2) errors.push({ kind: 'unexpected-visit', visit: 'V2', conceptCode: '-', expected: 'no V2', actual: `present (${v2.START_DATE})` })
  stats.cellsAsserted += v2Date ? 3 : 2

  // Load all DB observations for this patient.
  const obs = db
    .prepare(
      `SELECT o.CONCEPT_CD, o.VALTYPE_CD, o.NVAL_NUM, o.TVAL_CHAR, o.VALUEFLAG_CD, o.UNIT_CD,
              json_extract(v.VISIT_BLOB, '$.visitType') AS vt
         FROM OBSERVATION_FACT o JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
        WHERE o.PATIENT_NUM = ? AND o.SOURCESYSTEM_CD = ?`,
    )
    .all(pat.PATIENT_NUM, SOURCE)
  const obsByConcept = {}
  for (const o of obs) obsByConcept[`${o.vt}::${o.CONCEPT_CD}`] = o

  function checkObs(visit, conceptCode, expValueOrNull, predicate) {
    const key = `${visit}::${conceptCode}`
    consumed.add(key)
    stats.cellsAsserted += 1
    const o = obsByConcept[key]
    if (expValueOrNull == null) {
      if (o) {
        errors.push({
          kind: 'unexpected-obs',
          visit,
          conceptCode,
          expected: 'no observation (source cell was null/empty)',
          actual: describeObs(o),
        })
      }
      return
    }
    if (!o) {
      errors.push({ kind: 'missing-obs', visit, conceptCode, expected: String(expValueOrNull), actual: '(no obs in DB)' })
      return
    }
    const problem = predicate(o)
    if (problem) errors.push({ kind: 'value-mismatch', visit, conceptCode, expected: String(expValueOrNull), actual: problem })
  }

  // Patient name (V0)
  const expName = [P.normString(row[M.PATIENT_COL.NAME]), P.normString(row[M.PATIENT_COL.VORNAME])]
    .filter(Boolean)
    .join(', ')
  checkObs('stroke_lipid_v0', M.PATIENT_NAME_CONCEPT, expName || null, (o) =>
    o.TVAL_CHAR === expName ? null : `tval='${o.TVAL_CHAR}'`,
  )

  // Stroke event date (V0)
  checkObs('stroke_lipid_v0', M.STROKE_EVENT_DATE_CONCEPT, strokeDate, (o) =>
    o.TVAL_CHAR === strokeDate ? null : `tval='${o.TVAL_CHAR}'`,
  )

  // Age at stroke (V0, computed)
  const expAge = calcAgeYears(expBirth, strokeDate)
  checkObs('stroke_lipid_v0', M.AGE_AT_STROKE_CONCEPT, expAge, (o) => (o.NVAL_NUM === expAge ? null : `nval=${o.NVAL_NUM}`))

  // V0 vitals
  for (const n of M.NUMERIC_V0) {
    const raw = row[n.col]
    if (raw == null || raw === '') {
      checkObs('stroke_lipid_v0', n.concept, null, () => null)
      continue
    }
    const expNum = Number(typeof raw === 'string' ? raw.replace(',', '.') : raw)
    if (!Number.isFinite(expNum)) {
      checkObs('stroke_lipid_v0', n.concept, null, () => null)
      continue
    }
    checkObs('stroke_lipid_v0', n.concept, expNum, (o) =>
      Math.abs(o.NVAL_NUM - expNum) <= 0.001 ? null : `nval=${o.NVAL_NUM}`,
    )
  }

  // V0 etiology
  for (const s of M.SELECTIONS_V0) {
    const expCode = P.parseEtiology(row[s.col])
    checkObs('stroke_lipid_v0', s.concept, expCode, (o) =>
      o.TVAL_CHAR === expCode ? null : `tval='${o.TVAL_CHAR}'`,
    )
  }

  // V0 findings
  for (const f of M.FINDINGS_V0) {
    const expVal = P.parseFinding(row[f.col])
    if (expVal == null) {
      checkObs('stroke_lipid_v0', f.concept, null, () => null)
      continue
    }
    const expTval = expVal === 1 ? M.FINDING_YES : M.FINDING_NO
    checkObs('stroke_lipid_v0', f.concept, expTval, (o) =>
      o.TVAL_CHAR === expTval ? null : `tval='${o.TVAL_CHAR}'`,
    )
  }

  // 3-state drug check (V0/V1/V2)
  function checkDrug(visit, drug, raw) {
    const key = `${visit}::${drug.concept}`
    consumed.add(key)
    stats.cellsAsserted += 1
    const o = obsByConcept[key]
    if (raw == null || raw === '') {
      if (o) errors.push({ kind: 'unexpected-drug', visit, conceptCode: drug.concept, expected: 'no obs (source empty)', actual: describeObs(o) })
      return
    }
    const parsed = P.parseDose(raw)
    if (parsed.value == null) {
      if (o) errors.push({ kind: 'unexpected-drug', visit, conceptCode: drug.concept, expected: 'no obs (source unparseable)', actual: describeObs(o) })
      return
    }
    if (!o) {
      errors.push({
        kind: 'missing-drug',
        visit,
        conceptCode: drug.concept,
        expected: parsed.value === 0 ? 'NV flag' : `${parsed.value} mg`,
        actual: '(no obs in DB)',
      })
      return
    }
    if (parsed.value === 0) {
      if (o.VALUEFLAG_CD !== 'NV')
        errors.push({ kind: 'drug-3state', visit, conceptCode: drug.concept, expected: 'VALUEFLAG_CD=NV', actual: `flag='${o.VALUEFLAG_CD}'` })
      if (o.NVAL_NUM != null)
        errors.push({ kind: 'drug-3state', visit, conceptCode: drug.concept, expected: 'NVAL_NUM=NULL', actual: `nval=${o.NVAL_NUM}` })
    } else if (Math.abs(o.NVAL_NUM - parsed.value) > 0.001) {
      errors.push({ kind: 'drug-3state', visit, conceptCode: drug.concept, expected: `${parsed.value} mg`, actual: `nval=${o.NVAL_NUM}` })
    }
  }
  for (const drug of M.DRUGS) if (drug.col.V0) checkDrug('stroke_lipid_v0', drug, row[drug.col.V0])

  // V1 event type
  for (const s of M.SELECTIONS_V1) {
    const expCode = P.parseEventType(row[s.col])
    checkObs('stroke_lipid_v1', s.concept, expCode, (o) =>
      o.TVAL_CHAR === expCode ? null : `tval='${o.TVAL_CHAR}'`,
    )
  }
  // V1 findings
  for (const f of M.FINDINGS_V1) {
    const expVal = P.parseFinding(row[f.col])
    if (expVal == null) {
      checkObs('stroke_lipid_v1', f.concept, null, () => null)
      continue
    }
    const expTval = expVal === 1 ? M.FINDING_YES : M.FINDING_NO
    checkObs('stroke_lipid_v1', f.concept, expTval, (o) =>
      o.TVAL_CHAR === expTval ? null : `tval='${o.TVAL_CHAR}'`,
    )
  }
  // V1 labs
  for (const lab of M.LABS) {
    if (!lab.col.V1) continue
    const parsed = P.parseDose(row[lab.col.V1])
    if (parsed.value == null) {
      checkObs('stroke_lipid_v1', lab.concept, null, () => null)
      continue
    }
    checkObs('stroke_lipid_v1', lab.concept, parsed.value, (o) =>
      Math.abs(o.NVAL_NUM - parsed.value) <= 0.001 ? null : `nval=${o.NVAL_NUM}`,
    )
  }
  // V1 drugs
  for (const drug of M.DRUGS) if (drug.col.V1) checkDrug('stroke_lipid_v1', drug, row[drug.col.V1])
  // V1 free text
  for (const t of M.TEXTS_V1 || []) {
    const expText = P.normString(row[t.col])
    checkObs('stroke_lipid_v1', t.concept, expText, (o) =>
      o.TVAL_CHAR === expText ? null : `tval='${o.TVAL_CHAR}'`,
    )
  }

  // V2 (only if v2Date present)
  if (v2Date) {
    for (const f of M.FINDINGS_V2) {
      const expVal = P.parseFinding(row[f.col])
      if (expVal == null) {
        checkObs('stroke_lipid_v2', f.concept, null, () => null)
        continue
      }
      const expTval = expVal === 1 ? M.FINDING_YES : M.FINDING_NO
      checkObs('stroke_lipid_v2', f.concept, expTval, (o) =>
        o.TVAL_CHAR === expTval ? null : `tval='${o.TVAL_CHAR}'`,
      )
    }
    for (const lab of M.LABS) {
      if (!lab.col.V2) continue
      const parsed = P.parseDose(row[lab.col.V2])
      if (parsed.value == null) {
        checkObs('stroke_lipid_v2', lab.concept, null, () => null)
        continue
      }
      checkObs('stroke_lipid_v2', lab.concept, parsed.value, (o) =>
        Math.abs(o.NVAL_NUM - parsed.value) <= 0.001 ? null : `nval=${o.NVAL_NUM}`,
      )
    }
    for (const drug of M.DRUGS) if (drug.col.V2) checkDrug('stroke_lipid_v2', drug, row[drug.col.V2])
  }

  // Orphan check: every DB obs must have been consumed by an expected-field check.
  let patientOrphans = 0
  for (const o of obs) {
    const key = `${o.vt}::${o.CONCEPT_CD}`
    if (!consumed.has(key)) {
      patientOrphans += 1
      errors.push({
        kind: 'orphan-obs',
        visit: o.vt,
        conceptCode: o.CONCEPT_CD,
        expected: '(no source field maps here)',
        actual: describeObs(o),
      })
    }
  }
  stats.orphanObs += patientOrphans

  finalize(pid, errors, consumed, obs.length)
}

function describeObs(o) {
  const parts = []
  if (o.NVAL_NUM != null) parts.push(`nval=${o.NVAL_NUM}`)
  if (o.TVAL_CHAR != null) parts.push(`tval='${o.TVAL_CHAR}'`)
  if (o.UNIT_CD) parts.push(`unit=${o.UNIT_CD}`)
  if (o.VALUEFLAG_CD) parts.push(`flag=${o.VALUEFLAG_CD}`)
  return `${o.VALTYPE_CD}{${parts.join(', ')}}`
}

function assertEq(errors, visit, kind, expected, actual) {
  stats.cellsAsserted += 1
  if (expected !== actual) {
    errors.push({ kind: 'value-mismatch', visit, conceptCode: kind, expected: String(expected), actual: String(actual) })
  }
}

function finalize(pid, errors, consumed, dbObsCount) {
  if (errors.length === 0) {
    stats.patientsPassed += 1
    if (VERBOSE) console.log(`[${pid}] PASS — ${dbObsCount} obs, ${consumed.size} cells checked`)
    return
  }
  stats.totalFailures += errors.length
  stats.patientsWithFailures.push(pid)
  console.log(`[${pid}] FAIL ${errors.length}:`)
  for (const e of errors) {
    console.log(`    [${e.visit}] ${e.kind} on ${e.conceptCode}: expected ${e.expected} | actual ${e.actual}`)
    csvLines.push([pid, e.visit, e.conceptCode, e.kind, e.expected, e.actual].map(csvEscape).join(','))
  }
}

// Final report.
console.log()
console.log('==============================================')
console.log('  Stroke-Lipid Import Verification — Summary')
console.log('==============================================')
console.log(`  Patients checked:          ${stats.patientsChecked}`)
console.log(`  Patients passing:          ${stats.patientsPassed}`)
console.log(`  Patients legitimately skipped (no Datum_Stroke): ${stats.patientsSkippedExpected}`)
console.log(`  Patients with failures:    ${stats.patientsWithFailures.length}`)
console.log(`  Cells asserted:            ${stats.cellsAsserted}`)
console.log(`  Total failures:            ${stats.totalFailures}`)
console.log(`  Orphan observations:       ${stats.orphanObs}`)
console.log(`  Missing enrollments:       ${stats.missingEnrollments}`)
console.log()

if (stats.totalFailures > 0) {
  fs.writeFileSync(FAILURES_CSV, csvLines.join('\n'))
  console.log(`✗ Failures detected. Detailed CSV written to:`)
  console.log(`  ${FAILURES_CSV}`)
  process.exit(1)
} else {
  console.log(`✓ ALL PASS — ${stats.cellsAsserted} cell assertions, 0 mismatches.`)
  process.exit(0)
}
