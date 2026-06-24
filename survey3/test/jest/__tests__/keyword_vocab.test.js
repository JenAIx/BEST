// Lint-Guard: jeder gebündelte Fragebogen trägt nicht-leere Schlüsselworte,
// die ausschließlich aus dem kontrollierten Vokabular (keywords.js) stammen.
// Hält die Suche/Filterung in /select konsistent und verhindert Wildwuchs.
//
// Run: npm run test:unit test/jest/__tests__/keyword_vocab.test.js

import { QUESTMAN } from '../../../src/tools/questman'
import { KEYWORD_VOCAB_SET } from '../../../src/tools/questman/keywords'

describe('Keyword-Vokabular (alle Fragebögen)', () => {
  const labels = QUESTMAN.quest_list.slice().sort()

  test('kein Bogen ohne Schlüsselworte', () => {
    const empty = labels.filter((l) => {
      const kw = QUESTMAN.get(l).keywords
      return !kw || kw.split(',').map((k) => k.trim()).filter(Boolean).length === 0
    })
    expect(empty).toEqual([])
  })

  test('alle Schlüsselworte stammen aus dem Vokabular', () => {
    const offenders = []
    labels.forEach((l) => {
      const kw = QUESTMAN.get(l).keywords || ''
      kw.split(',').map((k) => k.trim()).filter(Boolean).forEach((k) => {
        if (!KEYWORD_VOCAB_SET.has(k)) offenders.push(`${l}: "${k}"`)
      })
    })
    expect(offenders).toEqual([])
  })
})
