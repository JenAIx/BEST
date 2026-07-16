<template>
  <q-dialog v-model="dialogModel">
    <q-card style="min-width: 440px; max-width: 560px">
      <q-card-section class="row items-center q-pb-none">
        <q-icon :name="selectedCategory?.icon || 'attach_file'" :color="selectedCategory?.color || 'primary'" size="26px" class="q-mr-sm" />
        <div class="text-h6">{{ $t('visit.uploadFileTitle') }}</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="fileData">
        <!-- File row -->
        <div class="file-row row items-center q-gutter-sm q-mb-md">
          <q-icon :name="suggested?.icon || 'insert_drive_file'" size="32px" :color="suggested?.color || 'grey-7'" />
          <div class="col">
            <div class="text-subtitle2">{{ fileData.fileInfo.filename }}</div>
            <div class="text-caption text-grey-6">{{ formatFileSize(fileData.fileInfo.size) }}</div>
          </div>
        </div>

        <!-- Category (suggested from the file name/extension, changeable) -->
        <q-select v-model="categoryKey" :options="categoryOptions" :label="$t('visit.uploadCategory')" outlined dense emit-value map-options class="q-mb-sm">
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section avatar>
                <q-icon :name="scope.opt.icon" :color="scope.opt.color" />
              </q-item-section>
              <q-item-section>{{ scope.opt.label }}</q-item-section>
            </q-item>
          </template>
        </q-select>

        <!-- Target visit -->
        <q-select v-model="targetVisit" :options="visitStore.visitOptions" :label="$t('visit.uploadTargetVisit')" outlined dense class="q-mb-sm">
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>{{ scope.opt.summary }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-banner v-if="!visitStore.hasVisits" dense rounded class="bg-orange-1 text-orange-9">
          <template v-slot:avatar>
            <q-icon name="event_busy" size="20px" />
          </template>
          {{ $t('visit.uploadNeedsVisit') }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat color="grey-7" :label="$t('common.cancel')" v-close-popup />
        <q-btn color="primary" icon="upload" :label="$t('visit.uploadSave')" :disable="!targetVisit || !categoryKey" :loading="saving" @click="save" unelevated />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVisitStore } from 'src/stores/visit-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useNotify } from 'src/composables/useNotify'
import { FILE_CATEGORIES, suggestFileCategory, getFileCategory } from 'src/shared/utils/file-category'
import { formatFileSize } from 'src/shared/utils/medical-utils.js'

defineOptions({
  name: 'FileUploadConfirmDialog',
})

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  fileData: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()
const visitStore = useVisitStore()
const dbStore = useDatabaseStore()
const notify = useNotify()

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const categoryKey = ref(null)
const targetVisit = ref(null)
const saving = ref(false)

const categoryOptions = computed(() => FILE_CATEGORIES.map((c) => ({ value: c.key, label: t(c.labelKey), icon: c.icon, color: c.color })))
const selectedCategory = computed(() => getFileCategory(categoryKey.value))
const suggested = computed(() => (props.fileData ? suggestFileCategory(props.fileData.fileInfo.filename) : null))

// Initialize suggestion + default visit whenever the dialog opens with a file
watch(
  () => props.modelValue,
  (open) => {
    if (open && props.fileData) {
      categoryKey.value = suggested.value?.key || 'other'
      // Default: currently selected visit, otherwise the newest one
      targetVisit.value = visitStore.visitOptions.find((o) => o.id === visitStore.selectedVisitId) || visitStore.visitOptions[0] || null
    }
  },
)

const save = async () => {
  if (!targetVisit.value || !props.fileData) return
  try {
    saving.value = true
    const visit = targetVisit.value.value

    await dbStore.uploadRawData(
      {
        ENCOUNTER_NUM: visit.id,
        CONCEPT_CD: selectedCategory.value.conceptCd,
        VALTYPE_CD: 'R',
        START_DATE: visit.date || new Date().toISOString().split('T')[0],
        CATEGORY_CHAR: 'Raw Data',
        LOCATION_CD: 'UPLOAD',
        INSTANCE_NUM: 1,
        UPLOAD_ID: 1,
      },
      props.fileData,
    )

    notify.success(t('visit.uploadSuccess', { filename: props.fileData.fileInfo.filename }))
    dialogModel.value = false
    emit('saved', { visitId: visit.id })
  } catch (error) {
    console.error('File upload failed:', error)
    notify.error(t('visit.uploadFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.file-row {
  background: $grey-1;
  border: 1px solid $grey-3;
  border-radius: 8px;
  padding: 10px 12px;
}
</style>
