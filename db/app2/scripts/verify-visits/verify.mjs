/**
 * E2E verification of the unified visits timeline (the "Zeitlinie" tab).
 *
 * Attaches to a running Electron app via CDP (start with REMOTE_DEBUG_PORT,
 * usually through run.sh) and walks through: labels, expand/collapse, filter,
 * clone, inline edit mode (autosave + Fertig), delete, new-visit auto-edit.
 *
 * SAFETY RULES (learned the hard way — a silently failing clone once made an
 * earlier ad-hoc script delete a REAL visit):
 *   - destructive steps (delete) run ONLY on artifacts this script created,
 *     identified by data-visit-id SET DIFFERENCE (exactly one new id after
 *     clone/create) — never "the first card" or a date heuristic
 *   - if the clone/new-visit doesn't verifiably exist, the section FAILs and
 *     is skipped — nothing is deleted
 *   - run.sh additionally backs up the DB and compares row counts afterwards
 *
 * Env: CDP_URL, VERIFY_USER, VERIFY_PASS, VERIFY_PATIENT (PATIENT_CD),
 *      VERIFY_LABEL (expected visit-type label fragment), VERIFY_FILTER,
 *      SHOT_DIR (optional screenshots)
 */

import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222'
const USER = process.env.VERIFY_USER || 'helpshot'
const PASS = process.env.VERIFY_PASS || 'helpshot-temp-2026'
const PATIENT_CD = process.env.VERIFY_PATIENT || '10002506'
const LABEL = process.env.VERIFY_LABEL || 'Stroke-Lipid'
const FILTER = process.env.VERIFY_FILTER || 'LDL'
const SHOT_DIR = process.env.SHOT_DIR || ''

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const browser = await chromium.connectOverCDP(CDP_URL)
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => !p.url().startsWith('devtools://'))
if (!page) throw new Error('No app page found via CDP')
console.log('Attached to:', page.url())

const shot = async (name) => {
  if (!SHOT_DIR) return
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) })
}

const ensureLoggedIn = async () => {
  const userInput = page.locator('[data-cy="login-username"] input, input[data-cy="login-username"]').first()
  if (await userInput.count()) {
    await userInput.fill(USER)
    await page.locator('input[type="password"]').first().fill(PASS)
    await page.locator('[data-cy="login-submit"]').first().click()
    await wait(4000)
  }
}

// Boot + login + German UI (assertions below use German labels)
for (let i = 0; i < 30; i++) {
  if ((await page.locator('[data-cy="login-username"], .q-page').count()) > 0) break
  await wait(2000)
}
await ensureLoggedIn()
if ((await page.evaluate(() => localStorage.getItem('locale'))) !== 'de') {
  await page.evaluate(() => localStorage.setItem('locale', 'de'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await wait(5000)
  await ensureLoggedIn()
}

// --- Open patient → unified view ---
await page.evaluate((cd) => {
  window.location.hash = `#/visits/${cd}`
}, PATIENT_CD)
await wait(2500)
await page.locator('[data-cy="view-mode-unified"]').first().click()
await wait(2000)

const cards = page.locator('[data-cy="unified-card"]')
// v-show keeps collapsed bodies in the DOM — count only VISIBLE ones
const bodies = page.locator('[data-cy="unified-card"] .visit-block-body:visible')
const emptyBlocks = page.locator('[data-cy="unified-card"] .visit-block-empty:visible')
const baseline = await cards.count()
check('Karten vorhanden', baseline > 0, `${baseline} Visiten`)
check('Schnellnav bei eingeklappten Karten verborgen', (await page.locator('[data-cy="unified-quick-nav"]').count()) === 0)
await shot('01-collapsed')

// --- Correct visit-type labels (CODE_LOOKUP, not the static fallback) ---
const chipTexts = (await page.locator('[data-cy="unified-card"] .q-chip').allInnerTexts()).join(' | ')
check(`Typ-Label enthält „${LABEL}“`, chipTexts.includes(LABEL), chipTexts.slice(0, 120))
check('Kein „General Visit“-Fallback', !chipTexts.includes('General Visit'))

// --- Expand one card via header click ---
await page.locator('[data-cy="unified-card-header"]').first().click()
await wait(1000)
check('Kopf-Klick klappt auf', (await bodies.count()) === 1 || (await emptyBlocks.count()) === 1)
check('Schnellnav erscheint bei aufgeklappter Visite', (await page.locator('[data-cy="unified-quick-nav"]').count()) === 1)
await page.locator('[data-cy="unified-card-header"]').first().click()
await wait(600)

// --- Filter: matches force-expanded, non-matches hidden ---
await page.locator('[data-cy="unified-search"] input, input[data-cy="unified-search"]').first().fill(FILTER)
await wait(1200)
const filtered = await cards.count()
check(`Filter „${FILTER}“ blendet Visiten aus`, filtered > 0 && filtered <= baseline, `${filtered}/${baseline} sichtbar`)
check('Treffer-Visiten aufgeklappt', (await bodies.count()) === filtered)
await shot('02-filter')
await page.locator('[data-cy="unified-search"] input, input[data-cy="unified-search"]').first().fill('')
await wait(1000)

// --- Expand-all / collapse-all toggle ---
await page.locator('[data-cy="unified-expand-toggle"]').first().click()
await wait(800)
check('Alle aufklappen', (await bodies.count()) + (await emptyBlocks.count()) === baseline)
await shot('03-expand-all')
await page.locator('[data-cy="unified-expand-toggle"]').first().click()
await wait(800)
check('Alle einklappen', (await bodies.count()) === 0)

// Cards are identified by ENCOUNTER_NUM (data-visit-id) — destructive steps
// address ONLY ids that appeared through this script's own actions, never
// "the first card" (a real same-day or future-dated visit could sit there)
const cardIds = async () => page.locator('[data-cy="unified-card"]').evaluateAll((els) => els.map((el) => el.dataset.visitId))
const cardById = (id) => page.locator(`[data-cy="unified-card"][data-visit-id="${id}"]`)

const deleteCardById = async (id) => {
  await cardById(id).locator('[data-cy="unified-card-menu"]').click()
  await wait(500)
  await page.locator('[data-cy="unified-menu-delete"]').click()
  await wait(500)
  await page.locator('.q-dialog .q-btn:has-text("Löschen")').first().click()
  await wait(3500)
}

// --- Clone (guarded): the clone is the ID that was not there before ---
const idsBeforeClone = await cardIds()
await cards.first().locator('[data-cy="unified-card-menu"]').click()
await wait(500)
await page.locator('[data-cy="unified-menu-clone"]').click()
await wait(500)
await page.locator('.q-dialog .q-btn:has-text("OK")').first().click()
await wait(4000)

const newCloneIds = (await cardIds()).filter((id) => !idsBeforeClone.includes(id))
const cloneId = newCloneIds.length === 1 ? newCloneIds[0] : null
check('Klon erstellt (genau eine neue Visiten-ID)', cloneId !== null, `neue IDs: ${JSON.stringify(newCloneIds)}`)

if (cloneId !== null) {
  // --- Inline edit mode on the CLONE only (addressed by id) ---
  await cardById(cloneId).locator('[data-cy="unified-card-edit"]').click()
  await wait(3500)
  check('Bearbeitungsmodus aktiv (Chip)', (await page.locator('[data-cy="unified-card-editing-chip"]').count()) === 1)
  check('Feldgruppen-Sidebar sichtbar', (await page.locator('[data-cy="editor-add-observation"]').count()) === 1)
  check('Fokus-Modus: nur die Edit-Karte sichtbar', (await cards.count()) === 1 && (await cardById(cloneId).count()) === 1)
  check('Kopfzeile im Edit-Modus ausgeblendet', (await page.locator('[data-cy="unified-new-visit"]').count()) === 0)
  await shot('04-edit-mode')

  // Autosave: first numeric field → 123 → Enter (inside the clone card only)
  const numInput = cardById(cloneId).locator('input[type="number"]').first()
  if (await numInput.count()) {
    await numInput.click()
    await numInput.fill('123')
    await numInput.press('Enter')
    await wait(2000)
    await page.locator('[data-cy="unified-card-finish"]').click()
    await wait(2500)
    const cardText = await cardById(cloneId).innerText()
    check('Autosave: Wert nach „Fertig“ in Lese-Karte', cardText.includes('123'))
    await shot('05-after-done')
  } else {
    await page.locator('[data-cy="unified-card-finish"]').click()
    await wait(2000)
    check('Autosave: numerisches Feld gefunden', false, 'kein number-Input im Editor')
  }

  // --- Delete the clone (by id) ---
  await deleteCardById(cloneId)
  check('Klon gelöscht (ID weg, Anzahl zurück)', (await cardById(cloneId).count()) === 0 && (await cards.count()) === baseline)
} else {
  console.log('SKIP  Edit-/Lösch-Sektion (kein eindeutiger Klon — es wird NICHTS gelöscht)')
}

// --- New visit → must open directly in edit mode; then delete it (by id) ---
const idsBeforeCreate = await cardIds()
await page.locator('[data-cy="unified-new-visit"]').click()
await wait(1200)
await page.locator('.q-dialog .q-btn:has-text("erstellen")').first().click()
await wait(4000)
const newVisitIds = (await cardIds()).filter((id) => !idsBeforeCreate.includes(id))
const newVisitId = newVisitIds.length === 1 ? newVisitIds[0] : null
check('Neue Visite direkt im Bearbeitungsmodus', newVisitId !== null && (await page.locator('[data-cy="unified-card-editing-chip"]').count()) === 1)
await shot('06-new-visit-edit')

if (newVisitId !== null) {
  await page.locator('[data-cy="unified-card-finish"]').click()
  await wait(2000)
  await deleteCardById(newVisitId)
}
check('Endzustand: Ausgangs-Anzahl Visiten', (await cards.count()) === baseline, `${await cards.count()}/${baseline}`)
await shot('07-final')

// --- Summary ---
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} Checks bestanden`)
if (failed.length) console.log('FEHLGESCHLAGEN:', failed.map((f) => f.name).join(' | '))
await browser.close()
process.exit(failed.length ? 1 : 0)
