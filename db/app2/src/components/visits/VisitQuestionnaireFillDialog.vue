<template>
  <q-dialog v-model="localShow" persistent maximized>
    <q-card class="questionnaire-fill-dialog">
      <!-- Header -->
      <q-card-section class="row items-center justify-between q-pa-md" :class="isReadOnly ? 'bg-positive text-white' : 'bg-purple text-white'">
        <div>
          <div class="text-h6">
            <q-icon :name="isReadOnly ? 'lock' : 'edit_note'" class="q-mr-sm" />
            {{ isReadOnly ? 'Fragebogen anzeigen' : 'Fragebogen ausfüllen' }}
          </div>
          <div class="text-caption" style="opacity: 0.8">{{ questionnaireTitle }}</div>
        </div>
        <q-btn flat round icon="close" @click="onCancel" color="white" title="Schließen" />
      </q-card-section>

      <!-- Patient & Visit Info -->
      <q-card-section class="q-pa-md q-pb-none">
        <q-card flat bordered class="bg-grey-1">
          <q-card-section class="row items-center q-pa-sm">
            <q-icon name="person" size="20px" color="primary" class="q-mr-sm" />
            <div class="col">
              <div class="text-subtitle2">{{ patientName }}</div>
              <div class="text-caption text-grey-6">Patient ID: {{ patientId }}</div>
            </div>
            <div class="col-auto">
              <q-icon name="event" size="20px" color="secondary" class="q-mr-xs" />
              <span class="text-caption">{{ visitDate }}</span>
            </div>
          </q-card-section>
        </q-card>

        <!-- Auto-prefill notice -->
        <q-banner v-if="prefillCount > 0 && !isReadOnly" class="bg-blue-1 text-primary q-mt-sm" rounded dense>
          <template v-slot:avatar>
            <q-icon name="auto_fix_high" color="primary" />
          </template>
          {{ prefillCount }} Felder wurden aus Visitendaten vorausgefüllt
          <template v-slot:action>
            <q-btn flat dense color="primary" label="Anzeigen" @click="highlightPrefilled = !highlightPrefilled" />
          </template>
        </q-banner>

        <!-- Completed/Locked banner -->
        <q-banner v-if="isReadOnly" class="bg-green-1 text-positive q-mt-sm" rounded dense>
          <template v-slot:avatar>
            <q-icon name="lock" color="positive" />
          </template>
          Dieser Fragebogen wurde abgeschlossen und gesperrt.
          <span v-if="completedScore !== null" class="text-weight-bold q-ml-sm">Score: {{ completedScore }}</span>
        </q-banner>
      </q-card-section>

      <q-card-section class="q-pa-md">
        <!-- Loading State -->
        <div v-if="loading" class="text-center q-py-xl">
          <q-spinner color="primary" size="48px" />
          <div class="text-grey-6 q-mt-md">Fragebogen wird geladen...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="loadError" class="text-center q-py-xl">
          <q-icon name="error" size="64px" color="negative" />
          <div class="text-h6 text-negative q-mt-md">{{ loadError }}</div>
          <q-btn color="primary" label="Erneut versuchen" @click="initQuestionnaire" class="q-mt-md" />
        </div>

        <!-- Read-Only View (completed questionnaire) -->
        <div v-else-if="isReadOnly && completedData">
          <CompletedQuestionnaireView v-if="completedData" :results="completedData" />
        </div>

        <!-- Questionnaire Form (editable) -->
        <div v-else-if="questionnaire">
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
            <span class="q-ml-sm">Fragebogen wird gespeichert...</span>
          </q-card-section>
        </q-card>
      </q-dialog>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useQuestionnaireStore } from 'src/stores/questionnaire-store'
import { useObservationStore } from 'src/stores/observation-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import QuestionnaireRenderer from 'src/components/questionnaire/QuestionnaireRenderer.vue'
import CompletedQuestionnaireView from 'src/components/questionnaire/CompletedQuestionnaireView.vue'

const props = defineProps({
  modelValue: Boolean,
  visit: {
    type: Object,
    required: true,
  },
  patient: {
    type: Object,
    required: true,
  },
  // For new questionnaire (from selection)
  questionnaireCode: {
    type: String,
    default: null,
  },
  // For existing questionnaire (from observation)
  observationId: {
    type: [Number, String],
    default: null,
  },
  observationBlob: {
    type: String,
    default: null,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'questionnaire-saved', 'questionnaire-completed', 'close'])

const notify = useNotify()
const questionnaireStore = useQuestionnaireStore()
const observationStore = useObservationStore()
const databaseStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitQuestionnaireFillDialog')

// State
const localShow = ref(false)
const questionnaire = ref(null)
const loading = ref(false)
const loadError = ref(null)
const showSubmissionDialog = ref(false)
const prefillCount = ref(0)
const highlightPrefilled = ref(false)
const completedData = ref(null)
const completedScore = ref(null)

// Computed
const isReadOnly = computed(() => props.isCompleted)

const questionnaireTitle = computed(() => {
  if (completedData.value) return completedData.value.title || 'Fragebogen'
  if (questionnaire.value) return questionnaire.value.title || 'Fragebogen'
  return 'Fragebogen'
})

const patientName = computed(() => {
  const p = props.patient
  if (!p) return ''
  return p.PATIENT_CD || p.id || ''
})

const patientId = computed(() => {
  const p = props.patient
  return p?.PATIENT_CD || p?.id || ''
})

const visitDate = computed(() => {
  const v = props.visit
  if (!v) return ''
  const d = v.date || v.rawData?.START_DATE
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('de-DE', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return d
  }
})

// Sync localShow with modelValue
watch(
  () => props.modelValue,
  async (newValue, oldValue) => {
    localShow.value = newValue
    if (newValue && !oldValue) {
      try {
        await initQuestionnaire()
      } catch (err) {
        logger.error('Failed to init questionnaire', err)
        loadError.value = err.message || 'Fehler beim Laden'
        loading.value = false
      }
    }
  },
)

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})

// Initialize on mount if already visible
onMounted(async () => {
  if (props.modelValue) {
    localShow.value = true
    try {
      await initQuestionnaire()
    } catch (err) {
      logger.error('Failed to init questionnaire on mount', err)
      loadError.value = err.message || 'Fehler beim Laden'
      loading.value = false
    }
  }
})

// Methods

/**
 * Initialize: load questionnaire template and auto-prefill
 */
const initQuestionnaire = async () => {
  loading.value = true
  loadError.value = null
  prefillCount.value = 0

  try {
    // Case 1: View completed questionnaire
    if (props.isCompleted && props.observationBlob) {
      const data = JSON.parse(props.observationBlob)
      completedData.value = data
      completedScore.value = extractScore(data)
      logger.info('Loaded completed questionnaire for viewing', { title: data.title })
      return
    }

    // Ensure questionnaires are loaded in store
    if (questionnaireStore.questionnaireList.length === 0) {
      await questionnaireStore.loadQuestionnaires()
    }

    // Case 2: Resume incomplete questionnaire (has observationBlob with _status=pending)
    if (props.observationBlob) {
      const savedData = JSON.parse(props.observationBlob)

      if (savedData._questionnaireCode) {
        const template = questionnaireStore.getQuestionnaire(savedData._questionnaireCode)
        if (template) {
          await setupQuestionnaireFromTemplate(template, savedData._questionnaireCode, savedData._savedResponses)
          return
        }
        logger.warn('Questionnaire template not found in store', { code: savedData._questionnaireCode })
      }
    }

    // Case 3: New questionnaire from code
    if (props.questionnaireCode) {
      const template = questionnaireStore.getQuestionnaire(props.questionnaireCode)
      if (!template) {
        throw new Error(`Fragebogen "${props.questionnaireCode}" nicht gefunden`)
      }

      await setupQuestionnaireFromTemplate(template, props.questionnaireCode)
      return
    }

    throw new Error('Keine Fragebogen-Daten verfügbar')
  } catch (error) {
    logger.error('Failed to initialize questionnaire', error)
    loadError.value = error.message || 'Fehler beim Laden des Fragebogens'
  } finally {
    loading.value = false
  }
}

/**
 * Setup questionnaire from a template and auto-prefill from visit observations
 */
const setupQuestionnaireFromTemplate = async (template, code, savedResponses = null) => {
  // Deep clone to avoid mutating store
  const qData = JSON.parse(JSON.stringify(template))

  // Clear values for clean fill
  if (qData.items) {
    qData.items.forEach((item) => {
      item.value = null
    })
  }

  // Set active in store
  const tempCode = `VISIT_${Date.now()}`
  questionnaireStore.questionnaires[tempCode] = qData
  questionnaireStore.setActiveQuestionnaire(tempCode)

  // Restore saved responses if resuming
  if (savedResponses) {
    Object.entries(savedResponses).forEach(([itemId, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        questionnaireStore.updateResponse(itemId, value)
      }
    })
    logger.info('Restored saved responses', { count: Object.keys(savedResponses).length })
  }

  // Auto-prefill from visit observations
  await autoPrefillFromVisit(qData)

  questionnaire.value = qData
  logger.info('Questionnaire setup complete', { code, title: qData.title, prefillCount: prefillCount.value })
}

/**
 * Auto-prefill questionnaire fields from existing visit observations
 * Matches by CONCEPT_CD between observation.conceptCode and item.coding.code
 */
const autoPrefillFromVisit = async (qData) => {
  if (!qData.items || !observationStore.observations) return

  const observations = observationStore.observations
  let filled = 0

  for (const item of qData.items) {
    if (!item.coding || !item.coding.code) continue

    const itemConceptCode = item.coding.code

    // Find matching observation by CONCEPT_CD
    const matchingObs = observations.find((obs) => {
      if (!obs.conceptCode) return false

      // Exact match
      if (obs.conceptCode === itemConceptCode) return true

      // Flexible match: extract code part and compare
      const obsCode = extractConceptCode(obs.conceptCode)
      const itemCode = extractConceptCode(itemConceptCode)
      if (obsCode && itemCode && obsCode === itemCode) return true

      return false
    })

    if (matchingObs) {
      // Determine value based on observation
      const value = matchingObs.numericValue !== null && matchingObs.numericValue !== undefined
        ? matchingObs.numericValue
        : matchingObs.value || matchingObs.originalValue

      if (value !== null && value !== undefined && value !== '') {
        // Map to appropriate questionnaire item format
        const mappedValue = mapObservationValueToItem(item, value)

        if (mappedValue !== null) {
          const itemId = item.type === 'multiple_radio' && Array.isArray(item.id) ? item.id[0] : item.id
          questionnaireStore.updateResponse(itemId, mappedValue)
          item._prefilled = true
          filled++

          logger.debug('Auto-prefilled field', {
            itemId: item.id,
            itemLabel: item.label,
            conceptCode: itemConceptCode,
            obsConceptCode: matchingObs.conceptCode,
            value: mappedValue,
          })
        }
      }
    }
  }

  prefillCount.value = filled
  if (filled > 0) {
    logger.info(`Auto-prefilled ${filled} fields from visit observations`)
  }
}

/**
 * Extract the core code from a CONCEPT_CD (e.g., "SCTID: 302199004" → "302199004")
 */
const extractConceptCode = (code) => {
  if (!code) return null
  const match = code.match(/[:\s]?\s*([0-9A-Za-z-]+)$/)
  return match ? match[1] : code
}

/**
 * Map an observation value to the appropriate questionnaire item format
 */
const mapObservationValueToItem = (item, value) => {
  switch (item.type) {
    case 'number':
    case 'slider': {
      const num = parseFloat(value)
      return isNaN(num) ? null : num
    }
    case 'radio': {
      // Try to match value to one of the options
      if (item.options) {
        const match = item.options.find(
          (opt) => opt.value === value || opt.value === String(value) || opt.label === value,
        )
        return match ? match.value : value
      }
      return value
    }
    case 'checkbox': {
      return Array.isArray(value) ? value : [value]
    }
    case 'date':
    case 'date_year':
      return value
    case 'text':
    case 'textarea':
      return String(value)
    default:
      return value
  }
}

/**
 * Extract score from completed questionnaire data
 */
const extractScore = (data) => {
  if (!data) return null
  if (data.results && Array.isArray(data.results) && data.results.length > 0) {
    return data.results[0].value
  }
  return null
}

/**
 * Handle questionnaire submission
 */
const onQuestionnaireSubmit = async ({ results }) => {
  showSubmissionDialog.value = true

  try {
    const patientNum = props.patient.PATIENT_NUM
    const encounterNum = props.visit.id || props.visit.encounterNum

    logger.info('Submitting questionnaire', {
      patientNum,
      encounterNum,
      title: results.title,
      questionnaireCode: results.questionnaire_code,
    })

    // If this was a pending observation, delete it first
    if (props.observationId) {
      try {
        await databaseStore.executeQuery('DELETE FROM OBSERVATION_FACT WHERE OBSERVATION_ID = ?', [props.observationId])
        logger.info('Deleted pending questionnaire observation', { observationId: props.observationId })
      } catch (err) {
        logger.warn('Failed to delete pending observation, continuing', err)
      }
    }

    // Save the completed questionnaire using the standard mechanism
    await questionnaireStore.saveQuestionnaireResponse(patientNum, encounterNum, results)

    // Reload observations for the visit
    await visitObservationService.selectVisitAndLoadObservations(props.visit)

    emit('questionnaire-completed', {
      questionnaireCode: results.questionnaire_code,
      title: results.title,
      results,
    })

    localShow.value = false

    notify.success(`Fragebogen "${results.title}" erfolgreich gespeichert und abgeschlossen`)

    logger.info('Questionnaire saved and completed', {
      title: results.title,
      questionnaireCode: results.questionnaire_code,
    })
  } catch (error) {
    logger.error('Failed to submit questionnaire', error)
    notify.error(`Fehler beim Speichern: ${error.message}`, { timeout: 5000 })
  } finally {
    showSubmissionDialog.value = false
  }
}

const onValidationChange = (isValid) => {
  logger.debug('Questionnaire validation changed', { isValid })
}

const onCancel = () => {
  // For incomplete questionnaires, save current state before closing
  if (!isReadOnly.value && questionnaire.value && props.observationId) {
    savePendingState()
  }
  localShow.value = false
  emit('close')
}

/**
 * Save partial progress to the pending observation
 */
const savePendingState = async () => {
  try {
    const responses = { ...questionnaireStore.currentResponses }
    const blob = JSON.stringify({
      _status: 'pending',
      _questionnaireCode: props.questionnaireCode,
      _savedResponses: responses,
      _lastSaved: new Date().toISOString(),
      title: questionnaire.value?.title,
      short_title: questionnaire.value?.short_title,
    })

    await databaseStore.executeQuery('UPDATE OBSERVATION_FACT SET OBSERVATION_BLOB = ? WHERE OBSERVATION_ID = ?', [blob, props.observationId])

    logger.info('Saved pending questionnaire state', { observationId: props.observationId })
  } catch (error) {
    logger.warn('Failed to save pending state', error)
  }
}
</script>

<style lang="scss" scoped>
.questionnaire-fill-dialog {
  min-height: 80vh;
  max-height: 95vh;
  overflow-y: auto;
}

.patient-visit-info {
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .questionnaire-fill-dialog {
    margin: 4px;
    min-height: calc(100vh - 8px);
    max-height: calc(100vh - 8px);
  }
}
</style>
