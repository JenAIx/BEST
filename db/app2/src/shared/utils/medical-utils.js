/**
 * Medical & Visit Utilities
 *
 * Shared constants, mappings, and utility functions for medical data display
 *
 * NOTE: This module now uses the global-settings-store for centralized data management.
 * Fallback constants are provided for backward compatibility.
 */

import { useGlobalSettingsStore } from 'src/stores/global-settings-store'

// Cached data to avoid multiple database calls
let _visitTypesCache = null
let _valueTypesCache = null
let _fileTypesCache = null
let _fieldSetsCache = null

// Visit Type Configurations (Fallback)
export const VISIT_TYPES = {
  routine: {
    label: 'Routine Check-up',
    icon: 'health_and_safety',
    color: 'primary',
  },
  followup: {
    label: 'Follow-up',
    icon: 'follow_the_signs',
    color: 'secondary',
  },
  emergency: {
    label: 'Emergency',
    icon: 'emergency',
    color: 'negative',
  },
  consultation: {
    label: 'Consultation',
    icon: 'psychology',
    color: 'info',
  },
  procedure: {
    label: 'Procedure',
    icon: 'medical_services',
    color: 'warning',
  },
}

// Observation Value Type Configurations (Fallback)
export const VALUE_TYPES = {
  S: {
    label: 'Selection',
    color: 'blue',
    icon: 'radio_button_checked',
  },
  F: {
    label: 'Finding',
    color: 'green',
    icon: 'search',
  },
  A: {
    label: 'Array/Multiple',
    color: 'purple',
    icon: 'checklist',
  },
  R: {
    label: 'Raw Data/File',
    color: 'orange',
    icon: 'attach_file',
  },
  N: {
    label: 'Numeric',
    color: 'teal',
    icon: 'numbers',
  },
  D: {
    label: 'Date/Time',
    color: 'pink',
    icon: 'schedule',
  },
  T: {
    label: 'Text',
    color: 'indigo',
    icon: 'text_fields',
  },
}

// Medical Category Configurations
export const MEDICAL_CATEGORIES = {
  vital: {
    keywords: ['vital', 'vitals', 'signs'],
    icon: 'favorite',
    color: 'red',
  },
  laboratory: {
    keywords: ['lab', 'laboratory', 'test', 'blood', 'urine'],
    icon: 'science',
    color: 'blue',
  },
  medication: {
    keywords: ['medication', 'drug', 'medicine', 'prescription', 'dose'],
    icon: 'medication',
    color: 'green',
  },
  symptom: {
    keywords: ['symptom', 'complaint', 'pain', 'discomfort'],
    icon: 'sick',
    color: 'orange',
  },
  diagnosis: {
    keywords: ['diagnosis', 'condition', 'disease', 'disorder'],
    icon: 'medical_information',
    color: 'purple',
  },
  procedure: {
    keywords: ['procedure', 'surgery', 'operation', 'intervention'],
    icon: 'medical_services',
    color: 'teal',
  },
  imaging: {
    keywords: ['imaging', 'xray', 'x-ray', 'ct', 'mri', 'ultrasound', 'scan'],
    icon: 'medical_services',
    color: 'indigo',
  },
  note: {
    keywords: ['note', 'comment', 'observation', 'remark'],
    icon: 'note',
    color: 'grey',
  },
}

// File Type Configurations (Fallback)
export const FILE_TYPES = {
  pdf: {
    icon: 'picture_as_pdf',
    color: 'red',
  },
  image: {
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
    icon: 'image',
    color: 'green',
  },
  document: {
    extensions: ['doc', 'docx'],
    icon: 'description',
    color: 'blue',
  },
  spreadsheet: {
    extensions: ['xls', 'xlsx', 'csv'],
    icon: 'table_chart',
    color: 'green',
  },
  text: {
    extensions: ['txt', 'rtf'],
    icon: 'description',
    color: 'blue',
  },
  archive: {
    extensions: ['zip', 'rar', '7z', 'tar', 'gz'],
    icon: 'archive',
    color: 'orange',
  },
}

// Utility Functions
export const getVisitTypeConfig = (type) => {
  // Use cached dynamic data if available
  const dynamicTypes = _visitTypesCache || VISIT_TYPES
  return (
    dynamicTypes[type] || {
      label: 'General Visit',
      icon: 'local_hospital',
      color: 'grey',
    }
  )
}

export const getVisitTypeLabel = (type) => {
  return getVisitTypeConfig(type).label
}

export const getVisitTypeIcon = (type) => {
  return getVisitTypeConfig(type).icon
}

export const getVisitTypeColor = (type) => {
  return getVisitTypeConfig(type).color
}

export const getValueTypeConfig = (valueType) => {
  // Use cached dynamic data if available
  const dynamicTypes = _valueTypesCache || VALUE_TYPES
  return (
    dynamicTypes[valueType] || {
      label: 'Unknown',
      color: 'grey',
      icon: 'help',
    }
  )
}

export const getValueTypeColor = (valueType) => {
  return getValueTypeConfig(valueType).color
}

export const getValueTypeLabel = (valueType) => {
  return getValueTypeConfig(valueType).label
}

export const getValueTypeIcon = (valueType) => {
  return getValueTypeConfig(valueType).icon
}

export const getCategoryIcon = (categoryName) => {
  if (!categoryName) return 'assignment'

  const category = categoryName.toLowerCase()

  for (const config of Object.values(MEDICAL_CATEGORIES)) {
    if (config.keywords.some((keyword) => category.includes(keyword))) {
      return config.icon
    }
  }

  return 'assignment' // default
}

export const getCategoryColor = (categoryName) => {
  if (!categoryName) return 'grey'

  const category = categoryName.toLowerCase()

  for (const config of Object.values(MEDICAL_CATEGORIES)) {
    if (config.keywords.some((keyword) => category.includes(keyword))) {
      return config.color
    }
  }

  return 'grey' // default
}

export const getFileIcon = (filename) => {
  if (!filename) return 'insert_drive_file'

  const ext = filename.split('.').pop()?.toLowerCase()
  // Use cached dynamic data if available
  const dynamicTypes = _fileTypesCache || FILE_TYPES

  // Check specific file types first
  if (ext === 'pdf') return dynamicTypes.pdf?.icon || 'picture_as_pdf'

  // Check grouped extensions
  for (const config of Object.values(dynamicTypes)) {
    if (config.extensions?.includes(ext)) {
      return config.icon
    }
  }

  return 'insert_drive_file' // default
}

export const getFileColor = (filename) => {
  if (!filename) return 'grey'

  const ext = filename.split('.').pop()?.toLowerCase()
  // Use cached dynamic data if available
  const dynamicTypes = _fileTypesCache || FILE_TYPES

  // Check specific file types first
  if (ext === 'pdf') return dynamicTypes.pdf?.color || 'red'

  // Check grouped extensions
  for (const config of Object.values(dynamicTypes)) {
    if (config.extensions?.includes(ext)) {
      return config.color
    }
  }

  return 'grey' // default
}

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDate = (dateStr, options = {}) => {
  if (!dateStr) return 'Unknown Date'

  const date = new Date(dateStr)
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }

  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options })
}

export const formatDateVerbose = (dateStr) => {
  return formatDate(dateStr, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const getObservationDisplayValue = (observation) => {
  if (!observation) return 'No value'

  switch (observation.valueType) {
    case 'S': // Selection
    case 'F': // Finding
    case 'A': // Array/Multiple choice
      return observation.resolvedValue || observation.originalValue || 'No value'

    case 'R': // Raw data/File
      if (observation.fileInfo) {
        return observation.fileInfo.filename || 'File attached'
      }
      return 'No file attached'

    case 'N': {
      // Numeric
      const numValue = observation.originalValue?.toString() || 'No value'
      return observation.unit ? `${numValue} ${observation.unit}` : numValue
    }

    case 'D': // Date
      return formatDate(observation.originalValue)

    default: // Text and others
      return observation.originalValue || observation.resolvedValue || 'No value'
  }
}

// Validation utilities
export const isValidVisitType = (type) => {
  return Object.keys(VISIT_TYPES).includes(type)
}

export const isValidValueType = (valueType) => {
  return Object.keys(VALUE_TYPES).includes(valueType)
}

export const getAvailableVisitTypes = () => {
  return Object.keys(VISIT_TYPES)
}

export const getAvailableValueTypes = () => {
  return Object.keys(VALUE_TYPES)
}

// Field Sets Configuration for Visit Data Entry
export const AVAILABLE_FIELD_SETS = [
  {
    id: 'vitals',
    name: 'Vital Signs',
    icon: 'favorite',
    description: 'Blood pressure, heart rate, temperature, respiratory rate, oxygen saturation',
    concepts: [
      'LOINC:8480-6', // Systolic BP
      'LOINC:8462-4', // Diastolic BP
      'LOINC:8867-4', // Heart rate
      'LOINC:8310-5', // Body temperature
      'LOINC:9279-1', // Respiratory rate
      'LOINC:2708-6', // Oxygen saturation
      // Also include LID versions as they appear in database
      'LID: 8480-6', // Systolic BP
      'LID: 8462-4', // Diastolic BP
      'LID: 8867-4', // Heart rate
    ],
  },
  {
    id: 'symptoms',
    name: 'Symptoms',
    icon: 'sick',
    description: 'Patient reported symptoms and complaints',
    concepts: [
      'SNOMED:25064002', // Headache
      'SNOMED:49727002', // Cough
      'SNOMED:267036007', // Dyspnea
      'SNOMED:21522001', // Abdominal pain
      'SNOMED:386661006', // Fever
      'SNOMED:84229001', // Fatigue
    ],
  },
  {
    id: 'physical',
    name: 'Physical Exam',
    icon: 'medical_services',
    description: 'Physical examination findings',
    concepts: [
      'SNOMED:5880005', // Physical examination
      'SNOMED:32750006', // Inspection
      'SNOMED:113011001', // Palpation
      'SNOMED:37931006', // Auscultation
      'SNOMED:113006009', // Percussion
    ],
  },
  {
    id: 'medications',
    name: 'Medications',
    icon: 'medication',
    description: 'Current medications and dosages',
    concepts: [
      'LID: 52418-1', // Current medication, Name
    ],
  },
  {
    id: 'lab',
    name: 'Lab Results',
    icon: 'science',
    description: 'Laboratory test results',
    concepts: [
      'LOINC:33747-0', // General laboratory studies
      'LOINC:24323-8', // Comprehensive metabolic panel
      'LOINC:57698-3', // Lipid panel
      'LOINC:58410-2', // Complete blood count
    ],
  },
  {
    id: 'assessment',
    name: 'Assessment',
    icon: 'assignment',
    description: 'Clinical assessment and diagnosis',
    concepts: [
      'SNOMED:439401001', // Diagnosis
      'SNOMED:386053000', // Evaluation procedure
      'SNOMED:182836005', // Review of systems
    ],
  },
]

// ===========================
// DYNAMIC DATA FUNCTIONS
// ===========================
// These functions use the global-settings-store for real-time data

/**
 * Load visit types from the global settings store with caching
 * @param {boolean} forceRefresh - Force refresh from database
 * @returns {Promise<Array>} Visit type configurations
 */
export const loadVisitTypes = async (forceRefresh = false) => {
  if (!forceRefresh && _visitTypesCache) {
    return _visitTypesCache
  }

  try {
    const globalSettingsStore = useGlobalSettingsStore()
    const visitTypes = await globalSettingsStore.getVisitTypeOptions(forceRefresh)

    // Convert to the expected format
    _visitTypesCache = visitTypes.reduce((acc, vt) => {
      acc[vt.value] = {
        label: vt.label,
        icon: vt.icon,
        color: vt.color,
      }
      return acc
    }, {})

    return _visitTypesCache
  } catch (error) {
    console.warn('Failed to load visit types from database, using fallback', error)
    return VISIT_TYPES
  }
}

/**
 * Load value types from the global settings store with caching
 * @param {boolean} forceRefresh - Force refresh from database
 * @returns {Promise<Object>} Value type configurations
 */
export const loadValueTypes = async (forceRefresh = false) => {
  if (!forceRefresh && _valueTypesCache) {
    return _valueTypesCache
  }

  try {
    const globalSettingsStore = useGlobalSettingsStore()
    const valueTypes = await globalSettingsStore.getValueTypeOptions(forceRefresh)

    // Convert to the expected format
    _valueTypesCache = valueTypes.reduce((acc, vt) => {
      acc[vt.value] = {
        label: vt.label || vt.value,
        color: vt.color || 'grey',
        icon: vt.icon || 'help',
      }
      return acc
    }, {})

    return _valueTypesCache
  } catch (error) {
    console.warn('Failed to load value types from database, using fallback', error)
    return VALUE_TYPES
  }
}

/**
 * Load file types from the global settings store with caching
 * @param {boolean} forceRefresh - Force refresh from database
 * @returns {Promise<Object>} File type configurations
 */
export const loadFileTypes = async (forceRefresh = false) => {
  if (!forceRefresh && _fileTypesCache) {
    return _fileTypesCache
  }

  try {
    const globalSettingsStore = useGlobalSettingsStore()
    const fileTypes = await globalSettingsStore.getFileTypeOptions(forceRefresh)

    // Convert to the expected format
    _fileTypesCache = fileTypes.reduce((acc, ft) => {
      acc[ft.type] = {
        icon: ft.icon,
        color: ft.color,
        extensions: ft.extensions,
      }
      return acc
    }, {})

    return _fileTypesCache
  } catch (error) {
    console.warn('Failed to load file types from database, using fallback', error)
    return FILE_TYPES
  }
}

/**
 * Load field sets from the global settings store with caching
 * @param {boolean} forceRefresh - Force refresh from database
 * @returns {Promise<Array>} Field set configurations
 */
export const loadFieldSets = async (forceRefresh = false) => {
  if (!forceRefresh && _fieldSetsCache) {
    return _fieldSetsCache
  }

  try {
    const globalSettingsStore = useGlobalSettingsStore()
    _fieldSetsCache = await globalSettingsStore.getFieldSetOptions(forceRefresh)
    return _fieldSetsCache
  } catch (error) {
    console.warn('Failed to load field sets from database, using fallback', error)
    return AVAILABLE_FIELD_SETS
  }
}

/**
 * Get category metadata with enhanced UI features
 * @param {boolean} forceRefresh - Force refresh from database
 * @returns {Promise<Array>} Category metadata
 */
export const loadCategoryMetadata = async (forceRefresh = false) => {
  try {
    const globalSettingsStore = useGlobalSettingsStore()
    return await globalSettingsStore.getCategoryMetadata(forceRefresh)
  } catch (error) {
    console.warn('Failed to load category metadata from database', error)
    return []
  }
}

/**
 * Clear all cached medical data (useful for testing or manual refresh)
 */
export const clearMedicalDataCache = () => {
  _visitTypesCache = null
  _valueTypesCache = null
  _fileTypesCache = null
  _fieldSetsCache = null
}

// Field set utilities
export const getFieldSetById = (fieldSetId) => {
  // Use cached dynamic data if available
  const dynamicSets = _fieldSetsCache || AVAILABLE_FIELD_SETS
  return dynamicSets.find((fs) => fs.id === fieldSetId)
}

export const getFieldSetsByIds = (fieldSetIds) => {
  return fieldSetIds.map((id) => getFieldSetById(id)).filter(Boolean)
}

/**
 * Enhanced category matching using dynamic metadata
 * @param {string} categoryName - Category name to match
 * @param {Array} categoryMetadata - Optional preloaded metadata
 * @returns {Object} Matched category metadata or default
 */
export const getCategoryMetadata = (categoryName, categoryMetadata = []) => {
  if (!categoryName) return { icon: 'assignment', color: 'grey' }

  const category = categoryName.toLowerCase()

  // First try dynamic metadata
  const dynamicMatch = categoryMetadata.find((meta) => {
    return meta.keywords?.some((keyword) => category.includes(keyword))
  })

  if (dynamicMatch) {
    return {
      icon: dynamicMatch.icon,
      color: dynamicMatch.color,
      keywords: dynamicMatch.keywords,
    }
  }

  // Fallback to static MEDICAL_CATEGORIES
  for (const config of Object.values(MEDICAL_CATEGORIES)) {
    if (config.keywords.some((keyword) => category.includes(keyword))) {
      return config
    }
  }

  return { icon: 'assignment', color: 'grey' }
}

/**
 * Patient Utility Functions
 */

/**
 * Generate patient initials from full name
 * @param {string} name - Patient's full name
 * @returns {string} Patient initials (up to 2 characters)
 */
export const getPatientInitials = (name) => {
  if (!name || typeof name !== 'string') {
    return '??'
  }

  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Format patient name for display
 * @param {string} name - Patient's full name
 * @param {boolean} lastFirst - Format as "Last, First" instead of "First Last"
 * @returns {string} Formatted name
 */
export const formatPatientName = (name, lastFirst = false) => {
  if (!name || typeof name !== 'string') {
    return 'Unknown Patient'
  }

  const nameParts = name
    .trim()
    .split(' ')
    .filter((part) => part.length > 0)
  if (nameParts.length === 0) {
    return 'Unknown Patient'
  }

  if (nameParts.length === 1) {
    return nameParts[0]
  }

  if (lastFirst) {
    const last = nameParts[nameParts.length - 1]
    const first = nameParts.slice(0, -1).join(' ')
    return `${last}, ${first}`
  }

  return nameParts.join(' ')
}

/**
 * Get patient display color based on status or other criteria
 * @param {Object} patient - Patient object
 * @returns {string} Quasar color name
 */
export const getPatientDisplayColor = (patient) => {
  if (!patient) return 'grey'

  // Color based on vital status if available
  if (patient.vital_status || patient.vitalStatus) {
    const status = (patient.vital_status || patient.vitalStatus).toLowerCase()
    switch (status) {
      case 'alive':
      case 'active':
        return 'positive'
      case 'deceased':
      case 'dead':
        return 'negative'
      case 'inactive':
        return 'warning'
      default:
        return 'primary'
    }
  }

  return 'primary'
}
