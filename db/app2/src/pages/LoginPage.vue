<template>
  <q-page class="login-page flex flex-center">
    <!-- Version Information -->
    <div class="absolute-top-right q-pa-md">
      <div class="version-info text-right" @click="onVersionInfo">
        <div class="text-caption text-grey-6">{{ appName }}</div>
        <div class="text-caption text-grey-7">v{{ appVersion }}</div>
        <div class="text-caption text-grey-8" v-if="buildDate">{{ buildDate }}</div>
      </div>
    </div>
    <div class="login-container">
      <!-- Logo and Title -->
      <div class="text-center q-mb-xl">
        <img src="/favicon.ico" alt="BEST Medical System Logo" style="width: 64px; height: 64px" class="q-mb-md" />
        <h1 class="text-h3 text-weight-bold q-my-none">{{ $t('auth.appName') }}</h1>
        <p class="text-subtitle1 text-grey-7 q-mt-sm">{{ $t('auth.appSubtitle') }}</p>
      </div>

      <!-- Login Form Card -->
      <q-card class="login-card shadow-2" flat>
        <q-card-section class="q-pa-xl">
          <q-form @submit="onLogin" class="q-gutter-md">
            <!-- Database Selection -->
            <div>
              <label class="text-weight-medium text-grey-8 q-mb-xs block">{{ $t('auth.database') }}</label>
              <q-select
                v-model="formData.database"
                :options="databaseOptions"
                option-value="value"
                option-label="label"
                outlined
                dense
                :rules="[(val) => !!val || $t('auth.selectDatabase')]"
                data-cy="login-database"
              >
                <template v-slot:prepend>
                  <q-icon name="storage" />
                </template>
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section avatar>
                      <q-icon name="storage" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption>
                        {{ scope.opt.description }}
                        <span v-if="scope.opt.customPath" class="text-positive"> <br />Custom: {{ scope.opt.customPath }} </span>
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-btn flat dense round icon="more_vert" color="grey-6" size="sm" @click.stop="onConfigureDatabase(scope.opt)" :title="`Configure ${scope.opt.label} folder path`" />
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>

            <!-- Username -->
            <div>
              <label class="text-weight-medium text-grey-8 q-mb-xs block">{{ $t('auth.username') }}</label>
              <q-input v-model="formData.username" outlined dense :placeholder="$t('auth.username')" :rules="[(val) => !!val || $t('validation.required')]" lazy-rules data-cy="login-username">
                <template v-slot:prepend>
                  <q-icon name="person" />
                </template>
              </q-input>
            </div>

            <!-- Password -->
            <div>
              <label class="text-weight-medium text-grey-8 q-mb-xs block">{{ $t('auth.password') }}</label>
              <q-input
                v-model="formData.password"
                outlined
                dense
                :type="showPassword ? 'text' : 'password'"
                :placeholder="$t('auth.password')"
                :rules="[(val) => !!val || $t('validation.required')]"
                lazy-rules
                data-cy="login-password"
              >
                <template v-slot:prepend>
                  <q-icon name="lock" />
                </template>
                <template v-slot:append>
                  <q-icon :name="showPassword ? 'visibility' : 'visibility_off'" class="cursor-pointer" @click="showPassword = !showPassword" />
                </template>
              </q-input>
            </div>

            <!-- Remember Me -->
            <div class="flex items-center justify-between">
              <q-checkbox v-model="formData.rememberMe" :label="$t('auth.rememberMe')" color="primary" dense />
              <q-btn flat dense no-caps color="primary" :label="$t('auth.forgotPassword')" @click="onForgotPassword" />
            </div>

            <!-- Error Message -->
            <q-banner v-if="loginError" class="text-negative bg-negative-1 q-mt-md" rounded dense>
              <template v-slot:avatar>
                <q-icon name="error" color="negative" />
              </template>
              {{ loginError }}
            </q-banner>

            <!-- Session Expired Message -->
            <q-banner v-if="sessionExpired" class="text-warning bg-warning-1 q-mt-md" rounded dense>
              <template v-slot:avatar>
                <q-icon name="schedule" color="warning" />
              </template>
              {{ $t('auth.sessionExpired') }}
            </q-banner>

            <!-- Submit Button -->
            <q-btn type="submit" color="primary" class="full-width q-mt-lg" size="lg" unelevated :loading="loading" :label="$t('auth.login')" data-cy="login-submit" />
          </q-form>
        </q-card-section>
      </q-card>

      <!-- Footer Links -->
      <div class="text-center q-mt-lg">
        <q-btn flat dense no-caps color="grey-7" :label="$t('common.help')" icon="help_outline" @click="onHelp" class="q-mx-sm" />
        <q-btn flat dense no-caps color="grey-7" :label="$t('common.about')" icon="info_outline" @click="onAbout" class="q-mx-sm" />
        <q-btn flat dense no-caps color="grey-7" :label="$t('changelog.title')" icon="history" @click="onChangelog" class="q-mx-sm" />
        <q-btn flat dense color="grey-7" @click="toggleLanguage" class="q-mx-sm">
          <q-icon :name="currentLanguageIcon" class="q-mr-xs" />
          {{ currentLanguageFlag }}
          <q-tooltip>{{ $t('settings.languageSettings') }}</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- Database Configuration Dialog -->
    <q-dialog v-model="showDatabaseConfigDialog" persistent>
      <q-card class="q-pa-md" style="min-width: 400px">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="folder" class="q-mr-sm" />
            {{ $t('auth.configureDatabaseFolder') }}
          </div>
          <div v-if="configDatabase" class="q-mb-md">
            <p class="text-subtitle2 q-mb-xs">{{ configDatabase.label }}</p>
            <p class="text-caption text-grey-7">{{ configDatabase.description }}</p>
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="q-mb-md">
            <label class="text-weight-medium text-grey-8 q-mb-xs block">{{ $t('auth.customFolderPath') }}</label>
            <q-input v-model="customFolderPath" outlined dense :placeholder="$t('auth.folderPathPlaceholder')" :hint="$t('auth.folderPathHint')">
              <template v-slot:prepend>
                <q-icon name="folder" />
              </template>
              <template v-slot:append>
                <q-btn flat dense round icon="folder_open" color="primary" @click="selectCustomFolder" :title="$t('auth.browseFolder')">
                  <q-tooltip>{{ $t('auth.browseFolder') }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </div>

          <div class="text-caption text-grey-6 q-mb-md">
            <q-icon name="info" class="q-mr-xs" />
            {{ $t('auth.databaseFileInfo', { filename: configDatabase?.filename }) }}
          </div>

          <div v-if="configDatabase?.customPath" class="q-mb-md">
            <div class="text-caption text-grey-7">{{ $t('auth.currentCustomPath') }}: {{ configDatabase.customPath }}</div>
            <div class="text-caption text-grey-7">{{ $t('auth.fullDatabasePath') }}: {{ configDatabase.value }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pt-none">
          <q-btn flat :label="$t('common.cancel')" color="grey-7" @click="onCancelDatabaseConfig" />
          <q-btn flat :label="$t('auth.clearCustomPath')" color="orange" @click="customFolderPath = ''" v-if="configDatabase?.customPath" />
          <q-btn unelevated :label="$t('common.save')" color="primary" @click="onSaveDatabaseConfig" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from 'src/stores/auth-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLogger } from '../shared/composables/useLogger.js'
// import { useDatabaseStore } from 'src/stores/database-store'

const $q = useQuasar()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const localSettingsStore = useLocalSettingsStore()
const logger = useLogger('LoginPage')
// const dbStore = useDatabaseStore()

// Version information from environment variables and package.json
const appName = computed(() => import.meta.env.VITE_APP_NAME || 'BEST Medical System')
const appVersion = computed(() => import.meta.env.VITE_APP_VERSION || '0.0.1')
const buildDate = computed(() => {
  const envDate = import.meta.env.VITE_APP_BUILD_DATE
  if (envDate && envDate !== 'undefined') {
    try {
      return new Date(envDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return envDate
    }
  }
  // Show development mode indicator
  return import.meta.env.DEV ? 'Development' : null
})

// Form data
const formData = reactive({
  database: null,
  username: '',
  password: '',
  rememberMe: false,
})

// UI state
const loading = ref(false)
const showPassword = ref(false)
const loginError = computed(() => authStore.loginError)
const sessionExpired = computed(() => route.query.expired === 'true')

// Database configuration state
const showDatabaseConfigDialog = ref(false)
const configDatabase = ref(null)
const customFolderPath = ref('')

// Database configuration
const baseDatabaseConfigs = [
  {
    name: 'production',
    label: 'Production Database',
    filename: 'production.db',
    description: 'Main production database',
  },
  {
    name: 'development',
    label: 'Development Database',
    filename: 'development.db',
    description: 'Development and testing',
  },
  {
    name: 'demo',
    label: 'Demo Database',
    filename: 'demo.db',
    description: 'Demo data for training',
  },
]

// Database options with custom paths
const databaseOptions = computed(() => {
  return baseDatabaseConfigs.map((config) => ({
    ...config,
    value: localSettingsStore.buildDatabasePath(config.name, config.filename),
    customPath: localSettingsStore.getDatabaseCustomPath(config.name),
  }))
})

// Language toggle functionality
const currentLanguageFlag = computed(() => {
  return locale.value === 'de' ? 'DE' : 'EN'
})

const currentLanguageIcon = computed(() => {
  return 'language'
})

const toggleLanguage = () => {
  const newLocale = locale.value === 'de' ? 'en' : 'de'
  locale.value = newLocale

  try {
    localStorage?.setItem('locale', newLocale)
  } catch (error) {
    console.warn('Error saving locale:', error)
  }

  logger.info('Language toggled', {
    from: locale.value === 'de' ? 'en' : 'de',
    to: newLocale,
  })

  $q.notify({
    message: newLocale === 'de' ? 'Sprache auf Deutsch geändert' : 'Language changed to English',
    type: 'info',
    position: 'top',
    timeout: 1500,
  })
}

// Initialize
onMounted(async () => {
  // Initialize local settings store
  localSettingsStore.initialize()

  logger.logMounted({
    availableDatabases: databaseOptions.value.length,
    redirectFrom: route.query.redirect,
    isAuthenticated: authStore.isAuthenticated,
    hasCustomDatabasePaths: localSettingsStore.hasDatabaseCustomPaths(),
    appVersion: appVersion.value,
    appName: appName.value,
    buildDate: buildDate.value,
    isDevelopment: import.meta.env.DEV,
  })

  // Check if already authenticated
  await authStore.initAuth()
  if (authStore.isAuthenticated) {
    const redirect = route.query.redirect || '/dashboard'
    logger.info('User already authenticated, redirecting', { redirect })
    router.push(redirect)
  }

  // Set default database
  if (databaseOptions.value.length > 0) {
    formData.database = databaseOptions.value[0]
    logger.debug('Default database selected', {
      database: formData.database.value,
      customPath: formData.database.customPath,
    })
  }
})

onUnmounted(() => {
  logger.logUnmounted()
})

// Login handler
const onLogin = async () => {
  const timer = logger.startTimer('Login Form Submit')

  logger.logFormSubmit('LoginForm', {
    database: formData.database?.value,
    username: formData.username,
    rememberMe: formData.rememberMe,
  })

  loading.value = true
  logger.info('Login form submission started', {
    database: formData.database?.value,
    username: formData.username,
  })

  try {
    const credentials = {
      username: formData.username,
      password: formData.password,
      database: formData.database.value,
      rememberMe: formData.rememberMe,
    }

    const success = await authStore.login(credentials)

    if (success) {
      const duration = timer.end()
      logger.success('Login successful', {
        username: formData.username,
        database: formData.database.value,
        duration: `${duration.toFixed(2)}ms`,
      })

      $q.notify({
        type: 'positive',
        message: `Welcome back, ${authStore.userName}!`,
        position: 'top',
      })

      // Redirect to intended page or dashboard
      const redirect = route.query.redirect || '/dashboard'
      logger.logNavigation('/login', redirect, 'redirect')
      router.push(redirect)
    }
  } catch (error) {
    timer.end()
    logger.error('Login form error', error, {
      username: formData.username,
      database: formData.database?.value,
    })

    $q.notify({
      type: 'negative',
      message: 'Login failed. Please try again.',
      position: 'top',
    })
  } finally {
    loading.value = false
  }
}

// Forgot password handler
const onForgotPassword = () => {
  $q.dialog({
    title: 'Reset Password',
    message: 'Please contact your system administrator to reset your password.',
    persistent: false,
  })
}

// Help handler
const onHelp = () => {
  $q.dialog({
    title: t('auth.loginHelp'),
    message: `
      <p>${t('auth.helpIntro')}:</p>
      <ol>
        <li>${t('auth.helpStep1')}</li>
        <li>${t('auth.helpStep2')}</li>
        <li>${t('auth.helpStep3')}</li>
      </ol>
      <p class="q-mt-md">${t('auth.helpSupport')}</p>
    `,
    html: true,
    persistent: false,
  })
}

// Database configuration handlers
const onConfigureDatabase = (database) => {
  configDatabase.value = database
  customFolderPath.value = database.customPath || ''
  showDatabaseConfigDialog.value = true

  logger.info('Opening database configuration dialog', {
    database: database.name,
    currentPath: database.value,
    customPath: database.customPath,
  })
}

const onSaveDatabaseConfig = () => {
  if (!configDatabase.value) return

  const trimmedPath = customFolderPath.value.trim()
  const databaseName = configDatabase.value.name

  // Save or clear the custom path
  if (trimmedPath) {
    localSettingsStore.setDatabaseCustomPath(databaseName, trimmedPath)
    logger.info('Database custom path saved', {
      database: databaseName,
      customPath: trimmedPath,
    })

    $q.notify({
      type: 'positive',
      message: `Custom folder path saved for ${configDatabase.value.label}`,
      position: 'top',
    })
  } else {
    localSettingsStore.clearDatabaseCustomPath(databaseName)
    logger.info('Database custom path cleared', {
      database: databaseName,
    })

    $q.notify({
      type: 'info',
      message: `Using default folder for ${configDatabase.value.label}`,
      position: 'top',
    })
  }

  // Update formData.database with the new path if it's the currently selected database
  // This ensures the login uses the updated path immediately without requiring a reload
  if (formData.database && formData.database.name === databaseName) {
    // Find the updated database option from the computed property
    const updatedDatabase = databaseOptions.value.find((db) => db.name === databaseName)
    if (updatedDatabase) {
      formData.database = updatedDatabase
      logger.debug('Updated formData.database with new path', {
        database: databaseName,
        newPath: updatedDatabase.value,
        customPath: updatedDatabase.customPath,
      })
    }
  }

  // Close dialog
  showDatabaseConfigDialog.value = false
  configDatabase.value = null
  customFolderPath.value = ''
}

const onCancelDatabaseConfig = () => {
  showDatabaseConfigDialog.value = false
  configDatabase.value = null
  customFolderPath.value = ''
}

const selectCustomFolder = async () => {
  try {
    // Use Electron's dialog API if available
    if (window.electron && window.electron.dialog) {
      // Determine the best default path to start from
      let defaultPath = window.electron.appPath || window.electron.homedir

      // If there's already a custom path set, start from there
      if (customFolderPath.value) {
        defaultPath = customFolderPath.value
      }
      // Or use the current database folder if it exists
      else if (configDatabase.value?.customPath) {
        defaultPath = configDatabase.value.customPath
      }
      // Or try the default database folder
      else if (window.electron.fs && window.electron.path) {
        const dbFolder = window.electron.path.join(defaultPath, 'database')
        if (window.electron.fs.existsSync(dbFolder)) {
          defaultPath = dbFolder
        }
      }

      logger.debug('Opening folder dialog', { defaultPath })

      const result = await window.electron.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Database Folder',
        defaultPath: defaultPath,
        buttonLabel: 'Select Folder',
      })

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        customFolderPath.value = result.filePaths[0]
        logger.info('Folder selected via dialog', {
          path: result.filePaths[0],
          platform: window.electron.platform,
        })

        $q.notify({
          type: 'positive',
          message: `Folder selected: ${result.filePaths[0]}`,
          position: 'top',
          timeout: 2000,
        })
      } else {
        logger.debug('Folder selection canceled')
      }
    } else {
      // Fallback for web environment
      logger.warn('Electron dialog API not available, falling back to manual entry')
      $q.notify({
        type: 'info',
        message: 'Please enter the folder path manually',
        position: 'top',
      })
    }
  } catch (error) {
    logger.error('Error selecting folder', error)
    $q.notify({
      type: 'negative',
      message: 'Error opening folder dialog',
      position: 'top',
    })
  }
}

// Version info handler
const onVersionInfo = () => {
  logger.info('Version info clicked', {
    appName: appName.value,
    appVersion: appVersion.value,
    buildDate: buildDate.value,
  })

  $q.dialog({
    title: 'Version Information',
    message: `
      <div class="text-center q-mb-md">
        <p class="text-h6 q-mb-sm">${appName.value}</p>
        <p class="text-subtitle1 q-mb-xs">Version ${appVersion.value}</p>
        ${buildDate.value ? `<p class="text-body2 q-mb-sm">Build Date: ${buildDate.value}</p>` : ''}
        <p class="text-caption text-grey-7">Base for Experiment Storage & Tracking</p>
      </div>

      <div class="q-mb-md">
        <p><strong>Environment:</strong> ${import.meta.env.DEV ? 'Development' : 'Production'}</p>
        <p><strong>Mode:</strong> ${import.meta.env.MODE}</p>
        <p><strong>Developer:</strong> Stefan Brodoehl</p>
      </div>
    `,
    html: true,
    persistent: false,
    style: 'max-width: 400px',
  })
}

// Changelog handler
const onChangelog = () => {
  logger.info('Changelog clicked')
  router.push('/changelog')
}

// About handler
const onAbout = () => {
  $q.dialog({
    title: t('auth.aboutTitle'),
    message: `
      <div class="text-center q-mb-md">
        <p class="text-h6 q-mb-sm">${appName.value}</p>
        <p class="text-subtitle2 q-mb-xs">${t('auth.version')} ${appVersion.value}</p>
        <p class="text-caption text-grey-7">${t('auth.appSubtitle')}</p>
        ${buildDate.value ? `<p class="text-caption text-grey-7">${t('auth.build')}: ${buildDate.value}</p>` : ''}
      </div>

      <div class="q-mb-md">
        <p><strong>${t('auth.developer')}:</strong> Stefan Brodoehl</p>
      </div>

      <div class="q-mb-md">
        <p><strong>${t('auth.technologyStack')}:</strong></p>
        <ul class="q-mt-xs">
          <li><strong>${t('auth.frontend')}:</strong> Vue.js 3 with Composition API</li>
          <li><strong>${t('auth.uiFramework')}:</strong> Quasar Framework v2.18.2</li>
          <li><strong>${t('auth.buildTool')}:</strong> Vite v2.3.0</li>
          <li><strong>${t('auth.stateManagement')}:</strong> Pinia</li>
        </ul>
      </div>

      <div class="q-mb-md">
        <p><strong>${t('auth.database')}:</strong></p>
        <ul class="q-mt-xs">
          <li><strong>${t('auth.engine')}:</strong> SQLite3</li>
          <li><strong>${t('auth.features')}:</strong> ${t('auth.databaseFeatures')}</li>
          <li><strong>${t('auth.storage')}:</strong> ${t('auth.localFileStorage')}</li>
        </ul>
      </div>

      <div class="q-mb-md">
        <p><strong>${t('auth.architecture')}:</strong></p>
        <ul class="q-mt-xs">
          <li>${t('auth.componentBased')}</li>
          <li>${t('auth.repositoryPattern')}</li>
          <li>${t('auth.serviceLayer')}</li>
          <li>${t('auth.protectedRouting')}</li>
        </ul>
      </div>
    `,
    html: true,
    persistent: false,
    style: 'max-width: 500px',
  })
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.login-container {
  width: 100%;
  max-width: 420px;
  padding: 20px;
}

.login-card {
  border-radius: 12px;
  overflow: hidden;
}

label {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 4px;
}

:deep(.q-field__control) {
  height: 48px;
}

:deep(.q-field__prepend) {
  color: $grey-6;
}

.version-info {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 8px 12px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .text-caption {
    line-height: 1.2;
    font-size: 0.75rem;
    margin: 1px 0;
  }
}
</style>
