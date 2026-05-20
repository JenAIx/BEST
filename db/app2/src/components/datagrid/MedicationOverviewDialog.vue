<template>
  <q-dialog v-model="dialogModel" persistent>
    <q-card style="min-width: 700px; max-width: 900px">
      <q-card-section class="row items-center q-pb-sm">
        <q-icon name="medication" size="28px" color="primary" class="q-mr-sm" />
        <div class="text-h6">{{ $t('dataGrid.medicationList') }}</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section class="q-pt-none q-pb-sm">
        <div class="text-caption text-grey-6">
          {{ patientName }} • {{ formatDate(visitDate) }}
        </div>
      </q-card-section>

      <q-separator />

      <!-- Medication List -->
      <q-card-section class="medication-list-container">
        <q-list separator>
          <!-- Existing Medications -->
          <q-item
            v-for="(med, index) in localMedications"
            :key="med.observationId || `new-${index}`"
            class="medication-item"
          >
            <!-- Medication Icon -->
            <q-item-section avatar>
              <q-icon name="medication" color="primary" size="24px" />
            </q-item-section>

            <!-- Medication Content -->
            <q-item-section>
              <div v-if="editingIndex !== index" class="medication-display">
                <!-- View Mode -->
                <div class="medication-summary">
                  <span class="drug-name">{{ med.drugName || $t('dataGrid.noMedicationData') }}</span>
                  <span v-if="med.dosage" class="dosage">{{ med.dosage }}{{ med.dosageUnit }}</span>
                  <span v-if="med.frequency" class="frequency">{{ getFrequencyDisplay(med.frequency) }}</span>
                  <span v-if="med.route" class="route">{{ getRouteDisplay(med.route) }}</span>
                </div>
                <div v-if="med.instructions" class="instructions">
                  <q-icon name="info" size="12px" color="info" class="q-mr-xs" />
                  {{ med.instructions }}
                </div>
              </div>

              <!-- Edit Mode -->
              <div v-else class="medication-edit">
                <div class="edit-row">
                  <q-select
                    v-model="med.drugName"
                    :options="drugOptions"
                    option-label="name"
                    option-value="name"
                    label="Drug Name *"
                    outlined
                    dense
                    use-input
                    input-debounce="300"
                    @filter="filterDrugs"
                    @update:model-value="(value) => onDrugChange(value, index)"
                    :loading="searchingDrugs"
                    clearable
                    class="drug-input"
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
                  <q-input
                    v-model.number="med.dosage"
                    type="number"
                    label="Dosage"
                    outlined
                    dense
                    class="dosage-input"
                  />
                  <q-select
                    v-model="med.dosageUnit"
                    :options="dosageUnits"
                    label="Unit"
                    outlined
                    dense
                    class="unit-input"
                  />
                </div>
                <div class="edit-row">
                  <q-select
                    v-model="med.frequency"
                    :options="frequencyOptions"
                    option-label="label"
                    option-value="value"
                    label="Frequency"
                    outlined
                    dense
                    class="frequency-input"
                  />
                  <q-select
                    v-model="med.route"
                    :options="routeOptions"
                    option-label="label"
                    option-value="value"
                    label="Route"
                    outlined
                    dense
                    class="route-input"
                  />
                </div>
                <div class="edit-row">
                  <q-input
                    v-model="med.instructions"
                    label="Instructions"
                    outlined
                    dense
                    type="textarea"
                    rows="2"
                    class="instructions-input"
                  />
                </div>
              </div>
            </q-item-section>

            <!-- Actions -->
            <q-item-section side>
              <div class="action-buttons">
                <!-- View Mode Actions -->
                <template v-if="editingIndex !== index">
                  <q-btn
                    icon="edit"
                    flat
                    round
                    dense
                    size="sm"
                    color="primary"
                    @click="startEdit(index)"
                  >
                    <q-tooltip>{{ $t('common.edit') }}</q-tooltip>
                  </q-btn>
                  <AppRemoveConfirmationButton
                    :loading="saving"
                    @remove-confirmed="deleteMedication(med, index)"
                    @remove-cancelled="() => {}"
                  />
                </template>

                <!-- Edit Mode Actions -->
                <template v-else>
                  <q-btn
                    icon="check"
                    flat
                    round
                    dense
                    size="sm"
                    color="positive"
                    @click="saveMedication(index)"
                    :loading="saving"
                  >
                    <q-tooltip>{{ $t('common.save') }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    icon="close"
                    flat
                    round
                    dense
                    size="sm"
                    color="grey-7"
                    @click="cancelEdit(index)"
                    :disable="saving"
                  >
                    <q-tooltip>{{ $t('common.cancel') }}</q-tooltip>
                  </q-btn>
                </template>
              </div>
            </q-item-section>
          </q-item>

          <!-- Empty state -->
          <q-item v-if="localMedications.length === 0">
            <q-item-section class="text-center text-grey-6 q-py-lg">
              <q-icon name="medication" size="48px" color="grey-4" />
              <div class="q-mt-sm">{{ $t('dataGrid.noMedications') }}</div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-separator />

      <!-- Footer Actions -->
      <q-card-actions align="between">
        <q-btn
          flat
          icon="add"
          :label="$t('dataGrid.addMedication')"
          color="primary"
          @click="addNewMedication"
          :disable="editingIndex !== null"
        />
        <q-btn flat :label="$t('common.close')" color="grey-7" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from 'src/stores/database-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useMedicationsStore } from 'src/stores/medications-store'
import AppRemoveConfirmationButton from 'src/components/shared/AppRemoveConfirmationButton.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  medications: {
    type: Array,
    required: true,
  },
  patientId: {
    type: String,
    required: true,
  },
  encounterNum: {
    type: Number,
    required: true,
  },
  patientName: {
    type: String,
    default: '',
  },
  visitDate: {
    type: String,
    default: '',
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

const emit = defineEmits(['update:modelValue', 'medications-updated'])

const { t } = useI18n()
const notify = useNotify()
const databaseStore = useDatabaseStore()
const globalSettingsStore = useGlobalSettingsStore()
const medicationsStore = useMedicationsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('MedicationOverviewDialog')

// Dialog model
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// State
const localMedications = ref([])
const editingIndex = ref(null)
const originalMedication = ref(null)
const saving = ref(false)
const dosageUnits = ref(['mg', 'g', 'ml', 'µg', 'IE', 'Einheiten', 'Tropfen', 'Stück'])
const drugOptions = ref([])
const searchingDrugs = ref(false)

// Initialize medications when dialog opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      localMedications.value = JSON.parse(JSON.stringify(props.medications))
      editingIndex.value = null
    }
  },
  { immediate: true },
)

// Helper methods
const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString()
}

const getFrequencyDisplay = (freq) => {
  if (!freq) return ''
  const option = props.frequencyOptions.find(f => f.value === freq || f.label === freq)
  return option?.label || freq
}

const getRouteDisplay = (route) => {
  if (!route) return ''
  const option = props.routeOptions.find(r => r.value === route || r.label === route)
  return option?.label || route
}

// Edit actions
const startEdit = (index) => {
  editingIndex.value = index
  originalMedication.value = JSON.parse(JSON.stringify(localMedications.value[index]))
}

const cancelEdit = (index) => {
  if (originalMedication.value) {
    localMedications.value[index] = originalMedication.value
  }
  editingIndex.value = null
  originalMedication.value = null
}

const saveMedication = async (index) => {
  const med = localMedications.value[index]
  
  if (!med.drugName || !med.drugName.trim()) {
    notify.warning('Drug name is required')
    return
  }

  try {
    saving.value = true
    let result = null

    // Normalize medication data
    const normalizedMedicationData = {
      drugName: med.drugName.trim(),
      dosage: med.dosage || null,
      dosageUnit: med.dosageUnit || 'mg',
      frequency: typeof med.frequency === 'object' ? med.frequency?.value || '' : med.frequency || '',
      route: typeof med.route === 'object' ? med.route?.value || '' : med.route || '',
      instructions: med.instructions || '',
    }

    const updateData = {
      TVAL_CHAR: normalizedMedicationData.drugName,
      NVAL_NUM: normalizedMedicationData.dosage ? parseFloat(normalizedMedicationData.dosage) : null,
      OBSERVATION_BLOB: JSON.stringify(normalizedMedicationData),
    }

    if (med.observationId) {
      // Update existing observation
      const observationRepo = databaseStore.getRepository('observation')
      await observationRepo.updateObservation(med.observationId, updateData)
      
      logger.success('Medication updated', { observationId: med.observationId })
    } else {
      // Create new observation
      const patientQuery = 'SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?'
      const patientResult = await databaseStore.executeQuery(patientQuery, [props.patientId])
      
      if (!patientResult.success || !patientResult.data.length) {
        throw new Error(`Patient not found: ${props.patientId}`)
      }

      const patientNum = patientResult.data[0].PATIENT_NUM
      const visitQuery = 'SELECT START_DATE FROM VISIT_DIMENSION WHERE ENCOUNTER_NUM = ?'
      const visitResult = await databaseStore.executeQuery(visitQuery, [props.encounterNum])
      const visitStartDate = visitResult.success && visitResult.data.length > 0 
        ? visitResult.data[0].START_DATE 
        : new Date().toISOString().split('T')[0]

      const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('DATAGRID_EDITOR')
      const defaultCategory = await globalSettingsStore.getDefaultCategory('MEDICATIONS')

      const observationRepo = databaseStore.getRepository('observation')
      const createdObs = await observationRepo.create({
        PATIENT_NUM: patientNum,
        ENCOUNTER_NUM: props.encounterNum,
        CONCEPT_CD: 'LID: 52418-1',
        VALTYPE_CD: 'M',
        TVAL_CHAR: normalizedMedicationData.drugName,
        NVAL_NUM: normalizedMedicationData.dosage ? parseFloat(normalizedMedicationData.dosage) : null,
        UNIT_CD: normalizedMedicationData.dosageUnit,
        OBSERVATION_BLOB: JSON.stringify(normalizedMedicationData),
        START_DATE: visitStartDate,
        CATEGORY_CHAR: defaultCategory,
        PROVIDER_ID: 'SYSTEM',
        LOCATION_CD: 'DATAGRID',
        SOURCESYSTEM_CD: defaultSourceSystem,
        INSTANCE_NUM: 1,
        UPLOAD_ID: 1,
      })

      // Update local medication with new observation ID
      med.observationId = createdObs.OBSERVATION_ID
      
      logger.success('Medication created', { observationId: med.observationId })
      
      // Store for later use in update event
      result = createdObs
    }

    editingIndex.value = null
    originalMedication.value = null

    notify.success(t('notifications.medicationSaved'))

    // Update local medications list with saved data
    if (!med.observationId && result) {
      localMedications.value[index] = {
        ...med,
        observationId: result.OBSERVATION_ID,
      }
    }

    // Emit update event
    emit('medications-updated')
  } catch (error) {
    logger.error('Failed to save medication', error)
    notify.error(t('notifications.failedToSaveMedication'))
  } finally {
    saving.value = false
  }
}

// Delete action
const deleteMedication = async (med, index) => {
  if (!med.observationId) {
    // Just remove from local list if not saved yet
    localMedications.value.splice(index, 1)
    return
  }

  try {
    const observationRepo = databaseStore.getRepository('observation')
    await observationRepo.delete(med.observationId)

    localMedications.value.splice(index, 1)

    logger.success('Medication deleted', { observationId: med.observationId })

    notify.success(t('notifications.medicationDeleted'))

    // Emit update event
    emit('medications-updated')
  } catch (error) {
    logger.error('Failed to delete medication', error)
    notify.error(t('notifications.failedToDeleteMedication'))
  }
}

const addNewMedication = () => {
  localMedications.value.push({
    drugName: '',
    dosage: null,
    dosageUnit: 'mg',
    frequency: '',
    route: '',
    instructions: '',
    observationId: null, // New medication
  })
  
  // Start editing the new medication
  editingIndex.value = localMedications.value.length - 1
}

// Drug search functionality (like in MedicationEditDialog)
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

const onDrugChange = (selectedDrug, medIndex) => {
  const med = localMedications.value[medIndex]
  if (!med) return
  
  if (selectedDrug && typeof selectedDrug === 'object') {
    // Set drug name
    med.drugName = selectedDrug.name

    // Set route
    if (selectedDrug.default_route) {
      med.route = selectedDrug.default_route
    }

    // Set frequency
    if (selectedDrug.default_frequency) {
      med.frequency = selectedDrug.default_frequency
    }

    // Set dosage and unit from strength
    if (selectedDrug.default_strength) {
      const { dosage, unit } = medicationsStore.parseDosageFromStrength(selectedDrug.default_strength)
      if (dosage !== null) {
        med.dosage = dosage
      }
      if (unit) {
        med.dosageUnit = unit
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.medication-list-container {
  max-height: 500px;
  overflow-y: auto;
}

.medication-item {
  transition: background 0.2s ease;
  padding: 12px 16px;
  
  &:hover {
    background: rgba($primary, 0.02);
  }
}

.medication-display {
  .medication-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 4px;
    
    .drug-name {
      font-weight: 500;
      font-size: 0.95rem;
      color: $grey-9;
    }
    
    .dosage,
    .frequency,
    .route {
      font-size: 0.85rem;
      color: $grey-7;
      padding: 2px 8px;
      background: $grey-2;
      border-radius: 4px;
    }
  }
  
  .instructions {
    font-size: 0.8rem;
    color: $grey-6;
    font-style: italic;
    margin-top: 4px;
    display: flex;
    align-items: start;
  }
}

.medication-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .edit-row {
    display: flex;
    gap: 8px;
    
    .drug-input {
      flex: 2;
    }
    
    .dosage-input {
      flex: 1;
      min-width: 80px;
    }
    
    .unit-input {
      flex: 0.8;
      min-width: 70px;
    }
    
    .frequency-input,
    .route-input {
      flex: 1;
    }
    
    .instructions-input {
      flex: 1;
    }
  }
}

.action-buttons {
  display: flex;
  gap: 4px;
}
</style>

