<template>
  <!-- One text section: today's textarea (autosave) beside the reference pane
       with the earlier texts of the same concept (pager + "Übernehmen"). -->
  <div class="text-section" :class="{ 'text-section--strip': referenceMode === 'strip' }" :data-cy="`text-${section.code}`">
    <div class="text-section__today">
      <div class="text-section__label">
        <span>{{ section.label }}</span>
        <q-chip v-if="section.carried" dense size="xs" color="blue-1" text-color="primary" icon="content_copy" class="q-ml-xs">{{ $t('visit.cockpit.carriedFrom', { date: fmtDate(section.history[0]?.visitDate) }) }}</q-chip>
        <q-space />
        <transition name="fade">
          <q-icon v-if="feedback === 'saved'" name="check_circle" color="positive" size="16px" />
          <q-btn v-else-if="feedback === 'revert'" flat round dense size="xs" icon="undo" color="orange-8" @click="revert">
            <q-tooltip>{{ $t('visit.cockpit.undo') }}</q-tooltip>
          </q-btn>
        </transition>
      </div>
      <q-input
        ref="inputRef"
        v-model="draft"
        type="textarea"
        outlined
        autogrow
        dense
        :disable="!editable"
        :placeholder="editable ? '' : $t('visit.cockpit.placeholderStart')"
        class="text-section__input"
        :data-cy="`text-input-${section.code}`"
        @update:model-value="onInput"
        @blur="flush"
        @keydown.ctrl.enter.prevent="flushAndNext"
        @keydown.alt.u.prevent="carry('replace')"
      />
    </div>

    <div v-if="section.history.length" class="text-section__ref" :data-cy="`text-ref-${section.code}`">
      <div class="text-section__ref-head">
        <q-btn flat round dense size="xs" icon="chevron_left" :disable="index >= section.history.length - 1" @click="index++" />
        <span class="text-caption">{{ fmtDate(current.visitDate) }}</span>
        <q-btn flat round dense size="xs" icon="chevron_right" :disable="index <= 0" @click="index--" />
        <span class="text-caption text-grey-5">{{ index + 1 }}/{{ section.history.length }}</span>
        <q-space />
        <q-btn v-if="editable" flat dense no-caps size="sm" color="primary" :icon="draft.trim() ? 'playlist_add' : 'south_west'" :label="draft.trim() ? $t('visit.cockpit.append') : $t('visit.cockpit.carryForward')" :data-cy="`text-carry-${section.code}`" @click="carry(draft.trim() ? 'append' : 'replace')" />
      </div>
      <div class="text-section__ref-body" v-html="highlighted" />
    </div>
    <div v-else class="text-section__ref text-section__ref--empty text-caption text-grey-5">{{ $t('visit.cockpit.noPrevious') }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  section: { type: Object, required: true }, // {code, label, current, history[], carried}
  editable: { type: Boolean, default: false },
  referenceMode: { type: String, default: 'side' },
  highlight: { type: String, default: '' },
  focusVisitId: { type: Number, default: null }, // jump the reference pane to this visit
})
const emit = defineEmits(['save', 'carry-forward', 'next'])

const inputRef = ref(null)
const draft = ref(props.section.current?.value || '')
const index = ref(0)
const feedback = ref(null)
let debounce = null
let t1 = null
let t2 = null
let lastSaved = props.section.current?.value || ''
let previousValue = null

watch(
  () => props.section.current?.value,
  (v) => {
    if ((v || '') !== draft.value && !debounce) {
      draft.value = v || ''
      lastSaved = v || ''
    }
  },
)
watch(
  () => props.focusVisitId,
  (id) => {
    if (id == null) return
    const i = props.section.history.findIndex((h) => h.encounterNum === id)
    if (i >= 0) index.value = i
  },
  { immediate: true },
)
watch(
  () => props.section.history.length,
  () => {
    if (index.value >= props.section.history.length) index.value = 0
  },
)

const current = computed(() => props.section.history[index.value] || props.section.history[0] || {})
const highlighted = computed(() => {
  const text = escapeHtml(current.value.value || '')
  const term = String(props.highlight || '').trim()
  if (!term) return text.replace(/\n/g, '<br>')
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return text.replace(re, (m) => `<mark>${m}</mml>`.replace('</mml>', '</mark>')).replace(/\n/g, '<br>')
})

const onInput = () => {
  if (!props.editable) return
  clearTimeout(debounce)
  debounce = setTimeout(flush, 1500)
}

const flush = async () => {
  clearTimeout(debounce)
  debounce = null
  if (!props.editable || draft.value === lastSaved) return
  previousValue = lastSaved
  const value = draft.value
  await emit('save', { code: props.section.code, value })
  lastSaved = value
  showFeedback()
}

const flushAndNext = async () => {
  await flush()
  emit('next', props.section.code)
}

const showFeedback = () => {
  clearTimeout(t1)
  clearTimeout(t2)
  feedback.value = 'saved'
  t1 = setTimeout(() => {
    feedback.value = 'revert'
    t2 = setTimeout(() => (feedback.value = null), 7500)
  }, 2500)
}

const revert = async () => {
  if (previousValue == null) return
  draft.value = previousValue
  await emit('save', { code: props.section.code, value: previousValue })
  lastSaved = previousValue
  previousValue = null
  feedback.value = null
}

const carry = (mode) => {
  if (!props.editable || !current.value?.observationId) return
  emit('carry-forward', { code: props.section.code, mode, fromObservationId: current.value.observationId })
}

const focus = () => inputRef.value?.focus?.()
defineExpose({ focus, flush })

onBeforeUnmount(() => {
  clearTimeout(debounce)
  clearTimeout(t1)
  clearTimeout(t2)
})

const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || ''
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
</script>

<style lang="scss" scoped>
.text-section {
  display: grid;
  grid-template-columns: 55fr 45fr;
  gap: 10px;
  margin-bottom: 12px;

  &--strip {
    grid-template-columns: 1fr;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    font-weight: 600;
    color: $grey-8;
    margin-bottom: 3px;
    min-height: 22px;
  }

  &__input :deep(textarea) {
    min-height: 72px;
    max-height: 40vh;
    font-size: 0.9rem;
    line-height: 1.45;
  }

  &__ref {
    border: 1px solid $grey-3;
    border-radius: 6px;
    background: $grey-1;
    padding: 4px 8px 8px;
    min-width: 0;

    &--empty {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  &__ref-head {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 26px;
  }

  &__ref-body {
    font-size: 0.85rem;
    line-height: 1.45;
    color: $grey-8;
    white-space: normal;
    word-break: break-word;
    max-height: 40vh;
    overflow-y: auto;

    :deep(mark) {
      background: $yellow-3;
      padding: 0 1px;
    }
  }

  &--strip &__ref-body {
    max-height: 3.1em;
    overflow: hidden;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1000px) {
  .text-section {
    grid-template-columns: 1fr;
  }
}
</style>
