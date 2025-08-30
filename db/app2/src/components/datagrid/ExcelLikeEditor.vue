<template>
  <div class="excel-editor">
    <!-- Header Controls -->
    <div class="editor-header q-pa-md bg-white shadow-1">
      <div class="row items-center justify-start q-gutter-sm">
        <q-btn flat icon="refresh" label="Refresh" @click="refreshData" :loading="loading" />
        <q-btn flat icon="settings" label="View Options" @click="showViewOptions = true" />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="q-pa-xl text-center">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Loading patient data...</div>
    </div>

    <!-- Excel-like Table -->
    <div v-else class="excel-table-container">
      <q-scroll-area class="excel-scroll-area" :thumb-style="thumbStyle" :bar-style="barStyle">
        <table class="excel-table">
          <!-- Header Row -->
          <thead>
            <tr class="header-row">
              <!-- Fixed columns -->
              <th class="fixed-col patient-col">Patient</th>
              <th class="fixed-col visit-col">Visit Date</th>

              <!-- Dynamic observation columns -->
              <th v-for="concept in visibleObservationConcepts" :key="concept.code" class="obs-col" :title="concept.name">
                <div class="col-header">
                  <div class="concept-name">{{ concept.name }}</div>
                  <div class="concept-code">{{ concept.code }}</div>
                  <!-- Show quiz icon for questionnaire concepts, otherwise use ValueTypeIcon -->
                  <q-icon v-if="concept.valueType === 'Q'" name="quiz" size="16px" color="deep-purple" />
                  <ValueTypeIcon v-else :value-type="concept.valueType" size="16px" variant="minimal" />
                </div>
              </th>
            </tr>
          </thead>

          <!-- Data Rows -->
          <tbody>
            <tr v-for="row in tableRows" :key="`${row.patientId}-${row.encounterNum}`" class="data-row" :class="{ 'has-changes': hasRowChanges(row) }">
              <!-- Fixed columns -->
              <td class="fixed-col patient-col">
                <div class="patient-info">
                  <q-avatar size="24px" color="primary" text-color="white" class="q-mr-xs">
                    {{ getPatientInitials(row.patientName) }}
                  </q-avatar>
                  <div>
                    <div class="patient-name">{{ row.patientName }}</div>
                    <div class="patient-id">{{ row.patientId }}</div>
                  </div>
                </div>
              </td>

              <td class="fixed-col visit-col">
                <div class="visit-date-container">
                  <div class="visit-date">
                    {{ formatDate(row.visitDate) }}
                  </div>
                  <div class="visit-edit-icon" @click="openVisitEditDialog(row)">
                    <q-icon name="edit" size="16px" color="grey-6" />
                  </div>
                  <q-tooltip anchor="top middle" self="bottom middle" :offset="[10, 10]" class="bg-grey-9 text-white">
                    <div class="tooltip-content">
                      <div class="text-weight-bold q-mb-xs">Visit Information</div>
                      <div><strong>Patient:</strong> {{ row.patientName }}</div>
                      <div><strong>Encounter:</strong> {{ row.encounterNum }}</div>
                      <div><strong>Date:</strong> {{ formatDate(row.visitDate) }}</div>
                      <div class="text-grey-4 text-caption q-mt-xs">Click edit icon to modify visit</div>
                    </div>
                  </q-tooltip>
                </div>
              </td>

              <!-- Observation cells -->
              <td v-for="concept in visibleObservationConcepts" :key="concept.code" class="obs-cell" :class="getCellClass(row, concept)">
                <!-- Custom questionnaire cell for Q type -->
                <div v-if="concept.valueType === 'Q'" class="questionnaire-cell">
                  <!-- Filled questionnaire -->
                  <div v-if="getCellValue(row, concept)" class="questionnaire-content" @click="openQuestionnairePreview(row, concept)">
                    {{ getCellValue(row, concept) }}
                    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 5]">
                      Click to view questionnaire data
                    </q-tooltip>
                  </div>
                  <!-- Empty questionnaire - clickable to fill -->
                  <div v-else class="questionnaire-empty" @click="openQuestionnaireFillDialog(row, concept)">
                    <q-icon name="add" size="16px" color="grey-5" />
                    <div class="empty-label">Add</div>
                    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 5]">
                      Click to complete questionnaire
                    </q-tooltip>
                  </div>
                </div>
                <!-- Regular editable cell for other types -->
                <EditableCell
                  v-else
                  :value="getCellValue(row, concept)"
                  :value-type="concept.valueType"
                  :concept-code="concept.code"
                  :patient-id="row.patientId"
                  :encounter-num="row.encounterNum"
                  :observation-id="getCellObservationId(row, concept)"
                  @update="onCellUpdate"
                  @save="onCellSave"
                  @error="onCellError"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </q-scroll-area>
    </div>

    <!-- View Options Dialog -->
    <ViewOptionsDialog
      v-model="showViewOptions"
      :view-options="viewOptions"
      :observation-concepts="observationConcepts"
      :column-visibility="dataGridStore?.columnVisibility ? Object.fromEntries(dataGridStore.columnVisibility) : {}"
      @update:view-options="updateViewOptions"
      @update:column-visibility="handleColumnVisibilityUpdate"
      @update:column-order="handleColumnOrderUpdate"
    />

    <!-- Edit Visit Dialog -->
    <EditVisitDialog v-if="selectedVisitData" v-model="showVisitEditDialog" :patient="selectedVisitData" :visit="selectedVisitData" @visitUpdated="handleVisitUpdated" />

    <!-- Questionnaire Preview Dialog -->
    <QuestionnairePreviewDialog
      v-if="selectedQuestionnaireData"
      v-model="showQuestionnairePreview"
      :observation-id="selectedQuestionnaireData.observationId"
      :concept-name="selectedQuestionnaireData.conceptName"
      :completion-date="selectedQuestionnaireData.completionDate"
    />

    <!-- Questionnaire Fill Dialog -->
    <QuestionnaireFillDialog
      v-if="selectedQuestionnaireFillData"
      v-model="showQuestionnaireFillDialog"
      :encounter-num="selectedQuestionnaireFillData.encounterNum"
      :patient-id="selectedQuestionnaireFillData.patientId"
      :questionnaire-blob="selectedQuestionnaireFillData.questionnaireBlob"
      :concept-code="selectedQuestionnaireFillData.conceptCode"
      :concept-name="selectedQuestionnaireFillData.conceptName"
      :patient-name="selectedQuestionnaireFillData.patientName"
      :visit-date="selectedQuestionnaireFillData.visitDate"
      @questionnaire-completed="handleQuestionnaireCompleted"
      @close="handleQuestionnaireClosed"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDataGridStore } from 'src/stores/data-grid-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ValueTypeIcon from 'src/components/shared/ValueTypeIcon.vue'
import EditableCell from './EditableCell.vue'
import ViewOptionsDialog from './ViewOptionsDialog.vue'
import EditVisitDialog from 'src/components/patient/EditVisitDialog.vue'
import QuestionnairePreviewDialog from 'src/components/shared/QuestionnairePreviewDialog.vue'
import QuestionnaireFillDialog from 'src/components/shared/QuestionnaireFillDialog.vue'

// Excel-like editor for multi-patient observation editing

const props = defineProps({
  patientIds: {
    type: Array,
    required: true,
  },
})

// No longer need to emit events - store handles reactivity

const $q = useQuasar()
const dataGridStore = useDataGridStore()
const conceptStore = useConceptResolutionStore()
const databaseStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ExcelLikeEditor')

// Local component state (only what's component-specific)
const showViewOptions = ref(false)
const showVisitEditDialog = ref(false)
const selectedVisitData = ref(null)

// Questionnaire dialogs state
const showQuestionnairePreview = ref(false)
const selectedQuestionnaireData = ref(null)
const showQuestionnaireFillDialog = ref(false)
const selectedQuestionnaireFillData = ref(null)


// Computed properties (using store data)
const loading = computed(() => dataGridStore?.loading || false)
const observationConcepts = computed(() => dataGridStore?.observationConcepts || [])

// Use store's reactive properties for visibility and statistics
const visibleObservationConcepts = computed(() => dataGridStore?.getVisibleObservationConcepts || [])

const tableRows = computed(() => dataGridStore?.tableRows || [])
const viewOptions = computed(() => dataGridStore?.viewOptions || {})

// Scroll area styling
const thumbStyle = {
  right: '4px',
  borderRadius: '5px',
  backgroundColor: '#027be3',
  width: '5px',
  opacity: 0.75,
}

const barStyle = {
  right: '2px',
  borderRadius: '9px',
  backgroundColor: '#027be3',
  width: '9px',
  opacity: 0.2,
}

// Data loading methods (using store functions)
const loadPatientData = async () => {
  if (dataGridStore?.loadGridData) {
    await dataGridStore.loadGridData(props.patientIds)

    // Initialize column visibility and order after loading data
    if (dataGridStore?.initializeColumnVisibility) {
      dataGridStore.initializeColumnVisibility()
    }
    if (dataGridStore?.initializeColumnOrder) {
      dataGridStore.initializeColumnOrder()
    }
  }
}

// Helper methods (using store functions) - with defensive checks
const getPatientInitials = dataGridStore?.getPatientInitials || (() => 'U')
const formatDate = dataGridStore?.formatDate || ((date) => date || '')
const getCellValue = dataGridStore?.getCellValue || (() => '')
const getCellObservationId = dataGridStore?.getCellObservationId || (() => null)
const getCellClass = dataGridStore?.getCellClass || (() => '')
const hasRowChanges = dataGridStore?.hasRowChanges || (() => false)

// Helper function to get observation count for a visit
const getObservationCount = async (encounterNum) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM OBSERVATION_FACT
      WHERE ENCOUNTER_NUM = ?
    `
    const result = await databaseStore.executeQuery(query, [encounterNum])
    return result.success && result.data.length > 0 ? result.data[0].count : 0
  } catch (error) {
    logger.warn('Failed to get observation count', error)
    return 0
  }
}

// Event handlers (using store functions) - with defensive checks
const onCellUpdate = dataGridStore?.handleCellUpdate || (() => {})
const onCellSave = dataGridStore?.handleCellSave || (() => {})
const onCellError = dataGridStore?.handleCellError || (() => {})


// Batch operations (using store functions) - with defensive checks
const refreshData = () => {
  if (dataGridStore?.refreshData) {
    dataGridStore.refreshData(props.patientIds)
  }
}

// View options management (delegate to store)
const updateViewOptions = dataGridStore.updateViewOptions

// Column management handlers - delegate to store
const handleColumnVisibilityUpdate = (...args) => {
  // Handle both individual updates (columnCode, visible) and batch updates (visibilityObject)
  if (args.length === 2 && typeof args[0] === 'string') {
    // Individual column update: (columnCode, visible)
    const [columnCode, visible] = args
    dataGridStore.updateColumnVisibility(columnCode, visible)


  } else if (args.length === 1 && typeof args[0] === 'object') {
    // Batch update: (visibilityObject)
    const visibilityObject = args[0]
    Object.entries(visibilityObject).forEach(([columnCode, visible]) => {
      dataGridStore.updateColumnVisibility(columnCode, visible)
    })

    // Batch updates completed silently
  }
}

const handleColumnOrderUpdate = (columnOrder) => {
  logger.info('Column order updated', { columnOrder })

  // Update the column order in the store
  if (dataGridStore?.updateColumnOrder) {
    dataGridStore.updateColumnOrder(columnOrder)
  }

  // Column order updated silently
}

// Visit edit dialog methods
const openVisitEditDialog = async (row) => {
  logger.info('Opening visit edit dialog', { patientId: row.patientId, encounterNum: row.encounterNum })

  try {
    // Load complete visit data from database (same pattern as visit-observation-store)
    const visitRepo = databaseStore.getRepository('visit')
    const patientRepo = databaseStore.getRepository('patient')

    // Get patient data
    const patient = await patientRepo.findByPatientCode(row.patientId)
    if (!patient) {
      throw new Error('Patient not found')
    }

    // Get visit data
    const visitData = await visitRepo.findById(row.encounterNum)
    if (!visitData) {
      throw new Error('Visit not found')
    }

    // Get observation count for the visit (for logging purposes)
    const observationCount = await getObservationCount(row.encounterNum)

    // Parse VISIT_BLOB to extract visitType and notes (same as visit-observation-store)
    let visitType = 'routine'
    let visitNotes = ''
    if (visitData.VISIT_BLOB) {
      try {
        const blobData = JSON.parse(visitData.VISIT_BLOB)
        visitType = blobData.visitType || 'routine'
        visitNotes = blobData.notes || ''
      } catch (error) {
        logger.warn('Failed to parse VISIT_BLOB', error, { visitBlob: visitData.VISIT_BLOB })
        visitNotes = visitData.VISIT_BLOB // Fallback to raw blob as notes
      }
    }

    // Log the loaded visit data for debugging
    logger.debug('Loaded visit data from database', {
      encounterNum: visitData.ENCOUNTER_NUM,
      startDate: visitData.START_DATE,
      endDate: visitData.END_DATE,
      status: visitData.ACTIVE_STATUS_CD,
      location: visitData.LOCATION_CD,
      inoutCd: visitData.INOUT_CD,
      sourceSystem: visitData.SOURCESYSTEM_CD,
      visitBlob: visitData.VISIT_BLOB,
      extractedVisitType: visitType,
      extractedNotes: visitNotes,
      observationCount: observationCount,
    })

    // Prepare data for the dialog (patient + visit structure that EditVisitDialog expects)
    selectedVisitData.value = {
      // Patient data
      PATIENT_CD: row.patientId,
      patientId: row.patientId,
      patientName: row.patientName,
      
      // Visit data structure that EditVisitDialog expects
      visit: {
        // Raw database fields that EditVisitDialog directly accesses
        ENCOUNTER_NUM: visitData.ENCOUNTER_NUM,
        START_DATE: visitData.START_DATE,
        END_DATE: visitData.END_DATE,
        UPDATE_DATE: visitData.UPDATE_DATE,
        ACTIVE_STATUS_CD: visitData.ACTIVE_STATUS_CD,
        LOCATION_CD: visitData.LOCATION_CD,
        INOUT_CD: visitData.INOUT_CD,
        SOURCESYSTEM_CD: visitData.SOURCESYSTEM_CD,
        VISIT_BLOB: visitData.VISIT_BLOB, // Raw JSON blob for EditVisitDialog to parse
        
        // Additional fields for compatibility
        encounterNum: visitData.ENCOUNTER_NUM,
        visitType: visitType,
        notes: visitNotes,
      }
    }

    showVisitEditDialog.value = true

    logger.debug('Prepared complete visit data for edit dialog', {
      encounterNum: row.encounterNum,
      visitType: visitType,
      visitNotes: visitNotes,
      hasVisitBlob: !!visitData.VISIT_BLOB,
      rawVisitBlob: visitData.VISIT_BLOB,
      status: visitData.ACTIVE_STATUS_CD,
      location: visitData.LOCATION_CD,
      startDate: visitData.START_DATE,
      endDate: visitData.END_DATE,
      inoutCd: visitData.INOUT_CD,
      sourceSystem: visitData.SOURCESYSTEM_CD,
      selectedVisitDataStructure: {
        hasVisitProperty: !!selectedVisitData.value.visit,
        visitKeys: selectedVisitData.value.visit ? Object.keys(selectedVisitData.value.visit) : null,
        patientKeys: Object.keys(selectedVisitData.value),
      }
    })

  } catch (error) {
    logger.error('Failed to load visit data for edit dialog', error, {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
    })

    $q.notify({
      type: 'negative',
      message: `Failed to load visit data: ${error.message}`,
      position: 'top',
    })
  }
}

const handleVisitUpdated = (updatedVisit) => {
  logger.info('Visit updated successfully', { updatedVisit })

  // Refresh the data grid to show the updated visit information
  refreshData()

  $q.notify({
    type: 'positive',
    message: `Visit ${updatedVisit.ENCOUNTER_NUM} updated successfully`,
    position: 'top',
  })
}

// Questionnaire fill dialog methods
const handleQuestionnaireCompleted = (completedData) => {
  logger.info('Questionnaire completed successfully', {
    patientId: completedData.patientId,
    encounterNum: completedData.encounterNum,
  })

  // Refresh the data grid to show the new questionnaire data
  refreshData()

  $q.notify({
    type: 'positive',
    message: 'Questionnaire completed and saved successfully',
    position: 'top',
    timeout: 3000,
  })
}

const handleQuestionnaireClosed = () => {
  logger.debug('Questionnaire dialog closed without completion')
  // No need to refresh data since nothing was saved
}

const findQuestionnaireNameInColumn = (conceptCode) => {
  try {
    // Look through all table rows to find a filled questionnaire for this concept
    const rows = tableRows.value || []
    
    for (const row of rows) {
      const cellValue = getCellValue(row, { code: conceptCode })
      if (cellValue && cellValue.trim() !== '') {
        logger.info('Found questionnaire name in column', {
          conceptCode,
          questionnaireName: cellValue,
          patientId: row.patientId,
          encounterNum: row.encounterNum
        })
        return cellValue.trim()
      }
    }
    
    logger.info('No filled questionnaire found in column', { conceptCode })
    return null
  } catch (error) {
    logger.error('Failed to find questionnaire name in column', error, { conceptCode })
    return null
  }
}

const getAvailableQuestionnaires = async () => {
  try {
    const templateResult = await databaseStore.executeQuery(
      `SELECT NAME_CHAR, CODE_CD, LOOKUP_BLOB
       FROM CODE_LOOKUP
       WHERE TABLE_CD = 'SURVEY_BEST' 
       AND COLUMN_CD = 'QUESTIONNAIRE'
       AND LOOKUP_BLOB IS NOT NULL
       ORDER BY NAME_CHAR`,
      []
    )

    if (templateResult.success) {
      return templateResult.data.map(t => ({
        name: t.NAME_CHAR,
        code: t.CODE_CD,
        blob: t.LOOKUP_BLOB
      }))
    }

    return []
  } catch (error) {
    logger.error('Failed to get available questionnaires', error)
    return []
  }
}

const getQuestionnaireTemplateByName = async (questionnaireName) => {
  try {
    logger.info('Getting questionnaire template by name', { questionnaireName })

    // Get clean template from CODE_LOOKUP table by name
    const templateResult = await databaseStore.executeQuery(
      `SELECT LOOKUP_BLOB, NAME_CHAR, CODE_CD
       FROM CODE_LOOKUP
       WHERE TABLE_CD = 'SURVEY_BEST' 
       AND COLUMN_CD = 'QUESTIONNAIRE'
       AND (NAME_CHAR = ? OR NAME_CHAR LIKE ?)
       AND LOOKUP_BLOB IS NOT NULL
       LIMIT 1`,
      [questionnaireName, `%${questionnaireName}%`]
    )

    if (templateResult.success && templateResult.data.length > 0) {
      const template = templateResult.data[0]
      
      try {
        const parsed = JSON.parse(template.LOOKUP_BLOB)
        logger.info('Found matching questionnaire template', {
          questionnaireName,
          foundName: template.NAME_CHAR,
          code: template.CODE_CD,
          title: parsed.title,
          itemCount: parsed.items?.length || 0,
          firstItemType: parsed.items?.[0]?.type
        })
        return template.LOOKUP_BLOB
      } catch (parseError) {
        logger.error('Failed to parse template BLOB', { questionnaireName, error: parseError.message })
        return null
      }
    }

    logger.warn('No template found for questionnaire name', { questionnaireName })
    return null

  } catch (error) {
    logger.error('Failed to get questionnaire template by name', error, { questionnaireName })
    return null
  }
}

const createNewQuestionnaireColumn = async (questionnaireName, baseConceptCode) => {
  try {
    logger.info('Creating new questionnaire column', { questionnaireName, baseConceptCode })

    // Generate unique concept code for this questionnaire instance
    const timestamp = Date.now()
    const newConceptCode = `${baseConceptCode}_${questionnaireName.toUpperCase().replace(/\s+/g, '_')}_${timestamp}`

    // Create concept in CONCEPT_DIMENSION
    const conceptResult = await databaseStore.executeQuery(
      `INSERT INTO CONCEPT_DIMENSION (
        CONCEPT_CD, NAME_CHAR, CONCEPT_BLOB, UPDATE_DATE, DOWNLOAD_DATE, 
        IMPORT_DATE, SOURCESYSTEM_CD, UPLOAD_ID, VALTYPE_CD, CATEGORY_CHAR
      ) VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'), ?, ?, ?, ?)`,
      [
        newConceptCode,
        `${questionnaireName} - Instance`,
        JSON.stringify({ 
          questionnaireName: questionnaireName,
          baseConceptCode: baseConceptCode,
          createdAt: new Date().toISOString()
        }),
        'SYSTEM',
        1,
        'Q',
        'CAT_ASSESSMENT'
      ]
    )

    if (!conceptResult.success) {
      throw new Error('Failed to create concept in database')
    }

    // Add concept to grid
    const newConcept = {
      CONCEPT_CD: newConceptCode,
      NAME_CHAR: `${questionnaireName} - Instance`,
      VALTYPE_CD: 'Q'
    }

    const addResult = dataGridStore.addConceptToGrid(newConcept)
    
    if (!addResult.success) {
      throw new Error('Failed to add concept to grid')
    }

    logger.info('New questionnaire column created successfully', {
      newConceptCode,
      questionnaireName,
      addResult
    })

    return newConceptCode

  } catch (error) {
    logger.error('Failed to create new questionnaire column', error, {
      questionnaireName,
      baseConceptCode
    })
    throw error
  }
}

const openQuestionnaireFillDialog = async (row, concept) => {
  logger.info('Opening questionnaire fill dialog', {
    patientId: row.patientId,
    encounterNum: row.encounterNum,
    conceptCode: concept.code,
    conceptName: concept.name,
  })

  try {
    // Step 1: Find what questionnaire name is used in this column
    let questionnaireName = findQuestionnaireNameInColumn(concept.code)
    let targetConceptCode = concept.code
    
    if (!questionnaireName) {
      // No existing questionnaire found - show selection dialog
      const availableQuestionnaires = await getAvailableQuestionnaires()
      
      if (availableQuestionnaires.length === 0) {
        $q.notify({
          type: 'warning',
          message: 'No questionnaire templates available',
          position: 'top',
        })
        return
      }

      // For now, use the first available questionnaire
      // TODO: In future, show selection dialog for user to choose
      questionnaireName = availableQuestionnaires[0].name
      
      // Create new column for this questionnaire type
      targetConceptCode = await createNewQuestionnaireColumn(questionnaireName, concept.code)
      
      logger.info('Created new questionnaire column', {
        questionnaireName,
        originalConceptCode: concept.code,
        newConceptCode: targetConceptCode
      })
    }

    // Step 2: Get clean template for this questionnaire name from CODE_LOOKUP
    const questionnaireBlob = await getQuestionnaireTemplateByName(questionnaireName)
    
    if (!questionnaireBlob) {
      $q.notify({
        type: 'warning',
        message: `No template found for questionnaire: ${questionnaireName}`,
        position: 'top',
      })
      return
    }

    // Prepare data for the questionnaire fill dialog
    selectedQuestionnaireFillData.value = {
      encounterNum: row.encounterNum,
      patientId: row.patientId,
      questionnaireBlob: questionnaireBlob,
      conceptCode: targetConceptCode,
      conceptName: concept.name,
      questionnaireName: questionnaireName,
      patientName: row.patientName,
      visitDate: row.visitDate,
    }

    showQuestionnaireFillDialog.value = true

    logger.debug('Prepared questionnaire fill data', {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      originalConceptCode: concept.code,
      targetConceptCode: targetConceptCode,
      questionnaireName: questionnaireName,
      hasBlobData: !!questionnaireBlob,
      blobLength: questionnaireBlob?.length || 0,
    })

  } catch (error) {
    logger.error('Failed to open questionnaire fill dialog', error, {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      conceptCode: concept.code,
    })

    $q.notify({
      type: 'negative',
      message: 'Failed to open questionnaire dialog',
      position: 'top',
    })
  }
}

// Questionnaire preview dialog methods
const openQuestionnairePreview = async (row, concept) => {
  logger.info('Opening questionnaire preview', {
    patientId: row.patientId,
    encounterNum: row.encounterNum,
    conceptCode: concept.code,
    conceptName: concept.name,
  })

  try {
    const observationId = getCellObservationId(row, concept)
    const cellValue = getCellValue(row, concept)

    if (!observationId) {
      logger.warn('No observation ID found for questionnaire cell', {
        patientId: row.patientId,
        encounterNum: row.encounterNum,
        conceptCode: concept.code,
      })
      $q.notify({
        type: 'warning',
        message: 'No questionnaire data available for this cell',
        position: 'top',
      })
      return
    }

    // Prepare data for the questionnaire preview dialog
    selectedQuestionnaireData.value = {
      observationId: observationId,
      conceptName: concept.name,
      completionDate: row.visitDate,
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      value: cellValue,
    }

    showQuestionnairePreview.value = true

    logger.debug('Prepared questionnaire data for preview', {
      observationId: observationId,
      conceptName: concept.name,
      hasValue: !!cellValue,
    })

  } catch (error) {
    logger.error('Failed to open questionnaire preview', error, {
      patientId: row.patientId,
      encounterNum: row.encounterNum,
      conceptCode: concept.code,
    })

    $q.notify({
      type: 'negative',
      message: 'Failed to open questionnaire preview',
      position: 'top',
    })
  }
}

// Watch for view options changes (store handles persistence)
watch(
  () => dataGridStore.viewOptions,
  (newOptions) => {
    // Store automatically handles persistence
    logger.debug('View options changed', { newOptions })
  },
  { deep: true },
)



// Lifecycle
onMounted(async () => {
  // Initialize stores
  if (dataGridStore?.initialize) {
    dataGridStore.initialize()
  }
  if (conceptStore?.initialize) {
    await conceptStore.initialize()
  }

  await loadPatientData()
})


</script>

<style lang="scss" scoped>
.excel-editor {
  height: 100%; // Full height since footer is in GridLayout
  display: flex;
  flex-direction: column;
  background: $grey-1;
}

.editor-header {
  flex-shrink: 0;
  border-bottom: 1px solid $grey-4;
}

.excel-table-container {
  flex: 1;
  overflow: hidden;
  background: white;
}

.excel-scroll-area {
  height: 100%;
}

.excel-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;

  .header-row {
    position: sticky;
    top: 0;
    z-index: 10;
    background: $grey-2;

    th {
      padding: 8px 6px;
      border: 1px solid $grey-4;
      border-top: none;
      font-weight: 600;
      text-align: center;
      background: $grey-2;
      position: relative;
      height: 60px;
      vertical-align: middle;

      &.fixed-col {
        position: sticky;
        left: 0;
        z-index: 11;
        background: $grey-3;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
        text-align: left; // Override center alignment for fixed column headers
      }

      &.patient-col {
        left: 0;
        width: 200px;
        min-width: 200px;
      }

      &.visit-col {
        left: 200px;
        width: 120px;
        min-width: 120px;
        text-align: center; // Center align visit date header
      }

      &.obs-col {
        width: 150px;
        min-width: 150px;

        .col-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;

          .concept-name {
            font-size: 0.75rem;
            font-weight: 600;
            text-align: center;
            line-height: 1.2;
            max-height: 2.4em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-clamp: 2;
          }

          .concept-code {
            font-size: 0.65rem;
            color: $grey-6;
            font-weight: normal;
          }
        }
      }
    }
  }

  .data-row {
    &:hover {
      background: $blue-1;
    }

    &.has-changes {
      background: $orange-1;
      border-left: 3px solid $orange-6;
    }

    td {
      padding: 4px 6px;
      border: 1px solid $grey-4;
      border-top: none;
      vertical-align: middle;
      text-align: center;
      height: 40px;

      &.fixed-col {
        position: sticky;
        background: white;
        z-index: 5;
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
        text-align: left; // Override center alignment for fixed columns

        &.patient-col {
          left: 0;
        }

        &.visit-col {
          left: 200px;
          text-align: center; // Center align visit date
        }
      }

      &.obs-cell {
        width: 150px;
        min-width: 150px;
        padding: 2px;
        text-align: center;
        vertical-align: middle;

        // Override EditableCell alignment for all value types
        :deep(.editable-cell) {
          text-align: center !important;
          
          &.value-type-n {
            text-align: center !important; // Override right alignment for numeric values
          }
          
          .cell-display {
            justify-content: center;
            text-align: center;
            
            .cell-value {
              text-align: center;
            }
          }
          
          .cell-edit {
            .cell-input {
              :deep(.q-field__native) {
                text-align: center !important;
              }
              
              :deep(input) {
                text-align: center !important;
              }
            }
          }
        }

        &.has-value {
          background: white;
        }

        &.empty-cell {
          background: $grey-1;
        }

        // Questionnaire cell styling
        .questionnaire-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          height: 100%;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.2s ease;

          &:hover {
            background: rgba($primary, 0.08);
          }

          .questionnaire-content {
            font-size: 0.875rem;
            text-align: center;
            line-height: 1.2;
            word-break: break-word;
            color: $grey-8;
            cursor: pointer;
          }

          .questionnaire-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            cursor: pointer;
            color: $grey-5;

            &:hover {
              color: $primary;
            }

            .empty-label {
              font-size: 0.65rem;
              font-weight: 400;
              text-align: center;
              line-height: 1.1;
            }
          }
        }
      }
    }
  }
}

.patient-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .patient-name {
    font-weight: 500;
    font-size: 0.875rem;
    line-height: 1.2;
  }

  .patient-id {
    font-size: 0.75rem;
    color: $grey-6;
  }
}

.visit-date-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  cursor: help;
  height: 100%;

  &:hover .visit-edit-icon {
    opacity: 1;
    visibility: visible;
  }
}

.visit-date {
  font-size: 0.8rem;
  color: $grey-8;
  text-align: center;
  line-height: 1.2;
}

.visit-edit-icon {
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  position: absolute;
  top: 2px;
  right: 2px;

  &:hover {
    background: rgba(0, 0, 0, 0.08);
    opacity: 1 !important;

    .q-icon {
      color: $primary !important;
    }
  }

  .q-icon {
    transition: color 0.2s ease;
  }
}

.tooltip-content {
  font-size: 0.75rem;
  line-height: 1.4;

  div {
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: $grey-4;
      font-weight: 600;
    }
  }
}

// Responsive adjustments
@media (max-width: 1200px) {
  .excel-table {
    .header-row th.obs-col {
      width: 120px;
      min-width: 120px;
    }

    .data-row td.obs-cell {
      width: 120px;
      min-width: 120px;
    }
  }
}

@media (max-width: 768px) {
  .editor-header {
    .row {
      flex-direction: column;
      gap: 12px;
    }
  }

  .excel-table {
    .header-row th {
      &.patient-col {
        width: 150px;
        min-width: 150px;
      }

      &.visit-col {
        left: 150px;
        width: 100px;
        min-width: 100px;
      }

      &.obs-col {
        width: 100px;
        min-width: 100px;
      }
    }

    .data-row td {
      &.patient-col {
        width: 150px;
      }

      &.visit-col {
        left: 150px;
        width: 100px;
      }

      &.obs-cell {
        width: 100px;
        min-width: 100px;
      }
    }
  }
}

// New observation dialog styles
.concept-search-section {
  .search-results {
    .concept-item {
      transition: all 0.2s ease;

      &:hover {
        background-color: rgba(25, 118, 210, 0.08);
      }

      &.already-added {
        background-color: rgba(76, 175, 80, 0.05);
        border-left: 3px solid #4caf50;

        &:hover {
          background-color: rgba(76, 175, 80, 0.08);
        }
      }
    }
  }
}
</style>
