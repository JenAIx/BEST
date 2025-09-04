<template>
  <div class="medication-content">
    <!-- Drug Name Search -->
    <div class="drug-search">
      <q-select
        v-model="localMedicationData.drugName"
        :options="drugOptions"
        option-label="name"
        option-value="name"
        label="Drug Name"
        outlined
        dense
        use-input
        input-debounce="300"
        @filter="filterDrugs"
        @update:model-value="onDrugChange"
        :loading="searchingDrugs"
        clearable
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
        <q-input v-model.number="localMedicationData.dosage" type="number" placeholder="Amount" outlined dense @update:model-value="onMedicationChange" :loading="saving">
          <template v-slot:prepend>
            <q-icon name="straighten" />
          </template>
        </q-input>
      </div>

      <!-- Dosage Unit -->
      <div class="unit-select">
        <q-select v-model="localMedicationData.dosageUnit" :options="dosageUnits" label="Unit" outlined dense @update:model-value="onMedicationChange" />
      </div>

      <!-- Route -->
      <div class="route-select">
        <q-select v-model="localMedicationData.route" :options="routeOptions" option-label="label" option-value="value" label="Route" outlined dense @update:model-value="onMedicationChange">
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
      >
        <template v-slot:prepend>
          <q-icon name="notes" />
        </template>
      </q-input>
    </div>

    <!-- Edit Mode Actions -->
    <div class="edit-actions">
      <q-btn flat label="Cancel" color="grey-6" @click="$emit('cancel')" class="q-mr-sm" />
      <q-btn unelevated label="Save" color="primary" @click="saveChanges" :loading="saving" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  medicationData: {
    type: Object,
    required: true,
  },
  saving: {
    type: Boolean,
    default: false,
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

const emit = defineEmits(['save', 'cancel', 'change'])

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('MedicationFieldEdit')

// State
const localMedicationData = ref({ ...props.medicationData })
const drugOptions = ref([])
const searchingDrugs = ref(false)

// Options
const dosageUnits = ['mg', 'g', 'mcg', 'IU', 'ml', 'L', 'units', 'drops', 'sprays', 'patches']

// Computed
const hasValue = computed(() => {
  // At minimum, we need a drug name to consider this a valid medication
  return !!(localMedicationData.value.drugName && localMedicationData.value.drugName.trim())
})

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
    // Use global settings store for drug search
    const drugs = await globalSettingsStore.getDrugOptions(searchTerm)

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
  // Matches patterns like: 10mg, 500mg, 100U/mL, 90mcg, etc.
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
      ug: 'mcg', // micrograms
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
    return { dosage, unit: 'mg' } // Default to mg if unit not found
  }

  // If parsing fails completely
  return { dosage: null, unit: '' }
}

const onDrugChange = (selectedDrug) => {
  console.log('onDrugChange called with:', selectedDrug)

  if (selectedDrug && typeof selectedDrug === 'object') {
    console.log('Setting drug data:', {
      name: selectedDrug.name,
      route: selectedDrug.default_route,
      frequency: selectedDrug.default_frequency,
      strength: selectedDrug.default_strength,
    })

    // Set drug name
    localMedicationData.value.drugName = selectedDrug.name

    // Set route
    if (selectedDrug.default_route) {
      localMedicationData.value.route = selectedDrug.default_route
      console.log('Set route to:', selectedDrug.default_route)
    }

    // Set frequency
    if (selectedDrug.default_frequency) {
      localMedicationData.value.frequency = selectedDrug.default_frequency
      console.log('Set frequency to:', selectedDrug.default_frequency)
    }

    // Set dosage and unit from strength
    if (selectedDrug.default_strength) {
      const { dosage, unit } = parseDosageFromStrength(selectedDrug.default_strength)
      if (dosage !== null) {
        localMedicationData.value.dosage = dosage
        console.log('Set dosage to:', dosage)
      }
      if (unit) {
        localMedicationData.value.dosageUnit = unit
        console.log('Set unit to:', unit)
      }
    }

    console.log('Final localMedicationData:', localMedicationData.value)
  }

  onMedicationChange()
}

const onMedicationChange = () => {
  logger.debug('MedicationFieldEdit: onMedicationChange called', {
    localMedicationData: localMedicationData.value,
  })
  emit('change', localMedicationData.value)
}

const saveChanges = async () => {
  logger.debug('MedicationFieldEdit: saveChanges called', {
    hasValue: hasValue.value,
    localMedicationData: localMedicationData.value,
  })

  if (!hasValue.value) {
    logger.warn('MedicationFieldEdit: No value detected, cancelling')
    emit('cancel')
    return
  }

  try {
    logger.debug('MedicationFieldEdit: Emitting save event with data', {
      localMedicationData: localMedicationData.value,
    })

    emit('save', localMedicationData.value)

    $q.notify({
      type: 'positive',
      message: 'Medication updated',
      position: 'top',
    })
  } catch (error) {
    logger.error('Failed to save medication changes', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save medication',
      position: 'top',
    })
  }
}

// Watch for prop changes - only update if props are completely different (don't override auto-populated values)
watch(
  () => props.medicationData,
  (newData) => {
    console.log('Props changed:', { newData, currentLocal: localMedicationData.value })

    // Only update if this is a completely different medication (different drug name or clearing)
    if (newData.drugName !== localMedicationData.value.drugName) {
      console.log('Different drug detected, updating local data')
      localMedicationData.value = { ...newData }
    } else {
      console.log('Same drug, keeping auto-populated values')
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.medication-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 0.75rem;
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

:deep(.q-field--dense .q-field__control) {
  min-height: 40px;
}

:deep(.q-field__control) {
  border-radius: 6px;
}

// Edit Mode Actions
.edit-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid $grey-3;
  padding-top: 1rem;
}
</style>
