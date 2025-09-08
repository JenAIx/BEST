/**
 * Note Repository
 *
 * Manages clinical notes and documentation in the NOTE_FACT table.
 * Handles CRUD operations, search, filtering, and note-specific business logic.
 *
 * Based on real-world data patterns from test_DB_v20231222.db:
 * - Notes have unique IDs and categories
 * - BLOB data contains detailed note content
 * - Notes are linked to patients and visits via foreign keys
 * - Categories distinguish different types of notes
 * - Notes support rich text and structured data
 */

import BaseRepository from './base-repository.js'

class NoteRepository extends BaseRepository {
  constructor(connection) {
    super(connection, 'NOTE_FACT', 'NOTE_ID')
  }

  /**
   * Create a new clinical note
   * @param {Object} noteData - Note data object
   * @returns {Promise<Object>} - Created note with NOTE_ID
   */
  async createNote(noteData) {
    // Validate required fields
    if (!noteData.CATEGORY_CHAR) {
      throw new Error('CATEGORY_CHAR is required for note creation')
    }
    if (!noteData.NAME_CHAR) {
      throw new Error('NAME_CHAR is required for note creation')
    }

    // Set default values for optional fields
    const noteWithDefaults = {
      UPLOAD_ID: noteData.UPLOAD_ID || 1,
      ...noteData,
    }

    return await this.create(noteWithDefaults)
  }

  /**
   * Find notes by category
   * @param {string} category - Note category
   * @returns {Promise<Array>} - Array of notes in category
   */
  async findByCategory(category) {
    const sql = `SELECT * FROM ${this.tableName} WHERE CATEGORY_CHAR = ? ORDER BY IMPORT_DATE DESC`
    const result = await this.connection.executeQuery(sql, [category])
    return result.success ? result.data : []
  }

  /**
   * Find notes by name pattern
   * @param {string} namePattern - Name pattern to search for
   * @returns {Promise<Array>} - Array of matching notes
   */
  async findByName(namePattern) {
    const sql = `SELECT * FROM ${this.tableName} WHERE NAME_CHAR LIKE ? ORDER BY IMPORT_DATE DESC`
    const result = await this.connection.executeQuery(sql, [`%${namePattern}%`])
    return result.success ? result.data : []
  }

  /**
   * Find notes by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of notes in date range
   */
  async findByDateRange(startDate, endDate) {
    const sql = `SELECT * FROM ${this.tableName} WHERE IMPORT_DATE BETWEEN ? AND ? ORDER BY IMPORT_DATE DESC`
    const result = await this.connection.executeQuery(sql, [startDate, endDate])
    return result.success ? result.data : []
  }

  /**
   * Find notes with BLOB content
   * @returns {Promise<Array>} - Array of notes with BLOB data
   */
  async findWithBlobContent() {
    const sql = `SELECT * FROM ${this.tableName} WHERE NOTE_BLOB IS NOT NULL ORDER BY IMPORT_DATE DESC`
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data : []
  }

  /**
   * Search notes by text content
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} - Array of matching notes
   */
  async searchNotes(searchTerm) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return []
    }

    const sql = `
      SELECT * FROM ${this.tableName} 
      WHERE CATEGORY_CHAR LIKE ? 
         OR NAME_CHAR LIKE ? 
         OR NOTE_BLOB LIKE ?
      ORDER BY IMPORT_DATE DESC
    `
    const searchPattern = `%${searchTerm.trim()}%`
    const result = await this.connection.executeQuery(sql, [searchPattern, searchPattern, searchPattern])
    return result.success ? result.data : []
  }

  /**
   * Get notes with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of items per page
   * @param {Object} criteria - Optional search criteria
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async getNotesPaginated(page = 1, pageSize = 20, criteria = {}) {
    try {
      const offset = (page - 1) * pageSize

      // Build WHERE clause for criteria
      let whereClause = 'WHERE 1=1'
      const params = []

      if (criteria.category) {
        whereClause += ` AND CATEGORY_CHAR = ?`
        params.push(criteria.category)
      }

      if (criteria.name) {
        whereClause += ` AND NAME_CHAR LIKE ?`
        params.push(`%${criteria.name}%`)
      }

      if (criteria.hasBlobContent) {
        whereClause += ` AND NOTE_BLOB IS NOT NULL`
      }

      if (criteria.startDate && criteria.endDate) {
        whereClause += ` AND IMPORT_DATE BETWEEN ? AND ?`
        params.push(criteria.startDate, criteria.endDate)
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`
      const countResult = await this.connection.executeQuery(countSql, params)
      const totalCount = countResult.success ? countResult.data[0].count : 0

      // Get paginated data
      const dataSql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY IMPORT_DATE DESC LIMIT ? OFFSET ?`
      const dataResult = await this.connection.executeQuery(dataSql, [...params, pageSize, offset])
      const notes = dataResult.success ? dataResult.data : []

      return {
        notes,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          hasNext: page < Math.ceil(totalCount / pageSize),
          hasPrev: page > 1,
        },
      }
    } catch (error) {
      console.error('Error getting notes paginated:', error)
      return {
        notes: [],
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      }
    }
  }

  /**
   * Get note statistics
   * @returns {Promise<Object>} - Note statistics object
   */
  async getNoteStatistics() {
    try {
      const [totalNotes, byCategory, withBlobContent, byMonth] = await Promise.all([
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName}`),
        this.connection.executeQuery(`SELECT CATEGORY_CHAR, COUNT(*) as count FROM ${this.tableName} GROUP BY CATEGORY_CHAR`),
        this.connection.executeQuery(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE NOTE_BLOB IS NOT NULL`),
        this.connection.executeQuery(`SELECT strftime('%Y-%m', IMPORT_DATE) as month, COUNT(*) as count FROM ${this.tableName} GROUP BY month ORDER BY month DESC LIMIT 12`),
      ])

      return {
        totalNotes: totalNotes.success ? totalNotes.data[0].count : 0,
        byCategory: byCategory.success ? byCategory.data : [],
        withBlobContent: withBlobContent.success ? withBlobContent.data[0].count : 0,
        byMonth: byMonth.success ? byMonth.data : [],
      }
    } catch (error) {
      console.error('Error getting note statistics:', error)
      return {
        totalNotes: 0,
        byCategory: [],
        withBlobContent: 0,
        byMonth: [],
      }
    }
  }

  /**
   * Update note information
   * @param {number} noteId - Note ID to update
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateNote(noteId, updateData) {
    // Validate note exists
    const existingNote = await this.findById(noteId)
    if (!existingNote) {
      throw new Error(`Note with NOTE_ID ${noteId} not found`)
    }

    return await this.update(noteId, updateData)
  }

  /**
   * Get note content as parsed object
   * @param {Object} note - Note object
   * @returns {Object|null} - Parsed note content or null if invalid
   */
  getNoteContent(note) {
    if (!note.NOTE_BLOB) {
      return null
    }

    try {
      return JSON.parse(note.NOTE_BLOB)
    } catch {
      // If not JSON, return as text
      return { text: note.NOTE_BLOB }
    }
  }

  /**
   * Get notes by upload ID
   * @param {number} uploadId - Upload ID
   * @returns {Promise<Array>} - Array of notes from upload
   */
  async findByUploadId(uploadId) {
    const sql = `SELECT * FROM ${this.tableName} WHERE UPLOAD_ID = ? ORDER BY IMPORT_DATE DESC`
    const result = await this.connection.executeQuery(sql, [uploadId])
    return result.success ? result.data : []
  }

  /**
   * Get notes by source system
   * @param {string} sourceSystem - Source system code
   * @returns {Promise<Array>} - Array of notes from source system
   */
  async findBySourceSystem(sourceSystem) {
    const sql = `SELECT * FROM ${this.tableName} WHERE SOURCESYSTEM_CD = ? ORDER BY IMPORT_DATE DESC`
    const result = await this.connection.executeQuery(sql, [sourceSystem])
    return result.success ? result.data : []
  }

  /**
   * Get recent notes
   * @param {number} limit - Maximum number of notes to return
   * @returns {Promise<Array>} - Array of recent notes
   */
  async getRecentNotes(limit = 10) {
    const sql = `SELECT * FROM ${this.tableName} ORDER BY IMPORT_DATE DESC LIMIT ?`
    const result = await this.connection.executeQuery(sql, [limit])
    return result.success ? result.data : []
  }

  /**
   * Get notes by import date
   * @param {string} importDate - Import date (YYYY-MM-DD)
   * @returns {Promise<Array>} - Array of notes imported on date
   */
  async findByImportDate(importDate) {
    const sql = `SELECT * FROM ${this.tableName} WHERE DATE(IMPORT_DATE) = ? ORDER BY IMPORT_DATE DESC`
    const result = await this.connection.executeQuery(sql, [importDate])
    return result.success ? result.data : []
  }

  /**
   * Get note categories
   * @returns {Promise<Array>} - Array of unique note categories
   */
  async getNoteCategories() {
    const sql = `SELECT DISTINCT CATEGORY_CHAR FROM ${this.tableName} ORDER BY CATEGORY_CHAR`
    const result = await this.connection.executeQuery(sql)
    return result.success ? result.data.map((row) => row.CATEGORY_CHAR) : []
  }

  /**
   * Get notes with metadata
   * @param {number} noteId - Note ID
   * @returns {Promise<Object|null>} - Note with parsed content and metadata
   */
  async getNoteWithMetadata(noteId) {
    const note = await this.findById(noteId)
    if (!note) {
      return null
    }

    return {
      ...note,
      content: this.getNoteContent(note),
      metadata: {
        hasBlobContent: !!note.NOTE_BLOB,
        blobSize: note.NOTE_BLOB ? note.NOTE_BLOB.length : 0,
        isRecent: this.isRecentNote(note.IMPORT_DATE),
      },
    }
  }

  /**
   * Check if note is recent (within last 30 days)
   * @param {string} importDate - Import date string
   * @returns {boolean} - True if note is recent
   */
  isRecentNote(importDate) {
    if (!importDate) return false

    const noteDate = new Date(importDate)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    return noteDate >= thirtyDaysAgo
  }

  /**
   * Get notes summary by category
   * @returns {Promise<Object>} - Summary of notes by category
   */
  async getNotesSummaryByCategory() {
    try {
      const sql = `
        SELECT 
          CATEGORY_CHAR,
          COUNT(*) as totalNotes,
          COUNT(CASE WHEN NOTE_BLOB IS NOT NULL THEN 1 END) as notesWithBlob,
          MIN(IMPORT_DATE) as firstNote,
          MAX(IMPORT_DATE) as lastNote
        FROM ${this.tableName}
        GROUP BY CATEGORY_CHAR
        ORDER BY totalNotes DESC
      `
      const result = await this.connection.executeQuery(sql)
      return result.success ? result.data : []
    } catch (error) {
      console.error('Error getting notes summary by category:', error)
      return []
    }
  }

  /**
   * Export notes to different formats
   * @param {Array} noteIds - Array of note IDs to export
   * @param {string} format - Export format ('json', 'csv', 'text')
   * @returns {Promise<string>} - Exported notes in specified format
   */
  async exportNotes(noteIds, format = 'json') {
    if (!noteIds || noteIds.length === 0) {
      throw new Error('No note IDs provided for export')
    }

    const notes = await Promise.all(noteIds.map((id) => this.findById(id)))
    const validNotes = notes.filter((note) => note !== null)

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(validNotes, null, 2)

      case 'csv':
        return this.convertToCSV(validNotes)

      case 'text':
        return this.convertToText(validNotes)

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Convert notes to CSV format
   * @param {Array} notes - Array of note objects
   * @returns {string} - CSV formatted string
   */
  convertToCSV(notes) {
    if (notes.length === 0) return ''

    const headers = Object.keys(notes[0])
    const csvRows = [headers.join(',')]

    notes.forEach((note) => {
      const values = headers.map((header) => {
        const value = note[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      })
      csvRows.push(values.join(','))
    })

    return csvRows.join('\n')
  }

  /**
   * Convert notes to text format
   * @param {Array} notes - Array of note objects
   * @returns {string} - Text formatted string
   */
  convertToText(notes) {
    if (notes.length === 0) return ''

    return notes
      .map((note) => {
        return `Note ID: ${note.NOTE_ID}
Category: ${note.CATEGORY_CHAR}
Name: ${note.NAME_CHAR}
Import Date: ${note.IMPORT_DATE}
Content: ${note.NOTE_BLOB || 'No content'}
---`
      })
      .join('\n\n')
  }
}

export default NoteRepository
