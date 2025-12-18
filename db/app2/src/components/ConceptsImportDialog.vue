<template>
  <AppDialog v-model="dialogModel" :title="$t('concepts.importConcepts')" :subtitle="$t('concepts.importConceptsSubtitle')" size="xl" persistent :show-ok="false" :show-cancel="false">
    <div class="concepts-import-dialog">
      <!-- Step 1: File Selection -->
      <div class="import-section q-mb-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="folder_open" class="q-mr-sm" />
          {{ $t('import.selectFile') }}
        </div>
        <FileUploadInput
          v-model="selectedFileData"
          :accepted-types="'.csv'"
          :max-size-m-b="10"
          @file-selected="onFileSelected"
          @file-cleared="onFileCleared"
        />
      </div>

      <!-- Step 2: CSV Validation Results -->
      <div v-if="validationErrors.length > 0" class="q-mb-lg">
        <q-banner class="bg-negative text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="error" />
          </template>
          <div class="text-subtitle2 q-mb-sm">{{ $t('import.validationErrors') }}</div>
          <div v-for="(error, index) in validationErrors" :key="index" class="q-mb-xs">• {{ error }}</div>
        </q-banner>
      </div>

      <div v-else-if="parsedConcepts.length > 0" class="q-mb-lg">
        <q-banner class="bg-positive text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="check_circle" />
          </template>
          <div class="text-subtitle2">{{ $t('import.csvValid', { count: parsedConcepts.length }) }}</div>
        </q-banner>
      </div>

      <!-- Step 3: Concept Selection Table -->
      <div v-if="parsedConcepts.length > 0 && validationErrors.length === 0" class="import-section">
        <div class="text-subtitle1 q-mb-md flex items-center justify-between">
          <div class="flex items-center">
            <q-icon name="table_chart" class="q-mr-sm" />
            {{ $t('import.selectConceptsToImport') }}
            <q-chip size="sm" color="primary" text-color="white" class="q-ml-md">
              {{ selectedConceptsCount }} / {{ filteredConcepts.length }} {{ $t('common.selected') }}
            </q-chip>
          </div>
          <div class="row items-center q-gutter-xs">
            <!-- Search filter -->
            <q-input
              v-model="conceptSearchQuery"
              outlined
              dense
              :placeholder="$t('concepts.searchPlaceholder')"
              class="q-mr-md"
              style="min-width: 200px"
              clearable
            >
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>
            <q-btn flat dense size="sm" color="primary" :label="$t('import.selectAll')" @click="selectAll" />
            <q-btn flat dense size="sm" color="grey-7" :label="$t('import.deselectAll')" @click="deselectAll" />
          </div>
        </div>

        <q-table
          :rows="filteredConcepts"
          :columns="tableColumns"
          row-key="rowIndex"
          :rows-per-page-options="[10, 25, 50, 100]"
          :pagination="{ rowsPerPage: 25 }"
          flat
          bordered
          class="concepts-table"
        >
          <!-- Selection header -->
          <template v-slot:header="props">
            <q-tr :props="props">
              <q-th auto-width>
                <q-checkbox
                  :model-value="isAllSelected"
                  :indeterminate="isIndeterminate"
                  @update:model-value="toggleAllSelection"
                />
              </q-th>
              <q-th v-for="col in props.cols" :key="col.name" :props="props">{{ col.label }}</q-th>
            </q-tr>
          </template>

          <!-- Row styling for errors/duplicates -->
          <template v-slot:body="props">
            <q-tr
              :props="props"
              :class="{
                'bg-red-1': props.row.hasError,
                'bg-orange-1': props.row.isDuplicate && !props.row.hasError,
              }"
            >
              <q-td auto-width>
                <q-checkbox
                  :model-value="isSelected(props.row)"
                  :disable="props.row.hasError"
                  @update:model-value="toggleSelection(props.row, $event)"
                />
              </q-td>
              <q-td v-for="col in props.cols" :key="col.name" :props="props">
                <slot :name="`body-cell-${col.name}`" :props="props">
                  {{ col.value }}
                </slot>
              </q-td>
            </q-tr>
          </template>

          <!-- Status column -->
          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-chip v-if="props.row.isDuplicate" size="sm" color="orange" text-color="white" icon="warning">
                {{ $t('import.duplicate') }}
              </q-chip>
              <q-chip v-else-if="props.row.hasError" size="sm" color="negative" text-color="white" icon="error">
                {{ $t('import.error') }}
              </q-chip>
              <q-chip v-else size="sm" color="positive" text-color="white" icon="check">
                {{ $t('import.new') }}
              </q-chip>
            </q-td>
          </template>

          <!-- CONCEPT_CD column -->
          <template v-slot:body-cell-CONCEPT_CD="props">
            <q-td :props="props" :class="{ 'text-negative': props.row.hasError }">
              <div class="text-weight-medium">{{ props.value || '-' }}</div>
              <div v-if="props.row.errorMessage" class="text-caption text-negative">{{ props.row.errorMessage }}</div>
            </q-td>
          </template>

          <!-- Value Type column -->
          <template v-slot:body-cell-VALTYPE_CD="props">
            <q-td :props="props">
              <ValueTypeIcon v-if="props.value" :value-type="props.value" size="24px" variant="default" />
              <span v-else class="text-grey-5">-</span>
            </q-td>
          </template>

        </q-table>
      </div>

      <!-- Step 4: Import Results -->
      <div v-if="importResults" class="import-section q-mt-lg">
        <div class="text-subtitle1 q-mb-md flex items-center">
          <q-icon name="assessment" class="q-mr-sm" />
          {{ $t('import.importResults') }}
        </div>
        <q-card flat bordered class="bg-grey-1">
          <q-card-section>
            <div class="row q-gutter-md">
              <div class="col-auto">
                <div class="text-center">
                  <q-icon name="check_circle" size="32px" color="positive" class="q-mb-xs" />
                  <div class="text-caption text-grey-7">{{ $t('import.importedSuccessfully') }}</div>
                  <div class="text-h6 text-weight-medium">{{ importResults.success }}</div>
                </div>
              </div>
              <div class="col-auto">
                <div class="text-center">
                  <q-icon name="warning" size="32px" color="orange" class="q-mb-xs" />
                  <div class="text-caption text-grey-7">{{ $t('import.skippedDuplicates') }}</div>
                  <div class="text-h6 text-weight-medium">{{ importResults.skipped }}</div>
                </div>
              </div>
              <div v-if="importResults.errors.length > 0" class="col-auto">
                <div class="text-center">
                  <q-icon name="error" size="32px" color="negative" class="q-mb-xs" />
                  <div class="text-caption text-grey-7">{{ $t('import.errors') }}</div>
                  <div class="text-h6 text-weight-medium">{{ importResults.errors.length }}</div>
                </div>
              </div>
            </div>

            <!-- Error Details -->
            <div v-if="importResults.errors.length > 0" class="q-mt-md">
              <q-separator class="q-mb-md" />
              <div class="text-subtitle2 q-mb-sm">{{ $t('import.errorDetails') }}</div>
              <q-list bordered separator>
                <q-item v-for="(error, index) in importResults.errors" :key="index">
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ error.conceptCode }}</q-item-label>
                    <q-item-label caption class="text-negative">{{ error.message }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <template #actions>
      <q-btn flat :label="$t('common.cancel')" color="grey-7" @click="onCancel" />
      <q-btn
        v-if="parsedConcepts.length > 0 && validationErrors.length === 0 && !importResults"
        :label="$t('import.importSelected')"
        color="primary"
        :loading="isImporting"
        :disable="selectedConceptsCount === 0 || isImporting"
        @click="onImport"
      />
      <q-btn v-if="importResults" :label="$t('common.close')" color="primary" @click="onClose" />
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from './shared/AppDialog.vue'
import FileUploadInput from './shared/FileUploadInput.vue'
import ValueTypeIcon from './shared/ValueTypeIcon.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'imported'])

const $q = useQuasar()
const dbStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ConceptsImportDialog')

// Expected CSV header columns (must match export format)
const EXPECTED_HEADERS = [
  'CONCEPT_PATH',
  'CONCEPT_CD',
  'NAME_CHAR',
  'VALTYPE_CD',
  'UNIT_CD',
  'RELATED_CONCEPT',
  'CONCEPT_BLOB',
  'UPDATE_DATE',
  'DOWNLOAD_DATE',
  'IMPORT_DATE',
  'SOURCESYSTEM_CD',
  'UPLOAD_ID',
  'CATEGORY_CHAR',
]

// State
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const selectedFileData = ref(null)
const csvContent = ref('')
const parsedConcepts = ref([])
const selectedConcepts = ref([])
const validationErrors = ref([])
const isImporting = ref(false)
const importResults = ref(null)
const conceptSearchQuery = ref('')

// Table columns
const tableColumns = [
  {
    name: 'status',
    label: 'Status',
    align: 'center',
    field: 'status',
    sortable: true,
    style: 'width: 100px',
  },
  {
    name: 'CONCEPT_CD',
    label: 'Concept Code',
    align: 'left',
    field: 'CONCEPT_CD',
    sortable: true,
    style: 'min-width: 200px',
  },
  {
    name: 'NAME_CHAR',
    label: 'Name',
    align: 'left',
    field: 'NAME_CHAR',
    sortable: true,
    style: 'min-width: 250px',
  },
  {
    name: 'CONCEPT_PATH',
    label: 'Path',
    align: 'left',
    field: 'CONCEPT_PATH',
    sortable: true,
    style: 'min-width: 200px',
  },
  {
    name: 'VALTYPE_CD',
    label: 'Type',
    align: 'center',
    field: 'VALTYPE_CD',
    sortable: true,
    style: 'width: 80px',
  },
  {
    name: 'CATEGORY_CHAR',
    label: 'Category',
    align: 'left',
    field: 'CATEGORY_CHAR',
    sortable: true,
    style: 'min-width: 150px',
  },
  {
    name: 'SOURCESYSTEM_CD',
    label: 'Source System',
    align: 'left',
    field: 'SOURCESYSTEM_CD',
    sortable: true,
    style: 'min-width: 150px',
  },
]

// Computed
const selectedConceptsCount = computed(() => {
  return selectedConcepts.value.length
})

const isAllSelected = computed(() => {
  const selectableConcepts = filteredConcepts.value.filter((c) => !c.hasError)
  return selectableConcepts.length > 0 && selectableConcepts.every((c) => isSelected(c))
})

const isIndeterminate = computed(() => {
  const selectableConcepts = filteredConcepts.value.filter((c) => !c.hasError)
  const selectedFilteredCount = selectableConcepts.filter((c) => isSelected(c)).length
  return selectedFilteredCount > 0 && selectedFilteredCount < selectableConcepts.length
})

// Filter concepts based on search query
const filteredConcepts = computed(() => {
  if (!conceptSearchQuery.value || conceptSearchQuery.value.trim() === '') {
    return parsedConcepts.value
  }

  const query = conceptSearchQuery.value.toLowerCase().trim()
  return parsedConcepts.value.filter((concept) => {
    const name = (concept.NAME_CHAR || '').toLowerCase()
    const code = (concept.CONCEPT_CD || '').toLowerCase()
    const path = (concept.CONCEPT_PATH || '').toLowerCase()
    return name.includes(query) || code.includes(query) || path.includes(query)
  })
})

// Methods

/**
 * Parse CSV line handling quoted values
 */
const parseCsvLine = (line) => {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Don't forget the last value
  values.push(current.trim())

  return values
}

/**
 * Remove UTF-8 BOM if present
 */
const removeBom = (text) => {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1)
  }
  return text
}

/**
 * Parse CSV content
 */
const parseCsvContent = (content) => {
  try {
    // Remove BOM if present
    const cleanContent = removeBom(content)
    const lines = cleanContent.split(/\r?\n/).filter((line) => line.trim())

    if (lines.length < 2) {
      return {
        success: false,
        error: 'CSV file must contain at least a header row and one data row',
        headers: null,
        rows: [],
      }
    }

    // Parse header row
    const headers = parseCsvLine(lines[0])

    // Validate headers
    if (headers.length !== EXPECTED_HEADERS.length) {
      return {
        success: false,
        error: `Header row has ${headers.length} columns, expected ${EXPECTED_HEADERS.length}`,
        headers: null,
        rows: [],
      }
    }

    // Check if headers match expected columns (allow different order)
    const headerSet = new Set(headers.map((h) => h.toUpperCase()))
    const missingHeaders = EXPECTED_HEADERS.filter((h) => !headerSet.has(h.toUpperCase()))
    if (missingHeaders.length > 0) {
      return {
        success: false,
        error: `Missing required headers: ${missingHeaders.join(', ')}`,
        headers: null,
        rows: [],
      }
    }

    // Parse data rows
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i])
      if (values.length === headers.length) {
        const row = {}
        headers.forEach((header, index) => {
          // Convert empty strings to null for database compatibility
          row[header] = values[index] === '' ? null : values[index]
        })
        row.rowIndex = i - 1 // Store original row index
        rows.push(row)
      } else if (values.length > 0) {
        // Row has data but wrong column count - this is a warning, not fatal
        logger.warn(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}. Skipping row.`)
      }
    }

    return {
      success: true,
      headers,
      rows,
      error: null,
    }
  } catch (error) {
    logger.error('Failed to parse CSV content', error)
    return {
      success: false,
      error: `Failed to parse CSV: ${error.message}`,
      headers: null,
      rows: [],
    }
  }
}

/**
 * Validate concept data
 */
const validateConcept = (concept) => {
  const errors = []

  if (!concept.CONCEPT_CD || concept.CONCEPT_CD.trim() === '') {
    errors.push('CONCEPT_CD is required')
  }

  if (!concept.NAME_CHAR || concept.NAME_CHAR.trim() === '') {
    errors.push('NAME_CHAR is required')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Check for duplicates
 */
const checkDuplicates = async (concepts) => {
  const conceptRepo = dbStore.getRepository('concept')
  if (!conceptRepo) {
    throw new Error('Concept repository not available')
  }

  const conceptsWithStatus = []

  for (const concept of concepts) {
    const validation = validateConcept(concept)

    if (!validation.isValid) {
      conceptsWithStatus.push({
        ...concept,
        hasError: true,
        isDuplicate: false,
        errorMessage: validation.errors.join(', '),
      })
      continue
    }

    // Check for duplicate
    try {
      const existing = await conceptRepo.findByConceptCode(concept.CONCEPT_CD)
      conceptsWithStatus.push({
        ...concept,
        hasError: false,
        isDuplicate: !!existing,
        existingConcept: existing || null,
        errorMessage: null,
      })
    } catch (error) {
      logger.error(`Error checking duplicate for ${concept.CONCEPT_CD}`, error)
      conceptsWithStatus.push({
        ...concept,
        hasError: true,
        isDuplicate: false,
        errorMessage: `Database error: ${error.message}`,
      })
    }
  }

  return conceptsWithStatus
}

/**
 * Read file content
 */
const readFileContent = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        resolve(e.target.result)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file, 'UTF-8')
  })
}

/**
 * Handle file selection
 */
const onFileSelected = async (fileData) => {
  try {
    validationErrors.value = []
    parsedConcepts.value = []
    selectedConcepts.value = []
    importResults.value = null

    if (!fileData || !fileData.originalFile) {
      return
    }

    const file = fileData.originalFile

    // Read file content
    csvContent.value = await readFileContent(file)

    // Parse CSV
    const parseResult = parseCsvContent(csvContent.value)

    if (!parseResult.success) {
      validationErrors.value = [parseResult.error]
      return
    }

    // Check duplicates and validate
    isImporting.value = true
    try {
      parsedConcepts.value = await checkDuplicates(parseResult.rows)
      // Don't auto-select - let user choose which concepts to import
      selectedConcepts.value = []
      
      // Log file analysis
      const duplicateCount = parsedConcepts.value.filter((c) => c.isDuplicate).length
      const errorCount = parsedConcepts.value.filter((c) => c.hasError).length
      const newCount = parsedConcepts.value.filter((c) => !c.isDuplicate && !c.hasError).length
      
      logger.info('CSV file analyzed and validated', {
        filename: file.name,
        totalConcepts: parsedConcepts.value.length,
        newConcepts: newCount,
        duplicates: duplicateCount,
        errors: errorCount,
      })
    } finally {
      isImporting.value = false
    }
  } catch (error) {
    logger.error('Error processing file', error)
    validationErrors.value = [`Failed to process file: ${error.message}`]
  }
}

/**
 * Handle file cleared
 */
const onFileCleared = () => {
  csvContent.value = ''
  parsedConcepts.value = []
  selectedConcepts.value = []
  validationErrors.value = []
  importResults.value = null
  conceptSearchQuery.value = ''
}

/**
 * Select all concepts (filtered ones that aren't already selected)
 */
const selectAll = () => {
  const selectableFiltered = filteredConcepts.value.filter((c) => !c.hasError && !isSelected(c))
  // Add filtered concepts to selection (find original in parsedConcepts to maintain reference)
  selectableFiltered.forEach((filteredConcept) => {
    const original = parsedConcepts.value.find((p) => p.rowIndex === filteredConcept.rowIndex)
    if (original && !isSelected(original)) {
      selectedConcepts.value.push({ ...original })
    }
  })
}

/**
 * Deselect all concepts
 */
const deselectAll = () => {
  selectedConcepts.value = []
}

/**
 * Toggle all selection
 */
const toggleAllSelection = (selected) => {
  if (selected) {
    selectAll()
  } else {
    deselectAll()
  }
}

/**
 * Check if concept is selected
 */
const isSelected = (concept) => {
  return selectedConcepts.value.some((c) => c.rowIndex === concept.rowIndex)
}

/**
 * Toggle concept selection
 */
const toggleSelection = (concept, selected) => {
  if (concept.hasError) return

  if (selected) {
    if (!isSelected(concept)) {
      selectedConcepts.value.push(concept)
    }
  } else {
    const index = selectedConcepts.value.findIndex((c) => c.rowIndex === concept.rowIndex)
    if (index > -1) {
      selectedConcepts.value.splice(index, 1)
    }
  }
}

/**
 * Import selected concepts
 */
const onImport = async () => {
  if (selectedConcepts.value.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'Please select at least one concept to import',
      position: 'top',
    })
    return
  }

  isImporting.value = true
  importResults.value = {
    success: 0,
    skipped: 0,
    errors: [],
  }

  const conceptRepo = dbStore.getRepository('concept')
  if (!conceptRepo) {
    $q.notify({
      type: 'negative',
      message: 'Concept repository not available',
      position: 'top',
    })
    isImporting.value = false
    return
  }

  try {
    for (const concept of selectedConcepts.value) {
      // Skip duplicates
      if (concept.isDuplicate) {
        importResults.value.skipped++
        continue
      }

      // Skip concepts with errors
      if (concept.hasError) {
        importResults.value.errors.push({
          conceptCode: concept.CONCEPT_CD || 'Unknown',
          message: concept.errorMessage || 'Validation error',
        })
        continue
      }

      // Prepare concept data
      const conceptData = {
        CONCEPT_CD: concept.CONCEPT_CD,
        NAME_CHAR: concept.NAME_CHAR,
        CONCEPT_PATH: concept.CONCEPT_PATH || null,
        VALTYPE_CD: concept.VALTYPE_CD || null,
        UNIT_CD: concept.UNIT_CD || null,
        RELATED_CONCEPT: concept.RELATED_CONCEPT || null,
        CONCEPT_BLOB: concept.CONCEPT_BLOB || null,
        UPDATE_DATE: concept.UPDATE_DATE || new Date().toISOString(),
        DOWNLOAD_DATE: concept.DOWNLOAD_DATE || null,
        IMPORT_DATE: concept.IMPORT_DATE || new Date().toISOString(),
        SOURCESYSTEM_CD: concept.SOURCESYSTEM_CD || null,
        UPLOAD_ID: concept.UPLOAD_ID || null,
        CATEGORY_CHAR: concept.CATEGORY_CHAR || null,
      }

      // Import concept
      try {
        await conceptRepo.createConcept(conceptData)
        importResults.value.success++
      } catch (error) {
        logger.error(`Failed to import concept ${concept.CONCEPT_CD}`, error)
        importResults.value.errors.push({
          conceptCode: concept.CONCEPT_CD,
          message: error.message || 'Failed to create concept',
        })
      }
    }

    // Show notification
    $q.notify({
      type: 'positive',
      message: `Import completed: ${importResults.value.success} imported, ${importResults.value.skipped} skipped`,
      position: 'top',
      timeout: 5000,
    })

    // Create log entry with import details
    if (importResults.value.success > 0 || importResults.value.skipped > 0 || importResults.value.errors.length > 0) {
      const logMessage = `Concept import completed: ${importResults.value.success} imported, ${importResults.value.skipped} skipped${importResults.value.errors.length > 0 ? `, ${importResults.value.errors.length} errors` : ''}`
      
      if (importResults.value.errors.length > 0) {
        logger.warn(logMessage, {
          success: importResults.value.success,
          skipped: importResults.value.skipped,
          errors: importResults.value.errors.length,
          errorDetails: importResults.value.errors.map((e) => `${e.conceptCode}: ${e.message}`),
        })
      } else if (importResults.value.success > 0) {
        logger.success(logMessage, {
          success: importResults.value.success,
          skipped: importResults.value.skipped,
          totalSelected: selectedConcepts.value.length,
        })
      } else {
        logger.info(logMessage, {
          success: importResults.value.success,
          skipped: importResults.value.skipped,
        })
      }
    }

    // Emit imported event
    emit('imported', importResults.value)
  } catch (error) {
    logger.error('Import failed', error)
    $q.notify({
      type: 'negative',
      message: `Import failed: ${error.message}`,
      position: 'top',
    })
  } finally {
    isImporting.value = false
  }
}

/**
 * Handle cancel
 */
const onCancel = () => {
  dialogModel.value = false
  onFileCleared()
}

/**
 * Handle close (after import)
 */
const onClose = () => {
  dialogModel.value = false
  onFileCleared()
}

// Reset when dialog closes
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) {
      onFileCleared()
    }
  },
)
</script>

<style lang="scss" scoped>
.concepts-import-dialog {
  .import-section {
    margin-bottom: 24px;
  }

  .concepts-table {
    :deep(.q-table__top) {
      padding: 12px;
    }

    :deep(.q-table tbody tr.bg-red-1) {
      background-color: #ffebee !important;
    }

    :deep(.q-table tbody tr.bg-orange-1) {
      background-color: #fff3e0 !important;
    }
  }
}
</style>

