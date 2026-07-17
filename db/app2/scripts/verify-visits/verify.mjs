/**
 * E2E verification of the unified visits view ("Zeitlinie neu").
 *
 * Attaches to a running Electron app via CDP (start with REMOTE_DEBUG_PORT,
 * usually through run.sh) and walks through: labels, expand/collapse, filter,
 * clone, inline edit mode (autosave + Fertig), delete, new-visit auto-edit.
 *
 * SAFETY RULES (learned the hard way — a silently failing clone once made an
 * earlier ad-hoc script delete a REAL visit):
 *   - destructive steps (delete) run ONLY on artifacts this script created
 *     and verified: card count must have increased AND the newest card must
 *     carry today's year before anything is touched
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
const bodies = page.locator('[data-cy="unified-card"] .visit-block-body')
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
check('Kopf-Klick klappt auf', (await bodies.count()) === 1 || (await page.locator('[data-cy="unified-card"] .visit-block-empty').count()) === 1)
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
check('Alle aufklappen', (await bodies.count()) + (await page.locator('[data-cy="unified-card"] .visit-block-empty').count()) === baseline)
await shot('03-expand-all')
await page.locator('[data-cy="unified-expand-toggle"]').first().click()
await wait(800)
check('Alle einklappen', (await bodies.count()) === 0)

// --- Clone (guarded): first card, verified by count + today's year ---
const year = String(new Date().getFullYear())
await cards.first().locator('[data-cy="unified-card-menu"]').click()
await wait(500)
await page.locator('[data-cy="unified-menu-clone"]').click()
await wait(500)
await page.locator('.q-dialog .q-btn:has-text("OK")').first().click()
await wait(4000)

const afterClone = await cards.count()
const cloneHeader = afterClone > baseline ? await cards.first().locator('[data-cy="unified-card-header"]').innerText() : ''
const cloneVerified = afterClone === baseline + 1 && cloneHeader.includes(year)
check('Klon erstellt (Anzahl +1, Datum heute)', cloneVerified, cloneHeader.replace(/\n/g, ' ').slice(0, 80))

if (cloneVerified) {
  // --- Inline edit mode on the CLONE only ---
  await cards.first().locator('[data-cy="unified-card-edit"]').click()
  await wait(3500)
  check('Bearbeitungsmodus aktiv (Chip)', (await page.locator('[data-cy="unified-card-editing-chip"]').count()) === 1)
  check('Feldgruppen-Sidebar sichtbar', (await page.locator('[data-cy="editor-add-observation"]').count()) === 1)
  check('Fokus-Modus: nur die Edit-Karte sichtbar', (await cards.count()) === 1)
  check('Kopfzeile im Edit-Modus ausgeblendet', (await page.locator('[data-cy="unified-new-visit"]').count()) === 0)
  await shot('04-edit-mode')

  // Autosave: first numeric field → 123 → Enter
  const numInput = page.locator('.visit-card-editor input[type="number"]').first()
  if (await numInput.count()) {
    await numInput.click()
    await numInput.fill('123')
    await numInput.press('Enter')
    await wait(2000)
    await page.locator('[data-cy="unified-card-finish"]').click()
    await wait(2500)
    const cardText = await cards.first().innerText()
    check('Autosave: Wert nach „Fertig“ in Lese-Karte', cardText.includes('123'))
    await shot('05-after-done')
  } else {
    await page.locator('[data-cy="unified-card-finish"]').click()
    await wait(2000)
    check('Autosave: numerisches Feld gefunden', false, 'kein number-Input im Editor')
  }

  // --- Delete the clone (still first card, today's date re-verified) ---
  const headerNow = await cards.first().locator('[data-cy="unified-card-header"]').innerText()
  if (headerNow.includes(year)) {
    await cards.first().locator('[data-cy="unified-card-menu"]').click()
    await wait(500)
    await page.locator('[data-cy="unified-menu-delete"]').click()
    await wait(500)
    await page.locator('.q-dialog .q-btn:has-text("Löschen")').first().click()
    await wait(3500)
    check('Klon gelöscht (Anzahl zurück)', (await cards.count()) === baseline)
  } else {
    check('Klon-Löschung', false, 'erste Karte trägt nicht das heutige Datum — nichts gelöscht')
  }
} else {
  console.log('SKIP  Edit-/Lösch-Sektion (kein verifizierter Klon — es wird NICHTS gelöscht)')
}

// --- New visit → must open directly in edit mode; then delete it (guarded) ---
await page.locator('[data-cy="unified-new-visit"]').click()
await wait(1200)
await page.locator('.q-dialog .q-btn:has-text("erstellen")').first().click()
await wait(4000)
const afterCreate = await cards.count()
const createVerified = afterCreate === baseline + 1
check('Neue Visite direkt im Bearbeitungsmodus', createVerified && (await page.locator('[data-cy="unified-card-editing-chip"]').count()) === 1)
await shot('06-new-visit-edit')

if (createVerified) {
  await page.locator('[data-cy="unified-card-finish"]').click()
  await wait(2000)
  const headerNew = await cards.first().locator('[data-cy="unified-card-header"]').innerText()
  if (headerNew.includes(year)) {
    await cards.first().locator('[data-cy="unified-card-menu"]').click()
    await wait(500)
    await page.locator('[data-cy="unified-menu-delete"]').click()
    await wait(500)
    await page.locator('.q-dialog .q-btn:has-text("Löschen")').first().click()
    await wait(3500)
  }
}
check('Endzustand: Ausgangs-Anzahl Visiten', (await cards.count()) === baseline, `${await cards.count()}/${baseline}`)
await shot('07-final')

// --- Summary ---
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} Checks bestanden`)
if (failed.length) console.log('FEHLGESCHLAGEN:', failed.map((f) => f.name).join(' | '))
await browser.close()
process.exit(failed.length ? 1 : 0)
