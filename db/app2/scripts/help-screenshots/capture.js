/**
 * Help-page screenshot capture
 *
 * Attaches to the running Electron app via CDP (start the app with
 * REMOTE_DEBUG_PORT=9222, e.g. under xvfb) and captures the screenshots
 * used by the in-app help page (/help).
 *
 * Usage:
 *   REMOTE_DEBUG_PORT=9222 xvfb-run -a npx quasar dev -m electron   # terminal 1
 *   HELP_USER=... HELP_PASS=... node scripts/help-screenshots/capture.js
 *
 * Output: public/help/*.png (1600x900 app window)
 *
 * Resilient against renderer crashes: every step re-checks the session and
 * logs in again when the app fell back to the login page.
 */

import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../../public/help')

const CDP_URL = process.env.CDP_URL || 'http://localhost:9222'
const LOGIN_USER = process.env.HELP_USER || 'ste'
const LOGIN_PASS = process.env.HELP_PASS || '123'
// Known-good demo records (present in the dev DB)
const PATIENT_CD = process.env.HELP_PATIENT || '10000559'
const STUDY_ID = process.env.HELP_STUDY || '4'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.connectOverCDP(CDP_URL)
  const pages = browser.contexts().flatMap((c) => c.pages())
  const page = pages.find((p) => !p.url().startsWith('devtools://'))
  if (!page) throw new Error('No app page found via CDP')
  console.log('Attached to:', page.url())

  const ensureLoggedIn = async () => {
    const userInput = page.locator('[data-cy="login-username"] input, input[data-cy="login-username"]').first()
    if (await userInput.count()) {
      console.log('  (re-)logging in…')
      await userInput.fill(LOGIN_USER)
      await page.locator('input[type="password"]').first().fill(LOGIN_PASS)
      await page.locator('[data-cy="login-submit"]').first().click()
      await wait(3500)
    }
  }

  // Recover from a crashed renderer: reload until the app responds again
  const recover = async () => {
    for (let i = 0; i < 4; i++) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 })
        await wait(6000)
        await ensureLoggedIn()
        return true
      } catch {
        await wait(4000)
      }
    }
    return false
  }

  const goto = async (hash) => {
    try {
      await page.evaluate((h) => {
        window.location.hash = h
      }, hash)
      await wait(1500)
      await ensureLoggedIn()
    } catch (err) {
      console.warn('goto failed, recovering:', err.message)
      await recover()
      await page.evaluate((h) => {
        window.location.hash = h
      }, hash)
      await wait(1500)
    }
  }

  const shot = async (name) => {
    await wait(900)
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
    console.log('captured', name)
  }

  // Optional: only capture screenshots that don't exist yet
  const skipExisting = process.env.ONLY_MISSING === '1'
  const exists = (name) => fs.existsSync(path.join(OUT_DIR, `${name}.png`))

  const step = async (hash, name) => {
    if (skipExisting && exists(name)) {
      console.log('skip (exists)', name)
      return
    }
    try {
      await goto(hash)
      await wait(1000)
      await shot(name)
    } catch (err) {
      console.warn('step failed, retrying after recovery:', name, err.message)
      if (await recover()) {
        await goto(hash)
        await shot(name)
      }
    }
  }

  // --- Login page (before authenticating) ---
  await goto('#/login')
  await wait(1000)
  if ((await page.locator('[data-cy="login-username"]').count()) > 0) {
    await shot('login')
  }
  await ensureLoggedIn()
  console.log('after login:', page.url())

  const simple = [
    ['#/dashboard', 'dashboard'],
    ['#/visits', 'visits'],
    [`#/visits/${PATIENT_CD}`, 'visits-patient'],
    // Hop away first: a pure query change on the same route doesn't re-trigger
    // the view-mode switch in VisitsPage
    ['#/dashboard', 'dashboard'],
    [`#/visits/${PATIENT_CD}?view=patient`, 'patient-data'],
    ['#/questionnaires', 'questionnaires'],
  ]
  for (const [hash, name] of simple) {
    await step(hash, name)
  }

  // --- Studies list (clear the remember-flag so we see the list) ---
  await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('best-medical-local-settings')
      if (raw) {
        const s = JSON.parse(raw)
        if (s.studies) s.studies.lastSelectedStudyId = null
        localStorage.setItem('best-medical-local-settings', JSON.stringify(s))
      }
    } catch {
      /* ignore */
    }
  })
  if (!(skipExisting && exists('studies'))) {
    await goto('#/dashboard')
    await step('#/studies', 'studies')
  }
  await step(`#/studies/${STUDY_ID}`, 'study-details')

  const rest = [
    ['#/data-grid', 'data-grid'],
    ['#/import', 'import'],
    ['#/export', 'export'],
    ['#/concepts', 'concepts'],
    ['#/cql', 'cql'],
    ['#/users', 'users'],
    ['#/global-settings', 'global-settings'],
    ['#/settings', 'settings'],
  ]
  for (const [hash, name] of rest) {
    await step(hash, name)
  }

  // --- SmartButton: open the notes window ---
  await goto('#/dashboard')
  // q-fab renders its activator as <a role="button">, not <button>
  const fab = page.locator('.smart-button-container .q-btn').first()
  if (await fab.count()) {
    await fab.click()
    await wait(800)
    const actions = page.locator('.q-fab__actions .q-btn')
    const actionCount = await actions.count()
    console.log('fab actions:', actionCount)
    if (actionCount >= 2) {
      // Notes is the second registered plugin
      await actions.nth(1).click()
      await wait(1800)
      await shot('smartbutton-notes')
      // close the window again
      const closeBtn = page.locator('.plugin-window .q-btn i.q-icon:text("close")').first()
      if (await closeBtn.count()) await closeBtn.click()
    }
  } else {
    console.warn('SmartButton FAB not found')
  }

  // --- Grid editor LAST (occasionally crashes the renderer) ---
  await goto('#/data-grid')
  await wait(1000)
  const cards = page.locator('.patient-cards-grid .q-card')
  if ((await cards.count()) >= 2) {
    await cards.nth(0).click()
    await cards.nth(1).click()
    await wait(600)
    const openBtn = page.locator('button', { hasText: /Open Data Grid|Datentabelle öffnen/i }).first()
    if (await openBtn.count()) {
      await openBtn.click()
      await wait(4000)
      await shot('grid-editor')
    }
  }

  await browser.close()
  console.log('done, screenshots in', OUT_DIR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
