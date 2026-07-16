<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="text-h6">{{ $t('patient.studyInfo') }}</div>
        <q-space />
        <q-btn flat round dense icon="refresh" size="sm" :loading="loading" @click="loadData">
          <q-tooltip>{{ $t('common.refresh') }}</q-tooltip>
        </q-btn>
      </div>

      <!-- Memberships with status control -->
      <div v-if="memberships.length === 0 && !loading" class="text-grey-6 q-mb-md">
        {{ $t('patient.noStudyMemberships') }}
      </div>
      <q-list v-else bordered separator class="q-mb-md">
        <q-item v-for="member in memberships" :key="member.studyNum">
          <q-item-section avatar>
            <q-icon name="biotech" color="primary" size="24px" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ member.label }}</q-item-label>
            <q-item-label caption>
              {{ $t('study.enrollmentDate') }}: {{ formatDate(member.enrollmentDate) }}
              <template v-if="member.status === 'withdrawn' && member.withdrawalDate">
                · {{ $t('study.enrollmentStatus.withdrawn') }}: {{ formatDate(member.withdrawalDate) }}
              </template>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn-toggle
              :model-value="member.status"
              :options="statusToggleOptions"
              dense
              no-caps
              size="sm"
              unelevated
              toggle-color="primary"
              color="grey-2"
              text-color="grey-8"
              @update:model-value="(status) => setStatus(member, status)"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <!-- Add to study -->
      <div class="row items-center q-gutter-sm">
        <q-select
          v-model="studyToAdd"
          :options="availableStudyOptions"
          :label="$t('patient.addToStudy')"
          outlined
          dense
          emit-value
          map-options
          class="col"
          :disable="availableStudyOptions.length === 0"
        />
        <q-btn
          color="primary"
          icon="add"
          :label="$t('study.enroll')"
          :disable="studyToAdd == null"
          :loading="enrolling"
          @click="enrollInStudy"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLoggingStore } from 'src/stores/logging-store'
import { usePatientStudyActions } from 'src/composables/usePatientStudyActions'
import { ENROLLMENT_STATUSES } from 'src/shared/utils/enrollment-status.js'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['updated'])

const { t } = useI18n()
const actions = usePatientStudyActions()
const logger = useLoggingStore().createLogger('PatientStudyInfoCard')

const loading = ref(false)
const enrolling = ref(false)
const memberships = ref([])
const allStudies = ref([])
const studyToAdd = ref(null)

const statusToggleOptions = computed(() =>
  ENROLLMENT_STATUSES.map((s) => ({ label: t(s.labelKey), value: s.code })),
)

// Studies the patient is not (or no longer) actively enrolled in
const availableStudyOptions = computed(() => {
  const activeNums = new Set(memberships.value.filter((m) => m.status !== 'withdrawn').map((m) => m.studyNum))
  return allStudies.value
    .filter((s) => !activeNums.has(s.studyNum))
    .map((s) => ({ label: s.label, value: s.studyNum }))
})

const patientNum = computed(() => props.patient?.PATIENT_NUM ?? props.patient?.rawData?.PATIENT_NUM ?? null)

const loadData = async () => {
  if (patientNum.value == null) return
  loading.value = true
  try {
    const [rows, studies] = await Promise.all([
      actions.loadMemberships(patientNum.value),
      actions.loadAllStudies(),
    ])
    memberships.value = rows
    allStudies.value = studies
  } catch (error) {
    logger.error('Failed to load study info', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(patientNum, () => loadData())

const setStatus = async (member, status) => {
  if (!status || member.status === status) return
  const detail = await actions.setStatus(member.studyNum, patientNum.value, status)
  if (detail) {
    // Targeted update: patch the membership row in place, no full reload
    member.status = detail.status
    emit('updated', detail)
  }
}

const enrollInStudy = async () => {
  if (studyToAdd.value == null || patientNum.value == null) return
  enrolling.value = true
  try {
    const study = allStudies.value.find((s) => s.studyNum === studyToAdd.value)
    const detail = await actions.enroll(studyToAdd.value, patientNum.value, study?.label || '')
    if (detail) {
      studyToAdd.value = null
      await loadData()
      emit('updated', detail)
    }
  } finally {
    enrolling.value = false
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return t('common.unknown')
  return new Date(dateStr).toLocaleDateString()
}
</script>
