<template>
  <div class="user-patient-associations">
    <!-- Search and Add -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-input v-model="searchQuery" outlined dense placeholder="Search associations (user, patient, description)..." @update:model-value="onSearchChange" debounce="300">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-icon v-if="searchQuery" name="close" @click="clearSearch" class="cursor-pointer" />
          </template>
        </q-input>
      </div>
      <div class="col-auto">
        <q-btn color="primary" icon="add" label="Create Association" @click="onCreateAssociation" />
      </div>
    </div>

    <!-- Associations Table -->
    <q-table
      :rows="associations"
      :columns="columns"
      row-key="USER_PATIENT_ID"
      :loading="loading"
      :pagination="pagination"
      @request="onRequest"
      binary-state-sort
      :rows-per-page-options="[10, 25, 50]"
      class="associations-table"
    >
      <!-- User Column -->
      <template v-slot:body-cell-USER_ID="props">
        <q-td :props="props">
          <div class="row items-center">
            <q-avatar size="28px" color="primary" text-color="white" class="q-mr-sm">
              {{ getUserInitials(props.row.USER_ID) }}
            </q-avatar>
            <div>
              <div class="text-weight-medium">{{ getUserName(props.row.USER_ID) }}</div>
              <div class="text-caption text-grey-6">{{ getUserCode(props.row.USER_ID) }}</div>
            </div>
          </div>
        </q-td>
      </template>

      <!-- Patient Column -->
      <template v-slot:body-cell-PATIENT_NUM="props">
        <q-td :props="props">
          <div>
            <div class="text-weight-medium">{{ getPatientCode(props.row.PATIENT_NUM) }}</div>
            <div class="text-caption text-grey-6">Patient ID: {{ props.row.PATIENT_NUM }}</div>
          </div>
        </q-td>
      </template>

      <!-- Description Column -->
      <template v-slot:body-cell-NAME_CHAR="props">
        <q-td :props="props">
          <div>
            <div>{{ props.row.NAME_CHAR || 'No description' }}</div>
            <div v-if="props.row.USER_PATIENT_BLOB" class="text-caption text-grey-6">
              {{ truncateText(props.row.USER_PATIENT_BLOB, 50) }}
            </div>
          </div>
        </q-td>
      </template>

      <!-- Actions Column -->
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round dense icon="edit" color="primary" @click="onEditAssociation(props.row)">
            <q-tooltip>Edit Association</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="delete" color="negative" @click="onDeleteAssociation(props.row)">
            <q-tooltip>Delete Association</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Association Dialog (Create/Edit) -->
    <q-dialog v-model="showAssociationDialog" persistent>
      <q-card style="min-width: 600px; max-width: 800px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ dialogMode === 'create' ? 'Create' : 'Edit' }} User-Patient Association</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="q-gutter-md">
            <!-- User Selection -->
            <q-select
              v-model="formData.USER_ID"
              :options="userOptions"
              option-value="USER_ID"
              option-label="display"
              outlined
              label="User *"
              use-input
              input-debounce="300"
              @filter="filterUsers"
              :loading="loadingUsers"
              :rules="[(val) => !!val || 'User is required']"
              clearable
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey"> No users found </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- Patient Selection -->
            <q-select
              v-model="formData.PATIENT_NUM"
              :options="patientOptions"
              option-value="PATIENT_NUM"
              option-label="display"
              outlined
              label="Patient *"
              use-input
              input-debounce="300"
              @filter="filterPatients"
              :loading="loadingPatients"
              :rules="[(val) => !!val || 'Patient is required']"
              clearable
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey"> No patients found </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- Description -->
            <q-input v-model="formData.NAME_CHAR" outlined label="Description" hint="Optional description of this association" />

            <!-- Additional Details -->
            <q-input v-model="formData.USER_PATIENT_BLOB" type="textarea" outlined rows="3" label="Additional Details" hint="Optional additional details about this user-patient relationship" />
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancel" @click="onCancelAssociation" />
          <q-btn color="primary" label="Save" :loading="saving" :disable="!isFormValid" @click="onSaveAssociation" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useUserStore } from 'src/stores/user-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'

const $q = useQuasar()
const userStore = useUserStore()
const dbStore = useDatabaseStore()
const logger = useLoggingStore().createLogger('UserPatientAssociations')

// State
const showAssociationDialog = ref(false)
const dialogMode = ref('create')
const selectedAssociation = ref(null)

// Use store state
const associations = computed(() => userStore.userPatientAssociations)
const loading = computed(() => userStore.loading)
const saving = computed(() => userStore.saving)
const searchQuery = computed({
  get: () => userStore.associationsSearchQuery,
  set: (value) => userStore.setAssociationsSearchQuery(value),
})

// Form data
const formData = ref({
  USER_ID: null,
  PATIENT_NUM: null,
  NAME_CHAR: '',
  USER_PATIENT_BLOB: '',
})

// Options for dropdowns
const userOptions = ref([])
const patientOptions = ref([])
const loadingUsers = ref(false)
const loadingPatients = ref(false)

// Cache for user and patient data
const usersCache = ref([])
const patientsCache = ref([])

// Pagination
const pagination = computed({
  get: () => userStore.associationsPagination,
  set: (value) => userStore.setAssociationsPagination(value),
})

// Table configuration
const columns = [
  {
    name: 'USER_ID',
    label: 'User',
    align: 'left',
    field: 'USER_ID',
    sortable: true,
    style: 'min-width: 200px',
  },
  {
    name: 'PATIENT_NUM',
    label: 'Patient',
    align: 'left',
    field: 'PATIENT_NUM',
    sortable: true,
    style: 'min-width: 180px',
  },
  {
    name: 'NAME_CHAR',
    label: 'Description',
    align: 'left',
    field: 'NAME_CHAR',
    sortable: true,
    style: 'min-width: 200px',
  },
  {
    name: 'UPDATE_DATE',
    label: 'Last Updated',
    align: 'center',
    field: 'UPDATE_DATE',
    sortable: true,
    style: 'width: 150px',
    format: (val) => (val ? new Date(val).toLocaleDateString() : 'Never'),
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    field: 'actions',
    sortable: false,
    style: 'width: 120px',
  },
]

// Computed
const isFormValid = computed(() => {
  return formData.value.USER_ID && formData.value.PATIENT_NUM
})

// Methods
const loadAssociations = async () => {
  try {
    await userStore.loadUserPatientAssociations()
  } catch {
    $q.notify({
      type: 'negative',
      message: userStore.error || 'Failed to load associations',
      position: 'top',
    })
  }
}

const onRequest = (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  userStore.setAssociationsPagination({
    page,
    rowsPerPage,
    sortBy,
    descending,
  })

  loadAssociations()
}

const onSearchChange = () => {
  // Search query is already updated via computed property
  // Store handles resetting to first page
  loadAssociations()
}

const clearSearch = () => {
  userStore.clearAssociationsSearch()
  loadAssociations()
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// Get user info from cache
const getUserName = (userId) => {
  const user = usersCache.value.find((u) => u.USER_ID === userId)
  return user ? user.NAME_CHAR : 'Unknown User'
}

const getUserCode = (userId) => {
  const user = usersCache.value.find((u) => u.USER_ID === userId)
  return user ? user.USER_CD : `User ID: ${userId}`
}

const getUserInitials = (userId) => {
  const userName = getUserName(userId)
  if (!userName || userName === 'Unknown User') return '?'
  return userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const getPatientCode = (patientNum) => {
  const patient = patientsCache.value.find((p) => p.PATIENT_NUM === patientNum)
  return patient ? patient.PATIENT_CD : `Patient ${patientNum}`
}

// Dialog methods
const onCreateAssociation = () => {
  selectedAssociation.value = null
  dialogMode.value = 'create'
  formData.value = {
    USER_ID: null,
    PATIENT_NUM: null,
    NAME_CHAR: '',
    USER_PATIENT_BLOB: '',
  }
  showAssociationDialog.value = true
  loadUserOptions()
  loadPatientOptions()
}

const onEditAssociation = (association) => {
  selectedAssociation.value = association
  dialogMode.value = 'edit'
  formData.value = {
    USER_ID: association.USER_ID,
    PATIENT_NUM: association.PATIENT_NUM,
    NAME_CHAR: association.NAME_CHAR || '',
    USER_PATIENT_BLOB: association.USER_PATIENT_BLOB || '',
  }
  showAssociationDialog.value = true
  loadUserOptions()
  loadPatientOptions()
}

const onCancelAssociation = () => {
  showAssociationDialog.value = false
  selectedAssociation.value = null
  formData.value = {
    USER_ID: null,
    PATIENT_NUM: null,
    NAME_CHAR: '',
    USER_PATIENT_BLOB: '',
  }
}

const onSaveAssociation = async () => {
  if (!isFormValid.value) return

  try {
    if (dialogMode.value === 'create') {
      await userStore.createUserPatientAssociation(formData.value)

      $q.notify({
        type: 'positive',
        message: 'Association created successfully',
        position: 'top',
      })
    } else {
      await userStore.updateUserPatientAssociation(selectedAssociation.value.USER_PATIENT_ID, formData.value)

      $q.notify({
        type: 'positive',
        message: 'Association updated successfully',
        position: 'top',
      })
    }

    showAssociationDialog.value = false
  } catch (error) {
    logger.error('Failed to save association', error)
    $q.notify({
      type: 'negative',
      message: error.message || userStore.error || 'Failed to save association',
      position: 'top',
    })
  }
}

const onDeleteAssociation = (association) => {
  const userName = getUserName(association.USER_ID)
  const patientCode = getPatientCode(association.PATIENT_NUM)

  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete the association between "${userName}" and "${patientCode}"? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      await userStore.deleteUserPatientAssociation(association.USER_PATIENT_ID)

      $q.notify({
        type: 'positive',
        message: 'Association deleted successfully',
        position: 'top',
      })
    } catch (error) {
      logger.error('Failed to delete association', error)
      $q.notify({
        type: 'negative',
        message: error.message || userStore.error || 'Failed to delete association',
        position: 'top',
      })
    }
  })
}

// Load dropdown options
const loadUserOptions = async () => {
  loadingUsers.value = true
  try {
    const result = await dbStore.executeQuery(`
      SELECT USER_ID, USER_CD, NAME_CHAR
      FROM USER_MANAGEMENT
      ORDER BY NAME_CHAR
      LIMIT 100
    `)

    if (result.success) {
      usersCache.value = result.data
      userOptions.value = result.data.map((user) => ({
        ...user,
        display: `${user.NAME_CHAR || user.USER_CD} (${user.USER_CD})`,
      }))
    }
  } catch (error) {
    logger.error('Failed to load users', error)
  } finally {
    loadingUsers.value = false
  }
}

const loadPatientOptions = async () => {
  loadingPatients.value = true
  try {
    const result = await dbStore.executeQuery(`
      SELECT PATIENT_NUM, PATIENT_CD
      FROM PATIENT_DIMENSION
      ORDER BY PATIENT_CD
      LIMIT 100
    `)

    if (result.success) {
      patientsCache.value = result.data
      patientOptions.value = result.data.map((patient) => ({
        ...patient,
        display: `${patient.PATIENT_CD} (ID: ${patient.PATIENT_NUM})`,
      }))
    }
  } catch (error) {
    logger.error('Failed to load patients', error)
  } finally {
    loadingPatients.value = false
  }
}

const filterUsers = (val, update) => {
  update(async () => {
    if (val === '') {
      await loadUserOptions()
    } else {
      loadingUsers.value = true
      try {
        const result = await dbStore.executeQuery(
          `
          SELECT USER_ID, USER_CD, NAME_CHAR
          FROM USER_MANAGEMENT
          WHERE USER_CD LIKE ? OR NAME_CHAR LIKE ?
          ORDER BY NAME_CHAR
          LIMIT 50
        `,
          [`%${val}%`, `%${val}%`],
        )

        if (result.success) {
          usersCache.value = [...usersCache.value, ...result.data]
          userOptions.value = result.data.map((user) => ({
            ...user,
            display: `${user.NAME_CHAR || user.USER_CD} (${user.USER_CD})`,
          }))
        }
      } catch (error) {
        logger.error('Failed to filter users', error)
      } finally {
        loadingUsers.value = false
      }
    }
  })
}

const filterPatients = (val, update) => {
  update(async () => {
    if (val === '') {
      await loadPatientOptions()
    } else {
      loadingPatients.value = true
      try {
        const result = await dbStore.executeQuery(
          `
          SELECT PATIENT_NUM, PATIENT_CD
          FROM PATIENT_DIMENSION
          WHERE PATIENT_CD LIKE ?
          ORDER BY PATIENT_CD
          LIMIT 50
        `,
          [`%${val}%`],
        )

        if (result.success) {
          patientsCache.value = [...patientsCache.value, ...result.data]
          patientOptions.value = result.data.map((patient) => ({
            ...patient,
            display: `${patient.PATIENT_CD} (ID: ${patient.PATIENT_NUM})`,
          }))
        }
      } catch (error) {
        logger.error('Failed to filter patients', error)
      } finally {
        loadingPatients.value = false
      }
    }
  })
}

// Expose methods for parent component
defineExpose({
  loadAssociations,
})

// Initialize
onMounted(async () => {
  console.log('UserPatientAssociations mounted')
  await loadAssociations()
  // Pre-load cache for display purposes
  await loadUserOptions()
  await loadPatientOptions()
  console.log('UserPatientAssociations initialization complete')
})
</script>

<style lang="scss" scoped>
.user-patient-associations {
  .associations-table {
    .q-table__top {
      padding: 0;
    }
  }
}
</style>
