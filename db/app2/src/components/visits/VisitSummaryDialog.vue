<template>
  <AppDialog v-model="dialogModel" :title="dialogTitle" :subtitle="dialogSubtitle" size="xl" :show-actions="false" :show-close="true">
    <div v-if="loading" class="loading-container">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Loading visit summary...</div>
    </div>

    <div v-else-if="visitStore.error" class="error-container">
      <q-icon name="error" size="48px" color="negative" />
      <div class="text-h6 text-negative q-mt-sm">Failed to load visit data</div>
      <div class="text-body2 text-grey-6">{{ visitStore.error }}</div>
    </div>

    <div v-else-if="!visit" class="no-visit-selected">
      <q-icon name="event_busy" size="48px" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-sm">No visit selected</div>
      <div class="text-body2 text-grey-5">Please select a visit to view its summary.</div>
    </div>

    <div v-else class="visit-summary-content">
      <!-- Visit Overview -->
      <div class="visit-overview q-mb-lg">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-h6 text-primary q-mb-sm">
              <q-icon name="event" class="q-mr-sm" />
              Visit Overview
            </div>
            <div class="row q-gutter-md">
              <div class="col">
                <q-chip outline color="primary" icon="schedule">
                  {{ formattedDate }}
                </q-chip>
              </div>
              <div class="col">
                <q-chip outline color="secondary" :icon="visitTypeIcon">
                  {{ visitTypeLabel }}
                </q-chip>
              </div>
              <div class="col-auto">
                <q-chip outline color="accent" icon="assignment"> {{ totalObservations }} observations </q-chip>
              </div>
            </div>
            <div v-if="visit.notes" class="visit-notes q-mt-md">
              <div class="text-subtitle2 text-grey-7 q-mb-xs">Notes:</div>
              <div class="text-body2">{{ visit.notes }}</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Observations by Category -->
      <div v-if="categorizedObservations.length > 0" class="observations-section">
        <div v-for="category in categorizedObservations" :key="category.name" class="category-section q-mb-lg">
          <q-card flat bordered>
            <q-card-section>
              <div class="category-header">
                <h6 class="text-h6 text-primary q-my-none">
                  <q-icon :name="getCategoryIcon(category.name)" class="q-mr-sm" />
                  {{ category.name }}
                  <q-badge color="secondary" :label="category.observations.length" class="q-ml-sm" />
                </h6>
              </div>

              <div class="row q-gutter-sm q-mt-xs justify-start">
                <div v-for="obs in category.observations" :key="obs.observationId" class="col-xl-3 col-lg-4 col-md-3 col-sm-3 col-xs-6">
                  <div class="observation-card">
                    <div class="observation-header">
                      <div class="concept-name">{{ obs.conceptName }}</div>
                      <div class="value-type">
                        <q-chip dense size="md" :color="getValueTypeColor(obs.valueType)" :label="obs.valueType" />
                      </div>
                    </div>

                    <div class="observation-value">
                      <!-- Regular Values -->
                      <div v-if="obs.valueType !== 'R'" class="value-display">
                        <span class="value-text">{{ obs.displayValue || 'No value' }}</span>
                        <span v-if="obs.unit" class="value-unit">{{ obs.unit }}</span>
                      </div>

                      <!-- File Values -->
                      <div v-else-if="obs.valueType === 'R' && obs.fileInfo" class="file-value">
                        <div class="file-info">
                          <q-icon :name="getFileIcon(obs.fileInfo.filename)" :color="getFileColor(obs.fileInfo.filename)" size="18px" class="q-mr-xs" />
                          <div class="file-details">
                            <div class="file-name">{{ obs.fileInfo.filename }}</div>
                            <div class="file-size text-caption text-grey-6">
                              {{ formatFileSize(obs.fileInfo.size) }}
                            </div>
                          </div>
                        </div>
                        <q-btn flat round dense icon="visibility" size="xs" color="primary" @click="previewFile(obs)">
                          <q-tooltip>Preview File</q-tooltip>
                        </q-btn>
                      </div>

                      <!-- No value state -->
                      <div v-else-if="obs.valueType === 'R'" class="no-file-value">
                        <q-icon name="insert_drive_file" size="14px" color="grey-5" />
                        <span class="text-grey-6 text-caption">No file attached</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- No observations state -->
      <div v-else class="no-observations">
        <q-icon name="assignment" size="48px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-sm">No observations recorded</div>
        <div class="text-body2 text-grey-5">This visit has no recorded observations yet.</div>
      </div>
    </div>

    <!-- File Preview Dialog -->
    <FilePreviewDialog
      v-if="selectedFileObservation"
      v-model="showFilePreview"
      :observation-id="selectedFileObservation.observationId"
      :file-info="selectedFileObservation.fileInfo"
      :concept-name="selectedFileObservation.conceptName"
      :upload-date="selectedFileObservation.date"
    />
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import AppDialog from 'src/components/shared/AppDialog.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'
import { getVisitTypeLabel, getVisitTypeIcon, getValueTypeColor, getCategoryIcon, getFileIcon, getFileColor, formatFileSize, formatDateVerbose } from 'src/shared/utils/medical-utils.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  visit: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const visitStore = useVisitObservationStore()

// State
const selectedFileObservation = ref(null)
const showFilePreview = ref(false)

// Computed
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dialogTitle = computed(() => {
  if (!props.visit) return 'Visit Summary'
  return `Visit Summary - ${formattedDate.value}`
})

const dialogSubtitle = computed(() => {
  if (!props.visit) return 'No visit selected'
  return `${visitTypeLabel.value} • ${totalObservations.value} observations`
})

const formattedDate = computed(() => {
  return formatDateVerbose(props.visit?.date)
})

const visitTypeLabel = computed(() => {
  return getVisitTypeLabel(props.visit?.type)
})

const visitTypeIcon = computed(() => {
  return getVisitTypeIcon(props.visit?.type)
})

const totalObservations = computed(() => {
  return observations.value.length
})

// Use store data when visit matches selected visit, otherwise load separately
const observations = computed(() => {
  if (props.visit && visitStore.selectedVisit && props.visit.id === visitStore.selectedVisit.id) {
    return visitStore.observations
  }
  return [] // Could implement separate loading for non-selected visits if needed
})

const loading = computed(() => {
  return visitStore.loading.observations
})

const categorizedObservations = computed(() => visitStore.categorizedObservations)

// Methods
// Observations are now loaded via the store
// Utility functions imported from medical-utils.js

const previewFile = (observation) => {
  selectedFileObservation.value = observation
  showFilePreview.value = true
}

// Watch for dialog open/close
watch(dialogModel, async (newValue) => {
  if (newValue && props.visit) {
    // Ensure observations are loaded for the visit
    if (visitStore.selectedVisit?.id !== props.visit.id) {
      await visitStore.setSelectedVisit(props.visit)
    }
  } else {
    selectedFileObservation.value = null
    showFilePreview.value = false
  }
})
</script>

<style lang="scss" scoped>
.loading-container,
.error-container,
.no-visit-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.visit-summary-content {
  max-height: none;
}

.visit-overview {
  .visit-notes {
    background: $grey-1;
    padding: 12px 16px;
    border-radius: 8px;
    border-left: 4px solid $primary;
  }
}

.category-section {
  .category-header {
    border-bottom: 1px solid $grey-3;
    padding-bottom: 8px;
  }
}

.observation-card {
  background: $grey-1;
  border: 1px solid $grey-3;
  border-radius: 6px;
  padding: 8px;
  height: 100%;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .observation-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;

    .concept-name {
      font-weight: 500;
      color: $grey-8;
      flex: 1;
      margin-right: 6px;
      line-height: 1.2;
      font-size: 0.8rem;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
    }
  }

  .observation-value {
    .value-display {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;

      .value-text {
        font-weight: 600;
        color: $primary;
        word-break: break-word;
        font-size: 0.85rem;
        line-height: 1.2;
      }

      .value-unit {
        font-size: 0.7rem;
        color: $grey-6;
      }
    }

    .file-value {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.25rem;

      .file-info {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;

        .file-details {
          min-width: 0;
          flex: 1;

          .file-name {
            font-size: 0.75rem;
            font-weight: 500;
            color: $grey-8;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .file-size {
            font-size: 0.65rem;
          }
        }
      }
    }

    .no-file-value {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
    }
  }
}

.no-observations {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  background: $grey-1;
  border-radius: 12px;
  border: 2px dashed $grey-3;
}

@media (max-width: 768px) {
  .observation-card .observation-header {
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
  }
}
</style>
