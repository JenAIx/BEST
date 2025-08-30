<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">Concepts Administration</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">Showing {{ concepts.length }} of {{ totalConcepts }} concepts</div>
        <q-btn flat round dense icon="download" color="primary" @click="onExportConcepts" :loading="exportLoading">
          <q-tooltip>Export to CSV</q-tooltip>
        </q-btn>
        <q-btn color="primary" icon="add" label="Create Concept" @click="onCreateConcept" />
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-3">
        <q-input v-model="searchQuery" outlined dense placeholder="Search concepts (code, name, path)..." @update:model-value="onSearchChange" debounce="300">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-icon v-if="searchQuery" name="close" @click="clearSearch" class="cursor-pointer" />
          </template>
        </q-input>
      </div>
      <div class="col-12 col-md-4">
        <q-select
          v-model="selectedValueTypes"
          outlined
          dense
          :options="valueTypeOptions"
          label="Filter by Value Type"
          multiple
          clearable
          emit-value
          map-options
          use-chips
          @update:model-value="onFilterChange"
        >
          <template v-slot:selected-item="scope">
            <q-chip removable dense @remove="scope.removeAtIndex(scope.index)" :tabindex="scope.tabindex" color="primary" text-color="white">
              {{ scope.opt.value }}
            </q-chip>
          </template>
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon v-if="selectedValueTypes && selectedValueTypes.includes(scope.opt.value)" name="check" color="primary" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
      <div class="col-12 col-md-2">
        <q-select
          v-model="selectedCategories"
          outlined
          dense
          :options="categoryOptions"
          label="Filter by Category"
          multiple
          clearable
          emit-value
          map-options
          use-chips
          @update:model-value="onFilterChange"
        >
          <template v-slot:selected-item="scope">
            <q-chip removable dense @remove="scope.removeAtIndex(scope.index)" :tabindex="scope.tabindex" color="secondary" text-color="white">
              {{ scope.opt.label }}
            </q-chip>
          </template>
        </q-select>
      </div>
      <div class="col-12 col-md-2">
        <q-select v-model="selectedSourceSystem" outlined dense :options="sourceSystemOptions" label="Source System" clearable emit-value map-options @update:model-value="onFilterChange" />
      </div>
    </div>

    <!-- Concepts Table -->
    <q-table :rows="concepts" :columns="columns" row-key="CONCEPT_CD" :loading="loading" :pagination="pagination" @request="onRequest" binary-state-sort :rows-per-page-options="[10, 25, 50]">
      <!-- Name and Concept Code Column -->
      <template v-slot:body-cell-NAME_CHAR="props">
        <q-td :props="props">
          <div>
            <div class="text-weight-medium">{{ props.value }}</div>
            <div class="text-caption text-grey-6">{{ props.row.CONCEPT_CD }}</div>
            <div v-if="props.row.CONCEPT_BLOB" class="text-caption text-grey-6">
              {{ truncateText(props.row.CONCEPT_BLOB, 50) }}
            </div>
          </div>
        </q-td>
      </template>

      <!-- Category Column -->
      <template v-slot:body-cell-CATEGORY_CHAR="props">
        <q-td :props="props">
          <q-chip v-if="props.value" :label="formatCategoryName(props.value)" size="sm" color="grey-3" text-color="grey-8" dense />
          <span v-else class="text-grey-5">-</span>
        </q-td>
      </template>

      <!-- Concept Path Column -->
      <template v-slot:body-cell-CONCEPT_PATH="props">
        <q-td :props="props">
          <div class="text-caption text-grey-7 monospace path-text" :title="props.value">
            {{ props.value }}
            <q-tooltip>{{ props.value }}</q-tooltip>
          </div>
        </q-td>
      </template>

      <!-- Value Type Column -->
      <template v-slot:body-cell-VALTYPE_CD="props">
        <q-td :props="props">
          <div class="row items-center justify-center">
            <ValueTypeIcon :value-type="props.value" size="28px" variant="default" />
          </div>
        </q-td>
      </template>

      <!-- Actions Column -->
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round dense icon="edit" color="primary" @click="onEditConcept(props.row)">
            <q-tooltip>Edit Concept</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="delete" color="negative" @click="onDeleteConcept(props.row)">
            <q-tooltip>Delete Concept</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Concept Dialog (Create/Edit) -->
    <ConceptDialog 
      v-model="showConceptDialog" 
      :mode="conceptDialogMode"
      :concept="selectedConcept" 
      @saved="onConceptSaved" 
      @cancelled="onConceptCancelled" 
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useExportStore } from 'src/stores/export-store'
import { createLogger } from 'src/core/services/logging-service'
import ConceptDialog from 'components/ConceptDialog.vue'
import ValueTypeIcon from 'components/shared/ValueTypeIcon.vue'

const $q = useQuasar()
const dbStore = useDatabaseStore()
const globalSettingsStore = useGlobalSettingsStore()
const exportStore = useExportStore()
const logger = createLogger('ConceptsPage')

// State
const concepts = ref([])
const totalConcepts = ref(0)
const loading = ref(false)
const exportLoading = ref(false)
const showConceptDialog = ref(false)
const conceptDialogMode = ref('create')
const selectedConcept = ref(null)
const searchQuery = ref('')
const selectedValueTypes = ref(['D', 'F', 'N', 'R', 'S', 'T']) // All except 'A' which is disabled by default
const selectedSourceSystem = ref(null)
const selectedCategories = ref([])
const categoryOptions = ref([])
const valueTypeOptions = ref([])
const sourceSystemOptions = ref([])

// Table configuration
const columns = [
  {
    name: 'NAME_CHAR',
    label: 'Name and Code',
    align: 'left',
    field: 'NAME_CHAR',
    sortable: true,
    style: 'max-width: 200px',
  },
  {
    name: 'CATEGORY_CHAR',
    label: 'Category',
    align: 'left',
    field: 'CATEGORY_CHAR',
    sortable: true,
    style: 'max-width: 150px',
  },
  {
    name: 'CONCEPT_PATH',
    label: 'Path',
    align: 'left',
    field: 'CONCEPT_PATH',
    sortable: true,
    style: 'min-width: 200px; max-width: 400px',
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
    name: 'actions',
    label: 'Actions',
    align: 'center',
    field: 'actions',
    sortable: false,
    style: 'width: 100px',
  },
]

const pagination = ref({
  sortBy: 'NAME_CHAR',
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
})

// Options will be loaded from global settings store

// Methods
const loadConcepts = async () => {
  loading.value = true
  try {
    const conceptRepo = dbStore.getRepository('concept')
    if (!conceptRepo) {
      throw new Error('Concept repository not available')
    }

    // Build search criteria - ensure we use plain values, not reactive proxies
    const criteria = {}
    if (searchQuery.value) {
      criteria.search = String(searchQuery.value)
    }
    if (selectedValueTypes.value && selectedValueTypes.value.length > 0) {
      criteria.valueTypes = selectedValueTypes.value.map((type) => String(type))
    }
    if (selectedSourceSystem.value) {
      criteria.sourceSystem = String(selectedSourceSystem.value)
    }
    if (selectedCategories.value && selectedCategories.value.length > 0) {
      criteria.categories = selectedCategories.value.map((cat) => String(cat))
    }

    // Get paginated results
    const result = await conceptRepo.getConceptsPaginated(pagination.value.page, pagination.value.rowsPerPage, criteria)

    concepts.value = result.concepts || []
    totalConcepts.value = result.pagination?.totalCount || 0
    pagination.value.rowsNumber = totalConcepts.value

    // Load options for filters if not loaded
    if (valueTypeOptions.value.length === 0) {
      await loadValueTypes()
    }
    if (sourceSystemOptions.value.length === 0) {
      await loadSourceSystems()
    }
    if (categoryOptions.value.length === 0) {
      await loadCategories()
    }
  } catch (error) {
    console.error('Failed to load concepts:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load concepts',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const loadValueTypes = async () => {
  try {
    valueTypeOptions.value = await globalSettingsStore.getValueTypeOptions()
  } catch (error) {
    console.error('Failed to load value types:', error)
  }
}

const loadSourceSystems = async () => {
  try {
    // Try to load from CODE_LOOKUP first, fall back to CONCEPT_DIMENSION
    let options = await globalSettingsStore.getSourceSystemOptions()
    if (options.length === 0) {
      options = await globalSettingsStore.getSourceSystemOptionsFromConcepts()
    }
    sourceSystemOptions.value = options
  } catch (error) {
    console.error('Failed to load source systems:', error)
  }
}

const loadCategories = async () => {
  try {
    categoryOptions.value = await globalSettingsStore.getCategoryOptions()
  } catch (error) {
    console.error('Failed to load categories:', error)
  }
}

const onRequest = (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  // Update pagination
  pagination.value.page = page
  pagination.value.rowsPerPage = rowsPerPage
  pagination.value.sortBy = sortBy
  pagination.value.descending = descending

  // Reload data with new pagination
  loadConcepts()
}

const onSearchChange = () => {
  // Reset to first page when searching
  pagination.value.page = 1
  loadConcepts()
}

const onFilterChange = () => {
  // Reset to first page when filtering
  pagination.value.page = 1
  loadConcepts()
}

const clearSearch = () => {
  searchQuery.value = ''
  pagination.value.page = 1
  loadConcepts()
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

const formatCategoryName = (category) => {
  // If it's already a formatted name from the database, return as is
  if (!category || !category.startsWith('CAT_')) {
    return category || ''
  }
  // If it's a code, format it
  return globalSettingsStore.formatCategoryLabel(category)
}

// Concept actions
const onCreateConcept = () => {
  selectedConcept.value = null
  conceptDialogMode.value = 'create'
  showConceptDialog.value = true
}

const onEditConcept = (concept) => {
  selectedConcept.value = { ...concept }
  conceptDialogMode.value = 'edit'
  showConceptDialog.value = true
}

const onDeleteConcept = (concept) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete concept "${concept.NAME_CHAR}" (${concept.CONCEPT_CD})? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      const conceptRepo = dbStore.getRepository('concept')
      await conceptRepo.deleteConcept(concept.CONCEPT_CD)

      $q.notify({
        type: 'positive',
        message: 'Concept deleted successfully',
        position: 'top',
      })

      await loadConcepts()
    } catch (error) {
      console.error('Failed to delete concept:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete concept',
        position: 'top',
      })
    }
  })
}

// Dialog handlers
const onConceptSaved = async () => {
  // Notification is handled by the dialog component
  // Just refresh the list
  await loadConcepts()
}

const onConceptCancelled = () => {
  // Dialog will close itself
  selectedConcept.value = null
}

// Export functionality
const onExportConcepts = async () => {
  exportLoading.value = true
  logger.info('User initiated concept CSV export', {
    totalConceptsDisplayed: concepts.value.length,
    totalConceptsInDatabase: totalConcepts.value,
  })

  try {
    const result = await exportStore.exportConceptsToCSV()

    if (result.success) {
      logger.success('Concept CSV export completed successfully', {
        recordCount: result.recordCount,
        filename: result.filename,
        fileSize: result.fileSize,
        duration: result.duration,
      })

      $q.notify({
        type: 'positive',
        message: result.message,
        caption: `File size: ${result.fileSize}KB • Export time: ${result.duration}ms`,
        position: 'top',
        timeout: 5000,
        actions: [
          {
            label: 'Dismiss',
            color: 'white',
            handler: () => {
              /* intentionally ignored */
            },
          },
        ],
      })
    } else {
      logger.error('Concept CSV export failed', null, {
        error: result.error,
        message: result.message,
      })

      $q.notify({
        type: 'negative',
        message: result.message,
        position: 'top',
      })
    }
  } catch (error) {
    logger.error('Concept CSV export threw exception', error)
    console.error('Failed to export concepts:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to export concepts',
      position: 'top',
    })
  } finally {
    exportLoading.value = false
  }
}

// Initialize
onMounted(() => {
  loadConcepts()
})
</script>

<style lang="scss" scoped>
.monospace {
  font-family: 'Courier New', monospace;
  font-size: 0.8em;
}

.path-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
