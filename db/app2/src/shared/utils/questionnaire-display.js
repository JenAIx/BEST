/**
 * Pure parsing of Q-type (questionnaire) observations into display entries.
 *
 * One implementation for every consumer: useVisitQuestionnaires (editor),
 * the unified read tiles and the questionnaire form grid all derive
 * status/score/progress from the same OBSERVATION_BLOB conventions:
 *
 * - pending fill: blob JSON with `_status: 'pending'`, `_questionnaireCode`,
 *   `_savedResponses` (partial answers → progress 0..1)
 * - completed:    blob JSON with `questionnaire_code`, `results[]`
 *   (first result value = score)
 * - legacy Q rows without a parseable blob count as completed.
 */

// Render paths (tile classes, icons, sublines) call the parse several times
// per tile — memoize per observation object, invalidated when the blob
// string changes (store reloads produce fresh objects, old entries get GC'd)
const parseCache = new WeakMap()

/**
 * @param {Object} obs - transformed observation (valueType 'Q', rawData)
 * @returns {Object} { observationId, title, shortTitle, questionnaireCode,
 *                     isCompleted, score, progress, observationBlob, rawObservation }
 */
export function parseQuestionnaireObservation(obs) {
  if (obs && typeof obs === 'object') {
    const cached = parseCache.get(obs)
    if (cached && cached.blob === obs.rawData?.OBSERVATION_BLOB) return cached.parsed
    const parsed = parseQuestionnaireObservationUncached(obs)
    parseCache.set(obs, { blob: obs.rawData?.OBSERVATION_BLOB, parsed })
    return parsed
  }
  return parseQuestionnaireObservationUncached(obs)
}

function parseQuestionnaireObservationUncached(obs) {
  let isCompleted = false
  let title = obs.value || obs.originalValue || obs.displayValue || 'Fragebogen'
  let questionnaireCode = null
  let shortTitle = null
  let score = null
  let progress = null

  const blob = obs.rawData?.OBSERVATION_BLOB
  if (blob) {
    try {
      const blobData = JSON.parse(blob)

      if (blobData && typeof blobData === 'object' && blobData._status === 'pending') {
        isCompleted = false
        questionnaireCode = blobData._questionnaireCode || null
        title = blobData.title || title
        shortTitle = blobData.short_title || null

        if (blobData._savedResponses && typeof blobData._savedResponses === 'object') {
          const entries = Object.values(blobData._savedResponses)
          const filledCount = entries.filter((v) => v !== null && v !== undefined && v !== '').length
          progress = entries.length > 0 ? filledCount / entries.length : 0
        } else {
          progress = 0
        }
      } else if (blobData && typeof blobData === 'object') {
        isCompleted = true
        questionnaireCode = blobData.questionnaire_code || blobData._questionnaireCode || null
        title = blobData.title || title
        shortTitle = blobData.short_title || null
        if (Array.isArray(blobData.results) && blobData.results.length > 0) {
          score = blobData.results[0].value
        }
      } else {
        isCompleted = true
      }
    } catch {
      // Unparseable blob → legacy data, treat as completed
      isCompleted = true
    }
  } else {
    // No blob data but Q type — assume completed (legacy data)
    isCompleted = true
  }

  return {
    observationId: obs.observationId,
    title,
    shortTitle,
    questionnaireCode,
    isCompleted,
    score,
    progress,
    observationBlob: blob || null,
    rawObservation: obs,
  }
}
