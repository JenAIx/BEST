<template>
  <div class="patient-data-view q-pa-md">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <PatientDemographicsCard :patient="patient" @updated="onCardUpdated" />
      </div>
      <div class="col-12 col-md-6">
        <PatientAdditionalInfoCard :patient="patient" @updated="onCardUpdated" />
      </div>
      <div class="col-12">
        <PatientStatisticsCard :patient="patient" :visits="visits" :observations="observations" />
      </div>
      <div class="col-12">
        <PatientStudyInfoCard :patient="patient" @updated="onCardUpdated" />
      </div>
    </div>
  </div>
</template>

<script setup>
import PatientDemographicsCard from 'src/components/patient/PatientDemographicsCard.vue'
import PatientAdditionalInfoCard from 'src/components/patient/PatientAdditionalInfoCard.vue'
import PatientStatisticsCard from 'src/components/patient/PatientStatisticsCard.vue'
import PatientStudyInfoCard from 'src/components/patient/PatientStudyInfoCard.vue'

defineProps({
  patient: { type: Object, required: true },
  visits: { type: Array, default: () => [] },
  observations: { type: Array, default: () => [] },
})

const emit = defineEmits(['updated'])

const onCardUpdated = () => emit('updated')
</script>

<style lang="scss" scoped>
.patient-data-view {
  max-width: 1200px;
  margin: 0 auto;

  .row.q-col-gutter-md {
    .col-12.col-md-4 {
      display: flex;

      .q-card {
        width: 100%;
      }
    }
  }
}
</style>
