<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">Concepts Administration</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">
          Showing {{ concepts.length }} of {{ totalConcepts }} concepts
        </div>
        <q-btn color="primary" icon="add" label="Create Concept" @click="onCreateConcept" />
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-4">
        <q-input v-model="searchQuery" outlined dense placeholder="Search concepts (code, name, path)..."
          @update:model-value="onSearchChange" debounce="300">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-icon v-if="searchQuery" name="close" @click="clearSearch" class="cursor-pointer" />
          </template>
        </q-input>
      </div>
      <div class="col-12 col-md-5">
        <q-select v-model="selectedValueTypes" outlined dense :options="valueTypeOptions" label="Filter by Value Type"
          multiple clearable emit-value map-options use-chips @update:model-value="onFilterChange">
          <template v-slot:selected-item="scope">
            <q-chip removable dense @remove="scope.removeAtIndex(scope.index)" :tabindex="scope.tabindex"
              color="primary" text-color="white">
              {{ scope.opt.value }}
            </q-chip>
          </template>
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon v-if="selectedValueTypes && selectedValueTypes.includes(scope.opt.value)" name="check"
                  color="primary" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
      <div class="col-12 col-md-2">
        <q-select v-model="selectedSourceSystem" outlined dense :options="sourceSystemOptions" label="Source System"
          clearable emit-value map-options @update:model-value="onFilterChange" />
      </div>
    </div>

    <!-- Concepts Table -->
    <q-table :rows="concepts" :columns="columns" row-key="CONCEPT_CD" :loading="loading" :pagination="pagination"
      @request="onRequest" binary-state-sort :rows-per-page-options="[10, 25, 50]">
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

    <!-- Edit Concept Dialog -->
    <ConceptEditDialog v-model="showEditDialog" :concept="selectedConcept" @save="onSaveConcept"
      @cancel="onCancelEdit" />

    <!-- Create Concept Dialog -->
    <ConceptCreateDialog v-model="showCreateDialog" @save="onSaveNewConcept" @cancel="onCancelCreate" />
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import ConceptEditDialog from 'components/ConceptEditDialog.vue'
import ConceptCreateDialog from 'components/ConceptCreateDialog.vue'
import ValueTypeIcon from 'components/shared/ValueTypeIcon.vue'

const $q = useQuasar()
const dbStore = useDatabaseStore()

// State
const concepts = ref([])
const totalConcepts = ref(0)
const loading = ref(false)
const showEditDialog = ref(false)
const showCreateDialog = ref(false)
const selectedConcept = ref(null)
const searchQuery = ref('')
const selectedValueTypes = ref(['D', 'F', 'N', 'R', 'S', 'T']) // All except 'A' which is disabled by default
const selectedSourceSystem = ref(null)

// Table configuration
const columns = [
  {
    name: 'NAME_CHAR',
    label: 'Name and Code',
    align: 'left',
    field: 'NAME_CHAR',
    sortable: true,
    style: 'min-width: 300px'
  },
  {
    name: 'CONCEPT_PATH',
    label: 'Path',
    align: 'left',
    field: 'CONCEPT_PATH',
    sortable: true,
    style: 'min-width: 200px; max-width: 400px'
  },
  {
    name: 'VALTYPE_CD',
    label: 'Type',
    align: 'center',
    field: 'VALTYPE_CD',
    sortable: true,
    style: 'width: 80px'
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    field: 'actions',
    sortable: false,
    style: 'width: 100px'
  }
]

const pagination = ref({
  sortBy: 'NAME_CHAR',
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0
})

const valueTypeOptions = [
  { label: 'Answers (A)', value: 'A' },
  { label: 'Date (D)', value: 'D' },
  { label: 'Findings (F)', value: 'F' },
  { label: 'Numeric (N)', value: 'N' },
  { label: 'Raw Text (R)', value: 'R' },
  { label: 'Selection (S)', value: 'S' },
  { label: 'Text (T)', value: 'T' }
]

const sourceSystemOptions = ref([
  { label: 'LOINC', value: 'LOINC' },
  { label: 'ICD10-2019', value: 'ICD10-2019' },
  { label: 'SNOMED-CT', value: 'SNOMED-CT' }
])

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
      criteria.valueTypes = selectedValueTypes.value.map(type => String(type))
    }
    if (selectedSourceSystem.value) {
      criteria.sourceSystem = String(selectedSourceSystem.value)
    }

    // Get paginated results
    const result = await conceptRepo.getConceptsPaginated(
      pagination.value.page,
      pagination.value.rowsPerPage,
      criteria
    )

    concepts.value = result.concepts || []
    totalConcepts.value = result.pagination?.totalCount || 0
    pagination.value.rowsNumber = totalConcepts.value

    // Load source systems for filter if not loaded
    if (sourceSystemOptions.value.length <= 3) {
      await loadSourceSystems()
    }

  } catch (error) {
    console.error('Failed to load concepts:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load concepts',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const loadSourceSystems = async () => {
  try {
    const conceptRepo = dbStore.getRepository('concept')
    const result = await conceptRepo.connection.executeQuery(
      'SELECT DISTINCT SOURCESYSTEM_CD FROM CONCEPT_DIMENSION WHERE SOURCESYSTEM_CD IS NOT NULL ORDER BY SOURCESYSTEM_CD'
    )

    if (result.success && result.data) {
      sourceSystemOptions.value = result.data.map(row => ({
        label: row.SOURCESYSTEM_CD,
        value: row.SOURCESYSTEM_CD
      }))
    }
  } catch (error) {
    console.error('Failed to load source systems:', error)
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

// Concept actions
const onCreateConcept = () => {
  showCreateDialog.value = true
}

const onEditConcept = (concept) => {
  selectedConcept.value = { ...concept }
  showEditDialog.value = true
}



const onDeleteConcept = (concept) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete concept "${concept.NAME_CHAR}" (${concept.CONCEPT_CD})? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(async () => {
    try {
      const conceptRepo = dbStore.getRepository('concept')
      await conceptRepo.deleteConcept(concept.CONCEPT_CD)

      $q.notify({
        type: 'positive',
        message: 'Concept deleted successfully',
        position: 'top'
      })

      await loadConcepts()
    } catch (error) {
      console.error('Failed to delete concept:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete concept',
        position: 'top'
      })
    }
  })
}

// Dialog handlers
const onSaveConcept = async (conceptData) => {
  try {
    const conceptRepo = dbStore.getRepository('concept')
    await conceptRepo.updateConcept(selectedConcept.value.CONCEPT_CD, conceptData)

    $q.notify({
      type: 'positive',
      message: 'Concept updated successfully',
      position: 'top'
    })

    showEditDialog.value = false
    await loadConcepts()
  } catch (error) {
    console.error('Failed to update concept:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to update concept',
      position: 'top'
    })
  }
}

const onSaveNewConcept = async (conceptData) => {
  try {
    const conceptRepo = dbStore.getRepository('concept')
    await conceptRepo.createConcept(conceptData)

    $q.notify({
      type: 'positive',
      message: 'Concept created successfully',
      position: 'top'
    })

    showCreateDialog.value = false
    await loadConcepts()
  } catch (error) {
    console.error('Failed to create concept:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to create concept',
      position: 'top'
    })
  }
}

const onCancelEdit = () => {
  showEditDialog.value = false
  selectedConcept.value = null
}

const onCancelCreate = () => {
  showCreateDialog.value = false
  selectedConcept.value = null
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