<template>
  <div class="quest-slider column items-center q-gutter-y-sm">
    <q-badge color="green" class="quest-slider__cap">{{ ITEM.options.top.label }}</q-badge>
    <q-slider
      v-model="val"
      class="quest-slider__ctrl"
      color="primary"
      markers
      snap
      :min="min"
      :max="max"
      :vertical="ITEM.vertical"
      :step="step"
      label
      label-always
      reverse
      :label-value="meinWert"
      thumb-size="28px"
      track-size="6px"
      :style="ITEM.vertical ? 'height: 240px' : 'width: 100%'"
    />
    <q-badge color="blue" class="quest-slider__cap">{{ ITEM.options.bottom.label }}</q-badge>
  </div>
</template>

<script>
export default {
  name: 'RenderSlider',
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
    max() {
      return parseInt(this.ITEM.options.top.value)
    },
    min() {
      return parseInt(this.ITEM.options.bottom.value)
    },
    step() {
      const s = Number(this.ITEM.options.steps)
      return Number.isFinite(s) && s > 0 ? s : 1
    },
    meinWert() {
      if (this.val === null) return 'bitte einen Wert auswählen'
      return 'Mein Wert: ' + this.val
    },
  },
}
</script>

<style lang="sass" scoped>
.quest-slider__cap
  max-width: 100%
  white-space: normal
  text-align: center
.quest-slider__ctrl
  margin: $gap-sm 0
</style>
