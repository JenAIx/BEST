/**
 * Two connections on ONE database file (what two app instances on a share
 * look like): busy_timeout turns an instant SQLITE_BUSY into waiting, and
 * withTransaction keeps a multi-statement unit atomic against the other
 * connection.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import RealSQLiteConnection from '../../src/core/database/sqlite/real-connection.js'

const DB_PATH = './tests/output/multi-connection-busy.db'
let a
let b

beforeAll(async () => {
  fs.mkdirSync('./tests/output', { recursive: true })
  for (const f of [DB_PATH, `${DB_PATH}-journal`]) if (fs.existsSync(f)) fs.unlinkSync(f)
  a = new RealSQLiteConnection()
  b = new RealSQLiteConnection()
  await a.connect(DB_PATH, { busyTimeoutMs: 150 })
  await b.connect(DB_PATH, { busyTimeoutMs: 150 })
  await a.executeCommand('CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER NOT NULL DEFAULT 0)')
  await a.executeCommand('INSERT INTO t (id, v) VALUES (1, 0)')
})

afterAll(async () => {
  await a.disconnect()
  await b.disconnect()
  for (const f of [DB_PATH, `${DB_PATH}-journal`]) if (fs.existsSync(f)) fs.unlinkSync(f)
})

describe('two connections, one file', () => {
  it('a writer on A makes B wait (busy_timeout) and fail with SQLITE_BUSY only after the timeout', async () => {
    let releaseA
    const holdA = new Promise((r) => {
      releaseA = r
    })
    // A holds a write transaction for ~400 ms
    const txA = a.withTransaction(async (tx) => {
      await tx.executeCommand('UPDATE t SET v = 1 WHERE id = 1')
      await holdA
    })
    await new Promise((r) => setTimeout(r, 30))

    // B's write must wait for busy_timeout (150 ms) and then fail with BUSY
    const started = Date.now()
    await expect(b.executeCommand('UPDATE t SET v = 2 WHERE id = 1')).rejects.toThrow(/SQLITE_BUSY|database is locked/)
    expect(Date.now() - started).toBeGreaterThanOrEqual(100)

    releaseA()
    await txA

    // …and succeeds once A committed
    const ok = await b.executeCommand('UPDATE t SET v = 2 WHERE id = 1')
    expect(ok.changes).toBe(1)
    const row = (await a.executeQuery('SELECT v FROM t WHERE id = 1')).data[0]
    expect(row.v).toBe(2)
  }, 10000)

  it('withTransaction is atomic: a failing second statement rolls back the first', async () => {
    await expect(
      a.withTransaction(async (tx) => {
        await tx.executeCommand('UPDATE t SET v = 99 WHERE id = 1')
        await tx.executeCommand('INSERT INTO t (id, v) VALUES (1, 5)') // PK violation
      }),
    ).rejects.toThrow(/UNIQUE|constraint/i)
    const row = (await b.executeQuery('SELECT v FROM t WHERE id = 1')).data[0]
    expect(row.v).toBe(2) // unchanged — the UPDATE was rolled back
  })

  it('statements of another caller on the SAME connection never land inside an open transaction', async () => {
    let releaseTx
    const hold = new Promise((r) => {
      releaseTx = r
    })
    const tx = a.withTransaction(async (t) => {
      await t.executeCommand('UPDATE t SET v = 10 WHERE id = 1')
      await hold
      throw new Error('abort') // roll back everything inside
    })
    await new Promise((r) => setTimeout(r, 20))
    // queued behind the transaction — must NOT be rolled back with it
    const outside = a.executeCommand('INSERT INTO t (id, v) VALUES (2, 7)')
    releaseTx()
    await expect(tx).rejects.toThrow('abort')
    await outside
    const rows = (await b.executeQuery('SELECT id, v FROM t ORDER BY id')).data
    expect(rows).toEqual([
      { id: 1, v: 2 }, // rolled back to 2
      { id: 2, v: 7 }, // committed on its own
    ])
  })

  it('PRAGMA data_version changes for A when B commits (change-detection signal)', async () => {
    const before = (await a.executeQuery('PRAGMA data_version')).data[0].data_version
    await a.executeCommand('UPDATE t SET v = v WHERE id = 2') // own write: no change
    const afterOwn = (await a.executeQuery('PRAGMA data_version')).data[0].data_version
    expect(afterOwn).toBe(before)
    await b.executeCommand('UPDATE t SET v = 8 WHERE id = 2')
    const afterOther = (await a.executeQuery('PRAGMA data_version')).data[0].data_version
    expect(afterOther).not.toBe(before)
  })
})
