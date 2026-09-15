<template>
  <!-- Right rail: template checklist, questionnaires, files, letters, notes. -->
  <aside class="tools-rail" data-cy="cockpit-tools">
    <div class="tools-rail__block">
      <div class="tools-rail__head">{{ $t('visit.cockpit.checklist') }} <span class="text-grey-6">{{ checklist.done }}/{{ checklist.total }}</span></div>
      <div v-for="item in checklist.items" :key="item.code" class="tools-rail__item" :class="{ 'tools-rail__item--done': item.done }" @click="$emit('focus', item)">
        <q-icon :name="item.done ? 'check_box' : 'check_box_outline_blank'" size="15px" :color="item.done ? 'positive' : 'grey-6'" />
        <span class="ellipsis">{{ labelFor(item) }}</span>
      </div>
      <div v-if="!checklist.items.length" class="text-caption text-grey-5">–</div>
    </div>

    <div class="tools-rail__block">
      <div class="tools-rail__head">{{ $t('visit.cockpit.questionnaires') }}</div>
      <div class="tools-rail__chips">
        <q-chip v-for="q in questionnaires" :key="q.code" dense size="sm" clickable :color="q.done ? 'green-1' : 'grey-3'" :text-color="q.done ? 'positive' : 'grey-8'" :icon="q.done ? 'check' : 'quiz'" :disable="!editable" @click="$emit('questionnaire', q)">{{ q.code }}</q-chip>
        <q-chip v-if="editable" dense size="sm" clickable color="blue-1" text-color="primary" icon="add" @click="$emit('add-questionnaire')">{{ $t('visit.cockpit.allQuestionnaires') }}</q-chip>
      </div>
    </div>

    <div class="tools-rail__block">
      <div class="tools-rail__head">{{ $t('visit.cockpit.files') }} <span class="text-grey-6">({{ files.length }})</span></div>
      <div v-for="f in files.slice(0, 5)" :key="f.observationId" class="tools-rail__item" @click="$emit('open-file', f)">
        <q-icon name="attach_file" size="14px" color="grey-6" />
        <span class="ellipsis">{{ f.fileInfo?.title || f.fileInfo?.filename || f.displayValue }}</span>
      </div>
      <VisitFileUploadArea v-if="editable" @uploaded="$emit('uploaded')" />
    </div>

    <div class="tools-rail__block">
      <div class="tools-rail__head">{{ $t('visit.cockpit.letters') }} <span class="text-grey-6">({{ letters.length }})</span></div>
      <div v-for="l in letters.slice(0, 3)" :key="l.noteId" class="tools-rail__item" @click="$emit('open-letter', l)">
        <q-icon name="description" size="14px" color="grey-6" />
        <span class="ellipsis">{{ l.title }}</span>
      </div>
      <div v-if="!letters.length" class="text-caption text-grey-5">{{ $t('visit.cockpit.noLetters') }}</div>
    </div>

    <div class="tools-rail__block">
      <div class="tools-rail__head">{{ $t('visit.cockpit.notes') }}</div>
      <PatientNotesStrip v-if="patientNum != null" :patient-num="patientNum" />
    </div>
  </aside>
</template>

<script setup>
import PatientNotesStrip from '../PatientNotesStrip.vue'
import VisitFileUploadArea from '../VisitFileUploadArea.vue'

const props = defineProps({
  checklist: { type: Object, default: () => ({ items: [], done: 0, total: 0 }) },
  questionnaires: { type: Array, default: () => [] }, // [{code, done, observation?}]
  files: { type: Array, default: () => [] },
  letters: { type: Array, default: () => [] },
  labels: { type: Object, default: () => ({}) }, // code → label
  patientNum: { type: Number, default: null },
  editable: { type: Boolean, default: false },
})
defineEmits(['focus', 'questionnaire', 'add-questionnaire', 'open-file', 'open-letter', 'uploaded'])

const labelFor = (item) => props.labels[item.code] || item.label || item.code
</script>

<style lang="scss" scoped>
.tools-rail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 0.8rem;

  &__head {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: $grey-7;
    margin-bottom: 4px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
    min-width: 0;

    &:hover {
      background: $grey-2;
    }

    &--done {
      color: $grey-6;
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
}
</style>
