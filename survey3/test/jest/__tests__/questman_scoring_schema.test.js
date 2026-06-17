// SCHEMA-GUARD: validiert die Scoring-Definition ALLER gebündelten Fragebögen.
//
// Fängt künftig die Bug-Klassen ab, die wir manuell aufgedeckt haben:
// fehlende Item-IDs, unaufgelöste/forward Label-Referenzen, value/score-Längen,
// Leerzeichen-/Doppel-Labels, unbekannte Methoden, string-numerische Werte.
//
// KNOWN_PENDING listet noch offene Alt-Befunde, die bewusst (noch) nicht
// gefixt sind — die Liste schrumpft mit der Konsolidierung auf 0.
//
// Run: npm run test:unit test/jest/__tests__/questman_scoring_schema.test.js

import fs from 'fs'
import path from 'path'
import { QUESTMAN } from '../../../src/tools/questman'
import { validateQuestScoring } from '../../../src/tools/questman/validate'

// Bögen mit bekannten, noch nicht behobenen Befunden (label -> Grund).
// Leer: alle aufgedeckten Alt-Befunde sind behoben, der Guard ist scharf.
const KNOWN_PENDING = {}

describe('Scoring-Schema-Guard (alle Fragebögen)', () => {
  const labels = QUESTMAN.quest_list.slice().sort()
  const report = []

  labels.forEach((label) => {
    const quest = QUESTMAN.get(label)
    const { errors, warnings } = validateQuestScoring(quest)
    if (errors.length || warnings.length) report.push({ label, errors, warnings })
  })

  it('keine NEUEN Schema-Fehler (außerhalb KNOWN_PENDING)', () => {
    const unexpected = report
      .filter((r) => r.errors.length > 0)
      .filter((r) => !(r.label in KNOWN_PENDING))
    if (unexpected.length) {
      /* eslint-disable no-console */
      console.error('\nUNERWARTETE SCHEMA-FEHLER:')
      unexpected.forEach((r) =>
        r.errors.forEach((e) => console.error(`  [${r.label}] ${e.code}: ${e.msg}`))
      )
      /* eslint-enable no-console */
    }
    expect(unexpected.map((r) => r.label)).toEqual([])
  })

  it('schreibt vollständigen Validierungs-Report', () => {
    const out = {
      total: labels.length,
      flagged: report.length,
      known_pending: Object.keys(KNOWN_PENDING),
      details: report.sort((a, b) => a.label.localeCompare(b.label)),
    }
    fs.writeFileSync(path.resolve(__dirname, '../scoring_schema_report.json'), JSON.stringify(out, null, 2))
    expect(out.total).toBeGreaterThan(0)
  })
})
