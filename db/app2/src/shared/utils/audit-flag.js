/**
 * Audit-flag helpers shared by the Datentabellen-Editor (data-grid-store /
 * EditableCell) and the unified visits timeline (observation-store /
 * ObservationTileGrid / ObservationFormGrid).
 *
 * VALUEFLAG_CD state machine (CLAUDE.md §3): 'AUDIT' = needs review (red),
 * 'CONFIRMED' = reviewed (green), 'NV' = explicitly no value, null = plain.
 * The flag values are mutually exclusive. Pure module — no Vue, no stores.
 */

export const FLAG_AUDIT = 'AUDIT'
export const FLAG_CONFIRMED = 'CONFIRMED'
export const FLAG_NV = 'NV'

/**
 * The single UPDATE statement behind every flag transition. `flag='NV'` also
 * clears NVAL_NUM + TVAL_CHAR so "no value" really is no value; every other
 * flag (AUDIT / CONFIRMED / null) leaves the value untouched.
 *
 * @param {string|null} flag
 * @param {string|null} providerId  USER_CD of the editor (PROVIDER_ID)
 * @param {number} observationId
 * @returns {{sql: string, params: Array}}
 */
export function buildSetFlagStatement(flag, providerId, observationId) {
  const clearValue = flag === FLAG_NV
  const sql = clearValue
    ? 'UPDATE OBSERVATION_FACT SET VALUEFLAG_CD = ?, NVAL_NUM = NULL, TVAL_CHAR = NULL, PROVIDER_ID = ?, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?'
    : 'UPDATE OBSERVATION_FACT SET VALUEFLAG_CD = ?, PROVIDER_ID = ?, UPDATE_DATE = CURRENT_TIMESTAMP WHERE OBSERVATION_ID = ?'
  return { sql, params: [flag, providerId, observationId], clearValue }
}

/**
 * Effective flag of a transformed observation. The timeline's transform
 * exposes `valueFlag`; older objects only carry the raw row.
 */
export function readValueFlag(obs) {
  if (!obs) return null
  return obs.valueFlag ?? obs.rawData?.VALUEFLAG_CD ?? null
}

export function hasOpenAudit(obs) {
  return readValueFlag(obs) === FLAG_AUDIT
}

export function countOpenAudits(observations) {
  return (observations || []).reduce((n, obs) => n + (hasOpenAudit(obs) ? 1 : 0), 0)
}

/**
 * Menu actions available for an observation in a given flag state — same
 * rules as the grid's EditableCell context menu: "mark" unless already
 * AUDIT or NV, "resolve" only while AUDIT, "clear" whenever a review flag
 * (AUDIT / CONFIRMED) is set.
 *
 * @param {string|null} flag  current VALUEFLAG_CD
 * @returns {Array<{action: 'mark'|'resolve'|'clear', flag: string|null}>}
 */
export function auditActionsFor(flag) {
  const actions = []
  if (flag !== FLAG_AUDIT && flag !== FLAG_NV) actions.push({ action: 'mark', flag: FLAG_AUDIT })
  if (flag === FLAG_AUDIT) actions.push({ action: 'resolve', flag: FLAG_CONFIRMED })
  if (flag === FLAG_AUDIT || flag === FLAG_CONFIRMED) actions.push({ action: 'clear', flag: null })
  return actions
}

/**
 * A write hit ZERO rows: the observation was deleted (or, once optimistic
 * locking lands, changed) by another user since this grid loaded it.
 */
export class StaleObservationError extends Error {
  constructor(observationId, message) {
    super(message || `Observation ${observationId} no longer exists or was changed by another user`)
    this.name = 'StaleObservationError'
    this.code = 'STALE_OBSERVATION'
    this.observationId = observationId
  }
}

/**
 * Every UPDATE/DELETE must go through `executeCommand` (never `executeQuery`,
 * whose `db.all` path returns no changes-count and reports success for a
 * write that hit nothing). This turns `{success, changes}` into exceptions.
 */
export function assertRowChanged(result, observationId) {
  if (!result || result.success === false) throw new Error(result?.error || 'Database write failed')
  if (typeof result.changes === 'number' && result.changes === 0) throw new StaleObservationError(observationId)
  return result
}

/**
 * The single UPDATE statement behind every grid VALUE write (EditableCell,
 * undo/redo, fill-down). Param order is fixed — tests assert on it:
 * value columns, [VALUEFLAG_CD], PROVIDER_ID, OBSERVATION_ID.
 *
 * @param {Object} o
 * @param {string} o.valueType   VALTYPE_CD of the concept
 * @param {*} o.value            number/string; ''/null/undefined → NULL
 * @param {string|null|undefined} o.flag  new VALUEFLAG_CD; `undefined` = leave
 *   the flag column untouched (undo/redo), `null` = clear, 'NV' = no value
 * @param {string|null} o.providerId
 * @param {number} o.observationId
 * @param {number|null} [o.expectedVersion]  reserved for optimistic locking
 *   (adds `AND VERSION = ?` once OBSERVATION_FACT.VERSION exists)
 * @returns {{sql: string, params: Array}}
 */
export function buildValueUpdateStatement({ valueType, value, flag, providerId, observationId, expectedVersion = null }) {
  const isEmpty = value === null || value === undefined || value === ''
  const sets = []
  const params = []
  if (valueType === 'N') {
    sets.push('NVAL_NUM = ?', 'TVAL_CHAR = ?')
    params.push(isEmpty ? null : Number(value), null)
  } else {
    sets.push('TVAL_CHAR = ?', 'NVAL_NUM = ?')
    params.push(isEmpty ? null : String(value), null)
  }
  if (flag !== undefined) {
    sets.push('VALUEFLAG_CD = ?')
    params.push(flag)
  }
  sets.push('PROVIDER_ID = ?')
  params.push(providerId)
  let where = 'WHERE OBSERVATION_ID = ?'
  params.push(observationId)
  if (expectedVersion !== null && expectedVersion !== undefined) {
    where += ' AND VERSION = ?'
    params.push(expectedVersion)
  }
  return { sql: `UPDATE OBSERVATION_FACT SET ${sets.join(', ')}, UPDATE_DATE = CURRENT_TIMESTAMP ${where}`, params }
}
