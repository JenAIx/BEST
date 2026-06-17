<template>
  <q-page class="page-size">
    <div class="column items-center" style="height: 100%">
      <!-- HEADING -->
      <div class="col-1 q-pt-md text-h6">
        Vorlagen
      </div>

      <!-- CONtENT -->
      <div class="col q-py-md" style="position: relative">
        <q-scroll-area class="my-form-wide">
          <div class="row q-pa-md justify-center q-gutter-md">
            <q-card
              class="preset-card"
              v-for="(item, index) in mainStore.PRESET_STORE" :key="item+'_'+index" flat bordered
            >
              <!-- KOPF: TITEL + AKTIONEN -->
              <q-card-section class="row items-center no-wrap q-py-sm">
                <div class="col">
                  <div class="preset-card__title text-subtitle1 text-weight-medium"
                    contenteditable @blur="actionStr($event, index)" @keyup.enter.prevent="actionStr($event, index)">{{item.label}}</div>
                  <div class="text-caption text-grey-6">{{ item.value.length }} Fragebögen</div>
                </div>
                <div class="col-auto">
                  <q-btn v-if="needToSave[index] === true" color="primary" size="12px" flat dense round icon="save" @click="save_item(index)">
                    <q-tooltip>{{ $t('btn.save.label') }}</q-tooltip>
                  </q-btn>
                  <div v-else class="text-grey-8 q-gutter-xs no-wrap">
                    <q-btn size="12px" color="primary" flat dense round icon="play_arrow" @click="start_preset(index)">
                      <q-tooltip>{{ $t('btn.start_preset') }}</q-tooltip>
                    </q-btn>
                    <q-btn size="12px" flat dense round icon="more_vert" data-cy="btn_options">
                      <q-menu cover auto-close>
                        <q-list>
                          <q-item class="my-btn text-center" data-cy="back_root" clickable @click="edit_preset(index)">
                            <q-item-section avatar>
                              <q-icon :name="$t('btn.edit_new.icon')" />
                            </q-item-section>
                            <q-item-section>{{$t('btn.edit_new.label')}}</q-item-section>
                          </q-item>
                          <q-item class="my-btn text-center text-negative" data-cy="back_root" clickable @click="delete_preset(index)">
                            <q-item-section avatar>
                              <q-icon :name="$t('btn.delete.icon')" color="negative" />
                            </q-item-section>
                            <q-item-section>{{$t('btn.delete.label')}}</q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </div>
                </div>
              </q-card-section>
              <q-separator />
              <!-- FRAGEBÖGEN ALS CHIPS -->
              <q-card-section class="preset-card__chips q-gutter-xs q-py-sm">
                <q-chip v-for="(val, idx) in item.value" :key="val + idx" dense outline color="primary"
                  text-color="primary" :label="val" />
              </q-card-section>
            </q-card>
          </div>
        </q-scroll-area>
      </div>

      <!-- BUTTONS -->
      <div class="col-2 text-center">
        <MYBUTTON :label="$t('btn.make_preset')" @click="$router.push('preset')" />
      </div>

    </div>
    <!-- BACKBUTTON -->
    <BACKBUTTON />

    <!-- MODALS -->
    <q-dialog v-model="PresetStoreEdit_show" >
        <PRESET_STORE_EDIT 
          :item="PresetStoreEdit_item"
          @save="updateItem($event)"
          @close="PresetStoreEdit_show = false; PresetStoreEdit_item = undefined" />
    </q-dialog>
    
  </q-page>
</template>

<script>
  // import Vue from 'vue'
  import myMixins from 'src/mixins/modes'
  import { useMainStore } from 'src/stores/main'
  import BACKBUTTON from 'src/components/BackButton.vue'
  import MYBUTTON from 'src/components/MyButton.vue'
  import PRESET_STORE_EDIT from 'src/components/PresetStore_Edit.vue'
  export default {
    name: 'PRESETSTORE',
    mixins: [myMixins],
    setup() {
      return { mainStore: useMainStore() }
    },
    data() {
      return {
        needToSave: [],
        PresetStoreEdit_item: undefined,
        PresetStoreEdit_show: false,
      }
    },
    components: {BACKBUTTON, MYBUTTON, PRESET_STORE_EDIT},
    methods: {
      actionStr(ev, index) {
        var text = ev.target.innerText.replace(/[\n\r]/g, '')
        this.mainStore.PRESET_STORE[index].label = text
        ev.target.innerText = text
        this.needToSave[index] = true
      },
      start_preset(index) {
        var answer = window.confirm(this.$t('btn.confirm_start'));
        if (!answer) return
        this.$router.push(
          `preset/${JSON.stringify({presets: this.mainStore.PRESET_STORE[index].value, mode: 'protected'})}`)
      },
      delete_preset(index) {
        var answer = window.confirm(this.$t('btn.confirm_delete'));
        if (answer) this.mainStore.deletePreset(index);
      },
      // clear_preset() {
      //    var answer = window.confirm(this.TEXT.btn.confirm_delete);
      //   if (answer) this.mainStore.clearPreset();
      // },

      edit_preset(index) {
        this.PresetStoreEdit_show = true
        this.PresetStoreEdit_item = this.mainStore.PRESET_STORE[index]
      },

      save_item(index) {
        this.needToSave[index] = false
        this.mainStore.updatePreset({
          index: index,
          value: this.mainStore.PRESET_STORE[index]
        });
      },

      updateItem(item) {
        var index = this.mainStore.PRESET_STORE.findIndex((el) => el.label === item.label)
        this.mainStore.updatePreset({index: index, value: item});
        this.PresetStoreEdit_show = false
        this.PresetStoreEdit_item = undefined
      }
      // onInputLabel(event, index) {
      //   this.mainStore.PRESET_STORE[index].label = event.target.innerText
      //   Vue.set(this.needToSave, index,  true)
      // }
    }
  }

</script>

<style lang="sass" scoped>
.preset-card
  width: 320px
  border-radius: $radius
  border-color: $line
  box-shadow: $shadow-soft
  transition: box-shadow .18s ease, transform .18s ease
  &:hover
    box-shadow: $shadow-hover
    transform: translateY(-1px)

.preset-card__title
  outline: none
  border-radius: 6px
  padding: 2px 4px
  &:focus
    background: rgba($primary, 0.06)

.preset-card__chips
  max-height: 132px
  overflow-y: auto
</style>
