<template>
  <q-card class="full-height">
    <q-card-section class="full-height">
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">{{ $t('patient.additionalInfoCard') }}</div>
        <q-btn v-if="!editing" flat round dense icon="edit" color="primary" size="sm" @click="startEdit">
          <q-tooltip>Edit Additional Info</q-tooltip>
        </q-btn>
        <div v-else class="row q-gutter-xs">
          <q-btn flat round dense icon="check" color="positive" size="sm" @click="save">
            <q-tooltip>Save Changes</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="close" color="negative" size="sm" @click="cancelEdit">
            <q-tooltip>Cancel</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- View Mode -->
      <div v-if="!editing" class="info-list">
        <div v-if="patient.LANGUAGE_RESOLVED || patient.LANGUAGE_CD" class="info-row">
          <span class="info-label">Language</span>
          <span class="info-value">{{ patient.LANGUAGE_RESOLVED || patient.LANGUAGE_CD }}</span>
        </div>
        <div v-if="patient.RACE_RESOLVED || patient.RACE_CD" class="info-row">
          <span class="info-label">Race</span>
          <span class="info-value">{{ patient.RACE_RESOLVED || patient.RACE_CD }}</span>
        </div>
        <div v-if="patient.MARITAL_STATUS_RESOLVED || patient.MARITAL_STATUS_CD" class="info-row">
          <span class="info-label">Marital Status</span>
          <span class="info-value">{{ patient.MARITAL_STATUS_RESOLVED || patient.MARITAL_STATUS_CD }}</span>
        </div>
        <div v-if="patient.RELIGION_RESOLVED || patient.RELIGION_CD" class="info-row">
          <span class="info-label">Religion</span>
          <span class="info-value">{{ patient.RELIGION_RESOLVED || patient.RELIGION_CD }}</span>
        </div>
        <div v-if="patient.STATECITYZIP_PATH" class="info-row">
          <span class="info-label">Location</span>
          <span class="info-value">{{ patient.STATECITYZIP_PATH }}</span>
        </div>
        <div v-for="field in viewCustomFields" :key="field.label" class="info-row">
          <span class="info-label">{{ field.label }}</span>
          <span class="info-value">{{ field.value }}</span>
        </div>
      </div>

      <!-- Edit Mode -->
      <div v-else class="q-gutter-md">
        <q-select v-model="editForm.language" :options="languageOptions" label="Language" outlined dense emit-value map-options />
        <q-select v-model="editForm.race" :options="raceOptions" label="Race" outlined dense emit-value map-options />
        <q-select v-model="editForm.maritalStatus" :options="maritalStatusOptions" label="Marital Status" outlined dense emit-value map-options />
        <q-select v-model="editForm.religion" :options="religionOptions" label="Religion" outlined dense emit-value map-options />
        <q-input v-model="editForm.location" label="Location" outlined dense clearable />

        <q-separator />

        <div class="row items-center justify-between">
          <div class="text-subtitle2">{{ $t('patient.customFields') }}</div>
          <q-btn flat dense icon="add" :label="$t('patient.addField')" color="primary" size="sm" @click="addCustomField" />
        </div>
        <div v-for="(field, idx) in editForm.customFields" :key="idx" class="row items-center no-wrap q-gutter-sm">
          <q-input v-model="field.label" :label="$t('patient.fieldName')" outlined dense class="col" />
          <q-input v-model="field.value" :label="$t('patient.fieldValue')" outlined dense class="col" />
          <q-btn flat round dense icon="delete" color="negative" size="sm" @click="removeCustomField(idx)">
            <q-tooltip>{{ $t('patient.removeField') }}</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['updated'])

const notify = useNotify()
const dbStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('PatientAdditionalInfoCard')

// State
const editing = ref(false)
const editForm = ref({
  language: '',
  race: '',
  maritalStatus: '',
  religion: '',
  location: '',
  customFields: [],
})

// PATIENT_BLOB keys owned by other features (name display, notes) — never
// surfaced or overwritten as custom fields here.
const RESERVED_BLOB_KEYS = ['name', 'notes', 'firstName', 'lastName', 'customFields']

const parseBlob = () => {
  if (!props.patient.PATIENT_BLOB) return {}
  try {
    const blob = JSON.parse(props.patient.PATIENT_BLOB)
    return blob && typeof blob === 'object' && !Array.isArray(blob) ? blob : {}
  } catch {
    return {}
  }
}

// Custom fields = blob.customFields plus any non-reserved scalar top-level
// keys (e.g. metadata written by importers), so nothing is invisible in edit mode.
const extractCustomFields = () => {
  const blob = parseBlob()
  const fields = []
  const cf = blob.customFields
  if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
    for (const [label, value] of Object.entries(cf)) {
      fields.push({ label, value: value == null ? '' : String(value) })
    }
  }
  for (const [key, value] of Object.entries(blob)) {
    if (RESERVED_BLOB_KEYS.includes(key)) continue
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      fields.push({ label: key, value: String(value) })
    }
  }
  return fields
}

const viewCustomFields = computed(() => extractCustomFields().filter((f) => f.value !== ''))

const addCustomField = () => {
  editForm.value.customFields.push({ label: '', value: '' })
}

const removeCustomField = (idx) => {
  editForm.value.customFields.splice(idx, 1)
}

// Options
const languageOptions = ref([])
const raceOptions = ref([])
const maritalStatusOptions = ref([])
const religionOptions = ref([])

// Load options from concept store
const loadOptions = async () => {
  try {
    if (!dbStore.canPerformOperations) return

    await conceptStore.initialize()

    // Load options from concept store
    const [languageOpts, raceOpts, maritalOpts, religionOpts] = await Promise.all([
      conceptStore.getConceptOptions('language'),
      conceptStore.getConceptOptions('race'),
      conceptStore.getConceptOptions('marital_status'),
      conceptStore.getConceptOptions('religion'),
    ])

    languageOptions.value = languageOpts
    raceOptions.value = raceOpts
    maritalStatusOptions.value = maritalOpts
    religionOptions.value = religionOpts

    // Preload current patient's concepts for better display
    const conceptsToPreload = [props.patient.LANGUAGE_CD, props.patient.RACE_CD, props.patient.MARITAL_STATUS_CD, props.patient.RELIGION_CD].filter(Boolean)

    if (conceptsToPreload.length > 0) {
      await conceptStore.resolveBatch(conceptsToPreload, { context: 'patient_additional_info' })
    }
  } catch (error) {
    logger.error('Failed to load options', error)
    // Use fallback options from concept store - let the store handle all fallback logic
    languageOptions.value = conceptStore.getFallbackOptions('language')
    raceOptions.value = conceptStore.getFallbackOptions('race')
    maritalStatusOptions.value = conceptStore.getFallbackOptions('marital_status')
    religionOptions.value = conceptStore.getFallbackOptions('religion')
  }
}

// Edit methods
const startEdit = () => {
  // Find the current values in the options arrays to ensure proper selection
  const currentLanguage = props.patient.LANGUAGE_CD || ''
  const currentRace = props.patient.RACE_CD || ''
  const currentMaritalStatus = props.patient.MARITAL_STATUS_CD || ''
  const currentReligion = props.patient.RELIGION_CD || ''

  // Set form values - the options should have matching values
  editForm.value.language = currentLanguage
  editForm.value.race = currentRace
  editForm.value.maritalStatus = currentMaritalStatus
  editForm.value.religion = currentReligion
  editForm.value.location = props.patient.STATECITYZIP_PATH || ''
  editForm.value.customFields = extractCustomFields()

  editing.value = true
}

const cancelEdit = () => {
  editing.value = false
  editForm.value.language = ''
  editForm.value.race = ''
  editForm.value.maritalStatus = ''
  editForm.value.religion = ''
  editForm.value.location = ''
  editForm.value.customFields = []
}

const save = async () => {
  try {
    const updates = {}
    if (editForm.value.language !== props.patient.LANGUAGE_CD) {
      updates.LANGUAGE_CD = editForm.value.language
    }
    if (editForm.value.race !== props.patient.RACE_CD) {
      updates.RACE_CD = editForm.value.race
    }
    if (editForm.value.maritalStatus !== props.patient.MARITAL_STATUS_CD) {
      updates.MARITAL_STATUS_CD = editForm.value.maritalStatus
    }
    if (editForm.value.religion !== props.patient.RELIGION_CD) {
      updates.RELIGION_CD = editForm.value.religion
    }
    if ((editForm.value.location || '') !== (props.patient.STATECITYZIP_PATH || '')) {
      updates.STATECITYZIP_PATH = editForm.value.location || null
    }

    // Rebuild PATIENT_BLOB: keep reserved keys as-is, absorb loose scalar
    // keys into customFields (they were shown as custom fields in the editor).
    const blob = parseBlob()
    for (const key of Object.keys(blob)) {
      if (!RESERVED_BLOB_KEYS.includes(key) && ['string', 'number', 'boolean'].includes(typeof blob[key])) {
        delete blob[key]
      }
    }
    const customFields = {}
    for (const field of editForm.value.customFields) {
      const label = (field.label || '').trim()
      if (!label) continue
      customFields[label] = field.value ?? ''
    }
    if (Object.keys(customFields).length > 0) {
      blob.customFields = customFields
    } else {
      delete blob.customFields
    }
    const newBlob = Object.keys(blob).length > 0 ? JSON.stringify(blob) : null
    if (newBlob !== (props.patient.PATIENT_BLOB || null)) {
      updates.PATIENT_BLOB = newBlob
    }

    if (Object.keys(updates).length > 0) {
      const updateQuery = `
                UPDATE PATIENT_DIMENSION
                SET ${Object.keys(updates)
                  .map((key) => `${key} = ?`)
                  .join(', ')},
                    UPDATE_DATE = datetime('now')
                WHERE PATIENT_NUM = ?
            `
      const values = [...Object.values(updates), props.patient.PATIENT_NUM]

      const result = await dbStore.executeQuery(updateQuery, values)

      if (result.success) {
        notify.success('Additional info updated successfully')
        emit('updated')
      } else {
        throw new Error('Update failed')
      }
    }

    editing.value = false
  } catch (error) {
    logger.error('Failed to save additional info', error)
    notify.error('Failed to update additional info')
  }
}

onMounted(() => {
  loadOptions()
})
</script>

<style lang="scss" scoped>
.full-height {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.info-label {
  flex: 0 0 auto;
  color: $grey-7;
  white-space: nowrap;
}

.info-value {
  flex: 1 1 auto;
  text-align: right;
  word-break: break-word;
}
</style>
