<template>
  <!-- Audit dialog for ONE observation — shared by the visits timeline and
       the data grid. Top: what is being reviewed + current state; middle:
       the trail (flag transitions, comments, value edits); bottom: comment
       input + the flag actions (a comment typed here is attached to the
       flag event). Writes go through observation-store (DB + trail); the
       host mirrors the new flag into its own state via `flag-changed`. -->
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" @show="onShow">
    <q-card class="audit-dialog" data-cy="audit-dialog">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6 text-primary">
          <q-icon name="flag" class="q-mr-sm" />
          {{ $t('visit.auditDialogTitle') }}
        </div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- Subject -->
      <q-card-section class="q-pt-sm">
        <div class="audit-subject">
          <div class="audit-subject__concept ellipsis" :title="observation?.conceptName">{{ observation?.conceptName }}</div>
          <div class="audit-subject__value">
            <span class="text-weight-medium">{{ valueLabel }}</span>
            <span v-if="observation?.unit" class="text-grey-6 q-ml-xs">{{ observation.unit }}</span>
          </div>
          <div class="audit-subject__code">{{ observation?.conceptCode }}</div>
          <q-chip dense size="sm" :color="stateMeta.color" :text-color="stateMeta.textColor" :icon="stateMeta.icon" class="audit-subject__state" data-cy="audit-state">
            {{ $t(stateMeta.label) }}
          </q-chip>
        </div>
      </q-card-section>

      <q-separator />

      <!-- Trail -->
      <q-card-section class="audit-trail">
        <div v-if="loadingTrail" class="row justify-center q-py-md"><q-spinner size="22px" color="primary" /></div>
        <div v-else-if="!trail.length" class="text-grey-6 text-caption text-center q-py-sm">{{ $t('visit.auditTrailEmpty') }}</div>
        <div v-else class="trail-list">
          <div v-for="event in trail" :key="event.AUDIT_ID" class="trail-item" :class="`trail-item--${eventMeta(event).kind}`" :data-cy="`audit-event-${event.EVENT_CD}`">
            <q-icon :name="eventMeta(event).icon" :color="eventMeta(event).color" size="16px" class="trail-item__icon" />
            <div class="trail-item__body">
              <div class="trail-item__head">
                <span class="text-weight-medium">{{ event.CREATED_BY_NAME || event.CREATED_BY || 'SYSTEM' }}</span>
                <span class="text-grey-6">· {{ formatTimestamp(event.CREATED_AT) }}</span>
                <span v-if="event.SOURCESYSTEM_CD === 'GRID'" class="text-grey-5">· Grid</span>
                <q-btn v-if="canDelete(event)" flat round dense size="xs" icon="delete_outline" color="grey-6" class="trail-item__delete" data-cy="audit-comment-delete" @click="removeComment(event)">
                  <q-tooltip>{{ $t('common.delete') }}</q-tooltip>
                </q-btn>
              </div>
              <div class="trail-item__action" :class="`text-${eventMeta(event).color}`">{{ $t(eventMeta(event).label) }}</div>
              <div v-if="event.COMMENT_TEXT" class="trail-item__comment">{{ event.COMMENT_TEXT }}</div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <!-- Comment + actions -->
      <q-card-section class="q-pt-sm">
        <q-input
          v-model="commentText"
          dense
          outlined
          autogrow
          type="textarea"
          maxlength="2000"
          :label="$t('visit.auditCommentPlaceholder')"
          data-cy="audit-comment-input"
          @keydown.ctrl.enter.prevent="submitComment"
          @keydown.meta.enter.prevent="submitComment"
        />
        <div class="row items-center q-gutter-sm q-mt-sm audit-actions">
          <q-btn
            v-for="entry in actions"
            :key="entry.action"
            unelevated
            dense
            no-caps
            :color="ACTION_META[entry.action].color"
            :icon="ACTION_META[entry.action].icon"
            :label="$t(ACTION_META[entry.action].label)"
            :loading="busy"
            :data-cy="`audit-action-${entry.action}`"
            @click="applyFlag(entry.flag)"
          />
          <q-space />
          <q-btn flat dense no-caps color="primary" icon="add_comment" :label="$t('visit.auditAddComment')" :disable="!commentText.trim() || busy" data-cy="audit-comment-submit" @click="submitComment" />
        </div>
        <div class="text-caption text-grey-6 q-mt-xs">{{ $t('visit.auditCommentHint') }}</div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useObservationStore } from 'src/stores/observation-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useNotify } from 'src/composables/useNotify'
import { readValueFlag, auditActionsFor } from 'src/shared/utils/audit-flag.js'

defineOptions({ name: 'ObservationAuditDialog' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /**
   * { observationId, conceptName, conceptCode, displayValue, unit, valueType,
   *   valueFlag } — the timeline passes its transformed observation, the grid
   * builds the same shape from its cell.
   */
  observation: { type: Object, default: null },
  /** 'VISITS' | 'GRID' — recorded as SOURCESYSTEM_CD on trail rows */
  source: { type: String, default: 'VISITS' },
})

const emit = defineEmits(['update:modelValue', 'flag-changed', 'comment-added'])

const { t, locale } = useI18n()
const observationStore = useObservationStore()
const authStore = useAuthStore()
const notify = useNotify()

const ACTION_META = {
  mark: { icon: 'flag', color: 'negative', label: 'dataGrid.markForAudit' },
  resolve: { icon: 'check_circle', color: 'positive', label: 'dataGrid.resolveAudit' },
  clear: { icon: 'outlined_flag', color: 'grey-7', label: 'dataGrid.clearAuditFlag' },
}

const STATE_META = {
  AUDIT: { icon: 'flag', color: 'negative', textColor: 'white', label: 'visit.flagAudit' },
  CONFIRMED: { icon: 'check_circle', color: 'positive', textColor: 'white', label: 'visit.flagConfirmed' },
  NV: { icon: 'block', color: 'grey-4', textColor: 'grey-9', label: 'dataGrid.markAsNoValue' },
  none: { icon: 'outlined_flag', color: 'grey-3', textColor: 'grey-8', label: 'visit.auditNoFlag' },
}

// Local copy of the flag so the dialog reflects a transition immediately,
// whichever store the host uses
const currentFlag = ref(null)
const observationId = computed(() => props.observation?.observationId ?? null)
const stateMeta = computed(() => STATE_META[currentFlag.value] || STATE_META.none)
const actions = computed(() => auditActionsFor(currentFlag.value))
const valueLabel = computed(() => {
  const v = props.observation?.displayValue
  return v == null || v === '' || v === 'No value' ? '∅' : String(v)
})

const trail = computed(() => (observationId.value == null ? [] : observationStore.auditTrailFor(observationId.value)))
const loadingTrail = ref(false)
const busy = ref(false)
const commentText = ref('')

const onShow = async () => {
  currentFlag.value = readValueFlag(props.observation)
  commentText.value = ''
  if (observationId.value == null) return
  loadingTrail.value = true
  try {
    await observationStore.loadAuditTrailForObservation(observationId.value)
  } catch (error) {
    notify.error(error.message || t('observation.saveFailed'))
  } finally {
    loadingTrail.value = false
  }
}

const eventMeta = (event) => {
  if (event.EVENT_CD === 'COMMENT') return { kind: 'comment', icon: 'chat_bubble_outline', color: 'primary', label: 'visit.auditEvent.comment' }
  if (event.EVENT_CD === 'VALUE_EDIT') return { kind: 'edit', icon: 'edit', color: 'orange-8', label: 'visit.auditEvent.valueEdit' }
  switch (event.FLAG_CD) {
    case 'AUDIT':
      return { kind: 'flag', icon: 'flag', color: 'negative', label: 'visit.auditEvent.mark' }
    case 'CONFIRMED':
      return { kind: 'flag', icon: 'check_circle', color: 'positive', label: 'visit.auditEvent.resolve' }
    case 'NV':
      return { kind: 'flag', icon: 'block', color: 'grey-7', label: 'visit.auditEvent.nv' }
    default:
      return { kind: 'flag', icon: 'outlined_flag', color: 'grey-7', label: 'visit.auditEvent.clear' }
  }
}

const formatTimestamp = (iso) => {
  if (!iso) return ''
  // SQLite datetime('now') is UTC without a zone marker
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(String(locale.value).startsWith('en') ? 'en-GB' : 'de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

const canDelete = (event) => event.EVENT_CD === 'COMMENT' && (authStore.isAdmin || event.CREATED_BY === authStore.providerId)

const applyFlag = async (flag) => {
  if (observationId.value == null) return
  busy.value = true
  try {
    const comment = commentText.value.trim() || null
    await observationStore.setObservationFlag({ observationId: observationId.value, flag, comment, source: props.source })
    currentFlag.value = flag
    commentText.value = ''
    emit('flag-changed', { observationId: observationId.value, flag })
  } catch (error) {
    notify.error(error.message || t('observation.saveFailed'))
  } finally {
    busy.value = false
  }
}

const submitComment = async () => {
  if (observationId.value == null || !commentText.value.trim()) return
  busy.value = true
  try {
    await observationStore.addAuditComment({ observationId: observationId.value, text: commentText.value })
    commentText.value = ''
    emit('comment-added', { observationId: observationId.value })
  } catch (error) {
    notify.error(error.message || t('observation.saveFailed'))
  } finally {
    busy.value = false
  }
}

const removeComment = async (event) => {
  try {
    await observationStore.deleteAuditComment({ observationId: observationId.value, auditId: event.AUDIT_ID })
  } catch (error) {
    notify.error(error.message || t('observation.saveFailed'))
  }
}
</script>

<style lang="scss" scoped>
.audit-dialog {
  width: 520px;
  max-width: 92vw;
}

.audit-subject {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'concept state'
    'value state'
    'code state';
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;

  &__concept {
    grid-area: concept;
    font-weight: 600;
  }

  &__value {
    grid-area: value;
    font-size: 1.05rem;
  }

  &__code {
    grid-area: code;
    font-family: monospace;
    font-size: 0.72rem;
    color: $grey-6;
  }

  &__state {
    grid-area: state;
  }
}

.audit-trail {
  max-height: 320px;
  overflow-y: auto;
}

.trail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trail-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;

  &__icon {
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__body {
    min-width: 0;
    flex: 1;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    flex-wrap: wrap;
  }

  &__delete {
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &:hover &__delete {
    opacity: 1;
  }

  &__action {
    font-size: 0.75rem;
  }

  &__comment {
    margin-top: 3px;
    padding: 6px 8px;
    background: $grey-2;
    border-radius: 6px;
    font-size: 0.85rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.audit-actions {
  flex-wrap: wrap;
}
</style>
