/**
 * Import File Type Detection Module
 *
 * Handles detection of file formats based on content and filename.
 * Supports CSV, JSON, HL7, and HTML formats.
 */

// import { logger } from '../logging-service.js'

/**
 * Supported file formats
 */
export const SUPPORTED_FORMATS = ['csv', 'json', 'hl7', 'html']

/**
 * Detect file format based on content and extension
 * @param {string} content - File content
 * @param {string} filename - Original filename
 * @returns {string|null} Detected format ('csv', 'json', 'hl7', 'html', or null)
 */
export function detectFormat(content, filename) {
  const extension = filename.toLowerCase().split('.').pop()

  // Check by extension first
  if (extension === 'csv') return 'csv'
  if (extension === 'json') return 'json'
  if (extension === 'xml' || extension === 'hl7') return 'hl7'
  if (extension === 'html' || extension === 'htm') return 'html'

  // Check by content analysis (order matters - more specific checks first)
  if (isCsvContent(content)) return 'csv'
  if (isHtmlContent(content)) return 'html'
  if (isHl7Content(content)) return 'hl7'
  if (isJsonContent(content)) return 'json'

  return null
}

/**
 * Check if content is CSV format
 * @param {string} content - File content
 * @returns {boolean} True if CSV
 */
export function isCsvContent(content) {
  const lines = content.split('\n').filter((line) => line.trim())
  if (lines.length < 2) return false

  // Check for comma or semicolon separators
  const firstLine = lines[0]
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length

  return commaCount > 0 || semicolonCount > 0
}

/**
 * Check if content is JSON format
 * @param {string} content - File content
 * @returns {boolean} True if JSON
 */
export function isJsonContent(content) {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false

  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

/**
 * Check if content is HL7 format
 * @param {string} content - File content
 * @returns {boolean} True if HL7
 */
export function isHl7Content(content) {
  const trimmed = content.trim()

  // Check for FHIR structure
  if (trimmed.includes('"resourceType"')) return true

  // Check for HL7 XML structure
  if (trimmed.includes('<ClinicalDocument') || trimmed.includes('<hl7:')) return true

  return false
}

/**
 * Check if content is HTML format
 * @param {string} content - File content
 * @returns {boolean} True if HTML
 */
export function isHtmlContent(content) {
  const trimmed = content.trim().toLowerCase()
  
  // Check for basic HTML structure
  if (trimmed.includes('<html') || trimmed.includes('<!doctype html')) {
    return true
  }
  
  // Check for HTML with embedded CDA data (survey files)
  if (trimmed.includes('<script') && (trimmed.includes('cda') || trimmed.includes('"cda"'))) {
    return true
  }
  
  // Check for other HTML indicators
  if (trimmed.includes('<head>') && trimmed.includes('<body>')) {
    return true
  }
  
  return false
}

/**
 * Validate file size
 * @param {string} content - File content
 * @param {string} maxSizeStr - Max size string like '50MB'
 * @returns {boolean} True if valid size
 */
export function validateFileSize(content, maxSizeStr = '50MB') {
  const maxSize = parseFileSize(maxSizeStr)
  return content.length <= maxSize
}

/**
 * Parse file size string to bytes
 * @param {string} sizeStr - Size string like '50MB'
 * @returns {number} Size in bytes
 */
export function parseFileSize(sizeStr) {
  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  }

  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i)
  if (!match) return 50 * 1024 * 1024 // Default 50MB

  const size = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  return size * (units[unit] || 1)
}

/**
 * Get file format information
 * @param {string} format - File format
 * @returns {Object} Format information
 */
export function getFormatInfo(format) {
  const formatInfo = {
    csv: {
      name: 'CSV',
      description: 'Comma Separated Values',
      extensions: ['.csv'],
      mimeTypes: ['text/csv', 'application/csv'],
    },
    json: {
      name: 'JSON',
      description: 'JavaScript Object Notation',
      extensions: ['.json'],
      mimeTypes: ['application/json'],
    },
    hl7: {
      name: 'HL7',
      description: 'Health Level 7',
      extensions: ['.xml', '.hl7'],
      mimeTypes: ['application/xml', 'text/xml'],
    },
    html: {
      name: 'HTML',
      description: 'HTML with embedded CDA',
      extensions: ['.html', '.htm'],
      mimeTypes: ['text/html'],
    },
  }

  return formatInfo[format] || null
}

/**
 * Detect CSV delimiter
 * @param {string} headerLine - First line of CSV
 * @returns {string} Detected delimiter
 */
export function detectCsvDelimiter(headerLine) {
  const delimiters = [',', ';', '\t', '|']
  let bestDelimiter = ','
  let maxCount = 0

  for (const delimiter of delimiters) {
    const count = (headerLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    if (count > maxCount) {
      maxCount = count
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}
