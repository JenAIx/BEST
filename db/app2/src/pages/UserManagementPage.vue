<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">User Management</div>
      <q-btn color="primary" icon="add" label="Create User" @click="onCreateUser" />
    </div>

    <!-- Users Table -->
    <q-table :rows="users" :columns="columns" row-key="USER_ID" :loading="loading" :pagination="pagination"
      @request="onRequest" binary-state-sort>
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
          <q-btn flat round dense icon="delete" color="negative" @click="onDeleteUser(props.row)"
            :disable="props.row.USER_ID === currentUser?.USER_ID">
            <q-tooltip>{{ props.row.USER_ID === currentUser?.USER_ID ? 'Cannot delete yourself' : 'Delete User'
              }}</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Edit User Dialog -->
    <UserEditDialog v-model="showEditDialog" :user="selectedUser" @save="onSaveUser" @cancel="onCancelEdit" />

    <!-- Create User Dialog -->
    <UserCreateDialog v-model="showCreateDialog" @save="onSaveNewUser" @cancel="onCancelCreate" />

    <!-- Password Reset Dialog -->
    <PasswordResetDialog v-model="showPasswordDialog" @save="onPasswordSave" @cancel="onPasswordCancel" />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth-store'
import { useDatabaseStore } from 'src/stores/database-store'
import UserEditDialog from 'components/UserEditDialog.vue'
import UserCreateDialog from 'components/UserCreateDialog.vue'
import PasswordResetDialog from 'components/PasswordResetDialog.vue'

const $q = useQuasar()
const authStore = useAuthStore()
const dbStore = useDatabaseStore()

// State
const users = ref([])
const loading = ref(false)
const showEditDialog = ref(false)
const showCreateDialog = ref(false)
const showPasswordDialog = ref(false)
const selectedUser = ref(null)

const currentUser = computed(() => authStore.currentUser)

// Table configuration
const columns = [
  {
    name: 'NAME_CHAR',
    required: true,
    label: 'User',
    align: 'left',
    field: 'NAME_CHAR',
    sortable: true
  },
  {
    name: 'COLUMN_CD',
    label: 'Role',
    align: 'left',
    field: 'COLUMN_CD',
    sortable: true
  },
  {
    name: 'UPDATE_DATE',
    label: 'Last Updated',
    align: 'left',
    field: 'UPDATE_DATE',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    field: 'actions',
    sortable: false
  }
]

const pagination = ref({
  sortBy: 'NAME_CHAR',
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0
})

// Methods
const loadUsers = async () => {
  loading.value = true
  try {
    const userRepo = dbStore.getUserRepository()
    const allUsers = await userRepo.findAll()
    users.value = allUsers || []
    pagination.value.rowsNumber = users.value.length
  } catch (error) {
    console.error('Failed to load users:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load users',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const onRequest = (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  // Update pagination
  pagination.value.page = page
  pagination.value.rowsPerPage = rowsPerPage
  pagination.value.sortBy = sortBy
  pagination.value.descending = descending

  // Sort users
  if (sortBy) {
    users.value.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]

      if (aVal < bVal) return descending ? 1 : -1
      if (aVal > bVal) return descending ? -1 : 1
      return 0
    })
  }
}

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const getRoleColor = (role) => {
  switch (role?.toLowerCase()) {
    case 'admin': return 'red'
    case 'physician': return 'blue'
    case 'nurse': return 'green'
    case 'research': return 'purple'
    default: return 'grey'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

// User actions
const onCreateUser = () => {
  showCreateDialog.value = true
}

const onEditUser = (user) => {
  selectedUser.value = { ...user }
  showEditDialog.value = true
}

const onResetUserPassword = (user) => {
  selectedUser.value = { ...user }
  showPasswordDialog.value = true
}

const onDeleteUser = (user) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete user "${user.NAME_CHAR || user.USER_CD}"? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(async () => {
    try {
      const userRepo = dbStore.getUserRepository()
      await userRepo.delete(user.USER_ID)

      $q.notify({
        type: 'positive',
        message: 'User deleted successfully',
        position: 'top'
      })

      await loadUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete user',
        position: 'top'
      })
    }
  })
}

// Dialog handlers
const onSaveUser = async (userData) => {
  try {
    const userRepo = dbStore.getUserRepository()
    await userRepo.updateUser(selectedUser.value.USER_ID, userData)

    $q.notify({
      type: 'positive',
      message: 'User updated successfully',
      position: 'top'
    })

    showEditDialog.value = false
    await loadUsers()
  } catch (error) {
    console.error('Failed to update user:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to update user',
      position: 'top'
    })
  }
}

const onSaveNewUser = async (userData) => {
  try {
    const userRepo = dbStore.getUserRepository()
    await userRepo.createUser(userData)

    $q.notify({
      type: 'positive',
      message: 'User created successfully',
      position: 'top'
    })

    showCreateDialog.value = false
    await loadUsers()
  } catch (error) {
    console.error('Failed to create user:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to create user',
      position: 'top'
    })
  }
}

const onPasswordSave = async (passwordData) => {
  try {
    const userRepo = dbStore.getUserRepository()
    await userRepo.updateUser(selectedUser.value.USER_ID, {
      PASSWORD_CHAR: passwordData.newPassword
    })

    $q.notify({
      type: 'positive',
      message: 'Password updated successfully',
      position: 'top'
    })

    showPasswordDialog.value = false
  } catch (error) {
    console.error('Failed to update password:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to update password',
      position: 'top'
    })
  }
}

const onCancelEdit = () => {
  showEditDialog.value = false
  selectedUser.value = null
}

const onCancelCreate = () => {
  showCreateDialog.value = false
}

const onPasswordCancel = () => {
  showPasswordDialog.value = false
  selectedUser.value = null
}

// Initialize
onMounted(() => {
  loadUsers()
})
</script>
