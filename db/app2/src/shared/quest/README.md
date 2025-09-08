# Questionnaire Helper Functions

This directory contains helper functions extracted from the main questionnaire store to improve modularity and maintainability.

## Directory Structure

```
quest/
├── index.js              # Central export point for all helpers
├── questionnaire-results.js   # Results calculation and processing
├── questionnaire-valtype.js   # VALTYPE_CD handling and concept resolution
├── questionnaire-database.js  # Database operations and observation creation
├── questionnaire-utils.js     # Utility functions
└── README.md             # This documentation
```

## Files Overview

### `questionnaire-results.js`

Handles calculation, evaluation, and processing of questionnaire results.

**Key Functions:**

- `calculateResults()` - Main results calculation (QuestMan-style)
- `calculateQuestManResults()` - Process results based on method (sum, avg, count)
- `calculateQuestManSum()`, `calculateQuestManAvg()`, `calculateQuestManCount()` - Specific calculation methods
- `evaluateResults()` - Apply evaluation criteria to results

### `questionnaire-valtype.js`

Handles different VALTYPE_CD values for questionnaire observations.

**Key Functions:**

- `handleValueTypeCd()` - Main VALTYPE_CD processing switch
- `handleSelectionValueType()` - Handle VALTYPE_CD 'S' (Selection) with concept resolution
- `findMatchingOption()` - Find matching options using exact/2-letter matching

### `questionnaire-database.js`

Handles database operations for questionnaire responses and observations.

**Key Functions:**

- `saveQuestionnaireResponse()` - Main save function
- `saveMainQuestionnaireResponse()` - Save questionnaire record (VALTYPE_CD='Q')
- `saveIndividualResultsAsObservations()` - Extract and save individual observations
- `saveResultsAsObservations()`, `saveAnswersAsObservations()` - Save specific observation types
- `findConceptInDatabase()` - Flexible concept lookup
- `createObservationFromQuestionnaireItem()` - Create observation with VALTYPE_CD handling

### `questionnaire-utils.js`

Contains miscellaneous utility functions for questionnaire processing.

**Key Functions:**

- `randomFill()` - Fill questionnaire with random test data
- `testQuestionnaireExtraction()` - Test observation extraction for existing questionnaires

## Usage

### Importing Individual Functions

```javascript
import { calculateResults } from '../shared/quest/questionnaire-results.js'
import { handleValueTypeCd } from '../shared/quest/questionnaire-valtype.js'
import { saveQuestionnaireResponse } from '../shared/quest/questionnaire-database.js'
```

### Importing from Central Index

```javascript
import { calculateResults, handleValueTypeCd, saveQuestionnaireResponse, randomFill } from '../shared/quest/index.js'
```

## Refactoring Benefits

1. **Modularity**: Functions are grouped by responsibility
2. **Maintainability**: Easier to find and modify specific functionality
3. **Testability**: Individual functions can be tested in isolation
4. **Reusability**: Functions can be used outside the store context
5. **Code Organization**: Clear separation of concerns
6. **Backward Compatibility**: Store interface remains unchanged

## Migration Notes

- All existing function calls in the questionnaire store continue to work
- UI components don't need any changes
- Functions are re-exported from the store for backward compatibility
- The store acts as a thin wrapper around the helper functions

## Future Improvements

- Consider adding unit tests for individual helper functions
- Add TypeScript definitions for better type safety
- Consider adding more specialized modules (e.g., validation, formatting)
- Add performance optimizations for large questionnaires
