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
        <q-table v-if="tableRows.length > 0" :rows="tableRows" :columns="tableColumns" row-key="id" flat dense :pagination="{ rowsPerPage: 0 }" class="observations-table" :loading="loading">
          <!-- Custom Header with Resizer -->
          <template v-slot:header="props">
            <q-tr :props="props">
              <q-th v-for="col in props.cols" :key="col.name" :props="props" :class="`header-cell ${col.name}-header`">
                <div class="header-content">
                  <span>{{ col.label }}</span>
                  <!-- Column Resizer (only after observation column) -->
                  <div v-if="col.name === 'observation'" class="column-resizer" @mousedown="startResize" :class="{ resizing: isResizing }">
                    <div class="resizer-line"></div>
                    <q-tooltip>Drag to resize observation column</q-tooltip>
                  </div>
                </div>
              </q-th>
            </q-tr>
          </template>

          <!-- Type Column -->
          <template v-slot:body-cell-type="props">
            <q-td :props="props" class="type-cell">
              <ValueTypeIcon :value-type="props.row.valueType" size="28px" variant="chip" />
            </q-td>
          </template>

          <!-- Observation Name Column -->
          <template v-slot:body-cell-observation="props">
            <q-td :props="props" class="observation-name-cell">
              <div class="observation-info">
                <div class="observation-label">
                  {{ props.row.resolvedName || props.row.conceptName }}
                  <q-icon v-if="props.row.conceptCode.includes('LOINC')" name="science" size="12px" color="blue" class="q-ml-xs">
                    <q-tooltip>LOINC: {{ props.row.conceptCode }}</q-tooltip>
                  </q-icon>
                  <q-icon v-else-if="props.row.conceptCode.includes('SNOMED')" name="medical_services" size="12px" color="green" class="q-ml-xs">
                    <q-tooltip>SNOMED: {{ props.row.conceptCode }}</q-tooltip>
                  </q-icon>
                  <q-icon v-else name="code" size="12px" color="grey-6" class="q-ml-xs">
                    <q-tooltip>{{ props.row.conceptCode }}</q-tooltip>
                  </q-icon>
                </div>
              </div>
            </q-td>
          </template>

          <!-- Value Column -->
          <template v-slot:body-cell-value="props">
            <q-td :props="props" class="value-cell">
              <ObservationValueEditor
                :row-data="{
                  ...props.row,
                  // Map our origVal/currentVal to what the editor expects
                  originalValue: props.row.origVal,
                  currentValue: props.row.currentVal,
                  value: props.row.currentVal,
                }"
                :concept="getConcept(props.row.conceptCode)"
                :visit="visit"
                :patient="patient"
                :frequency-options="frequencyOptions"
                :route-options="routeOptions"
                @value-changed="onValueChanged"
                @save-requested="onSaveRequested"
              />
            </q-td>
          </template>

          <!-- Action Column -->
          <template v-slot:body-cell-actions="props">
            <q-td :props="props" class="action-cell">
              <div class="action-buttons">
                <!-- Save Button - only show if changed -->
                <q-btn v-if="props.row.hasChanges" flat round icon="save" size="sm" color="primary" :loading="props.row.saving" @click="saveRow(props.row)" class="save-btn">
                  <q-tooltip>Save changes</q-tooltip>
                </q-btn>

                <!-- Cancel Button - only show if changed -->
                <q-btn v-if="props.row.hasChanges" flat round icon="close" size="sm" color="grey-6" :disabled="props.row.saving" @click="cancelChanges(props.row)" class="cancel-btn">
                  <q-tooltip>Cancel changes</q-tooltip>
                </q-btn>

                <!-- Remove Button - show on hover -->
                <div v-if="!props.row.hasChanges" class="remove-button-container">
                  <AppRemoveConfirmationButton :loading="props.row.saving" @remove-confirmed="removeRow(props.row)" @remove-cancelled="() => {}" />
                </div>

                <!-- Clone Button - show if previous value exists -->
                <q-btn v-if="props.row.previousValue" flat round icon="content_copy" size="sm" color="secondary" :disabled="props.row.saving" @click="cloneFromPrevious(props.row)" class="clone-btn">
                  <q-tooltip>Clone from previous visit</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>
        </q-table>

        <!-- Empty State -->
        <div v-if="tableRows.length === 0" class="empty-observations">
          <q-icon name="assignment" size="48px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-sm">No observations yet</div>
          <div class="text-body2 text-grey-5">Add observations from the available options below</div>
        </div>

        <!-- Unfilled Observations - Compact Chips -->
        <div v-if="unfilledConcepts.length > 0" class="unfilled-observations">
          <div class="unfilled-section-header">
            <q-icon name="add_circle_outline" size="16px" class="q-mr-xs" />
            <span class="section-title">Available Observations</span>
            <q-badge :label="unfilledConcepts.length" color="grey-5" class="q-ml-sm" />
          </div>
          <div class="unfilled-chips">
            <q-chip
              v-for="concept in unfilledConcepts"
              :key="`unfilled-${concept.code}`"
              clickable
              outline
              icon="add"
              :label="concept.name"
              color="grey-6"
              text-color="grey-7"
              class="unfilled-chip"
              @click="createObservationFromChip(concept)"
            >
              <q-tooltip>Click to add {{ concept.name }}</q-tooltip>
            </q-chip>
          </div>
        </div>

        <!-- Add medication button (only for medications fieldset) -->
        <div v-if="props.fieldSet.id === 'medications'" class="add-medication">
          <q-btn flat icon="add" label="Add Medication" @click="addEmptyMedication()" class="full-width" style="border: 2px dashed #ccc" />
        </div>
      </div>
    </q-slide-transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import ObservationValueEditor from './ObservationValueEditor.vue'
import AppRemoveConfirmationButton from 'src/components/shared/AppRemoveConfirmationButton.vue'
import ValueTypeIcon from 'src/components/shared/ValueTypeIcon.vue'

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
const removedObservations = ref(new Set()) // Track observation IDs removed by user (for medications)
const resolvedConceptData = ref(new Map()) // Cache for resolved concept data
const pendingChanges = ref(new Map()) // Track pending changes per row

// Column resizing state
const observationColumnWidth = ref(150) // Default width
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(150)

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

// Table columns (dynamic width for observation column)
const tableColumns = computed(() => [
  {
    name: 'type',
    label: '',
    align: 'center',
    field: 'valueType',
    sortable: true,
    style: 'width: 8%',
  },
  {
    name: 'observation',
    label: '',
    align: 'left',
    field: 'conceptName',
    sortable: true,
    style: `width: ${observationColumnWidth.value}px; max-width: ${observationColumnWidth.value}px;`,
  },
  {
    name: 'value',
    label: 'Observations',
    align: 'left',
    field: 'displayValue',
    sortable: false,
    style: 'width: auto;',
  },
  {
    name: 'actions',
    label: '',
    align: 'center',
    field: 'actions',
    sortable: false,
    style: 'width: 15%',
  },
])

// Column resizing methods
const startResize = (event) => {
  event.preventDefault()
  isResizing.value = true
  resizeStartX.value = event.clientX
  resizeStartWidth.value = observationColumnWidth.value

  // Add global mouse event listeners
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  // Add visual feedback
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  logger.debug('Column resize started', {
    startX: resizeStartX.value,
    startWidth: resizeStartWidth.value,
  })
}

const handleResize = (event) => {
  if (!isResizing.value) return

  const deltaX = event.clientX - resizeStartX.value
  const newWidth = Math.max(100, Math.min(400, resizeStartWidth.value + deltaX)) // Min 100px, Max 400px

  observationColumnWidth.value = newWidth

  logger.debug('Column resizing', {
    deltaX,
    newWidth,
    clientX: event.clientX,
  })
}

const stopResize = () => {
  isResizing.value = false

  // Remove global mouse event listeners
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)

  // Remove visual feedback
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  logger.debug('Column resize stopped', {
    finalWidth: observationColumnWidth.value,
  })
}

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

  // Resolve concept names for all concepts in the field set
  await resolveFieldSetConceptNames()
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
      const notRemoved = !removedObservations.value.has(obs.observationId)
      return encounterMatch && isMedication && notRemoved
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

const getConcept = (conceptCode) => {
  return fieldSetConcepts.value.find((concept) => concept.code === conceptCode)
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
    case 'N': // Numeric
      return observation.nval_num || observation.NVAL_NUM || null
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
      // Handle medication updates differently
      // This would need to integrate with the medication store
      logger.debug('Saving medication row - this needs medication store integration')
      // For now, save as text in TVAL_CHAR
      const updateData = {
        TVAL_CHAR: String(row.currentVal),
        NVAL_NUM: null,
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
        case 'N':
          row.rawObservation.NVAL_NUM = parseFloat(row.currentVal)
          row.rawObservation.nval_num = parseFloat(row.currentVal)
          break
        default:
          row.rawObservation.TVAL_CHAR = String(row.currentVal)
          row.rawObservation.tval_char = String(row.currentVal)
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

    if (row.isMedication) {
      removedObservations.value.add(row.observationId)
    } else {
      await visitStore.deleteObservation(row.observationId)
    }

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

// Cleanup on component unmount
onUnmounted(() => {
  // Clean up event listeners if component is unmounted during resize
  if (isResizing.value) {
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
})
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

.observations-table {
  :deep(.q-table__top) {
    padding: 0;
  }

  :deep(.q-table__bottom) {
    display: none;
  }

  :deep(.q-td) {
    padding: 8px 12px;
    vertical-align: middle;
  }

  :deep(.q-th) {
    font-weight: 600;
    color: $grey-8;
    background: $grey-1;
  }

  .observation-name-cell {
    position: relative;

    .observation-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .observation-label {
      font-weight: 500;
      color: $grey-8;
      display: flex;
      align-items: center;
      word-break: break-word;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  // Custom header with resizer
  .header-cell {
    position: relative;

    .header-content {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    &.observation-header .header-content {
      justify-content: space-between;
    }

    .column-resizer {
      position: absolute;
      top: 0;
      right: -2px;
      width: 4px;
      height: 100%;
      cursor: col-resize;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      &:hover {
        background: rgba($primary, 0.1);

        .resizer-line {
          background: $primary;
          width: 2px;
        }
      }

      &.resizing {
        background: rgba($primary, 0.2);

        .resizer-line {
          background: $primary;
          width: 2px;
        }
      }

      .resizer-line {
        width: 1px;
        height: 20px;
        background: $grey-5;
        border-radius: 1px;
        transition: all 0.2s ease;
      }
    }
  }

  .type-cell {
    text-align: center;
  }

  .value-cell {
    /* Value editor will handle its own styling */
    min-width: 200px;
  }

  .action-cell {
    .action-buttons {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;

      .save-btn {
        background: rgba($primary, 0.1);
        border: 1px solid $primary;

        &:hover {
          background: $primary;
          color: white;
        }
      }

      .cancel-btn:hover {
        background: rgba($grey-6, 0.1);
      }

      .remove-button-container {
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .clone-btn {
        background: rgba($secondary, 0.1);
        border: 1px solid $secondary;

        &:hover {
          background: $secondary;
          color: white;
        }
      }
    }

    &:hover .remove-button-container {
      opacity: 1;
    }
  }
}

.empty-observations {
  text-align: center;
  padding: 3rem 2rem;
  color: $grey-6;
}

.unfilled-observations {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px dashed $grey-4;

  .unfilled-section-header {
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
    color: $grey-6;

    .section-title {
      font-size: 0.875rem;
      font-weight: 500;
    }
  }

  .unfilled-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;

    .unfilled-chip {
      transition: all 0.2s ease;
      cursor: pointer;
      font-size: 0.75rem;

      &:hover {
        background-color: rgba($primary, 0.08);
        border-color: $primary;
        color: $primary;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba($primary, 0.15);
      }
    }
  }
}

.add-medication {
  margin-top: 1rem;

  .q-btn {
    color: $grey-6;
    transition: all 0.3s ease;

    &:hover {
      color: $primary;
      border-color: $primary;
    }
  }
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
