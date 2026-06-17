<template>
  <q-page class="page-size" data-cy="page_visit">
    <div class="column items-center" style="height: 100%">
      <!-- HEADING -->
      <div v-if="visit" class="col-auto q-pt-md text-center">
        <div class="text-h6">{{ visit.label }}</div>
        <div class="text-caption text-grey-7">
          {{ patientPid }} · {{ formatDate(visit.date) }}
        </div>
      </div>
      <div v-else class="col q-pa-lg text-center text-grey-7">—</div>

      <!-- ADD QUESTIONNAIRE -->
      <div
        v-if="visit"
        class="col-auto q-pa-md row items-center q-gutter-sm"
        style="width: 100%; max-width: 640px"
      >
        <q-select
          class="col"
          filled
          dense
          v-model="selectedQuest"
          :options="questOptions"
          emit-value
          map-options
          use-input
          input-debounce="0"
          @filter="filterQuests"
          :label="$t('visit.add_questionnaire')"
          data-cy="select_questionnaire"
        />
        <q-btn
          color="primary"
          icon="add"
          :disable="!selectedQuest"
          data-cy="btn_add_questionnaire"
          @click="addQuestionnaire"
        />
      </div>

      <!-- SLOT LIST -->
      <div
        v-if="visit"
        class="col q-pb-md"
        style="position: relative; width: 100%; max-width: 640px"
      >
        <q-scroll-area class="shadow-1 my-form">
          <q-list separator>
            <q-item v-for="slot in visit.items" :key="slot.short_title" data-cy="slot_item">
              <q-item-section>
                <q-item-label>{{ questTitle(slot.short_title) }}</q-item-label>
                <q-item-label caption>
                  <q-badge :color="statusColor(slot.status)" :label="$t('visit.status.' + slot.status)" />
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    :icon="slotIcon(slot.status)"
                    :label="slotAction(slot.status)"
                    data-cy="btn_fill_slot"
                    @click="fillSlot(slot)"
                  />
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="grey-7"
                    @click="removeSlot(slot)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </div>

      <!-- EXPORT -->
      <div v-if="visit" class="col-auto q-pb-md">
        <q-btn
          color="secondary"
          icon="file_download"
          :label="$t('visit.export_visit')"
          data-cy="btn_export_visit"
          @click="exportVisit"
        />
      </div>
    </div>
    <BACKBUTTON :go_back="true" />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import { useMainStore } from 'src/stores/main'
import dateFormat from 'dateformat'

export default {
  name: 'VisitPage',
  components: { BACKBUTTON },
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return { selectedQuest: null, questFilter: null }
  },
  mounted() {
    this.mainStore.setProtectedMode(false)
  },
  computed: {
    visitId() {
      return this.$route.params.id
    },
    visit() {
      return this.mainStore.VISIT_MAN.get_visit(this.visitId)
    },
    patientPid() {
      if (!this.visit) return ''
      const p = this.mainStore.VISIT_MAN.get_patient(this.visit.patientId)
      return p ? p.pid : ''
    },
    questOptions() {
      const existing = new Set((this.visit && this.visit.items.map((i) => i.short_title)) || [])
      const filter = this.questFilter
      return this.mainStore.QUEST_LIST.filter((st) => !existing.has(st))
        .map((st) => ({ value: st, label: this.questTitle(st) }))
        .filter((o) => !filter || o.label.toLowerCase().includes(filter))
    },
  },
  methods: {
    formatDate(d) {
      if (!d) return ''
      return dateFormat(d, 'yyyy-mm-dd')
    },
    questTitle(short_title) {
      const q = this.mainStore.QUESTMAN.get(short_title)
      return q && q.title ? q.title : short_title
    },
    statusColor(status) {
      return { empty: 'grey-6', draft: 'orange', completed: 'positive' }[status] || 'grey-6'
    },
    slotIcon(status) {
      return { empty: 'edit', draft: 'play_arrow', completed: 'visibility' }[status] || 'edit'
    },
    slotAction(status) {
      return {
        empty: this.$t('visit.fill'),
        draft: this.$t('visit.resume'),
        completed: this.$t('visit.edit'),
      }[status]
    },
    filterQuests(val, update) {
      update(() => {
        this.questFilter = val ? val.toLowerCase() : null
      })
    },
    fillSlot(slot) {
      this.$router.push({
        name: 'visit_quest',
        params: { id: this.visitId, short: slot.short_title },
      })
    },
    addQuestionnaire() {
      if (!this.selectedQuest) return
      this.mainStore.VISIT_MAN.add_questionnaire(this.visitId, this.selectedQuest)
      this.selectedQuest = null
    },
    removeSlot(slot) {
      this.mainStore.VISIT_MAN.remove_questionnaire(this.visitId, slot.short_title)
    },
    exportVisit() {
      const ok = this.mainStore.exportVisit(this.visitId)
      this.$q.notify({
        message: ok ? this.$t('visit.export_ok') : this.$t('visit.export_empty'),
        color: ok ? 'green' : 'warning',
      })
    },
  },
}
</script>
