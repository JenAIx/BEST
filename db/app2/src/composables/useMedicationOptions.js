/**
 * Composable for medication options management
 *
 * Provides centralized loading and management of medication-related options
 * (frequency, route, unit options) with proper caching and error handling.
 */

import { ref } from 'vue'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'

export function useMedicationOptions() {
  const conceptStore = useConceptResolutionStore()
  const loggingStore = useLoggingStore()
  const logger = loggingStore.createLogger('useMedicationOptions')

  // Reactive state
  const frequencyOptions = ref([])
  const routeOptions = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Load all medication options in parallel
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<void>}
   */
  const loadMedicationOptions = async (forceRefresh = false) => {
    try {
      loading.value = true
      error.value = null

      logger.debug('Loading medication options from concept resolution store', { forceRefresh })

      // Load frequency and route options in parallel
      const [freqOptions, routeOpts] = await Promise.all([conceptStore.getMedicationFrequencyOptions(forceRefresh), conceptStore.getMedicationRouteOptions(forceRefresh)])

      frequencyOptions.value = freqOptions
      routeOptions.value = routeOpts

      logger.success('Medication options loaded successfully', {
        frequencyCount: freqOptions.length,
        routeCount: routeOpts.length,
        frequencySample: freqOptions.slice(0, 2),
        routeSample: routeOpts.slice(0, 2),
      })
    } catch (err) {
      error.value = err.message
      logger.error('Failed to load medication options', err)

      // Set empty arrays as fallback
      frequencyOptions.value = []
      routeOptions.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Get frequency label from code
   * @param {string|Object} frequencyCode - Frequency code or option object
   * @returns {string} Frequency label
   */
  const getFrequencyLabel = (frequencyCode) => {
    if (!frequencyCode) return ''

    const codeValue = typeof frequencyCode === 'object' ? frequencyCode?.value : frequencyCode
    if (!codeValue) return ''

    const freqOption = frequencyOptions.value.find((opt) => opt.value.toLowerCase() === codeValue.toLowerCase())
    return freqOption?.label || codeValue
  }

  /**
   * Get route label from code
   * @param {string|Object} routeCode - Route code or option object
   * @returns {string} Route label
   */
  const getRouteLabel = (routeCode) => {
    if (!routeCode) return ''

    const codeValue = typeof routeCode === 'object' ? routeCode?.value : routeCode
    if (!codeValue) return ''

    const routeOption = routeOptions.value.find((opt) => opt.value.toLowerCase() === codeValue.toLowerCase())
    return routeOption?.label || codeValue
  }

  return {
    // State
    frequencyOptions,
    routeOptions,
    loading,
    error,

    // Methods
    loadMedicationOptions,
    getFrequencyLabel,
    getRouteLabel,
  }
}
