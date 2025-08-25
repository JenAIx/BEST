<template>
  <div class="timeline-view">
    <div class="timeline-container">
      <div class="timeline-header">
        <h3 class="timeline-title">Visit Timeline</h3>
        <q-btn color="primary" icon="add" label="New Visit" @click="createNewVisit" />
      </div>

      <div v-if="loading" class="loading-state">
        <q-spinner-grid size="50px" color="primary" />
        <div class="text-h6 q-mt-md">Loading visits...</div>
      </div>

      <div v-else-if="visits.length === 0" class="no-visits">
        <q-icon name="event_busy" size="64px" color="grey-4" />
        <div class="text-h6 text-grey-6 q-mt-sm">No visits recorded</div>
        <div class="text-body2 text-grey-5 q-mb-md">Start by creating a new visit</div>
        <q-btn color="primary" icon="add" label="Create First Visit" @click="createNewVisit" />
      </div>

      <div v-else class="timeline-list">
        <VisitTimelineItem
          v-for="(visit, index) in sortedVisits"
          :key="visit.id"
          :visit="visit"
          :is-last="index === sortedVisits.length - 1"
          :is-selected="selectedVisit?.id === visit.id"
          @select="selectVisit"
          @edit="editVisit"
          @view="viewVisit"
          @duplicate="duplicateVisit"
          @delete="deleteVisit"
        />
      </div>
    </div>

    <!-- New Visit Dialog -->
    <NewVisitDialog v-model="showNewVisitDialog" :patient="patient" @created="onVisitCreated" />

    <!-- Visit Summary Dialog -->
    <VisitSummaryDialog v-model="showVisitSummary" :visit="selectedVisitForView" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useVisitObservationStore } from 'src/stores/visit-observation-store'
import VisitTimelineItem from './VisitTimelineItem.vue'
import NewVisitDialog from './NewVisitDialog.vue'
import VisitSummaryDialog from './VisitSummaryDialog.vue'

defineProps({
  patient: {
    type: Object,
    required: true,
  },
  selectedVisit: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['visit-selected', 'visit-edited'])

const $q = useQuasar()
const visitStore = useVisitObservationStore()

// State
const showNewVisitDialog = ref(false)
const showVisitSummary = ref(false)
const selectedVisitForView = ref(null)

// Computed from store
const visits = computed(() => visitStore.visits)
const loading = computed(() => visitStore.loading.visits)
const sortedVisits = computed(() => visitStore.sortedVisits)

// Methods

const selectVisit = (visit) => {
  emit('visit-selected', visit)
}

const editVisit = (visit) => {
  emit('visit-edited', visit)
}

const viewVisit = (visit) => {
  selectedVisitForView.value = visit
  showVisitSummary.value = true
}

const createNewVisit = () => {
  showNewVisitDialog.value = true
}

const onVisitCreated = (newVisit) => {
  // Store handles adding the visit, just emit for parent component
  emit('visit-edited', newVisit)
}

const duplicateVisit = async (visit) => {
  $q.dialog({
    title: 'Clone Visit',
    message: `This will create a new visit with all observations from ${visitStore.formatVisitDate(visit.date)}. Continue?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await visitStore.duplicateVisit(visit)
    } catch {
      // Error handling is done in the store
    }
  })
}

const deleteVisit = async (visit) => {
  $q.dialog({
    title: 'Delete Visit',
    message: `Are you sure you want to delete the visit from ${visitStore.formatVisitDate(visit.date)}? This will also delete all ${visit.observationCount} observations. This action cannot be undone.`,
    cancel: true,
    persistent: true,
    ok: {
      label: 'Delete',
      color: 'negative',
    },
  }).onOk(async () => {
    try {
      await visitStore.deleteVisit(visit)
    } catch {
      // Error handling is done in the store
    }
  })
}

// All logic now handled by the store
</script>

<style lang="scss" scoped>
.timeline-view {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background: $grey-1;
}

.timeline-container {
  max-width: 1000px;
  margin: 0 auto;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;

  .timeline-title {
    font-size: 1.5rem;
    font-weight: 400;
    color: $grey-8;
    margin: 0;
  }
}

.loading-state,
.no-visits {
  text-align: center;
  padding: 4rem 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.timeline-list {
  position: relative;
}

@media (max-width: 768px) {
  .timeline-view {
    padding: 1rem;
  }

  .timeline-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
}
</style>
