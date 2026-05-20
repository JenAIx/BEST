<template>
  <div v-if="hasError" class="error-boundary q-pa-xl flex flex-center column">
    <q-icon name="error" size="64px" color="negative" class="q-mb-md" />
    <div class="text-h5 q-mb-sm">{{ $t('errors.unexpectedTitle') }}</div>
    <div class="text-body2 text-grey-7 q-mb-md">{{ $t('errors.unexpectedHint') }}</div>
    <q-card flat bordered class="q-mb-md error-detail" v-if="errorMessage">
      <q-card-section>
        <div class="text-caption text-grey-6">{{ $t('errors.detail') }}</div>
        <div class="text-body2 monospace">{{ errorMessage }}</div>
      </q-card-section>
    </q-card>
    <div class="q-gutter-sm">
      <q-btn :label="$t('common.reload')" color="primary" icon="refresh" @click="reloadApp" />
      <q-btn :label="$t('common.goHome')" flat @click="goHome" />
    </div>
  </div>
  <template v-else>
    <router-view />
    <!-- SmartButton FAB - available on all pages after login -->
    <SmartButton v-if="isAuthenticated" />
  </template>
</template>

<script setup>
import { computed, onMounted, onErrorCaptured, ref } from 'vue'
import SmartButton from 'src/components/smartbtn/SmartButton.vue'
import { useAuthStore } from 'src/stores/auth-store'
import { useLoggingStore } from 'src/stores/logging-store'

const authStore = useAuthStore()
const loggingStore = useLoggingStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

const hasError = ref(false)
const errorMessage = ref('')

// Top-level error boundary: any uncaught error from descendant components
// lands here and renders the fallback UI instead of a white screen.
onErrorCaptured((err, _instance, info) => {
  loggingStore.error('App', `Captured error from ${info}`, err)
  hasError.value = true
  errorMessage.value = err?.message || String(err)
  return false // stop propagation
})

const reloadApp = () => {
  // Hash-router; full reload also clears the error boundary state
  window.location.reload()
}

const goHome = () => {
  hasError.value = false
  errorMessage.value = ''
  window.location.hash = '#/dashboard'
}

// Initialize auth store on app mount to restore session
onMounted(async () => {
  try {
    await authStore.initAuth()
  } catch (err) {
    loggingStore.error('App', 'initAuth failed', err)
    hasError.value = true
    errorMessage.value = err?.message || String(err)
  }
})
</script>

<style scoped>
.error-boundary {
  min-height: 100vh;
  text-align: center;
}
.error-detail {
  max-width: 600px;
  width: 100%;
}
.monospace {
  font-family: 'Courier New', monospace;
  word-break: break-word;
}
</style>
