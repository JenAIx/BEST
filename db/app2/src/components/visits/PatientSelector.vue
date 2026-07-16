<template>
  <div class="patient-selection-container">
    <PageHeader :title="$t('navigation.patientVisits')" :subtitle="$t('visits.selectPatientHint')" class="full-width" />

    <q-card class="selection-card" flat bordered>
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="text-h6">
            <q-icon name="person_search" class="q-mr-sm" />
            {{ $t('visits.findPatient') }}
          </div>
          <q-btn color="primary" icon="person_add" :label="$t('patient.addPatient')" @click="showCreateDialog = true" unelevated />
        </div>

        <!-- Search Input -->
        <q-input v-model="searchQuery" :placeholder="$t('visits.searchPatientPlaceholder')" outlined dense @update:model-value="onSearchInput" :loading="searchLoading" debounce="300">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-icon v-if="searchQuery" name="close" @click="clearSearch" class="cursor-pointer q-mr-sm" />
            <q-btn flat round dense icon="tune" :color="hasActiveFilters ? 'primary' : ''" @click="showAdvancedFilters = !showAdvancedFilters">
              <q-tooltip>{{ $t('visits.advancedFilters') }}</q-tooltip>
            </q-btn>
          </template>
        </q-input>

        <!-- Quick scope toggle: all available (own + public) vs. only assigned to me -->
        <div class="row justify-end q-mt-xs">
          <q-toggle v-model="filters.onlyMine" :label="$t('visits.onlyMyPatients')" size="sm" dense color="primary" left-label class="text-grey-7">
            <q-tooltip>{{ $t('visits.onlyMyPatientsHint') }}</q-tooltip>
          </q-toggle>
        </div>

        <!-- Advanced Filters -->
        <q-slide-transition>
          <div v-show="showAdvancedFilters" class="q-mt-md q-pa-md bg-grey-1 rounded-borders">
            <div class="text-subtitle2 q-mb-md">{{ $t('visits.advancedFilters') }}</div>
            <div class="row q-col-gutter-md">
              <div class="col-12">
                <q-range v-model="filters.ageRange" :min="0" :max="120" label label-always color="primary" />
                <div class="text-caption text-grey-6">{{ $t('patient.age') }}: {{ filters.ageRange.min }} - {{ filters.ageRange.max }}</div>
              </div>
              <div class="col-12 col-sm-6">
                <q-select v-model="filters.sex" :options="sexOptions" :label="$t('patient.gender')" outlined dense clearable emit-value map-options />
              </div>
              <div class="col-12 col-sm-6">
                <q-select v-model="filters.vitalStatus" :options="vitalStatusOptions" :label="$t('patient.vitalStatus')" outlined dense clearable emit-value map-options />
              </div>
              <div class="col-12 col-sm-6">
                <q-select v-model="filters.studies" :options="studyOptions" :label="$t('study.studies')" outlined dense clearable multiple emit-value map-options :loading="loadingStudies" />
              </div>
              <div class="col-12 col-sm-6">
                <q-select v-model="filters.createdBy" :options="userOptions" :label="$t('visits.filterByCreator')" outlined dense clearable emit-value map-options :loading="loadingUsers" />
              </div>
            </div>
            <div class="row justify-end q-mt-md">
              <q-btn flat :label="$t('common.cancel')" @click="resetFilters" />
            </div>
          </div>
        </q-slide-transition>
      </q-card-section>

      <!-- Recent Patients (history) or fallback to latest added -->
      <q-card-section v-if="!isSearchActive && recentPatients.length > 0">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          <q-icon :name="recentPatientsSource === 'latest' ? 'fiber_new' : 'history'" size="16px" class="q-mr-xs" />
          {{ recentPatientsSource === 'latest' ? $t('visit.latestPatients') : $t('visit.recentPatients') }}
        </div>
        <div class="recent-patients-grid">
          <PatientCard v-for="patient in recentPatients" :key="patient.id" :patient="patient" @select="selectPatient" @changed="onPatientChanged" />
        </div>
      </q-card-section>

      <!-- Search Results -->
      <q-card-section v-if="isSearchActive && searchResults.length > 0">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          <q-icon name="search" size="16px" class="q-mr-xs" />
          {{ $t('visit.searchResults', { count: searchResults.length }) }}
        </div>
        <div class="search-results">
          <PatientCard v-for="patient in searchResults" :key="patient.id" :patient="patient" @select="selectPatient" @changed="onPatientChanged" />
        </div>
      </q-card-section>

      <!-- No Results -->
      <q-card-section v-if="isSearchActive && searchResults.length === 0 && !searchLoading">
        <div class="no-results">
          <q-icon name="search_off" size="48px" color="grey-4" />
          <div class="text-h6 text-grey-6 q-mt-sm">{{ $t('visit.noPatientsFound') }}</div>
          <div class="text-body2 text-grey-5">{{ $t('visit.tryDifferentSearch') }}</div>
        </div>
      </q-card-section>

      <!-- Loading State -->
      <q-card-section v-if="searchLoading">
        <div class="loading-state">
          <q-spinner-dots size="40px" color="primary" />
          <div class="text-body2 text-grey-6 q-mt-sm">{{ $t('visit.searchingPatients') }}</div>
        </div>
      </q-card-section>

      <!-- Patient counts footer -->
      <q-separator />
      <q-card-section class="patient-stats-footer">
        <span>
          <q-icon name="groups" size="14px" />
          {{ $t('visits.statsAvailable', { n: patientStats.total }) }}
        </span>
        <span>
          <q-icon name="public" size="14px" />
          {{ $t('visits.statsPublic', { n: patientStats.publicCount }) }}
        </span>
        <span>
          <q-icon name="person" size="14px" />
          {{ $t('visits.statsMine', { n: patientStats.mine }) }}
        </span>
      </q-card-section>
    </q-card>

    <CreatePatientDialog v-model="showCreateDialog" @patient-created="onPatientCreated" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useStudyStore } from 'src/stores/study-store'
import PatientCard from 'src/components/shared/PatientCard.vue'
import PageHeader from 'src/components/shared/PageHeader.vue'
import CreatePatientDialog from 'src/components/patient/CreatePatientDialog.vue'
import { useRouter } from 'vue-router'

const emit = defineEmits(['patient-selected'])

const dbStore = useDatabaseStore()
const localSettings = useLocalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('PatientSelector')
const conceptStore = useConceptResolutionStore()
const studyStore = useStudyStore()
const router = useRouter()

// State
const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref([])
const recentPatients = ref([])
const recentPatientsSource = ref('history')
const showCreateDialog = ref(false)
const showAdvancedFilters = ref(false)

const DEFAULT_AGE_RANGE = { min: 0, max: 120 }
const filters = ref({
  sex: null,
  vitalStatus: null,
  ageRange: { ...DEFAULT_AGE_RANGE },
  studies: [],
  createdBy: null,
  onlyMine: false,
})

// Filter option lists
const sexOptions = ref([])
const vitalStatusOptions = ref([])
const studyOptions = ref([])
const loadingStudies = ref(false)
const userOptions = ref([])
const loadingUsers = ref(false)
const patientStats = ref({ total: 0, publicCount: 0, mine: 0 })

const hasActiveFilters = computed(() =>
  !!filters.value.sex ||
  !!filters.value.vitalStatus ||
  filters.value.ageRange.min !== DEFAULT_AGE_RANGE.min ||
  filters.value.ageRange.max !== DEFAULT_AGE_RANGE.max ||
  (filters.value.studies && filters.value.studies.length > 0) ||
  filters.value.createdBy !== null ||
  filters.value.onlyMine,
)

const isSearchActive = computed(() => !!searchQuery.value || hasActiveFilters.value)

// Methods
const mapPatientForCard = async (patient, access = null, studies = []) => ({
  id: patient.PATIENT_CD,
  PATIENT_NUM: patient.PATIENT_NUM,
  name: getPatientName(patient),
  age: patient.AGE_IN_YEARS,
  gender: patient.SEX_RESOLVED || patient.SEX_CD,
  lastVisit: await getLastVisitDate(patient.PATIENT_NUM),
  visitCount: await getVisitCount(patient.PATIENT_NUM),
  owner: access?.ownerUserCd || null,
  isPublic: access?.isPublic || false,
  studies,
})

const loadPatientCardMaps = async (patients) => {
  const patientNums = patients.map((p) => p.PATIENT_NUM)
  const [accessMap, studyMap] = await Promise.all([dbStore.getPatientAccessInfo(patientNums), dbStore.getPatientStudyInfo(patientNums)])
  return { accessMap, studyMap }
}

const loadLatestAddedPatients = async () => {
  const result = await dbStore.getPatientsPaginated(1, 3, {
    options: {
      orderBy: 'IMPORT_DATE',
      orderDirection: 'DESC',
    },
  })
  const patients = result.patients || []
  const { accessMap, studyMap } = await loadPatientCardMaps(patients)
  return await Promise.all(patients.map((p) => mapPatientForCard(p, accessMap.get(p.PATIENT_NUM), studyMap.get(p.PATIENT_NUM) || [])))
}

const loadRecentPatients = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const recent = localSettings.getSetting('visits.recentPatients') || []

    if (recent.length > 0) {
      // Access-controlled lookup: entries the current user may not see
      // (e.g. left over from an admin session) drop out here instead of
      // rendering cards whose click would then be denied.
      const patientDetails = await Promise.all(
        recent.slice(0, 5).map(async (patientId) => {
          try {
            return await dbStore.getAccessiblePatientByCode(patientId)
          } catch (error) {
            logger.warn('Failed to load recent patient', { patientId, error })
            return null
          }
        }),
      )
      const accessible = patientDetails.filter((p) => p !== null)
      if (accessible.length > 0) {
        const { accessMap, studyMap } = await loadPatientCardMaps(accessible)
        recentPatients.value = await Promise.all(accessible.map((p) => mapPatientForCard(p, accessMap.get(p.PATIENT_NUM), studyMap.get(p.PATIENT_NUM) || [])))
        recentPatientsSource.value = 'history'
        return
      }
    }

    // No (accessible) history yet — fall back to the most recently added patients
    recentPatients.value = await loadLatestAddedPatients()
    recentPatientsSource.value = 'latest'
  } catch (error) {
    logger.error('Failed to load recent patients', error)
  }
}

const buildSearchCriteria = () => {
  const criteria = {}
  const term = searchQuery.value?.trim()
  if (term) criteria.searchTerm = term
  if (filters.value.sex) criteria.SEX_CD = filters.value.sex
  if (filters.value.vitalStatus) criteria.VITAL_STATUS_CD = filters.value.vitalStatus
  if (
    filters.value.ageRange.min !== DEFAULT_AGE_RANGE.min ||
    filters.value.ageRange.max !== DEFAULT_AGE_RANGE.max
  ) {
    criteria.ageRange = { min: filters.value.ageRange.min, max: filters.value.ageRange.max }
  }
  return criteria
}

const runSearch = async () => {
  if (!isSearchActive.value) {
    searchResults.value = []
    return
  }

  try {
    searchLoading.value = true

    if (!dbStore.canPerformOperations) {
      throw new Error('Database not ready')
    }

    let enrolledPatientNums = null
    if (filters.value.studies && filters.value.studies.length > 0) {
      enrolledPatientNums = new Set()
      const studyRepo = dbStore.getRepository('study')
      for (const studyId of filters.value.studies) {
        try {
          const enrolled = await studyRepo.getEnrolledPatients(studyId)
          enrolled.forEach((p) => enrolledPatientNums.add(p.PATIENT_NUM))
        } catch (error) {
          logger.warn('Failed to resolve study enrolment', { studyId, error })
        }
      }
      if (enrolledPatientNums.size === 0) {
        searchResults.value = []
        return
      }
    }

    // Creator filter: resolve the patients created by the selected user
    // (same PATIENT_NUM-prefilter pattern as the study filter above)
    let patientNumFilter = enrolledPatientNums
    if (filters.value.createdBy !== null && filters.value.createdBy !== undefined) {
      const lookupRepo = dbStore.getRepository('userPatientLookup')
      const createdNums = new Set(await lookupRepo.getPatientNumsCreatedBy(filters.value.createdBy))
      patientNumFilter = patientNumFilter ? new Set([...patientNumFilter].filter((num) => createdNums.has(num))) : createdNums
      if (patientNumFilter.size === 0) {
        searchResults.value = []
        return
      }
    }

    // "Only my patients": direct assignments to the current user (created by
    // or granted to them) — public visibility alone doesn't qualify
    if (filters.value.onlyMine) {
      const { useAuthStore } = await import('src/stores/auth-store')
      const currentUserId = useAuthStore().currentUser?.USER_ID
      if (currentUserId !== undefined && currentUserId !== null) {
        const lookupRepo = dbStore.getRepository('userPatientLookup')
        const mineNums = new Set(await lookupRepo.getPatientNumsAssignedTo(currentUserId))
        patientNumFilter = patientNumFilter ? new Set([...patientNumFilter].filter((num) => mineNums.has(num))) : mineNums
        if (patientNumFilter.size === 0) {
          searchResults.value = []
          return
        }
      }
    }

    const criteria = buildSearchCriteria()
    if (patientNumFilter && patientNumFilter.size > 0) {
      criteria.patientNums = Array.from(patientNumFilter)
    }

    const result = await dbStore.getPatientsPaginated(1, 25, criteria)

    const patients = result.patients || []
    const { accessMap, studyMap } = await loadPatientCardMaps(patients)

    const enhanced = await Promise.all(
      patients.map(async (patient) => {
        const visitCount = await getVisitCount(patient.PATIENT_NUM)
        const access = accessMap.get(patient.PATIENT_NUM)
        return {
          id: patient.PATIENT_CD,
          PATIENT_NUM: patient.PATIENT_NUM,
          name: getPatientName(patient),
          age: patient.AGE_IN_YEARS,
          gender: patient.SEX_RESOLVED || patient.SEX_CD,
          visitCount,
          lastVisit: visitCount > 0 ? await getLastVisitDate(patient.PATIENT_NUM) : null,
          owner: access?.ownerUserCd || null,
          isPublic: access?.isPublic || false,
          studies: studyMap.get(patient.PATIENT_NUM) || [],
        }
      }),
    )

    searchResults.value = enhanced
  } catch (error) {
    logger.error('Search failed', error)
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

const onSearchInput = () => runSearch()

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
}

const resetFilters = () => {
  filters.value = {
    sex: null,
    vitalStatus: null,
    ageRange: { ...DEFAULT_AGE_RANGE },
    studies: [],
    createdBy: null,
    onlyMine: false,
  }
}

const onPatientCreated = (createdPatient) => {
  // CreatePatientDialog also navigates internally; this is a safety net for the Visits flow.
  if (createdPatient?.PATIENT_CD) {
    router.push(`/visits/${createdPatient.PATIENT_CD}`)
  }
}

const loadFilterOptions = async () => {
  try {
    if (!dbStore.canPerformOperations) return
    await conceptStore.initialize()
    const [sexOpts, statusOpts] = await Promise.all([
      conceptStore.getConceptOptions('gender'),
      conceptStore.getConceptOptions('vital_status'),
    ])
    sexOptions.value = sexOpts
    vitalStatusOptions.value = statusOpts
  } catch (error) {
    logger.warn('Failed to load filter options', error)
    sexOptions.value = conceptStore.getFallbackOptions('gender')
    vitalStatusOptions.value = conceptStore.getFallbackOptions('vital_status')
  }
}

const loadStudyOptions = async () => {
  try {
    if (!dbStore.canPerformOperations) return
    loadingStudies.value = true
    await studyStore.loadStudies()
    studyOptions.value = studyStore.studies.map((study) => ({
      label: study.name,
      value: study.id,
      subtitle: `${study.category || 'N/A'} • ${study.patientCount || 0} patients`,
    }))
  } catch (error) {
    logger.warn('Failed to load study options', error)
    studyOptions.value = []
  } finally {
    loadingStudies.value = false
  }
}

const selectPatient = (patient) => {
  // Add to recent patients
  const recent = localSettings.getSetting('visits.recentPatients') || []
  const updatedRecent = [patient.id, ...recent.filter((id) => id !== patient.id)].slice(0, 10)
  localSettings.setSetting('visits.recentPatients', updatedRecent)

  // Emit event for parent component
  emit('patient-selected', patient)

  // Navigate directly to patient visits
  router.push(`/visits/${patient.id}`)
}

// Helper Methods
const getPatientName = (patient) => {
  if (!patient) return 'Unknown Patient'

  if (patient.PATIENT_BLOB) {
    try {
      const blob = JSON.parse(patient.PATIENT_BLOB)
      if (blob.name) return blob.name
      if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
    } catch {
      // Fallback
    }
  }
  return patient.PATIENT_CD || 'Unknown Patient'
}

const getLastVisitDate = async (patientNum) => {
  try {
    const visitRepo = dbStore.getRepository('visit')
    const visits = await visitRepo.findByPatientNum(patientNum)

    if (visits.length > 0) {
      const lastVisit = visits.sort((a, b) => new Date(b.START_DATE) - new Date(a.START_DATE))[0]
      return formatVisitDate(lastVisit.START_DATE)
    }
  } catch (error) {
    logger.warn('Failed to get last visit date', error)
  }
  return null
}

const getVisitCount = async (patientNum) => {
  try {
    const visitRepo = dbStore.getRepository('visit')
    const visits = await visitRepo.findByPatientNum(patientNum)
    return visits.length
  } catch (error) {
    logger.warn('Failed to get visit count', error)
    return 0
  }
}

const formatVisitDate = (dateStr) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  // System/browser locale so the date matches the UI language
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Context-menu mutation (study/owner/public/delete) — refresh the visible lists
const onPatientChanged = async () => {
  await loadRecentPatients()
  loadPatientStats()
  if (isSearchActive.value) await runSearch()
}

const loadUserOptions = async () => {
  try {
    if (!dbStore.canPerformOperations) return
    loadingUsers.value = true
    const result = await dbStore.executeQuery('SELECT USER_ID, USER_CD, NAME_CHAR FROM USER_MANAGEMENT ORDER BY USER_CD')
    userOptions.value = (result.success ? result.data : []).map((user) => ({
      label: user.NAME_CHAR ? `${user.NAME_CHAR} (${user.USER_CD})` : user.USER_CD,
      value: user.USER_ID,
    }))
  } catch (error) {
    logger.warn('Failed to load user options', error)
    userOptions.value = []
  } finally {
    loadingUsers.value = false
  }
}

// Footer counts: available (access-filtered), public, assigned to me
const loadPatientStats = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    // Access-filtered total via the paginated count (limit 1 — count only)
    const result = await dbStore.getPatientsPaginated(1, 1, {})
    const total = result.pagination?.totalCount ?? 0

    const publicResult = await dbStore.executeQuery('SELECT COUNT(DISTINCT PATIENT_NUM) as count FROM USER_PATIENT_LOOKUP WHERE USER_ID = 0')
    const publicCount = publicResult.success ? publicResult.data[0]?.count || 0 : 0

    let mine = 0
    const { useAuthStore } = await import('src/stores/auth-store')
    const currentUserId = useAuthStore().currentUser?.USER_ID
    if (currentUserId !== undefined && currentUserId !== null) {
      const lookupRepo = dbStore.getRepository('userPatientLookup')
      mine = (await lookupRepo.getPatientNumsAssignedTo(currentUserId)).length
    }

    patientStats.value = { total, publicCount, mine }
  } catch (error) {
    logger.warn('Failed to load patient stats', error)
  }
}

// Lifecycle
onMounted(async () => {
  await loadRecentPatients()
  loadFilterOptions()
  loadStudyOptions()
  loadUserOptions()
  loadPatientStats()
})

watch(
  filters,
  () => {
    if (hasActiveFilters.value) runSearch()
    else if (!searchQuery.value) searchResults.value = []
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.patient-selection-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  min-height: 100vh;
}

.selection-card {
  width: 100%;
  max-width: 800px;
}

.recent-patients-grid,
.search-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.5rem;
}

.patient-stats-footer {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  padding: 8px 16px;
  font-size: 0.72rem;
  color: $grey-6;

  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}

.no-results,
.loading-state {
  text-align: center;
  padding: 3rem 1rem;
}

@media (max-width: 768px) {
  .patient-selection-container {
    padding: 1rem;
  }

  .recent-patients-grid,
  .search-results {
    grid-template-columns: 1fr;
  }
}
</style>
