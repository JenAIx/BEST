<template>
  <!-- Quick navigation for the unified timeline: ONE flat item list
       (visit rows + group rows), fully precomputed — the template just
       renders items, all state logic lives in the `items` computed. -->
  <nav class="quick-nav" data-cy="unified-quick-nav">
    <template v-for="item in items" :key="item.key">
      <div v-if="item.type === 'visit'" class="nav-visit-label" :class="{ 'nav-active': item.active, 'nav-visit-label--collapsed': !item.expanded }" @click="$emit('select-visit', item.visitId)">
        <q-icon :name="item.expanded ? 'expand_more' : 'chevron_right'" size="14px" />
        <div class="nav-visit-text">
          <span class="nav-date">{{ item.label }}</span>
          <span v-if="item.sublabel" class="nav-type ellipsis">{{ item.sublabel }}</span>
        </div>
      </div>

      <div v-else class="nav-group" :class="{ 'nav-active': item.active }" @click="$emit('select-group', { visitId: item.visitId, group: item.group })">
        <q-icon :name="item.icon" size="13px" />
        <span class="ellipsis">{{ item.label }}</span>
      </div>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({
  name: 'VisitQuickNav',
})

const props = defineProps({
  // [{ visitId, label, sublabel, expanded, groups: [{name, icon}] }]
  entries: { type: Array, default: () => [] },
  // { visitId, group|null } from the container's scroll spy
  active: { type: Object, default: null },
})

defineEmits(['select-visit', 'select-group'])

// Flatten entries into one render-ready list; `active` is resolved here so
// the template stays free of comparison logic
const items = computed(() => {
  const activeVisitId = props.active?.visitId ?? null
  const activeGroup = props.active?.group ?? null

  return props.entries.flatMap((entry) => [
    {
      type: 'visit',
      key: `v-${entry.visitId}`,
      visitId: entry.visitId,
      label: entry.label,
      sublabel: entry.sublabel,
      expanded: entry.expanded,
      active: entry.visitId === activeVisitId && activeGroup === null,
    },
    ...entry.groups.map((group) => ({
      type: 'group',
      key: `g-${entry.visitId}-${group.name}`,
      visitId: entry.visitId,
      group: group.name,
      label: group.name,
      icon: group.icon || 'label_outline',
      active: entry.visitId === activeVisitId && group.name === activeGroup,
    })),
  ])
})
</script>

<style lang="scss" scoped>
// Calm, stable table of contents: fixed order and spacing, the current
// position shows only through the scroll spy's active highlight
.quick-nav {
  width: 190px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 2px 6px 12px 0;
  font-size: 0.8rem;
}

.nav-visit-label {
  margin-top: 18px;

  &:first-child {
    margin-top: 0;
  }

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
