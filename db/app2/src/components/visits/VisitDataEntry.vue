<template>
  <div class="data-entry-view">
    <div class="entry-container">
      <!-- Template Status (when template is selected) -->
      <div v-if="selectedTemplate" class="template-status q-mb-md">
        <q-card flat bordered class="selected-template-card">
          <q-card-section class="row items-center no-wrap">
            <q-icon :name="selectedTemplate.icon || 'assignment'" :color="selectedTemplate.color || 'primary'" size="24px" class="q-mr-sm" />
            <div class="template-info">
              <div class="text-body1"><strong>{{ selectedTemplate.name }}</strong> template applied</div>
              <div class="text-caption text-grey-6">{{ getTemplateFieldSets(selectedTemplate).length }} categories activated</div>
            </div>
            <q-space />
            <q-btn 
              flat 
              round 
              icon="refresh" 
              color="primary" 
              @click="resetTemplate" 
              size="sm"
            >
              <q-tooltip>Change template</q-tooltip>
            </q-btn>
          </q-card-section>
        </q-card>
      </div>

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
        <q-btn color="secondary" icon="assignment_turned_in" label="Template" @click="openTemplateSelector" class="q-ml-sm" />
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

    <!-- Visit Template Selector Dialog -->
    <VisitTemplateSelector ref="templateSelectorRef" @template-selected="onTemplateSelected" />
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
import { getTemplateFieldSets } from 'src/shared/utils/template-utils'
import ObservationFieldSet from './ObservationFieldSet.vue'
import NewVisitDialog from './NewVisitDialog.vue'
import FieldSetSelector from './FieldSetSelector.vue'
import FieldSetConfigDialog from './FieldSetConfigDialog.vue'
import VisitTemplateSelector from './VisitTemplateSelector.vue'

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

// Templates Configuration
const selectedTemplate = ref(null)
const templateSelectorRef = ref(null)

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

const openTemplateSelector = () => {
  if (templateSelectorRef.value) {
    templateSelectorRef.value.openDialog()
  }
}

const onTemplateSelected = (template) => {
  try {
    logger.info('Template selected from dialog', { templateId: template.id, templateName: template.name })
    
    selectedTemplate.value = template
    
    // Apply template field sets based on template type
    const templateFieldSets = getTemplateFieldSets(template)
    activeFieldSets.value = [...templateFieldSets]
    
    // Save template selection to local settings
    localSettings.setSetting('visits.activeFieldSets', activeFieldSets.value)
    
    logger.success('Template applied successfully', { 
      templateId: template.id,
      fieldSets: templateFieldSets 
    })
    
  } catch (error) {
    logger.error('Failed to apply template', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to apply template',
      position: 'top',
    })
  }
}

// getTemplateFieldSets is now imported from shared utils

const resetTemplate = () => {
  selectedTemplate.value = null
  
  // Reset to default field sets
  activeFieldSets.value = ['vitals', 'symptoms']
  localSettings.setSetting('visits.activeFieldSets', activeFieldSets.value)
  localSettings.setSetting('visits.lastUsedTemplate', null)
  
  logger.info('Template selection reset')
  
  $q.notify({
    type: 'info',
    message: 'Template cleared, using default categories',
    position: 'top',
  })
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

  // Check for saved template preference and restore template state
  const lastUsedTemplate = localSettings.getSetting('visits.lastUsedTemplate')
  if (lastUsedTemplate) {
    try {
      const templates = await globalSettingsStore.getVisitTemplateOptions()
      const template = templates.find(t => t.id === lastUsedTemplate)
      if (template) {
        logger.debug('Restoring last used template', { templateId: lastUsedTemplate })
        selectedTemplate.value = template
        const templateFieldSets = getTemplateFieldSets(template)
        activeFieldSets.value = [...templateFieldSets]
      }
    } catch (error) {
      logger.warn('Failed to restore template, using saved field sets', error)
    }
  }
  
  // Load saved field set settings if no template was restored
  if (!selectedTemplate.value) {
    const savedActiveFieldSets = localSettings.getSetting('visits.activeFieldSets')
    if (savedActiveFieldSets) {
      logger.debug('Loading saved active field sets', { savedActiveFieldSets })
      activeFieldSets.value = savedActiveFieldSets
    }
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

// Template Status Styles
.template-status {
  animation: slideInDown 0.3s ease-out;
}

.selected-template-card {
  background: linear-gradient(135deg, rgba($primary, 0.05) 0%, rgba($primary, 0.02) 100%);
  border: 1px solid rgba($primary, 0.2);
  border-radius: 12px;
}

// Animation for template appearance
@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
