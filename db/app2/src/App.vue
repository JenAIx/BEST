<template>
  <router-view />
  <!-- SmartButton FAB - available on all pages after login -->
  <SmartButton v-if="isAuthenticated" />
</template>

<script setup>
import { computed, onMounted } from 'vue'
import SmartButton from 'src/components/smartbtn/SmartButton.vue'
import { useAuthStore } from 'src/stores/auth-store'
import 'src/components/smartbtn'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

// Initialize auth store on app mount to restore session
onMounted(async () => {
  await authStore.initAuth()
})
</script>
