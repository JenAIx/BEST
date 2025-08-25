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
                            <q-input v-model="formData.LOCATION_CD" label="Location *" outlined dense
                                placeholder="e.g., UKJ/NEURO, ICU, ER" :rules="[val => !!val || 'Location is required']"
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
                            <q-input v-model="formData.SOURCESYSTEM_CD" label="Source System" outlined dense
                                placeholder="e.g., SYSTEM, EMR, MANUAL" clearable>
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
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'

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

// Reactive state
const loading = ref(false)
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

// Form options
const statusOptions = [
    { label: 'Active', value: 'A' },
    { label: 'Inactive', value: 'I' },
    { label: 'Completed', value: 'C' },
    { label: 'Cancelled', value: 'X' },
    { label: 'Pending', value: 'P' }
]

const inOutOptions = [
    { label: 'Outpatient', value: 'O' },
    { label: 'Inpatient', value: 'I' },
    { label: 'Emergency', value: 'E' },
    { label: 'Day Care', value: 'D' }
]

// Form validation
const isFormValid = computed(() => {
    return formData.value.START_DATE &&
        formData.value.ACTIVE_STATUS_CD &&
        formData.value.LOCATION_CD
})

// Reset form when dialog opens
watch(showDialog, (newValue) => {
    if (newValue) {
        // Reset form with defaults
        formData.value = {
            START_DATE: new Date().toISOString().split('T')[0],
            END_DATE: null,
            ACTIVE_STATUS_CD: 'A',
            LOCATION_CD: '',
            INOUT_CD: 'O',
            SOURCESYSTEM_CD: 'SYSTEM',
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
        console.error('Error creating visit:', error)
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
