<template>
  <q-page data-cy="page_settigns" class="page-size">
    <div class="column items-center" style="height: 100%">
      <!-- TITLE -->
      <div class="col-1 q-py-md text-h6">
        {{ $t('storage.settings') }}
      </div>

      <div class="col">
        <q-scroll-area class="my-form">
          <div class="row q-pa-md justify-around q-gutter-sm">
            <!-- FONT -->
            <q-expansion-item data-cy="btn_description" expand-separator :icon="$t('settings.font.icon')"
              :label="$t('settings.font.label')" :caption="`Größe: ${$store.getters.SETTINGS.size}`"
              class="my-settings-item">
              <div class="row text-center">
                <div class="col">
                  <q-btn-toggle v-model="$store.getters.SETTINGS.size" flat :options="[
                    { label: 'normal', value: 'normal' },
                    { label: 'größer', value: 'bigger' },
                    { label: 'sehr groß', value: 'biggest' },
                  ]" />
                </div>
              </div>
              <div class="q-ma-sm text-center">
                "{{ $t('settings.font.sample') }}"
              </div>
            </q-expansion-item>

            <!-- EXPORT -->
            <q-expansion-item data-cy="btn_description" expand-separator :icon="$t('settings.export.icon')"
              :label="$t('settings.export.label')" :caption="`Format: ${export_format}`" class="my-settings-item">
              <div class="row text-center">
                <div class="col-12">
                  <q-btn-toggle flat v-model="export_format" toggle-color="primary"
                    :options="exportOptions" />
                </div>
                <div class="col-12 text-caption">
                  <span v-if="export_format === 'html'">{{
                    $t('settings.export.description.html')
                  }}</span>
                  <span v-else-if="export_format === 'json'">{{
                    $t('settings.export.description.json')
                  }}</span>
                  <span v-else-if="export_format === 'CDA'">{{
                    $t('settings.export.description.cda')
                  }}</span>
                </div>
              </div>
            </q-expansion-item>

            <!-- USER SETTINGS -->
            <q-expansion-item data-cy="btn_description" expand-separator :icon="$t('settings.user.icon')"
              :label="$t('settings.user.label')" :caption="`eMail: ${$store.getters.SETTINGS.email_export || ''} `"
              class="my-settings-item">
              <!-- MAIL -->
              <div class="row q-pa-xs">
                <q-input class="col-12" dense v-model="$store.getters.SETTINGS.email_export" input-class="text-center"
                  label="eMail" />
                <!-- CHECK THE EMAIL CLIENT -->
                <div class="">

                  <q-icon v-if="!email_server_available || email_server_available.error" name="warning" color="red"><q-tooltip>der Email-Server ist NICHT
                      erreichbar: {{ email_server_available }}</q-tooltip></q-icon>
                  <q-icon v-else name="check"><q-tooltip>der Email-Server ist erreichbar</q-tooltip></q-icon>

                </div>

                <div class="col-12 text-center q-my-md">
                  <q-toggle v-model="user_details" class="text-caption" color="green" data-cy="show_user_details"
                    :label="$t('btn.more_details')" />
                </div>
              </div>
              <!-- MORE DETAILS` -->
              <div v-if="user_details" class="row q-ma-xs shadow-1 q-pa-sm">
                <div class="text-caption my-annotation-text" v-html="$t('settings.user.uid_description')"></div>
                <q-input class="col-12" dense disable borderless v-model="$store.getters.SETTINGS.user_uid"
                  input-class="text-center" label="uid" />
                <q-input class="col-12" dense readonly borderless v-model="keyPair.privateKey"
                  :type="isPwd_priv ? 'true' : 'password'" label="privateKey" input-class="text-center"
                  data-cy="notion_input_token">
                  <template v-slot:append>
                    <q-icon :name="isPwd_priv ? 'visibility_off' : 'visibility'" class="cursor-pointer"
                      @click="isPwd_priv = !isPwd_priv" />
                  </template>
                </q-input>
                <q-input class="col-12" dense readonly borderless v-model="keyPair.publicKey"
                  :type="isPwd_pub ? 'true' : 'password'" label="publicKey" input-class="text-center"
                  data-cy="notion_input_token">
                  <template v-slot:append>
                    <q-icon :name="isPwd_pub ? 'visibility_off' : 'visibility'" class="cursor-pointer"
                      @click="isPwd_pub = !isPwd_pub" />
                  </template>
                </q-input>
              </div>

              <!-- IMPORT&EXPORT -->
              <div v-if="user_details" class="row justify-right text-grey-8 q-mt-md">
                <q-btn no-caps icon="file_upload" flat size="xs" class="col" @click="view_import = true">{{
                  $t('btn.user.label_import') }}</q-btn>
                <q-btn no-caps icon="refresh" flat size="xs" class="col" @click="user_new()">{{ $t('btn.user.label_new')
                }}</q-btn>
                <q-btn no-caps icon="file_download" flat size="xs" class="col" @click="view_export = true">{{
                  $t('btn.user.label_export') }}</q-btn>
              </div>
            </q-expansion-item>

            <!-- SEPARATOR -->
            <q-separator class="my-settings-separator" />

            <!-- QUESTMANAGER -->
            <q-item clickable v-ripple class="my-settings-item" @click="$router.push({ name: 'questman' })">
              <q-item-section avatar>
                <q-icon :name="$t('settings.questman.icon')" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t('settings.questman.label') }}</q-item-label>
                <q-item-label caption>{{
                  $t('settings.questman.description')
                }}</q-item-label>
              </q-item-section>
            </q-item>

            <!-- SEPARATOR -->
            <q-separator class="my-settings-separator" />

            <!-- ENCRYPT -->
            <q-item clickable v-ripple class="my-settings-item" @click="$router.push({ name: 'encrypt' })">
              <q-item-section avatar>
                <q-icon :name="$t('settings.encryption.icon')" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{
                  $t('settings.encryption.label')
                }}</q-item-label>
                <q-item-label caption>{{
                  $t('settings.encryption.description')
                }}</q-item-label>
              </q-item-section>
            </q-item>

            <!-- ENDEROW -->
          </div>
        </q-scroll-area>
      </div>

      <!-- ENDE COLUMN -->
    </div>

    <!-- BACKBUTTON -->
    <BACKBUTTON />

    <!-- USEREXPORT -->
    <USEREXPORT v-if="view_export === true" :DATA="$store.getters.SETTINGS._USER" :view_export="view_export"
      @closeClick="view_export = false" />

    <!-- USERIMPORT -->
    <USERIMPORT v-if="view_import === true" :view_import="view_import" @closeClick="view_import = false"
      @clickImportData="doImportData($event)" />
  </q-page>
</template>

<script>
import myMixins from "src/mixins/modes";
import BACKBUTTON from "src/components/BackButton.vue";
import USEREXPORT from "src/components/User_export.vue";
import USERIMPORT from "src/components/User_import.vue";
import { checkMail } from "src/tools/mail";

export default {
  name: "Settings",
  components: { BACKBUTTON, USEREXPORT, USERIMPORT },
  mixins: [myMixins],
  data() {
    return {
      isPwd_priv: false,
      isPwd_pub: false,
      user_details: false,
      view_export: false,
      view_import: false,
      val: "normal",
      email_server_available: false,
    };
  },
  mounted() {
    this.$store.dispatch("setProtectedMode", true);

    // CHECK IF MAIL SERVER IS AVAILABLE
    checkMail(this.$store.getters.SETTINGS.email_export).then((res) => {
      this.email_server_available = res;
    });
  },
  computed: {
    exportOptions() {
      return [
        { label: this.$t('settings.export.options.html'), value: 'html' },
        { label: this.$t('settings.export.options.json'), value: 'json' },
        { label: this.$t('settings.export.options.CDA'), value: 'CDA' },
      ]
    },
    keyPair() {
      if (this.$store.getters.SETTINGS.user_keyPair === undefined)
        this.$store.getters.SETTINGS._USER.create();
      return this.$store.getters.SETTINGS.user_keyPair;
    },

    export_format: {
      get() {
        return this.$store.getters.SETTINGS.export_format;
      },
      set(val) {
        this.$store.commit("SETTINGS_SET", {
          field: "export_format",
          value: val,
        });
      },
    },
  },
  methods: {
    user_new() {
      const answ = confirm(this.$t('btn.confirm.new_user'));
      if (!answ) return;
      this.$store.getters.SETTINGS._USER.create();
    },
    doImportData(data) {
      this.view_import = false;
      if (data === null || data === undefined) return;

      try {
        const json = JSON.parse(data);
        if (json === undefined || json === null) return;
        this.$store.getters.SETTINGS._USER.import(data);
      } catch {
        this.$q.notify({
          message: this.$t('error.format_wrong'),
          color: "warning",
        });
      }
    },
  },
};
</script>

<style></style>
