<template>
  <q-page class="dashboard-page">
    <div class="q-pa-md">
      <div class="row q-col-gutter-md">
        <!-- Quick Actions -->
        <div class="col-12 col-md-4">
          <DashboardCard
            icon="person_search"
            icon-color="primary"
            :title="$t('dashboard.patientsAndVisits')"
            :subtitle="$t('dashboard.patientsAndVisitsSubtitle')"
            :value="stats.visitsToday"
            value-color="text-primary"
            :clickable="true"
            @click="$router.push('/visits')"
          />
        </div>

        <div class="col-12 col-md-4">
          <DashboardCard icon="person_add" icon-color="positive" :title="$t('dashboard.newPatient')" :subtitle="$t('dashboard.newPatientSubtitle')" :clickable="true" @click="showNewPatientDialog" />
        </div>

        <div class="col-12 col-md-4">
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
            <q-card-section>
              <div v-if="loading" class="q-pa-md text-center">
                <q-spinner color="primary" size="32px" />
                <div class="q-mt-sm text-grey-6">{{ $t('dashboard.loadingRecentPatients') }}</div>
              </div>

              <div v-else-if="recentPatients.length > 0" class="patient-cards-grid">
                <PatientCard v-for="patient in recentPatients" :key="patient.id" :patient="patient" @select="onPatientClick(null, $event)" @changed="onPatientChanged" />
              </div>

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

    <!-- Create Patient Dialog -->
    <CreatePatientDialog v-model="showCreatePatientDialog" @patient-created="onPatientCreated" />
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DashboardCard from '../components/shared/DashboardCard.vue'
import PatientCard from '../components/shared/PatientCard.vue'
import CreatePatientDialog from '../components/patient/CreatePatientDialog.vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useStudyStore } from 'src/stores/study-store'
import { useAuthStore } from 'src/stores/auth-store'
import { visitObservationService } from 'src/services/visit-observation-service'

const notify = useNotify()
const router = useRouter()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const studyStore = useStudyStore()
const authStore = useAuthStore()

// Dashboard data
const recentPatients = ref([])
const recentStudies = ref([])
const loading = ref(false)
const loadingStudies = ref(false)

// Dialog state
const showCreatePatientDialog = ref(false)

const stats = ref({
  patientsToday: 0,
  visitsToday: 0,
  pendingReports: 0,
  activeStudies: 0,
  totalPatients: 0,
  visiblePatients: 0,
  hiddenPatients: 0,
})

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
    const patientNums = patients.map((p) => p.PATIENT_NUM)
    const [accessMap, studyMap] = await Promise.all([dbStore.getPatientAccessInfo(patientNums), dbStore.getPatientStudyInfo(patientNums)])

    recentPatients.value = patients.map((patient) => ({
      id: patient.PATIENT_CD,
      name: getPatientName(patient),
      age: patient.AGE_IN_YEARS ?? null,
      lastVisit: formatRelativeTime(patient.UPDATE_DATE || patient.IMPORT_DATE || patient.CREATED_AT),
      patient_num: patient.PATIENT_NUM,
      PATIENT_NUM: patient.PATIENT_NUM,
      owner: accessMap.get(patient.PATIENT_NUM)?.ownerUserCd || null,
      isPublic: accessMap.get(patient.PATIENT_NUM)?.isPublic || false,
      studies: studyMap.get(patient.PATIENT_NUM) || [],
      // Original patient fields for downstream consumers
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

  } catch (error) {
    console.error('Failed to load dashboard statistics:', error)
    notify.error('Failed to load dashboard statistics')
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

// Context-menu mutation — refresh dashboard lists and stats
const onPatientChanged = async () => {
  await Promise.all([loadRecentPatients(), loadDashboardStatistics()])
}

// Initialize dashboard data
const initializeDashboard = async () => {
  if (!dbStore.canPerformOperations) {
    console.log('Database not ready, skipping dashboard initialization')
    return
  }

  loading.value = true
  try {
    await Promise.all([loadRecentPatients(), loadRecentStudies(), loadDashboardStatistics()])
  } catch (error) {
    console.error('Failed to initialize dashboard:', error)
    notify.error('Failed to load dashboard data')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Initialize service
  visitObservationService.initialize()

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
