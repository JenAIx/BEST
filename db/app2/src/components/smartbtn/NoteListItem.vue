<template>
  <q-item class="note-list-item">
    <q-item-section>
      <q-item-label :lines="compact ? 2 : 4" class="note-text">{{ note.NOTE_TEXT || note.NAME_CHAR }}</q-item-label>
      <q-item-label caption>{{ formattedDate }}</q-item-label>
    </q-item-section>
    <!-- Context chip top-right (saves a caption line), actions below it -->
    <q-item-section side top>
      <div class="column items-end q-gutter-xs">
        <q-chip v-if="contextTarget" dense size="sm" clickable :icon="contextTarget.icon" color="blue-1" text-color="primary" class="q-ma-none" @click.stop="$emit('open-context', contextTarget)">
          {{ contextTarget.label }}
          <q-tooltip>{{ $t('smartButton.quickNotes.openContext') }}</q-tooltip>
        </q-chip>
        <div v-if="!compact" class="row no-wrap">
          <q-btn icon="edit" size="sm" flat round dense color="grey-7" @click="$emit('edit', note)">
            <q-tooltip>{{ $t('smartButton.quickNotes.edit') }}</q-tooltip>
          </q-btn>
          <q-btn icon="delete" size="sm" flat round dense color="grey-7" @click="$emit('remove', note)">
            <q-tooltip>{{ $t('smartButton.quickNotes.delete') }}</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-item-section>
  </q-item>
</template>

<script setup>
import { computed } from 'vue'
import { resolveContextTarget } from 'src/shared/utils/note-context'

defineOptions({
  name: 'NoteListItem',
})

const props = defineProps({
  note: { type: Object, required: true },
  compact: { type: Boolean, default: false },
})

defineEmits(['open-context', 'edit', 'remove'])

const contextTarget = computed(() => resolveContextTarget(props.note))

const formattedDate = computed(() => {
  const raw = props.note.IMPORT_DATE
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString()
})
</script>

<style lang="scss" scoped>
.note-text {
  white-space: pre-line;
}
</style>
