<template>
  <AppInputDialog v-model="dialogVisible" title="Reset Password" ok-label="Save Password" cancel-label="Cancel" :loading="isSaving" :disabled="!isFormValid" @ok="onSubmit" @cancel="onCancel">
    <q-form @submit.prevent="onSubmit" class="q-gutter-md">
      <!-- New Password Field -->
      <q-input
        v-model="formData.newPassword"
        label="New Password"
        type="password"
        outlined
        dense
        :rules="[(val) => !!val || 'Password is required', (val) => val.length >= 5 || 'Password must be at least 5 characters']"
        @update:model-value="onPasswordChange"
      />

      <!-- Confirm Password Field -->
      <q-input
        v-model="formData.confirmPassword"
        label="Confirm Password"
        type="password"
        outlined
        dense
        :rules="[(val) => !!val || 'Please confirm your password', (val) => val === formData.newPassword || 'Passwords do not match']"
        @update:model-value="onPasswordChange"
      />

      <!-- Password Requirements -->
      <div class="text-caption text-grey-6">
        <div>Password requirements:</div>
        <div>• At least 5 characters long</div>
        <div>• Passwords must match</div>
      </div>
    </q-form>
  </AppInputDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppInputDialog from 'components/shared/AppInputDialog.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

// Form state
const formData = ref({
  newPassword: '',
  confirmPassword: '',
})

const isSaving = ref(false)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Computed properties
const isFormValid = computed(() => {
  return formData.value.newPassword.length >= 5 && formData.value.newPassword === formData.value.confirmPassword
})

// Methods
const onPasswordChange = () => {
  // This will trigger the computed isFormValid property
}

const onCancel = () => {
  dialogVisible.value = false
  emit('cancel')
}

const onSubmit = async () => {
  if (!isFormValid.value) return

  isSaving.value = true
  try {
    emit('save', {
      newPassword: formData.value.newPassword,
    })

    // Clear form after successful save
    formData.value.newPassword = ''
    formData.value.confirmPassword = ''
    dialogVisible.value = false
  } catch {
    // Error handling is done in parent component
  } finally {
    isSaving.value = false
  }
}
</script>
