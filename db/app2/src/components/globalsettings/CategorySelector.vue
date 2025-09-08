<template>
  <div class="row q-col-gutter-md q-mb-lg">
    <div class="col-md-4">
      <q-select :model-value="selectedTable" :options="tableOptions" label="Select Data Category" outlined emit-value map-options @update:model-value="onTableChange" :loading="loadingTables">
        <template v-slot:prepend>
          <q-icon name="table_chart" />
        </template>
      </q-select>
    </div>
    <div class="col-md-4">
      <q-select
        :model-value="selectedColumn"
        :options="columnOptions"
        label="Select Configuration Type"
        outlined
        emit-value
        map-options
        @update:model-value="onColumnChange"
        :loading="loadingColumns"
        :disable="!selectedTable"
      >
        <template v-slot:prepend>
          <q-icon name="list" />
        </template>
      </q-select>
    </div>
    <div class="col-md-4">
      <div class="q-gutter-sm">
        <q-btn color="primary" icon="add" label="Add New Value" @click="$emit('add-value')" :disable="!selectedColumn" />
        <q-btn v-if="isQuestionnaireColumn" color="secondary" icon="upload" label="Import Questionnaire" @click="$emit('import-questionnaire')" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  selectedTable: String,
  selectedColumn: String,
  loadingTables: Boolean,
  loadingColumns: Boolean,
  columnOptions: Array,
})

const emit = defineEmits(['update:selectedTable', 'update:selectedColumn', 'table-changed', 'column-changed', 'add-value', 'import-questionnaire'])

// Table options - different categories of lookup data
const tableOptions = [
  {
    label: 'Concept Dimension (Categories, Value Types, Source Systems)',
    value: 'CONCEPT_DIMENSION',
  },
  {
    label: 'Visit Dimension (Visit Types, Field Sets)',
    value: 'VISIT_DIMENSION',
  },
  {
    label: 'Survey System (Questionnaires)',
    value: 'SURVEY_BEST',
  },
  {
    label: 'File Dimension (File Types)',
    value: 'FILE_DIMENSION',
  },
]

// Computed
const isQuestionnaireColumn = computed(() => {
  return props.selectedColumn === 'QUESTIONNAIRE'
})

// Methods
const onTableChange = (newValue) => {
  emit('update:selectedTable', newValue)
  emit('table-changed', newValue)
}

const onColumnChange = (newValue) => {
  emit('update:selectedColumn', newValue)
  emit('column-changed', newValue)
}
</script>
