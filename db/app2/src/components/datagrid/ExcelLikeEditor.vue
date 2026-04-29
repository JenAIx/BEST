<template>
  <div class="excel-editor">
    <!-- Header Controls -->
    <div class="editor-header q-pa-md bg-white shadow-1">
      <div class="row items-center justify-between q-gutter-sm">
        <!-- Left side: Main actions -->
        <div class="row items-center q-gutter-sm">
          <q-btn flat icon="refresh" :label="$t('common.refresh')" @click="refreshData" :loading="loading" />
          <q-btn flat icon="settings" :label="$t('dataGrid.viewOptions')" @click="showViewOptions = true" />
          <q-btn flat icon="add" :label="$t('common.add')" color="dark">
            <q-menu anchor="bottom left" self="top left">
              <q-list style="min-width: 200px">
                <q-item clickable @click="openAddObservationDialog" v-close-popup>
                  <q-item-section avatar>
                    <q-icon name="table_chart" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('dataGrid.addObservationColumn') }}</q-item-label>
                    <q-item-label caption>{{ $t('dataGrid.addObservationColumnHint') }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable @click="openAddVisitDialog" v-close-popup>
                  <q-item-section avatar>
                    <q-icon name="event" color="secondary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('dataGrid.addVisit') }}</q-item-label>
                    <q-item-label caption>{{ $t('dataGrid.addVisitHint') }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable @click="openAddPatientDialog" v-close-popup>
                  <q-item-section avatar>
                    <q-icon name="person_add" color="positive" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t('dataGrid.addPatient') }}</q-item-label>
                    <q-item-label caption>{{ $t('dataGrid.addPatientHint') }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        
        <!-- Right side: Zoom controls -->
        <div class="row items-center q-gutter-xs zoom-controls">
          <q-btn flat dense icon="zoom_in" size="sm" color="primary" @click="zoomIn" :disable="zoomLevel >= maxZoom">
            <q-tooltip>{{ $t('dataGrid.zoomIn') }}</q-tooltip>
          </q-btn>
          <q-btn flat dense icon="zoom_out" size="sm" color="primary" @click="zoomOut" :disable="zoomLevel <= minZoom">
            <q-tooltip>{{ $t('dataGrid.zoomOut') }}</q-tooltip>
          </q-btn>
          <q-btn flat dense icon="restart_alt" size="sm" color="grey-7" @click="resetZoom" :disable="zoomLevel === defaultZoom">
            <q-tooltip>{{ $t('dataGrid.resetZoom') }}</q-tooltip>
          </q-btn>
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
        <div class="excel-table-wrapper" :style="zoomWrapperStyle">
          <table class="excel-table" :style="tableZoomStyle">
          <!-- Header Row -->
          <thead>
            <tr class="header-row">
              <!-- Fixed columns -->
              <th class="fixed-col patient-col">Patient</th>
              <th class="fixed-col visit-col">Visit Date</th>

              <!-- Dynamic observation columns -->
              <th 
                v-for="concept in visibleObservationConcepts" 
                :key="concept.code" 
                class="obs-col" 
                :class="{
                  'value-type-d': concept.valueType === 'D',
                  'value-type-n': concept.valueType === 'N',
                  'value-type-m': concept.valueType === 'M' || isMedicationConcept(concept)
                }"
                :title="concept.name"
              >
                <div class="col-header">
                  <div class="concept-name">{{ concept.name }}</div>
                  <div class="concept-code">{{ concept.code }}</div>
                  <!-- Show quiz icon for questionnaire concepts, otherwise use ValueTypeIcon -->
                  <q-icon v-if="concept.valueType === 'Q'" name="quiz" size="16px" color="deep-purple" />
                  <ValueTypeIcon v-else :value-type="concept.valueType" size="16px" variant="minimal" />
                </div>
              </th>
            </tr>
          </thead>

          <!-- Data Rows -->
          <tbody>
            <tr v-for="row in tableRows" :key="`${row.patientId}-${row.encounterNum}`" class="data-row" :class="{ 'has-changes': hasRowChanges(row) }">
              <!-- Fixed columns -->
              <td class="fixed-col patient-col" :class="{ 'subsequent-visit': !isFirstVisitForPatient(row) }">
                <div class="patient-info">
                  <q-avatar 
                    v-if="isFirstVisitForPatient(row)" 
                    size="24px" 
                    color="primary" 
                    text-color="white" 
                    class="q-mr-xs patient-avatar-clickable"
                    @click="openManagePatientDialog(row)"
                  >
                    {{ getPatientInitials(row.patientName) }}
                    <q-tooltip>{{ $t('dataGrid.managePatientTooltip') }}</q-tooltip>
                  </q-avatar>
                  <div v-else class="avatar-placeholder"></div>
                  <div>
                    <div class="patient-name">{{ row.patientName }}</div>
                    <div class="patient-id">{{ row.patientId }}</div>
                  </div>
                </div>
              </td>

              <td class="fixed-col visit-col">
                <div v-if="row.isPlaceholder" class="visit-date-container visit-placeholder">
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    icon="event_available"
                    :label="$t('dataGrid.addVisit')"
                    @click="quickAddVisitForPatient(row)"
                  />
                </div>
                <div v-else class="visit-date-container">
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
              <td
                v-for="concept in visibleObservationConcepts"
                :key="concept.code"
                class="obs-cell"
                :class="[
                  getCellClass(row, concept),
                  {
                    'value-type-d': concept.valueType === 'D',
                    'value-type-n': concept.valueType === 'N',
                    'value-type-m': concept.valueType === 'M' || isMedicationConcept(concept),
                    'obs-cell-placeholder': row.isPlaceholder
                  }
                ]"
              >
                <!-- Placeholder row: no visit yet, observations not editable -->
                <div v-if="row.isPlaceholder" class="obs-placeholder">—</div>
                <!-- Custom questionnaire cell for Q type -->
                <div v-else-if="concept.valueType === 'Q'" class="questionnaire-cell">
                  <!-- Filled questionnaire -->
                  <div v-if="getCellValue(row, concept)" class="questionnaire-content" @click="openQuestionnairePreview(row, concept)">
                    {{ getCellValue(row, concept) }}
                    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 5]"> Click to view questionnaire data </q-tooltip>
                  </div>
                  <!-- Empty questionnaire - clickable to fill -->
                  <div v-else class="questionnaire-empty" @click="openQuestionnaireFillDialog(row, concept)">
                    <q-icon name="add" size="16px" color="grey-5" />
                    <div class="empty-label">Add</div>
                    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 5]"> Click to complete questionnaire </q-tooltip>
                  </div>
                </div>
                <!-- Medication cell for M type or LID: 52418-1 -->
                <div 
                  v-else-if="isMedicationConcept(concept)" 
                  class="medication-cell medication-icon-display"
                  @click="openMedicationOverviewDialog(row)"
                >
                  <div class="medication-icon-wrapper">
                    <q-icon 
                      :name="getMedicationCount(row, concept) > 0 ? 'medication' : 'add'" 
                      :color="getMedicationCount(row, concept) > 0 ? 'primary' : 'grey-5'" 
                      size="22px"
                    />
                    <span 
                      v-if="getMedicationCount(row, concept) > 0"
                      class="medication-count-text"
                    >
                      {{ getMedicationCount(row, concept) }}
                    </span>
                    <q-tooltip>{{ $t('dataGrid.editMedication') }}</q-tooltip>
                  </div>
                </div>
                <!-- Regular editable cell for other types -->
                <EditableCell
                  v-else
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
        </div>
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
    />

    <!-- Edit Visit Dialog -->
    <EditVisitDialog v-if="selectedVisitData" v-model="showVisitEditDialog" :patient="selectedVisitData" :visit="selectedVisitData" @visitUpdated="handleVisitUpdated" />

    <!-- Questionnaire Preview Dialog -->
    <QuestionnairePreviewDialog
      v-if="selectedQuestionnaireData"
      v-model="showQuestionnairePreview"
      :observation-id="selectedQuestionnaireData.observationId"
      :concept-name="selectedQuestionnaireData.conceptName"
      :completion-date="selectedQuestionnaireData.completionDate"
    />

    <!-- Questionnaire Fill Dialog -->
    <QuestionnaireFillDialog
      v-if="selectedQuestionnaireFillData"
      v-model="showQuestionnaireFillDialog"
      :encounter-num="selectedQuestionnaireFillData.encounterNum"
      :patient-id="selectedQuestionnaireFillData.patientId"
      :questionnaire-blob="selectedQuestionnaireFillData.questionnaireBlob"
      :concept-code="selectedQuestionnaireFillData.conceptCode"
      :concept-name="selectedQuestionnaireFillData.conceptName"
      :patient-name="selectedQuestionnaireFillData.patientName"
      :visit-date="selectedQuestionnaireFillData.visitDate"
      @questionnaire-completed="handleQuestionnaireCompleted"
      @close="handleQuestionnaireClosed"
    />

    <!-- Add Observation Dialog -->
    <AddObservationDialog
      v-model="showAddObservationDialog"
      :existing-concepts="observationConcepts"
      @concept-added="handleConceptAdded"
    />

    <!-- Add Visit Dialog -->
    <q-dialog v-model="showAddVisitDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">{{ $t('dataGrid.selectPatientForVisit') }}</div>
        </q-card-section>
        <q-card-section>
          <q-list v-if="gridPatients.length > 0">
            <q-item
              v-for="patient in gridPatients"
              :key="patient.patientId"
              clickable
              @click="selectPatientForVisit(patient)"
            >
              <q-item-section avatar>
                <q-avatar color="primary" text-color="white">
                  {{ getPatientInitials(patient.patientName) }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ patient.patientName }}</q-item-label>
                <q-item-label caption>{{ patient.patientId }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <div v-else class="text-center text-grey-6 q-mt-md">
            {{ $t('dataGrid.noPatientsInGrid') }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" @click="closeDialog('addVisit')" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Simple New Visit Dialog (shown after patient selection) -->
    <q-dialog v-if="selectedPatientForVisit" v-model="showNewVisitDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ $t('visit.newVisit') }}</div>
          <q-space />
          <q-btn icon="close" flat round dense @click="closeDialog('newVisit')" />
        </q-card-section>
        <q-card-section>
          <div class="patient-info q-mb-md">
            <q-avatar size="32px" color="primary" text-color="white" class="q-mr-sm">
              {{ getPatientInitials(selectedPatientForVisit.patientName) }}
            </q-avatar>
            <div>
              <div class="text-weight-medium">{{ selectedPatientForVisit.patientName }}</div>
              <div class="text-caption text-grey-6">{{ selectedPatientForVisit.patientId }}</div>
            </div>
          </div>
          <q-input
            v-model="newVisitDate"
            type="date"
            :label="$t('visit.visitDate')"
            outlined
            :rules="[(val) => !!val || $t('validation.required')]"
          >
            <template v-slot:prepend>
              <q-icon name="event" />
            </template>
          </q-input>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" @click="closeDialog('newVisit')" />
          <q-btn color="primary" :label="$t('visit.createVisit')" @click="createSimpleVisit" :loading="creatingVisit" :disable="!newVisitDate" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Medication Overview Dialog -->
    <MedicationOverviewDialog
      v-if="medicationOverviewData"
      v-model="showMedicationOverviewDialog"
      :medications="medicationOverviewData.medications"
      :patient-id="medicationOverviewData.patientId"
      :patient-name="medicationOverviewData.patientName"
      :encounter-num="medicationOverviewData.encounterNum"
      :visit-date="medicationOverviewData.visitDate"
      :frequency-options="frequencyOptions"
      :route-options="routeOptions"
      @medications-updated="onMedicationsUpdated"
    />

    <!-- Add Patient Dialog -->
    <q-dialog v-model="showAddPatientDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">{{ $t('dataGrid.addPatientToGrid') }}</div>
          <div class="text-caption text-grey-6 q-mt-xs">{{ $t('dataGrid.addPatientHint') }}</div>
        </q-card-section>
        <q-card-section class="q-pa-none">
          <PatientSelectionCard
            title=""
            description=""
            :search-label="$t('patient.patientSearch')"
            @patient-selected="handlePatientSelected"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" @click="closeDialog('addPatient')" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Manage Patient Dialog -->
    <q-dialog v-model="showManagePatientDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ $t('dataGrid.managePatient') }}</div>
          <q-space />
          <q-btn icon="close" flat round dense @click="showManagePatientDialog = false" />
        </q-card-section>
        <q-card-section v-if="selectedPatientForManagement">
          <div class="patient-info q-mb-md">
            <q-avatar size="32px" color="primary" text-color="white" class="q-mr-sm">
              {{ getPatientInitials(selectedPatientForManagement.patientName) }}
            </q-avatar>
            <div>
              <div class="text-weight-medium">{{ selectedPatientForManagement.patientName }}</div>
              <div class="text-caption text-grey-6">{{ selectedPatientForManagement.patientId }}</div>
            </div>
          </div>

          <q-separator class="q-my-md" />

          <!-- Visits List -->
          <div class="text-subtitle2 q-mb-sm">{{ $t('dataGrid.visits') }}</div>
          <q-list bordered separator>
            <q-item 
              v-for="visit in patientVisits" 
              :key="visit.encounterNum"
              clickable
              @click="toggleVisitVisibility(visit.encounterNum)"
            >
              <q-item-section avatar>
                <q-icon 
                  :name="isVisitHidden(visit.encounterNum) ? 'visibility_off' : 'visibility'" 
                  :color="isVisitHidden(visit.encounterNum) ? 'grey-6' : 'primary'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ formatDate(visit.visitDate) }}</q-item-label>
                <q-item-label caption>{{ $t('dataGrid.encounter') }}: {{ visit.encounterNum }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip 
                  :color="isVisitHidden(visit.encounterNum) ? 'grey' : 'primary'" 
                  text-color="white" 
                  size="sm"
                >
                  {{ isVisitHidden(visit.encounterNum) ? $t('dataGrid.hidden') : $t('dataGrid.visible') }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn 
            flat 
            :label="$t('dataGrid.removePatientFromGrid')" 
            color="negative" 
            @click="removePatientFromGrid"
          />
          <q-space />
          <q-btn flat :label="$t('common.close')" @click="showManagePatientDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useDataGridStore } from 'src/stores/data-grid-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ValueTypeIcon from 'src/components/shared/ValueTypeIcon.vue'
import EditableCell from './EditableCell.vue'
import ViewOptionsDialog from './ViewOptionsDialog.vue'
import AddObservationDialog from './AddObservationDialog.vue'
import EditVisitDialog from 'src/components/patient/EditVisitDialog.vue'
import QuestionnairePreviewDialog from 'src/components/shared/QuestionnairePreviewDialog.vue'
import QuestionnaireFillDialog from 'src/components/shared/QuestionnaireFillDialog.vue'
import PatientSelectionCard from 'src/components/shared/PatientSelectionCard.vue'
import { useI18n } from 'vue-i18n'
import { useVisitStore } from 'src/stores/visit-store'
import MedicationOverviewDialog from './MedicationOverviewDialog.vue'
import { useMedicationOptions } from 'src/composables/useMedicationOptions'

// Excel-like editor for multi-patient observation editing

const props = defineProps({
  patientIds: {
    type: Array,
    required: true,
  },
})

// No longer need to emit events - store handles reactivity

const notify = useNotify()
const { t } = useI18n()
const dataGridStore = useDataGridStore()
const conceptStore = useConceptResolutionStore()
const databaseStore = useDatabaseStore()
const visitStore = useVisitStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ExcelLikeEditor')
const localSettings = useLocalSettingsStore()

// Medication options
const { frequencyOptions, routeOptions, loadMedicationOptions } = useMedicationOptions()

// Local component state (only what's component-specific)
const showViewOptions = ref(false)
const showVisitEditDialog = ref(false)
const selectedVisitData = ref(null)

// Zoom state
const defaultZoom = 1.0
const minZoom = 0.5
const maxZoom = 2.0
const zoomStep = 0.1
const zoomLevel = ref(defaultZoom)

// Questionnaire dialogs state
const selectedQuestionnaireData = ref(null)
const selectedQuestionnaireFillData = ref(null)

// Dialog state management - using direct refs for better reactivity
const showAddObservationDialog = ref(false)
const showAddVisitDialog = ref(false)
const showAddPatientDialog = ref(false)
const showNewVisitDialog = ref(false)
const showQuestionnairePreview = ref(false)
const showQuestionnaireFillDialog = ref(false)
const showMedicationOverviewDialog = ref(false)
const medicationOverviewData = ref(null)

// Dialog control functions
const openDialog = (name) => {
  switch (name) {
    case 'addObservation':
      showAddObservationDialog.value = true
      break
    case 'addVisit':
      showAddVisitDialog.value = true
      break
    case 'addPatient':
      showAddPatientDialog.value = true
      break
    case 'newVisit':
      showNewVisitDialog.value = true
      break
    case 'questionnairePreview':
      showQuestionnairePreview.value = true
      break
    case 'questionnaireFill':
      showQuestionnaireFillDialog.value = true
      break
  }
}

const closeDialog = (name) => {
  switch (name) {
    case 'addObservation':
      showAddObservationDialog.value = false
      break
    case 'addVisit':
      showAddVisitDialog.value = false
      break
    case 'addPatient':
      showAddPatientDialog.value = false
      break
    case 'newVisit':
      showNewVisitDialog.value = false
      break
    case 'questionnairePreview':
      showQuestionnairePreview.value = false
      break
    case 'questionnaireFill':
      showQuestionnaireFillDialog.value = false
      break
  }
}

// Visit creation state
const selectedPatientForVisit = ref(null)
const newVisitDate = ref(new Date().toISOString().split('T')[0]) // Today's date
const creatingVisit = ref(false)

// Patient search is now handled by PatientSelectionCard component
// No need for usePatientSearch here since PatientSelectionCard has its own search

// Manage patient dialog state
const showManagePatientDialog = ref(false)
const selectedPatientForManagement = ref(null)

// Load hidden visits from localStorage
const loadHiddenVisits = () => {
  const saved = localSettings.getSetting('dataGrid.hiddenVisits', [])
  return new Set(saved)
}

// Save hidden visits to localStorage
const saveHiddenVisits = (hiddenVisitsSet) => {
  localSettings.setSetting('dataGrid.hiddenVisits', Array.from(hiddenVisitsSet))
}

const hiddenVisits = ref(loadHiddenVisits()) // Track hidden visit encounter numbers

// Computed properties (using store data)
const loading = computed(() => dataGridStore?.loading || false)
const observationConcepts = computed(() => dataGridStore?.observationConcepts || [])

// Use store's reactive properties for visibility and statistics
const visibleObservationConcepts = computed(() => dataGridStore?.getVisibleObservationConcepts || [])

// Filter table rows to exclude hidden visits
const tableRows = computed(() => {
  const rows = dataGridStore?.tableRows || []
  if (hiddenVisits.value.size === 0) return rows
  return rows.filter(row => !hiddenVisits.value.has(row.encounterNum))
})
const viewOptions = computed(() => dataGridStore?.viewOptions || {})

// Computed: Get unique patients from grid
const gridPatients = computed(() => {
  const rows = tableRows.value || []
  const patientMap = new Map()
  
  rows.forEach(row => {
    if (!patientMap.has(row.patientId)) {
      patientMap.set(row.patientId, {
        patientId: row.patientId,
        patientName: row.patientName,
      })
    }
  })
  
  return Array.from(patientMap.values())
})

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

// Zoom functions
const zoomIn = () => {
  if (zoomLevel.value < maxZoom) {
    zoomLevel.value = Math.min(zoomLevel.value + zoomStep, maxZoom)
    // Zoom in
  }
}

const zoomOut = () => {
  if (zoomLevel.value > minZoom) {
    zoomLevel.value = Math.max(zoomLevel.value - zoomStep, minZoom)
    // Zoom out
  }
}

const resetZoom = () => {
  zoomLevel.value = defaultZoom
  // Zoom reset
}

// Computed styles for zoom
const zoomWrapperStyle = computed(() => {
  return {
    transform: `scale(${zoomLevel.value})`,
    transformOrigin: 'top left',
    transition: 'transform 0.2s ease',
  }
})

const tableZoomStyle = computed(() => {
  // Adjust table width to compensate for scale transform
  const scale = zoomLevel.value
  return {
    width: `${100 / scale}%`,
    minWidth: `${100 / scale}%`,
  }
})

// Helper methods (using store functions) - with defensive checks
const getPatientInitials = dataGridStore?.getPatientInitials || (() => 'U')
const formatDate = dataGridStore?.formatDate || ((date) => date || '')
const getCellValue = dataGridStore?.getCellValue || (() => '')
const getCellObservationId = dataGridStore?.getCellObservationId || (() => null)
const getCellClass = dataGridStore?.getCellClass || (() => '')
const hasRowChanges = dataGridStore?.hasRowChanges || (() => false)

// Medication-specific helpers
const isMedicationConcept = (concept) => {
  return concept.code === 'LID: 52418-1' || concept.valueType === 'M' || (concept.code && concept.code.includes('52418'))
}

// Count medications for a visit (cached)
const medicationCountCache = ref(new Map())

const getMedicationCount = (row, concept) => {
  const cacheKey = `${row.encounterNum}-${concept.code}`
  
  // Return cached count if available
  if (medicationCountCache.value.has(cacheKey)) {
    return medicationCountCache.value.get(cacheKey)
  }
  
  // Load count asynchronously
  loadMedicationCount(row, concept)
  
  // Return 0 as default until loaded
  return 0
}

const loadMedicationCount = async (row, concept) => {
  const cacheKey = `${row.encounterNum}-${concept.code}`
  
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM OBSERVATION_FACT
      WHERE ENCOUNTER_NUM = ?
        AND CONCEPT_CD = 'LID: 52418-1'
        AND VALTYPE_CD = 'M'
    `
    
    const result = await databaseStore.executeQuery(query, [row.encounterNum])
    
    if (result.success && result.data.length > 0) {
      const count = result.data[0].count
      medicationCountCache.value.set(cacheKey, count)
    }
  } catch (error) {
    logger.warn('Failed to load medication count', error)
  }
}

// Medication Overview Dialog
const openMedicationOverviewDialog = async (row) => {
  logger.info('Opening medication overview dialog', {
    patientId: row.patientId,
    encounterNum: row.encounterNum,
  })

  try {
    // Load ALL medication observations for this visit from database
    // (not just the one in the grid structure)
    const query = `
      SELECT 
        OBSERVATION_ID,
        CONCEPT_CD,
        TVAL_CHAR,
        NVAL_NUM,
        UNIT_CD
      FROM OBSERVATION_FACT
      WHERE ENCOUNTER_NUM = ?
        AND CONCEPT_CD = 'LID: 52418-1'
        AND VALTYPE_CD = 'M'
      ORDER BY INSTANCE_NUM
    `
    
    const result = await databaseStore.executeQuery(query, [row.encounterNum])
    
    let allMedications = []
    if (result.success && result.data.length > 0) {
      allMedications = result.data.map(obs => ({
        observationId: obs.OBSERVATION_ID,
        OBSERVATION_ID: obs.OBSERVATION_ID,
        TVAL_CHAR: obs.TVAL_CHAR,
        NVAL_NUM: obs.NVAL_NUM,
        UNIT_CD: obs.UNIT_CD,
        value: obs.TVAL_CHAR,
      }))
    } else {
      // No medications found
      allMedications = []
    }
    
    // Load BLOB data for each medication
    const medicationsWithDetails = await Promise.all(
      allMedications.map(async (obs) => {
        const obsId = obs.observationId || obs.OBSERVATION_ID
        if (!obsId) return null
        
        try {
          const { useObservationStore } = await import('src/stores/observation-store.js')
          const observationStore = useObservationStore()
          const loadedBlob = await observationStore.getObservationBlob(obsId)
          
          let medicationData = {
            drugName: obs.TVAL_CHAR || obs.value || '',
            dosage: obs.NVAL_NUM || null,
            dosageUnit: obs.UNIT_CD || 'mg',
            frequency: '',
            route: '',
            instructions: '',
          }
          
          if (loadedBlob) {
            try {
              const parsed = JSON.parse(loadedBlob)
              medicationData = {
                ...medicationData,
                ...parsed,
              }
            } catch (parseError) {
              logger.warn('Failed to parse medication BLOB', parseError)
            }
          }
          
          return {
            ...medicationData,
            observationId: obsId,
          }
        } catch (error) {
          logger.warn('Failed to load medication BLOB', { observationId: obsId, error })
          return {
            drugName: obs.TVAL_CHAR || obs.value || '',
            dosage: obs.NVAL_NUM || null,
            dosageUnit: obs.UNIT_CD || 'mg',
            frequency: '',
            route: '',
            instructions: '',
            observationId: obsId,
          }
        }
      })
    )
    
    medicationOverviewData.value = {
      medications: medicationsWithDetails.filter(m => m !== null),
      patientId: row.patientId,
      patientName: row.patientName,
      encounterNum: row.encounterNum,
      visitDate: row.visitDate,
    }
    
    showMedicationOverviewDialog.value = true
  } catch (error) {
    logger.error('Failed to open medication overview dialog', error)
    notify.error('Failed to open medication overview')
  }
}

const onMedicationsUpdated = async () => {
  // Clear medication count cache to force reload
  medicationCountCache.value.clear()
  
  // Refresh grid data after medications are updated
  await refreshData()
  
  // Reload medication counts for visible rows
  if (medicationOverviewData.value) {
    const { patientId, encounterNum } = medicationOverviewData.value
    const row = tableRows.value?.find(r => r.patientId === patientId && r.encounterNum === encounterNum)
    if (row) {
      const concept = observationConcepts.value?.find(c => c.code === 'LID: 52418-1')
      if (concept) {
        await loadMedicationCount(row, concept)
      }
    }
  }
  
  logger.success('Medications updated, grid refreshed')
}

// Check if this is the first visit row for a patient
const isFirstVisitForPatient = (row) => {
  const rows = tableRows.value || []
  const patientRows = rows.filter(r => r.patientId === row.patientId)
  if (patientRows.length === 0) return true
  
  // Sort by encounter number to find the first visit
  const sortedRows = [...patientRows].sort((a, b) => a.encounterNum - b.encounterNum)
  return sortedRows[0].encounterNum === row.encounterNum
}

// Helper function to get observation count for a visit
const getObservationCount = async (encounterNum) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM OBSERVATION_FACT
      WHERE ENCOUNTER_NUM = ?
    `
    const result = await databaseStore.executeQuery(query, [encounterNum])
    return result.success && result.data.length > 0 ? result.data[0].count : 0
  } catch (error) {
    logger.warn('Failed to get observation count', error)
    return 0
  }
}

// Event handlers (using store functions) - with defensive checks
const onCellUpdate = dataGridStore?.handleCellUpdate || (() => {})
const onCellSave = dataGridStore?.handleCellSave || (() => {})
const onCellError = dataGridStore?.handleCellError || (() => {})

// Batch operations (using store functions) - with defensive checks
const refreshData = () => {
  if (dataGridStore?.refreshData) {
    dataGridStore.refreshData(props.patientIds)
  }
}

// View options management (delegate to store)
const updateViewOptions = dataGridStore.updateViewOptions

// Column management handlers - delegate to store
const handleColumnVisibilityUpdate = (...args) => {
  // Handle both individual updates (columnCode, visible) and batch updates (visibilityObject)
  if (args.length === 2 && typeof args[0] === 'string') {
    // Individual column update: (columnCode, visible)
    const [columnCode, visible] = args
    dataGridStore.updateColumnVisibility(columnCode, visible)
  } else if (args.length === 1 && typeof args[0] === 'object') {
    // Batch update: (visibilityObject)
    const visibilityObject = args[0]
    Object.entries(visibilityObject).forEach(([columnCode, visible]) => {
      dataGridStore.updateColumnVisibility(columnCode, visible)
    })

    // Batch updates completed silently
  }
}

const handleColumnOrderUpdate = (columnOrder) => {
  logger.info('Column order updated', { columnOrder })

  // Update the column order in the store
  if (dataGridStore?.updateColumnOrder) {
    dataGridStore.updateColumnOrder(columnOrder)
  }

  // Column order updated silently
}

// Visit edit dialog methods
const openVisitEditDialog = async (row) => {
  logger.info('Opening visit edit dialog', { patientId: row.patientId, encounterNum: row.encounterNum })

  try {
    // Load complete visit data from database (same pattern as visit-observation-store)
    const visitRepo = databaseStore.getRepository('visit')
    const patientRepo = databaseStore.getRepository('patient')

    // Get patient data
    const patient = await patientRepo.findByPatientCode(row.patientId)
    if (!patient) {
      throw new Error('Patient not found')
    }

    // Get visit data
    const visitData = await visitRepo.findById(row.encounterNum)
    if (!visitData) {
      throw new Error('Visit not found')
    }

    // Get observation count for the visit (for logging purposes)
    const observationCount = await getObservationCount(row.encounterNum)

    // Parse VISIT_BLOB to extract visitType and notes (same as visit-observation-store)
    let visitType = 'routine'
    let visitNotes = ''
    if (visitData.VISIT_BLOB) {
      try {
        const blobData = JSON.parse(visitData.VISIT_BLOB)
        visitType = blobData.visitType || 'routine'
        visitNotes = blobData.notes || ''
      } catch (error) {
        logger.warn('Failed to parse VISIT_BLOB', error, { visitBlob: visitData.VISIT_BLOB })
        visitNotes = visitData.VISIT_BLOB // Fallback to raw blob as notes
      }
    }

    // Log the loaded visit data for debugging
    logger.debug('Loaded visit data from database', {
      encounterNum: visitData.ENCOUNTER_NUM,
      startDate: visitData.START_DATE,
      endDate: visitData.END_DATE,
      status: visitData.ACTIVE_STATUS_CD,
      location: visitData.LOCATION_CD,
      inoutCd: visitData.INOUT_CD,
      sourceSystem: visitData.SOURCESYSTEM_CD,
      visitBlob: visitData.VISIT_BLOB,
      extractedVisitType: visitType,
      extractedNotes: visitNotes,
      observationCount: observationCount,
    })

    // Prepare data for the dialog (patient + visit structure that EditVisitDialog expects)
    selectedVisitData.value = {
      // Patient data
      PATIENT_CD: row.patientId,
      patientId: row.patientId,
      patientName: row.patientName,

      // Visit data structure that EditVisitDialog expects
      visit: {
        // Raw database fields that EditVisitDialog directly accesses
        ENCOUNTER_NUM: visitData.ENCOUNTER_NUM,
        START_DATE: visitData.START_DATE,
        END_DATE: visitData.END_DATE,
        UPDATE_DATE: visitData.UPDATE_DATE,
        ACTIVE_STATUS_CD: visitData.ACTIVE_STATUS_CD,
        LOCATION_CD: visitData.LOCATION_CD,
        INOUT_CD: visitData.INOUT_CD,
        SOURCESYSTEM_CD: visitData.SOURCESYSTEM_CD,
        VISIT_BLOB: visitData.VISIT_BLOB, // Raw JSON blob for EditVisitDialog to parse

        // Additional fields for compatibility
        encounterNum: visitData.ENCOUNTER_NUM,
        visitType: visitType,
        notes: visitNotes,
      },
    }

    showVisitEditDialog.value = true

    logger.debug('Prepared complete visit data for edit dialog', {
      encounterNum: row.encounterNum,
      visitType: visitType,
      visitNotes: visitNotes,
      hasVisitBlob: !!visitData.VISIT_BLOB,
      rawVisitBlob: visitData.VISIT_BLOB,
      status: visitData.ACTIVE_STATUS_CD,
      location: visitData.LOCATION_CD,
      startDate: visitData.START_DATE,
      endDate: visitData.END_DATE,
      inoutCd: visitData.INOUT_CD,
      sourceSystem: visitData.SOURCESYSTEM_CD,
      selectedVisitDataStructure: {
        hasVisitProperty: !!selectedVisitData.value.visit,
        visitKeys: selectedVisitData.value.visit ? Object.keys(selectedVisitData.value.visit) : null,
        patientKeys: Object.keys(selectedVisitData.value),
      },
    })
  } catch (error) {
    logger.error('Failed to load visit data for edit dialog', error, {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
    })

    notify.error(`Failed to load visit data: ${error.message}`)
  }
}

const handleVisitUpdated = (updatedVisit) => {
  logger.info('Visit updated successfully', { updatedVisit })

  // Refresh the data grid to show the updated visit information
  refreshData()

  notify.success(`Visit ${updatedVisit.ENCOUNTER_NUM} updated successfully`)
}

// Questionnaire fill dialog methods
const handleQuestionnaireCompleted = (completedData) => {
  logger.info('Questionnaire completed successfully', {
    patientId: completedData.patientId,
    encounterNum: completedData.encounterNum,
  })

  // Refresh the data grid to show the new questionnaire data
  refreshData()

  notify.success('Questionnaire completed and saved successfully', { timeout: 3000 })
}

const handleQuestionnaireClosed = () => {
  // Questionnaire dialog closed
  // No need to refresh data since nothing was saved
}

const findQuestionnaireNameInColumn = (conceptCode) => {
  try {
    // Look through all table rows to find a filled questionnaire for this concept
    const rows = tableRows.value || []

    for (const row of rows) {
      const cellValue = getCellValue(row, { code: conceptCode })
      if (cellValue && cellValue.trim() !== '') {
        logger.info('Found questionnaire name in column', {
          conceptCode,
          questionnaireName: cellValue,
          patientId: row.patientId,
          encounterNum: row.encounterNum,
        })
        return cellValue.trim()
      }
    }

    logger.info('No filled questionnaire found in column', { conceptCode })
    return null
  } catch (error) {
    logger.error('Failed to find questionnaire name in column', error, { conceptCode })
    return null
  }
}

const getAvailableQuestionnaires = async () => {
  try {
    const templateResult = await databaseStore.executeQuery(
      `SELECT NAME_CHAR, CODE_CD, LOOKUP_BLOB
       FROM CODE_LOOKUP
       WHERE TABLE_CD = 'SURVEY_BEST' 
       AND COLUMN_CD = 'QUESTIONNAIRE'
       AND LOOKUP_BLOB IS NOT NULL
       ORDER BY NAME_CHAR`,
      [],
    )

    if (templateResult.success) {
      return templateResult.data.map((t) => ({
        name: t.NAME_CHAR,
        code: t.CODE_CD,
        blob: t.LOOKUP_BLOB,
      }))
    }

    return []
  } catch (error) {
    logger.error('Failed to get available questionnaires', error)
    return []
  }
}

const getQuestionnaireTemplateByName = async (questionnaireName) => {
  try {
    logger.info('Getting questionnaire template by name', { questionnaireName })

    // Get clean template from CODE_LOOKUP table by name
    const templateResult = await databaseStore.executeQuery(
      `SELECT LOOKUP_BLOB, NAME_CHAR, CODE_CD
       FROM CODE_LOOKUP
       WHERE TABLE_CD = 'SURVEY_BEST' 
       AND COLUMN_CD = 'QUESTIONNAIRE'
       AND (NAME_CHAR = ? OR NAME_CHAR LIKE ?)
       AND LOOKUP_BLOB IS NOT NULL
       LIMIT 1`,
      [questionnaireName, `%${questionnaireName}%`],
    )

    if (templateResult.success && templateResult.data.length > 0) {
      const template = templateResult.data[0]

      try {
        const parsed = JSON.parse(template.LOOKUP_BLOB)
        logger.info('Found matching questionnaire template', {
          questionnaireName,
          foundName: template.NAME_CHAR,
          code: template.CODE_CD,
          title: parsed.title,
          itemCount: parsed.items?.length || 0,
          firstItemType: parsed.items?.[0]?.type,
        })
        return template.LOOKUP_BLOB
      } catch (parseError) {
        logger.error('Failed to parse template BLOB', { questionnaireName, error: parseError.message })
        return null
      }
    }

    logger.warn('No template found for questionnaire name', { questionnaireName })
    return null
  } catch (error) {
    logger.error('Failed to get questionnaire template by name', error, { questionnaireName })
    return null
  }
}

const createNewQuestionnaireColumn = async (questionnaireName, baseConceptCode) => {
  try {
    logger.info('Creating new questionnaire column', { questionnaireName, baseConceptCode })

    // Generate unique concept code for this questionnaire instance
    const timestamp = Date.now()
    const newConceptCode = `CUSTOM: ${baseConceptCode}_${questionnaireName.toUpperCase().replace(/\s+/g, '_')}_${timestamp}`

    // Create concept in CONCEPT_DIMENSION
    const conceptResult = await databaseStore.executeQuery(
      `INSERT INTO CONCEPT_DIMENSION (
        CONCEPT_CD, NAME_CHAR, CONCEPT_BLOB, UPDATE_DATE, DOWNLOAD_DATE, 
        IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID, VALTYPE_CD, CATEGORY_CHAR
      ) VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'), ?, ?, ?, ?)`,
      [
        newConceptCode,
        `${questionnaireName} - Instance`,
        JSON.stringify({
          questionnaireName: questionnaireName,
          baseConceptCode: baseConceptCode,
          createdAt: new Date().toISOString(),
        }),
        'SYSTEM',
        1,
        'Q',
        'CAT_ASSESSMENT',
      ],
    )

    if (!conceptResult.success) {
      throw new Error('Failed to create concept in database')
    }

    // Add concept to grid
    const newConcept = {
      CONCEPT_CD: newConceptCode,
      NAME_CHAR: `${questionnaireName} - Instance`,
      VALTYPE_CD: 'Q',
    }

    const addResult = dataGridStore.addConceptToGrid(newConcept)

    if (!addResult.success) {
      throw new Error('Failed to add concept to grid')
    }

    logger.info('New questionnaire column created successfully', {
      newConceptCode,
      questionnaireName,
      addResult,
    })

    return newConceptCode
  } catch (error) {
    logger.error('Failed to create new questionnaire column', error, {
      questionnaireName,
      baseConceptCode,
    })
    throw error
  }
}

const openQuestionnaireFillDialog = async (row, concept) => {
  logger.info('Opening questionnaire fill dialog', {
    patientId: row.patientId,
    encounterNum: row.encounterNum,
    conceptCode: concept.code,
    conceptName: concept.name,
  })

  try {
    // Step 1: Find what questionnaire name is used in this column
    let questionnaireName = findQuestionnaireNameInColumn(concept.code)
    let targetConceptCode = concept.code

    if (!questionnaireName) {
      // No existing questionnaire found - show selection dialog
      const availableQuestionnaires = await getAvailableQuestionnaires()

      if (availableQuestionnaires.length === 0) {
        notify.warning('No questionnaire templates available')
        return
      }

      // For now, use the first available questionnaire
      // TODO: In future, show selection dialog for user to choose
      questionnaireName = availableQuestionnaires[0].name

      // Create new column for this questionnaire type
      targetConceptCode = await createNewQuestionnaireColumn(questionnaireName, concept.code)

      logger.info('Created new questionnaire column', {
        questionnaireName,
        originalConceptCode: concept.code,
        newConceptCode: targetConceptCode,
      })
    }

    // Step 2: Get clean template for this questionnaire name from CODE_LOOKUP
    const questionnaireBlob = await getQuestionnaireTemplateByName(questionnaireName)

    if (!questionnaireBlob) {
      notify.warning(`No template found for questionnaire: ${questionnaireName}`)
      return
    }

    // Prepare data for the questionnaire fill dialog
    selectedQuestionnaireFillData.value = {
      encounterNum: row.encounterNum,
      patientId: row.patientId,
      questionnaireBlob: questionnaireBlob,
      conceptCode: targetConceptCode,
      conceptName: concept.name,
      questionnaireName: questionnaireName,
      patientName: row.patientName,
      visitDate: row.visitDate,
    }

    openDialog('questionnaireFill')

    logger.debug('Prepared questionnaire fill data', {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      originalConceptCode: concept.code,
      targetConceptCode: targetConceptCode,
      questionnaireName: questionnaireName,
      hasBlobData: !!questionnaireBlob,
      blobLength: questionnaireBlob?.length || 0,
    })
  } catch (error) {
    logger.error('Failed to open questionnaire fill dialog', error, {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      conceptCode: concept.code,
    })

    notify.error('Failed to open questionnaire dialog')
  }
}

// Questionnaire preview dialog methods
const openQuestionnairePreview = async (row, concept) => {
  logger.info('Opening questionnaire preview', {
    patientId: row.patientId,
    encounterNum: row.encounterNum,
    conceptCode: concept.code,
    conceptName: concept.name,
  })

  try {
    const observationId = getCellObservationId(row, concept)
    const cellValue = getCellValue(row, concept)

    if (!observationId) {
      logger.warn('No observation ID found for questionnaire cell', {
        patientId: row.patientId,
        encounterNum: row.encounterNum,
        conceptCode: concept.code,
      })
      notify.warning('No questionnaire data available for this cell')
      return
    }

    // Prepare data for the questionnaire preview dialog
    selectedQuestionnaireData.value = {
      observationId: observationId,
      conceptName: concept.name,
      completionDate: row.visitDate,
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      value: cellValue,
    }

    openDialog('questionnairePreview')

    logger.debug('Prepared questionnaire data for preview', {
      observationId: observationId,
      conceptName: concept.name,
      hasValue: !!cellValue,
    })
  } catch (error) {
    logger.error('Failed to open questionnaire preview', error, {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      conceptCode: concept.code,
    })

    notify.error('Failed to open questionnaire preview')
  }
}

// Add menu functions
const openAddObservationDialog = () => {
  openDialog('addObservation')
}

const openAddVisitDialog = () => {
  openDialog('addVisit')
}

const openAddPatientDialog = () => {
  openDialog('addPatient')
}

// Patient search is now handled by PatientSelectionCard component

// Select patient for visit creation
const selectPatientForVisit = (patient) => {
  selectedPatientForVisit.value = {
    id: patient.patientId,
    name: patient.patientName,
    patientId: patient.patientId,
    patientName: patient.patientName,
  }
  newVisitDate.value = new Date().toISOString().split('T')[0] // Reset to today
  closeDialog('addVisit')
  openDialog('newVisit')
}

// Quick-add visit from a placeholder row in the grid (patient has no visits yet)
const quickAddVisitForPatient = (row) => {
  selectPatientForVisit({ patientId: row.patientId, patientName: row.patientName })
}

// Create simple visit with just start date
const createSimpleVisit = async () => {
  if (!newVisitDate.value || !selectedPatientForVisit.value) return

  try {
    creatingVisit.value = true

    // Get patient from database
    const patientRepo = databaseStore.getRepository('patient')
    const patient = await patientRepo.findByPatientCode(selectedPatientForVisit.value.patientId)
    
    if (!patient) {
      throw new Error(t('visit.patientNotFound'))
    }

    // Create visit with minimal data
    const visitData = {
      PATIENT_NUM: patient.PATIENT_NUM,
      START_DATE: newVisitDate.value, // Just the date, no time
      ACTIVE_STATUS_CD: 'SCTID: 55561003', // Active (SNOMED-CT)
      INOUT_CD: 'O', // Outpatient by default
      LOCATION_CD: 'CLINIC',
      VISIT_BLOB: JSON.stringify({
        visitType: 'routine',
        createdBy: 'DATA_GRID_EDITOR',
        createdAt: new Date().toISOString(),
      }),
      SOURCESYSTEM_CD: 'DATA_GRID',
    }

    const createdVisit = await visitStore.createVisit(visitData)

    logger.info('Visit created successfully', { 
      encounterNum: createdVisit.ENCOUNTER_NUM,
      patientId: selectedPatientForVisit.value.patientId,
    })

    // Reset and close
    selectedPatientForVisit.value = null
    closeDialog('newVisit')
    newVisitDate.value = new Date().toISOString().split('T')[0]
    
    // Refresh grid data to show new visit
    await refreshData()
    
    notify.success(t('visit.visitCreated'))
  } catch (error) {
    logger.error('Failed to create visit', error)
    notify.error(t('visit.failedToCreateVisit'))
  } finally {
    creatingVisit.value = false
  }
}

// Handle patient selection from PatientSelectionCard
const handlePatientSelected = async (patient) => {
  // PatientSelectionCard emits patient with PATIENT_CD or PATIENT_NUM
  const patientId = patient.PATIENT_CD || patient.id
  if (!patientId) {
    logger.warn('Patient selected but no ID found', { patient })
    return
  }
  
  // Create patient object in expected format
  const patientForAdd = {
    PATIENT_CD: patientId,
    PATIENT_NUM: patient.PATIENT_NUM,
    NAME_CHAR: patient.NAME_CHAR || patient.name || patientId,
    ...patient,
  }
  
  await addPatientToGrid(patientForAdd)
  closeDialog('addPatient')
}

// Add patient to grid
const addPatientToGrid = async (patient) => {
  try {
    const patientId = patient.PATIENT_CD
    
    // Check if patient is already in grid
    if (props.patientIds.includes(patientId)) {
      notify.info(t('dataGrid.patientAlreadyInGrid', { name: patient.NAME_CHAR || patientId }))
      return
    }

    // Add patient to local settings
    const localSettings = useLocalSettingsStore()
    const currentPatients = localSettings.getDataGridSelectedPatients()
    const updatedPatients = [...currentPatients, patientId]
    localSettings.setDataGridSelectedPatients(updatedPatients)

    closeDialog('addPatient')
    
    // Refresh grid data with updated patient list
    if (dataGridStore?.refreshData) {
      await dataGridStore.refreshData(updatedPatients)
    }
    
    notify.success(t('dataGrid.patientAddedToGrid', { name: patient.NAME_CHAR || patientId }))
  } catch (error) {
    logger.error('Failed to add patient to grid', error)
    notify.error(t('dataGrid.failedToAddPatient'))
  }
}

// Handle concept added
const handleConceptAdded = (concept) => {
  logger.info('Concept added to grid', { concept })
  closeDialog('addObservation')
  
  // Refresh grid data to show new column
  refreshData()
  
  notify.success(t('dataGrid.columnAddedSuccessfully', { name: concept.name || concept.code }))
}

// Manage patient functions
const openManagePatientDialog = (row) => {
  selectedPatientForManagement.value = {
    patientId: row.patientId,
    patientName: row.patientName,
  }
  showManagePatientDialog.value = true
}

// Get all visits for the selected patient
const patientVisits = computed(() => {
  if (!selectedPatientForManagement.value) return []
  const allRows = dataGridStore?.tableRows || []
  return allRows
    .filter(row => row.patientId === selectedPatientForManagement.value.patientId)
    .map(row => ({
      encounterNum: row.encounterNum,
      visitDate: row.visitDate,
    }))
    .sort((a, b) => a.encounterNum - b.encounterNum)
})

// Check if a visit is hidden
const isVisitHidden = (encounterNum) => {
  return hiddenVisits.value.has(encounterNum)
}

// Toggle visit visibility
const toggleVisitVisibility = (encounterNum) => {
  if (hiddenVisits.value.has(encounterNum)) {
    hiddenVisits.value.delete(encounterNum)
  } else {
    hiddenVisits.value.add(encounterNum)
  }
  // Force reactivity update and save to localStorage
  hiddenVisits.value = new Set(hiddenVisits.value)
  saveHiddenVisits(hiddenVisits.value)
}

// Remove patient from grid
const removePatientFromGrid = async () => {
  if (!selectedPatientForManagement.value) return

  try {
    const localSettings = useLocalSettingsStore()
    const currentPatients = localSettings.getDataGridSelectedPatients()
    const updatedPatients = currentPatients.filter(id => id !== selectedPatientForManagement.value.patientId)
    localSettings.setDataGridSelectedPatients(updatedPatients)

    showManagePatientDialog.value = false

    // Refresh grid data with updated patient list
    if (dataGridStore?.refreshData) {
      await dataGridStore.refreshData(updatedPatients)
    }

    notify.success(t('dataGrid.patientRemovedFromGrid', { name: selectedPatientForManagement.value.patientName }))
  } catch (error) {
    logger.error('Failed to remove patient from grid', error)
    notify.error(t('dataGrid.failedToRemovePatient'))
  }
}

// Watch for view options changes (store handles persistence)
watch(
  () => dataGridStore.viewOptions,
  () => {
    // Store automatically handles persistence
  },
  { deep: true },
)

// Lifecycle
onMounted(async () => {
  // Load medication options
  await loadMedicationOptions()

  // Initialize stores
  if (dataGridStore?.initialize) {
    dataGridStore.initialize()
  }
  if (conceptStore?.initialize) {
    await conceptStore.initialize()
  }

  await loadPatientData()
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

  .zoom-controls {
    background: rgba($primary, 0.05);
    border-radius: 6px;
    padding: 4px;
    border: 1px solid rgba($primary, 0.1);

    .q-btn {
      margin: 0 2px;
      
      &:hover {
        background: rgba($primary, 0.1);
      }
    }
  }
}

.excel-table-container {
  flex: 1;
  overflow: hidden;
  background: white;
}

.excel-scroll-area {
  height: 100%;
  overflow: auto;
}

.excel-table-wrapper {
  display: inline-block;
  will-change: transform;
  
  // Ensure proper scaling and maintain table structure
  .excel-table {
    transform-origin: top left;
  }
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
      padding: 8px 6px;
      border: 1px solid $grey-4;
      border-top: none;
      font-weight: 600;
      text-align: center;
      background: $grey-2;
      position: relative;
      height: 60px;
      vertical-align: middle;

      &.fixed-col {
        position: sticky;
        left: 0;
        z-index: 11;
        background: $grey-3;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
        text-align: left; // Override center alignment for fixed column headers
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
        text-align: center; // Center align visit date header
      }

      &.obs-col {
        width: 150px;
        min-width: 150px;

        // Specific widths for different value types
        &.value-type-d {
          width: 120px; // Date columns: -30px
          min-width: 120px;
        }

        &.value-type-n {
          width: 100px; // Numeric columns: -50px
          min-width: 100px;
        }

        &.value-type-m {
          width: 120px; // Medication columns
          min-width: 120px;
        }

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
      padding: 4px 6px;
      border: 1px solid $grey-4;
      border-top: none;
      vertical-align: middle;
      text-align: center;
      height: 40px;

      &.fixed-col {
        position: sticky;
        background: white;
        z-index: 5;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
        text-align: left; // Override center alignment for fixed columns

        &.patient-col {
          left: 0;
        }

        &.visit-col {
          left: 200px;
          text-align: center; // Center align visit date
        }
      }

      &.obs-cell {
        width: 150px;
        min-width: 150px;
        padding: 2px;
        text-align: center;
        vertical-align: middle;

        // Specific widths for different value types
        &.value-type-d {
          width: 120px; // Date cells: -30px
          min-width: 120px;
        }

        &.value-type-n {
          width: 100px; // Numeric cells: -50px
          min-width: 100px;
        }

        // Expand cell when editing text
        :deep(.editable-cell.is-editing) {
          min-width: 200px;
          
          .cell-edit {
            min-width: 200px;
          }
        }

        // Override EditableCell alignment for all value types
        :deep(.editable-cell) {
          text-align: center !important;

          &.value-type-n {
            text-align: center !important; // Override right alignment for numeric values
          }

          .cell-display {
            justify-content: center;
            text-align: center;

            .cell-value {
              text-align: center;
            }
          }

          .cell-edit {
            .cell-input {
              :deep(.q-field__native) {
                text-align: center !important;
              }

              :deep(input) {
                text-align: center !important;
              }
            }
          }
        }

        &.has-value {
          background: white;
        }

        &.empty-cell {
          background: $grey-1;
        }

        // Medication cell styling
        .medication-cell {
          width: 120px;
          max-width: 120px;
          min-width: 120px;
          height: 100%;
          padding: 2px;
          overflow: hidden;
          
          .medication-display-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            width: 100%;
            height: 100%;
            position: relative;
            
            :deep(.medication-view) {
              flex: 1;
              min-width: 0;
              overflow: hidden;
              
              .filled-medication-item {
                max-width: 100%;
                overflow: hidden;
                padding: 2px 4px;
                
                .medication-text {
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  font-size: 0.85rem;
                }
              }
              
              .empty-medication {
                padding: 4px;
              }
            }
            
            .medication-count-badge {
              flex-shrink: 0;
              font-size: 0.7rem;
              padding: 2px 6px;
              height: 20px;
              cursor: pointer;
              
              &:hover {
                transform: scale(1.05);
              }
            }
            
            .medication-empty {
              cursor: pointer;
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: 100%;
              
              .add-icon {
                transition: all 0.2s ease;
              }
              
              &:hover .add-icon {
                color: $primary;
                transform: scale(1.1);
              }
            }
          }
        }
        
        // Medication cell with value type class (match header width: 120px)
        &.value-type-m {
          width: 120px;
          max-width: 120px;
          min-width: 120px;
          text-align: center;
          vertical-align: middle;
        }
        
        // Icon-only display for medications
        &.medication-icon-display {
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          vertical-align: middle;
          
          &:hover {
            background: rgba($primary, 0.08);
          }
          
          .medication-icon-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            width: 100%;
            height: 100%;
            min-height: 40px;
            
            .q-icon {
              transition: all 0.2s ease;
            }
            
            .medication-count-text {
              font-size: 0.9rem;
              font-weight: 600;
              color: $primary;
              transition: all 0.2s ease;
            }
          }
          
          &:hover .q-icon,
          &:hover .medication-count-text {
            transform: scale(1.1);
          }
        }

        // Questionnaire cell styling
        .questionnaire-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          height: 100%;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.2s ease;

          &:hover {
            background: rgba($primary, 0.08);
          }

          .questionnaire-content {
            font-size: 0.7rem;
            line-height: 1.3;
            max-height: 2.6em; // 2 lines with line-height 1.3
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: normal;
            word-wrap: break-word;
            max-width: 150px;
            text-align: center;
            color: $grey-8;
            cursor: pointer;
            
            &:hover {
              color: $primary;
            }
          }

          .questionnaire-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            cursor: pointer;
            color: $grey-5;

            &:hover {
              color: $primary;
            }

            .empty-label {
              font-size: 0.65rem;
              font-weight: 400;
              text-align: center;
              line-height: 1.1;
            }
          }
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

  .avatar-placeholder {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .patient-avatar-clickable {
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.8;
    }
  }
}

// Style for subsequent visits (not the first visit for a patient)
.patient-col.subsequent-visit {
  opacity: 0.5;

  .patient-info {
    .patient-name,
    .patient-id {
      opacity: 0.5;
    }
  }
}

.visit-date-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  cursor: help;
  height: 100%;

  &:hover .visit-edit-icon {
    opacity: 1;
    visibility: visible;
  }

  &.visit-placeholder {
    cursor: default;
    background: rgba(25, 118, 210, 0.04);
  }
}

.obs-cell-placeholder {
  background: rgba(0, 0, 0, 0.02);
  cursor: not-allowed;
}

.obs-placeholder {
  text-align: center;
  color: $grey-5;
  font-size: 0.9rem;
  user-select: none;
}

.visit-date {
  font-size: 0.8rem;
  color: $grey-8;
  text-align: center;
  line-height: 1.2;
}

.visit-edit-icon {
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  position: absolute;
  top: 2px;
  right: 2px;

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
