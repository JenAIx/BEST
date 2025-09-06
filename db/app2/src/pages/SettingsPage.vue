<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-md">Settings</div>

    <div class="row q-col-gutter-md">
      <!-- User Profile Settings -->
      <div class="col-12 col-md-6">
        <q-card class="q-mb-md full-height">
          <q-card-section>
            <div class="text-h6">Profile Settings</div>
          </q-card-section>

          <q-card-section class="flex-grow">
            <SettingsForm :user="currentUser" @save="onSaveProfile" @reset-password="onResetPassword" />
          </q-card-section>
        </q-card>
      </div>

      <!-- Account Information -->
      <div class="col-12 col-md-6">
        <q-card class="full-height">
          <q-card-section>
            <div class="text-h6">Account Information</div>
          </q-card-section>

          <q-card-section class="flex-grow">
            <q-list>
              <q-item>
                <q-item-section>
                  <q-item-label caption>Display Name</q-item-label>
                  <q-item-label>{{ currentUser?.NAME_CHAR || 'N/A' }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section>
                  <q-item-label caption>Username</q-item-label>
                  <q-item-label>{{ currentUser?.USER_CD || 'N/A' }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section>
                  <q-item-label caption>Role</q-item-label>
                  <q-item-label>{{ currentUser?.COLUMN_CD || 'N/A' }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section>
                  <q-item-label caption>Last Login</q-item-label>
                  <q-item-label>{{ formatDate(currentUser?.lastLogin) }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Password Reset Dialog -->
    <PasswordResetDialog v-model="showPasswordDialog" @save="onPasswordSave" @cancel="onPasswordCancel" />
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth-store'
import SettingsForm from 'components/SettingsForm.vue'
import PasswordResetDialog from 'components/PasswordResetDialog.vue'

const $q = useQuasar()
const authStore = useAuthStore()

const currentUser = computed(() => authStore.currentUser)
const showPasswordDialog = ref(false)

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleString()
}

const onSaveProfile = async (userData) => {
  try {
    await authStore.updateProfile(userData)
    $q.notify({
      type: 'positive',
      message: 'Profile updated successfully',
      position: 'top',
    })
  } catch (error) {
    console.error('Profile update error:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to update profile: ${error.message || 'Unknown error'}`,
      position: 'top',
    })
  }
}

const onResetPassword = () => {
  showPasswordDialog.value = true
}

const onPasswordSave = async (passwordData) => {
  try {
    await authStore.updatePassword(passwordData.newPassword)
    $q.notify({
      type: 'positive',
      message: 'Password updated successfully',
      position: 'top',
    })
    showPasswordDialog.value = false
  } catch (error) {
    console.error('Password update error:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to update password: ${error.message || 'Unknown error'}`,
      position: 'top',
    })
  }
}

const onPasswordCancel = () => {
  showPasswordDialog.value = false
}
</script>

<style lang="scss" scoped>
.full-height {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.flex-grow {
  flex: 1;
}
</style>
