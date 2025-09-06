<template>
  <q-dialog v-model="dialogVisible" persistent>
    <q-card :style="cardStyle">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon v-if="icon" :name="icon" class="q-mr-sm" />
          {{ dialogTitle }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- Subtitle if provided -->
      <q-card-section v-if="subtitle" class="q-pt-none">
        <div class="text-caption text-grey-6">{{ subtitle }}</div>
      </q-card-section>

      <!-- Form Content -->
      <q-card-section class="q-pa-md" :style="contentStyle">
        <q-form ref="formRef" @submit.prevent="handleSubmit" class="q-gutter-md">
          <slot :formData="localFormData" :isEditMode="isEditMode" :hasChanges="hasChanges" :isValid="isFormValid" :validate="validateForm" />
        </q-form>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat :label="cancelLabel" @click="handleCancel" />
        <q-btn color="primary" :label="submitLabel" :loading="loading" :disable="!canSubmit" @click="handleSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import _ from 'lodash'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit'].includes(value),
  },
  entity: {
    type: Object,
    default: () => ({}),
  },
  entityName: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    default: null,
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  validationRules: {
    type: Object,
    default: () => ({}),
  },
  customValidator: {
    type: Function,
    default: null,
  },
  trackChanges: {
    type: Boolean,
    default: true,
  },
  confirmCancel: {
    type: Boolean,
    default: true,
  },
  // Allow parent to override labels
  createLabel: {
    type: String,
    default: null,
  },
  editLabel: {
    type: String,
    default: null,
  },
  createSubmitLabel: {
    type: String,
    default: null,
  },
  editSubmitLabel: {
    type: String,
    default: null,
  },
  cancelLabel: {
    type: String,
    default: 'Cancel',
  },
})

const emit = defineEmits(['update:modelValue', 'submit', 'cancel', 'change'])

const $q = useQuasar()
const formRef = ref(null)

// Local state
const localFormData = ref({})
const originalFormData = ref({})
const isDirty = ref(false)

// Size mappings
const sizeStyles = {
  sm: 'min-width: 400px; max-width: 500px',
  md: 'min-width: 500px; max-width: 700px',
  lg: 'min-width: 700px; max-width: 900px',
  xl: 'min-width: 900px; max-width: 1200px; width: 90vw',
}

// Computed properties
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isEditMode = computed(() => props.mode === 'edit')

const dialogTitle = computed(() => {
  if (isEditMode.value) {
    return props.editLabel || `Edit ${props.entityName}`
  }
  return props.createLabel || `Create New ${props.entityName}`
})

const submitLabel = computed(() => {
  if (isEditMode.value) {
    return props.editSubmitLabel || 'Save Changes'
  }
  return props.createSubmitLabel || `Create ${props.entityName}`
})

const subtitle = computed(() => {
  if (isEditMode.value && props.entity?.id) {
    return `Editing ${props.entityName.toLowerCase()} #${props.entity.id}`
  }
  return null
})

const cardStyle = computed(() => sizeStyles[props.size] || sizeStyles.md)

const contentStyle = computed(() => {
  if (props.size === 'xl') {
    return 'max-height: calc(90vh - 120px); overflow-y: auto'
  }
  return ''
})

const hasChanges = computed(() => {
  if (!props.trackChanges || !isEditMode.value) return true
  return !_.isEqual(localFormData.value, originalFormData.value)
})

const isFormValid = computed(() => {
  // Use custom validator if provided
  if (props.customValidator) {
    return props.customValidator(localFormData.value, isEditMode.value)
  }

  // Check required fields from validation rules
  for (const [field, rules] of Object.entries(props.validationRules)) {
    const value = _.get(localFormData.value, field)

    if (rules.required && !value) {
      return false
    }

    if (rules.minLength && value && value.length < rules.minLength) {
      return false
    }

    if (rules.pattern && value && !rules.pattern.test(value)) {
      return false
    }

    if (rules.validator && !rules.validator(value)) {
      return false
    }
  }

  return true
})

const canSubmit = computed(() => {
  if (props.loading) return false
  if (!isFormValid.value) return false
  if (isEditMode.value && !hasChanges.value) return false
  return true
})

// Methods
const initializeFormData = () => {
  if (isEditMode.value && props.entity) {
    // Deep clone the entity for editing
    localFormData.value = _.cloneDeep(props.entity)
    originalFormData.value = _.cloneDeep(props.entity)
  } else if (props.entity) {
    // Use provided entity data for creation (includes default values)
    localFormData.value = _.cloneDeep(props.entity)
    originalFormData.value = _.cloneDeep(props.entity)
  } else {
    // Initialize empty form for creation if no entity provided
    localFormData.value = {}
    originalFormData.value = {}
  }
  isDirty.value = false
}

const validateForm = async () => {
  if (!formRef.value) return false
  return await formRef.value.validate()
}

const handleSubmit = async () => {
  if (!canSubmit.value) return

  // Validate form if ref is available
  if (formRef.value) {
    const valid = await formRef.value.validate()
    if (!valid) return
  }

  // Prepare submission data
  const submitData = {
    mode: props.mode,
    data: _.cloneDeep(localFormData.value),
  }

  if (isEditMode.value) {
    // Include only changed fields for edit mode
    const changes = {}
    for (const [key, value] of Object.entries(localFormData.value)) {
      if (!_.isEqual(value, originalFormData.value[key])) {
        changes[key] = value
      }
    }
    submitData.changes = changes
    submitData.original = originalFormData.value
  }

  emit('submit', submitData)
}

const handleCancel = () => {
  if (props.confirmCancel && isDirty.value && hasChanges.value) {
    $q.dialog({
      title: 'Discard Changes?',
      message: 'You have unsaved changes. Are you sure you want to cancel?',
      cancel: true,
      persistent: true,
    }).onOk(() => {
      dialogVisible.value = false
      emit('cancel')
    })
  } else {
    dialogVisible.value = false
    emit('cancel')
  }
}

// Watchers
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      initializeFormData()
    }
  },
)

watch(
  () => props.entity,
  () => {
    if (props.modelValue) {
      initializeFormData()
    }
  },
  { deep: true },
)

watch(
  localFormData,
  (newValue, oldValue) => {
    if (!_.isEqual(newValue, oldValue)) {
      isDirty.value = true
      emit('change', { data: newValue, hasChanges: hasChanges.value })
    }
  },
  { deep: true },
)

// Initialize on mount if dialog is already open
if (props.modelValue) {
  initializeFormData()
}

// Expose methods for parent component
defineExpose({
  validateForm,
  resetForm: initializeFormData,
  getFormData: () => localFormData.value,
  hasChanges,
})
</script>

<style lang="scss" scoped>
.q-card {
  max-height: 90vh;
}
</style>
