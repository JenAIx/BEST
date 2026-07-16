<template>
  <q-page class="data-grid-page">
    <div class="q-pa-md">
      <PageHeader :title="$t('navigation.dataGrid')" :subtitle="$t('dataGrid.pageSubtitle')" />

      <!-- Patient Selection Card -->
      <q-card>
        <q-card-section>
          <div class="row items-center justify-between">
            <div>
              <div class="text-h6">{{ $t('dataGrid.patientSelection') }}</div>
              <div class="text-caption text-grey-6 q-mt-xs">{{ $t('dataGrid.patientSelectionHint') }}</div>
            </div>
            <div v-if="hasStoredSelection" class="q-gutter-sm">
              <q-btn color="primary" icon="table_view" :label="$t('dataGrid.continueWithStored')" @click="goToDataGrid" :loading="loadingStoredSelection" />
              <q-btn flat color="grey-7" icon="clear" :label="$t('dataGrid.clearStored')" @click="clearStoredSelection" />
            </div>
          </div>
        </q-card-section>

        <q-separator v-if="hasStoredSelection" />

        <!-- Stored Selection Info -->
        <q-card-section v-if="hasStoredSelection" class="q-pt-none">
          <q-banner class="bg-blue-1 text-blue-8" rounded>
            <template v-slot:avatar>
              <q-icon name="info" color="blue" />
            </template>
            <div class="text-body2">
              <strong>{{ $t('dataGrid.storedPatientsCount', { count: storedPatientIds.length }) }}</strong> {{ $t('dataGrid.fromPreviousSession') }}.
              <div class="text-caption q-mt-xs">{{ $t('dataGrid.lastUsed') }}: {{ formatStoredDate() }}</div>
            </div>
          </q-banner>
        </q-card-section>

        <q-separator />

        <!-- Filters -->
        <q-card-section>
          <div class="row q-col-gutter-md items-end">
            <div class="col-12 col-md-4">
              <q-input v-model="filters.search" :label="$t('export.searchByNameOrId')" outlined dense clearable debounce="300" :placeholder="$t('export.searchPatientsPlaceholder')">
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-2">
              <q-select v-model="filters.gender" :options="genderOptions" label="Gender" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-2">
              <q-select v-model="filters.status" :options="statusOptions" label="Vital Status" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-3">
              <q-select v-model="filters.createdBy" :options="userOptions" :label="$t('visits.filterByCreator')" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-1 text-right">
              <q-btn round flat icon="clear_all" color="grey-7" @click="clearFilters" size="md">
                <q-tooltip>Clear all filters</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Patient Count Info + Selection Controls -->
          <div class="row q-mt-sm items-center justify-between">
            <div class="text-caption text-grey-6 q-px-sm">
              <q-icon name="people" size="14px" class="q-mr-xs" />
              <span class="q-mr-md"
                >Total: <strong>{{ totalPatients }}</strong></span
              >
              <span v-if="hasActiveFilters"
                >• Filtered: <strong>{{ pagination.rowsNumber }}</strong></span
              >
              <span v-if="selectedPatients.length > 0" class="text-primary">
                • Selected: <strong>{{ selectedPatients.length }}</strong>
              </span>
            </div>
            <div v-if="selectedPatients.length === 0">
              <q-btn flat dense size="sm" color="primary" icon="done_all" :label="$t('export.selectAllFiltered')" :loading="selectingAll" @click="selectAllFiltered" />
            </div>
          </div>
        </q-card-section>

        <!-- Selection Actions -->
        <q-card-section v-if="selectedPatients.length > 0" class="q-pt-none">
          <div class="row q-col-gutter-sm items-center">
            <div class="col-auto">
              <q-btn color="primary" icon="table_view" label="Open Data Grid" @click="openDataGrid" :loading="isNavigating" />
            </div>
            <div class="col-auto">
              <q-btn flat color="grey-7" icon="clear" label="Clear Selection" @click="clearSelection" />
            </div>
            <div class="col-auto text-caption text-grey-6">{{ selectedPatients.length }} patient{{ selectedPatients.length !== 1 ? 's' : '' }} selected</div>
          </div>
        </q-card-section>

        <!-- Patient Cards (click to select) -->
        <q-card-section>
          <div v-if="loading" class="q-pa-md text-center">
            <q-spinner color="primary" size="32px" />
          </div>

          <template v-else-if="tableData.length > 0">
            <div class="patient-cards-grid">
              <PatientCard v-for="patient in tableData" :key="patient.id" :patient="patient" :selected="isPatientSelected(patient)" @select="toggleSelection" @changed="loadTableData" />
            </div>
            <div class="row justify-center q-mt-md">
              <q-pagination v-model="pagination.page" :max="totalPages" :max-pages="7" direction-links boundary-links size="sm" @update:model-value="loadTableData" />
            </div>
          </template>

          <div v-else class="q-pa-lg text-center text-grey-6">
            <q-icon name="person_off" size="48px" class="q-mb-sm" />
            <div>{{ $t('visit.noPatientsFound') }}</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotify } from 'src/composables/useNotify'
import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import PatientCard from 'src/components/shared/PatientCard.vue'
import PageHeader from 'src/components/shared/PageHeader.vue'

const notify = useNotify()
const { t } = useI18n()
const router = useRouter()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const localSettings = useLocalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('DataGridPage')

// Data state
const loading = ref(false)
const totalPatients = ref(0)
const selectedPatients = ref([])
const isNavigating = ref(false)
const loadingStoredSelection = ref(false)

// Filters
const filters = ref({
  search: '',
  gender: null,
  status: null,
  createdBy: null,
})

// Dynamic filter options loaded from concept store
const genderOptions = ref([])
const statusOptions = ref([])
const userOptions = ref([])

// Pagination
const pagination = ref({
  page: 1,
  rowsPerPage: 24,
  rowsNumber: 0,
  sortBy: 'id',
  descending: false,
})

const totalPages = computed(() => Math.max(1, Math.ceil(pagination.value.rowsNumber / pagination.value.rowsPerPage)))

// Table configuration
const tableData = ref([])

// Computed properties
const hasActiveFilters = computed(() => {
  return filters.value.search || filters.value.gender || filters.value.status || filters.value.createdBy !== null
})

const storedPatientIds = computed(() => {
  return localSettings.getDataGridSelectedPatients()
})

const hasStoredSelection = computed(() => {
  return localSettings.hasDataGridSelectedPatients()
})

// Data loading methods
// Shared filter criteria for the card list and "select all".
// Returns null when the creator filter matches nothing.
const buildCriteria = async () => {
  const criteria = {}

  if (filters.value.search && filters.value.search.trim()) {
    criteria.searchTerm = filters.value.search.trim()
  }

  if (filters.value.gender) {
    // The filter value is already the code (from options loader)
    criteria.SEX_CD = filters.value.gender
  }

  if (filters.value.status) {
    // The filter value is already the code (from options loader)
    criteria.VITAL_STATUS_CD = filters.value.status
  }

  // Creator filter: prefilter by PATIENT_NUM (public user 0 = public patients)
  if (filters.value.createdBy !== null && filters.value.createdBy !== undefined) {
    const lookupRepo = dbStore.getRepository('userPatientLookup')
    const createdNums = await lookupRepo.getPatientNumsCreatedBy(filters.value.createdBy)
    if (createdNums.length === 0) return null
    criteria.patientNums = createdNums
  }

  return criteria
}

// Map a raw patient row to the standard PatientCard shape (raw row kept for the grid)
const mapPatientForCard = (patient, counts, accessMap) => ({
  id: patient.PATIENT_CD,
  name: getPatientName(patient),
  age: patient.AGE_IN_YEARS ?? null,
  gender: patient.SEX_RESOLVED || patient.SEX_CD || 'Unknown',
  lastVisit: formatDate(patient.CREATED_AT),
  status: patient.VITAL_STATUS_RESOLVED || patient.VITAL_STATUS_CD || 'Unknown',
  owner: accessMap.get(patient.PATIENT_NUM)?.ownerUserCd || null,
  isPublic: accessMap.get(patient.PATIENT_NUM)?.isPublic || false,
  visitCount: counts.visits,
  observationCount: counts.observations,
  // Store original patient data
  originalData: patient,
})

const loadTableData = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loading.value = true

    const criteria = await buildCriteria()
    if (criteria === null) {
      tableData.value = []
      pagination.value.rowsNumber = 0
      return
    }

    // Add sorting options
    const sortOptions = {
      orderBy:
        pagination.value.sortBy === 'id'
          ? 'PATIENT_CD'
          : pagination.value.sortBy === 'name'
            ? 'PATIENT_CD'
            : pagination.value.sortBy === 'age'
              ? 'AGE_IN_YEARS'
              : pagination.value.sortBy === 'lastVisit'
                ? 'CREATED_AT'
                : 'PATIENT_CD',
      orderDirection: pagination.value.descending ? 'DESC' : 'ASC',
    }

    // Use dbStore.getPatientsPaginated() to ensure user access control is applied
    const result = await dbStore.getPatientsPaginated(pagination.value.page, pagination.value.rowsPerPage, {
      ...criteria,
      options: sortOptions,
    })

    // Get visit and observation counts for each patient
    const patientIds = (result.patients || []).map((p) => p.PATIENT_CD)
    const visitsObsCounts = await getVisitsAndObservationCounts(patientIds)
    const accessMap = await dbStore.getPatientAccessInfo((result.patients || []).map((p) => p.PATIENT_NUM))

    tableData.value = (result.patients || []).map((patient) => mapPatientForCard(patient, visitsObsCounts[patient.PATIENT_CD] || { visits: 0, observations: 0 }, accessMap))

    // Update pagination with total count from server
    pagination.value.rowsNumber = result.pagination?.totalCount || 0
  } catch (error) {
    logger.error('Failed to load table data', error)
    notify.error(t('notifications.failedToLoadTableData'))
  } finally {
    loading.value = false
  }
}

const getVisitsAndObservationCounts = async (patientIds) => {
  if (!patientIds.length) return {}

  try {
    const placeholders = patientIds.map(() => '?').join(',')

    // Get visit counts
    const visitQuery = `
            SELECT pd.PATIENT_CD, COUNT(vd.ENCOUNTER_NUM) as visit_count
            FROM PATIENT_DIMENSION pd
            LEFT JOIN VISIT_DIMENSION vd ON pd.PATIENT_NUM = vd.PATIENT_NUM
            WHERE pd.PATIENT_CD IN (${placeholders})
            GROUP BY pd.PATIENT_CD
        `

    // Get observation counts
    const obsQuery = `
            SELECT pd.PATIENT_CD, COUNT(of.OBSERVATION_ID) as obs_count
            FROM PATIENT_DIMENSION pd
            LEFT JOIN OBSERVATION_FACT of ON pd.PATIENT_NUM = of.PATIENT_NUM
            WHERE pd.PATIENT_CD IN (${placeholders})
            GROUP BY pd.PATIENT_CD
        `

    const [visitResult, obsResult] = await Promise.all([dbStore.executeQuery(visitQuery, patientIds), dbStore.executeQuery(obsQuery, patientIds)])

    const counts = {}

    // Initialize all patient IDs with zero counts
    patientIds.forEach((id) => {
      counts[id] = { visits: 0, observations: 0 }
    })

    // Process visit counts
    if (visitResult.success && visitResult.data) {
      visitResult.data.forEach((row) => {
        if (counts[row.PATIENT_CD]) {
          counts[row.PATIENT_CD].visits = row.visit_count || 0
        }
      })
    }

    // Process observation counts
    if (obsResult.success && obsResult.data) {
      obsResult.data.forEach((row) => {
        if (counts[row.PATIENT_CD]) {
          counts[row.PATIENT_CD].observations = row.obs_count || 0
        }
      })
    }

    return counts
  } catch (error) {
    logger.error('Failed to get visits and observation counts', error)
    notify.warning(t('dataGrid.failedToLoadCounts'), { timeout: 2000 })
  }

  return {}
}

const loadTotalPatients = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const patientRepo = dbStore.getRepository('patient')
    const patientStats = await patientRepo.getPatientStatistics()
    totalPatients.value = patientStats.totalPatients || 0
  } catch (error) {
    logger.error('Failed to load total patients', error)
  }
}

// Load filter options from concept store
const loadFilterOptions = async () => {
  try {
    await conceptStore.initialize()

    // Load gender and status options
    const [genderOpts, statusOpts] = await Promise.all([conceptStore.getConceptOptions('gender'), conceptStore.getConceptOptions('vital_status')])

    genderOptions.value = genderOpts
    statusOptions.value = statusOpts
  } catch (error) {
    logger.error('Failed to load filter options', error)
    // Use fallback options
    genderOptions.value = conceptStore.getFallbackOptions('gender')
    statusOptions.value = conceptStore.getFallbackOptions('vital_status')
  }

  try {
    const result = await dbStore.executeQuery('SELECT USER_ID, USER_CD, NAME_CHAR FROM USER_MANAGEMENT ORDER BY USER_CD')
    userOptions.value = (result.success ? result.data : []).map((user) => ({
      label: user.NAME_CHAR ? `${user.NAME_CHAR} (${user.USER_CD})` : user.USER_CD,
      value: user.USER_ID,
    }))
  } catch (error) {
    logger.error('Failed to load user filter options', error)
    userOptions.value = []
  }
}

// Helper methods
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

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

const formatStoredDate = () => {
  const lastUsed = localSettings.getSetting('dataGrid.lastUsed')
  if (!lastUsed) return 'Unknown'
  return new Date(lastUsed).toLocaleString()
}

// Card selection (click toggles membership)
const isPatientSelected = (patient) => selectedPatients.value.some((p) => p.id === patient.id)

const toggleSelection = (patient) => {
  if (isPatientSelected(patient)) {
    selectedPatients.value = selectedPatients.value.filter((p) => p.id !== patient.id)
  } else {
    selectedPatients.value = [...selectedPatients.value, patient]
  }
}

// Select every patient matching the current filters (not just the page)
const selectingAll = ref(false)
const selectAllFiltered = async () => {
  try {
    selectingAll.value = true
    const criteria = await buildCriteria()
    if (criteria === null) {
      selectedPatients.value = []
      return
    }
    const result = await dbStore.getPatientsPaginated(1, 10000, criteria)
    const patients = result.patients || []
    const accessMap = await dbStore.getPatientAccessInfo(patients.map((patient) => patient.PATIENT_NUM))
    selectedPatients.value = patients.map((patient) => mapPatientForCard(patient, { visits: 0, observations: 0 }, accessMap))
    notify.info(`${selectedPatients.value.length} patients selected`)
  } catch (error) {
    logger.error('Failed to select all patients', error)
    notify.error('Failed to select all patients')
  } finally {
    selectingAll.value = false
  }
}

const clearFilters = async () => {
  filters.value = {
    search: '',
    gender: null,
    status: null,
    createdBy: null,
  }
  pagination.value.page = 1
  pagination.value.sortBy = 'id'
  pagination.value.descending = false
  await loadTableData()
  notify.info(t('notifications.filtersCleared'))
}

const clearSelection = () => {
  selectedPatients.value = []
  notify.info(t('dataGrid.selectionCleared'))
}

const clearStoredSelection = () => {
  localSettings.clearDataGridSelectedPatients()
  notify.info(t('dataGrid.storedSelectionCleared'))
}

const openDataGrid = async () => {
  if (selectedPatients.value.length === 0) {
    notify.warning(t('dataGrid.selectAtLeastOnePatient'))
    return
  }

  try {
    isNavigating.value = true

    // Store selected patient IDs
    const patientIds = selectedPatients.value.map((p) => p.id)
    localSettings.setDataGridSelectedPatients(patientIds)

    notify.success(t('dataGrid.openingGridWithPatients', { count: patientIds.length }))

    // Navigate to the data grid editor
    router.push('/data-grid/editor')
  } catch (error) {
    logger.error('Failed to open data grid', error)
    notify.error(t('dataGrid.failedToOpenGrid'))
  } finally {
    isNavigating.value = false
  }
}

const goToDataGrid = async () => {
  try {
    loadingStoredSelection.value = true

    notify.success(t('dataGrid.openingGridWithStoredPatients', { count: storedPatientIds.value.length }))

    // Navigate to the data grid editor with stored selection
    router.push('/data-grid/editor')
  } catch (error) {
    logger.error('Failed to open data grid', error)
    notify.error(t('dataGrid.failedToOpenGrid'))
  } finally {
    loadingStoredSelection.value = false
  }
}

// Initialize data
const initializeDataGridPage = async () => {
  if (!dbStore.canPerformOperations) {
    logger.debug('Database not ready, skipping data grid page initialization')
    return
  }

  loading.value = true
  try {
    await Promise.all([loadFilterOptions(), loadTotalPatients(), loadTableData()])
  } catch (error) {
    logger.error('Failed to initialize data grid page', error)
    notify.error(t('dataGrid.failedToLoadPageData'))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Initialize local settings
  localSettings.initialize()

  // Wait for database to be ready and initialize page
  if (dbStore.canPerformOperations) {
    await initializeDataGridPage()
  } else {
    // Wait for database connection
    const unwatch = dbStore.$subscribe((mutation, state) => {
      if (state.isConnected && state.isInitialized) {
        initializeDataGridPage()
        unwatch()
      }
    })
  }
})

// Watch for filter changes to reload table data automatically
watch(
  filters,
  async () => {
    if (dbStore.canPerformOperations) {
      pagination.value.page = 1 // Reset to first page when filters change
      await loadTableData()
    }
  },
  { deep: true },
)
</script>

<style lang="scss" scoped>
.data-grid-page {
  background-color: $grey-1;
  min-height: calc(100vh - 50px);
}

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
