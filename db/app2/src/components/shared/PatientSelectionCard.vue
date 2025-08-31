<template>
  <q-card flat bordered class="patient-selection-card">
    <q-card-section>
      <div class="text-h6 q-mb-md">{{ title }}</div>
      <div class="text-body2 text-grey-6 q-mb-lg">{{ description }}</div>

      <!-- Patient Search/Selector -->
      <div class="patient-selection">
        <q-input
          v-model="patientSearch"
          :label="searchLabel"
          outlined
          dense
          clearable
          :placeholder="searchPlaceholder"
          @update:model-value="searchPatients"
          class="q-mb-md"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <!-- Patient List -->
        <q-list v-if="patients.length > 0" bordered separator class="q-mb-md">
          <q-item
            v-for="patient in patients"
            :key="patient.PATIENT_NUM"
            clickable
            v-ripple
            @click="selectPatient(patient)"
            :class="{ 'bg-blue-1': selectedPatient?.PATIENT_NUM === patient.PATIENT_NUM }"
          >
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white">
                {{ getPatientInitials(patient) }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ getPatientName(patient) }}</q-item-label>
              <q-item-label caption>ID: {{ patient.PATIENT_CD }}</q-item-label>
              <q-item-label caption>Age: {{ patient.AGE_IN_YEARS || 'N/A' }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- No Patients Found -->
        <div v-if="patientSearch && patients.length === 0" class="text-center q-pa-lg">
          <q-icon name="person_off" size="48px" color="grey-4" />
          <div class="text-subtitle1 text-grey-6 q-mt-sm">No patients found</div>
          <div class="text-body2 text-grey-5">Try a different search term</div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from '../../stores/database-store.js'
import { logger } from '../../core/services/logging-service.js'

defineProps({
  title: {
    type: String,
    default: 'Select Patient',
  },
  description: {
    type: String,
    default: 'Choose the patient for whom you want to proceed.',
  },
  searchLabel: {
    type: String,
    default: 'Search Patient',
  },
  searchPlaceholder: {
    type: String,
    default: 'Enter patient ID, name, or identifier...',
  },
  selectedPatient: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['patient-selected', 'patient-search'])

const $q = useQuasar()
const dbStore = useDatabaseStore()

// State
const patientSearch = ref('')
const patients = ref([])

// Methods
const searchPatients = async () => {
  if (!patientSearch.value || patientSearch.value.length < 2) {
    patients.value = []
    return
  }

  try {
    const result = await dbStore.executeQuery(
      `SELECT PATIENT_NUM, PATIENT_CD, PATIENT_BLOB, AGE_IN_YEARS
       FROM PATIENT_DIMENSION
       WHERE PATIENT_CD LIKE ? OR PATIENT_BLOB LIKE ?
       ORDER BY PATIENT_CD
       LIMIT 10`,
      [`%${patientSearch.value}%`, `%${patientSearch.value}%`],
    )

    if (result.success) {
      patients.value = result.data.map((patient) => {
        // Try to parse PATIENT_BLOB for additional info
        let additionalInfo = {}
        try {
          if (patient.PATIENT_BLOB) {
            additionalInfo = JSON.parse(patient.PATIENT_BLOB)
          }
        } catch {
          // Intentionally ignore JSON parsing errors for patient blob
          Promise.resolve().catch(() => {
            /* intentionally ignored */
          })
        }

        return {
          ...patient,
          ...additionalInfo,
        }
      })
    }

    emit('patient-search', { patients: patients.value, searchTerm: patientSearch.value })
  } catch (error) {
    logger.error('Failed to search patients', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to search patients',
    })
  }
}

const selectPatient = (patient) => {
  emit('patient-selected', patient)
}

const getPatientName = (patient) => {
  if (patient.name) return patient.name
  if (patient.firstName && patient.lastName) {
    return `${patient.firstName} ${patient.lastName}`
  }
  return patient.PATIENT_CD || 'Unknown Patient'
}

const getPatientInitials = (patient) => {
  const name = getPatientName(patient)
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Expose methods for parent component to use
defineExpose({
  searchPatients,
  getPatientName,
  getPatientInitials,
})
</script>

<style scoped>
.patient-selection-card {
  .patient-selection {
    max-width: 600px;
  }
}
</style>
