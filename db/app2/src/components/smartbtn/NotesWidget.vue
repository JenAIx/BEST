<template>
  <div class="notes-plugin">
    <!-- DB unavailable hint -->
    <q-banner v-if="!dbAvailable" dense rounded class="bg-orange-1 text-orange-9 q-mb-sm">
      <template v-slot:avatar>
        <q-icon name="cloud_off" size="20px" />
      </template>
      {{ $t('smartButton.quickNotes.dbUnavailable') }}
    </q-banner>

    <q-tabs v-model="tab" dense align="left" class="text-grey-7" active-color="primary" indicator-color="primary" narrow-indicator>
      <q-tab name="new" icon="edit_note" :label="$t('smartButton.quickNotes.tabNew')" />
      <q-tab name="list" icon="sticky_note_2">
        <div class="row items-center no-wrap q-gutter-xs">
          <span>{{ $t('smartButton.quickNotes.tabList') }}</span>
          <q-badge v-if="noteStore.quickNotesCount > 0" color="primary" :label="noteStore.quickNotesCount" />
        </div>
      </q-tab>
    </q-tabs>

    <q-separator class="q-mb-sm" />

    <q-tab-panels v-model="tab" animated class="notes-panels">
      <!-- New note -->
      <q-tab-panel name="new" class="q-pa-none">
        <q-input v-model="note" type="textarea" :placeholder="$t('smartButton.notesPlaceholder')" rows="4" outlined dense class="q-mb-sm" autofocus />

        <!-- Context preview: what will be attached on save -->
        <div class="row items-center q-gutter-xs q-mb-sm">
          <span class="text-caption text-grey-6">{{ currentContextChip ? $t('smartButton.quickNotes.contextHint') : $t('smartButton.quickNotes.noContext') }}</span>
          <q-chip v-if="currentContextChip" dense size="sm" :icon="currentContextChip.icon" color="blue-1" text-color="primary">
            {{ currentContextChip.label }}
          </q-chip>
        </div>

        <div class="row q-gutter-sm">
          <q-btn color="primary" :label="$t('smartButton.saveNote')" @click="saveNote" :disable="!note.trim() || !dbAvailable" :loading="noteStore.loading" unelevated />
          <q-btn flat color="grey-7" :label="$t('common.clear')" @click="note = ''" />
        </div>

        <!-- Last 3 notes -->
        <div v-if="noteStore.recentQuickNotes.length > 0" class="q-mt-md">
          <div class="text-caption text-weight-medium text-grey-7 q-mb-xs">{{ $t('smartButton.quickNotes.recent') }}</div>
          <q-list bordered separator class="rounded-borders">
            <NoteListItem v-for="n in noteStore.recentQuickNotes" :key="n.NOTE_ID" :note="n" compact @open-context="openContext" />
          </q-list>
        </div>
      </q-tab-panel>

      <!-- Notes list -->
      <q-tab-panel name="list" class="q-pa-none">
        <q-input v-model="searchTerm" dense outlined :placeholder="$t('smartButton.quickNotes.searchPlaceholder')" debounce="300" class="q-mb-sm" clearable @update:model-value="onSearch">
          <template v-slot:prepend>
            <q-icon name="search" size="18px" />
          </template>
        </q-input>

        <div v-if="noteStore.loading" class="text-center q-pa-md">
          <q-spinner color="primary" size="24px" />
        </div>

        <div v-else-if="noteStore.quickNotes.length === 0" class="text-center text-grey-6 q-pa-md">
          <q-icon name="sticky_note_2" size="32px" class="q-mb-xs" />
          <div class="text-caption">{{ searchTerm ? $t('smartButton.quickNotes.emptySearch') : $t('smartButton.quickNotes.emptyList') }}</div>
        </div>

        <q-list v-else bordered separator class="rounded-borders notes-list">
          <template v-for="n in noteStore.quickNotes" :key="n.NOTE_ID">
            <!-- Inline edit mode -->
            <q-item v-if="editingId === n.NOTE_ID" class="column q-gutter-sm q-py-sm">
              <q-input v-model="editText" type="textarea" rows="3" outlined dense autofocus />
              <div class="row q-gutter-sm">
                <q-btn size="sm" color="primary" icon="check" :label="$t('common.save')" @click="saveEdit(n)" :disable="!editText.trim()" unelevated />
                <q-btn size="sm" flat color="grey-7" :label="$t('common.cancel')" @click="editingId = null" />
              </div>
            </q-item>
            <NoteListItem v-else :note="n" @open-context="openContext" @edit="startEdit" @remove="confirmDelete" />
          </template>
        </q-list>
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useNoteStore } from 'src/stores/note-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { usePatientStore } from 'src/stores/patient-store'
import { useStudyStore } from 'src/stores/study-store'
import { useNotify } from 'src/composables/useNotify'
import NoteListItem from './NoteListItem.vue'

defineOptions({
  name: 'NotesWidget',
})

const props = defineProps({
  initialState: { type: Object, default: null },
  context: { type: Object, default: null },
})

const emit = defineEmits(['close'])

const $q = useQuasar()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const notify = useNotify()
const noteStore = useNoteStore()
const dbStore = useDatabaseStore()
const patientStore = usePatientStore()
const studyStore = useStudyStore()

const tab = ref(props.initialState?.tab || 'new')
const note = ref(props.initialState?.note || '')
const searchTerm = ref('')
const editingId = ref(null)
const editText = ref('')

const dbAvailable = computed(() => dbStore.canPerformOperations)

// Preview of the context that will be attached on save
// (priority mirrors resolveContextTarget: patient → study → page)
const currentContextChip = computed(() => {
  const patient = patientStore.selectedPatient
  if (patient) {
    return { icon: 'person', label: patient.name || patient.PATIENT_CD || patient.id }
  }
  const study = studyStore.selectedStudy
  if (study) {
    return { icon: 'science', label: study.name }
  }
  if (route.fullPath) {
    return { icon: 'link', label: `${t('smartButton.quickNotes.page')}: ${route.fullPath}` }
  }
  return null
})

// Expose state for the SmartButton minimize/restore feature
const getState = () => ({ note: note.value, tab: tab.value })
defineExpose({ getState })

const saveNote = async () => {
  try {
    await noteStore.createQuickNote(note.value, { route: route.fullPath })
    note.value = ''
    notify.success(t('smartButton.quickNotes.saved'))
  } catch {
    notify.error(t('smartButton.quickNotes.saveFailed'))
  }
}

const onSearch = () => {
  loadNotes()
}

const loadNotes = async () => {
  if (!dbAvailable.value) return
  try {
    await noteStore.loadQuickNotes({ searchTerm: searchTerm.value || '' })
  } catch {
    notify.error(t('smartButton.quickNotes.loadFailed'))
  }
}

const openContext = (target) => {
  emit('close')
  router.push(target.to)
}

const startEdit = (n) => {
  editingId.value = n.NOTE_ID
  editText.value = n.NOTE_TEXT || ''
}

const saveEdit = async (n) => {
  try {
    await noteStore.updateQuickNote(n.NOTE_ID, editText.value)
    editingId.value = null
    notify.success(t('smartButton.quickNotes.updated'))
  } catch {
    notify.error(t('smartButton.quickNotes.saveFailed'))
  }
}

const confirmDelete = (n) => {
  $q.dialog({
    title: t('smartButton.quickNotes.confirmDeleteTitle'),
    message: t('smartButton.quickNotes.confirmDeleteMessage'),
    cancel: true,
    persistent: false,
  }).onOk(async () => {
    try {
      await noteStore.deleteQuickNote(n.NOTE_ID)
      notify.success(t('smartButton.quickNotes.deleted'))
    } catch {
      notify.error(t('smartButton.quickNotes.saveFailed'))
    }
  })
}

onMounted(loadNotes)
</script>

<style lang="scss" scoped>
.notes-plugin {
  min-width: 380px;
}

.notes-panels {
  background: transparent;
}

.notes-list {
  max-height: 320px;
  overflow-y: auto;
}
</style>
