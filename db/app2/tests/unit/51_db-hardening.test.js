/**
 * Multi-user DB layer (Phase 1 of the Sept 2026 audit):
 *   - db-errors: classification, busy retry, error bus
 *   - statement-gate: serialisation + BEGIN IMMEDIATE transactions
 *   - ElectronConnection: retry on SQLITE_BUSY, errorKind on failures,
 *     withTransaction isolation, raw BEGIN rejected
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { classifyDbError, isBusyError, withBusyRetry, dbErrorBus, describeDbFailure } from '../../src/core/database/sqlite/db-errors.js'
import { createStatementGate, runInTransaction, isTransactionControl } from '../../src/core/database/sqlite/statement-gate.js'
import ElectronConnection from '../../src/core/database/sqlite/electron-connection.js'

const busy = () => Object.assign(new Error('SQLITE_BUSY: database is locked'), { code: 'SQLITE_BUSY' })
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('db-errors', () => {
  it('classifies sqlite errors by message (contextBridge strips err.code)', () => {
    expect(classifyDbError(new Error('SQLITE_BUSY: database is locked')).kind).toBe('busy')
    expect(classifyDbError('Error: database is locked').kind).toBe('busy')
    expect(classifyDbError(new Error('SQLITE_LOCKED: database table is locked')).kind).toBe('locked')
    expect(classifyDbError(new Error('SQLITE_READONLY: attempt to write a readonly database')).kind).toBe('readonly')
    expect(classifyDbError(new Error('SQLITE_CORRUPT: database disk image is malformed')).kind).toBe('corrupt')
    expect(classifyDbError(new Error('no such column: X')).kind).toBe('other')
    expect(isBusyError(busy())).toBe(true)
    expect(isBusyError(new Error('boom'))).toBe(false)
  })

  it('withBusyRetry retries BUSY with the given delays and then gives up', async () => {
    let calls = 0
    const fn = vi.fn(async () => {
      calls++
      if (calls < 3) throw busy()
      return 'ok'
    })
    const onRetry = vi.fn()
    await expect(withBusyRetry(fn, { delaysMs: [1, 1, 1], onRetry })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)

    const always = vi.fn(async () => {
      throw busy()
    })
    await expect(withBusyRetry(always, { delaysMs: [1, 1] })).rejects.toThrow(/SQLITE_BUSY/)
    expect(always).toHaveBeenCalledTimes(3)
  })

  it('withBusyRetry never retries non-busy errors or when shouldRetry says no', async () => {
    const other = vi.fn(async () => {
      throw new Error('no such table')
    })
    await expect(withBusyRetry(other, { delaysMs: [1] })).rejects.toThrow(/no such table/)
    expect(other).toHaveBeenCalledTimes(1)

    const inTx = vi.fn(async () => {
      throw busy()
    })
    await expect(withBusyRetry(inTx, { delaysMs: [1], shouldRetry: () => false })).rejects.toThrow(/SQLITE_BUSY/)
    expect(inTx).toHaveBeenCalledTimes(1)
  })

  it('bus delivers events and describeDbFailure truncates the SQL', () => {
    const seen = []
    const off = dbErrorBus.on((e) => seen.push(e))
    const failure = describeDbFailure(busy(), 'UPDATE OBSERVATION_FACT SET ' + 'x'.repeat(200), 'command')
    dbErrorBus.emit(failure)
    off()
    dbErrorBus.emit(failure)
    expect(seen).toHaveLength(1)
    expect(seen[0].kind).toBe('busy')
    expect(seen[0].sql.length).toBeLessThanOrEqual(120)
  })
})

describe('statement-gate', () => {
  it('serialises acquirers in order and releases idempotently', async () => {
    const gate = createStatementGate()
    const order = []
    const a = await gate.acquire()
    const bReady = gate.acquire().then((release) => {
      order.push('b-acquired')
      return release
    })
    await tick()
    expect(order).toEqual([]) // b waits while a holds
    expect(gate.isHeld()).toBe(true)
    a()
    a() // second release is a no-op
    const b = await bReady
    expect(order).toEqual(['b-acquired'])
    b()
    expect(gate.isHeld()).toBe(false)
  })

  it('runInTransaction keeps outside statements out of BEGIN…COMMIT', async () => {
    const gate = createStatementGate()
    const log = []
    const run = async (sql) => {
      log.push(sql)
    }
    const tx = { executeCommand: async (sql) => log.push(`tx:${sql}`) }

    const txPromise = runInTransaction(gate, { run, tx }, async (t) => {
      await t.executeCommand('INSERT A')
      await new Promise((r) => setTimeout(r, 20))
      await t.executeCommand('INSERT B')
      return 42
    })
    // an "outside" statement issued while the transaction is open
    const outside = gate.acquire().then((release) => {
      log.push('outside')
      release()
    })
    const result = await txPromise
    await outside
    expect(result).toBe(42)
    expect(log).toEqual(['BEGIN IMMEDIATE', 'tx:INSERT A', 'tx:INSERT B', 'COMMIT', 'outside'])
  })

  it('runInTransaction rolls back and rethrows, then frees the gate', async () => {
    const gate = createStatementGate()
    const log = []
    const run = async (sql) => log.push(sql)
    await expect(
      runInTransaction(gate, { run, tx: {} }, async () => {
        throw new Error('kaputt')
      }),
    ).rejects.toThrow('kaputt')
    expect(log).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK'])
    expect(gate.isHeld()).toBe(false)
  })

  it('isTransactionControl recognises BEGIN/COMMIT/ROLLBACK', () => {
    expect(isTransactionControl('BEGIN TRANSACTION')).toBe(true)
    expect(isTransactionControl('  commit')).toBe(true)
    expect(isTransactionControl('ROLLBACK')).toBe(true)
    expect(isTransactionControl('SELECT 1')).toBe(false)
    expect(isTransactionControl('UPDATE x SET beginning = 1')).toBe(false)
  })
})

describe('ElectronConnection hardening', () => {
  let dbman
  let connection
  let events

  beforeEach(async () => {
    dbman = {
      connect: vi.fn().mockResolvedValue(true),
      close: vi.fn(),
      query: vi.fn().mockResolvedValue([{ test: 1 }]),
      run: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    }
    globalThis.window = { electron: { dbman } }
    connection = new ElectronConnection()
    await connection.connect('/tmp/x.db')
    events = []
    dbErrorBus.clear()
    dbErrorBus.on((e) => events.push(e))
  })

  afterEach(() => {
    dbErrorBus.clear()
    delete globalThis.window
  })

  it('retries a BUSY statement and succeeds without surfacing an error', async () => {
    dbman.query.mockRejectedValueOnce(busy()).mockRejectedValueOnce(busy()).mockResolvedValueOnce([{ n: 1 }])
    const result = await connection.executeQuery('SELECT 1')
    expect(result.success).toBe(true)
    expect(result.data).toEqual([{ n: 1 }])
    expect(dbman.query).toHaveBeenCalledTimes(3)
    // the retries are reported (so the UI can say "warte auf Datenbank…")
    expect(events.filter((e) => e.phase === 'retry')).toHaveLength(2)
  }, 10000)

  it('reports errorKind and emits on the bus when a write finally fails', async () => {
    dbman.run.mockRejectedValue(busy())
    const result = await connection.executeCommand('UPDATE t SET a = 1')
    expect(result.success).toBe(false)
    expect(result.errorKind).toBe('busy')
    expect(result.changes).toBe(0)
    expect(events.some((e) => e.phase === 'command' && e.kind === 'busy')).toBe(true)
  }, 10000)

  it('withTransaction issues BEGIN IMMEDIATE/COMMIT and keeps outside statements out', async () => {
    const order = []
    dbman.run.mockImplementation(async (sql) => {
      order.push(sql)
      return { lastID: 1, changes: 1 }
    })
    const txPromise = connection.withTransaction(async (tx) => {
      const r1 = await tx.executeCommand('INSERT INTO a VALUES (1)')
      await new Promise((r) => setTimeout(r, 10))
      const r2 = await tx.executeCommand('INSERT INTO b VALUES (2)')
      return [r1.success, r2.success]
    })
    const outside = connection.executeCommand('UPDATE c SET x = 1')
    const result = await txPromise
    await outside
    expect(result).toEqual([true, true])
    expect(order).toEqual(['BEGIN IMMEDIATE', 'INSERT INTO a VALUES (1)', 'INSERT INTO b VALUES (2)', 'COMMIT', 'UPDATE c SET x = 1'])
  })

  it('withTransaction rolls back when the body throws and does not retry BUSY inside', async () => {
    const order = []
    dbman.run.mockImplementation(async (sql) => {
      order.push(sql)
      if (sql.startsWith('INSERT')) throw busy()
      return { lastID: 1, changes: 1 }
    })
    await expect(
      connection.withTransaction(async (tx) => {
        const r = await tx.executeCommand('INSERT INTO a VALUES (1)')
        if (!r.success) throw new Error(r.error)
      }),
    ).rejects.toThrow(/SQLITE_BUSY/)
    // exactly one INSERT attempt — no busy retry inside a transaction
    expect(order).toEqual(['BEGIN IMMEDIATE', 'INSERT INTO a VALUES (1)', 'ROLLBACK'])
  })

  it('transaction(commands) runs every command inside one withTransaction', async () => {
    const order = []
    dbman.run.mockImplementation(async (sql) => {
      order.push(sql)
      return { lastID: 7, changes: 1 }
    })
    const results = await connection.transaction([{ sql: 'INSERT 1' }, { sql: 'INSERT 2', params: [1] }])
    expect(results).toEqual([
      { lastID: 7, changes: 1 },
      { lastID: 7, changes: 1 },
    ])
    expect(order).toEqual(['BEGIN IMMEDIATE', 'INSERT 1', 'INSERT 2', 'COMMIT'])
  })

  it('rejects raw BEGIN outside withTransaction in dev/test builds', async () => {
    await expect(connection.run('BEGIN TRANSACTION')).rejects.toThrow(/withTransaction/)
    expect(dbman.run).not.toHaveBeenCalledWith('BEGIN TRANSACTION', [])
  })
})
