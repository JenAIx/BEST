<template>
  <BaseEntityDialog
    v-model="dialogVisible"
    :mode="mode"
    :entity="concept"
    entity-name="Concept"
    icon="science"
    size="lg"
    :loading="isSaving"
    :custom-validator="validateForm"
    @submit="handleSubmit"
    @cancel="handleCancel"
  >
    <template #default="{ formData, isEditMode }">
      <!-- Source System Field (at top for create mode) -->
      <q-select
        v-if="!isEditMode"
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
        :rules="[
          (val) => !!val || 'Concept path is required',
          (val) => val.startsWith('\\') || 'Concept path must start with \\',
          (val) => !val.endsWith('\\') || 'Concept path must not end with \\'
        ]"
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
            <span v-else>{{ formData.sourceSystem || 'CODE' }}</span>:
          </span>
        </div>
        <div class="col">
          <q-input
            v-model="formData.conceptCode"
            label="Concept Code"
            outlined
            dense
            :readonly="isEditMode"
            :hint="isEditMode ? 'Concept code cannot be changed' : 'Unique identifier'"
            :rules="[
              (val) => !!val || 'Concept code is required',
              (val) => isEditMode || val.length >= 3 || 'Concept code must be at least 3 characters'
            ]"
          >
            <template v-slot:append v-if="!isEditMode && formData.sourceSystem === 'SNOMED-CT'">
              <q-icon name="search" @click="handleConceptCodeSearch" class="cursor-pointer">
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
        hint="Human-readable name for the concept"
      >
        <template v-slot:append v-if="!isEditMode && formData.sourceSystem === 'SNOMED-CT'">
          <q-icon name="search" @click="handleConceptNameSearch" class="cursor-pointer">
            <q-tooltip>Search SNOMED concepts</q-tooltip>
          </q-icon>
        </template>
      </q-input>

      <div class="row q-gutter-md">
        <!-- Category Field -->
        <div class="col-12 col-md">
          <q-select
            v-model="formData.category"
            label="Category"
            outlined
            dense
            :options="categoryOptions"
            :rules="[(val) => !!val || 'Category is required']"
            emit-value
            map-options
            hint="Concept category"
          />
        </div>

        <!-- Value Type Field -->
        <div class="col-12 col-md">
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

        <!-- Unit Code Field -->
        <div class="col-12 col-md">
          <q-input
            v-model="formData.unitCode"
            label="Unit Code"
            outlined
            dense
            hint="Unit of measurement (optional, e.g., mg/dL, mmHg)"
          />
        </div>
      </div>

      <!-- Selection Answers (only for S type) -->
      <div v-if="formData.valueType === 'S'" class="q-pa-md bg-grey-1 rounded-borders">
        <div class="text-subtitle2 q-mb-sm">Selection Answers</div>
        <div class="row items-center q-gutter-sm">
          <div v-if="selectionAnswers" class="col">
            <span v-if="selectionAnswers.includes('link:')">
              {{ selectionAnswers }}
              <q-icon name="close" class="cursor-pointer q-ml-sm" @click="unlinkAnswer" />
            </span>
            <span v-else-if="answersCount > 0">
              {{ answersCount }} items
              <q-icon name="edit" size="sm" class="cursor-pointer q-ml-sm" @click="showEditAnswers = true" />
            </span>
            <span v-else>
              No answers defined
            </span>
          </div>
          <div class="col-auto">
            <q-btn
              v-if="!selectionAnswers || !selectionAnswers.includes('link:')"
              flat
              dense
              size="sm"
              icon="add"
              label="Add Answers"
              @click="showEditAnswers = true"
            />
            <q-btn
              v-if="!selectionAnswers || answersCount === 0"
              flat
              dense
              size="sm"
              icon="link"
              label="Link to Existing"
              @click="linkAnswer"
              class="q-ml-sm"
            />
          </div>
        </div>
      </div>

      <!-- Source System Field (for edit mode) -->
      <q-select
        v-if="isEditMode"
        v-model="formData.sourceSystem"
        label="Source System"
        outlined
        dense
        :options="sourceSystemOptions"
        emit-value
        map-options
        hint="Source system (LOINC, ICD10, SNOMED-CT, etc.)"
      />

      <!-- Related Concept Field -->
      <q-input
        v-model="formData.relatedConcept"
        label="Related Concept"
        outlined
        dense
        hint="Related concept code (optional)"
      />

      <!-- Description Field -->
      <q-input
        v-model="formData.description"
        label="Description"
        outlined
        dense
        type="textarea"
        rows="3"
        hint="Additional description or notes (optional)"
      />
    </template>
  </BaseEntityDialog>

  <!-- Path Picker Dialog -->
  <ConceptPathPickerDialog
    v-model="showPathPicker"
    :current-path="localFormData.conceptPath"
    @select="onPathSelected"
  />

  <!-- Edit Answers Dialog -->
  <EditConceptAnswersDialog
    v-model="showEditAnswers"
    :concept-code="localFormData.conceptCode"
    :answers="currentAnswers"
    @save="onAnswersSaved"
  />

  <!-- SNOMED Search Dialog -->
  <SNOMEDSearchDialog
    v-model="showSNOMEDSearch"
    :search-query="snomedSearchQuery"
    @select="onSNOMEDSelected"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import BaseEntityDialog from './shared/BaseEntityDialog.vue'
import ConceptPathPickerDialog from './shared/ConceptPathPickerDialog.vue'
import EditConceptAnswersDialog from './shared/EditConceptAnswersDialog.vue'
import SNOMEDSearchDialog from './shared/SNOMEDSearchDialog.vue'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit'].includes(value)
  },
  concept: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'saved', 'cancelled'])

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()
const dbStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ConceptDialog')

// State
const isSaving = ref(false)
const localFormData = ref({})
const showPathPicker = ref(false)
const showEditAnswers = ref(false)
const showSNOMEDSearch = ref(false)
const snomedSearchQuery = ref('')
const currentAnswers = ref([])
const answersCount = ref(0)

// Options from global settings
const categoryOptions = ref([])
const valueTypeOptions = ref([])
const sourceSystemOptions = ref([])

// Computed
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Helper to parse concept blob
const parseConceptBlob = () => {
  if (localFormData.value.conceptBlob) {
    try {
      const blob = JSON.parse(localFormData.value.conceptBlob)
      if (blob.answers && Array.isArray(blob.answers)) {
        answersCount.value = blob.answers.length
        currentAnswers.value = blob.answers
      }
      return blob
    } catch {
      // Invalid JSON, ignore
    }
  }
  return null
}

const selectionAnswers = computed(() => {
  if (localFormData.value.valueType !== 'S') return null
  
  const blob = parseConceptBlob()
  if (!blob) return null
  
  // Check if it's linked to another concept
  if (blob.linkedAnswersConceptCode) {
    return `link:${blob.linkedAnswersConceptCode}`
  }
  
  if (blob.answers && Array.isArray(blob.answers)) {
    return blob.answers.length > 0
  }
  
  return null
})

// Methods
const validateForm = (formData, isEditMode) => {
  if (!formData.conceptCode || formData.conceptCode.trim() === '') return false
  if (!isEditMode && formData.conceptCode.length < 3) return false
  if (!formData.name || formData.name.trim() === '') return false
  if (!formData.conceptPath || !formData.conceptPath.startsWith('\\')) return false
  if (formData.conceptPath.endsWith('\\')) return false
  if (!formData.category) return false
  if (!formData.valueType) return false
  if (!formData.sourceSystem) return false
  
  return true
}

const loadOptions = async () => {
  try {
    const [categories, valueTypes, sourceSystems] = await Promise.all([
      globalSettingsStore.getConceptCategories(),
      globalSettingsStore.getValueTypes(),
      globalSettingsStore.getSourceSystems()
    ])
    
    categoryOptions.value = categories.map(c => ({
      label: c.label || c.value,
      value: c.value
    }))
    
    valueTypeOptions.value = valueTypes.map(v => ({
      label: v.label || v.value,
      value: v.value
    }))
    
    sourceSystemOptions.value = sourceSystems.map(s => ({
      label: s.label || s.value,
      value: s.value
    }))
  } catch (error) {
    logger.error('Failed to load options', error)
    // Set defaults
    categoryOptions.value = [
      { label: 'Laboratory', value: 'LAB' },
      { label: 'Vital Signs', value: 'VITAL' },
      { label: 'Medication', value: 'MED' },
      { label: 'Diagnosis', value: 'DIAG' }
    ]
    
    valueTypeOptions.value = [
      { label: 'Numeric', value: 'N' },
      { label: 'Text', value: 'T' },
      { label: 'Selection', value: 'S' },
      { label: 'Date', value: 'D' }
    ]
    
    sourceSystemOptions.value = [
      { label: 'LOINC', value: 'LOINC' },
      { label: 'SNOMED-CT', value: 'SNOMED-CT' },
      { label: 'ICD-10', value: 'ICD10' },
      { label: 'Custom', value: 'CUSTOM' }
    ]
  }
}

const onSourceSystemChange = (value) => {
  localFormData.value.sourceSystem = value
}

const onValueTypeChange = (value) => {
  localFormData.value.valueType = value
  if (value !== 'S') {
    // Clear selection-related data
    currentAnswers.value = []
    answersCount.value = 0
  }
}

const onPathSelected = (path) => {
  localFormData.value.conceptPath = path
  showPathPicker.value = false
}

const onAnswersSaved = (answers) => {
  currentAnswers.value = answers
  answersCount.value = answers.length
  
  // Update concept blob
  const blob = localFormData.value.conceptBlob ? JSON.parse(localFormData.value.conceptBlob) : {}
  blob.answers = answers
  delete blob.linkedAnswersConceptCode
  localFormData.value.conceptBlob = JSON.stringify(blob)
  
  showEditAnswers.value = false
}

const linkAnswer = async () => {
  // Show dialog to select concept to link answers from
  const result = await $q.dialog({
    title: 'Link to Existing Answers',
    message: 'Enter the concept code to link answers from:',
    prompt: {
      model: '',
      type: 'text'
    },
    cancel: true,
    persistent: true
  })
  
  if (result) {
    const blob = localFormData.value.conceptBlob ? JSON.parse(localFormData.value.conceptBlob) : {}
    blob.linkedAnswersConceptCode = result
    delete blob.answers
    localFormData.value.conceptBlob = JSON.stringify(blob)
  }
}

const unlinkAnswer = () => {
  const blob = localFormData.value.conceptBlob ? JSON.parse(localFormData.value.conceptBlob) : {}
  delete blob.linkedAnswersConceptCode
  localFormData.value.conceptBlob = JSON.stringify(blob)
}

const handleConceptCodeSearch = () => {
  snomedSearchQuery.value = localFormData.value.conceptCode
  showSNOMEDSearch.value = true
}

const handleConceptNameSearch = () => {
  snomedSearchQuery.value = localFormData.value.name
  showSNOMEDSearch.value = true
}

const onSNOMEDSelected = (concept) => {
  localFormData.value.conceptCode = concept.code
  localFormData.value.name = concept.display
  showSNOMEDSearch.value = false
}

const handleSubmit = async ({ mode, data, changes }) => {
  isSaving.value = true
  
  try {
    const conceptRepo = dbStore.getRepository('concept')
    
    if (mode === 'create') {
      // Prepare create data
      const conceptData = {
        CONCEPT_CD: data.conceptCode,
        CONCEPT_PATH: data.conceptPath,
        NAME_CHAR: data.name,
        CONCEPT_BLOB: data.conceptBlob || null,
        CATEGORY_CHAR: data.category,
        VALTYPE_CD: data.valueType,
        SOURCESYSTEM_CD: data.sourceSystem,
        UNIT_CD: data.unitCode || null,
        RELATED_CONCEPT_CD: data.relatedConcept || null,
        DESCRIPTION: data.description || null
      }
      
      // Check if concept already exists
      const existingConcept = await conceptRepo.findByConceptCode(conceptData.CONCEPT_CD)
      if (existingConcept) {
        throw new Error('Concept code already exists')
      }
      
      // Create concept
      const newConcept = await conceptRepo.createConcept(conceptData)
      
      $q.notify({
        type: 'positive',
        message: 'Concept created successfully',
        position: 'top'
      })
      
      emit('saved', { mode: 'create', concept: newConcept })
      dialogVisible.value = false
      
    } else {
      // Edit mode - prepare update data
      const updateData = {}
      
      if (changes.name) updateData.NAME_CHAR = data.name
      if (changes.conceptPath) updateData.CONCEPT_PATH = data.conceptPath
      if (changes.category) updateData.CATEGORY_CHAR = data.category
      if (changes.valueType) updateData.VALTYPE_CD = data.valueType
      if (changes.sourceSystem) updateData.SOURCESYSTEM_CD = data.sourceSystem
      if (changes.unitCode !== undefined) updateData.UNIT_CD = data.unitCode
      if (changes.relatedConcept !== undefined) updateData.RELATED_CONCEPT_CD = data.relatedConcept
      if (changes.description !== undefined) updateData.DESCRIPTION = data.description
      if (changes.conceptBlob !== undefined) updateData.CONCEPT_BLOB = data.conceptBlob
      
      // Update concept
      const updatedConcept = await conceptRepo.updateConcept(props.concept.CONCEPT_CD, updateData)
      
      $q.notify({
        type: 'positive',
        message: 'Concept updated successfully',
        position: 'top'
      })
      
      emit('saved', { mode: 'edit', concept: updatedConcept })
      dialogVisible.value = false
    }
  } catch (error) {
    logger.error(`Failed to ${mode} concept`, error)
    $q.notify({
      type: 'negative',
      message: error.message || `Failed to ${mode} concept`,
      position: 'top'
    })
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  emit('cancelled')
}

// Initialize concept data for edit mode
watch(() => props.concept, (newConcept) => {
  if (props.mode === 'edit' && newConcept) {
    // Transform concept data to match form fields
    localFormData.value = {
      conceptCode: newConcept.CONCEPT_CD || '',
      name: newConcept.NAME_CHAR || '',
      conceptPath: newConcept.CONCEPT_PATH || '',
      category: newConcept.CATEGORY_CHAR || '',
      valueType: newConcept.VALTYPE_CD || '',
      unitCode: newConcept.UNIT_CD || '',
      sourceSystem: newConcept.SOURCESYSTEM_CD || '',
      relatedConcept: newConcept.RELATED_CONCEPT_CD || '',
      description: newConcept.DESCRIPTION || '',
      conceptBlob: newConcept.CONCEPT_BLOB || ''
    }
  }
}, { immediate: true, deep: true })

// Load options on mount
onMounted(() => {
  loadOptions()
})
</script>
