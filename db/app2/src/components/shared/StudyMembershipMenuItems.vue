<template>
  <!-- Two context-menu entries: study membership toggle + enrollment status.
       Designed to sit inside a q-menu > q-list (PatientCardMenu, grid patient
       cell). Loads its data on mount — q-menu mounts content lazily, so this
       fires when the parent menu opens. -->

  <!-- Studienzugehörigkeit: enroll / withdraw toggle per study -->
  <q-item clickable>
    <q-item-section avatar><q-icon name="biotech" size="18px" /></q-item-section>
    <q-item-section>{{ $t('patient.menuAssignStudy') }}</q-item-section>
    <q-item-section side><q-icon name="keyboard_arrow_right" size="18px" /></q-item-section>
    <q-menu anchor="top end" self="top start">
      <q-list dense style="min-width: 200px">
        <q-item v-if="studyItems.length === 0" disable>
          <q-item-section class="text-grey-6">{{ $t('study.noStudiesFound') }}</q-item-section>
        </q-item>
        <q-item v-for="study in studyItems" :key="study.studyNum" clickable v-close-popup @click="onToggleMembership(study)">
          <q-item-section avatar>
            <q-icon :name="study.enrolled ? 'person_remove' : 'add'" size="16px" :color="study.enrolled ? 'negative' : 'grey-7'" />
          </q-item-section>
          <q-item-section>
            {{ study.label }}
            <q-item-label v-if="study.enrolled" caption class="text-positive">{{ $t('patient.menuEnrolledHint') }}</q-item-label>
          </q-item-section>
          <q-tooltip>{{ study.enrolled ? $t('patient.menuUnassignHint') : $t('patient.menuAssignHint') }}</q-tooltip>
        </q-item>
      </q-list>
    </q-menu>
  </q-item>

  <!-- Studienstatus: current status shown, toggle active/completed/withdrawn -->
  <q-item clickable :disable="memberItems.length === 0">
    <q-item-section avatar><q-icon name="rule" size="18px" /></q-item-section>
    <q-item-section>
      {{ $t('patient.menuStudyStatus') }}
      <q-item-label v-if="memberItems.length === 0" caption class="text-grey-6">{{ $t('patient.menuNoStudyMembership') }}</q-item-label>
    </q-item-section>
    <q-item-section side><q-icon name="keyboard_arrow_right" size="18px" /></q-item-section>
    <q-menu v-if="memberItems.length > 0" anchor="top end" self="top start">
      <q-list dense style="min-width: 220px">
        <template v-for="member in memberItems" :key="member.studyNum">
          <q-item-label header class="q-py-xs">{{ member.label }}</q-item-label>
          <q-item
            v-for="option in ENROLLMENT_STATUSES"
            :key="`${member.studyNum}-${option.code}`"
            clickable
            v-close-popup
            dense
            :active="member.status === option.code"
            @click="onSetStatus(member, option.code)"
          >
            <q-item-section avatar>
              <q-icon :name="option.icon" :color="option.color" size="16px" />
            </q-item-section>
            <q-item-section>{{ $t(option.labelKey) }}</q-item-section>
            <q-item-section v-if="member.status === option.code" side>
              <q-icon name="check" size="16px" color="primary" />
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </q-menu>
  </q-item>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { usePatientStudyActions } from 'src/composables/usePatientStudyActions'
import { useLoggingStore } from 'src/stores/logging-store'
import { ENROLLMENT_STATUSES } from 'src/shared/utils/enrollment-status.js'

const props = defineProps({
  // Patient in any card shape: needs PATIENT_NUM or id/PATIENT_CD for lookup
  patient: {
    type: Object,
    required: true,
  },
  // Change callback (bound via @changed). Declared as a prop instead of
  // defineEmits on purpose: the component lives inside q-menu content and is
  // unmounted the moment v-close-popup fires — an emit() after the awaited DB
  // write would be dropped (unmounted instance). The handlers capture this
  // function in their closure BEFORE awaiting, so the call still reaches the
  // parent after unmount.
  //
  // Called with a detail object AFTER the DB write is confirmed:
  //   { type: 'enroll'|'withdraw'|'status', studyNum, patientNum, status }
  // so parents can patch the affected card in place instead of reloading.
  onChanged: {
    type: Function,
    default: null,
  },
})

const actions = usePatientStudyActions()
const logger = useLoggingStore().createLogger('StudyMembershipMenu')

const patientNum = ref(null)
// All studies with enrolled flag (non-withdrawn membership)
const studyItems = ref([])
// Memberships (any row in STUDY_PATIENT_LOOKUP, incl. withdrawn) with status
const memberItems = ref([])

const loadData = async () => {
  try {
    patientNum.value = await actions.resolvePatientNum(props.patient)
    if (patientNum.value == null) return

    const [memberships, studies] = await Promise.all([
      actions.loadMemberships(patientNum.value),
      actions.loadAllStudies(),
    ])

    const membershipByNum = new Map(memberships.map((m) => [m.studyNum, m]))
    studyItems.value = studies.map((study) => {
      const membership = membershipByNum.get(study.studyNum)
      return {
        ...study,
        enrolled: !!membership && membership.status !== 'withdrawn',
      }
    })
    memberItems.value = memberships
  } catch (error) {
    logger.warn('Failed to load study membership data', error)
  }
}

onMounted(loadData)

// Handlers capture onChanged before awaiting — see prop comment.
const onToggleMembership = async (study) => {
  const changed = props.onChanged
  const detail = study.enrolled
    ? await actions.withdraw(study.studyNum, patientNum.value, study.label)
    : await actions.enroll(study.studyNum, patientNum.value, study.label)
  if (detail) changed?.(detail)
}

const onSetStatus = async (member, status) => {
  if (member.status === status) return
  const changed = props.onChanged
  const detail = await actions.setStatus(member.studyNum, patientNum.value, status)
  if (detail) changed?.(detail)
}
</script>
