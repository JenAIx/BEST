<template>
  <q-page class="q-pa-md">
    <div v-if="loading" class="text-center q-py-xl">
      <q-spinner color="primary" size="48px" />
      <div class="text-grey-6 q-mt-md">{{ $t('patient.loadingDetails') }}</div>
    </div>

    <div v-else-if="patient">
      <!-- Patient Header -->
      <div class="row items-center justify-between q-mb-lg">
        <div class="row items-center q-gutter-md">
          <q-btn flat round icon="arrow_back" @click="goToPatientSearch" />
          <PatientAvatar :patient="patient" size="64px" />
          <div>
            <div class="text-h4">{{ getPatientName(patient) }}</div>
            <div class="text-caption text-grey-6">{{ patient.PATIENT_CD }} • {{ getPatientAge(patient) }} • {{ getPatientGender(patient) }}</div>
          </div>
        </div>

        <!-- Action Buttons and Study Enrollment -->
        <div class="column items-end q-gutter-xs">
          <!-- Study Enrollment Chips -->
          <div v-if="patientStudies.length > 0" class="row items-center q-gutter-xs study-enrollment-chips">
            <span class="text-caption text-grey-6 q-mr-xs">{{ $t('patient.enrolledIn') }}:</span>
            <q-chip v-for="study in patientStudies" :key="study.STUDY_NUM" :color="getStudyStatusColor(study.STATUS_CD)" text-color="white" clickable @click="goToStudy(study.STUDY_NUM)">
              {{ study.NAME_CHAR || study.STUDY_CD }}
              <q-tooltip>{{ $t('patient.goToStudyPage') }}</q-tooltip>
            </q-chip>
          </div>

          <!-- Delete Patient Button -->
          <q-btn color="negative" icon="delete" round outline @click="showDeleteConfirmation" :loading="deleteLoading">
            <q-tooltip>{{ $t('patient.deletePatientTooltip') }}</q-tooltip>
          </q-btn>
        </div>
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

      <!-- Visits and Observations Summary -->
      <q-card>
        <q-card-section>
          <PatientVisitsSummary />
        </q-card-section>
      </q-card>
    </div>

    <div v-else class="text-center q-py-xl">
      <q-icon name="person_off" size="64px" color="grey-5" />
      <div class="text-h6 text-grey-6 q-mt-md">Patient not found</div>
      <div class="text-body2 text-grey-6 q-mt-sm">The requested patient could not be found.</div>
      <q-btn color="primary" label="Back to Patient Search" @click="goToPatientSearch" class="q-mt-md" />
    </div>

    <!-- Delete Patient Dialog -->
    <DeletePatientDialog
      ref="deletePatientDialog"
      @deleted="onPatientDeleted"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from 'src/stores/database-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import PatientAvatar from '../components/shared/PatientAvatar.vue'
import PatientDemographicsCard from '../components/patient/PatientDemographicsCard.vue'
import PatientAdditionalInfoCard from '../components/patient/PatientAdditionalInfoCard.vue'
import PatientStatisticsCard from '../components/patient/PatientStatisticsCard.vue'
import PatientVisitsSummary from '../components/patient/PatientVisitsSummary.vue'
import DeletePatientDialog from '../components/patient/DeletePatientDialog.vue'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const notify = useNotify()
const dbStore = useDatabaseStore()
const visitStore = useVisitStore()
const observationStore = useObservationStore()

// State
const loading = ref(true)
const patient = ref(null)
const patientStudies = ref([])
const loadingStudies = ref(false)

// Computed properties from stores
const visits = computed(() => visitStore.visits)
const observations = computed(() => observationStore.allObservations) // Use all observations for statistics

// Delete functionality state
const deleteLoading = ref(false)
const deletePatientDialog = ref(null)

// Get patient ID from route params
const patientId = route.params.patientId

// Delete Methods
const showDeleteConfirmation = () => {
  if (!patient.value) return
  
  if (deletePatientDialog.value) {
    const patientName = getPatientName(patient.value)
    deletePatientDialog.value.show(patient.value, patientName)
  }
}

const onPatientDeleted = async () => {
  // Small delay to ensure database operation completes
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Navigate back to patient search
  router.replace('/patients')
}

// Methods
const loadPatient = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    // Initialize service with Quasar instance
    visitObservationService.initialize($q)

    // Load patient with all data using the service
    const loadedPatient = await visitObservationService.loadPatientWithData(patientId)

    if (loadedPatient) {
      // Get the raw patient data for the UI
      patient.value = loadedPatient.rawData || loadedPatient

      // Load patient's studies
      await loadPatientStudies()
    } else {
      patient.value = null
    }
  } catch (error) {
    console.error('Failed to load patient:', error)
    notify.error('Failed to load patient details')
  } finally {
    loading.value = false
  }
}

// Helper methods for header display
const getPatientName = (patient) => {
  if (!patient) return 'Unknown Patient'
  
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

const loadPatientStudies = async () => {
  if (!patient.value?.PATIENT_NUM) return

  try {
    loadingStudies.value = true
    if (!dbStore.canPerformOperations) return

    const studyRepo = dbStore.getRepository('study')
    const studies = await studyRepo.getPatientStudies(patient.value.PATIENT_NUM)

    patientStudies.value = studies || []
  } catch (error) {
    console.error('Failed to load patient studies:', error)
    patientStudies.value = []
  } finally {
    loadingStudies.value = false
  }
}

const goToStudy = (studyId) => {
  router.push(`/studies/${studyId}`)
}

const getStudyStatusColor = (status) => {
  const colors = {
    active: 'positive',
    planning: 'info',
    completed: 'secondary',
    paused: 'warning',
    cancelled: 'negative',
  }
  return colors[status] || 'grey'
}

// Handle patient updates from child components
const onPatientUpdated = () => {
  loadPatient()
}

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

// Move study enrollment chips up
.study-enrollment-chips {
  margin-top: -60px;
}
</style>
