<template>
  <AppDialog v-model="dialogModel" title="Edit Medication" subtitle="Update medication details" size="lg" :persistent="hasChanges" :show-actions="false" :show-close="!saving">
    <div class="medication-edit-dialog">
      <!-- Drug Name Search -->
      <div class="drug-search">
        <q-select
          v-model="localMedicationData.drugName"
          :options="drugOptions"
          option-label="name"
          option-value="name"
          label="Drug Name *"
          outlined
          dense
          use-input
          input-debounce="300"
          @filter="filterDrugs"
          @update:model-value="onDrugChange"
          :loading="searchingDrugs"
          clearable
          :disable="saving"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.name }}</q-item-label>
                <q-item-label caption v-if="scope.opt.generic">{{ scope.opt.generic }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge v-if="scope.opt.default_strength" color="primary" outline>{{ scope.opt.default_strength }}</q-badge>
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>

      <!-- Dosage, Unit, Route, and Frequency Row -->
      <div class="medication-details-row">
        <!-- Dosage Amount -->
        <div class="dosage-input">
          <q-input
            v-model.number="localMedicationData.dosage"
            type="number"
            label="Dosage"
            placeholder="Amount"
            outlined
            dense
            @update:model-value="onMedicationChange"
            :loading="saving"
            :disable="saving"
          >
            <template v-slot:prepend>
              <q-icon name="straighten" />
            </template>
          </q-input>
        </div>

        <!-- Dosage Unit -->
        <div class="unit-select">
          <q-select v-model="localMedicationData.dosageUnit" :options="dosageUnits" label="Unit" outlined dense @update:model-value="onMedicationChange" :disable="saving" />
        </div>

        <!-- Route -->
        <div class="route-select">
          <q-select
            v-model="localMedicationData.route"
            :options="routeOptions"
            option-label="label"
            option-value="value"
            label="Route"
            outlined
            dense
            @update:model-value="onMedicationChange"
            :disable="saving"
          >
            <template v-slot:prepend>
              <q-icon name="route" />
            </template>
          </q-select>
        </div>

        <!-- Frequency -->
        <div class="frequency-select">
          <q-select
            v-model="localMedicationData.frequency"
            :options="frequencyOptions"
            option-label="label"
            option-value="value"
            label="Frequency"
            outlined
            dense
            @update:model-value="onMedicationChange"
            :disable="saving"
          >
            <template v-slot:prepend>
              <q-icon name="schedule" />
            </template>
          </q-select>
        </div>
      </div>

      <!-- Special Instructions -->
      <div class="instructions">
        <q-input
          v-model="localMedicationData.instructions"
          label="Special Instructions"
          outlined
          dense
          type="textarea"
          rows="2"
          placeholder="e.g., Take with food, avoid alcohol..."
          @update:model-value="onMedicationChange"
          :disable="saving"
        >
          <template v-slot:prepend>
            <q-icon name="notes" />
          </template>
        </q-input>
      </div>

      <!-- Preview -->
      <div v-if="medicationPreview" class="medication-preview">
        <q-separator class="q-my-md" />
        <div class="preview-label text-caption text-grey-6 q-mb-xs">Preview:</div>
        <div class="preview-content">
          <q-icon name="medication" size="16px" color="primary" class="q-mr-xs" />
          <strong>{{ medicationPreview }}</strong>
        </div>
      </div>

      <!-- Dialog Actions -->
      <div class="dialog-actions">
        <q-separator class="q-my-md" />
        <div class="row justify-end q-gutter-sm">
          <q-btn unelevated label="Save Medication" color="primary" @click="onSave" :loading="saving" :disable="!hasValidData" icon="save" />
        </div>
      </div>
    </div>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useMedicationsStore } from 'src/stores/medications-store'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppDialog from 'src/components/shared/AppDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  medicationData: {
    type: Object,
    required: true,
  },
  observationId: {
    type: Number,
    default: null,
  },
  frequencyOptions: {
    type: Array,
    required: true,
  },
  routeOptions: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const $q = useQuasar()
const medicationsStore = useMedicationsStore()
const visitStore = useVisitObservationStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('MedicationEditDialog')

// Dialog model
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// State
const localMedicationData = ref({ ...props.medicationData })
const originalMedicationData = ref({ ...props.medicationData })
const drugOptions = ref([])
const searchingDrugs = ref(false)
const saving = ref(false)

// Options
const dosageUnits = ['mg', 'g', 'mcg', 'IU', 'ml', 'L', 'units', 'drops', 'sprays', 'patches']

// Computed
const hasValidData = computed(() => {
  return !!(localMedicationData.value.drugName && localMedicationData.value.drugName.trim())
})

const hasChanges = computed(() => {
  return JSON.stringify(localMedicationData.value) !== JSON.stringify(originalMedicationData.value)
})

const medicationPreview = ref('')

// Update preview when medication data changes
const updateMedicationPreview = async () => {
  if (!hasValidData.value) {
    medicationPreview.value = ''
    return
  }

  const parts = []

  // Drug name
  if (localMedicationData.value.drugName) {
    parts.push(localMedicationData.value.drugName)
  }

  // Dosage with unit: "100mg"
  if (localMedicationData.value.dosage && localMedicationData.value.dosageUnit) {
    parts.push(`${localMedicationData.value.dosage}${localMedicationData.value.dosageUnit}`)
  }

  // Frequency in simplified format
  if (localMedicationData.value.frequency) {
    const freq = await getSimplifiedFrequency(localMedicationData.value.frequency)
    parts.push(freq)
  }

  // Route abbreviation
  if (localMedicationData.value.route) {
    const route = await getRouteAbbreviation(localMedicationData.value.route)
    parts.push(route)
  }

  medicationPreview.value = parts.join(' ')
}

// Helper methods for preview
const getSimplifiedFrequency = async (frequency) => {
  // Handle both string values and objects from q-select
  const frequencyValue = typeof frequency === 'object' ? frequency?.value : frequency

  if (!frequencyValue) return ''

  try {
    return await medicationsStore.getSimplifiedFrequency(frequencyValue)
  } catch (error) {
    logger.warn('Failed to get simplified frequency', { frequency: frequencyValue, error })
    return frequencyValue
  }
}

const getRouteAbbreviation = async (route) => {
  // Handle both string values and objects from q-select
  const routeValue = typeof route === 'object' ? route?.value : route

  if (!routeValue) return ''

  try {
    return await medicationsStore.getRouteAbbreviation(routeValue)
  } catch (error) {
    logger.warn('Failed to get route abbreviation', { route: routeValue, error })
    return typeof routeValue === 'string' ? routeValue.toLowerCase() : String(routeValue).toLowerCase()
  }
}

// Methods
const filterDrugs = async (searchTerm, doneFn) => {
  if (!searchTerm || searchTerm.length < 2) {
    doneFn(() => {
      drugOptions.value = []
    })
    return
  }

  searchingDrugs.value = true

  try {
    // Use medications store for drug search
    const drugs = await medicationsStore.getDrugOptions(searchTerm)

    doneFn(() => {
      drugOptions.value = drugs
    })
  } catch (error) {
    logger.error('Failed to search drugs', error)
    doneFn(() => {
      drugOptions.value = []
    })
  } finally {
    searchingDrugs.value = false
  }
}

const parseDosageFromStrength = (strength) => {
  if (!strength || typeof strength !== 'string') {
    return { dosage: null, unit: '' }
  }

  // Remove any spaces and convert to lowercase for consistent parsing
  const cleanStrength = strength.replace(/\s+/g, '').toLowerCase()

  // Handle special cases like "25-100mg" - take the first number
  if (cleanStrength.includes('-')) {
    const firstPart = cleanStrength.split('-')[0]
    return parseDosageFromStrength(firstPart + cleanStrength.replace(/[\d.-]/g, ''))
  }

  // Regular expression to match dosage and unit
  const dosageRegex = /^(\d+(?:\.\d+)?)([a-zA-Z]+(?:\/[a-zA-Z]+)?)$/
  const match = cleanStrength.match(dosageRegex)

  if (match) {
    const dosage = parseFloat(match[1])
    let unit = match[2]

    // Normalize common unit variations
    const unitMappings = {
      iu: 'IU',
      units: 'units',
      mcg: 'mcg',
      ug: 'mcg',
      g: 'g',
      mg: 'mg',
      ml: 'ml',
      l: 'L',
      'u/ml': 'U/mL',
      'units/ml': 'U/mL',
      'iu/ml': 'IU/mL',
    }

    unit = unitMappings[unit] || unit
    return { dosage, unit }
  }

  // If no match, try to extract just the numeric part
  const numericRegex = /^(\d+(?:\.\d+)?)/
  const numericMatch = cleanStrength.match(numericRegex)

  if (numericMatch) {
    const dosage = parseFloat(numericMatch[1])
    return { dosage, unit: 'mg' }
  }

  return { dosage: null, unit: '' }
}

const onDrugChange = (selectedDrug) => {
  if (selectedDrug && typeof selectedDrug === 'object') {
    // Set drug name
    localMedicationData.value.drugName = selectedDrug.name

    // Set route
    if (selectedDrug.default_route) {
      localMedicationData.value.route = selectedDrug.default_route
    }

    // Set frequency
    if (selectedDrug.default_frequency) {
      localMedicationData.value.frequency = selectedDrug.default_frequency
    }

    // Set dosage and unit from strength
    if (selectedDrug.default_strength) {
      const { dosage, unit } = parseDosageFromStrength(selectedDrug.default_strength)
      if (dosage !== null) {
        localMedicationData.value.dosage = dosage
      }
      if (unit) {
        localMedicationData.value.dosageUnit = unit
      }
    }
  }

  onMedicationChange()
}

const onMedicationChange = () => {
  logger.debug('Medication data changed', { localMedicationData: localMedicationData.value })
  updateMedicationPreview()
}

const onSave = async () => {
  if (!hasValidData.value) {
    $q.notify({
      type: 'warning',
      message: 'Please enter at least a drug name',
      position: 'top',
    })
    return
  }

  try {
    saving.value = true

    logger.debug('Saving medication data', { localMedicationData: localMedicationData.value })

    emit('save', localMedicationData.value)

    $q.notify({
      type: 'positive',
      message: 'Medication updated successfully',
      position: 'top',
    })

    dialogModel.value = false
  } catch (error) {
    logger.error('Failed to save medication', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save medication',
      position: 'top',
    })
  } finally {
    saving.value = false
  }
}

// Watch for prop changes
watch(
  () => props.medicationData,
  (newData) => {
    localMedicationData.value = { ...newData }
    originalMedicationData.value = { ...newData }
  },
  { deep: true, immediate: true },
)

// Load BLOB data when dialog opens
const loadMedicationBlobData = async () => {
  if (!props.observationId) {
    logger.debug('No observation ID provided, using basic medication data')
    return
  }

  try {
    logger.debug('Loading BLOB data for medication edit', { observationId: props.observationId })
    const blobData = await visitStore.getBlob(props.observationId)

    if (blobData) {
      try {
        const parsedData = JSON.parse(blobData)
        logger.debug('Successfully parsed BLOB data for edit dialog', { parsedData })

        // Update the medication data with BLOB values
        localMedicationData.value = {
          ...localMedicationData.value,
          drugName: parsedData.drugName || localMedicationData.value.drugName || '',
          dosage: parsedData.dosage || localMedicationData.value.dosage || null,
          dosageUnit: parsedData.dosageUnit || localMedicationData.value.dosageUnit || 'mg',
          frequency: parsedData.frequency || localMedicationData.value.frequency || '',
          route: parsedData.route || localMedicationData.value.route || '',
          instructions: parsedData.instructions || localMedicationData.value.instructions || '',
        }

        // Update original data as well
        originalMedicationData.value = { ...localMedicationData.value }

        logger.debug('Updated medication data with BLOB values', {
          localMedicationData: localMedicationData.value,
        })
      } catch (parseError) {
        logger.warn('Failed to parse BLOB data for edit dialog', parseError)
      }
    } else {
      logger.debug('No BLOB data found for observation', { observationId: props.observationId })
    }
  } catch (error) {
    logger.error('Failed to load BLOB data for medication edit', error)
  }
}

// Reset data when dialog opens
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      localMedicationData.value = { ...props.medicationData }
      originalMedicationData.value = { ...props.medicationData }
      saving.value = false

      // Load BLOB data to get complete medication information
      await loadMedicationBlobData()

      // Update preview after loading BLOB data
      await updateMedicationPreview()
    }
  },
)
</script>

<style lang="scss" scoped>
.medication-edit-dialog {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 400px;
}

.drug-search {
  width: 100%;
}

.medication-details-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1.5fr 1.5fr;
  gap: 1rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
}

.instructions {
  width: 100%;
}

.medication-preview {
  .preview-content {
    display: flex;
    align-items: center;
    padding: 12px;
    background: rgba($primary, 0.05);
    border-radius: 8px;
    border-left: 3px solid $primary;
    font-size: 1.1rem;
  }
}

.dialog-actions {
  margin-top: auto;
}

:deep(.q-field--dense .q-field__control) {
  min-height: 40px;
}

:deep(.q-field__control) {
  border-radius: 6px;
}
</style>
