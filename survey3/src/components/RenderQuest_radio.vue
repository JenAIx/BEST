<template>
  <q-option-group
    v-model="val"
    :options="ITEM.options"
    color="primary"
    :type="ITEM.type"
    :inline="ITEM.inline"
    data-cy="radio"
    class="quest-options"
    :class="{ 'quest-options--inline': ITEM.inline }"
  />
</template>

<script>
export default {
  name: 'RenderRadio',
  props: ['ITEM'],
  computed: {
    val: {
      get() {
        return this.ITEM.value
      },
      set(v) {
        this.$emit('emitValue', v)
      },
    },
  },
}
</script>

<style lang="sass" scoped>
// Große, gut tippbare Antwort-Reihen (ResearchKit-Stil). q-option-group bleibt
// erhalten (rendert .q-radio/.q-checkbox), damit Wertebindung & E2E intakt sind.
.quest-options
  display: flex
  flex-direction: column
  gap: $gap-sm

  :deep(.q-radio),
  :deep(.q-checkbox)
    width: 100%
    min-height: 48px
    align-items: center
    padding: 6px 12px
    border: 1px solid $line
    border-radius: $radius-sm
    margin: 0
    transition: background-color 0.15s ease, border-color 0.15s ease

  :deep(.q-radio[aria-checked='true']),
  :deep(.q-checkbox[aria-checked='true'])
    border-color: $primary
    background: rgba(25, 118, 210, 0.06)

// Inline-Optionen (z.B. kompakte Skalen) behalten das horizontale Layout.
.quest-options--inline
  flex-direction: row
  flex-wrap: wrap
  :deep(.q-radio),
  :deep(.q-checkbox)
    width: auto
</style>
