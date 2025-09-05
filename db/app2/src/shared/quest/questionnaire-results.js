/**
 * Questionnaire Results Processing
 *
 * Handles calculation, evaluation, and processing of questionnaire results
 */

import { logger } from '../../core/services/logging-service.js'

/**
 * Calculate questionnaire results (QuestMan-style)
 * @param {Object} activeQuestionnaire - The active questionnaire
 * @param {Object} currentResponses - Current user responses
 * @returns {Object} Calculated results
 */
export const calculateResults = (activeQuestionnaire, currentResponses) => {
  if (!activeQuestionnaire) return null

  // Create QuestMan-style summary structure
  const results = {
    label: activeQuestionnaire.code,
    title: activeQuestionnaire.title,
    short_title: activeQuestionnaire.short_title || activeQuestionnaire.code,
    questionnaire_code: activeQuestionnaire.code,
    date_start: activeQuestionnaire.startTime,
    date_end: Date.now(),
    items: [],
    results: null,
    coding: activeQuestionnaire.coding,
  }

  // Process individual responses (QuestMan items format)
  activeQuestionnaire.items.forEach((item) => {
    // Handle multiple_radio questions specially (like original QuestMan)
    if (item.type === 'multiple_radio' && Array.isArray(item.id)) {
      const arrayId = item.id[0] || item.id
      const responseArray = currentResponses.value[arrayId]

      if (Array.isArray(responseArray) && item.options && item.options.questions) {
        // Create individual items for each question in the multiple_radio
        for (let i = 0; i < responseArray.length; i++) {
          if (responseArray[i] !== null && responseArray[i] !== undefined) {
            const question = item.options.questions[i]
            const questionId = item.id[i] || question.id

            const itemResult = {
              id: questionId,
              label: question.label || question.tag,
              tag: item.tag ? `${item.tag}_${question.tag}` : question.tag,
              value: responseArray[i],
              coding: question.coding,
              ignore_for_result: item.ignore_for_result,
            }

            results.items.push(itemResult)
          }
        }
      }
    } else if (item.id && currentResponses.value[item.id] !== undefined) {
      // Handle regular questions
      const itemResult = {
        id: item.id,
        label: item.label,
        tag: item.tag || item.id,
        value: currentResponses.value[item.id],
        coding: item.coding,
        ignore_for_result: item.ignore_for_result,
      }

      // Convert string numbers to actual numbers for calculation
      if (item.type === 'number' && typeof itemResult.value === 'string') {
        itemResult.value = parseFloat(itemResult.value) || 0
      }

      results.items.push(itemResult)
    }
  })

  // Calculate summary results based on configuration (QuestMan-style)
  if (activeQuestionnaire.results) {
    results.results = calculateQuestManResults(results.items, activeQuestionnaire.results)

    // Apply evaluation if configured
    if (activeQuestionnaire.results.evaluation) {
      results.results = evaluateResults(results.results, activeQuestionnaire.results.evaluation)
    }
  }

  return results
}

/**
 * Calculate QuestMan-style results
 * @param {Array} items - Questionnaire items with responses
 * @param {Object} resultsConfig - Results configuration
 * @returns {Array} Calculated results
 */
export const calculateQuestManResults = (items, resultsConfig) => {
  if (!resultsConfig.method) return null

  switch (resultsConfig.method) {
    case 'sum':
      return calculateQuestManSum(items, resultsConfig)
    case 'avg':
      return calculateQuestManAvg(items, resultsConfig)
    case 'count':
      return calculateQuestManCount(items, resultsConfig)
    default:
      logger.warn(`Unsupported results method: ${resultsConfig.method}`)
      return null
  }
}

/**
 * QuestMan-style sum calculation
 * @param {Array} items - Questionnaire items
 * @param {Object} config - Results configuration
 * @returns {Array} Sum results
 */
export const calculateQuestManSum = (items, config) => {
  let sum = 0
  items.forEach((item) => {
    if (typeof item.value === 'number' && item.ignore_for_result !== true) {
      sum += item.value
    } else if (Array.isArray(item.value) && item.ignore_for_result !== true) {
      item.value.forEach((val) => {
        if (typeof val === 'number') sum += val
      })
    }
  })

  const result = { label: 'sum', value: sum }
  if (config.coding) result.coding = config.coding
  return [result]
}

/**
 * QuestMan-style average calculation
 * @param {Array} items - Questionnaire items
 * @param {Object} config - Results configuration
 * @returns {Array} Average results
 */
export const calculateQuestManAvg = (items, config) => {
  let sum = 0
  let count = 0
  items.forEach((item) => {
    if (typeof item.value === 'number' && item.ignore_for_result !== true) {
      sum += item.value
      count++
    }
  })

  const average = count > 0 ? Math.round((sum / count) * 100) / 100 : 0
  const result = { label: 'avg', value: average }
  if (config.coding) result.coding = config.coding
  return [result]
}

/**
 * QuestMan-style count calculation
 * @param {Array} items - Questionnaire items
 * @param {Object} config - Results configuration
 * @returns {Array} Count results
 */
export const calculateQuestManCount = (items, config) => {
  const answers = []
  items.forEach((item) => answers.push(item.value))

  const uniqueAnswers = [...new Set(answers)]
  const count = {}
  uniqueAnswers.forEach((answer) => {
    count[answer] = { count: 0, label: answer }
  })

  let total = 0
  items.forEach((item) => {
    count[item.value].count++
    total++
  })

  const results = []
  Object.keys(count).forEach((key) => {
    const result = {
      label: count[key].label,
      value: count[key].count,
      total: total,
    }
    if (config.coding) result.coding = config.coding
    results.push(result)
  })

  return results
}

/**
 * Evaluate results based on evaluation configuration
 * @param {Array} results - Results to evaluate
 * @param {Array} evaluation - Evaluation configuration
 * @returns {Array} Evaluated results
 */
export const evaluateResults = (results, evaluation) => {
  if (!Array.isArray(results)) return results

  results.forEach((result) => {
    if (result.label === 'sum') {
      evaluation.forEach((evalItem) => {
        if (evalItem.range && evalItem.range[0] <= result.value && evalItem.range[1] >= result.value) {
          result.evaluation = evalItem.label
        }
      })
    }
  })

  return results
}
