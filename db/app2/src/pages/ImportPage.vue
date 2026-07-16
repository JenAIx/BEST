<template>
  <q-page class="import-page">
    <div class="page-container">
      <!-- Page Header -->
      <PageHeader :title="$t('import.importData')" :subtitle="$t('import.importPatientData')">
        <q-btn v-if="currentStep !== 'upload'" flat color="grey-7" icon="arrow_back" :label="$t('import.backToUpload')" @click="goBackToUpload" />
      </PageHeader>

      <!-- Step Indicator -->
      <q-stepper v-model="currentStepNumber" color="primary" animated flat bordered class="q-mb-lg">
        <q-step :name="1" :title="$t('import.uploadFile')" icon="upload" :done="currentStepNumber > 1" />
        <q-step :name="2" :title="$t('import.analyzeFile')" icon="search" :done="currentStepNumber > 2" />
        <q-step :name="3" :title="$t('import.selectMode')" icon="settings" :done="currentStepNumber > 3" />
        <q-step :name="4" :title="$t('import.importData')" icon="check" :done="importComplete" />
      </q-stepper>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Step 1: File Upload -->
        <div v-if="currentStep === 'upload'" class="step-content content-box">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">{{ $t('import.uploadDataFile') }}</div>
              <div class="text-body2 text-grey-6 q-mb-lg">{{ $t('import.uploadHint') }}</div>

              <!-- File Upload Component -->
              <div class="file-upload-section">
                <FileUploadInput v-model="selectedFile" :max-size-m-b="50" accepted-types=".csv,.json,.xml,.txt,.xlsx,.xls,.hl7,.html" @file-selected="onFileSelected" @file-cleared="onFileCleared" />
              </div>

              <!-- Debug Section -->
              <div class="debug-section q-mt-sm">
                <q-card flat bordered class="bg-orange-1">
                  <q-card-section>
                    <div class="text-subtitle1 q-mb-sm text-orange-9">🔧 Debug Tools</div>
                    <div class="text-body2 text-orange-8 q-mb-md">Quick test with the REAL 02_json.json file</div>
                    <q-btn color="orange" icon="bug_report" label="Load & Analyze REAL 02_json.json" @click="loadDebugFile('02_json.json')" :loading="debugLoading" no-caps class="q-px-lg" />
                    <q-btn color="orange" icon="bug_report" label="Load & Analyze 01_csv_data.csv" @click="loadDebugFile('01_csv_data.csv')" :loading="debugLoading" no-caps class="q-px-lg" />
                  </q-card-section>
                </q-card>
              </div>

              <!-- File Info Display -->
              <div v-if="selectedFile" class="file-info q-mt-lg">
                <q-card flat bordered class="bg-grey-1">
                  <q-card-section>
                    <div class="text-subtitle1 q-mb-sm">{{ $t('import.selectedFile') }}</div>
                    <div class="row items-center">
                      <q-icon name="description" size="24px" color="primary" class="q-mr-sm" />
                      <div class="col">
                        <div class="text-subtitle2">{{ selectedFile.fileInfo.filename }}</div>
                        <div class="text-caption text-grey-6">{{ formatFileSize(selectedFile.fileInfo.size) }}</div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Step 2: File Analysis -->
        <div v-if="currentStep === 'analyze'" class="step-content content-box">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">{{ $t('import.fileAnalysisTitle') }}</div>
              <div class="text-body2 text-grey-6 q-mb-lg">{{ $t('import.fileAnalysisHint') }}</div>

              <!-- Analyzing State -->
              <div v-if="analyzingFile" class="analyzing-state">
                <q-spinner-dots size="60px" color="primary" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">{{ $t('import.analyzingFile') }}</div>
                <div class="text-body1 text-grey-6">{{ $t('import.analyzingFileHint') }}</div>
              </div>

              <!-- Analysis Results -->
              <div v-else-if="fileAnalysis && fileAnalysis.success" class="analysis-results">
                <q-card flat bordered class="bg-grey-1 q-mb-lg">
                  <q-card-section>
                    <div class="row items-center justify-between q-mb-md">
                      <div class="text-subtitle1">{{ $t('import.analysisResults') }}</div>
                      <q-btn color="primary" icon="preview" :label="$t('import.preview')" size="lg" @click="showPreviewDialog = true" />
                    </div>

                    <div class="text-body2 q-mb-sm">
                      <strong>{{ $t('import.fieldPatients') }}:</strong> {{ fileAnalysis.patientsCount || 0 }} • <strong>{{ $t('import.fieldVisits') }}:</strong> {{ fileAnalysis.visitsCount || 0 }} • <strong>{{ $t('import.fieldObservations') }}:</strong>
                      {{ fileAnalysis.observationsCount || 0 }} • <strong>{{ $t('import.fieldEstTime') }}:</strong> {{ fileAnalysis.estimatedImportTime || $t('import.fieldUnknown') }}
                    </div>

                    <div class="text-body2 q-mb-sm">
                      <strong>{{ $t('import.fieldFile') }}:</strong> {{ fileAnalysis.filename }} • <strong>{{ $t('import.fieldFormat') }}:</strong> {{ fileAnalysis.format ? fileAnalysis.format.toUpperCase() : $t('import.fieldUnknown') }}
                    </div>
                    <div class="text-body2 q-mb-sm">
                      <strong>{{ $t('import.fieldRecommendedStrategy') }}:</strong>
                      <q-chip :color="getStrategyColor(fileAnalysis.recommendedStrategy)" text-color="white" size="sm">
                        {{ getStrategyLabel(fileAnalysis.recommendedStrategy) }}
                      </q-chip>
                    </div>

                    <!-- Warnings -->
                    <div v-if="fileAnalysis.warnings && fileAnalysis.warnings.length > 0" class="q-mt-md">
                      <q-banner class="bg-orange-1 text-orange-8" rounded>
                        <template v-slot:avatar>
                          <q-icon name="warning" />
                        </template>
                        <div v-for="warning in fileAnalysis.warnings" :key="warning">
                          {{ warning }}
                        </div>
                      </q-banner>
                    </div>

                    <!-- Errors -->
                    <div v-if="fileAnalysis.errors && fileAnalysis.errors.length > 0" class="q-mt-md">
                      <q-banner class="bg-negative-1 text-negative-8" rounded>
                        <template v-slot:avatar>
                          <q-icon name="error" />
                        </template>
                        <div v-for="error in fileAnalysis.errors" :key="error">
                          {{ error }}
                        </div>
                      </q-banner>
                    </div>
                  </q-card-section>
                </q-card>

                <!-- Action Buttons -->
                <div class="q-gutter-md">
                  <q-btn color="primary" icon="arrow_forward" :label="$t('import.continueToMode')" @click="goToModeSelection" :disable="!fileAnalysis.success" no-caps class="q-px-lg" />
                  <q-btn flat color="grey-7" :label="$t('import.uploadDifferent')" @click="goBackToUpload" />
                </div>
              </div>

              <!-- Analysis Error -->
              <div v-else-if="fileAnalysis && !fileAnalysis.success" class="analysis-error">
                <q-card flat bordered class="bg-negative-1">
                  <q-card-section>
                    <div class="text-subtitle1 q-mb-md text-negative-8">
                      <q-icon name="error" class="q-mr-sm" />
                      {{ $t('import.analysisFailedTitle') }}
                    </div>

                    <div class="text-body2 text-negative-8 q-mb-md">{{ $t('import.analysisFailedHint') }}</div>

                    <!-- Error Details -->
                    <div v-if="fileAnalysis.errors && fileAnalysis.errors.length > 0" class="q-mb-md">
                      <q-banner class="bg-negative-2 text-negative-9" rounded>
                        <template v-slot:avatar>
                          <q-icon name="error_outline" />
                        </template>
                        <div class="text-subtitle2 q-mb-sm">{{ $t('import.errorDetails') }}:</div>
                        <div v-for="(error, index) in fileAnalysis.errors" :key="index" class="q-mb-xs">• {{ typeof error === 'string' ? error : error.message || error }}</div>
                      </q-banner>
                    </div>

                    <!-- Error Details (if available) -->
                    <div v-if="fileAnalysis.errorDetails" class="q-mb-md">
                      <div class="text-caption text-grey-7">
                        <strong>{{ $t('import.fieldTimestamp') }}:</strong> {{ fileAnalysis.errorDetails.timestamp }}<br />
                        <strong>{{ $t('import.fieldFilename') }}:</strong> {{ fileAnalysis.errorDetails.filename }}<br />
                        <strong>{{ $t('import.fieldMessage') }}:</strong> {{ fileAnalysis.errorDetails.message }}
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="q-gutter-md">
                      <q-btn color="primary" icon="refresh" :label="$t('import.tryAgain')" @click="retryAnalysis" />
                      <q-btn flat color="grey-7" :label="$t('import.uploadDifferent')" @click="goBackToUpload" />
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Step 3: Mode Selection -->
        <div v-if="currentStep === 'mode'" class="step-content content-box">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">{{ $t('import.selectImportMode') }}</div>
              <div class="text-body2 text-grey-6 q-mb-lg">{{ $t('import.selectImportModeHint') }}</div>

              <!-- Mode Selection -->
              <div class="mode-selection q-mb-lg">
                <q-option-group v-model="selectedMode" :options="availableModes" type="radio" color="primary" />
              </div>

              <!-- Mode Description -->
              <div v-if="selectedMode" class="mode-description q-mb-lg">
                <q-card flat bordered class="bg-blue-1">
                  <q-card-section>
                    <div class="text-subtitle2 q-mb-sm">{{ getModeTitle(selectedMode) }}</div>
                    <div class="text-body2">{{ getModeDescription(selectedMode) }}</div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- Patient/Visit Selection for Single Patient Mode -->
              <div v-if="selectedMode === 'single_patient'" class="patient-selection q-mb-lg">
                <div class="text-subtitle1 q-mb-md">{{ $t('import.patientVisitSection') }}</div>

                <!-- Create New Patient Option -->
                <q-radio v-model="patientMode" val="create" :label="$t('import.createNewPatient')" class="q-mb-md" />

                <!-- Use Existing Patient Option -->
                <q-radio v-model="patientMode" val="existing" :label="$t('import.addToExisting')" class="q-mb-md" />

                <!-- Patient Selection -->
                <div v-if="patientMode === 'existing'" class="q-mt-md">
                  <PatientSelectionCard
                    :title="$t('import.selectPatient')"
                    :description="$t('import.selectPatientHint')"
                    :selected-patient="selectedPatient"
                    @patient-selected="selectPatient"
                    @patient-search="onPatientSearch"
                  />
                </div>

                <!-- Visit Selection -->
                <div v-if="patientMode === 'existing' && selectedPatient" class="q-mt-md">
                  <q-btn flat color="green" :label="$t('import.selectVisit')" @click="openVisitSelection" />
                  <div v-if="selectedVisit" class="q-mt-sm">
                    <q-chip color="green" text-color="white" icon="event">
                      {{ getVisitDisplayName() }}
                    </q-chip>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="q-gutter-md">
                <q-btn color="primary" icon="arrow_forward" :label="$t('import.continueToImport')" @click="goToImport" :disable="!canProceedToImport" no-caps class="q-px-lg" />
                <q-btn flat color="grey-7" :label="$t('import.backToAnalysis')" @click="goBackToAnalysis" />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Step 4: Import Progress/Complete -->
        <div v-if="currentStep === 'import'" class="step-content content-box">
          <q-card flat bordered class="text-center">
            <q-card-section class="q-pa-xl">
              <!-- Importing State -->
              <div v-if="importStore.isImporting" class="importing-state">
                <q-spinner-dots size="60px" color="primary" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">{{ $t('import.importingData') }}</div>
                <div class="text-body1 text-grey-6 q-mb-lg">{{ importStore.importProgress }}</div>
                <q-linear-progress :value="importStore.importProgressValue / 100" color="primary" class="q-mt-md" />
              </div>

              <!-- Import Complete -->
              <div v-else-if="importComplete" class="import-complete">
                <q-icon name="check_circle" size="80px" color="green" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">{{ $t('import.importCompletedTitle') }}</div>
                <div class="text-body1 text-grey-6 q-mb-lg">{{ $t('import.importCompletedHint') }}</div>

                <!-- Import Summary -->
                <div v-if="importSummary" class="import-summary q-mb-lg">
                  <q-card flat bordered class="bg-grey-1">
                    <q-card-section>
                      <div class="text-subtitle1 q-mb-sm">{{ $t('import.importSummary') }}</div>
                      <div class="row q-gutter-md justify-center">
                        <div class="text-center">
                          <div class="text-h6">{{ importSummary.totalRecords }}</div>
                          <div class="text-caption text-grey-6">{{ $t('import.recordsProcessed') }}</div>
                        </div>
                        <div class="text-center">
                          <div class="text-h6">{{ importSummary.successfulImports }}</div>
                          <div class="text-caption text-grey-6">{{ $t('import.successfullyImported') }}</div>
                        </div>
                        <div v-if="importSummary.visits > 1" class="text-center">
                          <div class="text-h6">{{ importSummary.visits }}</div>
                          <div class="text-caption text-grey-6">{{ $t('import.visitsCreated') }}</div>
                        </div>
                        <div v-if="importSummary.errors > 0" class="text-center">
                          <div class="text-h6 text-negative">{{ importSummary.errors }}</div>
                          <div class="text-caption text-grey-6">{{ $t('import.summaryErrors') }}</div>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Actions -->
                <div class="q-gutter-md">
                  <q-btn color="primary" :label="$t('import.importAnother')" @click="startOver" />
                  <q-btn
                    flat
                    color="grey-7"
                    :label="$t('import.viewPatient')"
                    @click="goToPatientRecord"
                    :disable="!importedPatientCode && !selectedPatient"
                  />
                </div>
              </div>

              <!-- Import Error -->
              <div v-else-if="importError" class="import-error">
                <q-icon name="error" size="80px" color="negative" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">{{ $t('import.importFailedTitle') }}</div>
                <div class="text-body1 text-negative q-mb-lg">{{ importError }}</div>

                <div class="q-gutter-md">
                  <q-btn color="primary" :label="$t('import.tryAgain')" @click="retryImport" />
                  <q-btn flat color="grey-7" :label="$t('import.cancel')" @click="goBackToUpload" />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Visit Selection Dialog -->
    <VisitSelectionDialog v-if="selectedPatient" v-model="showVisitDialog" :patient="selectedPatient" @visit-selected="onVisitSelected" @cancel="onVisitDialogCancel" />

    <!-- Import Preview Dialog -->
    <ImportPreviewDialog
      v-model="showPreviewDialog"
      :file-analysis="fileAnalysis"
      :selected-mode="selectedMode"
      :patient-mode="patientMode"
      :selected-patient="selectedPatient"
      :selected-visit="selectedVisit"
      @update:selections="handleSelectionUpdate"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from '../stores/database-store.js'
import { useImportStore } from '../stores/import-store.js'
import { useVisitStore } from '../stores/visit-store.js'
import { logger } from '../core/services/logging-service.js'
import FileUploadInput from '../components/shared/FileUploadInput.vue'
import VisitSelectionDialog from '../components/questionnaire/VisitSelectionDialog.vue'
import PatientSelectionCard from '../components/shared/PatientSelectionCard.vue'
import ImportPreviewDialog from '../components/shared/ImportPreviewDialog.vue'
import PageHeader from '../components/shared/PageHeader.vue'

// Composables
const router = useRouter()
const { t } = useI18n()
const notify = useNotify()
const dbStore = useDatabaseStore()
const importStore = useImportStore()
const visitStore = useVisitStore()

// State
const currentStep = ref('upload') // upload -> analyze -> mode -> import
const selectedFile = ref(null)
const fileAnalysis = ref(null)
const analyzingFile = ref(false)
const selectedMode = ref(null)
const patientMode = ref('create') // 'create' or 'existing'
const selectedPatient = ref(null)
const selectedVisit = ref(null)
const showVisitDialog = ref(false)
const showPreviewDialog = ref(false)
const debugLoading = ref(false)

// Import state (using import store)
const importComplete = ref(false)
const importError = ref('')
const importSummary = ref(null)
const importedPatientCode = ref(null) // Track the imported patient for navigation

// Computed
const currentStepNumber = computed(() => {
  switch (currentStep.value) {
    case 'upload':
      return 1
    case 'analyze':
      return 2
    case 'mode':
      return 3
    case 'import':
      return 4
    default:
      return 1
  }
})

const availableModes = computed(() => {
  if (!fileAnalysis.value) return []

  const modes = []

  // Only offer single patient mode if there's only one patient
  if (!fileAnalysis.value.hasMultiplePatients) {
    modes.push({
      label: t('import.modeSinglePatient'),
      value: 'single_patient',
      description: t('import.modeSinglePatientDesc'),
    })
  }

  // Only offer multiple patients mode if there are multiple patients
  if (fileAnalysis.value.hasMultiplePatients) {
    modes.push({
      label: t('import.modeMultiplePatients'),
      value: 'multiple_patients',
      description: t('import.modeMultiplePatientsDesc'),
    })
  }

  return modes
})

const canProceedToImport = computed(() => {
  if (!selectedMode.value) return false

  if (selectedMode.value === 'single_patient') {
    if (patientMode.value === 'create') return true
    if (patientMode.value === 'existing') {
      return selectedPatient.value && selectedVisit.value
    }
  }

  return true
})

// Methods
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleSelectionUpdate = (selections) => {
  // Update the import store with the new selections
  importStore.updateSelections(selections)

  // Update the file analysis with the new selections
  if (fileAnalysis.value && selections) {
    // Update counts based on selections
    fileAnalysis.value.patientsCount = selections.patients?.length || 0
    fileAnalysis.value.visitsCount = selections.visits?.length || 0
    fileAnalysis.value.observationsCount = selections.observations?.length || 0

    // Store the selections in the file analysis for later use
    fileAnalysis.value.selections = selections

    logger.info('Updated file analysis with new selections', {
      patients: fileAnalysis.value.patientsCount,
      visits: fileAnalysis.value.visitsCount,
      observations: fileAnalysis.value.observationsCount,
      totalSelected: selections.totalSelected || 0,
    })
  }
}

const onPatientSearch = (searchResult) => {
  // Handle patient search results from PatientSelectionCard
  logger.debug('Patient search completed', {
    searchTerm: searchResult.searchTerm,
    patientCount: searchResult.patients.length,
  })
}

const goToModeSelection = () => {
  // Set default mode based on analysis
  if (fileAnalysis.value) {
    selectedMode.value = fileAnalysis.value.recommendedStrategy
  }
  currentStep.value = 'mode'
}

const goBackToAnalysis = () => {
  currentStep.value = 'analyze'
}

const goToImport = () => {
  currentStep.value = 'import'
  startImport()
}

const getModeTitle = (mode) => {
  switch (mode) {
    case 'single_patient':
      return t('import.modeSinglePatient')
    case 'multiple_patients':
      return t('import.modeMultiplePatients')
    case 'batch_import':
      return t('import.modeBatch')
    default:
      return t('import.modeUnknown')
  }
}

const getModeDescription = (mode) => {
  switch (mode) {
    case 'single_patient':
      return t('import.modeSinglePatientLong')
    case 'multiple_patients':
      return t('import.modeMultiplePatientsLong')
    case 'batch_import':
      return t('import.modeBatchLong')
    default:
      return t('import.modeUnknownLong')
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
      notify.error(t('import.errorFailedLoadVisits'))
    }
  }
}

const createVisitForPatient = async () => {
  try {
    const created = await visitStore.createVisitForImport(selectedPatient.value.PATIENT_NUM)

    selectedVisit.value = {
      ENCOUNTER_NUM: created.ENCOUNTER_NUM,
      PATIENT_NUM: selectedPatient.value.PATIENT_NUM,
      ACTIVE_STATUS_CD: 'A',
      START_DATE: created.START_DATE || new Date().toISOString(),
      LOCATION_CD: 'Data Import',
      visitNotes: 'Auto-created for data import',
      isNew: true,
    }
    currentStep.value = 'upload'

    notify.success(t('import.toastVisitAutoCreated'))

    logger.info('Auto-created visit for import', {
      encounterNum: created.ENCOUNTER_NUM,
      patientNum: selectedPatient.value.PATIENT_NUM,
    })
  } catch (error) {
    logger.error('Failed to create visit for patient', error)
    notify.error(t('import.errorFailedCreateVisit'))
  }
}

const onVisitSelected = (visit) => {
  selectedVisit.value = visit
  showVisitDialog.value = false
  logger.info('Visit selected for import', {
    encounterNum: visit.ENCOUNTER_NUM,
    patientNum: visit.PATIENT_NUM,
    isNew: visit.isNew,
  })
}

const onVisitDialogCancel = () => {
  showVisitDialog.value = false
}

const getVisitDisplayName = () => {
  if (!selectedVisit.value) return t('import.noVisitSelected')

  if (selectedVisit.value.isNew) {
    return t('import.newVisitCreated')
  }
  const date = new Date(selectedVisit.value.START_DATE)
  return t('import.visitOnDate', { date: date.toLocaleDateString() })
}

const getStrategyColor = (strategy) => {
  switch (strategy) {
    case 'single_patient':
      return 'green'
    case 'multiple_patients':
      return 'orange'
    case 'batch_import':
      return 'orange'
    default:
      return 'grey'
  }
}

const getStrategyLabel = (strategy) => {
  switch (strategy) {
    case 'single_patient':
      return t('import.strategySinglePatient')
    case 'multiple_patients':
      return t('import.strategyMultiplePatients')
    case 'batch_import':
      return t('import.strategyBatchImport')
    default:
      return t('import.strategyUnknown')
  }
}

const onFileSelected = async (fileData) => {
  logger.info('File selected for import', {
    filename: fileData?.fileInfo?.filename,
    size: fileData?.fileInfo?.size,
    hasContent: !!fileData?.blob,
    contentLength: fileData?.blob?.length,
    contentType: typeof fileData?.blob,
  })

  // Validate file data structure
  if (!fileData || !fileData.blob) {
    logger.error('File data is invalid', { fileData })
    notify.error(t('import.errorFileInvalid'), { timeout: 3000 })
    return
  }

  // Clear any previous selections when starting with a new file
  importStore.clearSelections()

  // Start file analysis
  analyzingFile.value = true
  currentStep.value = 'analyze'

  try {
    // Convert blob (Uint8Array) to string for import services
    let content
    try {
      content = new TextDecoder('utf-8').decode(fileData.blob)
    } catch (decodeError) {
      logger.error('Failed to decode file content', { decodeError, filename: fileData.fileInfo.filename })
      throw new Error('File content cannot be decoded. Please ensure the file is a valid text file.')
    }

    if (!content || content.trim().length === 0) {
      throw new Error('File appears to be empty or contains no readable content.')
    }

    // Throws on failure; resolves with a successful analysis result.
    const analysis = await importStore.analyzeFileContent(content, fileData.fileInfo.filename)
    fileAnalysis.value = analysis

    logger.info('File analysis completed successfully', {
      filename: fileData.fileInfo.filename,
      format: analysis.format,
      patientsCount: analysis.patientsCount,
      visitsCount: analysis.visitsCount,
      observationsCount: analysis.observationsCount,
      recommendedStrategy: analysis.recommendedStrategy,
    })

    notify.success(t('import.toastAnalysisDone'), { timeout: 3000 })
  } catch (error) {
    logger.error('File analysis error occurred', {
      error: error.message,
      stack: error.stack,
      filename: fileData?.fileInfo?.filename,
      contentLength: fileData?.blob?.length,
    })

    // Create a comprehensive error analysis for display
    fileAnalysis.value = {
      success: false,
      errors: [`Analysis failed: ${error.message}`],
      format: 'unknown',
      patientsCount: 0,
      visitsCount: 0,
      observationsCount: 0,
      recommendedStrategy: 'single_patient',
      warnings: [],
      estimatedImportTime: 'N/A',
      errorDetails: {
        message: error.message,
        timestamp: new Date().toISOString(),
        filename: fileData?.fileInfo?.filename || 'unknown',
      },
    }

    notify.error(t('import.errorAnalysisFailed', { msg: error.message }), {
      caption: t('import.errorCheckFormat'),
      timeout: 7000,
    })
  } finally {
    analyzingFile.value = false
  }
}

const onFileCleared = () => {
  logger.info('File cleared from import')
  // Reset all state
  fileAnalysis.value = null
  analyzingFile.value = false
  selectedMode.value = null
  patientMode.value = 'create'
  selectedPatient.value = null
  selectedVisit.value = null
  currentStep.value = 'upload'
  importedPatientCode.value = null
  // Clear any lingering selections from preview dialog
  importStore.clearSelections()
}

const loadDebugFile = async (filename) => {
  debugLoading.value = true

  try {
    logger.info('Loading real debug file', { filename })

    // Load the debug files from the public directory
    const response = await fetch(`/debug-${filename}`)

    if (!response.ok) {
      throw new Error(`Failed to load debug file: ${response.status}`)
    }

    const fileContent = await response.text()

    // Convert string to Uint8Array (mimicking file upload)
    const encoder = new TextEncoder()
    const uint8Array = encoder.encode(fileContent)

    // Determine file type based on extension
    const isJson = filename.toLowerCase().endsWith('.json')
    const isCsv = filename.toLowerCase().endsWith('.csv')
    const mimeType = isJson ? 'application/json' : isCsv ? 'text/csv' : 'text/plain'

    // Create a mock file data structure
    const mockFileData = {
      fileInfo: {
        filename: filename,
        size: uint8Array.length,
        type: mimeType,
      },
      blob: uint8Array,
    }

    logger.info('Successfully loaded debug file', {
      filename: filename,
      size: uint8Array.length,
      contentLength: fileContent.length,
      type: mimeType,
    })

    // Set the selected file and proceed with analysis
    selectedFile.value = mockFileData

    // Clear any existing analysis
    fileAnalysis.value = null
    analyzingFile.value = true
    currentStep.value = 'analyze'

    // Use the existing file analysis logic
    await onFileSelected(mockFileData)

    notify.success(t('import.toastDebugLoaded', { filename }), { timeout: 3000 })
  } catch (error) {
    logger.error('Failed to load debug file', error)
    notify.error(t('import.errorDebugLoadFailed', { msg: error.message }), { timeout: 5000 })
  } finally {
    debugLoading.value = false
  }
}

const retryAnalysis = () => {
  logger.info('Retrying file analysis', {
    filename: selectedFile.value?.fileInfo?.filename,
    hasContent: !!selectedFile.value?.blob,
  })

  if (selectedFile.value) {
    // Reset analysis state and try again
    fileAnalysis.value = null
    analyzingFile.value = true
    currentStep.value = 'analyze'

    // Call the file selected handler again
    onFileSelected(selectedFile.value)
  } else {
    logger.warn('Cannot retry analysis: no file selected')
    notify.error(t('import.errorNoFileSelected'), { timeout: 3000 })
  }
}

const startImport = async () => {
  if (!selectedFile.value || !selectedMode.value) {
    notify.error(t('import.errorMissingInfo'))
    return
  }

  importComplete.value = false
  importError.value = ''
  
  // Clear selections unless user explicitly made selections via preview dialog
  // (selections should only be used if user actively chose them)
  const hasUserSelections = importStore.getCurrentSelections()
  logger.info('Starting import', {
    hasUserSelections: !!hasUserSelections,
    selectionsPatients: hasUserSelections?.patients?.length || 0,
    selectionsVisits: hasUserSelections?.visits?.length || 0,
    mode: selectedMode.value,
    patientMode: patientMode.value,
  })

  try {
    // Convert blob (Uint8Array) to string for import services
    let content
    try {
      content = new TextDecoder('utf-8').decode(selectedFile.value.blob)
    } catch (decodeError) {
      logger.error('Failed to decode file content for import', { decodeError, filename: selectedFile.value.fileInfo.filename })
      throw new Error('File content cannot be decoded. Please ensure the file is a valid text file.')
    }

    if (!content || content.trim().length === 0) {
      throw new Error('File appears to be empty or contains no readable content.')
    }

    // Use the new database import functionality
    logger.info('Starting database import', {
      mode: selectedMode.value,
      patientMode: patientMode.value,
      filename: selectedFile.value.fileInfo.filename,
      hasSelections: !!importStore.getCurrentSelections(),
    })

    const importOptions = {
      mode: selectedMode.value,
      patientMode: patientMode.value,
      selectedPatient: selectedPatient.value,
      selectedVisit: selectedVisit.value,
      duplicateStrategy: 'skip', // Default strategy
      // Pass user selections if they exist
      selections: importStore.getCurrentSelections(),
    }

    // Use the new database import method
    const result = await importStore.importFileToDatabase(content, selectedFile.value.fileInfo.filename, importOptions)

    if (result.success) {
      importComplete.value = true
      importSummary.value = {
        totalRecords: result.data?.statistics?.patients + result.data?.statistics?.visits + result.data?.statistics?.observations || 0,
        successfulImports: 1,
        errors: 0,
        visits: result.data?.statistics?.visits || 0,
        patients: result.data?.statistics?.patients || 0,
        observations: result.data?.statistics?.observations || 0,
        duplicates: result.data?.statistics?.duplicates || 0,
        format: result.data?.metadata?.format || 'unknown',
      }

      // Capture imported patient code for navigation
      // Try multiple sources: selected patient (existing mode), or from file analysis
      if (selectedPatient.value?.PATIENT_CD) {
        importedPatientCode.value = selectedPatient.value.PATIENT_CD
      } else if (fileAnalysis.value?.importStructure?.data?.patients?.[0]?.PATIENT_CD) {
        importedPatientCode.value = fileAnalysis.value.importStructure.data.patients[0].PATIENT_CD
      }

      notify.success(t('import.toastImportDone', { count: importSummary.value.totalRecords }), { timeout: 5000 })

      logger.info('Database import completed successfully', {
        mode: selectedMode.value,
        summary: importSummary.value,
        dbStats: result.data?.statistics,
        importedPatientCode: importedPatientCode.value,
      })
    } else {
      throw new Error(result.errors?.[0]?.message || 'Database import failed')
    }
  } catch (error) {
    logger.error('Database import failed', error)
    importError.value = error.message || 'An error occurred during database import'

    notify.error(t('import.errorImportFailed', { msg: error.message }), { timeout: 7000 })
  }
}

const retryImport = () => {
  importError.value = ''
  startImport()
}

const goBackToUpload = () => {
  importError.value = ''
  // Reset all state
  fileAnalysis.value = null
  analyzingFile.value = false
  selectedMode.value = null
  patientMode.value = 'create'
  selectedPatient.value = null
  selectedVisit.value = null
  currentStep.value = 'upload'
  importedPatientCode.value = null
  // Clear any lingering selections from preview dialog
  importStore.clearSelections()
}

const startOver = () => {
  currentStep.value = 'upload'
  selectedFile.value = null
  fileAnalysis.value = null
  analyzingFile.value = false
  selectedMode.value = null
  patientMode.value = 'create'
  selectedPatient.value = null
  selectedVisit.value = null
  importComplete.value = false
  importSummary.value = null
  importError.value = ''
  importedPatientCode.value = null
  // Clear any lingering selections from preview dialog
  importStore.clearSelections()
}

const goToPatientRecord = () => {
  // Use imported patient code first, then fall back to selected patient
  const patientCode = importedPatientCode.value || selectedPatient.value?.PATIENT_CD
  
  if (patientCode) {
    logger.info('Navigating to patient record', { patientCode })
    router.push(`/patient/${patientCode}`)
  } else {
    logger.warn('No patient code available for navigation', {
      hasImportedCode: !!importedPatientCode.value,
      hasSelectedPatient: !!selectedPatient.value,
    })
    notify.warning(t('import.errorCannotNavigate'), { timeout: 3000 })
  }
}

// Initialize on mount
onMounted(async () => {
  // Always start with file upload
  currentStep.value = 'upload'

  logger.info('Import page loaded with new flow', {
    currentStep: currentStep.value,
  })
})
</script>

<style scoped>
.step-content {
  min-height: 400px;
}

.patient-selection {
  max-width: 600px;
}

.selected-context {
  max-width: 600px;
}

.file-upload-section {
  max-width: 600px;
}

.import-options {
  max-width: 600px;
}

.debug-section {
  max-width: 600px;
}

.debug-section .q-card {
  border: 2px dashed #ff9800;
  background: linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%);
}

.import-summary {
  max-width: 500px;
  margin: 0 auto;
}

.full-width {
  width: 100%;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .patient-selection,
  .selected-context,
  .file-upload-section,
  .import-options {
    max-width: 100%;
  }
}
</style>
