<template>
  <q-page class="questionnaire-page">
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header q-mb-lg">
        <div class="row items-center justify-between">
          <div>
            <h1 class="text-h4 q-ma-none">Questionnaires</h1>
            <p class="text-body1 text-grey-6 q-ma-none">Select and complete medical questionnaires</p>
          </div>
          <div v-if="currentStep === 'questionnaire'" class="header-actions">
            <q-btn flat color="grey-7" icon="arrow_back" label="Back to Selection" @click="goBackToSelection" />
          </div>
        </div>
      </div>

      <!-- Step Indicator -->
      <q-stepper v-model="currentStepNumber" color="primary" animated flat bordered class="q-mb-lg">
        <q-step :name="1" title="Select Patient" icon="person" :done="currentStepNumber > 1" />
        <q-step :name="2" title="Select Visit" icon="event" :done="currentStepNumber > 2" />
        <q-step :name="3" title="Choose Questionnaire" icon="quiz" :done="currentStepNumber > 3" />
        <q-step :name="4" title="Complete Questionnaire" icon="edit" :done="currentStepNumber > 4" />
        <q-step :name="5" title="Review & Submit" icon="check" :done="submissionComplete" />
      </q-stepper>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Step 1: Patient Selection -->
        <div v-if="currentStep === 'patient'" class="step-content">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">Select Patient</div>
              <div class="text-body2 text-grey-6 q-mb-lg">Choose the patient for whom you want to complete a questionnaire.</div>

              <!-- Patient Search/Selector -->
              <div class="patient-selection">
                <q-input
                  v-model="patientSearch"
                  label="Search Patient"
                  outlined
                  dense
                  clearable
                  placeholder="Enter patient ID, name, or identifier..."
                  @update:model-value="searchPatients"
                  class="q-mb-md"
                >
                  <template v-slot:prepend>
                    <q-icon name="search" />
                  </template>
                </q-input>

                <!-- Patient List -->
                <q-list v-if="patients.length > 0" bordered separator class="q-mb-md">
                  <q-item
                    v-for="patient in patients"
                    :key="patient.PATIENT_NUM"
                    clickable
                    v-ripple
                    @click="selectPatient(patient)"
                    :class="{ 'bg-blue-1': selectedPatient?.PATIENT_NUM === patient.PATIENT_NUM }"
                  >
                    <q-item-section avatar>
                      <q-avatar color="primary" text-color="white">
                        {{ getPatientInitials(patient) }}
                      </q-avatar>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ getPatientName(patient) }}</q-item-label>
                      <q-item-label caption>ID: {{ patient.PATIENT_CD }}</q-item-label>
                      <q-item-label caption>Age: {{ patient.AGE_IN_YEARS || 'N/A' }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>

                <!-- No Patients Found -->
                <div v-if="patientSearch && patients.length === 0" class="text-center q-pa-lg">
                  <q-icon name="person_off" size="48px" color="grey-4" />
                  <div class="text-subtitle1 text-grey-6 q-mt-sm">No patients found</div>
                  <div class="text-body2 text-grey-5">Try a different search term</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
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
                    <q-btn flat size="sm" color="primary" label="Change Visit" @click="openVisitSelection" />
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
                        <div class="text-h6">{{ lastSubmissionResults.questionnaire_title }}</div>
                        <div class="text-caption text-grey-6">Questionnaire</div>
                      </div>
                      <div class="text-center">
                        <div class="text-h6">{{ lastSubmissionResults.responses?.length || 0 }}</div>
                        <div class="text-caption text-grey-6">Questions Answered</div>
                      </div>
                      <div v-if="lastSubmissionResults.summary" class="text-center">
                        <div class="text-h6">{{ lastSubmissionResults.summary.value }}</div>
                        <div class="text-caption text-grey-6">{{ lastSubmissionResults.summary.label }}</div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- Actions -->
              <div class="q-gutter-md">
                <q-btn color="primary" label="Complete Another Questionnaire" @click="startOver" />
                <q-btn flat color="grey-7" label="View Patient Record" @click="goToPatientRecord" />
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
import { useQuasar } from 'quasar'
import { useQuestionnaireStore } from '../stores/questionnaire-store.js'
import { useDatabaseStore } from '../stores/database-store.js'
import { logger } from '../core/services/logging-service.js'
import QuestionnaireSelector from '../components/questionnaire/QuestionnaireSelector.vue'
import QuestionnaireRenderer from '../components/questionnaire/QuestionnaireRenderer.vue'
import VisitSelectionDialog from '../components/questionnaire/VisitSelectionDialog.vue'

// Composables
const router = useRouter()
const $q = useQuasar()
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

// Patient search
const patientSearch = ref('')
const patients = ref([])

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
const searchPatients = async () => {
  if (!patientSearch.value || patientSearch.value.length < 2) {
    patients.value = []
    return
  }

  try {
    const result = await dbStore.executeQuery(
      `SELECT PATIENT_NUM, PATIENT_CD, PATIENT_BLOB
       FROM PATIENT_DIMENSION
       WHERE PATIENT_CD LIKE ? OR PATIENT_BLOB LIKE ?
       ORDER BY PATIENT_CD
       LIMIT 10`,
      [`%${patientSearch.value}%`, `%${patientSearch.value}%`],
    )

    if (result.success) {
      patients.value = result.data.map((patient) => {
        // Try to parse PATIENT_BLOB for additional info
        let additionalInfo = {}
        try {
          if (patient.PATIENT_BLOB) {
            additionalInfo = JSON.parse(patient.PATIENT_BLOB)
          }
        } catch {
          // Intentionally ignore JSON parsing errors for patient blob
          Promise.resolve().catch(() => {
            /* intentionally ignored */
          })
        }

        return {
          ...patient,
          ...additionalInfo,
        }
      })
    }
  } catch (error) {
    logger.error('Failed to search patients', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to search patients',
    })
  }
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
      $q.notify({
        type: 'negative',
        message: 'Failed to load patient visits',
      })
    }
  }
}

const createVisitForPatient = async () => {
  try {
    const visitResult = await dbStore.executeQuery(
      `INSERT INTO VISIT_DIMENSION (
        PATIENT_NUM, ACTIVE_STATUS_CD, START_DATE, INOUT_CD,
        LOCATION_CD, VISIT_BLOB, IMPORT_DATE, SOURCESYSTEM_CD
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
      [
        selectedPatient.value.PATIENT_NUM,
        'A', // Active
        new Date().toISOString(),
        'QUESTIONNAIRE',
        'Outpatient Clinic',
        JSON.stringify({
          visitNotes: 'Auto-created for questionnaire',
          createdFor: 'questionnaire',
        }),
        'SURVEY_SYSTEM',
      ],
    )

    if (!visitResult.success) {
      throw new Error('Failed to create visit')
    }

    const newVisit = {
      ENCOUNTER_NUM: visitResult.lastInsertRowid,
      PATIENT_NUM: selectedPatient.value.PATIENT_NUM,
      ACTIVE_STATUS_CD: 'A',
      START_DATE: new Date().toISOString(),
      LOCATION_CD: 'Outpatient Clinic',
      visitNotes: 'Auto-created for questionnaire',
      isNew: true,
    }

    selectedVisit.value = newVisit
    currentStep.value = 'selection'

    $q.notify({
      type: 'positive',
      message: 'Visit created automatically',
      timeout: 3000,
    })

    logger.info('Auto-created visit for patient', {
      encounterNum: newVisit.ENCOUNTER_NUM,
      patientNum: selectedPatient.value.PATIENT_NUM,
    })
  } catch (error) {
    logger.error('Failed to create visit for patient', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to create visit for patient',
    })
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

const getPatientName = (patient) => {
  if (patient.name) return patient.name
  if (patient.firstName && patient.lastName) {
    return `${patient.firstName} ${patient.lastName}`
  }
  return patient.PATIENT_CD || 'Unknown Patient'
}

const getPatientInitials = (patient) => {
  const name = getPatientName(patient)
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const onQuestionnaireSelected = ({ questionnaire }) => {
  activeQuestionnaire.value = questionnaire
  currentStep.value = 'questionnaire'
}

const onQuestionnaireSubmit = async ({ results }) => {
  if (!selectedPatient.value) {
    $q.notify({
      type: 'negative',
      message: 'No patient selected',
    })
    return
  }

  if (!selectedVisit.value) {
    $q.notify({
      type: 'negative',
      message: 'No visit selected',
    })
    return
  }

  showSubmissionDialog.value = true

  try {
    // Use the selected visit's encounter number
    const encounterNum = selectedVisit.value.ENCOUNTER_NUM

    // Save the questionnaire response
    await questionnaireStore.saveQuestionnaireResponse(selectedPatient.value.PATIENT_NUM, encounterNum, results)

    lastSubmissionResults.value = results
    submissionComplete.value = true
    currentStep.value = 'complete'

    $q.notify({
      type: 'positive',
      message: 'Questionnaire submitted successfully',
      timeout: 3000,
    })
  } catch (error) {
    logger.error('Failed to submit questionnaire', error)
    $q.notify({
      type: 'negative',
      message: `Failed to submit questionnaire: ${error.message}`,
      timeout: 5000,
    })
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
  patientSearch.value = ''
  patients.value = []
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
  // Auto-load some patients for demo
  patientSearch.value = ''
  searchPatients()
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

.page-header {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

  .page-header {
    padding: 1rem;
  }

  .header-actions {
    margin-top: 1rem;
  }
}
</style>
