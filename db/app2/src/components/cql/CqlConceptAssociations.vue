<template>
  <div class="cql-concept-associations">
    <!-- Search and Add -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-input v-model="searchQuery" outlined dense placeholder="Search associations (concept, CQL rule, description)..." @update:model-value="onSearchChange" debounce="300">
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
      row-key="CONCEPT_CQL_ID"
      :loading="loading"
      :pagination="pagination"
      @request="onRequest"
      binary-state-sort
      :rows-per-page-options="[10, 25, 50]"
      class="associations-table"
    >
      <!-- Concept Column -->
      <template v-slot:body-cell-CONCEPT_CD="props">
        <q-td :props="props">
          <div>
            <div v-if="props.row.CONCEPT_NAME" class="">
              {{ props.row.CONCEPT_NAME }}
            </div>
            <div class="text-caption text-grey-6">{{ props.row.CONCEPT_CD }}</div>
          </div>
        </q-td>
      </template>

      <!-- CQL Rule Column -->
      <template v-slot:body-cell-CQL_ID="props">
        <q-td :props="props">
          <div>
            <div class="">{{ getCqlRuleCode(props.row.CQL_ID) }}</div>
            <div class="text-caption text-grey-6">{{ getCqlRuleName(props.row.CQL_ID) }}</div>
          </div>
        </q-td>
      </template>

      <!-- Description Column -->
      <template v-slot:body-cell-NAME_CHAR="props">
        <q-td :props="props">
          <div>
            <div>{{ props.row.NAME_CHAR || 'No description' }}</div>
            <div v-if="props.row.RULE_BLOB" class="text-caption text-grey-6">
              {{ truncateText(props.row.RULE_BLOB, 50) }}
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
          <div class="text-h6">{{ dialogMode === 'create' ? 'Create' : 'Edit' }} CQL-Concept Association</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="q-gutter-md">
            <!-- Concept Selection -->
            <q-select
              v-model="formData.CONCEPT_CD"
              :options="conceptOptions"
              option-value="CONCEPT_CD"
              option-label="display"
              outlined
              label="Concept *"
              use-input
              input-debounce="300"
              @filter="filterConcepts"
              :loading="loadingConcepts"
              :rules="[(val) => !!val || 'Concept is required']"
              clearable
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey"> No concepts found </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- CQL Rule Selection -->
            <q-select
              v-model="formData.CQL_ID"
              :options="cqlRuleOptions"
              option-value="CQL_ID"
              option-label="display"
              outlined
              label="CQL Rule *"
              use-input
              input-debounce="300"
              @filter="filterCqlRules"
              :loading="loadingCqlRules"
              :rules="[(val) => !!val || 'CQL Rule is required']"
              clearable
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey"> No CQL rules found </q-item-section>
                </q-item>
              </template>
            </q-select>

            <!-- Description -->
            <q-input v-model="formData.NAME_CHAR" outlined label="Description" hint="Optional description of this association" />

            <!-- Rule Details -->
            <q-input v-model="formData.RULE_BLOB" type="textarea" outlined rows="3" label="Rule Details" hint="Optional additional details about how this rule applies to the concept" />
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
import { useCqlStore } from 'src/stores/cql-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLoggingStore } from 'src/stores/logging-store'

const $q = useQuasar()
const cqlStore = useCqlStore()
const dbStore = useDatabaseStore()
const logger = useLoggingStore().createLogger('CqlConceptAssociations')

// State
const associations = ref([])
const loading = ref(false)
const saving = ref(false)
const searchQuery = ref('')
const showAssociationDialog = ref(false)
const dialogMode = ref('create')
const selectedAssociation = ref(null)

// Form data
const formData = ref({
  CONCEPT_CD: null,
  CQL_ID: null,
  NAME_CHAR: '',
  RULE_BLOB: '',
})

// Options for dropdowns
const conceptOptions = ref([])
const cqlRuleOptions = ref([])
const loadingConcepts = ref(false)
const loadingCqlRules = ref(false)

// Pagination
const pagination = ref({
  sortBy: 'CONCEPT_CD',
  descending: false,
  page: 1,
  rowsPerPage: 10,
  rowsNumber: 0,
})

// Table configuration
const columns = [
  {
    name: 'CONCEPT_CD',
    label: 'Concept',
    align: 'left',
    field: 'CONCEPT_CD',
    sortable: true,
    style: 'min-width: 250px',
  },
  {
    name: 'CQL_ID',
    label: 'CQL Rule',
    align: 'left',
    field: 'CQL_ID',
    sortable: true,
    style: 'min-width: 200px',
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
  return formData.value.CONCEPT_CD && formData.value.CQL_ID
})

// Methods
const loadAssociations = async () => {
  loading.value = true
  try {
    const offset = (pagination.value.page - 1) * pagination.value.rowsPerPage

    let whereClause = ''
    const params = []

    if (searchQuery.value) {
      whereClause = `WHERE (ccl.NAME_CHAR LIKE ? OR ccl.RULE_BLOB LIKE ? OR cd.CONCEPT_CD LIKE ? OR cd.NAME_CHAR LIKE ?)`
      const searchTerm = `%${searchQuery.value}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM CONCEPT_CQL_LOOKUP ccl
      LEFT JOIN CONCEPT_DIMENSION cd ON ccl.CONCEPT_CD = cd.CONCEPT_CD
      ${whereClause}
    `
    const countResult = await dbStore.executeQuery(countQuery, params)
    pagination.value.rowsNumber = countResult.success ? countResult.data[0].count : 0

    // Get paginated data
    const dataQuery = `
      SELECT ccl.*, cd.NAME_CHAR as CONCEPT_NAME, cd.CONCEPT_PATH
      FROM CONCEPT_CQL_LOOKUP ccl
      LEFT JOIN CONCEPT_DIMENSION cd ON ccl.CONCEPT_CD = cd.CONCEPT_CD
      ${whereClause}
      ORDER BY ${pagination.value.sortBy} ${pagination.value.descending ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?
    `
    const dataResult = await dbStore.executeQuery(dataQuery, [...params, pagination.value.rowsPerPage, offset])

    associations.value = dataResult.success ? dataResult.data : []

    logger.info('Loaded CQL-Concept associations', {
      count: associations.value.length,
      total: pagination.value.rowsNumber,
    })
  } catch (error) {
    logger.error('Failed to load associations', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load associations',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const onRequest = (props) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination

  pagination.value.page = page
  pagination.value.rowsPerPage = rowsPerPage
  pagination.value.sortBy = sortBy
  pagination.value.descending = descending

  loadAssociations()
}

const onSearchChange = () => {
  pagination.value.page = 1
  loadAssociations()
}

const clearSearch = () => {
  searchQuery.value = ''
  pagination.value.page = 1
  loadAssociations()
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// Get CQL rule info from store
const getCqlRuleCode = (cqlId) => {
  const rule = cqlStore.cqlRules.find((r) => r.CQL_ID === cqlId)
  return rule ? rule.CODE_CD : `CQL_ID: ${cqlId}`
}

const getCqlRuleName = (cqlId) => {
  const rule = cqlStore.cqlRules.find((r) => r.CQL_ID === cqlId)
  return rule ? rule.NAME_CHAR : 'Unknown Rule'
}

// Dialog methods
const onCreateAssociation = () => {
  selectedAssociation.value = null
  dialogMode.value = 'create'
  formData.value = {
    CONCEPT_CD: null,
    CQL_ID: null,
    NAME_CHAR: '',
    RULE_BLOB: '',
  }
  showAssociationDialog.value = true
  loadConceptOptions()
  loadCqlRuleOptions()
}

const onEditAssociation = (association) => {
  selectedAssociation.value = association
  dialogMode.value = 'edit'
  formData.value = {
    CONCEPT_CD: association.CONCEPT_CD,
    CQL_ID: association.CQL_ID,
    NAME_CHAR: association.NAME_CHAR || '',
    RULE_BLOB: association.RULE_BLOB || '',
  }
  showAssociationDialog.value = true
  loadConceptOptions()
  loadCqlRuleOptions()
}

const onCancelAssociation = () => {
  showAssociationDialog.value = false
  selectedAssociation.value = null
  formData.value = {
    CONCEPT_CD: null,
    CQL_ID: null,
    NAME_CHAR: '',
    RULE_BLOB: '',
  }
}

const onSaveAssociation = async () => {
  if (!isFormValid.value) return

  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      // Create new association
      const insertQuery = `
        INSERT INTO CONCEPT_CQL_LOOKUP (CONCEPT_CD, CQL_ID, NAME_CHAR, RULE_BLOB, UPDATE_DATE, IMPORT_DATE)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `
      await dbStore.executeCommand(insertQuery, [formData.value.CONCEPT_CD, formData.value.CQL_ID, formData.value.NAME_CHAR, formData.value.RULE_BLOB])

      $q.notify({
        type: 'positive',
        message: 'Association created successfully',
        position: 'top',
      })
    } else {
      // Update existing association
      const updateQuery = `
        UPDATE CONCEPT_CQL_LOOKUP
        SET CONCEPT_CD = ?, CQL_ID = ?, NAME_CHAR = ?, RULE_BLOB = ?, UPDATE_DATE = datetime('now')
        WHERE CONCEPT_CQL_ID = ?
      `
      await dbStore.executeCommand(updateQuery, [formData.value.CONCEPT_CD, formData.value.CQL_ID, formData.value.NAME_CHAR, formData.value.RULE_BLOB, selectedAssociation.value.CONCEPT_CQL_ID])

      $q.notify({
        type: 'positive',
        message: 'Association updated successfully',
        position: 'top',
      })
    }

    showAssociationDialog.value = false
    await loadAssociations()
  } catch (error) {
    logger.error('Failed to save association', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to save association',
      position: 'top',
    })
  } finally {
    saving.value = false
  }
}

const onDeleteAssociation = (association) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete the association between "${association.CONCEPT_CD}" and CQL rule? This action cannot be undone.`,
    cancel: true,
    persistent: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      const deleteQuery = `DELETE FROM CONCEPT_CQL_LOOKUP WHERE CONCEPT_CQL_ID = ?`
      await dbStore.executeCommand(deleteQuery, [association.CONCEPT_CQL_ID])

      $q.notify({
        type: 'positive',
        message: 'Association deleted successfully',
        position: 'top',
      })

      await loadAssociations()
    } catch (error) {
      logger.error('Failed to delete association', error)
      $q.notify({
        type: 'negative',
        message: 'Failed to delete association',
        position: 'top',
      })
    }
  })
}

// Load dropdown options
const loadConceptOptions = async () => {
  loadingConcepts.value = true
  try {
    const result = await dbStore.executeQuery(`
      SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_PATH
      FROM CONCEPT_DIMENSION
      ORDER BY NAME_CHAR
      LIMIT 100
    `)

    if (result.success) {
      conceptOptions.value = result.data.map((concept) => ({
        ...concept,
        display: `${concept.CONCEPT_CD} - ${concept.NAME_CHAR}`,
      }))
    }
  } catch (error) {
    logger.error('Failed to load concepts', error)
  } finally {
    loadingConcepts.value = false
  }
}

const loadCqlRuleOptions = async () => {
  loadingCqlRules.value = true
  try {
    // Use store data if available
    if (cqlStore.cqlRules.length > 0) {
      cqlRuleOptions.value = cqlStore.cqlRules.map((rule) => ({
        ...rule,
        display: `${rule.CODE_CD} - ${rule.NAME_CHAR}`,
      }))
    } else {
      // Load from database directly
      const result = await dbStore.executeQuery(`
        SELECT CQL_ID, CODE_CD, NAME_CHAR
        FROM CQL_FACT
        ORDER BY CODE_CD
      `)

      if (result.success) {
        cqlRuleOptions.value = result.data.map((rule) => ({
          ...rule,
          display: `${rule.CODE_CD} - ${rule.NAME_CHAR}`,
        }))
      }
    }
  } catch (error) {
    logger.error('Failed to load CQL rules', error)
  } finally {
    loadingCqlRules.value = false
  }
}

const filterConcepts = (val, update) => {
  update(async () => {
    if (val === '') {
      await loadConceptOptions()
    } else {
      loadingConcepts.value = true
      try {
        const result = await dbStore.executeQuery(
          `
          SELECT CONCEPT_CD, NAME_CHAR, CONCEPT_PATH
          FROM CONCEPT_DIMENSION
          WHERE CONCEPT_CD LIKE ? OR NAME_CHAR LIKE ?
          ORDER BY NAME_CHAR
          LIMIT 50
        `,
          [`%${val}%`, `%${val}%`],
        )

        if (result.success) {
          conceptOptions.value = result.data.map((concept) => ({
            ...concept,
            display: `${concept.CONCEPT_CD} - ${concept.NAME_CHAR}`,
          }))
        }
      } catch (error) {
        logger.error('Failed to filter concepts', error)
      } finally {
        loadingConcepts.value = false
      }
    }
  })
}

const filterCqlRules = (val, update) => {
  update(() => {
    if (val === '') {
      loadCqlRuleOptions()
    } else {
      const filtered = cqlStore.cqlRules
        .filter((rule) => rule.CODE_CD.toLowerCase().includes(val.toLowerCase()) || rule.NAME_CHAR.toLowerCase().includes(val.toLowerCase()))
        .map((rule) => ({
          ...rule,
          display: `${rule.CODE_CD} - ${rule.NAME_CHAR}`,
        }))
      cqlRuleOptions.value = filtered
    }
  })
}

// Expose methods for parent component
defineExpose({
  loadAssociations,
})

// Initialize
onMounted(() => {
  loadAssociations()
})
</script>

<style lang="scss" scoped>
.cql-concept-associations {
  .associations-table {
    .q-table__top {
      padding: 0;
    }
  }
}
</style>
