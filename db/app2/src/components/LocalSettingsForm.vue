<template>
  <div>
    <q-form @submit="onSubmit" class="q-gutter-md">
      <!-- OpenAI API Key Section -->
      <div>
        <div class="text-subtitle2 q-mb-sm">{{ $t('settings.apiKeys') }}</div>
        <div class="text-caption text-grey-6 q-mb-md">{{ $t('settings.apiKeysHint') }}</div>

        <!-- OpenAI API Key Input -->
        <div class="q-mb-md">
          <q-input
            v-model="apiKeyInput"
            :type="showApiKey ? 'text' : 'password'"
            :label="$t('settings.openaiApiKey')"
            outlined
            dense
            :rules="[validateApiKey]"
            :placeholder="$t('settings.apiKeyPlaceholder')"
            :suffix="hasApiKey ? $t('settings.saved') : ''"
          >
            <template v-slot:append>
              <q-btn flat dense round :icon="showApiKey ? 'visibility_off' : 'visibility'" @click="showApiKey = !showApiKey" :disable="!hasApiKey && !apiKeyInput">
                <q-tooltip>{{ showApiKey ? $t('settings.hideApiKey') : $t('settings.showApiKey') }}</q-tooltip>
              </q-btn>
              <q-btn v-if="hasApiKey || apiKeyInput" flat dense round icon="clear" color="negative" @click="clearApiKey">
                <q-tooltip>{{ $t('settings.clearApiKey') }}</q-tooltip>
              </q-btn>
            </template>
          </q-input>
        </div>

        <!-- Security Warning -->
        <q-banner class="bg-orange-1 text-orange-9 q-mb-md" rounded>
          <template v-slot:avatar>
            <q-icon name="security" />
          </template>
          <div class="text-body2">
            <strong>{{ $t('settings.securityNotice') }}:</strong> {{ $t('settings.securityWarning') }}
          </div>
        </q-banner>

        <!-- Last Updated Info -->
        <div v-if="lastUpdated" class="text-caption text-grey-6 q-mb-md">{{ $t('settings.lastUpdated') }}: {{ formatDate(lastUpdated) }}</div>
      </div>

      <!-- Save/Cancel Buttons -->
      <div v-if="hasChanges" class="q-mt-lg">
        <q-btn type="submit" color="primary" :label="$t('settings.saveApiKey')" :loading="isSaving" unelevated />
        <q-btn class="q-ml-sm" color="grey" :label="$t('common.cancel')" outline @click="resetForm" />
      </div>
    </q-form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const { t } = useI18n()
const localSettingsStore = useLocalSettingsStore()

// Form state
const apiKeyInput = ref('')
const showApiKey = ref(false)
const isSaving = ref(false)

// Computed properties
const hasApiKey = computed(() => localSettingsStore.hasOpenAIApiKey())
const lastUpdated = computed(() => localSettingsStore.getApiKeyLastUpdated())
const hasChanges = computed(() => {
  const currentKey = localSettingsStore.getOpenAIApiKey()
  return apiKeyInput.value !== (currentKey || '')
})

// Methods
const validateApiKey = (val) => {
  if (!val || val.trim() === '') return true // Allow empty for clearing
  if (!val.startsWith('sk-')) return t('settings.apiKeyFormatError')
  if (val.length < 20) return t('settings.apiKeyTooShort')
  return true
}

const formatDate = (dateString) => {
  if (!dateString) return t('settings.never')
  return new Date(dateString).toLocaleString()
}

const clearApiKey = () => {
  apiKeyInput.value = ''
  showApiKey.value = false
}

const resetForm = () => {
  const currentKey = localSettingsStore.getOpenAIApiKey()
  apiKeyInput.value = currentKey || ''
  showApiKey.value = false
}

const onSubmit = async () => {
  if (!hasChanges.value) return

  isSaving.value = true
  try {
    if (apiKeyInput.value.trim() === '') {
      localSettingsStore.clearOpenAIApiKey()
    } else {
      localSettingsStore.setOpenAIApiKey(apiKeyInput.value.trim())
    }

    // Reset form state after successful save
    resetForm()
  } catch (error) {
    console.error('Failed to save API key:', error)
    // Error handling could be enhanced with notifications
  } finally {
    isSaving.value = false
  }
}

// Initialize form with current API key on mount
onMounted(() => {
  resetForm()
})
</script>

<style lang="scss" scoped>
.q-banner {
  border-left: 4px solid #fb8c00;
}
</style>
