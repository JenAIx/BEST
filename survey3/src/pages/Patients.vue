<template>
  <q-page class="page-size" data-cy="page_patients">
    <div class="column items-center" style="height: 100%">
      <!-- HEADING -->
      <div class="col-auto q-pt-md text-h6">{{ $t('visit.patients_title') }}</div>

      <!-- NEW PATIENT -->
      <div class="col-auto q-pa-md row items-center q-gutter-sm" style="width: 100%; max-width: 600px">
        <q-input
          class="col"
          filled
          dense
          v-model="newPid"
          :label="$t('visit.patient_pid')"
          data-cy="new_pid"
          @keyup.enter="addPatient"
        />
        <q-btn
          color="primary"
          icon="add"
          :label="$t('visit.new_patient')"
          :disable="!newPid"
          data-cy="btn_add_patient"
          @click="addPatient"
        />
      </div>

      <!-- LIST -->
      <div class="col q-pb-md" style="position: relative; width: 100%; max-width: 600px">
        <q-scroll-area class="shadow-1 my-form">
          <div v-if="mainStore.PATIENTS.length === 0" class="q-pa-lg text-center text-grey-7">
            {{ $t('visit.no_patients') }}
          </div>
          <q-list separator>
            <q-item
              v-for="p in mainStore.PATIENTS"
              :key="p.id"
              clickable
              data-cy="patient_item"
              @click="openPatient(p)"
            >
              <q-item-section avatar>
                <q-avatar color="primary" text-color="white" icon="person" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ p.pid }}</q-item-label>
                <q-item-label caption>
                  {{ $t('visit.visits_title') }}: {{ visitCount(p.id) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="delete"
                  color="grey-7"
                  data-cy="btn_delete_patient"
                  @click.stop="deletePatient(p)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </div>
    </div>
    <BACKBUTTON />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import { useMainStore } from 'src/stores/main'

export default {
  name: 'PatientsPage',
  components: { BACKBUTTON },
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return { newPid: '' }
  },
  mounted() {
    this.mainStore.setProtectedMode(false)
  },
  methods: {
    visitCount(patientId) {
      return this.mainStore.VISIT_MAN.get_visits_for_patient(patientId).length
    },
    addPatient() {
      const pid = (this.newPid || '').trim()
      if (!pid) return
      const patient = this.mainStore.VISIT_MAN.add_patient(pid)
      this.newPid = ''
      this.openPatient(patient)
    },
    openPatient(p) {
      this.$router.push({ name: 'patient', params: { id: p.id } })
    },
    deletePatient(p) {
      if (!window.confirm(this.$t('visit.delete_patient_confirm'))) return
      this.mainStore.VISIT_MAN.remove_patient(p.id)
    },
  },
}
</script>
