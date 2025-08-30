<template>
  <q-dialog v-model="localShow" persistent maximized>
    <q-card class="questionnaire-fill-dialog">
      <!-- Header -->
      <q-card-section class="row items-center justify-between q-pa-md bg-primary text-white">
        <div class="text-h6">Complete Questionnaire</div>
        <q-btn flat round icon="close" @click="onCancel" color="white">
          <q-tooltip>Close without saving</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-card-section class="q-pa-md">
        <!-- Patient & Visit Info -->
        <div class="patient-visit-info q-mb-lg">
          <q-card flat bordered class="bg-grey-1">
            <q-card-section class="row items-center">
              <q-icon name="person" size="24px" color="primary" class="q-mr-sm" />
              <div class="col">
                <div class="text-subtitle2">{{ questionnaireFillData?.patientName }}</div>
                <div class="text-caption text-grey-6">Patient ID: {{ questionnaireFillData?.patientId }}</div>
              </div>
              <div class="col-auto">
                <q-icon name="event" size="24px" color="secondary" class="q-mr-sm" />
                <div class="text-center">
                  <div class="text-subtitle2">{{ formatVisitDate(questionnaireFillData?.visitDate) }}</div>
                  <div class="text-caption text-grey-6">Encounter: {{ questionnaireFillData?.encounterNum }}</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="text-center q-py-xl">
          <q-spinner color="primary" size="48px" />
          <div class="text-grey-6 q-mt-md">Loading questionnaire...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="loadError" class="text-center q-py-xl">
          <q-icon name="error" size="64px" color="negative" />
          <div class="text-h6 text-negative q-mt-md">{{ loadError }}</div>
          <div class="text-body2 text-grey-6 q-mt-sm">Unable to load the questionnaire. Please try again.</div>
          <q-btn color="primary" label="Retry" @click="loadQuestionnaire" class="q-mt-md" />
        </div>

        <!-- Questionnaire Form -->
        <div v-else-if="questionnaire">
          <div class="questionnaire-header q-mb-md">
            <div class="text-h6">{{ questionnaireFillData?.conceptName }}</div>
            <div class="text-body2 text-grey-6">{{ questionnaire.title || 'Medical Questionnaire' }}</div>
          </div>

          <QuestionnaireRenderer
            :questionnaire="questionnaire"
            :show-patient-field="false"
            :show-debug-actions="false"
            @submit="onQuestionnaireSubmit"
            @validation-change="onValidationChange"
          />
        </div>
      </q-card-section>

      <!-- Submission Dialog -->
      <q-dialog v-model="showSubmissionDialog" persistent>
        <q-card style="min-width: 300px">
          <q-card-section class="row items-center">
            <q-spinner-dots size="40px" color="primary" />
            <span class="q-ml-sm">Saving questionnaire...</span>
          </q-card-section>
        </q-card>
      </q-dialog>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useQuestionnaireStore } from '../../stores/questionnaire-store.js'
import { logger } from '../../core/services/logging-service.js'
import QuestionnaireRenderer from '../questionnaire/QuestionnaireRenderer.vue'

const props = defineProps({
  modelValue: Boolean,
  questionnaireFillData: {
    type: Object,
    required: true,
    validator: (value) => {
      return value &&
             value.patientId &&
             value.encounterNum &&
             value.conceptCode &&
             value.conceptName
    }
  }
})

const emit = defineEmits(['update:modelValue', 'questionnaire-completed'])

// Composables
const $q = useQuasar()
const questionnaireStore = useQuestionnaireStore()

// State
const localShow = ref(false)
const questionnaire = ref(null)
const loading = ref(false)
const loadError = ref(null)
const showSubmissionDialog = ref(false)

// Methods
const loadQuestionnaire = async () => {
  if (!props.questionnaireFillData) {
    loadError.value = 'No questionnaire data provided'
    return
  }

  try {
    loading.value = true
    loadError.value = null

    logger.info('Loading questionnaire for concept', {
      conceptCode: props.questionnaireFillData.conceptCode,
      conceptName: props.questionnaireFillData.conceptName,
      hasExistingType: !!props.questionnaireFillData.existingQuestionnaireType,
    })

    // Strategy 1: Use existing questionnaire type from observations (preferred)
    if (props.questionnaireFillData.existingQuestionnaireType) {
      logger.info('Using existing questionnaire type from observations', {
        title: props.questionnaireFillData.existingQuestionnaireType.title,
        itemCount: props.questionnaireFillData.existingQuestionnaireType.items?.length || 0,
      })

      questionnaire.value = {
        title: props.questionnaireFillData.existingQuestionnaireType.title,
        short_title: props.questionnaireFillData.existingQuestionnaireType.shortTitle,
        items: props.questionnaireFillData.existingQuestionnaireType.items,
        // Add default properties that might be expected
        description: `Questionnaire: ${props.questionnaireFillData.existingQuestionnaireType.title}`,
        coding: {
          system: 'CUSTOM',
          code: props.questionnaireFillData.conceptCode,
          display: props.questionnaireFillData.existingQuestionnaireType.title
        }
      }

      return
    }

    // Strategy 2: Fall back to questionnaire store (original logic)
    logger.info('No existing questionnaire type found, falling back to questionnaire store')

    // Load questionnaires if not already loaded
    if (!questionnaireStore.questionnaires || Object.keys(questionnaireStore.questionnaires).length === 0) {
      logger.info('Loading questionnaires from database...')
      await questionnaireStore.loadQuestionnaires()
    }

    // Get questionnaire templates from store
    const templates = Object.values(questionnaireStore.questionnaires || {})

    logger.info('Questionnaire store status', {
      questionnairesLoaded: !!questionnaireStore.questionnaires,
      questionnaireCount: Object.keys(questionnaireStore.questionnaires || {}).length,
      templatesFound: templates.length,
      questionnaireKeys: Object.keys(questionnaireStore.questionnaires || {})
    })

    logger.debug('Available questionnaires', {
      count: templates.length,
      templates: templates.map(t => ({ code: t.code, title: t.title }))
    })

    // Find the questionnaire that matches our concept
    // Try multiple matching strategies
    let matchingQuestionnaire = null

    // Strategy 1: Exact match by concept code
    matchingQuestionnaire = templates.find(q =>
      q.conceptCode === props.questionnaireFillData.conceptCode ||
      q.code === props.questionnaireFillData.conceptCode
    )

    // Strategy 2: Match by name/title (case-insensitive partial match)
    if (!matchingQuestionnaire) {
      const searchTerm = props.questionnaireFillData.conceptName.toLowerCase()
      matchingQuestionnaire = templates.find(q => {
        const title = (q.title || '').toLowerCase()
        const name = (q.name || '').toLowerCase()
        const displayName = (q._metadata?.displayName || '').toLowerCase()

        return title.includes(searchTerm) ||
               name.includes(searchTerm) ||
               displayName.includes(searchTerm) ||
               searchTerm.includes(title) ||
               searchTerm.includes(name)
      })
    }

    // Strategy 3: First available questionnaire as fallback
    if (!matchingQuestionnaire && templates.length > 0) {
      matchingQuestionnaire = templates[0]
      logger.warn('No exact questionnaire match found, using first available questionnaire as fallback', {
        requestedConcept: props.questionnaireFillData.conceptName,
        fallbackQuestionnaire: matchingQuestionnaire.title || matchingQuestionnaire._metadata?.displayName
      })
    }

    if (!matchingQuestionnaire) {
      // List available questionnaires for debugging
      const availableQuestionnaires = templates.map(q => ({
        code: q.code,
        title: q.title,
        displayName: q._metadata?.displayName
      }))

      logger.error('No questionnaire found', {
        requestedConceptCode: props.questionnaireFillData.conceptCode,
        requestedConceptName: props.questionnaireFillData.conceptName,
        availableQuestionnaires: availableQuestionnaires
      })

      throw new Error(`No questionnaire template found for concept: ${props.questionnaireFillData.conceptName}. Available questionnaires: ${availableQuestionnaires.map(q => q.title || q.displayName).join(', ')}`)
    }

    questionnaire.value = matchingQuestionnaire

    logger.info('Questionnaire loaded successfully', {
      conceptCode: props.questionnaireFillData.conceptCode,
      questionnaireTitle: matchingQuestionnaire.title,
    })

  } catch (error) {
    logger.error('Failed to load questionnaire', error, {
      conceptCode: props.questionnaireFillData.conceptCode,
    })
    loadError.value = error.message || 'Failed to load questionnaire'
  } finally {
    loading.value = false
  }
}

// Initialize with modelValue
localShow.value = props.modelValue || false

// Watch for external model changes
watch(
  () => props.modelValue,
  (newValue) => {
    localShow.value = newValue
    if (newValue && props.questionnaireFillData) {
      loadQuestionnaire()
    }
  },
  { immediate: true }
)

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})

const onQuestionnaireSubmit = async ({ results }) => {
  if (!props.questionnaireFillData) {
    $q.notify({
      type: 'negative',
      message: 'Missing questionnaire data',
    })
    return
  }

  showSubmissionDialog.value = true

  try {
    const { patientId, encounterNum, conceptCode, conceptName } = props.questionnaireFillData

    logger.info('Submitting questionnaire', {
      patientId,
      encounterNum,
      conceptCode,
      conceptName,
      responsesCount: results.responses?.length || 0,
    })

    // Save the questionnaire response
    await questionnaireStore.saveQuestionnaireResponse(patientId, encounterNum, results)

    // Emit completion event
    emit('questionnaire-completed', {
      patientId,
      encounterNum,
      conceptCode,
      conceptName,
      results,
    })

    // Close dialog
    localShow.value = false

    logger.info('Questionnaire submitted successfully', {
      patientId,
      encounterNum,
      conceptCode,
    })

  } catch (error) {
    logger.error('Failed to submit questionnaire', error, {
      patientId: props.questionnaireFillData.patientId,
      encounterNum: props.questionnaireFillData.encounterNum,
      conceptCode: props.questionnaireFillData.conceptCode,
    })

    $q.notify({
      type: 'negative',
      message: `Failed to submit questionnaire: ${error.message}`,
      timeout: 5000,
    })
  } finally {
    showSubmissionDialog.value = false
  }
}

const onValidationChange = (isValid) => {
  // Handle validation state if needed
  logger.debug('Questionnaire validation changed', { isValid })
}

const onCancel = () => {
  localShow.value = false
}

const formatVisitDate = (date) => {
  if (!date) return 'Unknown date'

  try {
    const visitDate = new Date(date)
    const now = new Date()
    const diffTime = now - visitDate
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `Today, ${visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 1) {
      return `Yesterday, ${visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays < 7) {
      return `${diffDays} days ago, ${visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return visitDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  } catch {
    return date.toString()
  }
}

// Load questionnaire when component mounts (if data is available)
onMounted(() => {
  if (props.modelValue && props.questionnaireFillData) {
    loadQuestionnaire()
  }
})
</script>

<style scoped>
.questionnaire-fill-dialog {
  min-height: 80vh;
  max-height: 90vh;
}

.patient-visit-info {
  margin-bottom: 1.5rem;
}

.questionnaire-header {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .questionnaire-fill-dialog {
    margin: 8px;
    min-height: calc(100vh - 16px);
    max-height: calc(100vh - 16px);
  }

  .patient-visit-info .row {
    flex-direction: column;
    gap: 1rem;
  }

  .patient-visit-info .col-auto {
    text-align: center;
  }
}
</style>
