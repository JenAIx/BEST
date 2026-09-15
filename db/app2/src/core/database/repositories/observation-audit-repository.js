/**
 * ObservationAuditRepository — the per-observation audit trail
 * (OBSERVATION_AUDIT_FACT, migration 015). Read the migration header for the
 * event model. Rows are append-only apart from deleting one's own comment.
 */
import BaseRepository from './base-repository.js'

export const AUDIT_EVENT_FLAG = 'FLAG'
export const AUDIT_EVENT_COMMENT = 'COMMENT'
export const AUDIT_EVENT_VALUE_EDIT = 'VALUE_EDIT'

const SELECT_EVENT = `
  SELECT a.AUDIT_ID, a.OBSERVATION_ID, a.PATIENT_NUM, a.ENCOUNTER_NUM,
         a.EVENT_CD, a.FLAG_CD, a.COMMENT_TEXT, a.CREATED_BY, a.CREATED_AT, a.SOURCESYSTEM_CD,
         COALESCE(u.NAME_CHAR, a.CREATED_BY) AS CREATED_BY_NAME
    FROM OBSERVATION_AUDIT_FACT a
    LEFT JOIN USER_MANAGEMENT u ON u.USER_CD = a.CREATED_BY`

class ObservationAuditRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'OBSERVATION_AUDIT_FACT', 'AUDIT_ID')
  }

  /**
   * Append one event. PATIENT_NUM / ENCOUNTER_NUM are copied from the
   * observation row so callers only need the OBSERVATION_ID. Returns the
   * inserted row (as the UI renders it) or null when the observation does
   * not exist.
   *
   * @param {{observationId:number, eventCd:string, flagCd?:string|null, commentText?:string|null, createdBy?:string|null, source?:string|null}} event
   */
  async logEvent({ observationId, eventCd, flagCd = null, commentText = null, createdBy = null, source = null }) {
    if (observationId == null || !eventCd) throw new Error('logEvent needs observationId and eventCd')
    const text = commentText != null && String(commentText).trim() !== '' ? String(commentText).trim() : null
    const result = await this.connection.executeCommand(
      `INSERT INTO OBSERVATION_AUDIT_FACT
         (OBSERVATION_ID, PATIENT_NUM, ENCOUNTER_NUM, EVENT_CD, FLAG_CD, COMMENT_TEXT, CREATED_BY, SOURCESYSTEM_CD)
       SELECT o.OBSERVATION_ID, o.PATIENT_NUM, o.ENCOUNTER_NUM, ?, ?, ?, ?, ?
         FROM OBSERVATION_FACT o
        WHERE o.OBSERVATION_ID = ?`,
      [eventCd, flagCd, text, createdBy, source, observationId],
    )
    if (!result.success) throw new Error(result.error || 'Failed to log audit event')
    if (!(result.changes ?? 1)) return null
    const id = result.lastID ?? result.lastId
    if (id == null) return null
    const rows = await this._query(`${SELECT_EVENT} WHERE a.AUDIT_ID = ?`, [id])
    return rows[0] || null
  }

  /** All events of one observation, oldest first. */
  async getTrailForObservation(observationId) {
    if (observationId == null) return []
    return this._query(`${SELECT_EVENT} WHERE a.OBSERVATION_ID = ? ORDER BY a.CREATED_AT ASC, a.AUDIT_ID ASC`, [observationId])
  }

  /** All events of a patient (every observation), oldest first — the UI groups them. */
  async getTrailForPatient(patientNum) {
    if (patientNum == null) return []
    return this._query(`${SELECT_EVENT} WHERE a.PATIENT_NUM = ? ORDER BY a.CREATED_AT ASC, a.AUDIT_ID ASC`, [patientNum])
  }

  /**
   * Comment counts per observation (EVENT_CD='COMMENT' plus flag events that
   * carry a comment) — what the tile badge shows.
   * @returns {Promise<Map<number, number>>}
   */
  async getCommentCountsForObservations(observationIds) {
    const ids = [...new Set((observationIds || []).filter((id) => id != null))]
    const map = new Map()
    if (!ids.length) return map
    const rows = await this._query(
      `SELECT OBSERVATION_ID, COUNT(*) AS n
         FROM OBSERVATION_AUDIT_FACT
        WHERE COMMENT_TEXT IS NOT NULL AND OBSERVATION_ID IN (${ids.map(() => '?').join(',')})
        GROUP BY OBSERVATION_ID`,
      ids,
    )
    for (const r of rows) map.set(r.OBSERVATION_ID, r.n || 0)
    return map
  }

  /** Delete one comment event (the store enforces "own comment or admin"). */
  async deleteEvent(auditId) {
    const result = await this.connection.executeCommand('DELETE FROM OBSERVATION_AUDIT_FACT WHERE AUDIT_ID = ? AND EVENT_CD = ?', [auditId, AUDIT_EVENT_COMMENT])
    if (!result.success) throw new Error(result.error || 'Failed to delete audit comment')
    return (result.changes ?? 0) > 0
  }

  async _query(sql, params) {
    const result = await this.connection.executeQuery(sql, params)
    if (!result.success) throw new Error(result.error || 'Audit trail query failed')
    return result.data || []
  }
}

export default ObservationAuditRepository
