<template>
  <div class="excel-editor">
    <!-- Header Controls -->
    <div class="editor-header q-pa-md bg-white shadow-1">
      <div class="row items-center justify-start q-gutter-sm">
        <q-btn flat icon="refresh" label="Refresh" @click="refreshData" :loading="loading" />
        <q-btn color="secondary" icon="add" label="New Observation" @click="showNewObservationDialog = true" />
        <q-btn flat icon="settings" label="View Options" @click="showViewOptions = true" />
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

              <!-- Dynamic observation columns -->
              <th v-for="concept in visibleObservationConcepts" :key="concept.code" class="obs-col" :title="concept.name">
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
                <div class="visit-date-container">
                  <div class="visit-date">
                    {{ formatDate(row.visitDate) }}
                  </div>
                  <div class="visit-edit-icon" @click="openVisitEditDialog(row)">
                    <q-icon name="edit" size="16px" color="grey-6" />
                  </div>
                  <q-tooltip anchor="top middle" self="bottom middle" :offset="[10, 10]" class="bg-grey-9 text-white">
                    <div class="tooltip-content">
                      <div class="text-weight-bold q-mb-xs">Visit Information</div>
                      <div><strong>Patient:</strong> {{ row.patientName }}</div>
                      <div><strong>Encounter:</strong> {{ row.encounterNum }}</div>
                      <div><strong>Date:</strong> {{ formatDate(row.visitDate) }}</div>
                      <div class="text-grey-4 text-caption q-mt-xs">Click edit icon to modify visit</div>
                    </div>
                  </q-tooltip>
                </div>
              </td>

              <!-- Observation cells -->
              <td v-for="concept in visibleObservationConcepts" :key="concept.code" class="obs-cell" :class="getCellClass(row, concept)">
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
    <ViewOptionsDialog
      v-model="showViewOptions"
      :view-options="viewOptions"
      :observation-concepts="observationConcepts"
      :column-visibility="dataGridStore?.columnVisibility ? Object.fromEntries(dataGridStore.columnVisibility) : {}"
      @update:view-options="updateViewOptions"
      @update:column-visibility="handleColumnVisibilityUpdate"
      @update:column-order="handleColumnOrderUpdate"
      @add-observation="showNewObservationDialog = true"
    />

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

    <!-- Edit Visit Dialog -->
    <EditVisitDialog v-if="selectedVisitData" v-model="showVisitEditDialog" :patient="selectedVisitData" :visit="selectedVisitData" @visitUpdated="handleVisitUpdated" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDataGridStore } from 'src/stores/data-grid-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ValueTypeIcon from 'src/components/shared/ValueTypeIcon.vue'
import EditableCell from './EditableCell.vue'
import ViewOptionsDialog from './ViewOptionsDialog.vue'
import EditVisitDialog from 'src/components/patient/EditVisitDialog.vue'

// Excel-like editor for multi-patient observation editing

const props = defineProps({
  patientIds: {
    type: Array,
    required: true,
  },
})

// No longer need to emit events - store handles reactivity

const $q = useQuasar()
const dataGridStore = useDataGridStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ExcelLikeEditor')

// Local component state (only what's component-specific)
const showViewOptions = ref(false)
const showNewObservationDialog = ref(false)
const showVisitEditDialog = ref(false)
const selectedVisitData = ref(null)

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
const loading = computed(() => dataGridStore?.loading || false)
const observationConcepts = computed(() => dataGridStore?.observationConcepts || [])

// Use store's reactive properties for visibility and statistics
const visibleObservationConcepts = computed(() => dataGridStore?.getVisibleObservationConcepts || [])

const tableRows = computed(() => dataGridStore?.tableRows || [])
const viewOptions = computed(() => dataGridStore?.viewOptions || {})

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
  if (dataGridStore?.loadGridData) {
    await dataGridStore.loadGridData(props.patientIds)

    // Initialize column visibility and order after loading data
    if (dataGridStore?.initializeColumnVisibility) {
      dataGridStore.initializeColumnVisibility()
    }
    if (dataGridStore?.initializeColumnOrder) {
      dataGridStore.initializeColumnOrder()
    }
  }
}

// Helper methods (using store functions) - with defensive checks
const getPatientInitials = dataGridStore?.getPatientInitials || (() => 'U')
const formatDate = dataGridStore?.formatDate || ((date) => date || '')
const getCellValue = dataGridStore?.getCellValue || (() => '')
const getCellObservationId = dataGridStore?.getCellObservationId || (() => null)
const getCellClass = dataGridStore?.getCellClass || (() => '')
const hasRowChanges = dataGridStore?.hasRowChanges || (() => false)

// Event handlers (using store functions) - with defensive checks
const onCellUpdate = dataGridStore?.handleCellUpdate || (() => {})
const onCellSave = dataGridStore?.handleCellSave || (() => {})
const onCellError = dataGridStore?.handleCellError || (() => {})

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

// Batch operations (using store functions) - with defensive checks
const refreshData = () => (dataGridStore?.refreshData ? dataGridStore.refreshData(props.patientIds) : () => {})

// View options management (delegate to store)
const updateViewOptions = dataGridStore.updateViewOptions

// Column management handlers - delegate to store
const handleColumnVisibilityUpdate = (columnCode, visible) => {
  dataGridStore.updateColumnVisibility(columnCode, visible)

  $q.notify({
    type: visible ? 'positive' : 'info',
    message: `Column "${columnCode}" is now ${visible ? 'visible' : 'hidden'}`,
    position: 'top',
  })
}

const handleColumnOrderUpdate = (columnOrder) => {
  logger.info('Column order updated', { columnOrder })

  // Update the column order in the store
  if (dataGridStore?.updateColumnOrder) {
    dataGridStore.updateColumnOrder(columnOrder)
  }

  $q.notify({
    type: 'positive',
    message: 'Column order updated successfully',
    position: 'top',
  })
}

// Visit edit dialog methods
const openVisitEditDialog = (row) => {
  logger.info('Opening visit edit dialog', { patientId: row.patientId, encounterNum: row.encounterNum })

  // Prepare visit data for the dialog
  selectedVisitData.value = {
    patientId: row.patientId,
    patientName: row.patientName,
    encounterNum: row.encounterNum,
    visitDate: row.visitDate,
    // Add other visit properties as needed
    visit: {
      ENCOUNTER_NUM: row.encounterNum,
      START_DATE: row.visitDate,
      // Add other visit fields that might be available
      PATIENT_CD: row.patientId,
    },
  }

  showVisitEditDialog.value = true
}

const handleVisitUpdated = (updatedVisit) => {
  logger.info('Visit updated successfully', { updatedVisit })

  // Refresh the data grid to show the updated visit information
  refreshData()

  $q.notify({
    type: 'positive',
    message: `Visit ${updatedVisit.ENCOUNTER_NUM} updated successfully`,
    position: 'top',
  })
}

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

// Store automatically handles column visibility initialization
// when concepts are loaded via initializeColumnVisibility method

// Store handles all reactive updates automatically
// No need for event emissions since components can react to store changes directly

// Lifecycle
onMounted(async () => {
  // Initialize stores
  if (dataGridStore?.initialize) {
    dataGridStore.initialize()
  }
  if (conceptStore?.initialize) {
    await conceptStore.initialize()
  }

  // Initialize dialog state
  initializeDialogState()

  await loadPatientData()
})

onUnmounted(() => {
  // Clean up concept search timeout
  if (conceptSearchTimeout) {
    clearTimeout(conceptSearchTimeout)
  }
})
</script>

<style lang="scss" scoped>
.excel-editor {
  height: 100%; // Full height since footer is in GridLayout
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
            line-clamp: 2;
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

.visit-date-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  cursor: help;

  &:hover .visit-edit-icon {
    opacity: 1;
    visibility: visible;
  }
}

.visit-date {
  font-size: 0.8rem;
  color: $grey-8;
  flex: 1;
}

.visit-edit-icon {
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  margin-left: 8px;

  &:hover {
    background: rgba(0, 0, 0, 0.08);
    opacity: 1 !important;

    .q-icon {
      color: $primary !important;
    }
  }

  .q-icon {
    transition: color 0.2s ease;
  }
}

.tooltip-content {
  font-size: 0.75rem;
  line-height: 1.4;

  div {
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: $grey-4;
      font-weight: 600;
    }
  }
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
