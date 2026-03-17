<template>
  <q-option-group v-model="val" :options="ITEM.options" color="primary" :type="ITEM.type"
                :inline="ITEM.inline" data-cy="radio" />


</template>

<script>

export default {
  name: 'RenderRadio',
  props: ["ITEM"],
  computed: {
    val: {
      get() { return this.ITEM.value },
      set(v) { this.$emit('emitValue', v) }
    }
  }
}
</script>
