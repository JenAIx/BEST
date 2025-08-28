<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-md">Global Settings</div>
    <p class="text-subtitle1 text-grey-7 q-mb-lg">Manage system-wide lookup values and configurations</p>

    <!-- Table and Column Selection -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-md-4">
        <q-select v-model="selectedTable" :options="tableOptions" label="Select Data Category" outlined emit-value map-options @update:model-value="onTableChange" :loading="loadingTables">
          <template v-slot:prepend>
            <q-icon name="table_chart" />
          </template>
        </q-select>
      </div>
      <div class="col-md-4">
        <q-select
          v-model="selectedColumn"
          :options="columnOptions"
          label="Select Configuration Type"
          outlined
          emit-value
          map-options
          @update:model-value="loadLookupValues"
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
          <q-btn 
            color="primary" 
            icon="add" 
            label="Add New Value" 
            @click="showAddDialog = true" 
            :disable="!selectedColumn" 
          />
          <q-btn 
            v-if="isQuestionnaireColumn"
            color="secondary" 
            icon="upload" 
            label="Import Questionnaire" 
            @click="showImportDialog = true" 
          />
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <q-table
      v-if="selectedColumn"
      :rows="lookupValues"
      :columns="columns"
      row-key="CODE_CD"
      :pagination="pagination"
      :loading="loading"
      flat
      bordered
      :filter="filter"
      :filter-method="filterMethod"
      no-data-label="No values found"
    >
      <template v-slot:top>
        <div class="col-2 q-table__title">{{ getColumnTitle() }}</div>
        <q-space />
        <q-input v-model="filter" placeholder="Search..." dense outlined class="q-mr-md">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </template>

      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td key="CODE_CD" :props="props">
            {{ props.row.CODE_CD }}
          </q-td>
          <q-td key="NAME_CHAR" :props="props">
            <div v-if="editingRow !== props.row.CODE_CD">
              {{ props.row.NAME_CHAR }}
            </div>
            <q-input v-else v-model="editForm.NAME_CHAR" dense outlined autofocus @keyup.enter="saveEdit" @keyup.escape="cancelEdit" />
          </q-td>
          <q-td key="LOOKUP_BLOB" :props="props">
            <div v-if="editingRow !== props.row.CODE_CD">
              <div v-if="!props.row.LOOKUP_BLOB || props.row.LOOKUP_BLOB.trim() === ''" class="text-grey-5">No metadata</div>
              <div v-else-if="isQuestionnaireColumn && isValidJson(props.row.LOOKUP_BLOB)">
                <div class="q-gutter-sm">
                  <q-chip dense color="green" text-color="white" icon="quiz" clickable @click="showQuestionnairePreview(props.row.LOOKUP_BLOB)">
                    Preview Questionnaire
                    <q-tooltip>Click to see how this questionnaire will appear to users</q-tooltip>
                  </q-chip>
                  <q-chip dense color="blue" text-color="white" icon="code" clickable @click="showJsonDialog(props.row.LOOKUP_BLOB)">
                    View JSON
                    <q-tooltip>Click to view raw JSON structure</q-tooltip>
                  </q-chip>
                </div>
                <div class="text-caption text-grey-6 q-mt-xs">
                  {{ getQuestionnaireInfo(props.row.LOOKUP_BLOB) }}
                </div>
              </div>
              <div v-else>
                <q-chip v-if="isValidJson(props.row.LOOKUP_BLOB)" dense color="blue" text-color="white" icon="code" clickable @click="showJsonDialog(props.row.LOOKUP_BLOB)">
                  JSON Metadata
                </q-chip>
                <span v-else class="text-body2">{{ props.row.LOOKUP_BLOB }}</span>
              </div>
            </div>
            <q-input
              v-else
              v-model="editForm.LOOKUP_BLOB"
              type="textarea"
              :rows="isQuestionnaireColumn ? 8 : 3"
              dense
              outlined
              @keyup.enter="saveEdit"
              @keyup.escape="cancelEdit"
              :placeholder="isQuestionnaireColumn ? 'Enter questionnaire JSON...' : 'Enter JSON metadata or description...'"
            />
          </q-td>
          <q-td key="actions" :props="props">
            <q-btn v-if="editingRow !== props.row.CODE_CD" flat round dense color="primary" icon="edit" @click="startEdit(props.row)">
              <q-tooltip>Edit</q-tooltip>
            </q-btn>
            <q-btn v-if="editingRow === props.row.CODE_CD" flat round dense color="positive" icon="check" @click="saveEdit">
              <q-tooltip>Save</q-tooltip>
            </q-btn>
            <q-btn v-if="editingRow === props.row.CODE_CD" flat round dense color="negative" icon="close" @click="cancelEdit">
              <q-tooltip>Cancel</q-tooltip>
            </q-btn>
            <q-btn v-if="editingRow !== props.row.CODE_CD && !isSystemValue(props.row)" flat round dense color="negative" icon="delete" @click="deleteValue(props.row)">
              <q-tooltip>Delete</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <!-- Add Dialog -->
    <q-dialog v-model="showAddDialog" persistent>
      <q-card :style="isQuestionnaireColumn ? 'min-width: 600px; max-width: 800px' : 'min-width: 400px'">
        <q-card-section>
          <div class="text-h6">Add New {{ getColumnTitle() }}</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="addValue" @reset="resetAddForm">
            <q-input
              v-model="addForm.CODE_CD"
              label="Code"
              outlined
              class="q-mb-md"
              :rules="[(val) => (val && val.length > 0) || 'Code is required', (val) => !lookupValues.some((v) => v.CODE_CD === val) || 'Code already exists']"
              :hint="isQuestionnaireColumn ? 'Unique identifier for the questionnaire (e.g., quest_moca)' : 'Unique code identifier'"
            />
            <q-input 
              v-model="addForm.NAME_CHAR" 
              label="Name/Value" 
              outlined 
              class="q-mb-md" 
              :rules="[(val) => (val && val.length > 0) || 'Name is required']"
              :hint="isQuestionnaireColumn ? 'Display name for the questionnaire (e.g., MoCA)' : 'Display name'"
            />
            <q-input
              v-model="addForm.LOOKUP_BLOB"
              :label="isQuestionnaireColumn ? 'Questionnaire JSON' : 'Metadata/Description (Optional)'"
              outlined
              type="textarea"
              :rows="isQuestionnaireColumn ? 10 : 4"
              :rules="isQuestionnaireColumn ? [validateQuestionnaireJson] : []"
              :hint="isQuestionnaireColumn ? 'Complete questionnaire JSON structure with title, items, and results configuration' : 'Enter JSON for metadata or plain text description'"
            />

            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn label="Cancel" color="grey" flat v-close-popup />
              <q-btn label="Reset" type="reset" color="warning" flat />
              <q-btn label="Add" type="submit" color="primary" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Import Questionnaire Dialog -->
    <q-dialog v-model="showImportDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Import Questionnaire</div>
          <div class="text-body2 text-grey-6">Upload a questionnaire JSON file</div>
        </q-card-section>

        <q-card-section>
          <q-file
            v-model="importFile"
            label="Select questionnaire JSON file"
            outlined
            accept=".json"
            @update:model-value="onFileSelected"
            :rules="[(val) => !!val || 'Please select a file']"
          >
            <template v-slot:prepend>
              <q-icon name="attach_file" />
            </template>
          </q-file>
          
          <div v-if="importPreview" class="q-mt-md">
            <div class="text-subtitle2 q-mb-sm">Preview:</div>
            <q-card flat bordered class="bg-grey-1">
              <q-card-section>
                <div><strong>Title:</strong> {{ importPreview.title || 'N/A' }}</div>
                <div><strong>Short Title:</strong> {{ importPreview.short_title || 'N/A' }}</div>
                <div><strong>Description:</strong> {{ importPreview.description || 'N/A' }}</div>
                <div><strong>Items:</strong> {{ importPreview.items?.length || 0 }} questions</div>
              </q-card-section>
            </q-card>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn label="Cancel" color="grey" flat @click="cancelImport" />
          <q-btn 
            label="Import" 
            color="primary" 
            @click="importQuestionnaire"
            :disable="!importPreview"
            :loading="importing"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- JSON Viewer Dialog -->
    <AppDialog
      v-model="showJsonViewDialog"
      title="JSON Metadata"
      subtitle="Raw JSON structure"
      size="lg"
      persistent
      :show-ok="false"
      cancel-label="Close"
      @cancel="showJsonViewDialog = false"
    >
      <pre class="json-viewer">{{ formatJson(jsonContent) }}</pre>
    </AppDialog>

    <!-- Questionnaire Preview Dialog -->
    <AppDialog
      v-model="showPreviewDialog"
      title="Questionnaire Preview"
      subtitle="Interactive preview of how this questionnaire will appear to users"
      size="full"
      :show-ok="false"
      cancel-label="Close"
      :content-padding="false"
      @cancel="showPreviewDialog = false"
    >
      <div class="q-pa-md">
        <PreviewSurveyTemplate :questionnaire="previewQuestionnaire" />
      </div>
    </AppDialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import PreviewSurveyTemplate from 'src/components/questionnaire/PreviewSurveyTemplate.vue'
import AppDialog from 'src/components/shared/AppDialog.vue'

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()

// State
const selectedTable = ref('')
const selectedColumn = ref('')
const lookupValues = ref([])
const loading = ref(false)
const filter = ref('')
const showAddDialog = ref(false)
const showImportDialog = ref(false)
const showJsonViewDialog = ref(false)
const showPreviewDialog = ref(false)
const jsonContent = ref('')
const previewQuestionnaire = ref(null)
const editingRow = ref(null)
const loadingColumns = ref(true)
const loadingTables = ref(true)
const importFile = ref(null)
const importPreview = ref(null)
const importing = ref(false)

// Form data
const addForm = ref({
  CODE_CD: '',
  NAME_CHAR: '',
  LOOKUP_BLOB: '',
})

const editForm = ref({
  NAME_CHAR: '',
  LOOKUP_BLOB: '',
})

// Table options - different categories of lookup data
const tableOptions = ref([
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
])

// Column options - will be loaded dynamically based on selected table
const columnOptions = ref([])

// Table configuration
const columns = [
  {
    name: 'CODE_CD',
    label: 'Code',
    field: 'CODE_CD',
    align: 'left',
    sortable: true,
  },
  {
    name: 'NAME_CHAR',
    label: 'Name/Value',
    field: 'NAME_CHAR',
    align: 'left',
    sortable: true,
  },
  {
    name: 'LOOKUP_BLOB',
    label: 'Description',
    field: 'LOOKUP_BLOB',
    align: 'left',
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
  },
]

const pagination = ref({
  rowsPerPage: 20,
})

// Computed
const isQuestionnaireColumn = computed(() => {
  return selectedColumn.value === 'QUESTIONNAIR'
})

// Methods
const getColumnTitle = () => {
  const option = columnOptions.value.find((opt) => opt.value === selectedColumn.value)
  return option ? option.label : 'Values'
}

// JSON handling methods
const isValidJson = (str) => {
  if (!str || str.trim() === '') return false
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

const formatJson = (jsonString) => {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2)
  } catch {
    return jsonString
  }
}

const showJsonDialog = (jsonString) => {
  jsonContent.value = jsonString
  showJsonViewDialog.value = true
}

const showQuestionnairePreview = (jsonString) => {
  try {
    previewQuestionnaire.value = JSON.parse(jsonString)
    showPreviewDialog.value = true
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to parse questionnaire JSON',
      caption: error.message
    })
  }
}

const getQuestionnaireInfo = (jsonString) => {
  try {
    const questionnaire = JSON.parse(jsonString)
    const itemCount = questionnaire.items?.length || 0
    const method = questionnaire.results?.method || 'N/A'
    return `${itemCount} items • Method: ${method}`
  } catch {
    return 'Invalid JSON'
  }
}

const validateQuestionnaireJson = (val) => {
  if (!val || val.trim() === '') return 'Questionnaire JSON is required'
  
  try {
    const questionnaire = JSON.parse(val)
    
    if (!questionnaire.title) return 'Missing required field: title'
    if (!questionnaire.short_title) return 'Missing required field: short_title'
    if (!questionnaire.items || !Array.isArray(questionnaire.items)) {
      return 'Missing or invalid field: items (must be array)'
    }
    if (questionnaire.items.length === 0) return 'Questionnaire must have at least one item'
    
    return true
  } catch (error) {
    return `Invalid JSON: ${error.message}`
  }
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
          case 'QUESTIONNAIR':
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

const filterMethod = (rows, terms) => {
  const lowerTerms = terms ? terms.toLowerCase() : ''
  return rows.filter((row) => {
    return row.CODE_CD.toLowerCase().includes(lowerTerms) || row.NAME_CHAR.toLowerCase().includes(lowerTerms) || (row.LOOKUP_BLOB && row.LOOKUP_BLOB.toLowerCase().includes(lowerTerms))
  })
}

const isSystemValue = (row) => {
  return globalSettingsStore.isSystemValue(row)
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

const addValue = async () => {
  try {
    const result = await globalSettingsStore.dbStore.executeCommand(
      `INSERT INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'USER')`,
      [selectedTable.value, selectedColumn.value, addForm.value.CODE_CD, addForm.value.NAME_CHAR, addForm.value.LOOKUP_BLOB],
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
      resetAddForm()
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

const resetAddForm = () => {
  addForm.value = {
    CODE_CD: '',
    NAME_CHAR: '',
    LOOKUP_BLOB: '',
  }
}

// Import functionality
const onFileSelected = async (file) => {
  if (!file) {
    importPreview.value = null
    return
  }

  try {
    const text = await file.text()
    const questionnaire = JSON.parse(text)
    importPreview.value = questionnaire
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Invalid JSON file',
      caption: error.message
    })
    importPreview.value = null
  }
}

const importQuestionnaire = async () => {
  if (!importPreview.value) return

  importing.value = true
  try {
    const questionnaire = importPreview.value
    const codeCD = questionnaire.short_title || `quest_${Date.now()}`
    const nameChar = questionnaire.title || 'Imported Questionnaire'
    const lookupBlob = JSON.stringify(questionnaire, null, 2)

    const result = await globalSettingsStore.dbStore.executeCommand(
      `INSERT INTO CODE_LOOKUP (TABLE_CD, COLUMN_CD, CODE_CD, NAME_CHAR, LOOKUP_BLOB, UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'IMPORT')`,
      ['SURVEY_BEST', 'QUESTIONNAIR', codeCD, nameChar, lookupBlob]
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
        message: `Questionnaire "${nameChar}" imported successfully`,
        caption: `Code: ${codeCD}`
      })
      
      showImportDialog.value = false
      cancelImport()
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
  } finally {
    importing.value = false
  }
}

const cancelImport = () => {
  importFile.value = null
  importPreview.value = null
  showImportDialog.value = false
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

<style lang="scss" scoped>
.q-table__title {
  font-size: 1.2rem;
  font-weight: 500;
}

.json-viewer {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
