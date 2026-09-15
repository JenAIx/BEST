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
  return str.replace(/\n/g, '\\n')
}

/**
 * Restore newlines from CQL_CHAR fields
 * @param {string} str - String with escaped newlines
 * @returns {string} - String with actual newlines
 */
export function unstringify_char(str) {
  if (str === null || str === undefined) return null
  return str.replace(/\\n/g, '\n')
}

/**
 * SQLite caps bound parameters (999 in old builds, 32 766 in current ones).
 * Any `IN (?,?,…)` over a user-selected set must be chunked.
 */
export const SQL_IN_CHUNK_SIZE = 500

export function chunkArray(items, size = SQL_IN_CHUNK_SIZE) {
  const list = Array.isArray(items) ? items : []
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Run `runChunk(chunk)` for every chunk and concatenate the row arrays.
 * @param {Array} items
 * @param {(chunk: Array) => Promise<Array>} runChunk
 * @param {number} [size]
 */
export async function queryInChunks(items, runChunk, size = SQL_IN_CHUNK_SIZE) {
  const rows = []
  for (const chunk of chunkArray(items, size)) {
    const part = await runChunk(chunk)
    if (Array.isArray(part)) rows.push(...part)
  }
  return rows
}
