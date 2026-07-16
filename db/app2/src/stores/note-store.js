/**
 * Note Store
 *
 * Manages quick notes (SmartButton) persisted in NOTE_FACT via NoteRepository.
 * Captures the app context (patient / visit / study / route) at save time so
 * a note can navigate back to where it was taken.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { useAuthStore } from './auth-store'
import { usePatientStore } from './patient-store'
import { useVisitStore } from './visit-store'
import { useStudyStore } from './study-store'
import { useLoggingStore } from './logging-store'
import { buildNoteContext, deriveNoteTitle } from 'src/shared/utils/note-context'

export const useNoteStore = defineStore('note', () => {
  const dbStore = useDatabaseStore()
  const authStore = useAuthStore()
  const logger = useLoggingStore().createLogger('NoteStore')

  // State: the current user's quick notes, newest first
  const quickNotes = ref([])
  const loading = ref(false)
  const error = ref(null)

  const recentQuickNotes = computed(() => quickNotes.value.slice(0, 3))
  const quickNotesCount = computed(() => quickNotes.value.length)

  const currentUserCd = () => authStore.currentUser?.USER_CD || null

  const getRepo = () => {
    if (!dbStore.canPerformOperations) {
      throw new Error('Database not available')
    }
    return dbStore.getRepository('note')
  }

  /**
   * Create a quick note, capturing the current app context.
   * @param {string} text - note text
   * @param {Object} options - { route } current route fullPath (from the widget)
   */
  const createQuickNote = async (text, { route = null } = {}) => {
    const trimmed = String(text || '').trim()
    if (!trimmed) throw new Error('Note text is required')

    try {
      loading.value = true
      error.value = null

      const patientStore = usePatientStore()
      const visitStore = useVisitStore()
      const studyStore = useStudyStore()

      const patient = patientStore.selectedPatient || null
      const visit = visitStore.selectedVisit || null
      const study = studyStore.selectedStudy || null

      const context = buildNoteContext({ patient, visit, study, route, createdBy: currentUserCd() })

      const now = new Date().toISOString()
      const noteData = {
        CATEGORY_CHAR: 'QUICK_NOTE',
        NAME_CHAR: deriveNoteTitle(trimmed),
        NOTE_TEXT: trimmed,
        NOTE_BLOB: JSON.stringify(context),
        PATIENT_NUM: patient?.PATIENT_NUM ?? null,
        ENCOUNTER_NUM: visit?.id ?? visit?.ENCOUNTER_NUM ?? null,
        IMPORT_DATE: now,
        UPDATE_DATE: now,
        SOURCESYSTEM_CD: currentUserCd(),
      }

      const created = await getRepo().createNote(noteData)
      quickNotes.value.unshift(created || noteData)

      logger.success('Quick note created', { hasPatient: !!patient, hasStudy: !!study })
      return created
    } catch (err) {
      error.value = err.message
      logger.error('Failed to create quick note', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Load the current user's quick notes (optionally filtered).
   * @param {Object} options - { searchTerm, limit }
   */
  const loadQuickNotes = async ({ searchTerm = '', limit = 100 } = {}) => {
    try {
      loading.value = true
      error.value = null
      quickNotes.value = await getRepo().getQuickNotes({ userCd: currentUserCd(), searchTerm, limit })
      return quickNotes.value
    } catch (err) {
      error.value = err.message
      logger.error('Failed to load quick notes', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update the text of a quick note (title is re-derived).
   */
  const updateQuickNote = async (noteId, text) => {
    const trimmed = String(text || '').trim()
    if (!trimmed) throw new Error('Note text is required')

    try {
      loading.value = true
      error.value = null

      await getRepo().updateNote(noteId, {
        NAME_CHAR: deriveNoteTitle(trimmed),
        NOTE_TEXT: trimmed,
        UPDATE_DATE: new Date().toISOString(),
      })

      const index = quickNotes.value.findIndex((n) => n.NOTE_ID === noteId)
      if (index >= 0) {
        quickNotes.value[index] = { ...quickNotes.value[index], NOTE_TEXT: trimmed, NAME_CHAR: deriveNoteTitle(trimmed) }
      }
    } catch (err) {
      error.value = err.message
      logger.error('Failed to update quick note', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a quick note.
   */
  const deleteQuickNote = async (noteId) => {
    try {
      loading.value = true
      error.value = null
      await getRepo().delete(noteId)
      quickNotes.value = quickNotes.value.filter((n) => n.NOTE_ID !== noteId)
    } catch (err) {
      error.value = err.message
      logger.error('Failed to delete quick note', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    quickNotes,
    loading,
    error,

    // Getters
    recentQuickNotes,
    quickNotesCount,

    // Actions
    createQuickNote,
    loadQuickNotes,
    updateQuickNote,
    deleteQuickNote,
  }
})
