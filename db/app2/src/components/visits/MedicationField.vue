<template>
  <div class="medication-field col-12">
    <!-- Header - only show in edit mode -->
    <div v-if="!viewMode" class="field-header">
      <div class="field-label">
        <q-icon name="medication" size="16px" color="primary" class="q-mr-xs" />
        {{ resolvedConceptName || concept.name }}
        <q-icon name="info" size="14px" color="grey-6" class="q-ml-xs">
          <q-tooltip>Medication: {{ concept.code }}</q-tooltip>
        </q-icon>
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
      @clear-medication="clearMedication"
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
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useMedicationsStore } from 'src/stores/medications-store'
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
const medicationsStore = useMedicationsStore()
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
  // At minimum, we need a drug name to consider this a valid medication
  const result = !!(medicationData.value.drugName && medicationData.value.drugName.trim())

  logger.debug('hasValue computed', {
    result,
    drugName: medicationData.value.drugName,
    dosage: medicationData.value.dosage,
    frequency: medicationData.value.frequency,
    route: medicationData.value.route,
    instructions: medicationData.value.instructions,
  })

  return result
})

const medicationSummary = computed(() => {
  if (!hasValue.value) return ''

  const parts = [medicationData.value.drugName]

  // Only add dosage if both dosage and unit are present
  if (medicationData.value.dosage && medicationData.value.dosageUnit) {
    parts.push(`${medicationData.value.dosage}${medicationData.value.dosageUnit}`)
  }

  // Only add frequency if it's not empty
  if (medicationData.value.frequency && medicationData.value.frequency.trim()) {
    const freq = frequencyOptions.find((f) => f.value === medicationData.value.frequency)
    parts.push(freq ? freq.label : medicationData.value.frequency)
  }

  // Only add route if it's not empty
  if (medicationData.value.route && medicationData.value.route.trim()) {
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

    logger.debug('Saving medication changes', {
      conceptCode: props.concept.code,
      medicationDataFromEdit,
      hasExistingObservation: !!props.existingObservation,
    })

    // Normalize the medication data - convert empty strings to appropriate values
    const normalizedData = {
      drugName: medicationDataFromEdit.drugName?.trim() || '',
      dosage: medicationDataFromEdit.dosage || null,
      dosageUnit: medicationDataFromEdit.dosageUnit || 'mg',
      frequency: typeof medicationDataFromEdit.frequency === 'string' ? medicationDataFromEdit.frequency.trim() || '' : medicationDataFromEdit.frequency?.value || '',
      route: typeof medicationDataFromEdit.route === 'string' ? medicationDataFromEdit.route.trim() || '' : medicationDataFromEdit.route?.value || '',
      instructions: medicationDataFromEdit.instructions?.trim() || '',
    }

    // Update local medication data
    medicationData.value = { ...normalizedData }

    logger.debug('Updated local medication data', {
      medicationData: medicationData.value,
      hasValue: hasValue.value,
    })

    await onMedicationChange()
    viewMode.value = true

    logger.info('Medication changes saved successfully')
  } catch (error) {
    logger.error('Failed to save medication changes', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save medication changes',
      position: 'top',
    })
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

      const success = await medicationsStore.deleteMedication({
        observationId: props.existingObservation.observationId,
      })

      if (!success) {
        throw new Error('Failed to delete medication from database')
      }
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
  logger.debug('onMedicationChange called', {
    hasValue: hasValue.value,
    medicationData: medicationData.value,
    hasExistingObservation: !!props.existingObservation,
  })

  if (!hasValue.value) {
    logger.warn('onMedicationChange: No value detected, skipping save')
    return
  }

  try {
    saving.value = true

    logger.debug('Starting medication save operation')

    let result
    if (props.existingObservation) {
      logger.debug('Updating existing medication observation')
      result = await medicationsStore.updateMedication({
        observationId: props.existingObservation.observationId,
        medicationData: medicationData.value,
      })
    } else {
      logger.debug('Creating new medication observation')
      result = await medicationsStore.createMedication({
        patientId: props.patient.id,
        visitId: props.visit.id,
        medicationData: medicationData.value,
      })
    }

    lastUpdated.value = new Date()

    logger.debug('Emitting observation-updated event', {
      conceptCode: props.concept.code,
      value: medicationSummary.value,
      medicationData: medicationData.value,
    })

    emit('observation-updated', {
      conceptCode: props.concept.code,
      value: medicationSummary.value,
      medicationData: medicationData.value,
      observationId: result.observationId,
    })

    logger.info('Medication saved successfully to database')
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

const clearMedication = async () => {
  try {
    // If there's an existing observation, clear it in the database
    if (props.existingObservation) {
      const success = await medicationsStore.clearMedication({
        observationId: props.existingObservation.observationId,
      })

      if (!success) {
        throw new Error('Failed to clear medication in database')
      }
    }

    // Reset form data
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
  } catch (error) {
    logger.error('Failed to clear medication', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to clear medication',
      position: 'top',
    })
  }
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
      logger.debug('Initializing from existing observation', {
        existingObservation: props.existingObservation,
        hasValue: !!props.existingObservation.value,
        hasNumericValue: !!props.existingObservation.numericValue,
        hasObservationBlob: !!props.existingObservation.observationBlob,
      })

      if (props.existingObservation.observationBlob) {
        try {
          const parsedData = JSON.parse(props.existingObservation.observationBlob)
          medicationData.value = {
            drugName: parsedData.drugName || props.existingObservation.value || '',
            dosage: parsedData.dosage || props.existingObservation.numericValue || null,
            dosageUnit: parsedData.dosageUnit || props.existingObservation.unit || 'mg',
            frequency: parsedData.frequency || '',
            route: parsedData.route || '',
            instructions: parsedData.instructions || '',
          }

          logger.debug('Initialized medication data from BLOB', {
            parsedData,
            medicationData: medicationData.value,
          })
        } catch (blobError) {
          logger.warn('Failed to parse OBSERVATION_BLOB, falling back to basic fields', blobError)
          // If BLOB parsing fails, use basic fields
          medicationData.value = {
            drugName: props.existingObservation.value || '',
            dosage: props.existingObservation.numericValue || null,
            dosageUnit: props.existingObservation.unit || 'mg',
            frequency: '',
            route: '',
            instructions: '',
          }
        }
      } else {
        // Fallback for simple medication data (only TVAL_CHAR, NVAL_NUM, UNIT_CD set)
        medicationData.value = {
          drugName: props.existingObservation.value || '',
          dosage: props.existingObservation.numericValue || null,
          dosageUnit: props.existingObservation.unit || 'mg',
          frequency: '',
          route: '',
          instructions: '',
        }

        logger.debug('Initialized medication data from fallback (basic fields only)', {
          medicationData: medicationData.value,
          originalObservation: {
            value: props.existingObservation.value,
            numericValue: props.existingObservation.numericValue,
            unit: props.existingObservation.unit,
          },
        })
      }

      lastUpdated.value = new Date(props.existingObservation.date)
    } catch (error) {
      logger.error('Failed to parse existing medication data', error)
    }
  }

  // Always start in view mode (default)
  viewMode.value = true
})

// Watch for changes to existingObservation prop
watch(
  () => props.existingObservation,
  (newObservation, oldObservation) => {
    logger.debug('existingObservation prop changed', {
      newObservation,
      oldObservation,
      currentMedicationData: medicationData.value,
    })

    // Only reinitialize if it's actually a different observation
    if (newObservation && (!oldObservation || newObservation.observationId !== oldObservation.observationId)) {
      logger.debug('Reinitializing medication data due to prop change')

      if (newObservation.observationBlob) {
        try {
          const parsedData = JSON.parse(newObservation.observationBlob)
          medicationData.value = {
            drugName: parsedData.drugName || newObservation.value || '',
            dosage: parsedData.dosage || newObservation.numericValue || null,
            dosageUnit: parsedData.dosageUnit || newObservation.unit || 'mg',
            frequency: parsedData.frequency || '',
            route: parsedData.route || '',
            instructions: parsedData.instructions || '',
          }
        } catch (error) {
          logger.error('Failed to parse observation blob in watch', error)
          // Fallback to basic fields if BLOB parsing fails
          medicationData.value = {
            drugName: newObservation.value || '',
            dosage: newObservation.numericValue || null,
            dosageUnit: newObservation.unit || 'mg',
            frequency: '',
            route: '',
            instructions: '',
          }
        }
      } else {
        // Handle case where only basic fields are set (no BLOB)
        medicationData.value = {
          drugName: newObservation.value || '',
          dosage: newObservation.numericValue || null,
          dosageUnit: newObservation.unit || 'mg',
          frequency: '',
          route: '',
          instructions: '',
        }

        logger.debug('Reinitialized medication data from basic fields only', {
          medicationData: medicationData.value,
        })
      }
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.medication-field {
  border: 1px solid $grey-3;
  border-radius: 8px;
  padding: 1rem;
  background: white;
  transition: all 0.3s ease;
  position: relative;
  width: 100%;
  box-sizing: border-box;

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
  margin-bottom: 0.75rem;

  .field-label {
    font-weight: 600;
    color: $grey-8;
    font-size: 0.9rem;
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
