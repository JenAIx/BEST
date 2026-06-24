<template>
  <q-dialog v-model="state" maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card class="tv-card column no-wrap">
      <!-- TOOLBAR -->
      <q-toolbar class="tv-toolbar bg-secondary text-white">
        <q-toolbar-title class="text-subtitle1">
          {{ questTitle }}
        </q-toolbar-title>
        <q-btn flat round dense icon="file_download" @click="exportCSV" class="q-mr-xs">
          <q-tooltip>CSV Export</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="print" @click="printView" class="q-mr-xs">
          <q-tooltip>Print</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="verified" @click="checkQuest" class="q-mr-xs">
          <q-tooltip>Verify Signature</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-toolbar>

      <!-- SCROLLABLE CONTENT -->
      <q-scroll-area class="col">
        <div ref="printArea" class="tv-content q-pa-lg">

          <!-- HEADER BLOCK -->
          <div class="tv-header q-mb-lg">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <table class="tv-meta-table">
                  <tbody>
                    <tr>
                      <td class="tv-meta-label">PID</td>
                      <td class="tv-meta-value">{{ pid }}</td>
                    </tr>
                    <tr>
                      <td class="tv-meta-label">Questionnaire</td>
                      <td class="tv-meta-value">{{ questDisplay }}</td>
                    </tr>
                    <tr v-if="questCode">
                      <td class="tv-meta-label">Code</td>
                      <td class="tv-meta-value text-caption text-grey-7">{{ questCode }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="col-12 col-sm-6">
                <table class="tv-meta-table">
                  <tbody>
                    <tr>
                      <td class="tv-meta-label">Date</td>
                      <td class="tv-meta-value">{{ formattedDate }}</td>
                    </tr>
                    <tr>
                      <td class="tv-meta-label">Duration</td>
                      <td class="tv-meta-value">{{ duration }}</td>
                    </tr>
                    <tr>
                      <td class="tv-meta-label">Document</td>
                      <td class="tv-meta-value text-caption text-grey-7">{{ docId }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- RESULTS -->
          <div v-if="results.length > 0" class="tv-section q-mb-lg">
            <div class="tv-section-title">Results</div>
            <div class="row q-col-gutter-sm">
              <div v-for="(r, i) in results" :key="'res_' + i" class="col-6 col-sm-4 col-md-3">
                <div class="tv-result-card">
                  <div class="tv-result-value">{{ r.value }}</div>
                  <div class="tv-result-label">{{ r.title }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- EVALUATION -->
          <div v-if="evaluationHtml" class="tv-section q-mb-lg">
            <div class="tv-section-title">Evaluation</div>
            <div class="tv-eval" v-html="evaluationHtml"></div>
          </div>

          <!-- ITEMS / FINDINGS -->
          <div v-if="findings.length > 0" class="tv-section">
            <div class="tv-section-title">Items</div>
            <table class="tv-items-table">
              <thead>
                <tr>
                  <th class="text-left">#</th>
                  <th class="text-left">Item</th>
                  <th class="text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(f, i) in findings" :key="'find_' + i">
                  <td class="tv-item-num">{{ i + 1 }}</td>
                  <td class="tv-item-label">{{ f.title }}</td>
                  <td class="tv-item-value">
                    <template v-if="isImage(f.value)">
                      <img :src="f.value" class="tv-drawing" alt="Zeichnung" />
                      <div class="tv-drawing-actions no-print">
                        <q-btn flat dense size="sm" icon="file_download" label="PNG" no-caps
                          @click="downloadImage(f)" />
                      </div>
                    </template>
                    <span v-else>{{ f.value }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </q-scroll-area>
    </q-card>
  </q-dialog>
</template>

<script>
import { exportFile } from 'quasar'
import { useMainStore } from 'src/stores/main'

export default {
  props: ["QUEST", "medium"],
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return {
      state: this.medium,
    }
  },
  watch: {
    state(val) {
      if (val === false) this.$emit('closeClick')
    }
  },
  computed: {
    cda() {
      return this.QUEST?.cda || {}
    },
    pid() {
      return this.cda.subject?.display || '-'
    },
    questTitle() {
      return this.QUEST?.info?.title || this.cda.title || ''
    },
    questDisplay() {
      return this.cda.event?.[0]?.code?.[0]?.coding?.[0]?.display || this.questTitle
    },
    questCode() {
      const coding = this.cda.event?.[0]?.code?.[0]?.coding?.[0]
      if (!coding || !coding.code) return ''
      return `${coding.code} (${coding.system || ''})`
    },
    docId() {
      return this.cda.identifier?.value || ''
    },
    formattedDate() {
      if (!this.cda.date) return '-'
      const d = parseDate(this.cda.date)
      if (!d) return this.cda.date
      return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },
    duration() {
      const period = this.cda.event?.[0]?.period
      if (!period?.start || !period?.end) return '-'
      const start = parseDate(period.start)
      const end = parseDate(period.end)
      if (!start || !end) return '-'
      const ms = end - start
      if (isNaN(ms) || ms < 0) return '-'
      const sec = Math.floor(ms / 1000)
      if (sec < 60) return `${sec}s`
      const min = Math.floor(sec / 60)
      const remSec = sec % 60
      return `${min}m ${remSec}s`
    },
    sections() {
      return this.cda.section || []
    },
    results() {
      const sec = this.sections.find(s => s.title === 'Results Section')
      return sec?.entry || []
    },
    findings() {
      const sec = this.sections.find(s => s.title === 'Findings Section')
      return sec?.entry || []
    },
    evaluationHtml() {
      const sec = this.sections.find(s => s.title === 'Evaluation Section')
      return sec?.text?.div || ''
    },
  },
  methods: {
    isImage(v) {
      return typeof v === 'string' && v.startsWith('data:image')
    },
    downloadImage(f) {
      const pid = (this.pid || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')
      const name = (f.title || 'zeichnung').replace(/[^a-zA-Z0-9_-]/g, '_')
      const a = document.createElement('a')
      a.href = f.value
      a.download = `${pid}_${name}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    },
    checkQuest() {
      this.mainStore.verify_quest_signature(this.QUEST)
        .then(() => this.$q.notify({ message: "Das Dokument ist valide.", color: 'green' }))
        .catch(err => this.$q.notify({ message: `Überprüfung nicht erfolgreich: ${err}`, color: 'warning' }))
    },

    exportCSV() {
      const sep = ';'
      const rows = []

      // header row
      const headers = ['PID', 'Questionnaire', 'Date']
      const values = [this.pid, this.questDisplay, this.cda.date || '']

      this.results.forEach(r => {
        headers.push(r.title)
        values.push(r.value)
      })
      this.findings.forEach(f => {
        headers.push(f.title)
        // Zeichnungen (Base64) nicht in die CSV-Zelle kippen — Platzhalter
        values.push(this.isImage(f.value) ? '[Zeichnung]' : f.value)
      })

      rows.push(headers.map(h => csvCell(h)).join(sep))
      rows.push(values.map(v => csvCell(v)).join(sep))

      const content = '\uFEFF' + rows.join('\r\n')
      const pid = (this.pid || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')
      const status = exportFile(`${pid}_${this.QUEST?.info?.label || 'quest'}.csv`, content, 'text/csv;charset=utf-8')
      if (!status) {
        this.$q.notify({ message: 'Export failed', color: 'negative' })
      }
    },

    printView() {
      const el = this.$refs.printArea
      if (!el) return
      const win = window.open('', '_blank')
      win.document.write(`<!DOCTYPE html><html><head><title>${this.questTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1D1D1D; font-size: 11pt; }
  .tv-header { margin-bottom: 20px; background: #F5F5F5; border-radius: 8px; padding: 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; }
  .col-12 { width: 100%; } .col-sm-6 { width: 48%; }
  .tv-meta-table { border-collapse: collapse; width: 100%; }
  .tv-meta-label { font-weight: 600; color: #616161; padding: 2px 8px 2px 0; white-space: nowrap; width: 1%; }
  .tv-meta-value { padding: 2px 0; color: #1D1D1D; }
  .text-caption { font-size: 0.85em; }
  .text-grey-7 { color: #757575; }
  .tv-section { margin-bottom: 18px; }
  .tv-section-title { font-size: 13pt; font-weight: 600; border-bottom: 2px solid #26A69A; padding-bottom: 4px; margin-bottom: 10px; color: #26A69A; }
  .tv-result-cards { display: flex; flex-wrap: wrap; gap: 10px; }
  .tv-result-card { border: 1px solid #E0E0E0; border-radius: 6px; padding: 10px 14px; text-align: center; break-inside: avoid; display: inline-block; min-width: 120px; margin: 0 8px 8px 0; background: #F5F5F5; }
  .tv-result-value { font-size: 16pt; font-weight: 700; color: #1976D2; }
  .tv-result-label { font-size: 9pt; color: #757575; margin-top: 2px; }
  .tv-items-table { border-collapse: collapse; width: 100%; }
  .tv-items-table th { border-bottom: 2px solid #9E9E9E; padding: 4px 8px; font-size: 9pt; text-transform: uppercase; color: #757575; }
  .tv-items-table td { border-bottom: 1px solid #EEEEEE; padding: 5px 8px; font-size: 10pt; }
  .tv-item-num { color: #9E9E9E; width: 30px; }
  .tv-item-value { color: #1976D2; font-weight: 500; }
  .tv-eval { background: #F5F5F5; padding: 10px; border-radius: 4px; font-size: 10pt; color: #1D1D1D; }
  .tv-drawing { max-width: 340px; width: 100%; border: 1px solid #bbb; border-radius: 4px; break-inside: avoid; }
  .no-print { display: none !important; }
  @page { margin: 15mm; }
</style></head><body>`)
      win.document.write(el.innerHTML)
      win.document.write('</body></html>')
      win.document.close()
      win.focus()
      win.print()
    },
  },
}

// dateformat produces non-standard strings like "2026-03-17T9:41:43GMT+0100"
// - "GMT" before offset is not valid ISO 8601
// - offset without colon (+0100 vs +01:00) rejected by some browsers
// - single-digit hour (9 vs 09) rejected by some browsers
function parseDate(str) {
  if (!str) return null
  let s = str
  // remove "GMT" before offset
  s = s.replace(/GMT([+-])/, '$1')
  // insert colon in timezone offset: +0100 -> +01:00
  s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  // pad single-digit hour: T9: -> T09:
  s = s.replace(/T(\d):/, 'T0$1:')
  const d = new Date(s)
  return isNaN(d) ? null : d
}

function csvCell(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}
</script>

<style scoped lang="sass">
.tv-card
  background: white

.tv-toolbar
  min-height: 48px

.tv-content
  max-width: 800px
  margin: 0 auto

/* HEADER */
.tv-header
  background: $grey-2
  border-radius: 8px
  padding: 16px

.tv-meta-table
  border-collapse: collapse

.tv-meta-label
  font-weight: 600
  color: $grey-8
  padding: 3px 12px 3px 0
  white-space: nowrap
  vertical-align: top

.tv-meta-value
  padding: 3px 0
  color: $dark

/* SECTIONS */
.tv-section-title
  font-size: 1.05rem
  font-weight: 600
  border-bottom: 2px solid $secondary
  padding-bottom: 4px
  margin-bottom: 12px
  color: $secondary

/* RESULT CARDS */
.tv-result-card
  background: $grey-2
  border: 1px solid $grey-4
  border-radius: 8px
  padding: 12px 8px
  text-align: center
  height: 100%

.tv-result-value
  font-size: 1.5rem
  font-weight: 700
  color: $primary
  line-height: 1.2

.tv-result-label
  font-size: 0.75rem
  color: $grey-7
  margin-top: 4px
  word-break: break-word

/* EVAL */
.tv-eval
  background: $grey-2
  border-radius: 6px
  padding: 12px 16px
  font-size: 0.9rem
  line-height: 1.5
  color: $dark

/* ITEMS TABLE */
.tv-items-table
  width: 100%
  border-collapse: collapse

.tv-items-table th
  border-bottom: 2px solid $grey-5
  padding: 6px 10px
  font-size: 0.75rem
  text-transform: uppercase
  letter-spacing: 0.5px
  color: $grey-7

.tv-items-table td
  border-bottom: 1px solid $grey-3
  padding: 8px 10px
  font-size: 0.875rem

.tv-items-table tbody tr:hover
  background: $grey-2

.tv-item-num
  color: $grey-5
  width: 40px

.tv-item-label
  color: $dark

.tv-item-value
  font-weight: 500
  color: $primary

/* Zeichnung-Vorschau in der Items-Tabelle */
.tv-drawing
  display: block
  max-width: 280px
  width: 100%
  border: 1px solid $grey-4
  border-radius: $radius-sm
  background: #fff

.tv-drawing-actions
  margin-top: 4px

@media print
  .no-print
    display: none !important

@media print
  .tv-toolbar
    display: none !important
</style>
