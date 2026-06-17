<template>
  <q-page class="page-size" data-cy="page_visit_templates">
    <div class="column items-center" style="height: 100%">
      <div class="col-auto q-pt-md text-h6">{{ $t('visit.templates_title') }}</div>

      <!-- EDITOR -->
      <div class="col-auto q-pa-md" style="width: 100%; max-width: 640px">
        <q-card flat bordered>
          <q-card-section class="q-gutter-sm">
            <q-input
              filled
              dense
              v-model="form.label"
              :label="$t('visit.template_label')"
              data-cy="template_label"
            />
            <q-select
              filled
              dense
              multiple
              use-chips
              v-model="form.questionnaires"
              :options="questOptions"
              emit-value
              map-options
              use-input
              input-debounce="0"
              @filter="filterQuests"
              :label="$t('visit.template_questionnaires')"
              data-cy="template_questionnaires"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-if="editId" flat :label="$t('btn.close.label')" @click="resetForm" />
            <q-btn
              color="primary"
              icon="save"
              :label="editId ? $t('btn.save.label') : $t('visit.new_template')"
              :disable="!form.label || form.questionnaires.length === 0"
              data-cy="btn_save_template"
              @click="saveTemplate"
            />
          </q-card-actions>
        </q-card>
      </div>

      <!-- LIST -->
      <div class="col q-pb-md" style="position: relative; width: 100%; max-width: 640px">
        <q-scroll-area class="shadow-1 my-form">
          <div v-if="mainStore.VISIT_TEMPLATES.length === 0" class="q-pa-lg text-center text-grey-7">
            {{ $t('visit.no_templates') }}
          </div>
          <q-list separator>
            <q-item v-for="t in mainStore.VISIT_TEMPLATES" :key="t.id" data-cy="template_item">
              <q-item-section>
                <q-item-label>{{ t.label }}</q-item-label>
                <q-item-label caption>
                  {{ t.questionnaires.map(questTitle).join(', ') }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row q-gutter-xs">
                  <q-btn flat round dense icon="edit" color="grey-7" @click="editTemplate(t)" />
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="grey-7"
                    data-cy="btn_delete_template"
                    @click="deleteTemplate(t)"
                  />
                </div>
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
  name: 'VisitTemplatesPage',
  components: { BACKBUTTON },
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return {
      editId: null,
      form: { label: '', questionnaires: [] },
      questFilter: null,
    }
  },
  mounted() {
    this.mainStore.setProtectedMode(false)
  },
  computed: {
    questOptions() {
      const filter = this.questFilter
      return this.mainStore.QUEST_LIST.map((st) => ({ value: st, label: this.questTitle(st) })).filter(
        (o) => !filter || o.label.toLowerCase().includes(filter)
      )
    },
  },
  methods: {
    questTitle(short_title) {
      const q = this.mainStore.QUESTMAN.get(short_title)
      return q && q.title ? q.title : short_title
    },
    filterQuests(val, update) {
      update(() => {
        this.questFilter = val ? val.toLowerCase() : null
      })
    },
    resetForm() {
      this.editId = null
      this.form = { label: '', questionnaires: [] }
    },
    saveTemplate() {
      if (!this.form.label || this.form.questionnaires.length === 0) return
      if (this.editId) {
        this.mainStore.VISIT_MAN.update_template(this.editId, {
          label: this.form.label,
          questionnaires: [...this.form.questionnaires],
        })
      } else {
        this.mainStore.VISIT_MAN.add_template(this.form.label, this.form.questionnaires)
      }
      this.resetForm()
    },
    editTemplate(t) {
      this.editId = t.id
      this.form = { label: t.label, questionnaires: [...t.questionnaires] }
    },
    deleteTemplate(t) {
      if (!window.confirm(this.$t('visit.delete_template_confirm'))) return
      if (this.editId === t.id) this.resetForm()
      this.mainStore.VISIT_MAN.remove_template(t.id)
    },
  },
}
</script>
