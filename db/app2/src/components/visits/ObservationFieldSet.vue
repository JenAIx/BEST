<template>
  <div class="field-set-section">
    <div class="field-set-header cursor-pointer" @click="collapsed = !collapsed">
      <div class="field-set-title">
        <q-icon :name="fieldSet.icon" size="24px" class="q-mr-sm" />
        {{ fieldSet.name }}
        <!-- Show observation counts when collapsed -->
        <div v-if="collapsed && observationCount > 0" class="observation-badges q-ml-sm">
          <q-badge v-if="filledObservationCount > 0" :label="filledObservationCount" color="positive" class="observation-count-badge">
            <q-tooltip>{{ $t('observation.filledObservations', { count: filledObservationCount }) }}</q-tooltip>
          </q-badge>
          <q-badge v-if="unfilledObservationCount > 0" :label="unfilledObservationCount" color="grey-5" class="observation-count-badge unfilled-badge">
            <q-tooltip>{{ $t('observation.unfilledObservations', { count: unfilledObservationCount }) }}</q-tooltip>
          </q-badge>
        </div>
      </div>
      <q-icon name="expand_more" size="20px" class="expand-icon" :class="{ 'rotate-180': !collapsed }">
        <q-tooltip>{{ collapsed ? $t('common.expand') : $t('common.collapse') }}</q-tooltip>
      </q-icon>
    </div>

    <q-slide-transition>
      <div v-show="!collapsed" class="field-set-content">
        <!-- Observations Table -->
        <ObservationsTable
          :table-rows="tableRows"
          :loading="loading"
          :visit="visit"
          :patient="patient"
          :frequency-options="frequencyOptions"
          :route-options="routeOptions"
          :field-set-concepts="fieldSetConcepts"
          :previous-visits="previousVisits"
          @enter-medication-edit-mode="enterMedicationEditMode"
          @value-changed="onValueChanged"
          @save-requested="onSaveRequested"
          @save-row="saveRow"
          @cancel-changes="cancelChanges"
          @revert-row="revertRow"
          @remove-row="removeRow"
          @clone-from-previous="cloneFromPrevious"
          @duplicate-value="onDuplicateValue"
        />

        <!-- Empty State -->
        <div v-if="tableRows.length === 0" class="empty-observations">
          <q-icon name="assignment" size="48px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-sm">{{ $t('observation.noObservationsYet') }}</div>
          <div class="text-body2 text-grey-5">{{ $t('observation.addObservationsHint') }}</div>
        </div>

        <!-- Unfilled Observations - Compact Chips -->
        <UnfilledObservationsChips :unfilled-concepts="unfilledConcepts" :creating-all="creatingAllObservations" @create-observation="createObservationFromChip" @create-all="createAllUnfilledObservations" />

        <!-- Add medication button (only for medications fieldset) -->
        <MedicationSection :field-set-id="fieldSet.id" @add-empty-medication="addEmptyMedication" />
      </div>
    </q-slide-transition>

    <!-- Medication Edit Dialog -->
    <MedicationEditDialog
      v-if="editingMedicationRow"
      v-model="showMedicationEditDialog"
      :medication-data="getMedicationDataForDialog(editingMedicationRow)"
      :observation-id="editingMedicationRow?.observationId"
      :frequency-options="frequencyOptions"
      :route-options="routeOptions"
      @save="onMedicationEditSave"
      @cancel="onMedicationEditCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotify } from 'src/composables/useNotify'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useMedicationsStore } from 'src/stores/medications-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useMedicationOptions } from 'src/composables/useMedicationOptions'
import ObservationsTable from './ObservationsTable.vue'
import UnfilledObservationsChips from './UnfilledObservationsChips.vue'
import MedicationSection from './MedicationSection.vue'
import MedicationEditDialog from './MedicationEditDialog.vue'

const props = defineProps({
  fieldSet: {
    type: Object,
    required: true,
  },
  visit: {
    type: Object,
    required: true,
  },
  patient: {
    type: Object,
    required: true,
  },
  previousVisits: {
    type: Array,
    default: () => [],
  },
  existingObservations: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['observation-updated', 'clone-from-previous', 'refresh-requested'])

const notify = useNotify()
const { t } = useI18n()
const medicationsStore = useMedicationsStore()
const loggingStore = useLoggingStore()
const conceptStore = useConceptResolutionStore()
const logger = loggingStore.createLogger('ObservationFieldSet')

// State
const collapsed = ref(false)
const loading = ref(false)
const removedConcepts = ref(new Set()) // Track concepts removed by user
const resolvedConceptData = ref(new Map()) // Cache for resolved concept data
const pendingChanges = ref(new Map()) // Track pending changes per row
const recentSaves = ref(new Map()) // rowId -> { previousValue, timerId } — revert window after autosave
const REVERT_WINDOW_MS = 10000

// Medication editing state
const showMedicationEditDialog = ref(false)
const editingMedicationRow = ref(null)

// Use medication options composable
const { frequencyOptions, routeOptions, loadMedicationOptions } = useMedicationOptions()

// Component mounted
onMounted(async () => {
  logger.info('ObservationFieldSet mounted', {
    fieldSetId: props.fieldSet?.id,
    fieldSetName: props.fieldSet?.name,
    visitId: props.visit?.id,
    patientId: props.patient?.id,
    existingObservationsCount: props.existingObservations?.length || 0,
    fieldSetConceptsCount: props.fieldSet?.concepts?.length || 0,
  })

  // Load medication options from store
  await loadMedicationOptions()

  // Resolve concept names for all concepts in the field set
  await resolveFieldSetConceptNames()
})

onUnmounted(() => {
  // Clear revert-window timers to avoid mutating state after unmount
  for (const { timerId } of recentSaves.value.values()) {
    clearTimeout(timerId)
  }
  recentSaves.value.clear()
})

// Resolve concept names using concept resolution store
const resolveFieldSetConceptNames = async () => {
  if (!props.fieldSet?.concepts?.length) return

  try {
    logger.debug('Resolving concept names for field set', {
      fieldSetId: props.fieldSet.id,
      conceptCount: props.fieldSet.concepts.length,
    })

    // Resolve all concepts in batch for better performance
    const conceptMap = await conceptStore.resolveBatch(props.fieldSet.concepts, {
      context: 'observation',
      table: 'CONCEPT_DIMENSION',
      column: 'CONCEPT_CD',
    })

    // Update the reactive map with full concept data
    for (const [conceptCode, resolved] of conceptMap) {
      resolvedConceptData.value.set(conceptCode, {
        label: resolved.label || conceptCode,
        valueType: resolved.valueType,
        unit: resolved.unit,
      })
    }

    logger.success('Concept names resolved successfully', {
      fieldSetId: props.fieldSet.id,
      resolvedCount: conceptMap.size,
    })
  } catch (error) {
    logger.error('Failed to resolve concept names', error, {
      fieldSetId: props.fieldSet.id,
      conceptCount: props.fieldSet.concepts?.length || 0,
    })
  }
}

// Computed
const fieldSetConcepts = computed(() => {
  // Convert field set concepts to detailed concept objects, filtering out removed ones
  return (
    props.fieldSet.concepts
      ?.filter((conceptCode) => !removedConcepts.value.has(conceptCode))
      ?.map((conceptCode) => {
        const [system, code] = conceptCode.split(':')
        const resolvedData = resolvedConceptData.value.get(conceptCode)
        return {
          code: conceptCode,
          system,
          localCode: code,
          name: resolvedData?.label || getConceptName(conceptCode),
          valueType: resolvedData?.valueType || getConceptValueType(conceptCode),
          unit: resolvedData?.unit || getConceptUnit(conceptCode),
        }
      }) || []
  )
})

const observationCount = computed(() => {
  return props.existingObservations?.length || 0
})

const filledObservationCount = computed(() => {
  if (!props.existingObservations) return 0
  return props.existingObservations.filter((obs) => {
    // Use extractObservationValue to get the actual value
    const value = obs.tval_char || obs.TVAL_CHAR || obs.nval_num || obs.NVAL_NUM || obs.observation_blob || obs.OBSERVATION_BLOB || obs.originalValue || obs.value
    return value !== null && value !== undefined && value !== ''
  }).length
})

const unfilledObservationCount = computed(() => {
  return observationCount.value - filledObservationCount.value
})

// Create table rows from observations
const tableRows = computed(() => {
  const rows = []

  // Process regular observations
  const currentEncounterObservations =
    props.existingObservations?.filter((obs) => {
      const encounterMatch = obs.encounterNum === props.visit.id || obs.ENCOUNTER_NUM === props.visit.id
      const notMedication = obs.valTypeCode !== 'M' && !obs.conceptCode?.includes('52418')
      return encounterMatch && notMedication
    }) || []

  for (const observation of currentEncounterObservations) {
    const matchingConcept = findBestMatchingConcept(observation)
    if (matchingConcept) {
      const rowId = `obs_${observation.observationId}`
      // Extract the actual value from observation
      const actualValue = extractObservationValue(observation)
      const pendingValue = pendingChanges.value.get(rowId)
      rows.push({
        id: rowId,
        observationId: observation.observationId,
        conceptCode: observation.conceptCode,
        conceptName: matchingConcept.name,
        resolvedName: resolvedConceptData.value.get(matchingConcept.code)?.label,
        valueType: observation.valueType || observation.valTypeCode,
        // Use consistent origVal/currentVal pattern
        origVal: actualValue,
        currentVal: pendingValue !== undefined ? pendingValue : actualValue,
        unit: observation.unit,
        category: observation.category || observation.CATEGORY_CHAR,
        hasChanges: pendingValue !== undefined && pendingValue !== actualValue,
        canRevert: pendingValue === undefined && recentSaves.value.has(rowId),
        saving: false,
        previousValue: getPreviousValue(observation.conceptCode),
        displayValue: formatDisplayValue(observation),
        // Store raw observation for complete data access
        rawObservation: observation,
      })
    }
  }

  // Process medication observations
  const medicationObservations =
    props.existingObservations?.filter((obs) => {
      const encounterMatch = obs.encounterNum === props.visit.id || obs.ENCOUNTER_NUM === props.visit.id
      const isMedication = obs.conceptCode === 'LID: 52418-1' || obs.valTypeCode === 'M' || (obs.conceptCode && obs.conceptCode.includes('52418'))
      return encounterMatch && isMedication
    }) || []

  for (const medication of medicationObservations) {
    const rowId = `med_${medication.observationId}`
    // Extract the actual value from medication
    const actualValue = extractObservationValue(medication)
    const pendingValue = pendingChanges.value.get(rowId)
    rows.push({
      id: rowId,
      observationId: medication.observationId,
      conceptCode: medication.conceptCode,
      conceptName: 'Current Medication',
      resolvedName: 'Current Medication',
      valueType: 'M',
      // Use consistent origVal/currentVal pattern
      origVal: actualValue,
      currentVal: pendingValue !== undefined ? pendingValue : actualValue,
      unit: medication.unit,
      category: medication.category || medication.CATEGORY_CHAR,
      hasChanges: pendingValue !== undefined && pendingValue !== actualValue,
      saving: false,
      previousValue: getPreviousValue(medication.conceptCode),
      displayValue: formatMedicationDisplay(medication),
      isMedication: true,
      // Store raw observation for complete data access
      rawObservation: medication,
    })
  }

  return rows.sort((a, b) => {
    // Primary sort: Field set concept order (if available)
    const fieldSetConceptOrder = getFieldSetConceptOrder()
    const orderA = fieldSetConceptOrder.get(a.conceptCode) ?? Number.MAX_SAFE_INTEGER
    const orderB = fieldSetConceptOrder.get(b.conceptCode) ?? Number.MAX_SAFE_INTEGER

    if (orderA !== orderB) {
      return orderA - orderB
    }

    // Secondary sort: Creation date (newer first for same field set position)
    const createdAtA = a.rawObservation?.CREATED_AT || a.rawObservation?.created_at || '1970-01-01'
    const createdAtB = b.rawObservation?.CREATED_AT || b.rawObservation?.created_at || '1970-01-01'

    if (createdAtA !== createdAtB) {
      return new Date(createdAtB) - new Date(createdAtA) // Newer first
    }

    // Tertiary sort: Category
    const categoryA = a.category || 'ZZZZZ'
    const categoryB = b.category || 'ZZZZZ'
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB)
    }

    // Final fallback: Concept name
    return a.conceptName.localeCompare(b.conceptName)
  })
})

// Unfilled concepts - concepts that don't have any existing observations
const unfilledConcepts = computed(() => {
  const filledConceptCodes = new Set(tableRows.value.map((row) => row.conceptCode))
  return fieldSetConcepts.value.filter((concept) => {
    // Skip medications as they are handled differently
    if (concept.valueType === 'M') return false
    // Check if this concept is already paired with an observation
    return !filledConceptCodes.has(concept.code)
  })
})

// Methods
const getFieldSetConceptOrder = () => {
  // Create a Map with concept codes and their order within the field set
  const orderMap = new Map()

  if (props.fieldSet?.concepts && Array.isArray(props.fieldSet.concepts)) {
    props.fieldSet.concepts.forEach((conceptCode, index) => {
      orderMap.set(conceptCode, index)
    })
  }

  return orderMap
}

const findBestMatchingConcept = (observation) => {
  const obsConceptCode = observation.conceptCode

  // Find all potential matching concepts by code
  const matches = fieldSetConcepts.value.filter((concept) => {
    // Skip medications
    if (concept.valueType === 'M') return false

    // 1. Exact match (highest priority)
    if (concept.code === obsConceptCode) return true

    // 2. Extract numeric codes and compare
    const conceptMatch = concept.code.match(/[:\s]([0-9-]+)$/)
    const obsMatch = obsConceptCode.match(/[:\s]([0-9-]+)$/)
    if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) return true

    return false
  })

  if (matches.length > 0) {
    // Prefer exact matches first, then numeric matches
    const exactMatch = matches.find((concept) => concept.code === obsConceptCode)
    return exactMatch || matches[0]
  }

  // Fallback: CATEGORY_CHAR match — create a pseudo-concept for display
  if (props.fieldSet.categories && observation.category && props.fieldSet.categories.includes(observation.category)) {
    return {
      code: obsConceptCode,
      name: observation.conceptName || observation.conceptCode,
      valueType: observation.valueType || observation.valTypeCode || 'T',
      unit: observation.unit || '',
      _categoryMatch: true,
    }
  }

  return null
}

const getConceptName = (conceptCode) => {
  const parts = conceptCode.split(':')
  return parts.length > 1 ? parts[1] : conceptCode
}

const getConceptValueType = (conceptCode) => {
  if (conceptCode.includes('52418')) return 'M' // Medication concept
  if (conceptCode.includes('8480') || conceptCode.includes('8462') || conceptCode.includes('8867')) {
    return 'N' // Common vital signs are numeric
  }
  return 'T' // Default to text
}

const getConceptUnit = (conceptCode) => {
  if (conceptCode.includes('8480') || conceptCode.includes('8462')) return 'mmHg'
  if (conceptCode.includes('8867')) return 'bpm'
  if (conceptCode.includes('8310')) return '°C'
  return '' // No unit by default
}

const getPreviousValue = (conceptCode) => {
  // Get the most recent value from previous visits
  if (!props.previousVisits.length) return null
  // This is a placeholder implementation - in a real scenario, we would
  // need to load and cache observation data for previous visits
  logger.debug('Looking for previous value for concept', { conceptCode })
  return null
}

// Extract the actual value from observation data
const extractObservationValue = (observation) => {
  // Handle different database field names and value types
  const valType = observation.valueType || observation.valTypeCode || 'T'

  switch (valType) {
    case 'N': {
      // Numeric
      // For numeric values, check all possible numeric fields
      const numericValue = observation.nval_num || observation.NVAL_NUM
      if (numericValue !== null && numericValue !== undefined) {
        return numericValue
      }
      // Fallback to text fields that might contain numeric values
      return observation.tval_char || observation.TVAL_CHAR || observation.originalValue || observation.value || ''
    }
    case 'S': // Selection
    case 'F': // Finding
    case 'A': // Array/Multiple choice
      // For coded values, return the code not the resolved display value
      return observation.tval_char || observation.TVAL_CHAR || observation.originalValue || observation.value || ''
    case 'M': // Medication
      // Medication data might be in OBSERVATION_BLOB or tval_char
      return observation.observation_blob || observation.OBSERVATION_BLOB || observation.tval_char || observation.TVAL_CHAR || observation.originalValue || observation.value || ''
    case 'R': // Raw data/File
      // File data is usually in OBSERVATION_BLOB
      return observation.observation_blob || observation.OBSERVATION_BLOB || observation.originalValue || observation.value || ''
    case 'T': // Text
    default:
      return observation.tval_char || observation.TVAL_CHAR || observation.originalValue || observation.value || ''
  }
}

const formatDisplayValue = (observation) => {
  switch (observation.valueType || observation.valTypeCode) {
    case 'S': // Selection
    case 'F': // Finding
    case 'A': // Array/Multiple choice
      return observation.resolvedValue || observation.originalValue || observation.value || 'No value'
    case 'Q': // Questionnaire
      return observation.originalValue || observation.value || 'Questionnaire'
    case 'R': // Raw data/File
      try {
        if (observation.originalValue || observation.value) {
          const fileInfo = JSON.parse(observation.originalValue || observation.value)
          return fileInfo.filename || 'File attached'
        }
      } catch {
        return 'Invalid file data'
      }
      break
    case 'N': // Numeric
      return observation.originalValue?.toString() || observation.value?.toString() || 'No value'
    default: // Text and others
      return observation.originalValue || observation.value || 'No value'
  }
}

const formatMedicationDisplay = (medication) => {
  // For medications, show a summary or just the drug name
  return medication.originalValue || medication.value || 'No medication specified'
}

// Get medication data for dialog (with BLOB loading)
const getMedicationDataForDialog = (row) => {
  if (!row || !row.rawObservation) {
    return {
      drugName: '',
      dosage: null,
      dosageUnit: 'mg',
      frequency: '',
      route: '',
      instructions: '',
    }
  }
  
  // If BLOB is available, parse it
  const blobData = row.rawObservation.OBSERVATION_BLOB || row.rawObservation.observation_blob
  if (blobData && typeof blobData === 'string') {
    try {
      const parsed = JSON.parse(blobData)
      return {
        drugName: parsed.drugName || row.rawObservation.TVAL_CHAR || '',
        dosage: parsed.dosage || row.rawObservation.NVAL_NUM || null,
        dosageUnit: parsed.dosageUnit || row.rawObservation.UNIT_CD || 'mg',
        frequency: parsed.frequency || '',
        route: parsed.route || '',
        instructions: parsed.instructions || '',
      }
    } catch (parseError) {
      logger.warn('Failed to parse medication BLOB', parseError)
    }
  }
  
  // Fallback to basic data
  return {
    drugName: row.rawObservation.TVAL_CHAR || '',
    dosage: row.rawObservation.NVAL_NUM || null,
    dosageUnit: row.rawObservation.UNIT_CD || 'mg',
    frequency: '',
    route: '',
    instructions: '',
  }
}

// Enter medication edit mode
const enterMedicationEditMode = async (row) => {
  logger.debug('Enter medication edit mode', { rowId: row.id })
  
  // Load BLOB data on-demand for editing
  if (row.observationId) {
    try {
      const { useObservationStore } = await import('src/stores/observation-store.js')
      const observationStore = useObservationStore()
      const loadedBlob = await observationStore.getObservationBlob(row.observationId)
      
      if (loadedBlob) {
        // Update rawObservation with BLOB data
        row.rawObservation = {
          ...row.rawObservation,
          OBSERVATION_BLOB: loadedBlob,
          observation_blob: loadedBlob,
        }
        logger.debug('BLOB data loaded for medication edit', { observationId: row.observationId })
      }
    } catch (error) {
      logger.warn('Failed to load medication BLOB', { observationId: row.observationId, error })
    }
  }
  
  editingMedicationRow.value = row
  showMedicationEditDialog.value = true
}

// Handle medication edit save
const onMedicationEditSave = async (medicationData) => {
  if (!editingMedicationRow.value) return

  try {
    const row = editingMedicationRow.value
    logger.debug('Saving medication edit', { rowId: row.id, medicationData })

    // We no longer create a summary - TVAL_CHAR will only contain the drug name

    // Normalize medication data to ensure we store string values, not objects
    const normalizedMedicationData = {
      drugName: medicationData.drugName || '',
      dosage: medicationData.dosage || null,
      dosageUnit: medicationData.dosageUnit || 'mg',
      frequency: (typeof medicationData.frequency === 'object' ? medicationData.frequency?.value || '' : medicationData.frequency || '').toLowerCase(),
      route: (typeof medicationData.route === 'object' ? medicationData.route?.value || '' : medicationData.route || '').toLowerCase(),
      instructions: medicationData.instructions || '',
    }

    // Update the observation with new medication data
    const updateData = {
      TVAL_CHAR: normalizedMedicationData.drugName, // Only store drug name in TVAL_CHAR
      NVAL_NUM: medicationData.dosage ? parseFloat(medicationData.dosage) : null,
      OBSERVATION_BLOB: JSON.stringify(normalizedMedicationData), // Full structured data in BLOB
    }

    await visitObservationService.updateObservation(row.observationId, updateData, { skipReload: true })

    // Update local state
    row.rawObservation.TVAL_CHAR = normalizedMedicationData.drugName // Only drug name in TVAL_CHAR
    row.rawObservation.tval_char = normalizedMedicationData.drugName
    row.rawObservation.NVAL_NUM = medicationData.dosage ? parseFloat(medicationData.dosage) : null
    row.rawObservation.nval_num = medicationData.dosage ? parseFloat(medicationData.dosage) : null
    row.rawObservation.OBSERVATION_BLOB = JSON.stringify(normalizedMedicationData)
    row.rawObservation.observation_blob = JSON.stringify(normalizedMedicationData)
    row.rawObservation.originalValue = normalizedMedicationData.drugName // Only drug name for consistency
    row.rawObservation.value = normalizedMedicationData.drugName

    // Clear pending changes
    pendingChanges.value.delete(row.id)

    emit('observation-updated', {
      conceptCode: row.conceptCode,
      value: normalizedMedicationData.drugName, // Only drug name for consistency
      observationId: row.observationId,
    })

    logger.success('Medication updated successfully', { rowId: row.id })
  } catch (error) {
    logger.error('Failed to save medication edit', error)
    notify.error('Failed to save medication')
  }
}

// Handle medication edit cancel
const onMedicationEditCancel = () => {
  editingMedicationRow.value = null
}

// Event handlers
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

// Autosave entry point (blur / Enter / selection picked). Reads the pending
// value from the map instead of the row snapshot — the event can fire before
// the tableRows computed has re-rendered with the latest keystroke.
const onSaveRequested = async (rowData) => {
  const pending = pendingChanges.value.get(rowData.id)
  if (pending === undefined) return // nothing typed — no-op blur

  if (String(pending ?? '') === String(rowData.origVal ?? '')) {
    // Value was changed back to the original — just drop the pending state
    pendingChanges.value.delete(rowData.id)
    return
  }

  await saveRow({ ...rowData, currentVal: pending })
}

// Remember the pre-save value for a short revert window (undo button)
const recordRecentSave = (rowId, previousValue) => {
  const existing = recentSaves.value.get(rowId)
  if (existing) clearTimeout(existing.timerId)

  const timerId = setTimeout(() => {
    recentSaves.value.delete(rowId)
  }, REVERT_WINDOW_MS)

  recentSaves.value.set(rowId, { previousValue, timerId })
}

const saveRow = async (row, { isRevert = false } = {}) => {
  const previousValue = row.origVal // pre-save value for the revert window
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
      // Handle medication updates - save complex data in OBSERVATION_BLOB
      logger.debug('Saving medication row with complex data')

      // For medications, extract structured data and store drug name only in TVAL_CHAR
      const medicationData = medicationsStore.parseMedicationData(row)

      const updateData = {
        TVAL_CHAR: medicationData.drugName, // Only drug name in TVAL_CHAR
        NVAL_NUM: medicationData.dosage ? parseFloat(medicationData.dosage) : null,
        OBSERVATION_BLOB: JSON.stringify(medicationData), // Full structured data
        VALUEFLAG_CD: null, // Writing a value clears any NV/AUDIT/CONFIRMED flag (CLAUDE.md §3)
      }
      await visitObservationService.updateObservation(row.observationId, updateData, { skipReload: true })
    } else {
      // Handle regular observation updates based on value type.
      // Writing a value always clears the VALUEFLAG_CD state (NV means "no
      // value" and must not survive a real value; stale AUDIT/CONFIRMED
      // flags are reset by an edit — same policy as the grid editor).
      const updateData = { VALUEFLAG_CD: null }

      switch (row.valueType) {
        case 'N': {
          // Numeric — an empty value (e.g. revert to an unfilled state) stores NULL
          const numericValue = parseFloat(row.currentVal)
          updateData.NVAL_NUM = Number.isFinite(numericValue) ? numericValue : null
          updateData.TVAL_CHAR = null
          updateData.OBSERVATION_BLOB = null
          break
        }

        case 'S': // Selection
        case 'F': // Finding
        case 'A': // Array/Multiple choice
          // For coded values, store the code in TVAL_CHAR
          updateData.TVAL_CHAR = String(row.currentVal)
          updateData.NVAL_NUM = null
          updateData.OBSERVATION_BLOB = null
          break

        case 'R': // Raw data/File
        case 'M': // Medication (complex data)
          // Store complex data in OBSERVATION_BLOB
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

      // Always skip reload to prevent bounce
      await visitObservationService.updateObservation(row.observationId, updateData, { skipReload: true })
    }

    // Update local state immediately - no need to wait for refresh
    pendingChanges.value.delete(row.id)

    // Update the raw observation in our local data to reflect the save
    // This prevents the need for a full refresh
    if (row.rawObservation) {
      // Mirror the flag reset (see updateData.VALUEFLAG_CD above)
      row.rawObservation.VALUEFLAG_CD = null
      row.rawObservation.valueFlag = null
      switch (row.valueType) {
        case 'N': {
          const parsed = parseFloat(row.currentVal)
          const numericValue = Number.isFinite(parsed) ? parsed : null
          row.rawObservation.NVAL_NUM = numericValue
          row.rawObservation.nval_num = numericValue
          // Clear text fields for numeric values
          row.rawObservation.TVAL_CHAR = null
          row.rawObservation.tval_char = null
          row.rawObservation.originalValue = numericValue
          row.rawObservation.value = numericValue
          break
        }
        case 'M': {
          // For medications, update all relevant fields - store only drug name in TVAL_CHAR
          const medicationData = medicationsStore.parseMedicationData(row)
          row.rawObservation.TVAL_CHAR = medicationData.drugName
          row.rawObservation.tval_char = medicationData.drugName
          row.rawObservation.NVAL_NUM = medicationData.dosage ? parseFloat(medicationData.dosage) : null
          row.rawObservation.nval_num = medicationData.dosage ? parseFloat(medicationData.dosage) : null
          row.rawObservation.OBSERVATION_BLOB = JSON.stringify(medicationData)
          row.rawObservation.observation_blob = JSON.stringify(medicationData)
          row.rawObservation.originalValue = medicationData.drugName
          row.rawObservation.value = medicationData.drugName
          break
        }
        default:
          row.rawObservation.TVAL_CHAR = String(row.currentVal)
          row.rawObservation.tval_char = String(row.currentVal)
          // Clear numeric fields for text values
          row.rawObservation.NVAL_NUM = null
          row.rawObservation.nval_num = null
          row.rawObservation.originalValue = row.currentVal
          row.rawObservation.value = row.currentVal
          break
      }
    }

    emit('observation-updated', {
      conceptCode: row.conceptCode,
      value: row.currentVal,
      observationId: row.observationId,
    })

    // Open the revert window (not for reverts themselves and not for medications).
    // No success toast for regular saves — the green check on the field
    // (driven by the same window) is the feedback.
    if (!isRevert && !row.isMedication && String(previousValue ?? '') !== String(row.currentVal ?? '')) {
      recordRecentSave(row.id, previousValue)
    }

    if (isRevert) {
      notify.success('Original value restored')
    }

    logger.success('Row saved successfully', { rowId: row.id, isRevert })

    // No delayed refresh needed - the computed property will update automatically
    // when pendingChanges is cleared
  } catch (error) {
    logger.error('Failed to save row', error, { rowId: row.id })
    notify.error('Failed to save observation')
  } finally {
    row.saving = false
  }
}

// Undo the last (auto)save within the revert window — writes the pre-save
// value back to the database and closes the window for this row.
const revertRow = async (row) => {
  const saved = recentSaves.value.get(row.id)
  if (saved === undefined) return

  clearTimeout(saved.timerId)
  recentSaves.value.delete(row.id)
  pendingChanges.value.delete(row.id)

  logger.info('Reverting row to pre-save value', {
    rowId: row.id,
    conceptCode: row.conceptCode,
    revertTo: saved.previousValue,
  })

  await saveRow({ ...row, currentVal: saved.previousValue }, { isRevert: true })
}

const cancelChanges = (row) => {
  logger.debug('Cancelling changes for row', {
    rowId: row.id,
    conceptCode: row.conceptCode,
    origVal: row.origVal,
    currentVal: row.currentVal,
  })

  // Remove pending change - computed property will restore original value
  pendingChanges.value.delete(row.id)

  logger.debug('Changes cancelled, row restored', {
    rowId: row.id,
    conceptCode: row.conceptCode,
    restoredValue: row.origVal,
  })
}

const removeRow = async (row) => {
  try {
    row.saving = true
    logger.info('Removing row', { rowId: row.id, conceptCode: row.conceptCode })

    // Delete observation from database (both medications and regular observations)
    await visitObservationService.deleteObservation(row.observationId)

    emit('observation-updated', {
      conceptCode: row.conceptCode,
      value: null,
      deleted: true,
      observationId: row.observationId,
    })

    notify.success('Observation removed successfully')

    logger.success('Row removed successfully', { rowId: row.id })
  } catch (error) {
    logger.error('Failed to remove row', error, { rowId: row.id })
    notify.error('Failed to remove observation')
  } finally {
    row.saving = false
  }
}

const cloneFromPrevious = (row) => {
  if (row.previousValue) {
    row.currentValue = row.previousValue.value
    row.hasChanges = true
    pendingChanges.value.set(row.id, true)

    logger.info('Cloned value from previous visit', {
      rowId: row.id,
      conceptCode: row.conceptCode,
      clonedValue: row.previousValue.value,
    })
  }
}

const onDuplicateValue = async (data) => {
  try {
    logger.info('Duplicating previous value', {
      conceptCode: data.conceptCode,
      value: data.value,
      fromVisit: data.fromVisit,
    })

    // Find the row for this concept code to update it
    const rowIndex = tableRows.value.findIndex((row) => row.conceptCode === data.conceptCode)

    if (rowIndex !== -1) {
      const row = tableRows.value[rowIndex]

      // Apply the value and autosave immediately (there is no manual save
      // button anymore) — the revert window allows undoing this too.
      pendingChanges.value.set(row.id, data.value)
      await saveRow({ ...row, currentVal: data.value })

      logger.success('Value duplicated successfully', {
        conceptCode: data.conceptCode,
        newValue: data.value,
        rowId: row.id,
      })

      notify.success(`Value duplicated from previous visit (${new Date(data.fromVisit.date).toLocaleDateString()})`)
    } else {
      logger.warn('Could not find row to update with duplicated value', {
        conceptCode: data.conceptCode,
      })
    }
  } catch (error) {
    logger.error('Failed to duplicate previous value', error)
    notify.error('Failed to duplicate previous value')
  }
}

// Shared payload for an empty observation of a field-set concept
const buildEmptyObservationData = (concept) => ({
  PATIENT_NUM: props.patient.PATIENT_NUM,
  ENCOUNTER_NUM: props.visit.id,
  CONCEPT_CD: concept.code,
  VALTYPE_CD: concept.valueType,
  START_DATE: new Date().toISOString().split('T')[0],
  LOCATION_CD: 'VISITS_PAGE',
  INSTANCE_NUM: 1,
  UPLOAD_ID: 1,
  TVAL_CHAR: concept.valueType === 'N' ? null : '',
  NVAL_NUM: null,
  UNIT_CD: concept.unit || null,
  OBSERVATION_BLOB: null,
})

const createObservationFromChip = async (concept) => {
  try {
    logger.info('Creating observation from chip', {
      conceptCode: concept.code,
      conceptName: concept.name,
    })

    // Use service to create observation
    await visitObservationService.createObservation(buildEmptyObservationData(concept))

    // Emit update to refresh the field set
    emit('observation-updated', {
      conceptCode: concept.code,
      value: concept.valueType === 'N' ? null : '',
      added: true,
    })

    const displayName = resolvedConceptData.value.get(concept.code)?.label || concept.name
    notify.success(`${displayName} observation added`)

    logger.success('Observation created from chip successfully', {
      conceptCode: concept.code,
    })
  } catch (error) {
    logger.error('Failed to create observation from chip', error, {
      conceptCode: concept.code,
    })

    const displayName = resolvedConceptData.value.get(concept.code)?.label || concept.name
    notify.error(`Failed to add ${displayName}`)
  }
}

// "+ Alle hinzufügen": create every unfilled field-set concept as an empty
// observation in one go (medications excluded — they have their own flow)
const creatingAllObservations = ref(false)
const createAllUnfilledObservations = async () => {
  if (creatingAllObservations.value) return
  const concepts = unfilledConcepts.value.filter((concept) => concept.valueType !== 'M')
  if (concepts.length === 0) return

  creatingAllObservations.value = true
  let created = 0
  try {
    for (const concept of concepts) {
      try {
        await visitObservationService.createObservation(buildEmptyObservationData(concept))
        created++
      } catch (error) {
        logger.error('Failed to create observation in bulk add', error, { conceptCode: concept.code })
      }
    }

    emit('observation-updated', { added: true, bulk: true })
    if (created > 0) {
      notify.success(t('observation.allObservationsAdded', { count: created }))
    }
    if (created < concepts.length) {
      notify.warning(t('observation.someObservationsFailed', { count: concepts.length - created }))
    }
  } finally {
    creatingAllObservations.value = false
  }
}

const addEmptyMedication = async () => {
  try {
    // Create empty medication observation
    const observationData = {
      PATIENT_NUM: props.patient.PATIENT_NUM,
      ENCOUNTER_NUM: props.visit.id,
      CONCEPT_CD: 'LID: 52418-1',
      VALTYPE_CD: 'M',
      TVAL_CHAR: '',
      NVAL_NUM: null,
      UNIT_CD: null,
      OBSERVATION_BLOB: null,
      START_DATE: new Date().toISOString().split('T')[0],
      LOCATION_CD: 'VISITS_PAGE',
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }

    await visitObservationService.createObservation(observationData)

    emit('observation-updated', {
      conceptCode: 'LID: 52418-1',
      value: '',
      added: true,
    })

    logger.info('Empty medication added successfully')

    notify.success('Empty medication slot added')
  } catch (error) {
    logger.error('Failed to add empty medication', error)
    notify.error('Failed to add medication')
  }
}
</script>

<style lang="scss" scoped>
.field-set-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.field-set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: $grey-1;
  border-bottom: 1px solid $grey-3;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: $grey-2;

    .expand-icon {
      color: $primary;
      transform: scale(1.1);
    }
  }

  .field-set-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: $grey-8;
    display: flex;
    align-items: center;

    .observation-badges {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }

    .observation-count-badge {
      font-size: 0.75rem;
      font-weight: 500;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;

      &.unfilled-badge {
        opacity: 0.8;
        border: 1px solid $grey-4;
      }
    }
  }

  .expand-icon {
    color: $grey-6;
    transition: all 0.3s ease;
  }
}

.field-set-content {
  padding: 1.5rem;
}

.empty-observations {
  text-align: center;
  padding: 3rem 2rem;
  color: $grey-6;
}

.expand-icon.rotate-180 {
  transform: rotate(180deg);
}

@media (max-width: 768px) {
  .field-set-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  :deep(.q-table__container) {
    .q-table__middle {
      overflow-x: auto;
    }
  }
}
</style>
