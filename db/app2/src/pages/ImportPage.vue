<template>
  <q-page class="import-page">
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header q-mb-lg">
        <div class="row items-center justify-between">
          <div>
            <h1 class="text-h4 q-ma-none">Import Data</h1>
            <p class="text-body1 text-grey-6 q-ma-none">Import patient data from files</p>
          </div>
          <div v-if="currentStep !== 'upload'" class="header-actions">
            <q-btn flat color="grey-7" icon="arrow_back" label="Back to File Upload" @click="goBackToUpload" />
          </div>
        </div>
      </div>

      <!-- Step Indicator -->
      <q-stepper v-model="currentStepNumber" color="primary" animated flat bordered class="q-mb-lg">
        <q-step :name="1" title="Upload File" icon="upload" :done="currentStepNumber > 1" />
        <q-step :name="2" title="Analyze File" icon="search" :done="currentStepNumber > 2" />
        <q-step :name="3" title="Select Mode" icon="settings" :done="currentStepNumber > 3" />
        <q-step :name="4" title="Import Data" icon="check" :done="importComplete" />
      </q-stepper>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Step 1: File Upload -->
        <div v-if="currentStep === 'upload'" class="step-content">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">Upload Data File</div>
              <div class="text-body2 text-grey-6 q-mb-lg">Upload a file containing patient data to import. Supported formats include CSV, JSON, XML, HL7 CDA, and HTML survey files.</div>

              <!-- File Upload Component -->
              <div class="file-upload-section">
                <FileUploadInput v-model="selectedFile" :max-size-m-b="50" accepted-types=".csv,.json,.xml,.txt,.xlsx,.xls,.hl7,.html" @file-selected="onFileSelected" @file-cleared="onFileCleared" />
              </div>

              <!-- File Info Display -->
              <div v-if="selectedFile" class="file-info q-mt-lg">
                <q-card flat bordered class="bg-grey-1">
                  <q-card-section>
                    <div class="text-subtitle1 q-mb-sm">Selected File</div>
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
        <div v-if="currentStep === 'analyze'" class="step-content">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">File Analysis</div>
              <div class="text-body2 text-grey-6 q-mb-lg">Analyzing your file to determine the best import strategy...</div>

              <!-- Analyzing State -->
              <div v-if="analyzingFile" class="analyzing-state">
                <q-spinner-dots size="60px" color="primary" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">Analyzing File...</div>
                <div class="text-body1 text-grey-6">Please wait while we analyze your file structure.</div>
              </div>

              <!-- Analysis Results -->
              <div v-else-if="fileAnalysis && fileAnalysis.success" class="analysis-results">
                <q-card flat bordered class="bg-grey-1 q-mb-lg">
                  <q-card-section>
                    <div class="text-subtitle1 q-mb-md">File Analysis Results</div>

                    <div class="text-body2 q-mb-sm">
                      <strong>Patients:</strong> {{ fileAnalysis.patientsCount || 0 }} • <strong>Visits:</strong> {{ fileAnalysis.visitsCount || 0 }} • <strong>Observations:</strong>
                      {{ fileAnalysis.observationsCount || 0 }} • <strong>Est. Time:</strong> {{ fileAnalysis.estimatedImportTime || 'Unknown' }}
                    </div>

                    <div class="text-body2 q-mb-sm">
                      <strong>File:</strong> {{ fileAnalysis.filename }} • <strong>Format:</strong> {{ fileAnalysis.format ? fileAnalysis.format.toUpperCase() : 'Unknown' }}
                    </div>
                    <div class="text-body2 q-mb-sm">
                      <strong>Recommended Strategy:</strong>
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
                  <q-btn color="primary" icon="arrow_forward" label="Continue to Mode Selection" @click="goToModeSelection" :disable="!fileAnalysis.success" no-caps class="q-px-lg" />
                  <q-btn flat color="grey-7" label="Upload Different File" @click="goBackToUpload" />
                </div>
              </div>

              <!-- Analysis Error -->
              <div v-else-if="fileAnalysis && !fileAnalysis.success" class="analysis-error">
                <q-card flat bordered class="bg-negative-1">
                  <q-card-section>
                    <div class="text-subtitle1 q-mb-md text-negative-8">
                      <q-icon name="error" class="q-mr-sm" />
                      File Analysis Failed
                    </div>

                    <div class="text-body2 text-negative-8 q-mb-md">We encountered an error while analyzing your file. Please check the details below and try again.</div>

                    <!-- Error Details -->
                    <div v-if="fileAnalysis.errors && fileAnalysis.errors.length > 0" class="q-mb-md">
                      <q-banner class="bg-negative-2 text-negative-9" rounded>
                        <template v-slot:avatar>
                          <q-icon name="error_outline" />
                        </template>
                        <div class="text-subtitle2 q-mb-sm">Error Details:</div>
                        <div v-for="(error, index) in fileAnalysis.errors" :key="index" class="q-mb-xs">• {{ typeof error === 'string' ? error : error.message || error }}</div>
                      </q-banner>
                    </div>

                    <!-- Error Details (if available) -->
                    <div v-if="fileAnalysis.errorDetails" class="q-mb-md">
                      <div class="text-caption text-grey-7">
                        <strong>Timestamp:</strong> {{ fileAnalysis.errorDetails.timestamp }}<br />
                        <strong>Filename:</strong> {{ fileAnalysis.errorDetails.filename }}<br />
                        <strong>Message:</strong> {{ fileAnalysis.errorDetails.message }}
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="q-gutter-md">
                      <q-btn color="primary" icon="refresh" label="Try Again" @click="retryAnalysis" />
                      <q-btn flat color="grey-7" label="Upload Different File" @click="goBackToUpload" />
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Step 3: Mode Selection -->
        <div v-if="currentStep === 'mode'" class="step-content">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">Select Import Mode</div>
              <div class="text-body2 text-grey-6 q-mb-lg">Choose how you want to import the data based on the file analysis.</div>

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
                <div class="text-subtitle1 q-mb-md">Patient & Visit Selection</div>

                <!-- Create New Patient Option -->
                <q-radio v-model="patientMode" val="create" label="Create new patient" class="q-mb-md" />

                <!-- Use Existing Patient Option -->
                <q-radio v-model="patientMode" val="existing" label="Add to existing patient" class="q-mb-md" />

                <!-- Patient Selection -->
                <div v-if="patientMode === 'existing'" class="q-mt-md">
                  <PatientSelectionCard
                    title="Select Patient"
                    description="Choose the patient to add the imported data to."
                    :selected-patient="selectedPatient"
                    @patient-selected="selectPatient"
                    @patient-search="onPatientSearch"
                  />
                </div>

                <!-- Visit Selection -->
                <div v-if="patientMode === 'existing' && selectedPatient" class="q-mt-md">
                  <q-btn flat color="green" label="Select Visit" @click="openVisitSelection" />
                  <div v-if="selectedVisit" class="q-mt-sm">
                    <q-chip color="green" text-color="white" icon="event">
                      {{ getVisitDisplayName() }}
                    </q-chip>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="q-gutter-md">
                <q-btn color="primary" icon="arrow_forward" label="Continue to Import" @click="goToImport" :disable="!canProceedToImport" no-caps class="q-px-lg" />
                <q-btn flat color="grey-7" label="Back to Analysis" @click="goBackToAnalysis" />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Step 4: Import Progress/Complete -->
        <div v-if="currentStep === 'import'" class="step-content">
          <q-card flat bordered class="text-center">
            <q-card-section class="q-pa-xl">
              <!-- Importing State -->
              <div v-if="importStore.isImporting" class="importing-state">
                <q-spinner-dots size="60px" color="primary" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">Importing Data...</div>
                <div class="text-body1 text-grey-6 q-mb-lg">{{ importStore.importProgress }}</div>
                <q-linear-progress :value="importStore.importProgressValue / 100" color="primary" class="q-mt-md" />
              </div>

              <!-- Import Complete -->
              <div v-else-if="importComplete" class="import-complete">
                <q-icon name="check_circle" size="80px" color="green" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">Import Completed Successfully!</div>
                <div class="text-body1 text-grey-6 q-mb-lg">Your data has been imported and saved to the patient's record.</div>

                <!-- Import Summary -->
                <div v-if="importSummary" class="import-summary q-mb-lg">
                  <q-card flat bordered class="bg-grey-1">
                    <q-card-section>
                      <div class="text-subtitle1 q-mb-sm">Import Summary</div>
                      <div class="row q-gutter-md justify-center">
                        <div class="text-center">
                          <div class="text-h6">{{ importSummary.totalRecords }}</div>
                          <div class="text-caption text-grey-6">Records Processed</div>
                        </div>
                        <div class="text-center">
                          <div class="text-h6">{{ importSummary.successfulImports }}</div>
                          <div class="text-caption text-grey-6">Successfully Imported</div>
                        </div>
                        <div v-if="importSummary.visits > 1" class="text-center">
                          <div class="text-h6">{{ importSummary.visits }}</div>
                          <div class="text-caption text-grey-6">Visits Created</div>
                        </div>
                        <div v-if="importSummary.errors > 0" class="text-center">
                          <div class="text-h6 text-negative">{{ importSummary.errors }}</div>
                          <div class="text-caption text-grey-6">Errors</div>
                        </div>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>

                <!-- Actions -->
                <div class="q-gutter-md">
                  <q-btn color="primary" label="Import Another File" @click="startOver" />
                  <q-btn flat color="grey-7" label="View Patient Record" @click="goToPatientRecord" />
                </div>
              </div>

              <!-- Import Error -->
              <div v-else-if="importError" class="import-error">
                <q-icon name="error" size="80px" color="negative" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">Import Failed</div>
                <div class="text-body1 text-negative q-mb-lg">{{ importError }}</div>

                <div class="q-gutter-md">
                  <q-btn color="primary" label="Try Again" @click="retryImport" />
                  <q-btn flat color="grey-7" label="Cancel" @click="goBackToUpload" />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Visit Selection Dialog -->
    <VisitSelectionDialog v-if="selectedPatient" v-model="showVisitDialog" :patient="selectedPatient" @visit-selected="onVisitSelected" @cancel="onVisitDialogCancel" />

    <!-- Import Preview Dialog (removed in new flow) -->
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
// import { useVisitObservationStore } from '../stores/visit-observation-store.js' // Not used in new flow
import { useDatabaseStore } from '../stores/database-store.js'
import { useImportStore } from '../stores/import-store.js'
import { logger } from '../core/services/logging-service.js'
import FileUploadInput from '../components/shared/FileUploadInput.vue'
import VisitSelectionDialog from '../components/questionnaire/VisitSelectionDialog.vue'
import PatientSelectionCard from '../components/shared/PatientSelectionCard.vue'
// import ImportPreviewDialog from '../components/shared/ImportPreviewDialog.vue' // Removed in new flow

// Composables
const router = useRouter()
const $q = useQuasar()
const dbStore = useDatabaseStore()
const importStore = useImportStore()

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

// Patient search handled by PatientSelectionCard component

// Import state (using import store)
const importComplete = ref(false)
const importError = ref('')
const importSummary = ref(null)

// Import options (currently not used in new flow)
// const importOptions = ref(['createNewObservations'])
// const importOptionList = [
//   { label: 'Create new observations', value: 'createNewObservations' },
//   { label: 'Validate data before import', value: 'validateData' },
// ]

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

  // Always offer single patient mode
  modes.push({
    label: 'Single Patient Mode',
    value: 'single_patient',
    description: 'Import data for one patient',
  })

  // Offer multiple visits mode if applicable
  if (fileAnalysis.value.hasMultipleVisits) {
    modes.push({
      label: 'Multiple Visits Mode',
      value: 'multiple_visits',
      description: 'Create multiple visits for the selected patient',
    })
  }

  // Offer multiple patients mode if applicable
  if (fileAnalysis.value.hasMultiplePatients) {
    modes.push({
      label: 'Multiple Patients Mode',
      value: 'multiple_patients',
      description: 'Import data for multiple patients',
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
      return 'Single Patient Mode'
    case 'multiple_visits':
      return 'Multiple Visits Mode'
    case 'multiple_patients':
      return 'Multiple Patients Mode'
    case 'batch_import':
      return 'Batch Import Mode'
    default:
      return 'Unknown Mode'
  }
}

const getModeDescription = (mode) => {
  switch (mode) {
    case 'single_patient':
      return 'Import data for a single patient. You can create a new patient or add data to an existing patient.'
    case 'multiple_visits':
      return 'Create multiple visits for the selected patient. Each visit will contain its own set of observations.'
    case 'multiple_patients':
      return 'Import data for multiple patients. Each patient will be created or updated with their respective data.'
    case 'batch_import':
      return 'Bulk import mode for large datasets. All patients and visits will be processed automatically.'
    default:
      return 'Unknown import mode.'
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
        'IMPORT',
        'Data Import',
        JSON.stringify({
          visitNotes: 'Auto-created for data import',
          createdFor: 'import',
        }),
        'IMPORT_SYSTEM',
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
      LOCATION_CD: 'Data Import',
      visitNotes: 'Auto-created for data import',
      isNew: true,
    }

    selectedVisit.value = newVisit
    currentStep.value = 'upload'

    $q.notify({
      type: 'positive',
      message: 'Visit created automatically',
      timeout: 3000,
    })

    logger.info('Auto-created visit for import', {
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
  currentStep.value = 'upload'
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
  if (!selectedVisit.value) return 'No visit selected'

  if (selectedVisit.value.isNew) {
    return 'New Visit (Created)'
  } else {
    const date = new Date(selectedVisit.value.START_DATE)
    return `Visit - ${date.toLocaleDateString()}`
  }
}

// Helper functions (currently not used in new flow)
// const getVisitDetails = () => {
//   if (!selectedVisit.value) return ''
//   const details = []
//   if (selectedVisit.value.LOCATION_CD) {
//     details.push(`Location: ${selectedVisit.value.LOCATION_CD}`)
//   }
//   const statusMap = {
//     A: 'Active',
//     C: 'Completed',
//     S: 'Scheduled',
//     X: 'Cancelled',
//   }
//   const status = statusMap[selectedVisit.value.ACTIVE_STATUS_CD] || selectedVisit.value.ACTIVE_STATUS_CD
//   if (status) {
//     details.push(`Status: ${status}`)
//   }
//   if (selectedVisit.value.visitNotes) {
//     details.push(`Notes: ${selectedVisit.value.visitNotes}`)
//   }
//   return details.join(' • ')
// }

// const getPatientName = (patient) => {
//   if (patient.name) return patient.name
//   if (patient.firstName && patient.lastName) {
//     return `${patient.firstName} ${patient.lastName}`
//   }
//   return patient.PATIENT_CD || 'Unknown Patient'
// }

const getStrategyColor = (strategy) => {
  switch (strategy) {
    case 'single_patient':
      return 'green'
    case 'multiple_visits':
      return 'blue'
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
      return 'SINGLE PATIENT'
    case 'multiple_visits':
      return 'MULTIPLE VISITS'
    case 'multiple_patients':
      return 'MULTIPLE PATIENTS'
    case 'batch_import':
      return 'BATCH IMPORT'
    default:
      return 'UNKNOWN'
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
    $q.notify({
      type: 'negative',
      message: 'File data is invalid or empty',
      timeout: 3000,
    })
    return
  }

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

    // Use the new ImportService for analysis
    const { ImportService } = await import('../core/services/imports/import-service.js')
    const importService = new ImportService(dbStore, null, null)

    const analysis = await importService.analyzeFileContent(content, fileData.fileInfo.filename)

    // Ensure we have a valid analysis result
    if (!analysis) {
      throw new Error('Analysis returned no result')
    }

    fileAnalysis.value = analysis

    if (!analysis.success) {
      const errorMessage = analysis.errors?.[0]?.message || analysis.errors?.[0] || 'Unknown analysis error'
      logger.error('File analysis failed with errors', {
        filename: fileData.fileInfo.filename,
        errors: analysis.errors,
        errorMessage,
      })

      $q.notify({
        type: 'negative',
        message: `File analysis failed: ${errorMessage}`,
        timeout: 5000,
      })
      return
    }

    logger.info('File analysis completed successfully', {
      filename: fileData.fileInfo.filename,
      format: analysis.format,
      patientsCount: analysis.patientsCount,
      visitsCount: analysis.visitsCount,
      observationsCount: analysis.observationsCount,
      recommendedStrategy: analysis.recommendedStrategy,
      hasWarnings: analysis.warnings?.length > 0,
      hasErrors: analysis.errors?.length > 0,
    })

    $q.notify({
      type: 'positive',
      message: 'File analysis completed successfully',
      timeout: 3000,
    })
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

    $q.notify({
      type: 'negative',
      message: `File analysis failed: ${error.message}`,
      caption: 'Please check the file format and try again',
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
    $q.notify({
      type: 'negative',
      message: 'No file selected for analysis',
      timeout: 3000,
    })
  }
}

const startImport = async () => {
  if (!selectedFile.value || !selectedMode.value) {
    $q.notify({
      type: 'negative',
      message: 'Missing required information for import',
    })
    return
  }

  importComplete.value = false
  importError.value = ''

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

    // For now, we'll simulate the import since we're focusing on the UI flow
    // TODO: Implement actual import logic based on selected mode
    logger.info('Starting import simulation', {
      mode: selectedMode.value,
      patientMode: patientMode.value,
      filename: selectedFile.value.fileInfo.filename,
    })

    // Simulate import progress
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulate successful import
    importComplete.value = true
    importSummary.value = {
      totalRecords: fileAnalysis.value?.observationsCount || 0,
      successfulImports: 1,
      errors: 0,
      visits: fileAnalysis.value?.visitsCount || 0,
      patients: fileAnalysis.value?.patientsCount || 0,
      format: fileAnalysis.value?.format || 'unknown',
    }

    $q.notify({
      type: 'positive',
      message: 'Import completed successfully (simulated)',
      timeout: 3000,
    })

    logger.info('Import simulation completed', {
      mode: selectedMode.value,
      summary: importSummary.value,
    })
  } catch (error) {
    logger.error('Import failed', error)
    importError.value = error.message || 'An error occurred during import'

    $q.notify({
      type: 'negative',
      message: `Import failed: ${error.message}`,
      timeout: 5000,
    })
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
}

const goToPatientRecord = () => {
  if (selectedPatient.value) {
    router.push(`/patient/${selectedPatient.value.PATIENT_CD}`)
  }
}

// Import preview dialog function (removed in new flow)
// const proceedWithImport = (selectionData) => {
//   logger.info('User confirmed import from preview dialog', {
//     filename: selectedFile.value?.fileInfo?.filename,
//     patientId: selectedPatient.value?.PATIENT_CD,
//     visitId: selectedVisit.value?.ENCOUNTER_NUM,
//     strategy: fileAnalysis.value?.recommendedStrategy,
//     selectionData: selectionData || null,
//   })
//   // Store selection data for the import process
//   if (selectionData) {
//     logger.info('Survey items selected for import', {
//       selectedItems: selectionData.selectedItems?.length || 0,
//       selectedResults: selectionData.selectedResults?.length || 0,
//       totalSelected: selectionData.totalSelected || 0,
//     })
//   }
//   // Close the preview dialog
//   showPreviewDialog.value = false
//   // Start the actual import process
//   startImport()
// }

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
.import-page {
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

.selected-context {
  max-width: 600px;
}

.file-upload-section {
  max-width: 600px;
}

.import-options {
  max-width: 600px;
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
  .page-container {
    padding: 1rem;
  }

  .page-header {
    padding: 1rem;
  }

  .header-actions {
    margin-top: 1rem;
  }

  .patient-selection,
  .selected-context,
  .file-upload-section,
  .import-options {
    max-width: 100%;
  }
}
</style>
