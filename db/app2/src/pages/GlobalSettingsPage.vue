<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-md">Global Settings</div>
    <p class="text-subtitle1 text-grey-7 q-mb-lg">Manage system-wide lookup values and configurations</p>

    <!-- Column Selection -->
    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-md-6">
        <q-select v-model="selectedColumn" :options="columnOptions" label="Select Configuration Type" outlined emit-value map-options @update:model-value="loadLookupValues" :loading="loadingColumns">
          <template v-slot:prepend>
            <q-icon name="list" />
          </template>
        </q-select>
      </div>
      <div class="col-md-6">
        <q-btn color="primary" icon="add" label="Add New Value" @click="showAddDialog = true" :disable="!selectedColumn" />
      </div>
    </div>

    <!-- Data Table -->
    <q-table
      v-if="selectedColumn"
      :rows="lookupValues"
      :columns="columns"
      row-key="CODE_CD"
      :pagination="pagination"
      :loading="loading"
      flat
      bordered
      :filter="filter"
      :filter-method="filterMethod"
      no-data-label="No values found"
    >
      <template v-slot:top>
        <div class="col-2 q-table__title">{{ getColumnTitle() }}</div>
        <q-space />
        <q-input v-model="filter" placeholder="Search..." dense outlined class="q-mr-md">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </template>

      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td key="CODE_CD" :props="props">
            {{ props.row.CODE_CD }}
          </q-td>
          <q-td key="NAME_CHAR" :props="props">
            <div v-if="editingRow !== props.row.CODE_CD">
              {{ props.row.NAME_CHAR }}
            </div>
            <q-input v-else v-model="editForm.NAME_CHAR" dense outlined autofocus @keyup.enter="saveEdit" @keyup.escape="cancelEdit" />
          </q-td>
          <q-td key="LOOKUP_BLOB" :props="props">
            <div v-if="editingRow !== props.row.CODE_CD">
              {{ props.row.LOOKUP_BLOB || '-' }}
            </div>
            <q-input v-else v-model="editForm.LOOKUP_BLOB" dense outlined @keyup.enter="saveEdit" @keyup.escape="cancelEdit" />
          </q-td>
          <q-td key="actions" :props="props">
            <q-btn v-if="editingRow !== props.row.CODE_CD" flat round dense color="primary" icon="edit" @click="startEdit(props.row)">
              <q-tooltip>Edit</q-tooltip>
            </q-btn>
            <q-btn v-if="editingRow === props.row.CODE_CD" flat round dense color="positive" icon="check" @click="saveEdit">
              <q-tooltip>Save</q-tooltip>
            </q-btn>
            <q-btn v-if="editingRow === props.row.CODE_CD" flat round dense color="negative" icon="close" @click="cancelEdit">
              <q-tooltip>Cancel</q-tooltip>
            </q-btn>
            <q-btn v-if="editingRow !== props.row.CODE_CD && !isSystemValue(props.row)" flat round dense color="negative" icon="delete" @click="deleteValue(props.row)">
              <q-tooltip>Delete</q-tooltip>
            </q-btn>
          </q-td>
        </q-tr>
      </template>
    </q-table>

    <!-- Add Dialog -->
    <q-dialog v-model="showAddDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add New {{ getColumnTitle() }}</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit="addValue" @reset="resetAddForm">
            <q-input
              v-model="addForm.CODE_CD"
              label="Code"
              outlined
              class="q-mb-md"
              :rules="[(val) => (val && val.length > 0) || 'Code is required', (val) => !lookupValues.some((v) => v.CODE_CD === val) || 'Code already exists']"
            />
            <q-input v-model="addForm.NAME_CHAR" label="Name/Value" outlined class="q-mb-md" :rules="[(val) => (val && val.length > 0) || 'Name is required']" />
            <q-input v-model="addForm.LOOKUP_BLOB" label="Description (Optional)" outlined type="textarea" rows="3" />

            <div class="row justify-end q-gutter-sm q-mt-md">
              <q-btn label="Cancel" color="grey" flat v-close-popup />
              <q-btn label="Reset" type="reset" color="warning" flat />
              <q-btn label="Add" type="submit" color="primary" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'

const $q = useQuasar()
const globalSettingsStore = useGlobalSettingsStore()

// State
const selectedColumn = ref('')
const lookupValues = ref([])
const loading = ref(false)
const filter = ref('')
const showAddDialog = ref(false)
const editingRow = ref(null)
const loadingColumns = ref(true)

// Form data
const addForm = ref({
  CODE_CD: '',
  NAME_CHAR: '',
  LOOKUP_BLOB: '',
})

const editForm = ref({
  NAME_CHAR: '',
  LOOKUP_BLOB: '',
})

// Column options - will be loaded dynamically
const columnOptions = ref([])

// Table configuration
const columns = [
  {
    name: 'CODE_CD',
    label: 'Code',
    field: 'CODE_CD',
    align: 'left',
    sortable: true,
  },
  {
    name: 'NAME_CHAR',
    label: 'Name/Value',
    field: 'NAME_CHAR',
    align: 'left',
    sortable: true,
  },
  {
    name: 'LOOKUP_BLOB',
    label: 'Description',
    field: 'LOOKUP_BLOB',
    align: 'left',
  },
  {
    name: 'actions',
    label: 'Actions',
    align: 'center',
  },
]

const pagination = ref({
  rowsPerPage: 20,
})

// Methods
const getColumnTitle = () => {
  const option = columnOptions.value.find((opt) => opt.value === selectedColumn.value)
  return option ? option.label : 'Values'
}

// Load unique COLUMN_CD values from database
const loadColumnOptions = async () => {
  loadingColumns.value = true
  try {
    columnOptions.value = await globalSettingsStore.loadColumnTypes()
  } catch (error) {
    console.error('Error loading column options:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load configuration types',
      caption: error.message,
    })
  } finally {
    loadingColumns.value = false
  }
}

const loadLookupValues = async () => {
  if (!selectedColumn.value) return

  loading.value = true
  try {
    lookupValues.value = await globalSettingsStore.loadLookupValues(selectedColumn.value)
  } catch (error) {
    console.error('Error loading lookup values:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load values',
      caption: error.message,
    })
  } finally {
    loading.value = false
  }
}

const filterMethod = (rows, terms) => {
  const lowerTerms = terms ? terms.toLowerCase() : ''
  return rows.filter((row) => {
    return row.CODE_CD.toLowerCase().includes(lowerTerms) || row.NAME_CHAR.toLowerCase().includes(lowerTerms) || (row.LOOKUP_BLOB && row.LOOKUP_BLOB.toLowerCase().includes(lowerTerms))
  })
}

const isSystemValue = (row) => {
  return globalSettingsStore.isSystemValue(row)
}

const startEdit = (row) => {
  editingRow.value = row.CODE_CD
  editForm.value = {
    NAME_CHAR: row.NAME_CHAR,
    LOOKUP_BLOB: row.LOOKUP_BLOB || '',
  }
}

const cancelEdit = () => {
  editingRow.value = null
  editForm.value = {
    NAME_CHAR: '',
    LOOKUP_BLOB: '',
  }
}

const saveEdit = async () => {
  try {
    await globalSettingsStore.updateLookupValue(editingRow.value, editForm.value.NAME_CHAR, editForm.value.LOOKUP_BLOB)

    $q.notify({
      type: 'positive',
      message: 'Value updated successfully',
    })
    await loadLookupValues()
    cancelEdit()
  } catch (error) {
    console.error('Error updating value:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to update value',
      caption: error.message,
    })
  }
}

const addValue = async () => {
  try {
    await globalSettingsStore.addLookupValue(selectedColumn.value, addForm.value.CODE_CD, addForm.value.NAME_CHAR, addForm.value.LOOKUP_BLOB)

    $q.notify({
      type: 'positive',
      message: 'Value added successfully',
    })
    showAddDialog.value = false
    resetAddForm()
    await loadLookupValues()
  } catch (error) {
    console.error('Error adding value:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to add value',
      caption: error.message,
    })
  }
}

const deleteValue = async (row) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete "${row.NAME_CHAR}"?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await globalSettingsStore.deleteLookupValue(row.CODE_CD)

      $q.notify({
        type: 'positive',
        message: 'Value deleted successfully',
      })
      await loadLookupValues()
    } catch (error) {
      console.error('Error deleting value:', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete value',
        caption: error.message,
      })
    }
  })
}

const resetAddForm = () => {
  addForm.value = {
    CODE_CD: '',
    NAME_CHAR: '',
    LOOKUP_BLOB: '',
  }
}

// Load initial data
onMounted(async () => {
  // Initialize the store if not already done
  await globalSettingsStore.initialize()

  // First load the available columns
  await loadColumnOptions()

  // Then default to categories if available
  if (columnOptions.value.length > 0) {
    // Try to find CATEGORY_CHAR, otherwise use first option
    const categoryOption = columnOptions.value.find((opt) => opt.value === 'CATEGORY_CHAR')
    selectedColumn.value = categoryOption ? 'CATEGORY_CHAR' : columnOptions.value[0].value
    await loadLookupValues()
  }
})
</script>

<style lang="scss" scoped>
.q-table__title {
  font-size: 1.2rem;
  font-weight: 500;
}
</style>
