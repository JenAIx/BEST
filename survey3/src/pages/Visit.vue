<template>
  <q-page class="page-size" data-cy="page_visit">
    <div class="column items-center" style="height: 100%">
      <!-- HEADING -->
      <div v-if="visit" class="col-auto q-pt-md text-center">
        <div class="row items-center justify-center q-gutter-xs">
          <div class="text-h6">{{ visit.label }}</div>
          <q-btn flat round dense size="sm" icon="edit" color="grey-7" data-cy="btn_edit_visit" @click="openEdit" />
        </div>
        <div class="text-caption text-grey-7">{{ patientPid }} · {{ formatDay(visit.date) }}</div>
        <div v-if="visit.note" class="text-caption text-grey-8 q-mt-xs">{{ visit.note }}</div>
      </div>
      <div v-else class="col q-pa-lg text-center text-grey-7">—</div>

      <!-- ADD QUESTIONNAIRE -->
      <div v-if="visit" class="col-auto q-pa-md row items-center q-gutter-sm" style="width: 100%; max-width: 640px">
        <q-select class="col" filled dense v-model="selectedQuest" :options="questOptions" emit-value map-options
          use-input input-debounce="0" @filter="filterQuests" :label="$t('visit.add_questionnaire')"
          data-cy="select_questionnaire" />
        <q-btn color="primary" icon="add" :disable="!selectedQuest" data-cy="btn_add_questionnaire"
          @click="addQuestionnaire" />
      </div>

      <!-- SLOT LIST -->
      <div v-if="visit" class="col q-pb-md" style="position: relative; width: 100%; max-width: 640px">
        <q-scroll-area class="shadow-1 my-form-wide">
          <q-list separator>
            <q-item v-for="slot in visit.items" :key="slot.short_title" data-cy="slot_item">
              <q-item-section>
                <q-item-label>{{ questTitle(slot.short_title) }}</q-item-label>
                <q-item-label caption class="row items-center q-gutter-xs">
                  <q-badge :color="statusMeta(slot.status).color" :label="$t(statusMeta(slot.status).labelKey)" />
                  <span class="text-grey-7">{{ slotPercent(slot) }} %</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-btn flat dense no-caps color="primary" :icon="statusMeta(slot.status).icon"
                    :label="$t(statusMeta(slot.status).actionKey)" data-cy="btn_fill_slot" @click="fillSlot(slot)" />
                  <q-btn flat round dense icon="delete" color="grey-7" @click="removeSlot(slot)" />
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </div>

      <!-- EXPORT -->
      <div v-if="visit" class="col-auto q-pb-md">
        <q-btn color="secondary" icon="file_download" :label="$t('visit.export_visit')" data-cy="btn_export_visit"
          @click="exportVisit" />
      </div>
    </div>

    <!-- EDIT DIALOG -->
    <q-dialog v-model="showEdit">
      <q-card style="min-width: 320px">
        <q-card-section class="text-h6">{{ $t('visit.edit_visit') }}</q-card-section>
        <q-card-section class="q-gutter-md">
          <q-input filled dense v-model="editForm.label" :label="$t('visit.visit_name')" data-cy="edit_label" />
          <q-input filled dense v-model="editForm.date" :label="$t('visit.visit_date')" mask="####-##-##"
            data-cy="edit_date">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="editForm.date" mask="YYYY-MM-DD">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup :label="$t('btn.close.label')" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-input filled type="textarea" autogrow v-model="editForm.note" :label="$t('visit.visit_note')"
            data-cy="edit_note" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('btn.close.label')" v-close-popup />
          <q-btn color="primary" :label="$t('btn.save.label')" data-cy="btn_save_visit" @click="saveEdit" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <BACKBUTTON :go_back="true" />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import { useMainStore } from 'src/stores/main'
import questPicker from 'src/mixins/questPicker'
import { formatDay } from 'src/tools/dateUtils'
import { statusMeta } from 'src/tools/visits/visit-ui'
import { requiredFieldStats } from 'src/tools/visits/visit-model'

export default {
  name: 'VisitPage',
  components: { BACKBUTTON },
  mixins: [questPicker],
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return {
      selectedQuest: null,
      showEdit: false,
      editForm: { label: '', date: '', note: '' },
    }
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
    formatDay,
    statusMeta,
    // Pflichtfeld-Fortschritt eines Slots in Prozent (abgeschlossen = 100)
    slotPercent(slot) {
      if (slot.status === 'completed') return 100
      const quest = this.mainStore.QUESTMAN.get(slot.short_title)
      if (!quest) return 0
      return requiredFieldStats(quest.items, slot.draft ? slot.draft.values : undefined).percent
    },
    fillSlot(slot) {
      this.$router.push({ name: 'visit_quest', params: { id: this.visitId, short: slot.short_title } })
    },
    addQuestionnaire() {
      if (!this.selectedQuest) return
      this.mainStore.VISIT_MAN.add_questionnaire(this.visitId, this.selectedQuest)
      this.selectedQuest = null
    },
    removeSlot(slot) {
      if (!window.confirm(this.$t('visit.delete_questionnaire_confirm'))) return
      this.mainStore.VISIT_MAN.remove_questionnaire(this.visitId, slot.short_title)
    },
    openEdit() {
      this.editForm = {
        label: this.visit.label,
        date: formatDay(this.visit.date),
        note: this.visit.note || '',
      }
      this.showEdit = true
    },
    saveEdit() {
      this.mainStore.VISIT_MAN.update_visit(this.visitId, {
        label: this.editForm.label,
        date: this.editForm.date,
        note: this.editForm.note,
      })
      this.showEdit = false
    },
    exportVisit() {
      const items = this.visit ? this.visit.items : []
      const completed = items.filter((i) => i.status === 'completed').length
      const incomplete = items.length - completed
      if (completed === 0) {
        this.$q.notify({ message: this.$t('visit.export_empty'), color: 'warning' })
        return
      }
      if (incomplete > 0 &&
        !window.confirm(this.$t('visit.export_incomplete_confirm', { count: incomplete, total: items.length }))) return
      const ok = this.mainStore.exportVisit(this.visitId)
      this.$q.notify({
        message: ok ? this.$t('visit.export_ok') : this.$t('visit.export_empty'),
        color: ok ? 'green' : 'warning',
      })
    },
  },
}
</script>
