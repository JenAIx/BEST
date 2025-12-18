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

      </div>

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

      <!-- Enrolled Patients -->
      <q-card>
        <q-card-section>
          <div class="row items-center justify-between q-mb-md">
            <div class="text-subtitle1">{{ $t('study.enrolledPatients') }}</div>
            <q-btn color="primary" icon="add" :label="$t('study.enrollPatient')" @click="showEnrollDialog = true" />
          </div>

          <!-- Loading -->
          <div v-if="loadingPatients" class="text-center q-py-md">
            <q-spinner color="primary" size="32px" />
          </div>

          <!-- Patients Table -->
          <q-table
            v-else
            :rows="enrolledPatients"
            :columns="patientColumns"
            row-key="PATIENT_NUM"
            :rows-per-page-options="[10, 25, 50]"
            flat
            bordered
            @row-click="onPatientRowClick"
          >
            <template v-slot:body-cell-name="props">
              <q-td :props="props">
                <div class="row items-center q-gutter-sm">
                  <q-icon name="person" size="20px" :color="getPatientStatusColor(props.row)" />
                  <span>{{ getPatientName(props.row) }}</span>
                </div>
                <q-tooltip>{{ $t('study.goToPatientPage') }}</q-tooltip>
              </q-td>
            </template>

            <template v-slot:body-cell-status="props">
              <q-td :props="props">
                <q-chip :color="getEnrollmentStatusColor(props.row.ENROLLMENT_STATUS_CD)" text-color="white" size="sm">
                  {{ props.row.ENROLLMENT_STATUS_CD || 'active' }}
                </q-chip>
              </q-td>
            </template>

            <template v-slot:body-cell-actions="props">
              <q-td :props="props" @click.stop>
                <q-btn flat round dense icon="delete" color="negative" size="sm" @click="confirmWithdrawPatient(props.row)">
                  <q-tooltip>{{ $t('study.withdrawPatient') }}</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>

          <!-- No Patients -->
          <div v-if="!loadingPatients && enrolledPatients.length === 0" class="text-center q-py-xl">
            <q-icon name="people_outline" size="64px" color="grey-5" />
            <div class="text-h6 text-grey-6 q-mt-md">{{ $t('study.noEnrolledPatients') }}</div>
          </div>
        </q-card-section>
      </q-card>
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useStudyStore } from 'src/stores/study-store'
import EnrollPatientDialog from 'src/components/study/EnrollPatientDialog.vue'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const studyStore = useStudyStore()

// State
const loading = ref(true)
const saving = ref(false)
const study = ref(null)
const editMode = ref(false)
const editData = ref({})
const enrolledPatients = ref([])
const loadingPatients = ref(false)
const showEnrollDialog = ref(false)
const enrolling = ref(false)
const showWithdrawDialog = ref(false)
const patientToWithdraw = ref(null)
const withdrawing = ref(false)

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

const patientColumns = [
  {
    name: 'name',
    label: t('patient.name'),
    field: 'name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'patientCode',
    label: t('patient.patientId'),
    field: 'PATIENT_CD',
    align: 'left',
    sortable: true,
  },
  {
    name: 'enrollmentDate',
    label: t('study.enrollmentDate'),
    field: 'ENROLLMENT_DATE',
    align: 'left',
    sortable: true,
  },
  {
    name: 'status',
    label: t('study.enrollmentStatus'),
    field: 'ENROLLMENT_STATUS_CD',
    align: 'center',
    sortable: true,
  },
  {
    name: 'actions',
    label: t('common.actions'),
    field: 'actions',
    align: 'center',
  },
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
    $q.notify({
      type: 'negative',
      message: t('study.failedToLoad'),
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const loadEnrolledPatients = async () => {
  try {
    loadingPatients.value = true
    if (!dbStore.canPerformOperations) return

    const studyRepo = dbStore.getRepository('study')
    const patients = await studyRepo.getEnrolledPatients(studyId)
    
    // Transform patient data
    enrolledPatients.value = patients.map((p) => ({
      ...p,
      name: getPatientName(p),
    }))
  } catch (error) {
    console.error('Failed to load enrolled patients:', error)
    $q.notify({
      type: 'negative',
      message: t('study.failedToLoadPatients'),
      position: 'top',
    })
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

    $q.notify({
      type: 'positive',
      message: t('study.studyUpdated'),
      position: 'top',
    })
  } catch (error) {
    console.error('Failed to save study:', error)
    $q.notify({
      type: 'negative',
      message: t('study.failedToSave'),
      position: 'top',
    })
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

const handleEnrollPatient = async ({ patientNum, enrollmentDate }) => {
  try {
    enrolling.value = true
    if (!dbStore.canPerformOperations) return

    const studyRepo = dbStore.getRepository('study')
    await studyRepo.enrollPatient(studyId, patientNum, {
      ENROLLMENT_DATE: enrollmentDate,
      ENROLLMENT_STATUS_CD: 'active',
    })

    // Reload data
    await loadStudy()
    await loadEnrolledPatients()

    showEnrollDialog.value = false

    $q.notify({
      type: 'positive',
      message: t('study.patientEnrolled'),
      position: 'top',
    })
  } catch (error) {
    console.error('Failed to enroll patient:', error)
    $q.notify({
      type: 'negative',
      message: t('study.failedToEnroll'),
      position: 'top',
    })
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

    $q.notify({
      type: 'positive',
      message: t('study.patientWithdrawn'),
      position: 'top',
    })
  } catch (error) {
    console.error('Failed to withdraw patient:', error)
    $q.notify({
      type: 'negative',
      message: t('study.failedToWithdraw'),
      position: 'top',
    })
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


const getPatientStatusColor = (patient) => {
  const status = patient.VITAL_STATUS_CD || patient.VITAL_STATUS_RESOLVED
  if (!status) return 'grey'
  if (status.includes('alive') || status === 'A') return 'positive'
  if (status.includes('dead') || status === 'D') return 'negative'
  return 'grey'
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

const onPatientRowClick = (evt, row) => {
  // Navigate to patient page using PATIENT_CD
  if (row.PATIENT_CD) {
    router.push(`/patient/${row.PATIENT_CD}`)
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

