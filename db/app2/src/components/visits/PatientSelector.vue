<template>
    <div class="patient-selection-container">
        <div class="selection-hero">
            <q-icon name="medical_information" size="64px" color="primary" class="hero-icon" />
            <h1 class="hero-title">Patient Visits</h1>
            <p class="hero-subtitle">Select a patient to view and manage their visit history</p>
        </div>

        <q-card class="selection-card" flat bordered>
            <q-card-section>
                <div class="text-h6 text-center q-mb-md">
                    <q-icon name="person_search" class="q-mr-sm" />
                    Find Patient
                </div>
                
                <!-- Search Input -->
                <q-input
                    v-model="searchQuery"
                    placeholder="Search by name or Patient ID..."
                    outlined
                    dense
                    @update:model-value="onSearchInput"
                    :loading="searchLoading"
                    debounce="300"
                >
                    <template v-slot:prepend>
                        <q-icon name="search" />
                    </template>
                    <template v-slot:append v-if="searchQuery">
                        <q-icon name="close" @click="clearSearch" class="cursor-pointer" />
                    </template>
                </q-input>
            </q-card-section>

            <!-- Recent Patients -->
            <q-card-section v-if="!searchQuery && recentPatients.length > 0">
                <div class="text-subtitle2 text-grey-7 q-mb-sm">
                    <q-icon name="history" size="16px" class="q-mr-xs" />
                    Recent Patients
                </div>
                <div class="recent-patients-grid">
                    <PatientCard
                        v-for="patient in recentPatients"
                        :key="patient.id"
                        :patient="patient"
                        variant="recent"
                        @select="selectPatient"
                    />
                </div>
            </q-card-section>

            <!-- Search Results -->
            <q-card-section v-if="searchQuery && searchResults.length > 0">
                <div class="text-subtitle2 text-grey-7 q-mb-sm">
                    <q-icon name="search" size="16px" class="q-mr-xs" />
                    Search Results ({{ searchResults.length }})
                </div>
                <div class="search-results">
                    <PatientCard
                        v-for="patient in searchResults"
                        :key="patient.id"
                        :patient="patient"
                        variant="search"
                        @select="selectPatient"
                    />
                </div>
            </q-card-section>

            <!-- No Results -->
            <q-card-section v-if="searchQuery && searchResults.length === 0 && !searchLoading">
                <div class="no-results">
                    <q-icon name="search_off" size="48px" color="grey-4" />
                    <div class="text-h6 text-grey-6 q-mt-sm">No patients found</div>
                    <div class="text-body2 text-grey-5">Try a different search term</div>
                </div>
            </q-card-section>

            <!-- Loading State -->
            <q-card-section v-if="searchLoading">
                <div class="loading-state">
                    <q-spinner-dots size="40px" color="primary" />
                    <div class="text-body2 text-grey-6 q-mt-sm">Searching patients...</div>
                </div>
            </q-card-section>
        </q-card>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useDatabaseStore } from 'src/stores/database-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'
import PatientCard from './PatientCard.vue'

const emit = defineEmits(['patient-selected'])

const dbStore = useDatabaseStore()
const localSettings = useLocalSettingsStore()

// State
const searchQuery = ref('')
const searchLoading = ref(false)
const searchResults = ref([])
const recentPatients = ref([])

// Methods
const loadRecentPatients = async () => {
    try {
        const recent = localSettings.getSetting('visits.recentPatients') || []
        
        if (recent.length > 0 && dbStore.canPerformOperations) {
            const patientRepo = dbStore.getRepository('patient')
            const patientDetails = await Promise.all(
                recent.slice(0, 5).map(async (patientId) => {
                    try {
                        const patient = await patientRepo.findByPatientCode(patientId)
                        if (patient) {
                            const lastVisitDate = await getLastVisitDate(patient.PATIENT_NUM)
                            return {
                                id: patient.PATIENT_CD,
                                name: getPatientName(patient),
                                age: patient.AGE_IN_YEARS,
                                gender: patient.SEX_RESOLVED || patient.SEX_CD,
                                lastVisit: lastVisitDate,
                                visitCount: await getVisitCount(patient.PATIENT_NUM)
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to load recent patient ${patientId}:`, error)
                    }
                    return null
                })
            )
            recentPatients.value = patientDetails.filter(p => p !== null)
        }
    } catch (error) {
        console.error('Failed to load recent patients:', error)
    }
}

const onSearchInput = async () => {
    if (!searchQuery.value.trim()) {
        searchResults.value = []
        return
    }

    try {
        searchLoading.value = true
        
        if (!dbStore.canPerformOperations) {
            throw new Error('Database not ready')
        }

        const patientRepo = dbStore.getRepository('patient')
        const results = await patientRepo.searchPatients(searchQuery.value.trim())
        
        // Enhance results with additional data
        const enhancedResults = await Promise.all(
            results.map(async (patient) => {
                const visitCount = await getVisitCount(patient.PATIENT_NUM)
                return {
                    id: patient.PATIENT_CD,
                    name: getPatientName(patient),
                    age: patient.AGE_IN_YEARS,
                    gender: patient.SEX_RESOLVED || patient.SEX_CD,
                    visitCount,
                    lastVisit: visitCount > 0 ? await getLastVisitDate(patient.PATIENT_NUM) : null
                }
            })
        )
        
        searchResults.value = enhancedResults
    } catch (error) {
        console.error('Search failed:', error)
        searchResults.value = []
    } finally {
        searchLoading.value = false
    }
}

const clearSearch = () => {
    searchQuery.value = ''
    searchResults.value = []
}

const selectPatient = (patient) => {
    // Add to recent patients
    const recent = localSettings.getSetting('visits.recentPatients') || []
    const updatedRecent = [patient.id, ...recent.filter(id => id !== patient.id)].slice(0, 10)
    localSettings.setSetting('visits.recentPatients', updatedRecent)
    
    emit('patient-selected', patient)
}

// Helper Methods
const getPatientName = (patient) => {
    if (!patient) return 'Unknown Patient'
    
    if (patient.PATIENT_BLOB) {
        try {
            const blob = JSON.parse(patient.PATIENT_BLOB)
            if (blob.name) return blob.name
            if (blob.firstName && blob.lastName) return `${blob.firstName} ${blob.lastName}`
        } catch {
            // Fallback
        }
    }
    return patient.PATIENT_CD || 'Unknown Patient'
}

const getLastVisitDate = async (patientNum) => {
    try {
        const visitRepo = dbStore.getRepository('visit')
        const visits = await visitRepo.findByPatientNum(patientNum)
        
        if (visits.length > 0) {
            const lastVisit = visits.sort((a, b) => new Date(b.START_DATE) - new Date(a.START_DATE))[0]
            return formatVisitDate(lastVisit.START_DATE)
        }
    } catch (error) {
        console.warn('Failed to get last visit date:', error)
    }
    return null
}

const getVisitCount = async (patientNum) => {
    try {
        const visitRepo = dbStore.getRepository('visit')
        const visits = await visitRepo.findByPatientNum(patientNum)
        return visits.length
    } catch (error) {
        console.warn('Failed to get visit count:', error)
        return 0
    }
}

const formatVisitDate = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

// Lifecycle
onMounted(async () => {
    await loadRecentPatients()
})
</script>

<style lang="scss" scoped>
.patient-selection-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    min-height: 100vh;
}

.selection-hero {
    text-align: center;
    margin-bottom: 3rem;
    
    .hero-icon {
        margin-bottom: 1rem;
        opacity: 0.8;
    }
    
    .hero-title {
        font-size: 3rem;
        font-weight: 300;
        color: $primary;
        margin: 0 0 1rem 0;
        letter-spacing: -1px;
    }
    
    .hero-subtitle {
        font-size: 1.2rem;
        color: $grey-7;
        margin: 0;
        line-height: 1.5;
    }
}

.selection-card {
    width: 100%;
    max-width: 800px;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    background: rgba(255, 255, 255, 0.95);
}

.recent-patients-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
}

.search-results {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.no-results,
.loading-state {
    text-align: center;
    padding: 3rem 1rem;
}

@media (max-width: 768px) {
    .patient-selection-container {
        padding: 1rem;
    }
    
    .selection-hero {
        margin-bottom: 2rem;
        
        .hero-title {
            font-size: 2rem;
        }
    }
    
    .recent-patients-grid {
        grid-template-columns: 1fr;
    }
}
</style>
