<template>
  <div class="column items-center">
    <div class="col q-ma-md">
      <q-badge color="green">
      {{ITEM.options.top.label}}
    </q-badge>
    </div>
    <div class="col q-ma-md "> <q-slider
      v-model="val"
      color="black"
      markers
      snap
      :min="min"
      :max="max"
      :vertical="ITEM.vertical"
      :step="parseInt(ITEM.options.steps)"
      label
      label-always
      label-color="yellow"
      label-text-color="black"
      reverse
      :label-value="meinWert"
      style=""
    />
    </div>
    <div class="col q-ma-md">
      <q-badge color="blue">
      {{ITEM.options.bottom.label}}
    </q-badge>
    </div>

    </div>

</template>

<script>

export default {
  name: 'RenderSlider',
  props: ["ITEM"],
  computed: {
    val: {
      get() { return this.ITEM.value },
      set(v) { this.$emit('emitValue', v) }
    },
    max() { return parseInt(this.ITEM.options.top.value) },
    min() { return parseInt(this.ITEM.options.bottom.value) },
    meinWert() {
      if (this.val === null) return "bitte einen Wert auswählen"
      else return "Mein Wert: " + this.val
    }
  },
}
</script>
