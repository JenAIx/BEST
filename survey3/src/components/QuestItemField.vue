<template>
  <div class="quest-question">
    <div class="text-subtitle1 quest-question__label"><span v-html="item.label" /></div>
    <div v-if="item.caption" class="text-caption text-grey-7 q-mb-sm"><span v-html="item.caption" /></div>

    <span v-if="item.type === 'image'">
      <img v-for="(img, i) of item.value" :key="i + 'img'" :src="`img/${img}`" alt="" :style="`width: ${item.width}px`" />
    </span>
    <component
      :is="renderer"
      v-else
      :ITEM="item"
      :preview="item.type === 'multiple_radio' ? preview : undefined"
      :data-cy="inputCy"
      @emitValue="$emit('emitValue', $event)"
    />

    <div v-if="error" class="text-red q-mt-sm" data-cy="quest_inline_error">
      {{ $t('quest.please_complete') }}
    </div>
  </div>
</template>

<script>
// Eine interaktive Frage: Label + Caption + (Bild ODER passender Renderer) +
// Inline-Fehler. Von Fokus- UND Listen-Modus genutzt (entfernt die Duplizierung
// der Renderer-Auswahl in RenderQuest.vue).
import RenderSlider from './RenderQuest_slider.vue'
import RenderMultipleRadio from './RenderQuest_multipleradio.vue'
import RenderDate from './RenderQuest_date.vue'
import RenderTime from './RenderQuest_time.vue'
import RenderText from './RenderQuest_text.vue'
import RenderRadio from './RenderQuest_radio.vue'

const RENDERER = {
  radio: 'RenderRadio',
  checkbox: 'RenderRadio',
  text: 'RenderText',
  number: 'RenderText',
  date: 'RenderDate',
  date_year: 'RenderDate',
  time: 'RenderTime',
  slider: 'RenderSlider',
  multiple_radio: 'RenderMultipleRadio',
}

export default {
  name: 'QuestItemField',
  components: { RenderSlider, RenderMultipleRadio, RenderDate, RenderTime, RenderText, RenderRadio },
  props: {
    item: { type: Object, required: true },
    error: { type: Boolean, default: false },
    inputCy: { default: 'item_input' },
    // an RenderMultipleRadio durchgereicht: example_value nur in der Vorschau zeigen
    preview: { type: Boolean, default: false },
  },
  emits: ['emitValue'],
  computed: {
    renderer() {
      return RENDERER[this.item.type]
    },
  },
}
</script>

<style lang="sass" scoped>
.quest-question__label
  line-height: 1.4
  margin-bottom: $gap-sm
</style>
