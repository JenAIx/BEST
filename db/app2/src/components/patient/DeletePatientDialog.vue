<template>
  <div>
    <!-- Initial Delete Confirmation Dialog -->
    <AppDialog
      v-model="showDeleteConfirmDialog"
      :title="deleteDialogTitle"
      :message="deleteDialogMessage"
      size="md"
      persistent
      ok-label="Delete"
      ok-color="negative"
      cancel-label="Cancel"
      @ok="onDeleteConfirmed"
      @cancel="onDeleteCancelled"
    />

    <!-- Warning Dialog for Patients with Data -->
    <AppDialog
      v-model="showDeleteWarningDialog"
      title="Patient Has Data"
      :message="deleteWarningMessage"
      size="md"
      persistent
      ok-label="Delete All"
      ok-color="negative"
      cancel-label="Cancel"
      @ok="onDeleteWarningConfirmed"
      @cancel="onDeleteWarningCancelled"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from 'src/stores/database-store'
import AppDialog from 'src/components/shared/AppDialog.vue'

const emit = defineEmits(['deleted', 'cancel'])

const $q = useQuasar()

const notify = useNotify()
const dbStore = useDatabaseStore()

// State
const showDeleteConfirmDialog = ref(false)
const showDeleteWarningDialog = ref(false)
const deleteDialogTitle = ref('')
const deleteDialogMessage = ref('')
const deleteWarningMessage = ref('')
const currentPatient = ref(null)
const currentPatientName = ref('')

// Methods
const show = (patient, patientName = '') => {
  if (!patient) return

  // Store patient locally
  currentPatient.value = patient
  currentPatientName.value = patientName || patient.PATIENT_CD

  const displayName = patientName || patient.PATIENT_CD

  // Set up first confirmation dialog
  deleteDialogTitle.value = 'Delete Patient'
  deleteDialogMessage.value = `Are you sure you want to delete patient <strong>${displayName}</strong> (${patient.PATIENT_CD})?`

  // Show first confirmation dialog
  showDeleteConfirmDialog.value = true
}

const onDeleteConfirmed = async () => {
  if (!currentPatient.value) return

  try {
    // Check if database is available
    if (!dbStore.canPerformOperations) {
      throw new Error('Database not available')
    }

    // Get patient statistics to check for data
    const visitRepo = dbStore.getRepository('visit')
    const observationRepo = dbStore.getRepository('observation')

    let hasData = false
    let dataDescription = ''

    if (visitRepo && observationRepo) {
      const [visits, observations] = await Promise.all([
        visitRepo.findByPatientNum(currentPatient.value.PATIENT_NUM),
        observationRepo.findByPatientNum(currentPatient.value.PATIENT_NUM),
      ])

      const visitCount = visits?.length || 0
      const observationCount = observations?.length || 0

      if (visitCount > 0 || observationCount > 0) {
        hasData = true

        const parts = []
        if (visitCount > 0) parts.push(`${visitCount} visit${visitCount > 1 ? 's' : ''}`)
        if (observationCount > 0) parts.push(`${observationCount} observation${observationCount > 1 ? 's' : ''}`)
        dataDescription = parts.join(' and ')
      }
    }

    if (hasData) {
      // Show warning dialog
      deleteWarningMessage.value = `This patient has ${dataDescription}. All of this data will be permanently deleted. This action cannot be undone.`
      showDeleteWarningDialog.value = true
    } else {
      // No data, proceed with deletion
      await performDeletePatient()
    }
  } catch (error) {
    console.error('Error checking patient data:', error)
    // Proceed with deletion anyway
    await performDeletePatient()
  }
}

const onDeleteCancelled = () => {
  emit('cancel')
}

const onDeleteWarningConfirmed = async () => {
  await performDeletePatient()
}

const onDeleteWarningCancelled = () => {
  emit('cancel')
}

// Perform the actual patient deletion
const performDeletePatient = async () => {
  if (!currentPatient.value) return

  const loadingDialog = $q.dialog({
    title: 'Deleting Patient',
    message: 'Please wait while the patient is being deleted...',
    progress: true,
    persistent: true,
    ok: false,
    cancel: false,
  })

  try {
    // Check if database is available
    if (!dbStore.canPerformOperations) {
      throw new Error('Database not available')
    }

    // Delete the patient using database store (cascade delete will handle visits/observations)
    await dbStore.deletePatient(currentPatient.value.PATIENT_NUM)

    loadingDialog.hide()

    notify.success(`Patient ${currentPatient.value.PATIENT_CD} deleted successfully!`, { timeout: 3000 })

    // Clean up state
    showDeleteConfirmDialog.value = false
    showDeleteWarningDialog.value = false

    // Small delay to ensure database operation completes
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Emit success event
    emit('deleted', currentPatient.value)
  } catch (error) {
    loadingDialog.hide()
    console.error('Error deleting patient:', error)

    // Clean up state on error
    showDeleteConfirmDialog.value = false
    showDeleteWarningDialog.value = false

    notify.error(`Failed to delete patient: ${error.message}`, {
      timeout: 5000,
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

    emit('cancel')
  }
}

// Expose methods for parent component
defineExpose({
  show,
})
</script>

