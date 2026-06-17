<template>
  <q-page class="page-size" data-cy="page_visit_quest">
    <div class="column items-center">
      <div v-if="notFound" class="q-pa-lg">
        <q-banner class="text-white bg-red">
          {{ $t('quest.not_found') }}
          <template v-slot:action>
            <q-btn flat color="white" :label="$t('btn.back.label')" @click="goBack" />
          </template>
        </q-banner>
      </div>

      <div v-else-if="ready" style="width: 100%">
        <RenderQuest ref="rq" embedded :key="renderKey" />

        <!-- ACTIONS -->
        <div class="row justify-center q-gutter-md q-py-xl">
          <q-btn
            rounded
            outline
            color="primary"
            icon="save"
            :label="$t('visit.save_draft')"
            data-cy="btn_save_draft"
            @click="saveDraft"
          />
          <q-btn
            rounded
            color="primary"
            icon="check"
            :label="$t('visit.finish')"
            data-cy="btn_finish"
            @click="finish"
          />
        </div>
      </div>
    </div>
    <BACKBUTTON :ask="true" :hidden="true" />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import RenderQuest from 'src/components/RenderQuest.vue'
import { useMainStore } from 'src/stores/main'

export default {
  name: 'VisitQuestPage',
  components: { BACKBUTTON, RenderQuest },
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return { ready: false, notFound: false, renderKey: 0 }
  },
  computed: {
    visitId() {
      return this.$route.params.id
    },
    short() {
      return this.$route.params.short
    },
  },
  mounted() {
    this.mainStore.leftDrawerOpen = false
    this.setup()
  },
  methods: {
    setup() {
      const qm = this.mainStore.QUESTMAN
      const slot = this.mainStore.VISIT_MAN.get_slot(this.visitId, this.short)
      if (!slot) {
        this.notFound = true
        return
      }
      // aktiven Quest laden
      qm.activeQuest = this.short
      if (qm.activeQuest === undefined) {
        this.notFound = true
        return
      }
      // Entwurf / abgeschlossene Werte wiederherstellen (zum Fortsetzen / Bearbeiten)
      if (slot.draft && Array.isArray(slot.draft.values)) {
        qm.restore_active_values(slot.draft.values)
      }
      this.ready = true
      this.renderKey++
    },
    currentValues() {
      const q = this.mainStore.ACTIVE_QUEST
      if (!q || !Array.isArray(q.items)) return []
      return q.items.map((i) => i.value)
    },
    saveDraft() {
      const values = this.currentValues()
      this.mainStore.VISIT_MAN.save_draft(this.visitId, this.short, values)
      this.$q.notify({ message: this.$t('visit.draft_saved'), color: 'green' })
      this.goBack()
    },
    finish() {
      // Logikprüfung (gleiche Prüfung wie im Single-Quest-Flow)
      const check = this.$refs.rq.runCheck()
      if (check !== true) {
        this.$q.notify({ message: this.$t('quest.check_failed'), color: 'warning' })
        return
      }
      const values = this.currentValues()
      const summary = this.mainStore.QUESTMAN.summary
      this.mainStore.VISIT_MAN.complete_questionnaire(this.visitId, this.short, summary, values)
      this.$q.notify({ message: this.$t('visit.completed_ok'), color: 'green' })
      this.goBack()
    },
    goBack() {
      this.$router.push({ name: 'visit', params: { id: this.visitId } })
    },
  },
}
</script>
