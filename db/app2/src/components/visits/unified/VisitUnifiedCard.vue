<template>
  <!-- One collapsible visit card in the unified timeline. Dumb component:
       labels/status arrive pre-resolved via props, all actions bubble up. -->
  <div class="unified-card visit-block" :class="[statusMeta.cssClass, { 'visit-block--editing': editing }]" data-cy="unified-card" :data-visit-id="visit.id">
    <!-- Header: click toggles expand/collapse; pinned while scrolling
         through the expanded body -->
    <div class="visit-block-header row items-center q-gutter-sm" :class="{ 'visit-block-header--collapsed': !isOpen }" data-cy="unified-card-header" @click="$emit('toggle')">
      <q-icon :name="isOpen ? 'expand_more' : 'chevron_right'" color="grey-6" size="20px" />
      <span class="visit-date">{{ formatDate(visit.date) }}</span>
      <q-chip dense size="sm" outline :color="typeMeta.color || 'primary'" :icon="typeMeta.icon">
        {{ typeMeta.label }}
      </q-chip>
      <!-- Visit note: subtle marker, full text on header hover -->
      <q-icon v-if="visit.notes" name="sticky_note_2" size="14px" color="grey-5" />
      <q-tooltip v-if="visit.notes" :delay="350" max-width="380px">
        <div class="note-tooltip">{{ visit.notes }}</div>
      </q-tooltip>
      <q-chip v-if="editing" dense size="sm" color="primary" text-color="white" icon="edit" data-cy="unified-card-editing-chip">
        {{ $t('visit.editingChip') }}
      </q-chip>
      <q-space />
      <span class="text-caption text-grey-6">{{ $t('visit.observationCount', { count: observationCount }) }}</span>

      <!-- Editing: visit metadata (date/type/status) + "done" -->
      <template v-if="editing">
        <q-btn flat round dense size="sm" icon="edit_calendar" color="primary" data-cy="editor-edit-meta" @click.stop="$emit('edit-meta')">
          <q-tooltip>{{ $t('visit.editVisitDetails') }}</q-tooltip>
        </q-btn>
        <q-btn unelevated dense no-caps color="primary" icon="check" :label="$t('visit.finishEditing')" data-cy="unified-card-finish" @click.stop="$emit('finish')" />
      </template>

      <!-- Read mode: edit shortcut + 3-dot menu -->
      <template v-if="!editing">
        <q-btn flat round dense size="sm" icon="edit" color="primary" data-cy="unified-card-edit" @click.stop="$emit('edit')">
          <q-tooltip>{{ $t('visit.editVisit') }}</q-tooltip>
        </q-btn>
        <q-btn flat round dense size="sm" icon="more_vert" color="grey-7" data-cy="unified-card-menu" @click.stop>
          <q-menu>
            <q-list dense style="min-width: 190px">
              <q-item v-close-popup clickable data-cy="unified-menu-edit-meta" @click="$emit('edit-meta')">
                <q-item-section avatar><q-icon name="edit_calendar" size="18px" /></q-item-section>
                <q-item-section>{{ $t('visit.editVisitDetails') }}</q-item-section>
              </q-item>
              <q-item v-close-popup clickable data-cy="unified-menu-clone" @click="$emit('clone')">
                <q-item-section avatar><q-icon name="content_copy" size="18px" /></q-item-section>
                <q-item-section>{{ $t('visit.cloneVisit') }}</q-item-section>
              </q-item>
              <q-separator />
              <q-item v-close-popup clickable class="text-negative" data-cy="unified-menu-delete" @click="$emit('delete')">
                <q-item-section avatar><q-icon name="delete" size="18px" color="negative" /></q-item-section>
                <q-item-section>{{ $t('visit.deleteVisit') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </template>
    </div>

    <!-- Body: results table (read) or the inline editor provided by the container -->
    <div v-show="isOpen">
      <slot v-if="editing" name="editor" />
      <template v-else>
        <div v-if="categorizedObservations.length > 0" class="visit-block-body">
          <VisitSummaryObservations
            :categorized-observations="categorizedObservations"
            @preview-file="$emit('preview-file', $event)"
            @preview-questionnaire="$emit('preview-questionnaire', $event)"
          />
        </div>
        <div v-else class="visit-block-empty text-caption text-grey-6">{{ $t('visit.noObservationsShort') }}</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatDate } from 'src/shared/utils/medical-utils.js'
import VisitSummaryObservations from '../VisitSummaryObservations.vue'

defineOptions({
  name: 'VisitUnifiedCard',
})

const props = defineProps({
  visit: { type: Object, required: true },
  categorizedObservations: { type: Array, default: () => [] },
  observationCount: { type: Number, default: 0 },
  expanded: { type: Boolean, default: false },
  editing: { type: Boolean, default: false },
  typeMeta: { type: Object, required: true },
  statusMeta: { type: Object, required: true },
})

defineEmits(['toggle', 'edit', 'edit-meta', 'clone', 'delete', 'finish', 'preview-file', 'preview-questionnaire'])

// The card body is open in exactly two states: expanded (read) or editing
const isOpen = computed(() => props.expanded || props.editing)
</script>

<style lang="scss" scoped>
.unified-card {
  position: relative;
  margin-bottom: 12px;

  // Status dot on the timeline rail (rail line lives on .unified-list)
  &::before {
    content: '';
    position: absolute;
    left: -32px;
    top: 13px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: $grey-5;
    box-shadow: 0 0 0 4px rgba($grey-5, 0.2);
  }

  &.status-active::before {
    background: $negative;
    box-shadow: 0 0 0 4px rgba($negative, 0.2);
  }

  &.status-completed::before {
    background: $positive;
    box-shadow: 0 0 0 4px rgba($positive, 0.2);
  }

  &.status-cancelled::before {
    background: $grey-5;
    box-shadow: 0 0 0 4px rgba($grey-5, 0.2);
  }

  // Status shows through the card itself instead of a chip:
  // completed → subtle green header tint, inactive/cancelled → deactivated look
  &.status-completed:not(.visit-block--editing) .visit-block-header {
    background: rgba(76, 175, 80, 0.09);
    border-bottom-color: rgba(76, 175, 80, 0.25);

    &:hover {
      background: $blue-1;
    }
  }

  &.status-cancelled:not(.visit-block--editing) {
    opacity: 0.65;

    .visit-date {
      color: $grey-6;
    }
  }
}

.visit-block {
  background: white;
  border: 1px solid $grey-4;
  border-radius: 8px;
  // visible (not hidden): the sticky header must escape the card's box
  overflow: visible;

  // The editing card is clearly marked
  &--editing {
    border: 2px solid $primary;
    box-shadow: 0 4px 16px rgba(25, 118, 210, 0.18);

    &::before {
      background: $primary !important;
      box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.25) !important;
    }

    .visit-block-header {
      z-index: 20;
      background: $blue-1;
      border-bottom-color: rgba(25, 118, 210, 0.25);
    }
  }
}

// Pinned at the top of the scroll area while its (expanded) card passes —
// date, type chip and the edit/Fertig buttons stay visible when scrolling
.visit-block-header {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 10px 16px;
  background: $grey-2;
  border-bottom: 1px solid $grey-4;
  border-radius: 7px 7px 0 0;
  cursor: pointer;

  &--collapsed {
    border-radius: 7px;
    border-bottom: none;
  }

  &:hover {
    background: $blue-1;
  }

  .visit-date {
    font-weight: 600;
    color: $grey-9;
  }
}

.visit-block-body {
  padding: 12px 16px 4px;

  // Denser than the dialog version (same overrides as the compact summary)
  :deep(.category-section) {
    margin-bottom: 16px !important;
  }

  :deep(.category-header h6) {
    font-size: 0.95rem;
  }
}

.visit-block-empty {
  padding: 10px 16px;
}

.note-tooltip {
  white-space: pre-wrap;
  font-size: 0.8rem;
}
</style>
