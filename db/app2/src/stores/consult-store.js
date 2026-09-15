/**
 * Consult store — orchestration for the Visitenmodus (consultation cockpit).
 *
 * Holds everything the cockpit shows for ONE patient: the active template,
 * today's consultation visit (always `visitStore.selectedVisit` while it
 * exists — the same single-editor rule the timeline uses), the last visit,
 * problem list, medication (+ diff vs. last visit, LEDD), score series,
 * text sections with history, letters. All writes go through the existing
 * services/repositories; nothing here talks SQL directly except via repos.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useVisitStore } from './visit-store'
import { useObservationStore } from './observation-store'
import { useMedicationsStore } from './medications-store'
import { useGlobalSettingsStore } from './global-settings-store'
import { useAuthStore } from './auth-store'
import { useLoggingStore } from './logging-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { buildObservationUpdate, buildNewObservationData } from 'src/shared/utils/observation-display.js'
import { computeLEDD } from 'src/shared/utils/ledd.js'
import { diffMedications } from 'src/shared/utils/medication-diff.js'
import { resolveTodayVisit, findLastVisit, daysBetween, checklistState, suggestNextTemplate, localDate, LEDD_CONCEPT } from 'src/shared/utils/consult-template.js'

export const useConsultStore = defineStore('consult', () => {
  const dbStore = useDatabaseStore()
  const visitStore = useVisitStore()
  const observationStore = useObservationStore()
  const medicationsStore = useMedicationsStore()
  const globalSettingsStore = useGlobalSettingsStore()
  const authStore = useAuthStore()
  const logger = useLoggingStore().createLogger('ConsultStore')

  // ---- state ---------------------------------------------------------------
  const patientNum = ref(null)
  const templates = ref([])
  const templateCode = ref(null)
  const todayVisit = ref(null) // transformed visit (visit-store shape) or null
  const todayMatch = ref('none') // 'template' | 'other-template' | 'visit-type' | 'none'
  const lastVisit = ref(null)
  const problemList = ref([])
  const previousProblemList = ref([])
  const medications = ref([]) // rows of the visit the cockpit shows medication for
  const medicationVisitId = ref(null) // today's visit or the last visit with medication
  const previousMedications = ref([])
  const previousMedicationVisitId = ref(null)
  const history = ref(new Map()) // conceptCode → rows (newest visit first), scores + texts + context
  const letters = ref([])
  const drugOptions = ref([])
  const frequencyOptions = ref([])
  const carriedCodes = ref(new Set()) // text concepts carried forward today (UI chip until edited)
  const loading = ref(false)
  const error = ref(null)

  // ---- getters -------------------------------------------------------------
  const template = computed(() => templates.value.find((t) => t.code === templateCode.value) || null)
  const isEditable = computed(() => todayVisit.value != null)
  const daysSinceLastVisit = computed(() => (lastVisit.value ? daysBetween(lastVisit.value.date) : null))
  const isStale = computed(() => daysSinceLastVisit.value != null && template.value && daysSinceLastVisit.value > template.value.staleAfterDays)

  const rowsFor = (code) => history.value.get(code) || []
  const todayRow = (code) => (todayVisit.value ? rowsFor(code).find((r) => r.encounterNum === todayVisit.value.id) || null : null)
  const previousRows = (code) => rowsFor(code).filter((r) => !todayVisit.value || r.encounterNum !== todayVisit.value.id)

  const ledd = computed(() => (template.value?.medication?.ledd ? computeLEDD(medications.value, { frequencyOptions: frequencyOptions.value, drugOptions: drugOptions.value }) : null))
  const previousLedd = computed(() => (template.value?.medication?.ledd && previousMedications.value.length ? computeLEDD(previousMedications.value, { frequencyOptions: frequencyOptions.value, drugOptions: drugOptions.value }) : null))
  const medicationDiff = computed(() => (template.value?.medication?.showDiff && previousMedicationVisitId.value != null && previousMedicationVisitId.value !== medicationVisitId.value ? diffMedications(previousMedications.value, medications.value, { frequencyOptions: frequencyOptions.value, drugOptions: drugOptions.value }) : null))

  /** One entry per template score: current/previous value, delta, ascending series. */
  const scoreStrip = computed(() =>
    (template.value?.scoreConcepts || []).map((score) => {
      if (score.derived === 'ledd') {
        const cur = ledd.value?.total ?? null
        const prev = previousLedd.value?.total ?? null
        return { ...score, current: cur, currentDate: medicationVisitId.value === todayVisit.value?.id ? todayVisit.value?.date : medicationDate(medicationVisitId.value), previous: prev, previousDate: medicationDate(previousMedicationVisitId.value), delta: cur != null && prev != null ? round(cur - prev) : null, series: [], isToday: medicationVisitId.value != null && medicationVisitId.value === todayVisit.value?.id, unit: 'mg/d', unresolved: ledd.value?.unresolved || [] }
      }
      const rows = rowsFor(score.code).filter((r) => r.numericValue != null)
      const today = todayVisit.value ? rows.find((r) => r.encounterNum === todayVisit.value.id) : null
      const others = rows.filter((r) => !today || r.encounterNum !== today.encounterNum)
      const shown = today || others[0] || null
      const prev = today ? others[0] || null : others[1] || null
      const series = [...rows].reverse().map((r) => ({ date: r.visitDate, value: r.numericValue, encounterNum: r.encounterNum, observationId: r.observationId }))
      return { ...score, current: shown?.numericValue ?? null, currentDate: shown?.visitDate || null, previous: prev?.numericValue ?? null, previousDate: prev?.visitDate || null, delta: shown && prev ? round(shown.numericValue - prev.numericValue) : null, series, isToday: !!today, unit: shown?.unit || null, observationId: today?.observationId || null, rows }
    }),
  )

  /** Text sections: today's row + previous rows (newest first). */
  const textSections = computed(() =>
    (template.value?.textConcepts || []).map((t) => ({ ...t, current: todayRow(t.code), history: previousRows(t.code).filter((r) => r.value && r.value.trim()), carried: carriedCodes.value.has(t.code) })),
  )

  const contextValues = computed(() => (template.value?.contextConcepts || []).map((code) => ({ code, current: todayRow(code), last: previousRows(code)[0] || null })))

  const checklist = computed(() => (template.value ? checklistState(template.value, [...observationStore.observations, ...todayHistoryRows()]) : { items: [], done: 0, total: 0 }))

  function todayHistoryRows() {
    if (!todayVisit.value) return []
    const out = []
    for (const rows of history.value.values()) for (const r of rows) if (r.encounterNum === todayVisit.value.id) out.push({ conceptCode: r.conceptCode, valueType: r.valueType, displayValue: r.numericValue ?? r.value ?? '', valueFlag: r.valueFlag })
    return out
  }

  function medicationDate(encounterNum) {
    if (encounterNum == null) return null
    return visitStore.visits.find((v) => v.id === encounterNum)?.date || null
  }

  const round = (n) => Math.round(n * 100) / 100

  // ---- loading -------------------------------------------------------------
  const loadTemplates = async () => {
    templates.value = await globalSettingsStore.getConsultTemplateOptions()
    return templates.value
  }

  const loadOptionLists = async () => {
    try {
      const [drugs, freqs] = await Promise.all([globalSettingsStore.loadLookupValues('DRUG_OPTIONS', 'VISIT_DIMENSION'), globalSettingsStore.loadLookupValues('FREQUENCY_OPTIONS', 'CONCEPT_DIMENSION')])
      drugOptions.value = (drugs || []).map((r) => ({ value: r.CODE_CD, label: r.NAME_CHAR, ...globalSettingsStore.parseMetadata(r.LOOKUP_BLOB) }))
      frequencyOptions.value = (freqs || []).map((r) => ({ value: r.CODE_CD, label: r.NAME_CHAR, ...globalSettingsStore.parseMetadata(r.LOOKUP_BLOB) }))
    } catch (err) {
      logger.warn('Option lists unavailable', { error: err?.message })
    }
  }

  /**
   * Open the cockpit for a patient. Resolves the template (explicit code, else
   * the suggestion from the last visit), today's consultation visit and the
   * last visit, then loads every panel.
   */
  const openCockpit = async ({ patientNum: num, templateCode: code = null } = {}) => {
    if (num == null) return
    loading.value = true
    error.value = null
    try {
      if (patientNum.value !== num) {
        carriedCodes.value = new Set()
        history.value = new Map()
      }
      patientNum.value = num
      // the page loads visits in the background after selecting the patient —
      // the cockpit needs the complete list before it can pick today's/last visit
      await Promise.all([loadTemplates(), loadOptionLists(), visitStore.loadVisitsForPatient(num)])
      const today = localDate()
      lastVisit.value = findLastVisit(visitStore.visits, today, 'any')
      const explicit = code ? templates.value.find((t) => t.code === code) : null
      const suggested = explicit || suggestNextTemplate(templates.value, lastVisit.value)
      const resolved = resolveTodayVisit(visitStore.visits, suggested, today)
      // an existing consultation today wins over the suggestion
      templateCode.value = resolved.templateCode || suggested?.code || templates.value[0]?.code || null
      await applyTodayVisit(resolved.visit, resolved.match)
      await loadCockpit()
    } catch (err) {
      error.value = err.message
      logger.error('Failed to open cockpit', err, { patientNum: num })
      throw err
    } finally {
      loading.value = false
    }
  }

  const applyTodayVisit = async (visit, match) => {
    todayMatch.value = match
    todayVisit.value = visit ? visitStore.visits.find((v) => v.id === visit.id) || visit : null
    if (todayVisit.value) {
      // the cockpit edits the globally selected visit (editor semantics)
      if (visitStore.selectedVisit?.id !== todayVisit.value.id) await visitObservationService.selectVisitAndLoadObservations(todayVisit.value)
      lastVisit.value = findLastVisit(visitStore.visits, todayVisit.value, template.value?.previousVisitScope || 'any')
    }
  }

  const setTemplate = async (code) => {
    if (!code || code === templateCode.value) return
    templateCode.value = code
    if (todayVisit.value) {
      // keep VISIT_BLOB in sync when the template is switched on an open visit
      const blob = parseVisitBlob(todayVisit.value)
      const tpl = template.value
      await visitStore.updateVisit(todayVisit.value.id, { VISIT_BLOB: JSON.stringify({ ...blob, consultTemplate: code, visitType: tpl?.visitType || blob.visitType }) })
      todayVisit.value = visitStore.visits.find((v) => v.id === todayVisit.value.id) || todayVisit.value
    }
    await loadCockpit()
  }

  /** "Visite beginnen": create today's visit from the template and select it. */
  const startConsultation = async ({ templateCode: code = null } = {}) => {
    if (patientNum.value == null) throw new Error('No patient')
    if (code) templateCode.value = code
    const tpl = template.value
    if (!tpl) throw new Error('No consultation template')
    const now = new Date()
    const created = await visitStore.createVisit({
      PATIENT_NUM: patientNum.value,
      START_DATE: `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      INOUT_CD: tpl.inoutCd || 'O',
      ACTIVE_STATUS_CD: 'SCTID: 55561003',
      LOCATION_CD: tpl.locationCd || 'AMBULANZ',
      VISIT_BLOB: JSON.stringify({ visitType: tpl.visitType, consultTemplate: tpl.code, notes: '', createdBy: 'CONSULT', createdAt: now.toISOString() }),
    })
    await visitStore.loadVisitsForPatient(patientNum.value)
    const id = created?.ENCOUNTER_NUM ?? created?.id
    const full = visitStore.visits.find((v) => v.id === id) || null
    carriedCodes.value = new Set()
    await applyTodayVisit(full, 'template')
    await loadCockpit()
    logger.info('Consultation started', { patientNum: patientNum.value, template: tpl.code, visitId: id })
    return todayVisit.value
  }

  /** Mark an existing untyped visit of today as this consultation. */
  const adoptTodayVisit = async (visit) => {
    const blob = parseVisitBlob(visit)
    await visitStore.updateVisit(visit.id, { VISIT_BLOB: JSON.stringify({ ...blob, consultTemplate: templateCode.value, visitType: template.value?.visitType || blob.visitType }) })
    await applyTodayVisit(visitStore.visits.find((v) => v.id === visit.id) || visit, 'template')
    await loadCockpit()
  }

  /** (Re)load every panel for the current state. */
  const loadCockpit = async () => {
    if (patientNum.value == null || !template.value) return
    const codes = [...template.value.scoreConcepts.map((s) => s.code), ...template.value.textConcepts.map((t) => t.code), ...template.value.contextConcepts, LEDD_CONCEPT]
    const [rows, medHistory, lettersList] = await Promise.all([
      observationStore.getObservationHistory({ patientNum: patientNum.value, conceptCodes: codes }),
      medicationsStore.getMedicationHistoryForPatient(patientNum.value),
      dbStore.getRepository('consult')?.getLetters(patientNum.value) ?? [],
    ])
    const map = new Map()
    for (const r of rows) {
      if (!map.has(r.conceptCode)) map.set(r.conceptCode, [])
      map.get(r.conceptCode).push(r)
    }
    history.value = map
    letters.value = lettersList
    applyMedicationHistory(medHistory)
    await refreshDiagnoses()
  }

  function applyMedicationHistory(medHistory) {
    const byVisit = new Map((medHistory || []).map((h) => [h.encounterNum, h]))
    const todayId = todayVisit.value?.id ?? null
    const todayDate = todayVisit.value?.date || localDate()
    // reference = last visit strictly before the shown visit that has medication
    const earlier = (medHistory || []).filter((h) => h.encounterNum !== todayId && (h.visitDate < String(todayDate).slice(0, 10) || (h.visitDate === String(todayDate).slice(0, 10) && todayId != null && h.encounterNum < todayId)))
    const lastWithMeds = earlier.length ? earlier[earlier.length - 1] : null
    if (todayId != null) {
      medicationVisitId.value = todayId
      medications.value = byVisit.get(todayId)?.medications || []
      previousMedicationVisitId.value = lastWithMeds?.encounterNum ?? null
      previousMedications.value = lastWithMeds?.medications || []
    } else {
      medicationVisitId.value = lastWithMeds?.encounterNum ?? null
      medications.value = lastWithMeds?.medications || []
      const before = earlier.slice(0, -1)
      const prev = before.length ? before[before.length - 1] : null
      previousMedicationVisitId.value = prev?.encounterNum ?? null
      previousMedications.value = prev?.medications || []
    }
  }

  const refreshMedications = async () => {
    if (patientNum.value == null) return
    applyMedicationHistory(await medicationsStore.getMedicationHistoryForPatient(patientNum.value))
    if (todayVisit.value) await recomputeLEDD()
  }

  const refreshDiagnoses = async () => {
    const repo = dbStore.getRepository('diagnosis')
    if (!repo) return
    const shownId = todayVisit.value?.id ?? lastVisit.value?.id ?? null
    const prevId = todayVisit.value ? (lastVisit.value?.id ?? null) : null
    problemList.value = shownId != null ? await repo.getProblemList(shownId) : []
    previousProblemList.value = prevId != null ? await repo.getProblemList(prevId) : []
    // no diagnoses yet today but a problem list at the last visit → show it greyed as "Stand letzte Visite"
    if (todayVisit.value && !problemList.value.length && previousProblemList.value.length) problemList.value = previousProblemList.value.map((d) => ({ ...d, inherited: true }))
  }

  // ---- writes: texts -------------------------------------------------------
  const requireToday = () => {
    if (!todayVisit.value) throw new Error('Keine heutige Visite — zuerst „Visite beginnen"')
    return todayVisit.value
  }

  const saveText = async (conceptCode, value) => {
    const visit = requireToday()
    const text = value == null ? '' : String(value)
    const cur = todayRow(conceptCode)
    if (cur?.observationId) {
      await visitObservationService.updateObservation(cur.observationId, buildObservationUpdate('T', text), { skipReload: true })
      cur.value = text
      cur.updatedAt = new Date().toISOString()
    } else {
      const tpl = template.value?.textConcepts.find((t) => t.code === conceptCode)
      const created = await visitObservationService.createObservation(buildNewObservationData({ patientNum: patientNum.value, encounterNum: visit.id, concept: { code: conceptCode, name: tpl?.label || conceptCode, valueType: 'T' }, value: text, visitDate: visit.date }), { skipReload: true })
      const row = { observationId: created?.OBSERVATION_ID ?? created?.observationId ?? null, encounterNum: visit.id, conceptCode, valueType: 'T', value: text, numericValue: null, unit: null, valueFlag: null, instanceNum: 1, visitDate: String(visit.date).slice(0, 10), date: visit.date, providerId: authStore.providerId, updatedAt: new Date().toISOString() }
      const next = new Map(history.value)
      next.set(conceptCode, [row, ...(next.get(conceptCode) || [])])
      history.value = next
    }
    if (carriedCodes.value.has(conceptCode)) {
      const src = previousRows(conceptCode)[0]
      if (!src || src.value !== text) {
        const s = new Set(carriedCodes.value)
        s.delete(conceptCode)
        carriedCodes.value = s
      }
    }
    await observationStore.loadObservationsForVisit(visit.id)
  }

  /** Copy the newest earlier text into today's field (replace) or append it with a date line. */
  const carryForwardText = async (conceptCode, { mode = 'replace', fromObservationId = null } = {}) => {
    requireToday()
    const src = fromObservationId ? rowsFor(conceptCode).find((r) => r.observationId === fromObservationId) : previousRows(conceptCode).find((r) => r.value && r.value.trim())
    if (!src) return null
    const cur = todayRow(conceptCode)?.value || ''
    const text = mode === 'append' && cur.trim() ? `${cur.trimEnd()}\n\n--- ${formatDate(src.visitDate)} ---\n${src.value}` : src.value
    await saveText(conceptCode, text)
    const s = new Set(carriedCodes.value)
    s.add(conceptCode)
    carriedCodes.value = s
    return src
  }

  // ---- writes: scores / context -------------------------------------------
  const setScoreValue = async (conceptCode, value) => {
    const visit = requireToday()
    const cur = todayRow(conceptCode)
    const numeric = value === '' || value == null ? null : Number(value)
    if (cur?.observationId) {
      await visitObservationService.updateObservation(cur.observationId, buildObservationUpdate('N', numeric), { skipReload: true })
      cur.numericValue = numeric
    } else {
      const meta = template.value?.scoreConcepts.find((s) => s.code === conceptCode)
      const created = await visitObservationService.createObservation(buildNewObservationData({ patientNum: patientNum.value, encounterNum: visit.id, concept: { code: conceptCode, name: meta?.short || conceptCode, valueType: 'N' }, value: numeric, visitDate: visit.date }), { skipReload: true })
      const next = new Map(history.value)
      next.set(conceptCode, [{ observationId: created?.OBSERVATION_ID ?? null, encounterNum: visit.id, conceptCode, valueType: 'N', value: null, numericValue: numeric, unit: null, valueFlag: null, visitDate: String(visit.date).slice(0, 10), date: visit.date }, ...(next.get(conceptCode) || [])])
      history.value = next
    }
    await observationStore.loadObservationsForVisit(visit.id)
  }

  const setContextValue = async (conceptCode, optionCode, valueType = 'S') => {
    const visit = requireToday()
    const cur = todayRow(conceptCode)
    if (cur?.observationId) {
      await visitObservationService.updateObservation(cur.observationId, buildObservationUpdate(valueType, optionCode), { skipReload: true })
      cur.value = optionCode
    } else {
      const created = await visitObservationService.createObservation(buildNewObservationData({ patientNum: patientNum.value, encounterNum: visit.id, concept: { code: conceptCode, valueType }, value: optionCode, visitDate: visit.date }), { skipReload: true })
      const next = new Map(history.value)
      next.set(conceptCode, [{ observationId: created?.OBSERVATION_ID ?? null, encounterNum: visit.id, conceptCode, valueType, value: optionCode, numericValue: null, visitDate: String(visit.date).slice(0, 10), date: visit.date }, ...(next.get(conceptCode) || [])])
      history.value = next
    }
    await observationStore.loadObservationsForVisit(visit.id)
  }

  /** Reload the history rows of a few concepts (after a questionnaire was filled). */
  const refreshConcepts = async (conceptCodes) => {
    if (patientNum.value == null || !conceptCodes?.length) return
    const rows = await observationStore.getObservationHistory({ patientNum: patientNum.value, conceptCodes })
    const next = new Map(history.value)
    for (const code of conceptCodes) next.set(code, rows.filter((r) => r.conceptCode === code))
    history.value = next
  }

  // ---- writes: LEDD --------------------------------------------------------
  /** Persist the computed LEDD of today's visit as NEURO:SCORE:LEDD (manual values are respected). */
  const recomputeLEDD = async () => {
    if (!todayVisit.value || !template.value?.medication?.ledd) return null
    const result = ledd.value
    const cur = todayRow(LEDD_CONCEPT)
    const manual = cur && !isComputedBlob(cur.blob)
    if (manual) return { manual: true, value: cur.numericValue }
    if (!result || (result.total === 0 && !cur)) return null
    const blob = JSON.stringify({ computed: true, version: result.version, computedAt: new Date().toISOString(), levodopaSubtotal: result.levodopaSubtotal, breakdown: result.breakdown, unresolved: result.unresolved })
    if (cur?.observationId) {
      await visitObservationService.updateObservation(cur.observationId, { NVAL_NUM: result.total, OBSERVATION_BLOB: blob, VALUEFLAG_CD: null }, { skipReload: true })
      cur.numericValue = result.total
      cur.blob = blob
    } else {
      const data = { ...buildNewObservationData({ patientNum: patientNum.value, encounterNum: todayVisit.value.id, concept: { code: LEDD_CONCEPT, name: 'LEDD', valueType: 'N', unit: 'mg/d' }, value: result.total, visitDate: todayVisit.value.date }), OBSERVATION_BLOB: blob, UNIT_CD: 'mg/d' }
      const created = await visitObservationService.createObservation(data, { skipReload: true })
      const next = new Map(history.value)
      next.set(LEDD_CONCEPT, [{ observationId: created?.OBSERVATION_ID ?? null, encounterNum: todayVisit.value.id, conceptCode: LEDD_CONCEPT, valueType: 'N', numericValue: result.total, unit: 'mg/d', blob, visitDate: String(todayVisit.value.date).slice(0, 10), date: todayVisit.value.date }, ...(next.get(LEDD_CONCEPT) || [])])
      history.value = next
    }
    return { manual: false, value: result.total }
  }

  // ---- writes: medication / diagnoses --------------------------------------
  const carryForwardMedications = async () => {
    const visit = requireToday()
    if (previousMedicationVisitId.value == null) return { created: [], skipped: [] }
    const r = await medicationsStore.carryForwardMedications({ fromEncounter: previousMedicationVisitId.value, toEncounter: visit.id, patientNum: patientNum.value, visitDate: visit.date })
    await refreshMedications()
    await observationStore.loadObservationsForVisit(visit.id)
    return r
  }

  const upsertDiagnosis = async (payload) => {
    const visit = requireToday()
    const repo = dbStore.getRepository('diagnosis')
    const row = await repo.upsertDiagnosis({ ...payload, patientNum: patientNum.value, encounterNum: visit.id, providerId: authStore.providerId, visitDate: visit.date })
    await refreshDiagnoses()
    await observationStore.loadObservationsForVisit(visit.id)
    return row
  }

  const deleteDiagnosis = async (observationId) => {
    const visit = requireToday()
    await dbStore.getRepository('diagnosis').deleteDiagnosis(observationId)
    await refreshDiagnoses()
    await observationStore.loadObservationsForVisit(visit.id)
  }

  const carryForwardDiagnoses = async () => {
    const visit = requireToday()
    if (!lastVisit.value) return { created: 0, skipped: 0 }
    const r = await dbStore.getRepository('diagnosis').carryForward({ fromEncounter: lastVisit.value.id, toEncounter: visit.id, patientNum: patientNum.value, providerId: authStore.providerId, visitDate: visit.date })
    await refreshDiagnoses()
    await observationStore.loadObservationsForVisit(visit.id)
    return r
  }

  /** Everything the template allows in one go (after "Visite beginnen"). */
  const carryForwardAll = async () => {
    const tpl = template.value
    const out = { diagnoses: null, medications: null, texts: [] }
    if (tpl?.diagnosis?.carryForward) out.diagnoses = await carryForwardDiagnoses()
    if (tpl?.medication?.carryForward) out.medications = await carryForwardMedications()
    for (const t of tpl?.textConcepts || []) if (t.carryForward && !todayRow(t.code)?.value) out.texts.push({ code: t.code, source: await carryForwardText(t.code) })
    return out
  }

  // ---- search / letters ----------------------------------------------------
  const searchIcd10 = async (term) => dbStore.getRepository('diagnosis')?.searchIcd10(term) ?? []

  const search = async (term) => {
    if (patientNum.value == null) return []
    return dbStore.getRepository('consult').searchPatientText(patientNum.value, term)
  }

  const saveLetter = async ({ html, title = null, sections = [], snapshot = {} }) => {
    const visit = requireToday()
    const letter = await dbStore.getRepository('consult').saveLetter({ patientNum: patientNum.value, encounterNum: visit.id, template: templateCode.value, title, html, sections, snapshot, userCd: authStore.providerId })
    letters.value = await dbStore.getRepository('consult').getLetters(patientNum.value)
    return letter
  }

  const reset = () => {
    patientNum.value = null
    templateCode.value = null
    todayVisit.value = null
    todayMatch.value = 'none'
    lastVisit.value = null
    problemList.value = []
    previousProblemList.value = []
    medications.value = []
    previousMedications.value = []
    medicationVisitId.value = null
    previousMedicationVisitId.value = null
    history.value = new Map()
    letters.value = []
    carriedCodes.value = new Set()
    error.value = null
  }

  return {
    // state
    patientNum,
    templates,
    templateCode,
    template,
    todayVisit,
    todayMatch,
    lastVisit,
    problemList,
    previousProblemList,
    medications,
    medicationVisitId,
    previousMedications,
    previousMedicationVisitId,
    history,
    letters,
    drugOptions,
    frequencyOptions,
    carriedCodes,
    loading,
    error,
    // getters
    isEditable,
    daysSinceLastVisit,
    isStale,
    ledd,
    previousLedd,
    medicationDiff,
    scoreStrip,
    textSections,
    contextValues,
    checklist,
    rowsFor,
    todayRow,
    previousRows,
    // actions
    loadTemplates,
    openCockpit,
    setTemplate,
    startConsultation,
    adoptTodayVisit,
    loadCockpit,
    refreshMedications,
    refreshDiagnoses,
    refreshConcepts,
    saveText,
    carryForwardText,
    setScoreValue,
    setContextValue,
    recomputeLEDD,
    carryForwardMedications,
    upsertDiagnosis,
    deleteDiagnosis,
    carryForwardDiagnoses,
    carryForwardAll,
    search,
    searchIcd10,
    saveLetter,
    reset,
  }
})

function parseVisitBlob(visit) {
  const raw = visit?.rawData?.VISIT_BLOB
  if (!raw) return { visitType: visit?.visitType, notes: visit?.notes || '' }
  try {
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

function isComputedBlob(blob) {
  if (!blob) return false
  try {
    return !!(typeof blob === 'string' ? JSON.parse(blob) : blob)?.computed
  } catch {
    return false
  }
}

function formatDate(iso) {
  const s = String(iso || '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s
}
