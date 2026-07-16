<template>
  <q-page>
    <div class="page-container">
      <PageHeader :title="$t('common.settings')" :subtitle="$t('settings.pageSubtitle')" />

      <q-banner v-if="mustChangePassword" class="bg-warning text-dark q-mb-md" rounded>
        <template v-slot:avatar>
          <q-icon name="lock_reset" />
        </template>
        {{ $t('settings.passwordResetRequired') }}
        <template v-slot:action>
          <q-btn flat color="dark" :label="$t('settings.changePassword')" @click="onResetPassword" />
        </template>
      </q-banner>

      <div class="row q-col-gutter-md">
        <!-- User Profile Settings -->
        <div class="col-12 col-md-6">
          <q-card class="q-mb-md full-height">
            <q-card-section>
              <div class="text-h6">{{ $t('settings.profileSettings') }}</div>
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
              <div class="text-h6">{{ $t('settings.accountInformation') }}</div>
            </q-card-section>

            <q-card-section class="flex-grow">
              <q-list>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>{{ $t('settings.displayName') }}</q-item-label>
                    <q-item-label>{{ currentUser?.NAME_CHAR || 'N/A' }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label caption>{{ $t('auth.username') }}</q-item-label>
                    <q-item-label>{{ currentUser?.USER_CD || 'N/A' }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label caption>{{ $t('user.role') }}</q-item-label>
                    <q-item-label>{{ currentUser?.COLUMN_CD || 'N/A' }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label caption>{{ $t('settings.lastLogin') }}</q-item-label>
                    <q-item-label>{{ formatDate(currentUser?.lastLogin) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Local Settings -->
      <div class="row q-mt-md">
        <div class="col-12">
          <q-card>
            <q-card-section>
              <div class="text-h6">{{ $t('settings.localSettings') }}</div>
            </q-card-section>

            <q-card-section>
              <LocalSettingsForm />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Password Reset Dialog -->
      <PasswordResetDialog v-model="showPasswordDialog" @save="onPasswordSave" @cancel="onPasswordCancel" />
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'
import { useNotify } from 'src/composables/useNotify'
import PageHeader from 'src/components/shared/PageHeader.vue'
import SettingsForm from 'components/SettingsForm.vue'
import PasswordResetDialog from 'components/PasswordResetDialog.vue'
import LocalSettingsForm from 'components/LocalSettingsForm.vue'

const notify = useNotify()
const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()

const currentUser = computed(() => authStore.currentUser)
const mustChangePassword = computed(() => authStore.mustChangePassword)
const showPasswordDialog = ref(false)

// Auto-open the password dialog when the auth-guard forced a redirect here
onMounted(() => {
  if (mustChangePassword.value || route.query.forceReset === 'true') {
    showPasswordDialog.value = true
  }
})

const formatDate = (dateString) => {
  if (!dateString) return t('settings.never')
  return new Date(dateString).toLocaleString()
}

const onSaveProfile = async (userData) => {
  try {
    await authStore.updateProfile(userData)
    notify.success(t('settings.profileUpdatedSuccess'))
  } catch (error) {
    console.error('Profile update error:', error)
    notify.error(t('settings.profileUpdateFailed', { error: error.message || t('common.unknownError') }))
  }
}

const onResetPassword = () => {
  showPasswordDialog.value = true
}

const onPasswordSave = async (passwordData) => {
  try {
    await authStore.updatePassword(passwordData.newPassword)
    notify.success(t('settings.passwordUpdatedSuccess'))
    showPasswordDialog.value = false
  } catch (error) {
    console.error('Password update error:', error)
    notify.error(t('settings.passwordUpdateFailed', { error: error.message || t('common.unknownError') }))
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
