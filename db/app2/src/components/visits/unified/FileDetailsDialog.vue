<template>
  <!-- Edit metadata of an R (raw file) observation: title + description are
       stored INSIDE the TVAL_CHAR JSON envelope (additive keys — the
       OBSERVATION_BLOB with the file bytes is never touched). -->
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card style="min-width: 420px; max-width: 520px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-primary">
          <q-icon name="perm_media" class="q-mr-sm" />
          {{ $t('visit.fileDetailsTitle') }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section class="details-form">
        <!-- File meta line -->
        <div class="file-meta">
          <q-icon :name="getFileIcon(fileInfo.ext)" size="20px" :color="getFileColor(fileInfo.ext)" />
          <span class="ellipsis">{{ fileInfo.filename }}</span>
          <span v-if="fileInfo.size" class="text-grey-6">{{ formatFileSize(fileInfo.size) }}</span>
          <q-space />
          <q-btn flat dense no-caps size="sm" icon="visibility" color="primary" :label="$t('visit.filePreviewOpen')" @click="showPreview = true" />
        </div>

        <q-input v-model="title" dense outlined hide-bottom-space :label="$t('visit.fileTitleLabel')" maxlength="120" autofocus @keyup.enter="save" />
        <q-input v-model="description" dense outlined hide-bottom-space autogrow type="textarea" :label="$t('visit.fileDescriptionLabel')" maxlength="1000" />
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md q-pt-none">
        <q-btn flat :label="$t('common.cancel')" color="grey-7" v-close-popup :disable="saving" />
        <q-btn unelevated :label="$t('common.save')" color="primary" icon="save" :loading="saving" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <FilePreviewDialog v-if="observation" v-model="showPreview" :observation-id="observation.observationId" :file-info="fileInfo" :concept-name="observation.conceptName" :upload-date="observation.date" />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotify } from 'src/composables/useNotify'
import { useLoggingStore } from 'src/stores/logging-store'
import { visitObservationService } from 'src/services/visit-observation-service'
import { getFileIcon, getFileColor, formatFileSize } from 'src/shared/utils/medical-utils.js'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'

defineOptions({
  name: 'FileDetailsDialog',
})

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Transformed R observation ({observationId, fileInfo, rawData, ...})
  observation: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()
const notify = useNotify()
const logger = useLoggingStore().createLogger('FileDetailsDialog')

const fileInfo = computed(() => props.observation?.fileInfo || {})

const title = ref('')
const description = ref('')
const saving = ref(false)
const showPreview = ref(false)

// immediate: the dialog is often mounted already-open (v-if + v-model set in
// the same tick) — without immediate the fields would stay empty although
// title/description are stored in the envelope
watch(
  () => [props.modelValue, props.observation],
  ([open]) => {
    if (open) {
      title.value = fileInfo.value.title || ''
      description.value = fileInfo.value.description || ''
    }
  },
  { immediate: true },
)

const save = async () => {
  if (!props.observation) return
  saving.value = true
  try {
    // Merge into the CURRENT envelope. fileInfo is the parsed envelope and
    // survives store-side object replacement — rawData.TVAL_CHAR may be
    // stale after a previous save, so never read from it here.
    const envelope = { ...fileInfo.value }
    envelope.title = title.value.trim() || envelope.filename
    envelope.description = description.value.trim() || undefined
    const serialized = JSON.stringify(envelope)

    // ONLY TVAL_CHAR — never write OBSERVATION_BLOB here (raw file bytes!)
    await visitObservationService.updateObservation(props.observation.observationId, { TVAL_CHAR: serialized }, { skipReload: true })

    notify.success(t('visit.fileDetailsSaved'))
    // The parent mirrors the envelope into its observation object
    emit('saved', { envelope, serialized })
    emit('update:modelValue', false)
  } catch (error) {
    logger.error('Failed to save file details', error, { observationId: props.observation?.observationId })
    notify.error(t('observation.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.details-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  background: $grey-2;
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 0;
}
</style>
