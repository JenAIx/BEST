<template>
  <div class="medication-field">
    <div class="field-header">
      <div class="field-label">
        <q-icon name="medication" size="16px" color="primary" class="q-mr-xs" />
        {{ resolvedConceptName || concept.name }}
        <q-icon name="info" size="14px" color="grey-6" class="q-ml-xs">
          <q-tooltip>Medication: {{ concept.code }}</q-tooltip>
        </q-icon>
      </div>
      <div class="field-actions">
        <!-- Clear Button - only show in edit mode -->
        <q-btn v-if="!viewMode && hasValue && !showClearConfirmation" flat round icon="clear" size="sm" color="grey-6" @click="showClearConfirmation = true">
          <q-tooltip>Clear medication</q-tooltip>
        </q-btn>

        <!-- Clear Confirmation Buttons -->
        <div v-if="showClearConfirmation" class="clear-confirmation">
          <q-btn flat round icon="check" size="sm" color="negative" @click="confirmClear" class="confirm-clear-btn">
            <q-tooltip>Confirm clear medication</q-tooltip>
          </q-btn>
          <q-btn flat round icon="close" size="sm" color="grey-6" @click="cancelClear" class="cancel-clear-btn">
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>

    <!-- VIEW MODE -->
    <MedicationFieldView
      v-if="viewMode"
      :medication-data="medicationData"
      :frequency-options="frequencyOptions"
      :route-options="routeOptions"
      @delete="deleteMedication"
      @enter-edit-mode="enterEditMode"
    />

    <!-- EDIT MODE -->
    <MedicationFieldEdit
      v-else
      :medication-data="medicationData"
      :saving="saving"
      :frequency-options="frequencyOptions"
      :route-options="routeOptions"
      @save="onSaveChanges"
      @cancel="cancelEdit"
      @change="onMedicationDataChange"
    />

    <!-- Enhanced Clone Button - Bottom Right -->
    <div v-if="previousValue" class="clone-button-container">
      <q-btn flat round icon="content_copy" size="sm" color="primary" class="clone-btn" @click="cloneFromPrevious" @mouseenter="showClonePreview = true" @mouseleave="showClonePreview = false">
        <q-tooltip v-model="showClonePreview" class="clone-preview-tooltip" anchor="top middle" self="bottom middle" :offset="[0, 10]">
          <div class="clone-preview">
            <div class="preview-header">
              <q-icon name="history" size="16px" class="q-mr-xs" />
              Previous Medication
            </div>
            <div class="preview-date">
              <q-icon name="event" size="14px" class="q-mr-xs" />
              {{ formatVisitDate(previousValue.date) }}
            </div>
            <div class="preview-content">
              <q-icon name="medication" size="14px" class="q-mr-xs" />
              <strong>{{ previousValue.summary }}</strong>
            </div>
            <div class="preview-action">
              <q-icon name="mouse" size="12px" class="q-mr-xs" />
              Click to copy this prescription
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
import MedicationFieldView from './MedicationFieldView.vue'
import MedicationFieldEdit from './MedicationFieldEdit.vue'

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
const logger = loggingStore.createLogger('MedicationField')

// State
const medicationData = ref({
  drugName: '',
  dosage: null,
  dosageUnit: 'mg',
  frequency: '',
  route: '',
  instructions: '',
})

const saving = ref(false)
const lastUpdated = ref(null)
const resolvedConceptName = ref(null)
const showClonePreview = ref(false)
const showClearConfirmation = ref(false)
const viewMode = ref(true) // Always start in view mode (default)

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

// Computed
const hasValue = computed(() => {
  return medicationData.value.drugName || medicationData.value.dosage || medicationData.value.frequency || medicationData.value.route || medicationData.value.instructions
})

const medicationSummary = computed(() => {
  if (!hasValue.value) return ''

  const parts = [medicationData.value.drugName]

  if (medicationData.value.dosage && medicationData.value.dosageUnit) {
    parts.push(`${medicationData.value.dosage}${medicationData.value.dosageUnit}`)
  }

  if (medicationData.value.frequency) {
    const freq = frequencyOptions.find((f) => f.value === medicationData.value.frequency)
    parts.push(freq ? freq.label : medicationData.value.frequency)
  }

  if (medicationData.value.route) {
    const route = routeOptions.find((r) => r.value === medicationData.value.route)
    parts.push(route ? route.label : medicationData.value.route)
  }

  return parts.join(' • ')
})

// Mode switching methods
const enterEditMode = () => {
  viewMode.value = false
}

const onSaveChanges = async (medicationDataFromEdit) => {
  try {
    saving.value = true
    // Update local medication data
    medicationData.value = { ...medicationDataFromEdit }
    await onMedicationChange()
    viewMode.value = true
  } catch (error) {
    logger.error('Failed to save medication changes', error)
  } finally {
    saving.value = false
  }
}

const onMedicationDataChange = (newMedicationData) => {
  medicationData.value = { ...newMedicationData }
}

const cancelEdit = () => {
  // Restore original values if needed
  viewMode.value = true
}

const deleteMedication = async () => {
  try {
    logger.debug('Starting medication deletion', {
      conceptCode: props.concept.code,
      hasExistingObservation: !!props.existingObservation,
      existingObservation: props.existingObservation,
    })

    // If there's an existing observation, delete it from database
    if (props.existingObservation) {
      logger.info('Deleting existing observation from database', {
        conceptCode: props.concept.code,
        observationId: props.existingObservation.observationId,
      })
      await clearMedication()
    } else {
      logger.info('No existing observation to delete, removing empty field only', {
        conceptCode: props.concept.code,
      })
    }

    // Emit deletion event to parent
    emit('observation-updated', {
      conceptCode: props.concept.code,
      value: null,
      deleted: true,
      remove: true, // Signal to remove this medication field entirely
    })

    logger.info('Empty medication slot removed successfully', {
      conceptCode: props.concept.code,
      hadExistingObservation: !!props.existingObservation,
    })

    $q.notify({
      type: 'positive',
      message: 'Medication removed',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to delete medication', error, {
      conceptCode: props.concept.code,
      existingObservation: props.existingObservation,
    })
    $q.notify({
      type: 'negative',
      message: 'Failed to remove medication',
      position: 'top',
    })
  }
}

// Methods

const onMedicationChange = async () => {
  if (!hasValue.value) return

  try {
    saving.value = true

    if (props.existingObservation) {
      await updateMedication()
    } else {
      await createMedication()
    }

    lastUpdated.value = new Date()

    emit('observation-updated', {
      conceptCode: props.concept.code,
      value: medicationSummary.value,
      medicationData: medicationData.value,
      observationId: props.existingObservation?.observationId,
    })
  } catch (error) {
    logger.error('Failed to save medication', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save medication',
      position: 'top',
    })
  } finally {
    saving.value = false
  }
}

const createMedication = async () => {
  const patientRepo = dbStore.getRepository('patient')
  const patient = await patientRepo.findByPatientCode(props.patient.id)

  const observationRepo = dbStore.getRepository('observation')

  // Get default values from global settings
  const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('VISITS_PAGE')
  const defaultCategory = await globalSettingsStore.getDefaultCategory('MEDICATION')

  // Create the complex medication data structure
  const medicationBlob = {
    drugName: medicationData.value.drugName,
    dosage: medicationData.value.dosage,
    dosageUnit: medicationData.value.dosageUnit,
    frequency: medicationData.value.frequency,
    route: medicationData.value.route,
    instructions: medicationData.value.instructions,
    prescribedDate: new Date().toISOString(),
    prescribedBy: 'CURRENT_DOCTOR', // Would be actual doctor ID
    isActive: true,
  }

  const observationData = {
    PATIENT_NUM: patient.PATIENT_NUM,
    ENCOUNTER_NUM: props.visit.id,
    CONCEPT_CD: props.concept.code,
    VALTYPE_CD: 'M', // Medication type
    TVAL_CHAR: medicationData.value.drugName, // Primary drug name
    NVAL_NUM: medicationData.value.dosage, // Dosage amount
    UNIT_CD: medicationData.value.dosageUnit, // Dosage unit
    OBSERVATION_BLOB: JSON.stringify(medicationBlob), // Complete medication data
    START_DATE: new Date().toISOString().split('T')[0],
    CATEGORY_CHAR: defaultCategory,
    PROVIDER_ID: 'SYSTEM',
    LOCATION_CD: 'VISITS_PAGE',
    SOURCESYSTEM_CD: defaultSourceSystem,
    INSTANCE_NUM: 1,
    UPLOAD_ID: 1,
  }

  await observationRepo.createObservation(observationData)
}

const updateMedication = async () => {
  // Similar to createMedication but updates existing observation
  const medicationBlob = {
    drugName: medicationData.value.drugName,
    dosage: medicationData.value.dosage,
    dosageUnit: medicationData.value.dosageUnit,
    frequency: medicationData.value.frequency,
    route: medicationData.value.route,
    instructions: medicationData.value.instructions,
    prescribedDate: new Date().toISOString(),
    prescribedBy: 'CURRENT_DOCTOR',
    isActive: true,
  }

  const updateQuery = `
    UPDATE OBSERVATION_FACT 
    SET TVAL_CHAR = ?, 
        NVAL_NUM = ?, 
        UNIT_CD = ?,
        OBSERVATION_BLOB = ?,
        UPDATE_DATE = datetime('now')
    WHERE OBSERVATION_ID = ?
  `

  const result = await dbStore.executeQuery(updateQuery, [
    medicationData.value.drugName,
    medicationData.value.dosage,
    medicationData.value.dosageUnit,
    JSON.stringify(medicationBlob),
    props.existingObservation.observationId,
  ])

  if (!result.success) {
    throw new Error(result.error || 'Failed to update medication')
  }
}

const clearMedication = async () => {
  if (props.existingObservation) {
    // Delete existing observation (same approach as ObservationField.vue)
    const deleteQuery = `DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?`
    const result = await dbStore.executeQuery(deleteQuery, [props.existingObservation.observationId])

    if (!result.success) {
      throw new Error('Failed to delete observation')
    }
  }

  // Reset form
  medicationData.value = {
    drugName: '',
    dosage: null,
    dosageUnit: 'mg',
    frequency: '',
    route: '',
    instructions: '',
  }

  lastUpdated.value = new Date()

  emit('observation-updated', {
    conceptCode: props.concept.code,
    value: null,
    deleted: true,
  })

  $q.notify({
    type: 'info',
    message: 'Medication cleared',
    position: 'top',
  })
}

const confirmClear = async () => {
  try {
    await clearMedication()
    showClearConfirmation.value = false

    logger.info('Medication cleared successfully', {
      conceptCode: props.concept.code,
      patientId: props.patient.id,
    })
  } catch (error) {
    logger.error('Failed to clear medication', error)

    $q.notify({
      type: 'negative',
      message: 'Failed to clear medication',
      position: 'top',
    })

    showClearConfirmation.value = false
  }
}

const cancelClear = () => {
  showClearConfirmation.value = false
}

const cloneFromPrevious = () => {
  if (props.previousValue && props.previousValue.medicationData) {
    medicationData.value = { ...props.previousValue.medicationData }
    onMedicationChange()
  }
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

// Hide clear confirmation when medication changes
watch(
  () => medicationData.value,
  () => {
    if (showClearConfirmation.value) {
      showClearConfirmation.value = false
    }
  },
  { deep: true },
)

// Initialize medication data from existing observation
onMounted(async () => {
  logger.debug('MedicationField mounted', {
    conceptCode: props.concept.code,
    hasExistingObservation: !!props.existingObservation,
  })

  // Resolve concept name
  try {
    const resolved = await conceptStore.resolveConcept(props.concept.code, {
      context: 'medication',
      table: 'CONCEPT_DIMENSION',
      column: 'CONCEPT_CD',
    })

    resolvedConceptName.value = resolved.label || props.concept.name
    logger.debug('Medication concept name resolved', {
      conceptCode: props.concept.code,
      resolvedName: resolvedConceptName.value,
    })
  } catch (error) {
    logger.error('Failed to resolve medication concept name', error)
    resolvedConceptName.value = props.concept.name || 'Unknown Medication'
  }

  // Initialize from existing observation
  if (props.existingObservation) {
    try {
      if (props.existingObservation.observationBlob) {
        const parsedData = JSON.parse(props.existingObservation.observationBlob)
        medicationData.value = {
          drugName: parsedData.drugName || props.existingObservation.value || '',
          dosage: parsedData.dosage || props.existingObservation.numericValue || null,
          dosageUnit: parsedData.dosageUnit || props.existingObservation.unit || 'mg',
          frequency: parsedData.frequency || '',
          route: parsedData.route || '',
          instructions: parsedData.instructions || '',
        }
      } else {
        // Fallback for simple medication data
        medicationData.value.drugName = props.existingObservation.value || ''
        medicationData.value.dosage = props.existingObservation.numericValue || null
        medicationData.value.dosageUnit = props.existingObservation.unit || 'mg'
      }

      lastUpdated.value = new Date(props.existingObservation.date)
    } catch (error) {
      logger.error('Failed to parse existing medication data', error)
    }
  }

  // Always start in view mode (default)
  viewMode.value = true
})
</script>

<style lang="scss" scoped>
.medication-field {
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
