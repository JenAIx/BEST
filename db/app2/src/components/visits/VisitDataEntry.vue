<template>
  <div class="data-entry-view">
    <div class="entry-container">
      <!-- Visit Selector -->
      <div class="visit-selector">
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
        <q-btn color="primary" icon="add" label="New Visit" @click="createNewVisit" class="q-ml-sm" />
      </div>

      <!-- Field Set Selector -->
      <div v-if="selectedVisit" class="field-set-selector">
        <div class="field-set-header">
          <div class="field-set-title-section">
            <h4 class="field-set-title">Observation Categories</h4>
            <q-chip :color="overallStats.color" :text-color="overallStats.textColor" size="md" class="q-ml-md overall-stats-chip" outline>
              <q-icon name="analytics" size="16px" class="q-mr-xs" />
              {{ overallStats.percentage }}% Complete ({{ overallStats.filled }}/{{ overallStats.total }})
              <q-tooltip class="stats-tooltip">
                <div class="stats-details">
                  <div class="stats-header">📊 Overall Visit Progress</div>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <span class="stat-label">Active Categories:</span>
                      <span class="stat-value">{{ overallStats.activeCategories }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">Total Concepts:</span>
                      <span class="stat-value">{{ overallStats.total }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">Completed:</span>
                      <span class="stat-value">{{ overallStats.filled }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">Progress:</span>
                      <span class="stat-value">{{ overallStats.percentage }}%</span>
                    </div>
                  </div>
                  <q-linear-progress :value="overallStats.percentage / 100" :color="overallStats.color" class="q-mt-md" size="12px" rounded />

                  <!-- Category breakdown in same order as chips below -->
                  <div v-if="overallStats.categoryDetails.length > 0" class="category-breakdown">
                    <div class="breakdown-header">Categories (in display order):</div>
                    <div v-for="category in overallStats.categoryDetails" :key="category.id" class="category-item">
                      <div class="category-info">
                        <q-icon :name="category.icon" size="14px" class="category-icon" />
                        <span class="category-name">{{ category.name }}</span>
                      </div>
                      <div class="category-progress">
                        <span class="progress-text">{{ category.observationCount }}/{{ category.conceptCount }}</span>
                        <span class="progress-percent" :class="{ 'progress-complete': category.percentage === 100 }"> ({{ category.percentage }}%) </span>
                      </div>
                    </div>
                  </div>
                </div>
              </q-tooltip>
            </q-chip>
          </div>
          <q-btn flat icon="settings" label="Configure" @click="showFieldSetConfig = true" size="sm" />
        </div>
        <div class="field-set-chips">
          <!-- Active Field Sets (Left Side) -->
          <div class="active-field-sets">
            <q-chip
              v-for="fieldSet in activeFieldSetsList"
              :key="`active-${fieldSet.id}`"
              selected
              @click="toggleFieldSet(fieldSet.id)"
              color="primary"
              text-color="white"
              clickable
              class="field-set-chip active-chip"
            >
              <q-icon :name="fieldSet.icon" class="q-mr-xs" />
              {{ fieldSet.name }}
              <q-badge v-if="getFieldSetObservationCount(fieldSet.id) > 0" color="white" text-color="primary" class="q-ml-xs">
                {{ getFieldSetObservationCount(fieldSet.id) }}
              </q-badge>
            </q-chip>
          </div>

          <!-- Inactive Field Sets (Right Side - Limited to 3) -->
          <div class="inactive-field-sets">
            <q-chip
              v-for="fieldSet in visibleInactiveFieldSets"
              :key="`inactive-${fieldSet.id}`"
              @click="toggleFieldSet(fieldSet.id)"
              :color="getFieldSetObservationCount(fieldSet.id) > 0 ? 'blue-2' : 'grey-4'"
              :text-color="getFieldSetObservationCount(fieldSet.id) > 0 ? 'blue-9' : 'grey-8'"
              clickable
              :class="[
                'field-set-chip',
                'inactive-chip',
                {
                  'has-observations': getFieldSetObservationCount(fieldSet.id) > 0,
                },
              ]"
            >
              <q-icon :name="fieldSet.icon" class="q-mr-xs" />
              {{ fieldSet.name }}
              <q-badge v-if="getFieldSetObservationCount(fieldSet.id) > 0" color="primary" text-color="white" class="q-ml-xs">
                {{ getFieldSetObservationCount(fieldSet.id) }}
              </q-badge>
            </q-chip>

            <!-- More Inactive Categories Dropdown -->
            <q-btn v-if="hiddenInactiveFieldSets.length > 0" flat round dense icon="more_horiz" color="grey-6" class="more-categories-btn" size="sm">
              <q-tooltip>
                {{ hiddenInactiveFieldSets.length }} more categories
                <span v-if="hiddenInactiveFieldSets.some((fs) => getFieldSetObservationCount(fs.id) > 0)">
                  <br />({{ hiddenInactiveFieldSets.filter((fs) => getFieldSetObservationCount(fs.id) > 0).length }} with observations)
                </span>
              </q-tooltip>
              <q-menu auto-close>
                <q-list style="min-width: 200px">
                  <q-item v-for="fieldSet in hiddenInactiveFieldSets" :key="`hidden-${fieldSet.id}`" clickable @click="toggleFieldSet(fieldSet.id)" class="hidden-field-set-item">
                    <q-item-section avatar>
                      <q-icon :name="fieldSet.icon" color="grey-6" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ fieldSet.name }}</q-item-label>
                      <q-item-label v-if="getFieldSetObservationCount(fieldSet.id) > 0" caption> {{ getFieldSetObservationCount(fieldSet.id) }} observations </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-badge v-if="getFieldSetObservationCount(fieldSet.id) > 0" color="primary" rounded>
                        {{ getFieldSetObservationCount(fieldSet.id) }}
                      </q-badge>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </div>
      </div>

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
      </div>

      <!-- Empty State -->
      <div v-if="!selectedVisit" class="empty-state">
        <q-icon name="assignment" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-sm">Select a visit to start</div>
        <div class="text-body2 text-grey-5">Choose an existing visit or create a new one</div>
      </div>

      <!-- No Field Sets Selected -->
      <div v-if="selectedVisit && activeFieldSets.length === 0" class="no-fieldsets-state">
        <q-icon name="category" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-sm">No observation categories selected</div>
        <div class="text-body2 text-grey-5 q-mb-md">Choose categories above to start entering data</div>
        <q-btn color="primary" @click="showFieldSetConfig = true">Configure Categories</q-btn>
      </div>
    </div>

    <!-- Field Set Configuration Dialog -->
    <q-dialog v-model="showFieldSetConfig" persistent>
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Configure Observation Categories</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-list>
            <q-item v-for="fieldSet in availableFieldSets" :key="fieldSet.id">
              <q-item-section avatar>
                <q-icon :name="fieldSet.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ fieldSet.name }}</q-item-label>
                <q-item-label caption>{{ fieldSet.description }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="fieldSetConfig[fieldSet.id]" :true-value="true" :false-value="false" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="cancelFieldSetConfig" />
          <q-btn color="primary" label="Save" @click="saveFieldSetConfig" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- New Visit Dialog -->
    <NewVisitDialog v-model="showNewVisitDialog" :patient="patient" @created="onVisitCreated" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { AVAILABLE_FIELD_SETS } from 'src/shared/utils/medical-utils'
import ObservationFieldSet from './ObservationFieldSet.vue'
import NewVisitDialog from './NewVisitDialog.vue'

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
const fieldSetConfig = ref({})
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
const visitOptions = computed(() => visitStore.visitOptions)
const previousVisits = computed(() => visitStore.previousVisits)

// Overall completion statistics across all active field sets
const overallStats = computed(() => {
  let totalConcepts = 0
  let filledConcepts = 0
  const categoryDetails = []

  // Calculate totals using the same order as activeFieldSetsList (displayed below)
  activeFieldSetsList.value.forEach((fieldSet) => {
    if (fieldSet && fieldSet.concepts) {
      const conceptCount = fieldSet.concepts.length
      const observations = getFieldSetObservations(fieldSet.id)
      const observationCount = observations.length

      totalConcepts += conceptCount
      filledConcepts += observationCount

      // Store details for consistent ordering in tooltips
      categoryDetails.push({
        id: fieldSet.id,
        name: fieldSet.name,
        icon: fieldSet.icon,
        conceptCount,
        observationCount,
        percentage: conceptCount > 0 ? Math.round((observationCount / conceptCount) * 100) : 0,
      })
    }
  })

  const percentage = totalConcepts > 0 ? Math.round((filledConcepts / totalConcepts) * 100) : 0

  // Color coding based on completion percentage
  let color = 'grey-6'
  let textColor = 'white'

  if (percentage >= 80) {
    color = 'positive' // Green for 80%+
    textColor = 'white'
  } else if (percentage >= 50) {
    color = 'warning' // Orange for 50-79%
    textColor = 'white'
  } else if (percentage > 0) {
    color = 'info' // Blue for 1-49%
    textColor = 'white'
  }

  return {
    percentage,
    filled: filledConcepts,
    total: totalConcepts,
    activeCategories: activeFieldSets.value.length,
    categoryDetails, // Same order as displayed chips
    color,
    textColor,
    isEmpty: percentage === 0,
    isComplete: percentage === 100,
    isHighProgress: percentage >= 80,
    isMediumProgress: percentage >= 50,
  }
})

// Field set organization for better UX
const activeFieldSetsList = computed(() => {
  return availableFieldSets.value.filter((fs) => activeFieldSets.value.includes(fs.id))
})

const inactiveFieldSetsList = computed(() => {
  return availableFieldSets.value.filter((fs) => !activeFieldSets.value.includes(fs.id))
})

const visibleInactiveFieldSets = computed(() => {
  // Adaptive count: 5 inactive if 0 active, 4 if 1 active, etc., minimum 2
  const maxInactive = Math.max(2, 5 - activeFieldSets.value.length)

  // Sort inactive categories - prioritize those with observations
  const sortedInactive = [...inactiveFieldSetsList.value].sort((a, b) => {
    const aObsCount = getFieldSetObservationCount(a.id)
    const bObsCount = getFieldSetObservationCount(b.id)

    // Categories with observations first
    if (aObsCount > 0 && bObsCount === 0) return -1
    if (aObsCount === 0 && bObsCount > 0) return 1

    // If both have observations, sort by count (descending)
    if (aObsCount > 0 && bObsCount > 0) {
      return bObsCount - aObsCount
    }

    // If neither has observations, sort alphabetically
    return a.name.localeCompare(b.name)
  })

  return sortedInactive.slice(0, maxInactive)
})

const hiddenInactiveFieldSets = computed(() => {
  const maxInactive = Math.max(2, 5 - activeFieldSets.value.length)

  // Use the same sorting logic for hidden categories
  const sortedInactive = [...inactiveFieldSetsList.value].sort((a, b) => {
    const aObsCount = getFieldSetObservationCount(a.id)
    const bObsCount = getFieldSetObservationCount(b.id)

    if (aObsCount > 0 && bObsCount === 0) return -1
    if (aObsCount === 0 && bObsCount > 0) return 1
    if (aObsCount > 0 && bObsCount > 0) return bObsCount - aObsCount
    return a.name.localeCompare(b.name)
  })

  return sortedInactive.slice(maxInactive)
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
      // Fallback to hardcoded field sets from medical-utils
      availableFieldSets.value = AVAILABLE_FIELD_SETS
    }

    // Initialize field set config based on available field sets
    fieldSetConfig.value = {}
    availableFieldSets.value.forEach((fs) => {
      fieldSetConfig.value[fs.id] = activeFieldSets.value.includes(fs.id)
    })
  } catch (error) {
    logger.error('Failed to load field sets from global settings', error)
    $q.notify({
      type: 'warning',
      message: 'Using default field sets. Some configurations may not be available.',
      position: 'top',
    })

    // Fallback to hardcoded field sets
    availableFieldSets.value = AVAILABLE_FIELD_SETS

    // Initialize field set config
    fieldSetConfig.value = {}
    availableFieldSets.value.forEach((fs) => {
      fieldSetConfig.value[fs.id] = activeFieldSets.value.includes(fs.id)
    })
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

const getFieldSetObservations = (fieldSetId) => {
  if (!fieldSetId) {
    logger.warn('getFieldSetObservations called with undefined fieldSetId')
    return []
  }
  const observations = visitStore.getFieldSetObservations(fieldSetId, availableFieldSets.value)
  logger.debug(`getFieldSetObservations for ${fieldSetId}`, { fieldSetId, observationCount: observations.length })
  return observations
}

const getFieldSetObservationCount = (fieldSetId) => {
  if (!fieldSetId) {
    logger.warn('getFieldSetObservationCount called with undefined fieldSetId')
    return 0
  }
  return getFieldSetObservations(fieldSetId).length
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

const saveFieldSetConfig = () => {
  activeFieldSets.value = Object.keys(fieldSetConfig.value).filter((key) => fieldSetConfig.value[key])
  localSettings.setSetting('visits.activeFieldSets', activeFieldSets.value)
  showFieldSetConfig.value = false

  $q.notify({
    type: 'positive',
    message: 'Field set configuration saved',
    position: 'top',
  })
}

const cancelFieldSetConfig = () => {
  // Reset config to current active field sets
  fieldSetConfig.value = {}
  activeFieldSets.value.forEach((id) => {
    fieldSetConfig.value[id] = true
  })
  showFieldSetConfig.value = false
}

const createNewVisit = () => {
  showNewVisitDialog.value = true
}

const onVisitCreated = (newVisit) => {
  emit('visit-created', newVisit)
  selectedVisit.value = newVisit
}

const onObservationUpdated = async (data) => {
  logger.info('Observation updated', { conceptCode: data.conceptCode, value: data.value })
  // Store handles reloading observations
  if (visitStore.selectedVisit) {
    await visitStore.loadObservationsForVisit(visitStore.selectedVisit)
  }
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

watch(
  () => showFieldSetConfig.value,
  (show) => {
    if (show) {
      // Reset config when opening dialog
      fieldSetConfig.value = {}
      activeFieldSets.value.forEach((id) => {
        fieldSetConfig.value[id] = true
      })
    }
  },
)

// Lifecycle
onMounted(async () => {
  logger.debug('VisitDataEntry mounted', { activeFieldSets: activeFieldSets.value })

  // Load field sets from global settings
  await loadFieldSets()

  // Load saved settings
  const savedActiveFieldSets = localSettings.getSetting('visits.activeFieldSets')
  if (savedActiveFieldSets) {
    logger.debug('Loading saved active field sets', { savedActiveFieldSets })
    activeFieldSets.value = savedActiveFieldSets
  }

  logger.debug('Field sets configuration loaded', {
    finalActiveFieldSets: activeFieldSets.value,
    availableFieldSets: availableFieldSets.value.map((fs) => fs.id),
  })

  // Initialize field set config
  availableFieldSets.value.forEach((fs) => {
    fieldSetConfig.value[fs.id] = activeFieldSets.value.includes(fs.id)
  })

  // If no visit is selected but visits are available, select the most recent one
  if (!selectedVisit.value && visitOptions.value.length > 0) {
    logger.info('No visit selected, selecting the most recent visit')
    const mostRecentVisit = visitOptions.value[0].value
    await visitStore.setSelectedVisit(mostRecentVisit)
  }
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
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;

  .visit-select {
    flex: 1;
    max-width: 400px;
  }

  .selected-visit {
    display: flex;
    align-items: center;
  }
}

.field-set-selector {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.field-set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.field-set-title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.overall-stats-chip {
  font-weight: 600;
  transition: all 0.3s ease;
  border: 2px solid currentColor !important;
  min-height: 36px;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  // Ensure visibility with strong colors
  &.q-chip--outline {
    background: rgba(255, 255, 255, 0.9) !important;
  }
}

.stats-tooltip {
  .stats-details {
    min-width: 280px;
    padding: 12px;

    .stats-header {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 12px;
      color: white;
      text-align: center;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;

      .stat-item {
        display: flex;
        justify-content: space-between;
        font-size: 13px;

        .stat-label {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        .stat-value {
          color: white;
          font-weight: 600;
        }
      }
    }

    .category-breakdown {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);

      .breakdown-header {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .category-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
        font-size: 12px;

        .category-info {
          display: flex;
          align-items: center;
          gap: 6px;

          .category-icon {
            color: rgba(255, 255, 255, 0.8);
            flex-shrink: 0;
          }

          .category-name {
            color: rgba(255, 255, 255, 0.9);
            font-weight: 500;
          }
        }

        .category-progress {
          display: flex;
          gap: 4px;
          align-items: center;

          .progress-text {
            color: rgba(255, 255, 255, 0.8);
            font-family: monospace;
            font-size: 11px;
          }

          .progress-percent {
            color: rgba(255, 255, 255, 0.7);
            font-size: 10px;

            &.progress-complete {
              color: #4caf50;
              font-weight: 600;
            }
          }
        }
      }
    }
  }

  .field-set-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: $grey-8;
    margin: 0;
  }
}

.field-set-chips {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  min-height: 50px;
}

.active-field-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
  align-items: flex-start;
}

.inactive-field-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

.field-set-chip {
  border-radius: 20px;
  transition: all 0.3s ease;
  min-height: 36px;
  font-weight: 500;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &.active-chip {
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
    border: 2px solid rgba(25, 118, 210, 0.2);

    &:hover {
      box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
    }
  }

  &.inactive-chip {
    opacity: 0.8;

    &:hover {
      opacity: 1;
      transform: translateY(-1px) scale(1.02);
    }

    &.has-observations {
      opacity: 0.95;
      border: 1px solid rgba(25, 118, 210, 0.3) !important;

      &:hover {
        opacity: 1;
        border-color: rgba(25, 118, 210, 0.5) !important;
        box-shadow: 0 3px 10px rgba(25, 118, 210, 0.2);
      }
    }
  }
}

.more-categories-btn {
  margin-left: 0.25rem;
  opacity: 0.7;
  transition: all 0.3s ease;

  &:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
  }
}

.hidden-field-set-item {
  transition: background 0.2s ease;

  &:hover {
    background: rgba(25, 118, 210, 0.1);
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
}

@media (max-width: 768px) {
  .data-entry-view {
    padding: 1rem;
  }

  .visit-selector {
    flex-direction: column;
    align-items: stretch;

    .visit-select {
      max-width: none;
    }
  }

  .field-set-chips {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .active-field-sets,
  .inactive-field-sets {
    justify-content: flex-start;
  }

  .inactive-field-sets {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }
}
</style>
