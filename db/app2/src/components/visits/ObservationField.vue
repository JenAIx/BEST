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
        <!-- Normal Clear Button -->
        <q-btn v-if="hasValue && !showClearConfirmation" flat round icon="clear" size="sm" color="grey-6" @click="showClearConfirmation = true">
          <q-tooltip>Clear value</q-tooltip>
        </q-btn>

        <!-- Clear Confirmation Buttons -->
        <div v-if="showClearConfirmation" class="clear-confirmation">
          <q-btn flat round icon="check" size="sm" color="negative" @click="confirmClear" class="confirm-clear-btn">
            <q-tooltip>Confirm clear value</q-tooltip>
          </q-btn>
          <q-btn flat round icon="close" size="sm" color="grey-6" @click="cancelClear" class="cancel-clear-btn">
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>

    <div class="field-input">
      <!-- Numeric Input -->
      <div v-if="concept.valueType === 'N'" class="numeric-input">
        <q-input
          v-model.number="currentValue"
          type="number"
          :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`"
          outlined
          dense
          :suffix="concept.unit"
          @update:model-value="onValueChange"
          :loading="saving"
        >
          <template v-slot:prepend>
            <q-icon name="tag" />
          </template>
        </q-input>
      </div>

      <!-- Text Input -->
      <div v-else-if="concept.valueType === 'T'" class="text-input">
        <q-input v-model="currentValue" :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense @update:model-value="onValueChange" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="text_fields" />
          </template>
        </q-input>
      </div>

      <!-- Date Input -->
      <div v-else-if="concept.valueType === 'D'" class="date-input">
        <q-input v-model="currentValue" type="date" :label="`Enter ${(resolvedConceptName || concept.name).toLowerCase()}`" outlined dense @update:model-value="onValueChange" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="event" />
          </template>
        </q-input>
      </div>

      <!-- Selection Input (for coded values) -->
      <div v-else-if="concept.valueType === 'S'" class="selection-input">
        <q-select
          v-model="currentValue"
          :options="selectionOptions"
          :label="`Select ${(resolvedConceptName || concept.name).toLowerCase()}`"
          outlined
          dense
          emit-value
          map-options
          @update:model-value="onValueChange"
          :loading="saving"
        >
          <template v-slot:prepend>
            <q-icon name="list" />
          </template>
        </q-select>
      </div>

      <!-- Finding Input (for clinical findings) -->
      <div v-else-if="concept.valueType === 'F'" class="finding-input">
        <q-select
          v-model="currentValue"
          :options="selectionOptions"
          :label="`Assess ${(resolvedConceptName || concept.name).toLowerCase()}`"
          outlined
          dense
          emit-value
          map-options
          @update:model-value="onValueChange"
          :loading="saving"
        >
          <template v-slot:prepend>
            <q-icon name="medical_information" />
          </template>
        </q-select>
      </div>
    </div>

    <!-- Value Status -->
    <div class="field-status">
      <div v-if="hasValue" class="current-value">
        <q-icon name="check_circle" color="positive" size="16px" class="q-mr-xs" />
        <span class="value-text">{{ displayValue }}</span>
        <span v-if="lastUpdated" class="last-updated"> Updated {{ formatRelativeTime(lastUpdated) }} </span>
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
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
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
const dbStore = useDatabaseStore()
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
const showClearConfirmation = ref(false)

// Computed
const hasValue = computed(() => {
  return currentValue.value !== '' && currentValue.value !== null && currentValue.value !== undefined
})

const displayValue = computed(() => {
  if (!hasValue.value) return ''

  if (props.concept.valueType === 'N' && props.concept.unit) {
    return `${currentValue.value} ${props.concept.unit}`
  }

  return String(currentValue.value)
})

// Methods
const onValueChange = async (newValue) => {
  if (newValue === currentValue.value) return

  try {
    saving.value = true

    if (props.existingObservation) {
      // Update existing observation
      await updateObservation(newValue)
    } else {
      // Create new observation
      await createObservation(newValue)
    }

    lastUpdated.value = new Date()

    emit('observation-updated', {
      conceptCode: props.concept.code,
      value: newValue,
      unit: props.concept.unit,
      observationId: props.existingObservation?.observationId,
    })
  } catch (error) {
    logger.error('Failed to save observation', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save observation',
      position: 'top',
    })

    // Revert value on error
    currentValue.value = props.existingObservation?.originalValue || props.existingObservation?.value || ''
  } finally {
    saving.value = false
  }
}

const createObservation = async (value) => {
  const patientRepo = dbStore.getRepository('patient')
  const patient = await patientRepo.findByPatientCode(props.patient.id)

  const observationRepo = dbStore.getRepository('observation')

  // Get default values from global settings
  const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('VISITS_PAGE')
  const defaultCategory = await globalSettingsStore.getDefaultCategory('CLINICAL')

  const observationData = {
    PATIENT_NUM: patient.PATIENT_NUM,
    ENCOUNTER_NUM: props.visit.id,
    CONCEPT_CD: props.concept.code,
    VALTYPE_CD: props.concept.valueType,
    START_DATE: new Date().toISOString().split('T')[0],
    CATEGORY_CHAR: defaultCategory,
    PROVIDER_ID: 'SYSTEM',
    LOCATION_CD: 'VISITS_PAGE',
    SOURCESYSTEM_CD: defaultSourceSystem,
    INSTANCE_NUM: 1,
    UPLOAD_ID: 1,
  }

  if (props.concept.valueType === 'N') {
    observationData.NVAL_NUM = parseFloat(value)
  } else {
    observationData.TVAL_CHAR = String(value)
  }

  if (props.concept.unit) {
    observationData.UNIT_CD = props.concept.unit
  }

  await observationRepo.createObservation(observationData)
}

const updateObservation = async (value) => {
  const updateData = {}

  if (props.concept.valueType === 'N') {
    updateData.NVAL_NUM = parseFloat(value)
    updateData.TVAL_CHAR = null // Clear text value
  } else {
    updateData.TVAL_CHAR = String(value)
    updateData.NVAL_NUM = null // Clear numeric value
  }

  const updateQuery = `
        UPDATE OBSERVATION_FACT 
        SET TVAL_CHAR = ?, NVAL_NUM = ?, UPDATE_DATE = datetime('now')
        WHERE OBSERVATION_ID = ?
    `

  const result = await dbStore.executeQuery(updateQuery, [updateData.TVAL_CHAR, updateData.NVAL_NUM, props.existingObservation.observationId])

  if (!result.success) {
    throw new Error(result.error || 'Failed to update observation')
  }
}

const clearValue = async () => {
  if (props.existingObservation) {
    // Delete existing observation
    const deleteQuery = `DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?`
    const result = await dbStore.executeQuery(deleteQuery, [props.existingObservation.observationId])

    if (!result.success) {
      throw new Error('Failed to delete observation')
    }
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

const cloneFromPrevious = () => {
  if (props.previousValue) {
    currentValue.value = props.previousValue.value
    onValueChange(props.previousValue.value)
  }
}

const confirmClear = async () => {
  await clearValue()
  showClearConfirmation.value = false
}

const cancelClear = () => {
  showClearConfirmation.value = false
}

// Auto-hide clear confirmation after 5 seconds for safety
watch(
  () => showClearConfirmation.value,
  (newValue) => {
    if (newValue) {
      setTimeout(() => {
        if (showClearConfirmation.value) {
          showClearConfirmation.value = false
          logger.debug('Auto-cancelled clear confirmation after timeout')
        }
      }, 5000) // 5 seconds timeout
    }
  },
)

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
  logger.debug('ObservationField mounted', {
    conceptCode: props.concept.code,
    hasExistingObservation: !!props.existingObservation,
  })

  // Resolve concept name
  await resolveConceptName()

  // Load selection options for selection/finding type fields
  if (props.concept.valueType === 'S' || props.concept.valueType === 'F') {
    await loadSelectionOptions()
  }

  // Initialize value from existing observation
  if (props.existingObservation) {
    // Use originalValue from the store structure
    currentValue.value = props.existingObservation.originalValue || props.existingObservation.value || ''
    lastUpdated.value = new Date(props.existingObservation.date)
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

// Hide clear confirmation when value changes (typing while confirmation is shown)
watch(
  () => currentValue.value,
  () => {
    if (showClearConfirmation.value) {
      showClearConfirmation.value = false
    }
  },
)
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

    .clear-confirmation {
      display: flex;
      gap: 0.25rem;
      padding: 2px;
      background: rgba($negative, 0.1);
      border-radius: 20px;
      border: 1px solid rgba($negative, 0.2);
      animation: slideIn 0.3s ease;

      .confirm-clear-btn {
        background: rgba($negative, 0.1);
        transition: all 0.2s ease;

        &:hover {
          background: $negative;
          color: white;
          transform: scale(1.1);
        }
      }

      .cancel-clear-btn {
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
</style>
