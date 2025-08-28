<template>
  <AppDialog
    v-model="localShow"
    title="JSON Metadata"
    subtitle="Raw JSON structure"
    size="lg"
    persistent
    :show-ok="false"
    cancel-label="Close"
    @cancel="onClose"
  >
    <pre class="json-viewer">{{ formattedJson }}</pre>
  </AppDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppDialog from '../shared/AppDialog.vue'

const props = defineProps({
  modelValue: Boolean,
  jsonContent: String
})

const emit = defineEmits(['update:modelValue', 'close'])

// Local state
const localShow = ref(false)

// Computed
const formattedJson = computed(() => {
  if (!props.jsonContent) return ''
  
  try {
    return JSON.stringify(JSON.parse(props.jsonContent), null, 2)
  } catch {
    return props.jsonContent
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

<style lang="scss" scoped>
.json-viewer {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
