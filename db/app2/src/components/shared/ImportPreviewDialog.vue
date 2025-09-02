<template>
  <AppDialog v-model="dialogModel" :title="dialogTitle" :subtitle="dialogSubtitle" size="xl" persistent :show-cancel="false" ok-label="Proceed with Import" @ok="handleProceed">
    <div v-if="fileAnalysis && fileAnalysis.success" class="import-preview">
      <!-- Survey Information (for survey files) -->
      <div v-if="fileAnalysis.isSurvey" class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="quiz" class="q-mr-sm" />
          Survey Information
        </div>
        <q-card flat bordered class="bg-purple-1">
          <q-card-section>
            <div class="row items-center q-gutter-md">
              <div class="col-auto">
                <q-icon name="assignment" size="48px" color="purple" />
              </div>
              <div class="col">
                <div class="text-h6 q-mb-xs">{{ fileAnalysis.questionnaire?.display || fileAnalysis.title }}</div>
                <div class="text-body2 text-grey-7 q-mb-sm">{{ fileAnalysis.questionnaire?.code }}</div>
                <div class="row q-gutter-lg">
                  <div class="text-center">
                    <div class="text-h6">{{ selectedItemsCount }}</div>
                    <div class="text-caption text-grey-6">Selected Items</div>
                  </div>
                  <div v-if="fileAnalysis.summary?.totalScore !== null" class="text-center">
                    <div class="text-h6">{{ fileAnalysis.summary.totalScore }}</div>
                    <div class="text-caption text-grey-6">Total Score</div>
                  </div>
                  <div v-if="fileAnalysis.summary?.evaluation" class="text-center">
                    <q-chip color="orange" text-color="white" size="sm" class="q-pa-xs">
                      {{ fileAnalysis.summary.evaluation }}
                    </q-chip>
                    <div class="text-caption text-grey-6">Evaluation</div>
                  </div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- File Info -->
      <div v-if="!fileAnalysis.isSurvey" class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="description" class="q-mr-sm" />
          File Information
        </div>
        <q-card flat bordered class="bg-blue-1">
          <q-card-section>
            <div class="row q-gutter-md">
              <div class="col-md-3 col-sm-6">
                <div class="text-center">
                  <q-icon name="folder" size="32px" color="primary" class="q-mb-sm" />
                  <div class="text-caption text-grey-7">Format</div>
                  <div class="text-body1 text-weight-medium">{{ fileAnalysis.format?.toUpperCase() }}</div>
                </div>
              </div>
              <div class="col-md-3 col-sm-6">
                <div class="text-center">
                  <q-icon name="people" size="32px" color="green" class="q-mb-sm" />
                  <div class="text-caption text-grey-7">Patients</div>
                  <div class="text-body1 text-weight-medium">{{ fileAnalysis.patientsCount || 0 }}</div>
                </div>
              </div>
              <div class="col-md-3 col-sm-6">
                <div class="text-center">
                  <q-icon name="event" size="32px" color="orange" class="q-mb-sm" />
                  <div class="text-caption text-grey-7">Visits</div>
                  <div class="text-body1 text-weight-medium">{{ fileAnalysis.visitsCount || 0 }}</div>
                </div>
              </div>
              <div class="col-md-3 col-sm-6">
                <div class="text-center">
                  <q-icon name="analytics" size="32px" color="purple" class="q-mb-sm" />
                  <div class="text-caption text-grey-7">Observations</div>
                  <div class="text-body1 text-weight-medium">{{ fileAnalysis.observationsCount || 0 }}</div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Target Information -->
      <div class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="target" class="q-mr-sm" />
          Import Target
        </div>
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center q-gutter-lg">
              <div class="col-auto">
                <q-icon name="person" color="green" size="24px" />
              </div>
              <div class="col">
                <div class="text-body1 text-weight-medium">{{ getPatientName(selectedPatient) }}</div>
                <div class="text-caption text-grey-6">Patient ID: {{ selectedPatient?.PATIENT_CD }}</div>
              </div>
              <div class="col-auto">
                <q-icon name="arrow_forward" color="grey-5" size="20px" />
              </div>
              <div class="col-auto">
                <q-icon name="event" color="blue" size="24px" />
              </div>
              <div class="col">
                <div class="text-body1 text-weight-medium">{{ getVisitDisplayName() }}</div>
                <div class="text-caption text-grey-6">{{ getVisitDetails() }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Import Strategy -->
      <div class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="settings" class="q-mr-sm" />
          Import Strategy
        </div>
        <q-card flat bordered>
          <q-card-section>
            <div class="row items-center q-gutter-md">
              <q-icon :name="getStrategyIcon(fileAnalysis.recommendedStrategy)" :color="getStrategyColor(fileAnalysis.recommendedStrategy)" size="24px" />
              <div>
                <div class="text-body1 text-weight-medium">{{ getStrategyDisplayName(fileAnalysis.recommendedStrategy) }}</div>
                <div class="text-caption text-grey-6">{{ getStrategyDescription(fileAnalysis.recommendedStrategy) }}</div>
              </div>
              <q-chip :color="getStrategyColor(fileAnalysis.recommendedStrategy)" text-color="white" size="sm" class="q-ml-auto">
                {{ fileAnalysis.recommendedStrategy?.replace('_', ' ').toUpperCase() }}
              </q-chip>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Survey Items (for survey files) -->
      <div v-if="fileAnalysis.isSurvey && (fileAnalysis.items?.length > 0 || fileAnalysis.results?.length > 0)" class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="checklist" class="q-mr-sm" />
          Survey Items
          <q-space />
          <q-btn flat size="sm" color="primary" label="Select All" @click="selectAllItems" class="q-mr-xs" />
          <q-btn flat size="sm" color="grey-7" label="Deselect All" @click="deselectAllItems" />
        </div>

        <!-- Survey Responses -->
        <div v-if="fileAnalysis.items?.length > 0" class="q-mb-lg">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-body2 q-mb-md">Individual Survey Responses ({{ fileAnalysis.items.length }} items):</div>
              <div class="survey-items-list">
                <div v-for="item in fileAnalysis.items" :key="item.id" class="q-mb-sm">
                  <q-card flat class="bg-grey-1 survey-item-card" :class="{ selected: item.selected }">
                    <q-card-section class="q-pa-md">
                      <div class="row items-center q-gutter-sm">
                        <div class="col-auto">
                          <q-checkbox v-model="item.selected" @update:model-value="updateSelection" />
                        </div>
                        <div class="col-auto">
                          <q-chip color="blue" text-color="white" size="sm" class="q-pa-xs">
                            {{ item.type === 'numeric' ? 'N' : 'T' }}
                          </q-chip>
                        </div>
                        <div class="col">
                          <div class="text-body2 text-weight-medium">{{ item.display || item.title }}</div>
                          <div class="text-caption text-grey-6">{{ item.code || item.id }}</div>
                        </div>
                        <div class="col-auto">
                          <div class="text-body1 text-weight-bold text-primary">{{ item.value }}</div>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Survey Results -->
        <div v-if="fileAnalysis.results?.length > 0">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-body2 q-mb-md">Survey Results ({{ fileAnalysis.results.length }} items):</div>
              <div class="survey-results-list">
                <div v-for="result in fileAnalysis.results" :key="result.id" class="q-mb-sm">
                  <q-card flat class="bg-green-1 survey-item-card" :class="{ selected: result.selected }">
                    <q-card-section class="q-pa-md">
                      <div class="row items-center q-gutter-sm">
                        <div class="col-auto">
                          <q-checkbox v-model="result.selected" @update:model-value="updateSelection" />
                        </div>
                        <div class="col-auto">
                          <q-chip color="green" text-color="white" size="sm" class="q-pa-xs">R</q-chip>
                        </div>
                        <div class="col">
                          <div class="text-body2 text-weight-medium">{{ result.display || result.title }}</div>
                          <div class="text-caption text-grey-6">{{ result.code || result.id }}</div>
                        </div>
                        <div class="col-auto">
                          <div class="text-h6 text-weight-bold text-green">{{ result.value }}</div>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Selection Summary -->
        <q-separator class="q-mt-md q-mb-md" />
        <div class="selection-summary">
          <div class="text-caption text-grey-7 q-mb-sm">Value Types:</div>
          <div class="row q-gutter-xs justify-center">
            <q-chip color="blue" text-color="white" size="sm" class="q-pa-xs">N/T</q-chip>
            <span class="text-caption text-grey-6">Survey Response</span>
            <q-chip color="green" text-color="white" size="sm" class="q-pa-xs">R</q-chip>
            <span class="text-caption text-grey-6">Result/Score</span>
          </div>
        </div>
      </div>

      <!-- Observation Summary (for non-survey files) -->
      <div v-if="!fileAnalysis.isSurvey && fileAnalysis.observations && fileAnalysis.observations.length > 0" class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="analytics" class="q-mr-sm" />
          Observations Preview ({{ fileAnalysis.observationsCount }} total)
        </div>
        <q-card flat bordered>
          <q-card-section>
            <div class="text-body2 q-mb-md">Sample observations that will be imported:</div>
            <div class="observations-preview">
              <div v-for="(obs, index) in fileAnalysis.observations.slice(0, 5)" :key="obs.id || index" class="q-mb-sm">
                <q-card flat class="bg-grey-1 q-pa-sm">
                  <div class="row items-center q-gutter-sm">
                    <div class="col-auto">
                      <q-chip :color="getValtypeColor(obs.valtype)" text-color="white" size="sm" class="q-pa-xs">
                        {{ obs.valtype || 'T' }}
                      </q-chip>
                    </div>
                    <div class="col">
                      <div class="text-body2 text-weight-medium">{{ obs.concept }}</div>
                      <div class="text-caption text-grey-6">{{ obs.category || 'Clinical' }}</div>
                    </div>
                    <div class="col-auto">
                      <div class="text-body2 text-right">{{ obs.value }}</div>
                    </div>
                  </div>
                </q-card>
              </div>
              <div v-if="fileAnalysis.observations.length > 5" class="text-caption text-grey-6 q-mt-sm text-center">... and {{ fileAnalysis.observationsCount - 5 }} more observations</div>
            </div>

            <!-- Valtype Legend -->
            <q-separator class="q-mt-md q-mb-md" />
            <div class="valtype-legend">
              <div class="text-caption text-grey-7 q-mb-sm">Value Types:</div>
              <div class="row q-gutter-xs justify-center">
                <q-chip color="green" text-color="white" size="sm" class="q-pa-xs">Q</q-chip>
                <span class="text-caption text-grey-6">Questionnaire</span>
                <q-chip color="blue" text-color="white" size="sm" class="q-pa-xs">N</q-chip>
                <span class="text-caption text-grey-6">Numeric</span>
                <q-chip color="orange" text-color="white" size="sm" class="q-pa-xs">T</q-chip>
                <span class="text-caption text-grey-6">Text</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Warnings -->
      <div v-if="fileAnalysis.warnings && fileAnalysis.warnings.length > 0" class="preview-section q-mt-lg">
        <q-banner class="bg-orange-1 text-orange-8" rounded>
          <template v-slot:avatar>
            <q-icon name="warning" />
          </template>
          <div class="text-subtitle2 q-mb-sm">Warnings</div>
          <div v-for="warning in fileAnalysis.warnings" :key="warning" class="q-mb-xs">• {{ warning }}</div>
        </q-banner>
      </div>
    </div>

    <!-- Fallback for missing analysis -->
    <div v-else class="text-center q-pa-xl">
      <q-icon name="error" size="48px" color="grey-5" class="q-mb-md" />
      <div class="text-h6 q-mb-sm">No Preview Available</div>
      <div class="text-body2 text-grey-6">File analysis data is not available for preview.</div>
    </div>

    <template #actions>
      <q-btn flat color="grey-7" label="Cancel" @click="$emit('cancel')" />
      <q-btn color="primary" icon="upload" label="Start Import" @click="handleProceed" :loading="importing" />
    </template>
  </AppDialog>
</template>

<script setup>
import { computed } from 'vue'
import AppDialog from './AppDialog.vue'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  fileAnalysis: {
    type: Object,
    default: null,
  },
  selectedPatient: {
    type: Object,
    default: null,
  },
  selectedVisit: {
    type: Object,
    default: null,
  },
  importing: {
    type: Boolean,
    default: false,
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'proceed', 'cancel'])

// Dialog model
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Dialog title and subtitle
const dialogTitle = computed(() => {
  if (props.fileAnalysis?.isSurvey) {
    return 'Survey Import Preview'
  }
  return 'Import Preview'
})

const dialogSubtitle = computed(() => {
  if (props.fileAnalysis?.isSurvey) {
    return `Review the ${props.fileAnalysis.questionnaire?.display || props.fileAnalysis.title || 'survey'} data to import`
  }
  return 'Review the data that will be imported'
})

// Selected items count
const selectedItemsCount = computed(() => {
  let count = 0
  if (props.fileAnalysis?.items) {
    count += props.fileAnalysis.items.filter((item) => item.selected).length
  }
  if (props.fileAnalysis?.results) {
    count += props.fileAnalysis.results.filter((result) => result.selected).length
  }
  return count
})

// Helper functions for strategy display
const getStrategyIcon = (strategy) => {
  switch (strategy) {
    case 'single_patient':
      return 'person'
    case 'batch_import':
      return 'group'
    default:
      return 'help'
  }
}

const getStrategyColor = (strategy) => {
  switch (strategy) {
    case 'single_patient':
      return 'green'
    case 'batch_import':
      return 'orange'
    default:
      return 'grey'
  }
}

const getStrategyDisplayName = (strategy) => {
  switch (strategy) {
    case 'single_patient':
      return 'Single Patient Import'
    case 'batch_import':
      return 'Batch Import'
    default:
      return 'Unknown Strategy'
  }
}

const getStrategyDescription = (strategy) => {
  switch (strategy) {
    case 'single_patient':
      return 'Import data for the selected patient only'
    case 'batch_import':
      return 'Import data for multiple patients and visits'
    default:
      return 'Import strategy not specified'
  }
}

const getValtypeColor = (valtype) => {
  switch (valtype) {
    case 'Q':
      return 'green' // Questionnaire
    case 'N':
      return 'blue' // Numeric
    case 'T':
      return 'orange' // Text
    default:
      return 'grey' // Unknown
  }
}

// Helper functions for patient/visit display
const getPatientName = (patient) => {
  if (!patient) return 'No patient selected'
  return patient.name || `${patient.PATIENT_CD}` || 'Unknown Patient'
}

const getVisitDisplayName = () => {
  if (!props.selectedVisit) return 'New Visit'
  return props.selectedVisit.display_name || `Visit ${props.selectedVisit.ENCOUNTER_NUM}` || 'Selected Visit'
}

const getVisitDetails = () => {
  if (!props.selectedVisit) return 'A new visit will be created'
  const date = props.selectedVisit.START_DATE ? new Date(props.selectedVisit.START_DATE).toLocaleDateString() : 'Unknown date'
  return `Visit #${props.selectedVisit.ENCOUNTER_NUM} - ${date}`
}

// Methods for item selection
const selectAllItems = () => {
  if (props.fileAnalysis?.items) {
    props.fileAnalysis.items.forEach((item) => (item.selected = true))
  }
  if (props.fileAnalysis?.results) {
    props.fileAnalysis.results.forEach((result) => (result.selected = true))
  }
  updateSelection()
}

const deselectAllItems = () => {
  if (props.fileAnalysis?.items) {
    props.fileAnalysis.items.forEach((item) => (item.selected = false))
  }
  if (props.fileAnalysis?.results) {
    props.fileAnalysis.results.forEach((result) => (result.selected = false))
  }
  updateSelection()
}

const updateSelection = () => {
  // Force reactivity update - this ensures the selectedItemsCount updates
  // The data is already being mutated directly, so we just need to trigger reactivity
}

// Methods
const handleProceed = () => {
  // For survey imports, pass the selection data
  if (props.fileAnalysis?.isSurvey) {
    const selectionData = {
      selectedItems: props.fileAnalysis.items?.filter((item) => item.selected) || [],
      selectedResults: props.fileAnalysis.results?.filter((result) => result.selected) || [],
      totalSelected: selectedItemsCount.value,
    }
    emit('proceed', selectionData)
  } else {
    emit('proceed')
  }
}
</script>

<style lang="scss" scoped>
.import-preview {
  .preview-section {
    .observations-preview {
      .q-card {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 6px;
      }
    }

    .survey-item-card {
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      transition: all 0.2s ease;

      &.selected {
        border-color: #1976d2;
        background-color: rgba(25, 118, 210, 0.04);
      }

      &:hover {
        border-color: #1976d2;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }
    }

    .survey-items-list,
    .survey-results-list {
      max-height: 400px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;

        &:hover {
          background: #a8a8a8;
        }
      }
    }

    .valtype-legend,
    .selection-summary {
      .row {
        flex-wrap: wrap;
        justify-content: center;

        > * {
          margin-bottom: 4px;
        }
      }
    }
  }
}
</style>
