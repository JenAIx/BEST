// Tageskurve (day_curve): Konfiguration, Auswertung, Muster, Zeichnung, Datenfluss.
// Run: npx jest test/jest/__tests__/daycurve.test.js
import {
  dcConfig, emptyCurve, isDayCurveValue, indexOf, timeAt, curveSummary, curvePatterns,
  finalizeCurve, summaryText, dayCurveResultItems, dcLayout, dcHit, dayCurveSvg,
} from 'src/tools/daycurve'
import { isAnswered, itemValidity } from 'src/tools/visits/visit-model'
import { validateQuestScoring, ITEM_TYPES } from 'src/tools/questman/validate'
import { buildResultItems } from 'src/tools/questman/result-items'
import { buildQuestPdfHtml } from 'src/tools/quest-pdf'

const cfg = dcConfig({ curve: { symptoms: [{ key: 'pain', label: 'Schmerzen' }] } })

// Hilfen: Wert in [von, bis) Stützstellen setzen, Uhrzeit → Index
const fill = (v, from, to, x) => { for (let i = from; i < to; i++) v.values[i] = x }
const at = (v, t) => indexOf(v, t)

function wearingOffDay() {
  const v = emptyCurve(cfg)
  fill(v, 0, at(v, '07:30'), 20)          // Morgen-OFF bis kurz nach der ersten Tablette
  fill(v, at(v, '07:30'), at(v, '10:00'), 55)
  fill(v, at(v, '10:00'), at(v, '10:30'), 20) // Wearing-off vor 10:30
  fill(v, at(v, '10:30'), at(v, '14:00'), 55)
  fill(v, at(v, '14:00'), at(v, '15:30'), 20) // nach 14:00 erst nach 90 min ON
  fill(v, at(v, '15:30'), v.values.length, 55)
  v.pills = ['07:00', '10:30', '14:00']
  v.meals = ['13:00']
  v.symptoms[0].times = ['14:00', '14:30', '15:00'] // Schmerzen nur im OFF
  return v
}

describe('Konfiguration und Leerwert', () => {
  test('Standard: 06:00, 30 min, 24 h → 49 Stützstellen, gerade Linie im grünen Bereich', () => {
    const c = dcConfig({})
    expect(c.n).toBe(49)
    const v = emptyCurve(c)
    expect(v.values).toHaveLength(49)
    expect(new Set(v.values)).toEqual(new Set([50]))
    expect(v.symptoms.map((s) => s.key)).toEqual(['pain', 'hallucinations', 'anxiety', 'sleepiness'])
    expect(isDayCurveValue(v)).toBe(true)
  })
  test('Uhrzeiten über Mitternacht', () => {
    const v = emptyCurve(dcConfig({}))
    expect(timeAt(v, 0)).toBe('06:00')
    expect(timeAt(v, 36)).toBe('00:00')
    expect(indexOf(v, '00:00')).toBe(36)
    expect(indexOf(v, '05:30')).toBe(47)
  })
  test('ungültige Konfiguration fällt auf Standard zurück', () => {
    const c = dcConfig({ curve: { start: 'x', step_min: -5, markers: ['pill', 'unbekannt'] } })
    expect(c.start).toBe('06:00')
    expect(c.step_min).toBe(30)
    expect(c.markers).toEqual(['pill'])
  })
})

describe('Auswertung', () => {
  test('gerade Linie: 24 h gut beweglich, keine Muster', () => {
    const v = emptyCurve(cfg)
    const s = curveSummary(v)
    expect(s).toMatchObject({ off_h: 0, on_h: 24, dys_h: 0, switches_to_off: 0 })
    expect(curvePatterns(v)).toEqual([])
  })
  test('Wearing-off-Tag: Stunden, Wechsel, längstes OFF', () => {
    const s = curveSummary(wearingOffDay())
    expect(s.off_h).toBe(1.5 + 0.5 + 1.5)
    expect(s.switches_to_off).toBe(2) // ein OFF schon um 06:00 ist kein Wechsel
    expect(s.longest_off_h).toBe(1.5)
    expect(s.symptoms.pain).toEqual({ hours: 1.5, in_off_pct: 100, in_good_pct: 0 })
  })
  test('Muster: Morgen-OFF, Wearing-off, verzögertes ON, OFF nach Essen, Schmerz im OFF', () => {
    const codes = curvePatterns(wearingOffDay()).map((p) => p.code)
    expect(codes).toEqual(expect.arrayContaining(['morning_off', 'wearing_off', 'delayed_on', 'meal_off', 'symptom_in_off']))
    const delayed = curvePatterns(wearingOffDay()).find((p) => p.code === 'delayed_on')
    expect(delayed).toMatchObject({ time: '14:00', minutes: 90 })
  })
  test('verzögertes ON unter 60 min ist kein Muster', () => {
    const v = emptyCurve(cfg)
    fill(v, at(v, '12:00'), at(v, '12:30'), 20)
    v.pills = ['12:00']
    expect(curvePatterns(v).map((p) => p.code)).not.toContain('delayed_on')
  })
  test('Dosisversagen: kein ON bis zur nächsten Einnahme', () => {
    const v = emptyCurve(cfg)
    fill(v, at(v, '12:00'), at(v, '15:00'), 20)
    v.pills = ['12:00', '15:00']
    expect(curvePatterns(v).map((p) => p.code)).toContain('dose_failure')
  })
  test('Überbewegungen werden gezählt', () => {
    const v = emptyCurve(cfg)
    fill(v, at(v, '09:00'), at(v, '10:00'), 85)
    expect(curveSummary(v).dys_h).toBe(1)
  })
  test('finalizeCurve rundet, klemmt und hängt Auswertung an', () => {
    const v = emptyCurve(cfg)
    v.values[3] = 120.4
    v.values[4] = 33.6
    const f = finalizeCurve(v)
    expect(f.values[3]).toBe(100)
    expect(f.values[4]).toBe(34)
    expect(f.summary).toBeDefined()
    expect(Array.isArray(f.patterns)).toBe(true)
    expect(v.summary).toBeUndefined() // Original unverändert
  })
  test('summaryText', () => {
    expect(summaryText(finalizeCurve(wearingOffDay()))).toMatch(/^OFF 3,5 h · gut beweglich 20,5 h · Überbewegungen 0 h · 2× Wechsel in OFF · Schmerzen 1,5 h$/)
    expect(summaryText(null)).toBe('')
  })
})

describe('Geometrie und Zeichnung', () => {
  test('Trefferprüfung: Tablette, Kurve, Beschwerde-Zeile', () => {
    const v = emptyCurve(cfg)
    const L = dcLayout(v)
    const pill = L.markerRows.find((r) => r.key === 'pill')
    expect(dcHit(v, L, L.x(2), pill.y + 5)).toEqual({ region: 'marker', key: 'pill', i: 2 })
    const h = dcHit(v, L, L.x(10), L.y(20))
    expect(h.region).toBe('chart')
    expect(h.i).toBe(10)
    expect(Math.round(h.v)).toBe(20)
    expect(dcHit(v, L, L.x(10) + 3, L.symRows[0].y + 10)).toEqual({ region: 'symptom', key: 'pain', j: 10 })
    expect(dcHit(v, L, 5, L.y(50))).toBeNull()
  })
  test('SVG enthält Zonen, Uhrzeiten, Marker und Kurve; blank ohne Kurve', () => {
    const v = wearingOffDay()
    const svg = dayCurveSvg(v, { uid: 't' })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('schlecht beweglich')
    expect(svg).toContain('>06:00<')
    expect(svg).toContain('💊')
    expect(svg).toContain('url(#t-g)')
    expect(dayCurveSvg(v, { blank: true })).not.toContain('<path')
  })
})

describe('Fragetyp im Datenfluss', () => {
  const item = { type: 'day_curve', tag: 'kurve', label: 'Tageskurve', value: null }

  test('gültiger Typ ohne options', () => {
    expect(ITEM_TYPES).toContain('day_curve')
    expect(validateQuestScoring({ items: [item] }).errors).toEqual([])
  })
  test('beantwortet erst mit übernommener Kurve; force greift', () => {
    expect(isAnswered(item, null)).toBe(false)
    expect(isAnswered(item, { foo: 1 })).toBe(false)
    expect(isAnswered(item, finalizeCurve(emptyCurve(cfg)))).toBe(true)
    expect(itemValidity({ ...item, force: false }, null)).toBe(true)
  })
  test('Ergebnis-Items: Rohkurve + Kennzahlen, nie bepunktet', () => {
    const value = finalizeCurve(wearingOffDay())
    const out = buildResultItems([{ ...item, value }])
    expect(out[0]).toMatchObject({ label: 'kurve', value })
    const off = out.find((r) => r.label === 'kurve_off_h')
    expect(off).toEqual({ label: 'kurve_off_h', value: 3.5, ignore_for_result: true })
    expect(out.find((r) => r.label === 'kurve_pain_in_off_pct').value).toBe(100)
    expect(dayCurveResultItems('kurve', null)).toEqual([])
  })
  test('Druck-PDF: leer als Raster, ausgefüllt mit Kurve und Zusammenfassung', () => {
    const empty = buildQuestPdfHtml({ title: 'T', items: [item] })
    expect(empty).toContain('<svg')
    expect(empty).not.toContain('url(#pdf1-g)"')
    const filled = buildQuestPdfHtml({ title: 'T', items: [{ ...item, value: finalizeCurve(wearingOffDay()) }] })
    expect(filled).toContain('OFF 3,5 h')
  })
})
