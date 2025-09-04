<template>
  <div class="q-mb-lg">
    <!-- Visit Header -->
    <q-tooltip :delay="500" class="bg-grey-9 text-white shadow-4" max-width="350px">
      <div class="text-body2">
        <div class="text-weight-medium q-mb-sm">Visit Details</div>

        <!-- Date Range -->
        <div class="q-mb-xs">
          <q-icon name="event" class="q-mr-xs" />
          {{ formatDate(visitGroup.visitDate) }}
          <span v-if="visitGroup.visit?.END_DATE"> - {{ formatDate(visitGroup.visit.END_DATE) }}</span>
          <span v-if="visitGroup.visit?.last_changed" class="text-caption text-grey-3 q-ml-sm"> (updated: {{ formatDate(visitGroup.visit.last_changed) }}) </span>
        </div>

        <!-- Status -->
        <div class="q-mb-xs" v-if="visitGroup.visit?.ACTIVE_STATUS_CD">
          <q-icon name="info" class="q-mr-xs" />
          Status: {{ getStatusLabel(visitGroup.visit.ACTIVE_STATUS_CD) }}
        </div>

        <!-- Visit Type (from VISIT_BLOB) -->
        <div class="q-mb-xs" v-if="visitGroup.visit?.visitType">
          <q-icon :name="typeIcon" class="q-mr-xs" />
          Visit Type: {{ visitTypeLabel }}
        </div>

        <!-- Admission Type (INOUT_CD) -->
        <div class="q-mb-xs" v-if="visitGroup.visit?.INOUT_CD">
          <q-icon name="local_hospital" class="q-mr-xs" />
          Admission: {{ getInoutTypeLabel(visitGroup.visit.INOUT_CD) }}
        </div>

        <!-- Location -->
        <div class="q-mb-xs" v-if="visitGroup.visit?.LOCATION_CD">
          <q-icon name="place" class="q-mr-xs" />
          Location: {{ visitGroup.visit.LOCATION_CD }}
        </div>

        <!-- Notes -->
        <div class="q-mb-xs" v-if="visitGroup.visit?.notes">
          <q-icon name="notes" class="q-mr-xs" />
          <div class="q-ml-xl">
            <div class="text-caption text-grey-3 q-mb-xs">Notes:</div>
            <div class="text-white" style="word-wrap: break-word; max-width: 250px">
              {{ visitGroup.visit.notes.length > 100 ? visitGroup.visit.notes.substring(0, 100) + '...' : visitGroup.visit.notes }}
            </div>
          </div>
        </div>

        <!-- Observations Count -->
        <div class="q-mb-xs">
          <q-icon name="assignment" class="q-mr-xs" />
          {{ visitGroup.observations.length }} observations
        </div>

        <!-- Technical ID -->
        <div class="text-caption q-mt-sm text-grey-4">ID: {{ visitGroup.encounterNum }}</div>
      </div>
    </q-tooltip>

    <div
      class="visit-header q-mb-md"
      :class="{ 'cursor-pointer': visitGroup.observations.length > 0 }"
      @click="visitGroup.observations.length > 0 ? toggleVisitExpansion() : null"
      @mouseenter="hoveredVisit = true"
      @mouseleave="hoveredVisit = false"
    >
      <div class="row items-center q-gutter-md">
        <!-- Visit Type Icon -->
        <q-avatar :color="visitTypeColor" text-color="white" size="40px">
          <q-icon :name="typeIcon" />
        </q-avatar>

        <!-- Visit Type and Status -->
        <div class="col-auto">
          <div class="visit-type-status">
            <!-- Visit Type -->
            <div v-if="visitGroup.visit?.visitType" class="q-mb-xs">
              <q-chip size="sm" :color="visitTypeColor" text-color="white" class="q-px-xs">
                {{ visitTypeLabel }}
              </q-chip>
            </div>

            <!-- Status Chip -->
            <div v-if="visitGroup.visit?.ACTIVE_STATUS_CD">
              <q-chip :color="getStatusColor()" text-color="white" size="xs">
                {{ getStatusLabel() }}
              </q-chip>
            </div>
          </div>
        </div>

        <div class="col">
          <div class="text-h6 text-primary">
            {{ formatDate(visitGroup.visitDate) }}
            <span v-if="visitGroup.visit?.END_DATE"> - {{ formatDate(visitGroup.visit.END_DATE) }}</span>

            <!-- Notes Preview -->
            <span v-if="visitGroup.visit?.notes" class="visit-notes-inline q-ml-sm">
              <q-icon name="notes" size="14px" class="q-mr-xs text-grey-6" />
              <span class="text-body2 text-grey-7">
                <span v-if="visitGroup.visit.notes.length <= 40">
                  {{ visitGroup.visit.notes }}
                </span>
                <span v-else>
                  <span v-if="!isNotesExpanded">
                    {{ visitGroup.visit.notes.substring(0, 40) }}...
                    <q-btn flat dense size="xs" color="primary" @click.stop="toggleNotesExpansion" class="q-ml-xs q-px-xs">more</q-btn>
                  </span>
                  <span v-else>
                    {{ visitGroup.visit.notes }}
                    <q-btn flat dense size="xs" color="primary" @click.stop="toggleNotesExpansion" class="q-ml-xs q-px-xs">less</q-btn>
                  </span>
                </span>
              </span>
            </span>
          </div>
          <div class="text-caption text-grey-6">
            {{ visitGroup.observations.length }} observations
            <span v-if="visitGroup.visit?.LOCATION_CD"> • {{ visitGroup.visit.LOCATION_CD }}</span>
          </div>
        </div>

        <!-- Hover Action Buttons -->
        <div v-if="hoveredVisit" class="visit-actions q-mr-md">
          <q-btn flat round icon="add" size="md" color="positive" @click.stop="openCreateObservationDialog" class="q-mr-sm">
            <q-tooltip>Add observation</q-tooltip>
          </q-btn>
          <q-btn flat round icon="edit" size="md" color="primary" @click.stop="openEditVisitDialog" class="q-mr-sm">
            <q-tooltip>Edit visit</q-tooltip>
          </q-btn>
          <q-btn flat round icon="delete" size="md" color="negative" @click.stop="confirmDeleteVisit" class="q-mr-sm">
            <q-tooltip>Delete visit</q-tooltip>
          </q-btn>
        </div>

        <!-- Observations Count -->
        <q-chip
          :color="visitGroup.observations.length === 0 ? 'grey' : visitGroup.observations.length > 10 ? 'orange' : visitGroup.observations.length > 5 ? 'blue' : 'green'"
          text-color="white"
          size="sm"
        >
          {{ visitGroup.observations.length }}
        </q-chip>

        <q-btn v-if="visitGroup.observations.length > 0" flat round dense :icon="isExpanded ? 'expand_less' : 'expand_more'" color="primary" size="sm">
          <q-tooltip> {{ isExpanded ? 'Collapse' : 'Expand' }} visit </q-tooltip>
        </q-btn>
        <div v-else class="text-caption text-grey-5 q-ml-sm">No observations to expand</div>
      </div>
      <q-separator class="q-mt-md" />
    </div>

    <!-- Observations Grid -->
    <q-slide-transition>
      <div v-show="isExpanded">
        <!-- No observations message -->
        <div v-if="visitGroup.observations.length === 0" class="text-center q-py-lg">
          <q-icon name="science_off" size="48px" color="grey-4" />
          <div class="text-body2 text-grey-6 q-mt-sm">No observations recorded for this visit</div>
          <div class="text-caption text-grey-5">
            Visit from {{ formatDate(visitGroup.visitDate) }}
            <span v-if="visitGroup.endDate"> to {{ formatDate(visitGroup.endDate) }}</span>
          </div>
        </div>

        <!-- Observations Grid -->
        <div v-else class="observations-grid">
          <ObservationCard
            v-for="observation in visitGroup.observations"
            :key="observation.OBSERVATION_ID"
            :observation="observation"
            @updated="$emit('observationUpdated')"
            @deleted="$emit('observationDeleted')"
          />
        </div>
      </div>
    </q-slide-transition>

    <!-- Edit Visit Dialog -->
    <EditVisitDialog v-model="showEditVisitDialog" :patient="patient" :visit="visitGroup" @visitUpdated="onVisitUpdated" />

    <!-- Create Observation Dialog -->
    <CreateObservationDialog v-model="showCreateObservationDialog" :patient="patient" :visit="visitGroup" @observationCreated="onObservationCreated" />

    <!-- Delete Confirmation Dialogs -->
    <AppDialog
      v-model="showDeleteConfirmDialog"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      size="md"
      persistent
      ok-label="Delete"
      ok-color="negative"
      cancel-label="Cancel"
      @ok="onDeleteConfirmed"
      @cancel="onDeleteCancelled"
    />

    <AppDialog
      v-model="showDeleteWarningDialog"
      title="Visit Has Observations"
      :message="deleteWarningMessage"
      size="md"
      persistent
      ok-label="Delete All"
      ok-color="negative"
      cancel-label="Cancel"
      @ok="onDeleteWarningConfirmed"
      @cancel="onDeleteWarningCancelled"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ObservationCard from './ObservationCard.vue'
import EditVisitDialog from './EditVisitDialog.vue'
import CreateObservationDialog from './CreateObservationDialog.vue'
import AppDialog from '../shared/AppDialog.vue'

const props = defineProps({
  visitGroup: {
    type: Object,
    required: true,
  },
  isExpanded: {
    type: Boolean,
    default: false,
  },
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['toggleExpansion', 'observationUpdated', 'observationDeleted', 'visitUpdated'])

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()
const conceptStore = useConceptResolutionStore()
const databaseStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitItem')

// Local state
const hoveredVisit = ref(false)
const isNotesExpanded = ref(false)

// Reactive state for resolved data (same as VisitTimelineItem)
const visitTypeData = ref({ label: 'General Visit', icon: 'local_hospital', color: 'primary' })
const statusData = ref({ label: 'Unknown', color: 'grey', class: 'status-default' })
const visitTypeOptions = ref([])

// Dialog states
const showEditVisitDialog = ref(false)
const showCreateObservationDialog = ref(false)

// Delete dialog states
const showDeleteConfirmDialog = ref(false)
const showDeleteWarningDialog = ref(false)
const deleteDialogTitle = ref('')
const deleteDialogMessage = ref('')
const deleteWarningMessage = ref('')

// Methods
const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

const toggleVisitExpansion = () => {
  emit('toggleExpansion', props.visitGroup.encounterNum)
}

const toggleNotesExpansion = () => {
  isNotesExpanded.value = !isNotesExpanded.value
}

// Status resolution functions (using reactive statusData)
const getStatusColor = () => {
  return statusData.value.color || 'grey'
}

const getStatusLabel = () => {
  return statusData.value.label || 'Unknown'
}

const getInoutTypeLabel = (inoutCode) => {
  const labelMap = {
    I: 'Inpatient',
    O: 'Outpatient',
    E: 'Emergency',
  }
  return labelMap[inoutCode] || inoutCode || 'Unknown'
}

// Load visit type options on mount
onMounted(async () => {
  try {
    visitTypeOptions.value = await globalSettingsStore.getVisitTypeOptions()
    await resolveVisitType()
    await resolveVisitStatus()
  } catch (error) {
    logger.error('Failed to load visit type options', error, { visitId: props.visitGroup.encounterNum })
  }
})

// Watch for changes in visit type, status, or rawData
watch(
  () => [props.visitGroup.visit?.visitType, props.visitGroup.visit?.ACTIVE_STATUS_CD, props.visitGroup.visit?.VISIT_BLOB],
  async () => {
    await resolveVisitType()
    await resolveVisitStatus()
  },
  { immediate: false },
)

// Resolve visit type using store (same as VisitTimelineItem)
const resolveVisitType = async () => {
  // Extract visit type from VISIT_BLOB if available
  let visitType = props.visitGroup.visit?.visitType

  if (props.visitGroup.visit?.VISIT_BLOB) {
    try {
      const blobData = JSON.parse(props.visitGroup.visit.VISIT_BLOB)
      if (blobData.visitType) {
        visitType = blobData.visitType
      }
      logger.debug('Extracted visit type from VISIT_BLOB', {
        visitId: props.visitGroup.encounterNum,
        visitBlob: props.visitGroup.visit.VISIT_BLOB,
        extractedVisitType: visitType,
      })
    } catch {
      logger.debug('Failed to parse VISIT_BLOB, using visitType field', {
        visitId: props.visitGroup.encounterNum,
        visitBlob: props.visitGroup.visit.VISIT_BLOB,
        visitType: props.visitGroup.visit?.visitType,
      })
    }
  }

  try {
    if (!visitType) {
      visitTypeData.value = { label: 'General Visit', icon: 'local_hospital', color: 'primary' }
      return
    }

    // First try to find in global settings visit type options
    const typeOption = visitTypeOptions.value.find((vt) => vt.value === visitType)
    if (typeOption) {
      visitTypeData.value = {
        label: typeOption.label,
        icon: typeOption.icon || getVisitTypeIcon(visitType),
        color: typeOption.color || getVisitTypeColor(visitType),
      }
      logger.debug('Resolved visit type from global settings', {
        visitId: props.visitGroup.encounterNum,
        visitType,
        resolvedLabel: typeOption.label,
      })
      return
    }

    // Fallback to concept resolution
    const resolved = await conceptStore.resolveConcept(visitType, {
      context: 'visit_type',
      table: 'VISIT_DIMENSION',
      column: 'VISIT_TYPE_CD',
    })

    visitTypeData.value = {
      label: resolved.label || getVisitTypeLabel(visitType),
      icon: resolved.icon || getVisitTypeIcon(visitType),
      color: resolved.color || getVisitTypeColor(visitType),
    }

    logger.debug('Resolved visit type from concept store', {
      visitId: props.visitGroup.encounterNum,
      visitType,
      resolvedLabel: resolved.label,
      resolvedIcon: resolved.icon,
      resolvedColor: resolved.color,
    })
  } catch (error) {
    logger.error('Failed to resolve visit type', error, {
      visitType: visitType || props.visitGroup.visit?.visitType,
      visitId: props.visitGroup.encounterNum,
    })
    visitTypeData.value = {
      label: getVisitTypeLabel(visitType || props.visitGroup.visit?.visitType),
      icon: getVisitTypeIcon(visitType || props.visitGroup.visit?.visitType),
      color: getVisitTypeColor(visitType || props.visitGroup.visit?.visitType),
    }
  }
}

// Resolve visit status using concept resolution
const resolveVisitStatus = async () => {
  try {
    if (!props.visitGroup.visit?.ACTIVE_STATUS_CD) {
      statusData.value = { label: 'Unknown', color: 'grey', class: 'status-default' }
      return
    }

    const resolved = await conceptStore.resolveConcept(props.visitGroup.visit.ACTIVE_STATUS_CD, {
      context: 'visit_status',
      table: 'VISIT_DIMENSION',
      column: 'ACTIVE_STATUS_CD',
    })

    // Map resolved status labels to CSS classes
    const statusClassMapping = {
      Active: 'status-active',
      Classified: 'status-active',
      Closed: 'status-completed',
      Inactive: 'status-cancelled',
      Completed: 'status-completed',
      Discharged: 'status-completed',
      Cancelled: 'status-cancelled',
      Pending: 'status-active',
    }

    const getCssClass = (label) => {
      if (label && statusClassMapping[label]) {
        return statusClassMapping[label]
      }
      return 'status-default'
    }

    statusData.value = {
      label: resolved.label,
      color: resolved.color,
      class: getCssClass(resolved.label),
    }

    logger.debug('Final status mapping result', {
      visitId: props.visitGroup.encounterNum,
      finalLabel: resolved.label,
      finalColor: resolved.color,
      finalClass: statusData.value.class,
    })
  } catch (error) {
    logger.error('Failed to resolve visit status', error, {
      visitStatus: props.visitGroup.visit?.ACTIVE_STATUS_CD,
      visitId: props.visitGroup.encounterNum,
    })
    statusData.value = { label: 'Unknown', color: 'grey', class: 'status-default' }
  }
}

// Visit type helper methods (same as in VisitTimelineItem.vue)
const getVisitTypeLabel = (typeCode) => {
  const labelMap = {
    routine: 'Routine Check-up',
    followup: 'Follow-up',
    emergency: 'Emergency',
    consultation: 'Consultation',
    procedure: 'Procedure',
  }
  return labelMap[typeCode] || typeCode || 'General Visit'
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
  return colorMap[typeCode] || 'primary'
}

// Computed properties using resolved data
const visitTypeLabel = computed(() => visitTypeData.value.label)
const typeIcon = computed(() => visitTypeData.value.icon)
const visitTypeColor = computed(() => visitTypeData.value.color)

// Visit action methods
const openEditVisitDialog = () => {
  showEditVisitDialog.value = true
}

const openCreateObservationDialog = () => {
  showCreateObservationDialog.value = true
}

const confirmDeleteVisit = () => {
  const visitData = props.visitGroup.visit || props.visitGroup
  const visitDate = formatDate(visitData.START_DATE)

  // Set up first confirmation dialog
  deleteDialogTitle.value = 'Delete Visit'
  deleteDialogMessage.value = `Are you sure you want to delete the visit from <strong>${visitDate}</strong>?`

  // Show first confirmation dialog
  showDeleteConfirmDialog.value = true
}

// Dialog event handlers
const onDeleteConfirmed = () => {
  const observationCount = props.visitGroup.observations?.length || 0

  // Check if visit has observations
  if (observationCount > 0) {
    // Set up warning dialog
    deleteWarningMessage.value = `This visit contains <strong>${observationCount}</strong> observation${observationCount > 1 ? 's' : ''}. Deleting the visit will also delete all associated observations.<br><br><strong>This action cannot be undone.</strong>`

    // Show warning dialog
    showDeleteWarningDialog.value = true
  } else {
    // No observations, proceed with deletion
    performDeleteVisit()
  }
}

const onDeleteCancelled = () => {
  // Dialog closed, no action needed
}

const onDeleteWarningConfirmed = () => {
  performDeleteVisit()
}

const onDeleteWarningCancelled = () => {
  // Dialog closed, no action needed
}

// Perform the actual visit deletion
const performDeleteVisit = async () => {
  const visitData = props.visitGroup.visit || props.visitGroup

  const loadingDialog = $q.dialog({
    title: 'Deleting Visit',
    message: 'Please wait while the visit is being deleted...',
    progress: true,
    persistent: true,
    ok: false,
    cancel: false,
  })

  try {
    // Get visit repository
    const visitRepository = databaseStore.getRepository('visit')
    if (!visitRepository) {
      throw new Error('Visit repository not available')
    }

    // Delete the visit (cascade delete will handle observations)
    await visitRepository.delete(visitData.ENCOUNTER_NUM)

    loadingDialog.hide()

    $q.notify({
      type: 'positive',
      message: `Visit ${visitData.ENCOUNTER_NUM} deleted successfully`,
      position: 'top',
      timeout: 3000,
      actions: [
        {
          icon: 'close',
          color: 'white',
          handler: () => {
            /* dismiss */
          },
        },
      ],
    })

    // Clean up state
    showDeleteConfirmDialog.value = false
    showDeleteWarningDialog.value = false

    // Small delay to ensure database operation completes
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Emit to parent to reload data
    emit('visitUpdated')
  } catch (error) {
    loadingDialog.hide()
    logger.error('Error deleting visit', error)

    // Clean up state on error
    showDeleteConfirmDialog.value = false
    showDeleteWarningDialog.value = false

    $q.notify({
      type: 'negative',
      message: `Failed to delete visit: ${error.message}`,
      position: 'top',
      timeout: 5000,
      actions: [
        {
          icon: 'close',
          color: 'white',
          handler: () => {
            /* dismiss */
          },
        },
      ],
    })
  }
}

// Event handlers for dialogs
const onVisitUpdated = () => {
  emit('visitUpdated')
}

const onObservationCreated = () => {
  emit('observationUpdated')
}
</script>

<style lang="scss" scoped>
.visit-header {
  background: linear-gradient(145deg, #ffffff 0%, #f8f9ff 100%);
  border: 1px solid #e8ecf4;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  position: relative;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);

  // Subtle inner shadow for depth
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 249, 255, 0.4) 100%);
    pointer-events: none;
  }

  &.cursor-pointer {
    user-select: none;

    &:hover {
      background: linear-gradient(145deg, #f0f4ff 0%, #e8f0ff 100%);
      transform: translateY(-2px);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.12),
        0 2px 8px rgba(0, 0, 0, 0.06);
      border-color: rgba(25, 118, 210, 0.3);

      .q-avatar {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }

      .visit-type-status .q-chip {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    }
  }

  // Style for empty visits (non-clickable)
  &:not(.cursor-pointer) {
    opacity: 0.8;
    background: linear-gradient(145deg, #fafbfc 0%, #f1f3f4 100%);
    border-color: #e0e3e7;

    .text-h6 {
      color: #9e9e9e !important;
    }

    .q-avatar {
      opacity: 0.6;
    }
  }

  .q-avatar {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 3px 12px rgba(0, 0, 0, 0.15),
      0 1px 4px rgba(0, 0, 0, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.8);

    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
  }

  .visit-type-status {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    .q-chip {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-radius: 20px;
      font-weight: 500;
      letter-spacing: 0.025em;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    }
  }

  .visit-notes-inline {
    font-style: normal;
    display: inline-flex;
    align-items: center;
    background: linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(25, 118, 210, 0.04) 100%);
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid rgba(25, 118, 210, 0.15);
    transition: all 0.3s ease;

    .q-icon {
      color: #1976d2;
      opacity: 0.8;
    }

    .text-body2 {
      font-size: 0.875rem;
      line-height: 1.4;
      color: #424242;
      font-weight: 400;
    }

    .q-btn {
      min-height: auto;
      padding: 3px 8px;
      font-size: 0.75rem;
      text-transform: none;
      border-radius: 12px;
      background: rgba(25, 118, 210, 0.1);

      &:hover {
        background: rgba(25, 118, 210, 0.2);
      }
    }

    &:hover {
      background: linear-gradient(135deg, rgba(25, 118, 210, 0.12) 0%, rgba(25, 118, 210, 0.08) 100%);
      border-color: rgba(25, 118, 210, 0.25);
    }
  }

  .text-h6 {
    font-weight: 600;
    letter-spacing: -0.025em;
    color: #1976d2;
    margin-bottom: 4px;
  }

  .text-caption {
    color: #757575;
    font-weight: 500;
  }
}

.observations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

// Visit actions styling
.visit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slideInFromRight 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  .q-btn {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 44px;
    min-width: 44px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.05);

    &:hover {
      transform: translateY(-2px) scale(1.05);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    // Enhanced button styling for better visibility
    &.text-positive {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.1) 100%);
      border-color: rgba(76, 175, 80, 0.2);

      &:hover {
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.25) 0%, rgba(76, 175, 80, 0.15) 100%);
        border-color: rgba(76, 175, 80, 0.3);
      }
    }

    &.text-primary {
      background: linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(25, 118, 210, 0.1) 100%);
      border-color: rgba(25, 118, 210, 0.2);

      &:hover {
        background: linear-gradient(135deg, rgba(25, 118, 210, 0.25) 0%, rgba(25, 118, 210, 0.15) 100%);
        border-color: rgba(25, 118, 210, 0.3);
      }
    }

    &.text-negative {
      background: linear-gradient(135deg, rgba(244, 67, 54, 0.15) 0%, rgba(244, 67, 54, 0.1) 100%);
      border-color: rgba(244, 67, 54, 0.2);

      &:hover {
        background: linear-gradient(135deg, rgba(244, 67, 54, 0.25) 0%, rgba(244, 67, 54, 0.15) 100%);
        border-color: rgba(244, 67, 54, 0.3);
      }
    }
  }
}

// Enhanced animations
@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

// Animation for new cards
.observation-card {
  animation: fadeInScale 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// Overall item animation
.timeline-item {
  animation: slideInFromBottom 0.5s cubic-bezier(0.4, 0, 0.2, 1);

  &:nth-child(1) {
    animation-delay: 0.1s;
  }
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.3s;
  }
  &:nth-child(4) {
    animation-delay: 0.4s;
  }
  &:nth-child(5) {
    animation-delay: 0.5s;
  }
  &:nth-child(6) {
    animation-delay: 0.6s;
  }
  &:nth-child(7) {
    animation-delay: 0.7s;
  }
  &:nth-child(8) {
    animation-delay: 0.8s;
  }
}

@keyframes slideInFromBottom {
  from {
    opacity: 0;
    transform: translateY(40px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .visit-header {
    padding: 16px;
    margin-bottom: 16px;
    border-radius: 12px;

    &::before {
      border-radius: 12px;
    }
  }

  .observations-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .visit-actions {
    gap: 6px;

    .q-btn {
      min-height: 40px;
      min-width: 40px;
    }
  }
}

@media (max-width: 480px) {
  .visit-header {
    padding: 12px;
    border-radius: 10px;

    &::before {
      border-radius: 10px;
    }
  }

  .observations-grid {
    gap: 8px;
  }

  .observation-card {
    .q-card-section {
      padding: 8px !important;
    }
  }

  .visit-actions {
    gap: 4px;

    .q-btn {
      min-height: 36px;
      min-width: 36px;
    }
  }

  .q-avatar {
    size: 36px !important;
  }

  .text-h6 {
    font-size: 1rem;
  }
}

// Dark theme support
@media (prefers-color-scheme: dark) {
  .visit-header {
    background: linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%);
    border-color: #404040;

    &::before {
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
    }

    &.cursor-pointer:hover {
      background: linear-gradient(145deg, #2a2a2a 0%, #333333 100%);
      border-color: rgba(25, 118, 210, 0.4);
    }

    &:not(.cursor-pointer) {
      background: linear-gradient(145deg, #1a1a1a 0%, #202020 100%);
      border-color: #303030;

      .text-h6 {
        color: #9e9e9e !important;
      }
    }

    .text-h6 {
      color: #2196f3;
    }

    .text-caption {
      color: #b0b0b0;
    }

    .visit-notes-inline {
      background: linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(25, 118, 210, 0.08) 100%);
      border-color: rgba(25, 118, 210, 0.25);

      .text-body2 {
        color: #e0e0e0;
      }
    }
  }

  .visit-actions .q-btn {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.1);
  }
}
</style>
