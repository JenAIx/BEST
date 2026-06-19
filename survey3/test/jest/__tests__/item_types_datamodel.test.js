// Datenmodell-Kontrakt je Item-Typ: UI-Wert → summary.items → scoring,
// Validierung (itemValidity / isAnswered) und Persistenz-Round-Trip
// (applyDraftValues). Sichert die Wert-FORM jedes Typs ab — Grundlage der
// Datenvalidität. Ergänzt die E2E-Abdeckung (item_types_coverage.spec.js),
// die den UI→Store-Pfad im echten Browser prüft.

import { buildResultItems } from '../../../src/tools/questman/result-items'
import { itemValidity, isAnswered, applyDraftValues } from '../../../src/tools/visits/visit-model'
import { calc_simple_sum } from '../../../src/tools/questman/scoring/sum'
import { calc_simple_avg } from '../../../src/tools/questman/scoring/avg'

describe('buildResultItems – Wert-Form je Item-Typ', () => {
  test('radio: Skalar (Zahl) wird unverändert übernommen', () => {
    const out = buildResultItems([{ type: 'radio', tag: 'r', value: 2 }])
    expect(out).toEqual([{ label: 'r', value: 2, coding: undefined }])
  })

  test('radio: String-Wert (z. B. "Male"/"kA") bleibt String', () => {
    const out = buildResultItems([{ type: 'radio', tag: 'sex', value: 'Male' }])
    expect(out[0].value).toBe('Male')
  })

  test('slider: Zahl bleibt Zahl', () => {
    const out = buildResultItems([{ type: 'slider', tag: 's', value: 50 }])
    expect(out[0].value).toBe(50)
  })

  test('text: String bleibt String (wird nicht in Zahl konvertiert)', () => {
    const out = buildResultItems([{ type: 'text', tag: 't', value: '123' }])
    expect(out[0].value).toBe('123')
  })

  test('date/date_year/time: Strings bleiben unverändert', () => {
    const out = buildResultItems([
      { type: 'date', tag: 'd', value: '01.12.1970' },
      { type: 'date_year', tag: 'y', value: '1970' },
      { type: 'time', tag: 'tm', value: '14:30' },
    ])
    expect(out.map((o) => o.value)).toEqual(['01.12.1970', '1970', '14:30'])
  })

  test('number: numerischer String wird zu Zahl normalisiert', () => {
    const out = buildResultItems([{ type: 'number', tag: 'n', value: '42' }])
    expect(out[0].value).toBe(42)
    expect(typeof out[0].value).toBe('number')
  })

  test('number: nicht-parsebarer String (NaN) wird verworfen', () => {
    const out = buildResultItems([{ type: 'number', tag: 'n', value: 'abc' }])
    expect(out).toEqual([])
  })

  test('checkbox: Array bleibt als Array erhalten (kein Flatten)', () => {
    const out = buildResultItems([{ type: 'checkbox', tag: 'c', value: [1, 3] }])
    expect(out).toHaveLength(1)
    expect(out[0].value).toEqual([1, 3])
  })

  test('multiple_radio: expandiert zu einem Eintrag je Teilfrage (id/coding von Sub)', () => {
    const item = {
      type: 'multiple_radio',
      tag: 'blk',
      value: [0, 2],
      options: {
        answers: [{ value: 0 }, { value: 1 }, { value: 2 }],
        questions: [
          { tag: 'a', id: 11, coding: { display: 'Frage A' } },
          { tag: 'b', id: 12 },
        ],
      },
    }
    const out = buildResultItems([item])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ label: 'Frage A', value: 0, id: 11 }) // coding.display überschreibt label
    expect(out[1]).toMatchObject({ label: 'blk_b', value: 2, id: 12 })
  })

  test('null/undefined Werte werden übersprungen', () => {
    const out = buildResultItems([
      { type: 'radio', tag: 'a', value: null },
      { type: 'text', tag: 'b', value: undefined },
      { type: 'radio', tag: 'c', value: 0 }, // 0 ist gültig!
    ])
    expect(out.map((o) => o.label)).toEqual(['c'])
    expect(out[0].value).toBe(0)
  })

  test('nicht-interaktive Typen ohne value bleiben ausgespart', () => {
    const out = buildResultItems([
      { type: 'separator' },
      { type: 'textbox', value: undefined },
      { type: 'image', value: ['x.png'] }, // image hat value → wird übernommen
    ])
    expect(out).toHaveLength(1)
    expect(out[0].value).toEqual(['x.png'])
  })
})

describe('itemValidity – Pflichtprüfung je Typ (bestehender Kontrakt)', () => {
  test('Skalar-Typen: vorhanden → true, leer → false', () => {
    for (const t of ['radio', 'slider', 'number', 'text', 'date', 'date_year', 'time']) {
      expect(itemValidity({ type: t, value: 1 })).toBe(true)
      expect(itemValidity({ type: t, value: null })).toBe(false)
    }
  })
  test('checkbox: leeres Array = offen', () => {
    expect(itemValidity({ type: 'checkbox', value: [] })).toBe(false)
    expect(itemValidity({ type: 'checkbox', value: [1] })).toBe(true)
  })
  test('multiple_radio: vollständig nötig', () => {
    const item = { type: 'multiple_radio', options: { questions: [{}, {}, {}] } }
    expect(itemValidity(item, [1, 2, 3])).toBe(true)
    expect(itemValidity(item, [1, null, 3])).toBe(false)
    expect(itemValidity(item, [1, 2])).toBe(false)
    expect(itemValidity(item, [])).toBe(false)
  })
  test('force:false → immer true; nicht-interaktiv → null', () => {
    expect(itemValidity({ type: 'radio', force: false, value: null })).toBe(true)
    expect(itemValidity({ type: 'separator' })).toBeNull()
    expect(itemValidity({ type: 'textbox' })).toBeNull()
  })
})

describe('isAnswered – reiner Wert-Check (geteilte Wahrheit mit itemValidity)', () => {
  test('ignoriert force (Pflicht-Logik) – im Gegensatz zu itemValidity', () => {
    const optionalEmpty = { type: 'radio', force: false, value: null }
    expect(isAnswered(optionalEmpty, optionalEmpty.value)).toBe(false) // leer = nicht beantwortet
    expect(itemValidity(optionalEmpty)).toBe(true) // optional = valide
  })
  test('deckt sich mit itemValidity für gesetzte Pflichtwerte', () => {
    const mr = { type: 'multiple_radio', options: { questions: [{}, {}] } }
    expect(isAnswered(mr, [1, 2])).toBe(true)
    expect(isAnswered(mr, [1, null])).toBe(false)
    expect(isAnswered({ type: 'checkbox' }, [])).toBe(false)
    expect(isAnswered({ type: 'radio' }, 0)).toBe(true) // 0 ist beantwortet
  })
  test('multiple_radio ohne questions-Metadaten: alle gelieferten Werte zählen', () => {
    expect(isAnswered({ type: 'multiple_radio' }, [1, 2, 3])).toBe(true)
    expect(isAnswered({ type: 'multiple_radio' }, [])).toBe(false)
  })
})

describe('applyDraftValues – Round-Trip je Typ', () => {
  test('überträgt rohe Werte indexgenau zurück auf die items', () => {
    const items = [
      { type: 'radio' },
      { type: 'checkbox' },
      { type: 'multiple_radio' },
      { type: 'number' },
      { type: 'date' },
    ]
    const values = [3, [1, 2], [0, 1, 2], 7, '01.12.1970']
    applyDraftValues(items, values)
    expect(items.map((i) => i.value)).toEqual([3, [1, 2], [0, 1, 2], 7, '01.12.1970'])
  })
  test('undefined überschreibt einen vorhandenen Wert NICHT', () => {
    const items = [{ type: 'radio', value: 5 }]
    applyDraftValues(items, [undefined])
    expect(items[0].value).toBe(5)
  })
})

describe('scoring – Typ-Robustheit', () => {
  test('sum: ignoriert Nicht-Zahlen (text/date), summiert Zahlen + Array-Elemente', () => {
    const items = [
      { value: 3 },
      { value: '01.12.1970' }, // date-String → ignoriert
      { value: 'foo' }, // text → ignoriert
      { value: [1, 2, 'x'] }, // checkbox: nur Zahlen
    ]
    expect(calc_simple_sum(items, {})[0].value).toBe(6)
  })
  test('avg: nur numerische Werte gehen in Summe UND Zähler', () => {
    const items = [{ value: 4 }, { value: 'text' }, { value: 2 }]
    expect(calc_simple_avg(items, {})[0].value).toBe(3) // (4+2)/2
  })
  test('ignore_for_result wird im Scoring übersprungen', () => {
    const items = [{ value: 10, ignore_for_result: true }, { value: 5 }]
    expect(calc_simple_sum(items, {})[0].value).toBe(5)
  })
})
