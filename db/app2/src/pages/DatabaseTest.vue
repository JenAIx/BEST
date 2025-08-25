<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-md">Database Test Page</div>

    <!-- Database Connection Section -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Database Connection</div>

        <div class="row q-gutter-md q-mt-md">
          <q-input v-model="databasePath" label="Database Path" filled dense class="col-6"
            placeholder="Enter database file path (e.g., ./test.db)" />

          <q-btn :loading="databaseStore.isLoading" :disable="!databasePath" color="primary" @click="initializeDatabase"
            class="col-2">
            {{ databaseStore.isConnected ? 'Reconnect' : 'Connect' }}
          </q-btn>

          <q-btn v-if="databaseStore.isConnected" :loading="databaseStore.isLoading" color="negative"
            @click="closeDatabase" class="col-2">
            Disconnect
          </q-btn>
        </div>

        <!-- Connection Status -->
        <div class="q-mt-md">
          <q-chip :color="databaseStore.isConnected ? 'positive' : 'negative'" text-color="white" icon="database">
            {{ databaseStore.isConnected ? 'Connected' : 'Disconnected' }}
          </q-chip>

          <q-chip v-if="databaseStore.isInitialized" color="positive" text-color="white" icon="check_circle">
            Initialized
          </q-chip>

          <q-chip v-if="databaseStore.connectionError" color="negative" text-color="white" icon="error">
            {{ databaseStore.connectionError }}
          </q-chip>
        </div>
      </q-card-section>
    </q-card>

    <!-- Database Operations Section -->
    <q-card v-if="databaseStore.canPerformOperations" class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Database Operations</div>

        <div class="row q-gutter-md q-mt-md">
          <q-btn :loading="databaseStore.isLoading" color="secondary" @click="refreshDatabaseInfo" class="col-2">
            Refresh Info
          </q-btn>

          <q-btn :loading="databaseStore.isLoading" color="warning" @click="validateDatabase" class="col-2">
            Validate DB
          </q-btn>

          <q-btn :loading="databaseStore.isLoading" color="negative" @click="resetDatabase" class="col-2">
            Reset DB
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <!-- Patient Operations Section -->
    <q-card v-if="databaseStore.canPerformOperations" class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Patient Operations</div>

        <!-- Create Patient Form -->
        <div class="row q-gutter-md q-mt-md">
          <q-input v-model="newPatient.PATIENT_CD" label="Patient Code" filled dense class="col-3"
            placeholder="e.g., P001" />

          <q-input v-model="newPatient.SEX_CD" label="Sex" filled dense class="col-2" placeholder="M/F" />

          <q-input v-model="newPatient.AGE_IN_YEARS" label="Age" filled dense type="number" class="col-2"
            placeholder="25" />

          <q-btn :loading="isCreatingPatient" color="positive" @click="createTestPatient" class="col-2">
            Create Patient
          </q-btn>

          <q-btn :loading="isCreatingDemoPatients" color="secondary" @click="createDemoPatients" class="col-2">
            Create Demo Patients
          </q-btn>

          <q-btn :loading="isDeletingDemoPatients" color="negative" @click="deleteDemoPatients" class="col-2">
            Delete Demo Patients
          </q-btn>
        </div>

        <!-- Patient Search -->
        <div class="row q-gutter-md q-mt-md">
          <q-input v-model="searchTerm" label="Search Patients" filled dense class="col-4"
            placeholder="Enter search term" />

          <q-btn :loading="isSearching" color="info" @click="searchPatients" class="col-2">
            Search
          </q-btn>

          <q-btn :loading="isLoadingPatients" color="secondary" @click="loadAllPatients" class="col-2">
            Load All
          </q-btn>
        </div>

        <!-- Patient List -->
        <div v-if="patients.length > 0" class="q-mt-md">
          <div class="text-subtitle1 q-mb-sm">Patients ({{ patients.length }})</div>
          <q-list bordered>
            <q-item v-for="patient in patients" :key="patient.PATIENT_NUM">
              <q-item-section>
                <q-item-label>
                  {{ patient.PATIENT_CD }} -
                  Sex: {{ patient.SEX_CD || 'N/A' }},
                  Age: {{ patient.AGE_IN_YEARS || 'N/A' }}
                </q-item-label>
                <q-item-label caption>
                  ID: {{ patient.PATIENT_NUM }} |
                  Created: {{ formatDate(patient.CREATED_AT) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>
    </q-card>

    <!-- Database Statistics Section -->
    <q-card v-if="databaseStore.canPerformOperations" class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Database Statistics</div>

        <div v-if="databaseStore.statistics" class="q-mt-md">
          <div class="row q-gutter-md">
            <div class="col-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-primary">
                    {{ databaseStore.statistics.PATIENT_DIMENSION || 0 }}
                  </div>
                  <div class="text-caption">Patients</div>
                </q-card-section>
              </q-card>
            </div>

            <div class="col-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-secondary">
                    {{ databaseStore.statistics.VISIT_DIMENSION || 0 }}
                  </div>
                  <div class="text-caption">Visits</div>
                </q-card-section>
              </q-card>
            </div>

            <div class="col-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-accent">
                    {{ databaseStore.statistics.OBSERVATION_FACT || 0 }}
                  </div>
                  <div class="text-caption">Observations</div>
                </q-card-section>
              </q-card>
            </div>

            <div class="col-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-positive">
                    {{ databaseStore.statistics.CONCEPT_DIMENSION || 0 }}
                  </div>
                  <div class="text-caption">Concepts</div>
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Migration Status Section -->
    <q-card v-if="databaseStore.canPerformOperations" class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Migration Status</div>

        <div v-if="databaseStore.migrationStatus" class="q-mt-md">
          <div class="row q-gutter-md">
            <div class="col-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-primary">
                    {{ databaseStore.migrationStatus.total || 0 }}
                  </div>
                  <div class="text-caption">Total Migrations</div>
                </q-card-section>
              </q-card>
            </div>

            <div class="col-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-positive">
                    {{ databaseStore.migrationStatus.executed || 0 }}
                  </div>
                  <div class="text-caption">Executed</div>
                </q-card-section>
              </q-card>
            </div>

            <div class="col-3">
              <q-card flat bordered>
                <q-card-section class="text-center">
                  <div class="text-h4 text-warning">
                    {{ databaseStore.migrationStatus.pending || 0 }}
                  </div>
                  <div class="text-caption">Pending</div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <div v-if="databaseStore.migrationStatus.executedMigrations" class="q-mt-md">
            <div class="text-subtitle2">Executed Migrations:</div>
            <q-list dense>
              <q-item v-for="migration in databaseStore.migrationStatus.executedMigrations" :key="migration">
                <q-item-section>
                  <q-item-label>{{ migration }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useDatabaseStore } from '../stores/database-store.js'
import { useQuasar } from 'quasar'
import { createDemoPatients as createDemoPatientsUtil } from '../core/services/demo-patient-service.js'
import { deleteDemoPatients as deleteDemoPatientsUtil, countDemoData } from '../core/services/delete-demo-patients-service.js'

const $q = useQuasar()
const databaseStore = useDatabaseStore()

// Local state
const databasePath = ref('./test.db')
const newPatient = ref({
  PATIENT_CD: '',
  SEX_CD: '',
  AGE_IN_YEARS: null
})
const searchTerm = ref('')
const patients = ref([])
const isCreatingPatient = ref(false)
const isCreatingDemoPatients = ref(false)
const isDeletingDemoPatients = ref(false)
const isSearching = ref(false)
const isLoadingPatients = ref(false)

// Methods
const initializeDatabase = async () => {
  try {
    await databaseStore.initializeDatabase(databasePath.value)
    $q.notify({
      type: 'positive',
      message: 'Database connected successfully!'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to connect: ${error.message}`
    })
  }
}

const closeDatabase = async () => {
  try {
    await databaseStore.closeDatabase()
    patients.value = []
    $q.notify({
      type: 'positive',
      message: 'Database disconnected successfully!'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to disconnect: ${error.message}`
    })
  }
}

const refreshDatabaseInfo = async () => {
  try {
    await databaseStore.refreshDatabaseInfo()
    $q.notify({
      type: 'positive',
      message: 'Database information refreshed!'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to refresh: ${error.message}`
    })
  }
}

const validateDatabase = async () => {
  try {
    const validation = await databaseStore.validateDatabase()
    if (validation.valid) {
      $q.notify({
        type: 'positive',
        message: 'Database validation passed!'
      })
    } else {
      $q.notify({
        type: 'warning',
        message: `Database validation issues: ${validation.errors.length} errors found`
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Validation failed: ${error.message}`
    })
  }
}

const resetDatabase = async () => {
  try {
    $q.dialog({
      title: 'Confirm Reset',
      message: 'This will delete all data and recreate the database schema. Are you sure?',
      cancel: true,
      persistent: true
    }).onOk(async () => {
      await databaseStore.resetDatabase()
      patients.value = []
      $q.notify({
        type: 'positive',
        message: 'Database reset completed!'
      })
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Reset failed: ${error.message}`
    })
  }
}

const createTestPatient = async () => {
  if (!newPatient.value.PATIENT_CD) {
    $q.notify({
      type: 'warning',
      message: 'Patient Code is required!'
    })
    return
  }

  try {
    isCreatingPatient.value = true

    const patient = await databaseStore.createPatient({
      ...newPatient.value,
      VITAL_STATUS_CD: 'A', // Active
      LANGUAGE_CD: 'EN',
      RACE_CD: 'UNK',
      MARITAL_STATUS_CD: 'UNK',
      RELIGION_CD: 'UNK',
      SOURCESYSTEM_CD: 'TEST',
      UPLOAD_ID: 1
    })

    // Clear form
    newPatient.value = {
      PATIENT_CD: '',
      SEX_CD: '',
      AGE_IN_YEARS: null
    }

    // Refresh patient list
    await loadAllPatients()

    $q.notify({
      type: 'positive',
      message: `Patient ${patient.PATIENT_CD} created successfully!`
    })

  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to create patient: ${error.message}`
    })
  } finally {
    isCreatingPatient.value = false
  }
}

const createDemoPatients = async () => {
  try {
    isCreatingDemoPatients.value = true

    // Get repositories from the database store
    const repositories = {
      patientRepository: databaseStore.getRepository('patient'),
      visitRepository: databaseStore.getRepository('visit'),
      observationRepository: databaseStore.getRepository('observation'),
      conceptRepository: databaseStore.getRepository('concept')
    }

    $q.notify({
      type: 'info',
      message: 'Creating 20 demo patients with visits and observations...',
      timeout: 2000
    })

    const results = await createDemoPatientsUtil(repositories, 20)

    if (results.errors.length > 0) {
      console.warn('Demo patient creation had some errors:', results.errors)
      $q.notify({
        type: 'warning',
        message: `Demo patients created with ${results.errors.length} warnings. Check console for details.`,
        timeout: 5000
      })
    } else {
      $q.notify({
        type: 'positive',
        message: `Successfully created ${results.patients.length} demo patients with ${results.visits.length} visits and ${results.observations.length} observations!`,
        timeout: 5000
      })
    }

    // Refresh patient list to show the new demo patients
    await loadAllPatients()

    // Refresh database statistics
    await refreshDatabaseInfo()

  } catch (error) {
    console.error('Failed to create demo patients:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to create demo patients: ${error.message}`,
      timeout: 5000
    })
  } finally {
    isCreatingDemoPatients.value = false
  }
}

const deleteDemoPatients = async () => {
  try {
    isDeletingDemoPatients.value = true

    // First check if there are any demo patients to delete
    const repositories = {
      patientRepository: databaseStore.getRepository('patient'),
      visitRepository: databaseStore.getRepository('visit'),
      observationRepository: databaseStore.getRepository('observation'),
      conceptRepository: databaseStore.getRepository('concept')
    }

    const count = await countDemoData(repositories)

    if (count.totalRecords === 0) {
      $q.notify({
        type: 'info',
        message: 'No demo patients found to delete.',
        timeout: 3000
      })
      return
    }

    // Confirm deletion
    $q.dialog({
      title: 'Confirm Deletion',
      message: `This will delete ${count.patients} demo patients, ${count.visits} visits, and ${count.observations} observations. Are you sure?`,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      try {
        $q.notify({
          type: 'info',
          message: 'Deleting demo patients...',
          timeout: 2000
        })

        const results = await deleteDemoPatientsUtil(repositories)

        if (results.errors.length > 0) {
          console.warn('Demo patient deletion had some errors:', results.errors)
          $q.notify({
            type: 'warning',
            message: `Demo patients deleted with ${results.errors.length} warnings. Check console for details.`,
            timeout: 5000
          })
        } else {
          $q.notify({
            type: 'positive',
            message: `Successfully deleted ${results.deletedPatients} demo patients, ${results.deletedVisits} visits, and ${results.deletedObservations} observations!`,
            timeout: 5000
          })
        }

        // Refresh patient list and database statistics
        await loadAllPatients()
        await refreshDatabaseInfo()

      } catch (error) {
        console.error('Failed to delete demo patients:', error)
        $q.notify({
          type: 'negative',
          message: `Failed to delete demo patients: ${error.message}`,
          timeout: 5000
        })
      }
    })

  } catch (error) {
    console.error('Failed to count demo patients:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to count demo patients: ${error.message}`,
      timeout: 5000
    })
  } finally {
    isDeletingDemoPatients.value = false
  }
}

const searchPatients = async () => {
  if (!searchTerm.value.trim()) {
    $q.notify({
      type: 'warning',
      message: 'Please enter a search term!'
    })
    return
  }

  try {
    isSearching.value = true
    patients.value = await databaseStore.searchPatients(searchTerm.value)

    if (patients.value.length === 0) {
      $q.notify({
        type: 'info',
        message: 'No patients found matching your search.'
      })
    }

  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Search failed: ${error.message}`
    })
  } finally {
    isSearching.value = false
  }
}

const loadAllPatients = async () => {
  try {
    isLoadingPatients.value = true
    patients.value = await databaseStore.findPatients()

    if (patients.value.length === 0) {
      $q.notify({
        type: 'info',
        message: 'No patients found in database.'
      })
    }

  } catch (error) {
    $q.notify({
      type: 'negative',
      message: `Failed to load patients: ${error.message}`
    })
  } finally {
    isLoadingPatients.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleString()
  } catch {
    return dateString
  }
}

// Lifecycle
onMounted(() => {
  // Set default database path
  databasePath.value = './test.db'
})
</script>

<style scoped>
.q-card {
  margin-bottom: 1rem;
}
</style>
