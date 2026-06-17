// Singleton-Service für den Patienten-/Visiten-Workflow.
// Muster wie src/tools/Storage.js: reaktive In-Memory-Arrays als Wahrheit,
// IndexedDB-Writes fire-and-forget (.catch). Im Node-Test-Env schlagen die
// DB-Writes still fehl — Tests laufen gegen die In-Memory-Arrays.

import { reactive } from 'vue'
import { db } from '../db'
import { log } from '../Logger'
import { uuidv4 } from '../hhash'
import { buildImportStructure } from '../export_app2'
import {
  createVisitFromTemplate,
  createVisitSlot,
  recomputeVisitStatus,
  visitProgress,
} from './visit-model'

class VisitMan {
  _PATIENTS = reactive([])
  _TEMPLATES = reactive([])
  _VISITS = reactive([])

  constructor() {
    log({ debug: 'VisitMan: init' })
  }

  async init() {
    log({ debug: 'VisitMan>init: loading from IndexedDB' })
    try {
      const [patients, templates, visits] = await Promise.all([
        db.patients.toArray(),
        db.visitTemplates.toArray(),
        db.visits.toArray(),
      ])
      this._PATIENTS.splice(0, this._PATIENTS.length, ...(patients || []))
      this._TEMPLATES.splice(0, this._TEMPLATES.length, ...(templates || []))
      this._VISITS.splice(0, this._VISITS.length, ...(visits || []))
    } catch (e) {
      log({ error: 'VisitMan>init: IndexedDB read failed', data: e })
    }
  }

  // ---- Persistenz-Helfer (fire-and-forget, deep-clone gegen reactive proxy) ----
  _persist(table, obj) {
    db[table].put(JSON.parse(JSON.stringify(obj))).catch((e) =>
      log({ error: `VisitMan>persist ${table} failed`, data: e })
    )
  }

  _remove(table, id) {
    db[table].delete(id).catch((e) =>
      log({ error: `VisitMan>delete ${table} failed`, data: e })
    )
  }

  // ============================ PATIENTS ============================
  get patients() {
    return this._PATIENTS
  }

  get_patient(id) {
    return this._PATIENTS.find((p) => p.id === id)
  }

  get_patient_by_pid(pid) {
    return this._PATIENTS.find((p) => p.pid === pid)
  }

  add_patient(pid, extra = {}) {
    const now = Date.now()
    const patient = {
      id: uuidv4(),
      pid,
      note: extra.note || null,
      birthDate: extra.birthDate || null,
      sex: extra.sex || null,
      created: now,
      updated: now,
    }
    this._PATIENTS.push(patient)
    this._persist('patients', patient)
    return patient
  }

  update_patient(id, changes) {
    const p = this.get_patient(id)
    if (!p) return undefined
    Object.assign(p, changes, { updated: Date.now() })
    this._persist('patients', p)
    return p
  }

  // Löscht einen Patienten samt aller Visiten (Kaskade).
  remove_patient(id) {
    const idx = this._PATIENTS.findIndex((p) => p.id === id)
    if (idx === -1) return false
    this._PATIENTS.splice(idx, 1)
    this._remove('patients', id)
    this.get_visits_for_patient(id)
      .map((v) => v.id)
      .forEach((vid) => this.remove_visit(vid))
    return true
  }

  // ============================ TEMPLATES ============================
  get templates() {
    return this._TEMPLATES
  }

  get_template(id) {
    return this._TEMPLATES.find((t) => t.id === id)
  }

  add_template(label, questionnaires = []) {
    const tpl = {
      id: uuidv4(),
      label: label || 'Vorlage',
      questionnaires: [...questionnaires],
      created: Date.now(),
    }
    this._TEMPLATES.push(tpl)
    this._persist('visitTemplates', tpl)
    return tpl
  }

  update_template(id, changes) {
    const t = this.get_template(id)
    if (!t) return undefined
    Object.assign(t, changes)
    this._persist('visitTemplates', t)
    return t
  }

  remove_template(id) {
    const idx = this._TEMPLATES.findIndex((t) => t.id === id)
    if (idx === -1) return false
    this._TEMPLATES.splice(idx, 1)
    this._remove('visitTemplates', id)
    return true
  }

  // ============================ VISITS ============================
  get visits() {
    return this._VISITS
  }

  get_visit(id) {
    return this._VISITS.find((v) => v.id === id)
  }

  get_visits_for_patient(patientId) {
    return this._VISITS.filter((v) => v.patientId === patientId)
  }

  progress(visitId) {
    return visitProgress(this.get_visit(visitId))
  }

  // Visite aus Vorlage (oder leer, wenn templateId == null) anlegen.
  add_visit(patientId, templateId = null, date = null) {
    const template = templateId ? this.get_template(templateId) : null
    const visit = createVisitFromTemplate(template, patientId, date || Date.now())
    visit.id = uuidv4()
    this._VISITS.push(visit)
    this._persist('visits', visit)
    return visit
  }

  update_visit(id, changes) {
    const v = this.get_visit(id)
    if (!v) return undefined
    Object.assign(v, changes)
    this._persist('visits', v)
    return v
  }

  remove_visit(id) {
    const idx = this._VISITS.findIndex((v) => v.id === id)
    if (idx === -1) return false
    this._VISITS.splice(idx, 1)
    this._remove('visits', id)
    return true
  }

  // Ad-hoc Fragebogen-Slot zu einer Visite ergänzen (keine Duplikate).
  add_questionnaire(visitId, short_title) {
    const visit = this.get_visit(visitId)
    if (!visit) return undefined
    if (visit.items.some((i) => i.short_title === short_title)) return visit
    visit.items.push(createVisitSlot(short_title))
    recomputeVisitStatus(visit)
    this._persist('visits', visit)
    return visit
  }

  remove_questionnaire(visitId, short_title) {
    const visit = this.get_visit(visitId)
    if (!visit) return undefined
    const idx = visit.items.findIndex((i) => i.short_title === short_title)
    if (idx === -1) return visit
    visit.items.splice(idx, 1)
    recomputeVisitStatus(visit)
    this._persist('visits', visit)
    return visit
  }

  get_slot(visitId, short_title) {
    const visit = this.get_visit(visitId)
    if (!visit) return undefined
    return visit.items.find((i) => i.short_title === short_title)
  }

  // ---- Entwurf speichern (rohe item.value je Index; keine Logikprüfung) ----
  save_draft(visitId, short_title, values) {
    const visit = this.get_visit(visitId)
    if (!visit) return undefined
    const slot = visit.items.find((i) => i.short_title === short_title)
    if (!slot) return undefined
    slot.draft = { values: JSON.parse(JSON.stringify(values || [])) }
    if (slot.status !== 'completed') slot.status = 'draft'
    if (!slot.date_start) slot.date_start = Date.now()
    recomputeVisitStatus(visit)
    this._persist('visits', visit)
    return slot
  }

  // ---- Abschließen: summary (für Export) + rohe values (zum Wieder-Editieren) ----
  complete_questionnaire(visitId, short_title, summary, values) {
    const visit = this.get_visit(visitId)
    if (!visit) return undefined
    const slot = visit.items.find((i) => i.short_title === short_title)
    if (!slot) return undefined
    slot.response = JSON.parse(JSON.stringify(summary))
    if (values !== undefined) slot.draft = { values: JSON.parse(JSON.stringify(values)) }
    slot.status = 'completed'
    slot.date_start = slot.date_start || summary.date_start || Date.now()
    slot.date_end = summary.date_end || Date.now()
    recomputeVisitStatus(visit)
    this._persist('visits', visit)
    return slot
  }

  // ============================ EXPORT (app2-importStructure) ============================
  _visit_export_entry(visit) {
    const summaries = visit.items
      .filter((i) => i.status === 'completed' && i.response)
      .map((i) => i.response)
    return { visit, summaries }
  }

  build_visit_export(visitId, exportDate) {
    const visit = this.get_visit(visitId)
    if (!visit) return undefined
    const patient = this.get_patient(visit.patientId)
    if (!patient) return undefined
    return buildImportStructure(
      [{ patient, visits: [this._visit_export_entry(visit)] }],
      exportDate
    )
  }

  build_patient_export(patientId, exportDate) {
    const patient = this.get_patient(patientId)
    if (!patient) return undefined
    const visits = this.get_visits_for_patient(patientId).map((v) => this._visit_export_entry(v))
    return buildImportStructure([{ patient, visits }], exportDate)
  }

  // Markiert eine Visite als exportiert (Badge in der UI).
  mark_exported(visitId) {
    const visit = this.get_visit(visitId)
    if (!visit) return undefined
    visit.exportedAt = Date.now()
    this._persist('visits', visit)
    return visit
  }
}

export const VISITMAN = new VisitMan()
export { VisitMan }
