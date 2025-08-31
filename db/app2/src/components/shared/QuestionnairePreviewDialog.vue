<template>
  <AppDialog v-model="localShow" :title="dialogTitle" :subtitle="dialogSubtitle" size="full" :show-ok="false" cancel-label="Close" :content-padding="false" @cancel="onClose">
    <div class="q-pa-md">
      <!-- Loading State -->
      <div v-if="loading" class="text-center q-py-xl">
        <q-spinner color="primary" size="48px" />
        <div class="text-grey-6 q-mt-md">Loading questionnaire data...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="text-center q-py-xl">
        <q-icon name="error" size="64px" color="negative" />
        <div class="text-h6 text-negative q-mt-md">{{ loadError }}</div>
        <div class="text-body2 text-grey-6">Please try again or contact support if the problem persists.</div>
      </div>

      <!-- Content -->
      <div v-else-if="questionnaire">
        <!-- Use CompletedQuestionnaireView for completed questionnaire results -->
        <CompletedQuestionnaireView v-if="isCompletedQuestionnaire" :results="questionnaire" :completion-date="completionDate" />
        <!-- Use PreviewSurveyTemplate for questionnaire templates -->
        <PreviewSurveyTemplate v-else :questionnaire="questionnaire" />
      </div>

      <!-- No Data State -->
      <div v-else class="text-center q-py-xl">
        <q-icon name="quiz" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-md">No questionnaire data available</div>
      </div>
    </div>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from './AppDialog.vue'
import PreviewSurveyTemplate from '../questionnaire/PreviewSurveyTemplate.vue'
import CompletedQuestionnaireView from '../questionnaire/CompletedQuestionnaireView.vue'

const props = defineProps({
  modelValue: Boolean,

  // For global settings context (JSON string)
  jsonContent: {
    type: String,
    default: null,
  },

  // For observation context (parsed object)
  questionnaireData: {
    type: Object,
    default: null,
  },

  // Additional context for observations
  observationId: {
    type: [String, Number],
    default: null,
  },
  conceptName: {
    type: String,
    default: null,
  },
  completionDate: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

// Initialize stores
const loggingStore = useLoggingStore()

// Local state - initialize with modelValue
const localShow = ref(props.modelValue || false)

// State for loading questionnaire data
const questionnaire = ref(null)
const loading = ref(false)
const loadError = ref(null)

// Load questionnaire data based on context
const loadQuestionnaireData = async () => {
  // If we have questionnaireData (observation context), use it directly
  if (props.questionnaireData) {
    questionnaire.value = props.questionnaireData
    return
  }

  // If we have jsonContent (global settings context), parse it
  if (props.jsonContent) {
    try {
      questionnaire.value = JSON.parse(props.jsonContent)
      return
    } catch {
      loadError.value = 'Failed to parse questionnaire JSON'
      return
    }
  }

  // If we have observationId, fetch the data from database
  if (props.observationId) {
    await loadQuestionnaireFromObservation()
    return
  }

  loadError.value = 'No questionnaire data provided'
}

// Load questionnaire data from observation BLOB
const loadQuestionnaireFromObservation = async () => {
  if (!props.observationId) return

  try {
    loading.value = true
    loadError.value = null

    const dbStore = useDatabaseStore()
    const result = await dbStore.executeQuery('SELECT OBSERVATION_BLOB FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [props.observationId])

    if (result.success && result.data.length > 0 && result.data[0].OBSERVATION_BLOB) {
      questionnaire.value = JSON.parse(result.data[0].OBSERVATION_BLOB)
    } else {
      loadError.value = 'No questionnaire data found for this observation'
    }
  } catch (error) {
    loggingStore.error('QuestionnairePreviewDialog', 'Failed to load questionnaire data', error, {
      observationId: props.observationId,
      conceptName: props.conceptName
    })
    loadError.value = 'Failed to load questionnaire data'
  } finally {
    loading.value = false
  }
}

const dialogTitle = computed(() => {
  if (props.observationId) {
    return 'Questionnaire Response'
  }
  return 'Questionnaire Preview'
})

const dialogSubtitle = computed(() => {
  if (props.observationId && props.conceptName) {
    const dateStr = props.completionDate ? new Date(props.completionDate).toLocaleDateString() : 'Unknown date'
    return `${props.conceptName} - Completed on ${dateStr}`
  }
  return 'Interactive preview of how this questionnaire appears to users'
})

// Detect if this is a completed questionnaire (has response values) vs a template
const isCompletedQuestionnaire = computed(() => {
  if (!questionnaire.value) return false

  // Check if this has completed response data
  return questionnaire.value.items && questionnaire.value.items.length > 0 && questionnaire.value.items[0].value !== undefined
})

// Methods
const onClose = () => {
  localShow.value = false
  emit('close')
}

// Watch for external model changes
watch(
  () => props.modelValue,
  async (newValue) => {
    localShow.value = newValue
    if (newValue) {
      // Reset state when opening
      questionnaire.value = null
      loadError.value = null
      await loadQuestionnaireData()
    }
  },
  { immediate: true }
)

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})
</script>
