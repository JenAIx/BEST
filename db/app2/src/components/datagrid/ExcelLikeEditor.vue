<template>
  <div class="excel-editor">
    <!-- Header Controls -->
    <div class="editor-header q-pa-md bg-white shadow-1">
      <div class="row items-center justify-between">
        <div class="col-auto">
          <div class="text-h6 flex items-center">
            <q-icon name="table_view" size="24px" color="primary" class="q-mr-sm" />
            Data Grid Editor
            <q-chip color="primary" text-color="white" size="sm" class="q-ml-sm"> {{ patientData.length }} patients • {{ totalObservations }} observations </q-chip>
          </div>
          <div class="text-caption text-grey-6">Click any cell to edit • Changes auto-save • Use Tab/Enter to navigate</div>
        </div>
        <div class="col-auto q-gutter-sm">
          <q-btn flat icon="refresh" label="Refresh" @click="refreshData" :loading="loading" />
          <q-btn color="secondary" icon="add" label="New Observation" @click="showNewObservationDialog = true" />
          <q-btn flat icon="settings" label="View Options" @click="showViewOptions = true" />
          <q-btn color="primary" icon="save" label="Save All" @click="saveAllChanges" :loading="savingAll" :disable="!hasUnsavedChanges" />
          <q-btn flat icon="arrow_back" label="Back to Selection" @click="goBack" />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="q-pa-xl text-center">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Loading patient data...</div>
    </div>

    <!-- Excel-like Table -->
    <div v-else class="excel-table-container">
      <q-scroll-area class="excel-scroll-area" :thumb-style="thumbStyle" :bar-style="barStyle">
        <table class="excel-table">
          <!-- Header Row -->
          <thead>
            <tr class="header-row">
              <!-- Fixed columns -->
              <th class="fixed-col patient-col">Patient</th>
              <th class="fixed-col visit-col">Visit Date</th>
              <th class="fixed-col encounter-col">Encounter</th>

              <!-- Dynamic observation columns -->
              <th v-for="concept in observationConcepts" :key="concept.code" class="obs-col" :title="concept.name">
                <div class="col-header">
                  <div class="concept-name">{{ concept.name }}</div>
                  <div class="concept-code">{{ concept.code }}</div>
                  <ValueTypeIcon :value-type="concept.valueType" size="16px" variant="minimal" />
                </div>
              </th>
            </tr>
          </thead>

          <!-- Data Rows -->
          <tbody>
            <tr v-for="row in tableRows" :key="`${row.patientId}-${row.encounterNum}`" class="data-row" :class="{ 'has-changes': hasRowChanges(row) }">
              <!-- Fixed columns -->
              <td class="fixed-col patient-col">
                <div class="patient-info">
                  <q-avatar size="24px" color="primary" text-color="white" class="q-mr-xs">
                    {{ getPatientInitials(row.patientName) }}
                  </q-avatar>
                  <div>
                    <div class="patient-name">{{ row.patientName }}</div>
                    <div class="patient-id">{{ row.patientId }}</div>
                  </div>
                </div>
              </td>

              <td class="fixed-col visit-col">
                <div class="visit-date">{{ formatDate(row.visitDate) }}</div>
              </td>

              <td class="fixed-col encounter-col">
                <div class="encounter-num">{{ row.encounterNum }}</div>
              </td>

              <!-- Observation cells -->
              <td v-for="concept in observationConcepts" :key="concept.code" class="obs-cell" :class="getCellClass(row, concept)">
                <EditableCell
                  :value="getCellValue(row, concept)"
                  :value-type="concept.valueType"
                  :concept-code="concept.code"
                  :patient-id="row.patientId"
                  :encounter-num="row.encounterNum"
                  :observation-id="getCellObservationId(row, concept)"
                  @update="onCellUpdate"
                  @save="onCellSave"
                  @error="onCellError"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </q-scroll-area>
    </div>

    <!-- View Options Dialog -->
    <q-dialog v-model="showViewOptions">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">View Options</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label>Show Empty Cells</q-item-label>
                <q-item-label caption>Display cells even when no observation exists</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="viewOptions.showEmptyCells" @update:model-value="updateViewOptions({ showEmptyCells: $event })" />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-item-label>Compact View</q-item-label>
                <q-item-label caption>Reduce cell padding for more data on screen</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="viewOptions.compactView" @update:model-value="updateViewOptions({ compactView: $event })" />
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section>
                <q-item-label>Highlight Changes</q-item-label>
                <q-item-label caption>Show visual indicators for unsaved changes</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="viewOptions.highlightChanges" @update:model-value="updateViewOptions({ highlightChanges: $event })" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- New Observation Dialog -->
    <q-dialog v-model="showNewObservationDialog" persistent>
      <q-card style="min-width: 500px; max-width: 700px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6 text-secondary">
            <q-icon name="add" class="q-mr-sm" />
            Add New Observation Column
          </div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="text-body2 text-grey-6 q-mb-md">Select a medical concept to add as a new column to the data grid.</div>

          <!-- Concept Search -->
          <div class="concept-search-section">
            <q-input v-model="newConceptSearch" outlined dense placeholder="Search for medical concepts..." clearable class="q-mb-md" :loading="conceptSearchLoading">
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>

            <!-- Search Results -->
            <div v-if="newConceptSearch && conceptSearchResults.length > 0" class="search-results">
              <div class="text-subtitle2 text-grey-7 q-mb-sm">
                Search Results: {{ availableConceptSearchResults.length }} available
                <span v-if="conceptSearchResults.length > availableConceptSearchResults.length" class="text-grey-5">
                  ({{ conceptSearchResults.length - availableConceptSearchResults.length }} already added)
                </span>
              </div>

              <!-- Available concepts -->
              <div v-if="availableConceptSearchResults.length > 0">
                <q-list bordered class="rounded-borders" style="max-height: 250px; overflow-y: auto">
                  <q-item v-for="concept in availableConceptSearchResults" :key="concept.CONCEPT_CD" clickable @click="addNewObservationColumn(concept)" class="concept-item">
                    <q-item-section>
                      <q-item-label>{{ concept.NAME_CHAR }}</q-item-label>
                      <q-item-label caption>{{ concept.CONCEPT_CD }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-icon name="add" color="secondary" />
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <!-- Already added concepts -->
              <div v-if="alreadyAddedConcepts.length > 0" class="q-mb-md">
                <div class="text-subtitle2 text-grey-7 q-mb-sm">Already in Grid: {{ alreadyAddedConcepts.length }}</div>
                <q-list bordered class="rounded-borders" style="max-height: 150px; overflow-y: auto">
                  <q-item v-for="concept in alreadyAddedConcepts" :key="`added-${concept.CONCEPT_CD}`" class="concept-item already-added">
                    <q-item-section>
                      <q-item-label class="text-grey-6">{{ concept.NAME_CHAR }}</q-item-label>
                      <q-item-label caption class="text-grey-5">{{ concept.CONCEPT_CD }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-icon name="check_circle" color="positive" />
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <!-- All concepts already added -->
              <div v-if="availableConceptSearchResults.length === 0 && alreadyAddedConcepts.length > 0" class="text-center text-grey-6 q-py-md">
                <q-icon name="check_circle" size="48px" color="positive" />
                <div class="q-mt-sm">All found concepts are already in the grid</div>
                <div class="text-caption">Try searching for different concepts</div>
              </div>
            </div>

            <!-- No Results -->
            <div v-if="newConceptSearch && !conceptSearchLoading && conceptSearchResults.length === 0" class="text-center text-grey-6 q-py-md">
              <q-icon name="search_off" size="48px" />
              <div class="q-mt-sm">No concepts found</div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Status Bar -->
    <div class="status-bar q-pa-sm bg-grey-2 text-grey-7">
      <div class="row items-center justify-between">
        <div class="col-auto text-caption">
          <span v-if="hasUnsavedChanges" class="text-orange-8">
            <q-icon name="edit" size="14px" class="q-mr-xs" />
            {{ unsavedChangesCount }} unsaved changes
          </span>
          <span v-else class="text-positive">
            <q-icon name="check_circle" size="14px" class="q-mr-xs" />
            All changes saved
          </span>
        </div>
        <div class="col-auto text-caption">Last updated: {{ lastUpdateTime }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useDataGridStore } from 'src/stores/data-grid-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ValueTypeIcon from 'src/components/shared/ValueTypeIcon.vue'
import EditableCell from './EditableCell.vue'

// Excel-like editor for multi-patient observation editing

const props = defineProps({
  patientIds: {
    type: Array,
    required: true,
  },
})

const $q = useQuasar()
const router = useRouter()
const dataGridStore = useDataGridStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ExcelLikeEditor')

// Local component state (only what's component-specific)
const showViewOptions = ref(false)
const showNewObservationDialog = ref(false)

// New observation dialog state
const newConceptSearch = ref('')
const conceptSearchLoading = ref(false)
const conceptSearchResults = ref([])

// Computed property to filter out concepts already in the grid
const availableConceptSearchResults = computed(() => {
  const existingConceptCodes = new Set(dataGridStore.observationConcepts?.value?.map((c) => c.code) || [])

  return conceptSearchResults.value.filter((concept) => !existingConceptCodes.has(concept.CONCEPT_CD))
})

// Computed property to get concepts already in the grid
const alreadyAddedConcepts = computed(() => {
  const existingConceptCodes = new Set(dataGridStore.observationConcepts?.value?.map((c) => c.code) || [])

  return conceptSearchResults.value.filter((concept) => existingConceptCodes.has(concept.CONCEPT_CD))
})

// Ensure reactive variables are properly initialized
const initializeDialogState = () => {
  newConceptSearch.value = ''
  conceptSearchLoading.value = false
  conceptSearchResults.value = []
}

// Computed properties (using store data)
const totalObservations = computed(() => dataGridStore.totalObservations)
const hasUnsavedChanges = computed(() => dataGridStore.hasUnsavedChanges)
const unsavedChangesCount = computed(() => dataGridStore.unsavedChangesCount)
const loading = computed(() => dataGridStore.loading)
const savingAll = computed(() => dataGridStore.savingAll)
const patientData = computed(() => dataGridStore.patientData)
const observationConcepts = computed(() => dataGridStore.observationConcepts)
const tableRows = computed(() => dataGridStore.tableRows)
const lastUpdateTime = computed(() => dataGridStore.lastUpdateTime)
const viewOptions = computed(() => dataGridStore.viewOptions)

// Scroll area styling
const thumbStyle = {
  right: '4px',
  borderRadius: '5px',
  backgroundColor: '#027be3',
  width: '5px',
  opacity: 0.75,
}

const barStyle = {
  right: '2px',
  borderRadius: '9px',
  backgroundColor: '#027be3',
  width: '9px',
  opacity: 0.2,
}

// Data loading methods (using store functions)
const loadPatientData = async () => {
  await dataGridStore.loadGridData(props.patientIds)
}

// Helper methods (using store functions)
const getPatientInitials = dataGridStore.getPatientInitials
const formatDate = dataGridStore.formatDate
const getCellValue = dataGridStore.getCellValue
const getCellObservationId = dataGridStore.getCellObservationId
const getCellClass = dataGridStore.getCellClass
const hasRowChanges = dataGridStore.hasRowChanges

// Event handlers (using store functions)
const onCellUpdate = dataGridStore.handleCellUpdate
const onCellSave = dataGridStore.handleCellSave
const onCellError = dataGridStore.handleCellError

// New observation methods
const searchConceptsForNewObservation = async (query) => {
  if (!query || query.length < 2) {
    conceptSearchResults.value = []
    return
  }

  // Ensure concept store is initialized
  if (!conceptStore) {
    logger.warn('Concept store not available for search')
    conceptSearchResults.value = []
    return
  }

  conceptSearchLoading.value = true
  try {
    const results = await conceptStore.searchConcepts(query, {
      limit: 20,
      context: 'data_grid_new_observation',
    })
    conceptSearchResults.value = results || []
  } catch (error) {
    logger.error('Concept search failed', error)
    conceptSearchResults.value = []
    $q.notify({
      type: 'negative',
      message: `Search failed: ${error.message}`,
      position: 'top',
    })
  } finally {
    conceptSearchLoading.value = false
  }
}

const addNewObservationColumn = async (concept) => {
  try {
    logger.info('Adding new observation column', { conceptCode: concept.CONCEPT_CD, conceptName: concept.NAME_CHAR })

    // Add the concept to the data grid store using the store method
    const result = await dataGridStore.addConceptToGrid(concept)

    // Close the dialog (this will trigger the watch that resets state)
    showNewObservationDialog.value = false

    // Show appropriate notification based on result
    if (result.alreadyExists) {
      $q.notify({
        type: 'info',
        message: `"${concept.NAME_CHAR}" is already in the grid`,
        position: 'top',
      })
    } else {
      $q.notify({
        type: 'positive',
        message: `Added "${concept.NAME_CHAR}" column to the grid`,
        position: 'top',
      })
    }
  } catch (error) {
    logger.error('Failed to add new observation column', error)
    $q.notify({
      type: 'negative',
      message: `Failed to add column: ${error.message}`,
      position: 'top',
    })
  }
}

// Batch operations (using store functions)
const saveAllChanges = dataGridStore.saveAllChanges
const refreshData = () => dataGridStore.refreshData(props.patientIds)

const goBack = () => {
  if (dataGridStore.hasUnsavedChanges) {
    $q.dialog({
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Are you sure you want to go back?',
      cancel: true,
      persistent: true,
    }).onOk(() => {
      router.push('/data-grid')
    })
  } else {
    router.push('/data-grid')
  }
}

// Auto-save functionality
let autoSaveInterval = null

const startAutoSave = () => {
  autoSaveInterval = setInterval(() => {
    if (hasUnsavedChanges.value) {
      // Auto-save logic could be implemented here
      // For now, we'll just update the timestamp
      lastUpdateTime.value = new Date().toLocaleTimeString()
    }
  }, 30000) // Auto-save every 30 seconds
}

const stopAutoSave = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
  }
}

// View options management (delegate to store)
const updateViewOptions = dataGridStore.updateViewOptions

// Watch for view options changes (store handles persistence)
watch(
  () => dataGridStore.viewOptions,
  (newOptions) => {
    // Store automatically handles persistence
    logger.debug('View options changed', { newOptions })
  },
  { deep: true },
)

// Watch for new concept search input
let conceptSearchTimeout = null
watch(newConceptSearch, (newQuery) => {
  // Clear previous timeout
  if (conceptSearchTimeout) {
    clearTimeout(conceptSearchTimeout)
  }

  if (!newQuery || newQuery.length < 2) {
    conceptSearchResults.value = []
    return
  }

  // Debounce search
  conceptSearchTimeout = setTimeout(() => {
    searchConceptsForNewObservation(newQuery)
  }, 300)
})

// Watch for dialog visibility changes
watch(showNewObservationDialog, (isVisible) => {
  if (!isVisible) {
    // Reset dialog state when closed
    initializeDialogState()
  }
})

// Lifecycle
onMounted(async () => {
  // Initialize stores
  dataGridStore.initialize()
  await conceptStore.initialize()

  // Initialize dialog state
  initializeDialogState()

  await loadPatientData()
  startAutoSave()
})

onUnmounted(() => {
  stopAutoSave()

  // Clean up concept search timeout
  if (conceptSearchTimeout) {
    clearTimeout(conceptSearchTimeout)
  }
})
</script>

<style lang="scss" scoped>
.excel-editor {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: $grey-1;
}

.editor-header {
  flex-shrink: 0;
  border-bottom: 1px solid $grey-4;
}

.excel-table-container {
  flex: 1;
  overflow: hidden;
  background: white;
}

.excel-scroll-area {
  height: 100%;
}

.excel-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;

  .header-row {
    position: sticky;
    top: 0;
    z-index: 10;
    background: $grey-2;

    th {
      padding: 12px 8px;
      border: 1px solid $grey-4;
      border-top: none;
      font-weight: 600;
      text-align: left;
      background: $grey-2;
      position: relative;

      &.fixed-col {
        position: sticky;
        left: 0;
        z-index: 11;
        background: $grey-3;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
      }

      &.patient-col {
        left: 0;
        width: 200px;
        min-width: 200px;
      }

      &.visit-col {
        left: 200px;
        width: 120px;
        min-width: 120px;
      }

      &.encounter-col {
        left: 320px;
        width: 100px;
        min-width: 100px;
      }

      &.obs-col {
        width: 150px;
        min-width: 150px;

        .col-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;

          .concept-name {
            font-size: 0.75rem;
            font-weight: 600;
            text-align: center;
            line-height: 1.2;
            max-height: 2.4em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .concept-code {
            font-size: 0.65rem;
            color: $grey-6;
            font-weight: normal;
          }
        }
      }
    }
  }

  .data-row {
    &:hover {
      background: $blue-1;
    }

    &.has-changes {
      background: $orange-1;
      border-left: 3px solid $orange-6;
    }

    td {
      padding: 8px;
      border: 1px solid $grey-4;
      border-top: none;
      vertical-align: top;

      &.fixed-col {
        position: sticky;
        background: white;
        z-index: 5;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);

        &.patient-col {
          left: 0;
        }

        &.visit-col {
          left: 200px;
        }

        &.encounter-col {
          left: 320px;
        }
      }

      &.obs-cell {
        width: 150px;
        min-width: 150px;
        padding: 4px;

        &.has-value {
          background: white;
        }

        &.empty-cell {
          background: $grey-1;
        }

        &.has-pending-change {
          background: $orange-2;
          border-color: $orange-5;
        }

        &.compact {
          padding: 2px;
        }
      }
    }
  }
}

.patient-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .patient-name {
    font-weight: 500;
    font-size: 0.875rem;
    line-height: 1.2;
  }

  .patient-id {
    font-size: 0.75rem;
    color: $grey-6;
  }
}

.visit-date {
  font-size: 0.8rem;
  color: $grey-8;
}

.encounter-num {
  font-size: 0.8rem;
  color: $grey-7;
  text-align: center;
}

.status-bar {
  flex-shrink: 0;
  border-top: 1px solid $grey-4;
}

// Responsive adjustments
@media (max-width: 1200px) {
  .excel-table {
    .header-row th.obs-col {
      width: 120px;
      min-width: 120px;
    }

    .data-row td.obs-cell {
      width: 120px;
      min-width: 120px;
    }
  }
}

@media (max-width: 768px) {
  .editor-header {
    .row {
      flex-direction: column;
      gap: 12px;
    }
  }

  .excel-table {
    .header-row th {
      &.patient-col {
        width: 150px;
        min-width: 150px;
      }

      &.visit-col {
        left: 150px;
        width: 100px;
        min-width: 100px;
      }

      &.encounter-col {
        left: 250px;
        width: 80px;
        min-width: 80px;
      }

      &.obs-col {
        width: 100px;
        min-width: 100px;
      }
    }

    .data-row td {
      &.patient-col {
        width: 150px;
      }

      &.visit-col {
        left: 150px;
        width: 100px;
      }

      &.encounter-col {
        left: 250px;
        width: 80px;
      }

      &.obs-cell {
        width: 100px;
        min-width: 100px;
      }
    }
  }
}

// New observation dialog styles
.concept-search-section {
  .search-results {
    .concept-item {
      transition: all 0.2s ease;

      &:hover {
        background-color: rgba(25, 118, 210, 0.08);
      }

      &.already-added {
        background-color: rgba(76, 175, 80, 0.05);
        border-left: 3px solid #4caf50;

        &:hover {
          background-color: rgba(76, 175, 80, 0.08);
        }
      }
    }
  }
}
</style>
