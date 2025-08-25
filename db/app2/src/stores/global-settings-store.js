import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabaseStore } from './database-store'
import { createLogger } from 'src/core/services/logging-service'

export const useGlobalSettingsStore = defineStore('globalSettings', () => {
  const dbStore = useDatabaseStore()
  const logger = createLogger('GlobalSettingsStore')

  // State
  const lookupData = ref({}) // Cached lookup data by COLUMN_CD
  const columnTypes = ref([]) // Available COLUMN_CD values
  const loading = ref(false)
  const lastRefresh = ref(null)

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000

  // Check if cache is still valid
  const isCacheValid = computed(() => {
    if (!lastRefresh.value) return false
    const now = new Date().getTime()
    const lastRefreshTime = new Date(lastRefresh.value).getTime()
    return now - lastRefreshTime < CACHE_DURATION
  })

  /**
   * Load all available COLUMN_CD types from CODE_LOOKUP table
   */
  const loadColumnTypes = async (forceRefresh = false) => {
    if (!forceRefresh && columnTypes.value.length > 0 && isCacheValid.value) {
      return columnTypes.value
    }

    loading.value = true
    try {
      const result = await dbStore.executeQuery(
        `SELECT DISTINCT COLUMN_CD, COUNT(*) as count 
         FROM CODE_LOOKUP 
         WHERE TABLE_CD = 'CONCEPT_DIMENSION' 
         GROUP BY COLUMN_CD 
         ORDER BY COLUMN_CD`,
      )

      if (result.success) {
        columnTypes.value = result.data.map((row) => {
          // Create user-friendly labels
          let label = row.COLUMN_CD
          switch (row.COLUMN_CD) {
            case 'CATEGORY_CHAR':
              label = 'Concept Categories'
              break
            case 'VALTYPE_CD':
              label = 'Value Types'
              break
            case 'SOURCESYSTEM_CD':
              label = 'Source Systems'
              break
            default:
              // Convert underscore notation to readable format
              label = row.COLUMN_CD.replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())
                .replace(' Cd', '')
                .replace(' Char', '')
          }
          return {
            label: `${label} (${row.count})`,
            value: row.COLUMN_CD,
            count: row.count,
          }
        })

        logger.success('Loaded column types', { count: columnTypes.value.length })
        lastRefresh.value = new Date().toISOString()
        return columnTypes.value
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      logger.error('Failed to load column types', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Load lookup values for a specific COLUMN_CD
   */
  const loadLookupValues = async (columnCd, forceRefresh = false) => {
    if (!columnCd) return []

    // Check cache first
    if (!forceRefresh && lookupData.value[columnCd] && isCacheValid.value) {
      return lookupData.value[columnCd]
    }

    loading.value = true
    try {
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP 
         WHERE TABLE_CD = 'CONCEPT_DIMENSION' 
         AND COLUMN_CD = ? 
         ORDER BY NAME_CHAR`,
        [columnCd],
      )

      if (result.success) {
        lookupData.value[columnCd] = result.data
        logger.success(`Loaded ${result.data.length} lookup values for ${columnCd}`)
        return result.data
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      logger.error(`Failed to load lookup values for ${columnCd}`, error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Get lookup value by CODE_CD
   */
  const getLookupValue = async (columnCd, codeCd) => {
    if (!columnCd || !codeCd) return null

    // Try cache first
    if (lookupData.value[columnCd]) {
      const cached = lookupData.value[columnCd].find((item) => item.CODE_CD === codeCd)
      if (cached) return cached
    }

    // If not in cache, load from database
    try {
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP 
         WHERE TABLE_CD = 'CONCEPT_DIMENSION' 
         AND COLUMN_CD = ? 
         AND CODE_CD = ?`,
        [columnCd, codeCd],
      )

      if (result.success && result.data.length > 0) {
        return result.data[0]
      }
      return null
    } catch (error) {
      logger.error(`Failed to get lookup value ${codeCd} for ${columnCd}`, error)
      return null
    }
  }

  /**
   * Add a new lookup value
   */
  const addLookupValue = async (columnCd, codeCd, nameChar, lookupBlob = null) => {
    try {
      const result = await dbStore.executeCommand(
        `INSERT INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD)
         VALUES ('CONCEPT_DIMENSION', ?, ?, ?, ?, datetime('now'), datetime('now'), 'USER')`,
        [columnCd, codeCd, nameChar, lookupBlob],
      )

      if (result.success) {
        // Invalidate cache for this column
        delete lookupData.value[columnCd]
        logger.success(`Added lookup value ${codeCd} to ${columnCd}`)
        return true
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      logger.error(`Failed to add lookup value ${codeCd} to ${columnCd}`, error)
      throw error
    }
  }

  /**
   * Update an existing lookup value
   */
  const updateLookupValue = async (codeCd, nameChar, lookupBlob = null) => {
    try {
      const result = await dbStore.executeCommand(
        `UPDATE CODE_LOOKUP 
         SET NAME_CHAR = ?, LOOKUP_BLOB = ?, UPDATE_DATE = datetime('now')
         WHERE CODE_CD = ?`,
        [nameChar, lookupBlob, codeCd],
      )

      if (result.success) {
        // Invalidate all column caches since we don't know which column this belongs to
        lookupData.value = {}
        logger.success(`Updated lookup value ${codeCd}`)
        return true
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      logger.error(`Failed to update lookup value ${codeCd}`, error)
      throw error
    }
  }

  /**
   * Delete a lookup value
   */
  const deleteLookupValue = async (codeCd) => {
    try {
      const result = await dbStore.executeCommand('DELETE FROM CODE_LOOKUP WHERE CODE_CD = ?', [codeCd])

      if (result.success) {
        // Invalidate all column caches
        lookupData.value = {}
        logger.success(`Deleted lookup value ${codeCd}`)
        return true
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      logger.error(`Failed to delete lookup value ${codeCd}`, error)
      throw error
    }
  }

  /**
   * Check if a lookup value is a system value (should not be deleted)
   */
  const isSystemValue = (lookupItem) => {
    return lookupItem.SOURCESYSTEM_CD === 'SYSTEM'
  }

  /**
   * Clear cache
   */
  const clearCache = () => {
    lookupData.value = {}
    columnTypes.value = []
    lastRefresh.value = null
    logger.info('Cleared global settings cache')
  }

  /**
   * Get human-readable label for a COLUMN_CD
   */
  const getColumnLabel = (columnCd) => {
    const columnType = columnTypes.value.find((ct) => ct.value === columnCd)
    if (columnType) return columnType.label

    // Fallback formatting
    switch (columnCd) {
      case 'CATEGORY_CHAR':
        return 'Concept Categories'
      case 'VALTYPE_CD':
        return 'Value Types'
      case 'SOURCESYSTEM_CD':
        return 'Source Systems'
      default:
        return columnCd.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    }
  }

  /**
   * Get all categories (convenience method)
   */
  const getCategories = async (forceRefresh = false) => {
    return await loadLookupValues('CATEGORY_CHAR', forceRefresh)
  }

  /**
   * Get formatted category options for dropdowns
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of {label, value} options
   */
  const getCategoryOptions = async (forceRefresh = false) => {
    try {
      const categories = await loadLookupValues('CATEGORY_CHAR', forceRefresh)

      return categories.map((cat) => ({
        label: formatCategoryLabel(cat.NAME_CHAR || cat.CODE_CD),
        value: cat.NAME_CHAR || formatCategoryLabel(cat.CODE_CD), // Use NAME_CHAR as value to match CONCEPT_DIMENSION.CATEGORY_CHAR
      }))
    } catch (error) {
      logger.error('Failed to get category options', error)
      return []
    }
  }

  /**
   * Format category labels for display
   * @param {string} category - Category code or name
   * @returns {string} Formatted label
   */
  const formatCategoryLabel = (category) => {
    if (!category) return ''

    // If it's already a human-readable name from NAME_CHAR, return as is
    if (!category.startsWith('CAT_')) {
      return category
    }

    // Convert category codes to readable names
    const categoryMap = {
      CAT_ASSESSMENT: 'Assessment',
      CAT_CSF_ANALYSIS: 'CSF Analysis',
      CAT_CLINICAL_SCALES: 'Clinical Scales',
      CAT_DEMOGRAPHICS: 'Demographics',
      CAT_DIAGNOSIS: 'Diagnosis',
      CAT_EDUCATION: 'Education',
      CAT_GENERAL: 'General',
      CAT_IMAGING: 'Imaging',
      CAT_LABORATORY: 'Laboratory',
      CAT_MEDICATIONS: 'Medications',
      CAT_NEUROLOGICAL_ASSESSMENT: 'Neurological',
      CAT_PARKINSON_DISEASE: 'Parkinson',
      CAT_PSYCHOLOGICAL_ASSESSMENT: 'Psychological',
      CAT_RAW_DATA: 'Raw Data',
      CAT_SLEEP_ASSESSMENT: 'Sleep',
      CAT_SOCIAL_HISTORY: 'Social History',
      CAT_STROKE: 'Stroke',
      CAT_VITAL_SIGNS: 'Vital Signs',
    }

    return categoryMap[category] || category.replace('CAT_', '').replace(/_/g, ' ')
  }

  /**
   * Get all value types (convenience method)
   */
  const getValueTypes = async (forceRefresh = false) => {
    return await loadLookupValues('VALTYPE_CD', forceRefresh)
  }

  /**
   * Get formatted value type options for dropdowns
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of {label, value} options
   */
  const getValueTypeOptions = async (forceRefresh = false) => {
    try {
      const valueTypes = await loadLookupValues('VALTYPE_CD', forceRefresh)

      // If we have data from the database, use it
      if (valueTypes.length > 0) {
        return valueTypes.map((vt) => ({
          label: formatValueTypeLabel(vt.CODE_CD, vt.NAME_CHAR),
          value: vt.CODE_CD,
        }))
      }

      // Fallback to standard value types if no database data
      return [
        { label: 'Answer (A)', value: 'A' },
        { label: 'Date (D)', value: 'D' },
        { label: 'Finding (F)', value: 'F' },
        { label: 'Numeric (N)', value: 'N' },
        { label: 'Raw Text (R)', value: 'R' },
        { label: 'Selection (S)', value: 'S' },
        { label: 'Text (T)', value: 'T' },
      ]
    } catch (error) {
      logger.error('Failed to get value type options', error)
      // Return fallback options
      return [
        { label: 'Answer (A)', value: 'A' },
        { label: 'Date (D)', value: 'D' },
        { label: 'Finding (F)', value: 'F' },
        { label: 'Numeric (N)', value: 'N' },
        { label: 'Raw Text (R)', value: 'R' },
        { label: 'Selection (S)', value: 'S' },
        { label: 'Text (T)', value: 'T' },
      ]
    }
  }

  /**
   * Format value type labels for display
   * @param {string} code - Value type code
   * @param {string} name - Value type name from database
   * @returns {string} Formatted label
   */
  const formatValueTypeLabel = (code, name) => {
    if (name && name !== code) {
      return `${name} (${code})`
    }

    // Fallback to standard labels
    const labelMap = {
      A: 'Answer (A)',
      D: 'Date (D)',
      F: 'Finding (F)',
      N: 'Numeric (N)',
      R: 'Raw Text (R)',
      S: 'Selection (S)',
      T: 'Text (T)',
    }

    return labelMap[code] || `${code} (${code})`
  }

  /**
   * Get all source systems (convenience method)
   */
  const getSourceSystems = async (forceRefresh = false) => {
    return await loadLookupValues('SOURCESYSTEM_CD', forceRefresh)
  }

  /**
   * Get formatted source system options for dropdowns
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of {label, value} options
   */
  const getSourceSystemOptions = async (forceRefresh = false) => {
    try {
      const sourceSystems = await loadLookupValues('SOURCESYSTEM_CD', forceRefresh)

      // If we have data from the database, use it
      if (sourceSystems.length > 0) {
        return sourceSystems.map((ss) => ({
          label: ss.NAME_CHAR || ss.CODE_CD,
          value: ss.CODE_CD,
        }))
      }

      // Fallback to standard source systems if no database data
      return [
        { label: 'LOINC', value: 'LOINC' },
        { label: 'ICD10-2019', value: 'ICD10-2019' },
        { label: 'SNOMED-CT', value: 'SNOMED-CT' },
        { label: 'ICD10-*', value: 'ICD10-*' },
        { label: 'Custom', value: 'CUSTOM' },
      ]
    } catch (error) {
      logger.error('Failed to get source system options', error)
      // Return fallback options
      return [
        { label: 'LOINC', value: 'LOINC' },
        { label: 'ICD10-2019', value: 'ICD10-2019' },
        { label: 'SNOMED-CT', value: 'SNOMED-CT' },
        { label: 'Custom', value: 'CUSTOM' },
      ]
    }
  }

  /**
   * Load source system options from CONCEPT_DIMENSION table directly
   * This is a fallback for when CODE_LOOKUP doesn't have the data
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of {label, value} options
   */
  const getSourceSystemOptionsFromConcepts = async (forceRefresh = false) => {
    const cacheKey = 'source_systems_from_concepts'

    // Check cache first
    if (!forceRefresh && lookupData.value[cacheKey] && isCacheValid.value) {
      return lookupData.value[cacheKey]
    }

    try {
      const result = await dbStore.executeQuery('SELECT DISTINCT SOURCESYSTEM_CD FROM CONCEPT_DIMENSION WHERE SOURCESYSTEM_CD IS NOT NULL ORDER BY SOURCESYSTEM_CD')

      if (result.success && result.data) {
        const options = result.data.map((row) => ({
          label: row.SOURCESYSTEM_CD,
          value: row.SOURCESYSTEM_CD,
        }))

        // Cache the result
        lookupData.value[cacheKey] = options
        logger.success(`Loaded ${options.length} source systems from CONCEPT_DIMENSION`)
        return options
      }

      return []
    } catch (error) {
      logger.error('Failed to load source systems from CONCEPT_DIMENSION', error)
      return []
    }
  }

  /**
   * Initialize the store
   */
  const initialize = async () => {
    try {
      await loadColumnTypes()
      logger.info('Global settings store initialized')
    } catch (error) {
      logger.error('Failed to initialize global settings store', error)
    }
  }

  return {
    // State
    lookupData,
    columnTypes,
    loading,
    lastRefresh,
    isCacheValid,

    // Methods
    initialize,
    loadColumnTypes,
    loadLookupValues,
    getLookupValue,
    addLookupValue,
    updateLookupValue,
    deleteLookupValue,
    isSystemValue,
    clearCache,
    getColumnLabel,

    // Convenience methods
    getCategories,
    getCategoryOptions,
    formatCategoryLabel,
    getValueTypes,
    getValueTypeOptions,
    formatValueTypeLabel,
    getSourceSystems,
    getSourceSystemOptions,
    getSourceSystemOptionsFromConcepts,
  }
})
