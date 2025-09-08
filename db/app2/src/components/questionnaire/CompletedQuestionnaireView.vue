<template>
  <div v-if="results" class="completed-questionnaire">
    <!-- Questionnaire Header -->
    <div class="questionnaire-header q-mb-lg">
      <div class="text-h5 text-primary q-mb-sm">
        <q-icon name="quiz" class="q-mr-sm" />
        {{ results.title }}
      </div>
      <div v-if="results.short_title && results.short_title !== results.title" class="text-subtitle1 text-grey-7 q-mb-md">
        {{ results.short_title }}
      </div>

      <!-- Completion Summary -->
      <div class="completion-summary q-mb-lg">
        <div class="row justify-center q-gutter-md">
          <q-chip color="primary" text-color="white" icon="quiz" size="md" class="summary-chip"> {{ results.items?.length || 0 }} Questions Answered </q-chip>
          <q-chip v-if="completionDate" color="secondary" text-color="white" icon="event" size="md" class="summary-chip">
            {{ formatDate(completionDate) }}
          </q-chip>
          <q-chip v-if="computedResults.length > 0 && computedResults[0].value !== undefined" color="positive" text-color="white" icon="star" size="md" class="summary-chip">
            {{ computedResults[0].coding?.display || computedResults[0].label }}: {{ computedResults[0].value }}
          </q-chip>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="computedResults && computedResults.length > 0" class="results-summary q-mb-xl">
      <div class="results-card">
        <div class="results-header">
          <div class="text-h6 text-weight-medium">
            <q-icon name="assessment" class="q-mr-sm" />
            Final Results
          </div>
        </div>
        <div class="results-content">
          <div class="results-grid">
            <div v-for="result in computedResults" :key="result.label" class="result-item">
              <div class="result-value">{{ result.value }}</div>
              <div class="result-label">{{ result.coding?.display || result.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Individual Responses -->
    <div v-if="results.items?.length" class="responses-section">
      <div class="section-header q-mb-md">
        <h6 class="text-h6 text-primary q-my-none">
          <q-icon name="quiz" class="q-mr-sm" />
          Individual Responses
          <span class="text-grey-6 text-body2 q-ml-sm">({{ results.items.length }} responses)</span>
        </h6>
      </div>

      <div class="responses-grid">
        <div v-for="(item, index) in results.items" :key="`response-${item.id || index}`" class="response-card">
          <!-- Question Header -->
          <div class="response-header">
            <div class="row items-start q-gutter-sm">
              <div class="col-auto">
                <q-avatar :color="item.ignore_for_result ? 'grey-5' : 'primary'" text-color="white" size="32px" class="question-number">
                  {{ index + 1 }}
                </q-avatar>
              </div>
              <div class="col">
                <div class="question-text">{{ item.label || item.tag || item.id }}</div>
                <div v-if="item.ignore_for_result" class="question-note">
                  <q-icon name="info" size="14px" class="q-mr-xs" />
                  Not included in scoring
                </div>
              </div>
            </div>
          </div>

          <!-- Response Value -->
          <div class="response-value">
            <div class="value-display" :class="getValueClass(item.value)">
              <q-icon :name="getValueIcon(item.value)" class="q-mr-xs" />
              {{ formatValue(item.value) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Completion Details -->
    <div v-if="results.date_start || results.date_end" class="completion-details q-mt-xl">
      <div class="details-card">
        <div class="details-header">
          <div class="text-h6 text-weight-medium">
            <q-icon name="schedule" class="q-mr-sm" />
            Completion Details
          </div>
        </div>
        <div class="details-content">
          <div class="row q-col-gutter-md">
            <div v-if="results.date_start" class="col-md-4">
              <div class="detail-item">
                <div class="detail-label">Started</div>
                <div class="detail-value">{{ formatDateTime(results.date_start) }}</div>
              </div>
            </div>
            <div v-if="results.date_end" class="col-md-4">
              <div class="detail-item">
                <div class="detail-label">Completed</div>
                <div class="detail-value">{{ formatDateTime(results.date_end) }}</div>
              </div>
            </div>
            <div v-if="results.date_start && results.date_end" class="col-md-4">
              <div class="detail-item">
                <div class="detail-label">Duration</div>
                <div class="detail-value">{{ calculateDuration(results.date_start, results.date_end) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- No Results State -->
  <div v-else class="no-results">
    <q-icon name="quiz" size="48px" color="grey-4" />
    <div class="text-h6 text-grey-6 q-mt-sm">No questionnaire results available</div>
    <div class="text-body2 text-grey-5">The questionnaire data could not be loaded</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  results: {
    type: Object,
    default: null,
  },
  completionDate: {
    type: String,
    default: null,
  },
})

// Computed property to handle both old format (object) and new format (array)
const computedResults = computed(() => {
  if (!props.results) return []

  // Handle new format: results is an array
  if (Array.isArray(props.results.results)) {
    return props.results.results
  }

  // Handle old format: results is an object
  if (props.results.results && typeof props.results.results === 'object') {
    // Convert object format to array format for consistency
    const result = props.results.results
    return [
      {
        label: result.label || 'Score',
        value: result.value,
        coding: result.coding || null,
        percentage: result.percentage,
      },
    ].filter((item) => item.value !== undefined)
  }

  return []
})

// Helper methods
const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown date'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (value === null || value === undefined || value === '') {
    return 'No response'
  }
  return String(value)
}

const getValueIcon = (value) => {
  if (value === null || value === undefined || value === '') return 'help'
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'boolean') return value ? 'check_circle' : 'cancel'
  if (typeof value === 'number') return 'tag'

  // Icon based on common responses
  const val = String(value).toLowerCase()
  if (val.includes('excellent') || val.includes('very good')) return 'sentiment_very_satisfied'
  if (val.includes('good')) return 'sentiment_satisfied'
  if (val.includes('fair')) return 'sentiment_neutral'
  if (val.includes('poor') || val.includes('bad')) return 'sentiment_dissatisfied'

  return 'chat'
}

const getValueClass = (value) => {
  if (value === null || value === undefined || value === '') return 'value-empty'
  if (Array.isArray(value)) return 'value-array'
  if (typeof value === 'boolean') return value ? 'value-boolean-true' : 'value-boolean-false'
  if (typeof value === 'number') return 'value-number'

  // Class based on common health survey responses
  const val = String(value).toLowerCase()
  if (val.includes('excellent') || val.includes('very good')) return 'value-excellent'
  if (val.includes('good') || val.includes('fair')) return 'value-good'
  if (val.includes('poor') || val.includes('bad')) return 'value-poor'

  return 'value-default'
}

const calculateDuration = (start, end) => {
  if (!start || !end) return 'Unknown'
  const duration = end - start
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}
</script>

<style lang="scss" scoped>
.completed-questionnaire {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0;
  background: white;

  // PDF-friendly styles
  @media print {
    background: white !important;
    color: black !important;
  }
}

.questionnaire-header {
  border-bottom: 2px solid $primary;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;

  .completion-summary {
    .summary-chip {
      font-size: 0.875rem;
      font-weight: 500;
    }
  }
}

.results-summary {
  .results-card {
    background: $green-1;
    border: 1px solid $green-3;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .results-header {
    background: $green-2;
    padding: 16px 20px;
    border-bottom: 1px solid $green-3;

    .text-h6 {
      color: $green-8;
      font-weight: 600;
    }
  }

  .results-content {
    padding: 20px;
  }

  .results-grid {
    display: flex;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
  }

  .result-item {
    text-align: center;

    .result-value {
      font-size: 2.25rem;
      font-weight: 700;
      color: $green-8;
      line-height: 1;
      margin-bottom: 4px;
    }

    .result-label {
      font-size: 1rem;
      color: $grey-6;
      font-weight: 500;
    }
  }
}

.responses-section {
  .section-header {
    border-bottom: 1px solid $grey-4;
    padding-bottom: 8px;
    margin-bottom: 12px;

    h6 {
      color: $primary;
      font-weight: 600;
    }
  }

  .responses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 16px;
  }

  .response-card {
    background: white;
    border: 1px solid $grey-3;
    border-radius: 8px;
    padding: 16px;
    transition: all 0.2s ease;
    page-break-inside: avoid;

    &:hover {
      background: $blue-1;
      border-color: $primary;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &:nth-child(even) {
      background: $grey-1;

      &:hover {
        background: $blue-1;
      }
    }
  }

  .response-header {
    margin-bottom: 12px;

    .question-number {
      font-weight: 600;
      font-size: 0.875rem;
    }

    .question-text {
      font-weight: 500;
      color: $grey-8;
      line-height: 1.3;
      font-size: 0.95rem;
    }

    .question-note {
      font-size: 0.8rem;
      color: $grey-6;
      margin-top: 4px;
      display: flex;
      align-items: center;
    }
  }

  .response-value {
    .value-display {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 0.9rem;
      text-align: center;
      color: white;
      min-height: 40px;

      // Value type styling
      &.value-empty {
        background: $grey-5;
        color: $grey-7;
      }

      &.value-array {
        background: $purple-6;
      }

      &.value-boolean-true {
        background: $green-6;
      }

      &.value-boolean-false {
        background: $red-6;
      }

      &.value-number {
        background: $blue-6;
      }

      &.value-excellent {
        background: $green-6;
      }

      &.value-good {
        background: $orange-6;
      }

      &.value-poor {
        background: $red-6;
      }

      &.value-default {
        background: $primary;
      }
    }
  }
}

.completion-details {
  .details-card {
    background: $grey-1;
    border: 1px solid $grey-3;
    border-radius: 8px;
    overflow: hidden;
  }

  .details-header {
    background: $grey-2;
    padding: 16px 20px;
    border-bottom: 1px solid $grey-3;

    .text-h6 {
      color: $grey-8;
      font-weight: 600;
    }
  }

  .details-content {
    padding: 20px;
  }

  .detail-item {
    text-align: center;
    padding: 8px;

    .detail-label {
      font-size: 0.8rem;
      color: $grey-6;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .detail-value {
      font-size: 0.95rem;
      color: $grey-8;
      font-weight: 500;
    }
  }
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  background: $grey-1;
  border-radius: 8px;
  border: 2px dashed $grey-3;
  min-height: 200px;
}

// Responsive adjustments
@media (max-width: 768px) {
  .completed-questionnaire {
    padding: 0;
  }

  .responses-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .completion-summary .row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .results-grid {
    gap: 20px;
  }

  .result-item {
    .result-value {
      font-size: 1.8rem;
    }
  }

  .response-card {
    padding: 12px;
  }
}

// Print styles for PDF export
@media print {
  .completed-questionnaire {
    padding: 0 !important;
  }

  .response-card {
    page-break-inside: avoid;
    border: 1px solid #000 !important;
    margin-bottom: 8px !important;
  }

  .results-card {
    border: 1px solid #000 !important;
    background: #f5f5f5 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .value-display {
    background: #1976d2 !important;
    color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .details-card {
    border: 1px solid #000 !important;
    background: #f5f5f5 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
