<template>
  <AppInputDialog
    v-model="dialogVisible"
    title="Edit Concept"
    ok-label="Save Changes"
    cancel-label="Cancel"
    :loading="isSaving"
    :disable-ok="!isFormValid || !hasChanges"
    @ok="onSubmit"
    @cancel="onCancel"
    size="lg"
  >
    <q-form @submit.prevent="onSubmit" class="q-gutter-md">
      <!-- Concept Code Field (readonly) -->
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
          <q-input v-model="formData.conceptCode" label="Concept Code" outlined dense readonly hint="Concept code cannot be changed" />
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

      <div class="row">
      <!-- Category Field -->
       <div class="col-4">
      <q-select v-model="formData.category" label="Category" outlined dense :options="categoryOptions" @update:model-value="onFieldChange" hint="Concept category" />
    </div>
      <!-- Value Type Field -->
       <div class="col-4">
      <q-select v-model="formData.valueType" label="Value Type" outlined dense :options="valueTypeOptions" @update:model-value="onValueTypeChange" hint="Type of value " />
    </div>
    <div class="col-4">
            <!-- Unit Code Field -->
            <q-input v-model="formData.unitCode" label="Unit Code" outlined dense @update:model-value="onFieldChange" hint="Unit of measurement (optional, e.g., mg/dL, mmHg)" />

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

      <!-- Source System Field -->
      <q-select
        v-model="formData.sourceSystem"
        label="Source System"
        outlined
        dense
        :options="sourceSystemOptions"
        @update:model-value="onFieldChange"
        hint="Source system (LOINC, ICD10, SNOMED-CT, etc.)"
      />

      <!-- Related Concept Field -->
      <q-input v-model="formData.relatedConcept" label="Related Concept" outlined dense @update:model-value="onFieldChange" hint="Related concept code (optional)" />

      <!-- Description Field -->
      <q-input v-model="formData.description" label="Description" outlined dense type="textarea" rows="3" @update:model-value="onFieldChange" hint="Detailed description of the concept" />
    </q-form>
  </AppInputDialog>

  <!-- Path Picker Dialog -->
  <PathPickerDialog v-if="showPathPicker" v-model="showPathPicker" :current-path="formData.conceptPath" @save="updateConceptPath" />

  <!-- Edit Answers Dialog -->
  <EditConceptAnswersDialog v-if="showEditAnswers" v-model="showEditAnswers" :concept="formData" />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
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
const logger = loggingStore.createLogger('ConceptEditDialog')

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  concept: {
    type: Object,
    default: () => ({}),
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
  // Original values for change detection
  originalName: '',
  originalConceptPath: '',
  originalCategory: '',
  originalValueType: '',
  originalUnitCode: '',
  originalSourceSystem: '',
  originalRelatedConcept: '',
  originalDescription: '',
})

const isSaving = ref(false)

// Dialog states
const showPathPicker = ref(false)
const showEditAnswers = ref(false)

// Selection answers state
const answersCount = ref(0)

// Options loaded from global settings store
const categoryOptions = ref([])
const valueTypeOptions = ref([])
const sourceSystemOptions = ref([])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Computed properties
const isFormValid = computed(() => {
  return formData.value.name.trim() !== '' && formData.value.conceptPath.trim() !== ''
})

const hasChanges = computed(() => {
  return (
    formData.value.name !== formData.value.originalName ||
    formData.value.conceptPath !== formData.value.originalConceptPath ||
    formData.value.category !== formData.value.originalCategory ||
    formData.value.valueType !== formData.value.originalValueType ||
    formData.value.unitCode !== formData.value.originalUnitCode ||
    formData.value.sourceSystem !== formData.value.originalSourceSystem ||
    formData.value.relatedConcept !== formData.value.originalRelatedConcept ||
    formData.value.description !== formData.value.originalDescription
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

const onValueTypeChange = (value) => {
  formData.value.valueType = value
  if (value === 'S' && formData.value.conceptPath && formData.value.conceptCode) {
    // Load answers count for selection type
    loadAnswersCount()
  }
  onFieldChange()
}

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

const onCancel = () => {
  dialogVisible.value = false
  emit('cancel')
}

const onSubmit = async () => {
  if (!isFormValid.value || !hasChanges.value) return

  isSaving.value = true
  try {
    const updateData = {}

    if (formData.value.name !== formData.value.originalName) {
      updateData.NAME_CHAR = formData.value.name
    }

    if (formData.value.conceptPath !== formData.value.originalConceptPath) {
      updateData.CONCEPT_PATH = formData.value.conceptPath
    }

    if (formData.value.category !== formData.value.originalCategory) {
      updateData.CATEGORY_CHAR = formData.value.category
    }

    if (formData.value.valueType !== formData.value.originalValueType) {
      updateData.VALTYPE_CD = formData.value.valueType
    }

    if (formData.value.unitCode !== formData.value.originalUnitCode) {
      updateData.UNIT_CD = formData.value.unitCode
    }

    if (formData.value.sourceSystem !== formData.value.originalSourceSystem) {
      updateData.SOURCESYSTEM_CD = formData.value.sourceSystem
    }

    if (formData.value.relatedConcept !== formData.value.originalRelatedConcept) {
      updateData.RELATED_CONCEPT = formData.value.relatedConcept
    }

    if (formData.value.description !== formData.value.originalDescription) {
      updateData.CONCEPT_BLOB = formData.value.description
    }

    // Add update timestamp
    updateData.UPDATE_DATE = new Date().toISOString()

    emit('save', updateData)

    // Update original values after successful save
    formData.value.originalName = formData.value.name
    formData.value.originalConceptPath = formData.value.conceptPath
    formData.value.originalCategory = formData.value.category
    formData.value.originalValueType = formData.value.valueType
    formData.value.originalUnitCode = formData.value.unitCode
    formData.value.originalSourceSystem = formData.value.sourceSystem
    formData.value.originalRelatedConcept = formData.value.relatedConcept
    formData.value.originalDescription = formData.value.description

    dialogVisible.value = false
  } catch {
    // Error handling is done in parent component
  } finally {
    isSaving.value = false
  }
}

// Watch for concept prop changes and initialize form
watch(
  () => props.concept,
  async (newConcept) => {
    if (newConcept && Object.keys(newConcept).length > 0) {
      formData.value.conceptCode = newConcept.CONCEPT_CD || ''
      formData.value.name = newConcept.NAME_CHAR || ''
      formData.value.conceptPath = newConcept.CONCEPT_PATH || ''
      formData.value.category = newConcept.CATEGORY_CHAR || ''
      formData.value.valueType = newConcept.VALTYPE_CD || ''
      formData.value.unitCode = newConcept.UNIT_CD || ''
      formData.value.sourceSystem = newConcept.SOURCESYSTEM_CD || ''
      formData.value.relatedConcept = newConcept.RELATED_CONCEPT || ''
      formData.value.description = newConcept.CONCEPT_BLOB || ''

      // Store original values
      formData.value.originalName = newConcept.NAME_CHAR || ''
      formData.value.originalConceptPath = newConcept.CONCEPT_PATH || ''
      formData.value.originalCategory = newConcept.CATEGORY_CHAR || ''
      formData.value.originalValueType = newConcept.VALTYPE_CD || ''
      formData.value.originalUnitCode = newConcept.UNIT_CD || ''
      formData.value.originalSourceSystem = newConcept.SOURCESYSTEM_CD || ''
      formData.value.originalRelatedConcept = newConcept.RELATED_CONCEPT || ''
      formData.value.originalDescription = newConcept.CONCEPT_BLOB || ''

      // Load all options if not already loaded
      if (categoryOptions.value.length === 0 || valueTypeOptions.value.length === 0 || sourceSystemOptions.value.length === 0) {
        await loadAllOptions()
      }

      // Load answers count if it's a selection type
      if (newConcept.VALTYPE_CD === 'S') {
        loadAnswersCount()
      }
    }
  },
  { immediate: true },
)
</script>
