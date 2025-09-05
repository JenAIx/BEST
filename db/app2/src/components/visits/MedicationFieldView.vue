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
  // Use centralized parsing logic from medications store
  if (props.existingObservation) {
    fullMedicationData.value = await medicationsStore.parseMedicationDataWithBlob(props.existingObservation, true)
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

  // Use centralized formatting from medications store
  medicationViewDisplay.value = await medicationsStore.formatMedicationDisplayElegant(fullMedicationData.value)
}

// Watch for changes to existingObservation to reload BLOB data
watch(
  () => props.existingObservation,
  async (newObservation) => {
    // Use centralized parsing logic from medications store
    if (newObservation) {
      fullMedicationData.value = await medicationsStore.parseMedicationDataWithBlob(newObservation, true)
    } else {
      fullMedicationData.value = { ...props.medicationData }
    }

    // Update display after data change
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
