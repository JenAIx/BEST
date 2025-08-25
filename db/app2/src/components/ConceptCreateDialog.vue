<template>
  <AppInputDialog
    v-model="dialogVisible"
    title="Create New Concept"
    ok-label="Create Concept"
    cancel-label="Cancel"
    :loading="isSaving"
    :disable-ok="!isFormValid"
    @ok="onSubmit"
    @cancel="onCancel"
    size="lg"
  >
    <q-form @submit.prevent="onSubmit" class="q-gutter-md">
      <!-- Source System Field (moved to top) -->
      <q-select
        v-model="formData.sourceSystem"
        label="Source System"
        outlined
        dense
        :options="sourceSystemOptions"
        :rules="[(val) => !!val || 'Source system is required']"
        emit-value
        map-options
        @update:model-value="onSourceSystemChange"
        hint="Source system (LOINC, ICD10, SNOMED-CT, etc.)"
      />

      <!-- Concept Path Field -->
      <q-input
        v-model="formData.conceptPath"
        label="Concept Path"
        outlined
        dense
        :rules="[(val) => !!val || 'Concept path is required', (val) => val.startsWith('\\') || 'Concept path must start with \\', (val) => !val.endsWith('\\') || 'Concept path must not end with \\']"
        @update:model-value="onFieldChange"
        hint="Hierarchical path (e.g., \\LOINC\\CHEM\\Bld\\2947-0)"
      >
        <template v-slot:append>
          <q-icon name="search" class="cursor-pointer" @click="showPathPicker = true" />
        </template>
      </q-input>

      <!-- Concept Code Field -->
      <div class="row q-gutter-sm">
        <div class="col-3 flex items-center justify-center bg-grey-2 rounded-borders">
          <span class="text-caption">
            <span v-if="formData.sourceSystem === 'SNOMED-CT'">SCTID</span>
            <span v-else-if="formData.sourceSystem === 'LOINC'">LID</span>
            <span v-else>{{ formData.sourceSystem || 'CODE' }}</span
            >:
          </span>
        </div>
        <div class="col">
          <q-input
            v-model="formData.conceptCode"
            label="Concept Code"
            outlined
            dense
            :rules="[(val) => !!val || 'Concept code is required', (val) => val.length >= 3 || 'Concept code must be at least 3 characters']"
            @update:model-value="onFieldChange"
            hint="Unique identifier"
          >
            <template v-slot:append>
              <q-icon v-if="formData.sourceSystem === 'SNOMED-CT'" name="search" @click="handleConceptCodeSearch" class="cursor-pointer">
                <q-tooltip>Search SNOMED concepts</q-tooltip>
              </q-icon>
            </template>
          </q-input>
        </div>
      </div>

      <!-- Name Field -->
      <q-input
        v-model="formData.name"
        label="Concept Name"
        outlined
        dense
        :rules="[(val) => !!val || 'Concept name is required']"
        @update:model-value="onFieldChange"
        hint="Human-readable name for the concept"
      >
        <template v-slot:append>
          <q-icon v-if="formData.sourceSystem === 'SNOMED-CT'" name="search" @click="handleConceptNameSearch" class="cursor-pointer">
            <q-tooltip>Search SNOMED concepts</q-tooltip>
          </q-icon>
        </template>
      </q-input>

      <div class="row">
      <!-- Category Field -->
       <div class="col-4">
      <q-select
        v-model="formData.category"
        label="Category"
        outlined
        dense
        :options="categoryOptions"
        :rules="[(val) => !!val || 'Category is required']"
        emit-value
        map-options
        @update:model-value="onFieldChange"
        hint="Concept category for organization"
      />
    </div>
      <!-- Value Type Field -->
       <div class="col-4">
      <q-select
        v-model="formData.valueType"
        label="Value Type"
        outlined
        dense
        :options="valueTypeOptions"
        :rules="[(val) => !!val || 'Value type is required']"
        emit-value
        map-options
        @update:model-value="onValueTypeChange"
        hint="Type of value"
      />
    </div>
    <div class="col-4">
            <!-- Unit Code Field -->
            <q-input v-model="formData.unitCode" label="Unit Code" outlined dense @update:model-value="onFieldChange" hint="Unit of measurement" />

    </div>
      </div>

      <!-- Selection Answers (only for S type) -->
      <div v-if="formData.valueType === 'S'" class="q-pa-md bg-grey-1 rounded-borders">
        <div class="text-subtitle2 q-mb-sm">Answers</div>
        <div v-if="selectionAnswers">
          {{ selectionAnswers }}
          <q-icon v-if="selectionAnswers.includes('link:')" name="close" class="cursor-pointer q-ml-sm" @click="unlinkAnswer()" />
          <span v-else-if="answersCount > 0">
            {{ answersCount }} items
            <q-icon size="sm" name="edit" class="cursor-pointer q-ml-sm" @click="showEditAnswers = true" />
          </span>
          <span v-else>
            <q-icon size="sm" name="add" class="cursor-pointer q-mr-md" @click="showEditAnswers = true" />
            <q-icon size="sm" name="link" class="cursor-pointer" @click="linkAnswer()" />
          </span>
        </div>
      </div>



      <!-- Related Concept Field -->
      <q-input v-model="formData.relatedConcept" label="Related Concept" outlined dense @update:model-value="onFieldChange" hint="Related concept code (optional)" />

      <!-- Description Field -->
      <q-input v-model="formData.description" label="Description" outlined dense type="textarea" rows="3" @update:model-value="onFieldChange" hint="Detailed description of the concept" />

      <!-- Preview Button -->
      <div class="row justify-end" v-if="isFormValid">
        <q-btn rounded color="black" icon="preview" @click="showPreview()">
          <q-tooltip>Preview final concept</q-tooltip>
        </q-btn>
      </div>
    </q-form>
  </AppInputDialog>

  <!-- Path Picker Dialog -->
  <PathPickerDialog v-if="showPathPicker" v-model="showPathPicker" :current-path="formData.conceptPath" @save="updateConceptPath" />

  <!-- Preview Dialog -->
  <q-dialog v-model="showPreviewDialog">
    <q-card style="min-width: 400px">
      <q-btn flat rounded class="absolute-top-right z-top" icon="close" v-close-popup />
      <q-card-section>
        <div class="text-h6">Preview</div>
      </q-card-section>
      <q-card-section>
        <pre class="text-caption">{{ previewData }}</pre>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- Edit Answers Dialog -->
  <EditConceptAnswersDialog v-if="showEditAnswers" v-model="showEditAnswers" :concept="formData" />

  <!-- SNOMED Search Dialog -->
  <q-dialog v-model="showSNOMEDSearchDialog" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center">
        <div class="text-h6">Search SNOMED Concepts</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Search Input -->
        <q-input v-model="snomedSearchQuery" label="Search Term" outlined dense placeholder="Enter search term (e.g., 'heart attack', 'diabetes')" @keyup.enter="searchSNOMEDConcepts" class="q-mb-md">
          <template v-slot:append>
            <q-btn icon="search" color="primary" @click="searchSNOMEDConcepts" :loading="snomedSearchLoading" />
          </template>
        </q-input>

        <!-- Search Results -->
        <div v-if="snomedSearchResults.length > 0" class="q-mt-md">
          <div class="text-subtitle2 q-mb-sm">Found {{ snomedSearchResults.length }} concepts</div>
          <q-list class="bordered" style="max-height: 300px; overflow-y: auto">
            <q-item v-for="result in snomedSearchResults" :key="result.conceptId" clickable v-ripple @click="selectSNOMEDConcept(result)">
              <q-item-section>
                <q-item-label>{{ result.term }}</q-item-label>
                <q-item-label caption>ID: {{ result.conceptId }}</q-item-label>
                <q-item-label v-if="result.fsn !== result.term" caption class="text-grey-5"> FSN: {{ result.fsn }} </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat round dense icon="add" color="primary" @click.stop="selectSNOMEDConcept(result)">
                  <q-tooltip>Select this concept</q-tooltip>
                </q-btn>
              </q-item-section>

              <!-- Tooltip with detailed information -->
              <q-tooltip class="bg-white text-black shadow-4" style="font-size: 12px; max-width: 400px">
                <div class="q-pa-sm">
                  <div><strong>Term:</strong> {{ result.term }}</div>
                  <div><strong>Concept ID:</strong> {{ result.conceptId }}</div>
                  <div v-if="result.fsn !== result.term"><strong>FSN:</strong> {{ result.fsn }}</div>
                  <div v-if="result.description"><strong>Description:</strong> {{ result.description }}</div>
                  <div><strong>Status:</strong> {{ result.active ? 'Active' : 'Inactive' }}</div>
                  <div v-if="result.definitionStatus"><strong>Definition:</strong> {{ result.definitionStatus }}</div>
                  <div v-if="result.module"><strong>Module:</strong> {{ result.module }}</div>
                </div>
              </q-tooltip>
            </q-item>
          </q-list>
        </div>

        <div v-if="snomedSearchLoading" class="text-center q-pa-md">
          <q-spinner color="primary" size="2em" />
          <div class="q-mt-sm">Searching SNOMED...</div>
        </div>

        <div v-if="!snomedSearchLoading && snomedSearchQuery && snomedSearchResults.length === 0" class="text-center text-grey-6 q-pa-md">No concepts found for "{{ snomedSearchQuery }}"</div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="grey" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import AppInputDialog from 'components/shared/AppInputDialog.vue'
import PathPickerDialog from 'components/shared/PathPickerDialog.vue'
import EditConceptAnswersDialog from 'components/shared/EditConceptAnswersDialog.vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'

const $q = useQuasar()
const dbStore = useDatabaseStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ConceptCreateDialog')

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Form state
const formData = ref({
  conceptCode: '',
  name: '',
  conceptPath: '',
  category: '',
  valueType: '',
  unitCode: '',
  sourceSystem: '',
  relatedConcept: '',
  description: '',
})

const isSaving = ref(false)

// Dialog states
const showPathPicker = ref(false)
const showPreviewDialog = ref(false)
const showEditAnswers = ref(false)
const showSNOMEDSearchDialog = ref(false)

// SNOMED search state
const snomedSearchQuery = ref('')
const snomedSearchResults = ref([])
const snomedSearchLoading = ref(false)

// Selection answers state
const answersCount = ref(0)
const previewData = ref('')

// Options loaded from global settings store
const categoryOptions = ref([])
const valueTypeOptions = ref([])
const sourceSystemOptions = ref([])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    if (!value) {
      // Clear form when dialog is closed
      resetForm()
    }
  },
})

// Computed properties
const isFormValid = computed(() => {
  return (
    formData.value.conceptCode.trim() !== '' &&
    formData.value.conceptCode.length >= 3 &&
    formData.value.name.trim() !== '' &&
    formData.value.conceptPath.trim() !== '' &&
    formData.value.conceptPath.startsWith('\\') &&
    !formData.value.conceptPath.endsWith('\\') &&
    formData.value.category !== '' &&
    formData.value.valueType !== '' &&
    formData.value.sourceSystem !== ''
  )
})

const selectionAnswers = computed(() => {
  if (formData.value.valueType !== 'S') return undefined
  if (formData.value.relatedConcept) return `link: ${formData.value.relatedConcept}`
  return ' '
})

// Methods
const onFieldChange = () => {
  // This will trigger the computed properties
}

const onSourceSystemChange = (value) => {
  // Handle both string values and object values from q-select
  const systemValue = typeof value === 'string' ? value : value?.value || value?.label

  if (systemValue && formData.value.sourceSystem !== systemValue) {
    formData.value.sourceSystem = systemValue
    formData.value.conceptPath = `\\${systemValue}`
    // Clear concept code when source system changes
    formData.value.conceptCode = ''
  }
  onFieldChange()
}

const onValueTypeChange = (value) => {
  formData.value.valueType = value
  if (value === 'S' && formData.value.conceptPath && formData.value.conceptCode) {
    // Load answers count for selection type
    loadAnswersCount()
  }
  onFieldChange()
}

const loadAnswersCount = async () => {
  try {
    const conceptRepo = dbStore.getRepository('concept')
    if (conceptRepo) {
      const answerPath = `${formData.value.conceptPath}\\${formData.value.conceptCode}\\LA`
      const query = `SELECT COUNT(*) as count FROM CONCEPT_DIMENSION WHERE CONCEPT_PATH LIKE '${answerPath}%'`
      const result = await conceptRepo.connection.executeQuery(query)

      if (result.success && result.data && result.data.length > 0) {
        answersCount.value = result.data[0].count || 0
      } else {
        answersCount.value = 0
      }
    }
  } catch (error) {
    logger.error('Failed to load answers count', error)
    answersCount.value = 0
  }
}

const resetForm = () => {
  formData.value = {
    conceptCode: '',
    name: '',
    conceptPath: '',
    category: '',
    valueType: '',
    unitCode: '',
    sourceSystem: '',
    relatedConcept: '',
    description: '',
  }
  answersCount.value = 0
  // Reset SNOMED search state
  snomedSearchQuery.value = ''
  snomedSearchResults.value = []
  snomedSearchLoading.value = false
}

// Options loading functions
const loadCategories = async () => {
  try {
    categoryOptions.value = await globalSettingsStore.getCategoryOptions()
  } catch (error) {
    logger.error('Failed to load categories', error)
    categoryOptions.value = []
  }
}

const loadValueTypes = async () => {
  try {
    valueTypeOptions.value = await globalSettingsStore.getValueTypeOptions()
  } catch (error) {
    logger.error('Failed to load value types', error)
    valueTypeOptions.value = []
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
    logger.error('Failed to load source systems', error)
    sourceSystemOptions.value = []
  }
}

const loadAllOptions = async () => {
  await Promise.all([loadCategories(), loadValueTypes(), loadSourceSystems()])
}

const onCancel = () => {
  dialogVisible.value = false
  emit('cancel')
}

// SNOMED search handlers
const handleConceptCodeSearch = () => {
  if (formData.value.conceptCode && formData.value.conceptCode.trim()) {
    // If there's a concept code, query by ID
    querySNOMED_API(formData.value.conceptCode.trim())
  } else {
    // If no concept code, prompt for input
    $q.dialog({
      title: 'Search SNOMED Concept by ID',
      message: 'Enter SNOMED Concept ID (SCTID):',
      prompt: {
        model: '',
        type: 'text',
        placeholder: 'e.g., 433178008',
      },
      cancel: true,
    }).onOk((snomedId) => {
      if (snomedId && snomedId.trim()) {
        formData.value.conceptCode = snomedId.trim()
        querySNOMED_API(snomedId.trim())
      }
    })
  }
}

const handleConceptNameSearch = () => {
  if (formData.value.name && formData.value.name.trim()) {
    // If there's a name, search by name
    snomedSearchQuery.value = formData.value.name.trim()
    searchSNOMEDConcepts().then(() => {
      showSNOMEDSearchDialog.value = true
    })
  } else {
    // If no name, prompt for input
    $q.dialog({
      title: 'Search SNOMED Concepts',
      message: 'Enter search term:',
      prompt: {
        model: '',
        type: 'text',
        placeholder: 'e.g., heart attack, diabetes',
      },
      cancel: true,
    }).onOk((searchTerm) => {
      if (searchTerm && searchTerm.trim()) {
        snomedSearchQuery.value = searchTerm.trim()
        searchSNOMEDConcepts().then(() => {
          showSNOMEDSearchDialog.value = true
        })
      }
    })
  }
}

// SNOMED API methods
const querySNOMED_API = async (snomedVal) => {
  const snomedId = parseInt(snomedVal)
  if (!snomedId) {
    $q.notify({ type: 'negative', message: 'Invalid SNOMED ID' })
    return
  }

  try {
    // Query SNOMED concept by ID
    const conceptData = await querySNOMEDConceptFull(snomedId)
    if (conceptData) {
      formData.value.name = conceptData.pt.term
      formData.value.sourceSystem = 'SNOMED-CT'

      // Determine value type from SNOMED concept
      const valueType = determineSNOMEDValueType(conceptData)
      if (valueType) {
        formData.value.valueType = valueType
      }

      // Resolve concept path
      const conceptPath = await resolveSNOMEDConcept(snomedId)
      if (conceptPath) {
        formData.value.conceptPath = conceptPath
      }

      $q.notify({ type: 'positive', message: 'SNOMED concept loaded successfully' })
    } else {
      $q.notify({ type: 'warning', message: 'No SNOMED concept found with this ID' })
    }
  } catch (error) {
    logger.error('SNOMED API query failed', error)
    $q.notify({ type: 'negative', message: 'SNOMED API query failed' })
  }
}

// SNOMED API implementation based on old code
const querySNOMEDConceptFull = async (SNOMED_ID) => {
  if (!SNOMED_ID || typeof SNOMED_ID !== 'number') return undefined

  const url = `https://browser.ihtsdotools.org/snowstorm/snomed-ct/browser/MAIN/2023-02-28/concepts/${SNOMED_ID}`

  try {
    const response = await fetch(url)
    if (response.ok) {
      const data = await response.json()
      return data
    }
    return undefined
  } catch (error) {
    logger.error('Failed to query SNOMED concept (full)', error)
    return undefined
  }
}

const resolveSNOMEDConcept = async (SNOMED_ID) => {
  if (!SNOMED_ID || typeof SNOMED_ID !== 'number') return undefined

  try {
    // First get the full concept data using the browser API
    let res = await querySNOMEDConceptFull(SNOMED_ID)
    if (!res) return undefined

    let url = `${SNOMED_ID}`
    let parentId = getSNOMEDParent(res)
    let cc = 0

    while (parentId !== undefined && cc < 10) {
      cc++ // safety break
      url = `${parentId}\\${url}`

      // Get full concept data for parent to access relationships
      res = await querySNOMEDConceptFull(parentId)
      if (res) parentId = getSNOMEDParent(res)
      else break
    }

    return `\\SNOMED-CT\\${url}`
  } catch (error) {
    logger.error('Failed to resolve SNOMED concept', error)
    return undefined
  }
}

const getSNOMEDParent = (res) => {
  if (!res || !res.relationships) return undefined

  // Look for "IS A" relationship (116680003 is the SCTID for "Is a")
  const relationships = res.relationships
  for (let relationship of relationships) {
    if (relationship.type && relationship.type.conceptId === '116680003' && relationship.active && relationship.destinationId) {
      return parseInt(relationship.destinationId)
    }
  }

  // Fallback: if no "IS A" found, try the first active relationship
  for (let relationship of relationships) {
    if (relationship.active && relationship.destinationId) {
      return parseInt(relationship.destinationId)
    }
  }

  return undefined
}

const determineSNOMEDValueType = (conceptData) => {
  if (!conceptData || !conceptData.pt) return null

  const term = conceptData.pt.term.toLowerCase()
  const conceptId = conceptData.conceptId

  // Common SNOMED patterns for different value types
  if (term.includes('procedure') || term.includes('operation') || term.includes('surgery')) {
    return 'F' // Finding/Procedure
  }

  if (term.includes('disorder') || term.includes('disease') || term.includes('syndrome') || term.includes('condition') || term.includes('abnormal')) {
    return 'F' // Finding
  }

  if (term.includes('observable') || term.includes('measurement') || term.includes('value') || term.includes('level') || term.includes('count') || term.includes('concentration')) {
    return 'N' // Numeric
  }

  if (term.includes('substance') || term.includes('product') || term.includes('agent') || term.includes('material')) {
    return 'T' // Text
  }

  if (term.includes('date') || term.includes('time') || term.includes('when')) {
    return 'D' // Date
  }

  // Check specific SNOMED hierarchies by concept ID ranges
  const id = parseInt(conceptId)
  if (id >= 404684003 && id <= 609096000) {
    // Clinical finding range
    return 'F' // Finding
  }

  if (id >= 71388002 && id <= 432102000) {
    // Procedure range
    return 'F' // Finding/Procedure
  }

  if (id >= 105590001 && id <= 766939001) {
    // Substance range
    return 'T' // Text
  }

  // Default to Text for most SNOMED concepts
  return 'T'
}

const searchSNOMEDConcepts = async () => {
  if (!snomedSearchQuery.value.trim()) return

  snomedSearchLoading.value = true
  try {
    const searchTerm = encodeURIComponent(snomedSearchQuery.value.trim())
    const url = `https://browser.ihtsdotools.org/snowstorm/snomed-ct/browser/MAIN/descriptions?&limit=50&term=${searchTerm}&conceptActive=true&lang=english&skipTo=0&returnLimit=50`

    const response = await fetch(url)
    if (response.ok) {
      const data = await response.json()
      if (data.items && data.items.length > 0) {
        snomedSearchResults.value = data.items.map((item) => ({
          conceptId: item.concept.conceptId,
          term: item.term,
          description: item.description,
          module: item.concept.module,
          active: item.concept.active,
          definitionStatus: item.concept.definitionStatus,
          fsn: item.concept.fsn?.term || item.term,
        }))
      } else {
        snomedSearchResults.value = []
      }
    } else {
      snomedSearchResults.value = []
    }
  } catch (error) {
    logger.error('Failed to search SNOMED concepts', error)
    $q.notify({ type: 'negative', message: 'Failed to search SNOMED concepts' })
    snomedSearchResults.value = []
  } finally {
    snomedSearchLoading.value = false
  }
}

const selectSNOMEDConcept = async (concept) => {
  formData.value.conceptCode = concept.conceptId
  formData.value.name = concept.term
  formData.value.sourceSystem = 'SNOMED-CT'

  // Get full concept data to determine value type
  const fullConceptData = await querySNOMEDConceptFull(parseInt(concept.conceptId))
  if (fullConceptData) {
    const valueType = determineSNOMEDValueType(fullConceptData)
    if (valueType) {
      formData.value.valueType = valueType
    }
  }

  // Resolve the concept path
  const path = await resolveSNOMEDConcept(parseInt(concept.conceptId))
  if (path) {
    formData.value.conceptPath = path
  }

  showSNOMEDSearchDialog.value = false
  snomedSearchQuery.value = ''
  snomedSearchResults.value = []

  $q.notify({ type: 'positive', message: 'SNOMED concept selected successfully' })
}

const updateConceptPath = (path) => {
  if (path) {
    formData.value.conceptPath = path
    onFieldChange()
  }
  showPathPicker.value = false
}

// Answer management methods
const unlinkAnswer = () => {
  formData.value.relatedConcept = null
  onFieldChange()
}

const linkAnswer = () => {
  $q.dialog({
    title: 'Link to Concept',
    message: 'Enter CONCEPT_CD or NAME_CHAR',
    prompt: {
      model: '',
      type: 'text',
    },
    cancel: true,
  }).onOk((data) => {
    queryConceptsToLink(data)
  })
}

const queryConceptsToLink = async (searchTerm) => {
  try {
    const conceptRepo = dbStore.getRepository('concept')
    if (conceptRepo) {
      const query = `SELECT * FROM CONCEPT_DIMENSION WHERE VALTYPE_CD = 'S' AND (NAME_CHAR LIKE '${searchTerm}%' OR CONCEPT_CD LIKE '${searchTerm}%')`
      const result = await conceptRepo.connection.executeQuery(query)

      if (result.success && result.data && result.data.length > 0) {
        const items = result.data.map((r) => ({
          label: `${r.NAME_CHAR}/${r.CONCEPT_CD}`,
          value: r,
        }))

        $q.dialog({
          title: 'Found Concepts',
          message: 'Select concept to link',
          options: {
            type: 'radio',
            items: items,
          },
          cancel: true,
          persistent: true,
        }).onOk((item) => {
          formData.value.relatedConcept = item.CONCEPT_CD
          onFieldChange()
        })
      } else {
        $q.notify({ type: 'info', message: 'No matching concepts found' })
      }
    }
  } catch (error) {
    logger.error('Failed to query concepts', error)
    $q.notify({ type: 'negative', message: 'Failed to search concepts' })
  }
}

// Preview method
const showPreview = () => {
  previewData.value = JSON.stringify(prepareFinalData(formData.value), null, 2)
  showPreviewDialog.value = true
}

const prepareFinalData = (data) => {
  const result = { ...data }
  const originalCode = result.conceptCode.trim()

  // Don't modify the concept code if it already has a prefix
  if (!originalCode.includes(':')) {
    // Format concept code based on source system
    if (result.sourceSystem === 'LOINC') {
      result.conceptCode = `LID: ${originalCode}`
    } else if (result.sourceSystem === 'SNOMED-CT') {
      result.conceptCode = `SCTID: ${originalCode}`
    } else {
      result.conceptCode = `${result.sourceSystem}: ${originalCode}`
    }
  } else {
    result.conceptCode = originalCode
  }

  // Build the concept path with the original code (without prefix)
  const codeForPath = originalCode.includes(':') ? originalCode.split(':')[1].trim() : originalCode
  result.conceptPath = `${result.conceptPath}\\${codeForPath}`.toUpperCase()
  result.conceptPath = result.conceptPath.replace(/\\\\/g, '\\')

  // Handle null values
  Object.keys(result).forEach((key) => {
    if (result[key] === null || result[key] === 'null') {
      result[key] = 'NULL'
    }
  })

  return result
}

const onSubmit = async () => {
  if (!isFormValid.value) return

  isSaving.value = true
  try {
    const now = new Date().toISOString()
    const finalData = prepareFinalData(formData.value)

    const conceptData = {
      CONCEPT_CD: finalData.conceptCode,
      NAME_CHAR: finalData.name,
      CONCEPT_PATH: finalData.conceptPath,
      CATEGORY_CHAR: finalData.category,
      VALTYPE_CD: finalData.valueType,
      UNIT_CD: finalData.unitCode || null,
      SOURCESYSTEM_CD: finalData.sourceSystem,
      RELATED_CONCEPT: finalData.relatedConcept || null,
      CONCEPT_BLOB: finalData.description || null,
      UPDATE_DATE: now,
      DOWNLOAD_DATE: now,
      IMPORT_DATE: now,
      UPLOAD_ID: 1,
    }

    emit('save', conceptData)

    // Form will be cleared when dialog closes
    dialogVisible.value = false
  } catch {
    // Error handling is done in parent component
  } finally {
    isSaving.value = false
  }
}

// Load options when component mounts
onMounted(() => {
  loadAllOptions()
})
</script>

<style lang="scss" scoped>
.bordered {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
</style>
