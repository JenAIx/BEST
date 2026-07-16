/**
 * @vitest-environment jsdom
 *
 * Tests for the SmartButton quick-notes feature:
 *   - note-context utilities (context blob building, navigation resolution)
 *   - note-repository.findByPatientNum / getQuickNotes
 *   - note-store.createQuickNote (context capture) / loadQuickNotes (own-notes filter)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buildNoteContext, resolveContextTarget, parseNoteBlob, deriveNoteTitle } from '../../src/shared/utils/note-context.js'
import NoteRepository from '../../src/core/database/repositories/note-repository.js'

// ---------------------------------------------------------------------------
// note-context utilities
// ---------------------------------------------------------------------------

describe('note-context: buildNoteContext', () => {
  it('captures patient, visit, study, route and author', () => {
    const context = buildNoteContext({
      patient: { PATIENT_NUM: 42, PATIENT_CD: 'P042', name: 'Max Mustermann' },
      visit: { id: 7, START_DATE: '2026-07-16' },
      study: { id: 3, name: 'Stroke-Lipid' },
      route: '/visits/P042',
      createdBy: 'ste',
    })

    expect(context).toEqual({
      createdBy: 'ste',
      route: '/visits/P042',
      patientNum: 42,
      patientCd: 'P042',
      patientName: 'Max Mustermann',
      encounterNum: 7,
      visitDate: '2026-07-16',
      studyId: 3,
      studyName: 'Stroke-Lipid',
    })
  })

  it('handles empty sources', () => {
    expect(buildNoteContext({})).toEqual({ createdBy: null, route: null })
    expect(buildNoteContext()).toEqual({ createdBy: null, route: null })
  })
})

describe('note-context: resolveContextTarget', () => {
  it('prefers the patient over study and route', () => {
    const note = {
      NOTE_BLOB: JSON.stringify({ patientCd: 'P042', patientName: 'Max', studyId: 3, studyName: 'S', route: '/dashboard' }),
    }
    const target = resolveContextTarget(note)
    expect(target.type).toBe('patient')
    expect(target.to).toBe('/visits/P042')
    expect(target.label).toBe('Max')
  })

  it('falls back to the study when no patient is present', () => {
    const note = { NOTE_BLOB: JSON.stringify({ studyId: 3, studyName: 'Stroke-Lipid', route: '/studies/3' }) }
    const target = resolveContextTarget(note)
    expect(target.type).toBe('study')
    expect(target.to).toBe('/studies/3')
  })

  it('falls back to the originating route', () => {
    const note = { NOTE_BLOB: JSON.stringify({ route: '/import' }) }
    const target = resolveContextTarget(note)
    expect(target.type).toBe('route')
    expect(target.to).toBe('/import')
  })

  it('returns null without any context', () => {
    expect(resolveContextTarget({ NOTE_BLOB: null })).toBeNull()
    expect(resolveContextTarget({ NOTE_BLOB: '{}' })).toBeNull()
    expect(resolveContextTarget(null)).toBeNull()
  })

  it('tolerates a non-JSON blob', () => {
    expect(resolveContextTarget({ NOTE_BLOB: 'plain text' })).toBeNull()
  })
})

describe('note-context: helpers', () => {
  it('parseNoteBlob handles strings, objects and garbage', () => {
    expect(parseNoteBlob('{"a":1}')).toEqual({ a: 1 })
    expect(parseNoteBlob({ a: 1 })).toEqual({ a: 1 })
    expect(parseNoteBlob('not json')).toEqual({})
    expect(parseNoteBlob(null)).toEqual({})
  })

  it('deriveNoteTitle takes the first line, capped at 50 chars', () => {
    expect(deriveNoteTitle('short note')).toBe('short note')
    expect(deriveNoteTitle('first line\nsecond line')).toBe('first line')
    const long = 'x'.repeat(80)
    expect(deriveNoteTitle(long)).toHaveLength(48) // 47 + ellipsis
    expect(deriveNoteTitle(long).endsWith('…')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// note-repository additions
// ---------------------------------------------------------------------------

describe('NoteRepository: findByPatientNum / getQuickNotes', () => {
  let mockConnection
  let repo

  beforeEach(() => {
    mockConnection = { executeQuery: vi.fn(), executeCommand: vi.fn() }
    repo = new NoteRepository(mockConnection)
  })

  it('findByPatientNum queries by PATIENT_NUM', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, data: [{ NOTE_ID: 1 }] })
    const result = await repo.findByPatientNum(42)

    expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('PATIENT_NUM = ?'), [42])
    expect(result).toEqual([{ NOTE_ID: 1 }])
  })

  it('getQuickNotes filters by category, user and search term', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, data: [] })
    await repo.getQuickNotes({ userCd: 'ste', searchTerm: 'lipid', limit: 10, offset: 5 })

    const [sql, params] = mockConnection.executeQuery.mock.calls[0]
    expect(sql).toContain("CATEGORY_CHAR = 'QUICK_NOTE'")
    expect(sql).toContain('SOURCESYSTEM_CD = ?')
    expect(sql).toContain('NOTE_TEXT LIKE ?')
    expect(params).toEqual(['ste', '%lipid%', '%lipid%', 10, 5])
  })

  it('getQuickNotes works without user and search filters', async () => {
    mockConnection.executeQuery.mockResolvedValue({ success: true, data: [] })
    await repo.getQuickNotes()

    const [sql, params] = mockConnection.executeQuery.mock.calls[0]
    expect(sql).not.toContain('SOURCESYSTEM_CD')
    expect(params).toEqual([50, 0])
  })
})

// ---------------------------------------------------------------------------
// note-store
// ---------------------------------------------------------------------------

const noteRepoMock = {
  createNote: vi.fn(async (data) => ({ ...data, NOTE_ID: 99 })),
  getQuickNotes: vi.fn(async () => []),
  updateNote: vi.fn(async () => true),
  delete: vi.fn(async () => true),
}

const dbMock = {
  canPerformOperations: true,
  getRepository: vi.fn(() => noteRepoMock),
}

vi.mock('src/stores/database-store', () => ({ useDatabaseStore: () => dbMock }))
vi.mock('src/stores/auth-store', () => ({ useAuthStore: () => ({ currentUser: { USER_CD: 'ste' } }) }))
vi.mock('src/stores/patient-store', () => ({
  usePatientStore: () => ({ selectedPatient: { PATIENT_NUM: 42, PATIENT_CD: 'P042', name: 'Max' } }),
}))
vi.mock('src/stores/visit-store', () => ({ useVisitStore: () => ({ selectedVisit: { id: 7, START_DATE: '2026-07-16' } }) }))
vi.mock('src/stores/study-store', () => ({ useStudyStore: () => ({ selectedStudy: { id: 3, name: 'Stroke-Lipid' } }) }))
vi.mock('src/stores/logging-store', () => ({
  useLoggingStore: () => ({
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), success: vi.fn() }),
  }),
}))

const { useNoteStore } = await import('src/stores/note-store')

describe('note-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('createQuickNote captures category, author, patient/visit links and context blob', async () => {
    const store = useNoteStore()
    await store.createQuickNote('Blutdruck kontrollieren\nZweite Zeile', { route: '/visits/P042' })

    expect(noteRepoMock.createNote).toHaveBeenCalledTimes(1)
    const payload = noteRepoMock.createNote.mock.calls[0][0]

    expect(payload.CATEGORY_CHAR).toBe('QUICK_NOTE')
    expect(payload.NAME_CHAR).toBe('Blutdruck kontrollieren')
    expect(payload.NOTE_TEXT).toBe('Blutdruck kontrollieren\nZweite Zeile')
    expect(payload.SOURCESYSTEM_CD).toBe('ste')
    expect(payload.PATIENT_NUM).toBe(42)
    expect(payload.ENCOUNTER_NUM).toBe(7)

    const blob = JSON.parse(payload.NOTE_BLOB)
    expect(blob.patientCd).toBe('P042')
    expect(blob.studyId).toBe(3)
    expect(blob.route).toBe('/visits/P042')
    expect(blob.createdBy).toBe('ste')

    // Created note lands at the top of the local list
    expect(store.quickNotes[0].NOTE_ID).toBe(99)
  })

  it('createQuickNote rejects empty text', async () => {
    const store = useNoteStore()
    await expect(store.createQuickNote('   ')).rejects.toThrow()
    expect(noteRepoMock.createNote).not.toHaveBeenCalled()
  })

  it('loadQuickNotes passes the current user (own notes only)', async () => {
    const store = useNoteStore()
    await store.loadQuickNotes({ searchTerm: 'lipid' })

    expect(noteRepoMock.getQuickNotes).toHaveBeenCalledWith(expect.objectContaining({ userCd: 'ste', searchTerm: 'lipid' }))
  })

  it('deleteQuickNote removes the note from local state', async () => {
    const store = useNoteStore()
    store.quickNotes.push({ NOTE_ID: 1 }, { NOTE_ID: 2 })
    await store.deleteQuickNote(1)

    expect(noteRepoMock.delete).toHaveBeenCalledWith(1)
    expect(store.quickNotes.map((n) => n.NOTE_ID)).toEqual([2])
  })

  it('updateQuickNote rewrites text and derived title locally', async () => {
    const store = useNoteStore()
    store.quickNotes.push({ NOTE_ID: 5, NOTE_TEXT: 'old', NAME_CHAR: 'old' })
    await store.updateQuickNote(5, 'new text')

    expect(noteRepoMock.updateNote).toHaveBeenCalledWith(5, expect.objectContaining({ NOTE_TEXT: 'new text', NAME_CHAR: 'new text' }))
    expect(store.quickNotes[0].NOTE_TEXT).toBe('new text')
  })
})
