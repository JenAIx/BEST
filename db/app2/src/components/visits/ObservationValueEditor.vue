<template>
  <div class="observation-value-editor">
    <!-- Numeric Input -->
    <div v-if="actualValueType === 'N'" class="numeric-input">
      <q-input :model-value="currentValue" @update:model-value="onValueChange" type="number" placeholder="Enter number" outlined dense class="compact-input" :loading="loading">
        <template v-slot:append v-if="rowData.unit">
          <q-chip size="sm" color="grey-3" text-color="grey-7" dense class="unit-chip">
            {{ rowData.unit }}
          </q-chip>
        </template>
      </q-input>
    </div>

    <!-- Text Input -->
    <div v-else-if="actualValueType === 'T'" class="text-input">
      <q-input :model-value="currentValue" @update:model-value="onValueChange" placeholder="Enter text" type="textarea" rows="1" outlined dense class="compact-input" :loading="loading" autogrow />
    </div>

    <!-- Date Input -->
    <div v-else-if="actualValueType === 'D'" class="date-input">
      <q-input :model-value="currentValue" @update:model-value="onValueChange" type="date" placeholder="Select date" outlined dense class="compact-input" :loading="loading" />
    </div>

    <!-- Selection Input (for coded values) -->
    <div v-else-if="actualValueType === 'S'" class="selection-input">
      <q-select
        :model-value="currentValue"
        @update:model-value="onValueChange"
        :options="selectionOptions"
        placeholder="Select option"
        outlined
        dense
        emit-value
        map-options
        class="compact-input"
        :loading="loading"
      />
    </div>

    <!-- Finding Input (for clinical findings) -->
    <div v-else-if="actualValueType === 'F'" class="finding-input">
      <q-select
        :model-value="currentValue"
        @update:model-value="onValueChange"
        :options="selectionOptions"
        placeholder="Select finding"
        outlined
        dense
        emit-value
        map-options
        class="compact-input"
        :loading="loading"
      />
    </div>

    <!-- Answer Input (for questionnaire answers) -->
    <div v-else-if="actualValueType === 'A'" class="answer-input">
      <q-select
        :model-value="currentValue"
        @update:model-value="onValueChange"
        :options="selectionOptions"
        placeholder="Select answer"
        outlined
        dense
        emit-value
        map-options
        class="compact-input"
        :loading="loading"
      />
    </div>

    <!-- Medication Input (complex medication data) -->
    <div v-else-if="actualValueType === 'M'" class="medication-input">
      <MedicationInlineEditor :medication-data="medicationData" :frequency-options="frequencyOptions" :route-options="routeOptions" :loading="loading" @medication-changed="onMedicationChange" />
    </div>

    <!-- Questionnaire Input (for questionnaire data) -->
    <div v-else-if="actualValueType === 'Q'" class="questionnaire-input">
      <div class="questionnaire-display">
        <q-btn flat dense icon="quiz" :label="currentValue || 'Questionnaire'" color="deep-purple" class="questionnaire-btn" @click="showQuestionnaireDialog = true" :loading="loading" />
        <!-- Questionnaire dialog would go here -->
      </div>
    </div>

    <!-- Raw/File Input (for file attachments) -->
    <div v-else-if="actualValueType === 'R'" class="raw-input">
      <div class="file-display">
        <q-btn v-if="fileInfo" flat dense :icon="getFileIcon()" :label="fileInfo.filename || 'File'" :color="getFileColor()" class="file-btn" @click="showFileDialog = true" :loading="loading" />
        <q-btn v-else flat dense icon="attach_file" label="Attach File" color="grey-6" class="attach-btn" @click="showFileUploadDialog = true" :loading="loading" />
      </div>
    </div>

    <!-- Default/Unknown Input -->
    <div v-else class="default-input">
      <q-input :model-value="currentValue" @update:model-value="onValueChange" placeholder="Enter value" outlined dense class="compact-input" :loading="loading">
        <template v-slot:prepend>
          <q-icon name="help" size="16px" color="orange" />
          <q-tooltip>Unknown value type: {{ actualValueType }}</q-tooltip>
        </template>
      </q-input>
    </div>

    <!-- Status Indicators -->
    <div v-if="hasChanges && !loading" class="status-indicator">
      <q-icon name="edit" size="14px" color="warning" />
      <q-tooltip>Unsaved changes</q-tooltip>
    </div>

    <!-- File Preview Dialog -->
    <FilePreviewDialog
      v-if="actualValueType === 'R' && fileInfo"
      v-model="showFileDialog"
      :observation-id="rowData.observationId"
      :file-info="fileInfo"
      :concept-name="concept?.name || 'File Attachment'"
      :upload-date="rowData.date"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import MedicationInlineEditor from './MedicationInlineEditor.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'

const props = defineProps({
  rowData: {
    type: Object,
    required: true,
  },
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
  frequencyOptions: {
    type: Array,
    default: () => [],
  },
  routeOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['value-changed', 'save-requested'])

const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ObservationValueEditor')

// State
const currentValue = ref('')
const loading = ref(false)
const selectionOptions = ref([])
const medicationData = ref({
  drugName: '',
  dosage: null,
  dosageUnit: 'mg',
  frequency: '',
  route: '',
  instructions: '',
})
const fileInfo = ref(null)
const showQuestionnaireDialog = ref(false)
const showFileDialog = ref(false)
const showFileUploadDialog = ref(false)

// Computed
const actualValueType = computed(() => {
  return props.rowData.valueType || props.concept?.valueType || 'T'
})

const hasChanges = computed(() => {
  return props.rowData.hasChanges
})

// Methods
const onValueChange = (newValue) => {
  currentValue.value = newValue
  emit('value-changed', props.rowData, newValue)

  logger.debug('Value changed in editor', {
    rowId: props.rowData.id,
    conceptCode: props.rowData.conceptCode,
    oldValue: props.rowData.currentValue,
    newValue,
  })
}

const onMedicationChange = (newMedicationData) => {
  medicationData.value = { ...newMedicationData }

  // Format medication summary for display
  const parts = [medicationData.value.drugName]
  if (medicationData.value.dosage && medicationData.value.dosageUnit) {
    parts.push(`${medicationData.value.dosage}${medicationData.value.dosageUnit}`)
  }
  if (medicationData.value.frequency) {
    const freq = props.frequencyOptions.find((f) => f.value === medicationData.value.frequency)
    parts.push(freq ? freq.label : medicationData.value.frequency)
  }
  if (medicationData.value.route) {
    const route = props.routeOptions.find((r) => r.value === medicationData.value.route)
    parts.push(route ? route.label : medicationData.value.route)
  }

  const summary = parts.join(' • ')
  currentValue.value = summary

  emit('value-changed', props.rowData, summary)

  logger.debug('Medication changed in editor', {
    rowId: props.rowData.id,
    medicationData: medicationData.value,
    summary,
  })
}

const loadSelectionOptions = async () => {
  try {
    if (actualValueType.value === 'S') {
      selectionOptions.value = await conceptStore.getSelectionOptions(props.concept.code)
    } else if (actualValueType.value === 'F') {
      selectionOptions.value = await conceptStore.getFindingOptions(props.concept.code)
    } else if (actualValueType.value === 'A') {
      // For answer type, get answer-specific options (placeholder)
      selectionOptions.value = [
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
        { label: 'Unknown', value: 'unknown' },
      ]
    }

    logger.debug('Selection options loaded', {
      conceptCode: props.concept.code,
      valueType: actualValueType.value,
      optionsCount: selectionOptions.value.length,
    })
  } catch (error) {
    logger.error('Failed to load selection options', error)
    // Fallback options
    selectionOptions.value = [
      { label: 'Normal', value: 'normal' },
      { label: 'Abnormal', value: 'abnormal' },
    ]
  }
}

const initializeFileInfo = () => {
  if (actualValueType.value === 'R') {
    // Try to parse file info from different sources
    const valueToTry = props.rowData.originalValue || props.rowData.currentValue || props.rowData.displayValue
    if (valueToTry) {
      try {
        if (typeof valueToTry === 'string') {
          fileInfo.value = JSON.parse(valueToTry)
        } else if (typeof valueToTry === 'object') {
          fileInfo.value = valueToTry
        }
        logger.debug('File info initialized', {
          fileInfo: fileInfo.value,
          source: props.rowData.originalValue ? 'originalValue' : 'currentValue',
        })
      } catch (error) {
        logger.warn('Failed to parse file info', error, {
          value: valueToTry,
          rowData: props.rowData,
        })
        fileInfo.value = null
      }
    } else {
      logger.debug('No file value found to parse', { rowData: props.rowData })
    }
  }
}

const initializeMedicationData = () => {
  if (actualValueType.value === 'M' && props.rowData.originalValue) {
    try {
      // Try to parse as medication data, fallback to drug name only
      if (typeof props.rowData.originalValue === 'object') {
        medicationData.value = { ...medicationData.value, ...props.rowData.originalValue }
      } else {
        medicationData.value.drugName = props.rowData.originalValue || ''
      }
      logger.debug('Medication data initialized', { medicationData: medicationData.value })
    } catch (error) {
      logger.warn('Failed to initialize medication data', error)
      medicationData.value.drugName = props.rowData.originalValue || ''
    }
  }
}

const resetMedicationData = (value) => {
  if (actualValueType.value === 'M') {
    try {
      // Try to parse as medication data, fallback to drug name only
      if (typeof value === 'object') {
        medicationData.value = { ...medicationData.value, ...value }
      } else {
        medicationData.value = {
          drugName: value || '',
          dosage: null,
          dosageUnit: 'mg',
          frequency: '',
          route: '',
          instructions: '',
        }
      }
      logger.debug('Medication data reset', {
        medicationData: medicationData.value,
        resetValue: value,
      })
    } catch (error) {
      logger.warn('Failed to reset medication data', error)
      medicationData.value = {
        drugName: value || '',
        dosage: null,
        dosageUnit: 'mg',
        frequency: '',
        route: '',
        instructions: '',
      }
    }
  }
}

const getFileIcon = () => {
  if (!fileInfo.value?.filename) return 'insert_drive_file'

  const ext = fileInfo.value.filename.split('.').pop()?.toLowerCase()
  const iconMap = {
    pdf: 'picture_as_pdf',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    txt: 'description',
    doc: 'description',
    docx: 'description',
  }
  return iconMap[ext] || 'insert_drive_file'
}

const getFileColor = () => {
  if (!fileInfo.value?.filename) return 'grey'

  const ext = fileInfo.value.filename.split('.').pop()?.toLowerCase()
  const colorMap = {
    pdf: 'red',
    png: 'green',
    jpg: 'green',
    jpeg: 'green',
    gif: 'green',
    txt: 'blue',
    doc: 'blue',
    docx: 'blue',
  }
  return colorMap[ext] || 'grey'
}

// Initialize component
onMounted(async () => {
  logger.debug('ObservationValueEditor mounted', {
    rowId: props.rowData.id,
    conceptCode: props.rowData.conceptCode,
    valueType: actualValueType.value,
    originalValue: props.rowData.originalValue,
  })

  // Initialize current value
  currentValue.value = props.rowData.currentValue || ''

  // Load type-specific data
  if (actualValueType.value === 'S' || actualValueType.value === 'F' || actualValueType.value === 'A') {
    await loadSelectionOptions()
  } else if (actualValueType.value === 'R') {
    initializeFileInfo()
  } else if (actualValueType.value === 'M') {
    initializeMedicationData()
  }
})

// Watch for changes in row data
watch(
  () => props.rowData.currentValue,
  (newValue) => {
    if (newValue !== currentValue.value) {
      currentValue.value = newValue || ''

      // Also reset medication data if this is a medication type
      if (actualValueType.value === 'M') {
        resetMedicationData(newValue)
      }

      // Also reinitialize file info if this is a file type
      if (actualValueType.value === 'R') {
        initializeFileInfo()
      }

      logger.debug('Row data current value changed', {
        rowId: props.rowData.id,
        newValue,
        valueType: actualValueType.value,
      })
    }
  },
)

// Watch for hasChanges to detect cancel operations
watch(
  () => props.rowData.hasChanges,
  (newHasChanges, oldHasChanges) => {
    // If hasChanges went from true to false, it means cancel was clicked
    if (oldHasChanges && !newHasChanges) {
      logger.debug('Cancel detected, resetting editor state', {
        rowId: props.rowData.id,
        originalValue: props.rowData.originalValue,
        currentValue: props.rowData.currentValue,
      })

      // Force reset the current value to match the row data
      currentValue.value = props.rowData.currentValue || ''

      // Reset medication data if needed
      if (actualValueType.value === 'M') {
        resetMedicationData(props.rowData.currentValue)
      }

      // Reset file info if needed
      if (actualValueType.value === 'R') {
        initializeFileInfo()
      }
    }
  },
)
</script>

<style lang="scss" scoped>
.observation-value-editor {
  position: relative;
  min-width: 200px;

  .compact-input {
    :deep(.q-field__control) {
      min-height: 32px;
    }

    :deep(.q-field__native) {
      min-height: 32px;
      padding: 4px 8px;
    }
  }

  .unit-chip {
    font-size: 0.7rem;
    height: 20px;

    :deep(.q-chip__content) {
      padding: 0 6px;
    }
  }

  .text-input {
    width: 100%;

    :deep(.q-field__native) {
      min-height: 32px;
    }

    :deep(textarea) {
      min-height: 24px;
      line-height: 1.4;
      resize: vertical;
    }
  }

  .medication-input {
    width: 100%;
  }

  .questionnaire-display,
  .file-display {
    width: 100%;

    .questionnaire-btn,
    .file-btn,
    .attach-btn {
      width: 100%;
      justify-content: flex-start;
      text-transform: none;
      font-weight: normal;

      :deep(.q-btn__content) {
        justify-content: flex-start;
        gap: 8px;
      }
    }
  }

  .status-indicator {
    position: absolute;
    top: -2px;
    right: -2px;
    background: white;
    border-radius: 50%;
    padding: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

// Compact styling for table context
:deep(.q-field--outlined .q-field__control) {
  border-radius: 4px;
}

:deep(.q-field--dense .q-field__control) {
  min-height: 32px;
}
</style>
