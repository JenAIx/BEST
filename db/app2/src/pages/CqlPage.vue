<template>
  <q-page class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">CQL Administration</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">Showing {{ cqlRules.length }} of {{ totalRules }} CQL rules</div>
        <q-btn color="primary" icon="add" label="Create CQL Rule" @click="onCreateRule" />
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-input v-model="searchQuery" outlined dense placeholder="Search CQL rules (code, name, description)..." @update:model-value="onSearchChange" debounce="300">
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
    <q-table :rows="cqlRules" :columns="columns" row-key="CQL_ID" :loading="loading" :pagination="pagination" @request="onRequest" binary-state-sort :rows-per-page-options="[10, 25, 50]">
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
    <CqlDialog v-model="showCqlDialog" :mode="cqlDialogMode" :cqlRule="selectedRule" @saved="onCqlSaved" @cancelled="onCqlCancelled" />

    <!-- Test CQL Rule Dialog -->
    <CqlTestDialog v-model="showTestDialog" :cqlRule="selectedRule" @cancel="onCancelTest" />
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useCqlStore } from 'src/stores/cql-store'
import CqlTestDialog from 'components/CqlTestDialog.vue'
import CqlDialog from 'components/CqlDialog.vue'

const $q = useQuasar()
const cqlStore = useCqlStore()

// State
const showCqlDialog = ref(false)
const cqlDialogMode = ref('create')
const showTestDialog = ref(false)

// Computed properties from store
const cqlRules = computed(() => cqlStore.cqlRules)
const totalRules = computed(() => cqlStore.totalRules)
const loading = computed(() => cqlStore.loading)
const selectedRule = computed(() => cqlStore.selectedRule)
const searchQuery = computed({
  get: () => cqlStore.searchQuery,
  set: (value) => cqlStore.setSearchQuery(value),
})

// Table configuration
const columns = [
  {
    name: 'CODE_CD',
    label: 'Code and Name',
    align: 'left',
    field: 'CODE_CD',
    sortable: true,
    style: 'min-width: 300px',
  },
  {
    name: 'status',
    label: 'Status',
    align: 'center',
    field: 'status',
    sortable: false,
    style: 'width: 120px',
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
    style: 'width: 150px',
  },
]

const pagination = computed({
  get: () => cqlStore.pagination,
  set: (value) => cqlStore.setPagination(value),
})

// Methods
const loadCqlRules = async () => {
  try {
    await cqlStore.loadCqlRules()
  } catch {
    $q.notify({
      type: 'negative',
      message: cqlStore.error || 'Failed to load CQL rules',
      position: 'top',
    })
  }
}

const onRequest = (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  // Update pagination
  cqlStore.setPagination({
    page,
    rowsPerPage,
    sortBy,
    descending,
  })

  // Reload data with new pagination
  loadCqlRules()
}

const onSearchChange = () => {
  // Search query is already updated via computed property
  // Store handles resetting to first page
  loadCqlRules()
}

const clearSearch = () => {
  cqlStore.clearSearch()
  loadCqlRules()
}

// Use store methods for status
const getCqlStatusColor = (rule) => cqlStore.getCqlStatusColor(rule)
const getCqlStatusLabel = (rule) => cqlStore.getCqlStatusLabel(rule)
const getCqlStatusTooltip = (rule) => cqlStore.getCqlStatusTooltip(rule)

const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// CQL Rule actions
const onCreateRule = () => {
  cqlStore.clearSelectedRule()
  cqlDialogMode.value = 'create'
  showCqlDialog.value = true
}

const onEditRule = (rule) => {
  cqlStore.setSelectedRule({ ...rule })
  cqlDialogMode.value = 'edit'
  showCqlDialog.value = true
}

const onTestRule = (rule) => {
  cqlStore.setSelectedRule({ ...rule })
  showTestDialog.value = true
}

const onDeleteRule = (rule) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete CQL rule "${rule.CODE_CD}" (${rule.NAME_CHAR})? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      await cqlStore.deleteCqlRule(rule.CQL_ID)

      $q.notify({
        type: 'positive',
        message: 'CQL rule deleted successfully',
        position: 'top',
      })
    } catch {
      $q.notify({
        type: 'negative',
        message: cqlStore.error || 'Failed to delete CQL rule',
        position: 'top',
      })
    }
  })
}

// Dialog handlers
const onCqlSaved = async () => {
  // Notification is handled by the dialog component
  // Just refresh the list
  await cqlStore.refreshRules()
}

const onCqlCancelled = () => {
  // Dialog will close itself
  cqlStore.clearSelectedRule()
}

const onCancelTest = () => {
  showTestDialog.value = false
  cqlStore.clearSelectedRule()
}

// Initialize
onMounted(async () => {
  await cqlStore.initialize()
})
</script>

<style lang="scss" scoped>
.monospace {
  font-family: 'Courier New', monospace;
  font-size: 0.8em;
}
</style>
