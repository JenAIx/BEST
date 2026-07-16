<template>
  <div class="study-audit-panel">
    <q-inner-loading :showing="loading && !summary">
      <q-spinner color="primary" size="48px" />
    </q-inner-loading>

    <div v-if="errorMsg" class="text-negative q-pa-md">{{ $t('study.audit.loadError') }}: {{ errorMsg }}</div>

    <div v-else-if="summary" class="audit-grid">
      <!-- KPI row -->
      <q-card flat bordered class="span-2">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="flag" color="negative" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.tabAudit') }}</div>
            <q-space />
            <span class="text-caption text-grey-6 q-mr-sm">{{ $t('study.audit.scopeHint') }}</span>
            <q-btn flat round dense icon="refresh" size="sm" :loading="loading" @click="reload">
              <q-tooltip>{{ $t('common.refresh') }}</q-tooltip>
            </q-btn>
          </div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-3">
              <CohortKpiCard :label="$t('study.audit.openAudits')" :value="summary.total" icon="flag" icon-color="negative" />
            </div>
            <div class="col-12 col-sm-3">
              <CohortKpiCard :label="$t('study.audit.patientsWithAudits')" :value="summary.byPatient.length" icon="person_search" icon-color="orange" />
            </div>
            <div class="col-12 col-sm-3">
              <CohortKpiCard
                :label="$t('study.completedPatients')"
                :value="statusCounts ? `${statusCounts.completed} / ${enrolledCount}` : '—'"
                icon="check_circle"
                icon-color="info"
              />
            </div>
            <div class="col-12 col-sm-3">
              <CohortKpiCard :label="$t('study.completionRate')" :value="`${completionPct}%`" icon="percent" icon-color="primary" />
            </div>
          </div>
          <q-linear-progress :value="completionPct / 100" color="info" track-color="grey-3" size="10px" rounded class="q-mt-md" />
        </q-card-section>
      </q-card>

      <!-- Audits per user -->
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="group" color="deep-purple" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.audit.byUser') }}</div>
          </div>
          <CohortBarList :items="userItems" color="deep-purple" :empty-label="$t('study.audit.none')" />
        </q-card-section>
      </q-card>

      <!-- Audits per patient -->
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="person_search" color="orange" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.audit.byPatient') }}</div>
            <q-space />
            <q-btn
              v-if="summary.byPatient.length"
              dense
              no-caps
              color="negative"
              outline
              icon="grid_on"
              :label="$t('study.audit.openAllInGrid')"
              @click="openPatientsInGrid(summary.byPatient, { auditFilter: true })"
            />
          </div>

          <div v-if="!summary.byPatient.length" class="text-grey-6 text-caption q-pa-md">
            {{ $t('study.audit.none') }}
          </div>
          <q-list v-else dense separator class="audit-patient-list">
            <q-item v-for="row in summary.byPatient" :key="row.patientNum">
              <q-item-section>
                <q-item-label>{{ patientLabel(row) }}</q-item-label>
                <q-item-label v-if="patientName(row)" caption>{{ row.patientCd }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs no-wrap">
                  <q-chip dense color="negative" text-color="white" size="sm">{{ row.auditCount }}</q-chip>
                  <q-btn flat round dense size="sm" icon="grid_on" color="primary" @click="openPatientsInGrid([row], { auditFilter: true })">
                    <q-tooltip>{{ $t('study.audit.openInGrid') }}</q-tooltip>
                  </q-btn>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStudyStore } from 'src/stores/study-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import CohortBarList from './CohortBarList.vue'
import CohortKpiCard from './CohortKpiCard.vue'

const props = defineProps({
  studyId: { type: Number, required: true },
})

const router = useRouter()
const studyStore = useStudyStore()
const localSettings = useLocalSettingsStore()

const loading = computed(() => studyStore.auditSummaryLoading)
const errorMsg = computed(() => studyStore.auditSummaryError)
const summary = computed(() => (studyStore.auditSummaryStudyId === props.studyId ? studyStore.auditSummary : null))
const statusCounts = computed(() => (studyStore.auditSummaryStudyId === props.studyId ? studyStore.enrollmentStatusCounts : null))

// Enrolled = active + completed (withdrawn patients don't count toward progress)
const enrolledCount = computed(() => {
  const c = statusCounts.value
  return c ? c.active + c.completed : 0
})

const completionPct = computed(() => {
  if (!enrolledCount.value) return 0
  return Math.round((100 * (statusCounts.value?.completed || 0)) / enrolledCount.value)
})

const userItems = computed(() => {
  const rows = summary.value?.byUser || []
  const total = summary.value?.total || 0
  return rows.map((r) => ({ key: r.userCd, label: r.userName || r.userCd, count: r.auditCount, total }))
})

onMounted(() => loadIfNeeded())
watch(
  () => props.studyId,
  () => loadIfNeeded(),
)

async function loadIfNeeded() {
  if (!props.studyId) return
  if (studyStore.auditSummaryStudyId === props.studyId && studyStore.auditSummary) return
  await reload()
}

async function reload() {
  try {
    await studyStore.loadStudyAudit(props.studyId)
  } catch {
    // surfaced via errorMsg
  }
}

function patientName(row) {
  if (!row.patientBlob) return null
  try {
    const blob = JSON.parse(row.patientBlob)
    if (blob.name) return blob.name
    if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
  } catch {
    // ignore malformed blob
  }
  return null
}

function patientLabel(row) {
  return patientName(row) || row.patientCd
}

// Jump to the grid editor with exactly these patients loaded; the audit
// filter is pre-activated via the one-shot pendingAuditFilter flag.
function openPatientsInGrid(rows, { auditFilter = false } = {}) {
  const patientCds = rows.map((r) => String(r.patientCd || r.PATIENT_CD)).filter(Boolean)
  if (!patientCds.length) return
  localSettings.setDataGridSelectedPatients(patientCds)
  if (auditFilter) localSettings.setPendingAuditFilter(true)
  router.push('/data-grid/editor')
}
</script>

<style lang="scss" scoped>
.study-audit-panel {
  position: relative;
  min-height: 200px;
}

.audit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: 1 / -1;
  }
}

.audit-patient-list {
  max-height: 420px;
  overflow-y: auto;
}
</style>
