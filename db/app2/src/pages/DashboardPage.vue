<template>
  <q-page class="dashboard-page">
    <!-- Visit Mode Dashboard -->
    <div v-if="viewMode === 'visit'" class="q-pa-md">
      <div class="row q-col-gutter-md">
        <!-- Quick Actions -->
        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard icon="person_search" icon-color="primary" title="Quick Patient Search" subtitle="Find and view patient records" :clickable="true" @click="$router.push('/patients')" />
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard icon="person_add" icon-color="positive" title="New Patient" subtitle="Add a new patient to the system" :clickable="true" @click="showNewPatientDialog" />
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard
            icon="schedule"
            icon-color="info"
            title="Patient Visits"
            subtitle="Manage patient visits"
            :value="stats.visitsToday"
            value-color="text-primary"
            :clickable="true"
            @click="$router.push('/visits')"
          />
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard icon="upload_file" icon-color="accent" title="Quick Import" subtitle="Import patient data" :clickable="true" @click="$router.push('/import')" />
        </div>
      </div>

      <!-- Recent Patients -->
      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12 col-lg-8">
          <q-card>
            <q-card-section>
              <div class="text-h6">Recent Patients</div>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-none">
              <div v-if="loading" class="q-pa-md text-center">
                <q-spinner color="primary" size="32px" />
                <div class="q-mt-sm text-grey-6">Loading recent patients...</div>
              </div>

              <q-list v-else-if="recentPatients.length > 0" separator>
                <q-item v-for="patient in recentPatients" :key="patient.id" clickable v-ripple @click="onPatientClick(null, patient)">
                  <q-item-section avatar>
                    <PatientAvatar :patient="patient" size="40px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ patient.name }}</q-item-label>
                    <q-item-label caption>ID: {{ patient.id }} | Age: {{ patient.age }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>{{ patient.lastVisit }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat round icon="arrow_forward" />
                  </q-item-section>
                </q-item>
              </q-list>

              <div v-else class="q-pa-lg text-center text-grey-6">
                <q-icon name="person_off" size="48px" class="q-mb-sm" />
                <div>No patients found</div>
                <div class="text-caption">Add some patients to see recent activity</div>
              </div>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn flat color="primary" label="View All" to="/patients" />
            </q-card-actions>
          </q-card>
        </div>

        <!-- Quick Stats -->
        <div class="col-12 col-lg-4">
          <q-card>
            <q-card-section>
              <div class="text-h6">Today's Statistics</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <div class="stat-item">
                    <div class="text-h4 text-primary">{{ stats.patientsToday }}</div>
                    <div class="text-caption text-grey-6">Patients Seen</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="stat-item">
                    <div class="text-h4 text-positive">{{ stats.visitsToday }}</div>
                    <div class="text-caption text-grey-6">Total Visits</div>
                  </div>
                </div>
                <div class="col-6 q-mt-md">
                  <div class="stat-item">
                    <div class="text-h4 text-warning">{{ stats.pendingReports }}</div>
                    <div class="text-caption text-grey-6">Pending Reports</div>
                  </div>
                </div>
                <div class="col-6 q-mt-md">
                  <div class="stat-item">
                    <div class="text-h4 text-info">{{ stats.activeStudies }}</div>
                    <div class="text-caption text-grey-6">Active Studies</div>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Recent Activities -->
          <q-card class="q-mt-md">
            <q-card-section>
              <div class="text-h6">Recent Activities</div>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-lg text-center text-grey-6">
              <q-icon name="timeline" size="48px" class="q-mb-sm" />
              <div>Activity Tracking</div>
              <div class="text-caption">Coming soon - patient activity monitoring</div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Deep Work Mode Dashboard -->
    <div v-else-if="viewMode === 'deep'" class="q-pa-md">
      <!-- Data Overview Cards -->
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6 col-md-3">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-grey-8">Total Patients</div>
              <div class="text-h3 text-primary">{{ dataOverview.totalPatients }}</div>
              <div class="text-caption text-grey-6">
                <q-icon name="trending_up" color="positive" />
                +{{ dataOverview.newPatientsWeek }} this week
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-grey-8">Active Studies</div>
              <div class="text-h3 text-info">{{ dataOverview.activeStudies }}</div>
              <div class="text-caption text-grey-6">{{ dataOverview.studyParticipants }} participants</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-grey-8">New Today</div>
              <div class="text-h3 text-positive">{{ dataOverview.newToday }}</div>
              <div class="text-caption text-grey-6">Observations recorded</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-grey-8">Data Quality</div>
              <div class="text-h3 text-warning">{{ dataOverview.dataQuality }}%</div>
              <q-linear-progress :value="dataOverview.dataQuality / 100" color="warning" class="q-mt-sm" />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Advanced Search and Data Table -->
      <q-card class="q-mt-md">
        <q-card-section>
          <div class="text-h6">Patient Data Explorer</div>
        </q-card-section>

        <q-separator />

        <!-- Filters -->
        <q-card-section>
          <div class="row q-col-gutter-md items-end">
            <div class="col-12 col-md-4">
              <q-input v-model="filters.search" label="Search by name or Patient ID" outlined dense clearable debounce="300" placeholder="Search patients...">
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-3">
              <q-select v-model="filters.gender" :options="genderOptions" label="Gender" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-3">
              <q-select v-model="filters.status" :options="statusOptions" label="Vital Status" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-2 text-right">
              <q-btn round flat icon="clear_all" color="grey-7" @click="clearFilters" size="md">
                <q-tooltip>Clear all filters</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Patient Count Info -->
          <div class="row q-mt-sm">
            <div class="col-12">
              <div class="text-caption text-grey-6 q-px-sm">
                <q-icon name="people" size="14px" class="q-mr-xs" />
                <span class="q-mr-md"
                  >Total: <strong>{{ dataOverview.totalPatients }}</strong></span
                >
                <span v-if="hasActiveFilters"
                  >• Filtered: <strong>{{ pagination.rowsNumber }}</strong></span
                >
              </div>
            </div>
          </div>
        </q-card-section>

        <!-- Data Table -->
        <q-card-section class="q-pa-none">
          <q-table
            :rows="tableData"
            :columns="tableColumns"
            row-key="id"
            v-model:pagination="pagination"
            :loading="loading"
            @request="onTableRequest"
            flat
            bordered
            @row-click="onPatientClick"
            class="cursor-pointer"
          >
          </q-table>
        </q-card-section>
      </q-card>
    </div>

    <!-- Create Patient Dialog -->
    <CreatePatientDialog v-model="showCreatePatientDialog" @patient-created="onPatientCreated" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import DashboardCard from '../components/shared/DashboardCard.vue'
import PatientAvatar from '../components/shared/PatientAvatar.vue'
import CreatePatientDialog from '../components/patient/CreatePatientDialog.vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'

const $q = useQuasar()
const router = useRouter()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()

// View mode
const viewMode = ref('visit')

// Visit Mode Data
const recentPatients = ref([])
const loading = ref(false)

// Dialog state
const showCreatePatientDialog = ref(false)

const stats = ref({
  patientsToday: 0,
  visitsToday: 0,
  pendingReports: 0,
  activeStudies: 0,
  totalPatients: 0,
})

// Deep Work Mode Data
const dataOverview = ref({
  totalPatients: 0,
  newPatientsWeek: 0,
  activeStudies: 0,
  studyParticipants: 0,
  newToday: 0,
  dataQuality: 95,
})

const filters = ref({
  search: '',
  gender: null,
  status: null,
})

// Dynamic filter options loaded from concept store
const genderOptions = ref([])
const statusOptions = ref([])

const pagination = ref({
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
  sortBy: 'lastChanged',
  descending: true,
})

const tableColumns = [
  {
    name: 'id',
    label: 'Patient ID',
    field: (row) => row.id,
    align: 'left',
    sortable: true,
  },
  {
    name: 'name',
    label: 'Name',
    field: (row) => row.name,
    align: 'left',
    sortable: true,
  },
  {
    name: 'age',
    label: 'Age',
    field: 'age',
    align: 'center',
    sortable: true,
  },
  {
    name: 'gender',
    label: 'Gender',
    field: 'gender',
    align: 'center',
  },
  {
    name: 'lastChanged',
    label: 'Last Changed',
    field: 'lastChanged',
    align: 'left',
    sortable: true,
  },
  {
    name: 'status',
    label: 'Vital Status',
    field: 'status',
    align: 'center',
  },
]

const tableData = ref([])

// Computed properties
const hasActiveFilters = computed(() => {
  return filters.value.search || filters.value.gender || filters.value.status
})

// Data loading methods
const loadRecentPatients = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const patientRepo = dbStore.getRepository('patient')
    const result = await patientRepo.getPatientsPaginated(1, 5, {
      options: {
        orderBy: 'UPDATE_DATE_WITH_FALLBACK',
        orderDirection: 'DESC',
      },
    })

    recentPatients.value = (result.patients || []).map((patient) => ({
      id: patient.PATIENT_CD,
      name: getPatientName(patient),
      age: patient.AGE_IN_YEARS || 'Unknown',
      lastVisit: formatRelativeTime(patient.UPDATE_DATE || patient.IMPORT_DATE || patient.CREATED_AT),
      patient_num: patient.PATIENT_NUM,
      // Include original patient data for PatientAvatar component
      SEX_RESOLVED: patient.SEX_RESOLVED,
      SEX_CD: patient.SEX_CD,
    }))
  } catch (error) {
    console.error('Failed to load recent patients:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load recent patients',
      position: 'top',
    })
  }
}

const loadDashboardStatistics = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const patientRepo = dbStore.getRepository('patient')

    // Get patient statistics
    const patientStats = await patientRepo.getPatientStatistics()

    // Get today's date for filtering
    const today = new Date().toISOString().split('T')[0]

    // Count patients created today
    const todayPatientsResult = await dbStore.executeQuery(`SELECT COUNT(*) as count FROM patient_list WHERE DATE(CREATED_AT) = ?`, [today])

    // Count total visits
    const visitsResult = await dbStore.executeQuery('SELECT COUNT(*) as count FROM VISIT_DIMENSION')

    // Count observations created today
    const todayObsResult = await dbStore.executeQuery(`SELECT COUNT(*) as count FROM OBSERVATION_FACT WHERE DATE(IMPORT_DATE) = ?`, [today])

    stats.value = {
      patientsToday: todayPatientsResult.success ? todayPatientsResult.data[0]?.count || 0 : 0,
      visitsToday: visitsResult.success ? visitsResult.data[0]?.count || 0 : 0,
      pendingReports: 0, // Not implemented yet
      activeStudies: 0, // Not implemented yet
      totalPatients: patientStats.totalPatients || 0,
    }

    // Update data overview for deep work mode
    dataOverview.value = {
      totalPatients: patientStats.totalPatients || 0,
      newPatientsWeek: 0, // Could calculate week stats
      activeStudies: 0, // Not implemented
      studyParticipants: patientStats.totalPatients || 0,
      newToday: todayObsResult.success ? todayObsResult.data[0]?.count || 0 : 0,
      dataQuality: 95, // Static for now
    }
  } catch (error) {
    console.error('Failed to load dashboard statistics:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load dashboard statistics',
      position: 'top',
    })
  }
}

const loadTableData = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loading.value = true
    const patientRepo = dbStore.getRepository('patient')

    // Build filter criteria - need to map resolved names back to codes
    const criteria = {}

    if (filters.value.search && filters.value.search.trim()) {
      criteria.searchTerm = filters.value.search.trim()
    }

    if (filters.value.gender) {
      // Use concept store to get code from label
      const genderCode = conceptStore.getCodeFromLabel(filters.value.gender, 'gender')
      if (genderCode) {
        criteria.SEX_CD = genderCode
      }
    }

    if (filters.value.status) {
      // Use concept store to get code from label
      const statusCode = conceptStore.getCodeFromLabel(filters.value.status, 'vital_status')
      if (statusCode) {
        criteria.VITAL_STATUS_CD = statusCode
      }
    }

    // Add sorting options
    const sortOptions = {
      orderBy:
        pagination.value.sortBy === 'id'
          ? 'PATIENT_CD'
          : pagination.value.sortBy === 'name'
            ? 'PATIENT_CD' // Use PATIENT_CD for name sorting as fallback
            : pagination.value.sortBy === 'age'
              ? 'AGE_IN_YEARS'
              : pagination.value.sortBy === 'lastChanged'
                ? 'UPDATE_DATE_WITH_FALLBACK'
                : 'PATIENT_CD',
      orderDirection: pagination.value.descending ? 'DESC' : 'ASC',
    }

    // Use server-side pagination with sorting
    const result = await patientRepo.getPatientsPaginated(pagination.value.page, pagination.value.rowsPerPage, {
      ...criteria,
      options: sortOptions,
    })

    tableData.value = (result.patients || []).map((patient) => ({
      id: patient.PATIENT_CD,
      name: getPatientName(patient),
      age: patient.AGE_IN_YEARS || 'Unknown',
      gender: patient.SEX_RESOLVED || patient.SEX_CD || 'Unknown',
      lastChanged: formatDate(patient.UPDATE_DATE || patient.IMPORT_DATE || patient.CREATED_AT),
      status: patient.VITAL_STATUS_RESOLVED || patient.VITAL_STATUS_CD || 'Unknown',
    }))

    // Update pagination with total count from server
    pagination.value.rowsNumber = result.pagination?.totalCount || 0
  } catch (error) {
    console.error('Failed to load table data:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load table data',
      position: 'top',
    })
  } finally {
    loading.value = false
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

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return 'Unknown'

  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) {
    return `${diffMins} minutes ago`
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else {
    return `${diffDays} days ago`
  }
}

// Methods
const onPatientClick = (evt, row) => {
  // Navigate to patient details page
  router.push({ path: `/patient/${row.id}` })
}

const onTableRequest = async (props) => {
  // Update pagination state
  pagination.value.page = props.pagination.page
  pagination.value.rowsPerPage = props.pagination.rowsPerPage
  pagination.value.sortBy = props.pagination.sortBy
  pagination.value.descending = props.pagination.descending

  // Load data with new pagination/sorting
  await loadTableData()
}

const showNewPatientDialog = () => {
  showCreatePatientDialog.value = true
}

const onPatientCreated = async (createdPatient) => {
  // Refresh recent patients and statistics
  await Promise.all([loadRecentPatients(), loadDashboardStatistics()])

  $q.notify({
    type: 'positive',
    message: `Patient ${createdPatient.PATIENT_CD} created successfully!`,
    position: 'top',
    timeout: 3000,
    actions: [
      {
        label: 'View Patient',
        color: 'white',
        handler: () => {
          router.push({ path: `/patient/${createdPatient.PATIENT_CD}` })
        },
      },
    ],
  })
}

const clearFilters = async () => {
  filters.value = {
    search: '',
    gender: null,
    status: null,
  }
  pagination.value.page = 1
  pagination.value.sortBy = 'lastChanged'
  pagination.value.descending = true
  await loadTableData()
  $q.notify({
    type: 'info',
    message: 'Filters cleared',
    position: 'top',
  })
}

// Load filter options from concept store
const loadFilterOptions = async () => {
  try {
    // Initialize concept store (will be skipped if already initialized)
    await conceptStore.initialize()

    // Load gender and status options (will use cache if available)
    const [genderOpts, statusOpts] = await Promise.all([conceptStore.getConceptOptions('gender'), conceptStore.getConceptOptions('vital_status')])

    genderOptions.value = genderOpts
    statusOptions.value = statusOpts
  } catch (error) {
    console.error('Failed to load filter options:', error)
    // Use fallback options
    genderOptions.value = conceptStore.getFallbackOptions('gender')
    statusOptions.value = conceptStore.getFallbackOptions('vital_status')
  }
}

// Initialize dashboard data
const initializeDashboard = async () => {
  if (!dbStore.canPerformOperations) {
    console.log('Database not ready, skipping dashboard initialization')
    return
  }

  loading.value = true
  try {
    // Always load basic dashboard data and filter options
    await Promise.all([loadRecentPatients(), loadDashboardStatistics(), loadFilterOptions()])

    // Only load table data if we're in deep work mode
    if (viewMode.value === 'deep') {
      await loadTableData()
    }
  } catch (error) {
    console.error('Failed to initialize dashboard:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load dashboard data',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

// Listen for view mode changes
const handleViewModeChange = async (event) => {
  const newMode = event.detail
  const previousMode = viewMode.value
  viewMode.value = newMode

  // Load table data when switching to deep work mode
  if (newMode === 'deep' && previousMode !== 'deep' && dbStore.canPerformOperations) {
    await loadTableData()
  }
}

onMounted(async () => {
  window.addEventListener('viewModeChanged', handleViewModeChange)

  // Load initial view mode
  const savedMode = localStorage.getItem('viewMode')
  if (savedMode) {
    viewMode.value = savedMode
  }

  // Wait for database to be ready and initialize dashboard
  if (dbStore.canPerformOperations) {
    await initializeDashboard()
  } else {
    // Wait for database connection
    const unwatch = dbStore.$subscribe((mutation, state) => {
      if (state.isConnected && state.isInitialized) {
        initializeDashboard()
        unwatch()
      }
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('viewModeChanged', handleViewModeChange)
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
.dashboard-page {
  background-color: $grey-1;
  min-height: calc(100vh - 50px);
}

.stat-item {
  text-align: center;
  padding: 16px;
  background-color: $grey-1;
  border-radius: 8px;
}

.cursor-pointer {
  :deep(.q-table tbody tr) {
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: $grey-2;
    }
  }
}
</style>
