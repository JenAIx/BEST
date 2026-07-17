<template>
  <!-- One collapsible visit card in the unified timeline. Dumb component:
       labels/status arrive pre-resolved via props, all actions bubble up. -->
  <div class="unified-card visit-block" :class="[statusMeta.cssClass, { 'visit-block--editing': editing }]" data-cy="unified-card">
    <!-- Header: click toggles expand/collapse -->
    <div class="visit-block-header row items-center q-gutter-sm" data-cy="unified-card-header" @click="$emit('toggle')">
      <q-icon :name="expanded || editing ? 'expand_more' : 'chevron_right'" color="grey-6" size="20px" />
      <span class="visit-date">{{ formatDate(visit.date) }}</span>
      <q-chip dense size="sm" outline :color="typeMeta.color || 'primary'" :icon="typeMeta.icon">
        {{ typeMeta.label }}
      </q-chip>
      <q-chip v-if="statusMeta.label && statusMeta.label !== 'Unknown'" dense size="sm" outline :color="statusMeta.color || 'grey'">
        {{ statusMeta.label }}
      </q-chip>
      <q-chip v-if="editing" dense size="sm" color="primary" text-color="white" icon="edit" data-cy="unified-card-editing-chip">
        {{ $t('visit.editingChip') }}
      </q-chip>
      <q-space />
      <span class="text-caption text-grey-6">{{ $t('visit.observationCount', { count: observationCount }) }}</span>

      <!-- Editing: single "done" affordance -->
      <q-btn v-if="editing" unelevated dense no-caps color="primary" icon="check" :label="$t('visit.finishEditing')" data-cy="unified-card-finish" @click.stop="$emit('finish')" />

      <!-- Read mode: edit shortcut + 3-dot menu -->
      <template v-else>
        <q-btn flat round dense size="sm" icon="edit" color="primary" data-cy="unified-card-edit" @click.stop="$emit('edit')">
          <q-tooltip>{{ $t('visit.editVisit') }}</q-tooltip>
        </q-btn>
        <q-btn flat round dense size="sm" icon="more_vert" color="grey-7" data-cy="unified-card-menu" @click.stop>
          <q-menu>
            <q-list dense style="min-width: 190px">
              <q-item v-close-popup clickable data-cy="unified-menu-edit" @click="$emit('edit')">
                <q-item-section avatar><q-icon name="edit" size="18px" /></q-item-section>
                <q-item-section>{{ $t('visit.editVisit') }}</q-item-section>
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
    <div v-show="expanded || editing">
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
import { formatDate } from 'src/shared/utils/medical-utils.js'
import VisitSummaryObservations from '../VisitSummaryObservations.vue'

defineOptions({
  name: 'VisitUnifiedCard',
})

defineProps({
  visit: { type: Object, required: true },
  categorizedObservations: { type: Array, default: () => [] },
  observationCount: { type: Number, default: 0 },
  expanded: { type: Boolean, default: false },
  editing: { type: Boolean, default: false },
  typeMeta: { type: Object, required: true },
  statusMeta: { type: Object, required: true },
})

defineEmits(['toggle', 'edit', 'clone', 'delete', 'finish', 'preview-file', 'preview-questionnaire'])
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
}

.visit-block {
  background: white;
  border: 1px solid $grey-4;
  border-radius: 8px;
  overflow: hidden;

  // The editing card is clearly marked; sticky sidebar needs visible overflow
  &--editing {
    border: 2px solid $primary;
    box-shadow: 0 4px 16px rgba(25, 118, 210, 0.18);
    overflow: visible;

    &::before {
      background: $primary !important;
      box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.25) !important;
    }

    // Pinned while scrolling through the editor so the visit (and the
    // Fertig button) stays visible — the view header row is hidden then
    .visit-block-header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: $blue-1;
      border-bottom-color: rgba(25, 118, 210, 0.25);
      border-radius: 6px 6px 0 0;
    }
  }

}

.visit-block-header {
  padding: 10px 16px;
  background: $grey-2;
  border-bottom: 1px solid $grey-4;
  cursor: pointer;

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
</style>
