<template>
  <!-- Compact, editable strip of the user's quick notes on this patient.
       Click the sticky-note icon to collapse/expand; hidden entirely only
       when there are no notes AND no draft is open. -->
  <div v-if="notes.length > 0 || adding" class="patient-notes-strip q-mb-md">
    <div class="strip-header row items-center q-gutter-xs">
      <q-btn flat round dense size="sm" icon="sticky_note_2" color="amber-9" @click="toggleCollapsed">
        <q-tooltip>{{ collapsed ? $t('visit.notesExpandAll') : $t('visit.notesCollapse') }}</q-tooltip>
      </q-btn>
      <span class="strip-title cursor-pointer" @click="toggleCollapsed">{{ $t('visit.patientNotes', { count: notes.length }) }}</span>
      <q-space />
      <q-btn v-if="!collapsed" flat round dense size="sm" icon="add" color="amber-9" @click="startAdd">
        <q-tooltip>{{ $t('visit.noteAdd') }}</q-tooltip>
      </q-btn>
    </div>

    <template v-if="!collapsed">
      <div v-for="note in notes" :key="note.NOTE_ID" class="strip-note row items-center no-wrap q-gutter-xs">
        <!-- Inline edit mode -->
        <template v-if="editingId === note.NOTE_ID">
          <q-input v-model="editText" dense outlined autofocus autogrow class="col edit-input" @keyup.enter="saveEdit(note)" @keyup.esc="editingId = null" />
          <q-btn flat round dense size="sm" icon="check" color="positive" :disable="!editText.trim()" @click="saveEdit(note)" />
          <q-btn flat round dense size="sm" icon="close" color="grey-7" @click="editingId = null" />
        </template>

        <!-- Display mode: click the text to edit inline -->
        <template v-else>
          <span class="note-text ellipsis cursor-pointer" @click="startEdit(note)">
            {{ note.NOTE_TEXT || note.NAME_CHAR }}
            <q-tooltip v-if="(note.NOTE_TEXT || '').length > 90" max-width="420px">{{ note.NOTE_TEXT }}</q-tooltip>
          </span>
          <span class="note-date text-caption text-grey-6">{{ formatDate(note.IMPORT_DATE) }}</span>
          <q-btn flat round dense size="xs" icon="delete" color="grey-6" class="note-delete" @click="confirmDelete(note)">
            <q-tooltip>{{ $t('smartButton.quickNotes.delete') }}</q-tooltip>
          </q-btn>
        </template>
      </div>

      <!-- New note draft -->
      <div v-if="adding" class="strip-note row items-center no-wrap q-gutter-xs">
        <q-input v-model="newText" dense outlined autofocus autogrow class="col edit-input" :placeholder="$t('smartButton.notesPlaceholder')" @keyup.enter="saveNew" @keyup.esc="adding = false" />
        <q-btn flat round dense size="sm" icon="check" color="positive" :disable="!newText.trim()" @click="saveNew" />
        <q-btn flat round dense size="sm" icon="close" color="grey-7" @click="adding = false" />
      </div>
    </template>
  </div>

  <!-- No notes yet: minimal affordance to attach the first one -->
  <div v-else class="patient-notes-empty q-mb-md">
    <q-btn flat dense no-caps size="sm" icon="sticky_note_2" color="amber-9" :label="$t('visit.noteAddFirst')" @click="startAdd" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useNoteStore } from 'src/stores/note-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useNotify } from 'src/composables/useNotify'
import { formatDate } from 'src/shared/utils/medical-utils.js'

defineOptions({
  name: 'PatientNotesStrip',
})

const props = defineProps({
  patientNum: { type: [Number, String], default: null },
})

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const notify = useNotify()
const noteStore = useNoteStore()
const dbStore = useDatabaseStore()
const localSettings = useLocalSettingsStore()

const notes = ref([])
const collapsed = ref(localSettings.getSetting('visits.notesStripCollapsed', false) === true)
const editingId = ref(null)
const editText = ref('')
const adding = ref(false)
const newText = ref('')

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value
  localSettings.setSetting('visits.notesStripCollapsed', collapsed.value)
}

const load = async () => {
  if (props.patientNum == null || !dbStore.canPerformOperations) {
    notes.value = []
    return
  }
  try {
    notes.value = await noteStore.fetchQuickNotesForPatient(props.patientNum)
  } catch (error) {
    console.error('Failed to load patient notes:', error)
    notes.value = []
  }
}

const startAdd = () => {
  collapsed.value = false
  adding.value = true
  newText.value = ''
}

// createQuickNote captures the current app context — on this page the
// selected patient IS this patient, so the note gets linked automatically
const saveNew = async () => {
  if (!newText.value.trim()) return
  try {
    await noteStore.createQuickNote(newText.value, { route: route.fullPath })
    adding.value = false
    newText.value = ''
    await load()
    notify.success(t('smartButton.quickNotes.saved'))
  } catch {
    notify.error(t('smartButton.quickNotes.saveFailed'))
  }
}

const startEdit = (note) => {
  editingId.value = note.NOTE_ID
  editText.value = note.NOTE_TEXT || ''
}

const saveEdit = async (note) => {
  if (!editText.value.trim()) return
  try {
    await noteStore.updateQuickNote(note.NOTE_ID, editText.value)
    editingId.value = null
    await load()
    notify.success(t('smartButton.quickNotes.updated'))
  } catch {
    notify.error(t('smartButton.quickNotes.saveFailed'))
  }
}

const confirmDelete = (note) => {
  $q.dialog({
    title: t('smartButton.quickNotes.confirmDeleteTitle'),
    message: t('smartButton.quickNotes.confirmDeleteMessage'),
    cancel: true,
  }).onOk(async () => {
    try {
      await noteStore.deleteQuickNote(note.NOTE_ID)
      await load()
      notify.success(t('smartButton.quickNotes.deleted'))
    } catch {
      notify.error(t('smartButton.quickNotes.saveFailed'))
    }
  })
}

watch(() => props.patientNum, load)

// Refresh when notes change elsewhere (e.g. the Quick Notes window)
const onNotesChanged = () => load()

onMounted(() => {
  load()
  window.addEventListener('quick-notes-changed', onNotesChanged)
})

onBeforeUnmount(() => {
  window.removeEventListener('quick-notes-changed', onNotesChanged)
})
</script>

<style lang="scss" scoped>
.patient-notes-strip {
  background: #fff8e1; // amber-1: sticky-note look
  border: 1px solid #ffe082; // amber-3
  border-radius: 8px;
  padding: 6px 12px 8px;

  .strip-header {
    .strip-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: #b26a00;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  }

  .strip-note {
    padding: 3px 0 3px 30px;

    .note-text {
      font-size: 0.88rem;
      color: $grey-9;
      min-width: 0;
      flex: 1;

      &:hover {
        text-decoration: underline dotted $grey-6;
      }
    }

    .note-date {
      white-space: nowrap;
    }

    .note-delete {
      opacity: 0.4;
      transition: opacity 0.15s ease;
    }

    &:hover .note-delete {
      opacity: 1;
    }

    .edit-input :deep(.q-field__control) {
      background: white;
    }
  }
}

.patient-notes-empty {
  opacity: 0.75;

  &:hover {
    opacity: 1;
  }
}
</style>
