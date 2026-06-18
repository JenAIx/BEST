<template>
  <!-- Echte Tabelle: Spaltenlabels stehen lesbar direkt über der Spalte;
       Fragenspalte bleibt fixiert; zu breite Matrizen scrollen horizontal. -->
  <div class="mr-scroll">
    <table class="mr-table">
      <thead>
        <tr :class="{ 'mr-thead--rot': rotateLong }">
          <th class="mr-th-q" :style="{ width: qColWidth }"></th>
          <th class="mr-th-a" :class="{ 'mr-th-a--rot': isRot(answ) }"
            v-for="(answ, indansw) in answers_only" :key="indansw + 'a'">
            <span class="mr-th-a__txt">{{ answ }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(question, index) in ITEM.options.questions" :key="'q' + question.tag + index"
          :class="{ 'mr-row--done': val[index] !== null && val[index] !== undefined }">
          <td class="mr-td-q" :style="{ width: qColWidth }"><span v-html="question.label"></span></td>
          <td class="mr-td-a" v-for="(sa, indsa) in short_answers" :key="indsa + 's'">
            <q-radio :model-value="val[index]" :val="sa.value" color="primary" dense
              @update:model-value="onRadioChange(index, $event)">
              <q-tooltip anchor="top middle" self="center middle">{{ answers_only[indsa] }}</q-tooltip>
            </q-radio>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'RenderMultipleRadio',
  props: ['ITEM'],
  computed: {
    val: {
      get() {
        if (this.ITEM.example_value) return this.ITEM.example_value
        if (this.ITEM.value && this.ITEM.value.length > 0) return this.ITEM.value
        return new Array(this.ITEM.options.questions.length).fill(null)
      },
      set(v) {
        this.$emit('emitValue', v)
      },
    },
    short_answers() {
      var out = []
      this.ITEM.options.answers.forEach((v) => {
        out.push({ label: '', value: v.value })
      })
      return out
    },
    answers_only() {
      var out = []
      this.ITEM.options.answers.forEach((v) => {
        out.push(v.label)
      })
      return out
    },
    // Fragenspalte schmaler bei vielen Antwortspalten (mehr Platz für die Radios).
    qColWidth() {
      const n = this.answers_only.length
      if (n >= 10) return '28%'
      if (n >= 6) return '36%'
      return '46%'
    },
    // Viele Spalten -> Spalten zu schmal für horizontalen Langtext.
    rotateLong() {
      if (this.ITEM.rotate === false) return false
      return this.answers_only.length >= 7
    },
  },
  methods: {
    // Nur längere Labels in schmalen Matrizen schräg stellen; kurze (Zahlen)
    // bleiben horizontal -> vermeidet hässliche Wort-Umbrüche.
    isRot(label) {
      return this.rotateLong && (label || '').length > 3
    },
    onRadioChange(index, value) {
      const updated = [...this.val]
      updated[index] = value
      this.$emit('emitValue', updated)
    },
  },
}
</script>

<style lang="sass" scoped>
.mr-scroll
  margin-top: $gap-md
  overflow-x: auto
  -webkit-overflow-scrolling: touch
  border: 1px solid $line
  border-radius: $radius-sm

// table-layout: fixed -> Tabelle füllt immer exakt die Kartenbreite, Spalten
// teilen sich den Platz, Labels brechen um (kein horizontales Überlaufen).
.mr-table
  width: 100%
  table-layout: fixed
  border-collapse: collapse
  font-size: 0.9rem

.mr-table th,
.mr-table td
  padding: 8px 3px

// Antwort-Spaltenköpfe: lesbar direkt über der Spalte, umbrechend
.mr-th-a
  position: relative
  text-align: center
  vertical-align: bottom
  font-size: 0.74rem
  font-weight: 600
  line-height: 1.12
  color: $grey-8
  background: $surface-muted
  border-bottom: 2px solid $line
  overflow-wrap: break-word
  hyphens: auto

// Schmale Matrizen mit Langtext: Kopf höher, lange Labels schräg (kein Umbruch)
.mr-thead--rot .mr-th-a,
.mr-thead--rot .mr-th-q
  height: 104px

.mr-th-a__txt
  display: inline-block

// Vertikaltext (von unten nach oben): bleibt in der schmalen Spalte, kein
// horizontales Klippen und keine Wort-Umbrüche.
.mr-th-a--rot .mr-th-a__txt
  white-space: nowrap
  writing-mode: vertical-rl
  transform: rotate(180deg)
  font-weight: 600

// Fragenspalte: Breite adaptiv via :style (qColWidth), links ausgerichtet
.mr-th-q,
.mr-td-q
  text-align: left

.mr-th-q
  background: $surface-muted
  border-bottom: 2px solid $line

.mr-td-q
  line-height: 1.3
  color: $grey-8
  overflow-wrap: break-word

.mr-td-a
  text-align: center
  border-top: 1px solid $line

// dezente Zebra-Streifen (solide, damit die fixierte Spalte sauber deckt)
.mr-table tbody tr:nth-child(even) td
  background: #f8f9fb

.mr-table tbody tr:hover td
  background: rgba(25, 118, 210, 0.06)

.mr-row--done .mr-td-q
  font-weight: 500
  color: $grey-9

// Radio mittig in der Zelle
.mr-td-a :deep(.q-radio)
  margin: 0
</style>
