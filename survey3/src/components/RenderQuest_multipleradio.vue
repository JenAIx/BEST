<template>
  <div class="mr-matrix">
    <!-- KOPFZEILE: Antwort-Spaltenlabels -->
    <div class="row no-wrap mr-head">
      <div class="col mr-corner"></div>
      <div class="col-2 row no-wrap" :class="answerColClass">
        <div class="col mr-col-label" v-for="(answ, indansw) in answers_only" :key="indansw + 'answersonly'">
          <!-- lange Labels: nummerierter Chip + Legende darunter -->
          <span v-if="useLegend" class="mr-chip">{{ indansw + 1 }}</span>
          <!-- kurze Labels: direkt, horizontal (umbricht bei Bedarf) -->
          <span v-else class="mr-col-label__text">{{ answ }}</span>
          <q-tooltip v-if="answ" anchor="top middle" self="bottom middle" class="text-body2">{{ answ }}</q-tooltip>
        </div>
      </div>
    </div>

    <!-- FRAGE-ZEILEN -->
    <div class="row no-wrap mr-row" v-for="(question, index) in ITEM.options.questions"
      :key="'q' + question.tag + index"
      :class="{ 'mr-row--done': val[index] !== null && val[index] !== undefined }">
      <div class="col mr-q-label"><span v-html="question.label"></span></div>
      <div class="col-2 row no-wrap text-center" :class="answerColClass">
        <div class="col mr-cell" v-for="(sa, indsa) in short_answers" :key="indsa + 'shortans'">
          <q-radio :model-value="val[index]" :val="sa.value" color="primary"
            @update:model-value="onRadioChange(index, $event)">
            <q-tooltip anchor="top middle" self="center middle">{{ answers_only[indsa] }}</q-tooltip>
          </q-radio>
        </div>
      </div>
    </div>

    <!-- LEGENDE (nur bei langen Labels) -->
    <div v-if="useLegend" class="mr-legend surface-muted">
      <span v-for="(answ, i) in answers_only" :key="i + 'leg'" class="mr-legend__item">
        <span class="mr-chip mr-chip--sm">{{ i + 1 }}</span>{{ answ }}
      </span>
    </div>
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
    // Breite des Antwort-Blocks abhängig von Anzahl/Länge (zuvor inline dupliziert).
    answerColClass() {
      return {
        'col-10': this.ITEM.verylonganswers === true,
        'col-8': this.answers_only.length > 6,
        'col-6': this.ITEM.longanswers === true || this.answers_only.length > 4,
        'col-4': this.answers_only.length > 2,
      }
    },
    // Lange Antwort-Labels -> nummerierte Spaltenköpfe + Legende statt gequetschtem
    // oder schräg abgeschnittenem Text. Kurze Labels bleiben direkt im Kopf.
    useLegend() {
      if (this.ITEM.rotate === false) return false
      const maxLen = this.answers_only.reduce((m, a) => Math.max(m, (a || '').length), 0)
      return maxLen > 12
    },
  },
  methods: {
    onRadioChange(index, value) {
      const updated = [...this.val]
      updated[index] = value
      this.$emit('emitValue', updated)
    },
  },
}
</script>

<style lang="sass" scoped>
.mr-matrix
  margin-top: $gap-md

// Kopfzeile: gestylter, klebriger Header-Balken
.mr-head
  position: sticky
  top: 0
  z-index: 1
  background: $surface-muted
  border-radius: $radius-sm $radius-sm 0 0
  border-bottom: 2px solid $line
  padding: $gap-sm $gap-xs
  align-items: flex-end

.mr-corner
  min-width: 0

.mr-col-label
  display: flex
  flex-direction: column
  justify-content: flex-end
  align-items: center
  text-align: center
  padding: 0 2px

.mr-col-label__text
  font-size: 0.78rem
  font-weight: 600
  line-height: 1.15
  color: $grey-8

// Nummern-Chip im Kopf (Legenden-Modus)
.mr-chip
  display: inline-flex
  align-items: center
  justify-content: center
  width: 24px
  height: 24px
  border-radius: $radius-pill
  background: $primary
  color: #fff
  font-size: 0.78rem
  font-weight: 600

.mr-chip--sm
  width: 19px
  height: 19px
  font-size: 0.7rem
  margin-right: 6px
  vertical-align: middle

// Frage-Zeilen: Zebra + Hover, beantwortete Zeile dezent hervorgehoben
.mr-row
  align-items: center
  border-bottom: 1px solid $line
  transition: background-color 0.12s ease

.mr-row:nth-child(even)
  background: rgba(15, 23, 42, 0.018)

.mr-row:hover
  background: rgba(25, 118, 210, 0.05)

.mr-row--done .mr-q-label
  color: $grey-9
  font-weight: 500

.mr-q-label
  padding: $gap-sm $gap-sm $gap-sm 0
  line-height: 1.3
  color: $grey-8

.mr-cell
  display: flex
  justify-content: center
  align-items: center
  padding: 2px 0

// Legende unter der Matrix
.mr-legend
  display: flex
  flex-wrap: wrap
  gap: 6px $gap-md
  margin-top: $gap-sm
  padding: $gap-sm $gap-md
  border-radius: 0 0 $radius-sm $radius-sm
  font-size: 0.82rem
  color: $grey-8

.mr-legend__item
  display: inline-flex
  align-items: center
</style>
