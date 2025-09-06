<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-primary">
          <q-icon name="science" class="q-mr-sm" />
          Create New Observation
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-grey-6 q-mb-md">Add observation to visit {{ visit?.encounterNum }} for {{ patient?.PATIENT_CD || 'this patient' }}</div>

        <!-- Step 1: Concept Search (shown when no concept selected) -->
        <div v-if="!selectedConcept" class="concept-search-section">
          <div class="text-h6 text-grey-8 q-mb-md">
            <q-icon name="search" class="q-mr-sm" />
            Select Concept
          </div>

          <!-- Search Input -->
          <q-input v-model="conceptSearchQuery" outlined dense placeholder="Search for medical concepts..." clearable class="q-mb-md" :loading="searchLoading">
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>

          <!-- Recent Concepts -->
          <div v-if="recentConcepts.length > 0" class="q-mb-md">
            <div class="text-subtitle2 text-grey-7 q-mb-sm">Recent Concepts:</div>
            <div class="recent-concepts">
              <q-chip v-for="concept in recentConcepts" :key="concept.CONCEPT_CD" clickable @click="selectConcept(concept)" color="blue-1" text-color="primary" size="md" class="q-ma-xs">
                {{ concept.NAME_CHAR }}
              </q-chip>
            </div>
          </div>

          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="search-results">
            <div class="text-subtitle2 text-grey-7 q-mb-sm">
              Search Results: {{ displayedResults.length }}
              <span v-if="totalResultsCount > displayedResults.length"> of {{ totalResultsCount }} (showing top {{ displayedResults.length }}) </span>
              <span v-else-if="totalResultsCount > 0"> of {{ totalResultsCount }} </span>
            </div>
            <q-list bordered class="rounded-borders" style="max-height: 300px; overflow-y: auto">
              <q-item v-for="concept in displayedResults" :key="concept.CONCEPT_CD" clickable @click="selectConcept(concept)" class="concept-item">
                <q-item-section>
                  <q-item-label>{{ concept.NAME_CHAR }}</q-item-label>
                  <q-item-label caption>{{ concept.CONCEPT_CD }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="arrow_forward" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- No Results -->
          <div v-if="conceptSearchQuery && !searchLoading && searchResults.length === 0" class="text-center text-grey-6 q-py-md">
            <q-icon name="search_off" size="48px" />
            <div class="q-mt-sm">No concepts found</div>
          </div>
        </div>

        <!-- Step 2: Observation Form (shown when concept selected) -->
        <div v-else class="observation-form-section">
          <!-- Selected Concept Display -->
          <div class="selected-concept-display q-mb-md">
            <q-card flat bordered class="bg-blue-1">
              <q-card-section class="q-pa-sm">
                <div class="row items-center">
                  <div class="col">
                    <div class="text-weight-medium text-primary">{{ selectedConcept.NAME_CHAR }}</div>
                    <div class="text-caption text-grey-6">{{ selectedConcept.CONCEPT_CD }}</div>
                  </div>
                  <div class="col-auto">
                    <q-btn flat dense icon="close" size="sm" @click="clearSelectedConcept">
                      <q-tooltip>Change concept</q-tooltip>
                    </q-btn>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <q-form @submit="handleSubmit" class="q-gutter-md">
            <!-- Basic Fields -->
            <div class="row q-gutter-md">
              <div class="col">
                <q-input v-model="formData.START_DATE" type="date" label="Observation Date *" outlined dense :rules="[(val) => !!val || 'Date is required']">
                  <template v-slot:prepend>
                    <q-icon name="event" />
                  </template>
                </q-input>
              </div>
              <div class="col">
                <q-input v-model="formData.END_DATE" type="date" label="End Date" outlined dense>
                  <template v-slot:prepend>
                    <q-icon name="event_available" />
                  </template>
                </q-input>
              </div>
            </div>

            <!-- Dynamic Value Input based on concept type (MOVED UP) -->
            <div class="value-input-section">
              <div class="text-subtitle2 text-grey-7 q-mb-sm">
                Value: <span class="text-negative">*</span>
                <span class="text-caption text-grey-6">(Required)</span>
              </div>

              <!-- Numeric Value -->
              <div v-if="valueInputType === 'numeric'" class="row q-gutter-md">
                <div class="col">
                  <q-input v-model.number="formData.NVAL_NUM" type="number" label="Numeric Value" outlined dense step="any">
                    <template v-slot:prepend>
                      <q-icon name="numbers" />
                    </template>
                  </q-input>
                </div>
                <div class="col-auto" style="min-width: 120px">
                  <q-input v-model="formData.UNIT_CD" label="Unit" outlined dense>
                    <template v-slot:prepend>
                      <q-icon name="straighten" />
                    </template>
                  </q-input>
                </div>
              </div>

              <!-- Text Value -->
              <div v-else-if="valueInputType === 'text'">
                <q-input v-model="formData.TVAL_CHAR" label="Text Value" outlined dense>
                  <template v-slot:prepend>
                    <q-icon name="text_fields" />
                  </template>
                </q-input>
              </div>

              <!-- Date Value -->
              <div v-else-if="valueInputType === 'date'">
                <q-input v-model="formData.TVAL_CHAR" type="date" label="Date Value" outlined dense>
                  <template v-slot:prepend>
                    <q-icon name="event" />
                  </template>
                </q-input>
              </div>

              <!-- Selection Value -->
              <div v-else-if="valueInputType === 'selection'">
                <q-select v-model="formData.TVAL_CHAR" :options="getSelectionOptions()" label="Select Value" outlined dense emit-value map-options :loading="loadingSelectionOptions">
                  <template v-slot:prepend>
                    <q-icon name="list" />
                  </template>
                  <template v-slot:hint v-if="selectionOptions.length > 0"> {{ selectionOptions.length }} option(s) available from concept hierarchy </template>
                </q-select>
              </div>

              <!-- File Upload Value (for R type) -->
              <div v-else-if="valueInputType === 'file'">
                <FileUploadInput v-model="fileData" :max-size-m-b="10" accepted-types=".txt,.png,.gif,.jpg,.jpeg,.pdf" @file-selected="handleFileSelected" @file-cleared="handleFileCleared" />
              </div>

              <!-- Default Text Input -->
              <div v-else>
                <q-input v-model="formData.TVAL_CHAR" label="Value" outlined dense>
                  <template v-slot:prepend>
                    <q-icon name="edit" />
                  </template>
                </q-input>
              </div>
            </div>

            <!-- Category (read-only, populated from concept) -->
            <q-input v-model="formData.CATEGORY_CHAR" label="Category" outlined dense readonly>
              <template v-slot:prepend>
                <q-icon name="category" />
              </template>
              <template v-slot:hint> Automatically set from selected concept </template>
            </q-input>

            <!-- Provider and Location -->
            <div class="row q-gutter-md">
              <div class="col">
                <q-input v-model="formData.PROVIDER_ID" label="Provider ID" outlined dense>
                  <template v-slot:prepend>
                    <q-icon name="person" />
                  </template>
                </q-input>
              </div>
              <div class="col">
                <q-input v-model="formData.LOCATION_CD" label="Location" outlined dense>
                  <template v-slot:prepend>
                    <q-icon name="place" />
                  </template>
                </q-input>
              </div>
            </div>

            <!-- Additional Fields in one row (col-4, col-4, col-3) - Hidden for R type -->
            <div v-if="valueInputType !== 'file'" class="row q-gutter-md">
              <div class="col-4">
                <q-input v-model="formData.QUANTITY_NUM" type="number" label="Quantity" outlined dense step="any">
                  <template v-slot:prepend>
                    <q-icon name="format_list_numbered" />
                  </template>
                </q-input>
              </div>
              <div class="col-4">
                <q-input v-model.number="formData.CONFIDENCE_NUM" type="number" label="Confidence %" outlined dense min="0" max="100">
                  <template v-slot:prepend>
                    <q-icon name="verified" />
                  </template>
                </q-input>
              </div>
              <div class="col-3">
                <q-select v-model="formData.VALUEFLAG_CD" :options="valueFlagOptions" label="Value Flag" outlined dense emit-value map-options clearable>
                  <template v-slot:prepend>
                    <q-icon name="flag" />
                  </template>
                </q-select>
              </div>
            </div>

            <!-- Notes -->
            <q-input v-model="formData.OBSERVATION_BLOB" type="textarea" label="Notes" outlined dense rows="3">
              <template v-slot:prepend>
                <q-icon name="notes" />
              </template>
            </q-input>

            <!-- Form Actions -->
            <div class="row q-gutter-md q-mt-md">
              <q-space />
              <q-btn flat label="Cancel" v-close-popup />
              <q-btn type="submit" label="Create Observation" color="primary" :loading="loading" :disable="!isFormValid" />
            </div>
          </q-form>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import FileUploadInput from 'components/shared/FileUploadInput.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  patient: {
    type: Object,
    required: true,
  },
  visit: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'observationCreated'])

const $q = useQuasar()
const databaseStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const globalSettingsStore = useGlobalSettingsStore()
const logger = useLoggingStore().createLogger('CreateObservationDialog')

// Reactive state
const loading = ref(false)
const searchLoading = ref(false)
const loadingOptions = ref(false)
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Search state
const conceptSearchQuery = ref('')
const searchResults = ref([])
const totalResultsCount = ref(0)
const recentConcepts = ref([])
const selectedConcept = ref(null)

// Selection options state
const selectionOptions = ref([])
const loadingSelectionOptions = ref(false)

// File upload state for 'R' type observations
const fileData = ref(null)

// Form data with defaults
const formData = ref({
  START_DATE: new Date().toISOString().split('T')[0], // Today's date
  END_DATE: null,
  CATEGORY_CHAR: '',
  PROVIDER_ID: '',
  LOCATION_CD: '',
  TVAL_CHAR: '',
  NVAL_NUM: null,
  UNIT_CD: '',
  QUANTITY_NUM: null,
  CONFIDENCE_NUM: null,
  VALUEFLAG_CD: null,
  OBSERVATION_BLOB: '',
})

// Dynamic value flag options from global settings
const valueFlagOptions = ref([])

// Computed properties
const displayedResults = computed(() => {
  return searchResults.value.slice(0, 10) // Limit to top 10 results
})

const valueInputType = computed(() => {
  if (!selectedConcept.value) return 'text'

  const valtype = selectedConcept.value.VALTYPE_CD
  switch (valtype) {
    case 'N':
      return 'numeric'
    case 'D':
      return 'date'
    case 'S':
    case 'F':
      return 'selection' // Finding type should use selection
    case 'R':
      return 'file' // Raw data type should use file upload
    case 'T':
    case 'A':
    default:
      return 'text'
  }
})

const isFormValid = computed(() => {
  // Must have selected a concept
  if (!selectedConcept.value) return false

  // Must have a start date
  if (!formData.value.START_DATE) return false

  // For file type (R), must have file data
  if (selectedConcept.value.VALTYPE_CD === 'R') {
    return fileData.value !== null
  }

  // For other types, must have at least one value entered
  const hasNumericValue = formData.value.NVAL_NUM !== null && formData.value.NVAL_NUM !== undefined && formData.value.NVAL_NUM !== ''
  const hasTextValue = formData.value.TVAL_CHAR && formData.value.TVAL_CHAR.trim() !== ''

  return hasNumericValue || hasTextValue
})

// Methods
const loadOptions = async () => {
  try {
    loadingOptions.value = true

    // Load value flag options from global settings
    try {
      const valueFlagData = await globalSettingsStore.loadLookupValues('VALUEFLAG_CD')
      if (valueFlagData && valueFlagData.length > 0) {
        valueFlagOptions.value = valueFlagData.map((flag) => ({
          label: flag.NAME_CHAR || flag.CODE_CD,
          value: flag.CODE_CD,
        }))
      } else {
        // Fallback to hardcoded options
        valueFlagOptions.value = [
          { label: 'Normal', value: 'N' },
          { label: 'High', value: 'H' },
          { label: 'Low', value: 'L' },
          { label: 'Abnormal', value: 'A' },
          { label: 'Critical', value: 'C' },
          { label: 'Very High', value: 'HH' },
          { label: 'Very Low', value: 'LL' },
        ]
      }
    } catch {
      // Use fallback options
      valueFlagOptions.value = [
        { label: 'Normal', value: 'N' },
        { label: 'High', value: 'H' },
        { label: 'Low', value: 'L' },
        { label: 'Abnormal', value: 'A' },
        { label: 'Critical', value: 'C' },
        { label: 'Very High', value: 'HH' },
        { label: 'Very Low', value: 'LL' },
      ]
    }
  } catch (error) {
    logger.error('Failed to load options from global settings', error)
    $q.notify({
      type: 'warning',
      message: 'Using default options. Some settings may not be available.',
      position: 'top',
    })
  } finally {
    loadingOptions.value = false
  }
}

const resetForm = () => {
  formData.value = {
    START_DATE: new Date().toISOString().split('T')[0],
    END_DATE: null,
    CATEGORY_CHAR: '',
    PROVIDER_ID: '',
    LOCATION_CD: '',
    TVAL_CHAR: '',
    NVAL_NUM: null,
    UNIT_CD: '',
    QUANTITY_NUM: null,
    CONFIDENCE_NUM: null,
    VALUEFLAG_CD: null,
    OBSERVATION_BLOB: '',
  }
  selectedConcept.value = null
  conceptSearchQuery.value = ''
  searchResults.value = []
  totalResultsCount.value = 0
  fileData.value = null
}

const loadRecentConcepts = () => {
  try {
    const stored = localStorage.getItem('recentObservationConcepts')
    if (stored) {
      recentConcepts.value = JSON.parse(stored).slice(0, 10) // Limit to 10 recent concepts
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

    // Limit to 10
    recent = recent.slice(0, 10)

    recentConcepts.value = recent
    localStorage.setItem('recentObservationConcepts', JSON.stringify(recent))
  } catch (error) {
    logger.warn('Failed to save recent concept', error)
  }
}

// Debounce timer for search
let searchTimeout = null
let lastSearchQuery = ''

const handleSearchInput = () => {
  const query = conceptSearchQuery.value
  logger.info('Search input event triggered', { query, length: query?.length || 0, lastSearchQuery })

  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
    searchTimeout = null
  }

  // If query is too short, clear results immediately
  if (!query || query.length < 2) {
    searchResults.value = []
    totalResultsCount.value = 0
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
  searchTimeout = setTimeout(() => {
    logger.info('Search timeout triggered, executing search', { query })
    lastSearchQuery = query
    searchConcepts()
  }, 300) // 300ms delay
}

const searchConcepts = async () => {
  const query = conceptSearchQuery.value
  logger.info('Starting concept search', { query })

  if (!query || query.length < 2) {
    logger.debug('Query invalid, clearing results', { query })
    searchResults.value = []
    return
  }

  searchLoading.value = true
  const timer = logger.startTimer('concept_search')

  try {
    logger.debug('Calling concept store search method', { query, limit: 50 })

    // Use concept store's search method
    const concepts = await conceptStore.searchConcepts(query, {
      limit: 50,
      context: 'observation_creation',
    })

    const duration = timer.end()
    const totalResults = concepts?.length || 0

    logger.success('Concept search completed', {
      query,
      resultsCount: totalResults,
      duration,
    })

    searchResults.value = concepts || []
    totalResultsCount.value = totalResults
  } catch (error) {
    timer.end()
    logger.error('Concept search failed', error, { query })
    searchResults.value = []
    totalResultsCount.value = 0
    $q.notify({
      type: 'negative',
      message: `Search failed: ${error.message}`,
      position: 'top',
    })
  } finally {
    searchLoading.value = false
  }
}

const selectConcept = async (concept) => {
  selectedConcept.value = concept
  saveRecentConcept(concept)

  // Pre-fill location from visit if available
  if (props.visit?.visit?.LOCATION_CD) {
    formData.value.LOCATION_CD = props.visit.visit.LOCATION_CD
  }

  // Pre-fill unit from concept if available
  if (concept.UNIT_CD) {
    formData.value.UNIT_CD = concept.UNIT_CD
    logger.debug('Pre-filled unit from concept', { conceptCode: concept.CONCEPT_CD, unit: concept.UNIT_CD })
  }

  // Pre-fill category from concept (read-only)
  if (concept.CATEGORY_CHAR) {
    formData.value.CATEGORY_CHAR = concept.CATEGORY_CHAR
    logger.debug('Pre-filled category from concept', { conceptCode: concept.CONCEPT_CD, category: concept.CATEGORY_CHAR })
  } else {
    formData.value.CATEGORY_CHAR = 'General' // Default fallback
    logger.debug('No category in concept, using default', { conceptCode: concept.CONCEPT_CD })
  }

  // Fetch selection options for Finding (F) and Selection (S) type concepts
  if (concept.VALTYPE_CD === 'F' || concept.VALTYPE_CD === 'S') {
    logger.info('Fetching selection options for concept', {
      conceptCode: concept.CONCEPT_CD,
      valtype: concept.VALTYPE_CD,
    })

    // Use concept store method which handles caching
    const options = await conceptStore.getSelectionOptions(concept.CONCEPT_CD)
    selectionOptions.value = options

    logger.debug('Selection options loaded', {
      conceptCode: concept.CONCEPT_CD,
      optionsCount: options.length,
    })
  } else {
    // Clear selection options for non-selection concepts
    selectionOptions.value = []
  }

  // Clear file data when changing concept
  fileData.value = null
}

const clearSelectedConcept = () => {
  selectedConcept.value = null
  // Clear value fields when changing concept
  formData.value.TVAL_CHAR = ''
  formData.value.NVAL_NUM = null
  formData.value.UNIT_CD = ''
  formData.value.CATEGORY_CHAR = ''
  // Clear selection options
  selectionOptions.value = []
  // Clear file data
  fileData.value = null
}

const getSelectionOptions = () => {
  // Return the fetched options if available, otherwise fallback to common options
  if (selectionOptions.value.length > 0) {
    return selectionOptions.value
  }

  // Fallback options for when no hierarchy options are found
  return [
    { label: 'Yes', value: 'Yes' },
    { label: 'No', value: 'No' },
    { label: 'Unknown', value: 'Unknown' },
    { label: 'Not Applicable', value: 'N/A' },
  ]
}

// File handling methods
const handleFileSelected = (data) => {
  logger.info('File selected for observation', {
    filename: data.fileInfo.filename,
    size: data.fileInfo.size,
    ext: data.fileInfo.ext,
  })
}

const handleFileCleared = () => {
  logger.info('File cleared from observation')
}

const handleSubmit = async () => {
  if (!selectedConcept.value) {
    $q.notify({
      type: 'warning',
      message: 'Please select a concept first',
      position: 'top',
    })
    return
  }

  // Validate that at least one value is entered (or file for R type)
  if (selectedConcept.value.VALTYPE_CD === 'R') {
    // For file type, validate file data
    if (!fileData.value) {
      $q.notify({
        type: 'warning',
        message: 'Please select a file for the observation',
        position: 'top',
      })
      return
    }
  } else {
    // For other types, validate text or numeric value
    const hasNumericValue = formData.value.NVAL_NUM !== null && formData.value.NVAL_NUM !== undefined && formData.value.NVAL_NUM !== ''
    const hasTextValue = formData.value.TVAL_CHAR && formData.value.TVAL_CHAR.trim() !== ''

    if (!hasNumericValue && !hasTextValue) {
      $q.notify({
        type: 'warning',
        message: 'Please enter a value for the observation',
        position: 'top',
      })
      return
    }
  }

  loading.value = true
  try {
    // Prepare base observation data
    const observationData = {
      ENCOUNTER_NUM: props.visit.encounterNum || props.visit.visit?.ENCOUNTER_NUM,
      PATIENT_NUM: props.patient.PATIENT_NUM,
      CONCEPT_CD: selectedConcept.value.CONCEPT_CD,
      PROVIDER_ID: formData.value.PROVIDER_ID || 'SYSTEM',
      START_DATE: formData.value.START_DATE,
      END_DATE: formData.value.END_DATE,
      CATEGORY_CHAR: formData.value.CATEGORY_CHAR || 'OBSERVATION',
      INSTANCE_NUM: 1,
      VALTYPE_CD: selectedConcept.value.VALTYPE_CD || 'T',
      LOCATION_CD: formData.value.LOCATION_CD || 'UNKNOWN',
    }

    let createdObservation

    // Handle different value types
    if (selectedConcept.value.VALTYPE_CD === 'R' && fileData.value) {
      // For file type, use specialized upload function
      logger.info('Creating raw data observation with file upload', {
        conceptCode: selectedConcept.value.CONCEPT_CD,
        filename: fileData.value.fileInfo.filename,
        size: fileData.value.fileInfo.size,
      })

      const uploadResult = await databaseStore.uploadRawData(observationData, fileData.value)

      logger.debug('Upload result received', { uploadResult })

      if (uploadResult && uploadResult.success) {
        createdObservation = {
          OBSERVATION_ID: uploadResult.observationId,
          ...observationData,
          TVAL_CHAR: JSON.stringify(fileData.value.fileInfo),
          VALTYPE_CD: 'R',
        }

        logger.success('File observation created successfully', {
          observationId: uploadResult.observationId,
          filename: fileData.value.fileInfo.filename,
        })
      } else {
        throw new Error(uploadResult?.message || 'Failed to upload file')
      }
    } else {
      // For other types, use standard observation repository
      const observationRepository = databaseStore.getRepository('observation')
      if (!observationRepository) {
        throw new Error('Observation repository not available')
      }

      // Add standard fields for non-file observations
      observationData.TVAL_CHAR = formData.value.TVAL_CHAR
      observationData.NVAL_NUM = formData.value.NVAL_NUM
      observationData.VALUEFLAG_CD = formData.value.VALUEFLAG_CD
      observationData.QUANTITY_NUM = formData.value.QUANTITY_NUM
      observationData.UNIT_CD = formData.value.UNIT_CD
      observationData.CONFIDENCE_NUM = formData.value.CONFIDENCE_NUM
      observationData.OBSERVATION_BLOB = formData.value.OBSERVATION_BLOB

      createdObservation = await observationRepository.create(observationData)
    }

    $q.notify({
      type: 'positive',
      message: 'Observation created successfully',
      position: 'top',
      timeout: 3000,
      actions: [
        {
          icon: 'close',
          color: 'white',
          handler: () => {
            /* dismiss */
          },
        },
      ],
    })

    // Reset form and close dialog
    resetForm()
    showDialog.value = false

    // Small delay to ensure database operation completes
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Emit to parent
    emit('observationCreated', createdObservation)
  } catch (error) {
    logger.error('Error creating observation', error)
    $q.notify({
      type: 'negative',
      message: `Failed to create observation: ${error.message}`,
      position: 'top',
      timeout: 5000,
      actions: [
        {
          icon: 'close',
          color: 'white',
          handler: () => {
            /* dismiss */
          },
        },
      ],
    })
  } finally {
    loading.value = false
  }
}

// Watch for search query changes
watch(conceptSearchQuery, () => {
  handleSearchInput()
})

// Watch for dialog open/close
watch(showDialog, async (newValue) => {
  if (newValue) {
    logger.info('Dialog opened, initializing')
    resetForm()
    loadRecentConcepts()

    // Initialize concept store if needed
    try {
      await conceptStore.initialize()
      logger.debug('Concept store initialized')
    } catch (error) {
      logger.error('Failed to initialize concept store', error)
    }
  } else {
    logger.debug('Dialog closed, cleaning up')
    // Clean up search timeout when dialog closes
    if (searchTimeout) {
      clearTimeout(searchTimeout)
      searchTimeout = null
    }
  }
})

// Load recent concepts on mount
onMounted(async () => {
  logger.info('Component mounted, initializing')
  loadRecentConcepts()

  // Initialize concept store and load options
  try {
    await Promise.all([conceptStore.initialize(), loadOptions()])
    logger.debug('Concept store and options initialized on mount')
  } catch (error) {
    logger.error('Failed to initialize on mount', error)
  }
})
</script>

<style lang="scss" scoped>
.concept-search-section {
  .recent-concepts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .concept-item {
    transition: all 0.2s ease;

    &:hover {
      background-color: rgba(25, 118, 210, 0.08);
    }
  }
}

.observation-form-section {
  .selected-concept-display {
    .q-card {
      border: 1px solid rgba(25, 118, 210, 0.3);
    }
  }

  .value-input-section {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    background-color: #fafafa;
  }
}

// Animation for smooth transitions
.concept-search-section,
.observation-form-section {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
