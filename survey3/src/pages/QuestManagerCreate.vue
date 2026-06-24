<template>
  <q-page data-cy="questman_create" class="builder-page column no-wrap">
    <!-- TOP BAR -->
    <div v-if="content !== null" class="builder-bar row items-center no-wrap q-px-md">
      <q-btn flat round dense icon="arrow_back" @click="$router.back()" class="q-mr-sm" />
      <div class="column">
        <div class="text-subtitle1 text-weight-medium ellipsis" style="max-width: 46vw">
          {{ content.title || $t('settings.questman.create.label') }}
        </div>
        <div class="text-caption text-grey-6">{{ content.short_title || $t('settings.questman.create.please_fill') }}</div>
      </div>
      <q-space />
      <q-chip :color="valid ? 'positive' : 'negative'" text-color="white" dense
        :icon="valid ? 'check_circle' : 'error'" data-cy="validation_chip">
        {{ valid ? $t('builder.valid') : validation.errors.length + ' ' + $t('builder.errors') }}
      </q-chip>
      <q-btn flat round dense icon="visibility" class="lt-md q-ml-xs" data-cy="btn_preview"
        @click="show_preview = true"><q-tooltip>{{ $t('btn.preview.label') }}</q-tooltip></q-btn>
      <q-btn unelevated no-caps color="primary" icon="save" :label="$t('btn.save.label')" class="q-ml-sm"
        data-cy="btn_save" @click="saveQuest()" />
      <q-btn flat round dense icon="more_vert" class="q-ml-xs">
        <q-menu auto-close>
          <q-list>
            <q-item clickable @click="exportQuest()"><q-item-section avatar><q-icon name="download" /></q-item-section><q-item-section>{{ $t('btn.export.label_short') }}</q-item-section></q-item>
            <q-item clickable @click="show_preview = true"><q-item-section avatar><q-icon name="visibility" /></q-item-section><q-item-section>{{ $t('btn.preview.label') }}</q-item-section></q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- BODY: EDITOR | LIVE-VORSCHAU -->
    <div v-if="content !== null" class="builder-body row no-wrap col">
      <!-- ============ EDITOR ============ -->
      <div class="builder-editor col">
        <q-scroll-area class="fit">
          <div class="builder-editor-inner q-pa-md">

            <!-- KOPF -->
            <q-card flat bordered class="q-mb-md">
              <q-card-section class="q-pb-sm">
                <div class="text-overline text-grey-6">{{ $t('builder.section_head') }}</div>
                <q-input data-cy="quest_title" v-model="content.title" :label="$t('builder.title')" filled dense
                  @update:model-value="onTitleChange" class="q-mb-sm" />
                <q-input data-cy="quest_short_title" v-model="content.short_title" :label="$t('builder.short_title')"
                  filled dense :hint="$t('builder.short_title_hint')" @update:model-value="shortTitleTouched = true">
                  <template #append>
                    <q-icon name="auto_fix_high" class="cursor-pointer" @click="regenShortTitle">
                      <q-tooltip>{{ $t('builder.regen') }}</q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
                <q-input v-model="content.description" :label="$t('builder.description')" filled dense class="q-mt-sm" />

                <q-expansion-item dense-toggle :label="$t('builder.advanced')" header-class="text-grey-7 q-px-none q-mt-xs"
                  data-cy="btn_advanced">
                  <q-input v-model="content.manual" :label="$t('builder.manual')" filled dense class="q-mt-xs" />
                  <q-input v-model="content.keywords" :label="$t('builder.keywords')" filled dense class="q-mt-xs" />
                  <q-input v-model="content.ref" label="Referenz (z. B. Pubmed-Link)" filled dense class="q-mt-xs" />
                  <div class="row q-col-gutter-sm q-mt-xs items-center">
                    <q-input class="col-12" readonly dense filled label="Coding System">
                      <template #append>
                        <q-btn-dropdown no-caps color="dark" flat :label="content.coding.system">
                          <q-list>
                            <q-item clickable v-close-popup @click="content.coding.system = 'http://snomed.info/sct'"><q-item-section>http://snomed.info/sct</q-item-section></q-item>
                            <q-item clickable v-close-popup @click="content.coding.system = 'LOINC'"><q-item-section>LOINC</q-item-section></q-item>
                            <q-item clickable v-close-popup @click="content.coding.system = 'CUSTOM'"><q-item-section>CUSTOM</q-item-section></q-item>
                          </q-list>
                        </q-btn-dropdown>
                        <q-btn flat round icon="search" size="xs" @click="open_coding(content.coding.system)" />
                      </template>
                    </q-input>
                    <q-input class="col-5" v-model="content.coding.code" dense filled label="Code" />
                    <q-input class="col-7" v-model="content.coding.display" dense filled label="Anzeige" />
                  </div>
                </q-expansion-item>
              </q-card-section>
            </q-card>

            <!-- FELDER -->
            <div class="row items-center q-mb-sm">
              <div class="text-overline text-grey-6">{{ $t('builder.fields') }} ({{ content.items.length }})</div>
              <q-space />
              <q-btn-dropdown outline no-caps dense color="primary" icon="add" :label="$t('builder.add_field')"
                data-cy="btn_items_add_menu">
                <q-list style="min-width: 180px">
                  <q-item v-for="t in ITEMTYPES" :key="t" clickable v-close-popup @click="addItemOfType(t)"
                    :data-cy="`add_type_${t}`">
                    <q-item-section avatar><q-icon :name="return_icon_quest(t)" /></q-item-section>
                    <q-item-section>{{ $t('builder.type.' + t) }}</q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </div>

            <draggable v-model="content.items" :item-key="itemKey" handle=".drag-handle" ghost-class="drag-ghost"
              animation="160" @end="updateID()">
              <template #item="{ element: item, index: inditem }">
                <q-card flat bordered class="field-card q-mb-sm" :data-cy="`item_row_${inditem}`">
                  <div class="row items-center no-wrap q-pa-sm">
                    <q-icon class="drag-handle cursor-move q-mr-xs" name="drag_indicator" size="sm" color="grey-5"
                      :data-cy="`item_drag_${inditem}`" />
                    <q-avatar size="32px" color="grey-2" text-color="grey-8" class="q-mr-sm">
                      <q-icon :name="return_icon_quest(item.type)" size="18px" />
                    </q-avatar>
                    <div class="col" style="min-width: 0" @click="toggleExpand(inditem)">
                      <div class="text-body2 ellipsis">{{ plainLabel(item.label) || $t('builder.untitled') }}</div>
                      <div class="text-caption text-grey-6">{{ $t('builder.type.' + item.type) || item.type }}
                        <span v-if="item.force === false" class="text-grey-5"> · {{ $t('builder.optional') }}</span>
                      </div>
                    </div>
                    <q-btn flat round dense :icon="expanded[inditem] ? 'expand_less' : 'edit'" color="grey-7"
                      :data-cy="`item_expanse_${inditem}`" @click="toggleExpand(inditem)" />
                    <q-btn flat round dense icon="more_vert" color="grey-7" data-cy="btn_options">
                      <q-menu auto-close>
                        <q-list>
                          <q-item v-if="inditem > 0" clickable :data-cy="`item_up_${inditem}`" @click="moveItem('up', inditem)">
                            <q-item-section avatar><q-icon name="arrow_upward" /></q-item-section><q-item-section>{{ $t('btn.up.label') }}</q-item-section></q-item>
                          <q-item v-if="inditem < content.items.length - 1" clickable :data-cy="`item_down_${inditem}`" @click="moveItem('down', inditem)">
                            <q-item-section avatar><q-icon name="arrow_downward" /></q-item-section><q-item-section>{{ $t('btn.down.label') }}</q-item-section></q-item>
                          <q-item clickable :data-cy="`item_copy_${inditem}`" @click="copyItem(inditem)">
                            <q-item-section avatar><q-icon name="content_copy" /></q-item-section><q-item-section>{{ $t('btn.duplicate.label') }}</q-item-section></q-item>
                          <q-separator />
                          <q-item clickable :data-cy="`item_delete_${inditem}`" @click="removeItem(inditem)" class="text-negative">
                            <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section><q-item-section>{{ $t('btn.delete.label') }}</q-item-section></q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </div>
                  <q-slide-transition>
                    <div v-show="expanded[inditem]" class="field-card-body">
                      <CREATEITEM :key="'ci_' + inditem" :item="item" :index="inditem"
                        @updateItem="updateItem($event, item)" />
                    </div>
                  </q-slide-transition>
                </q-card>
              </template>
            </draggable>

            <!-- Schnell-Hinzufügen (Default-Feld) -->
            <q-btn flat no-caps dense icon="add" :label="$t('builder.add_field')" color="primary" class="q-mt-xs"
              data-cy="btn_items_add" @click="addItem()" />

            <!-- AUSWERTUNG -->
            <q-card flat bordered class="q-mt-md">
              <q-expansion-item icon="functions" :label="$t('settings.questman.create.results')"
                :caption="$t('settings.questman.create.results_details')" data-cy="btn_results">
                <q-card-section>
                  <CREATERESULTS :results="content.results" @updateResult="updateResult($event)" />
                </q-card-section>
              </q-expansion-item>
            </q-card>

            <!-- VALIDIERUNG (Details) -->
            <q-banner v-if="validation.errors.length" dense rounded class="bg-red-1 text-red-9 q-mt-md" data-cy="validation_errors">
              <template #avatar><q-icon name="error" color="negative" /></template>
              <div class="text-weight-medium">{{ validation.errors.length }} {{ $t('builder.errors_block') }}</div>
              <div v-for="(e, i) in validation.errors" :key="'e' + i" class="text-caption">{{ e.code }}: {{ e.msg }}</div>
            </q-banner>
            <div v-else class="q-mt-md" data-cy="validation_ok">
              <q-banner dense rounded class="bg-green-1 text-green-9">
                <template #avatar><q-icon name="check_circle" color="positive" /></template>
                {{ $t('builder.valid') }}{{ validation.warnings.length ? ` (${validation.warnings.length} ${$t('builder.warnings')})` : '' }}.
              </q-banner>
            </div>

            <div style="height: 32px" />
          </div>
        </q-scroll-area>
      </div>

      <!-- ============ LIVE-VORSCHAU (Desktop) ============ -->
      <div class="builder-preview col-5 gt-sm">
        <div class="preview-head row items-center q-px-md">
          <q-icon name="visibility" size="18px" color="grey-6" class="q-mr-xs" />
          <span class="text-overline text-grey-6">{{ $t('builder.live_preview') }}</span>
        </div>
        <div class="preview-frame">
          <PREVIEWITEM :content="previewContent" data-cy="builder_preview" />
        </div>
      </div>
    </div>

    <!-- VORSCHAU-DIALOG (Mobile) -->
    <q-dialog v-model="show_preview" maximized transition-show="slide-up" transition-hide="slide-down">
      <q-card class="column no-wrap">
        <q-toolbar class="bg-secondary text-white">
          <q-toolbar-title class="text-subtitle1">{{ $t('builder.live_preview') }}</q-toolbar-title>
          <q-btn flat round dense icon="close" v-close-popup />
        </q-toolbar>
        <div class="col" style="position: relative">
          <PREVIEWITEM :content="previewContent" :content_single_item="content_single_item" />
        </div>
      </q-card>
    </q-dialog>

    <!-- EXPORT-DIALOG -->
    <q-dialog v-model="show_export">
      <q-card style="min-width: 360px; max-width: 90vw">
        <q-card-section class="row items-center">
          <div class="text-h6">Fragebogen-Export</div>
          <q-space />
          <q-btn flat round dense icon="save" @click="saveJson()"><q-tooltip>Als JSON speichern</q-tooltip></q-btn>
        </q-card-section>
        <q-card-section>
          <q-input filled autogrow v-model="content_export" readonly />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="$t('btn.close.label')" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { useMainStore } from 'src/stores/main'
import { quest_template, item_template, item_types } from 'assets/questionnaires/list_quest'
import { log } from 'src/tools/Logger'
import myMixins from 'src/mixins/modes'
import draggable from 'vuedraggable'
import { validateQuestScoring } from 'src/tools/questman/validate'

import CREATEITEM from 'src/components/CreateItem.vue'
import CREATERESULTS from 'src/components/CreateResults.vue'
import PREVIEWITEM from 'src/components/PreviewItem.vue'

// Slug für intelligente Namensgebung: ASCII, lowercase, _-getrennt, max 40.
function slugify(str) {
  return (str || '')
    .toString()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // Diakritika entfernen (ä→a …)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

export default {
  name: 'QuestManagerCreate',
  setup() {
    return { mainStore: useMainStore() }
  },
  mixins: [myMixins],
  components: { CREATEITEM, CREATERESULTS, PREVIEWITEM, draggable },
  data() {
    return {
      content: null,
      content_single_item: null,
      content_export: null,
      show_preview: false,
      show_export: false,
      date_str: Date.now(),
      expanded: [],
      shortTitleTouched: false,
      previewContent: null,
      _previewTimer: null,
    }
  },
  mounted() {
    if (this.mainStore.editquest === undefined) {
      this.content = JSON.parse(JSON.stringify(quest_template))
      this.mainStore.editquest = this.content
    } else {
      this.content = this.mainStore.editquest
      // bestehender Bogen: short_title gilt als bewusst gesetzt
      if (this.content.short_title) this.shortTitleTouched = true
    }
    this.previewContent = JSON.parse(JSON.stringify(this.content))
  },
  beforeUnmount() {
    clearTimeout(this._previewTimer)
  },
  watch: {
    // Live-Vorschau entkoppelt aktualisieren: nicht bei jedem Tastendruck
    // synchron neu rendern (Performance + verhindert DOM-Detach beim Tippen),
    // sondern 200 ms nach der letzten Änderung mit einem stabilen Klon.
    content: {
      deep: true,
      handler() {
        clearTimeout(this._previewTimer)
        this._previewTimer = setTimeout(() => {
          if (this.content) this.previewContent = JSON.parse(JSON.stringify(this.content))
        }, 200)
      },
    },
  },
  computed: {
    ITEMTYPES() {
      return item_types
    },
    valid() {
      return this.validation.errors.length === 0
    },
    // Live-Schema-Validierung; date_str triggert die Neuberechnung bei Änderungen.
    validation() {
      // eslint-disable-next-line no-unused-expressions
      this.date_str
      if (this.content === null) return { errors: [], warnings: [] }
      try {
        return validateQuestScoring(this.content)
      } catch (e) {
        return { errors: [{ code: 'INVALID', msg: String((e && e.message) || e) }], warnings: [] }
      }
    },
  },
  methods: {
    itemKey(el) {
      return this.content && this.content.items ? this.content.items.indexOf(el) : 0
    },
    plainLabel(html) {
      const tmp = document.createElement('div')
      tmp.innerHTML = html || ''
      return (tmp.textContent || tmp.innerText || '').trim()
    },
    toggleExpand(i) {
      this.expanded[i] = !this.expanded[i]
    },
    // --- intelligente Namensgebung ---
    onTitleChange(val) {
      if (!this.shortTitleTouched) this.content.short_title = slugify(val)
    },
    regenShortTitle() {
      this.content.short_title = slugify(this.content.title)
      this.shortTitleTouched = false
    },
    open_coding(val) {
      const links = {
        'http://snomed.info/sct': 'https://browser.ihtsdotools.org/',
        LOINC: 'https://loinc.org/search/',
      }
      if (links[val]) window.open(links[val], '_blank')
    },
    return_icon_quest(type) {
      switch (type) {
        case 'radio': return 'radio_button_checked'
        case 'multiple_radio': return 'grid_on'
        case 'checkbox': return 'check_box'
        case 'slider': return 'tune'
        case 'number': return 'pin'
        case 'date': case 'date_year': return 'event'
        case 'time': return 'schedule'
        case 'separator': return 'remove'
        case 'textbox': return 'notes'
        case 'drawing': return 'gesture'
        case 'image': return 'image'
        default: return 'text_fields'
      }
    },
    previewItem(item) {
      this.content_single_item = JSON.parse(JSON.stringify(this.content))
      this.content_single_item.items = [item]
      this.show_preview = true
    },
    updateID() {
      let id = 1
      this.content.items.forEach((item) => {
        switch (item.type) {
          case 'separator':
          case 'textbox':
            item.id = undefined
            break
          case 'multiple_radio': {
            const local_id = []
            if (item.options && item.options.questions) {
              item.options.questions.forEach((q) => { q.id = id; local_id.push(id); id++ })
              item.id = JSON.stringify(local_id)
            }
            break
          }
          default:
            item.id = id
            id++
            break
        }
      })
    },
    // Default-Feld (Text) mit menschenlesbarem Namen statt UUID.
    addItem() {
      this.addItemOfType('text')
    },
    addItemOfType(type) {
      const item = JSON.parse(JSON.stringify(item_template))
      const n = this.content.items.length + 1
      item.type = type
      item.id = undefined
      item.force = false
      item.label = type === 'separator' || type === 'textbox'
        ? this.$t('builder.new_section')
        : `${this.$t('builder.new_field')} ${n}`
      item.tag = slugify(item.label)
      // typ-spezifische Initialisierung (analog CreateItem.onTypeClick)
      switch (type) {
        case 'multiple_radio':
          item.value = []
          item.options = { answers: [{ label: 'Antwort 1', value: 1 }], questions: [{ label: 'Frage 1', tag: 'a1', id: null }] }
          break
        case 'radio':
          item.value = null
          item.options = [{ label: 'Option 1', value: 1 }, { label: 'Option 2', value: 2 }]
          break
        case 'checkbox':
          item.value = []
          item.options = [{ label: 'Option 1', value: 1 }, { label: 'Option 2', value: 2 }]
          break
        case 'slider':
          item.value = null
          item.vertical = false
          item.options = { top: { value: 100, label: 'max' }, bottom: { value: 0, label: 'min' }, steps: 10 }
          break
        case 'drawing':
          item.value = null
          item.options = undefined
          item.canvas = { size: 320, background: 'blank' }
          break
        default:
          item.value = null
          item.options = undefined
          break
      }
      this.content.items.push(item)
      this.expanded[this.content.items.length - 1] = true
      this.updateID()
      this.date_str = Date.now()
    },
    removeItem(index) {
      this.content.items.splice(index, 1)
      this.expanded.splice(index, 1)
      this.updateID()
      this.date_str = Date.now()
    },
    copyItem(index) {
      if (index === undefined) return false
      const item = JSON.parse(JSON.stringify(this.content.items[index]))
      item.id = -1
      this.content.items.splice(index + 1, 0, item)
      this.updateID()
      this.date_str = Date.now()
    },
    updateItem(payload, item) {
      item[payload.field] = payload.value
      this.date_str = Date.now()
      if (payload.updateID) this.updateID()
    },
    updateResult(payload) {
      this.content[payload.field] = payload.value
      this.date_str = Date.now()
    },
    async saveQuest() {
      if (!this.content.short_title) {
        this.$q.notify({ message: this.$t('btn.shorttitle_required'), color: 'warning' })
        log({ error: 'kein Shorttitle' })
        return
      }
      if (this.validation.errors.length) {
        this.$q.notify({
          message: `${this.$t('quest.import_failed')}: ${this.validation.errors.map((e) => e.code).join(', ')}`,
          color: 'negative', multiLine: true, timeout: 8000,
        })
        return
      }
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
          color: 'negative', multiLine: true, timeout: 8000,
        })
      }
    },
    exportQuest() {
      this.content_export = JSON.stringify(this.content, null, 2)
      this.show_export = true
    },
    moveItem(action, index) {
      if (index === undefined) return
      const items = this.content.items
      const j = action === 'down' ? index + 1 : index - 1
      if (j < 0 || j >= items.length) return
      const tmp = items[index]; items[index] = items[j]; items[j] = tmp
      this.updateID()
      this.date_str = Date.now()
    },
    saveJson() {
      const jsonContent = JSON.stringify(this.content, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `quest_${this.content.short_title}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
  },
}
</script>

<style lang="sass" scoped>
.builder-page
  height: 100%

.builder-bar
  height: 56px
  min-height: 56px
  border-bottom: 1px solid $line
  background: $surface

.builder-body
  min-height: 0  // erlaubt scrollende Kinder im Flex

.builder-editor
  min-width: 0
  background: $surface-muted

.builder-editor-inner
  max-width: 760px
  margin: 0 auto

.field-card
  border-radius: $radius-sm
  transition: box-shadow 0.15s ease
  &:hover
    box-shadow: $shadow-soft

.field-card-body
  border-top: 1px solid $line
  background: $surface

.drag-ghost
  opacity: 0.5
  background: rgba(25, 118, 210, 0.08)

.builder-preview
  border-left: 1px solid $line
  background: $grey-3
  display: flex
  flex-direction: column

.preview-head
  height: 40px
  min-height: 40px
  border-bottom: 1px solid $line
  background: $surface

.preview-frame
  flex: 1
  min-height: 0
  overflow: hidden
  padding: 16px
  display: flex
  justify-content: center
  & > *
    width: 100%
    max-width: 640px
</style>
