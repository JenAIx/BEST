// Hybrid-Ambulanzbogen: bedingte Fragen (show_if) und Vorausfüllen der Originalbögen.
// Run: npx jest test/jest/__tests__/hybrid_screen.test.js
import fs from 'fs'
import path from 'path'
import { isVisible, itemValidity, requiredFieldStats, answerStats } from 'src/tools/visits/visit-model'
import { validateQuestScoring } from 'src/tools/questman/validate'
import { buildResultItems } from 'src/tools/questman/result-items'
import { dcConfig, emptyCurve, finalizeCurve, indexOf } from 'src/tools/daycurve'
import { deriveFromHybrid, wakeMetrics, prefillVisitFromHybrid } from 'src/tools/hybrid-derive'

const Q = (name) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../src/assets/questionnaires/${name}`), 'utf8'))
const fresh = () => Q('quest_pd_hybrid_screen.json')
const NMS = Q('quest_nmsquest.json')
const PDSS = Q('quest_pdss.json')
const UPDRS4 = Q('quest_updrs_4.json')
const byId = (q, id) => q.items.find((it) => it.id === id)

// Kurve: 06–22 Uhr, OFF 08:00–10:00 (2 h), Überbewegungen 12:00–13:00 (1 h), OFF nachts 02:00–03:00
function curve(item) {
  const v = emptyCurve(dcConfig(item))
  const set = (a, b, x) => { for (let i = indexOf(v, a); i < indexOf(v, b); i++) v.values[i] = x }
  set('08:00', '10:00', 15)
  set('12:00', '13:00', 85)
  set('02:00', '03:00', 15)
  return finalizeCurve(v)
}

function filledQuest() {
  const q = fresh()
  byId(q, 1).value = '06:00'
  byId(q, 2).value = '22:00' // 16 h wach
  byId(q, 3).value = curve(byId(q, 3))
  // NMSQuest-Listen: Verdauung mit nms01 + nms05, alle anderen „nichts davon"
  q.items.filter((it) => it.type === 'checkbox' && it.tag.startsWith('nms_')).forEach((it) => {
    it.value = it.tag === 'nms_verdauung' ? ['nms01', 'nms05'] : [it.exclusive_option]
  })
  byId(q, 21).value = 2
  byId(q, 22).value = ['pdss03', 'pdss08']
  byId(q, 203).value = 3
  byId(q, 208).value = 4
  byId(q, 301).value = 1
  byId(q, 302).value = 2
  byId(q, 303).value = 1
  byId(q, 304).value = 0
  return q
}

describe('Bogen pd_hybrid_screen', () => {
  test('schemakonform, show_if-Verweise gültig', () => {
    expect(validateQuestScoring(fresh()).errors).toEqual([])
  })
  test('validate meldet kaputte show_if-Verweise', () => {
    const res = validateQuestScoring({ items: [{ id: 1, type: 'radio', label: 'a', options: [{ label: 'x', value: 1 }], show_if: { item: 99, op: 'equals', value: 1 } }] })
    expect(res.errors.map((e) => e.code)).toContain('SHOW_IF_REF')
  })
})

describe('show_if', () => {
  test('PDSS-Häufigkeit erscheint nur für Angekreuztes', () => {
    const q = fresh()
    const f3 = byId(q, 203)
    expect(isVisible(f3, q.items)).toBe(false)
    byId(q, 22).value = ['pdss03']
    expect(isVisible(f3, q.items)).toBe(true)
    expect(isVisible(byId(q, 204), q.items)).toBe(false)
  })
  test('Teil D erscheint nur bei OFF bzw. Überbewegungen in der Kurve', () => {
    const q = fresh()
    const c = byId(q, 3)
    c.value = finalizeCurve(emptyCurve(dcConfig(c)))
    expect(isVisible(byId(q, 301), q.items)).toBe(false)
    expect(isVisible(byId(q, 303), q.items)).toBe(false)
    c.value = curve(c)
    expect(isVisible(byId(q, 301), q.items)).toBe(true)
    expect(isVisible(byId(q, 303), q.items)).toBe(true)
  })
  test('ausgeblendet = kein Pflichtfeld, zählt nicht im Fortschritt', () => {
    const q = fresh()
    expect(itemValidity(byId(q, 203), null, q.items)).toBeNull()
    expect(itemValidity(byId(q, 203), null)).toBe(false) // ohne items: altes Verhalten
    const total = answerStats(q.items).total
    byId(q, 22).value = ['pdss03']
    expect(answerStats(q.items).total).toBe(total + 1)
    const req = requiredFieldStats(q.items, q.items.map((it) => it.value))
    expect(req.total).toBeGreaterThan(0)
  })
  test('ausgeblendete Frage geht mit hidden_value in die Ergebnisse', () => {
    const q = filledQuest()
    const out = buildResultItems(q.items)
    const f2 = out.find((r) => r.label === 'pdss_02')
    expect(f2.value).toBe(0)
    expect(out.find((r) => r.label === 'pdss_03').value).toBe(3)
  })
})

describe('Ableitung', () => {
  test('Wachzeit-Kennzahlen aus Kurve und Uhrzeiten', () => {
    const m = wakeMetrics(filledQuest().items)
    expect(m).toEqual({ wake_h: 16, off_wake_h: 2, dys_wake_h: 1, on_wake_h: 13, night_off_h: 1 })
  })
  test('NMSQuest vollständig: angekreuzt = 1, Rest = 0', () => {
    const d = deriveFromHybrid(filledQuest().items, { nms_quest: NMS }).nms_quest
    expect(d.complete).toBe(true)
    const arr = d.values.find(Array.isArray)
    expect(arr).toHaveLength(30)
    expect(arr[0]).toBe(1)
    expect(arr[4]).toBe(1)
    expect(arr.reduce((a, b) => a + b, 0)).toBe(2)
  })
  test('NMSQuest: leere Liste = fehlend, nicht 0', () => {
    const q = filledQuest()
    byId(q, 12).value = []
    const d = deriveFromHybrid(q.items, { nms_quest: NMS }).nms_quest
    expect(d.complete).toBe(false)
    expect(d.missing.length).toBe((byId(q, 12).options.length) - 1)
  })
  test('PDSS-2: Item 1 übernommen, angekreuzt mit Häufigkeit, Rest niemals', () => {
    const d = deriveFromHybrid(filledQuest().items, { pdss2: PDSS }).pdss2
    expect(d.complete).toBe(true)
    const arr = d.values.find(Array.isArray)
    expect(arr[0]).toBe(2)
    expect(arr[2]).toBe(3)
    expect(arr[7]).toBe(4)
    expect(arr.filter((x) => x === 0)).toHaveLength(12)
  })
  test('UPDRS IV: 4.1/4.3 aus der Kurve, Rest Vorschlag; nie „vollständig"', () => {
    const d = deriveFromHybrid(filledQuest().items, { updrs_4: UPDRS4 }).updrs_4
    const v = Object.fromEntries(UPDRS4.items.map((it, i) => [it.id, d.values[i]]).filter(([id]) => id))
    expect(v[41]).toBe(1) // 1 h von 16 h = 6 %
    expect(v[43]).toBe(1) // 2 h von 16 h = 12,5 %
    expect(v[44]).toBe(2)
    expect(v[45]).toBe(1)
    expect(v[42]).toBe(1)
    expect(v[46]).toBe(0)
    expect(d.complete).toBe(false)
    expect(d.notes.find((n) => n.id === 43).source).toBe('kurve')
  })
  test('UPDRS IV: ohne OFF/Überbewegungen per Anker 0', () => {
    const q = filledQuest()
    const c = byId(q, 3)
    c.value = finalizeCurve(emptyCurve(dcConfig(c)))
    const d = deriveFromHybrid(q.items, { updrs_4: UPDRS4 }).updrs_4
    expect(d.values.filter((x) => x !== null)).toEqual([0, 0, 0, 0, 0, 0])
  })
  test('Visite: nur leere Slots werden als Entwurf vorausgefüllt', () => {
    const visit = { id: 7, items: [
      { short_title: 'pd_hybrid_screen', status: 'completed' },
      { short_title: 'nms_quest', status: 'empty' },
      { short_title: 'pdss2', status: 'draft' },
      { short_title: 'updrs_4', status: 'empty' },
    ] }
    const saved = []
    const vm = { get_visit: () => visit, save_draft: (id, short, values) => saved.push({ short, values }) }
    const defs = { nms_quest: NMS, pdss2: PDSS, updrs_4: UPDRS4 }
    const done = prefillVisitFromHybrid(vm, 7, filledQuest().items, (s) => defs[s])
    expect(done).toEqual(['nms_quest', 'updrs_4'])
    expect(saved.map((s) => s.short)).toEqual(['nms_quest', 'updrs_4'])
  })
})
