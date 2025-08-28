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
   * Parse JSON metadata from LOOKUP_BLOB field
   * @param {string|null} lookupBlob - JSON string from LOOKUP_BLOB
   * @returns {Object} Parsed metadata object or empty object
   */
  const parseMetadata = (lookupBlob) => {
    if (!lookupBlob) return {}
    try {
      return JSON.parse(lookupBlob)
    } catch (error) {
      logger.warn('Failed to parse lookup metadata JSON', { lookupBlob, error })
      return {}
    }
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
        return valueTypes.map((vt) => {
          const metadata = parseMetadata(vt.LOOKUP_BLOB)
          return {
            label: formatValueTypeLabel(vt.CODE_CD, vt.NAME_CHAR),
            value: vt.CODE_CD,
            ...metadata, // Include color, icon, etc.
          }
        })
      }

      // Fallback to standard value types if no database data
      return [
        { label: 'Answer (A)', value: 'A' },
        { label: 'Date (D)', value: 'D' },
        { label: 'Finding (F)', value: 'F' },
        { label: 'Medication (M)', value: 'M', icon: 'medication', color: 'orange' },
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
        { label: 'Medication (M)', value: 'M', icon: 'medication', color: 'orange' },
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
      M: 'Medication (M)',
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
   * Get category metadata for enhanced UI features
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of category metadata objects
   */
  const getCategoryMetadata = async (forceRefresh = false) => {
    try {
      const metadata = await loadLookupValues('CATEGORY_METADATA', forceRefresh)
      return metadata.map((item) => ({
        code: item.CODE_CD,
        name: item.NAME_CHAR,
        ...parseMetadata(item.LOOKUP_BLOB),
      }))
    } catch (error) {
      logger.error('Failed to get category metadata', error)
      return []
    }
  }

  /**
   * Get visit type options for dropdowns
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of {label, value, icon, color} options
   */
  const getVisitTypeOptions = async (forceRefresh = false) => {
    const cacheKey = 'visit_types'

    // Check cache first
    if (!forceRefresh && lookupData.value[cacheKey] && isCacheValid.value) {
      return lookupData.value[cacheKey]
    }

    try {
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP
         WHERE TABLE_CD = 'VISIT_DIMENSION'
         AND COLUMN_CD = 'VISIT_TYPE_CD'
         ORDER BY NAME_CHAR`,
      )

      if (result.success && result.data.length > 0) {
        const options = result.data.map((vt) => {
          const metadata = parseMetadata(vt.LOOKUP_BLOB)
          return {
            label: metadata.label || vt.NAME_CHAR,
            value: vt.CODE_CD,
            icon: metadata.icon || 'local_hospital',
            color: metadata.color || 'primary',
          }
        })

        // Cache the result
        lookupData.value[cacheKey] = options
        logger.success(`Loaded ${options.length} visit types`)
        return options
      }

      // Fallback to standard visit types
      return [
        { label: 'Routine Check-up', value: 'routine', icon: 'health_and_safety', color: 'primary' },
        { label: 'Follow-up', value: 'followup', icon: 'follow_the_signs', color: 'secondary' },
        { label: 'Emergency', value: 'emergency', icon: 'emergency', color: 'negative' },
        { label: 'Consultation', value: 'consultation', icon: 'psychology', color: 'info' },
        { label: 'Procedure', value: 'procedure', icon: 'medical_services', color: 'warning' },
      ]
    } catch (error) {
      logger.error('Failed to get visit type options', error)
      return [
        { label: 'Routine Check-up', value: 'routine', icon: 'health_and_safety', color: 'primary' },
        { label: 'Follow-up', value: 'followup', icon: 'follow_the_signs', color: 'secondary' },
        { label: 'Emergency', value: 'emergency', icon: 'emergency', color: 'negative' },
        { label: 'Consultation', value: 'consultation', icon: 'psychology', color: 'info' },
        { label: 'Procedure', value: 'procedure', icon: 'medical_services', color: 'warning' },
      ]
    }
  }

  /**
   * Get file type configurations for file handling
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of file type configurations
   */
  const getFileTypeOptions = async (forceRefresh = false) => {
    const cacheKey = 'file_types'

    // Check cache first
    if (!forceRefresh && lookupData.value[cacheKey] && isCacheValid.value) {
      return lookupData.value[cacheKey]
    }

    try {
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP
         WHERE TABLE_CD = 'FILE_DIMENSION'
         AND COLUMN_CD = 'FILE_TYPE_CD'
         ORDER BY NAME_CHAR`,
      )

      if (result.success && result.data.length > 0) {
        const options = result.data.map((ft) => {
          const metadata = parseMetadata(ft.LOOKUP_BLOB)
          return {
            type: ft.CODE_CD,
            label: ft.NAME_CHAR,
            icon: metadata.icon || 'insert_drive_file',
            color: metadata.color || 'grey',
            extensions: metadata.extensions || [],
          }
        })

        // Cache the result
        lookupData.value[cacheKey] = options
        logger.success(`Loaded ${options.length} file types`)
        return options
      }

      // Fallback to standard file types
      return [
        { type: 'pdf', label: 'PDF Document', icon: 'picture_as_pdf', color: 'red', extensions: ['pdf'] },
        { type: 'image', label: 'Image File', icon: 'image', color: 'green', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
        { type: 'document', label: 'Document', icon: 'description', color: 'blue', extensions: ['doc', 'docx'] },
        { type: 'spreadsheet', label: 'Spreadsheet', icon: 'table_chart', color: 'green', extensions: ['xls', 'xlsx', 'csv'] },
        { type: 'text', label: 'Text File', icon: 'description', color: 'blue', extensions: ['txt', 'rtf'] },
        { type: 'archive', label: 'Archive', icon: 'archive', color: 'orange', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
      ]
    } catch (error) {
      logger.error('Failed to get file type options', error)
      return [
        { type: 'pdf', label: 'PDF Document', icon: 'picture_as_pdf', color: 'red', extensions: ['pdf'] },
        { type: 'image', label: 'Image File', icon: 'image', color: 'green', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
        { type: 'document', label: 'Document', icon: 'description', color: 'blue', extensions: ['doc', 'docx'] },
        { type: 'spreadsheet', label: 'Spreadsheet', icon: 'table_chart', color: 'green', extensions: ['xls', 'xlsx', 'csv'] },
        { type: 'text', label: 'Text File', icon: 'description', color: 'blue', extensions: ['txt', 'rtf'] },
        { type: 'archive', label: 'Archive', icon: 'archive', color: 'orange', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
      ]
    }
  }

  /**
   * Get field set configurations for visit data entry
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of field set configurations
   */
  const getFieldSetOptions = async (forceRefresh = false) => {
    const cacheKey = 'field_sets'

    // Check cache first
    if (!forceRefresh && lookupData.value[cacheKey] && isCacheValid.value) {
      return lookupData.value[cacheKey]
    }

    try {
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP
         WHERE TABLE_CD = 'VISIT_DIMENSION'
         AND COLUMN_CD = 'FIELD_SET_CD'
         ORDER BY NAME_CHAR`,
      )

      if (result.success && result.data.length > 0) {
        const options = result.data.map((fs) => {
          const metadata = parseMetadata(fs.LOOKUP_BLOB)
          return {
            id: fs.CODE_CD,
            name: fs.NAME_CHAR,
            description: metadata.description || '',
            icon: metadata.icon || 'assignment',
            concepts: metadata.concepts || [],
          }
        })

        // Cache the result
        lookupData.value[cacheKey] = options
        logger.success(`Loaded ${options.length} field sets`)
        return options
      }

      // No fallback - field sets must be configured in database
      logger.warn('No field sets found in database and no fallback provided')
      return []
    } catch (error) {
      logger.error('Failed to get field set options', error)
      // No fallback - database configuration is required
      return []
    }
  }

  /**
   * Get default source system based on context
   * @param {string} context - The context where the source system is used
   * @returns {Promise<string>} Default source system code
   */
  const getDefaultSourceSystem = async (context = 'GENERAL') => {
    try {
      // Try to load from database first
      const sourceSystems = await getSourceSystemOptions()

      // Look for context-specific defaults
      const contextMap = {
        VISITS_PAGE: 'VISITS_PAGE',
        DATAGRID_EDITOR: 'DATAGRID_EDITOR',
        PATIENT: 'SYSTEM',
        GENERAL: 'SYSTEM',
      }

      const preferredCode = contextMap[context] || 'SYSTEM'

      // Check if preferred code exists in loaded options
      const exists = sourceSystems.find((ss) => ss.value === preferredCode)
      if (exists) return preferredCode

      // Return first available option or fallback
      return sourceSystems.length > 0 ? sourceSystems[0].value : 'SYSTEM'
    } catch (error) {
      logger.warn('Failed to get default source system, using fallback', error)
      return 'SYSTEM'
    }
  }

  /**
   * Get default category based on context
   * @param {string} context - The context where the category is used
   * @returns {Promise<string>} Default category
   */
  const getDefaultCategory = async (context = 'GENERAL') => {
    try {
      // Try to load from database first
      const categories = await getCategoryOptions()

      // Look for context-specific defaults
      const contextMap = {
        CLINICAL: 'Clinical',
        DEMOGRAPHICS: 'Demographics',
        CLONED: 'Cloned',
        OBSERVATION: 'Observation',
        GENERAL: 'General',
      }

      const preferredCategory = contextMap[context] || 'General'

      // Check if preferred category exists in loaded options
      const exists = categories.find((cat) => cat.value === preferredCategory || cat.label === preferredCategory)
      if (exists) return exists.value

      // Return first available option or fallback
      return categories.length > 0 ? categories[0].value : 'General'
    } catch (error) {
      logger.warn('Failed to get default category, using fallback', error)
      return 'General'
    }
  }

  /**
   * Get user role options for dropdowns
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of {label, value} options
   */
  const getUserRoleOptions = async (forceRefresh = false) => {
    const cacheKey = 'user_roles'

    // Check cache first
    if (!forceRefresh && lookupData.value[cacheKey] && isCacheValid.value) {
      return lookupData.value[cacheKey]
    }

    try {
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP
         WHERE TABLE_CD = 'USER_DIMENSION'
         AND COLUMN_CD = 'ROLE_CD'
         ORDER BY NAME_CHAR`,
      )

      if (result.success && result.data.length > 0) {
        const options = result.data.map((role) => ({
          label: role.NAME_CHAR || role.CODE_CD,
          value: role.CODE_CD,
        }))

        // Cache the result
        lookupData.value[cacheKey] = options
        logger.success(`Loaded ${options.length} user roles from database`)
        return options
      }

      // Fallback to standard user roles if no database data
      const fallbackRoles = [
        { label: 'Administrator', value: 'admin' },
        { label: 'Physician', value: 'physician' },
        { label: 'Nurse', value: 'nurse' },
        { label: 'Research', value: 'research' },
      ]

      // Cache the fallback result
      lookupData.value[cacheKey] = fallbackRoles
      logger.info('Using fallback user roles')
      return fallbackRoles
    } catch (error) {
      logger.error('Failed to get user role options', error)
      // Return fallback options
      const fallbackRoles = [
        { label: 'Administrator', value: 'admin' },
        { label: 'Physician', value: 'physician' },
        { label: 'Nurse', value: 'nurse' },
        { label: 'Research', value: 'research' },
      ]
      return fallbackRoles
    }
  }

  /**
   * Get visit template options for quick visit creation
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of visit template configurations
   */
  const getVisitTemplateOptions = async (forceRefresh = false) => {
    const cacheKey = 'visit_templates'

    // Check cache first
    if (!forceRefresh && lookupData.value[cacheKey] && isCacheValid.value) {
      return lookupData.value[cacheKey]
    }

    try {
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP
         WHERE TABLE_CD = 'VISIT_DIMENSION'
         AND COLUMN_CD = 'TEMPLATE_CD'
         ORDER BY NAME_CHAR`,
      )

      if (result.success && result.data.length > 0) {
        const templates = result.data.map((template) => {
          const metadata = parseMetadata(template.LOOKUP_BLOB)
          return {
            id: template.CODE_CD,
            name: template.NAME_CHAR,
            type: metadata.visitType || 'routine',
            location: metadata.location || '',
            notes: metadata.notes || '',
            icon: metadata.icon || 'assignment',
            color: metadata.color || 'primary',
          }
        })

        // Cache the result
        lookupData.value[cacheKey] = templates
        logger.success(`Loaded ${templates.length} visit templates`)
        return templates
      }

      // Fallback to standard visit templates
      return getDefaultVisitTemplates()
    } catch (error) {
      logger.error('Failed to get visit template options', error)
      return getDefaultVisitTemplates()
    }
  }

  /**
   * Get drug options for medication search
   * @param {string} searchTerm - Search term to filter drugs
   * @param {boolean} forceRefresh - Force refresh from database
   * @returns {Promise<Array>} Array of drug options
   */
  const getDrugOptions = async (searchTerm = '', forceRefresh = false) => {
    const cacheKey = 'drug_options'

    // Check cache first
    if (!forceRefresh && lookupData.value[cacheKey] && isCacheValid.value) {
      const cached = lookupData.value[cacheKey]
      if (searchTerm && searchTerm.length >= 2) {
        return cached.filter((drug) => drug.name.toLowerCase().includes(searchTerm.toLowerCase()) || drug.generic.toLowerCase().includes(searchTerm.toLowerCase()))
      }
      return cached
    }

    try {
      // Try to load from database first
      const result = await dbStore.executeQuery(
        `SELECT * FROM CODE_LOOKUP
         WHERE TABLE_CD = 'MEDICATION_DIMENSION'
         AND COLUMN_CD = 'DRUG_CD'
         ORDER BY NAME_CHAR`,
      )

      let drugOptions = []

      if (result.success && result.data.length > 0) {
        // Parse database drugs
        drugOptions = result.data.map((drug) => {
          const metadata = parseMetadata(drug.LOOKUP_BLOB)
          return {
            name: drug.NAME_CHAR || drug.CODE_CD,
            generic: metadata.generic || '',
            strength: metadata.strength || '',
            category: metadata.category || 'general',
          }
        })
        logger.success(`Loaded ${drugOptions.length} drugs from database`)
      } else {
        // Fallback to comprehensive drug list
        drugOptions = getDefaultDrugOptions()
        logger.info('Using fallback drug options')
      }

      // Cache the result
      lookupData.value[cacheKey] = drugOptions

      // Filter by search term if provided
      if (searchTerm && searchTerm.length >= 2) {
        return drugOptions.filter((drug) => drug.name.toLowerCase().includes(searchTerm.toLowerCase()) || drug.generic.toLowerCase().includes(searchTerm.toLowerCase()))
      }

      return drugOptions
    } catch (error) {
      logger.error('Failed to get drug options', error)
      return getDefaultDrugOptions().filter(
        (drug) => !searchTerm || searchTerm.length < 2 || drug.name.toLowerCase().includes(searchTerm.toLowerCase()) || drug.generic.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }
  }

  /**
   * Get default drug options when database lookup fails
   * @returns {Array} Comprehensive list of common medications
   */
  const getDefaultDrugOptions = () => {
    return [
      // Cardiovascular
      { name: 'Lisinopril', generic: 'ACE Inhibitor', strength: '10mg', category: 'cardiovascular' },
      { name: 'Atorvastatin', generic: 'Statin', strength: '20mg', category: 'cardiovascular' },
      { name: 'Metoprolol', generic: 'Beta Blocker', strength: '50mg', category: 'cardiovascular' },
      { name: 'Amlodipine', generic: 'Calcium Channel Blocker', strength: '5mg', category: 'cardiovascular' },
      { name: 'Warfarin', generic: 'Anticoagulant', strength: '5mg', category: 'cardiovascular' },

      // Diabetes
      { name: 'Metformin', generic: 'Biguanide', strength: '500mg', category: 'diabetes' },
      { name: 'Glipizide', generic: 'Sulfonylurea', strength: '5mg', category: 'diabetes' },
      { name: 'Insulin Glargine', generic: 'Long-acting insulin', strength: '100U/mL', category: 'diabetes' },

      // Pain & Inflammation
      { name: 'Aspirin', generic: 'Acetylsalicylic acid', strength: '81mg', category: 'analgesic' },
      { name: 'Acetaminophen', generic: 'Paracetamol', strength: '500mg', category: 'analgesic' },
      { name: 'Ibuprofen', generic: 'NSAID', strength: '200mg', category: 'analgesic' },
      { name: 'Naproxen', generic: 'NSAID', strength: '220mg', category: 'analgesic' },

      // Gastrointestinal
      { name: 'Omeprazole', generic: 'Proton pump inhibitor', strength: '20mg', category: 'gastrointestinal' },
      { name: 'Ranitidine', generic: 'H2 antagonist', strength: '150mg', category: 'gastrointestinal' },
      { name: 'Pantoprazole', generic: 'Proton pump inhibitor', strength: '40mg', category: 'gastrointestinal' },

      // Antibiotics
      { name: 'Amoxicillin', generic: 'Penicillin antibiotic', strength: '500mg', category: 'antibiotic' },
      { name: 'Azithromycin', generic: 'Macrolide antibiotic', strength: '250mg', category: 'antibiotic' },
      { name: 'Cephalexin', generic: 'Cephalosporin antibiotic', strength: '500mg', category: 'antibiotic' },
      { name: 'Ciprofloxacin', generic: 'Fluoroquinolone antibiotic', strength: '500mg', category: 'antibiotic' },

      // Respiratory
      { name: 'Albuterol', generic: 'Bronchodilator', strength: '90mcg', category: 'respiratory' },
      { name: 'Fluticasone', generic: 'Corticosteroid', strength: '50mcg', category: 'respiratory' },
      { name: 'Montelukast', generic: 'Leukotriene antagonist', strength: '10mg', category: 'respiratory' },

      // Mental Health
      { name: 'Sertraline', generic: 'SSRI', strength: '50mg', category: 'psychiatric' },
      { name: 'Lorazepam', generic: 'Benzodiazepine', strength: '1mg', category: 'psychiatric' },
      { name: 'Zolpidem', generic: 'Sleep aid', strength: '10mg', category: 'psychiatric' },

      // Neurological
      { name: 'Gabapentin', generic: 'Anticonvulsant', strength: '300mg', category: 'neurological' },
      { name: 'Phenytoin', generic: 'Anticonvulsant', strength: '100mg', category: 'neurological' },
      { name: 'Carbidopa-Levodopa', generic: 'Parkinson medication', strength: '25-100mg', category: 'neurological' },
    ]
  }

  /**
   * Get default visit templates when database lookup fails
   * @returns {Array} Default visit templates
   */
  const getDefaultVisitTemplates = () => {
    const defaultTemplates = [
      {
        id: 'annual-checkup',
        name: 'Annual Checkup',
        type: 'routine',
        location: '',
        notes: 'Annual physical examination and health assessment',
        icon: 'health_and_safety',
        color: 'primary',
      },
      {
        id: 'follow-up-labs',
        name: 'Lab Follow-up',
        type: 'followup',
        location: '',
        notes: 'Follow-up visit to review laboratory results',
        icon: 'science',
        color: 'secondary',
      },
      {
        id: 'medication-review',
        name: 'Medication Review',
        type: 'consultation',
        location: '',
        notes: 'Review current medications and adjust dosages as needed',
        icon: 'medication',
        color: 'info',
      },
      {
        id: 'emergency-visit',
        name: 'Emergency Visit',
        type: 'emergency',
        location: 'Emergency Department',
        notes: 'Urgent medical attention required',
        icon: 'emergency',
        color: 'negative',
      },
      {
        id: 'procedure-visit',
        name: 'Procedure Visit',
        type: 'procedure',
        location: 'Procedure Suite',
        notes: 'Medical procedure or intervention',
        icon: 'medical_services',
        color: 'warning',
      },
    ]

    // Cache the fallback result
    lookupData.value['visit_templates'] = defaultTemplates
    logger.info('Using default visit templates')
    return defaultTemplates
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

    // Database access
    dbStore,

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

    // Enhanced metadata methods
    parseMetadata,
    getCategoryMetadata,
    getVisitTypeOptions,
    getFileTypeOptions,
    getFieldSetOptions,

    // Default value methods
    getDefaultSourceSystem,
    getDefaultCategory,

    // User role methods
    getUserRoleOptions,

    // Visit template methods
    getVisitTemplateOptions,
    getDefaultVisitTemplates,

    // Drug methods
    getDrugOptions,
    getDefaultDrugOptions,
  }
})
