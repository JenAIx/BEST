// Parkinson-Ambulanz-Hybridbogen (pd_hybrid_screen) → Originalbögen vorausfüllen.
//
// Der Hybridbogen fragt NMSQuest und PDSS-2 im Originalwortlaut, aber gebündelt
// (Bereichslisten, „kam vor?" + Häufigkeit nur für Angekreuztes) und erfasst die
// Beweglichkeit als Tageskurve. Dieses Modul überträgt die Antworten in die
// Originalbögen — als Werte-Array indexgenau zu deren items, also genau in der
// Form eines Visiten-Entwurfs (slot.draft.values). Rein, ohne Vue/Dexie.
//
// Regeln (Konzept + Mapping: Vault 60-someday/20261002-idee-kynmobi-screening-
// fragebogen/hybridbogen/):
//   NMSQuest  Item k ↔ Option „nmsKK" einer Bereichsliste: angekreuzt = Ja (1);
//             Liste beantwortet (auch nur „nichts davon") und nicht angekreuzt = Nein (0);
//             Liste leer = fehlt.
//   PDSS-2    Item 1 1:1 (gleiche Skala); Item k ≥ 2: in der Liste angekreuzt →
//             Häufigkeit aus der Folgefrage (200 + k), nicht angekreuzt → „niemals" (0).
//   UPDRS IV  4.1 / 4.3 aus der Kurve: Stunden mit Überbewegungen bzw. OFF in der
//             Wachzeit / Wachzeit × 100 → Anker (≤25 / ≤50 / ≤75 / >75 %). Keine
//             OFF-/Dyskinesie-Zeit → 0 per Ankerdefinition für die abhängigen Items;
//             sonst Patientenangabe (Teil D) als Vorschlag. Alles ist ärztlich zu
//             bestätigen — der Bogen bleibt deshalb ein Entwurf.
// Die Formate (Liste, zweistufig) sind nicht gegen die Originale validiert; wer
// Scores auswertet, kennzeichnet sie als „Erhebung: hybrid".
import { isDayCurveValue, slotStates, toMin } from './daycurve'
import { buildResultItems } from './questman/result-items'
import { calc_results, evaluate } from './questman/scoring'

export const HYBRID_SHORT = 'pd_hybrid_screen'
export const HYBRID_TARGETS = ['nms_quest', 'pdss2', 'updrs_4']

const pad2 = (n) => String(n).padStart(2, '0')
const isListAnswered = (v) => Array.isArray(v) && v.length > 0

function byId(items, id) {
  return (items || []).find((it) => it.id === id)
}

// Checkbox-Item des Hybridbogens, das eine Option mit diesem Wert trägt.
function listWithMember(items, member) {
  return (items || []).find((it) => it.type === 'checkbox' && (it.options || []).some((o) => o.value === member))
}

function listMember(items, member) {
  const list = listWithMember(items, member)
  if (!list || !isListAnswered(list.value)) return null
  return list.value.includes(member) ? 1 : 0
}

// ---------- Kurve in der Wachzeit ----------

export function wakeMetrics(items) {
  const curve = byId(items, 3)
  const wake = toMin(byId(items, 1) && byId(items, 1).value)
  const sleep = toMin(byId(items, 2) && byId(items, 2).value)
  if (!curve || !isDayCurveValue(curve.value) || wake === null || sleep === null) return null
  const v = curve.value
  const st = slotStates(v)
  const h = v.step_min / 60
  const wakeLen = (((sleep - wake) % 1440) + 1440) % 1440
  const inWake = (j) => {
    const t = toMin(v.start) + j * v.step_min
    return ((((t - wake) % 1440) + 1440) % 1440) < wakeLen
  }
  const count = (z, wakeOnly) => st.filter((s, j) => s === z && inWake(j) === wakeOnly).length * h
  return {
    wake_h: wakeLen / 60,
    off_wake_h: count('off', true),
    dys_wake_h: count('dys', true),
    on_wake_h: count('on', true),
    night_off_h: count('off', false),
  }
}

function percentAnchor(hours, wakeH) {
  if (!(wakeH > 0)) return null
  if (hours <= 0) return 0
  const pct = (hours / wakeH) * 100
  if (pct <= 25) return 1
  if (pct <= 50) return 2
  if (pct <= 75) return 3
  return 4
}

// Liegt der Anteil höchstens einen Kurvenabschnitt neben einer Bandgrenze?
function borderline(hours, wakeH, step = 0.5) {
  if (!(wakeH > 0) || hours <= 0) return false
  return [0.25, 0.5, 0.75].some((edge) => Math.abs(hours - edge * wakeH) <= step)
}

const proposal = (items, id) => {
  const it = byId(items, id)
  return it && typeof it.value === 'number' ? it.value : null
}

// ---------- Ziele ----------

function matrixValues(questDef, valueForId) {
  const out = (questDef.items || []).map(() => null)
  const missing = []
  ;(questDef.items || []).forEach((it, ix) => {
    if (it.type !== 'multiple_radio' || !it.options || !Array.isArray(it.options.questions)) return
    out[ix] = it.options.questions.map((q) => {
      const v = valueForId(q.id)
      if (v === null || v === undefined) missing.push(q.id)
      return v === undefined ? null : v
    })
  })
  return { values: out, complete: missing.length === 0, missing }
}

function deriveNms(items, questDef) {
  return matrixValues(questDef, (id) => listMember(items, `nms${pad2(id)}`))
}

function derivePdss(items, questDef) {
  return matrixValues(questDef, (id) => {
    if (id === 1) return proposal(items, 21)
    const inList = listMember(items, `pdss${pad2(id)}`)
    if (inList === null) return null
    if (inList === 0) return 0
    return proposal(items, 200 + id)
  })
}

function deriveUpdrs4(items, questDef, m) {
  const notes = []
  const val = {}
  if (m) {
    val[41] = percentAnchor(m.dys_wake_h, m.wake_h)
    val[43] = percentAnchor(m.off_wake_h, m.wake_h)
    notes.push({ id: 41, source: 'kurve', borderline: borderline(m.dys_wake_h, m.wake_h) })
    notes.push({ id: 43, source: 'kurve', borderline: borderline(m.off_wake_h, m.wake_h) })
    const noDys = m.dys_wake_h === 0
    const noOff = m.off_wake_h === 0
    val[42] = noDys ? 0 : proposal(items, 303)
    notes.push({ id: 42, source: noDys ? 'anker' : 'patient' })
    ;[[44, 302], [45, 301], [46, 304]].forEach(([id, from]) => {
      val[id] = noOff ? 0 : proposal(items, from)
      notes.push({ id, source: noOff ? 'anker' : 'patient' })
    })
  }
  const values = (questDef.items || []).map((it) => (it.type === 'radio' && val[it.id] !== undefined ? val[it.id] : null))
  const missing = (questDef.items || []).filter((it) => it.type === 'radio' && (val[it.id] === null || val[it.id] === undefined)).map((it) => it.id)
  // complete ist hier nie true: UPDRS IV ist ein Arztbogen, alles muss bestätigt werden.
  return { values, complete: false, missing, notes }
}

/**
 * @param {Array} hybridItems  items des ausgefüllten pd_hybrid_screen (mit .value)
 * @param {object} questDefs   { nms_quest, pdss2, updrs_4 } — Fragebogen-Definitionen
 * @returns {{ metrics: object|null, nms_quest?: object, pdss2?: object, updrs_4?: object }}
 */
export function deriveFromHybrid(hybridItems, questDefs) {
  const metrics = wakeMetrics(hybridItems)
  const out = { metrics }
  if (questDefs.nms_quest) out.nms_quest = deriveNms(hybridItems, questDefs.nms_quest)
  if (questDefs.pdss2) out.pdss2 = derivePdss(hybridItems, questDefs.pdss2)
  if (questDefs.updrs_4) out.updrs_4 = deriveUpdrs4(hybridItems, questDefs.updrs_4, metrics)
  return out
}

// Visiten-Schritt: abgeleitete Werte als Entwurf in noch leere Slots legen.
// visitMan: VisitMan-Instanz; getQuest(short) liefert die Definition.
// Bereits begonnene oder abgeschlossene Slots werden nie überschrieben.
export function prefillVisitFromHybrid(visitMan, visitId, hybridItems, getQuest) {
  const visit = visitMan.get_visit(visitId)
  if (!visit) return []
  const defs = {}
  HYBRID_TARGETS.forEach((short) => {
    const slot = visit.items.find((s) => s.short_title === short)
    const def = getQuest(short)
    if (slot && slot.status === 'empty' && def) defs[short] = def
  })
  const derived = deriveFromHybrid(hybridItems, defs)
  const done = []
  Object.keys(defs).forEach((short) => {
    visitMan.save_draft(visitId, short, derived[short].values)
    done.push(short)
  })
  return done
}

// ---------- Auswertung des Hybridbogens (Ergebnis-Seite) ----------
//
// Drei Bereiche mit Ampel (auffällig / grenzwertig / unauffällig / unvollständig)
// und Kennzahlen, damit Auffälliges sofort ins Auge fällt. Schwellen sind
// Orientierung, keine Diagnose:
//   NMSQuest  Anzahl Ja 0–30; Schweregrad nach Chaudhuri et al. 2015 (Parkinsonism
//             Relat Disord 21:287): 0 keine, 1–5 leicht, 6–9 mäßig, 10–13 schwer,
//             ≥14 sehr schwer. Dazu Warnzeichen-Items, die unabhängig von der Summe
//             auffallen sollen.
//   PDSS-2    Summe 0–60 (Item 1 umgepolt); ≥ 18 klinisch relevante Schlafstörung
//             (Muntean et al. 2016, Sleep Med).
//   Motorik   OFF ≥ 2 h oder ≥ 25 % der Wachzeit, Überbewegungen ≥ 25 % bzw.
//             Beeinträchtigung ≥ „mehrere Tätigkeiten“, verzögertes ON ≥ 60 min
//             oder Dosisversagen → auffällig (klinische Faustregel, nicht validiert).
export const NMS_GRADES = [[0, 0, 'keine'], [1, 5, 'leicht'], [6, 9, 'mäßig'], [10, 13, 'schwer'], [14, 30, 'sehr schwer']]
export const NMS_RED_FLAGS = {
  3: 'Schluckstörung', 14: 'Sinnestäuschungen', 16: 'Niedergeschlagenheit', 20: 'Schwindel beim Aufstehen',
  21: 'Stürze', 22: 'Einschlafen bei Aktivitäten', 30: 'wahnhafte Überzeugungen',
}
export const PDSS2_CUTOFF = 18
const OFF_H_FLAG = 2
const PCT_FLAG = 25
const FREQ_OFT = 3

const r1 = (x) => Math.round(x * 10) / 10
const de1 = (x) => String(r1(x)).replace('.', ',')
const RANK = { 'unvollständig': 0, 'unauffällig': 1, 'grenzwertig': 2, 'auffällig': 3 }
const worst = (a, b) => (RANK[b] > RANK[a] ? b : a)

function nmsGrade(total) {
  const g = NMS_GRADES.find(([lo, hi]) => total >= lo && total <= hi)
  return g ? g[2] : ''
}

function pdssItemLabel(items, id) {
  const list = byId(items, 22)
  const o = list && (list.options || []).find((x) => x.value === `pdss${pad2(id)}`)
  return o ? o.label.replace(/\?$/, '') : `PDSS-2 Item ${id}`
}

export function evaluateHybrid(items) {
  const domains = []
  const results = []
  const num = (key, display, value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return
    results.push({ label: key, value, coding: { system: 'CUSTOM', code: `CUSTOM: PD_HYBRID_${key.toUpperCase()}`, display } })
  }

  // --- Motorik / Fluktuationen ---
  const m = wakeMetrics(items)
  const curve = byId(items, 3)
  const motor = { name: 'Motorik / Wirkschwankungen', status: 'unvollständig', lines: [] }
  if (m && m.wake_h > 0) {
    const offPct = (m.off_wake_h / m.wake_h) * 100
    const dysPct = (m.dys_wake_h / m.wake_h) * 100
    num('off_wake_h', 'OFF in der Wachzeit (h)', r1(m.off_wake_h))
    num('off_wake_pct', 'OFF in der Wachzeit (%)', Math.round(offPct))
    num('dys_wake_h', 'Überbewegungen in der Wachzeit (h)', r1(m.dys_wake_h))
    num('dys_wake_pct', 'Überbewegungen in der Wachzeit (%)', Math.round(dysPct))
    num('night_off_h', 'OFF nachts (h)', r1(m.night_off_h))
    const sum = curve.value.summary || {}
    num('switches_to_off', 'Wechsel in OFF', sum.switches_to_off)
    num('longest_off_h', 'längstes OFF (h)', sum.longest_off_h)
    motor.status = 'unauffällig'
    motor.lines.push(`OFF ${de1(m.off_wake_h)} h (${Math.round(offPct)} % der Wachzeit ${de1(m.wake_h)} h) · Überbewegungen ${de1(m.dys_wake_h)} h (${Math.round(dysPct)} %)`)
    if (m.off_wake_h > 0) motor.status = 'grenzwertig'
    if (m.off_wake_h >= OFF_H_FLAG || offPct >= PCT_FLAG) motor.status = 'auffällig'
    if (m.dys_wake_h > 0) motor.status = worst(motor.status, 'grenzwertig')
    const dysImpact = proposal(items, 303)
    if (dysPct >= PCT_FLAG || (dysImpact !== null && dysImpact >= 2)) motor.status = 'auffällig'
    // night_off nicht hier: nächtliches OFF steht unter Schlaf, gerechnet mit der
    // angegebenen Schlafzeit statt mit dem festen Nachtfenster der Kurve.
    const pats = (curve.value.patterns || []).filter((p) => ['morning_off', 'wearing_off', 'delayed_on', 'dose_failure', 'meal_off'].includes(p.code))
    if (pats.some((p) => p.code === 'delayed_on' || p.code === 'dose_failure')) motor.status = 'auffällig'
    pats.forEach((p) => motor.lines.push(p.text))
    const up = deriveUpdrs4(items, { items: [41, 42, 43, 44, 45, 46].map((id) => ({ id, type: 'radio' })) }, m)
    const vals = up.values.filter((v) => typeof v === 'number')
    num('updrs4_1_vorschlag', 'MDS-UPDRS 4.1 (Vorschlag)', up.values[0])
    num('updrs4_3_vorschlag', 'MDS-UPDRS 4.3 (Vorschlag)', up.values[2])
    if (vals.length) motor.lines.push(`MDS-UPDRS IV (Vorschlag, ärztlich zu bestätigen): ${vals.reduce((a, b) => a + b, 0)}/24${vals.length < 6 ? ` – ${6 - vals.length} von 6 Items offen` : ''}`)
  }
  domains.push(motor)

  // --- Nicht-motorisch (NMSQuest) ---
  const nms = { name: 'Nicht-motorische Symptome (NMSQuest)', status: 'unvollständig', lines: [] }
  const nmsVals = []
  for (let k = 1; k <= 30; k++) nmsVals.push(listMember(items, `nms${pad2(k)}`))
  const nmsMissing = nmsVals.filter((v) => v === null).length
  const nmsTotal = nmsVals.reduce((a, v) => a + (v || 0), 0)
  if (nmsMissing === 0) {
    num('nmsquest_total', 'NMSQuest (Anzahl Ja, 0–30)', nmsTotal)
    nms.status = nmsTotal >= 10 ? 'auffällig' : nmsTotal >= 6 ? 'grenzwertig' : 'unauffällig'
    nms.lines.push(`${nmsTotal}/30 Symptome – Belastung ${nmsGrade(nmsTotal)}`)
  } else {
    nms.lines.push(`${nmsTotal} Symptome angegeben, ${nmsMissing} Items unbeantwortet`)
  }
  const flags = Object.entries(NMS_RED_FLAGS).filter(([k]) => nmsVals[Number(k) - 1] === 1).map(([, t]) => t)
  if (flags.length) {
    nms.status = 'auffällig'
    nms.lines.push(`Warnzeichen: ${flags.join(', ')}`)
  }
  if (curve && isDayCurveValue(curve.value)) {
    ;(curve.value.patterns || []).filter((p) => p.code === 'symptom_in_off').forEach((p) => {
      nms.status = worst(nms.status === 'unvollständig' ? 'unauffällig' : nms.status, 'grenzwertig')
      nms.lines.push(p.text)
    })
  }
  domains.push(nms)

  // --- Schlaf (PDSS-2) ---
  const sleep = { name: 'Schlaf (PDSS-2)', status: 'unvollständig', lines: [] }
  const pdss = derivePdss(items, { items: [{ type: 'multiple_radio', options: { questions: Array.from({ length: 15 }, (_, i) => ({ id: i + 1 })) } }] })
  const pv = pdss.values[0]
  if (pdss.complete) {
    const total = (4 - pv[0]) + pv.slice(1).reduce((a, b) => a + b, 0)
    num('pdss2_total', 'PDSS-2 Summe (0–60)', total)
    sleep.status = total >= PDSS2_CUTOFF ? 'auffällig' : 'unauffällig'
    sleep.lines.push(`PDSS-2 ${total}/60 (Grenzwert ${PDSS2_CUTOFF})`)
  } else {
    sleep.lines.push(`${pdss.missing.length} von 15 PDSS-2-Items offen`)
  }
  const often = pv.map((v, i) => ({ id: i + 1, v })).filter((x) => x.id > 1 && x.v >= FREQ_OFT)
  if (often.length) sleep.lines.push(`oft/sehr oft: ${often.map((x) => pdssItemLabel(items, x.id)).join(' · ')}`)
  if (m && m.night_off_h >= 1) {
    sleep.lines.push(`nächtliches OFF laut Kurve: ${de1(m.night_off_h)} h`)
    if (sleep.status === 'unauffällig') sleep.status = 'grenzwertig'
  }
  domains.push(sleep)

  const n = domains.filter((d) => d.status === 'auffällig').length
  const icon = { 'auffällig': '⚠', 'grenzwertig': '◐', 'unauffällig': '✓', 'unvollständig': '…' }
  const color = { 'auffällig': '#c62828', 'grenzwertig': '#b26a00', 'unauffällig': '#2e7d32', 'unvollständig': '#616161' }
  const html = domains.map((d) =>
    `<div style="margin:0 0 8px"><b style="color:${color[d.status]}">${icon[d.status]} ${d.name}: ${d.status}</b>` +
    (d.lines.length ? `<ul style="margin:2px 0 0 18px;padding:0">${d.lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : '') +
    '</div>').join('') +
    '<div style="font-size:85%;color:#666">Orientierungswerte, keine Diagnose. NMSQuest/PDSS-2 im Listen- bzw. Zweistufenformat erhoben (Erhebung: hybrid).</div>'
  results.push({ label: 'auffaellige_bereiche', value: n, coding: { system: 'CUSTOM', code: 'CUSTOM: PD_HYBRID_AUFFAELLIG', display: 'auffällige Bereiche (0–3)' }, evaluation: html })
  return results
}

// ---------- Abgeleitete Originalbögen als fertige Zusammenfassungen ----------
//
// Für den Export (app2) und überall, wo NMSQuest / PDSS-2 als eigene Bögen
// gebraucht werden: aus dem Hybridbogen vollständig ableitbare Originalbögen als
// summary-Objekte im selben Format wie QuestMan.summary (label, title, items,
// results, coding) — markiert mit collection 'hybrid'. Nur vollständige Bögen;
// UPDRS IV nie (Arztbogen, muss bestätigt werden).

export const HYBRID_DERIVED = ['nms_quest', 'pdss2']

export function derivedSummaries(hybridItems, getQuest) {
  const out = []
  HYBRID_DERIVED.forEach((short) => {
    const def = getQuest(short)
    if (!def) return
    const d = deriveFromHybrid(hybridItems, { [short]: def })[short]
    if (!d || !d.complete) return
    const items = JSON.parse(JSON.stringify(def.items || []))
    items.forEach((it, i) => {
      if (d.values[i] !== null && d.values[i] !== undefined) it.value = d.values[i]
    })
    const summary = {
      label: def.short_title,
      title: def.title,
      items: buildResultItems(items),
      coding: def.coding,
      collection: 'hybrid',
      derived_from: HYBRID_SHORT,
    }
    summary.results = calc_results(summary, def.results)
    if (def.results && def.results.evaluation) summary.results = evaluate(summary.results, def.results.evaluation)
    out.push(summary)
  })
  return out
}
