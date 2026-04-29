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
      <div v-if="!editing" class="q-gutter-sm">
        <div v-if="patient.LANGUAGE_RESOLVED || patient.LANGUAGE_CD" class="row">
          <div class="col-5 text-grey-6">Language:</div>
          <div class="col-7">{{ patient.LANGUAGE_RESOLVED || patient.LANGUAGE_CD }}</div>
        </div>
        <div v-if="patient.RACE_RESOLVED || patient.RACE_CD" class="row">
          <div class="col-5 text-grey-6">Race:</div>
          <div class="col-7">{{ patient.RACE_RESOLVED || patient.RACE_CD }}</div>
        </div>
        <div v-if="patient.MARITAL_STATUS_RESOLVED || patient.MARITAL_STATUS_CD" class="row">
          <div class="col-5 text-grey-6">Marital Status:</div>
          <div class="col-7">{{ patient.MARITAL_STATUS_RESOLVED || patient.MARITAL_STATUS_CD }}</div>
        </div>
        <div v-if="patient.RELIGION_RESOLVED || patient.RELIGION_CD" class="row">
          <div class="col-5 text-grey-6">Religion:</div>
          <div class="col-7">{{ patient.RELIGION_RESOLVED || patient.RELIGION_CD }}</div>
        </div>
        <div v-if="patient.STATECITYZIP_PATH" class="row">
          <div class="col-5 text-grey-6">Location:</div>
          <div class="col-7">{{ patient.STATECITYZIP_PATH }}</div>
        </div>
      </div>

      <!-- Edit Mode -->
      <div v-else class="q-gutter-md">
        <q-select v-model="editForm.language" :options="languageOptions" label="Language" outlined dense emit-value map-options />
        <q-select v-model="editForm.race" :options="raceOptions" label="Race" outlined dense emit-value map-options />
        <q-select v-model="editForm.maritalStatus" :options="maritalStatusOptions" label="Marital Status" outlined dense emit-value map-options />
        <q-select v-model="editForm.religion" :options="religionOptions" label="Religion" outlined dense emit-value map-options />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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
})

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

  editing.value = true
}

const cancelEdit = () => {
  editing.value = false
  editForm.value.language = ''
  editForm.value.race = ''
  editForm.value.maritalStatus = ''
  editForm.value.religion = ''
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
</style>
