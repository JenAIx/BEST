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
      <!-- Visit Retention (optionally narrowed to an enrolment window) -->
      <q-card flat bordered class="span-2">
        <q-card-section>
          <div class="row items-center q-mb-md q-gutter-x-sm">
            <q-icon name="groups" color="primary" size="24px" />
            <div class="text-subtitle1">{{ $t('study.insights.retention') }}</div>
            <q-space />
            <div class="retention-window row items-center no-wrap q-gutter-x-xs">
              <q-icon name="date_range" color="grey-7" size="18px">
                <q-tooltip>{{ $t('study.insights.windowHint') }}</q-tooltip>
              </q-icon>
              <q-input
                v-model="windowFromText"
                dense
                outlined
                mask="##.##.####"
                placeholder="TT.MM.JJJJ"
                :label="$t('study.insights.windowFrom')"
                :error="windowFromError"
                :error-message="$t('study.insights.windowInvalid')"
                hide-bottom-space
                class="retention-window__input"
                data-cy="insights-window-from"
              >
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="windowFromText" mask="DD.MM.YYYY" minimal>
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup :label="$t('common.close')" color="primary" flat dense />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
              <span class="text-grey-6">–</span>
              <q-input
                v-model="windowToText"
                dense
                outlined
                mask="##.##.####"
                placeholder="TT.MM.JJJJ"
                :label="$t('study.insights.windowTo')"
                :error="windowToError"
                :error-message="windowOrderError ? $t('study.insights.windowOrder') : $t('study.insights.windowInvalid')"
                hide-bottom-space
                class="retention-window__input"
                data-cy="insights-window-to"
              >
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="windowToText" mask="DD.MM.YYYY" minimal>
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup :label="$t('common.close')" color="primary" flat dense />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
              <q-btn
                v-if="windowFromText || windowToText"
                flat
                dense
                round
                icon="close"
                size="sm"
                color="grey-7"
                data-cy="insights-window-clear"
                @click="clearWindow"
              >
                <q-tooltip>{{ $t('study.insights.windowClear') }}</q-tooltip>
              </q-btn>
              <q-spinner v-if="retentionLoading" size="18px" color="primary" />
            </div>
          </div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6 col-md">
              <CohortKpiCard
                :label="$t('study.insights.enrolled')"
                :value="retentionCounts.enrolled"
                :caption="windowCaption"
                icon="how_to_reg"
                icon-color="primary"
              />
            </div>
            <div v-for="vt in retentionCounts.perVisitType" :key="vt.visitType" class="col-12 col-sm-6 col-md">
              <CohortKpiCard
                :label="visitTypeLabel(vt.visitType)"
                :value="vt.patientCount"
                :caption="`${pct(vt.patientCount, retentionCounts.enrolled)}% ${$t('study.insights.ofEnrolled')}`"
                icon="event"
                icon-color="indigo"
              />
            </div>
          </div>

          <!-- Enrolments per month (same card: the window filter dims months outside) -->
          <q-separator class="q-my-md" />
          <div class="row items-center q-mb-xs">
            <q-icon name="bar_chart" color="indigo" size="20px" class="q-mr-sm" />
            <div class="text-body2 text-weight-medium">{{ $t('study.insights.enrollmentsPerMonth') }}</div>
            <q-space />
            <span class="text-caption text-grey-6">{{ $t('study.insights.enrollmentsHint') }}</span>
          </div>
          <div v-if="monthlySummary" class="text-caption text-grey-7 q-mb-sm monthly-summary">
            <span>{{ $t('study.insights.totalEnrolled') }}: <b>{{ monthlySummary.total }}</b></span>
            <span>{{ $t('study.insights.avgPerMonth') }}: <b>{{ formatAvg(monthlySummary.avgPerMonth) }}</b></span>
            <span>{{ $t('study.insights.last12Months') }}: <b>{{ monthlySummary.last12 }}</b></span>
            <span v-if="monthlySummary.peak">
              {{ $t('study.insights.peakMonth') }}:
              <b>{{ formatMonth(monthlySummary.peak.month, monthLocale, 'short') }} ({{ monthlySummary.peak.count }})</b>
            </span>
            <span v-if="insights.enrollmentsPerMonth?.undated">
              {{ $t('study.insights.undated', { n: insights.enrollmentsPerMonth.undated }) }}
            </span>
          </div>
          <CohortMonthlyChart
            :months="insights.enrollmentsPerMonth?.months || []"
            :window-from="activeWindow.from"
            :window-to="activeWindow.to"
            :empty-label="$t('study.insights.noEnrollments')"
          />
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
import { computed, ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStudyStore } from 'src/stores/study-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import {
  buildMonthlySeries,
  formatMonth,
  parseGermanDate,
  summarizeMonthlySeries,
  toGermanDate,
} from 'src/shared/utils/enrollment-timeline'
import CohortBarList from './CohortBarList.vue'
import CohortKpiCard from './CohortKpiCard.vue'
import CohortMonthlyChart from './CohortMonthlyChart.vue'

const props = defineProps({
  studyCd: { type: String, required: true },
})

const { t, locale } = useI18n()
const studyStore = useStudyStore()
const globalSettingsStore = useGlobalSettingsStore()
const monthLocale = computed(() => (String(locale.value).startsWith('en') ? 'en-GB' : 'de-DE'))

const loading = computed(() => studyStore.cohortInsightsLoading)
const errorMsg = computed(() => studyStore.cohortInsightsError)
const insights = computed(() =>
  studyStore.cohortInsightsStudyCd === props.studyCd ? studyStore.cohortInsights : null,
)

onMounted(() => {
  loadIfNeeded()
  restoreWindowFromStore()
})
watch(
  () => props.studyCd,
  () => {
    loadIfNeeded()
    restoreWindowFromStore()
  },
)

async function loadIfNeeded() {
  if (!props.studyCd) return
  if (studyStore.cohortInsightsStudyCd === props.studyCd && studyStore.cohortInsights) return
  try {
    await studyStore.loadCohortInsights(props.studyCd)
  } catch {
    // surfaced via errorMsg
  }
}

// -- Enrolment window ("Visiten-Verlauf" filter) ----------------------------
//
// Text inputs hold DD.MM.YYYY; the store holds ISO dates. A window is applied
// as soon as both inputs are either empty or a complete, valid date. The
// retention KPI tiles then read from `studyStore.cohortRetention` instead of
// the unfiltered `insights.counts`; the monthly chart dims months outside.

const windowFromText = ref('')
const windowToText = ref('')

const windowFromIso = computed(() => parseGermanDate(windowFromText.value))
const windowToIso = computed(() => parseGermanDate(windowToText.value))
const windowFromError = computed(() => windowFromText.value.length === 10 && !windowFromIso.value)
const windowOrderError = computed(
  () => !!windowFromIso.value && !!windowToIso.value && windowToIso.value < windowFromIso.value,
)
const windowToError = computed(
  () => (windowToText.value.length === 10 && !windowToIso.value) || windowOrderError.value,
)
const windowReady = computed(() => {
  const fromOk = !windowFromText.value || !!windowFromIso.value
  const toOk = !windowToText.value || !!windowToIso.value
  return fromOk && toOk && !windowOrderError.value
})

const retentionLoading = computed(() => studyStore.cohortRetentionLoading)
const storedRetention = computed(() =>
  studyStore.cohortRetention?.studyCd === props.studyCd ? studyStore.cohortRetention : null,
)
const activeWindow = computed(() => ({
  from: storedRetention.value?.from ?? null,
  to: storedRetention.value?.to ?? null,
}))
const retentionCounts = computed(
  () => storedRetention.value?.counts || insights.value?.counts || { enrolled: 0, perVisitType: [] },
)
const windowCaption = computed(() => {
  if (!storedRetention.value) return ''
  return t('study.insights.windowActive', {
    from: activeWindow.value.from ? toGermanDate(activeWindow.value.from) : t('study.insights.windowOpenStart'),
    to: activeWindow.value.to ? toGermanDate(activeWindow.value.to) : t('study.insights.windowOpenEnd'),
  })
})

function restoreWindowFromStore() {
  windowFromText.value = toGermanDate(storedRetention.value?.from)
  windowToText.value = toGermanDate(storedRetention.value?.to)
}

function clearWindow() {
  windowFromText.value = ''
  windowToText.value = ''
}

watch([windowFromIso, windowToIso, windowReady], async ([from, to, ready]) => {
  if (!ready || !props.studyCd) return
  if (from === activeWindow.value.from && to === activeWindow.value.to) return
  try {
    await studyStore.loadCohortRetention(props.studyCd, { from, to })
  } catch {
    // surfaced via the store logger; tiles keep the previous counts
  }
})

// -- Enrolments per month ---------------------------------------------------

const monthlySeries = computed(() => buildMonthlySeries(insights.value?.enrollmentsPerMonth?.months || []))
const monthlySummary = computed(() => (monthlySeries.value.length ? summarizeMonthlySeries(monthlySeries.value) : null))
function formatAvg(n) {
  return new Intl.NumberFormat(monthLocale.value, { maximumFractionDigits: 1 }).format(n || 0)
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

// Short study-specific labels keep the KPI tiles compact; anything else
// (e.g. a stray "consultation" visit) resolves to its CODE_LOOKUP label.
const VISIT_TYPE_LABELS = {
  stroke_lipid_v0: 'V0 (Baseline)',
  stroke_lipid_v1: 'V1 (Index Stroke)',
  stroke_lipid_v2: 'V2 (Follow-up)',
}
const visitTypeLabelsFromDb = ref({})
onMounted(async () => {
  try {
    const options = (await globalSettingsStore.getVisitTypeOptions()) || []
    visitTypeLabelsFromDb.value = Object.fromEntries(options.map((o) => [o.value, o.label]))
  } catch {
    // fall back to the static map / raw code
  }
})
function visitTypeLabel(code) {
  return VISIT_TYPE_LABELS[code] || visitTypeLabelsFromDb.value[code] || code
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

.monthly-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.retention-window {
  &__input {
    width: 150px;
  }

  @media (max-width: 600px) {
    width: 100%;
    margin-top: 8px;

    &__input {
      flex: 1 1 auto;
      width: auto;
    }
  }
}
</style>
