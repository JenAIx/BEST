<template>
  <q-page class="questionnaire-page">
    <div class="page-container">
      <!-- Page Header -->
      <PageHeader :title="$t('navigation.questionnaires')" :subtitle="$t('questionnaire.pageSubtitle')">
        <q-btn v-if="currentStep === 'questionnaire'" flat color="grey-7" icon="arrow_back" :label="$t('common.back')" @click="goBackToSelection" />
      </PageHeader>

      <!-- Step Indicator -->
      <q-stepper v-model="currentStepNumber" color="primary" animated flat bordered class="q-mb-lg">
        <q-step :name="1" :title="$t('visit.selectPatient')" icon="person" :done="currentStepNumber > 1" />
        <q-step :name="2" :title="$t('visit.selectVisit')" icon="event" :done="currentStepNumber > 2" />
        <q-step :name="3" :title="$t('questionnaire.chooseQuestionnaire')" icon="quiz" :done="currentStepNumber > 3" />
        <q-step :name="4" :title="$t('questionnaire.fillQuestionnaire')" icon="edit" :done="currentStepNumber > 4" />
        <q-step :name="5" :title="$t('common.submit')" icon="check" :done="submissionComplete" />
      </q-stepper>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Step 1: Patient Selection -->
        <div v-if="currentStep === 'patient'" class="step-content">
          <PatientSelectionCard
            :title="$t('visit.selectPatient')"
            :description="$t('questionnaire.selectPatientHint')"
            :selected-patient="selectedPatient"
            @patient-selected="selectPatient"
            @patient-search="onPatientSearch"
          />
        </div>

        <!-- Step 2: Visit Selection (handled by dialog) -->

        <!-- Step 3: Questionnaire Selection -->
        <div v-if="currentStep === 'selection'" class="step-content">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">Selected Visit</div>
              <div class="selected-visit-info q-mb-lg">
                <q-card flat bordered class="bg-blue-1">
                  <q-card-section class="row items-center">
                    <q-icon name="event" size="24px" color="primary" class="q-mr-sm" />
                    <div class="col">
                      <div class="text-subtitle2">{{ getVisitDisplayName() }}</div>
                      <div class="text-caption text-grey-6">{{ getVisitDetails() }}</div>
                    </div>
                    <q-btn flat size="sm" color="primary" :label="$t('visit.changeVisit')" @click="openVisitSelection" />
                  </q-card-section>
                </q-card>
              </div>
            </q-card-section>
          </q-card>
          <div class="q-mt-md">
            <QuestionnaireSelector @questionnaire-selected="onQuestionnaireSelected" />
          </div>
        </div>

        <!-- Step 4: Questionnaire Form -->
        <div v-if="currentStep === 'questionnaire'" class="step-content">
          <QuestionnaireRenderer
            v-if="activeQuestionnaire"
            :questionnaire="activeQuestionnaire"
            :show-patient-field="false"
            :show-debug-actions="isDevelopment"
            @submit="onQuestionnaireSubmit"
            @validation-change="onValidationChange"
          />
        </div>

        <!-- Step 5: Success/Completion -->
        <div v-if="currentStep === 'complete'" class="step-content">
          <q-card flat bordered class="text-center">
            <q-card-section class="q-pa-xl">
              <q-icon name="check_circle" size="80px" color="green" class="q-mb-md" />
              <div class="text-h5 q-mb-sm">Questionnaire Completed!</div>
              <div class="text-body1 text-grey-6 q-mb-lg">The questionnaire has been successfully submitted and saved to the patient's record.</div>

              <!-- Summary -->
              <div v-if="lastSubmissionResults" class="submission-summary q-mb-lg">
                <q-card flat bordered class="bg-grey-1">
                  <q-card-section>
                    <div class="text-subtitle1 q-mb-sm">Submission Summary</div>
                    <div class="row q-gutter-md justify-center">
                      <div class="text-center">
                        <div class="text-h6">{{ lastSubmissionResults.title || lastSubmissionResults.questionnaire_title }}</div>
                        <div class="text-caption text-grey-6">Questionnaire</div>
                      </div>
                      <div class="text-center">
                        <div class="text-h6">{{ lastSubmissionResults.items?.length || 0 }}</div>
                        <div class="text-caption text-grey-6">Total Answers</div>
                      </div>
                      <div class="text-center">
                        <div class="text-h6">{{ lastSubmissionResults.observationCounts?.answersCount || 0 }}</div>
                        <div class="text-caption text-grey-6">Answers Added as Observations</div>
                      </div>
                      <div v-if="lastSubmissionResults.results && Array.isArray(lastSubmissionResults.results) && lastSubmissionResults.results.length > 0" class="text-center">
                        <div class="text-h6">{{ lastSubmissionResults.results[0]?.value }}</div>
                        <div class="text-caption text-grey-6">{{ lastSubmissionResults.results[0]?.coding?.display || lastSubmissionResults.results[0]?.label || 'Score' }}</div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- Actions -->
              <div class="q-gutter-md">
                <q-btn color="primary" :label="$t('questionnaire.completeAnother')" @click="startOver" />
                <q-btn flat color="grey-7" :label="$t('patient.viewRecord')" @click="goToPatientRecord" />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Loading Dialog -->
    <q-dialog v-model="showSubmissionDialog" persistent>
      <q-card style="min-width: 300px">
        <q-card-section class="row items-center">
          <q-spinner-dots size="40px" color="primary" />
          <span class="q-ml-sm">Saving questionnaire...</span>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Visit Selection Dialog -->
    <VisitSelectionDialog v-if="selectedPatient" v-model="showVisitDialog" :patient="selectedPatient" @visit-selected="onVisitSelected" @cancel="onVisitDialogCancel" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotify } from 'src/composables/useNotify'
import { useQuestionnaireStore } from '../stores/questionnaire-store.js'
import { useDatabaseStore } from '../stores/database-store.js'
import { logger } from '../core/services/logging-service.js'
import QuestionnaireSelector from '../components/questionnaire/QuestionnaireSelector.vue'
import QuestionnaireRenderer from '../components/questionnaire/QuestionnaireRenderer.vue'
import VisitSelectionDialog from '../components/questionnaire/VisitSelectionDialog.vue'
import PatientSelectionCard from '../components/shared/PatientSelectionCard.vue'
import PageHeader from '../components/shared/PageHeader.vue'

// Composables
const router = useRouter()
const notify = useNotify()
const questionnaireStore = useQuestionnaireStore()
const dbStore = useDatabaseStore()

// State
const currentStep = ref('patient') // patient -> visit -> selection -> questionnaire -> complete
const selectedPatient = ref(null)
const selectedVisit = ref(null)
const activeQuestionnaire = ref(null)
const submissionComplete = ref(false)
const showSubmissionDialog = ref(false)
const showVisitDialog = ref(false)
const lastSubmissionResults = ref(null)

// Patient search handled by PatientSelectionCard component

// Computed
const currentStepNumber = computed(() => {
  switch (currentStep.value) {
    case 'patient':
      return 1
    case 'visit':
      return 2
    case 'selection':
      return 3
    case 'questionnaire':
      return 4
    case 'complete':
      return 5
    default:
      return 1
  }
})

const isDevelopment = computed(() => {
  return process.env.NODE_ENV === 'development'
})

// Methods
const onPatientSearch = (searchResult) => {
  // Handle patient search results from PatientSelectionCard
  logger.debug('Patient search completed', {
    searchTerm: searchResult.searchTerm,
    patientCount: searchResult.patients.length,
  })
}

const selectPatient = async (patient) => {
  selectedPatient.value = patient
  // Automatically continue to visit selection
  await openVisitSelection()
}

const openVisitSelection = async () => {
  if (selectedPatient.value) {
    // Check if patient has any visits
    try {
      const result = await dbStore.executeQuery(`SELECT COUNT(*) as count FROM VISIT_DIMENSION WHERE PATIENT_NUM = ?`, [selectedPatient.value.PATIENT_NUM])

      if (result.success && result.data[0].count === 0) {
        // No visits exist, create one automatically
        await createVisitForPatient()
      } else {
        // Visits exist, show selection dialog
        showVisitDialog.value = true
      }
    } catch (error) {
      logger.error('Failed to check patient visits', error)
      notify.error('Failed to load patient visits')
    }
  }
}

const createVisitForPatient = async () => {
  try {
    // Use visit repository which has workaround for undefined lastInsertRowid
    const visitRepo = dbStore.getRepository('visit')
    
    const visitData = {
      PATIENT_NUM: selectedPatient.value.PATIENT_NUM,
      ACTIVE_STATUS_CD: 'A', // Active
      START_DATE: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
      INOUT_CD: 'QUESTIONNAIRE',
      LOCATION_CD: 'Outpatient Clinic',
      VISIT_BLOB: JSON.stringify({
        visitNotes: 'Auto-created for questionnaire',
        createdFor: 'questionnaire',
      }),
      SOURCESYSTEM_CD: 'SURVEY_SYSTEM',
    }

    const createdVisit = await visitRepo.createVisit(visitData)

    // Ensure ENCOUNTER_NUM is set - repository has workaround if lastInsertRowid is undefined
    if (!createdVisit.ENCOUNTER_NUM) {
      throw new Error('Failed to get encounter number after visit creation')
    }

    const newVisit = {
      ENCOUNTER_NUM: createdVisit.ENCOUNTER_NUM,
      PATIENT_NUM: selectedPatient.value.PATIENT_NUM,
      ACTIVE_STATUS_CD: 'A',
      START_DATE: new Date().toISOString(),
      LOCATION_CD: 'Outpatient Clinic',
      visitNotes: 'Auto-created for questionnaire',
      isNew: true,
    }

    selectedVisit.value = newVisit
    currentStep.value = 'selection'

    notify.success('Visit created automatically', { timeout: 3000 })

    logger.info('Auto-created visit for patient', {
      encounterNum: newVisit.ENCOUNTER_NUM,
      patientNum: selectedPatient.value.PATIENT_NUM,
    })
  } catch (error) {
    logger.error('Failed to create visit for patient', error)
    notify.error('Failed to create visit for patient')
  }
}

const onVisitSelected = (visit) => {
  selectedVisit.value = visit
  currentStep.value = 'selection'
  showVisitDialog.value = false
  logger.info('Visit selected for questionnaire', {
    encounterNum: visit.ENCOUNTER_NUM,
    patientNum: visit.PATIENT_NUM,
    isNew: visit.isNew,
  })
}

const onVisitDialogCancel = () => {
  showVisitDialog.value = false
}

const getVisitDisplayName = () => {
  if (!selectedVisit.value) return 'No visit selected'

  if (selectedVisit.value.isNew) {
    return 'New Visit (Created)'
  } else {
    const date = new Date(selectedVisit.value.START_DATE)
    return `Visit - ${date.toLocaleDateString()}`
  }
}

const getVisitDetails = () => {
  if (!selectedVisit.value) return ''

  const details = []
  if (selectedVisit.value.LOCATION_CD) {
    details.push(`Location: ${selectedVisit.value.LOCATION_CD}`)
  }

  const statusMap = {
    A: 'Active',
    C: 'Completed',
    S: 'Scheduled',
    X: 'Cancelled',
  }

  const status = statusMap[selectedVisit.value.ACTIVE_STATUS_CD] || selectedVisit.value.ACTIVE_STATUS_CD
  if (status) {
    details.push(`Status: ${status}`)
  }

  if (selectedVisit.value.visitNotes) {
    details.push(`Notes: ${selectedVisit.value.visitNotes}`)
  }

  return details.join(' • ')
}

const onQuestionnaireSelected = ({ questionnaire }) => {
  activeQuestionnaire.value = questionnaire
  currentStep.value = 'questionnaire'
}

const onQuestionnaireSubmit = async ({ results }) => {
  if (!selectedPatient.value) {
    notify.error('No patient selected')
    return
  }

  if (!selectedVisit.value) {
    notify.error('No visit selected')
    return
  }

  // Validate encounter number is set
  const encounterNum = selectedVisit.value.ENCOUNTER_NUM
  if (!encounterNum) {
    logger.error('Encounter number is missing from selected visit', {
      selectedVisit: selectedVisit.value,
    })
    notify.error('Invalid visit: missing encounter number. Please select a different visit or create a new one.')
    return
  }

  showSubmissionDialog.value = true

  try {
    // Save the questionnaire response
    const saveResult = await questionnaireStore.saveQuestionnaireResponse(selectedPatient.value.PATIENT_NUM, encounterNum, results)

    // Store results with observation counts
    lastSubmissionResults.value = {
      ...results,
      observationCounts: saveResult.observationCounts || { answersCount: 0, resultsCount: 0, totalObservations: 0 },
    }
    submissionComplete.value = true
    currentStep.value = 'complete'

    notify.success('Questionnaire submitted successfully', { timeout: 3000 })
  } catch (error) {
    logger.error('Failed to submit questionnaire', error)
    notify.error(`Failed to submit questionnaire: ${error.message}`, { timeout: 5000 })
  } finally {
    showSubmissionDialog.value = false
  }
}

const onValidationChange = () => {
  // Handle validation state change if needed
}

const goBackToSelection = () => {
  currentStep.value = 'selection'
  questionnaireStore.clearActive()
  activeQuestionnaire.value = null
}

const startOver = () => {
  currentStep.value = 'patient'
  selectedPatient.value = null
  selectedVisit.value = null
  activeQuestionnaire.value = null
  submissionComplete.value = false
  lastSubmissionResults.value = null
  showVisitDialog.value = false
  questionnaireStore.clearActive()
}

const goToPatientRecord = () => {
  if (selectedPatient.value) {
    router.push(`/patient/${selectedPatient.value.PATIENT_CD}`)
  }
}

// Lifecycle
onMounted(() => {
  // Patient selection is handled by the PatientSelectionCard component
})
</script>

<style scoped>
.questionnaire-page {
  min-height: 100vh;
  background: #f8f9fa;
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.step-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 400px;
}

.patient-selection {
  max-width: 600px;
}

.submission-summary {
  max-width: 500px;
  margin: 0 auto;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .page-container {
    padding: 1rem;
  }

}
</style>
