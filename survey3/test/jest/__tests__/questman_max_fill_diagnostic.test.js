// MAX-SCORE-DIAGNOSELAUF (kein Golden Master / kein Snapshot)
//
// Ergänzung zu questman_golden_master.test.js: dort wird mit der "letzten
// Option" befüllt, was bei vielen Skalen zufällig den 0-Wert trifft und so
// falsch-positive Nuller erzeugt. Hier befüllen wir stattdessen jedes Item mit
// der HÖCHSTWERTENDEN Antwort — pro Item abgeleitet aus dem scoring-Block über
// die echte getScore()-Logik. Ein danach noch verbleibender 0/NaN/null-Score
// ist damit ein ECHTER Verdacht (nicht implementierte Methode, kaputte
// Referenz, Mapping-Lücke), kein Befüll-Artefakt.
//
// Output: test/jest/max_fill_report.json + Konsole. Der Test selbst assertet
// nur, dass nichts wirft — die Bewertung der Verdachtsfälle ist manuell.
//
// Run: npm run test:unit test/jest/__tests__/questman_max_fill_diagnostic.test.js

import fs from 'fs'
import path from 'path'
import { QUESTMAN } from '../../../src/tools/questman'
import { getScore } from '../../../src/tools/questman/scoring'

// --- Helfer zur Auswahl des "besten" (höchstwertenden) Wertes ---------------

function entryForId(scoring, id) {
  return (scoring || []).find((s) => Array.isArray(s.id) && s.id.includes(id))
}

// Höchste numerische Option (für sum/avg, wo der Wert direkt zählt).
function maxNumeric(cands) {
  let best = cands[0]
  let bs = -Infinity
  cands.forEach((v) => {
    const n = typeof v === 'number' ? v : parseFloat(v)
    if (!Number.isNaN(n) && n > bs) {
      bs = n
      best = v
    }
  })
  return best
}

// Option, die unter dem ids-scoring den höchsten Item-Score liefert.
function bestByScore(scoring, id, cands) {
  if (!scoring) return maxNumeric(cands)
  let best = cands[0]
  let bs = -Infinity
  cands.forEach((v) => {
    const s = getScore(scoring, { id, value: v })
    const n = typeof s === 'number' && !Number.isNaN(s) ? s : 0
    if (n > bs) {
      bs = n
      best = v
    }
  })
  return best
}

// Option, die unter count_targets die höchste Punktsumme bringt.
function bestByTarget(targets, cands) {
  let best = cands[0]
  let bs = -Infinity
  cands.forEach((v) => {
    let s = 0
    ;(targets || []).forEach((t) => {
      if (t.value === v) s += t.score
    })
    if (s > bs) {
      bs = s
      best = v
    }
  })
  return best
}

// Für number-Items unter ids: aus der range-Map die höchstwertende Bande
// wählen und einen Wert daraus zurückgeben; sonst ein positiver Default.
function numberForEntry(entry) {
  if (entry && entry.method === 'range' && Array.isArray(entry.range)) {
    let best = null
    let bs = -Infinity
    entry.range.forEach((b) => {
      if (typeof b.score === 'number' && b.score > bs) {
        bs = b.score
        best = b
      }
    })
    if (best && Array.isArray(best.value)) {
      const lo = best.value[0]
      const hi = best.value[1]
      return Number.isFinite(hi) && hi < 1e6 ? (lo + hi) / 2 : lo + 1
    }
  }
  return 10
}

function maxFill(label) {
  const q = QUESTMAN.get(label)
  const r = q.results || {}
  const method = r.method
  const scoring = r.scoring
  const items = QUESTMAN.activeQuest.value.items

  items.forEach((item) => {
    switch (item.type) {
      case 'radio': {
        const cands = (item.options || []).map((o) => o.value)
        if (!cands.length) break
        if (method === 'ids') item.value = bestByScore(scoring, item.id, cands)
        else if (method === 'count_targets') item.value = bestByTarget(r.targets, cands)
        else item.value = maxNumeric(cands)
        break
      }
      case 'checkbox': {
        // alle Optionen ankreuzen -> maximiert count- und Array-Scoring
        item.value = (item.options || []).map((o) => o.value)
        break
      }
      case 'multiple_radio': {
        const answers = ((item.options && item.options.answers) || []).map((a) => a.value)
        const questions = (item.options && item.options.questions) || []
        if (!answers.length) {
          item.value = questions.map(() => null)
          break
        }
        item.value = questions.map((sub) =>
          method === 'ids' ? bestByScore(scoring, sub.id, answers) : maxNumeric(answers)
        )
        break
      }
      case 'number':
        item.value = method === 'ids' ? numberForEntry(entryForId(scoring, item.id)) : 10
        break
      case 'slider':
        item.value = typeof item.max === 'number' ? item.max : 10
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
        break
    }
  })
}

function inspect(results) {
  const flags = []
  if (!Array.isArray(results)) return flags // method-lose Bögen
  results.forEach((r) => {
    const v = r.value
    if (v === null || v === undefined) flags.push({ code: 'NULL', label: r.label })
    else if (typeof v === 'number' && Number.isNaN(v)) flags.push({ code: 'NAN', label: r.label })
    else if (typeof v === 'string') flags.push({ code: 'STRING', label: r.label, value: v })
    else if (v === 0) flags.push({ code: 'ZERO', label: r.label })
  })
  return flags
}

const ALL = QUESTMAN.quest_list.slice().sort()

// Nuller aus dem "letzte-Option"-Lauf zum Vergleich laden (falls vorhanden).
let goldenZeros = new Set()
try {
  const g = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../golden_master_report.json'), 'utf8')
  )
  g.details.forEach((d) => {
    if (d.flags.some((f) => f.code === 'ZERO_VALUE')) goldenZeros.add(d.label)
  })
} catch (e) {
  /* report evtl. noch nicht erzeugt */
}

const report = []

describe('QuestMan Max-Score-Diagnose', () => {
  test('liefert Fragebögen', () => {
    expect(ALL.length).toBeGreaterThan(0)
  })

  ALL.forEach((label) => {
    test(`max-fill: ${label}`, () => {
      QUESTMAN.activeQuest = label
      expect(QUESTMAN.activeQuest).toBeDefined()
      maxFill(label)
      const results = QUESTMAN.summary.results // darf nicht werfen
      const method = (QUESTMAN.get(label).results || {}).method || null
      report.push({ label, method, results, flags: inspect(results) })
    })
  })

  afterAll(() => {
    // Echte Verdachtsfälle: nach Max-Befüllung immer noch problematisch.
    const suspects = report.filter((r) => r.flags.length > 0)
    // Bestätigte Artefakte: im letzte-Option-Lauf 0, jetzt sauber.
    const confirmedArtifacts = report
      .filter((r) => goldenZeros.has(r.label) && !r.flags.some((f) => f.code === 'ZERO'))
      .map((r) => r.label)

    const out = {
      total: ALL.length,
      suspects: suspects
        .map((r) => ({
          label: r.label,
          method: r.method,
          flags: r.flags,
          results: r.results,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      confirmed_artifacts: confirmedArtifacts.sort(),
    }
    const outPath = path.resolve(__dirname, '../max_fill_report.json')
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2))

    /* eslint-disable no-console */
    console.log('\n===== MAX-SCORE-DIAGNOSE =====')
    console.log(
      `gesamt: ${out.total} | echte Verdachtsfälle: ${suspects.length} | bestätigte Artefakte (0 nur bei letzte-Option): ${confirmedArtifacts.length}`
    )
    console.log('\n--- ECHTE VERDACHTSFÄLLE (auch bei Max-Befüllung auffällig) ---')
    out.suspects.forEach((r) => {
      const codes = r.flags
        .map((f) => `${f.code}(${f.label})${f.value !== undefined ? '=' + f.value : ''}`)
        .join(', ')
      console.log(`  [${r.method}] ${r.label}: ${codes}`)
    })
    console.log('\n--- BESTÄTIGTE ARTEFAKTE (im letzte-Option-Lauf fälschlich 0) ---')
    console.log('  ' + (out.confirmed_artifacts.join(', ') || '(keine)'))
    console.log(`\nReport: ${outPath}`)
    console.log('==============================\n')
    /* eslint-enable no-console */
  })
})
