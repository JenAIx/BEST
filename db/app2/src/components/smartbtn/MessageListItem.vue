<template>
  <q-item class="message-list-item" :class="{ 'message-unread': isUnread }">
    <q-item-section>
      <q-item-label caption class="row items-center q-gutter-xs">
        <q-icon :name="isBroadcast ? 'campaign' : incoming ? 'call_received' : 'call_made'" size="14px" :color="incoming ? 'primary' : 'grey-6'" />
        <span class="text-weight-medium">{{ directionLabel }}</span>
        <span class="text-grey-6">{{ formattedDate }}</span>
        <q-badge v-if="isUnread" color="red" rounded />
      </q-item-label>
      <q-item-label v-if="blob.replyToId" caption class="text-grey-6"> ↪ {{ $t('smartButton.messages.replyTo') }}: {{ replyToTitle }} </q-item-label>
      <q-item-label lines="4" class="message-text">{{ note.NOTE_TEXT || note.NAME_CHAR }}</q-item-label>
    </q-item-section>
    <!-- Context chip top-right (saves a caption line), actions below it -->
    <q-item-section side top>
      <div class="column items-end q-gutter-xs">
        <q-chip v-if="contextTarget" dense size="sm" clickable :icon="contextTarget.icon" color="blue-1" text-color="primary" class="q-ma-none" @click.stop="$emit('open-context', contextTarget)">
          {{ contextTarget.label }}
          <q-tooltip>{{ $t('smartButton.quickNotes.openContext') }}</q-tooltip>
        </q-chip>
        <div class="row no-wrap">
          <q-btn v-if="incoming" icon="reply" size="sm" flat round dense color="primary" @click="$emit('reply', note)">
            <q-tooltip>{{ $t('smartButton.messages.reply') }}</q-tooltip>
          </q-btn>
          <!-- Broadcasts are one shared row: only the sender may delete -->
          <q-btn v-if="!isBroadcast || !incoming" icon="delete" size="sm" flat round dense color="grey-7" @click="$emit('remove', note)">
            <q-tooltip>{{ $t('smartButton.messages.confirmDeleteTitle') }}</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-item-section>
  </q-item>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveContextTarget, parseNoteBlob } from 'src/shared/utils/note-context'

defineOptions({
  name: 'MessageListItem',
})

const props = defineProps({
  note: { type: Object, required: true },
  currentUserCd: { type: String, required: true },
  // Optional lookup: NOTE_ID → title of the replied-to message
  replyTitles: { type: Object, default: () => ({}) },
})

defineEmits(['open-context', 'reply', 'remove'])

const { t } = useI18n()

const blob = computed(() => parseNoteBlob(props.note.NOTE_BLOB))
const isBroadcast = computed(() => blob.value.to === '*')
const incoming = computed(() => blob.value.to === props.currentUserCd || (isBroadcast.value && blob.value.from !== props.currentUserCd))
const isUnread = computed(() => {
  if (!incoming.value) return false
  if (isBroadcast.value) return !(blob.value.readBy || []).includes(props.currentUserCd)
  return !blob.value.readAt
})

const directionLabel = computed(() => {
  if (isBroadcast.value) {
    return incoming.value ? `${t('smartButton.messages.from')} ${blob.value.from} · ${t('smartButton.messages.toAll')}` : t('smartButton.messages.toAll')
  }
  return incoming.value ? `${t('smartButton.messages.from')} ${blob.value.from}` : `${t('smartButton.messages.to')} ${blob.value.to}`
})
const contextTarget = computed(() => resolveContextTarget(props.note))
const replyToTitle = computed(() => props.replyTitles[blob.value.replyToId] || `#${blob.value.replyToId}`)

const formattedDate = computed(() => {
  const raw = props.note.IMPORT_DATE
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString()
})
</script>

<style lang="scss" scoped>
.message-list-item {
  &.message-unread {
    background: rgba(25, 118, 210, 0.04);
  }
}

.message-text {
  white-space: pre-line;
}
</style>
