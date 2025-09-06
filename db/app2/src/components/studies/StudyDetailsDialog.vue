<template>
  <q-dialog v-model="isVisible" persistent>
    <q-card style="min-width: 700px">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ study?.name || 'Study Details' }}</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="study">
        <div class="row q-gutter-md">
          <!-- Study Info -->
          <div class="col-12 col-md-8">
            <q-card flat bordered>
              <q-card-section>
                <div class="row items-center q-mb-md">
                  <q-icon :name="getCategoryIcon(study.category)" :color="getCategoryColor(study.category)" size="24px" class="q-mr-sm" />
                  <div class="text-subtitle1">{{ study.category }}</div>
                  <q-chip :color="getStatusColor(study.status)" text-color="white" size="sm" class="q-ml-md">
                    {{ study.status }}
                  </q-chip>
                </div>

                <div class="text-body2 text-grey-7 q-mb-md">
                  {{ study.description }}
                </div>

                <div class="row q-gutter-sm">
                  <div class="col">
                    <div class="text-caption text-grey-6">Created</div>
                    <div class="text-body2">{{ formatDate(study.created) }}</div>
                  </div>
                  <div class="col">
                    <div class="text-caption text-grey-6">Patients</div>
                    <div class="text-body2">{{ study.patientCount }} / {{ study.targetPatientCount || 'N/A' }}</div>
                  </div>
                  <div class="col" v-if="study.principalInvestigator">
                    <div class="text-caption text-grey-6">PI</div>
                    <div class="text-body2">{{ study.principalInvestigator }}</div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- Quick Stats -->
          <div class="col-12 col-md-4">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-subtitle2 q-mb-md">Progress</div>
                <div class="text-center">
                  <div class="text-h4 text-primary q-mb-xs">{{ study.patientCount }}</div>
                  <div class="text-caption text-grey-6">Enrolled Patients</div>
                  <q-linear-progress :value="study.targetPatientCount ? study.patientCount / study.targetPatientCount : 0" color="primary" class="q-mt-sm" size="8px" />
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>

        <!-- Associated Concepts -->
        <div class="q-mt-md" v-if="study.concepts && study.concepts.length > 0">
          <div class="text-subtitle2 q-mb-sm">Associated Concepts</div>
          <div class="row q-gutter-xs">
            <q-chip v-for="concept in study.concepts" :key="concept" color="secondary" text-color="white" size="sm" icon="biotech">
              {{ getConceptLabel(concept) }}
            </q-chip>
          </div>
        </div>

        <!-- Recent Activity (Mock) -->
        <div class="q-mt-md">
          <div class="text-subtitle2 q-mb-sm">Recent Activity</div>
          <q-timeline color="primary">
            <q-timeline-entry title="Study Created" subtitle="Research protocol initialized" :caption="formatDate(study.created)" icon="flag" />
            <q-timeline-entry
              v-if="study.patientCount > 0"
              :title="`${study.patientCount} Patients Enrolled`"
              subtitle="Patient recruitment in progress"
              caption="Last updated recently"
              icon="group_add"
            />
          </q-timeline>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="Close" v-close-popup />
        <q-btn flat label="Edit Study" @click="onEdit" color="primary" />
        <q-btn flat label="View Analytics" @click="onViewAnalytics" color="secondary" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  study: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'edit'])

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Methods
const getCategoryIcon = (category) => {
  const icons = {
    'Neurological Assessment': 'psychology',
    'Clinical Scales': 'timeline',
    'Stroke Research': 'healing',
    'Psychological Assessment': 'sentiment_satisfied',
    'Imaging Studies': 'image',
    'Laboratory Research': 'science',
  }
  return icons[category] || 'biotech'
}

const getCategoryColor = (category) => {
  const colors = {
    'Neurological Assessment': 'primary',
    'Clinical Scales': 'secondary',
    'Stroke Research': 'positive',
    'Psychological Assessment': 'info',
    'Imaging Studies': 'warning',
    'Laboratory Research': 'negative',
  }
  return colors[category] || 'grey'
}

const getStatusColor = (status) => {
  const colors = {
    active: 'positive',
    completed: 'info',
    planning: 'warning',
    'on-hold': 'negative',
  }
  return colors[status] || 'grey'
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString()
}

const getConceptLabel = (concept) => {
  // Mock concept label mapping - replace with actual concept resolution
  const conceptLabels = {
    fma: 'Fugl-Meyer Assessment',
    bbt: 'Box and Block Test',
    moca: 'Montreal Cognitive Assessment',
    mmse: 'Mini-Mental State Exam',
    dnms: 'DNMSQuest',
    stroke_date: 'Stroke Date',
    stroke_diagnosis: 'Stroke Diagnosis',
  }
  return conceptLabels[concept] || concept
}

const onEdit = () => {
  emit('edit', props.study)
}

const onViewAnalytics = () => {
  // Handle analytics view
  console.log('View analytics for study:', props.study?.name)
}
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 12px;
}
</style>
