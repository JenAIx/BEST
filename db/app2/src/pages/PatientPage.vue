<template>
    <q-page class="q-pa-md">
        <div v-if="loading" class="text-center q-py-xl">
            <q-spinner color="primary" size="48px" />
            <div class="text-grey-6 q-mt-md">Loading patient details...</div>
        </div>

        <div v-else-if="patient">
            <!-- Patient Header -->
            <div class="row items-center justify-between q-mb-lg">
                <div class="row items-center q-gutter-md">
                    <q-btn flat round icon="arrow_back" @click="goToPatientSearch" />
                    <PatientAvatar :patient="patient" size="64px" />
                    <div>
                        <div class="text-h4">{{ getPatientName(patient) }}</div>
                        <div class="text-caption text-grey-6">
                            {{ patient.PATIENT_CD }} • {{ getPatientAge(patient) }} • {{ getPatientGender(patient) }}
                        </div>
                    </div>
                </div>

                <!-- Delete Patient Button -->
                <q-btn color="negative" icon="delete" round outline @click="showDeleteConfirmation"
                    :loading="deleteLoading">
                    <q-tooltip>Delete this patient and all associated data</q-tooltip>
                </q-btn>
            </div>

            <!-- Patient Info Cards -->
            <div class="row q-col-gutter-md q-mb-lg">
                <div class="col-12 col-md-4">
                    <PatientDemographicsCard :patient="patient" @updated="onPatientUpdated" />
                </div>

                <div class="col-12 col-md-4">
                    <PatientAdditionalInfoCard :patient="patient" @updated="onPatientUpdated" />
                </div>

                <div class="col-12 col-md-4">
                    <PatientStatisticsCard :patient="patient" :visits="visits" :observations="observations" />
                </div>
            </div>

            <!-- Visits and Observations -->
            <q-card>
                <q-card-section class="q-pb-none">
                    <div class="text-h6 text-primary">
                        {{ observationsTabLabel }}
                    </div>
                </q-card-section>
                <q-separator />
                <q-card-section class="q-pa-none">
                    <PatientObservationsTab ref="observationsTabRef" :patient="patient" :observations="observations"
                        :visits="visits" @updated="onObservationsUpdated" />
                </q-card-section>
            </q-card>
        </div>

        <div v-else class="text-center q-py-xl">
            <q-icon name="person_off" size="64px" color="grey-5" />
            <div class="text-h6 text-grey-6 q-mt-md">Patient not found</div>
            <div class="text-body2 text-grey-6 q-mt-sm">The requested patient could not be found.</div>
            <q-btn color="primary" label="Back to Patient Search" @click="goToPatientSearch" class="q-mt-md" />
        </div>

        <!-- Delete Confirmation Dialog -->
        <q-dialog v-model="showDeleteDialog" persistent>
            <q-card style="min-width: 400px;">
                <q-card-section class="row items-center">
                    <q-avatar icon="warning" color="negative" text-color="white" />
                    <span class="q-ml-sm text-h6">Confirm Patient Deletion</span>
                </q-card-section>

                <q-card-section class="q-pt-none">
                    <div class="text-body1 q-mb-md">
                        Are you sure you want to delete patient <strong>{{ getPatientName(patient) }}</strong> ({{
                            patient?.PATIENT_CD }})?
                    </div>
                    <div class="text-body2 text-grey-7" v-if="patientDataSummary">
                        {{ patientDataSummary }}
                    </div>
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="grey-7" @click="cancelDelete" :disable="deleteLoading" />
                    <q-btn unelevated label="Delete Patient" color="negative" icon="delete" @click="confirmDelete"
                        :loading="deleteLoading" />
                </q-card-actions>
            </q-card>
        </q-dialog>

        <!-- Delete Warning Dialog (for patients with data) -->
        <q-dialog v-model="showDeleteWarningDialog" persistent>
            <q-card style="min-width: 500px;">
                <q-card-section class="row items-center">
                    <q-avatar icon="error" color="negative" text-color="white" />
                    <span class="q-ml-sm text-h6">Warning: Patient Has Data</span>
                </q-card-section>

                <q-card-section class="q-pt-none">
                    <div class="text-body1 q-mb-md" v-html="deleteWarningMessage"></div>
                    <div class="text-body2 text-negative">
                        <strong>This action cannot be undone.</strong>
                    </div>
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Cancel" color="grey-7" @click="cancelDeleteWarning" :disable="deleteLoading" />
                    <q-btn unelevated label="Delete Anyway" color="negative" icon="delete_forever"
                        @click="performDelete" :loading="deleteLoading" />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import PatientAvatar from '../components/shared/PatientAvatar.vue'
import PatientDemographicsCard from '../components/patient/PatientDemographicsCard.vue'
import PatientAdditionalInfoCard from '../components/patient/PatientAdditionalInfoCard.vue'
import PatientStatisticsCard from '../components/patient/PatientStatisticsCard.vue'
import PatientObservationsTab from '../components/patient/PatientObservationsTab.vue'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const dbStore = useDatabaseStore()

// State
const loading = ref(true)
const patient = ref(null)
const visits = ref([])
const observations = ref([])

// Delete functionality state
const deleteLoading = ref(false)
const showDeleteDialog = ref(false)
const showDeleteWarningDialog = ref(false)
const deleteWarningMessage = ref('')
const patientDataSummary = ref('')

// Component refs
const observationsTabRef = ref(null)

// Get patient ID from route params
const patientId = route.params.patientId

// Delete Methods
const showDeleteConfirmation = async () => {
    if (!patient.value) return

    try {
        // Check if patient has associated data
        const visitCount = visits.value?.length || 0
        const observationCount = observations.value?.length || 0

        if (visitCount > 0 || observationCount > 0) {
            const parts = []
            if (visitCount > 0) parts.push(`${visitCount} visit${visitCount > 1 ? 's' : ''}`)
            if (observationCount > 0) parts.push(`${observationCount} observation${observationCount > 1 ? 's' : ''}`)
            patientDataSummary.value = `This patient has ${parts.join(' and ')}.`
        } else {
            patientDataSummary.value = ''
        }

        showDeleteDialog.value = true
    } catch (error) {
        console.error('Error checking patient data:', error)
        showDeleteDialog.value = true
    }
}

const cancelDelete = () => {
    showDeleteDialog.value = false
    patientDataSummary.value = ''
}

const confirmDelete = async () => {
    if (!patient.value) return

    try {
        // Check if patient has data that requires additional warning
        const visitCount = visits.value?.length || 0
        const observationCount = observations.value?.length || 0

        if (visitCount > 0 || observationCount > 0) {
            // Show additional warning for patients with data
            const parts = []
            if (visitCount > 0) parts.push(`${visitCount} visit${visitCount > 1 ? 's' : ''}`)
            if (observationCount > 0) parts.push(`${observationCount} observation${observationCount > 1 ? 's' : ''}`)

            deleteWarningMessage.value = `This patient has <strong>${parts.join(' and ')}</strong>. Deleting the patient will also delete all associated data.<br><br><strong>This action cannot be undone.</strong>`

            showDeleteDialog.value = false
            showDeleteWarningDialog.value = true
        } else {
            // No data, proceed with deletion
            await performDelete()
        }
    } catch (error) {
        console.error('Error checking patient data:', error)
        // Proceed with deletion anyway
        await performDelete()
    }
}

const cancelDeleteWarning = () => {
    showDeleteWarningDialog.value = false
    deleteWarningMessage.value = ''
}

const performDelete = async () => {
    if (!patient.value) return

    deleteLoading.value = true

    try {
        // Check if database is available
        if (!dbStore.canPerformOperations) {
            throw new Error('Database not available')
        }

        // Delete the patient using database store (cascade delete will handle visits/observations)
        await dbStore.deletePatient(patient.value.PATIENT_NUM)

        const patientName = getPatientName(patient.value)

        $q.notify({
            type: 'positive',
            message: `Patient ${patientName} deleted successfully`,
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

        // Clean up dialogs
        showDeleteDialog.value = false
        showDeleteWarningDialog.value = false
        deleteWarningMessage.value = ''
        patientDataSummary.value = ''

        // Small delay to ensure database operation completes
        await new Promise(resolve => setTimeout(resolve, 100))

        // Navigate back to patient search
        router.replace('/patients')

    } catch (error) {
        console.error('Error deleting patient:', error)
        $q.notify({
            type: 'negative',
            message: `Failed to delete patient: ${error.message}`,
            position: 'top',
            timeout: 5000
        })
    } finally {
        deleteLoading.value = false
    }
}

// Methods
const loadPatient = async () => {
    try {
        if (!dbStore.canPerformOperations) return

        // Try to find patient by code using the view method for resolved concepts
        const result = await dbStore.executeQuery(
            'SELECT * FROM patient_list WHERE PATIENT_CD = ?',
            [patientId]
        )

        if (result.success && result.data.length > 0) {
            patient.value = result.data[0]
            // Load visits and observations after patient is loaded
            await Promise.all([
                loadVisits(),
                loadObservations()
            ])
        } else {
            patient.value = null
        }
    } catch (error) {
        console.error('Failed to load patient:', error)
        $q.notify({
            type: 'negative',
            message: 'Failed to load patient details',
            position: 'top'
        })
    } finally {
        loading.value = false
    }
}

const loadVisits = async () => {
    try {
        if (!patient.value?.PATIENT_NUM) return

        const visitRepository = dbStore.getRepository('visit')
        visits.value = await visitRepository.getPatientVisitTimeline(patient.value.PATIENT_NUM)
    } catch (error) {
        console.error('Failed to load visits:', error)
        visits.value = []
    }
}

const loadObservations = async () => {
    try {
        if (!patient.value?.PATIENT_NUM) return

        const observationRepository = dbStore.getRepository('observation')
        observations.value = await observationRepository.getObservationsWithResolvedConcepts(patient.value.PATIENT_NUM)
    } catch (error) {
        console.error('Failed to load observations:', error)
        observations.value = []
    }
}

// Helper methods for header display
const getPatientName = (patient) => {
    if (patient.PATIENT_BLOB) {
        try {
            const blob = JSON.parse(patient.PATIENT_BLOB)
            if (blob.name) return blob.name
            if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
        } catch {
            // Fallback to PATIENT_CD
        }
    }
    return patient.PATIENT_CD || 'Unknown Patient'
}

const getPatientAge = (patient) => {
    if (patient.AGE_IN_YEARS) return `${patient.AGE_IN_YEARS} years`
    if (patient.BIRTH_DATE) {
        const birthYear = new Date(patient.BIRTH_DATE).getFullYear()
        const currentYear = new Date().getFullYear()
        return `${currentYear - birthYear} years`
    }
    return 'Age unknown'
}

const getPatientGender = (patient) => {
    if (patient.SEX_RESOLVED) {
        return patient.SEX_RESOLVED
    }
    return patient.SEX_CD || 'Unknown'
}

const goToPatientSearch = () => {
    console.log('Current route:', route.path)
    console.log('Attempting to navigate to: /patients')

    // Force a complete navigation to ensure we get to the right place
    router.replace('/patients').catch((error) => {
        console.error('Router replace failed:', error)
        // Direct window navigation as fallback
        window.location.replace('/patients')
    })
}

// Handle patient updates from child components
const onPatientUpdated = () => {
    loadPatient()
}

// Handle observation updates from observations tab
const onObservationsUpdated = async () => {
    // Reload both visits and observations since visits might have been created/updated
    await Promise.all([
        loadVisits(),
        loadObservations()
    ])
}

// Computed properties for tab labels
const observationsTabLabel = computed(() => {
    return `Observations (${observations.value.length} obs, ${visits.value.length} visits)`
})

// Initialize
onMounted(() => {
    loadPatient()
})
</script>

<style lang="scss" scoped>
.patient-header {
    background: linear-gradient(135deg, $primary 0%, $secondary 100%);
    color: white;
}

.full-height {
    height: 100%;
    display: flex;
    flex-direction: column;
}

// Ensure all cards in the row have the same height
.row.q-col-gutter-md {
    .col-12.col-md-4 {
        display: flex;

        .q-card {
            width: 100%;
        }
    }
}
</style>