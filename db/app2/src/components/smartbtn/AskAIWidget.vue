<template>
  <div class="ask-ai-widget">
    <!-- API Key Warning -->
    <q-banner v-if="!hasApiKey" class="bg-orange-1 text-orange-9 q-mb-md" rounded>
      <template v-slot:avatar>
        <q-icon name="warning" />
      </template>
      <div>
        <strong>OpenAI API Key Required</strong>
        <br>
        To use the AI assistant, please configure your OpenAI API key in Settings → Local Settings.
      </div>
      <template v-slot:action>
        <q-btn
          flat
          dense
          label="Go to Settings"
          color="orange"
          @click="goToSettings"
        />
      </template>
    </q-banner>

    <!-- Chat Interface -->
    <div v-if="hasApiKey" class="chat-container">
      <!-- Messages -->
      <q-scroll-area class="messages-container" :style="{ height: '300px' }">
        <div class="messages">
          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="['message', message.role]"
          >
            <div class="message-avatar">
              <q-icon
                :name="message.role === 'user' ? 'person' : 'smart_toy'"
                :color="message.role === 'user' ? 'primary' : 'accent'"
                size="sm"
              />
            </div>
            <div class="message-content">
              <div class="message-text">{{ message.content }}</div>
              <div class="message-time">{{ formatTime(message.timestamp) }}</div>
            </div>
          </div>

          <!-- Loading indicator -->
          <div v-if="isLoading" class="message assistant loading">
            <div class="message-avatar">
              <q-icon name="smart_toy" color="accent" size="sm" />
            </div>
            <div class="message-content">
              <q-linear-progress indeterminate color="accent" size="2px" class="q-mb-sm" />
              <div class="message-text text-grey-6">AI is thinking...</div>
            </div>
          </div>
        </div>
      </q-scroll-area>

      <!-- Input Area -->
      <div class="input-container q-mt-md">
        <q-input
          v-model="currentPrompt"
          label="Ask AI anything..."
          outlined
          dense
          placeholder="Type your question here..."
          :loading="isLoading"
          :disable="isLoading"
          @keyup.enter="sendPrompt"
          autogrow
          :rows="1"
          :max-rows="3"
        >
          <template v-slot:append>
            <q-btn
              icon="send"
              color="primary"
              flat
              round
              dense
              :disable="!currentPrompt.trim() || isLoading"
              @click="sendPrompt"
            >
              <q-tooltip>Send message</q-tooltip>
            </q-btn>
          </template>
        </q-input>
      </div>

      <!-- Error Message -->
      <q-banner v-if="error" class="bg-negative-1 text-negative-9 q-mt-md" rounded>
        <template v-slot:avatar>
          <q-icon name="error" />
        </template>
        <div>
          <strong>AI Error:</strong> {{ error }}
        </div>
        <template v-slot:action>
          <q-btn
            flat
            dense
            label="Retry"
            color="negative"
            @click="retryLastPrompt"
          />
        </template>
      </q-banner>
    </div>

    <!-- Quick Prompts -->
    <div v-if="hasApiKey && messages.length === 0" class="quick-prompts q-mt-md">
      <div class="text-subtitle2 q-mb-sm">Quick Start:</div>
      <div class="q-gutter-sm">
        <q-btn
          v-for="prompt in quickPrompts"
          :key="prompt"
          :label="prompt"
          color="grey-7"
          outline
          dense
          size="sm"
          @click="useQuickPrompt(prompt)"
          :disable="isLoading"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useOpenAIStore } from 'src/stores/openai-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const $q = useQuasar()
const router = useRouter()
const openAIStore = useOpenAIStore()
const localSettingsStore = useLocalSettingsStore()

// Emits
const emit = defineEmits(['close'])

// Reactive state
const currentPrompt = ref('')
const messages = ref([])
const lastPrompt = ref('')

// Computed properties
const hasApiKey = computed(() => localSettingsStore.hasOpenAIApiKey())
const isLoading = computed(() => openAIStore.isLoading)
const error = computed(() => openAIStore.error)

// Quick prompts for users
const quickPrompts = [
  'Explain medical terminology',
  'Help with patient notes',
  'Research drug interactions',
  'Generate treatment summary'
]

// Methods
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const goToSettings = () => {
  router.push('/settings')
  emit('close')
}

const sendPrompt = async () => {
  if (!currentPrompt.value.trim() || isLoading.value) return

  const prompt = currentPrompt.value.trim()
  lastPrompt.value = prompt

  // Add user message
  messages.value.push({
    role: 'user',
    content: prompt,
    timestamp: new Date()
  })

  // Clear input
  currentPrompt.value = ''

  try {
    // Send to AI
    const response = await openAIStore.sendPrompt(prompt)

    // Add AI response
    messages.value.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    })

    // Clear any previous errors
    openAIStore.clearResponse()
  } catch (err) {
    // Error is handled by the store and displayed in the banner
    console.error('Failed to send prompt:', err)
  }
}

const retryLastPrompt = async () => {
  if (!lastPrompt.value) return

  currentPrompt.value = lastPrompt.value
  await sendPrompt()
}

const useQuickPrompt = (prompt) => {
  currentPrompt.value = prompt
}

// Initialize on mount
onMounted(() => {
  if (!hasApiKey.value) {
    $q.notify({
      type: 'info',
      message: 'Please configure your OpenAI API key in Settings',
      position: 'top',
      actions: [
        {
          label: 'Go to Settings',
          color: 'white',
          handler: goToSettings
        }
      ]
    })
  }
})
</script>

<style lang="scss" scoped>
.ask-ai-widget {
  .chat-container {
    .messages-container {
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      padding: 8px;
    }

    .messages {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      gap: 8px;
      align-items: flex-start;

      &.user {
        flex-direction: row-reverse;

        .message-content {
          align-items: flex-end;
        }
      }

      &.assistant {
        .message-content {
          align-items: flex-start;
        }
      }

      .message-avatar {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.04);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .message-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-width: calc(100% - 40px);
      }

      .message-text {
        padding: 8px 12px;
        border-radius: 12px;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      &.user .message-text {
        background: var(--q-primary);
        color: white;
      }

      &.assistant .message-text {
        background: rgba(0, 0, 0, 0.04);
        color: var(--q-dark);
      }

      &.loading .message-text {
        font-style: italic;
      }

      .message-time {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.5);
        padding: 0 12px;
      }
    }
  }

  .input-container {
    .q-field {
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;
    }
  }

  .quick-prompts {
    .q-btn {
      text-transform: none;
      font-size: 0.875rem;
    }
  }
}

// Dark theme support
.dark {
  .ask-ai-widget {
    .chat-container {
      .messages-container {
        border-color: rgba(255, 255, 255, 0.2);
      }

      .message {
        &.assistant .message-text {
          background: rgba(255, 255, 255, 0.08);
          color: var(--q-light);
        }

        .message-time {
          color: rgba(255, 255, 255, 0.5);
        }
      }
    }

    .input-container {
      .q-field {
        background: rgba(255, 255, 255, 0.08);
      }
    }
  }
}
</style>
