<template>
  <!-- Use the shared questionnaire preview dialog -->
  <QuestionnairePreviewDialog :model-value="modelValue" :json-content="jsonContent" @update:model-value="$emit('update:modelValue', $event)" @close="onClose" />
</template>

<script setup>
import QuestionnairePreviewDialog from '../shared/QuestionnairePreviewDialog.vue'

defineProps({
  modelValue: Boolean,
  jsonContent: String,
})

const emit = defineEmits(['update:modelValue', 'close'])

// Methods
const onClose = () => {
  emit('close')
}
</script>
