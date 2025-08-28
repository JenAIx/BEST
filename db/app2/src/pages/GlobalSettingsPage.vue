<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-md">Global Settings</div>
    <p class="text-subtitle1 text-grey-7 q-mb-lg">Manage system-wide lookup values and configurations</p>

    <!-- Category Selection -->
    <CategorySelector
      v-model:selected-table="selectedTable"
      v-model:selected-column="selectedColumn"
      :loading-tables="loadingTables"
      :loading-columns="loadingColumns"
      :column-options="columnOptions"
      @table-changed="onTableChange"
      @column-changed="loadLookupValues"
      @add-value="showAddDialog = true"
      @import-questionnaire="showImportDialog = true"
    />

    <!-- Data Table -->
    <LookupDataTable
      :selected-column="selectedColumn"
      :lookup-values="lookupValues"
      :loading="loading"
      :editing-row="editingRow"
      :edit-form="editForm"
      :column-title="getColumnTitle()"
      :is-questionnaire-column="isQuestionnaireColumn"
      @start-edit="startEdit"
      @save-edit="saveEdit"
      @cancel-edit="cancelEdit"
      @delete-value="deleteValue"
      @preview-questionnaire="showQuestionnairePreview"
      @view-json="showJsonDialog"
      @update-edit-form="editForm = $event"
    />

    <!-- Add Value Dialog -->
    <AddValueDialog
      v-model="showAddDialog"
      :column-title="getColumnTitle()"
      :is-questionnaire-column="isQuestionnaireColumn"
      :existing-values="lookupValues"
      @submit="addValue"
      @cancel="showAddDialog = false"
    />

    <!-- Import Questionnaire Dialog -->
    <ImportQuestionnaireDialog
      v-model="showImportDialog"
      @import-success="importQuestionnaire"
      @cancel="showImportDialog = false"
    />

    <!-- JSON Viewer Dialog -->
    <JsonViewerDialog
      v-model="showJsonViewDialog"
      :json-content="jsonContent"
      @close="showJsonViewDialog = false"
    />

    <!-- Questionnaire Preview Dialog -->
    <QuestionnairePreviewDialog
      v-model="showPreviewDialog"
      :json-content="previewJsonContent"
      @close="showPreviewDialog = false"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'

// Component imports
import CategorySelector from 'src/components/globalsettings/CategorySelector.vue'
import LookupDataTable from 'src/components/globalsettings/LookupDataTable.vue'
import AddValueDialog from 'src/components/globalsettings/AddValueDialog.vue'
import ImportQuestionnaireDialog from 'src/components/globalsettings/ImportQuestionnaireDialog.vue'
import JsonViewerDialog from 'src/components/globalsettings/JsonViewerDialog.vue'
import QuestionnairePreviewDialog from 'src/components/globalsettings/QuestionnairePreviewDialog.vue'

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()

// State
const selectedTable = ref('')
const selectedColumn = ref('')
const lookupValues = ref([])
const loading = ref(false)
const showAddDialog = ref(false)
const showImportDialog = ref(false)
const showJsonViewDialog = ref(false)
const showPreviewDialog = ref(false)
const jsonContent = ref('')
const previewJsonContent = ref('')
const editingRow = ref(null)
const loadingColumns = ref(true)
const loadingTables = ref(true)

// Form data
const editForm = ref({
  NAME_CHAR: '',
  LOOKUP_BLOB: '',
})

// Column options - will be loaded dynamically based on selected table
const columnOptions = ref([])

// Computed
const isQuestionnaireColumn = computed(() => {
  return selectedColumn.value === 'QUESTIONNAIRE'
})

// Methods
const getColumnTitle = () => {
  const option = columnOptions.value.find((opt) => opt.value === selectedColumn.value)
  return option ? option.label : 'Values'
}

// Table selection handler
const onTableChange = async () => {
  selectedColumn.value = ''
  lookupValues.value = []
  await loadColumnOptions()
}

// Load unique COLUMN_CD values from database for the selected table
const loadColumnOptions = async () => {
  if (!selectedTable.value) return

  loadingColumns.value = true
  try {
    const result = await globalSettingsStore.dbStore.executeQuery(
      `SELECT DISTINCT COLUMN_CD, COUNT(*) as count 
       FROM CODE_LOOKUP 
       WHERE TABLE_CD = ? 
       GROUP BY COLUMN_CD 
       ORDER BY COLUMN_CD`,
      [selectedTable.value],
    )

    if (result.success) {
      columnOptions.value = result.data.map((row) => {
        // Create user-friendly labels
        let label = row.COLUMN_CD
        switch (row.COLUMN_CD) {
          case 'CATEGORY_CHAR':
            label = 'Concept Categories'
            break
          case 'VALTYPE_CD':
            label = 'Value Types'
            break
          case 'SOURCESYSTEM_CD':
            label = 'Source Systems'
            break
          case 'CATEGORY_METADATA':
            label = 'Category Metadata'
            break
          case 'VISIT_TYPE_CD':
            label = 'Visit Types'
            break
          case 'FIELD_SET_CD':
            label = 'Field Sets'
            break
          case 'QUESTIONNAIRE':
            label = 'Questionnaires'
            break
          case 'FILE_TYPE_CD':
            label = 'File Types'
            break
          default:
            // Convert underscore notation to readable format
            label = row.COLUMN_CD.replace(/_/g, ' ')
              .replace(/\b\w/g, (l) => l.toUpperCase())
              .replace(' Cd', '')
              .replace(' Char', '')
        }
        return {
          label: `${label} (${row.count})`,
          value: row.COLUMN_CD,
          count: row.count,
        }
      })
    }
  } catch (error) {
    console.error('Error loading column options:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load configuration types',
      caption: error.message,
    })
  } finally {
    loadingColumns.value = false
  }
}

const loadLookupValues = async () => {
  if (!selectedColumn.value || !selectedTable.value) return

  loading.value = true
  try {
    const result = await globalSettingsStore.dbStore.executeQuery(
      `SELECT * FROM CODE_LOOKUP 
       WHERE TABLE_CD = ? AND COLUMN_CD = ? 
       ORDER BY NAME_CHAR`,
      [selectedTable.value, selectedColumn.value],
    )

    if (result.success) {
      lookupValues.value = result.data
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('Error loading lookup values:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load values',
      caption: error.message,
    })
  } finally {
    loading.value = false
  }
}

const startEdit = (row) => {
  editingRow.value = row.CODE_CD
  editForm.value = {
    NAME_CHAR: row.NAME_CHAR,
    LOOKUP_BLOB: row.LOOKUP_BLOB || '',
  }
}

const cancelEdit = () => {
  editingRow.value = null
  editForm.value = {
    NAME_CHAR: '',
    LOOKUP_BLOB: '',
  }
}

const saveEdit = async () => {
  try {
    await globalSettingsStore.updateLookupValue(editingRow.value, editForm.value.NAME_CHAR, editForm.value.LOOKUP_BLOB)

    $q.notify({
      type: 'positive',
      message: 'Value updated successfully',
    })
    await loadLookupValues()
    cancelEdit()
  } catch (error) {
    console.error('Error updating value:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to update value',
      caption: error.message,
    })
  }
}

const addValue = async (formData) => {
  try {
    const result = await globalSettingsStore.dbStore.executeCommand(
      `INSERT INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'USER')`,
      [selectedTable.value, selectedColumn.value, formData.CODE_CD, formData.NAME_CHAR, formData.LOOKUP_BLOB],
    )

    if (result.success) {
      // Clear cache to ensure fresh data
      globalSettingsStore.clearCache()

      // If this is a questionnaire, refresh the questionnaire store
      if (isQuestionnaireColumn.value) {
        try {
          const { useQuestionnaireStore } = await import('src/stores/questionnaire-store.js')
          const questionnaireStore = useQuestionnaireStore()
          await questionnaireStore.refreshQuestionnaires()
        } catch {
          // Questionnaire store not available, that's fine
        }
      }

      $q.notify({
        type: 'positive',
        message: 'Value added successfully',
      })
      showAddDialog.value = false
      await loadLookupValues()
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('Error adding value:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to add value',
      caption: error.message,
    })
  }
}

const importQuestionnaire = async (questionnaireData) => {
  try {
    const result = await globalSettingsStore.dbStore.executeCommand(
      `INSERT INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'IMPORT')`,
      ['SURVEY_BEST', 'QUESTIONNAIRE', questionnaireData.CODE_CD, questionnaireData.NAME_CHAR, questionnaireData.LOOKUP_BLOB]
    )

    if (result.success) {
      // Clear cache and refresh questionnaire store
      globalSettingsStore.clearCache()
      
      // Trigger questionnaire store refresh if available
      try {
        const { useQuestionnaireStore } = await import('src/stores/questionnaire-store.js')
        const questionnaireStore = useQuestionnaireStore()
        await questionnaireStore.refreshQuestionnaires()
      } catch {
        // Questionnaire store not available, that's fine
      }
      
      $q.notify({
        type: 'positive',
        message: `Questionnaire "${questionnaireData.NAME_CHAR}" imported successfully`,
        caption: `Code: ${questionnaireData.CODE_CD}`
      })
      
      showImportDialog.value = false
      await loadLookupValues()
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('Error importing questionnaire:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to import questionnaire',
      caption: error.message
    })
  }
}

const deleteValue = async (row) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete "${row.NAME_CHAR}"?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await globalSettingsStore.deleteLookupValue(row.CODE_CD)

      $q.notify({
        type: 'positive',
        message: 'Value deleted successfully',
      })
      await loadLookupValues()
    } catch (error) {
      console.error('Error deleting value:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete value',
        caption: error.message,
      })
    }
  })
}

const showJsonDialog = (jsonString) => {
  jsonContent.value = jsonString
  showJsonViewDialog.value = true
}

const showQuestionnairePreview = (jsonString) => {
  previewJsonContent.value = jsonString
  showPreviewDialog.value = true
}

// Load initial data
onMounted(async () => {
  // Initialize the store if not already done
  await globalSettingsStore.initialize()

  // Default to CONCEPT_DIMENSION table
  selectedTable.value = 'CONCEPT_DIMENSION'
  loadingTables.value = false

  // Load columns for the default table
  await loadColumnOptions()

  // Then default to categories if available
  if (columnOptions.value.length > 0) {
    // Try to find CATEGORY_CHAR, otherwise use first option
    const categoryOption = columnOptions.value.find((opt) => opt.value === 'CATEGORY_CHAR')
    selectedColumn.value = categoryOption ? 'CATEGORY_CHAR' : columnOptions.value[0].value
    await loadLookupValues()
  }
})
</script>