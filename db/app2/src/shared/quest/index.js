/**
 * Questionnaire Helper Functions Index
 *
 * Central export point for all questionnaire-related helper functions
 */

// Results processing
export { calculateResults, calculateQuestManResults, calculateQuestManSum, calculateQuestManAvg, calculateQuestManCount, evaluateResults } from './questionnaire-results.js'

// VALTYPE_CD processing
export { handleValueTypeCd, handleSelectionValueType, findMatchingOption } from './questionnaire-valtype.js'

// Database operations
export {
  saveQuestionnaireResponse,
  saveMainQuestionnaireResponse,
  saveIndividualResultsAsObservations,
  saveResultsAsObservations,
  saveAnswersAsObservations,
  findConceptInDatabase,
  createObservationFromQuestionnaireItem,
} from './questionnaire-database.js'

// Utility functions
export { randomFill, testQuestionnaireExtraction } from './questionnaire-utils.js'
