<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
/**
 * PublicLayout
 * 
 * Simple layout for public pages like login and error pages
 * that don't need the full MainLayout with sidebar and header.
 */

defineOptions({
  name: 'PublicLayout'
})
</script>

<style lang="scss" scoped>
// Minimal styling for public pages
</style>
