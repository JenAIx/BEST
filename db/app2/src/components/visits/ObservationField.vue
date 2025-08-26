<template>
  <div class="observation-field">
    <!-- Compact Label with Actions and Status -->
    <div class="field-label-row">
      <div class="field-label">
        {{ resolvedConceptName || concept.name }}
        <q-icon v-if="concept.system === 'LOINC'" name="science" size="12px" color="blue" class="q-ml-xs">
          <q-tooltip>LOINC: {{ concept.code }}</q-tooltip>
        </q-icon>
        <q-icon v-else-if="concept.system === 'SNOMED'" name="medical_services" size="12px" color="green" class="q-ml-xs">
          <q-tooltip>SNOMED: {{ concept.code }}</q-tooltip>
        </q-icon>
        <q-icon v-else name="code" size="12px" color="grey-6" class="q-ml-xs">
          <q-tooltip>{{ concept.code }}</q-tooltip>
        </q-icon>
        
        <!-- Status indicator next to label -->
        <span v-if="hasValue && !hasPendingChanges" class="status-indicator">
          <q-icon name="check_circle" color="positive" size="12px" class="q-ml-xs" />
          <span v-if="lastUpdated" class="update-time">{{ formatRelativeTime(lastUpdated) }}</span>
        </span>
        <span v-else-if="hasPendingChanges" class="status-indicator">
          <q-icon name="schedule" color="warning" size="12px" class="q-ml-xs" />
          <span class="pending-indicator">Unsaved</span>
        </span>
      </div>
      
      <!-- Action Buttons -->
      <div class="field-actions">
        <div v-if="hasPendingChanges" class="save-cancel-buttons">
          <q-btn flat round icon="close" size="xs" color="grey-6" @click="cancelChanges" class="cancel-btn">
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
          <q-btn flat round icon="save" size="xs" color="primary" @click="saveChanges" :loading="saving" class="save-btn">
            <q-tooltip>Save</q-tooltip>
          </q-btn>
        </div>
        <q-btn v-else-if="hasValue && !showRemoveConfirmation" flat round icon="close" size="xs" color="grey-6" @click="showRemoveConfirmation = true">
          <q-tooltip>Remove</q-tooltip>
        </q-btn>
        
        <!-- Remove Confirmation Buttons -->
        <div v-else-if="hasValue && showRemoveConfirmation" class="remove-confirmation-buttons">
          <q-btn flat round icon="close" size="xs" color="grey-6" @click="showRemoveConfirmation = false" class="cancel-remove-btn">
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
          <q-btn flat round icon="check" size="xs" color="negative" @click="confirmRemove" class="confirm-remove-btn">
            <q-tooltip>Confirm Remove</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>

    <div class="field-input">
      <!-- Numeric Input -->
      <div v-if="actualValueType === 'N'" class="numeric-input">
        <q-input v-model.number="currentValue" type="number" placeholder="Enter numeric value" outlined dense :loading="saving">
          <template v-slot:prepend>
            <q-icon name="tag" />
          </template>
          <template v-slot:append v-if="getDisplayUnit()">
            <q-chip size="sm" color="grey-3" text-color="grey-7" dense class="unit-chip">
              {{ getDisplayUnit() }}
            </q-chip>
          </template>
        </q-input>
      </div>

      <!-- Text Input -->
      <div v-else-if="actualValueType === 'T'" class="text-input">
        <q-input v-model="currentValue" placeholder="Enter text" outlined dense :loading="saving">
          <template v-slot:prepend>
            <q-icon name="text_fields" />
          </template>
        </q-input>
      </div>

      <!-- Date Input -->
      <div v-else-if="actualValueType === 'D'" class="date-input">
        <q-input v-model="currentValue" type="date" placeholder="Select date" outlined dense :loading="saving">
          <template v-slot:prepend>
            <q-icon name="event" />
          </template>
        </q-input>
      </div>

      <!-- Selection Input (for coded values) -->
      <div v-else-if="actualValueType === 'S'" class="selection-input">
        <q-select v-model="currentValue" :options="selectionOptions" placeholder="Select option" outlined dense emit-value map-options :loading="saving">
          <template v-slot:prepend>
            <q-icon name="list" />
          </template>
        </q-select>
      </div>

      <!-- Finding Input (for clinical findings) -->
      <div v-else-if="actualValueType === 'F'" class="finding-input">
        <q-select v-model="currentValue" :options="selectionOptions" placeholder="Select finding" outlined dense emit-value map-options :loading="saving">
          <template v-slot:prepend>
            <q-icon name="medical_information" />
          </template>
        </q-select>
      </div>

      <!-- Answer Input (for questionnaire answers) -->
      <div v-else-if="actualValueType === 'A'" class="answer-input">
        <q-select v-model="currentValue" :options="selectionOptions" placeholder="Select answer" outlined dense emit-value map-options :loading="saving">
          <template v-slot:prepend>
            <q-icon name="quiz" />
          </template>
        </q-select>
      </div>

      <!-- Raw Input (for raw data/files) -->
      <div v-else-if="actualValueType === 'R'" class="raw-input">
        <q-input v-model="currentValue" placeholder="Enter details" outlined dense type="textarea" rows="2" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="description" />
          </template>
        </q-input>
      </div>

      <!-- Default/Unknown Input -->
      <div v-else class="default-input">
        <q-input v-model="currentValue" placeholder="Enter value" outlined dense :loading="saving">
          <template v-slot:prepend>
            <q-icon name="help" />
          </template>
        </q-input>
        <div class="unknown-type-warning">
          <q-icon name="warning" color="orange" size="14px" class="q-mr-xs" />
          <span class="text-caption text-orange">Unknown value type: {{ actualValueType }}</span>
        </div>
      </div>
    </div>

    <!-- Status section removed - now shown inline with label -->

    <!-- Previous Value Comparison (Compact) -->
    <div v-if="previousValue && hasValue && previousValue.value !== currentValue" class="value-comparison">
      <q-icon :name="getChangeIcon()" :color="getChangeColor()" size="12px" class="q-mr-xs" />
      <span class="comparison-text">vs {{ previousValue.value }}{{ previousValue.unit ? ' ' + previousValue.unit : '' }}</span>
    </div>

    <!-- Enhanced Clone Button - Bottom Right -->
    <div v-if="previousValue" class="clone-button-container">
      <q-btn flat round icon="content_copy" size="sm" color="primary" class="clone-btn" @click="cloneFromPrevious" @mouseenter="showClonePreview = true" @mouseleave="showClonePreview = false">
        <q-tooltip v-model="showClonePreview" class="clone-preview-tooltip" anchor="top middle" self="bottom middle" :offset="[0, 10]">
          <div class="clone-preview">
            <div class="preview-header">
              <q-icon name="history" size="16px" class="q-mr-xs" />
              Previous Value
            </div>
            <div class="preview-date">
              <q-icon name="event" size="14px" class="q-mr-xs" />
              {{ formatVisitDate(previousValue.date) }}
            </div>
            <div class="preview-content">
              <q-icon name="content_copy" size="14px" class="q-mr-xs" />
              <strong>{{ previousValue.value }}</strong>
              <span v-if="previousValue.unit" class="preview-unit">{{ previousValue.unit }}</span>
            </div>
            <div class="preview-action">
              <q-icon name="mouse" size="12px" class="q-mr-xs" />
              Click to copy this value
            </div>
          </div>
        </q-tooltip>
      </q-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  concept: {
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
  existingObservation: {
    type: Object,
    default: null,
  },
  previousValue: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['observation-updated', 'clone-requested'])

const $q = useQuasar()
const visitStore = useVisitObservationStore()
const globalSettingsStore = useGlobalSettingsStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ObservationField')

// State
const currentValue = ref('')
const saving = ref(false)
const lastUpdated = ref(null)
const resolvedConceptName = ref(null)
const selectionOptions = ref([])
const showClonePreview = ref(false)
const showRemoveConfirmation = ref(false)
const removeConfirmationTimeout = ref(null)

const hasPendingChanges = ref(false)
const saveTimeout = ref(null)

// Computed
const hasValue = computed(() => {
  return currentValue.value !== '' && currentValue.value !== null && currentValue.value !== undefined
})

// Get the actual value type - use existing observation's VALTYPE_CD if available, otherwise use concept default
const actualValueType = computed(() => {
  return props.existingObservation?.valueType || props.existingObservation?.valTypeCode || props.concept.valueType
})

// displayValue removed - no longer needed since value is shown in input field

// Methods
const saveObservation = async (value) => {
  if (saving.value) {
    logger.warn('Save already in progress, skipping concurrent save', {
      conceptCode: props.concept.code,
      value,
    })
    return // Prevent concurrent saves
  }

  logger.info('Starting save observation', {
    conceptCode: props.concept.code,
    value,
    hasExistingObservation: !!props.existingObservation,
    existingObservationId: props.existingObservation?.observationId,
    visitId: props.visit?.id,
    patientId: props.patient?.id,
  })

  try {
    saving.value = true
    hasPendingChanges.value = false

    if (props.existingObservation && props.existingObservation.observationId) {
      // Update existing observation using OBSERVATION_ID
      logger.debug('Updating existing observation via store', {
        observationId: props.existingObservation.observationId,
        conceptCode: props.concept.code,
        newValue: value,
      })
      await updateObservation(value)
    } else {
      // Create new observation (no OBSERVATION_ID available)
      logger.debug('Creating new observation via store', {
        conceptCode: props.concept.code,
        value,
        visitId: props.visit.id,
        hasExistingObservation: !!props.existingObservation,
        existingObservationId: props.existingObservation?.observationId,
      })
      await createObservation(value)
    }

    lastUpdated.value = new Date()

    logger.success('Observation saved successfully', {
      conceptCode: props.concept.code,
      value,
      observationId: props.existingObservation?.observationId,
    })

    emit('observation-updated', {
      conceptCode: props.concept.code,
      value: value,
      unit: props.concept.unit,
      observationId: props.existingObservation?.observationId,
    })
  } catch (error) {
    logger.error('Failed to save observation', error, {
      conceptCode: props.concept.code,
      value,
      visitId: props.visit?.id,
      patientId: props.patient?.id,
    })
    $q.notify({
      type: 'negative',
      message: 'Failed to save observation',
      position: 'top',
    })

    // Revert value on error
    currentValue.value = props.existingObservation?.originalValue || props.existingObservation?.value || ''
    hasPendingChanges.value = false
  } finally {
    saving.value = false
    logger.debug('Save operation completed', {
      conceptCode: props.concept.code,
      saving: saving.value,
      hasPendingChanges: hasPendingChanges.value,
    })
  }
}

// Handle value changes without immediate saving for text/numeric inputs
const onValueChange = (newValue) => {
  const originalValue = props.existingObservation?.originalValue || props.existingObservation?.value || ''

  console.log('🔍 ObservationField onValueChange triggered!', {
    conceptCode: props.concept.code,
    newValue,
    originalValue,
    valueType: props.concept.valueType,
    isDifferentFromOriginal: newValue !== originalValue,
  })

  logger.debug('Value change detected', {
    conceptCode: props.concept.code,
    newValue,
    originalValue,
    valueType: props.concept.valueType,
  })

  // Check if the new value is different from the original/saved value
  if (newValue === originalValue) {
    console.log('🔄 Value matches original, no pending changes')
    hasPendingChanges.value = false
    return
  }

  hasPendingChanges.value = true
  console.log('✅ Set hasPendingChanges to true!', {
    conceptCode: props.concept.code,
    hasPendingChanges: hasPendingChanges.value,
  })

  logger.debug('Marked as having pending changes', {
    conceptCode: props.concept.code,
    hasPendingChanges: hasPendingChanges.value,
  })
}

const createObservation = async (value) => {
  logger.debug('Creating observation - preparing data', {
    conceptCode: props.concept.code,
    value,
    visitId: props.visit.id,
    valueType: props.concept.valueType,
  })

  // Get default values from global settings
  const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('VISITS_PAGE')
  const defaultCategory = await globalSettingsStore.getDefaultCategory('CLINICAL')

  const valueType = actualValueType.value
  const observationData = {
    ENCOUNTER_NUM: props.visit.id,
    CONCEPT_CD: props.concept.code,
    VALTYPE_CD: valueType,
    START_DATE: new Date().toISOString().split('T')[0],
    CATEGORY_CHAR: defaultCategory,
    PROVIDER_ID: 'SYSTEM',
    LOCATION_CD: 'VISITS_PAGE',
    SOURCESYSTEM_CD: defaultSourceSystem,
    INSTANCE_NUM: 1,
    UPLOAD_ID: 1,
  }

  // Save numeric values to NVAL_NUM, all others to TVAL_CHAR
  if (valueType === 'N') {
    observationData.NVAL_NUM = parseFloat(value)
    observationData.TVAL_CHAR = null // Explicitly clear text value
  } else {
    // T (text), D (date), R (raw), S (selection), A (answer), F (finding) all go to TVAL_CHAR
    observationData.TVAL_CHAR = String(value)
    observationData.NVAL_NUM = null // Explicitly clear numeric value
  }

  if (props.concept.unit) {
    observationData.UNIT_CD = props.concept.unit
  }

  logger.debug('Calling visitStore.createObservation', {
    observationData,
    storeSelectedVisit: visitStore.selectedVisit?.id,
    storeSelectedPatient: visitStore.selectedPatient?.id,
  })

  // Use visit store to create observation - it handles patient lookup and state updates
  const result = await visitStore.createObservation(observationData)

  logger.debug('visitStore.createObservation completed', {
    conceptCode: props.concept.code,
    result,
  })

  return result
}

const updateObservation = async (value) => {
  logger.debug('Updating observation - preparing data', {
    conceptCode: props.concept.code,
    observationId: props.existingObservation.observationId,
    value,
    valueType: props.concept.valueType,
  })

  const updateData = {}

  // Update numeric values to NVAL_NUM, all others to TVAL_CHAR
  const valueType = actualValueType.value
  if (valueType === 'N') {
    updateData.NVAL_NUM = parseFloat(value)
    updateData.TVAL_CHAR = null // Explicitly clear text value
  } else {
    // T (text), D (date), R (raw), S (selection), A (answer), F (finding) all go to TVAL_CHAR
    updateData.TVAL_CHAR = String(value)
    updateData.NVAL_NUM = null // Explicitly clear numeric value
  }

  logger.debug('Calling visitStore.updateObservation', {
    observationId: props.existingObservation.observationId,
    updateData,
    storeSelectedVisit: visitStore.selectedVisit?.id,
    storeSelectedPatient: visitStore.selectedPatient?.id,
  })

  // Use visit store to update observation - it handles state updates
  const result = await visitStore.updateObservation(props.existingObservation.observationId, updateData)

  logger.debug('visitStore.updateObservation completed', {
    conceptCode: props.concept.code,
    observationId: props.existingObservation.observationId,
    result,
  })

  return result
}

const confirmRemove = async () => {
  try {
    if (props.existingObservation) {
      // Use visit store to delete observation - it handles state updates
      await visitStore.deleteObservation(props.existingObservation.observationId)
    }

    currentValue.value = ''
    lastUpdated.value = new Date()
    showRemoveConfirmation.value = false

    emit('observation-updated', {
      conceptCode: props.concept.code,
      value: null,
      deleted: true,
    })

    $q.notify({
      type: 'positive',
      message: 'Value removed successfully',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to remove observation', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to remove value',
      position: 'top',
    })
  }
}

// clearValue method removed - functionality now handled by confirmRemove with inline confirmation

const cloneFromPrevious = async () => {
  if (props.previousValue) {
    currentValue.value = props.previousValue.value
    hasPendingChanges.value = true
  }
}

const saveChanges = async () => {
  logger.info('Save button clicked', {
    conceptCode: props.concept.code,
    value: currentValue.value,
    hasExistingObservation: !!props.existingObservation,
  })

  if (!currentValue.value && currentValue.value !== 0) {
    logger.warn('No value to save, cancelling', { conceptCode: props.concept.code })
    cancelChanges()
    return
  }

  await saveObservation(currentValue.value)
}

const cancelChanges = () => {
  logger.debug('Cancel button clicked', {
    conceptCode: props.concept.code,
    currentValue: currentValue.value,
    originalValue: props.existingObservation?.originalValue || props.existingObservation?.value,
  })

  // Revert to original value
  if (props.existingObservation) {
    currentValue.value = props.existingObservation.originalValue || props.existingObservation.value || ''
  } else {
    currentValue.value = ''
  }

  hasPendingChanges.value = false

  // Clear any pending timeouts
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
    saveTimeout.value = null
  }
}

// Selection options are now loaded dynamically from concept resolution store
// See loadSelectionOptions() function and selectionOptions reactive ref

const getChangeIcon = () => {
  if (!props.previousValue || props.concept.valueType !== 'N') return 'compare_arrows'

  const current = parseFloat(currentValue.value)
  const previous = parseFloat(props.previousValue.value)

  if (current > previous) return 'trending_up'
  if (current < previous) return 'trending_down'
  return 'trending_flat'
}

const getDisplayUnit = () => {
  // Priority: existing observation unit > concept unit
  return props.existingObservation?.unit || props.concept.unit || null
}

const getChangeColor = () => {
  if (!props.previousValue || props.concept.valueType !== 'N') return 'grey'

  const current = parseFloat(currentValue.value)
  const previous = parseFloat(props.previousValue.value)

  if (current > previous) return 'positive'
  if (current < previous) return 'negative'
  return 'grey'
}

const formatRelativeTime = (date) => {
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const formatVisitDate = (date) => {
  if (!date) return 'Unknown date'

  try {
    const visitDate = new Date(date)
    const now = new Date()
    const diffTime = now - visitDate
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }

    const formattedDate = visitDate.toLocaleDateString('en-US', options)

    if (diffDays === 0) {
      return `Today, ${visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 1) {
      return `Yesterday, ${visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays < 7) {
      return `${diffDays} days ago, ${visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return formattedDate
    }
  } catch {
    return date.toString()
  }
}

// Initialize value from existing observation and resolve concept
onMounted(async () => {
  console.log('🚀 ObservationField mounted!', {
    conceptCode: props.concept.code,
    conceptName: props.concept.name,
    conceptValueType: props.concept.valueType,
    actualValueType: actualValueType.value,
    existingObservationValueType: props.existingObservation?.valueType,
    existingObservationValTypeCode: props.existingObservation?.valTypeCode,
  })

  logger.info('ObservationField mounted', {
    conceptCode: props.concept.code,
    conceptName: props.concept.name,
    conceptValueType: props.concept.valueType,
    actualValueType: actualValueType.value,
    hasExistingObservation: !!props.existingObservation,
    existingObservationId: props.existingObservation?.observationId,
    existingValue: props.existingObservation?.originalValue || props.existingObservation?.value,
    visitId: props.visit?.id,
    patientId: props.patient?.id,
    storeSelectedVisit: visitStore.selectedVisit?.id,
    storeSelectedPatient: visitStore.selectedPatient?.id,
  })

  // Resolve concept name
  await resolveConceptName()

  // Load selection options for selection/finding type fields
  const valueType = actualValueType.value
  if (valueType === 'S' || valueType === 'F' || valueType === 'A') {
    await loadSelectionOptions()
  }

  // Initialize value from existing observation
  if (props.existingObservation) {
    // Use originalValue from the store structure
    const initialValue = props.existingObservation.originalValue || props.existingObservation.value || ''
    currentValue.value = initialValue
    lastUpdated.value = new Date(props.existingObservation.date)

    logger.debug('Initialized with existing observation value', {
      conceptCode: props.concept.code,
      initialValue,
      lastUpdated: lastUpdated.value,
    })
  } else {
    logger.debug('No existing observation, starting with empty value', {
      conceptCode: props.concept.code,
    })
  }
})

// Resolve concept name using concept resolution store
const resolveConceptName = async () => {
  try {
    const resolved = await conceptStore.resolveConcept(props.concept.code, {
      context: 'observation',
      table: 'CONCEPT_DIMENSION',
      column: 'CONCEPT_CD',
    })

    resolvedConceptName.value = resolved.label || props.concept.name
    logger.debug('Concept name resolved', {
      conceptCode: props.concept.code,
      resolvedName: resolvedConceptName.value,
    })
  } catch (error) {
    logger.error('Failed to resolve concept name', error, { conceptCode: props.concept.code })
    resolvedConceptName.value = props.concept.name || 'Unknown Concept'
  }
}

// Load selection options for selection and finding type fields
const loadSelectionOptions = async () => {
  try {
    if (props.concept.valueType === 'S') {
      // For selection type, get standard selection options
      selectionOptions.value = await conceptStore.getSelectionOptions(props.concept.code)
    } else if (props.concept.valueType === 'F') {
      // For finding type, get finding-specific options
      selectionOptions.value = await conceptStore.getFindingOptions(props.concept.code)
    } else if (props.concept.valueType === 'A') {
      // For answer type, get answer-specific options
      selectionOptions.value = await conceptStore.getAnswerOptions(props.concept.code)
    }

    logger.debug('Selection options loaded', {
      conceptCode: props.concept.code,
      optionsCount: selectionOptions.value.length,
    })
  } catch (error) {
    logger.error('Failed to load selection options', error, { conceptCode: props.concept.code })
    // Fallback to basic options
    selectionOptions.value = [
      { label: 'Normal', value: 'normal' },
      { label: 'Abnormal', value: 'abnormal' },
    ]
  }
}

// Watch for changes in currentValue to detect user input
watch(
  () => currentValue.value,
  (newValue, oldValue) => {
    // Don't trigger on initial mount or when we're programmatically setting the value
    if (oldValue !== undefined && newValue !== oldValue) {
      console.log('🔍 currentValue watcher triggered!', {
        conceptCode: props.concept.code,
        oldValue,
        newValue,
        valueType: props.concept.valueType,
      })
      onValueChange(newValue)
    }
  },
)

// Watch for changes in existing observation
watch(
  () => props.existingObservation,
  (newObs) => {
    logger.debug('ObservationField watch triggered', { hasObservation: !!newObs })

    if (newObs) {
      // Use originalValue from the store structure
      currentValue.value = newObs.originalValue || newObs.value || ''
      lastUpdated.value = new Date(newObs.date)
    } else {
      currentValue.value = ''
      lastUpdated.value = null
    }
  },
)

// Cleanup timeouts on unmount
onUnmounted(() => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
  if (removeConfirmationTimeout.value) {
    clearTimeout(removeConfirmationTimeout.value)
  }
})
</script>

<style lang="scss" scoped>
.observation-field {
  border: 1px solid $grey-3;
  border-radius: 6px;
  padding: 0.75rem;
  background: white;
  transition: all 0.3s ease;
  position: relative;

  &:hover {
    border-color: $primary;
    box-shadow: 0 1px 4px rgba($primary, 0.1);

    .field-actions {
      opacity: 1;
    }

    .clone-button-container {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;

  .field-label {
    font-weight: 500;
    color: $grey-8;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    
    .status-indicator {
      display: flex;
      align-items: center;
      margin-left: 0.5rem;
      font-size: 0.75rem;
      
      .update-time {
        color: $grey-6;
        margin-left: 0.25rem;
      }
      
      .pending-indicator {
        color: $warning;
        margin-left: 0.25rem;
        animation: pulse 1.5s infinite;
      }
    }
  }

  .field-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.2s ease;

    .save-cancel-buttons {
      display: flex;
      gap: 0.125rem;
      padding: 1px;
      background: rgba($primary, 0.08);
      border-radius: 12px;
      border: 1px solid rgba($primary, 0.15);
      animation: slideIn 0.2s ease;

      .save-btn, .cancel-btn {
        transition: all 0.15s ease;

        &:hover {
          transform: scale(1.05);
        }
      }

      .save-btn:hover {
        background: $primary;
        color: white;
      }

      .cancel-btn:hover {
        background: rgba($grey-6, 0.1);
      }
    }
    
    .remove-confirmation-buttons {
      display: flex;
      gap: 0.125rem;
      padding: 1px;
      background: rgba($negative, 0.08);
      border-radius: 12px;
      border: 1px solid rgba($negative, 0.15);
      animation: slideIn 0.2s ease;
      
      .confirm-remove-btn {
        transition: all 0.15s ease;
        
        &:hover {
          background: $negative;
          color: white;
          transform: scale(1.05);
        }
      }
      
      .cancel-remove-btn {
        transition: all 0.15s ease;
        
        &:hover {
          background: rgba($grey-6, 0.1);
          transform: scale(1.05);
        }
      }
    }
  }
}

.field-input {
  margin-bottom: 0.25rem;

  .numeric-input {
    position: relative;
    
    .unit-chip {
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 4px;
      margin-right: 4px;
      
      &:deep(.q-chip__content) {
        padding: 0 6px;
      }
    }
  }

  .unknown-type-warning {
    display: flex;
    align-items: center;
    margin-top: 0.25rem;
    padding: 0.375rem 0.5rem;
    background: rgba($orange, 0.08);
    border-radius: 3px;
    border-left: 2px solid $orange;
    font-size: 0.75rem;
  }
}

// Field status now integrated into label row

.value-comparison {
  display: flex;
  align-items: center;
  color: $info;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: rgba($info, 0.06);
  border-radius: 3px;
  margin-bottom: 0.25rem;

  .comparison-text {
    font-weight: 500;
  }
}

:deep(.q-field--dense .q-field__control) {
  min-height: 36px;
}

:deep(.q-field__control) {
  border-radius: 4px;
}

// Compact Clone Button Styling
.clone-button-container {
  position: absolute;
  bottom: 6px;
  right: 6px;
  opacity: 0;
  transform: translateY(2px);
  transition: all 0.25s ease;
  z-index: 10;

  .clone-btn {
    background: rgba(white, 0.95);
    border: 1px solid $primary;
    box-shadow: 0 1px 4px rgba($primary, 0.15);
    transition: all 0.2s ease;
    width: 28px;
    height: 28px;

    &:hover {
      background: $primary;
      color: white;
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba($primary, 0.3);
    }

    &:active {
      transform: scale(0.98);
    }
  }
}

.clone-preview-tooltip {
  .clone-preview {
    padding: 8px 10px;
    min-width: 180px;
    background: $grey-9;
    border-radius: 6px;
    color: white;

    .preview-header {
      display: flex;
      align-items: center;
      font-weight: 500;
      font-size: 12px;
      margin-bottom: 6px;
      color: $blue-3;
    }

    .preview-date {
      display: flex;
      align-items: center;
      font-size: 11px;
      margin-bottom: 6px;
      color: $grey-4;
    }

    .preview-content {
      display: flex;
      align-items: center;
      font-size: 12px;
      margin-bottom: 6px;
      padding: 6px;
      background: rgba($primary, 0.1);
      border-radius: 3px;
      border-left: 2px solid $primary;

      strong {
        color: $primary;
        font-weight: 500;
      }

      .preview-unit {
        color: $grey-5;
        margin-left: 3px;
        font-size: 11px;
      }
    }

    .preview-action {
      display: flex;
      align-items: center;
      font-size: 10px;
      color: $grey-5;
      font-style: italic;
    }
  }
}

// Compact Animations
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(6px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}
</style>
