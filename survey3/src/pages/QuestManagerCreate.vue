<template>
  <q-page data-cy="questman_create" class="page-size">
    <div class="column items-center" style="height: 100%">
      <div class="col-1 q-pt-md text-h6">
       {{ $t('settings.questman.create.label') }}
      </div>

      <div v-if="content !== null" class="col q-py-md text-center">
        <!-- AUSWAHL FRAGEBÖGEN -->
        <div class="text-caption text-grey">{{ $t('settings.questman.create.description') }}</div>
        <q-scroll-area class="shadow-1 my-form" >
          <q-list bordered separator class="quest_list" data-cy="questlistRoot">
            <!-- DESCRIPITON -->
            <q-expansion-item
              data-cy="btn_description"
              expand-separator
              icon="description"
              :label="content.title || $t('settings.questman.create.please_fill')"
              :caption="$t('settings.questman.create.general_information')"
              class="bg-grey-1 q-pa-sm"
            >
              <q-input data-cy="quest_title" v-model="content.title" dense label="Titel" />
              <q-input data-cy="quest_short_title" v-model="content.short_title" dense label="Kurzer Titel (Klein, keine Sonderzeichen / Leerzeichen)" />
              <q-input  v-model="content.description" dense label="Beschreibung" />
              <q-input  v-model="content.manual" dense label="Anleitung" />
              <q-input  v-model="content.keywords" dense label="Schlüsselworte / Suchworte" />
              <q-input  v-model="content.ref" dense label="Verweis auf Literatur: i.e. Pubmed-Link" />
              <q-input readonly dense label="Coding System">
                <template v-slot:append>
              <q-btn-dropdown no-caps color="dark" flat :label="content.coding.system">
                <q-list>
                  <q-item clickable v-close-popup @click="content.coding.system = 'http://snomed.info/sct'">
                    <q-item-section>
                      <q-item-label>http://snomed.info/sct</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="content.coding.system = 'http://loinc.org'">
                    <q-item-section>
                      <q-item-label>http://loinc.org</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
              <q-btn flat round icon="search" size="xs" @click="open_coding(content.coding.system)"/>
              </template>
              </q-input>
              <q-input  v-model="content.coding.code" dense label="Coding Code" />
              <q-input  v-model="content.coding.display" dense label="Coding Anzeige" />
            </q-expansion-item>

            <!-- ITEMS -->
            <q-expansion-item
              expand-separator
              icon="border_color"
              :label="`Items (${content.items.length})`"
              :caption="$t('settings.questman.create.single_items')"
              class="bg-grey-1"
              data-cy="btn_items"
            >
              <!-- ALL ELEMENTS (per Drag-&-Drop oder Hoch/Runter sortierbar) -->
              <draggable
                v-model="content.items"
                :item-key="itemKey"
                handle=".drag-handle"
                ghost-class="drag-ghost"
                @end="updateID()"
              >
                <template #item="{ element: item, index: inditem }">
                  <div class="q-pa-md row items-center q-y-gutter-sm" :data-cy="`item_row_${inditem}`">
                    <div class="col-auto">
                      <q-icon class="drag-handle cursor-move" name="drag_indicator" size="sm" color="grey-6"
                        :data-cy="`item_drag_${inditem}`" />
                    </div>
                    <div class="col">
                      <q-expansion-item
                        :data-cy="`item_expanse_${inditem}`"
                        class="bg-grey-3"
                        v-model="expanded[inditem]"
                        :icon="return_icon_quest(item.type)"
                        :label="item.label"
                        :caption="item.type"
                      >
                      <CREATEITEM :key="'ci_' + inditem + '_' + date_str" :item="item" :index="inditem" @updateItem="updateItem($event, item)" />
                      </q-expansion-item>
                    </div>
                    <div class="col-auto">
                      <q-btn  color="grey-7" round flat icon="more_vert" data-cy="btn_options">
                        <q-menu cover auto-close>
                          <q-list>
                            <q-item v-if="inditem > 0" class="my-btn text-center" :data-cy="`item_up_${inditem}`" clickable @click="moveItem('up', inditem)">
                              <q-item-section >{{$t('btn.up.label')}}</q-item-section>
                            </q-item>
                            <q-item v-if="inditem < content.items.length - 1" class="my-btn text-center" :data-cy="`item_down_${inditem}`" clickable @click="moveItem('down', inditem)">
                              <q-item-section >{{$t('btn.down.label')}}</q-item-section>
                            </q-item>
                            <q-separator/>
                            <q-item  class="my-btn text-center" :data-cy="`item_delete_${inditem}`" clickable @click="removeItem(inditem)">
                              <q-item-section >{{$t('btn.delete.label')}}</q-item-section>
                            </q-item>
                            <q-item  class="my-btn text-center" :data-cy="`item_copy_${inditem}`" clickable @click="copyItem(inditem)">
                              <q-item-section >{{$t('btn.duplicate.label')}}</q-item-section>
                            </q-item>
                            <q-item  class="my-btn text-center" clickable @click="previewItem(item)">
                              <q-item-section >{{$t('btn.preview.label')}}</q-item-section>
                            </q-item>
                          </q-list>
                        </q-menu>
                      </q-btn>
                    </div>
                  </div>
                </template>
              </draggable>

              <!-- ADD BUTTON -->
              <q-btn data-cy="btn_items_add" class="q-my-md" icon="add" @click="addItem()" />

            </q-expansion-item>

            <!-- RESULTS -->
            <q-expansion-item
              expand-separator
              icon="poll"
              :label="$t('settings.questman.create.results')"
              :caption="$t('settings.questman.create.results_details')"
              class="bg-grey-1"
            >
              <CREATERESULTS :results="content.results" @updateResult="updateResult($event)"/>

            <!-- ENDE RESULTS -->
            </q-expansion-item>

          <!-- ENDE SCROLL AREA -->
          </q-list>
        </q-scroll-area>
      </div>

      <!-- LIVE-VALIDIERUNG -->
      <div v-if="content !== null" class="col-auto q-px-md" style="width: 100%; max-width: 720px">
        <q-banner v-if="validation.errors.length" dense class="bg-red-1 text-red-9 q-mb-xs" data-cy="validation_errors">
          <template v-slot:avatar><q-icon name="error" color="negative" /></template>
          <div class="text-weight-medium">{{ validation.errors.length }} Fehler — Speichern blockiert:</div>
          <div v-for="(e, i) in validation.errors" :key="'e'+i" class="text-caption">{{ e.code }}: {{ e.msg }}</div>
        </q-banner>
        <q-banner v-else dense class="bg-green-1 text-green-9 q-mb-xs" data-cy="validation_ok">
          <template v-slot:avatar><q-icon name="check_circle" color="positive" /></template>
          Schema gültig{{ validation.warnings.length ? ` (${validation.warnings.length} Warnung(en))` : '' }}.
        </q-banner>
      </div>

      <!-- ACTIONBTTNS -->
      <div class="col-2 text-center q-gutter-md justify-around" style="width: 100%">
          <MYBUTTON data-cy="btn_preview" :icon="$t('btn.preview.icon')"  @click="preview" :label="$t('btn.preview.label')" />
          <br>
          <MYBUTTON data-cy="btn_save" @click="saveQuest()" :label="$t('btn.save.label')" />
          <MYBUTTON @click="exportQuest()" :label="$t('btn.export.label_short')" />
      </div>

      <!-- END COLUMN -->
    </div>

    <!-- PREVIEW -->
    <q-dialog
      v-model="show_preview"
      persistent
      maximized
    >
      <div class="column items-center bg-white ">
        <div class="col" style="width: 100%;">
          <PREVIEWITEM :content="content" :content_single_item="content_single_item"/>
        </div>

        <div class="col-1">
           <MYBUTTON :label="$t('btn.close.label')" @click="show_preview = false" />
        </div>

      </div>
    </q-dialog>

    <!-- EXPORT -->
        <!-- PREVIEW -->
    <q-dialog
      v-model="show_export"
      persistent
      maximized
    >
      <q-card>
        <q-card-section class="relative">
          <div class="text-h6">Fragebogen export</div>
          <div class="text-caption">zum Exportieren in die Zwischenablage kopieren</div>
          <q-btn icon="save" @click="saveJson()" class="absolute-top-right q-mt-md q-mr-md"><q-tooltip>Speichere als JSON ab.</q-tooltip></q-btn>
        </q-card-section>
        <q-card-section>
          <q-input filled autogrow v-model="content_export" readonly />
        </q-card-section>
        <q-card-actions>
          <MYBUTTON :label="$t('btn.close.label')" @click="show_export = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>


    <!-- BACKBUTTON -->
    <BACKBUTTON :go_back="true" />

  </q-page>
</template>

<script>

import { useMainStore } from 'src/stores/main'
import { quest_template, item_template } from 'assets/questionnaires/list_quest'
import { uuidv4 } from 'src/tools/hhash'
import {log} from 'src/tools/Logger'
import myMixins from 'src/mixins/modes'
import draggable from 'vuedraggable'
import { validateQuestScoring } from 'src/tools/questman/validate'

import BACKBUTTON from 'src/components/BackButton.vue'
import CREATEITEM from 'src/components/CreateItem.vue'
import CREATERESULTS from 'src/components/CreateResults.vue'
import PREVIEWITEM from 'src/components/PreviewItem.vue'
import MYBUTTON from 'src/components/MyButton.vue'


export default {
  name: 'QuestManagerCreate',
  setup() {
    return { mainStore: useMainStore() }
  },
  mixins: [myMixins],
  components: {BACKBUTTON, CREATEITEM, CREATERESULTS, PREVIEWITEM, MYBUTTON, draggable},
  data () {
    return {
      content: null,
      content_single_item: null,
      content_export: null,
      show_preview: false,
      show_export: false,
      date_str: Date.now(),
      expanded: []
    }
  },
  mounted() {
    if (this.mainStore.editquest === undefined) {
      this.content = JSON.parse(JSON.stringify(quest_template))
      this.mainStore.editquest = this.content
    } else this.content = this.mainStore.editquest

  },
  computed: {
    // Live-Schema-Validierung des aktuell bearbeiteten Bogens. date_str triggert
    // die Neuberechnung bei jeder Item-/Result-Änderung (gleicher Mechanismus wie
    // die v-for-Aktualisierung).
    validation() {
      // eslint-disable-next-line no-unused-expressions
      this.date_str
      if (this.content === null) return { errors: [], warnings: [] }
      try {
        return validateQuestScoring(this.content)
      } catch (e) {
        return { errors: [{ code: 'INVALID', msg: String(e && e.message || e) }], warnings: [] }
      }
    },
  },
// METHODS
  methods: {
    // stabiler Key fürs Drag-&-Drop (Position in der Liste reicht zum Tracken).
    itemKey(el) {
      return this.content && this.content.items ? this.content.items.indexOf(el) : 0
    },
    open_coding(val){
      var link = undefined
      switch(val) {
        case 'http://snomed.info/sct':
          link = 'https://browser.ihtsdotools.org/?perspective=full&conceptId1=450741005&edition=MAIN/2021-01-31&release=&languages=en'
          break
        case 'http://loinc.org':
          link = 'https://loinc.org/search/'
          break
        default:
          //do nothing
          break
      }
      if (link === undefined) return
      // else
      window.open(link, '_blank');
    },
    return_icon_quest(type) {
      switch(type) {
        case 'radio':
        case 'multiple_radio':
          return 'radio_button_checked'
        case 'checkbox':
          return 'check_box_outline_blank'
        case 'separator':
          return 'minimize'
        default:
          return 'text_snippet'
      }
    },
    preview() {
      this.content_single_item = null
      this.show_preview = true
    },
    previewItem(item) {
      this.content_single_item = JSON.parse(JSON.stringify(this.content))
      this.content_single_item.items = []
      this.content_single_item.items.push(item)
      this.show_preview = true
    },

    updateID() { //loop through the quest and update the ID for each questions
      var id = 1
      this.content.items.forEach(item => {
        switch(item.type) {
          case 'separator':
            item['id'] = undefined
            item['coding'] = undefined
            break
          case 'multiple_radio':
            let local_id = []
            if (item.options !== undefined && item.options.questions !== undefined) {
              item.options.questions.forEach(q => {
                q['id'] = id
                local_id.push(id)
                id ++
              })
              item['id'] = JSON.stringify(local_id)
            }
            break
          default:
            item['id'] = id
            id ++
            break
        }
      });
    },
    addItem() {
      const item = JSON.parse(JSON.stringify(item_template))
      item.label = uuidv4()
      item.id = undefined
      item.force = false
      this.content.items.push(item)
      // update id
      this.updateID()
    },
    removeItem(index) {
      this.content.items.splice(index,1)
      // update id
      this.updateID()
    },
    copyItem(index) {
      if (index === undefined) return false
      const item = JSON.parse(JSON.stringify(this.content.items[index]))
      item.id = -1
      this.content.items.push(item)
      // update id
      this.updateID()
    },
    updateItem(payload, item) {
      item[payload.field] = payload.value
      this.date_str = Date.now()
      // update id (nur wenn updateID == true >> sollte nur durch CreateItem>Add/Remove MultiQuest ausgelöst werden)
      if (payload.updateID) this.updateID()
    },
    updateResult(payload) {
      this.content[payload.field] = payload.value
      this.date_str = Date.now()

    },
    async saveQuest() {
      if (this.content.short_title === null || this.content.short_title === "") {
        this.$q.notify({ message: this.$t('btn.shorttitle_required'), color: 'warning' })
        log({error: 'kein Shorttitle'})
        return
      }

      // Live-Validierung: bei Schema-Fehlern nicht speichern
      if (this.validation.errors.length) {
        this.$q.notify({
          message: `${this.$t('quest.import_failed')}: ${this.validation.errors.map(e => e.code).join(', ')}`,
          color: 'negative', multiLine: true, timeout: 8000,
        })
        return
      }

      // check if short_title exists
      if (this.mainStore.QUEST_LIST.includes(this.content.short_title)) {
        if (!(await this.$confirm(this.$t('btn.overwrite_confirm')))) return
        this.mainStore.QUESTMAN.remove_by_name(this.content.short_title)
      }

      const res = this.mainStore.QUESTMAN.add(JSON.stringify(this.content))
      if (res.ok) {
        this.$q.notify({ message: this.$t('quest.export_success'), color: 'green' })
      } else {
        this.$q.notify({
          message: `${this.$t('quest.import_failed')}: ${res.errors.join('; ')}`,
          color: 'negative',
          multiLine: true,
          timeout: 8000,
        })
      }
    },
    exportQuest() {
      this.content_export = JSON.stringify(this.content)
      this.show_export = true
    },
    moveItem(action, index) {
      if (index === undefined) return
      const items = this.content.items
      if (action === 'down') {
        if (index >= items.length - 1) return
        const tmp = items[index]
        items[index] = items[index + 1]
        items[index + 1] = tmp
      } else {
        if (index === 0) return
        const tmp = items[index]
        items[index] = items[index - 1]
        items[index - 1] = tmp
      }
      this.updateID()
      this.date_str = Date.now() //this triggers an update of the v-for
    },

    saveJson() {
      // save the JSON to the local file system
      const jsonContent = JSON.stringify(this.content, null, 2); // Das zweite Argument `null` ist der replacer und das dritte Argument `2` gibt die Anzahl der Leerzeichen an, die für die Einrückung verwendet werden.
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quest_${this.content.short_title}.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }
}
</script>
