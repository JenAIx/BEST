/**
 * surveyBEST Parkinson-Ambulanz-Hybridbogen → app2 (echte SQLite-DB)
 *
 * Importiert zwei echte surveyBEST-Exporte über denselben Weg wie die
 * Import-Seite (ImportService.importFileToDatabase):
 *   - 05_survey3_hybrid_visit.json  Visiten-Export (importStructure): Hybridbogen
 *     + daraus abgeleitete NMSQuest und PDSS-2, je mit Score-Observationen
 *   - 06_survey3_hybrid.html        HTML-Einzelexport mit eingebettetem CDA
 * und prüft, dass alle Items, die Tageskurve, die Bewertung und alle Kennzahlen
 * in OBSERVATION_FACT ankommen (Migration 020 legt die Konzepte an — ohne sie
 * verwirft der Import die Kennzahlen stillschweigend).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import SeedManager from '../../src/core/database/seeds/seed-manager.js'
import PatientRepository from '../../src/core/database/repositories/patient-repository.js'
import VisitRepository from '../../src/core/database/repositories/visit-repository.js'
import ObservationRepository from '../../src/core/database/repositories/observation-repository.js'
import ConceptRepository from '../../src/core/database/repositories/concept-repository.js'
import UserPatientLookupRepository from '../../src/core/database/repositories/user-patient-lookup-repository.js'
import { ImportService } from '../../src/core/services/imports/import-service.js'
import { SURVEY_HYBRID_DATA } from '../../src/core/database/migrations/020-survey-hybrid-concepts.js'

const IN = path.join(process.cwd(), 'tests', 'input', 'test_import')
const MIGRATIONS = [
  ['001-core-schema', 'coreSchema'], ['002-views', 'databaseViews'], ['003-triggers', 'databaseTriggers'],
  ['004-study-tables', 'studyTables'], ['005-questionnaire-fieldset', 'questionnaireFieldSet'],
  ['006-fieldset-categories', 'fieldsetCategories'], ['007-parkinson-visit-types', 'parkinsonVisitTypes'],
  ['008-password-hashing', 'passwordHashing'], ['009-fix-patient-cascade', 'fixPatientCascade'],
  ['010-stroke-lipid-seed', 'strokeLipidSeed'], ['011-audit-valueflags', 'auditValueflags'],
  ['012-public-patient-access', 'publicPatientAccess'], ['013-provider-user-sync', 'providerUserSync'],
  ['014-raw-file-concepts', 'rawFileConcepts'], ['015-observation-audit-fact', 'observationAuditFact'],
  ['016-recreate-triggers', 'recreateTriggers'], ['017-neuro-consult-seed', 'neuroConsultSeed'],
  ['018-patient-list-view-perf', 'patientListViewPerf'], ['019-observation-version', 'observationVersion'],
  ['020-survey-hybrid-concepts', 'surveyHybridConcepts'],
]
const DB = './tests/output/survey3-hybrid-import-test.db'

let c, importService
const q = async (sql, params = []) => {
  const r = await c.executeQuery(sql, params)
  return r.success ? r.data : []
}
const obsFor = (pid) =>
  q(
    `SELECT o.VALTYPE_CD, o.CONCEPT_CD, o.NVAL_NUM, o.TVAL_CHAR, o.OBSERVATION_BLOB
     FROM OBSERVATION_FACT o JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM = o.PATIENT_NUM
     WHERE p.PATIENT_CD = ? ORDER BY o.OBSERVATION_ID`,
    [pid],
  )

beforeAll(async () => {
  fs.mkdirSync(path.dirname(DB), { recursive: true })
  if (fs.existsSync(DB)) fs.unlinkSync(DB)
  c = new RealSQLiteConnection()
  await c.connect(DB)
  const mm = new MigrationManager(c)
  // alle Migrationen in Reihenfolge, Datei + Exportname wie database-service.js
  for (const [file, exp] of MIGRATIONS) {
    const mod = await import(`../../src/core/database/migrations/${file}.js`)
    mm.registerMigration(mod[exp])
  }
  await mm.initializeDatabaseWithSeeds(new SeedManager(c))

  const repos = {
    patient: new PatientRepository(c),
    visit: new VisitRepository(c),
    observation: new ObservationRepository(c),
    concept: new ConceptRepository(c),
    userPatientLookup: new UserPatientLookupRepository(c),
  }
  const databaseService = { getRepository: (name) => repos[name] }
  importService = new ImportService(databaseService, repos.concept, null)
}, 600000)

afterAll(async () => {
  if (c?.getStatus()) await c.disconnect()
})

describe('Migration 020', () => {
  it('legt alle Konzepte der Hybrid-Kennzahlen und den PDSS-2-Score an', async () => {
    const codes = SURVEY_HYBRID_DATA.CONCEPTS.map((x) => x[1])
    const rows = await q(`SELECT CONCEPT_CD, VALTYPE_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD IN (${codes.map(() => '?').join(',')})`, codes)
    expect(rows.map((r) => r.CONCEPT_CD).sort()).toEqual([...codes].sort())
    expect(rows.every((r) => r.VALTYPE_CD === 'N')).toBe(true)
  })

  it('ergänzt die Score-Leiste der Parkinson-Konsultationen um PDSS-2 und OFF/Tag', async () => {
    const [row] = await q(`SELECT LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = 'consult_pd_verlauf'`)
    const strip = JSON.parse(row.LOOKUP_BLOB).scoreConcepts.map((s) => s.code)
    expect(strip).toEqual(expect.arrayContaining(['CUSTOM: SCORES_PDSS2', 'CUSTOM: PD_HYBRID_OFF_WAKE_H', 'CUSTOM: SCORES_NMSQUEST']))
    // erneut ausführen: nichts doppelt
    const { surveyHybridConcepts } = await import('../../src/core/database/migrations/020-survey-hybrid-concepts.js')
    await surveyHybridConcepts.execute(c)
    const [again] = await q(`SELECT LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = 'consult_pd_verlauf'`)
    const strip2 = JSON.parse(again.LOOKUP_BLOB).scoreConcepts.map((s) => s.code)
    expect(strip2.filter((x) => x === 'CUSTOM: SCORES_PDSS2')).toHaveLength(1)
  })
})

describe('Visiten-Export (JSON importStructure)', () => {
  const file = '05_survey3_hybrid_visit.json'
  let src, rows

  beforeAll(async () => {
    src = JSON.parse(fs.readFileSync(path.join(IN, file), 'utf-8'))
    const res = await importService.importFileToDatabase(fs.readFileSync(path.join(IN, file), 'utf-8'), file)
    if (!res.success) console.log('IMPORT-FEHLER', JSON.stringify(res.errors).slice(0, 3000))
    expect(res.success).toBe(true)
    rows = await obsFor('DEMO-HYB-01')
  }, 120000)

  it('jede Observation der Datei kommt an (nichts wegen fehlender Konzepte verworfen)', () => {
    expect(rows.length).toBe(src.data.observations.length)
  })

  it('drei Fragebögen: Hybrid, NMS_QUEST, PDSS2 — Codes wie die app2-Seeds', () => {
    const qs = rows.filter((r) => r.VALTYPE_CD === 'Q').map((r) => JSON.parse(r.OBSERVATION_BLOB))
    expect(qs.map((b) => b.questionnaire_code)).toEqual(['PD_HYBRID_SCREEN', 'NMS_QUEST', 'PDSS2'])
    expect(qs[1].collection).toBe('hybrid')
    expect(qs[2].derived_from).toBe('pd_hybrid_screen')
  })

  it('alle Items des Hybridbogens im Q-Blob, Tageskurve als Objekt, Bewertung erhalten', () => {
    const srcBlob = JSON.parse(src.data.observations[0].OBSERVATION_BLOB)
    const blob = JSON.parse(rows.find((r) => r.VALTYPE_CD === 'Q').OBSERVATION_BLOB)
    expect(blob.items).toEqual(srcBlob.items)
    const curve = blob.items.find((i) => i.label === 'tageskurve').value
    expect(curve.kind).toBe('day_curve')
    expect(curve.values).toHaveLength(49)
    expect(curve.pills).toEqual(['07:00', '10:30', '14:00', '17:30', '21:00'])
    expect(blob.results.find((r) => r.label === 'auffaellige_bereiche').evaluation).toContain('Motorik / Wirkschwankungen: auffällig')
  })

  it('Kennzahlen und Scores als N-Observationen mit Wert', () => {
    const n = Object.fromEntries(rows.filter((r) => r.VALTYPE_CD === 'N').map((r) => [r.CONCEPT_CD, r.NVAL_NUM]))
    expect(n['CUSTOM: PD_HYBRID_OFF_WAKE_H']).toBe(5.5)
    expect(n['CUSTOM: PD_HYBRID_OFF_WAKE_PCT']).toBe(34)
    expect(n['CUSTOM: PD_HYBRID_AUFFAELLIG']).toBe(2)
    expect(n['CUSTOM: SCORES_NMSQUEST']).toBe(7)
    expect(n['CUSTOM: SCORES_PDSS2']).toBe(16)
    expect(n['CUSTOM: PD_HYBRID_NMSQUEST_TOTAL']).toBe(n['CUSTOM: SCORES_NMSQUEST'])
    expect(n['CUSTOM: PD_HYBRID_PDSS2_TOTAL']).toBe(n['CUSTOM: SCORES_PDSS2'])
  })

  it('abgeleitete NMSQuest/PDSS-2 tragen alle Original-Items', () => {
    const qs = rows.filter((r) => r.VALTYPE_CD === 'Q').map((r) => JSON.parse(r.OBSERVATION_BLOB))
    expect(qs[1].items).toHaveLength(30)
    expect(qs[2].items).toHaveLength(15)
    expect(qs[1].items.every((i) => i.value === 0 || i.value === 1)).toBe(true)
  })
})

describe('HTML-Einzelexport (CDA)', () => {
  const file = '06_survey3_hybrid.html'
  let rows

  beforeAll(async () => {
    const res = await importService.importFileToDatabase(fs.readFileSync(path.join(IN, file), 'utf-8'), file)
    expect(res.success).toBe(true)
    rows = await obsFor('DEMO-HYB-02')
  }, 120000)

  it('Fragebogen mit allen Items, Bewertung und Code in Großbuchstaben', () => {
    const blob = JSON.parse(rows.find((r) => r.VALTYPE_CD === 'Q').OBSERVATION_BLOB)
    expect(blob.questionnaire_code).toBe('PD_HYBRID_SCREEN')
    expect(blob.items.find((i) => i.label === 'tageskurve').value.kind).toBe('day_curve')
    expect(blob.evaluation).toContain('Nicht-motorische Symptome')
  })

  it('Kennzahlen als N-Observationen, nirgends "[object Object]"', () => {
    const n = Object.fromEntries(rows.filter((r) => r.VALTYPE_CD === 'N').map((r) => [r.CONCEPT_CD, r.NVAL_NUM]))
    expect(n['CUSTOM: PD_HYBRID_OFF_WAKE_H']).toBe(5.5)
    expect(n['CUSTOM: PD_HYBRID_PDSS2_TOTAL']).toBe(16)
    expect(rows.some((r) => String(r.TVAL_CHAR).includes('[object Object]'))).toBe(false)
  })
})
