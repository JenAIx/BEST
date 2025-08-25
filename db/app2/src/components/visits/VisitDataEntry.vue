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
          <h4 class="field-set-title">Observation Categories</h4>
          <q-btn flat icon="settings" label="Configure" @click="showFieldSetConfig = true" size="sm" />
        </div>
        <div class="field-set-chips">
          <q-chip
            v-for="fieldSet in availableFieldSets"
            :key="fieldSet.id"
            :selected="activeFieldSets.includes(fieldSet.id)"
            @click="toggleFieldSet(fieldSet.id)"
            :color="activeFieldSets.includes(fieldSet.id) ? 'primary' : 'grey-4'"
            :text-color="activeFieldSets.includes(fieldSet.id) ? 'white' : 'grey-8'"
            clickable
            class="field-set-chip"
          >
            <q-icon :name="fieldSet.icon" class="q-mr-xs" />
            {{ fieldSet.name }}
            <q-badge
              v-if="getFieldSetObservationCount(fieldSet.id) > 0"
              :color="activeFieldSets.includes(fieldSet.id) ? 'white' : 'primary'"
              :text-color="activeFieldSets.includes(fieldSet.id) ? 'primary' : 'white'"
              class="q-ml-xs"
            >
              {{ getFieldSetObservationCount(fieldSet.id) }}
            </q-badge>
          </q-chip>
        </div>
      </div>

      <!-- Observation Forms -->
      <div v-if="selectedVisit && activeFieldSets.length > 0" class="observation-forms">
        <ObservationFieldSet
          v-for="fieldSetId in activeFieldSets.filter((id) => id != null)"
          :key="`${selectedVisit.id}-${fieldSetId}`"
          :field-set="getFieldSet(fieldSetId)"
          :visit="selectedVisit"
          :patient="patient"
          :previous-visits="previousVisits"
          :existing-observations="getFieldSetObservations(fieldSetId)"
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
import { AVAILABLE_FIELD_SETS, getFieldSetById } from 'src/shared/utils/medical-utils'
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
    availableFieldSets.value.forEach(fs => {
      fieldSetConfig.value[fs.id] = activeFieldSets.value.includes(fs.id)
    })
    
  } catch (error) {
            logger.error('Failed to load field sets from global settings', error)
    $q.notify({
      type: 'warning',
      message: 'Using default field sets. Some configurations may not be available.',
      position: 'top'
    })
    
    // Fallback to hardcoded field sets
    availableFieldSets.value = AVAILABLE_FIELD_SETS
    
    // Initialize field set config
    fieldSetConfig.value = {}
    availableFieldSets.value.forEach(fs => {
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

const getFieldSet = (fieldSetId) => {
  // First try to find in loaded field sets
  const fieldSet = availableFieldSets.value.find(fs => fs.id === fieldSetId)
  if (fieldSet) return fieldSet
  
  // Fallback to utility function
  return getFieldSetById(fieldSetId)
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
    availableFieldSets: availableFieldSets.value.map((fs) => fs.id)
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

  .field-set-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: $grey-8;
    margin: 0;
  }
}

.field-set-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.field-set-chip {
  border-radius: 20px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
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
    gap: 0.5rem;
  }
}
</style>
