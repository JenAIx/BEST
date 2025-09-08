/**
 * Color Mapper Utility
 *
 * Provides context-aware color mapping for medical concepts and UI elements.
 * Supports various contexts like visit status, gender, vital status, etc.
 */

/**
 * Context-specific color mapping configurations
 */
const COLOR_MAPPINGS = {
  visit_status: {
    patterns: [
      { keywords: ['active', 'classified', 'pending', 'admitted'], color: 'negative' },
      { keywords: ['closed', 'completed', 'discharged'], color: 'positive' },
      { keywords: ['inactive', 'cancelled', 'suspended'], color: 'grey' },
    ],
    default: 'grey',
  },

  status: {
    patterns: [
      { keywords: ['inactive', 'discharged', 'completed', 'dead'], color: 'negative' },
      { keywords: ['active', 'alive', 'admitted'], color: 'positive' },
      { keywords: ['cancelled', 'suspended'], color: 'warning' },
      { keywords: ['transferred', 'pending'], color: 'info' },
    ],
    default: 'grey',
  },

  vital_status: {
    patterns: [
      { keywords: ['active', 'alive', 'admitted'], color: 'positive' },
      { keywords: ['discharged', 'completed', 'inactive', 'dead'], color: 'negative' },
      { keywords: ['cancelled', 'suspended'], color: 'warning' },
      { keywords: ['transferred', 'pending'], color: 'info' },
    ],
    default: 'grey',
  },

  gender: {
    patterns: [
      { keywords: ['male'], exclude: ['female'], color: 'blue' },
      { keywords: ['female'], color: 'pink' },
      { keywords: ['transsexual'], color: 'purple' },
      { keywords: ['intersex'], color: 'orange' },
    ],
    default: 'grey',
  },

  selection_answer: {
    patterns: [
      { keywords: ['yes', 'positive', 'present', 'normal'], color: 'positive' },
      { keywords: ['no', 'negative', 'absent', 'abnormal'], color: 'negative' },
      { keywords: ['unknown', 'not applicable'], color: 'warning' },
    ],
    default: 'grey',
  },

  finding_answer: {
    patterns: [
      { keywords: ['yes', 'positive', 'present', 'normal', 'detected'], color: 'positive' },
      { keywords: ['no', 'negative', 'absent', 'abnormal', 'not detected'], color: 'negative' },
      { keywords: ['unknown', 'not applicable'], color: 'warning' },
    ],
    default: 'grey',
  },

  severity: {
    patterns: [
      { keywords: ['mild', 'low'], color: 'positive' },
      { keywords: ['moderate', 'medium'], color: 'warning' },
      { keywords: ['severe', 'high', 'critical'], color: 'negative' },
      { keywords: ['normal'], color: 'info' },
    ],
    default: 'grey',
  },

  priority: {
    patterns: [
      { keywords: ['low'], color: 'positive' },
      { keywords: ['normal', 'medium'], color: 'info' },
      { keywords: ['high'], color: 'warning' },
      { keywords: ['urgent', 'critical', 'emergency'], color: 'negative' },
    ],
    default: 'grey',
  },

  medication_status: {
    patterns: [
      { keywords: ['active', 'current'], color: 'positive' },
      { keywords: ['discontinued', 'stopped'], color: 'negative' },
      { keywords: ['suspended', 'hold'], color: 'warning' },
      { keywords: ['completed'], color: 'info' },
    ],
    default: 'grey',
  },

  lab_result: {
    patterns: [
      { keywords: ['normal', 'negative'], color: 'positive' },
      { keywords: ['abnormal', 'positive'], color: 'negative' },
      { keywords: ['borderline', 'inconclusive'], color: 'warning' },
      { keywords: ['pending'], color: 'info' },
    ],
    default: 'grey',
  },
}

/**
 * Fallback color mappings for simple codes
 */
const SIMPLE_CODE_COLORS = {
  // Status codes
  A: 'positive', // Active
  I: 'grey', // Inactive
  D: 'negative', // Discharged/Deceased
  C: 'info', // Completed
  X: 'warning', // Cancelled
  P: 'info', // Pending

  // Gender codes
  M: 'blue', // Male
  F: 'pink', // Female

  // Boolean-like codes
  Y: 'positive', // Yes
  N: 'negative', // No
  U: 'warning', // Unknown

  // Priority codes
  L: 'positive', // Low
  H: 'negative', // High
  E: 'negative', // Emergency
}

/**
 * Medical category color mappings
 */
const MEDICAL_CATEGORY_COLORS = {
  vital: 'red',
  laboratory: 'blue',
  medication: 'green',
  symptom: 'orange',
  diagnosis: 'purple',
  procedure: 'teal',
  imaging: 'indigo',
  note: 'grey',
}

/**
 * Determine color based on text content and context
 * @param {string|number} text - Text to analyze for color mapping
 * @param {string} context - Context hint (e.g., 'status', 'gender', etc.)
 * @param {Object} options - Additional options
 * @returns {string} Quasar color name
 */
export function determineColor(text, context = null, options = {}) {
  if (!text && text !== 0) return options.defaultColor || 'grey'

  // Convert to string and ensure it's a valid string before calling toLowerCase
  const textStr = String(text)
  if (typeof textStr !== 'string') return options.defaultColor || 'grey'

  const lowerText = textStr.toLowerCase().trim()

  // Handle simple single-character codes first
  if (lowerText.length === 1 && SIMPLE_CODE_COLORS[lowerText.toUpperCase()]) {
    return SIMPLE_CODE_COLORS[lowerText.toUpperCase()]
  }

  // Apply context-specific color mapping
  if (context && COLOR_MAPPINGS[context]) {
    const mapping = COLOR_MAPPINGS[context]

    for (const pattern of mapping.patterns) {
      // Check if any keywords match
      const hasMatch = pattern.keywords.some((keyword) => lowerText.includes(keyword))

      // Check exclusions if any
      const hasExclusion = pattern.exclude ? pattern.exclude.some((exclude) => lowerText.includes(exclude)) : false

      if (hasMatch && !hasExclusion) {
        return pattern.color
      }
    }

    return mapping.default
  }

  // Fallback to general medical category matching
  for (const [category, color] of Object.entries(MEDICAL_CATEGORY_COLORS)) {
    if (lowerText.includes(category)) {
      return color
    }
  }

  return options.defaultColor || 'grey'
}

/**
 * Get color for medical category based on keywords
 * @param {string} categoryName - Category name to analyze
 * @param {Array} categoryMetadata - Optional preloaded category metadata
 * @returns {string} Quasar color name
 */
export function getCategoryColor(categoryName, categoryMetadata = []) {
  if (!categoryName) return 'grey'

  const category = categoryName.toLowerCase()

  // First try dynamic metadata if provided
  const dynamicMatch = categoryMetadata.find((meta) => {
    return meta.keywords?.some((keyword) => category.includes(keyword))
  })

  if (dynamicMatch && dynamicMatch.color) {
    return dynamicMatch.color
  }

  // Fallback to static mappings
  for (const [key, color] of Object.entries(MEDICAL_CATEGORY_COLORS)) {
    if (category.includes(key)) {
      return color
    }
  }

  return 'grey'
}

/**
 * Get color for patient display based on status
 * @param {Object} patient - Patient object
 * @returns {string} Quasar color name
 */
export function getPatientDisplayColor(patient) {
  if (!patient) return 'grey'

  // Color based on vital status if available
  if (patient.vital_status || patient.vitalStatus) {
    const status = String(patient.vital_status || patient.vitalStatus)
    if (typeof status === 'string') {
      return determineColor(status.toLowerCase(), 'vital_status')
    }
  }

  return 'primary'
}

/**
 * Get color for visit status
 * @param {string} status - Visit status
 * @returns {string} Quasar color name
 */
export function getVisitStatusColor(status) {
  return determineColor(status, 'visit_status')
}

/**
 * Get color for observation value based on type and content
 * @param {string|number} value - Observation value
 * @param {string} valueType - Value type (S, F, N, etc.)
 * @param {string} conceptCode - Concept code for additional context
 * @returns {string} Quasar color name
 */
export function getObservationValueColor(value, valueType) {
  if (!value && value !== 0) return 'grey'

  // Determine context based on value type
  let context = null
  switch (valueType) {
    case 'S':
      context = 'selection_answer'
      break
    case 'F':
      context = 'finding_answer'
      break
    case 'N':
      // For numeric values, could analyze ranges if we had reference values
      return 'info'
    case 'D':
      return 'info'
    case 'T':
    default: {
      // For text values, try to infer context from content
      const valueStr = String(value)
      if (typeof valueStr === 'string') {
        if (valueStr.toLowerCase().includes('status')) {
          context = 'status'
        } else if (valueStr.toLowerCase().includes('result')) {
          context = 'lab_result'
        }
      }
      break
    }
  }

  return determineColor(value, context)
}

/**
 * Get color for file type
 * @param {string} filename - Filename to analyze
 * @returns {string} Quasar color name
 */
export function getFileColor(filename) {
  if (!filename) return 'grey'

  const ext = filename.split('.').pop()?.toLowerCase()

  const fileColorMap = {
    pdf: 'red',
    doc: 'blue',
    docx: 'blue',
    xls: 'green',
    xlsx: 'green',
    csv: 'green',
    txt: 'blue',
    rtf: 'blue',
    png: 'green',
    jpg: 'green',
    jpeg: 'green',
    gif: 'green',
    bmp: 'green',
    webp: 'green',
    zip: 'orange',
    rar: 'orange',
    '7z': 'orange',
    tar: 'orange',
    gz: 'orange',
  }

  return fileColorMap[ext] || 'grey'
}

/**
 * Create a color mapper with custom configuration
 * @param {Object} customMappings - Custom color mappings
 * @returns {Function} Color mapping function
 */
export function createColorMapper(customMappings = {}) {
  const mergedMappings = { ...COLOR_MAPPINGS, ...customMappings }

  return function (text, context = null, options = {}) {
    return determineColor(text, context, { ...options, mappings: mergedMappings })
  }
}

/**
 * Validate color name against Quasar color palette
 * @param {string} color - Color name to validate
 * @returns {string} Valid Quasar color name
 */
export function validateQuasarColor(color) {
  const validColors = [
    'primary',
    'secondary',
    'accent',
    'dark',
    'positive',
    'negative',
    'info',
    'warning',
    'white',
    'black',
    'grey',
    'red',
    'pink',
    'purple',
    'deep-purple',
    'indigo',
    'blue',
    'light-blue',
    'cyan',
    'teal',
    'green',
    'light-green',
    'lime',
    'yellow',
    'amber',
    'orange',
    'deep-orange',
    'brown',
    'blue-grey',
  ]

  return validColors.includes(color) ? color : 'grey'
}

/**
 * Get contrasting text color for a given background color
 * @param {string} backgroundColor - Background color name
 * @returns {string} Contrasting text color ('white' or 'black')
 */
export function getContrastingTextColor(backgroundColor) {
  const lightColors = ['white', 'yellow', 'lime', 'light-green', 'light-blue', 'cyan', 'amber']

  return lightColors.includes(backgroundColor) ? 'black' : 'white'
}

// Export default color mapper
export default {
  determineColor,
  getCategoryColor,
  getPatientDisplayColor,
  getVisitStatusColor,
  getObservationValueColor,
  getFileColor,
  createColorMapper,
  validateQuasarColor,
  getContrastingTextColor,
}
