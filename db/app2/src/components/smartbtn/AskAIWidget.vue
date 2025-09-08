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
      <q-scroll-area ref="messagesScrollArea" class="messages-container" :style="{ height: '300px' }">
        <div ref="messagesContainer" class="messages">
          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="['message', message.role, { shake: shaking[index] }]"
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
              <div class="message-meta">
                <div class="message-time">{{ formatTime(message.timestamp) }}</div>
                <q-btn
                  v-if="message.role === 'assistant'"
                  icon="content_copy"
                  flat
                  round
                  dense
                  size="sm"
                  class="copy-btn"
                  @click="copyMessage(index, message)"
                >
                  <q-tooltip>Copy</q-tooltip>
                </q-btn>
              </div>
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
              v-if="messages.length > 0"
              icon="clear_all"
              color="grey-7"
              flat
              round
              dense
              :disable="isLoading"
              @click="clearChat"
              class="q-mr-xs"
            >
              <q-tooltip>Clear chat</q-tooltip>
            </q-btn>
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
import { ref, computed, onMounted, nextTick } from 'vue'
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
const lastPrompt = ref('')
const messagesScrollArea = ref(null)
const messagesContainer = ref(null)
const shaking = ref({})

// Use persistent messages from store
const messages = computed(() => openAIStore.getChatMessages())

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

const scrollToBottom = () => {
  nextTick(() => {
    setTimeout(() => {
      if (messagesScrollArea.value) {
        // Try multiple methods to ensure scrolling works
        try {
          // Method 1: Quasar's setScrollPosition
          messagesScrollArea.value.setScrollPosition('vertical', 999999, 100)
        } catch {
          // Method 2: Direct DOM manipulation
          const scrollTarget = messagesScrollArea.value.$el?.querySelector('.scroll')
          if (scrollTarget) {
            scrollTarget.scrollTop = scrollTarget.scrollHeight
          }
        }
      }
    }, 50)
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
  openAIStore.addMessage({
    role: 'user',
    content: prompt,
    timestamp: new Date()
  })

  // Scroll to bottom after adding user message
  scrollToBottom()

  // Clear input
  currentPrompt.value = ''

  try {
    // Prepare conversation history for context using the new API format
    const conversationHistory = openAIStore.getChatMessages().map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Send to AI with full conversation history
    const response = await openAIStore.sendPromptWithHistory(conversationHistory)

    // Add AI response
    openAIStore.addMessage({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    })

    // Scroll to bottom after adding AI response
    scrollToBottom()

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

const clearChat = () => {
  $q.dialog({
    title: 'Clear Chat',
    message: 'Are you sure you want to clear all messages? This action cannot be undone.',
    cancel: true,
    persistent: false
  }).onOk(() => {
    openAIStore.clearChatMessages()
    currentPrompt.value = ''
    lastPrompt.value = ''
    openAIStore.clearResponse()
  })
}

const copyMessage = (index, message) => {
  const text = message?.content || ''
  if (!text) return
  navigator.clipboard
    .writeText(text)
    .then(() => {
      shaking.value[index] = true
      setTimeout(() => {
        shaking.value[index] = false
      }, 400)
    })
    .catch(() => { /* intentionally ignored */ })
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

      .message-meta {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 8px 0 12px;
      }

      .copy-btn {
        color: rgba(0, 0, 0, 0.5);
      }

      &.shake {
        animation: shake 0.35s ease-in-out;
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

@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
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
