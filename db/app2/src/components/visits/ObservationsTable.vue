<template>
  <q-table v-if="tableRows.length > 0" :rows="tableRows" :columns="tableColumns" row-key="id" flat dense :pagination="{ rowsPerPage: 0 }" class="observations-table" :loading="loading">
    <!-- Custom Header with Resizer -->
    <template v-slot:header="props">
      <q-tr :props="props">
        <q-th v-for="col in props.cols" :key="col.name" :props="props" :class="`header-cell ${col.name}-header`">
          <div class="header-content">
            <span>{{ col.label }}</span>
            <!-- Column Resizer (only after observation column) -->
            <div v-if="col.name === 'observation'" class="column-resizer" @mousedown="startResize" :class="{ resizing: isResizing }">
              <div class="resizer-line"></div>
              <q-tooltip>Drag to resize observation column</q-tooltip>
            </div>
          </div>
        </q-th>
      </q-tr>
    </template>

    <!-- Type Column -->
    <template v-slot:body-cell-type="props">
      <q-td :props="props" class="type-cell">
        <ValueTypeIcon :value-type="props.row.valueType" size="28px" variant="chip" />
      </q-td>
    </template>

    <!-- Observation Name Column -->
    <template v-slot:body-cell-observation="props">
      <q-td :props="props" class="observation-name-cell">
        <div class="observation-info">
          <div class="observation-label">
            {{ props.row.resolvedName || props.row.conceptName }}
            <q-icon v-if="props.row.conceptCode.includes('LOINC')" name="science" size="12px" color="blue" class="q-ml-xs">
              <q-tooltip>LOINC: {{ props.row.conceptCode }}</q-tooltip>
            </q-icon>
            <q-icon v-else-if="props.row.conceptCode.includes('SNOMED')" name="medical_services" size="12px" color="green" class="q-ml-xs">
              <q-tooltip>SNOMED: {{ props.row.conceptCode }}</q-tooltip>
            </q-icon>
            <q-icon v-else name="code" size="12px" color="grey-6" class="q-ml-xs">
              <q-tooltip>{{ props.row.conceptCode }}</q-tooltip>
            </q-icon>
          </div>
        </div>
      </q-td>
    </template>

    <!-- Value Column -->
    <template v-slot:body-cell-value="props">
      <q-td :props="props" class="value-cell">
        <!-- Medication Display -->
        <MedicationFieldView
          v-if="props.row.isMedication"
          :medication-data="medicationsStore.parseMedicationData(props.row)"
          :existing-observation="props.row.rawObservation"
          :frequency-options="frequencyOptions"
          :route-options="routeOptions"
          @enter-edit-mode="() => $emit('enter-medication-edit-mode', props.row)"
        />

        <!-- Regular Observation Editor -->
        <ObservationValueEditor
          v-else
          :row-data="{
            ...props.row,
            // Map our origVal/currentVal to what the editor expects
            originalValue: props.row.origVal,
            currentValue: props.row.currentVal,
            value: props.row.currentVal,
          }"
          :concept="getConcept(props.row.conceptCode, props.row)"
          :visit="visit"
          :patient="patient"
          :frequency-options="frequencyOptions"
          :route-options="routeOptions"
          @value-changed="(rowData, newValue) => $emit('value-changed', rowData, newValue)"
          @save-requested="(rowData) => $emit('save-requested', rowData)"
        />
      </q-td>
    </template>

    <!-- Action Column -->
    <template v-slot:body-cell-actions="props">
      <q-td :props="props" class="action-cell">
        <ObservationRowActions
          :row="props.row"
          @save-row="(row) => $emit('save-row', row)"
          @cancel-changes="(row) => $emit('cancel-changes', row)"
          @remove-row="(row) => $emit('remove-row', row)"
          @clone-from-previous="(row) => $emit('clone-from-previous', row)"
        />
      </q-td>
    </template>
  </q-table>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useLoggingStore } from 'src/stores/logging-store'
import { useMedicationsStore } from 'src/stores/medications-store'
import ObservationValueEditor from './ObservationValueEditor.vue'
import ValueTypeIcon from 'src/components/shared/ValueTypeIcon.vue'
import MedicationFieldView from './MedicationFieldView.vue'
import ObservationRowActions from './ObservationRowActions.vue'

const props = defineProps({
  tableRows: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
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
    required: true,
  },
  routeOptions: {
    type: Array,
    required: true,
  },
  fieldSetConcepts: {
    type: Array,
    required: true,
  },
})

defineEmits(['enter-medication-edit-mode', 'value-changed', 'save-requested', 'save-row', 'cancel-changes', 'remove-row', 'clone-from-previous'])

const loggingStore = useLoggingStore()
const medicationsStore = useMedicationsStore()
const logger = loggingStore.createLogger('ObservationsTable')

// Column resizing state
const observationColumnWidth = ref(150) // Default width
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(150)

// Table columns (dynamic width for observation column)
const tableColumns = computed(() => [
  {
    name: 'type',
    label: '',
    align: 'center',
    field: 'valueType',
    sortable: true,
    style: 'width: 8%',
  },
  {
    name: 'observation',
    label: '',
    align: 'left',
    field: 'conceptName',
    sortable: true,
    style: `width: ${observationColumnWidth.value}px; max-width: ${observationColumnWidth.value}px;`,
  },
  {
    name: 'value',
    label: 'Observations',
    align: 'left',
    field: 'displayValue',
    sortable: false,
    style: 'width: auto;',
  },
  {
    name: 'actions',
    label: '',
    align: 'center',
    field: 'actions',
    sortable: false,
    style: 'width: 15%',
  },
])

// Column resizing methods
const startResize = (event) => {
  event.preventDefault()
  isResizing.value = true
  resizeStartX.value = event.clientX
  resizeStartWidth.value = observationColumnWidth.value

  // Add global mouse event listeners
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  // Add visual feedback
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  logger.debug('Column resize started', {
    startX: resizeStartX.value,
    startWidth: resizeStartWidth.value,
  })
}

const handleResize = (event) => {
  if (!isResizing.value) return

  const deltaX = event.clientX - resizeStartX.value
  const newWidth = Math.max(100, Math.min(400, resizeStartWidth.value + deltaX)) // Min 100px, Max 400px

  observationColumnWidth.value = newWidth

  logger.debug('Column resizing', {
    deltaX,
    newWidth,
    clientX: event.clientX,
  })
}

const stopResize = () => {
  isResizing.value = false

  // Remove global mouse event listeners
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)

  // Remove visual feedback
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  logger.debug('Column resize stopped', {
    finalWidth: observationColumnWidth.value,
  })
}

const getConcept = (conceptCode, row) => {
  // First try to find in fieldSetConcepts if available
  const fieldSetConcept = props.fieldSetConcepts.find((concept) => concept.code === conceptCode)
  if (fieldSetConcept) {
    return fieldSetConcept
  }

  // Create a minimal concept object from the row data
  return {
    code: conceptCode,
    name: row.conceptName || row.resolvedName || 'Unknown Concept',
    valueType: row.valueType || 'T',
  }
}

// Cleanup on component unmount
onUnmounted(() => {
  // Clean up event listeners if component is unmounted during resize
  if (isResizing.value) {
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
})
</script>

<style lang="scss" scoped>
.observations-table {
  :deep(.q-table__top) {
    padding: 0;
  }

  :deep(.q-table__bottom) {
    display: none;
  }

  :deep(.q-td) {
    padding: 8px 12px;
    vertical-align: middle;
  }

  :deep(.q-th) {
    font-weight: 600;
    color: $grey-8;
    background: $grey-1;
  }

  .observation-name-cell {
    position: relative;

    .observation-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .observation-label {
      font-weight: 500;
      color: $grey-8;
      display: flex;
      align-items: center;
      word-break: break-word;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  // Custom header with resizer
  .header-cell {
    position: relative;

    .header-content {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    &.observation-header .header-content {
      justify-content: space-between;
    }

    .column-resizer {
      position: absolute;
      top: 0;
      right: -2px;
      width: 4px;
      height: 100%;
      cursor: col-resize;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      &:hover {
        background: rgba($primary, 0.1);

        .resizer-line {
          background: $primary;
          width: 2px;
        }
      }

      &.resizing {
        background: rgba($primary, 0.2);

        .resizer-line {
          background: $primary;
          width: 2px;
        }
      }

      .resizer-line {
        width: 1px;
        height: 20px;
        background: $grey-5;
        border-radius: 1px;
        transition: all 0.2s ease;
      }
    }
  }

  .type-cell {
    text-align: center;
  }

  .value-cell {
    /* Value editor will handle its own styling */
    min-width: 200px;
  }

  .action-cell {
    /* Action buttons styling handled by ObservationRowActions component */

    &:hover :deep(.remove-button-container) {
      opacity: 1;
    }
  }
}
</style>
