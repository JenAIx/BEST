<template>
  <div class="data-entry-view">
    <div class="entry-container">
      <!-- Visit Selector -->
      <div class="visit-selector">
        <div class="visit-selector-main">
          <q-select
            v-model="selectedVisit"
            :options="visitOptions"
            option-label="label"
            label="Select Visit"
            outlined
            dense
            class="visit-select"
            emit-value
            map-options
            @update:model-value="onVisitSelected"
          >
            <template v-slot:selected-item="scope">
              <div class="selected-visit">
                <q-icon name="event" class="q-mr-xs" />
                {{ scope.opt.label }}
              </div>
            </template>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar>
                  <q-icon name="event" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.summary }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- Inline Visit Info Preview -->
          <div v-if="selectedVisit && visitPreviewInfo && (visitPreviewInfo.visitType || visitPreviewInfo.notes)" class="visit-info-inline">
            <q-chip
              v-if="visitPreviewInfo.visitType"
              :color="getVisitTypeColor(visitPreviewInfo.visitType)"
              text-color="white"
              size="sm"
              :icon="getVisitTypeIcon(visitPreviewInfo.visitType)"
              class="q-mr-xs cursor-pointer"
            >
              {{ getVisitTypeLabel(visitPreviewInfo.visitType) }}
              <q-tooltip class="bg-dark text-white" :delay="500">
                <div class="text-body2">
                  <div class="text-weight-medium">Visit Type</div>
                  <div>{{ getVisitTypeLabel(visitPreviewInfo.visitType) }}</div>
                </div>
              </q-tooltip>
            </q-chip>
            <div v-if="visitPreviewInfo.notes" class="visit-notes-inline cursor-pointer">
              <q-icon name="notes" size="12px" class="text-grey-6 q-mr-xs" />
              <span class="text-caption text-grey-7">{{ visitPreviewInfo.notes }}</span>
              <q-tooltip class="bg-dark text-white" :delay="500" max-width="400px">
                <div class="text-body2">
                  <div class="text-weight-medium q-mb-xs">Visit Notes</div>
                  <div style="white-space: pre-wrap; word-break: break-word">{{ visitPreviewInfo.notes }}</div>
                </div>
              </q-tooltip>
            </div>
          </div>

          <div class="visit-actions">
            <q-btn color="secondary" icon="edit" label="Edit Visit" @click="editSelectedVisit" :disable="!selectedVisit" class="q-mr-sm" />
            <q-btn color="primary" icon="add" label="New Visit" @click="createNewVisit" />
          </div>
        </div>
      </div>

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

      <!-- Observation Forms -->
      <div v-if="selectedVisit && activeFieldSets.length > 0" class="observation-forms">
        <ObservationFieldSet
          v-for="fieldSet in activeFieldSetsList"
          :key="`${selectedVisit.id}-${fieldSet.id}`"
          :field-set="fieldSet"
          :visit="selectedVisit"
          :patient="patient"
          :previous-visits="previousVisits"
          :existing-observations="getFieldSetObservations(fieldSet.id)"
          @observation-updated="onObservationUpdated"
          @clone-from-previous="onCloneFromPrevious"
        />

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
        <div class="text-h6 text-grey-6 q-mt-sm">Select a visit to start</div>
        <div class="text-body2 text-grey-5">Choose an existing visit or create a new one</div>
      </div>

      <!-- No Field Sets Selected -->
      <div v-if="selectedVisit && activeFieldSets.length === 0" class="no-fieldsets-state compact">
        <q-icon name="category" size="32px" color="grey-4" />
        <div class="text-subtitle1 text-grey-6 q-mt-sm">No observation categories selected</div>
        <div class="text-body2 text-grey-5 q-mb-sm">Choose categories above to start entering data</div>
        <q-btn color="primary" size="sm" @click="showFieldSetConfig = true">Configure Categories</q-btn>
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
    <EditVisitDialog v-model="showEditVisitDialog" :patient="patient" :visit="selectedVisitForEdit" @visitUpdated="onVisitUpdated" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useUncategorizedObservations } from 'src/composables/useUncategorizedObservations'
import { useFieldSetStatistics } from 'src/composables/useFieldSetStatistics'
// NOTE: Field sets are now loaded exclusively from database via global-settings-store
import ObservationFieldSet from './ObservationFieldSet.vue'
import NewVisitDialog from './NewVisitDialog.vue'
import FieldSetSelector from './FieldSetSelector.vue'
import FieldSetConfigDialog from './FieldSetConfigDialog.vue'
import EditVisitDialog from '../patient/EditVisitDialog.vue'

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

const $q = useQuasar()
const visitStore = useVisitObservationStore()
const localSettings = useLocalSettingsStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitDataEntry')

// State
const showFieldSetConfig = ref(false)
const showNewVisitDialog = ref(false)
const showEditVisitDialog = ref(false)
const loadingFieldSets = ref(false)

// Field Sets Configuration - will be loaded from global settings
const availableFieldSets = ref([])
const activeFieldSets = ref(['vitals', 'symptoms'])

// Computed from store
const selectedVisit = computed({
  get: () => {
    // Return the full visit object that matches the store's selectedVisit
    if (!visitStore.selectedVisit) return null
    return visitOptions.value.find((opt) => opt.value.id === visitStore.selectedVisit.id)?.value || visitStore.selectedVisit
  },
  set: async (visit) => {
    if (visit) {
      await visitStore.setSelectedVisit(visit)
    }
  },
})

// Transform visit data for EditVisitDialog (create visitGroup structure like PatientObservationsTab)
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

  // Create visitGroup structure that EditVisitDialog expects (same as PatientObservationsTab.vue)
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

const visitOptions = computed(() => visitStore.visitOptions)
const previousVisits = computed(() => visitStore.previousVisits)

// Extract visit preview information from VISIT_BLOB
const visitPreviewInfo = computed(() => {
  if (!selectedVisit.value) return null

  const visit = selectedVisit.value
  let visitType = ''
  let notes = ''

  // Try to extract from rawData first (most reliable)
  if (visit.rawData?.VISIT_BLOB) {
    try {
      const blobData = JSON.parse(visit.rawData.VISIT_BLOB)
      visitType = blobData.visitType || ''
      notes = blobData.notes || ''
    } catch (error) {
      logger.debug('Failed to parse VISIT_BLOB in visitPreviewInfo', {
        visitId: visit.id,
        visitBlob: visit.rawData.VISIT_BLOB,
        error: error.message,
      })
    }
  }

  // Fallback to visit.type if no visitType found in VISIT_BLOB
  if (!visitType && visit.type) {
    visitType = visit.type
  }

  // Fallback to visit.notes if no structured data
  if (!notes && visit.notes) {
    notes = visit.notes
  }

  logger.debug('Visit preview info computed', {
    visitId: visit.id,
    visitType,
    notes,
    hasRawData: !!visit.rawData,
    fallbackType: visit.type,
    fallbackNotes: visit.notes,
  })

  return {
    visitType,
    notes,
  }
})

// Methods that need to be available for composables
const getFieldSetObservations = (fieldSetId) => {
  if (!fieldSetId) {
    logger.warn('getFieldSetObservations called with undefined fieldSetId')
    return []
  }

  const observations = visitStore.getFieldSetObservations(fieldSetId, availableFieldSets.value)
  logger.debug(`getFieldSetObservations for ${fieldSetId}`, {
    fieldSetId,
    observationCount: observations.length,
    selectedVisitId: selectedVisit.value?.id,
    storeObservationsCount: visitStore.observations.length,
    availableFieldSetsCount: availableFieldSets.value.length,
  })
  return observations
}

const getFieldSetObservationCount = (fieldSetId) => {
  if (!fieldSetId) {
    logger.warn('getFieldSetObservationCount called with undefined fieldSetId')
    return 0
  }
  return getFieldSetObservations(fieldSetId).length
}

// Use uncategorized observations composable
const { uncategorizedObservations, uncategorizedFieldSet } = useUncategorizedObservations(visitStore, availableFieldSets, selectedVisit)

// Use field set statistics composable
const { overallStats } = useFieldSetStatistics(availableFieldSets, activeFieldSets, getFieldSetObservationCount, uncategorizedObservations)

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
    $q.notify({
      type: 'warning',
      message: 'Using default field sets. Some configurations may not be available.',
      position: 'top',
    })

    // No field sets available - database error
    logger.error('Database field sets unavailable, no fallback provided')
    availableFieldSets.value = []
  } finally {
    loadingFieldSets.value = false
  }
}

const onVisitSelected = async (visit) => {
  if (!visit) return

  try {
    await visitStore.setSelectedVisit(visit)
  } catch (error) {
    logger.error('Failed to select visit', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load visit data',
      position: 'top',
    })
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

  $q.notify({
    type: 'positive',
    message: 'Field set configuration saved',
    position: 'top',
  })
}

const onFieldSetConfigCancel = () => {
  // Dialog handles its own closing
}

const createNewVisit = () => {
  showNewVisitDialog.value = true
}

const editSelectedVisit = () => {
  if (selectedVisit.value) {
    showEditVisitDialog.value = true
  }
}

const onVisitCreated = (newVisit) => {
  emit('visit-created', newVisit)
  selectedVisit.value = newVisit
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
      await visitStore.loadVisitsForPatient(props.patient)
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
      ENCOUNTER_NUM: visitStore.selectedVisit.id,
      CONCEPT_CD: conceptCode,
      START_DATE: new Date().toISOString().split('T')[0],
      CATEGORY_CHAR: defaultCategory,
      PROVIDER_ID: 'SYSTEM',
      LOCATION_CD: 'CLONED',
      SOURCESYSTEM_CD: defaultSourceSystem,
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }

    await visitStore.createObservation(observationData)

    $q.notify({
      type: 'positive',
      message: 'Value cloned from previous visit',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to clone from previous visit', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to clone value',
      position: 'top',
    })
  }
}

// Visit type helper methods
const getVisitTypeLabel = (typeCode) => {
  const labelMap = {
    routine: 'Routine Check-up',
    followup: 'Follow-up',
    emergency: 'Emergency',
    consultation: 'Consultation',
    procedure: 'Procedure',
  }
  return labelMap[typeCode] || typeCode || 'Unknown'
}

const getVisitTypeIcon = (typeCode) => {
  const iconMap = {
    routine: 'health_and_safety',
    followup: 'follow_the_signs',
    emergency: 'emergency',
    consultation: 'psychology',
    procedure: 'medical_services',
  }
  return iconMap[typeCode] || 'local_hospital'
}

const getVisitTypeColor = (typeCode) => {
  const colorMap = {
    routine: 'blue',
    followup: 'orange',
    emergency: 'negative',
    consultation: 'purple',
    procedure: 'teal',
  }
  return colorMap[typeCode] || 'grey'
}

// Helper Methods use store methods

// Watchers
watch(
  () => props.initialVisit,
  async (newVisit) => {
    if (newVisit) {
      await visitStore.setSelectedVisit(newVisit)
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

  // Load saved field set settings
  const savedActiveFieldSets = localSettings.getSetting('visits.activeFieldSets')
  if (savedActiveFieldSets) {
    logger.debug('Loading saved active field sets', { savedActiveFieldSets })
    activeFieldSets.value = savedActiveFieldSets
  }

  logger.info('Field sets configuration loaded', {
    finalActiveFieldSets: activeFieldSets.value,
    availableFieldSets: availableFieldSets.value.map((fs) => fs.id),
    selectedVisitId: selectedVisit.value?.id,
    visitOptionsCount: visitOptions.value.length,
  })

  // Field sets are now ready for use

  // If no visit is selected but visits are available, select the most recent one
  if (!selectedVisit.value && visitOptions.value.length > 0) {
    logger.info('No visit selected, selecting the most recent visit')
    const mostRecentVisit = visitOptions.value[0].value
    await visitStore.setSelectedVisit(mostRecentVisit)
  }

  // Log final state for debugging
  logger.info('VisitDataEntry initialization complete', {
    hasSelectedVisit: !!selectedVisit.value,
    selectedVisitId: selectedVisit.value?.id,
    activeFieldSetsCount: activeFieldSets.value.length,
    activeFieldSets: activeFieldSets.value,
    visitStoreSelectedVisit: visitStore.selectedVisit?.id,
    visitStoreSelectedPatient: visitStore.selectedPatient?.id,
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

.visit-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;

  .visit-selector-main {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;

    .visit-select {
      flex: 1;
      max-width: 400px;
      min-width: 250px;
    }

    .selected-visit {
      display: flex;
      align-items: center;
    }

    .visit-info-inline {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      padding: 0.25rem 0.5rem;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 4px;
      border: 1px solid $grey-4;

      .q-chip {
        transition: transform 0.15s ease;

        &:hover {
          transform: scale(1.05);
        }
      }

      .visit-notes-inline {
        display: flex;
        align-items: center;
        max-width: 300px;
        padding: 0.125rem 0.25rem;
        border-radius: 3px;
        transition: background-color 0.15s ease;

        &:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    .visit-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
  }
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

@media (max-width: 768px) {
  .data-entry-view {
    padding: 1rem;
  }

  .visit-selector {
    .visit-selector-main {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;

      .visit-select {
        max-width: none;
        min-width: auto;
      }

      .visit-info-inline {
        order: 2;

        .visit-notes-inline {
          max-width: 100%;
        }
      }

      .visit-actions {
        order: 3;
        justify-content: stretch;

        .q-btn {
          flex: 1;
        }
      }
    }
  }
}
</style>
