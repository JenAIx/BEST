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
