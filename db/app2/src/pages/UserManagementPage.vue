<template>
  <q-page>
    <div class="page-container">
      <!-- Page Header -->
      <PageHeader :title="$t('user.userManagement')" :subtitle="$t('user.pageSubtitle')">
        <div class="text-caption text-grey-6">
          {{ getStatusText() }}
        </div>
      </PageHeader>

      <!-- Tab Selection -->
      <div class="row q-gutter-md q-mb-md">
        <div class="col-12 col-md-6">
          <q-select v-model="selectedTab" :options="tabOptions" outlined dense :label="$t('user.managementType')" emit-value map-options @update:model-value="onTabChange" />
        </div>
      </div>

      <!-- Content Area -->
      <div class="content-area">
        <!-- User Management -->
        <UserManager v-if="selectedTab === 'users'" ref="userManagerRef" class="tab-content" />

        <!-- Patient Access Management -->
        <PatientAccessManagement v-if="selectedTab === 'associations'" ref="associationsManagerRef" class="tab-content" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from 'src/stores/user-store'
import UserManager from 'src/components/users/UserManager.vue'
import PatientAccessManagement from 'src/components/users/PatientAccessManagement.vue'
import PageHeader from 'src/components/shared/PageHeader.vue'

const userStore = useUserStore()

// State
const selectedTab = ref('users')
const userManagerRef = ref(null)
const associationsManagerRef = ref(null)

// Tab options
const tabOptions = [
  {
    label: 'User Management',
    value: 'users',
    description: 'Manage system users (create, edit, delete, reset passwords)',
  },
  {
    label: 'Patient Access',
    value: 'associations',
    description: 'Manage user access permissions to specific patients',
  },
]

// Methods
const getStatusText = () => {
  if (selectedTab.value === 'users') {
    return 'Managing system users and roles'
  } else {
    return 'Managing user-patient access permissions'
  }
}

const onTabChange = (newTab) => {
  selectedTab.value = newTab

  // Load data for the selected tab
  if (newTab === 'users' && userManagerRef.value) {
    userManagerRef.value.loadUsers()
  } else if (newTab === 'associations' && associationsManagerRef.value) {
    // PatientAccessManagement loads automatically on mount
  }
}

// Initialize
onMounted(async () => {
  await userStore.initialize()
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
</style>
