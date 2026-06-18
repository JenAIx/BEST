<template>
  <q-input
    data-cy="PID"
    filled
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :label="$t('quest.pid')"
    :hint="hint"
    :rules="[(v) => (v && v.length > 0) || $t('quest.pid_hint')]"
    :disable="disable"
    :autofocus="autofocus"
    @keyup.enter="$emit('enter')"
  />
</template>

<script>
// PID-Eingabe — gemeinsam von Fokus- (PID-Schritt) und Listen-Modus genutzt.
export default {
  name: 'QuestPidField',
  props: {
    modelValue: { default: '' },
    hint: { default: '' },
    disable: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'enter'],
}
</script>
