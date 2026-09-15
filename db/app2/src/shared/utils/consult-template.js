/**
 * Consultation templates ("Visitenmodus") — pure helpers.
 *
 * A template is a CODE_LOOKUP row (VISIT_DIMENSION/CONSULT_TEMPLATE_CD)
 * whose LOOKUP_BLOB describes what the cockpit shows for one kind of
 * outpatient visit. Nothing specialty-specific lives in code: scores,
 * text sections, checklist and letter layout all come from the blob.
 */

export const DEFAULT_TEXT_CONCEPTS = Object.freeze([
  { code: 'SCTID: 422625006', label: 'Anamnese / Verlauf', short: 'Verlauf', carryForward: false, letter: 'Anamnese' },
  { code: 'SCTID: 84728005', label: 'Neurologischer Befund', short: 'Befund', carryForward: true, letter: 'Befund' },
  { code: 'LID: 51848-0', label: 'Beurteilung / Zusammenfassung', short: 'Beurteilung', carryForward: true, letter: 'Beurteilung' },
  { code: 'SCTID: 304541006', label: 'Empfehlungen / Procedere', short: 'Empfehlung', carryForward: true, letter: 'Procedere' },
])

export const LEDD_CONCEPT = 'NEURO:SCORE:LEDD'
export const PRIMARY_DIAGNOSIS_CONCEPT = 'SCTID: 8319008'
export const SECONDARY_DIAGNOSIS_CONCEPT = 'NEURO:DX:SECONDARY'

/** Fill every optional key so consumers never need `?.` chains. */
export function normalizeConsultTemplate(blob, code = null) {
  const b = blob && typeof blob === 'object' ? blob : {}
  const scores = (b.scoreConcepts || []).map((s) => (typeof s === 'string' ? { code: s } : { ...s })).map((s) => ({
    code: s.code,
    short: s.short || null,
    higherIsWorse: s.higherIsWorse ?? true,
    questionnaireCode: s.questionnaireCode || null,
    derived: s.derived || (s.code === LEDD_CONCEPT ? 'ledd' : null),
    required: s.required ?? false,
    decimals: s.decimals ?? null,
  }))
  const texts = (b.textConcepts && b.textConcepts.length ? b.textConcepts : DEFAULT_TEXT_CONCEPTS).map((t) => ({
    code: t.code,
    label: t.label || t.code,
    short: t.short || t.label || t.code,
    carryForward: t.carryForward ?? false,
    letter: t.letter || t.label || t.code,
  }))
  return {
    code: code || b.code || null,
    label: b.label || code || 'Visite',
    icon: b.icon || 'medical_information',
    color: b.color || 'primary',
    visitType: b.visitType || 'consultation',
    inoutCd: b.inoutCd || 'O',
    locationCd: b.locationCd || 'AMBULANZ',
    followUpOf: b.followUpOf || null,
    followUpTemplate: b.followUpTemplate || null,
    staleAfterDays: Number.isFinite(b.staleAfterDays) ? b.staleAfterDays : 365,
    order: Number.isFinite(b.order) ? b.order : 999,
    isDefault: !!b.isDefault,
    diagnosis: { show: true, carryForward: true, ...(b.diagnosis || {}) },
    medication: { show: true, ledd: true, carryForward: true, showDiff: true, groups: [], ...(b.medication || {}) },
    scoreConcepts: scores,
    contextConcepts: [...(b.contextConcepts || [])],
    textConcepts: texts,
    panels: [...(b.panels || [])],
    checklist: [...(b.checklist || [])],
    suggestedQuestionnaires: [...(b.suggestedQuestionnaires || [])],
    letterSections: b.letterSections && b.letterSections.length ? [...b.letterSections] : ['diagnoses', 'medication', 'scores', ...texts.map((t) => `text:${t.code}`)],
    previousVisitScope: b.previousVisitScope === 'consult' ? 'consult' : 'any',
  }
}

/** Local calendar date YYYY-MM-DD. */
export function localDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const dateOf = (visit) => String(visit?.date || visit?.START_DATE || visit?.rawData?.START_DATE || '').slice(0, 10)

function blobOf(visit) {
  if (visit?.consultTemplate !== undefined || visit?.visitType !== undefined) {
    return { visitType: visit.visitType, consultTemplate: visit.consultTemplate ?? parseBlob(visit?.rawData?.VISIT_BLOB).consultTemplate ?? null }
  }
  return parseBlob(visit?.rawData?.VISIT_BLOB ?? visit?.VISIT_BLOB)
}

function parseBlob(text) {
  if (!text) return {}
  if (typeof text === 'object') return text
  try {
    return JSON.parse(text) || {}
  } catch {
    return {}
  }
}

/**
 * Which existing visit is "today's consultation"?
 * @returns {{visit: Object|null, match: 'template'|'other-template'|'visit-type'|'none', templateCode: string|null}}
 */
export function resolveTodayVisit(visits, template, today = localDate()) {
  const todays = (visits || []).filter((v) => dateOf(v) === today)
  if (!todays.length) return { visit: null, match: 'none', templateCode: null }
  const byCreated = (a, b) => (b.id ?? 0) - (a.id ?? 0)
  const withTemplate = todays.map((v) => ({ v, blob: blobOf(v) })).filter((x) => x.blob.consultTemplate).sort((a, b) => byCreated(a.v, b.v))
  if (template?.code) {
    const same = withTemplate.find((x) => x.blob.consultTemplate === template.code)
    if (same) return { visit: same.v, match: 'template', templateCode: same.blob.consultTemplate }
  }
  if (withTemplate.length) return { visit: withTemplate[0].v, match: 'other-template', templateCode: withTemplate[0].blob.consultTemplate }
  if (template?.visitType) {
    const typed = todays.map((v) => ({ v, blob: blobOf(v) })).filter((x) => (x.blob.visitType || x.v.visitType) === template.visitType).sort((a, b) => byCreated(a.v, b.v))
    if (typed.length) return { visit: typed[0].v, match: 'visit-type', templateCode: null }
  }
  return { visit: null, match: 'none', templateCode: null }
}

/** Newest visit strictly before `reference` (a visit or a YYYY-MM-DD date). */
export function findLastVisit(visits, reference, scope = 'any') {
  const refDate = typeof reference === 'string' ? reference.slice(0, 10) : dateOf(reference)
  const refId = typeof reference === 'object' ? reference?.id : null
  return (
    (visits || [])
      .filter((v) => {
        const d = dateOf(v)
        if (!d || d > refDate) return false
        if (d === refDate && (refId == null || v.id === refId)) return false
        if (scope === 'consult' && !blobOf(v).consultTemplate) return false
        return true
      })
      .sort((a, b) => (dateOf(b) > dateOf(a) ? 1 : dateOf(b) < dateOf(a) ? -1 : (b.id ?? 0) - (a.id ?? 0)))[0] || null
  )
}

export function daysBetween(fromDate, toDate = localDate()) {
  if (!fromDate) return null
  const a = new Date(String(fromDate).slice(0, 10) + 'T00:00:00')
  const b = new Date(String(toDate).slice(0, 10) + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

/**
 * Checklist state for today's visit: an item is done when a non-blank
 * observation of that concept exists (Q codes: a questionnaire row whose
 * blob names the code).
 */
export function checklistState(template, observations) {
  const obs = observations || []
  const hasConcept = (code) =>
    obs.some((o) => o.conceptCode === code && !isBlank(o))
  const hasQuestionnaire = (qcode) =>
    obs.some((o) => o.valueType === 'Q' && String(o.rawData?.OBSERVATION_BLOB || '').toUpperCase().includes(`"${qcode.toUpperCase()}"`))
  const items = (template?.checklist || []).map((entry) => {
    const item = typeof entry === 'string' ? { code: entry } : { ...entry }
    const isQ = item.questionnaire || (!item.code.includes(':') && item.code === item.code.toUpperCase())
    return { code: item.code, label: item.label || item.code, questionnaire: !!isQ, done: isQ ? hasQuestionnaire(item.code) : hasConcept(item.code) }
  })
  return { items, done: items.filter((i) => i.done).length, total: items.length }
}

function isBlank(o) {
  if (o.valueType === 'Q' || o.valueType === 'R') return false
  const flag = o.valueFlag ?? o.rawData?.VALUEFLAG_CD ?? null
  if (flag === 'NV' || flag === 'AUDIT' || flag === 'CONFIRMED') return false
  const v = o.displayValue ?? o.value ?? o.numericValue
  return v == null || v === '' || v === 'No value'
}

/** Suggest the template for the next visit: explicit followUpTemplate, else itself. */
export function suggestNextTemplate(templates, lastVisit) {
  const list = templates || []
  const fallback = list.find((t) => t.isDefault) || list.find((t) => /sonstiges|other|generic/i.test(t.code || '')) || list[0] || null
  if (!lastVisit) return fallback
  const code = blobOf(lastVisit).consultTemplate
  const vt = blobOf(lastVisit).visitType || lastVisit.visitType
  const last = list.find((t) => t.code === code) || list.find((t) => t.visitType === vt) || null
  if (!last) return fallback
  if (last.followUpTemplate) return list.find((t) => t.code === last.followUpTemplate) || last
  return last
}
