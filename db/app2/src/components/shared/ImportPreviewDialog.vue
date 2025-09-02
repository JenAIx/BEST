<template>
  <AppDialog v-model="dialogModel" :title="dialogTitle" :subtitle="dialogSubtitle" size="xl" persistent :show-cancel="false" ok-label="Update & Close" @ok="handleUpdate">
    <div v-if="fileAnalysis && fileAnalysis.success" class="import-preview">
      <!-- File Information Summary -->
      <div class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="description" class="q-mr-sm" />
          File Information
        </div>
        <q-card flat bordered class="bg-blue-1">
          <q-card-section class="q-pa-md">
            <div class="row q-gutter-md items-center justify-center">
              <div class="col-auto">
                <div class="text-center">
                  <q-icon name="folder" size="24px" color="primary" class="q-mb-xs" />
                  <div class="text-caption text-grey-7">Format</div>
                  <div class="text-body2 text-weight-medium">{{ fileAnalysis.format?.toUpperCase() }}</div>
                </div>
              </div>
              <div class="col-auto">
                <div class="text-center">
                  <q-icon name="people" size="24px" color="green" class="q-mb-xs" />
                  <div class="text-caption text-grey-7">Patients</div>
                  <div class="text-body2 text-weight-medium">{{ selectedPatientsCount }}</div>
                </div>
              </div>
              <div class="col-auto">
                <div class="text-center">
                  <q-icon name="event" size="24px" color="orange" class="q-mb-xs" />
                  <div class="text-caption text-grey-7">Visits</div>
                  <div class="text-body2 text-weight-medium">{{ selectedVisitsCount }}</div>
                </div>
              </div>
              <div class="col-auto">
                <div class="text-center">
                  <q-icon name="analytics" size="24px" color="purple" class="q-mb-xs" />
                  <div class="text-caption text-grey-7">Observations</div>
                  <div class="text-body2 text-weight-medium">{{ selectedObservationsCount }}</div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Tree Structure for Data Selection -->
      <div class="preview-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center justify-between">
          <div class="flex items-center">
            <q-icon name="account_tree" class="q-mr-sm" />
            Data Selection
          </div>
          <div class="q-gutter-xs">
            <q-btn flat size="sm" color="primary" label="Select All" @click="selectAll" />
            <q-btn flat size="sm" color="grey-7" label="Deselect All" @click="deselectAll" />
          </div>
        </div>

        <q-card flat bordered>
          <q-card-section>
            <div class="tree-container">
              <!-- Patients -->
              <div v-if="treeData.patients && treeData.patients.length > 0" class="tree-level">
                <div class="tree-header" @click="togglePatientsCollapse">
                  <q-checkbox v-model="patientsAllSelected" :indeterminate="patientsIndeterminate" @update:model-value="toggleAllPatients" @click.stop class="q-mr-sm" />
                  <q-icon :name="patientsCollapsed ? 'expand_more' : 'expand_less'" class="q-mr-sm" />
                  <q-icon name="people" color="green" class="q-mr-sm" />
                  <span class="text-weight-medium">Patients ({{ selectedPatientsCount }}/{{ treeData.patients.length }})</span>
                </div>

                <div class="tree-children" :class="{ collapsed: patientsCollapsed }">
                  <div v-for="patient in treeData.patients" :key="patient.id" class="tree-item">
                    <div class="tree-item-content">
                      <q-checkbox v-model="patient.selected" @update:model-value="updatePatientSelection" class="q-mr-sm" />
                      <q-icon name="person" color="green" class="q-mr-sm" />
                      <div class="tree-item-details">
                        <div class="tree-item-name">{{ patient.name || patient.id || 'Unknown Patient' }}</div>
                        <div class="tree-item-meta">
                          <span v-if="patient.metadata?.age" class="q-mr-md"><strong>Age:</strong> {{ patient.metadata.age }}</span>
                          <span v-if="patient.metadata?.sex" class="q-mr-md"><strong>Sex:</strong> {{ patient.metadata.sex }}</span>
                          <span v-if="patient.metadata?.birthDate" class="q-mr-md"><strong>DOB:</strong> {{ formatDate(patient.metadata.birthDate) }}</span>
                          <span><strong>ID:</strong> {{ patient.id }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Visits for this patient -->
                    <div v-if="patient.visits && patient.visits.length > 0" class="tree-children">
                      <div v-for="visit in patient.visits" :key="visit.id" class="tree-item">
                        <div class="tree-item-content">
                          <q-checkbox v-model="visit.selected" @update:model-value="updateVisitSelection" class="q-mr-sm" />
                          <q-icon name="event" color="orange" class="q-mr-sm" />
                          <div class="tree-item-details">
                            <div class="tree-item-name">{{ visit.name || visit.id || 'Unknown Visit' }}</div>
                            <div class="tree-item-meta">
                              <span class="q-mr-md"><strong>Date:</strong> {{ formatDate(visit.startDate) }} - {{ formatDate(visit.endDate) }}</span>
                              <span v-if="visit.metadata?.location" class="q-mr-md"><strong>Location:</strong> {{ visit.metadata.location }}</span>
                              <span v-if="visit.metadata?.inout" class="q-mr-md"><strong>Type:</strong> {{ getInoutDescription(visit.metadata.inout) }}</span>
                              <span v-if="visit.metadata?.providerId" class="q-mr-md"><strong>Provider:</strong> {{ visit.metadata.providerId }}</span>
                              <span><strong>ID:</strong> {{ visit.id }}</span>
                            </div>
                          </div>
                        </div>

                        <!-- Observations for this visit -->
                        <div v-if="visit.observations && visit.observations.length > 0" class="tree-level">
                          <div class="tree-header" @click="toggleVisitObservationsCollapse(visit)">
                            <q-checkbox
                              v-model="visit.observationsAllSelected"
                              :indeterminate="visit.observationsIndeterminate"
                              @update:model-value="toggleAllObservations(visit)"
                              @click.stop
                              class="q-mr-sm"
                            />
                            <q-icon :name="visit.observationsCollapsed ? 'expand_more' : 'expand_less'" class="q-mr-sm" />
                            <q-icon name="analytics" color="purple" class="q-mr-sm" />
                            <span class="text-weight-medium">Observations ({{ getSelectedObservationsCount(visit) }}/{{ visit.observations.length }})</span>
                          </div>

                          <div class="tree-children" :class="{ collapsed: visit.observationsCollapsed }">
                            <div v-for="observation in visit.observations" :key="observation.id" class="tree-item">
                              <div class="tree-item-content">
                                <q-checkbox v-model="observation.selected" @update:model-value="updateObservationSelection" class="q-mr-sm" />
                                <q-chip :color="getValtypeColor(observation.valtype)" text-color="white" size="sm" class="q-mr-sm">
                                  {{ observation.valtype }}
                                </q-chip>
                                <div class="tree-item-details">
                                  <div class="tree-item-name">{{ observation.display || observation.name || observation.concept || 'Unknown Observation' }}</div>
                                  <div class="tree-item-meta">
                                    <span class="q-mr-md"><strong>Value:</strong> {{ observation.value || 'N/A' }}</span>
                                    <span v-if="observation.concept" class="q-mr-md"><strong>Concept:</strong> {{ observation.concept }}</span>
                                    <span class="q-mr-md"><strong>Type:</strong> {{ getValtypeDescription(observation.valtype) }}</span>
                                    <span v-if="observation.metadata?.unit" class="q-mr-md"><strong>Unit:</strong> {{ observation.metadata.unit }}</span>
                                    <span v-if="observation.metadata?.category" class="q-mr-md"><strong>Category:</strong> {{ observation.metadata.category }}</span>
                                    <span v-if="observation.metadata?.providerId" class="q-mr-md"><strong>Provider:</strong> {{ observation.metadata.providerId }}</span>
                                    <span v-if="observation.metadata?.startDate" class="q-mr-md"><strong>Date:</strong> {{ formatDate(observation.metadata.startDate) }}</span>
                                    <span v-if="observation.metadata?.sourcesystemCd" class="q-mr-md"><strong>Source:</strong> {{ observation.metadata.sourcesystemCd }}</span>
                                    <span v-if="observation.metadata?.isQuestionnaire" class="q-mr-md"><strong>Questionnaire:</strong> Yes</span>
                                    <span v-if="observation.metadata?.responseCount" class="q-mr-md"><strong>Responses:</strong> {{ observation.metadata.responseCount }}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Standalone Visits (not linked to patients) -->
              <div v-if="treeData.visits && treeData.visits.length > 0 && treeData.patients.length === 0" class="tree-level">
                <div class="tree-children">
                  <div v-for="visit in treeData.visits" :key="visit.id" class="tree-item">
                    <div class="tree-item-content">
                      <q-checkbox v-model="visit.selected" @update:model-value="updateVisitSelection" class="q-mr-sm" />
                      <q-icon name="event" color="orange" class="q-mr-sm" />
                      <div class="tree-item-details">
                        <div class="tree-item-name">{{ visit.name || visit.id || 'Unknown Visit' }}</div>
                        <div class="tree-item-meta">
                          <span class="q-mr-md"><strong>Date:</strong> {{ formatDate(visit.startDate) }} - {{ formatDate(visit.endDate) }}</span>
                          <span v-if="visit.metadata?.location" class="q-mr-md"><strong>Location:</strong> {{ visit.metadata.location }}</span>
                          <span v-if="visit.metadata?.inout" class="q-mr-md"><strong>Type:</strong> {{ getInoutDescription(visit.metadata.inout) }}</span>
                          <span v-if="visit.metadata?.providerId" class="q-mr-md"><strong>Provider:</strong> {{ visit.metadata.providerId }}</span>
                          <span><strong>ID:</strong> {{ visit.id }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Observations for standalone visits -->
                    <div v-if="visit.observations && visit.observations.length > 0" class="tree-level">
                      <div class="tree-header">
                        <q-checkbox v-model="visit.observationsAllSelected" :indeterminate="visit.observationsIndeterminate" @update:model-value="toggleAllObservations(visit)" class="q-mr-sm" />
                        <q-icon name="analytics" color="purple" class="q-mr-sm" />
                        <span class="text-weight-medium">Observations ({{ getSelectedObservationsCount(visit) }}/{{ visit.observations.length }})</span>
                      </div>

                      <div class="tree-children">
                        <div v-for="observation in visit.observations" :key="observation.id" class="tree-item">
                          <div class="tree-item-content">
                            <q-checkbox v-model="observation.selected" @update:model-value="updateObservationSelection" class="q-mr-sm" />
                            <q-chip :color="getValtypeColor(observation.valtype)" text-color="white" size="sm" class="q-mr-sm">
                              {{ observation.valtype }}
                            </q-chip>
                            <div class="tree-item-details">
                              <div class="tree-item-name">{{ observation.display || observation.name || observation.concept || 'Unknown Observation' }}</div>
                              <div class="tree-item-meta">
                                <span class="q-mr-md"><strong>Value:</strong> {{ observation.value || 'N/A' }}</span>
                                <span v-if="observation.concept" class="q-mr-md"><strong>Concept:</strong> {{ observation.concept }}</span>
                                <span class="q-mr-md"><strong>Type:</strong> {{ getValtypeDescription(observation.valtype) }}</span>
                                <span v-if="observation.metadata?.unit" class="q-mr-md"><strong>Unit:</strong> {{ observation.metadata.unit }}</span>
                                <span v-if="observation.metadata?.category" class="q-mr-md"><strong>Category:</strong> {{ observation.metadata.category }}</span>
                                <span v-if="observation.metadata?.providerId" class="q-mr-md"><strong>Provider:</strong> {{ observation.metadata.providerId }}</span>
                                <span v-if="observation.metadata?.startDate" class="q-mr-md"><strong>Date:</strong> {{ formatDate(observation.metadata.startDate) }}</span>
                                <span v-if="observation.metadata?.sourcesystemCd" class="q-mr-md"><strong>Source:</strong> {{ observation.metadata.sourcesystemCd }}</span>
                                <span v-if="observation.metadata?.isQuestionnaire" class="q-mr-md"><strong>Questionnaire:</strong> Yes</span>
                                <span v-if="observation.metadata?.responseCount" class="q-mr-md"><strong>Responses:</strong> {{ observation.metadata.responseCount }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Standalone Observations (not linked to visits) -->
              <div v-if="treeData.observations && treeData.observations.length > 0 && treeData.visits.length === 0" class="tree-level">
                <div class="tree-header" @click="toggleStandaloneObservationsCollapse">
                  <q-checkbox v-model="observationsAllSelected" :indeterminate="observationsIndeterminate" @update:model-value="toggleAllStandaloneObservations" @click.stop class="q-mr-sm" />
                  <q-icon :name="standaloneObservationsCollapsed ? 'expand_more' : 'expand_less'" class="q-mr-sm" />
                  <q-icon name="analytics" color="purple" class="q-mr-sm" />
                  <span class="text-weight-medium">Standalone Observations ({{ selectedObservationsCount }}/{{ treeData.observations.length }})</span>
                </div>

                <div class="tree-children" :class="{ collapsed: standaloneObservationsCollapsed }">
                  <div v-for="observation in treeData.observations" :key="observation.id" class="tree-item">
                    <div class="tree-item-content">
                      <q-checkbox v-model="observation.selected" @update:model-value="updateObservationSelection" class="q-mr-sm" />
                      <q-chip :color="getValtypeColor(observation.valtype)" text-color="white" size="sm" class="q-mr-sm">
                        {{ observation.valtype }}
                      </q-chip>
                      <div class="tree-item-details">
                        <div class="tree-item-name">{{ observation.display || observation.name || observation.concept || 'Unknown Observation' }}</div>
                        <div class="tree-item-meta">
                          <span class="q-mr-md"><strong>Value:</strong> {{ observation.value || 'N/A' }}</span>
                          <span v-if="observation.concept" class="q-mr-md"><strong>Concept:</strong> {{ observation.concept }}</span>
                          <span class="q-mr-md"><strong>Type:</strong> {{ getValtypeDescription(observation.valtype) }}</span>
                          <span v-if="observation.metadata?.unit" class="q-mr-md"><strong>Unit:</strong> {{ observation.metadata.unit }}</span>
                          <span v-if="observation.metadata?.category" class="q-mr-md"><strong>Category:</strong> {{ observation.metadata.category }}</span>
                          <span v-if="observation.metadata?.providerId" class="q-mr-md"><strong>Provider:</strong> {{ observation.metadata.providerId }}</span>
                          <span v-if="observation.metadata?.startDate" class="q-mr-md"><strong>Date:</strong> {{ formatDate(observation.metadata.startDate) }}</span>
                          <span v-if="observation.metadata?.sourcesystemCd" class="q-mr-md"><strong>Source:</strong> {{ observation.metadata.sourcesystemCd }}</span>
                          <span v-if="observation.metadata?.isQuestionnaire" class="q-mr-md"><strong>Questionnaire:</strong> Yes</span>
                          <span v-if="observation.metadata?.responseCount" class="q-mr-md"><strong>Responses:</strong> {{ observation.metadata.responseCount }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Fallback for files without structured data -->
              <div v-if="treeData.patients.length === 0 && treeData.visits.length === 0 && treeData.observations.length === 0" class="text-center q-pa-lg text-grey-6">
                <q-icon name="info" size="48px" class="q-mb-md" />
                <div class="text-h6 q-mb-sm">No Structured Data Available</div>
                <div class="text-body2">This file contains {{ fileAnalysis.observationsCount || 0 }} observations that will be imported as-is.</div>
              </div>

              <!-- Legend for observation types -->
              <div v-if="treeData.observations && treeData.observations.length > 0" class="q-mt-md">
                <q-separator class="q-mb-md" />
                <div class="text-caption text-grey-7 q-mb-sm text-center">VALTYPE_CD Types:</div>
                <div class="row q-gutter-xs justify-center">
                  <q-chip color="green" text-color="white" size="sm" class="q-pa-xs">Q</q-chip>
                  <span class="text-caption text-grey-6">Questionnaire/Raw Data</span>
                  <q-chip color="blue" text-color="white" size="sm" class="q-pa-xs">N</q-chip>
                  <span class="text-caption text-grey-6">Numeric</span>
                  <q-chip color="orange" text-color="white" size="sm" class="q-pa-xs">T</q-chip>
                  <span class="text-caption text-grey-6">Text</span>
                </div>
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
      <q-btn flat color="grey-7" label="Cancel" @click="$emit('update:modelValue', false)" />
      <q-btn color="primary" icon="update" label="Update & Close" @click="handleUpdate" />
    </template>
  </AppDialog>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useImportStore } from '../../stores/import-store.js'
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
  selectedMode: {
    type: String,
    default: 'single_patient',
  },
  patientMode: {
    type: String,
    default: 'create',
  },
  selectedPatient: {
    type: Object,
    default: null,
  },
  selectedVisit: {
    type: Object,
    default: null,
  },
})

// Emits
const emit = defineEmits(['update:modelValue', 'update:selections'])

// Import store
const importStore = useImportStore()

// Dialog model
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Dialog title and subtitle
const dialogTitle = computed(() => {
  return 'Import Data Preview'
})

const dialogSubtitle = computed(() => {
  return 'Select which data to import from your file'
})

// Tree data structure
const treeData = ref({
  patients: [],
  visits: [],
  observations: [],
})

// Collapse state
const patientsCollapsed = ref(false)
const standaloneObservationsCollapsed = ref(false)

// Initialize tree data from file analysis
const initializeTreeData = () => {
  if (!props.fileAnalysis) return

  // Use importStructure from the new import system if available
  if (props.fileAnalysis.importStructure?.data) {
    const importData = props.fileAnalysis.importStructure.data
    const patients = []
    const visits = []
    const observations = []

    // Convert patients from importStructure format
    if (importData.patients && importData.patients.length > 0) {
      importData.patients.forEach((patientData) => {
        const patient = {
          id: patientData.PATIENT_CD || `patient_${patientData.PATIENT_NUM}`,
          name: patientData.PATIENT_CD || `Patient ${patientData.PATIENT_NUM}`,
          selected: true,
          visits: [],
          metadata: {
            patientNum: patientData.PATIENT_NUM,
            age: patientData.AGE_IN_YEARS,
            sex: patientData.SEX_CD,
            birthDate: patientData.BIRTH_DATE,
          },
        }
        patients.push(patient)
      })
    }

    // Convert visits from importStructure format
    if (importData.visits && importData.visits.length > 0) {
      importData.visits.forEach((visitData) => {
        const visit = {
          id: `visit_${visitData.ENCOUNTER_NUM}`,
          name: visitData.LOCATION_CD || `Visit ${visitData.ENCOUNTER_NUM}`,
          startDate: visitData.START_DATE,
          endDate: visitData.END_DATE || visitData.START_DATE,
          selected: true,
          observations: [],
          metadata: {
            encounterNum: visitData.ENCOUNTER_NUM,
            patientNum: visitData.PATIENT_NUM,
            location: visitData.LOCATION_CD,
            inout: visitData.INOUT_CD,
            providerId: visitData.PROVIDER_ID,
          },
        }
        visits.push(visit)
      })
    }

    // Convert observations from importStructure format
    if (importData.observations && importData.observations.length > 0) {
      importData.observations.forEach((obsData) => {
        const observation = {
          id: `obs_${obsData.OBSERVATION_ID || obsData.CONCEPT_CD}_${obsData.ENCOUNTER_NUM || 'unknown'}`,
          name: obsData.TVAL_CHAR || obsData.CONCEPT_CD,
          concept: obsData.CONCEPT_CD,
          value: obsData.TVAL_CHAR || obsData.NVAL_NUM || obsData.VALUE,
          valtype: obsData.VALTYPE_CD,
          selected: true,
          display: obsData.TVAL_CHAR || obsData.CONCEPT_CD,
          metadata: {
            observationId: obsData.OBSERVATION_ID,
            encounterNum: obsData.ENCOUNTER_NUM,
            patientNum: obsData.PATIENT_NUM,
            unit: obsData.UNIT_CD,
            category: obsData.CATEGORY_CHAR,
            providerId: obsData.PROVIDER_ID,
            startDate: obsData.START_DATE,
            endDate: obsData.END_DATE,
            sourcesystemCd: obsData.SOURCESYSTEM_CD,
            isQuestionnaire: obsData.VALTYPE_CD === 'Q',
            responseCount: obsData.responseCount,
            observationBlob: obsData.OBSERVATION_BLOB,
          },
        }
        observations.push(observation)
      })
    }

    // Link visits to patients and observations to visits
    patients.forEach((patient) => {
      const patientVisits = visits.filter((v) => v.metadata.patientNum === patient.metadata?.patientNum)
      patient.visits = patientVisits

      patientVisits.forEach((visit) => {
        const visitObservations = observations.filter((o) => o.metadata.encounterNum === visit.metadata.encounterNum)
        visit.observations = visitObservations
      })
    })

    treeData.value = { patients, visits, observations }
    return
  }

  // Fallback for files without importStructure - create mock structure
  const patients = []
  const visits = []
  const observations = []

  if (props.fileAnalysis.patientsCount > 0) {
    for (let i = 1; i <= props.fileAnalysis.patientsCount; i++) {
      const patient = {
        id: `patient_${i}`,
        name: `Patient ${i}`,
        selected: true,
        visits: [],
      }

      // Add visits for this patient
      if (props.fileAnalysis.visitsCount > 0) {
        for (let j = 1; j <= Math.ceil(props.fileAnalysis.visitsCount / props.fileAnalysis.patientsCount); j++) {
          const visit = {
            id: `visit_${i}_${j}`,
            name: `Visit ${j}`,
            startDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            selected: true,
            observations: [],
          }

          // Add observations for this visit
          if (props.fileAnalysis.observationsCount > 0) {
            const obsPerVisit = Math.ceil(props.fileAnalysis.observationsCount / (props.fileAnalysis.patientsCount * Math.ceil(props.fileAnalysis.visitsCount / props.fileAnalysis.patientsCount)))
            for (let k = 1; k <= obsPerVisit; k++) {
              const observation = {
                id: `obs_${i}_${j}_${k}`,
                name: `Observation ${k}`,
                concept: `concept_${k}`,
                value: Math.random() > 0.5 ? Math.floor(Math.random() * 100) : `Text Value ${k}`,
                valtype: Math.random() > 0.5 ? 'N' : 'T',
                selected: true,
              }
              visit.observations.push(observation)
              observations.push(observation)
            }
          }

          patient.visits.push(visit)
          visits.push(visit)
        }
      }

      patients.push(patient)
    }
  }

  treeData.value = { patients, visits, observations }
}

// Computed properties for selection counts
const selectedPatientsCount = computed(() => {
  return treeData.value.patients?.filter((p) => p.selected).length || 0
})

const selectedVisitsCount = computed(() => {
  return treeData.value.visits?.filter((v) => v.selected).length || 0
})

const selectedObservationsCount = computed(() => {
  return treeData.value.observations?.filter((o) => o.selected).length || 0
})

// Computed properties for "select all" checkboxes
const patientsAllSelected = computed({
  get: () => {
    const patients = treeData.value.patients || []
    return patients.length > 0 && patients.every((p) => p.selected)
  },
  set: (value) => {
    treeData.value.patients?.forEach((patient) => {
      patient.selected = value
      // Also update visits and observations
      patient.visits?.forEach((visit) => {
        visit.selected = value
        visit.observations?.forEach((obs) => (obs.selected = value))
      })
    })
  },
})

const patientsIndeterminate = computed(() => {
  const patients = treeData.value.patients || []
  if (patients.length === 0) return false
  const selectedCount = patients.filter((p) => p.selected).length
  return selectedCount > 0 && selectedCount < patients.length
})

// Computed properties for standalone sections
// const visitsAllSelected = computed({
//   get: () => {
//     const visits = treeData.value.visits || []
//     return visits.length > 0 && visits.every((v) => v.selected)
//   },
//   set: (value) => {
//     treeData.value.visits?.forEach((visit) => {
//       visit.selected = value
//       visit.observations?.forEach((obs) => (obs.selected = value))
//     })
//   },
// })

// const visitsIndeterminate = computed(() => {
//   const visits = treeData.value.visits || []
//   if (visits.length === 0) return false
//   const selectedCount = visits.filter((v) => v.selected).length
//   return selectedCount > 0 && selectedCount < visits.length
// })

const observationsAllSelected = computed({
  get: () => {
    const observations = treeData.value.observations || []
    return observations.length > 0 && observations.every((o) => o.selected)
  },
  set: (value) => {
    treeData.value.observations?.forEach((obs) => (obs.selected = value))
  },
})

const observationsIndeterminate = computed(() => {
  const observations = treeData.value.observations || []
  if (observations.length === 0) return false
  const selectedCount = observations.filter((o) => o.selected).length
  return selectedCount > 0 && selectedCount < observations.length
})

// Helper functions
// const getSelectedVisitsCount = (patient) => {
//   return patient.visits?.filter((v) => v.selected).length || 0
// }

const getSelectedObservationsCount = (visit) => {
  return visit.observations?.filter((o) => o.selected).length || 0
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date'
  return new Date(dateString).toLocaleDateString()
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

const getValtypeDescription = (valtype) => {
  switch (valtype) {
    case 'Q':
      return 'Questionnaire/Raw Data'
    case 'N':
      return 'Numeric'
    case 'T':
      return 'Text'
    default:
      return 'Unknown'
  }
}

const getInoutDescription = (inout) => {
  switch (inout) {
    case 'I':
      return 'Inpatient'
    case 'O':
      return 'Outpatient'
    case 'E':
      return 'Emergency'
    case 'A':
      return 'Ambulatory'
    default:
      return inout || 'Unknown'
  }
}

// Selection methods
const selectAll = () => {
  treeData.value.patients?.forEach((patient) => {
    patient.selected = true
    patient.visits?.forEach((visit) => {
      visit.selected = true
      visit.observations?.forEach((obs) => (obs.selected = true))
    })
  })
}

const deselectAll = () => {
  treeData.value.patients?.forEach((patient) => {
    patient.selected = false
    patient.visits?.forEach((visit) => {
      visit.selected = false
      visit.observations?.forEach((obs) => (obs.selected = false))
    })
  })
}

const toggleAllPatients = (value) => {
  patientsAllSelected.value = value
}

// const toggleAllVisits = (patient) => {
//   const allSelected = patient.visits?.every((v) => v.selected) || false
//   patient.visits?.forEach((visit) => {
//     visit.selected = !allSelected
//     visit.observations?.forEach((obs) => (obs.selected = !allSelected))
//   })
// }

const toggleAllObservations = (visit) => {
  const allSelected = visit.observations?.every((o) => o.selected) || false
  visit.observations?.forEach((obs) => (obs.selected = !allSelected))
}

const updatePatientSelection = () => {
  // Update parent selection state when individual patients change
}

const updateVisitSelection = () => {
  // Update parent selection state when individual visits change
}

const updateObservationSelection = () => {
  // Update parent selection state when individual observations change
}

// Collapse toggle methods
const togglePatientsCollapse = () => {
  patientsCollapsed.value = !patientsCollapsed.value
}

const toggleVisitObservationsCollapse = (visit) => {
  if (!visit.observationsCollapsed) {
    visit.observationsCollapsed = false
  }
  visit.observationsCollapsed = !visit.observationsCollapsed
}

const toggleStandaloneObservationsCollapse = () => {
  standaloneObservationsCollapsed.value = !standaloneObservationsCollapsed.value
}

// const toggleAllStandaloneVisits = () => {
//   visitsAllSelected.value = !visitsAllSelected.value
// }

const toggleAllStandaloneObservations = () => {
  observationsAllSelected.value = !observationsAllSelected.value
}

// Handle update and close
const handleUpdate = () => {
  // Prepare selections data
  const selections = {
    patients: treeData.value.patients?.filter((p) => p.selected) || [],
    visits: treeData.value.visits?.filter((v) => v.selected) || [],
    observations: treeData.value.observations?.filter((o) => o.selected) || [],
  }

  // Update the import store
  importStore.updateSelections(selections)

  // Emit to parent component
  emit('update:selections', selections)
  emit('update:modelValue', false)
}

// Watch for file analysis changes
watch(
  () => props.fileAnalysis,
  () => {
    initializeTreeData()
  },
  { immediate: true },
)

// Initialize on mount
onMounted(() => {
  initializeTreeData()
})
</script>

<style lang="scss" scoped>
.import-preview {
  .preview-section {
    .tree-container {
      max-height: 600px;
      overflow-y: auto;

      .tree-level {
        margin-left: 0;

        .tree-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background-color: rgba(0, 0, 0, 0.02);
          border-radius: 4px;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .tree-children {
          margin-left: 24px;
          border-left: 2px solid rgba(0, 0, 0, 0.1);
          padding-left: 16px;
        }

        .tree-item {
          margin-bottom: 8px;

          .tree-item-content {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background-color: rgba(0, 0, 0, 0.01);
            border-radius: 4px;
            transition: background-color 0.2s ease;
            cursor: pointer;

            &:hover {
              background-color: rgba(0, 0, 0, 0.05);
            }

            .tree-item-details {
              flex: 1;

              .tree-item-name {
                font-weight: 500;
                margin-bottom: 2px;
              }

              .tree-item-meta {
                font-size: 0.8em;
                color: rgba(0, 0, 0, 0.6);
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
              }
            }
          }
        }

        // Collapsible functionality
        .tree-level {
          &.collapsed {
            .tree-children {
              display: none;
            }
          }
        }

        .tree-header {
          cursor: pointer;
          user-select: none;

          &:hover {
            background-color: rgba(0, 0, 0, 0.03);
          }
        }
      }
    }
  }
}

// Custom scrollbar
.tree-container::-webkit-scrollbar {
  width: 6px;
}

.tree-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.tree-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;

  &:hover {
    background: #a8a8a8;
  }
}
</style>
