<template>
  <BaseEntityDialog
    v-model="dialogVisible"
    :mode="mode"
    :entity="user"
    entity-name="User"
    icon="person"
    size="md"
    :loading="isSaving"
    :custom-validator="validateForm"
    @submit="handleSubmit"
    @cancel="handleCancel"
  >
    <template #default="{ formData, isEditMode }">
      <!-- Username Field -->
      <q-input
        v-model="formData.username"
        label="Username"
        outlined
        dense
        :readonly="isEditMode"
        :hint="isEditMode ? 'Username cannot be changed' : 'Login username (letters, numbers, underscores only)'"
        :rules="[
          val => !!val || 'Username is required',
          val => isEditMode || val.length >= 3 || 'Username must be at least 3 characters',
          val => isEditMode || /^[a-zA-Z0-9_]+$/.test(val) || 'Username can only contain letters, numbers, and underscores'
        ]"
      />

      <!-- Display Name Field -->
      <q-input
        v-model="formData.name"
        label="Display Name"
        outlined
        dense
        :rules="[val => !!val || 'Display name is required']"
        :hint="isEditMode ? null : 'Full name displayed in the interface'"
      />

      <!-- Password Fields (only for create mode) -->
      <template v-if="!isEditMode">
        <q-input
          v-model="formData.password"
          label="Password"
          type="password"
          outlined
          dense
          :rules="[
            val => !!val || 'Password is required',
            val => val.length >= 5 || 'Password must be at least 5 characters'
          ]"
        />

        <q-input
          v-model="formData.confirmPassword"
          label="Confirm Password"
          type="password"
          outlined
          dense
          :rules="[
            val => !!val || 'Please confirm the password',
            val => val === formData.password || 'Passwords do not match'
          ]"
        />
      </template>

      <!-- Role Field -->
      <q-select
        v-model="formData.role"
        label="Role"
        outlined
        dense
        :options="roleOptions"
        :rules="[val => !!val || 'Role is required']"
        emit-value
        map-options
      />

      <!-- User Description Field -->
      <q-input
        v-model="formData.userBlob"
        label="Description"
        outlined
        dense
        type="textarea"
        rows="3"
        hint="Optional description or notes about the user"
      />

      <!-- Requirements (only for create mode) -->
      <div v-if="!isEditMode" class="text-caption text-grey-6">
        <div>Requirements:</div>
        <div>• Username: 3+ characters, letters/numbers/underscores only</div>
        <div>• Password: 5+ characters</div>
        <div>• All fields except description are required</div>
      </div>
    </template>
  </BaseEntityDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import BaseEntityDialog from './shared/BaseEntityDialog.vue'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'create',
    validator: (value) => ['create', 'edit'].includes(value)
  },
  user: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'saved', 'cancelled'])

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()
const dbStore = useDatabaseStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('UserDialog')

// State
const isSaving = ref(false)
const roleOptions = ref([])

// Computed
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Methods
const validateForm = (formData, isEditMode) => {
  if (!formData.username || formData.username.trim() === '') return false
  if (!formData.name || formData.name.trim() === '') return false
  if (!formData.role) return false
  
  if (!isEditMode) {
    if (!formData.password || formData.password.length < 5) return false
    if (formData.password !== formData.confirmPassword) return false
    if (formData.username.length < 3) return false
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) return false
  }
  
  return true
}

const loadRoleOptions = async () => {
  try {
    const roles = await globalSettingsStore.getUserRoleOptions()
    roleOptions.value = roles.map(role => ({
      label: role.label || role.value,
      value: role.value
    }))
  } catch (error) {
    logger.error('Failed to load role options', error)
    // Fallback to default roles
    roleOptions.value = [
      { label: 'Administrator', value: 'admin' },
      { label: 'Physician', value: 'physician' },
      { label: 'Nurse', value: 'nurse' },
      { label: 'Research', value: 'research' }
    ]
  }
}

const handleSubmit = async ({ mode, data, changes }) => {
  isSaving.value = true
  
  try {
    const userRepo = dbStore.getUserRepository()
    
    if (mode === 'create') {
      // Prepare create data
      const userData = {
        USER_CD: data.username,
        NAME_CHAR: data.name,
        PASSWORD_CHAR: data.password,
        COLUMN_CD: data.role,
        USER_BLOB: data.userBlob || null
      }
      
      // Check if username already exists
      const existingUser = await userRepo.findByUserCode(userData.USER_CD)
      if (existingUser) {
        throw new Error('Username already exists')
      }
      
      // Create user
      const newUser = await userRepo.createUser(userData)
      
      $q.notify({
        type: 'positive',
        message: 'User created successfully',
        position: 'top'
      })
      
      emit('saved', { mode: 'create', user: newUser })
      dialogVisible.value = false
      
    } else {
      // Edit mode - prepare update data
      const updateData = {}
      
      if (changes.name) {
        updateData.NAME_CHAR = data.name
      }
      
      if (changes.role) {
        updateData.COLUMN_CD = data.role
      }
      
      if (changes.userBlob !== undefined) {
        updateData.USER_BLOB = data.userBlob
      }
      
      // Update user
      const updatedUser = await userRepo.updateUser(props.user.USER_CD, updateData)
      
      $q.notify({
        type: 'positive',
        message: 'User updated successfully',
        position: 'top'
      })
      
      emit('saved', { mode: 'edit', user: updatedUser })
      dialogVisible.value = false
    }
  } catch (error) {
    logger.error(`Failed to ${mode} user`, error)
    $q.notify({
      type: 'negative',
      message: error.message || `Failed to ${mode} user`,
      position: 'top'
    })
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  emit('cancelled')
}

// Initialize user data for edit mode
watch(() => props.user, (newUser) => {
  if (props.mode === 'edit' && newUser) {
    // BaseEntityDialog will handle the data initialization
    // Data transformation is handled automatically by the base dialog
  }
}, { immediate: true })

// Load role options on mount
onMounted(() => {
  loadRoleOptions()
})
</script>
