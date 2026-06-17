<template>
  <q-page class="page-size" data-cy="page_patients">
    <div class="column items-center" style="height: 100%">
      <!-- HEADING -->
      <div class="col-auto q-pt-md text-h6">{{ $t('visit.patients_title') }}</div>
      <!-- CONTENT -->
      <div class="col full-width column items-center" style="min-height: 0">
        <PatientsList />
      </div>
    </div>
    <BACKBUTTON />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import PatientsList from 'src/components/PatientsList.vue'

export default {
  name: 'PagePatients',
  components: { BACKBUTTON, PatientsList },
}
</script>
