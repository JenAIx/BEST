<template>
  <!-- Quick navigation for the unified timeline: one block per visible visit,
       group entries beneath expanded ones. Clicking jumps to the section,
       the scroll spy in the container keeps `active` in sync. -->
  <nav class="quick-nav" data-cy="unified-quick-nav">
    <div v-for="entry in entries" :key="entry.visitId" class="nav-visit" :style="{ top: `${tops[entry.visitId] ?? 0}px` }">
      <div class="nav-visit-label" :class="{ 'nav-active': isActiveVisit(entry), 'nav-visit-label--collapsed': !entry.expanded }" @click="$emit('select-visit', entry.visitId)">
        <q-icon :name="entry.expanded ? 'expand_more' : 'chevron_right'" size="14px" />
        <div class="nav-visit-text">
          <span class="nav-date">{{ entry.label }}</span>
          <span v-if="entry.sublabel" class="nav-type ellipsis">{{ entry.sublabel }}</span>
        </div>
      </div>

      <div
        v-for="group in entry.groups"
        :key="group.name"
        class="nav-group"
        :class="{ 'nav-active': isActiveGroup(entry, group) }"
        @click="$emit('select-group', { visitId: entry.visitId, group: group.name })"
      >
        <q-icon :name="group.icon || 'label_outline'" size="13px" />
        <span class="ellipsis">{{ group.name }}</span>
      </div>
    </div>
  </nav>
</template>

<script setup>
defineOptions({
  name: 'VisitQuickNav',
})

const props = defineProps({
  // [{ visitId, label, sublabel, expanded, groups: [{name, icon}] }]
  entries: { type: Array, default: () => [] },
  // { visitId, group|null } from the container's scroll spy
  active: { type: Object, default: null },
  // visitId → px offset so each entry sits at its card's height
  tops: { type: Object, default: () => ({}) },
})

defineEmits(['select-visit', 'select-group'])

const isActiveVisit = (entry) => props.active != null && props.active.visitId === entry.visitId && !props.active.group

const isActiveGroup = (entry, group) => props.active != null && props.active.visitId === entry.visitId && props.active.group === group.name
</script>

<style lang="scss" scoped>
// Entries are absolutely positioned by the container (visitId → top) so
// every visit name sits at the height of its card in the list
.quick-nav {
  position: relative;
  width: 190px;
  flex-shrink: 0;
  overflow: hidden;
  padding-right: 6px;
  font-size: 0.8rem;
}

.nav-visit {
  position: absolute;
  left: 0;
  right: 6px;
}

.nav-visit-label {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  color: $grey-8;
  padding: 2px 4px;
  border-radius: 4px;

  &:hover {
    background: $blue-1;
  }

  .nav-visit-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .nav-date {
    font-weight: 600;
    line-height: 1.2;
  }

  .nav-type {
    font-size: 0.7rem;
    color: $grey-6;
    line-height: 1.2;
  }

  // Collapsed visits: muted one-liners — reachable, but visually secondary
  &--collapsed {
    color: $grey-6;

    .nav-date {
      font-weight: 500;
    }

    &:hover {
      color: $grey-9;
    }
  }
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: $grey-7;
  padding: 2px 4px 2px 20px;
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  line-height: 1.35;
  min-width: 0;

  &:hover {
    background: $blue-1;
  }
}

.nav-active {
  color: $primary;
  font-weight: 600;

  &.nav-group {
    border-left-color: $primary;
    background: rgba(25, 118, 210, 0.06);
  }

  .nav-type {
    color: $primary;
  }
}
</style>
