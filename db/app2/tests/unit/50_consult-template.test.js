/**
 * Consultation template helpers — shared/utils/consult-template.js
 */
import { describe, it, expect } from 'vitest'
import { normalizeConsultTemplate, resolveTodayVisit, findLastVisit, daysBetween, checklistState, suggestNextTemplate, DEFAULT_TEXT_CONCEPTS } from '../../src/shared/utils/consult-template.js'

describe('normalizeConsultTemplate', () => {
  it('fills defaults and derives LEDD as a computed score', () => {
    const t = normalizeConsultTemplate({ label: 'PD', visitType: 'parkinson_verlauf', scoreConcepts: ['SCTID: 716138005', { code: 'NEURO:SCORE:LEDD', short: 'LEDD' }] }, 'consult_pd_verlauf')
    expect(t.code).toBe('consult_pd_verlauf')
    expect(t.scoreConcepts[0]).toMatchObject({ code: 'SCTID: 716138005', higherIsWorse: true, derived: null })
    expect(t.scoreConcepts[1]).toMatchObject({ code: 'NEURO:SCORE:LEDD', derived: 'ledd', short: 'LEDD' })
    expect(t.textConcepts).toHaveLength(DEFAULT_TEXT_CONCEPTS.length)
    expect(t.medication).toMatchObject({ show: true, ledd: true, carryForward: true, showDiff: true })
    expect(t.letterSections[0]).toBe('diagnoses')
    expect(t.letterSections).toContain('text:LID: 51848-0')
    expect(t.previousVisitScope).toBe('any')
    expect(normalizeConsultTemplate(null).visitType).toBe('consultation')
  })
})

describe('resolveTodayVisit', () => {
  const tpl = { code: 'consult_pd_verlauf', visitType: 'parkinson_verlauf' }
  const mk = (id, date, blob) => ({ id, date, rawData: { VISIT_BLOB: JSON.stringify(blob) } })

  it('picks today + same template first', () => {
    const visits = [mk(1, '2026-09-15', { visitType: 'parkinson_verlauf', consultTemplate: 'consult_pd_verlauf' }), mk(2, '2026-09-14', { consultTemplate: 'consult_pd_verlauf' })]
    expect(resolveTodayVisit(visits, tpl, '2026-09-15')).toMatchObject({ match: 'template', visit: { id: 1 } })
  })

  it('other template today → other-template; typed visit → visit-type; none → none', () => {
    const other = [mk(3, '2026-09-15T10:30', { visitType: 'ths_verlauf', consultTemplate: 'consult_ths_verlauf' })]
    expect(resolveTodayVisit(other, tpl, '2026-09-15')).toMatchObject({ match: 'other-template', templateCode: 'consult_ths_verlauf' })
    const typed = [mk(4, '2026-09-15', { visitType: 'parkinson_verlauf' })]
    expect(resolveTodayVisit(typed, tpl, '2026-09-15')).toMatchObject({ match: 'visit-type', visit: { id: 4 } })
    expect(resolveTodayVisit([mk(5, '2026-09-14', { consultTemplate: 'consult_pd_verlauf' })], tpl, '2026-09-15')).toEqual({ visit: null, match: 'none', templateCode: null })
  })

  it('handles transformed visits carrying visitType directly and ISO timestamps', () => {
    const visits = [{ id: 9, date: '2026-09-15T08:00:00.000Z', visitType: 'parkinson_verlauf', rawData: { VISIT_BLOB: '{"visitType":"parkinson_verlauf","consultTemplate":"consult_pd_verlauf"}' } }]
    expect(resolveTodayVisit(visits, tpl, '2026-09-15').match).toBe('template')
  })
})

describe('findLastVisit / daysBetween', () => {
  const visits = [
    { id: 1, date: '2025-03-01', rawData: { VISIT_BLOB: '{}' } },
    { id: 2, date: '2026-03-12', rawData: { VISIT_BLOB: '{"consultTemplate":"consult_pd_verlauf"}' } },
    { id: 3, date: '2026-09-15', rawData: { VISIT_BLOB: '{"consultTemplate":"consult_pd_verlauf"}' } },
    { id: 4, date: '2026-09-15', rawData: { VISIT_BLOB: '{}' } },
  ]
  it('newest strictly before the reference', () => {
    // reference given as a visit object: same-day siblings other than itself count
    expect(findLastVisit(visits, visits[2]).id).toBe(4)
    // reference given as a date string: strictly before that date
    expect(findLastVisit(visits, '2026-09-15').id).toBe(2)
    expect(findLastVisit(visits, '2026-09-15', 'consult').id).toBe(2)
    expect(findLastVisit(visits, '2025-03-01')).toBeNull()
    expect(daysBetween('2026-03-12', '2026-09-15')).toBe(187)
    expect(daysBetween(null)).toBeNull()
  })
})

describe('checklistState', () => {
  it('counts concepts with values and filled questionnaires', () => {
    const tpl = { checklist: ['SCTID: 716138005', 'LID: 51848-0', 'UPDRS_3'] }
    const obs = [
      { conceptCode: 'SCTID: 716138005', valueType: 'N', displayValue: '2.5' },
      { conceptCode: 'LID: 51848-0', valueType: 'T', displayValue: '' },
      { conceptCode: 'CUSTOM: QUESTIONNAIRE', valueType: 'Q', rawData: { OBSERVATION_BLOB: '{"questionnaire_code":"UPDRS_3","results":[{"value":31}]}' } },
    ]
    const s = checklistState(tpl, obs)
    expect(s.total).toBe(3)
    expect(s.done).toBe(2)
    expect(s.items.find((i) => i.code === 'LID: 51848-0').done).toBe(false)
    expect(s.items.find((i) => i.code === 'UPDRS_3')).toMatchObject({ questionnaire: true, done: true })
  })
})

describe('suggestNextTemplate', () => {
  const templates = [
    { code: 'consult_pd_erst', visitType: 'parkinson_erst', followUpTemplate: 'consult_pd_verlauf' },
    { code: 'consult_pd_verlauf', visitType: 'parkinson_verlauf' },
    { code: 'consult_sonstiges', visitType: 'neuro_sonstiges' },
  ]
  it('follows followUpTemplate, else repeats, else first', () => {
    expect(suggestNextTemplate(templates, { rawData: { VISIT_BLOB: '{"consultTemplate":"consult_pd_erst"}' } }).code).toBe('consult_pd_verlauf')
    expect(suggestNextTemplate(templates, { rawData: { VISIT_BLOB: '{"consultTemplate":"consult_pd_verlauf"}' } }).code).toBe('consult_pd_verlauf')
    expect(suggestNextTemplate(templates, { visitType: 'parkinson_erst', rawData: { VISIT_BLOB: '{"visitType":"parkinson_erst"}' } }).code).toBe('consult_pd_verlauf')
    // no match → the generic template (isDefault / "sonstiges"), never an arbitrary first entry
    expect(suggestNextTemplate(templates, null).code).toBe('consult_sonstiges')
    expect(suggestNextTemplate(templates, { rawData: { VISIT_BLOB: '{"visitType":"routine"}' } }).code).toBe('consult_sonstiges')
  })
})
