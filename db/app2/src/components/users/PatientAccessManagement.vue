<template>
  <div class="patient-access-management">
    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-h6">Patient Access Management</div>
        <div class="text-caption text-grey-7">Manage which users can access which patients</div>
      </div>
      <q-space />
      <q-input v-model="searchQuery" outlined dense placeholder="Search patients..." class="q-mr-sm" style="min-width: 250px">
        <template v-slot:prepend>
          <q-icon name="search" />
        </template>
        <template v-slot:append v-if="searchQuery">
          <q-icon name="clear" class="cursor-pointer" @click="searchQuery = ''" />
        </template>
      </q-input>
    </div>

    <!-- Patients Table -->
    <q-table
      :rows="filteredPatients"
      :columns="columns"
      row-key="PATIENT_NUM"
      :loading="loading"
      :pagination="pagination"
      @request="onRequest"
      flat
      bordered
    >
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td key="PATIENT_CD" :props="props">
            <div class="text-weight-medium">{{ props.row.PATIENT_CD }}</div>
          </q-td>
          <q-td key="userCount" :props="props">
            <q-badge :color="props.row.userCount > 0 ? 'primary' : 'grey-5'" :label="props.row.userCount" />
          </q-td>
          <q-td key="users" :props="props">
            <div class="row items-center q-gutter-xs">
              <!-- User Chips (read-only in table) -->
              <q-chip
                v-for="user in props.row.users"
                :key="user.USER_ID"
                :color="user.USER_CD === 'public' ? 'green' : 'blue'"
                text-color="white"
                size="sm"
                dense
              >
                <q-avatar v-if="user.USER_CD === 'public'" icon="public" color="green-7" text-color="white" />
                {{ user.NAME_CHAR || user.USER_CD }}
                <q-tooltip>
                  <div class="text-subtitle2">{{ user.NAME_CHAR || user.USER_CD }}</div>
                  <div class="text-caption">Username: {{ user.USER_CD }}</div>
                  <div class="text-caption" v-if="user.COLUMN_CD">Role: {{ user.COLUMN_CD }}</div>
                  <div class="text-caption" v-if="user.USER_CD === 'public'">Grants access to all users</div>
                </q-tooltip>
              </q-chip>
              
              <!-- Show hint if no users -->
              <span v-if="props.row.users.length === 0" class="text-grey-6 text-caption">No access assigned</span>
            </div>
          </q-td>
          <q-td key="actions" :props="props">
            <q-btn flat round dense icon="edit" color="primary" @click="onEditPatient(props.row)">
              <q-tooltip>Manage Access</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <!-- Add User Dialog -->
    <q-dialog v-model="showAddUserDialog" persistent>
      <q-card style="min-width: 500px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Add User Access</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="text-subtitle2 q-mb-sm">
            Patient: <strong>{{ selectedPatient?.PATIENT_CD }}</strong>
          </div>

          <q-select
            v-model="selectedUserToAdd"
            :options="availableUsers"
            option-value="USER_ID"
            option-label="display"
            outlined
            label="Select User *"
            use-input
            input-debounce="300"
            @filter="filterAvailableUsers"
            :loading="loadingUsers"
            hint="Select 'public' user to grant access to all users"
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar v-if="scope.opt.USER_CD === 'public'">
                  <q-icon name="public" color="green" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scope.opt.display }}</q-item-label>
                  <q-item-label caption v-if="scope.opt.USER_CD === 'public'">Grants access to all users</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey">No users available</q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-input
            v-model="newUserNote"
            outlined
            label="Note (optional)"
            hint="Optional description for this access grant"
            class="q-mt-md"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn
            flat
            label="Add User"
            color="primary"
            :loading="saving"
            :disable="!selectedUserToAdd"
            @click="onConfirmAddUser"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Patient Access Dialog -->
    <q-dialog v-model="showEditDialog" persistent>
      <q-card style="min-width: 600px; max-width: 800px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Manage Patient Access</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="text-subtitle1 q-mb-md">
            Patient: <strong>{{ selectedPatient?.PATIENT_CD }}</strong>
          </div>

          <div class="text-subtitle2 q-mb-sm">Users with Access:</div>
          
          <!-- User Chips with Remove -->
          <div class="row q-gutter-sm q-mb-md">
            <q-chip
              v-for="user in selectedPatient?.users || []"
              :key="user.USER_ID"
              :color="user.USER_CD === 'public' ? 'green' : 'blue'"
              text-color="white"
              size="md"
            >
              <q-avatar v-if="user.USER_CD === 'public'" icon="public" color="green-7" text-color="white" />
              {{ user.NAME_CHAR || user.USER_CD }}
              <q-tooltip>
                <div class="text-subtitle2">{{ user.NAME_CHAR || user.USER_CD }}</div>
                <div class="text-caption">Username: {{ user.USER_CD }}</div>
                <div class="text-caption" v-if="user.COLUMN_CD">Role: {{ user.COLUMN_CD }}</div>
                <div class="text-caption" v-if="user.USER_CD === 'public'">Grants access to all users</div>
              </q-tooltip>
              <AppRemoveConfirmationButton
                class="q-ml-xs chip-remove-btn"
                :loading="removingUserId === user.USER_ID && removingPatientNum === selectedPatient.PATIENT_NUM"
                @remove-confirmed="onRemoveUser(selectedPatient.PATIENT_NUM, user.USER_ID)"
              />
            </q-chip>

            <q-chip outline color="primary" clickable @click="onAddUserClick(selectedPatient)">
              <q-avatar icon="add" color="primary" text-color="white" />
              Add User
            </q-chip>
          </div>

          <q-separator class="q-my-md" />

          <div class="text-caption text-grey-7">
            Tip: Assign to "public" user to grant access to all users
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'
import AppRemoveConfirmationButton from 'src/components/shared/AppRemoveConfirmationButton.vue'

const $q = useQuasar()
const dbStore = useDatabaseStore()
const logger = useLoggingStore().createLogger('PatientAccessManagement')

// State
const loading = ref(false)
const saving = ref(false)
const searchQuery = ref('')
const patients = ref([])
const allUsers = ref([])
const loadingUsers = ref(false)

const showAddUserDialog = ref(false)
const showEditDialog = ref(false)
const selectedPatient = ref(null)
const selectedUserToAdd = ref(null)
const newUserNote = ref('')
const removingUserId = ref(null)
const removingPatientNum = ref(null)

const pagination = ref({
  page: 1,
  rowsPerPage: 20,
  rowsNumber: 0,
})

// Columns
const columns = [
  {
    name: 'PATIENT_CD',
    label: 'Patient ID',
    field: 'PATIENT_CD',
    align: 'left',
    sortable: true,
  },
  {
    name: 'userCount',
    label: 'Users',
    field: 'userCount',
    align: 'center',
    sortable: true,
  },
  {
    name: 'users',
    label: 'Access',
    field: 'users',
    align: 'left',
  },
  {
    name: 'actions',
    label: 'Actions',
    field: 'actions',
    align: 'center',
  },
]

// Computed
const filteredPatients = computed(() => {
  if (!searchQuery.value) return patients.value

  const query = searchQuery.value.toLowerCase()
  return patients.value.filter((p) => p.PATIENT_CD.toLowerCase().includes(query))
})

const availableUsers = computed(() => {
  if (!selectedPatient.value) return []

  const assignedUserIds = new Set(selectedPatient.value.users.map((u) => u.USER_ID))
  return allUsers.value
    .filter((u) => !assignedUserIds.has(u.USER_ID))
    .map((u) => ({
      ...u,
      display: `${u.NAME_CHAR || u.USER_CD} (${u.USER_CD})`,
    }))
})

// Methods
const loadPatients = async () => {
  loading.value = true
  try {
    // Load all patients
    const patientsResult = await dbStore.executeQuery(`
      SELECT PATIENT_NUM, PATIENT_CD
      FROM PATIENT_DIMENSION
      ORDER BY PATIENT_CD
    `)

    if (!patientsResult.success) {
      throw new Error('Failed to load patients')
    }

    // Load all user-patient associations
    const associationsResult = await dbStore.executeQuery(`
      SELECT 
        upl.PATIENT_NUM,
        upl.USER_ID,
        u.USER_CD,
        u.NAME_CHAR,
        u.COLUMN_CD
      FROM USER_PATIENT_LOOKUP upl
      JOIN USER_MANAGEMENT u ON upl.USER_ID = u.USER_ID
      ORDER BY u.USER_CD
    `)

    // Group users by patient
    const patientUsersMap = new Map()
    if (associationsResult.success) {
      associationsResult.data.forEach((assoc) => {
        if (!patientUsersMap.has(assoc.PATIENT_NUM)) {
          patientUsersMap.set(assoc.PATIENT_NUM, [])
        }
        patientUsersMap.get(assoc.PATIENT_NUM).push({
          USER_ID: assoc.USER_ID,
          USER_CD: assoc.USER_CD,
          NAME_CHAR: assoc.NAME_CHAR,
          COLUMN_CD: assoc.COLUMN_CD,
          display: `${assoc.NAME_CHAR || assoc.USER_CD} (${assoc.USER_CD})`,
        })
      })
    }

    // Combine data
    patients.value = patientsResult.data.map((patient) => {
      const users = patientUsersMap.get(patient.PATIENT_NUM) || []
      return {
        ...patient,
        users,
        userCount: users.length,
      }
    })

    pagination.value.rowsNumber = patients.value.length

    logger.success('Patients loaded with access data', { count: patients.value.length })
  } catch (error) {
    logger.error('Failed to load patients', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load patient data',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const loadAllUsers = async () => {
  loadingUsers.value = true
  try {
    const result = await dbStore.executeQuery(`
      SELECT USER_ID, USER_CD, NAME_CHAR, COLUMN_CD
      FROM USER_MANAGEMENT
      ORDER BY 
        CASE WHEN USER_CD = 'public' THEN 0 ELSE 1 END,
        NAME_CHAR
    `)

    if (result.success) {
      allUsers.value = result.data
    }
  } catch (error) {
    logger.error('Failed to load users', error)
  } finally {
    loadingUsers.value = false
  }
}

const onRequest = (props) => {
  pagination.value.page = props.pagination.page
  pagination.value.rowsPerPage = props.pagination.rowsPerPage
}

const onAddUserClick = async (patient) => {
  selectedPatient.value = patient
  selectedUserToAdd.value = null
  newUserNote.value = ''
  await loadAllUsers()
  showAddUserDialog.value = true
  showEditDialog.value = false
}

const onEditPatient = async (patient) => {
  selectedPatient.value = patient
  await loadAllUsers()
  showEditDialog.value = true
}

const filterAvailableUsers = (val, update) => {
  update(() => {
    // Filtering is handled by q-select internally with use-input
  })
}

const onConfirmAddUser = async () => {
  if (!selectedUserToAdd.value || !selectedPatient.value) return

  saving.value = true
  try {
    const userId = selectedUserToAdd.value.USER_ID
    const patientNum = selectedPatient.value.PATIENT_NUM

    logger.info('Adding user access', { userId, patientNum })

    const lookupRepo = dbStore.getRepository('userPatientLookup')
    try {
      await lookupRepo.addAssociation(userId, patientNum, { nameChar: newUserNote.value || null })
    } catch (err) {
      if (err.code === 'DUPLICATE_ASSOCIATION') {
        $q.notify({
          type: 'warning',
          message: 'This user already has access to this patient',
          position: 'top',
        })
        return
      }
      throw err
    }

    $q.notify({
      type: 'positive',
      message: 'User access granted successfully',
      position: 'top',
    })

    showAddUserDialog.value = false
    await loadPatients()

    // Update selected patient if edit dialog is open
    if (showEditDialog.value) {
      const updated = patients.value.find((p) => p.PATIENT_NUM === selectedPatient.value.PATIENT_NUM)
      if (updated) {
        selectedPatient.value = updated
      }
    }
  } catch (error) {
    logger.error('Failed to add user access', error)
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to grant user access',
      position: 'top',
    })
  } finally {
    saving.value = false
  }
}

const onRemoveUser = async (patientNum, userId) => {
  removingUserId.value = userId
  removingPatientNum.value = patientNum

  try {
    logger.info('Removing user access', { userId, patientNum })

    const lookupRepo = dbStore.getRepository('userPatientLookup')
    await lookupRepo.removeByUserAndPatient(userId, patientNum)

    $q.notify({
      type: 'positive',
      message: 'User access removed successfully',
      position: 'top',
    })

    await loadPatients()

    // Update selected patient if edit dialog is open
    if (showEditDialog.value && selectedPatient.value?.PATIENT_NUM === patientNum) {
      const updated = patients.value.find((p) => p.PATIENT_NUM === patientNum)
      if (updated) {
        selectedPatient.value = updated
      }
    }
  } catch (error) {
    logger.error('Failed to remove user access', error)
    $q.notify({
      type: 'negative',
      message: error.message || 'Failed to remove user access',
      position: 'top',
    })
  } finally {
    removingUserId.value = null
    removingPatientNum.value = null
  }
}

// Lifecycle
onMounted(() => {
  loadPatients()
})
</script>

<style lang="scss" scoped>
.patient-access-management {
  padding: 1rem;
}

// Style for remove button inside chips
.chip-remove-btn {
  :deep(.q-btn) {
    // Single remove button (before confirmation)
    background: rgba(white, 0.3) !important;
    color: black !important;
    
    &:hover {
      background: rgba(white, 0.5) !important;
      color: black !important;
    }
    
    // Icon color
    .q-icon {
      color: black !important;
    }
  }
  
  :deep(.remove-confirmation-buttons) {
    // Confirmation buttons
    background: white !important;
    border-color: rgba(black, 0.2) !important;
    
    .q-btn {
      color: $grey-8 !important;
      background: transparent !important;
      
      .q-icon {
        color: $grey-8 !important;
      }
    }
    
    .confirm-remove-btn {
      &:hover {
        background: $negative !important;
        color: white !important;
        
        .q-icon {
          color: white !important;
        }
      }
    }
    
    .cancel-remove-btn {
      &:hover {
        background: rgba($grey-6, 0.15) !important;
      }
    }
  }
}
</style>

