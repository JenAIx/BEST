<template>
  <q-dialog v-model="dialogModel" persistent>
    <q-card style="min-width: 500px">
      <q-card-section>
        <div class="row items-center">
          <!-- Info/Edit Button on the left -->
          <div class="col-auto">
            <!-- Info Button for normal users -->
            <q-btn
              v-if="!isAdmin"
              flat
              round
              icon="info"
              color="primary"
              @click="showInfoDialog = true"
            >
              <q-tooltip>{{ $t('visit.fieldSetInfo') }}</q-tooltip>
            </q-btn>
            <!-- Edit Button for admins -->
            <q-btn
              v-if="isAdmin"
              flat
              round
              icon="edit"
              color="primary"
              @click="goToGlobalSettings"
            >
              <q-tooltip>{{ $t('visit.editFieldSetsInGlobalSettings') }}</q-tooltip>
            </q-btn>
          </div>
          <!-- Title in the center -->
          <div class="col text-center">
            <div class="text-h6">{{ $t('visit.configureObservationCategories') }}</div>
          </div>
          <!-- Spacer to balance layout -->
          <div class="col-auto" style="width: 48px;"></div>
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-list>
          <q-item v-for="fieldSet in availableFieldSets" :key="fieldSet.id">
            <q-item-section avatar>
              <q-icon :name="fieldSet.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ fieldSet.name }}</q-item-label>
              <q-item-label caption>{{ fieldSet.description }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="fieldSetConfig[fieldSet.id]" :true-value="true" :false-value="false" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat :label="$t('common.cancel')" @click="cancel" />
        <q-btn color="primary" :label="$t('common.save')" @click="save" />
      </q-card-actions>
    </q-card>

    <!-- Info Dialog for normal users -->
    <q-dialog v-model="showInfoDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ $t('visit.fieldSetInfoTitle') }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <p>{{ $t('visit.fieldSetInfoDescription') }}</p>
          <p class="q-mt-md">
            <strong>{{ $t('visit.fieldSetInfoEditLocation') }}</strong>
          </p>
          <p>{{ $t('visit.fieldSetInfoEditInstructions') }}</p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('common.close')" color="primary" @click="showInfoDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  availableFieldSets: {
    type: Array,
    required: true,
  },
  activeFieldSets: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const router = useRouter()
const authStore = useAuthStore()

// Local state
const fieldSetConfig = ref({})
const showInfoDialog = ref(false)

// Computed
const isAdmin = computed(() => authStore.isAdmin)

// Dialog model
const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Initialize config when dialog opens
watch(
  () => props.modelValue,
  (show) => {
    if (show) {
      // Reset config to current active field sets
      fieldSetConfig.value = {}
      props.availableFieldSets.forEach((fs) => {
        fieldSetConfig.value[fs.id] = props.activeFieldSets.includes(fs.id)
      })
    }
  },
)

// Methods
const save = () => {
  const selectedFieldSets = Object.keys(fieldSetConfig.value).filter((key) => fieldSetConfig.value[key])

  emit('save', selectedFieldSets)
  dialogModel.value = false
}

const cancel = () => {
  emit('cancel')
  dialogModel.value = false
}

const goToGlobalSettings = () => {
  // Close this dialog first
  dialogModel.value = false
  // Navigate to Global Settings with query parameters
  router.push({
    path: '/global-settings',
    query: {
      table: 'VISIT_DIMENSION',
      column: 'FIELD_SET_CD',
    },
  })
}
</script>

<style lang="scss" scoped>
// Styles are minimal since this is a simple dialog
</style>
