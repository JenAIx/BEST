<template>
  <!-- QUEST MODE: hidden behind 3-dot menu -->
  <div v-if="hidden" class="absolute-top-right q-mr-sm" :class="margintop">
    <q-btn color="grey-7" round flat icon="more_vert" data-cy="btn_options">
      <q-menu cover auto-close>
        <q-list>
          <q-item class="my-btn text-center" data-cy="back_root" clickable @click="quitForm">
            <q-item-section>{{$t('btn.back.label')}}</q-item-section>
          </q-item>
          <template v-if="showPdfExport">
            <q-separator />
            <q-item class="my-btn text-center" clickable @click="$emit('pdfExport')">
              <q-item-section>
                <div class="row items-center justify-center no-wrap" style="gap:8px">
                  <q-icon name="picture_as_pdf" size="xs" />
                  <span>PDF Export</span>
                </div>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </q-menu>
    </q-btn>
  </div>

  <!-- DEFAULT: visible back button -->
  <div v-else class="absolute-top-left q-ml-sm" :class="margintop">
    <q-btn
      flat
      round
      dense
      icon="arrow_back"
      color="grey-8"
      data-cy="back_root"
      @click="quitForm"
    >
      <q-tooltip>{{$t('btn.back.label')}}</q-tooltip>
    </q-btn>
  </div>
</template>


<script>
import { useMainStore } from 'src/stores/main'

export default {
  name: 'BACKBUTTON',
  props: ["ask", "go_back", "go_location", "hidden", "showPdfExport"],
  emits: ['pdfExport'],
  setup() {
    return { mainStore: useMainStore() }
  },

  data() {
    return {}
  },

  computed: {
    margintop() {
      if (this.$q.platform.is.iphone) return 'q-mt-xl'
      if (this.$q.platform.is.cordova) return 'q-mt-lg'
      return 'q-mt-md'
    }
  },

  methods: {

    quitForm() {
      if (this.go_location !== undefined) this.$router.push(this.go_location)
      if (this.go_back === true) return this.$router.go(-1)

      // else
      if (this.ask === true) {
        var answer = window.confirm("Wirklich abbrechen?");
        if (!answer) return
      }

      this.mainStore.PROTECTED_MODE = false;
      this.$router.push('/')
    }


  }
}
</script>
