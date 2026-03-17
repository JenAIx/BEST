<template>
  <div>
    <!-- TEXT -->
    <q-input v-if="ITEM.type === 'text'" filled v-model="val" :label="ITEM.hint" :type="TEXT_TYPE" data-cy="number">
      <template v-slot:append>
        <q-icon v-if="mode" name="subject" class="cursor-pointer" @click="mode = !mode" />
        <q-icon v-else name="close" class="cursor-pointer" @click="mode = !mode" />
      </template>
    </q-input>
    <!-- ELSE -->
    <q-input v-else filled v-model="val" :label="ITEM.hint" :type="ITEM.type" data-cy="number" />
  </div>
</template>

<script>

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
          v = Number.isNaN(parsed) ? null : parsed
        }
        this.$emit('emitValue', v)
      }
    },
    TEXT_TYPE() {
      if (this.mode === true) return 'text'
      else return 'textarea'
    }
  }

}
</script>
