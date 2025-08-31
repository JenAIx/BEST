<template>
  <AppDialog
    v-model="dialogVisible"
    size="xl"
    :persistent="true"
    :show-close="true"
    :show-actions="true"
    :show-cancel="true"
    :show-ok="true"
    :ok-label="'Select Path'"
    :cancel-label="'Cancel'"
    title="Concept Path Picker"
    subtitle="Search and edit concept paths"
    @ok="onSelect"
    @cancel="onCancel"
    @close="onCancel"
  >
    <!-- Header slot for custom content -->
    <template #header>
      <div class="text-h6">
        <q-icon name="account_tree" class="q-mr-sm" />
        Concept Path Picker
      </div>
      <div class="text-caption text-grey-6">
        Search and edit concept paths for your medical data
      </div>
    </template>

    <!-- Main content -->
    <div class="column q-gutter-md">
      <!-- Top Section - Full Path Display -->
      <div class="full-path-section">
        <q-card flat bordered class="bg-blue-1">
          <q-card-section class="q-pa-md">
            <div class="text-subtitle1 q-mb-sm text-grey-8">
              <q-icon name="route" class="q-mr-sm" />
              Full Path Preview
            </div>
            <div class="full-path-display text-mono text-weight-medium">
              {{ fullPath || '\\' }}
            </div>
            <div v-if="fullPath && fullPath !== '\\'" class="text-caption text-grey-6 q-mt-xs">
              <q-icon name="info" size="sm" class="q-mr-xs" />
              This is the complete path that will be saved
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Middle Section - Path Editor -->
      <div class="path-editor-section">
        <div class="text-subtitle1 q-mb-md text-grey-8">
          <q-icon name="edit" class="q-mr-sm" />
          Path Editor
        </div>

        <!-- Current Path Segments -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pa-md">
            <div class="text-body2 text-grey-8 q-mb-sm">Current Path Segments:</div>
            <div v-if="!editablePath || editablePath.length === 0" class="text-grey-6">
              <q-icon name="info_outline" class="q-mr-xs" />
              No path segments added yet
            </div>
            <div v-else class="path-chips q-mb-md">
              <q-chip
                v-for="(segment, index) in editablePath"
                :key="index"
                dense
                color="primary"
                text-color="white"
                :removable="index > 0"
                @remove="removePathSegment(index)"
                class="q-mr-xs q-mb-xs"
              >
                <q-icon name="chevron_right" size="sm" v-if="index > 0" />
                {{ segment }}
              </q-chip>
            </div>

            <!-- Add New Segment -->
            <div class="add-segment-section">
              <q-input
                v-model="newSegment"
                outlined
                dense
                placeholder="Enter path segment (e.g., LOINC, CHEM, VITALS)"
                clearable
                @keyup.enter="addPathSegment"
                label="Add Path Segment"
              >
                <template v-slot:append>
                  <q-btn
                    flat
                    dense
                    icon="add"
                    @click="addPathSegment"
                    color="primary"
                    :disable="!newSegment"
                  />
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Bottom Section - Search -->
      <div class="search-section">
        <div class="text-subtitle1 q-mb-md text-grey-8">
          <q-icon name="search" class="q-mr-sm" />
          Search & Select Concepts
        </div>

        <!-- Search Controls -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pa-md">
            <div class="row q-gutter-sm">
              <div class="col-12 col-md-4">
                <q-select
                  v-model="searchType"
                  :options="searchOptions"
                  option-value="value"
                  option-label="label"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Search by"
                  class="full-width"
                />
              </div>
              <div class="col-12 col-md">
                <q-input
                  v-model="searchQuery"
                  outlined
                  dense
                  :label="`Search ${searchType}...`"
                  placeholder="Enter search term"
                  clearable
                  @keyup.enter="performSearch"
                  :loading="searching"
                  class="full-width"
                >
                  <template v-slot:prepend>
                    <q-icon name="search" />
                  </template>
                  <template v-slot:append>
                    <q-btn
                      flat
                      dense
                      icon="search"
                      @click="performSearch"
                      :loading="searching"
                      color="primary"
                    />
                  </template>
                </q-input>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="search-results">
          <div class="text-subtitle2 q-mb-sm text-grey-8">
            <q-icon name="list" class="q-mr-xs" />
            Search Results ({{ searchResults.length }})
          </div>
          <q-list bordered class="rounded-borders">
            <q-item
              v-for="(result, index) in searchResults"
              :key="index"
              clickable
              @click="selectFromResults(result)"
              class="search-result-item"
            >
              <q-item-section avatar>
                <q-icon name="folder" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">
                  {{ result.NAME_CHAR }}
                </q-item-label>
                <q-item-label caption>
                  {{ result.CONCEPT_CD }}
                </q-item-label>
                <q-item-label caption class="text-grey-6">
                  {{ result.CONCEPT_PATH }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="chevron_right" color="primary" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- No results message -->
        <div v-else-if="searchQuery && !searching" class="text-center q-pa-lg text-grey-6">
          <q-icon name="search_off" size="md" class="q-mb-sm" />
          <div>No results found for "{{ searchQuery }}"</div>
          <div class="text-caption">Try a different search term or type</div>
        </div>
      </div>
    </div>

    <!-- Custom actions slot -->
    <template #actions>
      <q-btn
        color="primary"
        label="Select Path"
        @click="onSelect"
        icon="check"
        :disable="!selectedPath && (!editablePath || editablePath.length === 0)"
        unelevated
      />
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from './AppDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  currentPath: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

// Initialize stores
const dbStore = useDatabaseStore()
const loggingStore = useLoggingStore()

// Reactive state
const searchType = ref('NAME_CHAR')
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref([])
const selectedPath = ref(null)
const editablePath = ref([])
const newSegment = ref('')
const originalConceptCode = ref('') // Store the last element of original path

// Search options for dropdown
const searchOptions = [
  { label: 'Concept Name', value: 'NAME_CHAR' },
  { label: 'Concept Code', value: 'CONCEPT_CD' },
  { label: 'Concept Path', value: 'CONCEPT_PATH' }
]
// Computed properties
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const fullPath = computed(() => {
  if (!editablePath.value || editablePath.value.length === 0) {
    return selectedPath.value || ''
  }
  return `\\${editablePath.value.join('\\')}\\`
})

// Methods
const performSearch = async () => {
  if (!searchQuery.value.trim()) return

  searching.value = true
  searchResults.value = []

  try {
    // Validate search type against allowed columns
    const allowedColumns = {
      'NAME_CHAR': 'NAME_CHAR',
      'CONCEPT_CD': 'CONCEPT_CD',
      'CONCEPT_PATH': 'CONCEPT_PATH'
    }

    const column = allowedColumns[searchType.value]
    if (!column) {
      throw new Error(`Invalid search type: ${searchType.value}`)
    }

    // Use proper SQLite syntax with parameterized query
    const query = `SELECT * FROM CONCEPT_DIMENSION WHERE ${column} LIKE ?`
    const result = await dbStore.executeQuery(query, [`%${searchQuery.value}%`])

    if (result.success && result.data) {
      searchResults.value = result.data.slice(0, 20) // Limit to 20 results
      loggingStore.debug('ConceptPathPickerDialog', 'Search completed', {
        searchType: searchType.value,
        query: searchQuery.value,
        resultsCount: searchResults.value.length
      })
    } else {
      loggingStore.warn('ConceptPathPickerDialog', 'Search failed', {
        searchType: searchType.value,
        query: searchQuery.value,
        error: result.error
      })
    }
  } catch (error) {
    loggingStore.error('ConceptPathPickerDialog', 'Search error', error, {
      searchType: searchType.value,
      query: searchQuery.value
    })
  } finally {
    searching.value = false
  }
}

const selectFromResults = (result) => {
  if (result.CONCEPT_PATH) {
    // Split the search result path
    const searchPathParts = result.CONCEPT_PATH.split('\\').filter(part => part && part !== '')

    if (searchPathParts.length > 0) {
      // Use the search result path but replace the last element with the original concept code
      const newPathParts = [...searchPathParts]

      if (originalConceptCode.value) {
        // Replace the last element with the original concept code
        newPathParts[newPathParts.length - 1] = originalConceptCode.value
      }

      // Update the editable path and selected path
      editablePath.value = newPathParts
      selectedPath.value = `\\${newPathParts.join('\\')}\\`

      loggingStore.debug('ConceptPathPickerDialog', 'Selected from search results', {
        originalConceptCode: originalConceptCode.value,
        searchResultPath: result.CONCEPT_PATH,
        finalPath: selectedPath.value,
        conceptName: result.NAME_CHAR
      })
    }
  }
}

const addPathSegment = () => {
  if (!newSegment.value.trim()) return

  editablePath.value.push(newSegment.value.trim())
  newSegment.value = ''

  loggingStore.debug('ConceptPathPickerDialog', 'Added path segment', {
    segment: newSegment.value,
    currentPath: editablePath.value
  })
}

const removePathSegment = (index) => {
  if (index > 0 && editablePath.value.length > index) {
    const removedSegment = editablePath.value.splice(index, 1)[0]

    loggingStore.debug('ConceptPathPickerDialog', 'Removed path segment', {
      removedSegment,
      index,
      remainingPath: editablePath.value
    })
  }
}

const onSelect = () => {
  const pathToSelect = fullPath.value || selectedPath.value

  if (pathToSelect) {
    emit('select', pathToSelect)

    loggingStore.info('ConceptPathPickerDialog', 'Path selected', {
      selectedPath: pathToSelect,
      editablePath: editablePath.value,
      treeSelection: selectedPath.value
    })

    dialogVisible.value = false
  }
}

const onCancel = () => {
  loggingStore.debug('ConceptPathPickerDialog', 'Dialog cancelled')
  dialogVisible.value = false
}

// Watchers
watch(() => props.currentPath, (newPath) => {
  selectedPath.value = newPath
  if (newPath) {
    // Split the path for editing
    const pathParts = newPath.split('\\').filter(part => part && part !== '')
    editablePath.value = pathParts

    // Store the last element (concept code) from original path
    if (pathParts.length > 0) {
      originalConceptCode.value = pathParts[pathParts.length - 1]
    }
  } else {
    editablePath.value = []
    originalConceptCode.value = ''
  }
}, { immediate: true })

watch(selectedPath, (newSelection) => {
  if (newSelection && !editablePath.value.length) {
    // If tree selection changes and we don't have an editable path, sync it
    const pathParts = newSelection.split('\\').filter(part => part && part !== '')
    editablePath.value = pathParts
  }
})

// Initialize on mount
onMounted(() => {
  loggingStore.debug('ConceptPathPickerDialog', 'Component mounted')
})
</script>

<style scoped>
/* Layout Structure */
.column {
  display: flex;
  flex-direction: column;
}

.full-path-section {
  order: 1;
}

.path-editor-section {
  order: 2;
  flex: 1;
}

.search-section {
  order: 3;
}

/* Full Path Display */
.full-path-display {
  font-family: 'Courier New', monospace;
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  border: 2px solid #e3f2fd;
  color: #1565c0;
  font-size: 1.1rem;
  word-break: break-all;
  min-height: 3rem;
  display: flex;
  align-items: center;
}

/* Path Editor */
.path-editor-section .q-card {
  background-color: #fafafa;
}

.path-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.add-segment-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

/* Search Section */
.search-section .q-card {
  background-color: #f9f9f9;
}

.search-results {
  max-height: 300px;
  overflow-y: auto;
  margin-top: 1rem;
}

.search-result-item {
  transition: all 0.2s ease;
  border-radius: 6px;
  margin-bottom: 0.25rem;

  &:hover {
    background-color: #e3f2fd;
    transform: translateX(2px);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .full-path-display {
    font-size: 1rem;
    padding: 0.75rem;
  }

  .path-chips {
    gap: 0.25rem;
  }

  .search-result-item {
    &:hover {
      transform: none;
    }
  }
}

/* Utility Classes */
.full-width {
  width: 100%;
}

.text-mono {
  font-family: 'Courier New', monospace;
}
</style>
