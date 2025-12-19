<template>
  <div class="medication-view">
    <!-- Empty Medication State -->
    <div v-if="!hasValue" class="empty-medication" @click="emit('enter-edit-mode')">
      <q-icon name="add" size="18px" color="grey-5" class="add-icon">
        <q-tooltip>Click to add medication</q-tooltip>
      </q-icon>
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
  // New prop to control display mode
  simpleDisplay: {
    type: Boolean,
    default: false, // Default: full elegant display for VisitDataEntry
  },
})

const emit = defineEmits(['enter-edit-mode'])

const medicationsStore = useMedicationsStore()

// State management
const fullMedicationData = ref({ ...props.medicationData })

// Initialize medication data with BLOB loading if needed
onMounted(async () => {
  if (props.simpleDisplay) {
    // Simple display mode (e.g., for data grid) - just show drug name
    fullMedicationData.value = { ...props.medicationData }
  } else {
    // Full display mode (e.g., for VisitDataEntry) - load BLOB for complete data
    if (props.existingObservation) {
      fullMedicationData.value = await medicationsStore.parseMedicationDataWithBlob(props.existingObservation, true)
    } else {
      fullMedicationData.value = { ...props.medicationData }
    }
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

  if (props.simpleDisplay) {
    // Simple display: just show drug name for grid
    medicationViewDisplay.value = fullMedicationData.value.drugName || ''
  } else {
    // Elegant display: show full medication info "ASS 100mg 1-0-0 p.o."
    medicationViewDisplay.value = await medicationsStore.formatMedicationDisplayElegant(fullMedicationData.value)
  }
}

// Watch for changes to existingObservation
watch(
  () => props.existingObservation,
  async (newObservation) => {
    if (props.simpleDisplay) {
      // Simple mode: just update with basic data
      fullMedicationData.value = { ...props.medicationData }
    } else {
      // Full mode: reload BLOB data
      if (newObservation) {
        fullMedicationData.value = await medicationsStore.parseMedicationDataWithBlob(newObservation, true)
      } else {
        fullMedicationData.value = { ...props.medicationData }
      }
    }
    
    await updateMedicationDisplay()
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
  async () => {
    // Update display when internal medication data changes
    await updateMedicationDisplay()
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
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4px;
    min-height: 32px;

    &:hover {
      .add-icon {
        color: $primary;
        transform: scale(1.1);
      }
    }

    .add-icon {
      transition: all 0.2s ease;
      opacity: 0.6;
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
