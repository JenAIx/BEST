<template>
  <div>
    <q-form @submit="onSubmit" class="q-gutter-md">
      <!-- User Name Field -->
      <div>
        <q-input v-model="formData.name" :label="$t('user.fullName')" outlined dense :rules="[(val) => !!val || $t('user.nameRequired')]" @update:model-value="onFieldChange" />
      </div>

      <!-- Password Reset Section -->
      <div class="q-mt-lg">
        <div class="text-subtitle2 q-mb-sm">{{ $t('user.passwordManagement') }}</div>

        <q-btn color="secondary" :label="$t('user.resetPassword')" outline @click="onResetPassword" :loading="isResetting" />

        <div class="text-caption text-grey-6 q-mt-sm">{{ $t('user.resetPasswordHint') }}</div>
      </div>

      <!-- Save Button - Only show when changes are made -->
      <div v-if="hasChanges" class="q-mt-lg">
        <q-btn type="submit" color="primary" :label="$t('user.saveChanges')" :loading="isSaving" unelevated />

        <q-btn class="q-ml-sm" color="grey" :label="$t('common.cancel')" outline @click="resetForm" />
      </div>
    </q-form>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  user: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['save', 'reset-password'])

const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('SettingsForm')

// Form state
const formData = ref({
  name: '',
  originalName: '',
})

const isSaving = ref(false)
const isResetting = ref(false)

// Computed properties
const hasChanges = computed(() => {
  return formData.value.name !== formData.value.originalName
})

// Methods
const onFieldChange = () => {
  // This will trigger the computed hasChanges property
}

const resetForm = () => {
  formData.value.name = formData.value.originalName
}

const onSubmit = async () => {
  if (!hasChanges.value) return

  isSaving.value = true
  try {
    await emit('save', {
      name: formData.value.name,
    })

    // Update original values after successful save
    formData.value.originalName = formData.value.name
  } catch {
    // Error handling is done in parent component
  } finally {
    isSaving.value = false
  }
}

const onResetPassword = async () => {
  isResetting.value = true
  try {
    await emit('reset-password')
  } catch {
    // Error handling is done in parent component
  } finally {
    isResetting.value = false
  }
}

// Watch for user prop changes and initialize form
watch(
  () => props.user,
  (newUser) => {
    if (newUser) {
      logger.debug('User prop changed', {
        userName: newUser.NAME_CHAR,
        userCode: newUser.USER_CD,
      })
      formData.value.name = newUser.NAME_CHAR || newUser.name || ''
      formData.value.originalName = newUser.NAME_CHAR || newUser.name || ''
    }
  },
  { immediate: true },
)

// Initialize form when component mounts
onMounted(() => {
  if (props.user) {
    logger.debug('SettingsForm mounted', {
      userName: props.user.NAME_CHAR,
      userCode: props.user.USER_CD,
    })
    formData.value.name = props.user.NAME_CHAR || props.user.name || ''
    formData.value.originalName = props.user.NAME_CHAR || props.user.name || ''
  }
})
</script>
