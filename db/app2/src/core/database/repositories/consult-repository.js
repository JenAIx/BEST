/**
 * ConsultRepository — cross-visit reads for the Visitenmodus (text history,
 * full-text search over a patient's record) and the doctor's letter
 * (NOTE_FACT, CATEGORY_CHAR 'LETTER').
 */
import BaseRepository from './base-repository.js'

export const LETTER_CATEGORY = 'LETTER'

class ConsultRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'NOTE_FACT', 'NOTE_ID')
  }

  async _query(sql, params = []) {
    const r = await this.connection.executeQuery(sql, params)
    if (!r.success) throw new Error(r.error || 'Consult query failed')
    return r.data || []
  }

  /**
   * Every observation of the given concepts across all visits of a patient,
   * newest visit first. Dedicated query (no 1000-row cap, joins the visit
   * date) — the basis for text history, score series and "letztes Mal".
   */
  async getObservationHistory({ patientNum, conceptCodes }) {
    const codes = [...new Set((conceptCodes || []).filter(Boolean))]
    if (patientNum == null || !codes.length) return []
    const rows = await this._query(
      `SELECT o.OBSERVATION_ID, o.ENCOUNTER_NUM, o.CONCEPT_CD, o.VALTYPE_CD, o.TVAL_CHAR, o.NVAL_NUM, o.UNIT_CD, o.VALUEFLAG_CD, o.INSTANCE_NUM,
              o.START_DATE AS OBS_DATE, v.START_DATE AS VISIT_DATE, o.PROVIDER_ID, o.UPDATE_DATE,
              CASE WHEN o.VALTYPE_CD IN ('S','F','A') THEN c.NAME_CHAR ELSE NULL END AS TVAL_RESOLVED,
              CASE WHEN o.VALTYPE_CD = 'R' THEN NULL ELSE o.OBSERVATION_BLOB END AS OBSERVATION_BLOB
         FROM OBSERVATION_FACT o
         JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
         LEFT JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD = o.TVAL_CHAR
        WHERE o.PATIENT_NUM = ? AND o.CONCEPT_CD IN (${codes.map(() => '?').join(',')})
        ORDER BY v.START_DATE DESC, o.ENCOUNTER_NUM DESC, o.INSTANCE_NUM ASC, o.OBSERVATION_ID ASC`,
      [patientNum, ...codes],
    )
    return rows.map((r) => ({
      observationId: r.OBSERVATION_ID,
      encounterNum: r.ENCOUNTER_NUM,
      conceptCode: r.CONCEPT_CD,
      valueType: r.VALTYPE_CD,
      value: r.TVAL_CHAR,
      resolvedValue: r.TVAL_RESOLVED,
      numericValue: r.NVAL_NUM,
      unit: r.UNIT_CD,
      valueFlag: r.VALUEFLAG_CD || null,
      instanceNum: r.INSTANCE_NUM ?? 1,
      visitDate: String(r.VISIT_DATE || '').slice(0, 10),
      date: r.OBS_DATE,
      providerId: r.PROVIDER_ID,
      updatedAt: r.UPDATE_DATE,
      blob: r.OBSERVATION_BLOB,
    }))
  }

  /**
   * Full-text search over a patient's record: text/coded observations,
   * medication + diagnosis blobs, quick notes and letters.
   * @returns {Promise<Array<{kind:'text'|'medication'|'diagnosis'|'note'|'letter', encounterNum:number|null, visitDate:string|null, conceptCode:string|null, observationId:number|null, noteId:number|null, snippet:string, text:string}>>}
   */
  async searchPatientText(patientNum, term, { limit = 100 } = {}) {
    const t = String(term || '').trim()
    if (patientNum == null || t.length < 2) return []
    const like = `%${t}%`
    const obs = await this._query(
      `SELECT o.OBSERVATION_ID, o.ENCOUNTER_NUM, o.CONCEPT_CD, o.VALTYPE_CD, o.TVAL_CHAR, v.START_DATE,
              CASE WHEN o.VALTYPE_CD = 'R' THEN NULL ELSE CAST(o.OBSERVATION_BLOB AS TEXT) END AS BLOB_TEXT
         FROM OBSERVATION_FACT o
         JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
        WHERE o.PATIENT_NUM = ? AND o.VALTYPE_CD IN ('T','S','M')
          AND (o.TVAL_CHAR LIKE ? OR (o.VALTYPE_CD IN ('M','S') AND CAST(o.OBSERVATION_BLOB AS TEXT) LIKE ?))
        ORDER BY v.START_DATE DESC
        LIMIT ?`,
      [patientNum, like, like, limit],
    )
    const notes = await this._query(
      `SELECT n.NOTE_ID, n.ENCOUNTER_NUM, n.CATEGORY_CHAR, n.NAME_CHAR, n.NOTE_TEXT, v.START_DATE
         FROM NOTE_FACT n
         LEFT JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = n.ENCOUNTER_NUM
        WHERE n.PATIENT_NUM = ? AND n.CATEGORY_CHAR IN ('QUICK_NOTE', ?) AND (n.NOTE_TEXT LIKE ? OR n.NAME_CHAR LIKE ?)
        ORDER BY n.NOTE_ID DESC
        LIMIT ?`,
      [patientNum, LETTER_CATEGORY, like, like, limit],
    )
    const hits = []
    for (const r of obs) {
      const kind = r.VALTYPE_CD === 'M' ? 'medication' : r.CONCEPT_CD === 'SCTID: 8319008' || r.CONCEPT_CD === 'NEURO:DX:SECONDARY' ? 'diagnosis' : 'text'
      let text = r.TVAL_CHAR || ''
      if (kind !== 'text' && r.BLOB_TEXT) {
        try {
          const b = JSON.parse(r.BLOB_TEXT)
          text = [b.drugName, b.text, b.icd, b.instructions, r.TVAL_CHAR].filter(Boolean).join(' · ')
        } catch {
          text = r.TVAL_CHAR || ''
        }
      }
      hits.push({ kind, encounterNum: r.ENCOUNTER_NUM, visitDate: String(r.START_DATE || '').slice(0, 10), conceptCode: r.CONCEPT_CD, observationId: r.OBSERVATION_ID, noteId: null, text, snippet: snippet(text, t) })
    }
    for (const n of notes) {
      const text = n.CATEGORY_CHAR === LETTER_CATEGORY ? stripHtml(n.NOTE_TEXT || '') : n.NOTE_TEXT || ''
      hits.push({ kind: n.CATEGORY_CHAR === LETTER_CATEGORY ? 'letter' : 'note', encounterNum: n.ENCOUNTER_NUM, visitDate: String(n.START_DATE || '').slice(0, 10) || null, conceptCode: null, observationId: null, noteId: n.NOTE_ID, text: n.NAME_CHAR ? `${n.NAME_CHAR}: ${text}` : text, snippet: snippet(text, t) })
    }
    return hits.sort((a, b) => String(b.visitDate || '').localeCompare(String(a.visitDate || ''))).slice(0, limit)
  }

  /** Persist a generated letter (HTML) as a NOTE_FACT document of the visit. */
  async saveLetter({ patientNum, encounterNum, template = null, title = null, html, sections = [], snapshot = {}, userCd = null }) {
    if (patientNum == null || encounterNum == null || !html) throw new Error('saveLetter needs patientNum, encounterNum and html')
    const date = new Date().toISOString().slice(0, 10)
    const name = title || `Arztbrief ${date}${template ? ` · ${template}` : ''}`
    const blob = JSON.stringify({ template, generatedAt: new Date().toISOString(), generatedBy: userCd, sections, snapshot })
    const r = await this.connection.executeCommand(
      `INSERT INTO NOTE_FACT (CATEGORY_CHAR, NAME_CHAR, NOTE_TEXT, NOTE_BLOB, PATIENT_NUM, ENCOUNTER_NUM, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'CONSULT', 1)`,
      [LETTER_CATEGORY, name, html, blob, patientNum, encounterNum],
    )
    if (!r.success) throw new Error(r.error || 'Failed to save letter')
    const id = r.lastID ?? r.lastId
    return (await this.getLetters(patientNum, { encounterNum })).find((l) => l.noteId === id) || null
  }

  /** Letters of a patient (optionally one visit), newest first, HTML included. */
  async getLetters(patientNum, { encounterNum = null } = {}) {
    if (patientNum == null) return []
    const rows = await this._query(
      `SELECT n.NOTE_ID, n.NAME_CHAR, n.NOTE_TEXT, n.NOTE_BLOB, n.ENCOUNTER_NUM, n.UPDATE_DATE, v.START_DATE
         FROM NOTE_FACT n LEFT JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = n.ENCOUNTER_NUM
        WHERE n.PATIENT_NUM = ? AND n.CATEGORY_CHAR = ?${encounterNum != null ? ' AND n.ENCOUNTER_NUM = ?' : ''}
        ORDER BY n.NOTE_ID DESC`,
      encounterNum != null ? [patientNum, LETTER_CATEGORY, encounterNum] : [patientNum, LETTER_CATEGORY],
    )
    return rows.map((r) => {
      let meta = {}
      try {
        meta = JSON.parse(r.NOTE_BLOB || '{}') || {}
      } catch {
        meta = {}
      }
      return { noteId: r.NOTE_ID, title: r.NAME_CHAR, html: r.NOTE_TEXT, encounterNum: r.ENCOUNTER_NUM, visitDate: String(r.START_DATE || '').slice(0, 10) || null, createdAt: meta.generatedAt || r.UPDATE_DATE, createdBy: meta.generatedBy || null, template: meta.template || null, sections: meta.sections || [], snapshot: meta.snapshot || {} }
    })
  }

  async deleteLetter(noteId) {
    const r = await this.connection.executeCommand('DELETE FROM NOTE_FACT WHERE NOTE_ID = ? AND CATEGORY_CHAR = ?', [noteId, LETTER_CATEGORY])
    if (!r.success) throw new Error(r.error || 'Failed to delete letter')
    return (r.changes ?? 0) > 0
  }
}

function stripHtml(html) {
  return String(html).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function snippet(text, term, radius = 60) {
  const s = String(text || '')
  const i = s.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return s.slice(0, radius * 2)
  const start = Math.max(0, i - radius)
  const end = Math.min(s.length, i + term.length + radius)
  return (start > 0 ? '…' : '') + s.slice(start, end) + (end < s.length ? '…' : '')
}

export default ConsultRepository
