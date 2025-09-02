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
          <q-card-section class="q-pa-md">
            <q-tree :nodes="treeNodes" dense node-key="id" tick-strategy="leaf" v-model:selected="selectedNode" v-model:ticked="tickedNodes" default-expand-all no-selection-unset>
              <!-- Custom node content -->
              <template #default-header="{ node }">
                <div class="tree-node-content">
                  <!-- Icon based on node type -->
                  <q-icon :name="getNodeIcon(node.type)" :color="getNodeColor(node.type)" size="sm" class="q-mr-sm" />

                  <!-- Node label -->
                  <div class="tree-node-details">
                    <div class="tree-node-name">
                      {{ node.label }}
                      <!-- VALTYPE chip for observations - inline with name -->
                      <q-chip v-if="node.type === 'observation'" :color="getValtypeColor(node.valtype)" text-color="white" size="sm" dense class="q-ml-sm">
                        {{ node.valtype }}
                      </q-chip>
                    </div>
                    <div class="tree-node-meta" v-if="node.metadata">
                      <span v-if="node.metadata.age" class="q-mr-md"><strong>Age:</strong> {{ node.metadata.age }}</span>
                      <span v-if="node.metadata.sex" class="q-mr-md"><strong>Sex:</strong> {{ node.metadata.sex }}</span>
                      <span v-if="node.metadata.birthDate" class="q-mr-md"><strong>DOB:</strong> {{ formatDate(node.metadata.birthDate) }}</span>
                      <span v-if="node.metadata.startDate" class="q-mr-md"><strong>Date:</strong> {{ formatDate(node.metadata.startDate) }} - {{ formatDate(node.metadata.endDate) }}</span>
                      <span v-if="node.metadata.location" class="q-mr-md"><strong>Location:</strong> {{ node.metadata.location }}</span>
                      <span v-if="node.metadata.inout" class="q-mr-md"><strong>Type:</strong> {{ getInoutDescription(node.metadata.inout) }}</span>
                      <span v-if="node.metadata.providerId" class="q-mr-md"><strong>Provider:</strong> {{ node.metadata.providerId }}</span>
                      <span v-if="node.metadata.value" class="q-mr-md"><strong>Value:</strong> {{ node.metadata.value }}</span>
                      <span v-if="node.metadata.concept" class="q-mr-md"><strong>Concept:</strong> {{ node.metadata.concept }}</span>
                      <span v-if="node.metadata.unit" class="q-mr-md"><strong>Unit:</strong> {{ node.metadata.unit }}</span>
                      <span v-if="node.metadata.category" class="q-mr-md"><strong>Category:</strong> {{ node.metadata.category }}</span>
                      <span v-if="node.metadata.sourcesystemCd" class="q-mr-md"><strong>Source:</strong> {{ node.metadata.sourcesystemCd }}</span>
                      <span v-if="node.metadata.responseCount" class="q-mr-md"><strong>Responses:</strong> {{ node.metadata.responseCount }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </q-tree>

            <!-- Fallback for files without structured data -->
            <div v-if="!treeNodes || treeNodes.length === 0" class="text-center q-pa-lg text-grey-6">
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

// Q-Tree reactive data
const treeNodes = ref([])
const selectedNode = ref(null)
const tickedNodes = ref([])
// const expandedNodes = ref([])

// Collapse state (kept for backward compatibility)
// const patientsCollapsed = ref(false)
// const standaloneObservationsCollapsed = ref(false)

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

    // Convert to q-tree format
    convertToTreeNodes()
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

  // Convert to q-tree format
  convertToTreeNodes()
}

// Convert internal data structure to q-tree format
const convertToTreeNodes = () => {
  const nodes = []
  const ticked = []

  // Convert patients
  if (treeData.value.patients && treeData.value.patients.length > 0) {
    treeData.value.patients.forEach((patient) => {
      const patientNode = {
        id: patient.id,
        label: patient.name || patient.id,
        type: 'patient',
        originalId: patient.id,
        metadata: patient.metadata,
        children: [],
      }

      // Convert visits for this patient
      if (patient.visits && patient.visits.length > 0) {
        patient.visits.forEach((visit) => {
          const visitNode = {
            id: visit.id,
            label: visit.name || visit.id,
            type: 'visit',
            originalId: visit.id,
            metadata: visit.metadata,
            children: [],
          }

          // Convert observations for this visit
          if (visit.observations && visit.observations.length > 0) {
            visit.observations.forEach((observation) => {
              const obsNode = {
                id: observation.id,
                label: observation.display || observation.name || observation.concept || 'Unknown Observation',
                type: 'observation',
                originalId: observation.id,
                valtype: observation.valtype,
                metadata: observation.metadata,
              }

              if (observation.selected) {
                ticked.push(obsNode.id)
              }

              visitNode.children.push(obsNode)
            })
          }

          if (visit.selected) {
            ticked.push(visitNode.id)
          }

          patientNode.children.push(visitNode)
        })
      }

      if (patient.selected) {
        ticked.push(patientNode.id)
      }

      nodes.push(patientNode)
    })
  }

  // Handle standalone visits (no patients)
  if (treeData.value.visits && treeData.value.visits.length > 0 && treeData.value.patients.length === 0) {
    treeData.value.visits.forEach((visit) => {
      const visitNode = {
        id: visit.id,
        label: visit.name || visit.id,
        type: 'visit',
        originalId: visit.id,
        metadata: visit.metadata,
        children: [],
      }

      // Convert observations for this visit
      if (visit.observations && visit.observations.length > 0) {
        visit.observations.forEach((observation) => {
          const obsNode = {
            id: observation.id,
            label: observation.display || observation.name || observation.concept || 'Unknown Observation',
            type: 'observation',
            originalId: observation.id,
            valtype: observation.valtype,
            metadata: observation.metadata,
          }

          if (observation.selected) {
            ticked.push(obsNode.id)
          }

          visitNode.children.push(obsNode)
        })
      }

      if (visit.selected) {
        ticked.push(visitNode.id)
      }

      nodes.push(visitNode)
    })
  }

  // Handle standalone observations (no visits)
  if (treeData.value.observations && treeData.value.observations.length > 0 && treeData.value.visits.length === 0) {
    treeData.value.observations.forEach((observation) => {
      const obsNode = {
        id: observation.id,
        label: observation.display || observation.name || observation.concept || 'Unknown Observation',
        type: 'observation',
        originalId: observation.id,
        valtype: observation.valtype,
        metadata: observation.metadata,
      }

      if (observation.selected) {
        ticked.push(obsNode.id)
      }

      nodes.push(obsNode)
    })
  }

  treeNodes.value = nodes
  tickedNodes.value = ticked
  // expandedNodes.value = nodes.map((node) => node.id) // Expand all by default
}

// Helper functions for q-tree
const getNodeIcon = (type) => {
  switch (type) {
    case 'patient':
      return 'person'
    case 'visit':
      return 'event'
    case 'observation':
      return 'analytics'
    default:
      return 'help'
  }
}

const getNodeColor = (type) => {
  switch (type) {
    case 'patient':
      return 'green'
    case 'visit':
      return 'orange'
    case 'observation':
      return 'purple'
    default:
      return 'grey'
  }
}

// Helper function to count selected nodes by type
const countSelectedNodesByType = (type) => {
  const tickedIds = new Set(tickedNodes.value)
  if (!treeNodes.value) return 0

  let count = 0
  const traverse = (nodeList) => {
    nodeList.forEach((node) => {
      if (node.type === type && tickedIds.has(node.id)) {
        count++
      }
      if (node.children) {
        traverse(node.children)
      }
    })
  }
  traverse(treeNodes.value)
  return count
}

// Computed properties for selection counts based on actual q-tree selections
const selectedPatientsCount = computed(() => countSelectedNodesByType('patient'))
const selectedVisitsCount = computed(() => countSelectedNodesByType('visit'))
const selectedObservationsCount = computed(() => countSelectedNodesByType('observation'))

// Computed properties for "select all" checkboxes
// const patientsAllSelected = computed({
//   get: () => {
//     const patients = treeData.value.patients || []
//     return patients.length > 0 && patients.every((p) => p.selected)
//   },
//   set: (value) => {
//     treeData.value.patients?.forEach((patient) => {
//       patient.selected = value
//       // Also update visits and observations
//       patient.visits?.forEach((visit) => {
//         visit.selected = value
//         visit.observations?.forEach((obs) => (obs.selected = value))
//       })
//     })
//   },
// })

// const patientsIndeterminate = computed(() => {
//   const patients = treeData.value.patients || []
//   if (patients.length === 0) return false
//   const selectedCount = patients.filter((p) => p.selected).length
//   return selectedCount > 0 && selectedCount < patients.length
// })

// Helper functions
// const getSelectedObservationsCount = (visit) => {
//   return visit.observations?.filter((o) => o.selected).length || 0
// }

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

// const getValtypeDescription = (valtype) => {
//   switch (valtype) {
//     case 'Q':
//       return 'Questionnaire/Raw Data'
//     case 'N':
//       return 'Numeric'
//     case 'T':
//       return 'Text'
//     default:
//       return 'Unknown'
//   }
// }

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
  const allNodeIds = []

  const collectAllIds = (nodes) => {
    nodes.forEach((node) => {
      allNodeIds.push(node.id)
      if (node.children) {
        collectAllIds(node.children)
      }
    })
  }

  collectAllIds(treeNodes.value)
  tickedNodes.value = allNodeIds

  // Also update our internal data structure
  treeData.value.patients?.forEach((patient) => {
    patient.selected = true
    patient.visits?.forEach((visit) => {
      visit.selected = true
      visit.observations?.forEach((obs) => (obs.selected = true))
    })
  })
}

const deselectAll = () => {
  tickedNodes.value = []

  // Also update our internal data structure
  treeData.value.patients?.forEach((patient) => {
    patient.selected = false
    patient.visits?.forEach((visit) => {
      visit.selected = false
      visit.observations?.forEach((obs) => (obs.selected = false))
    })
  })
}

// const toggleAllObservations = (visit) => {
//   const allSelected = visit.observations?.every((o) => o.selected) || false
//   visit.observations?.forEach((obs) => (obs.selected = !allSelected))
// }

// const updatePatientSelection = () => {
//   // Update parent selection state when individual patients change
// }

// const updateVisitSelection = () => {
//   // Update parent selection state when individual visits change
// }

// const updateObservationSelection = () => {
//   // Update parent selection state when individual observations change
// }

// Collapse toggle methods
// const togglePatientsCollapse = () => {
//   patientsCollapsed.value = !patientsCollapsed.value
// }

// const toggleVisitObservationsCollapse = (visit) => {
//   if (!visit.observationsCollapsed) {
//     visit.observationsCollapsed = false
//   }
//   visit.observationsCollapsed = !visit.observationsCollapsed
// }

// const toggleStandaloneObservationsCollapse = () => {
//   standaloneObservationsCollapsed.value = !standaloneObservationsCollapsed.value
// }

// const toggleAllStandaloneObservations = () => {
//   observationsAllSelected.value = !observationsAllSelected.value
// }

// Handle update and close
const handleUpdate = () => {
  // Update our internal data structure based on q-tree selections
  updateInternalSelections()

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

// Update internal data structure based on q-tree ticked nodes
const updateInternalSelections = () => {
  const tickedIds = new Set(tickedNodes.value)

  // Update patients
  treeData.value.patients?.forEach((patient) => {
    patient.selected = tickedIds.has(patient.id)
    patient.visits?.forEach((visit) => {
      visit.selected = tickedIds.has(visit.id)
      visit.observations?.forEach((obs) => {
        obs.selected = tickedIds.has(obs.id)
      })
    })
  })

  // Update standalone visits
  treeData.value.visits?.forEach((visit) => {
    visit.selected = tickedIds.has(visit.id)
    visit.observations?.forEach((obs) => {
      obs.selected = tickedIds.has(obs.id)
    })
  })

  // Update standalone observations
  treeData.value.observations?.forEach((obs) => {
    obs.selected = tickedIds.has(obs.id)
  })
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
    .tree-node-content {
      display: flex;
      align-items: center;
      width: 100%;

      .tree-node-details {
        flex: 1;
        margin-left: 8px;

        .tree-node-name {
          font-weight: 500;
          margin-bottom: 2px;
        }

        .tree-node-meta {
          font-size: 0.8em;
          color: rgba(0, 0, 0, 0.6);
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
      }
    }
  }
}
</style>
