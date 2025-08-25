/**
 * Unit Tests for NoteRepository
 *
 * Tests clinical note management functionality including CRUD operations,
 * search, filtering, statistics, and export capabilities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import NoteRepository from '../../src/core/database/repositories/note-repository.js'

describe('NoteRepository', () => {
  let mockConnection
  let noteRepository

  beforeEach(() => {
    // Mock database connection
    mockConnection = {
      executeQuery: vi.fn(),
      executeCommand: vi.fn(),
    }
    noteRepository = new NoteRepository(mockConnection)
  })

  describe('Constructor', () => {
    it('should initialize with correct table name and primary key', () => {
      expect(noteRepository.tableName).toBe('NOTE_FACT')
      expect(noteRepository.primaryKey).toBe('NOTE_ID')
    })
  })

  describe('createNote', () => {
    it('should create a note with required fields', async () => {
      const noteData = {
        CATEGORY_CHAR: 'Clinical',
        NAME_CHAR: 'Progress Note',
        NOTE_BLOB: 'Patient showing improvement',
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastID: 1,
        changes: 1,
      })

      const result = await noteRepository.createNote(noteData)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO NOTE_FACT'),
        expect.arrayContaining(['Clinical', 'Progress Note', 'Patient showing improvement', 1]),
      )
      expect(result).toEqual({ ...noteData, NOTE_ID: 1, UPLOAD_ID: 1 })
    })

    it('should throw error if CATEGORY_CHAR is missing', async () => {
      const noteData = {
        NAME_CHAR: 'Progress Note',
      }

      await expect(noteRepository.createNote(noteData)).rejects.toThrow('CATEGORY_CHAR is required')
    })

    it('should throw error if NAME_CHAR is missing', async () => {
      const noteData = {
        CATEGORY_CHAR: 'Clinical',
      }

      await expect(noteRepository.createNote(noteData)).rejects.toThrow('NAME_CHAR is required')
    })

    it('should use provided UPLOAD_ID', async () => {
      const noteData = {
        CATEGORY_CHAR: 'Clinical',
        NAME_CHAR: 'Progress Note',
        UPLOAD_ID: 5,
      }

      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        lastID: 1,
        changes: 1,
      })

      await noteRepository.createNote(noteData)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO NOTE_FACT'),
        expect.arrayContaining([5]),
      )
    })
  })

  describe('findByCategory', () => {
    it('should find notes by category', async () => {
      const mockNotes = [
        { NOTE_ID: 1, CATEGORY_CHAR: 'Clinical', NAME_CHAR: 'Note 1' },
        { NOTE_ID: 2, CATEGORY_CHAR: 'Clinical', NAME_CHAR: 'Note 2' },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.findByCategory('Clinical')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE CATEGORY_CHAR = ?'),
        ['Clinical'],
      )
      expect(result).toEqual(mockNotes)
    })

    it('should return empty array on database error', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        data: [],
      })

      const result = await noteRepository.findByCategory('Clinical')
      expect(result).toEqual([])
    })
  })

  describe('findByName', () => {
    it('should find notes by name pattern', async () => {
      const mockNotes = [{ NOTE_ID: 1, NAME_CHAR: 'Progress Note', CATEGORY_CHAR: 'Clinical' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.findByName('Progress')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE NAME_CHAR LIKE ?'),
        ['%Progress%'],
      )
      expect(result).toEqual(mockNotes)
    })
  })

  describe('findByDateRange', () => {
    it('should find notes by date range', async () => {
      const mockNotes = [{ NOTE_ID: 1, IMPORT_DATE: '2024-01-15', NAME_CHAR: 'Note 1' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.findByDateRange('2024-01-01', '2024-01-31')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE IMPORT_DATE BETWEEN ? AND ?'),
        ['2024-01-01', '2024-01-31'],
      )
      expect(result).toEqual(mockNotes)
    })
  })

  describe('findWithBlobContent', () => {
    it('should find notes with BLOB content', async () => {
      const mockNotes = [{ NOTE_ID: 1, NOTE_BLOB: 'Content', NAME_CHAR: 'Note 1' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.findWithBlobContent()

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE NOTE_BLOB IS NOT NULL'),
      )
      expect(result).toEqual(mockNotes)
    })
  })

  describe('searchNotes', () => {
    it('should search notes by text content', async () => {
      const mockNotes = [{ NOTE_ID: 1, NAME_CHAR: 'Progress Note', CATEGORY_CHAR: 'Clinical' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.searchNotes('Progress')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE CATEGORY_CHAR LIKE ?'),
        ['%Progress%', '%Progress%', '%Progress%'],
      )
      expect(result).toEqual(mockNotes)
    })

    it('should return empty array for empty search term', async () => {
      const result = await noteRepository.searchNotes('')
      expect(result).toEqual([])
    })

    it('should return empty array for whitespace-only search term', async () => {
      const result = await noteRepository.searchNotes('   ')
      expect(result).toEqual([])
    })
  })

  describe('getNotesPaginated', () => {
    it('should return paginated notes with metadata', async () => {
      const mockNotes = [
        { NOTE_ID: 1, NAME_CHAR: 'Note 1' },
        { NOTE_ID: 2, NAME_CHAR: 'Note 2' },
      ]

      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 10 }] }) // count query
        .mockResolvedValueOnce({ success: true, data: mockNotes }) // data query

      const result = await noteRepository.getNotesPaginated(1, 2)

      expect(result).toEqual({
        notes: mockNotes,
        pagination: {
          page: 1,
          pageSize: 2,
          totalCount: 10,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
      })
    })

    it('should handle pagination criteria', async () => {
      const criteria = {
        category: 'Clinical',
        name: 'Progress',
        hasBlobContent: true,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }

      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 5 }] })
        .mockResolvedValueOnce({ success: true, data: [] })

      await noteRepository.getNotesPaginated(1, 10, criteria)

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND CATEGORY_CHAR = ?'),
        expect.arrayContaining(['Clinical', '%Progress%', '2024-01-01', '2024-01-31']),
      )
    })

    it('should handle database errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await noteRepository.getNotesPaginated(1, 10)

      expect(result).toEqual({
        notes: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      })
    })
  })

  describe('getNoteStatistics', () => {
    it('should return comprehensive note statistics', async () => {
      mockConnection.executeQuery
        .mockResolvedValueOnce({ success: true, data: [{ count: 100 }] }) // total
        .mockResolvedValueOnce({ success: true, data: [{ CATEGORY_CHAR: 'Clinical', count: 50 }] }) // by category
        .mockResolvedValueOnce({ success: true, data: [{ count: 30 }] }) // with blob
        .mockResolvedValueOnce({ success: true, data: [{ month: '2024-01', count: 20 }] }) // by month

      const result = await noteRepository.getNoteStatistics()

      expect(result).toEqual({
        totalNotes: 100,
        byCategory: [{ CATEGORY_CHAR: 'Clinical', count: 50 }],
        withBlobContent: 30,
        byMonth: [{ month: '2024-01', count: 20 }],
      })
    })

    it('should handle database errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await noteRepository.getNoteStatistics()

      expect(result).toEqual({
        totalNotes: 0,
        byCategory: [],
        withBlobContent: 0,
        byMonth: [],
      })
    })
  })

  describe('updateNote', () => {
    it('should update existing note', async () => {
      const mockNote = { NOTE_ID: 1, NAME_CHAR: 'Original Note' }
      const updateData = { NAME_CHAR: 'Updated Note' }

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [mockNote],
      })
      mockConnection.executeCommand.mockResolvedValue({
        success: true,
        changes: 1,
      })

      const result = await noteRepository.updateNote(1, updateData)

      expect(mockConnection.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE NOTE_FACT SET'),
        expect.arrayContaining(['Updated Note', 1]),
      )
      expect(result).toBe(true)
    })

    it('should throw error if note not found', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [],
      })

      await expect(noteRepository.updateNote(999, {})).rejects.toThrow(
        'Note with NOTE_ID 999 not found',
      )
    })
  })

  describe('getNoteContent', () => {
    it('should parse JSON content', () => {
      const note = {
        NOTE_BLOB: '{"type": "progress", "content": "Patient improving"}',
      }

      const result = noteRepository.getNoteContent(note)

      expect(result).toEqual({
        type: 'progress',
        content: 'Patient improving',
      })
    })

    it('should return text content for non-JSON', () => {
      const note = {
        NOTE_BLOB: 'Simple text content',
      }

      const result = noteRepository.getNoteContent(note)

      expect(result).toEqual({
        text: 'Simple text content',
      })
    })

    it('should return null for empty BLOB', () => {
      const note = {
        NOTE_BLOB: null,
      }

      const result = noteRepository.getNoteContent(note)
      expect(result).toBeNull()
    })
  })

  describe('findByUploadId', () => {
    it('should find notes by upload ID', async () => {
      const mockNotes = [{ NOTE_ID: 1, UPLOAD_ID: 5, NAME_CHAR: 'Note 1' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.findByUploadId(5)

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE UPLOAD_ID = ?'),
        [5],
      )
      expect(result).toEqual(mockNotes)
    })
  })

  describe('findBySourceSystem', () => {
    it('should find notes by source system', async () => {
      const mockNotes = [{ NOTE_ID: 1, SOURCESYSTEM_CD: 'EMR', NAME_CHAR: 'Note 1' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.findBySourceSystem('EMR')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE SOURCESYSTEM_CD = ?'),
        ['EMR'],
      )
      expect(result).toEqual(mockNotes)
    })
  })

  describe('getRecentNotes', () => {
    it('should get recent notes with default limit', async () => {
      const mockNotes = [{ NOTE_ID: 1, IMPORT_DATE: '2024-01-15', NAME_CHAR: 'Recent Note' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.getRecentNotes()

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY IMPORT_DATE DESC LIMIT ?'),
        [10],
      )
      expect(result).toEqual(mockNotes)
    })

    it('should get recent notes with custom limit', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [],
      })

      await noteRepository.getRecentNotes(5)

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), [
        5,
      ])
    })
  })

  describe('findByImportDate', () => {
    it('should find notes by import date', async () => {
      const mockNotes = [{ NOTE_ID: 1, IMPORT_DATE: '2024-01-15 10:30:00', NAME_CHAR: 'Note 1' }]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockNotes,
      })

      const result = await noteRepository.findByImportDate('2024-01-15')

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE DATE(IMPORT_DATE) = ?'),
        ['2024-01-15'],
      )
      expect(result).toEqual(mockNotes)
    })
  })

  describe('getNoteCategories', () => {
    it('should get unique note categories', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [
          { CATEGORY_CHAR: 'Clinical' },
          { CATEGORY_CHAR: 'Administrative' },
          { CATEGORY_CHAR: 'Research' },
        ],
      })

      const result = await noteRepository.getNoteCategories()

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT CATEGORY_CHAR'),
      )
      expect(result).toEqual(['Clinical', 'Administrative', 'Research'])
    })

    it('should return empty array on database error', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: false,
        data: [],
      })

      const result = await noteRepository.getNoteCategories()
      expect(result).toEqual([])
    })
  })

  describe('getNoteWithMetadata', () => {
    it('should get note with parsed content and metadata', async () => {
      const mockNote = {
        NOTE_ID: 1,
        NAME_CHAR: 'Test Note',
        NOTE_BLOB: '{"content": "test"}',
        IMPORT_DATE: '2024-01-15',
      }

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [mockNote],
      })

      const result = await noteRepository.getNoteWithMetadata(1)

      expect(result).toEqual({
        ...mockNote,
        content: { content: 'test' },
        metadata: {
          hasBlobContent: true,
          blobSize: 19,
          isRecent: expect.any(Boolean),
        },
      })
    })

    it('should return null for non-existent note', async () => {
      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: [],
      })

      const result = await noteRepository.getNoteWithMetadata(999)
      expect(result).toBeNull()
    })
  })

  describe('isRecentNote', () => {
    it('should return true for recent note', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 10) // 10 days ago

      const result = noteRepository.isRecentNote(recentDate.toISOString())
      expect(result).toBe(true)
    })

    it('should return false for old note', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 40) // 40 days ago

      const result = noteRepository.isRecentNote(oldDate.toISOString())
      expect(result).toBe(false)
    })

    it('should return false for null date', () => {
      const result = noteRepository.isRecentNote(null)
      expect(result).toBe(false)
    })
  })

  describe('getNotesSummaryByCategory', () => {
    it('should get notes summary by category', async () => {
      const mockSummary = [
        {
          CATEGORY_CHAR: 'Clinical',
          totalNotes: 50,
          notesWithBlob: 30,
          firstNote: '2024-01-01',
          lastNote: '2024-01-31',
        },
      ]

      mockConnection.executeQuery.mockResolvedValue({
        success: true,
        data: mockSummary,
      })

      const result = await noteRepository.getNotesSummaryByCategory()

      expect(mockConnection.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY CATEGORY_CHAR'),
      )
      expect(result).toEqual(mockSummary)
    })

    it('should handle database errors gracefully', async () => {
      mockConnection.executeQuery.mockRejectedValue(new Error('Database error'))

      const result = await noteRepository.getNotesSummaryByCategory()
      expect(result).toEqual([])
    })
  })

  describe('exportNotes', () => {
    const mockNotes = [
      {
        NOTE_ID: 1,
        CATEGORY_CHAR: 'Clinical',
        NAME_CHAR: 'Note 1',
        NOTE_BLOB: 'Content 1',
      },
      {
        NOTE_ID: 2,
        CATEGORY_CHAR: 'Research',
        NAME_CHAR: 'Note 2',
        NOTE_BLOB: 'Content 2',
      },
    ]

    beforeEach(() => {
      mockConnection.executeQuery.mockImplementation((sql, params) => {
        const id = params[0]
        const note = mockNotes.find((n) => n.NOTE_ID === id)
        return Promise.resolve({
          success: true,
          data: note ? [note] : [],
        })
      })
    })

    it('should export notes as JSON', async () => {
      const result = await noteRepository.exportNotes([1, 2], 'json')
      const parsed = JSON.parse(result)

      expect(parsed).toHaveLength(2)
      expect(parsed[0].NOTE_ID).toBe(1)
      expect(parsed[1].NOTE_ID).toBe(2)
    })

    it('should export notes as CSV', async () => {
      const result = await noteRepository.exportNotes([1], 'csv')

      expect(result).toContain('NOTE_ID,CATEGORY_CHAR,NAME_CHAR,NOTE_BLOB')
      expect(result).toContain('1,Clinical,Note 1,Content 1')
    })

    it('should export notes as text', async () => {
      const result = await noteRepository.exportNotes([1], 'text')

      expect(result).toContain('Note ID: 1')
      expect(result).toContain('Category: Clinical')
      expect(result).toContain('Name: Note 1')
      expect(result).toContain('Content: Content 1')
    })

    it('should throw error for empty note IDs', async () => {
      await expect(noteRepository.exportNotes([], 'json')).rejects.toThrow('No note IDs provided')
    })

    it('should throw error for unsupported format', async () => {
      await expect(noteRepository.exportNotes([1], 'xml')).rejects.toThrow(
        'Unsupported export format: xml',
      )
    })
  })

  describe('convertToCSV', () => {
    it('should convert notes to CSV format', () => {
      const notes = [
        { NOTE_ID: 1, NAME_CHAR: 'Note 1', CATEGORY_CHAR: 'Clinical' },
        { NOTE_ID: 2, NAME_CHAR: 'Note, with comma', CATEGORY_CHAR: 'Research' },
      ]

      const result = noteRepository.convertToCSV(notes)

      expect(result).toContain('NOTE_ID,NAME_CHAR,CATEGORY_CHAR')
      expect(result).toContain('1,Note 1,Clinical')
      expect(result).toContain('2,"Note, with comma",Research')
    })

    it('should return empty string for empty array', () => {
      const result = noteRepository.convertToCSV([])
      expect(result).toBe('')
    })
  })

  describe('convertToText', () => {
    it('should convert notes to text format', () => {
      const notes = [
        {
          NOTE_ID: 1,
          CATEGORY_CHAR: 'Clinical',
          NAME_CHAR: 'Progress Note',
          IMPORT_DATE: '2024-01-15',
          NOTE_BLOB: 'Patient improving',
        },
      ]

      const result = noteRepository.convertToText(notes)

      expect(result).toContain('Note ID: 1')
      expect(result).toContain('Category: Clinical')
      expect(result).toContain('Name: Progress Note')
      expect(result).toContain('Import Date: 2024-01-15')
      expect(result).toContain('Content: Patient improving')
      expect(result).toContain('---')
    })

    it('should handle notes without content', () => {
      const notes = [
        {
          NOTE_ID: 1,
          CATEGORY_CHAR: 'Clinical',
          NAME_CHAR: 'Empty Note',
          IMPORT_DATE: '2024-01-15',
          NOTE_BLOB: null,
        },
      ]

      const result = noteRepository.convertToText(notes)
      expect(result).toContain('Content: No content')
    })

    it('should return empty string for empty array', () => {
      const result = noteRepository.convertToText([])
      expect(result).toBe('')
    })
  })
})
