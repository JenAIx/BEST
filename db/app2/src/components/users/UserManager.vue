<template>
  <div class="user-manager">
    <!-- Create User Button -->
    <div class="row items-center justify-end q-mb-md">
      <q-btn color="primary" icon="add" label="Create User" @click="onCreateUser" />
    </div>

    <!-- Users Table -->
    <q-table :rows="users" :columns="columns" row-key="USER_ID" :loading="loading" :pagination="pagination" @request="onRequest" binary-state-sort class="users-table">
      <!-- Display Name Column -->
      <template v-slot:body-cell-NAME_CHAR="props">
        <q-td :props="props">
          <div class="row items-center">
            <q-avatar size="32px" color="primary" text-color="white" class="q-mr-sm">
              {{ getInitials(props.value) }}
            </q-avatar>
            <div>
              <div class="text-weight-medium">{{ props.value || 'N/A' }}</div>
              <div class="text-caption text-grey-6">{{ props.row.USER_CD }}</div>
            </div>
          </div>
        </q-td>
      </template>

      <!-- Role Column -->
      <template v-slot:body-cell-COLUMN_CD="props">
        <q-td :props="props">
          <q-chip :color="getRoleColor(props.value)" text-color="white" size="sm">
            {{ props.value }}
          </q-chip>
        </q-td>
      </template>

      <!-- Last Updated Column -->
      <template v-slot:body-cell-UPDATE_DATE="props">
        <q-td :props="props">
          {{ formatDate(props.value) }}
        </q-td>
      </template>

      <!-- Actions Column -->
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round dense icon="edit" color="primary" @click="onEditUser(props.row)">
            <q-tooltip>Edit User</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="lock_reset" color="orange" @click="onResetUserPassword(props.row)">
            <q-tooltip>Reset Password</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="delete" color="negative" @click="onDeleteUser(props.row)" :disable="props.row.USER_ID === currentUser?.USER_ID">
            <q-tooltip>
              {{ props.row.USER_ID === currentUser?.USER_ID ? 'Cannot delete yourself' : 'Delete User' }}
            </q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- User Dialog (Create/Edit) -->
    <UserDialog v-if="showUserDialog" v-model="showUserDialog" :mode="userDialogMode" :userId="selectedUserId" @saved="onUserSaved" @cancelled="onUserCancelled" />

    <!-- Password Reset Dialog -->
    <PasswordResetDialog v-model="showPasswordDialog" @save="onPasswordSave" @cancel="onPasswordCancel" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth-store'
import { useUserStore } from 'src/stores/user-store'
import UserDialog from 'components/UserDialog.vue'
import PasswordResetDialog from 'components/PasswordResetDialog.vue'

const $q = useQuasar()
const authStore = useAuthStore()
const userStore = useUserStore()

// State
const showUserDialog = ref(false)
const userDialogMode = ref('create')
const showPasswordDialog = ref(false)
const selectedUserId = ref(null)

// Computed properties from store
const users = computed(() => userStore.users)
const loading = computed(() => userStore.loading)
const selectedUser = computed(() => userStore.selectedUser)
const currentUser = computed(() => authStore.currentUser)

// Table configuration
const columns = [
  {
    name: 'NAME_CHAR',
    required: true,
    label: 'User',
    align: 'left',
    field: 'NAME_CHAR',
    sortable: true,
  },
  {
    name: 'COLUMN_CD',
    label: 'Role',
    align: 'left',
    field: 'COLUMN_CD',
    sortable: true,
  },
  {
    name: 'UPDATE_DATE',
    label: 'Last Updated',
    align: 'left',
    field: 'UPDATE_DATE',
    sortable: true,
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    field: 'actions',
    sortable: false,
  },
]

const pagination = computed({
  get: () => userStore.pagination,
  set: (value) => userStore.setPagination(value),
})

// Methods
const loadUsers = async () => {
  try {
    await userStore.loadUsers()
  } catch {
    $q.notify({
      type: 'negative',
      message: userStore.error || 'Failed to load users',
      position: 'top',
    })
  }
}

const onRequest = (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  // Update pagination
  userStore.setPagination({
    page,
    rowsPerPage,
    sortBy,
    descending,
  })

  // Reload data with new pagination
  loadUsers()
}

// Use store methods
const getInitials = (name) => userStore.getUserInitials(name)
const getRoleColor = (role) => userStore.getRoleColor(role)

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

// User actions
const onCreateUser = () => {
  selectedUserId.value = null
  userDialogMode.value = 'create'
  showUserDialog.value = true
}

const onEditUser = (user) => {
  console.log('Edit user clicked', { user, userId: user.USER_ID })
  selectedUserId.value = user.USER_ID
  userDialogMode.value = 'edit'
  showUserDialog.value = true
  console.log('Dialog state set', {
    selectedUserId: selectedUserId.value,
    mode: userDialogMode.value,
    show: showUserDialog.value,
  })
}

const onResetUserPassword = (user) => {
  userStore.setSelectedUser({ ...user })
  showPasswordDialog.value = true
}

const onDeleteUser = (user) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete user "${user.NAME_CHAR || user.USER_CD}"? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      await userStore.deleteUser(user.USER_ID)

      $q.notify({
        type: 'positive',
        message: 'User deleted successfully',
        position: 'top',
      })
    } catch {
      $q.notify({
        type: 'negative',
        message: userStore.error || 'Failed to delete user',
        position: 'top',
      })
    }
  })
}

// Dialog handlers
const onUserSaved = async () => {
  // Notification is handled by the dialog component
  // Just refresh the list
  await userStore.refreshUsers()
}

const onUserCancelled = () => {
  // Dialog will close itself
  selectedUserId.value = null
}

const onPasswordSave = async (passwordData) => {
  try {
    await userStore.updatePassword(selectedUser.value.USER_ID, passwordData.newPassword)

    $q.notify({
      type: 'positive',
      message: 'Password updated successfully',
      position: 'top',
    })

    showPasswordDialog.value = false
  } catch {
    $q.notify({
      type: 'negative',
      message: userStore.error || 'Failed to update password',
      position: 'top',
    })
  }
}

const onPasswordCancel = () => {
  showPasswordDialog.value = false
  userStore.clearSelectedUser()
}

// Expose methods for parent component
defineExpose({
  loadUsers,
})
</script>

<style lang="scss" scoped>
.user-manager {
  .users-table {
    .q-table__top {
      padding: 0;
    }
  }
}
</style>
