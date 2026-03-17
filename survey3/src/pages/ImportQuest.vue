<template>
  <q-page data-cy="page_settigns" class="page-size">
    <div class="column items-center" style="height: 100%">
      <!-- TITLE -->
      <div class="col-1 q-pt-md text-h6">
        {{ $t('storage.import.label') }}
      </div>

      <!-- PICK A FILE -->
      <div class="col q-my-md" style="width: 300px">
        <q-file
          v-model="file"
          accept=".json, .html"
          :label="$t('storage.import.fileselect')"
          filled
          style="max-width: 300px"
        />
      </div>

      <div class="col text-center" v-if="file !== null">
        <q-btn class="my-btn" @click="loadFile()" :label="$t('btn.import')" />

        <div class="q-mt-md my-annotation-text">
          {{ $t('storage.import.info') }}
        </div>
      </div>
    </div>

    <!-- BACKBUTTON -->
    <BACKBUTTON :go_back="true" />
  </q-page>
</template>

<script>
import { useMainStore } from 'src/stores/main'
import { decrypt } from "src/tools/hhash";
import { log } from "src/tools/Logger";
import BACKBUTTON from "src/components/BackButton.vue";

export default {
  components: { BACKBUTTON },
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return {
      file: null,
    };
  },
  computed: {
    keyPair() {
      if (this.mainStore.SETTINGS.user_keyPair === undefined)
        this.mainStore.SETTINGS._USER.create();
      return this.mainStore.SETTINGS.user_keyPair;
    },
  },
  methods: {
    loadFile() {
      const reader = new FileReader();
      reader.onload = (e) => {
        switch (this.file.type) {
          case "application/json":
            this.readjson(e);
            break;
          case "text/html":
            this.readhtml(e);
            break;
          default:
            log({ error: "type not found" });
        }
      };
      reader.readAsText(this.file);
    },
    readhtml(e) {
      let txt = e.target.result;
      const ss = "script";
      const onset = txt.indexOf(`<${ss}>`);
      const offset = txt.indexOf(`</${ss}>`);

      var document = undefined;
      try {
        if (onset < 0 || offset < 0) throw "ungültiges Format!";
        var TEXT = txt.substring(onset + `<${ss}>`.length, offset);
        TEXT = TEXT.substring(TEXT.indexOf("{"), TEXT.length);
        document = JSON.parse(TEXT);
      } catch (err) {
        return this.show_error(err);
      }
      if (document === undefined)
        return this.show_error("keine gültigen Daten gefunden");
      this.importDocument(document);
    },

    show_error(err) {
      this.$q.notify({
        message: `${this.$t('quest.import_failed')}: ${err}`,
        color: "warning",
      });
    },

    readjson(e) {
      let txt = e.target.result;
      let json = JSON.parse(txt);
      // unverschlüsseltes Dokument, dann ist ja alles gut
      if (json.cda !== undefined) return this.importDocument(json);
      // json als encrypted dokument
      else if (json.encrypted_data !== undefined) {
        let decrypted_text = decrypt(
          {
            encrypted_data: json.encrypted_data,
            encrypted_key: json.encrypted_key,
          },
          this.keyPair.privateKey
        );
        if (
          decrypted_text === null ||
          decrypted_text === undefined ||
          decrypted_text === "could not decrypt key"
        )
          return this.show_error(decrypted_text);

        // else
        this.importDocument(JSON.parse(decrypted_text));
        return true;
      }

      // eventuell ein ARRAY mit encrypted data? neu: 202204
      else if (Array.isArray(json)) {
        let status = false;
        json.forEach((j) => {
          if (j.encrypted_data !== undefined && j.encrypted_key !== undefined) {
            status = true;
            let decrypted_text = decrypt(
              {
                encrypted_data: j.encrypted_data,
                encrypted_key: j.encrypted_key,
              },
              this.keyPair.privateKey
            );
            if (decrypted_text) this.importDocument(JSON.parse(decrypted_text));
            else status = false;
          }
        });
        if (status === false) this.show_error("invalid file");
        else return true;
      }

      //ELSE ERROR
    },

    importDocument(document) {
      this.mainStore.storage_add_from_file(document).then((res) => {
        this.$q.notify({
          message: this.$t('quest.import_success'),
          color: "green",
        });
        this.$router.go(-1);
      });
    },
  },
};
</script>
