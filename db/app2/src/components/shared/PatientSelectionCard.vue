<template>
  <q-card flat bordered class="patient-selection-card">
    <q-card-section>
      <div v-if="title" class="row items-center q-mb-xs">
        <q-icon name="person_search" size="20px" color="primary" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-medium">{{ title }}</div>
      </div>
      <div v-if="description" class="text-caption text-grey-6 q-mb-md">{{ description }}</div>

      <!-- Patient Search/Selector -->
      <q-input
        v-model="patientSearch"
        :label="searchLabel || $t('patient.patientSearch')"
        outlined
        dense
        clearable
        :placeholder="searchPlaceholder || $t('visits.searchPatientPlaceholder')"
        @update:model-value="searchPatients"
      >
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
      </q-input>

      <!-- Quick scope toggle: all available (own + public) vs. only assigned to me -->
      <div class="row justify-end q-mb-sm">
        <q-toggle v-model="onlyMine" :label="$t('visits.onlyMyPatients')" size="sm" dense color="primary" left-label class="text-grey-7">
          <q-tooltip>{{ $t('visits.onlyMyPatientsHint') }}</q-tooltip>
        </q-toggle>
      </div>

      <!-- Recent Patients (shown when not searching) -->
      <div v-if="!patientSearch && visibleRecentPatients.length > 0">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          <q-icon name="history" size="16px" class="q-mr-xs" />
          {{ $t('visit.recentPatients') }}
        </div>
        <div class="patient-cards-grid">
          <PatientCard v-for="patient in visibleRecentPatients" :key="patient.id" :patient="patient" :selected="isSelected(patient)" @select="selectPatient" @changed="loadRecentPatients" />
        </div>
      </div>

      <!-- Search Results -->
      <div v-if="patientSearch && patients.length > 0">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          <q-icon name="search" size="16px" class="q-mr-xs" />
          {{ $t('visit.searchResults', { count: patients.length }) }}
        </div>
        <div class="patient-cards-grid">
          <PatientCard v-for="patient in patients" :key="patient.id" :patient="patient" :selected="isSelected(patient)" @select="selectPatient" @changed="searchPatients" />
        </div>
      </div>

      <!-- No Search Results -->
      <div v-if="patientSearch && patients.length === 0" class="text-center q-pa-lg">
        <q-icon name="person_off" size="48px" color="grey-4" />
        <div class="text-subtitle1 text-grey-6 q-mt-sm">{{ $t('visit.noPatientsFound') }}</div>
        <div class="text-body2 text-grey-5">{{ $t('visit.tryDifferentSearch') }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from '../../stores/database-store.js'
import { useLocalSettingsStore } from '../../stores/local-settings-store.js'
import { logger } from '../../core/services/logging-service.js'
import PatientCard from './PatientCard.vue'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  searchLabel: {
    type: String,
    default: '', // falls back to $t('patient.patientSearch')
  },
  searchPlaceholder: {
    type: String,
    default: '', // falls back to $t('visits.searchPatientPlaceholder')
  },
  selectedPatient: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['patient-selected', 'patient-search'])

const notify = useNotify()
const dbStore = useDatabaseStore()
const localSettings = useLocalSettingsStore()

// State
const patientSearch = ref('')
const patients = ref([])
const recentPatients = ref([])
const onlyMine = ref(false)
const myPatientNums = ref(null) // Set<PATIENT_NUM> | null (lazy)

// PATIENT_NUMs directly assigned to the current user (creator or manual grant)
const ensureMyPatientNums = async () => {
  if (myPatientNums.value) return myPatientNums.value
  let nums = []
  try {
    const { useAuthStore } = await import('../../stores/auth-store.js')
    const currentUserId = useAuthStore().currentUser?.USER_ID
    if (currentUserId !== undefined && currentUserId !== null) {
      nums = await dbStore.getRepository('userPatientLookup').getPatientNumsAssignedTo(currentUserId)
    }
  } catch (error) {
    logger.warn('Failed to resolve own patients for scope toggle', error)
  }
  myPatientNums.value = new Set(nums)
  return myPatientNums.value
}

const visibleRecentPatients = computed(() => {
  if (!onlyMine.value || !myPatientNums.value) return recentPatients.value
  return recentPatients.value.filter((p) => myPatientNums.value.has(p.PATIENT_NUM))
})

watch(onlyMine, async (active) => {
  if (active) await ensureMyPatientNums()
  if (patientSearch.value) await searchPatients()
})

// Methods
const searchPatients = async () => {
  if (!patientSearch.value || patientSearch.value.length < 2) {
    patients.value = []
    return
  }

  try {
    // Access-controlled search (regular users only see their own/public patients)
    const criteria = { searchTerm: patientSearch.value }

    // "Only my patients": prefilter by direct assignments
    if (onlyMine.value) {
      const mine = await ensureMyPatientNums()
      if (mine.size === 0) {
        patients.value = []
        emit('patient-search', { patients: [], searchTerm: patientSearch.value })
        return
      }
      criteria.patientNums = Array.from(mine)
    }

    const result = await dbStore.getPatientsPaginated(1, 10, criteria)
    const rows = result.patients || []
    const accessMap = await dbStore.getPatientAccessInfo(rows.map((p) => p.PATIENT_NUM))

    patients.value = rows.map((patient) => {
      // Try to parse PATIENT_BLOB for additional info
      let additionalInfo = {}
      try {
        if (patient.PATIENT_BLOB) {
          additionalInfo = JSON.parse(patient.PATIENT_BLOB)
        }
      } catch {
        // Intentionally ignore JSON parsing errors for patient blob
      }

      // Raw DB fields stay on the object (consumers rely on PATIENT_NUM /
      // PATIENT_CD); card display fields are layered on top.
      const merged = { ...patient, ...additionalInfo }
      const access = accessMap.get(patient.PATIENT_NUM)
      return {
        ...merged,
        id: patient.PATIENT_CD,
        name: getPatientName(merged),
        age: patient.AGE_IN_YEARS ?? null,
        owner: access?.ownerUserCd || null,
        isPublic: access?.isPublic || false,
      }
    })

    emit('patient-search', { patients: patients.value, searchTerm: patientSearch.value })
  } catch (error) {
    logger.error('Failed to search patients', error)
    notify.error('Failed to search patients')
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
      const patientDetails = await Promise.all(
        recent.slice(0, 5).map(async (patientId) => {
          try {
            // Access-controlled: inaccessible recents drop out instead of rendering
            const patient = await dbStore.getAccessiblePatientByCode(patientId)
            if (patient) {
              const lastVisitDate = await getLastVisitDate(patient.PATIENT_NUM)
              return {
                id: patient.PATIENT_CD,
                name: getPatientName(patient),
                age: patient.AGE_IN_YEARS ?? null,
                gender: patient.SEX_RESOLVED || patient.SEX_CD,
                lastVisit: lastVisitDate ? formatDate(lastVisitDate) : null,
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
      const accessible = patientDetails.filter((p) => p !== null)
      const accessMap = await dbStore.getPatientAccessInfo(accessible.map((p) => p.PATIENT_NUM))
      recentPatients.value = accessible.map((p) => ({
        ...p,
        owner: accessMap.get(p.PATIENT_NUM)?.ownerUserCd || null,
        isPublic: accessMap.get(p.PATIENT_NUM)?.isPublic || false,
      }))
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

// Selected highlight — the selectedPatient prop may carry a raw DB row or a
// card-shaped object, so compare on PATIENT_NUM first, then code/id.
const isSelected = (patient) => {
  const sel = props.selectedPatient
  if (!sel) return false
  if (sel.PATIENT_NUM != null && patient.PATIENT_NUM != null) return sel.PATIENT_NUM === patient.PATIENT_NUM
  return (sel.PATIENT_CD || sel.id) === (patient.PATIENT_CD || patient.id)
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

<style lang="scss" scoped>
.patient-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .patient-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
