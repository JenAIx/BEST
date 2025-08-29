<template>
  <AppDialog
    v-model="localShow"
    :title="`Add New ${columnTitle}`"
    :style="isQuestionnaireColumn ? 'min-width: 600px; max-width: 800px' : 'min-width: 400px'"
    persistent
    ok-label="Add"
    @ok="onSubmit"
    @cancel="onCancel"
  >
    <q-form @submit="onSubmit" @reset="resetForm">
      <q-input
        v-model="form.CODE_CD"
        label="Code"
        outlined
        class="q-mb-md"
        :rules="codeRules"
        :hint="isQuestionnaireColumn ? 'Unique identifier for the questionnaire (e.g., quest_moca)' : 'Unique code identifier'"
      />
      <q-input 
        v-model="form.NAME_CHAR" 
        label="Name/Value" 
        outlined 
        class="q-mb-md" 
        :rules="nameRules"
        :hint="isQuestionnaireColumn ? 'Display name for the questionnaire (e.g., MoCA)' : 'Display name'"
      />
      <q-input
        v-model="form.LOOKUP_BLOB"
        :label="isQuestionnaireColumn ? 'Questionnaire JSON' : 'Metadata/Description (Optional)'"
        outlined
        type="textarea"
        :rows="isQuestionnaireColumn ? 10 : 4"
        :rules="isQuestionnaireColumn ? [validateQuestionnaireJson] : []"
        :hint="isQuestionnaireColumn ? 'Complete questionnaire JSON structure with title, items, and results configuration' : 'Enter JSON for metadata or plain text description'"
      />
    </q-form>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppDialog from '../shared/AppDialog.vue'

const props = defineProps({
  modelValue: Boolean,
  columnTitle: String,
  isQuestionnaireColumn: Boolean,
  existingValues: Array
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

// Local state
const localShow = ref(false)
const form = ref({
  CODE_CD: '',
  NAME_CHAR: '',
  LOOKUP_BLOB: '',
})

// Computed
const codeRules = computed(() => [
  (val) => (val && val.length > 0) || 'Code is required',
  (val) => !props.existingValues?.some((v) => v.CODE_CD === val) || 'Code already exists'
])

const nameRules = [
  (val) => (val && val.length > 0) || 'Name is required'
]

// Methods
const validateQuestionnaireJson = (val) => {
  if (!val || val.trim() === '') return 'Questionnaire JSON is required'
  
  try {
    const questionnaire = JSON.parse(val)
    
    if (!questionnaire.title) return 'Missing required field: title'
    if (!questionnaire.short_title) return 'Missing required field: short_title'
    if (!questionnaire.items || !Array.isArray(questionnaire.items)) {
      return 'Missing or invalid field: items (must be array)'
    }
    if (questionnaire.items.length === 0) return 'Questionnaire must have at least one item'
    
    return true
  } catch (error) {
    return `Invalid JSON: ${error.message}`
  }
}

const onSubmit = () => {
  emit('submit', { ...form.value })
}

const onCancel = () => {
  localShow.value = false
  emit('cancel')
}

const resetForm = () => {
  form.value = {
    CODE_CD: '',
    NAME_CHAR: '',
    LOOKUP_BLOB: '',
  }
}

// Watch for external model changes
watch(() => props.modelValue, (newValue) => {
  localShow.value = newValue
  if (newValue) {
    resetForm()
  }
})

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})
</script>
