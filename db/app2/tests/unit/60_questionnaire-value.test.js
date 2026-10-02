// Anzeige von surveyBEST-Antworten (Objekte, Listen, Bewertung)
import { describe, it, expect } from 'vitest'
import { formatQuestionnaireValue, dayCurvePatterns, evaluationLines, blobEvaluationLines } from '../../src/shared/utils/questionnaire-value.js'

const curve = {
  kind: 'day_curve',
  values: Array(49).fill(50),
  pills: ['07:00', '14:00'],
  symptoms: [{ key: 'pain', label: 'Schmerzen' }],
  summary: { off_h: 5.5, on_h: 16, dys_h: 2.5, switches_to_off: 4, symptoms: { pain: { hours: 2 } } },
  patterns: [{ code: 'delayed_on', text: 'Verzögertes ON: nach der Tablette um 14:00 erst nach ~90 min gut beweglich' }],
}

describe('formatQuestionnaireValue', () => {
  it('Tageskurve als Kennzahlen-Zeile statt "[object Object]"', () => {
    const t = formatQuestionnaireValue(curve)
    expect(t).toBe('Tageskurve: OFF 5,5 h · gut beweglich 16 h · Überbewegungen 2,5 h · 4× Wechsel in OFF · Schmerzen 2 h · Tabletten 07:00, 14:00')
  })
  it('Skalare, Listen, leere Werte wie bisher; andere Objekte als JSON', () => {
    expect(formatQuestionnaireValue(3)).toBe('3')
    expect(formatQuestionnaireValue(['a', 'b'])).toBe('a, b')
    expect(formatQuestionnaireValue(null)).toBe('No response')
    expect(formatQuestionnaireValue(true)).toBe('Yes')
    expect(formatQuestionnaireValue({ a: 1 })).toBe('{"a":1}')
  })
  it('Muster der Kurve', () => {
    expect(dayCurvePatterns(curve)).toEqual(['Verzögertes ON: nach der Tablette um 14:00 erst nach ~90 min gut beweglich'])
    expect(dayCurvePatterns('x')).toEqual([])
  })
})

describe('Bewertung', () => {
  const html = '<div><b style="color:#c62828">⚠ Motorik: auffällig</b><ul><li>OFF 5,5 h</li><li>Wearing-off &amp; Morgen-OFF</li></ul></div><div><b>✓ Schlaf: unauffällig</b></div><script>alert(1)</script>'
  it('HTML wird zu Textzeilen, Tags fallen weg', () => {
    expect(evaluationLines(html)).toEqual(['⚠ Motorik: auffällig', '• OFF 5,5 h', '• Wearing-off & Morgen-OFF', '✓ Schlaf: unauffällig', 'alert(1)'])
    expect(evaluationLines(null)).toEqual([])
  })
  it('aus results[].evaluation, sonst blob.evaluation', () => {
    expect(blobEvaluationLines({ results: [{ value: 2, evaluation: '<b>⚠ A</b>' }] })).toEqual(['⚠ A'])
    expect(blobEvaluationLines({ results: [{ value: 2 }], evaluation: '<div>✓ B</div>' })).toEqual(['✓ B'])
  })
})
