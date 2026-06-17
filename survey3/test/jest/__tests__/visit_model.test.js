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
