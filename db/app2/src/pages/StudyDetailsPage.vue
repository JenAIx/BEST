<template>
  <q-page class="q-pa-md">
    <div v-if="loading" class="text-center q-py-xl">
      <q-spinner color="primary" size="48px" />
      <div class="text-grey-6 q-mt-md">{{ $t('study.loadingDetails') }}</div>
    </div>

    <div v-else-if="study">
      <!-- Study Header -->
      <div class="row items-center justify-between q-mb-lg">
        <div class="row items-center q-gutter-md">
          <q-btn flat round icon="arrow_back" @click="goToStudySearch" />
          <q-icon :name="getCategoryIcon(study.category)" :color="getCategoryColor(study.category)" size="48px" />
          <div>
            <div class="text-h4">{{ study.name }}</div>
            <div class="text-caption text-grey-6">
              {{ study.category }} • {{ $t('study.status') }}: {{ study.status }}
            </div>
          </div>
        </div>
        <div class="row q-gutter-sm">
          <q-btn
            color="primary"
            icon="download"
            :label="$t('study.exportCohort')"
            @click="openExportDialog"
            :disable="!study.patientCount"
          >
            <q-tooltip v-if="!study.patientCount">
              {{ $t('study.noPatientsToExport') }}
            </q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Cohort Export Dialog -->
      <q-dialog v-model="exportDialog">
        <q-card style="min-width: 360px">
          <q-card-section>
            <div class="text-h6">{{ $t('study.exportCohort') }}</div>
            <div class="text-caption text-grey-7 q-mt-xs">
              {{ $t('study.exportCohortHint', { count: study.patientCount || 0, name: study.name }) }}
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-option-group
              v-model="exportFormat"
              :options="[
                { label: 'CSV (Spreadsheet)', value: 'csv' },
                { label: 'HL7-JSON (FHIR Composition)', value: 'hl7' },
              ]"
              color="primary"
              type="radio"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat :label="$t('common.cancel')" v-close-popup />
            <q-btn
              color="primary"
              :label="$t('common.export')"
              :loading="exporting"
              @click="runExport"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Study Info Cards -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-md-6">
          <q-card>
            <q-card-section>
              <div class="row items-center justify-between q-mb-md">
                <div class="text-subtitle1">{{ $t('study.studyInformation') }}</div>
                <q-btn v-if="!editMode" flat round dense icon="edit" color="primary" size="sm" @click="startEdit">
                  <q-tooltip>{{ $t('study.editStudy') }}</q-tooltip>
                </q-btn>
                <div v-else class="row q-gutter-xs">
                  <q-btn flat round dense icon="check" color="positive" size="sm" @click="saveStudy" :loading="saving">
                    <q-tooltip>{{ $t('common.save') }}</q-tooltip>
                  </q-btn>
                  <q-btn flat round dense icon="close" color="negative" size="sm" @click="cancelEdit">
                    <q-tooltip>{{ $t('common.cancel') }}</q-tooltip>
                  </q-btn>
                </div>
              </div>
              
              <!-- Edit Mode -->
              <div v-if="editMode" class="q-gutter-md">
                <q-input v-model="editData.name" :label="$t('study.studyName')" outlined dense required />
                <q-select
                  v-model="editData.category"
                  :options="categoryOptions"
                  :label="$t('study.researchCategory')"
                  outlined
                  dense
                  emit-value
                  map-options
                />
                <q-input v-model="editData.description" :label="$t('study.description')" outlined dense type="textarea" rows="3" />
                <q-select
                  v-model="editData.status"
                  :options="statusOptions"
                  :label="$t('study.status')"
                  outlined
                  dense
                  emit-value
                  map-options
                />
                <q-input v-model="editData.principalInvestigator" :label="$t('study.principalInvestigator')" outlined dense />
                <q-input v-model.number="editData.targetPatientCount" :label="$t('study.targetPatientCount')" outlined dense type="number" min="0" />
                <q-input v-model="editData.startDate" :label="$t('study.startDate')" outlined dense type="date" />
                <q-input v-model="editData.endDate" :label="$t('study.endDate')" outlined dense type="date" />
              </div>

              <!-- View Mode -->
              <div v-else class="q-gutter-sm">
                <div class="row q-mb-sm">
                  <div class="col-4 text-caption text-grey-6">{{ $t('study.description') }}:</div>
                  <div class="col-8">{{ study.description || $t('common.notProvided') }}</div>
                </div>
                <div class="row q-mb-sm">
                  <div class="col-4 text-caption text-grey-6">{{ $t('study.principalInvestigator') }}:</div>
                  <div class="col-8">{{ study.principalInvestigator || $t('common.notProvided') }}</div>
                </div>
                <div class="row q-mb-sm">
                  <div class="col-4 text-caption text-grey-6">{{ $t('study.targetPatientCount') }}:</div>
                  <div class="col-8">{{ study.targetPatientCount != null ? study.targetPatientCount : $t('common.notSet') }}</div>
                </div>
                <div class="row q-mb-sm">
                  <div class="col-4 text-caption text-grey-6">{{ $t('study.startDate') }}:</div>
                  <div class="col-8">{{ formatDate(study.startDate) }}</div>
                </div>
                <div class="row q-mb-sm">
                  <div class="col-4 text-caption text-grey-6">{{ $t('study.endDate') }}:</div>
                  <div class="col-8">{{ formatDate(study.endDate) }}</div>
                </div>
                <div class="row q-mb-sm">
                  <div class="col-4 text-caption text-grey-6">{{ $t('study.created') }}:</div>
                  <div class="col-8">{{ formatDate(study.created) }}</div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div class="col-12 col-md-6">
          <q-card>
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">{{ $t('study.progress') }}</div>
              <div class="text-center">
                <div class="text-h4 text-primary q-mb-xs">{{ study.patientCount || 0 }}</div>
                <div class="text-caption text-grey-6 q-mb-md">{{ $t('study.enrolledPatients') }}</div>
                <q-linear-progress
                  :value="study.targetPatientCount ? (study.patientCount || 0) / study.targetPatientCount : 0"
                  color="primary"
                  size="20px"
                  class="q-mt-sm"
                />
                <div class="text-caption text-grey-6 q-mt-sm">
                  {{ study.targetPatientCount ? `${study.patientCount || 0} / ${study.targetPatientCount}` : $t('study.noTargetSet') }}
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Overview / Insights / Audit tabs -->
      <q-tabs v-model="activeTab" dense align="left" indicator-color="primary" class="q-mb-md">
        <q-tab name="overview" icon="info" :label="$t('study.tabOverview')" />
        <q-tab name="insights" icon="insights" :label="$t('study.tabInsights')" />
        <q-tab name="audit" icon="flag" :label="$t('study.tabAudit')">
          <q-badge v-if="openAuditCount > 0" color="negative" floating>{{ openAuditCount }}</q-badge>
        </q-tab>
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="activeTab" animated class="bg-transparent" keep-alive>
        <q-tab-panel name="overview" class="q-pa-none q-pt-md">

      <!-- Enrolled Patients -->
      <q-card>
        <q-card-section>
          <div class="row items-center justify-between q-mb-md">
            <div class="text-subtitle1">
              {{ $t('study.enrolledPatients') }}
              <span v-if="hasPatientFilters" class="text-caption text-grey-6 q-ml-sm">({{ filteredEnrolledPatients.length }} / {{ enrolledPatients.length }})</span>
            </div>
            <div class="row q-gutter-sm">
              <!-- Selection-driven: open exactly the shift-selected cards -->
              <q-btn
                v-if="selectedCount > 0"
                unelevated
                color="primary"
                icon="grid_on"
                :label="$t('study.openSelectedInGrid', { count: selectedCount })"
                @click="openSelectedInGrid"
              />
              <!-- Filter-driven fallback: open the currently filtered list.
                   Only when a filter narrows it — without one this would dump
                   the entire cohort (400+ patients) into the grid -->
              <q-btn
                v-else-if="hasPatientFilters && filteredEnrolledPatients.length"
                outline
                color="primary"
                icon="grid_on"
                :label="$t('study.openFilteredInGrid', { count: filteredEnrolledPatients.length })"
                @click="openFilteredInGrid"
              />
              <q-btn color="primary" icon="add" :label="$t('study.enrollPatient')" @click="showEnrollDialog = true" />
            </div>
          </div>

          <!-- Selection banner: shown once ≥1 card is shift-selected -->
          <q-slide-transition>
            <div v-if="selectedCount > 0" class="row items-center q-gutter-sm q-mb-sm q-pa-sm bg-blue-1 rounded-borders">
              <q-icon name="check_circle" color="primary" size="18px" />
              <span class="text-body2">{{ $t('study.selectedCount', { count: selectedCount }) }}</span>
              <q-space />
              <q-btn flat dense no-caps size="sm" color="primary" icon="select_all" :label="$t('study.selectAllFiltered')" @click="selectAllFiltered" />
              <q-btn flat dense no-caps size="sm" color="grey-8" icon="clear" :label="$t('study.clearSelection')" @click="clearSelection" />
            </div>
          </q-slide-transition>

          <!-- Enrollment status filter + audit filter -->
          <div class="row items-center q-gutter-sm q-mb-sm">
            <q-btn-toggle
              v-model="patientFilters.status"
              :options="statusFilterOptions"
              no-caps
              dense
              unelevated
              toggle-color="primary"
              color="grey-2"
              text-color="grey-8"
            />
            <q-toggle v-model="patientFilters.onlyWithAudits" :label="$t('study.filterOnlyAudits')" dense color="negative" />
            <q-space />
            <template v-if="filteredEnrolledPatients.length && (patientFilters.status !== 'all' || hasPatientFilters)">
              <q-btn
                v-if="patientFilters.status !== 'completed'"
                flat
                dense
                no-caps
                size="sm"
                color="info"
                icon="check_circle"
                :label="$t('study.bulkMarkCompleted')"
                @click="confirmBulkStatus('completed')"
              />
              <q-btn
                v-if="patientFilters.status !== 'active'"
                flat
                dense
                no-caps
                size="sm"
                color="positive"
                icon="play_circle"
                :label="$t('study.bulkMarkActive')"
                @click="confirmBulkStatus('active')"
              />
            </template>
          </div>

          <!-- Patient search + filters (same pattern as /visits) -->
          <q-input v-model="patientFilters.search" :placeholder="$t('visits.searchPatientPlaceholder')" outlined dense clearable debounce="300" class="q-mb-sm">
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
            <template v-slot:append>
              <q-btn flat round dense icon="tune" :color="hasPatientFilters ? 'primary' : ''" @click="showPatientFilters = !showPatientFilters">
                <q-tooltip>{{ $t('visits.advancedFilters') }}</q-tooltip>
              </q-btn>
            </template>
          </q-input>

          <q-slide-transition>
            <div v-show="showPatientFilters" class="q-mb-md q-pa-md bg-grey-1 rounded-borders">
              <div class="row q-col-gutter-md">
                <div class="col-12">
                  <q-range v-model="patientFilters.ageRange" :min="0" :max="120" label color="primary" />
                  <div class="text-caption text-grey-6">{{ $t('patient.age') }}: {{ patientFilters.ageRange.min }} - {{ patientFilters.ageRange.max }}</div>
                </div>
                <div class="col-12 col-sm-6">
                  <q-select v-model="patientFilters.sex" :options="enrolledSexOptions" :label="$t('patient.gender')" outlined dense clearable emit-value map-options />
                </div>
                <div class="col-12 col-sm-6">
                  <q-select v-model="patientFilters.owner" :options="enrolledOwnerOptions" :label="$t('patient.owner')" outlined dense clearable emit-value map-options />
                </div>
              </div>
              <div class="row justify-end q-mt-sm">
                <q-btn flat dense size="sm" :label="$t('common.reset')" @click="resetPatientFilters" />
              </div>
            </div>
          </q-slide-transition>

          <!-- Loading -->
          <div v-if="loadingPatients" class="text-center q-py-md">
            <q-spinner color="primary" size="32px" />
          </div>

          <!-- Patient Cards -->
          <template v-else>
            <div class="patient-cards-grid">
              <PatientCard
                v-for="patient in pagedEnrolledPatients"
                :key="patient.PATIENT_NUM"
                :patient="patient"
                :status="getEnrollmentStatus(patient)"
                :status-options="ENROLLMENT_STATUSES"
                :selected="selectedPatientNums.has(patient.PATIENT_NUM)"
                :select-hint="$t('study.multiSelectHint')"
                @select="onPatientSelect"
                @changed="onPatientChanged"
                @status-change="onEnrollmentStatusChange"
              />
            </div>
            <div v-if="filteredEnrolledPatients.length > enrolledPageSize" class="row justify-center q-mt-md">
              <q-pagination v-model="enrolledPage" :max="Math.ceil(filteredEnrolledPatients.length / enrolledPageSize)" :max-pages="7" direction-links boundary-links size="sm" />
            </div>

            <div v-if="hasPatientFilters && filteredEnrolledPatients.length === 0" class="text-center q-py-lg text-grey-6">
              <q-icon name="person_off" size="40px" class="q-mb-sm" />
              <div>{{ $t('visit.noPatientsFound') }}</div>
            </div>
          </template>

          <!-- No Patients -->
          <div v-if="!loadingPatients && enrolledPatients.length === 0" class="text-center q-py-xl">
            <q-icon name="people_outline" size="64px" color="grey-5" />
            <div class="text-h6 text-grey-6 q-mt-md">{{ $t('study.noEnrolledPatients') }}</div>
          </div>
        </q-card-section>
      </q-card>

        </q-tab-panel>
        <q-tab-panel name="insights" class="q-pa-none q-pt-md">
          <StudyInsights v-if="studyCd" :study-cd="studyCd" />
        </q-tab-panel>
        <q-tab-panel name="audit" class="q-pa-none q-pt-md">
          <StudyAuditPanel :study-id="studyId" />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <div v-else class="text-center q-py-xl">
      <q-icon name="biotech" size="64px" color="grey-5" />
      <div class="text-h6 text-grey-6 q-mt-md">{{ $t('study.studyNotFound') }}</div>
      <q-btn color="primary" :label="$t('study.backToStudies')" @click="goToStudySearch" class="q-mt-md" />
    </div>

    <!-- Enroll Patient Dialog -->
    <EnrollPatientDialog
      v-model="showEnrollDialog"
      :enrolled-patient-nums="enrolledPatients.map((p) => p.PATIENT_NUM)"
      @enroll="handleEnrollPatient"
      @cancel="showEnrollDialog = false"
    />

    <!-- Bulk Status Confirmation Dialog -->
    <q-dialog v-model="showBulkStatusDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center">
          <q-avatar icon="rule" color="primary" text-color="white" />
          <span class="q-ml-sm text-h6">{{ $t('study.setStatus') }}</span>
        </q-card-section>

        <q-card-section>
          <div class="text-body1">
            {{ $t('study.bulkStatusConfirm', { count: filteredEnrolledPatients.length, status: bulkStatusLabel }) }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" @click="showBulkStatusDialog = false" />
          <q-btn color="primary" :label="$t('study.setStatus')" @click="applyBulkStatus" :loading="bulkStatusSaving" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotify } from 'src/composables/useNotify'
import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useStudyStore } from 'src/stores/study-store'
import { useExportStore } from 'src/stores/export-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { usePatientStudyActions } from 'src/composables/usePatientStudyActions'
import { ENROLLMENT_STATUSES, normalizeEnrollmentStatus } from 'src/shared/utils/enrollment-status.js'
import EnrollPatientDialog from 'src/components/study/EnrollPatientDialog.vue'
import PatientCard from 'src/components/shared/PatientCard.vue'
import StudyInsights from 'src/components/study/StudyInsights.vue'
import StudyAuditPanel from 'src/components/study/StudyAuditPanel.vue'

const route = useRoute()
const router = useRouter()
const notify = useNotify()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const studyStore = useStudyStore()
const exportStore = useExportStore()
const localSettings = useLocalSettingsStore()
const studyActions = usePatientStudyActions()

// State
const loading = ref(true)
const saving = ref(false)
const study = ref(null)
const editMode = ref(false)
const editData = ref({})
const enrolledPatients = ref([])
const enrolledPage = ref(1)
const enrolledPageSize = 24

// Quick filters over the loaded enrolled list (client-side; same UX as /visits)
const showPatientFilters = ref(false)
const DEFAULT_PATIENT_AGE_RANGE = { min: 0, max: 120 }
const patientFilters = ref({
  search: '',
  sex: null,
  owner: null,
  ageRange: { ...DEFAULT_PATIENT_AGE_RANGE },
  status: 'all', // enrollment status: all | active | completed | withdrawn
  onlyWithAudits: false,
})

const hasPatientFilters = computed(
  () =>
    !!patientFilters.value.search ||
    !!patientFilters.value.sex ||
    !!patientFilters.value.owner ||
    patientFilters.value.status !== 'all' ||
    patientFilters.value.onlyWithAudits ||
    patientFilters.value.ageRange.min !== DEFAULT_PATIENT_AGE_RANGE.min ||
    patientFilters.value.ageRange.max !== DEFAULT_PATIENT_AGE_RANGE.max,
)

const statusFilterOptions = computed(() => [
  { label: t('study.enrollmentStatus.all'), value: 'all' },
  ...ENROLLMENT_STATUSES.map((s) => ({ label: t(s.labelKey), value: s.code })),
])

// Audit data (shared with the audit tab via study-store)
const openAuditCount = computed(() => (studyStore.auditSummaryStudyId === studyId ? studyStore.auditSummary?.total || 0 : 0))

const auditCountByPatient = computed(() => {
  const map = new Map()
  if (studyStore.auditSummaryStudyId !== studyId) return map
  for (const row of studyStore.auditSummary?.byPatient || []) {
    map.set(row.patientNum, row.auditCount)
  }
  return map
})

// Options derived from the actual list, so they always match the data
const enrolledSexOptions = computed(() => [...new Set(enrolledPatients.value.map((p) => p.SEX_CD).filter(Boolean))].map((v) => ({ label: v, value: v })))

// Owner options: real owners plus an explicit "no owner" entry — imported
// patients usually have only public access and no creator row
const NO_OWNER = '__none__'
const enrolledOwnerOptions = computed(() => {
  const options = [...new Set(enrolledPatients.value.map((p) => p.owner).filter(Boolean))].map((v) => ({ label: v, value: v }))
  if (enrolledPatients.value.some((p) => !p.owner)) {
    options.push({ label: t('patient.noOwnerOption'), value: NO_OWNER })
  }
  return options
})

const filteredEnrolledPatients = computed(() => {
  const f = patientFilters.value
  const query = (f.search || '').toLowerCase().trim()
  return enrolledPatients.value.filter((p) => {
    if (query && !(String(p.name || '').toLowerCase().includes(query) || String(p.PATIENT_CD || '').toLowerCase().includes(query))) return false
    if (f.sex && p.SEX_CD !== f.sex) return false
    if (f.owner === NO_OWNER) {
      if (p.owner) return false
    } else if (f.owner && p.owner !== f.owner) {
      return false
    }
    if (f.status !== 'all' && normalizeEnrollmentStatus(p.ENROLLMENT_STATUS_CD) !== f.status) return false
    if (f.onlyWithAudits && !auditCountByPatient.value.has(p.PATIENT_NUM)) return false
    if (f.ageRange.min !== DEFAULT_PATIENT_AGE_RANGE.min || f.ageRange.max !== DEFAULT_PATIENT_AGE_RANGE.max) {
      const age = p.AGE_IN_YEARS
      if (age == null || age < f.ageRange.min || age > f.ageRange.max) return false
    }
    return true
  })
})

const resetPatientFilters = () => {
  patientFilters.value = {
    search: '',
    sex: null,
    owner: null,
    ageRange: { ...DEFAULT_PATIENT_AGE_RANGE },
    status: 'all',
    onlyWithAudits: false,
  }
}

// The audit filter needs the audit summary — load it lazily on first use
watch(
  () => patientFilters.value.onlyWithAudits,
  async (active) => {
    if (active && studyStore.auditSummaryStudyId !== studyId) {
      try {
        await studyStore.loadStudyAudit(studyId)
      } catch {
        // surfaced in the audit tab; the filter just matches nothing
      }
    }
  },
)

// Back to page 1 whenever the filter changes
watch(
  patientFilters,
  () => {
    enrolledPage.value = 1
  },
  { deep: true },
)

const pagedEnrolledPatients = computed(() => {
  const start = (enrolledPage.value - 1) * enrolledPageSize
  return filteredEnrolledPatients.value.slice(start, start + enrolledPageSize)
})
const loadingPatients = ref(false)
const showEnrollDialog = ref(false)
const enrolling = ref(false)

// Tabs (Overview / Insights)
const activeTab = ref('overview')
// study.STUDY_CD is the unprefixed identifier most consumers want; some
// upstream transforms surface it as `studyCd` instead. Try both.
const studyCd = computed(() => study.value?.STUDY_CD || study.value?.studyCd || null)

// Cohort export
const exportDialog = ref(false)
const exportFormat = ref('csv')
const exporting = ref(false)
const openExportDialog = () => {
  exportFormat.value = 'csv'
  exportDialog.value = true
}
const runExport = async () => {
  if (!study.value?.STUDY_CD && !study.value?.studyCd) {
    notify.error(t('study.missingStudyCode'))
    return
  }
  const studyCd = study.value.STUDY_CD || study.value.studyCd
  exporting.value = true
  try {
    const result = await exportStore.exportStudyPatients(studyCd, exportFormat.value)
    notify.success(
      t('study.exportSucceeded', { count: result.recordCount, filename: result.filename }),
    )
    exportDialog.value = false
  } catch (e) {
    notify.error(e.message)
  } finally {
    exporting.value = false
  }
}

// Get study ID from route
const studyId = parseInt(route.params.studyId)

// Options
const categoryOptions = [
  { label: 'Neurological Assessment', value: 'Neurological Assessment' },
  { label: 'Clinical Scales', value: 'Clinical Scales' },
  { label: 'Stroke Research', value: 'Stroke Research' },
  { label: 'Psychological Assessment', value: 'Psychological Assessment' },
  { label: 'Imaging Studies', value: 'Imaging Studies' },
  { label: 'Laboratory Research', value: 'Laboratory Research' },
]

const statusOptions = [
  { label: 'Planning', value: 'planning' },
  { label: 'Active', value: 'active' },
  { label: 'On Hold', value: 'on-hold' },
  { label: 'Completed', value: 'completed' },
]


// Methods — `silent: true` skips the loading flags so refreshes after
// mutations don't swap the whole page (or list) to a spinner.
const loadStudy = async ({ silent = false } = {}) => {
  try {
    if (!silent) loading.value = true
    if (!dbStore.canPerformOperations) return

    const loadedStudy = await studyStore.loadStudyById(studyId)
    if (loadedStudy) {
      study.value = loadedStudy
      editData.value = { ...loadedStudy }
    } else {
      study.value = null
    }
  } catch (error) {
    console.error('Failed to load study:', error)
    notify.error(t('study.failedToLoad'))
  } finally {
    if (!silent) loading.value = false
  }
}

const loadEnrolledPatients = async ({ silent = false } = {}) => {
  try {
    if (!silent) loadingPatients.value = true
    if (!dbStore.canPerformOperations) return

    // Access-filtered: regular users only see enrolled patients they may access
    const patients = await dbStore.getEnrolledPatientsForStudy(studyId)
    const accessMap = await dbStore.getPatientAccessInfo(patients.map((p) => p.PATIENT_NUM))

    // Transform to the standard PatientCard shape (raw fields kept for withdraw)
    enrolledPatients.value = patients.map((p) => ({
      ...p,
      id: p.PATIENT_CD,
      name: getPatientName(p),
      age: p.AGE_IN_YEARS ?? null,
      lastVisit: p.ENROLLMENT_DATE ? formatDate(p.ENROLLMENT_DATE) : null,
      owner: accessMap.get(p.PATIENT_NUM)?.ownerUserCd || null,
      isPublic: accessMap.get(p.PATIENT_NUM)?.isPublic || false,
    }))
  } catch (error) {
    console.error('Failed to load enrolled patients:', error)
    notify.error(t('study.failedToLoadPatients'))
  } finally {
    if (!silent) loadingPatients.value = false
  }
}


const saveStudy = async () => {
  try {
    saving.value = true
    if (!dbStore.canPerformOperations) return

    const studyRepo = dbStore.getRepository('study')
    await studyRepo.update(studyId, {
      NAME_CHAR: editData.value.name,
      CATEGORY_CHAR: editData.value.category,
      DESCRIPTION_CHAR: editData.value.description,
      STATUS_CD: editData.value.status,
      PRINCIPAL_INVESTIGATOR: editData.value.principalInvestigator,
      TARGET_PATIENT_COUNT: editData.value.targetPatientCount,
      START_DATE: editData.value.startDate,
      END_DATE: editData.value.endDate,
    })

    await loadStudy()
    editMode.value = false

    notify.success(t('study.studyUpdated'))
  } catch (error) {
    console.error('Failed to save study:', error)
    notify.error(t('study.failedToSave'))
  } finally {
    saving.value = false
  }
}

const startEdit = () => {
  editData.value = { ...study.value }
  editMode.value = true
}

const cancelEdit = () => {
  editData.value = { ...study.value }
  editMode.value = false
}

const handleEnrollPatient = async ({ patientNums, enrollmentDate }) => {
  try {
    enrolling.value = true
    if (!dbStore.canPerformOperations) return

    for (const patientNum of patientNums) {
      await studyStore.enrollPatientInStudy(studyId, patientNum, { ENROLLMENT_DATE: enrollmentDate })
    }

    // Silent refresh: new rows appear without swapping the page to a spinner
    await loadEnrolledPatients({ silent: true })
    loadStudy({ silent: true }).catch(() => {})

    showEnrollDialog.value = false

    notify.success(t('study.patientsEnrolledCount', { count: patientNums.length }))
  } catch (error) {
    console.error('Failed to enroll patients:', error)
    notify.error(t('study.failedToEnroll'))
  } finally {
    enrolling.value = false
  }
}

// Helper methods
const getCategoryIcon = (category) => {
  return studyStore.getCategoryIcon(category)
}

const getCategoryColor = (category) => {
  return studyStore.getCategoryColor(category)
}

const formatDate = (dateStr) => {
  if (!dateStr) return t('common.notProvided')
  return new Date(dateStr).toLocaleDateString()
}

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
  return patient.PATIENT_CD || t('patient.unknownPatient')
}


const getEnrollmentStatusColor = (status) => {
  const colors = {
    active: 'positive',
    withdrawn: 'negative',
    completed: 'info',
  }
  return colors[status] || 'grey'
}

// Status object for the PatientCard chip (code drives the dropdown highlight)
const getEnrollmentStatus = (patient) => {
  const code = normalizeEnrollmentStatus(patient.ENROLLMENT_STATUS_CD)
  const meta = ENROLLMENT_STATUSES.find((s) => s.code === code)
  return {
    code,
    label: meta ? t(meta.labelKey) : code,
    color: getEnrollmentStatusColor(code),
  }
}

// Targeted card update: patch the affected patient's enrollment status in the
// local list after the DB write is confirmed — no page/list reload. The study
// header (patient count) is refreshed silently in the background because
// withdrawn patients drop out of the count.
const patchEnrollmentStatusLocally = (patientNums, status) => {
  const nums = new Set(Array.isArray(patientNums) ? patientNums : [patientNums])
  for (const p of enrolledPatients.value) {
    if (nums.has(p.PATIENT_NUM)) p.ENROLLMENT_STATUS_CD = status
  }
  loadStudy({ silent: true }).catch(() => {})
}

// Single-patient status change via the PatientCard chip dropdown
const onEnrollmentStatusChange = async ({ patient, status }) => {
  if (normalizeEnrollmentStatus(patient.ENROLLMENT_STATUS_CD) === status) return
  const detail = await studyActions.setStatus(studyId, patient.PATIENT_NUM, status)
  if (detail) patchEnrollmentStatusLocally([patient.PATIENT_NUM], status)
}

// Bulk status change (applies to the currently filtered list)
const showBulkStatusDialog = ref(false)
const bulkStatusSaving = ref(false)
const bulkStatusTarget = ref(null)

const bulkStatusLabel = computed(() => {
  const meta = ENROLLMENT_STATUSES.find((s) => s.code === bulkStatusTarget.value)
  return meta ? t(meta.labelKey) : bulkStatusTarget.value || ''
})

const confirmBulkStatus = (status) => {
  bulkStatusTarget.value = status
  showBulkStatusDialog.value = true
}

const applyBulkStatus = async () => {
  const patientNums = filteredEnrolledPatients.value.map((p) => p.PATIENT_NUM)
  if (!patientNums.length || !bulkStatusTarget.value) {
    showBulkStatusDialog.value = false
    return
  }
  try {
    bulkStatusSaving.value = true
    await studyStore.setEnrollmentStatus(studyId, patientNums, bulkStatusTarget.value)
    patchEnrollmentStatusLocally(patientNums, bulkStatusTarget.value)
    showBulkStatusDialog.value = false
    notify.success(t('study.statusChanged'))
  } catch (error) {
    console.error('Failed to bulk-change enrollment status:', error)
    notify.error(t('study.failedToSetStatus'))
  } finally {
    bulkStatusSaving.value = false
  }
}

// Open the currently filtered patients in the grid editor (e.g. status filter
// "active" → work on exactly the open patients)
const openFilteredInGrid = () => {
  const patientCds = filteredEnrolledPatients.value.map((p) => String(p.PATIENT_CD)).filter(Boolean)
  if (!patientCds.length) return
  localSettings.setDataGridSelectedPatients(patientCds)
  if (patientFilters.value.onlyWithAudits) {
    localSettings.setPendingAuditFilter(true)
  }
  router.push('/data-grid/editor')
}

const goToStudySearch = () => {
  router.push('/studies')
}

// Context-menu mutation. Study-membership changes arrive with a confirmed
// detail ({type, studyNum, patientNum, status}) and patch the affected card
// in place; everything else (delete, public toggle, owner change, …) falls
// back to a silent full reload — no page-level spinner either way.
const onPatientChanged = async (detail) => {
  if (detail?.type === 'status' || detail?.type === 'withdraw') {
    if (detail.studyNum === studyId) {
      patchEnrollmentStatusLocally([detail.patientNum], detail.status)
    }
    return
  }
  if (detail?.type === 'enroll') {
    // Enrolled into this study via menu → the patient may be new to the list
    if (detail.studyNum === studyId) {
      await loadEnrolledPatients({ silent: true })
      loadStudy({ silent: true }).catch(() => {})
    }
    return
  }
  await Promise.all([loadStudy({ silent: true }), loadEnrolledPatients({ silent: true })])
  studyStore.loadStudyAudit(studyId).catch(() => {})
}

// --- Multi-select (shift-click) --------------------------------------------
// Plain click navigates to the patient; Shift/Ctrl/Meta-click toggles the card
// in a selection set. Once ≥1 card is selected, plain clicks toggle too (so the
// user can keep building the selection without holding a modifier). "Open in
// grid" then works on exactly the selected cards.
const selectedPatientNums = ref(new Set())
const selectedCount = computed(() => selectedPatientNums.value.size)

const toggleSelection = (patientNum) => {
  const next = new Set(selectedPatientNums.value)
  if (next.has(patientNum)) next.delete(patientNum)
  else next.add(patientNum)
  selectedPatientNums.value = next
}

const clearSelection = () => {
  selectedPatientNums.value = new Set()
}

const selectAllFiltered = () => {
  selectedPatientNums.value = new Set(filteredEnrolledPatients.value.map((p) => p.PATIENT_NUM))
}

const onPatientSelect = (patient, evt) => {
  const isModifier = evt && (evt.shiftKey || evt.ctrlKey || evt.metaKey)
  if (isModifier || selectedPatientNums.value.size > 0) {
    toggleSelection(patient.PATIENT_NUM)
    return
  }
  // Plain click, no active selection → navigate (redirects to /visits/:id)
  if (patient.PATIENT_CD) {
    router.push(`/patient/${patient.PATIENT_CD}`)
  }
}

const openSelectedInGrid = () => {
  const selected = enrolledPatients.value.filter((p) => selectedPatientNums.value.has(p.PATIENT_NUM))
  const patientCds = selected.map((p) => String(p.PATIENT_CD)).filter(Boolean)
  if (!patientCds.length) return
  localSettings.setDataGridSelectedPatients(patientCds)
  if (patientFilters.value.onlyWithAudits) {
    localSettings.setPendingAuditFilter(true)
  }
  router.push('/data-grid/editor')
}

// Initialize
onMounted(async () => {
  await loadStudy()
  if (study.value) {
    await loadEnrolledPatients()
    // Non-blocking: audit summary feeds the tab badge + audit filter
    studyStore.loadStudyAudit(studyId).catch(() => {})
  }
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

.q-card {
  border-radius: 12px;
}

// Make table rows clickable
:deep(.q-table tbody tr) {
  cursor: pointer;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
}
</style>

