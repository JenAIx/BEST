<template>
  <!-- Visitenmodus: consultation cockpit. Status band (diagnoses + scores),
       then medication | today's texts with reference panes | tools rail.
       All content comes from the consult template (data-driven). -->
  <div class="cockpit" data-cy="cockpit">
    <div v-if="store.loading && !store.template" class="cockpit__loading"><q-spinner-grid size="40px" color="primary" /></div>
    <div v-else-if="store.error" class="text-negative q-pa-md">{{ store.error }}</div>
    <template v-else-if="store.template">
      <CockpitHeader
        ref="headerRef"
        :last-visit="store.lastVisit"
        :last-visit-label="lastVisitLabel"
        :days-since="store.daysSinceLastVisit"
        :stale="store.isStale"
        :today-visit="store.todayVisit"
        :today-match="store.todayMatch"
        :adoptable="!!todayTypedVisit"
        :templates="store.templates"
        :template-code="store.templateCode"
        :search="store.search"
        @start="startVisit"
        @adopt="adoptVisit"
        @change-template="store.setTemplate"
        @hit="onHit"
        @letter="openLetter"
        @open-timeline="openTimeline"
      />

      <div class="cockpit__band">
        <CockpitDiagnosisList v-if="store.template.diagnosis.show" :diagnoses="store.problemList" :editable="store.isEditable" :inherited="store.problemList.some((d) => d.inherited)" :search-icd="store.searchIcd10" @save="saveDiagnosis" @delete="deleteDiagnosis" @carry-forward="carryDiagnoses" />
        <CockpitScoreStrip v-if="store.template.scoreConcepts.length" :scores="store.scoreStrip" :ledd="store.ledd" :editable="store.isEditable" @enter-value="onEnterValue" @fill-questionnaire="fillQuestionnaire" @add-questionnaire="showAddQuestionnaire = true" />
        <div v-if="store.contextValues.length" class="cockpit__context">
          <span class="text-caption text-grey-7 q-mr-sm">{{ $t('visit.cockpit.contextLabel') }}:</span>
          <template v-for="ctx in store.contextValues" :key="ctx.code">
            <q-btn-toggle v-if="contextOptions[ctx.code]" dense no-caps size="sm" unelevated toggle-color="primary" color="grey-3" text-color="grey-8" :model-value="ctx.current?.value || null" :options="contextOptions[ctx.code]" :disable="!store.isEditable" class="q-mr-sm" @update:model-value="store.setContextValue(ctx.code, $event, contextTypes[ctx.code])" />
          </template>
        </div>
      </div>

      <div class="cockpit__body">
        <section class="cockpit__meds">
          <CockpitMedicationPanel
            v-if="store.template.medication.show"
            :medications="store.medications"
            :diff="store.medicationDiff"
            :ledd="store.ledd"
            :groups-config="store.template.medication.groups"
            :drug-options="store.drugOptions"
            :editable="store.isEditable"
            :is-today="store.medicationVisitId != null && store.medicationVisitId === store.todayVisit?.id"
            :state-date="medicationDate(store.medicationVisitId)"
            :previous-date="medicationDate(store.previousMedicationVisitId)"
            :can-continue="store.isEditable && !store.medications.length && store.previousMedicationVisitId != null"
            :frequency-abbrev="getFrequencyAbbreviation"
            :route-abbrev="getRouteAbbreviation"
            @add="openMedication(null)"
            @edit="openMedication"
            @stop="stopMedication"
            @continue="continueMedication"
          />
        </section>

        <section class="cockpit__today">
          <div class="cockpit__today-head">
            <span class="text-caption text-grey-7">{{ $t('visit.cockpit.todaySection') }}<template v-if="store.todayVisit"> · {{ fmtDate(store.todayVisit.date) }}</template></span>
            <q-space />
            <q-btn flat round dense size="sm" :icon="referenceMode === 'side' ? 'view_column' : 'view_agenda'" color="grey-6" @click="toggleReferenceMode">
              <q-tooltip>{{ referenceMode === 'side' ? $t('visit.cockpit.referenceStrip') : $t('visit.cockpit.referenceSide') }}</q-tooltip>
            </q-btn>
          </div>
          <CockpitTextSection
            v-for="(section, i) in store.textSections"
            :key="section.code"
            :ref="(el) => (sectionRefs[i] = el)"
            :section="section"
            :editable="store.isEditable"
            :reference-mode="referenceMode"
            :highlight="highlightTerm"
            :focus-visit-id="focusVisitId"
            @save="onSaveText"
            @carry-forward="onCarryText"
            @next="focusSection(i + 1)"
          />
        </section>

        <CockpitToolsRail
          class="cockpit__tools"
          :checklist="store.checklist"
          :questionnaires="questionnaireChips"
          :files="fileObservations"
          :letters="store.letters"
          :labels="conceptLabels"
          :patient-num="patientNum"
          :editable="store.isEditable"
          @focus="focusChecklistItem"
          @questionnaire="onQuestionnaireChip"
          @add-questionnaire="showAddQuestionnaire = true"
          @open-file="previewFile"
          @open-letter="openSavedLetter"
          @uploaded="onUploaded"
        />
      </div>
    </template>

    <!-- dialogs -->
    <MedicationEditDialog v-if="showMedicationDialog" v-model="showMedicationDialog" :medication-data="medicationDialogData" :observation-id="medicationDialogId" :frequency-options="frequencyOptions" :route-options="routeOptions" @save="onMedicationSave" />
    <AddQuestionnaireToVisitDialog v-if="store.todayVisit" v-model="showAddQuestionnaire" :existing-questionnaire-codes="existingQuestionnaireCodes" :visit-type-code="store.template?.visitType" @questionnaire-selected="onQuestionnaireSelected" />
    <VisitQuestionnaireFillDialog v-if="activeQuestionnaire && store.todayVisit" v-model="showFillDialog" :visit="store.todayVisit" :patient="patient" :questionnaire-code="activeQuestionnaire.questionnaireCode" :observation-id="activeQuestionnaire.observationId" :observation-blob="activeQuestionnaire.observationBlob" :is-completed="activeQuestionnaire.isCompleted" @questionnaire-completed="onQuestionnaireDone" @close="onQuestionnaireClosed" />
    <FilePreviewDialog v-if="fileToPreview" v-model="showFilePreview" :observation-id="fileToPreview.observationId" :file-info="fileToPreview.fileInfo" :concept-name="fileToPreview.conceptName" :upload-date="fileToPreview.date" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useConsultStore } from 'src/stores/consult-store'
import { useVisitStore } from 'src/stores/visit-store'
import { useObservationStore } from 'src/stores/observation-store'
import { useMedicationsStore } from 'src/stores/medications-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLoggingStore } from 'src/stores/logging-store'
import { useNotify } from 'src/composables/useNotify'
import { useMedicationOptions } from 'src/composables/useMedicationOptions'
import { useVisitLabels } from 'src/composables/useVisitLabels'
import { useVisitQuestionnaires } from 'src/composables/useVisitQuestionnaires'
import { visitObservationService } from 'src/services/visit-observation-service'
import { useConceptResolutionStore } from 'src/stores/concept-resolution-store'
import CockpitHeader from './CockpitHeader.vue'
import CockpitDiagnosisList from './CockpitDiagnosisList.vue'
import CockpitScoreStrip from './CockpitScoreStrip.vue'
import CockpitMedicationPanel from './CockpitMedicationPanel.vue'
import CockpitTextSection from './CockpitTextSection.vue'
import CockpitToolsRail from './CockpitToolsRail.vue'
import MedicationEditDialog from '../MedicationEditDialog.vue'
import AddQuestionnaireToVisitDialog from '../AddQuestionnaireToVisitDialog.vue'
import VisitQuestionnaireFillDialog from '../VisitQuestionnaireFillDialog.vue'
import FilePreviewDialog from 'src/components/shared/FilePreviewDialog.vue'

defineOptions({ name: 'VisitCockpit' })

const props = defineProps({
  patient: { type: Object, required: true },
})
const emit = defineEmits(['open-timeline'])

const store = useConsultStore()
const visitStore = useVisitStore()
const observationStore = useObservationStore()
const medicationsStore = useMedicationsStore()
const localSettings = useLocalSettingsStore()
const conceptStore = useConceptResolutionStore()
const logger = useLoggingStore().createLogger('VisitCockpit')
const notify = useNotify()
const router = useRouter()
const $q = useQuasar()
const { t } = useI18n()
const { typeMeta, resolveAll } = useVisitLabels()
const { frequencyOptions, routeOptions, loadMedicationOptions, getFrequencyAbbreviation, getRouteAbbreviation } = useMedicationOptions()

const patientNum = computed(() => props.patient?.PATIENT_NUM ?? props.patient?.rawData?.PATIENT_NUM ?? null)
const headerRef = ref(null)
const sectionRefs = ref([])
const referenceMode = ref(localSettings.getSetting('visits.cockpitReferenceMode', 'side'))
const highlightTerm = ref('')
const focusVisitId = ref(null)

// ---- load ------------------------------------------------------------------
const load = async () => {
  if (patientNum.value == null) return
  try {
    await Promise.all([store.openCockpit({ patientNum: patientNum.value }), loadMedicationOptions()])
    resolveAll(visitStore.visits)
    await resolveConceptLabels()
  } catch (error) {
    logger.error('Failed to open cockpit', error)
  }
}
onMounted(load)
watch(patientNum, load)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})

const lastVisitLabel = computed(() => (store.lastVisit ? typeMeta(store.lastVisit).label : ''))
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || ''
}
const medicationDate = (id) => (id == null ? null : visitStore.visits.find((v) => v.id === id)?.date || null)

// today has an untyped/typed visit without consult template → offer adoption
const todayTypedVisit = computed(() => {
  if (store.todayVisit || store.todayMatch !== 'visit-type') return null
  const today = new Date().toISOString().slice(0, 10)
  return visitStore.visits.find((v) => String(v.date).slice(0, 10) === today) || null
})

// ---- concept labels (checklist, context) -------------------------------------
const conceptLabels = ref({})
const contextOptions = ref({})
const contextTypes = ref({})
const resolveConceptLabels = async () => {
  const tpl = store.template
  if (!tpl) return
  const codes = [...tpl.checklist.map((c) => (typeof c === 'string' ? c : c.code)), ...tpl.contextConcepts].filter((c) => c.includes(':'))
  try {
    const map = await conceptStore.resolveBatch(codes, { context: 'observation' })
    const labels = {}
    for (const [code, r] of map) labels[code] = r?.label || code
    for (const s of tpl.scoreConcepts) labels[s.code] = s.short || labels[s.code] || s.code
    for (const x of tpl.textConcepts) labels[x.code] = x.short || x.label
    conceptLabels.value = labels
    const opts = {}
    const types = {}
    for (const code of tpl.contextConcepts) {
      const r = map.get(code)
      types[code] = r?.valueType || 'S'
      if (r?.valueType === 'F') {
        opts[code] = [{ label: `${labels[code]}: ja`, value: 'SCTID: 373066001' }, { label: 'nein', value: 'SCTID: 373067005' }]
      } else {
        const list = await conceptStore.getSelectionOptions(code)
        opts[code] = (list || []).map((o) => ({ label: o.label, value: o.value }))
      }
    }
    contextOptions.value = opts
    contextTypes.value = types
  } catch (error) {
    logger.warn('Concept labels unavailable', { error: error?.message })
  }
}
watch(() => store.templateCode, resolveConceptLabels)

// ---- visit start / adopt ------------------------------------------------------
const startVisit = async (templateCode) => {
  try {
    await store.startConsultation({ templateCode })
    const tpl = store.template
    const canCarry = store.lastVisit && (tpl.diagnosis.carryForward || tpl.medication.carryForward || tpl.textConcepts.some((x) => x.carryForward))
    if (canCarry) {
      $q.dialog({
        title: t('visit.cockpit.carryAllTitle'),
        message: t('visit.cockpit.carryAllMessage', { date: fmtDate(store.lastVisit.date) }),
        ok: { label: t('visit.cockpit.carryAll'), color: 'primary', noCaps: true },
        cancel: { label: t('visit.cockpit.startEmpty'), flat: true, noCaps: true },
      }).onOk(async () => {
        try {
          await store.carryForwardAll()
        } catch (error) {
          notify.error(error.message)
        }
      })
    }
    setTimeout(() => focusSection(0), 300)
  } catch (error) {
    notify.error(error.message)
  }
}
const adoptVisit = async () => {
  if (!todayTypedVisit.value) return
  try {
    await store.adoptTodayVisit(todayTypedVisit.value)
  } catch (error) {
    notify.error(error.message)
  }
}

// ---- diagnoses ----------------------------------------------------------------
const saveDiagnosis = async (payload) => {
  try {
    await store.upsertDiagnosis(payload)
  } catch (error) {
    notify.error(error.message)
  }
}
const deleteDiagnosis = async (id) => {
  try {
    await store.deleteDiagnosis(id)
  } catch (error) {
    notify.error(error.message)
  }
}
const carryDiagnoses = async () => {
  try {
    await store.carryForwardDiagnoses()
  } catch (error) {
    notify.error(error.message)
  }
}

// ---- scores / questionnaires -------------------------------------------------
const onEnterValue = async ({ score, value }) => {
  try {
    await store.setScoreValue(score.code, value)
  } catch (error) {
    notify.error(error.message)
  }
}
const visitRef = computed(() => store.todayVisit)
const patientRef = toRef(props, 'patient')
const { visitQuestionnaires, existingQuestionnaireCodes, activeQuestionnaire, showFillDialog, showAddDialog: showAddQuestionnaire, onQuestionnaireSelected, onFillQuestionnaire, onViewQuestionnaire, onQuestionnaireCompleted, onQuestionnaireFillClose } = useVisitQuestionnaires(visitRef, patientRef)

const questionnaireChips = computed(() =>
  (store.template?.suggestedQuestionnaires || []).map((code) => {
    const q = visitQuestionnaires.value.find((x) => x.questionnaireCode === code)
    return { code, done: !!q?.isCompleted, observation: q || null }
  }),
)
const onQuestionnaireChip = (chip) => {
  if (!store.todayVisit) return
  if (chip.observation) return chip.observation.isCompleted ? onViewQuestionnaire(chip.observation) : onFillQuestionnaire(chip.observation)
  onQuestionnaireSelected({ code: chip.code, title: chip.code, shortTitle: chip.code }).then(() => {
    const q = visitQuestionnaires.value.find((x) => x.questionnaireCode === chip.code)
    if (q) onFillQuestionnaire(q)
  })
}
const fillQuestionnaire = (score) => {
  if (!score.questionnaireCode) return
  onQuestionnaireChip({ code: score.questionnaireCode, observation: visitQuestionnaires.value.find((x) => x.questionnaireCode === score.questionnaireCode) || null })
}
const onQuestionnaireDone = async () => {
  await onQuestionnaireCompleted()
  await store.refreshConcepts(store.template.scoreConcepts.map((s) => s.code))
}
const onQuestionnaireClosed = async () => {
  onQuestionnaireFillClose()
  await store.refreshConcepts(store.template.scoreConcepts.map((s) => s.code))
}

// ---- medication ---------------------------------------------------------------
const showMedicationDialog = ref(false)
const medicationDialogData = ref({})
const medicationDialogId = ref(null)
const openMedication = (med) => {
  if (!store.isEditable) return
  medicationDialogId.value = med?.observationId ?? null
  medicationDialogData.value = med ? { drugName: med.drugName, dosage: med.dosage, dosageUnit: med.dosageUnit, frequency: med.frequency, route: med.route, instructions: med.instructions } : { drugName: '', dosage: null, dosageUnit: 'mg', frequency: '', route: '', instructions: '' }
  showMedicationDialog.value = true
}
const onMedicationSave = async (medicationData) => {
  try {
    if (medicationDialogId.value) await medicationsStore.updateMedication({ observationId: medicationDialogId.value, medicationData })
    else await medicationsStore.createMedication({ patientNum: patientNum.value, visitId: store.todayVisit.id, medicationData, visitDate: store.todayVisit.date })
    await store.refreshMedications()
    await observationStore.loadObservationsForVisit(store.todayVisit.id)
  } catch (error) {
    notify.error(error.message)
  }
}
const stopMedication = (med) => {
  $q.dialog({ title: t('visit.cockpit.stopMedication'), message: t('visit.cockpit.stopMedicationConfirm', { name: med.drugName }), cancel: true, ok: { label: t('visit.cockpit.stopMedication'), color: 'negative' } }).onOk(async () => {
    try {
      await medicationsStore.deleteMedication({ observationId: med.observationId })
      await store.refreshMedications()
      await observationStore.loadObservationsForVisit(store.todayVisit.id)
    } catch (error) {
      notify.error(error.message)
    }
  })
}
const continueMedication = async () => {
  try {
    await store.carryForwardMedications()
  } catch (error) {
    notify.error(error.message)
  }
}

// ---- texts ----------------------------------------------------------------------
const onSaveText = async ({ code, value }) => {
  try {
    await store.saveText(code, value)
  } catch (error) {
    notify.error(error.message)
  }
}
const onCarryText = async ({ code, mode, fromObservationId }) => {
  try {
    await store.carryForwardText(code, { mode, fromObservationId })
  } catch (error) {
    notify.error(error.message)
  }
}
const focusSection = (i) => sectionRefs.value[i]?.focus?.()
const toggleReferenceMode = () => {
  referenceMode.value = referenceMode.value === 'side' ? 'strip' : 'side'
  localSettings.setSetting('visits.cockpitReferenceMode', referenceMode.value)
}

// ---- tools rail -----------------------------------------------------------------
const fileObservations = computed(() => observationStore.allObservations.filter((o) => o.valueType === 'R').slice().sort((a, b) => String(b.date).localeCompare(String(a.date))))
const fileToPreview = ref(null)
const showFilePreview = ref(false)
const previewFile = (f) => {
  fileToPreview.value = f
  showFilePreview.value = true
}
const onUploaded = async () => {
  await observationStore.loadAllObservationsForPatient(patientNum.value)
  if (store.todayVisit) await observationStore.loadObservationsForVisit(store.todayVisit.id)
}
const focusChecklistItem = (item) => {
  const i = store.textSections.findIndex((s) => s.code === item.code)
  if (i >= 0) return focusSection(i)
  if (item.questionnaire) return onQuestionnaireChip({ code: item.code, observation: visitQuestionnaires.value.find((x) => x.questionnaireCode === item.code) || null })
  const score = store.scoreStrip.find((s) => s.code === item.code)
  if (score?.questionnaireCode) fillQuestionnaire(score)
}

// ---- search hits / navigation ----------------------------------------------------
const onHit = (hit) => {
  highlightTerm.value = hit.snippet ? hit.text : ''
  if (hit.kind === 'text' && hit.encounterNum) {
    focusVisitId.value = hit.encounterNum
    highlightTerm.value = headerTerm(hit)
    const i = store.textSections.findIndex((s) => s.code === hit.conceptCode)
    if (i >= 0) sectionRefs.value[i]?.$el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  } else if (hit.kind === 'letter' && hit.noteId) {
    openSavedLetter(store.letters.find((l) => l.noteId === hit.noteId))
  } else {
    openTimeline({ id: hit.encounterNum })
  }
}
const headerTerm = (hit) => {
  const m = /…?(.*?)…?$/.exec(hit.snippet || '')
  const s = hit.snippet || ''
  const i = s.search(/\S/)
  return m ? s.slice(i, i + 24).trim() : ''
}
const openTimeline = (visit) => emit('open-timeline', visit)

// ---- letter (iteration 3 hook) --------------------------------------------------
const openLetter = () => notify.info(t('visit.cockpit.letterSoon'))
const openSavedLetter = (letter) => {
  if (!letter?.html) return
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(letter.html)
  w.document.close()
}

// ---- keyboard ---------------------------------------------------------------------
const onKey = (e) => {
  const inText = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
  if ((e.key === '/' && !inText) || (e.ctrlKey && e.key.toLowerCase() === 'k')) {
    e.preventDefault()
    headerRef.value?.focusSearch?.()
  } else if (e.ctrlKey && /^[1-4]$/.test(e.key)) {
    e.preventDefault()
    focusSection(Number(e.key) - 1)
  } else if (e.ctrlKey && e.key.toLowerCase() === 'm' && store.isEditable) {
    e.preventDefault()
    openMedication(null)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))

void router
void visitObservationService
</script>

<style lang="scss" scoped>
.cockpit {
  max-width: 1600px;
  margin: 0 auto;
  padding: 8px 20px 24px;

  &__loading {
    display: flex;
    justify-content: center;
    padding: 60px;
  }

  &__band {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 6px 0 12px;
    border-bottom: 1px solid $grey-3;
    margin-bottom: 12px;
  }

  &__context {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__body {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr) 230px;
    gap: 20px;
    align-items: start;
  }

  &__meds,
  &__tools {
    position: sticky;
    top: 8px;
  }

  &__today-head {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
  }
}

@media (max-width: 1300px) {
  .cockpit__body {
    grid-template-columns: 300px minmax(0, 1fr) 200px;
  }
}

@media (max-width: 1000px) {
  .cockpit__body {
    grid-template-columns: 1fr;
  }

  .cockpit__meds,
  .cockpit__tools {
    position: static;
  }
}
</style>
