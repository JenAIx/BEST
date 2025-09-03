<template>
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
      <div class="col-2 q-table__title">{{ columnTitle }}</div>
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
          <q-input
            v-else
            :model-value="editForm.NAME_CHAR"
            @update:model-value="emit('update-edit-form', { ...editForm, NAME_CHAR: $event })"
            dense
            outlined
            autofocus
            @keyup.enter="emit('save-edit')"
            @keyup.escape="emit('cancel-edit')"
          />
        </q-td>
        <q-td key="LOOKUP_BLOB" :props="props">
          <div v-if="editingRow !== props.row.CODE_CD">
            <div v-if="!props.row.LOOKUP_BLOB || props.row.LOOKUP_BLOB.trim() === ''" class="text-grey-5">No metadata</div>
            <div v-else-if="isQuestionnaireColumn && isValidJson(props.row.LOOKUP_BLOB)">
              <div class="q-gutter-sm">
                <q-chip dense color="green" text-color="white" icon="quiz" clickable @click="emit('preview-questionnaire', props.row.LOOKUP_BLOB)">
                  Preview Questionnaire
                  <q-tooltip>Click to see how this questionnaire will appear to users</q-tooltip>
                </q-chip>
                <q-chip dense color="blue" text-color="white" icon="code" clickable @click="emit('view-json', props.row.LOOKUP_BLOB)">
                  View JSON
                  <q-tooltip>Click to view raw JSON structure</q-tooltip>
                </q-chip>
              </div>
              <div class="text-caption text-grey-6 q-mt-xs">
                {{ getQuestionnaireInfo(props.row.LOOKUP_BLOB) }}
              </div>
            </div>
            <div v-else-if="isFieldSetColumn">
              <q-chip dense color="purple" text-color="white" icon="settings" clickable @click="onEditFieldSet(props.row)">
                Edit Field Set
                <q-tooltip>Click to edit this field set configuration</q-tooltip>
              </q-chip>
              <div class="text-caption text-grey-6 q-mt-xs">
                {{ getFieldSetInfo(props.row.LOOKUP_BLOB) }}
              </div>
            </div>
            <div v-else>
              <q-chip v-if="isValidJson(props.row.LOOKUP_BLOB)" dense color="blue" text-color="white" icon="code" clickable @click="emit('view-json', props.row.LOOKUP_BLOB)"> JSON Metadata </q-chip>
              <span v-else class="text-body2">{{ props.row.LOOKUP_BLOB }}</span>
            </div>
          </div>
          <q-input
            v-else
            :model-value="editForm.LOOKUP_BLOB"
            @update:model-value="emit('update-edit-form', { ...editForm, LOOKUP_BLOB: $event })"
            type="textarea"
            :rows="isQuestionnaireColumn ? 8 : 3"
            dense
            outlined
            @keyup.enter="emit('save-edit')"
            @keyup.escape="emit('cancel-edit')"
            :placeholder="isQuestionnaireColumn ? 'Enter questionnaire JSON...' : 'Enter JSON metadata or description...'"
          />
        </q-td>
        <q-td key="actions" :props="props">
          <q-btn v-if="editingRow !== props.row.CODE_CD" flat round dense color="primary" icon="edit" @click="emit('start-edit', props.row)">
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn v-if="editingRow === props.row.CODE_CD" flat round dense color="positive" icon="check" @click="emit('save-edit')">
            <q-tooltip>Save</q-tooltip>
          </q-btn>
          <q-btn v-if="editingRow === props.row.CODE_CD" flat round dense color="negative" icon="close" @click="emit('cancel-edit')">
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
          <q-btn v-if="editingRow !== props.row.CODE_CD && !isSystemValue(props.row)" flat round dense color="negative" icon="delete" @click="emit('delete-value', props.row)">
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </q-tr>
    </template>
  </q-table>

  <!-- Field Set Editor Dialog -->
  <FieldSetEditorDialog
    v-if="isFieldSetColumn"
    v-model="showFieldSetDialog"
    :field-set-data="parsedFieldSetData"
    :field-set-code="selectedFieldSetCode"
    @save="onFieldSetSaved"
    @cancel="onFieldSetCancelled"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import FieldSetEditorDialog from './FieldSetEditorDialog.vue'

defineProps({
  selectedColumn: String,
  lookupValues: Array,
  loading: Boolean,
  editingRow: String,
  editForm: Object,
  columnTitle: String,
  isQuestionnaireColumn: Boolean,
  isFieldSetColumn: Boolean,
})

const emit = defineEmits(['start-edit', 'save-edit', 'cancel-edit', 'delete-value', 'preview-questionnaire', 'view-json', 'update-edit-form', 'edit-field-set', 'save-field-set'])

// Local state
const filter = ref('')
const showFieldSetDialog = ref(false)
const selectedFieldSetCode = ref('')
const fieldSetData = ref({
  description: '',
  icon: null,
  concepts: [],
})

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

// Computed
const parsedFieldSetData = computed(() => {
  try {
    if (fieldSetData.value && typeof fieldSetData.value === 'string') {
      const parsed = JSON.parse(fieldSetData.value)
      return {
        description: parsed.description || '',
        icon: parsed.icon || null,
        concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
      }
    }
    return {
      description: fieldSetData.value?.description || '',
      icon: fieldSetData.value?.icon || null,
      concepts: Array.isArray(fieldSetData.value?.concepts) ? fieldSetData.value.concepts : [],
    }
  } catch {
    return {
      description: '',
      icon: null,
      concepts: [],
    }
  }
})

// Methods
const filterMethod = (rows, terms) => {
  const lowerTerms = terms ? terms.toLowerCase() : ''
  return rows.filter((row) => {
    return row.CODE_CD.toLowerCase().includes(lowerTerms) || row.NAME_CHAR.toLowerCase().includes(lowerTerms) || (row.LOOKUP_BLOB && row.LOOKUP_BLOB.toLowerCase().includes(lowerTerms))
  })
}

const isValidJson = (str) => {
  if (!str || str.trim() === '') return false
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

const getQuestionnaireInfo = (jsonString) => {
  try {
    const questionnaire = JSON.parse(jsonString)
    const itemCount = questionnaire.items?.length || 0
    const method = questionnaire.results?.method || 'N/A'
    return `${itemCount} items • Method: ${method}`
  } catch {
    return 'Invalid JSON'
  }
}

const getFieldSetInfo = (jsonString) => {
  try {
    const fieldSet = JSON.parse(jsonString)
    const conceptCount = Array.isArray(fieldSet.concepts) ? fieldSet.concepts.length : 0
    const icon = fieldSet.icon ? `Icon: ${fieldSet.icon}` : 'No icon'
    return `${conceptCount} concepts • ${icon}`
  } catch {
    return 'Invalid field set JSON'
  }
}

const isSystemValue = () => {
  // This would typically come from a store or prop
  // For now, return false to allow editing
  return false
}

// Field Set Methods
const onEditFieldSet = (row) => {
  selectedFieldSetCode.value = row.CODE_CD
  fieldSetData.value = row.LOOKUP_BLOB || '{}'
  showFieldSetDialog.value = true
}

const onFieldSetSaved = (data) => {
  emit('save-field-set', {
    code: selectedFieldSetCode.value,
    description: data.description,
    jsonData: data.jsonData,
  })
  showFieldSetDialog.value = false
}

const onFieldSetCancelled = () => {
  showFieldSetDialog.value = false
  selectedFieldSetCode.value = ''
  fieldSetData.value = {
    description: '',
    icon: null,
    concepts: [],
  }
}
</script>

<style lang="scss" scoped>
.q-table__title {
  font-size: 1.2rem;
  font-weight: 500;
}
</style>
