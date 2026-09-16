/**
 * Migration 018 re-creates the patient_list view without the full-table
 * AGE_OBS scan and pins the age source to the exact LOINC "Age" concept.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { patientListViewPerf, AGE_CONCEPT_CD } from '../../src/core/database/migrations/018-patient-list-view-perf.js'

const DB_PATH = './tests/output/patient-list-view-perf-test.db'
let connection

const q = async (sql, params = []) => (await connection.executeQuery(sql, params)).data
const run = (sql, params = []) => connection.executeCommand(sql, params)

beforeAll(async () => {
  fs.mkdirSync('./tests/output', { recursive: true })
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  connection = new RealSQLiteConnection()
  await connection.connect(DB_PATH)
  const mm = new MigrationManager(connection)
  for (const m of [coreSchema, databaseViews, patientListViewPerf]) mm.registerMigration(m)
  await mm.initializeDatabase()

  // concepts: the real Age concept and a look-alike that the old view matched by name
  await run("INSERT INTO CONCEPT_DIMENSION (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, VALTYPE_CD, UNIT_CD) VALUES ('\\LOINC\\63900-5', ?, 'Age', 'N', 'a')", [AGE_CONCEPT_CD])
  await run("INSERT INTO CONCEPT_DIMENSION (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, VALTYPE_CD, UNIT_CD) VALUES ('\\STROKE\\AGE_AT_STROKE', 'STROKE_LIPID:AGE_AT_STROKE', 'Age at stroke event', 'N', 'a')")

  // P1: stored age 60, but an "age at stroke" observation of 55 (old view showed 55)
  await run("INSERT INTO PATIENT_DIMENSION (PATIENT_NUM, PATIENT_CD, AGE_IN_YEARS) VALUES (1, 'P1', 60)")
  await run("INSERT INTO VISIT_DIMENSION (ENCOUNTER_NUM, PATIENT_NUM, START_DATE) VALUES (11, 1, '2024-01-01')")
  await run("INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM, START_DATE) VALUES (11, 1, 'STROKE_LIPID:AGE_AT_STROKE', 'N', 55, '2024-01-01')")

  // P2: no stored age, no birth date, two "Age" observations → latest wins
  await run("INSERT INTO PATIENT_DIMENSION (PATIENT_NUM, PATIENT_CD) VALUES (2, 'P2')")
  await run("INSERT INTO VISIT_DIMENSION (ENCOUNTER_NUM, PATIENT_NUM, START_DATE) VALUES (21, 2, '2023-01-01')")
  await run("INSERT INTO VISIT_DIMENSION (ENCOUNTER_NUM, PATIENT_NUM, START_DATE) VALUES (22, 2, '2025-01-01')")
  await run('INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM, START_DATE) VALUES (21, 2, ?, ?, 40, ?)', [AGE_CONCEPT_CD, 'N', '2023-01-01'])
  await run('INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM, START_DATE) VALUES (22, 2, ?, ?, 42, ?)', [AGE_CONCEPT_CD, 'N', '2025-01-01'])

  // P3: only a birth date → derived
  await run("INSERT INTO PATIENT_DIMENSION (PATIENT_NUM, PATIENT_CD, BIRTH_DATE) VALUES (3, 'P3', '1980-06-15')")
})

afterAll(async () => {
  await connection.disconnect()
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
})

describe('018-patient-list-view-perf', () => {
  it('prefers the stored age over look-alike "age" observations', async () => {
    const [p1] = await q("SELECT AGE_IN_YEARS FROM patient_list WHERE PATIENT_CD = 'P1'")
    expect(p1.AGE_IN_YEARS).toBe(60)
  })

  it('takes the latest exact Age observation when no age is stored', async () => {
    const [p2] = await q("SELECT AGE_IN_YEARS FROM patient_list WHERE PATIENT_CD = 'P2'")
    expect(p2.AGE_IN_YEARS).toBe(42)
  })

  it('derives the age from BIRTH_DATE as last resort', async () => {
    const [p3] = await q("SELECT AGE_IN_YEARS FROM patient_list WHERE PATIENT_CD = 'P3'")
    const expected = Math.floor((Date.now() - new Date('1980-06-15').getTime()) / (365.25 * 86400e3))
    expect(p3.AGE_IN_YEARS).toBe(expected)
  })

  it('keeps every column of the original view', async () => {
    const cols = (await q('PRAGMA table_info(patient_list)')).map((c) => c.name)
    for (const c of ['PATIENT_NUM', 'PATIENT_CD', 'AGE_IN_YEARS', 'SEX_RESOLVED', 'VITAL_STATUS_RESOLVED', 'PATIENT_BLOB', 'UPDATE_DATE', 'IMPORT_DATE', 'STATECITYZIP_PATH']) {
      expect(cols).toContain(c)
    }
  })

  it('no longer materialises an observation scan for point lookups or counts', async () => {
    const plan = (sql) => q(`EXPLAIN QUERY PLAN ${sql}`).then((rows) => rows.map((r) => r.detail).join('\n'))
    const byCode = await plan("SELECT * FROM patient_list WHERE PATIENT_CD = 'P1'")
    expect(byCode).not.toMatch(/MATERIALIZE/)
    expect(byCode).toMatch(/SEARCH PATIENT_DIMENSION USING INDEX/)
    expect(byCode).toMatch(/CORRELATED SCALAR SUBQUERY/)
    const count = await plan('SELECT COUNT(*) FROM patient_list')
    expect(count).not.toMatch(/OBSERVATION_FACT/) // subquery pruned entirely
  })

  it('creates the audit and recent-patient indexes', async () => {
    const idx = (await q("SELECT name FROM sqlite_master WHERE type = 'index'")).map((r) => r.name)
    expect(idx).toContain('idx_observation_valueflag')
    expect(idx).toContain('idx_patient_recent')
    const auditPlan = (await q("EXPLAIN QUERY PLAN SELECT COUNT(*) FROM OBSERVATION_FACT WHERE VALUEFLAG_CD = 'AUDIT'")).map((r) => r.detail).join()
    expect(auditPlan).toMatch(/idx_observation_valueflag/)
  })

  it('is idempotent', async () => {
    await patientListViewPerf.execute(connection)
    const [p1] = await q("SELECT AGE_IN_YEARS FROM patient_list WHERE PATIENT_CD = 'P1'")
    expect(p1.AGE_IN_YEARS).toBe(60)
  })
})
