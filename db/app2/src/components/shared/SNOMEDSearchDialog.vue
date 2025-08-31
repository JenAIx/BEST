<template>
  <q-dialog v-model="dialogVisible" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="search" class="q-mr-sm text-primary" />
          SNOMED CT Search
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-caption text-grey-6 q-mb-md">
          Search the international SNOMED CT terminology for clinical concepts
        </div>
        
        <q-input
          v-model="localSearchQuery"
          outlined
          dense
          label="Search SNOMED CT concepts"
          placeholder="e.g., diabetes, hypertension, myocardial infarction..."
          class="q-mb-md"
          @keyup.enter="search"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-btn
              flat
              dense
              icon="search"
              @click="search"
              :loading="searching"
              color="primary"
            />
          </template>
        </q-input>

        <div v-if="searching" class="text-center q-pa-md">
          <q-spinner color="primary" size="40px" />
          <div class="q-mt-sm">Searching SNOMED CT API...</div>
          <div class="text-caption text-grey-6 q-mt-xs">Searching international clinical terminology</div>
        </div>

        <q-list v-else-if="searchResults.length > 0" bordered separator class="snomed-results">
          <q-item
            v-for="result in searchResults"
            :key="result.code"
            clickable
            @click="selectConcept(result)"
            class="snomed-result-item"
          >
            <q-item-section>
              <!-- Preferred Term (main display) -->
              <q-item-label class="text-weight-medium text-primary">
                {{ result.preferredTerm || result.display }}
                
                <!-- Hover info icon -->
                <q-icon 
                  name="info_outline" 
                  size="16px" 
                  class="q-ml-xs text-grey-5 hover-info-icon"
                >
                  <q-tooltip class="concept-details-tooltip" max-width="450px" anchor="center right" self="center left">
                    <div class="concept-tooltip-content">
                      <div class="tooltip-header">
                        <q-icon name="medical_services" class="text-primary q-mr-sm" />
                        <span class="text-weight-bold">SNOMED CT Concept Details</span>
                      </div>
                      
                      <q-separator class="q-my-sm" />
                      
                      <div class="tooltip-section">
                        <div class="section-label">Preferred Term:</div>
                        <div class="section-value text-weight-medium">{{ result.preferredTerm || result.display }}</div>
                      </div>
                      
                      <div class="tooltip-section">
                        <div class="section-label">SCTID:</div>
                        <div class="section-value">
                          <code class="sctid-code">{{ result.code }}</code>
                        </div>
                      </div>
                      
                      <div v-if="result.fsn && result.fsn !== result.display" class="tooltip-section">
                        <div class="section-label">Fully Specified Name:</div>
                        <div class="section-value text-italic">{{ result.fsn }}</div>
                      </div>
                      
                      <div class="tooltip-section">
                        <div class="section-label">Source System:</div>
                        <div class="section-value">
                          <q-chip size="xs" color="blue" text-color="white" :label="result.sourceSystem" />
                        </div>
                      </div>
                      
                      <div class="tooltip-section">
                        <div class="section-label">Status:</div>
                        <div class="section-value">
                          <q-chip 
                            size="xs" 
                            :color="result.active ? 'positive' : 'negative'"
                            text-color="white"
                            :label="result.active ? 'Active' : 'Inactive'"
                            :icon="result.active ? 'check_circle' : 'cancel'"
                          />
                        </div>
                      </div>
                      
                      <div v-if="result.system" class="tooltip-section">
                        <div class="section-label">FHIR URI:</div>
                        <div class="section-value">
                          <code class="fhir-uri">{{ result.system }}</code>
                        </div>
                      </div>
                      
                      <q-separator class="q-my-sm" />
                      
                      <div class="tooltip-footer">
                        <q-icon name="mouse" size="16px" class="q-mr-sm" />
                        <span class="text-caption">Click to select and auto-fill concept information</span>
                      </div>
                    </div>
                  </q-tooltip>
                </q-icon>
              </q-item-label>
              
              <!-- SCTID and source -->
              <q-item-label caption class="text-blue-grey-7">
                SCTID: {{ result.code }}
                <span class="text-positive"> • {{ result.sourceSystem }}</span>
                <q-chip 
                  v-if="result.active" 
                  size="xs" 
                  color="positive" 
                  text-color="white" 
                  label="Active"
                  class="q-ml-sm"
                />
              </q-item-label>
              
              <!-- Fully Specified Name (if different from preferred term) -->
              <q-item-label 
                v-if="result.fsn && result.fsn !== result.display" 
                caption 
                lines="2" 
                class="text-grey-7 q-mt-xs"
              >
                FSN: {{ result.fsn }}
              </q-item-label>
            </q-item-section>
            
            <q-item-section side class="items-center">
              <q-icon name="arrow_forward" color="primary" />
              <q-tooltip>Click to select this SNOMED CT concept</q-tooltip>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else-if="searched && searchResults.length === 0" class="text-center q-pa-md text-grey-6">
          <q-icon name="search_off" size="48px" class="text-grey-4" />
          <div class="q-mt-sm">No SNOMED CT concepts found</div>
          <div class="text-caption">Try different search terms or check spelling</div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" @click="onCancel" />
        <div class="text-caption text-grey-6 q-mr-md">
          Powered by Snowstorm SNOMED CT API
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="scss" scoped>
.snomed-results {
  max-height: 400px;
  overflow-y: auto;
}

.snomed-result-item {
  &:hover {
    background-color: rgba(25, 118, 210, 0.04);
  }
}

// Better spacing for SNOMED result items
:deep(.q-item__section--side) {
  padding-left: 16px;
}

// Custom scrollbar for results list
.snomed-results::-webkit-scrollbar {
  width: 6px;
}

.snomed-results::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.snomed-results::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.snomed-results::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

// Enhanced tooltip styling
.concept-details-tooltip {
  .concept-tooltip-content {
    padding: 12px;
    max-width: 400px;
    
    .tooltip-header {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      color: #1976d2;
    }
    
    .tooltip-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      gap: 12px;
      
      .section-label {
        flex-shrink: 0;
        min-width: 120px;
        color: #666;
        font-weight: 500;
        font-size: 0.9em;
      }
      
      .section-value {
        flex: 1;
        text-align: right;
        word-break: break-word;
        
        code {
          font-family: 'Courier New', monospace;
          background-color: rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.85em;
        }
      }
    }
    
    .sctid-code {
      background-color: rgba(25, 118, 210, 0.1) !important;
      color: #1976d2 !important;
      font-weight: 600;
    }
    
    .fhir-uri {
      background-color: rgba(76, 175, 80, 0.1) !important;
      color: #388e3c !important;
      font-size: 0.8em;
    }
    
    .tooltip-footer {
      display: flex;
      align-items: center;
      color: #999;
      font-style: italic;
    }
  }
}

// Hover effects for info icon
.hover-info-icon {
  opacity: 0.6;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 1;
    color: #1976d2 !important;
    transform: scale(1.1);
  }
}

// Additional hover effects for better UX
.snomed-result-item {
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(25, 118, 210, 0.04);
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}
</style>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useLoggingStore } from '../../stores/logging-store.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

const $q = useQuasar()
const loggingStore = useLoggingStore()

const localSearchQuery = ref('')
const searching = ref(false)
const searched = ref(false)
const searchResults = ref([])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const search = async () => {
  if (!localSearchQuery.value || localSearchQuery.value.length < 3) {
    $q.notify({
      type: 'warning',
      message: 'Please enter at least 3 characters to search SNOMED CT',
      position: 'top'
    })
    return
  }

  searching.value = true
  searched.value = true

  try {
    // Use SNOMED CT API service for real-time search
    const snomedApiService = (await import('src/core/services/snomed-api-service')).default
    
    const result = await snomedApiService.searchConcepts(localSearchQuery.value, {
      limit: 25,
      activeOnly: true
    })
    
    if (result.success) {
      // Transform results to match expected format
      searchResults.value = result.data.map(concept => ({
        code: concept.code,
        display: concept.display,
        fsn: concept.fsn,
        preferredTerm: concept.preferredTerm,
        sourceSystem: concept.sourceSystem,
        active: concept.active
      }))
      
      if (searchResults.value.length === 0) {
        $q.notify({
          type: 'info',
          message: 'No SNOMED CT concepts found for this search term',
          position: 'top'
        })
      }
    } else {
      throw new Error(result.error || 'SNOMED CT API search failed')
    }
    
  } catch (error) {
    loggingStore.error('SNOMEDSearchDialog', 'SNOMED CT API search failed', error, {
      searchQuery: localSearchQuery.value
    })
    
    // Show user-friendly error message
    let errorMessage = 'Failed to search SNOMED CT'
    if (error.message.includes('Cannot connect')) {
      errorMessage = 'Cannot connect to SNOMED CT API - check internet connection'
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'SNOMED CT API rate limit exceeded - please wait and try again'
    }
    
    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 5000
    })
    
    // Fallback to empty results
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

const selectConcept = (concept) => {
  emit('select', concept)
  dialogVisible.value = false
}

const onCancel = () => {
  dialogVisible.value = false
}

watch(() => props.searchQuery, (newQuery) => {
  localSearchQuery.value = newQuery
  if (newQuery) {
    search()
  }
}, { immediate: true })

watch(() => props.modelValue, (newValue) => {
  if (!newValue) {
    // Reset when dialog closes
    searchResults.value = []
    searched.value = false
  }
})
</script>
