<template>
  <div class="field-set-section">
    <div class="field-set-header">
      <div class="field-set-title">
        <q-icon :name="fieldSet.icon" size="24px" class="q-mr-sm" />
        {{ fieldSet.name }}
      </div>
      <div class="field-set-actions">
        <q-btn flat icon="content_copy" label="Clone from Previous" size="sm" @click="showCloneDialog = true" :disable="previousVisits.length === 0">
          <q-tooltip>Copy values from a previous visit</q-tooltip>
        </q-btn>
        <q-btn flat icon="expand_more" size="sm" @click="collapsed = !collapsed" :class="{ 'rotate-180': !collapsed }">
          <q-tooltip>{{ collapsed ? 'Expand' : 'Collapse' }}</q-tooltip>
        </q-btn>
      </div>
    </div>

    <q-slide-transition>
      <div v-show="!collapsed" class="field-set-content">
        <div class="observation-grid">
          <ObservationField
            v-for="concept in fieldSetConcepts"
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
          <q-btn flat icon="add" label="Add Custom Observation" @click="showAddCustomDialog = true" class="full-width" style="border: 2px dashed #ccc" />
        </div>
      </div>
    </q-slide-transition>

    <!-- Clone from Previous Dialog -->
    <q-dialog v-model="showCloneDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Clone from Previous Visit</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-select v-model="selectedPreviousVisit" :options="previousVisitOptions" option-label="label" option-value="value" label="Select Previous Visit" outlined />

          <div v-if="selectedPreviousVisit" class="q-mt-md">
            <div class="text-subtitle2 q-mb-sm">Available observations:</div>
            <q-list bordered>
              <q-item v-for="obs in previousVisitObservations" :key="obs.conceptCode" clickable @click="cloneObservation(obs)">
                <q-item-section>
                  <q-item-label>{{ obs.conceptName }}</q-item-label>
                  <q-item-label caption>{{ obs.value }} {{ obs.unit }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="content_copy" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" @click="showCloneDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Add Custom Observation Dialog -->
    <q-dialog v-model="showAddCustomDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add Custom Observation</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-form class="q-gutter-md">
            <q-input v-model="customObservation.name" label="Observation Name" outlined :rules="[(val) => !!val || 'Name is required']" />
            <q-select v-model="customObservation.valueType" :options="valueTypeOptions" label="Value Type" outlined emit-value map-options />
            <q-input
              v-model="customObservation.value"
              :label="customObservation.valueType === 'N' ? 'Numeric Value' : 'Text Value'"
              :type="customObservation.valueType === 'N' ? 'number' : 'text'"
              outlined
            />
            <q-input v-model="customObservation.unit" label="Unit (optional)" outlined />
          </q-form>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="cancelCustomObservation" />
          <q-btn color="primary" label="Add" @click="saveCustomObservation" :disable="!customObservation.name || !customObservation.value" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import ObservationField from './ObservationField.vue'

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
const dbStore = useDatabaseStore()

// State
const collapsed = ref(false)
const showCloneDialog = ref(false)
const showAddCustomDialog = ref(false)
const selectedPreviousVisit = ref(null)
const previousVisitObservations = ref([])

const customObservation = ref({
  name: '',
  valueType: 'T',
  value: '',
  unit: '',
})

const valueTypeOptions = [
  { label: 'Text', value: 'T' },
  { label: 'Numeric', value: 'N' },
  { label: 'Date', value: 'D' },
]

// Computed
const fieldSetConcepts = computed(() => {
  // Convert field set concepts to detailed concept objects
  return (
    props.fieldSet.concepts?.map((conceptCode) => {
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

const previousVisitOptions = computed(() => {
  return props.previousVisits.map((visit) => ({
    label: formatVisitDate(visit.date),
    value: visit,
    summary: `${visit.type} • ${visit.observationCount} observations`,
  }))
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
  }

  return conceptNames[conceptCode] || conceptCode.split(':')[1]
}

const getConceptValueType = (conceptCode) => {
  // Determine value type based on concept
  const numericConcepts = ['LOINC:8480-6', 'LOINC:8462-4', 'LOINC:8867-4', 'LOINC:8310-5', 'LOINC:9279-1', 'LOINC:2708-6']

  return numericConcepts.includes(conceptCode) ? 'N' : 'T'
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
  console.log('getExistingObservation called with:', conceptCode)
  console.log('Available observations:', props.existingObservations)

  return props.existingObservations.find((obs) => {
    // Try multiple matching strategies:
    // 1. Exact match
    if (obs.conceptCode === conceptCode) return true

    // 2. Extract numeric codes and compare (e.g., "LOINC:8462-4" vs "LID: 8462-4")
    const conceptMatch = conceptCode.match(/[:\s]([0-9-]+)$/)
    const obsMatch = obs.conceptCode.match(/[:\s]([0-9-]+)$/)
    if (conceptMatch && obsMatch && conceptMatch[1] === obsMatch[1]) {
      console.log('Matched by numeric code:', conceptCode, 'with', obs.conceptCode)
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
  console.debug(`Looking for previous value for concept: ${conceptCode}`)

  return null
}

const loadPreviousVisitObservations = async () => {
  if (!selectedPreviousVisit.value?.id) {
    previousVisitObservations.value = []
    return
  }

  try {
    const query = `
            SELECT 
                CONCEPT_CD,
                CONCEPT_NAME_CHAR as CONCEPT_NAME,
                VALTYPE_CD,
                TVAL_CHAR,
                NVAL_NUM,
                UNIT_CD,
                TVAL_RESOLVED
            FROM patient_observations
            WHERE ENCOUNTER_NUM = ?
            ORDER BY CONCEPT_NAME_CHAR
        `

    const result = await dbStore.executeQuery(query, [selectedPreviousVisit.value.id])

    if (result.success) {
      previousVisitObservations.value = result.data.map((obs) => ({
        conceptCode: obs.CONCEPT_CD,
        conceptName: obs.CONCEPT_NAME,
        valueType: obs.VALTYPE_CD,
        value: obs.TVAL_RESOLVED || obs.TVAL_CHAR || obs.NVAL_NUM,
        unit: obs.UNIT_CD,
      }))
    }
  } catch (error) {
    console.error('Failed to load previous visit observations:', error)
  }
}

const cloneObservation = (observation) => {
  emit('clone-from-previous', {
    conceptCode: observation.conceptCode,
    previousVisitId: selectedPreviousVisit.value.id,
    value: observation.value,
    unit: observation.unit,
  })

  showCloneDialog.value = false
}

const onObservationUpdated = (data) => {
  emit('observation-updated', data)
}

const onCloneRequested = (data) => {
  emit('clone-from-previous', data)
}

const saveCustomObservation = async () => {
  try {
    const patientRepo = dbStore.getRepository('patient')
    const patient = await patientRepo.findByPatientCode(props.patient.id)

    const observationRepo = dbStore.getRepository('observation')

    // Generate a custom concept code
    const customConceptCode = `CUSTOM:${Date.now()}`

    const observationData = {
      PATIENT_NUM: patient.PATIENT_NUM,
      ENCOUNTER_NUM: props.visit.id,
      CONCEPT_CD: customConceptCode,
      VALTYPE_CD: customObservation.value.valueType,
      START_DATE: new Date().toISOString().split('T')[0],
      CATEGORY_CHAR: props.fieldSet.name.toUpperCase(),
      PROVIDER_ID: 'SYSTEM',
      LOCATION_CD: 'CUSTOM',
      SOURCESYSTEM_CD: 'VISITS_PAGE',
      INSTANCE_NUM: 1,
      UPLOAD_ID: 1,
    }

    if (customObservation.value.valueType === 'N') {
      observationData.NVAL_NUM = parseFloat(customObservation.value.value)
    } else {
      observationData.TVAL_CHAR = customObservation.value.value
    }

    if (customObservation.value.unit) {
      observationData.UNIT_CD = customObservation.value.unit
    }

    await observationRepo.createObservation(observationData)

    emit('observation-updated', {
      conceptCode: customConceptCode,
      value: customObservation.value.value,
      unit: customObservation.value.unit,
    })

    cancelCustomObservation()

    $q.notify({
      type: 'positive',
      message: 'Custom observation added',
      position: 'top',
    })
  } catch (error) {
    console.error('Failed to save custom observation:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save custom observation',
      position: 'top',
    })
  }
}

const cancelCustomObservation = () => {
  customObservation.value = {
    name: '',
    valueType: 'T',
    value: '',
    unit: '',
  }
  showAddCustomDialog.value = false
}

const formatVisitDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Watchers
watch(selectedPreviousVisit, async (newVisit) => {
  if (newVisit) {
    await loadPreviousVisitObservations()
  }
})
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

  .field-set-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: $grey-8;
    display: flex;
    align-items: center;
  }

  .field-set-actions {
    display: flex;
    gap: 0.5rem;
  }
}

.field-set-content {
  padding: 1.5rem;
}

.observation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
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

.rotate-180 {
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
