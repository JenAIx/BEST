/**
 * File Category Utilities
 *
 * Maps uploaded files (visits upload area) to raw-file concept categories
 * (VALTYPE_CD='R'). The suggestion is derived from the file extension; file
 * names that look like consent forms ("Aufklaerung_...", "consent-...") win
 * over the extension-based category.
 *
 * Pure functions — no store imports — so they are directly unit-testable.
 */

export const FILE_CATEGORIES = [
  {
    key: 'video',
    conceptCd: 'CUSTOM: RAW_VIDEO',
    icon: 'movie',
    color: 'deep-purple',
    labelKey: 'visit.fileCategoryVideo',
    extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
  },
  {
    key: 'image',
    conceptCd: 'CUSTOM: RAW_IMAGE',
    icon: 'image',
    color: 'teal',
    labelKey: 'visit.fileCategoryImage',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'],
  },
  {
    key: 'document',
    conceptCd: 'CUSTOM: RAW_DOCUMENT',
    icon: 'description',
    color: 'blue',
    labelKey: 'visit.fileCategoryDocument',
    extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
  },
  {
    key: 'consent',
    conceptCd: 'CUSTOM: RAW_CONSENT',
    icon: 'assignment_turned_in',
    color: 'green',
    labelKey: 'visit.fileCategoryConsent',
    extensions: [], // never suggested by extension, only by file name / manual choice
  },
  {
    key: 'other',
    conceptCd: 'CUSTOM: RAW_DATA',
    icon: 'attach_file',
    color: 'orange',
    labelKey: 'visit.fileCategoryOther',
    extensions: [],
  },
]

const CONSENT_NAME_PATTERN = /aufkl|einwillig|consent/i

/**
 * Extract the lower-cased extension (without dot) from a file name.
 */
export function getFileExtension(filename) {
  const name = String(filename || '')
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

/**
 * Suggest a file category for an uploaded file.
 * Consent-looking file names win over the extension category; unknown
 * extensions fall back to 'other' (generic CUSTOM: RAW_DATA).
 * @param {string} filename
 * @returns {Object} - entry of FILE_CATEGORIES
 */
export function suggestFileCategory(filename) {
  const name = String(filename || '')

  if (CONSENT_NAME_PATTERN.test(name)) {
    return FILE_CATEGORIES.find((c) => c.key === 'consent')
  }

  const ext = getFileExtension(name)
  const byExtension = FILE_CATEGORIES.find((c) => c.extensions.includes(ext))
  return byExtension || FILE_CATEGORIES.find((c) => c.key === 'other')
}

/**
 * Look up a category by key (e.g. for select options / icons).
 */
export function getFileCategory(key) {
  return FILE_CATEGORIES.find((c) => c.key === key) || FILE_CATEGORIES.find((c) => c.key === 'other')
}

/**
 * Filter observations for the compact-summary search box: case-insensitive
 * match on concept name, display value or category (e.g. "Ka" → "Kalium").
 * @param {Array} observations - transformed observations
 * @param {string} term - search term (falsy → unfiltered)
 * @returns {Array}
 */
export function filterObservations(observations, term) {
  const needle = String(term || '')
    .trim()
    .toLowerCase()
  if (!needle) return observations || []

  return (observations || []).filter((obs) => {
    const haystacks = [obs.conceptName, obs.displayValue, obs.category, obs.unit]
    return haystacks.some((value) => String(value || '').toLowerCase().includes(needle))
  })
}

/**
 * Group a patient's observations by visit (encounterNum) for the compact
 * all-visits summary. Within each visit, observations are grouped by
 * category (same shape as observation-store.categorizedObservations:
 * [{ name, observations: [...] }], categories sorted alphabetically).
 * @param {Array} observations - transformed observations (with encounterNum, category)
 * @returns {Map<number, Array>} - encounterNum → categorized groups
 */
export function groupObservationsByVisit(observations) {
  const byVisit = new Map()

  for (const observation of observations || []) {
    const encounterNum = observation.encounterNum
    if (encounterNum == null) continue
    if (!byVisit.has(encounterNum)) byVisit.set(encounterNum, [])
    byVisit.get(encounterNum).push(observation)
  }

  const categorized = new Map()
  for (const [encounterNum, rows] of byVisit) {
    const byCategory = {}
    for (const row of rows) {
      const category = row.category || 'General'
      if (!byCategory[category]) byCategory[category] = []
      byCategory[category].push(row)
    }
    categorized.set(
      encounterNum,
      Object.keys(byCategory)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name, observations: byCategory[name] })),
    )
  }

  return categorized
}
