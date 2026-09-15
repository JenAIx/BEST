/**
 * DiagnosisRepository (problem list per visit) + ConsultRepository (text
 * history, record search, letters) against a real SQLite file.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { neuroConsultSeed } from '../../src/core/database/migrations/017-neuro-consult-seed.js'
import DiagnosisRepository, { PRIMARY_DX, SECONDARY_DX } from '../../src/core/database/repositories/diagnosis-repository.js'
import ConsultRepository from '../../src/core/database/repositories/consult-repository.js'
import NoteRepository from '../../src/core/database/repositories/note-repository.js'

const DB_PATH = './tests/output/diagnosis-consult-test.db'
let c, dx, consult, notes
const ids = {}
const q = async (sql, params = []) => (await c.executeQuery(sql, params)).data

beforeAll(async () => {
  fs.mkdirSync('./tests/output', { recursive: true })
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  c = new RealSQLiteConnection()
  await c.connect(DB_PATH)
  const mm = new MigrationManager(c)
  for (const m of [coreSchema, databaseViews, neuroConsultSeed]) mm.registerMigration(m)
  await mm.initializeDatabase()
  dx = new DiagnosisRepository(c)
  consult = new ConsultRepository(c)
  notes = new NoteRepository(c)
  await c.executeCommand(`INSERT INTO CONCEPT_DIMENSION (CONCEPT_CD, NAME_CHAR, VALTYPE_CD) VALUES ('SCTID: 8319008', 'Hauptdiagnose', 'S'), ('SCTID: 422625006', 'Anamnese', 'T'), ('LID: 52418-1', 'Medication', 'M'), ('SCTID: 716138005', 'H&Y', 'N')`)
  await c.executeCommand(`INSERT INTO PATIENT_DIMENSION (PATIENT_CD) VALUES ('P1')`)
  ids.patient = (await q('SELECT PATIENT_NUM FROM PATIENT_DIMENSION'))[0].PATIENT_NUM
  for (const d of ['2026-03-12', '2026-09-15']) await c.executeCommand(`INSERT INTO VISIT_DIMENSION (PATIENT_NUM, START_DATE) VALUES (?, ?)`, [ids.patient, d])
  const v = await q('SELECT ENCOUNTER_NUM FROM VISIT_DIMENSION ORDER BY START_DATE')
  ids.v1 = v[0].ENCOUNTER_NUM
  ids.v2 = v[1].ENCOUNTER_NUM
  // texts + a score + a medication in the earlier visit
  await c.executeCommand(`INSERT INTO OBSERVATION_FACT (PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, TVAL_CHAR, START_DATE) VALUES (?, ?, 'SCTID: 422625006', 'T', 'Pat. berichtet über Wearing-off am Nachmittag', '2026-03-12')`, [ids.patient, ids.v1])
  await c.executeCommand(`INSERT INTO OBSERVATION_FACT (PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, NVAL_NUM, START_DATE) VALUES (?, ?, 'SCTID: 716138005', 'N', 2.5, '2026-03-12')`, [ids.patient, ids.v1])
  await c.executeCommand(`INSERT INTO OBSERVATION_FACT (PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, TVAL_CHAR, NVAL_NUM, OBSERVATION_BLOB, START_DATE) VALUES (?, ?, 'LID: 52418-1', 'M', 'Madopar', 100, '{"drugName":"Madopar","dosage":100,"frequency":"tid"}', '2026-03-12')`, [ids.patient, ids.v1])
})

afterAll(async () => {
  await c.disconnect()
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
})

describe('DiagnosisRepository', () => {
  it('upserts a coded primary diagnosis (INSTANCE_NUM 1, name resolved from the ICD concept)', async () => {
    const d = await dx.upsertDiagnosis({ patientNum: ids.patient, encounterNum: ids.v1, kind: 'primary', icd: 'ICD10: G20', text: 'Idiopathisches Parkinson-Syndrom, Äquivalenztyp', since: '2019', providerId: 'ste' })
    expect(d).toMatchObject({ kind: 'primary', instanceNum: 1, icd: 'ICD10: G20', icdName: 'Primäres Parkinson-Syndrom', text: 'Idiopathisches Parkinson-Syndrom, Äquivalenztyp', since: '2019', status: 'aktiv' })
    const row = (await q('SELECT TVAL_CHAR, CONCEPT_CD, VALTYPE_CD, CATEGORY_CHAR FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [d.observationId]))[0]
    expect(row).toEqual({ TVAL_CHAR: 'ICD10: G20', CONCEPT_CD: PRIMARY_DX, VALTYPE_CD: 'S', CATEGORY_CHAR: 'Diagnosis' })
    // a second "primary" replaces, never duplicates
    const d2 = await dx.upsertDiagnosis({ patientNum: ids.patient, encounterNum: ids.v1, kind: 'primary', icd: 'ICD10: G23.1', text: 'PSP' })
    expect(d2.observationId).toBe(d.observationId)
    expect((await dx.getProblemList(ids.v1)).filter((x) => x.kind === 'primary')).toHaveLength(1)
    await dx.upsertDiagnosis({ observationId: d.observationId, patientNum: ids.patient, encounterNum: ids.v1, kind: 'primary', icd: 'ICD10: G20', text: 'IPS' })
  })

  it('numbers secondary diagnoses, keeps free text, reorders and renumbers on delete', async () => {
    const a = await dx.upsertDiagnosis({ patientNum: ids.patient, encounterNum: ids.v1, icd: 'ICD10: F32.0', text: 'Leichte depressive Episode', since: '2024' })
    const b = await dx.upsertDiagnosis({ patientNum: ids.patient, encounterNum: ids.v1, text: 'Restless legs (klinisch)', status: 'verdacht' })
    const cc = await dx.upsertDiagnosis({ patientNum: ids.patient, encounterNum: ids.v1, icd: 'ICD10: I10', text: 'Arterielle Hypertonie' })
    expect([a.instanceNum, b.instanceNum, cc.instanceNum]).toEqual([1, 2, 3])
    expect(b).toMatchObject({ icd: null, text: 'Restless legs (klinisch)', status: 'verdacht', conceptCode: SECONDARY_DX })
    const list = await dx.getProblemList(ids.v1)
    expect(list.map((d) => d.kind)).toEqual(['primary', 'secondary', 'secondary', 'secondary'])
    await dx.reorderSecondary(ids.v1, [cc.observationId, a.observationId, b.observationId])
    expect((await dx.getProblemList(ids.v1)).filter((d) => d.kind === 'secondary').map((d) => d.text)).toEqual(['Arterielle Hypertonie', 'Leichte depressive Episode', 'Restless legs (klinisch)'])
    await dx.deleteDiagnosis(a.observationId)
    const after = (await dx.getProblemList(ids.v1)).filter((d) => d.kind === 'secondary')
    expect(after.map((d) => d.instanceNum)).toEqual([1, 2])
    expect(after.map((d) => d.text)).toEqual(['Arterielle Hypertonie', 'Restless legs (klinisch)'])
    await expect(dx.upsertDiagnosis({ patientNum: ids.patient, encounterNum: ids.v1 })).rejects.toThrow()
  })

  it('carries the problem list forward without duplicates and skips inactive ones', async () => {
    await dx.upsertDiagnosis({ patientNum: ids.patient, encounterNum: ids.v1, text: 'Alte Sache', status: 'inaktiv' })
    const r1 = await dx.carryForward({ fromEncounter: ids.v1, toEncounter: ids.v2, patientNum: ids.patient, providerId: 'ste' })
    expect(r1).toEqual({ created: 3, skipped: 1 })
    const target = await dx.getProblemList(ids.v2)
    expect(target.find((d) => d.kind === 'primary')).toMatchObject({ icd: 'ICD10: G20', carriedFrom: { encounterNum: ids.v1 } })
    const r2 = await dx.carryForward({ fromEncounter: ids.v1, toEncounter: ids.v2, patientNum: ids.patient })
    expect(r2).toEqual({ created: 0, skipped: 4 })
    const history = await dx.getDiagnosisHistory(ids.patient)
    expect(history.map((h) => h.encounterNum)).toEqual([ids.v1, ids.v2])
  })

  it('searches the ICD-10 catalogue by code prefix and name', async () => {
    expect((await dx.searchIcd10('G2')).map((r) => r.icd).slice(0, 3)).toEqual(['G20', 'G21.0', 'G21.1'])
    const byName = await dx.searchIcd10('tremor')
    expect(byName.map((r) => r.icd)).toContain('G25.0')
    expect(byName[0].name).toBeTruthy()
    expect(await dx.searchIcd10('')).toEqual([])
  })
})

describe('ConsultRepository', () => {
  it('getObservationHistory returns rows across visits newest first with resolved names', async () => {
    await c.executeCommand(`INSERT INTO OBSERVATION_FACT (PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, TVAL_CHAR, START_DATE) VALUES (?, ?, 'SCTID: 422625006', 'T', 'Seit der letzten Vorstellung stabil', '2026-09-15')`, [ids.patient, ids.v2])
    const h = await consult.getObservationHistory({ patientNum: ids.patient, conceptCodes: ['SCTID: 422625006', 'SCTID: 716138005', PRIMARY_DX] })
    expect(h[0]).toMatchObject({ encounterNum: ids.v2, visitDate: '2026-09-15' })
    expect(h.filter((r) => r.conceptCode === 'SCTID: 716138005')[0].numericValue).toBe(2.5)
    expect(h.find((r) => r.conceptCode === PRIMARY_DX && r.encounterNum === ids.v1).resolvedValue).toBe('Primäres Parkinson-Syndrom')
    expect(await consult.getObservationHistory({ patientNum: ids.patient, conceptCodes: [] })).toEqual([])
  })

  it('searchPatientText finds texts, medications, diagnoses, notes and letters', async () => {
    await notes.createNote({ CATEGORY_CHAR: 'QUICK_NOTE', NAME_CHAR: 'Quick', NOTE_TEXT: 'Telefonat: Wearing-off besprochen', PATIENT_NUM: ids.patient })
    await consult.saveLetter({ patientNum: ids.patient, encounterNum: ids.v1, template: 'consult_pd_verlauf', html: '<html><body><h2>Beurteilung</h2><p>Beginnende Fluktuationen mit Wearing-off.</p></body></html>', sections: [{ key: 'text:LID: 51848-0' }], snapshot: { ledd: 600 }, userCd: 'ste' })
    const hits = await consult.searchPatientText(ids.patient, 'wearing')
    expect(hits.map((h) => h.kind).sort()).toEqual(['letter', 'note', 'text'])
    expect(hits.find((h) => h.kind === 'text').snippet).toContain('Wearing-off')
    expect(hits.find((h) => h.kind === 'letter').text).not.toContain('<p>')
    expect((await consult.searchPatientText(ids.patient, 'madopar'))[0]).toMatchObject({ kind: 'medication', encounterNum: ids.v1 })
    expect((await consult.searchPatientText(ids.patient, 'hypertonie'))[0].kind).toBe('diagnosis')
    expect(await consult.searchPatientText(ids.patient, 'w')).toEqual([])
  })

  it('letters live in NOTE_FACT as LETTER and stay out of the quick notes', async () => {
    const letters = await consult.getLetters(ids.patient)
    expect(letters).toHaveLength(1)
    expect(letters[0]).toMatchObject({ encounterNum: ids.v1, template: 'consult_pd_verlauf', createdBy: 'ste', visitDate: '2026-03-12' })
    expect(letters[0].html).toContain('<h2>Beurteilung</h2>')
    expect(letters[0].snapshot.ledd).toBe(600)
    const quick = await notes.getQuickNotes({ userCd: 'ste', patientNum: ids.patient, limit: 50 })
    expect(quick.every((n) => n.CATEGORY_CHAR === 'QUICK_NOTE')).toBe(true)
    expect(await consult.getLetters(ids.patient, { encounterNum: ids.v2 })).toEqual([])
    expect(await consult.deleteLetter(letters[0].noteId)).toBe(true)
    expect(await consult.getLetters(ids.patient)).toEqual([])
  })
})
