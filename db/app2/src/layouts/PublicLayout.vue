<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <router-view />
      <SmartButton />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { SmartButton } from 'src/components/smartbtn'

/**
 * PublicLayout
 *
 * Simple layout for public pages like login and error pages
 * that don't need the full MainLayout with sidebar and header.
 */

defineOptions({
  name: 'PublicLayout',
})
</script>

<style lang="scss" scoped>
// Minimal styling for public pages
</style>
