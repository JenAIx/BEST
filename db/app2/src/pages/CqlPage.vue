<template>
  <q-page class="q-pa-md">
    <!-- Page Header -->
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">CQL Administration</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">
          {{ getStatusText() }}
        </div>
      </div>
    </div>

    <p class="text-subtitle1 text-grey-7 q-mb-lg">Manage CQL rules and their associations with concepts</p>

    <!-- Tab Selection -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-select v-model="selectedTab" :options="tabOptions" outlined dense label="Management Type" emit-value map-options @update:model-value="onTabChange" />
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- CQL Rules Management -->
      <CqlRulesManager v-if="selectedTab === 'rules'" ref="rulesManagerRef" class="tab-content" />

      <!-- CQL-Concept Associations -->
      <CqlConceptAssociations v-if="selectedTab === 'associations'" ref="associationsManagerRef" class="tab-content" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useCqlStore } from 'src/stores/cql-store'
import CqlRulesManager from 'src/components/cql/CqlRulesManager.vue'
import CqlConceptAssociations from 'src/components/cql/CqlConceptAssociations.vue'

const cqlStore = useCqlStore()

// State
const selectedTab = ref('rules')
const rulesManagerRef = ref(null)
const associationsManagerRef = ref(null)

// Tab options
const tabOptions = [
  {
    label: 'CQL Rules',
    value: 'rules',
    description: 'Manage CQL rules (create, edit, test, delete)',
  },
  {
    label: 'Concept Associations',
    value: 'associations',
    description: 'Manage associations between concepts and CQL rules',
  },
]

// Computed properties
const totalRules = computed(() => cqlStore.totalRules)

// Methods
const getStatusText = () => {
  if (selectedTab.value === 'rules') {
    return `Showing ${cqlStore.cqlRules.length} of ${totalRules.value} CQL rules`
  } else {
    return 'Managing CQL-Concept associations'
  }
}

const onTabChange = (newTab) => {
  selectedTab.value = newTab

  // Load data for the selected tab
  if (newTab === 'rules' && rulesManagerRef.value) {
    rulesManagerRef.value.loadCqlRules()
  } else if (newTab === 'associations' && associationsManagerRef.value) {
    associationsManagerRef.value.loadAssociations()
  }
}

// Initialize
onMounted(async () => {
  await cqlStore.initialize()
})
</script>

<style lang="scss" scoped>
.content-area {
  .tab-content {
    animation: fadeIn 0.3s ease-in-out;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.monospace {
  font-family: 'Courier New', monospace;
  font-size: 0.8em;
}
</style>
