<template>
  <q-page class="login-page flex flex-center">
    <div class="login-container">
      <!-- Logo and Title -->
      <div class="text-center q-mb-xl">
        <img src="/favicon.ico" alt="BEST Medical System Logo" style="width: 64px; height: 64px" class="q-mb-md" />
        <h1 class="text-h3 text-weight-bold q-my-none">BEST Medical System</h1>
        <p class="text-subtitle1 text-grey-7 q-mt-sm">Base for Experiment Storage & Tracking</p>
      </div>

      <!-- Login Form Card -->
      <q-card class="login-card shadow-2" flat>
        <q-card-section class="q-pa-xl">
          <q-form @submit="onLogin" class="q-gutter-md">
            <!-- Database Selection -->
            <div>
              <label class="text-weight-medium text-grey-8 q-mb-xs block"> Database </label>
              <q-select v-model="formData.database" :options="databaseOptions" option-value="value" option-label="label" outlined dense :rules="[(val) => !!val || 'Please select a database']">
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
              <label class="text-weight-medium text-grey-8 q-mb-xs block"> Username </label>
              <q-input v-model="formData.username" outlined dense placeholder="Enter your username" :rules="[(val) => !!val || 'Username is required']" lazy-rules>
                <template v-slot:prepend>
                  <q-icon name="person" />
                </template>
              </q-input>
            </div>

            <!-- Password -->
            <div>
              <label class="text-weight-medium text-grey-8 q-mb-xs block"> Password </label>
              <q-input
                v-model="formData.password"
                outlined
                dense
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter your password"
                :rules="[(val) => !!val || 'Password is required']"
                lazy-rules
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
              <q-checkbox v-model="formData.rememberMe" label="Remember me" color="primary" dense />
              <q-btn flat dense no-caps color="primary" label="Forgot password?" @click="onForgotPassword" />
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
              Your session has expired. Please login again.
            </q-banner>

            <!-- Submit Button -->
            <q-btn type="submit" color="primary" class="full-width q-mt-lg" size="lg" unelevated :loading="loading" label="Login" />
          </q-form>
        </q-card-section>
      </q-card>

      <!-- Footer Links -->
      <div class="text-center q-mt-lg">
        <q-btn flat dense no-caps color="grey-7" label="Help" icon="help_outline" @click="onHelp" class="q-mx-sm" />
        <q-btn flat dense no-caps color="grey-7" label="About" icon="info_outline" @click="onAbout" class="q-mx-sm" />
      </div>
    </div>

    <!-- Database Configuration Dialog -->
    <q-dialog v-model="showDatabaseConfigDialog" persistent>
      <q-card class="q-pa-md" style="min-width: 400px">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="folder" class="q-mr-sm" />
            Configure Database Folder
          </div>
          <div v-if="configDatabase" class="q-mb-md">
            <p class="text-subtitle2 q-mb-xs">{{ configDatabase.label }}</p>
            <p class="text-caption text-grey-7">{{ configDatabase.description }}</p>
          </div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <div class="q-mb-md">
            <label class="text-weight-medium text-grey-8 q-mb-xs block"> Custom Folder Path (leave empty for default) </label>
            <q-input v-model="customFolderPath" outlined dense placeholder="e.g., /path/to/your/database/folder" :hint="`Default: ./database/`">
              <template v-slot:prepend>
                <q-icon name="folder" />
              </template>
              <template v-slot:append>
                <q-btn flat dense round icon="folder_open" @click="selectCustomFolder" title="Browse folder" />
              </template>
            </q-input>
          </div>

          <div class="text-caption text-grey-6 q-mb-md">
            <q-icon name="info" class="q-mr-xs" />
            The database file ({{ configDatabase?.filename }}) will be stored in this folder.
          </div>

          <div v-if="configDatabase?.customPath" class="q-mb-md">
            <div class="text-caption text-grey-7">Current custom path: {{ configDatabase.customPath }}</div>
            <div class="text-caption text-grey-7">Full database path: {{ configDatabase.value }}</div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pt-none">
          <q-btn flat label="Cancel" color="grey-7" @click="onCancelDatabaseConfig" />
          <q-btn flat label="Clear Custom Path" color="orange" @click="customFolderPath = ''" v-if="configDatabase?.customPath" />
          <q-btn unelevated label="Save" color="primary" @click="onSaveDatabaseConfig" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import { useLogger } from '../shared/composables/useLogger.js'
// import { useDatabaseStore } from 'src/stores/database-store'

const $q = useQuasar()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const localSettingsStore = useLocalSettingsStore()
const logger = useLogger('LoginPage')
// const dbStore = useDatabaseStore()

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

// Initialize
onMounted(async () => {
  // Initialize local settings store
  localSettingsStore.initialize()

  logger.logMounted({
    availableDatabases: databaseOptions.value.length,
    redirectFrom: route.query.redirect,
    isAuthenticated: authStore.isAuthenticated,
    hasCustomDatabasePaths: localSettingsStore.hasDatabaseCustomPaths(),
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
    title: 'Login Help',
    message: `
      <p>To access the BEST Medical System:</p>
      <ol>
        <li>Select your database from the dropdown</li>
        <li>Enter your username and password</li>
        <li>Click Login to continue</li>
      </ol>
      <p class="q-mt-md">For technical support, contact your IT department.</p>
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

  // Save or clear the custom path
  if (trimmedPath) {
    localSettingsStore.setDatabaseCustomPath(configDatabase.value.name, trimmedPath)
    logger.info('Database custom path saved', {
      database: configDatabase.value.name,
      customPath: trimmedPath,
    })

    $q.notify({
      type: 'positive',
      message: `Custom folder path saved for ${configDatabase.value.label}`,
      position: 'top',
    })
  } else {
    localSettingsStore.clearDatabaseCustomPath(configDatabase.value.name)
    logger.info('Database custom path cleared', {
      database: configDatabase.value.name,
    })

    $q.notify({
      type: 'info',
      message: `Using default folder for ${configDatabase.value.label}`,
      position: 'top',
    })
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
      const result = await window.electron.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Database Folder',
      })

      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        customFolderPath.value = result.filePaths[0]
        logger.debug('Folder selected via dialog', { path: result.filePaths[0] })
      }
    } else {
      // Fallback for web environment
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

// About handler
const onAbout = () => {
  $q.dialog({
    title: 'About BEST Medical System',
    message: `
      <div class="text-center q-mb-md">
        <p class="text-h6 q-mb-sm">BEST Medical System</p>
        <p class="text-caption text-grey-7">Base for Experiment Storage & Tracking</p>
      </div>
      
      <div class="q-mb-md">
        <p><strong>Developer:</strong> Stefan Brodoehl</p>
      </div>
      
      <div class="q-mb-md">
        <p><strong>Technology Stack:</strong></p>
        <ul class="q-mt-xs">
          <li><strong>Frontend:</strong> Vue.js 3 with Composition API</li>
          <li><strong>UI Framework:</strong> Quasar Framework v2.18.2</li>
          <li><strong>Build Tool:</strong> Vite v2.3.0</li>
          <li><strong>State Management:</strong> Pinia</li>
        </ul>
      </div>
      
      <div class="q-mb-md">
        <p><strong>Database:</strong></p>
        <ul class="q-mt-xs">
          <li><strong>Engine:</strong> SQLite3</li>
          <li><strong>Features:</strong> Lightweight, serverless, ACID compliant</li>
          <li><strong>Storage:</strong> Local file-based database</li>
        </ul>
      </div>
      
      <div class="q-mb-md">
        <p><strong>Architecture:</strong></p>
        <ul class="q-mt-xs">
          <li>Component-based architecture</li>
          <li>Repository pattern for data access</li>
          <li>Service layer for business logic</li>
          <li>Protected routing with JWT authentication</li>
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
</style>
