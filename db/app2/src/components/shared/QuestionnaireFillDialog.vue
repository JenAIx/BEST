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
                <div class="text-subtitle2">{{ patientName || patientId }}</div>
                <div class="text-caption text-grey-6">Patient ID: {{ patientId }}</div>
              </div>
              <div class="col-auto">
                <q-icon name="event" size="24px" color="secondary" class="q-mr-sm" />
                <div class="text-center">
                  <div class="text-subtitle2">{{ formatVisitDate(visitDate) }}</div>
                  <div class="text-caption text-grey-6">Encounter: {{ encounterNum }}</div>
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
            <div class="text-h6">{{ conceptName }}</div>
            <div class="text-body2 text-grey-6">{{ questionnaire.title || 'Medical Questionnaire' }}</div>
          </div>

          <QuestionnaireRenderer
            :questionnaire="questionnaire"
            :show-patient-field="false"
            :show-submit-button="true"
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
import { useDatabaseStore } from '../../stores/database-store.js'
import { logger } from '../../core/services/logging-service.js'
import QuestionnaireRenderer from '../questionnaire/QuestionnaireRenderer.vue'

const props = defineProps({
  modelValue: Boolean,
  encounterNum: {
    type: [Number, String],
    required: true
  },
  patientId: {
    type: String,
    required: true
  },
  questionnaireBlob: {
    type: String,
    required: true
  },
  conceptCode: {
    type: String,
    default: 'CUSTOM: QUESTIONNAIRE'
  },
  conceptName: {
    type: String,
    default: 'Questionnaire'
  },
  patientName: {
    type: String,
    default: ''
  },
  visitDate: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:modelValue', 'questionnaire-completed', 'close'])

// Composables
const $q = useQuasar()
const questionnaireStore = useQuestionnaireStore()
const databaseStore = useDatabaseStore()

// State
const localShow = ref(false)
const questionnaire = ref(null)
const loading = ref(false)
const loadError = ref(null)
const showSubmissionDialog = ref(false)

// Methods
const loadQuestionnaire = async () => {
  if (!props.questionnaireBlob) {
    loadError.value = 'No questionnaire data provided'
    return
  }

  try {
    loading.value = true
    loadError.value = null

    logger.info('Loading questionnaire from BLOB', {
      encounterNum: props.encounterNum,
      patientId: props.patientId,
      conceptName: props.conceptName,
      blobLength: props.questionnaireBlob.length
    })

    // Parse the questionnaire BLOB directly
    const questionnaireData = JSON.parse(props.questionnaireBlob)

    logger.debug('Parsed questionnaire BLOB', {
      title: questionnaireData.title,
      itemCount: questionnaireData.items?.length || 0,
      hasItems: !!questionnaireData.items,
      topLevelKeys: Object.keys(questionnaireData),
      firstItemType: questionnaireData.items?.[0]?.type,
      firstItemStructure: questionnaireData.items?.[0] ? Object.keys(questionnaireData.items[0]) : null,
      firstItemFull: questionnaireData.items?.[0] || null,
      rawBlobSample: props.questionnaireBlob.substring(0, 500)
    })

    // Fix missing type fields and clear pre-filled values (ensure clean template)
    if (questionnaireData.items) {
      questionnaireData.items.forEach((item, index) => {
        // Clear any pre-filled values to ensure clean template
        item.value = null
        
        // If type is missing, infer it from the item structure
        if (!item.type) {
          if (item.options && item.options.length > 0) {
            // Has options - determine if radio or checkbox
            if (Array.isArray(item.value)) {
              item.type = 'checkbox'
            } else {
              item.type = 'radio'
            }
          } else if (item.label && (item.label.includes('Jahr') || item.label.includes('Punkte') || item.label.includes('Versuch') || item.label.includes('Rechnen'))) {
            // Likely numeric based on German MoCA labels
            item.type = 'number'
          } else {
            // Default to text for unknown items
            item.type = 'text'
          }
          
          logger.debug(`Fixed missing type for item ${index + 1}`, {
            id: item.id,
            label: item.label?.substring(0, 30),
            inferredType: item.type,
            hasOptions: !!item.options,
            optionsCount: item.options?.length || 0,
            clearedValue: item.value
          })
        } else {
          // Type exists, just clear the value
          logger.debug(`Cleared pre-filled value for item ${index + 1}`, {
            id: item.id,
            type: item.type,
            label: item.label?.substring(0, 30),
            previousValue: item.value,
            clearedValue: null
          })
          item.value = null
        }
      })
    }

    // Add questionnaire to store and set as active (like QuestionnairePage.vue)
    const tempCode = `TEMP_${Date.now()}`
    questionnaireStore.questionnaires[tempCode] = questionnaireData
    questionnaireStore.setActiveQuestionnaire(tempCode)
    
    questionnaire.value = questionnaireData

    logger.info('Questionnaire loaded and set active in store', {
      title: questionnaireData.title,
      itemCount: questionnaireData.items?.length || 0,
      storeActiveQuestionnaire: !!questionnaireStore.activeQuestionnaire,
      storeActiveTitle: questionnaireStore.activeQuestionnaire?.title,
      allItemDetails: questionnaireData.items?.map((item, index) => ({
        index,
        id: item.id,
        type: item.type,
        label: item.label?.substring(0, 30),
        hasOptions: !!item.options,
        optionsCount: item.options?.length || 0,
        force: item.force,
        fullItem: item
      })) || []
    })

  } catch (error) {
    logger.error('Failed to load questionnaire from BLOB', error, {
      encounterNum: props.encounterNum,
      patientId: props.patientId,
      blobLength: props.questionnaireBlob?.length || 0
    })
    loadError.value = error.message || 'Failed to parse questionnaire data'
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
    if (newValue && props.questionnaireBlob) {
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
  showSubmissionDialog.value = true

  try {
    logger.info('Submitting questionnaire', {
      patientId: props.patientId,
      encounterNum: props.encounterNum,
      conceptName: props.conceptName,
      responsesCount: results.responses?.length || 0,
    })

    // Get PATIENT_NUM from PATIENT_DIMENSION table using PATIENT_CD
    const patientResult = await databaseStore.executeQuery(
      'SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?',
      [props.patientId]
    )

    if (!patientResult.success || patientResult.data.length === 0) {
      throw new Error(`Patient not found: ${props.patientId}`)
    }

    const patientNum = patientResult.data[0].PATIENT_NUM

    logger.debug('Resolved patient number', {
      patientId: props.patientId,
      patientNum: patientNum,
      encounterNum: props.encounterNum
    })

    // Save questionnaire response using the questionnaire store with correct patientNum
    // Use the specific concept code for this questionnaire instance
    const conceptCode = props.conceptCode || 'CUSTOM: QUESTIONNAIRE'
    
    // Override the concept code in results to use the specific column's concept code
    const modifiedResults = {
      ...results,
      conceptCode: conceptCode
    }
    
    await questionnaireStore.saveQuestionnaireResponse(patientNum, props.encounterNum, modifiedResults)

    // Emit completion event
    emit('questionnaire-completed', {
      patientId: props.patientId,
      encounterNum: props.encounterNum,
      conceptCode: conceptCode,
      conceptName: props.conceptName,
      results: modifiedResults,
    })

    // Close dialog
    localShow.value = false

    logger.info('Questionnaire submitted successfully', {
      patientId: props.patientId,
      encounterNum: props.encounterNum,
    })

  } catch (error) {
    logger.error('Failed to submit questionnaire', error, {
      patientId: props.patientId,
      encounterNum: props.encounterNum,
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
  emit('close')
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
  if (props.modelValue && props.questionnaireBlob) {
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
