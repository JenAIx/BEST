<template>
    <div>
        <!-- Notifications Button -->
        <q-btn flat dense round icon="notifications" class="q-mr-sm" @click="openNotificationDialog">
            <q-badge v-if="showNotificationBadge" color="red" floating>{{ notificationCount }}</q-badge>
            <q-tooltip>{{ notificationCount > 0 ? `${notificationCount} notifications` : 'No new notifications'
            }}</q-tooltip>
        </q-btn>

        <!-- Notification Dialog -->
        <q-dialog v-model="showNotificationDialog" position="right" :maximized="$q.screen.lt.sm">
            <q-card style="width: 500px; max-width: 90vw; height: 600px; max-height: 90vh">
                <!-- Header -->
                <q-card-section class="row items-center q-pb-none">
                    <div class="text-h6">Recent Notifications</div>
                    <q-space />
                    <q-btn icon="close" flat round dense v-close-popup />
                </q-card-section>

                <!-- Content -->
                <q-card-section class="q-pt-none" style="height: calc(100% - 120px); overflow-y: auto;">
                    <div v-if="loggingStore.recentLogs.length === 0" class="text-center text-grey-6 q-mt-lg">
                        <q-icon name="notifications_none" size="48px" class="q-mb-md" />
                        <div>No recent notifications</div>
                    </div>

                    <q-list v-else separator>
                        <q-item v-for="log in loggingStore.recentLogs.slice().reverse()"
                            :key="`${log.timestamp}-${log.context}`" class="q-pa-md">
                            <q-item-section avatar>
                                <q-icon :name="getLogIcon(log.level)" :color="getLogColor(log.level)" size="24px" />
                            </q-item-section>

                            <q-item-section>
                                <q-item-label class="text-weight-medium">{{ log.message }}</q-item-label>
                                <q-item-label caption class="text-grey-6">
                                    {{ log.context }} • {{ formatLogTime(log.timestamp) }}
                                </q-item-label>
                                <q-item-label v-if="log.data" caption class="text-grey-7 q-mt-xs">
                                    {{ formatLogData(log.data) }}
                                </q-item-label>
                            </q-item-section>

                            <q-item-section side>
                                <q-chip :color="getLogColor(log.level)" text-color="white" size="sm"
                                    :label="log.level" />
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-card-section>

                <!-- Actions -->
                <q-card-actions align="between" class="q-pa-md">
                    <q-btn flat color="grey-7" label="Clear All Logs" @click="clearAllLogs"
                        :disable="loggingStore.recentLogs.length === 0" />
                    <q-btn flat color="primary" label="Export Logs" @click="exportLogs"
                        :disable="loggingStore.recentLogs.length === 0" />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useLoggingStore } from 'src/stores/logging-store'

const $q = useQuasar()
const loggingStore = useLoggingStore()

// UI State
const showNotificationDialog = ref(false)
const lastNotificationCount = ref(0)

// Notification badge count - show errors and warnings
const notificationCount = computed(() => {
    const errors = loggingStore.errorLogs.length
    const warnings = loggingStore.warningLogs.length
    return errors + warnings
})

// Show badge only if there are new notifications since last view
const showNotificationBadge = computed(() => {
    return notificationCount.value > lastNotificationCount.value
})

// Notification methods
const openNotificationDialog = () => {
    showNotificationDialog.value = true
    // Mark current count as "seen" to hide badge
    lastNotificationCount.value = notificationCount.value
}

const getLogIcon = (level) => {
    const icons = {
        ERROR: 'error',
        WARN: 'warning',
        SUCCESS: 'check_circle',
        INFO: 'info',
        DEBUG: 'bug_report'
    }
    return icons[level] || 'info'
}

const getLogColor = (level) => {
    const colors = {
        ERROR: 'negative',
        WARN: 'warning',
        SUCCESS: 'positive',
        INFO: 'info',
        DEBUG: 'grey-6'
    }
    return colors[level] || 'info'
}

const formatLogTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
}

const formatLogData = (data) => {
    if (!data) return ''
    if (typeof data === 'string') return data
    if (typeof data === 'object') {
        try {
            return JSON.stringify(data, null, 2).substring(0, 100) + (JSON.stringify(data).length > 100 ? '...' : '')
        } catch {
            return String(data)
        }
    }
    return String(data)
}

const clearAllLogs = () => {
    $q.dialog({
        title: 'Clear All Logs',
        message: 'Are you sure you want to clear all logs? This action cannot be undone.',
        cancel: true,
        persistent: true
    }).onOk(() => {
        loggingStore.clearLogs()
        lastNotificationCount.value = 0
        $q.notify({
            type: 'success',
            message: 'All logs cleared',
            position: 'top'
        })
    })
}

const exportLogs = () => {
    loggingStore.exportLogs()
}
</script>

<style lang="scss" scoped>
// Custom scrollbar for dialog content
:deep(.q-card-section) {
    &::-webkit-scrollbar {
        width: 8px;
    }

    &::-webkit-scrollbar-track {
        background: $grey-2;
        border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
        background: $grey-5;
        border-radius: 4px;

        &:hover {
            background: $grey-6;
        }
    }
}

// Log item styling
.q-item {
    border-radius: 8px;
    margin: 4px 0;

    &:hover {
        background-color: rgba(25, 118, 210, 0.04);
    }
}

// Chip styling for log levels
.q-chip {
    font-size: 0.7rem;
    font-weight: 500;
}
</style>
