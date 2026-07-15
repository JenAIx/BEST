<template>
  <!-- Right-click context menu for the standard PatientCard -->
  <q-menu context-menu touch-position @show="onMenuShow">
    <q-list dense style="min-width: 220px">
      <q-item clickable v-close-popup @click="openVisits">
        <q-item-section avatar><q-icon name="event" size="18px" /></q-item-section>
        <q-item-section>{{ $t('patient.menuOpenVisits') }}</q-item-section>
      </q-item>

      <q-item clickable v-close-popup @click="openPatientData">
        <q-item-section avatar><q-icon name="assignment_ind" size="18px" /></q-item-section>
        <q-item-section>{{ $t('patient.menuPatientData') }}</q-item-section>
      </q-item>

      <q-item clickable v-close-popup @click="openInGrid">
        <q-item-section avatar><q-icon name="grid_on" size="18px" /></q-item-section>
        <q-item-section>{{ $t('patient.menuOpenInGrid') }}</q-item-section>
      </q-item>

      <q-item clickable v-close-popup @click="copyId">
        <q-item-section avatar><q-icon name="content_copy" size="18px" /></q-item-section>
        <q-item-section>{{ $t('patient.menuCopyId') }}</q-item-section>
      </q-item>

      <!-- Assign to study (submenu) -->
      <q-item clickable>
        <q-item-section avatar><q-icon name="biotech" size="18px" /></q-item-section>
        <q-item-section>{{ $t('patient.menuAssignStudy') }}</q-item-section>
        <q-item-section side><q-icon name="keyboard_arrow_right" size="18px" /></q-item-section>
        <q-menu anchor="top end" self="top start">
          <q-list dense style="min-width: 200px">
            <q-item v-if="studyItems.length === 0" disable>
              <q-item-section class="text-grey-6">{{ $t('study.noStudiesFound') }}</q-item-section>
            </q-item>
            <q-item v-for="study in studyItems" :key="study.value" clickable v-close-popup @click="study.enrolled ? unassignFromStudy(study) : assignToStudy(study)">
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

      <q-item clickable v-close-popup @click="showExportDialog = true">
        <q-item-section avatar><q-icon name="download" size="18px" /></q-item-section>
        <q-item-section>{{ $t('patient.menuExport') }}</q-item-section>
      </q-item>

      <template v-if="canManage">
        <q-separator />

        <q-item clickable v-close-popup @click="togglePublic">
          <q-item-section avatar><q-icon :name="accessInfo?.isPublic ? 'public_off' : 'public'" size="18px" /></q-item-section>
          <q-item-section>{{ accessInfo?.isPublic ? $t('patient.menuMakePrivate') : $t('patient.menuMakePublic') }}</q-item-section>
        </q-item>

        <q-item clickable v-close-popup @click="openOwnerDialog">
          <q-item-section avatar><q-icon name="manage_accounts" size="18px" /></q-item-section>
          <q-item-section>{{ $t('patient.menuChangeOwner') }}</q-item-section>
        </q-item>

        <q-item clickable v-close-popup @click="confirmDelete" class="text-negative">
          <q-item-section avatar><q-icon name="delete" size="18px" color="negative" /></q-item-section>
          <q-item-section>{{ $t('common.delete') }}</q-item-section>
        </q-item>
      </template>
    </q-list>
  </q-menu>

  <!-- Export format dialog -->
  <q-dialog v-model="showExportDialog">
    <q-card style="min-width: 320px">
      <q-card-section>
        <div class="text-subtitle1">{{ $t('patient.menuExport') }}</div>
        <div class="text-caption text-grey-7 q-mt-xs">{{ patient.name || patient.id }}</div>
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
        <q-btn color="primary" :label="$t('common.export')" :loading="exporting" @click="runExport" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Change owner dialog -->
  <q-dialog v-model="showOwnerDialog">
    <q-card style="min-width: 320px">
      <q-card-section>
        <div class="text-subtitle1">{{ $t('patient.menuChangeOwner') }}</div>
        <div class="text-caption text-grey-7 q-mt-xs">{{ patient.name || patient.id }}</div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-select v-model="newOwnerId" :options="ownerOptions" :label="$t('patient.newOwner')" outlined dense emit-value map-options />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat :label="$t('common.cancel')" v-close-popup />
        <q-btn color="primary" :label="$t('common.save')" :loading="transferring" :disable="newOwnerId === null" @click="runOwnerTransfer" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <!-- Delete confirmation (existing shared dialog) -->
  <DeletePatientDialog ref="deleteDialog" @deleted="onDeleted" />
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useNotify } from 'src/composables/useNotify'
import { useLoggingStore } from 'src/stores/logging-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import ExportService from 'src/core/services/export-service.js'
import DeletePatientDialog from 'src/components/patient/DeletePatientDialog.vue'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['changed'])

const router = useRouter()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const authStore = useAuthStore()
const notify = useNotify()
const logger = useLoggingStore().createLogger('PatientCardMenu')

// State (loaded lazily when the menu opens)
const accessInfo = ref(null)
const studyItems = ref([])
const patientNum = ref(null)
const showExportDialog = ref(false)
const exportFormat = ref('csv')
const exporting = ref(false)
const showOwnerDialog = ref(false)
const ownerOptions = ref([])
const newOwnerId = ref(null)
const transferring = ref(false)
const deleteDialog = ref(null)

const canManage = computed(() => {
  if (authStore.isAdmin) return true
  const currentUserId = authStore.currentUser?.USER_ID
  return currentUserId !== undefined && currentUserId !== null && accessInfo.value?.ownerUserId === currentUserId
})

// Resolve PATIENT_NUM from the various card shapes (fallback: DB lookup by code)
const resolvePatientNum = async () => {
  const direct = props.patient.PATIENT_NUM ?? props.patient.patient_num ?? props.patient.originalData?.PATIENT_NUM
  if (direct != null) return direct
  const result = await dbStore.executeQuery('SELECT PATIENT_NUM FROM PATIENT_DIMENSION WHERE PATIENT_CD = ?', [props.patient.id])
  return result.success && result.data.length > 0 ? result.data[0].PATIENT_NUM : null
}

const onMenuShow = async () => {
  try {
    patientNum.value = await resolvePatientNum()
    if (patientNum.value == null) return

    const [accessMap, studyMap, studiesResult] = await Promise.all([
      dbStore.getPatientAccessInfo([patientNum.value]),
      dbStore.getPatientStudyInfo([patientNum.value]),
      dbStore.executeQuery('SELECT STUDY_NUM, STUDY_CD, NAME_CHAR FROM STUDY_DIMENSION ORDER BY NAME_CHAR'),
    ])

    accessInfo.value = accessMap.get(patientNum.value) || { ownerUserId: null, ownerUserCd: null, isPublic: false }
    const enrolledCodes = new Set((studyMap.get(patientNum.value) || []).map((s) => s.code))
    studyItems.value = (studiesResult.success ? studiesResult.data : []).map((study) => ({
      label: study.NAME_CHAR,
      value: study.STUDY_NUM,
      enrolled: enrolledCodes.has(study.STUDY_CD),
    }))
  } catch (error) {
    logger.warn('Failed to load context menu data', error)
  }
}

// --- Actions ---------------------------------------------------------------

const localSettings = useLocalSettingsStore()

const openVisits = () => {
  router.push(`/visits/${props.patient.id}`)
}

// Patient data view (demographics + additional info, editable there)
const openPatientData = () => {
  router.push({ path: `/visits/${props.patient.id}`, query: { view: 'patient' } })
}

// Open this single patient in the Excel-like data grid editor
const openInGrid = () => {
  localSettings.setDataGridSelectedPatients([String(props.patient.id)])
  router.push('/data-grid/editor')
}

const copyId = async () => {
  try {
    await navigator.clipboard.writeText(String(props.patient.id))
    notify.success(t('patient.menuIdCopied'), { timeout: 1500 })
  } catch (error) {
    logger.warn('Clipboard write failed', error)
  }
}

const assignToStudy = async (study) => {
  try {
    if (patientNum.value == null) return
    const studyRepo = dbStore.getRepository('study')
    await studyRepo.enrollPatient(study.value, patientNum.value, { ENROLLMENT_STATUS_CD: 'active' })
    notify.success(t('patient.menuAssignedToStudy', { study: study.label }))
    emit('changed')
  } catch (error) {
    logger.error('Failed to assign patient to study', error)
    notify.error(t('study.failedToEnroll'))
  }
}

const unassignFromStudy = async (study) => {
  try {
    if (patientNum.value == null) return
    const studyRepo = dbStore.getRepository('study')
    await studyRepo.withdrawPatient(study.value, patientNum.value)
    notify.success(t('patient.menuUnassignedFromStudy', { study: study.label }))
    emit('changed')
  } catch (error) {
    logger.error('Failed to withdraw patient from study', error)
    notify.error(t('study.failedToWithdraw'))
  }
}

const runExport = async () => {
  try {
    exporting.value = true
    const exportService = new ExportService(dbStore)
    await exportService.initialize()
    const exportResult = await exportService.exportPatients([{ id: props.patient.id }], exportFormat.value, {
      includeVisits: true,
      includeObservations: true,
    })
    exportService.downloadExportedData(exportResult)
    showExportDialog.value = false
    notify.success(t('patient.menuExportDone', { file: exportResult.filename }))
  } catch (error) {
    logger.error('Patient export failed', error)
    notify.error(t('patient.menuExportFailed'))
  } finally {
    exporting.value = false
  }
}

const togglePublic = async () => {
  try {
    if (patientNum.value == null) return
    const makePublic = !accessInfo.value?.isPublic
    await dbStore.setPatientPublicAccess(patientNum.value, makePublic)
    notify.success(makePublic ? t('patient.menuNowPublic') : t('patient.menuNowPrivate'))
    emit('changed')
  } catch (error) {
    logger.error('Failed to toggle public access', error)
    notify.error(error.message)
  }
}

const openOwnerDialog = async () => {
  try {
    const result = await dbStore.executeQuery('SELECT USER_ID, USER_CD, NAME_CHAR FROM USER_MANAGEMENT WHERE USER_ID != 0 ORDER BY USER_CD')
    ownerOptions.value = (result.success ? result.data : []).map((user) => ({
      label: user.NAME_CHAR ? `${user.NAME_CHAR} (${user.USER_CD})` : user.USER_CD,
      value: user.USER_ID,
      disable: user.USER_ID === accessInfo.value?.ownerUserId,
    }))
    newOwnerId.value = null
    showOwnerDialog.value = true
  } catch (error) {
    logger.error('Failed to load user options', error)
  }
}

const runOwnerTransfer = async () => {
  try {
    transferring.value = true
    if (patientNum.value == null) return
    await dbStore.transferPatientOwnership(patientNum.value, newOwnerId.value)
    showOwnerDialog.value = false
    notify.success(t('patient.menuOwnerChanged'))
    emit('changed')
  } catch (error) {
    logger.error('Failed to transfer ownership', error)
    notify.error(error.message)
  } finally {
    transferring.value = false
  }
}

const confirmDelete = () => {
  deleteDialog.value?.show(
    { PATIENT_NUM: patientNum.value, PATIENT_CD: props.patient.id },
    props.patient.name || String(props.patient.id),
  )
}

const onDeleted = () => {
  emit('changed')
}
</script>
