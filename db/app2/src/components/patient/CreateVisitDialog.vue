<template>
    <q-dialog v-model="showDialog" persistent>
        <q-card style="min-width: 500px; max-width: 600px;">
            <q-card-section class="row items-center q-pb-none">
                <div class="text-h6 text-primary">
                    <q-icon name="add_circle" class="q-mr-sm" />
                    Create New Visit
                </div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
            </q-card-section>

            <q-card-section>
                <div class="text-body2 text-grey-6 q-mb-md">
                    Create a new visit/encounter for {{ patient?.PATIENT_CD || 'this patient' }}
                </div>

                <q-form @submit="handleSubmit" class="q-gutter-md">
                    <!-- Start Date -->
                    <div class="row q-gutter-md">
                        <div class="col">
                            <q-input v-model="formData.START_DATE" type="date" label="Start Date *" outlined dense
                                :rules="[val => !!val || 'Start date is required']" clearable>
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
                            <q-select v-model="formData.ACTIVE_STATUS_CD" :options="statusOptions" label="Status *"
                                outlined dense emit-value map-options clearable
                                :rules="[val => !!val || 'Status is required']">
                                <template v-slot:prepend>
                                    <q-icon name="info" />
                                </template>
                            </q-select>
                        </div>
                        <div class="col">
                            <q-select v-if="locationOptions.length > 0" 
                                v-model="formData.LOCATION_CD" 
                                :options="locationOptions" 
                                label="Location *"
                                outlined dense emit-value map-options clearable
                                :rules="[val => !!val || 'Location is required']"
                                use-input
                                @filter="(val, update) => update()">
                                <template v-slot:prepend>
                                    <q-icon name="location_on" />
                                </template>
                            </q-select>
                            <q-input v-else
                                v-model="formData.LOCATION_CD" 
                                label="Location *" 
                                outlined dense
                                placeholder="e.g., UKJ/NEURO, ICU, ER" 
                                :rules="[val => !!val || 'Location is required']"
                                clearable>
                                <template v-slot:prepend>
                                    <q-icon name="location_on" />
                                </template>
                            </q-input>
                        </div>
                    </div>

                    <!-- In/Out and Source System -->
                    <div class="row q-gutter-md">
                        <div class="col">
                            <q-select v-model="formData.INOUT_CD" :options="inOutOptions" label="Visit Type" outlined
                                dense emit-value map-options clearable>
                                <template v-slot:prepend>
                                    <q-icon name="local_hospital" />
                                </template>
                            </q-select>
                        </div>
                        <div class="col">
                            <q-select v-if="sourceSystemOptions.length > 0"
                                v-model="formData.SOURCESYSTEM_CD" 
                                :options="sourceSystemOptions" 
                                label="Source System" 
                                outlined dense emit-value map-options clearable
                                use-input
                                @filter="(val, update) => update()">
                                <template v-slot:prepend>
                                    <q-icon name="source" />
                                </template>
                            </q-select>
                            <q-input v-else
                                v-model="formData.SOURCESYSTEM_CD" 
                                label="Source System" 
                                outlined dense
                                placeholder="e.g., SYSTEM, EMR, MANUAL" 
                                clearable>
                                <template v-slot:prepend>
                                    <q-icon name="source" />
                                </template>
                            </q-input>
                        </div>
                    </div>

                    <!-- Notes/Blob -->
                    <q-input v-model="formData.VISIT_BLOB" label="Notes" type="textarea" outlined rows="3"
                        placeholder="Additional notes or information about this visit..." clearable>
                        <template v-slot:prepend>
                            <q-icon name="notes" />
                        </template>
                    </q-input>
                </q-form>
            </q-card-section>

            <q-card-actions align="right" class="q-pa-md">
                <q-btn flat label="Cancel" color="grey-7" v-close-popup :disable="loading" />
                <q-btn unelevated label="Create Visit" color="primary" icon="add" @click="handleSubmit"
                    :loading="loading" :disable="!isFormValid" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    patient: {
        type: Object,
        required: true
    }
})

const emit = defineEmits(['update:modelValue', 'visitCreated'])

const $q = useQuasar()
const databaseStore = useDatabaseStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('CreateVisitDialog')

// Reactive state
const loading = ref(false)
const loadingOptions = ref(false)
const showDialog = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// Form data with defaults
const formData = ref({
    START_DATE: new Date().toISOString().split('T')[0], // Today's date
    END_DATE: null,
    ACTIVE_STATUS_CD: 'A', // Active by default
    LOCATION_CD: '',
    INOUT_CD: 'O', // Outpatient by default
    SOURCESYSTEM_CD: 'SYSTEM',
    VISIT_BLOB: ''
})

// Dynamic form options from global settings
const statusOptions = ref([])
const inOutOptions = ref([])
const sourceSystemOptions = ref([])
const locationOptions = ref([])

// Form validation
const isFormValid = computed(() => {
    return formData.value.START_DATE &&
        formData.value.ACTIVE_STATUS_CD &&
        formData.value.LOCATION_CD
})

// Methods
const loadOptions = async () => {
    try {
        loadingOptions.value = true
        
        // Load status options from global settings
        try {
            const statusData = await globalSettingsStore.loadLookupValues('ACTIVE_STATUS_CD')
            if (statusData && statusData.length > 0) {
                statusOptions.value = statusData.map(status => ({
                    label: status.NAME_CHAR || status.CODE_CD,
                    value: status.CODE_CD
                }))
            } else {
                // Fallback to hardcoded options
                statusOptions.value = [
                    { label: 'Active', value: 'A' },
                    { label: 'Inactive', value: 'I' },
                    { label: 'Completed', value: 'C' },
                    { label: 'Cancelled', value: 'X' },
                    { label: 'Pending', value: 'P' }
                ]
            }
        } catch {
            // Use fallback options
            statusOptions.value = [
                { label: 'Active', value: 'A' },
                { label: 'Inactive', value: 'I' },
                { label: 'Completed', value: 'C' },
                { label: 'Cancelled', value: 'X' },
                { label: 'Pending', value: 'P' }
            ]
        }
        
        // Load in/out options from global settings
        try {
            const inOutData = await globalSettingsStore.loadLookupValues('INOUT_CD')
            if (inOutData && inOutData.length > 0) {
                inOutOptions.value = inOutData.map(inout => ({
                    label: inout.NAME_CHAR || inout.CODE_CD,
                    value: inout.CODE_CD
                }))
            } else {
                // Fallback to hardcoded options
                inOutOptions.value = [
                    { label: 'Outpatient', value: 'O' },
                    { label: 'Inpatient', value: 'I' },
                    { label: 'Emergency', value: 'E' },
                    { label: 'Day Care', value: 'D' }
                ]
            }
        } catch {
            // Use fallback options
            inOutOptions.value = [
                { label: 'Outpatient', value: 'O' },
                { label: 'Inpatient', value: 'I' },
                { label: 'Emergency', value: 'E' },
                { label: 'Day Care', value: 'D' }
            ]
        }
        
        // Load source system options
        sourceSystemOptions.value = await globalSettingsStore.getSourceSystemOptions()
        
        // Load location options
        try {
            const locationData = await globalSettingsStore.loadLookupValues('LOCATION_CD')
            if (locationData && locationData.length > 0) {
                locationOptions.value = locationData.map(loc => ({
                    label: loc.NAME_CHAR || loc.CODE_CD,
                    value: loc.CODE_CD
                }))
            }
        } catch {
            // Location will remain as free text input if no options available
            logger.debug('No location options in database, using free text input')
        }
        
        // Set default values if current values don't exist in loaded options
        if (statusOptions.value.length > 0 && !statusOptions.value.find(opt => opt.value === formData.value.ACTIVE_STATUS_CD)) {
            formData.value.ACTIVE_STATUS_CD = statusOptions.value[0].value
        }
        
        if (inOutOptions.value.length > 0 && !inOutOptions.value.find(opt => opt.value === formData.value.INOUT_CD)) {
            formData.value.INOUT_CD = inOutOptions.value[0].value
        }
        
        if (sourceSystemOptions.value.length > 0 && !sourceSystemOptions.value.find(opt => opt.value === formData.value.SOURCESYSTEM_CD)) {
            formData.value.SOURCESYSTEM_CD = sourceSystemOptions.value[0].value
        }
        
    } catch (error) {
        logger.error('Failed to load options from global settings', error)
        $q.notify({
            type: 'warning',
            message: 'Using default options. Some settings may not be available.',
            position: 'top'
        })
    } finally {
        loadingOptions.value = false
    }
}

// Lifecycle
onMounted(async () => {
    await loadOptions()
})

// Reset form when dialog opens
watch(showDialog, (newValue) => {
    if (newValue) {
        // Reset form with defaults
        formData.value = {
            START_DATE: new Date().toISOString().split('T')[0],
            END_DATE: null,
            ACTIVE_STATUS_CD: statusOptions.value.length > 0 ? statusOptions.value[0].value : 'A',
            LOCATION_CD: '',
            INOUT_CD: inOutOptions.value.length > 0 ? inOutOptions.value[0].value : 'O',
            SOURCESYSTEM_CD: sourceSystemOptions.value.length > 0 ? sourceSystemOptions.value[0].value : 'SYSTEM',
            VISIT_BLOB: ''
        }
    }
})

// Handle form submission
const handleSubmit = async () => {
    if (!isFormValid.value) {
        $q.notify({
            type: 'warning',
            message: 'Please fill in all required fields',
            position: 'top'
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

        // Prepare visit data
        const visitData = {
            PATIENT_NUM: props.patient.PATIENT_NUM,
            START_DATE: formData.value.START_DATE,
            END_DATE: formData.value.END_DATE || null,
            ACTIVE_STATUS_CD: formData.value.ACTIVE_STATUS_CD,
            LOCATION_CD: formData.value.LOCATION_CD,
            INOUT_CD: formData.value.INOUT_CD || 'O',
            SOURCESYSTEM_CD: formData.value.SOURCESYSTEM_CD || 'SYSTEM',
            VISIT_BLOB: formData.value.VISIT_BLOB || null,
            UPLOAD_ID: 1
        }

        // Create the visit
        const createdVisit = await visitRepository.createVisit(visitData)

        $q.notify({
            type: 'positive',
            message: `Visit created successfully (ID: ${createdVisit.ENCOUNTER_NUM})`,
            position: 'top',
            timeout: 3000,
            actions: [
                {
                    icon: 'close',
                    color: 'white',
                    handler: () => { /* dismiss */ }
                }
            ]
        })

        // Small delay to ensure database operation completes
        await new Promise(resolve => setTimeout(resolve, 100))

        // Emit success event
        emit('visitCreated', createdVisit)

        // Close dialog
        showDialog.value = false

    } catch (error) {
        logger.error('Error creating visit', error)
        $q.notify({
            type: 'negative',
            message: `Failed to create visit: ${error.message}`,
            position: 'top',
            timeout: 5000
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
</style>
