<template>
  <AppDialog
    v-model="dialogVisible"
    :title="`${mode === 'create' ? 'Create' : 'Edit'} User`"
    :subtitle="mode === 'edit' ? `Editing: ${localFormData.name || localFormData.username}` : 'Add a new system user'"
    size="md"
    :persistent="true"
    @ok="handleSubmit"
    @cancel="handleCancel"
    :show-ok="isFormValid && !loading && !userStore.saving"
    :ok-label="mode === 'create' ? 'Create User' : 'Save Changes'"
    :ok-color="mode === 'create' ? 'positive' : 'primary'"
  >
    <!-- Loading State -->
    <div v-if="loading" class="row justify-center q-py-lg">
      <q-spinner color="primary" size="40px" />
      <div class="q-ml-md text-grey-6">Loading user data...</div>
    </div>

    <!-- Form Content -->
    <div v-else class="q-gutter-md">
      <!-- Username Field -->
      <q-input
        v-model="localFormData.username"
        label="Username"
        outlined
        dense
        :readonly="mode === 'edit'"
        :hint="mode === 'edit' ? 'Username cannot be changed' : 'Login username (letters, numbers, underscores only)'"
        :rules="[
          (val) => !!val || 'Username is required',
          (val) => mode === 'edit' || val.length >= 3 || 'Username must be at least 3 characters',
          (val) => mode === 'edit' || /^[a-zA-Z0-9_]+$/.test(val) || 'Username can only contain letters, numbers, and underscores',
        ]"
      />

      <!-- Display Name Field -->
      <q-input
        v-model="localFormData.name"
        label="Display Name"
        outlined
        dense
        :rules="[(val) => !!val || 'Display name is required']"
        :hint="mode === 'edit' ? null : 'Full name displayed in the interface'"
      />

      <!-- Password Fields (only for create mode) -->
      <template v-if="mode === 'create'">
        <q-input
          v-model="localFormData.password"
          label="Password"
          type="password"
          outlined
          dense
          :rules="[(val) => !!val || 'Password is required', (val) => val.length >= 5 || 'Password must be at least 5 characters']"
        />

        <q-input
          v-model="localFormData.confirmPassword"
          label="Confirm Password"
          type="password"
          outlined
          dense
          :rules="[(val) => !!val || 'Please confirm the password', (val) => val === localFormData.password || 'Passwords do not match']"
        />
      </template>

      <!-- Role Field -->
      <q-select v-model="localFormData.role" label="Role" outlined dense :options="roleOptions" :rules="[(val) => !!val || 'Role is required']" emit-value map-options />

      <!-- User Description Field -->
      <q-input v-model="localFormData.userBlob" label="Description" outlined dense type="textarea" rows="3" hint="Optional description or notes about the user" />

      <!-- Requirements (only for create mode) -->
      <div v-if="mode === 'create'" class="text-caption text-grey-6 q-mt-md">
        <div class="text-weight-medium q-mb-xs">Requirements:</div>
        <div>• Username: 3+ characters, letters/numbers/underscores only</div>
        <div>• Password: 6+ characters</div>
        <div>• All fields except description are required</div>
      </div>
    </div>
  </AppDialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import AppDialog from './shared/AppDialog.vue'
import { useUserStore } from 'src/stores/user-store'
import { useLoggingStore } from 'src/stores/logging-store'

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
  userId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'saved', 'cancelled'])

const $q = useQuasar()
const userStore = useUserStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('UserDialog')

// State
const localFormData = ref({
  username: '',
  name: '',
  password: '',
  confirmPassword: '',
  role: '',
  userBlob: '',
})
const loading = ref(false)

// Use store state
const roleOptions = computed(() => userStore.roleOptions)

// Computed
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => {
    if (value && props.mode === 'edit' && props.userId) {
      // Load user data when opening edit dialog
      loadUserById(props.userId)
    } else if (value && props.mode === 'create') {
      // Reset form for create mode
      resetForm()
      userStore.clearError()
    } else if (!value) {
      // Reset form when closing dialog
      resetForm()
    }
    emit('update:modelValue', value)
  },
})

const isFormValid = computed(() => {
  if (!localFormData.value.username || localFormData.value.username.trim() === '') return false
  if (!localFormData.value.name || localFormData.value.name.trim() === '') return false
  if (!localFormData.value.role) return false

  if (props.mode === 'create') {
    if (!localFormData.value.password || localFormData.value.password.length < 6) return false
    if (localFormData.value.password !== localFormData.value.confirmPassword) return false
    if (localFormData.value.username.length < 3) return false
    if (!/^[a-zA-Z0-9_]+$/.test(localFormData.value.username)) return false
  }

  return true
})

// Methods
const loadUserById = async (userId) => {
  logger.info('loadUserById called', { userId, mode: props.mode })

  if (!userId) {
    logger.warn('No userId provided, resetting form')
    resetForm()
    return
  }

  loading.value = true
  try {
    logger.info('Fetching user from store', { userId })
    const user = await userStore.getUser(userId)
    logger.info('User fetched successfully', { user })

    // Transform user data to match form fields
    localFormData.value = {
      username: user.USER_CD || '',
      name: user.NAME_CHAR || '',
      password: '',
      confirmPassword: '',
      role: user.COLUMN_CD || '',
      userBlob: user.USER_BLOB || '',
    }

    logger.success('User data loaded into form', {
      userId: user.USER_ID,
      userCode: user.USER_CD,
      formData: localFormData.value,
    })
  } catch (error) {
    logger.error('Failed to load user for editing', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load user data',
      position: 'top',
    })
    resetForm()
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  localFormData.value = {
    username: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: '',
    userBlob: '',
  }
}

const handleSubmit = async () => {
  if (!isFormValid.value) return

  try {
    if (props.mode === 'create') {
      // Prepare create data
      const userData = {
        USER_CD: localFormData.value.username,
        NAME_CHAR: localFormData.value.name,
        PASSWORD_CHAR: localFormData.value.password,
        COLUMN_CD: localFormData.value.role,
        USER_BLOB: localFormData.value.userBlob || null,
      }

      await userStore.createUser(userData)

      $q.notify({
        type: 'positive',
        message: 'User created successfully',
        position: 'top',
      })

      emit('saved', { mode: 'create', user: userData })
      dialogVisible.value = false
    } else {
      // Edit mode - prepare update data
      const updates = {}

      // For edit mode, we'll update all fields that are present
      // The store will handle checking what actually changed
      updates.NAME_CHAR = localFormData.value.name
      updates.COLUMN_CD = localFormData.value.role
      updates.USER_BLOB = localFormData.value.userBlob

      await userStore.updateUser(props.userId, updates)

      $q.notify({
        type: 'positive',
        message: 'User updated successfully',
        position: 'top',
      })

      emit('saved', { mode: 'edit', userId: props.userId })
      dialogVisible.value = false
    }
  } catch (error) {
    logger.error(`Failed to ${props.mode} user`, error)
    $q.notify({
      type: 'negative',
      message: error.message || userStore.error || `Failed to ${props.mode} user`,
      position: 'top',
    })
  }
}

const handleCancel = () => {
  resetForm()
  emit('cancelled')
}

// Initialize role options
onMounted(async () => {
  logger.info('UserDialog mounted', {
    mode: props.mode,
    userId: props.userId,
    modelValue: props.modelValue,
  })
  await userStore.loadRoleOptions()

  // Load user data immediately if in edit mode
  if (props.mode === 'edit' && props.userId && props.modelValue) {
    await loadUserById(props.userId)
  }
})

onUnmounted(() => {
  logger.info('UserDialog unmounted')
})
</script>
