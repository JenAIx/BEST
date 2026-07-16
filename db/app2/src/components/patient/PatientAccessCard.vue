<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="text-h6">{{ $t('patient.accessRights') }}</div>
        <q-space />
        <q-btn flat round dense icon="refresh" size="sm" :loading="loading" @click="loadData">
          <q-tooltip>{{ $t('common.refresh') }}</q-tooltip>
        </q-btn>
      </div>

      <!-- Owner -->
      <div class="row items-center q-mb-sm">
        <q-icon name="person" size="20px" color="grey-7" class="q-mr-sm" />
        <div class="col">
          <div class="text-caption text-grey-6">{{ $t('patient.owner') }}</div>
          <div class="text-body2">{{ ownerLabel }}</div>
        </div>
      </div>

      <!-- Public visibility toggle -->
      <div class="row items-center q-mb-md">
        <q-icon :name="accessInfo.isPublic ? 'public' : 'lock'" size="20px" :color="accessInfo.isPublic ? 'positive' : 'grey-7'" class="q-mr-sm" />
        <div class="col">
          <div class="text-caption text-grey-6">{{ $t('patient.visibility') }}</div>
          <div class="text-body2">{{ accessInfo.isPublic ? $t('patient.publicAccess') : $t('patient.privateAccess') }}</div>
        </div>
        <q-toggle
          :model-value="accessInfo.isPublic"
          :disable="!canManage || saving"
          color="positive"
          @update:model-value="onTogglePublic"
        >
          <q-tooltip v-if="!canManage">{{ $t('patient.accessNoPermission') }}</q-tooltip>
        </q-toggle>
      </div>

      <!-- Change owner -->
      <div v-if="canManage" class="row items-center q-gutter-sm">
        <q-select
          v-model="newOwnerId"
          :options="ownerOptions"
          :label="$t('patient.newOwner')"
          outlined
          dense
          emit-value
          map-options
          class="col"
        />
        <q-btn
          color="primary"
          icon="manage_accounts"
          :label="$t('patient.menuChangeOwner')"
          :disable="newOwnerId === null || saving"
          :loading="saving"
          @click="onTransferOwner"
        />
      </div>
      <div v-else class="text-caption text-grey-6">
        {{ $t('patient.accessNoPermission') }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLoggingStore } from 'src/stores/logging-store'
import { usePatientAccessActions } from 'src/composables/usePatientAccessActions'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['updated'])

const { t } = useI18n()
const actions = usePatientAccessActions()
const logger = useLoggingStore().createLogger('PatientAccessCard')

const loading = ref(false)
const saving = ref(false)
const accessInfo = ref({ ownerUserId: null, ownerUserCd: null, ownerName: null, isPublic: false })
const ownerOptions = ref([])
const newOwnerId = ref(null)

const patientNum = computed(() => props.patient?.PATIENT_NUM ?? props.patient?.rawData?.PATIENT_NUM ?? null)
const canManage = computed(() => actions.canManage(accessInfo.value))

const ownerLabel = computed(() => {
  const info = accessInfo.value
  if (info.ownerUserId == null) return t('patient.noOwner')
  if (info.ownerName) return `${info.ownerName} (${info.ownerUserCd})`
  return info.ownerUserCd || String(info.ownerUserId)
})

const loadData = async () => {
  if (patientNum.value == null) return
  loading.value = true
  try {
    accessInfo.value = await actions.loadAccessInfo(patientNum.value)
    // Owner options only matter when the user may manage
    if (canManage.value) {
      ownerOptions.value = await actions.loadUserOptions(accessInfo.value.ownerUserId)
    }
    newOwnerId.value = null
  } catch (error) {
    logger.error('Failed to load access info', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(patientNum, () => loadData())

const onTogglePublic = async (value) => {
  saving.value = true
  try {
    const detail = await actions.setPublic(patientNum.value, value)
    if (detail) {
      accessInfo.value = { ...accessInfo.value, isPublic: detail.isPublic }
      emit('updated', detail)
    }
  } finally {
    saving.value = false
  }
}

const onTransferOwner = async () => {
  if (newOwnerId.value == null) return
  saving.value = true
  try {
    const detail = await actions.transferOwner(patientNum.value, newOwnerId.value)
    if (detail) {
      await loadData()
      emit('updated', detail)
    }
  } finally {
    saving.value = false
  }
}
</script>
