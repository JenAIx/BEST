<template>
  <AppDialog v-model="showDialog" title="Add Observation Column" subtitle="Search and add a new observation column to the data grid" size="lg" persistent @close="cancelAddObservation">
    <template #header>
      <div class="text-h6">
        <q-icon name="add" class="q-mr-sm" color="primary" />
        Add Observation Column
      </div>
      <div class="text-caption text-grey-6 q-mt-xs">Choose an existing concept from the database to add as a column</div>
    </template>

    <!-- Concept Search Section -->
    <div class="concept-search-section">
      <div class="text-subtitle2 q-mb-sm">
        <q-icon name="search" class="q-mr-xs" />
        Search for existing concepts in the database
      </div>

      <div class="search-row">
        <q-input v-model="searchTerm" placeholder="Search concepts (min. 2 characters)" outlined dense class="search-input" @keyup="onSearchInput" @focus="showSearchResults = true">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append v-if="searchTerm">
            <q-icon name="close" class="cursor-pointer" @click="clearSearch" />
          </template>
        </q-input>

        <q-btn color="primary" icon="search" label="Search" @click="searchConcepts" :loading="searching" :disable="!searchTerm || searchTerm.length < 2" class="search-btn" />
      </div>

      <!-- Recent Concepts -->
      <div v-if="recentConcepts.length > 0 && !searchTerm" class="recent-concepts-section q-mb-md">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          <q-icon name="history" class="q-mr-xs" />
          Recently Used Concepts
        </div>
        <div class="recent-concepts-grid">
          <q-chip v-for="concept in recentConcepts" :key="concept.CONCEPT_CD" clickable @click="selectConcept(concept)" color="blue-1" text-color="primary" size="md" class="recent-concept-chip">
            <q-icon name="history" size="14px" class="q-mr-xs" />
            {{ concept.NAME_CHAR }}
            <q-tooltip>{{ concept.CONCEPT_CD }}</q-tooltip>
          </q-chip>
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="showSearchResults && searchResults.length > 0" class="search-results">
        <div class="text-caption text-grey-6 q-mb-xs">Found {{ searchResults.length }} concept{{ searchResults.length > 1 ? 's' : '' }}</div>
        <div class="concept-list">
          <q-card v-for="concept in searchResults" :key="concept.CONCEPT_CD" flat bordered class="concept-item cursor-pointer" @click="selectConcept(concept)">
            <q-card-section class="q-pa-sm">
              <div class="concept-header">
                <div class="concept-name-container">
                  <div class="concept-name">{{ concept.NAME_CHAR }}</div>
                  <q-icon v-if="isConceptAlreadyInGrid(concept.CONCEPT_CD)" name="warning" color="amber-7" size="18px" class="existing-column-icon">
                    <q-tooltip class="bg-amber-7 text-black">This concept is already in the grid</q-tooltip>
                  </q-icon>
                </div>
                <q-chip size="xs" :color="getValueTypeColor(concept.VALTYPE_CD)" text-color="white" class="value-type-chip">
                  {{ concept.VALTYPE_CD }}
                </q-chip>
              </div>
              <div class="concept-code text-caption text-grey-6">
                {{ concept.CONCEPT_CD }}
              </div>
              <div v-if="concept.UNIT_CD" class="concept-unit text-caption text-grey-5">Unit: {{ concept.UNIT_CD }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- No Results Message -->
      <div v-else-if="showSearchResults && searchTerm.length >= 2 && !searching && searchAttempted" class="no-results">
        <q-icon name="search_off" color="grey-5" size="24px" />
        <div class="text-caption text-grey-6">No concepts found matching your search.</div>
      </div>
    </div>

    <!-- Selected Concept Display -->
    <div v-if="selectedConcept" class="selected-concept-section">
      <q-separator class="q-my-sm" />

      <div class="selected-concept-inline">
        <div class="selected-concept-info">
          <q-icon name="check_circle" size="16px" color="positive" class="q-mr-sm" />
          <span class="text-weight-medium">{{ selectedConcept.NAME_CHAR }}</span>
          <q-chip size="xs" :color="getValueTypeColor(selectedConcept.VALTYPE_CD)" text-color="white" class="q-ml-sm">
            {{ selectedConcept.VALTYPE_CD }}
          </q-chip>
        </div>
        <div class="selected-concept-details">
          <span class="text-caption text-grey-6">{{ selectedConcept.CONCEPT_CD }}</span>
          <span v-if="selectedConcept.UNIT_CD" class="text-caption text-grey-5 q-ml-md"> Unit: {{ selectedConcept.UNIT_CD }} </span>
        </div>
        <q-btn flat size="sm" color="negative" icon="close" @click="clearSelectedConcept" class="remove-btn" />
      </div>
    </div>

    <template #actions>
      <q-btn color="primary" label="Add Column" @click="addConceptToGrid" :disable="!selectedConcept || isConceptAlreadyInGrid(selectedConcept.CONCEPT_CD)" :loading="adding">
        <q-tooltip v-if="!selectedConcept">Please select a concept first</q-tooltip>
        <q-tooltip v-else-if="isConceptAlreadyInGrid(selectedConcept.CONCEPT_CD)"> This concept is already in the grid </q-tooltip>
        <q-tooltip v-else>Add this concept as a column</q-tooltip>
      </q-btn>
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useDataGridStore } from 'src/stores/data-grid-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from 'src/components/shared/AppDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  existingConcepts: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue', 'concept-added'])

const $q = useQuasar()
const conceptStore = useConceptResolutionStore()
const dataGridStore = useDataGridStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('AddObservationDialog')

// State
const searchTerm = ref('')
const searchResults = ref([])
const searching = ref(false)
const searchAttempted = ref(false)
const showSearchResults = ref(false)
const recentConcepts = ref([])
const selectedConcept = ref(null)
const adding = ref(false)

// Search timeout ref
const searchTimeout = ref(null)

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Helper to check if concept is already in the grid
const isConceptAlreadyInGrid = (conceptCode) => {
  if (!props.existingConcepts) return false

  return props.existingConcepts.some((concept) => {
    // Exact match
    if (concept.code === conceptCode) return true

    // Extract numeric code from both sides and compare
    const conceptMatch = conceptCode.match(/[:\s]([0-9-]+)$/)
    const gridMatch = concept.code.match(/[:\s]([0-9-]+)$/)
    if (conceptMatch && gridMatch && conceptMatch[1] === gridMatch[1]) {
      return true
    }

    return false
  })
}

// Watch for dialog close to reset state
watch(showDialog, (newValue) => {
  if (newValue) {
    logger.info('Dialog opened, initializing')
    // Load recent concepts when dialog opens
    loadRecentConcepts()
  } else {
    logger.debug('Dialog closed, cleaning up')
    // Clean up search timeout when dialog closes
    if (searchTimeout.value) {
      clearTimeout(searchTimeout.value)
      searchTimeout.value = null
    }
    resetState()
  }
})

// Methods
const searchConcepts = async () => {
  if (!searchTerm.value || searchTerm.value.length < 2) return

  try {
    searching.value = true
    searchAttempted.value = true

    const searchOptions = {
      limit: 20,
      context: 'observation',
    }

    logger.debug('Searching concepts', {
      searchTerm: searchTerm.value,
      searchOptions,
    })

    const results = await conceptStore.searchConcepts(searchTerm.value, searchOptions)
    // Filter out concepts with VALTYPE_CD = 'A' (not suitable for grid columns)
    searchResults.value = results.filter((concept) => concept.VALTYPE_CD !== 'A')
    showSearchResults.value = true

    logger.info('Concept search completed', {
      searchTerm: searchTerm.value,
      resultsCount: results.length,
    })
  } catch (error) {
    logger.error('Concept search failed', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to search concepts',
      position: 'top',
    })
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

let lastSearchQuery = ''

const onSearchInput = () => {
  const query = searchTerm.value
  logger.info('Search input event triggered', { query, length: query?.length || 0, lastSearchQuery })

  // Clear previous timeout
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
    searchTimeout.value = null
  }

  // If query is too short, clear results immediately
  if (!query || query.length < 2) {
    searchResults.value = []
    showSearchResults.value = false
    lastSearchQuery = ''
    logger.debug('Query too short, clearing results', { query })
    return
  }

  // Skip if same query as last search
  if (query === lastSearchQuery) {
    logger.warn('Same query as last search, skipping', { query, lastSearchQuery })
    return
  }

  logger.info('Setting search timeout', { query, delay: 300, lastSearchQuery })
  // Debounce search to avoid too many requests
  searchTimeout.value = setTimeout(() => {
    logger.info('Search timeout triggered, executing search', { query })
    lastSearchQuery = query
    searchConcepts()
  }, 300) // 300ms delay
}

const clearSearch = () => {
  searchTerm.value = ''
  searchResults.value = []
  showSearchResults.value = false
  searchAttempted.value = false
}

const loadRecentConcepts = () => {
  try {
    const stored = localStorage.getItem('recentGridObservationConcepts')
    if (stored) {
      recentConcepts.value = JSON.parse(stored).slice(0, 7) // Limit to 7 recent concepts
    }
  } catch (error) {
    logger.warn('Failed to load recent concepts', error)
    recentConcepts.value = []
  }
}

const saveRecentConcept = (concept) => {
  try {
    let recent = [...recentConcepts.value]

    // Remove if already exists
    recent = recent.filter((c) => c.CONCEPT_CD !== concept.CONCEPT_CD)

    // Add to beginning
    recent.unshift(concept)

    // Limit to 7
    recent = recent.slice(0, 7)

    recentConcepts.value = recent
    localStorage.setItem('recentGridObservationConcepts', JSON.stringify(recent))

    logger.debug('Saved recent concept', {
      conceptCode: concept.CONCEPT_CD,
      conceptName: concept.NAME_CHAR,
      totalRecent: recent.length,
    })
  } catch (error) {
    logger.warn('Failed to save recent concept', error)
  }
}

const selectConcept = (concept) => {
  selectedConcept.value = concept
  saveRecentConcept(concept)

  // Hide search results
  showSearchResults.value = false

  logger.info('Concept selected', {
    conceptCode: concept.CONCEPT_CD,
    conceptName: concept.NAME_CHAR,
    valueType: concept.VALTYPE_CD,
  })
}

const clearSelectedConcept = () => {
  selectedConcept.value = null
}

const getValueTypeColor = (valueType) => {
  const colorMap = {
    N: 'blue',
    T: 'green',
    D: 'orange',
    S: 'purple',
    F: 'teal',
    A: 'indigo',
    M: 'deep-purple',
  }
  return colorMap[valueType] || 'grey'
}

const addConceptToGrid = async () => {
  if (!selectedConcept.value) return

  try {
    adding.value = true

    logger.info('Adding concept to grid', {
      conceptCode: selectedConcept.value.CONCEPT_CD,
      conceptName: selectedConcept.value.NAME_CHAR,
    })

    // Use the data grid store to add the concept
    const result = dataGridStore.addConceptToGrid(selectedConcept.value)

    if (!result.success) {
      throw new Error('Failed to add concept to grid')
    }

    if (result.alreadyExists) {
      $q.notify({
        type: 'warning',
        message: 'This concept is already in the grid',
        position: 'top',
      })
      return
    }

    // Emit the added concept
    const addedConcept = {
      code: selectedConcept.value.CONCEPT_CD,
      name: selectedConcept.value.NAME_CHAR,
      valueType: selectedConcept.value.VALTYPE_CD || 'T',
    }

    emit('concept-added', addedConcept)

    // Reset and close dialog
    resetState()
    showDialog.value = false

    logger.success('Concept added to grid successfully', {
      conceptCode: selectedConcept.value.CONCEPT_CD,
      conceptName: selectedConcept.value.NAME_CHAR,
    })
  } catch (error) {
    logger.error('Failed to add concept to grid', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to add concept to grid',
      position: 'top',
    })
  } finally {
    adding.value = false
  }
}

const cancelAddObservation = () => {
  resetState()
  showDialog.value = false
}

const resetState = () => {
  searchTerm.value = ''
  searchResults.value = []
  searching.value = false
  searchAttempted.value = false
  showSearchResults.value = false
  selectedConcept.value = null
  adding.value = false
}

// Initialize concept store on mount
onMounted(async () => {
  try {
    await conceptStore.initialize()
    logger.debug('Concept store initialized on mount')
  } catch (error) {
    logger.error('Failed to initialize concept store on mount', error)
  }
})
</script>

<style lang="scss" scoped>
.concept-search-section {
  margin-bottom: 1.5rem;

  .search-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    margin-bottom: 1rem;

    .search-input {
      flex: 1;
    }

    .search-btn {
      min-width: 80px;
    }
  }

  .search-results {
    margin-top: 1rem;

    .concept-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid $grey-3;
      border-radius: 6px;

      .concept-item {
        border-radius: 0;
        border-bottom: 1px solid $grey-2;
        transition: all 0.2s ease;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background: rgba($primary, 0.05);
          border-left: 3px solid $primary;
        }

        .concept-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;

          .concept-name-container {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;

            .concept-name {
              font-weight: 500;
              color: $grey-8;
            }

            .existing-column-icon {
              animation: pulse 2s infinite;
            }
          }

          .value-type-chip {
            font-size: 0.7rem;
          }
        }

        .concept-code {
          font-family: monospace;
          margin-bottom: 0.25rem;
        }

        .concept-unit {
          font-style: italic;
        }
      }
    }
  }

  .no-results {
    text-align: center;
    padding: 2rem 1rem;
    color: $grey-6;

    .q-icon {
      margin-bottom: 0.5rem;
    }
  }

  .recent-concepts-section {
    .recent-concepts-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;

      .recent-concept-chip {
        transition: all 0.2s ease;
        cursor: pointer;

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      }
    }
  }
}

.selected-concept-section {
  .selected-concept-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: rgba($positive, 0.03);
    border: 1px solid rgba($positive, 0.2);
    border-radius: 8px;
    margin: 0.5rem 0;

    .selected-concept-info {
      display: flex;
      align-items: center;
      flex: 1;

      .text-weight-medium {
        color: $grey-8;
        margin-right: 0.5rem;
      }
    }

    .selected-concept-details {
      display: flex;
      align-items: center;
      margin: 0 1rem;
      color: $grey-6;

      .text-caption {
        font-size: 0.75rem;
      }
    }

    .remove-btn {
      opacity: 0.7;
      transition: opacity 0.2s ease;

      &:hover {
        opacity: 1;
      }
    }
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}
</style>
