<template>
  <q-page class="flex flex-center">
    <div class="text-center">
      <q-icon name="block" size="120px" color="negative" class="q-mb-md" />

      <h1 class="text-h2 text-weight-bold q-my-md">403</h1>

      <p class="text-h5 text-grey-8 q-mb-xl">Access Forbidden</p>

      <p class="text-body1 text-grey-7 q-mb-xl" style="max-width: 400px">
        {{ errorMessage }}
      </p>

      <div class="q-gutter-sm">
        <q-btn color="primary" unelevated label="Go to Dashboard" icon="dashboard" to="/dashboard" />

        <q-btn outline color="primary" label="Go Back" icon="arrow_back" @click="$router.go(-1)" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({
  name: 'ErrorForbidden',
})

const route = useRoute()

const errorMessage = computed(() => {
  return route.query.message || 'You do not have permission to access this page. Please contact your administrator if you believe this is an error.'
})
</script>
