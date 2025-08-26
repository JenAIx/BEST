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
import { AVAILABLE_FIELD_SETS } from 'src/shared/utils/medical-utils'
import ObservationFieldSet from './ObservationFieldSet.vue'
import NewVisitDialog from './NewVisitDialog.vue'
import FieldSetSelector from './FieldSetSelector.vue'
import FieldSetConfigDialog from './FieldSetConfigDialog.vue'

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

// Methods that need to be available for composables
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

// Use uncategorized observations composable
const { uncategorizedObservations, uncategorizedFieldSet } = useUncategorizedObservations(visitStore, availableFieldSets, selectedVisit)

// Use field set statistics composable
const { overallStats } = useFieldSetStatistics(availableFieldSets, activeFieldSets, getFieldSetObservationCount, uncategorizedObservations)

// Field set organization for better UX
const activeFieldSetsList = computed(() => {
  return availableFieldSets.value.filter((fs) => activeFieldSets.value.includes(fs.id))
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

    // Field sets loaded and ready for use
  } catch (error) {
    logger.error('Failed to load field sets from global settings', error)
    $q.notify({
      type: 'warning',
      message: 'Using default field sets. Some configurations may not be available.',
      position: 'top',
    })

    // Fallback to hardcoded field sets
    availableFieldSets.value = AVAILABLE_FIELD_SETS

    // Fallback field sets loaded
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

  // Field sets are now ready for use

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
    flex-direction: column;
    align-items: stretch;

    .visit-select {
      max-width: none;
    }
  }
}
</style>
