// Run Test with:
// npm run test:unit test/jest/__tests__/visit_model.test.js
//
// Reine Logik des Visiten-Modells (kein Dexie/Vue).

import {
  createVisitSlot,
  createVisitFromTemplate,
  visitProgress,
  recomputeVisitStatus,
  applyDraftValues,
  itemValidity,
  requiredFieldStats,
} from '../../../src/tools/visits/visit-model'

describe('visit-model', () => {
  test('createVisitSlot erzeugt leeren Slot', () => {
    const slot = createVisitSlot('bdi2')
    expect(slot.short_title).toBe('bdi2')
    expect(slot.status).toBe('empty')
    expect(slot.draft).toBeNull()
    expect(slot.response).toBeNull()
  })

  test('createVisitFromTemplate übernimmt Fragebögen als Slots', () => {
    const tpl = { id: 't1', label: 'Aufnahme', questionnaires: ['bdi2', 'sf36'] }
    const visit = createVisitFromTemplate(tpl, 'p1', 1234)
    expect(visit.patientId).toBe('p1')
    expect(visit.templateId).toBe('t1')
    expect(visit.label).toBe('Aufnahme')
    expect(visit.date).toBe(1234)
    expect(visit.inOut).toBe('O')
    expect(visit.status).toBe('open')
    expect(visit.exportedAt).toBeNull()
    expect(visit.items.map((i) => i.short_title)).toEqual(['bdi2', 'sf36'])
    expect(visit.items.every((i) => i.status === 'empty')).toBe(true)
  })

  test('createVisitFromTemplate ohne Vorlage erzeugt leere Visite', () => {
    const visit = createVisitFromTemplate(null, 'p1', 1)
    expect(visit.templateId).toBeNull()
    expect(visit.items).toEqual([])
    expect(visit.label).toBe('Visite')
  })

  test('visitProgress zählt abgeschlossene Slots', () => {
    const visit = createVisitFromTemplate(
      { questionnaires: ['a', 'b', 'c'] },
      'p1',
      1
    )
    visit.items[0].status = 'completed'
    visit.items[1].status = 'draft'
    expect(visitProgress(visit)).toEqual({ completed: 1, total: 3 })
  })

  test('recomputeVisitStatus → completed wenn alle Slots fertig', () => {
    const visit = createVisitFromTemplate({ questionnaires: ['a', 'b'] }, 'p1', 1)
    visit.items[0].status = 'completed'
    recomputeVisitStatus(visit)
    expect(visit.status).toBe('open')
    visit.items[1].status = 'completed'
    recomputeVisitStatus(visit)
    expect(visit.status).toBe('completed')
  })

  test('recomputeVisitStatus → open bei leerer Visite', () => {
    const visit = createVisitFromTemplate(null, 'p1', 1)
    recomputeVisitStatus(visit)
    expect(visit.status).toBe('open')
  })

  test('applyDraftValues überlagert Werte indexgenau', () => {
    const items = [{ value: null }, { value: null }, { value: null }]
    applyDraftValues(items, [5, undefined, 'x'])
    expect(items[0].value).toBe(5)
    expect(items[1].value).toBeNull() // undefined überschreibt nicht
    expect(items[2].value).toBe('x')
  })

  test('applyDraftValues ist robust gegen ungleiche Längen', () => {
    const items = [{ value: null }]
    expect(() => applyDraftValues(items, [1, 2, 3])).not.toThrow()
    expect(items[0].value).toBe(1)
  })
})

describe('itemValidity', () => {
  test('beantwortetes Pflichtfeld → true, offenes → false', () => {
    expect(itemValidity({ type: 'radio', value: 1 })).toBe(true)
    expect(itemValidity({ type: 'radio', value: null })).toBe(false)
    expect(itemValidity({ type: 'text', value: undefined })).toBe(false)
  })

  test('force:false → immer true', () => {
    expect(itemValidity({ type: 'radio', force: false, value: null })).toBe(true)
  })

  test('nicht-interaktive Typen → null', () => {
    expect(itemValidity({ type: 'separator' })).toBeNull()
    expect(itemValidity({ type: 'seperator' })).toBeNull()
    expect(itemValidity({ type: 'textbox' })).toBeNull()
    expect(itemValidity({})).toBeNull() // type undefined
  })

  test('multiple_radio: alle Teilantworten nötig', () => {
    expect(itemValidity({ type: 'multiple_radio', value: [1, 2, 3] })).toBe(true)
    expect(itemValidity({ type: 'multiple_radio', value: [1, null, 3] })).toBe(false)
    expect(itemValidity({ type: 'multiple_radio', value: undefined })).toBe(false)
  })

  test('multiple_radio: leeres Array zählt NICHT als ausgefüllt (PDQ-8-Bug)', () => {
    expect(itemValidity({ type: 'multiple_radio', value: [] })).toBe(false)
    // mit bekannter Teilfragen-Anzahl: Länge muss passen
    const item = { type: 'multiple_radio', options: { questions: [{}, {}, {}] } }
    expect(itemValidity(item, [])).toBe(false)
    expect(itemValidity(item, [1, 2])).toBe(false) // unvollständig
    expect(itemValidity(item, [1, 2, 3])).toBe(true)
    expect(itemValidity(item, [1, null, 3])).toBe(false)
  })

  test('checkbox: leeres Array zählt NICHT als ausgefüllt', () => {
    expect(itemValidity({ type: 'checkbox', value: [] })).toBe(false)
    expect(itemValidity({ type: 'checkbox', value: ['a'] })).toBe(true)
    expect(itemValidity({ type: 'checkbox', value: null })).toBe(false)
    // optional bleibt true
    expect(itemValidity({ type: 'checkbox', force: false, value: [] })).toBe(true)
  })

  test('value-Override hat Vorrang vor item.value', () => {
    expect(itemValidity({ type: 'radio', value: null }, 5)).toBe(true)
    expect(itemValidity({ type: 'radio', value: 5 }, null)).toBe(false)
  })
})

describe('requiredFieldStats', () => {
  const items = [
    { type: 'separator' }, // null → zählt nicht
    { type: 'radio' }, // Pflicht
    { type: 'text', force: false }, // optional → zählt nicht
    { type: 'number' }, // Pflicht
  ]

  test('zählt nur interaktive Pflichtfelder', () => {
    expect(requiredFieldStats(items, [])).toEqual({ filled: 0, total: 2, percent: 0 })
  })

  test('teilweise gefüllt → anteiliger Prozentwert (gegen draft-values)', () => {
    // index 1 (radio) gefüllt, index 3 (number) offen
    const values = [undefined, 'a', undefined, undefined]
    expect(requiredFieldStats(items, values)).toEqual({ filled: 1, total: 2, percent: 50 })
  })

  test('alle Pflichtfelder gefüllt → 100', () => {
    const values = [undefined, 'a', undefined, 7]
    expect(requiredFieldStats(items, values)).toEqual({ filled: 2, total: 2, percent: 100 })
  })

  test('ohne Pflichtfelder → 100', () => {
    const onlyOptional = [{ type: 'separator' }, { type: 'text', force: false }]
    expect(requiredFieldStats(onlyOptional, []).percent).toBe(100)
  })
})
