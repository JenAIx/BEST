<template>
  <div class="data-entry-view">
    <div class="entry-container">
      <!-- Visit Selector -->
      <VisitSelector :patient="patient" @visit-selected="onVisitSelected" @create-new-visit="createNewVisit" @edit-visit="editSelectedVisit" @preview-visit="previewSelectedVisit" />

      <!-- Field Set Selector -->
      <FieldSetSelector
        v-if="selectedVisit"
        :available-field-sets="availableFieldSets"
        :active-field-sets="activeFieldSets"
        :get-field-set-observation-count="getFieldSetObservationCount"
        :overall-stats="overallStats"
        @toggle-field-set="toggleFieldSet"
        @show-config="showFieldSetConfig = true"
      />

      <!-- Add Observation Button -->
      <div v-if="selectedVisit" class="add-observation-section">
        <q-btn flat icon="add" :label="$t('observation.addObservation').toUpperCase()" @click="showAddCustomDialog = true" class="add-observation-btn full-width" style="border: 2px dashed #ccc" :title="$t('observation.addCustomObservation')" />
      </div>

      <!-- Observation Forms -->
      <div v-if="selectedVisit && activeFieldSets.length > 0" class="observation-forms">
        <template v-for="fieldSet in activeFieldSetsList" :key="`${selectedVisit.id}-${fieldSet.id}`">
          <!-- Questionnaire FieldSet (special rendering) -->
          <VisitQuestionnaireSection
            v-if="fieldSet.id === 'questionnaires'"
            :visit="selectedVisit"
            :patient="patient"
            :field-set="fieldSet"
            :questionnaires="visitQuestionnaires"
            @add-questionnaire="showAddQuestionnaireDialog = true"
            @fill-questionnaire="onFillQuestionnaire"
            @view-questionnaire="onViewQuestionnaire"
            @remove-questionnaire="onRemoveQuestionnaire"
          />
          <!-- Regular FieldSet -->
          <ObservationFieldSet
            v-else
            :field-set="fieldSet"
            :visit="selectedVisit"
            :patient="patient"
            :previous-visits="previousVisits"
            :existing-observations="getFieldSetObservations(fieldSet.id)"
            @observation-updated="onObservationUpdated"
            @clone-from-previous="onCloneFromPrevious"
          />
        </template>

        <!-- Uncategorized Observations Section -->
        <ObservationFieldSet
          v-if="uncategorizedFieldSet"
          :key="`${selectedVisit.id}-uncategorized`"
          :field-set="uncategorizedFieldSet"
          :visit="selectedVisit"
          :patient="patient"
          :previous-visits="previousVisits"
          :existing-observations="uncategorizedObservations"
          @observation-updated="onObservationUpdated"
          @clone-from-previous="onCloneFromPrevious"
        />
      </div>

      <!-- Empty State -->
      <div v-if="!selectedVisit" class="empty-state">
        <q-icon name="assignment" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-sm">{{ $t('visit.selectVisitToStart') }}</div>
        <div class="text-body2 text-grey-5">{{ $t('visit.chooseExistingOrCreate') }}</div>
      </div>

      <!-- No Field Sets Selected -->
      <div v-if="selectedVisit && activeFieldSets.length === 0" class="no-fieldsets-state compact">
        <q-icon name="category" size="32px" color="grey-4" />
        <div class="text-subtitle1 text-grey-6 q-mt-sm">{{ $t('visit.noObservationCategories') }}</div>
        <div class="text-body2 text-grey-5 q-mb-sm">{{ $t('visit.chooseCategoriesAbove') }}</div>
        <q-btn color="primary" size="sm" @click="showFieldSetConfig = true">{{ $t('visit.configureCategories') }}</q-btn>
      </div>

      <!-- Always show uncategorized observations when visit is selected -->
      <div v-if="selectedVisit && activeFieldSets.length === 0 && uncategorizedFieldSet" class="uncategorized-only">
        <ObservationFieldSet
          :key="`${selectedVisit.id}-uncategorized-only`"
          :field-set="uncategorizedFieldSet"
          :visit="selectedVisit"
          :patient="patient"
          :previous-visits="previousVisits"
          :existing-observations="uncategorizedObservations"
          @observation-updated="onObservationUpdated"
          @clone-from-previous="onCloneFromPrevious"
        />
      </div>
    </div>

    <!-- Field Set Configuration Dialog -->
    <FieldSetConfigDialog v-model="showFieldSetConfig" :available-field-sets="availableFieldSets" :active-field-sets="activeFieldSets" @save="onFieldSetConfigSave" @cancel="onFieldSetConfigCancel" />

    <!-- New Visit Dialog -->
    <NewVisitDialog v-model="showNewVisitDialog" :patient="patient" @created="onVisitCreated" />

    <!-- Edit Visit Dialog -->
    <EditVisitDialog v-if="selectedVisitForEdit" v-model="showEditVisitDialog" :patient="patient" :visit="selectedVisitForEdit" @visitUpdated="onVisitUpdated" />

    <!-- Custom Observation Dialog -->
    <CustomObservationDialog
      v-model="showAddCustomDialog"
      :visit="selectedVisit"
      :patient="patient"
      :field-set-name="'Custom'"
      :field-set-id="'custom'"
      @observation-added="onCustomObservationAdded"
      @questionnaire-added="onQuestionnaireAddedFromSearch"
    />

    <!-- Visit Summary Dialog -->
    <VisitSummaryDialog v-model="showVisitSummaryDialog" :visit="visitForPreview" />

    <!-- Add Questionnaire to Visit Dialog -->
    <AddQuestionnaireToVisitDialog
      v-model="showAddQuestionnaireDialog"
      :existing-questionnaire-codes="existingQuestionnaireCodes"
      :visit-type-code="selectedVisit?.visitType || ''"
      @questionnaire-selected="onQuestionnaireSelected"
    />

    <!-- Questionnaire Fill Dialog -->
    <VisitQuestionnaireFillDialog
      v-if="activeQuestionnaire"
      v-model="showQuestionnaireFillDialog"
      :visit="selectedVisit"
      :patient="patient"
      :questionnaire-code="activeQuestionnaire.questionnaireCode"
      :observation-id="activeQuestionnaire.observationId"
      :observation-blob="activeQuestionnaire.observationBlob"
      :is-completed="activeQuestionnaire.isCompleted"
      @questionnaire-completed="onQuestionnaireCompleted"
      @close="onQuestionnaireFillClose"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useI18n } from 'vue-i18n'
import { usePatientStore } from 'src/stores/patient-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useUncategorizedObservations } from 'src/composables/useUncategorizedObservations'
import { useFieldSetStatistics } from 'src/composables/useFieldSetStatistics'
// NOTE: Field sets are now loaded exclusively from database via global-settings-store
import ObservationFieldSet from './ObservationFieldSet.vue'
import NewVisitDialog from './NewVisitDialog.vue'
import FieldSetSelector from './FieldSetSelector.vue'
import FieldSetConfigDialog from './FieldSetConfigDialog.vue'
import EditVisitDialog from '../patient/EditVisitDialog.vue'
import VisitSelector from './VisitSelector.vue'
import CustomObservationDialog from './CustomObservationDialog.vue'
import VisitSummaryDialog from './VisitSummaryDialog.vue'
import VisitQuestionnaireSection from './VisitQuestionnaireSection.vue'
import AddQuestionnaireToVisitDialog from './AddQuestionnaireToVisitDialog.vue'
import VisitQuestionnaireFillDialog from './VisitQuestionnaireFillDialog.vue'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
  initialVisit: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['visit-created'])

const notify = useNotify()
const { t } = useI18n()
const patientStore = usePatientStore()
const visitStore = useVisitStore()
const observationStore = useObservationStore()
const localSettings = useLocalSettingsStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const databaseStore = useDatabaseStore()
const logger = loggingStore.createLogger('VisitDataEntry')

// State
const showFieldSetConfig = ref(false)
const showNewVisitDialog = ref(false)
const showEditVisitDialog = ref(false)
const showAddCustomDialog = ref(false)
const showVisitSummaryDialog = ref(false)
const showAddQuestionnaireDialog = ref(false)
const showQuestionnaireFillDialog = ref(false)
const activeQuestionnaire = ref(null)
const visitForPreview = ref(null)
const loadingFieldSets = ref(false)

// Field Sets Configuration - will be loaded from global settings
const availableFieldSets = ref([])
const activeFieldSets = ref([]) // Start with empty array, let visit type determine active sets

// Computed from store
const selectedVisit = computed(() => visitStore.selectedVisit)

// Transform visit data for EditVisitDialog (create visitGroup structure)
const selectedVisitForEdit = computed(() => {
  if (!selectedVisit.value) return null

  const visit = selectedVisit.value

  logger.debug('Creating selectedVisitForEdit', {
    visitId: visit.id,
    hasRawData: !!visit.rawData,
    rawDataVisitBlob: visit.rawData?.VISIT_BLOB,
    visitNotes: visit.notes,
    fullVisit: visit,
  })

  // Create visitGroup structure that EditVisitDialog expects
  const visitForEdit = {
    encounterNum: visit.id,
    visitDate: visit.date,
    endDate: visit.endDate,
    visit: visit.rawData || {
      // Fallback to constructed data if rawData is not available
      ENCOUNTER_NUM: visit.id,
      START_DATE: visit.date,
      END_DATE: visit.endDate,
      ACTIVE_STATUS_CD: visit.status,
      LOCATION_CD: visit.location,
      INOUT_CD: visit.type === 'emergency' ? 'E' : visit.type === 'routine' ? 'O' : 'O',
      SOURCESYSTEM_CD: 'SYSTEM',
      VISIT_BLOB: visit.notes || null,
    },
    observations: [], // Empty array since we're just editing the visit
  }

  logger.debug('Final visitForEdit data', {
    visitId: visit.id,
    visitBlob: visitForEdit.visit.VISIT_BLOB,
    usingRawData: !!visit.rawData,
  })

  return visitForEdit
})

const previousVisits = computed(() => visitObservationService.getPreviousVisits())

// Methods that need to be available for composables
const getFieldSetObservations = (fieldSetId) => {
  if (!fieldSetId) {
    logger.warn('getFieldSetObservations called with undefined fieldSetId')
    return []
  }

  const observations = observationStore.getFieldSetObservations(fieldSetId, availableFieldSets.value)
  logger.debug(`getFieldSetObservations for ${fieldSetId}`, {
    fieldSetId,
    observationCount: observations.length,
    selectedVisitId: selectedVisit.value?.id,
    storeObservationsCount: observationStore.observations.length,
    availableFieldSetsCount: availableFieldSets.value.length,
  })
  return observations
}

const getFieldSetObservationCount = (fieldSetId) => {
  if (!fieldSetId) {
    logger.warn('getFieldSetObservationCount called with undefined fieldSetId')
    return 0
  }
  // Special case: questionnaires count Q-type observations
  if (fieldSetId === 'questionnaires') {
    return visitQuestionnaires.value.length
  }
  return getFieldSetObservations(fieldSetId).length
}

// Use uncategorized observations composable
const { uncategorizedObservations, uncategorizedFieldSet } = useUncategorizedObservations(observationStore, availableFieldSets, selectedVisit)

// Use field set statistics composable
const { overallStats } = useFieldSetStatistics(availableFieldSets, activeFieldSets, getFieldSetObservationCount, uncategorizedObservations, getFieldSetObservations)

// Field set organization for better UX
const activeFieldSetsList = computed(() => {
  const result = availableFieldSets.value.filter((fs) => activeFieldSets.value.includes(fs.id))
  logger.debug('activeFieldSetsList computed', {
    availableFieldSetsCount: availableFieldSets.value.length,
    activeFieldSetsIds: activeFieldSets.value,
    filteredFieldSetsCount: result.length,
    filteredFieldSets: result.map((fs) => ({ id: fs.id, name: fs.name })),
  })
  return result
})

// Methods
const loadFieldSets = async () => {
  try {
    loadingFieldSets.value = true

    // Load field sets from global settings
    const fieldSets = await globalSettingsStore.getFieldSetOptions()

    if (fieldSets && fieldSets.length > 0) {
      availableFieldSets.value = fieldSets
    } else {
      // No field sets available in database
      logger.warn('No field sets found in database')
      availableFieldSets.value = []
    }

    // Field sets loaded and ready for use
  } catch (error) {
    logger.error('Failed to load field sets from global settings', error)
    notify.warning(t('notifications.usingDefaultFieldSets'))

    // No field sets available - database error
    logger.error('Database field sets unavailable, no fallback provided')
    availableFieldSets.value = []
  } finally {
    loadingFieldSets.value = false
  }
}

const activateFieldSetsForVisitType = async (visit) => {
  if (!visit) {
    logger.warn('activateFieldSetsForVisitType called with null visit')
    return
  }

  logger.debug('activateFieldSetsForVisitType called', {
    visitId: visit.id,
    visitType: visit.visitType,
    visitRawData: !!visit.rawData,
    visitBlobExists: !!visit.rawData?.VISIT_BLOB,
  })

  try {
    // Extract visit type from visit data
    let visitType = null

    // Try to get visit type from different possible sources
    if (visit.visitType) {
      visitType = visit.visitType
      logger.debug('Visit type found directly on visit object', { visitType })
    } else if (visit.rawData?.VISIT_BLOB) {
      // Parse VISIT_BLOB to get visit type
      try {
        const blobData = JSON.parse(visit.rawData.VISIT_BLOB)
        visitType = blobData.visitType
        logger.debug('Visit type extracted from VISIT_BLOB', { visitType, blobData })
      } catch (error) {
        logger.warn('Failed to parse VISIT_BLOB for visit type', { visitId: visit.id, error })
      }
    }

    if (!visitType) {
      logger.warn('No visit type found for visit', {
        visitId: visit.id,
        visitKeys: Object.keys(visit),
        rawDataKeys: visit.rawData ? Object.keys(visit.rawData) : [],
      })
      return
    }

    // Get field sets associated with this visit type (only active ones)
    logger.debug('Getting field sets for visit type', { visitType })

    // Clear cache to ensure we get fresh data
    globalSettingsStore.clearCache()

    const visitTypeFieldSets = await globalSettingsStore.getFieldSetsForVisitType(visitType, true)

    logger.debug('Field sets retrieved from global settings', {
      visitType,
      fieldSetCount: visitTypeFieldSets.length,
      fieldSets: visitTypeFieldSets,
    })

    if (visitTypeFieldSets.length === 0) {
      logger.debug(`No active field sets configured for visit type: ${visitType}`)
      return
    }

    // Filter to only include field sets that actually exist in availableFieldSets
    const validFieldSets = visitTypeFieldSets.filter((fsId) => availableFieldSets.value.some((fs) => fs.id === fsId))

    logger.debug('Field sets after validation', {
      visitTypeFieldSets,
      availableFieldSetIds: availableFieldSets.value.map((fs) => fs.id),
      validFieldSets,
    })

    if (validFieldSets.length > 0) {
      // Clear existing field sets first
      logger.debug('Clearing existing field sets before activation', {
        previousFieldSets: activeFieldSets.value,
      })

      // Activate the field sets for this visit type
      activeFieldSets.value = [...validFieldSets] // Create new array to ensure reactivity

      // Save to local settings
      localSettings.setSetting('visits.activeFieldSets', activeFieldSets.value)

      logger.info(`Activated ${validFieldSets.length} field sets for visit type: ${visitType}`, {
        visitId: visit.id,
        visitType,
        activatedFieldSets: validFieldSets,
        activeFieldSetsAfterUpdate: activeFieldSets.value,
      })

      // Special logging for Parkinson visits
      if (visitType === 'parkinson_erst' || visitType === 'parkinson_verlauf') {
        logger.info('PARKINSON VISIT FIELD SETS', {
          requestedFieldSets: visitTypeFieldSets,
          validatedFieldSets: validFieldSets,
          finalActiveFieldSets: activeFieldSets.value,
          availableFieldSets: availableFieldSets.value.map((fs) => ({ id: fs.id, name: fs.name })),
        })
      }

      notify.info(`Activated ${validFieldSets.length} field sets for ${visitType} visit`, { timeout: 2000 })
    } else {
      logger.warn(`No valid field sets found for visit type: ${visitType}`, {
        visitTypeFieldSets,
        availableFieldSetIds: availableFieldSets.value.map((fs) => fs.id),
      })
    }
  } catch (error) {
    logger.error('Failed to activate field sets for visit type', error)
  }
}

const onVisitSelected = async (visit) => {
  if (!visit) return

  try {
    await visitObservationService.selectVisitAndLoadObservations(visit)

    // Automatically activate field sets based on visit type
    await activateFieldSetsForVisitType(visit)
  } catch (error) {
    logger.error('Failed to select visit', error)
    notify.error(t('notifications.failedToLoadVisitData'))
  }
}

const toggleFieldSet = (fieldSetId) => {
  const index = activeFieldSets.value.indexOf(fieldSetId)
  if (index > -1) {
    activeFieldSets.value.splice(index, 1)
  } else {
    activeFieldSets.value.push(fieldSetId)
  }

  // Save to local settings
  localSettings.setSetting('visits.activeFieldSets', activeFieldSets.value)
}

const onFieldSetConfigSave = (selectedFieldSets) => {
  activeFieldSets.value = selectedFieldSets
  localSettings.setSetting('visits.activeFieldSets', activeFieldSets.value)

  notify.success(t('notifications.fieldSetConfigurationSaved'))
}

const onFieldSetConfigCancel = () => {
  // Dialog handles its own closing
}

const createNewVisit = () => {
  showNewVisitDialog.value = true
}

const editSelectedVisit = (visit) => {
  if (visit || selectedVisit.value) {
    showEditVisitDialog.value = true
  }
}

const previewSelectedVisit = (visit) => {
  if (visit || selectedVisit.value) {
    visitForPreview.value = visit || selectedVisit.value
    showVisitSummaryDialog.value = true

    logger.info('Opening visit summary dialog', {
      visitId: visitForPreview.value?.id,
      visitDate: visitForPreview.value?.date,
      patientId: props.patient?.id,
    })
  }
}

const onVisitCreated = async (newVisit) => {
  emit('visit-created', newVisit)

  // The visit will be selected by the service, but we need to activate field sets
  // Wait a bit for the visit to be properly selected
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Activate field sets for the new visit type
  await activateFieldSetsForVisitType(newVisit)
}

const onVisitUpdated = async (updatedVisit) => {
  logger.info('VisitDataEntry: Visit updated event received', {
    visitId: updatedVisit.ENCOUNTER_NUM,
    patientId: props.patient?.id,
    visitDate: updatedVisit.START_DATE,
  })

  // Reload visits for the current patient to get the updated data
  if (props.patient) {
    try {
      await visitStore.loadVisitsForPatient(props.patient.PATIENT_NUM)
    } catch (error) {
      logger.error('Failed to reload visits after update', error)
    }
  }
}

const onObservationUpdated = async (data) => {
  logger.info('VisitDataEntry: Observation updated event received', {
    conceptCode: data.conceptCode,
    value: data.value,
    selectedVisitId: selectedVisit.value?.id,
    activeFieldSetsCount: activeFieldSets.value.length,
  })
  // Store already handles reloading observations internally during CRUD operations
  // No need to manually reload here
}

const onCloneFromPrevious = async (data) => {
  logger.info('Clone from previous visit', { conceptCode: data.conceptCode })

  try {
    const { conceptCode } = data

    // Get default values from global settings
    const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('GENERAL')
    const defaultCategory = await globalSettingsStore.getDefaultCategory('CLONED')

    // Create observation data for the current visit
    const observationData = {
      ENCOUNTER_NUM: selectedVisit.value.id,
      CONCEPT_CD: conceptCode,
      START_DATE: new Date().toISOString().split('T')[0],
      CATEGORY_CHAR: defaultCategory,
      PROVIDER_ID: 'SYSTEM',
      LOCATION_CD: 'CLONED',
      SOURCESYSTEM_CD: defaultSourceSystem,
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }

    await visitObservationService.createObservation(observationData)

    notify.success(t('notifications.valueClonedFromPrevious'))
  } catch (error) {
    logger.error('Failed to clone from previous visit', error)
    notify.error(t('notifications.failedToCloneValue'))
  }
}

const onCustomObservationAdded = (data) => {
  logger.info('Custom observation added', {
    conceptCode: data.conceptCode,
    value: data.value,
    unit: data.unit,
  })

  // The observation has already been created by the dialog
  // We just need to notify that an observation was updated to refresh the UI
  onObservationUpdated(data)

  notify.success(t('notifications.customObservationAdded'))
}

// ========== Questionnaire Integration ==========

/**
 * Get questionnaires attached to the current visit from observations
 * Looks for VALTYPE_CD='Q' observations and pending questionnaire placeholders
 */
const visitQuestionnaires = computed(() => {
  if (!selectedVisit.value || !observationStore.observations) return []

  return observationStore.observations
    .filter((obs) => obs.valueType === 'Q')
    .map((obs) => {
      let isCompleted = false
      let title = obs.value || obs.originalValue || 'Fragebogen'
      let questionnaireCode = null
      let shortTitle = null
      let score = null
      let progress = null
      let blobData = null

      // Parse OBSERVATION_BLOB to check status
      if (obs.rawData?.OBSERVATION_BLOB) {
        try {
          blobData = JSON.parse(obs.rawData.OBSERVATION_BLOB)

          if (blobData && typeof blobData === 'object' && blobData._status === 'pending') {
            // Pending/incomplete questionnaire
            isCompleted = false
            questionnaireCode = blobData._questionnaireCode || null
            title = blobData.title || title
            shortTitle = blobData.short_title || null

            // Calculate progress from saved responses
            if (blobData._savedResponses && typeof blobData._savedResponses === 'object') {
              const entries = Object.values(blobData._savedResponses)
              const filledCount = entries.filter((v) => v !== null && v !== undefined && v !== '').length
              const totalEstimate = entries.length
              progress = totalEstimate > 0 ? filledCount / totalEstimate : 0
            } else {
              progress = 0
            }
          } else if (blobData && typeof blobData === 'object') {
            // Completed questionnaire (has full results)
            isCompleted = true
            // Handle both field name conventions: _questionnaireCode (pending) and questionnaire_code (completed)
            questionnaireCode = blobData.questionnaire_code || blobData._questionnaireCode || null
            title = blobData.title || title
            shortTitle = blobData.short_title || null

            // Extract score from results array
            if (Array.isArray(blobData.results) && blobData.results.length > 0) {
              score = blobData.results[0].value
            }
          } else {
            isCompleted = true
          }
        } catch (e) {
          logger.warn('Failed to parse questionnaire blob', { observationId: obs.observationId, error: e.message })
          isCompleted = true
        }
      } else {
        // No blob data but is Q type - assume completed (legacy data)
        isCompleted = true
      }

      return {
        observationId: obs.observationId,
        title,
        shortTitle,
        questionnaireCode,
        isCompleted,
        score,
        progress,
        observationBlob: obs.rawData?.OBSERVATION_BLOB || null,
        rawObservation: obs,
      }
    })
})

/**
 * Get codes of questionnaires already in this visit (for duplicate prevention)
 */
const existingQuestionnaireCodes = computed(() => {
  return visitQuestionnaires.value.map((q) => q.questionnaireCode).filter(Boolean)
})

/**
 * Handle questionnaire selection from the add dialog
 * Creates a pending Q-type observation placeholder
 */
const onQuestionnaireSelected = async (selectedQ) => {
  try {
    logger.info('Adding questionnaire to visit', { code: selectedQ.code, title: selectedQ.title })

    const encounterNum = selectedVisit.value.id
    const patientNum = props.patient.PATIENT_NUM

    // Create a pending placeholder observation
    const blob = JSON.stringify({
      _status: 'pending',
      _questionnaireCode: selectedQ.code,
      _savedResponses: {},
      _createdAt: new Date().toISOString(),
      title: selectedQ.title,
      short_title: selectedQ.shortTitle,
    })

    await databaseStore.executeQuery(
      `INSERT INTO OBSERVATION_FACT (
        ENCOUNTER_NUM, PATIENT_NUM, CONCEPT_CD, PROVIDER_ID,
        START_DATE, VALTYPE_CD, TVAL_CHAR, OBSERVATION_BLOB,
        UPDATE_DATE, IMPORT_DATE, SOURCESYSTEM_CD, CATEGORY_CHAR, INSTANCE_NUM
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?)`,
      [
        encounterNum,
        patientNum,
        'CUSTOM: QUESTIONNAIRE',
        '@',
        new Date().toISOString(),
        'Q',
        selectedQ.title,
        blob,
        'SURVEY_SYSTEM',
        'SURVEY_BEST',
        1,
      ],
    )

    // Reload observations to show the new questionnaire
    await visitObservationService.selectVisitAndLoadObservations(selectedVisit.value)

    // Ensure questionnaires field set is available and active
    await ensureQuestionnaireFieldSetActive()

    notify.success(`Fragebogen "${selectedQ.title}" zur Visite hinzugefügt`)

    logger.info('Questionnaire placeholder added to visit', { code: selectedQ.code })
  } catch (error) {
    logger.error('Failed to add questionnaire to visit', error)
    notify.error('Fragebogen konnte nicht hinzugefügt werden')
  }
}

/**
 * Open fill dialog for incomplete questionnaire
 */
const onFillQuestionnaire = (q) => {
  activeQuestionnaire.value = {
    questionnaireCode: q.questionnaireCode,
    observationId: q.observationId,
    observationBlob: q.observationBlob,
    isCompleted: false,
  }
  showQuestionnaireFillDialog.value = true
  logger.info('Opening questionnaire fill dialog', { code: q.questionnaireCode, observationId: q.observationId })
}

/**
 * Open view dialog for completed questionnaire
 */
const onViewQuestionnaire = (q) => {
  activeQuestionnaire.value = {
    questionnaireCode: q.questionnaireCode,
    observationId: q.observationId,
    observationBlob: q.observationBlob,
    isCompleted: true,
  }
  showQuestionnaireFillDialog.value = true
  logger.info('Opening completed questionnaire view', { code: q.questionnaireCode })
}

/**
 * Handle questionnaire completion
 */
const onQuestionnaireCompleted = async (data) => {
  logger.info('Questionnaire completed', { code: data.questionnaireCode, title: data.title })
  activeQuestionnaire.value = null

  // Reload to get updated observations
  if (selectedVisit.value) {
    await visitObservationService.selectVisitAndLoadObservations(selectedVisit.value)
  }
}

const onQuestionnaireFillClose = () => {
  // Reload observations to reflect any saved partial state
  if (selectedVisit.value) {
    visitObservationService.selectVisitAndLoadObservations(selectedVisit.value)
  }
  activeQuestionnaire.value = null
}

/**
 * Delete a questionnaire observation from the visit
 */
const onRemoveQuestionnaire = async (q) => {
  try {
    logger.info('Removing questionnaire from visit', { observationId: q.observationId, title: q.title })

    await visitObservationService.deleteObservation(q.observationId)

    notify.success(`Fragebogen "${q.title}" entfernt`, { timeout: 2000 })
  } catch (error) {
    logger.error('Failed to remove questionnaire', error)
    notify.error('Fragebogen konnte nicht entfernt werden')
  }
}

/**
 * Ensure the questionnaires field set exists in availableFieldSets and is active.
 * If it's not in availableFieldSets (e.g., DB was just updated), add it dynamically.
 */
const ensureQuestionnaireFieldSetActive = async () => {
  // Check if questionnaires field set exists in available sets
  const exists = availableFieldSets.value.some((fs) => fs.id === 'questionnaires')
  if (!exists) {
    // Reload from DB (migration may have just added it)
    globalSettingsStore.clearCache()
    const freshFieldSets = await globalSettingsStore.getFieldSetOptions(true)
    if (freshFieldSets && freshFieldSets.length > 0) {
      availableFieldSets.value = freshFieldSets
    }

    // If still not there, add it dynamically
    if (!availableFieldSets.value.some((fs) => fs.id === 'questionnaires')) {
      availableFieldSets.value.push({
        id: 'questionnaires',
        name: 'Fragebögen',
        description: 'Fragebögen und Surveys (MoCA, BDI, etc.)',
        icon: 'quiz',
        concepts: ['CUSTOM: QUESTIONNAIRE'],
      })
      logger.info('Dynamically added questionnaires field set to available sets')
    }
  }

  // Activate
  if (!activeFieldSets.value.includes('questionnaires')) {
    activeFieldSets.value.push('questionnaires')
    localSettings.setSetting('visits.activeFieldSets', activeFieldSets.value)
    logger.info('Auto-activated questionnaires field set')
  }
}

/**
 * Handle questionnaire added from CustomObservationDialog search
 * Creates a pending observation and activates the questionnaires FieldSet
 */
const onQuestionnaireAddedFromSearch = async (data) => {
  logger.info('Questionnaire added from search dialog', { code: data.code, title: data.title })
  await onQuestionnaireSelected({ code: data.code, title: data.title, shortTitle: data.shortTitle })
}

// Helper Methods use store methods

// Watchers
watch(
  () => props.initialVisit,
  async (newVisit) => {
    if (newVisit) {
      logger.debug('Initial visit changed', {
        visitId: newVisit.id,
        visitType: newVisit.visitType,
      })
      await visitObservationService.selectVisitAndLoadObservations(newVisit)
      // Activate field sets for the initial visit
      await activateFieldSetsForVisitType(newVisit)
    }
  },
  { immediate: true },
)

// Lifecycle
onMounted(async () => {
  logger.info('VisitDataEntry mounted', {
    activeFieldSets: activeFieldSets.value,
    patientId: props.patient?.id,
    initialVisitId: props.initialVisit?.id,
  })

  // Load field sets from global settings
  await loadFieldSets()

  // Don't load saved field sets yet - let the visit type determine them first

  logger.info('Field sets configuration loaded', {
    availableFieldSets: availableFieldSets.value.map((fs) => fs.id),
    selectedVisitId: selectedVisit.value?.id,
    visitOptionsCount: visitStore.visitOptions.length,
  })

  // Field sets are now ready for use

  // If no visit is selected but visits are available, select the most recent one
  if (!selectedVisit.value && visitStore.visitOptions.length > 0) {
    logger.info('No visit selected, selecting the most recent visit')
    const mostRecentVisit = visitStore.visitOptions[0].value
    await visitObservationService.selectVisitAndLoadObservations(mostRecentVisit)

    // Activate field sets for the auto-selected visit
    await activateFieldSetsForVisitType(mostRecentVisit)
  } else if (selectedVisit.value) {
    // If a visit is already selected, activate its field sets
    logger.info('Visit already selected, activating field sets', {
      visitId: selectedVisit.value.id,
      visitType: selectedVisit.value.visitType,
    })
    await activateFieldSetsForVisitType(selectedVisit.value)
  } else {
    // No visit selected, load saved field set settings as fallback
    const savedActiveFieldSets = localSettings.getSetting('visits.activeFieldSets')
    if (savedActiveFieldSets) {
      logger.debug('Loading saved active field sets as fallback', { savedActiveFieldSets })
      activeFieldSets.value = savedActiveFieldSets
    }
  }

  // Log final state for debugging
  logger.info('VisitDataEntry initialization complete', {
    hasSelectedVisit: !!selectedVisit.value,
    selectedVisitId: selectedVisit.value?.id,
    selectedVisitType: selectedVisit.value?.visitType,
    activeFieldSetsCount: activeFieldSets.value.length,
    activeFieldSets: activeFieldSets.value,
    visitStoreSelectedVisit: visitStore.selectedVisit?.id,
    visitStoreSelectedPatient: patientStore.selectedPatient?.id,
  })
})
</script>

<style lang="scss" scoped>
.data-entry-view {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: $grey-1;
}

.entry-container {
  max-width: 1200px;
  margin: 0 auto;
}

.observation-forms {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.empty-state,
.no-fieldsets-state {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);

  &.compact {
    padding: 2rem 1.5rem;
  }
}

.uncategorized-only {
  margin-top: 1.5rem;
}

.add-observation-section {
  margin: 0.5rem 0;

  .add-observation-btn {
    color: $grey-6;
    transition: all 0.3s ease;

    &:hover {
      color: $primary;
      border-color: $primary;
    }
  }
}

@media (max-width: 768px) {
  .data-entry-view {
    padding: 1rem;
  }

  .add-observation-section {
    margin: 1rem 0;
  }
}
</style>
