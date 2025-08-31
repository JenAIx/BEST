<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">CQL Administration</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">
          Showing {{ cqlRules.length }} of {{ totalRules }} CQL rules
        </div>
        <q-btn color="primary" icon="add" label="Create CQL Rule" @click="onCreateRule" />
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-input v-model="searchQuery" outlined dense placeholder="Search CQL rules (code, name, description)..."
          @update:model-value="onSearchChange" debounce="300">
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
          <template v-slot:append>
            <q-icon v-if="searchQuery" name="close" @click="clearSearch" class="cursor-pointer" />
          </template>
        </q-input>
      </div>
    </div>

    <!-- CQL Rules Table -->
    <q-table :rows="cqlRules" :columns="columns" row-key="CQL_ID" :loading="loading" :pagination="pagination"
      @request="onRequest" binary-state-sort :rows-per-page-options="[10, 25, 50]">

      <!-- Code and Name Column -->
      <template v-slot:body-cell-CODE_CD="props">
        <q-td :props="props">
          <div>
            <div class="text-weight-medium">{{ props.row.CODE_CD }}</div>
            <div class="text-caption text-grey-6">{{ props.row.NAME_CHAR }}</div>
            <div v-if="props.row.CQL_BLOB" class="text-caption text-grey-6">
              {{ truncateText(props.row.CQL_BLOB, 50) }}
            </div>
          </div>
        </q-td>
      </template>

      <!-- CQL Status Column -->
      <template v-slot:body-cell-status="props">
        <q-td :props="props">
          <q-chip :color="getCqlStatusColor(props.row)" text-color="white" size="sm">
            {{ getCqlStatusLabel(props.row) }}
            <q-tooltip>{{ getCqlStatusTooltip(props.row) }}</q-tooltip>
          </q-chip>
        </q-td>
      </template>

      <!-- Actions Column -->
      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn flat round dense icon="edit" color="primary" @click="onEditRule(props.row)">
            <q-tooltip>Edit CQL Rule</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="play_arrow" color="secondary" @click="onTestRule(props.row)">
            <q-tooltip>Test CQL Rule</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="delete" color="negative" @click="onDeleteRule(props.row)">
            <q-tooltip>Delete CQL Rule</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- CQL Dialog (Create/Edit) -->
    <CqlDialog 
      v-model="showCqlDialog" 
      :mode="cqlDialogMode"
      :cqlRule="selectedRule" 
      @saved="onCqlSaved" 
      @cancelled="onCqlCancelled" 
    />

    <!-- Test CQL Rule Dialog -->
    <CqlTestDialog v-model="showTestDialog" :cqlRule="selectedRule" @cancel="onCancelTest" />
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useDatabaseStore } from 'src/stores/database-store'
import CqlTestDialog from 'components/CqlTestDialog.vue'
import CqlDialog from 'components/CqlDialog.vue'

const $q = useQuasar()
const dbStore = useDatabaseStore()

// State
const cqlRules = ref([])
const totalRules = ref(0)
const loading = ref(false)
const showCqlDialog = ref(false)
const cqlDialogMode = ref('create')
const showTestDialog = ref(false)
const selectedRule = ref(null)
const searchQuery = ref('')

// Table configuration
const columns = [
  {
    name: 'CODE_CD',
    label: 'Code and Name',
    align: 'left',
    field: 'CODE_CD',
    sortable: true,
    style: 'min-width: 300px'
  },
  {
    name: 'status',
    label: 'Status',
    align: 'center',
    field: 'status',
    sortable: false,
    style: 'width: 120px'
  },
  {
    name: 'UPDATE_DATE',
    label: 'Last Updated',
    align: 'center',
    field: 'UPDATE_DATE',
    sortable: true,
    style: 'width: 150px',
    format: (val) => val ? new Date(val).toLocaleDateString() : 'Never'
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
    field: 'actions',
    sortable: false,
    style: 'width: 150px'
  }
]

const pagination = ref({
  sortBy: 'CODE_CD',
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0
})

// Methods
const loadCqlRules = async () => {
  loading.value = true
  try {
    const cqlRepo = dbStore.getRepository('cql')
    if (!cqlRepo) {
      throw new Error('CQL repository not available')
    }

    // Build search criteria
    const criteria = {}
    if (searchQuery.value) {
      criteria.search = String(searchQuery.value)
    }

    // Get paginated results
    const result = await cqlRepo.getCqlRulesPaginated(
      pagination.value.page,
      pagination.value.rowsPerPage,
      criteria
    )

    cqlRules.value = result.rules || []
    totalRules.value = result.pagination?.totalCount || 0
    pagination.value.rowsNumber = totalRules.value

  } catch (error) {
    console.error('Failed to load CQL rules:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load CQL rules',
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

  // Reload data with new pagination
  loadCqlRules()
}

const onSearchChange = () => {
  // Reset to first page when searching
  pagination.value.page = 1
  loadCqlRules()
}

const clearSearch = () => {
  searchQuery.value = ''
  pagination.value.page = 1
  loadCqlRules()
}

const getCqlStatusColor = (rule) => {
  if (rule.CQL_CHAR && rule.JSON_CHAR) return 'green'
  if (rule.CQL_CHAR) return 'orange'
  return 'grey'
}

const getCqlStatusLabel = (rule) => {
  if (rule.CQL_CHAR && rule.JSON_CHAR) return 'Ready'
  if (rule.CQL_CHAR) return 'Draft'
  return 'Empty'
}

const getCqlStatusTooltip = (rule) => {
  if (rule.CQL_CHAR && rule.JSON_CHAR) return 'CQL rule is complete and ready for execution'
  if (rule.CQL_CHAR) return 'CQL rule has source code but no compiled JSON'
  return 'CQL rule is empty and needs to be configured'
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// CQL Rule actions
const onCreateRule = () => {
  selectedRule.value = null
  cqlDialogMode.value = 'create'
  showCqlDialog.value = true
}

const onEditRule = (rule) => {
  selectedRule.value = { ...rule }
  cqlDialogMode.value = 'edit'
  showCqlDialog.value = true
}

const onTestRule = (rule) => {
  selectedRule.value = { ...rule }
  showTestDialog.value = true
}

const onDeleteRule = (rule) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete CQL rule "${rule.CODE_CD}" (${rule.NAME_CHAR})? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative'
  }).onOk(async () => {
    try {
      const cqlRepo = dbStore.getRepository('cql')
      await cqlRepo.delete(rule.CQL_ID)

      $q.notify({
        type: 'positive',
        message: 'CQL rule deleted successfully',
        position: 'top'
      })

      await loadCqlRules()
    } catch (error) {
      console.error('Failed to delete CQL rule:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete CQL rule',
        position: 'top'
      })
    }
  })
}

// Dialog handlers
const onCqlSaved = async () => {
  // Notification is handled by the dialog component
  // Just refresh the list
  await loadCqlRules()
}

const onCqlCancelled = () => {
  // Dialog will close itself
  selectedRule.value = null
}

const onCancelTest = () => {
  showTestDialog.value = false
  selectedRule.value = null
}

// Initialize
onMounted(() => {
  loadCqlRules()
})
</script>

<style lang="scss" scoped>
.monospace {
  font-family: 'Courier New', monospace;
  font-size: 0.8em;
}
</style>
