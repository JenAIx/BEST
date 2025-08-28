<template>
  <AppDialog
    v-model="localShow"
    title="Questionnaire Preview"
    subtitle="Interactive preview of how this questionnaire will appear to users"
    size="full"
    :show-ok="false"
    cancel-label="Close"
    :content-padding="false"
    @cancel="onClose"
  >
    <div class="q-pa-md">
      <PreviewSurveyTemplate :questionnaire="questionnaire" />
    </div>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppDialog from '../shared/AppDialog.vue'
import PreviewSurveyTemplate from '../questionnaire/PreviewSurveyTemplate.vue'

const props = defineProps({
  modelValue: Boolean,
  jsonContent: String
})

const emit = defineEmits(['update:modelValue', 'close'])

// Local state
const localShow = ref(false)

// Computed
const questionnaire = computed(() => {
  if (!props.jsonContent) return null
  
  try {
    return JSON.parse(props.jsonContent)
  } catch {
    return null
  }
})

// Methods
const onClose = () => {
  localShow.value = false
  emit('close')
}

// Watch for external model changes
watch(() => props.modelValue, (newValue) => {
  localShow.value = newValue
})

watch(localShow, (newValue) => {
  if (!newValue) {
    emit('update:modelValue', false)
  }
})
</script>
