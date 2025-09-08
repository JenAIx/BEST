<template>
  <q-dialog v-model="isVisible" persistent>
    <q-card style="min-width: 600px">
      <q-card-section class="row items-center">
        <div class="text-h6">Create New Research Study</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-form @submit="onSubmit" class="q-gutter-md">
          <q-input v-model="studyData.name" label="Study Name" outlined dense required :rules="[(val) => (val && val.length > 0) || 'Study name is required']" />

          <q-select
            v-model="studyData.category"
            :options="categoryOptions"
            label="Research Category"
            outlined
            dense
            required
            emit-value
            map-options
            :rules="[(val) => val || 'Category is required']"
          />

          <q-input v-model="studyData.description" label="Description" outlined dense type="textarea" rows="3" placeholder="Brief description of the research study" />

          <q-select v-model="studyData.status" :options="statusOptions" label="Status" outlined dense required emit-value map-options :rules="[(val) => val || 'Status is required']" />

          <q-input v-model="studyData.principalInvestigator" label="Principal Investigator" outlined dense placeholder="Lead researcher name" />

          <q-input v-model="studyData.targetPatientCount" label="Target Patient Count" outlined dense type="number" min="1" placeholder="Expected number of patients" />

          <q-select
            v-model="studyData.concepts"
            :options="conceptOptions"
            label="Associated Concepts"
            outlined
            dense
            multiple
            use-chips
            stack-label
            hint="Clinical concepts/assessments used in this study"
          />
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn flat label="Create Study" @click="onSubmit" :loading="loading" :disable="!isFormValid" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'study-created'])

const $q = useQuasar()

// Form data
const studyData = ref({
  name: '',
  category: null,
  description: '',
  status: 'planning',
  principalInvestigator: '',
  targetPatientCount: null,
  concepts: [],
})

const loading = ref(false)
const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Options
const categoryOptions = [
  { label: 'Neurological Assessment', value: 'neurological' },
  { label: 'Clinical Scales', value: 'scales' },
  { label: 'Stroke Research', value: 'stroke' },
  { label: 'Psychological Assessment', value: 'psychological' },
  { label: 'Imaging Studies', value: 'imaging' },
  { label: 'Laboratory Research', value: 'laboratory' },
]

const statusOptions = [
  { label: 'Planning', value: 'planning' },
  { label: 'Active', value: 'active' },
  { label: 'On Hold', value: 'on-hold' },
  { label: 'Completed', value: 'completed' },
]

// Mock concept options - replace with actual database query
const conceptOptions = ref([
  { label: 'Fugl-Meyer Assessment', value: 'fma' },
  { label: 'Box and Block Test', value: 'bbt' },
  { label: 'Montreal Cognitive Assessment', value: 'moca' },
  { label: 'Mini-Mental State Exam', value: 'mmse' },
  { label: 'DNMSQuest', value: 'dnms' },
  { label: 'Stroke Date', value: 'stroke_date' },
  { label: 'Stroke Diagnosis', value: 'stroke_diagnosis' },
])

// Computed
const isFormValid = computed(() => {
  return studyData.value.name.trim() && studyData.value.category && studyData.value.status
})

// Methods
const onSubmit = async () => {
  if (!isFormValid.value) return

  loading.value = true

  try {
    const { useStudyStore } = await import('src/stores/study-store')
    const studyStore = useStudyStore()

    const newStudy = await studyStore.createStudy({
      name: studyData.value.name,
      category: categoryOptions.find((c) => c.value === studyData.value.category)?.label || studyData.value.category,
      description: studyData.value.description,
      status: studyData.value.status,
      principalInvestigator: studyData.value.principalInvestigator,
      targetPatientCount: parseInt(studyData.value.targetPatientCount) || 0,
      concepts: studyData.value.concepts,
    })

    emit('study-created', newStudy)

    // Reset form
    resetForm()

    // Close dialog
    isVisible.value = false

    $q.notify({
      type: 'positive',
      message: `Study "${newStudy.name}" created successfully!`,
      position: 'top',
    })
  } catch (error) {
    console.error('Failed to create study:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to create study',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  studyData.value = {
    name: '',
    category: null,
    description: '',
    status: 'planning',
    principalInvestigator: '',
    targetPatientCount: null,
    concepts: [],
  }
}

// Watch for dialog visibility to reset form
watch(isVisible, (newValue) => {
  if (!newValue) {
    resetForm()
  }
})
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 12px;
}
</style>
