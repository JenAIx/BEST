<template>
  <q-input filled v-model="val" :mask="mask_input" :rules="['01.01.1970']" :hint="'Format: ' + date_rule">
    <template v-slot:append>
      <q-icon name="schedule" class="cursor-pointer">
        <q-popup-proxy ref="qTimeProxy" transition-show="scale" transition-hide="scale">
          <q-time v-model="val" format24h>
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-time>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script>
export default {
  name: 'RenderTime',
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
    date_rule() {
      return '12:00'
    },
    mask_input() {
      return '##:##'
    },
  },
}
</script>
