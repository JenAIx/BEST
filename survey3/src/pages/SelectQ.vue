<template>
  <q-page data-cy="selectquest" class="select-page column no-wrap">
    <!-- HEADER + SUCHE -->
    <div class="select-header column items-center q-pt-md q-px-md">
      <div class="text-h6 q-mb-sm">{{ $t('select_quest.label') }}</div>
      <q-input v-model="filter_value" data-cy="filter_input" class="select-search" rounded outlined dense clearable
        debounce="120" :placeholder="$t('select_quest.search')">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
      <div class="text-caption text-grey-6 q-mt-xs" data-cy="select_count">
        {{ FILTERED_LIST.length }} / {{ QUEST_LIST.length }}
        <span v-if="count_selected"> · {{ count_selected }} {{ $t('select_quest.selected') }}</span>
      </div>
    </div>

    <!-- LISTE -->
    <div class="col select-scroll">
      <div v-if="FILTERED_LIST.length > 0" class="select-grid q-pa-md" data-cy="questlistRoot">
        <q-item v-for="(item, index) in FILTERED_LIST" :key="item" clickable v-ripple class="select-card"
          :class="{ 'select-card--active': isSelected(item) }" :data-cy="'questlist' + index" @click="toggle(item)">
          <q-item-section avatar>
            <q-icon :name="isSelected(item) ? 'check_circle' : 'radio_button_unchecked'"
              :color="isSelected(item) ? 'primary' : 'grey-5'" size="24px" />
          </q-item-section>
          <q-item-section :data-cy="'quest_' + index">
            <q-item-label class="text-weight-medium">{{ QUESTMAN.get(item).title }}</q-item-label>
            <q-item-label v-if="QUESTMAN.get(item).description" caption lines="2">
              {{ QUESTMAN.get(item).description }}
            </q-item-label>
            <div v-if="keywordsOf(item).length" class="q-mt-xs">
              <q-chip v-for="(kw, ki) in keywordsOf(item)" :key="ki" dense square size="sm"
                color="blue-grey-1" text-color="blue-grey-8" class="kw-chip">{{ kw }}</q-chip>
            </div>
          </q-item-section>
        </q-item>
      </div>
      <div v-else class="text-grey-6 text-center q-pa-xl">
        <q-icon name="search_off" size="32px" class="q-mb-sm block" />
        {{ $t('select_quest.no_match') }}
      </div>
    </div>

    <!-- AKTIONEN -->
    <div class="select-actions row items-center justify-center q-gutter-sm q-py-sm">
      <span v-if="count_selected === 0" class="text-grey-6 text-caption">{{ $t('select_quest.hint_select') }}</span>
      <MYBUTTON v-if="count_selected > 0" :label="$t('btn.deselect.label')" @click="deselectAll" data-cy="deselect" />
      <MYBUTTON v-if="count_selected === 1" :label="$t('btn.toquest')" @click="gotoquest" data-cy="btn_gotoquest" />
      <MYBUTTON v-if="count_selected > 1" :label="$t('btn.make_preset')" @click="gotopreset" data-cy="btn_gotopreset" />
    </div>

    <BACKBUTTON />
  </q-page>
</template>

<script>
import myMixins from 'src/mixins/modes'
import { useMainStore } from 'src/stores/main'
import BACKBUTTON from 'src/components/BackButton.vue'
import MYBUTTON from 'src/components/MyButton.vue'

export default {
  name: 'SelectQuestionnaire',
  components: { BACKBUTTON, MYBUTTON },
  mixins: [myMixins],
  props: ['MODE'],
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return {
      filter_value: null,
      // Auswahl per Bogen-Key (short_title) — bleibt über Filterwechsel hinweg
      // korrekt (früher per Filter-Index → Häkchen verrutschten nach Filtern).
      selected: {},
    }
  },
  computed: {
    QUEST_LIST() {
      return this.mainStore.QUEST_LIST
    },
    QUESTMAN() {
      return this.mainStore.QUESTMAN
    },
    FILTERED_LIST() {
      return this.QUESTMAN.quest_list_filtered(this.filter_value ? this.filter_value : null)
    },
    count_selected() {
      return Object.keys(this.selected).length
    },
  },
  methods: {
    isSelected(key) {
      return this.selected[key] === true
    },
    toggle(key) {
      if (this.selected[key]) delete this.selected[key]
      else this.selected[key] = true
    },
    deselectAll() {
      this.selected = {}
    },
    keywordsOf(key) {
      const kw = this.QUESTMAN.get(key).keywords
      if (!kw) return []
      return kw.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 3)
    },
    gotopreset() {
      const presets = Object.keys(this.selected)
      this.$router.push({
        name: 'preset/id',
        params: { id: JSON.stringify({ presets, mode: 'new_preset' }) },
      })
    },
    gotoquest() {
      const quest_label = Object.keys(this.selected)[0]
      this.$router.push(
        `/quest/${encodeURIComponent(JSON.stringify({ presets: quest_label, mode: 'single' }))}`
      )
    },
  },
}
</script>

<style lang="sass" scoped>
.select-page
  height: 100%

.select-header
  border-bottom: 1px solid $line
  background: $surface

.select-search
  width: 100%
  max-width: 520px

.select-scroll
  min-height: 0
  overflow-y: auto

.select-grid
  max-width: 720px
  margin: 0 auto
  display: flex
  flex-direction: column
  gap: 8px

.select-card
  background: $surface
  border: 1px solid $line
  border-radius: $radius
  box-shadow: $shadow-soft
  transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease
  &:hover
    box-shadow: $shadow-hover
    transform: translateY(-1px)

.select-card--active
  border-color: $primary
  background: rgba($primary, 0.06)

.kw-chip
  font-size: 0.66rem
  margin: 2px 4px 0 0

.select-actions
  border-top: 1px solid $line
  background: $surface
  min-height: 56px
</style>
