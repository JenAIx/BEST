/**
 * @vitest-environment jsdom
 *
 * CompletedQuestionnaireView mit einem importierten surveyBEST-Hybridbogen
 * (echte Exportdatei tests/input/test_import/05_survey3_hybrid_visit.json):
 * Tageskurve lesbar, Muster gelistet, Bewertung mit Ampel sichtbar,
 * nirgends "[object Object]".
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { mount } from '@vue/test-utils'

const { default: CompletedQuestionnaireView } = await import('src/components/questionnaire/CompletedQuestionnaireView.vue')

const file = path.join(process.cwd(), 'tests', 'input', 'test_import', '05_survey3_hybrid_visit.json')
const obs = JSON.parse(fs.readFileSync(file, 'utf-8')).data.observations.filter((o) => o.VALTYPE_CD === 'Q')
const blob = (i) => JSON.parse(obs[i].OBSERVATION_BLOB)
const stubs = { 'q-icon': true, 'q-chip': { template: '<span><slot /></span>' }, 'q-avatar': { template: '<span><slot /></span>' } }

describe('CompletedQuestionnaireView – Hybridbogen aus surveyBEST', () => {
  const w = mount(CompletedQuestionnaireView, { props: { results: blob(0) }, global: { stubs } })
  const text = w.text()

  it('zeigt die Tageskurve als Kennzahlen-Zeile mit Mustern', () => {
    expect(text).toContain('Tageskurve: OFF 12 h')
    expect(text).toContain('Tabletten 07:00, 10:30, 14:00, 17:30, 21:00')
    expect(text).toContain('Verzögertes ON: nach der Tablette um 14:00 erst nach ~90 min gut beweglich')
  })

  it('zeigt die Bewertung mit Ampel', () => {
    const ev = w.find('[data-cy="questionnaire-evaluation"]')
    expect(ev.exists()).toBe(true)
    expect(ev.text()).toContain('⚠ Motorik / Wirkschwankungen: auffällig')
    expect(ev.text()).toContain('◐ Schlaf (PDSS-2): grenzwertig')
    expect(w.findAll('.ev-warn').length).toBe(2)
  })

  it('nirgends "[object Object]"', () => {
    expect(text).not.toContain('[object Object]')
  })

  it('abgeleiteter NMSQuest zeigt Score und 30 Antworten, ohne Bewertungsblock', () => {
    const n = mount(CompletedQuestionnaireView, { props: { results: blob(1) }, global: { stubs } })
    expect(n.findAll('.response-value').length).toBe(30)
    expect(n.find('[data-cy="questionnaire-evaluation"]').exists()).toBe(false)
  })
})
