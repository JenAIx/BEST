<template>
  <div class="observation-field">
    <div class="field-header">
      <div class="field-label">
        {{ resolvedConceptName || concept.name }}
        <q-icon v-if="concept.system === 'LOINC'" name="science" size="14px" color="blue" class="q-ml-xs">
          <q-tooltip>LOINC Code: {{ concept.code }}</q-tooltip>
        </q-icon>
        <q-icon v-else-if="concept.system === 'SNOMED'" name="medical_services" size="14px" color="green" class="q-ml-xs">
          <q-tooltip>SNOMED Code: {{ concept.code }}</q-tooltip>
        </q-icon>
        <q-icon v-else name="code" size="14px" color="grey-6" class="q-ml-xs">
          <q-tooltip>Code: {{ concept.code }}</q-tooltip>
        </q-icon>
      </div>
      <div class="field-actions">
        <!-- Save/Cancel Buttons (shown when there are pending changes) -->
        <div v-if="hasPendingChanges" class="save-cancel-buttons">
          <q-btn flat round icon="close" size="sm" color="grey-6" @click="cancelChanges" class="cancel-btn">
            <q-tooltip>Cancel changes</q-tooltip>
          </q-btn>
          <q-btn flat round icon="save" size="sm" color="primary" @click="saveChanges" :loading="saving" class="save-btn">
            <q-tooltip>Save changes</q-tooltip>
          </q-btn>
        </div>

        <!-- Clear Button (shown when there's a value but no pending changes) -->
        <q-btn v-else-if="hasValue" flat round icon="clear" size="sm" color="grey-6" @click="clearValue">
          <q-tooltip>Clear value</q-tooltip>
        </q-btn>
      </div>
    </div>

    <div class="field-input">
      <!-- Numeric Input -->
      <div v-if="actualValueType === 'N'" class="numeric-input">
        <q-input v-model.number="currentValue" type="number" :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense :suffix="concept.unit" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="tag" />
          </template>
        </q-input>
      </div>

      <!-- Text Input -->
      <div v-else-if="actualValueType === 'T'" class="text-input">
        <q-input v-model="currentValue" :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense :loading="saving">
          <template v-slot:prepend>
            <q-icon name="text_fields" />
          </template>
        </q-input>
      </div>

      <!-- Date Input -->
      <div v-else-if="actualValueType === 'D'" class="date-input">
        <q-input v-model="currentValue" type="date" :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense :loading="saving">
          <template v-slot:prepend>
            <q-icon name="event" />
          </template>
        </q-input>
      </div>

      <!-- Selection Input (for coded values) -->
      <div v-else-if="actualValueType === 'S'" class="selection-input">
        <q-select v-model="currentValue" :options="selectionOptions" :label="`Select ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense emit-value map-options :loading="saving">
          <template v-slot:prepend>
            <q-icon name="list" />
          </template>
        </q-select>
      </div>

      <!-- Finding Input (for clinical findings) -->
      <div v-else-if="actualValueType === 'F'" class="finding-input">
        <q-select v-model="currentValue" :options="selectionOptions" :label="`Assess ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense emit-value map-options :loading="saving">
          <template v-slot:prepend>
            <q-icon name="medical_information" />
          </template>
        </q-select>
      </div>

      <!-- Answer Input (for questionnaire answers) -->
      <div v-else-if="actualValueType === 'A'" class="answer-input">
        <q-select v-model="currentValue" :options="selectionOptions" :label="`Answer ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense emit-value map-options :loading="saving">
          <template v-slot:prepend>
            <q-icon name="quiz" />
          </template>
        </q-select>
      </div>

      <!-- Raw Input (for raw data/files) -->
      <div v-else-if="actualValueType === 'R'" class="raw-input">
        <q-input v-model="currentValue" :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense type="textarea" rows="3" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="description" />
          </template>
        </q-input>
      </div>

      <!-- Default/Unknown Input -->
      <div v-else class="default-input">
        <q-input v-model="currentValue" :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense :loading="saving">
          <template v-slot:prepend>
            <q-icon name="help" />
          </template>
        </q-input>
        <div class="unknown-type-warning">
          <q-icon name="warning" color="orange" size="16px" class="q-mr-xs" />
          <span class="text-caption text-orange">Unknown value type: {{ actualValueType }}</span>
        </div>
      </div>
    </div>

    <!-- Value Status -->
    <div class="field-status">
      <div v-if="hasValue" class="current-value">
        <q-icon :name="hasPendingChanges ? 'schedule' : 'check_circle'" :color="hasPendingChanges ? 'warning' : 'positive'" size="16px" class="q-mr-xs" />
        <span class="value-text">{{ displayValue }}</span>
        <span v-if="hasPendingChanges" class="pending-changes"> (unsaved changes) </span>
        <span v-else-if="lastUpdated" class="last-updated"> Updated {{ formatRelativeTime(lastUpdated) }} </span>
      </div>
      <div v-else class="no-value">
        <q-icon name="radio_button_unchecked" color="grey-4" size="16px" class="q-mr-xs" />
        <span class="no-value-text">No value entered</span>
      </div>
    </div>

    <!-- Previous Value Comparison -->
    <div v-if="previousValue && hasValue && previousValue.value !== currentValue" class="value-comparison">
      <q-icon name="trending_up" color="info" size="16px" class="q-mr-xs" />
      <span class="comparison-text">
        Previous: {{ previousValue.value }} {{ previousValue.unit }}
        <q-icon :name="getChangeIcon()" :color="getChangeColor()" size="14px" class="q-ml-xs" />
      </span>
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

const displayValue = computed(() => {
  if (!hasValue.value) return ''

  if (actualValueType.value === 'N' && props.concept.unit) {
    return `${currentValue.value} ${props.concept.unit}`
  }

  return String(currentValue.value)
})

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

const clearValue = async () => {
  if (props.existingObservation) {
    // Use visit store to delete observation - it handles state updates
    await visitStore.deleteObservation(props.existingObservation.observationId)
  }

  currentValue.value = ''
  lastUpdated.value = new Date()

  emit('observation-updated', {
    conceptCode: props.concept.code,
    value: null,
    deleted: true,
  })

  $q.notify({
    type: 'info',
    message: 'Value cleared',
    position: 'top',
  })
}

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

// Cleanup timeout on unmount
onUnmounted(() => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
  }
})
</script>

<style lang="scss" scoped>
.observation-field {
  border: 1px solid $grey-3;
  border-radius: 8px;
  padding: 1rem;
  background: white;
  transition: all 0.3s ease;
  position: relative;

  &:hover {
    border-color: $primary;
    box-shadow: 0 2px 8px rgba($primary, 0.1);

    .clone-button-container {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;

  .field-label {
    font-weight: 600;
    color: $grey-8;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
  }

  .field-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;

    .save-cancel-buttons {
      display: flex;
      gap: 0.25rem;
      padding: 2px;
      background: rgba($primary, 0.1);
      border-radius: 20px;
      border: 1px solid rgba($primary, 0.2);
      animation: slideIn 0.3s ease;

      .save-btn {
        background: rgba($primary, 0.1);
        transition: all 0.2s ease;

        &:hover {
          background: $primary;
          color: white;
          transform: scale(1.1);
        }
      }

      .cancel-btn {
        transition: all 0.2s ease;

        &:hover {
          background: rgba($grey-6, 0.1);
          transform: scale(1.1);
        }
      }
    }
  }
}

.field-input {
  margin-bottom: 0.75rem;

  .numeric-input {
    position: relative;
  }

  .unknown-type-warning {
    display: flex;
    align-items: center;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: rgba($orange, 0.1);
    border-radius: 4px;
    border-left: 3px solid $orange;
  }
}

.field-status {
  margin-bottom: 0.5rem;

  .current-value {
    display: flex;
    align-items: center;
    color: $positive;
    font-size: 0.85rem;

    .value-text {
      font-weight: 500;
      margin-right: 0.5rem;
    }

    .last-updated {
      color: $grey-6;
      font-size: 0.75rem;
    }

    .pending-changes {
      color: $warning;
      font-size: 0.75rem;
      font-style: italic;
      animation: pulse 2s infinite;
    }
  }

  .no-value {
    display: flex;
    align-items: center;
    color: $grey-5;
    font-size: 0.85rem;
  }
}

.value-comparison {
  display: flex;
  align-items: center;
  color: $info;
  font-size: 0.8rem;
  padding: 0.5rem;
  background: rgba($info, 0.1);
  border-radius: 4px;

  .comparison-text {
    display: flex;
    align-items: center;
  }
}

:deep(.q-field--dense .q-field__control) {
  min-height: 40px;
}

:deep(.q-field__control) {
  border-radius: 6px;
}

// Enhanced Clone Button Styling
.clone-button-container {
  position: absolute;
  bottom: 8px;
  right: 8px;
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.3s ease;
  z-index: 10;

  .clone-btn {
    background: rgba(white, 0.95);
    border: 1px solid $primary;
    box-shadow: 0 2px 8px rgba($primary, 0.2);
    transition: all 0.3s ease;

    &:hover {
      background: $primary;
      color: white;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba($primary, 0.4);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.clone-preview-tooltip {
  .clone-preview {
    padding: 12px;
    min-width: 200px;
    background: $grey-9;
    border-radius: 8px;
    color: white;

    .preview-header {
      display: flex;
      align-items: center;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
      color: $blue-3;
    }

    .preview-date {
      display: flex;
      align-items: center;
      font-size: 12px;
      margin-bottom: 8px;
      color: $grey-4;
    }

    .preview-content {
      display: flex;
      align-items: center;
      font-size: 14px;
      margin-bottom: 8px;
      padding: 8px;
      background: rgba($primary, 0.1);
      border-radius: 4px;
      border-left: 3px solid $primary;

      strong {
        color: $primary;
        font-weight: 600;
      }

      .preview-unit {
        color: $grey-5;
        margin-left: 4px;
        font-size: 12px;
      }
    }

    .preview-action {
      display: flex;
      align-items: center;
      font-size: 11px;
      color: $grey-5;
      font-style: italic;
    }
  }
}

// Animations
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(10px) scale(0.9);
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
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}
</style>
