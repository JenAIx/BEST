<template>
  <q-card flat bordered class="patient-selection-card">
    <q-card-section>
      <div class="text-h6 q-mb-md">{{ title }}</div>
      <div class="text-body2 text-grey-6 q-mb-lg">{{ description }}</div>

      <!-- Patient Search/Selector -->
      <div class="patient-selection">
        <q-input v-model="patientSearch" :label="searchLabel" outlined dense clearable :placeholder="searchPlaceholder" @update:model-value="searchPatients" class="q-mb-md">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <!-- Recent Patients (shown when not searching) -->
        <div v-if="!patientSearch && recentPatients.length > 0" class="recent-patients-section q-mb-md">
          <div class="text-subtitle2 text-grey-7 q-mb-sm">
            <q-icon name="history" size="16px" class="q-mr-xs" />
            Recent Patients
          </div>
          <div class="recent-patients-grid">
            <div v-for="patient in recentPatients" :key="patient.id" class="recent-patient-card q-mb-sm">
              <q-card flat bordered clickable @click="selectPatient(patient)" class="cursor-pointer" :class="{ 'bg-blue-1': selectedPatient?.PATIENT_CD === patient.id }">
                <q-card-section class="row items-center q-pa-md">
                  <q-avatar color="primary" text-color="white" size="32px" class="q-mr-md">
                    {{ getPatientInitials(patient) }}
                  </q-avatar>
                  <div class="col">
                    <div class="text-body1 text-weight-medium">{{ patient.name }}</div>
                    <div class="text-caption text-grey-6">
                      ID: {{ patient.id }}
                      <span v-if="patient.visitCount"> • {{ patient.visitCount }} visits</span>
                      <span v-if="patient.lastVisit"> • Last: {{ formatDate(patient.lastVisit) }}</span>
                    </div>
                  </div>
                  <q-icon name="chevron_right" color="grey-5" />
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>

        <!-- Search Results -->
        <q-list v-if="patientSearch && patients.length > 0" bordered separator class="q-mb-md">
          <div class="text-subtitle2 text-grey-7 q-mb-sm q-pa-md">
            <q-icon name="search" size="16px" class="q-mr-xs" />
            Search Results ({{ patients.length }})
          </div>
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

        <!-- No Search Results -->
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
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from '../../stores/database-store.js'
import { useLocalSettingsStore } from '../../stores/local-settings-store.js'
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
const localSettings = useLocalSettingsStore()

// State
const patientSearch = ref('')
const patients = ref([])
const recentPatients = ref([])

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
  // Add to recent patients (using the same storage as VisitsPage)
  const recent = localSettings.getSetting('visits.recentPatients') || []
  const patientId = patient.PATIENT_CD || patient.id
  const updatedRecent = [patientId, ...recent.filter((id) => id !== patientId)].slice(0, 10)
  localSettings.setSetting('visits.recentPatients', updatedRecent)

  logger.info('Patient selected for import', {
    patientId: patientId,
    patientName: getPatientName(patient),
    addedToRecents: true,
  })

  emit('patient-selected', patient)
}

// Recent patients functionality
const loadRecentPatients = async () => {
  try {
    const recent = localSettings.getSetting('visits.recentPatients') || []

    if (recent.length > 0 && dbStore.canPerformOperations) {
      const patientRepo = dbStore.getRepository('patient')
      const patientDetails = await Promise.all(
        recent.slice(0, 5).map(async (patientId) => {
          try {
            const patient = await patientRepo.findByPatientCode(patientId)
            if (patient) {
              const lastVisitDate = await getLastVisitDate(patient.PATIENT_NUM)
              return {
                id: patient.PATIENT_CD,
                name: getPatientName(patient),
                age: patient.AGE_IN_YEARS,
                gender: patient.SEX_RESOLVED || patient.SEX_CD,
                lastVisit: lastVisitDate,
                visitCount: await getVisitCount(patient.PATIENT_NUM),
                PATIENT_NUM: patient.PATIENT_NUM,
                PATIENT_CD: patient.PATIENT_CD,
              }
            }
          } catch (error) {
            logger.warn('Failed to load recent patient', { patientId, error })
          }
          return null
        }),
      )
      recentPatients.value = patientDetails.filter((p) => p !== null)
    }
  } catch (error) {
    logger.error('Failed to load recent patients', error)
  }
}

// Helper functions
const getVisitCount = async (patientNum) => {
  try {
    const result = await dbStore.executeQuery('SELECT COUNT(*) as count FROM VISIT_DIMENSION WHERE PATIENT_NUM = ?', [patientNum])
    return result.success ? result.data[0].count : 0
  } catch (error) {
    logger.warn('Failed to get visit count', { patientNum, error })
    return 0
  }
}

const getLastVisitDate = async (patientNum) => {
  try {
    const result = await dbStore.executeQuery('SELECT START_DATE FROM VISIT_DIMENSION WHERE PATIENT_NUM = ? ORDER BY START_DATE DESC LIMIT 1', [patientNum])
    return result.success && result.data.length > 0 ? result.data[0].START_DATE : null
  } catch (error) {
    logger.warn('Failed to get last visit date', { patientNum, error })
    return null
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return 'Invalid date'
  }
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

// Load recent patients on mount
onMounted(() => {
  loadRecentPatients()
})

// Expose methods for parent component to use
defineExpose({
  searchPatients,
  getPatientName,
  getPatientInitials,
  loadRecentPatients,
})
</script>

<style scoped>
.patient-selection-card {
  .patient-selection {
    max-width: 600px;
  }

  .recent-patients-section {
    .recent-patients-grid {
      .recent-patient-card {
        .q-card {
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 8px;
          transition: all 0.2s ease;

          &:hover {
            border-color: #1976d2;
            box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
          }

          &.bg-blue-1 {
            border-color: #1976d2;
            background-color: rgba(25, 118, 210, 0.04);
          }
        }
      }
    }
  }
}
</style>
