/**
 * E2E: two writers on ONE database file (multi-user behaviour, Phase 1 of the
 * Sept 2026 audit).
 *
 *   Instance A = the headless Electron app (driven via CDP, like verify-visits)
 *   Instance B = a second, independent SQLite connection in THIS process
 *                (RealSQLiteConnection) — what another app instance is, from
 *                the database's point of view.
 *
 * Checks:
 *   1. B changes a value → A shows it within a few seconds (auto-reload,
 *      PRAGMA data_version poll) — read mode, no banner
 *   2. A is editing → B changes → A shows the StaleDataBanner instead of
 *      reloading
 *   3. A saves a STALE value → rejected (VERSION guard), conflict warning, B's
 *      value stays
 *   4. Banner refresh → A shows B's value
 *   5. B holds a write lock (BEGIN IMMEDIATE) for a few seconds → A's write
 *      waits (busy_timeout + retry) and succeeds after B commits
 *   6. B holds the lock longer than A's patience → A gets the "gesperrt" toast
 *      and the value stays untouched
 *
 * SAFETY: only ONE existing numeric observation is modified and restored to
 * its original value (+ provider) at the end; run.sh backs up the DB and
 * compares row counts. VERSION of that row grows — that is expected.
 *
 * Env: CDP_URL, VERIFY_USER, VERIFY_PASS, VERIFY_PATIENT (PATIENT_CD),
 *      VERIFY_DB (path of the database the app uses), SHOT_DIR
 */
import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'
import { buildValueUpdateStatement } from '../../src/shared/utils/audit-flag.js'

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222'
const USER = process.env.VERIFY_USER || 'helpshot'
const PASS = process.env.VERIFY_PASS || 'helpshot-temp-2026'
const PATIENT_CD = process.env.VERIFY_PATIENT || '10002506'
const DB_PATH = path.resolve(process.env.VERIFY_DB || 'database/production.db')
const SHOT_DIR = process.env.SHOT_DIR || ''
const PROVIDER_B = 'verify-instance-b'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}
const until = async (fn, timeoutMs, stepMs = 500) => {
  const start = Date.now()
  for (;;) {
    if (await fn()) return true
    if (Date.now() - start > timeoutMs) return false
    await wait(stepMs)
  }
}

// ---- Instance B: independent connection on the same file --------------------
const b = new RealSQLiteConnection()
await b.connect(DB_PATH)
const bRow = async (sql, params = []) => (await b.executeQuery(sql, params)).data[0] || null
const bWrite = async (observationId, value, expectedVersion, provider = PROVIDER_B) => {
  const { sql, params } = buildValueUpdateStatement({ valueType: 'N', value, flag: null, providerId: provider, observationId, expectedVersion })
  const result = await b.executeCommand(sql, params)
  if (!result.changes) throw new Error(`B write hit ${result.changes} rows (expected version ${expectedVersion})`)
}
const dbState = (id) => bRow('SELECT NVAL_NUM, VERSION, PROVIDER_ID FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [id])

// ---- Instance A: the app ----------------------------------------------------
const browser = await chromium.connectOverCDP(CDP_URL)
const page = browser
  .contexts()
  .flatMap((c) => c.pages())
  .find((p) => !p.url().startsWith('devtools://'))
if (!page) throw new Error('No app page found via CDP')
console.log('Attached to:', page.url())
// renderer console — printed at the end for diagnosis
const consoleLog = []
page.on('console', (m) => {
  const text = m.text()
  if (['error', 'warning'].includes(m.type()) || /busy|retry|gesperrt|Failed to save|Stale|conflict|Remote change|reload/i.test(text)) consoleLog.push(`[${m.type()}] ${text.replace(/%c|color: #\w+; font-weight: bold;/g, '').slice(0, 220)}`)
})
page.on('pageerror', (e) => consoleLog.push(`[pageerror] ${e.message}`))
const notifications = async () => (await page.locator('.q-notification').allInnerTexts()).join(' | ')

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

for (let i = 0; i < 30; i++) {
  if ((await page.locator('[data-cy="login-username"], .q-page').count()) > 0) break
  await wait(2000)
}
if ((await page.evaluate(() => localStorage.getItem('locale'))) !== 'de') {
  await page.evaluate(() => localStorage.setItem('locale', 'de'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await wait(5000)
}
await ensureLoggedIn()

await page.evaluate((cd) => {
  window.location.hash = `#/visits/${cd}`
}, PATIENT_CD)
await page.locator('[data-cy="view-mode-unified"]').first().waitFor({ timeout: 30000 })
await page.locator('[data-cy="view-mode-unified"]').first().click()
await page.locator('[data-cy="unified-card"]').first().waitFor({ timeout: 30000 })
await wait(1000)

const cards = page.locator('[data-cy="unified-card"]')
const firstCard = cards.first()
const firstVisitId = await firstCard.getAttribute('data-visit-id')
check('Zeitlinie geladen', (await cards.count()) > 0 && !!firstVisitId, `${await cards.count()} Visiten, oberste Visite ${firstVisitId}`)
const appBusyTimeout = await page.evaluate(async () => (await window.electron.dbman.query('PRAGMA busy_timeout'))[0]?.timeout ?? null)
check('App-Connection wartet auf Sperren (busy_timeout = 4000)', Number(appBusyTimeout) === 4000, `busy_timeout=${appBusyTimeout}`)

// Target: the observation behind the FIRST numeric input of the top visit's
// editor. Enter edit mode once to identify it, then leave again.
await firstCard.locator('[data-cy="unified-card-edit"]').click()
await wait(3500)
const numInput = firstCard.locator('input[type="number"]').first()
const inputValue = (await numInput.count()) ? await numInput.inputValue() : null
let target = null
if (inputValue !== null && inputValue !== '') {
  const candidates = (
    await b.executeQuery(
      `SELECT OBSERVATION_ID, NVAL_NUM, VERSION, PROVIDER_ID FROM OBSERVATION_FACT
        WHERE ENCOUNTER_NUM = ? AND VALTYPE_CD = 'N' AND NVAL_NUM = ? AND VALUEFLAG_CD IS NULL`,
      [Number(firstVisitId), Number(inputValue)],
    )
  ).data
  if (candidates.length === 1) target = candidates[0]
}
check('Ziel-Beobachtung eindeutig identifiziert', target !== null, target ? `OBSERVATION_ID ${target.OBSERVATION_ID}, Wert ${target.NVAL_NUM}, Version ${target.VERSION}` : `Eingabewert ${inputValue}`)
await page.locator('[data-cy="unified-card-finish"]').click()
await wait(2500)

if (target) {
  const original = { value: Number(target.NVAL_NUM), provider: target.PROVIDER_ID }
  const cardById = (id) => page.locator(`[data-cy="unified-card"][data-visit-id="${id}"]`)
  // the UI formats numbers in the active locale (0,32) — compare normalised
  const cardShows = async (value) => (await cardById(firstVisitId).innerText()).replace(/(\d),(\d)/g, '$1.$2').includes(String(value))
  const plus = (base, n) => Math.round((base + n) * 100) / 100
  const banner = page.locator('[data-cy="stale-data-banner"]')

  try {
    // make sure the top card is EXPANDED (the edit round may have left it open —
    // a blind header click would collapse it again)
    if ((await cardById(firstVisitId).locator('.visit-block-body:visible, .visit-block-empty:visible').count()) === 0) {
      await cardById(firstVisitId).locator('[data-cy="unified-card-header"]').click()
      await wait(1000)
    }
    check('Ausgangswert in der Lese-Karte sichtbar', await cardShows(original.value), `${original.value}`)

    // 1. remote write → auto-reload in read mode
    const v1 = plus(original.value, 1)
    let state = await dbState(target.OBSERVATION_ID)
    await bWrite(target.OBSERVATION_ID, v1, state.VERSION)
    const t0 = Date.now()
    const seen = await until(() => cardShows(v1), 15000)
    check('Fremde Änderung erscheint im Lesemodus ohne Nutzeraktion (Auto-Reload)', seen, seen ? `nach ${Date.now() - t0} ms` : 'nicht innerhalb 15 s')
    check('Kein Banner im Lesemodus', (await banner.count()) === 0)
    await shot('01-auto-reload')

    // 2. editing → remote write → banner, no reload
    await cardById(firstVisitId).locator('[data-cy="unified-card-edit"]').click()
    await wait(3500)
    const input = cardById(firstVisitId).locator('input[type="number"]').first()
    check('Editor zeigt den nachgeladenen Wert', (await input.inputValue()) === String(v1), await input.inputValue())
    const v2 = plus(v1, 1)
    state = await dbState(target.OBSERVATION_ID)
    await bWrite(target.OBSERVATION_ID, v2, state.VERSION)
    const bannerSeen = await until(async () => (await banner.count()) > 0, 15000)
    check('Banner „von anderem Nutzer geändert“ während der Bearbeitung', bannerSeen)
    check('Kein Auto-Reload während der Bearbeitung (Editor behält alten Wert)', (await input.inputValue()) === String(v1), await input.inputValue())
    await shot('02-banner')

    // 3. stale save → rejected, conflict warning, B's value stays
    const vStale = plus(v1, 50)
    await input.click()
    await input.fill(String(vStale))
    await input.press('Enter')
    const conflictSeen = await until(async () => /anderen Nutzer/i.test(await page.locator('.q-notification').allInnerTexts().then((t) => t.join(' '))), 8000)
    check('Konfliktwarnung bei veraltetem Speichern', conflictSeen)
    await wait(1500)
    state = await dbState(target.OBSERVATION_ID)
    check('Veralteter Wert wurde NICHT geschrieben (VERSION-Guard)', Number(state.NVAL_NUM) === v2, `DB=${state.NVAL_NUM}, erwartet ${v2}`)
    check('Beobachtung nach Konflikt in-place nachgeladen', (await input.inputValue()) === String(v2), await input.inputValue())
    await shot('03-conflict')

    // 4. banner refresh
    if (await banner.count()) {
      await page.locator('[data-cy="stale-data-refresh"]').click()
      await wait(2500)
    }
    check('Banner nach Aktualisieren weg', (await banner.count()) === 0)

    // 5. B holds a write lock briefly → A's write waits and succeeds
    const v3 = plus(v2, 1)
    const input2 = cardById(firstVisitId).locator('input[type="number"]').first()
    // BEGIN IMMEDIATE already holds the write lock — no statement on the target
    // row (that would bump VERSION via the guard trigger and make A's write stale)
    const lockB = b.withTransaction(async () => {
      await wait(6000)
    })
    await wait(300)
    await input2.click()
    await input2.fill(String(v3))
    await input2.press('Enter')
    await lockB
    const written = await until(async () => Number((await dbState(target.OBSERVATION_ID)).NVAL_NUM) === v3, 20000)
    check('Write wartet auf fremde Sperre (6 s) und gelingt danach', written, `DB=${(await dbState(target.OBSERVATION_ID)).NVAL_NUM}; Notifications: ${(await notifications()).slice(0, 160)}`)

    // 6. B holds the lock longer than busy_timeout + retries → toast, value untouched
    const v4 = plus(v3, 1)
    const longLock = b.withTransaction(async () => {
      await wait(24000)
    })
    await wait(300)
    const input3 = cardById(firstVisitId).locator('input[type="number"]').first()
    await input3.click()
    await input3.fill(String(v4))
    await input3.press('Enter')
    const toastSeen = await until(async () => /gesperrt/i.test(await page.locator('.q-notification').allInnerTexts().then((t) => t.join(' '))), 22000, 1000)
    check('Toast „durch anderen Nutzer gesperrt“ statt stiller Null', toastSeen)
    await longLock
    await wait(1000)
    state = await dbState(target.OBSERVATION_ID)
    check('Wert nach fehlgeschlagenem Write unverändert', Number(state.NVAL_NUM) === v3, `DB=${state.NVAL_NUM}`)
    await shot('04-lock-toast')

    await page.locator('[data-cy="unified-card-finish"]').click()
    await wait(2500)
  } finally {
    // restore the original value + provider (VERSION keeps growing — expected)
    const state = await dbState(target.OBSERVATION_ID)
    await bWrite(target.OBSERVATION_ID, original.value, state.VERSION, original.provider)
    const restored = await dbState(target.OBSERVATION_ID)
    check('Ausgangswert wiederhergestellt', Number(restored.NVAL_NUM) === original.value && restored.PROVIDER_ID === original.provider, `DB=${restored.NVAL_NUM}, Version ${restored.VERSION}`)
  }
}

const failed = results.filter((r) => !r.ok)
if (failed.length) {
  console.log('--- Renderer-Konsole (Auszug):')
  for (const line of consoleLog.slice(-40)) console.log('   ', line)
}
console.log(`\n${results.length - failed.length}/${results.length} Checks bestanden`)
if (failed.length) console.log('FEHLGESCHLAGEN:', failed.map((f) => f.name).join(' | '))
await b.disconnect()
await browser.close()
process.exit(failed.length ? 1 : 0)
