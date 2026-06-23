<template>
  <div :data-cy="'quest_' + (QUEST ? QUEST.short_title : 'none')">
    <!-- PROTECTED -->
    <q-chip v-if="PARAMS.mode === 'encrypted'" icon="lock" class="absolute-top-left z-top" />

    <q-card v-if="QUEST !== undefined" flat class="my-quest-form quest-card">
      <!-- HEADER -->
      <q-card-section class="quest-header">
        <div class="row items-center no-wrap">
          <div class="col-auto" v-if="mainStore.DEBUG_MODE || subject_pid === 'DEMO'">
            <q-btn color="grey-7" round flat icon="more_vert" data-cy="btn_hidden_options" :aria-label="$t('btn.options_menu')">
              <q-menu cover auto-close>
                <q-list>
                  <q-item class="my-btn text-center" data-cy="btn_random_fill" clickable @click="randomFill()">
                    <q-item-section>random_fill</q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item class="my-btn text-center" data-cy="btn_reload_quest" clickable @click="rebuildQuests()">
                    <q-item-section>rebuild</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>

          <div class="col">
            <div class="text-h6" data-cy="quest_title">{{ QUEST.title }}</div>
            <!-- PID-Kontext (read-only), wenn die PID bereits vorgegeben ist -->
            <div v-if="!hasPidStep && subject_pid" class="text-caption text-grey-7" data-cy="quest_pid_context">
              {{ $t('quest.pid') }}: {{ subject_pid }}
            </div>
          </div>

          <!-- FOKUS ⇄ LISTE -->
          <div class="col-auto" v-if="showChrome">
            <q-btn flat round dense :icon="focusMode ? 'view_agenda' : 'view_headline'"
              color="grey-7" data-cy="btn_toggle_focus"
              :aria-label="focusMode ? $t('quest.list_mode') : $t('quest.focus_mode')" @click="toggleMode()">
              <q-tooltip>{{ focusMode ? $t('quest.list_mode') : $t('quest.focus_mode') }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </q-card-section>

      <!-- GLOBALER FORTSCHRITT (Fragebogen-Kette) -->
      <div v-if="showChrome && chainTotal > 1" class="quest-chain">
        <q-linear-progress :value="chainPercent / 100" rounded size="4px" color="secondary"
          track-color="grey-3" data-cy="quest_chain_progress" />
        <div class="text-caption text-grey-7 q-mt-xs text-center" data-cy="quest_chain">
          {{ $t('quest.chain_of', { current: chainIndex, total: chainTotal }) }}
        </div>
      </div>

      <!-- PROGRESS -->
      <div v-if="showChrome" class="quest-progress">
        <q-linear-progress :value="progress.percent / 100" rounded size="6px" color="primary"
          track-color="grey-3" data-cy="quest_progress" />
        <div class="row items-center justify-between q-mt-xs text-caption text-grey-7">
          <span v-if="focusMode && stepCounter">{{ stepCounter }}</span>
          <span v-else>&nbsp;</span>
          <span data-cy="quest_answered">{{ $t('quest.answered', { filled: progress.filled, total: progress.total }) }}</span>
        </div>
      </div>

      <!-- MANUAL -->
      <q-card-section v-if="QUEST.manual" class="quest-manual surface-muted q-mx-md q-mt-sm">
        <div v-html="QUEST.manual"></div>
      </q-card-section>

      <!-- ============================ FOKUS-MODUS ============================ -->
      <template v-if="focusMode">
        <q-card-section ref="stepBox" class="quest-step" @keyup.enter="onEnter">
          <!-- PID-SCHRITT -->
          <template v-if="step && step.kind === 'pid'">
            <div class="text-subtitle1 q-mb-md">{{ $t('quest.start') }}</div>
            <QuestPidField v-model="subject_pid" :hint="PID_HINT_TEXT" autofocus @enter="onEnter" />
          </template>

          <!-- FRAGE-SCHRITT -->
          <template v-else-if="step && step.kind === 'item'">
            <QuestIntro :blocks="step.intro" />
            <QuestItemField :item="step.item" :error="currentError" input-cy="item_input"
              :preview="isPreview" data-cy="list_entries" @emitValue="onValue(step.item, $event)" />
          </template>

          <!-- INFO-SCHRITT (abschließende Hinweise) -->
          <template v-else-if="step && step.kind === 'info'">
            <QuestIntro :blocks="step.intro" />
          </template>

          <!-- ÜBERSICHT / REVIEW -->
          <template v-else-if="step && step.kind === 'review'">
            <div class="text-subtitle1 q-mb-xs">{{ $t('quest.review_title') }}</div>
            <div class="text-caption text-grey-7 q-mb-md">{{ $t('quest.review_hint') }}</div>
            <q-list separator>
              <q-item v-for="rev in reviewList" :key="'rev' + rev.stepIndex" clickable v-ripple
                @click="goTo(rev.stepIndex)" data-cy="review_item">
                <q-item-section avatar>
                  <q-icon :name="rev.icon" :color="rev.color" />
                </q-item-section>
                <q-item-section>
                  <q-item-label lines="2"><span v-html="rev.label" /></q-item-label>
                  <q-item-label caption :class="rev.status === 'required' ? 'text-red' : ''">{{ rev.statusText }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="edit" color="grey-5" />
                </q-item-section>
              </q-item>
            </q-list>
          </template>
        </q-card-section>

        <!-- NAVIGATION -->
        <q-card-section class="quest-nav row items-center justify-between">
          <q-btn flat no-caps color="grey-8" icon="arrow_back" :label="$t('quest.prev')" :disable="currentStep === 0"
            data-cy="quest_prev" @click="goPrev()" />

          <template v-if="isFinalStep">
            <q-btn v-if="!embedded" rounded color="primary" :label="$t('btn.submit')" icon-right="check"
              data-cy="submitquest" @click="emitEvent()" />
            <q-chip v-else outline color="grey-7" icon="south">{{ $t('visit.finish') }}</q-chip>
          </template>
          <q-btn v-else rounded color="primary" :label="$t('quest.next')" icon-right="arrow_forward"
            data-cy="quest_next" @click="goNext()" />
        </q-card-section>
      </template>

      <!-- ============================ LISTEN-MODUS ============================ -->
      <template v-else>
        <!-- PID (im Visiten-/Preview-Modus sowie bei vorgegebener PID ausgeblendet) -->
        <q-card-section v-if="hasPidStep">
          <QuestPidField v-model="subject_pid" :hint="PID_HINT_TEXT" />
        </q-card-section>

        <q-card-section>
          <q-list bordered separator data-cy="list_entries">
            <q-item v-for="(item, indQ) in QUEST.items" :key="item.label + indQ" data-cy="item_entry"
              :id="'qitem_' + indQ" class="quest-list-item"
              :class="{ 'quest-item--done': isInteractive(item) && isAnswered(item) }">
              <q-item-section>
                <!-- interaktive Frage -->
                <QuestItemField v-if="isInteractive(item)" :item="item" input-cy="text"
                  :preview="isPreview"
                  :error="submit_clicked && CHECK_FORM !== true && CHECK_FORM[indQ] === false"
                  @emitValue="item.value = $event" />
                <!-- nicht-interaktiv: Überschrift / Hinweis / Bild -->
                <template v-else>
                  <q-item-label title><span v-html="item.label" /></q-item-label>
                  <q-item-label v-if="item.caption !== null || item.type === 'separator'" caption>
                    <span v-html="item.caption" />
                  </q-item-label>
                  <q-item-label v-if="item.type === 'image'">
                    <span v-for="(img, imgind) of item.value" :key="imgind + 'img'">
                      <img :src="`img/${img}`" alt="" :style="`width: ${item.width}px`">
                    </span>
                  </q-item-label>
                </template>
              </q-item-section>
              <!-- dezenter "beantwortet"-Haken: absolut, verschiebt das Layout nicht -->
              <q-icon v-if="isInteractive(item) && isAnswered(item)" name="check_circle"
                color="positive" size="20px" class="quest-done-check" />
            </q-item>
          </q-list>
        </q-card-section>

        <!-- SPRUNG ZUR NÄCHSTEN OFFENEN FRAGE -->
        <q-card-section v-if="!isPreview && firstOpenIndex !== -1" class="text-center q-pt-none">
          <q-btn flat no-caps color="primary" icon="south" :label="$t('quest.next_open')" data-cy="quest_next_open"
            @click="scrollToOpen()" />
        </q-card-section>

        <!-- SUBMIT -->
        <q-card-section v-if="!isPreview && !embedded">
          <div class="text-center q-pb-xl">
            <q-btn rounded :label="$t('btn.submit')" type="submit" color="primary" @click="emitEvent()"
              data-cy="submitquest" class="my-btn" />
          </div>
        </q-card-section>
      </template>

      <!-- CHECK ERROR / SUCCESS HOOKS (E2E) -->
      <span v-if="submit_clicked && (CHECK_FORM !== true || CHECK_PID !== true)" data-cy="check_error_banner"></span>
      <span v-if="CHECK_PID && CHECK_FORM" data-cy="check_sucess"></span>
    </q-card>

    <div v-else class="q-ma-xl text-center">QUEST: undefined</div>
  </div>
</template>

<script>
import { log } from 'src/tools/Logger'
import { parseRouteParams } from 'src/tools/routeParams'
import { useMainStore } from 'src/stores/main'
import { itemValidity, answerStats, isAnswered as isItemAnswered } from 'src/tools/visits/visit-model'
import QuestItemField from './QuestItemField.vue'
import QuestIntro from './QuestIntro.vue'
import QuestPidField from './QuestPidField.vue'

const INTERACTIVE = ['radio', 'checkbox', 'text', 'number', 'date', 'date_year', 'time', 'slider', 'multiple_radio', 'drawing']

export default {
  name: 'RenderQuest',
  components: { QuestItemField, QuestIntro, QuestPidField },
  props: {
    QUEST_LABEL: { default: undefined },
    saved: { default: undefined },
    PID: { default: undefined },
    PREVIEWQUEST: { default: undefined },
    embedded: { type: Boolean, default: false },
  },
  setup() {
    return { mainStore: useMainStore() }
  },

  data() {
    return {
      check_form: undefined,
      submit_clicked: false,
      subject_pid: '',
      currentStep: 0,
      currentError: false,
      advTimer: null,
    }
  },

  mounted() {
    log({ debug: 'QUEST mounted' })
    if (this.PARAMS.PID !== undefined) this.subject_pid = this.PARAMS.PID
    this.$nextTick(() => this.focusStep())
  },

  computed: {
    isPreview() {
      return this.PREVIEWQUEST !== undefined
    },
    showChrome() {
      return !this.isPreview
    },
    focusMode() {
      if (this.isPreview) return false
      // Adaptiv: explizite Nutzerwahl gewinnt; sonst Fokus auf schmalen Screens
      // (iPhone/xs), Liste auf iPad/Desktop.
      const s = this.mainStore.SETTINGS.quest_focus_mode
      if (typeof s === 'boolean') return s
      return this.$q.screen.lt.sm
    },
    autoAdvance() {
      return this.mainStore.SETTINGS.quest_auto_advance !== false
    },
    // Durchgeklickter Preset-Flow (mehrere Bögen, vom Untersucher gestartet) —
    // im Gegensatz zum Einzelbogen/Direktlink (mode 'single' bzw. ohne mode).
    isPresetFlow() {
      if (this.embedded || this.isPreview) return false
      return !!this.PARAMS.mode && this.PARAMS.mode !== 'single'
    },
    // PID nur abfragen, wenn nicht bereits vorgegeben (Preset-Flow reicht sie durch).
    hasPidStep() {
      return !this.embedded && !this.isPreview && this.PARAMS.PID === undefined
    },
    // Review-Übersicht nur außerhalb des Preset-Flows zeigen (Embedded/Visit
    // und Einzelbogen behalten sie; im Preset-Flow stört sie das Durchklicken).
    showReview() {
      return this.embedded || this.isPreview || !this.isPresetFlow
    },
    // --- globaler Fortschritt über die Fragebogen-Kette ---
    chainTotal() {
      return this.mainStore.QUESTMAN.preset_total
    },
    chainIndex() {
      return this.mainStore.QUESTMAN.preset_index
    },
    chainPercent() {
      if (this.chainTotal <= 0) return 0
      const done = Math.max(0, this.chainIndex - 1)
      return Math.round(((done + this.progress.percent / 100) / this.chainTotal) * 100)
    },
    PID_HINT_TEXT() {
      if (this.PARAMS.PID !== undefined) return ''
      return this.$t('quest.pid_hint')
    },
    PARAMS() {
      if (this.isPreview || this.embedded) return {}
      return parseRouteParams(this.$route.params.id) || {}
    },
    QUEST() {
      if (this.isPreview) return this.PREVIEWQUEST
      return this.mainStore.ACTIVE_QUEST
    },
    items() {
      return this.QUEST && Array.isArray(this.QUEST.items) ? this.QUEST.items : []
    },
    progress() {
      return answerStats(this.items)
    },
    // geordnete Schrittliste: [pid?] → Frage-Schritte (mit Intro-Kontext) → [info?] → [review?]
    // PID-Schritt entfällt, wenn die PID bereits vorgegeben ist (Preset-Flow);
    // Review-Schritt entfällt im durchgeklickten Preset-Flow (siehe showReview).
    steps() {
      const out = []
      if (this.hasPidStep) out.push({ kind: 'pid' })
      let intro = []
      this.items.forEach((item, index) => {
        if (this.isInteractive(item)) {
          out.push({ kind: 'item', index, item, intro })
          intro = []
        } else {
          intro.push(item)
        }
      })
      if (intro.length) out.push({ kind: 'info', intro })
      if (this.showReview) out.push({ kind: 'review' })
      return out
    },
    isFinalStep() {
      return this.currentStep >= this.steps.length - 1
    },
    itemSteps() {
      return this.steps.filter((s) => s.kind === 'item')
    },
    step() {
      return this.steps[Math.min(this.currentStep, this.steps.length - 1)]
    },
    stepCounter() {
      if (!this.step || this.step.kind !== 'item') return ''
      const n = this.itemSteps.findIndex((s) => s.index === this.step.index) + 1
      return this.$t('quest.step_of', { current: n, total: this.itemSteps.length })
    },
    reviewList() {
      return this.steps
        .map((s, stepIndex) => ({ s, stepIndex }))
        .filter(({ s }) => s.kind === 'item')
        .map(({ s, stepIndex }) => {
          const status = this.reviewStatus(s.item)
          const map = {
            done: { icon: 'check_circle', color: 'positive', statusText: this.$t('quest.answered_short') },
            required: { icon: 'error', color: 'negative', statusText: this.$t('quest.required_open') },
            optional: { icon: 'radio_button_unchecked', color: 'grey-5', statusText: this.$t('quest.optional') },
          }
          const entry = { stepIndex, label: s.item.label, status, ...map[status] }
          // multiple_radio: Teilfragen-Zähler statt nur Status (X von N beantwortet)
          if (s.item.type === 'multiple_radio') {
            const total = s.item.options && s.item.options.questions ? s.item.options.questions.length : 0
            const answered = Array.isArray(s.item.value)
              ? s.item.value.slice(0, total).filter((x) => x !== null && x !== undefined).length
              : 0
            entry.statusText = this.$t('quest.answered', { filled: answered, total })
          }
          return entry
        })
    },
    firstOpenIndex() {
      return this.items.findIndex((it) => itemValidity(it, it.value) === false)
    },
    CHECK_PID() {
      return this.subject_pid.length > 0
    },
    CHECK_FORM() {
      return this.check_form
    },
  },

  methods: {
    isInteractive(item) {
      return INTERACTIVE.includes(item.type)
    },
    toggleMode() {
      this.mainStore.SETTINGS.quest_focus_mode = !this.focusMode
      this.currentStep = 0
      this.currentError = false
      this.$nextTick(() => this.focusStep())
    },
    reviewStatus(item) {
      const required = item.force !== false
      if (this.isAnswered(item)) return 'done'
      return required ? 'required' : 'optional'
    },
    // Delegiert an die geteilte Wert-Logik (eine Wahrheit mit itemValidity).
    isAnswered(item) {
      return isItemAnswered(item, item.value)
    },
    onValue(item, value) {
      item.value = value
      this.currentError = false
      if (this.focusMode && this.autoAdvance && item.type === 'radio') {
        clearTimeout(this.advTimer)
        this.advTimer = setTimeout(() => {
          if (this.step && this.step.kind === 'item' && this.step.item === item) this.goNext()
        }, 280)
      }
    },
    goNext() {
      const s = this.step
      if (!s) return
      if (s.kind === 'pid') {
        if (this.PARAMS.PID === undefined && this.subject_pid.length === 0) {
          this.submit_clicked = true
          this.$q.notify({ message: this.$t('quest.pid_hint'), color: 'warning' })
          return
        }
      }
      if (s.kind === 'item' && itemValidity(s.item, s.item.value) === false) {
        this.currentError = true
        return
      }
      if (this.currentStep < this.steps.length - 1) {
        this.currentStep++
        this.currentError = false
        this.$nextTick(() => this.focusStep())
      }
    },
    goPrev() {
      if (this.currentStep > 0) {
        this.currentStep--
        this.currentError = false
        this.$nextTick(() => this.focusStep())
      }
    },
    goTo(i) {
      this.currentStep = Math.max(0, Math.min(i, this.steps.length - 1))
      this.currentError = false
      this.$nextTick(() => this.focusStep())
    },
    focusStep() {
      const el = this.$refs.stepBox && this.$refs.stepBox.$el
      if (!el) return
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      // Text-/Zahleneingaben automatisch fokussieren (nicht aber Radios/Slider — würde irritieren)
      if (this.step && this.step.kind === 'item' &&
        ['text', 'number', 'date', 'date_year', 'time'].includes(this.step.item.type)) {
        const f = el.querySelector('input:not([type=hidden]), textarea')
        if (f) f.focus()
      }
    },
    onEnter(e) {
      if (e && e.target && e.target.tagName === 'TEXTAREA') return // Zeilenumbruch erlauben
      this.goNext()
    },
    scrollToOpen() {
      const i = this.firstOpenIndex
      if (i === -1) return
      const el = document.getElementById('qitem_' + i)
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    firstInvalidStepIndex() {
      return this.steps.findIndex((s) => s.kind === 'item' && itemValidity(s.item, s.item.value) === false)
    },
    randomFill() {
      this.mainStore.QuestMan.random_fill()
      this.subject_pid = this.subject_pid || Date.now().toString()
    },
    async rebuildQuests() {
      if (!(await this.$confirm(this.$t('btn.reset_confirm')))) return
      this.mainStore.QUESTMAN._init()
    },
    // Logikprüfung auslösen (für Embedded-/Visiten-Modus, via $ref aufrufbar).
    runCheck() {
      this.submit_clicked = true
      this.check_form = this.mainStore.QUESTMAN.check_activeQuest()
      if (this.check_form !== true && this.focusMode) {
        const idx = this.firstInvalidStepIndex()
        if (idx !== -1) this.goTo(idx)
        this.currentError = true
      }
      return this.check_form
    },
    emitEvent() {
      this.submit_clicked = true
      this.check_form = this.mainStore.QUESTMAN.check_activeQuest()
      const errors = []
      if (!this.CHECK_PID) errors.push(this.$t('quest.PID_missing'))
      if (this.check_form !== true) errors.push(this.$t('quest.check_failed'))
      const str = errors.join(' ')
      if (str.length > 0) {
        this.$q.notify({ message: str, color: 'warning' })
        if (this.focusMode) {
          if (!this.CHECK_PID) this.goTo(0)
          else {
            const idx = this.firstInvalidStepIndex()
            if (idx !== -1) this.goTo(idx)
          }
        }
        return false
      }
      this.$emit('emitForm', {
        PID: this.subject_pid,
        quest: this.mainStore.QUESTMAN.summary,
      })
    },
  },
}
</script>

<style lang="sass" scoped>
.quest-card
  border-radius: $radius

.quest-header
  padding-bottom: 4px

// Auf schmalen Screens rechts Platz für den schwebenden 3-Punkte-Button
// (BackButton-Overlay) freihalten -> kein Überlappen mit dem Fokus-Umschalter.
@media (max-width: 599px)
  .quest-header
    padding-right: 48px

.quest-chain
  background: $surface
  padding: $gap-sm $gap-md 0

.quest-progress
  position: sticky
  top: 0
  z-index: 2
  background: $surface
  padding: $gap-sm $gap-md 4px

.quest-manual
  padding: 12px $gap-md
  font-size: 0.9em
  color: $grey-8

.quest-step
  min-height: 200px
  padding: $gap-md $gap-md $gap-lg

.quest-nav
  position: sticky
  bottom: 0
  z-index: 2
  background: $surface
  border-top: 1px solid $line
  padding: $gap-sm $gap-md
  padding-bottom: calc(#{$gap-sm} + env(safe-area-inset-bottom))

// Beantwortete Fragen (Listen-Modus) dezent zurücknehmen; beim Bearbeiten
// (Hover/Fokus) wieder voll sichtbar.
.quest-list-item
  position: relative

.quest-item--done
  opacity: 0.55
  transition: opacity 0.2s ease
  &:hover,
  &:focus-within
    opacity: 1

// "beantwortet"-Haken als Overlay (kein Layout-Shift der Spalten)
.quest-done-check
  position: absolute
  top: 6px
  right: 6px
  z-index: 1
</style>
