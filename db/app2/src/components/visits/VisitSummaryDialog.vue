<template>
  <AppDialog v-model="dialogModel" :title="dialogTitle" :subtitle="dialogSubtitle" size="xl" :show-actions="false" :show-close="true">
    <div v-if="loading" class="loading-container">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Loading visit summary...</div>
    </div>

    <div v-else-if="observationStore.error" class="error-container">
      <q-icon name="error" size="48px" color="negative" />
      <div class="text-h6 text-negative q-mt-sm">Failed to load visit data</div>
      <div class="text-body2 text-grey-6">{{ observationStore.error }}</div>
    </div>

    <div v-else-if="!visit" class="no-visit-selected">
      <q-icon name="event_busy" size="48px" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-sm">No visit selected</div>
      <div class="text-body2 text-grey-5">Please select a visit to view its summary.</div>
    </div>

    <div v-else class="visit-summary-content q-pa-md">
      <!-- Visit Overview Header -->
      <div class="visit-header q-mb-lg">
        <div class="text-h5 text-primary q-mb-sm">
          <q-icon name="event" class="q-mr-sm" />
          Visit Summary Report
        </div>
        <div class="visit-meta-info">
          <div class="row q-gutter-lg">
            <div class="col-auto"><strong>Date:</strong> {{ formattedDate }}</div>
            <div class="col-auto"><strong>Type:</strong> {{ visitTypeLabel }}</div>
            <div class="col-auto"><strong>Total Observations:</strong> {{ totalObservations }}</div>
          </div>
          <div v-if="visit.notes" class="visit-notes q-mt-md"><strong>Notes:</strong> {{ visit.notes }}</div>
        </div>
      </div>

      <!-- Observations by Category -->
      <div v-if="categorizedObservations.length > 0" class="observations-section">
        <div v-for="category in categorizedObservations" :key="category.name" class="category-section q-mb-xl">
          <!-- Category Header -->
          <div class="category-header q-mb-md">
            <h6 class="text-h6 text-primary q-my-none">
              <q-icon :name="getCategoryIcon(category.name)" class="q-mr-sm" />
              {{ category.name }}
              <span class="text-grey-6 text-body2 q-ml-sm">({{ category.observations.length }} observations)</span>
            </h6>
          </div>

          <!-- Category Table -->
          <q-markup-table separator="horizontal" flat bordered class="category-table">
            <thead>
              <tr>
                <th class="text-center type-col">Type</th>
                <th class="text-left concept-col">Concept</th>
                <th class="text-left value-col">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="obs in category.observations" :key="obs.observationId" class="observation-row">
                <td class="text-center">
                  <q-badge :color="getValueTypeColor(obs.valueType)" :label="obs.valueType" class="value-type-badge" />
                </td>
                <td class="text-left concept-name">
                  {{ obs.conceptName }}
                </td>
                <td class="text-left observation-value">
                  <!-- Questionnaire Values -->
                  <div v-if="obs.valueType === 'Q'" class="questionnaire-value">
                    <q-icon name="quiz" size="16px" color="deep-purple" class="q-mr-xs" />
                    <span class="questionnaire-name">{{ obs.displayValue || 'Questionnaire' }}</span>
                    <q-btn flat round dense icon="visibility" size="xs" color="deep-purple" @click="previewQuestionnaire(obs)" class="action-btn q-ml-sm">
                      <q-tooltip>View Questionnaire Results</q-tooltip>
                    </q-btn>
                  </div>

                  <!-- Regular Values -->
                  <div v-else-if="obs.valueType !== 'R' && obs.valueType !== 'Q'" class="value-display">
                    <span class="value-text">{{ obs.displayValue || 'No value' }}</span>
                    <span v-if="obs.unit" class="value-unit text-grey-5 q-ml-xs">{{ obs.unit }}</span>
                  </div>

                  <!-- File Values -->
                  <div v-else-if="obs.valueType === 'R' && obs.fileInfo" class="file-value">
                    <q-icon :name="getFileIcon(obs.fileInfo.filename)" :color="getFileColor(obs.fileInfo.filename)" size="16px" class="q-mr-xs" />
                    <span class="file-name">{{ obs.fileInfo.filename }}</span>
                    <span class="file-size text-caption text-grey-6 q-ml-xs"> ({{ formatFileSize(obs.fileInfo.size) }}) </span>
                    <q-btn flat round dense icon="visibility" size="xs" color="primary" @click="previewFile(obs)" class="action-btn q-ml-sm">
                      <q-tooltip>Preview File</q-tooltip>
                    </q-btn>
                  </div>

                  <!-- No file state -->
                  <span v-else-if="obs.valueType === 'R'" class="text-grey-6 text-italic"> No file attached </span>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </div>
      </div>

      <!-- No observations state -->
      <div v-else class="no-observations">
        <q-icon name="assignment" size="48px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-sm">No observations recorded</div>
        <div class="text-body2 text-grey-5">This visit has no recorded observations yet.</div>
      </div>
    </div>

    <!-- File Preview Dialog -->
    <FilePreviewDialog
      v-if="selectedFileObservation"
      v-model="showFilePreview"
      :observation-id="selectedFileObservation.observationId"
      :file-info="selectedFileObservation.fileInfo"
      :concept-name="selectedFileObservation.conceptName"
      :upload-date="selectedFileObservation.date"
    />

    <!-- Questionnaire Preview Dialog -->
    <QuestionnairePreviewDialog
      v-if="selectedQuestionnaireObservation"
      v-model="showQuestionnairePreview"
      :observation-id="selectedQuestionnaireObservation.observationId"
      :concept-name="selectedQuestionnaireObservation.conceptName"
      :completion-date="selectedQuestionnaireObservation.date"
    />
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from 'src/components/shared/AppDialog.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'
import QuestionnairePreviewDialog from 'src/components/shared/QuestionnairePreviewDialog.vue'
import { getVisitTypeLabel, getValueTypeColor, getCategoryIcon, getFileIcon, getFileColor, formatFileSize, formatDateVerbose } from 'src/shared/utils/medical-utils.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  visit: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const visitStore = useVisitStore()
const observationStore = useObservationStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitSummaryDialog')

// State
const selectedFileObservation = ref(null)
const showFilePreview = ref(false)
const selectedQuestionnaireObservation = ref(null)
const showQuestionnairePreview = ref(false)

// Computed
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dialogTitle = computed(() => {
  if (!props.visit) return 'Visit Summary'
  return `Visit Summary - ${formattedDate.value}`
})

const dialogSubtitle = computed(() => {
  if (!props.visit) return 'No visit selected'
  return `${visitTypeLabel.value} • ${totalObservations.value} observations`
})

const formattedDate = computed(() => {
  return formatDateVerbose(props.visit?.date)
})

const visitTypeLabel = computed(() => {
  return getVisitTypeLabel(props.visit?.type)
})

const totalObservations = computed(() => {
  return observations.value.length
})

// Use store data when visit matches selected visit, otherwise load separately
const observations = computed(() => {
  if (props.visit && visitStore.selectedVisit && props.visit.id === visitStore.selectedVisit.id) {
    return observationStore.observations
  }
  return [] // Could implement separate loading for non-selected visits if needed
})

const loading = computed(() => {
  return observationStore.loading
})

const categorizedObservations = computed(() => observationStore.categorizedObservations)

// Methods
// Observations are now loaded via the store
// Utility functions imported from medical-utils.js

const previewFile = (observation) => {
  logger.logUserAction('file_preview_requested', {
    observationId: observation.observationId,
    conceptCode: observation.conceptCode,
    conceptName: observation.conceptName,
    fileName: observation.fileInfo?.filename,
    fileSize: observation.fileInfo?.size,
    visitId: props.visit?.id,
  })

  selectedFileObservation.value = observation
  showFilePreview.value = true
}

const previewQuestionnaire = (observation) => {
  logger.logUserAction('questionnaire_preview_requested', {
    observationId: observation.observationId,
    conceptCode: observation.conceptCode,
    conceptName: observation.conceptName,
    visitId: props.visit?.id,
  })

  selectedQuestionnaireObservation.value = observation
  showQuestionnairePreview.value = true
}

// Watch for dialog open/close
watch(dialogModel, async (newValue) => {
  if (newValue && props.visit) {
    // Log dialog opening
    logger.logUserAction('visit_summary_dialog_opened', {
      visitId: props.visit.id,
      visitType: props.visit.type,
      visitDate: props.visit.date,
      observationCount: props.visit.observationCount || 0,
    })

    // Ensure observations are loaded for the visit
    if (visitStore.selectedVisit?.id !== props.visit.id) {
      const timer = logger.startTimer('visit_summary_data_load')
      try {
        await visitObservationService.selectVisitAndLoadObservations(props.visit)
        const duration = timer.end()
        logger.info('Visit summary data loaded', {
          visitId: props.visit.id,
          observationsCount: observationStore.observations.length,
          duration: `${duration.toFixed(2)}ms`,
        })
      } catch (error) {
        timer.end()
        logger.error('Failed to load visit summary data', error, {
          visitId: props.visit.id,
        })
      }
    }
  } else {
    // Log dialog closing
    if (props.visit) {
      logger.logUserAction('visit_summary_dialog_closed', {
        visitId: props.visit.id,
        hadFilePreview: !!selectedFileObservation.value,
      })
    }

    selectedFileObservation.value = null
    showFilePreview.value = false
    selectedQuestionnaireObservation.value = null
    showQuestionnairePreview.value = false
  }
})
</script>

<style lang="scss" scoped>
.loading-container,
.error-container,
.no-visit-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.visit-summary-content {
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

.visit-header {
  border-bottom: 2px solid $primary;
  padding-bottom: 1rem;

  .visit-meta-info {
    font-size: 0.95rem;
    line-height: 1.4;

    .visit-notes {
      background: $grey-1;
      padding: 12px 16px;
      border-radius: 4px;
      border-left: 3px solid $primary;
      font-style: italic;
    }
  }
}

.category-section {
  page-break-inside: avoid;

  .category-header {
    border-bottom: 1px solid $grey-4;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
}

.category-table {
  font-size: 0.9rem;

  // Column widths for better layout
  .type-col {
    width: 15%;
    min-width: 100px;
  }

  .concept-col {
    width: 40%;
    min-width: 200px;
  }

  .value-col {
    width: 45%;
    min-width: 200px;
  }

  thead th {
    background: $grey-2;
    font-weight: 600;
    color: $grey-8;
    padding: 12px 8px;
    border-bottom: 2px solid $grey-4;
  }

  tbody td {
    padding: 10px 8px;
    vertical-align: top;
    border-bottom: 1px solid $grey-3;
  }

  .observation-row {
    &:hover {
      background: $blue-1;
    }

    &:nth-child(even) {
      background: $grey-1;

      &:hover {
        background: $blue-1;
      }
    }
  }

  .concept-name {
    font-weight: 500;
    color: $grey-8;
    line-height: 1.3;
  }

  .value-type-badge {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .observation-value {
    .value-display {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      flex-wrap: wrap;
    }

    .value-text {
      font-weight: 500;
      color: $grey-9;
      word-break: break-word;
    }

    .value-unit {
      font-size: 0.85rem;
      font-weight: 400;
      font-style: italic;
    }

    .questionnaire-value {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      .questionnaire-name {
        font-weight: 500;
        color: $deep-purple-8;
      }
    }

    .file-value {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;

      .file-name {
        font-weight: 500;
        color: $grey-8;
      }

      .file-size {
        font-size: 0.8rem;
      }
    }
  }

  .action-btn {
    min-width: auto;
  }
}

.no-observations {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  background: $grey-1;
  border-radius: 8px;
  border: 2px dashed $grey-3;
}

// Print styles for PDF export
@media print {
  .visit-summary-content {
    padding: 0 !important;
  }

  .category-table {
    border-collapse: collapse !important;

    thead th,
    tbody td {
      border: 1px solid #000 !important;
      padding: 8px !important;
    }

    thead th {
      background: #f5f5f5 !important;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
    }

    .observation-row:nth-child(even) {
      background: #fafafa !important;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
    }
  }

  .category-section {
    page-break-inside: avoid;
    margin-bottom: 2rem !important;
  }

  .category-header {
    page-break-after: avoid;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .visit-header .visit-meta-info .row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .category-table {
    font-size: 0.8rem;

    .type-col {
      min-width: 80px;
    }

    .concept-col {
      min-width: 150px;
    }

    .value-col {
      min-width: 120px;
    }

    thead th,
    tbody td {
      padding: 8px 4px;
    }
  }
}
</style>
