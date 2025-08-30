<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 500px; max-width: 600px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-primary">
          <q-icon name="edit" class="q-mr-sm" />
          Edit Visit
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-grey-6 q-mb-md">Edit visit {{ visit?.encounterNum }} for {{ patient?.PATIENT_CD || 'this patient' }}</div>

        <q-form @submit="handleSubmit" class="q-gutter-md">
          <!-- Start Date -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-input v-model="formData.START_DATE" type="date" label="Start Date *" outlined dense :rules="[(val) => !!val || 'Start date is required']" clearable>
                <template v-slot:prepend>
                  <q-icon name="event" />
                </template>
              </q-input>
            </div>
            <div class="col">
              <q-input v-model="formData.END_DATE" type="date" label="End Date" outlined dense clearable>
                <template v-slot:prepend>
                  <q-icon name="event_available" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Status and Location -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-select v-model="formData.ACTIVE_STATUS_CD" :options="statusOptions" label="Status *" outlined dense emit-value map-options clearable :rules="[(val) => !!val || 'Status is required']">
                <template v-slot:prepend>
                  <q-icon name="info" />
                </template>
              </q-select>
            </div>
            <div class="col">
              <q-select
                v-if="locationOptions.length > 0"
                v-model="formData.LOCATION_CD"
                :options="locationOptions"
                label="Location *"
                outlined
                dense
                emit-value
                map-options
                clearable
                :rules="[(val) => !!val || 'Location is required']"
                use-input
                @filter="(val, update) => update()"
              >
                <template v-slot:prepend>
                  <q-icon name="location_on" />
                </template>
              </q-select>
              <q-input v-else v-model="formData.LOCATION_CD" label="Location *" outlined dense placeholder="e.g., UKJ/NEURO, ICU, ER" :rules="[(val) => !!val || 'Location is required']" clearable>
                <template v-slot:prepend>
                  <q-icon name="location_on" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Visit Type and In/Out Status -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-select v-model="formData.VISIT_TYPE_CD" :options="visitTypeOptions" label="Visit Type" outlined dense emit-value map-options clearable>
                <template v-slot:prepend>
                  <q-icon name="event_note" />
                </template>
              </q-select>
            </div>
            <div class="col">
              <q-select v-model="formData.INOUT_CD" :options="inOutOptions" label="In/Out Status" outlined dense emit-value map-options clearable>
                <template v-slot:prepend>
                  <q-icon name="local_hospital" />
                </template>
              </q-select>
            </div>
          </div>

          <!-- Source System -->
          <div class="row q-gutter-md">
            <div class="col"></div>
            <div class="col">
              <q-select
                v-if="sourceSystemOptions.length > 0"
                v-model="formData.SOURCESYSTEM_CD"
                :options="sourceSystemOptions"
                label="Source System"
                outlined
                dense
                emit-value
                map-options
                clearable
                use-input
                @filter="(val, update) => update()"
              >
                <template v-slot:prepend>
                  <q-icon name="source" />
                </template>
              </q-select>
              <q-input v-else v-model="formData.SOURCESYSTEM_CD" label="Source System" outlined dense placeholder="e.g., SYSTEM, EMR, MANUAL" clearable>
                <template v-slot:prepend>
                  <q-icon name="source" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Notes/Blob -->
          <q-input v-model="formData.VISIT_BLOB" label="Notes" type="textarea" outlined rows="3" placeholder="Additional notes or information about this visit..." clearable>
            <template v-slot:prepend>
              <q-icon name="notes" />
            </template>
          </q-input>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup :disable="loading" />
        <q-btn unelevated label="Update Visit" color="primary" icon="save" @click="handleSubmit" :loading="loading" :disable="!isFormValid || !hasChanges" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  patient: {
    type: Object,
    required: true,
  },
  visit: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'visitUpdated'])

const $q = useQuasar()
const databaseStore = useDatabaseStore()
const globalSettingsStore = useGlobalSettingsStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('EditVisitDialog')

// Reactive state
const loading = ref(false)
const loadingOptions = ref(false)
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Form data
const formData = ref({
  START_DATE: '',
  END_DATE: '',
  ACTIVE_STATUS_CD: '',
  LOCATION_CD: '',
  VISIT_TYPE_CD: '',
  INOUT_CD: '',
  SOURCESYSTEM_CD: '',
  VISIT_BLOB: '',
})

// Original data for change detection
const originalData = ref({})

// Dynamic form options from global settings
const statusOptions = ref([])
const visitTypeOptions = ref([])
const inOutOptions = ref([])
const sourceSystemOptions = ref([])
const locationOptions = ref([])

// Form validation
const isFormValid = computed(() => {
  return formData.value.START_DATE && formData.value.ACTIVE_STATUS_CD && formData.value.LOCATION_CD
})

// Change detection
const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
})

// Helper function to format date for input
const formatDateForInput = (dateStr) => {
  if (!dateStr) return ''
  // Handle both YYYY-MM-DD and other date formats
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

// Methods
const loadOptions = async () => {
  try {
    loadingOptions.value = true

    // Load status options from concept resolution store (SNOMED-CT concepts)
    try {
      const conceptStore = useConceptResolutionStore()
      const visitStatusOptions = await conceptStore.getConceptOptions('visit_status', 'VISIT_DIMENSION', 'ACTIVE_STATUS_CD')

      if (visitStatusOptions && visitStatusOptions.length > 0) {
        statusOptions.value = visitStatusOptions
        logger.debug('Loaded visit status options from concept store', {
          optionsCount: visitStatusOptions.length,
          options: visitStatusOptions.map((opt) => ({ label: opt.label, value: opt.value })),
        })
      } else {
        // Fallback to global settings if concept store fails
        const statusData = await globalSettingsStore.loadLookupValues('ACTIVE_STATUS_CD')
        if (statusData && statusData.length > 0) {
          statusOptions.value = statusData.map((status) => ({
            label: status.NAME_CHAR || status.CODE_CD,
            value: status.CODE_CD,
          }))
          logger.debug('Loaded visit status options from global settings fallback')
        } else {
          // Final fallback - should not happen with proper SNOMED-CT setup
          statusOptions.value = [
            { label: 'Active', value: 'SCTID: 55561003' },
            { label: 'Classified', value: 'SCTID: 73504009' },
            { label: 'Closed', value: 'SCTID: 29179001' },
            { label: 'Inactive', value: 'SCTID: 73425007' },
          ]
          logger.warn('Using hardcoded SNOMED-CT fallback options for visit status')
        }
      }
    } catch (error) {
      logger.error('Failed to load visit status options from concept store', error)
      // Use minimal fallback options
      statusOptions.value = [
        { label: 'Active', value: 'SCTID: 55561003' },
        { label: 'Classified', value: 'SCTID: 73504009' },
        { label: 'Closed', value: 'SCTID: 29179001' },
        { label: 'Inactive', value: 'SCTID: 73425007' },
      ]
    }

    // Load visit type options from concept resolution store
    try {
      const visitTypeData = await conceptStore.getConceptOptions('visit_type', 'VISIT_DIMENSION', 'VISIT_TYPE_CD')

      if (visitTypeData && visitTypeData.length > 0) {
        visitTypeOptions.value = visitTypeData
        logger.debug('Loaded visit type options from concept store', {
          optionsCount: visitTypeData.length,
          options: visitTypeData.map((opt) => ({ label: opt.label, value: opt.value })),
        })
      } else {
        // Fallback to hardcoded options
        visitTypeOptions.value = [
          { label: 'Routine Check-up', value: 'routine' },
          { label: 'Follow-up', value: 'followup' },
          { label: 'Emergency', value: 'emergency' },
          { label: 'Consultation', value: 'consultation' },
          { label: 'Procedure', value: 'procedure' },
        ]
        logger.debug('Using hardcoded fallback visit type options')
      }
    } catch (error) {
      logger.error('Failed to load visit type options from concept store', error)
      // Use minimal fallback options
      visitTypeOptions.value = [
        { label: 'Routine Check-up', value: 'routine' },
        { label: 'Follow-up', value: 'followup' },
        { label: 'Emergency', value: 'emergency' },
        { label: 'Consultation', value: 'consultation' },
        { label: 'Procedure', value: 'procedure' },
      ]
    }

    // Load in/out options from concept resolution store
    try {
      const inOutData = await conceptStore.getConceptOptions('inout_type', 'VISIT_DIMENSION', 'INOUT_CD')

      if (inOutData && inOutData.length > 0) {
        inOutOptions.value = inOutData
        logger.debug('Loaded in/out options from concept store', {
          optionsCount: inOutData.length,
          options: inOutData.map((opt) => ({ label: opt.label, value: opt.value })),
        })
      } else {
        // Fallback to global settings
        const inOutSettingsData = await globalSettingsStore.loadLookupValues('INOUT_CD')
        if (inOutSettingsData && inOutSettingsData.length > 0) {
          inOutOptions.value = inOutSettingsData.map((inout) => ({
            label: inout.NAME_CHAR || inout.CODE_CD,
            value: inout.CODE_CD,
          }))
          logger.debug('Loaded in/out options from global settings fallback')
        } else {
          // Final fallback to hardcoded options
          inOutOptions.value = [
            { label: 'Outpatient', value: 'O' },
            { label: 'Inpatient', value: 'I' },
            { label: 'Emergency', value: 'E' },
            { label: 'Day Care', value: 'D' },
          ]
        }
      }
    } catch (error) {
      logger.error('Failed to load in/out options from concept store', error)
      // Use fallback options
      inOutOptions.value = [
        { label: 'Outpatient', value: 'O' },
        { label: 'Inpatient', value: 'I' },
        { label: 'Emergency', value: 'E' },
        { label: 'Day Care', value: 'D' },
      ]
    }

    // Load source system options
    sourceSystemOptions.value = await globalSettingsStore.getSourceSystemOptions()

    // Load location options
    try {
      const locationData = await globalSettingsStore.loadLookupValues('LOCATION_CD')
      if (locationData && locationData.length > 0) {
        locationOptions.value = locationData.map((loc) => ({
          label: loc.NAME_CHAR || loc.CODE_CD,
          value: loc.CODE_CD,
        }))
      }
    } catch {
      // Location will remain as free text input if no options available
      logger.debug('No location options in database, using free text input')
    }
  } catch (error) {
    logger.error('Failed to load options from global settings', error)
    $q.notify({
      type: 'warning',
      message: 'Using default options. Some settings may not be available.',
      position: 'top',
    })
  } finally {
    loadingOptions.value = false
  }
}

// Initialize form when dialog opens or visit changes
watch(
  [showDialog, () => props.visit],
  ([dialogOpen, visit]) => {
    if (dialogOpen && visit) {
      logger.debug('EditVisitDialog received visit data', {
        dialogOpen,
        visitStructure: {
          hasVisitProperty: !!visit.visit,
          visitKeys: Object.keys(visit),
          visitVisitKeys: visit.visit ? Object.keys(visit.visit) : null,
        },
        fullVisit: visit,
      })

      const visitData = visit.visit || visit

      logger.debug('Using visitData for form', {
        visitDataKeys: Object.keys(visitData),
        visitBlob: visitData.VISIT_BLOB,
        encounterNum: visitData.ENCOUNTER_NUM,
      })

      // Extract visit type and notes from VISIT_BLOB if it exists
      let visitType = ''
      let visitNotes = ''
      if (visitData.VISIT_BLOB) {
        try {
          const blobData = JSON.parse(visitData.VISIT_BLOB)
          visitType = blobData.visitType || ''
          visitNotes = blobData.notes || ''
          logger.debug('Extracted data from VISIT_BLOB', {
            visitBlob: visitData.VISIT_BLOB,
            parsedData: blobData,
            extractedVisitType: visitType,
            extractedNotes: visitNotes,
          })
        } catch (error) {
          logger.warn('Failed to parse VISIT_BLOB JSON', {
            visitBlob: visitData.VISIT_BLOB,
            error: error.message,
          })
          // If JSON parsing fails, treat the entire VISIT_BLOB as notes
          visitNotes = visitData.VISIT_BLOB
        }
      } else {
        logger.debug('No VISIT_BLOB found for visit', {
          visitData: visitData,
        })
      }

      formData.value = {
        START_DATE: formatDateForInput(visitData.START_DATE),
        END_DATE: formatDateForInput(visitData.END_DATE),
        ACTIVE_STATUS_CD: visitData.ACTIVE_STATUS_CD || '',
        LOCATION_CD: visitData.LOCATION_CD || '',
        VISIT_TYPE_CD: visitType, // Use visit type from VISIT_BLOB
        INOUT_CD: visitData.INOUT_CD || '',
        SOURCESYSTEM_CD: visitData.SOURCESYSTEM_CD || '',
        VISIT_BLOB: visitNotes, // Use notes from VISIT_BLOB, not the raw JSON
      }

      // Store original data for change detection
      originalData.value = { ...formData.value }
    }
  },
  { immediate: true },
)

// Lifecycle
onMounted(async () => {
  await loadOptions()
})

// Handle form submission
const handleSubmit = async () => {
  if (!isFormValid.value) {
    $q.notify({
      type: 'warning',
      message: 'Please fill in all required fields',
      position: 'top',
    })
    return
  }

  if (!hasChanges.value) {
    $q.notify({
      type: 'info',
      message: 'No changes to save',
      position: 'top',
    })
    return
  }

  loading.value = true

  try {
    // Get visit repository
    const visitRepository = databaseStore.getRepository('visit')
    if (!visitRepository) {
      throw new Error('Visit repository not available')
    }

    // Prepare update data (only changed fields)
    const updateData = {}

    // Check if VISIT_TYPE_CD or VISIT_BLOB (notes) have changed
    const visitTypeChanged = formData.value.VISIT_TYPE_CD !== originalData.value.VISIT_TYPE_CD
    const notesChanged = formData.value.VISIT_BLOB !== originalData.value.VISIT_BLOB

    if (visitTypeChanged || notesChanged) {
      // Parse existing VISIT_BLOB from the original visit data to preserve other fields
      let blobData = {}
      try {
        const visitData = props.visit.visit || props.visit
        if (visitData.VISIT_BLOB) {
          blobData = JSON.parse(visitData.VISIT_BLOB)
        }
      } catch {
        // If parsing fails, start with empty object
      }

      // Update the fields that changed
      if (visitTypeChanged) {
        blobData.visitType = formData.value.VISIT_TYPE_CD || ''
      }
      if (notesChanged) {
        blobData.notes = formData.value.VISIT_BLOB || ''
      }

      // Always update the timestamp
      blobData.updatedAt = new Date().toISOString()

      // Store the updated blob
      updateData.VISIT_BLOB = JSON.stringify(blobData)

      logger.debug('Updated VISIT_BLOB', {
        visitTypeChanged,
        notesChanged,
        newVisitType: formData.value.VISIT_TYPE_CD,
        newNotes: formData.value.VISIT_BLOB,
        finalBlobData: blobData,
        finalBlobString: updateData.VISIT_BLOB,
      })
    }

    // Handle other fields
    Object.keys(formData.value).forEach((key) => {
      if (key !== 'VISIT_TYPE_CD' && key !== 'VISIT_BLOB' && formData.value[key] !== originalData.value[key]) {
        updateData[key] = formData.value[key] || null
      }
    })

    // Always update the UPDATE_DATE when saving
    updateData.UPDATE_DATE = new Date().toISOString()

    // Update the visit
    const visitData = props.visit.visit || props.visit
    await visitRepository.update(visitData.ENCOUNTER_NUM, updateData)

    $q.notify({
      type: 'positive',
      message: `Visit ${visitData.ENCOUNTER_NUM} updated successfully`,
      position: 'top',
      timeout: 3000,
      actions: [
        {
          icon: 'close',
          color: 'white',
          handler: () => {
            /* dismiss */
          },
        },
      ],
    })

    // Small delay to ensure database operation completes
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Emit success event
    emit('visitUpdated', { ...visitData, ...updateData })

    // Close dialog
    showDialog.value = false
  } catch (error) {
    logger.error('Error updating visit', error)
    $q.notify({
      type: 'negative',
      message: `Failed to update visit: ${error.message}`,
      position: 'top',
      timeout: 5000,
    })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 12px;
}

.text-h6 {
  font-weight: 600;
  letter-spacing: -0.025em;
}

.q-form {
  .q-field {
    margin-bottom: 8px;
  }
}

// Custom styling for required field indicators
.q-field--outlined .q-field__control:before {
  border-color: rgba(0, 0, 0, 0.24);
}

.q-field--error .q-field__control:before {
  border-color: #f44336;
}

// Hover effects for buttons
.q-btn {
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
  }
}

// Form section styling
.q-card-section {
  &:first-child {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }
}

// Icon styling
.q-icon {
  color: rgba(0, 0, 0, 0.54);
}

// Input focus styling
.q-field--focused {
  .q-icon {
    color: var(--q-primary);
  }
}

// Disabled state for save button when no changes
.q-btn:disabled {
  opacity: 0.6;
}
</style>
