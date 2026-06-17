<template>
  <div :data-cy="'quest_' + (QUEST ? QUEST.short_title : 'none')">
    <!-- PROTECTED -->
    <q-chip v-if="PARAMS.mode === 'encrypted'" icon="lock" class="absolute-top-left z-top" />

    <q-card v-if="QUEST !== undefined" flat class="my-quest-form quest-card">
      <!-- HEADING -->
      <q-card-section class="quest-header">
        <div class="row items-center no-wrap">
          <div class="col-auto" v-if="mainStore.DEBUG_MODE || subject_pid === 'DEMO'">
            <q-btn color="grey-7" round flat icon="more_vert" data-cy="btn_hidden_options">
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
          </div>

          <!-- FOKUS ⇄ LISTE -->
          <div class="col-auto" v-if="showChrome">
            <q-btn flat round dense :icon="focusMode ? 'view_agenda' : 'view_headline'"
              color="grey-7" data-cy="btn_toggle_focus" @click="toggleMode()">
              <q-tooltip>{{ focusMode ? $t('quest.list_mode') : $t('quest.focus_mode') }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </q-card-section>

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
            <q-input data-cy="PID" filled v-model="subject_pid" :label="$t('quest.pid')" :hint="PID_HINT_TEXT"
              :rules="[val => (val && val.length > 0) || $t('quest.pid_hint')]" :disable="PARAMS.PID !== undefined"
              autofocus @keyup.enter="onEnter" />
          </template>

          <!-- FRAGE-SCHRITT -->
          <template v-else-if="step && step.kind === 'item'">
            <!-- Intro / Kontext oberhalb der Frage -->
            <div v-if="step.intro && step.intro.length" class="quest-intro">
              <div v-for="(b, bi) in step.intro" :key="'intro' + bi" class="q-mb-sm">
                <div v-if="b.label" class="text-subtitle2 text-grey-8"><span v-html="b.label" /></div>
                <div v-if="b.caption" class="text-caption text-grey-7"><span v-html="b.caption" /></div>
                <span v-if="b.type === 'image'">
                  <img v-for="(img, k) of b.value" :key="k + 'img'" :src="`img/${img}`" alt=""
                    :style="`width:${b.width}px`">
                </span>
              </div>
            </div>
            <!-- Frage -->
            <div class="quest-question" data-cy="list_entries">
              <div class="text-subtitle1 quest-question__label"><span v-html="step.item.label" /></div>
              <div v-if="step.item.caption" class="text-caption text-grey-7 q-mb-sm"><span v-html="step.item.caption" /></div>

              <span v-if="step.item.type === 'image'">
                <img v-for="(img, i) of step.item.value" :key="i + 'img'" :src="`img/${img}`" alt=""
                  :style="`width: ${step.item.width}px`">
              </span>
              <component v-else :is="rendererComponent(step.item)" :ITEM="step.item"
                @emitValue="onValue(step.item, $event)" data-cy="item_input" />

              <div v-if="currentError" class="text-red q-mt-sm" data-cy="quest_inline_error">
                {{ $t('quest.please_complete') }}
              </div>
            </div>
          </template>

          <!-- INFO-SCHRITT (abschließende Hinweise) -->
          <template v-else-if="step && step.kind === 'info'">
            <div v-if="step.intro && step.intro.length" class="quest-intro">
              <div v-for="(b, bi) in step.intro" :key="'info' + bi" class="q-mb-sm">
                <div v-if="b.label" class="text-subtitle2 text-grey-8"><span v-html="b.label" /></div>
                <div v-if="b.caption" class="text-caption text-grey-7"><span v-html="b.caption" /></div>
                <span v-if="b.type === 'image'">
                  <img v-for="(img, k) of b.value" :key="k + 'img'" :src="`img/${img}`" alt=""
                    :style="`width:${b.width}px`">
                </span>
              </div>
            </div>
          </template>

          <!-- ÜBERSICHT / REVIEW -->
          <template v-else-if="step && step.kind === 'review'">
            <div class="text-subtitle1 q-mb-xs">{{ $t('quest.review_title') }}</div>
            <div class="text-caption text-grey-7 q-mb-md">{{ $t('quest.review_hint') }}</div>
            <q-list separator>
              <q-item v-for="rev in reviewList" :key="'rev' + rev.stepIndex" clickable v-ripple
                @click="goTo(rev.stepIndex)" :data-cy="'review_item'">
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
        <q-card-section class="quest-nav row items-center justify-between q-pb-xl">
          <q-btn flat no-caps color="grey-8" icon="arrow_back" :label="$t('quest.prev')" :disable="currentStep === 0"
            data-cy="quest_prev" @click="goPrev()" />

          <template v-if="step && step.kind === 'review'">
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
        <!-- PID (im Visiten-/Preview-Modus ausgeblendet) -->
        <q-card-section v-if="!embedded && !isPreview">
          <q-input data-cy="PID" filled v-model="subject_pid" :label="$t('quest.pid')" :hint="PID_HINT_TEXT"
            :rules="[val => (val && val.length > 0) || $t('quest.pid_hint')]" :disable="PARAMS.PID !== undefined" />
        </q-card-section>

        <q-card-section>
          <q-list bordered separator data-cy="list_entries">
            <q-item v-for="(item, indQ) in QUEST.items" :key="item.label + indQ" data-cy="item_entry"
              :id="'qitem_' + indQ">
              <q-item-section>
                <q-item-label title><span v-html="item.label" /></q-item-label>
                <q-item-label v-if="item.caption !== null || item.type === 'separator'" caption>
                  <span v-html="item.caption" />
                </q-item-label>

                <q-item-label v-if="isInteractive(item)">
                  <component :is="rendererComponent(item)" :ITEM="item" @emitValue="item.value = $event" data-cy="text" />
                </q-item-label>
                <q-item-label v-else-if="item.type === 'image'">
                  <span v-for="(img, imgind) of item.value" :key="imgind + 'img'">
                    <img :src="`img/${img}`" alt="" :style="`width: ${item.width}px`">
                  </span>
                </q-item-label>

                <q-item-label v-if="submit_clicked && CHECK_FORM !== true && CHECK_FORM[indQ] === false" class="text-red">
                  {{ $t('quest.please_complete') }}
                </q-item-label>
              </q-item-section>
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
import { itemValidity, answerStats } from 'src/tools/visits/visit-model'
import RenderSlider from './RenderQuest_slider.vue'
import RenderMultipleRadio from './RenderQuest_multipleradio.vue'
import RenderDate from './RenderQuest_date.vue'
import RenderTime from './RenderQuest_time.vue'
import RenderText from './RenderQuest_text.vue'
import RenderRadio from './RenderQuest_radio.vue'

const INTERACTIVE = ['radio', 'checkbox', 'text', 'number', 'date', 'date_year', 'time', 'slider', 'multiple_radio']
const RENDERER = {
  radio: 'RenderRadio', checkbox: 'RenderRadio',
  text: 'RenderText', number: 'RenderText',
  date: 'RenderDate', date_year: 'RenderDate',
  time: 'RenderTime', slider: 'RenderSlider',
  multiple_radio: 'RenderMultipleRadio',
}

export default {
  name: 'RenderQuest',
  components: { RenderSlider, RenderMultipleRadio, RenderDate, RenderTime, RenderText, RenderRadio },
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
      return this.mainStore.SETTINGS.quest_focus_mode !== false
    },
    autoAdvance() {
      return this.mainStore.SETTINGS.quest_auto_advance !== false
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
    // geordnete Schrittliste: [pid?] → Frage-Schritte (mit Intro-Kontext) → [info?] → review
    steps() {
      const out = []
      if (!this.embedded && !this.isPreview) out.push({ kind: 'pid' })
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
      out.push({ kind: 'review' })
      return out
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
          return { stepIndex, label: s.item.label, status, ...map[status] }
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
    rendererComponent(item) {
      return RENDERER[item.type]
    },
    toggleMode() {
      this.mainStore.SETTINGS.quest_focus_mode = !this.mainStore.SETTINGS.quest_focus_mode
      this.currentStep = 0
      this.currentError = false
      this.$nextTick(() => this.focusStep())
    },
    reviewStatus(item) {
      const required = item.force !== false
      if (this.isAnswered(item)) return 'done'
      return required ? 'required' : 'optional'
    },
    isAnswered(item) {
      const t = item.type
      const v = item.value
      if (t === 'checkbox' || t === 'multiple_radio') {
        return Array.isArray(v) && v.length > 0 && v.some((x) => x !== null && x !== undefined)
      }
      return v !== null && v !== undefined
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
      if (this.step && (this.step.kind === 'item') &&
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
    rebuildQuests() {
      const answ = confirm(this.$t('btn.reset_confirm'))
      if (!answ) return
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

.quest-progress
  position: sticky
  top: 0
  z-index: 2
  background: $surface
  padding: 8px 16px 4px

.quest-manual
  padding: 12px 16px
  font-size: 0.9em
  color: $grey-8

.quest-step
  min-height: 180px

.quest-question__label
  line-height: 1.4
  margin-bottom: 8px

.quest-intro
  margin-bottom: 12px
  padding-left: 4px
  border-left: 3px solid $line
</style>
