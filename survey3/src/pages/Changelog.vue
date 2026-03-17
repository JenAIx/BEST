<template>
  <q-page data-cy="page_about" class="page-size">

    <div class="column items-center q-px-xl">
      <div class="col">
        <p v-html="missionTxt" class=" standard_text"></p>
      </div>
      <div class="col">
        <q-img src="assets/favicon.svg" style="height: 300px; width: 300px; " />
      </div>
      <div class="col q-mt-md">
        <q-btn 
          color="primary" 
          label="🚀 Space Invaders spielen" 
          @click="$router.push('/spaceinvaders')"
          size="lg"
        />
      </div>
    </div>

    <!-- BACKBUTTON -->
    <BACKBUTTON />
  </q-page>
</template>

<script>
import { useMainStore } from 'src/stores/main'
import showdown from "showdown"
import MD_TEXT from '../../CHANGELOG.md?raw'
import BACKBUTTON from 'src/components/BackButton.vue'

export default {
  name: 'About',
  setup() {
    return { mainStore: useMainStore() }
  },
  components: {
    BACKBUTTON
  },
  data() {
    return {}
  },
  mounted() {
    this.mainStore.setProtectedMode(true);
  },
  computed: {
    missionTxt() {
      var converter = new showdown.Converter(),
        html = converter.makeHtml(MD_TEXT);
      return html
    },
  },
}

</script>
