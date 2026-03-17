<template>
  <q-page data-cy="page_quest" class="page-size">
    <div class="column items-center">
      <!-- NO PARAMS -->
      <div v-if="noPARAMStxt !== undefined">
         <q-banner inline-actions class="text-white bg-red">
            {{this.noPARAMStxt}}
            <template v-slot:action>
            <q-btn flat color="white" :label="$t('btn.back.label')" @click="$router.push('/')" />
            </template>
        </q-banner>
      </div>
      <!-- TITEL -->
      <!-- FORM -->
      <div v-if="status && QUEST_LABEL !== null && QUEST_LABEL !== undefined">
        <RenderQuest  @emitForm="questAction" @emitBack="gotoselect" :key="timenow" />
      </div>

      <!-- RETURN BUTTON -->
      <div v-else class="col text-center">
        <div>
          {{$t('quest.not_found')}}: {{PARAMS}}
        </div>
      </div>
    </div>

    <!-- BACKBUTTON -->
    <BACKBUTTON :ask="true" :hidden="true" />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import RenderQuest from 'src/components/RenderQuest.vue'
import { parseRouteParams } from 'src/tools/routeParams'
import { useMainStore } from 'src/stores/main'
export default {
  name: 'Questionnaire',
  components: {BACKBUTTON, RenderQuest},
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return {
      noPARAMStxt: undefined,
      timenow: Date.now(),
      status: true
    }
  },
  mounted() {
    this.mainStore.leftDrawerOpen = false
    this.mainStore.PROTECTED_MODE = true
    this.mainStore.exportClear()
    this.loadQuest()
  },

  watch: {
    $route(){
      // this.loadQuest()
    }
  },

  methods: {
    loadQuest() {
      this.QUESTMAN.clear_preset()
      if (this.PARAMS === undefined || this.PARAMS.presets === undefined) return (this.noPARAMStxt = 'keine Parameter gesetzt!')
      this.QUESTMAN.presets = this.PARAMS.presets

      const status = this.QUESTMAN.next()
      if (!status) return
    },

    gotoselect() {
      this.$router.push('/select')
    },

    // HIER KOMMEN DIE DATEN AUS DER FORM
    questAction(val) {
      if (val !== undefined) {
        this.timenow = Date.now() // rerender renderquest
        this.mainStore.storage_add(val)
        this.$q.notify({
          message: this.$t('quest.export_success'),
          color: 'green'
        })
        // encrypted mode?
        if (this.PARAMS.mode === 'encrypted') this.export_encrypted()
        // next quest
        this.status = this.QUESTMAN.next()

        if (this.status !== true) this.$router.push({path: '/finished_quest'}).catch(err => this.$router.push('/finished_quest'))


      } else {
        this.$q.notify({
          message: this.$t('quest.export_failed'),
          color: 'warning'
        })
      }
    },

    // EXPORT A QUEST IN ENCRYPTION MODE
    export_encrypted() {
      this.mainStore.storage_encrypted_export(this.PARAMS)
    }
  },

  computed: {
    PARAMS() {
      return parseRouteParams(this.$route.params.id)
    },
    QUEST_LABEL() {
      return this.mainStore.ACTIVE_QUEST_LABEL
    },
    QUESTMAN() {
      return this.mainStore.QUESTMAN
    }
  }
}
</script>
