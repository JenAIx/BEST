<template>
  <div class="medication-view">
    <!-- Remove button for empty medications - positioned in upper right of entire field -->
    <q-btn v-if="!hasValue" flat round icon="close" size="sm" color="grey-5" class="remove-medication-btn" @click.stop="emit('delete')">
      <q-tooltip>Remove empty medication slot</q-tooltip>
    </q-btn>

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
    <div v-else class="filled-medication">
      <div class="view-display" @click="emit('enter-edit-mode')">
        <div class="medication-display">
          <q-icon name="medication" size="16px" color="primary" class="medication-icon" />
          <div class="medication-text">{{ medicationViewDisplay }}</div>
          <!-- Edit Icon - right next to text, only visible on hover -->
          <q-icon name="edit" size="16px" color="grey-6" class="edit-icon">
            <q-tooltip>Click to edit medication</q-tooltip>
          </q-icon>
        </div>
        <div class="view-actions" :class="{ 'show-confirmation': showClearConfirmation }">
          <!-- Remove Button - on the far right, only visible on hover -->
          <q-btn v-if="!showClearConfirmation" flat round icon="close" size="sm" color="grey-6" @click.stop="showClearConfirmation = true">
            <q-tooltip>Remove medication</q-tooltip>
          </q-btn>

          <!-- Remove Confirmation Buttons -->
          <div v-if="showClearConfirmation" class="clear-confirmation" @click.stop>
            <q-btn flat round icon="check" size="sm" color="negative" @click="confirmRemove" class="confirm-clear-btn">
              <q-tooltip>Confirm remove medication</q-tooltip>
            </q-btn>
            <q-btn flat round icon="close" size="sm" color="grey-6" @click="cancelClear" class="cancel-clear-btn">
              <q-tooltip>Cancel</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>
      <div v-if="fullMedicationData.instructions" class="instructions-view">
        <q-icon name="info" size="14px" color="info" class="q-mr-xs" />
        {{ fullMedicationData.instructions }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

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

const emit = defineEmits(['delete', 'enter-edit-mode'])

// State for clear confirmation
const showClearConfirmation = ref(false)
const fullMedicationData = ref({ ...props.medicationData })

// Load BLOB data on mount if available
onMounted(() => {
  if (props.existingObservation?.observationBlob) {
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
})

// Computed
const hasValue = computed(() => {
  // At minimum we need a drug name to display the medication
  return !!(fullMedicationData.value.drugName && fullMedicationData.value.drugName.trim())
})

// Elegant view mode display: "DRUG mg 1-0-1 p.o."
const medicationViewDisplay = computed(() => {
  if (!hasValue.value) return ''

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
    const freq = getSimplifiedFrequency(fullMedicationData.value.frequency)
    parts.push(freq)
  }

  // Route abbreviation
  if (fullMedicationData.value.route) {
    const route = getRouteAbbreviation(fullMedicationData.value.route)
    parts.push(route)
  }

  return parts.join(' ')
})

// Helper methods for view mode
const getSimplifiedFrequency = (frequency) => {
  const freqMap = {
    QD: '1-0-0',
    BID: '1-0-1',
    TID: '1-1-1',
    QID: '1-1-1-1',
    Q4H: 'q4h',
    Q6H: 'q6h',
    Q8H: 'q8h',
    Q12H: 'q12h',
    PRN: 'prn',
    QHS: 'qhs',
    AC: 'a.c.',
    PC: 'p.c.',
  }
  return freqMap[frequency] || frequency
}

const getRouteAbbreviation = (route) => {
  const routeMap = {
    PO: 'p.o.',
    IV: 'i.v.',
    IM: 'i.m.',
    SC: 's.c.',
    TOP: 'top.',
    INH: 'inh.',
    NAS: 'nas.',
    PR: 'p.r.',
    SL: 's.l.',
  }
  return routeMap[route] || route?.toLowerCase() || ''
}

// Remove confirmation methods
const confirmRemove = () => {
  emit('delete')
  showClearConfirmation.value = false
}

const cancelClear = () => {
  showClearConfirmation.value = false
}

// Auto-hide remove confirmation after 5 seconds for safety
watch(
  () => showClearConfirmation.value,
  (newValue) => {
    if (newValue) {
      setTimeout(() => {
        if (showClearConfirmation.value) {
          showClearConfirmation.value = false
        }
      }, 5000) // 5 seconds timeout
    }
  },
)

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
  },
  { deep: true },
)

// Hide clear confirmation when medication data changes
watch(
  () => props.medicationData,
  () => {
    if (showClearConfirmation.value) {
      showClearConfirmation.value = false
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
// View Mode Styling
.medication-view {
  margin-bottom: 0rem;
  position: relative;

  // Remove button for entire medication field
  .remove-medication-btn {
    position: absolute;
    top: -40px;
    right: -8px;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 10;
    background: white;
    border: 1px solid $grey-4;

    &:hover {
      background: rgba($negative, 0.1);
      color: $negative;
      border-color: $negative;
    }
  }

  // Show remove button on hover
  &:hover .remove-medication-btn {
    opacity: 1;
  }

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
  .filled-medication {
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba($primary, 0.05);
      border-radius: 4px;
      padding: 8px;
      margin: -8px;

      .medication-display {
        .edit-icon {
          opacity: 1;
        }
      }

      .view-actions {
        opacity: 1;
      }
    }

    .view-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;

      .medication-display {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;

        .medication-icon {
          flex-shrink: 0;
        }

        .medication-text {
          font-size: 1.1rem;
          font-weight: 500;
          color: $grey-8;
          font-family: 'Courier New', monospace; // Medical prescription font
          flex: 1;
        }

        .edit-icon {
          opacity: 0;
          transition: opacity 0.2s ease;
          flex-shrink: 0;
          margin-left: 0.5rem;
        }
      }

      .view-actions {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.2s ease;

        // Always show when confirmation is active
        &.show-confirmation {
          opacity: 1;
        }

        // Make sure buttons are properly styled and visible
        .q-btn {
          background: rgba(white, 0.9);
          border: 1px solid rgba($grey-4, 0.5);
          box-shadow: 0 1px 3px rgba(black, 0.1);

          &:hover {
            background: rgba(white, 1);
            border-color: $grey-5;
            box-shadow: 0 2px 6px rgba(black, 0.15);
          }
        }

        .clear-confirmation {
          display: flex;
          gap: 0.25rem;
          padding: 2px;
          background: rgba($negative, 0.1);
          border-radius: 20px;
          border: 1px solid rgba($negative, 0.2);
          animation: slideIn 0.3s ease;
          opacity: 1; // Always visible when shown

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

    .instructions-view {
      margin-top: 0.5rem;
      padding: 8px;
      background: rgba($info, 0.1);
      border-radius: 4px;
      font-size: 0.9rem;
      color: $grey-7;
      display: flex;
      align-items: flex-start;
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
