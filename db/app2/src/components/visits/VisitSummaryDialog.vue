<template>
  <AppDialog v-model="dialogModel" :title="dialogTitle" :subtitle="dialogSubtitle" size="xl" :show-actions="false" :show-close="true">
    <div v-if="loading" class="loading-container">
      <q-spinner-grid size="50px" color="primary" />
      <div class="text-h6 q-mt-md">Loading visit summary...</div>
    </div>

    <div v-else-if="error" class="error-container">
      <q-icon name="error" size="48px" color="negative" />
      <div class="text-h6 text-negative q-mt-sm">Failed to load visit data</div>
      <div class="text-body2 text-grey-6">{{ error }}</div>
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
                        <q-chip dense size="xs" :color="getValueTypeColor(obs.valueType)" :label="obs.valueType" />
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
import { useDatabaseStore } from 'src/stores/database-store'
import AppDialog from 'src/components/shared/AppDialog.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'

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

const dbStore = useDatabaseStore()

// State
const loading = ref(false)
const error = ref('')
const observations = ref([])
const selectedFileObservation = ref(null)
const showFilePreview = ref(false)

// Computed
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const dialogTitle = computed(() => {
  return `Visit Summary - ${formattedDate.value}`
})

const dialogSubtitle = computed(() => {
  return `${visitTypeLabel.value} • ${totalObservations.value} observations`
})

const formattedDate = computed(() => {
  if (!props.visit?.date) return 'Unknown Date'
  const date = new Date(props.visit.date)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const visitTypeLabel = computed(() => {
  switch (props.visit?.type) {
    case 'routine':
      return 'Routine Check-up'
    case 'followup':
      return 'Follow-up'
    case 'emergency':
      return 'Emergency'
    case 'consultation':
      return 'Consultation'
    case 'procedure':
      return 'Procedure'
    default:
      return 'General Visit'
  }
})

const visitTypeIcon = computed(() => {
  switch (props.visit?.type) {
    case 'routine':
      return 'health_and_safety'
    case 'followup':
      return 'follow_the_signs'
    case 'emergency':
      return 'emergency'
    case 'consultation':
      return 'psychology'
    case 'procedure':
      return 'medical_services'
    default:
      return 'local_hospital'
  }
})

const totalObservations = computed(() => {
  return observations.value.length
})

const categorizedObservations = computed(() => {
  // Group observations by category
  const categories = new Map()

  observations.value.forEach((obs) => {
    const categoryName = obs.category || 'Uncategorized'
    if (!categories.has(categoryName)) {
      categories.set(categoryName, {
        name: categoryName,
        observations: [],
      })
    }
    categories.get(categoryName).observations.push(obs)
  })

  // Sort categories and observations
  return Array.from(categories.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => ({
      ...category,
      observations: category.observations.sort((a, b) => a.conceptName.localeCompare(b.conceptName)),
    }))
})

// Methods
const loadVisitObservations = async () => {
  if (!props.visit?.id) return

  try {
    loading.value = true
    error.value = ''

    const query = `
            SELECT 
                OBSERVATION_ID,
                CONCEPT_CD,
                VALTYPE_CD,
                TVAL_CHAR,
                NVAL_NUM,
                UNIT_CD,
                START_DATE,
                CATEGORY_CHAR,
                CONCEPT_NAME_CHAR as CONCEPT_NAME,
                TVAL_RESOLVED
            FROM patient_observations
            WHERE ENCOUNTER_NUM = ?
            ORDER BY CATEGORY_CHAR, CONCEPT_NAME_CHAR
        `

    const result = await dbStore.executeQuery(query, [props.visit.id])

    if (result.success) {
      observations.value = result.data.map((obs) => {
        const processedObs = {
          observationId: obs.OBSERVATION_ID,
          conceptCode: obs.CONCEPT_CD,
          conceptName: obs.CONCEPT_NAME || obs.CONCEPT_CD,
          valueType: obs.VALTYPE_CD,
          originalValue: obs.TVAL_CHAR || obs.NVAL_NUM,
          resolvedValue: obs.TVAL_RESOLVED,
          unit: obs.UNIT_CD,
          category: obs.CATEGORY_CHAR || 'General',
          date: obs.START_DATE,
          displayValue: null,
          fileInfo: null,
        }

        // Process different value types
        switch (obs.VALTYPE_CD) {
          case 'S': // Selection
          case 'F': // Finding
          case 'A': // Array/Multiple choice
            processedObs.displayValue = obs.TVAL_RESOLVED || obs.TVAL_CHAR || 'No value'
            break
          case 'R': // Raw data/File
            try {
              if (obs.TVAL_CHAR) {
                processedObs.fileInfo = JSON.parse(obs.TVAL_CHAR)
                processedObs.displayValue = processedObs.fileInfo.filename || 'File attached'
              }
            } catch {
              // JSON parse error - intentionally ignored
              processedObs.displayValue = 'Invalid file data'
            }
            break
          case 'N': // Numeric
            processedObs.displayValue = obs.NVAL_NUM?.toString() || 'No value'
            break
          default: // Text and others
            processedObs.displayValue = obs.TVAL_CHAR || 'No value'
        }

        return processedObs
      })
    } else {
      throw new Error('Failed to load observations')
    }
  } catch (err) {
    console.error('Failed to load visit observations:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const getCategoryIcon = (categoryName) => {
  const category = categoryName?.toLowerCase() || ''
  if (category.includes('vital')) return 'favorite'
  if (category.includes('lab')) return 'science'
  if (category.includes('medication') || category.includes('drug')) return 'medication'
  if (category.includes('symptom')) return 'sick'
  if (category.includes('diagnosis')) return 'medical_information'
  if (category.includes('procedure')) return 'medical_services'
  if (category.includes('note')) return 'note'
  return 'assignment'
}

const getValueTypeColor = (valueType) => {
  switch (valueType) {
    case 'S':
      return 'blue'
    case 'F':
      return 'green'
    case 'A':
      return 'purple'
    case 'R':
      return 'orange'
    case 'N':
      return 'teal'
    case 'D':
      return 'pink'
    default:
      return 'grey'
  }
}

const getFileIcon = (filename) => {
  if (!filename) return 'insert_drive_file'
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'picture_as_pdf'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return 'image'
    case 'txt':
      return 'description'
    default:
      return 'insert_drive_file'
  }
}

const getFileColor = (filename) => {
  if (!filename) return 'grey'
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'red'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return 'green'
    case 'txt':
      return 'blue'
    default:
      return 'grey'
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const previewFile = (observation) => {
  selectedFileObservation.value = observation
  showFilePreview.value = true
}

// Watch for dialog open/close
watch(dialogModel, (newValue) => {
  if (newValue && props.visit) {
    loadVisitObservations()
  } else {
    observations.value = []
    error.value = ''
    selectedFileObservation.value = null
    showFilePreview.value = false
  }
})
</script>

<style lang="scss" scoped>
.loading-container,
.error-container {
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
