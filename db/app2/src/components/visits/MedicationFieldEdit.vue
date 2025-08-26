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
              <q-badge v-if="scope.opt.strength" color="primary" outline>{{ scope.opt.strength }}</q-badge>
            </q-item-section>
          </q-item>
        </template>
      </q-select>
    </div>

    <!-- Dosage, Unit, and Route Row -->
    <div class="dosage-row">
      <!-- Dosage Amount (no label) -->
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
        <q-select v-model="localMedicationData.route" :options="routeOptions" label="Route" outlined dense @update:model-value="onMedicationChange">
          <template v-slot:prepend>
            <q-icon name="route" />
          </template>
        </q-select>
      </div>
    </div>

    <!-- Frequency Row -->
    <div class="frequency-row">
      <q-select v-model="localMedicationData.frequency" :options="frequencyOptions" label="Frequency" outlined dense @update:model-value="onMedicationChange" class="full-width">
        <template v-slot:prepend>
          <q-icon name="schedule" />
        </template>
      </q-select>
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
  return localMedicationData.value.drugName || localMedicationData.value.dosage || localMedicationData.value.frequency || localMedicationData.value.route || localMedicationData.value.instructions
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

const onDrugChange = (selectedDrug) => {
  if (selectedDrug) {
    // Auto-populate some defaults based on the drug selection
    if (typeof selectedDrug === 'object') {
      localMedicationData.value.drugName = selectedDrug.name
    }
  }
  onMedicationChange()
}

const onMedicationChange = () => {
  emit('change', localMedicationData.value)
}

const saveChanges = async () => {
  if (!hasValue.value) {
    emit('cancel')
    return
  }

  try {
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

// Watch for prop changes
watch(
  () => props.medicationData,
  (newData) => {
    localMedicationData.value = { ...newData }
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

.dosage-row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
}

.frequency-row {
  width: 100%;
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
