<template>
  <div class="medication-view">
    <!-- Empty Medication State -->
    <div v-if="!hasValue" class="empty-medication" @click="emit('enter-edit-mode')">
      <div class="empty-display">
        <q-icon name="add" size="16px" color="grey-5" class="q-mr-xs" />
        <span class="empty-text">Click to add medication</span>
        <q-icon name="edit" size="14px" color="grey-5" class="edit-icon">
          <q-tooltip>Click to add medication</q-tooltip>
        </q-icon>
      </div>
    </div>

    <!-- Filled Medication State -->
    <q-item v-else dense clickable class="filled-medication-item" @click="emit('enter-edit-mode')">
      <q-item-section avatar>
        <q-icon name="medication" size="20px" color="primary" />
      </q-item-section>

      <q-item-section>
        <q-item-label class="medication-text">{{ medicationViewDisplay }}</q-item-label>
        <q-item-label v-if="fullMedicationData.instructions" caption lines="2" class="instructions-caption">
          <q-icon name="info" size="12px" color="info" class="q-mr-xs" />
          {{ fullMedicationData.instructions }}
        </q-item-label>
      </q-item-section>
    </q-item>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useMedicationsStore } from 'src/stores/medications-store'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'

const props = defineProps({
  medicationData: {
    type: Object,
    required: true,
  },
  existingObservation: {
    type: Object,
    default: null,
  },
  frequencyOptions: {
    type: Array,
    required: true,
  },
  routeOptions: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['enter-edit-mode'])

// Store
const medicationsStore = useMedicationsStore()

// State management
const fullMedicationData = ref({ ...props.medicationData })

// Load BLOB data on mount if available
onMounted(async () => {
  // Load OBSERVATION_BLOB if we have an observation ID
  if (props.existingObservation?.observationId) {
    try {
      // Use the visit observation store to load the BLOB data
      const visitStore = useVisitObservationStore()
      const blobData = await visitStore.getBlob(props.existingObservation.observationId)

      if (blobData) {
        try {
          const parsedData = JSON.parse(blobData)

          fullMedicationData.value = {
            drugName: parsedData.drugName || props.existingObservation.value || '',
            dosage: parsedData.dosage || props.existingObservation.numericValue || null,
            dosageUnit: parsedData.dosageUnit || props.existingObservation.unit || 'mg',
            frequency: parsedData.frequency || '',
            route: parsedData.route || '',
            instructions: parsedData.instructions || '',
          }
        } catch (parseError) {
          console.error('Failed to parse OBSERVATION_BLOB:', parseError)
          fullMedicationData.value = { ...props.medicationData }
        }
      } else {
        // No BLOB data available, use basic data
        fullMedicationData.value = { ...props.medicationData }
      }
    } catch (error) {
      console.error('Failed to load OBSERVATION_BLOB:', error)
      fullMedicationData.value = { ...props.medicationData }
    }
  } else if (props.existingObservation?.observationBlob) {
    // Fallback: if BLOB is already available in props
    try {
      const parsedData = JSON.parse(props.existingObservation.observationBlob)

      fullMedicationData.value = {
        drugName: parsedData.drugName || props.existingObservation.value || '',
        dosage: parsedData.dosage || props.existingObservation.numericValue || null,
        dosageUnit: parsedData.dosageUnit || props.existingObservation.unit || 'mg',
        frequency: parsedData.frequency || '',
        route: parsedData.route || '',
        instructions: parsedData.instructions || '',
      }
    } catch (error) {
      console.error('Failed to parse OBSERVATION_BLOB in view:', error)
      fullMedicationData.value = { ...props.medicationData }
    }
  } else {
    fullMedicationData.value = { ...props.medicationData }
  }

  // Update display after data is loaded
  await updateMedicationDisplay()
})

// Computed
const hasValue = computed(() => {
  // At minimum we need a drug name to display the medication
  return !!(fullMedicationData.value.drugName && fullMedicationData.value.drugName.trim())
})

// Elegant view mode display: "DRUG mg 1-0-1 p.o."
const medicationViewDisplay = ref('')

// Update display when medication data changes
const updateMedicationDisplay = async () => {
  if (!hasValue.value) {
    medicationViewDisplay.value = ''
    return
  }

  const parts = []

  // Drug name
  if (fullMedicationData.value.drugName) {
    parts.push(fullMedicationData.value.drugName)
  }

  // Dosage with unit: "100mg"
  if (fullMedicationData.value.dosage && fullMedicationData.value.dosageUnit) {
    parts.push(`${fullMedicationData.value.dosage}${fullMedicationData.value.dosageUnit}`)
  }

  // Frequency in simplified format
  if (fullMedicationData.value.frequency) {
    const freq = await getSimplifiedFrequency(fullMedicationData.value.frequency)
    parts.push(freq)
  }

  // Route abbreviation
  if (fullMedicationData.value.route) {
    const route = await getRouteAbbreviation(fullMedicationData.value.route)
    parts.push(route)
  }

  medicationViewDisplay.value = parts.join(' ')
}

// Helper methods for view mode
const getSimplifiedFrequency = async (frequency) => {
  if (!frequency) return ''

  try {
    return await medicationsStore.getSimplifiedFrequency(frequency)
  } catch (error) {
    console.warn('Failed to get simplified frequency', { frequency, error })
    return frequency
  }
}

const getRouteAbbreviation = async (route) => {
  if (!route) return ''

  try {
    return await medicationsStore.getRouteAbbreviation(route)
  } catch (error) {
    console.warn('Failed to get route abbreviation', { route, error })
    return route?.toLowerCase() || ''
  }
}

// Watch for changes to existingObservation to reload BLOB data
watch(
  () => props.existingObservation,
  (newObservation) => {
    if (newObservation?.observationBlob) {
      try {
        const parsedData = JSON.parse(newObservation.observationBlob)

        fullMedicationData.value = {
          drugName: parsedData.drugName || newObservation.value || '',
          dosage: parsedData.dosage || newObservation.numericValue || null,
          dosageUnit: parsedData.dosageUnit || newObservation.unit || 'mg',
          frequency: parsedData.frequency || '',
          route: parsedData.route || '',
          instructions: parsedData.instructions || '',
        }
      } catch (error) {
        console.error('Failed to parse OBSERVATION_BLOB in watch:', error)
        fullMedicationData.value = { ...props.medicationData }
      }
    } else {
      fullMedicationData.value = { ...props.medicationData }
    }

    // Update display after data change
    updateMedicationDisplay()
  },
  { deep: true },
)

// Watch for medication data changes
watch(
  () => props.medicationData,
  () => {
    // Update display when medication data changes
    updateMedicationDisplay()
  },
  { deep: true },
)

// Watch for fullMedicationData changes
watch(
  () => fullMedicationData.value,
  () => {
    // Update display when internal medication data changes
    updateMedicationDisplay()
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
// View Mode Styling
.medication-view {
  margin-bottom: 0rem;
  position: relative;

  // Empty Medication State
  .empty-medication {
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 1rem;
    border: 2px dashed $grey-4;
    border-radius: 8px;
    background: rgba($grey-2, 0.3);

    &:hover {
      border-color: $primary;
      background: rgba($primary, 0.05);

      .edit-icon {
        opacity: 1;
      }
    }

    .empty-display {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;

      .empty-text {
        font-size: 0.9rem;
        color: $grey-6;
        font-style: italic;
      }

      .edit-icon {
        opacity: 0.5;
        transition: opacity 0.2s ease;
      }
    }
  }

  // Filled Medication State
  .filled-medication-item {
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 4px;
    margin: 0px 0;

    // Style the medication text
    .medication-text {
      font-size: 0.9rem;
      font-weight: 500;
      color: $grey-8;
      font-family: 'Courier New', monospace; // Medical prescription font
    }

    // Style the instructions caption
    .instructions-caption {
      font-size: 0.85rem;
      color: $grey-6;
      margin-top: 0.25rem;
      display: flex;
      align-items: flex-start;

      .q-icon {
        margin-top: 0.1rem;
      }
    }

    // Override Quasar's default padding for a more compact look
    :deep(.q-item__section--avatar) {
      min-width: 32px;
      padding-right: 12px;
    }

    :deep(.q-item__section--side) {
      padding-left: 8px;
    }
  }
}

// Animations
</style>
