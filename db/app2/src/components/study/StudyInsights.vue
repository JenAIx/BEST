<template>
  <div class="study-insights">
    <q-inner-loading :showing="loading && !insights">
      <q-spinner color="primary" size="48px" />
    </q-inner-loading>

    <div v-if="errorMsg" class="text-negative q-pa-md">
      {{ $t('study.insights.loadError') }}: {{ errorMsg }}
    </div>

    <div v-else-if="insights && insights.counts.enrolled === 0" class="text-grey-6 q-pa-md text-center">
      {{ $t('study.insights.empty') }}
    </div>

    <div v-else-if="insights" class="insights-grid">
      <!-- Visit Retention -->
      <q-card flat bordered class="span-2">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="groups" color="primary" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.insights.retention') }}</div>
          </div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-3">
              <CohortKpiCard
                :label="$t('study.insights.enrolled')"
                :value="insights.counts.enrolled"
                icon="how_to_reg"
                icon-color="primary"
              />
            </div>
            <div v-for="vt in insights.counts.perVisitType" :key="vt.visitType" class="col-12 col-sm-3">
              <CohortKpiCard
                :label="visitTypeLabel(vt.visitType)"
                :value="vt.patientCount"
                :caption="`${pct(vt.patientCount, insights.counts.enrolled)}% ${$t('study.insights.ofEnrolled')}`"
                icon="event"
                icon-color="indigo"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Drug Usage -->
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="medication" color="orange" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.insights.drugUsage') }}</div>
            <q-space />
            <span class="text-caption text-grey-6">{{ $t('study.insights.takingNotTakingHint') }}</span>
          </div>
          <CohortBarList
            :items="drugItems"
            color="orange"
            :empty-label="$t('study.insights.noDrugs')"
          />
        </q-card-section>
      </q-card>

      <!-- Comorbidity / Finding Prevalence -->
      <q-card flat bordered>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="heart_broken" color="red" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.insights.comorbidities') }}</div>
          </div>
          <CohortBarList
            :items="findingItems"
            color="red"
            :empty-label="$t('study.insights.noFindings')"
          />
        </q-card-section>
      </q-card>

      <!-- Selections (Etiology + Event Type) -->
      <q-card v-for="sel in insights.selections" :key="sel.code" flat bordered>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon :name="selectionIcon(sel.code)" :color="selectionColor(sel.code)" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ selectionTitle(sel.code) }}</div>
          </div>
          <CohortBarList
            :items="selectionItems(sel.data)"
            :color="selectionColor(sel.code)"
            :empty-label="$t('study.insights.noData')"
          />
        </q-card-section>
      </q-card>

      <!-- Team Activity: patients owned + observations created per user -->
      <q-card flat bordered class="span-2">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="group" color="teal" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.insights.userStats') }}</div>
          </div>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <div class="text-body2 text-weight-medium q-mb-sm">{{ $t('study.insights.patientsOwned') }}</div>
              <CohortBarList :items="userPatientItems" color="teal" :empty-label="$t('study.insights.noData')" />
            </div>
            <div class="col-12 col-md-6">
              <div class="text-body2 text-weight-medium q-mb-sm">{{ $t('study.insights.observationsCreated') }}</div>
              <CohortBarList :items="userObservationItems" color="cyan-8" :empty-label="$t('study.insights.noData')" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Lab Trends -->
      <q-card flat bordered class="span-2">
        <q-card-section>
          <div class="row items-center q-mb-md">
            <q-icon name="science" color="blue" size="24px" class="q-mr-sm" />
            <div class="text-subtitle1">{{ $t('study.insights.labTrends') }}</div>
            <q-space />
            <span class="text-caption text-grey-6">{{ $t('study.insights.medianHint') }}</span>
          </div>
          <div class="row q-col-gutter-md">
            <div v-for="lab in insights.labs" :key="lab.code" class="col-12 col-md-6">
              <div class="text-body2 text-weight-medium q-mb-sm">{{ labLabel(lab.code) }}</div>
              <div v-if="!lab.data.length" class="text-grey-6 text-caption">
                {{ $t('study.insights.noData') }}
              </div>
              <div v-else class="row q-col-gutter-sm">
                <div v-for="row in lab.data" :key="row.visitType" class="col-12 col-sm-4">
                  <CohortKpiCard
                    :label="visitTypeLabel(row.visitType)"
                    :value="formatLabValue(row.median)"
                    :caption="`n=${row.count} · min ${formatLabValue(row.min)} · max ${formatLabValue(row.max)}`"
                  />
                </div>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStudyStore } from 'src/stores/study-store'
import CohortBarList from './CohortBarList.vue'
import CohortKpiCard from './CohortKpiCard.vue'

const props = defineProps({
  studyCd: { type: String, required: true },
})

const { t } = useI18n()
const studyStore = useStudyStore()

const loading = computed(() => studyStore.cohortInsightsLoading)
const errorMsg = computed(() => studyStore.cohortInsightsError)
const insights = computed(() =>
  studyStore.cohortInsightsStudyCd === props.studyCd ? studyStore.cohortInsights : null,
)

onMounted(() => loadIfNeeded())
watch(() => props.studyCd, () => loadIfNeeded())

async function loadIfNeeded() {
  if (!props.studyCd) return
  if (studyStore.cohortInsightsStudyCd === props.studyCd && studyStore.cohortInsights) return
  try {
    await studyStore.loadCohortInsights(props.studyCd)
  } catch {
    // surfaced via errorMsg
  }
}

// -- Helpers ---------------------------------------------------------------

function pct(num, den) {
  if (!den) return 0
  return Math.round((100 * num) / den)
}

// Show "Atorvastatin" rather than "STROKE_LIPID:DRUG:ATORVASTATIN".
function dropPrefix(code) {
  if (!code) return ''
  const i = code.lastIndexOf(':')
  return i >= 0 ? code.slice(i + 1).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : code
}

const drugItems = computed(() =>
  (insights.value?.drugs || [])
    .filter((d) => d.takingCount > 0 || d.notTakingCount > 0)
    .sort((a, b) => b.takingCount - a.takingCount)
    .map((d) => ({
      key: d.conceptCode,
      label: d.name || dropPrefix(d.conceptCode),
      taking: d.takingCount,
      notTaking: d.notTakingCount,
      totalEnrolled: d.totalEnrolled,
    })),
)

const findingItems = computed(() =>
  (insights.value?.findings || [])
    .filter((f) => f.total > 0)
    .map((f) => ({
      key: f.conceptCode,
      label: f.name,
      positive: f.positive,
      total: f.total,
    })),
)

// Team activity: bars are relative to the cohort size (patients) or to the
// biggest contributor (observations), so both lists stay readable.
const userPatientItems = computed(() => {
  const rows = (insights.value?.userStats || []).filter((u) => u.patientsOwned > 0)
  const total = insights.value?.counts?.enrolled || 0
  return rows
    .slice()
    .sort((a, b) => b.patientsOwned - a.patientsOwned)
    .map((u) => ({ key: u.userCd, label: u.userName || u.userCd, count: u.patientsOwned, total }))
})

const userObservationItems = computed(() => {
  const rows = (insights.value?.userStats || []).filter((u) => u.observationsCreated > 0)
  const total = rows.reduce((sum, u) => sum + u.observationsCreated, 0)
  return rows
    .slice()
    .sort((a, b) => b.observationsCreated - a.observationsCreated)
    .map((u) => ({ key: u.userCd, label: u.userName || u.userCd, count: u.observationsCreated, total }))
})

function selectionItems(data) {
  return (data || []).map((r) => ({
    key: r.optionCode,
    label: r.name,
    count: r.count,
    total: r.total,
  }))
}

const VISIT_TYPE_LABELS = {
  stroke_lipid_v0: 'V0 (Baseline)',
  stroke_lipid_v1: 'V1 (Index Stroke)',
  stroke_lipid_v2: 'V2 (Follow-up)',
}
function visitTypeLabel(code) {
  return VISIT_TYPE_LABELS[code] || code
}

const SELECTION_META = {
  'STROKE_LIPID:ETIOLOGY': { title: 'study.insights.etiology', icon: 'route', color: 'deep-purple' },
  'STROKE_LIPID:EVENT_TYPE': { title: 'study.insights.eventType', icon: 'emergency', color: 'red' },
}
function selectionTitle(code) {
  const meta = SELECTION_META[code]
  return meta ? t(meta.title) : code
}
function selectionIcon(code) {
  return SELECTION_META[code]?.icon || 'category'
}
function selectionColor(code) {
  return SELECTION_META[code]?.color || 'primary'
}

const LAB_LABELS = {
  'LID: 22748-8': 'LDL-Cholesterol (mmol/l)',
  'LID: 14646-4': 'HDL-Cholesterol (mmol/l)',
}
function labLabel(code) {
  return LAB_LABELS[code] || code
}
function formatLabValue(v) {
  if (v == null || !isFinite(v)) return '—'
  return Number(v).toFixed(2)
}
</script>

<style lang="scss" scoped>
.study-insights {
  position: relative;
  min-height: 200px;
}

.insights-grid {
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
</style>
