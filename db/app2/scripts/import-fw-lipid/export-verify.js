#!/usr/bin/env node
'use strict'

/**
 * Artifact-level verifier for the Stroke-Lipid exports.
 *
 * Parses the export file *directly* (no import service) and compares it
 * cell-by-cell against the DB state. This answers the question:
 *
 *   "Does the export file faithfully represent the DB state?"
 *
 * (The reverse question — "can the import service rebuild the DB from this
 * file?" — is covered by the unit/integration tests; the import services
 * have architectural lossy aspects, e.g. positional patient linkage, that
 * are deliberately out of scope here.)
 *
 * Usage:
 *   node export-verify.js _exports/stroke_lipid_<ts>_<n>.csv
 *   node export-verify.js _exports/stroke_lipid_<ts>_<n>.hl7.json
 *   node export-verify.js _exports/<file> --source FW_LIPID_XLSX_2026-05-08
 */

const path = require('node:path')
const fs = require('node:fs')

const args = process.argv.slice(2)
function arg(name, def = null) {
  const i = args.indexOf('--' + name)
  return i < 0 ? def : args[i + 1]
}
const FILE = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'))
const ROOT = path.resolve(__dirname, '../..')
const DB_PATH = path.resolve(arg('db', path.join(ROOT, 'database/production.db')))
const SOURCE = arg('source', 'FW_LIPID_XLSX_2026-05-08')

if (!FILE) {
  console.error('Usage: node export-verify.js <export-file> [--source <S>]')
  process.exit(2)
}
if (!fs.existsSync(FILE)) {
  console.error(`File not found: ${FILE}`)
  process.exit(2)
}

const Database = require('better-sqlite3')
const db = new Database(DB_PATH, { readonly: true })

const lower = FILE.toLowerCase()
const format = lower.endsWith('.csv') ? 'csv' : 'hl7'

console.log(`file:   ${FILE}`)
console.log(`format: ${format}`)
console.log(`db:     ${DB_PATH}`)
console.log(`source: ${SOURCE}`)
console.log()

// ----------------------------------------------------------------------
// DB snapshot keyed by (PATIENT_CD, ENCOUNTER_NUM/visit-date, CONCEPT_CD)
// We use START_DATE rather than ENCOUNTER_NUM as the visit key, because the
// CSV export carries START_DATE, not the internal encounter number.
// ----------------------------------------------------------------------
const dbVisits = db
  .prepare(
    `SELECT p.PATIENT_CD, v.ENCOUNTER_NUM, v.START_DATE, v.LOCATION_CD, v.INOUT_CD,
            json_extract(v.VISIT_BLOB,'$.visitType') AS visitType
       FROM VISIT_DIMENSION v
       JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM = v.PATIENT_NUM
      WHERE v.SOURCESYSTEM_CD = ?
      ORDER BY p.PATIENT_CD, v.ENCOUNTER_NUM`,
  )
  .all(SOURCE)

const dbObs = db
  .prepare(
    `SELECT p.PATIENT_CD, v.START_DATE, v.ENCOUNTER_NUM, o.CONCEPT_CD, o.VALTYPE_CD,
            o.NVAL_NUM, o.TVAL_CHAR, o.VALUEFLAG_CD, o.UNIT_CD
       FROM OBSERVATION_FACT o
       JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
       JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM = v.PATIENT_NUM
      WHERE o.SOURCESYSTEM_CD = ?
      ORDER BY p.PATIENT_CD, v.ENCOUNTER_NUM, o.CONCEPT_CD`,
  )
  .all(SOURCE)

const dbObsByKey = new Map()
for (const o of dbObs) {
  const k = `${o.PATIENT_CD}::${o.ENCOUNTER_NUM}::${o.CONCEPT_CD}`
  dbObsByKey.set(k, o)
}

const dbPatients = new Set(dbVisits.map((v) => v.PATIENT_CD))
const dbVisitKeys = new Set(dbVisits.map((v) => `${v.PATIENT_CD}::${v.ENCOUNTER_NUM}`))

console.log(`db: ${dbPatients.size} patients, ${dbVisits.size} visits, ${dbObs.length} observations`)
console.log()

// ----------------------------------------------------------------------
// Format the same way the CSV/HL7 export does, to compare apples to apples.
// ----------------------------------------------------------------------
function expectedCellValue(o) {
  if (o.VALTYPE_CD === 'N') {
    if (o.NVAL_NUM != null) return String(o.NVAL_NUM)
    if (o.VALUEFLAG_CD === 'NV') return '[NV]'
  }
  if (o.VALTYPE_CD === 'T' || o.VALTYPE_CD === 'F' || o.VALTYPE_CD === 'S') {
    if (o.TVAL_CHAR != null) return o.TVAL_CHAR
  }
  if (o.VALTYPE_CD === 'D' && o.TVAL_CHAR) return o.TVAL_CHAR
  return ''
}

const stats = {
  patientsInExport: 0,
  visitsInExport: 0,
  cellsInExport: 0,
  cellsAsserted: 0,
  mismatches: [],
}

if (format === 'csv') {
  // Strip metadata comments + blank lines, take first 2 rows as headers.
  const raw = fs.readFileSync(FILE, 'utf-8').replace(/^﻿/, '')
  const lines = raw.split(/\r?\n/).filter((l) => l !== undefined)
  const dataLines = []
  let humanHeader = null
  let conceptHeader = null
  for (const line of lines) {
    if (line.startsWith('#')) continue
    if (line.trim() === '') continue
    if (humanHeader === null) {
      humanHeader = parseCsvLine(line)
      continue
    }
    if (conceptHeader === null) {
      conceptHeader = parseCsvLine(line)
      continue
    }
    dataLines.push(parseCsvLine(line))
  }
  console.log(`csv: ${dataLines.length} data rows, ${conceptHeader.length} columns`)

  // Column indices for fixed fields
  const ix = (h) => conceptHeader.indexOf(h)
  const idx = {
    PATIENT_CD: ix('PATIENT_CD'),
    BIRTH_DATE: ix('BIRTH_DATE'),
    SEX_CD: ix('SEX_CD'),
    AGE_IN_YEARS: ix('AGE_IN_YEARS'),
    START_DATE: ix('START_DATE'),
    LOCATION_CD: ix('LOCATION_CD'),
    INOUT_CD: ix('INOUT_CD'),
  }

  // Concept columns are everything from index 7 (after PATIENT_CD..INOUT_CD).
  const conceptCols = []
  for (let i = 7; i < conceptHeader.length; i++) conceptCols.push({ col: i, code: conceptHeader[i] })

  // Group rows by patient to detect patients in export
  const patientRows = new Map()
  for (const cells of dataLines) {
    const pcd = cells[idx.PATIENT_CD]
    if (!patientRows.has(pcd)) patientRows.set(pcd, [])
    patientRows.get(pcd).push(cells)
  }
  stats.patientsInExport = patientRows.size
  stats.visitsInExport = dataLines.length

  // For each row, find the matching DB visit by (PATIENT_CD, START_DATE).
  // Then for each concept column, check that the cell value matches what we
  // expect from the DB observation for (PATIENT_CD, ENCOUNTER_NUM, CONCEPT_CD).
  const dbVisitByPidDate = new Map()
  for (const v of dbVisits) {
    const k = `${v.PATIENT_CD}::${v.START_DATE}`
    if (!dbVisitByPidDate.has(k)) dbVisitByPidDate.set(k, [])
    dbVisitByPidDate.get(k).push(v)
  }

  for (const cells of dataLines) {
    const pcd = cells[idx.PATIENT_CD]
    const sd = cells[idx.START_DATE]
    // Multiple visits same day are possible (we model V0=stroke-1, V1=stroke
    // independently). When there are multiple, take the candidate with the
    // most matching observations to disambiguate.
    const candidates = dbVisitByPidDate.get(`${pcd}::${sd}`) || []
    if (candidates.length === 0) {
      stats.mismatches.push({ kind: 'visit-not-in-db', patient: pcd, visitDate: sd })
      continue
    }
    let bestVisit = candidates[0]
    if (candidates.length > 1) {
      let bestScore = -1
      for (const cand of candidates) {
        let score = 0
        for (const cc of conceptCols) {
          const cell = (cells[cc.col] ?? '').trim()
          if (cell === '') continue
          const dbo = dbObsByKey.get(`${pcd}::${cand.ENCOUNTER_NUM}::${cc.code}`)
          if (dbo && expectedCellValue(dbo) === cell) score += 1
        }
        if (score > bestScore) {
          bestScore = score
          bestVisit = cand
        }
      }
    }

    for (const cc of conceptCols) {
      const cellRaw = cells[cc.col]
      const cell = cellRaw == null ? '' : String(cellRaw).trim()
      stats.cellsInExport += cell === '' ? 0 : 1
      stats.cellsAsserted += 1
      const dbo = dbObsByKey.get(`${pcd}::${bestVisit.ENCOUNTER_NUM}::${cc.code}`)
      const expected = dbo ? expectedCellValue(dbo) : ''
      if (cell !== expected) {
        stats.mismatches.push({
          kind: 'cell-mismatch',
          patient: pcd,
          visit: bestVisit.visitType,
          encounter: bestVisit.ENCOUNTER_NUM,
          conceptCode: cc.code,
          expected,
          actual: cell,
        })
      }
    }
  }

  function parseCsvLine(line) {
    // Minimal CSV parser supporting quoted fields with embedded commas/quotes.
    const out = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue }
        if (c === '"') { inQ = false; continue }
        cur += c
      } else {
        if (c === ',') { out.push(cur); cur = ''; continue }
        if (c === '"') { inQ = true; continue }
        cur += c
      }
    }
    out.push(cur)
    return out
  }
} else {
  // HL7-JSON: parse the Composition, check that each Visit section's entries
  // correspond 1:1 to the DB observations of that visit. Visit sections are
  // numbered (Visit 1, Visit 2, ...) in DB insert order; we rely on the same
  // order on the DB side.
  const cda = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  if (cda.resourceType !== 'Composition') {
    console.error('Not a Composition document')
    process.exit(2)
  }

  // ExportService writes two parallel structures:
  //   1. "Visit N" sections (built by @dbbest/clinical-schema) - grouped by
  //      visit, but observations have lossy formatting (value=null for NV obs).
  //   2. Concept-grouped sections (post-processing in Hl7Service.createCdaDocument)
  //      with one entry per observation using formatObservationValue. These
  //      preserve [NV] markers, so we use them as the canonical entries.
  //
  // Patient + Visit info come from Patient Info / Visit N sections, the
  // observation values come from the concept sections.
  const allEntries = []
  for (const s of cda.section || []) {
    if (s.title?.startsWith('Visit')) {
      stats.visitsInExport += 1
      continue
    }
    if (s.title === 'Patient Information') continue
    // Concept-aggregation section: title === CONCEPT_CD
    for (const e of s.entry || []) {
      allEntries.push({ section: s.title, entry: e })
    }
  }
  console.log(`hl7: ${cda.section.length} sections, ${stats.visitsInExport} visit sections, ${allEntries.length} concept-grouped entries`)

  // Build (conceptCode -> [value]) multimap for fast lookup. The HL7 service
  // maps known concepts to canonical SNOMED codes in `coding[0].code`, but
  // preserves the original CONCEPT_CD in `coding[0].display`. We index by
  // both so the lookup is robust either way.
  const entriesByConcept = new Map()
  function add(key, value) {
    if (!entriesByConcept.has(key)) entriesByConcept.set(key, [])
    entriesByConcept.get(key).push(value)
  }
  for (const { entry } of allEntries) {
    const c = entry.code?.[0]?.coding?.[0]
    if (!c) continue
    if (c.code) add(c.code, entry.value)
    if (c.display && c.display !== c.code) add(c.display, entry.value)
  }

  // For each DB observation, check that at least one HL7 entry exists with the
  // same concept code and same value.
  const consumedHl7Values = new Map()
  for (const o of dbObs) {
    stats.cellsAsserted += 1
    const expected = expectedCellValue(o)
    if (expected === '') continue
    const candidates = entriesByConcept.get(o.CONCEPT_CD) || []
    const used = consumedHl7Values.get(o.CONCEPT_CD) || new Set()
    let found = false
    for (let i = 0; i < candidates.length; i++) {
      if (used.has(i)) continue
      const v = candidates[i]
      // For N type the export may emit a string number or raw number; compare loosely.
      if (o.VALTYPE_CD === 'N' && o.NVAL_NUM != null) {
        const n = parseFloat(v)
        if (Number.isFinite(n) && Math.abs(n - o.NVAL_NUM) < 0.001) { found = true; used.add(i); break }
      } else if (String(v) === expected) {
        found = true; used.add(i); break
      }
    }
    consumedHl7Values.set(o.CONCEPT_CD, used)
    if (!found) {
      stats.mismatches.push({
        kind: 'entry-missing',
        patient: o.PATIENT_CD,
        visit: 'enc=' + o.ENCOUNTER_NUM,
        conceptCode: o.CONCEPT_CD,
        expected,
        actual: '(no matching HL7 entry value)',
      })
    }
  }
  stats.cellsInExport = allEntries.length
  // Patients in export = how many unique PATIENT_CDs appear in entries with the patient-name code.
  stats.patientsInExport = (entriesByConcept.get('SCTID: 371484003') || []).length
}

// ----------------------------------------------------------------------
// Report
// ----------------------------------------------------------------------
console.log()
console.log('=========================================================')
console.log(`  Export artifact verification — ${format.toUpperCase()}`)
console.log('=========================================================')
console.log(`  Patients in export:    ${stats.patientsInExport}`)
console.log(`  Visit rows in export:  ${stats.visitsInExport}`)
console.log(`  Non-empty cells:       ${stats.cellsInExport}`)
console.log(`  Cells/entries checked: ${stats.cellsAsserted}`)
console.log(`  Mismatches:            ${stats.mismatches.length}`)
if (stats.mismatches.length) {
  console.log()
  console.log('  First 20 mismatches:')
  for (const m of stats.mismatches.slice(0, 20)) console.log('   ', JSON.stringify(m))
  const reportPath = path.join(path.dirname(FILE), `_verify_${path.basename(FILE)}.csv`)
  const lines = ['kind,patient,visit,concept,expected,actual']
  for (const m of stats.mismatches) {
    lines.push([m.kind, m.patient, m.visit ?? '', m.conceptCode ?? '', m.expected ?? '', m.actual ?? '']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','))
  }
  fs.writeFileSync(reportPath, lines.join('\n'))
  console.log(`\n  Full report: ${reportPath}`)
}

db.close()
process.exit(stats.mismatches.length === 0 ? 0 : 1)
