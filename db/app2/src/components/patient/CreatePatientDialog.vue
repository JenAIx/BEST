<template>
  <q-dialog v-model="showDialog" persistent>
    <q-card style="min-width: 600px; max-width: 800px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-primary">
          <q-icon name="person_add" class="q-mr-sm" />
          {{ $t('patient.createPatient') }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-body2 text-grey-6 q-mb-md">{{ $t('patient.addPatientHint') }}</div>

        <q-form @submit="handleSubmit" class="q-gutter-md">
          <!-- Patient ID and Name -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-input
                v-model="formData.PATIENT_CD"
                :label="$t('patient.patientId') + ' *'"
                outlined
                dense
                debounce="300"
                :rules="[(val) => !!val || $t('patient.patientIdRequired'), validatePatientId]"
                clearable
                :placeholder="$t('patient.patientIdPlaceholder')"
              >
                <template v-slot:prepend>
                  <q-icon name="badge" />
                </template>
                <template v-slot:append>
                  <q-btn flat round dense icon="auto_awesome" color="primary" @click="generatePatientId" size="sm">
                    <q-tooltip>{{ $t('patient.generatePatientId') }}</q-tooltip>
                  </q-btn>
                </template>
              </q-input>
            </div>
            <div class="col">
              <q-input v-model="patientName" :label="$t('patient.patientName')" outlined dense clearable :placeholder="$t('patient.patientNamePlaceholder')">
                <template v-slot:prepend>
                  <q-icon name="person" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Demographics -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-input v-model="formData.BIRTH_DATE" type="date" label="Birth Date" outlined dense clearable @blur="onBirthDateBlur">
                <template v-slot:prepend>
                  <q-icon name="cake" />
                </template>
              </q-input>
            </div>
            <div class="col">
              <q-input v-model="formData.AGE_IN_YEARS" type="number" label="Age (Years)" outlined dense min="0" max="150" clearable @blur="onAgeBlur">
                <template v-slot:prepend>
                  <q-icon name="schedule" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Gender and Vital Status -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-select v-model="formData.SEX_CD" :options="genderOptions" label="Gender" outlined dense clearable emit-value map-options>
                <template v-slot:prepend>
                  <q-icon name="wc" />
                </template>
              </q-select>
            </div>
            <div class="col">
              <q-select v-model="formData.VITAL_STATUS_CD" :options="vitalStatusOptions" label="Vital Status" outlined dense clearable emit-value map-options>
                <template v-slot:prepend>
                  <q-icon name="favorite" />
                </template>
              </q-select>
            </div>
          </div>

          <!-- Language and Race -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-select v-model="formData.LANGUAGE_CD" :options="languageOptions" label="Language" outlined dense clearable emit-value map-options>
                <template v-slot:prepend>
                  <q-icon name="language" />
                </template>
              </q-select>
            </div>
            <div class="col">
              <q-select v-model="formData.RACE_CD" :options="raceOptions" label="Race" outlined dense clearable emit-value map-options>
                <template v-slot:prepend>
                  <q-icon name="diversity_3" />
                </template>
              </q-select>
            </div>
          </div>

          <!-- Marital Status and Religion -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-select v-model="formData.MARITAL_STATUS_CD" :options="maritalStatusOptions" label="Marital Status" outlined dense clearable emit-value map-options>
                <template v-slot:prepend>
                  <q-icon name="favorite_border" />
                </template>
              </q-select>
            </div>
            <div class="col">
              <q-select v-model="formData.RELIGION_CD" :options="religionOptions" label="Religion" outlined dense clearable emit-value map-options>
                <template v-slot:prepend>
                  <q-icon name="church" />
                </template>
              </q-select>
            </div>
          </div>

          <!-- Location and Source System -->
          <div class="row q-gutter-md">
            <div class="col">
              <q-input v-model="formData.STATECITYZIP_PATH" label="Location" outlined dense clearable placeholder="e.g., City, State, ZIP">
                <template v-slot:prepend>
                  <q-icon name="location_on" />
                </template>
              </q-input>
            </div>
            <div class="col">
              <q-input v-model="formData.SOURCESYSTEM_CD" label="Source System" outlined dense clearable placeholder="e.g., SYSTEM, EMR, MANUAL">
                <template v-slot:prepend>
                  <q-icon name="source" />
                </template>
              </q-input>
            </div>
          </div>

          <!-- Death Date (only show if vital status indicates deceased) -->
          <div v-if="showDeathDate" class="row q-gutter-md">
            <div class="col">
              <q-input v-model="formData.DEATH_DATE" type="date" label="Death Date" outlined dense clearable>
                <template v-slot:prepend>
                  <q-icon name="event_busy" />
                </template>
              </q-input>
            </div>
            <div class="col">
              <!-- Spacer -->
            </div>
          </div>

          <!-- Notes -->
          <q-input v-model="patientNotes" label="Notes" type="textarea" outlined rows="3" clearable placeholder="Additional notes about the patient...">
            <template v-slot:prepend>
              <q-icon name="notes" />
            </template>
          </q-input>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup :disable="loading" />
        <q-btn unelevated label="Create Patient" color="primary" icon="person_add" @click="handleSubmit" :loading="loading" :disable="!isFormValid" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useNotify } from 'src/composables/useNotify'
import { useRouter } from 'vue-router'
import { useDatabaseStore } from 'src/stores/database-store'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'patientCreated'])

const notify = useNotify()
const router = useRouter()
const databaseStore = useDatabaseStore()
const conceptStore = useConceptResolutionStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('CreatePatientDialog')

// Reactive state
const loading = ref(false)
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Form data with defaults
const formData = ref({
  PATIENT_CD: '',
  VITAL_STATUS_CD: 'SCTID: 55561003', // Active by default
  BIRTH_DATE: null,
  DEATH_DATE: null,
  AGE_IN_YEARS: null,
  SEX_CD: null,
  LANGUAGE_CD: null, // No default - let user choose from dropdown options
  RACE_CD: null,
  MARITAL_STATUS_CD: null,
  RELIGION_CD: null,
  STATECITYZIP_PATH: '',
  SOURCESYSTEM_CD: 'SYSTEM',
  UPLOAD_ID: 1,
})

// Additional form fields
const patientName = ref('')
const patientNotes = ref('')

// Dynamic options loaded from concept store
const genderOptions = ref([])
const vitalStatusOptions = ref([])
const languageOptions = ref([])
const raceOptions = ref([])
const maritalStatusOptions = ref([])
const religionOptions = ref([])

// Computed properties
const isFormValid = computed(() => {
  return formData.value.PATIENT_CD && formData.value.PATIENT_CD.trim()
})

const showDeathDate = computed(() => {
  // Show death date field if vital status indicates deceased
  const vitalStatus = formData.value.VITAL_STATUS_CD
  return (
    vitalStatus &&
    (vitalStatus.includes('419099009') || // SNOMED: Dead
      vitalStatus.toLowerCase().includes('dead') ||
      vitalStatus.toLowerCase().includes('deceased'))
  )
})

// Methods
const resetForm = async () => {
  // Get default values from global settings
  const defaultSourceSystem = await globalSettingsStore.getDefaultSourceSystem('PATIENT')

  formData.value = {
    PATIENT_CD: '',
    VITAL_STATUS_CD: 'SCTID: 55561003', // Active by default
    BIRTH_DATE: null,
    DEATH_DATE: null,
    AGE_IN_YEARS: null,
    SEX_CD: null,
    LANGUAGE_CD: null, // No default - let user choose from dropdown options
    RACE_CD: null,
    MARITAL_STATUS_CD: null,
    RELIGION_CD: null,
    STATECITYZIP_PATH: '',
    SOURCESYSTEM_CD: defaultSourceSystem,
    UPLOAD_ID: 1,
  }
  patientName.value = ''
  patientNotes.value = ''
}

const generatePatientId = async () => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2) // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const dateStr = `${year}${month}${day}`

  // Find the next available sequence number for today
  let sequence = 1
  let patientId = ''
  let exists = true

  try {
    if (!databaseStore.canPerformOperations) {
      // Fallback if database not available
      patientId = `PAT-${dateStr}-001`
    } else {
      // Check for existing IDs with today's date pattern
      while (exists && sequence <= 999) {
        const seqStr = sequence.toString().padStart(3, '0')
        patientId = `PAT-${dateStr}-${seqStr}`

        const existing = await databaseStore.findPatientByCode(patientId)
        exists = !!existing

        if (exists) {
          sequence++
        } else {
          break
        }
      }
    }

    formData.value.PATIENT_CD = patientId

    notify.success(`Generated Patient ID: ${patientId}`, { timeout: 2000 })
  } catch (error) {
    logger.error('Failed to generate patient ID', error)
    // Fallback to simple generation
    const seqStr = Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, '0')
    patientId = `PAT-${dateStr}-${seqStr}`
    formData.value.PATIENT_CD = patientId

    notify.info(`Generated Patient ID: ${patientId} (random)`, { timeout: 2000 })
  }
}

const calculateAgeFromBirthDate = (birthDate) => {
  if (!birthDate) return null

  const birth = new Date(birthDate)
  const today = new Date()

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age >= 0 ? age : null
}

const calculateBirthDateFromAge = (age) => {
  if (!age || age < 0 || age > 150) return null

  const currentYear = new Date().getFullYear()
  const birthYear = currentYear - age

  // Use January 1st as default birth date
  return `${birthYear}-01-01`
}

// Cache the last validation result so Quasar's repeat invocations (focus/blur, submit)
// don't re-hit the DB for an unchanged value. The q-input `debounce="300"` already
// suppresses validation on rapid typing, so we don't need an internal timer here.
let lastValidatedValue = null
let lastValidatedResult = true
const validatePatientId = async (val) => {
  if (!val || !val.trim()) return 'Patient ID is required'

  const trimmed = val.trim()
  if (lastValidatedValue === trimmed) {
    return lastValidatedResult
  }

  try {
    const existing = await databaseStore.findPatientByCode(trimmed)
    const result = existing ? 'Patient ID already exists' : true
    lastValidatedValue = trimmed
    lastValidatedResult = result
    return result
  } catch (error) {
    logger.warn('Failed to validate patient ID', error)
    return true // Allow creation if validation fails
  }
}

const loadConceptOptions = async () => {
  try {
    // Check database availability first
    if (!databaseStore.canPerformOperations) {
      throw new Error('Database not available for concept loading')
    }

    await conceptStore.initialize()

    // Load all concept options in parallel using hierarchical concept loading
    const [genderOpts, vitalOpts, languageOpts, raceOpts, maritalOpts, religionOpts] = await Promise.all([
      conceptStore.getConceptOptions('gender'),
      conceptStore.getConceptOptions('vital_status'),
      conceptStore.getConceptOptions('language'),
      conceptStore.getConceptOptions('race'),
      conceptStore.getConceptOptions('marital_status'),
      conceptStore.getConceptOptions('religion'),
    ])

    genderOptions.value = genderOpts
    vitalStatusOptions.value = vitalOpts
    languageOptions.value = languageOpts
    raceOptions.value = raceOpts
    maritalStatusOptions.value = maritalOpts
    religionOptions.value = religionOpts
  } catch (error) {
    logger.error('Failed to load concept options, using fallbacks', error)

    // Use fallback options from concept store - let the store handle all fallback logic
    genderOptions.value = conceptStore.getFallbackOptions('gender')
    vitalStatusOptions.value = conceptStore.getFallbackOptions('vital_status')
    languageOptions.value = conceptStore.getFallbackOptions('language')
    raceOptions.value = conceptStore.getFallbackOptions('race')
    maritalStatusOptions.value = conceptStore.getFallbackOptions('marital_status')
    religionOptions.value = conceptStore.getFallbackOptions('religion')
  }
}

const handleSubmit = async () => {
  if (!isFormValid.value) {
    notify.warning('Please fill in all required fields')
    return
  }

  loading.value = true

  try {
    // Check if database is available
    if (!databaseStore.canPerformOperations) {
      throw new Error('Database not available')
    }

    // Calculate age from birth date if not provided
    if (formData.value.BIRTH_DATE && !formData.value.AGE_IN_YEARS) {
      const birthYear = new Date(formData.value.BIRTH_DATE).getFullYear()
      const currentYear = new Date().getFullYear()
      formData.value.AGE_IN_YEARS = currentYear - birthYear
    }

    // Prepare patient blob with name and notes
    const patientBlob = {}
    if (patientName.value.trim()) {
      patientBlob.name = patientName.value.trim()
    }
    if (patientNotes.value.trim()) {
      patientBlob.notes = patientNotes.value.trim()
    }

    // Prepare patient data
    const patientData = {
      ...formData.value,
      PATIENT_BLOB: Object.keys(patientBlob).length > 0 ? JSON.stringify(patientBlob) : null,
      CREATED_AT: new Date().toISOString(),
      UPDATED_AT: new Date().toISOString(),
    }

    // Create the patient using database store
    const createdPatient = await databaseStore.createPatient(patientData)

    notify.success(`Patient created successfully (ID: ${createdPatient.PATIENT_CD})`, {
      timeout: 3000,
      actions: [
        {
          icon: 'close',
          color: 'white',
          handler: () => {
            /* dismiss */
          },
        },
      ],
    })

    // Small delay to ensure database operation completes
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Emit success event
    emit('patientCreated', createdPatient)

    // Close dialog
    showDialog.value = false

    // Navigate to the patient page
    router.push(`/patient/${createdPatient.PATIENT_CD}`)
  } catch (error) {
    logger.error('Error creating patient', error)
    notify.error(`Failed to create patient: ${error.message}`, { timeout: 5000 })
  } finally {
    loading.value = false
  }
}

// Watch for dialog open/close
watch(showDialog, async (newValue) => {
  if (newValue) {
    await resetForm()
    await loadConceptOptions() // Wait for concept options to load before dialog is fully ready
  }
})

// Blur event handlers for age/birth date calculation
const onBirthDateBlur = () => {
  if (formData.value.BIRTH_DATE && !formData.value.AGE_IN_YEARS) {
    const calculatedAge = calculateAgeFromBirthDate(formData.value.BIRTH_DATE)
    if (calculatedAge !== null && calculatedAge >= 0 && calculatedAge <= 150) {
      formData.value.AGE_IN_YEARS = calculatedAge
    }
  }
}

const onAgeBlur = () => {
  if (formData.value.AGE_IN_YEARS && !formData.value.BIRTH_DATE) {
    const calculatedBirthDate = calculateBirthDateFromAge(formData.value.AGE_IN_YEARS)
    if (calculatedBirthDate) {
      formData.value.BIRTH_DATE = calculatedBirthDate
    }
  }
}

// Initialize on mount
onMounted(() => {
  loadConceptOptions()
})
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 12px;
}

.text-h6 {
  font-weight: 600;
  letter-spacing: -0.025em;
}

.q-form {
  .q-field {
    margin-bottom: 8px;
  }
}

// Custom styling for required field indicators
.q-field--outlined .q-field__control:before {
  border-color: rgba(0, 0, 0, 0.24);
}

.q-field--error .q-field__control:before {
  border-color: #f44336;
}

// Hover effects for buttons
.q-btn {
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
  }
}

// Form section styling
.q-card-section {
  &:first-child {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }
}

// Icon styling
.q-icon {
  color: rgba(0, 0, 0, 0.54);
}

// Input focus styling
.q-field--focused {
  .q-icon {
    color: var(--q-primary);
  }
}
</style>
