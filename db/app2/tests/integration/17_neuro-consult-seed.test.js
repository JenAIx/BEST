/**
 * Migration 017 (neuro consultation seed) against a real SQLite file:
 * concepts + S-option children, ICD-10 mini catalogue, field sets, new visit
 * types, MERGE into the 007 Parkinson types (admin edits survive), consult
 * templates that normalize cleanly, drug/frequency/route options, repaired
 * questionnaire definitions, idempotency.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import MigrationManager from '../../src/core/database/migrations/migration-manager.js'
import { coreSchema } from '../../src/core/database/migrations/001-core-schema.js'
import { databaseViews } from '../../src/core/database/migrations/002-views.js'
import { fieldsetCategories } from '../../src/core/database/migrations/006-fieldset-categories.js'
import { parkinsonVisitTypes } from '../../src/core/database/migrations/007-parkinson-visit-types.js'
import { neuroConsultSeed, NEURO_CONSULT_SEED_DATA } from '../../src/core/database/migrations/017-neuro-consult-seed.js'
import { normalizeConsultTemplate } from '../../src/shared/utils/consult-template.js'

const DB_PATH = './tests/output/neuro-consult-seed-test.db'
let c
// Concepts that 017 merely REFERENCES (MoCA, UPDRS, Bain total, …) come from the
// CSV seed (SeedManager), which this migration-only fixture does not run —
// accept them when the bundled CSV lists the code.
let conceptCsv = ''
const conceptKnown = async (code) => (await one('SELECT COUNT(*) FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?', [code])) === 1 || conceptCsv.includes(code)

const q = async (sql, params = []) => (await c.executeQuery(sql, params)).data
const one = async (sql, params = []) => Object.values((await q(sql, params))[0] || {})[0]
const blobOf = async (code) => JSON.parse((await q('SELECT LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = ?', [code]))[0].LOOKUP_BLOB)

beforeAll(async () => {
  fs.mkdirSync('./tests/output', { recursive: true })
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
  conceptCsv = (await import('../../src/core/database/seeds/csv-loader.js')).conceptsData || ''
  c = new RealSQLiteConnection()
  await c.connect(DB_PATH)
  const mm = new MigrationManager(c)
  for (const m of [coreSchema, databaseViews, fieldsetCategories, parkinsonVisitTypes]) mm.registerMigration(m)
  await mm.initializeDatabase()
  // simulate an admin edit on the 007 visit type before 017 runs
  const blob = await blobOf('parkinson_verlauf')
  blob.label = 'Parkinson Verlauf (Haus-Edit)'
  blob.fieldSets.push({ id: 'lab', name: 'Lab Results', active: true })
  await c.executeCommand('UPDATE CODE_LOOKUP SET LOOKUP_BLOB = ? WHERE CODE_CD = ?', [JSON.stringify(blob), 'parkinson_verlauf'])
  // an older questionnaire row with the broken (unprefixed) code must be refreshed
  await c.executeCommand(`INSERT INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB) VALUES ('SURVEY_BEST','QUESTIONNAIRE','SCHWAB_ENGLAND','old','{"results":{"coding":{"code":"273544001"}}}')`)
  await neuroConsultSeed.execute(c)
})

afterAll(async () => {
  await c.disconnect()
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH)
})

describe('017-neuro-consult-seed', () => {
  it('seeds the neuro concepts with S-option children under the parent path', async () => {
    expect(await one("SELECT COUNT(*) FROM CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE 'NEURO:%'")).toBe(NEURO_CONSULT_SEED_DATA.CONCEPTS.filter(([, code]) => code.startsWith('NEURO:')).length)
    for (const parent of ['NEURO:DBS:TARGET', 'NEURO:PD:MED_STATE', 'NEURO:TREMOR:TYPE', 'NEURO:TREMOR:DOMINANT_SIDE']) {
      const path = (await q('SELECT CONCEPT_PATH FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = ?', [parent]))[0].CONCEPT_PATH
      const children = await one('SELECT COUNT(*) FROM CONCEPT_DIMENSION WHERE CONCEPT_PATH LIKE ? AND CONCEPT_CD != ? AND LENGTH(CONCEPT_PATH) > LENGTH(?)', [path + '%', parent, path])
      expect(children, parent).toBeGreaterThanOrEqual(2)
    }
    expect((await q("SELECT VALTYPE_CD, UNIT_CD, CATEGORY_CHAR FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = 'NEURO:SCORE:LEDD'"))[0]).toEqual({ VALTYPE_CD: 'N', UNIT_CD: 'mg/d', CATEGORY_CHAR: 'Parkinson Disease' })
    expect((await q("SELECT VALTYPE_CD, CATEGORY_CHAR FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = 'LID: 51848-0'"))[0]).toEqual({ VALTYPE_CD: 'T', CATEGORY_CHAR: 'Consultation' })
    expect(await one("SELECT COUNT(*) FROM CODE_LOOKUP WHERE COLUMN_CD = 'CATEGORY_CHAR' AND NAME_CHAR IN ('Consultation','Deep Brain Stimulation','Tremor')")).toBe(3)
  })

  it('ICD-10 mini catalogue is searchable by code and German name', async () => {
    expect(await one("SELECT COUNT(*) FROM CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE 'ICD10: %'")).toBe(NEURO_CONSULT_SEED_DATA.ICD10_CONCEPTS.length)
    const g20 = (await q("SELECT NAME_CHAR, CONCEPT_PATH, VALTYPE_CD FROM CONCEPT_DIMENSION WHERE CONCEPT_CD = 'ICD10: G20'"))[0]
    expect(g20).toEqual({ NAME_CHAR: 'Primäres Parkinson-Syndrom', CONCEPT_PATH: '\\ICD-10\\G20-G26\\G20\\G20', VALTYPE_CD: 'A' })
    expect(await one("SELECT COUNT(*) FROM CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE 'ICD10:%' AND NAME_CHAR LIKE '%Tremor%'")).toBeGreaterThanOrEqual(3)
  })

  it('field sets list concepts explicitly and new visit types reference them', async () => {
    const dx = await blobOf('neuro_diagnoses')
    expect(dx.concepts).toEqual(['SCTID: 8319008', 'NEURO:DX:SECONDARY'])
    expect(dx.categories).toEqual([])
    const ths = await blobOf('ths_verlauf')
    expect(ths.fieldSets.map((f) => f.id)).toContain('neuro_dbs')
    expect(await one("SELECT COUNT(*) FROM CODE_LOOKUP WHERE COLUMN_CD = 'VISIT_TYPE_CD' AND CODE_CD IN ('ths_verlauf','tremor_erst','tremor_verlauf','ataxie','neuro_sonstiges')")).toBe(5)
  })

  it('merges the neuro field sets into the 007 Parkinson types without losing admin edits', async () => {
    const blob = await blobOf('parkinson_verlauf')
    expect(blob.label).toBe('Parkinson Verlauf (Haus-Edit)')
    const ids = blob.fieldSets.map((f) => f.id)
    expect(ids).toContain('lab')
    expect(ids).toEqual(expect.arrayContaining(['neuro_diagnoses', 'neuro_consult_texts', 'neuro_pd_scores']))
    expect(new Set(ids).size).toBe(ids.length)
    expect(blob.suggestedQuestionnaires).toEqual(expect.arrayContaining(['SCHWAB_ENGLAND', 'WOQ9', 'UPDRS_3']))
  })

  it('seeds 7 consult templates that normalize without defaults kicking in', async () => {
    const rows = await q("SELECT CODE_CD, NAME_CHAR, LOOKUP_BLOB FROM CODE_LOOKUP WHERE COLUMN_CD = 'CONSULT_TEMPLATE_CD' ORDER BY CODE_CD")
    expect(rows.map((r) => r.CODE_CD)).toEqual(['consult_ataxie', 'consult_pd_erst', 'consult_pd_verlauf', 'consult_sonstiges', 'consult_ths_verlauf', 'consult_tremor_erst', 'consult_tremor_verlauf'])
    for (const r of rows) {
      const t = normalizeConsultTemplate(JSON.parse(r.LOOKUP_BLOB), r.CODE_CD)
      expect(t.visitType, r.CODE_CD).not.toBe('consultation')
      expect(t.textConcepts.map((x) => x.code)).toEqual(['SCTID: 422625006', 'SCTID: 84728005', 'LID: 51848-0', 'SCTID: 304541006'])
      // every referenced visit type exists
      expect(await one("SELECT COUNT(*) FROM CODE_LOOKUP WHERE COLUMN_CD = 'VISIT_TYPE_CD' AND CODE_CD = ?", [t.visitType]), t.visitType).toBe(1)
      // every score concept exists
      for (const s of t.scoreConcepts) expect(await conceptKnown(s.code), s.code).toBe(true)
    }
    const pd = normalizeConsultTemplate(JSON.parse(rows.find((r) => r.CODE_CD === 'consult_pd_verlauf').LOOKUP_BLOB))
    expect(pd.scoreConcepts.find((s) => s.code === 'NEURO:SCORE:LEDD').derived).toBe('ledd')
    expect(pd.medication.showDiff).toBe(true)
    expect(pd.panels).toEqual([])
    expect(normalizeConsultTemplate(JSON.parse(rows.find((r) => r.CODE_CD === 'consult_ths_verlauf').LOOKUP_BLOB)).panels).toEqual(['dbs'])
  })

  it('drug catalogue carries LEDD keys and aliases; frequencies carry dosesPerDay; new routes exist', async () => {
    const levo = await blobOf('carbidopa_levodopa')
    expect(levo.default_strength).toBe('100/25mg')
    expect(levo.ledType).toBe('levodopa')
    expect(levo.aliases).toContain('Nacom')
    expect((await blobOf('levodopa_carbidopa_entacapone')).comt).toBe('comt_entacapone')
    expect(await one("SELECT COUNT(*) FROM CODE_LOOKUP WHERE COLUMN_CD = 'DRUG_OPTIONS' AND LOOKUP_BLOB LIKE '%\"ledType\"%'")).toBe(NEURO_CONSULT_SEED_DATA.DRUGS.filter((d) => d[6]).length)
    const freqs = await q("SELECT CODE_CD, LOOKUP_BLOB FROM CODE_LOOKUP WHERE COLUMN_CD = 'FREQUENCY_OPTIONS'")
    expect(freqs.length).toBeGreaterThanOrEqual(1)
    for (const f of freqs) expect(JSON.parse(f.LOOKUP_BLOB).dosesPerDay, f.CODE_CD).toBe(NEURO_CONSULT_SEED_DATA.DOSES_PER_DAY[f.CODE_CD.toLowerCase()])
    expect(await one("SELECT COUNT(*) FROM CODE_LOOKUP WHERE COLUMN_CD = 'ROUTE_OPTIONS' AND CODE_CD IN ('td','jej')")).toBe(2)
  })

  it('refreshes the repaired questionnaire definitions so their result codes resolve to concepts', async () => {
    const se = JSON.parse((await q("SELECT LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = 'SCHWAB_ENGLAND'"))[0].LOOKUP_BLOB)
    expect(se.results.coding.code).toBe('SCTID: 273544001')
    for (const code of ['WOQ9', 'RBD_SQ', 'BAIN_TREMOR']) {
      const def = JSON.parse((await q('SELECT LOOKUP_BLOB FROM CODE_LOOKUP WHERE CODE_CD = ?', [code]))[0].LOOKUP_BLOB)
      expect(await conceptKnown(def.results.coding.code), code).toBe(true)
    }
    expect(await one("SELECT COUNT(*) FROM CODE_LOOKUP WHERE COLUMN_CD = 'DX_STATUS_CD'")).toBe(3)
  })

  it('is idempotent', async () => {
    const before = await one('SELECT COUNT(*) FROM CONCEPT_DIMENSION')
    const lookups = await one('SELECT COUNT(*) FROM CODE_LOOKUP')
    await neuroConsultSeed.execute(c)
    expect(await one('SELECT COUNT(*) FROM CONCEPT_DIMENSION')).toBe(before)
    expect(await one('SELECT COUNT(*) FROM CODE_LOOKUP')).toBe(lookups)
    const ids = (await blobOf('parkinson_verlauf')).fieldSets.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
