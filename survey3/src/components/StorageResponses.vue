<template>
  <!-- Liste der gespeicherten Einzel-Fragebögen (Body der Storage-Seite) -->
  <div class="column items-center full-height" style="width: 100%">
    <div class="col-auto row justify-center" style="max-height: 50px; width: 100%">
      <FILTERSTORAGE @filterSet="filterDO('set')" @filterCleared="filterDO('cleared')" />
    </div>

    <!-- CONTENT -->
    <div class="col q-py-md column items-center" style="position: relative; width: 100%">
      <q-scroll-area class="shadow-1 my-form">
        <div class="row q-pa-md justify-around q-gutter-md" data-cy="items">
          <StorageCard v-for="(item, index) in QUEST_LIST" :key="'item_' + index" v-show="FILTER_ON === false ||
            FILTER.text === null ||
            item.info.PID.includes(FILTER.text) ||
            item.info.title.includes(FILTER.text)
            " :item="item" :index="index" :selected="selected.indexOf(item.info.uid) > -1" :data-cy="'item_' + index"
            @change_selection="select_item($event, item.info.uid)" @export_item="export_item(item.info.uid)"
            @export_item_encrypted="export_item_encrypted(item.info.uid)" @remove="deleteselection([item.info.uid])"
            @view_item="view_item(item.info.uid)" />
        </div>
      </q-scroll-area>
    </div>

    <!-- ACTIONBTTNS -->
    <div v-if="QUEST_LIST.length > 0" class="col-auto text-center q-gutter-md justify-around" style="width: 100%">
      <MYBUTTON v-if="!somethingselected" :icon="$t('btn.select_all.icon')" :label="$t('btn.select_all.label')"
        @click="selectall(true)" />
      <MYBUTTON v-if="!somethingselected" :icon="$t('btn.import2.icon')" :label="$t('btn.import2.label')"
        @click="$router.push({ name: 'importQuest' })" />
      <MYBUTTON v-if="somethingselected" :icon="$t('btn.deselect.icon')" @click="selectall(false)"
        :label="$t('btn.deselect.label')" />
      <MYBUTTON v-if="QUEST_LIST.length > 0 && somethingselected" :icon="$t('btn.selection_export.icon')"
        @clicked="exportselection" data-cy="btn_export_all" :label="$t('btn.selection_export.label')" />
      <MYBUTTON v-if="QUEST_LIST.length > 0 && somethingselected" :icon="$t('btn.selection_delete.icon')"
        @clicked="deleteselection(selected)" :label="$t('btn.selection_delete.label')" />
      <MYBUTTON v-if="mainStore.debug" @click="printStorageToConsole" />
    </div>

    <!-- FALLBACK -->
    <div v-else class="col-auto text-center" data-cy="no_entry">
      <div class="text-grey">
        {{ $t('storage.no_entry') }}
      </div>
      <div>
        <MYBUTTON :icon="$t('btn.import2.icon')" :label="$t('btn.import2.label')"
          @click="$router.push({ name: 'importQuest' })" />
      </div>
    </div>

    <!-- DIALOG -->
    <TABLEVIEW v-if="view_QUEST !== undefined && medium === true" :QUEST="view_QUEST" :medium="medium"
      @closeClick="medium = false" />
  </div>
</template>

<script>
import { log } from "src/tools/Logger";
import { useMainStore } from "src/stores/main";

import TABLEVIEW from "src/components/TableView.vue";
import StorageCard from "src/components/StorageCard.vue";
import MYBUTTON from "src/components/MyButton.vue";
import FILTERSTORAGE from "src/components/FilterStorage.vue";

export default {
  name: "StorageResponses",
  components: { TABLEVIEW, StorageCard, MYBUTTON, FILTERSTORAGE },
  setup() {
    return { mainStore: useMainStore() };
  },
  data() {
    return {
      medium: false,
      selected: [],
      view_QUEST: undefined,
      FILTER_ON: false,
    };
  },
  computed: {
    somethingselected() {
      return this.selected.length > 0;
    },
    FILTER() {
      return this.mainStore.SETTINGS.get("filter_storage");
    },
    QUEST_LIST() {
      const LISTE = this.mainStore.STORAGE.get();
      const ORDERING = this.FILTER.order.value;
      switch (ORDERING) {
        case "date_up":
          LISTE.sort((a, b) => (a.info.date < b.info.date ? 1 : -1));
          break;
        case "date_down":
          LISTE.sort((a, b) => (a.info.date > b.info.date ? 1 : -1));
          break;
        case "pid_up":
          LISTE.sort((a, b) => (a.info.PID > b.info.PID ? 1 : -1));
          break;
        case "pid_down":
          LISTE.sort((a, b) => (a.info.PID < b.info.PID ? 1 : -1));
          break;
        case "export_open":
          LISTE.sort((a, b) => (a.exported > b.exported ? 1 : -1));
          break;
        default:
          break;
      }
      return LISTE;
    },
  },
  methods: {
    printStorageToConsole() {
      log({ message: "printStorageToConsole", data: this.mainStore.STORAGE.get() });
    },
    select_item(val, uid) {
      var index = this.selected.indexOf(uid);
      if (val) {
        if (index < 0) this.selected.push(uid);
      } else {
        if (index > -1) this.selected.splice(index, 1);
      }
    },
    view_item(uid) {
      this.view_QUEST = this.mainStore.STORAGE.get_by_uid(uid);
      this.medium = true;
    },
    export_item(uid) {
      this.mainStore.storage_export([uid]).then(() => { }).catch((err) => {
        log({ error: "export_item", data: err });
      });
    },
    export_item_encrypted(uid) {
      const payload = {
        pubKey: this.mainStore.SETTINGS.user_keyPair.publicKey,
        document: this.mainStore.STORAGE.get_by_uid(uid),
      };
      this.mainStore.storage_encrypted_export(payload).then(() => { }).catch((err) => {
        log({ error: "export_item_encrypted", data: err });
      });
    },
    exportselection() {
      if (this.selected.length < 1) return false;
      this.mainStore.storage_export(this.selected);
      this.selected = [];
      this.$q.notify({ message: `${this.$t('quest.export_success')}`, color: "green" });
    },
    deleteselection(SELECTED_ITEMS) {
      if (SELECTED_ITEMS.length < 1) return false;
      const answ = confirm(this.$t('btn.confirm_delete'));
      if (!answ) return;
      SELECTED_ITEMS.forEach((uid) => {
        this.mainStore.storageRemove(uid);
      });
      this.selected = [];
    },
    selectall(val) {
      this.QUEST_LIST.forEach((q) => {
        this.select_item(val, q.info.uid);
      });
    },
    filterDO(mode) {
      switch (mode) {
        case "set":
          this.FILTER_ON = true;
          break;
        case "cleared":
        default:
          this.FILTER_ON = false;
          break;
      }
    },
  },
};
</script>
