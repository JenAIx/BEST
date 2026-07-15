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

      <!-- Overview / Insights tabs -->
      <q-tabs v-model="activeTab" dense align="left" indicator-color="primary" class="q-mb-md">
        <q-tab name="overview" icon="info" :label="$t('study.tabOverview')" />
        <q-tab name="insights" icon="insights" :label="$t('study.tabInsights')" />
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
            <q-btn color="primary" icon="add" :label="$t('study.enrollPatient')" @click="showEnrollDialog = true" />
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
                :status="{ label: patient.ENROLLMENT_STATUS_CD || 'active', color: getEnrollmentStatusColor(patient.ENROLLMENT_STATUS_CD) }"
                removable
                @select="onPatientSelect"
                @remove="confirmWithdrawPatient"
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

    <!-- Withdraw Confirmation Dialog -->
    <q-dialog v-model="showWithdrawDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center">
          <q-avatar icon="warning" color="warning" text-color="white" />
          <span class="q-ml-sm text-h6">{{ $t('study.confirmWithdrawal') }}</span>
        </q-card-section>

        <q-card-section>
          <div class="text-body1">
            {{ $t('study.withdrawPatientConfirm', { name: patientToWithdraw ? getPatientName(patientToWithdraw) : '' }) }}
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('common.cancel')" @click="showWithdrawDialog = false" />
          <q-btn color="negative" :label="$t('study.withdraw')" @click="withdrawPatient" :loading="withdrawing" />
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
import EnrollPatientDialog from 'src/components/study/EnrollPatientDialog.vue'
import PatientCard from 'src/components/shared/PatientCard.vue'
import StudyInsights from 'src/components/study/StudyInsights.vue'

const route = useRoute()
const router = useRouter()
const notify = useNotify()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const studyStore = useStudyStore()
const exportStore = useExportStore()

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
})

const hasPatientFilters = computed(
  () =>
    !!patientFilters.value.search ||
    !!patientFilters.value.sex ||
    !!patientFilters.value.owner ||
    patientFilters.value.ageRange.min !== DEFAULT_PATIENT_AGE_RANGE.min ||
    patientFilters.value.ageRange.max !== DEFAULT_PATIENT_AGE_RANGE.max,
)

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
  }
}

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
const showWithdrawDialog = ref(false)
const patientToWithdraw = ref(null)
const withdrawing = ref(false)

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


// Methods
const loadStudy = async () => {
  try {
    loading.value = true
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
    loading.value = false
  }
}

const loadEnrolledPatients = async () => {
  try {
    loadingPatients.value = true
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
    loadingPatients.value = false
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

    const studyRepo = dbStore.getRepository('study')
    for (const patientNum of patientNums) {
      await studyRepo.enrollPatient(studyId, patientNum, {
        ENROLLMENT_DATE: enrollmentDate,
        ENROLLMENT_STATUS_CD: 'active',
      })
    }

    // Reload data
    await loadStudy()
    await loadEnrolledPatients()

    showEnrollDialog.value = false

    notify.success(t('study.patientsEnrolledCount', { count: patientNums.length }))
  } catch (error) {
    console.error('Failed to enroll patients:', error)
    notify.error(t('study.failedToEnroll'))
  } finally {
    enrolling.value = false
  }
}

const confirmWithdrawPatient = (patient) => {
  patientToWithdraw.value = patient
  showWithdrawDialog.value = true
}

const withdrawPatient = async () => {
  if (!patientToWithdraw.value) return

  try {
    withdrawing.value = true
    if (!dbStore.canPerformOperations) return

    const studyRepo = dbStore.getRepository('study')
    await studyRepo.withdrawPatient(studyId, patientToWithdraw.value.PATIENT_NUM)

    // Reload data
    await loadStudy()
    await loadEnrolledPatients()

    showWithdrawDialog.value = false
    patientToWithdraw.value = null

    notify.success(t('study.patientWithdrawn'))
  } catch (error) {
    console.error('Failed to withdraw patient:', error)
    notify.error(t('study.failedToWithdraw'))
  } finally {
    withdrawing.value = false
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

const goToStudySearch = () => {
  router.push('/studies')
}

const onPatientSelect = (patient) => {
  // Navigate to patient page using PATIENT_CD (redirects to /visits/:id)
  if (patient.PATIENT_CD) {
    router.push(`/patient/${patient.PATIENT_CD}`)
  }
}

// Initialize
onMounted(async () => {
  await loadStudy()
  if (study.value) {
    await loadEnrolledPatients()
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

