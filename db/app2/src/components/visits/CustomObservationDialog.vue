<template>
  <AppDialog
    v-model="showDialog"
    title="Search and Add Observation"
    :subtitle="`Category: ${fieldSetName}`"
    size="lg"
    persistent
    @close="cancelCustomObservation"
  >
    <template #header>
      <div class="text-h6">
        <q-icon name="search" class="q-mr-sm" color="primary" />
        Search and Add Observation
      </div>
      <div class="text-caption text-grey-6 q-mt-xs">
        Category: <q-chip size="sm" :color="getCategoryColor()" text-color="white">{{ fieldSetName }}</q-chip>
      </div>
    </template>

    <!-- Concept Search Section -->
    <div class="concept-search-section">
      <div class="text-subtitle2 q-mb-sm">
        <q-icon name="search" class="q-mr-xs" />
        Search for existing concepts in the database
      </div>
      
      <div class="search-row">
        <q-input
          v-model="searchTerm"
          placeholder="Search concepts (min. 2 characters)"
          outlined
          dense
          class="search-input"
          @keyup="onSearchInput"
          @focus="showSearchResults = true"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append v-if="searchTerm">
            <q-icon 
              name="close" 
              class="cursor-pointer" 
              @click="clearSearch"
            />
          </template>
        </q-input>
        
        <q-btn
          color="primary"
          icon="search"
          label="Search"
          @click="searchConcepts"
          :loading="searching"
          :disable="!searchTerm || searchTerm.length < 2"
          class="search-btn"
        />
      </div>

      <!-- Search Results -->
      <div v-if="showSearchResults && searchResults.length > 0" class="search-results">
        <div class="text-caption text-grey-6 q-mb-xs">
          Found {{ searchResults.length }} concept{{ searchResults.length > 1 ? 's' : '' }}
        </div>
        <div class="concept-list">
          <q-card
            v-for="concept in searchResults"
            :key="concept.CONCEPT_CD"
            flat
            bordered
            class="concept-item cursor-pointer"
            @click="selectConcept(concept)"
          >
            <q-card-section class="q-pa-sm">
              <div class="concept-header">
                <div class="concept-name">{{ concept.NAME_CHAR }}</div>
                <q-chip 
                  size="xs" 
                  :color="getValueTypeColor(concept.VALTYPE_CD)" 
                  text-color="white"
                  class="value-type-chip"
                >
                  {{ concept.VALTYPE_CD }}
                </q-chip>
              </div>
              <div class="concept-code text-caption text-grey-6">
                {{ concept.CONCEPT_CD }}
              </div>
              <div v-if="concept.UNIT_CD" class="concept-unit text-caption text-grey-5">
                Unit: {{ concept.UNIT_CD }}
              </div>
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
           <q-chip 
             size="xs" 
             :color="getValueTypeColor(selectedConcept.VALTYPE_CD)" 
             text-color="white"
             class="q-ml-sm"
           >
             {{ selectedConcept.VALTYPE_CD }}
           </q-chip>
         </div>
         <div class="selected-concept-details">
           <span class="text-caption text-grey-6">{{ selectedConcept.CONCEPT_CD }}</span>
           <span v-if="selectedConcept.UNIT_CD" class="text-caption text-grey-5 q-ml-md">
             Unit: {{ selectedConcept.UNIT_CD }}
           </span>
         </div>
         <q-btn 
           flat 
           size="sm" 
           color="negative" 
           icon="close" 
           @click="clearSelectedConcept"
           class="remove-btn"
         />
       </div>
     </div>

    <!-- Value Input Section -->
    <div v-if="selectedConcept" class="value-input-section">
      <q-separator class="q-my-md" />
      
      <div class="text-subtitle2 q-mb-sm">
        <q-icon name="edit" class="q-mr-xs" />
        Enter Value
      </div>
      
      <q-input
        v-model="customObservation.value"
        :label="`Value for ${selectedConcept.NAME_CHAR}`"
        :type="getValueInputType()"
        outlined
        dense
        :rules="[(val) => !!val || 'Value is required']"
        class="q-mb-md"
      />
      
      <q-input 
        v-model="customObservation.unit" 
        label="Unit (optional)" 
        outlined 
        dense
        :placeholder="selectedConcept.UNIT_CD || 'Enter unit if different from concept default'"
      />
    </div>

    <template #actions>
      <q-btn 
        color="primary" 
        label="Add Observation"
        @click="saveCustomObservation" 
        :disable="!canSave()"
        :loading="saving"
      />
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from 'src/components/shared/AppDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
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
  fieldSetName: {
    type: String,
    required: true,
  },
  fieldSetId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'observation-added'])

const $q = useQuasar()
const visitStore = useVisitObservationStore()
const globalSettingsStore = useGlobalSettingsStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('CustomObservationDialog')

// State
const customObservation = ref({
  value: '',
  unit: '',
})

const searchTerm = ref('')
const searchResults = ref([])
const searching = ref(false)
const searchAttempted = ref(false)
const showSearchResults = ref(false)
const selectedConcept = ref(null)
const saving = ref(false)

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Watch for dialog close to reset state
watch(showDialog, (newValue) => {
  if (!newValue) {
    resetState()
  }
})

// Methods
const searchConcepts = async () => {
  if (!searchTerm.value || searchTerm.value.length < 2) return

  try {
    searching.value = true
    searchAttempted.value = true

    // Build search options based on field set
    const searchOptions = {
      limit: 20,
      context: 'observation',
    }

    // Add category-specific filters if not uncategorized
    if (props.fieldSetId !== 'uncategorized') {
      // You can add specific filters here based on field set
      // For example, filter by value types commonly used in this category
    }

    logger.debug('Searching concepts', {
      searchTerm: searchTerm.value,
      fieldSetId: props.fieldSetId,
      searchOptions,
    })

    const results = await conceptStore.searchConcepts(searchTerm.value, searchOptions)
    searchResults.value = results
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

const onSearchInput = () => {
  if (searchTerm.value.length >= 2) {
    // Debounce search
    clearTimeout(searchTimeout.value)
    searchTimeout.value = setTimeout(() => {
      searchConcepts()
    }, 300)
  } else {
    searchResults.value = []
    showSearchResults.value = false
  }
}

const searchTimeout = ref(null)

const clearSearch = () => {
  searchTerm.value = ''
  searchResults.value = []
  showSearchResults.value = false
  searchAttempted.value = false
}

const selectConcept = (concept) => {
  selectedConcept.value = concept
  customObservation.value.unit = concept.UNIT_CD || ''
  
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
  customObservation.value.unit = ''
}

const getValueInputType = () => {
  const valueType = selectedConcept.value?.VALTYPE_CD || 'T'
  return valueType === 'N' ? 'number' : 'text'
}

const getCategoryColor = () => {
  const colorMap = {
    vitals: 'blue',
    symptoms: 'orange',
    physical: 'green',
    medications: 'purple',
    uncategorized: 'grey',
  }
  return colorMap[props.fieldSetId] || 'primary'
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

const canSave = () => {
  return !!selectedConcept.value && !!customObservation.value.value
}

const saveCustomObservation = async () => {
  try {
    saving.value = true

    const conceptCode = selectedConcept.value.CONCEPT_CD
    const valueType = selectedConcept.value.VALTYPE_CD || 'T'
    const category = props.fieldSetName.toUpperCase()

    // Get default values from global settings
    const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('VISITS_PAGE')

    const observationData = {
      ENCOUNTER_NUM: props.visit.id,
      CONCEPT_CD: conceptCode,
      VALTYPE_CD: valueType,
      START_DATE: new Date().toISOString().split('T')[0],
      CATEGORY_CHAR: category,
      PROVIDER_ID: 'SYSTEM',
      LOCATION_CD: 'EXISTING',
      SOURCESYSTEM_CD: defaultSourceSystem,
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }

    if (valueType === 'N') {
      observationData.NVAL_NUM = parseFloat(customObservation.value.value)
    } else {
      observationData.TVAL_CHAR = customObservation.value.value
    }

    if (customObservation.value.unit) {
      observationData.UNIT_CD = customObservation.value.unit
    }

    // Use visit store to create observation
    await visitStore.createObservation(observationData)

    emit('observation-added', {
      conceptCode,
      value: customObservation.value.value,
      unit: customObservation.value.unit,
      conceptName: selectedConcept.value.NAME_CHAR,
      valueType,
    })

    resetState()
    showDialog.value = false

    $q.notify({
      type: 'positive',
      message: 'Observation added successfully',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to save observation', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save observation',
      position: 'top',
    })
  } finally {
    saving.value = false
  }
}

const cancelCustomObservation = () => {
  resetState()
  showDialog.value = false
}

const resetState = () => {
  customObservation.value = {
    value: '',
    unit: '',
  }
  searchTerm.value = ''
  searchResults.value = []
  searching.value = false
  searchAttempted.value = false
  showSearchResults.value = false
  selectedConcept.value = null
  saving.value = false
}
</script>

<style lang="scss" scoped>
.concept-search-section {
  margin-bottom: 1.5rem;
  
  .search-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    
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
          
          .concept-name {
            font-weight: 500;
            color: $grey-8;
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

.value-input-section {
  .q-input {
    margin-bottom: 0.5rem;
  }
}
</style>
