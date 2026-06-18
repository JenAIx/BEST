<template>
  <div v-if="blocks && blocks.length" class="quest-intro">
    <div v-for="(b, bi) in blocks" :key="bi + 'intro'" class="q-mb-sm">
      <div v-if="b.label" class="text-subtitle2 text-grey-8"><span v-html="b.label" /></div>
      <div v-if="b.caption" class="text-caption text-grey-7"><span v-html="b.caption" /></div>
      <span v-if="b.type === 'image'">
        <img v-for="(img, k) of b.value" :key="k + 'img'" :src="`img/${img}`" alt="" :style="`width:${b.width}px`" />
      </span>
    </div>
  </div>
</template>

<script>
// Vorangestellter Kontext (separator/textbox/image) eines Fokus-Schritts bzw.
// abschließende Hinweise. Vereinheitlicht die zuvor duplizierten Intro-Blöcke.
export default {
  name: 'QuestIntro',
  props: { blocks: { type: Array, default: () => [] } },
}
</script>

<style lang="sass" scoped>
.quest-intro
  margin-bottom: 12px
  padding-left: $gap-sm
  border-left: 3px solid $line
</style>
