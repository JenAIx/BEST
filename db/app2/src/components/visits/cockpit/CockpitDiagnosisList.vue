<template>
  <!-- Problem list: main diagnosis line + secondary chips; inline popover
       editor with ICD-10 typeahead (free text allowed). -->
  <div class="dx-list" data-cy="cockpit-diagnoses">
    <div class="dx-list__label text-caption text-grey-7">{{ $t('visit.cockpit.diagnoses') }}</div>
    <div class="dx-list__body">
      <div v-if="inherited && editable" class="dx-list__inherited text-caption">
        <q-icon name="history" size="14px" /> {{ $t('visit.cockpit.dxInherited') }}
        <q-btn dense flat no-caps size="sm" color="primary" :label="$t('visit.cockpit.carryDiagnoses')" data-cy="dx-carry" @click="$emit('carry-forward')" />
      </div>
      <div v-if="!diagnoses.length" class="text-caption text-grey-6">{{ $t('visit.cockpit.noDiagnoses') }}</div>
      <template v-else>
        <div v-if="primary" class="dx-line dx-line--primary" :class="{ 'dx-line--inherited': inherited }" :data-cy="`dx-${primary.observationId}`" @click="editable && open(primary)">
          <span class="dx-dot" :class="`dx-dot--${primary.status}`" />
          <span v-if="primary.icd" class="dx-icd">{{ icdShort(primary.icd) }}</span>
          <span class="dx-text">{{ primary.text || primary.icdName }}</span>
          <span v-if="primary.laterality" class="dx-meta">{{ side(primary.laterality) }}</span>
          <span v-if="primary.since" class="dx-meta">· {{ $t('visit.cockpit.since') }} {{ primary.since }}</span>
          <span class="dx-meta text-grey-5">({{ $t('visit.cockpit.primary') }})</span>
        </div>
        <div class="dx-chips">
          <span v-for="d in secondary" :key="d.observationId" class="dx-chip" :class="[`dx-chip--${d.status}`, { 'dx-line--inherited': inherited }]" :data-cy="`dx-${d.observationId}`" @click="editable && open(d)">
            <span class="dx-dot" :class="`dx-dot--${d.status}`" />
            <span v-if="d.icd" class="dx-icd">{{ icdShort(d.icd) }}</span>
            <span class="dx-text">{{ d.text || d.icdName }}</span>
            <span v-if="d.since" class="dx-meta">· {{ d.since }}</span>
          </span>
        </div>
      </template>
    </div>
    <q-btn v-if="editable" flat round dense size="sm" icon="add" color="primary" data-cy="dx-add" @click="open(null)">
      <q-tooltip>{{ $t('visit.cockpit.addDiagnosis') }}</q-tooltip>
    </q-btn>

    <q-dialog v-model="show">
      <q-card class="dx-editor">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle1">{{ form.observationId ? $t('visit.cockpit.editDiagnosis') : $t('visit.cockpit.addDiagnosis') }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <q-btn-toggle v-model="form.kind" dense no-caps unelevated toggle-color="primary" :options="[{ label: $t('visit.cockpit.primary'), value: 'primary' }, { label: $t('visit.cockpit.secondary'), value: 'secondary' }]" />
          <q-select
            v-model="form.icdOption"
            dense
            outlined
            use-input
            clearable
            hide-dropdown-icon
            input-debounce="200"
            :options="icdOptions"
            option-label="label"
            :label="$t('visit.cockpit.icdSearch')"
            autofocus
            data-cy="dx-icd"
            @filter="filterIcd"
            @update:model-value="onIcdPicked"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar><span class="dx-icd">{{ scope.opt.icd }}</span></q-item-section>
                <q-item-section>{{ scope.opt.name }}</q-item-section>
              </q-item>
            </template>
            <template #no-option><q-item><q-item-section class="text-grey-6">{{ $t('visit.cockpit.noHits') }}</q-item-section></q-item></template>
          </q-select>
          <q-input v-model="form.text" dense outlined :label="$t('visit.cockpit.freeText')" data-cy="dx-text" @keyup.enter="save" />
          <div class="row q-gutter-sm">
            <q-input v-model="form.since" dense outlined :label="$t('visit.cockpit.since')" class="col" placeholder="2019" />
            <q-select v-model="form.status" dense outlined :label="$t('visit.cockpit.status')" class="col" emit-value map-options :options="statusOptions" />
            <q-select v-model="form.laterality" dense outlined clearable :label="$t('visit.cockpit.laterality')" class="col" emit-value map-options :options="sideOptions" />
          </div>
        </q-card-section>
        <q-card-actions align="between" class="q-px-md q-pb-md">
          <q-btn v-if="form.observationId" flat dense no-caps color="negative" icon="delete" :label="$t('visit.cockpit.deleteDiagnosis')" data-cy="dx-delete" @click="remove" />
          <span v-else />
          <q-btn unelevated dense no-caps color="primary" :label="$t('common.save')" :disable="!form.icdOption && !form.text.trim()" data-cy="dx-save" @click="save" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  diagnoses: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  inherited: { type: Boolean, default: false },
  searchIcd: { type: Function, default: null }, // (term) => Promise<[{code, icd, name}]>
})
const emit = defineEmits(['save', 'delete', 'carry-forward'])
const { t } = useI18n()

const primary = computed(() => props.diagnoses.find((d) => d.kind === 'primary') || null)
const secondary = computed(() => props.diagnoses.filter((d) => d.kind === 'secondary'))
const icdShort = (code) => String(code).replace(/^ICD10: /, '')
const side = (l) => ({ L: t('visit.cockpit.sideL'), R: t('visit.cockpit.sideR'), B: t('visit.cockpit.sideB') })[l] || l

const show = ref(false)
const form = ref(emptyForm())
const icdOptions = ref([])
const statusOptions = computed(() => [
  { label: t('visit.cockpit.statusAktiv'), value: 'aktiv' },
  { label: t('visit.cockpit.statusVerdacht'), value: 'verdacht' },
  { label: t('visit.cockpit.statusInaktiv'), value: 'inaktiv' },
])
const sideOptions = computed(() => [
  { label: t('visit.cockpit.sideL'), value: 'L' },
  { label: t('visit.cockpit.sideR'), value: 'R' },
  { label: t('visit.cockpit.sideB'), value: 'B' },
])

function emptyForm() {
  return { observationId: null, kind: 'secondary', icdOption: null, text: '', since: '', status: 'aktiv', laterality: null }
}

const open = (d) => {
  form.value = d
    ? { observationId: d.observationId, kind: d.kind, icdOption: d.icd ? { code: d.icd, icd: icdShort(d.icd), name: d.icdName || d.text, label: `${icdShort(d.icd)} ${d.icdName || ''}`.trim() } : null, text: d.text || '', since: d.since || '', status: d.status || 'aktiv', laterality: d.laterality || null }
    : { ...emptyForm(), kind: primary.value ? 'secondary' : 'primary' }
  show.value = true
}

const filterIcd = async (val, update) => {
  const term = String(val || '').trim()
  if (!term || !props.searchIcd) return update(() => (icdOptions.value = []))
  const hits = await props.searchIcd(term)
  update(() => {
    icdOptions.value = hits.map((h) => ({ ...h, label: `${h.icd} ${h.name}` }))
  })
}

const onIcdPicked = (opt) => {
  if (opt && !form.value.text.trim()) form.value.text = opt.name
}

const save = () => {
  const f = form.value
  if (!f.icdOption && !f.text.trim()) return
  emit('save', { observationId: f.observationId, kind: f.kind, icd: f.icdOption?.code || null, text: f.text.trim() || f.icdOption?.name || '', since: f.since || null, status: f.status, laterality: f.laterality })
  show.value = false
}

const remove = () => {
  emit('delete', form.value.observationId)
  show.value = false
}
</script>

<style lang="scss" scoped>
.dx-list {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  &__label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.62rem;
    padding: 2px 0;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__inherited {
    color: $orange-9;
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.dx-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;

  &--primary .dx-text {
    font-weight: 600;
    font-size: 0.95rem;
  }

  &:hover {
    background: $grey-2;
  }

  &--inherited {
    opacity: 0.6;
  }
}

.dx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 2px;
}

.dx-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 4px;

  &:hover {
    background: $grey-2;
  }

  &--inaktiv .dx-text {
    text-decoration: line-through;
    color: $grey-6;
  }
}

.dx-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $positive;
  align-self: center;
  flex-shrink: 0;

  &--verdacht {
    background: white;
    border: 2px solid $warning;
  }

  &--inaktiv {
    background: $grey-5;
  }
}

.dx-icd {
  font-family: monospace;
  font-size: 0.75rem;
  color: $primary;
}

.dx-meta {
  font-size: 0.72rem;
  color: $grey-6;
}

.dx-editor {
  width: 520px;
  max-width: 92vw;
}
</style>
