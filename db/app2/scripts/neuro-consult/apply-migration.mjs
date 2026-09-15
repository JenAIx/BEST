#!/usr/bin/env node
/**
 * Apply migration 017-neuro-consult-seed to a database file without starting
 * the app (the app runs it automatically on next start anyway).
 *
 *   node scripts/neuro-consult/apply-migration.mjs [database/production.db] [--force]
 *
 * Idempotent: re-runs the upserts every time; --force additionally removes
 * the migration row first so the app-side runner would re-apply it as well.
 */
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import { neuroConsultSeed } from '../../src/core/database/migrations/017-neuro-consult-seed.js'

const args = process.argv.slice(2)
const dbPath = path.resolve(args.find((a) => !a.startsWith('--')) || 'database/production.db')
const force = args.includes('--force')

const c = new RealSQLiteConnection()
await c.connect(dbPath)
if (force) await c.executeCommand('DELETE FROM migrations WHERE name = ?', [neuroConsultSeed.name])
await neuroConsultSeed.execute(c)
await c.executeCommand('CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP, checksum TEXT, description TEXT)')
await c.executeCommand('INSERT OR IGNORE INTO migrations (name, checksum, description) VALUES (?, ?, ?)', [neuroConsultSeed.name, 'manual', neuroConsultSeed.description])
const n = (await c.executeQuery("SELECT COUNT(*) AS n FROM CONCEPT_DIMENSION WHERE CONCEPT_CD LIKE 'NEURO:%'")).data[0].n
const t = (await c.executeQuery("SELECT COUNT(*) AS n FROM CODE_LOOKUP WHERE COLUMN_CD = 'CONSULT_TEMPLATE_CD'")).data[0].n
console.log(`applied ${neuroConsultSeed.name} to ${dbPath}: ${n} NEURO:* concepts, ${t} consult templates`)
await c.disconnect()
