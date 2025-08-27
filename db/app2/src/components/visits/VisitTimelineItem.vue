<template>
  <div class="timeline-item" :class="{ 'timeline-item--selected': isSelected }" @click="selectVisit">
    <div class="timeline-marker">
      <div class="timeline-dot" :class="statusClass"></div>
      <div v-if="!isLast" class="timeline-line"></div>
    </div>
    <div class="timeline-card">
      <q-card flat bordered class="visit-card">
        <q-card-section>
          <div class="visit-header">
            <div class="visit-date">
              <q-icon name="event" class="q-mr-xs" />
              {{ formattedDate }}
              <!-- Status Chip -->
              <q-chip v-if="statusData.label !== 'Unknown'" :color="statusData.color" text-color="white" size="sm" class="q-ml-sm status-chip">
                {{ statusData.label }}
              </q-chip>
            </div>
            <div class="visit-actions">
              <q-btn flat round icon="visibility" size="sm" color="secondary" @click.stop="viewVisit">
                <q-tooltip>View Visit Summary</q-tooltip>
              </q-btn>
              <q-btn flat round icon="edit" size="sm" color="primary" @click.stop="editVisit">
                <q-tooltip>Edit Visit</q-tooltip>
              </q-btn>
              <q-btn flat round icon="more_vert" size="sm" color="grey-6" @click.stop>
                <q-menu>
                  <q-list>
                    <q-item clickable @click="duplicateVisit">
                      <q-item-section avatar>
                        <q-icon name="content_copy" />
                      </q-item-section>
                      <q-item-section>Clone Visit</q-item-section>
                    </q-item>
                    <q-separator />
                    <q-item clickable @click="deleteVisit">
                      <q-item-section avatar>
                        <q-icon name="delete" color="negative" />
                      </q-item-section>
                      <q-item-section>Delete Visit</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </div>

          <div class="visit-summary">
            <div class="visit-type">
              <q-icon :name="typeIcon" size="16px" class="q-mr-xs" />
              {{ visitTypeLabel }}
            </div>
            <div class="observation-count">
              <q-icon name="assignment" size="14px" class="q-mr-xs" />
              {{ visit.observationCount || 0 }} observations
            </div>
          </div>

          <div v-if="visit.notes" class="visit-notes">
            {{ visit.notes }}
          </div>

          <!-- Visit metadata -->
          <div class="visit-metadata">
            <div v-if="visit.location" class="metadata-item">
              <q-icon name="place" size="12px" class="q-mr-xs" />
              {{ visit.location }}
            </div>
            <div v-if="visit.endDate" class="metadata-item">
              <q-icon name="schedule" size="12px" class="q-mr-xs" />
              Duration: {{ visitDuration }}
            </div>
          </div>
        </q-card-section>

        <!-- Progress indicator for selected visit -->
        <div v-if="isSelected" class="selection-indicator"></div>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  visit: {
    type: Object,
    required: true,
  },
  isLast: {
    type: Boolean,
    default: false,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'edit', 'view', 'duplicate', 'delete'])

// Store instances
const globalSettingsStore = useGlobalSettingsStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitTimelineItem')

// Reactive state for resolved data
const visitTypeData = ref({ label: 'General Visit', icon: 'local_hospital', color: 'primary' })
const statusData = ref({ label: 'Unknown', color: 'grey', class: 'status-default' })
const visitTypeOptions = ref([])

// Load visit type options on mount
onMounted(async () => {
  try {
    visitTypeOptions.value = await globalSettingsStore.getVisitTypeOptions()
    await resolveVisitType()
    await resolveVisitStatus()
  } catch (error) {
    logger.error('Failed to load visit type options', error, { visitId: props.visit.id })
  }
})

// Watch for changes in visit type, status, or rawData
watch(
  () => [props.visit.type, props.visit.status, props.visit.rawData?.VISIT_BLOB],
  async () => {
    await resolveVisitType()
    await resolveVisitStatus()
  },
  { immediate: false },
)

// Resolve visit type using store
const resolveVisitType = async () => {
  // Extract visit type from VISIT_BLOB if available (new approach)
  let visitType = props.visit.type // fallback to legacy field

  if (props.visit.rawData?.VISIT_BLOB) {
    try {
      const blobData = JSON.parse(props.visit.rawData.VISIT_BLOB)
      if (blobData.visitType) {
        visitType = blobData.visitType
      }
      logger.debug('Extracted visit type from VISIT_BLOB', {
        visitId: props.visit.id,
        visitBlob: props.visit.rawData.VISIT_BLOB,
        extractedVisitType: visitType,
      })
    } catch {
      logger.debug('Failed to parse VISIT_BLOB, using legacy type field', {
        visitId: props.visit.id,
        visitBlob: props.visit.rawData.VISIT_BLOB,
        legacyType: props.visit.type,
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
        visitId: props.visit.id,
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
      icon: getVisitTypeIcon(visitType),
      color: resolved.color || getVisitTypeColor(visitType),
    }

    logger.debug('Resolved visit type from concept store', {
      visitId: props.visit.id,
      visitType,
      resolvedLabel: resolved.label,
    })
  } catch (error) {
    logger.error('Failed to resolve visit type', error, {
      visitType: visitType || props.visit.type,
      visitId: props.visit.id,
    })
    visitTypeData.value = {
      label: getVisitTypeLabel(visitType || props.visit.type),
      icon: getVisitTypeIcon(visitType || props.visit.type),
      color: getVisitTypeColor(visitType || props.visit.type),
    }
  }
}

// Visit type helper methods (same as in VisitDataEntry.vue)
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

// Resolve visit status using concept resolution
const resolveVisitStatus = async () => {
  try {
    if (!props.visit.status) {
      statusData.value = { label: 'Unknown', color: 'grey', class: 'status-default' }
      return
    }

    const resolved = await conceptStore.resolveConcept(props.visit.status, {
      context: 'visit_status',
      table: 'VISIT_DIMENSION',
      column: 'ACTIVE_STATUS_CD',
    })

    logger.debug('Visit status resolution result', {
      visitId: props.visit.id,
      rawStatus: props.visit.status,
      resolvedLabel: resolved.label,
      resolvedColor: resolved.color,
      resolvedSource: resolved.source,
    })

    // Map resolved status labels to CSS classes - let concept store handle colors
    const statusClassMapping = {
      // SNOMED-CT visit status labels from concept-resolution-store
      Active: 'status-active', // SCTID: 55561003
      Classified: 'status-active', // SCTID: 73504009 (like active)
      Closed: 'status-completed', // SCTID: 29179001 (completed)
      Inactive: 'status-cancelled', // SCTID: 73425007

      // Legacy labels (for backward compatibility)
      Completed: 'status-completed',
      Discharged: 'status-completed',
      Cancelled: 'status-cancelled',
      Pending: 'status-active',
    }

    // Get CSS class based on resolved label, with fallback to raw status code mapping
    const getCssClass = (label, rawStatus) => {
      if (label && statusClassMapping[label]) {
        return statusClassMapping[label]
      }

      // Fallback mapping for raw database codes (both legacy and SNOMED-CT)
      const rawCodeMapping = {
        // SNOMED-CT codes (preferred)
        'SCTID: 55561003': 'status-active', // Active
        'SCTID: 73504009': 'status-active', // Classified (like active)
        'SCTID: 29179001': 'status-completed', // Closed (completed)
        'SCTID: 73425007': 'status-cancelled', // Inactive

        // Legacy single-letter codes (for backward compatibility)
        A: 'status-active', // Active
        C: 'status-completed', // Completed
        I: 'status-cancelled', // Inactive
        X: 'status-cancelled', // Cancelled
        P: 'status-active', // Pending
      }

      return rawCodeMapping[rawStatus] || 'status-default'
    }

    statusData.value = {
      label: resolved.label,
      color: resolved.color, // Use concept store's color (now handles visit_status context properly)
      class: getCssClass(resolved.label, props.visit.status),
    }

    logger.debug('Final status mapping result', {
      visitId: props.visit.id,
      finalLabel: resolved.label,
      finalColor: resolved.color,
      finalClass: statusData.value.class,
      conceptStoreColor: resolved.color,
      usesConceptStore: true,
    })
  } catch (error) {
    logger.error('Failed to resolve visit status', error, {
      visitStatus: props.visit.status,
      visitId: props.visit.id,
    })
    statusData.value = { label: 'Unknown', color: 'grey', class: 'status-default' }
  }
}

// Computed properties using resolved data
const formattedDate = computed(() => {
  if (!props.visit.date) return 'Unknown'
  const date = new Date(props.visit.date)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})

const statusClass = computed(() => statusData.value.class)
const visitTypeLabel = computed(() => visitTypeData.value.label)
const typeIcon = computed(() => visitTypeData.value.icon)

const visitDuration = computed(() => {
  if (!props.visit.endDate || !props.visit.date) return null

  const start = new Date(props.visit.date)
  const end = new Date(props.visit.endDate)
  const diffHours = Math.abs(end - start) / (1000 * 60 * 60)

  if (diffHours < 1) {
    const diffMinutes = Math.round(diffHours * 60)
    return `${diffMinutes} min`
  } else if (diffHours < 24) {
    return `${Math.round(diffHours)} hours`
  } else {
    const diffDays = Math.round(diffHours / 24)
    return `${diffDays} days`
  }
})

// Methods with logging
const selectVisit = () => {
  logger.logUserAction('visit_selected', {
    visitId: props.visit.id,
    visitType: props.visit.type,
    visitDate: props.visit.date,
  })
  emit('select', props.visit)
}

const editVisit = () => {
  logger.logUserAction('visit_edit_initiated', {
    visitId: props.visit.id,
    visitType: props.visit.type,
    visitDate: props.visit.date,
    observationCount: props.visit.observationCount || 0,
  })
  emit('edit', props.visit)
}

const viewVisit = () => {
  logger.logUserAction('visit_view_requested', {
    visitId: props.visit.id,
    visitType: props.visit.type,
    visitDate: props.visit.date,
  })
  emit('view', props.visit)
}

const duplicateVisit = () => {
  logger.logUserAction('visit_clone_initiated', {
    originalVisitId: props.visit.id,
    visitType: props.visit.type,
    visitDate: props.visit.date,
    observationCount: props.visit.observationCount || 0,
  })
  emit('duplicate', props.visit)
}

const deleteVisit = () => {
  logger.logUserAction('visit_delete_initiated', {
    visitId: props.visit.id,
    visitType: props.visit.type,
    visitDate: props.visit.date,
    observationCount: props.visit.observationCount || 0,
    severity: 'high', // Deletion is a high-impact action
  })
  emit('delete', props.visit)
}
</script>

<style lang="scss" scoped>
.timeline-item {
  display: flex;
  margin-bottom: 2rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &--selected {
    .timeline-card {
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba($primary, 0.3);
    }
  }

  &:hover:not(&--selected) {
    .timeline-card {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }
  }
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 1.5rem;

  .timeline-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-bottom: 0.5rem;
    transition: all 0.3s ease;

    &.status-active {
      background: $negative;
      box-shadow: 0 0 0 4px rgba($negative, 0.2);
    }

    &.status-completed {
      background: $positive;
      box-shadow: 0 0 0 4px rgba($positive, 0.2);
    }

    &.status-cancelled {
      background: $grey-5;
      box-shadow: 0 0 0 4px rgba($grey-5, 0.2);
    }

    &.status-default {
      background: $grey-5;
      box-shadow: 0 0 0 4px rgba($grey-5, 0.2);
    }
  }

  .timeline-line {
    width: 2px;
    flex: 1;
    background: $grey-3;
    min-height: 2rem;
  }
}

.timeline-card {
  flex: 1;
  transition: all 0.3s ease;
  position: relative;
}

.visit-card {
  border-radius: 12px;
  border: 1px solid $grey-3;
  background: white;
  position: relative;
  overflow: hidden;
}

.visit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;

  .visit-date {
    font-weight: 600;
    color: $primary;
    display: flex;
    align-items: center;
    font-size: 0.95rem;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .visit-actions {
    display: flex;
    gap: 0.25rem;
  }

  .status-chip {
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
    }
  }
}

.visit-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;

  .visit-type {
    font-weight: 500;
    color: $grey-8;
    display: flex;
    align-items: center;
    font-size: 0.9rem;
  }

  .observation-count {
    font-size: 0.8rem;
    color: $grey-6;
    display: flex;
    align-items: center;
  }
}

.visit-notes {
  font-size: 0.875rem;
  color: $grey-7;
  line-height: 1.4;
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: $grey-1;
  border-radius: 8px;
  border-left: 3px solid $primary;
}

.visit-metadata {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid $grey-2;

  .metadata-item {
    font-size: 0.75rem;
    color: $grey-6;
    display: flex;
    align-items: center;
  }
}

.selection-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(to bottom, $primary, $secondary);
  border-radius: 0 2px 2px 0;
}

// Animation for timeline items
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.timeline-item {
  animation: slideInRight 0.5s ease-out;
}

// Stagger animation for multiple items
.timeline-item:nth-child(1) {
  animation-delay: 0.1s;
}

.timeline-item:nth-child(2) {
  animation-delay: 0.2s;
}

.timeline-item:nth-child(3) {
  animation-delay: 0.3s;
}

.timeline-item:nth-child(4) {
  animation-delay: 0.4s;
}

.timeline-item:nth-child(5) {
  animation-delay: 0.5s;
}

@media (max-width: 768px) {
  .timeline-marker {
    margin-right: 1rem;
  }

  .visit-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;

    .visit-date {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .visit-actions {
      align-self: flex-end;
    }
  }

  .visit-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .visit-metadata {
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-chip {
    font-size: 0.7rem;
  }
}
</style>
