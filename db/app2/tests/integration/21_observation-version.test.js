/**
 * Migration 019 — optimistic locking on OBSERVATION_FACT.
 *   - guard trigger bumps VERSION (+ fills UPDATE_DATE) for legacy writes
 *   - repository writes bump exactly once and reject stale versions
 *   - two connections: the second writer with the old version is rejected
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import ObservationRepository from '../../src/core/database/repositories/observation-repository.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { databaseTriggers } from '../../src/core/database/migrations/003-triggers.js'
import { observationAuditFact } from '../../src/core/database/migrations/015-observation-audit-fact.js'
import { recreateTriggers } from '../../src/core/database/migrations/016-recreate-triggers.js'
import { observationVersion, OBSERVATION_VERSION_TRIGGER } from '../../src/core/database/migrations/019-observation-version.js'
import { buildSetFlagStatement, buildValueUpdateStatement } from '../../src/shared/utils/audit-flag.js'

const DB_PATH = './tests/output/observation-version-test.db'
let a
let b

const q = async (sql, params = []) => (await a.executeQuery(sql, params)).data
const version = async (id) => (await q('SELECT VERSION, UPDATE_DATE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [id]))[0]

beforeAll(async () => {
  fs.mkdirSync('./tests/output', { recursive: true })
  for (const f of [DB_PATH, `${DB_PATH}-journal`]) if (fs.existsSync(f)) fs.unlinkSync(f)
  a = new RealSQLiteConnection()
  await a.connect(DB_PATH)
  const mm = new MigrationManager(a)
  for (const m of [coreSchema, databaseViews, databaseTriggers, observationAuditFact, recreateTriggers, observationVersion]) mm.registerMigration(m)
  await mm.initializeDatabase()

  await a.executeCommand("INSERT INTO CONCEPT_DIMENSION (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, VALTYPE_CD) VALUES ('\\X\\LDL', 'LDL', 'LDL', 'N')")
  await a.executeCommand("INSERT INTO PATIENT_DIMENSION (PATIENT_NUM, PATIENT_CD) VALUES (1, 'P1')")
  await a.executeCommand("INSERT INTO VISIT_DIMENSION (ENCOUNTER_NUM, PATIENT_NUM, START_DATE) VALUES (11, 1, '2026-01-01')")
  await a.executeCommand("INSERT INTO OBSERVATION_FACT (OBSERVATION_ID, ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM, START_DATE) VALUES (100, 11, 1, 'LDL', 'N', 120, '2026-01-01')")

  b = new RealSQLiteConnection()
  await b.connect(DB_PATH)
})

afterAll(async () => {
  await a.disconnect()
  await b.disconnect()
  for (const f of [DB_PATH, `${DB_PATH}-journal`]) if (fs.existsSync(f)) fs.unlinkSync(f)
})

describe('019-observation-version', () => {
  it('adds the column, the view column and the guard trigger; is idempotent', async () => {
    const cols = (await q('PRAGMA table_info(OBSERVATION_FACT)')).map((c) => c.name)
    expect(cols).toContain('VERSION')
    const viewCols = (await q('PRAGMA table_info(patient_observations)')).map((c) => c.name)
    expect(viewCols).toContain('VERSION')
    const triggers = (await q("SELECT name FROM sqlite_master WHERE type='trigger'")).map((r) => r.name)
    expect(triggers).toContain(OBSERVATION_VERSION_TRIGGER.name)
    await observationVersion.execute(a) // re-run must not fail (ALTER guarded)
    expect((await version(100)).VERSION).toBe(0)
  })

  it('guard trigger: a legacy UPDATE without VERSION bump still increments VERSION and fills UPDATE_DATE', async () => {
    await a.executeCommand('UPDATE OBSERVATION_FACT SET NVAL_NUM = 121 WHERE OBSERVATION_ID = 100')
    const row = await version(100)
    expect(row.VERSION).toBe(1)
    expect(row.UPDATE_DATE).toBeTruthy()
  })

  it('shared statement builders bump exactly once (no double bump with the trigger)', async () => {
    const flag = buildSetFlagStatement('AUDIT', 'ste', 100, 1)
    const r1 = await a.executeCommand(flag.sql, flag.params)
    expect(r1.changes).toBe(1)
    expect((await version(100)).VERSION).toBe(2)

    const value = buildValueUpdateStatement({ valueType: 'N', value: 130, flag: null, providerId: 'ste', observationId: 100, expectedVersion: 2 })
    const r2 = await a.executeCommand(value.sql, value.params)
    expect(r2.changes).toBe(1)
    expect((await version(100)).VERSION).toBe(3)

    // stale guard: version 2 is gone
    const stale = buildValueUpdateStatement({ valueType: 'N', value: 999, flag: null, providerId: 'ste', observationId: 100, expectedVersion: 2 })
    const r3 = await a.executeCommand(stale.sql, stale.params)
    expect(r3.changes).toBe(0)
    expect((await q('SELECT NVAL_NUM FROM OBSERVATION_FACT WHERE OBSERVATION_ID = 100'))[0].NVAL_NUM).toBe(130)
  })

  it('repository: guarded update bumps once, a stale version throws StaleObservationError', async () => {
    const repo = new ObservationRepository(a)
    const ok = await repo.updateObservation(100, { NVAL_NUM: 140 }, { expectedVersion: 3 })
    expect(ok).toMatchObject({ success: true, changes: 1, newVersion: 4 })
    expect((await version(100)).VERSION).toBe(4)

    await expect(repo.updateObservation(100, { NVAL_NUM: 150 }, { expectedVersion: 3 })).rejects.toMatchObject({ name: 'StaleObservationError', observationId: 100 })
    await expect(repo.updateObservation(999, { NVAL_NUM: 1 })).rejects.toThrow(/not found/)
    expect((await q('SELECT NVAL_NUM FROM OBSERVATION_FACT WHERE OBSERVATION_ID = 100'))[0].NVAL_NUM).toBe(140)
  })

  it('two connections: both load v4, A writes, B is rejected as stale', async () => {
    const repoA = new ObservationRepository(a)
    const repoB = new ObservationRepository(b)
    const loadedA = (await a.executeQuery('SELECT VERSION FROM patient_observations WHERE OBSERVATION_ID = 100')).data[0].VERSION
    const loadedB = (await b.executeQuery('SELECT VERSION FROM patient_observations WHERE OBSERVATION_ID = 100')).data[0].VERSION
    expect(loadedA).toBe(4)
    expect(loadedB).toBe(4)

    await repoA.updateObservation(100, { NVAL_NUM: 160 }, { expectedVersion: loadedA })
    await expect(repoB.updateObservation(100, { NVAL_NUM: 170 }, { expectedVersion: loadedB })).rejects.toMatchObject({ name: 'StaleObservationError' })

    const row = (await b.executeQuery('SELECT NVAL_NUM, VERSION FROM OBSERVATION_FACT WHERE OBSERVATION_ID = 100')).data[0]
    expect(row).toEqual({ NVAL_NUM: 160, VERSION: 5 })
  })
})
