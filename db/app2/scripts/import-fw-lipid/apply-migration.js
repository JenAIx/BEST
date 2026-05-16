#!/usr/bin/env node
'use strict'

/**
 * Apply migration 010-stroke-lipid-seed to production.db directly via better-sqlite3.
 *
 * Idempotent: if the migration is already in the `migrations` table, this script
 * still re-runs the UPSERTs + category fix-ups (self-healing) but skips re-marking.
 *
 * Pass --force to drop the migration row first and re-apply from scratch.
 */

const path = require('node:path')
const Database = require('better-sqlite3')

const args = process.argv.slice(2)
const FORCE = args.includes('--force')

async function main() {
  const dbPath = path.resolve(__dirname, '../../database/production.db')
  console.log(`db: ${dbPath}  force: ${FORCE}`)

  const url = require('node:url').pathToFileURL(
    path.resolve(__dirname, '../../src/core/database/migrations/010-stroke-lipid-seed.js'),
  )
  const mod = await import(url.href)
  const { STROKE_LIPID_SEED_DATA, strokeLipidSeed } = mod
  if (!STROKE_LIPID_SEED_DATA) throw new Error('STROKE_LIPID_SEED_DATA not exported')

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  if (FORCE) {
    const r = db
      .prepare('DELETE FROM migrations WHERE name = ?')
      .run(strokeLipidSeed.name)
    console.log(`--force: removed ${r.changes} migration row(s)`)
  }

  const now = new Date().toISOString()
  const SRC = 'STROKE_LIPID_MIGRATION'

  // Self-healing upsert: re-applies CATEGORY_CHAR + NAME_CHAR + UNIT_CD on conflict.
  const upsertConcept = db.prepare(
    `INSERT INTO CONCEPT_DIMENSION
       (CONCEPT_PATH, CONCEPT_CD, NAME_CHAR, VALTYPE_CD, UNIT_CD, CATEGORY_CHAR,
        SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(CONCEPT_CD) DO UPDATE SET
       NAME_CHAR = excluded.NAME_CHAR,
       VALTYPE_CD = excluded.VALTYPE_CD,
       UNIT_CD = excluded.UNIT_CD,
       CATEGORY_CHAR = excluded.CATEGORY_CHAR,
       UPDATE_DATE = excluded.UPDATE_DATE`,
  )
  const upsertLookup = db.prepare(
    `INSERT INTO CODE_LOOKUP
       (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB,
        SOURCESYSTEM_CD, IMPORT_DATE, UPDATE_DATE)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(CODE_CD) DO UPDATE SET
       NAME_CHAR = excluded.NAME_CHAR,
       LOOKUP_BLOB = excluded.LOOKUP_BLOB,
       UPDATE_DATE = excluded.UPDATE_DATE`,
  )
  const upsertStudy = db.prepare(
    `INSERT INTO STUDY_DIMENSION
       (STUDY_CD, NAME_CHAR, CATEGORY_CHAR, DESCRIPTION_CHAR, STATUS_CD,
        PRINCIPAL_INVESTIGATOR, SOURCESYSTEM_CD, IMPORT_DATE)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
     ON CONFLICT(STUDY_CD) DO UPDATE SET
       NAME_CHAR = excluded.NAME_CHAR,
       CATEGORY_CHAR = excluded.CATEGORY_CHAR`,
  )
  const fixupCategory = db.prepare(
    `UPDATE CONCEPT_DIMENSION SET CATEGORY_CHAR = ?, UPDATE_DATE = ? WHERE CONCEPT_CD = ?`,
  )
  const markMigration = db.prepare(
    `INSERT OR IGNORE INTO migrations (name, executed_at, description) VALUES (?, ?, ?)`,
  )

  let cConcept = 0
  let cLookup = 0
  let cFixup = 0

  const tx = db.transaction(() => {
    for (const [path_, code, nameChar, valtype, unit, category] of STROKE_LIPID_SEED_DATA.concepts) {
      const r = upsertConcept.run(path_, code, nameChar, valtype, unit, category, SRC, now, now)
      cConcept += r.changes
    }
    for (const fs of STROKE_LIPID_SEED_DATA.fieldSets) {
      const r = upsertLookup.run(
        'VISIT_DIMENSION', 'FIELD_SET_CD', fs.code, fs.name, JSON.stringify(fs.blob),
        SRC, now, now,
      )
      cLookup += r.changes
    }
    for (const vt of STROKE_LIPID_SEED_DATA.visitTypes) {
      const r = upsertLookup.run(
        'VISIT_DIMENSION', 'VISIT_TYPE_CD', vt.code, vt.name, JSON.stringify(vt.blob),
        SRC, now, now,
      )
      cLookup += r.changes
    }
    for (const vf of STROKE_LIPID_SEED_DATA.valueflagCodes) {
      const r = upsertLookup.run(
        'OBSERVATION_FACT', 'VALUEFLAG_CD', vf.code, vf.name, JSON.stringify(vf.blob),
        SRC, now, now,
      )
      cLookup += r.changes
    }
    const s = STROKE_LIPID_SEED_DATA.study
    upsertStudy.run(s.STUDY_CD, s.NAME_CHAR, s.CATEGORY_CHAR, s.DESCRIPTION_CHAR, s.PRINCIPAL_INVESTIGATOR, SRC, now)
    for (const [code, cat] of (STROKE_LIPID_SEED_DATA.categoryFixups || [])) {
      const r = fixupCategory.run(cat, now, code)
      cFixup += r.changes
    }
    markMigration.run(strokeLipidSeed.name, now, strokeLipidSeed.description)
  })
  tx()

  console.log(`upserted: ${cConcept} concepts, ${cLookup} lookups, 1 study`)
  console.log(`category fix-ups for existing concepts: ${cFixup}`)
  console.log(`migration row: ${strokeLipidSeed.name}`)
  db.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
