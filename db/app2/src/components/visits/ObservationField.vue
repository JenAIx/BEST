<template>
  <div class="observation-field">
    <div class="field-header">
      <div class="field-label">
        {{ concept.name }}
        <q-icon v-if="concept.system === 'LOINC'" name="science" size="14px" color="blue" class="q-ml-xs">
          <q-tooltip>LOINC Code</q-tooltip>
        </q-icon>
        <q-icon v-else-if="concept.system === 'SNOMED'" name="medical_services" size="14px" color="green" class="q-ml-xs">
          <q-tooltip>SNOMED Code</q-tooltip>
        </q-icon>
      </div>
      <div class="field-actions">
        <q-btn v-if="previousValue" flat round icon="content_copy" size="sm" color="grey-6" @click="cloneFromPrevious">
          <q-tooltip>Clone from previous: {{ previousValue.value }} {{ previousValue.unit }}</q-tooltip>
        </q-btn>
        <q-btn v-if="hasValue" flat round icon="clear" size="sm" color="grey-6" @click="clearValue">
          <q-tooltip>Clear value</q-tooltip>
        </q-btn>
      </div>
    </div>

    <div class="field-input">
      <!-- Numeric Input -->
      <div v-if="concept.valueType === 'N'" class="numeric-input">
        <q-input v-model.number="currentValue" type="number" :label="`Enter ${concept.name.toLowerCase()}`" outlined dense :suffix="concept.unit" @update:model-value="onValueChange" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="tag" />
          </template>
        </q-input>
        <div v-if="concept.unit" class="unit-display">{{ concept.unit }}</div>
      </div>

      <!-- Text Input -->
      <div v-else-if="concept.valueType === 'T'" class="text-input">
        <q-input v-model="currentValue" :label="`Enter ${concept.name.toLowerCase()}`" outlined dense @update:model-value="onValueChange" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="text_fields" />
          </template>
        </q-input>
      </div>

      <!-- Date Input -->
      <div v-else-if="concept.valueType === 'D'" class="date-input">
        <q-input v-model="currentValue" type="date" :label="`Enter ${concept.name.toLowerCase()}`" outlined dense @update:model-value="onValueChange" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="event" />
          </template>
        </q-input>
      </div>

      <!-- Selection Input (for coded values) -->
      <div v-else-if="concept.valueType === 'S'" class="selection-input">
        <q-select
          v-model="currentValue"
          :options="getSelectionOptions()"
          :label="`Select ${concept.name.toLowerCase()}`"
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'

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

// State
const currentValue = ref('')
const saving = ref(false)
const lastUpdated = ref(null)

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
    console.error('Failed to save observation:', error)
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

  const observationData = {
    PATIENT_NUM: patient.PATIENT_NUM,
    ENCOUNTER_NUM: props.visit.id,
    CONCEPT_CD: props.concept.code,
    VALTYPE_CD: props.concept.valueType,
    START_DATE: new Date().toISOString().split('T')[0],
    CATEGORY_CHAR: 'CLINICAL',
    PROVIDER_ID: 'SYSTEM',
    LOCATION_CD: 'VISITS_PAGE',
    SOURCESYSTEM_CD: 'VISITS_PAGE',
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

const getSelectionOptions = () => {
  // Return options based on concept code
  const commonOptions = {
    'SNOMED:25064002': [
      // Headache
      { label: 'None', value: 'none' },
      { label: 'Mild', value: 'mild' },
      { label: 'Moderate', value: 'moderate' },
      { label: 'Severe', value: 'severe' },
    ],
    'SNOMED:49727002': [
      // Cough
      { label: 'None', value: 'none' },
      { label: 'Dry cough', value: 'dry' },
      { label: 'Productive cough', value: 'productive' },
      { label: 'Persistent cough', value: 'persistent' },
    ],
  }

  return (
    commonOptions[props.concept.code] || [
      { label: 'Normal', value: 'normal' },
      { label: 'Abnormal', value: 'abnormal' },
    ]
  )
}

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

// Initialize value from existing observation
onMounted(() => {
  console.log('ObservationField mounted with:', {
    concept: props.concept,
    existingObservation: props.existingObservation,
  })

  if (props.existingObservation) {
    // Use originalValue from the store structure
    currentValue.value = props.existingObservation.originalValue || props.existingObservation.value || ''
    lastUpdated.value = new Date(props.existingObservation.date)
  }
})

// Watch for changes in existing observation
watch(
  () => props.existingObservation,
  (newObs) => {
    console.log('ObservationField watch triggered:', newObs)

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
</script>

<style lang="scss" scoped>
.observation-field {
  border: 1px solid $grey-3;
  border-radius: 8px;
  padding: 1rem;
  background: white;
  transition: all 0.3s ease;

  &:hover {
    border-color: $primary;
    box-shadow: 0 2px 8px rgba($primary, 0.1);
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
    gap: 0.25rem;
  }
}

.field-input {
  margin-bottom: 0.75rem;

  .numeric-input {
    position: relative;

    .unit-display {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: $grey-6;
      font-size: 0.8rem;
      pointer-events: none;
    }
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
</style>
