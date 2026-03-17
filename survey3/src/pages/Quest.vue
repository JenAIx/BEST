<template>
  <q-page data-cy="page_quest" class="page-size">
    <div class="column items-center">
      <!-- NO PARAMS -->
      <div v-if="noPARAMStxt !== undefined">
         <q-banner inline-actions class="text-white bg-red">
            {{this.noPARAMStxt}}
            <template v-slot:action>
            <q-btn flat color="white" :label="$t('btn.back.label')" @click="$router.push('/')" />
            </template>
        </q-banner>
      </div>
      <!-- TITEL -->
      <!-- FORM -->
      <div v-if="status && QUEST_LABEL !== null && QUEST_LABEL !== undefined">
        <RenderQuest  @emitForm="questAction" @emitBack="gotoselect" :key="timenow" />
      </div>

      <!-- RETURN BUTTON -->
      <div v-else class="col text-center">
        <div>
          {{$t('quest.not_found')}}: {{PARAMS}}
        </div>
      </div>
    </div>

    <!-- BACKBUTTON -->
    <BACKBUTTON :ask="true" :hidden="true" :showPdfExport="true" @pdfExport="exportPdf" />
  </q-page>
</template>

<script>
import BACKBUTTON from 'src/components/BackButton.vue'
import RenderQuest from 'src/components/RenderQuest.vue'
import { parseRouteParams } from 'src/tools/routeParams'
import { useMainStore } from 'src/stores/main'
export default {
  name: 'Questionnaire',
  components: {BACKBUTTON, RenderQuest},
  setup() {
    return { mainStore: useMainStore() }
  },
  data() {
    return {
      noPARAMStxt: undefined,
      timenow: Date.now(),
      status: true
    }
  },
  mounted() {
    this.mainStore.leftDrawerOpen = false
    this.mainStore.PROTECTED_MODE = true
    this.mainStore.exportClear()
    this.loadQuest()
  },

  watch: {
    $route(){
      // this.loadQuest()
    }
  },

  methods: {
    loadQuest() {
      this.QUESTMAN.clear_preset()
      if (this.PARAMS === undefined || this.PARAMS.presets === undefined) return (this.noPARAMStxt = 'keine Parameter gesetzt!')
      this.QUESTMAN.presets = this.PARAMS.presets

      const status = this.QUESTMAN.next()
      if (!status) return
    },

    gotoselect() {
      this.$router.push('/select')
    },

    // HIER KOMMEN DIE DATEN AUS DER FORM
    questAction(val) {
      if (val !== undefined) {
        this.timenow = Date.now() // rerender renderquest
        this.mainStore.storage_add(val)
        this.$q.notify({
          message: this.$t('quest.export_success'),
          color: 'green'
        })
        // encrypted mode?
        if (this.PARAMS.mode === 'encrypted') this.export_encrypted()
        // next quest
        this.status = this.QUESTMAN.next()

        if (this.status !== true) this.$router.push({path: '/finished_quest'}).catch(err => this.$router.push('/finished_quest'))


      } else {
        this.$q.notify({
          message: this.$t('quest.export_failed'),
          color: 'warning'
        })
      }
    },

    // EXPORT A QUEST IN ENCRYPTION MODE
    export_encrypted() {
      this.mainStore.storage_encrypted_export(this.PARAMS)
    },

    // PDF EXPORT
    exportPdf() {
      const quest = this.mainStore.ACTIVE_QUEST
      if (!quest) return

      const now = new Date()
      const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

      const win = window.open('', '_blank')
      if (!win) return

      win.document.write(this._buildPdfHtml(quest, dateStr, timeStr))
      win.document.close()
      win.focus()
      win.print()
    },

    _buildPdfHtml(quest, dateStr, timeStr) {
      const items = quest.items || []
      let bodyHtml = ''
      let itemNum = 0
      const esc = (s) => s == null ? '' : String(s)
      // Check if label already starts with a number (e.g. "1. Traurigkeit", "5a)")
      const hasOwnNum = (lbl) => /^\s*\d/.test(lbl)
      const numPrefix = (n, lbl) => hasOwnNum(lbl) ? '' : `<span class="item-num">${n}.</span> `

      items.forEach((item) => {
        // Separators / textbox / undefined type → section header or instruction text
        if (!item.type || item.type === 'separator' || item.type === 'seperator' || item.type === 'textbox') {
          const label = item.label || ''
          const caption = item.caption || ''
          if (label || caption) {
            bodyHtml += `<div class="section-block">`
            if (label) bodyHtml += `<div class="section-label">${label}</div>`
            if (caption) bodyHtml += `<div class="section-caption">${caption}</div>`
            bodyHtml += `</div>`
          }
          return
        }
        if (item.type === 'image') return

        // Multiple radio → compact table (questions × answer columns)
        if (item.type === 'multiple_radio' && item.options && item.options.questions) {
          const groupLabel = (item.label || '').replace(/<[^>]*>/g, ' ').trim()
          const answers = item.options.answers || []
          const questions = item.options.questions || []

          if (groupLabel) {
            bodyHtml += `<div class="section-block"><div class="section-label">${groupLabel}</div></div>`
          }

          bodyHtml += `<table class="mr-table"><thead><tr><th class="mr-q"></th>`
          answers.forEach(a => {
            bodyHtml += `<th class="mr-a">${esc(a.label)}</th>`
          })
          bodyHtml += `</tr></thead><tbody>`
          questions.forEach((q) => {
            itemNum++
            const qLabel = esc(q.label || q.tag || `Frage ${itemNum}`)
            const mrPfx = hasOwnNum(qLabel) ? '' : `<span class="mr-num">${itemNum}.</span> `
            bodyHtml += `<tr><td class="mr-q">${mrPfx}${qLabel}</td>`
            answers.forEach(() => {
              bodyHtml += `<td class="mr-a"><span class="radio-circle"></span></td>`
            })
            bodyHtml += `</tr>`
          })
          bodyHtml += `</tbody></table>`
          return
        }

        itemNum++
        const label = (item.label || '').replace(/<[^>]*>/g, ' ').trim()

        // Radio → show options inline with circles
        if (item.type === 'radio' && item.options) {
          bodyHtml += `<div class="item-block">
            <div class="item-label">${numPrefix(itemNum, label)}${label}</div>
            <div class="radio-options">`
          item.options.forEach(o => {
            bodyHtml += `<label class="radio-opt"><span class="radio-circle"></span> ${esc(o.label)}</label>`
          })
          bodyHtml += `</div></div>`
          return
        }

        // Checkbox → show options with squares
        if (item.type === 'checkbox' && item.options) {
          bodyHtml += `<div class="item-block">
            <div class="item-label">${numPrefix(itemNum, label)}${label}</div>
            <div class="radio-options">`
          item.options.forEach(o => {
            bodyHtml += `<label class="radio-opt"><span class="check-box"></span> ${esc(o.label)}</label>`
          })
          bodyHtml += `</div></div>`
          return
        }

        // Text → label + write line
        if (item.type === 'text') {
          bodyHtml += `<div class="item-block">
            <div class="item-label">${numPrefix(itemNum, label)}${label}</div>
            <div class="input-line"></div>
          </div>`
          return
        }

        // Number / Date / Time / Slider → label + short input box
        if (['number', 'date', 'date_year', 'time', 'slider'].includes(item.type)) {
          const hint = item.type === 'time' ? 'hh:mm' : item.type === 'date' ? 'TT.MM.JJJJ' : item.type === 'date_year' ? 'JJJJ' : ''
          bodyHtml += `<div class="item-block item-inline">
            <div class="item-label">${numPrefix(itemNum, label)}${label}</div>
            <div class="input-box">${hint ? `<span class="input-hint">${hint}</span>` : ''}</div>
          </div>`
          return
        }

        // Fallback
        bodyHtml += `<div class="item-block">
          <div class="item-label">${numPrefix(itemNum, label)}${label}</div>
          <div class="input-line"></div>
        </div>`
      })

      // PID field at the top
      const pidHtml = `<div class="pid-block">
        <span class="pid-label">Patienten-ID / Code:</span>
        <span class="pid-line"></span>
        <span class="pid-label" style="margin-left:24px">Datum:</span>
        <span class="pid-line-short"></span>
      </div>`

      return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${quest.title} — PDF Export</title>
<style>
  @page {
    size: A4;
    margin: 16mm 14mm 16mm 14mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 9.5pt;
    color: #1a1a1a;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2.5px solid #333;
    padding-bottom: 8px;
    margin-bottom: 14px;
  }
  .header-left h1 {
    font-size: 15pt;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
  }
  .header-left .subtitle {
    font-size: 9pt;
    color: #666;
    margin-top: 2px;
  }
  .header-right {
    text-align: right;
    font-size: 8pt;
    color: #999;
    line-height: 1.5;
  }

  /* PID */
  .pid-block {
    display: flex;
    align-items: baseline;
    margin-bottom: 16px;
    font-size: 9pt;
  }
  .pid-label { font-weight: 600; color: #333; white-space: nowrap; }
  .pid-line {
    flex: 1;
    border-bottom: 1px solid #999;
    margin-left: 8px;
    min-width: 120px;
    height: 16px;
  }
  .pid-line-short {
    border-bottom: 1px solid #999;
    margin-left: 8px;
    width: 100px;
    height: 16px;
  }

  /* Section blocks */
  .section-block {
    margin: 14px 0 6px;
    page-break-inside: avoid;
  }
  .section-label {
    font-weight: 600;
    font-size: 10pt;
    color: #1a1a1a;
    border-left: 3px solid #555;
    padding-left: 8px;
  }
  .section-caption {
    font-size: 8.5pt;
    color: #666;
    margin-top: 2px;
    padding-left: 11px;
  }

  /* Item blocks */
  .item-block {
    margin: 8px 0;
    page-break-inside: avoid;
  }
  .item-label {
    color: #333;
    margin-bottom: 3px;
  }
  .item-num {
    color: #999;
    font-size: 8.5pt;
    min-width: 20px;
    display: inline-block;
  }
  .item-inline {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .item-inline .item-label { flex: 1; margin-bottom: 0; }

  /* Input elements */
  .input-line {
    border-bottom: 1px solid #bbb;
    height: 20px;
    margin-top: 2px;
  }
  .input-box {
    border: 1px solid #bbb;
    border-radius: 3px;
    min-width: 80px;
    width: 100px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .input-hint {
    font-size: 7.5pt;
    color: #ccc;
    letter-spacing: 1px;
  }

  /* Radio / Checkbox options */
  .radio-options {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-top: 3px;
    padding-left: 20px;
  }
  .radio-opt {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 9pt;
    color: #444;
    cursor: default;
  }
  .radio-circle {
    display: inline-block;
    width: 11px;
    height: 11px;
    border: 1.5px solid #888;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .check-box {
    display: inline-block;
    width: 11px;
    height: 11px;
    border: 1.5px solid #888;
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* Multiple-radio compact table */
  .mr-table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 12px;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }
  .mr-table th {
    padding: 4px 6px;
    font-weight: 600;
    color: #555;
    border-bottom: 2px solid #ccc;
    text-align: center;
    font-size: 7.5pt;
    line-height: 1.3;
  }
  .mr-table th.mr-q {
    text-align: left;
    width: 50%;
  }
  .mr-table td {
    padding: 4px 6px;
    border-bottom: 1px solid #eee;
    vertical-align: middle;
  }
  .mr-table td.mr-q {
    color: #333;
  }
  .mr-table td.mr-a {
    text-align: center;
  }
  .mr-num {
    color: #999;
    font-size: 8pt;
  }
  .mr-table .radio-circle {
    width: 10px;
    height: 10px;
  }

  /* Manual / description */
  .manual {
    background: #f7f7f7;
    border-left: 3px solid #555;
    padding: 8px 12px;
    margin-bottom: 14px;
    font-size: 8.5pt;
    color: #444;
    page-break-inside: avoid;
  }
  .manual p { margin-bottom: 3px; }

</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${esc(quest.title)}</h1>
      ${quest.description ? `<div class="subtitle">${esc(quest.description)}</div>` : ''}
    </div>
    <div class="header-right">
      ${dateStr}<br>${timeStr}
    </div>
  </div>

  ${pidHtml}

  ${quest.manual ? `<div class="manual">${quest.manual}</div>` : ''}

  ${bodyHtml}

</body>
</html>`
    }
  },

  computed: {
    PARAMS() {
      return parseRouteParams(this.$route.params.id)
    },
    QUEST_LABEL() {
      return this.mainStore.ACTIVE_QUEST_LABEL
    },
    QUESTMAN() {
      return this.mainStore.QUESTMAN
    }
  }
}
</script>
