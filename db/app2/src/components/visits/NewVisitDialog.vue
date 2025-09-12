<template>
  <q-dialog :model-value="modelValue" @update:model-value="updateModelValue" persistent transition-show="scale" transition-hide="scale">
    <q-card style="min-width: 500px; max-width: 600px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ $t('visit.newVisit') }}</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="closeDialog" />
      </q-card-section>

      <q-card-section>
        <div class="patient-info q-mb-md">
          <q-avatar size="32px" color="primary" text-color="white" class="q-mr-sm">
            {{ patientInitials }}
          </q-avatar>
          <div>
            <div class="text-weight-medium">{{ patient.name }}</div>
            <div class="text-caption text-grey-6">{{ patient.id }}</div>
          </div>
        </div>

        <q-form @submit="saveVisit" class="q-gutter-md">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input v-model="visitData.date" type="date" :label="$t('visit.visitDate')" outlined :rules="[(val) => !!val || $t('validation.required')]">
                <template v-slot:prepend>
                  <q-icon name="event" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model="visitData.time" type="time" :label="$t('visit.visitTime')" outlined>
                <template v-slot:prepend>
                  <q-icon name="schedule" />
                </template>
              </q-input>
            </div>
          </div>

          <q-select v-model="visitData.type" :options="visitTypes" :label="$t('visit.visitType')" outlined emit-value map-options>
            <template v-slot:prepend>
              <q-icon :name="getTypeIcon(visitData.type)" />
            </template>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar>
                  <q-icon :name="scope.opt.icon" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-select v-model="visitData.location" :options="locationOptions" :label="$t('visit.location')" outlined emit-value map-options use-input @filter="filterLocations">
            <template v-slot:prepend>
              <q-icon name="place" />
            </template>
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey">{{ $t('visit.typeToAddCustomLocation') }}</q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-input v-model="visitData.notes" type="textarea" :label="$t('visit.visitNotes')" outlined rows="3" counter maxlength="500">
            <template v-slot:prepend>
              <q-icon name="notes" />
            </template>
          </q-input>

          <!-- Quick templates -->
          <div class="quick-templates">
            <div class="text-subtitle2 q-mb-sm">{{ $t('visit.quickTemplates') }}:</div>
            <div class="template-chips">
              <q-chip
                v-for="template in quickTemplates"
                :key="template.id"
                clickable
                @click="applyTemplate(template)"
                :color="template.color || 'grey-3'"
                text-color="white"
                :icon="template.icon || 'add'"
              >
                {{ template.name }}
              </q-chip>
            </div>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat :label="$t('visit.cancel')" @click="closeDialog" />
        <q-btn color="primary" :label="$t('visit.createVisit')" @click="saveVisit" :loading="creating" :disable="!isFormValid" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useDatabaseStore } from 'src/stores/database-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useGlobalSettingsStore } from 'src/stores/global-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { getTemplateDescription, isValidTemplate } from 'src/shared/utils/template-utils'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  patient: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'created'])

const $q = useQuasar()
const { t } = useI18n()
const dbStore = useDatabaseStore()
const visitStore = useVisitStore()
const globalSettingsStore = useGlobalSettingsStore()
const loggingStore = useLoggingStore()
const logger = loggingStore.createLogger('NewVisitDialog')

// State
const creating = ref(false)
const loadingOptions = ref(false)
const visitData = ref({
  date: new Date().toISOString().split('T')[0],
  time: '',
  type: 'routine',
  location: 'CLINIC',
  notes: '',
})

// Dynamic options from global settings
const visitTypes = ref([])
const locationOptions = ref([])
const filteredLocationOptions = ref([])

// Quick templates loaded from global settings store
const quickTemplates = ref([])

// Computed
const patientInitials = computed(() => {
  return props.patient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const isFormValid = computed(() => {
  return visitData.value.date && visitData.value.type
})

// Methods
const loadOptions = async () => {
  try {
    loadingOptions.value = true

    // Load visit types from global settings store (from CODE_LOOKUP)
    try {
      const visitTypeOptions = await globalSettingsStore.getVisitTypeOptions()

      if (visitTypeOptions && visitTypeOptions.length > 0) {
        visitTypes.value = visitTypeOptions.map((vt) => ({
          label: vt.label,
          value: vt.value,
          icon: vt.icon || 'local_hospital',
          description: vt.description || '',
        }))
        logger.debug('Loaded visit type options from global settings store', {
          optionsCount: visitTypeOptions.length,
          options: visitTypeOptions.map((opt) => ({ label: opt.label, value: opt.value })),
        })
      } else {
        // Use hardcoded fallback options if no database data
        visitTypes.value = [
          { label: 'Routine Check-up', value: 'routine', icon: 'health_and_safety', description: 'Regular scheduled appointment' },
          { label: 'Follow-up', value: 'followup', icon: 'follow_the_signs', description: 'Follow-up from previous visit' },
          { label: 'Emergency', value: 'emergency', icon: 'emergency', description: 'Urgent medical attention' },
          { label: 'Consultation', value: 'consultation', icon: 'psychology', description: 'Specialist consultation' },
          { label: 'Procedure', value: 'procedure', icon: 'medical_services', description: 'Medical procedure or treatment' },
        ]
        logger.debug('Using hardcoded fallback visit type options')
      }
    } catch (error) {
      logger.error('Failed to load visit type options from global settings store', error)
      // Use hardcoded fallback options
      visitTypes.value = [
        { label: 'Routine Check-up', value: 'routine', icon: 'health_and_safety', description: 'Regular scheduled appointment' },
        { label: 'Follow-up', value: 'followup', icon: 'follow_the_signs', description: 'Follow-up from previous visit' },
        { label: 'Emergency', value: 'emergency', icon: 'emergency', description: 'Urgent medical attention' },
        { label: 'Consultation', value: 'consultation', icon: 'psychology', description: 'Specialist consultation' },
        { label: 'Procedure', value: 'procedure', icon: 'medical_services', description: 'Medical procedure or treatment' },
      ]
    }

    // Load location options from global settings
    // For now, we'll check if location options exist in CODE_LOOKUP
    try {
      const locationData = await globalSettingsStore.loadLookupValues('LOCATION_CD')
      if (locationData && locationData.length > 0) {
        locationOptions.value = locationData.map((loc) => ({
          label: loc.NAME_CHAR || loc.CODE_CD,
          value: loc.CODE_CD,
        }))
      } else {
        // Fallback to hardcoded options if not in database
        locationOptions.value = [{ label: 'Main Clinic', value: 'CLINIC' }]
      }
    } catch {
      // Use fallback if location lookup fails
      locationOptions.value = [{ label: 'Main Clinic', value: 'CLINIC' }]
    }

    filteredLocationOptions.value = [...locationOptions.value]

    // Load quick templates from global settings
    try {
      const templates = await globalSettingsStore.getVisitTemplateOptions()
      // Validate and enhance templates
      quickTemplates.value = templates.filter((template) => isValidTemplate(template))
      logger.info('Quick templates loaded successfully', {
        templateCount: quickTemplates.value.length,
        validTemplates: quickTemplates.value.map((t) => t.id),
      })
    } catch (error) {
      logger.error('Failed to load visit templates', error)
      // Templates will remain empty array on failure
    }

    // Set default values if current values don't exist in loaded options
    if (visitTypes.value.length > 0 && !visitTypes.value.find((vt) => vt.value === visitData.value.type)) {
      visitData.value.type = visitTypes.value[0].value
    }

    if (locationOptions.value.length > 0 && !locationOptions.value.find((loc) => loc.value === visitData.value.location)) {
      visitData.value.location = locationOptions.value[0].value
    }
  } catch (error) {
    logger.error('Failed to load options from global settings', error)
    $q.notify({
      type: 'warning',
      message: t('visit.usingDefaultOptions'),
      position: 'top',
    })

    // Fallback to default options
    visitTypes.value = [
      { label: 'Routine Check-up', value: 'routine', icon: 'health_and_safety', description: 'Regular scheduled appointment' },
      { label: 'Follow-up', value: 'followup', icon: 'follow_the_signs', description: 'Follow-up from previous visit' },
      { label: 'Emergency', value: 'emergency', icon: 'emergency', description: 'Urgent medical attention' },
      { label: 'Consultation', value: 'consultation', icon: 'psychology', description: 'Specialist consultation' },
      { label: 'Procedure', value: 'procedure', icon: 'medical_services', description: 'Medical procedure or treatment' },
    ]

    locationOptions.value = [
      { label: 'Main Clinic', value: 'CLINIC' },
      { label: 'Emergency Room', value: 'ER' },
      { label: 'Outpatient', value: 'OUTPATIENT' },
      { label: 'Home Visit', value: 'HOME' },
      { label: 'Telemedicine', value: 'TELEHEALTH' },
    ]

    filteredLocationOptions.value = [...locationOptions.value]
  } finally {
    loadingOptions.value = false
  }
}

const updateModelValue = (value) => {
  emit('update:modelValue', value)
}

const closeDialog = () => {
  resetForm()
  updateModelValue(false)
}

const resetForm = () => {
  visitData.value = {
    date: new Date().toISOString().split('T')[0],
    time: '',
    type: visitTypes.value.length > 0 ? visitTypes.value[0].value : 'routine',
    location: locationOptions.value.length > 0 ? locationOptions.value[0].value : 'CLINIC',
    notes: '',
  }
}

const getTypeIcon = (type) => {
  const typeObj = visitTypes.value.find((t) => t.value === type)
  return typeObj?.icon || 'local_hospital'
}

const filterLocations = (val, update) => {
  update(() => {
    if (val === '') {
      filteredLocationOptions.value = locationOptions.value
    } else {
      const needle = val.toLowerCase()
      filteredLocationOptions.value = locationOptions.value.filter((option) => option.label.toLowerCase().includes(needle))

      // Add custom option if not found
      if (!filteredLocationOptions.value.some((opt) => opt.value === val)) {
        filteredLocationOptions.value.push({
          label: `Custom: ${val}`,
          value: val,
        })
      }
    }
  })
}

const applyTemplate = (template) => {
  if (!isValidTemplate(template)) {
    logger.warn('Invalid template provided', { template })
    return
  }

  // Apply template properties to visit data
  visitData.value.type = template.type || 'routine'

  // Use template description or notes as visit notes
  const templateNotes = getTemplateDescription(template)
  visitData.value.notes = templateNotes !== 'Standard visit template' ? templateNotes : template.notes || ''

  // Apply location if provided in template
  if (template.location) {
    visitData.value.location = template.location
  }

  // Log template usage
  logger.logUserAction('visit_template_applied', {
    templateId: template.id,
    templateName: template.name,
    visitType: template.type,
    hasLocation: !!template.location,
  })

  $q.notify({
    type: 'positive',
    message: t('visit.appliedTemplate', { templateName: template.name }),
    position: 'top',
    color: template.color || 'primary',
    icon: template.icon || 'assignment',
  })
}

const saveVisit = async () => {
  if (!isFormValid.value) return

  try {
    creating.value = true

    const patientRepo = dbStore.getRepository('patient')

    const patient = await patientRepo.findByPatientCode(props.patient.id)
    if (!patient) {
      throw new Error(t('visit.patientNotFound'))
    }

    // Combine date and time if provided
    let startDate = visitData.value.date
    if (visitData.value.time) {
      startDate = `${visitData.value.date}T${visitData.value.time}`
    }

    const newVisitData = {
      PATIENT_NUM: patient.PATIENT_NUM,
      START_DATE: startDate,
      INOUT_CD: visitData.value.type === 'emergency' ? 'E' : 'O', // Map visit type to inpatient/outpatient
      ACTIVE_STATUS_CD: 'SCTID: 55561003', // Active (SNOMED-CT)
      LOCATION_CD: visitData.value.location,
      VISIT_BLOB: JSON.stringify({
        notes: visitData.value.notes,
        visitType: visitData.value.type, // Store visit type in VISIT_BLOB since VISIT_TYPE_CD column doesn't exist
        createdBy: 'VISITS_PAGE',
        createdAt: new Date().toISOString(),
      }),
    }

    const createdVisit = await visitStore.createVisit(newVisitData)

    const newVisit = {
      id: createdVisit.ENCOUNTER_NUM,
      date: startDate,
      type: visitData.value.type,
      notes: visitData.value.notes,
      status: 'active',
      location: visitData.value.location,
      observationCount: 0,
    }

    emit('created', newVisit)
    closeDialog()
  } catch (error) {
    logger.error('Failed to create visit', error)
    $q.notify({
      type: 'negative',
      message: t('visit.failedToCreateVisit'),
      position: 'top',
    })
  } finally {
    creating.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await loadOptions()
})

// Watchers
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      resetForm()
    }
  },
)
</script>

<style lang="scss" scoped>
.patient-info {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background: $grey-1;
  border-radius: 8px;
  border-left: 3px solid $primary;
}

.quick-templates {
  .template-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}

:deep(.q-field--outlined .q-field__control) {
  border-radius: 8px;
}

:deep(.q-dialog__inner) {
  padding: 1rem;
}
</style>
