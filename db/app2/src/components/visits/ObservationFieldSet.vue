<template>
  <div class="field-set-section">
    <div class="field-set-header cursor-pointer" @click="collapsed = !collapsed">
      <div class="field-set-title">
        <q-icon :name="fieldSet.icon" size="24px" class="q-mr-sm" />
        {{ fieldSet.name }}
        <q-badge v-if="collapsed && isUncategorized && observationCount > 0" :label="observationCount" color="grey-6" class="q-ml-sm observation-count-badge">
          <q-tooltip>{{ observationCount }} uncategorized observation{{ observationCount > 1 ? 's' : '' }}</q-tooltip>
        </q-badge>
      </div>
      <q-icon name="expand_more" size="20px" class="expand-icon" :class="{ 'rotate-180': !collapsed }">
        <q-tooltip>{{ collapsed ? 'Expand' : 'Collapse' }}</q-tooltip>
      </q-icon>
    </div>

    <q-slide-transition>
      <div v-show="!collapsed" class="field-set-content">
        <div class="observation-grid">
          <!-- Medication Fields - Render one field per observation, not per concept -->
          <MedicationField
            v-for="observation in medicationObservations"
            :key="`medication-${observation.observationId || observation.tempId}`"
            :concept="{ code: observation.conceptCode, name: 'Current Medication', valueType: 'M' }"
            :visit="visit"
            :patient="patient"
            :existing-observation="observation"
            :previous-value="getPreviousValue(observation.conceptCode)"
            @observation-updated="onObservationUpdated"
            @clone-requested="onCloneRequested"
          />

          <!-- Regular Observation Fields -->
          <ObservationField
            v-for="concept in fieldSetConcepts.filter((c) => c.valueType !== 'M')"
            :key="concept.code"
            :concept="concept"
            :visit="visit"
            :patient="patient"
            :existing-observation="getExistingObservation(concept.code)"
            :previous-value="getPreviousValue(concept.code)"
            @observation-updated="onObservationUpdated"
            @clone-requested="onCloneRequested"
          />
        </div>

        <!-- Add custom observation -->
        <div class="add-custom-observation">
          <q-btn
            flat
            icon="add"
            :label="props.fieldSet.id === 'medications' ? 'Add Medication' : 'Add Custom Observation'"
            @click="props.fieldSet.id === 'medications' ? addEmptyMedication() : (showAddCustomDialog = true)"
            class="full-width"
            style="border: 2px dashed #ccc"
          />
        </div>
      </div>
    </q-slide-transition>

    <!-- Custom Observation Dialog Component -->
    <CustomObservationDialog
      v-model="showAddCustomDialog"
      :visit="visit"
      :patient="patient"
      :field-set-name="fieldSet.name"
      :field-set-id="fieldSet.id"
      @observation-added="onCustomObservationAdded"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import ObservationField from './ObservationField.vue'
import MedicationField from './MedicationField.vue'
import CustomObservationDialog from './CustomObservationDialog.vue'

const props = defineProps({
  fieldSet: {
    type: Object,
    required: true,
  },
  visit: {
    type: Object,
    required: true,
  },
  patient: {
    type: Object,
    required: true,
  },
  previousVisits: {
    type: Array,
    default: () => [],
  },
  existingObservations: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['observation-updated', 'clone-from-previous'])

const $q = useQuasar()
const visitStore = useVisitObservationStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('ObservationFieldSet')

// State
const collapsed = ref(false)
const showAddCustomDialog = ref(false)
const removedConcepts = ref(new Set()) // Track concepts removed by user

// Component mounted
onMounted(async () => {
  logger.info('ObservationFieldSet mounted', {
    fieldSetId: props.fieldSet?.id,
    fieldSetName: props.fieldSet?.name,
    visitId: props.visit?.id,
    patientId: props.patient?.id,
    existingObservationsCount: props.existingObservations?.length || 0,
    fieldSetConceptsCount: props.fieldSet?.concepts?.length || 0,
    fieldSetConcepts: props.fieldSet?.concepts,
  })
})

// Computed
const fieldSetConcepts = computed(() => {
  // Convert field set concepts to detailed concept objects, filtering out removed ones
  return (
    props.fieldSet.concepts
      ?.filter((conceptCode) => !removedConcepts.value.has(conceptCode)) // Filter out removed concepts
      ?.map((conceptCode) => {
        const [system, code] = conceptCode.split(':')
        return {
          code: conceptCode,
          system,
          localCode: code,
          name: getConceptName(conceptCode),
          valueType: getConceptValueType(conceptCode),
          unit: getConceptUnit(conceptCode),
        }
      }) || []
  )
})

const isUncategorized = computed(() => {
  return props.fieldSet.id === 'uncategorized'
})

const observationCount = computed(() => {
  return props.existingObservations?.length || 0
})

// Medication observations - for medications, we render one field per observation (not per concept)
const medicationObservations = computed(() => {
  if (props.fieldSet.id !== 'medications') return []

  logger.debug('Computing medication observations', {
    fieldSetId: props.fieldSet.id,
    existingObservationsCount: props.existingObservations?.length || 0,
    existingObservations: props.existingObservations,
  })

  // Get all medication observations (both empty and filled)
  const medObservations = props.existingObservations?.filter((obs) => obs.conceptCode === 'LID: 52418-1' || obs.valTypeCode === 'M' || (obs.conceptCode && obs.conceptCode.includes('52418'))) || []

  logger.debug('Filtered medication observations', {
    medicationObservationsCount: medObservations.length,
    medicationObservations: medObservations,
  })

  return medObservations
})

// Methods
const getConceptName = (conceptCode) => {
  // Map common concept codes to human-readable names
  const conceptNames = {
    'LOINC:8480-6': 'Systolic Blood Pressure',
    'LOINC:8462-4': 'Diastolic Blood Pressure',
    'LOINC:8867-4': 'Heart Rate',
    'LOINC:8310-5': 'Body Temperature',
    'LOINC:9279-1': 'Respiratory Rate',
    'LOINC:2708-6': 'Oxygen Saturation',
    'SNOMED:25064002': 'Headache',
    'SNOMED:49727002': 'Cough',
    'SNOMED:267036007': 'Shortness of Breath',
    'SNOMED:21522001': 'Abdominal Pain',
    'SNOMED:386661006': 'Fever',
    'SNOMED:84229001': 'Fatigue',
    'SNOMED:5880005': 'Physical Examination',
    'SNOMED:32750006': 'Inspection',
    'SNOMED:113011001': 'Palpation',
    'SNOMED:37931006': 'Auscultation',
    'SNOMED:113006009': 'Percussion',
    // Medication concepts
    'LID: 52418-1': 'Current Medication',
    'SNOMED:182836005': 'Medication Review',
    'SNOMED:432102000': 'Drug Administration',
    'SNOMED:182840001': 'Medication Discontinued',
    'MED:PRESCRIPTION': 'New Prescription',
    'MED:CURRENT': 'Current Medication',
    'MED:ANALGESIC': 'Pain Medication',
    'MED:ANTIBIOTIC': 'Antibiotic',
    'MED:CARDIOVASCULAR': 'Heart Medication',
  }

  return conceptNames[conceptCode] || conceptCode.split(':')[1]
}

const getConceptValueType = (conceptCode) => {
  // Simple fallback logic for new concepts (existing observations will use their stored VALTYPE_CD)
  const numericConcepts = ['LOINC:8480-6', 'LOINC:8462-4', 'LOINC:8867-4', 'LOINC:8310-5', 'LOINC:9279-1', 'LOINC:2708-6']

  // Medication concepts use the new 'M' type
  const medicationConcepts = [
    'LID: 52418-1', // Current medication, Name
    'SNOMED:182836005', // Review of medication
    'SNOMED:432102000', // Administration of substance
    'SNOMED:182840001', // Drug treatment stopped
    'MED:PRESCRIPTION', // New prescription entry
    'MED:CURRENT', // Current medication review
    'MED:ANALGESIC', // Pain medication
    'MED:ANTIBIOTIC', // Antibiotic prescription
    'MED:CARDIOVASCULAR', // Heart medication
  ]

  if (numericConcepts.includes(conceptCode)) return 'N'
  if (medicationConcepts.includes(conceptCode)) return 'M'

  return 'T'
}

const getConceptUnit = (conceptCode) => {
  const conceptUnits = {
    'LOINC:8480-6': 'mmHg',
    'LOINC:8462-4': 'mmHg',
    'LOINC:8867-4': 'bpm',
    'LOINC:8310-5': '°C',
    'LOINC:9279-1': '/min',
    'LOINC:2708-6': '%',
  }

  return conceptUnits[conceptCode] || ''
}

const getExistingObservation = (conceptCode) => {
  logger.debug('getExistingObservation called', { conceptCode, observationCount: props.existingObservations?.length || 0 })

  return props.existingObservations.find((obs) => {
    // Try multiple matching strategies:
    // 1. Exact match
    if (obs.conceptCode === conceptCode) return true

    // 2. Extract numeric codes and compare (e.g., "LOINC:8462-4" vs "LID: 8462-4")
    const conceptMatch = conceptCode.match(/[:\s]([0-9-]+)$/)
    const obsMatch = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
    if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) {
      logger.debug('Matched by numeric code', { conceptCode, matchedCode: obs.conceptCode })
      return true
    }

    // 3. Full concept code includes the database concept code
    if (conceptCode.includes(obs.conceptCode)) return true

    // 4. Database concept code includes the full concept
    if (obs.conceptCode.includes(conceptCode)) return true

    // 5. Match just the code part (after the colon)
    const [, code] = conceptCode.split(':')
    if (code && obs.conceptCode.includes(code)) return true

    // 6. Case-insensitive match
    if (obs.conceptCode.toLowerCase().includes(conceptCode.toLowerCase())) return true

    return false
  })
}

const getPreviousValue = (conceptCode) => {
  // Get the most recent value from previous visits
  if (!props.previousVisits.length) return null

  // Look through previous visits for this concept
  // This is a placeholder implementation - in a real scenario, we would
  // need to load and cache observation data for previous visits

  // For now, we acknowledge the conceptCode parameter to satisfy ESLint
  // and return null since the actual previous value lookup is handled
  // by the clone functionality in the parent components
  logger.debug('Looking for previous value for concept', { conceptCode })

  return null
}

const onObservationUpdated = (data) => {
  // Handle removal of empty medication fields
  if (data.remove && data.conceptCode) {
    removedConcepts.value.add(data.conceptCode)
    logger.info('Concept removed from UI', {
      conceptCode: data.conceptCode,
      fieldSetId: props.fieldSet.id,
    })
  }

  emit('observation-updated', data)
}

const onCloneRequested = (data) => {
  emit('clone-from-previous', data)
}

// Method to restore a removed concept (if needed for "undo" functionality)
// Currently unused - for future implementation
// const restoreRemovedConcept = (conceptCode) => {
//   removedConcepts.value.delete(conceptCode)
//   logger.info('Concept restored to UI', {
//     conceptCode,
//     fieldSetId: props.fieldSet.id,
//   })
// }

const addEmptyMedication = async () => {
  try {
    // Get default values from global settings
    const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('VISITS_PAGE')
    const defaultCategory = 'Medications' // Use the field set name as category

    // Create empty medication observation with LID: 52418-1
    const observationData = {
      ENCOUNTER_NUM: props.visit.id,
      CONCEPT_CD: 'LID: 52418-1', // Use the specific medication concept
      VALTYPE_CD: 'M', // Medication type
      TVAL_CHAR: '', // Empty drug name initially
      NVAL_NUM: null, // No dosage initially
      UNIT_CD: null, // No unit initially
      OBSERVATION_BLOB: null, // No complex data initially
      START_DATE: new Date().toISOString().split('T')[0],
      CATEGORY_CHAR: defaultCategory,
      PROVIDER_ID: 'SYSTEM',
      LOCATION_CD: 'VISITS_PAGE',
      SOURCESYSTEM_CD: defaultSourceSystem,
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }

    // Use visit store to create observation - it handles patient lookup and state updates
    await visitStore.createObservation(observationData)

    // Emit update to refresh the field set
    emit('observation-updated', {
      conceptCode: 'LID: 52418-1',
      value: '',
      added: true,
    })

    logger.info('Empty medication added successfully', {
      conceptCode: 'LID: 52418-1',
      patientId: props.patient.id,
      visitId: props.visit.id,
    })

    $q.notify({
      type: 'positive',
      message: 'Empty medication slot added',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to add empty medication', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to add medication',
      position: 'top',
    })
  }
}

const onCustomObservationAdded = (data) => {
  logger.info('Custom observation added', {
    conceptCode: data.conceptCode,
    value: data.value,
    unit: data.unit,
    fieldSetId: props.fieldSet.id,
  })

  // Emit the observation update to parent
  emit('observation-updated', data)
}
</script>

<style lang="scss" scoped>
.field-set-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.field-set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: $grey-1;
  border-bottom: 1px solid $grey-3;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: $grey-2;

    .expand-icon {
      color: $primary;
      transform: scale(1.1);
    }
  }

  .field-set-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: $grey-8;
    display: flex;
    align-items: center;

    .observation-count-badge {
      font-size: 0.75rem;
      font-weight: 500;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
    }
  }

  .expand-icon {
    color: $grey-6;
    transition: all 0.3s ease;
  }
}

.field-set-content {
  padding: 1.5rem;
}

.observation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;

  // For medication fields with col-12 class, make them span full width
  :deep(.medication-field.col-12) {
    grid-column: 1 / -1;
  }
}

.add-custom-observation {
  margin-top: 1rem;

  .q-btn {
    color: $grey-6;
    transition: all 0.3s ease;

    &:hover {
      color: $primary;
      border-color: $primary;
    }
  }
}

.expand-icon.rotate-180 {
  transform: rotate(180deg);
}

@media (max-width: 768px) {
  .field-set-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .observation-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
