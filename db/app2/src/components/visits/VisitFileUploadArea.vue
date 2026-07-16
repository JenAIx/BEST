<template>
  <div class="upload-area-wrap">
    <div
      class="upload-area"
      :class="{ 'upload-area--drag': isDragOver }"
      @click="triggerFileInput"
      @drop.prevent="onDrop"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
    >
      <q-icon name="cloud_upload" size="32px" :color="isDragOver ? 'primary' : 'grey-6'" />
      <div class="upload-text">
        <div class="text-subtitle2">{{ $t('visit.uploadDropHere') }}</div>
        <div class="text-caption text-grey-6">{{ $t('visit.uploadHint') }}</div>
      </div>
      <input ref="fileInput" type="file" :accept="ACCEPTED_TYPES" class="hidden-input" @change="onFileInputChange" />
    </div>

    <FileUploadConfirmDialog v-model="showConfirm" :file-data="pendingFile" @saved="onSaved" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotify } from 'src/composables/useNotify'
import FileUploadConfirmDialog from './FileUploadConfirmDialog.vue'

defineOptions({
  name: 'VisitFileUploadArea',
})

const emit = defineEmits(['uploaded'])

const { t } = useI18n()
const notify = useNotify()

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg,.gif,.bmp,.tiff,.webp,.mp4,.mov,.webm,.mkv,.avi'
const MAX_SIZE_MB = 50 // matches the uploadRawData DB guard

const fileInput = ref(null)
const isDragOver = ref(false)
const pendingFile = ref(null)
const showConfirm = ref(false)

const triggerFileInput = () => fileInput.value?.click()

const onFileInputChange = (event) => {
  const file = event.target.files?.[0]
  if (file) handleFile(file)
  event.target.value = '' // allow re-selecting the same file
}

const onDrop = (event) => {
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

const handleFile = async (file) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ACCEPTED_TYPES.includes(`.${ext}`)) {
    notify.error(t('visit.uploadUnsupportedType', { ext }))
    return
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    notify.error(t('visit.uploadTooLarge', { max: MAX_SIZE_MB }))
    return
  }

  // Same fileData shape as FileUploadInput / uploadRawData expects
  const arrayBuffer = await file.arrayBuffer()
  pendingFile.value = {
    fileInfo: { filename: file.name, size: file.size, ext },
    blob: new Uint8Array(arrayBuffer),
    originalFile: file,
  }
  showConfirm.value = true
}

const onSaved = (payload) => {
  pendingFile.value = null
  emit('uploaded', payload)
}
</script>

<style lang="scss" scoped>
.upload-area-wrap {
  display: flex;
  justify-content: center;
  margin: 20px auto 4px;
  max-width: 700px;
}

.upload-area {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 18px 24px;
  border: 2px dashed $grey-5;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;

  &:hover,
  &.upload-area--drag {
    border-color: $primary;
    background: $blue-1;
  }

  .upload-text {
    text-align: left;
  }
}

.hidden-input {
  display: none;
}
</style>
