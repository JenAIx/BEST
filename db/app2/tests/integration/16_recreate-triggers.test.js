/**
 * Migration 016 re-creates every schema trigger statement by statement.
 * Simulates a database migrated through the old Electron splitter (no
 * triggers at all) and checks the cascades work again afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { databaseTriggers } from '../../src/core/database/migrations/003-triggers.js'
import { fixPatientCascade } from '../../src/core/database/migrations/009-fix-patient-cascade.js'
import { observationAuditFact } from '../../src/core/database/migrations/015-observation-audit-fact.js'
import { recreateTriggers, collectSchemaTriggers, extractTriggerStatements } from '../../src/core/database/migrations/016-recreate-triggers.js'

const DB_PATH = './tests/output/recreate-triggers-test.db'
let connection

const triggerNames = async () => (await connection.executeQuery("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")).data.map((r) => r.name)

beforeAll(async () => {
  fs.mkdirSync('./tests/output', { recursive: true })
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  connection = new RealSQLiteConnection()
  await connection.connect(DB_PATH)
  const mm = new MigrationManager(connection)
  for (const m of [coreSchema, databaseViews, databaseTriggers, fixPatientCascade, observationAuditFact]) mm.registerMigration(m)
  await mm.initializeDatabase()
})

afterAll(async () => {
  await connection.disconnect()
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
})

describe('016-recreate-triggers', () => {
  it('extracts every CREATE TRIGGER block, later definitions replacing earlier ones', () => {
    const from003 = extractTriggerStatements(databaseTriggers.sql)
    expect(from003.length).toBeGreaterThanOrEqual(5)
    expect(from003.map((t) => t.name)).toContain('delete_patient_cascade')
    const all = collectSchemaTriggers()
    const patientCascade = all.find((t) => t.name === 'delete_patient_cascade')
    expect(patientCascade.sql).toContain('DELETE FROM NOTE_FACT WHERE PATIENT_NUM = OLD.PATIENT_NUM') // the 009 version
    expect(all.map((t) => t.name)).toContain('delete_observation_audit_cascade')
    expect(new Set(all.map((t) => t.name)).size).toBe(all.length)
  })

  it('heals a database without triggers and the cascades work again (even with foreign_keys OFF)', async () => {
    // Simulate the broken state
    for (const name of await triggerNames()) await connection.executeCommand(`DROP TRIGGER IF EXISTS ${name}`)
    expect(await triggerNames()).toEqual([])

    await recreateTriggers.execute(connection)
    const names = await triggerNames()
    expect(names).toEqual(expect.arrayContaining(['delete_patient_cascade', 'delete_visit_cascade', 'delete_observation_audit_cascade', 'update_patient_on_observation_insert']))
    expect(names.length).toBe(collectSchemaTriggers().length)

    // Prove the trigger path alone deletes the audit trail (FK cascade disabled)
    await connection.executeCommand('PRAGMA foreign_keys = OFF')
    await connection.executeCommand(`INSERT INTO CONCEPT_DIMENSION (CONCEPT_CD, NAME_CHAR, VALTYPE_CD) VALUES ('T:X', 'X', 'N')`)
    await connection.executeCommand(`INSERT INTO PATIENT_DIMENSION (PATIENT_CD) VALUES ('P')`)
    const p = (await connection.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION')).data[0].PATIENT_NUM
    await connection.executeCommand(`INSERT INTO VISIT_DIMENSION (PATIENT_NUM, START_DATE) VALUES (?, '2024-01-01')`, [p])
    const v = (await connection.executeQuery('SELECT ENCOUNTER_NUM FROM VISIT_DIMENSION')).data[0].ENCOUNTER_NUM
    await connection.executeCommand(`INSERT INTO OBSERVATION_FACT (PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM) VALUES (?, ?, 'T:X', 'N', 1)`, [p, v])
    const o = (await connection.executeQuery('SELECT OBSERVATION_ID FROM OBSERVATION_FACT')).data[0].OBSERVATION_ID
    await connection.executeCommand(`INSERT INTO OBSERVATION_AUDIT_FACT (OBSERVATION_ID, PATIENT_NUM, ENCOUNTER_NUM, EVENT_CD, FLAG_CD) VALUES (?, ?, ?, 'FLAG', 'AUDIT')`, [o, p, v])
    await connection.executeCommand(`INSERT INTO NOTE_FACT (CATEGORY_CHAR, NAME_CHAR, NOTE_TEXT, PATIENT_NUM) VALUES ('QUICK_NOTE', 'n', 'x', ?)`, [p])

    await connection.executeCommand('DELETE FROM PATIENT_DIMENSION WHERE PATIENT_NUM = ?', [p])
    const count = async (t) => (await connection.executeQuery(`SELECT COUNT(*) AS n FROM ${t}`)).data[0].n
    expect(await count('VISIT_DIMENSION')).toBe(0)
    expect(await count('OBSERVATION_FACT')).toBe(0)
    expect(await count('OBSERVATION_AUDIT_FACT')).toBe(0)
    expect(await count('NOTE_FACT')).toBe(0)
    await connection.executeCommand('PRAGMA foreign_keys = ON')
  })

  it('is idempotent', async () => {
    const before = await triggerNames()
    await recreateTriggers.execute(connection)
    expect(await triggerNames()).toEqual(before)
  })
})
