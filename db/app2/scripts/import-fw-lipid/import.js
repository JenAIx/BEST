#!/usr/bin/env node
'use strict'

/**
 * Stroke-Lipid XLSX -> production.db importer (v2 model).
 *
 * All concept seeding is handled by migration 010-stroke-lipid-seed.js
 * (applied via apply-migration.js). This script ONLY writes
 * patients / visits / observations.
 *
 * Re-runnable: deletes any prior rows tagged with the same
 * SOURCESYSTEM_CD per patient before re-inserting.
 */

const path = require('node:path')
const fs = require('node:fs')
const XLSX = require('xlsx')
const Database = require('better-sqlite3')

const M = require('./mapping')
const P = require('./parsers')

const SOURCE = 'FW_LIPID_XLSX_2026-05-08'

const args = process.argv.slice(2)
function arg(name, def = null) {
  const i = args.indexOf('--' + name)
  if (i < 0) return def
  return args[i + 1]
}
function flag(name) {
  return args.includes('--' + name)
}

const XLSX_PATH = path.resolve(arg('xlsx', '../../tmp/import_fw_lipid_202605/2026-05-08.xlsx'))
const DB_PATH = path.resolve(arg('db', '../../database/production.db'))
const LIMIT = arg('limit') ? Number(arg('limit')) : null
const ONLY = arg('only')
const DRY = flag('dry')

console.log(`xlsx: ${XLSX_PATH}`)
console.log(`db:   ${DB_PATH}`)
console.log(`limit: ${LIMIT ?? 'all'}  only: ${ONLY ?? '-'}  dry: ${DRY}`)

if (!fs.existsSync(XLSX_PATH)) throw new Error('xlsx missing')
if (!fs.existsSync(DB_PATH)) throw new Error('db missing')

const wb = XLSX.readFile(XLSX_PATH, { cellDates: true })
const sheet = wb.Sheets['Datensammlung']
if (!sheet) throw new Error('sheet Datensammlung missing')
const rowsRaw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })

// Normalize header keys: some XLSX headers contain U+00A0 (NBSP) which break exact-match
// lookups against the mapping (mapping uses regular spaces). Replace NBSP with space.
function normalizeKey(k) {
  return k.replace(/ /g, ' ')
}
const rowsAll = rowsRaw.map((r) => {
  const out = {}
  for (const k of Object.keys(r)) out[normalizeKey(k)] = r[k]
  return out
})

let rows = rowsAll.filter((r) => r[M.PATIENT_COL.ID] != null && String(r[M.PATIENT_COL.ID]).trim() !== '')
if (ONLY) rows = rows.filter((r) => String(r[M.PATIENT_COL.ID]).trim() === String(ONLY))
console.log(`rows in sheet: ${rowsAll.length}, candidates: ${rows.length}`)
const work = LIMIT ? rows.slice(0, LIMIT) : rows
console.log(`importing: ${work.length}`)

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Pre-flight: ensure migration 010 has been applied.
const migRow = db.prepare('SELECT name FROM migrations WHERE name = ?').get('010-stroke-lipid-seed')
if (!migRow) {
  console.error('migration 010-stroke-lipid-seed has not been applied. Run: node apply-migration.js')
  db.close()
  process.exit(2)
}

const getPatient = db.prepare('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?')
const insertPatient = db.prepare(`
  INSERT INTO PATIENT_DIMENSION
    (PATIENT_CD, BIRTH_DATE, AGE_IN_YEARS, SEX_CD, STATECITYZIP_PATH, SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE, CREATED_AT, UPDATED_AT)
  VALUES (@PATIENT_CD, @BIRTH_DATE, @AGE, @SEX, @ZIP, @SOURCE, @NOW, @NOW, @NOW, @NOW)
`)
const updatePatient = db.prepare(`
  UPDATE PATIENT_DIMENSION SET
    BIRTH_DATE = COALESCE(@BIRTH_DATE, BIRTH_DATE),
    AGE_IN_YEARS = COALESCE(@AGE, AGE_IN_YEARS),
    SEX_CD = COALESCE(@SEX, SEX_CD),
    STATECITYZIP_PATH = COALESCE(@ZIP, STATECITYZIP_PATH),
    UPDATE_DATE = @NOW,
    UPDATED_AT = @NOW
  WHERE PATIENT_NUM = @PATIENT_NUM
`)

const deleteOldVisits = db.prepare(`DELETE FROM VISIT_DIMENSION WHERE PATIENT_NUM = ? AND SOURCESYSTEM_CD = ?`)
const deleteOldObs = db.prepare(`DELETE FROM OBSERVATION_FACT WHERE PATIENT_NUM = ? AND SOURCESYSTEM_CD = ?`)

const insertVisit = db.prepare(`
  INSERT INTO VISIT_DIMENSION
    (PATIENT_NUM, START_DATE, END_DATE, INOUT_CD, LOCATION_CD, VISIT_BLOB, ACTIVE_STATUS_CD,
     SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE, CREATED_AT, UPDATED_AT)
  VALUES (@PATIENT_NUM, @START_DATE, @END_DATE, @INOUT, @LOCATION, @BLOB, 'active',
          @SOURCE, @NOW, @NOW, @NOW, @NOW)
`)

const insertObs = db.prepare(`
  INSERT INTO OBSERVATION_FACT
    (ENCOUNTER_NUM, PATIENT_NUM, CATEGORY_CHAR, CONCEPT_CD, START_DATE, VALTYPE_CD,
     TVAL_CHAR, NVAL_NUM, UNIT_CD, VALUEFLAG_CD, OBSERVATION_BLOB,
     SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE, CREATED_AT, UPDATED_AT, INSTANCE_NUM)
  VALUES
    (@ENC, @PAT, @CAT, @CD, @SD, @VT, @TVAL, @NVAL, @UNIT, @FLAG, @BLOB,
     @SOURCE, @NOW, @NOW, @NOW, @NOW, 1)
`)

const enrollStudy = db.prepare(`
  INSERT OR IGNORE INTO STUDY_PATIENT_LOOKUP
    (STUDY_NUM, PATIENT_NUM, ENROLLMENT_DATE, ENROLLMENT_STATUS_CD, IMPORT_DATE)
  SELECT s.STUDY_NUM, @PAT, @DATE, 'active', @NOW FROM STUDY_DIMENSION s WHERE s.STUDY_CD = @STUDY_CD
`)

const checkConcept = db.prepare('SELECT 1 FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?')

const stats = {
  patientsInserted: 0,
  patientsUpdated: 0,
  visits: { V0: 0, V1: 0, V2: 0 },
  observations: 0,
  obsByType: { N: 0, T: 0, F: 0, S: 0, D: 0 },
  obsByCategory: {},
  drugsTaking: 0,
  drugsNotTaking: 0,
  drugsUnknown: 0,
  skippedRows: [],
  skippedConcepts: new Set(),
}

function pushObs({ encNum, patNum, conceptCode, valtype, tval, nval, unit, flag, startDate, category, blob }) {
  if (!conceptCode) return
  if (!checkConcept.get(conceptCode)) {
    stats.skippedConcepts.add(conceptCode)
    return
  }
  insertObs.run({
    ENC: encNum,
    PAT: patNum,
    CAT: category || null,
    CD: conceptCode,
    SD: startDate,
    VT: valtype,
    TVAL: tval ?? null,
    NVAL: nval ?? null,
    UNIT: unit ?? null,
    FLAG: flag ?? null,
    BLOB: blob ? JSON.stringify(blob) : null,
    SOURCE,
    NOW: new Date().toISOString(),
  })
  stats.observations += 1
  stats.obsByType[valtype] = (stats.obsByType[valtype] || 0) + 1
  if (category) stats.obsByCategory[category] = (stats.obsByCategory[category] || 0) + 1
}

function findingObs({ encNum, patNum, conceptCode, value01, startDate }) {
  if (value01 == null) return
  pushObs({
    encNum,
    patNum,
    conceptCode,
    valtype: 'F',
    tval: value01 === 1 ? M.FINDING_YES : M.FINDING_NO,
    startDate,
    category: M.CATEGORY.STROKE,
  })
}

// 3-state drug observation: taking / explicit not-taking / unknown.
function drugObs({ encNum, patNum, drug, raw, startDate }) {
  if (raw == null || raw === '') {
    stats.drugsUnknown += 1
    return
  }
  const parsed = P.parseDose(raw)
  if (parsed.value == null) {
    stats.drugsUnknown += 1
    return
  }
  if (parsed.value === 0) {
    // explicit "not taking" - VALUEFLAG_CD='NV', no NVAL_NUM
    pushObs({
      encNum,
      patNum,
      conceptCode: drug.concept,
      valtype: 'N',
      nval: null,
      unit: 'mg',
      flag: 'NV',
      startDate,
      category: M.CATEGORY.MED,
      blob: { sourceValue: 0, explicit: true, meaning: 'not_taking' },
    })
    stats.drugsNotTaking += 1
    return
  }
  // Taking with dose
  pushObs({
    encNum,
    patNum,
    conceptCode: drug.concept,
    valtype: 'N',
    nval: parsed.value,
    unit: 'mg',
    startDate,
    category: M.CATEGORY.MED,
    blob: parsed.note ? { note: parsed.note, raw: parsed.raw } : null,
  })
  stats.drugsTaking += 1
}

function shiftDateBackOneDay(isoDate) {
  if (!isoDate) return null
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// Calculate age (integer years) between two ISO dates. Returns null if either is missing
// or if the from-date is after the to-date.
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

function fieldSetsFor(type) {
  if (type === 'V0') return ['lipid_pre_stroke', 'lipid_drugs']
  if (type === 'V1') return ['lipid_stroke_event', 'lipid_labor', 'lipid_drugs']
  if (type === 'V2') return ['lipid_followup', 'lipid_labor', 'lipid_drugs']
  return []
}

const tx = db.transaction((records) => {
  for (const r of records) {
    const idRaw = r[M.PATIENT_COL.ID]
    const patientCd = String(idRaw).trim()
    if (!patientCd) {
      stats.skippedRows.push({ id: idRaw, reason: 'empty PATIENT_CD' })
      continue
    }

    const birth = P.parseDate(r[M.PATIENT_COL.BIRTH])
    const sex = P.parseSex(r[M.PATIENT_COL.SEX])
    const plz = P.parsePLZ(r[M.PATIENT_COL.PLZ])
    const strokeDate = P.parseDate(r[M.PATIENT_COL.STROKE_DATE])
    const v2Date = P.parseDate(r[M.PATIENT_COL.V2_DATE])
    // Age at stroke is calculated from BIRTH_DATE + Datum_Stroke (more reliable
    // than the XLSX column, which has nulls and Excel-formula leftovers).
    const ageAtStroke = calcAgeYears(birth, strokeDate)
    const name = [P.normString(r[M.PATIENT_COL.NAME]), P.normString(r[M.PATIENT_COL.VORNAME])]
      .filter(Boolean)
      .join(', ')

    if (!strokeDate) {
      stats.skippedRows.push({ id: patientCd, reason: 'no Datum_Stroke' })
      continue
    }

    const v0Date = shiftDateBackOneDay(strokeDate)
    const now = new Date().toISOString()
    const zip = plz ? `\\DE\\${plz}` : null

    let patientRec = getPatient.get(patientCd)
    let patientNum
    if (!patientRec) {
      const info = insertPatient.run({
        PATIENT_CD: patientCd,
        BIRTH_DATE: birth,
        AGE: ageAtStroke,
        SEX: sex,
        ZIP: zip,
        SOURCE,
        NOW: now,
      })
      patientNum = info.lastInsertRowid
      stats.patientsInserted += 1
    } else {
      patientNum = patientRec.PATIENT_NUM
      updatePatient.run({
        PATIENT_NUM: patientNum,
        BIRTH_DATE: birth,
        AGE: ageAtStroke,
        SEX: sex,
        ZIP: zip,
        NOW: now,
      })
      stats.patientsUpdated += 1
    }

    deleteOldVisits.run(patientNum, SOURCE)
    deleteOldObs.run(patientNum, SOURCE)
    enrollStudy.run({ PAT: patientNum, DATE: strokeDate, NOW: now, STUDY_CD: M.STUDY.STUDY_CD })

    function createVisit(type, startDate, endDate) {
      const info = insertVisit.run({
        PATIENT_NUM: patientNum,
        START_DATE: startDate,
        END_DATE: endDate,
        INOUT: M.INOUT_CD[type] || 'O',
        LOCATION: M.LOCATION_CD,
        BLOB: JSON.stringify({
          visitType: M.VISIT_TYPE[type],
          study: M.STUDY.STUDY_CD,
          fieldSets: fieldSetsFor(type),
          createdBy: 'FW_LIPID_IMPORTER',
          createdAt: now,
        }),
        SOURCE,
        NOW: now,
      })
      stats.visits[type] += 1
      return info.lastInsertRowid
    }

    const encV0 = createVisit('V0', v0Date, v0Date)
    const encV1 = createVisit('V1', strokeDate, strokeDate)
    const encV2 = v2Date ? createVisit('V2', v2Date, v2Date) : null

    // === V0: pre-stroke baseline ===
    if (name) {
      pushObs({
        encNum: encV0,
        patNum: patientNum,
        conceptCode: M.PATIENT_NAME_CONCEPT,
        valtype: 'T',
        tval: name,
        startDate: v0Date,
        category: M.CATEGORY.DEMO,
      })
    }
    // Index stroke event date as D-type at V0
    pushObs({
      encNum: encV0,
      patNum: patientNum,
      conceptCode: M.STROKE_EVENT_DATE_CONCEPT,
      valtype: 'D',
      tval: strokeDate,
      startDate: v0Date,
      category: M.CATEGORY.STROKE,
    })
    // Age at stroke (auto-computed from BIRTH_DATE + Datum_Stroke)
    if (ageAtStroke != null) {
      pushObs({
        encNum: encV0,
        patNum: patientNum,
        conceptCode: M.AGE_AT_STROKE_CONCEPT,
        valtype: 'N',
        nval: ageAtStroke,
        unit: 'years',
        startDate: v0Date,
        category: M.CATEGORY.STROKE,
        blob: { computed: true, from: 'BIRTH_DATE + Datum_Stroke' },
      })
    }
    // V0 numerics (Gewicht_kg / Groesse_cm)
    for (const n of M.NUMERIC_V0) {
      const v = r[n.col]
      if (v == null || v === '') continue
      const num = Number(typeof v === 'string' ? v.replace(',', '.') : v)
      if (!Number.isFinite(num)) continue
      pushObs({
        encNum: encV0,
        patNum: patientNum,
        conceptCode: n.concept,
        valtype: 'N',
        nval: num,
        unit: n.unit,
        startDate: v0Date,
        category: n.category === 'VITALS' ? M.CATEGORY.VITALS : M.CATEGORY.STROKE,
      })
    }
    // V0 etiology selection
    for (const s of M.SELECTIONS_V0) {
      const raw = r[s.col]
      const optionCode = s.parser === 'etiology' ? P.parseEtiology(raw) : null
      if (!optionCode) continue
      pushObs({
        encNum: encV0,
        patNum: patientNum,
        conceptCode: s.concept,
        valtype: 'S',
        tval: optionCode,
        startDate: v0Date,
        category: M.CATEGORY.STROKE,
        blob: { rawValue: String(raw) },
      })
    }
    // V0 comorbidities (Findings via TVAL Yes/No)
    for (const f of M.FINDINGS_V0) {
      findingObs({
        encNum: encV0,
        patNum: patientNum,
        conceptCode: f.concept,
        value01: P.parseFinding(r[f.col]),
        startDate: v0Date,
      })
    }
    // V0 drugs (3-state)
    for (const drug of M.DRUGS) {
      if (!drug.col.V0) continue
      drugObs({
        encNum: encV0,
        patNum: patientNum,
        drug,
        raw: r[drug.col.V0],
        startDate: v0Date,
      })
    }

    // === V1: index stroke ===
    for (const s of M.SELECTIONS_V1) {
      const raw = r[s.col]
      const optionCode = s.parser === 'eventType' ? P.parseEventType(raw) : null
      if (!optionCode) continue
      pushObs({
        encNum: encV1,
        patNum: patientNum,
        conceptCode: s.concept,
        valtype: 'S',
        tval: optionCode,
        startDate: strokeDate,
        category: M.CATEGORY.STROKE,
        blob: { rawValue: String(raw) },
      })
    }
    for (const f of M.FINDINGS_V1) {
      findingObs({
        encNum: encV1,
        patNum: patientNum,
        conceptCode: f.concept,
        value01: P.parseFinding(r[f.col]),
        startDate: strokeDate,
      })
    }
    for (const lab of M.LABS) {
      if (!lab.col.V1) continue
      const raw = r[lab.col.V1]
      const parsed = P.parseDose(raw)
      if (parsed.value == null) continue
      const dateOverride = lab.dateCol && lab.dateCol.V1 ? P.parseDate(r[lab.dateCol.V1]) : null
      pushObs({
        encNum: encV1,
        patNum: patientNum,
        conceptCode: lab.concept,
        valtype: 'N',
        nval: parsed.value,
        unit: lab.unit,
        startDate: dateOverride || strokeDate,
        category: M.CATEGORY.LAB,
        blob: parsed.note ? { censored: parsed.note, raw: parsed.raw } : null,
      })
    }
    for (const drug of M.DRUGS) {
      if (!drug.col.V1) continue
      drugObs({
        encNum: encV1,
        patNum: patientNum,
        drug,
        raw: r[drug.col.V1],
        startDate: strokeDate,
      })
    }
    // V1 free text (statin intolerance symptoms, study notes)
    for (const t of M.TEXTS_V1 || []) {
      const txt = P.normString(r[t.col])
      if (!txt) continue
      pushObs({
        encNum: encV1,
        patNum: patientNum,
        conceptCode: t.concept,
        valtype: 'T',
        tval: txt,
        startDate: strokeDate,
        category: M.CATEGORY.STROKE,
      })
    }

    // === V2: follow-up ===
    if (encV2) {
      for (const f of M.FINDINGS_V2) {
        findingObs({
          encNum: encV2,
          patNum: patientNum,
          conceptCode: f.concept,
          value01: P.parseFinding(r[f.col]),
          startDate: v2Date,
        })
      }
      for (const lab of M.LABS) {
        if (!lab.col.V2) continue
        const raw = r[lab.col.V2]
        const parsed = P.parseDose(raw)
        if (parsed.value == null) continue
        const dateOverride = lab.dateCol && lab.dateCol.V2 ? P.parseDate(r[lab.dateCol.V2]) : null
        pushObs({
          encNum: encV2,
          patNum: patientNum,
          conceptCode: lab.concept,
          valtype: 'N',
          nval: parsed.value,
          unit: lab.unit,
          startDate: dateOverride || v2Date,
          category: M.CATEGORY.LAB,
          blob: parsed.note ? { censored: parsed.note, raw: parsed.raw } : null,
        })
      }
      for (const drug of M.DRUGS) {
        if (!drug.col.V2) continue
        drugObs({
          encNum: encV2,
          patNum: patientNum,
          drug,
          raw: r[drug.col.V2],
          startDate: v2Date,
        })
      }
    }
  }
})

if (DRY) {
  console.log('DRY run - would have imported', work.length, 'patients')
  db.close()
  process.exit(0)
}

const t0 = Date.now()
tx(work)
const dt = Date.now() - t0

console.log('--- IMPORT DONE ---')
console.log(JSON.stringify(stats, (k, v) => (v instanceof Set ? [...v] : v), 2))
console.log(`elapsed: ${dt} ms`)
db.close()
