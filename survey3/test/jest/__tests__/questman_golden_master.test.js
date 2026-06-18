// GOLDEN-MASTER / CHARAKTERISIERUNGSTEST
//
// Friert das AKTUELLE Berechnungsverhalten aller Fragebögen ein, damit ein
// späterer Umbau der Scoring-Engine nachweisbar nichts verändert.
//
// Vorgehen:
//   1. Jeder Fragebogen wird DETERMINISTISCH befüllt (kein Math.random, sonst
//      wären die Snapshots instabil). Radios/Multiple-Radios bekommen die
//      JEWEILS LETZTE Option — typischerweise der höchste Rohwert, wodurch ein
//      "bleibt auf 0 hängen"-Bug (z.B. nicht implementierte Methoden) auffällt.
//   2. summary.results wird pro Fragebogen als Snapshot abgelegt (ohne Datums-
//      felder, die sind nicht reproduzierbar).
//   3. Ein Anomalie-Report (leere/0/NaN/null/String-Resultate, Exceptions) wird
//      nach test/jest/golden_master_report.json geschrieben und am Ende geloggt.
//
// Run:  npm run test:unit test/jest/__tests__/questman_golden_master.test.js
//
// WICHTIG: Schlägt nach einem Engine-Umbau ein Snapshot fehl, ist das das
// Signal "Berechnung hat sich geändert" — bewusst prüfen, nicht blind
// --updateSnapshot ausführen.

import fs from 'fs'
import path from 'path'
import { QUESTMAN } from '../../../src/tools/questman'

// Deterministisch ein einzelnes Item befüllen (spiegelt die Typen aus
// QuestMan.random_fill, aber ohne Zufall).
function fillItem(item) {
  switch (item.type) {
    case 'radio': {
      if (Array.isArray(item.options) && item.options.length) {
        item.value = item.options[item.options.length - 1].value
      }
      break
    }
    case 'checkbox': {
      if (Array.isArray(item.options) && item.options.length) {
        // erste echte Option (random_fill lässt die letzte i.d.R. aus)
        item.value = [item.options[0].value]
      }
      break
    }
    case 'multiple_radio': {
      const answers = (item.options && item.options.answers) || []
      const questions = (item.options && item.options.questions) || []
      item.value = questions.map(() =>
        answers.length ? answers[answers.length - 1].value : null
      )
      break
    }
    case 'number':
      item.value = 3
      break
    case 'slider':
      item.value = 0
      break
    case 'text':
      item.value = 'x'
      break
    case 'date':
      item.value = '01.01.1970'
      break
    case 'date_year':
      item.value = '1970'
      break
    case 'time':
      item.value = '12:00'
      break
    default:
      // separator / seperator / textbox / image / undefined -> nicht befüllen
      break
  }
}

function fillActiveQuest() {
  const items = QUESTMAN.activeQuest.value.items
  items.forEach(fillItem)
}

// Resultate auf Auffälligkeiten prüfen. Nach dem Befüllen mit "Maximal"-Optionen
// ist ein Score von 0 verdächtig (häufig: nicht implementierte Scoring-Methode).
function inspectResults(results) {
  const flags = []
  if (!Array.isArray(results)) {
    // method-lose Fragebögen liefern {} -> keine Scores, separat markieren
    flags.push({ severity: 'info', code: 'NO_SCORING' })
    return flags
  }
  if (results.length === 0) {
    flags.push({ severity: 'error', code: 'EMPTY_RESULTS' })
    return flags
  }
  results.forEach((r) => {
    const v = r.value
    const lbl = r.label
    if (v === null || v === undefined) {
      flags.push({ severity: 'error', code: 'NULL_VALUE', label: lbl })
    } else if (typeof v === 'number' && Number.isNaN(v)) {
      flags.push({ severity: 'error', code: 'NAN_VALUE', label: lbl })
    } else if (typeof v === 'string') {
      // z.B. unaufgelöste substract()-Verkettung "a-b" oder "undefined-..."
      flags.push({ severity: 'warn', code: 'STRING_VALUE', label: lbl, value: v })
    } else if (v === 0) {
      flags.push({ severity: 'warn', code: 'ZERO_VALUE', label: lbl })
    }
  })
  return flags
}

// --- alle gebündelten Quests (synchron via Vite-Glob-Transform geladen) ---
const ALL = QUESTMAN.quest_list.slice().sort()
const report = []

describe('QuestMan Golden Master — Berechnung aller Fragebögen', () => {
  test('es gibt Fragebögen zum Testen', () => {
    expect(ALL.length).toBeGreaterThan(0)
  })

  ALL.forEach((label) => {
    test(`summary results: ${label}`, () => {
      QUESTMAN.activeQuest = label
      expect(QUESTMAN.activeQuest).toBeDefined()
      fillActiveQuest()

      let results
      let threw = null
      try {
        results = QUESTMAN.summary.results
      } catch (e) {
        threw = e
      }

      if (threw) {
        report.push({ label, threw: threw.message, flags: [{ severity: 'error', code: 'THROW' }] })
        // Snapshot des Fehlers, damit der Charakterisierungslauf nicht abbricht.
        expect({ error: threw.message }).toMatchSnapshot()
        return
      }

      const flags = inspectResults(results)
      const method = (QUESTMAN.get(label).results || {}).method || null
      report.push({ label, method, flags })

      // Der eigentliche Golden Master: eingefrorene Resultate (datumsfrei).
      expect(results).toMatchSnapshot()
    })
  })

  afterAll(() => {
    const errors = report.filter((r) => r.flags.some((f) => f.severity === 'error'))
    const warns = report.filter((r) => r.flags.some((f) => f.severity === 'warn'))
    const summary = {
      total: ALL.length,
      with_errors: errors.length,
      with_warnings: warns.length,
      details: report
        .filter((r) => r.flags.some((f) => f.severity !== 'info'))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }

    const outPath = path.resolve(__dirname, '../golden_master_report.json')
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))

    // Kompakte Konsolenausgabe der Auffälligkeiten.
    /* eslint-disable no-console */
    console.log('\n===== GOLDEN MASTER — ANOMALIE-REPORT =====')
    console.log(`Fragebögen gesamt: ${summary.total} | mit ERROR: ${errors.length} | mit WARN: ${warns.length}`)
    summary.details.forEach((r) => {
      const codes = r.flags
        .filter((f) => f.severity !== 'info')
        .map((f) => `${f.code}${f.label ? `(${f.label})` : ''}${f.value !== undefined ? `=${f.value}` : ''}`)
        .join(', ')
      console.log(`  [${r.method || 'none'}] ${r.label}: ${codes}${r.threw ? ` -> ${r.threw}` : ''}`)
    })
    console.log(`\nReport geschrieben: ${outPath}`)
    console.log('===========================================\n')
    /* eslint-enable no-console */
  })
})
