/**
 * @vitest-environment jsdom
 *
 * Tests for the SmartButton messenger (message notes with CATEGORY_CHAR='MESSAGE'):
 *   - note-repository.getMessagesForUser (SQL shape: category + sender-OR-recipient LIKE)
 *   - note-store: sendMessage payload, loadMessages partition + unread count,
 *     markMessageRead (recipient only), deleteMessage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import NoteRepository from '../../src/core/database/repositories/note-repository.js'

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

describe('NoteRepository.getMessagesForUser', () => {
  let mockConnection
  let repo

  beforeEach(() => {
    mockConnection = { executeQuery: vi.fn(), executeCommand: vi.fn() }
    repo = new NoteRepository(mockConnection)
  })

  it('filters by MESSAGE category and sender OR recipient OR broadcast', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, data: [] })
    await repo.getMessagesForUser('db', { limit: 20 })

    const [sql, params] = mockConnection.executeQuery.mock.calls[0]
    expect(sql).toContain("CATEGORY_CHAR = 'MESSAGE'")
    expect(sql).toContain('SOURCESYSTEM_CD = ? OR NOTE_BLOB LIKE ? OR NOTE_BLOB LIKE ?')
    expect(params).toEqual(['db', '%"to":"db"%', '%"to":"*"%', 20])
  })
})

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const makeMessage = (id, { from, to, readAt = null, text = 'hello' } = {}) => ({
  NOTE_ID: id,
  CATEGORY_CHAR: 'MESSAGE',
  NAME_CHAR: text,
  NOTE_TEXT: text,
  SOURCESYSTEM_CD: from,
  IMPORT_DATE: '2026-07-16T10:00:00.000Z',
  NOTE_BLOB: JSON.stringify({ from, to, readAt, createdBy: from }),
})

const noteRepoMock = {
  createNote: vi.fn(async (data) => ({ ...data, NOTE_ID: 99 })),
  getQuickNotes: vi.fn(async () => []),
  getMessagesForUser: vi.fn(async () => []),
  updateNote: vi.fn(async () => true),
  delete: vi.fn(async () => true),
}

const userRepoMock = {
  findAll: vi.fn(async () => [
    { USER_CD: 'ste', NAME_CHAR: 'Stefan' },
    { USER_CD: 'db', NAME_CHAR: 'Database User' },
    { USER_CD: 'admin', NAME_CHAR: 'Admin' },
    { USER_CD: 'public', NAME_CHAR: 'Public User' },
  ]),
}

const dbMock = {
  canPerformOperations: true,
  getRepository: vi.fn((name) => (name === 'user' ? userRepoMock : noteRepoMock)),
}

vi.mock('src/stores/database-store', () => ({ useDatabaseStore: () => dbMock }))
vi.mock('src/stores/auth-store', () => ({ useAuthStore: () => ({ currentUser: { USER_CD: 'ste' } }) }))
vi.mock('src/stores/patient-store', () => ({
  usePatientStore: () => ({ selectedPatient: { PATIENT_NUM: 42, PATIENT_CD: 'P042', name: 'Max' } }),
}))
vi.mock('src/stores/visit-store', () => ({ useVisitStore: () => ({ selectedVisit: null }) }))
vi.mock('src/stores/study-store', () => ({ useStudyStore: () => ({ selectedStudy: null }) }))
vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() }),
  }),
}))

const { useNoteStore } = await import('src/stores/note-store')

describe('note-store messenger', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sendMessage writes a MESSAGE row with from/to/readAt/replyToId and context', async () => {
    const store = useNoteStore()
    await store.sendMessage({ to: 'db', text: 'Schau dir Patient P042 an', replyToId: 7, route: '/visits/P042' })

    const payload = noteRepoMock.createNote.mock.calls[0][0]
    expect(payload.CATEGORY_CHAR).toBe('MESSAGE')
    expect(payload.SOURCESYSTEM_CD).toBe('ste')
    expect(payload.PATIENT_NUM).toBe(42)

    const blob = JSON.parse(payload.NOTE_BLOB)
    expect(blob.from).toBe('ste')
    expect(blob.to).toBe('db')
    expect(blob.readAt).toBeNull()
    expect(blob.replyToId).toBe(7)
    expect(blob.patientCd).toBe('P042')
    expect(blob.route).toBe('/visits/P042')

    expect(store.messages[0].NOTE_ID).toBe(99)
  })

  it('sendMessage rejects missing recipient or empty text', async () => {
    const store = useNoteStore()
    await expect(store.sendMessage({ to: null, text: 'hi' })).rejects.toThrow()
    await expect(store.sendMessage({ to: 'db', text: '  ' })).rejects.toThrow()
    expect(noteRepoMock.createNote).not.toHaveBeenCalled()
  })

  it('loadMessages keeps only rows the user is involved in and counts unread', async () => {
    noteRepoMock.getMessagesForUser.mockResolvedValue([
      makeMessage(1, { from: 'db', to: 'ste' }), // received, unread
      makeMessage(2, { from: 'db', to: 'ste', readAt: '2026-07-16T09:00:00Z' }), // received, read
      makeMessage(3, { from: 'ste', to: 'db' }), // sent
      makeMessage(4, { from: 'db', to: 'admin' }), // LIKE false positive → filtered out
    ])

    const store = useNoteStore()
    await store.loadMessages()

    expect(store.messages.map((m) => m.NOTE_ID)).toEqual([1, 2, 3])
    expect(store.unreadMessagesCount).toBe(1)
  })

  it('markMessageRead sets readAt for received messages only', async () => {
    const store = useNoteStore()
    const received = makeMessage(1, { from: 'db', to: 'ste' })
    const sent = makeMessage(2, { from: 'ste', to: 'db' })
    store.messages.push(received, sent)

    await store.markMessageRead(sent)
    expect(noteRepoMock.updateNote).not.toHaveBeenCalled()

    await store.markMessageRead(received)
    expect(noteRepoMock.updateNote).toHaveBeenCalledTimes(1)
    const [id, update] = noteRepoMock.updateNote.mock.calls[0]
    expect(id).toBe(1)
    expect(JSON.parse(update.NOTE_BLOB).readAt).toBeTruthy()
    expect(store.unreadMessagesCount).toBe(0)
  })

  it('markAllMessagesRead clears every unread received message', async () => {
    const store = useNoteStore()
    store.messages.push(makeMessage(1, { from: 'db', to: 'ste' }), makeMessage(2, { from: 'admin', to: 'ste' }), makeMessage(3, { from: 'ste', to: 'db' }))

    await store.markAllMessagesRead()
    expect(noteRepoMock.updateNote).toHaveBeenCalledTimes(2)
    expect(store.unreadMessagesCount).toBe(0)
  })

  it('deleteMessage removes the row from local state', async () => {
    const store = useNoteStore()
    store.messages.push(makeMessage(1, { from: 'db', to: 'ste' }), makeMessage(2, { from: 'ste', to: 'db' }))

    await store.deleteMessage(1)
    expect(noteRepoMock.delete).toHaveBeenCalledWith(1)
    expect(store.messages.map((m) => m.NOTE_ID)).toEqual([2])
  })

  it('broadcast: incoming for everyone but the sender, unread via readBy list', async () => {
    const broadcast = {
      ...makeMessage(10, { from: 'db', to: '*' }),
      NOTE_BLOB: JSON.stringify({ from: 'db', to: '*', readAt: null, readBy: [] }),
    }
    const store = useNoteStore()
    store.messages.push(broadcast)

    expect(store.isIncomingMessage(broadcast)).toBe(true)
    expect(store.unreadMessagesCount).toBe(1)

    await store.markMessageRead(broadcast)
    const [, update] = noteRepoMock.updateNote.mock.calls[0]
    expect(JSON.parse(update.NOTE_BLOB).readBy).toEqual(['ste'])
    expect(store.unreadMessagesCount).toBe(0)
  })

  it('broadcast sent by me is not incoming and my own broadcast can be deleted', async () => {
    const own = {
      ...makeMessage(11, { from: 'ste', to: '*' }),
      NOTE_BLOB: JSON.stringify({ from: 'ste', to: '*', readAt: null, readBy: [] }),
    }
    const store = useNoteStore()
    store.messages.push(own)

    expect(store.isIncomingMessage(own)).toBe(false)
    expect(store.unreadMessagesCount).toBe(0)

    await store.deleteMessage(11)
    expect(noteRepoMock.delete).toHaveBeenCalledWith(11)
  })

  it("a recipient cannot delete someone else's broadcast", async () => {
    const foreign = {
      ...makeMessage(12, { from: 'db', to: '*' }),
      NOTE_BLOB: JSON.stringify({ from: 'db', to: '*', readAt: null, readBy: [] }),
    }
    const store = useNoteStore()
    store.messages.push(foreign)

    await expect(store.deleteMessage(12)).rejects.toThrow('Only the sender')
    expect(noteRepoMock.delete).not.toHaveBeenCalled()
  })

  it('sendMessage to "*" initializes the readBy list', async () => {
    const store = useNoteStore()
    await store.sendMessage({ to: '*', text: 'Team-Info' })

    const blob = JSON.parse(noteRepoMock.createNote.mock.calls[0][0].NOTE_BLOB)
    expect(blob.to).toBe('*')
    expect(blob.readBy).toEqual([])
  })

  it('loadRecipients returns all users except the current one and the technical public account', async () => {
    const store = useNoteStore()
    const recipients = await store.loadRecipients()

    expect(recipients.map((r) => r.value)).toEqual(['db', 'admin'])
    expect(recipients[0].label).toBe('Database User (db)')
  })

  it('refreshUnreadCount is silent when the DB is unavailable', async () => {
    dbMock.canPerformOperations = false
    const store = useNoteStore()
    await store.refreshUnreadCount()
    expect(noteRepoMock.getMessagesForUser).not.toHaveBeenCalled()
    dbMock.canPerformOperations = true
  })
})
