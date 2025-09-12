<template>
  <div class="ask-ai-widget" :class="{ resizing: isResizing }" :style="{ width: widgetWidth + 'px' }">
    <!-- API Key Warning -->
    <q-banner v-if="!hasApiKey" class="bg-orange-1 text-orange-9 q-mb-md" rounded>
      <template v-slot:avatar>
        <q-icon name="warning" />
      </template>
      <div>
        <strong>OpenAI API Key Required</strong>
        <br />
        To use the AI assistant, please configure your OpenAI API key in Settings → Local Settings.
      </div>
      <template v-slot:action>
        <q-btn flat dense :label="$t('settings.goToSettings')" color="orange" @click="goToSettings" />
      </template>
    </q-banner>

    <!-- Context Banner -->
    <q-banner v-if="hasApiKey && context && context.hasContext" class="bg-blue-1 text-blue-9 q-mb-md" rounded>
      <template v-slot:avatar>
        <q-icon name="info" />
      </template>
      <div>
        <strong>Context:</strong> {{ context.visit.visitType }} visit on {{ formatDate(context.visit.date) }}
        <br />
        <span class="text-caption">{{ context.observations.total }} observations available</span>
      </div>
    </q-banner>

    <!-- Chat Interface -->
    <div v-if="hasApiKey" class="chat-container">
      <!-- Messages -->
      <q-scroll-area ref="messagesScrollArea" class="messages-container" :style="{ height: messagesHeight + 'px' }">
        <div ref="messagesContainer" class="messages">
          <div v-for="(message, index) in messages" :key="index" :class="['message', message.role, { shake: shaking[index] }]">
            <div class="message-avatar">
              <q-icon :name="message.role === 'user' ? 'person' : 'smart_toy'" :color="message.role === 'user' ? 'primary' : 'accent'" size="sm" />
            </div>
            <div class="message-content">
              <div class="message-text">{{ message.content }}</div>
              <div class="message-meta">
                <div class="message-time">{{ formatTime(message.timestamp) }}</div>
                <q-btn v-if="message.role === 'assistant'" icon="content_copy" flat round dense size="sm" class="copy-btn" @click="copyMessage(index, message)">
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
          :label="$t('smartButton.askAIPlaceholder')"
          outlined
          dense
          :placeholder="$t('smartButton.questionPlaceholder')"
          :loading="isLoading"
          :disable="isLoading"
          @keyup.enter="sendPrompt"
          autogrow
          :rows="1"
          :max-rows="3"
        >
          <template v-slot:append>
            <q-btn v-if="messages.length > 0" icon="clear_all" color="grey-7" flat round dense :disable="isLoading" @click="clearChat" class="q-mr-xs">
              <q-tooltip>Clear chat</q-tooltip>
            </q-btn>
            <q-btn icon="send" color="primary" flat round dense :disable="!currentPrompt.trim() || isLoading" @click="sendPrompt">
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
        <div><strong>AI Error:</strong> {{ error }}</div>
        <template v-slot:action>
          <q-btn flat dense :label="$t('common.retry')" color="negative" @click="retryLastPrompt" />
        </template>
      </q-banner>
    </div>

    <!-- Quick Prompts -->
    <div v-if="hasApiKey && messages.length === 0" class="quick-prompts q-mt-md">
      <div class="text-subtitle2 q-mb-sm">Quick Start:</div>
      <div class="q-gutter-sm">
        <q-btn v-for="prompt in quickPrompts" :key="prompt" :label="prompt" color="grey-7" outline dense size="sm" @click="useQuickPrompt(prompt)" :disable="isLoading" />
      </div>
    </div>
    <!-- Resize handle -->
    <div class="resize-handle" @mousedown="onResizeMouseDown" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useOpenAIStore } from 'src/stores/openai-store'
import { useLocalSettingsStore } from 'src/stores/local-settings-store'

const $q = useQuasar()
const router = useRouter()
const openAIStore = useOpenAIStore()
const localSettingsStore = useLocalSettingsStore()

// Props
const props = defineProps({
  context: {
    type: Object,
    default: () => ({ hasContext: false }),
  },
})

// Emits
const emit = defineEmits(['close'])

// Reactive state
const currentPrompt = ref('')
const lastPrompt = ref('')
const messagesScrollArea = ref(null)
const messagesContainer = ref(null)
const shaking = ref({})

// Resizable widget state
const widgetWidth = ref(480)
const messagesHeight = ref(300)
const isResizing = ref(false)
const resizeState = ref({ startX: 0, startY: 0, startWidth: 0, startHeight: 0 })

// Use persistent messages from store
const messages = computed(() => openAIStore.getChatMessages())

// Computed properties
const hasApiKey = computed(() => localSettingsStore.hasOpenAIApiKey())
const isLoading = computed(() => openAIStore.isLoading)
const error = computed(() => openAIStore.error)

// Context-aware quick prompts
const quickPrompts = computed(() => {
  const basePrompts = ['Correct spelling and grammar', 'Research drug interactions', 'Generate treatment summary']

  if (props.context && props.context.hasContext && props.context.observations) {
    const contextPrompts = [
      `Analyze ${props.context.observations.total} observations for this visit`,
      'Suggest missing observations',
      'Check for data inconsistencies',
      'Generate visit summary',
      'Identify patterns in the data',
    ]
    return [...basePrompts, ...contextPrompts]
  }

  return basePrompts
})

// Methods
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch (error) {
    void error
    return dateString
  }
}

const createContextMessage = () => {
  const context = props.context

  if (!context || !context.hasContext) {
    return {
      role: 'system',
      content: 'You are an AI assistant helping with medical data entry.',
    }
  }

  let contextText = `You are an AI assistant helping with medical data entry.

Current context:
- Visit Type: ${context.visit?.visitType || 'Unknown'}
- Visit Date: ${context.visit?.date || 'Unknown'}
- Visit Status: ${context.visit?.status || 'Unknown'}
- Location: ${context.visit?.location || 'Unknown'}
- Total Observations: ${context.observations?.total || 0}
- Observation Categories: ${context.observations?.byCategory ? Object.keys(context.observations.byCategory).join(', ') : 'None'}

Current observations:`

  // Add recent observations with cleaned up format
  if (context.observations?.recent && context.observations.recent.length > 0) {
    context.observations.recent.forEach((obs) => {
      const name = obs.conceptName || obs.concept || obs.conceptCode
      const value = obs.value
      const unit = obs.unit && obs.unit !== 'N/A' ? ` ${obs.unit}` : ''
      const category = obs.category ? ` [${obs.category}]` : ''

      contextText += `\n- ${name}: ${value}${unit}${category}`
    })
  }

  contextText += `

You can help with:
- Analyzing the current observations (family history, symptoms, lab values, diagnosis)
- Suggesting additional relevant observations for this ${context.visit?.visitType || 'visit'}
- Explaining medical concepts and terminology
- Identifying potential data inconsistencies or missing information
- Generating visit summaries based on the observations
- Providing clinical insights based on the observation patterns

Please provide helpful, accurate, and contextually relevant responses based on the current ${context.visit?.visitType || 'visit'} visit data.`

  return {
    role: 'system',
    content: contextText,
  }
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
    timestamp: new Date(),
  })

  // Scroll to bottom after adding user message
  scrollToBottom()

  // Clear input
  currentPrompt.value = ''

  try {
    // Prepare conversation history for context using the new API format
    const conversationHistory = openAIStore.getChatMessages().map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Add context information if available
    if (props.context && props.context.hasContext) {
      const contextMessage = createContextMessage()
      conversationHistory.unshift(contextMessage)
    }

    // Send to AI with full conversation history
    const response = await openAIStore.sendPromptWithHistory(conversationHistory)

    // Add AI response
    openAIStore.addMessage({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
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
    persistent: false,
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
    .catch(() => {
      /* intentionally ignored */
    })
}

// Resize handlers
const onResizeMouseDown = (event) => {
  isResizing.value = true
  resizeState.value = {
    startX: event.clientX,
    startY: event.clientY,
    startWidth: widgetWidth.value,
    startHeight: messagesHeight.value,
  }
  window.addEventListener('mousemove', onResizeMouseMove)
  window.addEventListener('mouseup', onResizeMouseUp)
}

const onResizeMouseMove = (event) => {
  if (!isResizing.value) return
  const dx = event.clientX - resizeState.value.startX
  const dy = event.clientY - resizeState.value.startY

  const minWidth = 320
  const maxWidth = window.innerWidth - 8
  const minHeight = 180
  const maxHeight = Math.min(700, window.innerHeight - 160)

  widgetWidth.value = Math.max(minWidth, Math.min(maxWidth, resizeState.value.startWidth + dx))
  messagesHeight.value = Math.max(minHeight, Math.min(maxHeight, resizeState.value.startHeight + dy))
}

const onResizeMouseUp = () => {
  isResizing.value = false
  window.removeEventListener('mousemove', onResizeMouseMove)
  window.removeEventListener('mouseup', onResizeMouseUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onResizeMouseMove)
  window.removeEventListener('mouseup', onResizeMouseUp)
})

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
          handler: goToSettings,
        },
      ],
    })
  }
})
</script>

<style lang="scss" scoped>
.ask-ai-widget {
  position: relative;
  max-width: 100%;

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

  .resize-handle {
    position: absolute;
    right: -8px;
    bottom: -8px;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    border-right: 2px solid rgba(0, 0, 0, 0.25);
    border-bottom: 2px solid rgba(0, 0, 0, 0.25);
    border-radius: 2px;
  }
}

@keyframes shake {
  10%,
  90% {
    transform: translateX(-1px);
  }
  20%,
  80% {
    transform: translateX(2px);
  }
  30%,
  50%,
  70% {
    transform: translateX(-4px);
  }
  40%,
  60% {
    transform: translateX(4px);
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

    .resize-handle {
      border-right-color: rgba(255, 255, 255, 0.35);
      border-bottom-color: rgba(255, 255, 255, 0.35);
    }
  }
}
</style>
