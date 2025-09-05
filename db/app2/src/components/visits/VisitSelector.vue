<template>
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
</template>

<script setup>
import { computed } from 'vue'
import { useVisitStore } from 'src/stores/visit-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useLoggingStore } from 'src/stores/logging-store'

defineProps({
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['visit-selected', 'create-new-visit', 'edit-visit'])

const visitStore = useVisitStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('VisitSelector')

// Computed from store
const selectedVisit = computed({
  get: () => {
    // Return the full visit object that matches the store's selectedVisit
    if (!visitStore.selectedVisit) return null
    return visitOptions.value.find((opt) => opt.value.id === visitStore.selectedVisit.id)?.value || visitStore.selectedVisit
  },
  set: async (visit) => {
    if (visit) {
      await visitObservationService.selectVisitAndLoadObservations(visit)
    }
  },
})

const visitOptions = computed(() => visitStore.visitOptions)

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

// Methods
const onVisitSelected = async (visit) => {
  if (!visit) return

  try {
    await visitStore.setSelectedVisit(visit)
    emit('visit-selected', visit)
  } catch (error) {
    logger.error('Failed to select visit', error)
    throw error // Let parent handle the error notification
  }
}

const createNewVisit = () => {
  emit('create-new-visit')
}

const editSelectedVisit = () => {
  if (selectedVisit.value) {
    emit('edit-visit', selectedVisit.value)
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
</script>

<style lang="scss" scoped>
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

@media (max-width: 768px) {
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
