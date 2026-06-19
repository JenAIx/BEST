<template>
  <q-page class="page-size" data-cy="page_patient">
    <div class="column items-center" style="height: 100%">
      <!-- HEADING -->
      <div v-if="patient" class="col-auto q-pt-md text-center">
        <div class="text-h6">{{ $t('visit.patient_title') }}: {{ patient.pid }}</div>
      </div>
      <div v-else class="col q-pa-lg text-center text-grey-7">—</div>

      <!-- NEW VISIT -->
      <div
        v-if="patient"
        class="col-auto q-pa-md row items-center q-gutter-sm"
        style="width: 100%; max-width: 640px"
      >
        <q-select
          class="col"
          filled
          dense
          v-model="selectedTemplate"
          :options="templateOptions"
          emit-value
          map-options
          :label="$t('visit.choose_template')"
          data-cy="select_template"
        />
        <q-btn
          color="primary"
          icon="add"
          :label="$t('visit.new_visit')"
          data-cy="btn_add_visit"
          @click="addVisit"
        />
      </div>

      <!-- VISIT LIST -->
      <div
        v-if="patient"
        class="col q-pb-md"
        style="position: relative; width: 100%; max-width: 640px"
      >
        <q-scroll-area class="shadow-1 my-form-wide">
          <div v-if="visits.length === 0" class="q-pa-lg text-center text-grey-7">
            {{ $t('visit.no_visits') }}
          </div>
          <q-list separator>
            <q-item
              v-for="v in visits"
              :key="v.id"
              clickable
              data-cy="visit_item"
              @click="openVisit(v)"
            >
              <q-item-section>
                <q-item-label>{{ v.label }}</q-item-label>
                <q-item-label caption>{{ formatDay(v.date) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-badge v-if="v.exportedAt" color="teal" :label="$t('visit.exported_badge')" />
                  <q-chip
                    dense
                    :color="progressColor(v)"
                    text-color="white"
                    :label="progressLabel(v)"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="grey-7"
                    data-cy="btn_delete_visit"
                    @click.stop="deleteVisit(v)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </div>

      <!-- EXPORT -->
      <div v-if="patient" class="col-auto q-pb-md">
        <q-btn
          color="secondary"
          icon="file_download"
          :label="$t('visit.export_patient')"
          data-cy="btn_export_patient"
          @click="exportPatient"
        />
      </div>
    </div>
    <BACKBUTTON :go_back="true" />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import { useMainStore } from 'src/stores/main'
import { visitProgress } from 'src/tools/visits/visit-model'
import { progressColor } from 'src/tools/visits/visit-ui'
import { formatDay } from 'src/tools/dateUtils'

export default {
  name: 'PatientPage',
  components: { BACKBUTTON },
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return { selectedTemplate: null }
  },
  computed: {
    patientId() {
      return this.$route.params.id
    },
    patient() {
      return this.mainStore.VISIT_MAN.get_patient(this.patientId)
    },
    visits() {
      return this.mainStore.VISIT_MAN.get_visits_for_patient(this.patientId)
    },
    templateOptions() {
      const opts = this.mainStore.VISIT_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))
      opts.unshift({ value: null, label: this.$t('visit.empty_visit') })
      return opts
    },
  },
  methods: {
    formatDay,
    progressLabel(v) {
      const p = visitProgress(v)
      return this.$t('visit.progress', { completed: p.completed, total: p.total })
    },
    progressColor(v) {
      return progressColor(visitProgress(v))
    },
    addVisit() {
      const visit = this.mainStore.VISIT_MAN.add_visit(this.patientId, this.selectedTemplate || null)
      this.selectedTemplate = null
      this.openVisit(visit)
    },
    openVisit(v) {
      this.$router.push({ name: 'visit', params: { id: v.id } })
    },
    async deleteVisit(v) {
      if (!(await this.$confirm(this.$t('visit.delete_visit_confirm')))) return
      this.mainStore.VISIT_MAN.remove_visit(v.id)
    },
    async exportPatient() {
      let total = 0
      let completed = 0
      this.visits.forEach((v) => {
        ;(v.items || []).forEach((i) => {
          total++
          if (i.status === 'completed') completed++
        })
      })
      const incomplete = total - completed
      if (completed === 0) {
        this.$q.notify({ message: this.$t('visit.export_empty'), color: 'warning' })
        return
      }
      if (incomplete > 0 &&
        !(await this.$confirm(this.$t('visit.export_incomplete_confirm', { count: incomplete, total })))) return
      const ok = this.mainStore.exportPatient(this.patientId)
      this.$q.notify({
        message: ok ? this.$t('visit.export_ok') : this.$t('visit.export_empty'),
        color: ok ? 'green' : 'warning',
      })
    },
  },
}
</script>
