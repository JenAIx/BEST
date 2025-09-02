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
          <div v-if="currentStep === 'upload'" class="header-actions">
            <q-btn flat color="grey-7" icon="arrow_back" label="Back to Patient Selection" @click="goBackToPatientSelection" />
          </div>
        </div>
      </div>

      <!-- Step Indicator -->
      <q-stepper v-model="currentStepNumber" color="primary" animated flat bordered class="q-mb-lg">
        <q-step :name="1" title="Select Patient" icon="person" :done="currentStepNumber > 1" />
        <q-step :name="2" title="Select Visit" icon="event" :done="currentStepNumber > 2" />
        <q-step :name="3" title="Upload File" icon="upload" :done="currentStepNumber > 3" />
        <q-step :name="4" title="Analyze File" icon="search" :done="currentStepNumber > 4" />
        <q-step :name="5" title="Import Data" icon="check" :done="importComplete" />
      </q-stepper>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Step 1: Patient Selection -->
        <div v-if="currentStep === 'patient'" class="step-content">
          <PatientSelectionCard
            title="Select Patient"
            description="Choose the patient for whom you want to import data."
            :selected-patient="selectedPatient"
            @patient-selected="selectPatient"
            @patient-search="onPatientSearch"
          />
        </div>

        <!-- Step 2: Visit Selection (handled by dialog) -->

        <!-- Step 3: File Upload -->
        <div v-if="currentStep === 'upload'" class="step-content">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h6 q-mb-md">Upload Data File</div>
              <div class="text-body2 text-grey-6 q-mb-lg">Upload a file containing patient data to import. Supported formats include CSV, JSON, XML, HL7 CDA, and HTML survey files.</div>

              <!-- Selected Patient/Visit Info -->
              <div class="selected-context q-mb-lg">
                <q-card flat bordered class="bg-blue-1">
                  <q-card-section>
                    <div class="row items-center">
                      <q-icon name="person" size="24px" color="primary" class="q-mr-sm" />
                      <div class="col">
                        <div class="text-subtitle2">{{ getPatientName(selectedPatient) }}</div>
                        <div class="text-caption text-grey-6">Patient ID: {{ selectedPatient.PATIENT_CD }}</div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
                <q-card flat bordered class="bg-green-1 q-mt-sm">
                  <q-card-section>
                    <div class="row items-center">
                      <q-icon name="event" size="24px" color="green" class="q-mr-sm" />
                      <div class="col">
                        <div class="text-subtitle2">{{ getVisitDisplayName() }}</div>
                        <div class="text-caption text-grey-6">{{ getVisitDetails() }}</div>
                      </div>
                      <q-btn flat size="sm" color="green" label="Change Visit" @click="openVisitSelection" />
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- File Upload Component -->
              <div class="file-upload-section">
                <FileUploadInput v-model="selectedFile" :max-size-m-b="50" accepted-types=".csv,.json,.xml,.txt,.xlsx,.xls,.hl7,.html" @file-selected="onFileSelected" @file-cleared="onFileCleared" />
              </div>

              <!-- Import Options -->
              <div v-if="selectedFile" class="import-options q-mt-lg">
                <div class="text-subtitle1 q-mb-md">Import Options</div>

                <q-option-group v-model="importOptions" :options="importOptionList" type="checkbox" color="primary" class="q-mb-md" />

                <div class="text-caption text-grey-6 q-mb-md">
                  <q-icon name="info" class="q-mr-xs" />
                  Select how you want to handle the imported data. You can choose to create new observations or update existing ones.
                </div>

                <!-- Import Button -->
                <div class="q-mt-lg">
                  <q-btn color="primary" icon="upload" label="Start Import" :loading="importing" :disable="!canImport" @click="startImport" class="full-width" />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Step 4: File Analysis -->
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

                    <div class="row q-gutter-md q-mb-md">
                      <div class="col-12 col-md-3">
                        <div class="text-center">
                          <div class="text-h6">{{ fileAnalysis.patientsCount || 0 }}</div>
                          <div class="text-caption text-grey-6">Patients</div>
                        </div>
                      </div>
                      <div class="col-12 col-md-3">
                        <div class="text-center">
                          <div class="text-h6">{{ fileAnalysis.visitsCount || 0 }}</div>
                          <div class="text-caption text-grey-6">Visits</div>
                        </div>
                      </div>
                      <div class="col-12 col-md-3">
                        <div class="text-center">
                          <div class="text-h6">{{ fileAnalysis.observationsCount || 0 }}</div>
                          <div class="text-caption text-grey-6">Observations</div>
                        </div>
                      </div>
                      <div class="col-12 col-md-3">
                        <div class="text-center">
                          <div class="text-h6">{{ fileAnalysis.estimatedImportTime || 'Unknown' }}</div>
                          <div class="text-caption text-grey-6">Est. Time</div>
                        </div>
                      </div>
                    </div>

                    <div class="text-body2 q-mb-sm"><strong>Format:</strong> {{ fileAnalysis.format ? fileAnalysis.format.toUpperCase() : 'Unknown' }}</div>
                    <div class="text-body2 q-mb-sm">
                      <strong>Recommended Strategy:</strong>
                      <q-chip
                        :color="fileAnalysis.recommendedStrategy === 'single_patient' ? 'green' : fileAnalysis.recommendedStrategy === 'batch_import' ? 'orange' : 'blue'"
                        text-color="white"
                        size="sm"
                      >
                        {{ fileAnalysis.recommendedStrategy ? fileAnalysis.recommendedStrategy.replace('_', ' ').toUpperCase() : 'UNKNOWN' }}
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
                  <q-btn color="primary" icon="upload" label="Start Import" @click="startImport" :disable="fileAnalysis.errors && fileAnalysis.errors.length > 0" />
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

        <!-- Step 5: Import Progress/Complete -->
        <div v-if="currentStep === 'import'" class="step-content">
          <q-card flat bordered class="text-center">
            <q-card-section class="q-pa-xl">
              <!-- Importing State -->
              <div v-if="importing" class="importing-state">
                <q-spinner-dots size="60px" color="primary" class="q-mb-md" />
                <div class="text-h5 q-mb-sm">Importing Data...</div>
                <div class="text-body1 text-grey-6 q-mb-lg">{{ importProgress }}</div>
                <q-linear-progress :value="importProgressValue" color="primary" class="q-mt-md" />
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
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from '../stores/visit-observation-store.js'
import { useDatabaseStore } from '../stores/database-store.js'
import { logger } from '../core/services/logging-service.js'
import { ImportService } from '../core/services/imports/import-service.js'
import FileUploadInput from '../components/shared/FileUploadInput.vue'
import VisitSelectionDialog from '../components/questionnaire/VisitSelectionDialog.vue'
import PatientSelectionCard from '../components/shared/PatientSelectionCard.vue'

// Composables
const router = useRouter()
const $q = useQuasar()
const visitStore = useVisitObservationStore()
const dbStore = useDatabaseStore()

// Initialize Import Service with proper repositories
const conceptRepository = dbStore.getRepository('concept')
const cqlRepository = dbStore.getRepository('cql')
const importService = new ImportService(dbStore, conceptRepository, cqlRepository)

// State
const currentStep = ref('patient') // patient -> visit -> upload -> analyze -> import
const selectedPatient = ref(null)
const selectedVisit = ref(null)
const selectedFile = ref(null)
const showVisitDialog = ref(false)
const fileAnalysis = ref(null)
const analyzingFile = ref(false)

// Patient search handled by PatientSelectionCard component

// Import state
const importing = ref(false)
const importComplete = ref(false)
const importProgress = ref('')
const importProgressValue = ref(0)
const importError = ref('')
const importSummary = ref(null)

// Import options
const importOptions = ref(['createNewObservations'])
const importOptionList = [
  { label: 'Create new observations', value: 'createNewObservations' },
  { label: 'Update existing observations (if matching)', value: 'updateExisting' },
  { label: 'Skip duplicate entries', value: 'skipDuplicates' },
  { label: 'Validate data before import', value: 'validateData' },
]

// Computed
const currentStepNumber = computed(() => {
  switch (currentStep.value) {
    case 'patient':
      return 1
    case 'visit':
      return 2
    case 'upload':
      return 3
    case 'analyze':
      return 4
    case 'import':
      return 5
    default:
      return 1
  }
})

const canImport = computed(() => {
  return selectedFile.value && !importing.value
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

const onFileSelected = async (fileData) => {
  logger.info('File selected for import', {
    filename: fileData?.fileInfo?.filename,
    size: fileData?.fileInfo?.size,
    hasContent: !!fileData?.content,
    contentLength: fileData?.content?.length,
    contentType: typeof fileData?.content,
    fileDataKeys: fileData ? Object.keys(fileData) : 'undefined',
    fileInfoKeys: fileData?.fileInfo ? Object.keys(fileData.fileInfo) : 'undefined',
  })

  // Validate file data structure
  if (!fileData) {
    logger.error('File data is null or undefined')
    $q.notify({
      type: 'negative',
      message: 'File data is invalid',
      timeout: 3000,
    })
    return
  }

  if (!fileData.content) {
    logger.error('File content is missing', {
      fileData,
      hasFileInfo: !!fileData.fileInfo,
    })
    $q.notify({
      type: 'negative',
      message: 'File content is empty. Please select a valid file.',
      timeout: 5000,
    })
    return
  }

  // Start file analysis
  analyzingFile.value = true
  currentStep.value = 'analyze'

  try {
    const analysis = await importService.analyzeFileContent(fileData.content, fileData.fileInfo.filename)

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

      // Create a fallback analysis for display
      fileAnalysis.value = {
        success: false,
        errors: analysis.errors || ['Analysis failed'],
        format: 'unknown',
        patientsCount: 0,
        visitsCount: 0,
        observationsCount: 0,
        recommendedStrategy: 'single_patient',
        warnings: analysis.warnings || [],
        estimatedImportTime: 'N/A',
      }
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
  } catch (error) {
    logger.error('File analysis error occurred', {
      error: error.message,
      stack: error.stack,
      filename: fileData?.fileInfo?.filename,
      contentLength: fileData?.content?.length,
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
  // Reset analysis state
  fileAnalysis.value = null
  analyzingFile.value = false
  currentStep.value = 'upload'
}

const retryAnalysis = () => {
  logger.info('Retrying file analysis', {
    filename: selectedFile.value?.fileInfo?.filename,
    hasContent: !!selectedFile.value?.content,
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
  if (!selectedFile.value || !selectedPatient.value || !selectedVisit.value) {
    $q.notify({
      type: 'negative',
      message: 'Missing required information for import',
    })
    return
  }

  importing.value = true
  importComplete.value = false
  importError.value = ''
  importProgress.value = 'Starting import...'
  importProgressValue.value = 0
  currentStep.value = 'import'

  try {
    importProgress.value = 'Reading file...'
    importProgressValue.value = 20

    // Use the real ImportService to import for the specific patient
    const result = await importService.importForPatient(selectedFile.value.content, selectedFile.value.fileInfo.filename, selectedPatient.value.PATIENT_NUM, selectedVisit.value.ENCOUNTER_NUM, {
      createMissingConcepts: true,
      validateData: importOptions.value.includes('validateData'),
      duplicateHandling: importOptions.value.includes('updateExisting') ? 'update' : 'skip',
    })

    if (result.success) {
      importProgress.value = 'Import completed successfully!'
      importProgressValue.value = 100
      importComplete.value = true

      // Set import summary from the result
      importSummary.value = {
        totalRecords: (result.data?.patients?.length || 0) + (result.data?.visits?.length || 0) + (result.data?.observations?.length || 0),
        successfulImports: result.metadata?.savedObservations || 0,
        errors: result.errors?.length || 0,
      }

      $q.notify({
        type: 'positive',
        message: 'Data imported successfully',
        timeout: 3000,
      })

      logger.info('Import completed successfully', {
        patientId: selectedPatient.value.PATIENT_CD,
        visitId: selectedVisit.value.ENCOUNTER_NUM,
        summary: importSummary.value,
        result: result,
      })
    } else {
      // Import failed
      importError.value = result.errors?.[0]?.message || 'Import failed'
      importProgress.value = 'Import failed'
      importProgressValue.value = 0

      $q.notify({
        type: 'negative',
        message: `Import failed: ${importError.value}`,
        timeout: 5000,
      })

      logger.error('Import failed', {
        patientId: selectedPatient.value.PATIENT_CD,
        visitId: selectedVisit.value.ENCOUNTER_NUM,
        errors: result.errors,
      })
    }
  } catch (error) {
    logger.error('Import failed', error)
    importError.value = error.message || 'An error occurred during import'
    importProgress.value = 'Import failed'
    importProgressValue.value = 0

    $q.notify({
      type: 'negative',
      message: `Import failed: ${error.message}`,
      timeout: 5000,
    })
  } finally {
    importing.value = false
  }
}

const retryImport = () => {
  importError.value = ''
  startImport()
}

const goBackToUpload = () => {
  importError.value = ''
  // Reset analysis state
  fileAnalysis.value = null
  analyzingFile.value = false
  currentStep.value = 'upload'
}

const goBackToPatientSelection = () => {
  currentStep.value = 'patient'
  selectedPatient.value = null
  selectedVisit.value = null
  selectedFile.value = null
  fileAnalysis.value = null
  analyzingFile.value = false
  importComplete.value = false
  importSummary.value = null
}

const startOver = () => {
  currentStep.value = 'patient'
  selectedPatient.value = null
  selectedVisit.value = null
  selectedFile.value = null
  fileAnalysis.value = null
  analyzingFile.value = false
  importComplete.value = false
  importSummary.value = null
  importError.value = ''
}

const goToPatientRecord = () => {
  if (selectedPatient.value) {
    router.push(`/patient/${selectedPatient.value.PATIENT_CD}`)
  }
}

// Check for existing patient/visit context on mount
onMounted(async () => {
  // Check if we have patient/visit context from the visit-observation-store
  if (visitStore.selectedPatient && visitStore.selectedVisit) {
    selectedPatient.value = visitStore.selectedPatient
    selectedVisit.value = visitStore.selectedVisit
    currentStep.value = 'upload'

    logger.info('Import page loaded with existing patient/visit context', {
      patientId: selectedPatient.value.id,
      visitId: selectedVisit.value.id,
    })
  } else {
    // No context, start with patient selection
    currentStep.value = 'patient'
  }
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
