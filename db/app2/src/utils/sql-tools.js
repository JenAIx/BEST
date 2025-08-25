/**
 * SQL Tools - Utilities for handling SQL data formatting
 * Based on the old sqltools.js from the legacy system
 */

/**
 * Convert single quotes to double quotes for JSON parsing
 * This is used to parse JSON_CHAR fields from the database
 * @param {string} str - String with single quotes
 * @returns {string} - String with double quotes
 */
export function unstringify_json(str) {
  if (str === null || str === undefined) return null
  return str.replace(/'/g, '"')
}

/**
 * Convert double quotes to single quotes for SQL storage
 * @param {string} str - String with double quotes
 * @returns {string} - String with single quotes
 */
export function stringify_json(str) {
  if (str === null || str === undefined) return null
  return str.replace(/"/g, "'")
}

/**
 * Handle newlines in CQL_CHAR fields
 * @param {string} str - String with newlines
 * @returns {string} - String with escaped newlines
 */
export function stringify_char(str) {
  if (str === null || str === undefined) return null
  return str.replace(/\n/g, "\\n")
}

/**
 * Restore newlines from CQL_CHAR fields
 * @param {string} str - String with escaped newlines
 * @returns {string} - String with actual newlines
 */
export function unstringify_char(str) {
  if (str === null || str === undefined) return null
  return str.replace(/\\n/g, "\n")
}
