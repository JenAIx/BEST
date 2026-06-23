<template>
  <q-page data-cy="questman" :style="pageSize">
    <div class="column items-center" style="height: 100%">
      <div class="col-1 q-pt-md text-h6">
        {{ $t('settings.questman.label') }}
      </div>

      <div class="col q-py-md text-center" style="width: 350px">
        <!-- AUSWAHL FRAGEBÖGEN -->
        <div class="text-caption text-grey">
          {{ $t('settings.questman.import.description') }}
        </div>
        <q-input v-model="content" filled type="textarea" />
      </div>

      <!-- ACTIONBTTNS -->
      <div
        class="col-2 text-center q-gutter-md justify-around"
        style="width: 100%"
      >
        <MYBUTTON
          v-if="content !== null && content.length > 0"
          @click="importQuest"
          :label="$t('btn.import')"
        />
      </div>
      <!-- END COLUMN -->
    </div>

    <!-- BACKBUTTON -->
    <BACKBUTTON :go_back="true" />
  </q-page>
</template>

<script>
import { useMainStore } from 'src/stores/main'
import myMixins from "src/mixins/modes";
import BACKBUTTON from "src/components/BackButton.vue";
import MYBUTTON from "src/components/MyButton.vue";

export default {
  name: "QuestManagerImport",
  setup() {
    return { mainStore: useMainStore() }
  },
  components: { BACKBUTTON, MYBUTTON },
  props: ["MODE"],
  mixins: [myMixins],
  data() {
    return {
      content: null,
    };
  },
  computed: {
    QUESTMAN() {
      return this.mainStore.QUESTMAN;
    },
  },

  methods: {
    importQuest() {
      const res = this.QUESTMAN.add(this.content);
      if (res.ok) {
        this.$q.notify({
          message: `${this.$t('quest.import_success')}`,
          color: "green",
        });
        this.content = null;
      } else {
        this.$q.notify({
          message: `${this.$t('quest.import_failed')}: ${res.errors.join('; ')}`,
          color: "negative",
          multiLine: true,
          timeout: 8000,
        });
      }
    },
  },
};
</script>
