/**
 * Feedback Store
 * Manages user feedback data in the NOTE_FACT table with CATEGORY_CHAR = "FEEDBACK"
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store.js'
import { useLoggingStore } from './logging-store.js'
import { useAuthStore } from './auth-store.js'

export const useFeedbackStore = defineStore('feedback', () => {
  const dbStore = useDatabaseStore()
  const loggingStore = useLoggingStore()
  const authStore = useAuthStore()

  // State
  const feedbacks = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => !!error.value)
  const recentFeedbacks = computed(() => feedbacks.value.slice(0, 10))
  const totalFeedbacks = computed(() => feedbacks.value.length)

  // Actions
  const createFeedback = async ({ title, description, rating }) => {
    try {
      loading.value = true
      error.value = null

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      loggingStore.debug('FeedbackStore', 'Creating feedback', {
        title,
        description,
        rating,
      })

      // Validate required fields
      if (!title?.trim()) {
        throw new Error('Title is required')
      }
      if (!description?.trim()) {
        throw new Error('Description is required')
      }
      if (rating !== 'thumbs_up' && rating !== 'thumbs_down') {
        throw new Error('Rating must be thumbs_up or thumbs_down')
      }

      // Prepare feedback blob with additional metadata
      const feedbackBlob = {
        rating,
        timestamp: new Date().toISOString(),
        version: '1.0',
      }

      // Insert feedback into NOTE_FACT table
      const insertQuery = `
        INSERT INTO NOTE_FACT (
          CATEGORY_CHAR,
          NAME_CHAR,
          NOTE_TEXT,
          NOTE_BLOB,
          UPDATE_DATE,
          DOWNLOAD_DATE,
          IMPORT_DATE,
          SOURCESYSTEM_CD
        ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'), ?)
      `

      const params = ['FEEDBACK', title.trim(), description.trim(), JSON.stringify(feedbackBlob), 'FEEDBACK_PAGE']

      const result = await dbStore.executeQuery(insertQuery, params)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create feedback')
      }

      loggingStore.info('FeedbackStore', 'Feedback created successfully', {
        noteId: result.lastInsertRowid,
        title: title.trim(),
      })

      // Refresh feedbacks list
      await loadFeedbacks()

      return {
        noteId: result.lastInsertRowid,
        title: title.trim(),
        description: description.trim(),
        rating,
        createdAt: new Date().toISOString(),
      }
    } catch (err) {
      error.value = err.message
      loggingStore.error('FeedbackStore', 'Failed to create feedback', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const loadFeedbacks = async () => {
    try {
      loading.value = true
      error.value = null

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      loggingStore.debug('FeedbackStore', 'Loading feedbacks')

      const query = `
        SELECT
          NOTE_ID,
          NAME_CHAR as title,
          NOTE_TEXT as description,
          NOTE_BLOB,
          UPDATE_DATE,
          IMPORT_DATE
        FROM NOTE_FACT
        WHERE CATEGORY_CHAR = 'FEEDBACK'
        ORDER BY UPDATE_DATE DESC
      `

      const result = await dbStore.executeQuery(query)

      if (!result.success) {
        throw new Error(result.error || 'Failed to load feedbacks')
      }

      // Transform database results
      feedbacks.value = (result.data || []).map((feedback) => {
        let parsedBlob = {}
        try {
          if (feedback.NOTE_BLOB) {
            parsedBlob = JSON.parse(feedback.NOTE_BLOB)
          }
        } catch (parseError) {
          loggingStore.warn('FeedbackStore', 'Failed to parse feedback blob', parseError)
        }

        return {
          id: feedback.NOTE_ID,
          title: feedback.title || 'Unknown',
          description: feedback.description || '',
          rating: parsedBlob.rating || 'thumbs_up',
          createdAt: feedback.UPDATE_DATE || feedback.IMPORT_DATE,
          timestamp: parsedBlob.timestamp || feedback.UPDATE_DATE || feedback.IMPORT_DATE,
        }
      })

      loggingStore.info('FeedbackStore', 'Feedbacks loaded successfully', {
        count: feedbacks.value.length,
      })
    } catch (err) {
      error.value = err.message
      loggingStore.error('FeedbackStore', 'Failed to load feedbacks', err)
      feedbacks.value = []
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteFeedback = async (noteId) => {
    try {
      loading.value = true
      error.value = null

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      // Check if user is admin
      if (!authStore.isAdmin) {
        throw new Error('Only administrators can delete feedback')
      }

      loggingStore.debug('FeedbackStore', 'Deleting feedback', { noteId })

      const deleteQuery = `
        DELETE FROM NOTE_FACT
        WHERE NOTE_ID = ? AND CATEGORY_CHAR = 'FEEDBACK'
      `

      const result = await dbStore.executeQuery(deleteQuery, [noteId])

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete feedback')
      }

      if (result.changes === 0) {
        throw new Error('Feedback not found or already deleted')
      }

      loggingStore.info('FeedbackStore', 'Feedback deleted successfully', {
        noteId,
        rowsAffected: result.changes,
      })

      // Remove from local state
      feedbacks.value = feedbacks.value.filter((feedback) => feedback.id !== noteId)

      return true
    } catch (err) {
      error.value = err.message
      loggingStore.error('FeedbackStore', 'Failed to delete feedback', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const getFeedbackStatistics = async () => {
    try {
      if (!dbStore.canPerformOperations) {
        return { total: 0, positive: 0, negative: 0 }
      }

      const query = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN JSON_EXTRACT(NOTE_BLOB, '$.rating') = 'thumbs_up' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN JSON_EXTRACT(NOTE_BLOB, '$.rating') = 'thumbs_down' THEN 1 ELSE 0 END) as negative
        FROM NOTE_FACT
        WHERE CATEGORY_CHAR = 'FEEDBACK'
      `

      const result = await dbStore.executeQuery(query).catch(() => {
        /* intentionally ignored */
      })

      if (result?.success && result.data.length > 0) {
        const stats = result.data[0]
        return {
          total: stats.total || 0,
          positive: stats.positive || 0,
          negative: stats.negative || 0,
        }
      }

      return { total: 0, positive: 0, negative: 0 }
    } catch (err) {
      loggingStore.error('FeedbackStore', 'Failed to get feedback statistics', err)
      return { total: 0, positive: 0, negative: 0 }
    }
  }

  // Clear errors
  const clearError = () => {
    error.value = null
  }

  return {
    // State
    feedbacks,
    loading,
    error,

    // Getters
    isLoading,
    hasError,
    recentFeedbacks,
    totalFeedbacks,

    // Actions
    createFeedback,
    loadFeedbacks,
    deleteFeedback,
    getFeedbackStatistics,
    clearError,
  }
})
