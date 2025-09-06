<template>
  <q-dialog v-model="dialogModel" :persistent="persistent" @hide="onDialogHide">
    <q-card style="min-width: 400px">
      <!-- Header -->
      <q-card-section class="row items-center">
        <div class="text-h6">{{ title }}</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- Content -->
      <q-card-section>
        <slot></slot>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right">
        <q-btn :label="cancelLabel" color="grey" flat @click="onCancel" />
        <q-btn :label="okLabel" color="primary" :loading="loading" :disabled="disabled" @click="onOk" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Dialog',
  },
  okLabel: {
    type: String,
    default: 'OK',
  },
  cancelLabel: {
    type: String,
    default: 'Cancel',
  },
  persistent: {
    type: Boolean,
    default: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'ok', 'cancel', 'hide'])

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const onOk = () => {
  emit('ok')
}

const onCancel = () => {
  emit('cancel')
  dialogModel.value = false
}

const onDialogHide = () => {
  emit('hide')
}
</script>

<style lang="scss" scoped>
.q-card {
  max-width: 90vw;
}
</style>
