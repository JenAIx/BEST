<template>
  <div class="medication-inline-editor">
    <!-- Compact View - show summary with edit button -->
    <div v-if="!editMode" class="compact-view" @click="enterEditMode">
      <div class="medication-summary">
        <q-icon name="medication" size="14px" color="primary" class="q-mr-xs" />
        <span v-if="hasMedicationData" class="summary-text">
          {{ medicationSummary }}
        </span>
        <span v-else class="empty-text">Click to add medication details</span>
        <q-icon name="edit" size="12px" color="grey-6" class="q-ml-xs edit-hint" />
      </div>
    </div>

    <!-- Expanded Edit Mode -->
    <div v-else class="edit-mode">
      <div class="edit-header">
        <q-icon name="medication" size="16px" color="primary" class="q-mr-xs" />
        <span class="edit-title">Medication Details</span>
        <q-space />
        <q-btn flat dense round icon="close" size="sm" color="grey-6" @click="cancelEdit" class="close-btn" />
      </div>

      <div class="edit-fields">
        <!-- Drug Name -->
        <q-input v-model="editData.drugName" placeholder="Drug name" outlined dense class="field" :loading="loading">
          <template v-slot:prepend>
            <q-icon name="local_pharmacy" size="16px" />
          </template>
        </q-input>

        <!-- Dosage and Unit -->
        <div class="dosage-row">
          <q-input v-model.number="editData.dosage" placeholder="Dosage" type="number" outlined dense class="dosage-input" :loading="loading" />
          <q-select v-model="editData.dosageUnit" :options="dosageUnitOptions" outlined dense emit-value map-options class="unit-select" :loading="loading" />
        </div>

        <!-- Frequency -->
        <q-select v-model="editData.frequency" :options="frequencyOptions" placeholder="Frequency" outlined dense emit-value map-options clearable class="field" :loading="loading">
          <template v-slot:prepend>
            <q-icon name="schedule" size="16px" />
          </template>
        </q-select>

        <!-- Route -->
        <q-select v-model="editData.route" :options="routeOptions" placeholder="Route" outlined dense emit-value map-options clearable class="field" :loading="loading">
          <template v-slot:prepend>
            <q-icon name="trending_up" size="16px" />
          </template>
        </q-select>

        <!-- Instructions -->
        <q-input v-model="editData.instructions" placeholder="Additional instructions" outlined dense type="textarea" rows="2" class="field" :loading="loading">
          <template v-slot:prepend>
            <q-icon name="notes" size="16px" />
          </template>
        </q-input>

        <!-- Action Buttons -->
        <div class="edit-actions">
          <q-btn flat dense icon="check" label="Save" color="primary" @click="saveChanges" :loading="loading" :disable="!editData.drugName?.trim()" class="save-btn" />
          <q-btn flat dense icon="close" label="Cancel" color="grey-6" @click="cancelEdit" :disable="loading" class="cancel-btn" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  medicationData: {
    type: Object,
    default: () => ({
      drugName: '',
      dosage: null,
      dosageUnit: 'mg',
      frequency: '',
      route: '',
      instructions: '',
    }),
  },
  frequencyOptions: {
    type: Array,
    default: () => [],
  },
  routeOptions: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['medication-changed'])

const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('MedicationInlineEditor')

// State
const editMode = ref(false)
const editData = ref({
  drugName: '',
  dosage: null,
  dosageUnit: 'mg',
  frequency: '',
  route: '',
  instructions: '',
})

const dosageUnitOptions = [
  { label: 'mg', value: 'mg' },
  { label: 'g', value: 'g' },
  { label: 'mcg', value: 'mcg' },
  { label: 'ml', value: 'ml' },
  { label: 'units', value: 'units' },
  { label: 'tablets', value: 'tablets' },
  { label: 'capsules', value: 'capsules' },
  { label: 'drops', value: 'drops' },
  { label: 'sprays', value: 'sprays' },
]

// Computed
const hasMedicationData = computed(() => {
  return !!(props.medicationData.drugName && props.medicationData.drugName.trim())
})

const medicationSummary = computed(() => {
  if (!hasMedicationData.value) return ''

  const parts = [props.medicationData.drugName]

  // Add dosage if available
  if (props.medicationData.dosage && props.medicationData.dosageUnit) {
    parts.push(`${props.medicationData.dosage}${props.medicationData.dosageUnit}`)
  }

  // Add frequency if available
  if (props.medicationData.frequency && props.medicationData.frequency.trim()) {
    const freq = props.frequencyOptions.find((f) => f.value === props.medicationData.frequency)
    parts.push(freq ? freq.label : props.medicationData.frequency)
  }

  // Add route if available
  if (props.medicationData.route && props.medicationData.route.trim()) {
    const route = props.routeOptions.find((r) => r.value === props.medicationData.route)
    parts.push(route ? route.label : props.medicationData.route)
  }

  return parts.join(' • ')
})

// Methods
const enterEditMode = () => {
  // Initialize edit data with current medication data
  editData.value = {
    drugName: props.medicationData.drugName || '',
    dosage: props.medicationData.dosage || null,
    dosageUnit: props.medicationData.dosageUnit || 'mg',
    frequency: props.medicationData.frequency || '',
    route: props.medicationData.route || '',
    instructions: props.medicationData.instructions || '',
  }

  editMode.value = true

  logger.debug('Entered medication edit mode', {
    editData: editData.value,
    originalData: props.medicationData,
  })
}

const saveChanges = () => {
  // Validate required fields
  if (!editData.value.drugName?.trim()) {
    logger.warn('Cannot save medication without drug name')
    return
  }

  // Normalize the data
  const normalizedData = {
    drugName: editData.value.drugName.trim(),
    dosage: editData.value.dosage || null,
    dosageUnit: editData.value.dosageUnit || 'mg',
    frequency: typeof editData.value.frequency === 'string' ? editData.value.frequency.trim() : editData.value.frequency?.value || '',
    route: typeof editData.value.route === 'string' ? editData.value.route.trim() : editData.value.route?.value || '',
    instructions: editData.value.instructions?.trim() || '',
  }

  // Emit the changes
  emit('medication-changed', normalizedData)

  // Exit edit mode
  editMode.value = false

  logger.debug('Medication changes saved', {
    normalizedData,
    originalData: props.medicationData,
  })
}

const cancelEdit = () => {
  editMode.value = false
  logger.debug('Medication edit cancelled')
}

// Watch for external changes to medication data
watch(
  () => props.medicationData,
  (newData, oldData) => {
    if (!editMode.value) {
      // Only update if not in edit mode to avoid overwriting user changes
      logger.debug('Medication data updated externally', { newData })
    } else {
      // If in edit mode, check if this is a reset (all values are empty/default)
      const isReset = !newData.drugName && !newData.dosage && !newData.frequency && !newData.route && !newData.instructions

      if (isReset) {
        // This looks like a reset operation, so reset our edit data too
        logger.debug('Detected medication data reset, resetting edit mode', { newData, oldData })
        editData.value = {
          drugName: newData.drugName || '',
          dosage: newData.dosage || null,
          dosageUnit: newData.dosageUnit || 'mg',
          frequency: newData.frequency || '',
          route: newData.route || '',
          instructions: newData.instructions || '',
        }
      }
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.medication-inline-editor {
  width: 100%;
  min-width: 250px;

  .compact-view {
    padding: 8px 12px;
    border: 1px solid $grey-3;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;

    &:hover {
      border-color: $primary;
      background: rgba($primary, 0.02);

      .edit-hint {
        opacity: 1;
      }
    }

    .medication-summary {
      display: flex;
      align-items: center;
      font-size: 0.875rem;

      .summary-text {
        color: $grey-8;
        font-weight: 500;
        flex: 1;
      }

      .empty-text {
        color: $grey-6;
        font-style: italic;
        flex: 1;
      }

      .edit-hint {
        opacity: 0;
        transition: opacity 0.2s ease;
      }
    }
  }

  .edit-mode {
    border: 2px solid $primary;
    border-radius: 8px;
    background: white;
    box-shadow: 0 4px 12px rgba($primary, 0.15);
    animation: expandIn 0.2s ease;

    .edit-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: rgba($primary, 0.05);
      border-bottom: 1px solid rgba($primary, 0.1);
      border-radius: 6px 6px 0 0;

      .edit-title {
        font-weight: 600;
        color: $primary;
        font-size: 0.875rem;
      }

      .close-btn {
        opacity: 0.7;
        transition: opacity 0.2s ease;

        &:hover {
          opacity: 1;
        }
      }
    }

    .edit-fields {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .field {
        :deep(.q-field__control) {
          min-height: 36px;
        }
      }

      .dosage-row {
        display: flex;
        gap: 8px;

        .dosage-input {
          flex: 2;
        }

        .unit-select {
          flex: 1;
          min-width: 80px;
        }
      }

      .edit-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
        padding-top: 12px;
        border-top: 1px solid $grey-3;

        .save-btn {
          background: rgba($primary, 0.1);
          color: $primary;

          &:hover {
            background: $primary;
            color: white;
          }

          &:disabled {
            background: $grey-2;
            color: $grey-5;
          }
        }

        .cancel-btn:hover {
          background: rgba($grey-6, 0.1);
        }
      }
    }
  }
}

// Compact input styling
:deep(.q-field--dense .q-field__control) {
  min-height: 36px;
}

:deep(.q-field__native) {
  padding: 6px 8px;
}

:deep(.q-field__prepend) {
  padding-right: 8px;
}

@keyframes expandIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

// Mobile responsiveness
@media (max-width: 600px) {
  .medication-inline-editor {
    min-width: 200px;

    .edit-mode .edit-fields {
      padding: 12px;
      gap: 10px;

      .dosage-row {
        flex-direction: column;
        gap: 8px;

        .unit-select {
          min-width: unset;
        }
      }

      .edit-actions {
        flex-direction: column;
        gap: 6px;

        .save-btn,
        .cancel-btn {
          width: 100%;
        }
      }
    }
  }
}
</style>
