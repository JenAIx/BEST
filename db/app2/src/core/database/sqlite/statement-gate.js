/**
 * Statement gate — an async mutex for ONE node-sqlite3 connection.
 *
 * Why: node-sqlite3 runs statements in "parallel" mode. Every `await` between
 * `BEGIN` and `COMMIT` lets other callers (grid autosave, message poll, …)
 * slip their statements INTO the open transaction, where they are committed
 * or rolled back together with it. `db.serialize()` does not help — it only
 * orders statements queued synchronously inside its callback.
 *
 * The gate serialises everything: ordinary statements acquire it for their
 * own duration; a transaction owner holds it from BEGIN IMMEDIATE to
 * COMMIT/ROLLBACK and issues its statements on the raw (ungated) path. Other
 * callers simply queue for a few milliseconds.
 *
 * Pure module — no Vue, no stores; shared by ElectronConnection and
 * RealSQLiteConnection so unit/integration tests exercise the real thing.
 */

/**
 * @param {{warnAfterMs?: number, onLongHold?: (ms: number) => void}} [options]
 * @returns {{acquire: () => Promise<() => void>, isHeld: () => boolean, pending: () => number}}
 */
export function createStatementGate({ warnAfterMs = 10000, onLongHold = null } = {}) {
  let queue = Promise.resolve()
  let held = false
  let waiting = 0

  const acquire = () => {
    waiting++
    let release
    const lock = new Promise((resolve) => {
      release = resolve
    })
    const previous = queue
    queue = previous.then(() => lock)
    return previous.then(() => {
      waiting--
      held = true
      const start = Date.now()
      const timer = warnAfterMs > 0 && onLongHold ? setTimeout(() => onLongHold(Date.now() - start), warnAfterMs) : null
      let released = false
      return () => {
        if (released) return // idempotent — a finally block may call it twice
        released = true
        if (timer) clearTimeout(timer)
        held = false
        release()
      }
    })
  }

  return { acquire, isHeld: () => held, pending: () => waiting }
}

/**
 * Run `fn(tx)` inside BEGIN IMMEDIATE … COMMIT while holding the gate.
 *
 * `BEGIN IMMEDIATE` takes the RESERVED lock right away, so the busy handler
 * (PRAGMA busy_timeout) waits at BEGIN instead of failing later at the
 * deferred lock upgrade — the classic two-writer SQLITE_BUSY that no timeout
 * can fix.
 *
 * @param {ReturnType<typeof createStatementGate>} gate
 * @param {{run: (sql: string) => Promise<any>, tx: Object, onBegin?: () => void, onEnd?: () => void}} io
 *   run: raw (ungated) statement runner for BEGIN/COMMIT/ROLLBACK; tx: the
 *   connection-like object handed to fn (raw executeQuery/executeCommand)
 * @param {(tx: Object) => Promise<any>} fn
 */
export async function runInTransaction(gate, { run, tx, onBegin = null, onEnd = null }, fn) {
  const release = await gate.acquire()
  try {
    onBegin?.()
    await run('BEGIN IMMEDIATE')
    let result
    try {
      result = await fn(tx)
    } catch (error) {
      try {
        await run('ROLLBACK')
      } catch (rollbackError) {
        // the original error is the one that matters
        console.error('ROLLBACK failed after transaction error:', rollbackError?.message || rollbackError)
      }
      throw error
    }
    await run('COMMIT')
    return result
  } finally {
    onEnd?.()
    release()
  }
}

const TX_CONTROL_RE = /^\s*(BEGIN|COMMIT|END|ROLLBACK)\b/i

/** True for BEGIN / COMMIT / ROLLBACK statements (raw transaction control). */
export function isTransactionControl(sql) {
  return typeof sql === 'string' && TX_CONTROL_RE.test(sql)
}
