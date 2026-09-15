/**
 * SQLite error classification, busy-retry and a tiny error bus.
 *
 * Several app instances share ONE database file (SMB share, rollback
 * journal). While another instance commits, our statements can fail with
 * SQLITE_BUSY. Before this module every caller swallowed `success: false`
 * into 0 / [] — the dashboard showed zeros instead of "locked".
 *
 * The Electron contextBridge strips `err.code`, so classification works on
 * the message. Pure module — no Vue, no stores.
 */

export const DB_ERROR_KINDS = Object.freeze({
  BUSY: 'busy', // SQLITE_BUSY — another connection holds a lock
  LOCKED: 'locked', // SQLITE_LOCKED — same-connection lock (rare here)
  READONLY: 'readonly', // file / share not writable
  CORRUPT: 'corrupt',
  IO: 'io',
  OTHER: 'other',
})

/**
 * @param {Error|string|null} error
 * @returns {{kind: string, message: string, retryable: boolean}}
 */
export function classifyDbError(error) {
  const message = String(error?.message ?? error ?? '')
  const m = message.toLowerCase()
  let kind = DB_ERROR_KINDS.OTHER
  if (/sqlite_busy|database is locked/.test(m)) kind = DB_ERROR_KINDS.BUSY
  else if (/sqlite_locked|database table is locked/.test(m)) kind = DB_ERROR_KINDS.LOCKED
  else if (/sqlite_readonly|readonly database/.test(m)) kind = DB_ERROR_KINDS.READONLY
  else if (/sqlite_corrupt|malformed/.test(m)) kind = DB_ERROR_KINDS.CORRUPT
  else if (/sqlite_ioerr|disk i\/o error/.test(m)) kind = DB_ERROR_KINDS.IO
  return { kind, message, retryable: kind === DB_ERROR_KINDS.BUSY || kind === DB_ERROR_KINDS.LOCKED }
}

export const isBusyError = (error) => classifyDbError(error).retryable

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry `fn` while it fails with a BUSY/LOCKED error. SQLITE_BUSY is returned
 * BEFORE any write is applied, so retrying a single statement is safe — but
 * NOT inside an open transaction (the whole unit must be retried by its
 * owner), hence `shouldRetry`.
 *
 * @param {() => Promise<any>} fn
 * @param {{delaysMs?: number[], shouldRetry?: () => boolean, onRetry?: (attempt: number, error: Error) => void}} [options]
 */
export async function withBusyRetry(fn, { delaysMs = [100, 300, 800], shouldRetry = () => true, onRetry = null } = {}) {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      if (!isBusyError(error) || attempt >= delaysMs.length || !shouldRetry()) throw error
      onRetry?.(attempt + 1, error)
      await sleep(delaysMs[attempt])
      attempt++
    }
  }
}

/**
 * Minimal event bus: the connection layer emits, the database store listens
 * and mirrors into a ref, App.vue turns that into a (throttled) toast.
 * Stores must not call notify themselves (see useNotify).
 */
function createDbErrorBus() {
  const listeners = new Set()
  return {
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(event) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (err) {
          console.error('dbErrorBus listener failed:', err)
        }
      }
    },
    clear() {
      listeners.clear()
    },
  }
}

export const dbErrorBus = createDbErrorBus()

/** Build the bus payload for a failed statement. */
export function describeDbFailure(error, sql, phase) {
  const { kind, message } = classifyDbError(error)
  return { kind, message, phase, sql: typeof sql === 'string' ? sql.slice(0, 120) : null, at: Date.now() }
}
