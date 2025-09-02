<template>
  <AppDialog v-model="dialogModel" title="Import Preview" subtitle="Review the data that will be imported" size="xl" persistent :show-cancel="false" ok-label="Proceed with Import" @ok="handleProceed">
    <div v-if="fileAnalysis && fileAnalysis.success" class="import-preview">
      <!-- File Info -->
      <div class="preview-section q-mb-lg">
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
        <div class="row q-gutter-md">
          <div class="col-md-6">
            <q-card flat bordered class="bg-green-1">
              <q-card-section>
                <div class="flex items-center q-mb-sm">
                  <q-icon name="person" color="green" class="q-mr-sm" />
                  <div class="text-subtitle2">Patient</div>
                </div>
                <div class="text-body1">{{ getPatientName(selectedPatient) }}</div>
                <div class="text-caption text-grey-6">ID: {{ selectedPatient?.PATIENT_CD }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-md-6">
            <q-card flat bordered class="bg-blue-1">
              <q-card-section>
                <div class="flex items-center q-mb-sm">
                  <q-icon name="event" color="blue" class="q-mr-sm" />
                  <div class="text-subtitle2">Visit</div>
                </div>
                <div class="text-body1">{{ getVisitDisplayName() }}</div>
                <div class="text-caption text-grey-6">{{ getVisitDetails() }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
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

      <!-- Observation Summary -->
      <div v-if="fileAnalysis.observations && fileAnalysis.observations.length > 0" class="preview-section q-mb-lg">
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

      <!-- Data Preview (if available) -->
      <div v-if="fileAnalysis.patients && fileAnalysis.patients.length > 0" class="preview-section">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="list" class="q-mr-sm" />
          Data Preview
        </div>
        <q-card flat bordered>
          <q-card-section>
            <div class="text-body2 q-mb-md">Sample patient data from the file:</div>
            <div class="data-preview">
              <div v-for="(patient, index) in fileAnalysis.patients.slice(0, 3)" :key="index" class="q-mb-sm">
                <q-chip color="grey-3" text-color="dark" size="sm" class="q-mr-sm"> Patient {{ index + 1 }} </q-chip>
                <span class="text-body2">{{ patient.name || `ID: ${patient.id}` }}</span>
              </div>
              <div v-if="fileAnalysis.patients.length > 3" class="text-caption text-grey-6 q-mt-sm">... and {{ fileAnalysis.patients.length - 3 }} more patients</div>
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

// Methods
const handleProceed = () => {
  emit('proceed')
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

    .valtype-legend {
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
