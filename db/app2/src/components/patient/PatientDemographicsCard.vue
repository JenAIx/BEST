<template>
  <q-card class="full-height">
    <q-card-section class="full-height">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">{{ $t('patient.demographics') }}</div>
        <q-btn v-if="!editing" flat round dense icon="edit" color="primary" size="sm" @click="startEdit">
          <q-tooltip>{{ $t('patient.editDemographics') }}</q-tooltip>
        </q-btn>
        <div v-else class="row q-gutter-xs">
          <q-btn flat round dense icon="check" color="positive" size="sm" @click="save">
            <q-tooltip>{{ $t('user.saveChanges') }}</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="close" color="negative" size="sm" @click="cancelEdit">
            <q-tooltip>{{ $t('common.cancel') }}</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- View Mode -->
      <div v-if="!editing" class="info-list">
        <div class="info-row">
          <span class="info-label">{{ $t('patient.gender') }}</span>
          <span class="info-value">{{ getPatientGender(patient) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('patient.age') }}</span>
          <span class="info-value">{{ getPatientAge(patient) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('user.status') }}</span>
          <span class="info-value">
            <q-chip :color="getStatusColor(patient)" text-color="white" size="sm" class="q-ma-none">
              {{ getStatusLabel(patient) }}
            </q-chip>
          </span>
        </div>
        <div v-if="patient.BIRTH_DATE" class="info-row">
          <span class="info-label">{{ $t('patient.dateOfBirth') }}</span>
          <span class="info-value">{{ formatDate(patient.BIRTH_DATE) }}</span>
        </div>
        <div v-if="patient.DEATH_DATE" class="info-row">
          <span class="info-label">{{ $t('patient.deathDate') }}</span>
          <span class="info-value">{{ formatDate(patient.DEATH_DATE) }}</span>
        </div>
      </div>

      <!-- Edit Mode -->
      <div v-else class="q-gutter-md">
        <q-select v-model="editForm.gender" :options="genderOptions" :label="$t('patient.gender')" outlined dense emit-value map-options />
        <q-select v-model="editForm.status" :options="statusOptions" :label="$t('patient.vitalStatus')" outlined dense emit-value map-options />
        <q-input v-model="editForm.birthDate" label="Birth Date" outlined dense type="date" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['updated'])

const notify = useNotify()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('PatientDemographicsCard')

// State
const editing = ref(false)
const editForm = ref({
  gender: '',
  status: '',
  birthDate: '',
})

// Options
const genderOptions = ref([])
const statusOptions = ref([])

// Helper methods
const getPatientGender = (patient) => {
  if (patient.SEX_RESOLVED) {
    return patient.SEX_RESOLVED
  }
  return patient.SEX_CD || 'Unknown'
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

const getStatusColor = (patient) => {
  const statusCode = patient.VITAL_STATUS_CD
  if (!statusCode) return 'grey'

  // Use concept store for consistent color resolution
  const resolved = conceptStore.getResolved(statusCode)
  return resolved?.color || 'grey'
}

const getStatusLabel = (patient) => {
  const resolved = patient.VITAL_STATUS_RESOLVED
  const code = patient.VITAL_STATUS_CD

  // Prefer resolved text from database
  if (resolved) return resolved

  // Use concept store for fallback resolution
  const conceptResolved = conceptStore.getResolved(code)
  return conceptResolved?.label || conceptStore.getFallbackLabel(code) || 'Unknown'
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

// Load options from concept store
const loadOptions = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    await conceptStore.initialize()

    // Load options from concept store
    const [genderOpts, statusOpts] = await Promise.all([conceptStore.getConceptOptions('gender'), conceptStore.getConceptOptions('vital_status')])

    genderOptions.value = genderOpts
    statusOptions.value = statusOpts

    // Preload current patient's concepts for better display
    const conceptsToPreload = [props.patient.SEX_CD, props.patient.VITAL_STATUS_CD].filter(Boolean)

    if (conceptsToPreload.length > 0) {
      await conceptStore.resolveBatch(conceptsToPreload, { context: 'patient_demographics' })
    }
  } catch (error) {
    logger.error('Failed to load options', error)
    // Use fallback options from concept store - let the store handle all fallback logic
    genderOptions.value = conceptStore.getFallbackOptions('gender')
    statusOptions.value = conceptStore.getFallbackOptions('vital_status')
  }
}

// Edit methods
const startEdit = () => {
  // Find the current values in the options arrays to ensure proper selection
  const currentGender = props.patient.SEX_CD || ''
  const currentStatus = props.patient.VITAL_STATUS_CD || ''

  // Set form values - the options should have matching values
  editForm.value.gender = currentGender
  editForm.value.status = currentStatus
  editForm.value.birthDate = props.patient.BIRTH_DATE ? props.patient.BIRTH_DATE.split('T')[0] : ''

  editing.value = true
}

const cancelEdit = () => {
  editing.value = false
  editForm.value.gender = ''
  editForm.value.status = ''
  editForm.value.birthDate = ''
}

const save = async () => {
  try {
    const updates = {}
    if (editForm.value.gender !== props.patient.SEX_CD) {
      updates.SEX_CD = editForm.value.gender
    }
    if (editForm.value.status !== props.patient.VITAL_STATUS_CD) {
      updates.VITAL_STATUS_CD = editForm.value.status
    }
    if (editForm.value.birthDate !== (props.patient.BIRTH_DATE ? props.patient.BIRTH_DATE.split('T')[0] : '')) {
      updates.BIRTH_DATE = editForm.value.birthDate
    }

    if (Object.keys(updates).length > 0) {
      const updateQuery = `
                UPDATE PATIENT_DIMENSION
                SET ${Object.keys(updates)
                  .map((key) => `${key} = ?`)
                  .join(', ')},
                    UPDATE_DATE = datetime('now')
                WHERE PATIENT_NUM = ?
            `
      const values = [...Object.values(updates), props.patient.PATIENT_NUM]

      const result = await dbStore.executeQuery(updateQuery, values)

      if (result.success) {
        notify.success('Demographics updated successfully')
        emit('updated')
      } else {
        throw new Error('Update failed')
      }
    }

    editing.value = false
  } catch (error) {
    logger.error('Failed to save demographics', error)
    notify.error('Failed to update demographics')
  }
}

onMounted(() => {
  loadOptions()
})
</script>

<style lang="scss" scoped>
.full-height {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.info-label {
  flex: 0 0 auto;
  color: $grey-7;
  white-space: nowrap;
}

.info-value {
  flex: 1 1 auto;
  text-align: right;
  word-break: break-word;
}
</style>
