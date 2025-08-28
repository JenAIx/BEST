<template>
  <AppDialog
    v-model="localShow"
    title="Import Questionnaire"
    subtitle="Upload a questionnaire JSON file"
    size="lg"
    persistent
    ok-label="Import"
    :ok-loading="importing"
    :ok-disable="!importPreview"
    @ok="onImport"
    @cancel="onCancel"
  >
    <q-file
      v-model="importFile"
      label="Select questionnaire JSON file"
      outlined
      accept=".json"
      @update:model-value="onFileSelected"
      :rules="[(val) => !!val || 'Please select a file']"
    >
      <template v-slot:prepend>
        <q-icon name="attach_file" />
      </template>
    </q-file>
    
    <div v-if="importPreview" class="q-mt-md">
      <div class="text-subtitle2 q-mb-sm">Preview:</div>
      <q-card flat bordered class="bg-grey-1">
        <q-card-section>
          <div><strong>Title:</strong> {{ importPreview.title || 'N/A' }}</div>
          <div><strong>Short Title:</strong> {{ importPreview.short_title || 'N/A' }}</div>
          <div><strong>Description:</strong> {{ importPreview.description || 'N/A' }}</div>
          <div><strong>Items:</strong> {{ importPreview.items?.length || 0 }} questions</div>
        </q-card-section>
      </q-card>
    </div>
  </AppDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import AppDialog from '../shared/AppDialog.vue'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'import-success', 'cancel'])

const $q = useQuasar()

// Local state
const localShow = ref(false)
const importFile = ref(null)
const importPreview = ref(null)
const importing = ref(false)

// Methods
const onFileSelected = async (file) => {
  if (!file) {
    importPreview.value = null
    return
  }

  try {
    const text = await file.text()
    const questionnaire = JSON.parse(text)
    importPreview.value = questionnaire
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Invalid JSON file',
      caption: error.message
    })
    importPreview.value = null
  }
}

const onImport = () => {
  if (!importPreview.value) return

  importing.value = true
  
  try {
    const questionnaire = importPreview.value
    const codeCD = questionnaire.short_title || `quest_${Date.now()}`
    const nameChar = questionnaire.title || 'Imported Questionnaire'
    const lookupBlob = JSON.stringify(questionnaire, null, 2)

    emit('import-success', {
      CODE_CD: codeCD,
      NAME_CHAR: nameChar,
      LOOKUP_BLOB: lookupBlob
    })

    // Reset state
    cancelImport()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to import questionnaire',
      caption: error.message
    })
  } finally {
    importing.value = false
  }
}

const onCancel = () => {
  localShow.value = false
  emit('cancel')
}

const cancelImport = () => {
  importFile.value = null
  importPreview.value = null
  localShow.value = false
}

// Watch for external model changes
watch(() => props.modelValue, (newValue) => {
  localShow.value = newValue
  if (newValue) {
    importFile.value = null
    importPreview.value = null
    importing.value = false
  }
})

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})
</script>
