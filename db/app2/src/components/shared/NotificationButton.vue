<template>
  <div>
    <q-btn flat dense round icon="notifications" class="q-mr-sm" @click="openDialog">
      <q-badge v-if="badgeCount > 0" color="red" floating>{{ badgeCount }}</q-badge>
    </q-btn>

    <q-dialog v-model="dialogOpen" position="right" :maximized="$q.screen.lt.sm">
      <q-card class="notification-card">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Benachrichtigungen</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="notification-content q-pt-sm">
          <div v-if="entries.length === 0" class="text-center text-grey-5 q-pa-xl">
            <q-icon name="notifications_none" size="48px" class="q-mb-md" />
            <div>Keine Benachrichtigungen</div>
          </div>

          <template v-else>
            <div class="row items-center q-mb-sm">
              <q-btn-toggle
                v-model="filter"
                flat dense no-caps rounded
                toggle-color="primary"
                size="sm"
                :options="[
                  { label: 'Wichtig', value: 'important' },
                  { label: 'Alle', value: 'all' },
                ]"
              />
              <q-space />
              <span class="text-caption text-grey-5">{{ visibleEntries.length }} Eintr.</span>
            </div>

            <div v-if="visibleEntries.length === 0" class="text-center text-grey-5 q-pa-lg">
              Keine Eintr&auml;ge in dieser Ansicht
            </div>

            <div v-for="(e, i) in visibleEntries" :key="i" class="notification-row" :class="'notification-row--' + e.level.toLowerCase()">
              <div class="notification-icon">
                <q-icon :name="e.icon" :color="e.color" size="18px" />
              </div>
              <div class="notification-body">
                <div class="notification-msg">{{ e.msg }}</div>
                <div class="notification-meta">{{ e.src }} &middot; {{ e.time }}</div>
              </div>
              <div class="notification-badge">
                <q-badge :color="e.color" :label="e.tag" />
              </div>
            </div>
          </template>
        </q-card-section>

        <q-card-actions align="between" class="q-pa-md">
          <q-btn flat color="grey-7" label="Leeren" @click="clearLogs" :disable="entries.length === 0" size="sm" />
          <q-btn flat color="primary" label="Exportieren" @click="loggingStore.exportLogs()" :disable="entries.length === 0" size="sm" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useLoggingStore } from 'src/stores/logging-store'

const $q = useQuasar()
const loggingStore = useLoggingStore()

const dialogOpen = ref(false)
const seenCount = ref(0)
const filter = ref('important')

// --- Badge ---
const badgeCount = computed(() => {
  const n = loggingStore.errorLogs.length + loggingStore.warningLogs.length
  return n > seenCount.value ? n - seenCount.value : 0
})

const openDialog = () => {
  dialogOpen.value = true
  seenCount.value = loggingStore.errorLogs.length + loggingStore.warningLogs.length
}

// --- Formatting helpers (pure functions, no reactivity) ---

const ICONS = { ERROR: 'error', WARN: 'warning', SUCCESS: 'check_circle', INFO: 'info', DEBUG: 'bug_report' }
const COLORS = { ERROR: 'negative', WARN: 'warning', SUCCESS: 'positive', INFO: 'info', DEBUG: 'grey-6' }
const TAGS = { ERROR: 'Fehler', WARN: 'Warnung', SUCCESS: 'OK', INFO: 'Info', DEBUG: 'Debug' }

const SOURCES = {
  ObservationStore: 'Beobachtungen',
  VisitStore: 'Visiten',
  PatientStore: 'Patienten',
  DatabaseStore: 'Datenbank',
  DatabaseService: 'Datenbank',
  MigrationManager: 'Migration',
  AuthStore: 'Anmeldung',
  QuestionnaireStore: 'Frageboegen',
  ImportStore: 'Import',
  Router: 'Navigation',
}

const MSG = {
  'Patient data loaded successfully': 'Patientendaten geladen',
  'All observations loaded successfully': 'Beobachtungen geladen',
  'Loading all observations for patient': 'Lade Beobachtungen',
  'Visits loaded successfully': 'Visiten geladen',
  'Loading visits for patient': 'Lade Visiten',
  'Patient selected': 'Patient ausgewaehlt',
  'Setting selected patient': 'Patient wird gesetzt',
  'Patient loaded successfully': 'Patient geladen',
  'Loading patient by code': 'Lade Patient',
  'Loading patient with data': 'Lade Patientendaten',
  'Observation created successfully': 'Beobachtung erstellt',
  'Observation updated successfully': 'Beobachtung aktualisiert',
  'Observation deleted successfully': 'Beobachtung geloescht',
  'Visit created successfully': 'Visite erstellt',
  'Visit updated successfully': 'Visite aktualisiert',
  'Visit deleted successfully': 'Visite geloescht',
  'Database initialized successfully': 'Datenbank verbunden',
  'Database Service initialized successfully': 'Datenbank-Service gestartet',
  'Successfully connected to database': 'Datenbankverbindung hergestellt',
  'Database initialization completed successfully': 'Datenbank initialisiert',
  'Repositories initialized': 'Repositories initialisiert',
  'Foreign key constraints enabled': 'Foreign Keys aktiviert',
  'Initializing database': 'Datenbank wird initialisiert',
  'Initializing Database Service': 'Starte Datenbank-Service',
  'Found previous observation': 'Vorherige Beobachtung gefunden',
}

const DETAIL_KEYS = [
  ['patientName', ''],
  ['patientCode', ''],
  ['patientId', 'Patient'],
  ['patientNum', '#'],
  ['visitId', 'Visite'],
  ['encounterNum', 'Visite'],
  ['observationId', 'Obs.'],
  ['observationCount', 'Beobachtungen'],
  ['visitCount', 'Visiten'],
  ['count', 'Anzahl'],
  ['conceptCode', 'Konzept'],
  ['username', 'Benutzer'],
  ['database', 'DB'],
  ['databasePath', 'Pfad'],
  ['path', 'Pfad'],
]

function buildDetails(data) {
  if (!data || typeof data !== 'object') return ''
  var parts = []
  for (var i = 0; i < DETAIL_KEYS.length; i++) {
    var key = DETAIL_KEYS[i][0]
    var label = DETAIL_KEYS[i][1]
    var v = data[key]
    if (v === undefined || v === null) continue
    var s = typeof v === 'string' && v.length > 35 ? v.substring(0, 32) + '...' : String(v)
    parts.push(label ? label + ': ' + s : s)
  }
  return parts.join(', ')
}

function buildMsg(message, data) {
  var base = MSG[message] || message || ''
  var detail = ''
  if (data && typeof data === 'object') {
    detail = buildDetails(data)
  } else if (typeof data === 'string') {
    try { detail = buildDetails(JSON.parse(data)) } catch { /* ignore */ }
  }
  if (detail) return base + ' \u2014 ' + detail
  return base
}

function buildTime(ts) {
  try {
    var d = new Date(ts)
    var diff = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diff < 1) return 'Gerade eben'
    if (diff < 60) return 'vor ' + diff + 'm'
    var h = Math.floor(diff / 60)
    if (h < 24) return 'vor ' + h + 'h'
    var days = Math.floor(h / 24)
    if (days < 7) return 'vor ' + days + 'd'
    return d.toLocaleDateString('de-DE')
  } catch {
    return ''
  }
}

// --- Entries: plain array of plain objects, no proxy leaks ---

const entries = computed(() => {
  var raw = loggingStore.recentLogs
  if (!raw || !raw.length) return []
  var out = []
  for (var i = raw.length - 1; i >= 0; i--) {
    var r = raw[i]
    out.push({
      level: r.level || 'INFO',
      msg: buildMsg(r.message, r.data),
      src: SOURCES[r.context] || r.context || '',
      time: buildTime(r.timestamp),
      icon: ICONS[r.level] || 'info',
      color: COLORS[r.level] || 'info',
      tag: TAGS[r.level] || r.level,
    })
  }
  return out
})

const visibleEntries = computed(() => {
  if (filter.value === 'all') return entries.value
  return entries.value.filter(function (e) {
    return e.level === 'SUCCESS' || e.level === 'WARN' || e.level === 'ERROR'
  })
})

// --- Actions ---

const clearLogs = () => {
  $q.dialog({
    title: 'Logs leeren',
    message: 'Alle Logs werden entfernt. Fortfahren?',
    cancel: { label: 'Abbrechen', flat: true },
    ok: { label: 'Leeren', color: 'negative' },
    persistent: true,
  }).onOk(() => {
    loggingStore.clearLogs()
    seenCount.value = 0
  })
}
</script>

<style scoped>
.notification-card {
  width: 460px;
  max-width: 90vw;
  height: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.notification-content {
  flex: 1;
  overflow-y: auto;
}

.notification-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid #f0f0f0;
}

.notification-row:last-child {
  border-bottom: none;
}

.notification-row:hover {
  background: rgba(0, 0, 0, 0.02);
}

.notification-icon {
  flex-shrink: 0;
  padding-top: 2px;
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-msg {
  font-size: 13px;
  line-height: 1.4;
  color: #333;
  word-break: break-word;
}

.notification-meta {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.notification-badge {
  flex-shrink: 0;
  padding-top: 2px;
}
</style>
