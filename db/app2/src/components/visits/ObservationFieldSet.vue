<template>
  <div class="field-set-section">
    <div class="field-set-header cursor-pointer" @click="collapsed = !collapsed">
      <div class="field-set-title">
        <q-icon :name="fieldSet.icon" size="24px" class="q-mr-sm" />
        {{ fieldSet.name }}
        <!-- Show observation counts when collapsed -->
        <div v-if="collapsed && observationCount > 0" class="observation-badges q-ml-sm">
          <q-badge v-if="filledObservationCount > 0" :label="filledObservationCount" color="positive" class="observation-count-badge">
            <q-tooltip>{{ filledObservationCount }} filled observation{{ filledObservationCount > 1 ? 's' : '' }}</q-tooltip>
          </q-badge>
          <q-badge v-if="unfilledObservationCount > 0" :label="unfilledObservationCount" color="grey-5" class="observation-count-badge unfilled-badge">
            <q-tooltip>{{ unfilledObservationCount }} unfilled observation{{ unfilledObservationCount > 1 ? 's' : '' }}</q-tooltip>
          </q-badge>
        </div>
      </div>
      <q-icon name="expand_more" size="20px" class="expand-icon" :class="{ 'rotate-180': !collapsed }">
        <q-tooltip>{{ collapsed ? 'Expand' : 'Collapse' }}</q-tooltip>
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
          @enter-medication-edit-mode="enterMedicationEditMode"
          @value-changed="onValueChanged"
          @save-requested="onSaveRequested"
          @save-row="saveRow"
          @cancel-changes="cancelChanges"
          @remove-row="removeRow"
          @clone-from-previous="cloneFromPrevious"
        />

        <!-- Empty State -->
        <div v-if="tableRows.length === 0" class="empty-observations">
          <q-icon name="assignment" size="48px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-sm">No observations yet</div>
          <div class="text-body2 text-grey-5">Add observations from the available options below</div>
        </div>

        <!-- Unfilled Observations - Compact Chips -->
        <UnfilledObservationsChips :unfilled-concepts="unfilledConcepts" @create-observation="createObservationFromChip" />

        <!-- Add medication button (only for medications fieldset) -->
        <MedicationSection :field-set-id="fieldSet.id" @add-empty-medication="addEmptyMedication" />
      </div>
    </q-slide-transition>

    <!-- Medication Edit Dialog -->
    <MedicationEditDialog
      v-model="showMedicationEditDialog"
      :medication-data="editingMedicationRow ? parseMedicationData(editingMedicationRow) : {}"
      :observation-id="editingMedicationRow?.observationId"
      :frequency-options="frequencyOptions"
      :route-options="routeOptions"
      @save="onMedicationEditSave"
      @cancel="onMedicationEditCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
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

const $q = useQuasar()
const visitStore = useVisitObservationStore()
const loggingStore = useLoggingStore()
const conceptStore = useConceptResolutionStore()
const logger = loggingStore.createLogger('ObservationFieldSet')

// State
const collapsed = ref(false)
const loading = ref(false)
const removedConcepts = ref(new Set()) // Track concepts removed by user
const resolvedConceptData = ref(new Map()) // Cache for resolved concept data
const pendingChanges = ref(new Map()) // Track pending changes per row

// Medication editing state
const showMedicationEditDialog = ref(false)
const editingMedicationRow = ref(null)

// Frequency and route options for medications - loaded from store
const frequencyOptions = ref([])
const routeOptions = ref([])

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

// Load medication options from store
const loadMedicationOptions = async () => {
  try {
    logger.debug('Loading medication options from concept resolution store')

    // Load frequency and route options in parallel
    const [freqOptions, routeOpts] = await Promise.all([conceptStore.getMedicationFrequencyOptions(), conceptStore.getMedicationRouteOptions()])

    frequencyOptions.value = freqOptions
    routeOptions.value = routeOpts

    logger.success('Medication options loaded successfully', {
      frequencyCount: freqOptions.length,
      routeCount: routeOpts.length,
    })
  } catch (error) {
    logger.error('Failed to load medication options', error)
    // Set empty arrays as fallback
    frequencyOptions.value = []
    routeOptions.value = []
  }
}

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
    // Sort by category first, then by concept name
    const categoryA = a.category || 'ZZZZZ'
    const categoryB = b.category || 'ZZZZZ'
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB)
    }
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
const findBestMatchingConcept = (observation) => {
  const obsConceptCode = observation.conceptCode

  // Find all potential matching concepts
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

  if (matches.length === 0) {
    logger.warn('No matching concept found for observation', {
      observationId: observation.observationId,
      obsConceptCode,
      availableConcepts: fieldSetConcepts.value.map((c) => c.code),
    })
    return null
  }

  // Prefer exact matches first, then numeric matches
  const exactMatch = matches.find((concept) => concept.code === obsConceptCode)
  return exactMatch || matches[0]
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

// Parse medication data from observation row
const parseMedicationData = (row) => {
  try {
    logger.debug('Parsing medication data for row', {
      rowId: row.id,
      rawObservation: row.rawObservation,
      origVal: row.origVal,
      currentVal: row.currentVal,
    })

    // Try to parse OBSERVATION_BLOB first
    if (row.rawObservation?.observation_blob || row.rawObservation?.OBSERVATION_BLOB) {
      const blobData = row.rawObservation.observation_blob || row.rawObservation.OBSERVATION_BLOB
      if (typeof blobData === 'string') {
        try {
          const parsed = JSON.parse(blobData)
          logger.debug('Successfully parsed BLOB data', { parsed })
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
    }

    // For basic medication data without BLOB, extract from TVAL_CHAR (drug name only)
    const drugName = row.rawObservation?.tval_char || row.rawObservation?.TVAL_CHAR || row.origVal || row.currentVal || ''

    if (drugName && drugName.trim()) {
      // Create basic medication data - BLOB will be loaded by the component
      const medicationData = {
        drugName: drugName.trim(), // TVAL_CHAR contains only the drug name
        dosage: row.rawObservation?.nval_num || row.rawObservation?.NVAL_NUM || null,
        dosageUnit: row.rawObservation?.unit_cd || row.rawObservation?.UNIT_CD || 'mg',
        frequency: '', // Will be loaded from BLOB by component
        route: '', // Will be loaded from BLOB by component
        instructions: '',
      }

      logger.debug('Created basic medication data from TVAL_CHAR - BLOB will be loaded by component', { medicationData })
      return medicationData
    }

    // Fallback to empty structure
    return {
      drugName: '',
      dosage: null,
      dosageUnit: 'mg',
      frequency: '',
      route: '',
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

// Enter medication edit mode
const enterMedicationEditMode = (row) => {
  logger.debug('Enter medication edit mode', { rowId: row.id })
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

    await visitStore.updateObservation(row.observationId, updateData, { skipReload: true })

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
    $q.notify({
      type: 'negative',
      message: 'Failed to save medication',
      position: 'top',
    })
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
      // Handle medication updates - save complex data in OBSERVATION_BLOB
      logger.debug('Saving medication row with complex data')

      // For medications, extract structured data and store drug name only in TVAL_CHAR
      const medicationData = parseMedicationData(row)

      const updateData = {
        TVAL_CHAR: medicationData.drugName, // Only drug name in TVAL_CHAR
        NVAL_NUM: medicationData.dosage ? parseFloat(medicationData.dosage) : null,
        OBSERVATION_BLOB: JSON.stringify(medicationData), // Full structured data
      }
      await visitStore.updateObservation(row.observationId, updateData, { skipReload: true })
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
      await visitStore.updateObservation(row.observationId, updateData, { skipReload: true })
    }

    // Update local state immediately - no need to wait for refresh
    pendingChanges.value.delete(row.id)

    // Update the raw observation in our local data to reflect the save
    // This prevents the need for a full refresh
    if (row.rawObservation) {
      switch (row.valueType) {
        case 'N': {
          const numericValue = parseFloat(row.currentVal)
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
          const medicationData = parseMedicationData(row)
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

    $q.notify({
      type: 'positive',
      message: 'Observation saved successfully',
      position: 'top',
    })

    logger.success('Row saved successfully', { rowId: row.id })

    // No delayed refresh needed - the computed property will update automatically
    // when pendingChanges is cleared
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
    await visitStore.deleteObservation(row.observationId)

    emit('observation-updated', {
      conceptCode: row.conceptCode,
      value: null,
      deleted: true,
      observationId: row.observationId,
    })

    $q.notify({
      type: 'positive',
      message: 'Observation removed successfully',
      position: 'top',
    })

    logger.success('Row removed successfully', { rowId: row.id })
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

const createObservationFromChip = async (concept) => {
  try {
    logger.info('Creating observation from chip', {
      conceptCode: concept.code,
      conceptName: concept.name,
    })

    // Get default values
    const observationData = {
      ENCOUNTER_NUM: props.visit.id,
      CONCEPT_CD: concept.code,
      VALTYPE_CD: concept.valueType,
      START_DATE: new Date().toISOString().split('T')[0],
      LOCATION_CD: 'VISITS_PAGE',
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
      TVAL_CHAR: concept.valueType === 'N' ? null : '',
      NVAL_NUM: concept.valueType === 'N' ? null : null,
      UNIT_CD: concept.unit || null,
      OBSERVATION_BLOB: null,
    }

    // Use visit store to create observation
    await visitStore.createObservation(observationData)

    // Emit update to refresh the field set
    emit('observation-updated', {
      conceptCode: concept.code,
      value: concept.valueType === 'N' ? null : '',
      added: true,
    })

    const displayName = resolvedConceptData.value.get(concept.code)?.label || concept.name
    $q.notify({
      type: 'positive',
      message: `${displayName} observation added`,
      position: 'top',
    })

    logger.success('Observation created from chip successfully', {
      conceptCode: concept.code,
    })
  } catch (error) {
    logger.error('Failed to create observation from chip', error, {
      conceptCode: concept.code,
    })

    const displayName = resolvedConceptData.value.get(concept.code)?.label || concept.name
    $q.notify({
      type: 'negative',
      message: `Failed to add ${displayName}`,
      position: 'top',
    })
  }
}

const addEmptyMedication = async () => {
  try {
    // Create empty medication observation
    const observationData = {
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

    await visitStore.createObservation(observationData)

    emit('observation-updated', {
      conceptCode: 'LID: 52418-1',
      value: '',
      added: true,
    })

    logger.info('Empty medication added successfully')

    $q.notify({
      type: 'positive',
      message: 'Empty medication slot added',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to add empty medication', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to add medication',
      position: 'top',
    })
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
