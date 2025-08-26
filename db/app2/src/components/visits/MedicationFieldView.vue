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
    <div v-else class="filled-medication" @click="emit('enter-edit-mode')">
      <div class="view-display">
        <div class="medication-text">{{ medicationViewDisplay }}</div>
        <q-icon name="edit" size="16px" color="grey-6" class="edit-icon">
          <q-tooltip>Click to edit medication</q-tooltip>
        </q-icon>
      </div>
      <div v-if="medicationData.instructions" class="instructions-view">
        <q-icon name="info" size="14px" color="info" class="q-mr-xs" />
        {{ medicationData.instructions }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  medicationData: {
    type: Object,
    required: true,
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

// Computed
const hasValue = computed(() => {
  return props.medicationData.drugName || props.medicationData.dosage || props.medicationData.frequency || props.medicationData.route || props.medicationData.instructions
})

// Elegant view mode display: "DRUG mg 1-0-1 p.o."
const medicationViewDisplay = computed(() => {
  if (!hasValue.value) return ''

  const parts = []

  // Drug name
  if (props.medicationData.drugName) {
    parts.push(props.medicationData.drugName)
  }

  // Dosage with unit: "100mg"
  if (props.medicationData.dosage && props.medicationData.dosageUnit) {
    parts.push(`${props.medicationData.dosage}${props.medicationData.dosageUnit}`)
  }

  // Frequency in simplified format
  if (props.medicationData.frequency) {
    const freq = getSimplifiedFrequency(props.medicationData.frequency)
    parts.push(freq)
  }

  // Route abbreviation
  if (props.medicationData.route) {
    const route = getRouteAbbreviation(props.medicationData.route)
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
</script>

<style lang="scss" scoped>
// View Mode Styling
.medication-view {
  margin-bottom: 0.75rem;
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

      .edit-icon {
        opacity: 1;
      }
    }

    .view-display {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .medication-text {
        font-size: 1.1rem;
        font-weight: 500;
        color: $grey-8;
        font-family: 'Courier New', monospace; // Medical prescription font
      }

      .edit-icon {
        opacity: 0.5;
        transition: opacity 0.2s ease;
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
</style>
