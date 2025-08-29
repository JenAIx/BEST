<template>
  <div v-if="results" class="completed-questionnaire">
    <!-- Header -->
    <div class="questionnaire-header q-mb-lg">
      <div class="text-h4 text-weight-bold text-center q-mb-sm">{{ results.title }}</div>
      <div v-if="results.short_title && results.short_title !== results.title" class="text-subtitle1 text-center text-grey-7 q-mb-sm">
        {{ results.short_title }}
      </div>

      <!-- Completion Summary -->
      <div class="completion-summary text-center q-mb-lg">
        <div class="row justify-center q-gutter-md">
          <q-chip color="primary" text-color="white" icon="quiz" size="md"> {{ results.items?.length || 0 }} Questions Answered </q-chip>
          <q-chip v-if="completionDate" color="secondary" text-color="white" icon="event" size="md">
            {{ formatDate(completionDate) }}
          </q-chip>
          <q-chip v-if="computedResults.length > 0 && computedResults[0].value !== undefined" color="positive" text-color="white" icon="star" size="md">
            {{ computedResults[0].coding?.display || computedResults[0].label }}: {{ computedResults[0].value }}
          </q-chip>
        </div>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="computedResults && computedResults.length > 0" class="results-summary q-mb-xl">
      <q-card flat bordered class="result-card">
        <q-card-section class="text-center bg-positive text-white">
          <div class="text-h5 q-mb-sm">
            <q-icon name="assessment" size="32px" class="q-mr-sm" />
            Final Results
          </div>
          <div class="row justify-center q-gutter-lg">
            <div v-for="result in computedResults" :key="result.label" class="result-item">
              <div class="text-h3 text-weight-bold">{{ result.value }}</div>
              <div class="text-subtitle2">{{ result.coding?.display || result.label }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Individual Responses -->
    <div v-if="results.items?.length" class="responses-section">
      <div class="text-h5 text-weight-medium q-mb-md">
        <q-icon name="quiz" class="q-mr-sm" />
        Individual Responses
      </div>

      <div class="responses-grid">
        <q-card v-for="(item, index) in results.items" :key="`response-${item.id || index}`" flat bordered class="response-card">
          <q-card-section>
            <!-- Question Number and Label -->
            <div class="response-header q-mb-md">
              <div class="row items-start no-wrap">
                <div class="col-auto">
                  <q-avatar :color="item.ignore_for_result ? 'grey-5' : 'primary'" text-color="white" size="32px" class="question-number">
                    {{ index + 1 }}
                  </q-avatar>
                </div>
                <div class="col q-ml-md">
                  <div class="text-subtitle1 text-weight-medium question-text">
                    {{ item.label || item.tag || item.id }}
                  </div>
                  <div v-if="item.ignore_for_result" class="text-caption text-grey-6 q-mt-xs">
                    <q-icon name="info" size="14px" class="q-mr-xs" />
                    Not included in scoring
                  </div>
                </div>
              </div>
            </div>

            <!-- Response Value -->
            <div class="response-value">
              <q-chip :color="getValueColor(item.value)" text-color="white" size="lg" class="response-chip full-width">
                <q-icon :name="getValueIcon(item.value)" class="q-mr-sm" />
                {{ formatValue(item.value) }}
              </q-chip>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Completion Details -->
    <div v-if="results.date_start || results.date_end" class="completion-details q-mt-xl">
      <q-card flat bordered class="bg-grey-1">
        <q-card-section>
          <div class="text-h6 text-weight-medium q-mb-md">
            <q-icon name="schedule" class="q-mr-sm" />
            Completion Details
          </div>
          <div class="row q-col-gutter-md">
            <div v-if="results.date_start" class="col-md-4">
              <div class="detail-item">
                <div class="text-caption text-grey-6">Started</div>
                <div class="text-body1 text-weight-medium">{{ formatDateTime(results.date_start) }}</div>
              </div>
            </div>
            <div v-if="results.date_end" class="col-md-4">
              <div class="detail-item">
                <div class="text-caption text-grey-6">Completed</div>
                <div class="text-body1 text-weight-medium">{{ formatDateTime(results.date_end) }}</div>
              </div>
            </div>
            <div v-if="results.date_start && results.date_end" class="col-md-4">
              <div class="detail-item">
                <div class="text-caption text-grey-6">Duration</div>
                <div class="text-body1 text-weight-medium">{{ calculateDuration(results.date_start, results.date_end) }}</div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>

  <!-- No Results State -->
  <div v-else class="no-results text-center q-pa-xl">
    <q-icon name="quiz" size="80px" color="grey-4" />
    <div class="text-h6 text-grey-6 q-mt-md">No questionnaire results available</div>
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

const getValueColor = (value) => {
  if (value === null || value === undefined || value === '') return 'grey-5'
  if (Array.isArray(value)) return 'deep-purple'
  if (typeof value === 'boolean') return value ? 'positive' : 'negative'
  if (typeof value === 'number') return 'blue'

  // Color based on common health survey responses
  const val = String(value).toLowerCase()
  if (val.includes('excellent') || val.includes('very good')) return 'positive'
  if (val.includes('good') || val.includes('fair')) return 'orange'
  if (val.includes('poor') || val.includes('bad')) return 'negative'

  return 'primary'
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
  padding: 1rem;
}

.questionnaire-header {
  .completion-summary {
    .q-chip {
      font-size: 0.875rem;
    }
  }
}

.results-summary {
  .result-card {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .result-item {
    text-align: center;

    .text-h3,
    .text-h4 {
      line-height: 1.2;
    }
  }
}

.responses-section {
  .responses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }

  .response-card {
    border-radius: 8px;
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
  }

  .response-header {
    .question-number {
      font-weight: 600;
      font-size: 0.875rem;
    }

    .question-text {
      line-height: 1.4;
      color: $grey-8;
    }
  }

  .response-value {
    .response-chip {
      justify-content: flex-start;
      padding: 0.75rem 1rem;
      font-weight: 500;
      font-size: 0.875rem;
      min-height: 40px;

      &.full-width {
        width: 100%;
      }
    }
  }
}

.completion-details {
  .detail-item {
    padding: 0.5rem;
    text-align: center;

    .text-caption {
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
  }
}

.no-results {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .completed-questionnaire {
    padding: 0.5rem;
  }

  .responses-grid {
    grid-template-columns: 1fr;
  }

  .completion-summary .row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .results-summary .row {
    flex-direction: column;
    text-align: center;
  }
}
</style>
