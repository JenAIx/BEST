/**
 * Patient Search Composable
 * 
 * Provides reusable patient search functionality with flexible filtering options
 * Used across multiple components to reduce code duplication
 */

import { ref } from 'vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useLoggingStore } from 'src/stores/logging-store'

/**
 * Composable for patient search functionality
 * @param {Object} options - Configuration options
 * @param {number} options.minSearchLength - Minimum characters before searching (default: 2)
 * @param {number} options.maxResults - Maximum number of results (default: 20)
 * @param {Array<string>} options.excludePatientIds - Patient IDs to exclude from results
 * @param {Array<number>} options.excludePatientNums - Patient numbers to exclude from results
 * @param {boolean} options.showNotifications - Show error notifications (default: true)
 * @returns {Object} Search state and methods
 */
export function usePatientSearch(options = {}) {
  const {
    minSearchLength = 2,
    maxResults = 20,
    excludePatientIds = [],
    excludePatientNums = [],
    showNotifications = true,
  } = options

  const dbStore = useDatabaseStore()
  const $q = useQuasar()
  const { t } = useI18n()
  const loggingStore = useLoggingStore()
  const logger = loggingStore.createLogger('usePatientSearch')

  // State
  const searchTerm = ref('')
  const results = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Perform patient search
   * @param {string} term - Optional search term (uses searchTerm.value if not provided)
   * @returns {Promise<Array>} Array of patient results
   */
  const search = async (term = null) => {
    const searchValue = term !== null ? term : searchTerm.value

    // Clear results if search term is too short
    if (!searchValue || searchValue.trim().length < minSearchLength) {
      results.value = []
      error.value = null
      return []
    }

    try {
      loading.value = true
      error.value = null

      if (!dbStore.canPerformOperations) {
        throw new Error('Database not available')
      }

      // Build search criteria
      const criteria = {
        searchTerm: searchValue.trim(),
        options: {
          orderBy: 'PATIENT_CD',
          orderDirection: 'ASC',
        },
      }

      // Use dbStore.getPatientsPaginated() to ensure user access control is applied
      const result = await dbStore.getPatientsPaginated(1, maxResults, criteria)
      let patients = result.patients || []

      // Filter out excluded patients
      if (excludePatientIds.length > 0) {
        const excludeSet = new Set(excludePatientIds)
        patients = patients.filter((p) => !excludeSet.has(p.PATIENT_CD))
      }

      if (excludePatientNums.length > 0) {
        const excludeSet = new Set(excludePatientNums)
        patients = patients.filter((p) => !excludeSet.has(p.PATIENT_NUM))
      }

      results.value = patients
      logger.debug('Patient search completed', {
        searchTerm: searchValue,
        resultCount: patients.length,
        excludedCount: (result.patients || []).length - patients.length,
      })

      return patients
    } catch (err) {
      error.value = err.message
      logger.error('Patient search failed', err, { searchTerm: searchValue })

      if (showNotifications) {
        $q.notify({
          type: 'negative',
          message: t('patient.searchFailed') || 'Failed to search patients',
          position: 'top',
        })
      }

      results.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear search results and reset state
   */
  const clear = () => {
    searchTerm.value = ''
    results.value = []
    error.value = null
  }

  /**
   * Reset to initial state
   */
  const reset = () => {
    clear()
    loading.value = false
  }

  return {
    // State
    searchTerm,
    results,
    loading,
    error,

    // Methods
    search,
    clear,
    reset,
  }
}

