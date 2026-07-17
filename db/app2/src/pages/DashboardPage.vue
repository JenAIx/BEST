<template>
  <q-page class="dashboard-page">
    <div class="page-container">
      <div class="row q-col-gutter-md">
        <!-- Quick Actions -->
        <div class="col-12 col-md-4">
          <DashboardCard icon="person_search" icon-color="primary" :title="$t('dashboard.patientsAndVisits')" :subtitle="$t('dashboard.patientsAndVisitsSubtitle')" :clickable="true" @click="$router.push('/visits')">
            <!-- Totals: patients / visits / observations, clearly separated -->
            <div class="row q-gutter-md q-mt-sm justify-center totals-row">
              <div class="text-center">
                <div class="text-h5 text-primary">{{ stats.totalPatients }}</div>
                <div class="text-caption text-grey-6">{{ $t('dashboard.totalPatients') }}</div>
              </div>
              <div class="text-center">
                <div class="text-h5 text-secondary">{{ stats.totalVisits }}</div>
                <div class="text-caption text-grey-6">{{ $t('dashboard.totalVisitsLabel') }}</div>
              </div>
              <div class="text-center">
                <div class="text-h5 text-info">{{ stats.totalObservations }}</div>
                <div class="text-caption text-grey-6">{{ $t('dashboard.totalObservations') }}</div>
              </div>
            </div>
          </DashboardCard>
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

        <!-- Right column: personal overview + today's stats + notes + reminders -->
        <div class="col-12 col-lg-4">
          <!-- My overview -->
          <q-card>
            <q-card-section>
              <div class="text-h6">{{ $t('dashboard.myOverview') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <div class="stat-item stat-item--clickable" @click="$router.push('/visits?mine=1')">
                    <div class="text-h4 text-primary">{{ stats.myPatients }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.myPatients') }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="stat-item stat-item--clickable" @click="$router.push('/studies')">
                    <div class="text-h4" :class="stats.openAudits > 0 ? 'text-negative' : 'text-positive'">{{ stats.openAudits }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.openAudits') }}</div>
                  </div>
                </div>
                <div class="col-6 q-mt-md">
                  <div class="stat-item stat-item--clickable" @click="openNotesWindow">
                    <div class="text-h4" :class="noteStore.unreadMessagesCount > 0 ? 'text-negative' : 'text-grey-7'">{{ noteStore.unreadMessagesCount }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.unreadMessages') }}</div>
                  </div>
                </div>
                <div class="col-6 q-mt-md">
                  <div class="stat-item stat-item--clickable" @click="openNotesWindow">
                    <div class="text-h4 text-secondary">{{ noteStore.quickNotesCount }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.myNotes') }}</div>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Today's statistics -->
          <q-card class="q-mt-md">
            <q-card-section>
              <div class="text-h6">{{ $t('dashboard.todaysStatistics') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <div class="stat-item">
                    <div class="text-h4 text-primary">{{ stats.patientsSeenToday }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.patientsSeen') }}</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="stat-item">
                    <div class="text-h4 text-positive">{{ stats.visitsToday }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.visitsToday') }}</div>
                  </div>
                </div>
                <div class="col-6 q-mt-md">
                  <div class="stat-item">
                    <div class="text-h4 text-warning">{{ stats.observationsToday }}</div>
                    <div class="text-caption text-grey-6">{{ $t('dashboard.observationsToday') }}</div>
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

          <!-- Recent notes -->
          <q-card class="q-mt-md">
            <q-card-section class="row items-center">
              <div class="text-h6">{{ $t('dashboard.recentNotes') }}</div>
              <q-space />
              <q-btn flat dense size="sm" color="primary" icon="edit_note" @click="openNotesWindow">
                <q-tooltip>{{ $t('dashboard.openNotes') }}</q-tooltip>
              </q-btn>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-none">
              <q-list v-if="noteStore.recentQuickNotes.length > 0" separator>
                <NoteListItem v-for="n in noteStore.recentQuickNotes" :key="n.NOTE_ID" :note="n" compact @open-context="onNoteContext" />
              </q-list>
              <div v-else class="q-pa-md text-center text-grey-6">
                <q-icon name="sticky_note_2" size="32px" class="q-mb-xs" />
                <div class="text-caption">{{ $t('dashboard.noNotes') }}</div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Upcoming visits (planned visits with a future date act as reminders) -->
          <q-card class="q-mt-md">
            <q-card-section>
              <div class="text-h6">{{ $t('dashboard.upcomingVisits') }}</div>
            </q-card-section>
            <q-separator />
            <q-card-section class="q-pa-none">
              <q-list v-if="upcomingVisits.length > 0" separator>
                <q-item v-for="visit in upcomingVisits" :key="visit.encounterNum" clickable v-ripple @click="$router.push(`/visits/${visit.patientCd}`)">
                  <q-item-section avatar>
                    <q-avatar color="blue-1" text-color="primary" icon="event_upcoming" size="36px" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ visit.patientCd }}</q-item-label>
                    <q-item-label caption>{{ visit.startDate }}<template v-if="visit.daysUntil !== null"> • {{ $t('dashboard.inDays', { days: visit.daysUntil }) }}</template></q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-icon name="chevron_right" color="grey-5" />
                  </q-item-section>
                </q-item>
              </q-list>
              <div v-else class="q-pa-md text-center text-grey-6">
                <q-icon name="event_available" size="32px" class="q-mb-xs" />
                <div class="text-caption">{{ $t('dashboard.noUpcomingVisits') }}</div>
                <div class="text-caption text-grey-5">{{ $t('dashboard.upcomingVisitsHint') }}</div>
              </div>
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
import NoteListItem from '../components/smartbtn/NoteListItem.vue'
import CreatePatientDialog from '../components/patient/CreatePatientDialog.vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useStudyStore } from 'src/stores/study-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useNoteStore } from 'src/stores/note-store'
import { visitObservationService } from 'src/services/visit-observation-service'

const notify = useNotify()
const router = useRouter()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const studyStore = useStudyStore()
const authStore = useAuthStore()
const noteStore = useNoteStore()

// Dashboard data
const recentPatients = ref([])
const recentStudies = ref([])
const upcomingVisits = ref([])
const loading = ref(false)
const loadingStudies = ref(false)

// Dialog state
const showCreatePatientDialog = ref(false)

const stats = ref({
  patientsSeenToday: 0,
  visitsToday: 0,
  observationsToday: 0,
  activeStudies: 0,
  openAudits: 0,
  myPatients: 0,
  totalPatients: 0,
  totalVisits: 0,
  totalObservations: 0,
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
    const patientStats = await patientRepo.getPatientStatistics()

    const today = new Date().toISOString().split('T')[0]
    const userId = authStore.currentUser?.USER_ID
    const isAdmin = authStore.isAdmin

    const count = async (sql, params = []) => {
      const result = await dbStore.executeQuery(sql, params)
      return result.success ? result.data[0]?.count || 0 : 0
    }

    // Totals (card 1: patients / visits / observations)
    const [totalVisits, totalObservations] = await Promise.all([
      count('SELECT COUNT(*) as count FROM VISIT_DIMENSION'),
      count('SELECT COUNT(*) as count FROM OBSERVATION_FACT'),
    ])

    // Today: distinct patients with a visit today, visits today, observations
    // entered/edited today (UPDATE_DATE = actual data entry, not clinical date)
    const [patientsSeenToday, visitsToday, observationsToday] = await Promise.all([
      count('SELECT COUNT(DISTINCT PATIENT_NUM) as count FROM VISIT_DIMENSION WHERE DATE(START_DATE) = ?', [today]),
      count('SELECT COUNT(*) as count FROM VISIT_DIMENSION WHERE DATE(START_DATE) = ?', [today]),
      count('SELECT COUNT(*) as count FROM OBSERVATION_FACT WHERE DATE(UPDATE_DATE) = ?', [today]),
    ])

    // Open audits (access-filtered for regular users)
    const auditAccessFilter = !isAdmin && userId != null ? ' AND PATIENT_NUM IN (SELECT PATIENT_NUM FROM USER_PATIENT_LOOKUP WHERE USER_ID IN (?, 0))' : ''
    const openAudits = await count(`SELECT COUNT(*) as count FROM OBSERVATION_FACT WHERE VALUEFLAG_CD = 'AUDIT'${auditAccessFilter}`, !isAdmin && userId != null ? [userId] : [])

    // My patients: directly assigned to me (owner/creator rows, not public)
    const myPatients = userId != null ? await count('SELECT COUNT(DISTINCT PATIENT_NUM) as count FROM USER_PATIENT_LOOKUP WHERE USER_ID = ?', [userId]) : 0

    // Access statistics (non-admin users)
    let visiblePatients = 0
    let hiddenPatients = 0
    if (!isAdmin && userId != null) {
      const totalPatientsCount = await count('SELECT COUNT(*) as count FROM PATIENT_DIMENSION')
      visiblePatients = await count('SELECT COUNT(DISTINCT PATIENT_NUM) as count FROM USER_PATIENT_LOOKUP WHERE USER_ID = ? OR USER_ID = 0', [userId])
      hiddenPatients = totalPatientsCount - visiblePatients
    }

    stats.value = {
      ...stats.value,
      patientsSeenToday,
      visitsToday,
      observationsToday,
      openAudits,
      myPatients,
      totalPatients: patientStats.totalPatients || 0,
      totalVisits,
      totalObservations,
      visiblePatients,
      hiddenPatients,
    }
  } catch (error) {
    console.error('Failed to load dashboard statistics:', error)
    notify.error('Failed to load dashboard statistics')
  }
}

// Active studies come from the already-loaded study store (was hardcoded 0)
const updateActiveStudies = () => {
  stats.value.activeStudies = studyStore.activeStudies.length
}

// Planned visits with a future date act as reminders ("Anstehende Visiten")
const loadUpcomingVisits = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    const userId = authStore.currentUser?.USER_ID
    const accessFilter = !authStore.isAdmin && userId != null ? ' AND v.PATIENT_NUM IN (SELECT PATIENT_NUM FROM USER_PATIENT_LOOKUP WHERE USER_ID IN (?, 0))' : ''
    const params = !authStore.isAdmin && userId != null ? [userId] : []

    const result = await dbStore.executeQuery(
      `SELECT v.ENCOUNTER_NUM, v.START_DATE, p.PATIENT_CD
       FROM VISIT_DIMENSION v
       JOIN PATIENT_DIMENSION p ON p.PATIENT_NUM = v.PATIENT_NUM
       WHERE DATE(v.START_DATE) > DATE('now')${accessFilter}
       ORDER BY v.START_DATE ASC
       LIMIT 5`,
      params,
    )

    const now = new Date()
    upcomingVisits.value = (result.success ? result.data : []).map((row) => {
      const start = new Date(row.START_DATE)
      const daysUntil = Number.isNaN(start.getTime()) ? null : Math.max(0, Math.ceil((start - now) / 86400000))
      return {
        encounterNum: row.ENCOUNTER_NUM,
        patientCd: row.PATIENT_CD,
        startDate: row.START_DATE?.split('T')[0] || row.START_DATE,
        daysUntil,
      }
    })
  } catch (error) {
    console.error('Failed to load upcoming visits:', error)
    upcomingVisits.value = []
  }
}

// Notes/messages for the personal overview (best-effort, silent without DB)
const loadNotesOverview = async () => {
  try {
    if (!dbStore.canPerformOperations) return
    await Promise.all([noteStore.loadQuickNotes(), noteStore.loadMessages()])
  } catch (error) {
    console.error('Failed to load notes overview:', error)
  }
}

// Opens the SmartButton quick-notes window (handled globally in SmartButton)
const openNotesWindow = () => {
  window.dispatchEvent(new CustomEvent('open-smart-plugin', { detail: 'notes' }))
}

const onNoteContext = (target) => {
  router.push(target.to)
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
    await Promise.all([loadRecentPatients(), loadRecentStudies(), loadDashboardStatistics(), loadUpcomingVisits(), loadNotesOverview()])
    updateActiveStudies()
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
.stat-item {
  text-align: center;
  padding: 16px;
  background-color: $grey-1;
  border-radius: 8px;

  &--clickable {
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: $blue-1;
    }
  }
}

.totals-row {
  .text-h5 {
    font-weight: 600;
    line-height: 1.2;
  }
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
