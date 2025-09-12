<template>
  <div class="notes-plugin">
    <q-input v-model="note" type="textarea" :placeholder="$t('smartButton.notesPlaceholder')" rows="4" outlined class="q-mb-md" />
    <div class="row q-gutter-sm">
      <q-btn color="primary" :label="$t('smartButton.saveNote')" @click="saveNote" :disable="!note.trim()" />
      <q-btn color="grey" :label="$t('common.clear')" @click="clearNote" />
    </div>
    <div v-if="savedNotes.length > 0" class="q-mt-md">
      <div class="text-subtitle2 q-mb-sm">Recent Notes:</div>
      <q-list bordered separator>
        <q-item v-for="(savedNote, index) in savedNotes" :key="index">
          <q-item-section>
            <q-item-label>{{ savedNote.text }}</q-item-label>
            <q-item-label caption>{{ savedNote.timestamp }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn icon="delete" size="sm" flat round @click="deleteNote(index)" />
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineOptions({
  name: 'NotesWidget',
})

const note = ref('')
const savedNotes = ref([])

const saveNote = () => {
  if (note.value.trim()) {
    savedNotes.value.unshift({
      text: note.value.trim(),
      timestamp: new Date().toLocaleString(),
    })
    note.value = ''
  }
}

const clearNote = () => {
  note.value = ''
}

const deleteNote = (index) => {
  savedNotes.value.splice(index, 1)
}
</script>

<style lang="scss" scoped>
.notes-plugin {
  min-width: 300px;
}
</style>
