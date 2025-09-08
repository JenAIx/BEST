<template>
  <AppDialog
    v-model="localShow"
    :title="dialogTitle"
    size="xl"
    :subtitle="dialogSubtitle"
    :show-ok="isCompletedQuestionnaire"
    :ok-label="isCompletedQuestionnaire ? 'Export PDF' : undefined"
    :ok-icon="isCompletedQuestionnaire ? 'picture_as_pdf' : undefined"
    ok-color="primary"
    :content-padding="false"
    @ok="exportToPDF"
  >
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Loading questionnaire data...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="error-container">
      <q-icon name="error" size="48px" color="negative" />
      <div class="text-h6 text-negative q-mt-sm">Failed to load questionnaire</div>
      <div class="text-body2 text-grey-6">Please try again or contact support if the problem persists.</div>
    </div>

    <!-- Content -->
    <div v-else-if="questionnaire" class="questionnaire-content q-pa-md">
      <!-- Use CompletedQuestionnaireView for completed questionnaire results -->
      <CompletedQuestionnaireView v-if="isCompletedQuestionnaire" :results="questionnaire" :completion-date="completionDate" />
      <!-- Use PreviewSurveyTemplate for questionnaire templates -->
      <PreviewSurveyTemplate v-else :questionnaire="questionnaire" />
    </div>

    <!-- No Data State -->
    <div v-else class="no-data-container">
      <q-icon name="quiz" size="48px" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-sm">No questionnaire data available</div>
      <div class="text-body2 text-grey-5">Please check the questionnaire configuration or try again.</div>
    </div>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useLoggingStore } from 'src/stores/logging-store'
import { useObservationStore } from 'src/stores/observation-store'
import { usePatientStore } from 'src/stores/patient-store'
import AppDialog from './AppDialog.vue'
import PreviewSurveyTemplate from '../questionnaire/PreviewSurveyTemplate.vue'
import CompletedQuestionnaireView from '../questionnaire/CompletedQuestionnaireView.vue'

const props = defineProps({
  modelValue: Boolean,

  // For global settings context (JSON string)
  jsonContent: {
    type: String,
    default: null,
  },

  // For observation context (parsed object)
  questionnaireData: {
    type: Object,
    default: null,
  },

  // Additional context for observations
  observationId: {
    type: [String, Number],
    default: null,
  },
  conceptName: {
    type: String,
    default: null,
  },
  completionDate: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

// Initialize stores
const $q = useQuasar()
const loggingStore = useLoggingStore()
const observationStore = useObservationStore()
const patientStore = usePatientStore()
const logger = loggingStore.createLogger('QuestionnairePreviewDialog')

// Local state - initialize with modelValue
const localShow = ref(props.modelValue || false)

// State for loading questionnaire data
const questionnaire = ref(null)
const loading = ref(false)
const loadError = ref(null)

// Load questionnaire data based on context
const loadQuestionnaireData = async () => {
  // If we have questionnaireData (observation context), use it directly
  if (props.questionnaireData) {
    questionnaire.value = props.questionnaireData
    return
  }

  // If we have jsonContent (global settings context), parse it
  if (props.jsonContent) {
    try {
      questionnaire.value = JSON.parse(props.jsonContent)
      return
    } catch {
      loadError.value = 'Failed to parse questionnaire JSON'
      return
    }
  }

  // If we have observationId, fetch the data from database
  if (props.observationId) {
    await loadQuestionnaireFromObservation()
    return
  }

  loadError.value = 'No questionnaire data provided'
}

// Load questionnaire data from observation BLOB using lazy loading
const loadQuestionnaireFromObservation = async () => {
  if (!props.observationId) return

  try {
    loading.value = true
    loadError.value = null

    // Use the lazy loading approach from visit-observation-store
    const observationDetails = await observationStore.loadObservationDetails(props.observationId)

    if (observationDetails && observationDetails.observationBlob) {
      questionnaire.value = observationDetails.observationBlob
    } else {
      loadError.value = 'No questionnaire data found for this observation'
    }
  } catch (error) {
    loggingStore.error('QuestionnairePreviewDialog', 'Failed to load questionnaire data', error, {
      observationId: props.observationId,
      conceptName: props.conceptName,
    })
    loadError.value = 'Failed to load questionnaire data'
  } finally {
    loading.value = false
  }
}

const dialogTitle = computed(() => {
  if (props.observationId) {
    return 'Questionnaire Response'
  }
  return 'Questionnaire Preview'
})

const dialogSubtitle = computed(() => {
  if (props.observationId && props.conceptName) {
    const dateStr = props.completionDate ? new Date(props.completionDate).toLocaleDateString() : 'Unknown date'
    return `${props.conceptName} - Completed on ${dateStr}`
  }
  return 'Interactive preview of how this questionnaire appears to users'
})

// Detect if this is a completed questionnaire (has response values) vs a template
const isCompletedQuestionnaire = computed(() => {
  if (!questionnaire.value) return false

  // Check if this has completed response data
  return questionnaire.value.items && questionnaire.value.items.length > 0 && questionnaire.value.items[0].value !== undefined
})

const exportToPDF = async () => {
  if (!isCompletedQuestionnaire.value || !questionnaire.value) {
    $q.notify({
      type: 'warning',
      message: 'Only completed questionnaires can be exported to PDF',
      position: 'top',
    })
    return
  }

  logger.logUserAction('questionnaire_pdf_export_requested', {
    observationId: props.observationId,
    conceptName: props.conceptName,
    questionnaireTitle: questionnaire.value.title,
    itemCount: questionnaire.value.items?.length || 0,
  })

  try {
    // Create a clean HTML version for PDF
    const htmlContent = generateQuestionnairePDFContent()

    // Create a temporary element for printing
    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()

      // Close the window after printing (user can cancel)
      printWindow.onafterprint = () => {
        printWindow.close()
      }
    }

    logger.info('Questionnaire PDF export initiated', {
      observationId: props.observationId,
      questionnaireTitle: questionnaire.value.title,
    })
  } catch (error) {
    logger.error('Failed to export questionnaire PDF', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to export PDF. Please try again.',
      position: 'top',
    })
  }
}

const generateQuestionnairePDFContent = () => {
  const patient = patientStore.selectedPatient
  const patientName = getPatientName(patient)
  const questionnaireTitle = questionnaire.value.title || 'Questionnaire'
  const completionDateStr = props.completionDate ? new Date(props.completionDate).toLocaleDateString() : 'Unknown date'

  // Generate results summary
  let resultsHTML = ''
  const results = questionnaire.value.results || []
  if (Array.isArray(results) && results.length > 0) {
    resultsHTML = `
      <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
        <h2 style="color: #2e7d32; margin-bottom: 16px;">
          <i class="material-icons" style="font-size: 32px; vertical-align: middle;">assessment</i>
          Final Results
        </h2>
        <div style="display: flex; justify-content: center; gap: 30px; flex-wrap: wrap;">
          ${results
            .map(
              (result) => `
            <div style="text-align: center;">
              <div style="font-size: 36px; font-weight: bold; color: #2e7d32;">${result.value}</div>
              <div style="font-size: 16px; color: #666;">${result.coding?.display || result.label}</div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>
    `
  }

  // Generate individual responses
  let responsesHTML = ''
  if (questionnaire.value.items && questionnaire.value.items.length > 0) {
    responsesHTML = `
      <h2 style="color: #1976d2; margin-bottom: 20px;">
        <i class="material-icons" style="vertical-align: middle;">quiz</i>
        Individual Responses
      </h2>
      <div style="display: grid; gap: 16px;">
        ${questionnaire.value.items
          .map((item, index) => {
            const valueColor = getResponseValueColor(item.value)
            const formattedValue = formatResponseValue(item.value)

            return `
            <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; page-break-inside: avoid;">
              <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
                <div style="background: ${item.ignore_for_result ? '#9e9e9e' : '#1976d2'}; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0;">
                  ${index + 1}
                </div>
                <div style="flex: 1;">
                  <div style="font-weight: 500; margin-bottom: 4px;">${item.label || item.tag || item.id}</div>
                  ${item.ignore_for_result ? '<div style="font-size: 12px; color: #666;"><i class="material-icons" style="font-size: 14px; vertical-align: middle;">info</i> Not included in scoring</div>' : ''}
                </div>
              </div>
              <div style="background: ${valueColor}; color: white; padding: 12px 16px; border-radius: 6px; font-weight: 500; text-align: center;">
                ${formattedValue}
              </div>
            </div>
          `
          })
          .join('')}
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${questionnaireTitle} - ${patientName}</title>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.4;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: white;
        }
        .patient-header {
          background: #f5f5f5;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #9c27b0;
          margin-bottom: 20px;
        }
        .questionnaire-header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #1976d2;
        }
        .material-icons {
          vertical-align: middle;
          margin-right: 4px;
        }
        @media print {
          body { margin: 0; padding: 15px; }
          .material-icons { font-size: 14px !important; }
        }
      </style>
    </head>
    <body>
      <div class="patient-header">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">${patientName}</div>
        <div style="font-size: 14px; color: #666;">${getPatientBasicDetails(patient)}</div>
      </div>

      <div class="questionnaire-header">
        <h1 style="color: #1976d2; margin-bottom: 8px;">${questionnaireTitle}</h1>
        <div style="font-size: 16px; color: #666;">
          Completed on ${completionDateStr}
          ${props.conceptName ? ` • ${props.conceptName}` : ''}
        </div>
      </div>

      ${resultsHTML}
      ${responsesHTML}

      <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
        Generated on ${new Date().toLocaleString()} • BEST Scientific DB Manager
      </div>
    </body>
    </html>
  `
}

const getPatientName = (patient) => {
  if (!patient) return 'Unknown Patient'

  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      if (blob.name) return blob.name
      if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
    } catch {
      // Fallback to PATIENT_CD
    }
  }
  return patient.PATIENT_CD || 'Unknown Patient'
}

const getPatientBasicDetails = (patient) => {
  if (!patient) return ''

  const details = []

  if (patient.PATIENT_CD) {
    details.push(`ID: ${patient.PATIENT_CD}`)
  }

  if (patient.AGE_IN_YEARS) {
    details.push(`${patient.AGE_IN_YEARS} years`)
  }

  if (patient.SEX_RESOLVED) {
    details.push(patient.SEX_RESOLVED)
  } else if (patient.SEX_CD) {
    const genderMap = { M: 'Male', F: 'Female', U: 'Unknown', O: 'Other' }
    details.push(genderMap[patient.SEX_CD] || patient.SEX_CD)
  }

  return details.join(' • ')
}

const formatResponseValue = (value) => {
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

const getResponseValueColor = (value) => {
  if (value === null || value === undefined || value === '') return '#9e9e9e'
  if (Array.isArray(value)) return '#9c27b0'
  if (typeof value === 'boolean') return value ? '#4caf50' : '#f44336'
  if (typeof value === 'number') return '#2196f3'

  // Color based on common health survey responses
  const val = String(value).toLowerCase()
  if (val.includes('excellent') || val.includes('very good')) return '#4caf50'
  if (val.includes('good') || val.includes('fair')) return '#ff9800'
  if (val.includes('poor') || val.includes('bad')) return '#f44336'

  return '#1976d2'
}

// Watch for external model changes
watch(
  () => props.modelValue,
  async (newValue) => {
    localShow.value = newValue
    if (newValue) {
      // Reset state when opening
      questionnaire.value = null
      loadError.value = null
      await loadQuestionnaireData()
    }
  },
  { immediate: true },
)

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})
</script>

<style lang="scss" scoped>
.loading-container,
.error-container,
.no-data-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.questionnaire-content {
  max-height: none;
  background: white;

  // PDF-friendly styles
  @media print {
    background: white !important;
    color: black !important;

    .q-btn {
      display: none !important;
    }
  }
}

// Enhanced styling for better visual hierarchy
:deep(.q-card) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  border: 1px solid $grey-3;
}

:deep(.q-card__section) {
  padding: 16px;
}

// Style the questionnaire content areas
:deep(.questionnaire-section) {
  margin-bottom: 1.5rem;
  padding: 16px;
  background: $grey-1;
  border-radius: 8px;
  border-left: 4px solid $primary;

  &:last-child {
    margin-bottom: 0;
  }
}

:deep(.question-item) {
  margin-bottom: 1rem;
  padding: 12px 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid $grey-3;
  transition: all 0.2s ease;

  &:hover {
    background: $blue-1;
    border-color: $primary;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

:deep(.question-label) {
  font-weight: 600;
  color: $grey-8;
  margin-bottom: 8px;
  font-size: 0.95rem;
  line-height: 1.3;
}

:deep(.question-value) {
  font-weight: 500;
  color: $grey-9;
  padding: 8px 12px;
  background: $primary;
  color: white;
  border-radius: 4px;
  text-align: center;
  font-size: 0.9rem;
}

:deep(.question-value--boolean) {
  background: $green-6;
}

:deep(.question-value--array) {
  background: $purple-6;
}

:deep(.question-value--empty) {
  background: $grey-5;
  color: $grey-7;
}

// Results section styling
:deep(.results-section) {
  background: $green-1;
  border: 1px solid $green-3;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 1.5rem;
  text-align: center;

  .results-title {
    color: $green-8;
    font-weight: 600;
    font-size: 1.1rem;
    margin-bottom: 16px;
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
    }

    .result-label {
      font-size: 1rem;
      color: $grey-6;
      margin-top: 4px;
    }
  }
}

// Template preview styling
:deep(.template-preview) {
  .template-title {
    color: $primary;
    font-weight: 600;
    font-size: 1.1rem;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid $primary;
  }

  .template-description {
    color: $grey-7;
    font-size: 0.9rem;
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .template-questions {
    .question-preview {
      margin-bottom: 12px;
      padding: 12px;
      background: $grey-1;
      border-radius: 6px;
      border-left: 3px solid $primary;

      .question-text {
        font-weight: 500;
        color: $grey-8;
        margin-bottom: 4px;
      }

      .question-type {
        font-size: 0.8rem;
        color: $grey-6;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .questionnaire-content {
    padding: 12px !important;
  }

  :deep(.results-section) {
    padding: 16px;

    .results-grid {
      gap: 20px;
    }

    .result-item {
      .result-value {
        font-size: 1.8rem;
      }
    }
  }

  :deep(.question-item) {
    padding: 10px 12px;
  }
}

// Print styles for PDF export
@media print {
  .questionnaire-content {
    padding: 0 !important;
  }

  :deep(.question-item) {
    page-break-inside: avoid;
    border: 1px solid #000 !important;
    margin-bottom: 8px !important;
  }

  :deep(.results-section) {
    border: 1px solid #000 !important;
    background: #f5f5f5 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  :deep(.question-value) {
    background: #1976d2 !important;
    color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
