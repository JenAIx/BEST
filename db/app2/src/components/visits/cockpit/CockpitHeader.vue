<template>
  <!-- Compact header row: last visit, today's visit / start button with
       template choice, record search, actions. -->
  <div class="cockpit-header" data-cy="cockpit-header">
    <div class="cockpit-header__last">
      <q-icon name="history" size="16px" color="grey-6" />
      <template v-if="lastVisit">
        <span class="text-weight-medium">{{ $t('visit.cockpit.lastVisit') }}:</span>
        <a class="cockpit-header__link" @click="$emit('open-timeline', lastVisit)">{{ fmtDate(lastVisit.date) }}</a>
        <span class="text-grey-7">· {{ lastVisitLabel }}</span>
        <q-badge :color="staleColor" outline :label="$t('visit.cockpit.daysAgo', { n: daysSince })">
          <q-tooltip v-if="stale">{{ $t('visit.cockpit.stale') }}</q-tooltip>
        </q-badge>
      </template>
      <span v-else class="text-grey-6">{{ $t('visit.cockpit.noLastVisit') }}</span>
    </div>

    <div class="cockpit-header__today">
      <template v-if="todayVisit">
        <q-icon name="today" size="16px" color="primary" />
        <span class="text-weight-medium">{{ $t('visit.cockpit.today') }} {{ fmtDate(todayVisit.date) }}</span>
        <q-select :model-value="templateCode" dense borderless emit-value map-options :options="templateOptions" class="cockpit-header__template" data-cy="cockpit-template" @update:model-value="$emit('change-template', $event)">
          <template #selected-item="scope"><q-chip dense size="sm" :color="scope.opt.color" text-color="white" :icon="scope.opt.icon">{{ scope.opt.label }}</q-chip></template>
        </q-select>
        <q-badge v-if="todayMatch === 'other-template'" color="orange-8" outline>{{ $t('visit.cockpit.otherTemplate', { name: templateLabel }) }}</q-badge>
      </template>
      <template v-else-if="todayMatch === 'visit-type' && adoptable">
        <q-btn dense no-caps unelevated color="primary" icon="playlist_add_check" :label="$t('visit.cockpit.adoptVisit')" data-cy="cockpit-adopt" @click="$emit('adopt')">
          <q-tooltip>{{ $t('visit.cockpit.adoptHint') }}</q-tooltip>
        </q-btn>
      </template>
      <template v-else>
        <q-btn-dropdown dense no-caps unelevated split color="primary" icon="play_arrow" :label="$t('visit.cockpit.startVisitWith', { name: templateLabel })" data-cy="cockpit-start" @click="$emit('start', templateCode)">
          <q-list dense>
            <q-item v-for="t in templates" :key="t.code" clickable v-close-popup :data-cy="`cockpit-start-${t.code}`" @click="$emit('start', t.code)">
              <q-item-section avatar><q-icon :name="t.icon" :color="t.color" size="18px" /></q-item-section>
              <q-item-section>{{ t.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <span class="text-caption text-grey-6">{{ $t('visit.cockpit.readOnlyHint') }}</span>
      </template>
    </div>

    <div class="cockpit-header__search">
      <q-input ref="searchRef" v-model="term" dense outlined clearable debounce="250" :placeholder="$t('visit.cockpit.searchPlaceholder')" data-cy="cockpit-search" @update:model-value="onSearch" @keydown.esc="term = ''">
        <template #prepend><q-icon name="search" size="18px" /></template>
        <q-menu v-model="showResults" no-focus no-refocus fit anchor="bottom left" self="top left" :offset="[0, 4]">
          <q-list dense style="min-width: 360px; max-width: 520px">
            <q-item v-if="!results.length"><q-item-section class="text-grey-6">{{ $t('visit.cockpit.noHits') }}</q-item-section></q-item>
            <q-item v-for="(hit, i) in results.slice(0, 12)" :key="i" clickable v-close-popup @click="$emit('hit', hit)">
              <q-item-section avatar><q-icon :name="hitIcon(hit.kind)" size="16px" color="grey-7" /></q-item-section>
              <q-item-section>
                <q-item-label class="ellipsis">{{ hit.snippet }}</q-item-label>
                <q-item-label caption>{{ fmtDate(hit.visitDate) }} · {{ hit.kind }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-input>
    </div>

    <div class="cockpit-header__actions">
      <q-btn flat dense no-caps color="primary" icon="description" :label="$t('visit.cockpit.letter')" :disable="!todayVisit" data-cy="cockpit-letter" @click="$emit('letter')">
        <q-tooltip>{{ todayVisit ? $t('visit.cockpit.letter') : $t('visit.cockpit.readOnlyHint') }}</q-tooltip>
      </q-btn>
      <q-btn flat dense no-caps color="grey-8" icon="timeline" :label="$t('visit.cockpit.openTimeline')" data-cy="cockpit-timeline" @click="$emit('open-timeline', todayVisit || lastVisit)" />
      <q-btn flat round dense icon="keyboard" color="grey-6" size="sm"><q-tooltip>{{ $t('visit.cockpit.kbdHelp') }}</q-tooltip></q-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  lastVisit: { type: Object, default: null },
  lastVisitLabel: { type: String, default: '' },
  daysSince: { type: Number, default: null },
  stale: { type: Boolean, default: false },
  todayVisit: { type: Object, default: null },
  todayMatch: { type: String, default: 'none' },
  adoptable: { type: Boolean, default: false },
  templates: { type: Array, default: () => [] },
  templateCode: { type: String, default: null },
  search: { type: Function, default: null },
})
defineEmits(['start', 'adopt', 'change-template', 'hit', 'letter', 'open-timeline'])

const searchRef = ref(null)
const term = ref('')
const results = ref([])
const showResults = ref(false)

const templateOptions = computed(() => props.templates.map((t) => ({ label: t.label, value: t.code, icon: t.icon, color: t.color })))
const templateLabel = computed(() => props.templates.find((t) => t.code === props.templateCode)?.label || '')
const staleColor = computed(() => (props.daysSince == null ? 'grey' : props.stale ? 'negative' : props.daysSince > 120 ? 'orange-8' : 'grey-7'))

const onSearch = async (val) => {
  const t = String(val || '').trim()
  if (t.length < 2 || !props.search) {
    results.value = []
    showResults.value = false
    return
  }
  results.value = await props.search(t)
  showResults.value = true
}
const hitIcon = (kind) => ({ text: 'notes', medication: 'medication', diagnosis: 'medical_information', note: 'sticky_note_2', letter: 'description' })[kind] || 'search'
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || ''
}
const focusSearch = () => searchRef.value?.focus?.()
defineExpose({ focusSearch })
</script>

<style lang="scss" scoped>
.cockpit-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  align-items: center;
  padding: 6px 0 10px;
  border-bottom: 1px solid $grey-3;
  margin-bottom: 10px;

  &__last,
  &__today {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  &__link {
    color: $primary;
    cursor: pointer;
    text-decoration: underline dotted;
  }

  &__template {
    min-width: 200px;
  }

  &__search {
    flex: 1 1 240px;
    min-width: 200px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}

</style>
