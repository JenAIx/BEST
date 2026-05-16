<template>
  <AppDialog
    v-model="dialogModel"
    :title="dialogTitle"
    :subtitle="dialogSubtitle"
    size="xl"
    :show-actions="true"
    :show-close="true"
    @ok="exportToPDF"
    :ok-label="$t('visit.exportPdf')"
    ok-icon="picture_as_pdf"
    ok-color="primary"
  >
    <div v-if="loading" class="loading-container">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">{{ $t('visit.loadingSummary') }}</div>
    </div>

    <div v-else-if="observationStore.error" class="error-container">
      <q-icon name="error" size="48px" color="negative" />
      <div class="text-h6 text-negative q-mt-sm">{{ $t('visit.failedToLoad') }}</div>
      <div class="text-body2 text-grey-6">{{ observationStore.error }}</div>
    </div>

    <div v-else-if="!visit" class="no-visit-selected">
      <q-icon name="event_busy" size="48px" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-sm">{{ $t('visit.noVisitSelected') }}</div>
      <div class="text-body2 text-grey-5">{{ $t('visit.selectVisitForSummary') }}</div>
    </div>

    <div v-else class="visit-summary-content q-pa-md">
      <!-- Patient Header -->
      <VisitSummaryPatientHeader :patient="patient" />

      <!-- Visit Overview Header -->
      <VisitSummaryHeader :visit="visit" :total-observations="totalObservations" :questionnaire-count="questionnaireObservations.length" />

      <!-- Observations by Category -->
      <VisitSummaryObservations :categorized-observations="categorizedObservations" @preview-questionnaire="previewQuestionnaire" @preview-file="previewFile" />

      <!-- Questionnaires Section -->
      <VisitSummaryQuestionnaires :questionnaire-observations="questionnaireObservations" :loaded-questionnaires="loadedQuestionnaires" @preview-questionnaire="previewQuestionnaire" />
    </div>

    <!-- File Preview Dialog -->
    <FilePreviewDialog
      v-if="selectedFileObservation"
      v-model="showFilePreview"
      :observation-id="selectedFileObservation.observationId"
      :file-info="selectedFileObservation.fileInfo"
      :concept-name="selectedFileObservation.conceptName"
      :upload-date="selectedFileObservation.date"
    />

    <!-- Questionnaire Preview Dialog -->
    <QuestionnairePreviewDialog
      v-if="selectedQuestionnaireObservation"
      v-model="showQuestionnairePreview"
      :observation-id="selectedQuestionnaireObservation.observationId"
      :concept-name="selectedQuestionnaireObservation.conceptName"
      :completion-date="selectedQuestionnaireObservation.date"
    />
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { usePatientStore } from 'src/stores/patient-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from 'src/components/shared/AppDialog.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'
import QuestionnairePreviewDialog from 'src/components/shared/QuestionnairePreviewDialog.vue'
import VisitSummaryPatientHeader from './VisitSummaryPatientHeader.vue'
import VisitSummaryHeader from './VisitSummaryHeader.vue'
import VisitSummaryObservations from './VisitSummaryObservations.vue'
import VisitSummaryQuestionnaires from './VisitSummaryQuestionnaires.vue'
import { formatDateVerbose, getVisitTypeLabel } from 'src/shared/utils/medical-utils.js'
import { useVisitSummaryPDF } from 'src/composables/useVisitSummaryPDF.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  visit: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const notify = useNotify()
const visitStore = useVisitStore()
const observationStore = useObservationStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitSummaryDialog')

// PDF composable
const { generatePDFContent: generatePDFContentUtil } = useVisitSummaryPDF()

// State
const selectedFileObservation = ref(null)
const showFilePreview = ref(false)
const selectedQuestionnaireObservation = ref(null)
const showQuestionnairePreview = ref(false)
const loadedQuestionnaires = ref({}) // Store loaded questionnaire data by observationId

// Computed
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dialogTitle = computed(() => {
  if (!props.visit) return 'Visit Summary'
  return `Visit Summary - ${formattedDate.value}`
})

const dialogSubtitle = computed(() => {
  if (!props.visit) return 'No visit selected'
  return `${visitTypeLabel.value} • ${totalObservations.value} observations`
})

const formattedDate = computed(() => {
  return formatDateVerbose(props.visit?.date)
})

const visitTypeLabel = computed(() => {
  return getVisitTypeLabel(props.visit?.type)
})

const totalObservations = computed(() => {
  return observations.value.length
})

// Use store data when visit matches selected visit, otherwise load separately
const observations = computed(() => {
  if (props.visit && visitStore.selectedVisit && props.visit.id === visitStore.selectedVisit.id) {
    return observationStore.observations
  }
  return [] // Could implement separate loading for non-selected visits if needed
})

const loading = computed(() => {
  return observationStore.loading
})

const categorizedObservations = computed(() => observationStore.categorizedObservations)

// Filter questionnaire observations
const questionnaireObservations = computed(() => {
  return observations.value.filter((obs) => obs.valueType === 'Q')
})

// Patient information computed properties
const patient = computed(() => {
  const patientStore = usePatientStore()
  return patientStore.selectedPatient
})

// Methods

const previewFile = (observation) => {
  logger.logUserAction('file_preview_requested', {
    observationId: observation.observationId,
    conceptCode: observation.conceptCode,
    conceptName: observation.conceptName,
    fileName: observation.fileInfo?.filename,
    fileSize: observation.fileInfo?.size,
    visitId: props.visit?.id,
  })

  selectedFileObservation.value = observation
  showFilePreview.value = true
}

const previewQuestionnaire = (observation) => {
  logger.logUserAction('questionnaire_preview_requested', {
    observationId: observation.observationId,
    conceptCode: observation.conceptCode,
    conceptName: observation.conceptName,
    visitId: props.visit?.id,
  })

  selectedQuestionnaireObservation.value = observation
  showQuestionnairePreview.value = true
}

// Load questionnaire data for display
const loadQuestionnaireData = async (observation) => {
  if (loadedQuestionnaires.value[observation.observationId]) {
    return // Already loaded
  }

  try {
    const observationDetails = await observationStore.loadObservationDetails(observation.observationId)
    if (observationDetails && observationDetails.observationBlob) {
      loadedQuestionnaires.value[observation.observationId] = observationDetails.observationBlob
    }
  } catch (error) {
    logger.error('Failed to load questionnaire data', error, {
      observationId: observation.observationId,
    })
  }
}

// Load all questionnaires when dialog opens
const loadAllQuestionnaires = async () => {
  if (questionnaireObservations.value.length === 0) return

  // Load all questionnaires in parallel
  await Promise.all(questionnaireObservations.value.map((obs) => loadQuestionnaireData(obs)))
}

const exportToPDF = async () => {
  logger.logUserAction('pdf_export_requested', {
    visitId: props.visit?.id,
    patientId: patient.value?.PATIENT_CD,
    observationCount: totalObservations.value,
    categoryCount: categorizedObservations.value.length,
    questionnaireCount: questionnaireObservations.value.length,
  })

  try {
    // Ensure all questionnaires are loaded before generating PDF
    await loadAllQuestionnaires()

    // Create a clean HTML version for PDF
    const htmlContent = await generatePDFContent()

    // Create a temporary element for printing
    const printWindow = window.open('', '_blank')
    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()

      // Close the window after printing (user can cancel)
      printWindow.onafterprint = () => {
        printWindow.close()
      }
    }

    logger.info('PDF export initiated', {
      visitId: props.visit?.id,
      patientName: patient.value?.PATIENT_CD || 'Unknown',
    })
  } catch (error) {
    logger.error('Failed to export PDF', error)
    notify.error('Failed to export PDF. Please try again.')
  }
}

const generatePDFContent = async () => {
  return await generatePDFContentUtil({
    patient: patient.value,
    visit: props.visit,
    formattedDate: formattedDate.value,
    visitTypeLabel: visitTypeLabel.value,
    totalObservations: totalObservations.value,
    categorizedObservations: categorizedObservations.value,
    questionnaireObservations: questionnaireObservations.value,
    loadedQuestionnaires: loadedQuestionnaires.value,
    loadQuestionnaireData,
  })
}

// Watch for dialog open/close
watch(dialogModel, async (newValue) => {
  if (newValue && props.visit) {
    // Log dialog opening
    logger.logUserAction('visit_summary_dialog_opened', {
      visitId: props.visit.id,
      visitType: props.visit.type,
      visitDate: props.visit.date,
      observationCount: props.visit.observationCount || 0,
    })

    // Ensure observations are loaded for the visit
    if (visitStore.selectedVisit?.id !== props.visit.id) {
      const timer = logger.startTimer('visit_summary_data_load')
      try {
        await visitObservationService.selectVisitAndLoadObservations(props.visit)
        const duration = timer.end()
        logger.info('Visit summary data loaded', {
          visitId: props.visit.id,
          observationsCount: observationStore.observations.length,
          duration: `${duration.toFixed(2)}ms`,
        })
        // Load questionnaire data after observations are loaded
        await loadAllQuestionnaires()
      } catch (error) {
        timer.end()
        logger.error('Failed to load visit summary data', error, {
          visitId: props.visit.id,
        })
      }
    } else {
      // Observations already loaded, just load questionnaires
      await loadAllQuestionnaires()
    }
  } else {
    // Log dialog closing
    if (props.visit) {
      logger.logUserAction('visit_summary_dialog_closed', {
        visitId: props.visit.id,
        hadFilePreview: !!selectedFileObservation.value,
      })
    }

    selectedFileObservation.value = null
    showFilePreview.value = false
    selectedQuestionnaireObservation.value = null
    showQuestionnairePreview.value = false
    loadedQuestionnaires.value = {} // Clear loaded questionnaires when dialog closes
  }
})
</script>

<style lang="scss" scoped>
.loading-container,
.error-container,
.no-visit-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.visit-summary-content {
  max-height: none;
  background: white;

  // PDF-friendly styles
  @media print {
    background: white !important;
    color: black !important;

    .q-btn {
      display: none !important;
    }
  }
}
</style>
