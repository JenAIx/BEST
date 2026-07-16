/**
 * Tests for observation provider stamping (features/observation-provider):
 *   - auth-store.providerId getter (USER_CD of the logged-in user, 'SYSTEM' fallback)
 *   - UserRepository.syncProviderForUser / createUser (PROVIDER_DIMENSION upsert)
 *   - Migration 013 (seed PROVIDER_DIMENSION from USER_MANAGEMENT + legacy providers)
 *
 * The grid write paths (EditableCell, data-grid-store) assert the PROVIDER_ID
 * stamp in their own test files (15/17/18).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useAuthStore } from 'src/stores/auth-store.js'
import UserRepository from 'src/core/database/repositories/user-repository.js'
import { providerUserSync } from 'src/core/database/migrations/013-provider-user-sync.js'

const makeConnection = () => ({
  executeQuery: vi.fn().mockResolvedValue({ success: true, data: [] }),
  executeCommand: vi.fn().mockResolvedValue({ success: true, lastID: 1, changes: 1 }),
})

describe('auth-store.providerId', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns the USER_CD of the logged-in user', () => {
    const auth = useAuthStore()
    auth.user = { USER_ID: 3, USER_CD: 'ste', NAME_CHAR: 'Stefan User' }
    expect(auth.providerId).toBe('ste')
  })

  it("falls back to 'SYSTEM' when nobody is logged in", () => {
    const auth = useAuthStore()
    auth.user = null
    expect(auth.providerId).toBe('SYSTEM')
  })
})

describe('UserRepository provider sync', () => {
  it('syncProviderForUser upserts PROVIDER_DIMENSION with PROVIDER_ID = USER_CD', async () => {
    const connection = makeConnection()
    const repo = new UserRepository(connection)

    await repo.syncProviderForUser('ste', 'Stefan User')

    const call = connection.executeCommand.mock.calls.find(([sql]) => sql.includes('PROVIDER_DIMENSION'))
    expect(call).toBeTruthy()
    const [sql, params] = call
    expect(sql).toContain('ON CONFLICT(PROVIDER_ID) DO UPDATE')
    expect(params).toEqual(['ste', '\\Provider\\ste\\', 'Stefan User'])
  })

  it('syncProviderForUser falls back to userCd as display name and skips empty codes', async () => {
    const connection = makeConnection()
    const repo = new UserRepository(connection)

    await repo.syncProviderForUser('db')
    expect(connection.executeCommand.mock.calls[0][1]).toEqual(['db', '\\Provider\\db\\', 'db'])

    connection.executeCommand.mockClear()
    await repo.syncProviderForUser(null)
    expect(connection.executeCommand).not.toHaveBeenCalled()
  })

  it('createUser also creates the matching provider row', async () => {
    const connection = makeConnection()
    // BaseRepository.create issues an INSERT then re-reads the row
    connection.executeQuery.mockResolvedValue({ success: true, data: [{ USER_ID: 9, USER_CD: 'neu' }] })
    const repo = new UserRepository(connection)

    await repo.createUser({ USER_CD: 'neu', COLUMN_CD: 'user', NAME_CHAR: 'Neuer User', PASSWORD_CHAR: 'x' })

    const providerCall = connection.executeCommand.mock.calls.find(([sql]) => sql.includes('PROVIDER_DIMENSION'))
    expect(providerCall).toBeTruthy()
    expect(providerCall[1]).toEqual(['neu', '\\Provider\\neu\\', 'Neuer User'])
  })
})

describe('Migration 013-provider-user-sync', () => {
  it('seeds one provider per user (self-healing upsert) plus legacy SYSTEM/@ rows', async () => {
    const connection = makeConnection()

    await providerUserSync.execute(connection)

    const calls = connection.executeCommand.mock.calls
    expect(calls.length).toBe(2)

    const [userSeedSql] = calls[0]
    expect(userSeedSql).toContain('INSERT INTO PROVIDER_DIMENSION')
    expect(userSeedSql).toContain('FROM USER_MANAGEMENT')
    expect(userSeedSql).toContain('ON CONFLICT(PROVIDER_ID) DO UPDATE')

    const [legacySql] = calls[1]
    expect(legacySql).toContain('INSERT OR IGNORE INTO PROVIDER_DIMENSION')
    expect(legacySql).toContain("'SYSTEM'")
    expect(legacySql).toContain("'@'")
  })
})
