<template>
  <div>
    <!-- Toolbar -->
    <div class="q-mb-md">
      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-gutter-md">
            <!-- Filter Controls - only show when there are observations or visits -->
            <template v-if="hasObservationsOrVisits">
              <div class="col-auto">
                <q-input v-model="filterText" outlined dense placeholder="Filter observations..." clearable style="min-width: 200px">
                  <template v-slot:prepend>
                    <q-icon name="search" />
                  </template>
                </q-input>
              </div>

              <div class="col-auto">
                <q-select v-model="filterCategory" :options="categoryOptions" outlined dense clearable label="Category" emit-value map-options style="min-width: 150px" />
              </div>

              <div class="col-auto">
                <q-select v-model="filterValueType" :options="valueTypeOptions" outlined dense clearable label="Value Type" emit-value map-options style="min-width: 120px" />
              </div>
            </template>

            <q-space />

            <!-- Visit Controls - always show -->
            <div class="col-auto">
              <q-btn flat dense icon="add" size="md" @click="showCreateVisitDialog = true" class="create-visit-btn" color="primary">
                <q-tooltip>Create new visit</q-tooltip>
              </q-btn>

              <q-btn v-if="hasObservationsOrVisits" flat dense :icon="toggleIcon" size="md" @click="toggleAllVisits" class="toggle-visits-btn q-ml-sm">
                <q-tooltip>{{ toggleTooltip }}</q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- No Data State -->
    <div v-if="!hasObservationsOrVisits" class="text-center q-py-xl">
      <q-icon name="science_off" size="64px" color="grey-5" />
      <div class="text-h6 text-grey-6 q-mt-md">No visits or observations found</div>
      <div class="text-body2 text-grey-6 q-mb-md">This patient has no recorded visits or observations yet.</div>
      <q-btn color="primary" icon="add" label="Create First Visit" @click="showCreateVisitDialog = true" unelevated>
        <q-tooltip>Create a new visit to start recording observations</q-tooltip>
      </q-btn>
    </div>

    <!-- Visits and Observations Display -->
    <div v-else-if="hasObservationsOrVisits">
      <div v-for="visitGroup in filteredVisitGroups" :key="visitGroup.encounterNum" class="visit-section q-mb-lg">
        <!-- Visit Header -->
        <VisitHeader :visit-group="visitGroup" :patient="patient" :is-expanded="isVisitExpanded(visitGroup.encounterNum)" @toggle-expansion="toggleVisitExpansion" @visit-updated="onVisitUpdated" />

        <!-- Observations Table for this Visit -->
        <q-slide-transition>
          <div v-show="isVisitExpanded(visitGroup.encounterNum)" class="observations-container">
            <div v-if="visitGroup.observations.length === 0" class="text-center q-py-lg">
              <q-icon name="science_off" size="48px" color="grey-4" />
              <div class="text-body2 text-grey-6 q-mt-sm">No observations recorded for this visit</div>
              <div class="text-caption text-grey-5">
                Visit from {{ formatDate(visitGroup.visitDate) }}
                <span v-if="visitGroup.endDate"> to {{ formatDate(visitGroup.endDate) }}</span>
              </div>
            </div>

            <ObservationsTable
              v-else
              :table-rows="getVisitTableRows(visitGroup)"
              :loading="loading"
              :visit="visitGroup.visit"
              :patient="patient"
              :frequency-options="frequencyOptions"
              :route-options="routeOptions"
              :field-set-concepts="allConcepts"
              @enter-medication-edit-mode="enterMedicationEditMode"
              @value-changed="onValueChanged"
              @save-requested="onSaveRequested"
              @save-row="saveRow"
              @cancel-changes="cancelChanges"
              @remove-row="removeRow"
              @clone-from-previous="cloneFromPrevious"
            />
          </div>
        </q-slide-transition>
      </div>
    </div>

    <!-- Create Visit Dialog -->
    <NewVisitDialog v-model="showCreateVisitDialog" :patient="patient" @created="onVisitCreated" />

    <!-- Medication Edit Dialog -->
    <MedicationEditDialog
      v-model="showMedicationEditDialog"
      :medication-data="editingMedicationRow ? parseMedicationData(editingMedicationRow) : {}"
      :frequency-options="frequencyOptions"
      :route-options="routeOptions"
      @save="onMedicationEditSave"
      @cancel="onMedicationEditCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import NewVisitDialog from '../visits/NewVisitDialog.vue'
import ObservationsTable from '../visits/ObservationsTable.vue'
import MedicationEditDialog from '../visits/MedicationEditDialog.vue'
import VisitHeader from './VisitHeader.vue'

// Note: This component now relies on the patient being already selected in the visitObservationStore
const emit = defineEmits(['updated'])

const $q = useQuasar()
const conceptStore = useConceptResolutionStore()
const localSettingsStore = useLocalSettingsStore()
const globalSettingsStore = useGlobalSettingsStore()
const visitObservationStore = useVisitObservationStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('PatientObservationsTab')

// Reactive state
const filterText = ref('')
const filterCategory = ref(null)
const filterValueType = ref(null)

// Visit expansion state
const expandedVisits = ref(new Set())

// Dialog state
const showCreateVisitDialog = ref(false)
const showMedicationEditDialog = ref(false)
const editingMedicationRow = ref(null)

// Loading state
const loading = ref(false)

// Track pending changes per row
const pendingChanges = ref(new Map())

// Frequency and route options for medications
const frequencyOptions = [
  { label: 'Once daily (QD)', value: 'QD' },
  { label: 'Twice daily (BID)', value: 'BID' },
  { label: 'Three times daily (TID)', value: 'TID' },
  { label: 'Four times daily (QID)', value: 'QID' },
  { label: 'Every 4 hours (Q4H)', value: 'Q4H' },
  { label: 'Every 6 hours (Q6H)', value: 'Q6H' },
  { label: 'Every 8 hours (Q8H)', value: 'Q8H' },
  { label: 'Every 12 hours (Q12H)', value: 'Q12H' },
  { label: 'As needed (PRN)', value: 'PRN' },
  { label: 'At bedtime (QHS)', value: 'QHS' },
  { label: 'Before meals (AC)', value: 'AC' },
  { label: 'After meals (PC)', value: 'PC' },
]

const routeOptions = [
  { label: 'Oral (PO)', value: 'PO' },
  { label: 'Intravenous (IV)', value: 'IV' },
  { label: 'Intramuscular (IM)', value: 'IM' },
  { label: 'Subcutaneous (SC)', value: 'SC' },
  { label: 'Topical', value: 'TOP' },
  { label: 'Inhalation (INH)', value: 'INH' },
  { label: 'Nasal', value: 'NAS' },
  { label: 'Rectal (PR)', value: 'PR' },
  { label: 'Sublingual (SL)', value: 'SL' },
]

// Computed properties from store
const patient = computed(() => visitObservationStore.selectedPatient)
const observations = computed(() => visitObservationStore.allObservations)
const visits = computed(() => visitObservationStore.visits)

const hasObservationsOrVisits = computed(() => {
  const hasObservations = observations.value && observations.value.length > 0
  const hasVisits = visits.value && visits.value.length > 0
  return hasObservations || hasVisits
})

// Group visits with their observations
const groupedObservations = computed(() => {
  // Start with all visits as the base
  const groups = visits.value.map((visit) => ({
    encounterNum: visit.id,
    visitDate: visit.date,
    endDate: visit.endDate,
    visit: {
      ENCOUNTER_NUM: visit.id,
      START_DATE: visit.date,
      END_DATE: visit.endDate,
      UPDATE_DATE: visit.last_changed,
      ACTIVE_STATUS_CD: visit.status,
      LOCATION_CD: visit.location,
      INOUT_CD: visit.inout || 'O',
      SOURCESYSTEM_CD: visit.rawData?.SOURCESYSTEM_CD || 'SYSTEM',
      VISIT_BLOB: visit.rawData?.VISIT_BLOB,
      // Include parsed fields for EditVisitDialog
      visitType: visit.visitType,
      notes: visit.notes,
      id: visit.id, // Add id for ObservationFieldSet
    },
    observations: [],
  }))

  // Add observations to their respective visits
  observations.value.forEach((obs) => {
    const group = groups.find((g) => g.encounterNum === obs.encounterNum)
    if (group) {
      // Map observation to expected format for ObservationFieldSet
      group.observations.push({
        observationId: obs.observationId,
        conceptCode: obs.conceptCode,
        conceptName: obs.conceptName,
        valueType: obs.valueType,
        valTypeCode: obs.valueType,
        originalValue: obs.originalValue,
        value: obs.originalValue,
        tval_char: obs.originalValue,
        TVAL_CHAR: obs.originalValue,
        nval_num: obs.valueType === 'N' ? obs.originalValue : null,
        NVAL_NUM: obs.valueType === 'N' ? obs.originalValue : null,
        observation_blob: obs.rawData?.OBSERVATION_BLOB,
        OBSERVATION_BLOB: obs.rawData?.OBSERVATION_BLOB,
        resolvedValue: obs.resolvedValue,
        unit: obs.unit,
        category: obs.category,
        CATEGORY_CHAR: obs.category,
        date: obs.date,
        START_DATE: obs.date,
        encounterNum: obs.encounterNum,
        ENCOUNTER_NUM: obs.encounterNum,
      })
    }
  })

  // Sort groups by visit start date (most recent first)
  return groups.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate))
})

// Apply filters to visit groups
const filteredVisitGroups = computed(() => {
  let filtered = [...groupedObservations.value]

  // Apply text filter across all observations in visits
  if (filterText.value) {
    const searchTerm = filterText.value.toLowerCase()
    filtered = filtered.filter((visitGroup) => {
      // Check visit-level data
      const visitMatch =
        (visitGroup.visit?.visitType && visitGroup.visit.visitType.toLowerCase().includes(searchTerm)) ||
        (visitGroup.visit?.notes && visitGroup.visit.notes.toLowerCase().includes(searchTerm)) ||
        (visitGroup.visit?.LOCATION_CD && visitGroup.visit.LOCATION_CD.toLowerCase().includes(searchTerm))

      // Check observation-level data
      const obsMatch = visitGroup.observations.some(
        (obs) =>
          (obs.conceptName && obs.conceptName.toLowerCase().includes(searchTerm)) ||
          (obs.conceptCode && obs.conceptCode.toLowerCase().includes(searchTerm)) ||
          (obs.originalValue && String(obs.originalValue).toLowerCase().includes(searchTerm)) ||
          (obs.category && obs.category.toLowerCase().includes(searchTerm)),
      )

      return visitMatch || obsMatch
    })
  }

  // Apply category filter
  if (filterCategory.value) {
    filtered = filtered.map((visitGroup) => ({
      ...visitGroup,
      observations: visitGroup.observations.filter((obs) => obs.category === filterCategory.value),
    }))
  }

  // Apply value type filter
  if (filterValueType.value) {
    filtered = filtered.map((visitGroup) => ({
      ...visitGroup,
      observations: visitGroup.observations.filter((obs) => {
        if (filterValueType.value === 'numeric') {
          return obs.nval_num !== null && obs.nval_num !== undefined
        } else if (filterValueType.value === 'text') {
          return obs.tval_char && obs.tval_char.trim() !== ''
        } else if (filterValueType.value === 'empty') {
          return !obs.nval_num && (!obs.tval_char || obs.tval_char.trim() === '')
        } else {
          return obs.valueType === filterValueType.value
        }
      }),
    }))
  }

  return filtered
})

// Category filter options
const categoryOptions = computed(() => {
  const categories = [...new Set(observations.value.map((obs) => obs.category).filter(Boolean))]
  return categories.map((cat) => ({ label: cat, value: cat }))
})

// Dynamic value type options from global settings store
const valueTypeOptions = ref([])

// Load value type options from store
const loadValueTypeOptions = async () => {
  try {
    // Get value types from the global settings store
    const storeOptions = await globalSettingsStore.getValueTypeOptions()

    // Combine store options with useful data type filters
    valueTypeOptions.value = [
      ...storeOptions,
      { label: '--- Data Types ---', value: '', disable: true },
      { label: 'Has Numeric Values', value: 'numeric' },
      { label: 'Has Text Values', value: 'text' },
      { label: 'Empty Values', value: 'empty' },
    ]
  } catch (error) {
    logger.error('Failed to load value type options', error, {
      action: 'loadValueTypeOptions',
      fallbackUsed: true,
    })
    // Fallback to basic options if store fails
    valueTypeOptions.value = [
      { label: 'Answer (A)', value: 'A' },
      { label: 'Date (D)', value: 'D' },
      { label: 'Finding (F)', value: 'F' },
      { label: 'Numeric (N)', value: 'N' },
      { label: 'Questionnaire (Q)', value: 'Q' },
      { label: 'Raw Text (R)', value: 'R' },
      { label: 'Selection (S)', value: 'S' },
      { label: 'Text (T)', value: 'T' },
      { label: '--- Data Types ---', value: '', disable: true },
      { label: 'Has Numeric Values', value: 'numeric' },
      { label: 'Has Text Values', value: 'text' },
      { label: 'Empty Values', value: 'empty' },
    ]
  }
}

// All concepts for the table (empty array as we don't need field set concepts)
const allConcepts = computed(() => [])

// Initialize component
onMounted(async () => {
  // Initialize stores
  await conceptStore.initialize()
  await localSettingsStore.initialize()
  await globalSettingsStore.initialize()

  // Load value type options
  await loadValueTypeOptions()

  // Preload concepts from current observations
  if (observations.value && observations.value.length > 0) {
    await preloadObservationConcepts()
  }
})

// Watch for changes in observations and preload new concepts
watch(
  observations,
  async (newObservations) => {
    if (newObservations && newObservations.length > 0) {
      await preloadObservationConcepts()
    }
  },
  { deep: true },
)

// Preload all unique concepts from observations
const preloadObservationConcepts = async () => {
  const conceptsToResolve = new Set()

  observations.value.forEach((obs) => {
    // Add concept codes that might need resolution (only strings)
    if (obs.conceptCode && !obs.conceptName && typeof obs.conceptCode === 'string') {
      conceptsToResolve.add(obs.conceptCode)
    }
    // Only add text values for resolution, not numeric values
    if (obs.originalValue && !obs.resolvedValue && typeof obs.originalValue === 'string' && isNaN(obs.originalValue)) {
      conceptsToResolve.add(obs.originalValue)
    }
    if (obs.unit && !obs.unitResolved && typeof obs.unit === 'string') {
      conceptsToResolve.add(obs.unit)
    }
  })

  if (conceptsToResolve.size > 0) {
    await conceptStore.resolveBatch([...conceptsToResolve], { context: 'patient_observations' })
  }
}

// Visit expansion methods
const toggleVisitExpansion = (encounterNum) => {
  const newExpanded = new Set(expandedVisits.value)
  if (newExpanded.has(encounterNum)) {
    newExpanded.delete(encounterNum)
  } else {
    newExpanded.add(encounterNum)
  }
  expandedVisits.value = newExpanded
}

const isVisitExpanded = (encounterNum) => {
  return expandedVisits.value.has(encounterNum)
}

const expandAllVisits = () => {
  // Only expand visits that have observations
  const encountersWithObservations = new Set(filteredVisitGroups.value.filter((group) => group.observations.length > 0).map((group) => group.encounterNum))
  expandedVisits.value = encountersWithObservations
}

const collapseAllVisits = () => {
  expandedVisits.value = new Set()
}

// Smart toggle functionality
const hasExpandedVisits = computed(() => {
  return expandedVisits.value.size > 0
})

const toggleIcon = computed(() => {
  return hasExpandedVisits.value ? 'expand_less' : 'expand_more'
})

const toggleTooltip = computed(() => {
  return hasExpandedVisits.value ? 'Collapse all expanded visits' : 'Expand all visits with observations'
})

const toggleAllVisits = () => {
  if (hasExpandedVisits.value) {
    collapseAllVisits()
  } else {
    expandAllVisits()
  }
}

// Table methods
const getVisitTableRows = (visitGroup) => {
  const rows = []

  // Process all observations for this visit
  visitGroup.observations.forEach((observation) => {
    const rowId = `obs_${observation.observationId}`
    const actualValue = extractObservationValue(observation)
    const pendingValue = pendingChanges.value.get(rowId)

    rows.push({
      id: rowId,
      observationId: observation.observationId,
      conceptCode: observation.conceptCode,
      conceptName: observation.conceptName,
      resolvedName: observation.conceptName, // Already resolved in store
      valueType: observation.valueType,
      // Use consistent origVal/currentVal pattern
      origVal: actualValue,
      currentVal: pendingValue !== undefined ? pendingValue : actualValue,
      unit: observation.unit,
      category: observation.category,
      hasChanges: pendingValue !== undefined && pendingValue !== actualValue,
      saving: false,
      previousValue: null, // Could implement previous value lookup
      displayValue: formatDisplayValue(observation),
      isMedication: observation.valueType === 'M' || observation.conceptCode?.includes('52418'),
      // Store raw observation for complete data access
      rawObservation: observation,
    })
  })

  return rows.sort((a, b) => {
    // Sort by category first, then by concept name
    const categoryA = a.category || 'ZZZZZ'
    const categoryB = b.category || 'ZZZZZ'
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB)
    }
    return a.conceptName.localeCompare(b.conceptName)
  })
}

// Extract the actual value from observation data
const extractObservationValue = (observation) => {
  const valType = observation.valueType || 'T'

  switch (valType) {
    case 'N': { // Numeric
      const numericValue = observation.nval_num
      if (numericValue !== null && numericValue !== undefined) {
        return numericValue
      }
      return observation.tval_char || observation.originalValue || ''
    }
    case 'M': // Medication
      return observation.observation_blob || observation.tval_char || observation.originalValue || ''
    case 'R': // Raw data/File
      return observation.observation_blob || observation.originalValue || ''
    default: // Text and others
      return observation.tval_char || observation.originalValue || ''
  }
}

const formatDisplayValue = (observation) => {
  switch (observation.valueType) {
    case 'S': // Selection
    case 'F': // Finding
    case 'A': // Array/Multiple choice
      return observation.resolvedValue || observation.originalValue || 'No value'
    case 'Q': // Questionnaire
      return observation.originalValue || 'Questionnaire'
    case 'R': // Raw data/File
      try {
        if (observation.originalValue) {
          const fileInfo = JSON.parse(observation.originalValue)
          return fileInfo.filename || 'File attached'
        }
      } catch {
        return 'Invalid file data'
      }
      break
    case 'N': // Numeric
      return observation.originalValue?.toString() || 'No value'
    case 'M': // Medication
      return observation.originalValue || 'No medication specified'
    default: // Text and others
      return observation.originalValue || 'No value'
  }
}


// Utility methods
const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

// Table event handlers
const enterMedicationEditMode = (row) => {
  logger.debug('Enter medication edit mode', { rowId: row.id })
  editingMedicationRow.value = row
  showMedicationEditDialog.value = true
}

const onValueChanged = (rowData, newValue) => {
  // Store the pending change in our map
  pendingChanges.value.set(rowData.id, newValue)
  logger.debug('Value changed for row', {
    rowId: rowData.id,
    conceptCode: rowData.conceptCode,
    origVal: rowData.origVal,
    newValue,
    hasChanges: newValue !== rowData.origVal,
  })
}

const onSaveRequested = async (rowData) => {
  await saveRow(rowData)
}

const saveRow = async (row) => {
  try {
    row.saving = true
    logger.info('Saving row', {
      rowId: row.id,
      conceptCode: row.conceptCode,
      valueType: row.valueType,
      origVal: row.origVal,
      currentVal: row.currentVal,
    })

    if (row.isMedication) {
      // Handle medication updates
      const medicationData = parseMedicationData(row)
      const updateData = {
        TVAL_CHAR: medicationData.drugName,
        NVAL_NUM: medicationData.dosage ? parseFloat(medicationData.dosage) : null,
        OBSERVATION_BLOB: JSON.stringify(medicationData),
      }
      await visitObservationStore.updateObservation(row.observationId, updateData, { skipReload: true })
    } else {
      // Handle regular observation updates based on value type
      const updateData = {}
      switch (row.valueType) {
        case 'N': // Numeric
          updateData.NVAL_NUM = parseFloat(row.currentVal)
          updateData.TVAL_CHAR = null
          updateData.OBSERVATION_BLOB = null
          break
        case 'S': // Selection
        case 'F': // Finding
        case 'A': // Array/Multiple choice
          updateData.TVAL_CHAR = String(row.currentVal)
          updateData.NVAL_NUM = null
          updateData.OBSERVATION_BLOB = null
          break
        case 'R': // Raw data/File
          updateData.OBSERVATION_BLOB = row.currentVal
          updateData.TVAL_CHAR = null
          updateData.NVAL_NUM = null
          break
        case 'T': // Text
        default:
          updateData.TVAL_CHAR = String(row.currentVal)
          updateData.NVAL_NUM = null
          updateData.OBSERVATION_BLOB = null
          break
      }
      await visitObservationStore.updateObservation(row.observationId, updateData, { skipReload: true })
    }

    // Update local state immediately - no need to wait for refresh
    pendingChanges.value.delete(row.id)

    // Update the store's observation data directly to reflect the save
    // This prevents the computed properties from reverting to old values
    const storeObservation = observations.value.find(obs => obs.observationId === row.observationId)
    if (storeObservation) {
      switch (row.valueType) {
        case 'N': {
          const numericValue = parseFloat(row.currentVal)
          storeObservation.originalValue = numericValue
          storeObservation.value = numericValue
          // Update rawData if it exists
          if (storeObservation.rawData) {
            storeObservation.rawData.NVAL_NUM = numericValue
            storeObservation.rawData.TVAL_CHAR = null
            storeObservation.rawData.OBSERVATION_BLOB = null
          }
          break
        }
        case 'M': {
          // For medications, update with drug name only
          const medicationData = parseMedicationData(row)
          storeObservation.originalValue = medicationData.drugName
          storeObservation.value = medicationData.drugName
          // Update rawData if it exists
          if (storeObservation.rawData) {
            storeObservation.rawData.TVAL_CHAR = medicationData.drugName
            storeObservation.rawData.NVAL_NUM = medicationData.dosage ? parseFloat(medicationData.dosage) : null
            storeObservation.rawData.OBSERVATION_BLOB = JSON.stringify(medicationData)
          }
          break
        }
        default:
          storeObservation.originalValue = row.currentVal
          storeObservation.value = row.currentVal
          // Update rawData if it exists
          if (storeObservation.rawData) {
            storeObservation.rawData.TVAL_CHAR = String(row.currentVal)
            storeObservation.rawData.NVAL_NUM = null
            storeObservation.rawData.OBSERVATION_BLOB = null
          }
          break
      }
    }

    // Also update the raw observation in the row for immediate UI feedback
    if (row.rawObservation) {
      switch (row.valueType) {
        case 'N': {
          const numericValue = parseFloat(row.currentVal)
          row.rawObservation.originalValue = numericValue
          row.rawObservation.value = numericValue
          break
        }
        case 'M': {
          const medicationData = parseMedicationData(row)
          row.rawObservation.originalValue = medicationData.drugName
          row.rawObservation.value = medicationData.drugName
          break
        }
        default:
          row.rawObservation.originalValue = row.currentVal
          row.rawObservation.value = row.currentVal
          break
      }
    }

    $q.notify({
      type: 'positive',
      message: 'Observation saved successfully',
      position: 'top',
    })

    logger.success('Row saved successfully', { rowId: row.id })
    emit('updated')
  } catch (error) {
    logger.error('Failed to save row', error, { rowId: row.id })
    $q.notify({
      type: 'negative',
      message: 'Failed to save observation',
      position: 'top',
    })
  } finally {
    row.saving = false
  }
}

const cancelChanges = (row) => {
  logger.debug('Cancelling changes for row', {
    rowId: row.id,
    conceptCode: row.conceptCode,
    origVal: row.origVal,
    currentVal: row.currentVal,
  })
  pendingChanges.value.delete(row.id)
}

const removeRow = async (row) => {
  try {
    row.saving = true
    logger.info('Removing row', { rowId: row.id, conceptCode: row.conceptCode })

    await visitObservationStore.deleteObservation(row.observationId)

    $q.notify({
      type: 'positive',
      message: 'Observation removed successfully',
      position: 'top',
    })

    logger.success('Row removed successfully', { rowId: row.id })
    emit('updated')
  } catch (error) {
    logger.error('Failed to remove row', error, { rowId: row.id })
    $q.notify({
      type: 'negative',
      message: 'Failed to remove observation',
      position: 'top',
    })
  } finally {
    row.saving = false
  }
}

const cloneFromPrevious = (row) => {
  if (row.previousValue) {
    pendingChanges.value.set(row.id, row.previousValue.value)
    logger.info('Cloned value from previous visit', {
      rowId: row.id,
      conceptCode: row.conceptCode,
      clonedValue: row.previousValue.value,
    })
  }
}

// Parse medication data from observation row
const parseMedicationData = (row) => {
  try {
    // Try to parse OBSERVATION_BLOB first
    if (row.rawObservation?.observation_blob) {
      try {
        const parsed = JSON.parse(row.rawObservation.observation_blob)
        return {
          drugName: parsed.drugName || '',
          dosage: parsed.dosage || null,
          dosageUnit: parsed.dosageUnit || 'mg',
          frequency: parsed.frequency || '',
          route: parsed.route || '',
          instructions: parsed.instructions || '',
        }
      } catch (parseError) {
        logger.warn('Failed to parse BLOB JSON', parseError)
      }
    }

    // Fallback to basic data
    const drugName = row.rawObservation?.tval_char || row.origVal || row.currentVal || ''
    return {
      drugName: drugName.trim(),
      dosage: row.rawObservation?.nval_num || 100,
      dosageUnit: 'mg',
      frequency: 'BID',
      route: 'PO',
      instructions: '',
    }
  } catch (error) {
    logger.error('Failed to parse medication data', error, { rowId: row.id })
    return {
      drugName: row.origVal || row.currentVal || '',
      dosage: null,
      dosageUnit: 'mg',
      frequency: '',
      route: '',
      instructions: '',
    }
  }
}

// Medication dialog handlers
const onMedicationEditSave = async (medicationData) => {
  if (!editingMedicationRow.value) return

  try {
    const row = editingMedicationRow.value
    logger.debug('Saving medication edit', { rowId: row.id, medicationData })

    const normalizedMedicationData = {
      drugName: medicationData.drugName || '',
      dosage: medicationData.dosage || null,
      dosageUnit: medicationData.dosageUnit || 'mg',
      frequency: typeof medicationData.frequency === 'object' ? medicationData.frequency?.value : medicationData.frequency || '',
      route: typeof medicationData.route === 'object' ? medicationData.route?.value : medicationData.route || '',
      instructions: medicationData.instructions || '',
    }

    const updateData = {
      TVAL_CHAR: normalizedMedicationData.drugName,
      NVAL_NUM: medicationData.dosage ? parseFloat(medicationData.dosage) : null,
      OBSERVATION_BLOB: JSON.stringify(normalizedMedicationData),
    }

    await visitObservationStore.updateObservation(row.observationId, updateData, { skipReload: true })

    // Clear pending changes
    pendingChanges.value.delete(row.id)

    emit('updated')
    logger.success('Medication updated successfully', { rowId: row.id })
  } catch (error) {
    logger.error('Failed to save medication edit', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save medication',
      position: 'top',
    })
  }
}

const onMedicationEditCancel = () => {
  editingMedicationRow.value = null
}


const onVisitUpdated = async () => {
  // Reload visits and observations from store
  if (patient.value) {
    await visitObservationStore.loadVisitsForPatient(patient.value)
  }
  emit('updated')
}

// Event handler for visit creation
const onVisitCreated = async (createdVisit) => {
  // The store should handle the visit creation, but we may need to select it
  if (createdVisit && createdVisit.id) {
    await visitObservationStore.setSelectedVisit(createdVisit)

    // Expand the new visit
    const newExpanded = new Set(expandedVisits.value)
    newExpanded.add(createdVisit.id)
    expandedVisits.value = newExpanded
  }
  emit('updated')
}

// Watch for visits changes and resolve status codes
watch(
  visits,
  async (newVisits) => {
    if (newVisits && newVisits.length > 0) {
      // Get all unique status codes
      const uniqueStatusCodes = [...new Set(newVisits.map((visit) => visit.status).filter(Boolean))]

      // Resolve them in batch with context
      await conceptStore.resolveBatch(uniqueStatusCodes, {
        context: 'status',
        table: 'VISIT_DIMENSION',
        column: 'ACTIVE_STATUS_CD',
      })
    }
  },
  { immediate: true, deep: true },
)
</script>

<style lang="scss" scoped>
.visit-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.observations-container {
  padding: 1rem;
}

// Responsive adjustments
@media (max-width: 768px) {
  .visit-section {
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .observations-container {
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .visit-section {
    border-radius: 6px;
    margin-bottom: 0.75rem;
  }

  .observations-container {
    padding: 0.5rem;
  }
}

// Animation for new sections
.visit-section {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Sort control styling (keeping from original)
.sort-control {
  display: flex;
  align-items: center;
  gap: 4px;

  .sort-button {
    min-height: 36px;
    padding: 8px 12px;
  }

  .sort-indicator-icon {
    opacity: 0.6;
    color: #666;
  }
}

// Visit toggle button styling
.toggle-visits-btn {
  min-height: 36px;
  padding: 8px 12px;
}

// Create visit button styling
.create-visit-btn {
  min-height: 36px;
  padding: 8px 12px;

  &:hover {
    background-color: rgba(25, 118, 210, 0.08);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(25, 118, 210, 0.2);
  }
}
</style>
