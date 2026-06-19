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
          default: {
            // manche Browser liefern keinen MIME-Typ -> per Dateiendung entscheiden
            const name = (this.file.name || "").toLowerCase();
            if (name.endsWith(".json")) this.readjson(e);
            else if (name.endsWith(".html")) this.readhtml(e);
            else this.show_error("Dateityp nicht unterstützt");
          }
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
      let json;
      try {
        json = JSON.parse(e.target.result);
      } catch (err) {
        return this.show_error("ungültiges JSON");
      }

      // unverschlüsseltes Dokument
      if (json && json.cda !== undefined) return this.importDocument(json);

      // einzelnes verschlüsseltes Dokument
      if (json && json.encrypted_data !== undefined) {
        const doc = this.decryptDoc(json);
        if (!doc) return this.show_error("Entschlüsselung fehlgeschlagen");
        return this.importDocument(doc);
      }

      // Array verschlüsselter Dokumente (neu: 202204)
      if (Array.isArray(json)) {
        const docs = json
          .filter((j) => j && j.encrypted_data !== undefined && j.encrypted_key !== undefined)
          .map((j) => this.decryptDoc(j))
          .filter((d) => this.isImportable(d));
        if (!docs.length) return this.show_error("keine gültigen Daten gefunden");
        return this.importBatch(docs);
      }

      return this.show_error("kein gültiges Dokument");
    },

    // Entschlüsselt + parst ein verschlüsseltes Dokument; null bei jedem Fehler.
    decryptDoc(j) {
      let text;
      try {
        text = decrypt(
          { encrypted_data: j.encrypted_data, encrypted_key: j.encrypted_key },
          this.keyPair.privateKey
        );
      } catch (err) {
        return null;
      }
      if (!text || text === "could not decrypt key") return null;
      try {
        return JSON.parse(text);
      } catch (err) {
        return null;
      }
    },

    // Minimal-Schemaprüfung eines CDA-Dokuments vor dem Import.
    isImportable(doc) {
      return !!(doc && doc.cda && doc.hash !== undefined && doc.info);
    },

    importDocument(document) {
      if (!this.isImportable(document)) return this.show_error("kein gültiges Dokument");
      this.mainStore
        .storage_add_from_file(document)
        .then(() => {
          this.$q.notify({ message: this.$t("quest.import_success"), color: "green" });
          this.$router.go(-1);
        })
        .catch(() => this.show_error(this.$t("quest.import_failed")));
    },

    // Mehrere Dokumente importieren, am Ende einmal Feedback + Navigation.
    importBatch(docs) {
      Promise.allSettled(docs.map((d) => this.mainStore.storage_add_from_file(d))).then((results) => {
        const ok = results.filter((r) => r.status === "fulfilled").length;
        if (ok === 0) return this.show_error(this.$t("quest.import_failed"));
        this.$q.notify({ message: `${this.$t("quest.import_success")} (${ok})`, color: "green" });
        this.$router.go(-1);
      });
    },
  },
};
</script>
