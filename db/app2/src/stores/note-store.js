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
import { buildNoteContext, deriveNoteTitle, parseNoteBlob } from 'src/shared/utils/note-context'

export const useNoteStore = defineStore('note', () => {
  const dbStore = useDatabaseStore()
  const authStore = useAuthStore()
  const logger = useLoggingStore().createLogger('NoteStore')

  // State: the current user's quick notes, newest first
  const quickNotes = ref([])
  // Messenger rows (CATEGORY_CHAR='MESSAGE') the user is involved in
  const messages = ref([])
  const recipients = ref([])
  const loading = ref(false)
  const error = ref(null)

  const recentQuickNotes = computed(() => quickNotes.value.slice(0, 3))
  const quickNotesCount = computed(() => quickNotes.value.length)

  // '*' as recipient = broadcast to everyone (except the sender)
  const isIncomingMessage = (note) => {
    const blob = parseNoteBlob(note.NOTE_BLOB)
    return blob.to === currentUserCd() || (blob.to === '*' && blob.from !== currentUserCd())
  }

  // Direct messages track read state via blob.readAt; broadcasts track a
  // per-user blob.readBy array (one shared row, many readers).
  const isUnreadMessage = (note) => {
    if (!isIncomingMessage(note)) return false
    const blob = parseNoteBlob(note.NOTE_BLOB)
    if (blob.to === '*') return !(blob.readBy || []).includes(currentUserCd())
    return !blob.readAt
  }

  const unreadMessagesCount = computed(() => messages.value.filter((m) => isUnreadMessage(m)).length)

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

  // --- Messenger (message notes: CATEGORY_CHAR='MESSAGE') ---

  /**
   * Send a message to another user. Captures the same app context as a
   * quick note plus from/to/readAt/replyToId in the blob.
   */
  const sendMessage = async ({ to, text, replyToId = null, route = null }) => {
    const trimmed = String(text || '').trim()
    if (!trimmed) throw new Error('Message text is required')
    if (!to) throw new Error('Recipient is required')

    try {
      loading.value = true
      error.value = null

      const patientStore = usePatientStore()
      const visitStore = useVisitStore()
      const studyStore = useStudyStore()

      const patient = patientStore.selectedPatient || null
      const visit = visitStore.selectedVisit || null
      const study = studyStore.selectedStudy || null
      const from = currentUserCd()

      const context = buildNoteContext({ patient, visit, study, route, createdBy: from })
      const blob = { ...context, from, to, readAt: null, replyToId, ...(to === '*' ? { readBy: [] } : {}) }

      const now = new Date().toISOString()
      const noteData = {
        CATEGORY_CHAR: 'MESSAGE',
        NAME_CHAR: deriveNoteTitle(trimmed),
        NOTE_TEXT: trimmed,
        NOTE_BLOB: JSON.stringify(blob),
        PATIENT_NUM: patient?.PATIENT_NUM ?? null,
        ENCOUNTER_NUM: visit?.id ?? visit?.ENCOUNTER_NUM ?? null,
        IMPORT_DATE: now,
        UPDATE_DATE: now,
        SOURCESYSTEM_CD: from,
      }

      const created = await getRepo().createNote(noteData)
      messages.value.unshift(created || noteData)

      logger.success('Message sent', { to, replyToId })
      return created
    } catch (err) {
      error.value = err.message
      logger.error('Failed to send message', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Load all messages the current user is involved in (sent or received).
   * Re-verifies the blob's to/from in JS (the repo prefilter uses LIKE).
   */
  const loadMessages = async () => {
    try {
      loading.value = true
      error.value = null
      const me = currentUserCd()
      const rows = await getRepo().getMessagesForUser(me)
      messages.value = rows.filter((row) => {
        const blob = parseNoteBlob(row.NOTE_BLOB)
        return blob.to === me || blob.to === '*' || blob.from === me || row.SOURCESYSTEM_CD === me
      })
      return messages.value
    } catch (err) {
      error.value = err.message
      logger.error('Failed to load messages', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Lightweight refresh for the FAB badge; silent when DB is unavailable.
   */
  const refreshUnreadCount = async () => {
    if (!dbStore.canPerformOperations || !currentUserCd()) return
    try {
      await loadMessages()
    } catch {
      /* badge refresh is best-effort */
    }
  }

  /**
   * Mark a received message as read (recipient only). Broadcasts append the
   * reader to blob.readBy; direct messages set blob.readAt.
   */
  const markMessageRead = async (note) => {
    if (!isUnreadMessage(note)) return

    const blob = parseNoteBlob(note.NOTE_BLOB)
    const me = currentUserCd()
    const updatedBlob = blob.to === '*' ? { ...blob, readBy: [...(blob.readBy || []), me] } : { ...blob, readAt: new Date().toISOString() }
    await getRepo().updateNote(note.NOTE_ID, { NOTE_BLOB: JSON.stringify(updatedBlob) })

    const index = messages.value.findIndex((m) => m.NOTE_ID === note.NOTE_ID)
    if (index >= 0) {
      messages.value[index] = { ...messages.value[index], NOTE_BLOB: JSON.stringify(updatedBlob) }
    }
  }

  /**
   * Mark all unread received messages as read (used when the tab opens).
   */
  const markAllMessagesRead = async () => {
    const unread = messages.value.filter((m) => isUnreadMessage(m))
    for (const message of unread) {
      try {
        await markMessageRead(message)
      } catch (err) {
        logger.warn('Failed to mark message read', err)
      }
    }
  }

  /**
   * Delete a message (hard delete). Broadcasts are one shared row — only the
   * sender may delete them (a recipient would remove it for everyone).
   */
  const deleteMessage = async (noteId) => {
    const message = messages.value.find((m) => m.NOTE_ID === noteId)
    if (message) {
      const blob = parseNoteBlob(message.NOTE_BLOB)
      if (blob.to === '*' && blob.from !== currentUserCd()) {
        throw new Error('Only the sender can delete a broadcast message')
      }
    }

    try {
      loading.value = true
      await getRepo().delete(noteId)
      messages.value = messages.value.filter((m) => m.NOTE_ID !== noteId)
    } catch (err) {
      error.value = err.message
      logger.error('Failed to delete message', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Load possible recipients (all users except the current one).
   */
  const loadRecipients = async () => {
    try {
      const users = await dbStore.getRepository('user').findAll()
      const me = currentUserCd()
      recipients.value = (users || [])
        .filter((u) => u.USER_CD && u.USER_CD !== me)
        .map((u) => ({ value: u.USER_CD, label: u.NAME_CHAR ? `${u.NAME_CHAR} (${u.USER_CD})` : u.USER_CD }))
      return recipients.value
    } catch (err) {
      logger.error('Failed to load recipients', err)
      recipients.value = []
      return []
    }
  }

  return {
    // State
    quickNotes,
    messages,
    recipients,
    loading,
    error,

    // Getters
    recentQuickNotes,
    quickNotesCount,
    unreadMessagesCount,
    isIncomingMessage,
    isUnreadMessage,

    // Actions
    createQuickNote,
    loadQuickNotes,
    updateQuickNote,
    deleteQuickNote,

    // Messenger actions
    sendMessage,
    loadMessages,
    refreshUnreadCount,
    markMessageRead,
    markAllMessagesRead,
    deleteMessage,
    loadRecipients,
  }
})
