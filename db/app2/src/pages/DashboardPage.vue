<template>
  <q-page class="dashboard-page">
    <!-- Visit Mode Dashboard -->
    <div v-if="viewMode === 'visit'" class="q-pa-md">
      <div class="row q-col-gutter-md">
        <!-- Quick Actions -->
        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard
            icon="person_search"
            icon-color="primary"
            :title="$t('dashboard.quickPatientSearch')"
            :subtitle="$t('dashboard.quickPatientSearchSubtitle')"
            :clickable="true"
            @click="$router.push('/patients')"
          />
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard icon="person_add" icon-color="positive" :title="$t('dashboard.newPatient')" :subtitle="$t('dashboard.newPatientSubtitle')" :clickable="true" @click="showNewPatientDialog" />
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard
            icon="schedule"
            icon-color="info"
            :title="$t('dashboard.patientVisits')"
            :subtitle="$t('dashboard.patientVisitsSubtitle')"
            :value="stats.visitsToday"
            value-color="text-primary"
            :clickable="true"
            @click="$router.push('/visits')"
          />
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <DashboardCard
            icon="upload_file"
            icon-color="accent"
            :title="$t('dashboard.quickImport')"
            :subtitle="$t('dashboard.quickImportSubtitle')"
            :clickable="true"
            @click="$router.push('/import')"
          />
        </div>
      </div>

      <!-- Recent Patients -->
      <div class="row q-col-gutter-md q-mt-md">
        <div class="col-12 col-lg-8">
          <q-card>
            <q-card-section>
              <div class="text-h6">{{ $t('dashboard.recentPatients') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-none">
              <div v-if="loading" class="q-pa-md text-center">
                <q-spinner color="primary" size="32px" />
                <div class="q-mt-sm text-grey-6">{{ $t('dashboard.loadingRecentPatients') }}</div>
              </div>

              <q-list v-else-if="recentPatients.length > 0" separator>
                <q-item v-for="patient in recentPatients" :key="patient.id" clickable v-ripple @click="onPatientClick(null, patient)">
                  <q-item-section avatar>
                    <PatientAvatar :patient="patient" size="40px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ patient.name }}</q-item-label>
                    <q-item-label caption>
                      ID: {{ patient.id }} | Age: {{ patient.age }}
                      <template v-if="patient.owner"> | {{ $t('patient.owner') }}: {{ patient.owner }}</template>
                      <q-icon v-if="patient.isPublic" name="public" size="12px" class="q-ml-xs">
                        <q-tooltip>{{ $t('patient.publicAccess') }}</q-tooltip>
                      </q-icon>
                    </q-item-label>
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
                <div>{{ $t('dashboard.noPatientsFound') }}</div>
                <div class="text-caption">{{ $t('dashboard.addPatientsHint') }}</div>
              </div>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn flat color="primary" :label="$t('dashboard.viewAll')" to="/patients" />
            </q-card-actions>
          </q-card>

          <!-- Current Studies -->
          <q-card class="q-mt-md">
            <q-card-section>
              <div class="text-h6">{{ $t('dashboard.currentStudies') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-none">
              <div v-if="loadingStudies" class="q-pa-md text-center">
                <q-spinner color="primary" size="32px" />
                <div class="q-mt-sm text-grey-6">{{ $t('dashboard.loadingStudies') }}</div>
              </div>

              <q-list v-else-if="recentStudies.length > 0" separator>
                <q-item v-for="study in recentStudies" :key="study.id" clickable v-ripple @click="onStudyClick(study)">
                  <q-item-section avatar>
                    <q-avatar :color="getStudyStatusColor(study.status)" text-color="white" :icon="getCategoryIcon(study.category)" size="40px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ study.name }}</q-item-label>
                    <q-item-label caption>{{ study.category }} • {{ $t('dashboard.enrolledPatients') }}: {{ study.patientCount || 0 }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label caption>{{ formatRelativeTime(study.updated || study.created) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn flat round icon="arrow_forward" />
                  </q-item-section>
                </q-item>
              </q-list>

              <div v-else class="q-pa-lg text-center text-grey-6">
                <q-icon name="science" size="48px" class="q-mb-sm" />
                <div>{{ $t('dashboard.noStudiesFound') }}</div>
                <div class="text-caption">{{ $t('dashboard.addStudiesHint') }}</div>
              </div>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn flat color="primary" :label="$t('dashboard.viewAll')" to="/studies" />
            </q-card-actions>
          </q-card>
        </div>

        <!-- Quick Stats -->
        <div class="col-12 col-lg-4">
          <q-card>
            <q-card-section>
              <div class="text-h6">{{ $t('dashboard.todaysStatistics') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <div class="stat-item">
                    <div class="text-h4 text-primary">{{ stats.patientsToday }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.patientsSeen') }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="stat-item">
                    <div class="text-h4 text-positive">{{ stats.visitsToday }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.totalVisits') }}</div>
                  </div>
                </div>
                <div class="col-6 q-mt-md">
                  <div class="stat-item">
                    <div class="text-h4 text-warning">{{ stats.pendingReports }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.pendingReports') }}</div>
                  </div>
                </div>
                <div class="col-6 q-mt-md">
                  <div class="stat-item">
                    <div class="text-h4 text-info">{{ stats.activeStudies }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.activeStudies') }}</div>
                  </div>
                </div>
                <!-- Patient Access Stats (only for non-admin users) -->
                <template v-if="!authStore.isAdmin">
                  <div class="col-6 q-mt-md">
                    <div class="stat-item">
                      <div class="text-h4 text-positive">{{ stats.visiblePatients }}</div>
                      <div class="text-caption text-grey-6">{{ $t('dashboard.visiblePatients') }}</div>
                    </div>
                  </div>
                  <div class="col-6 q-mt-md">
                    <div class="stat-item">
                      <div class="text-h4 text-grey-6">{{ stats.hiddenPatients }}</div>
                      <div class="text-caption text-grey-6">{{ $t('dashboard.hiddenPatients') }}</div>
                    </div>
                  </div>
                </template>
              </div>
            </q-card-section>
          </q-card>

          <!-- Recent Activities -->
          <q-card class="q-mt-md">
            <q-card-section>
              <div class="text-h6">{{ $t('dashboard.recentActivities') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-lg text-center text-grey-6">
              <q-icon name="timeline" size="48px" class="q-mb-sm" />
              <div>{{ $t('dashboard.activityTracking') }}</div>
              <div class="text-caption">{{ $t('dashboard.comingSoon') }}</div>
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
              <div class="text-h6 text-grey-8">{{ $t('dashboard.totalPatients') }}</div>
              <div class="text-h3 text-primary">{{ dataOverview.totalPatients }}</div>
              <div class="text-caption text-grey-6">
                <q-icon name="trending_up" color="positive" />
                +{{ dataOverview.newPatientsWeek }} {{ $t('dashboard.thisWeek') }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-grey-8">{{ $t('dashboard.activeStudies') }}</div>
              <div class="text-h3 text-info">{{ dataOverview.activeStudies }}</div>
              <div class="text-caption text-grey-6">{{ dataOverview.studyParticipants }} {{ $t('dashboard.participants') }}</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-grey-8">{{ $t('dashboard.newToday') }}</div>
              <div class="text-h3 text-positive">{{ dataOverview.newToday }}</div>
              <div class="text-caption text-grey-6">{{ $t('dashboard.observationsRecorded') }}</div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-sm-6 col-md-3">
          <q-card>
            <q-card-section>
              <div class="text-h6 text-grey-8">{{ $t('dashboard.dataQuality') }}</div>
              <div class="text-h3 text-warning">{{ dataOverview.dataQuality }}%</div>
              <q-linear-progress :value="dataOverview.dataQuality / 100" color="warning" class="q-mt-sm" />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Advanced Search and Data Table -->
      <q-card class="q-mt-md">
        <q-card-section>
          <div class="text-h6">{{ $t('dashboard.patientDataExplorer') }}</div>
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
            <div class="col-12 col-md-3">
              <q-select v-model="filters.gender" :options="genderOptions" :label="$t('patient.gender')" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-3">
              <q-select v-model="filters.status" :options="statusOptions" :label="$t('patient.vitalStatus')" outlined dense clearable emit-value map-options />
            </div>
            <div class="col-12 col-md-2 text-right">
              <q-btn round flat icon="clear_all" color="grey-7" @click="clearFilters" size="md">
                <q-tooltip>{{ $t('export.clearAllFilters') }}</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Patient Count Info -->
          <div class="row q-mt-sm">
            <div class="col-12">
              <div class="text-caption text-grey-6 q-px-sm">
                <q-icon name="people" size="14px" class="q-mr-xs" />
                <span class="q-mr-md"
                  >{{ $t('dashboard.total') }}: <strong>{{ dataOverview.totalPatients }}</strong></span
                >
                <span v-if="hasActiveFilters"
                  >• {{ $t('dashboard.filtered') }}: <strong>{{ pagination.rowsNumber }}</strong></span
                >
              </div>
            </div>
          </div>
        </q-card-section>

        <!-- Data Table -->
        <q-card-section class="q-pa-none">
          <q-table
            :rows="tableData"
            :columns="translatedTableColumns"
            row-key="id"
            v-model:pagination="pagination"
            :loading="loading"
            @request="onTableRequest"
            flat
            bordered
            @row-click="onPatientClick"
            class="cursor-pointer"
          >
            <template v-slot:body-cell-owner="props">
              <q-td :props="props">
                <span>{{ props.row.owner || '—' }}</span>
                <q-icon v-if="props.row.isPublic" name="public" size="14px" color="grey-6" class="q-ml-xs">
                  <q-tooltip>{{ $t('patient.publicAccess') }}</q-tooltip>
                </q-icon>
              </q-td>
            </template>
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" @click.stop>
                <!-- Delete only for admins or the patient's creator -->
                <div v-if="canDeletePatient(props.row)" class="patient-delete-btn">
                  <AppRemoveConfirmationButton @remove-confirmed="confirmDeletePatient(props.row)" />
                </div>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>

    <!-- Create Patient Dialog -->
    <CreatePatientDialog v-model="showCreatePatientDialog" @patient-created="onPatientCreated" />

    <!-- Delete Patient Dialog -->
    <DeletePatientDialog ref="deletePatientDialog" @deleted="onPatientDeleted" @cancel="onDeleteCancelled" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DashboardCard from '../components/shared/DashboardCard.vue'
import PatientAvatar from '../components/shared/PatientAvatar.vue'
import CreatePatientDialog from '../components/patient/CreatePatientDialog.vue'
import DeletePatientDialog from '../components/patient/DeletePatientDialog.vue'
import AppRemoveConfirmationButton from '../components/shared/AppRemoveConfirmationButton.vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useStudyStore } from 'src/stores/study-store'
import { useAuthStore } from 'src/stores/auth-store'
import { visitObservationService } from 'src/services/visit-observation-service'

const notify = useNotify()
const router = useRouter()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const studyStore = useStudyStore()
const authStore = useAuthStore()

// View mode
const viewMode = ref('visit')

// Visit Mode Data
const recentPatients = ref([])
const recentStudies = ref([])
const loading = ref(false)
const loadingStudies = ref(false)

// Dialog state
const showCreatePatientDialog = ref(false)

// Delete dialog states
const deletePatientDialog = ref(null)

const stats = ref({
  patientsToday: 0,
  visitsToday: 0,
  pendingReports: 0,
  activeStudies: 0,
  totalPatients: 0,
  visiblePatients: 0,
  hiddenPatients: 0,
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
  {
    name: 'owner',
    label: 'Owner',
    field: 'owner',
    align: 'center',
  },
  {
    name: 'actions',
    label: '',
    field: 'actions',
    align: 'center',
    style: 'width: 60px',
  },
]

const tableData = ref([])

// Computed properties
const translatedTableColumns = computed(() => {
  try {
    return tableColumns.map((col) => {
      let translatedLabel = col.label
      try {
        switch (col.name) {
          case 'id':
            translatedLabel = t('patient.patientId')
            break
          case 'name':
            translatedLabel = t('patient.patientName')
            break
          case 'age':
            translatedLabel = t('patient.age')
            break
          case 'gender':
            translatedLabel = t('patient.gender')
            break
          case 'lastChanged':
            translatedLabel = t('dashboard.lastChanged')
            break
          case 'status':
            translatedLabel = t('patient.vitalStatus')
            break
          case 'owner':
            translatedLabel = t('patient.owner')
            break
          default:
            translatedLabel = col.label
        }
      } catch (translationError) {
        console.error('Error translating column:', col.name, translationError)
        translatedLabel = col.label // fallback to original
      }

      return {
        ...col,
        label: translatedLabel,
      }
    })
  } catch (error) {
    console.error('Error in translatedTableColumns computed:', error)
    return tableColumns // fallback to original
  }
})

const hasActiveFilters = computed(() => {
  return filters.value.search || filters.value.gender || filters.value.status
})

// Deletion is restricted to admins and the patient's creator (matches the
// guard in database-store.deletePatient)
const canDeletePatient = (row) => {
  if (authStore.isAdmin) return true
  const currentUserId = authStore.currentUser?.USER_ID
  return currentUserId !== undefined && currentUserId !== null && row.ownerUserId === currentUserId
}

// Data loading methods
const loadRecentPatients = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    // Use dbStore.getPatientsPaginated() to ensure user access control is applied
    const result = await dbStore.getPatientsPaginated(1, 5, {
      options: {
        orderBy: 'UPDATE_DATE_WITH_FALLBACK',
        orderDirection: 'DESC',
      },
    })

    const patients = result.patients || []
    const accessMap = await dbStore.getPatientAccessInfo(patients.map((p) => p.PATIENT_NUM))

    recentPatients.value = patients.map((patient) => ({
      id: patient.PATIENT_CD,
      name: getPatientName(patient),
      age: patient.AGE_IN_YEARS || 'Unknown',
      lastVisit: formatRelativeTime(patient.UPDATE_DATE || patient.IMPORT_DATE || patient.CREATED_AT),
      patient_num: patient.PATIENT_NUM,
      owner: accessMap.get(patient.PATIENT_NUM)?.ownerUserCd || null,
      isPublic: accessMap.get(patient.PATIENT_NUM)?.isPublic || false,
      // Include original patient data for PatientAvatar component
      SEX_RESOLVED: patient.SEX_RESOLVED,
      SEX_CD: patient.SEX_CD,
      // Store raw data for reactive translation
      _rawAge: patient.AGE_IN_YEARS,
      _rawLastVisit: patient.UPDATE_DATE || patient.IMPORT_DATE || patient.CREATED_AT,
    }))
  } catch (error) {
    console.error('Failed to load recent patients:', error)
    notify.error('Failed to load recent patients')
  }
}

const loadRecentStudies = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loadingStudies.value = true
    await studyStore.loadStudies()

    // Get recent studies (sorted by updated date, limit to 5)
    const sorted = studyStore.sortedStudies.slice(0, 5)

    recentStudies.value = sorted.map((study) => ({
      id: study.id,
      name: study.name,
      category: study.category,
      status: study.status,
      patientCount: study.patientCount || 0,
      updated: study.updated || study.created,
      created: study.created,
    }))
  } catch (error) {
    console.error('Failed to load recent studies:', error)
    recentStudies.value = []
  } finally {
    loadingStudies.value = false
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

    // Get user access statistics (for non-admin users)
    let visiblePatients = 0
    let hiddenPatients = 0

    if (!authStore.isAdmin && authStore.currentUser?.USER_ID) {
      // Count all patients in database
      const totalPatientsResult = await dbStore.executeQuery('SELECT COUNT(*) as count FROM PATIENT_DIMENSION')
      const totalPatientsCount = totalPatientsResult.success ? totalPatientsResult.data[0]?.count || 0 : 0

      // Count patients visible to current user
      const visiblePatientsResult = await dbStore.executeQuery(
        `
        SELECT COUNT(DISTINCT PATIENT_NUM) as count
        FROM USER_PATIENT_LOOKUP
        WHERE USER_ID = ? OR USER_ID = 0
      `,
        [authStore.currentUser.USER_ID],
      )

      visiblePatients = visiblePatientsResult.success ? visiblePatientsResult.data[0]?.count || 0 : 0
      hiddenPatients = totalPatientsCount - visiblePatients
    }

    stats.value = {
      patientsToday: todayPatientsResult.success ? todayPatientsResult.data[0]?.count || 0 : 0,
      visitsToday: visitsResult.success ? visitsResult.data[0]?.count || 0 : 0,
      pendingReports: 0, // Not implemented yet
      activeStudies: 0, // Not implemented yet
      totalPatients: patientStats.totalPatients || 0,
      visiblePatients,
      hiddenPatients,
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
    notify.error('Failed to load dashboard statistics')
  }
}

const loadTableData = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    loading.value = true

    // Build filter criteria - need to map resolved names back to codes
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

    // Use dbStore.getPatientsPaginated() to ensure user access control is applied
    const result = await dbStore.getPatientsPaginated(pagination.value.page, pagination.value.rowsPerPage, {
      ...criteria,
      options: sortOptions,
    })

    const patients = result.patients || []
    const accessMap = await dbStore.getPatientAccessInfo(patients.map((p) => p.PATIENT_NUM))

    tableData.value = patients.map((patient) => ({
      id: patient.PATIENT_CD,
      name: getPatientName(patient),
      age: patient.AGE_IN_YEARS || 'Unknown',
      gender: patient.SEX_RESOLVED || patient.SEX_CD || 'Unknown',
      lastChanged: formatDate(patient.UPDATE_DATE || patient.IMPORT_DATE || patient.CREATED_AT),
      status: patient.VITAL_STATUS_RESOLVED || patient.VITAL_STATUS_CD || 'Unknown',
      owner: accessMap.get(patient.PATIENT_NUM)?.ownerUserCd || null,
      ownerUserId: accessMap.get(patient.PATIENT_NUM)?.ownerUserId ?? null,
      isPublic: accessMap.get(patient.PATIENT_NUM)?.isPublic || false,
      patient_num: patient.PATIENT_NUM, // Include PATIENT_NUM for deletion
      // Include original patient data for PatientAvatar component and deletion
      SEX_RESOLVED: patient.SEX_RESOLVED,
      SEX_CD: patient.SEX_CD,
    }))

    // Update pagination with total count from server
    pagination.value.rowsNumber = result.pagination?.totalCount || 0
  } catch (error) {
    console.error('Failed to load table data:', error)
    notify.error('Failed to load table data')
  } finally {
    loading.value = false
  }
}

// Helper methods
const getPatientName = (patient) => {
  try {
    if (patient.PATIENT_BLOB) {
      try {
        const blob = JSON.parse(patient.PATIENT_BLOB)
        if (blob.name) return blob.name
        if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
      } catch (blobError) {
        console.warn('Error parsing patient blob:', blobError)
      }
    }
    return patient.PATIENT_CD || t('patient.unknownPatient')
  } catch (error) {
    console.error('Error in getPatientName:', error, { patient })
    return 'Unknown Patient'
  }
}

const formatDate = (dateStr) => {
  try {
    if (!dateStr) return t('common.unknown')
    return new Date(dateStr).toLocaleDateString()
  } catch (error) {
    console.error('Error in formatDate:', error, { dateStr })
    return 'Unknown'
  }
}

const formatRelativeTime = (dateStr) => {
  try {
    if (!dateStr) return t('common.unknown')

    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return t('dashboard.minutesAgo', { minutes: diffMins })
    } else if (diffHours < 24) {
      return t('dashboard.hoursAgo', { hours: diffHours })
    } else if (diffDays === 1) {
      return t('dashboard.yesterday')
    } else {
      return t('dashboard.daysAgo', { days: diffDays })
    }
  } catch (error) {
    console.error('Error in formatRelativeTime:', error, { dateStr })
    return 'Unknown'
  }
}

// Methods
const onPatientClick = (evt, row) => {
  // Navigate to patient details page
  router.push({ path: `/patient/${row.id}` })
}

const onStudyClick = (study) => {
  // Navigate to study details page
  router.push({ path: `/studies/${study.id}` })
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

const getCategoryIcon = (category) => {
  const icons = {
    neurological: 'psychology',
    stroke: 'favorite',
    rehabilitation: 'healing',
    research: 'science',
  }
  return icons[category?.toLowerCase()] || 'science'
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

  notify.success(`Patient ${createdPatient.PATIENT_CD} created successfully!`, {
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
  notify.info('Filters cleared')
}

// Patient deletion methods
// Prevent double-call of confirmDeletePatient
let isDeleting = false

const confirmDeletePatient = (patient) => {
  // Prevent double execution
  if (isDeleting) return

  isDeleting = true

  if (deletePatientDialog.value) {
    // Convert dashboard patient format to standard format
    const standardPatient = {
      PATIENT_NUM: patient.patient_num,
      PATIENT_CD: patient.id,
    }
    const patientName = patient.name || 'Unknown Patient'
    deletePatientDialog.value.show(standardPatient, patientName)
  }

  // Reset flag after a short delay
  setTimeout(() => {
    isDeleting = false
  }, 500)
}

const onPatientDeleted = async () => {
  // Refresh patient data and statistics
  await Promise.all([loadRecentPatients(), loadDashboardStatistics(), loadTableData()])
}

const onDeleteCancelled = () => {
  // No cleanup needed
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
    await Promise.all([loadRecentPatients(), loadRecentStudies(), loadDashboardStatistics(), loadFilterOptions()])

    // Only load table data if we're in deep work mode
    if (viewMode.value === 'deep') {
      await loadTableData()
    }
  } catch (error) {
    console.error('Failed to initialize dashboard:', error)
    notify.error('Failed to load dashboard data')
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

  // Initialize service
  visitObservationService.initialize()

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

      .patient-delete-btn {
        opacity: 1;
      }
    }
  }
}

.patient-delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
  animation: fadeInRight 0.3s ease;
  pointer-events: all;
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(10px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
