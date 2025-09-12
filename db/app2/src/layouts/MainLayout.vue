<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Header -->
    <q-header elevated class="bg-white text-dark">
      <q-toolbar class="q-py-sm">
        <!-- Menu Toggle -->
        <q-btn flat dense round icon="menu" :aria-label="$t('common.menu')" @click="toggleLeftDrawer" class="q-mr-sm" />

        <!-- Logo and Brand -->
        <q-toolbar-title class="flex items-center cursor-pointer" @click="router.push('/dashboard')">
          <q-icon name="medical_services" size="32px" color="primary" class="q-mr-sm" />
          <span class="text-h6 text-weight-medium">BEST</span>
          <q-tooltip>{{ $t('auth.appName') }}, click to go to the {{ $t('common.dashboard') }}</q-tooltip>
        </q-toolbar-title>

        <!-- Mode Toggle - Only show on Dashboard -->
        <q-btn-toggle
          v-if="isDashboard"
          v-model="viewMode"
          toggle-color="primary"
          :options="[
            { label: $t('dashboard.visitMode'), value: 'visit', icon: 'person' },
            { label: $t('dashboard.deepWork'), value: 'deep', icon: 'analytics' },
          ]"
          unelevated
          size="sm"
          class="q-mr-md"
        />

        <!-- Smart Search -->
        <SmartSearch class="q-mr-md" @search-active="onSearchActive" @search-cleared="onSearchCleared" />

        <!-- Language Toggle -->
        <q-btn flat dense color="grey-7" @click="toggleLanguage" class="q-mr-md">
          <q-icon name="language" class="q-mr-xs" />
          {{ currentLanguageFlag }}
          <q-tooltip>{{ $t('settings.languageSettings') }}</q-tooltip>
        </q-btn>

        <!-- Notifications -->
        <NotificationButton />

        <!-- User Menu -->
        <q-btn flat round dense class="q-ml-sm">
          <q-avatar size="32px" color="primary" text-color="white">
            {{ userInitials }}
          </q-avatar>
          <q-menu>
            <q-list style="min-width: 200px">
              <q-item>
                <q-item-section avatar>
                  <q-avatar color="primary" text-color="white">
                    {{ userInitials }}
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ userName }}</q-item-label>
                  <q-item-label caption>{{ userRole }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup to="/settings">
                <q-item-section avatar>
                  <q-icon name="settings" />
                </q-item-section>
                <q-item-section>{{ $t('common.settings') }}</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="onLogout">
                <q-item-section avatar>
                  <q-icon name="logout" />
                </q-item-section>
                <q-item-section>{{ $t('common.logout') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <!-- Connection Status -->
        <q-chip :color="isConnected ? 'positive' : 'negative'" text-color="white" size="sm" icon="storage" class="q-ml-sm">
          {{ isConnected ? $t('common.connected') : $t('common.disconnected') }}
        </q-chip>
      </q-toolbar>
    </q-header>

    <!-- Sidebar -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      :mini="miniState"
      @mouseover="miniState = false"
      @mouseout="miniState = true"
      mini-to-overlay
      :width="260"
      :mini-width="60"
      :breakpoint="600"
      bordered
      class="bg-grey-2"
    >
      <q-scroll-area class="fit">
        <q-list padding>
          <!-- Dashboard -->
          <q-item clickable v-ripple to="/dashboard" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="dashboard" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.dashboard') }}</q-item-section>
          </q-item>

          <q-separator spaced />

          <!-- Patient Management -->
          <q-item-label header class="text-weight-bold text-uppercase text-grey-7">{{ $t('navigation.patientManagement') }}</q-item-label>

          <q-item clickable v-ripple to="/patients" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="people" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.patientSearch') }}</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/visits" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="event" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.patientVisits') }}</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/questionnaires" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="quiz" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.questionnaires') }}</q-item-section>
          </q-item>

          <q-separator spaced />

          <!-- Study Management -->
          <q-item-label header class="text-weight-bold text-uppercase text-grey-7">{{ $t('navigation.studyManagement') }}</q-item-label>

          <q-item clickable v-ripple to="/studies" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="science" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.studySearch') }}</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/data-grid" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="grid_on" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.dataGrid') }}</q-item-section>
          </q-item>

          <q-separator spaced />

          <!-- Administration -->
          <q-item-label header class="text-weight-bold text-uppercase text-grey-7">{{ $t('navigation.administration') }}</q-item-label>

          <q-item v-if="canAccess('/concepts')" clickable v-ripple to="/concepts" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="category" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.concepts') }}</q-item-section>
          </q-item>

          <q-item v-if="canAccess('/cql')" clickable v-ripple to="/cql" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="code" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.cqlRules') }}</q-item-section>
          </q-item>

          <q-item v-if="isAdmin" clickable v-ripple to="/users" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="manage_accounts" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.userManagement') }}</q-item-section>
          </q-item>

          <q-item v-if="isAdmin" clickable v-ripple to="/global-settings" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="settings_applications" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.globalSettings') }}</q-item-section>
          </q-item>

          <q-separator spaced />

          <!-- Data Operations -->
          <q-item-label header class="text-weight-bold text-uppercase text-grey-7">{{ $t('navigation.dataOperations') }}</q-item-label>

          <q-item clickable v-ripple to="/import" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="upload" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.import') }}</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/export" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="download" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.export') }}</q-item-section>
          </q-item>

          <!-- Development -->
          <q-separator spaced />

          <q-item clickable v-ripple to="/database-test" active-class="bg-primary text-white">
            <q-item-section avatar>
              <q-icon name="bug_report" />
            </q-item-section>
            <q-item-section>{{ $t('navigation.databaseTest') }}</q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <!-- Page Container -->
    <q-page-container>
      <!-- Breadcrumb -->
      <div class="q-pa-sm bg-grey-1 text-grey-7">
        <q-breadcrumbs>
          <q-breadcrumbs-el icon="home" to="/" />
          <q-breadcrumbs-el v-for="crumb in breadcrumbs" :key="crumb.path" :label="crumb.label" :to="crumb.path" />
        </q-breadcrumbs>
      </div>

      <!-- Router View -->
      <router-view :class="{ 'search-active': isSearchActive }" />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from 'src/stores/auth-store'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import NotificationButton from 'src/components/shared/NotificationButton.vue'
import SmartSearch from 'src/components/shared/SmartSearch.vue'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const dbStore = useDatabaseStore()
const localSettingsStore = useLocalSettingsStore()

// UI State
const leftDrawerOpen = ref(false)
const miniState = ref(true)
const viewMode = ref('visit')
const isSearchActive = ref(false)

// User Info
const userName = computed(() => authStore.userName || 'User')
const userRole = computed(() => {
  const role = authStore.userRole
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User'
})
const userInitials = computed(() => {
  const name = authStore.userName || 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})
const isAdmin = computed(() => authStore.isAdmin)
const isConnected = computed(() => dbStore.isConnected)

// Language toggle functionality
const currentLanguageFlag = computed(() => {
  return locale.value === 'de' ? 'DE' : 'EN'
})

const toggleLanguage = () => {
  try {
    const newLocale = locale.value === 'de' ? 'en' : 'de'
    locale.value = newLocale

    try {
      localStorage?.setItem('locale', newLocale)
    } catch (storageError) {
      console.warn('Error saving locale to localStorage:', storageError)
    }

    $q.notify({
      message: newLocale === 'de' ? 'Sprache auf Deutsch geändert' : 'Language changed to English',
      type: 'info',
      position: 'top',
      timeout: 1500,
    })
  } catch (error) {
    console.error('Error in toggleLanguage:', error)
    $q.notify({
      message: 'Error switching language',
      type: 'negative',
      position: 'top',
    })
  }
}

// Check if current page is Dashboard
const isDashboard = computed(() => route.path === '/dashboard')

// Breadcrumbs
const breadcrumbs = computed(() => {
  const paths = route.path.split('/').filter((p) => p)
  const crumbs = []
  let currentPath = ''

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]
    currentPath += `/${path}`

    // Special handling for patient routes
    if (path === 'patient' && i < paths.length - 1) {
      // For individual patient pages, link back to patients list
      crumbs.push({
        label: 'Patients',
        path: '/patients',
      })
    } else {
      crumbs.push({
        label: path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' '),
        path: currentPath,
      })
    }
  }

  return crumbs
})

// Methods
const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

// Search event handlers
const onSearchActive = (active) => {
  isSearchActive.value = active
  // Emit event for components to react to search state
  window.dispatchEvent(new CustomEvent('searchStateChanged', { detail: active }))
}

const onSearchCleared = () => {
  isSearchActive.value = false
  window.dispatchEvent(new CustomEvent('searchStateChanged', { detail: false }))
}

const canAccess = (routePath) => {
  return authStore.canAccessRoute(routePath)
}

const onLogout = async () => {
  $q.dialog({
    title: t('auth.confirmLogout'),
    message: t('auth.confirmLogoutMessage'),
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    await authStore.logout()
    router.push('/login')
    $q.notify({
      type: 'info',
      message: t('auth.loggedOut'),
      position: 'top',
    })
  })
}

// Watch for view mode changes
watch(viewMode, (newMode) => {
  // Store view mode preference
  localStorage.setItem('viewMode', newMode)

  // Emit event for components to react to mode change
  window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: newMode }))
})

// Initialize view mode from storage
const savedMode = localStorage.getItem('viewMode')
if (savedMode) {
  viewMode.value = savedMode
}

// Initialize local settings store on app mount
onMounted(() => {
  localSettingsStore.initialize()
})
</script>

<style lang="scss" scoped>
.q-drawer {
  .q-item {
    border-radius: 0 24px 24px 0;
    margin-right: 12px;

    &.bg-primary {
      .q-icon {
        color: white !important;
      }
    }
  }

  .q-item-label.header {
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }
}

:deep(.q-toolbar) {
  min-height: 64px;
}

// Search active state - dim the main content when search overlay is shown
.search-active {
  opacity: 0.3;
  pointer-events: none;
  transition: opacity 0.3s ease;
}
</style>
