<template>
  <AppDialog v-model="showDialog" :title="$t('observation.searchAndAddObservation')" :subtitle="`${$t('observation.category')}: ${fieldSetName}`" size="lg" persistent @close="cancelCustomObservation">
    <template #header>
      <div class="text-h6">
        <q-icon name="search" class="q-mr-sm" color="primary" />
        {{ $t('observation.searchAndAddObservation') }}
      </div>
      <div class="text-caption text-grey-6 q-mt-xs">
        {{ $t('observation.category') }}: <q-chip size="sm" :color="getCategoryColor()" text-color="white">{{ fieldSetName }}</q-chip>
      </div>
    </template>

    <!-- Concept Search Section -->
    <div class="concept-search-section">
      <div class="text-subtitle2 q-mb-sm">
        <q-icon name="search" class="q-mr-xs" />
        {{ $t('observation.searchConcepts') }}
      </div>

      <div class="search-row">
        <q-input v-model="searchTerm" :placeholder="$t('observation.searchPlaceholder')" outlined dense class="search-input" @keyup="onSearchInput" @focus="showSearchResults = true">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append v-if="searchTerm">
            <q-icon name="close" class="cursor-pointer" @click="clearSearch" />
          </template>
        </q-input>

        <q-btn color="primary" icon="search" :label="$t('common.search')" @click="searchConcepts" :loading="searching" :disable="!searchTerm || searchTerm.length < 2" class="search-btn" />
      </div>

      <!-- Recent Concepts -->
      <div v-if="recentConcepts.length > 0 && !searchTerm" class="recent-concepts-section q-mb-md">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          <q-icon name="history" class="q-mr-xs" />
          {{ $t('observation.recentConcepts') }}
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
        <div class="text-caption text-grey-6 q-mb-xs">
          {{ $t('messages.found') }} {{ searchResults.length }} {{ searchResults.length === 1 ? $t('observation.conceptFound') : $t('observation.conceptsFound') }}
        </div>
        <div class="concept-list">
          <q-card v-for="concept in searchResults" :key="concept.CONCEPT_CD" flat bordered class="concept-item cursor-pointer" :class="{ 'questionnaire-item': concept._isQuestionnaire }" @click="selectConcept(concept)">
            <q-card-section class="q-pa-sm">
              <div class="concept-header">
                <div class="concept-name-container">
                  <q-icon v-if="concept._isQuestionnaire" name="quiz" color="purple" size="18px" class="q-mr-xs" />
                  <div class="concept-name">{{ concept.NAME_CHAR }}</div>
                  <q-icon v-if="!concept._isQuestionnaire && isConceptInCurrentVisit(concept.CONCEPT_CD)" name="warning" color="amber-7" size="18px" class="existing-observation-icon">
                    <q-tooltip class="bg-amber-7 text-black">{{ $t('observation.alreadyInVisit') }}</q-tooltip>
                  </q-icon>
                </div>
                <q-chip v-if="concept._isQuestionnaire" size="xs" color="purple" text-color="white" class="value-type-chip" icon="quiz">
                  {{ $t('observation.questionnaire') }}
                </q-chip>
                <q-chip v-else size="xs" :color="getValueTypeColor(concept.VALTYPE_CD)" text-color="white" class="value-type-chip">
                  {{ concept.VALTYPE_CD }}
                </q-chip>
              </div>
              <div class="concept-code text-caption text-grey-6">
                {{ concept._isQuestionnaire ? concept._questionnaireCode : concept.CONCEPT_CD }}
              </div>
              <div v-if="concept.UNIT_CD" class="concept-unit text-caption text-grey-5">{{ $t('observation.unit') }}: {{ concept.UNIT_CD }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- No Results Message -->
      <div v-else-if="showSearchResults && searchTerm.length >= 2 && !searching && searchAttempted" class="no-results">
        <q-icon name="search_off" color="grey-5" size="24px" />
        <div class="text-caption text-grey-6">{{ $t('observation.noConceptsFound') }}</div>
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

    <!-- Value Input Section -->
    <div v-if="selectedConcept" class="value-input-section">
      <q-separator class="q-my-md" />

      <div class="text-subtitle2 q-mb-sm">
        <q-icon name="edit" class="q-mr-xs" />
        Enter Value
      </div>

      <!-- Finding Type Options (Yes/No/K.A.) -->
      <div v-if="selectedConcept.VALTYPE_CD === 'F'" class="finding-options q-mb-md">
        <div class="text-caption text-grey-6 q-mb-sm">Select an answer:</div>
        <div class="finding-options-grid">
          <q-btn
            v-for="option in findingOptions"
            :key="option.value"
            :label="option.label"
            :color="option.color || 'primary'"
            outline
            size="sm"
            class="finding-option-btn"
            @click="selectFindingOption(option)"
            :class="{ selected: customObservation.value === option.value }"
          />
        </div>
      </div>

      <!-- Selection Type Options -->
      <div v-if="selectedConcept.VALTYPE_CD === 'S'" class="selection-options q-mb-md">
        <div class="text-caption text-grey-6 q-mb-sm">Select an option:</div>
        <div class="selection-options-grid">
          <q-btn
            v-for="option in selectionOptions"
            :key="option.value"
            :label="option.label"
            :color="option.color || 'primary'"
            outline
            size="sm"
            class="selection-option-btn"
            @click="selectSelectionOption(option)"
            :class="{ selected: customObservation.value === option.value }"
          />
        </div>
      </div>

      <!-- File Upload for Raw Data (R) type -->
      <div v-if="selectedConcept.VALTYPE_CD === 'R'" class="file-upload-section">
        <div class="text-subtitle2 q-mb-sm">
          <q-icon name="attach_file" class="q-mr-xs" />
          File Attachment
        </div>
        <FileUploadInput v-model="fileData" :max-size-m-b="10" accepted-types=".txt,.png,.gif,.jpg,.jpeg,.pdf,.doc,.docx" @file-selected="onFileSelected" @file-cleared="onFileCleared" />
      </div>

      <!-- Standard Input for non-Finding, non-Selection and non-Raw types -->
      <q-input
        v-if="selectedConcept.VALTYPE_CD !== 'F' && selectedConcept.VALTYPE_CD !== 'S' && selectedConcept.VALTYPE_CD !== 'R'"
        v-model="customObservation.value"
        :label="`Value for ${selectedConcept.NAME_CHAR}`"
        :type="getValueInputType()"
        outlined
        dense
        :rules="[(val) => !!val || 'Value is required']"
        class="q-mb-md"
      />

      <!-- Hidden input for Finding types to store the selected option -->
      <q-input
        v-if="selectedConcept.VALTYPE_CD === 'F'"
        v-model="customObservation.value"
        :label="`Selected Answer for ${selectedConcept.NAME_CHAR}`"
        outlined
        dense
        readonly
        :rules="[(val) => !!val || 'Please select an answer']"
        class="q-mb-md"
      />

      <!-- Hidden input for Selection types to store the selected option -->
      <q-input
        v-if="selectedConcept.VALTYPE_CD === 'S'"
        v-model="customObservation.value"
        :label="`Selected Option for ${selectedConcept.NAME_CHAR}`"
        outlined
        dense
        readonly
        :rules="[(val) => !!val || 'Please select an option']"
        class="q-mb-md"
      />

      <!-- Unit selection for non-Finding and non-Selection types -->
      <q-select
        v-if="selectedConcept.VALTYPE_CD !== 'F' && selectedConcept.VALTYPE_CD !== 'S'"
        v-model="customObservation.unit"
        label="Unit (optional)"
        outlined
        dense
        :options="unitOptions"
        emit-value
        map-options
        clearable
        :placeholder="selectedConcept.UNIT_CD || 'Select unit if different from concept default'"
      />
    </div>

    <template #actions>
      <q-btn color="primary" label="Add Observation" @click="saveCustomObservation" :disable="!canSave()" :loading="saving" />
    </template>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useObservationStore } from 'src/stores/observation-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useDatabaseStore } from 'src/stores/database-store'
import AppDialog from 'src/components/shared/AppDialog.vue'
import FileUploadInput from 'src/components/shared/FileUploadInput.vue'

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

const emit = defineEmits(['update:modelValue', 'observation-added', 'questionnaire-added'])

const notify = useNotify()
const observationStore = useObservationStore()
const globalSettingsStore = useGlobalSettingsStore()
const conceptStore = useConceptResolutionStore()
const dbStore = useDatabaseStore()
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
const recentConcepts = ref([])
const selectedConcept = ref(null)
const saving = ref(false)
const findingOptions = ref([])
const selectionOptions = ref([])
const fileData = ref(null)
const unitOptions = ref([])

// Computed
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Helper to check if a concept already exists in the current visit
const isConceptInCurrentVisit = (conceptCode) => {
  if (!props.visit || !observationStore.observations) return false

  return observationStore.observations.some((obs) => {
    // Try multiple matching strategies:
    // 1. Exact match
    if (obs.conceptCode === conceptCode) return true

    // 2. Extract the numeric code from both sides and compare
    // Handle formats like "LOINC:8480-6" vs "LID: 8480-6"
    const conceptMatch = conceptCode.match(/[:\s]([0-9-]+)$/)
    const obsMatch = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
    if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) {
      return true
    }

    return false
  })
}

// Watch for dialog close to reset state
watch(showDialog, (newValue) => {
  if (newValue) {
    // Load recent concepts and unit options when dialog opens
    loadRecentConcepts()
    loadUnitOptions()
  } else {
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
    // Filter out concepts with VALTYPE_CD = 'A'
    const conceptResults = results.filter((concept) => concept.VALTYPE_CD !== 'A')

    // Also search CODE_LOOKUP for questionnaires
    const questionnaireResults = await searchQuestionnaires(searchTerm.value)

    // Merge: questionnaires first, then concepts
    searchResults.value = [...questionnaireResults, ...conceptResults]
    showSearchResults.value = true

    logger.info('Concept search completed', {
      searchTerm: searchTerm.value,
      conceptCount: conceptResults.length,
      questionnaireCount: questionnaireResults.length,
    })
  } catch (error) {
    logger.error('Concept search failed', error)
    notify.error('Failed to search concepts')
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

const loadRecentConcepts = () => {
  try {
    const stored = localStorage.getItem('recentCustomObservationConcepts')
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
    localStorage.setItem('recentCustomObservationConcepts', JSON.stringify(recent))

    logger.debug('Saved recent concept', {
      conceptCode: concept.CONCEPT_CD,
      conceptName: concept.NAME_CHAR,
      totalRecent: recent.length,
    })
  } catch (error) {
    logger.warn('Failed to save recent concept', error)
  }
}

const loadUnitOptions = async () => {
  try {
    const units = await globalSettingsStore.getUnitOptions()
    unitOptions.value = units.map((u) => ({
      label: u.value, // Use short code as label (mg, ml, etc.)
      value: u.value,
    }))
  } catch (error) {
    logger.error('Failed to load unit options', error)
    unitOptions.value = []
  }
}

/**
 * Search CODE_LOOKUP for questionnaires matching the search term
 */
const searchQuestionnaires = async (term) => {
  try {
    const searchPattern = `%${term}%`
    const result = await dbStore.executeQuery(
      `SELECT CODE_CD, NAME_CHAR FROM CODE_LOOKUP
       WHERE TABLE_CD = 'SURVEY_BEST' AND COLUMN_CD = 'QUESTIONNAIRE'
       AND (NAME_CHAR LIKE ? OR CODE_CD LIKE ?)
       ORDER BY NAME_CHAR LIMIT 5`,
      [searchPattern, searchPattern],
    )

    if (result.success && result.data) {
      return result.data.map((row) => ({
        CONCEPT_CD: `QUEST:${row.CODE_CD}`,
        NAME_CHAR: row.NAME_CHAR,
        VALTYPE_CD: 'Q',
        SOURCESYSTEM_CD: 'SURVEY_BEST',
        UNIT_CD: null,
        _isQuestionnaire: true,
        _questionnaireCode: row.CODE_CD,
      }))
    }
    return []
  } catch (error) {
    logger.warn('Questionnaire search failed', error)
    return []
  }
}

const selectConcept = async (concept) => {
  // Special handling for questionnaire selection
  if (concept._isQuestionnaire) {
    logger.info('Questionnaire selected from search', { code: concept._questionnaireCode, name: concept.NAME_CHAR })

    emit('questionnaire-added', {
      code: concept._questionnaireCode,
      title: concept.NAME_CHAR,
      shortTitle: concept._questionnaireCode,
    })

    resetState()
    showDialog.value = false

    notify.success(`Fragebogen "${concept.NAME_CHAR}" zur Visite hinzugefügt`)
    return
  }

  selectedConcept.value = concept
  customObservation.value.unit = concept.UNIT_CD || ''

  // Save to recent concepts
  saveRecentConcept(concept)

  // Load finding options if this is a Finding type concept
  if (concept.VALTYPE_CD === 'F') {
    try {
      findingOptions.value = await conceptStore.getFindingOptions(concept.CONCEPT_CD)
      logger.info('Finding options loaded', {
        conceptCode: concept.CONCEPT_CD,
        optionsCount: findingOptions.value.length,
      })
    } catch (error) {
      logger.error('Failed to load finding options', error)
      // Set fallback options
      findingOptions.value = [
        { label: 'Yes', value: 'Yes', color: 'positive' },
        { label: 'No', value: 'No', color: 'negative' },
        { label: 'K.A.', value: 'K.A.', color: 'grey' },
      ]
    }
    selectionOptions.value = []
  }
  // Load selection options if this is a Selection type concept
  else if (concept.VALTYPE_CD === 'S') {
    try {
      selectionOptions.value = await conceptStore.getSelectionOptions(concept.CONCEPT_CD)
      logger.info('Selection options loaded', {
        conceptCode: concept.CONCEPT_CD,
        optionsCount: selectionOptions.value.length,
      })
    } catch (error) {
      logger.error('Failed to load selection options', error)
      // Set fallback options for selection
      selectionOptions.value = [
        { label: 'Option 1', value: 'OPTION_1', color: 'primary' },
        { label: 'Option 2', value: 'OPTION_2', color: 'secondary' },
        { label: 'Option 3', value: 'OPTION_3', color: 'accent' },
      ]
    }
    findingOptions.value = []
  } else {
    findingOptions.value = []
    selectionOptions.value = []
  }

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
  findingOptions.value = []
  selectionOptions.value = []
}

const selectFindingOption = (option) => {
  customObservation.value.value = option.value
  logger.info('Finding option selected', {
    option: option.label,
    value: option.value,
  })
}

const selectSelectionOption = (option) => {
  customObservation.value.value = option.value
  logger.info('Selection option selected', {
    option: option.label,
    value: option.value,
  })
}

const onFileSelected = (data) => {
  fileData.value = data
  // For file observations, set the value to the filename
  customObservation.value.value = data.fileInfo.filename
  logger.info('File selected for observation', {
    filename: data.fileInfo.filename,
    size: data.fileInfo.size,
    conceptCode: selectedConcept.value?.CONCEPT_CD,
  })
}

const onFileCleared = () => {
  fileData.value = null
  customObservation.value.value = ''
  logger.info('File cleared from observation')
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
    Q: 'purple',
    M: 'deep-purple',
  }
  return colorMap[valueType] || 'grey'
}

const canSave = () => {
  if (!selectedConcept.value) return false

  // For file type (R), require file data
  if (selectedConcept.value.VALTYPE_CD === 'R') {
    return !!fileData.value && !!fileData.value.fileInfo
  }

  // For other types, require value
  return !!customObservation.value.value
}

const saveCustomObservation = async () => {
  try {
    saving.value = true

    const conceptCode = selectedConcept.value.CONCEPT_CD
    const valueType = selectedConcept.value.VALTYPE_CD || 'T'
    const category = props.fieldSetName.toUpperCase()

    // Get default values from global settings
    const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('VISITS_PAGE')

    // Extract encounter number from visit object (handle different visit structures)
    const encounterNum = props.visit.id || props.visit.encounterNum || props.visit.visit?.ENCOUNTER_NUM

    logger.debug('Extracting encounter number from visit', {
      visitStructure: {
        hasId: !!props.visit.id,
        hasEncounterNum: !!props.visit.encounterNum,
        hasVisitEncounterNum: !!props.visit.visit?.ENCOUNTER_NUM,
        extractedEncounterNum: encounterNum,
      },
      visitKeys: Object.keys(props.visit),
    })

    if (!encounterNum) {
      logger.error('Visit encounter number not found', {
        visit: props.visit,
        visitKeys: Object.keys(props.visit),
      })
      throw new Error('Visit encounter number not found')
    }

    const observationData = {
      ENCOUNTER_NUM: encounterNum,
      // Don't pass PATIENT_NUM - let the store look it up from selectedPatient
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

    // Handle file upload for raw data type
    if (valueType === 'R' && fileData.value) {
      logger.info('Creating raw data observation with file upload', {
        conceptCode,
        filename: fileData.value.fileInfo.filename,
        size: fileData.value.fileInfo.size,
      })

      // Use database store's uploadRawData method
      const uploadResult = await dbStore.uploadRawData(observationData, fileData.value)

      if (!uploadResult || !uploadResult.success) {
        throw new Error(uploadResult?.message || 'Failed to upload file')
      }

      logger.success('File observation created successfully', {
        observationId: uploadResult.observationId,
        filename: fileData.value.fileInfo.filename,
      })
    } else {
      // Handle regular observations
      if (valueType === 'N') {
        observationData.NVAL_NUM = parseFloat(customObservation.value.value)
      } else {
        observationData.TVAL_CHAR = customObservation.value.value
      }

      if (customObservation.value.unit) {
        observationData.UNIT_CD = customObservation.value.unit
      }

      // Add PATIENT_NUM to observation data
      observationData.PATIENT_NUM = props.patient.PATIENT_NUM

      // Use service to create observation
      await visitObservationService.createObservation(observationData)
    }

    emit('observation-added', {
      conceptCode,
      value: customObservation.value.value,
      unit: customObservation.value.unit,
      conceptName: selectedConcept.value.NAME_CHAR,
      valueType,
    })

    resetState()
    showDialog.value = false

    notify.success('Observation added successfully')
  } catch (error) {
    logger.error('Failed to save observation', error)
    notify.error('Failed to save observation')
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
  findingOptions.value = []
  fileData.value = null
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

        &.questionnaire-item {
          background: rgba($purple, 0.03);
          border-left: 3px solid $purple;

          &:hover {
            background: rgba($purple, 0.08);
            border-left: 3px solid $purple;
          }
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

            .existing-observation-icon {
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

.value-input-section {
  .q-input {
    margin-bottom: 0.5rem;
  }

  .file-upload-section {
    margin-bottom: 1rem;

    .text-subtitle2 {
      display: flex;
      align-items: center;
      color: $grey-7;
      font-weight: 500;
    }
  }

  .finding-options,
  .selection-options {
    .finding-options-grid,
    .selection-options-grid {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;

      .finding-option-btn,
      .selection-option-btn {
        min-width: 80px;
        transition: all 0.2s ease;

        &.selected {
          background: $primary;
          color: white;
        }

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
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
