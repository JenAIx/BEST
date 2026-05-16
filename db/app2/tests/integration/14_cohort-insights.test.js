/**
 * Integration tests for StudyRepository cohort-insights methods.
 *
 * The aggregates are SQL-shaped (GROUP BY, COUNT DISTINCT, JSON-extract on
 * VISIT_BLOB), so we run them against a real SQLite instance with a small
 * hand-seeded cohort rather than mocking. Test cohort layout:
 *
 *   Study STUDY_A (4 enrolled patients):
 *     P1: V0 + V1; AFib = Yes, Atorvastatin 40mg (taking), ASS NV, LDL 3.0 at V1
 *     P2: V0 + V1 + V2; AFib = No, Atorvastatin 80mg (taking), LDL 4.0 at V1, 1.8 at V2
 *     P3: V0 only;     AFib = Yes, ASS taking 100mg, LDL 5.5 at V0
 *     P4: V0 + V1;     no obs at all
 *   Study STUDY_B (1 enrolled): smoke-isolation check
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import StudyRepository from '../../src/core/database/repositories/study-repository.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { studyTables } from '../../src/core/database/migrations/004-study-tables.js'

const YES = 'SCTID: 373066001'
const NO = 'SCTID: 373067005'
const DB_PATH = './tests/output/cohort-insights-test.db'

let connection
let repo

async function seedFixture() {
  // STUDY rows
  await connection.executeCommand(
    `INSERT INTO STUDY_DIMENSION (STUDY_CD, NAME_CHAR, STATUS_CD) VALUES ('STUDY_A', 'A', 'active'), ('STUDY_B', 'B', 'active')`,
  )
  const aStudy = (await connection.executeQuery('SELECT STUDY_NUM FROM STUDY_DIMENSION WHERE STUDY_CD=?', ['STUDY_A'])).data[0].STUDY_NUM
  const bStudy = (await connection.executeQuery('SELECT STUDY_NUM FROM STUDY_DIMENSION WHERE STUDY_CD=?', ['STUDY_B'])).data[0].STUDY_NUM

  // Concept rows: drugs (N), one F-finding, one S-selection + 2 A-options, one lab.
  const concepts = [
    ['TEST:DRUG:ASS', 'ASS', 'N', 'mg'],
    ['TEST:DRUG:ATORVA', 'Atorvastatin', 'N', 'mg'],
    ['TEST:FINDING:AFIB', 'Atrial fibrillation', 'F', null],
    ['TEST:SEL:ETIO', 'Etiology', 'S', null],
    ['TEST:ETIO:CRYPTO', 'Cryptogenic', 'A', null],
    ['TEST:ETIO:MACRO', 'Macroangiopathic', 'A', null],
    ['LID:TEST-LDL', 'LDL', 'N', 'mmol/l'],
    // The Yes/No A-type answer concepts must exist for finding queries to resolve names.
    [YES, 'Yes', 'A', null],
    [NO, 'No', 'A', null],
  ]
  for (const [cd, name, vt, unit] of concepts) {
    await connection.executeCommand(
      `INSERT INTO CONCEPT_DIMENSION (CONCEPT_CD, NAME_CHAR, VALTYPE_CD, UNIT_CD) VALUES (?, ?, ?, ?)`,
      [cd, name, vt, unit],
    )
  }

  // Patients P1..P4 in STUDY_A, P5 in STUDY_B.
  const patientNumByCd = {}
  for (const cd of ['P1', 'P2', 'P3', 'P4', 'P5']) {
    await connection.executeCommand(`INSERT INTO PATIENT_DIMENSION (PATIENT_CD) VALUES (?)`, [cd])
    const pat = (await connection.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD=?', [cd])).data[0]
    patientNumByCd[cd] = pat.PATIENT_NUM
  }

  // Enrolments
  for (const cd of ['P1', 'P2', 'P3', 'P4']) {
    await connection.executeCommand(
      `INSERT INTO STUDY_PATIENT_LOOKUP (STUDY_NUM, PATIENT_NUM, ENROLLMENT_STATUS_CD) VALUES (?, ?, 'active')`,
      [aStudy, patientNumByCd[cd]],
    )
  }
  await connection.executeCommand(
    `INSERT INTO STUDY_PATIENT_LOOKUP (STUDY_NUM, PATIENT_NUM, ENROLLMENT_STATUS_CD) VALUES (?, ?, 'active')`,
    [bStudy, patientNumByCd['P5']],
  )

  // Visits — VISIT_BLOB carries visitType so cohort lab summary can group by it.
  const visits = [
    ['P1', '2024-01-01', 'v0'],
    ['P1', '2024-01-02', 'v1'],
    ['P2', '2024-02-01', 'v0'],
    ['P2', '2024-02-02', 'v1'],
    ['P2', '2024-05-01', 'v2'],
    ['P3', '2024-03-01', 'v0'],
    ['P4', '2024-04-01', 'v0'],
    ['P4', '2024-04-02', 'v1'],
  ]
  const visitNumByKey = {}
  for (const [cd, date, type] of visits) {
    const blob = JSON.stringify({ visitType: type })
    await connection.executeCommand(
      `INSERT INTO VISIT_DIMENSION (PATIENT_NUM, START_DATE, VISIT_BLOB, ACTIVE_STATUS_CD) VALUES (?, ?, ?, 'active')`,
      [patientNumByCd[cd], date, blob],
    )
    const row = (await connection.executeQuery(
      'SELECT ENCOUNTER_NUM FROM VISIT_DIMENSION WHERE PATIENT_NUM=? AND START_DATE=?',
      [patientNumByCd[cd], date],
    )).data[0]
    visitNumByKey[`${cd}-${type}`] = row.ENCOUNTER_NUM
  }

  // Observations
  // P1: AFib Yes, Atorva 40 (taking), ASS NV, LDL 3.0 at V1
  const obs = [
    ['P1', 'v0', 'TEST:FINDING:AFIB', 'F', null, YES, null],
    ['P1', 'v0', 'TEST:DRUG:ATORVA', 'N', 40, null, null],
    ['P1', 'v0', 'TEST:DRUG:ASS', 'N', null, null, 'NV'],
    ['P1', 'v1', 'LID:TEST-LDL', 'N', 3.0, null, null],
    // P2: AFib No, Atorva 80 (taking), LDL 4.0 at V1, 1.8 at V2
    ['P2', 'v0', 'TEST:FINDING:AFIB', 'F', null, NO, null],
    ['P2', 'v0', 'TEST:DRUG:ATORVA', 'N', 80, null, null],
    ['P2', 'v0', 'TEST:SEL:ETIO', 'S', null, 'TEST:ETIO:CRYPTO', null],
    ['P2', 'v1', 'LID:TEST-LDL', 'N', 4.0, null, null],
    ['P2', 'v2', 'LID:TEST-LDL', 'N', 1.8, null, null],
    // P3: AFib Yes, ASS taking 100mg, LDL 5.5 at V0
    ['P3', 'v0', 'TEST:FINDING:AFIB', 'F', null, YES, null],
    ['P3', 'v0', 'TEST:DRUG:ASS', 'N', 100, null, null],
    ['P3', 'v0', 'TEST:SEL:ETIO', 'S', null, 'TEST:ETIO:MACRO', null],
    ['P3', 'v0', 'LID:TEST-LDL', 'N', 5.5, null, null],
    // P4: no obs.
  ]
  for (const [cd, type, concept, vt, nval, tval, flag] of obs) {
    const enc = visitNumByKey[`${cd}-${type}`]
    await connection.executeCommand(
      `INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM, TVAL_CHAR, VALUEFLAG_CD)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [enc, patientNumByCd[cd], concept, vt, nval, tval, flag],
    )
  }
}

beforeAll(async () => {
  const outputDir = path.dirname(DB_PATH)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  connection = new RealSQLiteConnection()
  await connection.connect(DB_PATH)
  const mm = new MigrationManager(connection)
  mm.registerMigration(coreSchema)
  mm.registerMigration(databaseViews)
  mm.registerMigration(studyTables)
  await mm.initializeDatabase()
  await seedFixture()
  repo = new StudyRepository(connection)
})

afterAll(async () => {
  await connection.disconnect()
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
})

describe('StudyRepository cohort insights', () => {
  it('getCohortPatientCount: enrolled count + per-visit-type breakdown', async () => {
    const r = await repo.getCohortPatientCount('STUDY_A')
    expect(r.enrolled).toBe(4)
    const byType = Object.fromEntries(r.perVisitType.map((v) => [v.visitType, v.patientCount]))
    expect(byType.v0).toBe(4) // P1, P2, P3, P4
    expect(byType.v1).toBe(3) // P1, P2, P4
    expect(byType.v2).toBe(1) // P2
  })

  it('getCohortPatientCount: returns empty shape for unknown study', async () => {
    const r = await repo.getCohortPatientCount('NO_SUCH_STUDY')
    expect(r).toEqual({ enrolled: 0, perVisitType: [] })
  })

  it('getCohortDrugUsage: counts taking / not-taking / unknown across the cohort', async () => {
    const rows = await repo.getCohortDrugUsage('STUDY_A', 'TEST:DRUG:')
    const byCode = Object.fromEntries(rows.map((r) => [r.conceptCode, r]))
    // Atorva: P1 + P2 taking, others unknown
    expect(byCode['TEST:DRUG:ATORVA'].takingCount).toBe(2)
    expect(byCode['TEST:DRUG:ATORVA'].notTakingCount).toBe(0)
    expect(byCode['TEST:DRUG:ATORVA'].unknownCount).toBe(2)
    // ASS: P3 taking, P1 NV, P2 + P4 unknown
    expect(byCode['TEST:DRUG:ASS'].takingCount).toBe(1)
    expect(byCode['TEST:DRUG:ASS'].notTakingCount).toBe(1)
    expect(byCode['TEST:DRUG:ASS'].unknownCount).toBe(2)
    // totalEnrolled is always the cohort size
    for (const r of rows) expect(r.totalEnrolled).toBe(4)
  })

  it('getCohortFindingPrevalence: positive / total per F-concept', async () => {
    const rows = await repo.getCohortFindingPrevalence('STUDY_A')
    const afib = rows.find((r) => r.conceptCode === 'TEST:FINDING:AFIB')
    expect(afib).toBeTruthy()
    expect(afib.positive).toBe(2) // P1 + P3 say Yes
    expect(afib.total).toBe(3)    // P1, P2, P3 have any AFib obs
    expect(afib.totalEnrolled).toBe(4)
    expect(afib.name).toBe('Atrial fibrillation')
  })

  it('getCohortSelectionDistribution: distribution of TVAL_CHAR options', async () => {
    const rows = await repo.getCohortSelectionDistribution('STUDY_A', 'TEST:SEL:ETIO')
    const byCode = Object.fromEntries(rows.map((r) => [r.optionCode, r]))
    expect(byCode['TEST:ETIO:CRYPTO'].count).toBe(1) // P2
    expect(byCode['TEST:ETIO:MACRO'].count).toBe(1)  // P3
    expect(byCode['TEST:ETIO:CRYPTO'].name).toBe('Cryptogenic')
    // Total is the sum of all option counts
    expect(rows.every((r) => r.total === 2)).toBe(true)
  })

  it('getCohortLabSummary: mean/median/min/max per visit-type', async () => {
    const rows = await repo.getCohortLabSummary('STUDY_A', 'LID:TEST-LDL')
    const byType = Object.fromEntries(rows.map((r) => [r.visitType, r]))
    // V0: P3 only → 5.5
    expect(byType.v0).toMatchObject({ count: 1, mean: 5.5, median: 5.5, min: 5.5, max: 5.5 })
    // V1: P1 (3.0) + P2 (4.0) → mean 3.5, median 3.5
    expect(byType.v1).toMatchObject({ count: 2, min: 3.0, max: 4.0 })
    expect(Math.abs(byType.v1.mean - 3.5)).toBeLessThan(0.001)
    expect(Math.abs(byType.v1.median - 3.5)).toBeLessThan(0.001)
    // V2: P2 only → 1.8
    expect(byType.v2).toMatchObject({ count: 1, mean: 1.8, median: 1.8 })
  })

  it('getCohortLabSummary: median is robust against a single outlier', async () => {
    // Add a third LDL value at V1 for P4 that's a clear data-entry outlier:
    // 99999. The median should ignore it; the mean is skewed by definition.
    const p4 = (await connection.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD=?', ['P4'])).data[0].PATIENT_NUM
    const v1 = (await connection.executeQuery(
      `SELECT ENCOUNTER_NUM FROM VISIT_DIMENSION WHERE PATIENT_NUM=? AND json_extract(VISIT_BLOB,'$.visitType')='v1'`,
      [p4],
    )).data[0].ENCOUNTER_NUM
    await connection.executeCommand(
      `INSERT INTO OBSERVATION_FACT (ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM) VALUES (?, ?, 'LID:TEST-LDL', 'N', 99999)`,
      [v1, p4],
    )

    const rows = await repo.getCohortLabSummary('STUDY_A', 'LID:TEST-LDL')
    const v1Row = rows.find((r) => r.visitType === 'v1')
    expect(v1Row.count).toBe(3)
    expect(v1Row.median).toBe(4.0) // middle of [3.0, 4.0, 99999]
    // mean is destroyed by the outlier; dashboard prefers median for this reason
    expect(v1Row.mean).toBeGreaterThan(1000)

    // Clean up so the next test (if any) sees the original cohort
    await connection.executeCommand(
      `DELETE FROM OBSERVATION_FACT WHERE PATIENT_NUM=? AND CONCEPT_CD='LID:TEST-LDL' AND NVAL_NUM=99999`,
      [p4],
    )
  })

  it('getCohortLabSummary: empty for a lab with no observations', async () => {
    const rows = await repo.getCohortLabSummary('STUDY_A', 'LID:NO-SUCH-LAB')
    expect(rows).toEqual([])
  })

  it('study isolation: STUDY_B aggregates do NOT include STUDY_A patients', async () => {
    const counts = await repo.getCohortPatientCount('STUDY_B')
    expect(counts.enrolled).toBe(1)
    const drugs = await repo.getCohortDrugUsage('STUDY_B', 'TEST:DRUG:')
    // STUDY_B's only patient (P5) has no obs.
    for (const d of drugs) {
      expect(d.takingCount).toBe(0)
      expect(d.notTakingCount).toBe(0)
      expect(d.unknownCount).toBe(1)
    }
  })
})
