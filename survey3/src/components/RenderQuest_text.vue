<template>
  <div>
    <!-- TEXT -->
    <q-input v-if="ITEM.type === 'text'" filled v-model="val" :label="ITEM.hint" :type="TEXT_TYPE" data-cy="number">
      <template v-slot:append>
        <q-icon v-if="mode" name="subject" class="cursor-pointer" @click="mode = !mode" />
        <q-icon v-else name="close" class="cursor-pointer" @click="mode = !mode" />
      </template>
    </q-input>
    <!-- ELSE (number u. a.): optionale min/max/step werden geehrt -->
    <q-input v-else filled v-model="val" :label="numberHint" :type="ITEM.type" :min="ITEM.min"
      :max="ITEM.max" :step="ITEM.step" data-cy="number" />
  </div>
</template>

<script>
import { clampNumber } from 'src/tools/numUtils'

export default {
  name: 'RenderText',
  props: ["ITEM"],
  data() {
    return {
      mode: true
    }
  },
  computed: {
    val: {
      get() { return this.ITEM.value },
      set(v) {
        if (this.ITEM.type === 'number') {
          const parsed = parseFloat(v)
          // ungültige Eingabe -> null; gültige -> in optionalen Bereich [min,max] klemmen
          v = Number.isNaN(parsed) ? null : clampNumber(parsed, this.ITEM.min, this.ITEM.max)
        }
        this.$emit('emitValue', v)
      }
    },
    // Hint inkl. erlaubtem Bereich, falls min/max gesetzt
    numberHint() {
      const base = this.ITEM.hint || ''
      const hasMin = typeof this.ITEM.min === 'number'
      const hasMax = typeof this.ITEM.max === 'number'
      if (!hasMin && !hasMax) return base
      const range = `${hasMin ? this.ITEM.min : ''}–${hasMax ? this.ITEM.max : ''}`
      return base ? `${base} (${range})` : range
    },
    TEXT_TYPE() {
      if (this.mode === true) return 'text'
      else return 'textarea'
    }
  }

}
</script>
