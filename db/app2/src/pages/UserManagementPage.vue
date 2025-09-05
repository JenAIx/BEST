<template>
  <q-page class="q-pa-md">
    <!-- Page Header -->
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h4">User Management</div>
      <div class="row items-center q-gutter-md">
        <div class="text-caption text-grey-6">
          {{ getStatusText() }}
        </div>
      </div>
    </div>

    <p class="text-subtitle1 text-grey-7 q-mb-lg">Manage system users and their patient access permissions</p>

    <!-- Tab Selection -->
    <div class="row q-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-select v-model="selectedTab" :options="tabOptions" outlined dense label="Management Type" emit-value map-options @update:model-value="onTabChange" />
      </div>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- User Management -->
      <UserManager v-if="selectedTab === 'users'" ref="userManagerRef" class="tab-content" />

      <!-- User-Patient Associations -->
      <UserPatientAssociations v-if="selectedTab === 'associations'" ref="associationsManagerRef" class="tab-content" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from 'src/stores/user-store'
import UserManager from 'src/components/users/UserManager.vue'
import UserPatientAssociations from 'src/components/users/UserPatientAssociations.vue'

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
    associationsManagerRef.value.loadAssociations()
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
