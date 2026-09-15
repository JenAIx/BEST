/**
 * DiagnosisRepository — the per-visit problem list of the Visitenmodus.
 *
 * Storage contract (CLAUDE.md §"Diagnoses"):
 *   Hauptdiagnose  CONCEPT_CD 'SCTID: 8319008'   S  INSTANCE_NUM 1
 *   Nebendiagnose  CONCEPT_CD 'NEURO:DX:SECONDARY' S INSTANCE_NUM 1..n (order)
 *   TVAL_CHAR = ICD-10 concept code ('ICD10: G20') when coded, else the free
 *   text; OBSERVATION_BLOB = {icd, text, since, status, laterality, order,
 *   carriedFrom}. Status lives in the blob only — VALUEFLAG_CD stays the
 *   NV/AUDIT/CONFIRMED state machine.
 */
import BaseRepository from './base-repository.js'

export const PRIMARY_DX = 'SCTID: 8319008'
export const SECONDARY_DX = 'NEURO:DX:SECONDARY'
export const DX_STATUSES = ['aktiv', 'verdacht', 'inaktiv']

const parseBlob = (text) => {
  if (!text) return {}
  if (typeof text === 'object') return text
  try {
    return JSON.parse(text) || {}
  } catch {
    return {}
  }
}

export function rowToDiagnosis(row) {
  const blob = parseBlob(row.OBSERVATION_BLOB)
  const tval = row.TVAL_CHAR || ''
  const coded = /^ICD10: /.test(tval) || /^SCTID: /.test(tval)
  return {
    observationId: row.OBSERVATION_ID,
    encounterNum: row.ENCOUNTER_NUM,
    patientNum: row.PATIENT_NUM,
    conceptCode: row.CONCEPT_CD,
    kind: row.CONCEPT_CD === PRIMARY_DX ? 'primary' : 'secondary',
    instanceNum: row.INSTANCE_NUM ?? 1,
    icd: blob.icd || (coded ? tval : null),
    icdName: row.TVAL_RESOLVED || null,
    text: blob.text || (coded ? row.TVAL_RESOLVED || tval : tval),
    since: blob.since || null,
    status: DX_STATUSES.includes(blob.status) ? blob.status : 'aktiv',
    laterality: blob.laterality || null,
    order: blob.order ?? row.INSTANCE_NUM ?? 1,
    carriedFrom: blob.carriedFrom || null,
    visitDate: row.START_DATE || null,
  }
}

class DiagnosisRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'OBSERVATION_FACT', 'OBSERVATION_ID')
  }

  async _query(sql, params = []) {
    const r = await this.connection.executeQuery(sql, params)
    if (!r.success) throw new Error(r.error || 'Diagnosis query failed')
    return r.data || []
  }

  async _command(sql, params = []) {
    const r = await this.connection.executeCommand(sql, params)
    if (!r.success) throw new Error(r.error || 'Diagnosis command failed')
    return r
  }

  /** Problem list of one visit: primary first, then secondary by INSTANCE_NUM. */
  async getProblemList(encounterNum) {
    if (encounterNum == null) return []
    const rows = await this._query(
      `SELECT o.OBSERVATION_ID, o.ENCOUNTER_NUM, o.PATIENT_NUM, o.CONCEPT_CD, o.INSTANCE_NUM, o.TVAL_CHAR, o.OBSERVATION_BLOB, o.START_DATE,
              c.NAME_CHAR AS TVAL_RESOLVED
         FROM OBSERVATION_FACT o
         LEFT JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD = o.TVAL_CHAR
        WHERE o.ENCOUNTER_NUM = ? AND o.CONCEPT_CD IN (?, ?)
        ORDER BY CASE WHEN o.CONCEPT_CD = ? THEN 0 ELSE 1 END, o.INSTANCE_NUM ASC, o.OBSERVATION_ID ASC`,
      [encounterNum, PRIMARY_DX, SECONDARY_DX, PRIMARY_DX],
    )
    return rows.map(rowToDiagnosis)
  }

  /** Every visit's problem list of a patient, oldest first. */
  async getDiagnosisHistory(patientNum) {
    if (patientNum == null) return []
    const rows = await this._query(
      `SELECT o.OBSERVATION_ID, o.ENCOUNTER_NUM, o.PATIENT_NUM, o.CONCEPT_CD, o.INSTANCE_NUM, o.TVAL_CHAR, o.OBSERVATION_BLOB, v.START_DATE,
              c.NAME_CHAR AS TVAL_RESOLVED
         FROM OBSERVATION_FACT o
         JOIN VISIT_DIMENSION v ON v.ENCOUNTER_NUM = o.ENCOUNTER_NUM
         LEFT JOIN CONCEPT_DIMENSION c ON c.CONCEPT_CD = o.TVAL_CHAR
        WHERE o.PATIENT_NUM = ? AND o.CONCEPT_CD IN (?, ?)
        ORDER BY v.START_DATE ASC, o.ENCOUNTER_NUM ASC, CASE WHEN o.CONCEPT_CD = ? THEN 0 ELSE 1 END, o.INSTANCE_NUM ASC`,
      [patientNum, PRIMARY_DX, SECONDARY_DX, PRIMARY_DX],
    )
    const byVisit = new Map()
    for (const row of rows) {
      if (!byVisit.has(row.ENCOUNTER_NUM)) byVisit.set(row.ENCOUNTER_NUM, { encounterNum: row.ENCOUNTER_NUM, visitDate: row.START_DATE, diagnoses: [] })
      byVisit.get(row.ENCOUNTER_NUM).diagnoses.push(rowToDiagnosis(row))
    }
    return [...byVisit.values()]
  }

  /**
   * Create or update one diagnosis row. `kind:'primary'` always uses
   * INSTANCE_NUM 1 (one main diagnosis per visit); secondary rows get the
   * next free INSTANCE_NUM unless given.
   */
  async upsertDiagnosis({ observationId = null, patientNum, encounterNum, kind = 'secondary', instanceNum = null, icd = null, text = '', since = null, status = 'aktiv', laterality = null, providerId = null, visitDate = null, carriedFrom = null }) {
    const conceptCd = kind === 'primary' ? PRIMARY_DX : SECONDARY_DX
    const cleanText = String(text || '').trim()
    if (!icd && !cleanText) throw new Error('Diagnosis needs an ICD code or a text')
    const tval = icd || cleanText
    const blob = { icd: icd || null, text: cleanText || null, since: since || null, status: DX_STATUSES.includes(status) ? status : 'aktiv', laterality: laterality || null }
    if (carriedFrom) blob.carriedFrom = carriedFrom

    if (observationId != null) {
      const existing = (await this._query('SELECT INSTANCE_NUM FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [observationId]))[0]
      const inst = kind === 'primary' ? 1 : (instanceNum ?? existing?.INSTANCE_NUM ?? 1)
      blob.order = inst
      await this._command(
        `UPDATE OBSERVATION_FACT SET CONCEPT_CD = ?, TVAL_CHAR = ?, OBSERVATION_BLOB = ?, INSTANCE_NUM = ?, PROVIDER_ID = COALESCE(?, PROVIDER_ID), UPDATE_DATE = datetime('now') WHERE OBSERVATION_ID = ?`,
        [conceptCd, tval, JSON.stringify(blob), inst, providerId, observationId],
      )
      return (await this.getProblemList(encounterNum)).find((d) => d.observationId === observationId) || null
    }

    let inst = 1
    if (kind === 'primary') {
      const prior = (await this._query('SELECT OBSERVATION_ID FROM OBSERVATION_FACT WHERE ENCOUNTER_NUM = ? AND CONCEPT_CD = ? ORDER BY OBSERVATION_ID LIMIT 1', [encounterNum, PRIMARY_DX]))[0]
      if (prior) return this.upsertDiagnosis({ observationId: prior.OBSERVATION_ID, patientNum, encounterNum, kind, icd, text, since, status, laterality, providerId, visitDate, carriedFrom })
    } else {
      inst = instanceNum ?? ((await this._query('SELECT COALESCE(MAX(INSTANCE_NUM), 0) AS m FROM OBSERVATION_FACT WHERE ENCOUNTER_NUM = ? AND CONCEPT_CD = ?', [encounterNum, SECONDARY_DX]))[0].m || 0) + 1
    }
    blob.order = inst
    const startDate = visitDate || (await this._query('SELECT START_DATE FROM VISIT_DIMENSION WHERE ENCOUNTER_NUM = ?', [encounterNum]))[0]?.START_DATE || new Date().toISOString().slice(0, 10)
    const r = await this._command(
      `INSERT INTO OBSERVATION_FACT (PATIENT_NUM, ENCOUNTER_NUM, CONCEPT_CD, VALTYPE_CD, TVAL_CHAR, OBSERVATION_BLOB, INSTANCE_NUM, START_DATE, CATEGORY_CHAR, PROVIDER_ID, LOCATION_CD, SOURCESYSTEM_CD, UPLOAD_ID, UPDATE_DATE)
       VALUES (?, ?, ?, 'S', ?, ?, ?, ?, 'Diagnosis', ?, 'CONSULT', 'CONSULT', 1, datetime('now'))`,
      [patientNum, encounterNum, conceptCd, tval, JSON.stringify(blob), inst, startDate, providerId],
    )
    const id = r.lastID ?? r.lastId
    const list = await this.getProblemList(encounterNum)
    return list.find((d) => d.observationId === id) || list[list.length - 1] || null
  }

  /** Delete one diagnosis; secondary rows of the visit are renumbered 1..n. */
  async deleteDiagnosis(observationId) {
    const row = (await this._query('SELECT ENCOUNTER_NUM, CONCEPT_CD FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [observationId]))[0]
    if (!row) return false
    await this._command('DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [observationId])
    if (row.CONCEPT_CD === SECONDARY_DX) await this._renumber(row.ENCOUNTER_NUM)
    return true
  }

  async reorderSecondary(encounterNum, orderedObservationIds) {
    let i = 1
    for (const id of orderedObservationIds) {
      const cur = (await this._query('SELECT OBSERVATION_BLOB FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ? AND ENCOUNTER_NUM = ? AND CONCEPT_CD = ?', [id, encounterNum, SECONDARY_DX]))[0]
      if (!cur) continue
      const blob = { ...parseBlob(cur.OBSERVATION_BLOB), order: i }
      await this._command('UPDATE OBSERVATION_FACT SET INSTANCE_NUM = ?, OBSERVATION_BLOB = ? WHERE OBSERVATION_ID = ?', [i, JSON.stringify(blob), id])
      i++
    }
    return this.getProblemList(encounterNum)
  }

  async _renumber(encounterNum) {
    const rows = await this._query('SELECT OBSERVATION_ID, OBSERVATION_BLOB FROM OBSERVATION_FACT WHERE ENCOUNTER_NUM = ? AND CONCEPT_CD = ? ORDER BY INSTANCE_NUM ASC, OBSERVATION_ID ASC', [encounterNum, SECONDARY_DX])
    let i = 1
    for (const row of rows) {
      const blob = { ...parseBlob(row.OBSERVATION_BLOB), order: i }
      await this._command('UPDATE OBSERVATION_FACT SET INSTANCE_NUM = ?, OBSERVATION_BLOB = ? WHERE OBSERVATION_ID = ?', [i, JSON.stringify(blob), row.OBSERVATION_ID])
      i++
    }
  }

  /** Copy the problem list of one visit into another (skips duplicates by icd/text). */
  async carryForward({ fromEncounter, toEncounter, patientNum, providerId = null, visitDate = null }) {
    const source = await this.getProblemList(fromEncounter)
    const target = await this.getProblemList(toEncounter)
    const key = (d) => (d.icd ? `icd:${d.icd}` : `text:${(d.text || '').trim().toLowerCase()}`)
    const present = new Set(target.map(key))
    let created = 0
    let skipped = 0
    for (const d of source) {
      if (present.has(key(d)) || d.status === 'inaktiv') {
        skipped++
        continue
      }
      await this.upsertDiagnosis({ patientNum, encounterNum: toEncounter, kind: d.kind, icd: d.icd, text: d.text, since: d.since, status: d.status, laterality: d.laterality, providerId, visitDate, carriedFrom: { encounterNum: fromEncounter, observationId: d.observationId } })
      present.add(key(d))
      created++
    }
    return { created, skipped }
  }

  /** ICD-10 catalogue search by code prefix or (German) name fragment. */
  async searchIcd10(term, { limit = 30 } = {}) {
    const t = String(term || '').trim()
    if (!t) return []
    const rows = await this._query(
      `SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_PATH FROM CONCEPT_DIMENSION
        WHERE CONCEPT_CD LIKE 'ICD10: %' AND (CONCEPT_CD LIKE ? OR NAME_CHAR LIKE ?)
        ORDER BY CASE WHEN CONCEPT_CD LIKE ? THEN 0 ELSE 1 END, CONCEPT_CD
        LIMIT ?`,
      [`ICD10: ${t}%`, `%${t}%`, `ICD10: ${t}%`, limit],
    )
    return rows.map((r) => ({ code: r.CONCEPT_CD, icd: r.CONCEPT_CD.replace(/^ICD10: /, ''), name: r.NAME_CHAR, path: r.CONCEPT_PATH }))
  }
}

export default DiagnosisRepository
