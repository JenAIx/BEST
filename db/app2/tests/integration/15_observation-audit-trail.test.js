/**
 * Integration tests for the observation audit trail (migration 015 +
 * ObservationAuditRepository) against a real SQLite file:
 *   - logEvent copies PATIENT_NUM / ENCOUNTER_NUM from the observation and
 *     returns the rendered row (author name resolved)
 *   - trails per observation / patient are chronological
 *   - comment counts only count rows with text
 *   - deleting the observation removes its trail (FK cascade + trigger)
 *   - deleting a visit (trigger cascade) removes the trail too
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import ObservationAuditRepository, { AUDIT_EVENT_FLAG, AUDIT_EVENT_COMMENT, AUDIT_EVENT_VALUE_EDIT } from '../../src/core/database/repositories/observation-audit-repository.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { databaseTriggers } from '../../src/core/database/migrations/003-triggers.js'
import { observationAuditFact } from '../../src/core/database/migrations/015-observation-audit-fact.js'

const DB_PATH = './tests/output/observation-audit-trail-test.db'

let connection
let repo
let ids = {}

beforeAll(async () => {
  fs.mkdirSync('./tests/output', { recursive: true })
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  connection = new RealSQLiteConnection()
  await connection.connect(DB_PATH)
  const mm = new MigrationManager(connection)
  for (const m of [coreSchema, databaseViews, databaseTriggers, observationAuditFact]) mm.registerMigration(m)
  await mm.initializeDatabase()
  repo = new ObservationAuditRepository(connection)

  await connection.executeCommand(`INSERT INTO USER_MANAGEMENT (USER_CD, NAME_CHAR, COLUMN_CD) VALUES ('ste', 'Stefan', 'admin')`)
  await connection.executeCommand(`INSERT INTO CONCEPT_DIMENSION (CONCEPT_CD, NAME_CHAR, VALTYPE_CD) VALUES ('TEST:LDL', 'LDL', 'N')`)
  await connection.executeCommand(`INSERT INTO PATIENT_DIMENSION (PATIENT_CD) VALUES ('P1')`)
  ids.patient = (await connection.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD=?', ['P1'])).data[0].PATIENT_NUM
  for (const date of ['2024-01-01', '2024-02-01']) {
    await connection.executeCommand(`INSERT INTO VISIT_DIMENSION (PATIENT_NUM, START_DATE) VALUES (?, ?)`, [ids.patient, date])
  }
  const visits = (await connection.executeQuery('SELECT ENCOUNTER_NUM FROM VISIT_DIMENSION ORDER BY START_DATE')).data
  ids.visit1 = visits[0].ENCOUNTER_NUM
  ids.visit2 = visits[1].ENCOUNTER_NUM
  const obs = []
  for (const [enc, val] of [[ids.visit1, 3.0], [ids.visit1, 4.0], [ids.visit2, 2.0]]) {
    await connection.executeCommand(`INSERT INTO OBSERVATION_FACT (PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM, START_DATE) VALUES (?, ?, 'TEST:LDL', 'N', ?, '2024-01-01')`, [ids.patient, enc, val])
    const row = (await connection.executeQuery('SELECT MAX(OBSERVATION_ID) AS id FROM OBSERVATION_FACT')).data[0]
    obs.push(row.id)
  }
  ;[ids.obsA, ids.obsB, ids.obsC] = obs
})

afterAll(async () => {
  await connection.disconnect()
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
})

describe('ObservationAuditRepository', () => {
  it('logEvent copies patient/visit from the observation and resolves the author name', async () => {
    const row = await repo.logEvent({ observationId: ids.obsA, eventCd: AUDIT_EVENT_FLAG, flagCd: 'AUDIT', commentText: '  Wert unplausibel  ', createdBy: 'ste', source: 'VISITS' })
    expect(row).toMatchObject({
      OBSERVATION_ID: ids.obsA,
      PATIENT_NUM: ids.patient,
      ENCOUNTER_NUM: ids.visit1,
      EVENT_CD: 'FLAG',
      FLAG_CD: 'AUDIT',
      COMMENT_TEXT: 'Wert unplausibel',
      CREATED_BY: 'ste',
      CREATED_BY_NAME: 'Stefan',
      SOURCESYSTEM_CD: 'VISITS',
    })
    expect(row.AUDIT_ID).toBeGreaterThan(0)
    expect(row.CREATED_AT).toBeTruthy()
  })

  it('logEvent returns null for an unknown observation and rejects incomplete input', async () => {
    expect(await repo.logEvent({ observationId: 999999, eventCd: AUDIT_EVENT_COMMENT, commentText: 'x' })).toBeNull()
    await expect(repo.logEvent({ eventCd: AUDIT_EVENT_COMMENT })).rejects.toThrow()
  })

  it('trails are chronological per observation and per patient; blank comments are stored as NULL', async () => {
    await repo.logEvent({ observationId: ids.obsA, eventCd: AUDIT_EVENT_COMMENT, commentText: 'Labor nachgefragt', createdBy: 'ste' })
    await repo.logEvent({ observationId: ids.obsA, eventCd: AUDIT_EVENT_FLAG, flagCd: 'CONFIRMED', commentText: '   ', createdBy: 'ste' })
    await repo.logEvent({ observationId: ids.obsB, eventCd: AUDIT_EVENT_FLAG, flagCd: 'AUDIT', createdBy: 'ste' })
    await repo.logEvent({ observationId: ids.obsB, eventCd: AUDIT_EVENT_VALUE_EDIT, flagCd: null, createdBy: 'ste' })
    await repo.logEvent({ observationId: ids.obsC, eventCd: AUDIT_EVENT_COMMENT, commentText: 'anderer Besuch', createdBy: 'ste' })

    const a = await repo.getTrailForObservation(ids.obsA)
    expect(a.map((e) => e.EVENT_CD)).toEqual(['FLAG', 'COMMENT', 'FLAG'])
    expect(a[2].COMMENT_TEXT).toBeNull()

    const patient = await repo.getTrailForPatient(ids.patient)
    expect(patient).toHaveLength(6)
    expect(patient.map((e) => e.OBSERVATION_ID)).toEqual([ids.obsA, ids.obsA, ids.obsA, ids.obsB, ids.obsB, ids.obsC])
    expect(await repo.getTrailForObservation(null)).toEqual([])
  })

  it('comment counts only count rows that carry text', async () => {
    const counts = await repo.getCommentCountsForObservations([ids.obsA, ids.obsB, ids.obsC, null, ids.obsA])
    expect(counts.get(ids.obsA)).toBe(2) // flag+comment, comment
    expect(counts.has(ids.obsB)).toBe(false) // flag events without text
    expect(counts.get(ids.obsC)).toBe(1)
    expect((await repo.getCommentCountsForObservations([])).size).toBe(0)
  })

  it('deleteEvent removes only COMMENT rows', async () => {
    const trail = await repo.getTrailForObservation(ids.obsA)
    const flagRow = trail.find((e) => e.EVENT_CD === 'FLAG')
    const commentRow = trail.find((e) => e.EVENT_CD === 'COMMENT')
    expect(await repo.deleteEvent(flagRow.AUDIT_ID)).toBe(false)
    expect(await repo.deleteEvent(commentRow.AUDIT_ID)).toBe(true)
    expect((await repo.getTrailForObservation(ids.obsA)).map((e) => e.EVENT_CD)).toEqual(['FLAG', 'FLAG'])
  })

  it('deleting the observation removes its trail (cascade)', async () => {
    await connection.executeCommand('DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [ids.obsB])
    expect(await repo.getTrailForObservation(ids.obsB)).toEqual([])
    expect((await repo.getTrailForObservation(ids.obsA)).length).toBe(2) // untouched
  })

  it('deleting a visit cascades through the observations to the trail', async () => {
    await connection.executeCommand('DELETE FROM VISIT_DIMENSION WHERE ENCOUNTER_NUM = ?', [ids.visit2])
    expect(await repo.getTrailForObservation(ids.obsC)).toEqual([])
    const left = (await connection.executeQuery('SELECT COUNT(*) AS n FROM OBSERVATION_AUDIT_FACT')).data[0].n
    expect(left).toBe(2)
  })
})
